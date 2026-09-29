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

## 8. IED → Notes (no pad, legal) + Envelope printing — `DONE`

### Notes
A second letter-like module, for **internal** notes.

- New menu **IED → Notes** (corrected — first recorded under PCD), built like RFQ Letters: **direct issue, no approval**, selectable
  signatory. (Confirmed.)
- **No pad at all** — plain paper, no letterhead, no logos, no footer rule.
- **Legal, 8.5″ × 14″.**

> ⚠️ Every PDF today goes through `BitacLetterhead`, which always sets a header/footer and is
> fixed to A4. Notes need a **separate render path**: same fonts and body conventions, no
> letterhead, legal page size.

**`DONE`.** `BitacLetterhead::renderPlain()` is that path — same mPDF instance, same Tinos +
Nikosh registration and stylesheet, but no header/footer callback and a caller-supplied page
size, so Bangla shaping and the digit rules come along unchanged. `buildMpdf()` now takes an
`$overrides` array rather than hard-coding A4 and the stretched top margin.

Table `office_notes`, `OfficeNote`, `OfficeNoteController`, `Pages/OfficeNote/{Index,Create}.tsx`,
menu **IED → Notes**. Draft → issue in one form (Save as draft / Issue note), duplicate into a
fresh draft, BN + EN PDF, edit, delete. The signatory is selectable and the `SignaturePicker`
shows **that signatory's** blocks, not the drafter's. Since there is no pad, the sheet names the
office itself: centre name, then **অফিস নোট**, then নং / তারিখ, প্রতি, বিষয় and the body.

Verified by decoding the rendered PDF: **612 × 1008 pt = 8.5″ × 14″**, exactly one picture (the
signature — an alpha PNG's `/SMask` counts as a second image object, so count only images nothing
points at as a mask), Bangla shaped through Nikosh, Bangla digits in the date.

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

**`DONE`.** `IED → Envelope`, `EnvelopeController`, `Pages/Envelope/Create.tsx`, sizes in
`config/envelopes.php`. **Nothing is stored** — an envelope is not a document, it is the same two
addresses on another piece of paper, and the letter it goes with is already on record. The screen
posts nothing; it just asks for the PDF.

Both entry points are live: the standalone page, and an envelope icon on every row of **Letters**
and **Notes**, which carries the recipient and the Ref No. across. A letter with an empty
recipient block falls back to the customer's name and address, which is what the letter itself
prints.

From sits top-left (small, with the centre's emblem if wanted), To in the lower-right half
(large, bold), an optional reference line beneath. BN + EN.

⚠️ **The four sizes are provisional** and sit alone in `config/envelopes.php` — correcting that
file is the entire change once BITAC says what they buy. Verified: each one renders at its real
millimetre size, both addresses and both labels print, and Bangla shapes.

---

## Still to be discussed

From the same meeting notes, not yet worked through:

- ~~**Letter duplicate**~~ — **`DONE`**. Copy icon on the Letters list copies the subject, body, recipient, customer ref and signatory into a fresh draft and opens it. The number, date, status, issue/email stamps and signature are deliberately left for the new letter.
- ~~**Stakeholder ↔ Customer link**~~ — **`DONE`**. BITAC's decision: there is no separate stakeholder module at all — a stakeholder IS a client. The `stakeholders` table and its screens are gone; stakeholder forms are distributed to customers. Past answers keep their author (matched by email, or preserved inline where no customer matched).
- ~~**IED Reports**~~ — **`DONE`**. `IED → Reports`: Client List, By Type & Sector, Quotation
  Value (with conversion and a monthly breakdown), Jobs in Pipeline. Target vs Achievement is
  its own page (item 5). All share the financial-year filter; work-order money and dates use the
  same expressions as `TargetAchievementService` so the reports cannot disagree.
- **Word-like drafting in IED.**
- ~~**Delivery Orders reaching PCD**~~ — **`DONE`**. The menu moved: **Delivery & Billing** is
  now **Billing & Accounts** (bills/invoices + মূসক ৬.৩) and **Delivery Orders sits under PCD**.
  `pcd-officer` was granted the delivery permissions in the seeder and by migration, or the menu
  would have appeared for nobody on the live database. PCD Job Detail also carries the challans
  raised against that job, behind a `view pcd-inbox` door onto the same PDF.
- **Billing & Accounts** (rename of Delivery & Billing) — bill/invoice · **মূসক ৬.৩ (spec'd
  below)** ·
  VAT & tax calculator · delivery challan generated from PCD · bill forwarding letter.
  The three that travel together: forwarding letter + bill + musak challan.
- **PCD → Outsourcing** — work given to a third party: who, what, note.
  **Last**, by BITAC's instruction (2026-09-28) — everything else goes first.

---

## 9. মূসক ৬.৩ — কর চালানপত্র — `DONE`

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

**`DONE`.** `Billing & Accounts → মূসক ৬.৩`. Every field on the form is typed and stored, so an
issued challan prints what it was issued with however the customer or the centre is edited later.
Rendered through `renderPlain()` with the board's own masthead — it is an NBR form, not BITAC
stationery. প্রথম / দ্বিতীয় / তৃতীয় কপি all print. `centers.bin_number` and
`customers.bin_number` were added; the tax invoice had been reading the customer one for a long
time against a column that did not exist.

**Both open questions are answered** (BITAC, 2026-09-29):

- **AIT** — the buyer deducts income tax at source, so it never appears on the supplier's challan.
  The challan carries VAT only. The form still states the excluded amount, so the difference
  between the bill total and the challan total is never a mystery; verified that the gap is
  exactly the AIT.
- **Rounding** — follow the sample: money is whole taka. 290,909 + 10% = 29,091 → a round
  320,000, exactly as the original prints. The unit price keeps its paisa, since rounding a
  per-piece price is a different thing from rounding a total.
- **The bill and the challan are raised together.** Confirming a delivery writes the invoice and
  the মূসক ৬.৩ in one go, issued and signed by the officer who confirmed it, with destination
  and vehicle from the delivery order. The invoice list links straight to its challan.
