<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;

/**
 * IED uploads a job's completion certificate (BITAC, 2026-10-20).
 *
 * Until now a certificate could only come from the client, through the
 * customer portal. In practice the client hands BITAC a signed paper
 * certificate, and IED has to put it on the job.
 *
 *  - `source` says where a certificate came from: `customer` (the portal) or
 *    `ied` (scanned and uploaded by staff). Every existing row came from the
 *    portal, which is the column default.
 *  - `uploaded_by` is the officer who uploaded it; `client_ref_no` the
 *    client's own reference printed on the certificate.
 *
 * ⚠️ The IED menu entry was gated by `view completion-certificates`, which
 * only super-admin held — so IED never saw it. Both permissions go to the IED
 * roles here (and in BitacDepartmentRolesSeeder), `view` to management.
 * A seeder edit alone would only help a fresh install.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('completion_certificates', function (Blueprint $table) {
            if (! Schema::hasColumn('completion_certificates', 'source')) {
                $table->string('source', 20)->default('customer')->after('mode');
            }
            if (! Schema::hasColumn('completion_certificates', 'uploaded_by')) {
                $table->foreignId('uploaded_by')->nullable()->after('source')->constrained('users')->nullOnDelete();
            }
            if (! Schema::hasColumn('completion_certificates', 'client_ref_no')) {
                $table->string('client_ref_no', 100)->nullable()->after('issued_date');
            }
        });

        $view   = Permission::firstOrCreate(['name' => 'view completion-certificates', 'guard_name' => 'web']);
        $manage = Permission::firstOrCreate(['name' => 'manage completion-certificates', 'guard_name' => 'web']);

        foreach (['ied-officer', 'Executive Engineer (IED)'] as $name) {
            Role::where('name', $name)->where('guard_name', 'web')->first()?->givePermissionTo([$view, $manage]);
        }
        Role::where('name', 'management')->where('guard_name', 'web')->first()?->givePermissionTo($view);

        app(\Spatie\Permission\PermissionRegistrar::class)->forgetCachedPermissions();
    }

    public function down(): void
    {
        foreach (['ied-officer', 'Executive Engineer (IED)'] as $name) {
            Role::where('name', $name)->first()?->revokePermissionTo(['view completion-certificates', 'manage completion-certificates']);
        }
        Role::where('name', 'management')->first()?->revokePermissionTo('view completion-certificates');

        Schema::table('completion_certificates', function (Blueprint $table) {
            if (Schema::hasColumn('completion_certificates', 'uploaded_by')) {
                $table->dropConstrainedForeignId('uploaded_by');
            }
            foreach (['source', 'client_ref_no'] as $col) {
                if (Schema::hasColumn('completion_certificates', $col)) $table->dropColumn($col);
            }
        });

        app(\Spatie\Permission\PermissionRegistrar::class)->forgetCachedPermissions();
    }
};
