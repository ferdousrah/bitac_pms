<?php

namespace App\Http\Controllers;

use App\Models\CostEstimate;
use App\Models\Customer;
use App\Models\Quotation;
use App\Models\Rfq;
use App\Services\NotifyService;
use App\Services\QuotationService;
use App\Services\WorkOrderService;
use Barryvdh\DomPDF\Facade\Pdf;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
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
        $rfq   = $rfqId ? Rfq::with([
            'customer', 'items.product', 'items.costEstimates', 'items.parts.costEstimates',
        ])->findOrFail($rfqId) : null;

        // One quotation line per JOB — parts are an internal costing device and
        // never reach the customer. The job's cost comes from
        // RfqItem::jobCostBreakdown(), which sums the part estimates when the
        // job is costed part-wise and falls back to a whole-job estimate
        // otherwise. Taking a single estimate here (as this used to) would
        // silently quote only one part of a multi-part job.
        $uncosted = [];
        $items = $rfq ? $rfq->items->map(function ($i) use (&$uncosted) {
            $cost = $i->jobCostBreakdown();

            // BITAC quotations follow the convention: Unit Price is INCLUDING VAT & TAX
            // (no separate VAT row — see sample re-quotation 36.06.2692.028.51.028(2).26.92).
            // The job total already honours each estimate's manual grand-total
            // override, so a rounded figure flows straight through.
            $unitPrice = null;
            if ($cost['mode'] !== 'none') {
                $jobQty = (float) $i->quantity;
                $unitPrice = $jobQty > 0
                    ? round($cost['total'] / $jobQty, 2)
                    : round($cost['total'], 2);
            }

            // Flag a job whose parts are only partly costed — the total would
            // be short and the preparer needs to know before sending.
            if ($cost['mode'] === 'parts' && $cost['missing'] > 0) {
                $uncosted[] = [
                    'description' => $i->job_description ?? $i->product?->name ?? "Item #{$i->id}",
                    'missing'     => $cost['missing'],
                    'part_count'  => $cost['part_count'],
                ];
            }

            $estimate = $cost['estimate'];

            return [
                'rfq_item_id'  => $i->id,
                'description'  => $i->job_description ?? $i->product?->name ?? '—',
                'quantity'     => (float) $i->quantity,
                'unit'         => $i->unit,
                'unit_price'   => $unitPrice,
                // Where the money came from, so the form can show its provenance.
                'cost_mode'    => $cost['mode'],
                'job_cost'     => $cost['mode'] !== 'none' ? $cost['total'] : null,
                'part_count'   => $cost['part_count'],
                'costed_parts' => $cost['costed'],
                'estimate_no'  => $estimate?->estimate_no,
                'estimate_id'  => $estimate?->id,
            ];
        })->values() : [];

        // Pull VAT/Tax rates from the source cost estimate so the quotation
        // inherits whatever was entered during costing (e.g. AIT/tax %). Fall
        // back to the first item's estimate, then to config defaults.
        $sourceEstimate = null;
        if ($estId = $request->query('estimate_id')) {
            $sourceEstimate = CostEstimate::find($estId);
        }
        if (!$sourceEstimate && $rfq) {
            $sourceEstimate = $rfq->items
                ->flatMap->costEstimates
                ->where('status', '!=', 'draft')
                ->sortByDesc('id')
                ->first() ?? $rfq->items->flatMap->costEstimates->sortByDesc('id')->first();
        }

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
            'vatRate'      => $sourceEstimate ? (float) $sourceEstimate->vat_pct : config('app.vat_rate', 15),
            'defaultTaxRate' => $sourceEstimate ? (float) ($sourceEstimate->tax_pct ?? 0) : 0,
            'kickoffNote'  => $request->query('kickoff_note'),
            'sourceEstimateId' => $request->query('estimate_id'),
            'defaultRecipient'      => $defaultRecipient,
            'defaultTerms'          => $defaultTerms,
            // Pre-fill the customer reference + date from the source RFQ — the IED
            // preparer can override either field on the quotation form if needed.
            'defaultCustomerRefNo'   => $rfq?->customer_ref_no ?? '',
            'defaultCustomerRefDate' => $rfq?->created_at?->format('Y-m-d') ?? '',
            // Jobs whose parts are only partly costed — quoting these as-is
            // would under-charge, so the form warns before the preparer sends.
            'uncostedJobs'           => $uncosted,
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
        // Drafts are always editable. For pending_approval, allow if the
        // current user has a pending approval row (chain approver) OR has
        // been forwarded to (out-of-chain reviewer). This lets approvers
        // make small corrections without bouncing the doc back.
        $user = auth()->user();
        $hasPendingApprovalRole = $quotation->approvals()
            ->where('status', 'pending')
            ->where(function ($q) use ($user) {
                $q->where('approver_id', $user->id)
                  ->orWhere('forwarded_to_user_id', $user->id);
            })
            ->exists();

        abort_unless(
            $quotation->status === 'draft' ||
            ($quotation->status === 'pending_approval' && $hasPendingApprovalRole),
            422,
            'This quotation cannot be edited at its current stage.'
        );

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
                'tax_rate'          => (float) ($quotation->tax_rate ?? 0),
                'show_tax_breakdown' => (bool) $quotation->show_tax_breakdown,
                'notes'             => $quotation->notes,
                'memo_no'           => $quotation->memo_no,
                'memo_date'         => $quotation->memo_date?->format('Y-m-d'),
                'customer_ref_no'   => $quotation->customer_ref_no,
                'customer_ref_date' => $quotation->customer_ref_date?->format('Y-m-d'),
                'recipient_block'   => $quotation->recipient_block,
                'terms'             => $quotation->terms ?? [],
                'discount'          => (float) ($quotation->discount ?? 0),
                'discount_type'     => $quotation->discount_type,
                'forwarding_letter' => $quotation->forwarding_letter,
                'forwarding_letter_subject' => $quotation->forwarding_letter_subject,
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
        // Same gate as edit(): drafts always editable; pending_approval
        // editable when the current user has a pending approval row
        // (chain approver or forwarded-to reviewer).
        $user = auth()->user();
        $hasPendingApprovalRole = $quotation->approvals()
            ->where('status', 'pending')
            ->where(function ($q) use ($user) {
                $q->where('approver_id', $user->id)
                  ->orWhere('forwarded_to_user_id', $user->id);
            })
            ->exists();

        abort_unless(
            $quotation->status === 'draft' ||
            ($quotation->status === 'pending_approval' && $hasPendingApprovalRole),
            422,
            'This quotation cannot be edited at its current stage.'
        );

        $validated = $request->validate([
            'vat_rate'                => 'required|numeric|min:0|max:100',
            'validity_days'           => 'nullable|integer|min:1',
            'notes'                   => 'nullable|string',
            'items'                   => 'required|array|min:1',
            'items.*.description'     => 'required|string|max:255',
            'items.*.quantity'        => 'required|numeric|min:0',
            'items.*.unit_price'      => 'required|numeric|min:0',
            'items.*.unit'            => 'nullable|string|max:20',
            'memo_no'                 => 'nullable|string|max:80',
            'memo_date'               => 'nullable|date',
            'customer_ref_no'         => 'nullable|string|max:100',
            'customer_ref_date'       => 'nullable|date',
            'recipient_block'         => 'nullable|string|max:1000',
            'terms'                   => 'nullable|array',
            'terms.*'                 => 'nullable|string|max:500',
            'attachments'             => 'nullable|array',
            'attachments.*'           => 'file|max:20480', // 20 MB each
            'attachment_kinds'        => 'nullable|array',
            'attachment_kinds.*'      => 'nullable|in:supporting,annexure,spec,other',
            // Discount + forwarding letter
            'discount_type'           => 'nullable|in:percent,fixed',
            'discount'                => 'nullable|numeric|min:0',
            'tax_rate'                => 'nullable|numeric|min:0|max:100',
            'show_tax_breakdown'      => 'boolean',
            'forwarding_letter_subject' => 'nullable|string|max:255',
            'forwarding_letter'       => 'nullable|string',
        ]);

        // Recompute totals — gross is what the line items add up to, embedded VAT extracted.
        $grossTotal = 0.0;
        foreach ($validated['items'] as $item) {
            $grossTotal += ((float) $item['quantity']) * ((float) $item['unit_price']);
        }
        // Unit prices are inclusive of BOTH VAT and Tax (mirrors the cost
        // estimate, where VAT & Tax are computed on the same pre-tax base and
        // baked into the total). So both are EMBEDDED here — extracted from the
        // gross for display, never added on top (otherwise tax is double-counted).
        $vatRate   = (float) $validated['vat_rate'];
        $taxRate2  = (float) ($validated['tax_rate'] ?? 0);
        $base      = ($vatRate + $taxRate2) > 0 ? $grossTotal / (1 + ($vatRate + $taxRate2) / 100) : $grossTotal;
        $vatAmount  = $vatRate  > 0 ? round($base * $vatRate  / 100, 2) : 0.0;
        $taxAmount2 = $taxRate2 > 0 ? round($base * $taxRate2 / 100, 2) : 0.0;
        $subtotal  = round($grossTotal - $vatAmount - $taxAmount2, 2);

        // Discount (same rules as the create path)
        $discountType2 = $validated['discount_type'] ?? null;
        $discountInput2 = (float) ($validated['discount'] ?? 0);
        $discountAmount2 = match ($discountType2) {
            'percent' => round($grossTotal * $discountInput2 / 100, 2),
            'fixed'   => round($discountInput2, 2),
            default   => 0.0,
        };
        $discountAmount2 = min($discountAmount2, $grossTotal);
        $total = round($grossTotal - $discountAmount2, 2);

        $cleanTerms = collect($validated['terms'] ?? [])
            ->map(fn($t) => trim((string) $t))
            ->filter(fn($t) => $t !== '')
            ->values()
            ->all();

        $showTaxBreakdown = $request->boolean('show_tax_breakdown');
        \DB::transaction(function () use ($quotation, $validated, $subtotal, $vatRate, $vatAmount, $total, $taxRate2, $taxAmount2, $showTaxBreakdown, $discountAmount2, $discountType2, $cleanTerms) {
            $quotation->update([
                'material_cost'     => $subtotal,
                'vat_rate'          => $vatRate,
                'vat_amount'        => $vatAmount,
                'tax_rate'          => $taxRate2,
                'tax_amount'        => $taxAmount2,
                'show_tax_breakdown' => $showTaxBreakdown,
                'discount'          => $discountAmount2,
                'discount_type'     => $discountType2,
                'total_amount'      => $total,
                'validity_days'     => $validated['validity_days'] ?? $quotation->validity_days ?? 90,
                'notes'             => $validated['notes'] ?? null,
                'memo_no'           => $validated['memo_no'] ?? null,
                'memo_date'         => $validated['memo_date'] ?? null,
                'customer_ref_no'   => $validated['customer_ref_no'] ?? null,
                'customer_ref_date' => $validated['customer_ref_date'] ?? null,
                'recipient_block'   => $validated['recipient_block'] ?? null,
                'terms'             => !empty($cleanTerms) ? $cleanTerms : null,
                'forwarding_letter' => $validated['forwarding_letter'] ?? null,
                'forwarding_letter_subject' => $validated['forwarding_letter_subject'] ?? null,
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
            // Optional: a quotation can start from scratch, in which case a
            // backing RFQ is created for it and customer_id says who for.
            'rfq_id'                  => 'nullable|exists:rfqs,id',
            'customer_id'             => 'required_without:rfq_id|nullable|exists:customers,id',
            'vat_rate'                => 'required|numeric|min:0|max:100',
            'tax_rate'                => 'nullable|numeric|min:0|max:100',
            'show_tax_breakdown'      => 'boolean',
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
            'memo_date'               => 'nullable|date',
            'customer_ref_no'         => 'nullable|string|max:100',
            'customer_ref_date'       => 'nullable|date',
            'recipient_block'         => 'nullable|string|max:1000',
            'terms'                   => 'nullable|array',
            'terms.*'                 => 'nullable|string|max:500',
            // Discount + forwarding letter
            'discount_type'           => 'nullable|in:percent,fixed',
            'discount'                => 'nullable|numeric|min:0',
            'forwarding_letter_subject' => 'nullable|string|max:255',
            'forwarding_letter'       => 'nullable|string',
        ]);

        // Started from an RFQ, or started from nothing — either way the
        // quotation hangs off an RFQ, because everything downstream (costing,
        // work orders, gate passes, the customer portal) is anchored to one.
        $rfq = ! empty($validated['rfq_id'])
            ? Rfq::findOrFail($validated['rfq_id'])
            : $this->createBackingRfq($validated['customer_id'], $validated['items']);
        $validated['rfq_id'] = $rfq->id;

        // BITAC quotations: Unit Price is VAT-INCLUSIVE. The line total IS the grand total
        // (no separate VAT row on the quote). We still record vat_rate + the EMBEDDED VAT
        // portion for audit/PDF/reporting purposes.
        $grossTotal = 0.0;
        foreach ($validated['items'] as $item) {
            $grossTotal += ((float) $item['quantity']) * ((float) $item['unit_price']);
        }
        // Unit prices are inclusive of BOTH VAT and Tax (mirrors the cost
        // estimate, where VAT & Tax are computed on the same pre-tax base and
        // baked into the total). So both are EMBEDDED — extracted from the gross
        // for the PDF/audit break-up, never added on top (would double-count tax).
        $vatRate   = (float) $validated['vat_rate'];
        $taxRate   = (float) ($validated['tax_rate'] ?? 0);
        $base      = ($vatRate + $taxRate) > 0 ? $grossTotal / (1 + ($vatRate + $taxRate) / 100) : $grossTotal;
        $vatAmount = $vatRate > 0 ? round($base * $vatRate / 100, 2) : 0.0;
        $taxAmount = $taxRate > 0 ? round($base * $taxRate / 100, 2) : 0.0;
        $subtotal  = round($grossTotal - $vatAmount - $taxAmount, 2);

        // Discount — applied on the gross. Type can be 'percent' or 'fixed'.
        $discountType = $validated['discount_type'] ?? null;
        $discountInput = (float) ($validated['discount'] ?? 0);
        $discountAmount = match ($discountType) {
            'percent' => round($grossTotal * $discountInput / 100, 2),
            'fixed'   => round($discountInput, 2),
            default   => 0.0,
        };
        // Cap discount at gross — never produce a negative quote.
        $discountAmount = min($discountAmount, $grossTotal);

        $total = round($grossTotal - $discountAmount, 2);

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
            'discount'       => $discountAmount,
            'discount_type'  => $discountType,
            'vat_rate'       => $vatRate,
            'vat_amount'     => $vatAmount,
            'tax_rate'       => $taxRate,
            'tax_amount'     => $taxAmount,
            'show_tax_breakdown' => $request->boolean('show_tax_breakdown'),
            'total_amount'   => $total,
            'validity_days'  => $validated['validity_days'] ?? 90,
            'notes'          => $validated['notes'] ?? null,
            'status'         => $saveAsDraft ? 'draft' : 'pending_approval',
            'created_by'    => auth()->id(),
            // BITAC letter header
            'memo_no'           => $validated['memo_no'] ?? null,
            'memo_date'         => $validated['memo_date'] ?? null,
            'customer_ref_no'   => $validated['customer_ref_no'] ?? null,
            'customer_ref_date' => $validated['customer_ref_date'] ?? null,
            'recipient_block'   => $validated['recipient_block'] ?? null,
            'terms'             => !empty($cleanTerms) ? $cleanTerms : null,
            'forwarding_letter' => $validated['forwarding_letter'] ?? null,
            'forwarding_letter_subject' => $validated['forwarding_letter_subject'] ?? null,
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

    /**
     * Create the RFQ that sits behind a quotation started from scratch.
     *
     * The job items mirror the quotation's lines, so the RFQ is a faithful
     * record of what was quoted and can be costed part-wise later exactly
     * like any other. Marked `direct_quotation` so the RFQ list shows that
     * nobody keyed it in by hand.
     */
    private function createBackingRfq($customerId, array $items): Rfq
    {
        return DB::transaction(function () use ($customerId, $items) {
            $rfq = Rfq::create([
                'customer_id' => $customerId,
                'status'      => 'pending',
                'source'      => 'direct_quotation',
                'created_by'  => auth()->id(),
                'notes'       => 'Created automatically from a direct quotation.',
            ]);

            foreach ($items as $item) {
                $rfq->items()->create([
                    'job_description' => $item['description'],
                    'quantity'        => $item['quantity'],
                    'unit'            => $item['unit'] ?? 'pcs',
                ]);
            }

            return $rfq;
        });
    }

    /**
     * Copy a quotation onto ANOTHER customer.
     *
     * The same job often comes back from a different company. This clones the
     * whole chain for the new customer — a fresh RFQ with the same jobs and
     * parts, the cost estimates behind them, and a new v1 quotation — so the
     * work never has to be keyed in twice. Nothing on the source is touched.
     *
     * Pricing group: keep the source's and the copy is identical to the
     * original. Choose a different one and the copied estimates are re-priced
     * to it and the quotation's unit prices are re-derived from the new job
     * costs, because a different group genuinely means a different price.
     */
    public function duplicateForCustomer(Request $request, Quotation $quotation)
    {
        $validated = $request->validate([
            'customer_id'   => 'required|exists:customers,id',
            'pricing_group' => 'nullable|in:A,B,C,STUDENT,PUBLIC',
        ]);

        $quotation->load(['items', 'rfq.items.parts.costEstimates', 'rfq.items.costEstimates']);
        $sourceRfq = $quotation->rfq;

        if (! $sourceRfq) {
            return back()->with('error', 'This quotation has no RFQ behind it, so there is nothing to copy.');
        }

        $customer  = Customer::findOrFail($validated['customer_id']);
        $newGroup  = $validated['pricing_group'] ?? null;

        $new = DB::transaction(function () use ($quotation, $sourceRfq, $customer, $newGroup) {
            // 1. A fresh RFQ for the new customer, mirroring the source's jobs.
            $rfq = Rfq::create([
                'customer_id'     => $customer->id,
                'job_category_id' => $sourceRfq->job_category_id,
                'job_type'        => $sourceRfq->job_type ?? 'regular',
                'status'          => 'pending',
                'source'          => 'staff',
                'created_by'      => auth()->id(),
                'notes'           => "Copied from Quotation #{$quotation->id} (RFQ #{$sourceRfq->id}).",
            ]);

            $repriced = 0;
            foreach ($sourceRfq->items as $srcItem) {
                $item = $rfq->items()->create([
                    'product_id'         => $srcItem->product_id,
                    'job_description'    => $srcItem->job_description,
                    'quantity'           => $srcItem->quantity,
                    'unit'               => $srcItem->unit,
                    'notes'              => $srcItem->notes,
                    'reference_type'     => $srcItem->reference_type ?? 'none',
                    'sample_received'    => (bool) $srcItem->sample_received,
                    'sample_description' => $srcItem->sample_description,
                ]);

                // 2. Parts, and the estimate behind each one.
                foreach ($srcItem->parts as $srcPart) {
                    $part = $item->parts()->create([
                        'name'       => $srcPart->name,
                        'quantity'   => $srcPart->quantity,
                        'unit'       => $srcPart->unit,
                        'sort_order' => $srcPart->sort_order,
                    ]);

                    if ($srcEst = $srcPart->effectiveEstimate()) {
                        $this->copyEstimate($srcEst, $rfq->id, $item->id, $part->id, $customer, $newGroup);
                        $repriced++;
                    }
                }

                // A job costed as a whole rather than part by part.
                if ($srcItem->parts->isEmpty()) {
                    $srcEst = $srcItem->itemLevelEstimates()->first();
                    if ($srcEst) {
                        $this->copyEstimate($srcEst, $rfq->id, $item->id, null, $customer, $newGroup);
                        $repriced++;
                    }
                }
            }

            // 3. The quotation itself. Keeping the source's pricing group means
            //    an identical copy; a new group means the price follows the
            //    freshly costed jobs.
            $lines = [];
            $gross = 0.0;
            foreach ($quotation->items as $idx => $srcLine) {
                $unitPrice = (float) $srcLine->unit_price;
                $qty       = (float) $srcLine->quantity;

                if ($newGroup) {
                    $item = $rfq->items()->orderBy('id')->skip($idx)->first();
                    $cost = $item?->jobCostBreakdown();
                    if ($cost && $cost['mode'] !== 'none' && $qty > 0) {
                        $unitPrice = round($cost['total'] / $qty, 2);
                    }
                }

                $amount = round($qty * $unitPrice, 2);
                $gross += $amount;
                $lines[] = ['description' => $srcLine->description, 'quantity' => $qty,
                            'unit_price' => $unitPrice, 'amount' => $amount];
            }

            // VAT & Tax are embedded in the unit price — extract, never add on top.
            $vatRate = (float) $quotation->vat_rate;
            $taxRate = (float) $quotation->tax_rate;
            $base    = ($vatRate + $taxRate) > 0 ? $gross / (1 + ($vatRate + $taxRate) / 100) : $gross;

            $copy = Quotation::create([
                'rfq_id'          => $rfq->id,
                'customer_id'     => $customer->id,
                'job_category_id' => $rfq->job_category_id,
                'version'         => 1,
                'material_cost'   => round($gross - round($base * $vatRate / 100, 2) - round($base * $taxRate / 100, 2), 2),
                'labour_cost'     => 0,
                'overhead_cost'   => 0,
                'profit_margin'   => 0,
                'discount'        => 0,
                'vat_rate'        => $vatRate,
                'vat_amount'      => $vatRate > 0 ? round($base * $vatRate / 100, 2) : 0,
                'tax_rate'        => $taxRate,
                'tax_amount'      => $taxRate > 0 ? round($base * $taxRate / 100, 2) : 0,
                'show_tax_breakdown' => (bool) $quotation->show_tax_breakdown,
                'total_amount'    => round($gross, 2),
                'validity_days'   => $quotation->validity_days,
                'notes'           => $quotation->notes,
                'terms'           => $quotation->terms,
                'forwarding_letter'         => $quotation->forwarding_letter,
                'forwarding_letter_subject' => $quotation->forwarding_letter_subject,
                // The new customer needs their own letter header and reference.
                'recipient_block' => trim(implode("\n", array_filter([
                    $customer->contact_person, $customer->name, $customer->address,
                ]))),
                'status'          => 'draft',
                'created_by'      => auth()->id(),
            ]);

            foreach ($lines as $line) {
                $copy->items()->create($line);
            }

            return ['quotation' => $copy, 'estimates' => $repriced];
        });

        $msg = "Copied to {$customer->name} as a new draft quotation";
        if ($new['estimates'] > 0) {
            $msg .= $newGroup
                ? " — {$new['estimates']} cost estimate(s) copied and re-priced for group {$newGroup}."
                : " — {$new['estimates']} cost estimate(s) copied.";
        } else {
            $msg .= '.';
        }

        return redirect()->route('quotations.edit', $new['quotation'])->with('success', $msg);
    }

    /**
     * Clone one cost estimate onto a copied job/part.
     *
     * Rates are never copied blindly: materials re-read their current
     * catalogue rate and operations the rate for the pricing group in force,
     * because an old estimate's rates are historical. A manual grand-total
     * override is only carried over when the group is unchanged — otherwise
     * it was a rounding of a number that no longer applies.
     */
    private function copyEstimate(
        CostEstimate $source, int $rfqId, int $rfqItemId, ?int $partId, Customer $customer, ?string $newGroup
    ): CostEstimate {
        $group = $newGroup ?: $source->pricing_group;

        $copy = CostEstimate::create([
            'estimate_no'      => CostEstimate::generateEstimateNo(),
            'rfq_id'           => $rfqId,
            'rfq_item_id'      => $rfqItemId,
            'rfq_item_part_id' => $partId,
            'customer_id'      => $customer->id,
            'company_name'     => $customer->name,
            'job_name'         => $source->job_name,
            'part_no'          => $source->part_no,
            'actual_size'      => $source->actual_size,
            'materials_size'   => $source->materials_size,
            'pricing_group'    => $group,
            'overhead_pct'     => $source->overhead_pct,
            'vat_pct'          => $source->vat_pct,
            'tax_pct'          => $source->tax_pct,
            'times_multiplier' => $source->times_multiplier,
            'job_quantity'     => $source->job_quantity,
            'extra_cost'       => $source->extra_cost,
            'grand_total_override' => $newGroup ? null : $source->grand_total_override,
            'material_cost' => 0, 'machining_cost' => 0, 'surface_cost' => 0, 'other_cost' => 0,
            'net_cost' => 0, 'overhead_amount' => 0, 'vat_amount' => 0, 'tax_amount' => 0,
            'total' => 0, 'grand_total' => 0,
            'status'           => 'draft',
            'approval_status'  => 'not_submitted',
            'notes'            => "Copied from {$source->estimate_no}.",
            'created_by'       => auth()->id(),
        ]);

        $groupColumn = 'rate_group_' . strtolower($group);
        foreach ($source->lines as $line) {
            $rate = (float) $line->rate;

            // Rates are only recomputed when the pricing group is being
            // changed. Keeping the group means an exact copy, which is what
            // "copy this quotation" is understood to mean.
            if ($newGroup && $line->operation_id) {
                $op = \App\Models\MachiningOperation::find($line->operation_id);
                if ($op && $op->{$groupColumn} !== null) $rate = (float) $op->{$groupColumn};
            } elseif ($newGroup && $line->material_id) {
                $mat = \App\Models\Material::find($line->material_id);
                if ($mat && $mat->rate_per_kg !== null) $rate = (float) $mat->rate_per_kg;
            }

            $copy->lines()->create([
                'section'      => $line->section,
                'material_id'  => $line->material_id,
                'operation_id' => $line->operation_id,
                'description'  => $line->description,
                'quantity'     => $line->quantity,
                'unit'         => $line->unit,
                'rate'         => $rate,
                'amount'       => round((float) $line->quantity * $rate, 2),
                'sequence'     => $line->sequence,
            ]);
        }

        return $copy->recalculate();
    }

    public function show(Quotation $quotation)
    {
        $quotation->load([
            'items', 'files.uploadedBy',
            'rfq.items.product', 'rfq.items.drawings', 'rfq.items.samplePhotos',
            'rfq.items.costEstimates',
            'rfq.customer', 'customer', 'createdBy.center',
            'approvals.approver.center', 'approvals.forwardedTo.center', 'workOrder',
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
            // For the "copy to another customer" dialog.
            'customers'   => Customer::where('is_active', true)->orderBy('name')->get(['id', 'name']),
            'sourcePricingGroup' => CostEstimate::where('rfq_id', $quotation->rfq_id)
                ->orderByDesc('id')->value('pricing_group'),
            'quotation' => [
                'id'              => $quotation->id,
                'version'         => $quotation->version,
                'status'          => $quotation->status,
                'rfq_id'          => $quotation->rfq_id,
                'job_type'        => $quotation->rfq?->job_type ?? 'regular',
                'customer'        => $quotation->customer?->name ?? $quotation->rfq?->customer?->name ?? '',
                'customer_email'  => $quotation->customer?->email ?? $quotation->rfq?->customer?->email,
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
                'discount_type'   => $quotation->discount_type,
                'vat_rate'        => $quotation->vat_rate,
                'vat_amount'      => $quotation->vat_amount,
                'tax_rate'        => $quotation->tax_rate,
                'tax_amount'      => $quotation->tax_amount,
                'show_tax_breakdown' => (bool) $quotation->show_tax_breakdown,
                'total_amount'    => $quotation->total_amount,
                'validity_days'   => $quotation->validity_days,
                'notes'           => $quotation->notes,
                // BITAC letter header fields
                'memo_no'           => $quotation->memo_no,
                'memo_date'         => $quotation->memo_date?->format('Y-m-d'),
                'customer_ref_no'   => $quotation->customer_ref_no,
                'customer_ref_date' => $quotation->customer_ref_date?->format('d/m/Y'),
                'recipient_block'   => $quotation->recipient_block,
                'terms'             => $quotation->terms ?? [],
                'forwarding_letter' => $quotation->forwarding_letter,
                'forwarding_letter_subject' => $quotation->forwarding_letter_subject,
                'created_by_name' => $quotation->createdBy->name ?? '',
                // Full preparer block so the sidebar / chain can show contact
                // details alongside the signature.
                'created_by'      => $quotation->createdBy ? [
                    'name'        => $quotation->createdBy->name,
                    'designation' => $quotation->createdBy->designation,
                    'center'      => $quotation->createdBy->center?->name,
                    'email'       => $quotation->createdBy->email,
                    'phone'       => $quotation->createdBy->phone,
                    'signature_url' => $quotation->createdBy->signature_path
                        ? \Storage::disk('public')->url($quotation->createdBy->signature_path)
                        : null,
                ] : null,
                'created_at'      => $quotation->created_at->format('d M Y'),
                'approvals'       => (function () use ($quotation) {
                  $sorted = $quotation->approvals->sortBy('level')->values();
                  $total  = $sorted->count();
                  return $sorted->map(function ($a, $idx) use ($total) {
                    $u = $a->approver;
                    $f = $a->forwardedTo;
                    // The signature shown on the chain is whichever was captured
                    // for this approval row first, then the approver's saved one.
                    $sigPath = $a->signature_path ?: $u?->signature_path;
                    return [
                        'id'       => $a->id,
                        'level'    => $a->level,
                        // Role in the work cycle: first approver = Checked By,
                        // last = Approved By (creator = Prepared By, separate).
                        'label'    => \App\Support\ApprovalChainLabels::forIndex($idx, $total),
                        'decision' => $a->status === 'pending' ? null : $a->status,
                        'comments' => $a->remarks,
                        'acted_at' => $a->approved_at?->format('d M Y H:i'),
                        'approver' => $u ? [
                            'name'        => $u->name,
                            'designation' => $u->designation,
                            'center'      => $u->center?->name,
                            'email'       => $u->email,
                            'phone'       => $u->phone,
                            'signature_url' => $sigPath ? \Storage::disk('public')->url($sigPath) : null,
                        ] : null,
                        'forwarded_to' => $f ? [
                            'id'          => $f->id,
                            'name'        => $f->name,
                            'designation' => $f->designation,
                            'center'      => $f->center?->name,
                            'email'       => $f->email,
                            'phone'       => $f->phone,
                        ] : null,
                        'forwarded_at'   => $a->forwarded_at?->format('d M Y H:i'),
                        'forward_reason' => $a->forward_reason,
                        // Whether the *current viewer* is the assigned forwarded approver
                        'is_my_forward'  => $a->forwarded_to_user_id === auth()->id() && $a->status === 'pending',
                    ];
                  });
                })(),
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
            'canCreateRevision'  => in_array($quotation->status, self::REVISABLE_STATUSES, true) && $user->can('create quotation-revision'),
            // Drives the wording — a formally recorded request reads differently
            // from the preparer revising a quotation off their own bat.
            'revisionRequested'  => $quotation->status === 'revision_requested',
            'canConvert'         => in_array($quotation->status, ['approved', 'sent_to_customer', 'customer_accepted']) && $user->can('convert quotations') && !$quotation->workOrder,
            // Users this approver can forward their pending row to — anyone
            // with `approve quotations` who isn't already in the active chain
            // and isn't the current user.
            'forwardableUsers'   => $pendingApproval
                ? \App\Models\User::permission('approve quotations')
                    ->whereNotIn('id', $quotation->approvals()->pluck('approver_id')->push($user->id)->all())
                    ->orderBy('name')
                    ->get(['id', 'name', 'designation'])
                : [],
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
        // Match either the original chain approver row OR a row that's been
        // forwarded to the current user. Forwarded-approver action satisfies
        // the original step.
        $approval = $quotation->approvals()
            ->where('status', 'pending')
            ->where(function ($q) {
                $q->where('approver_id', auth()->id())
                  ->orWhere('forwarded_to_user_id', auth()->id());
            })
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

            // Customer-portal: tell the customer their quotation is ready.
            \App\Services\CustomerNotifyService::quotationSent($quotation->fresh(['customer', 'rfq.customer']));
            if ($quotation->rfq) {
                \App\Services\CustomerNotifyService::rfqQuoted($quotation->rfq->fresh('customer'), $quotation);
            }
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
                'tax_rate'            => $quotation->tax_rate,
                'tax_amount'          => $quotation->tax_amount,
                'show_tax_breakdown'  => $quotation->show_tax_breakdown,
                'total_amount'        => $quotation->total_amount,
                'validity_days'       => $quotation->validity_days,
                'notes'               => $quotation->notes,
                'status'              => 'draft',
                'created_by'          => $quotation->created_by, // keeps it with the original preparer
                // BITAC letter header — copied so the preparer doesn't have to retype.
                'memo_no'             => $quotation->memo_no,
                'memo_date'           => $quotation->memo_date,
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
            ->where('status', 'pending')
            ->where(function ($q) {
                $q->where('approver_id', auth()->id())
                  ->orWhere('forwarded_to_user_id', auth()->id());
            })
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
     * Approver hands off their pending approval row to someone outside the
     * configured chain. The forwarded-to user becomes able to approve/reject
     * on behalf of the original approver, and their decision finalises the
     * approval step (see approve() / reject() — they now match by either
     * approver_id OR forwarded_to_user_id).
     */
    public function forwardApproval(Request $request, Quotation $quotation)
    {
        $validated = $request->validate([
            'forwarded_to_user_id' => 'required|exists:users,id|different:current_user_sentinel',
            'reason'               => 'nullable|string|max:1000',
        ]);

        $approval = $quotation->approvals()
            ->where('approver_id', auth()->id())
            ->where('status', 'pending')
            ->first();

        if (!$approval) {
            return back()->with('error', 'You have no pending approval row to forward on this quotation.');
        }

        if ((int) $validated['forwarded_to_user_id'] === (int) auth()->id()) {
            return back()->with('error', 'You cannot forward to yourself.');
        }

        $approval->update([
            'forwarded_to_user_id' => $validated['forwarded_to_user_id'],
            'forwarded_at'         => now(),
            'forward_reason'       => $validated['reason'] ?? null,
        ]);

        // Notify the forwarded-to user
        try {
            $target = \App\Models\User::find($validated['forwarded_to_user_id']);
            if ($target) {
                \App\Services\NotifyService::toUser(
                    $target,
                    'quotation_forwarded_for_approval',
                    'Quotation approval forwarded to you',
                    "{$quotation->createdBy?->name} via " . auth()->user()->name . " — Quotation #{$quotation->id}",
                    "/quotations/{$quotation->id}",
                    'fi-rr-share',
                    'indigo',
                );
            }
        } catch (\Throwable $e) {
            // Notification failure is non-fatal
            \Log::warning('Forward notify failed: ' . $e->getMessage());
        }

        return back()->with('success', 'Approval forwarded. The forwarded approver can now act on this quotation.');
    }

    /**
     * Generate the forwarding letter as a separate PDF. The letter is rendered
     * inside the BITAC letterhead exactly like the quotation, so the customer
     * receives two consistent documents.
     */
    public function exportForwardingLetterPdf(Request $request, Quotation $quotation)
    {
        $body = trim((string) $quotation->forwarding_letter);
        abort_unless($body !== '', 404, 'No forwarding letter on this quotation.');

        // Eager-load approvals so the signer block below can render the
        // final approver's identity (signature, designation, center).
        $quotation->load(['createdBy.center', 'approvals.approver.center']);

        $esc = fn($v) => htmlspecialchars((string) ($v ?? ''), ENT_QUOTES | ENT_HTML5, 'UTF-8');
        $subject = $esc($quotation->forwarding_letter_subject ?? 'Quotation — Forwarding Letter');
        $recipient = nl2br($esc($quotation->recipient_block ?? ''));
        // The body is rich HTML from the editor — sanitise to a safe allow-list
        // so a copy-pasted <script> can never make it into the rendered PDF.
        // Legacy plain-text letters still work: they're just escaped + nl2br'd
        // when no HTML tags are detected.
        $bodyHtml = (str_contains($body, '<') && str_contains($body, '>'))
            ? $this->sanitizeLetterHtml($body)
            : nl2br($esc($body));
        $issued = ($quotation->memo_date ?? $quotation->created_at)->format('d/m/Y');
        // Customer's own reference takes precedence (this is the no. the
        // customer recognises); falls back to our memo no. so the slot is
        // never blank when one of them exists.
        $refNo = $esc($quotation->customer_ref_no ?: $quotation->memo_no ?: '');
        $quotationLabel = 'Q-' . str_pad((string) $quotation->id, 5, '0', STR_PAD_LEFT) . ' v' . $quotation->version;

        // Recipient block prefixed with "To," when present.
        $recipientHtml = trim((string) $quotation->recipient_block) !== ''
            ? '<div style="margin-bottom: 14pt; font-size: 11pt; color: #000;">'
              . '<div style="font-weight: bold; margin-bottom: 2pt;">To,</div>'
              . '<div style="line-height: 1.4;">' . $recipient . '</div>'
              . '</div>'
            : '';

        // ─── Signer = the final approver in the chain (highest level).
        // We pick the highest-level row regardless of its status so the
        // letter always shows the *expected* signatory. The signature
        // image is only embedded once that row has actually been
        // approved (handled further down).
        $finalApprovalRow = $quotation->approvals->sortByDesc('level')->first();
        $isFinalApproved  = $finalApprovalRow && $finalApprovalRow->status === 'approved';
        $signer = $finalApprovalRow?->approver ?? $quotation->createdBy;
        $signerSigPath = $isFinalApproved
            ? ($finalApprovalRow->signatureAbsolutePath() ?? $signer?->signatureAbsolutePath())
            : null;

        $signerName        = $esc($signer?->name ?? '');
        $signerDesignation = $esc($signer?->designation ?? '');
        // Center name comes from the signer's own center first, then the
        // document's center, with a sensible default so the line never
        // prints empty.
        $signerCenterRaw   = $signer?->center?->name
                          ?? \App\Models\Center::find(
                                $quotation->center_id
                                ?? session('active_center_id')
                                ?? auth()->user()?->center_id
                                ?? 1
                             )?->name
                          ?? 'BITAC, Dhaka';
        $signerCenter      = $esc($signerCenterRaw);
        $signerEmail       = $esc($signer?->email ?? '');
        $signerPhone       = $esc($signer?->phone ?? '');

        // Only embed the signature image after final approval — otherwise
        // leave the slot blank for a handwritten signature.
        $signatureImgHtml = ($isFinalApproved && $signerSigPath && is_file($signerSigPath))
            ? '<img src="' . $signerSigPath . '" style="height: 36pt; max-width: 160pt;" alt="signature" />'
            : '<div style="height: 36pt;"></div>';

        // Contact line — only emit non-empty parts so we don't get stray bullets.
        $contactParts = [];
        if ($signerEmail !== '') $contactParts[] = 'Email: ' . $signerEmail;
        if ($signerPhone !== '') $contactParts[] = 'Phone: ' . $signerPhone;
        $contactLine = implode(' &nbsp;|&nbsp; ', $contactParts);

        // ── BITAC official letter layout (Bangla + English) ────────────────
        $lang = $request->query('lang') === 'en' ? 'en' : 'bn';

        // Memo No. — re-quotations carry the revision number at the end.
        $memoFwd = (string) ($quotation->memo_no ?? '');
        if ($quotation->version > 1) {
            $memoFwd = rtrim($memoFwd) . '(' . $quotation->version . ')';
        }

        $html = app(\App\Services\OfficialLetterRenderer::class)->buildHtml([
            'memoNo'            => $memoFwd,
            'issued'            => $issued,
            'subject'           => $quotation->forwarding_letter_subject ?? 'Quotation — Forwarding Letter',
            'custRefNo'         => $quotation->customer_ref_no,
            'custRefDate'       => $quotation->customer_ref_date?->format('d/m/Y'),
            'recipientBlock'    => $quotation->recipient_block,
            'bodyHtml'          => $bodyHtml,
            'signerName'        => $signer?->name,
            'signerDesignation' => $signer?->designation,
            'signerCenter'      => $signerCenterRaw,
            'signerEmail'       => $signer?->email,
            'signerPhone'       => $signer?->phone,
            'signatureImgHtml'  => $signatureImgHtml,
        ], $lang);

        $bytes = app(\App\Services\BitacLetterhead::class)->render($html, "Forwarding Letter {$quotationLabel}", null, $lang);
        $filename = "forwarding-letter-{$quotationLabel}" . ($lang === 'en' ? '-EN' : '') . '.pdf';

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

    /**
     * Email the quotation (and, optionally, its forwarding letter) to the
     * customer as PDF attachments. Reuses the existing PDF generators.
     */
    public function emailToCustomer(Request $request, Quotation $quotation)
    {
        $validated = $request->validate([
            'email'              => 'nullable|email',
            'cc'                 => 'nullable|string|max:1000',
            'from_email'         => 'nullable|email',
            'subject'            => 'required|string|max:255',
            'message'            => 'nullable|string|max:5000',
            'lang'               => 'nullable|in:bn,en',
            'include_forwarding' => 'nullable|boolean',
        ]);

        $quotation->loadMissing('customer', 'rfq.customer');
        $customer = $quotation->customer ?? $quotation->rfq?->customer;
        $to = $validated['email'] ?? $customer?->email;
        if (!$to) {
            return back()->with('error', 'No customer email on file. Add one to the customer, or provide an email address.');
        }

        $lang = ($validated['lang'] ?? 'bn') === 'en' ? 'en' : 'bn';

        // CC — comma/semicolon separated; keep only valid addresses.
        $ccList = collect(preg_split('/[,;]+/', (string) ($validated['cc'] ?? '')))
            ->map(fn ($e) => trim($e))
            ->filter(fn ($e) => $e !== '' && filter_var($e, FILTER_VALIDATE_EMAIL))
            ->unique()->values()->all();

        $fromEmail = $validated['from_email'] ?? auth()->user()?->email;
        $fromName  = auth()->user()?->name;

        // Build attachments by reusing the existing PDF generators (base64 path).
        $grab = fn ($resp) => base64_decode(json_decode($resp->getContent(), true)['data'] ?? '');
        $qNo  = 'Q-' . str_pad((string) $quotation->id, 5, '0', STR_PAD_LEFT);

        $files = [[
            'data' => $grab($this->pdf(new \Illuminate\Http\Request(['preview' => 'base64']), $quotation)),
            'name' => "Quotation-{$qNo}.pdf",
        ]];

        $includeFwd = $request->boolean('include_forwarding', true);
        $hasFwd = trim((string) $quotation->forwarding_letter) !== '';
        if ($includeFwd && $hasFwd) {
            $files[] = [
                'data' => $grab($this->exportForwardingLetterPdf(new \Illuminate\Http\Request(['preview' => 'base64', 'lang' => $lang]), $quotation)),
                'name' => "Forwarding-Letter-{$qNo}.pdf",
            ];
        }

        // Compose the email body — rich-text HTML, sanitised; fall back to default.
        $message = trim((string) ($validated['message'] ?? ''));
        if (trim(strip_tags($message)) === '') {
            $name = $customer?->contact_person ?? $customer?->name ?? 'Sir/Madam';
            $message = '<p>Dear ' . e($name) . ',</p>'
                . '<p>Please find attached our quotation ' . $qNo
                . ($includeFwd && $hasFwd ? ' along with the forwarding letter' : '')
                . ' for your kind consideration.</p>'
                . '<p>Best regards,<br>Bangladesh Industrial Technical Assistance Centre (BITAC)</p>';
        }
        $messageHtml = $this->sanitizeLetterHtml($message);

        try {
            \Illuminate\Support\Facades\Mail::send(new \App\Mail\DocumentMail(
                toEmail: $to,
                subjectLine: $validated['subject'],
                messageHtml: $messageHtml,
                files: $files,
                ccList: $ccList,
                fromEmail: $fromEmail,
                fromName: $fromName,
            ));
        } catch (\Throwable $e) {
            \Log::error('Quotation email failed: ' . $e->getMessage());
            return back()->with('error', 'Could not send email: ' . $e->getMessage());
        }

        return back()->with('success', "Quotation emailed to {$to}.");
    }

    /**
     * Allow-list HTML sanitiser for the forwarding-letter rich-text body.
     * Strips everything except the formatting tags the editor can emit, drops
     * any `on*=` event handlers and `javascript:` URLs, and removes <script>
     * blocks wholesale so paste-bombs can't smuggle code into the PDF.
     */
    private function sanitizeLetterHtml(string $html): string
    {
        // Hard-strip script/style blocks and all event handlers / javascript: URLs.
        $html = preg_replace('#<\s*(script|style|iframe|object|embed)\b[^>]*>.*?<\s*/\s*\1\s*>#is', '', $html);
        $html = preg_replace('#\son[a-z]+\s*=\s*"[^"]*"#i', '', $html);
        $html = preg_replace("#\son[a-z]+\s*=\s*'[^']*'#i", '', $html);
        $html = preg_replace('#javascript\s*:#i', '', $html);

        // Allow a small set of formatting tags — anything else is dropped.
        $allowed = '<p><br><b><strong><i><em><u><s><strike><ul><ol><li><div><span>';
        return strip_tags($html, $allowed);
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
        // For re-quotations, the revision number rides at the END of the Memo No.
        // (e.g. "…028.51.(2)") instead of in the title.
        if ($quotation->version > 1) {
            $memoNo = rtrim($memoNo) . '(' . $quotation->version . ')';
        }
        $custRefNo  = $quotation->customer_ref_no ?? '';
        $custRefDt  = $quotation->customer_ref_date?->format('d/m/Y') ?? '';
        $recipient  = $quotation->recipient_block ?? '';
        // Preparer-controlled memo date when present; falls back to created_at
        // so older quotations (saved before this field existed) still print a
        // date.
        $issuedDate = ($quotation->memo_date ?? $quotation->created_at)->format('d/m/Y');

        // ─────────────────────────────────────────────────────────────────────
        // Memo block — English labels only ("Memo No.", "Date").
        $memoBlock = '<table width="100%" cellspacing="0" cellpadding="0" style="margin-bottom: 14pt;">'
            . '<tr>'
            .   '<td style="font-size: 11pt; color: #000;">'
            .     '<b>Memo No.</b> - '
            .     '<span style="font-family: dejavusansmono;">' . $esc($memoNo) . '</span>'
            .   '</td>'
            .   '<td style="font-size: 11pt; color: #000; text-align: right;">'
            .     '<b>Date:</b> ' . $esc($issuedDate)
            .   '</td>'
            . '</tr>'
            . '</table>';

        // ─────────────────────────────────────────────────────────────────────
        // Title — English-only. Revisions read "RE-QUOTATION" (the revision
        // number is carried at the end of the Memo No., not in the title).
        $isRevision = $quotation->version > 1;
        $titleEn    = $isRevision ? 'RE-QUOTATION' : 'QUOTATION';
        $titleBlock = '<div style="text-align: center; margin-bottom: 14pt;">'
            . '<div style="font-size: 14pt; font-weight: bold; color: #000; letter-spacing: 0.3pt;">' . $titleEn . '</div>'
            . '</div>';

        // ─────────────────────────────────────────────────────────────────────
        // Recipient (left) + Customer Ref (right) — plain two-column block.
        // "To," salutation is printed above the recipient address block as
        // per BITAC official letter convention.
        $recipientHtml = trim($recipient) !== ''
            ? '<div style="font-size: 11pt; color: #000; font-weight: bold; margin-bottom: 2pt;">To,</div>'
              . '<div style="font-size: 11pt; color: #000; line-height: 1.4;">' . nl2br($esc($recipient), false) . '</div>'
            : '';
        $addressBlock = '<table width="100%" cellspacing="0" cellpadding="0" style="margin-bottom: 8pt;">'
            . '<tr>'
            .   '<td width="55%" style="vertical-align: top; padding-right: 12pt;">'
            .     $recipientHtml
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
        // Header row — English only
        $itemsHtml .= '<tr>';
        $itemsHtml .=   '<th style="border: 0.75pt solid #000; padding: 4pt 2pt; font-size: 9.5pt; font-weight: bold; text-align: center; vertical-align: middle;">Sl. No</th>';
        $itemsHtml .=   '<th style="border: 0.75pt solid #000; padding: 4pt; font-size: 9.5pt; font-weight: bold; text-align: center; vertical-align: middle;">Description of Works</th>';
        $itemsHtml .=   '<th style="border: 0.75pt solid #000; padding: 4pt 2pt; font-size: 9.5pt; font-weight: bold; text-align: center; vertical-align: middle;">Quantity</th>';
        $itemsHtml .=   '<th style="border: 0.75pt solid #000; padding: 4pt 2pt; font-size: 9.5pt; font-weight: bold; text-align: center; vertical-align: middle;">Unit</th>';
        $itemsHtml .=   '<th style="border: 0.75pt solid #000; padding: 4pt 2pt; font-size: 9.5pt; font-weight: bold; text-align: center; vertical-align: middle;">Unit Price</th>';
        $itemsHtml .=   '<th style="border: 0.75pt solid #000; padding: 4pt 2pt; font-size: 9.5pt; font-weight: bold; text-align: center; vertical-align: middle;">Total Price</th>';
        $itemsHtml .= '</tr>';

        $vatAmount = (float) ($quotation->vat_amount ?? 0);
        $taxAmount = (float) ($quotation->tax_amount ?? 0);
        $vatRate   = (float) ($quotation->vat_rate ?? 0);
        $taxRate   = (float) ($quotation->tax_rate ?? 0);
        $discAmount = (float) ($quotation->discount ?? 0);
        $discType   = $quotation->discount_type ?? null;
        $hasTax = ($vatAmount > 0 || $taxAmount > 0);
        $showBreakdown = (bool) $quotation->show_tax_breakdown && $hasTax;
        // In breakdown mode the line items are shown EX-VAT/Tax so they reconcile
        // with the additive Subtotal + VAT + Tax = Grand Total layout. The unit
        // prices are stored VAT/Tax-inclusive, so divide out the combined rate.
        $taxFactor = 1 + ($vatRate + $taxRate) / 100;
        $exUnit = fn($v) => $showBreakdown && $taxFactor > 0 ? (float) $v / $taxFactor : (float) $v;

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
                $itemsHtml .=   '<td style="border: 0.75pt solid #000; padding: 6pt 4pt; font-size: 10pt; text-align: right; vertical-align: middle; white-space: nowrap;">' . $fmt($exUnit($li->unit_price)) . '</td>';
                $itemsHtml .=   '<td style="border: 0.75pt solid #000; padding: 6pt 4pt; font-size: 10pt; text-align: right; vertical-align: middle; white-space: nowrap;">' . $fmt($exUnit($li->amount)) . '</td>';
                $itemsHtml .= '</tr>';
            }
        }

        // Bottom rows INSIDE the items table — Subtotal, VAT, Tax, Grand Total.
        // Subtotal = grand total less the embedded VAT/Tax (and add back discount),
        // so Subtotal + VAT + Tax − Discount reconciles to the Grand Total exactly.
        $subtotal  = (float) $total - $vatAmount - $taxAmount + $discAmount;

        $sumRow = function (string $label, string $value, bool $bold = false) {
            $w = $bold ? 'font-weight: bold;' : '';
            return '<tr>'
                .   '<td colspan="5" style="border: 0.75pt solid #000; padding: 5pt 8pt; font-size: 10pt; text-align: right; vertical-align: middle; ' . $w . '">' . $label . '</td>'
                .   '<td style="border: 0.75pt solid #000; padding: 5pt 4pt; font-size: 10pt; text-align: right; vertical-align: middle; white-space: nowrap; ' . $w . '">' . $value . '</td>'
                . '</tr>';
        };

        $rateLbl = fn($r) => rtrim(rtrim(number_format($r, 2, '.', ''), '0'), '.');

        if ($showBreakdown) {
            // Standard tax invoice: ex-tax Subtotal, then VAT + Tax = Grand Total.
            $itemsHtml .= $sumRow('Subtotal', $fmt($subtotal));
            if ($vatAmount > 0) {
                $itemsHtml .= $sumRow('VAT (' . $rateLbl($vatRate) . '%)', '+ ' . $fmt($vatAmount));
            }
            if ($taxAmount > 0) {
                $itemsHtml .= $sumRow('Tax (' . $rateLbl($taxRate) . '%)', '+ ' . $fmt($taxAmount));
            }
            if ($discAmount > 0) {
                $itemsHtml .= $sumRow('Discount', '− ' . $fmt($discAmount));
            }
            $itemsHtml .= $sumRow('Grand Total', $fmt($total), true);
        } else {
            // All-inclusive unit prices — Grand Total reads "(incl. VAT & Tax)".
            if ($discAmount > 0) {
                $itemsHtml .= $sumRow('Subtotal', $fmt((float) $total + $discAmount));
                $itemsHtml .= $sumRow('Discount', '− ' . $fmt($discAmount));
            }
            $grandLabel = $hasTax ? 'Grand Total (incl. VAT &amp; Tax)' : 'Grand Total';
            $itemsHtml .= $sumRow($grandLabel, $fmt($total), true);
        }
        $itemsHtml .= '</table>';

        // Amount in words — sits just below the items table, left-aligned.
        $itemsHtml .= '<div style="margin-top: 6pt; font-size: 10pt; color: #000;">'
            . '<b>Amount in Words:</b> ' . $esc($totalWords)
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
        // Only show a signature image when the quotation has actually been
        // approved — `$finalApproval` is non-null only after sign-off. For
        // unapproved/pending quotations we deliberately do NOT fall back to
        // the preparer's profile signature, otherwise an unapproved PDF
        // would look as if it had been signed.
        $sigPath = $finalApproval
            ? ($finalApproval->signatureAbsolutePath() ?? $finalApproval->approver?->signatureAbsolutePath())
            : null;

        // Signature image — only render if approval exists; otherwise leave blank space.
        $signatureImg = $sigPath
            ? '<img src="' . $sigPath . '" style="height: 50pt; max-width: 160pt;" alt="signature" />'
            : '<div style="height: 36pt;"></div>';

        $signatureBlock = '<table width="100%" cellspacing="0" cellpadding="0" style="margin-top: 24pt;">'
            . '<tr>'
            .   '<td width="55%"></td>'
            .   '<td width="45%" style="font-size: 11pt; color: #000; line-height: 1.5;">'
            .     '<div>' . $signatureImg . '</div>'
            .     '<div style="color: #a349a4;">(' . $esc($signerName) . ')</div>'
            .     '<div style="color: #a349a4;">' . $esc($signerDesignation) . '</div>'
            .     '<div style="color: #a349a4;">' . $esc($signerCenter) . '</div>';
        if ($signerEmail) {
            $signatureBlock .= '<div style="margin-top: 2pt; color: #a349a4;"><b>Email:</b> '
                . '<u>' . $esc($signerEmail) . '</u></div>';
        }
        if ($signerPhone) {
            $signatureBlock .= '<div style="color: #a349a4;"><b>Phone:</b> ' . $esc($signerPhone) . '</div>';
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
    /** Statuses a quotation can be revised from. */
    private const REVISABLE_STATUSES = [
        'approved',           // approved but the price is being reworked before/after sending
        'sent_to_customer',   // already with the customer — they asked for a better price
        'revision_requested', // customer response formally recorded as a revision request
        'customer_rejected',  // rejected on price; re-offer at a new one
    ];

    /**
     * Start a new version of a quotation.
     *
     * The common case is the customer asking for a lower price after the
     * quotation has been approved and sent. The revision is a fresh DRAFT
     * that carries EVERYTHING across — line items, terms, the forwarding
     * letter, the tax configuration — so the preparer only changes the
     * price and resubmits, rather than rebuilding the document.
     *
     * The parent is superseded, and the new version goes through approval
     * again on its own merits.
     */
    public function createRevision(Quotation $quotation)
    {
        if (! in_array($quotation->status, self::REVISABLE_STATUSES, true)) {
            return redirect()->route('quotations.show', $quotation)->with(
                'error',
                "A quotation cannot be revised while it is \"{$quotation->status}\"."
            );
        }

        $quotation->load('items');

        $newQuotation = DB::transaction(function () use ($quotation) {
            $copy = Quotation::create([
                'rfq_id'              => $quotation->rfq_id,
                'customer_id'         => $quotation->customer_id,
                'job_category_id'     => $quotation->job_category_id,
                'parent_quotation_id' => $quotation->id,
                'version'             => $this->quotationService->getNextVersion($quotation->rfq_id),
                'material_cost'       => $quotation->material_cost,
                'labour_cost'         => $quotation->labour_cost,
                'overhead_cost'       => $quotation->overhead_cost,
                'profit_margin'       => $quotation->profit_margin,
                'discount'            => $quotation->discount,
                'discount_type'       => $quotation->discount_type,
                'vat_rate'            => $quotation->vat_rate,
                'vat_amount'          => $quotation->vat_amount,
                // Tax config travels with the revision — losing it would
                // silently change what the printed price means.
                'tax_rate'            => $quotation->tax_rate,
                'tax_amount'          => $quotation->tax_amount,
                'show_tax_breakdown'  => (bool) $quotation->show_tax_breakdown,
                'total_amount'        => $quotation->total_amount,
                'validity_days'       => $quotation->validity_days,
                'notes'               => $quotation->notes,
                'terms'               => $quotation->terms,
                'forwarding_letter'         => $quotation->forwarding_letter,
                'forwarding_letter_subject' => $quotation->forwarding_letter_subject,
                'recipient_block'     => $quotation->recipient_block,
                // The memo number is reused verbatim; the PDF appends the
                // revision number to it (…028.51(2)) from `version`.
                'memo_no'             => $quotation->memo_no,
                // Left blank on purpose so the re-quotation carries its own
                // date rather than reprinting the original's.
                'memo_date'           => null,
                'customer_ref_no'     => $quotation->customer_ref_no,
                'customer_ref_date'   => $quotation->customer_ref_date,
                'status'              => 'draft',
                'created_by'          => auth()->id(),
            ]);

            // Without these the revision opens empty and the whole quotation
            // has to be retyped.
            foreach ($quotation->items as $item) {
                $copy->items()->create([
                    'description' => $item->description,
                    'quantity'    => $item->quantity,
                    'unit_price'  => $item->unit_price,
                    'amount'      => $item->amount,
                ]);
            }

            // Mark the parent as superseded
            $quotation->update(['status' => 'superseded']);

            return $copy;
        });

        return redirect()->route('quotations.edit', $newQuotation)
            ->with('success', "Revision v{$newQuotation->version} created with the previous figures. Adjust the price and submit for approval.");
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

        $quotation->load('rfq.items.product', 'items');
        $rfq       = $quotation->rfq;
        $rfqItems  = $rfq?->items ?? collect();
        $firstItem = $rfqItems->first();
        $woNumber  = $this->workOrderService->generateWoNumber();
        // Job number is provisioned by PCD when IED forwards the WO. Leaving
        // it null at creation prevents the IED stage from showing a number
        // that hasn't actually been allocated yet.

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
            'job_number'      => null,
            'quantity'        => $rfqItems->sum('quantity') ?: 1,
            // Lands in the IED inbox first — an IED officer reviews and
            // forwards to PCD. PCD handoff timestamps stay null until then.
            'status'          => 'ied_pending',
            'priority'        => $request->input('priority', 'normal'),
            'due_date'        => $request->input('due_date'),
            'notes'           => $request->input('notes'),
            'customer_po_no'  => $request->input('customer_po_no') ?? $quotation->customer_po_no,
            'created_by'      => auth()->id(),
            'pcd_handoff_at'  => null,
            'pcd_handoff_by'  => null,
        ]);

        // ── Per-item rows (one work_order_items row per RFQ item) ─────────
        // Job numbers are stamped during IED → PCD handoff (see
        // IedWorkOrderInboxController::accept). They start null here.
        $quotationItemMap = $quotation->items->values();
        foreach ($rfqItems->values() as $idx => $rItem) {
            \App\Models\WorkOrderItem::create([
                'work_order_id'     => $workOrder->id,
                'job_number'        => null,
                'product_id'        => $rItem->product_id,
                'rfq_item_id'       => $rItem->id,
                'quotation_item_id' => $quotationItemMap[$idx]->id ?? null,
                'description'       => $rItem->job_description ?: ($rItem->product?->name),
                'quantity'          => $rItem->quantity,
                'unit'              => $rItem->unit ?: 'pcs',
                'status'            => 'pending',
                'display_order'     => $idx + 1,
                'notes'             => $rItem->notes,
            ]);
        }

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

        // Notify IED officers — they're the gate before PCD now.
        NotifyService::toPermission(
            'view rfqs',
            'work_order_pending_ied_review',
            'New Work Order — IED review required',
            "WO {$woNumber} from Quotation #{$quotation->id} ({$quotation->customer?->name}) is awaiting IED acceptance.",
            "/ied/work-orders/{$workOrder->id}",
            'fi-rr-paper-plane',
            'brand',
        );

        return redirect()
            ->route('ied.work-orders.show', $workOrder)
            ->with('success', "Work Order {$woNumber} created and queued for IED review. A job number will be assigned when it's forwarded to PCD.");
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
