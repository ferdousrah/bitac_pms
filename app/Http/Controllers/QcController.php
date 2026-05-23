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
                'job_number'      => $q->workOrder->job_number ?? null,
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
        // Include WOs that have already cleared production: in_production, qc_hold,
        // or released_to_shops where every production-shop section is completed
        // (legacy routings that still have QC parked as the last "section").
        $workOrders = WorkOrder::whereIn('status', ['in_production', 'qc_hold', 'released_to_shops'])
            ->with(['product', 'sections.section'])
            ->get()
            ->filter(function ($wo) {
                if (in_array($wo->status, ['in_production', 'qc_hold'])) return true;
                $shopSections = $wo->sections->filter(fn($s) => $s->section?->type === 'production_shop');
                if ($shopSections->isEmpty()) return false;
                return $shopSections->every(fn($s) => in_array($s->status, ['completed', 'skipped']));
            })
            ->map(fn($wo) => [
                'id'         => $wo->id,
                'wo_number'  => $wo->wo_number,
                'job_number' => $wo->job_number,
                'product'    => $wo->product->name ?? '',
            ])
            ->values();

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
                $workOrder->update(['status' => 'ready_for_delivery']);
            }
        } elseif ($validated['result'] === 'fail') {
            $workOrder->update(['status' => 'qc_hold']);
            $this->audit->log('qc_hold', 'WorkOrder', $workOrder->id, [], [
                'message' => "QC Hold: {$workOrder->wo_number}",
            ]);
        }

        return redirect()->route('qc.show', $inspection)->with('success', 'QC inspection recorded.');
    }

    /**
     * Printable BITAC Inspection Certificate (PDF).
     *
     * Standard letterhead, bilingual title, job/customer block, full checklist
     * table with measurements + verdict per check point, overall result banner,
     * notes, and an inspector signature block (image + name + designation +
     * center + phone + email).
     */
    public function pdf(QcInspection $inspection)
    {
        $inspection->load(['workOrder.customer', 'workOrder.product', 'workOrder.rfq.items', 'inspector.center', 'checklistItems']);
        $wo = $inspection->workOrder;

        $esc = fn($v) => htmlspecialchars((string) ($v ?? ''), ENT_QUOTES | ENT_HTML5, 'UTF-8');

        $cert    = 'IC-' . str_pad($inspection->id, 5, '0', STR_PAD_LEFT);
        $woNo    = $esc($wo->wo_number ?? '—');
        $jobNo   = $esc($wo->job_number ?? '—');
        $customer= $esc($wo->customer?->name ?? '—');
        $product = $esc($wo->product?->name ?? ($wo->rfq?->items->first()?->job_description ?? '—'));
        $qty     = $esc((int) $wo->quantity);
        $insDate = $inspection->inspected_at?->format('d/m/Y') ?? '';

        $typeMap = ['incoming' => 'Incoming', 'in_process' => 'In-Process', 'final' => 'Final'];
        $insType = $typeMap[$inspection->inspection_type] ?? ucfirst($inspection->inspection_type);

        $resultMap = [
            'pass'        => ['label' => 'PASSED',          'bg' => '#d1fae5', 'border' => '#065f46', 'fg' => '#065f46'],
            'fail'        => ['label' => 'REJECTED',        'bg' => '#fee2e2', 'border' => '#991b1b', 'fg' => '#991b1b'],
            'conditional' => ['label' => 'CONDITIONAL PASS','bg' => '#fef3c7', 'border' => '#92400e', 'fg' => '#92400e'],
        ];
        $r = $resultMap[$inspection->result] ?? $resultMap['conditional'];

        // ── Memo strip ─────────────────────────────────────────────
        $memoBlock = '<table width="100%" cellspacing="0" cellpadding="0" style="margin-bottom: 14pt;">'
            . '<tr>'
            .   '<td style="font-size: 11pt; color: #000;"><span class="bn" style="font-family: siyamrupali;">নং -</span> ' . $cert . '</td>'
            .   '<td style="font-size: 11pt; color: #000; text-align: right;"><span class="bn" style="font-family: siyamrupali;">তারিখঃ</span> ' . $esc($insDate) . ' <span class="bn" style="font-family: siyamrupali;">খ্রিঃ</span></td>'
            . '</tr>'
            . '</table>';

        // ── Title ──────────────────────────────────────────────────
        $titleBlock = '<div style="text-align: center; margin-bottom: 14pt;">'
            . '<div class="bn" style="font-family: siyamrupali; font-size: 13pt; color: #000;">পরিদর্শন প্রতিবেদন</div>'
            . '<div style="font-size: 11pt; color: #000; margin-top: 1pt;">(INSPECTION CERTIFICATE)</div>'
            . '</div>';

        // ── Job / customer block ──────────────────────────────────
        $headerBlock = '<table width="100%" cellspacing="0" cellpadding="0" style="margin-bottom: 8pt; border-collapse: collapse; border: 0.75pt solid #000;">'
            . '<tr>'
            .   '<td width="50%" style="border: 0.75pt solid #000; padding: 6pt 8pt; font-size: 10pt; color: #000; vertical-align: top; line-height: 1.5;">'
            .     '<div><b>Job No:</b> ' . $jobNo . '</div>'
            .     '<div><b>WO No:</b> ' . $woNo . '</div>'
            .     '<div><b>Customer:</b> ' . $customer . '</div>'
            .   '</td>'
            .   '<td width="50%" style="border: 0.75pt solid #000; padding: 6pt 8pt; font-size: 10pt; color: #000; vertical-align: top; line-height: 1.5;">'
            .     '<div><b>Product:</b> ' . $product . '</div>'
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
                $resCfg = $resultMap[$c->result] ?? null;
                $resCell = $resCfg
                    ? '<span style="font-weight: bold; color: ' . $resCfg['fg'] . ';">' . $esc(strtoupper($c->result)) . '</span>'
                    : $esc(strtoupper($c->result));
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

        // ── Verdict + quantity summary ────────────────────────────
        $verdictBlock = '<table width="100%" cellspacing="0" cellpadding="0" style="margin-bottom: 12pt; border-collapse: collapse; border: 0.75pt solid #000;">'
            . '<tr>'
            .   '<td width="60%" style="border: 0.75pt solid #000; padding: 10pt; vertical-align: middle; font-size: 11pt; color: #000;">'
            .     '<div style="font-size: 9pt; color: #555; text-transform: uppercase; letter-spacing: 0.4pt;">Overall Verdict</div>'
            .     '<div style="margin-top: 4pt; display: inline-block; padding: 4pt 14pt; border: 1.2pt solid ' . $r['border'] . '; background: ' . $r['bg'] . '; color: ' . $r['fg'] . '; font-weight: bold; font-size: 12pt; letter-spacing: 0.6pt;">' . $r['label'] . '</div>'
            .   '</td>'
            .   '<td width="20%" style="border: 0.75pt solid #000; padding: 8pt; text-align: center; font-size: 10pt; color: #000;">'
            .     '<div style="font-size: 9pt; color: #555;">Qty Passed</div>'
            .     '<div style="font-size: 16pt; font-weight: bold; color: #065f46; margin-top: 2pt;">' . $esc((int) $inspection->qty_passed) . '</div>'
            .   '</td>'
            .   '<td width="20%" style="border: 0.75pt solid #000; padding: 8pt; text-align: center; font-size: 10pt; color: #000;">'
            .     '<div style="font-size: 9pt; color: #555;">Qty Failed</div>'
            .     '<div style="font-size: 16pt; font-weight: bold; color: #991b1b; margin-top: 2pt;">' . $esc((int) $inspection->qty_failed) . '</div>'
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
