<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Inertia\Inertia;
use Spatie\Permission\Models\Role;

class UserController extends Controller
{
    public function index(Request $request)
    {
        $query = User::with('roles');

        // Search
        if ($search = $request->input('search')) {
            $query->where(function ($q) use ($search) {
                $q->where('name', 'like', "%{$search}%")
                  ->orWhere('email', 'like', "%{$search}%");
            });
        }

        // Sorting
        $sort = $request->input('sort', 'id');
        $dir  = $request->input('dir', 'desc');
        $allowed = ['id', 'name', 'email', 'created_at'];
        if (in_array($sort, $allowed)) {
            $query->orderBy($sort, $dir === 'asc' ? 'asc' : 'desc');
        } else {
            $query->latest();
        }

        $users = $query->paginate(15)->withQueryString()
            ->through(fn($u) => [
                'id'         => $u->id,
                'name'       => $u->name,
                'email'      => $u->email,
                'roles'      => $u->roles->pluck('name'),
                'is_active'  => (bool) $u->is_active,
                'created_at' => $u->created_at->format('d/m/Y'),
            ]);

        return Inertia::render('Admin/Users/Index', [
            'users' => $users,
            'filters' => [
                'search' => $request->input('search', ''),
                'sort'   => $sort,
                'dir'    => $dir,
            ],
        ]);
    }

    public function create()
    {
        return Inertia::render('Admin/Users/CreateEdit', [
            'roles'    => Role::pluck('name'),
            'sections' => \App\Models\Section::active()->shops()->orderBy('display_order')->get(['id', 'name', 'code']),
        ]);
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'name'        => 'required|string|max:255',
            'email'       => 'required|email|unique:users',
            'phone'       => 'nullable|string|max:40',
            'designation' => 'nullable|string|max:120',
            'password'    => 'required|string|min:8|confirmed',
            'role'        => 'required|exists:roles,name',
            'section_id'  => 'nullable|exists:sections,id',
            'is_active'   => 'nullable|boolean',
            'signature'   => 'nullable|image|mimes:png,jpg,jpeg|max:2048',
        ]);

        $user = User::create([
            'name'           => $validated['name'],
            'email'          => $validated['email'],
            'phone'          => $validated['phone'] ?? null,
            'designation'    => $validated['designation'] ?? null,
            'password'       => $validated['password'], // cast 'hashed' auto-hashes
            'is_active'      => $validated['is_active'] ?? true,
            'section_id'     => $validated['section_id'] ?? null,
        ]);
        $user->assignRole($validated['role']);

        // A signature given on the create form becomes their first — and so
        // their default. More are added afterwards from the edit page, which
        // is where the full signature manager lives (it needs a user id).
        if ($request->hasFile('signature')) {
            \App\Models\UserSignature::create([
                'user_id'    => $user->id,
                'label'      => 'Signature',
                'path'       => $request->file('signature')->store('signatures', 'public'),
                'is_default' => true,
            ]);
        }

        return redirect()->route('admin.users.index')->with('success', 'User created.');
    }

    public function edit(User $user)
    {
        $user->load('roles');
        return Inertia::render('Admin/Users/CreateEdit', [
            'user'  => [
                'id'        => $user->id,
                'name'      => $user->name,
                'email'     => $user->email,
                'phone'     => $user->phone,
                'designation' => $user->designation,
                'signature_url' => $user->signature_url,
                // The user's signature blocks, default first — managed by
                // their own routes on the edit page, not by this form's submit.
                'signatures' => $user->signatures()->get(['id', 'label', 'path', 'is_default'])
                    ->map(fn ($s) => ['id' => $s->id, 'label' => $s->label, 'url' => $s->url, 'is_default' => $s->is_default])
                    ->values(),
                'is_active' => (bool) $user->is_active,
                'deactivation_reason' => $user->deactivation_reason,
                'roles'     => $user->roles->pluck('name'),
                'section_id'=> $user->section_id,
            ],
            'roles'    => Role::pluck('name'),
            'sections' => \App\Models\Section::active()->shops()->orderBy('display_order')->get(['id', 'name', 'code']),
        ]);
    }

    public function update(Request $request, User $user)
    {
        $validated = $request->validate([
            'name'                => 'required|string|max:255',
            'email'               => 'required|email|unique:users,email,' . $user->id,
            'phone'               => 'nullable|string|max:40',
            'designation'         => 'nullable|string|max:120',
            'role'                => 'required|exists:roles,name',
            'section_id'          => 'nullable|exists:sections,id',
            'is_active'           => 'nullable|boolean',
            'password'            => 'nullable|string|min:8',
            'deactivation_reason' => 'nullable|string|max:500',
        ]);

        $data = [
            'name'        => $validated['name'],
            'email'       => $validated['email'],
            'phone'       => $validated['phone'] ?? null,
            'designation' => $validated['designation'] ?? null,
            'section_id'  => $validated['section_id'] ?? null,
        ];

        // Signatures are NOT part of this form any more — a user may hold
        // several, so they are added, re-defaulted and removed one at a time
        // through UserSignatureController from the card on this page.

        // Password update (optional)
        if (!empty($validated['password'])) {
            $data['password'] = $validated['password']; // cast auto-hashes
        }

        // Active status handling
        $wasActive = (bool) $user->is_active;
        $willBeActive = $request->has('is_active') ? (bool) $validated['is_active'] : $wasActive;
        $data['is_active'] = $willBeActive;

        if ($wasActive && !$willBeActive) {
            // Deactivating
            $data['deactivated_at'] = now();
            $data['deactivation_reason'] = $validated['deactivation_reason'] ?? null;
        } elseif (!$wasActive && $willBeActive) {
            // Reactivating
            $data['deactivated_at'] = null;
            $data['deactivation_reason'] = null;
        }

        $user->update($data);
        $user->syncRoles([$validated['role']]);

        return redirect()->route('admin.users.index')->with('success', 'User updated.');
    }

    public function deactivate(Request $request, User $user)
    {
        if ($user->id === auth()->id()) {
            return back()->with('error', 'You cannot deactivate your own account.');
        }
        $user->update([
            'is_active'           => false,
            'deactivated_at'      => now(),
            'deactivation_reason' => $request->input('reason'),
        ]);
        return back()->with('success', 'User deactivated.');
    }

    public function activate(User $user)
    {
        $user->update([
            'is_active'           => true,
            'deactivated_at'      => null,
            'deactivation_reason' => null,
        ]);
        return back()->with('success', 'User activated.');
    }

    public function destroy(User $user)
    {
        $user->delete();
        return redirect()->route('admin.users.index')->with('success', 'User deleted.');
    }

    public function show(User $user)
    {
        return redirect()->route('admin.users.edit', $user);
    }
}
