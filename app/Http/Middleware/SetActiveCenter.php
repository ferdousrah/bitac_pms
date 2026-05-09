<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;

class SetActiveCenter
{
    public function handle(Request $request, Closure $next)
    {
        $centerId = null;

        // Check staff (web guard) first — only they have Spatie roles
        if (auth('web')->check()) {
            $user = auth('web')->user();

            if (method_exists($user, 'hasRole') && $user->hasRole('super_admin')) {
                // super_admin can switch center via session
                $centerId = session('active_center_id') ?? $user->center_id;
            } else {
                $centerId = $user->center_id;
            }
        } elseif (auth('customer')->check()) {
            // Customers have a center_id but no roles
            $centerId = auth('customer')->user()->center_id;
        }

        // Bind to container so CenterScope can read it
        app()->instance('current_center_id', $centerId);

        return $next($request);
    }
}
