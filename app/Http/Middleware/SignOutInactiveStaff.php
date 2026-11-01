<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

/**
 * A staff account that has been deactivated — or retired by handing its post
 * over to the next person — is signed out on its next request.
 *
 * LoginRequest already refused a new sign-in, but a session opened before the
 * deactivation kept working until it expired, so the outgoing officer could
 * still approve as the post after it was handed over.
 */
class SignOutInactiveStaff
{
    public function handle(Request $request, Closure $next)
    {
        $user = Auth::guard('web')->user();

        if ($user && isset($user->is_active) && ! $user->is_active) {
            Auth::guard('web')->logout();
            $request->session()->invalidate();
            $request->session()->regenerateToken();

            return redirect()->route('login')->withErrors([
                'email' => $user->deactivation_reason ?: 'This account has been deactivated.',
            ]);
        }

        return $next($request);
    }
}
