<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    private array $tables = [
        'users',
        'customers',
        'machines',
        'work_centres',
        'products',
        'rfqs',
        'quotations',
        'work_orders',
        'operation_sheets',
        'production_schedules',
        'qc_inspections',
        'ncrs',
        'delivery_orders',
        'invoices',
        'material_requisitions',
        'audit_logs',
        'rework_orders',
        'boms',
    ];

    public function up(): void
    {
        foreach ($this->tables as $table) {
            if (Schema::hasTable($table) && !Schema::hasColumn($table, 'center_id')) {
                Schema::table($table, function (Blueprint $t) {
                    $t->foreignId('center_id')->nullable()->after('id')->constrained()->onDelete('cascade');
                });
            }
        }
    }

    public function down(): void
    {
        foreach ($this->tables as $table) {
            if (Schema::hasTable($table) && Schema::hasColumn($table, 'center_id')) {
                Schema::table($table, function (Blueprint $t) {
                    $t->dropForeign(['center_id']);
                    $t->dropColumn('center_id');
                });
            }
        }
    }
};
