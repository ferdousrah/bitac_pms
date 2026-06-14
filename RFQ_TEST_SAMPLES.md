# RFQ Test Samples

Two realistic BITAC-flavoured test cases — based on the actual kinds of work the centre handles (pumps, sugar mills, BWDB, Bangladesh Railway, etc.). Both are scoped so you can type/copy each field directly into `/rfqs/create`.

---

## 🅰️ Single-item RFQ — Sugar Mill Repair Part

### Customer Details

| Field | Value |
|---|---|
| Customer | ACI Motors (or any existing) |
| Customer Ref / PO No. | `BPDB-SUGAR-2026-T1-018` |
| Job Category | Spare Parts |
| Job Type | **Regular** |
| Required By | `2026-08-15` |
| Internal Notes | `Mill shutdown scheduled — please prioritise machining slot in Shop A.` |

### RFQ Letter
- **Title:** `Request for Quotation — Cane Mill Top Roller Bearing`
- **Upload:** any PDF (≤ 10 MB)

### Item 1

| Field | Value |
|---|---|
| Product | *(leave blank — use Job Description)* |
| Job Description | `Cane Mill Top Roller Bearing Housing — SS304 fabrication as per existing damaged unit. Inner bore Ø180 H7, outer Ø320 mm, height 145 mm. Surface finish Ra 1.6 µm on bore.` |
| Quantity | `2` |
| Unit | `pcs` |
| Item Notes | `Heat treatment + induction hardening on bore surface required.` |
| Reference Type | **Drawing + Sample** |
| Sample Description | `One damaged unit will be brought in for comparison.` |
| Drawing files | Upload a `.pdf` / `.dwg` |
| Sample Photos | One photo of the worn bearing |

---

## 🅱️ Multi-item RFQ — Bangladesh Railway Loco Workshop Order

### Customer Details

| Field | Value |
|---|---|
| Customer | Bangladesh Railway |
| Customer Ref / PO No. | `BR-MECH-2026-0042` |
| Job Category | Machining |
| Job Type | **Regular** |
| Required By | `2026-09-30` |
| Internal Notes | `MoR delegation visiting BITAC on 25 July to inspect interim progress.` |

### RFQ Letter
- **Title:** `Manufacturing Order — DEMU Brake Cylinder + Coupler Components`
- **Upload:** any PDF

### Item 1 — Brake Cylinder Body

| Field | Value |
|---|---|
| Job Description | `DEMU Brake Cylinder Body — Cast Iron (Grade 250), bore Ø125 H8, stroke 254 mm, drilled/tapped per BR drawing BR-MC-450/B.` |
| Quantity | `12` |
| Unit | `pcs` |
| Reference Type | **Drawing** |
| Item Notes | `Hydrostatic test certificate required at 1.5× working pressure.` |

### Item 2 — Piston Assembly

| Field | Value |
|---|---|
| Job Description | `Brake Cylinder Piston — Aluminium 6061-T6, Ø124.5 g6, with EPDM gasket groove. Surface finish Ra 0.8 µm on OD.` |
| Quantity | `12` |
| Unit | `set` |
| Reference Type | **Drawing** |
| Item Notes | `Match-machined with corresponding cylinder body from Item 1.` |

### Item 3 — Coupling Link

| Field | Value |
|---|---|
| Job Description | `Coupling Link Forging — Mild Steel EN8, 38 mm × 76 mm × 285 mm, eye dia 42 mm both ends. Normalised after forging.` |
| Quantity | `24` |
| Unit | `pcs` |
| Reference Type | **Physical sample** |
| Sample Description | `One service-used coupling link sent as profile reference.` |

### Item 4 — Brake Shoe Adjuster Spindle

| Field | Value |
|---|---|
| Job Description | `Brake Shoe Adjuster Spindle — Mild Steel, M20 trapezoidal thread Tr20×4, length 320 mm, knurled head.` |
| Quantity | `48` |
| Unit | `pcs` |
| Reference Type | **None** |
| Item Notes | `Match the thread pitch verified from sample-shoe assembly.` |

---

## Tips for the test run

- **Single-item case** exercises: drawing + sample upload, heat-treatment material, surface-finish notes — gives the Cost Estimate a chance to use multiple sections (Material + Machining + Heat Treatment).
- **Multi-item case** exercises: 4 distinct items (so 4 separate job numbers will be allocated by PCD later), mixed reference types (drawing-only, sample-only, none), variety of units (`pcs`, `set`).
- After saving, walk the full pipeline end-to-end:
  1. `/rfqs` → view the new RFQ
  2. Create Cost Estimate from the RFQ item
  3. Convert to Quotation → approve
  4. Customer issues Work Order (via `/customer/rfqs/{id}`)
  5. IED accepts in `/ied/work-orders` → forwards to PCD (with optional note)
  6. PCD sets the job number on `/pcd/work-orders/{id}/sections`
  7. Material Requisition → Operation Sheet → Release to Shops
