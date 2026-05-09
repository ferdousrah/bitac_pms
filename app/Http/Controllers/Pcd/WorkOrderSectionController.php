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
        $workOrder->load(['customer', 'sections.section']);

        return Inertia::render('Pcd/SectionAssign', [
            'work_order' => [
                'id'         => $workOrder->id,
                'wo_number'  => $workOrder->wo_number,
                'job_number' => $workOrder->job_number,
                'customer'   => $workOrder->customer?->name,
                'status'     => $workOrder->status,
            ],
            'assigned_sections' => $workOrder->sections->map(fn($s) => [
                'id'         => $s->id,
                'section_id' => $s->section_id,
                'section'    => ['id' => $s->section->id, 'name' => $s->section->name, 'code' => $s->section->code, 'name_bn' => $s->section->name_bn],
                'sequence'   => $s->sequence,
                'status'     => $s->status,
                'notes'      => $s->notes,
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
                ]);
            }
        });

        // Try to release if other PCD steps are also done
        PcdReleaseService::tryRelease($workOrder->fresh());

        return redirect()->route('pcd.inbox.show', $workOrder)
            ->with('success', 'Section assignment saved.');
    }
}
