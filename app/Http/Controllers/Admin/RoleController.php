<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;

class RoleController extends Controller
{
    /** Roles that should never be edited or deleted from the UI */
    private const PROTECTED_ROLES = ['super-admin', 'super_admin'];

    public function index()
    {
        $roles = Role::with('permissions')
            ->withCount('users')
            ->orderBy('name')
            ->get()
            ->map(fn($r) => [
                'id'                => $r->id,
                'name'              => $r->name,
                'permissions_count' => $r->permissions->count(),
                'users_count'       => $r->users_count,
                'is_protected'      => in_array($r->name, self::PROTECTED_ROLES, true),
            ]);

        return Inertia::render('Admin/Roles/Index', [
            'roles'              => $roles,
            'total_permissions'  => Permission::count(),
        ]);
    }

    public function create()
    {
        return Inertia::render('Admin/Roles/CreateEdit', [
            'role'                  => null,
            'grouped_permissions'   => $this->groupedPermissions(),
            'assigned'              => [],
        ]);
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'name'          => ['required', 'string', 'max:100', 'unique:roles,name', 'regex:/^[a-z0-9\-_ ]+$/i'],
            'permissions'   => 'array',
            'permissions.*' => 'string|exists:permissions,name',
        ]);

        $role = Role::create(['name' => trim($validated['name'])]);
        $role->syncPermissions($validated['permissions'] ?? []);

        return redirect()->route('admin.roles.index')
            ->with('success', "Role \"{$role->name}\" created with " . count($validated['permissions'] ?? []) . " permission(s).");
    }

    public function edit(Role $role)
    {
        if (in_array($role->name, self::PROTECTED_ROLES, true)) {
            return redirect()->route('admin.roles.index')
                ->with('error', "The \"{$role->name}\" role is protected and cannot be edited.");
        }

        return Inertia::render('Admin/Roles/CreateEdit', [
            'role' => [
                'id'   => $role->id,
                'name' => $role->name,
            ],
            'grouped_permissions' => $this->groupedPermissions(),
            'assigned'            => $role->permissions->pluck('name')->toArray(),
        ]);
    }

    public function update(Request $request, Role $role)
    {
        if (in_array($role->name, self::PROTECTED_ROLES, true)) {
            return redirect()->route('admin.roles.index')
                ->with('error', "The \"{$role->name}\" role is protected and cannot be edited.");
        }

        $validated = $request->validate([
            'name'          => ['required', 'string', 'max:100', 'regex:/^[a-z0-9\-_ ]+$/i', Rule::unique('roles', 'name')->ignore($role->id)],
            'permissions'   => 'array',
            'permissions.*' => 'string|exists:permissions,name',
        ]);

        $role->update(['name' => trim($validated['name'])]);
        $role->syncPermissions($validated['permissions'] ?? []);

        return redirect()->route('admin.roles.index')
            ->with('success', "Role \"{$role->name}\" updated.");
    }

    public function destroy(Role $role)
    {
        if (in_array($role->name, self::PROTECTED_ROLES, true)) {
            return back()->with('error', "The \"{$role->name}\" role is protected and cannot be deleted.");
        }

        if ($role->users()->count() > 0) {
            return back()->with('error', "Cannot delete \"{$role->name}\" — {$role->users()->count()} user(s) are still assigned to it.");
        }

        $name = $role->name;
        $role->delete();

        return redirect()->route('admin.roles.index')
            ->with('success', "Role \"{$name}\" deleted.");
    }

    /**
     * Group permissions by their resource (the last word(s) after the verb).
     * "view rfqs"            → group "Rfqs"
     * "create qc-inspections" → group "Qc Inspections"
     */
    /**
     * Permissions whose stored name no longer says which screen they open.
     *
     * ⚠️ `view pcd-inbox` is what opens **Job Planning**: the screen was
     * renamed when the real PCD Inbox (the Executive Engineer's review step,
     * `review pcd-inbox`) was put in front of it, but the permission kept its
     * name so every role holding it kept working. Grouped by name, the role
     * screen showed it under "Pcd Inbox" and "Job Planning" appeared nowhere.
     * The names stay as they are — the sidebar, routes and seeders all key on
     * them; this only changes what the admin reads.
     *
     * name => [group, label]
     */
    private const DISPLAY = [
        'view pcd-inbox'   => ['PCD Job Planning', 'Job Planning — open the planning desk (PCD → Job Planning)'],
        'review pcd-inbox' => ['PCD Inbox', 'PCD Inbox — review and forward to Job Planning (PCD → PCD Inbox)'],
    ];

    private function groupedPermissions(): array
    {
        $verbs = ['view', 'create', 'edit', 'delete', 'manage', 'approve', 'reject', 'convert', 'run', 'start', 'stop', 'log', 'download', 'export', 'complete'];

        return Permission::orderBy('name')->get()
            ->groupBy(function ($p) use ($verbs) {
                if (isset(self::DISPLAY[$p->name])) {
                    return self::DISPLAY[$p->name][0];
                }
                $parts = explode(' ', $p->name, 2);
                if (count($parts) === 2 && in_array($parts[0], $verbs, true)) {
                    $resource = $parts[1];
                } else {
                    $resource = $p->name;
                }
                // Pretty group label: "qc-inspections" → "QC Inspections"
                return collect(explode('-', $resource))
                    ->map(fn($w) => strtoupper($w) === $w ? $w : ucfirst($w))
                    ->map(fn($w) => in_array(strtolower($w), ['qc', 'rfqs', 'ncrs', 'mrp', 'wip']) ? strtoupper($w) : $w)
                    ->implode(' ');
            })
            ->map(fn($items, $group) => [
                'group'       => $group,
                'permissions' => $items->map(fn($p) => [
                    'name'  => $p->name,
                    'label' => self::DISPLAY[$p->name][1] ?? ucfirst($p->name),
                ])->values(),
            ])
            ->sortBy('group')
            ->values()
            ->toArray();
    }
}
