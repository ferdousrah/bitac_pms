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

        // If sheet already exists, send the user to its edit screen
        $existing = $workOrder->operationSheets()->first();
        if ($existing) {
            return redirect()->route('operation-sheets.edit', $existing);
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
        $sheet->load(['workOrder.product', 'workOrder.customer', 'workOrder.sections.section', 'steps']);

        // Block editing once any step has started — production data is tied to step IDs.
        $hasStarted = $sheet->steps->contains(fn($s) => in_array($s->status, ['in_progress', 'completed']));
        if ($hasStarted) {
            return redirect()->route('operation-sheets.show', $sheet)
                ->with('error', 'Cannot edit: one or more steps have already started.');
        }

        $workOrder = $sheet->workOrder;

        return Inertia::render('OperationSheet/Builder', [
            'sheet' => [
                'id'           => $sheet->id,
                'sheet_number' => $sheet->sheet_number,
                'steps'        => $sheet->steps->sortBy('sequence')->values()->map(fn($s) => [
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

    public function update(Request $request, OperationSheet $sheet)
    {
        // Re-check guard server-side
        $hasStarted = $sheet->steps()->whereIn('status', ['in_progress', 'completed'])->exists();
        if ($hasStarted) {
            return back()->withErrors(['steps' => 'Cannot edit: one or more steps have already started.']);
        }

        $validated = $request->validate([
            'steps'                   => 'required|array|min:1',
            'steps.*.operation_name'  => 'required|string',
            'steps.*.operation_id'    => 'nullable|exists:machining_operations,id',
            'steps.*.section_id'      => 'nullable|exists:sections,id',
            'steps.*.machine_id'      => 'nullable|exists:machines,id',
            'steps.*.operator_id'     => 'nullable|exists:operators,id',
            'steps.*.estimated_hours' => 'required|numeric|min:0',
            'steps.*.weight_pct'      => 'nullable|numeric|min:0|max:100',
            'steps.*.tooling_notes'   => 'nullable|string',
        ]);

        $weightSum = collect($validated['steps'])->sum(fn($s) => (float) ($s['weight_pct'] ?? 0));
        if ($weightSum > 100.5) {
            return back()
                ->withErrors(['steps' => 'Step weights sum to ' . round($weightSum, 2) . '% — total cannot exceed 100%.'])
                ->withInput();
        }

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
                'estimated_hours'  => $stepData['estimated_hours'],
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
        $sheet->load(['workOrder.product', 'workOrder.customer', 'steps.machine.workCentre', 'steps.operator']);
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
                    'weight_pct'      => (float) $s->weight_pct,
                    'status'          => $s->status,
                    'instructions'    => $s->instructions,
                    'tooling_notes'   => $s->tooling_notes,
                    'qc_notes'        => $s->qc_notes,
                    'assignment'      => $s->operator ? [
                        'operator' => ['name' => $s->operator->name ?? ''],
                    ] : null,
                ]),
            ],
        ]);
    }

    public function pdf(\Illuminate\Http\Request $request, OperationSheet $sheet)
    {
        $sheet->load([
            'workOrder.product', 'workOrder.customer',
            'steps.machine.workCentre', 'steps.machine.section',
            'steps.operator', 'approvedBy.center',
        ]);

        $esc = fn($v) => htmlspecialchars((string) ($v ?? ''), ENT_QUOTES | ENT_HTML5, 'UTF-8');
        $fmt = fn($v) => $v === null || $v === '' ? '—' : number_format((float) $v, 2);

        $sheetNo   = $esc($sheet->sheet_number);
        $woNumber  = $esc($sheet->workOrder?->wo_number ?? '—');
        $product   = $esc($sheet->workOrder?->product?->name ?? '—');
        $customer  = $esc($sheet->workOrder?->customer?->name ?? '—');
        $quantity  = $sheet->workOrder?->quantity ?? 0;
        $dueDate   = $sheet->workOrder?->due_date?->format('d/m/Y') ?? '—';
        $issuedAt  = $sheet->created_at?->format('d/m/Y') ?? '';

        // Memo block — sheet no left, date right
        $memoBlock = '<table width="100%" cellspacing="0" cellpadding="0" style="margin-bottom: 14pt;">'
            . '<tr>'
            .   '<td style="font-size: 11pt; color: #000;"><span class="bn" style="font-family: siyamrupali;">নং -</span> ' . $sheetNo . '</td>'
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

        // Prepared/Approved only — anchored to the right side (BITAC convention).
        $signatureBlock = '<table width="100%" cellspacing="0" cellpadding="0" style="margin-top: 30pt;">'
            . '<tr>'
            .   '<td width="55%"></td>'
            .   '<td width="45%" style="vertical-align: bottom; text-align: left;">'
            .     '<div style="margin-bottom: 4pt;">' . $sigImg . '</div>'
            .     '<div style="border-top: 0.75pt solid #000; padding-top: 4pt; font-size: 10pt; font-weight: bold; color: #000; display: inline-block; min-width: 160pt;">Prepared / Approved By</div>'
            .     '<div style="font-size: 10pt; color: #000; margin-top: 2pt;">' . $preparerName . '</div>'
            .     ($preparerTitle  !== '' ? '<div style="font-size: 9pt; color: #4b5563; margin-top: 1pt;">' . $preparerTitle . '</div>'  : '')
            .     ($preparerCenter !== '' ? '<div style="font-size: 9pt; color: #4b5563;">' . $preparerCenter . '</div>' : '')
            .     ($preparerPhone  !== '' ? '<div style="font-size: 9pt; color: #4b5563; margin-top: 1pt;"><span class="bn" style="font-family: siyamrupali;">ফোনঃ</span> ' . $preparerPhone . '</div>' : '')
            .     ($preparerEmail  !== '' ? '<div style="font-size: 9pt; color: #4b5563;"><span class="bn" style="font-family: siyamrupali;">ই-মেইলঃ</span> ' . $preparerEmail . '</div>'  : '')
            .   '</td>'
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
