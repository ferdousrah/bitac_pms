<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
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
                  ->orWhereHas('user', fn($u) => $u->where('name', 'like', "%$s%"));
            }))
            ->when($request->event, fn($q, $e) => $q->where('action', $e))
            ->latest()->paginate(50)
            ->through(fn($log) => [
                'id'            => $log->id,
                'created_at'    => $log->created_at->format('d/m/Y H:i'),
                'causer_name'   => $log->user?->name,
                'event'         => $log->action,
                'auditable_type'=> $log->model_type,
                'description'   => $log->new_values['message'] ?? $log->action,
                'ip_address'    => $log->ip_address,
            ]);

        return Inertia::render('Admin/AuditLog/Index', [
            'logs'    => $logs,
            'filters' => $request->only(['search', 'event']),
        ]);
    }
}
