<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\MorphTo;

class AiUsageLog extends Model
{
    protected $fillable = [
        'center_id', 'customer_id', 'actor_type', 'actor_id',
        'model', 'input_tokens', 'output_tokens', 'total_tokens',
        'cost_usd', 'billed_credits', 'request_ms', 'tool_calls',
        'status', 'error_message',
    ];

    protected function casts(): array
    {
        return [
            'cost_usd'       => 'decimal:8',
            'billed_credits' => 'decimal:4',
        ];
    }

    public function center()   { return $this->belongsTo(Center::class); }
    public function customer() { return $this->belongsTo(Customer::class); }
    public function actor(): MorphTo { return $this->morphTo(); }

    /** Gemini 2.5 Flash published rates (USD per million tokens) — input/output. */
    public const RATE_INPUT_PER_M  = 0.075;
    public const RATE_OUTPUT_PER_M = 0.30;

    /** Compute internal Gemini cost from token counts. */
    public static function calcCostUsd(int $inputTokens, int $outputTokens): float
    {
        return round(
            ($inputTokens  / 1_000_000) * self::RATE_INPUT_PER_M +
            ($outputTokens / 1_000_000) * self::RATE_OUTPUT_PER_M,
            8
        );
    }
}
