<?php

namespace App\Http\Controllers;

use App\Models\OperationStep;
use App\Models\ProductionLog;
use App\Models\Section;
use App\Models\SectionHandoff;
use App\Models\WorkOrder;
use App\Models\WorkOrderSection;
use App\Services\ProductionRoutingService;
use Illuminate\Http\Request;
use Inertia\Inertia;

class ProductionController extends Controller
{
    public function __construct(private ProductionRoutingService $routing) {}

    /**
     * The section supervisor's queue — every WO currently parked at their
     * section (active, awaiting handoff, or flagged for rework).
     *
     * Super-admin (no section_id) can switch sections via ?section= query.
     */
    public function queue(Request $request)
    {
        $user = auth()->user();

        // Resolve which section to show: query override > user's section
        $sectionId = (int) ($request->input('section') ?? $user->section_id ?? 0);
        $section   = $sectionId ? Section::find($sectionId) : null;

        // Only top-level shops have a queue — sub-sections are internal to a shop.
        $availableSections = Section::active()->shops()->topLevel()->orderBy('display_order')->get(['id', 'name', 'code', 'name_bn']);

        // Non-admins can only see their own section
        $canSwitch = $user->hasAnyRole(['super_admin', 'admin']) || $user->can('manage users');
        if (!$canSwitch && $user->section_id) {
            $sectionId = (int) $user->section_id;
            $section   = Section::find($sectionId);
        }

        $jobs = $section
            ? WorkOrderSection::activeForSection($section->id)
                ->with([
                    'workOrder.customer',
                    'workOrder.product',
                    'workOrder.rfq:id,job_type',
                    'workOrder.items',
                    'workOrder.operationSheets.steps',
                    'section',
                ])
                ->get()
                // Expand item-wise: every item with work at this section becomes
                // its own row. A WO with 2 items at Machine Shop → 2 rows in the queue.
                ->flatMap(fn($wos) => $this->expandWosForQueue($wos))
                ->values()
            : collect();

        // ── Upcoming jobs — routed to this section but not yet arrived ──────
        // Jobs whose WOS here is still 'pending' while an EARLIER section is
        // already working them. They're in the pipeline heading this way; the
        // supervisor can plan machines/material ahead. (Nothing has been
        // transferred here yet — otherwise this WOS would be 'ready'/active.)
        $upcoming = $section
            ? WorkOrderSection::where('section_id', $section->id)
                ->where('status', 'pending')
                ->whereHas('workOrder', fn ($q) => $q->whereNotIn('status', ['draft', 'cancelled', 'delivered']))
                ->with(['workOrder.customer', 'workOrder.product', 'workOrder.sections.section', 'workOrder.operationSheets.steps'])
                ->get()
                ->map(function ($wos) {
                    $wo = $wos->workOrder;
                    // Where the job is right now — the active section before this one.
                    $current = $wo->sections
                        ->whereIn('status', ['in_progress', 'rework', 'ready'])
                        ->where('sequence', '<', $wos->sequence)
                        ->sortByDesc('sequence')
                        ->first();
                    if (!$current) return null; // not actually in the pipeline yet
                    return [
                        'wos_id'      => $wos->id,
                        'wo_id'       => $wo->id,
                        'job_number'  => $wo->job_number,
                        'wo_number'   => $wo->wo_number,
                        'customer'    => $wo->customer?->name,
                        'product'     => $wo->product?->name,
                        'quantity'    => (float) $wo->quantity,
                        'due_date'    => $wo->due_date?->format('d M Y'),
                        'is_overdue'  => $wo->is_overdue,
                        'sequence'    => $wos->sequence,
                        'progress'    => $wo->production_progress,
                        'current'     => [
                            'name'     => $current->section?->name,
                            'code'     => $current->section?->code,
                            'status'   => $current->status,
                            'sequence' => $current->sequence,
                        ],
                        'stops_away'  => (int) $wos->sequence - (int) $current->sequence,
                    ];
                })
                ->filter()
                ->sortBy('stops_away')
                ->values()
            : collect();

        return Inertia::render('Production/Queue', [
            'section' => $section ? [
                'id'      => $section->id,
                'name'    => $section->name,
                'code'    => $section->code,
                'name_bn' => $section->name_bn,
            ] : null,
            'jobs'              => $jobs,
            'upcoming'          => $upcoming,
            'available_sections'=> $availableSections,
            'can_switch'        => $canSwitch,
        ]);
    }

    public function complete(Request $request, WorkOrderSection $workOrderSection)
    {
        $this->authorizeAccess($workOrderSection);

        if (!in_array($workOrderSection->status, ['ready', 'in_progress', 'rework'])) {
            return back()->with('error', 'This section is not in a completable state.');
        }

        // Block manual section-level handoff if ANY operation step at this
        // section is still open across all items' sheets. (Sections also auto-
        // complete via syncWoSectionStatuses when the last item moves on, so
        // this manual gate is mainly for supervisors recording explicit notes.)
        $sheetIds   = $workOrderSection->workOrder->operationSheets()->pluck('id');
        $unfinished = \App\Models\OperationStep::whereIn('operation_sheet_id', $sheetIds)
            ->where('section_id', $workOrderSection->section_id)
            ->whereNotIn('status', ['completed', 'skipped'])
            ->count();
        if ($unfinished > 0) {
            return back()->with('error', "Cannot forward: {$unfinished} operation step(s) in this section are still open. Mark each step complete first.");
        }

        $validated = $request->validate([
            'note'           => 'nullable|string|max:1000',
            'attachments'    => 'nullable|array|max:10',
            'attachments.*'  => 'file|max:20480|mimes:pdf,jpg,jpeg,png,doc,docx,xls,xlsx',
        ]);

        $this->routing->complete(
            $workOrderSection,
            $validated['note'] ?? null,
            $request->file('attachments', []),
            auth()->id(),
        );

        return back()->with('success', 'Section completed. Job handed off.');
    }

    public function sendBack(Request $request, WorkOrderSection $workOrderSection)
    {
        $this->authorizeAccess($workOrderSection);

        if (!in_array($workOrderSection->status, ['ready', 'in_progress'])) {
            return back()->with('error', 'You can only send back from an active section.');
        }

        $validated = $request->validate([
            'target_wos_id'  => 'required|exists:work_order_sections,id',
            'reason'         => 'required|string|min:5|max:1000',
            'attachments'    => 'nullable|array|max:10',
            'attachments.*'  => 'file|max:20480|mimes:pdf,jpg,jpeg,png,doc,docx,xls,xlsx',
        ]);

        $target = WorkOrderSection::findOrFail($validated['target_wos_id']);
        if ($target->work_order_id !== $workOrderSection->work_order_id) {
            return back()->with('error', 'Target section must belong to the same work order.');
        }
        if ($target->sequence >= $workOrderSection->sequence) {
            return back()->with('error', 'Target section must be earlier in the routing.');
        }

        $this->routing->sendBack(
            $workOrderSection,
            $target,
            $validated['reason'],
            $request->file('attachments', []),
            auth()->id(),
        );

        return back()->with('success', 'Sent back to ' . $target->section->name . ' for rework.');
    }

    /**
     * Per-operation-step action: start | complete | reopen.
     *
     * Operators close their steps one by one. The WO progress bar on the
     * Work Order detail page is derived from these step statuses + weight_pct,
     * so each click immediately ticks the progress forward.
     */
    public function markStep(Request $request, OperationStep $step)
    {
        $sheet = $step->operationSheet;
        $wo    = $sheet->workOrder;

        // The matching WOS for this step's section — used both for the access
        // check and to flip the WOS into 'in_progress' on first start.
        $wos = WorkOrderSection::where('work_order_id', $wo->id)
            ->where('section_id', $step->section_id)
            ->first();
        if (!$wos) {
            return back()->with('error', 'No section assignment matches this operation step.');
        }
        $this->authorizeAccess($wos);

        $validated = $request->validate([
            'action'       => 'required|in:start,complete,reopen',
            'actual_hours' => 'nullable|numeric|min:0',
        ]);

        $now = now();

        switch ($validated['action']) {
            case 'start':
                if ($step->status === 'completed') {
                    return back()->with('error', 'This step is already completed.');
                }
                $step->update([
                    'status'     => 'in_progress',
                    'started_at' => $step->started_at ?? $now,
                ]);
                // First step started in this section moves WOS to in_progress.
                if (in_array($wos->status, ['ready'])) {
                    $wos->update(['status' => 'in_progress', 'started_at' => $wos->started_at ?? $now]);
                }
                break;

            case 'complete':
                $startedAt = $step->started_at ?? $now;
                // Auto-calculate actual hours from started_at → now if the
                // operator didn't supply a manual override.
                $actual = $validated['actual_hours']
                    ?? round($startedAt->diffInSeconds($now) / 3600, 2);
                $step->update([
                    'status'       => 'completed',
                    'started_at'   => $startedAt,
                    'completed_at' => $now,
                    'actual_hours' => $actual,
                ]);
                if (in_array($wos->status, ['ready'])) {
                    $wos->update(['status' => 'in_progress', 'started_at' => $wos->started_at ?? $now]);
                }
                break;

            case 'reopen':
                if ($wos->status === 'completed') {
                    return back()->with('error', 'Section already forwarded — cannot reopen a step.');
                }
                $step->update([
                    'status'       => 'in_progress',
                    'completed_at' => null,
                ]);
                break;
        }

        // Items flow through routing independently — re-derive every WOS status
        // based on which items still have open work at that section. So when
        // Item 1 finishes Machine Shop, its Fitting WOS flips to 'ready' even
        // though Item 2 is still at Machine Shop.
        $this->syncWoSectionStatuses($wo->fresh(['sections.section', 'items', 'operationSheets.steps']));

        return back()->with('success', 'Operation step updated.');
    }

    /**
     * Shop in-charge assigns (or clears) the sub-section for an operation step
     * once the job has arrived at the shop. PCD only routes to the top-level
     * shop; the in-charge decides which sub-shop actually does the work.
     */
    public function assignSubSection(Request $request, OperationStep $step)
    {
        $wo  = $step->operationSheet->workOrder;
        $wos = WorkOrderSection::where('work_order_id', $wo->id)
            ->where('section_id', $step->section_id)
            ->first();
        if (!$wos) {
            return back()->with('error', 'No section assignment matches this operation step.');
        }
        $this->authorizeAccess($wos);

        $validated = $request->validate([
            'sub_section_id' => 'nullable|exists:sections,id',
        ]);

        // A sub-section must be a child of THIS step's shop.
        if (!empty($validated['sub_section_id'])) {
            $valid = Section::where('id', $validated['sub_section_id'])
                ->where('parent_id', $step->section_id)
                ->exists();
            if (!$valid) {
                return back()->with('error', 'That sub-section does not belong to this shop.');
            }
        }

        $step->update(['sub_section_id' => $validated['sub_section_id'] ?: null]);

        return back()->with('success', 'Sub-section updated.');
    }

    /**
     * Record a daily, item-wise production entry for a step (partial quantity).
     * Bumps the step's completed_qty, derives its status (in_progress / completed
     * when the target is met), and re-syncs the section so finished pieces can
     * flow forward.
     */
    public function logProduction(Request $request, OperationStep $step)
    {
        $sheet = $step->operationSheet;
        $wo    = $sheet->workOrder;

        $wos = WorkOrderSection::where('work_order_id', $wo->id)
            ->where('section_id', $step->section_id)
            ->first();
        if (!$wos) {
            return back()->with('error', 'No section assignment matches this operation step.');
        }
        $this->authorizeAccess($wos);
        if (in_array($wos->status, ['completed', 'skipped'])) {
            return back()->with('error', 'This section is already completed — cannot log production.');
        }

        // Cap by what this section can still do: target remaining AND the
        // quantity received from upstream (downstream sections can only work
        // on pieces that have actually been transferred to them).
        $remaining = (float) $step->remaining_qty;
        $eff = $wos->effectiveReceivedQty(); // null = ungated (first section / raw material)
        if ($eff !== null) {
            $capByReceived = max(0.0, $eff - (float) $step->completed_qty);
            if ($capByReceived <= 0) {
                return back()->with('error', 'This section has not received enough quantity yet. Ask the previous section to transfer more.');
            }
            $remaining = min($remaining, $capByReceived);
        }

        $validated = $request->validate([
            'qty'         => ['required', 'numeric', 'min:0.01', $remaining > 0 ? 'max:' . $remaining : 'max:9999999'],
            'machine_id'  => 'nullable|exists:machines,id',
            'operator_id' => 'nullable|exists:operators,id',
            'log_date'    => 'nullable|date',
            'hours'       => 'nullable|numeric|min:0',
            'remarks'     => 'nullable|string|max:1000',
        ]);

        $now = now();
        \DB::transaction(function () use ($step, $sheet, $wo, $wos, $validated, $now) {
            ProductionLog::create([
                'operation_step_id'  => $step->id,
                'work_order_id'      => $wo->id,
                'work_order_item_id' => $sheet->work_order_item_id,
                'section_id'         => $step->section_id,
                'sub_section_id'     => $step->sub_section_id,
                'machine_id'         => $validated['machine_id'] ?? $step->machine_id,
                'operator_id'        => $validated['operator_id'] ?? $step->operator_id,
                'log_date'           => $validated['log_date'] ?? $now->toDateString(),
                'qty'                => (float) $validated['qty'],
                'hours'              => $validated['hours'] ?? null,
                'remarks'            => $validated['remarks'] ?? null,
                'logged_by'          => auth()->id(),
            ]);

            $completed = (float) $step->completed_qty + (float) $validated['qty'];
            $target    = (float) ($step->target_qty ?? 0);
            $done      = $target > 0 && $completed >= $target - 0.001;

            $step->update([
                'completed_qty' => $completed,
                'status'        => $done ? 'completed' : 'in_progress',
                'started_at'    => $step->started_at ?? $now,
                'completed_at'  => $done ? ($step->completed_at ?? $now) : null,
                'actual_hours'  => $step->productionLogs()->sum('hours') ?: $step->actual_hours,
            ]);

            if ($wos->status === 'ready') {
                $wos->update(['status' => 'in_progress', 'started_at' => $wos->started_at ?? $now]);
            }
        });

        // NO auto-forward. Logging output only records completion at THIS
        // section — the job advances to the next section only when the
        // supervisor explicitly transfers a quantity (see transfer()).

        $this->syncMachineStates($wo->fresh('operationSheets'));

        return back()->with('success', 'Production logged.');
    }

    /** Delete a production log entry and roll back the step's completed_qty. */
    public function deleteProductionLog(ProductionLog $productionLog)
    {
        $step = $productionLog->step;
        $wo   = $step->operationSheet->workOrder;
        $wos  = WorkOrderSection::where('work_order_id', $wo->id)
            ->where('section_id', $step->section_id)
            ->first();
        if ($wos) $this->authorizeAccess($wos);

        \DB::transaction(function () use ($productionLog, $step) {
            $qty = (float) $productionLog->qty;
            $productionLog->delete();
            $completed = max(0, (float) $step->completed_qty - $qty);
            $target    = (float) ($step->target_qty ?? 0);
            $done      = $target > 0 && $completed >= $target - 0.001;
            $step->update([
                'completed_qty' => $completed,
                'status'        => $completed <= 0 ? ($step->started_at ? 'in_progress' : 'pending') : ($done ? 'completed' : 'in_progress'),
                'completed_at'  => $done ? $step->completed_at : null,
                'actual_hours'  => $step->productionLogs()->sum('hours') ?: null,
            ]);
        });

        $this->syncMachineStates($wo->fresh('operationSheets'));

        return back()->with('success', 'Production log removed.');
    }

    /**
     * Explicit partial forward: transfer a quantity of finished pieces from this
     * section to the next production section in the routing. This is the ONLY way
     * a job advances now — production logging never auto-forwards. The next
     * section can only work on what it has received (received_qty).
     */
    public function transfer(Request $request, WorkOrderSection $workOrderSection)
    {
        $this->authorizeAccess($workOrderSection);

        if (!in_array($workOrderSection->status, ['ready', 'in_progress', 'rework'])) {
            return back()->with('error', 'This section is not in a state that can transfer work.');
        }

        $workOrderSection->loadMissing(['workOrder.operationSheets.steps', 'section']);
        $forwardable = $workOrderSection->forwardableQty();
        if ($forwardable <= 0) {
            return back()->with('error', 'Nothing to transfer yet — complete some pieces at this section first.');
        }

        $validated = $request->validate([
            'qty'  => ['required', 'numeric', 'min:0.01', 'max:' . $forwardable],
            'note' => 'nullable|string|max:1000',
        ]);
        $qty = (float) $validated['qty'];
        $wo  = $workOrderSection->workOrder;
        $now = now();

        \DB::transaction(function () use ($workOrderSection, $wo, $qty, $validated, $now) {
            // Next production section (skip any non-production stops left by legacy routing).
            $next = WorkOrderSection::where('work_order_id', $wo->id)
                ->where('sequence', '>', $workOrderSection->sequence)
                ->orderBy('sequence')->first();
            while ($next) {
                $next->loadMissing('section');
                if ($next->section && $next->section->type === 'production_shop') break;
                $next->update(['status' => 'skipped', 'completed_at' => now()]);
                $next = WorkOrderSection::where('work_order_id', $wo->id)
                    ->where('sequence', '>', $next->sequence)
                    ->orderBy('sequence')->first();
            }

            // Ledger: this section forwarded more; downstream received more.
            $newForwarded = (float) $workOrderSection->forwarded_qty + $qty;
            $target = $workOrderSection->sectionTargetQty();
            $fullyForwarded = $target > 0 && $newForwarded >= $target - 0.001;

            $workOrderSection->update([
                'forwarded_qty' => $newForwarded,
                'status'        => $fullyForwarded ? 'completed' : 'in_progress',
                'started_at'    => $workOrderSection->started_at ?? $now,
                'completed_at'  => $fullyForwarded ? ($workOrderSection->completed_at ?? $now) : null,
                'completed_by'  => $fullyForwarded ? auth()->id() : $workOrderSection->completed_by,
            ]);

            if ($next) {
                $next->update([
                    'received_qty' => (float) ($next->received_qty ?? 0) + $qty,
                    'status'       => in_array($next->status, ['pending']) ? 'ready' : $next->status,
                    'started_at'   => $next->started_at,
                ]);
            } elseif ($fullyForwarded) {
                // Last production section fully forwarded → hand off to QC.
                $wo->update(['status' => 'qc_hold']);
            }

            SectionHandoff::create([
                'work_order_id'   => $wo->id,
                'from_section_id' => $workOrderSection->section_id,
                'to_section_id'   => $next?->section_id ?? $workOrderSection->section_id,
                'direction'       => 'forward',
                'qty'             => $qty,
                'note'            => $validated['note'] ?? null,
                'transferred_by'  => auth()->id(),
                'transferred_at'  => $now,
            ]);
        });

        $this->syncMachineStates($workOrderSection->workOrder);

        return back()->with('success', "Transferred {$qty} pcs to the next section.");
    }

    /**
     * Shop-floor "bottleneck" flag: the section's machines / manpower are tied
     * up, so the job is waiting. Flags it for PCD to reroute (do a free
     * section's work first) instead of the job sitting idle.
     */
    public function flagBottleneck(Request $request, WorkOrderSection $workOrderSection)
    {
        $this->authorizeAccess($workOrderSection);
        $validated = $request->validate(['reason' => 'required|string|min:3|max:500']);
        $workOrderSection->update([
            'bottleneck_at'     => now(),
            'bottleneck_reason' => $validated['reason'],
            'bottleneck_by'     => auth()->id(),
        ]);
        return back()->with('success', 'Flagged for PCD — they can reroute this job.');
    }

    /** Clear the bottleneck flag (resource freed up, or PCD handled it). */
    public function clearBottleneck(WorkOrderSection $workOrderSection)
    {
        $this->authorizeAccess($workOrderSection);
        $workOrderSection->update(['bottleneck_at' => null, 'bottleneck_reason' => null, 'bottleneck_by' => null]);
        return back()->with('success', 'Bottleneck flag cleared.');
    }

    /**
     * The full production cycle of a work order — every routing section with its
     * weight, qty ledger (received / produced / forwarded), operations, daily
     * logs and handoffs, plus machine usage. A holistic, read-only timeline for
     * PCD / management (the per-section Show page is the shop-floor action view).
     */
    public function cycle(WorkOrder $workOrder)
    {
        $workOrder->load([
            'customer', 'product', 'rfq:id,job_type',
            'sections.section',
            'items',
            'operationSheets.workOrderItem',
            'operationSheets.steps' => fn ($q) => $q->orderBy('sequence'),
            'operationSheets.steps.machine',
            'operationSheets.steps.operator',
            'operationSheets.steps.subSection',
            'operationSheets.steps.productionLogs.machine',
            'operationSheets.steps.productionLogs.operator',
        ]);

        // Item sequence lookup for labelling steps.
        $itemSeq = [];
        foreach ($workOrder->items->values() as $i => $it) $itemSeq[$it->id] = $i + 1;

        $nf = fn ($n) => (float) $n;

        $sections = $workOrder->sections->sortBy('sequence')->map(function ($wos) use ($workOrder, $itemSeq, $nf) {
            $secId = $wos->section_id;

            $steps = collect();
            foreach ($workOrder->operationSheets as $sh) {
                $label = $sh->work_order_item_id
                    ? ('Item ' . ($itemSeq[$sh->work_order_item_id] ?? '?'))
                    : 'Shared';
                foreach ($sh->steps->where('section_id', $secId)->sortBy('sequence') as $s) {
                    $steps->push([
                        'id'             => $s->id,
                        'item_label'     => $label,
                        'operation_name' => $s->operation_name,
                        'sub_section'    => $s->subSection?->name,
                        'machine'        => $s->machine?->name,
                        'operator'       => $s->operator?->name,
                        'target_qty'     => $nf($s->target_qty ?? 0),
                        'completed_qty'  => $nf($s->completed_qty ?? 0),
                        'remaining_qty'  => $nf($s->remaining_qty),
                        'status'         => $s->status,
                        'logs'           => $s->productionLogs->sortByDesc('log_date')->map(fn ($l) => [
                            'id'       => $l->id,
                            'log_date' => $l->log_date?->format('d M Y'),
                            'qty'      => $nf($l->qty),
                            'machine'  => $l->machine?->name,
                            'operator' => $l->operator?->name,
                            'remarks'  => $l->remarks,
                        ])->values(),
                    ]);
                }
            }

            // Forward handoffs OUT of this section.
            $handoffs = SectionHandoff::with('toSection')
                ->where('work_order_id', $workOrder->id)
                ->where('from_section_id', $secId)
                ->where('direction', 'forward')
                ->orderBy('transferred_at')
                ->get()
                ->map(fn ($h) => [
                    'qty'  => $h->qty !== null ? $nf($h->qty) : null,
                    'to'   => $h->toSection?->name,
                    'when' => $h->transferred_at?->format('d M Y, h:i A'),
                ]);

            return [
                'id'            => $wos->id,
                'sequence'      => $wos->sequence,
                'section'       => ['name' => $wos->section?->name, 'code' => $wos->section?->code],
                'weight_pct'    => $nf($wos->weight_pct),
                'status'        => $wos->status,
                'progress'      => (int) round($wos->progressFraction() * 100),
                'received_qty'  => $wos->effectiveReceivedQty(),
                'output_qty'    => $wos->sectionOutputQty(),
                'forwarded_qty' => $nf($wos->forwarded_qty),
                'target_qty'    => $wos->sectionTargetQty(),
                'started_at'    => $wos->started_at?->format('d M Y, h:i A'),
                'completed_at'  => $wos->completed_at?->format('d M Y, h:i A'),
                'steps'         => $steps->values(),
                'handoffs'      => $handoffs->values(),
            ];
        })->values();

        // Machine usage across the whole job (from the daily logs).
        $machineUsage = ProductionLog::with('machine')
            ->where('work_order_id', $workOrder->id)
            ->get()
            ->groupBy('machine_id')
            ->map(fn ($logs) => [
                'machine' => $logs->first()->machine?->name ?? '— (unspecified) —',
                'qty'     => (float) $logs->sum('qty'),
                'hours'   => (float) $logs->sum('hours'),
                'entries' => $logs->count(),
            ])
            ->sortByDesc('qty')
            ->values();

        return Inertia::render('Production/Cycle', [
            'work_order' => [
                'id'         => $workOrder->id,
                'wo_number'  => $workOrder->wo_number,
                'job_number' => $workOrder->job_number,
                'customer'   => $workOrder->customer?->name,
                'product'    => $workOrder->product?->name,
                'quantity'   => (float) $workOrder->quantity,
                'job_type'   => $workOrder->rfq?->job_type ?? 'regular',
                'status'     => $workOrder->status,
                'status_label' => $workOrder->status_label,
                'due_date'   => $workOrder->due_date?->format('d M Y'),
                'progress'   => $workOrder->production_progress,
            ],
            'sections'      => $sections,
            'machine_usage' => $machineUsage,
        ]);
    }

    /**
     * Reconcile the operational state of machines touched by a WO's steps.
     * A machine is 'running' while it has any in-progress operation step, else
     * 'idle'. Manual states (maintenance / breakdown / offline / setup) are
     * left untouched — the shop sets those deliberately.
     */
    private function syncMachineStates(\App\Models\WorkOrder $wo): void
    {
        $machineIds = \App\Models\OperationStep::whereIn(
                'operation_sheet_id',
                $wo->operationSheets()->pluck('id')
            )->whereNotNull('machine_id')->distinct()->pluck('machine_id');

        foreach ($machineIds as $mid) {
            $m = \App\Models\Machine::find($mid);
            if (!$m || in_array($m->current_state, ['maintenance', 'breakdown', 'offline', 'setup'], true)) continue;
            $running = \App\Models\OperationStep::where('machine_id', $mid)->where('status', 'in_progress')->exists();
            $target  = $running ? 'running' : 'idle';
            if ($m->current_state !== $target) $m->changeState($target);
        }
    }

    /**
     * Auto-derive WorkOrderSection statuses from the per-item operation step
     * states. Each item travels through routing independently:
     *   - As soon as an item's pending step lands at a section, that section's
     *     WOS becomes 'ready' (if it was 'pending').
     *   - When at least one item has an in_progress step at the section, the
     *     WOS becomes 'in_progress'.
     *   - When no items have open work at the section, the WOS becomes
     *     'completed' (auto-handoff to whatever section the items moved to).
     *
     * Rework/awaiting_rework states are left alone — those follow a separate
     * supervisor-driven flow (SendBack action) and shouldn't be auto-cleared.
     */
    private function syncWoSectionStatuses(\App\Models\WorkOrder $wo): void
    {
        foreach ($wo->sections as $wos) {
            // Don't touch rework states — supervisor controls those explicitly.
            if (in_array($wos->status, ['rework', 'awaiting_rework'])) continue;

            $sectionId = $wos->section_id;
            $openCount = 0;
            $inProgressCount = 0;

            // Per-item routing: count items whose CURRENT pending step lives at
            // this section. An item's "current" step is its lowest-sequence
            // step that isn't completed/skipped — that's where the item lives
            // right now in the routing.
            foreach ($wo->items as $item) {
                $sheet = $wo->operationSheets->firstWhere('work_order_item_id', $item->id);
                if (!$sheet) continue;
                $current = $sheet->steps
                    ->sortBy('sequence')
                    ->first(fn ($s) => !in_array($s->status, ['completed', 'skipped']));
                if (!$current || $current->section_id !== $sectionId) continue;
                $openCount++;
                if ($current->status === 'in_progress') $inProgressCount++;
            }
            // Legacy WO-wide sheets count too — current step at this section.
            foreach ($wo->operationSheets->whereNull('work_order_item_id') as $sheet) {
                $current = $sheet->steps
                    ->sortBy('sequence')
                    ->first(fn ($s) => !in_array($s->status, ['completed', 'skipped']));
                if (!$current || $current->section_id !== $sectionId) continue;
                $openCount++;
                if ($current->status === 'in_progress') $inProgressCount++;
            }

            // Decide the target status from the open counts.
            $target = $wos->status;
            if ($openCount === 0) {
                if (in_array($wos->status, ['ready', 'in_progress'])) {
                    $target = 'completed';
                }
            } else {
                if ($wos->status === 'pending') {
                    $target = 'ready';
                } elseif ($wos->status === 'ready' && $inProgressCount > 0) {
                    $target = 'in_progress';
                } elseif ($wos->status === 'completed') {
                    // A reopened step pulled this section back into play.
                    $target = $inProgressCount > 0 ? 'in_progress' : 'ready';
                }
            }

            if ($target !== $wos->status) {
                $update = ['status' => $target];
                if ($target === 'in_progress' && !$wos->started_at) {
                    $update['started_at'] = now();
                }
                if ($target === 'completed') {
                    $update['completed_at'] = $wos->completed_at ?? now();
                }
                if (in_array($target, ['ready', 'in_progress']) && $wos->completed_at) {
                    $update['completed_at'] = null;
                }
                $wos->update($update);
            }
        }
    }

    /** Drawer/details view for a single WOS — sibling routing + handoff history. */
    public function show(Request $request, WorkOrderSection $workOrderSection)
    {
        $this->authorizeAccess($workOrderSection);

        // Optional ?item_id=X scopes the page to one WO item — used when the
        // operator clicked the item-row in the queue. Without it, the page
        // shows every item's work at this section.
        $scopedItemId = $request->integer('item_id') ?: null;

        $workOrderSection->load([
            'workOrder.customer',
            'workOrder.product',
            'workOrder.rfq:id,job_type',
            'workOrder.sections.section',
            'workOrder.items',
            'workOrder.operationSheets.workOrderItem',
            'workOrder.operationSheets.steps' => fn($q) => $q->orderBy('sequence'),
            'workOrder.operationSheets.steps.machine',
            'workOrder.operationSheets.steps.operator',
            'workOrder.operationSheets.steps.section',
            'workOrder.operationSheets.steps.subSection',
            'workOrder.operationSheets.steps.productionLogs.machine',
            'workOrder.operationSheets.steps.productionLogs.operator',
            'workOrder.operationSheets.steps.productionLogs.loggedBy',
            'section.children',
        ]);

        $handoffs = SectionHandoff::with(['fromSection', 'toSection', 'transferredBy', 'files'])
            ->where('work_order_id', $workOrderSection->work_order_id)
            ->orderBy('transferred_at', 'desc')
            ->get()
            ->map(fn($h) => [
                'id'              => $h->id,
                'direction'       => $h->direction,
                'qty'             => $h->qty !== null ? (float) $h->qty : null,
                'note'            => $h->note,
                'from_section'    => $h->fromSection ? ['name' => $h->fromSection->name, 'code' => $h->fromSection->code] : null,
                'to_section'      => ['name' => $h->toSection->name, 'code' => $h->toSection->code],
                'transferred_by'  => $h->transferredBy?->name,
                'transferred_at'  => $h->transferred_at?->format('d M Y, h:i A'),
                'files'           => $h->files->map(fn($f) => [
                    'id'         => $f->id,
                    'url'        => $f->url,
                    'filename'   => $f->original_name,
                    'extension'  => $f->extension,
                    'human_size' => $f->human_size,
                ])->values(),
            ])->values();

        // The active rework banner (if this WOS is in 'rework' state).
        $reworkContext = null;
        if ($workOrderSection->status === 'rework') {
            $back = SectionHandoff::with(['fromSection', 'files', 'transferredBy'])
                ->where('work_order_id', $workOrderSection->work_order_id)
                ->where('direction', 'backward')
                ->where('to_section_id', $workOrderSection->section_id)
                ->latest('id')
                ->first();
            $reworkContext = $back ? [
                'from_section'   => $back->fromSection?->name,
                'transferred_by' => $back->transferredBy?->name,
                'transferred_at' => $back->transferred_at?->format('d M Y, h:i A'),
                'note'           => $back->note,
                'files'          => $back->files->map(fn($f) => [
                    'id'         => $f->id,
                    'url'        => $f->url,
                    'filename'   => $f->original_name,
                    'extension'  => $f->extension,
                    'human_size' => $f->human_size,
                ])->values(),
            ] : null;
        }

        return Inertia::render('Production/Show', [
            'wos' => [
                'id'         => $workOrderSection->id,
                'sequence'   => $workOrderSection->sequence,
                'status'     => $workOrderSection->status,
                'notes'      => $workOrderSection->notes,
                'started_at' => $workOrderSection->started_at?->format('d M Y, h:i A'),
                'completed_at' => $workOrderSection->completed_at?->format('d M Y, h:i A'),
                'section'    => [
                    'id'      => $workOrderSection->section->id,
                    'name'    => $workOrderSection->section->name,
                    'code'    => $workOrderSection->section->code,
                    'name_bn' => $workOrderSection->section->name_bn,
                ],
                // Section-level weightage (share of the whole job) + this
                // section's own completion, by quantity.
                'weight_pct'       => (float) $workOrderSection->weight_pct,
                'section_progress' => (int) round($workOrderSection->progressFraction() * 100),
                // Partial-forward ledger.
                'received_qty'     => $workOrderSection->effectiveReceivedQty(), // null = ungated (first section)
                'forwarded_qty'    => (float) $workOrderSection->forwarded_qty,
                'output_qty'       => $workOrderSection->sectionOutputQty(),
                'forwardable_qty'  => $workOrderSection->forwardableQty(),
                'target_qty'       => $workOrderSection->sectionTargetQty(),
                'is_last'          => !WorkOrderSection::where('work_order_id', $workOrderSection->work_order_id)
                                        ->where('sequence', '>', $workOrderSection->sequence)
                                        ->whereHas('section', fn ($q) => $q->where('type', 'production_shop'))
                                        ->exists(),
                'bottleneck'       => $workOrderSection->bottleneck_at ? [
                    'reason' => $workOrderSection->bottleneck_reason,
                    'at'     => $workOrderSection->bottleneck_at->format('d M Y, h:i A'),
                ] : null,
                'work_order' => [
                    'id'         => $workOrderSection->workOrder->id,
                    'wo_number'  => $workOrderSection->workOrder->wo_number,
                    'job_number' => $workOrderSection->workOrder->job_number,
                    'customer'   => $workOrderSection->workOrder->customer?->name,
                    'product'    => $workOrderSection->workOrder->product?->name,
                    'quantity'   => $workOrderSection->workOrder->quantity,
                    'job_type'   => $workOrderSection->workOrder->rfq?->job_type ?? 'regular',
                    'due_date'   => $workOrderSection->workOrder->due_date?->format('d M Y'),
                ],
            ],
            'routing'   => $workOrderSection->workOrder->sections->map(fn($s) => [
                'id'       => $s->id,
                'sequence' => $s->sequence,
                'status'   => $s->status,
                'section'  => ['name' => $s->section->name, 'code' => $s->section->code],
            ])->values(),
            // Optionally surface the scoped item so the page header can show it.
            'scoped_item' => $scopedItemId
                ? (function () use ($workOrderSection, $scopedItemId) {
                    $item = $workOrderSection->workOrder->items->firstWhere('id', $scopedItemId);
                    if (!$item) return null;
                    $idx = $workOrderSection->workOrder->items->search(fn ($i) => $i->id === $item->id);
                    return [
                        'id'          => $item->id,
                        'sequence'    => $idx !== false ? $idx + 1 : null,
                        'description' => $item->description,
                        'quantity'    => (float) $item->quantity,
                        'unit'        => $item->unit ?? 'pcs',
                    ];
                })()
                : null,
            'siblings_count' => $scopedItemId
                ? (int) $workOrderSection->workOrder->items->count() - 1
                : 0,
            // Item-wise: every WO item that has an operation sheet contributes
            // its own steps at this section. Supervisor sees one block per item,
            // can start/complete each independently. Legacy WOs with WO-wide
            // sheets (work_order_item_id NULL) get bucketed under a "shared" item.
            // When ?item_id is set, only that item's block is shipped.
            'op_items' => (function () use ($workOrderSection, $scopedItemId) {
                $wo = $workOrderSection->workOrder;
                $sectionId = $workOrderSection->section_id;
                $packStep = fn ($s) => [
                    'id'                => $s->id,
                    'sequence'          => $s->sequence,
                    'operation_name'    => $s->operation_name,
                    'machine'           => $s->machine?->name,
                    'machine_id'        => $s->machine_id,
                    'operator'          => $s->operator?->name,
                    'sub_section'       => $s->subSection?->name,
                    'sub_section_id'    => $s->sub_section_id,
                    'estimated_hours'   => (float) $s->estimated_hours,
                    'actual_hours'      => (float) ($s->actual_hours ?? 0),
                    'weight_pct'        => (float) ($s->weight_pct ?? 0),
                    'target_qty'        => (float) ($s->target_qty ?? 0),
                    'completed_qty'     => (float) ($s->completed_qty ?? 0),
                    'remaining_qty'     => (float) $s->remaining_qty,
                    'status'            => $s->status,
                    'started_at'        => $s->started_at?->format('d M Y, h:i A'),
                    'started_at_iso'    => $s->started_at?->toIso8601String(),
                    'completed_at'      => $s->completed_at?->format('d M Y, h:i A'),
                    'completed_at_iso'  => $s->completed_at?->toIso8601String(),
                    'tooling_notes'     => $s->tooling_notes,
                    'qc_notes'          => $s->qc_notes,
                    'logs'              => $s->productionLogs->map(fn ($l) => [
                        'id'        => $l->id,
                        'log_date'  => $l->log_date?->format('d M Y'),
                        'qty'       => (float) $l->qty,
                        'hours'     => $l->hours !== null ? (float) $l->hours : null,
                        'machine'   => $l->machine?->name,
                        'operator'  => $l->operator?->name,
                        'remarks'   => $l->remarks,
                        'logged_by' => $l->loggedBy?->name,
                    ])->values(),
                ];

                $result = collect();
                foreach ($wo->items as $idx => $item) {
                    // When scoped, skip every item except the selected one.
                    if ($scopedItemId && $item->id !== $scopedItemId) continue;
                    $sheet = $wo->operationSheets->firstWhere('work_order_item_id', $item->id);
                    $steps = $sheet
                        ? $sheet->steps->where('section_id', $sectionId)->values()
                        : collect();
                    $result->push([
                        'item' => [
                            'id'          => $item->id,
                            'sequence'    => $idx + 1,
                            'description' => $item->description,
                            'quantity'    => (float) $item->quantity,
                            'unit'        => $item->unit ?? 'pcs',
                        ],
                        'sheet_id'     => $sheet?->id,
                        'sheet_number' => $sheet?->sheet_number,
                        'steps'        => $steps->map($packStep)->values(),
                    ]);
                }
                // Legacy WO-wide sheets only render when not scoped to an item.
                if (!$scopedItemId) {
                    $legacy = $wo->operationSheets->whereNull('work_order_item_id');
                    foreach ($legacy as $sheet) {
                        $steps = $sheet->steps->where('section_id', $sectionId)->values();
                        if ($steps->isEmpty()) continue;
                        $result->push([
                            'item' => null,
                            'sheet_id'     => $sheet->id,
                            'sheet_number' => $sheet->sheet_number,
                            'steps' => $steps->map($packStep)->values(),
                        ]);
                    }
                }
                return $result->values();
            })(),
            'handoffs'         => $handoffs,
            'rework_context'   => $reworkContext,
            'earlier_sections' => $this->routing->earlierSectionsFor($workOrderSection)->map(fn($s) => [
                'wos_id'   => $s->id,
                'sequence' => $s->sequence,
                'section'  => ['name' => $s->section->name, 'code' => $s->section->code],
                'status'   => $s->status,
            ])->values(),
            // Machines + operators for this shop (and its sub-sections) — used by
            // the daily production log form's machine/operator selects.
            'machines' => (function () use ($workOrderSection) {
                $ids = collect([$workOrderSection->section_id])
                    ->merge($workOrderSection->section->children->pluck('id'))->all();
                return \App\Models\Machine::whereIn('section_id', $ids)->orderBy('name')
                    ->get(['id', 'name', 'machine_code', 'section_id'])
                    ->map(fn ($m) => ['id' => $m->id, 'name' => $m->name, 'code' => $m->machine_code, 'section_id' => $m->section_id])
                    ->values();
            })(),
            'operators' => (function () use ($workOrderSection) {
                $ids = collect([$workOrderSection->section_id])
                    ->merge($workOrderSection->section->children->pluck('id'))->all();
                return \App\Models\Operator::where('is_active', true)->whereIn('section_id', $ids)->orderBy('name')
                    ->get(['id', 'name', 'employee_id'])
                    ->map(fn ($o) => ['id' => $o->id, 'name' => $o->name, 'employee_id' => $o->employee_id])
                    ->values();
            })(),
            // Sub-sections of THIS shop — the in-charge assigns each step to one
            // after the job arrives (PCD only routes to the shop, not the sub-shop).
            'sub_sections' => $workOrderSection->section->children
                ->sortBy('display_order')
                ->map(fn ($c) => ['id' => $c->id, 'name' => $c->name, 'code' => $c->code])
                ->values(),
        ]);
    }

    private function authorizeAccess(WorkOrderSection $wos): void
    {
        $user = auth()->user();
        $canAll = $user->hasAnyRole(['super_admin', 'admin']) || $user->can('manage users');
        if ($canAll) return;
        abort_unless($user->section_id && $user->section_id === $wos->section_id, 403,
            'You are not the supervisor of this section.');
    }

    /**
     * Expand a WOS into one row per WO item that has work at this section.
     * Each item carries its own sheet info + per-section step progress so
     * operators see "Job 37708 — Item 1 (Cylinder Body)" as a distinct row
     * from "Job 37708 — Item 2 (Piston)". Legacy WOs without item-wise sheets
     * (or items that don't yet have a sheet) fall back to a single un-itemed
     * row so nothing disappears from the queue.
     */
    private function expandWosForQueue(WorkOrderSection $wos): \Illuminate\Support\Collection
    {
        $wo    = $wos->workOrder;
        $items = $wo->items;
        $sectionId = $wos->section_id;

        // Partial-forward model: an item appears at a section whenever the WOS is
        // active AND the item still has open (non-completed) steps at this
        // section. With partial forwarding an item can legitimately be at two
        // sections at once (e.g. 6 pcs already forwarded to Machine Shop while
        // the remaining 4 are still at Mould) — so we no longer gate on the
        // single "current" step. Section availability itself is gated upstream by
        // the transfer that set this WOS to 'ready' + bumped its received_qty.
        $rows = collect();
        $hasAnyItemSheet = false;
        foreach ($items as $idx => $item) {
            $sheet = $wo->operationSheets->firstWhere('work_order_item_id', $item->id);
            if (!$sheet) continue;
            $hasAnyItemSheet = true;
            $sectionSteps = $sheet->steps->where('section_id', $sectionId);
            if ($sectionSteps->isEmpty()) continue;
            $openHere = $sectionSteps->first(fn ($s) => !in_array($s->status, ['completed', 'skipped']));
            if (!$openHere) continue;
            $rows->push($this->serializeWosForQueue($wos, [
                'item' => [
                    'id'          => $item->id,
                    'sequence'    => $idx + 1,
                    'description' => $item->description,
                    'quantity'    => (float) $item->quantity,
                    'unit'        => $item->unit ?? 'pcs',
                ],
                'sheet_number'   => $sheet->sheet_number,
                'steps_total'    => $sectionSteps->count(),
                'steps_done'     => $sectionSteps->whereIn('status', ['completed', 'skipped'])->count(),
            ]));
        }

        // Legacy fallback: no item-wise sheets covered this section → one row,
        // no item info, like the old behavior.
        if (!$hasAnyItemSheet) {
            $rows->push($this->serializeWosForQueue($wos));
        }
        return $rows;
    }

    private function serializeWosForQueue(WorkOrderSection $wos, array $itemContext = []): array
    {
        $wo = $wos->workOrder;

        // Last rework reason (if this WOS is in 'rework')
        $reworkBanner = null;
        if ($wos->status === 'rework') {
            $back = SectionHandoff::with(['fromSection', 'transferredBy'])
                ->where('work_order_id', $wos->work_order_id)
                ->where('direction', 'backward')
                ->where('to_section_id', $wos->section_id)
                ->latest('id')
                ->first();
            $reworkBanner = $back ? [
                'from_section'   => $back->fromSection?->name,
                'transferred_by' => $back->transferredBy?->name,
                'note'           => $back->note,
                'transferred_at' => $back->transferred_at?->diffForHumans(),
            ] : null;
        }

        return array_merge([
            'id'         => $wos->id,
            // Stable composite key so React can render multiple item-rows per WOS.
            'row_key'    => 'wos-' . $wos->id . (isset($itemContext['item']['id']) ? '-item-' . $itemContext['item']['id'] : ''),
            'sequence'   => $wos->sequence,
            'status'     => $wos->status,
            'started_at' => $wos->started_at?->diffForHumans(),
            'work_order' => [
                'id'         => $wo->id,
                'wo_number'  => $wo->wo_number,
                'job_number' => $wo->job_number,
                'customer'   => $wo->customer?->name ?? '—',
                'product'    => $wo->product?->name,
                'quantity'   => $wo->quantity,
                'job_type'   => $wo->rfq?->job_type ?? 'regular',
                'due_date'   => $wo->due_date?->format('d M Y'),
                'priority'   => $wo->priority,
            ],
            'rework'     => $reworkBanner,
            // Item context (null when this WOS has no item-wise sheets) —
            // drives the per-item row UI on the queue.
            'item'         => null,
            'sheet_number' => null,
            'steps_total'  => null,
            'steps_done'   => null,
        ], $itemContext);
    }
}
