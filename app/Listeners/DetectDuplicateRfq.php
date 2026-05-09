<?php

namespace App\Listeners;

use App\Events\RfqCreated;
use App\Models\Notification;
use App\Services\RfqAutomationService;
use Illuminate\Contracts\Queue\ShouldQueue;

class DetectDuplicateRfq implements ShouldQueue
{
    public function __construct(private RfqAutomationService $service) {}

    public function handle(RfqCreated $event): void
    {
        $rfq = $event->rfq;
        $rfq->load('items');

        $items = $rfq->items->map(fn($i) => [
            'product_id'      => $i->product_id,
            'job_description' => $i->job_description,
        ])->toArray();

        $duplicate = $this->service->detectDuplicate($rfq->customer_id, $items);

        if ($duplicate && $duplicate->id !== $rfq->id) {
            $rfq->update(['duplicate_of_rfq_id' => $duplicate->id]);

            // Warn the creator
            if ($rfq->created_by) {
                Notification::create([
                    'user_id' => $rfq->created_by,
                    'type'    => 'duplicate_rfq',
                    'icon'    => 'fi-rr-copy',
                    'color'   => 'amber',
                    'title'   => 'Possible Duplicate RFQ',
                    'body'    => "This RFQ may be a duplicate of a previous one for the same customer. Please verify.",
                    'link'    => "/rfqs/{$rfq->id}",
                ]);
            }
        }
    }
}
