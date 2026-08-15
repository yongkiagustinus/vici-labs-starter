# First Product Niche — Proposal & v0 Scope (VIC-6)

**Owner:** Chief of Staff (CEO) · **Decision needed from:** Founder · **Status:** Awaiting founder pick

## TL;DR

I evaluated three candidate first products against five criteria: **pain sharpness**, **willingness to pay**, **build complexity for a lean v0**, **reachability of the audience**, and **defensibility**. My recommendation is **Candidate 1 — InvoiceNudge** (automated overdue-invoice follow-up for freelancers & small agencies). It has the sharpest pain, the clearest ROI story ("get paid faster literally pays for the tool"), the lowest technical risk, and a reachable B2B audience with recurring revenue — the right shape to prove our launch muscle on product #1.

---

## Evaluation criteria

| # | Criterion | Why it matters for product #1 |
|---|-----------|-------------------------------|
| 1 | Pain sharpness | A narrow, painful, recurring problem sells itself and needs less marketing spend. |
| 2 | Willingness to pay | B2B > prosumer > consumer for early monetization. We want revenue signal fast. |
| 3 | Build complexity (v0) | Lower complexity = faster to launch, cheaper to validate, less to maintain. |
| 4 | Reachability | Can we find and reach the buyer through communities/channels we can access cheaply? |
| 5 | Defensibility | Workflow depth + integrations create switching costs even without deep tech moats. |

---

## Candidate 1 — InvoiceNudge  *(RECOMMENDED)*

**One-liner:** Automated, polite overdue-invoice follow-up for freelancers and small agencies (B2B SaaS).

- **Pain:** Freelancers and small studios hate chasing late payments. It's awkward, manual, and it directly hurts cash flow. Existing full invoicing suites (FreshBooks, Bonsai) are heavy and the dunning is buried; most people still chase by hand.
- **Buyer & willingness to pay:** Freelancers/agencies, **$12–29/mo**. Easy ROI math: recovering one late invoice a month pays for a year of the tool.
- **v0 build complexity:** **Low–medium.** Core is manual/CSV invoice entry (or a Stripe read integration) + scheduled email reminder sequences + a "what's outstanding" dashboard.
- **Reachability:** High — freelancer subreddits, Indie Hackers, freelance Slack/Discord communities, X. Clear, demoable hook.
- **Defensibility:** Reminder templates + payment integrations + payment-behavior data create stickiness over time.

## Candidate 2 — ShiftKit

**One-liner:** Scheduling + client management mobile app for independent fitness/wellness instructors (yoga, Pilates, PT).

- **Pain:** Independent instructors juggle DMs, spreadsheets, and Venmo to run bookings, packages, and payments.
- **Buyer & willingness to pay:** Solo instructors, **$19–39/mo**. Real, but price-sensitive.
- **v0 build complexity:** **Medium–high** — native/mobile app, calendar, package/credit tracking, and payments all needed before it's useful. Long path to a testable v0.
- **Reachability:** Lower — must be won instructor-by-instructor; no single cheap channel.
- **Defensibility:** Good once client history + payments live inside it, but slower to reach that point.

## Candidate 3 — BriefBot

**One-liner:** AI meeting-notes → structured action items + drafted follow-up emails for client-facing consultants (SaaS).

- **Pain:** Consultants burn time writing recaps and follow-ups after calls.
- **Buyer & willingness to pay:** Consultants/agencies, **$15–30/mo**.
- **v0 build complexity:** **Medium** — an LLM wrapper over a transcript, but the value depends on quality and it competes in a crowded, commoditizing space (Otter, Fireflies, plus every note-taking app shipping AI).
- **Reachability:** Broad but noisy/crowded — hard to stand out.
- **Defensibility:** **Weak** — thin wrapper, easily replicated, and incumbents ship this as a feature.

---

## Scorecard

| Criterion | InvoiceNudge | ShiftKit | BriefBot |
|-----------|:---:|:---:|:---:|
| Pain sharpness | High | High | Medium |
| Willingness to pay | High | Medium | Medium |
| Build complexity (lower = better) | Low–Med | High | Medium |
| Reachability | High | Low | Medium |
| Defensibility | Medium | Medium | Low |
| **Overall for product #1** | **Strongest** | Slower/heavier | Crowded/thin |

---

## Recommendation

**Build InvoiceNudge first.** It is the fastest path to a shippable v0, has the cleanest ROI story to a reachable B2B audience, and generates recurring revenue signal quickly with the lowest technical and market risk. ShiftKit is a strong future bet but too heavy for product #1; BriefBot sits in a crowded, low-moat space.

---

## Proposed v0 scope — InvoiceNudge  *(locks on founder approval)*

**Goal:** A freelancer can add their outstanding invoices and have InvoiceNudge automatically send a polite, escalating reminder sequence until the invoice is marked paid — replacing manual chasing.

**In scope (v0):**
1. Auth + single-user account (email/password or magic link).
2. Manual invoice entry: client name, client email, amount, due date, invoice # (no accounting integration yet).
3. Reminder sequences: 3 pre-written, editable templates (gentle → firmer → final) sent on a schedule relative to the due date.
4. Automated scheduled sending via email (transactional email provider).
5. Dashboard: list of invoices with status (Outstanding / Overdue / Paid) and total outstanding.
6. Mark-as-paid to stop the sequence.
7. Basic billing: single paid plan via Stripe Checkout (with a free trial).

**Explicitly out of scope (v0):**
- Accounting/Stripe *invoice* integrations (import) — post-v0.
- SMS reminders, multi-user/teams, client self-serve portal.
- Invoice creation/PDF generation and actual payment collection inside the app.
- Analytics beyond the outstanding total.
- Mobile app.

**v0 success signal:** 10–20 real freelancers onboard their invoices, at least a handful convert to paid, and we see reminders sent and invoices marked paid through the tool.

---

## Decision requested

Please pick one via the question attached to this issue:
- **A — Approve recommendation (InvoiceNudge)** → I lock the v0 scope above and unblock the First MVP task.
- **B — ShiftKit** · **C — BriefBot** → I'll draft a matching v0 scope for your pick.
- **D — None of these** → tell me the direction and I'll re-propose.
