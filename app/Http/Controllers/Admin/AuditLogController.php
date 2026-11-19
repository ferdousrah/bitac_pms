<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\Customer;
use Illuminate\Http\Request;
use Inertia\Inertia;

class AuditLogController extends Controller
{
    public function index(Request $request)
    {
        $logs = AuditLog::with('user')
            ->when($request->search, fn($q, $s) => $q->where(function ($q) use ($s) {
                $q->where('action', 'like', "%$s%")
                  ->orWhere('model_type', 'like', "%$s%")
                  // The description lives in new_values.message; CAST works on
                  // MySQL's JSON and MariaDB's longtext alike.
                  ->orWhereRaw('CAST(new_values AS CHAR) LIKE ?', ["%$s%"])
                  ->orWhereHas('user', fn($u) => $u->where('name', 'like', "%$s%"));
            }))
            ->when($request->event, fn($q, $e) => $q->where('action', $e))
            ->when($request->model, fn($q, $m) => $q->where('model_type', $m))
            ->latest()->latest('id')->paginate(50)->withQueryString();

        // ⚠️ user_id points at `customers` for a client-portal entry, not at
        // `users` — reading ->user there names whichever staff member has
        // that id.
        $customerIds = $logs->getCollection()->where('user_type', 'customer')->pluck('user_id')->filter()->unique();
        $customers   = $customerIds->isEmpty() ? collect() : Customer::whereIn('id', $customerIds)->pluck('name', 'id');

        $logs->through(fn($log) => [
            'id'            => $log->id,
            'created_at'    => $log->created_at->format('d/m/Y H:i'),
            'causer_name'   => $log->user_type === 'customer'
                ? (($customers[$log->user_id] ?? 'Client') . ' (client)')
                : $log->user?->name,
            'event'         => $log->action,
            'auditable_type'=> $log->model_type,
            'description'   => $log->new_values['message'] ?? $log->action,
            'ip_address'    => $log->ip_address,
        ]);

        return Inertia::render('Admin/AuditLog/Index', [
            'logs'    => $logs,
            'filters' => $request->only(['search', 'event', 'model']),
            // What is actually in the log, so the filters never offer an empty choice.
            'events'  => AuditLog::query()->distinct()->orderBy('action')->pluck('action'),
            'models'  => AuditLog::query()->whereNotNull('model_type')->distinct()->orderBy('model_type')->pluck('model_type'),
        ]);
    }
}
