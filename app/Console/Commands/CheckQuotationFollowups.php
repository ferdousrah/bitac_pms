<?php

namespace App\Console\Commands;

use App\Services\RfqAutomationService;
use Illuminate\Console\Command;

class CheckQuotationFollowups extends Command
{
    protected $signature = 'quotations:check-followups';
    protected $description = 'Check for quotations nearing expiry and send follow-up notifications';

    public function handle(RfqAutomationService $service): int
    {
        $results = $service->checkFollowups();
        $this->info("Checked {$results['checked']} quotation(s), sent {$results['notified']} follow-up(s).");
        return 0;
    }
}
