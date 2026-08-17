import { api, ApiError } from "@/api/client";
import type { OutboxOp } from "./db";
import { useStore } from "./store";

/**
 * Delta-sync engine — the "never lose your data" loop.
 *
 * Each cycle:
 *   1. Drain the outbox in order (local creates/edits) to the server. Local ids
 *      are remapped to server ids as creates land, so dependent ops (a txn on a
 *      just-created account) still resolve.
 *   2. Pull `GET /api/finance/sync?since=<cursor>` and fold every changed row —
 *      including tombstones (`deletedAt`) — back in with last-write-wins.
 *
 * Offline is a first-class state: a network failure pauses the cycle with the
 * outbox intact and retries on the next tick / reconnect. Nothing is dropped.
 */

let running = false;
let timer: ReturnType<typeof setInterval> | null = null;

export interface SyncOutcome {
  ok: boolean;
  offline: boolean;
  unauthorized: boolean;
  pushed: number;
  pulled: number;
}

function isNetworkError(err: unknown): boolean {
  // fetch rejects (not an ApiError) on connectivity loss; treat 5xx as transient too.
  if (err instanceof ApiError) return err.status >= 500;
  return true;
}

async function flushOutbox(): Promise<{ offline: boolean; unauthorized: boolean; pushed: number }> {
  let pushed = 0;
  const idMap: Record<string, string> = {}; // localId -> serverId

  // Snapshot the queue; process front-to-back, rewriting the store's outbox as
  // we confirm each op so a crash mid-flush never double-applies.
  let queue = [...useStore.getState().outbox];

  while (queue.length > 0) {
    const op = remap(queue[0], idMap);
    try {
      await applyOp(op, idMap);
      pushed += 1;
      queue = queue.slice(1);
      useStore.getState()._setOutbox(queue);
      await useStore.getState().persist();
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        return { offline: false, unauthorized: true, pushed };
      }
      if (err instanceof ApiError && err.status >= 400 && err.status < 500) {
        // Poison op the server will never accept (stale/invalid). Drop it so the
        // queue can drain, rather than blocking every future sync forever.
        console.warn("[sync] dropping rejected op", op.kind, err.message);
        queue = queue.slice(1);
        useStore.getState()._setOutbox(queue);
        await useStore.getState().persist();
        continue;
      }
      // Network / server-transient: stop, keep the queue, retry next tick.
      return { offline: isNetworkError(err), unauthorized: false, pushed };
    }
  }
  return { offline: false, unauthorized: false, pushed };
}

/** Substitute any local ids in an op with their confirmed server ids. */
function remap(op: OutboxOp, idMap: Record<string, string>): OutboxOp {
  if (op.kind === "createTransaction") {
    const accountId = idMap[op.input.accountId] ?? op.input.accountId;
    return { ...op, input: { ...op.input, accountId } };
  }
  if (op.kind === "updateTransaction") {
    return { ...op, id: idMap[op.id] ?? op.id };
  }
  return op;
}

async function applyOp(op: OutboxOp, idMap: Record<string, string>): Promise<void> {
  const store = useStore.getState();
  if (op.kind === "createAccount") {
    const server = await api.createAccount(op.input);
    idMap[op.localId] = server.id;
    store._replaceLocalAccount(op.localId, server);
  } else if (op.kind === "createTransaction") {
    const server = await api.createTransaction(op.input);
    idMap[op.localId] = server.id;
    store._replaceLocalTransaction(op.localId, server);
  } else if (op.kind === "updateTransaction") {
    // An update to a row that never got a server id (create failed & was dropped)
    // has nothing to target — skip silently.
    if (op.id.startsWith("local-")) return;
    const server = await api.updateTransaction(op.id, op.patch);
    store._applyServerTransaction(server);
  }
}

async function pullDelta(): Promise<{ offline: boolean; unauthorized: boolean; pulled: number }> {
  const store = useStore.getState();
  try {
    const res = await api.sync(store.cursor);
    for (const acc of res.accounts) store._applyServerAccount(acc);
    for (const txn of res.transactions) store._applyServerTransaction(txn);
    store._set({ householdId: res.householdId, cursor: res.cursor, lastSyncAt: Date.now() });
    await store.persist();
    return { offline: false, unauthorized: false, pulled: res.accounts.length + res.transactions.length };
  } catch (err) {
    if (err instanceof ApiError && err.status === 401) {
      return { offline: false, unauthorized: true, pulled: 0 };
    }
    return { offline: isNetworkError(err), unauthorized: false, pulled: 0 };
  }
}

/** Run one full sync cycle (push then pull). Safe to call concurrently. */
export async function syncOnce(): Promise<SyncOutcome> {
  if (running) return { ok: false, offline: false, unauthorized: false, pushed: 0, pulled: 0 };
  running = true;
  useStore.getState()._set({ status: "syncing" });
  try {
    const push = await flushOutbox();
    if (push.unauthorized) {
      useStore.getState()._set({ status: "error", lastError: "Session expired" });
      return { ok: false, offline: false, unauthorized: true, pushed: push.pushed, pulled: 0 };
    }
    if (push.offline) {
      useStore.getState()._set({ status: "offline" });
      return { ok: false, offline: true, unauthorized: false, pushed: push.pushed, pulled: 0 };
    }

    const pull = await pullDelta();
    if (pull.unauthorized) {
      useStore.getState()._set({ status: "error", lastError: "Session expired" });
      return { ok: false, offline: false, unauthorized: true, pushed: push.pushed, pulled: 0 };
    }
    if (pull.offline) {
      useStore.getState()._set({ status: "offline" });
      return { ok: false, offline: true, unauthorized: false, pushed: push.pushed, pulled: 0 };
    }

    useStore.getState()._set({ status: "idle", lastError: null });
    return {
      ok: true,
      offline: false,
      unauthorized: false,
      pushed: push.pushed,
      pulled: pull.pulled,
    };
  } finally {
    running = false;
  }
}

/** Start the background loop (idempotent). Returns a stop function. */
export function startSyncLoop(intervalMs = 15000): () => void {
  void syncOnce();
  if (!timer) timer = setInterval(() => void syncOnce(), intervalMs);
  return stopSyncLoop;
}

export function stopSyncLoop(): void {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
}
