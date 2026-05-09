<?php

namespace App\Events;

use App\Models\JobExecution;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcast;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class JobExecutionStarted implements ShouldBroadcast
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public function __construct(public JobExecution $jobExecution) {}

    public function broadcastOn(): array
    {
        return [new PrivateChannel('management')];
    }

    public function broadcastAs(): string
    {
        return 'JobExecutionStarted';
    }

    public function broadcastWith(): array
    {
        $je = $this->jobExecution;
        $step = $je->operationStep;
        $wo = $je->workOrder;
        $machine = $je->machine;

        return [
            'wo_number'       => $wo->wo_number ?? '',
            'product'         => $wo->product->name ?? '',
            'operator_name'   => $je->operator->name ?? '',
            'machine_name'    => $machine->name ?? '',
            'work_centre'     => $machine->workCentre->name ?? '',
            'started_at'      => $je->started_at?->toIso8601String(),
            'estimated_hours' => $step->estimated_hours ?? 0,
        ];
    }
}
