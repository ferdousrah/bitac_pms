<?php

namespace App\Http\Controllers;

use App\Models\JobExecution;
use App\Models\WorkOrder;
use Inertia\Inertia;

class WIPController extends Controller
{
    public function index()
    {
        $activeJobs = JobExecution::where('status', 'started')
            ->with([
                'workOrder.product',
                'workOrder.customer',
                'operator',
                'machine.workCentre',
                'operationStep',
            ])->get()->map(fn($je) => [
                'id'              => $je->id,
                'wo_number'       => $je->workOrder->wo_number ?? '',
                'product'         => $je->workOrder->product->name ?? '',
                'customer'        => $je->workOrder->customer->name ?? '',
                'current_step'    => $je->operationStep->operation_name ?? '',
                'machine'         => $je->machine->name ?? '',
                'work_centre'     => $je->machine->workCentre->name ?? '',
                'operator'        => $je->operator->name ?? '',
                'started_at'      => $je->started_at?->toIso8601String(),
                'estimated_hours' => $je->operationStep->estimated_hours ?? 0,
                'status'          => $je->workOrder->status ?? '',
                'elapsed_minutes' => $je->elapsed_minutes,
            ]);

        $wipSummary = WorkOrder::whereIn('status', ['in_production', 'qc_hold'])
            ->with(['product', 'customer'])->get();

        return Inertia::render('WIP/Index', [
            'activeJobs'  => $activeJobs,
            'wipSummary'  => $wipSummary,
        ]);
    }
}
