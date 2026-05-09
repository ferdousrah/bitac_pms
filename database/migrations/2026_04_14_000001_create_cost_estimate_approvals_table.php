<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('cost_estimate_approvals', function (Blueprint $table) {
            $table->id();
            $table->foreignId('cost_estimate_id')->constrained('cost_estimates')->cascadeOnDelete();
            $table->foreignId('approver_id')->constrained('users')->cascadeOnDelete();
            $table->unsignedTinyInteger('level'); // 1=Prepared, 2=Checked, 3=Approved
            $table->string('label', 50)->default('Approval'); // Prepared By, Checked By, Approved By
            $table->enum('status', ['pending', 'approved', 'rejected'])->default('pending');
            $table->text('remarks')->nullable();
            $table->timestamp('acted_at')->nullable();
            $table->timestamps();

            $table->unique(['cost_estimate_id', 'approver_id', 'level'], 'ce_approval_unique');
        });

        // Add status field to cost_estimates if not already supporting approval flow
        if (!Schema::hasColumn('cost_estimates', 'approval_status')) {
            Schema::table('cost_estimates', function (Blueprint $table) {
                $table->enum('approval_status', ['not_submitted', 'pending_approval', 'approved', 'rejected'])
                    ->default('not_submitted')->after('status');
            });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('cost_estimate_approvals');
        if (Schema::hasColumn('cost_estimates', 'approval_status')) {
            Schema::table('cost_estimates', function (Blueprint $table) {
                $table->dropColumn('approval_status');
            });
        }
    }
};
