<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Customer;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
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
            'password'       => 'required|string|min:8|confirmed',
        ]);

        // Model cast 'password' => 'hashed' auto-hashes. Don't double-hash.
        Customer::create([...$validated, 'is_active' => true]);

        return redirect()->route('admin.customers.index')->with('success', 'Customer portal account created.');
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
            'password'       => 'nullable|string|min:8',
            'is_active'      => 'boolean',
        ]);

        // Only update password if provided (leave empty to keep existing)
        if (empty($validated['password'])) {
            unset($validated['password']);
        }
        // Model cast 'password' => 'hashed' will auto-hash

        $customer->update($validated);
        return redirect()->route('admin.customers.index')->with('success', 'Customer updated.');
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
}
