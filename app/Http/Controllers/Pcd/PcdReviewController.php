<?php

namespace App\Http\Controllers\Pcd;

use App\Http\Controllers\Controller;
use App\Models\WorkOrder;
use App\Services\NotifyService;
use App\Services\PcdJobDocuments;
use App\Services\PcdReleaseService;
use Illuminate\Http\Request;
use Inertia\Inertia;

/**
 * PCD Inbox — where a work order arrives, and the নির্বাহী প্রকৌশলী decides.
 *
 * BITAC's flow (2026-09-30): IED forwards a work order, the **Executive
 * Engineer** reads it, and either passes it on to the planning desk or sends it
 * back to IED with a reason. Only after that does anyone set a job number,
 * raise a material requisition or route it through the shops.
 *
 * ⚠️ **This is the inbox; `PcdJobPlanningController` is the desk.** The screen
 * that used to be called "PCD Inbox" was never an inbox — work did not arrive
 * there, it was worked on there. It is **Job Planning** now, and this is the
 * step in front of it.
 *
 * Gated by **`review pcd-inbox`**, which is a different permission from
 * `view pcd-inbox`: the officer who plans the job need not be the one who
 * accepts it, and the boss need not do the planning.
 */
class PcdReviewController extends Controller
{
    public function index()
    {
        $jobs = WorkOrder::with(['customer', 'quotation', 'items'])
            ->where('status', 'pcd_review')
            ->orderBy('pcd_handoff_at')      // oldest first — nothing should wait
            ->get()
            ->map(fn (WorkOrder $wo) => [
                'id'             => $wo->id,
                'wo_number'      => $wo->wo_number,
                'customer'       => $wo->customer?->name,
                'customer_po_no' => $wo->customer_po_no,
                'quantity'       => (float) $wo->quantity,
                'item_count'     => $wo->items->count(),
                'priority'       => $wo->priority,
                'due_date'       => $wo->due_date?->format('d M Y'),
                'amount'         => (float) ($wo->quotation?->total_amount ?? 0),
                'handed_over_at' => $wo->pcd_handoff_at?->format('d M Y, h:i A'),
                'waiting_days'   => $wo->pcd_handoff_at?->diffInDays(now()),
                'notes'          => $wo->notes,
            ]);

        // Planned and waiting to be let onto the shop floor — the second half
        // of this officer's job. Same screen, because it is the same person.
        $releases = WorkOrder::with(['customer', 'items', 'sections.section'])
            ->where('status', 'pcd_release_pending')
            ->orderBy('release_requested_at')
            ->get()
            ->map(fn (WorkOrder $wo) => [
                'id'            => $wo->id,
                'wo_number'     => $wo->wo_number,
                'job_number'    => $wo->job_number,
                'customer'      => $wo->customer?->name,
                'quantity'      => (float) $wo->quantity,
                'item_count'    => $wo->items->count(),
                'shop_count'    => $wo->sections->count(),
                'shops'         => $wo->sections->sortBy('sequence')
                    ->map(fn ($s) => $s->section?->name)->filter()->values()->all(),
                'due_date'      => $wo->due_date?->format('d M Y'),
                'requested_at'  => $wo->release_requested_at?->format('d M Y, h:i A'),
                'waiting_days'  => $wo->release_requested_at?->diffInDays(now()),
            ]);

        return Inertia::render('Pcd/Inbox', [
            'jobs'     => $jobs,
            'releases' => $releases,
            'stats' => [
                'waiting'  => $jobs->count(),
                'overdue'  => $jobs->where('waiting_days', '>=', 2)->count(),
                'releases' => $releases->count(),
            ],
        ]);
    }

    /**
     * What the নির্বাহী প্রকৌশলী reads before letting a job onto the floor.
     *
     * The routing the সহকারী প্রকৌশলী set, the operation sheet behind each
     * item, and the papers the job arrived with.
     */
    public function showRelease(WorkOrder $workOrder)
    {
        if ($workOrder->status !== 'pcd_release_pending') {
            return redirect()->route('pcd.inbox.index')
                ->with('error', "WO {$workOrder->wo_number} is not waiting for release — it is {$workOrder->status_label}.");
        }

        $workOrder->load([
            'customer', 'items', 'quotation.rfq', 'rfq.gatePasses.items', 'files',
            'sections.section', 'operationSheets.steps.section', 'operationSheets.steps.machine',
            'operationSheets.workOrderItem', 'materialRequisitions',
        ]);

        return Inertia::render('Pcd/Release', [
            'job' => [
                'id'            => $workOrder->id,
                'wo_number'     => $workOrder->wo_number,
                'job_number'    => $workOrder->job_number,
                'customer'      => $workOrder->customer?->name,
                'quantity'      => (float) $workOrder->quantity,
                'priority'      => $workOrder->priority,
                'due_date'      => $workOrder->due_date?->format('d M Y'),
                'notes'         => $workOrder->notes,
                'requested_at'  => $workOrder->release_requested_at?->format('d M Y, h:i A'),
                'mr_count'      => $workOrder->materialRequisitions->count(),
                'pdf_url'       => "/pcd/job/{$workOrder->id}/work-order/pdf?preview=base64",
                'sections'      => $workOrder->sections->sortBy('sequence')->values()
                    ->map(fn ($s) => [
                        'id'         => $s->id,
                        'sequence'   => $s->sequence,
                        'name'       => $s->section?->name,
                        'code'       => $s->section?->code,
                        'weight_pct' => (float) ($s->weight_pct ?? 0),
                    ])->all(),
                'items' => $workOrder->items->map(function ($item) use ($workOrder) {
                    $sheet = $workOrder->operationSheets->firstWhere('work_order_item_id', $item->id);
                    return [
                        'id'           => $item->id,
                        'description'  => $item->description,
                        'quantity'     => (float) $item->quantity,
                        'unit'         => $item->unit,
                        'sheet_number' => $sheet?->sheet_number,
                        'step_count'   => $sheet?->steps->count() ?? 0,
                        'steps'        => $sheet
                            ? $sheet->steps->sortBy('sequence')->values()->map(fn ($st) => [
                                'sequence'   => $st->sequence,
                                'operation'  => $st->operation_name ?? $st->description,
                                'section'    => $st->section?->name,
                                'machine'    => $st->machine?->name,
                                'target_qty' => (float) ($st->target_qty ?? 0),
                            ])->all()
                            : [],
                        'sheet_pdf_url' => $sheet
                            ? "/pcd/job/{$workOrder->id}/operation-sheets/{$sheet->id}/pdf?preview=base64"
                            : null,
                    ];
                })->values(),
            ],
            'documents' => app(PcdJobDocuments::class)->for($workOrder),
        ]);
    }

    /** Let it onto the shop floor. */
    public function approveRelease(Request $request, WorkOrder $workOrder)
    {
        if ($blocker = $this->releaseBlocker($workOrder)) {
            return $blocker;
        }

        $data = $request->validate(['note' => 'nullable|string|max:2000']);
        $note = trim((string) ($data['note'] ?? ''));

        if ($note !== '') {
            $stamp = '[Release · ' . (auth()->user()?->name ?? 'PCD') . ', ' . now()->format('d M Y') . '] ' . $note;
            $workOrder->update(['notes' => trim(($workOrder->notes ? $workOrder->notes . "\n\n" : '') . $stamp)]);
        }

        PcdReleaseService::approveRelease($workOrder->fresh());

        return redirect()->route('pcd.inbox.index')
            ->with('success', "WO {$workOrder->wo_number} released to the shops.");
    }

    /**
     * Send it back to the planning desk.
     *
     * Back to `pcd_pending` with the reason on the record, so the সহকারী
     * প্রকৌশলী can see what to change. The reason is required: a job
     * coming back with no explanation is a job that got lost.
     */
    public function rejectRelease(Request $request, WorkOrder $workOrder)
    {
        if ($blocker = $this->releaseBlocker($workOrder)) {
            return $blocker;
        }

        $data   = $request->validate(['reason' => 'required|string|max:2000']);
        $reason = trim($data['reason']);
        $stamp  = '[Release returned · ' . (auth()->user()?->name ?? 'PCD') . ', ' . now()->format('d M Y') . '] ' . $reason;

        $workOrder->update([
            'status'               => 'pcd_pending',
            'release_requested_at' => null,
            'notes'                => trim(($workOrder->notes ? $workOrder->notes . "\n\n" : '') . $stamp),
        ]);

        NotifyService::toPermission(
            'view pcd-inbox',
            'job_release_returned',
            'Job sent back to planning',
            "WO {$workOrder->wo_number} ({$workOrder->customer?->name}) was not released.\n\nReason: {$reason}",
            "/pcd/job-planning/{$workOrder->id}",
            'fi-rr-undo',
            'amber',
            centerId: $workOrder->center_id,
        );

        return redirect()->route('pcd.inbox.index')
            ->with('success', "WO {$workOrder->wo_number} sent back to Job Planning.");
    }

    /** Only a job actually waiting for release can be decided on. */
    private function releaseBlocker(WorkOrder $workOrder)
    {
        if ($workOrder->status === 'pcd_release_pending') {
            return null;
        }

        return redirect()->route('pcd.inbox.index')
            ->with('error', "WO {$workOrder->wo_number} is not waiting for release — it is {$workOrder->status_label}.");
    }

    /**
     * The work order as it arrived, for the boss to read before deciding.
     *
     * ⚠️ Anything that has already moved on is sent to the planning desk rather
     * than refused — notifications written before this step existed point at
     * `/pcd/inbox/{id}`, and a stale link must land somewhere useful.
     */
    public function show(WorkOrder $workOrder)
    {
        if ($workOrder->status !== 'pcd_review') {
            return redirect()->route('pcd.job-planning.show', $workOrder);
        }

        $workOrder->load([
            'customer', 'items', 'quotation.items', 'quotation.rfq',
            'rfq.items.product', 'rfq.gatePasses.items', 'files', 'pcdHandoffBy',
        ]);

        return Inertia::render('Pcd/Review', [
            'job' => [
                'id'             => $workOrder->id,
                'wo_number'      => $workOrder->wo_number,
                'customer'       => $workOrder->customer?->name,
                'customer_po_no' => $workOrder->customer_po_no,
                'quantity'       => (float) $workOrder->quantity,
                'priority'       => $workOrder->priority,
                'due_date'       => $workOrder->due_date?->format('d M Y'),
                'status'         => $workOrder->status,
                'notes'          => $workOrder->notes,
                'amount'         => (float) ($workOrder->quotation?->total_amount ?? 0),
                // Quotations have no number column of their own; the padded
                // id + version is how they are named everywhere else.
                'quotation_no'   => $workOrder->quotation
                    ? 'Q-' . str_pad((string) $workOrder->quotation->id, 5, '0', STR_PAD_LEFT)
                        . ' v' . $workOrder->quotation->version
                    : null,
                'handed_over_at' => $workOrder->pcd_handoff_at?->format('d M Y, h:i A'),
                'handed_over_by' => $workOrder->pcdHandoffBy?->name,
                'items'          => $workOrder->items->map(fn ($i) => [
                    'id'          => $i->id,
                    'description' => $i->description,
                    'quantity'    => (float) $i->quantity,
                    'unit'        => $i->unit,
                    'part_no'     => $i->part_no,
                    'ied_note'    => $i->ied_note,
                ])->values(),
            ],
            // ⚠️ The same set the planning desk gets — one packer, so the boss
            // and the planner can never be looking at different paperwork.
            'documents' => app(PcdJobDocuments::class)->for($workOrder),
        ]);
    }

    /** Pass it to the planning desk. */
    public function forward(Request $request, WorkOrder $workOrder)
    {
        if ($blocker = $this->blocker($workOrder)) {
            return $blocker;
        }

        $data = $request->validate(['note' => 'nullable|string|max:2000']);
        $note = trim((string) ($data['note'] ?? ''));

        $notes = $workOrder->notes;
        if ($note !== '') {
            $stamp = '[PCD Review · ' . (auth()->user()?->name ?? 'PCD') . ', ' . now()->format('d M Y') . '] ' . $note;
            $notes = trim(($notes ? $notes . "\n\n" : '') . $stamp);
        }

        $workOrder->update([
            'status'           => 'pcd_pending',
            'pcd_forwarded_at' => now(),
            'pcd_forwarded_by' => auth()->id(),
            'pcd_review_note'  => $note !== '' ? $note : null,
            'notes'            => $notes,
        ]);

        $message = "WO {$workOrder->wo_number} ({$workOrder->customer?->name}) has been released for planning.";
        if ($note !== '') {
            $message .= "\n\nNote: {$note}";
        }

        NotifyService::toPermission(
            'view pcd-inbox',
            'work_order_released_for_planning',
            'Work Order ready for planning',
            $message,
            "/pcd/job-planning/{$workOrder->id}",
            'fi-rr-clipboard-list',
            centerId: $workOrder->center_id,
        );

        return redirect()->route('pcd.inbox.index')
            ->with('success', "WO {$workOrder->wo_number} sent to Job Planning.");
    }

    /**
     * Send it back to IED.
     *
     * The work order returns to `ied_pending`, which is where it started, so it
     * reappears in the IED Work Order Inbox and can be corrected and forwarded
     * again. The reason is required — a work order coming back with no
     * explanation is just a work order that got lost.
     */
    public function sendBack(Request $request, WorkOrder $workOrder)
    {
        if ($blocker = $this->blocker($workOrder)) {
            return $blocker;
        }

        $data   = $request->validate(['reason' => 'required|string|max:2000']);
        $reason = trim($data['reason']);

        $stamp = '[PCD → IED · ' . (auth()->user()?->name ?? 'PCD') . ', ' . now()->format('d M Y') . '] ' . $reason;

        $workOrder->update([
            'status'         => 'ied_pending',
            'pcd_handoff_at' => null,
            'pcd_handoff_by' => null,
            'notes'          => trim(($workOrder->notes ? $workOrder->notes . "\n\n" : '') . $stamp),
        ]);

        NotifyService::toPermission(
            'view rfqs',
            'work_order_returned_by_pcd',
            'Work Order sent back by PCD',
            "WO {$workOrder->wo_number} ({$workOrder->customer?->name}) was sent back by PCD.\n\nReason: {$reason}",
            "/ied/work-orders/{$workOrder->id}",
            'fi-rr-undo',
            centerId: $workOrder->center_id,
        );

        return redirect()->route('pcd.inbox.index')
            ->with('success', "WO {$workOrder->wo_number} sent back to IED.");
    }

    /**
     * Only a work order actually waiting here can be decided on.
     *
     * A redirect + flash, never `abort()` — a second click from a stale list or
     * the back button must read as a message, not a crash.
     */
    private function blocker(WorkOrder $workOrder)
    {
        if ($workOrder->status === 'pcd_review') {
            return null;
        }

        return redirect()->route('pcd.inbox.index')
            ->with('error', "WO {$workOrder->wo_number} is no longer waiting for review — it is {$workOrder->status_label}.");
    }
}
