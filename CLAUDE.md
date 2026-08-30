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

## 📝 Official Letters, Quotation Pricing & Email (2026-06)

> Conventions hammered out over many iterations — read before touching these areas.

### Official letter format (one renderer for all letters)
- **`app/Services/OfficialLetterRenderer.php`** `buildHtml($d, $lang)` is the SINGLE source of the BITAC letterhead letter body (Bangla + English). Used by the quotation **forwarding letter** and the standalone **RFQ letters** — never re-implement the HTML.
- Layout: Memo No (top-left) / Date (top-right) → Subject → customer Ref → body (justified, no indent, salutation lives in the body) → recipient bottom-left + signatory bottom-right with the **"পক্ষে / For — পরিচালক (কেন্দ্র প্রধান) / Director (Centre Head)"** sign-off.
- **Signatory ink colour = `#a349a4`** (purple) everywhere (cost estimate, quotation PDF, letters). Labels stay black.
- Bangla = `font-family: siyamrupali` + Bangla digits; English = default font.
- Re-quotation: title is just "RE-QUOTATION" (no `(n)`); revision number appended to the END of the Memo No → `…028.51.(2)`.

### RFQ Letters module (IED → "Letters")
- Table `rfq_letters`, `RfqLetterController`, `Pages/RfqLetter/{Index,Create}.tsx`. Issue an official letter against an RFQ (RFQ optional — selecting it auto-fills customer ref + recipient). **Direct issue, no approval. Signatory is selectable.** PDF in BN & EN. Entry: "Issue Letter" button on RFQ show + Letters index.

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

**Phases:** 1) Sub-section foundation ✅ · 2) Quantity model + daily log + qty-based progress ✅ · 2.5) Section-level weightage ✅ · 3) Partial forward (section qty ledger, explicit transfer, no auto-forward) ✅ · 3.5) Upcoming Jobs ✅ · 4) Production-cycle page + machine-running state + progress/PDF sync ✅ · 5) Reroute + bottleneck flag ✅ · 6) Sub-section queues (own supervisor per sub-section) ✅ · 7) Partial QC + partial Delivery ✅.

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

## ✅ Approval Cycle Labels — Cost Estimate & Quotation (2026-07)

- **Work cycle:** the doc is **Prepared By** its creator (NOT an approver), then the chain runs — **first approver = "Checked By"**, **last approver = "Approved By"**, any in-between = "Reviewer N". Single approver = just "Approved By".
- Central helper **`App\Support\ApprovalChainLabels`** (`forCount(total)` / `forIndex(index,total)`) is the one source. Cost estimate `submitForApproval` stores these labels on `cost_estimate_approvals.label` (old code wrongly made the first of 3 "Prepared By" — fixed). Quotation approvals have no label column → the label is **derived by position** in `QuotationController@show` (`approvals[].label`) and shown on Quotation Show. A custom label set on `QuotationApprovalSetting` still overrides the default for cost estimates.
- **Cost estimate PDF** (`exportSinglePdf`) now renders a **3-column signatory grid — Prepared By · Checked By · Approved By** (`$sigCell` helper): Prepared = creator (saved signature); Checked = the `Checked By` approval row (first approver); Approved = the `Approved By`/final row. Each shows the assigned person always + their signature/date once that step is approved (else "(Pending)"). Single-approver chains drop the Checked column.
- **Quotation PDF/forwarding letter** still shows the **final approver** as the single signatory (formal customer-facing letter convention) — NOT the 3-grid.

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
- **Signature defaults to the user's profile signature** (`User::signature_url`/`signatureAbsolutePath()`): both issuer AND approver — if they don't draw one, the saved profile signature is used (PDF falls back at render, same pattern for both). The approve modal previews the saved signature ("used by default; draw to override"). The gate-pass PDF now has an **Approved By** signature column (middle) alongside Issued By + Customer Representative.

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
| Transactional data wipe | `app/Http/Controllers/Admin/SystemResetController.php` |
| Deployment guide | `docs/DEPLOYMENT.md` (Coolify + Dockerfile) |

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
