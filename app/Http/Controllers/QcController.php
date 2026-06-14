<?php

namespace App\Http\Controllers;

use App\Models\QcInspection;
use App\Models\WorkOrder;
use App\Services\AuditService;
use App\Services\BitacLetterhead;
use Illuminate\Http\Request;
use Inertia\Inertia;

class QcController extends Controller
{
    public function __construct(private AuditService $audit) {}

    public function index(Request $request)
    {
        $query = QcInspection::with([
            'workOrder.customer', 'workOrder.items',
            'operationSheet.workOrderItem',
            'inspector',
        ]);

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
            ->through(function ($q) {
                $item = $q->operationSheet?->workOrderItem;
                $itemSeq = null;
                if ($item && $q->workOrder) {
                    $idx = $q->workOrder->items->search(fn ($i) => $i->id === $item->id);
                    $itemSeq = $idx !== false ? $idx + 1 : null;
                }
                return [
                    'id'              => $q->id,
                    'job_number'      => $q->workOrder->job_number ?? null,
                    'customer'        => $q->workOrder?->customer?->name ?? '—',
                    // Item info — null for legacy WO-wide inspections.
                    'item' => $item ? [
                        'id'          => $item->id,
                        'sequence'    => $itemSeq,
                        'description' => $item->description,
                        'quantity'    => (float) $item->quantity,
                        'unit'        => $item->unit ?? 'pcs',
                    ] : null,
                    'sheet_number'    => $q->operationSheet?->sheet_number,
                    'inspection_type' => $q->inspection_type,
                    'inspector'       => $q->inspector->name ?? '',
                    'result'          => $q->result,
                    'qty_passed'      => $q->qty_passed,
                    'qty_failed'      => $q->qty_failed,
                    'inspected_at'    => $q->inspected_at?->format('d/m/Y H:i'),
                    'work_order_id'   => $q->work_order_id,
                ];
            });

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
        // Per-Operation-Sheet (per-item) inspection. The picker lists every
        // sheet whose production-shop steps are all closed — those items are
        // physically off the floor and ready for inspection. Each item's sheet
        // is its own queue row, so Item 1 can be inspected separately from Item 2.
        $sheets = \App\Models\OperationSheet::query()
            ->whereHas('workOrder', fn ($q) => $q->whereIn('status', [
                'in_production', 'qc_hold', 'released_to_shops',
            ]))
            ->with([
                'workOrder.customer', 'workOrder.sections.section',
                'workOrderItem', 'steps.section',
            ])
            ->get()
            ->filter(function ($sheet) {
                // Sheet is "ready for QC" when every step at a production-shop
                // section is either completed or skipped. If a sheet has no
                // production-shop steps at all, treat it as ready.
                $shopSteps = $sheet->steps->filter(fn ($s) => $s->section?->type === 'production_shop');
                if ($shopSteps->isEmpty()) return true;
                return $shopSteps->every(fn ($s) => in_array($s->status, ['completed', 'skipped']));
            })
            ->values()
            ->map(function ($sheet) {
                $wo   = $sheet->workOrder;
                $item = $sheet->workOrderItem;
                $itemSeq = null;
                if ($item) {
                    $wo->loadMissing('items');
                    $idx = $wo->items->search(fn ($i) => $i->id === $item->id);
                    $itemSeq = $idx !== false ? $idx + 1 : null;
                }
                return [
                    'id'              => $sheet->id,
                    'sheet_number'    => $sheet->sheet_number,
                    'work_order_id'   => $wo->id,
                    'job_number'      => $wo->job_number,
                    'customer'        => $wo->customer?->name ?? '—',
                    'item' => $item ? [
                        'id'          => $item->id,
                        'sequence'    => $itemSeq,
                        'description' => $item->description,
                        'quantity'    => (float) $item->quantity,
                        'unit'        => $item->unit ?? 'pcs',
                    ] : null,
                ];
            });

        $preselected = null;
        if ($sheetId = $request->query('operation_sheet_id')) {
            $preselected = $sheets->firstWhere('id', (int) $sheetId);
        } elseif ($woId = $request->query('work_order_id')) {
            // Legacy ?work_order_id=X param — pre-select the first matching sheet.
            $preselected = $sheets->firstWhere('work_order_id', (int) $woId);
        }

        // Default checkpoints — admins manage these from Master Data.
        $checkpoints = \App\Models\QcCheckpoint::active()
            ->orderBy('display_order')
            ->orderBy('name')
            ->get(['id', 'name', 'category']);

        return Inertia::render('QC/Create', [
            'sheets'       => $sheets,
            'preselected'  => $preselected,
            'checkpoints'  => $checkpoints,
        ]);
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            // Per-OperationSheet inspection. operation_sheet_id is now the
            // primary anchor; work_order_id is derived from the sheet and kept
            // on the row for back-compat with downstream queries.
            'operation_sheet_id' => 'required|exists:operation_sheets,id',
            'inspection_type'    => 'required|in:incoming,in_process,final',
            // Qty Passed / Failed dropped from the form — kept nullable here so
            // legacy clients posting them still work.
            'qty_passed'         => 'nullable|integer|min:0',
            'qty_failed'         => 'nullable|integer|min:0',
            'result'             => 'required|in:pass,fail,conditional',
            'notes'              => 'nullable|string',
            'checklist'          => 'nullable|array',
        ]);

        $sheet     = \App\Models\OperationSheet::with('workOrder')->findOrFail($validated['operation_sheet_id']);
        $workOrder = $sheet->workOrder;

        $inspection = QcInspection::create([
            'work_order_id'      => $workOrder->id,
            'operation_sheet_id' => $sheet->id,
            'inspector_id'       => auth()->id(),
            'inspection_type'    => $validated['inspection_type'],
            'qty_passed'         => $validated['qty_passed'] ?? 0,
            'qty_failed'         => $validated['qty_failed'] ?? 0,
            'result'             => $validated['result'],
            'notes'              => $validated['notes'],
            'inspected_at'       => now(),
        ]);

        foreach ($validated['checklist'] ?? [] as $item) {
            $inspection->checklistItems()->create([
                'check_point' => $item['name'],
                'result'      => $item['result'],
                'remarks'     => $item['remarks'] ?? null,
            ]);
        }

        // Per-item QC: WO transitions to qc_passed only when EVERY operation
        // sheet has a passing final inspection. One item failing pulls the
        // whole WO to qc_hold. This delays delivery until the entire batch
        // is verified — matches BITAC's single-batch dispatch policy.
        $previousStatus = $workOrder->status;
        $this->reconcileWorkOrderStatus($workOrder);
        $workOrder = $workOrder->fresh();

        if ($validated['result'] === 'pass' && $workOrder->status === 'qc_passed' && $previousStatus !== 'qc_passed') {
            \App\Services\CustomerNotifyService::workOrderStateChanged($workOrder->fresh('customer'), $previousStatus);
            $this->audit->log('qc_passed', 'WorkOrder', $workOrder->id, [], [
                'message' => "QC Passed: {$workOrder->wo_number}",
            ]);

            // Close any open / in-rework NCRs for this WO. Their reworks have
            // produced parts that passed QC, so the loop is resolved. Any
            // ReworkOrder rows still 'open' on those NCRs get closed too.
            $openNcrs = \App\Models\Ncr::where('work_order_id', $workOrder->id)
                ->whereIn('status', ['open', 'in_rework'])
                ->get();
            foreach ($openNcrs as $ncr) {
                $ncr->reworkOrders()->where('status', 'open')->update(['status' => 'completed']);
                $ncr->update(['status' => 'closed']);
                $this->audit->log('ncr_closed', 'Ncr', $ncr->id, [], [
                    'message' => "NCR {$ncr->ncr_number} closed automatically — QC re-inspection passed.",
                ]);

                // Customer complaints linked to this NCR auto-resolve too.
                $linkedComplaints = \App\Models\CustomerComplaint::where('linked_ncr_id', $ncr->id)
                    ->whereNotIn('status', ['resolved', 'closed'])
                    ->get();
                foreach ($linkedComplaints as $cc) {
                    $cc->update([
                        'status'   => 'resolved',
                        'response' => ($cc->response ? $cc->response . "\n\n" : '')
                                      . 'Rework completed and QC verified on ' . now()->format('d M Y') . '. Re-dispatch will follow.',
                        'responded_at' => now(),
                        'responded_by' => auth()->id(),
                    ]);
                    try {
                        if ($cc->customer && method_exists($cc->customer, 'notifications')) {
                            $cc->customer->notifications()->create([
                                'type'  => 'complaint_resolved',
                                'title' => 'Your complaint has been resolved',
                                'body'  => "Complaint {$cc->reference_number}: rework finished and QC passed. Re-dispatch will follow.",
                                'link'  => "/customer/complaints/{$cc->id}",
                                'icon'  => 'fi-rr-comment-check',
                                'color' => 'green',
                            ]);
                        }
                    } catch (\Throwable $e) { /* skip */ }
                }
            }

            // If any NCR on this WO was complaint-driven, also pre-create a
            // draft Delivery Order so staff just need to confirm + dispatch.
            // Use the complaint's affected_qty (partial) instead of full WO qty.
            $latestComplaint = \App\Models\CustomerComplaint::where('work_order_id', $workOrder->id)
                ->whereNotNull('linked_ncr_id')
                ->latest('accepted_at')
                ->first();
            $hasOpenDelivery = $workOrder->deliveryOrders()
                ->whereIn('status', ['scheduled', 'draft'])->exists();
            if ($latestComplaint && !$hasOpenDelivery) {
                $year    = now()->year;
                $count   = \App\Models\DeliveryOrder::whereYear('created_at', $year)->count();
                $dispatchQty = $latestComplaint->affected_qty ?? (int) $workOrder->quantity;
                \App\Models\DeliveryOrder::create([
                    'work_order_id'      => $workOrder->id,
                    'customer_id'        => $workOrder->customer_id,
                    'quantity_delivered' => $dispatchQty,
                    'scheduled_date'     => now()->addDays(2),
                    'delivery_address'   => $workOrder->customer?->address,
                    'notes'              => "Auto-drafted after complaint-driven rework ({$latestComplaint->reference_number}). "
                                            . "Dispatching {$dispatchQty} reworked unit(s). Confirm vehicle + driver before dispatch.",
                    'challan_number'     => 'CH-' . $year . '-' . str_pad($count + 1, 4, '0', STR_PAD_LEFT),
                    'status'             => 'scheduled',
                ]);
                $previous = $workOrder->status;
                $workOrder->update(['status' => 'ready_for_delivery']);
                \App\Services\CustomerNotifyService::workOrderStateChanged($workOrder->fresh('customer'), $previous);
            }
        } elseif ($validated['result'] === 'fail' && $workOrder->fresh()->status === 'qc_hold') {
            $this->audit->log('qc_hold', 'WorkOrder', $workOrder->id, [], [
                'message' => "QC Hold: {$workOrder->wo_number} (item failed inspection)",
            ]);
        }

        return redirect()->route('qc.show', $inspection)->with('success', 'QC inspection recorded.');
    }

    /**
     * Reconcile WO status from the per-sheet (per-item) final inspections.
     *   - Every sheet has a passing final inspection → qc_passed
     *   - Any sheet has a failing final inspection (and not yet re-passed) → qc_hold
     *   - Otherwise leaves status alone (in_production / qc_hold remain)
     */
    private function reconcileWorkOrderStatus(WorkOrder $workOrder): void
    {
        $workOrder->loadMissing(['operationSheets']);
        $sheets = $workOrder->operationSheets;
        if ($sheets->isEmpty()) return;

        // Latest final inspection per sheet drives the verdict — re-inspection
        // after rework supersedes the older fail.
        $verdictPerSheet = [];
        foreach ($sheets as $sheet) {
            $final = $sheet->qcInspections()
                ->where('inspection_type', 'final')
                ->orderByDesc('inspected_at')
                ->first();
            $verdictPerSheet[$sheet->id] = $final?->result; // null if never inspected
        }

        $allPass = !empty($verdictPerSheet)
            && collect($verdictPerSheet)->every(fn ($r) => in_array($r, ['pass', 'conditional']));
        $anyFail = collect($verdictPerSheet)->contains('fail');

        if ($allPass && $workOrder->status !== 'qc_passed') {
            $workOrder->update(['status' => 'qc_passed']);
        } elseif ($anyFail && $workOrder->status !== 'qc_hold') {
            $workOrder->update(['status' => 'qc_hold']);
        }
    }

    /**
     * Printable BITAC Inspection Certificate (PDF).
     *
     * Standard letterhead, bilingual title, job/customer block, full checklist
     * table with measurements + verdict per check point, overall result banner,
     * notes, and an inspector signature block (image + name + designation +
     * center + phone + email).
     */
    /**
     * Toggle whether the inspection certificate is visible in the customer portal.
     * Stores who toggled it and when, so we have an audit trail.
     */
    public function toggleShare(QcInspection $inspection)
    {
        $newState = ! (bool) $inspection->shared_with_customer;
        $inspection->update([
            'shared_with_customer' => $newState,
            'shared_at'            => $newState ? now() : null,
            'shared_by'            => $newState ? auth()->id() : null,
        ]);

        return back()->with('success', $newState
            ? 'Inspection certificate is now visible in the customer portal.'
            : 'Inspection certificate hidden from the customer portal.');
    }

    public function pdf(QcInspection $inspection)
    {
        $inspection->load([
            'workOrder.customer', 'workOrder.items',
            'operationSheet.workOrderItem',
            'inspector.center', 'checklistItems',
        ]);
        $wo   = $inspection->workOrder;
        $item = $inspection->operationSheet?->workOrderItem;

        $esc = fn($v) => htmlspecialchars((string) ($v ?? ''), ENT_QUOTES | ENT_HTML5, 'UTF-8');

        $cert    = 'IC-' . str_pad($inspection->id, 5, '0', STR_PAD_LEFT);
        $jobNo   = $esc($wo->job_number ?? '—');
        $customer= $esc($wo->customer?->name ?? '—');
        // Per-item: product = the item description (e.g. "DEMU Brake Cylinder
        // Body — Cast Iron..."), qty = the item's qty (12 pcs), not the WO total.
        if ($item) {
            $product = $esc($item->description ?? '—');
            $qty     = $esc(rtrim(rtrim(number_format((float) $item->quantity, 2, '.', ''), '0'), '.') . ' ' . ($item->unit ?? ''));
            $itemSeq = $wo->items->search(fn ($i) => $i->id === $item->id);
            $itemSeqLabel = $itemSeq !== false ? ('Item ' . ($itemSeq + 1)) : null;
        } else {
            $product = $esc($wo->product?->name ?? '—');
            $qty     = $esc((int) $wo->quantity);
            $itemSeqLabel = null;
        }
        $insDate = $inspection->inspected_at?->format('d/m/Y') ?? '';

        $typeMap = ['incoming' => 'Incoming', 'in_process' => 'In-Process', 'final' => 'Final'];
        $insType = $typeMap[$inspection->inspection_type] ?? ucfirst($inspection->inspection_type);

        $resultMap = [
            'pass'        => ['label' => 'OK',     'bg' => '#d1fae5', 'border' => '#065f46', 'fg' => '#065f46'],
            'fail'        => ['label' => 'NOT OK', 'bg' => '#fee2e2', 'border' => '#991b1b', 'fg' => '#991b1b'],
            'conditional' => ['label' => 'N/A',    'bg' => '#fef3c7', 'border' => '#92400e', 'fg' => '#92400e'],
        ];
        $r = $resultMap[$inspection->result] ?? $resultMap['conditional'];

        // ── Memo strip (English labels) ────────────────────────────
        $memoBlock = '<table width="100%" cellspacing="0" cellpadding="0" style="margin-bottom: 14pt;">'
            . '<tr>'
            .   '<td style="font-size: 11pt; color: #000;"><b>No.:</b> ' . $cert . '</td>'
            .   '<td style="font-size: 11pt; color: #000; text-align: right;"><b>Date:</b> ' . $esc($insDate) . '</td>'
            . '</tr>'
            . '</table>';

        // ── Title (English only) ───────────────────────────────────
        $titleBlock = '<div style="text-align: center; margin-bottom: 14pt;">'
            . '<div style="font-size: 14pt; font-weight: bold; color: #000; letter-spacing: 1pt;">INSPECTION CERTIFICATE</div>'
            . '</div>';

        // Customer Work Order # (the customer's own PO/WO reference, if any).
        $customerWo = $esc($wo->customer_po_no ?? '—');
        // Item label = "Item N — description" when item is present.
        $itemDisplay = $itemSeqLabel
            ? ($esc($itemSeqLabel) . ($product !== '—' ? ' — ' . $product : ''))
            : $product;

        // ── Job / customer block ──────────────────────────────────
        $headerBlock = '<table width="100%" cellspacing="0" cellpadding="0" style="margin-bottom: 8pt; border-collapse: collapse; border: 0.75pt solid #000;">'
            . '<tr>'
            .   '<td width="50%" style="border: 0.75pt solid #000; padding: 6pt 8pt; font-size: 10pt; color: #000; vertical-align: top; line-height: 1.55;">'
            .     '<div><b>Job No:</b> ' . $jobNo . '</div>'
            .     '<div><b>Customer:</b> ' . $customer . '</div>'
            .     '<div><b>Customer WO #:</b> ' . $customerWo . '</div>'
            .     '<div><b>Date:</b> ' . $esc($insDate) . '</div>'
            .   '</td>'
            .   '<td width="50%" style="border: 0.75pt solid #000; padding: 6pt 8pt; font-size: 10pt; color: #000; vertical-align: top; line-height: 1.55;">'
            .     '<div><b>Item:</b> ' . $itemDisplay . '</div>'
            .     '<div><b>Inspection Type:</b> ' . $esc($insType) . '</div>'
            .     '<div><b>Total Quantity:</b> ' . $qty . '</div>'
            .   '</td>'
            . '</tr>'
            . '</table>';

        // ── Checklist table ───────────────────────────────────────
        $rows = '';
        $checks = $inspection->checklistItems;
        if ($checks->isEmpty()) {
            $rows = '<tr><td colspan="4" style="border: 0.75pt solid #000; padding: 14pt; text-align: center; color: #555; font-style: italic; font-size: 10pt;">No specific checkpoints were recorded — see overall notes below.</td></tr>';
        } else {
            foreach ($checks as $i => $c) {
                // 'na' maps to the same N/A styling as 'conditional' on the overall result.
                $verdictLabel = match ($c->result) {
                    'pass' => 'OK',
                    'fail' => 'NOT OK',
                    'na', 'conditional' => 'N/A',
                    default => strtoupper((string) $c->result),
                };
                $cfgKey = $c->result === 'na' ? 'conditional' : $c->result;
                $resCfg = $resultMap[$cfgKey] ?? null;
                $resCell = $resCfg
                    ? '<span style="font-weight: bold; color: ' . $resCfg['fg'] . ';">' . $esc($verdictLabel) . '</span>'
                    : $esc($verdictLabel);
                $rows .= '<tr>'
                    . '<td style="border: 0.75pt solid #000; padding: 5pt 6pt; text-align: center; font-size: 10pt; color: #000;">' . str_pad($i + 1, 2, '0', STR_PAD_LEFT) . '</td>'
                    . '<td style="border: 0.75pt solid #000; padding: 5pt 8pt; font-size: 10pt; color: #000;">' . $esc($c->check_point) . '</td>'
                    . '<td style="border: 0.75pt solid #000; padding: 5pt 6pt; text-align: center; font-size: 10pt;">' . $resCell . '</td>'
                    . '<td style="border: 0.75pt solid #000; padding: 5pt 8pt; font-size: 10pt; color: #000;">' . $esc($c->remarks ?? '') . '</td>'
                    . '</tr>';
            }
        }

        $checklistBlock = '<table width="100%" cellspacing="0" cellpadding="0" style="margin-bottom: 10pt; border-collapse: collapse;">'
            . '<thead><tr style="background: #f3f4f6;">'
            .   '<th width="8%"  style="border: 0.75pt solid #000; padding: 6pt; font-size: 10pt; color: #000;">SL</th>'
            .   '<th             style="border: 0.75pt solid #000; padding: 6pt; font-size: 10pt; color: #000; text-align: left;">Checkpoint / Specification</th>'
            .   '<th width="14%" style="border: 0.75pt solid #000; padding: 6pt; font-size: 10pt; color: #000;">Result</th>'
            .   '<th width="32%" style="border: 0.75pt solid #000; padding: 6pt; font-size: 10pt; color: #000; text-align: left;">Measurement / Remarks</th>'
            . '</tr></thead>'
            . '<tbody>' . $rows . '</tbody>'
            . '</table>';

        // ── Verdict footer — two cells: label | result chip ───────
        $verdictBlock = '<table width="100%" cellspacing="0" cellpadding="0" style="margin-bottom: 12pt; border-collapse: collapse; border: 0.75pt solid #000;">'
            . '<tr>'
            .   '<td width="55%" style="border: 0.75pt solid #000; padding: 14pt 16pt; vertical-align: middle; font-size: 12pt; font-weight: bold; color: #000; text-transform: uppercase; letter-spacing: 1pt;">'
            .     'Overall Verdict'
            .   '</td>'
            .   '<td width="45%" style="border: 0.75pt solid #000; padding: 14pt; text-align: center; vertical-align: middle;">'
            .     '<span style="display: inline-block; padding: 6pt 22pt; border: 1.5pt solid ' . $r['border'] . '; background: ' . $r['bg'] . '; color: ' . $r['fg'] . '; font-weight: bold; font-size: 16pt; letter-spacing: 1.2pt;">' . $r['label'] . '</span>'
            .   '</td>'
            . '</tr>'
            . '</table>';

        // ── Notes ─────────────────────────────────────────────────
        $notesBlock = '';
        if (trim((string) $inspection->notes) !== '') {
            $notesBlock = '<div style="margin-bottom: 12pt; padding: 8pt 10pt; border: 0.75pt solid #000; font-size: 10pt; color: #000;">'
                . '<div style="font-weight: bold; margin-bottom: 4pt;">Inspector Notes</div>'
                . '<div style="white-space: pre-line;">' . nl2br($esc($inspection->notes), false) . '</div>'
                . '</div>';
        }

        // ── Inspector signature block ─────────────────────────────
        $inspector = $inspection->inspector;
        $sigImg = '';
        if ($inspector && method_exists($inspector, 'signatureAbsolutePath')) {
            $sigPath = $inspector->signatureAbsolutePath();
            if ($sigPath) {
                $sigImg = '<img src="file://' . str_replace('\\', '/', $sigPath) . '" style="max-height: 40pt; max-width: 140pt;" alt="signature" />';
            }
        }
        $signatureBlock = '<table width="100%" cellspacing="0" cellpadding="0" style="margin-top: 22pt;">'
            . '<tr>'
            .   '<td width="50%" style="font-size: 10pt; color: #000; vertical-align: bottom;">'
            .     '<div style="min-height: 50pt;">' . $sigImg . '</div>'
            .     '<div style="border-top: 0.75pt solid #000; padding-top: 4pt; margin-top: 2pt;">'
            .       '<div style="font-weight: bold;">' . $esc($inspector?->name ?? '—') . '</div>'
            .       '<div style="color: #444;">' . $esc($inspector?->designation ?? 'Quality Inspector') . '</div>'
            .       '<div style="color: #555; font-size: 9pt;">BITAC ' . $esc($inspector?->center?->name ?? '') . '</div>'
            .       ($inspector?->phone ? '<div style="color: #555; font-size: 9pt;">Phone: ' . $esc($inspector->phone) . '</div>' : '')
            .       ($inspector?->email ? '<div style="color: #555; font-size: 9pt;">Email: ' . $esc($inspector->email) . '</div>' : '')
            .     '</div>'
            .   '</td>'
            .   '<td width="50%" style="font-size: 10pt; color: #000; vertical-align: bottom; text-align: center;">'
            .     '<div style="min-height: 50pt;"></div>'
            .     '<div style="border-top: 0.75pt solid #000; padding-top: 4pt; margin-top: 2pt; display: inline-block; min-width: 60%;">'
            .       '<div style="font-weight: bold;">Authorized Signatory</div>'
            .       '<div style="color: #555; font-size: 9pt;">QC Department</div>'
            .     '</div>'
            .   '</td>'
            . '</tr>'
            . '</table>';

        $body = $memoBlock . $titleBlock . $headerBlock . $checklistBlock . $verdictBlock . $notesBlock . $signatureBlock;

        $bytes = app(BitacLetterhead::class)->render($body, "Inspection Certificate {$cert}");

        return response($bytes, 200, [
            'Content-Type'        => 'application/pdf',
            'Content-Disposition' => 'inline; filename="' . $cert . '.pdf"',
        ]);
    }

    public function show(QcInspection $inspection)
    {
        $inspection->load([
            'workOrder.customer', 'workOrder.items',
            'operationSheet.workOrderItem',
            'inspector', 'checklistItems', 'ncrs', 'sharedBy',
        ]);
        $hasNcr = $inspection->ncrs->isNotEmpty();

        $item = $inspection->operationSheet?->workOrderItem;
        $itemSeq = null;
        if ($item && $inspection->workOrder) {
            $idx = $inspection->workOrder->items->search(fn ($i) => $i->id === $item->id);
            $itemSeq = $idx !== false ? $idx + 1 : null;
        }

        return Inertia::render('QC/Result', [
            'inspection' => [
                'id'              => $inspection->id,
                'job_number'      => $inspection->workOrder->job_number ?? null,
                'customer'        => $inspection->workOrder?->customer?->name,
                'item' => $item ? [
                    'id'          => $item->id,
                    'sequence'    => $itemSeq,
                    'description' => $item->description,
                    'quantity'    => (float) $item->quantity,
                    'unit'        => $item->unit ?? 'pcs',
                ] : null,
                'sheet_number'    => $inspection->operationSheet?->sheet_number,
                'inspection_type' => $inspection->inspection_type,
                'result'          => $inspection->result,
                'qty_passed'      => $inspection->qty_passed,
                'qty_failed'      => $inspection->qty_failed,
                'inspector'       => $inspection->inspector->name ?? '',
                'inspected_at'    => $inspection->inspected_at?->format('d M Y H:i'),
                'work_order_id'   => $inspection->work_order_id,
                'has_ncr'         => $hasNcr,
                'notes'           => $inspection->notes,
                'shared_with_customer' => (bool) $inspection->shared_with_customer,
                'shared_at'       => $inspection->shared_at?->format('d M Y, H:i'),
                'shared_by'       => $inspection->sharedBy?->name,
                'checklist_items' => $inspection->checklistItems->map(fn($c) => [
                    'id'          => $c->id,
                    'check_point' => $c->check_point,
                    'result'      => $c->result,
                    'remarks'     => $c->remarks,
                ]),
            ],
        ]);
    }

    /**
     * Combined Job-level QC Certificate. Becomes available once every operation
     * sheet (one per item) has a passing final inspection — i.e. the WO has
     * transitioned to `qc_passed`. Renders a single multi-item certificate
     * suitable for handing to the customer with the delivery.
     */
    public function jobCertificate(\Illuminate\Http\Request $request, WorkOrder $workOrder)
    {
        $workOrder->load([
            'customer', 'items',
            'operationSheets.workOrderItem',
            'operationSheets.qcInspections.checklistItems',
            'operationSheets.qcInspections.inspector.center',
        ]);

        // Each sheet's latest final inspection (the verdict that mattered).
        $perItem = [];
        foreach ($workOrder->operationSheets as $sheet) {
            $final = $sheet->qcInspections
                ->where('inspection_type', 'final')
                ->sortByDesc('inspected_at')
                ->first();
            if (!$final) continue;
            $perItem[] = [
                'sheet'      => $sheet,
                'item'       => $sheet->workOrderItem,
                'inspection' => $final,
            ];
        }

        if (empty($perItem)) {
            abort(404, 'No final inspections recorded for this job yet.');
        }

        // Gate: every item must have a passing final inspection.
        $allOk = collect($perItem)->every(fn ($row) => in_array($row['inspection']->result, ['pass', 'conditional']));
        if (!$allOk) {
            abort(422, 'Not all items have passed final inspection yet — QC certificate not available.');
        }

        $esc = fn ($v) => htmlspecialchars((string) ($v ?? ''), ENT_QUOTES | ENT_HTML5, 'UTF-8');

        $jobNo    = $esc($workOrder->job_number ?? '—');
        $customer = $esc($workOrder->customer?->name ?? '—');
        $custPo   = $esc($workOrder->customer_po_no ?? '');
        $issued   = now()->format('d M Y');
        $certNo   = 'QCC-' . str_pad((string) $workOrder->id, 5, '0', STR_PAD_LEFT) . '-' . now()->format('Ymd');

        // Title
        $titleBlock = '<div style="text-align: center; margin-bottom: 14pt;">'
            . '<div style="font-size: 15pt; font-weight: bold; color: #000; letter-spacing: 1pt;">JOB QC CERTIFICATE</div>'
            . '<div style="font-size: 9pt; color: #555; margin-top: 2pt;">Issued upon successful final inspection of every item under this job.</div>'
            . '</div>';

        // Job header
        $headerHtml = '<table width="100%" cellspacing="0" cellpadding="0" style="border-collapse: collapse; border: 0.75pt solid #000; margin-bottom: 14pt;">'
            . '<tr>'
            .   '<td style="border: 0.75pt solid #000; padding: 5pt 8pt; font-size: 10pt; width: 50%;"><b>Certificate No:</b> ' . $esc($certNo) . '</td>'
            .   '<td style="border: 0.75pt solid #000; padding: 5pt 8pt; font-size: 10pt;"><b>Date Issued:</b> ' . $esc($issued) . '</td>'
            . '</tr>'
            . '<tr>'
            .   '<td style="border: 0.75pt solid #000; padding: 5pt 8pt; font-size: 10pt;"><b>Job No:</b> ' . $jobNo . '</td>'
            .   '<td style="border: 0.75pt solid #000; padding: 5pt 8pt; font-size: 10pt;"><b>Customer:</b> ' . $customer . '</td>'
            . '</tr>'
            . ($custPo !== ''
                ? '<tr><td colspan="2" style="border: 0.75pt solid #000; padding: 5pt 8pt; font-size: 10pt;"><b>Customer PO:</b> ' . $custPo . '</td></tr>'
                : '')
            . '</table>';

        // Per-item summary table
        $summary = '<div style="font-size: 11pt; font-weight: bold; color: #000; margin-bottom: 6pt;">Item-wise Inspection Summary</div>';
        $summary .= '<table width="100%" cellspacing="0" cellpadding="0" style="border-collapse: collapse; border: 0.75pt solid #000; margin-bottom: 14pt;">'
            . '<thead><tr style="background: #f3f4f6;">'
            .   '<th style="border: 0.75pt solid #000; padding: 5pt; font-size: 9.5pt; width: 8%;">Item</th>'
            .   '<th style="border: 0.75pt solid #000; padding: 5pt; font-size: 9.5pt;">Description</th>'
            .   '<th style="border: 0.75pt solid #000; padding: 5pt; font-size: 9.5pt; width: 10%;">Qty</th>'
            .   '<th style="border: 0.75pt solid #000; padding: 5pt; font-size: 9.5pt; width: 16%;">Inspection</th>'
            .   '<th style="border: 0.75pt solid #000; padding: 5pt; font-size: 9.5pt; width: 12%;">Date</th>'
            .   '<th style="border: 0.75pt solid #000; padding: 5pt; font-size: 9.5pt; width: 12%;">Result</th>'
            . '</tr></thead><tbody>';
        foreach ($perItem as $idx => $row) {
            $item = $row['item'];
            $ins  = $row['inspection'];
            $resultLabel = match ($ins->result) {
                'pass' => 'OK',
                'fail' => 'NOT OK',
                'conditional' => 'N/A',
                default => strtoupper((string) $ins->result),
            };
            $resultColor = $ins->result === 'pass' ? '#065f46' : ($ins->result === 'fail' ? '#991b1b' : '#92400e');
            $itemSeq = $workOrder->items->search(fn ($i) => $i->id === $item?->id);
            $itemLabel = $itemSeq !== false ? ('Item ' . ($itemSeq + 1)) : '—';
            $itemQty = $item
                ? (rtrim(rtrim(number_format((float) $item->quantity, 2, '.', ''), '0'), '.') . ' ' . ($item->unit ?? ''))
                : '—';
            $summary .= '<tr>'
                . '<td style="border: 0.75pt solid #000; padding: 5pt; font-size: 9.5pt; text-align: center;">' . $esc($itemLabel) . '</td>'
                . '<td style="border: 0.75pt solid #000; padding: 5pt 6pt; font-size: 9.5pt;">' . $esc($item?->description ?? '—') . '</td>'
                . '<td style="border: 0.75pt solid #000; padding: 5pt; font-size: 9.5pt; text-align: center;">' . $esc($itemQty) . '</td>'
                . '<td style="border: 0.75pt solid #000; padding: 5pt; font-size: 9pt; text-align: center; font-family: dejavusansmono;">IC-' . str_pad((string) $ins->id, 5, '0', STR_PAD_LEFT) . '</td>'
                . '<td style="border: 0.75pt solid #000; padding: 5pt; font-size: 9pt; text-align: center;">' . $esc($ins->inspected_at?->format('d/m/Y') ?? '—') . '</td>'
                . '<td style="border: 0.75pt solid #000; padding: 5pt; font-size: 10pt; text-align: center; font-weight: bold; color: ' . $resultColor . ';">' . $esc($resultLabel) . '</td>'
                . '</tr>';
        }
        $summary .= '</tbody></table>';

        // Declaration
        $declaration = '<div style="padding: 10pt 12pt; border: 0.75pt solid #000; background: #f9fafb; margin-bottom: 24pt;">'
            . '<div style="font-size: 10.5pt; color: #000; line-height: 1.55;">'
            . 'This is to certify that all the items manufactured/processed under Job No. <b>' . $jobNo . '</b> for '
            . '<b>' . $customer . '</b> have been inspected and tested as per the applicable specifications and quality standards '
            . 'of <b>BITAC</b>, and are hereby <span style="font-weight: bold; color: #065f46;">accepted (OK)</span> '
            . 'for delivery.'
            . '</div>'
            . '</div>';

        // Signature block — pick the inspector who signed the latest final inspection.
        $latestInspector = collect($perItem)
            ->sortByDesc(fn ($r) => $r['inspection']->inspected_at)
            ->first()['inspection']->inspector ?? null;
        $sigImg = '';
        if ($latestInspector && $latestInspector->signature_path) {
            $sigPath = storage_path('app/public/' . ltrim($latestInspector->signature_path, '/'));
            if (is_file($sigPath)) {
                $sigImg = '<img src="file://' . str_replace('\\', '/', $sigPath) . '" style="max-height: 36pt; max-width: 80%;" />';
            }
        }
        $signatureBlock = '<table width="100%" cellspacing="0" cellpadding="0" style="margin-top: 24pt;">'
            . '<tr>'
            .   '<td width="50%" style="vertical-align: bottom; padding-right: 12pt; text-align: center;">'
            .     '<div style="min-height: 40pt;">' . $sigImg . '</div>'
            .     '<div style="border-top: 0.75pt solid #000; padding-top: 4pt; font-size: 10pt; font-weight: bold;">Inspector</div>'
            .     ($latestInspector ? '<div style="font-size: 9.5pt; margin-top: 1pt;">' . $esc($latestInspector->name) . '</div>' : '')
            .     ($latestInspector?->designation ? '<div style="font-size: 8.5pt; color: #555;">' . $esc($latestInspector->designation) . '</div>' : '')
            .   '</td>'
            .   '<td width="50%" style="vertical-align: bottom; padding-left: 12pt; text-align: center;">'
            .     '<div style="min-height: 40pt;">&nbsp;</div>'
            .     '<div style="border-top: 0.75pt solid #000; padding-top: 4pt; font-size: 10pt; font-weight: bold;">Approved By (QC Head)</div>'
            .   '</td>'
            . '</tr>'
            . '</table>';

        $bodyHtml = $titleBlock . $headerHtml . $summary . $declaration . $signatureBlock;
        $bytes = app(\App\Services\BitacLetterhead::class)->render($bodyHtml, "Job QC Certificate {$workOrder->job_number}", null, 'en');
        $filename = "qc-certificate-job-{$workOrder->job_number}.pdf";

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
}
