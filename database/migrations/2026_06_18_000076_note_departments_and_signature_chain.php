<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;

/**
 * Notes for every department, signed in order (BITAC, 2026-10-20).
 *
 * A note belongs to the DEPARTMENT (section) it comes from — `section_id`, and
 * `department_name` is what prints after "বিভাগঃ" (editable). The department
 * decides the signature chain — see App\Services\NoteWorkflow:
 *
 *   IED / PCD:      preparer → নির্বাহী প্রকৌশলী → কেন্দ্র প্রধান
 *   anything else:  preparer → নির্বাহী প্রকৌশলী → নির্বাহী প্রকৌশলী (পি.সি.ডি) → কেন্দ্র প্রধান
 *
 * `office_note_approvals` is one row per step after the preparer. Who may sign
 * a step is worked out when it is their turn (the pool), not stored — so giving
 * someone a role later takes effect on notes already waiting.
 *
 * Status: draft → pending → approved, or → returned (sent back with a comment;
 * the preparer edits and submits again). The old one-step "issued" is mapped to
 * approved — there were no notes when this ran, but a re-run must not strand one.
 *
 * Roles: there was NO centre-head role. `Centre Head` is created with
 * `head notes`; until somebody is given it, `management` signs for the centre
 * head (NoteWorkflow::pool). `use notes` opens the Notes screen and goes to every
 * department's roles.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('office_notes', function (Blueprint $table) {
            if (! Schema::hasColumn('office_notes', 'section_id')) {
                $table->foreignId('section_id')->nullable()->after('center_id')->constrained('sections')->nullOnDelete();
            }
            if (! Schema::hasColumn('office_notes', 'department_name')) {
                $table->string('department_name', 120)->nullable()->after('section_id');
            }
            if (! Schema::hasColumn('office_notes', 'preparer_signature_path')) {
                $table->string('preparer_signature_path')->nullable()->after('signature_path');
            }
            if (! Schema::hasColumn('office_notes', 'submitted_at')) {
                $table->timestamp('submitted_at')->nullable()->after('issued_at');
            }
            if (! Schema::hasColumn('office_notes', 'approved_at')) {
                $table->timestamp('approved_at')->nullable()->after('submitted_at');
            }
        });

        if (! Schema::hasTable('office_note_approvals')) {
            Schema::create('office_note_approvals', function (Blueprint $table) {
                $table->id();
                $table->foreignId('office_note_id')->constrained('office_notes')->cascadeOnDelete();
                $table->unsignedTinyInteger('level');
                $table->string('step', 20);                 // xen | pcd_xen | head
                $table->foreignId('section_id')->nullable()->constrained('sections')->nullOnDelete(); // whose XEN
                $table->string('status', 20)->default('pending'); // pending | approved | returned | skipped
                $table->string('skip_reason', 255)->nullable();
                $table->foreignId('acted_by')->nullable()->constrained('users')->nullOnDelete();
                $table->timestamp('acted_at')->nullable();
                $table->text('remarks')->nullable();
                $table->string('signature_path')->nullable();
                $table->timestamps();
                $table->index(['office_note_id', 'level']);
            });
        }

        DB::table('office_notes')->where('status', 'issued')->update(['status' => 'approved']);

        $use  = Permission::firstOrCreate(['name' => 'use notes', 'guard_name' => 'web']);
        $head = Permission::firstOrCreate(['name' => 'head notes', 'guard_name' => 'web']);

        Role::firstOrCreate(['name' => 'Centre Head', 'guard_name' => 'web'])
            ->givePermissionTo(['view dashboard', 'use notes', 'head notes']);

        foreach ([
            'ied-officer', 'Executive Engineer (IED)', 'Estimator', 'sales-officer',
            'pcd-officer', 'Executive Engineer (PCD)', 'Assistant Engineer (PCD)',
            'shop-incharge', 'Assistant Engineer (Shop)', 'Sub-Assistant Engineer (Shop)',
            'section_supervisor', 'production-supervisor',
            'qc-officer', 'qc-inspector', 'stores-officer', 'procurement-officer', 'finance-officer',
            'management',
        ] as $name) {
            Role::where('name', $name)->where('guard_name', 'web')->first()?->givePermissionTo($use);
        }

        app(\Spatie\Permission\PermissionRegistrar::class)->forgetCachedPermissions();
    }

    public function down(): void
    {
        Schema::dropIfExists('office_note_approvals');
        Schema::table('office_notes', function (Blueprint $table) {
            if (Schema::hasColumn('office_notes', 'section_id')) $table->dropConstrainedForeignId('section_id');
            foreach (['department_name', 'preparer_signature_path', 'submitted_at', 'approved_at'] as $col) {
                if (Schema::hasColumn('office_notes', $col)) $table->dropColumn($col);
            }
        });
        // The Centre Head role is not deleted while anyone holds it.
        $role = Role::where('name', 'Centre Head')->first();
        if ($role && $role->users()->count() === 0) $role->delete();
        Permission::whereIn('name', ['use notes', 'head notes'])->delete();
        app(\Spatie\Permission\PermissionRegistrar::class)->forgetCachedPermissions();
    }
};
