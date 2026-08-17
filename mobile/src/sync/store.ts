import { create } from "zustand";
import type {
  Account,
  Bill,
  Budget,
  CreateAccountInput,
  CreateTransactionInput,
  Transaction,
  UpdateTransactionInput,
} from "@/api/types";
import {
  emptySnapshot,
  loadSnapshot,
  saveSnapshot,
  clearSnapshot,
  type OutboxOp,
  type Snapshot,
} from "./db";

/**
 * Offline-first data store. Every mutation writes to local state AND the durable
 * outbox synchronously, so the UI is instant and nothing is lost if the app is
 * killed before the network flush. The sync engine (engine.ts) drains the outbox
 * and folds server deltas back in.
 */

let seq = 0;
export function localId(prefix: string): string {
  seq += 1;
  return `local-${prefix}-${Date.now().toString(36)}-${seq}-${Math.floor(
    Math.random() * 1e6
  ).toString(36)}`;
}

export function isLocalId(id: string): boolean {
  return id.startsWith("local-");
}

export type SyncStatus = "idle" | "syncing" | "offline" | "error";

interface StoreState extends Snapshot {
  hydrated: boolean;
  status: SyncStatus;
  lastSyncAt: number | null;
  lastError: string | null;

  hydrate: () => Promise<void>;
  reset: () => Promise<void>;
  persist: () => Promise<void>;

  // local mutations (optimistic)
  addAccount: (input: CreateAccountInput, authorId: string) => Account;
  addTransaction: (input: CreateTransactionInput, authorId: string) => Transaction;
  editTransaction: (id: string, patch: UpdateTransactionInput) => void;

  // engine hooks
  _set: (partial: Partial<StoreState>) => void;
  _replaceLocalAccount: (localId: string, server: Account) => void;
  _replaceLocalTransaction: (localId: string, server: Transaction) => void;
  _applyServerAccount: (acc: Account) => void;
  _applyServerTransaction: (txn: Transaction) => void;
  _applyServerBudget: (budget: Budget) => void;
  _applyServerBill: (bill: Bill) => void;
  _setOutbox: (outbox: OutboxOp[]) => void;
}

function nowIso() {
  return new Date().toISOString();
}

export const useStore = create<StoreState>((set, get) => ({
  ...emptySnapshot(),
  hydrated: false,
  status: "idle",
  lastSyncAt: null,
  lastError: null,

  hydrate: async () => {
    const snap = await loadSnapshot();
    set({ ...snap, hydrated: true });
  },

  reset: async () => {
    await clearSnapshot();
    set({ ...emptySnapshot(), lastSyncAt: null, lastError: null, status: "idle" });
  },

  persist: async () => {
    const { cursor, householdId, accounts, transactions, budgets, bills, outbox } =
      get();
    await saveSnapshot({
      cursor,
      householdId,
      accounts,
      transactions,
      budgets,
      bills,
      outbox,
    });
  },

  addAccount: (input, authorId) => {
    const id = localId("acct");
    const iso = nowIso();
    const account: Account = {
      id,
      householdId: get().householdId ?? "local",
      authorId,
      name: input.name,
      type: input.type ?? "checking",
      currency: input.currency ?? "USD",
      openingBalance: input.openingBalance ?? 0,
      createdAt: iso,
      updatedAt: iso,
      deletedAt: null,
    };
    set((s) => ({
      accounts: { ...s.accounts, [id]: account },
      outbox: [...s.outbox, { kind: "createAccount", localId: id, input }],
    }));
    void get().persist();
    return account;
  },

  addTransaction: (input, authorId) => {
    const id = localId("txn");
    const iso = nowIso();
    const txn: Transaction = {
      id,
      householdId: get().householdId ?? "local",
      accountId: input.accountId,
      authorId,
      amount: input.amount,
      currency: input.currency ?? "USD",
      payee: input.payee ?? null,
      category: input.category ?? null,
      note: input.note ?? null,
      status: input.status ?? "uncleared",
      kind: input.kind ?? "expense",
      assignedTo: input.assignedTo ?? null,
      iouPerson: input.iouPerson ?? null,
      iouDirection: input.iouDirection ?? null,
      iouSettled: null,
      occurredAt: input.occurredAt ?? iso,
      createdAt: iso,
      updatedAt: iso,
      deletedAt: null,
    };
    set((s) => ({
      transactions: { ...s.transactions, [id]: txn },
      outbox: [...s.outbox, { kind: "createTransaction", localId: id, input }],
    }));
    void get().persist();
    return txn;
  },

  editTransaction: (id, patch) => {
    const cur = get().transactions[id];
    if (!cur) return;
    const next: Transaction = {
      ...cur,
      amount: patch.amount ?? cur.amount,
      payee: patch.payee === undefined ? cur.payee : patch.payee,
      category: patch.category === undefined ? cur.category : patch.category,
      note: patch.note === undefined ? cur.note : patch.note,
      status: patch.status ?? cur.status,
      assignedTo: patch.assignedTo === undefined ? cur.assignedTo : patch.assignedTo,
      iouSettled:
        patch.settleIou === undefined
          ? cur.iouSettled
          : patch.settleIou
            ? nowIso()
            : null,
      deletedAt:
        patch.deleted === undefined ? cur.deletedAt : patch.deleted ? nowIso() : null,
      occurredAt: patch.occurredAt ?? cur.occurredAt,
      updatedAt: nowIso(),
    };
    set((s) => ({
      transactions: { ...s.transactions, [id]: next },
      // Coalesce consecutive edits to the same id into one outbox op.
      outbox: mergeUpdate(s.outbox, id, patch),
    }));
    void get().persist();
  },

  _set: (partial) => set(partial),

  _replaceLocalAccount: (lid, server) =>
    set((s) => {
      const accounts = { ...s.accounts };
      delete accounts[lid];
      accounts[server.id] = server;
      return { accounts };
    }),

  _replaceLocalTransaction: (lid, server) =>
    set((s) => {
      const transactions = { ...s.transactions };
      delete transactions[lid];
      transactions[server.id] = server;
      return { transactions };
    }),

  _applyServerAccount: (acc) =>
    set((s) => {
      const cur = s.accounts[acc.id];
      // Last-write-wins by updatedAt; never resurrect a locally-newer edit.
      if (cur && Date.parse(cur.updatedAt) > Date.parse(acc.updatedAt)) return {};
      return { accounts: { ...s.accounts, [acc.id]: acc } };
    }),

  _applyServerTransaction: (txn) =>
    set((s) => {
      const cur = s.transactions[txn.id];
      if (cur && Date.parse(cur.updatedAt) > Date.parse(txn.updatedAt)) return {};
      return { transactions: { ...s.transactions, [txn.id]: txn } };
    }),

  _applyServerBudget: (budget) =>
    set((s) => {
      const cur = s.budgets[budget.id];
      if (cur && Date.parse(cur.updatedAt) > Date.parse(budget.updatedAt)) return {};
      return { budgets: { ...s.budgets, [budget.id]: budget } };
    }),

  _applyServerBill: (bill) =>
    set((s) => {
      const cur = s.bills[bill.id];
      if (cur && Date.parse(cur.updatedAt) > Date.parse(bill.updatedAt)) return {};
      return { bills: { ...s.bills, [bill.id]: bill } };
    }),

  _setOutbox: (outbox) => set({ outbox }),
}));

/** Fold a new patch into any pending updateTransaction op for the same id. */
function mergeUpdate(
  outbox: OutboxOp[],
  id: string,
  patch: UpdateTransactionInput
): OutboxOp[] {
  const idx = outbox.findIndex(
    (o) => o.kind === "updateTransaction" && o.id === id
  );
  if (idx === -1)
    return [...outbox, { kind: "updateTransaction", id, patch }];
  const next = [...outbox];
  const existing = next[idx] as Extract<OutboxOp, { kind: "updateTransaction" }>;
  next[idx] = { kind: "updateTransaction", id, patch: { ...existing.patch, ...patch } };
  return next;
}

// --- Selectors (pure; call with useStore(...) or on getState()) ---

export function selectAccounts(s: StoreState): Account[] {
  return Object.values(s.accounts)
    .filter((a) => !a.deletedAt)
    .sort((a, b) => a.name.localeCompare(b.name));
}

export function selectTransactions(s: StoreState): Transaction[] {
  return Object.values(s.transactions)
    .filter((t) => !t.deletedAt)
    .sort((a, b) => Date.parse(b.occurredAt) - Date.parse(a.occurredAt));
}

export function selectBudgets(s: StoreState): Budget[] {
  return Object.values(s.budgets)
    .filter((b) => !b.deletedAt)
    .sort((a, b) => a.category.localeCompare(b.category));
}

export function selectBills(s: StoreState): Bill[] {
  return Object.values(s.bills)
    .filter((b) => !b.deletedAt)
    .sort((a, b) => Date.parse(a.dueDate) - Date.parse(b.dueDate));
}

/** Derived account balance = opening + sum of non-deleted txns on that account. */
export function accountBalance(s: StoreState, accountId: string): number {
  const acc = s.accounts[accountId];
  if (!acc) return 0;
  let bal = acc.openingBalance;
  for (const t of Object.values(s.transactions)) {
    if (t.accountId === accountId && !t.deletedAt) bal += t.amount;
  }
  return bal;
}

export function pendingCount(s: StoreState): number {
  return s.outbox.length;
}
