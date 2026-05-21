<?php

namespace App\Http\Controllers\Customer;

use App\Http\Controllers\Controller;
use App\Models\CustomerComplaint;
use App\Models\WorkOrder;
use Illuminate\Http\Request;
use Inertia\Inertia;

class CustomerComplaintController extends Controller
{
    public function index()
    {
        $customer = auth('customer')->user();

        $complaints = CustomerComplaint::where('customer_id', $customer->id)
            ->with(['workOrder', 'respondedBy'])
            ->latest('id')
            ->paginate(15)
            ->through(fn($c) => [
                'id'               => $c->id,
                'reference_number' => $c->reference_number,
                'subject'          => $c->subject,
                'category'         => $c->category,
                'status'           => $c->status,
                'work_order'       => $c->workOrder ? [
                    'id'         => $c->workOrder->id,
                    'wo_number'  => $c->workOrder->wo_number,
                    'job_number' => $c->workOrder->job_number,
                ] : null,
                'created_at'       => $c->created_at->format('d M Y'),
                'responded_at'     => $c->responded_at?->format('d M Y'),
            ]);

        return Inertia::render('Customer/Complaints/Index', [
            'complaints' => $complaints,
        ]);
    }

    public function create(Request $request)
    {
        $customer = auth('customer')->user();

        $workOrders = WorkOrder::where('customer_id', $customer->id)
            ->latest('id')->get()
            ->map(fn($w) => [
                'id'         => $w->id,
                'wo_number'  => $w->wo_number,
                'job_number' => $w->job_number,
            ]);

        return Inertia::render('Customer/Complaints/Create', [
            'workOrders'    => $workOrders,
            'preselectedWo' => $request->query('work_order_id'),
        ]);
    }

    public function store(Request $request)
    {
        $customer = auth('customer')->user();

        $validated = $request->validate([
            'work_order_id' => 'nullable|exists:work_orders,id',
            'subject'       => 'required|string|max:200',
            'category'      => 'nullable|in:general,quality,delivery,billing,other',
            'message'       => 'required|string|max:2000',
        ]);

        // Guard: only allow customer to file against their own WOs
        if (!empty($validated['work_order_id'])) {
            $wo = WorkOrder::find($validated['work_order_id']);
            if ($wo && $wo->customer_id !== $customer->id) {
                return back()->with('error', "That work order doesn't belong to you.");
            }
        }

        $year  = now()->year;
        $count = CustomerComplaint::whereYear('created_at', $year)->count();
        $ref   = 'CC-' . $year . '-' . str_pad($count + 1, 4, '0', STR_PAD_LEFT);

        $complaint = CustomerComplaint::create([
            'customer_id'      => $customer->id,
            'work_order_id'    => $validated['work_order_id'] ?? null,
            'reference_number' => $ref,
            'subject'          => $validated['subject'],
            'category'         => $validated['category'] ?? 'general',
            'message'          => $validated['message'],
            'status'           => 'open',
        ]);

        // Notify everyone with manage complaints permission (IED, super admin, etc.)
        \App\Services\NotifyService::toPermission(
            'manage complaints',
            'complaint_filed',
            "New complaint from {$customer->name}",
            "{$ref}: " . substr($complaint->subject, 0, 80),
            "/ied/complaints/{$complaint->id}",
            'fi-rr-comment-alt',
            'red',
        );

        return redirect()->route('customer.complaints.show', $complaint)
            ->with('success', "Complaint {$ref} submitted. We will get back to you shortly.");
    }

    public function show(CustomerComplaint $complaint)
    {
        $customer = auth('customer')->user();
        abort_unless($complaint->customer_id === $customer->id, 403);

        $complaint->load(['workOrder', 'respondedBy']);

        return Inertia::render('Customer/Complaints/Show', [
            'complaint' => [
                'id'               => $complaint->id,
                'reference_number' => $complaint->reference_number,
                'subject'          => $complaint->subject,
                'category'         => $complaint->category,
                'message'          => $complaint->message,
                'status'           => $complaint->status,
                'work_order'       => $complaint->workOrder ? [
                    'id'         => $complaint->workOrder->id,
                    'wo_number'  => $complaint->workOrder->wo_number,
                    'job_number' => $complaint->workOrder->job_number,
                ] : null,
                'response'         => $complaint->response,
                'responded_by'     => $complaint->respondedBy?->name,
                'responded_at'     => $complaint->responded_at?->format('d M Y, h:i A'),
                'created_at'       => $complaint->created_at->format('d M Y, h:i A'),
            ],
        ]);
    }
}
