<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Section-level partial forward ledger. A section produces pieces (tracked
     * by operation-step completed_qty); the supervisor then explicitly TRANSFERS
     * a quantity downstream. The next section can only work on what it has
     * received. No more auto-forward on production logging.
     *
     *  - received_qty : how much has been handed to this section from upstream.
     *                   NULL = ungated. The first section in a routing is ungated
     *                   (raw material available); downstream sections start gated.
     *  - forwarded_qty: how much this section has already transferred downstream.
     */
    public function up(): void
    {
        Schema::table('work_order_sections', function (Blueprint $table) {
            $table->decimal('received_qty', 12, 2)->nullable()->after('weight_pct');
            $table->decimal('forwarded_qty', 12, 2)->default(0)->after('received_qty');
        });
    }

    public function down(): void
    {
        Schema::table('work_order_sections', function (Blueprint $table) {
            $table->dropColumn(['received_qty', 'forwarded_qty']);
        });
    }
};
