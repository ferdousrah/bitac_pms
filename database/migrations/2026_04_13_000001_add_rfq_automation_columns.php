<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        // ── RFQs: track how it was created + duplicate link ──
        Schema::table('rfqs', function (Blueprint $table) {
            $table->enum('automation_source', ['manual', 'ai_chat'])->default('manual')->after('status');
            $table->foreignId('duplicate_of_rfq_id')->nullable()->after('automation_source')
                  ->constrained('rfqs')->nullOnDelete();
        });

        // ── Cost Estimates: track auto-generated estimates ──
        Schema::table('cost_estimates', function (Blueprint $table) {
            $table->enum('automation_source', ['manual', 'auto_estimated'])->default('manual')->after('status');
            $table->decimal('confidence_score', 5, 2)->nullable()->after('automation_source');
            $table->foreignId('source_estimate_id')->nullable()->after('confidence_score')
                  ->constrained('cost_estimates')->nullOnDelete();
        });

        // ── Quotations: auto-generation, approval, follow-up tracking ──
        Schema::table('quotations', function (Blueprint $table) {
            $table->enum('automation_source', ['manual', 'auto_generated'])->default('manual')->after('status');
            $table->boolean('auto_approval_eligible')->default(false)->after('automation_source');
            $table->timestamp('validity_expires_at')->nullable()->after('auto_approval_eligible');
            $table->unsignedInteger('followup_count')->default(0)->after('validity_expires_at');
            $table->timestamp('last_followup_at')->nullable()->after('followup_count');
        });

        // ── Quotation Approval Settings: amount thresholds ──
        if (Schema::hasTable('quotation_approval_settings')) {
            Schema::table('quotation_approval_settings', function (Blueprint $table) {
                $table->decimal('min_amount', 15, 2)->default(0)->after('level');
                $table->decimal('max_amount', 15, 2)->nullable()->after('min_amount');
            });
        }

        // ── Automation audit log ──
        Schema::create('rfq_automation_logs', function (Blueprint $table) {
            $table->id();
            $table->foreignId('rfq_id')->nullable()->constrained('rfqs')->cascadeOnDelete();
            $table->string('action', 50); // rfq_created, estimate_generated, quotation_generated, etc.
            $table->string('actor', 100); // system, ai, user:{id}
            $table->json('details')->nullable();
            $table->timestamp('created_at')->useCurrent();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('rfq_automation_logs');

        if (Schema::hasTable('quotation_approval_settings') && Schema::hasColumn('quotation_approval_settings', 'min_amount')) {
            Schema::table('quotation_approval_settings', function (Blueprint $table) {
                $table->dropColumn(['min_amount', 'max_amount']);
            });
        }

        Schema::table('quotations', function (Blueprint $table) {
            $table->dropColumn(['automation_source', 'auto_approval_eligible', 'validity_expires_at', 'followup_count', 'last_followup_at']);
        });

        Schema::table('cost_estimates', function (Blueprint $table) {
            $table->dropForeign(['source_estimate_id']);
            $table->dropColumn(['automation_source', 'confidence_score', 'source_estimate_id']);
        });

        Schema::table('rfqs', function (Blueprint $table) {
            $table->dropForeign(['duplicate_of_rfq_id']);
            $table->dropColumn(['automation_source', 'duplicate_of_rfq_id']);
        });
    }
};
