<?php

namespace App\Http\Controllers;

use App\Models\MachiningOperation;
use App\Models\Machine;
use App\Models\OperationSheet;
use App\Models\Operator;
use App\Models\Section;
use App\Models\User;
use App\Models\WorkOrder;
use App\Models\WorkOrderItem;
use App\Services\OperationSheetService;
use App\Services\PcdReleaseService;
use Illuminate\Http\Request;
use Inertia\Inertia;

class OperationSheetController extends Controller
{
    public function __construct(private OperationSheetService $service) {}

    public function index(Request $request)
    {
        $query = OperationSheet::with(['workOrder.customer', 'workOrder.product', 'workOrder.items', 'workOrderItem', 'steps']);

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
            ->through(function ($s) {
                $itemSeq = null;
                if ($s->workOrderItem && $s->workOrder) {
                    $idx = $s->workOrder->items->search(fn ($i) => $i->id === $s->workOrderItem->id);
                    $itemSeq = $idx !== false ? $idx + 1 : null;
                }
                return [
                    'id'           => $s->id,
                    'sheet_number' => $s->sheet_number,
                    'work_order'   => $s->workOrder ? [
                        'id'         => $s->workOrder->id,
                        'wo_number'  => $s->workOrder->wo_number,
                        'job_number' => $s->workOrder->job_number,
                        'customer'   => $s->workOrder->customer?->name,
                        'product'    => $s->workOrder->product?->name,
                    ] : null,
                    'item'         => $s->workOrderItem ? [
                        'id'          => $s->workOrderItem->id,
                        'sequence'    => $itemSeq,
                        'description' => $s->workOrderItem->description,
                    ] : null,
                    'step_count'   => $s->steps->count(),
                    'created_at'   => $s->created_at->format('d M Y'),
                ];
            });

        return Inertia::render('OperationSheet/Index', [
            'sheets' => $sheets,
            'filters' => [
                'search' => $request->input('search', ''),
                'sort'   => $sort,
                'dir'    => $dir,
            ],
        ]);
    }

    public function create(Request $request, WorkOrder $workOrder)
    {
        $workOrder->load(['product', 'customer', 'sections.section', 'items']);

        // Item-wise: caller must specify which WO item this sheet is for.
        // If no item is selected (and the WO has items), bounce to JobDetail
        // where the per-item creator surface lives.
        $itemId = $request->integer('item_id') ?: null;
        if (!$itemId && $workOrder->items->isNotEmpty()) {
            return redirect()->route('pcd.inbox.show', $workOrder)
                ->with('error', 'Pick an item to create its Operation Sheet.');
        }

        $item = $itemId
            ? $workOrder->items->firstWhere('id', $itemId)
            : null;

        if ($itemId && !$item) {
            abort(404, 'Item not found on this work order.');
        }

        // If a sheet for this WO+item combo already exists, jump to edit.
        $existing = OperationSheet::where('work_order_id', $workOrder->id)
            ->where('work_order_item_id', $itemId)
            ->first();
        if ($existing) {
            return redirect()->route('operation-sheets.edit', $existing);
        }

        // Auto "as per drawing / sample / drawing and sample" derived from the
        // RFQ item's attached references — pre-fills the Instruction field.
        $defaultInstruction = '';
        if ($item) {
            $item->loadMissing('rfqItem.drawings', 'rfqItem.samplePhotos');
            $ref = $item->rfqItem;
            $hasDrawing = $ref && $ref->drawings->isNotEmpty();
            $hasSample  = $ref && $ref->samplePhotos->isNotEmpty();
            $defaultInstruction = $hasDrawing && $hasSample
                ? 'as per drawing and sample'
                : ($hasDrawing ? 'as per drawing' : ($hasSample ? 'as per sample' : ''));
        }

        return Inertia::render('OperationSheet/Builder', [
            'defaultInstruction' => $defaultInstruction,
            'workOrder' => [
                'id'         => $workOrder->id,
                'wo_number'  => $workOrder->wo_number,
                'job_number' => $workOrder->job_number,
                'product'    => $workOrder->product->name ?? '',
                'customer'   => $workOrder->customer?->name,
                'quantity'   => $workOrder->quantity,
                // Only production-shop sections appear in the Op Sheet builder.
                // QC and other functional stops (IED/PCD/Stores) live in the WO
                // routing for visibility but aren't "operations" the planner picks
                // — QC inspections happen on the dedicated /qc page after production.
                'assigned_sections' => $workOrder->sections
                    ->filter(fn($s) => $s->section?->type === 'production_shop')
                    ->values()
                    ->map(fn($s) => [
                        'id'         => $s->section_id,
                        'name'       => $s->section->name,
                        'code'       => $s->section->code,
                        'sequence'   => $s->sequence,
                    ]),
            ],
            'item'       => $item ? [
                'id'          => $item->id,
                'description' => $item->description,
                'quantity'    => (float) $item->quantity,
                'unit'        => $item->unit ?? 'pcs',
                'sequence'    => $workOrder->items->search(fn ($i) => $i->id === $item->id) + 1,
            ] : null,
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
            // Item-wise sheet — required when WO has items, optional for legacy
            // WOs with no items table (rare; we still allow NULL there).
            'work_order_item_id'      => 'nullable|exists:work_order_items,id',
            // BITAC header fields — Job Title inherits from item description
            // by default but PCD can override; Job Description + Material are
            // free-form notes the planner fills in.
            'job_title'               => 'nullable|string|max:250',
            'job_description'         => 'nullable|string|max:5000',
            'material'                => 'nullable|string|max:200',
            'steps'                   => 'required|array|min:1',
            'steps.*.operation_name'  => 'required|string',
            'steps.*.operation_id'    => 'nullable|exists:machining_operations,id',
            'steps.*.section_id'      => 'nullable|exists:sections,id',
            'steps.*.machine_id'      => 'nullable|exists:machines,id',
            'steps.*.operator_id'     => 'nullable|exists:operators,id',
            'steps.*.estimated_hours' => 'nullable|numeric|min:0',
            'steps.*.weight_pct'      => 'nullable|numeric|min:0|max:100',
            'steps.*.tooling_notes'   => 'nullable|string',
            'steps.*.qc_notes'        => 'nullable|string|max:500',
        ]);

        // Sanity-warn if step weights don't sum to ~100. We don't hard-fail —
        // PCD officer may save a partial sheet and balance later.
        $weightSum = collect($validated['steps'])->sum(fn($s) => (float) ($s['weight_pct'] ?? 0));
        if ($weightSum > 100.5) {
            return back()
                ->withErrors(['steps' => 'Step weights sum to ' . round($weightSum, 2) . '% — total cannot exceed 100%.'])
                ->withInput();
        }

        $workOrder = WorkOrder::with('items')->findOrFail($validated['work_order_id']);
        $itemId    = $validated['work_order_item_id'] ?? null;

        // Reject if no item picked when the WO actually has items.
        if (!$itemId && $workOrder->items->isNotEmpty()) {
            return back()
                ->withErrors(['work_order_item_id' => 'Select which item this operation sheet belongs to.'])
                ->withInput();
        }

        // Reject duplicate sheet for the same WO+item combination.
        $duplicate = OperationSheet::where('work_order_id', $workOrder->id)
            ->where('work_order_item_id', $itemId)
            ->exists();
        if ($duplicate) {
            return back()
                ->withErrors(['work_order_item_id' => 'An operation sheet for this item already exists.'])
                ->withInput();
        }

        $sheetNumber = $this->service->generateSheetNumber($workOrder, $itemId);

        // Default Job Title from the item description if PCD didn't override it.
        $item = $itemId ? $workOrder->items->firstWhere('id', $itemId) : null;
        $jobTitle = trim((string) ($validated['job_title'] ?? '')) !== ''
            ? $validated['job_title']
            : ($item?->description ?? null);

        $sheet = $workOrder->operationSheets()->create([
            'work_order_item_id' => $itemId,
            'sheet_number'       => $sheetNumber,
            'job_title'          => $jobTitle,
            'job_description'    => $validated['job_description'] ?? null,
            'material'           => $validated['material'] ?? null,
            // Whoever submits this form is the "Prepared By" on the printed sheet.
            'created_by'         => auth()->id(),
            // QR identifier keyed off Job number — WO numbers don't appear from op-sheet onward.
            'qr_code'            => 'JOB-' . ($workOrder->job_number ?? $workOrder->id) . '-' . $sheetNumber,
        ]);

        foreach ($validated['steps'] as $index => $stepData) {
            $sheet->steps()->create([
                'sequence'         => $index + 1,
                'operation_name'   => $stepData['operation_name'],
                'operation_id'     => $stepData['operation_id'] ?? null,
                'section_id'       => $stepData['section_id'] ?? null,
                'machine_id'       => $stepData['machine_id'] ?? null,
                'operator_id'      => $stepData['operator_id'] ?? null,
                'estimated_hours'  => $stepData['estimated_hours'] ?? 0,
                'weight_pct'       => (float) ($stepData['weight_pct'] ?? 0),
                'tooling_notes'    => $stepData['tooling_notes'] ?? null,
                'qc_notes'         => $stepData['qc_notes'] ?? null,
                'status'           => 'pending',
            ]);
        }

        // Try to release WO to shops
        PcdReleaseService::tryRelease($workOrder->fresh());

        return redirect()->route('operation-sheets.show', $sheet)->with('success', 'Operation sheet created.');
    }

    public function edit(OperationSheet $sheet)
    {
        $sheet->load(['workOrder.product', 'workOrder.customer', 'workOrder.sections.section', 'workOrder.items', 'workOrderItem', 'steps']);

        // Block editing once any step has started — production data is tied to step IDs.
        $hasStarted = $sheet->steps->contains(fn($s) => in_array($s->status, ['in_progress', 'completed']));
        if ($hasStarted) {
            return redirect()->route('operation-sheets.show', $sheet)
                ->with('error', 'Cannot edit: one or more steps have already started.');
        }

        $workOrder = $sheet->workOrder;

        return Inertia::render('OperationSheet/Builder', [
            'sheet' => [
                'id'              => $sheet->id,
                'sheet_number'    => $sheet->sheet_number,
                'job_title'       => $sheet->job_title,
                'job_description' => $sheet->job_description,
                'material'        => $sheet->material,
                'steps'           => $sheet->steps->sortBy('sequence')->values()->map(fn($s) => [
                    'id'              => $s->id,
                    'operation_id'    => $s->operation_id,
                    'operation_name'  => $s->operation_name,
                    'section_id'      => $s->section_id,
                    'machine_id'      => $s->machine_id,
                    'operator_id'     => $s->operator_id,
                    'estimated_hours' => (string) $s->estimated_hours,
                    'weight_pct'      => (string) $s->weight_pct,
                    'tooling_notes'   => $s->tooling_notes ?? '',
                ]),
            ],
            'workOrder' => [
                'id'         => $workOrder->id,
                'wo_number'  => $workOrder->wo_number,
                'job_number' => $workOrder->job_number,
                'product'    => $workOrder->product->name ?? '',
                'customer'   => $workOrder->customer?->name,
                'quantity'   => $workOrder->quantity,
                // Production shops only — QC and other functional stops are
                // excluded from the Op Sheet (QC happens via /qc, separately).
                'assigned_sections' => $workOrder->sections
                    ->filter(fn($s) => $s->section?->type === 'production_shop')
                    ->values()
                    ->map(fn($s) => [
                        'id'         => $s->section_id,
                        'name'       => $s->section->name,
                        'code'       => $s->section->code,
                        'sequence'   => $s->sequence,
                    ]),
            ],
            'item' => $sheet->workOrderItem ? [
                'id'          => $sheet->workOrderItem->id,
                'description' => $sheet->workOrderItem->description,
                'quantity'    => (float) $sheet->workOrderItem->quantity,
                'unit'        => $sheet->workOrderItem->unit ?? 'pcs',
                'sequence'    => $workOrder->items->search(fn ($i) => $i->id === $sheet->workOrderItem->id) + 1,
            ] : null,
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

    public function update(Request $request, OperationSheet $sheet)
    {
        // Re-check guard server-side
        $hasStarted = $sheet->steps()->whereIn('status', ['in_progress', 'completed'])->exists();
        if ($hasStarted) {
            return back()->withErrors(['steps' => 'Cannot edit: one or more steps have already started.']);
        }

        $validated = $request->validate([
            'job_title'               => 'nullable|string|max:250',
            'job_description'         => 'nullable|string|max:5000',
            'material'                => 'nullable|string|max:200',
            'steps'                   => 'required|array|min:1',
            'steps.*.operation_name'  => 'required|string',
            'steps.*.operation_id'    => 'nullable|exists:machining_operations,id',
            'steps.*.section_id'      => 'nullable|exists:sections,id',
            'steps.*.machine_id'      => 'nullable|exists:machines,id',
            'steps.*.operator_id'     => 'nullable|exists:operators,id',
            'steps.*.estimated_hours' => 'nullable|numeric|min:0',
            'steps.*.weight_pct'      => 'nullable|numeric|min:0|max:100',
            'steps.*.tooling_notes'   => 'nullable|string',
        ]);

        $weightSum = collect($validated['steps'])->sum(fn($s) => (float) ($s['weight_pct'] ?? 0));
        if ($weightSum > 100.5) {
            return back()
                ->withErrors(['steps' => 'Step weights sum to ' . round($weightSum, 2) . '% — total cannot exceed 100%.'])
                ->withInput();
        }

        // Persist the BITAC header edits alongside the step refresh.
        $sheet->update([
            'job_title'       => $validated['job_title'] ?? $sheet->job_title,
            'job_description' => $validated['job_description'] ?? null,
            'material'        => $validated['material'] ?? null,
        ]);

        // Wipe and recreate steps (safe because no step has started)
        $sheet->steps()->delete();
        foreach ($validated['steps'] as $index => $stepData) {
            $sheet->steps()->create([
                'sequence'         => $index + 1,
                'operation_name'   => $stepData['operation_name'],
                'operation_id'     => $stepData['operation_id'] ?? null,
                'section_id'       => $stepData['section_id'] ?? null,
                'machine_id'       => $stepData['machine_id'] ?? null,
                'operator_id'      => $stepData['operator_id'] ?? null,
                'estimated_hours'  => $stepData['estimated_hours'] ?? 0,
                'weight_pct'       => (float) ($stepData['weight_pct'] ?? 0),
                'tooling_notes'    => $stepData['tooling_notes'] ?? null,
                'status'           => 'pending',
            ]);
        }

        return redirect()->route('operation-sheets.show', $sheet)
            ->with('success', 'Operation sheet updated.');
    }

    public function show(OperationSheet $sheet)
    {
        $sheet->load(['workOrder.product', 'workOrder.customer', 'steps.machine.workCentre', 'steps.section']);
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
                    'job_number'=> $sheet->workOrder->job_number,
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
                    'section'         => ['name' => $s->section?->name ?? ''],
                    'machine'         => [
                        'name'        => $s->machine?->name ?? '',
                        // Nest the work centre so the Show page can read
                        // step.machine.work_centre.name (it was missing before).
                        'work_centre' => $s->machine?->workCentre ? [
                            'name' => $s->machine->workCentre->name,
                        ] : null,
                    ],
                    'estimated_hours' => $s->estimated_hours,
                    'weight_pct'      => (float) $s->weight_pct,
                    'status'          => $s->status,
                    // tooling_notes is the actual column for the planner's notes
                    // (the legacy 'instructions' field never existed). Surface it
                    // under 'notes' so the UI label can read cleanly.
                    'notes'           => $s->tooling_notes,
                    'qc_notes'        => $s->qc_notes,
                ]),
            ],
        ]);
    }

    public function pdf(\Illuminate\Http\Request $request, OperationSheet $sheet)
    {
        // BITAC paper format — delegated to the service so the same layout is
        // reusable. Header rows use the new job_title / job_description / material
        // fields; routing table uses ক্রঃ নং | কার্য বিন্যাস | সেকশন | মন্তব্য.
        $bytes    = $this->service->generatePdf($sheet);
        $filename = "operation-sheet-{$sheet->sheet_number}.pdf";

        if ($request->query('preview') === 'base64') {
            return response()->json([
                'filename' => $filename,
                'size'     => strlen($bytes),
                'data'     => base64_encode($bytes),
            ]);
        }

        $disposition = $request->boolean('preview') ? 'inline' : 'attachment';
        return response($bytes, 200, [
            'Content-Type'        => 'application/pdf',
            'Content-Disposition' => $disposition . '; filename="' . $filename . '"',
            'Content-Length'      => strlen($bytes),
        ]);
    }

    /** @deprecated kept temporarily so any external references don't break. */
    private function legacyInlinePdfBuilder(\Illuminate\Http\Request $request, OperationSheet $sheet)
    {
        $sheet->load([
            'workOrder.product', 'workOrder.customer',
            'steps.machine.workCentre', 'steps.machine.section',
            'steps.operator', 'approvedBy.center',
        ]);

        $esc = fn($v) => htmlspecialchars((string) ($v ?? ''), ENT_QUOTES | ENT_HTML5, 'UTF-8');
        $fmt = fn($v) => $v === null || $v === '' ? '—' : number_format((float) $v, 2);

        $sheetNo   = $esc($sheet->sheet_number);
        $jobNumber = $esc($sheet->workOrder?->job_number ?? $sheet->sheet_number);
        $woNumber  = $esc($sheet->workOrder?->wo_number ?? '—');
        $product   = $esc($sheet->workOrder?->product?->name ?? '—');
        $customer  = $esc($sheet->workOrder?->customer?->name ?? '—');
        $quantity  = $sheet->workOrder?->quantity ?? 0;
        $dueDate   = $sheet->workOrder?->due_date?->format('d/m/Y') ?? '—';
        $issuedAt  = $sheet->created_at?->format('d/m/Y') ?? '';

        // Memo block — sheet no left, date right
        $memoBlock = '<table width="100%" cellspacing="0" cellpadding="0" style="margin-bottom: 14pt;">'
            . '<tr>'
            .   '<td style="font-size: 11pt; color: #000;"><span class="bn" style="font-family: siyamrupali;">জব নম্বরঃ</span> ' . $jobNumber . '</td>'
            .   '<td style="font-size: 11pt; color: #000; text-align: right;"><span class="bn" style="font-family: siyamrupali;">তারিখঃ</span> ' . $esc($issuedAt) . ' <span class="bn" style="font-family: siyamrupali;">খ্রিঃ</span></td>'
            . '</tr>'
            . '</table>';

        // Centered title — কাজের তালিকা / (OPERATION SHEET)
        $titleBlock = '<div style="text-align: center; margin-bottom: 14pt;">'
            . '<div class="bn" style="font-family: siyamrupali; font-size: 13pt; color: #000;">কাজের তালিকা</div>'
            . '<div style="font-size: 11pt; color: #000; margin-top: 1pt;">(OPERATION SHEET)</div>'
            . '</div>';

        // Job header block — two columns
        $headerBlock = '<table width="100%" cellspacing="0" cellpadding="0" style="margin-bottom: 8pt; border-collapse: collapse; border: 0.75pt solid #000;">'
            . '<tr>'
            .   '<td width="50%" style="border: 0.75pt solid #000; padding: 6pt 8pt; font-size: 10pt; color: #000; vertical-align: top; line-height: 1.5;">'
            .     '<div><b>WO No:</b> ' . $woNumber . '</div>'
            .     '<div><b>Product:</b> ' . $product . '</div>'
            .     '<div><b>Quantity:</b> ' . $esc($fmt($quantity)) . ' pcs</div>'
            .   '</td>'
            .   '<td width="50%" style="border: 0.75pt solid #000; padding: 6pt 8pt; font-size: 10pt; color: #000; vertical-align: top; line-height: 1.5;">'
            .     '<div><b>Customer:</b> ' . $customer . '</div>'
            .     '<div><b>Due Date:</b> ' . $esc($dueDate) . '</div>'
            .     '<div><b>Total Steps:</b> ' . $sheet->steps->count() . ' · <b>Est. Hours:</b> ' . $esc($fmt((float) $sheet->steps->sum('estimated_hours'))) . '</div>'
            .   '</td>'
            . '</tr>'
            . '</table>';

        // Operation Steps table
        $stepsHtml  = '<table width="100%" cellspacing="0" cellpadding="0" style="border-collapse: collapse; border: 0.75pt solid #000; margin-top: 4pt; table-layout: fixed;">';
        $stepsHtml .= '<colgroup>'
            . '<col style="width: 5%;" />'
            . '<col style="width: 22%;" />'
            . '<col style="width: 16%;" />'
            . '<col style="width: 14%;" />'
            . '<col style="width: 15%;" />'
            . '<col style="width: 8%;" />'
            . '<col style="width: 20%;" />'
            . '</colgroup>';
        $stepsHtml .= '<tr>';
        $stepsHtml .=   '<th style="border: 0.75pt solid #000; padding: 4pt 2pt; font-size: 9pt; font-weight: normal; text-align: center;">Seq</th>';
        $stepsHtml .=   '<th style="border: 0.75pt solid #000; padding: 4pt; font-size: 9pt; font-weight: normal; text-align: center;">Operation</th>';
        $stepsHtml .=   '<th style="border: 0.75pt solid #000; padding: 4pt; font-size: 9pt; font-weight: normal; text-align: center;">Machine</th>';
        $stepsHtml .=   '<th style="border: 0.75pt solid #000; padding: 4pt; font-size: 9pt; font-weight: normal; text-align: center;">Work Centre</th>';
        $stepsHtml .=   '<th style="border: 0.75pt solid #000; padding: 4pt; font-size: 9pt; font-weight: normal; text-align: center;">Operator</th>';
        $stepsHtml .=   '<th style="border: 0.75pt solid #000; padding: 4pt 2pt; font-size: 9pt; font-weight: normal; text-align: center;">Est. Hrs</th>';
        $stepsHtml .=   '<th style="border: 0.75pt solid #000; padding: 4pt; font-size: 9pt; font-weight: normal; text-align: center;">Sign-off</th>';
        $stepsHtml .= '</tr>';

        if ($sheet->steps->isEmpty()) {
            $stepsHtml .= '<tr><td colspan="7" style="border: 0.75pt solid #000; padding: 10pt; text-align: center; font-style: italic; font-size: 10pt;">No steps defined</td></tr>';
        } else {
            foreach ($sheet->steps as $i => $step) {
                $sl = str_pad((string)($i + 1), 2, '0', STR_PAD_LEFT);
                $stepsHtml .= '<tr>';
                $stepsHtml .=   '<td style="border: 0.75pt solid #000; padding: 6pt 2pt; font-size: 10pt; text-align: center; vertical-align: middle;">' . $sl . '</td>';
                $stepsHtml .=   '<td style="border: 0.75pt solid #000; padding: 6pt 6pt; font-size: 10pt; font-weight: bold; vertical-align: top;">'
                              . $esc($step->operation_name)
                              . ($step->instructions ? '<div style="font-size: 8.5pt; color: #4b5563; font-weight: normal; margin-top: 2pt; line-height: 1.3;">' . nl2br($esc($step->instructions), false) . '</div>' : '')
                              . '</td>';
                $stepsHtml .=   '<td style="border: 0.75pt solid #000; padding: 6pt 4pt; font-size: 9pt; vertical-align: top;">' . $esc($step->machine?->name ?? '—') . '</td>';
                $stepsHtml .=   '<td style="border: 0.75pt solid #000; padding: 6pt 4pt; font-size: 9pt; vertical-align: top;">' . $esc($step->machine?->workCentre?->name ?? '—') . '</td>';
                $stepsHtml .=   '<td style="border: 0.75pt solid #000; padding: 6pt 4pt; font-size: 9pt; vertical-align: top;">' . $esc($step->operator?->name ?? '—') . '</td>';
                $stepsHtml .=   '<td style="border: 0.75pt solid #000; padding: 6pt 2pt; font-size: 10pt; text-align: right; vertical-align: middle; white-space: nowrap;">' . $fmt($step->estimated_hours) . '</td>';
                $stepsHtml .=   '<td style="border: 0.75pt solid #000; padding: 6pt 4pt; font-size: 9pt; color: #94a3b8; font-style: italic; vertical-align: top;">Date &amp; sign</td>';
                $stepsHtml .= '</tr>';
            }
        }
        $stepsHtml .= '</table>';

        // ─── Signature block — Prepared / Approved only ───
        $preparer    = $sheet->approvedBy ?? auth()->user();
        $preparerSig = $preparer?->signatureAbsolutePath();
        $preparerName   = $esc($preparer?->name ?? '—');
        $preparerTitle  = $esc($preparer?->designation ?? '');
        $preparerCenter = $esc($preparer?->center?->name ?? '');
        $preparerPhone  = $esc($preparer?->phone ?? '');
        $preparerEmail  = $esc($preparer?->email ?? '');

        $sigImg = $preparerSig
            ? '<img src="' . $preparerSig . '" style="height: 40pt; max-width: 150pt;" alt="signature" />'
            : '<div style="height: 40pt;"></div>';

        // Prepared/Approved — anchored to the left side per the user's preference.
        $signatureBlock = '<table width="100%" cellspacing="0" cellpadding="0" style="margin-top: 30pt;">'
            . '<tr>'
            .   '<td width="45%" style="vertical-align: bottom; text-align: left;">'
            .     '<div style="margin-bottom: 4pt;">' . $sigImg . '</div>'
            .     '<div style="border-top: 0.75pt solid #000; padding-top: 4pt; font-size: 10pt; font-weight: bold; color: #000; display: inline-block; min-width: 160pt;">Prepared / Approved By</div>'
            .     '<div style="font-size: 10pt; color: #000; margin-top: 2pt;">' . $preparerName . '</div>'
            .     ($preparerTitle  !== '' ? '<div style="font-size: 9pt; color: #4b5563; margin-top: 1pt;">' . $preparerTitle . '</div>'  : '')
            .     ($preparerCenter !== '' ? '<div style="font-size: 9pt; color: #4b5563;">' . $preparerCenter . '</div>' : '')
            .     ($preparerPhone  !== '' ? '<div style="font-size: 9pt; color: #4b5563; margin-top: 1pt;"><span class="bn" style="font-family: siyamrupali;">ফোনঃ</span> ' . $preparerPhone . '</div>' : '')
            .     ($preparerEmail  !== '' ? '<div style="font-size: 9pt; color: #4b5563;"><span class="bn" style="font-family: siyamrupali;">ই-মেইলঃ</span> ' . $preparerEmail . '</div>'  : '')
            .   '</td>'
            .   '<td width="55%"></td>'
            . '</tr>'
            . '</table>';

        $bodyHtml = <<<HTML
        {$memoBlock}
        {$titleBlock}
        {$headerBlock}
        {$stepsHtml}
        {$signatureBlock}
HTML;

        $bytes    = app(\App\Services\BitacLetterhead::class)->render($bodyHtml, "Operation Sheet {$sheet->sheet_number}");
        $filename = "operation-sheet-{$sheet->sheet_number}.pdf";

        if ($request->query('preview') === 'base64') {
            return response()->json([
                'filename' => $filename,
                'size'     => strlen($bytes),
                'data'     => base64_encode($bytes),
            ]);
        }

        $disposition = $request->boolean('preview') ? 'inline' : 'attachment';
        return response($bytes, 200, [
            'Content-Type'        => 'application/pdf',
            'Content-Disposition' => $disposition . '; filename="' . $filename . '"',
            'Content-Length'      => strlen($bytes),
        ]);
    }

    public function qr(OperationSheet $sheet)
    {
        $qrImage = $this->service->generateQrImage($sheet->qr_code);
        return response()->json(['qr_image' => $qrImage, 'qr_code' => $sheet->qr_code]);
    }
}
