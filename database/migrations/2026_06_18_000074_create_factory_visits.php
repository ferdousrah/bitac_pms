<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;

/**
 * IED's factory visits (BITAC, 2026-10-20) — two reports from one register:
 *
 *  - **Factory to be Visited** (পরিদর্শিতব্য কারখানা): `status = planned`, by `planned_date`.
 *  - **Factory Visited** (পরিদর্শিত কারখানা): `status = visited`, by `visited_on`.
 *
 * ⚠️ ONE table, not two: a planned visit that happens is the same visit.
 * "Mark as visited" fills `visited_on` + `visit_work` on the planned row, so it
 * leaves the to-be-visited list and lands in the visited one without being
 * typed again. A visit nobody planned is entered as visited directly
 * (`planned_date` NULL).
 *
 * The factory is picked from the stakeholders (`customer_id`) or typed, for a
 * factory that is not a client yet. `factory_name` is always stored — a
 * snapshot, so renaming the customer later does not rewrite a past visit.
 */
return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('factory_visits')) {
            Schema::create('factory_visits', function (Blueprint $table) {
                $table->id();
                $table->foreignId('center_id')->nullable()->constrained('centers')->nullOnDelete();
                $table->foreignId('customer_id')->nullable()->constrained('customers')->nullOnDelete();
                $table->string('factory_name', 200);
                $table->string('visitors', 500);            // a person or the whole delegation
                $table->string('status', 20)->default('planned')->index(); // planned | visited
                $table->date('planned_date')->nullable()->index();
                $table->date('visited_on')->nullable()->index();
                $table->text('visit_work')->nullable();     // what was done on the visit
                $table->text('remarks')->nullable();
                $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
                $table->foreignId('updated_by')->nullable()->constrained('users')->nullOnDelete();
                $table->timestamps();
            });
        }

        $manage = Permission::firstOrCreate(['name' => 'manage factory-visits', 'guard_name' => 'web']);
        foreach (['ied-officer', 'Executive Engineer (IED)'] as $name) {
            Role::where('name', $name)->where('guard_name', 'web')->first()?->givePermissionTo($manage);
        }
        app(\Spatie\Permission\PermissionRegistrar::class)->forgetCachedPermissions();
    }

    public function down(): void
    {
        Schema::dropIfExists('factory_visits');
        Permission::where('name', 'manage factory-visits')->delete();
        app(\Spatie\Permission\PermissionRegistrar::class)->forgetCachedPermissions();
    }
};
