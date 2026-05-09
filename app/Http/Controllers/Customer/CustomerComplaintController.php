<?php

namespace App\Http\Controllers\Customer;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use Illuminate\Http\Request;

class CustomerComplaintController extends Controller
{
    public function store(Request $request)
    {
        $validated = $request->validate([
            'work_order_id' => 'nullable|exists:work_orders,id',
            'message'       => 'required|string|max:2000',
        ]);

        $customer = auth('customer')->user();
        AuditLog::create([
            'user_id'    => $customer->id,
            'user_type'  => 'customer',
            'action'     => 'complaint_submitted',
            'model_type' => 'WorkOrder',
            'model_id'   => $validated['work_order_id'],
            'new_values' => ['message' => $validated['message']],
            'ip_address' => request()->ip(),
        ]);

        return back()->with('success', 'Your feedback has been submitted. We will get back to you shortly.');
    }
}
