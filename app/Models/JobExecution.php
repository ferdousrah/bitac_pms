<?php

namespace App\Models;

use App\Events\JobExecutionStarted;
use App\Events\JobExecutionStopped;
use Illuminate\Database\Eloquent\Model;

class JobExecution extends Model
{
    protected $fillable = [
        'operation_step_id', 'work_order_id', 'operator_id', 'machine_id',
        'started_at', 'stopped_at', 'qty_completed', 'qty_rejected',
        'reject_reason', 'status',
    ];

    protected function casts(): array
    {
        return [
            'started_at' => 'datetime',
            'stopped_at' => 'datetime',
        ];
    }

    protected static function boot(): void
    {
        parent::boot();

        static::created(function (JobExecution $je) {
            if ($je->status === 'started' && config('broadcasting.default') !== 'null') {
                broadcast(new JobExecutionStarted($je))->toOthers();
            }
        });

        static::updated(function (JobExecution $je) {
            if ($je->isDirty('status') && $je->status === 'stopped') {
                if (config('broadcasting.default') !== 'null') {
                    broadcast(new JobExecutionStopped($je))->toOthers();
                }
            }
        });
    }

    public function operationStep()
    {
        return $this->belongsTo(OperationStep::class);
    }

    public function workOrder()
    {
        return $this->belongsTo(WorkOrder::class);
    }

    public function operator()
    {
        return $this->belongsTo(User::class, 'operator_id');
    }

    public function machine()
    {
        return $this->belongsTo(Machine::class);
    }

    public function downtimeEvents()
    {
        return $this->hasMany(DowntimeEvent::class);
    }

    public function getElapsedMinutesAttribute(): int
    {
        $start = $this->started_at;
        if (!$start) return 0;
        $end = $this->stopped_at ?? now();
        return (int) $start->diffInMinutes($end);
    }
}
