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
        $materialRequisition->load(['workOrder.customer', 'items.material', 'requestedBy', 'approvedBy', 'issuedBy', 'receivedBy']);

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
     * Approve a draft requisition (Authorizing Officer signature).
     */
    public function approve(MaterialRequisition $materialRequisition)
    {
        $materialRequisition->update([
            'status'      => 'approved',
            'approved_by' => auth()->id(),
            'approved_at' => now(),
        ]);

        PcdReleaseService::tryRelease($materialRequisition->workOrder);

        return back()->with('success', 'Requisition approved.');
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
