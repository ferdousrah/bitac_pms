<?php

namespace App\Http\Controllers;

use App\Models\WorkOrder;
use App\Services\MRPService;
use Illuminate\Http\Request;
use Inertia\Inertia;

class MRPController extends Controller
{
    public function __construct(private MRPService $mrpService) {}

    public function show(WorkOrder $workOrder)
    {
        // BomItem stores material info as flat columns (material_name,
        // material_code) — no FK to Material, so we don't eager-load it.
        $workOrder->load(['product', 'customer', 'bom.items']);

        // Run the calculation each time the page loads — it reads from BOM +
        // IMS stock so values are always fresh. Cheap to recompute.
        $mrp = $this->mrpService->calculate($workOrder);

        $mrpItems = collect($mrp['materials'] ?? [])->map(fn ($m, $idx) => [
            'id'             => $idx + 1,
            'material_name'  => $m['material_name'],
            'material_code'  => $m['material_code'] ?? '',
            'required_qty'   => $m['required_qty'],
            'available_qty'  => $m['available_qty'] ?? 0,
            'shortage_qty'   => $m['shortage_qty'] ?? 0,
            'unit'           => $m['unit'] ?? 'pcs',
            'wastage_pct'    => $m['wastage_pct'] ?? 0,
            'available'      => ! ($m['has_shortage'] ?? false),
            'ims_status'     => $m['ims_status'] ?? 'unavailable',
        ])->values();

        return Inertia::render('MRP/Show', [
            'workOrder' => [
                'id'       => $workOrder->id,
                'wo_number'=> $workOrder->wo_number,
                'product'  => $workOrder->product->name ?? '',
                'customer' => $workOrder->customer->name ?? '',
                'quantity' => $workOrder->quantity,
            ],
            'mrpItems'     => $mrpItems,
            'bomError'     => $mrp['error'] ?? null,
            'bomVersion'   => $mrp['bom_version'] ?? null,
            'imsAvailable' => !empty(config('ims.base_url')),
            'canRunMrp'    => auth()->user()->can('manage production') || auth()->user()->can('run mrp'),
        ]);
    }

    public function run(WorkOrder $workOrder)
    {
        $this->mrpService->calculate($workOrder);
        return redirect()->route('mrp.show', $workOrder)->with('success', 'MRP calculation complete.');
    }

    public function createRequisition(Request $request, WorkOrder $workOrder)
    {
        $count = $this->mrpService->createRequisitionNotes($workOrder, []);
        return redirect()->route('mrp.show', $workOrder)->with('success', "{$count} material requisition note(s) created.");
    }
}
