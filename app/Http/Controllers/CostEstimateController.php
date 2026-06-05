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
    /**
     * Decode an inline signature data URL ("data:image/png;base64,...") and
     * persist it to signatures/estimate-approvals/{id}-{ts}.png. Returns the
     * stored path or null on no/invalid input. Mirrors QuotationController.
     */
    private function persistApprovalSignature($approval, ?string $dataUrl): ?string
    {
        if (!$dataUrl || !str_starts_with($dataUrl, 'data:image/')) return null;
        $parts = explode(',', $dataUrl, 2);
        if (count($parts) !== 2) return null;
        $binary = base64_decode($parts[1], true);
        if ($binary === false) return null;

        $filename = 'signatures/estimate-approvals/' . $approval->id . '-' . time() . '.png';
        \Storage::disk('public')->put($filename, $binary);
        return $filename;
    }

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
                'job_type'      => $e->rfq?->job_type ?? 'regular',
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
            'materials'  => Material::active()->orderBy('name')->get(['id', 'name', 'category', 'rate_per_kg', 'density_kg_m3']),
            'operations' => MachiningOperation::active()->orderBy('category')->orderBy('name')
                ->get(['id', 'name', 'category', 'default_unit', 'rate_group_a', 'rate_group_b', 'rate_group_c', 'rate_group_student', 'rate_group_public']),
            'customers'  => Customer::where('is_active', true)->orderBy('name')->get(['id', 'name']),
        ]);
    }

    public function store(Request $request)
    {
        $validated = $this->validateEstimate($request);

        $estimate = DB::transaction(function () use ($validated) {
            // If rfq_item_id given, auto-populate rfq_id + job_category_id from the parent RFQ
            $rfqId = $validated['rfq_id'] ?? null;
            $jobCategoryId = null;
            if (!empty($validated['rfq_item_id'])) {
                $item = \App\Models\RfqItem::with('rfq')->find($validated['rfq_item_id']);
                if ($item) {
                    $rfqId = $item->rfq_id;
                    $jobCategoryId = $item->rfq?->job_category_id;
                }
            } elseif ($rfqId) {
                $jobCategoryId = \App\Models\Rfq::find($rfqId)?->job_category_id;
            }

            $estimate = CostEstimate::create([
                'estimate_no'      => CostEstimate::generateEstimateNo(),
                'rfq_id'           => $rfqId,
                'rfq_item_id'      => $validated['rfq_item_id'] ?? null,
                'customer_id'      => $validated['customer_id'] ?? null,
                'job_category_id'  => $jobCategoryId,
                'company_name'     => $validated['company_name'] ?? null,
                'job_name'         => $validated['job_name'],
                'part_no'          => $validated['part_no'] ?? null,
                'actual_size'      => $validated['actual_size'] ?? null,
                'materials_size'   => $validated['materials_size'] ?? null,
                'pricing_group'    => $validated['pricing_group'],
                'overhead_pct'     => $validated['overhead_pct'] ?? 0,
                'vat_pct'          => $validated['vat_pct'] ?? 15,
                'tax_pct'          => $validated['tax_pct'] ?? 0,
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

        // Capture the inline-drawn signature if one was provided. Falls back
        // to user.signature_path at PDF-render time.
        $sigPath = $this->persistApprovalSignature($approval, $request->input('signature'));
        if ($sigPath) $approval->update(['signature_path' => $sigPath]);

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
        $sigPath = $this->persistApprovalSignature($approval, $request->input('signature'));
        if ($sigPath) $approval->update(['signature_path' => $sigPath]);

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
        $sigPath = $this->persistApprovalSignature($approval, $request->input('signature'));
        if ($sigPath) $approval->update(['signature_path' => $sigPath]);

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
            'materials'  => Material::active()->orderBy('name')->get(['id', 'name', 'category', 'rate_per_kg', 'density_kg_m3']),
            'operations' => MachiningOperation::active()->orderBy('category')->orderBy('name')
                ->get(['id', 'name', 'category', 'default_unit', 'rate_group_a', 'rate_group_b', 'rate_group_c', 'rate_group_student', 'rate_group_public']),
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
                'tax_pct'          => $validated['tax_pct'] ?? 0,
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
            'job_type'         => $e->rfq?->job_type ?? 'regular',
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
            'tax_pct'          => $e->tax_pct ?? 0,
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
            'pricing_group'    => 'required|in:A,B,C,STUDENT,PUBLIC',
            'overhead_pct'     => 'nullable|numeric|min:0|max:1000',
            'vat_pct'          => 'nullable|numeric|min:0|max:100',
            'tax_pct'          => 'nullable|numeric|min:0|max:100',
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
        $e   = $costEstimate->load('lines.material', 'lines.operation', 'customer', 'createdBy.center', 'rfq', 'approvals.approver.center');
        $fmt = fn($v) => number_format((float) ($v ?? 0), 2);
        $esc = fn($v) => htmlspecialchars((string) ($v ?? ''), ENT_QUOTES | ENT_HTML5, 'UTF-8');

        $customer    = $esc($e->customer?->name ?? $e->company_name ?? '—');
        $estimateNo  = $esc($e->estimate_no);
        $jobName     = $esc($e->job_name);
        $createdAt   = $e->created_at?->format('d/m/Y') ?? '—';
        $statusLabel = ucfirst((string) $e->status);
        $createdBy   = $esc($e->createdBy?->name ?? '—');
        $partNo      = $esc($e->part_no ?? '—');
        $actualSize  = $esc($e->actual_size ?? '—');
        $jobType     = ($e->rfq?->job_type ?? 'regular') === 'rnd' ? 'R&amp;D' : 'Regular';

        // ─── Memo block — top-left estimate no, top-right date (BITAC letter style)
        $memoBlock = '<table width="100%" cellspacing="0" cellpadding="0" style="margin-bottom: 14pt;">'
            . '<tr>'
            .   '<td style="font-size: 11pt; color: #000;"><span class="bn" style="font-family: siyamrupali;">নং -</span> ' . $estimateNo . '</td>'
            .   '<td style="font-size: 11pt; color: #000; text-align: right;"><span class="bn" style="font-family: siyamrupali;">তারিখঃ</span> ' . $esc($createdAt) . ' <span class="bn" style="font-family: siyamrupali;">খ্রিঃ</span></td>'
            . '</tr>'
            . '</table>';

        // ─── Centered title ────────────────────────────────────────────
        $titleBlock = '<div style="text-align: center; margin-bottom: 14pt;">'
            . '<div class="bn" style="font-family: siyamrupali; font-size: 13pt; color: #000;">খরচ নির্ধারণ</div>'
            . '<div style="font-size: 11pt; color: #000; margin-top: 1pt;">(COST ESTIMATE)</div>'
            . '</div>';

        // ─── Customer / Job info two-column block ──────────────────────
        $headerBlock = '<table width="100%" cellspacing="0" cellpadding="0" style="margin-bottom: 8pt;">'
            . '<tr>'
            .   '<td width="55%" style="vertical-align: top; padding-right: 12pt; font-size: 10pt; color: #000; line-height: 1.5;">'
            .     '<div><b>Customer:</b> ' . $customer . '</div>'
            .     '<div><b>Job Name:</b> ' . $jobName . '</div>'
            .     '<div><b>Part No:</b> ' . $partNo . '</div>'
            .     '<div><b>Actual Size:</b> ' . $actualSize . '</div>'
            .   '</td>'
            .   '<td width="45%" style="vertical-align: top; font-size: 10pt; color: #000; line-height: 1.5;">'
            .     '<div><b>Pricing Group:</b> ' . $esc((string) $e->pricing_group) . '</div>'
            .     '<div><b>Job Type:</b> ' . $jobType . '</div>'
            .     '<div><b>Status:</b> ' . $esc($statusLabel) . '</div>'
            .   '</td>'
            . '</tr>'
            . '</table>';

        // ─── Group lines by section ────────────────────────────────────
        $sections = [
            'material'  => ['label' => 'A. Material Cost',          'lines' => []],
            'machining' => ['label' => 'B. Machining Cost',         'lines' => []],
            'surface'   => ['label' => 'C. Surface Treatment Cost', 'lines' => []],
            'other'     => ['label' => 'D. Other Parts',            'lines' => []],
        ];
        foreach ($e->lines as $line) {
            $sections[$line->section]['lines'][] = $line;
        }

        // ─── Section tables — plain bordered, no zebra, no color ───────
        $sectionsHtml = '';
        foreach ($sections as $sec) {
            $sectionTotal = collect($sec['lines'])->sum(fn($l) => (float) $l->amount);
            if (count($sec['lines']) === 0) continue; // skip empty sections — keeps PDF tight

            $sectionsHtml .= '<table width="100%" cellspacing="0" cellpadding="0" style="border-collapse: collapse; border: 0.75pt solid #000; margin-bottom: 8pt; table-layout: fixed;">';
            $sectionsHtml .= '<colgroup>'
                . '<col style="width: 6%;" /><col style="width: 46%;" />'
                . '<col style="width: 10%;" /><col style="width: 8%;" />'
                . '<col style="width: 14%;" /><col style="width: 16%;" />'
                . '</colgroup>';

            // Section header row (bold, no color)
            $sectionsHtml .= '<tr>';
            $sectionsHtml .=   '<td colspan="5" style="border: 0.75pt solid #000; padding: 4pt 8pt; font-size: 10pt; font-weight: bold; color: #000;">' . $esc($sec['label']) . '</td>';
            $sectionsHtml .=   '<td style="border: 0.75pt solid #000; padding: 4pt 6pt; font-size: 10pt; font-weight: bold; color: #000; text-align: right; white-space: nowrap;">' . $fmt($sectionTotal) . '</td>';
            $sectionsHtml .= '</tr>';

            // Column-headers row
            $sectionsHtml .= '<tr>';
            $sectionsHtml .=   '<th style="border: 0.75pt solid #000; padding: 3pt 2pt; font-size: 8.5pt; font-weight: normal; color: #000; text-align: center;">#</th>';
            $sectionsHtml .=   '<th style="border: 0.75pt solid #000; padding: 3pt 6pt; font-size: 8.5pt; font-weight: normal; color: #000; text-align: left;">Description</th>';
            $sectionsHtml .=   '<th style="border: 0.75pt solid #000; padding: 3pt 2pt; font-size: 8.5pt; font-weight: normal; color: #000; text-align: center;">Qty</th>';
            $sectionsHtml .=   '<th style="border: 0.75pt solid #000; padding: 3pt 2pt; font-size: 8.5pt; font-weight: normal; color: #000; text-align: center;">Unit</th>';
            $sectionsHtml .=   '<th style="border: 0.75pt solid #000; padding: 3pt 4pt; font-size: 8.5pt; font-weight: normal; color: #000; text-align: right;">Rate</th>';
            $sectionsHtml .=   '<th style="border: 0.75pt solid #000; padding: 3pt 6pt; font-size: 8.5pt; font-weight: normal; color: #000; text-align: right;">Amount</th>';
            $sectionsHtml .= '</tr>';

            foreach ($sec['lines'] as $i => $line) {
                $desc = $esc($line->description ?? $line->material?->name ?? $line->operation?->name ?? '—');
                $sectionsHtml .= '<tr>';
                $sectionsHtml .=   '<td style="border: 0.75pt solid #000; padding: 5pt 2pt; font-size: 10pt; text-align: center; vertical-align: middle;">' . ($i + 1) . '</td>';
                $sectionsHtml .=   '<td style="border: 0.75pt solid #000; padding: 5pt 6pt; font-size: 10pt; vertical-align: top; line-height: 1.4;">' . $desc . '</td>';
                $sectionsHtml .=   '<td style="border: 0.75pt solid #000; padding: 5pt 2pt; font-size: 10pt; text-align: right; vertical-align: middle; white-space: nowrap;">' . $fmt($line->quantity) . '</td>';
                $sectionsHtml .=   '<td style="border: 0.75pt solid #000; padding: 5pt 2pt; font-size: 10pt; text-align: center; vertical-align: middle;">' . $esc($line->unit) . '</td>';
                $sectionsHtml .=   '<td style="border: 0.75pt solid #000; padding: 5pt 4pt; font-size: 10pt; text-align: right; vertical-align: middle; white-space: nowrap;">' . $fmt($line->rate) . '</td>';
                $sectionsHtml .=   '<td style="border: 0.75pt solid #000; padding: 5pt 6pt; font-size: 10pt; text-align: right; vertical-align: middle; white-space: nowrap; font-weight: bold;">' . $fmt($line->amount) . '</td>';
                $sectionsHtml .= '</tr>';
            }
            $sectionsHtml .= '</table>';
        }

        // ─── Summary card right-aligned (plain, no color, like Quotation) ───
        $summary  = '<table align="right" cellspacing="0" cellpadding="0" style="border-collapse: collapse; border: 0.75pt solid #000; width: 320pt; margin-top: 6pt;">';
        $rows = [
            ['Net Cost',                                    $e->net_cost,        false],
            ["Overhead ({$e->overhead_pct}%)",              $e->overhead_amount, false],
            ["VAT ({$e->vat_pct}%)",                        $e->vat_amount,      false],
        ];
        if (((float) ($e->tax_amount ?? 0)) > 0) {
            $rows[] = ["Tax ({$e->tax_pct}%)",              $e->tax_amount,      false];
        }
        $rows = array_merge($rows, [
            ['Total (per unit, incl. VAT & Tax)',           $e->total,           true],
            ['Times Multiplier',                            $e->times_multiplier,false],
            ['Job Quantity',                                $e->job_quantity,    false],
        ]);
        foreach ($rows as [$label, $val, $bold]) {
            $weight = $bold ? 'font-weight: bold;' : '';
            $summary .= '<tr>';
            $summary .=   '<td style="border: 0.75pt solid #000; padding: 4pt 8pt; font-size: 10pt; color: #000; ' . $weight . '">' . $esc($label) . '</td>';
            $summary .=   '<td style="border: 0.75pt solid #000; padding: 4pt 6pt; font-size: 10pt; color: #000; text-align: right; white-space: nowrap; ' . $weight . '">' . $fmt($val) . '</td>';
            $summary .= '</tr>';
        }
        $summary .= '<tr>';
        $summary .=   '<td style="border: 0.75pt solid #000; padding: 6pt 8pt; font-size: 11pt; color: #000; font-weight: bold;">Grand Total (Including VAT &amp; TAX)</td>';
        $summary .=   '<td style="border: 0.75pt solid #000; padding: 6pt 6pt; font-size: 11pt; color: #000; text-align: right; white-space: nowrap; font-weight: bold;">' . $fmt($e->grand_total) . '</td>';
        $summary .= '</tr>';
        $summary .= '</table>';

        // ─── Signature blocks ──────────────────────────────────────────
        // Prepared By is always rendered with the preparer's saved signature
        // (if any). Approved By only renders an image once the estimate is
        // approved AND the final approver has either drawn a signature on
        // that approval row OR has a saved signature on their profile.
        $preparer = $e->createdBy;
        $preparerSig = $preparer?->signatureAbsolutePath();
        $preparedByName   = $esc($preparer?->name ?? '—');
        $preparedByTitle  = $esc($preparer?->designation ?? '');
        $preparedByCenter = $esc($preparer?->center?->name ?? '');

        // Final approval = latest 'approved' row (highest level wins for multi-step chains)
        $finalApproval = $e->approvals
            ->where('status', 'approved')
            ->sortByDesc('level')
            ->first();
        $isApproved = $finalApproval !== null;
        $approver        = $finalApproval?->approver;
        $approverName    = $esc($approver?->name ?? '');
        $approverTitle   = $esc($approver?->designation ?? '');
        $approverCenter  = $esc($approver?->center?->name ?? '');
        $approvedDate    = $finalApproval?->acted_at?->format('d/m/Y') ?? '';
        $approverSig     = $finalApproval?->signatureAbsolutePath() ?? $approver?->signatureAbsolutePath();

        $sigImg = fn($absPath) => $absPath
            ? '<img src="' . $absPath . '" style="height: 40pt; max-width: 150pt;" alt="signature" />'
            : '<div style="height: 40pt;"></div>'; // empty space for hand signature

        $signatureBlock = '<table width="100%" cellspacing="0" cellpadding="0" style="margin-top: 30pt; border-collapse: collapse;">'
            . '<tr>'
            // Prepared By — anchored to the left edge (BITAC paper convention)
            .   '<td width="35%" style="vertical-align: bottom; text-align: left;">'
            .     '<div style="margin-bottom: 4pt;">' . $sigImg($preparerSig) . '</div>'
            .     '<div style="border-top: 0.75pt solid #000; padding-top: 4pt; font-size: 10pt; font-weight: bold; color: #000; display: inline-block; min-width: 140pt;">Prepared By</div>'
            .     '<div style="font-size: 10pt; color: #000; margin-top: 2pt;">' . $preparedByName . '</div>'
            .     ($preparedByTitle !== '' ? '<div style="font-size: 9pt; color: #4b5563; margin-top: 1pt;">' . $preparedByTitle . '</div>' : '')
            .     ($preparedByCenter !== '' ? '<div style="font-size: 9pt; color: #4b5563;">' . $preparedByCenter . '</div>' : '')
            .   '</td>'
            // Spacer column
            .   '<td width="30%"></td>'
            // Approved By — anchored to the right edge
            .   '<td width="35%" style="vertical-align: bottom; text-align: right;">'
            .     '<div style="margin-bottom: 4pt;">';

        if ($isApproved) {
            $signatureBlock .= $sigImg($approverSig);
        } else {
            // Awaiting approval — empty space + italic "Pending approval" note
            $signatureBlock .= '<div style="height: 40pt; display: flex; align-items: center; justify-content: center;">'
                . '<span style="font-size: 8pt; font-style: italic; color: #94a3b8;">(Awaiting approval)</span>'
                . '</div>';
        }

        $signatureBlock .=     '</div>'
            .     '<div style="border-top: 0.75pt solid #000; padding-top: 4pt; font-size: 10pt; font-weight: bold; color: #000; display: inline-block; min-width: 140pt;">Approved By</div>';
        if ($isApproved) {
            $signatureBlock .= '<div style="font-size: 10pt; color: #000; margin-top: 2pt;">' . $approverName . '</div>';
            if ($approverTitle !== '') {
                $signatureBlock .= '<div style="font-size: 9pt; color: #4b5563; margin-top: 1pt;">' . $approverTitle . '</div>';
            }
            if ($approverCenter !== '') {
                $signatureBlock .= '<div style="font-size: 9pt; color: #4b5563;">' . $approverCenter . '</div>';
            }
            if ($approvedDate !== '') {
                $signatureBlock .= '<div style="font-size: 8pt; color: #4b5563; margin-top: 1pt;">' . $esc($approvedDate) . '</div>';
            }
        } else {
            $signatureBlock .= '<div style="font-size: 8pt; color: #94a3b8; margin-top: 2pt; font-style: italic;">Not yet approved</div>';
        }
        $signatureBlock .=   '</td>'
            . '</tr>'
            . '</table>';

        $bodyHtml = <<<HTML
        {$memoBlock}
        {$titleBlock}
        {$headerBlock}
        {$sectionsHtml}

        <table width="100%" cellspacing="0" cellpadding="0" style="margin-top: 4pt; border-collapse: collapse;">
            <tr><td>{$summary}<div style="clear: both;"></div></td></tr>
        </table>
        <div style="clear: both;"></div>

        {$signatureBlock}
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
