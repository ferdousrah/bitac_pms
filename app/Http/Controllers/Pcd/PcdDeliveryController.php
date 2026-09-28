<?php

namespace App\Http\Controllers\Pcd;

use App\Http\Controllers\Controller;
use App\Models\DeliveryOrder;
use App\Services\DeliveryChallanService;
use Illuminate\Http\Request;

/**
 * The delivery side of a PCD job.
 *
 * Delivery Orders themselves moved under PCD (BITAC, 2026-09-28) — the
 * department that ran the job also ships it — so the `/delivery` module is the
 * place they are raised. What lives here is the job detail's view of them: the
 * challan, and the row packer the job page shares with it.
 */
class PcdDeliveryController extends Controller
{
    /**
     * The delivery challan, for PCD.
     *
     * ⚠️ A deliberate second door onto the same PDF: `delivery.pdf` is gated by
     * `view delivery`, and the job detail is open to anyone with `view
     * pcd-inbox`, who need not hold it. Same service, same bytes — only the
     * permission differs. (The production op-sheet PDF has the same shape.)
     */
    public function challan(Request $request, DeliveryOrder $delivery)
    {
        $bytes    = app(DeliveryChallanService::class)->generatePdf($delivery);
        $filename = "challan-{$delivery->challan_number}.pdf";

        if ($request->query('preview') === 'base64') {
            return response()->json([
                'filename' => $filename,
                'size'     => strlen($bytes),
                'data'     => base64_encode($bytes),
            ]);
        }

        return response($bytes, 200, [
            'Content-Type'        => 'application/pdf',
            'Content-Disposition' => ($request->boolean('preview') ? 'inline' : 'attachment')
                . '; filename="' . $filename . '"',
            'Content-Length'      => strlen($bytes),
        ]);
    }

    /** One row, shared by the list and the job detail card. */
    public static function pack(DeliveryOrder $d): array
    {
        return [
            'id'             => $d->id,
            'challan_number' => $d->challan_number,
            'work_order_id'  => $d->work_order_id,
            'job_number'     => $d->workOrder?->job_number,
            'wo_number'      => $d->workOrder?->wo_number,
            'customer'       => $d->workOrder?->customer?->name,
            'quantity'       => (float) $d->quantity_delivered,
            'status'         => $d->status,
            'scheduled_date' => $d->scheduled_date?->format('d M Y'),
            'delivered_at'   => $d->delivered_at?->format('d M Y, h:i A'),
            'vehicle_number' => $d->vehicle_number,
        ];
    }
}
