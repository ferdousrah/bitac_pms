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
        $workOrder->load(['product', 'customer', 'bom.items.material', 'materialRequisitions']);

        $mrpItems = $workOrder->materialRequisitions->map(fn($m) => [
            'id'             => $m->id,
            'material_name'  => $m->material_name,
            'material_code'  => $m->material_code ?? '',
            'bom_qty'        => $m->bom_qty ?? $m->required_qty,
            'required_qty'   => $m->required_qty,
            'unit'           => $m->unit,
            'available'      => $m->status !== 'shortage',
            'stock_qty'      => $m->stock_qty ?? null,
            'lead_time_days' => $m->lead_time_days ?? null,
        ]);

        return Inertia::render('MRP/Show', [
            'workOrder' => [
                'id'       => $workOrder->id,
                'wo_number'=> $workOrder->wo_number,
                'product'  => $workOrder->product->name ?? '',
                'customer' => $workOrder->customer->name ?? '',
                'quantity' => $workOrder->quantity,
            ],
            'mrpItems'     => $mrpItems,
            'imsAvailable' => !empty(config('ims.base_url')),
            'canRunMrp'    => auth()->user()->can('manage production'),
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
