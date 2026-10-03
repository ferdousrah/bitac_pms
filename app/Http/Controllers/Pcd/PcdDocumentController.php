<?php

namespace App\Http\Controllers\Pcd;

use App\Http\Controllers\CostEstimateController;
use App\Http\Controllers\Controller;
use App\Http\Controllers\Ied\GatePassController;
use App\Models\CostEstimate;
use App\Models\GatePass;
use App\Models\WorkOrder;
use App\Services\PcdJobDocuments;
use Illuminate\Http\Request;

/**
 * PCD's door onto the documents that travel with a job.
 *
 * ⚠️ **Why this exists at all:** the gate pass PDF is gated by `view pcd` and
 * the cost estimate PDF by `view cost-estimates`. **No PCD role holds either**
 * — they are IED's permissions. Linking the PCD screens straight at those
 * routes would hand the department a document it cannot open. Same service,
 * same bytes, different permission; the delivery challan and the production
 * op-sheet PDF already work this way.
 *
 * ⚠️ **The route carries the WORK ORDER, and the document must belong to it.**
 * A door keyed only on the document id would let anyone with `view pcd-inbox`
 * pull *any* gate pass or cost estimate in the system by guessing a number.
 * Every method proves the link first and 404s when it does not hold.
 */
class PcdDocumentController extends Controller
{
    public function __construct(private PcdJobDocuments $documents) {}

    /** A Gate Pass In raised against this job's RFQ. */
    public function gatePass(Request $request, WorkOrder $workOrder, GatePass $gatePass)
    {
        $rfq = $workOrder->rfq ?: $workOrder->quotation?->rfq;

        abort_unless(
            $rfq && (int) $gatePass->rfq_id === (int) $rfq->id,
            404,
            'That gate pass does not belong to this job.',
        );

        return app(GatePassController::class)->pdf($request, $gatePass);
    }

    /** A cost estimate this job was priced from. */
    public function costEstimate(Request $request, WorkOrder $workOrder, CostEstimate $costEstimate)
    {
        $rfq = $workOrder->rfq ?: $workOrder->quotation?->rfq;

        abort_unless(
            $rfq && (int) $costEstimate->rfq_id === (int) $rfq->id,
            404,
            'That cost estimate does not belong to this job.',
        );

        return app(CostEstimateController::class)->exportSinglePdf($request, $costEstimate);
    }
}
