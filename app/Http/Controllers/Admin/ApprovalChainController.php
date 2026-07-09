<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\QuotationApprovalSetting;
use App\Models\User;
use Illuminate\Http\Request;
use Inertia\Inertia;

class ApprovalChainController extends Controller
{
    public function index()
    {
        $chain = QuotationApprovalSetting::with('approver')
            ->orderBy('level')
            ->get()
            ->map(fn($s) => [
                'id'           => $s->id,
                'level'        => $s->level,
                'label'        => $s->label,
                'approver_id'  => $s->approver_id,
                'approver_name'=> $s->approver?->name,
            ]);

        $users = User::orderBy('name')->get(['id', 'name']);

        return Inertia::render('Admin/ApprovalChain/Index', [
            'chain' => $chain,
            'users' => $users,
        ]);
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'approver_id' => 'required|exists:users,id',
            'label'       => 'nullable|string|max:100',
        ]);

        $nextLevel = (QuotationApprovalSetting::max('level') ?? 0) + 1;

        QuotationApprovalSetting::create([
            'level'       => $nextLevel,
            'approver_id' => $validated['approver_id'],
            'label'       => $validated['label'] ?? "Level {$nextLevel} Approval",
        ]);

        return back()->with('success', 'Approver added to chain.');
    }

    public function update(Request $request, QuotationApprovalSetting $approvalChain)
    {
        $validated = $request->validate([
            'approver_id' => 'required|exists:users,id',
            'label'       => 'nullable|string|max:100',
        ]);

        $approvalChain->update($validated);

        return back()->with('success', 'Approver updated.');
    }

    public function destroy(QuotationApprovalSetting $approvalChain)
    {
        $level = $approvalChain->level;
        $approvalChain->delete();

        // Re-sequence levels after deletion
        QuotationApprovalSetting::where('level', '>', $level)
            ->orderBy('level')
            ->each(function ($setting) use (&$level) {
                $setting->update(['level' => $level++]);
            });

        return back()->with('success', 'Approver removed from chain.');
    }

    public function reorder(Request $request)
    {
        $validated = $request->validate([
            'ids' => 'required|array',
            'ids.*' => 'exists:quotation_approval_settings,id',
        ]);

        // `level` has a UNIQUE index — assigning final levels directly collides
        // mid-swap (e.g. two rows briefly both level 1). Two-pass: park every row
        // at a high temp level first (the column is UNSIGNED so temps must stay
        // positive), then set the real 1..N levels.
        \Illuminate\Support\Facades\DB::transaction(function () use ($validated) {
            foreach ($validated['ids'] as $index => $id) {
                QuotationApprovalSetting::where('id', $id)->update(['level' => 100 + $index + 1]);
            }
            foreach ($validated['ids'] as $index => $id) {
                QuotationApprovalSetting::where('id', $id)->update(['level' => $index + 1]);
            }
        });

        return back()->with('success', 'Order updated.');
    }
}
