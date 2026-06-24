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
