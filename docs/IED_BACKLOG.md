# IED Meeting Backlog — 2026-09

Work requested by BITAC IED. Each item records **what was decided**, not just a title —
the decisions are the part that gets lost. Open questions are marked ❓ and block that item.

Status: `DONE` already works · `SPEC'D` decided, not built · `OPEN` needs an answer first.

---

## 1. Gate Pass Out against a Gate Pass In — `SPEC'D`

Something gated **in** to IED usually goes back out. Today there is no way to raise the
Out pass for the items that came in.

- From a Gate Pass In → **create a Gate Pass Out** carrying its items.
- **Partial**: one In can produce several Outs (10 in → 6 out today, 4 later).
- Issuing the Out **records the return** — it updates the In pass's `returned_qty` and its
  `partially_returned` / `completed` status. One physical event, one record.
- **In → Out only.** The reverse (Out → In) is not wanted yet.

> Why it isn't just the existing Return feature: `gate_pass_returns` records *how much went
> back* with a note, but produces no document — no GOUT number, nothing to print, nothing for
> the customer's representative to sign. IED needs the paper.

## 2. Gate In reaching PCD — mostly `DONE`

After a Gate In, IED passes the job to PCD at work-order time.

- **Already works**: `PcdInboxController` loads `rfq.gatePasses.items`, PCD Job Detail renders
  a Gate Passes card, and IED → PCD work-order forwarding exists (Work Order Inbox → Accept).
- ⚠️ **Known gap**: a gate pass with **no RFQ** never reaches PCD, because PCD pulls passes
  through the RFQ (`rfq->gatePasses`). A pass raised against just a customer/party is invisible
  there. Not yet decided whether to close this.

## 3. Cost estimate without an RFQ — `DONE`

Already works today, end to end. Entry point: **Cost Estimates → New Estimate** (no RFQ).
`cost_estimates.rfq_id` / `rfq_item_id` / `customer_id` are all nullable; `company_name`
carries a walk-in party. Verified: form opens, saves, Show renders, PDF renders, and
Use as Quotation carries it into a direct quotation.

A bug found while confirming this **has been fixed** (commit `cd5b193`): a standalone estimate
could never be linked to the quotation made from it, so it kept offering "Use as Quotation"
forever. It now adopts the quotation's backing RFQ.

## 4. Customer Type + Sector — `OPEN`

Reports must be groupable by customer type **and** by sector.

- **Customer Type**: Government Entity · Private Organizations.
- **Sector applies to both types** (not government-only).
- Sectors become **master data** (Admin → Master Data), following the `job_categories` shape
  (name, code, display_order, is_active) so BITAC can maintain the list themselves.
- Proposed: **one Sectors list**, each sector tagged government / private / both, so choosing
  the type filters the sector dropdown.

❓ **Blocked on:**
- One shared sector list with a type tag, or two separate lists?
- The actual sector names. Government so far: Power, BCIC, BSFIC, Defense — the full list was
  in a photo that never arrived. Private list also needed.
- The 15 existing customers will be blank and fall under "Unspecified" until filled in.

## 5. Target vs Achievement — `SPEC'D`

- **In taka, per centre, per financial year.**
- **Target**: the centre admin sets their own centre's figure. One figure per year.
- **Achievement**: the value of work orders — the amount comes from the quotation linked to
  the work order (`work_orders.quotation_id` → `quotations.total_amount`). If the quotation was
  revised, the linked version's amount is the one that counts (v2's ৪ লাখ, not v1's ৫ লাখ).
- **Which financial year a work order falls in** is decided by the customer's real work-order
  date. ⚠️ That field does not exist yet — `work_orders` has `customer_po_no` but no PO date,
  only `created_at`. **A work-order date field must be added.**

### ⚠️ The financial year is not fixed — it changes

| Financial year | Period |
|---|---|
| up to 2026–27 | 1 July – 30 June |
| **2027–28** | **nine months only** — July 2027 – March 2028 |
| 2028–29 onward | 1 April – 31 March |

Build a `FinancialYear` helper that knows these three rules. Do **not** hardcode a July–June
pair anywhere. The 2028 change is a cabinet decision, not yet law, so it must stay easy to amend.

## 6. Work order accept — approval chain — `SPEC'D`

Today the accept step is barely guarded: the route carries only `permission:view rfqs`, and
nothing stops the creator accepting their own. So whoever issues the work order from the
approved quotation can immediately accept it themselves.

- Accept becomes a **full approval chain, the same shape as quotations** — levels, per-step
  remarks and signature, forwarding.
- **A separate chain from the quotation one.** The quotation already passed through its
  approvers; repeating the same people on the work order is the same signature twice. Today
  the work-order chain is a single level: Anis.
- Full approval → the work order moves to PCD (what Accept does now). A rejection at any level
  sends it back with a reason.

## 7. Approval chains are not centre-aware — `SPEC'D`

Found while specifying item 6.

| | |
|---|---|
| `quotation_approval_settings` | no `center_id` |
| `gate_pass_approvers` | no `center_id` |
| both models | no CenterScope |
| `ApprovalChainController` | no centre filter anywhere |

And **cost estimates share the quotation chain** — `CostEstimateController::buildApprovalChain()`
reads `QuotationApprovalSetting` directly. So one global chain serves quotations *and* cost
estimates across all six centres. The empty-chain fallback,
`User::role('management')->take(2)`, ignores centre too.

Nothing is broken today because only **one centre is active** (BITAC Dhaka) and the chain holds
a single row. It breaks the day a second centre goes live: Dhaka's approvers would approve
Chittagong's quotations, and one centre's admin editing the chain would change it for everyone.

- **Decision: chains are separate per centre.** No shared head-office steps.
- Add `center_id` to the approver config tables and filter by centre when building a chain.
- Cheap to migrate now (one row, one centre); expensive once six centres hold data.

## 8. PCD → Notes (no pad, legal) + Envelope printing — `SPEC'D`

### Notes
A second letter-like module, for **internal** notes.

- New menu **PCD → Notes**, built like RFQ Letters (direct issue, no approval, selectable
  signatory — assumed from "letter er motoi", not explicitly confirmed).
- **No pad at all** — plain paper, no letterhead, no logos, no footer rule.
- **Legal, 8.5″ × 14″.**

> ⚠️ Every PDF today goes through `BitacLetterhead`, which always sets a header/footer and is
> fixed to A4. Notes need a **separate render path**: same fonts and body conventions, no
> letterhead, legal page size.

### Envelope
Print the envelope with **To** and **From**.

- **Several sizes to choose from** (needs the real list — standard candidates: 9″×4″,
  10″×4.5″ for letters; 10″×12″, 12″×16″ for documents).
- **Both entry points are wanted:**
  - from inside a letter/note — a "Print Envelope" button, To filled from the recipient block,
    From from the centre's address;
  - a standalone page — type any address and print an envelope on its own.
- Applies to IED letters as well as PCD notes.

---

## Still to be discussed

From the same meeting notes, not yet worked through:

- **Letter duplicate** — duplicate an existing letter.
- **Stakeholder ↔ Customer link** — `stakeholders` has free-text `organization`, no customer FK.
- **IED Reports** — client list · jobs by type/sector (item 4) · target vs achievement (item 5)
  · total quotation value this financial year · jobs in pipeline. All new; the four existing
  reports (Production, OEE, Rejection, Lead Time) are production-side only.
- **Word-like drafting in IED.**
- **PCD → Outsourcing** — work given to a third party: who, what, note.
- **Delivery Orders reaching PCD** with the challan.
- **Billing & Accounts** (rename of Delivery & Billing) — bill/invoice · **মূসক ৬.৩** ·
  VAT & tax calculator · delivery challan generated from PCD · bill forwarding letter.
  The three that travel together: forwarding letter + bill + musak challan.
