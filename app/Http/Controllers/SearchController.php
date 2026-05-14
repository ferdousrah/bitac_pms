<?php

namespace App\Http\Controllers;

use App\Models\Customer;
use App\Models\Quotation;
use App\Models\Rfq;
use App\Models\WorkOrder;
use Illuminate\Http\Request;

class SearchController extends Controller
{
    public function __invoke(Request $request)
    {
        $q = trim($request->input('q', ''));
        if (strlen($q) < 2) {
            return response()->json([]);
        }

        $results = [];

        // Jobs (work_orders) — by wo_number, job_number, customer_po_no.
        // job_number is an unsigned int so strip non-digit prefixes ("Job#", "#")
        // before matching against it.
        $digits = preg_replace('/\D/', '', $q);
        WorkOrder::with('customer')
            ->where(function ($query) use ($q, $digits) {
                $query->where('wo_number', 'like', "%{$q}%")
                      ->orWhere('customer_po_no', 'like', "%{$q}%");
                if ($digits !== '') {
                    $query->orWhere('job_number', 'like', "%{$digits}%");
                }
            })
            ->latest()
            ->take(5)
            ->get()
            ->each(function ($wo) use (&$results) {
                $title = $wo->job_number ? "Job #{$wo->job_number}" : $wo->wo_number;
                $sub   = ($wo->customer?->name ?? '—');
                if ($wo->job_number && $wo->wo_number) $sub .= " · {$wo->wo_number}";
                $results[] = [
                    'type'  => 'Job',
                    'icon'  => 'fi-rr-briefcase',
                    'color' => 'blue',
                    'title' => $title,
                    'sub'   => $sub,
                    'badge' => $wo->status,
                    'link'  => "/work-orders/{$wo->id}",
                ];
            });

        // RFQs — by id, customer_ref_no, or customer name
        Rfq::with('customer')
            ->where(function ($query) use ($q) {
                $query->where('id', 'like', "%{$q}%")
                      ->orWhere('customer_ref_no', 'like', "%{$q}%")
                      ->orWhereHas('customer', fn($cq) => $cq->where('name', 'like', "%{$q}%"));
            })
            ->latest()
            ->take(5)
            ->get()
            ->each(function ($rfq) use (&$results) {
                $results[] = [
                    'type'  => 'RFQ',
                    'icon'  => 'fi-rr-file-invoice',
                    'color' => 'amber',
                    'title' => "RFQ #{$rfq->id}",
                    'sub'   => $rfq->customer?->name ?? '—',
                    'badge' => $rfq->status,
                    'link'  => "/rfqs/{$rfq->id}",
                ];
            });

        // Quotations — by id or customer name
        Quotation::with('customer')
            ->where(function ($query) use ($q) {
                $query->where('id', 'like', "%{$q}%")
                      ->orWhereHas('customer', fn($cq) => $cq->where('name', 'like', "%{$q}%"));
            })
            ->latest()
            ->take(5)
            ->get()
            ->each(function ($qt) use (&$results) {
                $results[] = [
                    'type'  => 'Quotation',
                    'icon'  => 'fi-rr-coins',
                    'color' => 'green',
                    'title' => "Quotation #{$qt->id} v{$qt->version}",
                    'sub'   => $qt->customer?->name ?? '—',
                    'badge' => $qt->status,
                    'link'  => "/quotations/{$qt->id}",
                ];
            });

        // Customers — by name, email, phone
        Customer::where(function ($query) use ($q) {
                $query->where('name', 'like', "%{$q}%")
                      ->orWhere('email', 'like', "%{$q}%")
                      ->orWhere('phone', 'like', "%{$q}%");
            })
            ->where('is_active', true)
            ->take(5)
            ->get()
            ->each(function ($c) use (&$results) {
                $results[] = [
                    'type'  => 'Customer',
                    'icon'  => 'fi-rr-building',
                    'color' => 'purple',
                    'title' => $c->name,
                    'sub'   => $c->email,
                    'badge' => null,
                    'link'  => "/admin/customers/{$c->id}/edit",
                ];
            });

        return response()->json(array_slice($results, 0, 15));
    }
}
