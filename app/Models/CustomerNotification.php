<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class CustomerNotification extends Model
{
    protected $fillable = [
        'customer_id', 'work_order_id', 'type', 'title', 'message', 'link',
        'icon', 'color', 'data', 'is_read', 'read_at',
    ];

    protected function casts(): array
    {
        return [
            'is_read' => 'boolean',
            'read_at' => 'datetime',
            'data'    => 'array',
        ];
    }

    public function customer()  { return $this->belongsTo(Customer::class); }
    public function workOrder() { return $this->belongsTo(WorkOrder::class); }

    public function scopeUnread($q) { return $q->where('is_read', false); }

    public function markRead(): void
    {
        if ($this->is_read) return;
        $this->update(['is_read' => true, 'read_at' => now()]);
    }
}
