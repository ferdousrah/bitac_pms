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
                'rfq_id'         => $e->rfq_id,
                'rfq_item_id'    => $e->rfq_item_id,
                'rfq_item_desc'  => $e->rfqItem?->job_description,
                // Customer's own reference (PO no., quote tag, etc.) entered on
                // the originating RFQ. Surfaced as its own column on the index.
                'customer_ref_no' => $e->rfq?->customer_ref_no,
                'job_type'       => $e->rfq?->job_type ?? 'regular',
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
        $rfqItemPart = null;

        // Costing ONE part of a job: the part carries its own quantity, and
        // its part number is positional so it is derived, never typed.
        if ($request->query('rfq_item_part_id')) {
            $rfqItemPart = \App\Models\RfqItemPart::with(['rfqItem.rfq.customer', 'rfqItem.product', 'rfqItem.parts'])
                ->find($request->query('rfq_item_part_id'));
            if ($rfqItemPart) {
                $rfqItem = $rfqItemPart->rfqItem;
                $rfq     = $rfqItem?->rfq;
            }
        }
        if (!$rfqItem && $request->query('rfq_item_id')) {
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
            // When set, the form is costing this single part of the job.
            'rfqItemPart' => $rfqItemPart ? [
                'id'       => $rfqItemPart->id,
                'name'     => $rfqItemPart->name,
                'quantity' => (float) $rfqItemPart->quantity,
                'unit'     => $rfqItemPart->unit,
                'part_no'  => \App\Models\RfqItemPart::formatNo(
                    max(0, $rfqItemPart->rfqItem->parts->search(fn ($p) => $p->id === $rfqItemPart->id)),
                    $rfqItemPart->rfqItem->parts->count()
                ),
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
            // A part estimate inherits its job item (and therefore its RFQ)
            // from the part, so the caller only has to pass the part.
            if (!empty($validated['rfq_item_part_id'])) {
                $part = \App\Models\RfqItemPart::with('rfqItem.rfq')->find($validated['rfq_item_part_id']);
                if ($part) {
                    $validated['rfq_item_id'] = $part->rfq_item_id;
                }
            }
            if (!empty($validated['rfq_item_id'])) {
                $item = \App\Models\RfqItem::with('rfq')->find($validated['rfq_item_id']);
                if ($item) {
                    $rfqId = $item->rfq_id;
                    $jobCategoryId = $item->rfq?->job_category_id;
                }
            } elseif ($rfqId) {
                $jobCategoryId = \App\Models\Rfq::find($rfqId)?->job_category_id;
            }

            // Retry-on-conflict for the estimate_no — concurrent submits can
            // race and both compute the same next number before either commits.
            $estimate = $this->createEstimateWithRetry([
                'rfq_id'           => $rfqId,
                // estimate_no injected by createEstimateWithRetry with retry on duplicates.
                'rfq_item_id'      => $validated['rfq_item_id'] ?? null,
                'rfq_item_part_id' => $validated['rfq_item_part_id'] ?? null,
                'customer_id'      => $validated['customer_id'] ?? null,
                'job_category_id'  => $jobCategoryId,
                'company_name'     => $validated['company_name'] ?? null,
                'job_name'         => $validated['job_name'],
                'part_no'          => $validated['part_no'] ?? null,
                'actual_size'      => $validated['actual_size'] ?? null,
                'materials_size'   => $validated['materials_size'] ?? null,
                'pricing_group'    => $validated['pricing_group'],
                'overhead_pct'     => $validated['overhead_pct'] ?? 0,
                'extra_cost'       => $validated['extra_cost'] ?? 0,
                'vat_pct'          => $validated['vat_pct'] ?? 15,
                'tax_pct'          => $validated['tax_pct'] ?? 0,
                'times_multiplier' => $validated['times_multiplier'] ?? 1,
                'job_quantity'     => $validated['job_quantity'] ?? 1,
                'grand_total_override' => $this->normalizeOverride($validated['grand_total_override'] ?? null),
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

        // Customer-uploaded RFQ letter inherited from the parent RFQ. Streamed
        // through the controller route so the PDF popup's base64 mode works
        // and IDM/FDM doesn't intercept the response.
        $rfqLetter = null;
        if ($costEstimate->rfq && $costEstimate->rfq->rfq_letter_path) {
            $rfqLetter = [
                'url'       => route('rfqs.letter', $costEstimate->rfq),
                'title'     => $costEstimate->rfq->rfq_letter_title ?: 'RFQ letter',
                'extension' => strtolower(pathinfo($costEstimate->rfq->rfq_letter_path, PATHINFO_EXTENSION)),
                'rfq_id'    => $costEstimate->rfq->id,
            ];
        }

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
            // "Approved By" reads awkwardly on a pending row — the workflow UI
            // shows it as "Approver" instead. PDF/signature blocks keep the
            // original label.
            'label'    => $a->label === 'Approved By' ? 'Approver' : $a->label,
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
            'rfqLetter'       => $rfqLetter,
            'comments'        => $comments,
            // Job-wise submission context. An estimate raised against a part
            // can be sent on its own OR together with the job's other parts.
            'jobSubmission'   => (function () use ($costEstimate) {
                if (! $costEstimate->rfq_item_part_id || ! $costEstimate->rfqItem) return null;

                $item = $costEstimate->rfqItem->load('parts.costEstimates');
                $estimates = $item->parts
                    ->map(fn ($p) => $p->effectiveEstimate())
                    ->filter();

                return [
                    'rfq_item_id'   => $item->id,
                    'job_name'      => $item->job_description,
                    'part_count'    => $item->parts->count(),
                    'estimate_count'=> $estimates->count(),
                    'submittable'   => $estimates->where('approval_status', 'not_submitted')->count(),
                    'uncosted'      => $item->parts->count() - $estimates->count(),
                    'job_total'     => $item->jobCostBreakdown()['total'],
                ];
            })(),
            // How many estimates a decision on this one will cover. >1 means
            // it was submitted job-wise and is approved/rejected as a whole.
            'batchSize'       => $costEstimate->approval_batch
                ? CostEstimate::where('approval_batch', $costEstimate->approval_batch)->count()
                : 1,
            'canSubmit'       => $costEstimate->approval_status === 'not_submitted'
                                && $costEstimate->status === 'draft'
                                && ($isCreator || $isSuperAdmin),
            'canApprove'      => $pendingApproval,
            'canReject'       => $pendingApproval,
        ]);
    }

    /**
     * Create the pending approval rows for an estimate.
     *
     * Uses the same chain as quotations. "Prepared By" is the CREATOR, not an
     * approver, so the chain is: FIRST approver = "Checked By", LAST =
     * "Approved By", any in-between = "Reviewer N".
     *   1 approver  → [Approved By]
     *   2 approvers → [Checked By, Approved By]
     *   3 approvers → [Checked By, Reviewer 2, Approved By]
     */
    private function buildApprovalChain(CostEstimate $costEstimate): void
    {
        $settings = \App\Models\QuotationApprovalSetting::orderBy('level')->get();
        $chainLabels = fn (int $total): array => \App\Support\ApprovalChainLabels::forCount($total);

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
            return;
        }

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

        $this->buildApprovalChain($costEstimate);

        // Submitted on its own, so it belongs to no job batch.
        $costEstimate->update(['approval_status' => 'pending_approval', 'approval_batch' => null]);

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

    /**
     * Submit a whole JOB for approval — every part estimate of the job goes
     * in together under one batch id, and an approver's single decision
     * covers all of them.
     *
     * The per-estimate route still exists; the preparer chooses which to use.
     * Only each part's EFFECTIVE (newest) estimate is submitted, so superseded
     * revisions are never sent for approval.
     */
    public function submitJobForApproval(Request $request, \App\Models\RfqItem $rfqItem)
    {
        $rfqItem->load('parts.costEstimates');

        $candidates = collect();
        foreach ($rfqItem->parts as $part) {
            if ($est = $part->effectiveEstimate()) {
                $candidates->push($est);
            }
        }

        if ($candidates->isEmpty()) {
            return back()->with('error', 'None of this job\'s parts have a cost estimate yet.');
        }

        // Anything already in flight or decided is left alone — re-submitting
        // it would duplicate its approval chain.
        $submittable = $candidates->where('approval_status', 'not_submitted');
        $skipped     = $candidates->count() - $submittable->count();

        if ($submittable->isEmpty()) {
            return back()->with('error', 'Every estimate on this job has already been submitted for approval.');
        }

        $batch = (string) \Illuminate\Support\Str::uuid();
        $total = 0.0;

        DB::transaction(function () use ($submittable, $batch, &$total) {
            foreach ($submittable as $estimate) {
                $this->buildApprovalChain($estimate);
                $estimate->update([
                    'approval_status' => 'pending_approval',
                    'approval_batch'  => $batch,
                ]);
                $total += (float) $estimate->grand_total;
            }
        });

        // One notification for the job, not one per part.
        $first = $submittable->first();
        $ids = \App\Models\CostEstimateApproval::whereIn('cost_estimate_id', $submittable->pluck('id'))
            ->pluck('approver_id')->unique()->values()->all();
        if (!empty($ids)) {
            $jobName = $rfqItem->job_description ?: "Job #{$rfqItem->id}";
            \App\Services\NotifyService::send($ids, 'estimate_approval', 'Job Cost Needs Approval',
                "{$jobName} — {$submittable->count()} part estimate(s), total ৳" . number_format($total)
                . ". Approving covers the whole job.",
                "/cost-estimates/{$first->id}", 'fi-rr-calculator', 'amber');
        }

        foreach ($submittable as $estimate) {
            app(\App\Services\RevisionTracker::class)->trackEstimate($estimate->fresh(), 'submitted_for_approval');
        }

        $msg = "Job submitted for approval — {$submittable->count()} part estimate(s).";
        if ($skipped > 0) {
            $msg .= " {$skipped} already in approval and left as-is.";
        }

        return back()->with('success', $msg);
    }

    public function approveEstimate(Request $request, CostEstimate $costEstimate)
    {
        // An estimate submitted as part of a job batch is decided as a whole:
        // one click approves every part estimate that went in with it. An
        // estimate submitted on its own has no batch, so this is just itself.
        $targets = $costEstimate->approvalBatchMembers();
        $remark  = $request->input('remarks');
        $done    = 0;

        foreach ($targets as $target) {
            $approval = $target->approvals()
                ->where('approver_id', auth()->id())
                ->where('status', 'pending')
                ->first();

            // Skip siblings this approver has already actioned rather than
            // failing the whole batch.
            if (!$approval) continue;

            $approval->update([
                'status'  => 'approved',
                'remarks' => $remark,
                'acted_at'=> now(),
            ]);

            // Capture the inline-drawn signature if one was provided. Falls back
            // to user.signature_path at PDF-render time.
            $sigPath = $this->persistApprovalSignature($approval, $request->input('signature'));
            if ($sigPath) $approval->update(['signature_path' => $sigPath]);

            // Check if all levels approved
            $allApproved = $target->approvals()->where('status', '!=', 'approved')->doesntExist();
            if ($allApproved) {
                $target->update(['approval_status' => 'approved', 'status' => 'finalized']);
            }

            app(\App\Services\RevisionTracker::class)->trackEstimate(
                $target->fresh(),
                'approved',
                $remark
            );

            // Notify the preparer (creator) that the estimate was approved
            if ($target->created_by) {
                $body = $allApproved
                    ? "Your cost estimate {$target->estimate_no} has been fully approved."
                    : "Your cost estimate {$target->estimate_no} was approved by " . auth()->user()->name . ".";
                if ($remark) $body .= "\nNote: \"{$remark}\"";

                \App\Services\NotifyService::send(
                    $target->created_by,
                    'estimate_approved',
                    'Cost Estimate Approved',
                    $body,
                    "/cost-estimates/{$target->id}",
                    'fi-rr-check-circle',
                    'green'
                );
            }

            $done++;
        }

        if ($done === 0) {
            return back()->with('error', 'No pending approval found for you on this estimate. It may have already been actioned.');
        }

        return back()->with('success', $done > 1
            ? "Job approved — {$done} part estimates."
            : 'Estimate approved.');
    }

    public function rejectEstimate(Request $request, CostEstimate $costEstimate)
    {
        $request->validate(['remarks' => 'required|string|max:1000']);

        // Like approval, a rejection covers the whole job batch when the
        // estimate was submitted as part of one.
        $targets = $costEstimate->approvalBatchMembers();
        $remark  = $request->input('remarks');
        $done    = 0;

        foreach ($targets as $target) {
            $approval = $target->approvals()
                ->where('approver_id', auth()->id())
                ->where('status', 'pending')
                ->first();

            if (!$approval) continue;

            $approval->update([
                'status'  => 'rejected',
                'remarks' => $remark,
                'acted_at'=> now(),
            ]);
            $sigPath = $this->persistApprovalSignature($approval, $request->input('signature'));
            if ($sigPath) $approval->update(['signature_path' => $sigPath]);

            $target->update(['approval_status' => 'rejected']);

            app(\App\Services\RevisionTracker::class)->trackEstimate(
                $target->fresh(),
                'rejected',
                $remark
            );

            // Notify the preparer that their estimate was rejected
            if ($target->created_by) {
                \App\Services\NotifyService::send(
                    $target->created_by,
                    'estimate_rejected',
                    'Cost Estimate Rejected',
                    "Your cost estimate {$target->estimate_no} was rejected by " . auth()->user()->name . ".\nReason: \"{$remark}\"",
                    "/cost-estimates/{$target->id}",
                    'fi-rr-cross-circle',
                    'red'
                );
            }

            $done++;
        }

        if ($done === 0) {
            return back()->with('error', 'No pending approval found for you on this estimate. It may have already been actioned.');
        }

        return back()->with('success', $done > 1
            ? "Job rejected — {$done} part estimates."
            : 'Estimate rejected.');
    }

    /**
     * Request changes — send the estimate back to the preparer with a note.
     * Resets approval chain so the preparer can edit and resubmit.
     */
    public function requestChangesEstimate(Request $request, CostEstimate $costEstimate)
    {
        $request->validate(['remarks' => 'required|string|max:1000']);

        // Sending a job batch back to the preparer sends all of it back —
        // costing one part differently usually changes the job's total.
        $targets = $costEstimate->approvalBatchMembers();
        $done    = 0;

        foreach ($targets as $target) {
            $approval = $target->approvals()
                ->where('approver_id', auth()->id())
                ->where('status', 'pending')
                ->first();

            if (!$approval) continue;

            // Keep a history note on the approval record
            $approval->update([
                'status'  => 'rejected', // in DB it's rejected, but with a "changes requested" flavor via notes
                'remarks' => '[Changes Requested] ' . $request->input('remarks'),
                'acted_at'=> now(),
            ]);
            $sigPath = $this->persistApprovalSignature($approval, $request->input('signature'));
            if ($sigPath) $approval->update(['signature_path' => $sigPath]);

            // Send back to draft so preparer can edit and resubmit. The batch
            // is cleared too — resubmitting is a fresh decision.
            $target->update([
                'approval_status' => 'not_submitted',
                'status'          => 'draft',
                'approval_batch'  => null,
            ]);

            // Clear approvals so the chain restarts when resubmitted
            $target->approvals()->delete();

            app(\App\Services\RevisionTracker::class)->trackEstimate(
                $target->fresh(),
                'changes_requested',
                $request->input('remarks')
            );
            $done++;
        }

        if ($done === 0) {
            return back()->with('error', 'No pending approval found for you on this estimate. It may have already been actioned.');
        }

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

        return back()->with('success', $done > 1
            ? "Changes requested. All {$done} part estimates are back with the preparer."
            : 'Changes requested. The estimate is back with the preparer.');
    }

    public function edit(CostEstimate $costEstimate)
    {
        $costEstimate->load('lines.material', 'lines.operation');

        return Inertia::render('CostEstimate/Form', [
            'estimate'   => $this->serializeEstimate($costEstimate),
            'rfq'        => null,
            'materials'  => Material::active()->orderBy('name')->get(['id', 'name', 'category', 'rate_per_kg', 'density_kg_m3', 'density_kg_in3']),
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
                'extra_cost'       => $validated['extra_cost'] ?? 0,
                'vat_pct'          => $validated['vat_pct'] ?? 15,
                'tax_pct'          => $validated['tax_pct'] ?? 0,
                'times_multiplier' => $validated['times_multiplier'] ?? 1,
                'job_quantity'     => $validated['job_quantity'] ?? 1,
                'grand_total_override' => $this->normalizeOverride($validated['grand_total_override'] ?? null),
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

    /** Treat blank/zero override as "no override" so the auto value reapplies. */
    /**
     * Search past estimates to copy a costing from.
     *
     * BITAC repeats the same kinds of job constantly, so re-keying every
     * material and machining line is the main time sink. This backs the
     * "Copy from existing estimate" picker on the estimate form.
     */
    public function copySearch(Request $request)
    {
        $q = trim((string) $request->query('q', ''));

        $query = CostEstimate::with('customer:id,name')
            ->select(['id', 'estimate_no', 'job_name', 'company_name', 'customer_id', 'part_no',
                      'pricing_group', 'job_quantity', 'grand_total', 'status', 'created_at'])
            ->latest('id');

        if ($q !== '') {
            $query->where(function ($w) use ($q) {
                $w->where('estimate_no', 'like', "%{$q}%")
                  ->orWhere('job_name', 'like', "%{$q}%")
                  ->orWhere('company_name', 'like', "%{$q}%")
                  ->orWhere('part_no', 'like', "%{$q}%")
                  ->orWhereHas('customer', fn ($c) => $c->where('name', 'like', "%{$q}%"));
            });
        }

        // Only estimates that actually carry a costing are worth copying.
        $query->whereHas('lines');

        return response()->json([
            'results' => $query->limit(20)->get()->map(fn ($e) => [
                'id'            => $e->id,
                'estimate_no'   => $e->estimate_no,
                'job_name'      => $e->job_name,
                'customer'      => $e->customer?->name ?? $e->company_name,
                'part_no'       => $e->part_no,
                'pricing_group' => $e->pricing_group,
                'job_quantity'  => $e->job_quantity,
                'grand_total'   => (float) $e->grand_total,
                'status'        => $e->status,
                'created_at'    => $e->created_at?->format('d M Y'),
                'line_count'    => $e->lines()->count(),
            ])->values(),
        ]);
    }

    /**
     * The copyable content of one estimate: the cost structure and its lines.
     *
     * Deliberately does NOT include what belongs to the job being costed —
     * job name, customer, quantity, part number and any grand-total override
     * stay with the new estimate.
     */
    public function copySource(CostEstimate $costEstimate)
    {
        $costEstimate->load('lines');

        return response()->json([
            'estimate_no'      => $costEstimate->estimate_no,
            'job_name'         => $costEstimate->job_name,
            'overhead_pct'     => (float) $costEstimate->overhead_pct,
            'vat_pct'          => (float) $costEstimate->vat_pct,
            'tax_pct'          => (float) ($costEstimate->tax_pct ?? 0),
            'times_multiplier' => (float) $costEstimate->times_multiplier,
            'extra_cost'       => (float) $costEstimate->extra_cost,
            'actual_size'      => $costEstimate->actual_size,
            'materials_size'   => $costEstimate->materials_size,
            'lines'            => $costEstimate->lines->map(fn ($l) => [
                'section'      => $l->section,
                'material_id'  => $l->material_id,
                'operation_id' => $l->operation_id,
                'description'  => $l->description,
                'quantity'     => (string) $l->quantity,
                'unit'         => $l->unit,
                'rate'         => (string) $l->rate,
            ])->values(),
        ]);
    }

    private function normalizeOverride($value): ?float
    {
        if ($value === null || $value === '' || $value === false) return null;
        $f = (float) $value;
        return $f > 0 ? $f : null;
    }

    /**
     * Create a CostEstimate with retry-on-conflict for the auto-generated
     * estimate_no. Two concurrent submits can both compute "EST-2026-0002"
     * before either commits, so on UniqueConstraintViolationException we
     * regenerate and try again — up to 5 times.
     */
    private function createEstimateWithRetry(array $payload): CostEstimate
    {
        $attempts = 0;
        while (true) {
            try {
                $payload['estimate_no'] = CostEstimate::generateEstimateNo();
                return CostEstimate::create($payload);
            } catch (\Illuminate\Database\UniqueConstraintViolationException $e) {
                if (++$attempts >= 5 || !str_contains((string) $e->getMessage(), 'estimate_no')) {
                    throw $e;
                }
                usleep(50_000); // 50ms back-off
            }
        }
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
            'grand_total_override' => $e->grand_total_override,
            'net_cost'         => $e->net_cost,
            'overhead_amount'  => $e->overhead_amount,
            'extra_cost'       => $e->extra_cost ?? 0,
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
            // Set when this estimate covers ONE part of the job rather than
            // the whole job. Null = whole-job estimate (the old behaviour).
            'rfq_item_part_id' => 'nullable|exists:rfq_item_parts,id',
            'customer_id'      => 'nullable|exists:customers,id',
            'company_name'     => 'nullable|string|max:200',
            'job_name'         => 'required|string|max:200',
            'part_no'          => 'nullable|string|max:50',
            'actual_size'      => 'nullable|string|max:100',
            'materials_size'   => 'nullable|string|max:100',
            'pricing_group'    => 'required|in:A,B,C,STUDENT,PUBLIC',
            'overhead_pct'     => 'nullable|numeric|min:0|max:1000',
            'extra_cost'       => 'nullable|numeric|min:0',
            'vat_pct'          => 'nullable|numeric|min:0|max:100',
            'tax_pct'          => 'nullable|numeric|min:0|max:100',
            'times_multiplier' => 'nullable|numeric|min:0|max:100',
            'job_quantity'     => 'nullable|integer|min:1',
            // Manual rounding override (e.g. ৳250,500 → ৳250,000). Null/0 = use auto.
            'grand_total_override' => 'nullable|numeric|min:0',
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
        // Customer's reference number from the originating RFQ — falls back to
        // the estimate number when no RFQ ref was provided.
        $refNo       = $esc($e->rfq?->customer_ref_no ?: $e->estimate_no);

        // ─── Memo block — top-left customer ref no, top-right date (English) ───
        $memoBlock = '<table width="100%" cellspacing="0" cellpadding="0" style="margin-bottom: 14pt;">'
            . '<tr>'
            .   '<td style="font-size: 11pt; color: #000;"><b>Ref No.</b> - ' . $refNo . '</td>'
            .   '<td style="font-size: 11pt; color: #000; text-align: right;"><b>Date:</b> ' . $esc($createdAt) . '</td>'
            . '</tr>'
            . '</table>';

        // ─── Centered title ────────────────────────────────────────────
        $titleBlock = '<div style="text-align: center; margin-bottom: 14pt;">'
            . '<div style="font-size: 13pt; font-weight: bold; color: #000; letter-spacing: 0.3pt;">COST ESTIMATE</div>'
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
            'surface'   => ['label' => 'C. Heat Treatment Cost',    'lines' => []],
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

            // Section header row — title only, subtotal moved to the bottom.
            $sectionsHtml .= '<tr>';
            $sectionsHtml .=   '<td colspan="6" style="border: 0.75pt solid #000; padding: 4pt 8pt; font-size: 10pt; font-weight: bold; color: #000;">' . $esc($sec['label']) . '</td>';
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

            // Section subtotal row at the bottom — aligned under the Amount column.
            $sectionsHtml .= '<tr>';
            $sectionsHtml .=   '<td colspan="5" style="border: 0.75pt solid #000; padding: 5pt 8pt; font-size: 10pt; text-align: right; font-weight: bold; color: #000;">Subtotal</td>';
            $sectionsHtml .=   '<td style="border: 0.75pt solid #000; padding: 5pt 6pt; font-size: 10pt; text-align: right; white-space: nowrap; font-weight: bold; color: #000;">' . $fmt($sectionTotal) . '</td>';
            $sectionsHtml .= '</tr>';

            $sectionsHtml .= '</table>';
        }

        // ─── Summary card right-aligned (plain, no color, like Quotation) ───
        $summary  = '<table align="right" cellspacing="0" cellpadding="0" style="border-collapse: collapse; border: 0.75pt solid #000; width: 320pt; margin-top: 6pt;">';
        $showVat = (float) $e->vat_amount > 0;
        $showTax = (float) ($e->tax_amount ?? 0) > 0;
        // Only annotate "incl. VAT & Tax" when those rows are NOT shown.
        $inclSuffix = (!$showVat && !$showTax) ? ', incl. VAT & Tax' : '';

        $rows = [
            ['Net Cost',                                    $e->net_cost,        false],
            ["Overhead ({$e->overhead_pct}%)",              $e->overhead_amount, false],
        ];
        if ($showVat) {
            $rows[] = ["VAT ({$e->vat_pct}%)",              $e->vat_amount,      false];
        }
        if ($showTax) {
            $rows[] = ["Tax ({$e->tax_pct}%)",             $e->tax_amount ?? 0, false];
        }
        $rows = array_merge($rows, [
            ["Total (per unit{$inclSuffix})",               $e->total,           true],
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
        $grandLabel = (!$showVat && !$showTax) ? 'Grand Total (Including VAT &amp; TAX)' : 'Grand Total';
        $summary .=   '<td style="border: 0.75pt solid #000; padding: 6pt 8pt; font-size: 11pt; color: #000; font-weight: bold;">' . $grandLabel . '</td>';
        $summary .=   '<td style="border: 0.75pt solid #000; padding: 6pt 6pt; font-size: 11pt; color: #000; text-align: right; white-space: nowrap; font-weight: bold;">' . $fmt($e->grand_total) . '</td>';
        $summary .= '</tr>';
        $summary .= '</table>';

        // ─── Signatory grid: Prepared By · Checked By · Approved By ─────
        // Prepared By = creator (saved signature). Checked By = first approver,
        // Approved By = final approver — each shows the assigned person's name
        // always, and their signature only once that step is approved.
        $sigImg = fn($absPath) => $absPath
            ? '<img src="' . $absPath . '" style="height: 38pt; max-width: 140pt;" alt="signature" />'
            : '<div style="height: 38pt;"></div>';

        // Render one signatory cell.
        $sigCell = function (string $role, ?string $sigAbs, bool $signed, ?object $person, ?string $date, string $align, bool $pendingNote) use ($sigImg, $esc) {
            $name   = $esc($person?->name ?? '');
            $title  = $esc($person?->designation ?? '');
            $center = $esc($person?->center?->name ?? '');
            $imgHtml = $signed
                ? $sigImg($sigAbs)
                : ($pendingNote
                    ? '<div style="height: 38pt; text-align: center;"><span style="font-size: 8pt; font-style: italic; color: #94a3b8;">(Pending)</span></div>'
                    : '<div style="height: 38pt;"></div>');
            $html = '<td style="vertical-align: bottom; text-align: ' . $align . '; padding: 0 6pt;">'
                . '<div style="margin-bottom: 4pt;">' . $imgHtml . '</div>'
                . '<div style="border-top: 0.75pt solid #000; padding-top: 4pt; font-size: 10pt; font-weight: bold; color: #000; display: inline-block; min-width: 110pt;">' . $role . '</div>';
            if ($name !== '') {
                $html .= '<div style="font-size: 10pt; color: #a349a4; margin-top: 2pt;">' . $name . '</div>';
                if ($title !== '')  $html .= '<div style="font-size: 9pt; color: #a349a4; margin-top: 1pt;">' . $title . '</div>';
                if ($center !== '') $html .= '<div style="font-size: 9pt; color: #a349a4;">' . $center . '</div>';
                if ($date)          $html .= '<div style="font-size: 8pt; color: #a349a4; margin-top: 1pt;">' . $esc($date) . '</div>';
            }
            return $html . '</td>';
        };

        $preparer = $e->createdBy;
        // Checked By = first approver row; Approved By = final (last) approver row.
        $checkedRow  = $e->approvals->firstWhere('label', 'Checked By');
        $approvedRow = $e->approvals->firstWhere('label', 'Approved By')
                    ?? $e->approvals->sortByDesc('level')->first();

        $cells  = $sigCell('Prepared By', $preparer?->signatureAbsolutePath(), (bool) $preparer?->signatureAbsolutePath(), $preparer, null, 'left', false);
        if ($checkedRow) {
            $cells .= $sigCell(
                'Checked By',
                $checkedRow->signatureAbsolutePath() ?? $checkedRow->approver?->signatureAbsolutePath(),
                $checkedRow->status === 'approved',
                $checkedRow->approver,
                $checkedRow->status === 'approved' ? ($checkedRow->acted_at?->format('d/m/Y') ?? '') : null,
                'center',
                true,
            );
        }
        if ($approvedRow) {
            $cells .= $sigCell(
                'Approved By',
                $approvedRow->signatureAbsolutePath() ?? $approvedRow->approver?->signatureAbsolutePath(),
                $approvedRow->status === 'approved',
                $approvedRow->approver,
                $approvedRow->status === 'approved' ? ($approvedRow->acted_at?->format('d/m/Y') ?? '') : null,
                'right',
                true,
            );
        }

        $signatureBlock = '<table width="100%" cellspacing="0" cellpadding="0" style="margin-top: 30pt; border-collapse: collapse; table-layout: fixed;">'
            . '<tr>' . $cells . '</tr>'
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

        // Letterhead language: 'en' for foreign clients, 'bn' (default) for local.
        // Pass via `?lang=en` query param. Validated inside the service too.
        $lang = $request->query('lang') === 'en' ? 'en' : 'bn';

        $bytes    = app(\App\Services\BitacLetterhead::class)->render($bodyHtml, "Cost Estimate {$e->estimate_no}", null, $lang);
        $filename = "estimate-{$e->estimate_no}" . ($lang === 'en' ? '-EN' : '') . '.pdf';

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
