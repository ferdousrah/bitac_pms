<?php

namespace App\Http\Controllers;

use App\Models\WorkOrder;
use App\Services\WorkOrderService;
use Illuminate\Http\Request;
use Inertia\Inertia;

class WorkOrderController extends Controller
{
    public function __construct(private WorkOrderService $service) {}

    public function index(Request $request)
    {
        $query = WorkOrder::with(['product', 'customer', 'createdBy', 'operationSheets.steps']);

        if ($search = $request->input('search')) {
            $query->where(function ($q) use ($search) {
                $q->where('wo_number', 'like', "%{$search}%")
                  ->orWhere('customer_po_no', 'like', "%{$search}%")
                  ->orWhereHas('customer', fn($c) => $c->where('name', 'like', "%{$search}%"))
                  ->orWhereHas('product', fn($p) => $p->where('name', 'like', "%{$search}%"));
            });
        }
        if ($status = $request->input('status')) $query->where('status', $status);
        if ($priority = $request->input('priority')) $query->where('priority', $priority);

        $sort = $request->input('sort', 'id');
        $dir  = $request->input('dir', 'desc');
        $allowed = ['id', 'wo_number', 'customer_id', 'quantity', 'status', 'priority', 'due_date', 'created_at'];
        if (in_array($sort, $allowed)) {
            $query->orderBy($sort, $dir === 'asc' ? 'asc' : 'desc');
        } else {
            $query->latest();
        }

        return Inertia::render('WorkOrder/Index', [
            'workOrders' => $query->paginate(15)->withQueryString()->through(fn($wo) => [
                'id'           => $wo->id,
                'wo_number'    => $wo->wo_number,
                'product'      => $wo->product->name ?? '',
                'customer'     => $wo->customer->name ?? '',
                'quantity'     => $wo->quantity,
                'status'       => $wo->status,
                'status_label' => $wo->status_label,
                'status_color' => $wo->status_color,
                'priority'     => $wo->priority,
                'due_date'     => $wo->due_date?->format('d/m/Y'),
                'is_overdue'   => $wo->is_overdue,
                'created_at'   => $wo->created_at->format('d/m/Y'),
                'progress_pct' => (function () use ($wo) {
                    $sheet = $wo->operationSheets->first();
                    if (!$sheet) return null;
                    $total = $sheet->steps->count();
                    if ($total === 0) return 0;
                    $done = $sheet->steps->where('status', 'completed')->count();
                    $wip  = $sheet->steps->where('status', 'in_progress')->count();
                    return round((($done + $wip * 0.5) / $total) * 100);
                })(),
            ]),
            'filters'    => [
                'search'   => $request->input('search', ''),
                'status'   => $request->input('status', ''),
                'priority' => $request->input('priority', ''),
                'sort'     => $sort,
                'dir'      => $dir,
            ],
            'statusList' => ['draft', 'approved', 'in_production', 'qc_hold', 'qc_passed', 'ready_for_delivery', 'delivered', 'cancelled'],
        ]);
    }

    public function show(WorkOrder $workOrder)
    {
        $workOrder->load([
            'product', 'customer',
            'quotation',
            'operationSheets.steps.machine.workCentre',
            'operationSheets.steps.assignment.operator',
            'materialRequisitions',
            'qcInspections',
            'ncrs',
            'deliveryOrders.proofOfDelivery',
            'invoices',
        ]);

        $sheet = $workOrder->operationSheets->first();
        $delivery = $workOrder->deliveryOrders->first();
        $invoice = $workOrder->invoices->first();
        $user = auth()->user();

        $canApprove = $user->can('approve work-orders') && $workOrder->status === 'draft';

        $allStatuses = ['approved', 'in_production', 'qc_hold', 'qc_passed', 'ready_for_delivery', 'delivered', 'cancelled'];
        $nextStates = collect($allStatuses)
            ->filter(fn($s) => $this->service->canTransitionTo($workOrder, $s) && $s !== 'approved')
            ->values()
            ->toArray();

        return Inertia::render('WorkOrder/Show', [
            'workOrder' => [
                'id'           => $workOrder->id,
                'wo_number'    => $workOrder->wo_number,
                'product'      => $workOrder->product->name ?? '',
                'customer'     => $workOrder->customer->name ?? '',
                'quantity'     => $workOrder->quantity,
                'status'       => $workOrder->status,
                'status_label' => $workOrder->status_label,
                'priority'     => $workOrder->priority,
                'due_date'     => $workOrder->due_date?->format('d/m/Y'),
                'is_overdue'   => $workOrder->is_overdue,
                'notes'        => $workOrder->notes,
                'created_at'   => $workOrder->created_at->format('d M Y'),
                'quotation'    => $workOrder->quotation ? [
                    'id'           => $workOrder->quotation->id,
                    'version'      => $workOrder->quotation->version,
                    'total_amount' => $workOrder->quotation->total_amount,
                    'vat_rate'     => $workOrder->quotation->vat_rate,
                ] : null,
                'operation_sheet' => $sheet ? [
                    'id'    => $sheet->id,
                    'steps' => $sheet->steps->map(fn($s) => [
                        'id'              => $s->id,
                        'sequence'        => $s->sequence,
                        'operation_name'  => $s->operation_name,
                        'machine'         => ['name' => $s->machine?->name ?? '—'],
                        'operator'        => $s->assignment?->operator?->name ?? null,
                        'estimated_hours' => (float) ($s->estimated_hours ?? 0),
                        'actual_hours'    => (float) ($s->actual_hours ?? 0),
                        'status'          => $s->status,
                        'started_at'      => $s->started_at?->toIso8601String(),
                        'completed_at'    => $s->completed_at?->toIso8601String(),
                    ]),
                ] : null,
                'progress' => $sheet ? (function () use ($sheet) {
                    $steps = $sheet->steps;
                    $total = $steps->count();
                    if ($total === 0) return ['pct' => 0, 'completed' => 0, 'total' => 0, 'in_progress' => 0];
                    $completed = $steps->where('status', 'completed')->count();
                    $inProgress = $steps->where('status', 'in_progress')->count();
                    $pct = round((($completed + $inProgress * 0.5) / $total) * 100);
                    $totalEstimated = $steps->sum(fn($s) => (float) ($s->estimated_hours ?? 0));
                    $totalActual = $steps->sum(fn($s) => (float) ($s->actual_hours ?? 0));
                    return [
                        'pct'              => $pct,
                        'completed'        => $completed,
                        'in_progress'      => $inProgress,
                        'pending'          => $steps->where('status', 'pending')->count(),
                        'total'            => $total,
                        'estimated_hours'  => round($totalEstimated, 1),
                        'actual_hours'     => round($totalActual, 1),
                        'efficiency'       => $totalEstimated > 0 ? round(($totalEstimated / max($totalActual, 0.1)) * 100) : null,
                    ];
                })() : null,
                'mrp_result' => $workOrder->materialRequisitions->map(fn($m) => [
                    'id'            => $m->id,
                    'material_name' => $m->material_name,
                    'required_qty'  => $m->required_qty,
                    'unit'          => $m->unit,
                    'available'     => $m->status !== 'shortage',
                ]),
                'qc_inspections' => $workOrder->qcInspections->map(fn($q) => [
                    'id'              => $q->id,
                    'inspection_type' => $q->inspection_type,
                    'result'          => $q->result,
                    'inspected_at'    => $q->inspected_at?->format('d M Y'),
                    'work_order_id'   => $workOrder->id,
                ]),
                'ncrs' => $workOrder->ncrs->map(fn($n) => [
                    'id'                 => $n->id,
                    'ncr_number'         => $n->ncr_number,
                    'defect_description' => $n->defect_description,
                    'status'             => $n->status,
                    'work_order_id'      => $workOrder->id,
                ]),
                'delivery_order' => $delivery ? [
                    'id'             => $delivery->id,
                    'challan_number' => $delivery->challan_number,
                    'status'         => $delivery->status,
                    'delivered_at'   => $delivery->delivered_at?->format('d M Y H:i'),
                ] : null,
                'invoice' => $invoice ? [
                    'id'             => $invoice->id,
                    'invoice_number' => $invoice->invoice_number,
                    'total_amount'   => $invoice->total_amount,
                    'status'         => $invoice->status,
                ] : null,
            ],
            'canApprove'     => $canApprove,
            'canTransitionTo'=> $nextStates,
        ]);
    }

    public function approve(Request $request, WorkOrder $workOrder)
    {
        abort_unless(in_array($workOrder->status, ['draft']), 422, 'Cannot approve this work order.');
        $workOrder->update(['status' => 'approved']);
        return back()->with('success', 'Work order approved.');
    }

    public function create()
    {
        return Inertia::render('WorkOrder/Create', [
            'customers' => \App\Models\Customer::where('is_active', true)->get(['id', 'name']),
            'products'  => \App\Models\Product::with('activeBom')->get(['id', 'name', 'code']),
        ]);
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'customer_id' => 'required|exists:customers,id',
            'product_id'  => 'required|exists:products,id',
            'quantity'    => 'required|numeric|min:1',
            'priority'    => 'required|in:urgent,normal,low',
            'due_date'    => 'nullable|date',
            'notes'       => 'nullable|string',
        ]);

        $product = \App\Models\Product::find($validated['product_id']);
        $wo = WorkOrder::create([
            ...$validated,
            'bom_id'     => $product->activeBom?->id,
            'wo_number'  => $this->service->generateWoNumber(),
            'status'     => 'draft',
            'created_by' => auth()->id(),
        ]);

        return redirect()->route('work-orders.show', $wo)->with('success', 'Work order created.');
    }

    public function edit(WorkOrder $workOrder)
    {
        return Inertia::render('WorkOrder/Create', ['workOrder' => $workOrder]);
    }

    public function update(Request $request, WorkOrder $workOrder)
    {
        $validated = $request->validate([
            'priority' => 'sometimes|in:urgent,normal,low',
            'due_date' => 'nullable|date',
            'notes'    => 'nullable|string',
        ]);
        $workOrder->update($validated);
        return back()->with('success', 'Work order updated.');
    }

    public function destroy(WorkOrder $workOrder)
    {
        abort_unless($workOrder->status === 'draft', 422, 'Only draft work orders can be deleted.');
        $workOrder->delete();
        return redirect()->route('work-orders.index')->with('success', 'Work order deleted.');
    }
}
