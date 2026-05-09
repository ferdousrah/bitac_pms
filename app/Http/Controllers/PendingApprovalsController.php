<?php

namespace App\Http\Controllers;

use App\Models\CostEstimateApproval;
use App\Models\QuotationApproval;
use Illuminate\Http\Request;
use Inertia\Inertia;

class PendingApprovalsController extends Controller
{
    public function index(Request $request)
    {
        $userId = auth()->id();
        $tab    = $request->input('tab', 'pending');
        $type   = $request->input('type', 'all'); // all, quotation, estimate
        $search = $request->input('search', '');

        // ── Quotation Approvals ──
        $qQuery = QuotationApproval::with(['quotation.customer', 'quotation.rfq.items.product', 'quotation.createdBy'])
            ->where('approver_id', $userId);
        if ($tab !== 'all') $qQuery->where('status', $tab);
        if ($search) {
            $qQuery->whereHas('quotation', fn($q) => $q->where('id', 'like', "%{$search}%")
                ->orWhereHas('customer', fn($c) => $c->where('name', 'like', "%{$search}%")));
        }

        $quotationApprovals = ($type === 'estimate') ? collect() : $qQuery->latest()->get()->map(function ($a) {
            $q = $a->quotation;
            return [
                'id'          => $a->id,
                'type'        => 'quotation',
                'level'       => $a->level,
                'label'       => "Level {$a->level}",
                'status'      => $a->status,
                'remarks'     => $a->remarks,
                'acted_at'    => $a->approved_at?->format('d M Y H:i'),
                'ref_id'      => $q?->id,
                'ref_label'   => "Quotation Q-{$q?->id}",
                'ref_url'     => "/quotations/{$q?->id}",
                'customer'    => $q?->customer?->name ?? '—',
                'description' => $q?->rfq?->items->first()?->job_description ?? $q?->rfq?->items->first()?->product?->name ?? '—',
                'amount'      => $q?->total_amount,
                'created_by'  => $q?->createdBy?->name ?? '—',
                'created_at'  => $q?->created_at?->format('d M Y'),
            ];
        });

        // ── Cost Estimate Approvals ──
        $ceQuery = CostEstimateApproval::with(['costEstimate.customer', 'costEstimate.createdBy'])
            ->where('approver_id', $userId);
        if ($tab !== 'all') $ceQuery->where('status', $tab);
        if ($search) {
            $ceQuery->whereHas('costEstimate', fn($q) => $q->where('estimate_no', 'like', "%{$search}%")
                ->orWhere('job_name', 'like', "%{$search}%")
                ->orWhereHas('customer', fn($c) => $c->where('name', 'like', "%{$search}%")));
        }

        $estimateApprovals = ($type === 'quotation') ? collect() : $ceQuery->latest()->get()->map(function ($a) {
            $e = $a->costEstimate;
            return [
                'id'          => $a->id,
                'type'        => 'estimate',
                'level'       => $a->level,
                'label'       => $a->label,
                'status'      => $a->status,
                'remarks'     => $a->remarks,
                'acted_at'    => $a->acted_at?->format('d M Y H:i'),
                'ref_id'      => $e?->id,
                'ref_label'   => "Estimate {$e?->estimate_no}",
                'ref_url'     => "/cost-estimates/{$e?->id}",
                'customer'    => $e?->customer?->name ?? $e?->company_name ?? '—',
                'description' => $e?->job_name ?? '—',
                'amount'      => $e?->grand_total,
                'created_by'  => $e?->createdBy?->name ?? '—',
                'created_at'  => $e?->created_at?->format('d M Y'),
            ];
        });

        // Merge + paginate manually
        $all = $quotationApprovals->concat($estimateApprovals)->sortByDesc('created_at')->values();
        $page = (int) $request->input('page', 1);
        $perPage = 15;
        $paged = $all->slice(($page - 1) * $perPage, $perPage)->values();

        // Counts
        $counts = [
            'pending'  => QuotationApproval::where('approver_id', $userId)->where('status', 'pending')->count()
                        + CostEstimateApproval::where('approver_id', $userId)->where('status', 'pending')->count(),
            'approved' => QuotationApproval::where('approver_id', $userId)->where('status', 'approved')->count()
                        + CostEstimateApproval::where('approver_id', $userId)->where('status', 'approved')->count(),
            'rejected' => QuotationApproval::where('approver_id', $userId)->where('status', 'rejected')->count()
                        + CostEstimateApproval::where('approver_id', $userId)->where('status', 'rejected')->count(),
        ];

        return Inertia::render('Approvals/Index', [
            'approvals' => [
                'data'      => $paged,
                'total'     => $all->count(),
                'from'      => $all->count() > 0 ? ($page - 1) * $perPage + 1 : 0,
                'to'        => min($page * $perPage, $all->count()),
                'last_page' => (int) ceil($all->count() / $perPage),
            ],
            'counts'  => $counts,
            'filters' => [
                'tab'    => $tab,
                'type'   => $type,
                'search' => $search,
            ],
        ]);
    }

    // ── Quotation Approval Actions ──
    public function approve(Request $request, QuotationApproval $approval)
    {
        abort_unless($approval->approver_id === auth()->id() && $approval->status === 'pending', 403);
        $approval->update(['status' => 'approved', 'remarks' => $request->input('remarks'), 'approved_at' => now()]);
        if ($approval->quotation->approvals()->where('status', '!=', 'approved')->doesntExist()) {
            $approval->quotation->update(['status' => 'approved']);
        }
        return back()->with('success', 'Quotation approved.');
    }

    public function reject(Request $request, QuotationApproval $approval)
    {
        abort_unless($approval->approver_id === auth()->id() && $approval->status === 'pending', 403);
        $request->validate(['remarks' => 'required|string|max:500']);
        $approval->update(['status' => 'rejected', 'remarks' => $request->input('remarks'), 'approved_at' => now()]);
        $approval->quotation->update(['status' => 'rejected']);
        return back()->with('success', 'Quotation rejected.');
    }

    // ── Cost Estimate Approval Actions ──
    public function approveEstimate(Request $request, CostEstimateApproval $approval)
    {
        abort_unless($approval->approver_id === auth()->id() && $approval->status === 'pending', 403);
        $approval->update(['status' => 'approved', 'remarks' => $request->input('remarks'), 'acted_at' => now()]);
        $ce = $approval->costEstimate;
        if ($ce->approvals()->where('status', '!=', 'approved')->doesntExist()) {
            $ce->update(['approval_status' => 'approved', 'status' => 'finalized']);
        }
        return back()->with('success', 'Estimate approved.');
    }

    public function rejectEstimate(Request $request, CostEstimateApproval $approval)
    {
        abort_unless($approval->approver_id === auth()->id() && $approval->status === 'pending', 403);
        $request->validate(['remarks' => 'required|string|max:500']);
        $approval->update(['status' => 'rejected', 'remarks' => $request->input('remarks'), 'acted_at' => now()]);
        $approval->costEstimate->update(['approval_status' => 'rejected']);
        return back()->with('success', 'Estimate rejected.');
    }
}
