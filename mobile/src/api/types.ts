/**
 * Domain contract shared with the Next.js backend.
 *
 * These mirror `src/lib/db/finance-schema.ts` in the studio template. Money is
 * always integer **minor units** (cents); currency is per-row (full
 * multi-currency). Timestamps arrive from the API as ISO strings; the sync
 * engine keeps them as strings and compares `updatedAt` lexically-safe via
 * Date.parse for last-write-wins.
 *
 * Keep this file in lockstep with the backend schema. When the backend adds a
 * field, add it here so the delta-sync contract stays type-safe end to end.
 */

export const TRANSACTION_STATUSES = ["uncleared", "cleared", "reconciled"] as const;
export type TransactionStatus = (typeof TRANSACTION_STATUSES)[number];

export const TRANSACTION_KINDS = ["expense", "income", "transfer", "iou"] as const;
export type TransactionKind = (typeof TRANSACTION_KINDS)[number];

export type IouDirection = "lent" | "borrowed";

export interface Account {
  id: string;
  householdId: string;
  authorId: string;
  name: string;
  type: string; // checking | savings | cash | credit | investment | other
  currency: string; // ISO 4217
  openingBalance: number; // minor units
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

export interface Transaction {
  id: string;
  householdId: string;
  accountId: string;
  authorId: string;
  amount: number; // signed minor units: negative = out, positive = in
  currency: string;
  payee: string | null;
  category: string | null;
  note: string | null;
  status: TransactionStatus;
  kind: TransactionKind;
  assignedTo: string | null;
  iouPerson: string | null;
  iouDirection: IouDirection | null;
  iouSettled: string | null;
  occurredAt: string;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

export interface Household {
  id: string;
  name: string;
  ownerId: string;
  baseCurrency: string;
  createdAt: string;
  updatedAt: string;
}

/** Response of `GET /api/finance/sync?since=<cursor>`. */
export interface SyncResponse {
  householdId: string;
  memberIds: string[];
  cursor: number;
  accounts: Account[];
  transactions: Transaction[];
  serverTime: number;
}

export interface CreateAccountInput {
  name: string;
  type?: string;
  currency?: string;
  openingBalance?: number;
}

export interface CreateTransactionInput {
  accountId: string;
  amount: number;
  currency?: string;
  payee?: string | null;
  category?: string | null;
  note?: string | null;
  status?: TransactionStatus;
  kind?: TransactionKind;
  assignedTo?: string | null;
  iouPerson?: string | null;
  iouDirection?: IouDirection | null;
  occurredAt?: string;
}

export interface UpdateTransactionInput {
  amount?: number;
  payee?: string | null;
  category?: string | null;
  note?: string | null;
  status?: TransactionStatus;
  assignedTo?: string | null;
  settleIou?: boolean;
  deleted?: boolean;
  occurredAt?: string;
}

export interface SessionUser {
  id: string;
  email: string;
}
