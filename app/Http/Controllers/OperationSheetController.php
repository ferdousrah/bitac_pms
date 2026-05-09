<?php

namespace App\Http\Controllers;

use App\Models\MachiningOperation;
use App\Models\Machine;
use App\Models\OperationSheet;
use App\Models\Operator;
use App\Models\Section;
use App\Models\User;
use App\Models\WorkOrder;
use App\Services\OperationSheetService;
use App\Services\PcdReleaseService;
use Illuminate\Http\Request;
use Inertia\Inertia;

class OperationSheetController extends Controller
{
    public function __construct(private OperationSheetService $service) {}

    public function index(Request $request)
    {
        $query = OperationSheet::with(['workOrder.customer', 'workOrder.product', 'steps']);

        // Search
        if ($search = $request->input('search')) {
            $query->where(function ($q) use ($search) {
                $q->where('sheet_number', 'like', "%{$search}%")
                  ->orWhereHas('workOrder', fn($w) => $w->where('wo_number', 'like', "%{$search}%"));
            });
        }

        // Sorting
        $sort = $request->input('sort', 'id');
        $dir  = $request->input('dir', 'desc');
        $allowed = ['id', 'created_at'];
        if (in_array($sort, $allowed)) {
            $query->orderBy($sort, $dir === 'asc' ? 'asc' : 'desc');
        } else {
            $query->latest();
        }

        $sheets = $query->paginate(15)->withQueryString()
            ->through(fn($s) => [
                'id'           => $s->id,
                'sheet_number' => $s->sheet_number,
                'work_order'   => $s->workOrder ? [
                    'id'         => $s->workOrder->id,
                    'wo_number'  => $s->workOrder->wo_number,
                    'job_number' => $s->workOrder->job_number,
                    'customer'   => $s->workOrder->customer?->name,
                    'product'    => $s->workOrder->product?->name,
                ] : null,
                'step_count'   => $s->steps->count(),
                'created_at'   => $s->created_at->format('d M Y'),
                'approved_at'  => $s->approved_at?->format('d M Y'),
            ]);

        return Inertia::render('OperationSheet/Index', [
            'sheets' => $sheets,
            'filters' => [
                'search' => $request->input('search', ''),
                'sort'   => $sort,
                'dir'    => $dir,
            ],
        ]);
    }

    public function create(WorkOrder $workOrder)
    {
        $workOrder->load(['product', 'customer', 'sections.section']);

        // If sheet already exists, redirect to edit
        $existing = $workOrder->operationSheets()->first();
        if ($existing) {
            return redirect()->route('operation-sheets.show', $existing);
        }

        return Inertia::render('OperationSheet/Builder', [
            'workOrder' => [
                'id'         => $workOrder->id,
                'wo_number'  => $workOrder->wo_number,
                'job_number' => $workOrder->job_number,
                'product'    => $workOrder->product->name ?? '',
                'customer'   => $workOrder->customer?->name,
                'quantity'   => $workOrder->quantity,
                'assigned_sections' => $workOrder->sections->map(fn($s) => [
                    'id'         => $s->section_id,
                    'name'       => $s->section->name,
                    'code'       => $s->section->code,
                    'sequence'   => $s->sequence,
                ]),
            ],
            'sections'   => Section::active()->shops()->orderBy('display_order')->get(['id', 'name', 'code']),
            'machines'   => Machine::with('section')->get()
                ->map(fn($m) => [
                    'id'         => $m->id,
                    'name'       => $m->name,
                    'code'       => $m->machine_code,
                    'section_id' => $m->section_id,
                ]),
            'operators'  => Operator::with('section')->where('is_active', true)->get()
                ->map(fn($o) => [
                    'id'         => $o->id,
                    'name'       => $o->name,
                    'employee_id'=> $o->employee_id,
                    'section_id' => $o->section_id,
                ]),
            'operations' => MachiningOperation::active()->orderBy('category')->orderBy('name')
                ->get(['id', 'name', 'category', 'default_unit']),
        ]);
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'work_order_id'           => 'required|exists:work_orders,id',
            'steps'                   => 'required|array|min:1',
            'steps.*.operation_name'  => 'required|string',
            'steps.*.operation_id'    => 'nullable|exists:machining_operations,id',
            'steps.*.section_id'      => 'nullable|exists:sections,id',
            'steps.*.machine_id'      => 'nullable|exists:machines,id',
            'steps.*.operator_id'     => 'nullable|exists:operators,id',
            'steps.*.estimated_hours' => 'required|numeric|min:0',
            'steps.*.tooling_notes'   => 'nullable|string',
        ]);

        $workOrder   = WorkOrder::findOrFail($validated['work_order_id']);
        $sheetNumber = $this->service->generateSheetNumber($workOrder);

        $sheet = $workOrder->operationSheets()->create([
            'sheet_number' => $sheetNumber,
            'qr_code'      => $workOrder->wo_number . '-' . $sheetNumber,
        ]);

        foreach ($validated['steps'] as $index => $stepData) {
            $sheet->steps()->create([
                'sequence'         => $index + 1,
                'operation_name'   => $stepData['operation_name'],
                'operation_id'     => $stepData['operation_id'] ?? null,
                'section_id'       => $stepData['section_id'] ?? null,
                'machine_id'       => $stepData['machine_id'] ?? null,
                'operator_id'      => $stepData['operator_id'] ?? null,
                'estimated_hours'  => $stepData['estimated_hours'],
                'tooling_notes'    => $stepData['tooling_notes'] ?? null,
                'status'           => 'pending',
            ]);
        }

        // Try to release WO to shops
        PcdReleaseService::tryRelease($workOrder->fresh());

        return redirect()->route('operation-sheets.show', $sheet)->with('success', 'Operation sheet created.');
    }

    public function show(OperationSheet $sheet)
    {
        $sheet->load(['workOrder.product', 'workOrder.customer', 'steps.machine.workCentre', 'steps.assignment.operator']);
        $qrCode = $this->service->generateQrImage($sheet->qr_code);

        return Inertia::render('OperationSheet/Show', [
            'sheet' => [
                'id'           => $sheet->id,
                'sheet_number' => $sheet->sheet_number,
                'qr_code'      => $qrCode,
                'work_order_id'=> $sheet->work_order_id,
                'work_order'   => [
                    'wo_number' => $sheet->workOrder->wo_number ?? '',
                    'quantity'  => $sheet->workOrder->quantity ?? '',
                    'customer'  => ['name' => $sheet->workOrder->customer->name ?? ''],
                    'product'   => [
                        'name' => $sheet->workOrder->product->name ?? '',
                        'code' => $sheet->workOrder->product->code ?? '',
                        'unit' => $sheet->workOrder->product->unit ?? '',
                    ],
                ],
                'steps' => $sheet->steps->map(fn($s) => [
                    'id'              => $s->id,
                    'sequence_number' => $s->sequence,
                    'operation_name'  => $s->operation_name,
                    'machine'         => ['name' => $s->machine?->name ?? ''],
                    'estimated_hours' => $s->estimated_hours,
                    'status'          => $s->status,
                    'instructions'    => $s->instructions,
                    'assignment'      => $s->assignment ? [
                        'operator' => ['name' => $s->assignment->operator?->name ?? ''],
                    ] : null,
                ]),
            ],
        ]);
    }

    public function pdf(OperationSheet $sheet)
    {
        return $this->service->generatePdf($sheet)->download("operation-sheet-{$sheet->sheet_number}.pdf");
    }

    public function qr(OperationSheet $sheet)
    {
        $qrImage = $this->service->generateQrImage($sheet->qr_code);
        return response()->json(['qr_image' => $qrImage, 'qr_code' => $sheet->qr_code]);
    }
}
