<?php

use Illuminate\Database\Migrations\Migration;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;

/**
 * Setting the yearly target is IED's job.
 *
 * It used to be implicit: whoever was a centre admin could set their centre's
 * figure, and a super admin could set any. BITAC's instruction is that the
 * target comes from IED, so it gets a permission of its own and the report
 * moves into IED → Reports.
 *
 * ⚠️ A seeder edit alone only helps a fresh install; on the live database the
 * form would appear for nobody.
 *
 * ⚠️ `super-admin` is deliberately NOT granted — `Gate::before` in
 * AuthServiceProvider already lets them past every permission check, so the
 * grant would add nothing. (Access and holding a permission are different
 * things; the same reasoning as `review pcd-inbox`.)
 */
return new class extends Migration
{
    private const ROLES = ['Executive Engineer (IED)', 'ied-officer', 'management'];

    public function up(): void
    {
        Permission::firstOrCreate(['name' => 'set targets', 'guard_name' => 'web']);

        foreach (self::ROLES as $name) {
            Role::where('name', $name)->first()?->givePermissionTo('set targets');
        }

        app()[\Spatie\Permission\PermissionRegistrar::class]->forgetCachedPermissions();
    }

    public function down(): void
    {
        Permission::where('name', 'set targets')->where('guard_name', 'web')->delete();
    }
};
