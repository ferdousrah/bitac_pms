<?php

namespace App\Http\Controllers\Pcd;

use App\Http\Controllers\Controller;
use App\Models\WorkOrder;
use App\Services\PcdReleaseService;
use Inertia\Inertia;

class PcdInboxController extends Controller
{
    public function index()
    {
        $jobs = WorkOrder::with(['customer', 'quotation', 'rfq.items'])
            ->whereIn('status', ['pcd_pending', 'released_to_shops'])
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
                ];
            });

        $stats = [
            'total'      => $jobs->count(),
            'pending'    => $jobs->where('status', 'pcd_pending')->count(),
            'released'   => $jobs->where('status', 'released_to_shops')->count(),
            'mr_pending' => $jobs->filter(fn($j) => !$j['checklist']['material_requisition']['done'])->count(),
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
            ],
            'checklist' => $checklist,
        ]);
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
