<?php

namespace App\Models;

use App\Events\DowntimeLogged;
use Illuminate\Database\Eloquent\Model;

class DowntimeEvent extends Model
{
    protected $fillable = [
        'job_execution_id', 'machine_id', 'category',
        'description', 'started_at', 'ended_at',
    ];

    protected function casts(): array
    {
        return [
            'started_at' => 'datetime',
            'ended_at'   => 'datetime',
        ];
    }

    protected static function boot(): void
    {
        parent::boot();

        static::created(function (DowntimeEvent $event) {
            if (config('broadcasting.default') !== 'null') {
                broadcast(new DowntimeLogged($event))->toOthers();
            }
        });
    }

    public function jobExecution()
    {
        return $this->belongsTo(JobExecution::class);
    }

    public function machine()
    {
        return $this->belongsTo(Machine::class);
    }
}
