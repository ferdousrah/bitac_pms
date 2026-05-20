# BITAC PMS — Sample Test Data

End-to-end test scenarios for the full workflow:
**Customer → RFQ → Cost Estimate → Quotation → Job → PCD Work Order → Operation Sheet → MRN → Portfolio**

Three scenarios provided — each covers a different combination:

| Scenario | Job Type | Items | Tests |
|---|---|---|---|
| **1 — BPDB Power Plant** | Regular | **Multiple (2 items)** | Multi-line description, multi-row items table, full flow |
| **2 — Square Pharma Prototype** | **R&D** | **Single (1 item)** | R&D badge propagation, single-item simplicity |
| **3 — ACI Motors Pump Impeller** | Regular | **Single (1 item)** | Quickest happy-path test |

Run **Scenario 3 first** for fastest validation, then Scenario 1 to test multi-item handling, then Scenario 2 to test R&D flow.

> **Tip:** wipe existing transactional data first via **Admin → System → Reset / Wipe Data** so you start from a clean slate.

---

## ⚡ Scenario 3 — ACI Motors (Regular · **Single Item**) — Quickest Test

Simplest happy-path run. Single line item, single cost estimate, single quotation. Use this first to validate that the basic flow works before testing multi-item or R&D variants.

### Customer
| Field | Value |
|---|---|
| Name | `ACI Motors Ltd.` |
| Contact Person | `Md. Shoeb Hossain` |
| Email | `shoeb@acimotors.com.bd` |
| Phone | `01713-456789` |
| Address | `Tejgaon Industrial Area, Dhaka` |

### RFQ
| Field | Value |
|---|---|
| Customer | `ACI Motors Ltd.` |
| Customer Ref | `ACI/PO/2026-0501` |
| **Job Type** | `Regular` |
| Required By | `2026-08-30` |
| Internal Notes | `Standard reorder — same spec as last batch.` |

**Single Item**:
```
Custom Pump Impeller, Centrifugal, Cast SS304, 6-vane closed-type, Ø180 mm.
Static balance grade G2.5, surface finish Ra 1.6 µm on hydraulic surfaces.
```
- Quantity: `60`
- Unit: `pcs`
- Reference Type: `Drawing`

### Cost Estimate

| Field | Value |
|---|---|
| Job Name | `Pump Impeller — Cast SS304 Ø180 mm` |
| Part No | `PI-SS304-180` |
| Pricing Group | `B` |
| Job Quantity | `60` |
| Times Multiplier | `2.0` |
| Overhead % | `10` |
| VAT % | `15` |

**Materials**:
| Material | Qty | Unit | Rate |
|---|---|---|---|
| Stainless Steel 304 | 12 | kg | 650 |

**Machining**:
| Operation | Hours |
|---|---|
| Turning Operation | 7 |
| Milling Operation | 4 |

### Quotation
- Memo No: `36.06.2692.028.51.028(2).26.91`
- Recipient: `ACI Motors Ltd. / Tejgaon Industrial Area, Dhaka`
- Default 5 terms — keep as-is
- Submit → Approve

### Convert to Job
- PO No: `ACI-PO-2026-0501`
- Priority: `normal`
- Due Date: `2026-08-30`

### PCD Work Order Routing
1. Foundry — `Casting (investment)`
2. Machine Shop — `Turning + milling 6-vane profile`
3. Surface Treatment — `Pickling + passivation`
4. QC — `Static balance G2.5 + surface roughness check`

### Operation Sheet (4 steps, equal split = 25% each)

| Sl | Operation | Section | Hrs | Weight % |
|---|---|---|---|---|
| 1 | Investment casting | Foundry | 6 | **25** |
| 2 | Turning + 6-vane milling | Machine Shop | 8 | **25** |
| 3 | Pickling + passivation | Surface Treatment | 3 | **25** |
| 4 | Balance + surface QC | QC | 2 | **25** |

Total: 100% ✓ — or use **Equal Split** button.

### Material Requisition
| Material | Qty | Unit |
|---|---|---|
| Stainless Steel 304 | 12 | kg |
| Pickling Acid (HNO3) | 2 | L |
| Passivation Solution | 1 | L |

---

## 📋 Scenario 1 — BPDB Sylhet 225 MW (Regular · **Multiple Items**)

Bearing re-metaling + seal manufacturing — bundled into one RFQ. Two line items, each with its own cost estimate. Tests how the system handles multi-line descriptions and parallel cost estimate chains.

---

### Step 1 — Customer (Admin → Master Data → Customers → New)

| Field | Value |
|---|---|
| Name | `Bangladesh Power Development Board (BPDB)` |
| Contact Person | `Mir Md. Anisuzzaman` |
| Designation | `Executive Engineer` |
| Email | `anisuzzaman.engineer@bpdb.gov.bd` |
| Phone | `01914-894085` |
| Address | `Sylhet 225 MW CCPP, Kumargaon, Sylhet` |
| Active | ✓ |

---

### Step 2 — RFQ (`/rfqs/create`)

| Field | Value |
|---|---|
| Customer | `Bangladesh Power Development Board (BPDB)` |
| Customer Ref / PO No | `27.11.9100.406.01.701.26.86` |
| **Job Type** | `Regular` |
| Required By | `2026-08-15` |
| Internal Notes | `Routine maintenance shutdown — strict deadline.` |

**Item 1** (textarea — multi-line):
```
Re-Metaling of Journal Bearing (Casting Deposition).
Size: Ø320 × 350 mm (Approximately)
Materials: White Metal (Tin Base) with DP Test.
```
- Quantity: `1`
- Unit: `Nos`
- Reference Type: `Drawing` — upload any test PDF (will flow through to PCD attachments)

**Item 2** (textarea — multi-line):
```
Manufacturing of Seal, Machining of Seal Groove & Inserting of Seal.
OD-638 × ID-618 × T-2 mm — 07 Pcs (Brass)
OD-468 × ID-448 × T-2 mm — 32 Pcs (Copper)
OD-378 × ID-358 × T-2 mm — 40+24 Pcs (Cu+Br)
OD-318 × ID-298 × T-2 mm — 07 Pcs (Brass)
```
- Quantity: `110`
- Unit: `Pcs`
- Reference Type: `Drawing`

---

### Step 3 — Cost Estimate (RFQ page → "Create Cost Estimate" per item)

#### For Item 1 — Journal Bearing

| Field | Value |
|---|---|
| Job Name | `Re-Metaling of Journal Bearing — Ø320×350mm` |
| Part No | `JB-Ø320-001` |
| Actual Size | `Ø320 × 350 mm` |
| Materials Size | `Ø340 × 360 mm (with allowance)` |
| Pricing Group | `B` |
| Job Quantity | `1` |
| Times Multiplier | `1.5` |
| Overhead % | `10` |
| VAT % | `15` |

**Materials**:
| Material | Qty | Unit | Rate |
|---|---|---|---|
| White Metal (Tin Base) | 25 | kg | 1,800 |
| DP Test Chemical Kit | 1 | set | 3,500 |

**Machining**:
| Operation | Hours |
|---|---|
| Pre-Machining (Turning) | 6 |
| Tin-Babbitt Casting Deposition | 4 |
| Final Machining (Boring & Finishing) | 8 |
| DP Test & Inspection | 2 |

Submit → Approve → status `finalized`.

---

### Step 4 — Quotation (Cost Estimate page → "Use as Quotation")

**Letter header** (auto-fill verified, override if needed):

| Field | Value |
|---|---|
| নং (Memo No) | `36.06.2692.028.51.028(2).26.92` |
| Customer Ref | (auto from RFQ — keep) |
| Ref Date | (auto from RFQ — keep) |
| Recipient Block | (multi-line:) |

```
Executive Engineer
Sylhet 225 MW CCPP, BPDB,
Kumargaon, Sylhet.
```

**Terms & Conditions** — default 5 Bangla terms auto-populate, keep as-is.

**Submit for Approval** → Mr. Mir Md. Anisuzzaman logs in → Approve (test signature pad: draw inline OR use saved).

---

### Step 5 — Convert to Job

| Field | Value |
|---|---|
| Customer PO No | `BPDB/SYL/PO-2026-0427` |
| Priority | `urgent` |
| Due Date | `2026-08-15` |
| Notes | `Routine maintenance shutdown — strict deadline.` |
| Customer PO File | upload any test PDF |

---

### Step 6 — PCD Work Order (Production Shop Routing)

**Sections in order**:
1. Foundry / Casting Shop — Operation: `Pattern preparation, Casting`
2. Machine Shop — Operation: `Rough turning, Boring`
3. Heat Treatment — Operation: `Stress relief annealing`
4. Machine Shop — Operation: `Finish turning, Tolerance grinding`
5. QC / Inspection — Operation: `DP Test, Dimensional QC, Final inspection`

---

### Step 7 — Operation Sheet (with Weight %)

| Sl | Operation | Section | Est. Hrs | **Weight %** |
|---|---|---|---|---|
| 1 | Pattern preparation | Foundry | 4 | **10** |
| 2 | Tin-Babbitt casting deposition | Foundry | 8 | **25** |
| 3 | Cooling + de-burring | Foundry | 2 | **5** |
| 4 | Rough turning (OD/ID) | Machine Shop | 6 | **15** |
| 5 | Heat treatment (stress relief) | Heat Treatment | 4 | **10** |
| 6 | Finish turning + boring | Machine Shop | 8 | **20** |
| 7 | DP Test + dimensional QC | QC | 2 | **10** |
| 8 | Final inspection + packing | QC | 1 | **5** |

**Total: 100%** ✓ — or hit **By Hours** auto-balance.

---

### Step 8 — Material Requisition

| Material | Qty | Unit |
|---|---|---|
| White Metal (Tin Base) | 25 | kg |
| Brass Round Bar (Ø650) | 8 | kg |
| Copper Round Bar (Ø480) | 15 | kg |
| DP Test Chemical Kit | 1 | set |

Submit → keep status `sent_to_ims` (or simulate IMS approval).

---

## 🧪 Scenario 2 — Square Pharmaceuticals (**R&D** · Single Item)

Custom precision component — testing R&D Job Type flow with one item only. The R&D badge should propagate from RFQ → Estimate → Quotation → Job → PCD Inbox → PCD Detail.

---

### Customer

| Field | Value |
|---|---|
| Name | `Square Pharmaceuticals Ltd.` |
| Contact Person | `Dr. Tasnim Rahman` |
| Designation | `Head of Engineering` |
| Email | `t.rahman@squarepharma.com.bd` |
| Phone | `01711-234567` |
| Address | `Salgaria, Pabna` |

---

### RFQ

| Field | Value |
|---|---|
| Customer | `Square Pharmaceuticals Ltd.` |
| Customer Ref | `SP/RD/2026-014` |
| **Job Type** | **`R&D`** ← test the new field |
| Required By | `2026-09-30` |
| Internal Notes | `Prototype — geometry may evolve during trial. Phase-1 deliverable.` |

**Item 1**:
```
Custom Tablet Compression Punch — Prototype.
Material: D2 Tool Steel, hardened HRC 58–60.
Cup profile: 12 mm Ø, custom logo embossing.
Tolerance: ±0.01 mm on cup, ±0.005 mm on stem.
Surface finish: Ra 0.4 µm on contact surfaces.
```
- Quantity: `4`
- Unit: `Sets`
- Reference Type: `Drawing` + `Physical Sample` (mark "Sample received")
- Sample description: `One worn punch from existing tooling line.`

---

### Cost Estimate

| Field | Value |
|---|---|
| Job Name | `Custom Tablet Compression Punch — D2 Tool Steel` |
| Part No | `TCP-D2-PROTO-01` |
| Pricing Group | `C` (premium for R&D) |
| Job Quantity | `4` |
| Times Multiplier | `2.5` (R&D loading) |
| Overhead % | `15` |
| VAT % | `15` |

**Materials**:
| Material | Qty | Unit | Rate |
|---|---|---|---|
| D2 Tool Steel Round Bar | 4 | kg | 2,800 |
| Heat Treatment Salt Bath | 1 | batch | 6,500 |

**Machining**:
| Operation | Hours |
|---|---|
| CNC Turning | 6 |
| Wire EDM (Profile + Logo) | 12 |
| Heat Treatment | 8 |
| Surface Grinding | 5 |
| Mirror Polishing | 4 |
| First Article Inspection | 3 |

---

### Quotation Letter

| Field | Value |
|---|---|
| Memo No | `36.06.2692.028.51.028(2).26.93` |
| Recipient |  |

```
Dr. Tasnim Rahman
Head of Engineering
Square Pharmaceuticals Ltd.
Salgaria, Pabna.
```

**Override 1st default term** to:
```
এই দরপত্র ইস্যুর তারিখ হতে ০২ মাস পর্যন্ত কার্যাদেশ প্রদানের জন্য বহাল থাকবে। (R&D scope; geometry may need revision after first-article approval.)
```

---

### Convert to Job

| Field | Value |
|---|---|
| Customer PO No | `SP-PO-RD-2026-014` |
| Priority | `normal` |
| Due Date | `2026-09-30` |

---

### Work Order Routing

1. Machine Shop — `CNC Turning of blanks`
2. Machine Shop — `Wire EDM — profile + embossing`
3. Heat Treatment — `Salt bath hardening HRC 58–60`
4. Machine Shop — `Surface grinding`
5. Surface Treatment — `Mirror polishing Ra 0.4 µm`
6. QC — `First-article CMM inspection + dimensional report`

---

### Operation Sheet (Weight %)

| Sl | Operation | Section | Est. Hrs | Weight % |
|---|---|---|---|---|
| 1 | CNC Turning — rough blank | Machine Shop | 4 | **8** |
| 2 | CNC Turning — finish profile | Machine Shop | 2 | **6** |
| 3 | Wire EDM — cup profile | Machine Shop | 6 | **18** |
| 4 | Wire EDM — logo embossing | Machine Shop | 6 | **18** |
| 5 | Salt bath hardening | Heat Treatment | 8 | **15** |
| 6 | Surface grinding | Machine Shop | 5 | **12** |
| 7 | Mirror polishing | Surface Treatment | 4 | **10** |
| 8 | First-article CMM inspection | QC | 2 | **8** |
| 9 | Documentation + packing | QC | 1 | **5** |

**Total: 100%** ✓

---

## 🖼 Scenario 3 — Portfolio Entry (Admin → Master Data → Portfolio → New)

Add after Scenario 1 is completed so the BPDB job appears as public showcase.

| Field | Value |
|---|---|
| Title | `Journal Bearing Re-Metaling — Sylhet 225 MW Power Plant` |
| Client | `Bangladesh Power Development Board (BPDB)` |
| Category | `Casting` |
| Completed On | `2026-07-30` |
| Display Order | `1` |
| Publish | ✓ |

**Summary** (300 chars):
```
Tin-Babbitt re-metaling of journal bearing (Ø320×350mm) for routine maintenance of BPDB's Sylhet 225 MW combined-cycle power plant. Delivered within the 15-day shutdown window.
```

**Full Description**:
```
BITAC delivered a complete casting deposition + machining + DP-tested
journal bearing for the high-pressure turbine assembly at Sylhet 225 MW
CCPP. The job involved white-metal (Tin-Babbitt) layer build-up over a
worn bronze sleeve, precision boring to factory tolerance, and dye
penetrant testing to certify metallurgical integrity.

Delivered within the 15-day maintenance shutdown window, allowing BPDB
to resume electricity generation on schedule.
```

**Technical Specs** (label / value):
| Label | Value |
|---|---|
| Material | `White Metal (Tin Base) over Bronze` |
| Dimensions | `Ø320 × 350 mm` |
| Tolerance | `±0.02 mm on bore` |
| Inspection | `DP Test + dimensional check` |
| Lead time | `15 days` |
| Plant | `Sylhet 225 MW CCPP, Kumargaon` |

**Cover image + 3-5 gallery photos** — any test images.

Save → check `/portfolio` (open in incognito to confirm no-auth).

---

## ✅ What This Tests

| Feature | Where in flow |
|---|---|
| Multi-line job description (textarea + newline preservation) | RFQ items |
| Job Type badge (Regular vs R&D) | All entities — RFQ list, Estimate, Quotation, Job, PCD |
| RFQ PDF (plain BITAC paper style) | RFQ view → PDF |
| Cost Estimate weight rollup → grand total match | Cost Estimate Show |
| Quotation VAT-inclusive math | Quotation Show + PDF |
| Quotation letter header — Memo No, Ref, Date, Recipient, Bangla Terms | Quotation PDF |
| Approver signature pad (saved + draw inline) | Approval modal |
| Operation Sheet **Weight %** + auto-balance | Operation Sheet builder |
| Job Progress card with weighted % + current step | Job (WorkOrder) Show |
| PCD All Job Documents — aggregated from RFQ + Quotation + WO | PCD Job Detail |
| PCD Source Documents — RFQ + Quotation PDF preview popups | PCD Job Detail |
| Job # global search (Ctrl+K) — accepts "37705", "Job#37705", "#37705" | Anywhere |
| Public Portfolio | `/portfolio` (no login) |
| Sample Data Wipe | super-admin → Admin → System → Reset |

---

**Order to run**: Scenario 1 (full flow, Regular) → Scenario 2 (R&D variant) → Scenario 3 (Portfolio publish). Then test Wipe at the end to restore clean state.
