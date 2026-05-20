<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('customer_complaints', function (Blueprint $table) {
            $table->id();
            $table->foreignId('center_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('customer_id')->constrained()->cascadeOnDelete();
            $table->foreignId('work_order_id')->nullable()->constrained()->nullOnDelete();
            $table->string('reference_number', 20)->unique();
            $table->string('subject', 200);
            $table->text('message');
            $table->string('category', 30)->default('general'); // general | quality | delivery | billing | other
            $table->string('status', 20)->default('open');      // open | in_review | resolved | closed
            $table->text('response')->nullable();
            $table->foreignId('responded_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('responded_at')->nullable();
            $table->timestamps();

            $table->index(['customer_id', 'status']);
            $table->index('work_order_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('customer_complaints');
    }
};
