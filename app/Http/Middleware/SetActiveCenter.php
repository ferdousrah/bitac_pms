<?php

namespace App\Http\Middleware;

use App\Models\Center;
use Closure;
use Illuminate\Http\Request;

/**
 * Which centre this request works in — bound as `current_center_id`, which
 * CenterScope reads. NULL means "every centre".
 *
 * ⚠️ Only someone who may see every centre (`view all centres` — BITAC Head
 * Office, and the super admin through Gate::before) can be on NULL, or switch.
 * Everyone else is pinned to their own centre; one with NO centre recorded
 * lands on the default centre rather than seeing everything — an unset column
 * must never widen what a person can read.
 *
 * (This used to test `hasRole('super_admin')`, a role that does not exist —
 * the real one is `super-admin` — so the centre switcher never worked.)
 */
class SetActiveCenter
{
    public function handle(Request $request, Closure $next)
    {
        $centerId = null;

        if (auth('web')->check()) {
            $user = auth('web')->user();

            if ($user->can('view all centres')) {
                // Head Office / super admin: the centre they picked, or all.
                $centerId = session('active_center_id');
            } else {
                $centerId = $user->center_id ?: Center::defaultId();
            }
        } elseif (auth('customer')->check()) {
            // ⚠️ A client is one record across BITAC (2026-10-26) — the
            // portal shows their work at every centre, so no centre filter.
            $centerId = null;
        }

        app()->instance('current_center_id', $centerId);

        return $next($request);
    }
}
