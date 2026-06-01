<?php

namespace App\Http\Controllers\Customer;

use App\Http\Controllers\Controller;
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
            'unpaid_invoices'    => \App\Models\Invoice::where('customer_id', $customer->id)->whereIn('status', ['issued', 'acknowledged'])->count(),
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

        $recentInvoices = \App\Models\Invoice::where('customer_id', $customer->id)
            ->latest()->limit(5)->get()
            ->map(fn($inv) => [
                'id'             => $inv->id,
                'invoice_number' => $inv->invoice_number,
                'total_amount'   => $inv->total_amount,
                'status'         => $inv->status,
                'due_date'       => $inv->due_date ? \Carbon\Carbon::parse($inv->due_date)->format('d/m/Y') : null,
            ]);

        $unreadNotifications = $customer->notifications()->where('is_read', false)->count();

        return Inertia::render('Customer/Dashboard', [
            'customer'            => ['name' => $customer->name, 'contact_person' => $customer->contact_person],
            'stats'               => $stats,
            'recentOrders'        => $recentOrders,
            'recentInvoices'      => $recentInvoices,
            'unreadNotifications' => $unreadNotifications,
        ]);
    }
}
