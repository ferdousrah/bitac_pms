# BITAC — the client's own workflow and costing model

> **What this is:** the requirements as BITAC described them, kept so anyone
> picking the project up can see what the software was asked to replace. It was
> gathered from their staff and their paper forms before the build started.
>
> ⚠️ **This is the SOURCE, not the STATUS.** What actually shipped has moved on
> in places — sometimes because BITAC changed their mind mid-build. Where this
> file and `CLAUDE.md` disagree, **`CLAUDE.md` is what the code does**, and the
> differences that matter are called out below.
>
> The paper forms themselves are in **`client resource/`**, in the repo.

---

## 1. The department flow

```
IED → PCD → Shops (CNC, Machine Shop, Casting, Mold, Heat Treatment) → QC → Delivery
```

Every handoff is a formal step with documents passed between departments. That
is the point of the system: it replaces a paper-and-Excel process, so the
handoffs have to stay explicit rather than being collapsed for convenience.

### IED — Industrial Engineering Department
1. Create RFQ
2. **Cost calculation** — must match their existing Excel, *BITAC Job Costing Master File* (section 2)
3. Quotation: create → approve → submit to customer
4. Customer accepts, **or** asks for a revised quotation (new version, re-approved, re-submitted)
5. After acceptance + work order confirmation, IED sends quotation + work order + supporting documents to PCD as one **job package**

### PCD — Production Control Department
1. See new jobs sent by IED
2. **Material requisition** (to integrate with IMS later) — paper format: `client resource/Requisition by PCD.jpg`
3. **Section assign** — which sections work the job, in what sequence
4. **Operation sheet** — machine + operator per operation step
5. Once all three are done, the job becomes visible to the assigned shops

> ⚠️ **Changed since (2026-09-30).** PCD is now **two** screens, because the
> work is two people's: **PCD Inbox** (নির্বাহী প্রকৌশলী reads an arriving work
> order and forwards it, or sends it back to IED) and then **Job Planning**
> (সহকারী প্রকৌশলী does steps 2–5 above). See CLAUDE.md.

### Shops — one in-charge each
1. The in-charge sees only their assigned jobs
2. Can override or finalise the machine and operator assignment
3. When their shop's work is done, the job moves to the next shop in sequence
4. The last shop's completion sends it to QC

> ⚠️ **Changed since.** Work no longer auto-advances. Output is logged by
> quantity and the shop in-charge **explicitly transfers** what is finished, so
> a job can be part-way through two shops at once. See the production phases in
> CLAUDE.md.

### QC
1. Configurable inspection plans linked to work orders
2. Pass/fail logging, dimensional measurements, defect categorisation
3. NCR management and corrective-action tracking
4. Inspection reports stored and linked to the delivery documentation

### Delivery, billing, customer service
1. Delivery challan, gate pass and transport documents
2. Invoice linked to delivery confirmation, with tax and discount handling
3. Payment tracking and receivables
4. Customer service ticketing — post-delivery queries, warranty claims

> ⚠️ **Changed since (2026-09-29).** The delivery challan belongs to the
> delivery, but the **bill and the মূসক ৬.৩ are raised deliberately**, whenever
> accounts get to them — not as a side effect of confirming a delivery.

### Job correction, after delivery
1. The customer reports a correction is needed
2. A revised work order is created that **explicitly references the original job number**
3. It runs the normal IED → PCD → Shops → QC flow, tagged as a revision

---

## 2. The costing model

Source: `client resource/BITAC Job Costing Master File - PCD.xlsx` — 9 sheets
(Costing Sheet, HT Cal, HT Size, Weight Cal, Input Size, Conditions, Density,
Materials Rate, Machining).

BITAC ran their entire costing in this workbook, on individual PCs. Getting it
into the system was about capturing the data, versioning it, and tying it to a
quotation — not about improving the arithmetic. **Every field, multiplier and
master-list item was meant to match.**

### The costing sheet, header to grand total

**Header:** Company Name · Job Name · Job/Part No · Actual Size

| | Section | Row shape |
|---|---|---|
| **A** | Material Cost | Sl No, Material Name, Quantity (KG), Rate (TK/KG), Amount |
| **B** | Machining Cost | Sl No, Operation Name, Quantity (hours), Rate (TK/hour), Sub-total |
| **C** | Surface Treatment | as machining |
| **D** | Other Parts | Quantity (pcs), TK/pc |
| **E** | **Net Cost** | A + B + C + D |
| **F** | Overhead (%) | applied to E |
| **G** | VAT (%) | applied |
| **H** | Times (×) | precision / difficulty multiplier |
| **I** | **Total** | |
| **J** | **Grand Total** | I × job quantity |

Footer: Estimated By / Checked By / Approved By.

### Pricing groups
Every machining operation carries **three** rates, by customer type:

- **Group A** — small & cottage industry
- **Group B** — corporate / multinational / large industry
- **Group C** — import substitute

The group is chosen at the top of the costing form.

### Master data the workbook carries
- **Materials Rate** (~70 rows) — name + rate (Tk/kg). Quality steels (EN-24, EN-36, SKD-11, Hi-C Hi-Cr, D2, D3, Cr-12, H13), standard steels (cast iron, cast steel, medium carbon, SS 304/316L), non-ferrous (aluminium 6061, brass, bronzes, gun metal, copper, zinc, tin, lead, nickel, silver, gold) and specialty metals (titanium, tungsten, molybdenum, monel, nichrome, cobalt, tantalum …).
- **Density** — each material in kg/m³ *and* kg/in³, to turn volume into weight.
- **Machining** (~70 rows) — operation + Group A/B/C rates. Lathes, milling, grinding, drilling, shaping, slotting, boring, gear hobbing, sheet work, presses, welding, die & mould fitting, wire cut, VMC, EDM, embossing and marking, polishing, casting (gun metal, bronzes, aluminium, CI simple/complex, alloy CI), plating (bright/hard chrome, Zn, Zn+Cad, nickel), heat treatment, annealing, white metalling.

### Weight calculator (Weight Cal sheet)
Raw-material weight from dimensions × density, for **four shapes**:

1. **Rectangular** — L × W × H
2. **Square** — S × S × H
3. **Cylindrical** — π(D/2)² × H
4. **Cylindrical hollow** — π((D/2)² − (d/2)²) × H

With an **INCH / FEET / MM / M** toggle that converts. Then
`weight (kg) = volume (m³) × density`.

### Heat treatment calculator (HT Cal sheet)
Its own calculator, by job size and HT type.

---

> **Where the implementation stands**, including the part-wise costing that
> replaced whole-job estimates, the VAT/Tax model, approval chains and
> everything built since: **`CLAUDE.md`**. The task list, BITAC's decisions and
> what is still outstanding: **`docs/IED_BACKLOG.md`**.
