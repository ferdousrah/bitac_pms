<?php

namespace App\Http\Controllers\Pcd;

use App\Http\Controllers\Controller;
use App\Models\WorkOrder;
use App\Models\WorkOrderFile;
use App\Services\PcdReleaseService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Inertia\Inertia;

class PcdInboxController extends Controller
{
    public function index()
    {
        // Cancelled jobs stay visible in PCD inbox (marked as closed) but are
        // hidden from production shops. PCD keeps the audit record on-screen.
        $jobs = WorkOrder::with(['customer', 'quotation', 'rfq.items', 'cancelledBy'])
            ->whereIn('status', ['pcd_pending', 'released_to_shops', 'cancelled'])
            ->latest('pcd_handoff_at')
            ->get()
            ->map(function ($wo) {
                $checklist = PcdReleaseService::checklistFor($wo);
                return [
                    'id'              => $wo->id,
                    'job_number'      => $wo->job_number,
                    'wo_number'       => $wo->wo_number,
                    'customer'        => $wo->customer?->name ?? '—',
                    'customer_po_no'  => $wo->customer_po_no,
                    'quantity'        => $wo->quantity,
                    'priority'        => $wo->priority,
                    'due_date'        => $wo->due_date?->format('d M Y'),
                    'status'          => $wo->status,
                    'pcd_handoff_at'  => $wo->pcd_handoff_at?->diffForHumans(),
                    'released_at'     => $wo->released_to_shops_at?->diffForHumans(),
                    'checklist'       => $checklist,
                    'item_count'      => $wo->rfq?->items->count() ?? 0,
                    'job_type'        => $wo->rfq?->job_type ?? $wo->quotation?->rfq?->job_type ?? 'regular',
                    'cancelled_at'    => $wo->cancelled_at?->format('d M Y'),
                    'cancelled_by'    => $wo->cancelledBy?->name,
                    'cancellation_reason' => $wo->cancellation_reason,
                ];
            });

        $stats = [
            'total'      => $jobs->count(),
            'pending'    => $jobs->where('status', 'pcd_pending')->count(),
            'released'   => $jobs->where('status', 'released_to_shops')->count(),
            'cancelled'  => $jobs->where('status', 'cancelled')->count(),
            'mr_pending' => $jobs->filter(fn($j) => $j['status'] !== 'cancelled' && !$j['checklist']['material_requisition']['done'])->count(),
        ];

        return Inertia::render('Pcd/Inbox', [
            'jobs'  => $jobs,
            'stats' => $stats,
        ]);
    }

    public function show(WorkOrder $workOrder)
    {
        $workOrder->load([
            'customer',
            'quotation.rfq.items.product',
            'quotation.rfq.items.drawings',
            'quotation.rfq.items.samplePhotos',
            'quotation.files.uploadedBy',
            'rfq.items.product',
            'rfq.items.drawings',
            'rfq.items.samplePhotos',
            'files.uploadedBy',
            'materialRequisitions.items', 'sections.section', 'sections.completedBy',
            'operationSheets.steps.section', 'operationSheets.steps.machine', 'operationSheets.steps.operator',
            'cancelledBy',
        ]);

        // Some legacy WOs were created without rfq_id set on the row itself.
        // Reach through the quotation as a fallback so Job Items always render.
        $rfq      = $workOrder->rfq      ?? $workOrder->quotation?->rfq;
        $rfqItems = $rfq?->items ?? collect();

        $checklist = PcdReleaseService::checklistFor($workOrder);

        // Build a unified attachment list from every upstream document in the
        // job's audit chain — RFQ drawings + sample photos (per item), Quotation
        // files (preparer-uploaded annexures), Work Order files (customer PO etc.).
        // Each entry carries a `source` label so the UI can group/color them.
        $allAttachments = collect();

        // RFQ item attachments (drawings + sample photos uploaded by sales/IED).
        foreach ($rfqItems as $item) {
            foreach ($item->drawings ?? [] as $f) {
                $allAttachments->push($this->serializeAttachment($f, 'rfq_drawing', $item->job_description));
            }
            foreach ($item->samplePhotos ?? [] as $f) {
                $allAttachments->push($this->serializeAttachment($f, 'rfq_sample', $item->job_description));
            }
        }

        // Quotation files (annexures, supporting docs, customer PO uploaded during quote prep).
        foreach ($workOrder->quotation?->files ?? [] as $f) {
            $allAttachments->push($this->serializeAttachment($f, 'quotation', null));
        }

        // Work Order files (customer PO copy uploaded at conversion, in-progress docs).
        foreach ($workOrder->files as $f) {
            $allAttachments->push($this->serializeAttachment($f, 'work_order', null));
        }

        return Inertia::render('Pcd/JobDetail', [
            'job' => [
                'id'                  => $workOrder->id,
                'job_number'          => $workOrder->job_number,
                'wo_number'           => $workOrder->wo_number,
                'job_type'            => $rfq?->job_type ?? 'regular',
                'customer'            => $workOrder->customer?->name ?? '—',
                'customer_po_no'      => $workOrder->customer_po_no,
                'quantity'            => $workOrder->quantity,
                'priority'            => $workOrder->priority,
                'due_date'            => $workOrder->due_date?->format('d M Y'),
                'status'              => $workOrder->status,
                'notes'               => $workOrder->notes,
                'pcd_handoff_at'      => $workOrder->pcd_handoff_at?->format('d M Y, h:i A'),
                'released_at'         => $workOrder->released_to_shops_at?->format('d M Y, h:i A'),
                'rfq_items'           => $rfqItems->map(fn($i) => [
                    'description' => $i->job_description ?? $i->product?->name ?? '—',
                    'quantity'    => $i->quantity,
                    'unit'        => $i->unit,
                ])->values(),
                // Upstream source documents — PCD officer can preview the original
                // RFQ (IED form) and the approved Quotation letter as PDFs.
                'rfq_source' => $rfq ? [
                    'id'           => $rfq->id,
                    'rfq_no'       => 'RFQ-' . str_pad($rfq->id, 5, '0', STR_PAD_LEFT),
                    'created_at'   => $rfq->created_at?->format('d M Y'),
                    'pdf_url'      => "/rfqs/{$rfq->id}/pdf?preview=base64",
                    'view_url'     => "/rfqs/{$rfq->id}",
                ] : null,
                'quotation_source' => $workOrder->quotation ? [
                    'id'           => $workOrder->quotation->id,
                    'version'      => $workOrder->quotation->version,
                    'quotation_no' => 'Q-' . str_pad($workOrder->quotation->id, 5, '0', STR_PAD_LEFT) . ' v' . $workOrder->quotation->version,
                    'total_amount' => (float) $workOrder->quotation->total_amount,
                    'status'       => $workOrder->quotation->status,
                    'pdf_url'      => "/quotations/{$workOrder->quotation->id}/pdf?preview=base64",
                    'view_url'     => "/quotations/{$workOrder->quotation->id}",
                ] : null,
                'attachments'         => $workOrder->files->map(fn($f) => [
                    'id'           => $f->id,
                    'kind'         => $f->kind,
                    'url'          => $f->url,
                    'filename'     => $f->original_name,
                    'extension'    => $f->extension,
                    'human_size'   => $f->human_size,
                    'description'  => $f->description,
                    'uploaded_by'  => $f->uploadedBy?->name,
                    'uploaded_at'  => $f->created_at->format('d M Y, H:i'),
                ])->values(),
                // Aggregated attachments across the full audit chain. PCD officer
                // can review every document the job inherited without bouncing
                // between RFQ / Quotation / WO pages.
                'all_attachments' => $allAttachments->values(),
                'material_requisitions' => $workOrder->materialRequisitions->map(fn($mr) => [
                    'id'          => $mr->id,
                    'mrn_number'  => $mr->mrn_number,
                    'status'      => $mr->status,
                    'item_count'  => $mr->items->count(),
                    'request_date'=> $mr->request_date?->format('d M Y'),
                ]),
                'sections' => $workOrder->sections->map(fn($s) => [
                    'id'        => $s->id,
                    'section'   => ['id' => $s->section->id, 'name' => $s->section->name, 'code' => $s->section->code],
                    'sequence'  => $s->sequence,
                    'status'    => $s->status,
                    'completed_at' => $s->completed_at?->format('d M Y'),
                ]),
                'operation_sheet' => $workOrder->operationSheets->first() ? [
                    'id'           => $workOrder->operationSheets->first()->id,
                    'sheet_number' => $workOrder->operationSheets->first()->sheet_number,
                    'step_count'   => $workOrder->operationSheets->first()->steps->count(),
                ] : null,
                'cancellation' => $workOrder->status === 'cancelled' ? [
                    'cancelled_at'   => $workOrder->cancelled_at?->format('d M Y, h:i A'),
                    'cancelled_by'   => $workOrder->cancelledBy?->name,
                    'reason'         => $workOrder->cancellation_reason,
                    'attachments'    => $workOrder->files->where('kind', 'cancellation')->map(fn($f) => [
                        'id'         => $f->id,
                        'url'        => $f->url,
                        'filename'   => $f->original_name,
                        'extension'  => $f->extension,
                        'human_size' => $f->human_size,
                    ])->values(),
                ] : null,
            ],
            'checklist' => $checklist,
        ]);
    }

    /**
     * Close (cancel) a PCD job mid-flow. Common path: an R&D job whose
     * outcome turns out uncertain and the PCD officer decides to drop it
     * before more resources are consumed. Reason is mandatory for audit.
     */
    /**
     * PCD officer assigns the job number for this Work Order. The number is
     * theirs to choose — they may have their own internal sequence or follow
     * a customer-specific convention. The same number is stamped on the WO
     * and on every WO item so downstream documents (op sheet, MRP, challan)
     * read consistently.
     *
     * Once set, the number can be edited until production starts, after
     * which it locks (downstream documents reference it).
     */
    public function setJobNumber(Request $request, WorkOrder $workOrder)
    {
        abort_unless(
            in_array($workOrder->status, ['pcd_pending'], true),
            422,
            'Job number can only be set while the work order is in PCD planning.'
        );

        $validated = $request->validate([
            'job_number' => [
                'required', 'string', 'max:50',
                // Reject if another WO already uses this number (excluding the current one).
                \Illuminate\Validation\Rule::unique('work_orders', 'job_number')->ignore($workOrder->id),
            ],
        ], [
            'job_number.unique' => 'This job number is already used on another work order.',
        ]);

        $jobNumber = trim($validated['job_number']);

        \DB::transaction(function () use ($workOrder, $jobNumber) {
            $workOrder->update(['job_number' => $jobNumber]);
            $workOrder->items()->whereNull('job_number')->update(['job_number' => $jobNumber]);
        });

        return back()->with('success', "Job number set to {$jobNumber}.");
    }

    public function cancel(Request $request, WorkOrder $workOrder)
    {
        if (in_array($workOrder->status, ['delivered', 'cancelled'])) {
            return back()->with('error', 'This job is already ' . $workOrder->status . ' and cannot be closed again.');
        }

        $validated = $request->validate([
            'reason'         => 'required|string|min:3|max:1000',
            'attachments'    => 'nullable|array|max:10',
            'attachments.*'  => 'file|max:20480|mimes:pdf,jpg,jpeg,png,doc,docx,xls,xlsx',
        ]);

        $workOrder->update([
            'status'              => 'cancelled',
            'cancelled_at'        => now(),
            'cancelled_by'        => auth()->id(),
            'cancellation_reason' => $validated['reason'],
        ]);

        // Attach supporting documents (office order, customer letter, etc.)
        foreach ($request->file('attachments', []) as $upload) {
            $path = $upload->store('work-order-files/cancellation', 'public');
            WorkOrderFile::create([
                'work_order_id' => $workOrder->id,
                'uploaded_by'   => auth()->id(),
                'kind'          => 'cancellation',
                'stored_path'   => $path,
                'original_name' => $upload->getClientOriginalName(),
                'mime_type'     => $upload->getMimeType(),
                'size_bytes'    => $upload->getSize(),
                'description'   => 'Job cancellation supporting document',
            ]);
        }

        return redirect()->route('pcd.inbox.index')
            ->with('success', "Job #{$workOrder->job_number} closed.");
    }

    /**
     * Normalize a file model from any upstream source (RfqItemFile,
     * QuotationFile, WorkOrderFile) into a uniform shape the PCD JobDetail
     * frontend can render. `source` lets the UI badge/group entries.
     */
    private function serializeAttachment($f, string $source, ?string $itemDescription): array
    {
        // Different file models expose slightly different fields. Build defensively.
        $ext = $f->extension ?? pathinfo($f->original_name ?? '', PATHINFO_EXTENSION);
        $humanSize = $f->human_size ?? $this->formatBytes((int) ($f->size_bytes ?? 0));

        return [
            'id'              => $f->id,
            'source'          => $source, // rfq_drawing | rfq_sample | quotation | work_order
            'kind'            => $f->kind ?? $f->type ?? null,
            'url'             => $f->url,
            'filename'        => $f->original_name,
            'extension'       => $ext ? strtoupper($ext) : null,
            'human_size'      => $humanSize,
            'mime_type'       => $f->mime_type ?? null,
            'description'     => $f->description ?? null,
            'item_description'=> $itemDescription, // only set for RFQ-item-scoped files
            'uploaded_by'     => $f->uploadedBy?->name ?? null,
            'uploaded_at'     => $f->created_at?->format('d M Y, H:i'),
        ];
    }

    private function formatBytes(int $bytes): ?string
    {
        if ($bytes <= 0) return null;
        if ($bytes < 1024) return $bytes . ' B';
        if ($bytes < 1024 * 1024) return round($bytes / 1024) . ' KB';
        return round($bytes / 1024 / 1024, 1) . ' MB';
    }
}
