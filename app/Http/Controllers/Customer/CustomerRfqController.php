<?php

namespace App\Http\Controllers\Customer;

use App\Http\Controllers\Controller;
use App\Models\Product;
use App\Models\Rfq;
use App\Services\NotifyService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;

/**
 * Customer-side RFQ flow. Customer logs in to the portal, submits an RFQ,
 * and tracks it through to a quotation. IED reviews it from the existing
 * /rfqs inbox — the only difference is `source = customer_portal` so IED
 * can tell at a glance who submitted.
 */
class CustomerRfqController extends Controller
{
    public function index()
    {
        $customer = auth('customer')->user();

        $rfqs = Rfq::where('customer_id', $customer->id)
            ->with(['items.product', 'latestQuotation'])
            ->latest('id')
            ->paginate(15)
            ->through(fn ($r) => [
                'id'              => $r->id,
                'customer_ref_no' => $r->customer_ref_no,
                'status'          => $r->status,
                'item_count'      => $r->items->count(),
                'items_summary'   => $r->items->take(3)->map(fn ($i) => $i->job_description ?? $i->product?->name ?? 'Item')->all(),
                'required_by'     => $r->required_by?->format('d M Y'),
                'created_at'      => $r->created_at->format('d M Y'),
                'has_quotation'   => $r->latestQuotation !== null,
                'quotation_id'    => $r->latestQuotation?->id,
            ]);

        return Inertia::render('Customer/Rfqs/Index', [
            'rfqs' => $rfqs,
        ]);
    }

    public function create()
    {
        return Inertia::render('Customer/Rfqs/Create', [
            // Optional product catalog — customer can pick from existing BITAC
            // products if relevant, otherwise free-text description.
            'products' => Product::orderBy('name')->get(['id', 'name', 'code', 'unit']),
        ]);
    }

    public function store(Request $request)
    {
        $customer = auth('customer')->user();

        $validated = $request->validate([
            'customer_ref_no'          => 'nullable|string|max:100',
            'required_by'              => 'nullable|date|after_or_equal:today',
            'notes'                    => 'nullable|string|max:1000',
            'rfq_letter'               => 'nullable|file|mimes:pdf,jpg,jpeg,png,doc,docx|max:10240',
            'items'                    => 'required|array|min:1',
            'items.*.job_description'  => 'nullable|string|max:500',
            'items.*.product_id'       => 'nullable|exists:products,id',
            'items.*.quantity'         => 'required|numeric|min:0.01',
            'items.*.unit'             => 'nullable|string|max:20',
            'items.*.notes'            => 'nullable|string|max:500',
            'items.*.reference_type'   => 'nullable|in:none,drawing,physical_sample,both',
            'items.*.sample_description' => 'nullable|string|max:1000',
            'items.*.drawings'         => 'nullable|array',
            'items.*.drawings.*'       => 'file|mimes:pdf,jpg,jpeg,png,dwg,dxf|max:10240',
            'items.*.sample_photos'    => 'nullable|array',
            'items.*.sample_photos.*'  => 'file|mimes:jpg,jpeg,png,webp|max:5120',
        ]);

        // Each item must have product OR job_description so IED can identify it.
        foreach ($validated['items'] as $idx => $item) {
            if (empty($item['product_id']) && empty($item['job_description'])) {
                return back()->withErrors(["items.{$idx}.job_description" => 'Please describe the part or pick a product.'])->withInput();
            }
        }

        $rfq = DB::transaction(function () use ($validated, $customer, $request) {
            $rfq = Rfq::create([
                'customer_id'      => $customer->id,
                'center_id'        => $customer->center_id,
                'customer_ref_no'  => $validated['customer_ref_no'] ?? null,
                'required_by'      => $validated['required_by'] ?? null,
                'notes'            => $validated['notes'] ?? null,
                'job_type'         => 'regular',
                'status'           => 'pending',
                'source'           => 'customer_portal',
                'created_by'       => null,
            ]);

            if ($request->hasFile('rfq_letter')) {
                $rfq->update([
                    'rfq_letter_path'  => $request->file('rfq_letter')->store("rfq-letters/{$rfq->id}", 'public'),
                    // Customer side auto-titles every uploaded letter as
                    // "RFQ letter" — keeps the field searchable on the staff
                    // side without making the customer type something.
                    'rfq_letter_title' => 'RFQ letter',
                ]);
            }

            foreach ($validated['items'] as $idx => $item) {
                $rfqItem = $rfq->items()->create([
                    'product_id'         => $item['product_id'] ?: null,
                    'job_description'    => $item['job_description'] ?? null,
                    'quantity'           => $item['quantity'],
                    'unit'               => $item['unit'] ?? 'pcs',
                    'notes'              => $item['notes'] ?? null,
                    'reference_type'     => $item['reference_type'] ?? 'none',
                    'sample_description' => $item['sample_description'] ?? null,
                ]);

                // Drawings
                if ($request->hasFile("items.{$idx}.drawings")) {
                    foreach ($request->file("items.{$idx}.drawings") as $i => $file) {
                        $path = $file->store("rfq-items/{$rfqItem->id}", 'public');
                        $rfqItem->files()->create([
                            'type'          => 'drawing',
                            'stored_path'   => $path,
                            'original_name' => $file->getClientOriginalName(),
                            'mime_type'     => $file->getMimeType(),
                            'size_bytes'    => $file->getSize(),
                            'sort_order'    => $i,
                        ]);
                    }
                }

                // Sample photos
                if ($request->hasFile("items.{$idx}.sample_photos")) {
                    foreach ($request->file("items.{$idx}.sample_photos") as $i => $file) {
                        $path = $file->store("rfq-items/{$rfqItem->id}", 'public');
                        $rfqItem->files()->create([
                            'type'          => 'sample_photo',
                            'stored_path'   => $path,
                            'original_name' => $file->getClientOriginalName(),
                            'mime_type'     => $file->getMimeType(),
                            'size_bytes'    => $file->getSize(),
                            'sort_order'    => $i,
                        ]);
                    }
                }
            }

            return $rfq;
        });

        // Notify everyone with the 'view rfqs' permission (IED inbox).
        // NotifyService::toPermission internally tolerates a missing permission
        // row and logs a warning. We don't wrap with a swallowing try/catch so
        // any real failure surfaces in laravel.log.
        $recipientCount = \App\Models\User::permission('view rfqs')->count();
        \Log::info("Customer RFQ #{$rfq->id} submitted by {$customer->name} — fanning out to {$recipientCount} staff");

        NotifyService::toPermission(
            'view rfqs',
            'customer_rfq_submitted',
            'New customer RFQ',
            "{$customer->name} submitted an RFQ with " . count($validated['items']) . ' item(s)',
            "/rfqs/{$rfq->id}",
            'fi-rr-file-invoice',
            'purple',
        );

        return redirect()->route('customer.rfqs.show', $rfq)
            ->with('success', 'RFQ submitted. BITAC IED will review and send you a quotation.');
    }

    public function show(Rfq $rfq)
    {
        $customer = auth('customer')->user();
        abort_unless($rfq->customer_id === $customer->id, 403);

        $rfq->load(['items.product', 'items.drawings', 'items.samplePhotos', 'quotations', 'latestQuotation.workOrder']);

        // Latest Work Order issued against this RFQ (via the quotation) — used
        // by the customer-facing card so they can track production progress.
        $workOrder = $rfq->latestQuotation?->workOrder;

        return Inertia::render('Customer/Rfqs/Show', [
            'rfq' => [
                'id'              => $rfq->id,
                'customer_ref_no' => $rfq->customer_ref_no,
                'status'          => $rfq->status,
                'required_by'     => $rfq->required_by?->format('d M Y'),
                'created_at'      => $rfq->created_at->format('d M Y, h:i A'),
                'notes'           => $rfq->notes,
                'can_cancel'      => $rfq->status === 'pending',
                'items'           => $rfq->items->map(fn ($i) => [
                    'id'               => $i->id,
                    'product'          => $i->product?->name,
                    'job_description'  => $i->job_description,
                    'quantity'         => $i->quantity,
                    'unit'             => $i->unit,
                    'notes'            => $i->notes,
                    'reference_type'   => $i->reference_type,
                    'sample_description' => $i->sample_description,
                    'drawings'         => $i->drawings->map(fn ($f) => [
                        'id'       => $f->id,
                        'url'      => $f->url,
                        'filename' => $f->original_name,
                    ])->values(),
                    'sample_photos'    => $i->samplePhotos->map(fn ($f) => [
                        'id'       => $f->id,
                        'url'      => $f->url,
                        'filename' => $f->original_name,
                    ])->values(),
                ])->values(),
                'latest_quotation' => $rfq->latestQuotation ? [
                    'id'           => $rfq->latestQuotation->id,
                    'version'      => $rfq->latestQuotation->version,
                    'total_amount' => (float) $rfq->latestQuotation->total_amount,
                    'vat_rate'     => (float) $rfq->latestQuotation->vat_rate,
                    'vat_amount'   => (float) $rfq->latestQuotation->vat_amount,
                    'tax_rate'     => (float) $rfq->latestQuotation->tax_rate,
                    'tax_amount'   => (float) $rfq->latestQuotation->tax_amount,
                    'discount'     => (float) ($rfq->latestQuotation->discount ?? 0),
                    'status'       => $rfq->latestQuotation->status,
                    'created_at'   => $rfq->latestQuotation->created_at->format('d M Y'),
                    'has_forwarding_letter' => !empty(trim((string) $rfq->latestQuotation->forwarding_letter)),
                    // Whether the customer can self-issue a Work Order against
                    // this quotation. Mirrors the staff `convertToWorkOrder` gate.
                    'can_issue_work_order' => in_array($rfq->latestQuotation->status, ['approved', 'sent_to_customer', 'customer_accepted'])
                                            && $rfq->latestQuotation->workOrder === null,
                ] : null,
                'work_order' => $workOrder ? [
                    'id'           => $workOrder->id,
                    'wo_number'    => $workOrder->wo_number,
                    'status'       => $workOrder->status,
                    'status_label' => $workOrder->status_label,
                    'status_color' => $workOrder->status_color,
                    'priority'     => $workOrder->priority,
                    'due_date'     => $workOrder->due_date?->format('d M Y'),
                    'progress_pct' => $workOrder->production_progress,
                    'created_at'   => $workOrder->created_at->format('d M Y'),
                ] : null,
            ],
        ]);
    }

    public function cancel(Rfq $rfq)
    {
        $customer = auth('customer')->user();
        abort_unless($rfq->customer_id === $customer->id, 403);
        abort_unless($rfq->status === 'pending', 422,
            'You can only cancel an RFQ while it is still pending review.');

        $rfq->update(['status' => 'rejected']);

        return back()->with('success', 'RFQ cancelled.');
    }

    /**
     * Customer-initiated Work Order issuance against an approved/sent quotation.
     * Mirrors the staff `convertToWorkOrder()` flow but:
     *  - hard-codes priority to "normal" (no UI for it on the customer side)
     *  - leaves created_by / pcd_handoff_by null (customer guard has no user id
     *    that the WO audit fields can reference safely)
     *  - authorises by RFQ ownership on the customer guard
     */
    public function issueWorkOrder(Request $request, Rfq $rfq)
    {
        $customer = auth('customer')->user();
        abort_unless($rfq->customer_id === $customer->id, 403);

        $validated = $request->validate([
            'customer_po_no'    => 'required|string|max:100',
            'due_date'          => 'required|date|after_or_equal:today',
            'notes'             => 'nullable|string|max:1000',
            'customer_po_file'  => 'required|file|mimes:pdf,jpg,jpeg,png,webp,doc,docx|max:10240',
        ], [
            'customer_po_no.required'   => 'Please enter your work order number.',
            'due_date.required'         => 'Please pick a required delivery date.',
            'due_date.after_or_equal'   => 'The delivery date cannot be in the past.',
            'customer_po_file.required' => 'Please attach your signed Customer Work Order document.',
        ]);

        $quotation = $rfq->latestQuotation;
        abort_unless($quotation, 422, 'No quotation has been issued against this RFQ yet.');
        abort_unless(
            in_array($quotation->status, ['approved', 'sent_to_customer', 'customer_accepted']),
            422,
            'This quotation is not yet ready to be issued as a work order.'
        );
        abort_if($quotation->workOrder, 422, 'A work order has already been issued against this quotation.');

        $quotation->load('rfq.items.product', 'items');
        $rfqItems  = $quotation->rfq?->items ?? collect();
        $firstItem = $rfqItems->first();

        $workOrderService = app(\App\Services\WorkOrderService::class);
        $woNumber  = $workOrderService->generateWoNumber();
        $bomId     = $firstItem?->product?->boms()->latest('id')->first()?->id;
        // Job number is assigned when PCD takes over the WO (i.e. when IED
        // forwards it). Leave null at creation so the IED stage doesn't
        // misleadingly show a job number that hasn't been provisioned yet.

        $workOrder = DB::transaction(function () use (
            $quotation, $rfq, $rfqItems, $firstItem, $woNumber, $bomId, $validated, $request
        ) {
            $wo = \App\Models\WorkOrder::create([
                'center_id'       => $quotation->center_id ?? $rfq->center_id ?? $rfq->customer?->center_id ?? 1,
                'quotation_id'    => $quotation->id,
                'rfq_id'          => $quotation->rfq_id,
                'customer_id'     => $quotation->customer_id,
                'job_category_id' => $quotation->job_category_id ?? $rfq->job_category_id,
                'product_id'      => $firstItem?->product_id,
                'bom_id'          => $bomId,
                'wo_number'       => $woNumber,
                'job_number'      => null,
                'quantity'        => $rfqItems->sum('quantity') ?: 1,
                // Lands in the IED inbox first — an IED officer reviews and
                // forwards to PCD. PCD handoff timestamps stay null until then.
                'status'          => 'ied_pending',
                'priority'        => 'normal', // customer-issued WOs always start at normal priority
                'due_date'        => $validated['due_date'] ?? null,
                'notes'           => $validated['notes'] ?? null,
                'customer_po_no'  => $validated['customer_po_no'] ?? $quotation->customer_po_no,
                'created_by'      => null,
                'pcd_handoff_at'  => null,
                'pcd_handoff_by'  => null,
            ]);

            // Per-item rows — same convention as the staff path.
            $quotationItemMap = $quotation->items->values();
            foreach ($rfqItems->values() as $idx => $rItem) {
                \App\Models\WorkOrderItem::create([
                    'work_order_id'     => $wo->id,
                    'job_number'        => null, // assigned later when PCD takes over
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

            // Customer-supplied PO/authorisation file — same audit trail as staff path.
            if ($request->hasFile('customer_po_file')) {
                $file   = $request->file('customer_po_file');
                $stored = $file->store("work-orders/{$wo->id}", 'public');
                $wo->files()->create([
                    'uploaded_by'   => null,
                    'kind'          => 'customer_po',
                    'stored_path'   => $stored,
                    'original_name' => $file->getClientOriginalName(),
                    // Default title — what IED/PCD see in the attachment list.
                    'title'         => 'Customer Work Order',
                    'mime_type'     => $file->getMimeType(),
                    'size_bytes'    => $file->getSize(),
                    'description'   => 'Customer Work Order uploaded with self-issued WO',
                ]);
            }

            $quotation->update(['status' => 'converted']);
            return $wo;
        });

        // Notify IED officers — they're the gate before PCD.
        NotifyService::toPermission(
            'view rfqs',
            'work_order_pending_ied_review',
            'New Work Order — IED review required',
            "WO {$woNumber} from {$customer->name} (RFQ #{$rfq->id}) is awaiting IED acceptance.",
            "/ied/work-orders/{$workOrder->id}",
            'fi-rr-paper-plane',
            'brand',
        );

        return back()->with('success', "Work Order {$woNumber} submitted. BITAC's IED team will review and forward it to production shortly.");
    }
}
