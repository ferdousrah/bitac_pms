<?php

namespace App\Http\Controllers\Customer;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\Rules\Password;
use Inertia\Inertia;

class CustomerForcePasswordController extends Controller
{
    public function show()
    {
        return Inertia::render('Auth/CustomerForcePassword', [
            'email' => Auth::guard('customer')->user()?->email,
        ]);
    }

    public function update(Request $request)
    {
        $customer = Auth::guard('customer')->user();

        $validated = $request->validate([
            'current_password' => 'required|string',
            'password'         => ['required', 'confirmed', Password::min(8)->letters()->numbers()],
        ]);

        if (! Hash::check($validated['current_password'], $customer->password)) {
            return back()->withErrors(['current_password' => 'The temporary password is incorrect.']);
        }

        if (Hash::check($validated['password'], $customer->password)) {
            return back()->withErrors(['password' => 'New password must be different from the temporary password.']);
        }

        $customer->forceFill([
            'password'                 => $validated['password'],
            'password_change_required' => false,
        ])->save();

        return redirect()->route('customer.dashboard')->with('success', 'Password updated successfully.');
    }
}
