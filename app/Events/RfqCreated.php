<?php

namespace App\Events;

use App\Models\Rfq;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class RfqCreated
{
    use Dispatchable, SerializesModels;

    public function __construct(public Rfq $rfq) {}
}
