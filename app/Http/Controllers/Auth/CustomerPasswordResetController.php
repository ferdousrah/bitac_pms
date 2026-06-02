<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Password;
use Illuminate\Validation\Rules\Password as PasswordRule;
use Inertia\Inertia;

class CustomerPasswordResetController extends Controller
{
    /** "Forgot password?" — ask for email. */
    public function showRequestForm()
    {
        return Inertia::render('Auth/CustomerForgotPassword', [
            'status' => session('status'),
        ]);
    }

    /** Send the reset email via the `customers` broker. */
    public function sendResetLink(Request $request)
    {
        $request->validate(['email' => 'required|email']);

        $status = Password::broker('customers')->sendResetLink(
            $request->only('email')
        );

        if ($status === Password::RESET_LINK_SENT) {
            return back()->with('status', 'If that email is registered, we have sent a reset link.');
        }

        // We deliberately use the same wording on failure to avoid leaking which
        // emails are registered — security best practice.
        return back()->with('status', 'If that email is registered, we have sent a reset link.');
    }

    /** Show the reset form (the link target). */
    public function showResetForm(Request $request, string $token)
    {
        return Inertia::render('Auth/CustomerResetPassword', [
            'token' => $token,
            'email' => $request->query('email', ''),
        ]);
    }

    /** Actually update the password. */
    public function reset(Request $request)
    {
        $request->validate([
            'token'    => 'required',
            'email'    => 'required|email',
            'password' => ['required', 'confirmed', PasswordRule::min(8)->letters()->numbers()],
        ]);

        $status = Password::broker('customers')->reset(
            $request->only('email', 'password', 'password_confirmation', 'token'),
            function ($customer, $password) {
                // Cast 'password' => 'hashed' on Customer means just assigning works.
                $customer->forceFill([
                    'password'                 => $password,
                    'remember_token'           => \Illuminate\Support\Str::random(60),
                    'password_change_required' => false, // proper reset clears the force flag too
                ])->save();
            }
        );

        if ($status === Password::PASSWORD_RESET) {
            return redirect()->route('customer.login')->with('success', 'Password updated. You can now sign in with your new password.');
        }

        return back()->withErrors(['email' => trans($status)]);
    }
}
