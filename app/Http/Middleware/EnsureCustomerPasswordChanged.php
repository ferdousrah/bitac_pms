<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Symfony\Component\HttpFoundation\Response;

class EnsureCustomerPasswordChanged
{
    /**
     * Forces customers whose accounts are flagged `password_change_required`
     * to set a new password before accessing any portal page.
     */
    public function handle(Request $request, Closure $next): Response
    {
        $customer = Auth::guard('customer')->user();

        if ($customer && $customer->password_change_required) {
            // Allow the force-change pages + logout, otherwise redirect.
            $allowed = [
                'customer.password.force.show',
                'customer.password.force.update',
                'customer.logout',
            ];
            if (! in_array($request->route()?->getName(), $allowed, true)) {
                return redirect()->route('customer.password.force.show');
            }
        }

        return $next($request);
    }
}
