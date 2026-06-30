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
        $query = WorkOrder::with(['product', 'customer', 'createdBy', 'operationSheets.steps', 'sections.section', 'rfq:id,job_type', 'jobCategory']);

        if ($search = $request->input('search')) {
            // job_number is an unsigned int — strip prefixes like "Job", "#", spaces
            // so users can type "Job#37705" or "#37705" and still hit the row.
            $digits = preg_replace('/\D/', '', $search);

            $query->where(function ($q) use ($search, $digits) {
                $q->where('wo_number', 'like', "%{$search}%")
                  ->orWhere('customer_po_no', 'like', "%{$search}%")
                  ->orWhereHas('customer', fn($c) => $c->where('name', 'like', "%{$search}%"))
                  ->orWhereHas('product', fn($p) => $p->where('name', 'like', "%{$search}%"));

                // Only search job_number when the input contains digits — empty
                // digits would otherwise turn into "%%" and match everything.
                if ($digits !== '') {
                    $q->orWhere('job_number', 'like', "%{$digits}%");
                }
            });
        }
        if ($status = $request->input('status')) $query->where('status', $status);
        if ($priority = $request->input('priority')) $query->where('priority', $priority);

        $sort = $request->input('sort', 'id');
        $dir  = $request->input('dir', 'desc');
        $allowed = ['id', 'wo_number', 'job_number', 'customer_id', 'quantity', 'status', 'priority', 'due_date', 'created_at'];
        if (in_array($sort, $allowed)) {
            $query->orderBy($sort, $dir === 'asc' ? 'asc' : 'desc');
        } else {
            $query->latest();
        }

        return Inertia::render('WorkOrder/Index', [
            'workOrders' => $query->paginate(15)->withQueryString()->through(fn($wo) => [
                'id'           => $wo->id,
                'wo_number'    => $wo->wo_number,
                'job_number'   => $wo->job_number,
                'job_type'     => $wo->rfq?->job_type ?? 'regular',
                'job_category' => $wo->jobCategory?->name,
                'customer'     => $wo->customer->name ?? '',
                'quantity'     => $wo->quantity,
                'status'       => $wo->status,
                'status_label' => $wo->status_label,
                'status_color' => $wo->status_color,
                'priority'     => $wo->priority,
                'due_date'     => $wo->due_date?->format('d/m/Y'),
                'is_overdue'   => $wo->is_overdue,
                'created_at'   => $wo->created_at->format('d/m/Y'),
                // Section-weighted progress — Σ(section weight × section completion).
                // See WorkOrder::getProductionProgressAttribute().
                'progress_pct' => $wo->operationSheets->isEmpty() && $wo->sections->isEmpty()
                    ? null
                    : $wo->production_progress,
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
            'rfq:id,job_type',
            'items',
            'operationSheets.workOrderItem',
            'operationSheets.steps.machine.workCentre',
            'operationSheets.steps.operator',
            'operationSheets.steps.section',
            'materialRequisitions',
            'qcInspections',
            'ncrs',
            'deliveryOrders.pod',
            'invoices',
        ]);

        $delivery = $workOrder->deliveryOrders->first();
        $invoice = $workOrder->invoices->first();
        $user = auth()->user();

        // Per-item operation sheets — WO is now multi-item, so every item has
        // its own sheet. The page renders one card per item with its own
        // progress, and the overall WO progress aggregates across them.
        $itemSheets = $workOrder->items->values()->map(function ($item, $idx) use ($workOrder) {
            $sheet = $workOrder->operationSheets->firstWhere('work_order_item_id', $item->id);
            return [
                'item' => [
                    'id'          => $item->id,
                    'sequence'    => $idx + 1,
                    'description' => $item->description,
                    'quantity'    => (float) $item->quantity,
                    'unit'        => $item->unit ?? 'pcs',
                ],
                'sheet' => $sheet ? $this->packSheetForShow($sheet, $workOrder) : null,
            ];
        });

        // Aggregate progress = weighted average of each item's progress
        // (each item carries equal weight in the rollup). Empty if no sheets.
        $progressList = $itemSheets->pluck('sheet.progress')->filter()->values();
        $overallProgress = $progressList->isNotEmpty() ? [
            'pct'             => (int) round($progressList->avg('pct')),
            'total'           => (int) $progressList->sum('total'),
            'completed'       => (int) $progressList->sum('completed'),
            'in_progress'     => (int) $progressList->sum('in_progress'),
            'pending'         => (int) $progressList->sum('pending'),
            'estimated_hours' => round((float) $progressList->sum('estimated_hours'), 1),
            'actual_hours'    => round((float) $progressList->sum('actual_hours'), 1),
        ] : null;

        $canApprove = $user->can('approve work-orders') && $workOrder->status === 'draft';

        $allStatuses = ['approved', 'in_production', 'qc_hold', 'qc_passed', 'ready_for_delivery', 'delivered', 'cancelled'];
        $nextStates = collect($allStatuses)
            ->filter(fn($s) => $this->service->canTransitionTo($workOrder, $s) && $s !== 'approved')
            ->values()
            ->toArray();

        $completionCert = \App\Models\CompletionCertificate::where('work_order_id', $workOrder->id)->first();

        return Inertia::render('WorkOrder/Show', [
            'completion_certificate' => $completionCert ? [
                'id'                    => $completionCert->id,
                'certificate_number'    => $completionCert->certificate_number,
                'mode'                  => $completionCert->mode,
                'issued_by_name'        => $completionCert->issued_by_name,
                'issued_by_designation' => $completionCert->issued_by_designation,
                'issued_date'           => $completionCert->issued_date?->format('d M Y'),
                'rating'                => $completionCert->rating,
                'remarks'               => $completionCert->remarks,
                'file_url'              => $completionCert->file_url,
                'created_at'            => $completionCert->created_at->format('d M Y, h:i A'),
            ] : null,
            'workOrder' => [
                'id'           => $workOrder->id,
                'wo_number'    => $workOrder->wo_number,
                'job_number'   => $workOrder->job_number,
                'job_type'     => $workOrder->rfq?->job_type ?? 'regular',
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
                // Per-item op sheets — array of { item, sheet } pairs.
                'item_operation_sheets' => $itemSheets->all(),
                // Overall WO progress aggregated across every item's sheet.
                'progress' => $overallProgress,
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

    /**
     * Build the per-item Operation Sheet payload + progress block. Mirrors the
     * old single-sheet shape but scoped to one item so the Show page can render
     * a card per item.
     */
    private function packSheetForShow(\App\Models\OperationSheet $sheet, WorkOrder $workOrder): array
    {
        $steps = $sheet->steps->sortBy('sequence')->values();
        $total = $steps->count();

        $completed  = $steps->where('status', 'completed')->count();
        $inProgress = $steps->where('status', 'in_progress')->count();
        $isTerminal = in_array($workOrder->status, ['qc_passed', 'ready_for_delivery', 'delivered']);

        if ($total === 0) {
            $pct = 0;
        } else {
            // Quantity-aware: average each step's completion fraction
            // (completed_qty / target_qty), status fallback when no target.
            $pct = (int) round($steps->avg(fn ($s) => $s->progressFraction()) * 100);
            if ($isTerminal) $pct = 100;
        }

        $current = $steps->firstWhere('status', 'in_progress')
                ?? $steps->firstWhere('status', 'pending');

        $totalEst = $steps->sum(fn ($s) => (float) ($s->estimated_hours ?? 0));
        $totalAct = $steps->sum(fn ($s) => (float) ($s->actual_hours ?? 0));

        return [
            'id'    => $sheet->id,
            'sheet_number' => $sheet->sheet_number,
            'steps' => $steps->map(fn ($s) => [
                'id'              => $s->id,
                'sequence'        => $s->sequence,
                'operation_name'  => $s->operation_name,
                'machine'         => ['name' => $s->machine?->name ?? '—'],
                'operator'        => $s->operator?->name ?? null,
                'estimated_hours' => (float) ($s->estimated_hours ?? 0),
                'actual_hours'    => (float) ($s->actual_hours ?? 0),
                'weight_pct'      => (float) ($s->weight_pct ?? 0),
                'status'          => $s->status,
                'started_at'      => $s->started_at?->toIso8601String(),
                'completed_at'    => $s->completed_at?->toIso8601String(),
            ])->all(),
            'progress' => [
                'pct'              => $pct,
                'completed'        => $completed,
                'in_progress'      => $inProgress,
                'pending'          => $steps->where('status', 'pending')->count(),
                'total'            => $total,
                'estimated_hours'  => round($totalEst, 1),
                'actual_hours'     => round($totalAct, 1),
                'efficiency'       => ($totalEst > 0 && $totalAct > 0)
                    ? (int) round(($totalEst / $totalAct) * 100)
                    : null,
                'current_step'     => $current ? [
                    'sequence'       => $current->sequence,
                    'operation_name' => $current->operation_name,
                    'section'        => $current->section?->name,
                    'status'         => $current->status,
                    'weight_pct'     => (float) $current->weight_pct,
                ] : null,
            ],
        ];
    }

    public function create()
    {
        return Inertia::render('WorkOrder/Create', [
            'customers'     => \App\Models\Customer::where('is_active', true)->get(['id', 'name']),
            'products'      => \App\Models\Product::with('activeBom')->get(['id', 'name', 'code']),
            'jobCategories' => \App\Models\JobCategory::active()->orderBy('display_order')->orderBy('name')->get(['id', 'name', 'code']),
        ]);
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'customer_id'     => 'required|exists:customers,id',
            'job_category_id' => 'nullable|exists:job_categories,id',
            'product_id'      => 'required|exists:products,id',
            'quantity'        => 'required|numeric|min:1',
            'priority'        => 'required|in:urgent,normal,low',
            'due_date'        => 'nullable|date',
            'notes'           => 'nullable|string',
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
