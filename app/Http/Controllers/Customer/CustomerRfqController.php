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

        $rfq->load(['items.product', 'items.drawings', 'items.samplePhotos', 'quotations', 'latestQuotation']);

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
                    'status'       => $rfq->latestQuotation->status,
                    'created_at'   => $rfq->latestQuotation->created_at->format('d M Y'),
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
}
