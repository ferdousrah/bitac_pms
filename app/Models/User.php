<?php

namespace App\Models;

use Database\Factories\UserFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Spatie\Permission\Traits\HasRoles;

class User extends Authenticatable
{
    use HasFactory, Notifiable, HasRoles;

    protected $fillable = [
        'name',
        'email',
        'phone',
        'designation',
        'signature_path',
        'password',
        'center_id',
        'section_id',
        'is_active',
        'deactivated_at',
        'deactivation_reason',
    ];

    protected $hidden = [
        'password',
        'remember_token',
    ];

    protected function casts(): array
    {
        return [
            'email_verified_at'   => 'datetime',
            'password'            => 'hashed',
            'is_active'           => 'boolean',
            'deactivated_at'      => 'datetime',
        ];
    }

    public function center()
    {
        return $this->belongsTo(Center::class);
    }

    public function section()
    {
        return $this->belongsTo(Section::class);
    }

    /**
     * Public URL of the user's scanned signature, or null if not uploaded.
     * Used in the Inertia payload for previews.
     */
    public function getSignatureUrlAttribute(): ?string
    {
        return $this->signature_path
            ? \Storage::disk('public')->url($this->signature_path)
            : null;
    }

    /**
     * Absolute filesystem path of the signature image — used by mPDF when
     * embedding the image into a generated PDF (mPDF needs a local path).
     */
    public function signatureAbsolutePath(): ?string
    {
        if (!$this->signature_path) return null;
        $path = \Storage::disk('public')->path($this->signature_path);
        return is_file($path) ? $path : null;
    }

    public function rfqs()
    {
        return $this->hasMany(Rfq::class, 'created_by');
    }

    public function quotations()
    {
        return $this->hasMany(Quotation::class, 'created_by');
    }

    public function workOrders()
    {
        return $this->hasMany(WorkOrder::class, 'created_by');
    }

    public function operatorAssignments()
    {
        return $this->hasMany(OperatorAssignment::class);
    }

    public function jobExecutions()
    {
        return $this->hasMany(JobExecution::class, 'operator_id');
    }

    public function qcInspections()
    {
        return $this->hasMany(QcInspection::class, 'inspector_id');
    }

    public function quotationApprovals()
    {
        return $this->hasMany(QuotationApproval::class, 'approver_id');
    }
}
