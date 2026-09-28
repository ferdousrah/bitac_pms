<?php

namespace App\Http\Controllers;

use App\Models\Center;
use App\Models\Invoice;
use App\Models\MusakChallan;
use App\Models\User;
use App\Services\MusakChallanRenderer;
use App\Support\SignatureResolver;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;

/**
 * Billing & Accounts → মূসক ৬.৩ (কর চালানপত্র).
 *
 * The NBR VAT challan. Every field on the form is typed and stored — see
 * `MusakChallan` for why nothing is derived at print time.
 *
 * ⚠️ **The challan carries VAT only.** মূসক ৬.৩ has columns for সম্পূরক শুল্ক
 * and মূসক and nothing else; there is no column for income tax. Our invoices
 * embed VAT *and* Tax (AIT), so when a challan is prefilled from one the AIT is
 * left out and the form says so plainly, naming the amount. The usual practice
 * is that the buyer deducts AIT at source, so it never appears on the supplier's
 * challan — **BITAC still has to confirm this**, and the figure is shown rather
 * than silently dropped precisely so nobody has to take our word for it.
 */
class MusakChallanController extends Controller
{
    public function index(Request $request)
    {
        $query = MusakChallan::with(['customer', 'signatory'])->latest();

        if ($search = trim((string) $request->input('search'))) {
            $query->where(fn ($w) => $w
                ->where('challan_no', 'like', "%{$search}%")
                ->orWhere('buyer_name', 'like', "%{$search}%")
                ->orWhere('buyer_bin', 'like', "%{$search}%"));
        }
        if (in_array($request->input('status'), ['draft', 'issued'], true)) {
            $query->where('status', $request->input('status'));
        }

        return Inertia::render('MusakChallan/Index', [
            'challans' => $query->paginate(20)->withQueryString()->through(fn (MusakChallan $c) => [
                'id'         => $c->id,
                'challan_no' => $c->challan_no,
                'buyer_name' => $c->buyer_name,
                'buyer_bin'  => $c->buyer_bin,
                'issue_date' => $c->issue_date?->format('d M Y'),
                'issue_time' => $c->issue_time ? substr((string) $c->issue_time, 0, 5) : null,
                'total'      => (float) $c->total_inclusive,
                'status'     => $c->status,
                'signatory'  => $c->signatory?->name,
            ]),
            'filters' => ['search' => $search, 'status' => $request->input('status', '')],
        ]);
    }

    public function create(Request $request)
    {
        return Inertia::render('MusakChallan/Create', $this->formProps(null, $request));
    }

    public function store(Request $request)
    {
        $data = $this->validateChallan($request);

        DB::transaction(function () use ($data, $request) {
            $challan = MusakChallan::create($this->headerAttributes($data, $request) + [
                'created_by' => auth()->id(),
            ]);
            $this->syncItems($challan, $data['items'] ?? []);
        });

        return redirect()->route('musak-challans.index')
            ->with('success', $request->boolean('issue') ? 'চালানপত্র ইস্যু করা হয়েছে।' : 'Saved as draft.');
    }

    public function edit(MusakChallan $musakChallan, Request $request)
    {
        return Inertia::render('MusakChallan/Create', $this->formProps($musakChallan, $request));
    }

    public function update(Request $request, MusakChallan $musakChallan)
    {
        $data = $this->validateChallan($request);

        DB::transaction(function () use ($data, $request, $musakChallan) {
            $attrs = $this->headerAttributes($data, $request);
            // Once issued, the stamp stays put — re-saving must not re-date it.
            if ($musakChallan->issued_at) {
                unset($attrs['issued_at']);
                $attrs['status'] = 'issued';
            }
            $musakChallan->update($attrs);
            $this->syncItems($musakChallan, $data['items'] ?? []);
        });

        return redirect()->route('musak-challans.index')->with('success', 'চালানপত্র হালনাগাদ হয়েছে।');
    }

    public function destroy(MusakChallan $musakChallan)
    {
        // A tax challan that has been issued is not deleted — it is a record of
        // something that left the premises. Only a draft can go.
        if ($musakChallan->status === 'issued') {
            return back()->with('error', 'An issued চালানপত্র cannot be deleted — only a draft can.');
        }

        $musakChallan->delete();

        return back()->with('success', 'Draft deleted.');
    }

    /** The form, printed. `?copy=` picks প্রথম / দ্বিতীয় / তৃতীয় কপি. */
    public function pdf(Request $request, MusakChallan $musakChallan)
    {
        $copy  = (int) $request->query('copy', 1);
        $bytes = app(MusakChallanRenderer::class)->render($musakChallan, $copy);

        $filename = 'musak-6.3-' . ($musakChallan->challan_no ?: $musakChallan->id) . '-copy' . $copy . '.pdf';

        if ($request->input('preview') === 'base64') {
            return response()->json([
                'filename' => $filename,
                'size'     => strlen($bytes),
                'data'     => base64_encode($bytes),
            ]);
        }

        return response($bytes, 200, [
            'Content-Type'        => 'application/pdf',
            'Content-Disposition' => ($request->boolean('preview') ? 'inline' : 'attachment')
                . '; filename="' . $filename . '"',
            'Content-Length'      => strlen($bytes),
        ]);
    }

    // ─────────────────────────────────────────────────────────────────────

    private function headerAttributes(array $data, Request $request): array
    {
        $issue = $request->boolean('issue');

        return [
            'invoice_id'        => $data['invoice_id'] ?? null,
            'customer_id'       => $data['customer_id'] ?? null,
            'work_order_id'     => $data['work_order_id'] ?? null,
            'delivery_order_id' => $data['delivery_order_id'] ?? null,
            'challan_no'        => $data['challan_no'] ?? null,
            'issue_date'        => $data['issue_date'] ?? now()->toDateString(),
            'issue_time'        => $data['issue_time'] ?? now()->format('H:i'),
            'supplier_name'     => $data['supplier_name'] ?? null,
            'supplier_bin'      => $data['supplier_bin'] ?? null,
            'supplier_address'  => $data['supplier_address'] ?? null,
            'buyer_name'        => $data['buyer_name'] ?? null,
            'buyer_bin'         => $data['buyer_bin'] ?? null,
            'buyer_address'     => $data['buyer_address'] ?? null,
            'destination'       => $data['destination'] ?? null,
            'vehicle'           => $data['vehicle'] ?? null,
            'signatory_user_id' => $data['signatory_user_id'] ?? null,
            'signature_path'    => SignatureResolver::resolve(
                $data['user_signature_id'] ?? null,
                null,
                'signatures/musak',
                $data['signatory_user_id'] ?? null,
            ),
            'note'              => $data['note'] ?? null,
            'status'            => $issue ? 'issued' : 'draft',
            'issued_at'         => $issue ? now() : null,
        ];
    }

    /**
     * Write the lines and the footer totals.
     *
     * ⚠️ The arithmetic lives HERE, not in the browser: what the challan claims
     * was charged must come from the server. The form computes the same figures
     * live so the preparer sees them, but those numbers are never trusted.
     */
    private function syncItems(MusakChallan $challan, array $items): void
    {
        $challan->items()->delete();

        $totals = ['value' => 0.0, 'sd' => 0.0, 'vat' => 0.0, 'incl' => 0.0];

        foreach (array_values($items) as $i => $row) {
            $qty   = (float) ($row['quantity'] ?? 0);
            $price = (float) ($row['unit_price'] ?? 0);
            $sdPct = (float) ($row['sd_rate'] ?? 0);
            $vatPct= (float) ($row['vat_rate'] ?? 0);

            $value = round($qty * $price, 2);
            $sd    = round($value * $sdPct / 100, 2);
            // VAT sits on the value PLUS the supplementary duty — সম্পূরক শুল্ক
            // is part of the taxable base, not a parallel charge.
            $vat   = round(($value + $sd) * $vatPct / 100, 2);
            $incl  = round($value + $sd + $vat, 2);

            $challan->items()->create([
                'sort_order'      => $i,
                'description'     => $row['description'] ?? null,
                'unit'            => $row['unit'] ?? null,
                'quantity'        => $qty,
                'unit_price'      => $price,
                'total_value'     => $value,
                'sd_rate'         => $sdPct,
                'sd_amount'       => $sd,
                'vat_rate'        => $vatPct,
                'vat_amount'      => $vat,
                'total_inclusive' => $incl,
            ]);

            $totals['value'] += $value;
            $totals['sd']    += $sd;
            $totals['vat']   += $vat;
            $totals['incl']  += $incl;
        }

        $challan->update([
            'total_value'     => round($totals['value'], 2),
            'total_sd'        => round($totals['sd'], 2),
            'total_vat'       => round($totals['vat'], 2),
            'total_inclusive' => round($totals['incl'], 2),
        ]);
    }

    private function formProps(?MusakChallan $challan, Request $request): array
    {
        $centre = Center::find(session('active_center_id') ?? auth()->user()?->center_id ?? 1);

        return [
            'existing' => $challan ? [
                'id'                => $challan->id,
                'invoice_id'        => $challan->invoice_id,
                'customer_id'       => $challan->customer_id,
                'work_order_id'     => $challan->work_order_id,
                'delivery_order_id' => $challan->delivery_order_id,
                'challan_no'        => $challan->challan_no,
                'issue_date'        => $challan->issue_date?->format('Y-m-d'),
                'issue_time'        => $challan->issue_time ? substr((string) $challan->issue_time, 0, 5) : null,
                'supplier_name'     => $challan->supplier_name,
                'supplier_bin'      => $challan->supplier_bin,
                'supplier_address'  => $challan->supplier_address,
                'buyer_name'        => $challan->buyer_name,
                'buyer_bin'         => $challan->buyer_bin,
                'buyer_address'     => $challan->buyer_address,
                'destination'       => $challan->destination,
                'vehicle'           => $challan->vehicle,
                'signatory_user_id' => $challan->signatory_user_id,
                'note'              => $challan->note,
                'status'            => $challan->status,
                'items'             => $challan->items->map(fn ($i) => [
                    'description' => $i->description,
                    'unit'        => $i->unit,
                    'quantity'    => (float) $i->quantity,
                    'unit_price'  => (float) $i->unit_price,
                    'sd_rate'     => (float) $i->sd_rate,
                    'vat_rate'    => (float) $i->vat_rate,
                ])->values(),
            ] : null,

            'prefill'          => $challan ? null : $this->prefillFromInvoice($request),
            'suggestedNo'      => $challan ? null : MusakChallan::generateChallanNo($centre?->id),
            'supplier'         => [
                'name'    => $centre?->name_bn ?: $centre?->name,
                'bin'     => $centre?->bin_number,
                'address' => $centre?->address_bn ?: $centre?->address,
            ],
            // Invoices that have not had a challan raised against them yet —
            // the usual way in.
            'invoices'         => Invoice::with('customer')
                ->whereDoesntHave('musakChallans')
                ->latest()->take(50)->get()
                ->map(fn (Invoice $inv) => [
                    'id'       => $inv->id,
                    'label'    => $inv->invoice_number . ' — ' . ($inv->customer?->name ?? '—'),
                    'total'    => (float) $inv->total_amount,
                ]),
            'signatories'      => User::with('signatures')->orderBy('name')->get(['id', 'name', 'designation'])
                ->map(fn ($u) => [
                    'id'          => $u->id,
                    'name'        => $u->name,
                    'designation' => $u->designation,
                    'signatures'  => $u->signatures->map(fn ($s) => [
                        'id' => $s->id, 'label' => $s->label, 'url' => $s->url, 'is_default' => $s->is_default,
                    ])->values(),
                ]),
            'defaultSignatoryId' => auth()->id(),
        ];
    }

    /**
     * Build the lines from an invoice.
     *
     * Quotation unit prices are VAT **and** Tax inclusive (see the quotation
     * VAT/Tax model), so the ex-tax price is `gross / (1 + (vat+tax)/100)` — the
     * same extraction the quotation itself uses. What that leaves out is the
     * AIT, which the form then names.
     */
    private function prefillFromInvoice(Request $request): ?array
    {
        $id = $request->query('invoice');
        if (! $id) {
            return null;
        }

        $invoice = Invoice::with(['customer', 'workOrder.quotation.items', 'workOrder.items', 'deliveryOrder'])
            ->find($id);
        if (! $invoice) {
            return null;
        }

        $vatRate = (float) ($invoice->vat_rate ?? 0);
        $taxRate = (float) ($invoice->tax_rate ?? 0);
        $divisor = 1 + ($vatRate + $taxRate) / 100;

        $units = $invoice->workOrder?->items->pluck('unit')->values() ?? collect();

        $items = ($invoice->workOrder?->quotation?->items ?? collect())
            ->values()
            ->map(fn ($line, $i) => [
                'description' => $line->description,
                'unit'        => $units[$i] ?? null,
                'quantity'    => (float) $line->quantity,
                'unit_price'  => round(((float) $line->unit_price) / ($divisor ?: 1), 2),
                'sd_rate'     => 0,
                'vat_rate'    => $vatRate,
            ])->values();

        return [
            'invoice_id'        => $invoice->id,
            'invoice_number'    => $invoice->invoice_number,
            'customer_id'       => $invoice->customer_id,
            'work_order_id'     => $invoice->work_order_id,
            'delivery_order_id' => $invoice->delivery_order_id,
            'buyer_name'        => $invoice->customer?->name,
            'buyer_bin'         => $invoice->customer?->bin_number,
            'buyer_address'     => $invoice->customer?->address,
            'destination'       => $invoice->deliveryOrder?->delivery_address ?: $invoice->customer?->address,
            'vehicle'           => $invoice->deliveryOrder?->vehicle_number,
            'items'             => $items,
            // Named, never silently dropped — see the class docblock.
            'excluded_tax'      => round((float) ($invoice->tax_amount ?? 0), 2),
            'tax_rate'          => $taxRate,
            'invoice_total'     => (float) $invoice->total_amount,
        ];
    }

    private function validateChallan(Request $request): array
    {
        return $request->validate([
            'invoice_id'         => 'nullable|exists:invoices,id',
            'customer_id'        => 'nullable|exists:customers,id',
            'work_order_id'      => 'nullable|exists:work_orders,id',
            'delivery_order_id'  => 'nullable|exists:delivery_orders,id',
            'challan_no'         => 'nullable|string|max:60',
            'issue_date'         => 'nullable|date',
            'issue_time'         => 'nullable|date_format:H:i',
            'supplier_name'      => 'nullable|string|max:255',
            'supplier_bin'       => 'nullable|string|max:40',
            'supplier_address'   => 'nullable|string|max:1000',
            'buyer_name'         => 'required|string|max:255',
            'buyer_bin'          => 'nullable|string|max:40',
            'buyer_address'      => 'nullable|string|max:1000',
            'destination'        => 'nullable|string|max:255',
            'vehicle'            => 'nullable|string|max:255',
            'signatory_user_id'  => 'nullable|exists:users,id',
            'user_signature_id'  => 'nullable|integer|exists:user_signatures,id',
            'note'               => 'nullable|string|max:1000',
            'items'                 => 'required|array|min:1',
            'items.*.description'   => 'required|string|max:1000',
            'items.*.unit'          => 'nullable|string|max:40',
            'items.*.quantity'      => 'required|numeric|min:0',
            'items.*.unit_price'    => 'required|numeric|min:0',
            'items.*.sd_rate'       => 'nullable|numeric|min:0|max:100',
            'items.*.vat_rate'      => 'nullable|numeric|min:0|max:100',
        ]);
    }
}
