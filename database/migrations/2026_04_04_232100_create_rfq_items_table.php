<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('rfq_items', function (Blueprint $table) {
            $table->id();
            $table->foreignId('rfq_id')->constrained()->cascadeOnDelete();
            $table->foreignId('product_id')->nullable()->constrained('products')->nullOnDelete();
            $table->string('job_description', 500)->nullable();
            $table->decimal('quantity', 10, 2);
            $table->string('unit', 20)->default('pcs');
            $table->text('notes')->nullable();
            $table->timestamps();
        });

        // Migrate existing rfq data into items
        if (Schema::hasColumn('rfqs', 'product_id')) {
            \DB::statement("
                INSERT INTO rfq_items (rfq_id, product_id, job_description, quantity, unit, created_at, updated_at)
                SELECT id, product_id, job_description, COALESCE(quantity, 1), 'pcs', created_at, updated_at
                FROM rfqs
                WHERE product_id IS NOT NULL OR job_description IS NOT NULL
            ");
        }

        // Remove product_id, quantity, job_description from rfqs — now on rfq_items
        Schema::table('rfqs', function (Blueprint $table) {
            $table->dropForeign(['product_id']);
            $table->dropColumn(['product_id', 'quantity', 'job_description']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        // Restore columns on rfqs
        Schema::table('rfqs', function (Blueprint $table) {
            $table->foreignId('product_id')->nullable()->after('customer_id')->constrained('products')->nullOnDelete();
            $table->decimal('quantity', 10, 2)->nullable()->after('product_id');
            $table->string('job_description', 500)->nullable()->after('notes');
        });
        Schema::dropIfExists('rfq_items');
    }
};
