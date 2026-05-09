<?php

namespace App\Events;

use App\Models\JobExecution;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcast;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class JobExecutionStopped implements ShouldBroadcast
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public function __construct(public JobExecution $jobExecution) {}

    public function broadcastOn(): array
    {
        return [new PrivateChannel('management')];
    }

    public function broadcastAs(): string
    {
        return 'JobExecutionStopped';
    }

    public function broadcastWith(): array
    {
        $je = $this->jobExecution;
        return [
            'wo_number'     => $je->workOrder->wo_number ?? '',
            'qty_completed' => $je->qty_completed,
            'qty_rejected'  => $je->qty_rejected,
            'reject_reason' => $je->reject_reason,
            'stopped_at'    => $je->stopped_at?->toIso8601String(),
        ];
    }
}
