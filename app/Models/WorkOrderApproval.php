<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Storage;

/**
 * One step of a work order's acceptance chain.
 *
 * Mirrors `QuotationApproval`: levels decided in order, each with its own
 * remarks and signature. Accepting a work order used to be guarded by nothing
 * more than `permission:view rfqs`, so whoever issued it could wave it through
 * to PCD themselves.
 */
class WorkOrderApproval extends Model
{
    protected $fillable = [
        'work_order_id', 'approver_id', 'level', 'label',
        'status', 'remarks', 'signature_path', 'acted_at',
    ];

    protected $casts = ['acted_at' => 'datetime'];

    public function workOrder() { return $this->belongsTo(WorkOrder::class); }
    public function approver()  { return $this->belongsTo(User::class, 'approver_id'); }

    /**
     * The image this step was signed with — the snapshot taken at the time,
     * falling back to the approver's current default if none was captured.
     */
    public function signatureAbsolutePath(): ?string
    {
        if ($this->signature_path) {
            $path = Storage::disk('public')->path($this->signature_path);
            if (is_file($path)) return $path;
        }

        return $this->approver?->signatureAbsolutePath();
    }
}
