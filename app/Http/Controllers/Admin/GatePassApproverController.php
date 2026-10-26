<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\GatePassApprover;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Inertia\Inertia;

/**
 * The pools of people who approve gate passes — one per DESK (BITAC,
 * 2026-10-27): IED's passes are approved by IED's নির্বাহী প্রকৌশলী, PCD's by
 * PCD's. Any ONE of a pool finalises a pass; a desk with an empty pool issues
 * its passes directly. Lives under Users & Access, per centre.
 */
class GatePassApproverController extends Controller
{
    /**
     * The permission that opens each desk's gate pass pages. An approver who
     * lacks it is told a pass is waiting and then cannot open it — so the
     * screen says so beside their name.
     */
    private const DESK_PERMISSION = ['ied' => 'manage gate-passes', 'pcd' => 'view pcd'];

    public function index()
    {
        $rows = GatePassApprover::with('user:id,name,email,is_active')->get()
            ->filter(fn ($a) => $a->user);

        $desks = [];
        foreach (GatePassApprover::DESKS as $key => $label) {
            $mine = $rows->where('desk', $key);
            $desks[$key] = [
                'label'     => $label,
                'approvers' => $mine->map(fn ($a) => [
                    'id'       => $a->id,
                    'user'     => ['id' => $a->user->id, 'name' => $a->user->name, 'email' => $a->user->email],
                    'added'    => $a->created_at?->format('d M Y'),
                    'can_open' => $a->user->can(self::DESK_PERMISSION[$key]),
                    'inactive' => ! $a->user->is_active,
                ])->values(),
                'candidates' => User::atCentre()->where('is_active', true)
                    ->whereNotIn('id', $mine->pluck('user_id'))
                    ->orderBy('name')->get(['id', 'name', 'email']),
            ];
        }

        return Inertia::render('Admin/GatePassApprovers/Index', [
            'desks'      => $desks,
            'centreName' => \App\Models\Center::whereKey(\App\Support\DocNumber::currentCentreId())->value('name'),
        ]);
    }

    public function store(Request $request)
    {
        $centre = app()->bound('current_center_id') ? app('current_center_id') : null;
        $validated = $request->validate([
            'desk'    => ['required', Rule::in(array_keys(GatePassApprover::DESKS))],
            'user_id' => ['required', Rule::exists('users', 'id')
                ->where(fn ($q) => $q->when($centre, fn ($x) => $x->where(fn ($w) => $w->whereNull('center_id')->orWhere('center_id', $centre))))],
        ]);
        GatePassApprover::firstOrCreate(['user_id' => $validated['user_id'], 'desk' => $validated['desk']]);

        return back()->with('success', GatePassApprover::DESKS[$validated['desk']] . ' gate pass approver added.');
    }

    public function destroy(GatePassApprover $approver)
    {
        $approver->delete();
        return back()->with('success', 'Approver removed.');
    }
}
