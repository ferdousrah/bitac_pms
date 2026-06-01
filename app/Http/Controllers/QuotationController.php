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
        $query = Quotation::with(['rfq.items.product', 'customer', 'createdBy', 'jobCategory']);

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
                'job_type'     => $q->rfq?->job_type ?? 'regular',
                'job_category' => $q->jobCategory?->name,
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
        // and pre-fill the unit price (VAT-INCLUSIVE) so it matches the estimate's per-unit total.
        $items = $rfq ? $rfq->items->map(function ($i) {
            $estimate = $i->costEstimates
                ->where('status', '!=', 'draft')
                ->sortByDesc('id')
                ->first() ?? $i->costEstimates->sortByDesc('id')->first();

            // BITAC quotations follow the convention: Unit Price is INCLUDING VAT & TAX
            // (no separate VAT row — see sample re-quotation 36.06.2692.028.51.028(2).26.92).
            // The cost estimate stores `total` as the per-unit VAT-inclusive price
            // (net + overhead + vat, times multiplier). We use that directly.
            $unitPrice = $estimate ? round((float) $estimate->total, 2) : null;

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

        // Pre-fill the recipient block from the customer's stored address (the customer
        // model holds contact_person/address — IED preparer can edit before sending).
        $defaultRecipient = '';
        if ($rfq && $rfq->customer) {
            $c = $rfq->customer;
            $lines = array_filter([
                $c->contact_person,
                $c->name,
                $c->address,
            ]);
            $defaultRecipient = implode("\n", $lines);
        }

        // Default Terms & Conditions — matches the standard BITAC IED Dhaka template
        // (translation of দরপত্রের শর্ত সমূহ from the official sample). IED preparer
        // can edit, add, remove, or reorder per quotation.
        $defaultTerms = [
            'এই দরপত্র ইস্যুর তারিখ হতে ০৩ মাস পর্যন্ত কার্যাদেশ প্রদানের জন্য বহাল থাকবে।',
            'কার্যাদেশ প্রাপ্তির সময় হতে ১৫ দিনের মধ্যে কার্য সম্পন্ন করা হবে।',
            'বিদ্যুৎ বিভ্রাট, হরতাল, জাতীয় দুর্যোগ ও কাঁচামালের দুষ্প্রাপ্যতার কারণে সরবরাহের তারিখ পরিবর্তন হতে পারে।',
            'ই.এফ.টি, চেক, ব্যাংক ড্রাফট, পে-অর্ডার ইত্যাদি বিটাক, ঢাকা এর অনুকূলে সোনালী ব্যাংকের অ্যাকাউন্ট (০১২৪১০০০০০৬৬৭), তেজগাঁও শি/এ, ঢাকা বরাবর অথবা ক্যাশে প্রদান করতে হবে।',
            'কার্যাদেশ প্রদানকারী কর্তৃক মালামাল সরবরাহ নিতে হবে।',
        ];

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
            'defaultRecipient'      => $defaultRecipient,
            'defaultTerms'          => $defaultTerms,
            // Pre-fill the customer reference + date from the source RFQ — the IED
            // preparer can override either field on the quotation form if needed.
            'defaultCustomerRefNo'   => $rfq?->customer_ref_no ?? '',
            'defaultCustomerRefDate' => $rfq?->created_at?->format('Y-m-d') ?? '',
        ]);
    }

    /**
     * Edit screen for a draft quotation. Pre-fills the form with the
     * existing quotation's data so the preparer can correct it and resubmit.
     * Only draft-status quotations are editable (in_progress approvals would
     * otherwise see inconsistent data mid-stream).
     */
    public function edit(Quotation $quotation)
    {
        abort_unless(in_array($quotation->status, ['draft']), 422,
            'Only draft quotations can be edited.');

        $quotation->load(['rfq.customer', 'rfq.items.product', 'items']);

        // Same default terms as create() — used only if the quotation has none yet.
        $defaultTerms = [
            'এই দরপত্র ইস্যুর তারিখ হতে ০৩ মাস পর্যন্ত কার্যাদেশ প্রদানের জন্য বহাল থাকবে।',
            'কার্যাদেশ প্রাপ্তির সময় হতে ১৫ দিনের মধ্যে কার্য সম্পন্ন করা হবে।',
            'বিদ্যুৎ বিভ্রাট, হরতাল, জাতীয় দুর্যোগ ও কাঁচামালের দুষ্প্রাপ্যতার কারণে সরবরাহের তারিখ পরিবর্তন হতে পারে।',
            'ই.এফ.টি, চেক, ব্যাংক ড্রাফট, পে-অর্ডার ইত্যাদি বিটাক, ঢাকা এর অনুকূলে সোনালী ব্যাংকের অ্যাকাউন্ট (০১২৪১০০০০০৬৬৭), তেজগাঁও শি/এ, ঢাকা বরাবর অথবা ক্যাশে প্রদান করতে হবে।',
            'কার্যাদেশ প্রদানকারী কর্তৃক মালামাল সরবরাহ নিতে হবে।',
        ];

        $rfq = $quotation->rfq;

        return Inertia::render('Quotation/Create', [
            'rfq' => $rfq ? [
                'id'          => $rfq->id,
                'customer_id' => $rfq->customer_id,
                'customer'    => ['name' => $rfq->customer?->name ?? ''],
                'items'       => $quotation->items->map(fn($i) => [
                    'rfq_item_id' => null,
                    'description' => $i->description,
                    'quantity'    => (float) $i->quantity,
                    'unit'        => 'pcs', // quotation_items has no unit column; default
                    'unit_price'  => (float) $i->unit_price,
                    'estimate_no' => null,
                ])->values(),
            ] : null,
            // The "existing" prop tells the form to switch to EDIT mode.
            'existing' => [
                'id'                => $quotation->id,
                'version'           => $quotation->version,
                'vat_rate'          => (float) $quotation->vat_rate,
                'notes'             => $quotation->notes,
                'memo_no'           => $quotation->memo_no,
                'customer_ref_no'   => $quotation->customer_ref_no,
                'customer_ref_date' => $quotation->customer_ref_date?->format('Y-m-d'),
                'recipient_block'   => $quotation->recipient_block,
                'terms'             => $quotation->terms ?? [],
            ],
            'customers'             => Customer::where('is_active', true)->get(['id', 'name']),
            'vatRate'               => (float) $quotation->vat_rate,
            'defaultRecipient'      => $quotation->recipient_block ?? '',
            'defaultTerms'          => !empty($quotation->terms) ? $quotation->terms : $defaultTerms,
            'defaultCustomerRefNo'  => $quotation->customer_ref_no ?? '',
            'defaultCustomerRefDate'=> $quotation->customer_ref_date?->format('Y-m-d') ?? '',
        ]);
    }

    /**
     * Persist edits to a draft quotation. Same validation rules as store(),
     * but updates an existing row instead of creating a new one. Line items
     * are replaced wholesale (simpler than diffing) since drafts are cheap.
     */
    public function update(Request $request, Quotation $quotation)
    {
        abort_unless($quotation->status === 'draft', 422,
            'Only draft quotations can be edited.');

        $validated = $request->validate([
            'vat_rate'                => 'required|numeric|min:0|max:100',
            'validity_days'           => 'nullable|integer|min:1',
            'notes'                   => 'nullable|string',
            'items'                   => 'required|array|min:1',
            'items.*.description'     => 'required|string|max:255',
            'items.*.quantity'        => 'required|numeric|min:0',
            'items.*.unit_price'      => 'required|numeric|min:0',
            'memo_no'                 => 'nullable|string|max:80',
            'customer_ref_no'         => 'nullable|string|max:100',
            'customer_ref_date'       => 'nullable|date',
            'recipient_block'         => 'nullable|string|max:1000',
            'terms'                   => 'nullable|array',
            'terms.*'                 => 'nullable|string|max:500',
            'attachments'             => 'nullable|array',
            'attachments.*'           => 'file|max:20480', // 20 MB each
            'attachment_kinds'        => 'nullable|array',
            'attachment_kinds.*'      => 'nullable|in:supporting,annexure,spec,other',
        ]);

        // Recompute totals — gross is what the line items add up to, embedded VAT extracted.
        $grossTotal = 0.0;
        foreach ($validated['items'] as $item) {
            $grossTotal += ((float) $item['quantity']) * ((float) $item['unit_price']);
        }
        $vatRate   = (float) $validated['vat_rate'];
        $vatAmount = $vatRate > 0 ? round($grossTotal * $vatRate / (100 + $vatRate), 2) : 0.0;
        $total     = round($grossTotal, 2);
        $subtotal  = round($grossTotal - $vatAmount, 2);

        $cleanTerms = collect($validated['terms'] ?? [])
            ->map(fn($t) => trim((string) $t))
            ->filter(fn($t) => $t !== '')
            ->values()
            ->all();

        \DB::transaction(function () use ($quotation, $validated, $subtotal, $vatRate, $vatAmount, $total, $cleanTerms) {
            $quotation->update([
                'material_cost'     => $subtotal,
                'vat_rate'          => $vatRate,
                'vat_amount'        => $vatAmount,
                'total_amount'      => $total,
                'validity_days'     => $validated['validity_days'] ?? $quotation->validity_days ?? 90,
                'notes'             => $validated['notes'] ?? null,
                'memo_no'           => $validated['memo_no'] ?? null,
                'customer_ref_no'   => $validated['customer_ref_no'] ?? null,
                'customer_ref_date' => $validated['customer_ref_date'] ?? null,
                'recipient_block'   => $validated['recipient_block'] ?? null,
                'terms'             => !empty($cleanTerms) ? $cleanTerms : null,
            ]);

            // Replace line items wholesale — drafts are throwaway, and diffing
            // by index/description is error-prone if the preparer reorders rows.
            $quotation->items()->delete();
            foreach ($validated['items'] as $item) {
                $quotation->items()->create([
                    'description' => $item['description'],
                    'quantity'    => $item['quantity'],
                    'unit_price'  => $item['unit_price'],
                    'amount'      => round(((float) $item['quantity']) * ((float) $item['unit_price']), 2),
                ]);
            }
        });

        // Newly uploaded attachments — appended to existing files (we don't wipe
        // previous attachments on edit; preparer can delete individually if needed).
        $uploadedFiles = $request->file('attachments') ?? [];
        $kinds = $request->input('attachment_kinds') ?? [];
        if (!is_array($uploadedFiles)) $uploadedFiles = [$uploadedFiles];
        $existingCount = $quotation->files()->count();
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
                'sort_order'    => $existingCount + $idx,
            ]);
        }

        app(\App\Services\RevisionTracker::class)->trackQuotation(
            $quotation->fresh(),
            'edited'
        );

        return redirect()->route('quotations.show', $quotation)
            ->with('success', 'Draft updated. Submit for approval when ready.');
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'rfq_id'                  => 'required|exists:rfqs,id',
            'vat_rate'                => 'required|numeric|min:0|max:100',
            'tax_rate'                => 'nullable|numeric|min:0|max:100',
            'validity_days'           => 'nullable|integer|min:1',
            'notes'                   => 'nullable|string',
            'items'                   => 'required|array|min:1',
            'items.*.description'     => 'required|string|max:255',
            'items.*.quantity'        => 'required|numeric|min:0',
            'items.*.unit_price'      => 'required|numeric|min:0',
            'attachments'             => 'nullable|array',
            'attachments.*'           => 'file|max:20480', // 20 MB each
            'attachment_kinds'        => 'nullable|array',
            'attachment_kinds.*'      => 'nullable|in:supporting,annexure,spec,other',
            // BITAC letter header fields
            'memo_no'                 => 'nullable|string|max:80',
            'customer_ref_no'         => 'nullable|string|max:100',
            'customer_ref_date'       => 'nullable|date',
            'recipient_block'         => 'nullable|string|max:1000',
            'terms'                   => 'nullable|array',
            'terms.*'                 => 'nullable|string|max:500',
        ]);

        $rfq = Rfq::findOrFail($validated['rfq_id']);

        // BITAC quotations: Unit Price is VAT-INCLUSIVE. The line total IS the grand total
        // (no separate VAT row on the quote). We still record vat_rate + the EMBEDDED VAT
        // portion for audit/PDF/reporting purposes.
        $grossTotal = 0.0;
        foreach ($validated['items'] as $item) {
            $grossTotal += ((float) $item['quantity']) * ((float) $item['unit_price']);
        }
        $vatRate   = (float) $validated['vat_rate'];
        // Embedded VAT extraction: gross × rate / (100 + rate)
        $vatAmount = $vatRate > 0
            ? round($grossTotal * $vatRate / (100 + $vatRate), 2)
            : 0.0;
        // Tax (AIT etc.) — applied on the PRE-VAT subtotal and ADDED on top of gross.
        $taxRate   = (float) ($validated['tax_rate'] ?? 0);
        $subtotal  = round($grossTotal - $vatAmount, 2);
        $taxAmount = $taxRate > 0 ? round($subtotal * $taxRate / 100, 2) : 0.0;
        $total     = round($grossTotal + $taxAmount, 2);

        $saveAsDraft = $request->boolean('save_as_draft');

        // Strip blank terms but preserve order; if all empty, store null.
        $cleanTerms = collect($validated['terms'] ?? [])
            ->map(fn($t) => trim((string) $t))
            ->filter(fn($t) => $t !== '')
            ->values()
            ->all();

        $quotation = Quotation::create([
            'rfq_id'         => $validated['rfq_id'],
            'customer_id'    => $rfq->customer_id,
            'job_category_id'=> $rfq->job_category_id,
            'version'        => $this->quotationService->getNextVersion($rfq->id),
            'material_cost'  => $subtotal,  // legacy column — pre-VAT portion (computed by extracting embedded VAT from gross)
            'labour_cost'    => 0,
            'overhead_cost'  => 0,
            'profit_margin'  => 0,
            'discount'       => 0,
            'vat_rate'       => $vatRate,
            'vat_amount'     => $vatAmount,
            'tax_rate'       => $taxRate,
            'tax_amount'     => $taxAmount,
            'total_amount'   => $total,
            'validity_days'  => $validated['validity_days'] ?? 90,
            'notes'          => $validated['notes'] ?? null,
            'status'         => $saveAsDraft ? 'draft' : 'pending_approval',
            'created_by'    => auth()->id(),
            // BITAC letter header
            'memo_no'           => $validated['memo_no'] ?? null,
            'customer_ref_no'   => $validated['customer_ref_no'] ?? null,
            'customer_ref_date' => $validated['customer_ref_date'] ?? null,
            'recipient_block'   => $validated['recipient_block'] ?? null,
            'terms'             => !empty($cleanTerms) ? $cleanTerms : null,
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
                'job_type'        => $quotation->rfq?->job_type ?? 'regular',
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
                // BITAC letter header fields
                'memo_no'           => $quotation->memo_no,
                'customer_ref_no'   => $quotation->customer_ref_no,
                'customer_ref_date' => $quotation->customer_ref_date?->format('d/m/Y'),
                'recipient_block'   => $quotation->recipient_block,
                'terms'             => $quotation->terms ?? [],
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
            'canRequestChanges'  => $pendingApproval && $user->can('reject quotations'),
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

        // Persist the inline-drawn signature if one was provided. If not, leave
        // signature_path null and let the PDF generator fall back to the user's
        // saved signature_path. The approval row's id is the key, so update is
        // needed AFTER the first update() (so $approval->id is available).
        $sigPath = $this->persistApprovalSignature($approval, $request->input('signature'));
        if ($sigPath) $approval->update(['signature_path' => $sigPath]);

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

    /**
     * Approver requests changes from the preparer.
     *
     * Each change request produces a NEW version (v+1) — full audit trail.
     *   v1 (current) → status='superseded', approval row tagged "[Changes Requested]"
     *   v2 (new)     → status='draft', all fields + line items copied from v1,
     *                  parent_quotation_id = v1.id
     *
     * Preparer is redirected to the v2 edit screen to make corrections.
     */
    public function requestChanges(Request $request, Quotation $quotation)
    {
        $request->validate(['remarks' => 'required|string|max:1000']);

        $approval = $quotation->approvals()
            ->where('approver_id', auth()->id())
            ->where('status', 'pending')
            ->first();

        if (!$approval) {
            return back()->with('error', 'No pending approval found for you on this quotation. It may have already been actioned.');
        }

        $remark = $request->input('remarks');

        $signatureDataUrl = $request->input('signature');

        $newQuotation = \DB::transaction(function () use ($quotation, $approval, $remark, $signatureDataUrl) {
            // 1. Stamp the approver's decision on the current (old) approval row.
            $approval->update([
                'status'      => 'rejected', // DB-level status; UI re-labels via tag prefix
                'remarks'     => '[Changes Requested] ' . $remark,
                'approved_at' => now(),
            ]);

            // Capture the inline-drawn signature on this approval row (if any).
            $sigPath = $this->persistApprovalSignature($approval, $signatureDataUrl);
            if ($sigPath) $approval->update(['signature_path' => $sigPath]);

            // 2. Wipe remaining pending levels on the OLD version — they no longer apply.
            $quotation->approvals()->where('status', 'pending')->delete();

            // 3. Freeze the old version.
            $quotation->update(['status' => 'superseded']);

            // 4. Create the next revision as a fresh draft with all fields copied.
            $new = Quotation::create([
                'center_id'           => $quotation->center_id,
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
                'created_by'          => $quotation->created_by, // keeps it with the original preparer
                // BITAC letter header — copied so the preparer doesn't have to retype.
                'memo_no'             => $quotation->memo_no,
                'customer_ref_no'     => $quotation->customer_ref_no,
                'customer_ref_date'   => $quotation->customer_ref_date,
                'recipient_block'     => $quotation->recipient_block,
                'terms'               => $quotation->terms,
            ]);

            // 5. Clone line items.
            foreach ($quotation->items as $li) {
                $new->items()->create([
                    'description' => $li->description,
                    'quantity'    => $li->quantity,
                    'unit_price'  => $li->unit_price,
                    'amount'      => $li->amount,
                ]);
            }

            return $new;
        });

        app(\App\Services\RevisionTracker::class)->trackQuotation(
            $quotation->fresh(),
            'changes_requested',
            $remark
        );
        app(\App\Services\RevisionTracker::class)->trackQuotation(
            $newQuotation->fresh(),
            'created',
            'Auto-created from change request on v' . $quotation->version
        );

        // Notify the preparer that corrections are needed and link them to the NEW version.
        NotifyService::send(
            $quotation->created_by,
            'quotation_changes_requested',
            'Changes Requested — Revision Created',
            auth()->user()->name . " requested changes on Quotation #{$quotation->id} v{$quotation->version}.\n\"{$remark}\"\n\nA new revision (v{$newQuotation->version}) was auto-created — edit and resubmit.",
            "/quotations/{$newQuotation->id}",
            'fi-rr-edit',
            'amber'
        );

        return redirect()->route('quotations.show', $newQuotation)
            ->with('success', "Changes requested. Revision v{$newQuotation->version} created — review and resubmit for approval.");
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

        // Capture an inline-drawn signature on the reject decision, if any.
        $sigPath = $this->persistApprovalSignature($approval, $request->input('signature'));
        if ($sigPath) $approval->update(['signature_path' => $sigPath]);

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

    /**
     * Decode an inline signature data URL ("data:image/png;base64,...") and
     * persist it to the public disk at signatures/approvals/{approval_id}-{ts}.png.
     * Returns the stored path (relative to the disk) or null on no/invalid input.
     */
    private function persistApprovalSignature($approval, ?string $dataUrl): ?string
    {
        if (!$dataUrl || !str_starts_with($dataUrl, 'data:image/')) return null;

        // Strip "data:image/png;base64," header
        $parts = explode(',', $dataUrl, 2);
        if (count($parts) !== 2) return null;
        $binary = base64_decode($parts[1], true);
        if ($binary === false) return null;

        $filename = 'signatures/approvals/' . $approval->id . '-' . time() . '.png';
        \Storage::disk('public')->put($filename, $binary);
        return $filename;
    }

    /**
     * Convert a BDT amount to words in the Indian/Bangladeshi numbering system
     * (Lac/Crore). Returns e.g. "Twenty Three Lac Fifty One Thousand Nine Hundred
     * Eighty Nine Taka and Twenty Paisa Only". Matches BITAC's "মোট টাকাঃ" line.
     */
    private function amountInWords(float $amount): string
    {
        $ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
                 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen',
                 'Seventeen', 'Eighteen', 'Nineteen'];
        $tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

        $twoDigit = function (int $n) use ($ones, $tens): string {
            if ($n < 20) return $ones[$n];
            $t = intdiv($n, 10);
            $o = $n % 10;
            return trim($tens[$t] . ($o ? ' ' . $ones[$o] : ''));
        };

        $threeDigit = function (int $n) use ($ones, $twoDigit): string {
            $parts = [];
            if ($n >= 100) {
                $parts[] = $ones[intdiv($n, 100)] . ' Hundred';
                $n %= 100;
            }
            if ($n > 0) $parts[] = $twoDigit($n);
            return implode(' ', $parts);
        };

        $taka  = (int) floor($amount);
        $paisa = (int) round(($amount - $taka) * 100);

        if ($taka === 0) {
            $takaWords = 'Zero';
        } else {
            // Indian system: ... crore | lac | thousand | hundred|tens|ones
            $crore = intdiv($taka, 10000000);   $taka %= 10000000;
            $lac   = intdiv($taka, 100000);     $taka %= 100000;
            $thou  = intdiv($taka, 1000);       $taka %= 1000;
            $rest  = $taka;

            $parts = [];
            if ($crore) $parts[] = $threeDigit($crore) . ' Crore';
            if ($lac)   $parts[] = $threeDigit($lac)   . ' Lac';
            if ($thou)  $parts[] = $threeDigit($thou)  . ' Thousand';
            if ($rest)  $parts[] = $threeDigit($rest);
            $takaWords = implode(' ', $parts);
        }

        $result = $takaWords . ' Taka';
        if ($paisa > 0) {
            $result .= ' and ' . $twoDigit($paisa) . ' Paisa';
        }
        return $result . ' Only';
    }

    public function pdf(Request $request, Quotation $quotation)
    {
        $quotation->load(['rfq.items.product', 'rfq.customer', 'customer', 'createdBy', 'items', 'approvals.approver']);

        $fmt = fn($v) => number_format((float) ($v ?? 0), 2);
        $esc = fn($v) => htmlspecialchars((string) ($v ?? ''), ENT_QUOTES | ENT_HTML5, 'UTF-8');

        // Line items — uses quotation_items (the new schema). Fallback to RFQ items
        // if no quotation_items rows exist (legacy quotations). Also pull each item's
        // unit so we can render the "একক" column properly (defaults to "Nos").
        $lineItems = $quotation->items;
        if ($lineItems->isEmpty() && $quotation->rfq) {
            $lineItems = $quotation->rfq->items->map(fn($i) => (object) [
                'description' => $i->job_description ?? $i->product?->name ?? '—',
                'quantity'    => $i->quantity,
                'unit'        => $i->unit ?? 'Nos',
                'unit_price'  => 0,
                'amount'      => 0,
            ]);
        }
        // For quotation_items, units come from the linked RFQ item. Build a lookup.
        $unitByLine = [];
        if ($quotation->rfq) {
            foreach ($quotation->rfq->items as $i) {
                $unitByLine[$i->job_description ?? ''] = $i->unit ?? 'Nos';
            }
        }

        $total       = (float) $quotation->total_amount;
        $totalWords  = $this->amountInWords($total);
        $quotationNo = 'Q-' . str_pad((string) $quotation->id, 5, '0', STR_PAD_LEFT) . ' v' . $quotation->version;

        $memoNo     = $quotation->memo_no ?? '';
        $custRefNo  = $quotation->customer_ref_no ?? '';
        $custRefDt  = $quotation->customer_ref_date?->format('d/m/Y') ?? '';
        $recipient  = $quotation->recipient_block ?? '';
        $issuedDate = $quotation->created_at->format('d/m/Y');

        // ─────────────────────────────────────────────────────────────────────
        // Memo block — নং (left) + তারিখঃ (right).
        // Always rendered so the document always carries a date stamp; the memo
        // number column stays blank if the preparer didn't enter one.
        $memoBlock = '<table width="100%" cellspacing="0" cellpadding="0" style="margin-bottom: 14pt;">'
            . '<tr>'
            .   '<td style="font-size: 11pt; color: #000;">'
            .     '<span class="bn" style="font-family: siyamrupali;">নং -</span> '
            .     '<span style="font-family: dejavusansmono;">' . $esc($memoNo) . '</span>'
            .   '</td>'
            .   '<td style="font-size: 11pt; color: #000; text-align: right;">'
            .     '<span class="bn" style="font-family: siyamrupali;">তারিখঃ</span> ' . $esc($issuedDate) . ' <span class="bn" style="font-family: siyamrupali;">খ্রিঃ</span>'
            .   '</td>'
            . '</tr>'
            . '</table>';

        // ─────────────────────────────────────────────────────────────────────
        // Title — centered পুনঃদরপত্র / (QUOTATION).
        $titleBlock = '<div style="text-align: center; margin-bottom: 14pt;">'
            . '<div class="bn" style="font-family: siyamrupali; font-size: 14pt; color: #000;">দরপত্র</div>'
            . '<div style="font-size: 11pt; color: #000; margin-top: 1pt;">(QUOTATION)</div>'
            . '</div>';

        // ─────────────────────────────────────────────────────────────────────
        // Recipient (left) + Customer Ref (right) — plain two-column block.
        $addressBlock = '<table width="100%" cellspacing="0" cellpadding="0" style="margin-bottom: 8pt;">'
            . '<tr>'
            .   '<td width="55%" style="vertical-align: top; padding-right: 12pt;">'
            .     '<div style="font-size: 11pt; color: #000; line-height: 1.4;">' . nl2br($esc($recipient), false) . '</div>'
            .   '</td>'
            .   '<td width="45%" style="vertical-align: top; font-size: 11pt; color: #000;">';
        if ($custRefNo !== '') {
            $addressBlock .= '<div><b>Ref:</b> ' . $esc($custRefNo) . '</div>';
        }
        if ($custRefDt !== '') {
            $addressBlock .= '<div style="margin-top: 1pt;"><b>Date:</b> ' . $esc($custRefDt) . '</div>';
        }
        $addressBlock .=   '</td>'
            . '</tr>'
            . '</table>';

        // ─────────────────────────────────────────────────────────────────────
        // Items table — exact BITAC layout: Sl.No | Description (bilingual) | Quantity | Unit | Unit Price | Total Price
        // All cells black-bordered, white background, no zebra striping or accent colors.
        // Column widths tuned so even 7-digit BDT amounts fit on one line.
        $itemsHtml  = '<table width="100%" cellspacing="0" cellpadding="0" style="border-collapse: collapse; border: 0.75pt solid #000; margin-top: 4pt; table-layout: fixed;">';
        $itemsHtml .= '<colgroup>'
            . '<col style="width: 6%;" />'
            . '<col style="width: 38%;" />'
            . '<col style="width: 10%;" />'
            . '<col style="width: 8%;" />'
            . '<col style="width: 17%;" />'
            . '<col style="width: 21%;" />'
            . '</colgroup>';
        // Header row
        $itemsHtml .= '<tr>';
        $itemsHtml .=   '<th style="border: 0.75pt solid #000; padding: 4pt 2pt; font-size: 9pt; font-weight: normal; text-align: center; vertical-align: middle;">'
            . '<span class="bn" style="font-family: siyamrupali;">ক্র.নং</span><br>(Sl. No)</th>';
        $itemsHtml .=   '<th style="border: 0.75pt solid #000; padding: 4pt; font-size: 9pt; font-weight: normal; text-align: center; vertical-align: middle;">'
            . '<span class="bn" style="font-family: siyamrupali;">কাজের বিবরণ</span><br>(Description of Works)</th>';
        $itemsHtml .=   '<th style="border: 0.75pt solid #000; padding: 4pt 2pt; font-size: 9pt; font-weight: normal; text-align: center; vertical-align: middle;">'
            . '<span class="bn" style="font-family: siyamrupali;">পরিমান</span><br>(Quantity)</th>';
        $itemsHtml .=   '<th style="border: 0.75pt solid #000; padding: 4pt 2pt; font-size: 9pt; font-weight: normal; text-align: center; vertical-align: middle;">'
            . '<span class="bn" style="font-family: siyamrupali;">একক</span><br>(Unit)</th>';
        $itemsHtml .=   '<th style="border: 0.75pt solid #000; padding: 4pt 2pt; font-size: 9pt; font-weight: normal; text-align: center; vertical-align: middle;">'
            . '<span class="bn" style="font-family: siyamrupali;">একক দর</span><br>(Unit Price)</th>';
        $itemsHtml .=   '<th style="border: 0.75pt solid #000; padding: 4pt 2pt; font-size: 9pt; font-weight: normal; text-align: center; vertical-align: middle;">'
            . '<span class="bn" style="font-family: siyamrupali;">মূল্য</span><br>(Total Price)</th>';
        $itemsHtml .= '</tr>';

        if ($lineItems->isEmpty()) {
            $itemsHtml .= '<tr><td colspan="6" style="border: 0.75pt solid #000; padding: 10pt; text-align: center; font-style: italic; font-size: 10pt;">No line items</td></tr>';
        } else {
            foreach ($lineItems as $i => $li) {
                $unit = $li->unit ?? ($unitByLine[$li->description] ?? 'Nos');
                $sl   = str_pad((string)($i + 1), 2, '0', STR_PAD_LEFT);
                $itemsHtml .= '<tr>';
                $itemsHtml .=   '<td style="border: 0.75pt solid #000; padding: 6pt 2pt; font-size: 10pt; text-align: center; vertical-align: middle;">' . $sl . '</td>';
                $itemsHtml .=   '<td style="border: 0.75pt solid #000; padding: 6pt 8pt; font-size: 10pt; vertical-align: top; line-height: 1.4;">' . nl2br($esc($li->description)) . '</td>';
                $itemsHtml .=   '<td style="border: 0.75pt solid #000; padding: 6pt 2pt; font-size: 10pt; text-align: center; vertical-align: middle;">' . $fmt($li->quantity) . '</td>';
                $itemsHtml .=   '<td style="border: 0.75pt solid #000; padding: 6pt 2pt; font-size: 10pt; text-align: center; vertical-align: middle;">' . $esc($unit) . '</td>';
                $itemsHtml .=   '<td style="border: 0.75pt solid #000; padding: 6pt 4pt; font-size: 10pt; text-align: right; vertical-align: middle; white-space: nowrap;">' . $fmt($li->unit_price) . '</td>';
                $itemsHtml .=   '<td style="border: 0.75pt solid #000; padding: 6pt 4pt; font-size: 10pt; text-align: right; vertical-align: middle; white-space: nowrap;">' . $fmt($li->amount) . '</td>';
                $itemsHtml .= '</tr>';
            }
        }

        // Bottom row INSIDE the items table: only "Total (Including VAT & TAX)" + amount.
        // The "মোট টাকাঃ <words>" line is rendered as a separate paragraph below the table.
        $itemsHtml .= '<tr>';
        $itemsHtml .=   '<td colspan="5" style="border: 0.75pt solid #000; padding: 6pt 8pt; font-size: 10pt; text-align: right; vertical-align: middle; font-weight: bold;">Total (Including VAT &amp; TAX)</td>';
        $itemsHtml .=   '<td style="border: 0.75pt solid #000; padding: 6pt 4pt; font-size: 10pt; text-align: right; vertical-align: middle; font-weight: bold; white-space: nowrap;">' . $fmt($total) . '</td>';
        $itemsHtml .= '</tr>';
        $itemsHtml .= '</table>';

        // Amount in words — sits just below the items table, left-aligned.
        $itemsHtml .= '<div style="margin-top: 6pt; font-size: 10pt; color: #000;">'
            . '<span class="bn" style="font-family: siyamrupali;">মোট টাকাঃ</span> ' . $esc($totalWords)
            . '</div>';

        // ─────────────────────────────────────────────────────────────────────
        // Signature block — right-aligned. Uses the FINAL approver's identity
        // (the highest-level user who approved this quotation). Falls back to
        // the creator if no one has approved yet. Phone pulls from the user
        // first, then the center's letterhead phone as a fallback.
        $finalApproval = $quotation->approvals
            ->where('status', 'approved')
            ->sortByDesc('level')
            ->first();
        $signer = $finalApproval?->approver ?? $quotation->createdBy;

        $center = \App\Models\Center::find(
            $quotation->center_id
            ?? session('active_center_id')
            ?? auth()->user()?->center_id
            ?? 1
        );

        // Eager-load center on the signer so we can show their actual posting,
        // not the document's center (super-admin may sign for a different center).
        if ($signer && !$signer->relationLoaded('center')) {
            $signer->load('center');
        }

        $signerName       = $signer?->name ?? '';
        $signerDesignation = $signer?->designation ?: 'নির্বাহী প্রকৌশলী'; // fallback for legacy users
        $signerCenter     = $signer?->center?->name ?: 'বিটাক, ঢাকা।';     // English center name with fallback
        $signerEmail      = $signer?->email ?? $center?->email ?? '';
        $signerPhone      = $signer?->phone ?: $center?->phone_bn ?: $center?->phone ?: '';
        // Prefer the signature captured on THIS approval (per-decision audit).
        // Fall back to the approver's stored profile signature when not present.
        $sigPath     = $finalApproval?->signatureAbsolutePath()
                     ?? $signer?->signatureAbsolutePath();

        // Signature image — if uploaded for the signer, render it; otherwise leave blank space.
        $signatureImg = $sigPath
            ? '<img src="' . $sigPath . '" style="height: 50pt; max-width: 160pt;" alt="signature" />'
            : '<div style="height: 36pt;"></div>';

        $signatureBlock = '<table width="100%" cellspacing="0" cellpadding="0" style="margin-top: 24pt;">'
            . '<tr>'
            .   '<td width="55%"></td>'
            .   '<td width="45%" style="font-size: 11pt; color: #000; line-height: 1.5;">'
            .     '<div>' . $signatureImg . '</div>'
            .     '<div>(' . $esc($signerName) . ')</div>'
            .     '<div class="bn" style="font-family: siyamrupali;">' . $esc($signerDesignation) . '</div>'
            .     '<div class="bn" style="font-family: siyamrupali;">' . $esc($signerCenter) . '</div>';
        if ($signerEmail) {
            $signatureBlock .= '<div style="margin-top: 2pt;"><span class="bn" style="font-family: siyamrupali;">ই-মেইলঃ</span> '
                . '<u>' . $esc($signerEmail) . '</u></div>';
        }
        if ($signerPhone) {
            $signatureBlock .= '<div><span class="bn" style="font-family: siyamrupali;">ফোনঃ</span> '
                . $esc($signerPhone) . '</div>';
        }
        $signatureBlock .= '</td>'
            . '</tr>'
            . '</table>';

        // ─────────────────────────────────────────────────────────────────────
        // Numbered Terms & Conditions (দরপত্রের শর্ত সমূহ) — bordered box header on top,
        // numbered list below. Matches the bottom of the BITAC official sample.
        $termsHtml = '';
        $termsList = $quotation->terms ?? [];
        if (is_array($termsList) && count($termsList) > 0) {
            $termsHtml  = '<div style="margin-top: 18pt;">';
            $termsHtml .=   '<div style="text-align: center; margin-bottom: 6pt;">';
            $termsHtml .=     '<span class="bn" style="display: inline-block; padding: 2pt 14pt; border: 0.75pt solid #000; font-family: siyamrupali; font-size: 11pt; color: #000;">দরপত্রের শর্ত সমূহ</span>';
            $termsHtml .=   '</div>';
            $termsHtml .=   '<table cellspacing="0" cellpadding="0" style="width: 100%; margin-top: 4pt;">';
            foreach ($termsList as $idx => $term) {
                $termsHtml .= '<tr>';
                $termsHtml .=   '<td width="24pt" style="padding: 2pt 4pt; vertical-align: top; font-size: 10pt; color: #000;">' . ($idx + 1) . '.</td>';
                $termsHtml .=   '<td class="bn" style="padding: 2pt 4pt; vertical-align: top; font-family: siyamrupali; font-size: 10.5pt; color: #000; line-height: 1.5;">' . $esc($term) . '</td>';
                $termsHtml .= '</tr>';
            }
            $termsHtml .= '</table>';
            $termsHtml .= '</div>';
        }

        // Optional preparer-supplied additional notes — printed below the terms in plain text.
        $notesHtml = $quotation->notes
            ? '<div style="margin-top: 10pt; font-size: 10pt; color: #000; line-height: 1.4;">' . nl2br($esc($quotation->notes), false) . '</div>'
            : '';

        $bodyHtml = <<<HTML
        {$memoBlock}
        {$titleBlock}
        {$addressBlock}
        {$itemsHtml}
        {$signatureBlock}
        {$termsHtml}
        {$notesHtml}
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

        $request->validate([
            'customer_po_no'    => 'nullable|string|max:100',
            'priority'          => 'nullable|in:normal,high,urgent',
            'due_date'          => 'nullable|date',
            'notes'             => 'nullable|string|max:1000',
            // Customer's PO / authorisation document — audit trail + legal proof
            'customer_po_file'  => 'nullable|file|mimes:pdf,jpg,jpeg,png,webp,doc,docx|max:10240',
        ]);

        $quotation->load('rfq.items.product');
        $rfq       = $quotation->rfq;
        $firstItem = $rfq?->items->first();
        $woNumber  = $this->workOrderService->generateWoNumber();
        $jobNumber = \App\Services\JobNumberService::next();

        // Product model exposes boms()/firstBom; older code called ->activeBom which doesn't exist
        // on this codebase. Pick the latest BOM defensively.
        $bomId = $firstItem?->product?->boms()->latest('id')->first()?->id;

        $workOrder = \App\Models\WorkOrder::create([
            // Inherit center from the source quotation so PCD inbox (which filters
            // by active center via CenterScope) actually shows this WO. Falls back
            // to the RFQ's or customer's center, then 1, never NULL.
            'center_id'       => $quotation->center_id
                                ?? $rfq?->center_id
                                ?? $quotation->customer?->center_id
                                ?? 1,
            'quotation_id'    => $quotation->id,
            'rfq_id'          => $quotation->rfq_id, // direct link so PCD inbox can fetch items without going through quotation
            'customer_id'     => $quotation->customer_id,
            'job_category_id' => $quotation->job_category_id ?? $rfq?->job_category_id,
            'product_id'      => $firstItem?->product_id,
            'bom_id'          => $bomId,
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

        // Attach the customer PO / authorisation file (mandatory paper trail)
        if ($request->hasFile('customer_po_file')) {
            $file = $request->file('customer_po_file');
            $stored = $file->store("work-orders/{$workOrder->id}", 'public');
            $workOrder->files()->create([
                'uploaded_by'   => auth()->id(),
                'kind'          => 'customer_po',
                'stored_path'   => $stored,
                'original_name' => $file->getClientOriginalName(),
                'mime_type'     => $file->getMimeType(),
                'size_bytes'    => $file->getSize(),
                'description'   => 'Customer PO / Work Order copy received with quotation acceptance',
            ]);
        }

        $quotation->update(['status' => 'converted']);

        // Notify PCD officers — they're the next humans in the chain.
        NotifyService::toPermission(
            'view pcd-inbox',
            'work_order_created',
            'New Work Order — PCD action required',
            "WO {$woNumber} from Quotation #{$quotation->id} ({$quotation->customer?->name}) is awaiting PCD setup.",
            "/pcd/inbox/{$workOrder->id}",
            'fi-rr-tools',
            'brand',
        );

        // Redirect destination depends on who's doing the conversion:
        //   - If they have PCD inbox access → land on the PCD checklist directly.
        //   - Otherwise (IED officer) → stay on the quotation, since they don't
        //     have permission to view the PCD inbox. They get a clear success
        //     message instead so they know the WO was handed off to PCD.
        $user = auth()->user();
        $canSeePcd = $user && method_exists($user, 'can') && $user->can('view pcd-inbox');

        if ($canSeePcd) {
            return redirect()
                ->route('pcd.inbox.show', $workOrder)
                ->with('success', "Work Order {$woNumber} created. Continue with PCD setup below.");
        }

        return redirect()
            ->route('quotations.show', $quotation)
            ->with('success', "Work Order {$woNumber} (Job #{$jobNumber}) created and handed off to PCD. The PCD team will set up Material Requisition, Work Order routing, and Operation Sheet from their inbox.");
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
