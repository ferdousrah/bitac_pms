<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class MaterialRequisition extends Model
{
    protected $fillable = [
        'mrn_number', 'work_order_id', 'request_date',
        'requested_by', 'approved_by', 'approved_at',
        'issued_by', 'issued_at', 'received_by', 'received_at',
        'status', 'notes',
    ];

    protected function casts(): array
    {
        return [
            'request_date' => 'date',
            'approved_at'  => 'datetime',
            'issued_at'    => 'datetime',
            'received_at'  => 'datetime',
        ];
    }

    public function workOrder()  { return $this->belongsTo(WorkOrder::class); }
    public function items()      { return $this->hasMany(MaterialRequisitionItem::class)->orderBy('item_no'); }
    public function requestedBy(){ return $this->belongsTo(User::class, 'requested_by'); }
    public function approvedBy() { return $this->belongsTo(User::class, 'approved_by'); }
    public function issuedBy()   { return $this->belongsTo(User::class, 'issued_by'); }
    public function receivedBy() { return $this->belongsTo(User::class, 'received_by'); }

    public static function generateMrnNumber(): string
    {
        $year = now()->format('Y');
        $last = static::where('mrn_number', 'like', "MRN-{$year}-%")->max('mrn_number');
        $next = $last ? ((int) substr($last, -4)) + 1 : 1;
        return sprintf('MRN-%s-%04d', $year, $next);
    }
}
