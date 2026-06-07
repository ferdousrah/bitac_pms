<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        // Expand the status enum to include `completed`.
        DB::statement("ALTER TABLE gate_passes MODIFY COLUMN status ENUM('draft','issued','completed','cancelled') NOT NULL DEFAULT 'issued'");

        Schema::table('gate_passes', function (Blueprint $t) {
            if (! Schema::hasColumn('gate_passes', 'completed_at')) {
                $t->timestamp('completed_at')->nullable()->after('issued_at');
            }
            if (! Schema::hasColumn('gate_passes', 'completed_by')) {
                $t->foreignId('completed_by')->nullable()->after('completed_at')
                    ->constrained('users')->nullOnDelete();
            }
            if (! Schema::hasColumn('gate_passes', 'completion_remarks')) {
                $t->text('completion_remarks')->nullable()->after('completed_by');
            }
            if (! Schema::hasColumn('gate_passes', 'cancelled_at')) {
                $t->timestamp('cancelled_at')->nullable()->after('completion_remarks');
            }
            if (! Schema::hasColumn('gate_passes', 'cancelled_by')) {
                $t->foreignId('cancelled_by')->nullable()->after('cancelled_at')
                    ->constrained('users')->nullOnDelete();
            }
            if (! Schema::hasColumn('gate_passes', 'cancellation_reason')) {
                $t->text('cancellation_reason')->nullable()->after('cancelled_by');
            }
        });
    }

    public function down(): void
    {
        Schema::table('gate_passes', function (Blueprint $t) {
            foreach (['cancelled_by', 'completed_by'] as $col) {
                if (Schema::hasColumn('gate_passes', $col)) {
                    try { $t->dropForeign([$col]); } catch (\Throwable $e) {}
                }
            }
            foreach (['completed_at', 'completed_by', 'completion_remarks',
                      'cancelled_at', 'cancelled_by', 'cancellation_reason'] as $col) {
                if (Schema::hasColumn('gate_passes', $col)) $t->dropColumn($col);
            }
        });
        DB::statement("ALTER TABLE gate_passes MODIFY COLUMN status ENUM('draft','issued','cancelled') NOT NULL DEFAULT 'issued'");
    }
};
