<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Inertia\Inertia;

class CustomerLoginController extends Controller
{
    public function showLoginForm()
    {
        // The BITAC letterhead (emblem, Bangla name, ministry, contacts) — the
        // same identity the public website wears, since its "Stakeholder
        // Login" button is how people reach this page.
        $center = \App\Models\Center::find(\App\Models\Center::defaultId());

        return Inertia::render('Auth/CustomerLogin', [
            'bitac' => $center ? [
                'name_bn'       => $center->name_bn,
                'ministry_bn'   => $center->ministry_bn,
                'government_bn' => $center->government_bn,
                'phone_bn'      => $center->phone_bn,
                'email'         => $center->email,
                'logo_left'     => $center->logo_left_url,
            ] : null,
        ]);
    }

    public function login(Request $request)
    {
        $credentials = $request->validate([
            'email'    => 'required|email',
            'password' => 'required|string',
        ]);

        if (Auth::guard('customer')->attempt($credentials, $request->boolean('remember'))) {
            $customer = Auth::guard('customer')->user();
            if (!$customer->is_active) {
                Auth::guard('customer')->logout();
                return back()->withErrors(['email' => 'Your account has been deactivated.']);
            }
            $request->session()->regenerate();
            return redirect()->route('customer.dashboard');
        }

        return back()->withErrors(['email' => 'Invalid credentials.'])->onlyInput('email');
    }

    public function logout(Request $request)
    {
        Auth::guard('customer')->logout();
        $request->session()->invalidate();
        $request->session()->regenerateToken();
        return redirect()->route('customer.login');
    }
}
