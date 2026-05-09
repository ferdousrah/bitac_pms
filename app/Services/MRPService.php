<?php

namespace App\Services;

use App\Models\Bom;
use App\Models\MaterialRequisitionNote;
use App\Models\WorkOrder;

class MRPService
{
    public function __construct(private IMSService $imsService) {}

    public function calculate(WorkOrder $workOrder): array
    {
        $bom = $workOrder->bom ?? $workOrder->product->activeBom;

        if (!$bom) {
            return ['error' => 'No active BOM found for this product.', 'materials' => []];
        }

        $materials = [];
        foreach ($bom->items as $item) {
            $requiredQty = $item->quantity * $workOrder->quantity;
            $withWastage = $requiredQty * (1 + ($item->wastage_pct / 100));

            $stockData = $this->imsService->checkRawMaterialStock($item->material_code ?? '');

            $availableQty = $stockData['available_qty'] ?? 0;
            $imsStatus    = $stockData['ims_status'] ?? 'unavailable';

            $materials[] = [
                'material_name'  => $item->material_name,
                'material_code'  => $item->material_code,
                'required_qty'   => round($withWastage, 4),
                'available_qty'  => $availableQty,
                'shortage_qty'   => max(0, $withWastage - $availableQty),
                'unit'           => $item->unit,
                'wastage_pct'    => $item->wastage_pct,
                'ims_status'     => $imsStatus,
                'has_shortage'   => ($imsStatus === 'connected') && ($availableQty < $withWastage),
            ];
        }

        return [
            'bom_version' => $bom->version,
            'materials'   => $materials,
            'ims_status'  => $materials[0]['ims_status'] ?? 'unavailable',
        ];
    }

    public function createRequisitionNotes(WorkOrder $workOrder, array $materials): int
    {
        $created = 0;
        foreach ($materials as $material) {
            MaterialRequisitionNote::create([
                'work_order_id' => $workOrder->id,
                'material_name' => $material['material_name'],
                'material_code' => $material['material_code'] ?? null,
                'required_qty'  => $material['required_qty'],
                'available_qty' => $material['available_qty'],
                'shortage_qty'  => $material['shortage_qty'],
                'unit'          => $material['unit'],
                'status'        => 'pending',
                'requested_by'  => auth()->id(),
            ]);
            $created++;
        }
        return $created;
    }
}
