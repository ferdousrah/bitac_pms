# BITAC PMS — Project Context for Claude

> **For Claude**: This file captures the architecture, conventions, and feature inventory. Read this first before making changes. Last major update: 2026-06-16 (Official letters, RFQ Letters module, email system, quotation VAT/Tax model).

---

## 🏭 What This Is

**BITAC PMS** = Production Management System for **Bangladesh Industrial Technical Assistance Centre (BITAC)** — an autonomous body under the Ministry of Industries, Government of Bangladesh.

BITAC is a real organization (since 1962) with 6 regional centres (Dhaka HQ, Chittagong, Chandpur, Khulna, Bogra, TTI). It does industrial training, import-substitute manufacturing, testing, and R&D for government and private sector clients (Railway, BPDB, BWDB, sugar mills, etc.).

This system manages the full workflow: **IED → PCD → Shops → QC → Delivery → Invoicing**.

## 🛠 Tech Stack

- **Backend**: Laravel 11, PHP 8.2+, MySQL
- **Frontend**: Inertia.js + React 18 + TypeScript + TailwindCSS
- **Animation**: Motion (formerly Framer Motion), Lucide React icons
- **AI**: Google Gemini 2.5 Flash (function calling, multimodal)
- **Real-time**: Polling-based (no WebSockets configured yet — `BROADCAST_CONNECTION=null`)
- **WebRTC**: For peer-to-peer voice calls in meetings (no server-side media)
- **Exports**: PhpOffice/PhpPresentation (PPTX), DomPDF, PhpSpreadsheet (Excel)
- **Permissions**: Spatie Permission package
- **Auth**: Laravel Breeze + separate `customer` guard for Customer Portal

## 📂 Project Structure Conventions

```
app/
├── Http/Controllers/
│   ├── Admin/              # Master data CRUD (customers, users, machines, etc.)
│   ├── Customer/           # Customer portal (dashboard, orders, invoices)
│   ├── Auth/               # Login/register (inc. CustomerLoginController)
│   └── [Resource]Controller — one per module (RfqController, QuotationController, etc.)
├── Models/                 # One per entity, singular names (Rfq, Quotation)
├── Services/
│   ├── AiAgent/            # GeminiChatService, ToolRegistry, ReportGenerator
│   ├── MeetingIntelligenceService.php
│   ├── PptxParser.php
│   ├── SettingService.php
│   └── RfqAutomationService.php
├── Http/Middleware/
│   ├── HandleInertiaRequests.php  # Shares auth/branding/chatbot to frontend
│   └── SetActiveCenter.php        # Multi-center scoping
└── Scopes/
    └── CenterScope.php            # Auto-filters by center_id

resources/js/
├── Pages/                  # Inertia pages — mirror routes
│   ├── Admin/{Resource}/(Index|CreateEdit|Show).tsx
│   ├── Customer/           # Customer portal pages
│   ├── Meetings/           # Meeting Room + Summary + Analytics
│   └── ...one folder per module
├── Components/
│   ├── AiChat/             # ChatPanel.tsx (floating Oli), PresentationViewer.tsx
│   ├── SortableHeader.tsx
│   └── ...
├── Layouts/
│   └── AppLayout.tsx       # Main shell with sidebar + ChatPanel
├── lib/
│   ├── navigation.ts       # Sidebar nav config — add new pages here
│   └── WebRTCManager.ts    # Meeting voice call manager
└── app.tsx                 # Inertia bootstrap

routes/web.php              # All routes here, grouped by module
database/
├── migrations/             # Timestamped — use latest +1 for new ones
└── seeders/                # Default password: 'password' for all seeded users
```

## 🎨 UI / Styling Conventions

- Use existing classes: `btn-primary`, `btn-outline`, `btn-ghost`, `card`, `card-header`, `card-body`, `form-input`, `form-textarea`, `form-label`, `form-group`, `form-error`, `alert alert-info`
- Surface colors: `bg-surface-50/100/200`, `text-surface-400/500/800/900`
- Brand color: `text-brand-500`, `bg-brand-50`, etc.
- Animations: `animate-fade-in` for page loads
- Icons: use Lucide React for most icons; Flaticon classes (`fi fi-rr-*`) are also used in legacy code
- Currency: `৳` for BDT, numbers formatted `toLocaleString('en-IN', { minimumFractionDigits: 2 })`

## 🤖 Oli (AI Assistant) — The Showpiece Feature

Oli is powered by **Gemini 2.5 Flash** with 20+ tools. Key files:

- **`app/Services/AiAgent/GeminiChatService.php`** — API calls, history sanitization, system prompt (which includes BITAC knowledge + industrial production expertise)
- **`app/Services/AiAgent/ToolRegistry.php`** — all tool declarations + implementations (1200+ lines)
- **`resources/js/Components/AiChat/ChatPanel.tsx`** — floating chat UI (1400+ lines)
- **`resources/js/Components/AiChat/PresentationViewer.tsx`** — fullscreen live presenter

### Key Tools
`production_monitor`, `work_order_tracker`, `machine_health_agent`, `finance_analyst`, `qc_inspector`, `quality_analyst`, `sales_pipeline_agent`, `downtime_analyst`, `excel_report_builder`, `pdf_report_builder`, `chart_generator`, `presentation_builder`, `live_presentation`, `oli_introduction`, `navigator`, `customer_creator`, `rfq_creator`, `rfq_auto_estimate`, `rfq_auto_quotation`, `rfq_analytics`, `cost_estimate_advisor`

### System Prompt Notes
- Supports English + Bangla (বাংলা), auto-detects language
- Has BITAC knowledge built-in (history, departments, pricing groups A/B/C)
- Has industrial production expertise (machining, welding, heat treatment, materials, tolerances)
- Has graceful fallback for questions it can't answer
- `oli_introduction` tool has pre-built 10-slide demo deck in EN + BN

## 🤝 Meeting Room (4-Phase Feature)

**Routes**: `/meetings`, `/meetings/{id}`, `/meetings/{id}/summary`, `/meeting-analytics`

### Phase 1 — Text Chat + Shared Presentation
- Multi-user meetings with unique codes (e.g. `ABCD-EFGH`)
- 2.5s polling for sync (no WebSockets yet)
- Oli joins every meeting as AI participant — triggered by `@oli` or "Oli" prefix
- Full presentations load on shared screen

### Phase 2 — Voice Input (Speech-to-Text)
- Web Speech API
- English / Bangla toggle (`en-US` / `bn-BD`)
- Push-to-talk OR continuous listening modes
- Real-time speaking indicators across participants

### Phase 3 — WebRTC Voice Call
- Real peer-to-peer audio (mesh topology, 2-4 participants)
- `resources/js/lib/WebRTCManager.ts`
- Signaling via cache-based polling
- STUN servers: `stun.l.google.com:19302`
- **Requires HTTPS** in production (localhost exempt)
- Volume-level visualization per peer

### Phase 4 — Meeting Intelligence
- Auto-extracts action items + decisions every 5 messages (via Gemini)
- Smart assignee matching (fuzzy name → user)
- Due date parsing ("next Friday" → YYYY-MM-DD)
- Polished meeting minutes auto-generated at meeting end
- Post-meeting summary + analytics dashboard

### Shared Screen Supports
- Oli-generated slides (charts, KPIs, tables, bullets)
- User-uploaded images (shown as slides with "Shared by X")
- User-uploaded **PPTX files** — parsed via PhpPresentation, all slides pushed to shared screen
- PDFs (download card in chat)

## 🔑 Multi-Tenant / Multi-Center

- All main tables have `center_id` column
- `CenterScope` global scope auto-filters queries by active center
- `HasCenter` trait auto-fills center_id on save
- `super_admin` role can switch centers via session (`session('active_center_id')`)
- Dhaka is center #1

## 👥 Auth Setup

- **Staff** login: `/login` → redirects to `/dashboard`
- **Customer portal** login: `/customer/login` → redirects to `/customer/dashboard`
- Two guards: `web` (staff, has Spatie roles) and `customer` (no roles)
- **Default password** for all seeded users/customers: `password`
- **Example staff**: `admin@bitac.gov.bd` / `password`
- **Example customer**: `shoeb@acimotors.com.bd` / `password`

### ⚠️ Important: Customer model does NOT use Spatie
Customer extends Authenticatable but does NOT have `hasRole()`. In middleware, use:
```php
method_exists($user, 'hasRole') && $user->hasRole(...)
```
Don't call `hasRole()` blindly on auth users — check guard first with `auth('web')->check()`.

### ⚠️ Password Hashing
Both `User` and `Customer` models have `protected $casts = ['password' => 'hashed']`. **Do NOT call `Hash::make()` manually** when setting passwords — the cast auto-hashes. Double-hashing = broken login.

## 🐛 Common Gotchas (Learned the Hard Way)

### 1. Inertia form PUT/PATCH
```tsx
// ❌ WRONG — method option is ignored
post(url, { method: 'put' } as any);

// ✅ RIGHT — use dedicated method
const { put } = useForm({...});
put(url);

// ✅ RIGHT for file uploads + PUT (Laravel method spoofing)
transform(d => ({ ...d, _method: 'put' }));
post(url, { forceFormData: true });
```

### 2. Guest Middleware Redirect
Laravel 11's default `guest` middleware redirects authenticated users to `/`. We configured smart routing in `bootstrap/app.php`:
- Customer logged in → `/customer/dashboard`
- Staff logged in → `/dashboard`
- Unauth customer area access → `/customer/login`

### 3. Inline SVG Charts
Don't use `motion.rect` with animated `height` attribute — it gets stuck. Use plain `<rect>` with CSS `@keyframes` + `transform: scaleY()`.

### 4. Text Inside SVG
Tailwind font-size classes (`text-[9px]`) don't work in SVG text. Use `fontSize="9"` attribute instead.

### 5. PPTX Files
Upload uses PhpPresentation (server-side). Max 20MB. Slides are text-only — embedded images in PPTX aren't extracted (future: use LibreOffice headless to render as PNG).

### 6. PCD Job Detail (`Pages/Pcd/JobDetail.tsx`) — redesigned layout
Top→bottom: header band → **Production Routing hero** (live shop stepper: "X is running it now", overall %, stage N of M — from `job.sections` statuses) → **4 stat tiles** (Quantity / Due Date w/ "in N days" / Job Items / Customer PO) → two-column grid.
- **Job Items** (full-width, collapsible, ABOVE the hero): per-item card list — description, qty badge, IED note, and inline **drawings & sample thumbnails/chips** (`rfq_items[].drawings/samples`, `is_image` flag from controller). Drawings/samples live HERE.
- **PCD Workflow Progress** is a COMPACT 3-row gates list (MR/WO/OS w/ status badges + "Work Order PDF" button) — NOT the old big-circle stepper.
- Left column: Workflow gates, Work Order (PDF + Edit), consolidated **Operation Sheet(s)** (per-item `job.item_operation_sheets`, View + PDF each; else legacy single `job.operation_sheet`), Gate Passes. Main-card headers are clean (no bg tint / no icon — just title + subtitle).
- Right sidebar (each card header = a coloured dot bullet, not an icon): Job Details (amber dot, label/right-value rows), **Material Requisitions** (brand dot, optional gate), **Documents** (green dot — Customer RFQ Letter / Approved Quotation / Customer Work Order → PDF-popup buttons). "Quick Actions" + old "Attached Documents"/"Source Documents"/"Job Reference" sections were removed.
- Production Routing hero + stat tiles are currently HIDDEN behind `{false && …}` (flip back to restore).
- `openPdf(baseUrl, title, subtitle?)` helper: fetch `?preview=base64` → popup (new-tab fallback); reused for WO + op-sheet PDFs.

### 7. PCD Work Order section-assign (`Pages/Pcd/SectionAssign.tsx`)
BITAC paper-form layout for routing a job through shops. Editable by PCD: **Delivery date** (`due_date`), per-item **Quantity** + **Part No.** (`work_order_items.part_no`, added 2026-06) + description + PCD note, the section routing (drag-to-reorder), job number, department. The "Save Work Order" action card is `sticky bottom-4`. The routing card heading is just "Section". `WorkOrderSectionController@update` persists due_date + per-item qty/part_no; `@pdf` shows `part_no` (positional `n/total` fallback).

### 8. IED inbox is `ied_pending`-only — never `abort()` on a stale state (2026-08)
`IedWorkOrderInboxController@show/accept/reject` all guard `status === 'ied_pending'`. They used to `abort_unless(..., 422)`, which threw a raw Symfony exception page ("Only IED-pending work orders can be forwarded to PCD.") whenever someone re-submitted from a stale tab / back button / double-click, or opened an already-forwarded WO by URL — the action had actually succeeded the first time, but it *looked* like a crash. All three now `redirect()->route('ied.work-orders.index')->with('error', …)` naming the current `status_label`, so a duplicate submit reads as a normal flash toast (AppLayout renders shared `flash.error`). **Rule for any single-shot state transition: guard with a redirect + flash, not `abort()`.** The Show page renders only for `ied_pending` now, so no status gating is needed in `Ied/WorkOrders/Show.tsx` (it's the sole render site of that component).

## 📦 RFQ Parts & Drafts (2026-08)

### Job item → Parts (positional part numbers)
- A job item can be broken into the **parts** it covers. Table `rfq_item_parts` (`rfq_item_id`, `name`, `sort_order`), model `RfqItemPart`, relation `RfqItem::parts()`.
- **Only the name is stored.** The **Part No. is positional** — `1/3`, `2/3`, `3/3` — derived from the row's index + sibling count, never typed and never persisted, so removing a part renumbers the rest with no gaps. Same `n/total` convention as `work_order_items.part_no`. Helper: `RfqItemPart::formatNo($index, $total)` (PHP) / `partNo(i, total)` (Create.tsx).
- UI: a repeater directly under **Part / Job Description** in `Rfq/Create.tsx` (Add Part / remove, auto-numbered chip + name input). Rendered on `Rfq/Show.tsx` via the `PartsList` component (desktop table + mobile card). `edit()` ships `parts[].name`; `show()` ships `parts[].{id,name,part_no}`.
- Persisted by `RfqController::syncItemParts()` — wipes and rewrites in order, **dropping blank names**. Called from `store()`, `update()` and `autosave()`.

### RFQ drafts + autosave
- `rfqs.status` widened **enum → varchar(20)** and gained **`draft`**. A draft is an RFQ that has NOT entered the pipeline: no `RfqCreated` event (so no auto-estimate/duplicate detection), no PCD notification. Those side effects live in `RfqController::announceNewRfq()`, fired on real create **and** when a draft is later submitted.
- **`POST /rfqs/autosave`** (`rfqs.autosave`, declared BEFORE the resource so `rfqs/{rfq}` can't shadow it) — debounced 2.5s from the form, posted with `window.axios` (XSRF cookie handled automatically), returns JSON `{ok, rfq_id, saved_at}`.
  - It **only ever writes drafts**. Passing an `rfq_id` whose RFQ has left draft returns **409 `not_draft`** and the client permanently stops autosaving.
  - It **never touches files** — attachments only travel on an explicit save.
  - Items are synced **by position** (update row i in place, create/delete the tail), NOT wiped and recreated like `update()` does, so a draft's already-attached drawings survive every autosave.
  - Autosave starts only once `customer_id` is picked, so half-typed forms don't litter the DB with junk drafts.
- **Form behaviour** (`Rfq/Create.tsx`): autosave runs when creating new OR editing a draft — never when editing a submitted RFQ. Once autosave has created a draft, `targetId = rfq?.id ?? draftId` so pressing **Create RFQ** PUTs into that same draft instead of creating a second RFQ. Buttons: **Save as Draft** (`save_as_draft=1`, full save incl. files, redirects back to the edit page) and **Create RFQ / Submit RFQ / Update RFQ** depending on state. A "Draft saved at HH:MM:SS" indicator sits next to them.
- `formRules($isDraft, $forUpdate)` is the single rule set for create/edit — **drafts relax** `items` (nullable) and `items.*.quantity` (`nullable|min:0` vs `required|min:0.01`), and skip the "description or product required" check. Blank quantity stores `0`.
- Index/Show carry a slate **Draft** badge, a `status=draft` filter, and a **Continue** action on draft rows.
- **Job cards collapse/expand** on the RFQ form (chevron top-right, or click the card header). A folded card shows its first description line, qty/unit and part count. **Collapse all / Expand all** appears once there are 2+ jobs. State is a `Set` of indices (`collapsed`), remapped in `removeItem` so it stays on the same card; any card with a validation error (`items.N.*`) is re-opened automatically and badged "needs attention", so an error can never hide inside a folded card.
- **Deleting**: `destroy()` gained a guard + cleanup. It **refuses** (redirect + flash, never `abort()`) once a **quotation, cost estimate or work order** exists against the RFQ — critical because `quotations.rfq_id` is `ON DELETE CASCADE`, so an unguarded delete would silently take the quotation with it. Otherwise it unlinks the RFQ's physical files (skipping gallery picks, which are shared `user_files`) and deletes; `rfq_items` → `rfq_item_files`/`rfq_item_parts` all cascade at the FK level. UI: a **Delete** action on draft rows in the RFQ list and a **Delete Draft** button on the draft form (both `confirm()` first, per the Admin index convention).
- `rfq_item_parts` is transactional → added to `SystemResetController::TABLES_TO_WIPE` + `Admin/System/Reset.tsx`.
- ⚠️ Items arrays can arrive without a `product_id` key now that drafts are lenient — always read it as `($item['product_id'] ?? null) ?: null`.

## 🔁 Quotation Revisions — changing an approved quotation (2026-08)

> An approved quotation is never edited in place. It is superseded by a new version.

- **The real-world flow:** BITAC approves a quotation → sends it → the customer asks for a lower price → a new version goes out at the new price. `edit()`/`update()` deliberately only accept `draft` (or `pending_approval` for an approver making a small correction), so a price change after approval MUST go through a revision.
- **`createRevision()`** makes a new **v(n+1) draft**, marks the parent `superseded`, and links them via `parent_quotation_id` (the revision chain UI reads this).
- **`REVISABLE_STATUSES`** = `approved`, `sent_to_customer`, `revision_requested`, `customer_rejected`. It used to be `revision_requested` ONLY, which meant a price could not be reworked unless a customer response had been formally recorded first. `canCreateRevision` in `show()` reads the same constant — keep them in step. Not revisable: `draft`/`pending_approval` (just edit it), `customer_accepted`, `superseded`.
- ⚠️ **The revision must copy EVERYTHING.** It originally copied only header/total columns and **not the line items**, so a revision opened with zero items — and since `update()` requires `items|min:1`, the whole quotation had to be retyped. It now carries items, `terms`, forwarding letter + subject, `recipient_block`, `memo_no`, customer ref, `discount`/`discount_type`, `job_category_id`, and the **tax config** (`tax_rate`, `tax_amount`, `show_tax_breakdown`) — dropping the tax config silently changes what the printed price means. If you add a column to `quotations`, decide whether a revision should carry it.
- `memo_date` is deliberately **left NULL** on a revision so the re-quotation prints its own date; `memo_no` is copied verbatim because the PDF appends the revision number from `version` (`…028.51(2)`), per the official-letter convention.
- Refusal is a redirect + flash naming the current status, not an `abort()`.
- The revision then goes through approval again from scratch, and `sendToCustomer` requires `approved`, so a re-quotation cannot reach the customer un-approved.

### Deleting a draft quotation (`QuotationController@destroy`)
- **Only `draft`** can be deleted (anything submitted/approved/sent is revised, never deleted); refusal is a redirect + flash. Allowed for the creator, a super admin, or anyone with `edit quotations`. UI: trash icon on draft rows in the Quotation list, **Delete** in the Draft card on Show, **Delete Draft** on the edit form — all `confirm()` first.
- Items, file rows, approvals and customer responses cascade; physical attachments are removed from the `public` disk.
- ⚠️ **Deleting a revision (v2+) hands the chain back to its parent.** Creating the revision set the parent `superseded`, and superseded can't be revised — so without this the quotation would be stuck with nothing live. The prior status isn't stored, so `statusBeforeSupersede()` derives it from the parent's own record: newest customer response (rejected → `customer_rejected`, revision_requested → `revision_requested`, accepted → `customer_accepted`), else `sent_to_customer_at` → `sent_to_customer`, else a fully approved chain → `approved`, else `draft` (the request-changes path wipes the chain mid-approval). Logged as a `revision_discarded` revision event.
- A draft started as a **direct quotation** also removes its auto-created RFQ (`source = direct_quotation`), but only if nothing else hangs off it — no other quotation, cost estimate, work order or gate pass.

## 📄 Direct Quotation & Copying a Quotation (2026-08)

### Work that starts at the quotation, not an RFQ
- `quotations.rfq_id` stays **NOT NULL** — everything downstream (part-wise costing, work orders, gate passes, RFQ letters, the customer portal) is anchored to an RFQ, and cost estimates specifically hang off `rfq_item` / `rfq_item_part`. So a quotation ALWAYS has an RFQ.
- What changed is who types it: `QuotationController@store` now takes `rfq_id` as **nullable** plus a `customer_id` (`required_without:rfq_id`). With no RFQ it calls **`createBackingRfq()`**, which creates the RFQ and mirrors the quotation's lines into `rfq_items` (description → `job_description`, qty, unit). The job can then be split into parts and costed exactly like any other.
- Those RFQs carry **`rfqs.source = 'direct_quotation'`** (the column was widened enum → varchar(30)) and show a teal **Direct** badge in the RFQ list, so it's clear nobody keyed them in.
- The quotation form shows a **customer picker** instead of the RFQ banner when there's no RFQ, and Line Items gained **Add Item** / per-row remove so lines can be typed from scratch.

### Copying a quotation onto another customer
- The same job often comes back from a different company. **`POST quotations/{quotation}/duplicate`** (`duplicateForCustomer`, button on Quotation Show) clones the whole chain for a new customer: a fresh RFQ → its job items → their **parts** → the **cost estimate behind each part** (via `copyEstimate()`) → a new **v1 draft** quotation. The source is never touched.
- **Pricing group is the switch, and it decides everything:**
  - **Left as-is → an exact copy.** Line rates are copied verbatim, `grand_total_override` is carried over, and the quotation's unit prices are copied straight across. Totals match the original to the paisa.
  - **A different group → re-priced.** Operation lines take that group's `rate_group_*`, material lines take the current catalogue `rate_per_kg`, the override is dropped (it rounded a number that no longer applies), estimates are recalculated, and each quotation line's `unit_price` is re-derived as `jobCostBreakdown()['total'] / quantity`.
- ⚠️ **Customers have no pricing-group column**, so the group cannot be inferred from the target customer — the preparer picks it in the copy dialog. Don't add auto-detection without adding that field first.
- The copy gets its own `recipient_block` built from the new customer; memo no / customer ref are deliberately left blank for the new letter. Copied estimates land as `draft` / `not_submitted` so they go through approval on their own merits.
- **Not copied:** RFQ file attachments (drawings, sample photos). Uploaded files would need physical duplication; add it deliberately if wanted.

## 💰 Part-wise Cost Estimating (2026-08) — READ BEFORE TOUCHING PRICING

> The money path. Get this wrong and quotations go out under-priced.

- **A job is costed PART BY PART.** Each `rfq_item_parts` row gets its own cost estimate (`cost_estimates.rfq_item_part_id`, nullable). NULL = a whole-job estimate — what jobs without parts use, and what every pre-2026-08 estimate is.
- **Part quantity is ABSOLUTE** — the total pieces for the whole order, not the count per job unit (`rfq_item_parts.quantity` + `unit`, entered on the RFQ form). So **job cost = plain Σ of its part estimates**; it is NEVER multiplied by the job quantity again.
- **`RfqItem::jobCostBreakdown()` is the single source of truth.** Returns `mode` (`parts` | `item` | `none`), `total`, per-part rows, `costed`, `missing`. Rules:
  - parts exist AND ≥1 is costed → `parts`, total = Σ of each part's **newest non-draft** estimate (`RfqItemPart::effectiveEstimate()`; falls back to newest draft). A re-estimate of one part replaces it — never double counts.
  - otherwise → `item`, the newest item-level estimate (`RfqItem::itemLevelEstimates()`, which filters `whereNull('rfq_item_part_id')` so part estimates can't be picked up as job ones).
  - nothing costed → `none`, total 0.
- **Quotation is JOB-wise only — parts never reach the customer.** `QuotationController@create` builds one line per RFQ item with `unit_price = jobCostBreakdown()['total'] / rfq_item.quantity`, so `qty × unit_price` equals the job total exactly. ⚠️ It used to take the **single latest** estimate per item; with parts that silently quoted one part of a multi-part job. Never reintroduce a `->first()` over an item's estimates here.
- **Under-quote guard:** a `parts`-mode job with `missing > 0` is collected into the `uncostedJobs` prop and the quotation form shows an amber warning naming each job and how many parts are uncosted. The price shown genuinely is short until they're costed.
- **Entry point:** RFQ Show lists each part with its qty and either its estimate amount (link) or a **+ Estimate** button → `/cost-estimates/create?rfq_item_part_id=N`. The estimate form derives `rfq_item_id` from the part, prefills `job_quantity` from the part's quantity, and stamps the positional `part_no` (`3/3`). The Cost Estimate column shows the job roll-up ("sum of N parts") plus the not-costed warning.
- `grand_total_override` still applies **per part**, and flows into the sum.
### Job Costing — the consolidated view (`JobCostingController`)
- **`GET cost-estimates/job/{rfqItem}`** (`cost-estimates.job`, page `CostEstimate/JobCosting.tsx`) + **`/pdf`** (letterhead, `?preview=base64`). Brings every part estimate of a job back into ONE sheet: part rows (estimate no, approval status, group), Material / Machining / Surface / Other / Overhead / VAT+Tax / Adjust. / Unit cost / Total, a Job-total footer, Job total + Per-unit + Net production cost tiles, uncosted-parts warning, click a row to see its cost lines, and **Submit Whole Job** when >1 is submittable. Jobs costed as a whole show a single row.
- **Read-only and stores nothing** — derived from the estimates, and `job_total` comes from `jobCostBreakdown()`, so it is always the number the quotation uses.
- ⚠️ **The maths:** an estimate's `material_cost`/`machining_cost`/… and `overhead_amount`/`vat_amount`/`tax_amount` are **per unit**; `total` already includes `times_multiplier`; `grand_total = total × job_quantity` unless overridden. So each breakdown figure is **extended by `times_multiplier × job_quantity`** before summing, and `adjustment = grand_total − total × job_quantity` surfaces any manual rounding — that's what makes every column add up to the job total. Summing the raw per-unit columns across parts is WRONG.
- Entry points: RFQ Show's Cost Estimate cell ("Job costing" link, parts mode) and a "Job costing →" strip on a part estimate's Show page.

### Editing a whole job's costing on one page (`JobCostingController@edit/@update`)
- **`GET cost-estimates/job/{rfqItem}/edit`** (page `CostEstimate/JobCostingEdit.tsx`, entry = "Edit all parts" on Job Costing) + **`PUT cost-estimates/job/{rfqItem}`**. Every part gets the **full estimate editor** in a collapsible block (catalogue pickers, weight/HT calculators, AI rates, copy-from-existing, cost summary). Parts with no estimate show "Start estimate for this part" and default to their siblings' pricing group / overhead / VAT / tax. Live per-part and job totals, a sticky **Save All** bar, and a beforeunload guard for unsaved edits.
- **The editor is shared:** `resources/js/Components/CostEstimate/EstimateEditor.tsx` is the editing surface lifted out of `CostEstimate/Form.tsx` (which is now a thin page: `useForm` + banners + submit). It's **controlled** — `data` + an Inertia-style `setData(key, value | object)`. Any custom setter MUST apply **functional** updates, because the editor calls it several times in a row (e.g. pricing group, then re-priced lines). `hideCustomer` hides the customer row; `footer` renders the page's buttons under Notes.
- **One write path:** `app/Services/CostEstimateWriter.php` holds the rules (`rules()`), `create()` and `update()`; both `CostEstimateController@store/update` and the job editor call it. Don't re-inline estimate persistence in a controller.
- **Approval rule (both pages):** a pending or approved estimate CAN be edited, but if the edit actually changes it, its approval rows are deleted and it drops to `not_submitted` / `draft` (approval_batch cleared) — an approval only vouches for the figures it saw. `update()` compares a **normalised fingerprint** of fields + lines first and returns `false` without writing when nothing changed, so an unchanged save never resets an approval. The job page only sends parts whose data differs from what was loaded (plus newly started ones) and confirms before saving over an approval.
- **Costing a new job all at once:** on RFQ Show, **Create Estimate** for a job that HAS parts (and no estimates yet) goes to `cost-estimates/job/{rfqItem}/edit?start=all` instead of a single whole-job estimate. `startAll` starts every uncosted part and opens the first; new parts open with one blank row per section. A started part is only saved once it has at least one cost line (description, material or operation) — so parts left untouched stay "not costed" rather than becoming ৳0 estimates, and are badged "empty — not saved yet". Jobs without parts keep the old single-estimate Create Estimate.
- `update` is all-or-nothing in one transaction; it rejects any estimate whose `rfq_item_id` isn't this job, and never moves an estimate's part link. Validation errors come back as `estimates.N.field` (N = position in the SENT array) and the page maps them to the right part and opens it.

### Deleting a draft cost estimate (`CostEstimateController@destroy`)
- `destroy()` used to delete ANY estimate unconditionally. It now refuses (redirect + flash) unless `deleteBlocker()` returns null: `status` must be `draft`, `approval_status` must not be `pending_approval`/`approved` (a draft that was rejected is deletable), and it must not be linked to a quotation (`quotation_id`). Allowed for the creator, a super admin, or anyone with `edit cost-estimates`.
- Lines and approval rows cascade; an estimate copied from it keeps existing with `source_estimate_id` set NULL.
- UI: trash icon on deletable rows in the Cost Estimates list (`can_delete` per row) and a **Delete** button on the estimate Show page (`canDelete`), both behind `confirm()`. Deleting a part estimate simply leaves that part uncosted in the job roll-up.
- Note: `generateEstimateNo()` takes the max existing number, so deleting the newest estimate lets its number be issued again.

### "Used as Quotation" — the estimate → quotation link (2026-09)
- ⚠️ **An estimate is marked `used` when a quotation is actually created from it, NOT when the button is clicked.** `useAsQuotation()` only opens the quotation form (carrying the kickoff note). It used to set `status = 'used'` right there, so anyone who opened the form and closed the tab left the estimate stranded — history said "Used as Quotation", no quotation existed, and the Show page hid the button on that exact status, with no way back. **Never mark an estimate used from a route that just navigates somewhere.**
- **`cost_estimates.quotation_id` is now actually written**, by `QuotationController::linkSourceEstimate()` at the end of `store()`. The column had existed all along and `deleteBlocker()` + the material-requisition lookup already read it, but **nothing ever set it** — so those checks never fired and "a quotation was made from this" was indistinguishable from "someone clicked once". The form carries it as `source_estimate_id` (`Quotation/Create.tsx` ← the `sourceEstimateId` prop, which used to be passed and then dropped).
- The link **refuses** an estimate that is already tied to another quotation, or whose `rfq_id` isn't the quotation's — so a second quotation can't steal it and nothing cross-links between RFQs. ⚠️ **A standalone estimate (`rfq_id` NULL — costed with no RFQ) is the exception: it ADOPTS the quotation's RFQ**, including the backing RFQ a direct quotation makes for itself. Without that the NULL never matched, so an RFQ-less estimate stayed unlinked and kept offering "Use as Quotation" after a quotation had been made from it.
- **Costing with no RFQ already works** — "New Estimate" on the Cost Estimates list opens the form with no RFQ, and `cost_estimates.rfq_id` / `rfq_item_id` / `customer_id` are all nullable (`company_name` carries a walk-in party). Verified end to end: the form opens, it saves, Show renders, the PDF renders, and Use as Quotation carries it into a direct quotation.
- **The Show page gates the button on `quotation_id`, not on the status string** — it shows **View Quotation** when linked, **Use as Quotation** otherwise. Gating on `status !== 'used'` is what made the dead end unrecoverable.
- Migration `..._000039_repair_cost_estimates_stuck_as_used` fixes rows already stranded: if a quotation exists on the same RFQ it links it (and it stays `used`), otherwise it restores the status from the revision snapshot taken **just before** the `used_as_quotation` event. ⚠️ It restores rather than guessing because `status` decides whether an estimate is the **effective** one for its part (`effectiveEstimate()` = newest non-draft), and that feeds the job total a quotation is priced from.

### Copying a costing (don't re-key the same job type)
- **"Copy from Existing"** button on the estimate form opens a searchable picker of past estimates (`GET api/cost-estimates/copy-search?q=`, matches estimate_no / job_name / company_name / part_no / customer, and only returns estimates that HAVE lines). Selecting one calls `GET api/cost-estimates/{costEstimate}/copy-source` and pulls in the cost structure + all lines.
- **What is copied:** `overhead_pct`, `vat_pct`, `tax_pct`, `times_multiplier`, `extra_cost`, all cost lines, and the sizes *only if this estimate has none yet*.
- **What is NOT copied** (it belongs to the job being costed): job_name, customer, job_quantity, part_no, grand_total_override, and every RFQ/part link.
- **Rates are refreshed, never copied blindly** — `repriceLines(lines, group)` re-reads each material's current `rate_per_kg` and each operation's rate for the CURRENTLY selected pricing group. An old estimate's rates are historical. This helper is shared with the existing AI "Fill from Similar Job" flow, which used to inline the same logic.
- This is distinct from the AI auto-suggest (`find-similar`), which guesses a match from the typed job name; the copy picker is the explicit "I know which one I want" path.
- ⚠️ There is **no duplicate-estimate action**, deliberately: the form has no UI to change an estimate's `rfq_item_id`/`rfq_item_part_id`, so a duplicated row would be stuck on the source's part. Copying INTO a new estimate (whose target is already correct) sidesteps that.

### Approval: per-estimate OR job-wise (the preparer chooses)
- Both routes exist and neither replaces the other:
  - `POST cost-estimates/{costEstimate}/submit-approval` — just this estimate, `approval_batch` stays NULL.
  - `POST cost-estimates/job/{rfqItem}/submit-approval` (`submitJobForApproval`) — every part estimate of the job goes in together under one shared `cost_estimates.approval_batch` uuid.
- Job-wise submit only takes each part's **effective (newest)** estimate, so superseded revisions are never sent, and it **skips** estimates already in approval rather than duplicating their chain (it says how many it skipped).
- **A decision applies to the whole batch.** `approveEstimate` / `rejectEstimate` / `requestChangesEstimate` all loop over `CostEstimate::approvalBatchMembers()` (just `[$this]` when `approval_batch` is NULL), so one click decides every part estimate submitted with it. Siblings the approver already actioned are skipped, not failed. Request-changes also clears `approval_batch` — resubmitting is a fresh decision.
- Each estimate still keeps its own `cost_estimate_approvals` rows, so the PDF signatory grid and `ApprovalChainLabels` are untouched.
- The chain builder was extracted to `CostEstimateController::buildApprovalChain()` — both submit paths use it; don't inline it again.
- UI: the estimate Show page offers **Submit** and (for a part estimate whose job has >1 submittable estimate) **Submit Whole Job (N)**, warning in the confirm if some parts are uncosted. When `batchSize > 1` an indigo note tells the approver their decision covers all N.
- ⚠️ **`approval_status` was missing from `CostEstimate::$fillable`** — every `update(['approval_status' => …])` was silently dropped by mass-assignment protection, so estimates never left `not_submitted` (Submit stayed clickable and could stack duplicate chains). Fixed; keep it in `$fillable`.

## ✍️ Signatures — multiple per user, picked when signing (2026-09)

> A signature image is the WHOLE block. Read this before touching any signature.

- **What is uploaded is a scan of the entire block** — the pen stroke *with* the name (Bangla), designation, centre, email and phone printed under it. So **documents print the image and nothing else**. Typing those lines under it as well printed everything twice.
- ⚠️ **The image is sized by WIDTH only, never height.** It is a whole block — pen stroke plus four or five lines of name/designation/contacts — so pinning a height squashed all of that into ~17mm and the writing came out unreadable (and only ~23mm wide). `imageMaxWidthPt` is the width it prints at; the height follows the scan's own proportions. ~180pt / 63mm on a quotation, which matches the printed original. `blankHeightPt` only sizes the empty space when there is NO image.
- **`App\Support\SignatureBlock::html()` is the one renderer.** Image present → image alone. **No image → the typed lines**, so an unsigned document still names who it is for. **Role labels** (`Prepared By` / `Checked By` / `Approved By` / `Issued By` / `Inspector`) are the office speaking, not signatory details, and always print. Don't hand-roll a signature block again.
- ⚠️ **A drawn signature is only a squiggle** — the pad at approval/issue time captures no name or designation, so a document signed that way names nobody. The picker says so. If that becomes a problem, the fix is a per-signature "details are in the image" flag, not un-picking image-only.

### Where they live
- **`user_signatures`** (`user_id`, `label`, `path`, `is_default`) replaces the single `users.signature_path`. The migration copies every existing signature across as that user's default. The old column is **read-only fallback** — nothing writes it.
- **`User::signatureAbsolutePath()` kept its name and meaning** and resolves the **default** signature, so all eight PDF sites that already called it work unchanged. `User::signatures()` / `defaultSignature()` / `signature_url` all go through the new table.
- **`UserSignatureController`** is behind both the profile routes (`profile.signatures.*`, your own) and the admin ones (`admin.users.signatures.*`, anyone, needs `manage users`). Invariants live there: exactly one default per user, the **first upload becomes the default**, deleting the default **promotes a survivor**, max 6.
- ⚠️ **Deleting a signature does NOT delete its file while a document points at it.** `UserSignature::deleteWithFile()` checks `quotation_approvals` / `cost_estimate_approvals` / `gate_passes` (both columns) / `rfq_letters` / `users` first — a blind unlink would blank a document that was already signed.
- UI is `Components/SignatureManager.tsx` on **Profile → Signatures** and **Admin → Users → edit**. The admin *create* form keeps one optional upload (the manager needs a user id). `ProfileController@updateSignature` + `POST /profile/signature` were **removed** — they were the single-signature path.

### Picking one when you sign
- `Components/SignaturePicker.tsx` shows the signer's blocks (default preselected) plus "draw one now". Used in **four** places: **quotation approve**, **cost estimate approve**, **gate pass issue + approve**, **RFQ letter issue**.
- The request carries **`user_signature_id`** (a saved block) or **`signature`** (a drawn data URL) — never both. **`App\Support\SignatureResolver::resolve()`** turns either into a path.
- ⚠️ **Documents store the PATH, not the id**, so renaming or deleting a signature later can never change a document that already went out.
- **It refuses an id that isn't the signer's**, so nobody can stamp another officer's signature by guessing a number. On an **RFQ letter the owner is the chosen signatory, not the person filling the form** — letters are routinely prepared by one person and signed by another, so `formProps` ships each signatory's own blocks with them rather than reading `auth.user.signatures`. ⚠️ The check **casts before comparing**: a signatory id from a form arrives as a string and a strict `===` silently refused every legitimate signature.
- `auth.user.signatures` is shared globally in `HandleInertiaRequests`, so no page ships its own copy (the letter form is the one exception, above).
- A **batch cost-estimate decision resolves its signature once**, before the loop — one decision, one image, not N identical copies.

## 📝 Official Letters, Quotation Pricing & Email (2026-06)

> Conventions hammered out over many iterations — read before touching these areas.

### PDF letterhead (`app/Services/BitacLetterhead.php`)
- Renders the header/footer of **every** PDF in the system (quotation, cost estimate, gate pass, op sheet, challan, invoice, QC, work order, RFQ letter). mPDF, not DomPDF — DomPDF can't shape Bangla যুক্তাক্ষর.
- The header reproduces the **printed BITAC stationery** and must stay that way: national emblem left, BITAC gear right, and five centred lines — centre name (19pt, **violet `#5b2d90`**), শিল্প মন্ত্রণালয় (11pt, **red `#c00000`**), গণপ্রজাতন্ত্রী বাংলাদেশ সরকার, the address, then `ফোন: … , ওয়েবসাইট : …`. A **rule closes the block** across the full width (1pt, the centre's `letterhead_color`) — the printed stationery has it. **No English caption line.** The three text inks are consts (`TITLE_INK` / `MINISTRY_INK` / `BODY_INK`) — features of the stationery, not per-centre branding.
- ⚠️ **Address + contacts belong in the HEADER**, matching the real letterhead. The footer is page numbers only — don't put them back in both. **The top margin is measured, not guessed**: `setAutoTopMargin => 'stretch'` + `autoMarginPadding => 3` make mPDF grow `margin_top` to `margin_header` + the rendered header's real height + 3mm, so the body always starts a fixed **3mm under the letterhead rule** however many lines the centre's address/contacts take. `margin_top` (28) is only a floor. It was a hand-set 44mm, which left ~12mm of dead space between the rule and the first line — don't go back to a fixed number.
- **No watermark.** A faded BITAC gear used to sit behind every page to suggest a preprinted pad; even at 4% opacity it read as a smudge under the text and the real stationery has nothing there. Removed — don't reintroduce it without being asked.
- The website is Latin inside a Bangla line, so it's wrapped in a `tinos` span (`contactLine()`) or mPDF substitutes glyphs.

#### PDF fonts — Tinos (English) + Nikosh (Bangla), 2026-09
- **Every BITAC PDF sets English in `tinos` and Bangla in `nikosh`.** Both are registered in `BitacLetterhead::buildMpdf()` and live in `public/fonts/`. `default_font` is `tinos`.
- **`tinos` IS Times New Roman.** Monotype's own metric-compatible libre clone — advance widths verified identical to `C:\Windows\Fonts	imes.ttf` glyph for glyph. It is used *instead of* the real `times.ttf` because Times New Roman is a licensed Windows/Office font that may not be redistributed in the repo or embedded in generated PDFs; Tinos is Apache-2.0 and sets the same. Don't "fix" this by dropping in times.ttf.
- **`nikosh`** is the Bangladesh government's standard Bangla face (BCC). Its fontdata entry carries **`'useOTL' => 0xFF`** — that flag is what actually shapes Bangla. Without it mPDF lays codepoints out in order and যুক্তাক্ষর / matra placement come out wrong. **Any Bangla font added here needs `useOTL`.**
- ⚠️ **`autoLangToFont` is `false` and must stay false.** mPDF's language table maps Bangla → `freeserif` and applied that *over* the requested `font-family`, so PDFs silently carried a third face and Bangla set inconsistently. Off, our `font-family` wins; Bangla with no `font-family` falls through `useSubstitutions` to `backupSubsFont` (`nikosh`, which brings its own `useOTL`). Verified: a rendered quotation / cost estimate / RFQ / forwarding letter now embeds **only** Tinos + Nikosh.
- `siyamrupali` stays registered as an **alias pointing at Nikosh.ttf**, so stored rich-text (terms, letter bodies) written before the switch still reprints in the current face. `dejavusans`/`dejavusansmono` no longer appear in any PDF — a document is set in one face, including the memo/job/part number columns that used to be mono.
- ⚠️ **Bangla is picked up by CSS class, not by substitution.** `stylesheetCss()` carries **`.bn, .lang_bn { font-family: nikosh; }`**. `.bn` is ours; **`.lang_bn` is mPDF's** — `autoScriptToLang` wraps every run of Bengali script it finds in `<span lang="bn" class="lang_bn">`, so Bangla typed into an otherwise English field (a job description, a customer name) lands in Nikosh too. **This rule is load-bearing:** `backupSubsFont` substitution does **not** apply OpenType, so without it such text printed *unshaped* — যুক্তাক্ষর broken — even though the right font was picked. Proven by rendering the same string three ways (explicit `.bn`, bare `<div>`, table cell): only the explicit one shaped until `.lang_bn` was added; all three match now.
- On screen, `resources/css/app.css` declares a `Nikosh` `@font-face` and **Admin → Centers** previews the letterhead fields in it, so what the admin types looks like what prints.
- **Quotation PDF title** is **দরপত্র** centred over **(QUOTATION)** — the Bangla line then the English in brackets. **No box or rule around it** (one was tried and removed; don't add it back). A revision reads **পুনঃদরপত্র / (RE-QUOTATION)**; the revision number still rides at the end of the Ref No. (`…028.51(2)`), never in the title.
- **The numbered terms (দরপত্রের শর্ত সমূহ) are numbered in Bangla digits** — ১. ২. ৩. — via `App\Support\BanglaDigits::from()`, the one place that knows the 0-9 ↔ ০-৯ mapping (`OfficialLetterRenderer` uses it too; it used to hold a private closure). ⚠️ Bangla digits are Bengali codepoints, so **whatever prints them needs the Bangla face** — that number cell carries `font-family: nikosh` explicitly. Tinos has no ০-৯.
- The **Ref No.** label (was "Memo No.") is the top-left of every official letter — `OfficialLetterRenderer` (`$L['memo']`) and the quotation PDF's own memo block. The UI labels on Quotation Create/Show and RFQ Letter Create were renamed to match. The Bangla label stays `নং-`.
- Everything else is **per-centre data** on `centers` (`name_bn`, `ministry_bn`, `government_bn`, `address_bn`, `phone_bn`, `website`, `logo_left_path` = emblem, `logo_right_path` = gear), editable under **Admin → Centers**. `letterhead_color` drives the rule under the block; `caption_en` now only feeds the public portfolio site.

### Official letter format (one renderer for all letters)
- **`app/Services/OfficialLetterRenderer.php`** `buildHtml($d, $lang)` is the SINGLE source of the BITAC letterhead letter body (Bangla + English). Used by the quotation **forwarding letter** and the standalone **RFQ letters** — never re-implement the HTML.
- Layout: Ref No (top-left) / Date (top-right) → Subject → customer Ref → body (justified, no indent, salutation lives in the body) → recipient bottom-left + signatory bottom-right.
- ⚠️ **A signed letter prints the signature image ALONE** — no "Yours faithfully / আপনার বিশ্বস্ত" above it and no **"পক্ষে / For — পরিচালক (কেন্দ্র প্রধান) / Director (Centre Head)"** under it (BITAC, 2026-09-30): the uploaded block already says it. Only an **unsigned** letter prints those two lines around the typed name. Applies to every letter through `OfficialLetterRenderer` — quotation forwarding letter, RFQ letters, the bill's forwarding letter.
- **Signatory ink colour = `#a349a4`** (purple) everywhere (cost estimate, quotation PDF, letters). Labels stay black.
- Bangla = `font-family: siyamrupali` + Bangla digits; English = default font.
- Re-quotation: title is just "RE-QUOTATION" (no `(n)`); revision number appended to the END of the Ref No → `…028.51.(2)`.

### Stakeholder forms go to CLIENTS (2026-09)

- ⚠️ **There is no stakeholder directory.** BITAC's stakeholders *are* their customers, so the separate `stakeholders` table, its model, controller, routes and pages are **gone**. Invitations and responses carry `customer_id`; `StakeholderFormController::distribute` lists **active customers that have an email** (there is nowhere to send the link otherwise), showing the contact person as the name and the company as the organisation.
- The old six categories (Government/Ministry, Academic Partner, Industry Body, Internal…) are replaced by the customer's own **type** (`government` / `private` / unspecified). Anyone who was in the directory but is NOT a customer — a ministry official, an academic partner — no longer has a record to be invited from; that was BITAC's call.
- ⚠️ **Old answers were not orphaned.** The migration matched invitations and responses to customers **by email**, and for anything unmatched copied the person's name and organisation into the `anonymous_*` columns that already existed for public submissions — so every past answer still shows an author. `StakeholderFormResponse::display_name` reads client → invitation's client → `anonymous_name` → "Anonymous".
- ⚠️ That migration is a good example of the **index/foreign-key ordering trap** (the third time in this codebase): the old `(form_id, stakeholder_id)` unique backed the `form_id` foreign key, so the replacement `(form_id, customer_id)` had to be created first; then the stakeholder FK; then the old unique; and only then the column — MySQL will not drop a column an index is still built on. It is idempotent, because a half-applied run cannot be rolled back.

### RFQ Letters module (IED → "Letters")
- Table `rfq_letters`, `RfqLetterController`, `Pages/RfqLetter/{Index,Create}.tsx`. Issue an official letter against an RFQ (RFQ optional — selecting it auto-fills customer ref + recipient). **Direct issue, no approval. Signatory is selectable.** PDF in BN & EN. Entry: "Issue Letter" button on RFQ show + Letters index.
- **Duplicate** (`POST rfq-letters/{rfqLetter}/duplicate`, copy icon on the Letters list) copies a letter into a fresh draft and opens it — the same letter goes out repeatedly with a different recipient or a line changed. It carries the subject, body, recipient block, customer ref, signatory and customer. ⚠️ It deliberately does **not** carry the letter's identity: `letter_no` is left blank (every letter takes its own number from the register — reusing one would put two letters on the same reference), the date is today, status is `draft`, `issued_at`/`emailed_at` are null, and **`signature_path` is null** — carrying the snapshot across would put the signatory's signature on a letter they have not seen. The source is never touched.

### IED Notes — a letter with no pad (2026-09)
> An **internal** note. Same drafting conventions as a letter; it just never leaves BITAC.

- Table `office_notes`, `OfficeNote`, `OfficeNoteController`, `Pages/OfficeNote/{Index,Create}.tsx`, menu **IED → Notes**. **Direct issue, no approval, selectable signatory** — the RFQ Letter conventions. Draft → Issue from one form, **duplicate** into a fresh draft, BN + EN PDF, edit, delete.
- ⚠️ **It prints on plain LEGAL paper (8.5″ × 14″) with NO letterhead** — no emblem, no gear, no centre block, no rule, no footer. `BitacLetterhead` always sets a header/footer and was hard-wired to A4, so notes go through **`BitacLetterhead::renderPlain($bodyHtml, $title, $format, $marginMm)`**: the same mPDF instance, the same Tinos + Nikosh registration and `stylesheetCss()` (so Bangla shaping, `.lang_bn` and the Bangla digits all behave identically), but no header/footer callback and a caller-supplied page size. `buildMpdf($title, $overrides = [])` now takes overrides instead of hard-coding the format and the stretched top margin — **don't** re-hard-code them.
- Because there is no pad, **the sheet names the office itself**: centre name (Bangla or English by `?lang=`), then **অফিস নোট**, then নং / তারিখ, প্রতি, বিষয়, body, signature bottom-right. A plain sheet with no header would otherwise say nothing about where it came from.
- The **`SignaturePicker` shows the chosen SIGNATORY's blocks, not the drafter's** (`formProps` ships each user's signatures) — a note is routinely written by one person and signed by another. Same rule as RFQ letters; `SignatureResolver` still refuses an id that isn't the signatory's.
- **Duplicate** carries subject, body, recipient and signatory; it deliberately drops `note_no` (own number from the register), `signature_path` and `issued_at`.
- ⚠️ When counting pictures in a rendered note to prove there's no letterhead: an **alpha PNG brings its own `/SMask` object, which is itself an `/Subtype /Image`**. Count only images that nothing references as a mask, or a single signature reads as two.
- `office_notes` is transactional → in `SystemResetController::TABLES_TO_WIPE` + `Reset.tsx`.

### Envelope printing (IED → Envelope, 2026-09)
- **Nothing is stored — there is no envelopes table.** An envelope is not a document; it is the same two addresses on a different piece of paper, and the letter or note it travels with is already on record. `EnvelopeController@index` renders the form, `@pdf` renders the envelope straight from the query string. Don't "improve" this by persisting envelopes.
- **Sizes live in `config/envelopes.php`** — key → `label`, `size` (mm), `to_pt`, `from_pt`. ⚠️ The four entries are **provisional** (9″×4″, 10″×4.5″, 10″×12″, 12″×16″); BITAC will confirm what they actually buy. Correcting that file is the whole change — the picker, the size swatch and the PDF all read it. A big document envelope needs bigger type than a letter envelope, which is why the point sizes are per size and not global.
- Uses `BitacLetterhead::renderPlain()` with the chosen `format`, so Bangla shaping comes along for free. From top-left (small, optional national emblem from the centre's `logo_left_path`), To in the lower-right half (large, bold) with an optional **Reference** line under it so a returned envelope can be traced back. BN + EN; switching language swaps the prefilled sender block unless it has been overtyped.
- **Two entry points, both asked for:** the standalone page, and an envelope icon on each row of **Letters** and **Notes** (`/envelopes?rfq_letter=N` / `?office_note=N`) which prefills the recipient and the Ref No. A letter with an empty `recipient_block` falls back to the customer's name and address — the same thing the letter itself prints.
- ⚠️ **Decoding a PDF to check its text: mPDF writes letter-spaced runs as a `TJ` array, not `Tj`.** A `Tj`-only reader loses them silently and it reads as "the text is missing" when it is on the page — that is exactly what happened to the To/From labels here. The scratchpad decoder handles both.

### The bill's forwarding letter, and the three that travel together (2026-09)
- **Billing & Accounts → a bill → Forwarding Letter** (`invoices/{invoice}/letter`, page `Invoice/Letter.tsx`, PDF at `/letter/pdf?lang=bn|en`). Same columns and same meanings as a quotation's, so **`OfficialLetterRenderer` renders both without knowing which it has**: `memo_no`, `forwarding_letter_subject`, `forwarding_letter`, `recipient_block`, `customer_ref_no`/`_date`, `signatory_user_id`, `signature_path`, `letter_issued_at`.
- The Bill page shows a **Documents that travel together** card — forwarding letter · bill · মূসক ৬.৩ — each with its PDF, and **Send to customer** attaches all three (`POST invoices/{invoice}/email`, `DocumentMail`). The **bill always goes**; the letter and the challan go when they exist and the sender asked — a bill with no challan raised yet must still be sendable.
- ⚠️ **`letter_issued_at` is stamped once and never re-dated**, and a save that picks no signature block **keeps the existing `signature_path`** — fixing a typo must not un-sign or re-date a letter that has gone out.
- ⚠️ **The letter endpoint is a full save, not a patch.** The form posts every field, so an omitted field genuinely means "cleared". Don't PUT a subset.
- `InvoiceController@downloadPdf` gained `?preview=base64`, so `PdfPopupModal` can show the bill and `email()` can reuse the generator instead of a second copy of it.

### The Accounts Officer signs the bill (2026-10-04)
> BITAC: once a bill is generated the accounts desk signs it, and that signature prints on the bill itself.

- **Sign Document** on the bill page (`POST invoices/{invoice}/sign`, `DELETE` to take it off) opens `SignaturePicker` with the signer's own saved blocks, default preselected. Gated by **`permission:create invoices`** — the desk that raises a bill is the desk that signs it, so no new permission. `canSign` is a prop on `Invoice/Show`.
- ⚠️ **It does NOT reuse `signature_path` / `signatory_user_id`.** Those are the **forwarding letter's** (migration 000049), signed by whoever sends the bill out — often a different officer on a different day. The bill carries its own **`accounts_signature_path` / `accounts_signed_by` / `accounts_signed_at`** (migration 000056), or saving the letter would silently re-sign the bill.
- The **PATH is stored, not the `user_signatures` id**, per the signature convention — deleting a block later cannot blank a bill that has gone out. `SignatureResolver::resolve()` does the work, so **picking another officer's block is refused** and falls back to the signer's own default; signing with nothing picked uses the default too.
- The PDF prints it through **`SignatureBlock::html(..., 150pt, 'left')`** in place of the blank space above the **Accounts Officer** rule — image alone, width-sized only, the role label under the rule still prints. Unsigned bills keep the blank so the layout doesn't shift. Verified by counting the pictures in the rendered PDF: 2 (emblem + gear) unsigned → 3 signed → 2 again after removing.
- **Removing is allowed** (`unsign`, behind `confirm()`), because signing the wrong bill or with the wrong block must not be a dead end — the figure is unchanged and it can be signed again. Refusals are redirect + flash.
- ⚠️ Found while here: `Invoice::$fillable` lists **`due_date`, `issued_date`, `payment_terms`** but the `invoices` table has **no such columns** — so the bill page's "Due date" was always blank and any `create()` passing them throws. The due date is **derived** now (see the payment ledger below); the stray `$fillable` entries remain.

## 💵 The payment ledger — advance, part payments, deductions, security (2026-10-04)

> ⚠️ **READ BEFORE TOUCHING ANYTHING ABOUT WHAT A CLIENT OWES.** A bill used to be settled all-or-nothing by `invoices.paid_amount` + a "Mark as Paid" button. BITAC's clients pay an advance before the job, then the due in instalments, and **cut security and tax out of the payment itself**.

### `App\Services\PaymentLedger` is the ONLY place these figures are derived
Three rules, each with a way of being got wrong:

1. **A recoverable deduction does NOT settle the bill.** Security withheld is BITAC's money in the client's hands — it stays in the dues until a release brings it back. **Tax deducted at source DOES settle**, because it reached the treasury on BITAC's behalf against a challan. Get this backwards and either no bill is ever payable, or every retention vanishes from the dues.
2. **An applied advance is not cash.** The `advance` row was the cash; the `advance_applied` row that spends it only moves the pool. Summing both counts the same taka twice.
3. **`invoices.status` is derived, never typed** — kept as a column so lists stay fast, rewritten by `syncInvoiceStatus()` after every change. New status **`partially_paid`** (`status` is already `varchar(30)`).

```
bill settled  = Σ over its payments of (gross − recoverable deductions)
bill due      = total_amount − settled
security held = Σ recoverable deductions − Σ released
cash received = Σ net over kinds ≠ advance_applied
```

### `payments.kind` is what keeps it honest — every row moves cash OR the pool, never both
| kind | cash in | settles a bill | pool |
|---|---|---|---|
| `advance` | ✅ | ❌ | + |
| `against_bill` | ✅ | ✅ | |
| `advance_applied` | ❌ | ✅ | − |
| `security_release` | ✅ | ✅ | |

⚠️ **This is why there is no allocation table.** An advance is taken against the **job** (`work_order_id`, `invoice_id` NULL), and because partial delivery means one job raises **several** bills, applying it writes an `advance_applied` row per bill. `advanceFor($wo)` = Σ`advance` − Σ`advance_applied`, and `applyAdvance` refuses more than is available or more than is due.

### Tables (migration `..._000057`)
- **`payments`** — `customer_id` (required, **`restrictOnDelete`**), `work_order_id`, `invoice_id`, `payment_no` (auto via `Payment::suggestNo()`, **editable + unique**, the gate-pass convention), `kind`, `paid_on`, `gross_amount`, `method`, `bank_branch`, `reference`, `notes`, `recorded_by`.
- **`payment_deductions`** — `deduction_type_id`, `amount`, `note`, **`released_by_payment_id`** (the release is itself a payment, so "security still held" is a plain subtraction).
- **`payment_files`** — bank slip / cheque scan / treasury challan, multiple, each with a label. Optional.
- **`payment_deduction_types`** — master, admin-managed at **Admin → Master Data → Deduction Types**, seeded with BITAC's real list (Security, Performance Security, AIT, উৎসে মূসক, Revenue stamp, Bank charge, LD, Rounding). ⚠️ **NATIONAL, no `HasCenter`** — deliberately like `sectors` and unlike `job_categories`, because "security held across BITAC" has to be one comparable figure. A type in use is **deactivated, not deleted**, and flipping `is_recoverable` on a used type **moves the dues on every bill that used it** — the update flash says so.

### ⚠️ The backfill is the risky part (migration `..._000058`)
Every bill already marked paid would have read **unpaid** on deploy, because the due is now derived and the ledger would be empty. The migration writes **one `against_bill` row per already-paid bill** from `paid_amount`/`paid_at`/`payment_method`/`payment_reference`/`payment_notes`/`marked_paid_by` (a bill flipped to paid with no amount = settled in full), then sets `paid` or `partially_paid`. **Idempotent** (skips bills that already have a payment), numbered `RCV-LEGACY-nnnn`, and it writes with raw `DB` so **no "bill paid" notification storm fires on deploy**. Verified by rolling it back and forward over legacy-shaped rows.
- `invoices.paid_amount` / `paid_at` / `payment_method` / `payment_reference` / `payment_notes` / `marked_paid_by` are now a **read-only legacy snapshot** (the `users.signature_path` shape). `syncInvoiceStatus` keeps `paid_amount`/`paid_at` roughly in step so anything still reading them is not lying, but nothing else writes them.
- ⚠️ **"Mark as Paid" is GONE.** The route survives so old links land on a flash, not a 404. Don't reintroduce a one-shot settle button: the status would be undone by the next recalculation, and it cannot express an advance, a part payment or a deduction. `CustomerNotifyService::invoicePaid` moved **into `syncInvoiceStatus`**, firing only on the transition to `paid` — the one place that knows it happened.

### Guards (all redirect + flash, never `abort()`)
- Deductions > the payment → refused (negative cash).
- Settling **more than is due** → refused, naming the due: "record the excess as an advance on the job". A bill that reads overpaid can never balance.
- Deleting an **advance that has been applied** → refused; undo the applications first, or the pool goes negative while the bills stay settled.
- Releasing a retention **twice** → refused. Releasing is **one line at a time**, because the release settles the bill that line was cut from and a payment row points at one bill.
- Deleting a `security_release` un-stamps its deduction automatically (`nullOnDelete`), so the retention goes back to being held.
- **`Admin\CustomerManagementController@destroy` now refuses a client who has payments** — `payments.customer_id` is `restrictOnDelete` on purpose, and without the guard MySQL would throw a raw constraint error instead of saying why.

### Screens
- **Billing & Accounts → Payments** (`/payments`, `PaymentController`) — every receipt, filters (client / kind / method / date range), totals over the **cash kinds only**. Records the one thing with no bill yet: an **advance** against a job. Payments against a bill are recorded from the bill, where the due is.
- **Billing & Accounts → Receivables** (`/receivables`, `ReceivablesController`) — client-wise **Billed / Settled / Due / Overdue / Security held / Advance in hand / Net receivable** + **ageing** (not due, 1–30, 31–60, 61–90, 90+), drill-down per client to every bill and receipt. ⚠️ Deliberately **not** financial-year scoped — what is outstanding is outstanding, the same reasoning as IED's "Jobs in Pipeline"; the buckets are the time dimension.
- ⚠️ **Receivables is centre-scoped on BOTH the list and the drill-down**, and the drill-down's totals are summed from the same bills it lists — calling `PaymentLedger::forCustomer()` there would answer for every centre and the drill-down would exceed its own row. The **customer portal is the opposite case and uses `forCustomer`**: a client sees their whole account wherever the work was done.
- **Bill page** — a Payments card (Billed / Settled / Security held / Due tiles, the ledger, Record Payment, inline **Apply advance** when the job has one, **Release** per held retention).
- **Customer Portal** — their own payment history with the deductions, and a true outstanding figure. ⚠️ The portal's totals were SQL that counted a whole unpaid bill as outstanding; with instalments that overstates the debt, so it reads the ledger now.
- Shared frontend: `Components/Payment/RecordPaymentModal.tsx` (live **gross − deductions = cash** / **settles on the bill** sum as you type, default-% prefill per type, attachments with labels) and `Components/Payment/PaymentRows.tsx`.

### The printed report (`/receivables/pdf`, 2026-10-04)
- **`App\Services\ReceivablesReportRenderer`** on the BITAC pad, opened from a **Print / PDF** button through `PdfPopupModal` (`?preview=base64`), `?download=1` to save. The print carries the **same filters** as the screen.
- ⚠️ **`ReceivablesController::build()` is now the one place the figures are worked out** — `index()` and `pdf()` both call it. A printed total that disagrees with the screen is the one failure nobody can explain away, and two copies of that loop is exactly how it happens. Verified by comparing the decoded PDF against the screen's own `totals` prop.
- ⚠️ **Landscape (A4-L).** Seven money columns plus a client name do not fit A4 portrait without wrapping, and a receivables figure that wraps cannot be read down a column. `BitacLetterhead::render()` gained an **`$overrides`** parameter for this (`['format' => 'A4-L']`); the letterhead block is laid out in percentages so it follows the wider page. Verified: `/MediaBox` is 842 × 595pt and no text crosses the 18mm margins.
- **Two tables**, because they answer two questions: *Outstanding by client* (Billed / Settled / Due / Overdue / Security held / Advance in hand / Net receivable) and *Ageing of the dues* per client across the buckets. Clients with nothing outstanding are left out of the ageing table.
- ⚠️ **The ageing totals are computed from the rows that survived the filters.** They used to be summed over every bill before filtering, so searching for one client still printed everybody's ageing — a summary contradicting the table under it. Fixed on the screen too.
- ⚠️ **No ৳ sign inside the figure columns.** The symbol is Bangla script, so `autoScriptToLang` wraps any number carrying it in `.lang_bn` and sets it in Nikosh — that column then sits at a different weight and width from its neighbours. The unit is stated once in the subtitle instead.
- A footnote spells out that **Security held is part of the Due, not additional to it**, that **Advance in hand is the client's money**, and that tax deducted at source is not a due. Without it the columns read as separate debts. Three signature rules: Prepared By · Accounts Officer · Director (Centre Head).
- ⚠️ `receivables/pdf` is declared **BEFORE** `receivables/{customer}` — Laravel matches in registration order, so the other way round `pdf` binds as the customer and 404s. (Third time in this codebase; see the PCD release routes.)

### Dates, rounding, access
- ⚠️ **`invoices` has no `due_date` column** (`$fillable` lists one; the column never existed). Ageing and the displayed due date come from `PaymentLedger::dueDateFor()` = issue date + **`CREDIT_DAYS` (30)**. Change that constant, not the call sites.
- `TOLERANCE` is 0.01 — rounding noise, not a debt. A real residue is closed with the seeded **Rounding Adjustment** deduction type, explicitly, rather than a silent threshold.
- Permissions **`view payments` / `record payments` / `delete payments`**, granted in the seeder *and* in migration 000058 (finance-officer gets all three, management gets `view`). ⚠️ **super-admin is deliberately not granted** — `Gate::before` already opens every screen, so the grant would only add notification noise. Deduction types sit behind `manage materials-master`, like sectors.
- `payments` / `payment_deductions` / `payment_files` are transactional → in `SystemResetController::TABLES_TO_WIPE` + `Reset.tsx`, with `payments` in `STORAGE_DIRS_TO_WIPE`. **`payment_deduction_types` is master data and is preserved.**
- ⚠️ Hit again while building: **a `nullable` field that was not sent is ABSENT from the validated array, not null** — `$data['payment_no']` threw a 500 until it became `($data['payment_no'] ?? null) ?:`. Same trap as `DeliveryController@complete`'s `notes`.

### Rich text: tables, and the allow-list that has to match (2026-09)
> ⚠️ **`RichTextEditor` and `App\Support\LetterHtml::ALLOWED` are two halves of one thing.** A tag the toolbar can insert but the allow-list drops is stripped on save and **vanishes from the printed PDF silently**. Change them together.

- The editor gained Word-like controls: paragraph styles and headings, text size, strikethrough, super/subscript, indent/outdent, text colours, links, horizontal rules, undo/redo, and **tables** (insert with or without a header row, add/remove row or column, delete table). Still `contentEditable` + `execCommand`, still no dependency.
- **Table borders are written INLINE by the editor**, not left to a stylesheet, because **mPDF never sees the editor's CSS**. `stylesheetCss()` carries a `.letter-body` fallback so a table pasted in from elsewhere still prints as a table; `OfficialLetterRenderer` and the office-note body both wear that class.
- **One sanitiser for every letter.** `LetterHtml::sanitize()` / `toPrintable()` replaced three copies: `QuotationController::sanitizeLetterHtml`, `RfqLetterController::sanitizeBody` (which had a **narrower** tag list, so a table typed into an RFQ letter was silently stripped while the same table survived in a quotation), and **office notes, which sanitised nothing at all** — a comment claimed the body was "already sanitised on save", which was never true, so a pasted `<script>` went straight into the PDF. Fixed and verified.
- `strip_tags` keeps the attributes of tags it keeps, so the inline `style` on a cell survives; `javascript:` URLs and `on*` handlers are stripped before that.
- ⚠️ **Checking borders in a rendered PDF: mPDF draws them as line strokes (`l` … `S`), not rectangles.** Counting strokes alone proves nothing — the letterhead rule is a stroke too — so compare against the same letter with the table removed (20 vs 3, here).

### Email system (PDF attachments)
- Both RFQ letters and quotations email via a compose modal: **From** (defaults to logged-in user; sets From+Reply-To), **To**, **CC** (comma-sep), **Subject**, **Message** (RichTextEditor → sanitised HTML), attachment language toggle, animated sending overlay.
- Quotation email (`quotations.email` → `emailToCustomer`) attaches **Quotation PDF + Forwarding Letter PDF together** (reuses `pdf()`/`exportForwardingLetterPdf()` via a synthetic `preview=base64` request). Mailables: `RfqLetterMail` (single), `DocumentMail` (multi-attachment).
- **Needs SMTP** — set `MAIL_*` env (in Coolify for prod) or it flashes an error. RichTextEditor now has a Justify button.

### Quotation VAT/Tax model (IMPORTANT — don't add tax "on top")
- Quotation **unit prices are VAT & Tax INCLUSIVE** (mirrors the cost estimate). **Grand Total = Σ line amounts**; VAT/Tax are EMBEDDED and extracted for display only: `base = gross/(1+(vat%+tax%)/100)`. VAT/Tax rates are inherited from the source cost estimate (no manual rate inputs).
- `quotations.show_tax_breakdown` toggle ("Show VAT & Tax to customer"): **ON** → standard tax invoice with **ex-tax line items** + `Subtotal + VAT + Tax = Grand Total`; **OFF** → inclusive line items, Grand Total reads "(incl. VAT & Tax)". Keep 3 calc sites in sync: `store()`, `update()`, `Quotation/Create.tsx`.
- Cost-estimate **`grand_total_override` flows through**: quotation prefills `unit_price = estimate grand_total / job_quantity` so the rounded override is honoured.

### Transactional-data wipe
- `Admin/SystemResetController` (super-admin, "DELETE ALL"). When adding any new transactional table, ALSO add it to `TABLES_TO_WIPE` + the `Reset.tsx` GROUPS display, and any upload dir to `STORAGE_DIRS_TO_WIPE`. Master/config (incl. `qc_checkpoints`, stakeholder form templates) is preserved.

### Deployment (Coolify)
- Dockerfile-based; `docker/entrypoint.sh` auto-runs `migrate --force` + `storage:link` + caches on boot, and Dockerfile builds Vite assets. `git push` → Coolify rebuilds/redeploys (migrations apply automatically). App is a **PWA** — hard-refresh (Ctrl+Shift+R) after deploy to bust the cached bundle. See `docs/DEPLOYMENT.md`.

## 🏭 Production Module Extension (multi-phase — IN PROGRESS, 2026-06)

> Big initiative: move production from all-or-nothing section status → **quantity-based WIP flow** with sub-sections, daily logs, and partial forwarding. Approved design decisions: extend operation-steps as the "leg" (add sub_section_id + qty), **sequential** sub-sections, **per-item weightage sums to 100**, **section-level partial forward**. UI must stay clean/organized (many features landing on the Production section).

> **Sub-section ownership rule (IMPORTANT):** PCD only routes a job to the **top-level shop** (Section). The **shop in-charge** decides which **sub-section** does each step *after* the job arrives — NOT PCD. So: op-sheet Builder has NO sub-section field; the assignment lives on **Production Show** (per step). Sub-sections now HAVE their own queues (see Phase 6) — they nest under the parent shop in the sidebar, they never flatten.

### Phase 6 — Sub-section queues (own supervisor per sub-section) (done)
- Model: **shop oversees, sub-section logs.** A shop in-charge sees the whole shop (assigns sub-sections, transfers/handoffs); each sub-section supervisor sees ONLY their assigned steps and logs output on them.
- **Sidebar** (`productionSections`, `navigation.ts`): shops with their sub-sections **nested/indented** ("↳ name"). Super-admin sees all; a shop supervisor sees their shop + subs; a **sub-section supervisor** (user.section_id = a child section) sees just their sub-section. Badge counts: shop = items with any open step there; sub-section = items with an open step **assigned** to it.
- **Queue** (`ProductionController@queue`): if the selected section has a `parent_id` it's a sub-section → **step-based queue** (`expandWosForSubSection`) drawn from the PARENT shop's active WOS, filtered to steps with that `sub_section_id`. Top-level shop → normal WOS queue. Switcher (`available_sections`) lists shops + subs nested. Upcoming Jobs only for top-level shops. Queue rows carry `sub_section_id` so "Open" links append `?sub_section=`.
- **Production Show** (`?sub_section=X`, or auto for a sub-section supervisor via `viewerSubSectionFor`): op_items steps filtered to that sub-section; header shows a sub-section badge; the **Actions card hides shop-level buttons** (Transfer / Send Back / Flag Bottleneck → "handled by the shop in-charge") and the per-step **Assign sub-section** select is hidden. `authorizeAccess` now also allows a sub-section supervisor onto their parent shop's WOS.
- **Delivery challan qty:** `DeliveryChallanService` shows the **delivered** qty (`delivery.quantity_delivered`) for a single-item job, not the full ordered qty (was a bug — challan printed 10 for a 5-pc delivery). Multi-item per-line partial delivery is still future.
- **QC → Delivery gate (clarity):** QC's "Type" column is the inspection **Stage** (Incoming / In-Process / **Final**) — renamed from "Type"; Final is the strong green badge. A WO only becomes `qc_passed` (→ shows in Delivery Order create, which filters `qc_passed`/`ready_for_delivery`) after a **passing Final** inspection on every sheet — an In-Process pass does NOT release it. Delivery create shows an amber hint when no jobs are ready. (Partial QC/partial delivery per the partial-quantity principle is a FUTURE phase — currently QC/delivery act on the whole WO.)
- **Transfer to QC / non-production stops:** `transfer()` no longer SKIPS a non-production next section (old bug: QC got `skipped` and the pieces vanished). The immediate next routing section — shop OR QC — receives the qty (`received_qty += qty`, pending/skipped → `ready`); if it's a QC/non-production section the WO is set to `qc_hold` so the /qc module engages (partial QC = future). Badge counts are **actionable-only**: an item counts for a shop/sub-section only if it has an open step with input still available (`min(target, received/prev-op-completed) − completed > 0`) — a shop that finished everything it received drops off the badge until more is transferred in.
- **Intra-shop sequential flow (implicit):** operations within a shop run in order — a step can only work up to its **input cap** = the PREVIOUS operation's completed qty (first op = the shop's `received_qty`; null = ungated). So sub-sections flow Welding→Grinding→Fitting automatically, partially, with NO manual sub-section→sub-section transfer (that only happens cross-shop, by the shop in-charge). `packStep` ships `input_cap` per step (`capForSheet` maps it from the ordered shop steps); `logProduction` enforces it (`inputCap = prev step completed_qty ?? shop received`), erroring "Waiting on the previous operation (…)" when the previous op is behind. Production Show step display (`effTarget = min(target, input_cap)`, "N left", Log-Output max/disable) uses `input_cap`. This realises the **partial-everything principle** one level down; the shop's output (min completed across its ops = last op) still feeds the cross-shop Transfer.

**Phases:** 1) Sub-section foundation ✅ · 2) Quantity model + daily log + qty-based progress ✅ · 2.5) Section-level weightage ✅ · 3) Partial forward (section qty ledger, explicit transfer, no auto-forward) ✅ · 3.5) Upcoming Jobs ✅ · 4) Production-cycle page + machine-running state + progress/PDF sync ✅ · 5) Reroute + bottleneck flag ✅ · 6) Sub-section queues (own supervisor per sub-section) ✅ · 7) Partial QC + partial Delivery ✅ · 8) Shop chain of command (XEN → AE forward/receive) ✅.

### Phase 8 — the shop's own chain of command: XEN → AE (2026-10-04)

> BITAC's shops run a **নির্বাহী প্রকৌশলী** over assistant engineers. A job reaching a shop is his; he reads it and hands it to one of his AEs — or straight to a sub-section — and the AE **receives** it before doing anything with it.

- Work arriving at a shop used to be everybody's at once: anyone whose `users.section_id` was the shop saw all of it and could do all of it. There was no person layer *inside* a shop at all, only shop vs sub-section.
- **`work_order_sections`** gained `assigned_to` / `assigned_by` / `assigned_at` / `received_at` / `assign_note` (migration `..._000060`). The unit of assignment is **the job at that shop** — one AE owns it there, and he assigns the sub-sections per step as before.
- ⚠️ **Who is the XEN is decided by the permission `assign shop-jobs`**, not by a column. Whoever holds it at a shop is the XEN; everyone else posted to the shop is an AE. A shop can have two XENs, and nothing has to be kept in step with a `supervisor_id` that someone forgets to update when a person moves. Granted to **`shop-incharge`**; **not** to `super-admin` (`Gate::before` already lets them past, and holding it would make them the XEN of every shop).
- ⚠️ **A shop with NO XEN behaves exactly as it always did.** `ShopAssignment::gateActive()` is false and every rule lets everyone through, so a shop whose staff were never given the role cannot wake up to an empty queue, and in-flight jobs (which carry `assigned_to = null`) keep working. Same deliberate shape as an empty quotation approval chain.

**`App\Services\ShopAssignment` is the one place that knows the rules.** `workBlocker()` returns three *different* answers, and they are different facts: the job has not been handed to anyone, the job is somebody else's, or it has been handed over but not taken in hand. `canOversee()` answers the shop-level acts, `scopedToOwnWork()` narrows a queue.

- **`POST production/wos/{wos}/forward`** — `mode=engineer` (sets `assigned_to`, clears `received_at`, notifies the AE) or `mode=sub_section` (puts every open step of this job on that bench). ⚠️ It refuses a person **not posted to this shop** and a sub-section **belonging to another shop** — otherwise a job could be pushed onto someone else's bench by guessing an id.
- **`POST .../receive`** — the AE takes it in hand; the XEN is told. ⚠️ **Logging output and assigning a sub-section are blocked until he does**, because handed over and taken in hand are different facts and the shop needs both. Only for *assigned* jobs — an unassigned or legacy job is untouched.
- **`POST .../hand-back`** — a **reason is required**; a job coming back with no explanation is one that gets lost (same rule as a work order sent back from PCD). It returns to the XEN, who is notified.
- **Transfer / Complete-rework / Send back / Flag bottleneck stay the shop's own acts** — `canOversee()`, not the AE holding one job.
- **Queue**: an AE sees only what was forwarded to him ("Your Jobs") and is offered no Forward and no Upcoming list; the XEN sees everything plus "*N waiting with you to forward*". Each row badges who holds it and whether they have received it.
- **Production Show** carries `Components/Production/ShopHandover.tsx` — the band saying who holds it, with Forward / Receive / Hand back, and the blocker spelled out in plain words. ⚠️ It renders **nothing** when the shop does not work this way, and is hidden in a sub-section view (the bench works to its steps; the handover is not about it).
- ⚠️ Found while building: the stylesheet defines only `badge-amber|blue|green|purple|red|slate`. `badge-indigo` and `badge-emerald` render as unstyled spans — grep the built CSS after adding one.

#### AE and SAE are the same thing to the system (2026-10-06)
> BITAC: *"AE r SAE eder alada kono layer nai"* — a job reaches the in-charge, who sends it to an AE for sub-section assignment **or assigns the sub-section himself**; the AE assigns the sub-section and logs the output, **or passes it to his SAE** to do either.

- ⚠️ **There is no third layer, deliberately.** `Assistant Engineer (Shop)` and **`Sub-Assistant Engineer (Shop)`** (migration `..._000062`) carry **identical permissions**; the two roles exist only so the admin can assign by the designation a person actually holds, the way `Executive Engineer (PCD)` / `Assistant Engineer (PCD)` read on the Users screen. Both are "posted to the shop and not the XEN", so `ShopAssignment::assistants()` picks them up with no special case. Neither holds `assign shop-jobs`.
- **The rule is "whoever holds a job may pass it on"** — `ShopAssignment::canForward()` = the XEN, **or the current assignee**. One rule instead of a hierarchy to keep in step. Receiving first is **not** required to forward: forwarding is not working on the job.
- ⚠️ **Sending the WHOLE job to a sub-section stays the XEN's call** (`can_send_to_sub`) because it moves every open step at once. An AE assigns a sub-section **per operation** on the job page, which is the normal path — and that assignment **survives being passed on**, so "AE assigns the bench, SAE logs the output" works exactly as described.
- ⚠️ **A hand-back goes to whoever forwarded it** (`ShopAssignment::handBackTarget()`) — an SAE returns the job to his AE, not over the AE's head to the নির্বাহী প্রকৌশলী. It lands with the XEN only when the forwarder *was* the XEN, or has left the shop.
- ⚠️ **An engineer's queue also shows what he passed on** (`assigned_by = me`), badged with who holds it now. An AE who gave a job to his SAE still answers for it, so it must not vanish off his list.

### What a shop engineer may see on a Job (2026-10-06)
> He holds `view work-orders` so he can read the job he is working on. That must not hand him the money on it, nor actions belonging to PCD or procurement.

- ⚠️ **The whole `work-orders` resource sat behind `view work-orders` alone** — a permission nearly every role holds — so a shop engineer, a QC inspector or a sales officer could **create, edit or delete a work order**. The narrower permissions already existed (`create work-orders` / `edit work-orders`, both super-admin) and were simply not used. The resource is split across all three now.
- ⚠️ **`create`/`store` must be registered BEFORE `index`/`show`.** Laravel matches in registration order, so with `work-orders/{work_order}` first, `/work-orders/create` binds "create" as the work order and 404s — **for everyone, super admin included**. Caught by the test, which expected a 403 and got a 404. (Fourth time in this codebase; see the receivables PDF and the PCD release routes.)
- ⚠️ **The customer's price is withheld from the PAYLOAD, not hidden in the UI.** `workOrder.quotation` is only serialised when the viewer holds `view quotations`. Hiding the card still ships the figure in the page source, where anyone can read it — the test asserts the amount does not appear in the Inertia JSON at all.
- The Actions card gates each button on **the permission its own route demands**, so a button is never offered to someone the server would turn away: **Production Cycle** `view production` (the shop's own view), **Reroute Sections** `view pcd-inbox`, **Run MRP** `view mrp`. **New Job** on the list is gated on `create work-orders`.
- ⚠️ **The status-transition buttons were removed: they posted to `/work-orders/{id}/transition`, a route that does not exist**, so every one of them 404'd. A job's status is moved by the act that moves it — PCD releasing it, the shop transferring, QC passing it, a delivery being confirmed — not by typing a status on this page. **Approve WO** has a real route and stays.

### What came with the job — Documents on the shop's job page (2026-10-06)
- The job page carries a **Documents** card: **the work order PCD issued** (its routing sheet PDF) and **what the client sent in** — drawings and sample photos off the RFQ item, per job item, as thumbnails for images and labelled tiles for anything else. The shop should not have to go looking for either.
- ⚠️ **`work-orders/{workOrder}/sheet-pdf` is a deliberate SECOND door onto the work order PDF.** PCD's own `pcd.work-orders.pdf` is gated by `view pcd-inbox`, which **nobody on the shop floor holds** — linking straight at it hands them a document they cannot open. Same controller, same generator, gated by `view work-orders`: whoever may read the job may print its work order. Verified: PCD's door still 403s for the shop, the new one returns 200, and **both render byte-identical PDFs**. (The production op-sheet PDF has exactly this shape — don't "tidy" either away.)
- Drawings are `rfq_items.drawings` (`type = drawing`) and samples `samplePhotos` (`type = sample_photo`); a file is treated as an image by extension, so a **PDF drawing gets a labelled tile, not a broken `<img>`**. Items with no file are dropped, so the card never shows empty rows.
- ⚠️ A local database may have **no `rfq_items` and no `work_order_items` at all**, so this packing is not exercised by whatever happens to be lying around — the test builds the RFQ item, the job item and both files itself, and tears them down.

### A department menu must mean department membership (2026-10-06)
> Twice now a shop engineer's sidebar grew a **PCD** group with one item under it, because a permission he legitimately held was the gate on an item that lived in PCD's menu. The menu was telling him — and anyone looking over his shoulder — that he had PCD access.

- **Maintenance Requests** was gated on `submit maintenance-requests` inside the PCD group → now its own **Maintenance** group.
- **Jobs** (`/work-orders`) was gated on **`view work-orders`**, which nearly every role holds — the shop engineers, QC, sales, procurement. They all got a one-item PCD menu. PCD's entry is now gated on **PCD membership** (`permissionAny: view pcd-inbox | review pcd-inbox | create material-requisitions`), which still covers `pcd-officer`, both PCD engineers and `management`.
- The shop reaches the same screen through **its own menu**: a static **Jobs** item in the **Production** group gated on **`view production`** — held by `shop-incharge`, the AE/SAE shop roles and `section_supervisor`, and by nobody in PCD. (`flatGroups()` PREPENDS the dynamic section queues to that group's own items, so a static entry survives.)
- ⚠️ **Nobody lost a permission**, only a menu entry they should not have had: QC, sales and procurement still hold `view work-orders`, so every in-app link to a job still works for them. A super admin holds both gates and so sees Jobs twice — that is the whole cost, and it affects nobody else.
- **The rule:** gate a nav item on *being in that department*, not on *being able to open the screen*. The two are different, and only the first belongs in a menu heading.

### Maintenance is its own module, not part of PCD (2026-10-06)
- ⚠️ **Maintenance Requests used to sit in the PCD sidebar group.** The moment `shop-incharge` was given `submit maintenance-requests`, a **PCD** menu appeared in the shop in-charge's sidebar with a single item under it — which reads as "the in-charge has been handed PCD access". He had not been; the menu was lying about him.
- It is now its own group, **Maintenance**, placed after Production: a request comes from the shop floor, management approves it (`approve maintenance-requests`) and maintenance performs it (`perform maintenance`). It was never PCD's.
- ⚠️ **The list and a request's page had NO permission middleware at all** — any signed-in user could open them. They are gated now on the maintenance vocabulary that already existed, as an OR: `submit maintenance-requests|approve maintenance-requests|perform maintenance|view maintenance-requests`. Each action inside keeps its own tighter gate. Verified: the shop in-charge and management open it, a QC inspector no longer does, and the in-charge still gets 403 on both PCD screens — the sidebar now says the same thing the gates do.

### The section picker says which is a shop and which is a bench (2026-10-06)
- ⚠️ **A flat list of sections is unreadable once sub-sections exist.** Nothing on the row said whether "Milling Section" was a shop or a bench inside one — and posting a person to the wrong level changes what they can do entirely: **shop** = the in-charge and his AE/SAE (the whole shop, forward/receive), **sub-section** = that bench's steps only.
- **`Section::hierarchicalOptions()`** is the one list: active shops each immediately followed by its own sub-sections, carrying `parent_id` + **`parent_name`** so a flat `<select>` can say so. `Admin\UserController` (create + edit) and `Admin\MachineController` both call it — the ordering logic used to live only in the machine controller, so the user form never had it.
- ⚠️ **An `<optgroup>` is wrong here**: the parent must stay **selectable**, because a shop's XEN and his engineers are posted to the shop itself. Sub-sections are indented with **real non-breaking spaces** (a plain space collapses inside `<option>`) and read `↳ Name (CODE) — under Parent`, the same convention the machine form already used.
- The hint under the field spells out the choice, because the field itself cannot: post to the **shop** for the in-charge and his AE / SAE, to an indented **↳ sub-section** only for whoever runs that bench.
- A sub-section whose parent is inactive is still appended rather than dropped, so it cannot silently vanish from the picker.

#### Which roles a shop's people need (migration `..._000061`)
⚠️ **Every `/production/*` route is behind `permission:view production`** — the queue, a job's page, forward, receive, transfer, logging output, all of it. `shop-incharge` did **not** hold it, so migration 000060 made the নির্বাহী প্রকৌশলী the XEN of his shop while leaving him unable to open the screen where that means anything. Only `super-admin` and `section_supervisor` held it, and `section_supervisor` was meant for a *sub-section's* supervisor.

| Role | Holds | Is |
|---|---|---|
| **`shop-incharge`** | the old shop set **+ `view production` + `submit maintenance-requests` + `assign shop-jobs`** | the **XEN** |
| **`Assistant Engineer (Shop)`** (new) | `view dashboard`, `view production`, `view work-orders`, `submit maintenance-requests` | an **AE** |

- ⚠️ **`Assistant Engineer (Shop)` deliberately does NOT hold `assign shop-jobs`** — that permission *is* the definition of who the XEN is, so granting it would make every assistant a XEN and the forward/receive flow would quietly do nothing.
- **Both are posted to the SHOP** by `users.section_id` (not to a sub-section). A sub-section's own supervisor keeps `section_supervisor` + `section_id` = the bench, and is untouched by any of this.
- **AE1 / AE2 / AE3 are people, not roles.** The Forward dialog lists whoever is posted to the shop and is not a XEN, so a shop with five assistants needs no change.
- The migration uses `givePermissionTo`, not `syncPermissions`, so a re-run cannot strip something an admin added by hand. Its `down()` **refuses to delete the assistant role while anyone is on it** — rolling back must not quietly unassign real people from their job. Verified both ways.
- ⚠️ The test suite now assigns the **real roles** rather than hand-granting permissions, which is the only thing that proves the roles are usable. It would have caught this gap on the day.

### Phase 7 — Partial QC + Partial Delivery (done)
- **Principle:** QC and Delivery are now quantity-tracked, not whole-WO. A 5-of-10 QC pass releases only 5; a 5-of-10 delivery leaves the job **Partially Delivered**, not Delivered.
- **WO qty ledger (`WorkOrder`):** `qcPassedQty()` (Σ `qc_inspections.qty_passed` for pass/conditional; fully-QC'd statuses = full order for legacy), `deliveredQty()` (Σ delivered DOs' `quantity_delivered`), `committedDeliveryQty()` (scheduled+delivered), `deliverableQty()` = qcPassed − committed. New WO status **`partially_delivered`** (amber; label/color + frontend badge maps in WorkOrder Index/Show).
- **QC:** the New Inspection form now has a **Quantity Passed** field (`qty_passed`, defaults to the item qty). `QcController::reconcileWorkOrderStatus` is qty-based — WO → `qc_passed` only when `qcPassedQty ≥ ordered`; a partial pass leaves the status (still deliverable via the ledger).
- **Delivery:** `DeliveryController::create` lists any WO with `deliverableQty > 0` (incl. `qc_hold`/`partially_delivered`), each showing "X of Y ready"; `store` caps `quantity_delivered ≤ deliverableQty`; `complete` sets WO **`delivered` only when `deliveredQty ≥ ordered`, else `partially_delivered`**. Create form defaults/caps qty to the WO's deliverable + shows availability. Each delivery still makes its own (partial) invoice + challan (challan already shows `quantity_delivered`).
- **Progress:** `production_progress` does NOT force 100 for `partially_delivered` (falls through to section-weighted, ~qty fraction), so the Jobs list shows real progress, not a false 100%.
- **Note:** WOs delivered under the OLD whole-WO logic keep status `delivered`; test partial with a fresh WO.

### Phase 5 — Rerouting + shop bottleneck flag (done)
- **Problem:** a job arrives at a section whose machines/manpower are busy → job sits idle. Fix = let the shop flag it and PCD reroute so a free section works first (only when operations aren't dependent — a human decides).
- **Shop bottleneck flag:** `work_order_sections.bottleneck_at/bottleneck_reason/bottleneck_by`. Production Show has a **"Flag Bottleneck"** button (reason modal) → `ProductionController@flagBottleneck` (route `production.wos.bottleneck`); a banner shows on the WOS with a **Clear flag** (`@clearBottleneck`, DELETE same name `.clear`).
- **PCD reroute:** `WorkOrderSectionController@rerouteForm`/`@reroute` (routes `pcd.reroute.form` GET / `pcd.reroute` PUT), page `resources/js/Pages/Pcd/Reroute.tsx` (up/down reorder). Only **pristine** sections reorder — `WorkOrderSection::isReorderable()` = pending/ready AND nothing received/forwarded/produced; completed/in-progress/fed sections are LOCKED (kept at front). After resequencing it recomputes pristine statuses (entry / fed-by-completed → `ready`, rest → `pending`) and clears bottleneck flags. Unlike `@update` (initial setup) it does NOT wipe — it preserves in-flight ledger.
- **Entry points:** WorkOrder detail shows a **bottleneck banner** (`bottlenecks` prop) + "Reroute" button, and an always-available "Reroute Sections" action. Received-gating (`effectiveReceivedQty`, `isFirstInRouting`) auto-adapts to the new order — the new entry section becomes ungated (raw material), downstream stays gated until fed.
- **Not built (deferred):** parallel/DAG routing (multiple sections active at once) — sequential model kept.

### Phase 4 — Production Cycle page + machine state + PDF sync (done)
- **Production Cycle page** (`resources/js/Pages/Production/Cycle.tsx`, route `production.cycle` = `/production/work-orders/{wo}/cycle`, `ProductionController@cycle`): a read-only holistic timeline of a WO — overall section-weighted progress bar + one card per routing section (weight %, status, qty ledger Received/Completed/Forwarded, progress bar, per-operation rows with item label + machine + operator + qty + daily logs, forward handoffs with qty) + a **Machine Usage** table (qty & hours per machine from `production_logs`). Entry links: Production Show header ("Full cycle") + WorkOrder Show actions ("Production Cycle").
- **Machine running-state auto-wired:** `Machine.current_state` already existed; `ProductionController::syncMachineStates()` now reconciles it after log/delete/transfer — a machine is `running` while it has any in-progress operation step, else `idle`. **Manual states (maintenance/breakdown/offline/setup) are never overwritten.** Admin Machines list shows the live state badge + "Job# …" it's running (`running_jobs` from in-progress steps).
- **Progress sync:** every surface (Dashboard, WO list, WO detail per-item, Customer portal, IED jobs, AI ToolRegistry) delegates to `WorkOrder::production_progress` (section-weighted) — single source. **No PDF shows a progress %**, but the **Work Order routing PDF now has a Weightage column** (`WorkOrderSectionController@pdf`) so the printed form matches PCD's assigned section weights.

### Phase 3.5 — Upcoming Jobs (done)
- `ProductionController@queue` now also returns **`upcoming`** — WOS at this section still `pending` while an EARLIER section is active (`in_progress`/`rework`/`ready`), i.e. jobs heading this way but not yet transferred here. Each row: current location (nearest active upstream section), `stops_away`, qty, due, overall `production_progress`. Sorted by `stops_away`.
- **Production Queue page** renders an **"Upcoming Jobs"** card under Active Jobs (distance chip "N stops away", "Now at <section>", View → WO detail). Lets a supervisor plan machines/material ahead.

### Phase 3 — Partial forward + NO auto-forward (done) — IMPORTANT
- **Logging output NEVER advances the job anymore.** `logProduction`/`deleteProductionLog` no longer call `syncWoSectionStatuses` — they only record completion at the current section. (`syncWoSectionStatuses` still exists for the legacy no-target Start/Complete `markStep` path.)
- **Section qty ledger** on `work_order_sections`: `received_qty` (nullable — how much arrived from upstream; **null = ungated**, i.e. the first/raw-material section) + `forwarded_qty` (how much already sent on). `section_handoffs.qty` records each partial transfer.
- **Explicit transfer** = the ONLY way a job advances: `ProductionController@transfer` (route `production.transfer`). Forwardable = `WorkOrderSection::forwardableQty()` = section output (min completed_qty across the section's steps) − forwarded_qty. Transfer bumps this section's `forwarded_qty`, sets the next production section's `received_qty += qty` and status pending→ready, writes a forward handoff with qty. Section auto-**completes** only when `forwarded_qty ≥ sectionTargetQty()`; last section fully forwarded → WO `qc_hold`.
- **Downstream gating:** `logProduction` caps qty by `effectiveReceivedQty()` (null=ungated first section; downstream with nothing received = 0 → blocked with a "not received enough" message). Model helpers: `sectionSteps/sectionOutputQty/sectionTargetQty/forwardableQty/isFirstInRouting/effectiveReceivedQty`.
- **Don't lose done-but-unforwarded jobs:** the shop queue (`expandWosForQueue`) keeps showing a WOS while it has **`forwardableQty() > 0`** even after every op is `completed` (else the in-charge can't find it to Transfer). Such rows carry `ready_to_transfer` → the Queue shows a "Ready to transfer" badge. (Sub-section queues don't — transfer is the shop's job, so a sub-section's completed step correctly leaves its queue.)
- **Queue visibility** (`expandWosForQueue`) now shows an item at a section when the WOS is active AND the item has any **open step there** — no longer gated on the single "current step", so an item can be at two sections at once (partial flow). Availability is gated upstream by the transfer that sets the WOS `ready` + `received_qty`. The **sidebar badge count** (`HandleInertiaRequests`) uses the SAME open-step rule so counts match the queue.
- **Received-cap display:** a downstream section shows quantities capped by what it RECEIVED, not the full item qty. Production Show step rows use `effTarget = min(target_qty, received_qty)` for the progress bar / "N left" / Log-Output max (with "(of X total)" hint); the Log Output button disables when all received pieces are done ("waiting for transfer"). Queue rows + the op-item block header show "Received 5 / 10" when gated. `serializeWosForQueue` ships `received_qty`; Production Show ships it on `wos`.
- **Production Show layout (2-column):** full-width header (job info + flow ledger, no action buttons) + banners, then a `lg:grid-cols-3` grid — **left (col-span-2):** Routing, Operations, Queries, Handoff History; **right sidebar:** an **Actions** card (Transfer/Complete-Rework, Send Back, Flag Bottleneck, Request Maintenance, Full Cycle, Back to Queue — all `w-full`) + a **Documents** card (per-item **View Operation Sheet** yellow button + **Reference — drawings & samples** chips; `docItems` = op_items with a sheet or references).
- **Production Show:** header has a **flow ledger** (Received / Completed here / Transferred / Ready to transfer) + a **Transfer** button (partial qty modal, default = forwardable; "Transfer & Send to QC" on the last section). Rework still uses the old Complete-Rework path. Log form: "Produced"→**Completed**, machine/operator marked **optional**. Handoff history shows the transferred **N pcs** badge. Each item block header has a **yellow "View Operation Sheet"** button → opens the op-sheet PDF in `PdfPopupModal` (via `production.op-sheet.pdf?preview=base64`; route delegates to `OperationSheetController@pdf` but gated by `view production` so the shop floor can open it without op-sheet view rights). Below the header, a **Reference — drawings & samples** strip shows the RFQ item's `drawings`/`samplePhotos` (loaded via `items.rfqItem.drawings/samplePhotos`, packed as `op_items[].references[]` with `is_image`/`kind`) as thumbnails/chips with **View + Download**. The live "running" timer is hidden for qty-mode steps (only legacy Start/Complete steps show it).
- **PCD assigns section weight** on the routing page (Phase 2.5); operations are qty-only.

### Phase 2.5 — Section-level weightage (done) — IMPORTANT, replaced per-operation weight
- **Weightage now lives on the SECTION, not the operation.** `work_order_sections.weight_pct` (decimal, sums to 100 across a WO's routing). The old confusing per-operation `operation_steps.weight_pct` is no longer used/displayed (column kept for back-compat; defaults 0).
- **PCD assigns it on the Work Order routing page** (`Pcd/SectionAssign.tsx`): each routing row has a **Weightage %** column + an **Auto-balance** button + a running **Σ total** badge (green at 100). `WorkOrderSectionController@update` validates `sections.*.weight_pct` and persists; `@edit` ships current weights.
- **Operations are tracked by QUANTITY only** (Phase 2 Target Qty). Op-sheet Builder's per-step weight field + "Equal Split" summary were **removed**.
- **Progress rollup (single source = `WorkOrder::getProductionProgressAttribute`):** section completion = `WorkOrderSection::progressFraction()` (qty-average of that section's operation steps, status fallback for stepless sections e.g. QC). Job progress = `Σ(section_weight × section_fraction) / Σ(section_weight)` (equal-weight when no weights set). `WorkOrder::sectionProgressBreakdown()` returns per-section rows. **DashboardController, WorkOrderController (list), ToolRegistry now all delegate to `$wo->production_progress`** (don't re-implement). `WorkOrderController::packSheetForShow` per-item pct = avg(progressFraction).
- **Production Show:** the confusing per-operation "33.3% of progress" stamp is **gone**; the header shows one **"X% of job · Y% done"** violet badge (section weight + section completion) from `wos.weight_pct` / `wos.section_progress`. Operations show only the qty bar.

### Phase 2 — Quantity model + daily log (done)
- `operation_steps` IS the production "leg": added `sub_section_id` (FK sections), `target_qty` (defaults to item qty at op-sheet create/update), `completed_qty` (denormalised, kept in sync). `OperationStep::progressFraction()` = completed_qty/target_qty (status fallback when no target). `remaining_qty` accessor.
- New `production_logs` table + `ProductionLog` model — daily, item-wise output (qty, machine, operator, date, hours, remarks). Drives completed_qty.
- **Op-sheet Builder (PCD):** per step has a **Target Qty** input (defaults to item qty). **No sub-section field** — PCD routes to the shop only (see ownership rule above). Machines scope to the section.
- **Production Show (shop):** each step has an inline **"Assign sub-section…" select** (shown when the shop has sub-sections and the WOS is active) → `ProductionController@assignSubSection` (route `production.op-steps.assign-sub`), validates the chosen sub-section is a child of the step's shop, sets `operation_steps.sub_section_id`. This is where the in-charge decides the sub-shop after arrival.
- **Production Show:** each step shows a **qty progress bar** (produced/target/left) + **"Log Output"** form (qty ≤ remaining, machine, operator, date, remarks) + **log history** (delete rolls back). `ProductionController@logProduction` / `@deleteProductionLog` (routes `production.op-steps.log`, `production.logs.destroy`) bump completed_qty, set step status (in_progress / completed when target met), re-run `syncWoSectionStatuses` so finished work advances. Qty-mode steps (target>0) replace the old Start/Complete buttons; legacy/no-target steps keep them.
- **Progress is now quantity-aware** everywhere (per-step `progressFraction()`); the overall WO rollup was later changed to section-weighted — see Phase 2.5.

### Phase 1 — Sub-sections (done)
- `sections.parent_id` (self-FK, **one level deep**). `Section`: `parent()`/`children()`, scopes `topLevel()`/`subSections()`, `isSubSection()`. A sub-section is always `type=production_shop`.
- `Admin/SectionController` shows sections as a one-level tree (parent then its sub-sections), validates parent must be a top-level production shop, blocks deleting a parent that has sub-sections. Create/Edit form has a "Parent Section" select (locks type to production_shop; disabled if the section already has children).
- Machines attach to the **leaf** (sub-section if the shop has them): `MachineController::sectionOptions()` returns shops + sub-sections ordered hierarchically; the machine form's Section dropdown indents sub-sections ("↳ … under <parent>").

## 🧾 মূসক ৬.৩ — কর চালানপত্র (2026-09)

> **Billing & Accounts → মূসক ৬.৩.** The NBR VAT challan, transcribed from an original BITAC issued (challan no. 45), so nothing about the layout is guessed.

- `musak_challans` + `musak_challan_items`, `MusakChallan(Item)`, `MusakChallanController`, `App\Services\MusakChallanRenderer`, `Pages/MusakChallan/{Index,Create}.tsx`. Draft → issue in one form, edit, delete (draft only), and the PDF in **প্রথম / দ্বিতীয় / তৃতীয় কপি** (`?copy=1|2|3`).
- ⚠️ **It is an NBR form, not BITAC stationery** — its own masthead (গণপ্রজাতন্ত্রী বাংলাদেশ সরকার / জাতীয় রাজস্ব বোর্ড) and the boxed মূসক-৬.৩ label top-right. It goes through **`BitacLetterhead::renderPlain()`**, which brings the Tinos/Nikosh setup and Bangla shaping without the pad. Never render it with `render()`.
- ⚠️ **Every figure is STORED, never derived at print time.** A tax challan is a legal document: what it printed must not change because the customer's address, the centre's BIN or a quotation rate was edited afterwards. All header fields are typed (prefilled), and buyer/supplier name, BIN and address are snapshots on the row — verified by renaming the customer after issue and reprinting.
- ⚠️ **Nothing raises a tax challan automatically** — see the decoupling note below. The bill offers it: an invoice with no challan shows **+ মূসক ৬.৩** (→ `musak-challans/create?invoice=N`, prefilled), one with a challan links straight to it.
- **The arithmetic lives on the server** — `MusakChallanService::computeLine()` is the one rule, used by the typed form (`syncItems`) and the auto-raised challan alike, so the two cannot disagree. The browser recomputes it only so the preparer can watch. Per line: `value = qty × unit_price` (col ৬, **ex all tax**), `sd = value × sd_rate%` (col ৮), **`vat = (value + sd) × vat_rate%`** (col ১০ — সম্পূরক শুল্ক is part of the taxable base, not a parallel charge), `col ১১ = ৬ + ৮ + ১০`. সর্বমোট totals ৬, ৮, ১০ and ১১ only, as on the form.
- ⚠️ **Money is WHOLE TAKA**, as on the printed original: 290,909 + 10% = **29,091** → a round **320,000**. Rounding happens when the figure is *stored*, not at print time, so the saved numbers and the paper are identical and সর্বমোট always equals the sum of its column. **The unit price (col ৫) is the exception and keeps its paisa** — it is a per-piece price, not a total, and rounding it would move `1000 × ৳12.50` to ৳13,000.
- ⚠️ **The challan carries VAT only, and that is correct** (confirmed by BITAC, 2026-09-29): **the buyer deducts income tax at source**, so AIT never belongs on the supplier's challan, and মূসক ৬.৩ has no column for it. Lines are priced `gross / (1 + (vat+tax)/100)` — the same extraction the quotation uses — which drops the AIT, and the form states the excluded amount so the gap between the challan total and the bill total is never a mystery. Verified: bill total − challan total = the AIT to within the rounding.
- ⚠️ **The VAT rate comes from the document, never a constant** — the sample challan is at **10%**, not the 15% the quotation form defaults to.
- New columns: **`centers.bin_number`** (নিবন্ধিত ব্যক্তির বিআইএন, on Admin → Centers) and **`customers.bin_number`** (ক্রেতার বিআইএন, on the customer form). `InvoiceService` had been reading `customers.bin_number` all along — **the column simply never existed**, so the tax invoice has always printed a blank there. It works now.
- An **issued** challan cannot be deleted (redirect + flash) — it records something that left the premises. Only a draft goes.
- ⚠️ **Asserting on decoded PDF text: never match a Bangla fragment containing a conjunct.** Shaping turns যুক্তাক্ষর into private-use ligatures, so `মূসক-৬.৩` can never appear in the decoded stream — it comes out as `{lig}সক-৬.৩`. Match on conjunct-free fragments. (Related: mPDF writes letter-spaced runs as `TJ`, not `Tj`.)

## 🧾💰 Delivery → Bill → মূসক ৬.৩ are three separate acts (2026-09-29)

> BITAC's rule: **the delivery challan belongs to the delivery; the bill and the tax challan do not.** They are raised whenever accounts get to them.

- **Delivery challan** — unchanged. It exists from the moment the delivery order does (`DeliveryChallanService`), printable from the Delivery list and from the PCD job detail.
- **The challan PDF is BITAC's printed challan, transcribed** (2026-09-30): DELIVERY CHALLAN title, No. / Date, Name, Address, Purchase Order No. + date (`customer_po_no` / `customer_wo_date`), Job No., a ruled **Part No. | Description | Quantity** table padded to 20 lines, and two hand-signed blocks — *Signature of receiver / Name / Designation / Phone Number* and *Signature / Executive Engineer / Production Control Division / Phone Number*. Lines come from `work_order_items` (PCD's copy), falling back to the quotation's. No vehicle/driver/notes/POD on it — the paper has none. ⚠️ Signature rules are **table-cell borders**: a border on a `<div>` inside a cell is drawn by mPDF the width of the text, or under every `<br>` line. The challan number on the Delivery list and a **Challan PDF** button on the delivery page both open it.
- ⚠️ **Confirming a delivery no longer raises the bill.** `DeliveryController@complete` used to call `InvoiceService::createFromDelivery()` inline, so an invoice was issued as a side effect of someone signing for goods. That call moved to **`InvoiceController@storeFromDelivery`** (`POST delivery/{delivery}/bill`, `permission:create invoices`), reached by a **Raise bill** button on delivered rows of the Delivery list. `CustomerNotifyService::invoiceIssued` moved with it — the customer hears about a bill when there is one.
- It **refuses with a redirect + flash, never `abort()`**: an unconfirmed delivery has nothing to bill, and a second click lands on the existing bill saying so. `DeliveryOrder::invoice()` (hasOne) is what both the guard and the list read, so a billed row shows **Bill** instead of **Raise bill**.
- ⚠️ **And nothing raises the মূসক ৬.৩ automatically either.** It was briefly wired to fire with the invoice; BITAC did not want that coupling. A tax challan is issued deliberately, from the bill, through the form — so a person has checked the destination, the vehicle and the signatory before a legal document goes out. `MusakChallanService` keeps only `computeLine()` (the arithmetic) and `linesFor()` (pricing a bill's lines for the form).
- The chain still reads end to end in the UI: **Delivery → Raise bill → + মূসক ৬.৩**, each step a click, each one reversible only in the ways its own rules allow.
- Fixed while working here: **`DeliveryController@complete` 500'd whenever no note was typed** — `notes` is `nullable`, so it is simply absent from `$validated`, and reading it straight threw. The form always sends an empty string, which is why it never showed in the UI; anything posting without the key (the API, a test) hit it.

## 🚚 Delivery Orders belong to PCD (2026-09)

- The menu **Delivery & Billing** is now **Billing & Accounts** and holds the money only — **Bills / Invoices** and **মূসক ৬.৩**. **Delivery Orders moved into the PCD group** (BITAC's instruction): the department that planned and routed the job also ships it. The module itself is unchanged and still lives at `/delivery`.
- `pcd-officer` gained **`view delivery` / `create delivery` / `complete delivery`**, in the seeder *and* in migration `..._000047_give_pcd_the_delivery_orders` — a seeder edit alone only helps a fresh install, so on a live database the menu would have appeared for nobody.
- **PCD Job Detail carries the deliveries** raised against that job — a sky-dot **Deliveries** card listing each challan with its quantity, date, vehicle, status and a **challan PDF** button, plus "N of M delivered" in the header. Props come from `PcdInboxController@show` (`deliveries`, `delivered_qty`); each row is packed by `Pcd\PcdDeliveryController::pack()` and is handed the work order it already has, rather than refetching it per row.
- ⚠️ **`pcd.deliveries.challan` is a deliberate second door onto the same PDF.** `delivery.pdf` is gated by `view delivery`; the PCD job detail is open to anyone with `view pcd-inbox`, who need not hold it. Same service (`DeliveryChallanService`), same bytes — verified byte-length identical through both routes. The production op-sheet PDF has exactly this shape; don't "tidy" it by pointing the card at `delivery.pdf`.

## 📊 IED commercial reports (2026-09)

> `IED → Reports`. The four existing reports (Production, OEE, Rejection, Lead Time) look at
> the shop floor; these look at **who the work is for and what it is worth**.

One page, four views, sharing a financial-year and centre filter — `Ied\IedReportController`
+ `App\Services\IedReportService`. Only the view being looked at is queried.

- **Client List** — every client with their type, sector, job count and value for the year, biggest first.
- **By Type & Sector** — jobs folded into Government / Private, then sector. **Unclassified customers are shown, not hidden**, so a gap in the data is never mistaken for a gap in the work.
- **Quotation Value** — what was quoted in the year, how much turned into work, and a month-by-month bar. ⚠️ Counts quotations that actually **reached the customer** (drafts and `pending_approval` excluded — a draft was not "given"), dated by `sent_to_customer_at` → `memo_date` → `created_at`. **`superseded` is excluded**, or a revised quotation would be counted twice for the same job.
- **Jobs in Pipeline** — everything neither delivered nor cancelled, **in BITAC's six stages**, plus the list of what is in each. Deliberately **not** year-scoped: what is open is open, whenever it started.
  - **Quoted → Work Order Received → Production Planning → In Production → QC → Ready to Deliver** (`IedReportService::PIPELINE_STAGES`, whose order IS the printed order). The old breakdown showed raw statuses ("Released to Shops", "QC Hold", "Approved"), which are states the software keeps, not steps a manager reads. An empty stage is still listed, so the report does not change shape week to week.
  - ⚠️ **`quoted` has no work-order status and never will.** A quotation that reached the customer but produced no work order is not in `work_orders` at all, so it is counted from `quotations` (`quotedRows()`), which is where IED's own work actually starts. **`QUOTED_STATUSES` = `sent_to_customer`, `revision_requested`, `customer_accepted`** — `approved` is excluded because a quotation is approved internally *before* it is sent, and `superseded` / `customer_rejected` / `converted` are dead or already ordered.
  - ⚠️ **The no-double-count guard is on the RFQ, not the quotation.** A work order is issued against one version, so checking `work_orders.quotation_id` alone would leave the other versions of the same job sitting in Quoted for ever. Any non-cancelled work order on the RFQ takes the job out of Quoted — and cancelling it puts the quotation back, which is right.
  - The money column is the **Quoted value**, and each row names **which quotation** it came from (`Q-00142 v2`, linked, memo no beneath) — a work order carries no money of its own, so a figure nobody can trace to a quotation is a figure nobody trusts. Same traceability rule as Target vs Achievement.
  - ⚠️ **A work order with no quotation reads "not quoted" and prints a dash, never ৳0.00.** Its value is unknown, not zero; the headline says how many there are and leaves them out of the total, so the stage figures and the row figures still sum to it exactly.
  - ⚠️ **The pipeline is selected by what it EXCLUDES** (`CLOSED_STATUSES` = delivered, cancelled), not by a list of open statuses. It *was* such a list, and when **`pcd_review`** and **`pcd_release_pending`** were added (migrations 000051 / 000055) nobody extended it — so a work order sitting with the নির্বাহী প্রকৌশলী was **invisible here**, and the report's own headline count was wrong. Selecting by exclusion means a status added tomorrow still shows up; an unmapped one lands in the first stage rather than vanishing, which is the right way for a report to fail. The test suite asserts that every status the `WorkOrder` model declares belongs to exactly one stage.
- Work-order money comes from the linked quotation and work-order dates use
  `COALESCE(customer_wo_date, DATE(created_at))` — the same expressions as
  `TargetAchievementService`, so the two reports can never disagree. Cancelled work orders are
  excluded everywhere.

## 🖨 Every report prints (2026-10-04)

> All nine — IED's five (Client List, By Type & Sector, Quotation Value, Jobs in Pipeline, Target vs Achievement) and the four shop-floor ones (Production, OEE, Lead Time, Rejection Rate) — plus Receivables, which already did.

- **`App\Services\ReportSheetRenderer` is the one renderer.** A report is a title, a line saying what was asked for, some headline figures, one or more tables and a note; nine of them differ only in those contents. Each describes a **sheet** (`title_bn`, `title_en`, `subtitle`, `landscape`, `tiles[]`, `sections[]`, `notes`, `signatories[]`) and this lays it out. Nine bespoke renderers would be nine copies of the same table CSS drifting apart.
- The sheets live in **`App\Services\Reports\IedReportSheets`** and **`ProductionReportSheets`**. ⚠️ **They compute nothing** — they format figures the report already worked out. A second copy of the arithmetic is how a printed total comes to disagree with the screen.
- ⚠️ **`ReceivablesReportRenderer` was moved onto the shared renderer too.** It had its own copy of the table CSS, which is how one sheet quietly stops looking like the rest. Its 22-assertion test passed unchanged before and after, which is what made the refactor safe to do at all.

### How the print gets the screen's figures
- **Production reports: same method, same URL** — `?pdf=1` (or the `?preview=base64` that `PdfPopupModal` fetches with) makes `ReportController::respond()` return a sheet instead of an Inertia page. A separate pdf action would have to re-run the queries, and re-running is how two answers appear.
- **IED reports: `GET ied/reports/pdf`** taking the **same query string** as the page (`view`, `year`, `center_id`, `search`), both going through `IedReportController::resolve()` so the screen and the print cannot ask different questions. An unknown `view` falls back to the client list rather than failing.
- `?download=1` forces a save; otherwise it opens inline. Frontend: **`Components/Reports/ReportPdfButton.tsx`** (button + popup) on every report page.

### Things that bite when printing
- ⚠️ **No ৳ inside a figure column.** The symbol is Bengali script, so mPDF's `autoScriptToLang` wraps any number carrying it in `.lang_bn` and sets it in Nikosh — that column then sits at a different weight and width from its neighbours. `ReportSheetRenderer::money()` deliberately adds no sign; the unit is stated once in the subtitle.
- ⚠️ **No warning glyph (⚠️) in PRINTED text.** It is in neither Tinos nor Nikosh, so mPDF substitutes **DejaVuSansCondensed** and the sheet carries a third face. The OEE note did exactly this and was caught by asserting on the embedded fonts. Warnings belong in the code, not on BITAC paper.
- ⚠️ **Landscape is not cosmetic.** Past about six columns a figure wraps, and a wrapped figure cannot be read down a column. Production, OEE, Lead Time, Jobs in Pipeline and Receivables are `landscape`; the rest are portrait.
- ⚠️ **A report hands over Eloquent Collections as often as arrays** (`by_month`, `work_orders`, …). `array_map`/`array_column` die on a Collection, and they die at *print* time, not on the screen — so the sheet builders normalise through `self::rows()`.
- ⚠️ When testing page size: **`round()` returns a float**, so `=== 595` against an int is always false and every page reads as the wrong size. Cast it.
- Verified for all nine: the route answers, the bytes are a PDF, the page is A4 the right way round, nothing crosses the 18mm margin, the title and signatories are on it, **only Tinos and Nikosh are embedded**, `preview=base64` works, and the printed pipeline total equals the screen's own prop.

## 🎯 Target vs Achievement (2026-09)

> Taka, per centre, per financial year. `Reports → Target vs Achievement`.

- **Target**: `center_targets` (center_id, financial_year, target_amount, note, set_by), **one figure per centre per year** (unique). A centre admin sets their own; a super admin sets any and sees every centre side by side.
- **Achievement**: the value of work orders received. A work order carries **no money of its own**, so the figure comes from the quotation it was issued against (`work_orders.quotation_id` → `quotations.total_amount`). A revised quotation is fine — the WO points at the version actually accepted, so that is what counts.
- ⚠️ **Which year a work order falls in is `work_orders.customer_wo_date`** — the date on the CUSTOMER's own work order, entered on the Issue Work Order form — **not** when it was keyed in. A January work order entered in July belongs to January. Rows from before the column existed fall back to `created_at`, and the breakdown badges those rows "entered" so the figure stays honest.
- **Cancelled work orders are excluded** — IED rejecting one at the inbox sets exactly that status.
- Every figure is traceable: clicking a centre lists the work orders behind it with their quotation and version. A total nobody can trace is a total nobody trusts.

### It lives in IED → Reports now (2026-10-04)
- BITAC set the yearly figure from IED, so the report **and the form that sets it** moved onto the same desk: **IED → Reports → Target vs Achievement** (`?view=target`, a fifth tab beside Client List / By Type & Sector / Quotation Value / Jobs in Pipeline). The standalone entry under the production Reports group is gone and **`/reports/target-achievement` redirects** there carrying the year, because notifications and bookmarks written before the move point at it.
- Setting it needs the new permission **`set targets`** (migration `..._000059`, plus both seeders), held by **Executive Engineer (IED)**, **ied-officer** and **management**. ⚠️ `super-admin` is deliberately not granted — `Gate::before` already lets them past, so the grant would add nothing.
- ⚠️ **The target routes had to move OUT of `permission:view reports`.** An IED officer does not hold it, so left in that group the save and the breakdown would 403 for exactly the people whose job this now is. Store is `permission:set targets`; the breakdown is `permission:view rfqs|view reports` (Spatie's `|` is OR) so both desks can trace a figure.
- `canSetFor` arrives **empty** for a viewer without `set targets`, so the form is simply not rendered — and `TargetController@store` refuses the write as well. The screen only stays honest about what the person can do.
- The panel is `resources/js/Components/Reports/TargetAchievementPanel.tsx`; `Pages/Reports/TargetAchievement.tsx` is deleted. It owns **no figures and no year picker** — the IED page supplies both, and the numbers still come from `TargetAchievementService`, so there is one implementation and nothing can disagree. A year with no target set says so instead of showing an empty bar.

### ⚠️ `hasRole('super_admin')` is a role that does not exist
- The role is **`super-admin`, with a hyphen** — that is what the seeder creates and what every live account carries. **`User::isSuperAdmin()`** is now the one place that knows it (it accepts both spellings).
- This was not cosmetic here: `TargetController` and `Ied\IedReportController` both asked for `super_admin`, so the check was **always false** and a super admin was quietly scoped to a single centre — on Target vs Achievement that is the entire point of the report (seeing all six centres side by side). Both now call `User::isSuperAdmin()`.
- ⚠️ **About a dozen other call sites still spell it `super_admin`** — `CostEstimateController` (delete/edit rights), `QuotationController` (delete/edit rights), `EntityCommentController`, and others. They are all failing closed, so nobody is over-privileged, but a super admin is being refused things they should be allowed. Changing them alters who can delete documents, so it was left for BITAC to approve rather than swept in silently.

### ⚠️ The financial year is not fixed — `App\Support\FinancialYear`

| Financial year | Period |
|---|---|
| up to 2026–27 | 1 July – 30 June |
| **2027–28** | **nine months** — 1 July 2027 – 31 March 2028 |
| 2028–29 onward | 1 April – 31 March |

Bangladesh is moving the cycle to April–March from FY 2028–29, which makes 2027–28 a
nine-month transitional year. **Never hardcode a July–June pair — ask `FinancialYear`.** The
three windows meet exactly, with no gap or overlap (verified day by day across five years). The
2028 change is a cabinet decision, not law yet, so `LAST_JULY_START_YEAR` and
`FIRST_APRIL_START_YEAR` are the only two things to move if it shifts again.

## 📥 PCD Inbox → Job Planning — the boss reads it first (2026-09-30)

> BITAC's flow: IED forwards → **নির্বাহী প্রকৌশলী** sees a work order has arrived, reads it, and passes it on → only then is the job number, MR, routing and op sheet prepared.

- ⚠️ **The screen that used to be called "PCD Inbox" was never an inbox** — work did not arrive there, it was *done* there. It is **Job Planning** now (`/pcd/job-planning`, `PcdJobPlanningController`, `Pages/Pcd/JobPlanning.tsx`, routes `pcd.job-planning.*`), and the name **PCD Inbox** moved to the new first stop where work actually lands.
- **New status `pcd_review`, in FRONT of `pcd_pending`.** `pcd_pending` keeps its old meaning — "on the planning desk" — so **every work order already in flight stayed exactly where it was** and nothing had to be re-forwarded by hand. `status` is `varchar(30)`, so no enum widening.
- **`Pcd\PcdReviewController`** (`/pcd/inbox`, `Pages/Pcd/{Inbox,Review}.tsx`): list, read, **Forward to Job Planning** (optional note) or **Send back to IED** (reason **required** — a work order coming back with no explanation is one that got lost). Sending back sets `ied_pending` and clears `pcd_handoff_at/by`, so it reappears in the IED Work Order Inbox; IED is notified.
- ⚠️ **An engineer role name MUST carry its department.** BITAC has an Executive Engineer in **IED** *and* one in **PCD**, so a bare `Executive Engineer` role says nothing about what it should be able to do — and an earlier migration granted `review pcd-inbox` to exactly that role on the assumption it meant PCD's. It was IED's. The three roles are:
  - **`Executive Engineer (IED)`** — RFQs, quotations, cost estimates, approvals. **No PCD permissions.**
  - **`Executive Engineer (PCD)`** — holds **`review pcd-inbox`** → PCD Inbox.
  - **`Assistant Engineer (PCD)`** — holds the `pcd-officer` set incl. **`view pcd-inbox`** → Job Planning.
  ⚠️ **No role holds another's** — giving the planner `review pcd-inbox` collapses the two-step back into one. Verified: each can open only their own screen, and the bare titles no longer exist.
- Migration `..._000053_name_engineer_roles_by_department` **renames** the live `Executive Engineer` to `(IED)` rather than replacing it, so the officer on it keeps everything he had, and takes `review pcd-inbox` off it. `..._000052` mirrors the planning set from `pcd-officer`, which stays as the generic, canonical definition of the job; BITAC's staff are assigned the **designation** roles. All three are in `BitacDepartmentRolesSeeder` now.
### Two colours on the PCD job page (2026-10-03)
- **Indigo band = PCD's own work**: the **Work Order** (shop routing) and the **Operation Sheet** cards both wear a light indigo header (`bg-indigo-50`, dark indigo text — a solid saturated band was tried first and shouted over the content), so walking onto a long page says at a glance where the work is. Their count / "N of M done" sits in the band as a white pill, and the PDF + Edit buttons moved into it.
- **Amber band = what was ordered**: the **Job Details** card. Quantity and due date are tiles rather than rows, and **the due-date tile is coloured by how long is left** — rose past due (with "N days overdue"), amber within three days, emerald beyond. Priority is a badge (urgent rose / high amber / normal slate / low sky).
- **Emerald band = reference**: the **Documents** card (same light treatment), with a colour per kind of paper inside it — sky (RFQ letter), emerald (quotation), violet (cost estimate), teal (**Gate Pass In**) and amber (**Gate Pass Out**), opposite colours because one says what is on the floor and the other what has gone back.
- ⚠️ **Tone classes are written out in full, never built from a variable.** Tailwind only ships classes it can see in the source, so `bg-${tone}-100` silently produces no CSS. After changing them, grep the built stylesheet.

### Releasing a job to the shops needs the নির্বাহী প্রকৌশলী (2026-10-03)
- ⚠️ **Finishing the planning checklist no longer reaches the shop floor.** `PcdReleaseService::tryRelease()` used to flip `pcd_pending → released_to_shops` the instant the last gate went green. It now stops at **`pcd_release_pending`** and tells the **Executive Engineer (PCD)**; **`approveRelease()`** is what actually opens the floor — marks the first routing section `ready` and notifies its shop.
- `released_to_shops_at` / `released_by` keep their meaning: the moment work really reaches the floor, which is now the approval. The new **`release_requested_at`** records the earlier moment, when planning finished.
- **`/pcd/inbox/release/{workOrder}`** shows the নির্বাহী প্রকৌশলী what he is approving — the routing in sequence with weights, every item's operation sheet step by step, and the Documents card — then **Approve & release** or **Send back to planning** (reason required, job returns to `pcd_pending`, planner notified). Jobs awaiting release are listed on the PCD Inbox beside those awaiting review: same officer, same screen.
- ⚠️ **The release routes must be declared BEFORE `/inbox/{workOrder}`.** Laravel matches in registration order and takes the first hit, so with the parameter route first, `/pcd/inbox/release/5` binds `release` as the work order and 404s on the model.
- `tryRelease()` is **idempotent** — it leaves a job that is already waiting, or already released, alone. Five screens call it (MR approve/issue, routing save, op sheet save), so without that it would re-notify on every one.
- `pcd_release_pending` was added to the Job Planning list and the material-requisition lookups, so the planner keeps seeing the job while it waits.
- ⚠️ The two release gates are **routing + operation sheet**; the material requisition is optional (`WorkOrder::getPcdProgressAttribute`). A test that forgets the op sheet never exercises the gate at all.

### The paperwork travels with the job (2026-10-03)
- BITAC's rule: when IED forwards a job, **everything belonging to that work goes with it** — the customer's RFQ letter, the approved quotation, **every Gate Pass In** raised against it, the **cost estimate(s)** it was priced from, and the work order's own attachments. PCD should not have to go looking.
- **`App\Services\PcdJobDocuments` is the one packer**, and **both** PCD screens render it through **`Components/Pcd/JobDocuments.tsx`** — the inbox (where the নির্বাহী প্রকৌশলী decides) and Job Planning. ⚠️ Two copies of this is how one screen quietly ends up showing less than the other; the boss and the planner must read the same papers.
- **Both directions.** The **In** pass says what physically arrived, the **Out** says what has gone back — PCD needs both to know what is actually on the floor. Each row carries its `direction` and the card groups them under BITAC's own labels, **Gate Pass In** / **Gate Pass Out**.
- ⚠️ **Every `pdf_url` points at a PCD door**, never at IED's own route. The gate pass PDF is gated by `view pcd` and the cost estimate PDF by `view cost-estimates`, and **no PCD role holds either** — linking straight at them hands the department a document it cannot open. `Pcd\PcdDocumentController` delegates to the same generators under `permission:view pcd-inbox|review pcd-inbox` (Spatie's `|` is OR). Verified: both PCD roles open them, and IED's own routes still refuse PCD.
- ⚠️ **The route carries the WORK ORDER and the document must belong to it** (`/pcd/job/{workOrder}/…`). A door keyed only on the document id would let anyone with `view pcd-inbox` pull *any* gate pass or estimate by guessing a number; each method proves the link to the job's RFQ and 404s otherwise. Verified with a pass from another RFQ.
- ⚠️ **Draft cost estimates are excluded** (BITAC, 2026-10-03) — a draft is costing still being worked on; it was never forwarded, and a shelf of them buried the figure that counts. Same line the money path already draws: `RfqItemPart::effectiveEstimate()` takes the newest **non-draft** estimate. A job whose costing is all still draft shows no cost estimate here, which is the honest answer.

- `pcd_handoff_at/by` still records **IED's** act (when it reached PCD at all); the boss's forward has its own **`pcd_forwarded_at`/`pcd_forwarded_by`/`pcd_review_note`**. The IED handoff note and the review note are both appended to `notes`, tagged `[IED → PCD · name, date]` / `[PCD Review · name, date]`.
- **IED now notifies `review pcd-inbox`, not `view pcd-inbox`** — nothing is plannable until review is done. The boss's forward then notifies the planners.
- ⚠️ **A stale `/pcd/inbox/{id}` link redirects to the planning desk** rather than refusing: notifications written before this step existed point there, and an old link must land somewhere useful. Deciding on a work order that has already moved on is a redirect + flash naming its current status, never an `abort()`.
- ⚠️ **Who gets the notification is decided by who holds the permission**, so granting one to a role puts that role on the fan-out. `review pcd-inbox` is therefore **NOT** granted to `super-admin`: `Gate::before` in `AuthServiceProvider` already lets them open any screen, so the grant would have added no access — only a notification for every work order in the system. **Access and being told about it are different things.**
- ⚠️ **`User` has no `CenterScope`**, so `NotifyService::toPermission()` reached permission-holders at *every* centre. It now takes an optional **`centerId:`** and the PCD flow passes the work order's. **Users with no centre set are always included** — not notifying someone at all is a worse failure than a little cross-centre noise, and unset centres are real here (the live Executive Engineer has none). Verified: a second centre's Executive Engineer is not told about a Dhaka work order, the Dhaka one and the centre-less one are.
- ⚠️ **`pcd_forwarded_at/by` and `pcd_review_note` had to go into `WorkOrder::$fillable`** — mass assignment drops anything missing from it *silently*, so the forward worked while the stamp was never written. (Same trap as `CostEstimate::approval_status`.)

## 📝 Work order acceptance goes through an approval chain (2026-09)

- A work order issued from an approved quotation lands `ied_pending` in the IED inbox. Accepting it was guarded by **`permission:view rfqs` alone**, with no check on who created it — so whoever issued the WO could immediately wave it through to PCD.
- Acceptance is now a **chain, the same shape as quotations**: levels decided in order, each with remarks and a signature. `work_order_approvals` mirrors `quotation_approvals`; `App\Services\WorkOrderApprovalService` builds it (from `QuotationController` when the WO is issued) and answers `blockerFor($wo, $userId)`.
- **It is a SEPARATE chain from quotations.** `quotation_approval_settings.document_type` is `quotation` (quotations + cost estimates, as before) or **`work_order`**. Admin → Approval Chain has a switcher. The quotation already passed its approvers; putting the same people on the work order is the same signature twice.
- ⚠️ **No chain configured → no approval rows, and acceptance behaves exactly as it always did.** Deliberate: shipping this with an empty chain must not freeze every work order in the inbox. BITAC turns the gate on by adding approvers.
- Only the approver whose level is pending may accept **or reject**. The handoff to PCD (notes, `pcd_pending`, the PCD + customer notifications) runs **only when the last level approves**. A rejection stamps that step, deletes the pending levels below it, cancels the WO and reopens the quotation — as before.
- ⚠️ The unique on the settings table is now **`(center_id, document_type, level)`** (`qas_center_doc_level_unique`) — without the type, a work-order level 1 would collide with a quotation level 1 at the same centre. `center_id` stays leftmost so it still backs the centre foreign key. `ApprovalChainController::destroy` re-sequences **within one document type**, or deleting a quotation step would renumber the work-order chain.
- The inbox Show page renders the chain with each step's state, badges the viewer's own row, and disables Accept/Reject with the reason when it is not their turn.

## ☠️ Nobody deletes a staff account that has worked (2026-10-06)

> Reported from the live system: a shop engineer's **Profile Settings** offered **Delete Account** — "permanently delete your account and all of its data".

- ⚠️ **It would have done far more than delete an account.** `quotations.created_by` and `work_orders.created_by` are **ON DELETE CASCADE**, and a work order carries down with it: `work_order_items`, `work_order_sections`, `operation_sheets` → `operation_steps` → `production_logs` / `operator_assignments`, `material_requisitions`, `qc_inspections` → `ncrs` → `rework_orders`, `section_handoffs`, `delivery_orders` → `proof_of_deliveries`, **`invoices` → `payments` → `payment_deductions` / `payment_files`**, and `completion_certificates`. One person, their own password, two clicks — and the quotations and work orders they had ever raised, with the whole money ledger hanging off them, were gone. 22 foreign keys into `users` are CASCADE; the other 62 are `SET NULL`.
- **The self-delete is gone root and branch**: the `profile.destroy` route, `ProfileController@destroy`, and `Profile/Partials/DeleteUserForm.tsx`. A note sits where the method was so nobody restores Breeze's default. `DELETE /profile` now answers 405.
- **Retiring someone is Deactivate**, which already existed and already works: `users.is_active` / `deactivated_at` / `deactivation_reason` on **Admin → Users**, and `LoginRequest` refuses an inactive staff login (verified: the account cannot sign in afterwards). The account stops working and **everything they did stays on the record with their name on it** — which is what a government system needs, not a hole where the work used to be.
- **`Admin\UserController@destroy` was an unguarded `$user->delete()`** — the same cascade, one click from the user list. It now refuses with a redirect + flash **naming what would have been destroyed** ("would also destroy 1 work orders") and pointing at Deactivate, and it refuses deleting your own account. An account that has genuinely done nothing — a mistyped one created an hour ago — still deletes cleanly.
- **`User::destructiveFootprint()`** is what decides: counts over every CASCADE path (quotations, work orders, QC inspections, rework orders, the three approval tables, stakeholder forms, service demand logs), returning only what is non-empty. `canBeHardDeleted()` is `=== []`.
- ⚠️ The test **proves the cascade from `information_schema`** rather than assuming it, so if someone later changes a foreign key to `SET NULL` the guard's reason is re-checked rather than quietly outliving its cause.

## ⚠️ A row must never be written with NO centre (2026-09-29)

> Reported from the live system: the approval chain screen listed **Md Rakib Hassan → Mir Md. Anisuzzaman**, yet Quotation #18 sat pending with the **Director General**, who is not in the chain at all.

- **The cause was `HasCenter`.** It only filled `center_id` when a centre was active, and `current_center_id` is deliberately **null for a super admin who has not picked a centre** (that is what makes `CenterScope` show them everything). A row written in that state belonged to **no centre**.
- That is quietly fatal for per-centre configuration: the admin screen's query does not filter when no centre is active, so the chain **looked** correctly set up, while `forCenter($doc->center_id)` matched none of it — and every quotation and cost estimate fell through to the **management-role fallback**, i.e. the Director General. **Seeing all centres and writing into none are two different things.**
- **`HasCenter` now never writes NULL**: active centre → the signed-in user's own → **`Center::defaultId()`** (the lowest id, Dhaka — the same fallback the centre migration used). Reading is unchanged, so a super admin still sees every centre.
- **`QuotationApprovalSetting::resolveFor($centerId, $docType)` is what every chain builder calls now** (quotation, cost estimate, work order). A document with **no centre at all** — only possible for rows written before this fix — falls back to the default centre's chain. ⚠️ A **real** centre with no chain of its own does **not** borrow another's: chains are separate per centre (BITAC's decision), so that case keeps the management fallback. Verified both ways.
- **Admin → Approval Chain now reads and writes one centre explicitly** (`withoutGlobalScopes()->where('center_id', …)`), instead of relying on the scope. It also sets `center_id` on create rather than leaving it to the trait, and computes the next level within that centre.
- Migration `..._000050_repair_centreless_approval_chains` gives the orphaned configuration the default centre and **rebuilds the chain of quotations still awaiting their first decision**. ⚠️ It only touches a quotation when **every** approval row is still `pending` — rebuilding a chain someone has already signed would erase a decision that was really made.

## 🏢 Approval chains are PER CENTRE (2026-09)

- **`quotation_approval_settings` drives BOTH quotations and cost estimates** — `QuotationService::createApprovalChain()` and `CostEstimateController::buildApprovalChain()` read the same rows. The table name is historical; don't assume it is quotation-only.
- It and `gate_pass_approvers` now carry **`center_id`**, and both models use `HasCenter`. Chains are **separate per centre** — no shared head-office steps (BITAC's decision).
- ⚠️ **Building a chain follows the DOCUMENT's centre, never the session's.** Use **`QuotationApprovalSetting::forCenter($doc->center_id)`**, which deliberately bypasses the global scope — a super admin with another centre selected (or none) must still get the chain the document belongs to. `HasCenter`'s scope is for the *admin screen*, where the active centre is the right answer.
- The empty-chain fallback (`User::role('management')->take(2)`) is centre-filtered too, or a centre with no chain would pull another centre's managers.
- **`GatePassApprover::isApprover($userId, $centerId)`** takes the **pass's** centre. Passing null asks "an approver anywhere", which is only right for deciding whether a *list* shows an action column before any pass is in hand; `approve()`/`reject()` always pass the real centre.
- ⚠️ **The old UNIQUE indexes were global and had to go composite**: `UNIQUE(level)` meant Dhaka's level 1 blocked Chittagong's, and `UNIQUE(user_id)` meant one officer couldn't approve at two centres. Now `UNIQUE(center_id, level)` and `UNIQUE(user_id, center_id)` — **`user_id` stays leftmost** on the latter so it still backs `gate_pass_approvers_user_id_foreign` (MySQL refuses to drop the last index a foreign key sits on; the first attempt at that migration died exactly there).
- Verified with a second centre: each centre's quotation and cost estimate build only their own approvers, both centres can hold the same level, a Dhaka approver is refused on a Chittagong pass, and one person can now be an approver at both.

## 🏭 Customer Type + Sector (2026-09)

> The basis of IED's sector-wise reporting.

- Every client is a **Government Entity** or a **Private Organization** (`customers.customer_type`, `Customer::TYPES`) and sits in a **sector** (`customers.sector_id`). Both are **nullable** — the 15 pre-existing customers read as **"Unspecified"** (`customer_type_label`) until someone classifies them.
- **Sectors are master data the admin creates — nothing hardcoded.** Admin → Master Data → **Client Sectors** (`Admin\SectorController`, `Admin/Sectors/Index.tsx`, inline add/edit).
- `sectors.applies_to` is `government` / `private` / **`both`** — one list, each row tagged. The customer form narrows the sector dropdown to the chosen type, and **clears a sector that no longer fits** when the type changes.
- ⚠️ **Sectors are NATIONAL — no `HasCenter`, deliberately unlike `job_categories` and the rest of master data.** Per-centre rows would give Dhaka and Chittagong each their own "Power" with a different id, and "jobs by sector across BITAC" could then only group by name — which breaks the first time someone types it differently. One list keeps the figures comparable. The flip side: editing it changes what every centre sees, so it belongs to a super admin.
- A sector **already attached to customers is deactivated, not deleted** — deleting would blank their classification and skew past reports. An unused one deletes outright.
- The reporting shape this exists for: `customers` LEFT JOIN `sectors`, grouped by `COALESCE(customer_type,'unspecified')` and sector name.

## ✅ Approval Cycle Labels — Cost Estimate & Quotation (2026-07)

- **Work cycle:** the doc is **Prepared By** its creator (NOT an approver), then the chain runs — **first approver = "Checked By"**, **last approver = "Approved By"**, any in-between = "Reviewer N". Single approver = just "Approved By".
- Central helper **`App\Support\ApprovalChainLabels`** (`forCount(total)` / `forIndex(index,total)`) is the one source. Cost estimate `submitForApproval` stores these labels on `cost_estimate_approvals.label` (old code wrongly made the first of 3 "Prepared By" — fixed). Quotation approvals have no label column → the label is **derived by position** in `QuotationController@show` (`approvals[].label`) and shown on Quotation Show. A custom label set on `QuotationApprovalSetting` still overrides the default for cost estimates.
- **Cost estimate PDF** (`exportSinglePdf`) now renders a **3-column signatory grid — Prepared By · Checked By · Approved By** (`$sigCell` helper): Prepared = creator (saved signature); Checked = the `Checked By` approval row (first approver); Approved = the `Approved By`/final row. Each shows the assigned person always + their signature/date once that step is approved (else "(Pending)"). Single-approver chains drop the Checked column.
- **Quotation PDF/forwarding letter** still shows the **final approver** as the single signatory (formal customer-facing letter convention) — NOT the 3-grid.

## 🚪 Gate Pass Out raised against a Gate Pass In (2026-09)

> What comes in to IED goes back out, and that exit needs its own paper.

- **`GET/POST {ied|pcd}/gate-passes/{gatePass}/out`** → `createOut` / `storeOut`. The form is the normal Gate Pass form with `directionLocked`, pre-filled from the In pass's **outstanding** lines and posting to its own endpoint.
- **Partial**: one In can raise several Outs. Each line is capped at `outstandingQty()` **server-side too** — whatever is posted, more can never go back than came in.
- **Three links** so the chain reads both ways: `gate_passes.source_gate_pass_id`, `gate_pass_items.source_gate_pass_item_id`, `gate_pass_returns.out_gate_pass_id`. All `nullOnDelete` — deleting the In pass must not take an issued, signed Out with it.
- ⚠️ **The Out pass IS the return.** `bookReturnsFor()` writes ordinary `gate_pass_returns` rows rather than touching `returned_qty` directly, so it is indistinguishable from a hand-recorded return: same totals, same `partially_returned` / `completed` transitions, same history. One physical event, one record — don't add a second path that also moves `returned_qty`.
- ⚠️ **The return is booked when the Out is ISSUED, not created.** IED issues on the spot; a PCD Out sits at `pending_approval` and `approve()` books it — until then the goods have not left. `bookReturnsFor()` is **idempotent** (it returns early if rows already exist for that Out), so the two call sites cannot double-count.
- `outBlocker()` is the single guard: direction must be `in`, the status must be returnable, and something must still be outstanding. It refuses with a redirect + flash, never `abort()`.
- ⚠️ **`completed` is a RETURNABLE status.** On a Gate Pass In, "Completed" means the goods **arrived** — the inward movement finished. What came in still goes back out later, which is a separate event. Excluding it left arrived-and-closed passes with items permanently stranded: neither Record Return nor Gate Pass Out would touch them. `GatePass::RETURNABLE_STATUSES` = `issued` / `partially_returned` / `completed`, and **`GatePass::canAcceptReturns()`** (status is returnable AND `outstandingQty() > 0`) is the one rule the return form, the Out pass and the UI all read — the Show page takes it as the `can_return` prop rather than re-deriving it from the status string. `recordReturn` also lands a pass on `completed` once everything is back, which is harmless: nothing is outstanding by then, so both actions close themselves.
- The Show page carries **Gate Pass Out** (primary) next to **Record Return** (now secondary — that path is for noting a return without producing paper), plus a card linking In ↔ Out both ways.
- **In → Out only.** Raising an In against an Out is not supported — BITAC did not want it yet.

## 🚪 Gate Pass Returns, Manual Numbers & Filters (2026-08)

- **Returns are itemwise and partial.** Whatever comes in on a pass goes back out again (and the reverse), often a few pieces at a time. New table **`gate_pass_returns`** (`gate_pass_id`, `gate_pass_item_id`, `quantity`, `returned_on`, `note`, `recorded_by`) — an item can have many, each with its own note. `gate_pass_items.returned_qty` is the denormalised running total, kept in step by `GatePassItem::syncReturnedQty()`.
- **`POST {ied|pcd}/gate-passes/{gatePass}/return`** → `GatePassController@recordReturn`. It **caps each quantity at `outstandingQty()`** so more can never come back than went out, ignores zero rows, and refuses (redirect + flash) if the pass is not `issued`/`partially_returned` or if nothing was entered.
- **Status follows the returns:** `GatePass::returnState()` gives `none` | `partial` | `full`. Partial → new status **`partially_returned`** (status widened enum → varchar(30)); full → the pass auto-**`completed`** with `completed_at`/`completed_by` stamped. Model helpers: `GatePassItem::outstandingQty()` / `isFullyReturned()`.
- **Pass number is auto but editable.** `create()` ships `suggestedPassNo` (from `GatePass::generatePassNo()`), the form pre-fills it, and `store()` takes `pass_no` as `nullable|…|unique:gate_passes,pass_no`, falling back to the generated one when blank. So BITAC can carry a number from their own register.
- **Index filters:** search + direction + status as before, plus **date range** (`date_from`/`date_to` over `pass_date`) and **company** (`customer_id`, matching the pass's own `customer_id` OR its RFQ's customer, since a pass can get its customer either way). Pagination uses `withQueryString()` so filters survive paging.
- **Labels are "Gate Pass In" / "Gate Pass Out" everywhere** — the IED/PCD gate pass screens, the customer portal (documents, work orders, complaints), the RFQ Show shortcuts, the `CustomerNotifyService` notification title, and the complaint rework flash. `Gate-In`/`Gate-Out` no longer appears anywhere in `app/` or `resources/js`, comments included; keep it that way.

## 🚪 PCD Gate Passes + Approval (2026-07)

- **Gate passes** (`GatePass`, `Ied\GatePassController` — shared by IED & PCD via `isPcdContext()` = route `pcd.gate-passes.*`) support **both directions** (`in`/`out`; GIN-/GOUT- pass no). PCD is no longer out-only.
- **PCD passes need approval; IED passes issue directly.** PCD `store` → status **`pending_approval`**; **any ONE** configured approver **approves** (→ `issued`, captures approver signature via `SignaturePad`) or **rejects** (reason). Routes `pcd.gate-passes.approve`/`.reject`. Status enum grew: `pending_approval`, `rejected` (+ existing draft/issued/completed/cancelled). New `gate_passes` cols: `approved_by/approved_at/approver_signature_path`, `rejected_by/rejected_at/rejection_reason`.
- **Approver pool** = `gate_pass_approvers` table (any-one-approves model, no levels). Managed under **Users & Access → Gate Pass Approvers** (`Admin\GatePassApproverController`, `Admin/GatePassApprovers/Index.tsx`). `GatePassApprover::isApprover($userId)` gates the Approve/Reject buttons (controller passes `canApprove` to Index + Show).
- Gate Pass Index/Show show status label/badges + Approve/Reject (signature modal / reason modal) for approvers on pending passes. Customer "gate pass issued" notification now fires on **approve** (not create) for PCD. `gate_pass_approvers` is **config → NOT in the SystemReset wipe list**.
- **Signature defaults to the user's default block** (`User::signatureAbsolutePath()`): both issuer AND approver — if they pick nothing, the default is used at render. Both the issue form and the approve modals now show the **SignaturePicker** (their saved blocks, default preselected, or draw one) — see the Signatures section above. The gate-pass PDF now has an **Approved By** signature column (middle) alongside Issued By + Customer Representative.

## 🚀 Quick Commands

```bash
# Setup
composer install
npm install                   # (or npm install --legacy-peer-deps if peer conflicts)
cp .env.example .env
php artisan key:generate
php artisan migrate --seed
php artisan storage:link

# Dev
npm run dev                   # Vite dev server
php artisan serve             # Laravel on :8000

# Build
npm run build                 # Production build
php artisan optimize

# Common debug
php artisan route:list --path=<prefix>
php artisan tinker
tail -f storage/logs/laravel.log
```

## 📋 Important Files to Know

| Purpose | File |
|---|---|
| Sidebar nav | `resources/js/lib/navigation.ts` |
| Inertia shared props | `app/Http/Middleware/HandleInertiaRequests.php` |
| AI tools + brain | `app/Services/AiAgent/ToolRegistry.php` + `GeminiChatService.php` |
| Meeting controller | `app/Http/Controllers/MeetingController.php` (900+ lines) |
| Chat UI | `resources/js/Components/AiChat/ChatPanel.tsx` |
| Live presenter | `resources/js/Components/AiChat/PresentationViewer.tsx` |
| Meeting room UI | `resources/js/Pages/Meetings/Room.tsx` |
| WebRTC | `resources/js/lib/WebRTCManager.ts` |
| Settings service | `app/Services/SettingService.php` |
| Chatbot customization | `resources/js/Pages/Admin/ChatbotSettings.tsx` |
| Official letter renderer (BN/EN) | `app/Services/OfficialLetterRenderer.php` |
| RFQ Letters module | `app/Http/Controllers/RfqLetterController.php` + `resources/js/Pages/RfqLetter/*` |
| Email Mailables | `app/Mail/DocumentMail.php` (multi-attach), `app/Mail/RfqLetterMail.php` |
| What a client owes (the one source) | `app/Services/PaymentLedger.php` + `PaymentController` / `ReceivablesController` |
| Transactional data wipe | `app/Http/Controllers/Admin/SystemResetController.php` |
| Deployment guide | `docs/DEPLOYMENT.md` (Coolify + Dockerfile) |
| Client's own workflow + the Excel costing model it replaced | `docs/DOMAIN_NOTES.md` (paper forms in `client resource/`) |
| Task list, BITAC's decisions, what's outstanding | `docs/IED_BACKLOG.md` |

## 📦 What's Been Built (Feature Inventory)

- 13 core modules (IED, PCD, Shops, QC, Delivery, Invoicing, Reports, etc.)
- Full RFQ → Cost Estimate → Quotation → Work Order → Delivery → Invoice pipeline
- Dynamic multi-level approval chains for quotations + cost estimates
- Visual Gantt progress tracking on work orders
- Live NOC dashboard with day/night mood theme
- PWA installable app
- Role-based access control with Spatie
- Customer Portal (separate guard)
- Multi-center architecture
- AI chatbot Oli with 20+ tools (English + Bangla)
- Document scanning (image + PDF via Gemini multimodal)
- Live Presenter (fullscreen interactive presentations with voice)
- 4-phase Meeting Room (chat + voice input + WebRTC calls + intelligence)
- Dynamic slide injection during Q&A
- Pre-built 10-slide Oli self-introduction (EN + বাংলা)
- Report generation (Excel, PDF, PPTX, SVG charts)
- Auto meeting minutes + action item extraction
- PPTX file upload + shared screen rendering

## 🎯 Feedback Preferences

- User prefers **terse responses** — no trailing summaries, no obvious recaps
- User values **professional quality** for customer-facing features (this is a government demo system)
- User likes **bilingual** features when appropriate (English + Bangla)
- User cares about **visual polish** — use animations, gradients, proper contrast
- **Don't over-engineer** — build what's asked, no speculative abstractions
- **Test the build** (`npm run build`) after significant changes

## 📞 Current Working Directory

On Windows: `f:\xampp\htdocs\bitac_pms`
Uses XAMPP for local dev (MySQL + Apache). `php artisan serve` on port 8000 is typical.
