<?php

namespace App\Http\Controllers\Customer;

use App\Http\Controllers\Controller;
use App\Models\Invoice;
use App\Models\Rfq;
use App\Models\WorkOrder;
use Inertia\Inertia;

class CustomerDashboardController extends Controller
{
    public function index()
    {
        $customer = auth('customer')->user();

        $stats = [
            'active_orders'      => WorkOrder::where('customer_id', $customer->id)->whereIn('status', ['in_production', 'qc_hold', 'approved'])->count(),
            'in_production'      => WorkOrder::where('customer_id', $customer->id)->where('status', 'in_production')->count(),
            'ready_for_delivery' => WorkOrder::where('customer_id', $customer->id)->where('status', 'ready_for_delivery')->count(),
            'unpaid_invoices'    => Invoice::where('customer_id', $customer->id)->whereIn('status', ['issued', 'acknowledged'])->count(),
        ];

        // Lifetime context — gives the customer a sense of relationship history
        // even when they have no in-flight work. Numbers feel grounded, not
        // SaaS-template empty.
        $lifetime = [
            'total_projects'    => WorkOrder::where('customer_id', $customer->id)->count(),
            'total_delivered'   => WorkOrder::where('customer_id', $customer->id)->where('status', 'delivered')->count(),
            'total_billed'      => (float) Invoice::where('customer_id', $customer->id)->sum('total_amount'),
            'outstanding_due'   => (float) Invoice::where('customer_id', $customer->id)->whereIn('status', ['issued', 'acknowledged'])->sum('total_amount'),
            'rfqs_submitted'    => Rfq::where('customer_id', $customer->id)->count(),
            'rfqs_pending'      => Rfq::where('customer_id', $customer->id)->where('status', 'pending')->count(),
            'member_since'      => $customer->created_at?->format('M Y'),
        ];

        $recentOrders = WorkOrder::where('customer_id', $customer->id)
            ->with(['product', 'operationSheets.steps'])->latest()->limit(5)->get()
            ->map(fn($wo) => [
                'id'           => $wo->id,
                'wo_number'    => $wo->wo_number,
                'product'      => $wo->product->name ?? '',
                'quantity'     => $wo->quantity,
                'status'       => $wo->status,
                'status_label' => $wo->status_label,
                'status_color' => $wo->status_color,
                'due_date'     => $wo->due_date?->format('d/m/Y'),
                'progress_pct' => $wo->production_progress,
            ]);

        $recentInvoices = Invoice::where('customer_id', $customer->id)
            ->latest()->limit(5)->get()
            ->map(fn($inv) => [
                'id'             => $inv->id,
                'invoice_number' => $inv->invoice_number,
                'total_amount'   => $inv->total_amount,
                'status'         => $inv->status,
                'due_date'       => $inv->due_date ? \Carbon\Carbon::parse($inv->due_date)->format('d/m/Y') : null,
            ]);

        $recentRfqs = Rfq::where('customer_id', $customer->id)
            ->latest()->limit(3)->get()
            ->map(fn($r) => [
                'id'              => $r->id,
                'customer_ref_no' => $r->customer_ref_no,
                'status'          => $r->status,
                'item_count'      => $r->items()->count(),
                'created_at'      => $r->created_at->format('d M Y'),
            ]);

        return Inertia::render('Customer/Dashboard', [
            'customer'       => [
                'name'           => $customer->name,
                'contact_person' => $customer->contact_person,
                'email'          => $customer->email,
                'phone'          => $customer->phone,
            ],
            'stats'          => $stats,
            'lifetime'       => $lifetime,
            'recentOrders'   => $recentOrders,
            'recentInvoices' => $recentInvoices,
            'recentRfqs'     => $recentRfqs,
        ]);
    }
}
