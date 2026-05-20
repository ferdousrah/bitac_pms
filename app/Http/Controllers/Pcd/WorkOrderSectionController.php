<?php

namespace App\Http\Controllers\Pcd;

use App\Http\Controllers\Controller;
use App\Models\Section;
use App\Models\WorkOrder;
use App\Services\PcdReleaseService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;

class WorkOrderSectionController extends Controller
{
    public function edit(WorkOrder $workOrder)
    {
        // Load the full audit chain so we can render BITAC's official Work Order
        // form layout (job items + customer + delivery date + section routing).
        $workOrder->load([
            'customer',
            'sections.section',
            'rfq.items.product',
            'quotation.rfq.items.product',
            'createdBy',
        ]);

        // Job items come from the RFQ; fall back through the quotation for
        // legacy work orders that don't have a direct rfq_id.
        $rfq = $workOrder->rfq ?? $workOrder->quotation?->rfq;
        $jobItems = ($rfq?->items ?? collect())->values()->map(fn($i, $idx) => [
            'sequence'    => $idx + 1,
            'description' => $i->job_description ?? $i->product?->name ?? '—',
            'quantity'    => (float) $i->quantity,
            'unit'        => $i->unit ?? 'pcs',
        ])->values();

        return Inertia::render('Pcd/SectionAssign', [
            'work_order' => [
                'id'             => $workOrder->id,
                'wo_number'      => $workOrder->wo_number,
                'job_number'     => $workOrder->job_number,
                'customer'       => $workOrder->customer?->name,
                'customer_po_no' => $workOrder->customer_po_no,
                'status'         => $workOrder->status,
                'created_at'     => $workOrder->created_at->format('d/m/Y'),
                'due_date'       => $workOrder->due_date?->format('d/m/Y'),
                'prepared_by'    => $workOrder->createdBy?->name ?? auth()->user()?->name ?? '—',
            ],
            'job_items' => $jobItems,
            'assigned_sections' => $workOrder->sections->map(fn($s) => [
                'id'         => $s->id,
                'section_id' => $s->section_id,
                'section'    => ['id' => $s->section->id, 'name' => $s->section->name, 'code' => $s->section->code, 'name_bn' => $s->section->name_bn],
                'sequence'   => $s->sequence,
                'status'     => $s->status,
                'notes'      => $s->notes,
                'qc_notes'   => $s->qc_notes,
            ]),
            'available_sections' => Section::active()->shops()->orderBy('display_order')
                ->get(['id', 'name', 'code', 'name_bn']),
        ]);
    }

    public function update(Request $request, WorkOrder $workOrder)
    {
        $validated = $request->validate([
            'sections'              => 'required|array|min:1',
            'sections.*.section_id' => 'required|exists:sections,id',
            'sections.*.notes'      => 'nullable|string|max:255',
            'sections.*.qc_notes'   => 'nullable|string|max:500',
        ]);

        DB::transaction(function () use ($workOrder, $validated) {
            // Wipe and recreate to preserve sequence
            $workOrder->sections()->delete();
            foreach ($validated['sections'] as $idx => $row) {
                $workOrder->sections()->create([
                    'section_id' => $row['section_id'],
                    'sequence'   => $idx + 1,
                    'status'     => 'pending',
                    'notes'      => $row['notes'] ?? null,
                    'qc_notes'   => $row['qc_notes'] ?? null,
                ]);
            }

            // If the WO was already released to shops, re-activate the first
            // section so it appears in the production queue (the wipe-and-recreate
            // above would otherwise leave every section in `pending`).
            if ($workOrder->released_to_shops_at) {
                $first = $workOrder->sections()->orderBy('sequence')->first();
                $first?->update(['status' => 'ready']);
            }
        });

        // Try to release if other PCD steps are also done
        PcdReleaseService::tryRelease($workOrder->fresh());

        return redirect()->route('pcd.inbox.show', $workOrder)
            ->with('success', 'Section assignment saved.');
    }
}
