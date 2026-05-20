<?php

namespace App\Http\Controllers\Ied;

use App\Http\Controllers\Controller;
use App\Models\GatePass;
use App\Models\Rfq;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Inertia\Inertia;

class GatePassController extends Controller
{
    public function index(Request $request)
    {
        $query = GatePass::with(['rfq.customer', 'issuedBy', 'items'])
            ->latest('pass_date')
            ->latest('id');

        if ($search = $request->input('search')) {
            $digits = preg_replace('/\D/', '', $search);
            $query->where(function ($q) use ($search, $digits) {
                $q->where('pass_no', 'like', "%{$search}%")
                  ->orWhere('customer_rep_name', 'like', "%{$search}%")
                  ->orWhereHas('rfq.customer', fn($c) => $c->where('name', 'like', "%{$search}%"));
                if ($digits !== '') {
                    $q->orWhereHas('rfq', fn($r) => $r->where('id', 'like', "%{$digits}%"));
                }
            });
        }
        if ($direction = $request->input('direction')) $query->where('direction', $direction);
        if ($status    = $request->input('status'))    $query->where('status',    $status);

        return Inertia::render('Ied/GatePass/Index', [
            'passes' => $query->paginate(20)->through(fn($p) => [
                'id'              => $p->id,
                'pass_no'         => $p->pass_no,
                'direction'       => $p->direction,
                'rfq_id'          => $p->rfq_id,
                'customer'        => $p->rfq?->customer?->name,
                'customer_rep'    => $p->customer_rep_name,
                'pass_date'       => $p->pass_date?->format('d/m/Y'),
                'item_count'      => $p->items->count(),
                'status'          => $p->status,
                'issued_by'       => $p->issuedBy?->name,
            ]),
            'filters' => [
                'search'    => $request->input('search', ''),
                'direction' => $request->input('direction', ''),
                'status'    => $request->input('status', ''),
            ],
        ]);
    }

    public function create(Request $request)
    {
        $rfqId     = $request->query('rfq_id');
        $direction = $request->query('direction', 'in');

        if (!in_array($direction, ['in', 'out'], true)) {
            abort(422, 'Invalid direction.');
        }

        $rfq = $rfqId
            ? Rfq::with(['customer', 'items.product'])->findOrFail($rfqId)
            : null;

        // Pre-fill items from the RFQ — preparer can edit/remove before issuing.
        // For Gate-Out, condition note placeholder differs ("returned condition").
        $prefilledItems = $rfq
            ? $rfq->items->map(fn($i) => [
                'rfq_item_id'    => $i->id,
                'description'    => $i->job_description ?? $i->product?->name ?? '—',
                'quantity'       => (float) $i->quantity,
                'unit'           => $i->unit ?? 'pcs',
                'condition_note' => $direction === 'in' ? ($i->sample_description ?? '') : '',
            ])->values()
            : collect();

        return Inertia::render('Ied/GatePass/Form', [
            'rfq' => $rfq ? [
                'id'           => $rfq->id,
                'customer'     => $rfq->customer?->name,
                'customer_ref' => $rfq->customer_ref_no,
            ] : null,
            'direction'        => $direction,
            'prefilled_items'  => $prefilledItems,
            'pass'             => null,
        ]);
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'rfq_id'                   => 'nullable|exists:rfqs,id',
            'direction'                => 'required|in:in,out',
            'pass_date'                => 'required|date',
            'customer_rep_name'        => 'nullable|string|max:120',
            'customer_rep_phone'       => 'nullable|string|max:40',
            'customer_rep_id_number'   => 'nullable|string|max:60',
            'vehicle_no'               => 'nullable|string|max:40',
            'notes'                    => 'nullable|string|max:1000',
            'items'                    => 'required|array|min:1',
            'items.*.rfq_item_id'      => 'nullable|exists:rfq_items,id',
            'items.*.description'      => 'required|string|max:500',
            'items.*.quantity'         => 'required|numeric|min:0.01',
            'items.*.unit'             => 'nullable|string|max:20',
            'items.*.condition_note'   => 'nullable|string|max:500',
            'signature'                => 'nullable|string', // base64 data URL
        ]);

        $pass = DB::transaction(function () use ($validated, $request) {
            $pass = GatePass::create([
                'rfq_id'                  => $validated['rfq_id'] ?? null,
                'pass_no'                 => GatePass::generatePassNo($validated['direction']),
                'direction'               => $validated['direction'],
                'pass_date'               => $validated['pass_date'],
                'customer_rep_name'       => $validated['customer_rep_name'] ?? null,
                'customer_rep_phone'      => $validated['customer_rep_phone'] ?? null,
                'customer_rep_id_number'  => $validated['customer_rep_id_number'] ?? null,
                'vehicle_no'              => $validated['vehicle_no'] ?? null,
                'notes'                   => $validated['notes'] ?? null,
                'issued_by'               => auth()->id(),
                'issued_at'               => now(),
                'status'                  => 'issued',
            ]);

            foreach ($validated['items'] as $idx => $row) {
                $pass->items()->create([
                    'rfq_item_id'    => $row['rfq_item_id'] ?? null,
                    'description'    => $row['description'],
                    'quantity'       => $row['quantity'],
                    'unit'           => $row['unit'] ?? 'pcs',
                    'condition_note' => $row['condition_note'] ?? null,
                    'sort_order'     => $idx,
                ]);
            }

            // Capture the inline-drawn issuer signature, if any. Falls back to
            // user.signature_path at PDF-render time.
            $sigPath = $this->persistSignature($pass, $validated['signature'] ?? null);
            if ($sigPath) $pass->update(['issuer_signature_path' => $sigPath]);

            return $pass;
        });

        return redirect()->route('ied.gate-passes.show', $pass)
            ->with('success', "Gate Pass {$pass->pass_no} issued.");
    }

    public function show(GatePass $gatePass)
    {
        $gatePass->load(['rfq.customer', 'issuedBy.center', 'items.rfqItem']);

        return Inertia::render('Ied/GatePass/Show', [
            'pass' => [
                'id'                     => $gatePass->id,
                'pass_no'                => $gatePass->pass_no,
                'direction'              => $gatePass->direction,
                'rfq_id'                 => $gatePass->rfq_id,
                'rfq_customer'           => $gatePass->rfq?->customer?->name,
                'rfq_customer_ref'       => $gatePass->rfq?->customer_ref_no,
                'pass_date'              => $gatePass->pass_date?->format('d/m/Y'),
                'customer_rep_name'      => $gatePass->customer_rep_name,
                'customer_rep_phone'     => $gatePass->customer_rep_phone,
                'customer_rep_id_number' => $gatePass->customer_rep_id_number,
                'vehicle_no'             => $gatePass->vehicle_no,
                'notes'                  => $gatePass->notes,
                'status'                 => $gatePass->status,
                'issued_by'              => $gatePass->issuedBy?->name,
                'issued_at'              => $gatePass->issued_at?->format('d M Y, H:i'),
                'items'                  => $gatePass->items->map(fn($i) => [
                    'id'             => $i->id,
                    'description'    => $i->description,
                    'quantity'       => (float) $i->quantity,
                    'unit'           => $i->unit,
                    'condition_note' => $i->condition_note,
                ])->values(),
                'pdf_url'                => "/ied/gate-passes/{$gatePass->id}/pdf?preview=base64",
            ],
        ]);
    }

    public function cancel(Request $request, GatePass $gatePass)
    {
        abort_unless($gatePass->status === 'issued', 422, 'Only issued passes can be cancelled.');
        $gatePass->update(['status' => 'cancelled']);
        return back()->with('success', "Gate Pass {$gatePass->pass_no} cancelled.");
    }

    public function pdf(Request $request, GatePass $gatePass)
    {
        $gatePass->load(['rfq.customer', 'issuedBy.center', 'items']);

        $esc = fn($v) => htmlspecialchars((string) ($v ?? ''), ENT_QUOTES | ENT_HTML5, 'UTF-8');
        $fmt = fn($v) => number_format((float) ($v ?? 0), 2);

        $directionLabel = $gatePass->direction === 'in' ? 'GATE-IN PASS' : 'GATE-OUT PASS';
        $directionBn    = $gatePass->direction === 'in' ? 'প্রবেশ পত্র'    : 'বহির্গমন পত্র';
        $customer       = $esc($gatePass->rfq?->customer?->name ?? '—');
        $customerRef    = $esc($gatePass->rfq?->customer_ref_no ?? '—');
        $rfqLabel       = $gatePass->rfq_id ? 'RFQ #' . $gatePass->rfq_id : '—';
        $issuerName     = $esc($gatePass->issuedBy?->name ?? '—');
        $issuerTitle    = $esc($gatePass->issuedBy?->designation ?? '');
        $issuerCenter   = $esc($gatePass->issuedBy?->center?->name ?? '');
        $sigPath        = $gatePass->signatureAbsolutePath()
                        ?? $gatePass->issuedBy?->signatureAbsolutePath();

        // Memo block — top-left pass no, top-right date
        $memoBlock = '<table width="100%" cellspacing="0" cellpadding="0" style="margin-bottom: 14pt;">'
            . '<tr>'
            .   '<td style="font-size: 11pt; color: #000;"><span class="bn" style="font-family: siyamrupali;">নং -</span> ' . $esc($gatePass->pass_no) . '</td>'
            .   '<td style="font-size: 11pt; color: #000; text-align: right;"><span class="bn" style="font-family: siyamrupali;">তারিখঃ</span> ' . $esc($gatePass->pass_date?->format('d/m/Y') ?? '') . ' <span class="bn" style="font-family: siyamrupali;">খ্রিঃ</span></td>'
            . '</tr>'
            . '</table>';

        // Centered title
        $titleBlock = '<div style="text-align: center; margin-bottom: 14pt;">'
            . '<div class="bn" style="font-family: siyamrupali; font-size: 13pt; color: #000;">' . $directionBn . '</div>'
            . '<div style="font-size: 11pt; color: #000; margin-top: 1pt;">(' . $directionLabel . ')</div>'
            . '</div>';

        // Two-column meta block
        $metaBlock = '<table width="100%" cellspacing="0" cellpadding="0" style="margin-bottom: 8pt; border-collapse: collapse; border: 0.75pt solid #000;">'
            . '<tr>'
            .   '<td width="50%" style="border: 0.75pt solid #000; padding: 6pt 8pt; font-size: 10pt; color: #000; vertical-align: top; line-height: 1.5;">'
            .     '<div><b>Customer:</b> ' . $customer . '</div>'
            .     '<div><b>Customer Ref:</b> ' . $customerRef . '</div>'
            .     '<div><b>RFQ:</b> ' . $esc($rfqLabel) . '</div>'
            .   '</td>'
            .   '<td width="50%" style="border: 0.75pt solid #000; padding: 6pt 8pt; font-size: 10pt; color: #000; vertical-align: top; line-height: 1.5;">'
            .     '<div><b>Customer Rep:</b> ' . $esc($gatePass->customer_rep_name ?? '—') . '</div>'
            .     '<div><b>Phone:</b> ' . $esc($gatePass->customer_rep_phone ?? '—') . '</div>'
            .     '<div><b>ID No / Vehicle:</b> ' . $esc($gatePass->customer_rep_id_number ?? '') . ($gatePass->vehicle_no ? ' / ' . $esc($gatePass->vehicle_no) : '') . '</div>'
            .   '</td>'
            . '</tr>'
            . '</table>';

        // Items table
        $itemsHtml  = '<table width="100%" cellspacing="0" cellpadding="0" style="border-collapse: collapse; border: 0.75pt solid #000; margin-top: 4pt; table-layout: fixed;">';
        $itemsHtml .= '<colgroup><col style="width: 6%;" /><col style="width: 52%;" /><col style="width: 10%;" /><col style="width: 8%;" /><col style="width: 24%;" /></colgroup>';
        $itemsHtml .= '<tr>';
        $itemsHtml .=   '<th style="border: 0.75pt solid #000; padding: 4pt 2pt; font-size: 9pt; font-weight: normal; text-align: center;"><span class="bn" style="font-family: siyamrupali;">ক্র.নং</span><br>(Sl. No)</th>';
        $itemsHtml .=   '<th style="border: 0.75pt solid #000; padding: 4pt; font-size: 9pt; font-weight: normal; text-align: center;"><span class="bn" style="font-family: siyamrupali;">দ্রব্যাদির বিবরণ</span><br>(Description)</th>';
        $itemsHtml .=   '<th style="border: 0.75pt solid #000; padding: 4pt 2pt; font-size: 9pt; font-weight: normal; text-align: center;"><span class="bn" style="font-family: siyamrupali;">পরিমান</span><br>(Qty)</th>';
        $itemsHtml .=   '<th style="border: 0.75pt solid #000; padding: 4pt 2pt; font-size: 9pt; font-weight: normal; text-align: center;"><span class="bn" style="font-family: siyamrupali;">একক</span><br>(Unit)</th>';
        $itemsHtml .=   '<th style="border: 0.75pt solid #000; padding: 4pt; font-size: 9pt; font-weight: normal; text-align: center;">Condition / মন্তব্য</th>';
        $itemsHtml .= '</tr>';

        foreach ($gatePass->items as $i => $item) {
            $sl = str_pad((string)($i + 1), 2, '0', STR_PAD_LEFT);
            $itemsHtml .= '<tr>';
            $itemsHtml .=   '<td style="border: 0.75pt solid #000; padding: 6pt 2pt; font-size: 10pt; text-align: center; vertical-align: middle;">' . $sl . '</td>';
            $itemsHtml .=   '<td style="border: 0.75pt solid #000; padding: 6pt 8pt; font-size: 10pt; vertical-align: top; line-height: 1.4;">' . nl2br($esc($item->description), false) . '</td>';
            $itemsHtml .=   '<td style="border: 0.75pt solid #000; padding: 6pt 2pt; font-size: 10pt; text-align: right; vertical-align: middle; white-space: nowrap;">' . $fmt($item->quantity) . '</td>';
            $itemsHtml .=   '<td style="border: 0.75pt solid #000; padding: 6pt 2pt; font-size: 10pt; text-align: center; vertical-align: middle;">' . $esc($item->unit) . '</td>';
            $itemsHtml .=   '<td style="border: 0.75pt solid #000; padding: 6pt 6pt; font-size: 9.5pt; vertical-align: top; line-height: 1.3;">' . nl2br($esc($item->condition_note ?? ''), false) . '</td>';
            $itemsHtml .= '</tr>';
        }
        $itemsHtml .= '</table>';

        $notesHtml = $gatePass->notes
            ? '<div style="margin-top: 10pt; font-size: 10pt; color: #000;"><b>Notes:</b> ' . nl2br($esc($gatePass->notes), false) . '</div>'
            : '';

        // Signature blocks — issuer left, customer rep right
        $sigImg = $sigPath
            ? '<img src="' . $sigPath . '" style="height: 40pt; max-width: 150pt;" alt="signature" />'
            : '<div style="height: 40pt;"></div>';

        $signatureBlock = '<table width="100%" cellspacing="0" cellpadding="0" style="margin-top: 30pt;">'
            . '<tr>'
            .   '<td width="40%" style="vertical-align: bottom; text-align: left;">'
            .     '<div style="margin-bottom: 4pt;">' . $sigImg . '</div>'
            .     '<div style="border-top: 0.75pt solid #000; padding-top: 4pt; font-size: 10pt; font-weight: bold; color: #000; display: inline-block; min-width: 140pt;">Issued By (IED)</div>'
            .     '<div style="font-size: 10pt; color: #000; margin-top: 2pt;">' . $issuerName . '</div>'
            .     ($issuerTitle !== '' ? '<div style="font-size: 9pt; color: #4b5563; margin-top: 1pt;">' . $issuerTitle . '</div>' : '')
            .     ($issuerCenter !== '' ? '<div style="font-size: 9pt; color: #4b5563;">' . $issuerCenter . '</div>' : '')
            .   '</td>'
            .   '<td width="20%"></td>'
            .   '<td width="40%" style="vertical-align: bottom; text-align: right;">'
            .     '<div style="height: 40pt;"></div>'
            .     '<div style="border-top: 0.75pt solid #000; padding-top: 4pt; font-size: 10pt; font-weight: bold; color: #000; display: inline-block; min-width: 160pt;">Customer Representative</div>'
            .     '<div style="font-size: 10pt; color: #000; margin-top: 2pt;">' . $esc($gatePass->customer_rep_name ?? '') . '</div>'
            .     ($gatePass->customer_rep_phone ? '<div style="font-size: 9pt; color: #4b5563;">' . $esc($gatePass->customer_rep_phone) . '</div>' : '')
            .   '</td>'
            . '</tr>'
            . '</table>';

        $bodyHtml = <<<HTML
        {$memoBlock}
        {$titleBlock}
        {$metaBlock}
        {$itemsHtml}
        {$notesHtml}
        {$signatureBlock}
HTML;

        $bytes    = app(\App\Services\BitacLetterhead::class)->render($bodyHtml, "Gate Pass {$gatePass->pass_no}");
        $filename = "GatePass-{$gatePass->pass_no}.pdf";

        if ($request->input('preview') === 'base64') {
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

    /**
     * Decode an inline signature data URL and persist it to
     * signatures/gate-passes/{id}-{ts}.png. Returns the stored path or null.
     */
    private function persistSignature($pass, ?string $dataUrl): ?string
    {
        if (!$dataUrl || !str_starts_with($dataUrl, 'data:image/')) return null;
        $parts = explode(',', $dataUrl, 2);
        if (count($parts) !== 2) return null;
        $binary = base64_decode($parts[1], true);
        if ($binary === false) return null;

        $filename = 'signatures/gate-passes/' . $pass->id . '-' . time() . '.png';
        Storage::disk('public')->put($filename, $binary);
        return $filename;
    }
}
