import AsyncStorage from "@react-native-async-storage/async-storage";
import type { Account, Transaction } from "@/api/types";

/**
 * On-device snapshot persistence (offline-first). We keep the full household
 * snapshot plus a durable **outbox** of local mutations that have not yet been
 * confirmed by the server. Everything is JSON in AsyncStorage — small, robust,
 * and enough for v0; a SQLite upgrade is a drop-in behind this module later.
 */

const KEY = "vici.sync.snapshot.v1";

/** A local, not-yet-confirmed mutation. Replayed by the sync engine on connect. */
export type OutboxOp =
  | { kind: "createAccount"; localId: string; input: import("@/api/types").CreateAccountInput }
  | {
      kind: "createTransaction";
      localId: string;
      input: import("@/api/types").CreateTransactionInput;
    }
  | {
      kind: "updateTransaction";
      id: string;
      patch: import("@/api/types").UpdateTransactionInput;
    };

export interface Snapshot {
  cursor: number; // last sync cursor (epoch ms)
  householdId: string | null;
  accounts: Record<string, Account>;
  transactions: Record<string, Transaction>;
  outbox: OutboxOp[];
}

export function emptySnapshot(): Snapshot {
  return { cursor: 0, householdId: null, accounts: {}, transactions: {}, outbox: [] };
}

export async function loadSnapshot(): Promise<Snapshot> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return emptySnapshot();
    return { ...emptySnapshot(), ...(JSON.parse(raw) as Snapshot) };
  } catch {
    return emptySnapshot();
  }
}

export async function saveSnapshot(snap: Snapshot): Promise<void> {
  await AsyncStorage.setItem(KEY, JSON.stringify(snap));
}

export async function clearSnapshot(): Promise<void> {
  await AsyncStorage.removeItem(KEY);
}
