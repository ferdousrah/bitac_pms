<?php

namespace App\Services;

use App\Models\CostEstimate;
use App\Models\GatePass;
use App\Models\WorkOrder;
use Illuminate\Support\Collection;

/**
 * The paperwork that travels with a job from IED to PCD.
 *
 * BITAC's rule (2026-10-03): when IED forwards a job, **everything that
 * belongs to that work goes with it** — the customer's RFQ letter, the approved
 * quotation, **every gate pass raised against it — In and Out** — and the
 * **cost estimate(s)** it was priced from. PCD should not have to go and
 * find them.
 *
 * ⚠️ **One packer, used by BOTH PCD screens** — the inbox (`PcdReviewController`,
 * where the নির্বাহী প্রকৌশলী decides) and the planning desk
 * (`PcdJobPlanningController`). The boss and the planner must see the same
 * documents; two copies of this logic is how one screen quietly ends up
 * showing less than the other.
 *
 * ⚠️ **Every `pdf_url` here points at a PCD door**, not at IED's own routes.
 * The gate pass PDF is gated by `view pcd` and the cost estimate PDF by
 * `view cost-estimates` — neither of which a PCD role holds — so linking
 * straight to them hands the department a page it cannot open. See
 * `PcdDocumentController`.
 */
class PcdJobDocuments
{
    /**
     * Everything PCD should be able to open for this job.
     *
     * @return array{rfq_letter: ?array, quotation: ?array, gate_passes: array, cost_estimates: array, attachments: array}
     */
    public function for(WorkOrder $workOrder): array
    {
        $rfq = $workOrder->rfq ?: $workOrder->quotation?->rfq;

        return [
            'rfq_letter'     => $this->rfqLetter($rfq),
            'quotation'      => $this->quotation($workOrder),
            'gate_passes'    => $this->gatePasses($workOrder, $rfq),
            'cost_estimates' => $this->costEstimates($workOrder, $rfq),
            'attachments'    => $this->attachments($workOrder),
        ];
    }

    /** The customer's own letter, as they sent it — not BITAC's generated PDF. */
    private function rfqLetter($rfq): ?array
    {
        if (! $rfq || ! $rfq->rfq_letter_path) {
            return null;
        }

        return [
            'id'        => $rfq->id,
            'label'     => 'RFQ-' . str_pad((string) $rfq->id, 5, '0', STR_PAD_LEFT),
            'title'     => $rfq->rfq_letter_title ?: 'Customer RFQ Letter',
            'date'      => $rfq->created_at?->format('d M Y'),
            'extension' => strtolower(pathinfo($rfq->rfq_letter_path, PATHINFO_EXTENSION)),
            'pdf_url'   => route('rfqs.letter', $rfq->id) . '?preview=base64',
        ];
    }

    private function quotation(WorkOrder $workOrder): ?array
    {
        $quotation = $workOrder->quotation;
        if (! $quotation) {
            return null;
        }

        return [
            'id'      => $quotation->id,
            'label'   => 'Q-' . str_pad((string) $quotation->id, 5, '0', STR_PAD_LEFT) . ' v' . $quotation->version,
            'amount'  => (float) $quotation->total_amount,
            'status'  => $quotation->status,
            'pdf_url' => "/quotations/{$quotation->id}/pdf?preview=base64",
        ];
    }

    /**
     * Every gate pass on this job — **In and Out both**.
     *
     * The In pass says what physically arrived; the Out says what went back.
     * PCD needs both to know what is actually on the floor right now, so each
     * row carries its `direction` and the card groups them under BITAC's own
     * labels, **Gate Pass In** and **Gate Pass Out**.
     */
    private function gatePasses(WorkOrder $workOrder, $rfq): array
    {
        if (! $rfq) {
            return [];
        }

        return $this->passes($rfq)
            ->sortBy([['direction', 'asc'], ['pass_date', 'desc']])
            ->map(fn (GatePass $gp) => [
                'id'         => $gp->id,
                'pass_no'    => $gp->pass_no,
                'direction'  => $gp->direction,
                'status'     => $gp->status,
                'pass_date'  => $gp->pass_date?->format('d M Y'),
                'party_name' => $gp->party_name,
                'item_count' => $gp->items->count(),
                'items'      => $gp->items->take(4)->map(fn ($i) => $i->description)->filter()->values()->all(),
                'pdf_url'    => "/pcd/job/{$workOrder->id}/gate-passes/{$gp->id}/pdf?preview=base64",
            ])->values()->all();
    }

    /**
     * What the job was priced from.
     *
     * ⚠️ A job can hold **many** estimates — costing is part by part — so this
     * is a list, not a single document. Draft ones are included: PCD seeing a
     * figure that is still being worked on is better than PCD seeing nothing
     * and assuming there was no costing.
     */
    private function costEstimates(WorkOrder $workOrder, $rfq): array
    {
        if (! $rfq) {
            return [];
        }

        return CostEstimate::withoutGlobalScopes()
            ->where('rfq_id', $rfq->id)
            ->orderBy('rfq_item_id')->orderBy('id')
            ->get()
            ->map(fn (CostEstimate $e) => [
                'id'              => $e->id,
                'estimate_no'     => $e->estimate_no,
                'job_name'        => $e->job_name,
                'part_no'         => $e->part_no,
                'grand_total'     => (float) $e->grand_total,
                'status'          => $e->status,
                'approval_status' => $e->approval_status,
                'pdf_url'         => "/pcd/job/{$workOrder->id}/cost-estimates/{$e->id}/pdf?preview=base64",
            ])->values()->all();
    }

    /** Files uploaded onto the work order itself (customer PO, office order …). */
    private function attachments(WorkOrder $workOrder): array
    {
        return $workOrder->files
            ->reject(fn ($f) => $f->kind === 'cancellation')
            ->map(fn ($f) => [
                'id'        => $f->id,
                'kind'      => $f->kind,
                'name'      => $f->original_name,
                'extension' => strtolower(pathinfo((string) $f->original_name, PATHINFO_EXTENSION)),
                'pdf_url'   => route('pcd.job-planning.files.show', $f->id) . '?preview=base64',
            ])->values()->all();
    }

    /**
     * The gate passes on this RFQ.
     *
     * Shared with the PDF door, which uses it to prove a pass really belongs to
     * the job before handing the file over.
     */
    public function passes($rfq): Collection
    {
        if (! $rfq) {
            return collect();
        }

        return $rfq->relationLoaded('gatePasses')
            ? $rfq->gatePasses
            : $rfq->gatePasses()->with('items')->get();
    }
}
