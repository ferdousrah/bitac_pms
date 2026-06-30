<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/**
 * A daily, item-wise production entry — "X pieces produced today at this step
 * (sub-section) on this machine". Drives the step's completed_qty and the
 * quantity-based progress.
 */
class ProductionLog extends Model
{
    protected $fillable = [
        'operation_step_id', 'work_order_id', 'work_order_item_id',
        'section_id', 'sub_section_id', 'machine_id', 'operator_id',
        'log_date', 'qty', 'hours', 'remarks', 'logged_by',
    ];

    protected function casts(): array
    {
        return [
            'log_date' => 'date',
            'qty'      => 'decimal:2',
            'hours'    => 'decimal:2',
        ];
    }

    public function step()       { return $this->belongsTo(OperationStep::class, 'operation_step_id'); }
    public function workOrder()  { return $this->belongsTo(WorkOrder::class); }
    public function item()       { return $this->belongsTo(WorkOrderItem::class, 'work_order_item_id'); }
    public function section()    { return $this->belongsTo(Section::class); }
    public function subSection() { return $this->belongsTo(Section::class, 'sub_section_id'); }
    public function machine()    { return $this->belongsTo(Machine::class); }
    public function operator()   { return $this->belongsTo(Operator::class); }
    public function loggedBy()   { return $this->belongsTo(User::class, 'logged_by'); }
}
