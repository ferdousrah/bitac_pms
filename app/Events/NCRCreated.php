<?php

namespace App\Events;

use App\Models\Ncr;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcast;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class NCRCreated implements ShouldBroadcast
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public function __construct(public Ncr $ncr) {}

    public function broadcastOn(): array
    {
        return [new PrivateChannel('management')];
    }

    public function broadcastAs(): string
    {
        return 'NCRCreated';
    }

    public function broadcastWith(): array
    {
        $ncr = $this->ncr;
        return [
            'ncr_number'     => $ncr->ncr_number,
            'wo_number'      => $ncr->workOrder->wo_number ?? '',
            'defect_type'    => $ncr->defect_type,
            'inspector_name' => $ncr->qcInspection->inspector->name ?? '',
            'created_at'     => $ncr->created_at->toIso8601String(),
        ];
    }
}
