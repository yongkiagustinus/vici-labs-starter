import {
  bigint,
  index,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

/**
 * Expense & Bill Tracker — v0 data model (see VIC-6 locked scope).
 *
 * Design notes that make this the sync backbone for the mobile client:
 * - Every household-scoped row carries `householdId` (sharing boundary),
 *   `authorId` (who added it — per-record attribution, wishlist #2),
 *   `updatedAt` and a soft-delete `deletedAt`. The delta-sync endpoint pulls
 *   everything changed after a cursor, including tombstones, so clients can
 *   reconcile offline edits without ever losing data (the wedge, wishlist #1).
 * - Money is stored in integer **minor units** (cents) to avoid float drift —
 *   the "trust the numbers" story PE6 fails at. Currency is per-transaction
 *   (full multi-currency, lever locked).
 */

/** A shared budgeting space (a person or a household of partners/spouses). */
export const households = pgTable("households", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: varchar("name", { length: 200 }).notNull().default("My Household"),
  ownerId: uuid("owner_id").notNull(),
  baseCurrency: varchar("base_currency", { length: 3 }).notNull().default("USD"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

/** Membership join — multi-user households with a role. */
export const householdMembers = pgTable(
  "household_members",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    householdId: uuid("household_id").notNull(),
    userId: uuid("user_id").notNull(),
    role: varchar("role", { length: 16 }).notNull().default("member"), // owner | member
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    byHousehold: index("hm_household_idx").on(t.householdId),
    byUser: index("hm_user_idx").on(t.userId),
  })
);

/** Financial accounts (checking, cash, card…). Balances are derived from txns. */
export const accounts = pgTable(
  "accounts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    householdId: uuid("household_id").notNull(),
    authorId: uuid("author_id").notNull(),
    name: varchar("name", { length: 200 }).notNull(),
    type: varchar("type", { length: 24 }).notNull().default("checking"),
    currency: varchar("currency", { length: 3 }).notNull().default("USD"),
    // Optional user-set opening balance in minor units.
    openingBalance: bigint("opening_balance", { mode: "number" })
      .notNull()
      .default(0),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (t) => ({
    byHousehold: index("acct_household_idx").on(t.householdId),
    bySync: index("acct_sync_idx").on(t.householdId, t.updatedAt),
  })
);

/**
 * Transactions — the heart of the product.
 *
 * `status` is the founder's reconciliation model (v0 core):
 *   uncleared → cleared → reconciled.
 * `kind` distinguishes plain spend/income from receivables (IOU, wishlist #5).
 * `assignedTo` is the light object/person dimension (wishlist #3).
 */
export const transactions = pgTable(
  "transactions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    householdId: uuid("household_id").notNull(),
    accountId: uuid("account_id").notNull(),
    // Who added this record (per-record attribution, wishlist #2).
    authorId: uuid("author_id").notNull(),

    // Signed minor units: negative = money out, positive = money in.
    amount: bigint("amount", { mode: "number" }).notNull(),
    currency: varchar("currency", { length: 3 }).notNull().default("USD"),

    payee: varchar("payee", { length: 200 }),
    category: varchar("category", { length: 100 }),
    note: text("note"),

    // Reconciliation status (v0 core differentiator).
    status: varchar("status", { length: 16 }).notNull().default("uncleared"), // uncleared | cleared | reconciled
    // expense | income | transfer | iou
    kind: varchar("kind", { length: 16 }).notNull().default("expense"),

    // Object/person assignment (light dimension): free-text label, e.g. "Car 1".
    assignedTo: varchar("assigned_to", { length: 120 }),

    // Receivables / IOU (wishlist #5): counterparty + direction.
    iouPerson: varchar("iou_person", { length: 200 }),
    iouDirection: varchar("iou_direction", { length: 12 }), // lent | borrowed
    iouSettled: timestamp("iou_settled", { withTimezone: true }),

    occurredAt: timestamp("occurred_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (t) => ({
    byHousehold: index("txn_household_idx").on(t.householdId),
    byAccount: index("txn_account_idx").on(t.accountId),
    // Powers delta sync: "everything in this household changed since cursor".
    bySync: index("txn_sync_idx").on(t.householdId, t.updatedAt),
  })
);

/** Per-category monthly budgets (parity baseline). */
export const budgets = pgTable(
  "budgets",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    householdId: uuid("household_id").notNull(),
    authorId: uuid("author_id").notNull(),
    category: varchar("category", { length: 100 }).notNull(),
    // Monthly limit in minor units.
    limitAmount: bigint("limit_amount", { mode: "number" }).notNull(),
    currency: varchar("currency", { length: 3 }).notNull().default("USD"),
    // "YYYY-MM" the budget applies to (null = recurring every month).
    period: varchar("period", { length: 7 }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (t) => ({
    byHousehold: index("budget_household_idx").on(t.householdId),
  })
);

/** Recurring bills & reminders (parity baseline). */
export const bills = pgTable(
  "bills",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    householdId: uuid("household_id").notNull(),
    authorId: uuid("author_id").notNull(),
    name: varchar("name", { length: 200 }).notNull(),
    amount: bigint("amount", { mode: "number" }).notNull(),
    currency: varchar("currency", { length: 3 }).notNull().default("USD"),
    dueDate: timestamp("due_date", { withTimezone: true }).notNull(),
    // none | weekly | monthly | yearly
    recurrence: varchar("recurrence", { length: 16 }).notNull().default("monthly"),
    reminderLeadDays: bigint("reminder_lead_days", { mode: "number" })
      .notNull()
      .default(3),
    paidAt: timestamp("paid_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (t) => ({
    byHousehold: index("bill_household_idx").on(t.householdId),
  })
);

/** Landing-page waitlist / early-access capture (pre-store launch funnel). */
export const waitlist = pgTable("waitlist", {
  id: uuid("id").defaultRandom().primaryKey(),
  email: varchar("email", { length: 320 }).notNull().unique(),
  platform: varchar("platform", { length: 16 }), // ios | android | any
  source: varchar("source", { length: 80 }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// We keep app-level referential integrity (no hard FKs) to match the template's
// zero-infra, in-memory-friendly style; `authorId`/`userId` reference `users.id`.

export type Household = typeof households.$inferSelect;
export type NewHousehold = typeof households.$inferInsert;
export type HouseholdMember = typeof householdMembers.$inferSelect;
export type Account = typeof accounts.$inferSelect;
export type NewAccount = typeof accounts.$inferInsert;
export type Transaction = typeof transactions.$inferSelect;
export type NewTransaction = typeof transactions.$inferInsert;
export type Budget = typeof budgets.$inferSelect;
export type Bill = typeof bills.$inferSelect;
export type WaitlistEntry = typeof waitlist.$inferSelect;

export const TRANSACTION_STATUSES = [
  "uncleared",
  "cleared",
  "reconciled",
] as const;
export type TransactionStatus = (typeof TRANSACTION_STATUSES)[number];

export const TRANSACTION_KINDS = [
  "expense",
  "income",
  "transfer",
  "iou",
] as const;
export type TransactionKind = (typeof TRANSACTION_KINDS)[number];
