<?php

namespace App\Http\Controllers;

use App\Models\Ncr;
use App\Models\QcInspection;
use App\Models\ReworkOrder;
use App\Models\WorkOrderSection;
use App\Services\ReworkOrderService;
use Illuminate\Http\Request;
use Inertia\Inertia;

class NcrController extends Controller
{
    public function index(Request $request)
    {
        $query = Ncr::with(['workOrder', 'responsibleUser']);

        // Search
        if ($search = $request->input('search')) {
            $query->where(function ($q) use ($search) {
                $q->where('ncr_number', 'like', "%{$search}%")
                  ->orWhere('defect_type', 'like', "%{$search}%")
                  ->orWhereHas('workOrder', fn($w) => $w->where('wo_number', 'like', "%{$search}%"));
            });
        }

        // Filter by status
        if ($status = $request->input('status')) {
            $query->where('status', $status);
        }

        // Sorting
        $sort = $request->input('sort', 'id');
        $dir  = $request->input('dir', 'desc');
        $allowed = ['id', 'status', 'created_at'];
        if (in_array($sort, $allowed)) {
            $query->orderBy($sort, $dir === 'asc' ? 'asc' : 'desc');
        } else {
            $query->latest();
        }

        $ncrs = $query->paginate(15)->withQueryString()
            ->through(fn($n) => [
                'id'                 => $n->id,
                'ncr_number'         => $n->ncr_number,
                'work_order_id'      => $n->work_order_id,
                'wo_number'          => $n->workOrder->wo_number ?? '',
                'defect_description' => $n->defect_type,
                'severity'           => null,
                'disposition'        => null,
                'status'             => $n->status,
                'created_at'         => $n->created_at->format('d/m/Y H:i'),
            ]);

        return Inertia::render('NCR/Index', [
            'ncrs' => $ncrs,
            'filters' => [
                'search' => $request->input('search', ''),
                'status' => $request->input('status', ''),
                'sort'   => $sort,
                'dir'    => $dir,
            ],
        ]);
    }

    public function show(Ncr $ncr)
    {
        $ncr->load([
            'workOrder.sections.section',
            'responsibleUser',
            'reworkOrders.targetSection',
        ]);
        $user = auth()->user();

        // Sections that ARE on this WO's routing — these are the only valid
        // rework targets. Exclude non-production-shop sections from the list.
        $candidateSections = $ncr->workOrder?->sections
            ->filter(fn($s) => $s->section && $s->section->type === 'production_shop')
            ->sortBy('sequence')
            ->map(fn($s) => [
                'id'       => $s->section->id,
                'name'     => $s->section->name,
                'code'     => $s->section->code,
                'sequence' => $s->sequence,
                'status'   => $s->status,
            ])->values() ?? collect();

        $reworkOrders = $ncr->reworkOrders->map(fn($r) => [
            'id'             => $r->id,
            'rework_number'  => $r->rework_wo_number,
            'status'         => $r->status,
            'notes'          => $r->notes,
            'target_section' => $r->targetSection ? [
                'name' => $r->targetSection->name,
                'code' => $r->targetSection->code,
            ] : null,
            'created_at'     => $r->created_at?->format('d M Y, h:i A'),
        ])->values();

        return Inertia::render('NCR/Show', [
            'ncr' => [
                'id'                 => $ncr->id,
                'ncr_number'         => $ncr->ncr_number,
                'work_order_id'      => $ncr->work_order_id,
                'wo_number'          => $ncr->workOrder->wo_number ?? '',
                'job_number'         => $ncr->workOrder->job_number ?? null,
                'defect_description' => $ncr->defect_type,
                'severity'           => null,
                'disposition'        => null,
                'status'             => $ncr->status,
                'raised_by_name'     => $ncr->responsibleUser?->name ?? '',
                'root_cause'         => $ncr->root_cause,
                'corrective_action'  => $ncr->corrective_action,
                'created_at'         => $ncr->created_at->format('d M Y'),
                'rework_orders'      => $reworkOrders,
                // Back-compat: keep `rework_order` populated with the first one
                // so existing UI bits keep working until refactored.
                'rework_order'       => $reworkOrders->first(),
            ],
            'candidateSections' => $candidateSections,
            'canCreateRework'   => true, // gated by route middleware (view qc)
        ]);
    }

    /**
     * Raise an NCR directly from a failed QC inspection.
     * Inherits work order + defect info from the inspection so QC inspectors
     * just need to one-click the action.
     */
    public function store(Request $request)
    {
        $validated = $request->validate([
            'qc_inspection_id' => 'required|exists:qc_inspections,id',
        ]);

        $inspection = QcInspection::with('workOrder')->findOrFail($validated['qc_inspection_id']);

        // Prevent duplicate NCRs against the same inspection.
        $existing = Ncr::where('qc_inspection_id', $inspection->id)->first();
        if ($existing) {
            return redirect()->route('ncrs.show', $existing)->with('info', 'NCR already raised for this inspection.');
        }

        $ncrNo = 'NCR-' . str_pad((int) (Ncr::max('id') + 1), 5, '0', STR_PAD_LEFT);

        $ncr = Ncr::create([
            'qc_inspection_id' => $inspection->id,
            'work_order_id'    => $inspection->work_order_id,
            'ncr_number'       => $ncrNo,
            'defect_type'      => $inspection->notes ?: 'QC inspection failure',
            'status'           => 'open',
        ]);

        return redirect()->route('ncrs.show', $ncr)->with('success', "NCR {$ncrNo} raised.");
    }

    /**
     * Create a rework order against an NCR and actually push the work back
     * into the responsible section's production queue.
     *
     * Flow:
     *  1. Target the WOS row for the responsible section on the original WO.
     *  2. Flip that WOS to `rework` so it surfaces in the section's queue
     *     with a rework banner.
     *  3. Reset any later WOS rows back to `pending` so the routing will
     *     replay them once rework completes.
     *  4. Reset every operation step belonging to the target section back to
     *     `pending` (clearing actual_hours / started_at / completed_at) so
     *     operators can re-run them and the WO progress recalculates correctly.
     *  5. Move the original WO out of qc_hold so it's visible in production again.
     *  6. Log a backward SectionHandoff from QC → target section as audit trail.
     */
    /**
     * Multi-section rework: one defect can come from several sections, so we
     * accept an array of responsible sections and create one ReworkOrder per
     * section, all linked to the same NCR.
     *
     * For each chosen section we:
     *   - Flip the WOS to `rework`
     *   - Reset its operation steps to `pending`
     *   - Log a SectionHandoff (direction=backward) for the audit trail
     *
     * Then we reset every WOS that came AFTER the earliest chosen section so
     * the routing can replay through them once all reworks are done.
     * Finally the WO leaves `qc_hold` and re-enters `released_to_shops`.
     */
    public function createRework(Request $request, Ncr $ncr, ReworkOrderService $reworkService)
    {
        $validated = $request->validate([
            'target_section_ids'   => 'required|array|min:1',
            'target_section_ids.*' => 'integer|exists:sections,id',
            // Per-section notes — keyed by section_id ("notes.5": "...", "notes.7": "...").
            'notes'                => 'nullable|array',
            'notes.*'              => 'nullable|string|max:1000',
        ]);

        $notesBySection = $validated['notes'] ?? [];

        try {
            $result = $reworkService->createForNcr(
                $ncr,
                $validated['target_section_ids'],
                $notesBySection,
                auth()->id(),
            );
        } catch (\RuntimeException $e) {
            return back()->with('error', $e->getMessage());
        }

        $sectionNames = $result['target_sections']->pluck('section.name')->join(', ');
        $count        = count($result['rework_orders']);
        $msg = $count === 1
            ? "Rework Order {$result['rework_orders'][0]} created. Job returned to {$sectionNames} for rework."
            : "{$count} rework orders created. Job returned to {$sectionNames} for rework.";

        return redirect()->route('ncrs.show', $ncr)->with('success', $msg);
    }
}
