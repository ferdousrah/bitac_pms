<?php

namespace App\Http\Controllers\Pcd;

use App\Http\Controllers\Controller;
use App\Models\CostEstimate;
use App\Models\Material;
use App\Models\MaterialRequisition;
use App\Models\WorkOrder;
use App\Services\PcdReleaseService;
use App\Support\SignatureBlock;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;

/**
 * Material requisitions (MRN). ⚠️ Not connected to IMS (BITAC, 2026-10-23):
 * PCD raises the requisition here and moves its status along by hand —
 * Draft → Submitted → Approved → (Partially) Issued → Received, or Cancelled.
 * The rules — which step follows which — live on MaterialRequisition.
 *
 * Recording an issue is the one step that carries data: what the store handed
 * over, line by line. The status follows those quantities (every line covered
 * → Issued, anything less → Partially Issued), and `issue_qty` is what a job's
 * actual material cost is worked out from.
 */
class MaterialRequisitionController extends Controller
{
    public function index(Request $request)
    {
        $status = $request->query('status');
        $requisitions = MaterialRequisition::with('workOrder.customer', 'section:id,name', 'requestedBy', 'items')
            ->when($status && isset(MaterialRequisition::STATUSES[$status]), fn ($q) => $q->where('status', $status))
            ->when(trim((string) $request->query('search')), function ($q, $term) {
                $q->where(fn ($w) => $w->where('mrn_number', 'like', "%{$term}%")
                    ->orWhereHas('workOrder', fn ($wo) => $wo->where('wo_number', 'like', "%{$term}%")
                        ->orWhere('job_number', 'like', "%{$term}%")
                        ->orWhereHas('customer', fn ($c) => $c->where('name', 'like', "%{$term}%"))));
            })
            ->latest()
            ->paginate(20)
            ->withQueryString()
            ->through(fn($mr) => [
                'id'           => $mr->id,
                'mrn_number'   => $mr->mrn_number,
                'work_order'   => $mr->workOrder ? [
                    'id'         => $mr->workOrder->id,
                    'wo_number'  => $mr->workOrder->wo_number,
                    'job_number' => $mr->workOrder->job_number,
                    'customer'   => $mr->workOrder->customer?->name,
                ] : null,
                'shop'         => $mr->section?->name,
                'request_date' => $mr->request_date?->format('d M Y'),
                'status'       => $mr->status,
                'item_count'   => $mr->items->count(),
                'requested_by' => $mr->requestedBy?->name,
            ]);

        return Inertia::render('Pcd/MaterialRequisition/Index', [
            'requisitions' => $requisitions,
            'filters'      => ['status' => $status, 'search' => $request->query('search')],
        ]);
    }

    public function create(Request $request)
    {
        // Answering a shop's material demand: its job and its lines, as asked.
        $demand = $request->query('demand_id')
            ? \App\Models\MaterialDemand::with('items.material', 'section', 'requestedBy')->find($request->query('demand_id'))
            : null;
        if ($demand && ! $demand->isOpen()) {
            return redirect()->route('material-demands.show', $demand)
                ->with('error', "{$demand->demand_no} is already {$demand->status_label}.");
        }

        // A demand decides the job — including "no job".
        $woId = $demand ? $demand->work_order_id : $request->query('work_order_id');
        $workOrder = $woId ? WorkOrder::with('customer', 'rfq.items.product')->findOrFail($woId) : null;

        // Pre-fill: the shop's demand when answering one; otherwise the material
        // lines of the costing that priced this job, so PCD does not pick a
        // different material from the one that was quoted.
        $prefilledItems = $demand
            ? $demand->items->map(fn ($i) => [
                'material_id'  => $i->material_id,
                'item_name'    => (string) $i->item_name,
                'description'  => (string) $i->description,
                'unit'         => $i->unit,
                'required_qty' => (float) $i->quantity,
                'remarks'      => trim("From {$demand->demand_no}" . ($i->remarks ? " — {$i->remarks}" : '')),
            ])->all()
            : ($workOrder ? $this->materialLinesFromEstimates($workOrder) : []);

        return Inertia::render('Pcd/MaterialRequisition/Form', [
            'requisition'     => null,
            'work_order'      => $workOrder ? $this->serializeWorkOrder($workOrder) : null,
            'prefilled_items' => $prefilledItems,
            'demand'          => $demand ? [
                'id'           => $demand->id,
                'demand_no'    => $demand->demand_no,
                'section_id'   => $demand->section_id,
                'shop'         => $demand->section?->name,
                'requested_by' => $demand->requestedBy?->name,
                'needed_by'    => $demand->needed_by?->format('d M Y'),
                'notes'        => $demand->notes,
            ] : null,
            // What a blank MRN box will be numbered — shown as the hint.
            'next_mrn'        => MaterialRequisition::generateMrnNumber(),
            'work_orders'     => $this->workOrderOptions(),
            'shops'           => $this->shopOptions(),
            'materials'       => $this->materialOptions(),
        ]);
    }

    /**
     * The material lines of the costing behind this job, as requisition rows.
     *
     * ⚠️ A job is costed PART BY PART — so this walks every RFQ item's
     * `jobCostBreakdown()` and takes each part's effective estimate (or the
     * item's whole-job estimate), never "the latest estimate on the RFQ", which
     * would requisition the material for one part of a multi-part job.
     *
     * An estimate's material quantity is per unit of what it costs, so the
     * requisition needs `quantity × job_quantity` (a part's quantity is already
     * the total pieces for the order).
     */
    private function materialLinesFromEstimates(WorkOrder $wo): array
    {
        $estimates = collect();
        foreach ($wo->rfq?->items()->with('parts.costEstimates')->get() ?? [] as $item) {
            $b = $item->jobCostBreakdown();
            if ($b['mode'] === 'parts') {
                foreach ($b['parts'] as $row) {
                    if ($row['estimate']) $estimates->push([$row['estimate'], "part {$row['part_no']}"]);
                }
            } elseif ($b['estimate']) {
                $estimates->push([$b['estimate'], null]);
            }
        }

        // Older estimates were tied to the RFQ or the quotation only, not to an item.
        if ($estimates->isEmpty()) {
            $legacy = ($wo->quotation_id ? CostEstimate::where('quotation_id', $wo->quotation_id)->latest('id')->first() : null)
                ?? ($wo->rfq_id ? CostEstimate::where('rfq_id', $wo->rfq_id)->latest('id')->first() : null);
            if ($legacy) $estimates->push([$legacy, null]);
        }

        $rows = [];
        foreach ($estimates as [$estimate, $partLabel]) {
            $jobQty = max(1, (float) ($estimate->job_quantity ?: 1));
            $lines = $estimate->lines()->where('section', 'material')->with('material:id,name,unit')->get();
            foreach ($lines as $l) {
                // A line costed as a typed item (no master material) is asked for by that name.
                $rows[] = [
                    'material_id'  => $l->material_id,
                    'item_name'    => $l->material_id ? '' : (string) $l->description,
                    'description'  => $l->material_id && $l->description !== $l->material?->name ? (string) $l->description : '',
                    'unit'         => $l->unit ?: ($l->material?->unit ?: 'kg'),
                    'required_qty' => round((float) $l->quantity * $jobQty, 3),
                    'remarks'      => trim("From {$estimate->estimate_no}" . ($partLabel ? " ({$partLabel})" : '')),
                ];
            }
        }

        return $rows;
    }

    public function store(Request $request)
    {
        $validated = $this->validateRequisition($request);
        $submit = $request->boolean('submit');

        // A requisition belongs to its job's centre; with no job, the current one.
        $centre = ! empty($validated['work_order_id'])
            ? WorkOrder::withoutGlobalScopes()->whereKey($validated['work_order_id'])->value('center_id')
            : null;
        $centre = $centre ?: \App\Support\DocNumber::currentCentreId();

        $mr = DB::transaction(function () use ($validated, $submit, $centre) {
            $mr = MaterialRequisition::create([
                'center_id'     => $centre,
                // The number IMS gave it, when PCD has one; otherwise numbered here.
                'mrn_number'    => ($validated['mrn_number'] ?? null) ?: MaterialRequisition::generateMrnNumber($centre),
                'work_order_id' => $validated['work_order_id'] ?? null,
                'section_id'    => $validated['section_id'] ?? null,
                'request_date'  => $validated['request_date'],
                'requested_by'  => auth()->id(),
                'status'        => $submit ? 'pending_approval' : 'draft',
                'notes'         => $validated['notes'] ?? null,
            ]);
            $this->saveItems($mr, $validated['items']);
            return $mr;
        });

        $sentUp = $submit && $mr->workOrder && PcdReleaseService::tryRelease($mr->workOrder);

        // Raised from a shop's demand → the demand now follows this requisition.
        $answered = '';
        if ($demandId = $request->integer('demand_id')) {
            $demand = \App\Models\MaterialDemand::find($demandId);
            if ($demand && \App\Http\Controllers\MaterialDemandController::linkRequisition($demand, $mr, $request->user())) {
                $answered = " {$demand->demand_no} is answered — the shop has been told.";
            }
        }

        return redirect()->route('pcd.material-requisitions.show', $mr)
            ->with('success', "Material Requisition {$mr->mrn_number} " . ($submit ? 'created and submitted.' : 'saved as a draft.') . $answered
                . ($sentUp ? PcdReleaseService::SENT_FOR_APPROVAL : ''));
    }

    public function show(MaterialRequisition $materialRequisition)
    {
        $materialRequisition->load(['workOrder.customer', 'section', 'items.material', 'requestedBy', 'approvedBy', 'issuedBy', 'receivedBy']);

        return Inertia::render('Pcd/MaterialRequisition/Show', [
            'requisition' => $this->serializeRequisition($materialRequisition),
        ]);
    }

    public function edit(MaterialRequisition $materialRequisition)
    {
        if ($refusal = $this->notEditable($materialRequisition)) return $refusal;

        $materialRequisition->load(['items.material', 'workOrder.customer']);

        return Inertia::render('Pcd/MaterialRequisition/Form', [
            'requisition' => $this->serializeRequisition($materialRequisition),
            'work_order'  => $materialRequisition->workOrder ? $this->serializeWorkOrder($materialRequisition->workOrder) : null,
            'work_orders' => $this->workOrderOptions(),
            'shops'       => $this->shopOptions(),
            'materials'   => $this->materialOptions(),
        ]);
    }

    public function update(Request $request, MaterialRequisition $materialRequisition)
    {
        if ($refusal = $this->notEditable($materialRequisition)) return $refusal;

        $validated = $this->validateRequisition($request, $materialRequisition->id);
        $submit = $request->boolean('submit') && $materialRequisition->status === 'draft';

        DB::transaction(function () use ($materialRequisition, $validated, $submit) {
            $materialRequisition->update([
                // Blank keeps the number it has — clearing the box must not lose it.
                'mrn_number'    => ($validated['mrn_number'] ?? null) ?: $materialRequisition->mrn_number,
                'work_order_id' => $validated['work_order_id'] ?? null,
                'section_id'    => $validated['section_id'] ?? null,
                'request_date'  => $validated['request_date'],
                'status'        => $submit ? 'pending_approval' : $materialRequisition->status,
                'notes'         => $validated['notes'] ?? null,
            ]);
            $materialRequisition->items()->delete();
            $this->saveItems($materialRequisition, $validated['items']);
        });

        $sentUp = $submit && $materialRequisition->workOrder && PcdReleaseService::tryRelease($materialRequisition->workOrder);

        return redirect()->route('pcd.material-requisitions.show', $materialRequisition)
            ->with('success', 'Material Requisition ' . ($submit ? 'updated and submitted.' : 'updated.')
                . ($sentUp ? PcdReleaseService::SENT_FOR_APPROVAL : ''));
    }

    /** Only a draft goes — anything submitted is on the store's record and is cancelled instead. */
    public function destroy(MaterialRequisition $materialRequisition)
    {
        if ($materialRequisition->status !== 'draft') {
            return back()->with('error', "{$materialRequisition->mrn_number} is {$materialRequisition->status_label} — only a draft can be deleted. Cancel it instead.");
        }
        $materialRequisition->delete();

        return redirect()->route('pcd.material-requisitions.index')->with('success', 'Material Requisition deleted.');
    }

    /**
     * Put the IMS number on a requisition at any stage. The store's system
     * often issues it only after the paper reaches them — after the lines are
     * already locked — so this is deliberately separate from editing the lines.
     */
    public function setNumber(Request $request, MaterialRequisition $materialRequisition)
    {
        $data = $request->validate([
            'mrn_number' => 'required|string|max:30|unique:material_requisitions,mrn_number,' . $materialRequisition->id,
        ], [
            'mrn_number.unique' => 'Another requisition already has that MRN number.',
        ]);
        $old = $materialRequisition->mrn_number;
        $new = trim($data['mrn_number']);
        if ($new === $old) return back();

        $materialRequisition->update(['mrn_number' => $new]);

        return back()->with('success', "MRN number changed from {$old} to {$new}.");
    }

    // ── Moving the status along (no IMS) ────────────────────────────────

    public function submit(MaterialRequisition $materialRequisition)  { return $this->transition($materialRequisition, 'submit'); }
    public function revert(MaterialRequisition $materialRequisition)  { return $this->transition($materialRequisition, 'revert'); }
    public function approve(MaterialRequisition $materialRequisition) { return $this->transition($materialRequisition, 'approve'); }
    public function receive(MaterialRequisition $materialRequisition) { return $this->transition($materialRequisition, 'receive'); }

    public function cancel(Request $request, MaterialRequisition $materialRequisition)
    {
        $reason = trim((string) $request->input('reason', ''));

        return $this->transition($materialRequisition, 'cancel', $reason);
    }

    /**
     * One hand-moved step. Refused with a redirect + flash, never abort() —
     * a second click from a stale tab must read as a message, not a crash.
     */
    private function transition(MaterialRequisition $mr, string $action, string $reason = '')
    {
        [$from, $to] = MaterialRequisition::TRANSITIONS[$action];
        if (! in_array($mr->status, $from, true)) {
            return back()->with('error', "{$mr->mrn_number} is {$mr->status_label} — it cannot be moved to "
                . MaterialRequisition::STATUSES[$to] . ' from there.');
        }
        if ($action === 'submit' && ! $mr->items()->exists()) {
            return back()->with('error', 'Add at least one material line before submitting.');
        }

        $user = auth()->user();
        $patch = ['status' => $to];
        if ($action === 'approve') $patch += ['approved_by' => $user->id, 'approved_at' => now()];
        if ($action === 'receive') $patch += ['received_by' => $user->id, 'received_at' => now()];
        if ($action === 'revert')  $patch += ['approved_by' => null, 'approved_at' => null];
        if ($action === 'cancel') {
            $patch['notes'] = trim(($mr->notes ? $mr->notes . "\n" : '')
                . '[Cancelled · ' . $user->name . ', ' . now()->format('d M Y') . ']' . ($reason !== '' ? ' ' . $reason : ''));
        }
        $mr->update($patch);

        $sentUp = in_array($to, MaterialRequisition::RAISED, true) && $mr->workOrder && PcdReleaseService::tryRelease($mr->workOrder);

        return back()->with('success', "{$mr->mrn_number} is now " . MaterialRequisition::STATUSES[$to] . '.'
            . ($sentUp ? PcdReleaseService::SENT_FOR_APPROVAL : ''));
    }

    /**
     * Record what the store handed over, line by line. The figures are the
     * running TOTAL issued per line (not an increment), so correcting a typo is
     * just typing the right number. The status follows them.
     */
    public function issue(Request $request, MaterialRequisition $materialRequisition)
    {
        $mr = $materialRequisition;
        if (! in_array($mr->status, MaterialRequisition::ISSUABLE, true)) {
            return back()->with('error', "{$mr->mrn_number} is {$mr->status_label} — issue can be recorded once it is approved.");
        }

        $data = $request->validate([
            'items'              => 'required|array|min:1',
            'items.*.id'         => 'required|integer',
            'items.*.issue_qty'  => 'nullable|numeric|min:0',
            'items.*.issue_date' => 'nullable|date',
        ]);

        $lines = $mr->items()->get()->keyBy('id');
        DB::transaction(function () use ($data, $lines) {
            foreach ($data['items'] as $row) {
                $line = $lines->get((int) $row['id']);
                if (! $line) continue;   // a line of another requisition is ignored, never written
                $issued = (float) ($row['issue_qty'] ?? 0);
                $line->update([
                    'issue_qty'   => $issued ?: null,
                    'pending_qty' => max(0, (float) $line->required_qty - $issued) ?: null,
                    'issue_date'  => $issued > 0 ? (($row['issue_date'] ?? null) ?: now()->toDateString()) : null,
                ]);
            }
        });

        $lines = $mr->items()->get();
        $anything = $lines->contains(fn ($l) => (float) $l->issue_qty > 0);
        if (! $anything) {
            $mr->update(['status' => 'approved', 'issued_by' => null, 'issued_at' => null]);
            return back()->with('success', 'Nothing is recorded as issued — the requisition stays Approved.');
        }

        $all = $lines->every(fn ($l) => (float) $l->issue_qty + 0.0005 >= (float) $l->required_qty);
        $mr->update([
            'status'    => $all ? 'issued' : 'partially_issued',
            'issued_by' => auth()->id(),
            'issued_at' => now(),
        ]);

        return back()->with('success', $all
            ? "{$mr->mrn_number} is fully issued."
            : "{$mr->mrn_number} is partially issued — the rest is still pending.");
    }

    private function notEditable(MaterialRequisition $mr)
    {
        return $mr->isEditable() ? null : redirect()->route('pcd.material-requisitions.show', $mr)
            ->with('error', "{$mr->mrn_number} is {$mr->status_label} — its lines can no longer be changed.");
    }

    /**
     * ⚠️ A line is kept when it names a MATERIAL — the description is the
     * optional size/spec. This used to skip any line with no description, so a
     * picked material with the spec left blank silently vanished on save.
     */
    private function saveItems(MaterialRequisition $mr, array $items): void
    {
        $n = 0;
        foreach ($items as $item) {
            $materialId = ($item['material_id'] ?? null) ?: null;
            $itemName = $materialId ? null : (trim((string) ($item['item_name'] ?? '')) ?: null);
            if (! $materialId && ! $itemName) continue;
            $required = (float) ($item['required_qty'] ?? 0);

            $mr->items()->create([
                'item_no'      => ++$n,
                'description'  => ($item['description'] ?? null) ?: null,
                'material_id'  => $materialId,
                'item_name'    => $itemName,
                'unit'         => ($item['unit'] ?? null) ?: 'kg',
                'required_qty' => $required,
                'pending_qty'  => $required ?: null,
                'remarks'      => ($item['remarks'] ?? null) ?: null,
            ]);
        }
    }

    private function workOrderOptions()
    {
        return WorkOrder::with('customer')
            ->whereIn('status', ['pcd_pending', 'pcd_release_pending', 'released_to_shops'])
            ->orderByDesc('id')
            ->get()
            ->map(fn($w) => [
                'id'         => $w->id,
                'wo_number'  => $w->wo_number,
                'job_number' => $w->job_number,
                'customer'   => $w->customer?->name,
            ]);
    }

    /** Who a requisition can be for — every active top-level section (shops, and Stores / QC). */
    private function shopOptions()
    {
        return \App\Models\Section::topLevel()->where('is_active', true)->orderBy('name')->get(['id', 'name', 'code']);
    }

    /** What the picker and the weight calculator need — the density is the calculator's. */
    private function materialOptions()
    {
        return Material::active()->orderBy('name')->get(['id', 'name', 'category', 'unit', 'density_kg_m3']);
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
            'section_id'   => $mr->section_id,
            'shop'         => $mr->section?->name,
            'request_date' => $mr->request_date?->format('Y-m-d'),
            'request_date_display' => $mr->request_date?->format('d M Y'),
            'status'       => $mr->status,
            'status_label' => $mr->status_label,
            'can_edit'     => $mr->isEditable(),
            'can_delete'   => $mr->status === 'draft',
            'actions'      => $mr->availableActions(),
            'notes'        => $mr->notes,
            'requested_by' => $mr->requestedBy?->name,
            'approved_by'  => $mr->approvedBy?->name,
            'approved_at'  => $mr->approved_at?->format('d M Y'),
            'issued_by'    => $mr->issuedBy?->name,
            'issued_at'    => $mr->issued_at?->format('d M Y'),
            'received_by'  => $mr->receivedBy?->name,
            'received_at'  => $mr->received_at?->format('d M Y'),
            'items'        => $mr->items->map(fn($i) => [
                'id'             => $i->id,
                'item_no'        => $i->item_no,
                'description'    => $i->description,
                'material_id'    => $i->material_id,
                'item_name'      => $i->item_name,
                'material_name'  => $i->name,
                'unit'           => $i->unit,
                'required_qty'   => $i->required_qty,
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
            'workOrder.customer', 'workOrder.rfq', 'section',
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
            .   '<td style="font-size: 11pt; color: #000;"><span class="bn" style="font-family: nikosh;">নং -</span> ' . $esc($mr->mrn_number) . '</td>'
            .   '<td style="font-size: 11pt; color: #000; text-align: right;"><span class="bn" style="font-family: nikosh;">তারিখঃ</span> ' . $esc($reqDate) . ' <span class="bn" style="font-family: nikosh;">খ্রিঃ</span></td>'
            . '</tr>'
            . '</table>';

        // Centered title — Material Requisition Note
        $titleBlock = '<div style="text-align: center; margin-bottom: 14pt;">'
            . '<div class="bn" style="font-family: nikosh; font-size: 13pt; color: #000;">মালামাল চাহিদাপত্র</div>'
            . '<div style="font-size: 11pt; color: #000; margin-top: 1pt;">(MATERIAL REQUISITION NOTE)</div>'
            . '</div>';

        // Job / customer header block
        $headerBlock = '<table width="100%" cellspacing="0" cellpadding="0" style="margin-bottom: 8pt; border-collapse: collapse; border: 0.75pt solid #000;">'
            . '<tr>'
            .   '<td width="50%" style="border: 0.75pt solid #000; padding: 6pt 8pt; font-size: 10pt; color: #000; vertical-align: top; line-height: 1.5;">'
            .     ($mr->workOrder
                    ? '<div><b>Job No:</b> ' . $jobNumber . '</div><div><b>WO No:</b> ' . $woNumber . '</div>'
                    : '<div><b>Job:</b> None — shop use</div>')
            .     ($mr->section ? '<div><b>For:</b> ' . $esc($mr->section->name) . '</div>' : '')
            .   '</td>'
            .   '<td width="50%" style="border: 0.75pt solid #000; padding: 6pt 8pt; font-size: 10pt; color: #000; vertical-align: top; line-height: 1.5;">'
            .     '<div><b>Customer:</b> ' . $customer . '</div>'
            .     '<div><b>Status:</b> ' . $esc($mr->status_label) . '</div>'
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
        $itemsHtml .=   '<th style="border: 0.75pt solid #000; padding: 4pt 2pt; font-size: 9pt; font-weight: normal; text-align: center;"><span class="bn" style="font-family: nikosh;">ক্র.নং</span><br>(Sl. No)</th>';
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
                $itemsHtml .=   '<td style="border: 0.75pt solid #000; padding: 6pt 6pt; font-size: 10pt; font-weight: bold; vertical-align: top;">' . $esc($item->name ?: '—') . '</td>';
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

        // The signature image is the whole block (the scan carries the name,
        // designation and contacts), so a signed sheet prints the image and its
        // role label only. Unsigned keeps the typed lines.
        $hasSig = $preparerSig && is_file($preparerSig);
        $sigImg = SignatureBlock::html($hasSig ? $preparerSig : null, [], blankHeightPt: 40, imageMaxWidthPt: 160, align: 'left');

        $signatureBlock = '<table width="100%" cellspacing="0" cellpadding="0" style="margin-top: 30pt;">'
            . '<tr>'
            .   '<td width="55%" style="vertical-align: bottom; text-align: left;">'
            .     '<div style="margin-bottom: 4pt;">' . $sigImg . '</div>'
            .     '<div style="border-top: 0.75pt solid #000; padding-top: 4pt; font-size: 10pt; font-weight: bold; color: #000; display: inline-block; min-width: 160pt;">Prepared By</div>'
            .     ($hasSig ? '' :
                      '<div style="font-size: 10pt; color: #000; margin-top: 2pt;">' . $preparerName . '</div>'
                      . ($preparerTitle !== '' ? '<div style="font-size: 9pt; color: #4b5563; margin-top: 1pt;">' . $preparerTitle . '</div>' : '')
                      . ($preparerCenter !== '' ? '<div style="font-size: 9pt; color: #4b5563;">' . $preparerCenter . '</div>' : '')
                      . ($preparerPhone !== ''  ? '<div style="font-size: 9pt; color: #4b5563; margin-top: 1pt;"><span class="bn" style="font-family: nikosh;">ফোনঃ</span> ' . $preparerPhone . '</div>' : '')
                      . ($preparerEmail !== ''  ? '<div style="font-size: 9pt; color: #4b5563;"><span class="bn" style="font-family: nikosh;">ই-মেইলঃ</span> ' . $preparerEmail . '</div>' : ''))
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

    /**
     * The form posts the requisition and its lines; it never sets a status
     * (the buttons do) nor issued quantities (recording an issue does).
     */
    private function validateRequisition(Request $request, ?int $id = null): array
    {
        $request->merge(['mrn_number' => trim((string) $request->input('mrn_number', ''))]);

        return $request->validate([
            // The IMS number. Optional — blank is numbered here (MRN-YYYY-NNNN).
            'mrn_number'           => 'nullable|string|max:30|unique:material_requisitions,mrn_number' . ($id ? ",{$id}" : ''),
            // The job is optional — material is also needed for no job (consumables,
            // tools, a shop's upkeep). Then it must say which shop it is for.
            'work_order_id'        => 'nullable|exists:work_orders,id',
            'section_id'           => 'nullable|required_without:work_order_id|exists:sections,id',
            'request_date'         => 'required|date',
            'notes'                => 'nullable|string|max:1000',
            'items'                => 'required|array|min:1',
            // The material is what the store hands over — it must come from the master.
            // A master material — or, when the item is not in the master, its name typed.
            'items.*.material_id'  => 'nullable|exists:materials,id',
            'items.*.item_name'    => 'nullable|required_without:items.*.material_id|string|max:255',
            // The size / thickness / spec to cut — optional, multi-line.
            'items.*.description'  => 'nullable|string|max:1000',
            'items.*.unit'         => 'nullable|string|max:20',
            'items.*.required_qty' => 'required|numeric|gt:0',
            'items.*.remarks'      => 'nullable|string|max:500',
        ], [
            'items.*.item_name.required_without' => 'Pick a material, or type the item.',
            'items.*.required_qty.gt'       => 'Enter how much is required.',
            'mrn_number.unique'             => 'Another requisition already has that MRN number.',
            'section_id.required_without'   => 'With no job, say which shop it is for.',
        ]);
    }
}
