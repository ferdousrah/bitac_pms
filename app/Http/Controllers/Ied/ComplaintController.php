<?php

namespace App\Http\Controllers\Ied;

use App\Http\Controllers\Controller;
use App\Models\CustomerComplaint;
use App\Services\NotifyService;
use Illuminate\Http\Request;
use Inertia\Inertia;

/**
 * IED-side inbox for customer complaints.
 * Each customer-filed complaint lands here; an IED officer reads, responds,
 * and tracks status (open → in_review → resolved → closed). The customer
 * sees responses live on their /customer/complaints/{id} page.
 */
class ComplaintController extends Controller
{
    public function index(Request $request)
    {
        $query = CustomerComplaint::with(['customer', 'workOrder', 'respondedBy']);

        if ($search = $request->input('search')) {
            $query->where(function ($q) use ($search) {
                $q->where('reference_number', 'like', "%{$search}%")
                  ->orWhere('subject', 'like', "%{$search}%")
                  ->orWhereHas('customer', fn($c) => $c->where('name', 'like', "%{$search}%"));
            });
        }
        if ($status = $request->input('status'))   $query->where('status', $status);
        if ($category = $request->input('category')) $query->where('category', $category);

        $complaints = $query->latest('id')->paginate(15)->withQueryString()
            ->through(fn($c) => [
                'id'               => $c->id,
                'reference_number' => $c->reference_number,
                'subject'          => $c->subject,
                'category'         => $c->category,
                'status'           => $c->status,
                'customer'         => $c->customer ? ['id' => $c->customer->id, 'name' => $c->customer->name] : null,
                'work_order'       => $c->workOrder ? [
                    'id'         => $c->workOrder->id,
                    'wo_number'  => $c->workOrder->wo_number,
                    'job_number' => $c->workOrder->job_number,
                ] : null,
                'created_at'       => $c->created_at->format('d M Y, h:i A'),
                'responded_at'     => $c->responded_at?->format('d M Y'),
                'responded_by'     => $c->respondedBy?->name,
            ]);

        $stats = [
            'open'      => CustomerComplaint::where('status', 'open')->count(),
            'in_review' => CustomerComplaint::where('status', 'in_review')->count(),
            'resolved'  => CustomerComplaint::where('status', 'resolved')->count(),
            'closed'    => CustomerComplaint::where('status', 'closed')->count(),
            'total'     => CustomerComplaint::count(),
        ];

        return Inertia::render('Ied/Complaints/Index', [
            'complaints' => $complaints,
            'stats'      => $stats,
            'filters'    => [
                'search'   => $request->input('search', ''),
                'status'   => $request->input('status', ''),
                'category' => $request->input('category', ''),
            ],
        ]);
    }

    public function show(CustomerComplaint $complaint)
    {
        $complaint->load(['customer', 'workOrder.product', 'respondedBy']);

        return Inertia::render('Ied/Complaints/Show', [
            'complaint' => [
                'id'               => $complaint->id,
                'reference_number' => $complaint->reference_number,
                'subject'          => $complaint->subject,
                'category'         => $complaint->category,
                'message'          => $complaint->message,
                'status'           => $complaint->status,
                'customer'         => $complaint->customer ? [
                    'id'    => $complaint->customer->id,
                    'name'  => $complaint->customer->name,
                    'email' => $complaint->customer->email,
                    'phone' => $complaint->customer->phone ?? null,
                ] : null,
                'work_order'       => $complaint->workOrder ? [
                    'id'         => $complaint->workOrder->id,
                    'wo_number'  => $complaint->workOrder->wo_number,
                    'job_number' => $complaint->workOrder->job_number,
                    'product'    => $complaint->workOrder->product->name ?? null,
                ] : null,
                'response'         => $complaint->response,
                'responded_by'     => $complaint->respondedBy?->name,
                'responded_at'     => $complaint->responded_at?->format('d M Y, h:i A'),
                'created_at'       => $complaint->created_at->format('d M Y, h:i A'),
            ],
        ]);
    }

    /**
     * IED officer responds to a complaint. Writes the response, optionally
     * changes status, stamps responded_by + responded_at, notifies customer.
     */
    public function respond(Request $request, CustomerComplaint $complaint)
    {
        $validated = $request->validate([
            'response' => 'required|string|max:4000',
            'status'   => 'required|in:in_review,resolved,closed',
        ]);

        $complaint->update([
            'response'     => $validated['response'],
            'status'       => $validated['status'],
            'responded_by' => auth()->id(),
            'responded_at' => now(),
        ]);

        // Optional customer notification (best-effort — only if Customer model
        // supports notifications, otherwise silently skipped).
        try {
            $customer = $complaint->customer;
            if ($customer && method_exists($customer, 'notifications')) {
                $customer->notifications()->create([
                    'type'    => 'complaint_response',
                    'title'   => "BITAC has responded to your complaint",
                    'body'    => "Your complaint {$complaint->reference_number} has a new response. Status: " . str_replace('_', ' ', $complaint->status) . ".",
                    'link'    => "/customer/complaints/{$complaint->id}",
                    'icon'    => 'fi-rr-comment-check',
                    'color'   => 'green',
                ]);
            }
        } catch (\Throwable $e) {
            // Don't block the response save on notification failure.
        }

        return back()->with('success', "Response sent to {$complaint->customer?->name}. Complaint marked " . str_replace('_', ' ', $complaint->status) . '.');
    }

    /** Change just the status (without sending a response — for triage). */
    public function updateStatus(Request $request, CustomerComplaint $complaint)
    {
        $validated = $request->validate([
            'status' => 'required|in:open,in_review,resolved,closed',
        ]);
        $complaint->update(['status' => $validated['status']]);
        return back()->with('success', 'Status updated.');
    }
}
