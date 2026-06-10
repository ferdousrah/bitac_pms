<?php

namespace App\Http\Controllers\Pcd;

use App\Http\Controllers\Controller;
use App\Models\Material;
use App\Models\MaterialRequisition;
use App\Models\WorkOrder;
use App\Services\PcdReleaseService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;

class MaterialRequisitionController extends Controller
{
    public function index()
    {
        $requisitions = MaterialRequisition::with('workOrder.customer', 'requestedBy', 'items')
            ->latest()
            ->paginate(20)
            ->through(fn($mr) => [
                'id'           => $mr->id,
                'mrn_number'   => $mr->mrn_number,
                'work_order'   => $mr->workOrder ? [
                    'id'         => $mr->workOrder->id,
                    'wo_number'  => $mr->workOrder->wo_number,
                    'job_number' => $mr->workOrder->job_number,
                    'customer'   => $mr->workOrder->customer?->name,
                ] : null,
                'request_date' => $mr->request_date?->format('d M Y'),
                'status'       => $mr->status,
                'item_count'   => $mr->items->count(),
                'requested_by' => $mr->requestedBy?->name,
            ]);

        return Inertia::render('Pcd/MaterialRequisition/Index', [
            'requisitions' => $requisitions,
        ]);
    }

    public function create(Request $request)
    {
        $workOrder = $request->query('work_order_id')
            ? WorkOrder::with('customer', 'rfq.items.product')->findOrFail($request->query('work_order_id'))
            : null;

        // Pre-fill material lines from the cost estimate that drives this WO.
        // Eliminates the chance of PCD picking a different material than what
        // was actually costed and quoted.
        $prefilledItems = $workOrder ? $this->materialLinesFromEstimate($workOrder) : [];

        return Inertia::render('Pcd/MaterialRequisition/Form', [
            'requisition'     => null,
            'work_order'      => $workOrder ? $this->serializeWorkOrder($workOrder) : null,
            'prefilled_items' => $prefilledItems,
            'work_orders' => WorkOrder::with('customer')
                ->whereIn('status', ['pcd_pending', 'released_to_shops'])
                ->orderByDesc('id')
                ->get()
                ->map(fn($w) => [
                    'id'         => $w->id,
                    'wo_number'  => $w->wo_number,
                    'job_number' => $w->job_number,
                    'customer'   => $w->customer?->name,
                ]),
            'materials' => Material::active()->orderBy('name')->get(['id', 'name', 'unit', 'rate_per_kg']),
        ]);
    }

    /**
     * Pull material lines from the cost estimate tied to this work order.
     * Lookup order: WO.quotation.id → CostEstimate.quotation_id, else
     * WO.rfq_id → CostEstimate.rfq_id (latest). Returns rows shaped for the
     * requisition form's items table — material_id, qty, unit, description.
     */
    private function materialLinesFromEstimate(WorkOrder $wo): array
    {
        $estimate = null;
        if ($wo->quotation_id) {
            $estimate = \App\Models\CostEstimate::where('quotation_id', $wo->quotation_id)
                ->latest('id')->first();
        }
        if (!$estimate && $wo->rfq_id) {
            $estimate = \App\Models\CostEstimate::where('rfq_id', $wo->rfq_id)
                ->latest('id')->first();
        }
        if (!$estimate) return [];

        $jobQty = max(1, (int) ($estimate->job_quantity ?: 1));

        return $estimate->lines()
            ->where('section', 'material')
            ->with('material:id,name,unit')
            ->get()
            ->map(fn ($l) => [
                'material_id'   => $l->material_id,
                'material_name' => $l->material?->name ?? $l->description,
                'description'   => $l->description,
                'unit'          => $l->unit ?: ($l->material?->unit ?? 'pcs'),
                // Scale per-piece estimate quantity by WO quantity so a 10-piece
                // job pulls 10× the material the cost sheet assumes.
                'required_qty'  => round(((float) $l->quantity) * (max(1, (int) $wo->quantity) / $jobQty), 3),
                'stock_qty'     => 0,
                'issue_qty'     => 0,
                'remarks'       => null,
                'estimate_no'   => $estimate->estimate_no,
            ])->values()->toArray();
    }

    public function store(Request $request)
    {
        $validated = $this->validateRequisition($request);

        $mr = DB::transaction(function () use ($validated) {
            $mr = MaterialRequisition::create([
                'mrn_number'    => MaterialRequisition::generateMrnNumber(),
                'work_order_id' => $validated['work_order_id'],
                'request_date'  => $validated['request_date'],
                'requested_by'  => auth()->id(),
                'status'        => $validated['status'] ?? 'draft',
                'notes'         => $validated['notes'] ?? null,
            ]);
            $this->saveItems($mr, $validated['items']);
            return $mr;
        });

        // If saved as approved, try to release WO to shops
        if ($mr->status === 'approved' || $mr->status === 'issued') {
            PcdReleaseService::tryRelease($mr->workOrder);
        }

        return redirect()->route('pcd.material-requisitions.show', $mr)
            ->with('success', "Material Requisition {$mr->mrn_number} created.");
    }

    public function show(MaterialRequisition $materialRequisition)
    {
        $materialRequisition->load(['workOrder.customer', 'items.material', 'requestedBy', 'approvedBy', 'issuedBy', 'receivedBy', 'imsPushedBy']);

        return Inertia::render('Pcd/MaterialRequisition/Show', [
            'requisition' => $this->serializeRequisition($materialRequisition),
        ]);
    }

    public function edit(MaterialRequisition $materialRequisition)
    {
        $materialRequisition->load(['items.material', 'workOrder.customer']);

        return Inertia::render('Pcd/MaterialRequisition/Form', [
            'requisition' => $this->serializeRequisition($materialRequisition),
            'work_order'  => $materialRequisition->workOrder ? $this->serializeWorkOrder($materialRequisition->workOrder) : null,
            'work_orders' => WorkOrder::with('customer')
                ->whereIn('status', ['pcd_pending', 'released_to_shops'])
                ->orderByDesc('id')
                ->get()
                ->map(fn($w) => [
                    'id'         => $w->id,
                    'wo_number'  => $w->wo_number,
                    'job_number' => $w->job_number,
                    'customer'   => $w->customer?->name,
                ]),
            'materials' => Material::active()->orderBy('name')->get(['id', 'name', 'unit', 'rate_per_kg']),
        ]);
    }

    public function update(Request $request, MaterialRequisition $materialRequisition)
    {
        $validated = $this->validateRequisition($request);

        DB::transaction(function () use ($materialRequisition, $validated) {
            $materialRequisition->update([
                'work_order_id' => $validated['work_order_id'],
                'request_date'  => $validated['request_date'],
                'status'        => $validated['status'] ?? $materialRequisition->status,
                'notes'         => $validated['notes'] ?? null,
            ]);
            $materialRequisition->items()->delete();
            $this->saveItems($materialRequisition, $validated['items']);
        });

        if (in_array($materialRequisition->status, ['approved', 'issued'])) {
            PcdReleaseService::tryRelease($materialRequisition->workOrder);
        }

        return redirect()->route('pcd.material-requisitions.show', $materialRequisition)
            ->with('success', 'Material Requisition updated.');
    }

    public function destroy(MaterialRequisition $materialRequisition)
    {
        $materialRequisition->delete();
        return redirect()->route('pcd.material-requisitions.index')->with('success', 'Material Requisition deleted.');
    }

    /**
     * Push the draft requisition to BITAC's IMS for approval + issuance.
     * Approval workflow happens entirely inside IMS; PMS only tracks the push.
     */
    public function submit(MaterialRequisition $materialRequisition)
    {
        abort_unless(in_array($materialRequisition->status, ['draft', 'pending_approval']), 422,
            'Only drafts can be pushed to IMS.');

        $result = app(\App\Services\IMSService::class)->submitMaterialRequisition($materialRequisition);

        if (!$result['ok']) {
            // Record the failure so the user can see what went wrong + retry later
            $materialRequisition->update([
                'ims_last_error' => $result['error'] ?? 'IMS push failed (unknown error).',
                'ims_response'   => $result['response'] ?? null,
            ]);
            return back()->with('error', 'IMS push failed: ' . ($result['error'] ?? 'unknown error') . '. Saved as draft — you can retry.');
        }

        $materialRequisition->update([
            'status'         => 'sent_to_ims',
            'ims_reference'  => $result['reference'],
            'ims_pushed_at'  => now(),
            'ims_pushed_by'  => auth()->id(),
            'ims_status'     => $result['status'] ?? 'pending_approval',
            'ims_last_error' => null,
            'ims_response'   => $result['response'] ?? null,
        ]);

        // `sent_to_ims` counts as MR-done from PCD's perspective, so try to release
        // the WO if Section Assignment + Operation Sheet are also in place.
        PcdReleaseService::tryRelease($materialRequisition->workOrder);

        return back()->with('success', "Requisition pushed to IMS. Reference: {$result['reference']}");
    }

    /**
     * Approve — kept as an alias for backwards-compatibility with any direct links.
     * Pushes to IMS just like submit().
     */
    public function approve(MaterialRequisition $materialRequisition)
    {
        return $this->submit($materialRequisition);
    }

    /**
     * Mark as issued (Stock Keeper signature).
     */
    public function issue(Request $request, MaterialRequisition $materialRequisition)
    {
        $materialRequisition->update([
            'status'    => $request->boolean('partial') ? 'partially_issued' : 'issued',
            'issued_by' => auth()->id(),
            'issued_at' => now(),
        ]);

        return back()->with('success', 'Requisition marked as issued.');
    }

    private function saveItems(MaterialRequisition $mr, array $items): void
    {
        foreach ($items as $idx => $item) {
            if (empty($item['description'])) continue;
            $required = (float) ($item['required_qty'] ?? 0);
            $stock    = (float) ($item['stock_qty'] ?? 0);
            $issue    = (float) ($item['issue_qty'] ?? 0);
            $pending  = max(0, $required - $issue);

            $mr->items()->create([
                'item_no'      => $idx + 1,
                'description'  => $item['description'],
                'material_id'  => $item['material_id'] ?? null,
                'unit'         => $item['unit'] ?? 'pcs',
                'required_qty' => $required,
                'stock_qty'    => $stock ?: null,
                'issue_qty'    => $issue ?: null,
                'pending_qty'  => $pending ?: null,
                'issue_date'   => $item['issue_date'] ?? null,
                'remarks'      => $item['remarks'] ?? null,
            ]);
        }
    }

    private function serializeWorkOrder(WorkOrder $wo): array
    {
        return [
            'id'         => $wo->id,
            'wo_number'  => $wo->wo_number,
            'job_number' => $wo->job_number,
            'customer'   => $wo->customer?->name,
            'rfq_items'  => $wo->rfq?->items->map(fn($i) => [
                'description' => $i->job_description ?? $i->product?->name ?? '—',
                'quantity'    => $i->quantity,
                'unit'        => $i->unit,
            ]) ?? [],
        ];
    }

    private function serializeRequisition(MaterialRequisition $mr): array
    {
        return [
            'id'           => $mr->id,
            'mrn_number'   => $mr->mrn_number,
            'work_order_id' => $mr->work_order_id,
            'work_order'   => $mr->workOrder ? $this->serializeWorkOrder($mr->workOrder) : null,
            'request_date' => $mr->request_date?->format('Y-m-d'),
            'request_date_display' => $mr->request_date?->format('d M Y'),
            'status'       => $mr->status,
            'notes'        => $mr->notes,
            'requested_by' => $mr->requestedBy?->name,
            'approved_by'  => $mr->approvedBy?->name,
            'approved_at'  => $mr->approved_at?->format('d M Y'),
            'issued_by'    => $mr->issuedBy?->name,
            'issued_at'    => $mr->issued_at?->format('d M Y'),
            'received_by'  => $mr->receivedBy?->name,
            'received_at'  => $mr->received_at?->format('d M Y'),
            // IMS push tracking
            'ims_reference'  => $mr->ims_reference,
            'ims_pushed_at'  => $mr->ims_pushed_at?->format('d M Y, H:i'),
            'ims_pushed_by'  => $mr->imsPushedBy?->name,
            'ims_status'     => $mr->ims_status,
            'ims_last_error' => $mr->ims_last_error,
            'items'        => $mr->items->map(fn($i) => [
                'id'             => $i->id,
                'item_no'        => $i->item_no,
                'description'    => $i->description,
                'material_id'    => $i->material_id,
                'material_name'  => $i->material?->name,
                'unit'           => $i->unit,
                'required_qty'   => $i->required_qty,
                'stock_qty'      => $i->stock_qty,
                'issue_qty'      => $i->issue_qty,
                'pending_qty'    => $i->pending_qty,
                'issue_date'     => $i->issue_date?->format('Y-m-d'),
                'remarks'        => $i->remarks,
            ]),
        ];
    }

    /**
     * Generate a printable PDF of the Material Requisition Note (MRN).
     * Plain BITAC paper-form style — black-bordered items table + preparer
     * signature block at bottom (signature image + name + designation +
     * center + phone + email).
     */
    public function pdf(Request $request, MaterialRequisition $materialRequisition)
    {
        $mr = $materialRequisition->load([
            'workOrder.customer', 'workOrder.rfq',
            'items.material',
            'requestedBy.center',
        ]);

        $esc = fn($v) => htmlspecialchars((string) ($v ?? ''), ENT_QUOTES | ENT_HTML5, 'UTF-8');
        $fmt = fn($v) => $v === null || $v === '' ? '—' : number_format((float) $v, 2);

        $woNumber  = $esc($mr->workOrder?->wo_number ?? '—');
        $jobNumber = $esc($mr->workOrder?->job_number ?? '—');
        $customer  = $esc($mr->workOrder?->customer?->name ?? '—');
        $reqDate   = $mr->request_date?->format('d/m/Y') ?? '';

        // Memo block — pass no on top-left, date on top-right
        $memoBlock = '<table width="100%" cellspacing="0" cellpadding="0" style="margin-bottom: 14pt;">'
            . '<tr>'
            .   '<td style="font-size: 11pt; color: #000;"><span class="bn" style="font-family: siyamrupali;">নং -</span> ' . $esc($mr->mrn_number) . '</td>'
            .   '<td style="font-size: 11pt; color: #000; text-align: right;"><span class="bn" style="font-family: siyamrupali;">তারিখঃ</span> ' . $esc($reqDate) . ' <span class="bn" style="font-family: siyamrupali;">খ্রিঃ</span></td>'
            . '</tr>'
            . '</table>';

        // Centered title — Material Requisition Note
        $titleBlock = '<div style="text-align: center; margin-bottom: 14pt;">'
            . '<div class="bn" style="font-family: siyamrupali; font-size: 13pt; color: #000;">মালামাল চাহিদাপত্র</div>'
            . '<div style="font-size: 11pt; color: #000; margin-top: 1pt;">(MATERIAL REQUISITION NOTE)</div>'
            . '</div>';

        // Job / customer header block
        $headerBlock = '<table width="100%" cellspacing="0" cellpadding="0" style="margin-bottom: 8pt; border-collapse: collapse; border: 0.75pt solid #000;">'
            . '<tr>'
            .   '<td width="50%" style="border: 0.75pt solid #000; padding: 6pt 8pt; font-size: 10pt; color: #000; vertical-align: top; line-height: 1.5;">'
            .     '<div><b>Job No:</b> ' . $jobNumber . '</div>'
            .     '<div><b>WO No:</b> ' . $woNumber . '</div>'
            .   '</td>'
            .   '<td width="50%" style="border: 0.75pt solid #000; padding: 6pt 8pt; font-size: 10pt; color: #000; vertical-align: top; line-height: 1.5;">'
            .     '<div><b>Customer:</b> ' . $customer . '</div>'
            .     '<div><b>Status:</b> ' . $esc(ucfirst(str_replace('_', ' ', $mr->status))) . '</div>'
            .   '</td>'
            . '</tr>'
            . '</table>';

        // Items table — Material first, Description (multi-line) second
        $itemsHtml  = '<table width="100%" cellspacing="0" cellpadding="0" style="border-collapse: collapse; border: 0.75pt solid #000; margin-top: 4pt; table-layout: fixed;">';
        $itemsHtml .= '<colgroup>'
            . '<col style="width: 6%;" />'
            . '<col style="width: 24%;" />'
            . '<col style="width: 30%;" />'
            . '<col style="width: 8%;" />'
            . '<col style="width: 11%;" />'
            . '<col style="width: 11%;" />'
            . '<col style="width: 10%;" />'
            . '</colgroup>';
        $itemsHtml .= '<tr>';
        $itemsHtml .=   '<th style="border: 0.75pt solid #000; padding: 4pt 2pt; font-size: 9pt; font-weight: normal; text-align: center;"><span class="bn" style="font-family: siyamrupali;">ক্র.নং</span><br>(Sl. No)</th>';
        $itemsHtml .=   '<th style="border: 0.75pt solid #000; padding: 4pt; font-size: 9pt; font-weight: normal; text-align: center;">Material</th>';
        $itemsHtml .=   '<th style="border: 0.75pt solid #000; padding: 4pt; font-size: 9pt; font-weight: normal; text-align: center;">Description<br><span style="font-size: 8pt; color: #4b5563;">(size / spec)</span></th>';
        $itemsHtml .=   '<th style="border: 0.75pt solid #000; padding: 4pt 2pt; font-size: 9pt; font-weight: normal; text-align: center;">Unit</th>';
        $itemsHtml .=   '<th style="border: 0.75pt solid #000; padding: 4pt 2pt; font-size: 9pt; font-weight: normal; text-align: center;">Required</th>';
        $itemsHtml .=   '<th style="border: 0.75pt solid #000; padding: 4pt 2pt; font-size: 9pt; font-weight: normal; text-align: center;">Issued</th>';
        $itemsHtml .=   '<th style="border: 0.75pt solid #000; padding: 4pt 2pt; font-size: 9pt; font-weight: normal; text-align: center;">Remarks</th>';
        $itemsHtml .= '</tr>';

        if ($mr->items->isEmpty()) {
            $itemsHtml .= '<tr><td colspan="7" style="border: 0.75pt solid #000; padding: 10pt; text-align: center; font-style: italic; font-size: 10pt;">No items on this MRN</td></tr>';
        } else {
            foreach ($mr->items as $i => $item) {
                $sl = str_pad((string)($i + 1), 2, '0', STR_PAD_LEFT);
                $itemsHtml .= '<tr>';
                $itemsHtml .=   '<td style="border: 0.75pt solid #000; padding: 6pt 2pt; font-size: 10pt; text-align: center; vertical-align: middle;">' . $sl . '</td>';
                $itemsHtml .=   '<td style="border: 0.75pt solid #000; padding: 6pt 6pt; font-size: 10pt; font-weight: bold; vertical-align: top;">' . $esc($item->material?->name ?? '—') . '</td>';
                $itemsHtml .=   '<td style="border: 0.75pt solid #000; padding: 6pt 6pt; font-size: 9.5pt; vertical-align: top; line-height: 1.4;">' . nl2br($esc($item->description ?? ''), false) . '</td>';
                $itemsHtml .=   '<td style="border: 0.75pt solid #000; padding: 6pt 2pt; font-size: 10pt; text-align: center; vertical-align: middle;">' . $esc($item->unit) . '</td>';
                $itemsHtml .=   '<td style="border: 0.75pt solid #000; padding: 6pt 4pt; font-size: 10pt; text-align: right; vertical-align: middle; white-space: nowrap;">' . $fmt($item->required_qty) . '</td>';
                $itemsHtml .=   '<td style="border: 0.75pt solid #000; padding: 6pt 4pt; font-size: 10pt; text-align: right; vertical-align: middle; white-space: nowrap;">' . $fmt($item->issue_qty) . '</td>';
                $itemsHtml .=   '<td style="border: 0.75pt solid #000; padding: 6pt 6pt; font-size: 9pt; vertical-align: top;">' . $esc($item->remarks ?? '') . '</td>';
                $itemsHtml .= '</tr>';
            }
        }
        $itemsHtml .= '</table>';

        // Optional notes
        $notesHtml = $mr->notes
            ? '<div style="margin-top: 12pt; font-size: 10pt; color: #000; line-height: 1.4;"><b>Notes:</b> ' . nl2br($esc($mr->notes), false) . '</div>'
            : '';

        // ─── Preparer signature block (full info, BITAC letter convention) ───
        $preparer       = $mr->requestedBy;
        $preparerSig    = $preparer?->signatureAbsolutePath();
        $preparerName   = $esc($preparer?->name ?? '—');
        $preparerTitle  = $esc($preparer?->designation ?? '');
        $preparerCenter = $esc($preparer?->center?->name ?? '');
        $preparerPhone  = $esc($preparer?->phone ?? '');
        $preparerEmail  = $esc($preparer?->email ?? '');

        $sigImg = $preparerSig
            ? '<img src="' . $preparerSig . '" style="height: 40pt; max-width: 150pt;" alt="signature" />'
            : '<div style="height: 40pt;"></div>';

        $signatureBlock = '<table width="100%" cellspacing="0" cellpadding="0" style="margin-top: 30pt;">'
            . '<tr>'
            .   '<td width="55%" style="vertical-align: bottom; text-align: left;">'
            .     '<div style="margin-bottom: 4pt;">' . $sigImg . '</div>'
            .     '<div style="border-top: 0.75pt solid #000; padding-top: 4pt; font-size: 10pt; font-weight: bold; color: #000; display: inline-block; min-width: 160pt;">Prepared By</div>'
            .     '<div style="font-size: 10pt; color: #000; margin-top: 2pt;">' . $preparerName . '</div>'
            .     ($preparerTitle !== '' ? '<div style="font-size: 9pt; color: #4b5563; margin-top: 1pt;">' . $preparerTitle . '</div>' : '')
            .     ($preparerCenter !== '' ? '<div style="font-size: 9pt; color: #4b5563;">' . $preparerCenter . '</div>' : '')
            .     ($preparerPhone !== ''  ? '<div style="font-size: 9pt; color: #4b5563; margin-top: 1pt;"><span class="bn" style="font-family: siyamrupali;">ফোনঃ</span> ' . $preparerPhone . '</div>' : '')
            .     ($preparerEmail !== ''  ? '<div style="font-size: 9pt; color: #4b5563;"><span class="bn" style="font-family: siyamrupali;">ই-মেইলঃ</span> ' . $preparerEmail . '</div>' : '')
            .   '</td>'
            .   '<td width="10%"></td>'
            .   '<td width="35%" style="vertical-align: bottom; text-align: right;">'
            .     '<div style="height: 40pt;"></div>'
            .     '<div style="border-top: 0.75pt solid #000; padding-top: 4pt; font-size: 10pt; font-weight: bold; color: #000; display: inline-block; min-width: 160pt;">Issued By (Stores)</div>'
            .     '<div style="font-size: 9pt; color: #94a3b8; margin-top: 2pt; font-style: italic;">Signature &amp; date</div>'
            .   '</td>'
            . '</tr>'
            . '</table>';

        $bodyHtml = <<<HTML
        {$memoBlock}
        {$titleBlock}
        {$headerBlock}
        {$itemsHtml}
        {$notesHtml}
        {$signatureBlock}
HTML;

        $bytes    = app(\App\Services\BitacLetterhead::class)->render($bodyHtml, "MRN {$mr->mrn_number}");
        $filename = "MRN-{$mr->mrn_number}.pdf";

        if ($request->input('preview') === 'base64') {
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

    private function validateRequisition(Request $request): array
    {
        return $request->validate([
            'work_order_id'    => 'required|exists:work_orders,id',
            'request_date'     => 'required|date',
            'status'           => 'nullable|in:draft,pending_approval,approved,partially_issued,issued,received,cancelled',
            'notes'            => 'nullable|string|max:1000',
            'items'            => 'required|array|min:1',
            // Material is the primary identifier of a requisition line — must be picked from the master.
            'items.*.material_id'  => 'required|exists:materials,id',
            // Description carries the spec (size / thickness / grade). Multiline accepted, kept generous.
            'items.*.description'  => 'nullable|string|max:1000',
            'items.*.unit'         => 'nullable|string|max:20',
            'items.*.required_qty' => 'required|numeric|min:0',
            'items.*.stock_qty'    => 'nullable|numeric|min:0',
            'items.*.issue_qty'    => 'nullable|numeric|min:0',
            'items.*.issue_date'   => 'nullable|date',
            'items.*.remarks'      => 'nullable|string|max:500',
        ]);
    }
}
