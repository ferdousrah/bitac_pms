<?php

namespace App\Http\Controllers;

use App\Models\Customer;
use App\Models\Quotation;
use App\Models\Rfq;
use App\Services\NotifyService;
use App\Services\QuotationService;
use App\Services\WorkOrderService;
use Barryvdh\DomPDF\Facade\Pdf;
use Illuminate\Http\Request;
use Inertia\Inertia;

class QuotationController extends Controller
{
    public function __construct(
        private QuotationService $quotationService,
        private WorkOrderService $workOrderService
    ) {}

    public function index(Request $request)
    {
        $query = Quotation::with(['rfq.items.product', 'customer', 'createdBy']);

        if ($search = $request->input('search')) {
            $query->where(function ($q) use ($search) {
                $q->where('id', 'like', "%{$search}%")
                  ->orWhere('customer_po_no', 'like', "%{$search}%")
                  ->orWhereHas('customer', fn($c) => $c->where('name', 'like', "%{$search}%"))
                  ->orWhereHas('rfq.items', fn($i) => $i->where('job_description', 'like', "%{$search}%"));
            });
        }
        if ($status = $request->input('status')) $query->where('status', $status);
        if ($customerId = $request->input('customer_id')) $query->where('customer_id', $customerId);

        $sort = $request->input('sort', 'id');
        $dir  = $request->input('dir', 'desc');
        $allowed = ['id', 'customer_id', 'total_amount', 'version', 'status', 'created_at'];
        if (in_array($sort, $allowed)) {
            $query->orderBy($sort, $dir === 'asc' ? 'asc' : 'desc');
        } else {
            $query->latest();
        }

        $quotations = $query->paginate(15)->withQueryString();

        return Inertia::render('Quotation/Index', [
            'quotations' => $quotations->through(fn($q) => [
                'id'           => $q->id,
                'customer'     => $q->customer?->name ?? '—',
                'product'      => $q->rfq?->items->first()?->job_description
                                    ?? $q->rfq?->items->first()?->product?->name
                                    ?? '—',
                'rfq_id'       => $q->rfq_id,
                'version'      => $q->version,
                'total_amount' => $q->total_amount,
                'status'       => $q->status,
                'created_by'   => $q->createdBy?->name ?? '—',
                'created_at'   => $q->created_at->format('d/m/Y'),
            ]),
            'filters' => [
                'search'      => $request->input('search', ''),
                'status'      => $request->input('status', ''),
                'customer_id' => $request->input('customer_id', ''),
                'sort'        => $sort,
                'dir'         => $dir,
            ],
            'customers' => Customer::where('is_active', true)->orderBy('name')->get(['id', 'name']),
        ]);
    }

    public function create(Request $request)
    {
        $rfqId = $request->query('rfq_id');
        $rfq   = $rfqId ? Rfq::with(['customer', 'items.product', 'items.costEstimates'])->findOrFail($rfqId) : null;

        // For each RFQ item, find the latest finalized cost estimate (if any)
        // and pre-fill the unit price (pre-VAT) so the preparer doesn't start from blank.
        $items = $rfq ? $rfq->items->map(function ($i) {
            $estimate = $i->costEstimates
                ->where('status', '!=', 'draft')
                ->sortByDesc('id')
                ->first() ?? $i->costEstimates->sortByDesc('id')->first();

            // Pre-VAT unit price = estimate.total / job_quantity
            $unitPrice = null;
            if ($estimate && $estimate->job_quantity > 0) {
                $unitPrice = round(((float) $estimate->total) / (int) $estimate->job_quantity, 2);
            }

            return [
                'rfq_item_id'  => $i->id,
                'description'  => $i->job_description ?? $i->product?->name ?? '—',
                'quantity'     => (float) $i->quantity,
                'unit'         => $i->unit,
                'unit_price'   => $unitPrice,
                'estimate_no'  => $estimate?->estimate_no,
                'estimate_id'  => $estimate?->id,
            ];
        })->values() : [];

        return Inertia::render('Quotation/Create', [
            'rfq'       => $rfq ? [
                'id'          => $rfq->id,
                'customer_id' => $rfq->customer_id,
                'customer'    => ['name' => $rfq->customer?->name ?? ''],
                'items'       => $items,
            ] : null,
            'customers'    => Customer::where('is_active', true)->get(['id', 'name']),
            'vatRate'      => config('app.vat_rate', 15),
            'kickoffNote'  => $request->query('kickoff_note'),
            'sourceEstimateId' => $request->query('estimate_id'),
        ]);
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'rfq_id'                  => 'required|exists:rfqs,id',
            'vat_rate'                => 'required|numeric|min:0|max:100',
            'validity_days'           => 'required|integer|min:1',
            'notes'                   => 'nullable|string',
            'items'                   => 'required|array|min:1',
            'items.*.description'     => 'required|string|max:255',
            'items.*.quantity'        => 'required|numeric|min:0',
            'items.*.unit_price'      => 'required|numeric|min:0',
            'attachments'             => 'nullable|array',
            'attachments.*'           => 'file|max:20480', // 20 MB each
            'attachment_kinds'        => 'nullable|array',
            'attachment_kinds.*'      => 'nullable|in:supporting,annexure,spec,other',
        ]);

        $rfq = Rfq::findOrFail($validated['rfq_id']);

        // Compute subtotal from line items — this is the single source of truth.
        $subtotal = 0.0;
        foreach ($validated['items'] as $item) {
            $subtotal += ((float) $item['quantity']) * ((float) $item['unit_price']);
        }
        $vatRate   = (float) $validated['vat_rate'];
        $vatAmount = round($subtotal * ($vatRate / 100), 2);
        $total     = round($subtotal + $vatAmount, 2);

        $saveAsDraft = $request->boolean('save_as_draft');

        $quotation = Quotation::create([
            'rfq_id'        => $validated['rfq_id'],
            'customer_id'   => $rfq->customer_id,
            'version'       => $this->quotationService->getNextVersion($rfq->id),
            'material_cost' => round($subtotal, 2),  // legacy column — now holds the pre-VAT subtotal
            'labour_cost'   => 0,
            'overhead_cost' => 0,
            'profit_margin' => 0,
            'discount'      => 0,
            'vat_rate'      => $vatRate,
            'vat_amount'    => $vatAmount,
            'total_amount'  => $total,
            'validity_days' => $validated['validity_days'],
            'notes'         => $validated['notes'] ?? null,
            'status'        => $saveAsDraft ? 'draft' : 'pending_approval',
            'created_by'    => auth()->id(),
        ]);

        foreach ($validated['items'] as $item) {
            $quotation->items()->create([
                'description' => $item['description'],
                'quantity'    => $item['quantity'],
                'unit_price'  => $item['unit_price'],
                'amount'      => round(((float) $item['quantity']) * ((float) $item['unit_price']), 2),
            ]);
        }

        // Preparer-uploaded supporting files (annexures, specs, rationale, etc.)
        $uploadedFiles = $request->file('attachments') ?? [];
        $kinds = $request->input('attachment_kinds') ?? [];
        if (!is_array($uploadedFiles)) $uploadedFiles = [$uploadedFiles];
        foreach ($uploadedFiles as $idx => $file) {
            if (!$file) continue;
            $storedPath = $file->store("quotations/{$quotation->id}", 'public');
            $quotation->files()->create([
                'uploaded_by'   => auth()->id(),
                'stored_path'   => $storedPath,
                'original_name' => $file->getClientOriginalName(),
                'mime_type'     => $file->getMimeType(),
                'size_bytes'    => $file->getSize(),
                'kind'          => $kinds[$idx] ?? 'supporting',
                'sort_order'    => $idx,
            ]);
        }

        if (!$saveAsDraft) {
            $this->quotationService->createApprovalChain($quotation);
            $rfq->update(['status' => 'quoted']);

            // Notify approvers
            $approverIds = $quotation->approvals()->pluck('approver_id')->toArray();
            if (!empty($approverIds)) {
                NotifyService::send($approverIds, 'approval_needed', 'Quotation Awaiting Approval',
                    "Quotation #{$quotation->id} (৳" . number_format($quotation->total_amount) . ") needs your approval",
                    "/quotations/{$quotation->id}", 'fi-rr-shield-check', 'amber');
            }
        }

        app(\App\Services\RevisionTracker::class)->trackQuotation(
            $quotation->fresh(),
            $saveAsDraft ? 'created' : 'submitted_for_approval'
        );

        return redirect()->route('quotations.show', $quotation)
            ->with('success', $saveAsDraft ? 'Quotation saved as draft.' : 'Quotation created and sent for approval.');
    }

    public function show(Quotation $quotation)
    {
        $quotation->load([
            'items', 'files.uploadedBy',
            'rfq.items.product', 'rfq.items.drawings', 'rfq.items.samplePhotos',
            'rfq.items.costEstimates',
            'rfq.customer', 'customer', 'createdBy',
            'approvals.approver', 'workOrder',
            'customerResponses.recordedBy', 'parent', 'revisions',
        ]);

        // Source cost estimates — one per RFQ item (most recent finalized/used one).
        // The approver can click through to preview these alongside the quotation.
        $sourceEstimates = $quotation->rfq?->items->map(function ($item) {
            $estimate = $item->costEstimates
                ->sortByDesc(fn($e) => [$e->status === 'used' ? 2 : ($e->status === 'finalized' ? 1 : 0), $e->id])
                ->first();
            if (!$estimate) return null;
            return [
                'id'            => $estimate->id,
                'estimate_no'   => $estimate->estimate_no,
                'job_name'      => $estimate->job_name,
                'status'        => $estimate->status,
                'grand_total'   => (float) $estimate->grand_total,
                'pricing_group' => $estimate->pricing_group,
                'pdf_url'       => "/cost-estimates/{$estimate->id}/pdf?preview=base64",
                'pdf_download_url' => "/cost-estimates/{$estimate->id}/pdf",
                'view_url'      => "/cost-estimates/{$estimate->id}",
                'item_desc'     => $item->job_description ?? $item->product?->name,
                'item_qty'      => $item->quantity,
                'item_unit'     => $item->unit,
            ];
        })->filter()->values() ?? collect();

        // RFQ attachments inherited from the source RFQ — drawings + sample photos
        // uploaded by the sales officer. Shown on the quotation for reviewer context.
        $rfqAttachments = $quotation->rfq?->items->map(fn($i) => [
            'item_id'            => $i->id,
            'job_description'    => $i->job_description ?? $i->product?->name,
            'reference_type'     => $i->reference_type ?? 'none',
            'sample_received'    => (bool) $i->sample_received,
            'sample_description' => $i->sample_description,
            'drawings'           => $i->drawings->map(fn($f) => [
                'id'        => $f->id,
                'url'       => $f->url,
                'filename'  => $f->original_name,
                'extension' => pathinfo($f->original_name, PATHINFO_EXTENSION),
            ])->values(),
            'sample_photos'      => $i->samplePhotos->map(fn($f) => [
                'id'       => $f->id,
                'url'      => $f->url,
                'filename' => $f->original_name,
            ])->values(),
        ])->filter(fn($x) => count($x['drawings']) > 0 || count($x['sample_photos']) > 0 || !empty($x['sample_description']))
        ->values() ?? collect();
        $user = auth()->user();

        $pendingApproval = $quotation->approvals()
            ->where('approver_id', $user->id)
            ->where('status', 'pending')
            ->exists();

        // Build the revision chain (all versions)
        $chain = $quotation->revisionChain()->map(fn($q) => [
            'id'      => $q->id,
            'version' => $q->version,
            'status'  => $q->status,
            'is_current' => $q->id === $quotation->id,
        ]);

        return Inertia::render('Quotation/Show', [
            'quotation' => [
                'id'              => $quotation->id,
                'version'         => $quotation->version,
                'status'          => $quotation->status,
                'rfq_id'          => $quotation->rfq_id,
                'customer'        => $quotation->customer?->name ?? $quotation->rfq?->customer?->name ?? '',
                'customer_po_no'  => $quotation->customer_po_no,
                'parent_quotation_id' => $quotation->parent_quotation_id,
                'sent_to_customer_at'  => $quotation->sent_to_customer_at?->format('d M Y'),
                'customer_responded_at'=> $quotation->customer_responded_at?->format('d M Y'),
                // Line items with prices (from quotation_items) — primary source
                'line_items'      => $quotation->items->map(fn($li) => [
                    'id'          => $li->id,
                    'description' => $li->description,
                    'quantity'    => (float) $li->quantity,
                    'unit_price'  => (float) $li->unit_price,
                    'amount'      => (float) $li->amount,
                ])->values(),
                // Raw RFQ items (no pricing) — kept for context/fallback
                'rfq_items'       => $quotation->rfq?->items->map(fn($i) => [
                    'description' => $i->job_description ?? $i->product?->name ?? '—',
                    'quantity'    => $i->quantity,
                    'unit'        => $i->unit,
                ]) ?? [],
                'subtotal'        => (float) $quotation->material_cost, // stored as subtotal under legacy column
                'material_cost'   => $quotation->material_cost,
                'labour_cost'     => $quotation->labour_cost,
                'overhead_cost'   => $quotation->overhead_cost,
                'profit_margin'   => $quotation->profit_margin,
                'discount'        => $quotation->discount,
                'vat_rate'        => $quotation->vat_rate,
                'vat_amount'      => $quotation->vat_amount,
                'total_amount'    => $quotation->total_amount,
                'validity_days'   => $quotation->validity_days,
                'notes'           => $quotation->notes,
                'created_by_name' => $quotation->createdBy->name ?? '',
                'created_at'      => $quotation->created_at->format('d M Y'),
                'approvals'       => $quotation->approvals->sortBy('level')->map(fn($a) => [
                    'id'       => $a->id,
                    'level'    => $a->level,
                    'decision' => $a->status === 'pending' ? null : $a->status,
                    'approver' => ['name' => $a->approver?->name],
                    'comments' => $a->remarks,
                ])->values(),
                'customer_responses' => $quotation->customerResponses->map(fn($r) => [
                    'id'              => $r->id,
                    'response_type'   => $r->response_type,
                    'customer_po_no'  => $r->customer_po_no,
                    'feedback'        => $r->feedback,
                    'response_date'   => $r->response_date->format('d M Y'),
                    'attachment_url'  => $r->attachment_path ? \Storage::url($r->attachment_path) : null,
                    'recorded_by'     => $r->recordedBy?->name,
                ]),
                'revision_chain'  => $chain,
                'work_order'      => $quotation->workOrder ? [
                    'id'         => $quotation->workOrder->id,
                    'wo_number'  => $quotation->workOrder->wo_number,
                    'job_number' => $quotation->workOrder->job_number,
                ] : null,
            ],
            'revisions'          => \App\Models\EntityRevision::where('entity_type', 'quotation')
                ->where('entity_id', $quotation->id)
                ->with('changedBy:id,name')
                ->orderByDesc('revision_no')
                ->get()
                ->map(function ($r) {
                    $meta = \App\Models\EntityRevision::eventMeta($r->event);
                    return [
                        'id'              => $r->id,
                        'revision_no'     => $r->revision_no,
                        'event'           => $r->event,
                        'event_label'     => $meta['label'],
                        'event_icon'      => $meta['icon'],
                        'event_color'     => $meta['color'],
                        'grand_total_at'  => $r->grand_total_at,
                        'change_reason'   => $r->change_reason,
                        'auto_summary'    => $r->auto_summary,
                        'changes'         => $r->changes,
                        'changed_by'      => $r->changedBy?->name ?? '—',
                        'created_at'      => $r->created_at->format('d M Y, H:i'),
                        'created_at_diff' => $r->created_at->diffForHumans(),
                    ];
                }),
            'rfqAttachments'     => $rfqAttachments,
            'sourceEstimates'    => $sourceEstimates,
            'attachments'        => $quotation->files->map(fn($f) => [
                'id'            => $f->id,
                'url'           => $f->url,
                'filename'      => $f->original_name,
                'extension'     => $f->extension,
                'mime_type'     => $f->mime_type,
                'size_bytes'    => $f->size_bytes,
                'human_size'    => $f->human_size,
                'kind'          => $f->kind,
                'uploaded_by'   => $f->uploadedBy?->name,
                'uploaded_at'   => $f->created_at->format('d M Y, H:i'),
                'can_delete'    => $f->uploaded_by === $user->id
                    || (method_exists($user, 'hasRole') && $user->hasRole('super_admin')),
            ])->values(),
            'comments'           => \App\Models\EntityComment::forEntity('quotation', $quotation->id)
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
                    'can_delete'      => $c->user_id === $user->id
                        || (method_exists($user, 'hasRole') && $user->hasRole('super_admin')),
                ]),
            'canSubmitForApproval' => $quotation->status === 'draft',
            'canApprove'         => $pendingApproval && $user->can('approve quotations'),
            'canReject'          => $pendingApproval && $user->can('reject quotations'),
            'canSendToCustomer'  => $quotation->status === 'approved' && $user->can('convert quotations'),
            'canRecordResponse'  => in_array($quotation->status, ['sent_to_customer', 'revision_requested']) && $user->can('convert quotations'),
            'canCreateRevision'  => $quotation->status === 'revision_requested' && $user->can('create quotation-revision'),
            'canConvert'         => in_array($quotation->status, ['approved', 'sent_to_customer', 'customer_accepted']) && $user->can('convert quotations') && !$quotation->workOrder,
        ]);
    }

    public function deleteFile(\App\Models\QuotationFile $file)
    {
        $user = auth()->user();
        $isUploader = $file->uploaded_by === $user->id;
        $isAdmin    = method_exists($user, 'hasRole') && $user->hasRole('super_admin');
        if (!$isUploader && !$isAdmin) {
            abort(403, 'You can only delete files you uploaded.');
        }
        if ($file->stored_path) {
            \Storage::disk('public')->delete($file->stored_path);
        }
        $file->delete();
        return back()->with('success', 'Attachment removed.');
    }

    public function submitForApproval(Quotation $quotation)
    {
        abort_unless($quotation->status === 'draft', 422, 'Only draft quotations can be submitted.');

        $this->quotationService->createApprovalChain($quotation);
        $quotation->update(['status' => 'pending_approval']);

        if ($quotation->rfq_id) {
            Rfq::where('id', $quotation->rfq_id)->update(['status' => 'quoted']);
        }

        $approverIds = $quotation->approvals()->pluck('approver_id')->toArray();
        if (!empty($approverIds)) {
            NotifyService::send($approverIds, 'approval_needed', 'Quotation Awaiting Approval',
                "Quotation #{$quotation->id} (৳" . number_format($quotation->total_amount) . ") needs your approval",
                "/quotations/{$quotation->id}", 'fi-rr-shield-check', 'amber');
        }

        app(\App\Services\RevisionTracker::class)->trackQuotation($quotation->fresh(), 'submitted_for_approval');

        return back()->with('success', 'Quotation submitted for approval.');
    }

    public function approve(Request $request, Quotation $quotation)
    {
        $approval = $quotation->approvals()
            ->where('approver_id', auth()->id())
            ->where('status', 'pending')
            ->first();

        if (!$approval) {
            return back()->with('error', 'No pending approval found for you on this quotation. It may have already been actioned.');
        }

        $approval->update([
            'status'      => 'approved',
            'remarks'     => $request->input('remarks'),
            'approved_at' => now(),
        ]);

        $allApproved = $this->quotationService->checkApprovalChain($quotation);
        $remark = $request->input('remarks');

        if ($allApproved) {
            $quotation->update(['status' => 'approved']);
            // Notify the creator that quotation is fully approved
            $body = "Quotation #{$quotation->id} has been fully approved. Ready to send to customer.";
            if ($remark) $body .= "\nNote: \"{$remark}\"";
            NotifyService::send(
                $quotation->created_by,
                'quotation_approved',
                'Quotation Approved',
                $body,
                "/quotations/{$quotation->id}",
                'fi-rr-check-circle',
                'green',
            );
        } else if ($remark) {
            // Partial approval with a note — still notify the creator about the approver's comment
            NotifyService::send(
                $quotation->created_by,
                'quotation_approval_note',
                'Approval Note on Quotation',
                auth()->user()->name . " approved quotation #{$quotation->id} with a note:\n\"{$remark}\"",
                "/quotations/{$quotation->id}",
                'fi-rr-comment',
                'blue',
            );
        }

        app(\App\Services\RevisionTracker::class)->trackQuotation(
            $quotation->fresh(),
            'approved',
            $remark
        );

        return back()->with('success', 'Quotation approved.');
    }

    public function reject(Request $request, Quotation $quotation)
    {
        $approval = $quotation->approvals()
            ->where('approver_id', auth()->id())
            ->where('status', 'pending')
            ->first();

        if (!$approval) {
            return back()->with('error', 'No pending approval found for you on this quotation. It may have already been actioned.');
        }

        $approval->update([
            'status'  => 'rejected',
            'remarks' => $request->input('remarks'),
        ]);

        $quotation->update(['status' => 'rejected']);

        $remark = $request->input('remarks');
        $body = "Quotation #{$quotation->id} was rejected by " . auth()->user()->name . '.';
        if ($remark) $body .= "\nReason: \"{$remark}\"";

        NotifyService::send(
            $quotation->created_by,
            'quotation_rejected',
            'Quotation Rejected',
            $body,
            "/quotations/{$quotation->id}",
            'fi-rr-cross-circle',
            'red',
        );

        app(\App\Services\RevisionTracker::class)->trackQuotation(
            $quotation->fresh(),
            'rejected',
            $request->input('remarks')
        );

        return back()->with('success', 'Quotation rejected.');
    }

    public function pdf(Request $request, Quotation $quotation)
    {
        $quotation->load(['rfq.items.product', 'rfq.customer', 'customer', 'createdBy', 'items', 'approvals.approver']);

        $fmt = fn($v) => number_format((float) ($v ?? 0), 2);
        $esc = fn($v) => htmlspecialchars((string) ($v ?? ''), ENT_QUOTES | ENT_HTML5, 'UTF-8');
        $date = now()->format('d M Y, H:i');

        $customer       = $quotation->customer?->name ?? $quotation->rfq?->customer?->name ?? '—';
        $customerPO     = $quotation->customer_po_no ?? '—';
        $createdByName  = $quotation->createdBy?->name ?? '—';
        $createdAt      = $quotation->created_at->format('d M Y');
        $statusLabel    = ucfirst(str_replace('_', ' ', (string) $quotation->status));
        $statusColor    = match ($quotation->status) {
            'approved', 'customer_accepted'                => '#059669',
            'sent_to_customer'                             => '#7c3aed',
            'rejected', 'customer_rejected'                => '#dc2626',
            'revision_requested', 'pending_approval'       => '#d97706',
            default                                        => '#64748b',
        };

        // Line items — uses quotation_items (the new schema). Fallback to RFQ items
        // if no quotation_items rows exist (legacy quotations).
        $lineItems = $quotation->items;
        if ($lineItems->isEmpty() && $quotation->rfq) {
            $lineItems = $quotation->rfq->items->map(fn($i) => (object) [
                'description' => $i->job_description ?? $i->product?->name ?? '—',
                'quantity'    => $i->quantity,
                'unit_price'  => 0,
                'amount'      => 0,
            ]);
        }

        $itemsHtml  = '<table width="100%" cellspacing="0" cellpadding="0" style="border-collapse: collapse; border: 1pt solid #94a3b8; margin-bottom: 4pt;">';
        $itemsHtml .= '<tr style="background: #1e40af; color: white;">';
        $itemsHtml .=   '<th width="5%"  style="padding: 6pt 8pt; font-size: 8pt; font-weight: bold; text-align: center; letter-spacing: 0.3pt; border-right: 1pt solid #1e3a8a;">#</th>';
        $itemsHtml .=   '<th width="55%" style="padding: 6pt 8pt; font-size: 8pt; font-weight: bold; text-align: left;   letter-spacing: 0.3pt; border-right: 1pt solid #1e3a8a;">DESCRIPTION</th>';
        $itemsHtml .=   '<th width="10%" style="padding: 6pt 8pt; font-size: 8pt; font-weight: bold; text-align: right;  letter-spacing: 0.3pt; border-right: 1pt solid #1e3a8a;">QTY</th>';
        $itemsHtml .=   '<th width="15%" style="padding: 6pt 8pt; font-size: 8pt; font-weight: bold; text-align: right;  letter-spacing: 0.3pt; border-right: 1pt solid #1e3a8a;">UNIT PRICE</th>';
        $itemsHtml .=   '<th width="15%" style="padding: 6pt 8pt; font-size: 8pt; font-weight: bold; text-align: right;  letter-spacing: 0.3pt;">AMOUNT</th>';
        $itemsHtml .= '</tr>';
        if ($lineItems->isEmpty()) {
            $itemsHtml .= '<tr><td colspan="5" style="padding: 10pt; text-align: center; color: #9ca3af; font-style: italic; font-size: 9pt;">No line items</td></tr>';
        } else {
            foreach ($lineItems as $i => $li) {
                $bg = $i % 2 === 0 ? '#ffffff' : '#fafafa';
                $itemsHtml .= "<tr style='background: {$bg};'>";
                $itemsHtml .=   '<td style="padding: 6pt 8pt; border-top: 1pt solid #cbd5e1; font-size: 9pt; font-weight: bold; color: #1e40af; text-align: center; vertical-align: top;">' . ($i + 1) . '</td>';
                $itemsHtml .=   '<td style="padding: 6pt 8pt; border-top: 1pt solid #cbd5e1; font-size: 9pt; color: #111827; vertical-align: top;">' . $esc($li->description) . '</td>';
                $itemsHtml .=   '<td style="padding: 6pt 8pt; border-top: 1pt solid #cbd5e1; font-size: 9pt; font-family: dejavusansmono; text-align: right; vertical-align: top; white-space: nowrap;">' . $fmt($li->quantity) . '</td>';
                $itemsHtml .=   '<td style="padding: 6pt 8pt; border-top: 1pt solid #cbd5e1; font-size: 9pt; font-family: dejavusansmono; text-align: right; vertical-align: top; white-space: nowrap;">' . $fmt($li->unit_price) . '</td>';
                $itemsHtml .=   '<td style="padding: 6pt 8pt; border-top: 1pt solid #cbd5e1; font-size: 9pt; font-family: dejavusansmono; text-align: right; font-weight: bold; color: #111827; vertical-align: top; white-space: nowrap;">' . $fmt($li->amount) . '</td>';
                $itemsHtml .= '</tr>';
            }
        }
        $itemsHtml .= '</table>';

        // Totals card — sits to the right under the items table
        $subtotal = (float) $quotation->material_cost; // we repurpose material_cost as pre-VAT subtotal
        $vatAmt   = (float) $quotation->vat_amount;
        $total    = (float) $quotation->total_amount;
        $totalsHtml  = '<table align="right" cellspacing="0" cellpadding="0" style="border-collapse: collapse; border: 1pt solid #94a3b8; width: 290pt; margin-top: 6pt;">';
        $totalsHtml .= '<tr><td style="padding: 5pt 10pt; font-size: 9pt; color: #4b5563; border-bottom: 1pt solid #e5e7eb;">Subtotal</td><td style="padding: 5pt 10pt; font-size: 9pt; font-family: dejavusansmono; text-align: right; font-weight: bold; color: #111827; border-bottom: 1pt solid #e5e7eb; white-space: nowrap;">' . $fmt($subtotal) . '</td></tr>';
        $totalsHtml .= '<tr><td style="padding: 5pt 10pt; font-size: 9pt; color: #4b5563; border-bottom: 1pt solid #e5e7eb;">VAT (' . $fmt($quotation->vat_rate) . '%)</td><td style="padding: 5pt 10pt; font-size: 9pt; font-family: dejavusansmono; text-align: right; font-weight: bold; color: #111827; border-bottom: 1pt solid #e5e7eb; white-space: nowrap;">' . $fmt($vatAmt) . '</td></tr>';
        $totalsHtml .= '<tr style="background: #0f172a;">';
        $totalsHtml .=   '<td style="padding: 8pt 10pt; font-size: 10pt; color: white; font-weight: bold;">Grand Total</td>';
        $totalsHtml .=   '<td style="padding: 8pt 10pt; font-size: 13pt; font-family: dejavusansmono; text-align: right; font-weight: bold; color: #fbbf24; white-space: nowrap;">BDT ' . $fmt($total) . '</td>';
        $totalsHtml .= '</tr>';
        $totalsHtml .= '</table>';

        // Notes / terms block (customer-facing)
        $notesHtml = $quotation->notes
            ? '<table width="100%" cellspacing="0" cellpadding="0" style="margin-top: 14pt; border-collapse: collapse;">'
                . '<tr>'
                    . '<td width="4pt" style="background: #1e40af;"></td>'
                    . '<td style="padding: 8pt 12pt; background: #eff6ff; border: 1pt solid #93c5fd; border-left: 0;">'
                        . '<div style="font-size: 8pt; color: #1e40af; text-transform: uppercase; letter-spacing: 0.4pt; font-weight: bold;">Terms &amp; Notes</div>'
                        . '<div style="font-size: 10pt; color: #1e293b; margin-top: 2pt; white-space: pre-line;">' . $esc($quotation->notes) . '</div>'
                    . '</td>'
                . '</tr>'
              . '</table>'
            : '';

        $quotationNo = 'Q-' . str_pad((string) $quotation->id, 5, '0', STR_PAD_LEFT) . ' v' . $quotation->version;

        $bodyHtml = <<<HTML
        <!-- Document title block -->
        <table width="100%" cellspacing="0" cellpadding="0" style="margin-bottom: 10pt; border-collapse: collapse;">
            <tr>
                <td width="4pt" style="background: #1e40af;"></td>
                <td style="padding: 6pt 10pt;">
                    <div style="font-size: 14pt; color: #1e40af; font-weight: bold; letter-spacing: 0.4pt;">QUOTATION</div>
                    <div style="font-size: 9pt; color: #64748b; margin-top: 1pt;">{$quotationNo} &middot; {$customer}</div>
                </td>
            </tr>
        </table>

        <!-- Meta grid -->
        <table width="100%" cellspacing="0" cellpadding="8" style="border: 1pt solid #94a3b8; border-collapse: collapse; margin-bottom: 12pt; background: #f8fafc;">
            <tr>
                <td width="22%" style="border-right: 1pt solid #cbd5e1; vertical-align: top;">
                    <div style="color: #6b7280; text-transform: uppercase; font-size: 7pt; letter-spacing: 0.5pt; font-weight: bold;">Customer</div>
                    <div style="color: #0f172a; font-weight: bold; font-size: 10pt; margin-top: 2pt;">{$customer}</div>
                </td>
                <td width="20%" style="border-right: 1pt solid #cbd5e1; vertical-align: top;">
                    <div style="color: #6b7280; text-transform: uppercase; font-size: 7pt; letter-spacing: 0.5pt; font-weight: bold;">Customer PO</div>
                    <div style="color: #0f172a; font-weight: bold; font-size: 10pt; margin-top: 2pt;">{$customerPO}</div>
                </td>
                <td width="18%" style="border-right: 1pt solid #cbd5e1; vertical-align: top;">
                    <div style="color: #6b7280; text-transform: uppercase; font-size: 7pt; letter-spacing: 0.5pt; font-weight: bold;">Valid For</div>
                    <div style="color: #0f172a; font-weight: bold; font-size: 10pt; margin-top: 2pt;">{$quotation->validity_days} days</div>
                </td>
                <td width="20%" style="border-right: 1pt solid #cbd5e1; vertical-align: top;">
                    <div style="color: #6b7280; text-transform: uppercase; font-size: 7pt; letter-spacing: 0.5pt; font-weight: bold;">Status</div>
                    <div style="color: {$statusColor}; font-weight: bold; font-size: 10pt; margin-top: 2pt;">{$statusLabel}</div>
                </td>
                <td width="20%" style="vertical-align: top;">
                    <div style="color: #6b7280; text-transform: uppercase; font-size: 7pt; letter-spacing: 0.5pt; font-weight: bold;">Issued</div>
                    <div style="color: #0f172a; font-weight: bold; font-size: 10pt; margin-top: 2pt;">{$createdAt}</div>
                    <div style="font-size: 8pt; color: #6b7280; margin-top: 1pt;">by {$createdByName}</div>
                </td>
            </tr>
        </table>

        <!-- Section heading -->
        <div style="margin-bottom: 4pt;">
            <span style="display: inline-block; padding: 3pt 8pt; background: #1e40af; color: white; font-size: 9pt; font-weight: bold; letter-spacing: 0.3pt;">LINE ITEMS</span>
        </div>

        {$itemsHtml}

        <!-- Totals card right-aligned -->
        <table width="100%" cellspacing="0" cellpadding="0" style="margin-top: 4pt; border-collapse: collapse;">
            <tr><td>{$totalsHtml}<div style="clear: both;"></div></td></tr>
        </table>

        <div style="clear: both;"></div>

        {$notesHtml}

        <!-- Signature lines -->
        <table width="100%" cellspacing="0" cellpadding="0" style="margin-top: 40pt; border-collapse: collapse;">
            <tr>
                <td width="33%" style="padding: 0 8pt;">
                    <div style="border-top: 1pt solid #1f2937; padding-top: 4pt; text-align: center; font-size: 8pt; color: #4b5563;">Prepared By</div>
                </td>
                <td width="34%" style="padding: 0 8pt;">
                    <div style="border-top: 1pt solid #1f2937; padding-top: 4pt; text-align: center; font-size: 8pt; color: #4b5563;">Approved By</div>
                </td>
                <td width="33%" style="padding: 0 8pt;">
                    <div style="border-top: 1pt solid #1f2937; padding-top: 4pt; text-align: center; font-size: 8pt; color: #4b5563;">Customer Acknowledgement</div>
                </td>
            </tr>
        </table>

        <div style="margin-top: 16pt; padding-top: 6pt; border-top: 0.5pt solid #e5e7eb; text-align: right; font-size: 7pt; color: #9ca3af; font-style: italic;">Generated by BITAC PMS &middot; {$date}</div>
HTML;

        $bytes    = app(\App\Services\BitacLetterhead::class)->render($bodyHtml, "Quotation {$quotationNo}");
        $filename = 'Quotation-Q' . str_pad((string) $quotation->id, 5, '0', STR_PAD_LEFT) . '-v' . $quotation->version . '.pdf';

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

    public function sendToCustomer(Quotation $quotation)
    {
        abort_unless(in_array($quotation->status, ['approved']), 422, 'Only approved quotations can be sent to customer.');

        $quotation->update([
            'status'              => 'sent_to_customer',
            'sent_to_customer_at' => now(),
        ]);

        app(\App\Services\RevisionTracker::class)->trackQuotation($quotation->fresh(), 'sent_to_customer');

        return back()->with('success', 'Quotation marked as sent to customer.');
    }

    /**
     * Record customer's response: accepted, rejected, or revision_requested.
     */
    public function recordCustomerResponse(Request $request, Quotation $quotation)
    {
        abort_unless(in_array($quotation->status, ['sent_to_customer', 'revision_requested']), 422,
            'Quotation must be sent to customer first.');

        $validated = $request->validate([
            'response_type'   => 'required|in:accepted,rejected,revision_requested',
            'customer_po_no'  => 'nullable|string|max:100',
            'feedback'        => 'nullable|string|max:2000',
            'response_date'   => 'required|date',
            'attachment'      => 'nullable|file|mimes:pdf,jpg,jpeg,png|max:5120',
        ]);

        $attachmentPath = null;
        if ($request->hasFile('attachment')) {
            $attachmentPath = $request->file('attachment')->store('customer-responses', 'public');
        }

        \App\Models\CustomerResponse::create([
            'quotation_id'    => $quotation->id,
            'response_type'   => $validated['response_type'],
            'customer_po_no'  => $validated['customer_po_no'] ?? null,
            'feedback'        => $validated['feedback'] ?? null,
            'response_date'   => $validated['response_date'],
            'attachment_path' => $attachmentPath,
            'recorded_by'     => auth()->id(),
        ]);

        // Update quotation status based on response type
        $newStatus = match ($validated['response_type']) {
            'accepted'           => 'customer_accepted',
            'rejected'           => 'customer_rejected',
            'revision_requested' => 'revision_requested',
        };

        $update = [
            'status'                 => $newStatus,
            'customer_responded_at'  => now(),
        ];
        if ($validated['response_type'] === 'accepted') {
            $update['customer_po_no'] = $validated['customer_po_no'] ?? null;
        }

        $quotation->update($update);

        // Notify the IED creator
        NotifyService::send(
            $quotation->created_by,
            'customer_response_' . $validated['response_type'],
            'Customer Response Recorded',
            "Quotation #{$quotation->id} v{$quotation->version}: " . str_replace('_', ' ', $validated['response_type']),
            "/quotations/{$quotation->id}",
            $validated['response_type'] === 'accepted' ? 'fi-rr-check-circle' : 'fi-rr-comment',
            $validated['response_type'] === 'accepted' ? 'green' :
            ($validated['response_type'] === 'rejected' ? 'red' : 'amber'),
        );

        $trackerEvent = match ($validated['response_type']) {
            'accepted' => 'customer_accepted',
            'rejected' => 'customer_rejected',
            default    => 'other',
        };
        app(\App\Services\RevisionTracker::class)->trackQuotation(
            $quotation->fresh(),
            $trackerEvent,
            $validated['feedback'] ?? null
        );

        return back()->with('success', 'Customer response recorded.');
    }

    /**
     * Create a new revision of a quotation (after customer requested changes).
     */
    public function createRevision(Quotation $quotation)
    {
        abort_unless($quotation->status === 'revision_requested', 422,
            'Only quotations with a revision request can be revised.');

        $newQuotation = Quotation::create([
            'rfq_id'              => $quotation->rfq_id,
            'customer_id'         => $quotation->customer_id,
            'parent_quotation_id' => $quotation->id,
            'version'             => $this->quotationService->getNextVersion($quotation->rfq_id),
            'material_cost'       => $quotation->material_cost,
            'labour_cost'         => $quotation->labour_cost,
            'overhead_cost'       => $quotation->overhead_cost,
            'profit_margin'       => $quotation->profit_margin,
            'discount'            => $quotation->discount,
            'vat_rate'            => $quotation->vat_rate,
            'vat_amount'          => $quotation->vat_amount,
            'total_amount'        => $quotation->total_amount,
            'validity_days'       => $quotation->validity_days,
            'notes'               => $quotation->notes,
            'status'              => 'draft',
            'created_by'          => auth()->id(),
        ]);

        // Mark the parent as superseded
        $quotation->update(['status' => 'superseded']);

        return redirect()->route('quotations.edit', $newQuotation)
            ->with('success', "Revision v{$newQuotation->version} created. Edit and submit for approval.");
    }

    public function convertToWorkOrder(Request $request, Quotation $quotation)
    {
        abort_unless(in_array($quotation->status, ['approved', 'sent_to_customer', 'customer_accepted']), 422,
            'Only approved or customer-accepted quotations can be converted.');

        $quotation->load('rfq.items.product');
        $rfq       = $quotation->rfq;
        $firstItem = $rfq?->items->first();
        $woNumber  = $this->workOrderService->generateWoNumber();
        $jobNumber = \App\Services\JobNumberService::next();

        $workOrder = \App\Models\WorkOrder::create([
            'quotation_id'    => $quotation->id,
            'customer_id'     => $quotation->customer_id,
            'product_id'      => $firstItem?->product_id,
            'bom_id'          => $firstItem?->product?->activeBom?->id,
            'wo_number'       => $woNumber,
            'job_number'      => $jobNumber,
            'quantity'        => $rfq?->items->sum('quantity') ?? 1,
            'status'          => 'pcd_pending',
            'priority'        => $request->input('priority', 'normal'),
            'due_date'        => $request->input('due_date'),
            'notes'           => $request->input('notes'),
            'customer_po_no'  => $request->input('customer_po_no') ?? $quotation->customer_po_no,
            'created_by'      => auth()->id(),
            'pcd_handoff_at'  => now(),
            'pcd_handoff_by'  => auth()->id(),
        ]);

        $quotation->update(['status' => 'converted']);

        // Notify relevant users about new Work Order
        NotifyService::toPermission(
            'view work-orders',
            'work_order_created',
            'New Work Order',
            "WO {$woNumber} created from Quotation #{$quotation->id}",
            "/work-orders/{$workOrder->id}",
            'fi-rr-tools',
            'brand',
        );

        return redirect()->route('work-orders.show', $workOrder)->with('success', "Work Order {$woNumber} created.");
    }

    // ─── Export: Excel ────────────────────────────────────────────────
    public function exportExcel(Request $request)
    {
        $rows = $this->buildExportQuery($request)->get()->map(fn($q) => [
            'ID'            => $q->id,
            'RFQ'           => $q->rfq_id ? "RFQ #{$q->rfq_id}" : '—',
            'Customer'      => $q->customer?->name ?? '—',
            'Product'       => $q->rfq?->items->first()?->job_description ?? $q->rfq?->items->first()?->product?->name ?? '—',
            'Material Cost' => round((float) $q->material_cost, 2),
            'Labour Cost'   => round((float) $q->labour_cost, 2),
            'Overhead Cost' => round((float) $q->overhead_cost, 2),
            'Profit %'      => $q->profit_margin,
            'Discount'      => round((float) $q->discount, 2),
            'VAT Rate'      => $q->vat_rate,
            'VAT Amount'    => round((float) $q->vat_amount, 2),
            'Total Amount'  => round((float) $q->total_amount, 2),
            'Version'       => "v{$q->version}",
            'Status'        => ucfirst(str_replace('_', ' ', $q->status)),
            'Customer PO'   => $q->customer_po_no ?? '—',
            'Created By'    => $q->createdBy?->name ?? '—',
            'Created At'    => $q->created_at->format('d M Y'),
        ])->toArray();

        $headers = array_keys($rows[0] ?? []);
        $export = new class($headers, $rows) implements \Maatwebsite\Excel\Concerns\FromArray, \Maatwebsite\Excel\Concerns\WithHeadings, \Maatwebsite\Excel\Concerns\WithStyles {
            public function __construct(private array $h, private array $r) {}
            public function headings(): array { return $this->h; }
            public function array(): array { return array_map('array_values', $this->r); }
            public function styles(\PhpOffice\PhpSpreadsheet\Worksheet\Worksheet $s): array {
                return [1 => ['font' => ['bold' => true, 'color' => ['argb' => 'FFFFFFFF']],
                    'fill' => ['fillType' => \PhpOffice\PhpSpreadsheet\Style\Fill::FILL_SOLID, 'startColor' => ['argb' => 'FF1E40AF']]]];
            }
        };
        return \Maatwebsite\Excel\Facades\Excel::download($export, 'quotations-' . now()->format('Y-m-d') . '.xlsx');
    }

    // ─── Export: PDF ──────────────────────────────────────────────────
    public function exportPdf(Request $request)
    {
        $quotations = $this->buildExportQuery($request)->get();

        $tableHtml = '<table style="width:100%;border-collapse:collapse;font-size:10px;">';
        $tableHtml .= '<thead><tr>';
        foreach (['#', 'Customer', 'Product', 'Total (৳)', 'Ver', 'Status', 'Created'] as $h) {
            $tableHtml .= "<th style='padding:7px 8px;background:#1e40af;color:white;text-align:left;font-size:9px;text-transform:uppercase;'>{$h}</th>";
        }
        $tableHtml .= '</tr></thead><tbody>';
        foreach ($quotations as $i => $q) {
            $bg = $i % 2 === 0 ? '#fff' : '#f8fafc';
            $product = $q->rfq?->items->first()?->job_description ?? $q->rfq?->items->first()?->product?->name ?? '—';
            $tableHtml .= "<tr style='background:{$bg};'>";
            $tableHtml .= "<td style='padding:5px 8px;border-bottom:1px solid #e2e8f0;font-weight:bold;'>{$q->id}</td>";
            $tableHtml .= "<td style='padding:5px 8px;border-bottom:1px solid #e2e8f0;'>" . ($q->customer?->name ?? '—') . "</td>";
            $tableHtml .= "<td style='padding:5px 8px;border-bottom:1px solid #e2e8f0;'>{$product}</td>";
            $tableHtml .= "<td style='padding:5px 8px;border-bottom:1px solid #e2e8f0;text-align:right;font-family:monospace;font-weight:bold;'>" . number_format((float) $q->total_amount, 2) . "</td>";
            $tableHtml .= "<td style='padding:5px 8px;border-bottom:1px solid #e2e8f0;'>v{$q->version}</td>";
            $tableHtml .= "<td style='padding:5px 8px;border-bottom:1px solid #e2e8f0;'>" . ucfirst(str_replace('_', ' ', $q->status)) . "</td>";
            $tableHtml .= "<td style='padding:5px 8px;border-bottom:1px solid #e2e8f0;'>" . $q->created_at->format('d M Y') . "</td>";
            $tableHtml .= '</tr>';
        }
        $tableHtml .= '</tbody></table>';

        $totalAmt = number_format($quotations->sum(fn($q) => (float) $q->total_amount), 2);
        $date = now()->format('d M Y, H:i');
        $summary = "<div style='margin-bottom:14px;padding:10px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;font-size:12px;'>"
            . "<strong>Total Quotations:</strong> {$quotations->count()} | <strong>Total Value:</strong> ৳{$totalAmt}</div>";

        $html = "<!DOCTYPE html><html><head><meta charset='utf-8'><style>"
            . "body{font-family:'DejaVu Sans',sans-serif;font-size:11px;color:#334155;margin:30px;}"
            . "h1{font-size:20px;color:#1e40af;margin-bottom:4px;}"
            . ".meta{font-size:9px;color:#94a3b8;margin-bottom:14px;}"
            . ".footer{margin-top:20px;text-align:center;font-size:8px;color:#94a3b8;}"
            . "</style></head><body>"
            . "<h1>Quotations Report</h1><div class='meta'>Generated: {$date} · BITAC PMS</div>"
            . $summary . $tableHtml
            . "<div class='footer'>Generated by BITAC PMS · {$date}</div></body></html>";

        return Pdf::loadHTML($html)->setPaper('a4', 'landscape')->download('quotations-' . now()->format('Y-m-d') . '.pdf');
    }

    private function buildExportQuery(Request $request)
    {
        $query = Quotation::with(['rfq.items.product', 'customer', 'createdBy']);
        if ($search = $request->input('search')) {
            $query->where(function ($q) use ($search) {
                $q->where('id', 'like', "%{$search}%")
                  ->orWhere('customer_po_no', 'like', "%{$search}%")
                  ->orWhereHas('customer', fn($c) => $c->where('name', 'like', "%{$search}%"));
            });
        }
        if ($status = $request->input('status')) $query->where('status', $status);
        if ($cid = $request->input('customer_id')) $query->where('customer_id', $cid);
        return $query->latest()->limit(500);
    }
}
