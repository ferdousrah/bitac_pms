<?php

namespace App\Http\Controllers;

use App\Models\CostEstimate;
use App\Models\EntityRevision;
use App\Models\Customer;
use App\Models\MachiningOperation;
use App\Models\Material;
use App\Models\Rfq;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;

class CostEstimateController extends Controller
{
    public function index(Request $request)
    {
        $query = CostEstimate::with('customer', 'createdBy', 'rfqItem', 'rfq');

        if ($search = $request->input('search')) {
            $query->where(function ($q) use ($search) {
                $q->where('estimate_no', 'like', "%{$search}%")
                  ->orWhere('job_name', 'like', "%{$search}%")
                  ->orWhere('company_name', 'like', "%{$search}%")
                  ->orWhereHas('customer', fn($c) => $c->where('name', 'like', "%{$search}%"));
            });
        }
        if ($status = $request->input('status')) $query->where('status', $status);
        if ($group = $request->input('pricing_group')) $query->where('pricing_group', $group);

        $sort = $request->input('sort', 'id');
        $dir  = $request->input('dir', 'desc');
        $allowed = ['id', 'estimate_no', 'job_name', 'pricing_group', 'grand_total', 'status', 'created_at'];
        if (in_array($sort, $allowed)) {
            $query->orderBy($sort, $dir === 'asc' ? 'asc' : 'desc');
        } else {
            $query->latest();
        }

        $estimates = $query->paginate(15)->withQueryString()
            ->through(fn($e) => [
                'id'            => $e->id,
                'estimate_no'   => $e->estimate_no,
                'job_name'      => $e->job_name,
                'company_name'  => $e->company_name ?? $e->customer?->name,
                'customer'      => $e->customer?->name,
                'pricing_group' => $e->pricing_group,
                'grand_total'   => $e->grand_total,
                'status'        => $e->status,
                'created_by'    => $e->createdBy?->name ?? '—',
                'created_at'    => $e->created_at->format('d M Y'),
                'rfq_id'        => $e->rfq_id,
                'rfq_item_id'   => $e->rfq_item_id,
                'rfq_item_desc' => $e->rfqItem?->job_description,
            ]);

        return Inertia::render('CostEstimate/Index', [
            'estimates' => $estimates,
            'filters'   => [
                'search'        => $request->input('search', ''),
                'status'        => $request->input('status', ''),
                'pricing_group' => $request->input('pricing_group', ''),
                'sort'          => $sort,
                'dir'           => $dir,
            ],
        ]);
    }

    public function create(Request $request)
    {
        // Prefer per-item creation: ?rfq_item_id=X
        $rfqItem = null;
        $rfq = null;
        if ($request->query('rfq_item_id')) {
            $rfqItem = \App\Models\RfqItem::with(['rfq.customer', 'product'])->find($request->query('rfq_item_id'));
            if ($rfqItem) $rfq = $rfqItem->rfq;
        } elseif ($request->query('rfq_id')) {
            // Back-compat: if only rfq_id given, load whole RFQ
            $rfq = Rfq::with('customer', 'items.product')->find($request->query('rfq_id'));
        }

        return Inertia::render('CostEstimate/Form', [
            'estimate'   => null,
            'rfq'        => $rfq ? [
                'id'           => $rfq->id,
                'customer_id'  => $rfq->customer_id,
                'customer_name'=> $rfq->customer?->name,
                'items'        => $rfq->items->map(fn($i) => [
                    'id'          => $i->id,
                    'description' => $i->job_description ?? $i->product?->name,
                    'quantity'    => $i->quantity,
                    'unit'        => $i->unit,
                ]),
            ] : null,
            'rfqItem'    => $rfqItem ? [
                'id'              => $rfqItem->id,
                'rfq_id'          => $rfqItem->rfq_id,
                'job_description' => $rfqItem->job_description ?? $rfqItem->product?->name,
                'quantity'        => $rfqItem->quantity,
                'unit'            => $rfqItem->unit,
                'product_name'    => $rfqItem->product?->name,
                'customer_id'     => $rfqItem->rfq?->customer_id,
                'customer_name'   => $rfqItem->rfq?->customer?->name,
            ] : null,
            'materials'  => Material::active()->orderBy('name')->get(['id', 'name', 'category', 'rate_per_kg', 'density_kg_m3', 'density_kg_in3']),
            'operations' => MachiningOperation::active()->orderBy('category')->orderBy('name')
                ->get(['id', 'name', 'category', 'default_unit', 'rate_group_a', 'rate_group_b', 'rate_group_c']),
            'customers'  => Customer::where('is_active', true)->orderBy('name')->get(['id', 'name']),
        ]);
    }

    public function store(Request $request)
    {
        $validated = $this->validateEstimate($request);

        $estimate = DB::transaction(function () use ($validated) {
            // If rfq_item_id given, auto-populate rfq_id from it
            $rfqId = $validated['rfq_id'] ?? null;
            if (!empty($validated['rfq_item_id'])) {
                $item = \App\Models\RfqItem::find($validated['rfq_item_id']);
                if ($item) $rfqId = $item->rfq_id;
            }

            $estimate = CostEstimate::create([
                'estimate_no'      => CostEstimate::generateEstimateNo(),
                'rfq_id'           => $rfqId,
                'rfq_item_id'      => $validated['rfq_item_id'] ?? null,
                'customer_id'      => $validated['customer_id'] ?? null,
                'company_name'     => $validated['company_name'] ?? null,
                'job_name'         => $validated['job_name'],
                'part_no'          => $validated['part_no'] ?? null,
                'actual_size'      => $validated['actual_size'] ?? null,
                'materials_size'   => $validated['materials_size'] ?? null,
                'pricing_group'    => $validated['pricing_group'],
                'overhead_pct'     => $validated['overhead_pct'] ?? 0,
                'vat_pct'          => $validated['vat_pct'] ?? 15,
                'times_multiplier' => $validated['times_multiplier'] ?? 1,
                'job_quantity'     => $validated['job_quantity'] ?? 1,
                'notes'            => $validated['notes'] ?? null,
                'status'           => 'draft',
                'created_by'       => auth()->id(),
            ]);

            $this->saveLines($estimate, $validated['lines'] ?? []);
            $estimate->recalculate();
            return $estimate;
        });

        app(\App\Services\RevisionTracker::class)->trackEstimate($estimate->fresh(), 'created');

        return redirect()->route('cost-estimates.show', $estimate)->with('success', 'Cost estimate saved.');
    }

    public function show(CostEstimate $costEstimate)
    {
        $costEstimate->load(
            'lines.material', 'lines.operation', 'customer', 'createdBy',
            'rfq', 'rfqItem.product', 'rfqItem.drawings', 'rfqItem.samplePhotos',
            'quotation', 'approvals.approver'
        );

        // RFQ attachments flow through to the cost estimate — same drawings and
        // sample photos the sales officer uploaded on the RFQ item.
        $rfqAttachments = [];
        if ($costEstimate->rfqItem) {
            $item = $costEstimate->rfqItem;
            $rfqAttachments = [[
                'item_id'          => $item->id,
                'job_description'  => $item->job_description ?? $item->product?->name,
                'reference_type'   => $item->reference_type ?? 'none',
                'sample_received'  => (bool) $item->sample_received,
                'sample_description' => $item->sample_description,
                'drawings'         => $item->drawings->map(fn($f) => [
                    'id'        => $f->id,
                    'url'       => $f->url,
                    'filename'  => $f->original_name,
                    'extension' => pathinfo($f->original_name, PATHINFO_EXTENSION),
                ])->values(),
                'sample_photos'    => $item->samplePhotos->map(fn($f) => [
                    'id'        => $f->id,
                    'url'       => $f->url,
                    'filename'  => $f->original_name,
                ])->values(),
            ]];
        }

        // Load revision history
        $revisions = EntityRevision::where('entity_type', 'cost_estimate')
            ->where('entity_id', $costEstimate->id)
            ->with('changedBy:id,name')
            ->orderByDesc('revision_no')
            ->get()
            ->map(function ($r) {
                $meta = EntityRevision::eventMeta($r->event);
                return [
                    'id'             => $r->id,
                    'revision_no'    => $r->revision_no,
                    'event'          => $r->event,
                    'event_label'    => $meta['label'],
                    'event_icon'     => $meta['icon'],
                    'event_color'    => $meta['color'],
                    'grand_total_at' => $r->grand_total_at,
                    'change_reason'  => $r->change_reason,
                    'auto_summary'   => $r->auto_summary,
                    'changes'        => $r->changes,
                    'changed_by'     => $r->changedBy?->name ?? '—',
                    'created_at'     => $r->created_at->format('d M Y, H:i'),
                    'created_at_diff'=> $r->created_at->diffForHumans(),
                ];
            });
        $user = auth()->user();

        $pendingApproval = $costEstimate->approvals()
            ->where('approver_id', $user->id)
            ->where('status', 'pending')
            ->exists();

        $estimate = $this->serializeEstimate($costEstimate);
        $estimate['approval_status'] = $costEstimate->approval_status ?? 'not_submitted';
        $estimate['approvals'] = $costEstimate->approvals->map(fn($a) => [
            'id'       => $a->id,
            'level'    => $a->level,
            'label'    => $a->label,
            'status'   => $a->status,
            'approver' => ['name' => $a->approver?->name],
            'remarks'  => $a->remarks,
            'acted_at' => $a->acted_at?->format('d M Y H:i'),
        ])->values();

        // Only the preparer (creator) can submit the estimate for approval.
        // Super admins are allowed too as a safety-net.
        $isCreator = $costEstimate->created_by === $user->id;
        $isSuperAdmin = method_exists($user, 'hasRole') && $user->hasRole('super_admin');

        // Comment thread
        $comments = \App\Models\EntityComment::forEntity('cost_estimate', $costEstimate->id)
            ->with('user:id,name')
            ->orderBy('created_at')
            ->get()
            ->map(fn($c) => [
                'id'              => $c->id,
                'body'            => $c->body,
                'kind'            => $c->kind,
                'user'            => $c->user ? ['id' => $c->user->id, 'name' => $c->user->name] : null,
                'created_at'      => $c->created_at->format('d M Y, H:i'),
                'created_at_diff' => $c->created_at->diffForHumans(),
                'can_delete'      => $c->user_id === $user->id || $isSuperAdmin,
            ]);

        return Inertia::render('CostEstimate/Show', [
            'estimate'        => $estimate,
            'revisions'       => $revisions,
            'rfqAttachments'  => $rfqAttachments,
            'comments'        => $comments,
            'canSubmit'       => $costEstimate->approval_status === 'not_submitted'
                                && $costEstimate->status === 'draft'
                                && ($isCreator || $isSuperAdmin),
            'canApprove'      => $pendingApproval,
            'canReject'       => $pendingApproval,
        ]);
    }

    public function submitForApproval(CostEstimate $costEstimate)
    {
        abort_unless($costEstimate->approval_status === 'not_submitted', 422, 'Already submitted.');

        // Only the preparer (creator) — or a super admin — can submit for approval.
        $user = auth()->user();
        $isCreator = $costEstimate->created_by === $user->id;
        $isSuperAdmin = method_exists($user, 'hasRole') && $user->hasRole('super_admin');
        if (!$isCreator && !$isSuperAdmin) {
            return back()->with('error', 'Only the preparer can submit this estimate for approval.');
        }

        // Use the same approval chain settings as quotations
        $settings = \App\Models\QuotationApprovalSetting::orderBy('level')->get();

        // Pick labels based on the number of approvers in the chain.
        // Last level is always "Approved By" (the final sign-off).
        // 1 approver  → [Approved By]
        // 2 approvers → [Checked By, Approved By]
        // 3 approvers → [Prepared By, Checked By, Approved By]
        // 4+ approvers → first ones get "Reviewer N" and last is "Approved By"
        $chainLabels = function (int $total): array {
            return match (true) {
                $total <= 1 => ['Approved By'],
                $total === 2 => ['Checked By', 'Approved By'],
                $total === 3 => ['Prepared By', 'Checked By', 'Approved By'],
                default => array_merge(
                    array_map(fn($i) => "Reviewer {$i}", range(1, $total - 1)),
                    ['Approved By']
                ),
            };
        };

        if ($settings->isEmpty()) {
            // Fallback: use management users
            $managers = \App\Models\User::role('management')->take(2)->get();
            $labels = $chainLabels($managers->count());
            $level = 1;
            foreach ($managers as $manager) {
                \App\Models\CostEstimateApproval::create([
                    'cost_estimate_id' => $costEstimate->id,
                    'approver_id'      => $manager->id,
                    'level'            => $level,
                    'label'            => $labels[$level - 1] ?? "Level {$level}",
                    'status'           => 'pending',
                ]);
                $level++;
            }
        } else {
            $labels = $chainLabels($settings->count());
            foreach ($settings as $i => $setting) {
                \App\Models\CostEstimateApproval::create([
                    'cost_estimate_id' => $costEstimate->id,
                    'approver_id'      => $setting->approver_id,
                    'level'            => $setting->level,
                    // Prefer setting's own label if it looks custom (not the default "Level X Approval")
                    'label'            => ($setting->label && !preg_match('/^Level \d+/', $setting->label))
                                            ? $setting->label
                                            : ($labels[$i] ?? "Level {$setting->level}"),
                    'status'           => 'pending',
                ]);
            }
        }

        $costEstimate->update(['approval_status' => 'pending_approval']);

        // Notify approvers
        $ids = $costEstimate->approvals()->pluck('approver_id')->toArray();
        if (!empty($ids)) {
            \App\Services\NotifyService::send($ids, 'estimate_approval', 'Cost Estimate Needs Approval',
                "Estimate {$costEstimate->estimate_no} (৳" . number_format((float) $costEstimate->grand_total) . ") needs your approval",
                "/cost-estimates/{$costEstimate->id}", 'fi-rr-calculator', 'amber');
        }

        app(\App\Services\RevisionTracker::class)->trackEstimate($costEstimate->fresh(), 'submitted_for_approval');

        return back()->with('success', 'Submitted for approval.');
    }

    public function approveEstimate(Request $request, CostEstimate $costEstimate)
    {
        $approval = $costEstimate->approvals()
            ->where('approver_id', auth()->id())
            ->where('status', 'pending')
            ->first();

        if (!$approval) {
            return back()->with('error', 'No pending approval found for you on this estimate. It may have already been actioned.');
        }

        $approval->update([
            'status'  => 'approved',
            'remarks' => $request->input('remarks'),
            'acted_at'=> now(),
        ]);

        // Check if all levels approved
        $allApproved = $costEstimate->approvals()->where('status', '!=', 'approved')->doesntExist();
        if ($allApproved) {
            $costEstimate->update(['approval_status' => 'approved', 'status' => 'finalized']);
        }

        app(\App\Services\RevisionTracker::class)->trackEstimate(
            $costEstimate->fresh(),
            'approved',
            $request->input('remarks')
        );

        // Notify the preparer (creator) that the estimate was approved
        if ($costEstimate->created_by) {
            $remark = $request->input('remarks');
            $body = $allApproved
                ? "Your cost estimate {$costEstimate->estimate_no} has been fully approved."
                : "Your cost estimate {$costEstimate->estimate_no} was approved by " . auth()->user()->name . ".";
            if ($remark) $body .= "\nNote: \"{$remark}\"";

            \App\Services\NotifyService::send(
                $costEstimate->created_by,
                'estimate_approved',
                'Cost Estimate Approved',
                $body,
                "/cost-estimates/{$costEstimate->id}",
                'fi-rr-check-circle',
                'green'
            );
        }

        return back()->with('success', 'Estimate approved.');
    }

    public function rejectEstimate(Request $request, CostEstimate $costEstimate)
    {
        $request->validate(['remarks' => 'required|string|max:1000']);

        $approval = $costEstimate->approvals()
            ->where('approver_id', auth()->id())
            ->where('status', 'pending')
            ->first();

        if (!$approval) {
            return back()->with('error', 'No pending approval found for you on this estimate. It may have already been actioned.');
        }

        $approval->update([
            'status'  => 'rejected',
            'remarks' => $request->input('remarks'),
            'acted_at'=> now(),
        ]);

        $costEstimate->update(['approval_status' => 'rejected']);

        app(\App\Services\RevisionTracker::class)->trackEstimate(
            $costEstimate->fresh(),
            'rejected',
            $request->input('remarks')
        );

        // Notify the preparer that their estimate was rejected
        if ($costEstimate->created_by) {
            $remark = $request->input('remarks');
            \App\Services\NotifyService::send(
                $costEstimate->created_by,
                'estimate_rejected',
                'Cost Estimate Rejected',
                "Your cost estimate {$costEstimate->estimate_no} was rejected by " . auth()->user()->name . ".\nReason: \"{$remark}\"",
                "/cost-estimates/{$costEstimate->id}",
                'fi-rr-cross-circle',
                'red'
            );
        }

        return back()->with('success', 'Estimate rejected.');
    }

    /**
     * Request changes — send the estimate back to the preparer with a note.
     * Resets approval chain so the preparer can edit and resubmit.
     */
    public function requestChangesEstimate(Request $request, CostEstimate $costEstimate)
    {
        $request->validate(['remarks' => 'required|string|max:1000']);

        $approval = $costEstimate->approvals()
            ->where('approver_id', auth()->id())
            ->where('status', 'pending')
            ->first();

        if (!$approval) {
            return back()->with('error', 'No pending approval found for you on this estimate. It may have already been actioned.');
        }

        // Keep a history note on the approval record
        $approval->update([
            'status'  => 'rejected', // in DB it's rejected, but with a "changes requested" flavor via notes
            'remarks' => '[Changes Requested] ' . $request->input('remarks'),
            'acted_at'=> now(),
        ]);

        // Send back to draft so preparer can edit and resubmit
        $costEstimate->update([
            'approval_status' => 'not_submitted',
            'status'          => 'draft',
        ]);

        // Clear approvals so the chain restarts when resubmitted
        $costEstimate->approvals()->delete();

        app(\App\Services\RevisionTracker::class)->trackEstimate(
            $costEstimate->fresh(),
            'changes_requested',
            $request->input('remarks')
        );

        // Notify the preparer that corrections are needed
        if ($costEstimate->created_by) {
            $remark = $request->input('remarks');
            \App\Services\NotifyService::send(
                $costEstimate->created_by,
                'estimate_changes_requested',
                'Changes Requested on Cost Estimate',
                auth()->user()->name . " has requested changes on {$costEstimate->estimate_no}.\n\"{$remark}\"\n\nPlease review, update, and resubmit for approval.",
                "/cost-estimates/{$costEstimate->id}/edit",
                'fi-rr-edit',
                'amber'
            );
        }

        return back()->with('success', 'Changes requested. The estimate is back with the preparer.');
    }

    public function edit(CostEstimate $costEstimate)
    {
        $costEstimate->load('lines.material', 'lines.operation');

        return Inertia::render('CostEstimate/Form', [
            'estimate'   => $this->serializeEstimate($costEstimate),
            'rfq'        => null,
            'materials'  => Material::active()->orderBy('name')->get(['id', 'name', 'category', 'rate_per_kg', 'density_kg_m3', 'density_kg_in3']),
            'operations' => MachiningOperation::active()->orderBy('category')->orderBy('name')
                ->get(['id', 'name', 'category', 'default_unit', 'rate_group_a', 'rate_group_b', 'rate_group_c']),
            'customers'  => Customer::where('is_active', true)->orderBy('name')->get(['id', 'name']),
        ]);
    }

    public function update(Request $request, CostEstimate $costEstimate)
    {
        $validated = $this->validateEstimate($request);

        DB::transaction(function () use ($costEstimate, $validated) {
            $costEstimate->update([
                'customer_id'      => $validated['customer_id'] ?? null,
                'company_name'     => $validated['company_name'] ?? null,
                'job_name'         => $validated['job_name'],
                'part_no'          => $validated['part_no'] ?? null,
                'actual_size'      => $validated['actual_size'] ?? null,
                'materials_size'   => $validated['materials_size'] ?? null,
                'pricing_group'    => $validated['pricing_group'],
                'overhead_pct'     => $validated['overhead_pct'] ?? 0,
                'vat_pct'          => $validated['vat_pct'] ?? 15,
                'times_multiplier' => $validated['times_multiplier'] ?? 1,
                'job_quantity'     => $validated['job_quantity'] ?? 1,
                'notes'            => $validated['notes'] ?? null,
            ]);

            $costEstimate->lines()->delete();
            $this->saveLines($costEstimate, $validated['lines'] ?? []);
            $costEstimate->recalculate();
        });

        // Track revision — if it was previously submitted, treat as resubmission
        $wasRejectedOrChanges = EntityRevision::where('entity_type', 'cost_estimate')
            ->where('entity_id', $costEstimate->id)
            ->whereIn('event', ['rejected', 'changes_requested'])
            ->exists();

        $event = $wasRejectedOrChanges ? 'resubmitted' : 'updated';
        app(\App\Services\RevisionTracker::class)->trackEstimate(
            $costEstimate->fresh(),
            $event,
            $request->input('change_reason')
        );

        return redirect()->route('cost-estimates.show', $costEstimate)->with('success', 'Cost estimate updated.');
    }

    public function destroy(CostEstimate $costEstimate)
    {
        $costEstimate->delete();
        return redirect()->route('cost-estimates.index')->with('success', 'Cost estimate deleted.');
    }

    /**
     * Use this estimate to populate a quotation.
     */
    public function useAsQuotation(Request $request, CostEstimate $costEstimate)
    {
        $note = $request->input('note');

        $costEstimate->update(['status' => 'used']);

        app(\App\Services\RevisionTracker::class)->trackEstimate(
            $costEstimate->fresh(),
            'used_as_quotation',
            $note
        );

        return redirect()->route('quotations.create', [
            'rfq_id'         => $costEstimate->rfq_id,
            'estimate_id'    => $costEstimate->id,
            'material_cost'  => $costEstimate->material_cost,
            'labour_cost'    => $costEstimate->machining_cost,
            'overhead_cost'  => $costEstimate->overhead_amount + $costEstimate->surface_cost + $costEstimate->other_cost,
            'kickoff_note'   => $note,
        ])->with('success', 'Estimate ready to use in quotation.');
    }

    private function saveLines(CostEstimate $estimate, array $lines): void
    {
        foreach ($lines as $idx => $line) {
            if (empty($line['description']) && empty($line['material_id']) && empty($line['operation_id'])) {
                continue;
            }
            $estimate->lines()->create([
                'section'      => $line['section'],
                'material_id'  => $line['material_id'] ?? null,
                'operation_id' => $line['operation_id'] ?? null,
                'description'  => $line['description'] ?? '',
                'quantity'     => (float) ($line['quantity'] ?? 0),
                'unit'         => $line['unit'] ?? 'pcs',
                'rate'         => (float) ($line['rate'] ?? 0),
                'amount'       => (float) ($line['quantity'] ?? 0) * (float) ($line['rate'] ?? 0),
                'sequence'     => $idx,
            ]);
        }
    }

    private function serializeEstimate(CostEstimate $e): array
    {
        return [
            'id'               => $e->id,
            'estimate_no'      => $e->estimate_no,
            'rfq_id'           => $e->rfq_id,
            'rfq_item_id'      => $e->rfq_item_id,
            'rfq_item'         => $e->rfqItem ? [
                'id'              => $e->rfqItem->id,
                'job_description' => $e->rfqItem->job_description ?? $e->rfqItem->product?->name,
                'quantity'        => $e->rfqItem->quantity,
                'unit'            => $e->rfqItem->unit,
            ] : null,
            'quotation_id'     => $e->quotation_id,
            'customer_id'      => $e->customer_id,
            'customer'         => $e->customer ? ['id' => $e->customer->id, 'name' => $e->customer->name] : null,
            'company_name'     => $e->company_name,
            'job_name'         => $e->job_name,
            'part_no'          => $e->part_no,
            'actual_size'      => $e->actual_size,
            'materials_size'   => $e->materials_size,
            'pricing_group'    => $e->pricing_group,
            'overhead_pct'     => $e->overhead_pct,
            'vat_pct'          => $e->vat_pct,
            'times_multiplier' => $e->times_multiplier,
            'job_quantity'     => $e->job_quantity,
            'material_cost'    => $e->material_cost,
            'machining_cost'   => $e->machining_cost,
            'surface_cost'     => $e->surface_cost,
            'other_cost'       => $e->other_cost,
            'net_cost'         => $e->net_cost,
            'overhead_amount'  => $e->overhead_amount,
            'vat_amount'       => $e->vat_amount,
            'total'            => $e->total,
            'grand_total'      => $e->grand_total,
            'status'           => $e->status,
            'notes'            => $e->notes,
            'created_by'       => $e->createdBy?->name,
            'created_at'       => $e->created_at?->format('d M Y'),
            'lines'            => $e->lines->map(fn($l) => [
                'id'           => $l->id,
                'section'      => $l->section,
                'material_id'  => $l->material_id,
                'operation_id' => $l->operation_id,
                'description'  => $l->description,
                'quantity'     => $l->quantity,
                'unit'         => $l->unit,
                'rate'         => $l->rate,
                'amount'       => $l->amount,
                'sequence'     => $l->sequence,
            ]),
        ];
    }

    private function validateEstimate(Request $request): array
    {
        return $request->validate([
            'rfq_id'           => 'nullable|exists:rfqs,id',
            'rfq_item_id'      => 'nullable|exists:rfq_items,id',
            'customer_id'      => 'nullable|exists:customers,id',
            'company_name'     => 'nullable|string|max:200',
            'job_name'         => 'required|string|max:200',
            'part_no'          => 'nullable|string|max:50',
            'actual_size'      => 'nullable|string|max:100',
            'materials_size'   => 'nullable|string|max:100',
            'pricing_group'    => 'required|in:A,B,C',
            'overhead_pct'     => 'nullable|numeric|min:0|max:1000',
            'vat_pct'          => 'nullable|numeric|min:0|max:100',
            'times_multiplier' => 'nullable|numeric|min:0|max:100',
            'job_quantity'     => 'nullable|integer|min:1',
            'notes'            => 'nullable|string|max:1000',
            'lines'                 => 'nullable|array',
            'lines.*.section'       => 'required|in:material,machining,surface,other',
            'lines.*.material_id'   => 'nullable|exists:materials,id',
            'lines.*.operation_id'  => 'nullable|exists:machining_operations,id',
            'lines.*.description'   => 'nullable|string|max:255',
            'lines.*.quantity'      => 'nullable|numeric|min:0',
            'lines.*.unit'          => 'nullable|string|max:20',
            'lines.*.rate'          => 'nullable|numeric|min:0',
        ]);
    }

    // ─── Export: Excel ────────────────────────────────────────────────
    public function exportExcel(Request $request)
    {
        $estimates = $this->buildExportQuery($request)->get();
        $rows = $estimates->map(fn($e) => [
            'Estimate #'    => $e->estimate_no,
            'Job Name'      => $e->job_name,
            'Customer'      => $e->customer?->name ?? $e->company_name,
            'Pricing Group' => $e->pricing_group,
            'Material Cost' => round((float) $e->material_cost, 2),
            'Machining Cost'=> round((float) $e->machining_cost, 2),
            'Surface Cost'  => round((float) $e->surface_cost, 2),
            'Other Cost'    => round((float) $e->other_cost, 2),
            'Net Cost'      => round((float) $e->net_cost, 2),
            'Overhead'      => round((float) $e->overhead_amount, 2),
            'VAT'           => round((float) $e->vat_amount, 2),
            'Grand Total'   => round((float) $e->grand_total, 2),
            'Status'        => ucfirst($e->status),
            'Created By'    => $e->createdBy?->name ?? '—',
            'Created At'    => $e->created_at->format('d M Y'),
        ])->toArray();

        $headers = array_keys($rows[0] ?? []);
        $export = new class($headers, $rows) implements \Maatwebsite\Excel\Concerns\FromArray, \Maatwebsite\Excel\Concerns\WithHeadings, \Maatwebsite\Excel\Concerns\WithStyles {
            public function __construct(private array $headers, private array $rows) {}
            public function headings(): array { return $this->headers; }
            public function array(): array { return array_map('array_values', $this->rows); }
            public function styles(\PhpOffice\PhpSpreadsheet\Worksheet\Worksheet $sheet): array {
                return [1 => ['font' => ['bold' => true, 'size' => 11, 'color' => ['argb' => 'FFFFFFFF']],
                    'fill' => ['fillType' => \PhpOffice\PhpPresentation\Style\Fill::FILL_SOLID, 'startColor' => ['argb' => 'FF1E40AF']]]];
            }
        };

        $filename = 'cost-estimates-' . now()->format('Y-m-d') . '.xlsx';
        return \Maatwebsite\Excel\Facades\Excel::download($export, $filename);
    }

    // ─── Export: PDF ──────────────────────────────────────────────────
    public function exportPdf(Request $request)
    {
        $estimates = $this->buildExportQuery($request)->get();
        $rows = $estimates->map(fn($e) => [
            'estimate_no'  => $e->estimate_no,
            'job_name'     => $e->job_name,
            'customer'     => $e->customer?->name ?? $e->company_name,
            'group'        => $e->pricing_group,
            'grand_total'  => number_format((float) $e->grand_total, 2),
            'status'       => ucfirst($e->status),
            'created_at'   => $e->created_at->format('d M Y'),
        ]);

        $html = '<table style="width:100%;border-collapse:collapse;font-size:11px;">';
        $html .= '<thead><tr>';
        foreach (['Estimate #', 'Job Name', 'Customer', 'Group', 'Grand Total (৳)', 'Status', 'Date'] as $h) {
            $html .= "<th style='padding:8px 10px;background:#1e40af;color:white;text-align:left;font-size:10px;text-transform:uppercase;'>{$h}</th>";
        }
        $html .= '</tr></thead><tbody>';
        foreach ($rows as $i => $r) {
            $bg = $i % 2 === 0 ? '#fff' : '#f8fafc';
            $html .= "<tr style='background:{$bg};'>";
            foreach ($r as $v) $html .= "<td style='padding:6px 10px;border-bottom:1px solid #e2e8f0;'>{$v}</td>";
            $html .= '</tr>';
        }
        $html .= '</tbody></table>';

        $total = number_format($estimates->sum(fn($e) => (float) $e->grand_total), 2);
        $summary = "<div style='margin-bottom:14px;padding:10px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;font-size:12px;'>"
            . "<strong>Total Estimates:</strong> {$estimates->count()} | "
            . "<strong>Grand Total:</strong> ৳{$total}</div>";

        $date = now()->format('d M Y, H:i');
        $fullHtml = "<!DOCTYPE html><html><head><meta charset='utf-8'><style>"
            . "body{font-family:'DejaVu Sans',sans-serif;font-size:11px;color:#334155;margin:30px;}"
            . "h1{font-size:20px;color:#1e40af;margin-bottom:4px;}"
            . ".meta{font-size:9px;color:#94a3b8;margin-bottom:14px;}"
            . ".footer{margin-top:20px;text-align:center;font-size:8px;color:#94a3b8;}"
            . "</style></head><body>"
            . "<h1>Cost Estimates Report</h1>"
            . "<div class='meta'>Generated: {$date} · BITAC PMS</div>"
            . $summary . $html
            . "<div class='footer'>Generated by BITAC PMS · {$date}</div>"
            . "</body></html>";

        $pdf = \Barryvdh\DomPDF\Facade\Pdf::loadHTML($fullHtml)->setPaper('a4', 'landscape');
        return $pdf->download('cost-estimates-' . now()->format('Y-m-d') . '.pdf');
    }

    // ─── Export: Single Estimate PDF ─────────────────────────────────
    public function exportSinglePdf(Request $request, CostEstimate $costEstimate)
    {
        $e   = $costEstimate->load('lines.material', 'lines.operation', 'customer', 'createdBy');
        $fmt = fn($v) => number_format((float) ($v ?? 0), 2);
        $esc = fn($v) => htmlspecialchars((string) ($v ?? ''), ENT_QUOTES | ENT_HTML5, 'UTF-8');
        $date     = now()->format('d M Y, H:i');
        $customer = $e->customer?->name ?? $e->company_name ?? '—';

        // Group lines by section
        $sections = [
            'material'  => ['label' => 'A. Material Cost',          'lines' => []],
            'machining' => ['label' => 'B. Machining Cost',         'lines' => []],
            'surface'   => ['label' => 'C. Surface Treatment Cost', 'lines' => []],
            'other'     => ['label' => 'D. Other Parts',            'lines' => []],
        ];
        foreach ($e->lines as $line) {
            $sections[$line->section]['lines'][] = $line;
        }

        // Build section tables — same polished style as RFQ items table
        $sectionsHtml = '';
        foreach ($sections as $sec) {
            $sectionTotal = collect($sec['lines'])->sum(fn($l) => (float) $l->amount);

            $sectionsHtml .= '<table width="100%" cellspacing="0" cellpadding="0" style="border-collapse: collapse; border: 1pt solid #94a3b8; margin-bottom: 10pt;">';
            // Section header row
            $sectionsHtml .= '<tr>';
            $sectionsHtml .=   '<td colspan="5" style="padding: 6pt 10pt; background: #1e40af; color: white; font-size: 10pt; font-weight: bold; letter-spacing: 0.3pt; border-right: 1pt solid #1e3a8a;">' . $esc($sec['label']) . '</td>';
            $sectionsHtml .=   '<td style="padding: 6pt 10pt; background: #1e40af; color: white; font-size: 10pt; font-weight: bold; text-align: right; white-space: nowrap;">BDT ' . $fmt($sectionTotal) . '</td>';
            $sectionsHtml .= '</tr>';

            if (count($sec['lines']) > 0) {
                // Column-headers row
                $sectionsHtml .= '<tr style="background: #f1f5f9;">';
                $sectionsHtml .=   '<th width="5%"  style="padding: 4pt 8pt; font-size: 7.5pt; font-weight: bold; color: #475569; text-transform: uppercase; letter-spacing: 0.3pt; text-align: center; border-bottom: 1pt solid #cbd5e1;">#</th>';
                $sectionsHtml .=   '<th width="45%" style="padding: 4pt 8pt; font-size: 7.5pt; font-weight: bold; color: #475569; text-transform: uppercase; letter-spacing: 0.3pt; text-align: left;   border-bottom: 1pt solid #cbd5e1;">Description</th>';
                $sectionsHtml .=   '<th width="10%" style="padding: 4pt 8pt; font-size: 7.5pt; font-weight: bold; color: #475569; text-transform: uppercase; letter-spacing: 0.3pt; text-align: right;  border-bottom: 1pt solid #cbd5e1;">Qty</th>';
                $sectionsHtml .=   '<th width="10%" style="padding: 4pt 8pt; font-size: 7.5pt; font-weight: bold; color: #475569; text-transform: uppercase; letter-spacing: 0.3pt; text-align: center; border-bottom: 1pt solid #cbd5e1;">Unit</th>';
                $sectionsHtml .=   '<th width="15%" style="padding: 4pt 8pt; font-size: 7.5pt; font-weight: bold; color: #475569; text-transform: uppercase; letter-spacing: 0.3pt; text-align: right;  border-bottom: 1pt solid #cbd5e1;">Rate</th>';
                $sectionsHtml .=   '<th width="15%" style="padding: 4pt 8pt; font-size: 7.5pt; font-weight: bold; color: #475569; text-transform: uppercase; letter-spacing: 0.3pt; text-align: right;  border-bottom: 1pt solid #cbd5e1;">Amount</th>';
                $sectionsHtml .= '</tr>';

                foreach ($sec['lines'] as $i => $line) {
                    $desc = $esc($line->description ?? $line->material?->name ?? $line->operation?->name ?? '—');
                    $bg   = $i % 2 === 0 ? '#ffffff' : '#fafafa';
                    $sectionsHtml .= "<tr style='background: {$bg};'>";
                    $sectionsHtml .=   '<td style="padding: 5pt 8pt; font-size: 9pt; font-weight: bold; color: #1e40af; text-align: center; vertical-align: top;">' . ($i + 1) . '</td>';
                    $sectionsHtml .=   '<td style="padding: 5pt 8pt; font-size: 9pt; color: #111827; vertical-align: top;">' . $desc . '</td>';
                    $sectionsHtml .=   '<td style="padding: 5pt 8pt; font-size: 9pt; font-family: dejavusansmono; text-align: right; font-weight: bold; vertical-align: top; white-space: nowrap;">' . $fmt($line->quantity) . '</td>';
                    $sectionsHtml .=   '<td style="padding: 5pt 8pt; font-size: 9pt; color: #4b5563; text-align: center; vertical-align: top;">' . $esc($line->unit) . '</td>';
                    $sectionsHtml .=   '<td style="padding: 5pt 8pt; font-size: 9pt; font-family: dejavusansmono; text-align: right; vertical-align: top; white-space: nowrap;">' . $fmt($line->rate) . '</td>';
                    $sectionsHtml .=   '<td style="padding: 5pt 8pt; font-size: 9pt; font-family: dejavusansmono; text-align: right; font-weight: bold; color: #111827; vertical-align: top; white-space: nowrap;">' . $fmt($line->amount) . '</td>';
                    $sectionsHtml .= '</tr>';
                }
            } else {
                $sectionsHtml .= '<tr><td colspan="6" style="padding: 8pt; text-align: center; color: #9ca3af; font-style: italic; font-size: 9pt;">No items</td></tr>';
            }
            $sectionsHtml .= '</table>';
        }

        // Cost summary — right-aligned compact totals card
        $summaryRows = [
            ['Net Cost',                                    $e->net_cost],
            ["Overhead ({$e->overhead_pct}%)",              $e->overhead_amount],
            ["VAT ({$e->vat_pct}%)",                        $e->vat_amount],
            ['Total (per unit)',                            $e->total],
        ];
        $summary  = '<table align="right" cellspacing="0" cellpadding="0" style="border-collapse: collapse; border: 1pt solid #94a3b8; width: 290pt; margin-top: 6pt;">';
        foreach ($summaryRows as [$label, $val]) {
            $summary .= '<tr>';
            $summary .=   '<td style="padding: 5pt 10pt; font-size: 9pt; color: #4b5563; border-bottom: 1pt solid #e5e7eb;">' . $esc($label) . '</td>';
            $summary .=   '<td style="padding: 5pt 10pt; font-size: 9pt; font-family: dejavusansmono; text-align: right; font-weight: bold; color: #111827; border-bottom: 1pt solid #e5e7eb; white-space: nowrap;">' . $fmt($val) . '</td>';
            $summary .= '</tr>';
        }
        $summary .= '<tr style="background: #0f172a;">';
        $summary .=   '<td style="padding: 8pt 10pt; font-size: 10pt; color: white; font-weight: bold;">Grand Total <span style="color: #94a3b8; font-weight: normal; font-size: 8pt;">(Qty: ' . $esc((string) $e->job_quantity) . ')</span></td>';
        $summary .=   '<td style="padding: 8pt 10pt; font-size: 13pt; font-family: dejavusansmono; text-align: right; font-weight: bold; color: #fbbf24; white-space: nowrap;">BDT ' . $fmt($e->grand_total) . '</td>';
        $summary .= '</tr>';
        $summary .= '</table>';

        $estimateNo = $esc($e->estimate_no);
        $jobName    = $esc($e->job_name);
        $createdAt  = $e->created_at?->format('d M Y') ?? '—';
        $statusLabel = ucfirst((string) $e->status);
        $statusColor = match ($e->status) {
            'finalized' => '#059669',
            'used'      => '#1e40af',
            'rejected'  => '#dc2626',
            default     => '#64748b',
        };

        $bodyHtml = <<<HTML
        <!-- Document title block -->
        <table width="100%" cellspacing="0" cellpadding="0" style="margin-bottom: 10pt; border-collapse: collapse;">
            <tr>
                <td width="4pt" style="background: #1e40af;"></td>
                <td style="padding: 6pt 10pt;">
                    <div style="font-size: 14pt; color: #1e40af; font-weight: bold; letter-spacing: 0.4pt;">COST ESTIMATE</div>
                    <div style="font-size: 9pt; color: #64748b; margin-top: 1pt;">{$estimateNo} &middot; {$jobName} &middot; {$customer}</div>
                </td>
            </tr>
        </table>

        <!-- Meta grid -->
        <table width="100%" cellspacing="0" cellpadding="8" style="border: 1pt solid #94a3b8; border-collapse: collapse; margin-bottom: 12pt; background: #f8fafc;">
            <tr>
                <td width="25%" style="border-right: 1pt solid #cbd5e1; vertical-align: top;">
                    <div style="color: #6b7280; text-transform: uppercase; font-size: 7pt; letter-spacing: 0.5pt; font-weight: bold;">Customer</div>
                    <div style="color: #0f172a; font-weight: bold; font-size: 10pt; margin-top: 2pt;">{$customer}</div>
                </td>
                <td width="25%" style="border-right: 1pt solid #cbd5e1; vertical-align: top;">
                    <div style="color: #6b7280; text-transform: uppercase; font-size: 7pt; letter-spacing: 0.5pt; font-weight: bold;">Job Name</div>
                    <div style="color: #0f172a; font-weight: bold; font-size: 10pt; margin-top: 2pt;">{$jobName}</div>
                </td>
                <td width="16%" style="border-right: 1pt solid #cbd5e1; vertical-align: top;">
                    <div style="color: #6b7280; text-transform: uppercase; font-size: 7pt; letter-spacing: 0.5pt; font-weight: bold;">Pricing</div>
                    <div style="color: #0f172a; font-weight: bold; font-size: 10pt; margin-top: 2pt;">Group {$e->pricing_group}</div>
                </td>
                <td width="17%" style="border-right: 1pt solid #cbd5e1; vertical-align: top;">
                    <div style="color: #6b7280; text-transform: uppercase; font-size: 7pt; letter-spacing: 0.5pt; font-weight: bold;">Status</div>
                    <div style="color: {$statusColor}; font-weight: bold; font-size: 10pt; margin-top: 2pt;">{$statusLabel}</div>
                </td>
                <td width="17%" style="vertical-align: top;">
                    <div style="color: #6b7280; text-transform: uppercase; font-size: 7pt; letter-spacing: 0.5pt; font-weight: bold;">Created</div>
                    <div style="color: #0f172a; font-weight: bold; font-size: 10pt; margin-top: 2pt;">{$createdAt}</div>
                </td>
            </tr>
        </table>

        <!-- Section heading -->
        <div style="margin-bottom: 4pt;">
            <span style="display: inline-block; padding: 3pt 8pt; background: #1e40af; color: white; font-size: 9pt; font-weight: bold; letter-spacing: 0.3pt;">COST BREAKDOWN</span>
        </div>

        {$sectionsHtml}

        <!-- Summary card right-aligned, with grand total -->
        <table width="100%" cellspacing="0" cellpadding="0" style="margin-top: 4pt; border-collapse: collapse;">
            <tr><td>{$summary}<div style="clear: both;"></div></td></tr>
        </table>

        <div style="clear: both; margin-top: 16pt; padding-top: 6pt; border-top: 0.5pt solid #e5e7eb; text-align: right; font-size: 7pt; color: #9ca3af; font-style: italic;">Generated by BITAC PMS &middot; {$date}</div>
HTML;

        $bytes    = app(\App\Services\BitacLetterhead::class)->render($bodyHtml, "Cost Estimate {$e->estimate_no}");
        $filename = "estimate-{$e->estimate_no}.pdf";

        // ?preview=base64 → JSON with base64 bytes (bypasses IDM/FDM).
        // ?preview=1      → inline PDF stream.
        // Default         → force download.
        if ($request->input('preview') === 'base64') {
            return response()->json([
                'filename' => $filename,
                'size'     => strlen($bytes),
                'data'     => base64_encode($bytes),
            ]);
        }
        $disposition = $request->boolean('preview') ? 'inline' : 'attachment';
        return response($bytes, 200, [
            'Content-Type'        => 'application/pdf',
            'Content-Disposition' => $disposition . '; filename="' . $filename . '"',
            'Content-Length'      => strlen($bytes),
        ]);
    }

    private function buildExportQuery(Request $request)
    {
        $query = CostEstimate::with('customer', 'createdBy');
        if ($search = $request->input('search')) {
            $query->where(function ($q) use ($search) {
                $q->where('estimate_no', 'like', "%{$search}%")
                  ->orWhere('job_name', 'like', "%{$search}%")
                  ->orWhere('company_name', 'like', "%{$search}%")
                  ->orWhereHas('customer', fn($c) => $c->where('name', 'like', "%{$search}%"));
            });
        }
        if ($status = $request->input('status')) $query->where('status', $status);
        if ($group = $request->input('pricing_group')) $query->where('pricing_group', $group);
        return $query->latest()->limit(500);
    }
}
