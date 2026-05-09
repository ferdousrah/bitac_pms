<?php

namespace App\Http\Controllers;

use App\Models\Customer;
use App\Models\Product;
use App\Models\Rfq;
use App\Models\RfqItem;
use App\Services\NotifyService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Inertia\Inertia;

class RfqController extends Controller
{
    public function index(Request $request)
    {
        $query = Rfq::with(['customer', 'items.product', 'createdBy', 'latestQuotation']);

        // Search
        if ($search = $request->input('search')) {
            $query->where(function ($q) use ($search) {
                $q->where('customer_ref_no', 'like', "%{$search}%")
                  ->orWhere('id', 'like', "%{$search}%")
                  ->orWhereHas('customer', fn($c) => $c->where('name', 'like', "%{$search}%"))
                  ->orWhereHas('items', fn($i) => $i->where('job_description', 'like', "%{$search}%"));
            });
        }

        // Filter by status
        if ($status = $request->input('status')) {
            $query->where('status', $status);
        }

        // Filter by customer
        if ($customerId = $request->input('customer_id')) {
            $query->where('customer_id', $customerId);
        }

        // Sorting
        $sort = $request->input('sort', 'id');
        $dir  = $request->input('dir', 'desc');
        $allowed = ['id', 'customer_id', 'required_by', 'status', 'created_at'];
        if (in_array($sort, $allowed)) {
            $query->orderBy($sort, $dir === 'asc' ? 'asc' : 'desc');
        } else {
            $query->latest();
        }

        $rfqs = $query->paginate(15)->withQueryString();

        return Inertia::render('RFQ/Index', [
            'rfqs' => $rfqs->through(fn($r) => [
                'id'              => $r->id,
                'customer'        => $r->customer?->name ?? '—',
                'customer_ref_no' => $r->customer_ref_no,
                'items_summary'   => $r->items->map(fn($i) => [
                    'description' => $i->job_description ?? $i->product?->name ?? '—',
                    'quantity'    => $i->quantity,
                    'unit'        => $i->unit,
                ])->toArray(),
                'item_count'      => $r->items->count(),
                'required_by'     => $r->required_by?->format('d/m/Y'),
                'status'          => $r->status,
                'created_by'      => $r->createdBy?->name ?? '—',
                'created_at'      => $r->created_at->format('d/m/Y'),
                'has_quotation'   => $r->latestQuotation !== null,
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

    public function create()
    {
        return Inertia::render('RFQ/Create', [
            'customers' => Customer::where('is_active', true)->get(['id', 'name']),
            'products'  => Product::orderBy('name')->get(['id', 'name', 'code', 'unit']),
        ]);
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'customer_id'        => 'required|exists:customers,id',
            'customer_ref_no'    => 'nullable|string|max:100',
            'required_by'        => 'nullable|date',
            'notes'              => 'nullable|string|max:1000',
            'items'              => 'required|array|min:1',
            'items.*.job_description' => 'nullable|string|max:500',
            'items.*.product_id'      => 'nullable|exists:products,id',
            'items.*.quantity'        => 'required|numeric|min:0.01',
            'items.*.unit'            => 'nullable|string|max:20',
            'items.*.notes'           => 'nullable|string|max:500',
            // Per-item reference material
            'items.*.reference_type'     => 'nullable|in:none,drawing,physical_sample,both',
            'items.*.sample_received'    => 'nullable|boolean',
            'items.*.sample_description' => 'nullable|string|max:1000',
            // Multiple drawings per item: fresh uploads + gallery picks
            'items.*.drawings'              => 'nullable|array',
            'items.*.drawings.*'            => 'file|mimes:pdf,jpg,jpeg,png,dwg,dxf|max:10240',
            'items.*.drawing_file_ids'      => 'nullable|array',
            'items.*.drawing_file_ids.*'    => 'exists:user_files,id',
            // Multiple sample photos per item
            'items.*.sample_photos'         => 'nullable|array',
            'items.*.sample_photos.*'       => 'file|mimes:jpg,jpeg,png,webp|max:5120',
            'items.*.sample_photo_file_ids' => 'nullable|array',
            'items.*.sample_photo_file_ids.*' => 'exists:user_files,id',
        ]);

        // Each item must have at least a job_description or product_id
        foreach ($validated['items'] as $idx => $item) {
            if (empty($item['product_id']) && empty($item['job_description'])) {
                return back()->withErrors(["items.{$idx}.job_description" => 'Enter a part description or select a product.'])->withInput();
            }
        }

        $rfq = DB::transaction(function () use ($validated, $request) {
            $rfq = Rfq::create([
                'customer_id'        => $validated['customer_id'],
                'customer_ref_no'    => $validated['customer_ref_no'] ?? null,
                'required_by'        => $validated['required_by'] ?? null,
                'notes'              => $validated['notes'] ?? null,
                'created_by'         => auth()->id(),
                'status'             => 'pending',
            ]);

            foreach ($validated['items'] as $idx => $item) {
                $rfqItem = $rfq->items()->create([
                    'product_id'         => $item['product_id'] ?: null,
                    'job_description'    => $item['job_description'] ?? null,
                    'quantity'           => $item['quantity'],
                    'unit'               => $item['unit'] ?? 'pcs',
                    'notes'              => $item['notes'] ?? null,
                    'reference_type'     => $item['reference_type'] ?? 'none',
                    'sample_received'    => !empty($item['sample_received']),
                    'sample_description' => $item['sample_description'] ?? null,
                ]);

                // Attach multiple drawings
                $this->attachItemFiles(
                    $rfqItem,
                    $request,
                    "items.{$idx}.drawings",
                    $item['drawing_file_ids'] ?? [],
                    'drawing'
                );
                // Attach multiple sample photos
                $this->attachItemFiles(
                    $rfqItem,
                    $request,
                    "items.{$idx}.sample_photos",
                    $item['sample_photo_file_ids'] ?? [],
                    'sample_photo'
                );

                // Keep first file path on rfq_items for backward compat
                $firstDrawing = $rfqItem->drawings()->first();
                $firstSample = $rfqItem->samplePhotos()->first();
                $rfqItem->update([
                    'drawing_path'      => $firstDrawing?->stored_path,
                    'sample_photo_path' => $firstSample?->stored_path,
                ]);
            }

            return $rfq;
        });

        // Dispatch RFQ automation events (auto-estimate + duplicate detection)
        \App\Events\RfqCreated::dispatch($rfq->load('items', 'customer'));

        // Notify users who can view quotations (PCD section)
        $customer = Customer::find($validated['customer_id']);
        NotifyService::toPermission(
            'view quotations',
            'rfq_created',
            'New RFQ Received',
            "From {$customer?->name} — " . count($validated['items']) . ' item(s)',
            '/rfqs',
            'fi-rr-file-invoice',
            'blue',
        );

        return redirect()->route('rfqs.index')->with('success', 'RFQ created successfully.');
    }

    public function show(Rfq $rfq)
    {
        $rfq->load(['customer', 'items.product', 'items.drawings', 'items.samplePhotos', 'items.costEstimates', 'createdBy', 'quotations']);

        return Inertia::render('RFQ/Show', [
            'rfq' => [
                'id'                 => $rfq->id,
                'status'             => $rfq->status,
                'created_at'         => $rfq->created_at->format('d M Y'),
                'created_by'         => $rfq->createdBy?->name,
                'customer'           => ['name' => $rfq->customer?->name ?? ''],
                'customer_ref_no'    => $rfq->customer_ref_no,
                'items'              => $rfq->items->map(fn($i) => [
                    'id'                 => $i->id,
                    'product'            => $i->product ? ['name' => $i->product->name, 'code' => $i->product->code, 'unit' => $i->product->unit] : null,
                    'job_description'    => $i->job_description,
                    'quantity'           => $i->quantity,
                    'unit'               => $i->unit,
                    'notes'              => $i->notes,
                    'reference_type'     => $i->reference_type ?? 'none',
                    'drawings'           => $i->drawings->map(fn($f) => [
                        'id'            => $f->id,
                        'url'           => $f->url,
                        'filename'      => $f->original_name,
                        'extension'     => pathinfo($f->original_name, PATHINFO_EXTENSION),
                    ]),
                    'sample_photos'      => $i->samplePhotos->map(fn($f) => [
                        'id'            => $f->id,
                        'url'           => $f->url,
                        'filename'      => $f->original_name,
                    ]),
                    'sample_received'    => (bool) $i->sample_received,
                    'sample_description' => $i->sample_description,
                    'cost_estimates'     => $i->costEstimates->map(fn($e) => [
                        'id'           => $e->id,
                        'estimate_no'  => $e->estimate_no,
                        'status'       => $e->status,
                        'grand_total'  => $e->grand_total,
                        'pricing_group'=> $e->pricing_group,
                    ]),
                ]),
                'required_by'        => $rfq->required_by?->format('d M Y'),
                'notes'              => $rfq->notes,
                'quotations'         => $rfq->quotations->map(fn($q) => [
                    'id'           => $q->id,
                    'version'      => $q->version,
                    'total_amount' => $q->total_amount,
                    'status'       => $q->status,
                ]),
                // Automation metadata
                'automation_source'  => $rfq->automation_source ?? 'manual',
                'duplicate_of_rfq_id'=> $rfq->duplicate_of_rfq_id,
                'auto_estimate'      => \App\Models\CostEstimate::where('rfq_id', $rfq->id)
                    ->where('automation_source', 'auto_estimated')
                    ->first()?->only(['id', 'estimate_no', 'confidence_score', 'grand_total', 'status']),
            ],
        ]);
    }

    public function edit(Rfq $rfq)
    {
        $rfq->load(['items.product', 'items.drawings', 'items.samplePhotos']);

        return Inertia::render('RFQ/Create', [
            'rfq' => [
                'id'                 => $rfq->id,
                'customer_id'        => $rfq->customer_id,
                'customer_ref_no'    => $rfq->customer_ref_no,
                'required_by'        => $rfq->required_by?->format('Y-m-d'),
                'notes'              => $rfq->notes,
                'items'              => $rfq->items->map(fn($i) => [
                    'product_id'         => $i->product_id,
                    'job_description'    => $i->job_description,
                    'quantity'           => $i->quantity,
                    'unit'               => $i->unit,
                    'notes'              => $i->notes,
                    'reference_type'     => $i->reference_type ?? 'none',
                    'existing_drawings'  => $i->drawings->map(fn($f) => [
                        'id'            => $f->id,
                        'user_file_id'  => $f->user_file_id,
                        'url'           => $f->url,
                        'filename'      => $f->original_name,
                    ]),
                    'existing_sample_photos' => $i->samplePhotos->map(fn($f) => [
                        'id'            => $f->id,
                        'user_file_id'  => $f->user_file_id,
                        'url'           => $f->url,
                        'filename'      => $f->original_name,
                    ]),
                    'sample_received'    => (bool) $i->sample_received,
                    'sample_description' => $i->sample_description,
                ]),
            ],
            'customers' => Customer::where('is_active', true)->get(['id', 'name']),
            'products'  => Product::orderBy('name')->get(['id', 'name', 'code', 'unit']),
        ]);
    }

    public function update(Request $request, Rfq $rfq)
    {
        $validated = $request->validate([
            'customer_id'        => 'required|exists:customers,id',
            'customer_ref_no'    => 'nullable|string|max:100',
            'required_by'        => 'nullable|date',
            'notes'              => 'nullable|string|max:1000',
            'items'              => 'required|array|min:1',
            'items.*.job_description' => 'nullable|string|max:500',
            'items.*.product_id'      => 'nullable|exists:products,id',
            'items.*.quantity'        => 'required|numeric|min:0.01',
            'items.*.unit'            => 'nullable|string|max:20',
            'items.*.notes'           => 'nullable|string|max:500',
            // Per-item reference material
            'items.*.reference_type'     => 'nullable|in:none,drawing,physical_sample,both',
            'items.*.sample_received'    => 'nullable|boolean',
            'items.*.sample_description' => 'nullable|string|max:1000',
            // Multiple drawings per item
            'items.*.drawings'              => 'nullable|array',
            'items.*.drawings.*'            => 'file|mimes:pdf,jpg,jpeg,png,dwg,dxf|max:10240',
            'items.*.drawing_file_ids'      => 'nullable|array',
            'items.*.drawing_file_ids.*'    => 'exists:user_files,id',
            // Multiple sample photos per item
            'items.*.sample_photos'         => 'nullable|array',
            'items.*.sample_photos.*'       => 'file|mimes:jpg,jpeg,png,webp|max:5120',
            'items.*.sample_photo_file_ids' => 'nullable|array',
            'items.*.sample_photo_file_ids.*' => 'exists:user_files,id',
        ]);

        DB::transaction(function () use ($rfq, $validated, $request) {
            $rfq->update([
                'customer_id'        => $validated['customer_id'],
                'customer_ref_no'    => $validated['customer_ref_no'] ?? null,
                'required_by'        => $validated['required_by'] ?? null,
                'notes'              => $validated['notes'] ?? null,
            ]);

            // Collect gallery-referenced file paths so we don't delete the shared file
            $keepPaths = [];
            foreach ($validated['items'] as $newItem) {
                foreach (array_merge($newItem['drawing_file_ids'] ?? [], $newItem['sample_photo_file_ids'] ?? []) as $fid) {
                    $f = \App\Models\UserFile::find($fid);
                    if ($f) $keepPaths[] = $f->stored_path;
                }
            }

            // Delete OLD files (from rfq_item_files + item-level legacy paths) UNLESS reused
            foreach ($rfq->items as $old) {
                foreach ($old->files as $oldFile) {
                    if (!in_array($oldFile->stored_path, $keepPaths)) {
                        // Only delete the physical file if it's not from the user's gallery
                        if (!$oldFile->user_file_id && $oldFile->stored_path) {
                            Storage::disk('public')->delete($oldFile->stored_path);
                        }
                    }
                }
                // Legacy path cleanup
                if ($old->drawing_path && !in_array($old->drawing_path, $keepPaths)) {
                    Storage::disk('public')->delete($old->drawing_path);
                }
                if ($old->sample_photo_path && !in_array($old->sample_photo_path, $keepPaths)) {
                    Storage::disk('public')->delete($old->sample_photo_path);
                }
            }
            $rfq->items()->delete(); // cascade deletes rfq_item_files

            foreach ($validated['items'] as $idx => $item) {
                $rfqItem = $rfq->items()->create([
                    'product_id'         => $item['product_id'] ?: null,
                    'job_description'    => $item['job_description'] ?? null,
                    'quantity'           => $item['quantity'],
                    'unit'               => $item['unit'] ?? 'pcs',
                    'notes'              => $item['notes'] ?? null,
                    'reference_type'     => $item['reference_type'] ?? 'none',
                    'sample_received'    => !empty($item['sample_received']),
                    'sample_description' => $item['sample_description'] ?? null,
                ]);

                $this->attachItemFiles($rfqItem, $request, "items.{$idx}.drawings", $item['drawing_file_ids'] ?? [], 'drawing');
                $this->attachItemFiles($rfqItem, $request, "items.{$idx}.sample_photos", $item['sample_photo_file_ids'] ?? [], 'sample_photo');

                $firstDrawing = $rfqItem->drawings()->first();
                $firstSample = $rfqItem->samplePhotos()->first();
                $rfqItem->update([
                    'drawing_path'      => $firstDrawing?->stored_path,
                    'sample_photo_path' => $firstSample?->stored_path,
                ]);
            }
        });

        return redirect()->route('rfqs.show', $rfq)->with('success', 'RFQ updated.');
    }

    public function destroy(Rfq $rfq)
    {
        $rfq->delete();
        return redirect()->route('rfqs.index')->with('success', 'RFQ deleted.');
    }

    public function exportPdf(Rfq $rfq)
    {
        $rfq->load(['customer', 'items.product', 'createdBy', 'quotations']);
        $fmt = fn($v) => number_format((float) ($v ?? 0), 2);
        $date = now()->format('d M Y, H:i');
        $customer = $rfq->customer?->name ?? '—';

        // Items table (with per-item reference material)
        $itemsHtml = '<table style="width:100%;border-collapse:collapse;font-size:11px;">';
        $itemsHtml .= '<thead><tr>';
        foreach (['#', 'Part / Job Description', 'Product', 'Qty', 'Unit', 'Reference', 'Notes'] as $h) {
            $itemsHtml .= "<th style='padding:8px 10px;background:#1e40af;color:white;text-align:left;font-size:10px;text-transform:uppercase;'>{$h}</th>";
        }
        $itemsHtml .= '</tr></thead><tbody>';
        foreach ($rfq->items as $i => $item) {
            $bg = $i % 2 === 0 ? '#fff' : '#f8fafc';
            $desc = $item->job_description ?? '—';
            $product = $item->product ? "{$item->product->name} ({$item->product->code})" : '<span style="color:#94a3b8;">Custom/New</span>';

            // Per-item reference badges
            $refBadges = [];
            $refType = $item->reference_type ?? 'none';
            if (in_array($refType, ['drawing', 'both'])) $refBadges[] = '📐 Drawing';
            if (in_array($refType, ['physical_sample', 'both'])) {
                $received = $item->sample_received ? '✅' : '⏳';
                $refBadges[] = "📦 Sample {$received}";
            }
            $refCell = empty($refBadges)
                ? '<span style="color:#cbd5e1;">—</span>'
                : implode('<br>', $refBadges);
            if ($item->sample_description) {
                $refCell .= "<br><span style='color:#64748b;font-size:9px;'>{$item->sample_description}</span>";
            }

            $itemsHtml .= "<tr style='background:{$bg};'>";
            $itemsHtml .= "<td style='padding:6px 10px;border-bottom:1px solid #e2e8f0;font-weight:bold;vertical-align:top;'>" . ($i + 1) . "</td>";
            $itemsHtml .= "<td style='padding:6px 10px;border-bottom:1px solid #e2e8f0;font-weight:600;vertical-align:top;'>{$desc}</td>";
            $itemsHtml .= "<td style='padding:6px 10px;border-bottom:1px solid #e2e8f0;font-size:10px;vertical-align:top;'>{$product}</td>";
            $itemsHtml .= "<td style='padding:6px 10px;border-bottom:1px solid #e2e8f0;text-align:right;font-weight:bold;vertical-align:top;'>{$item->quantity}</td>";
            $itemsHtml .= "<td style='padding:6px 10px;border-bottom:1px solid #e2e8f0;vertical-align:top;'>{$item->unit}</td>";
            $itemsHtml .= "<td style='padding:6px 10px;border-bottom:1px solid #e2e8f0;font-size:10px;vertical-align:top;'>{$refCell}</td>";
            $itemsHtml .= "<td style='padding:6px 10px;border-bottom:1px solid #e2e8f0;font-size:10px;color:#64748b;vertical-align:top;'>" . ($item->notes ?? '—') . "</td>";
            $itemsHtml .= '</tr>';
        }
        $itemsHtml .= '</tbody></table>';

        $refHtml = ''; // no separate reference section anymore (embedded in items table)

        // Quotations
        $quotHtml = '';
        if ($rfq->quotations->count() > 0) {
            $quotHtml = '<div style="margin-top:16px;"><strong style="color:#1e40af;font-size:12px;">Linked Quotations</strong>';
            $quotHtml .= '<table style="width:100%;border-collapse:collapse;font-size:10px;margin-top:6px;">';
            $quotHtml .= '<thead><tr><th style="padding:6px 8px;background:#f1f5f9;text-align:left;border-bottom:1px solid #e2e8f0;">ID</th><th style="padding:6px 8px;background:#f1f5f9;text-align:right;border-bottom:1px solid #e2e8f0;">Amount</th><th style="padding:6px 8px;background:#f1f5f9;text-align:left;border-bottom:1px solid #e2e8f0;">Version</th><th style="padding:6px 8px;background:#f1f5f9;text-align:left;border-bottom:1px solid #e2e8f0;">Status</th></tr></thead><tbody>';
            foreach ($rfq->quotations as $q) {
                $quotHtml .= "<tr><td style='padding:5px 8px;border-bottom:1px solid #f1f5f9;'>Q-{$q->id}</td>";
                $quotHtml .= "<td style='padding:5px 8px;border-bottom:1px solid #f1f5f9;text-align:right;font-family:monospace;font-weight:bold;'>" . number_format((float) $q->total_amount, 2) . "</td>";
                $quotHtml .= "<td style='padding:5px 8px;border-bottom:1px solid #f1f5f9;'>v{$q->version}</td>";
                $quotHtml .= "<td style='padding:5px 8px;border-bottom:1px solid #f1f5f9;'>" . ucfirst(str_replace('_', ' ', $q->status)) . "</td></tr>";
            }
            $quotHtml .= '</tbody></table></div>';
        }

        $statusLabel  = ucfirst($rfq->status);
        $statusColor  = match ($rfq->status) { 'pending' => '#f59e0b', 'quoted' => '#3b82f6', 'rejected' => '#ef4444', default => '#64748b' };
        $customerRef  = $rfq->customer_ref_no ?? '—';
        $requiredBy   = $rfq->required_by ? $rfq->required_by->format('d M Y') : 'No deadline';
        $createdByName = $rfq->createdBy?->name ?? '—';
        $notesHtml    = $rfq->notes ? '<div style="margin-top:16px;padding:10px 14px;background:#fffbeb;border:1px solid #fde68a;border-radius:8px;font-size:11px;"><strong>Notes:</strong> ' . e($rfq->notes) . '</div>' : '';

        $html = <<<HTML
        <!DOCTYPE html><html><head><meta charset="utf-8">
        <style>
            body { font-family: 'DejaVu Sans', sans-serif; font-size: 11px; color: #334155; margin: 30px; }
            h1 { font-size: 22px; color: #1e40af; margin-bottom: 2px; }
            .subtitle { font-size: 12px; color: #64748b; margin-bottom: 16px; }
            .meta-grid { display: table; width: 100%; margin-bottom: 16px; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden; }
            .meta-cell { display: table-cell; padding: 10px 14px; border-right: 1px solid #e2e8f0; }
            .meta-cell:last-child { border-right: none; }
            .meta-label { color: #94a3b8; text-transform: uppercase; font-weight: bold; font-size: 9px; letter-spacing: 0.5px; }
            .meta-value { color: #0f172a; font-weight: bold; font-size: 12px; margin-top: 3px; }
            .footer { margin-top: 24px; text-align: center; font-size: 8px; color: #94a3b8; }
        </style>
        </head><body>
            <h1>RFQ #{$rfq->id}</h1>
            <div class="subtitle">{$customer} · {$rfq->items->count()} item(s)</div>

            <div class="meta-grid">
                <div class="meta-cell"><div class="meta-label">Customer</div><div class="meta-value">{$customer}</div></div>
                <div class="meta-cell"><div class="meta-label">Customer Ref</div><div class="meta-value">{$customerRef}</div></div>
                <div class="meta-cell"><div class="meta-label">Required By</div><div class="meta-value">{$requiredBy}</div></div>
                <div class="meta-cell"><div class="meta-label">Status</div><div class="meta-value" style="color:{$statusColor};">{$statusLabel}</div></div>
                <div class="meta-cell"><div class="meta-label">Created</div><div class="meta-value">{$rfq->created_at->format('d M Y')}</div><div style="font-size:9px;color:#94a3b8;margin-top:2px;">by {$createdByName}</div></div>
            </div>

            <strong style="color:#1e40af;font-size:12px;">Job Items</strong>
            <div style="margin-top:6px;">{$itemsHtml}</div>

            {$refHtml}

            {$quotHtml}

            {$notesHtml}

            <div class="footer">Generated by BITAC PMS · {$date}</div>
        </body></html>
        HTML;

        $pdf = \Barryvdh\DomPDF\Facade\Pdf::loadHTML($html)->setPaper('a4', 'portrait');
        return $pdf->download("RFQ-{$rfq->id}.pdf");
    }

    /**
     * Attach multiple files to an RFQ item: fresh uploads + gallery-picked files.
     * Fresh uploads are stored AND registered in user_files gallery for future reuse.
     */
    private function attachItemFiles(\App\Models\RfqItem $rfqItem, Request $request, string $filesField, array $fileIds, string $type): void
    {
        $sortOrder = 0;

        // 1. Handle fresh uploads
        $files = $request->file($filesField) ?? [];
        if (!is_array($files)) $files = [$files];
        foreach ($files as $file) {
            if (!$file) continue;
            $folder = $type === 'drawing' ? 'user-files/drawings' : 'user-files/samples';
            $storedPath = $file->store($folder, 'public');

            // Register in user_files gallery
            $userFile = \App\Models\UserFile::create([
                'uploaded_by'   => auth()->id(),
                'original_name' => $file->getClientOriginalName(),
                'stored_path'   => $storedPath,
                'mime_type'     => $file->getMimeType(),
                'extension'     => strtolower($file->getClientOriginalExtension()),
                'size_bytes'    => $file->getSize(),
                'category'      => $type,
            ]);

            // Attach to RFQ item
            \App\Models\RfqItemFile::create([
                'rfq_item_id'   => $rfqItem->id,
                'user_file_id'  => $userFile->id,
                'type'          => $type,
                'stored_path'   => $storedPath,
                'original_name' => $file->getClientOriginalName(),
                'sort_order'    => $sortOrder++,
            ]);
        }

        // 2. Handle gallery picks
        foreach ($fileIds as $fid) {
            $userFile = \App\Models\UserFile::find($fid);
            if (!$userFile || $userFile->uploaded_by !== auth()->id()) continue;

            $userFile->incrementUsage();

            \App\Models\RfqItemFile::create([
                'rfq_item_id'   => $rfqItem->id,
                'user_file_id'  => $userFile->id,
                'type'          => $type,
                'stored_path'   => $userFile->stored_path,
                'original_name' => $userFile->original_name,
                'sort_order'    => $sortOrder++,
            ]);
        }
    }
}
