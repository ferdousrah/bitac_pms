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
            'customer', 'quotation.rfq.items.product', 'rfq.items.product',
            'files.uploadedBy',
            'materialRequisitions.items', 'sections.section', 'sections.completedBy',
            'operationSheets.steps.section', 'operationSheets.steps.machine', 'operationSheets.steps.operator',
        ]);

        // Some legacy WOs were created without rfq_id set on the row itself.
        // Reach through the quotation as a fallback so Job Items always render.
        $rfqItems = $workOrder->rfq?->items ?? $workOrder->quotation?->rfq?->items ?? collect();

        $checklist = PcdReleaseService::checklistFor($workOrder);

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
}
