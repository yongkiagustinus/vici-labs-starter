/**
 * Pure aggregation helpers for the finance surface — budget progress and the
 * reports API. Kept free of any runtime dependency (no Drizzle, no Next) so the
 * math can be unit-smoke-tested with plain Node, exactly like
 * `observability/aggregate.ts`. Routes fetch rows via `financeRepo` and pipe
 * them through these functions.
 *
 * Money is signed minor units: negative = outflow (spend), positive = inflow.
 */

/** The minimal transaction shape these aggregations read. */
export interface TxnLike {
  amount: number;
  category?: string | null;
  authorId: string;
  assignedTo?: string | null;
  occurredAt: Date;
}

/** The minimal budget shape budget-progress reads. */
export interface BudgetLike {
  id: string;
  category: string;
  limitAmount: number;
  currency: string;
  period: string | null; // "YYYY-MM" or null = recurring
}

/** UTC "YYYY-MM" bucket for a date. */
export function monthKey(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

/** Half-open [from, to) UTC bounds for a "YYYY-MM" period. */
export function monthRange(period: string): { from: Date; to: Date } {
  const [y, m] = period.split("-").map(Number);
  const from = new Date(Date.UTC(y, m - 1, 1));
  const to = new Date(Date.UTC(y, m, 1));
  return { from, to };
}

/** UTC "YYYY-MM-DD" bucket for a date. */
export function dayKey(d: Date): string {
  return `${monthKey(d)}-${String(d.getUTCDate()).padStart(2, "0")}`;
}

/** UTC ISO week bucket "YYYY-Www" (Monday-based). */
export function weekKey(d: Date): string {
  // Copy to a UTC date at midnight.
  const date = new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())
  );
  // ISO: Thursday determines the year; day number 1..7 with Monday = 1.
  const dayNr = (date.getUTCDay() + 6) % 7;
  date.setUTCDate(date.getUTCDate() - dayNr + 3);
  const firstThursday = new Date(Date.UTC(date.getUTCFullYear(), 0, 4));
  const week =
    1 +
    Math.round(
      ((date.getTime() - firstThursday.getTime()) / 86_400_000 -
        3 +
        ((firstThursday.getUTCDay() + 6) % 7)) /
        7
    );
  return `${date.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

/** Outflow (spend) magnitude of a txn in minor units — 0 for inflows. */
function spend(amount: number): number {
  return amount < 0 ? -amount : 0;
}

export interface BudgetProgress {
  budgetId: string;
  category: string;
  period: string; // the month this progress is computed for
  limitAmount: number;
  spent: number; // minor units of outflow in that category+month
  remaining: number; // limit - spent (may go negative when overspent)
  ratio: number; // spent / limit (0 when limit is 0)
  overBudget: boolean;
  currency: string;
}

/**
 * Compute spent-vs-limit for each budget in a given month. A budget applies to
 * `period` when its own period equals that month, or when it's null (recurring
 * every month). Spend is summed over expense outflows in the matching category
 * whose `occurredAt` falls in the month.
 */
export function budgetProgress(
  budgetList: BudgetLike[],
  txns: TxnLike[],
  period: string
): BudgetProgress[] {
  const spentByCategory = new Map<string, number>();
  for (const t of txns) {
    if (monthKey(t.occurredAt) !== period) continue;
    const cat = t.category ?? "Uncategorized";
    spentByCategory.set(cat, (spentByCategory.get(cat) ?? 0) + spend(t.amount));
  }
  return budgetList
    .filter((b) => b.period === null || b.period === period)
    .map((b) => {
      const spent = spentByCategory.get(b.category) ?? 0;
      const ratio = b.limitAmount > 0 ? spent / b.limitAmount : 0;
      return {
        budgetId: b.id,
        category: b.category,
        period,
        limitAmount: b.limitAmount,
        spent,
        remaining: b.limitAmount - spent,
        ratio,
        overBudget: spent > b.limitAmount,
        currency: b.currency,
      };
    });
}

export interface GroupTotal {
  key: string;
  inflow: number; // sum of positive amounts
  outflow: number; // magnitude of negative amounts
  net: number; // inflow - outflow (== sum of signed amounts)
  count: number;
}

function groupBy(txns: TxnLike[], keyOf: (t: TxnLike) => string): GroupTotal[] {
  const map = new Map<string, GroupTotal>();
  for (const t of txns) {
    const key = keyOf(t);
    const g =
      map.get(key) ?? { key, inflow: 0, outflow: 0, net: 0, count: 0 };
    if (t.amount >= 0) g.inflow += t.amount;
    else g.outflow += -t.amount;
    g.net += t.amount;
    g.count += 1;
    map.set(key, g);
  }
  // Largest outflow first — the most useful default for a spend report.
  return [...map.values()].sort((a, b) => b.outflow - a.outflow);
}

/** Spend/income grouped by category. */
export function reportByCategory(txns: TxnLike[]): GroupTotal[] {
  return groupBy(txns, (t) => t.category ?? "Uncategorized");
}

/** Spend/income grouped into day/week/month time buckets. */
export function reportByTime(
  txns: TxnLike[],
  bucket: "day" | "week" | "month"
): GroupTotal[] {
  const keyOf =
    bucket === "day" ? dayKey : bucket === "week" ? weekKey : monthKey;
  // Chronological for a time series.
  return groupBy(txns, (t) => keyOf(t.occurredAt)).sort((a, b) =>
    a.key < b.key ? -1 : a.key > b.key ? 1 : 0
  );
}

/** Spend/income grouped by contributor (who authored the record). */
export function reportByContributor(txns: TxnLike[]): GroupTotal[] {
  return groupBy(txns, (t) => t.authorId);
}

/** Spend/income grouped by the object/person `assignedTo` dimension. */
export function reportByAssignee(txns: TxnLike[]): GroupTotal[] {
  return groupBy(txns, (t) => t.assignedTo ?? "Unassigned");
}

/** The minimal bill shape the bill view reads. */
export interface BillLike {
  amount: number;
  paidAmount: number;
  dueDate: Date;
  reminderLeadDays: number;
}

export type BillStatus = "paid" | "overdue" | "due_soon" | "upcoming";

export interface BillView {
  status: BillStatus;
  outstanding: number; // amount - paidAmount (0 when settled)
  /** When the client should fire a local reminder push (dueDate - lead days). */
  remindAt: Date;
  daysUntilDue: number; // negative when overdue
}

const DAY_MS = 86_400_000;

/**
 * Derive a bill's schedule view relative to `now`: settlement status, amount
 * still outstanding, and the reminder timestamp the mobile client uses to
 * schedule a local push. Recurring bills reset their paid tally on roll-forward,
 * so a fully-paid recurring bill never lingers as "paid" — its next occurrence
 * shows as upcoming instead.
 */
export function billView(bill: BillLike, now: Date): BillView {
  const outstanding = Math.max(0, bill.amount - bill.paidAmount);
  const remindAt = new Date(
    bill.dueDate.getTime() - bill.reminderLeadDays * DAY_MS
  );
  const daysUntilDue = Math.floor(
    (bill.dueDate.getTime() - now.getTime()) / DAY_MS
  );
  let status: BillStatus;
  if (outstanding <= 0) status = "paid";
  else if (bill.dueDate.getTime() < now.getTime()) status = "overdue";
  else if (remindAt.getTime() <= now.getTime()) status = "due_soon";
  else status = "upcoming";
  return { status, outstanding, remindAt, daysUntilDue };
}
