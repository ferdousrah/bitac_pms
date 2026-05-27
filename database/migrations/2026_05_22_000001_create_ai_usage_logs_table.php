<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Tracks every Gemini API call: who called, how many tokens, what it cost us
 * (Gemini-side) and what we plan to bill (markup). The "cost_usd" column is
 * BITAC's internal Gemini bill — sensitive, hide from non-super-admin views.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('ai_usage_logs', function (Blueprint $table) {
            $table->id();
            $table->foreignId('center_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('customer_id')->nullable()->constrained()->nullOnDelete();
            $table->morphs('actor');  // actor_type + actor_id → User OR Customer
            $table->string('model', 80)->default('gemini-2.5-flash');
            $table->unsignedInteger('input_tokens')->default(0);
            $table->unsignedInteger('output_tokens')->default(0);
            $table->unsignedInteger('total_tokens')->default(0);
            $table->decimal('cost_usd', 12, 8)->default(0);     // Gemini-side cost
            $table->decimal('billed_credits', 12, 4)->default(0); // What we'll bill the tenant
            $table->unsignedInteger('request_ms')->default(0);
            $table->unsignedInteger('tool_calls')->default(0);
            $table->string('status', 20)->default('ok');         // ok | error | timeout | quota_blocked
            $table->text('error_message')->nullable();
            $table->timestamps();

            $table->index(['center_id', 'created_at']);
            $table->index(['customer_id', 'created_at']);
            $table->index('created_at');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('ai_usage_logs');
    }
};
