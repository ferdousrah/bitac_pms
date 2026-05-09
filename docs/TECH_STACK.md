# BITAC PMS — Tech Stack

> Production Management System for Bangladesh Industrial Technical Assistance Centre (BITAC).
> This document covers everything **except** the AI / chatbot stack.

---

## Backend

| Layer | Choice |
|---|---|
| Framework | **Laravel 11** |
| Language | **PHP 8.2+** |
| Database | **MySQL** (XAMPP local dev, production-ready) |
| ORM | Eloquent (with global scopes for multi-tenancy) |
| Auth | Laravel Breeze with two guards |
| Authorization | [Spatie Permission](https://spatie.be/docs/laravel-permission) — roles, permissions, middleware |
| Multi-tenancy | Custom `CenterScope` global scope + `HasCenter` trait — single DB with `center_id` row scoping |

**Auth guards:**
- `web` — staff (Spatie roles + permissions)
- `customer` — Customer Portal (separate model, no Spatie)

**Centers (locations):** Dhaka HQ, Chittagong, Chandpur, Khulna, Bogra, TTI.

---

## Frontend

| Layer | Choice |
|---|---|
| Bridge | **Inertia.js 2.x** — server-side routing with SPA-like UX |
| UI library | **React 18** |
| Language | **TypeScript** |
| Styling | **Tailwind CSS** with custom design tokens (`card`, `btn-primary`, `form-input`, `badge`, `surface-*`, `brand-*`) |
| Animation | [Motion](https://motion.dev/) (formerly Framer Motion) |
| Icons | Lucide React (primary) + Flaticon `fi fi-rr-*` (legacy) |
| Charts | Recharts (categorical) + custom inline SVG charts |
| Build | **Vite** |

---

## Real-time / Communication

- **Polling:** 2.5s interval for meeting room sync (no WebSockets configured — `BROADCAST_CONNECTION=null`)
- **WebRTC:** Custom `WebRTCManager.ts` for peer-to-peer voice calls in meetings
  - Mesh topology, 2–4 participants
  - STUN: `stun.l.google.com:19302`
  - Requires HTTPS in production (localhost exempt)
- **Speech-to-Text:** Web Speech API (browser-native, `en-US` / `bn-BD`)
- **Optional broadcasting:** Pusher / Laravel Echo wired (only enabled when `VITE_PUSHER_APP_KEY` is set)

---

## File handling & exports

| Purpose | Tool |
|---|---|
| PDF generation | [barryvdh/laravel-dompdf](https://github.com/barryvdh/laravel-dompdf) wrapping **DomPDF v3** |
| Excel / Spreadsheets | **PhpSpreadsheet** |
| PowerPoint | **PhpOffice/PhpPresentation** (PPTX upload + parse for shared meeting screens) |
| CAD preview (DXF) | **dxf-viewer** + **Three.js** (client-side rendering) |
| DWG → PDF conversion | **LibreOffice headless** |
| Image preview | Native browser, served from `storage/app/public` via `php artisan storage:link` |
| PDF popup viewer | Custom blob-URL approach to bypass IDM/FDM download-manager extensions |

**PDF specifics:**
- Default font: DejaVu Sans (Unicode + Bengali Taka `৳` support)
- Font cache in `storage/fonts`, sourced from `vendor/dompdf/dompdf/lib/fonts`
- `font_dir` pointed directly at the vendor bundle to avoid TTF / `.ufm` glyph-map mismatches
- `enable_font_subsetting => false` to prevent subset corruption on complex layouts

---

## State & data flow

| Concern | Implementation |
|---|---|
| Forms | Inertia's `useForm()` — `post` / `put` / `transform` / `forceFormData` |
| Notifications | Custom `NotifyService` writing to `notifications` table with optional broadcasting |
| Settings | Custom `SettingService` with cache-backed key/value store (`Cache::rememberForever('app_settings')`) |
| Change management | Polymorphic `entity_revisions` table + `RevisionTracker` service (event timeline, JSON snapshots, field-level diffs, auto-summaries) |
| Threaded discussion | Polymorphic `entity_comments` table for two-way preparer ↔ approver conversations |
| Approval chains | Multi-level approval routing on `quotation_approvals` and `cost_estimate_approvals` with threshold-based bypass |
| Audit trail | Generic `AuditService` |

---

## Project conventions

- **Routing:** All routes in `routes/web.php`, grouped by module.
- **Pages:** Inertia pages under `resources/js/Pages/{Module}/{Action}.tsx` mirroring routes.
- **Controllers:** `app/Http/Controllers/{Module}Controller.php` (one per module, plus `Admin/*` and `Customer/*` namespaces).
- **Models:** Singular names (`Rfq`, `Quotation`, `CostEstimate`).
- **Migrations:** Timestamped, additive — never edited after merge.
- **Seeders:** All seeded users/customers default to password `password`.

---

## Dev environment

- **Local stack:** XAMPP (Apache 2.4 + MySQL + PHP 8.2)
- **OS:** Windows 10
- **Server:** `php artisan serve` on port 8000 OR direct via XAMPP Apache
- **Hot reload:** `npm run dev` (Vite dev server)
- **Production build:** `npm run build` → `public/build/manifest.json`
- **PWA:** Installable web app (manifest configured)

---

## Domain modules / services

| Module | Service / Notes |
|---|---|
| Pipeline | RFQ → Cost Estimate → Quotation → Work Order → Delivery → Invoice |
| Job number generation | `JobNumberService` |
| Operation sheet | `OperationSheetService` |
| MRP | `MRPService` |
| PCD release | `PcdReleaseService` |
| Live NOC dashboard | `LiveDashboardService` |
| Machine health | `MachineHealthService` |
| Quotation approvals | `QuotationService` with multi-level approval chains (threshold-based routing) |
| RFQ automation | `RfqAutomationService` (duplicate detection, auto-estimate, follow-up tracking) |
| Meeting intelligence | `MeetingIntelligenceService` (auto-summary, action item extraction) |
| PPTX parsing | `PptxParser` for uploaded slides |
| Cost calculation | Excel cost calculator replicated — 3 pricing groups (A/B/C), ~70 materials, ~70 operations |

---

## Security & ops

- **CSRF:** Laravel `VerifyCsrfToken` middleware
- **Session:** File-based (configurable to DB / Redis)
- **Password hashing:** Auto via Eloquent `'password' => 'hashed'` cast — **never** wrap in `Hash::make()` manually (causes double-hashing and broken login)
- **File upload validation:** MIME-type + size constraints per endpoint
- **Sandboxed PDF generation:** DomPDF chroot to `base_path()`
- **Permission middleware aliases:** `role`, `permission`, `role_or_permission`

---

## Quick commands

```bash
# Setup
composer install
npm install                  # or: npm install --legacy-peer-deps
cp .env.example .env
php artisan key:generate
php artisan migrate --seed
php artisan storage:link

# Dev
npm run dev                  # Vite dev server (hot reload)
php artisan serve            # Laravel on :8000

# Build
npm run build                # Production assets
php artisan optimize

# Common debug
php artisan route:list --path=<prefix>
php artisan tinker
tail -f storage/logs/laravel.log
```

---

## Built features (non-AI inventory)

- 13 core modules (IED, PCD, Shops, QC, Delivery, Invoicing, Reports, etc.)
- Full RFQ → Cost Estimate → Quotation → Work Order → Delivery → Invoice pipeline
- Dynamic multi-level approval chains for quotations + cost estimates
- Visual Gantt progress tracking on work orders
- Live NOC dashboard with day/night mood theme
- PWA installable app
- Role-based access control with Spatie
- Customer Portal (separate guard)
- Multi-center architecture
- Document scanning support (image + PDF upload)
- 4-phase Meeting Room (chat + voice input + WebRTC calls + intelligence)
- Report generation (Excel, PDF, PPTX, SVG charts)
- PPTX file upload + shared screen rendering
- Two-way comment thread on cost estimates and quotations
- Polymorphic change-management timeline with field-level diffs
- File manager with folder organization
- DXF / DWG / image preview lightbox
- Quotation attachments (annexures, specs uploaded by preparer)
- RFQ attachment inheritance through cost estimate → quotation
- Source cost-estimate PDF preview popup (blob-URL based, IDM-bypass)
