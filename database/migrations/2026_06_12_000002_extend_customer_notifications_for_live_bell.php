<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('customer_notifications', function (Blueprint $t) {
            if (! Schema::hasColumn('customer_notifications', 'title')) {
                $t->string('title')->nullable()->after('type');
            }
            if (! Schema::hasColumn('customer_notifications', 'link')) {
                $t->string('link')->nullable()->after('message');
            }
            if (! Schema::hasColumn('customer_notifications', 'icon')) {
                $t->string('icon', 64)->nullable()->after('link');
            }
            if (! Schema::hasColumn('customer_notifications', 'color')) {
                $t->string('color', 32)->nullable()->after('icon');
            }
            if (! Schema::hasColumn('customer_notifications', 'read_at')) {
                $t->timestamp('read_at')->nullable()->after('is_read');
            }
            if (! Schema::hasColumn('customer_notifications', 'data')) {
                $t->json('data')->nullable()->after('color'); // arbitrary payload
            }
        });
    }

    public function down(): void
    {
        Schema::table('customer_notifications', function (Blueprint $t) {
            foreach (['title', 'link', 'icon', 'color', 'read_at', 'data'] as $c) {
                if (Schema::hasColumn('customer_notifications', $c)) $t->dropColumn($c);
            }
        });
    }
};
