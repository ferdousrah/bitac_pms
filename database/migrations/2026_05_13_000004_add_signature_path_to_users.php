<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('users', function (Blueprint $t) {
            // Path (relative to the 'public' disk) of the user's scanned signature
            // image. Embedded into outgoing letters above the approver's name.
            $t->string('signature_path', 255)->nullable()->after('phone');
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $t) {
            $t->dropColumn('signature_path');
        });
    }
};
