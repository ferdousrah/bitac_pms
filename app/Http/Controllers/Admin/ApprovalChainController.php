<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\QuotationApprovalSetting;
use App\Models\User;
use Illuminate\Http\Request;
use Inertia\Inertia;

class ApprovalChainController extends Controller
{
    /**
     * Which chain is being edited. The same table drives quotations + cost
     * estimates (`quotation`) and work-order acceptance (`work_order`).
     */
    private function docType(Request $request): string
    {
        $type = $request->input('document_type', QuotationApprovalSetting::DOC_QUOTATION);

        return array_key_exists($type, QuotationApprovalSetting::DOC_TYPES)
            ? $type
            : QuotationApprovalSetting::DOC_QUOTATION;
    }

    /**
     * The centre this screen is configuring.
     *
     * Never null: a chain row with no centre belongs to nothing and silently
     * fails to apply — see `HasCenter`.
     */
    private function centerId(): ?int
    {
        return (app()->bound('current_center_id') ? app('current_center_id') : null)
            ?: (auth()->user()?->center_id)
            ?: \App\Models\Center::defaultId();
    }

    public function index(Request $request)
    {
        $docType = $this->docType($request);

        // ⚠️ Explicitly this centre's rows. The global scope does not filter
        // for a super admin with no centre selected, so the page used to list
        // every centre's chain at once — which read as "the chain is set up"
        // while documents at a given centre found nothing.
        $chain = QuotationApprovalSetting::with('approver')
            ->withoutGlobalScopes()
            ->where('center_id', $this->centerId())
            ->where('document_type', $docType)
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
            'chain'        => $chain,
            'users'        => $users,
            'documentType' => $docType,
            'documentTypes'=> QuotationApprovalSetting::DOC_TYPES,
        ]);
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'approver_id'   => 'required|exists:users,id',
            'label'         => 'nullable|string|max:100',
            'document_type' => 'nullable|string',
        ]);
        $docType = $this->docType($request);

        // Levels run 1..N within a centre AND a document type — the unique is
        // (center_id, document_type, level).
        $nextLevel = (QuotationApprovalSetting::withoutGlobalScopes()
            ->where('center_id', $this->centerId())
            ->where('document_type', $docType)
            ->max('level') ?? 0) + 1;

        QuotationApprovalSetting::create([
            'center_id'     => $this->centerId(),
            'document_type' => $docType,
            'level'         => $nextLevel,
            'approver_id'   => $validated['approver_id'],
            'label'         => $validated['label'] ?? "Level {$nextLevel} Approval",
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
        $level   = $approvalChain->level;
        $docType = $approvalChain->document_type;
        $approvalChain->delete();

        // Re-sequence levels after deletion — within THIS document type only,
        // or removing a quotation step would renumber the work-order chain.
        QuotationApprovalSetting::where('document_type', $docType)
            ->where('level', '>', $level)
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
