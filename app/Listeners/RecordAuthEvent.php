<?php

namespace App\Listeners;

use App\Models\AuditLog;
use Illuminate\Auth\Events\Failed;
use Illuminate\Auth\Events\Login;
use Illuminate\Auth\Events\Logout;

/**
 * Sign-ins, sign-outs and failed sign-ins on the audit trail — staff and the
 * client portal alike. Written directly rather than through AuditService,
 * because at these moments "who is signed in" is exactly what is changing.
 */
class RecordAuthEvent
{
    public function handle(Login|Logout|Failed $event): void
    {
        try {
            $customer = $event->guard === 'customer';
            $user     = $event->user;

            [$action, $message] = match (true) {
                $event instanceof Login  => ['login', ($customer ? 'Client portal sign-in' : 'Signed in')],
                $event instanceof Logout => ['logout', ($customer ? 'Client portal sign-out' : 'Signed out')],
                default                  => ['login_failed', 'Failed sign-in for ' . mb_substr((string) ($event->credentials['email'] ?? '?'), 0, 120)
                                                . ($customer ? ' (client portal)' : '')],
            };
            if ($user && ! $event instanceof Failed) {
                $message .= ' — ' . ($user->name ?? $user->email);
            }

            AuditLog::create([
                'center_id'  => $user?->center_id,
                // A failed sign-in names the account TRIED, not who tried it —
                // so it is the record, never the person.
                'user_id'    => $event instanceof Failed ? null : $user?->getAuthIdentifier(),
                'user_type'  => $customer ? 'customer' : 'staff',
                'action'     => $action,
                'model_type' => $customer ? 'Customer' : 'User',
                'model_id'   => $user?->getAuthIdentifier(),
                'new_values' => ['message' => $message],
                'ip_address' => request()->ip(),
            ]);
        } catch (\Throwable $e) {
            // Never let the audit trail stand between someone and signing in.
            \Log::warning('Audit write failed (auth)', ['error' => $e->getMessage()]);
        }
    }
}
