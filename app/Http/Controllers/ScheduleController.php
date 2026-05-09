<?php

namespace App\Http\Controllers;

use App\Models\Machine;
use App\Models\OperationStep;
use App\Models\ProductionSchedule;
use App\Models\WorkOrder;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Inertia\Inertia;

class ScheduleController extends Controller
{
    public function index(Request $request)
    {
        $shiftStart = ['morning' => 7, 'evening' => 15, 'night' => 23];

        $startDate = Carbon::parse($request->input('start', Carbon::today()->startOfWeek()->toDateString()));
        $endDate   = $startDate->copy()->addDays(6);

        $schedules = ProductionSchedule::with([
            'operationStep.operationSheet.workOrder.product',
            'machine.workCentre',
        ])->whereBetween('scheduled_date', [$startDate, $endDate])->get();

        // Detect conflict keys (same machine + date + shift booked more than once)
        $conflictKeys = $schedules
            ->groupBy(fn($s) => "{$s->machine_id}-{$s->scheduled_date->toDateString()}-{$s->shift}")
            ->filter(fn($g) => $g->count() > 1)
            ->keys()->flip()->all();

        // Group by machine name for the Gantt view
        $ganttData = $schedules->groupBy(fn($s) => $s->machine->name ?? 'Unknown')
            ->map(fn($group) => $group->map(fn($s) => [
                'id'             => $s->id,
                'wo_number'      => $s->operationStep?->operationSheet?->workOrder?->wo_number ?? '',
                'operation_name' => $s->operationStep?->operation_name ?? '',
                'estimated_hours'=> $s->operationStep?->estimated_hours ?? 1,
                'offset_hours'   => $shiftStart[$s->shift] ?? 7,
                'shift'          => $s->shift,
                'status'         => $s->status,
                'conflict'       => isset($conflictKeys["{$s->machine_id}-{$s->scheduled_date->toDateString()}-{$s->shift}"]),
                'is_overdue'     => false,
            ]))->all();

        return Inertia::render('Schedule/Index', [
            'ganttData' => $ganttData,
            'conflicts' => count($conflictKeys),
            'dateRange' => [
                'label' => $startDate->format('d M') . ' – ' . $endDate->format('d M Y'),
                'prev'  => $startDate->copy()->subDays(7)->toDateString(),
                'next'  => $startDate->copy()->addDays(7)->toDateString(),
            ],
            'machines'  => Machine::with('workCentre')->get()->map(fn($m) => [
                'id'          => $m->id,
                'name'        => $m->name,
                'work_centre' => $m->workCentre?->name ?? '',
            ]),
            'steps'     => OperationStep::with('operationSheet.workOrder')->get()
                ->map(fn($st) => [
                    'id'             => $st->id,
                    'operation_name' => $st->operation_name,
                    'wo_number'      => $st->operationSheet?->workOrder?->wo_number ?? '',
                    'estimated_hours'=> $st->estimated_hours,
                ]),
        ]);
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'operation_step_id' => 'required|exists:operation_steps,id',
            'machine_id'        => 'required|exists:machines,id',
            'scheduled_date'    => 'required|date',
            'shift'             => 'required|in:morning,evening,night',
        ]);

        ProductionSchedule::create(array_merge($validated, ['status' => 'scheduled']));

        return back()->with('success', 'Job scheduled.');
    }
}
