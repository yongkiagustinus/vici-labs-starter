import { and, desc, eq, gt } from "drizzle-orm";
import { hasDatabase } from "@/lib/env";
import { getDb } from "./index";
import {
  accounts,
  households,
  householdMembers,
  transactions,
  type Account,
  type Household,
  type Transaction,
} from "./finance-schema";

/**
 * Finance repository — the sync backbone for the Expense & Bill Tracker.
 *
 * Same shape as `users-repo`: an interface with a Postgres implementation and a
 * zero-infra in-memory fallback, chosen by `hasDatabase`. This keeps `pnpm dev`
 * working with no database while upgrading cleanly to Postgres in production.
 */

export interface CreateAccountInput {
  householdId: string;
  authorId: string;
  name: string;
  type?: string;
  currency?: string;
  openingBalance?: number;
}

export interface CreateTransactionInput {
  householdId: string;
  authorId: string;
  accountId: string;
  amount: number; // signed minor units
  currency?: string;
  payee?: string | null;
  category?: string | null;
  note?: string | null;
  status?: string;
  kind?: string;
  assignedTo?: string | null;
  iouPerson?: string | null;
  iouDirection?: string | null;
  occurredAt?: Date;
}

export interface UpdateTransactionPatch {
  amount?: number;
  payee?: string | null;
  category?: string | null;
  note?: string | null;
  status?: string;
  assignedTo?: string | null;
  iouSettled?: Date | null;
  deletedAt?: Date | null;
  occurredAt?: Date;
}

/** A single delta-sync page: rows changed after the caller's cursor. */
export interface SyncDelta {
  cursor: number; // pass back as `since` on the next pull
  accounts: Account[];
  transactions: Transaction[];
}

export interface FinanceRepo {
  /** The user's household, creating a default one + owner membership if none. */
  getOrCreateHousehold(userId: string): Promise<Household>;
  listMemberIds(householdId: string): Promise<string[]>;

  listAccounts(householdId: string): Promise<Account[]>;
  createAccount(input: CreateAccountInput): Promise<Account>;

  listTransactions(
    householdId: string,
    opts?: { limit?: number }
  ): Promise<Transaction[]>;
  createTransaction(input: CreateTransactionInput): Promise<Transaction>;
  /** Returns the updated row, or null if it isn't in this household. */
  updateTransaction(
    householdId: string,
    id: string,
    patch: UpdateTransactionPatch
  ): Promise<Transaction | null>;

  /** Everything (incl. tombstones) changed strictly after `since` (epoch ms). */
  changesSince(householdId: string, since: number): Promise<SyncDelta>;
}

function randomId() {
  return "mem-" + Math.random().toString(36).slice(2) + Date.now().toString(36);
}

// --- In-memory implementation (dev / no DATABASE_URL) ---

const memHouseholds = new Map<string, Household>();
const memMembers: Array<{ householdId: string; userId: string; role: string }> =
  [];
const memAccounts = new Map<string, Account>();
const memTransactions = new Map<string, Transaction>();

const inMemoryRepo: FinanceRepo = {
  async getOrCreateHousehold(userId) {
    const existing = memMembers.find((m) => m.userId === userId);
    if (existing) return memHouseholds.get(existing.householdId)!;
    const now = new Date();
    const household: Household = {
      id: randomId(),
      name: "My Household",
      ownerId: userId,
      baseCurrency: "USD",
      createdAt: now,
      updatedAt: now,
    };
    memHouseholds.set(household.id, household);
    memMembers.push({ householdId: household.id, userId, role: "owner" });
    return household;
  },
  async listMemberIds(householdId) {
    return memMembers
      .filter((m) => m.householdId === householdId)
      .map((m) => m.userId);
  },
  async listAccounts(householdId) {
    return [...memAccounts.values()]
      .filter((a) => a.householdId === householdId && !a.deletedAt)
      .sort((a, b) => a.name.localeCompare(b.name));
  },
  async createAccount(input) {
    const now = new Date();
    const account: Account = {
      id: randomId(),
      householdId: input.householdId,
      authorId: input.authorId,
      name: input.name,
      type: input.type ?? "checking",
      currency: input.currency ?? "USD",
      openingBalance: input.openingBalance ?? 0,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    };
    memAccounts.set(account.id, account);
    return account;
  },
  async listTransactions(householdId, opts) {
    const rows = [...memTransactions.values()]
      .filter((t) => t.householdId === householdId && !t.deletedAt)
      .sort((a, b) => b.occurredAt.getTime() - a.occurredAt.getTime());
    return opts?.limit ? rows.slice(0, opts.limit) : rows;
  },
  async createTransaction(input) {
    const now = new Date();
    const txn: Transaction = {
      id: randomId(),
      householdId: input.householdId,
      accountId: input.accountId,
      authorId: input.authorId,
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
      occurredAt: input.occurredAt ?? now,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    };
    memTransactions.set(txn.id, txn);
    return txn;
  },
  async updateTransaction(householdId, id, patch) {
    const cur = memTransactions.get(id);
    if (!cur || cur.householdId !== householdId) return null;
    const next: Transaction = {
      ...cur,
      amount: patch.amount ?? cur.amount,
      payee: patch.payee === undefined ? cur.payee : patch.payee,
      category: patch.category === undefined ? cur.category : patch.category,
      note: patch.note === undefined ? cur.note : patch.note,
      status: patch.status ?? cur.status,
      assignedTo:
        patch.assignedTo === undefined ? cur.assignedTo : patch.assignedTo,
      iouSettled:
        patch.iouSettled === undefined ? cur.iouSettled : patch.iouSettled,
      deletedAt: patch.deletedAt === undefined ? cur.deletedAt : patch.deletedAt,
      occurredAt: patch.occurredAt ?? cur.occurredAt,
      updatedAt: new Date(),
    };
    memTransactions.set(id, next);
    return next;
  },
  async changesSince(householdId, since) {
    const acc = [...memAccounts.values()].filter(
      (a) => a.householdId === householdId && a.updatedAt.getTime() > since
    );
    const txn = [...memTransactions.values()].filter(
      (t) => t.householdId === householdId && t.updatedAt.getTime() > since
    );
    const cursor = Math.max(
      since,
      ...acc.map((a) => a.updatedAt.getTime()),
      ...txn.map((t) => t.updatedAt.getTime())
    );
    return { cursor, accounts: acc, transactions: txn };
  },
};

// --- Postgres implementation ---

const postgresRepo: FinanceRepo = {
  async getOrCreateHousehold(userId) {
    const db = getDb();
    const membership = await db
      .select()
      .from(householdMembers)
      .where(eq(householdMembers.userId, userId))
      .limit(1);
    if (membership[0]) {
      const rows = await db
        .select()
        .from(households)
        .where(eq(households.id, membership[0].householdId))
        .limit(1);
      if (rows[0]) return rows[0];
    }
    const created = await db
      .insert(households)
      .values({ ownerId: userId })
      .returning();
    const household = created[0];
    await db
      .insert(householdMembers)
      .values({ householdId: household.id, userId, role: "owner" });
    return household;
  },
  async listMemberIds(householdId) {
    const rows = await getDb()
      .select({ userId: householdMembers.userId })
      .from(householdMembers)
      .where(eq(householdMembers.householdId, householdId));
    return rows.map((r) => r.userId);
  },
  async listAccounts(householdId) {
    return getDb()
      .select()
      .from(accounts)
      .where(eq(accounts.householdId, householdId))
      .orderBy(accounts.name);
  },
  async createAccount(input) {
    const rows = await getDb()
      .insert(accounts)
      .values({
        householdId: input.householdId,
        authorId: input.authorId,
        name: input.name,
        type: input.type ?? "checking",
        currency: input.currency ?? "USD",
        openingBalance: input.openingBalance ?? 0,
      })
      .returning();
    return rows[0];
  },
  async listTransactions(householdId, opts) {
    const q = getDb()
      .select()
      .from(transactions)
      .where(eq(transactions.householdId, householdId))
      .orderBy(desc(transactions.occurredAt));
    return opts?.limit ? q.limit(opts.limit) : q;
  },
  async createTransaction(input) {
    const rows = await getDb()
      .insert(transactions)
      .values({
        householdId: input.householdId,
        accountId: input.accountId,
        authorId: input.authorId,
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
        occurredAt: input.occurredAt ?? new Date(),
      })
      .returning();
    return rows[0];
  },
  async updateTransaction(householdId, id, patch) {
    const set: Record<string, unknown> = { updatedAt: new Date() };
    for (const k of [
      "amount",
      "payee",
      "category",
      "note",
      "status",
      "assignedTo",
      "iouSettled",
      "deletedAt",
      "occurredAt",
    ] as const) {
      if (patch[k] !== undefined) set[k] = patch[k];
    }
    const rows = await getDb()
      .update(transactions)
      .set(set)
      .where(
        and(
          eq(transactions.id, id),
          eq(transactions.householdId, householdId)
        )
      )
      .returning();
    return rows[0] ?? null;
  },
  async changesSince(householdId, since) {
    const sinceDate = new Date(since);
    const [acc, txn] = await Promise.all([
      getDb()
        .select()
        .from(accounts)
        .where(
          and(
            eq(accounts.householdId, householdId),
            gt(accounts.updatedAt, sinceDate)
          )
        ),
      getDb()
        .select()
        .from(transactions)
        .where(
          and(
            eq(transactions.householdId, householdId),
            gt(transactions.updatedAt, sinceDate)
          )
        ),
    ]);
    const cursor = Math.max(
      since,
      ...acc.map((a) => a.updatedAt.getTime()),
      ...txn.map((t) => t.updatedAt.getTime())
    );
    return { cursor, accounts: acc, transactions: txn };
  },
};

export const financeRepo: FinanceRepo = hasDatabase
  ? postgresRepo
  : inMemoryRepo;
