import { randomBytes } from "node:crypto";
import { and, asc, desc, eq, gt, gte, isNull, lt } from "drizzle-orm";
import { hasDatabase } from "@/lib/env";
import { getDb } from "./index";
import {
  accounts,
  bills,
  budgets,
  households,
  householdInvites,
  householdMembers,
  transactions,
  type Account,
  type Bill,
  type Budget,
  type Household,
  type HouseholdInvite,
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

export interface CreateBudgetInput {
  householdId: string;
  authorId: string;
  category: string;
  limitAmount: number; // minor units
  currency?: string;
  period?: string | null; // "YYYY-MM" or null = recurring every month
}

export interface UpdateBudgetPatch {
  category?: string;
  limitAmount?: number;
  currency?: string;
  period?: string | null;
}

export interface CreateBillInput {
  householdId: string;
  authorId: string;
  name: string;
  amount: number; // minor units
  currency?: string;
  dueDate: Date;
  recurrence?: string;
  reminderLeadDays?: number;
}

export interface UpdateBillPatch {
  name?: string;
  amount?: number;
  currency?: string;
  dueDate?: Date;
  recurrence?: string;
  reminderLeadDays?: number;
}

export interface CreateInviteInput {
  householdId: string;
  invitedBy: string;
  email?: string | null;
  role?: string;
  ttlMs?: number; // defaults to 7 days
}

/** A single delta-sync page: rows changed after the caller's cursor. */
export interface SyncDelta {
  cursor: number; // pass back as `since` on the next pull
  accounts: Account[];
  transactions: Transaction[];
  budgets: Budget[];
  bills: Bill[];
}

export interface FinanceRepo {
  /** The user's household, creating a default one + owner membership if none. */
  getOrCreateHousehold(userId: string): Promise<Household>;
  listMemberIds(householdId: string): Promise<string[]>;
  isMember(householdId: string, userId: string): Promise<boolean>;
  /** Add a user to a household (idempotent). Returns false if already a member. */
  addMember(
    householdId: string,
    userId: string,
    role?: string
  ): Promise<boolean>;

  listAccounts(householdId: string): Promise<Account[]>;
  createAccount(input: CreateAccountInput): Promise<Account>;

  listTransactions(
    householdId: string,
    opts?: { limit?: number; from?: Date; to?: Date }
  ): Promise<Transaction[]>;
  createTransaction(input: CreateTransactionInput): Promise<Transaction>;
  /** Returns the updated row, or null if it isn't in this household. */
  updateTransaction(
    householdId: string,
    id: string,
    patch: UpdateTransactionPatch
  ): Promise<Transaction | null>;

  // --- Budgets ---
  listBudgets(householdId: string): Promise<Budget[]>;
  createBudget(input: CreateBudgetInput): Promise<Budget>;
  updateBudget(
    householdId: string,
    id: string,
    patch: UpdateBudgetPatch
  ): Promise<Budget | null>;
  deleteBudget(householdId: string, id: string): Promise<boolean>;

  // --- Bills ---
  listBills(householdId: string): Promise<Bill[]>;
  createBill(input: CreateBillInput): Promise<Bill>;
  updateBill(
    householdId: string,
    id: string,
    patch: UpdateBillPatch
  ): Promise<Bill | null>;
  /**
   * Record a payment of `amount` minor units against a bill. When it fully
   * covers a recurring bill, the due date rolls forward and the paid tally
   * resets so the next occurrence surfaces in the upcoming view. Returns null
   * if the bill isn't in this household.
   */
  payBill(
    householdId: string,
    id: string,
    amount: number
  ): Promise<Bill | null>;
  deleteBill(householdId: string, id: string): Promise<boolean>;

  // --- Household invites (multi-user join flow) ---
  createInvite(input: CreateInviteInput): Promise<HouseholdInvite>;
  listInvites(householdId: string): Promise<HouseholdInvite[]>;
  getInviteByToken(token: string): Promise<HouseholdInvite | null>;
  /**
   * Redeem an invite: validate it, add the user as a member, mark it consumed.
   * Returns the joined household, or an error code the route maps to a status.
   */
  acceptInvite(
    token: string,
    userId: string
  ): Promise<
    | { ok: true; household: Household }
    | {
        ok: false;
        error: "not_found" | "expired" | "already_used" | "already_member";
      }
  >;

  /** Everything (incl. tombstones) changed strictly after `since` (epoch ms). */
  changesSince(householdId: string, since: number): Promise<SyncDelta>;
}

/** Advance a due date to the next occurrence of a recurring bill. */
export function nextDueDate(due: Date, recurrence: string): Date {
  const d = new Date(due);
  switch (recurrence) {
    case "weekly":
      d.setDate(d.getDate() + 7);
      break;
    case "monthly":
      d.setMonth(d.getMonth() + 1);
      break;
    case "yearly":
      d.setFullYear(d.getFullYear() + 1);
      break;
    default:
      break; // "none" — no roll-forward
  }
  return d;
}

/**
 * Apply a payment of `amount` minor units to a bill, returning the next row.
 * Once the tally covers the full amount: a recurring bill rolls to its next
 * occurrence with a reset tally (so it reappears in the upcoming view), while a
 * one-off bill is stamped paid. Shared by both repo implementations so the
 * partial/full/recurring semantics stay identical.
 */
export function applyBillPayment(bill: Bill, amount: number): Bill {
  const now = new Date();
  const paidAmount = bill.paidAmount + Math.max(0, amount);
  const fullyPaid = paidAmount >= bill.amount;
  if (fullyPaid && bill.recurrence !== "none") {
    return {
      ...bill,
      paidAmount: 0,
      paidAt: null,
      dueDate: nextDueDate(bill.dueDate, bill.recurrence),
      updatedAt: now,
    };
  }
  return {
    ...bill,
    paidAmount,
    paidAt: fullyPaid ? now : bill.paidAt ?? now,
    updatedAt: now,
  };
}

function randomId() {
  return "mem-" + Math.random().toString(36).slice(2) + Date.now().toString(36);
}

/** URL-safe single-use invite secret. */
function inviteToken() {
  return randomBytes(24).toString("base64url");
}

const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

// --- In-memory implementation (dev / no DATABASE_URL) ---

const memHouseholds = new Map<string, Household>();
const memMembers: Array<{ householdId: string; userId: string; role: string }> =
  [];
const memAccounts = new Map<string, Account>();
const memTransactions = new Map<string, Transaction>();
const memBudgets = new Map<string, Budget>();
const memBills = new Map<string, Bill>();
const memInvites = new Map<string, HouseholdInvite>();

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
  async isMember(householdId, userId) {
    return memMembers.some(
      (m) => m.householdId === householdId && m.userId === userId
    );
  },
  async addMember(householdId, userId, role) {
    if (
      memMembers.some(
        (m) => m.householdId === householdId && m.userId === userId
      )
    ) {
      return false;
    }
    memMembers.push({ householdId, userId, role: role ?? "member" });
    return true;
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
    const from = opts?.from?.getTime();
    const to = opts?.to?.getTime();
    const rows = [...memTransactions.values()]
      .filter((t) => {
        if (t.householdId !== householdId || t.deletedAt) return false;
        const at = t.occurredAt.getTime();
        if (from !== undefined && at < from) return false;
        if (to !== undefined && at >= to) return false;
        return true;
      })
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
  async listBudgets(householdId) {
    return [...memBudgets.values()]
      .filter((b) => b.householdId === householdId && !b.deletedAt)
      .sort((a, b) => a.category.localeCompare(b.category));
  },
  async createBudget(input) {
    const now = new Date();
    const budget: Budget = {
      id: randomId(),
      householdId: input.householdId,
      authorId: input.authorId,
      category: input.category,
      limitAmount: input.limitAmount,
      currency: input.currency ?? "USD",
      period: input.period ?? null,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    };
    memBudgets.set(budget.id, budget);
    return budget;
  },
  async updateBudget(householdId, id, patch) {
    const cur = memBudgets.get(id);
    if (!cur || cur.householdId !== householdId || cur.deletedAt) return null;
    const next: Budget = {
      ...cur,
      category: patch.category ?? cur.category,
      limitAmount: patch.limitAmount ?? cur.limitAmount,
      currency: patch.currency ?? cur.currency,
      period: patch.period === undefined ? cur.period : patch.period,
      updatedAt: new Date(),
    };
    memBudgets.set(id, next);
    return next;
  },
  async deleteBudget(householdId, id) {
    const cur = memBudgets.get(id);
    if (!cur || cur.householdId !== householdId || cur.deletedAt) return false;
    memBudgets.set(id, { ...cur, deletedAt: new Date(), updatedAt: new Date() });
    return true;
  },
  async listBills(householdId) {
    return [...memBills.values()]
      .filter((b) => b.householdId === householdId && !b.deletedAt)
      .sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime());
  },
  async createBill(input) {
    const now = new Date();
    const bill: Bill = {
      id: randomId(),
      householdId: input.householdId,
      authorId: input.authorId,
      name: input.name,
      amount: input.amount,
      currency: input.currency ?? "USD",
      dueDate: input.dueDate,
      recurrence: input.recurrence ?? "monthly",
      reminderLeadDays: input.reminderLeadDays ?? 3,
      paidAmount: 0,
      paidAt: null,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    };
    memBills.set(bill.id, bill);
    return bill;
  },
  async updateBill(householdId, id, patch) {
    const cur = memBills.get(id);
    if (!cur || cur.householdId !== householdId || cur.deletedAt) return null;
    const next: Bill = {
      ...cur,
      name: patch.name ?? cur.name,
      amount: patch.amount ?? cur.amount,
      currency: patch.currency ?? cur.currency,
      dueDate: patch.dueDate ?? cur.dueDate,
      recurrence: patch.recurrence ?? cur.recurrence,
      reminderLeadDays: patch.reminderLeadDays ?? cur.reminderLeadDays,
      updatedAt: new Date(),
    };
    memBills.set(id, next);
    return next;
  },
  async payBill(householdId, id, amount) {
    const cur = memBills.get(id);
    if (!cur || cur.householdId !== householdId || cur.deletedAt) return null;
    memBills.set(id, applyBillPayment(cur, amount));
    return memBills.get(id)!;
  },
  async deleteBill(householdId, id) {
    const cur = memBills.get(id);
    if (!cur || cur.householdId !== householdId || cur.deletedAt) return false;
    memBills.set(id, { ...cur, deletedAt: new Date(), updatedAt: new Date() });
    return true;
  },
  async createInvite(input) {
    const now = new Date();
    const invite: HouseholdInvite = {
      id: randomId(),
      householdId: input.householdId,
      invitedBy: input.invitedBy,
      token: inviteToken(),
      email: input.email ?? null,
      role: input.role ?? "member",
      expiresAt: new Date(now.getTime() + (input.ttlMs ?? INVITE_TTL_MS)),
      acceptedAt: null,
      acceptedBy: null,
      createdAt: now,
    };
    memInvites.set(invite.token, invite);
    return invite;
  },
  async listInvites(householdId) {
    return [...memInvites.values()]
      .filter((i) => i.householdId === householdId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  },
  async getInviteByToken(token) {
    return memInvites.get(token) ?? null;
  },
  async acceptInvite(token, userId) {
    const invite = memInvites.get(token);
    if (!invite) return { ok: false, error: "not_found" };
    if (invite.acceptedAt) return { ok: false, error: "already_used" };
    if (invite.expiresAt.getTime() < Date.now())
      return { ok: false, error: "expired" };
    if (await this.isMember(invite.householdId, userId))
      return { ok: false, error: "already_member" };
    memMembers.push({
      householdId: invite.householdId,
      userId,
      role: invite.role,
    });
    memInvites.set(token, {
      ...invite,
      acceptedAt: new Date(),
      acceptedBy: userId,
    });
    return { ok: true, household: memHouseholds.get(invite.householdId)! };
  },
  async changesSince(householdId, since) {
    const acc = [...memAccounts.values()].filter(
      (a) => a.householdId === householdId && a.updatedAt.getTime() > since
    );
    const txn = [...memTransactions.values()].filter(
      (t) => t.householdId === householdId && t.updatedAt.getTime() > since
    );
    const bud = [...memBudgets.values()].filter(
      (b) => b.householdId === householdId && b.updatedAt.getTime() > since
    );
    const bil = [...memBills.values()].filter(
      (b) => b.householdId === householdId && b.updatedAt.getTime() > since
    );
    const cursor = Math.max(
      since,
      ...acc.map((a) => a.updatedAt.getTime()),
      ...txn.map((t) => t.updatedAt.getTime()),
      ...bud.map((b) => b.updatedAt.getTime()),
      ...bil.map((b) => b.updatedAt.getTime())
    );
    return { cursor, accounts: acc, transactions: txn, budgets: bud, bills: bil };
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
  async isMember(householdId, userId) {
    const rows = await getDb()
      .select({ id: householdMembers.id })
      .from(householdMembers)
      .where(
        and(
          eq(householdMembers.householdId, householdId),
          eq(householdMembers.userId, userId)
        )
      )
      .limit(1);
    return rows.length > 0;
  },
  async addMember(householdId, userId, role) {
    if (await this.isMember(householdId, userId)) return false;
    await getDb()
      .insert(householdMembers)
      .values({ householdId, userId, role: role ?? "member" });
    return true;
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
    const conds = [
      eq(transactions.householdId, householdId),
      isNull(transactions.deletedAt),
    ];
    if (opts?.from) conds.push(gte(transactions.occurredAt, opts.from));
    if (opts?.to) conds.push(lt(transactions.occurredAt, opts.to));
    const q = getDb()
      .select()
      .from(transactions)
      .where(and(...conds))
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
  async listBudgets(householdId) {
    return getDb()
      .select()
      .from(budgets)
      .where(
        and(eq(budgets.householdId, householdId), isNull(budgets.deletedAt))
      )
      .orderBy(asc(budgets.category));
  },
  async createBudget(input) {
    const rows = await getDb()
      .insert(budgets)
      .values({
        householdId: input.householdId,
        authorId: input.authorId,
        category: input.category,
        limitAmount: input.limitAmount,
        currency: input.currency ?? "USD",
        period: input.period ?? null,
      })
      .returning();
    return rows[0];
  },
  async updateBudget(householdId, id, patch) {
    const set: Record<string, unknown> = { updatedAt: new Date() };
    for (const k of ["category", "limitAmount", "currency", "period"] as const) {
      if (patch[k] !== undefined) set[k] = patch[k];
    }
    const rows = await getDb()
      .update(budgets)
      .set(set)
      .where(
        and(
          eq(budgets.id, id),
          eq(budgets.householdId, householdId),
          isNull(budgets.deletedAt)
        )
      )
      .returning();
    return rows[0] ?? null;
  },
  async deleteBudget(householdId, id) {
    const rows = await getDb()
      .update(budgets)
      .set({ deletedAt: new Date(), updatedAt: new Date() })
      .where(
        and(
          eq(budgets.id, id),
          eq(budgets.householdId, householdId),
          isNull(budgets.deletedAt)
        )
      )
      .returning();
    return rows.length > 0;
  },
  async listBills(householdId) {
    return getDb()
      .select()
      .from(bills)
      .where(and(eq(bills.householdId, householdId), isNull(bills.deletedAt)))
      .orderBy(asc(bills.dueDate));
  },
  async createBill(input) {
    const rows = await getDb()
      .insert(bills)
      .values({
        householdId: input.householdId,
        authorId: input.authorId,
        name: input.name,
        amount: input.amount,
        currency: input.currency ?? "USD",
        dueDate: input.dueDate,
        recurrence: input.recurrence ?? "monthly",
        reminderLeadDays: input.reminderLeadDays ?? 3,
      })
      .returning();
    return rows[0];
  },
  async updateBill(householdId, id, patch) {
    const set: Record<string, unknown> = { updatedAt: new Date() };
    for (const k of [
      "name",
      "amount",
      "currency",
      "dueDate",
      "recurrence",
      "reminderLeadDays",
    ] as const) {
      if (patch[k] !== undefined) set[k] = patch[k];
    }
    const rows = await getDb()
      .update(bills)
      .set(set)
      .where(
        and(
          eq(bills.id, id),
          eq(bills.householdId, householdId),
          isNull(bills.deletedAt)
        )
      )
      .returning();
    return rows[0] ?? null;
  },
  async payBill(householdId, id, amount) {
    const cur = await getDb()
      .select()
      .from(bills)
      .where(
        and(
          eq(bills.id, id),
          eq(bills.householdId, householdId),
          isNull(bills.deletedAt)
        )
      )
      .limit(1);
    if (!cur[0]) return null;
    const next = applyBillPayment(cur[0], amount);
    const rows = await getDb()
      .update(bills)
      .set({
        paidAmount: next.paidAmount,
        paidAt: next.paidAt,
        dueDate: next.dueDate,
        updatedAt: next.updatedAt,
      })
      .where(and(eq(bills.id, id), eq(bills.householdId, householdId)))
      .returning();
    return rows[0] ?? null;
  },
  async deleteBill(householdId, id) {
    const rows = await getDb()
      .update(bills)
      .set({ deletedAt: new Date(), updatedAt: new Date() })
      .where(
        and(
          eq(bills.id, id),
          eq(bills.householdId, householdId),
          isNull(bills.deletedAt)
        )
      )
      .returning();
    return rows.length > 0;
  },
  async createInvite(input) {
    const rows = await getDb()
      .insert(householdInvites)
      .values({
        householdId: input.householdId,
        invitedBy: input.invitedBy,
        token: inviteToken(),
        email: input.email ?? null,
        role: input.role ?? "member",
        expiresAt: new Date(Date.now() + (input.ttlMs ?? INVITE_TTL_MS)),
      })
      .returning();
    return rows[0];
  },
  async listInvites(householdId) {
    return getDb()
      .select()
      .from(householdInvites)
      .where(eq(householdInvites.householdId, householdId))
      .orderBy(desc(householdInvites.createdAt));
  },
  async getInviteByToken(token) {
    const rows = await getDb()
      .select()
      .from(householdInvites)
      .where(eq(householdInvites.token, token))
      .limit(1);
    return rows[0] ?? null;
  },
  async acceptInvite(token, userId) {
    const invite = await this.getInviteByToken(token);
    if (!invite) return { ok: false, error: "not_found" };
    if (invite.acceptedAt) return { ok: false, error: "already_used" };
    if (invite.expiresAt.getTime() < Date.now())
      return { ok: false, error: "expired" };
    if (await this.isMember(invite.householdId, userId))
      return { ok: false, error: "already_member" };

    // Consume the token atomically: only succeeds if still unaccepted, so two
    // concurrent redemptions can't both add a member.
    const claimed = await getDb()
      .update(householdInvites)
      .set({ acceptedAt: new Date(), acceptedBy: userId })
      .where(
        and(
          eq(householdInvites.id, invite.id),
          isNull(householdInvites.acceptedAt)
        )
      )
      .returning();
    if (!claimed[0]) return { ok: false, error: "already_used" };

    await this.addMember(invite.householdId, userId, invite.role);
    const rows = await getDb()
      .select()
      .from(households)
      .where(eq(households.id, invite.householdId))
      .limit(1);
    return { ok: true, household: rows[0] };
  },
  async changesSince(householdId, since) {
    const sinceDate = new Date(since);
    const [acc, txn, bud, bil] = await Promise.all([
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
      getDb()
        .select()
        .from(budgets)
        .where(
          and(
            eq(budgets.householdId, householdId),
            gt(budgets.updatedAt, sinceDate)
          )
        ),
      getDb()
        .select()
        .from(bills)
        .where(
          and(eq(bills.householdId, householdId), gt(bills.updatedAt, sinceDate))
        ),
    ]);
    const cursor = Math.max(
      since,
      ...acc.map((a) => a.updatedAt.getTime()),
      ...txn.map((t) => t.updatedAt.getTime()),
      ...bud.map((b) => b.updatedAt.getTime()),
      ...bil.map((b) => b.updatedAt.getTime())
    );
    return { cursor, accounts: acc, transactions: txn, budgets: bud, bills: bil };
  },
};

export const financeRepo: FinanceRepo = hasDatabase
  ? postgresRepo
  : inMemoryRepo;
