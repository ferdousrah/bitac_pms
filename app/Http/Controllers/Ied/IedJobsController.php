<?php

namespace App\Http\Controllers\Ied;

use App\Http\Controllers\Controller;
use App\Models\WorkOrder;
use Illuminate\Http\Request;
use Inertia\Inertia;

/**
 * Read-only Jobs view for IED.
 *
 * IED needs visibility into every Work Order once it's left the IED inbox
 * (so they can answer the customer when the customer asks about progress).
 * No actions — no accept/reject/edit. The list shows every WO except the
 * `ied_pending` ones, which belong to the separate IED inbox.
 */
class IedJobsController extends Controller
{
    public function index(Request $request)
    {
        $query = WorkOrder::with(['customer', 'rfq', 'quotation', 'createdBy'])
            // Jobs IED can browse: anything that's moved past the IED acceptance
            // gate. ied_pending rows live in the dedicated IED inbox instead.
            ->whereNotIn('status', ['ied_pending'])
            ->latest('id');

        if ($search = $request->input('search')) {
            $query->where(function ($q) use ($search) {
                $q->where('wo_number', 'like', "%{$search}%")
                  ->orWhere('job_number', 'like', "%{$search}%")
                  ->orWhere('customer_po_no', 'like', "%{$search}%")
                  ->orWhereHas('customer', fn($c) => $c->where('name', 'like', "%{$search}%"));
            });
        }

        if ($status = $request->input('status')) {
            $query->where('status', $status);
        }

        $jobs = $query->paginate(20)->withQueryString()
            ->through(fn ($wo) => [
                'id'              => $wo->id,
                'wo_number'       => $wo->wo_number,
                'job_number'      => $wo->job_number,
                'customer'        => $wo->customer?->name ?? '—',
                'customer_po_no'  => $wo->customer_po_no,
                'quantity'        => (float) $wo->quantity,
                'priority'        => $wo->priority,
                'due_date'        => $wo->due_date?->format('d M Y'),
                'status'          => $wo->status,
                'status_label'    => $wo->status_label,
                'status_color'    => $wo->status_color,
                'progress_pct'    => $wo->production_progress,
                'rfq_id'          => $wo->rfq_id,
                'quotation_id'    => $wo->quotation_id,
                'source'          => $wo->createdBy ? 'staff' : 'customer_portal',
                'created_by'      => $wo->createdBy?->name,
                'created_at'      => $wo->created_at->format('d M Y'),
            ]);

        return Inertia::render('Ied/Jobs/Index', [
            'jobs'    => $jobs,
            'filters' => [
                'search' => $request->input('search', ''),
                'status' => $request->input('status', ''),
            ],
        ]);
    }

    public function show(WorkOrder $workOrder)
    {
        // ied_pending WOs belong in the inbox, not the Jobs view.
        abort_if($workOrder->status === 'ied_pending', 404);

        $workOrder->load([
            'customer', 'rfq.items.product', 'quotation', 'createdBy', 'pcdHandoffBy',
            'items.product', 'files',
            'sections.section', 'sections.completedBy',
            'operationSheets.steps.section',
        ]);

        // Build a unified attachment list. The first three entries are virtual —
        // they point at the existing PDF-export endpoints for RFQ, Quotation
        // and the customer's signed Work Order (already streamed through the
        // IDM-safe controller route). Then we tack on any extra files stored
        // against the WO row itself (cancellation docs, IED notes, etc.).
        $attachments = [];

        // RFQ slot — show the customer's own uploaded letter when present
        // (that's the document the customer actually recognises). If they
        // didn't upload one, the slot is skipped entirely.
        $rfq = $workOrder->rfq;
        if ($rfq && $rfq->rfq_letter_path) {
            $ext = strtolower(pathinfo($rfq->rfq_letter_path, PATHINFO_EXTENSION));
            $attachments[] = [
                'id'    => "rfq-letter-{$rfq->id}",
                'kind'  => 'rfq_letter',
                'title' => $rfq->rfq_letter_title ?: 'Customer RFQ Letter',
                'subtitle' => 'Uploaded by ' . ($rfq->customer?->name ?: 'the customer') . ' with RFQ #' . $rfq->id,
                'url'   => route('rfqs.letter', $rfq->id),
                'extension' => $ext ?: 'pdf',
            ];
        }
        if ($workOrder->quotation_id) {
            $attachments[] = [
                'id'    => "quotation-{$workOrder->quotation_id}",
                'kind'  => 'quotation_pdf',
                'title' => 'Quotation Q-' . str_pad((string) $workOrder->quotation_id, 5, '0', STR_PAD_LEFT)
                          . ($workOrder->quotation?->version ? ' v' . $workOrder->quotation->version : ''),
                'subtitle' => 'Approved quotation issued to the customer',
                'url'   => "/quotations/{$workOrder->quotation_id}/pdf",
                'extension' => 'pdf',
            ];
        }

        // Cost Estimate(s) — the IED costing worksheet(s) that fed into the
        // quotation. Prefer estimates directly linked to this quotation; fall
        // back to any estimate against the parent RFQ for older WOs.
        $estimates = \App\Models\CostEstimate::query()
            ->when($workOrder->quotation_id, fn ($q) => $q->where('quotation_id', $workOrder->quotation_id))
            ->when(!$workOrder->quotation_id && $workOrder->rfq_id, fn ($q) => $q->where('rfq_id', $workOrder->rfq_id))
            ->orderBy('id')
            ->get(['id', 'estimate_no', 'grand_total', 'status']);
        foreach ($estimates as $e) {
            $attachments[] = [
                'id'    => "estimate-{$e->id}",
                'kind'  => 'cost_estimate',
                'title' => 'Cost Estimate — ' . $e->estimate_no,
                'subtitle' => 'IED costing worksheet · ৳ ' . number_format((float) $e->grand_total, 2)
                            . ' · ' . ucfirst((string) $e->status),
                'url'   => route('cost-estimates.pdf', $e->id),
                'extension' => 'pdf',
            ];
        }

        // Customer Work Order — the signed file the customer uploaded when
        // issuing the WO. Same IDM-safe route the IED Inbox already uses.
        $customerPoFile = $workOrder->files->firstWhere('kind', 'customer_po');
        if ($customerPoFile) {
            $attachments[] = [
                'id'    => "wo-file-{$customerPoFile->id}",
                'kind'  => 'customer_work_order',
                'title' => $customerPoFile->title ?: 'Customer Work Order',
                'subtitle' => $customerPoFile->original_name ?: 'Signed customer authorisation',
                'url'   => route('ied.work-orders.files.show', $customerPoFile),
                'extension' => $customerPoFile->extension,
            ];
        }

        // Other WO files (cancellation docs, etc.) — only those that aren't
        // the customer PO (already surfaced above).
        foreach ($workOrder->files as $f) {
            if ($f->kind === 'customer_po') continue;
            $attachments[] = [
                'id'    => "wo-file-{$f->id}",
                'kind'  => $f->kind,
                'title' => $f->title ?: ($f->original_name ?: 'Attachment'),
                'subtitle' => $f->original_name,
                'url'   => route('ied.work-orders.files.show', $f),
                'extension' => $f->extension,
            ];
        }

        return Inertia::render('Ied/Jobs/Show', [
            'job' => [
                'id'             => $workOrder->id,
                'wo_number'      => $workOrder->wo_number,
                'job_number'     => $workOrder->job_number,
                'status'         => $workOrder->status,
                'status_label'   => $workOrder->status_label,
                'status_color'   => $workOrder->status_color,
                'priority'       => $workOrder->priority,
                'quantity'       => (float) $workOrder->quantity,
                'due_date'       => $workOrder->due_date?->format('d M Y'),
                'notes'          => $workOrder->notes,
                'customer_po_no' => $workOrder->customer_po_no,
                'created_at'     => $workOrder->created_at->format('d M Y, H:i'),
                'created_by'     => $workOrder->createdBy?->name,
                'source'         => $workOrder->createdBy ? 'staff' : 'customer_portal',
                'pcd_handoff_at' => $workOrder->pcd_handoff_at?->format('d M Y, H:i'),
                'pcd_handoff_by' => $workOrder->pcdHandoffBy?->name,
                'progress_pct'   => $workOrder->production_progress,
                'customer'       => $workOrder->customer ? [
                    'id'    => $workOrder->customer->id,
                    'name'  => $workOrder->customer->name,
                    'email' => $workOrder->customer->email,
                ] : null,
                'rfq_id'         => $workOrder->rfq_id,
                'quotation_id'   => $workOrder->quotation_id,
                'items'          => $workOrder->items->map(fn ($i) => [
                    'id'          => $i->id,
                    'job_number'  => $i->job_number,
                    'description' => $i->description,
                    'product'     => $i->product?->name,
                    'quantity'    => (float) $i->quantity,
                    'unit'        => $i->unit,
                    'status'      => $i->status,
                    'notes'       => $i->notes,
                ])->values(),
                // Section routing summary so IED can see how production is
                // flowing without bouncing through PCD.
                'sections'       => $workOrder->sections->sortBy('sequence')->map(fn ($s) => [
                    'id'         => $s->id,
                    'sequence'   => $s->sequence,
                    'name'       => $s->section?->name,
                    'code'       => $s->section?->code,
                    'status'     => $s->status,
                    'notes'      => $s->notes,
                    'completed_by' => $s->completedBy?->name,
                    'completed_at' => $s->completed_at?->format('d M Y'),
                ])->values(),
                // Unified attachment list — RFQ PDF, Quotation PDF, Customer
                // Work Order, and any other files on the WO row.
                'attachments'    => $attachments,
            ],
        ]);
    }
}
