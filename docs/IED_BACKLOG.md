# IED Meeting Backlog — 2026-09

Work requested by BITAC IED. Each item records **what was decided**, not just a title —
the decisions are the part that gets lost. Open questions are marked ❓ and block that item.

Status: `DONE` already works · `SPEC'D` decided, not built · `OPEN` needs an answer first.

---

## 1. Gate Pass Out against a Gate Pass In — `DONE`

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

**Built.** `{ied|pcd}/gate-passes/{pass}/out` opens the normal form, locked to `out` and
pre-filled with what is outstanding. Quantities are capped server-side as well as in the form.
The Out pass books the return itself — as ordinary `gate_pass_returns` rows, so it behaves
exactly like a hand-recorded one — and only once it is **issued**, which for a PCD pass means
at approval. The booking is idempotent. Show pages link In ↔ Out both ways.

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

## 4. Customer Type + Sector — `DONE`

Reports must be groupable by customer type **and** by sector.

- **Customer Type**: Government Entity · Private Organizations.
- **Sector applies to both types** (not government-only).
- Sectors are **master data the admin creates — nothing hardcoded**. Follows the
  `job_categories` shape (name, code, display_order, is_active) under Admin → Master Data.
- **One Sectors list**, each sector tagged government / private / both, so picking the customer
  type filters the sector dropdown.
- No seed list needed: BITAC enters their own. (Government examples from the meeting: Power,
  BCIC, BSFIC, Defense.)
- The 15 existing customers will be blank and fall under "Unspecified" until filled in.

**Built.** `customers.customer_type` + `customers.sector_id`, a `sectors` master table with an
`applies_to` tag, and Admin → Master Data → **Client Sectors** to maintain it. The customer form
narrows the sector list to the chosen type and clears one that no longer fits. Sectors are
national rather than per centre — otherwise each centre's "Power" would be a different id and
cross-centre sector reports could only group by name. A sector in use deactivates instead of
deleting. This unblocks the reports in items 5 and the IED reports list below.

## 5. Target vs Achievement — `DONE`

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

**Built.** `App\Support\FinancialYear` holds the three rules; every day across five years was
checked to land in exactly one year, with no gap or overlap. `work_orders.customer_wo_date` was
added and sits on the Issue Work Order form. `center_targets` holds one figure per centre per
year. `Reports → Target vs Achievement` shows target, achieved, progress and gap per centre,
and clicking a centre lists the work orders behind the figure with their quotation and version.
Cancelled work orders are excluded; rows with no customer date fall back to the entry date and
are badged as such.

## 6. Work order accept — approval chain — `DONE`

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

**Built.** `work_order_approvals` mirrors `quotation_approvals`;
`quotation_approval_settings.document_type` separates the work-order chain from the quotation
one, with a switcher on Admin → Approval Chain. Only the pending approver may accept or reject,
the handoff to PCD runs only after the last level, and each step is signed. **An empty chain
leaves acceptance exactly as it was** — so deploying this does not freeze the inbox; BITAC turns
the gate on by adding Anis as level 1.

## 7. Approval chains are not centre-aware — `DONE`

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

**Built.** `center_id` on both tables, `HasCenter` on both models, and chain building now
follows the *document's* centre via `QuotationApprovalSetting::forCenter()` rather than the
session's. `GatePassApprover::isApprover()` takes the pass's centre. The global `UNIQUE(level)`
and `UNIQUE(user_id)` became composite — they would have stopped two centres sharing a level or
one officer approving at two centres. Verified against a second test centre.

## 8. PCD → Notes (no pad, legal) + Envelope printing — `SPEC'D`

### Notes
A second letter-like module, for **internal** notes.

- New menu **PCD → Notes**, built like RFQ Letters: **direct issue, no approval**, selectable
  signatory. (Confirmed.)
- **No pad at all** — plain paper, no letterhead, no logos, no footer rule.
- **Legal, 8.5″ × 14″.**

> ⚠️ Every PDF today goes through `BitacLetterhead`, which always sets a header/footer and is
> fixed to A4. Notes need a **separate render path**: same fonts and body conventions, no
> letterhead, legal page size.

### Envelope
Print the envelope with **To** and **From**.

- **Several sizes to choose from.** BITAC will confirm the real ones later; build with these
  provisional entries and make them easy to correct: 9″×4″ and 10″×4.5″ (letters),
  10″×12″ and 12″×16″ (documents).
- **Both entry points are wanted:**
  - from inside a letter/note — a "Print Envelope" button, To filled from the recipient block,
    From from the centre's address;
  - a standalone page — type any address and print an envelope on its own.
- Applies to IED letters as well as PCD notes.

---

## Still to be discussed

From the same meeting notes, not yet worked through:

- ~~**Letter duplicate**~~ — **`DONE`**. Copy icon on the Letters list copies the subject, body, recipient, customer ref and signatory into a fresh draft and opens it. The number, date, status, issue/email stamps and signature are deliberately left for the new letter.
- **Stakeholder ↔ Customer link** — `stakeholders` has free-text `organization`, no customer FK.
- ~~**IED Reports**~~ — **`DONE`**. `IED → Reports`: Client List, By Type & Sector, Quotation
  Value (with conversion and a monthly breakdown), Jobs in Pipeline. Target vs Achievement is
  its own page (item 5). All share the financial-year filter; work-order money and dates use the
  same expressions as `TargetAchievementService` so the reports cannot disagree.
- **Word-like drafting in IED.**
- **PCD → Outsourcing** — work given to a third party: who, what, note.
- **Delivery Orders reaching PCD** with the challan.
- **Billing & Accounts** (rename of Delivery & Billing) — bill/invoice · **মূসক ৬.৩ (spec'd
  below)** ·
  VAT & tax calculator · delivery challan generated from PCD · bill forwarding letter.
  The three that travel together: forwarding letter + bill + musak challan.

---

## 9. মূসক ৬.৩ — কর চালানপত্র — `SPEC'D`

The NBR VAT challan. Transcribed from an original BITAC issued (Kushiara Power Company Ltd,
challan no. 45), so the layout is known and nothing needs guessing.

**Masthead**
- গণপ্রজাতন্ত্রী বাংলাদেশ সরকার, জাতীয় রাজস্ব বোর্ড
- **কর চালানপত্র** · [বিধি ৪০ এর উপ-বিধি (১) এর দফা (গ) ও (চ) দ্রষ্টব্য]
- Top right, boxed: **প্রথম কপি** over **মূসক-৬.৩** (so the copy label is a variable —
  প্রথম / দ্বিতীয় / তৃতীয় কপি).

**Header fields** — left column is the supplier (BITAC) and the buyer; right column the
challan's own identity.

| Field | Source |
|---|---|
| নিবন্ধিত ব্যক্তির নাম | the centre (BITAC) |
| নিবন্ধিত ব্যক্তির বিআইএন | **new** — BITAC's BIN, per centre |
| চালানপত্র ইস্যুর ঠিকানা | the centre's address |
| ক্রেতার নাম | customer |
| ক্রেতার বিআইএন (প্রযোজ্য ক্ষেত্রে) | **new** — customers have no BIN field |
| ক্রেতার ঠিকানা | customer address |
| সরবরাহের গন্তব্যস্থল | **new** — delivery destination, typed |
| যানবাহনের প্রকৃতি ও নম্বর | **new** — vehicle type & number, typed |
| চালানপত্র নম্বর | own running number (the sample is `45`) |
| ইস্যুর তারিখ / ইস্যুর সময় | issue date **and time** |

**The 11 columns**

| # | Column |
|---|---|
| ১ | ক্রমিক নং |
| ২ | পণ্য বা সেবার বর্ণনা (প্রযোজ্য ক্ষেত্রে ব্র্যান্ড নাম সহ) |
| ৩ | সরবরাহের একক |
| ৪ | পরিমাণ |
| ৫ | একক মূল্য (টাকায়) |
| ৬ | মোট মূল্য (টাকায়) |
| ৭ | সম্পূরক শুল্কের হার |
| ৮ | সম্পূরক শুল্কের পরিমাণ (টাকায়) |
| ৯ | মূল্য সংযোজন করহার / সুনির্দিষ্ট কর |
| ১০ | মূল্য সংযোজন কর / সুনির্দিষ্ট কর এর পরিমাণ (টাকায়) |
| ১১ | সকল প্রকার শুল্ক ও করসহ মূল্য |

Footer: **সর্বমোট** row totalling columns ৬, ১০ and ১১ · প্রতিষ্ঠান কর্তৃপক্ষের দায়িত্বপ্রাপ্ত
ব্যক্তির নাম / পদবি / স্বাক্ষর · seal. Bottom-left note: **"সকল প্রকার কর ব্যতীত মূল্য"**.

**The sample's arithmetic** — 290,909 + 10% (29,091) = 320,000. So the round figure is the
**tax-inclusive** one and the base is extracted from it. That matches how quotations already
work here (VAT embedded in the price, extracted for display), so the two reconcile.

⚠️ **Open — where does income tax go?** মূসক ৬.৩ has columns for সম্পূরক শুল্ক and মূসক only;
there is no place for AIT. Our quotations and invoices embed **VAT *and* Tax**
(`base = gross/(1+(vat%+tax%)/100)`). The sample challan shows VAT alone. The normal practice is
that the buyer deducts AIT at source, so it never appears on the challan — **needs confirming**,
because if AIT were included the challan total would not match the invoice.

⚠️ Also note the VAT rate here is **10%**, not the 15% the quotation form defaults to — the rate
must come from the document, not a constant.
