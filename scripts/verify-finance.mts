/**
 * Dependency-free verification of the finance aggregation math (budgets,
 * reports, bill scheduling). Mirrors `verify-metrics.mts`:
 *
 *   node --experimental-strip-types scripts/verify-finance.mts
 * On Node >= 23.6: `node scripts/verify-finance.mts`.
 *
 * Imports only `aggregate.ts`, which has no runtime dependencies, so this checks
 * the spent-vs-limit / grouping / due-date logic without the Next.js/Postgres
 * stack installed.
 */
import {
  billView,
  budgetProgress,
  monthKey,
  monthRange,
  reportByAssignee,
  reportByCategory,
  reportByContributor,
  reportByTime,
  type BillLike,
  type BudgetLike,
  type TxnLike,
} from "../src/lib/finance/aggregate.ts";

let failures = 0;
function assert(cond: boolean, msg: string) {
  if (!cond) {
    failures++;
    console.error("  ✗ " + msg);
  } else {
    console.log("  ✓ " + msg);
  }
}

function d(iso: string): Date {
  return new Date(iso);
}

// --- Fixture: one month of household spend, two authors, one assignee --------
// amounts are signed minor units: negative = spend, positive = income.
const txns: TxnLike[] = [
  { amount: -5000, category: "Groceries", authorId: "u1", assignedTo: null, occurredAt: d("2026-08-03T10:00:00Z") },
  { amount: -2500, category: "Groceries", authorId: "u2", assignedTo: null, occurredAt: d("2026-08-10T10:00:00Z") },
  { amount: -8000, category: "Dining", authorId: "u1", assignedTo: "Car 1", occurredAt: d("2026-08-12T10:00:00Z") },
  { amount: 300000, category: "Income", authorId: "u2", assignedTo: null, occurredAt: d("2026-08-01T10:00:00Z") },
  // Out-of-month txn that must NOT count toward August budgets.
  { amount: -9999, category: "Groceries", authorId: "u1", assignedTo: null, occurredAt: d("2026-07-30T10:00:00Z") },
];

console.log("monthKey / monthRange");
assert(monthKey(d("2026-08-12T10:00:00Z")) === "2026-08", "monthKey UTC bucket");
const range = monthRange("2026-08");
assert(
  range.from.toISOString() === "2026-08-01T00:00:00.000Z" &&
    range.to.toISOString() === "2026-09-01T00:00:00.000Z",
  "monthRange is half-open [from, to)"
);

console.log("budgetProgress");
const budgets: BudgetLike[] = [
  { id: "b1", category: "Groceries", limitAmount: 10000, currency: "USD", period: null }, // recurring
  { id: "b2", category: "Dining", limitAmount: 5000, currency: "USD", period: "2026-08" }, // fixed month
  { id: "b3", category: "Travel", limitAmount: 20000, currency: "USD", period: "2026-09" }, // other month
];
// For the report we pass only August txns (route pre-filters by monthRange).
const augTxns = txns.filter((t) => monthKey(t.occurredAt) === "2026-08");
const progress = budgetProgress(budgets, augTxns, "2026-08");
const groceries = progress.find((p) => p.category === "Groceries")!;
const dining = progress.find((p) => p.category === "Dining")!;
assert(progress.length === 2, "September-only budget excluded from August");
assert(groceries.spent === 7500, "Groceries spend sums only in-month outflows");
assert(groceries.remaining === 2500, "Groceries remaining = limit - spent");
assert(!groceries.overBudget, "Groceries under budget");
assert(dining.spent === 8000 && dining.overBudget, "Dining over budget flagged");
assert(Math.abs(dining.ratio - 1.6) < 1e-9, "Dining ratio computed");

console.log("reports");
const byCat = reportByCategory(augTxns);
const cg = byCat.find((g) => g.key === "Groceries")!;
assert(cg.outflow === 7500 && cg.inflow === 0 && cg.count === 2, "byCategory outflow/count");
const income = byCat.find((g) => g.key === "Income")!;
assert(income.inflow === 300000 && income.net === 300000, "byCategory inflow/net");

const byContrib = reportByContributor(augTxns);
const u1 = byContrib.find((g) => g.key === "u1")!;
assert(u1.outflow === 13000 && u1.count === 2, "byContributor attributes to author");

const byAssignee = reportByAssignee(augTxns);
assert(byAssignee.find((g) => g.key === "Car 1")!.outflow === 8000, "byAssignee object dimension");
assert(!!byAssignee.find((g) => g.key === "Unassigned"), "byAssignee buckets nulls");

const byMonth = reportByTime(txns, "month");
assert(
  byMonth[0].key === "2026-07" && byMonth[byMonth.length - 1].key === "2026-08",
  "byTime month buckets are chronological"
);

console.log("billView");
const now = d("2026-08-15T12:00:00Z");
const overdue: BillLike = { amount: 10000, paidAmount: 0, dueDate: d("2026-08-10T00:00:00Z"), reminderLeadDays: 3 };
assert(billView(overdue, now).status === "overdue", "past-due unpaid bill is overdue");
assert(billView(overdue, now).outstanding === 10000, "overdue outstanding = full amount");
const dueSoon: BillLike = { amount: 10000, paidAmount: 0, dueDate: d("2026-08-17T00:00:00Z"), reminderLeadDays: 3 };
assert(billView(dueSoon, now).status === "due_soon", "within lead window is due_soon");
const upcoming: BillLike = { amount: 10000, paidAmount: 0, dueDate: d("2026-09-01T00:00:00Z"), reminderLeadDays: 3 };
assert(billView(upcoming, now).status === "upcoming", "far-future bill is upcoming");
const paid: BillLike = { amount: 10000, paidAmount: 10000, dueDate: d("2026-08-20T00:00:00Z"), reminderLeadDays: 3 };
assert(billView(paid, now).status === "paid", "fully-paid bill is paid");
const partial: BillLike = { amount: 10000, paidAmount: 4000, dueDate: d("2026-08-09T00:00:00Z"), reminderLeadDays: 3 };
assert(billView(partial, now).outstanding === 6000, "partial payment leaves outstanding balance");
assert(
  billView(dueSoon, now).remindAt.toISOString() === "2026-08-14T00:00:00.000Z",
  "remindAt = dueDate - leadDays"
);

console.log("");
if (failures > 0) {
  console.error(`FAIL — ${failures} assertion(s) failed`);
  process.exit(1);
}
console.log("PASS — finance aggregation math verified");
