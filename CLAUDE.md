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

> **Sub-section ownership rule (IMPORTANT):** PCD only routes a job to the **top-level shop** (Section). The **shop in-charge** decides which **sub-section** does each step *after* the job arrives — NOT PCD. So: op-sheet Builder has NO sub-section field; the assignment lives on **Production Show** (per step). Sub-sections also DON'T appear as their own sidebar menu items / queue switcher entries — `productionSections` (HandleInertiaRequests) + `ProductionController::queue` `available_sections` are filtered to `topLevel()`. A supervisor sitting on a sub-section is shown their **parent shop**. (Sub-section-level queues are planned for a later phase; when added they'll nest under the parent shop, not flatten.)

**Phases:** 1) Sub-section foundation ✅ · 2) Quantity model + daily log + qty-based progress ✅ · 2.5) Section-level weightage ✅ · 3) Partial forward (section qty ledger, explicit transfer, no auto-forward) ✅ · 3.5) Upcoming Jobs ✅ · 4) Production-cycle page + machine-running state + progress/PDF sync ✅ · 5) Reroute + bottleneck flag ✅.

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
- **Queue visibility** (`expandWosForQueue`) now shows an item at a section when the WOS is active AND the item has any **open step there** — no longer gated on the single "current step", so an item can be at two sections at once (partial flow). Availability is gated upstream by the transfer that sets the WOS `ready` + `received_qty`.
- **Production Show:** header has a **flow ledger** (Received / Completed here / Transferred / Ready to transfer) + a **Transfer** button (partial qty modal, default = forwardable; "Transfer & Send to QC" on the last section). Rework still uses the old Complete-Rework path. Log form: "Produced"→**Completed**, machine/operator marked **optional**. Handoff history shows the transferred **N pcs** badge. Each item block header has a **View Operation Sheet** (PDF) button → `production.op-sheet.pdf` (delegates to `OperationSheetController@pdf` but gated by `view production`, so shop floor can open it without op-sheet view rights). The live "running" timer is hidden for qty-mode steps (only legacy Start/Complete steps show it).
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
