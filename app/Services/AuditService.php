<?php

namespace App\Services;

use App\Models\AuditLog;

class AuditService
{
    public function log(
        string $action,
        string $modelType = null,
        int $modelId = null,
        array $oldValues = [],
        array $newValues = []
    ): AuditLog {
        $userId   = null;
        $userType = 'staff';

        if (auth('customer')->check()) {
            $userId   = auth('customer')->id();
            $userType = 'customer';
        } elseif (auth()->check()) {
            $userId = auth()->id();
        }

        return AuditLog::create([
            'user_id'    => $userId,
            'user_type'  => $userType,
            'action'     => $action,
            'model_type' => $modelType,
            'model_id'   => $modelId,
            'old_values' => $oldValues ?: null,
            'new_values' => $newValues ?: null,
            'ip_address' => request()->ip(),
        ]);
    }
}
