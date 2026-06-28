<?php

namespace App\Http\Controllers\Pcd;

use App\Http\Controllers\Controller;
use App\Models\Section;
use App\Models\WorkOrder;
use App\Services\PcdReleaseService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;

class WorkOrderSectionController extends Controller
{
    public function edit(WorkOrder $workOrder)
    {
        // Load the full audit chain so we can render BITAC's official Work Order
        // form layout (job items + customer + delivery date + section routing).
        $workOrder->load([
            'customer',
            'sections.section',
            'rfq.items.product',
            'quotation.rfq.items.product',
            'items',
            'createdBy',
        ]);

        // Job items come from work_order_items (the PCD-editable copy) when
        // present; fall back to the RFQ source for legacy WOs that don't have
        // their own item rows yet.
        if ($workOrder->items->isNotEmpty()) {
            $jobItems = $workOrder->items->values()->map(fn ($i, $idx) => [
                'id'          => $i->id,
                'sequence'    => $idx + 1,
                'description' => $i->description,
                'part_no'     => $i->part_no,
                'quantity'    => (float) $i->quantity,
                'unit'        => $i->unit ?? 'pcs',
                'pcd_note'    => $i->pcd_note,
            ])->values();
        } else {
            $rfq = $workOrder->rfq ?? $workOrder->quotation?->rfq;
            $jobItems = ($rfq?->items ?? collect())->values()->map(fn ($i, $idx) => [
                'id'          => null,
                'sequence'    => $idx + 1,
                'description' => $i->job_description ?? $i->product?->name ?? '—',
                'part_no'     => null,
                'quantity'    => (float) $i->quantity,
                'unit'        => $i->unit ?? 'pcs',
                'pcd_note'    => null,
            ])->values();
        }

        // Pre-fill the job number input with the next sequential number when
        // the WO doesn't have one yet. JobNumberService::next() peeks at
        // max(job_number) + 1 without consuming the sequence, so this is safe
        // to call on every form load. PCD officer can override before saving.
        $suggestedJobNumber = $workOrder->job_number
            ?: \App\Services\JobNumberService::format(\App\Services\JobNumberService::next());

        return Inertia::render('Pcd/SectionAssign', [
            'work_order' => [
                'id'             => $workOrder->id,
                'wo_number'      => $workOrder->wo_number,
                'job_number'     => $workOrder->job_number,
                'suggested_job_number' => $suggestedJobNumber,
                // কার্যবিন্যাস (department) — defaults to PCD per BITAC's paper
                // convention. PCD officer can override before saving.
                'department'     => $workOrder->department ?: 'উৎপাদন নিয়ন্ত্রণ বিভাগ (PCD)',
                'customer'       => $workOrder->customer?->name,
                'customer_po_no' => $workOrder->customer_po_no,
                'status'         => $workOrder->status,
                'created_at'     => $workOrder->created_at->format('d/m/Y'),
                // Y-m-d for the editable date input on the form.
                'due_date'       => $workOrder->due_date?->format('Y-m-d'),
                'prepared_by'    => $workOrder->createdBy?->name ?? auth()->user()?->name ?? '—',
            ],
            'job_items' => $jobItems,
            'assigned_sections' => $workOrder->sections->map(fn($s) => [
                'id'         => $s->id,
                'section_id' => $s->section_id,
                'section'    => ['id' => $s->section->id, 'name' => $s->section->name, 'code' => $s->section->code, 'name_bn' => $s->section->name_bn],
                'sequence'   => $s->sequence,
                'status'     => $s->status,
                'notes'      => $s->notes,
                'qc_notes'   => $s->qc_notes,
                'remarks'    => $s->remarks,
            ]),
            // Available palette = production shops + QC (so QC can be inserted
            // as an explicit routing stop). Other functional sections (IED,
            // PCD, Stores) are intentionally excluded — they aren't shop
            // floors.
            'available_sections' => Section::active()
                ->where(function ($q) {
                    $q->where('type', 'production_shop')
                      ->orWhere('code', 'QC');
                })
                ->orderBy('display_order')
                ->get(['id', 'name', 'code', 'name_bn']),
        ]);
    }

    public function update(Request $request, WorkOrder $workOrder)
    {
        $validated = $request->validate([
            'job_number'            => [
                'required', 'string', 'max:50',
                \Illuminate\Validation\Rule::unique('work_orders', 'job_number')->ignore($workOrder->id),
            ],
            'department'            => 'nullable|string|max:200',
            'due_date'              => 'nullable|date',
            'sections'              => 'required|array|min:1',
            'sections.*.section_id' => 'required|exists:sections,id',
            'sections.*.notes'      => 'nullable|string|max:2000',
            'sections.*.qc_notes'   => 'nullable|string|max:2000',
            'sections.*.remarks'    => 'nullable|string|max:2000',
            // PCD edits to each item — description, part no, qty + per-item note.
            'items'                 => 'nullable|array',
            'items.*.id'            => 'nullable|integer',
            'items.*.description'   => 'nullable|string|max:1000',
            'items.*.part_no'       => 'nullable|string|max:100',
            'items.*.quantity'      => 'nullable|numeric|min:0',
            'items.*.pcd_note'      => 'nullable|string|max:1000',
        ], [
            'job_number.unique' => 'This job number is already used on another work order.',
        ]);

        DB::transaction(function () use ($workOrder, $validated) {
            // Stamp the job number on the WO only. Per-item job numbers are
            // independent (work_order_items.job_number has a UNIQUE index, so
            // we can't blanket-fill them with the same number) and are
            // allocated separately when an actual per-item identifier is needed.
            $jobNumber = trim($validated['job_number']);
            $workOrder->update([
                'job_number'  => $jobNumber,
                'department'  => $validated['department'] ?? null,
                'due_date'    => $validated['due_date'] ?? null,
                // Whoever submits the PCD Work Order form is the "Prepared By"
                // on the printed sheet — stamped once, then preserved.
                'prepared_by' => $workOrder->prepared_by ?? auth()->id(),
            ]);

            // Persist PCD's per-item edits (description, part no, qty + note).
            // Only rows with a matching id are updated — new rows aren't created here.
            foreach ($validated['items'] ?? [] as $row) {
                if (empty($row['id'])) continue;
                $update = [
                    'description' => $row['description'] ?? null,
                    'part_no'     => $row['part_no'] ?? null,
                    'pcd_note'    => $row['pcd_note'] ?? null,
                ];
                if (isset($row['quantity']) && $row['quantity'] !== '') {
                    $update['quantity'] = (float) $row['quantity'];
                }
                $workOrder->items()->where('id', (int) $row['id'])->update($update);
            }

            // Wipe and recreate sections to preserve sequence
            $workOrder->sections()->delete();
            foreach ($validated['sections'] as $idx => $row) {
                $workOrder->sections()->create([
                    'section_id' => $row['section_id'],
                    'sequence'   => $idx + 1,
                    'status'     => 'pending',
                    'notes'      => $row['notes'] ?? null,
                    'qc_notes'   => $row['qc_notes'] ?? null,
                    'remarks'    => $row['remarks'] ?? null,
                ]);
            }

            // If the WO was already released to shops, re-activate the first
            // section so it appears in the production queue (the wipe-and-recreate
            // above would otherwise leave every section in `pending`).
            if ($workOrder->released_to_shops_at) {
                $first = $workOrder->sections()->orderBy('sequence')->first();
                $first?->update(['status' => 'ready']);
            }
        });

        // Try to release if other PCD steps are also done
        PcdReleaseService::tryRelease($workOrder->fresh());

        return redirect()->route('pcd.inbox.show', $workOrder)
            ->with('success', 'Section assignment saved.');
    }

    /**
     * Render the PCD Work Order form as a PDF on BITAC letterhead.
     *
     *   ?preview=base64 → JSON { data, filename, size } for the popup
     *   ?preview=1      → inline PDF stream
     *   (none)          → force download
     *   ?lang=en|bn     → letterhead language (defaults to bn / bilingual)
     */
    public function pdf(Request $request, WorkOrder $workOrder)
    {
        $workOrder->load([
            'customer',
            'sections.section',
            'items.product',
            'rfq.items.product',
            'quotation.rfq.items.product',
            'createdBy',
            'preparedBy',
            'pcdHandoffBy',
        ]);

        $esc = fn ($v) => htmlspecialchars((string) ($v ?? ''), ENT_QUOTES | ENT_HTML5, 'UTF-8');
        $fmt = fn ($v) => $v === null || $v === '' ? '—' : (is_numeric($v) ? rtrim(rtrim(number_format((float) $v, 2, '.', ''), '0'), '.') : $esc($v));

        $jobNumber  = $esc($workOrder->job_number ?: '—');
        $date       = $workOrder->pcd_handoff_at?->format('d-m-Y') ?? $workOrder->created_at?->format('d-m-Y') ?? '—';
        $delivery   = $workOrder->due_date?->format('d-m-Y') ?? '—';
        $department = $workOrder->department ?: 'Production Control Department (PCD)';
        $customer   = $esc($workOrder->customer?->name ?? '—');
        $customerPo = $esc($workOrder->customer_po_no ?? '');

        // Items — prefer the PCD-edited work_order_items, fall back to RFQ items.
        $items = $workOrder->items->isNotEmpty()
            ? $workOrder->items->values()
            : ($workOrder->rfq?->items ?? $workOrder->quotation?->rfq?->items ?? collect());

        $itemCount = $items->count() ?: 1;

        // ── Centered title (English) — mirrors BITAC paper layout.
        $titleBlock = '<div style="text-align: center; margin-bottom: 8pt;">'
            . '<div style="font-size: 14pt; font-weight: bold; color: #000; letter-spacing: 1pt;">WORK ORDER</div>'
            . '</div>';

        // ── Items table — mirrors BITAC paper:
        //   Top row spans the table with "Job No.: X" left, "Date: X" right.
        //   Cols: Department | Customer | Job Description | Part No | Quantity | Remarks
        //   Department + Customer cells span all item rows (rowspan).
        $itemsHtml  = '<table width="100%" cellspacing="0" cellpadding="0" style="border-collapse: collapse; border: 0.75pt solid #000; margin-bottom: 14pt;">';
        // Job number / Date strip — spans all 6 columns.
        $itemsHtml .= '<tr>'
            . '<td colspan="3" style="border: 0.75pt solid #000; padding: 4pt 6pt; font-size: 10pt;">'
            .   'Job No.: <b>' . $jobNumber . '</b>'
            . '</td>'
            . '<td colspan="3" style="border: 0.75pt solid #000; padding: 4pt 6pt; font-size: 10pt; text-align: right;">'
            .   'Date: <b>' . $esc($date) . '</b>'
            . '</td>'
            . '</tr>';
        // Column headers (6 columns)
        $itemsHtml .= '<tr style="background:#f3f4f6;">'
            . '<th style="border: 0.75pt solid #000; padding: 4pt; font-size: 9.5pt; width: 16%; vertical-align: middle; white-space: nowrap;">Department</th>'
            . '<th style="border: 0.75pt solid #000; padding: 4pt; font-size: 9.5pt; width: 14%; vertical-align: middle; white-space: nowrap;">Party Name</th>'
            . '<th style="border: 0.75pt solid #000; padding: 4pt; font-size: 9.5pt; vertical-align: middle;">Job Description</th>'
            . '<th style="border: 0.75pt solid #000; padding: 4pt; font-size: 9.5pt; width: 9%; vertical-align: middle;">Part No</th>'
            . '<th style="border: 0.75pt solid #000; padding: 4pt; font-size: 9.5pt; width: 9%; vertical-align: middle;">Qty</th>'
            . '<th style="border: 0.75pt solid #000; padding: 4pt; font-size: 9.5pt; width: 17%; vertical-align: middle;">Remarks</th>'
            . '</tr>';
        // Item rows — first row carries the rowspan'd Department + Customer cells.
        if ($items->isEmpty()) {
            $itemsHtml .= '<tr>'
                . '<td style="border: 0.75pt solid #000; padding: 6pt; font-size: 10pt; vertical-align: top;"><b>' . $esc($department) . '</b></td>'
                . '<td style="border: 0.75pt solid #000; padding: 6pt; font-size: 10pt; vertical-align: top;"><b>' . $customer . '</b>'
                .   ($customerPo !== '' ? '<div style="font-size: 8.5pt; color: #555; font-family: dejavusansmono; margin-top: 2pt;">PO: ' . $customerPo . '</div>' : '')
                . '</td>'
                . '<td colspan="4" style="border: 0.75pt solid #000; padding: 10pt; font-size: 9pt; color: #666; text-align: center; font-style: italic;">No items.</td>'
                . '</tr>';
        } else {
            foreach ($items->values() as $idx => $i) {
                $desc    = $i->description ?? $i->job_description ?? $i->product?->name ?? '—';
                $qty     = $i->quantity ?? '';
                $unit    = $i->unit ?? 'pcs';
                $partNo  = !empty($i->part_no) ? $esc($i->part_no) : (($idx + 1) . '/' . $itemCount);
                $pcdNote = $i->pcd_note ?? '';

                $itemsHtml .= '<tr style="vertical-align: top;">';
                if ($idx === 0) {
                    $itemsHtml .= '<td rowspan="' . $itemCount . '" style="border: 0.75pt solid #000; padding: 6pt; font-size: 10pt; vertical-align: middle; text-align: center;"><b>' . $esc($department) . '</b></td>';
                    $itemsHtml .= '<td rowspan="' . $itemCount . '" style="border: 0.75pt solid #000; padding: 6pt; font-size: 10pt; vertical-align: middle;"><b>' . $customer . '</b>'
                        . ($customerPo !== '' ? '<div style="font-size: 8.5pt; color: #555; font-family: dejavusansmono; margin-top: 2pt;">PO: ' . $customerPo . '</div>' : '')
                        . '</td>';
                }
                $itemsHtml .= '<td style="border: 0.75pt solid #000; padding: 5pt 6pt; font-size: 9.5pt; vertical-align: top;">'
                    . '<b>' . ($idx + 1) . '. </b>' . nl2br($esc($desc))
                    . '</td>';
                $itemsHtml .= '<td style="border: 0.75pt solid #000; padding: 5pt 6pt; font-size: 10pt; text-align: center; vertical-align: middle; font-family: dejavusansmono;">' . $partNo . '</td>';
                $itemsHtml .= '<td style="border: 0.75pt solid #000; padding: 5pt 6pt; font-size: 10pt; text-align: center; vertical-align: middle;">' . $fmt($qty) . ' ' . $esc($unit) . '</td>';
                $itemsHtml .= '<td style="border: 0.75pt solid #000; padding: 5pt 6pt; font-size: 9pt; vertical-align: top; color: #333;">' . nl2br($esc($pcdNote)) . '</td>';
                $itemsHtml .= '</tr>';
            }
        }
        $itemsHtml .= '</table>';

        // ── Routing table — paper format (English):
        //   Section | Operation Time (Hr) | Receipt (Signature + Date) | Remarks
        $sections = $workOrder->sections->sortBy('sequence');
        $routingHtml  = '<table width="100%" cellspacing="0" cellpadding="0" style="border-collapse: collapse; border: 0.75pt solid #000; margin-bottom: 14pt;">';
        $routingHtml .= '<thead>'
            . '<tr>'
            .   '<th rowspan="2" style="border: 0.75pt solid #000; padding: 4pt; font-size: 9.5pt; width: 20%; vertical-align: middle;">Section</th>'
            .   '<th rowspan="2" style="border: 0.75pt solid #000; padding: 4pt; font-size: 9pt; width: 13%; vertical-align: middle;">Working Time / Hour</th>'
            .   '<th rowspan="2" style="border: 0.75pt solid #000; padding: 4pt; font-size: 9pt; width: 19%; vertical-align: middle;">Operation Hour / Task</th>'
            .   '<th colspan="2" style="border: 0.75pt solid #000; padding: 4pt; font-size: 9.5pt;">Receipt</th>'
            .   '<th rowspan="2" style="border: 0.75pt solid #000; padding: 4pt; font-size: 9.5pt; width: 18%; vertical-align: middle;">Remarks</th>'
            . '</tr>'
            . '<tr>'
            .   '<th style="border: 0.75pt solid #000; padding: 3pt; font-size: 9pt; width: 12%;">Signature</th>'
            .   '<th style="border: 0.75pt solid #000; padding: 3pt; font-size: 9pt; width: 14%;">Date</th>'
            . '</tr>'
            . '</thead><tbody>';
        if ($sections->isEmpty()) {
            $routingHtml .= '<tr><td colspan="6" style="border: 0.75pt solid #000; padding: 10pt; font-size: 9pt; color: #666; text-align: center; font-style: italic;">No sections assigned.</td></tr>';
        } else {
            foreach ($sections->values() as $s) {
                $secName    = $s->section?->name ?? '—';
                $operation  = $s->notes ?? '';
                $remarks    = $s->remarks ?? '';
                $signedDate = $s->completed_at?->format('d-m-Y') ?? '';

                $routingHtml .= '<tr style="vertical-align: top;">'
                    . '<td style="border: 0.75pt solid #000; padding: 5pt 6pt; font-size: 10pt;">'
                    .   '<b>' . $esc($secName) . '</b>'
                    . '</td>'
                    . '<td style="border: 0.75pt solid #000; padding: 5pt; min-height: 22pt;">&nbsp;</td>'
                    . '<td style="border: 0.75pt solid #000; padding: 5pt 6pt; font-size: 10pt;">' . nl2br($esc($operation)) . '</td>'
                    . '<td style="border: 0.75pt solid #000; padding: 5pt; min-height: 22pt;">&nbsp;</td>'
                    . '<td style="border: 0.75pt solid #000; padding: 5pt; font-size: 9pt; text-align: center;">' . $esc($signedDate) . '</td>'
                    . '<td style="border: 0.75pt solid #000; padding: 5pt 6pt; font-size: 9.5pt;">' . nl2br($esc($remarks)) . '</td>'
                    . '</tr>';
            }
            // Trailing supplier-date row (Delivery Date).
            if ($workOrder->due_date) {
                $routingHtml .= '<tr>'
                    . '<td colspan="5" style="border: 0.75pt solid #000; padding: 6pt;">&nbsp;</td>'
                    . '<td style="border: 0.75pt solid #000; padding: 5pt 6pt; font-size: 9.5pt; vertical-align: middle;">'
                    .   '<b>Delivery Date:</b><br>' . $esc($delivery)
                    . '</td>'
                    . '</tr>';
            }
        }
        $routingHtml .= '</tbody></table>';

        // ── Signature footer — three blocks per paper format (English)
        //   The Prepared By cell auto-fills from work_orders.prepared_by:
        //   signature image (if user.signature_path exists), name, designation.
        //   Verified By / Approved By stay blank for hand-signing on the print.
        $preparer = $workOrder->preparedBy;
        $sigImg   = '';
        if ($preparer && $preparer->signature_path) {
            $sigPath = storage_path('app/public/' . ltrim($preparer->signature_path, '/'));
            if (is_file($sigPath)) {
                // mPDF embeds local file:// images cleanly.
                $sigImg = '<img src="file://' . str_replace('\\', '/', $sigPath) . '" '
                    . 'style="max-height: 38pt; max-width: 80%;" />';
            }
        }
        $preparerName = $preparer ? $esc($preparer->name) : '';
        $preparerDesg = $preparer ? $esc($preparer->designation ?? '') : '';

        $preparedCell = '<div style="min-height: 46pt; padding-bottom: 4pt;">' . $sigImg . '</div>'
            . '<div style="border-top: 0.75pt solid #000; padding-top: 4pt; font-size: 10pt; color: #000;"><b>Prepared By</b></div>'
            . ($preparerName !== '' ? '<div style="font-size: 9.5pt; color: #000; margin-top: 1pt;">' . $preparerName . '</div>' : '')
            . ($preparerDesg !== '' ? '<div style="font-size: 8.5pt; color: #555; margin-top: 1pt;">' . $preparerDesg . '</div>' : '');

        $blankCell = fn (string $label) => '<div style="min-height: 46pt;">&nbsp;</div>'
            . '<div style="border-top: 0.75pt solid #000; padding-top: 4pt; font-size: 10pt; color: #000;"><b>' . $label . '</b></div>';

        $signatureBlock = '<table width="100%" cellspacing="0" cellpadding="0" style="margin-top: 28pt;">'
            . '<tr>'
            .   '<td width="33%" style="vertical-align: bottom; padding-right: 12pt; text-align: center;">' . $preparedCell . '</td>'
            .   '<td width="33%" style="vertical-align: bottom; padding: 0 6pt; text-align: center;">' . $blankCell('Verified By') . '</td>'
            .   '<td width="33%" style="vertical-align: bottom; padding-left: 12pt; text-align: center;">' . $blankCell('Approved By') . '</td>'
            . '</tr>'
            . '</table>';

        $bodyHtml = $titleBlock . $itemsHtml . $routingHtml . $signatureBlock;

        // PDF is English-only per spec — letterhead renders in English mode.
        $bytes = app(\App\Services\BitacLetterhead::class)->render($bodyHtml, "Work Order {$workOrder->wo_number}", null, 'en');
        $jobLabel = $workOrder->job_number ? "Job-{$workOrder->job_number}" : $workOrder->wo_number;
        $filename = "WorkOrder-{$jobLabel}.pdf";

        if ($request->query('preview') === 'base64') {
            return response()->json([
                'filename' => $filename,
                'size'     => strlen($bytes),
                'data'     => base64_encode($bytes),
            ]);
        }
        $disposition = $request->boolean('preview') ? 'inline' : 'attachment';
        return response($bytes, 200, [
            'Content-Type'        => 'application/pdf',
            'Content-Disposition' => $disposition . '; filename="' . $filename . '"',
            'Content-Length'      => strlen($bytes),
        ]);
    }
}
