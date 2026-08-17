/**
 * End-to-end API smoke for the VIC-11 backend surface, in the same spirit as
 * the PR #1 smoke (signup → household → account → txn → reconcile → sync).
 *
 * Drives a RUNNING dev server (in-memory mode, zero infra) over HTTP:
 *   pnpm dev &                       # or: pnpm build && pnpm start
 *   node scripts/smoke-finance.mts   # BASE_URL overrides http://localhost:3000
 *
 * Covers: budgets CRUD + computed spent-vs-limit, bills CRUD + partial/full
 * pay + upcoming/overdue view, reports (category/time/contributor/assignee),
 * subscription entitlement (stub receipt verify), household invite + partner
 * join, and 401s when unauthenticated.
 */
const BASE = process.env.BASE_URL ?? "http://localhost:3000";

let failures = 0;
function check(cond: boolean, msg: string) {
  if (!cond) {
    failures++;
    console.error("  ✗ " + msg);
  } else {
    console.log("  ✓ " + msg);
  }
}

/** A tiny cookie jar so each "user" keeps their own session. */
class Session {
  private cookie = "";
  async req(method: string, path: string, body?: unknown) {
    const res = await fetch(BASE + path, {
      method,
      headers: {
        "content-type": "application/json",
        ...(this.cookie ? { cookie: this.cookie } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      redirect: "manual",
    });
    const setCookie = res.headers.get("set-cookie");
    if (setCookie) {
      const first = setCookie.split(";")[0];
      this.cookie = this.cookie
        ? mergeCookie(this.cookie, first)
        : first;
    }
    const text = await res.text();
    let json: any = null;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      json = text;
    }
    return { status: res.status, json };
  }
}

function mergeCookie(jar: string, next: string) {
  const name = next.split("=")[0];
  const kept = jar
    .split("; ")
    .filter((c) => c.split("=")[0] !== name)
    .join("; ");
  return kept ? `${kept}; ${next}` : next;
}

function uniqEmail(tag: string) {
  // Deterministic-enough per run without Date.now in a strip-types file being
  // an issue; process.pid + counter keeps collisions away across the run.
  return `smoke_${tag}_${process.pid}_${counter++}@example.com`;
}
let counter = 0;

async function main() {
  console.log(`finance smoke → ${BASE}`);

  // --- unauthenticated guard ------------------------------------------------
  const anon = new Session();
  check((await anon.req("GET", "/api/finance/budgets")).status === 401, "budgets 401 when unauthenticated");
  check((await anon.req("GET", "/api/finance/bills")).status === 401, "bills 401 when unauthenticated");
  check((await anon.req("GET", "/api/finance/reports")).status === 401, "reports 401 when unauthenticated");
  check((await anon.req("GET", "/api/billing/entitlement")).status === 401, "entitlement 401 when unauthenticated");

  // --- owner signs up -------------------------------------------------------
  const owner = new Session();
  const signup = await owner.req("POST", "/api/auth/signup", {
    email: uniqEmail("owner"),
    password: "password123",
    name: "Owner",
  });
  check(signup.status === 200 && signup.json?.ok, "owner signup");
  const ownerId: string = signup.json.user.id;

  // Account to hang transactions off of.
  const acct = await owner.req("POST", "/api/finance/accounts", { name: "Checking" });
  check(acct.status === 201, "account created");
  const accountId: string = acct.json.account.id;

  // --- budgets --------------------------------------------------------------
  const budget = await owner.req("POST", "/api/finance/budgets", {
    category: "Groceries",
    limitAmount: 10000,
  });
  check(budget.status === 201, "budget created");
  const budgetId: string = budget.json.budget.id;

  // Two grocery expenses this month → 7500 spent.
  await owner.req("POST", "/api/finance/transactions", {
    accountId,
    amount: -5000,
    category: "Groceries",
    assignedTo: "Car 1",
  });
  await owner.req("POST", "/api/finance/transactions", {
    accountId,
    amount: -2500,
    category: "Groceries",
  });
  await owner.req("POST", "/api/finance/transactions", {
    accountId,
    amount: 300000,
    category: "Income",
    kind: "income",
  });

  const budgets = await owner.req("GET", "/api/finance/budgets");
  const prog = budgets.json.progress.find((p: any) => p.budgetId === budgetId);
  check(prog?.spent === 7500, `budget spent computed (got ${prog?.spent})`);
  check(prog?.remaining === 2500, "budget remaining computed");
  check(prog?.overBudget === false, "budget not over limit");

  const budgetPatch = await owner.req("PATCH", `/api/finance/budgets/${budgetId}`, { limitAmount: 5000 });
  check(budgetPatch.status === 200 && budgetPatch.json.budget.limitAmount === 5000, "budget updated");

  // --- bills ----------------------------------------------------------------
  const pastDue = new Date(Date.now() - 5 * 86_400_000).toISOString();
  const bill = await owner.req("POST", "/api/finance/bills", {
    name: "Electric",
    amount: 12000,
    dueDate: pastDue,
    recurrence: "monthly",
  });
  check(bill.status === 201, "bill created");
  const billId: string = bill.json.bill.id;
  check(bill.json.bill.schedule.status === "overdue", "past-due bill is overdue");

  // Partial payment leaves it outstanding.
  const partial = await owner.req("PATCH", `/api/finance/bills/${billId}`, { payAmount: 5000 });
  check(partial.json.bill.schedule.outstanding === 7000, "partial payment leaves 7000 outstanding");

  // Full payment of a recurring bill rolls the due date forward + resets tally.
  const full = await owner.req("PATCH", `/api/finance/bills/${billId}`, { payFull: true });
  check(full.json.bill.paidAmount === 0, "recurring bill resets paid tally on full pay");
  check(new Date(full.json.bill.dueDate).getTime() > new Date(pastDue).getTime(), "recurring bill rolls due date forward");

  const overdueView = await owner.req("GET", "/api/finance/bills?view=overdue");
  check(Array.isArray(overdueView.json.bills), "bills overdue view returns list");

  // --- reports --------------------------------------------------------------
  const byCat = await owner.req("GET", "/api/finance/reports?groupBy=category");
  const groceries = byCat.json.groups.find((g: any) => g.key === "Groceries");
  check(groceries?.outflow === 7500, "report byCategory groceries outflow");
  const byContrib = await owner.req("GET", "/api/finance/reports?groupBy=contributor");
  check(byContrib.json.groups.some((g: any) => g.key === ownerId), "report byContributor attributes to author");
  const byAssignee = await owner.req("GET", "/api/finance/reports?groupBy=assignee");
  check(byAssignee.json.groups.some((g: any) => g.key === "Car 1"), "report byAssignee object dimension");
  const byTime = await owner.req("GET", "/api/finance/reports?groupBy=time&bucket=month");
  check(byTime.json.groupBy === "time" && byTime.json.bucket === "month", "report byTime month bucket");

  // --- subscription entitlement --------------------------------------------
  const before = await owner.req("GET", "/api/billing/entitlement");
  check(before.json.entitlement.entitled === false, "entitlement starts locked (free)");
  const verify = await owner.req("POST", "/api/billing/entitlement", {
    platform: "ios",
    receipt: "stub-receipt-abc",
  });
  check(verify.status === 200 && verify.json.entitlement.entitled === true, "stub receipt verify unlocks entitlement");
  const after = await owner.req("GET", "/api/billing/entitlement");
  check(after.json.entitlement.entitled === true, "entitlement persists after verify");
  const badVerify = await owner.req("POST", "/api/billing/entitlement", { platform: "ios", receipt: "" });
  check(badVerify.status === 400, "empty receipt rejected");

  // --- household invite + partner join -------------------------------------
  const invite = await owner.req("POST", "/api/finance/household/invite", { role: "member" });
  check(invite.status === 201 && !!invite.json.invite.token, "invite created with token");
  const token: string = invite.json.invite.token;
  check(typeof invite.json.invite.joinUrl === "string", "invite exposes joinUrl");

  const partner = new Session();
  await partner.req("POST", "/api/auth/signup", {
    email: uniqEmail("partner"),
    password: "password123",
    name: "Partner",
  });
  const join = await partner.req("POST", "/api/finance/household/join", { token });
  check(join.status === 200, "partner joins household");
  check(!!join.json.household?.id, "join returns the shared household");
  check(join.json.memberIds.length === 2, `household now has 2 members (got ${join.json?.memberIds?.length})`);

  // Partner sees the shared data via sync.
  const partnerSync = await partner.req("GET", "/api/finance/sync");
  check(partnerSync.json.transactions.length >= 3, "partner syncs shared transactions");

  // Token is single-use.
  const reuse = await partner.req("POST", "/api/finance/household/join", { token });
  check(reuse.status === 409, "invite token is single-use");

  console.log("");
  if (failures > 0) {
    console.error(`FAIL — ${failures} assertion(s) failed`);
    process.exit(1);
  }
  console.log("PASS — finance backend surface smoke");
}

main().catch((err) => {
  console.error("smoke crashed:", err);
  process.exit(1);
});
