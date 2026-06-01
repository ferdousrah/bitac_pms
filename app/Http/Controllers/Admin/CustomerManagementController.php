<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Mail\CustomerWelcomeMail;
use App\Models\Customer;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Str;
use Inertia\Inertia;

class CustomerManagementController extends Controller
{
    public function index()
    {
        $customers = Customer::latest()->get()->map(fn($c) => [
            'id'             => $c->id,
            'name'           => $c->name,
            'contact_person' => $c->contact_person,
            'email'          => $c->email,
            'phone'          => $c->phone,
            'is_active'      => $c->is_active,
        ]);
        return Inertia::render('Admin/Customers/Index', ['customers' => $customers]);
    }

    public function create()
    {
        return Inertia::render('Admin/Customers/CreateEdit');
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'name'           => 'required|string|max:255',
            'contact_person' => 'nullable|string|max:255',
            'email'          => 'required|email|unique:customers',
            'phone'          => 'nullable|string|max:20',
            'address'        => 'nullable|string',
        ]);

        // Auto-generate a memorable-but-secure temporary password.
        $plainPassword = $this->generatePassword();

        // Model cast 'password' => 'hashed' auto-hashes.
        $customer = Customer::create([
            ...$validated,
            'password'                  => $plainPassword,
            'is_active'                 => true,
            'password_change_required'  => true,
        ]);

        // Email credentials. Failures don't block creation — flash a warning instead.
        try {
            Mail::to($customer->email)->send(new CustomerWelcomeMail($customer, $plainPassword));
            $flash = 'Customer created. Login credentials emailed to ' . $customer->email . '.';
        } catch (\Throwable $e) {
            Log::warning('Customer welcome email failed', ['customer_id' => $customer->id, 'error' => $e->getMessage()]);
            $flash = 'Customer created, but the welcome email could not be sent. Check RESEND_API_KEY / sender verification.';
        }

        return redirect()->route('admin.customers.index')->with('success', $flash);
    }

    public function edit(Customer $customer)
    {
        return Inertia::render('Admin/Customers/CreateEdit', [
            'customer' => [
                'id'             => $customer->id,
                'name'           => $customer->name,
                'contact_person' => $customer->contact_person,
                'email'          => $customer->email,
                'phone'          => $customer->phone,
                'address'        => $customer->address,
                'is_active'      => $customer->is_active,
            ],
        ]);
    }

    public function update(Request $request, Customer $customer)
    {
        $validated = $request->validate([
            'name'           => 'required|string|max:255',
            'contact_person' => 'nullable|string|max:255',
            'email'          => 'required|email|unique:customers,email,' . $customer->id,
            'phone'          => 'nullable|string|max:20',
            'address'        => 'nullable|string',
            'is_active'      => 'boolean',
            'reset_password' => 'sometimes|boolean',
        ]);

        $resetPassword = (bool) ($validated['reset_password'] ?? false);
        unset($validated['reset_password']);

        if ($resetPassword) {
            $plainPassword = $this->generatePassword();
            $validated['password'] = $plainPassword;
            $validated['password_change_required'] = true;
        }

        $customer->update($validated);

        $flash = 'Customer updated.';
        if ($resetPassword) {
            try {
                Mail::to($customer->email)->send(new CustomerWelcomeMail($customer->fresh(), $plainPassword));
                $flash = 'Customer updated. New temporary password emailed to ' . $customer->email . '.';
            } catch (\Throwable $e) {
                Log::warning('Customer reset email failed', ['customer_id' => $customer->id, 'error' => $e->getMessage()]);
                $flash = 'Customer updated, but the password reset email could not be sent.';
            }
        }

        return redirect()->route('admin.customers.index')->with('success', $flash);
    }

    public function destroy(Customer $customer)
    {
        $customer->delete();
        return redirect()->route('admin.customers.index')->with('success', 'Customer deleted.');
    }

    public function show(Customer $customer)
    {
        return redirect()->route('admin.customers.edit', $customer);
    }

    /**
     * Generate a 12-char temporary password: easy to type, no ambiguous chars (0/O, 1/l/I).
     */
    private function generatePassword(): string
    {
        $alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
        $out = '';
        for ($i = 0; $i < 12; $i++) {
            $out .= $alphabet[random_int(0, strlen($alphabet) - 1)];
        }
        return $out;
    }
}
