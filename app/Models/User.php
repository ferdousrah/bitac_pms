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
        'password',
        'center_id',
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
