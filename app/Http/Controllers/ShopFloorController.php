<?php

namespace App\Http\Controllers;

use App\Models\DowntimeEvent;
use App\Models\JobExecution;
use App\Models\OperationSheet;
use App\Models\OperationStep;
use App\Services\AuditService;
use Illuminate\Http\Request;
use Inertia\Inertia;

class ShopFloorController extends Controller
{
    public function __construct(private AuditService $audit) {}

    public function index()
    {
        $user = auth()->user();

        // Operator sees only their assigned steps — exclude steps belonging
        // to cancelled work orders so closed jobs disappear from production shops.
        $assignedSteps = OperationStep::whereHas('operatorAssignments', fn($q) => $q->where('user_id', $user->id))
            ->whereHas('operationSheet.workOrder', fn($q) => $q->where('status', '!=', 'cancelled'))
            ->with([
                'operationSheet.workOrder.product',
                'machine',
                'jobExecutions' => fn($q) => $q->where('status', 'started')->limit(1),
            ])->get();

        $activeExecution = JobExecution::where('operator_id', $user->id)
            ->where('status', 'started')->with(['workOrder.product', 'machine', 'operationStep'])->first();

        return Inertia::render('ShopFloor/Terminal', [
            'assignedSteps'   => $assignedSteps,
            'activeExecution' => $activeExecution,
            'machines'        => \App\Models\Machine::where('status', 'active')->get(['id', 'name']),
        ]);
    }

    public function start(Request $request)
    {
        $validated = $request->validate([
            'operation_step_id' => 'required|exists:operation_steps,id',
            'machine_id'        => 'required|exists:machines,id',
        ]);

        $step = OperationStep::findOrFail($validated['operation_step_id']);

        // Refuse if the parent work order has been cancelled by PCD
        if (optional($step->operationSheet?->workOrder)->status === 'cancelled') {
            return back()->withErrors(['operation_step_id' => 'This job has been closed by PCD and can no longer be worked on.']);
        }

        $execution = JobExecution::create([
            'operation_step_id' => $step->id,
            'work_order_id'     => $step->operationSheet->workOrder->id,
            'operator_id'       => auth()->id(),
            'machine_id'        => $validated['machine_id'],
            'started_at'        => now(),
            'status'            => 'started',
        ]);

        // Update WO status if not already in production
        $wo = $step->operationSheet->workOrder;
        if ($wo->status === 'approved') {
            $wo->update(['status' => 'in_production']);
        }

        $this->audit->log('job_started', 'JobExecution', $execution->id, [], [
            'message' => "Job started: {$wo->wo_number} by " . auth()->user()->name,
        ]);

        return back()->with('success', 'Job started.');
    }

    public function stop(Request $request)
    {
        $validated = $request->validate([
            'execution_id'  => 'required|exists:job_executions,id',
            'qty_completed' => 'required|numeric|min:0',
            'qty_rejected'  => 'nullable|numeric|min:0',
            'reject_reason' => 'nullable|string|max:255',
        ]);

        $execution = JobExecution::findOrFail($validated['execution_id']);
        abort_unless($execution->operator_id === auth()->id(), 403);

        $execution->update([
            'status'        => 'stopped',
            'stopped_at'    => now(),
            'qty_completed' => $validated['qty_completed'],
            'qty_rejected'  => $validated['qty_rejected'] ?? 0,
            'reject_reason' => $validated['reject_reason'],
        ]);

        $this->audit->log('job_stopped', 'JobExecution', $execution->id, [], [
            'message' => "Job stopped: WO " . $execution->workOrder->wo_number . " — {$validated['qty_completed']} pcs",
        ]);

        return back()->with('success', 'Job stopped.');
    }

    public function downtime(Request $request)
    {
        $validated = $request->validate([
            'execution_id' => 'required|exists:job_executions,id',
            'category'     => 'required|in:machine_breakdown,material_shortage,operator_absence,power_outage,other',
            'description'  => 'nullable|string|max:500',
        ]);

        $execution = JobExecution::findOrFail($validated['execution_id']);
        DowntimeEvent::create([
            'job_execution_id' => $execution->id,
            'machine_id'       => $execution->machine_id,
            'category'         => $validated['category'],
            'description'      => $validated['description'],
            'started_at'       => now(),
        ]);

        $this->audit->log('downtime_logged', 'DowntimeEvent', null, [], [
            'message' => "Downtime: {$execution->machine->name} — {$validated['category']}",
        ]);

        return back()->with('success', 'Downtime logged.');
    }

    public function scan(string $qrCode)
    {
        $sheet = OperationSheet::where('qr_code', $qrCode)->first();
        if (!$sheet) {
            return redirect()->route('shop-floor.index')->with('error', 'QR code not found.');
        }
        return redirect()->route('shop-floor.index', ['sheet_id' => $sheet->id]);
    }
}
