<?php

namespace App\Events;

use App\Models\WorkOrder;
use Illuminate\Broadcasting\Channel;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PresenceChannel;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcast;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class WorkOrderStatusUpdated implements ShouldBroadcast
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public function __construct(
        public WorkOrder $workOrder,
        public string $oldStatus,
        public string $newStatus,
    ) {}

    public function broadcastOn(): array
    {
        return [
            new PrivateChannel('management'),
            new PrivateChannel('customer.' . $this->workOrder->customer_id),
        ];
    }

    public function broadcastAs(): string
    {
        return 'WorkOrderStatusUpdated';
    }

    public function broadcastWith(): array
    {
        return [
            'wo_number'    => $this->workOrder->wo_number,
            'product'      => $this->workOrder->product->name ?? '',
            'customer'     => $this->workOrder->customer->name ?? '',
            'old_status'   => $this->oldStatus,
            'new_status'   => $this->newStatus,
            'status_label' => $this->workOrder->status_label,
            'status_color' => $this->workOrder->status_color,
            'updated_at'   => $this->workOrder->updated_at->toIso8601String(),
        ];
    }
}
