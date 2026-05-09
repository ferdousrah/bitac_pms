<?php

namespace App\Http\Controllers;

use App\Models\QcInspection;
use App\Models\WorkOrder;
use App\Services\AuditService;
use Illuminate\Http\Request;
use Inertia\Inertia;

class QcController extends Controller
{
    public function __construct(private AuditService $audit) {}

    public function index(Request $request)
    {
        $query = QcInspection::with(['workOrder.product', 'inspector']);

        // Search
        if ($search = $request->input('search')) {
            $query->where(function ($q) use ($search) {
                $q->orWhereHas('workOrder', fn($w) => $w->where('wo_number', 'like', "%{$search}%"))
                  ->orWhereHas('inspector', fn($i) => $i->where('name', 'like', "%{$search}%"));
            });
        }

        // Filter by result
        if ($result = $request->input('result')) {
            $query->where('result', $result);
        }

        // Sorting
        $sort = $request->input('sort', 'id');
        $dir  = $request->input('dir', 'desc');
        $allowed = ['id', 'result', 'inspected_at', 'created_at'];
        if (in_array($sort, $allowed)) {
            $query->orderBy($sort, $dir === 'asc' ? 'asc' : 'desc');
        } else {
            $query->latest();
        }

        $inspections = $query->paginate(15)->withQueryString()
            ->through(fn($q) => [
                'id'              => $q->id,
                'wo_number'       => $q->workOrder->wo_number ?? '',
                'product'         => $q->workOrder->product->name ?? '',
                'inspection_type' => $q->inspection_type,
                'inspector'       => $q->inspector->name ?? '',
                'result'          => $q->result,
                'qty_passed'      => $q->qty_passed,
                'qty_failed'      => $q->qty_failed,
                'inspected_at'    => $q->inspected_at?->format('d/m/Y H:i'),
                'work_order_id'   => $q->work_order_id,
            ]);

        return Inertia::render('QC/Index', [
            'inspections' => $inspections,
            'filters' => [
                'search' => $request->input('search', ''),
                'result' => $request->input('result', ''),
                'sort'   => $sort,
                'dir'    => $dir,
            ],
        ]);
    }

    public function create(Request $request)
    {
        $workOrders = WorkOrder::whereIn('status', ['in_production', 'qc_hold'])
            ->with('product')->get()
            ->map(fn($wo) => [
                'id'       => $wo->id,
                'wo_number'=> $wo->wo_number,
                'product'  => $wo->product->name ?? '',
            ]);

        $preselected = $request->query('work_order_id')
            ? WorkOrder::find($request->query('work_order_id'))
            : null;

        return Inertia::render('QC/Create', [
            'workOrders' => $workOrders,
            'workOrder'  => $preselected ? ['id' => $preselected->id, 'wo_number' => $preselected->wo_number] : null,
        ]);
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'work_order_id'   => 'required|exists:work_orders,id',
            'inspection_type' => 'required|in:incoming,in_process,final',
            'qty_passed'      => 'required|integer|min:0',
            'qty_failed'      => 'nullable|integer|min:0',
            'result'          => 'required|in:pass,fail,conditional',
            'notes'           => 'nullable|string',
            'checklist'       => 'nullable|array',
        ]);

        $workOrder = WorkOrder::findOrFail($validated['work_order_id']);

        $inspection = QcInspection::create([
            'work_order_id'   => $workOrder->id,
            'inspector_id'    => auth()->id(),
            'inspection_type' => $validated['inspection_type'],
            'qty_passed'      => $validated['qty_passed'],
            'qty_failed'      => $validated['qty_failed'] ?? 0,
            'result'          => $validated['result'],
            'notes'           => $validated['notes'],
            'inspected_at'    => now(),
        ]);

        foreach ($validated['checklist'] ?? [] as $item) {
            $inspection->checklistItems()->create([
                'check_point' => $item['name'],
                'result'      => $item['result'],
                'remarks'     => $item['remarks'] ?? null,
            ]);
        }

        if ($validated['result'] === 'pass') {
            $workOrder->update(['status' => 'qc_passed']);
            $this->audit->log('qc_passed', 'WorkOrder', $workOrder->id, [], [
                'message' => "QC Passed: {$workOrder->wo_number}",
            ]);
        } elseif ($validated['result'] === 'fail') {
            $workOrder->update(['status' => 'qc_hold']);
            $this->audit->log('qc_hold', 'WorkOrder', $workOrder->id, [], [
                'message' => "QC Hold: {$workOrder->wo_number}",
            ]);
        }

        return redirect()->route('qc.show', $inspection)->with('success', 'QC inspection recorded.');
    }

    public function show(QcInspection $inspection)
    {
        $inspection->load(['workOrder.product', 'inspector', 'checklistItems', 'ncrs']);
        $hasNcr = $inspection->ncrs->isNotEmpty();

        return Inertia::render('QC/Result', [
            'inspection' => [
                'id'              => $inspection->id,
                'wo_number'       => $inspection->workOrder->wo_number ?? '',
                'product'         => $inspection->workOrder->product->name ?? '',
                'inspection_type' => $inspection->inspection_type,
                'result'          => $inspection->result,
                'qty_passed'      => $inspection->qty_passed,
                'qty_failed'      => $inspection->qty_failed,
                'inspector'       => $inspection->inspector->name ?? '',
                'inspected_at'    => $inspection->inspected_at?->format('d M Y H:i'),
                'work_order_id'   => $inspection->work_order_id,
                'has_ncr'         => $hasNcr,
                'notes'           => $inspection->notes,
                'checklist_items' => $inspection->checklistItems->map(fn($c) => [
                    'id'          => $c->id,
                    'check_point' => $c->check_point,
                    'result'      => $c->result,
                    'remarks'     => $c->remarks,
                ]),
            ],
        ]);
    }
}
