<?php

namespace App\Listeners;

use App\Events\RfqCreated;
use App\Models\Notification;
use App\Models\User;
use App\Services\RfqAutomationService;
use Illuminate\Contracts\Queue\ShouldQueue;

class TriggerAutoEstimation implements ShouldQueue
{
    public function __construct(private RfqAutomationService $service) {}

    public function handle(RfqCreated $event): void
    {
        $rfq = $event->rfq;
        $estimate = $this->service->autoEstimate($rfq);

        // Notify IED team
        $iedUsers = User::permission('view cost-estimates')->pluck('id');

        if ($estimate) {
            foreach ($iedUsers as $userId) {
                Notification::create([
                    'user_id' => $userId,
                    'type'    => 'auto_estimate',
                    'icon'    => 'fi-rr-calculator',
                    'color'   => 'green',
                    'title'   => 'Auto-Estimate Generated',
                    'body'    => "Auto-estimate {$estimate->estimate_no} created for RFQ (confidence: {$estimate->confidence_score}%). Please review.",
                    'link'    => "/cost-estimates/{$estimate->id}",
                ]);
            }
        } else {
            foreach ($iedUsers as $userId) {
                Notification::create([
                    'user_id' => $userId,
                    'type'    => 'manual_estimate_needed',
                    'icon'    => 'fi-rr-calculator',
                    'color'   => 'amber',
                    'title'   => 'Manual Estimate Needed',
                    'body'    => "No historical match found for RFQ from " . ($rfq->customer->name ?? 'customer') . ". Manual cost estimation required.",
                    'link'    => "/rfqs/{$rfq->id}",
                ]);
            }
        }
    }
}
