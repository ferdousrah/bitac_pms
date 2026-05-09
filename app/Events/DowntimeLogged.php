<?php

namespace App\Events;

use App\Models\DowntimeEvent;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcast;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class DowntimeLogged implements ShouldBroadcast
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public function __construct(public DowntimeEvent $downtimeEvent) {}

    public function broadcastOn(): array
    {
        return [new PrivateChannel('management')];
    }

    public function broadcastAs(): string
    {
        return 'DowntimeLogged';
    }

    public function broadcastWith(): array
    {
        $event = $this->downtimeEvent;
        $machine = $event->machine;
        return [
            'machine_name' => $machine->name ?? '',
            'work_centre'  => $machine->workCentre->name ?? '',
            'category'     => $event->category,
            'description'  => $event->description,
            'started_at'   => $event->started_at?->toIso8601String(),
        ];
    }
}
