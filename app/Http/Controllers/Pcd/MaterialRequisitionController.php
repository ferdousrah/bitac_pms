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

        return Inertia::render('Pcd/MaterialRequisition/Form', [
            'requisition' => null,
            'work_order'  => $workOrder ? $this->serializeWorkOrder($workOrder) : null,
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
            'materials' => Material::active()->orderBy('name')->get(['id', 'name', 'rate_per_kg']),
        ]);
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
            'materials' => Material::active()->orderBy('name')->get(['id', 'name', 'rate_per_kg']),
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
                'id'           => $i->id,
                'item_no'      => $i->item_no,
                'description'  => $i->description,
                'material_id'  => $i->material_id,
                'unit'         => $i->unit,
                'required_qty' => $i->required_qty,
                'stock_qty'    => $i->stock_qty,
                'issue_qty'    => $i->issue_qty,
                'pending_qty'  => $i->pending_qty,
                'issue_date'   => $i->issue_date?->format('Y-m-d'),
                'remarks'      => $i->remarks,
            ]),
        ];
    }

    private function validateRequisition(Request $request): array
    {
        return $request->validate([
            'work_order_id'    => 'required|exists:work_orders,id',
            'request_date'     => 'required|date',
            'status'           => 'nullable|in:draft,pending_approval,approved,partially_issued,issued,received,cancelled',
            'notes'            => 'nullable|string|max:1000',
            'items'            => 'required|array|min:1',
            'items.*.description'  => 'required|string|max:255',
            'items.*.material_id'  => 'nullable|exists:materials,id',
            'items.*.unit'         => 'nullable|string|max:20',
            'items.*.required_qty' => 'required|numeric|min:0',
            'items.*.stock_qty'    => 'nullable|numeric|min:0',
            'items.*.issue_qty'    => 'nullable|numeric|min:0',
            'items.*.issue_date'   => 'nullable|date',
            'items.*.remarks'      => 'nullable|string|max:255',
        ]);
    }
}
