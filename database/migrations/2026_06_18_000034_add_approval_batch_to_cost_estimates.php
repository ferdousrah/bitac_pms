<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * A cost estimate can be sent for approval on its own, or together with
 * every other part estimate of the same job.
 *
 * Job-wise submission stamps one shared batch id across the estimates that
 * went in together, so an approver's single decision covers all of them.
 * NULL = submitted individually, which is the original behaviour and stays
 * available — the preparer picks per submission.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('cost_estimates', function (Blueprint $table) {
            $table->char('approval_batch', 36)->nullable()->after('approval_status');
            $table->index('approval_batch');
        });
    }

    public function down(): void
    {
        Schema::table('cost_estimates', function (Blueprint $table) {
            $table->dropIndex(['approval_batch']);
            $table->dropColumn('approval_batch');
        });
    }
};
