<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        // Assigned decision makers for each complaint.
        Schema::create('complaint_decision_makers', function (Blueprint $t) {
            $t->id();
            $t->foreignId('complaint_id')->constrained('customer_complaints')->cascadeOnDelete();
            $t->foreignId('user_id')->constrained()->cascadeOnDelete();
            $t->foreignId('added_by')->constrained('users');
            $t->timestamp('added_at')->useCurrent();
            $t->timestamps();
            $t->unique(['complaint_id', 'user_id']);
        });

        // Internal discussion stream — visible only to decision makers + IED officers.
        Schema::create('complaint_discussions', function (Blueprint $t) {
            $t->id();
            $t->foreignId('complaint_id')->constrained('customer_complaints')->cascadeOnDelete();
            $t->foreignId('user_id')->constrained();
            $t->text('message');
            $t->timestamps();
            $t->index(['complaint_id', 'created_at']);
        });

        // Track the confirmation/email audit on the complaint itself.
        Schema::table('customer_complaints', function (Blueprint $t) {
            if (! Schema::hasColumn('customer_complaints', 'decision_emailed_at')) {
                $t->timestamp('decision_emailed_at')->nullable()->after('responded_at');
            }
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('complaint_discussions');
        Schema::dropIfExists('complaint_decision_makers');
        Schema::table('customer_complaints', function (Blueprint $t) {
            if (Schema::hasColumn('customer_complaints', 'decision_emailed_at')) {
                $t->dropColumn('decision_emailed_at');
            }
        });
    }
};
