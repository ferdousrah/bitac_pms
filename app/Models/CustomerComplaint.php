<?php

namespace App\Models;

use App\Traits\HasCenter;
use Illuminate\Database\Eloquent\Model;

class CustomerComplaint extends Model
{
    use HasCenter;

    protected $fillable = [
        'center_id', 'customer_id', 'work_order_id', 'reference_number',
        'subject', 'message', 'affected_qty', 'total_qty', 'category', 'status',
        'response', 'responded_by', 'responded_at', 'decision_emailed_at',
        'linked_ncr_id', 'linked_gate_pass_id', 'accepted_at', 'accepted_by',
    ];

    protected function casts(): array
    {
        return [
            'responded_at'        => 'datetime',
            'decision_emailed_at' => 'datetime',
            'accepted_at'         => 'datetime',
        ];
    }

    public function customer()       { return $this->belongsTo(Customer::class); }
    public function workOrder()      { return $this->belongsTo(WorkOrder::class); }
    public function respondedBy()    { return $this->belongsTo(User::class, 'responded_by'); }
    public function acceptedBy()     { return $this->belongsTo(User::class, 'accepted_by'); }
    public function ncr()            { return $this->belongsTo(Ncr::class, 'linked_ncr_id'); }
    public function gatePass()       { return $this->belongsTo(GatePass::class, 'linked_gate_pass_id'); }
    public function decisionMakers() { return $this->hasMany(ComplaintDecisionMaker::class, 'complaint_id'); }
    public function discussions()    { return $this->hasMany(ComplaintDiscussion::class, 'complaint_id')->orderBy('created_at'); }
}
