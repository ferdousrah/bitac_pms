<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\GatePassApprover;
use App\Models\User;
use Illuminate\Http\Request;
use Inertia\Inertia;

/**
 * Manage the pool of users who can approve PCD gate passes. Any ONE of them
 * approving finalises a pass. Lives under Users & Access.
 */
class GatePassApproverController extends Controller
{
    public function index()
    {
        $approvers = GatePassApprover::with('user:id,name,email')
            ->get()
            ->map(fn ($a) => [
                'id'    => $a->id,
                'user'  => $a->user ? ['id' => $a->user->id, 'name' => $a->user->name, 'email' => $a->user->email] : null,
                'added' => $a->created_at?->format('d M Y'),
            ])
            ->filter(fn ($a) => $a['user'])
            ->values();

        $approverIds = $approvers->pluck('user.id');

        return Inertia::render('Admin/GatePassApprovers/Index', [
            'approvers'   => $approvers,
            // Staff users not already in the pool — the "add" picker.
            'candidates'  => User::whereNotIn('id', $approverIds)
                ->orderBy('name')->get(['id', 'name', 'email']),
        ]);
    }

    public function store(Request $request)
    {
        $validated = $request->validate(['user_id' => 'required|exists:users,id']);
        GatePassApprover::firstOrCreate(['user_id' => $validated['user_id']]);
        return back()->with('success', 'Approver added.');
    }

    public function destroy(GatePassApprover $approver)
    {
        $approver->delete();
        return back()->with('success', 'Approver removed.');
    }
}
