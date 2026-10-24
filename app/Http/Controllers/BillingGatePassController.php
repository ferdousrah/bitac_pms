<?php

namespace App\Http\Controllers;

use App\Http\Controllers\Ied\GatePassController;
use App\Models\Customer;
use App\Models\GatePass;
use Illuminate\Http\Request;
use Inertia\Inertia;

/**
 * Billing & Accounts → Gate Pass Out (BITAC, 2026-10-24): the Gate Pass Out
 * passes PCD raised — what has physically left the premises — read-only for
 * accounts, with the PDF.
 *
 * ⚠️ A deliberate second door, like `pcd.deliveries.challan`: the gate pass
 * screens and their PDF sit behind `view pcd` / `manage gate-passes`, which
 * accounts do not hold. This lists only `origin = pcd`, `direction = out`, and
 * its PDF route refuses any other pass, so it cannot be used to open an IED
 * pass or a Gate Pass In by guessing an id.
 */
class BillingGatePassController extends Controller
{
    public function index(Request $request)
    {
        $query = GatePass::with(['customer:id,name', 'rfq.customer:id,name', 'items', 'issuedBy:id,name', 'approvedBy:id,name'])
            ->where('origin', 'pcd')->where('direction', 'out')
            ->latest('pass_date')->latest('id');

        if ($search = trim((string) $request->input('search'))) {
            $query->where(fn ($q) => $q->where('pass_no', 'like', "%{$search}%")
                ->orWhere('party_name', 'like', "%{$search}%")
                ->orWhere('vehicle_no', 'like', "%{$search}%")
                ->orWhere('customer_rep_name', 'like', "%{$search}%")
                ->orWhereHas('customer', fn ($c) => $c->where('name', 'like', "%{$search}%"))
                ->orWhereHas('rfq.customer', fn ($c) => $c->where('name', 'like', "%{$search}%"))
                ->orWhereHas('items', fn ($i) => $i->where('description', 'like', "%{$search}%")));
        }
        if ($status = $request->input('status')) $query->where('status', $status);
        if ($from = $request->input('date_from')) $query->whereDate('pass_date', '>=', $from);
        if ($to = $request->input('date_to'))     $query->whereDate('pass_date', '<=', $to);
        if ($cid = $request->input('customer_id')) {
            $query->where(fn ($q) => $q->where('customer_id', $cid)
                ->orWhereHas('rfq', fn ($r) => $r->where('customer_id', $cid)));
        }

        return Inertia::render('Billing/GatePassOut', [
            'passes' => $query->paginate(20)->withQueryString()->through(fn (GatePass $p) => [
                'id'          => $p->id,
                'pass_no'     => $p->pass_no,
                'pass_date'   => $p->pass_date?->format('d M Y'),
                'customer'    => $p->customer?->name ?? $p->rfq?->customer?->name ?? $p->party_name ?? '—',
                'party_name'  => $p->party_name,
                'rep'         => $p->customer_rep_name,
                'vehicle_no'  => $p->vehicle_no,
                'rfq_id'      => $p->rfq_id,
                'status'      => $p->status,
                'issued_by'   => $p->issuedBy?->name,
                'approved_by' => $p->approvedBy?->name,
                'items'       => $p->items->sortBy('sort_order')->map(fn ($i) => [
                    'description' => $i->description,
                    'quantity'    => (float) $i->quantity,
                    'unit'        => $i->unit,
                ])->values(),
            ]),
            'filters' => [
                'search'      => $request->input('search', ''),
                'status'      => $request->input('status', ''),
                'date_from'   => $request->input('date_from', ''),
                'date_to'     => $request->input('date_to', ''),
                'customer_id' => $request->input('customer_id', ''),
            ],
            'customers' => Customer::orderBy('name')->get(['id', 'name']),
            'counts' => GatePass::where('origin', 'pcd')->where('direction', 'out')
                ->selectRaw('status, count(*) as n')->groupBy('status')->pluck('n', 'status'),
        ]);
    }

    /** The pass PDF — the same generator IED and PCD print from. */
    public function pdf(Request $request, GatePass $gatePass)
    {
        abort_unless($gatePass->origin === 'pcd' && $gatePass->direction === 'out', 404);

        return app(GatePassController::class)->pdf($request, $gatePass);
    }
}
