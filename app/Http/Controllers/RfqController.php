<?php

namespace App\Http\Controllers;

use App\Models\Customer;
use App\Models\JobCategory;
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
        $query = Rfq::with(['customer', 'items.product', 'createdBy', 'latestQuotation', 'jobCategory']);

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

        // Filter by job type (regular / rnd)
        if ($jobType = $request->input('job_type')) {
            $query->where('job_type', $jobType);
        }

        // Sorting
        $sort = $request->input('sort', 'id');
        $dir  = $request->input('dir', 'desc');
        $allowed = ['id', 'customer_id', 'required_by', 'status', 'created_at', 'job_type'];
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
                'job_type'        => $r->job_type ?? 'regular',
                'job_category'    => $r->jobCategory?->name,
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
                'source'          => $r->source ?? 'staff',
            ]),
            'filters' => [
                'search'      => $request->input('search', ''),
                'status'      => $request->input('status', ''),
                'customer_id' => $request->input('customer_id', ''),
                'job_type'    => $request->input('job_type', ''),
                'sort'        => $sort,
                'dir'         => $dir,
            ],
            'customers' => Customer::where('is_active', true)->orderBy('name')->get(['id', 'name']),
        ]);
    }

    public function create()
    {
        return Inertia::render('RFQ/Create', [
            'customers'      => Customer::where('is_active', true)->get(['id', 'name']),
            'products'       => Product::orderBy('name')->get(['id', 'name', 'code', 'unit']),
            'jobCategories'  => JobCategory::active()->orderBy('display_order')->orderBy('name')->get(['id', 'name', 'code']),
        ]);
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'customer_id'        => 'required|exists:customers,id',
            'job_category_id'    => 'nullable|exists:job_categories,id',
            'customer_ref_no'    => 'nullable|string|max:100',
            'job_type'           => 'nullable|in:regular,rnd',
            'required_by'        => 'nullable|date',
            'notes'              => 'nullable|string|max:1000',
            'rfq_letter'         => 'nullable|file|mimes:pdf,jpg,jpeg,png,doc,docx|max:10240',
            'rfq_letter_title'   => 'nullable|string|max:200',
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
                'job_category_id'    => $validated['job_category_id'] ?? null,
                'customer_ref_no'    => $validated['customer_ref_no'] ?? null,
                'job_type'           => $validated['job_type'] ?? 'regular',
                'required_by'        => $validated['required_by'] ?? null,
                'notes'              => $validated['notes'] ?? null,
                'created_by'         => auth()->id(),
                'status'             => 'pending',
            ]);

            if ($request->hasFile('rfq_letter')) {
                $rfq->update([
                    'rfq_letter_path'  => $request->file('rfq_letter')->store("rfq-letters/{$rfq->id}", 'public'),
                    'rfq_letter_title' => trim($validated['rfq_letter_title'] ?? '') ?: 'RFQ letter',
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
        $rfq->load(['customer', 'jobCategory', 'items.product', 'items.drawings', 'items.samplePhotos', 'items.costEstimates', 'createdBy', 'quotations', 'gatePasses.items']);

        return Inertia::render('RFQ/Show', [
            'rfq' => [
                'id'                 => $rfq->id,
                'status'             => $rfq->status,
                'created_at'         => $rfq->created_at->format('d M Y'),
                'created_by'         => $rfq->createdBy?->name,
                'customer'           => ['name' => $rfq->customer?->name ?? ''],
                'customer_ref_no'    => $rfq->customer_ref_no,
                'job_category'       => $rfq->jobCategory ? [
                    'id'   => $rfq->jobCategory->id,
                    'name' => $rfq->jobCategory->name,
                    'code' => $rfq->jobCategory->code,
                ] : null,
                'job_type'           => $rfq->job_type ?? 'regular',
                // Stream the letter through the controller (not the direct
                // /storage/... URL) so the popup modal's base64 mode works
                // and IDM/FDM extensions don't intercept the response.
                'rfq_letter_url'     => $rfq->rfq_letter_path ? route('rfqs.letter', $rfq) : null,
                'rfq_letter_title'   => $rfq->rfq_letter_title,
                'rfq_letter_ext'     => $rfq->rfq_letter_path ? strtolower(pathinfo($rfq->rfq_letter_path, PATHINFO_EXTENSION)) : null,
                'gate_passes'        => $rfq->gatePasses->map(fn($gp) => [
                    'id'         => $gp->id,
                    'pass_no'    => $gp->pass_no,
                    'direction'  => $gp->direction,
                    'pass_date'  => $gp->pass_date?->format('d/m/Y'),
                    'status'     => $gp->status,
                    'item_count' => $gp->items->count(),
                ])->values(),
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
                'job_category_id'    => $rfq->job_category_id,
                'customer_ref_no'    => $rfq->customer_ref_no,
                'job_type'           => $rfq->job_type ?? 'regular',
                'required_by'        => $rfq->required_by?->format('Y-m-d'),
                'notes'              => $rfq->notes,
                'rfq_letter_url'     => $rfq->rfq_letter_path ? route('rfqs.letter', $rfq) : null,
                'rfq_letter_title'   => $rfq->rfq_letter_title,
                'rfq_letter_ext'     => $rfq->rfq_letter_path ? strtolower(pathinfo($rfq->rfq_letter_path, PATHINFO_EXTENSION)) : null,
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
            'customers'     => Customer::where('is_active', true)->get(['id', 'name']),
            'products'      => Product::orderBy('name')->get(['id', 'name', 'code', 'unit']),
            'jobCategories' => JobCategory::active()->orderBy('display_order')->orderBy('name')->get(['id', 'name', 'code']),
        ]);
    }

    public function update(Request $request, Rfq $rfq)
    {
        $validated = $request->validate([
            'customer_id'        => 'required|exists:customers,id',
            'job_category_id'    => 'nullable|exists:job_categories,id',
            'customer_ref_no'    => 'nullable|string|max:100',
            'job_type'           => 'nullable|in:regular,rnd',
            'required_by'        => 'nullable|date',
            'notes'              => 'nullable|string|max:1000',
            'rfq_letter'         => 'nullable|file|mimes:pdf,jpg,jpeg,png,doc,docx|max:10240',
            'rfq_letter_title'   => 'nullable|string|max:200',
            'remove_rfq_letter'  => 'nullable|boolean',
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
                'job_category_id'    => $validated['job_category_id'] ?? null,
                'customer_ref_no'    => $validated['customer_ref_no'] ?? null,
                'job_type'           => $validated['job_type'] ?? 'regular',
                'required_by'        => $validated['required_by'] ?? null,
                'notes'              => $validated['notes'] ?? null,
            ]);

            // RFQ letter: replace, remove, or just rename
            if ($request->hasFile('rfq_letter')) {
                if ($rfq->rfq_letter_path) {
                    Storage::disk('public')->delete($rfq->rfq_letter_path);
                }
                $rfq->update([
                    'rfq_letter_path'  => $request->file('rfq_letter')->store("rfq-letters/{$rfq->id}", 'public'),
                    'rfq_letter_title' => trim($validated['rfq_letter_title'] ?? '') ?: 'RFQ letter',
                ]);
            } elseif ($request->boolean('remove_rfq_letter')) {
                if ($rfq->rfq_letter_path) {
                    Storage::disk('public')->delete($rfq->rfq_letter_path);
                }
                $rfq->update(['rfq_letter_path' => null, 'rfq_letter_title' => null]);
            } elseif ($rfq->rfq_letter_path && array_key_exists('rfq_letter_title', $validated)) {
                // Just renaming the existing letter
                $rfq->update([
                    'rfq_letter_title' => trim($validated['rfq_letter_title'] ?? '') ?: 'RFQ letter',
                ]);
            }

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

    /**
     * Stream the customer-uploaded RFQ letter through a controller route so
     * the PdfPopupModal's XHR-with-base64 trick works (IDM/FDM only intercept
     * top-level navigation + application/pdf responses).
     *
     *   ?preview=base64 → JSON { data, filename }
     *   ?preview=1      → inline PDF (new tab fallback)
     *   (none)          → force download
     */
    public function letter(Request $request, Rfq $rfq)
    {
        abort_unless($rfq->rfq_letter_path, 404, 'No letter attached to this RFQ.');
        abort_unless(\Storage::disk('public')->exists($rfq->rfq_letter_path), 404, 'Letter file missing on disk.');

        $bytes    = \Storage::disk('public')->get($rfq->rfq_letter_path);
        $ext      = strtolower(pathinfo($rfq->rfq_letter_path, PATHINFO_EXTENSION));
        $title    = $rfq->rfq_letter_title ?: 'RFQ letter';
        $filename = preg_replace('/[^A-Za-z0-9 _\-]/', '_', $title) . '.' . $ext;
        $mime     = match ($ext) {
            'pdf'         => 'application/pdf',
            'jpg', 'jpeg' => 'image/jpeg',
            'png'         => 'image/png',
            'doc'         => 'application/msword',
            'docx'        => 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            default       => 'application/octet-stream',
        };

        if ($request->query('preview') === 'base64') {
            return response()->json([
                'filename' => $filename,
                'data'     => base64_encode($bytes),
                'mime'     => $mime,
            ]);
        }

        $disposition = $request->boolean('preview') ? 'inline' : 'attachment';
        return response($bytes, 200, [
            'Content-Type'        => $mime,
            'Content-Disposition' => $disposition . '; filename="' . $filename . '"',
            'Content-Length'      => strlen($bytes),
        ]);
    }

    public function exportPdf(Request $request, Rfq $rfq)
    {
        $rfq->load(['customer', 'items.product', 'createdBy', 'quotations']);
        $esc = fn($v) => htmlspecialchars((string) ($v ?? ''), ENT_QUOTES | ENT_HTML5, 'UTF-8');

        $customer      = $esc($rfq->customer?->name ?? '—');
        $customerRef   = $rfq->customer_ref_no ? $esc($rfq->customer_ref_no) : '—';
        $requiredBy    = $rfq->required_by ? $rfq->required_by->format('d/m/Y') : 'No deadline';
        $createdByName = $esc($rfq->createdBy?->name ?? '—');
        $createdAt     = $rfq->created_at->format('d/m/Y');
        $statusLabel   = ucfirst((string) $rfq->status);
        $jobTypeLabel  = ($rfq->job_type ?? 'regular') === 'rnd' ? 'R&amp;D' : 'Regular';

        // ─── Memo block — top-left RFQ no, top-right date (BITAC letter convention) ───
        $memoBlock = '<table width="100%" cellspacing="0" cellpadding="0" style="margin-bottom: 14pt;">'
            . '<tr>'
            .   '<td style="font-size: 11pt; color: #000;"><span class="bn" style="font-family: siyamrupali;">নং -</span> RFQ-' . str_pad((string) $rfq->id, 5, '0', STR_PAD_LEFT) . '</td>'
            .   '<td style="font-size: 11pt; color: #000; text-align: right;"><span class="bn" style="font-family: siyamrupali;">তারিখঃ</span> ' . $esc($createdAt) . ' <span class="bn" style="font-family: siyamrupali;">খ্রিঃ</span></td>'
            . '</tr>'
            . '</table>';

        // ─── Centered title ─────────────────────────────────────────────
        $titleBlock = '<div style="text-align: center; margin-bottom: 14pt;">'
            . '<div class="bn" style="font-family: siyamrupali; font-size: 13pt; color: #000;">দরপত্রের অনুরোধপত্র</div>'
            . '<div style="font-size: 11pt; color: #000; margin-top: 1pt;">(REQUEST FOR QUOTATION)</div>'
            . '</div>';

        // ─── Customer + Ref two-column block ───────────────────────────
        $headerBlock = '<table width="100%" cellspacing="0" cellpadding="0" style="margin-bottom: 8pt;">'
            . '<tr>'
            .   '<td width="55%" style="vertical-align: top; padding-right: 12pt;">'
            .     '<div style="font-size: 11pt; color: #000;"><b>Customer:</b> ' . $customer . '</div>'
            .     '<div style="font-size: 10pt; color: #000; margin-top: 2pt;"><b>Job Type:</b> ' . $jobTypeLabel . '</div>'
            .     '<div style="font-size: 10pt; color: #000; margin-top: 2pt;"><b>Status:</b> ' . $esc($statusLabel) . '</div>'
            .   '</td>'
            .   '<td width="45%" style="vertical-align: top; font-size: 10pt; color: #000;">'
            .     '<div><b>Customer Ref:</b> ' . $customerRef . '</div>'
            .     '<div style="margin-top: 2pt;"><b>Required By:</b> ' . $esc($requiredBy) . '</div>'
            .     '<div style="margin-top: 2pt;"><b>Prepared By:</b> ' . $createdByName . '</div>'
            .   '</td>'
            . '</tr>'
            . '</table>';

        // ─── Items table — plain bordered, no zebra, no color ──────────
        $itemsHtml  = '<table width="100%" cellspacing="0" cellpadding="0" style="border-collapse: collapse; border: 0.75pt solid #000; margin-top: 4pt; table-layout: fixed;">';
        $itemsHtml .= '<colgroup>'
            . '<col style="width: 6%;" />'
            . '<col style="width: 44%;" />'
            . '<col style="width: 20%;" />'
            . '<col style="width: 10%;" />'
            . '<col style="width: 8%;" />'
            . '<col style="width: 12%;" />'
            . '</colgroup>';
        $itemsHtml .= '<tr>';
        $itemsHtml .=   '<th style="border: 0.75pt solid #000; padding: 4pt 2pt; font-size: 9pt; font-weight: normal; text-align: center;">'
            . '<span class="bn" style="font-family: siyamrupali;">ক্র.নং</span><br>(Sl. No)</th>';
        $itemsHtml .=   '<th style="border: 0.75pt solid #000; padding: 4pt; font-size: 9pt; font-weight: normal; text-align: center;">'
            . '<span class="bn" style="font-family: siyamrupali;">কাজের বিবরণ</span><br>(Description)</th>';
        $itemsHtml .=   '<th style="border: 0.75pt solid #000; padding: 4pt; font-size: 9pt; font-weight: normal; text-align: center;">Product</th>';
        $itemsHtml .=   '<th style="border: 0.75pt solid #000; padding: 4pt 2pt; font-size: 9pt; font-weight: normal; text-align: center;">'
            . '<span class="bn" style="font-family: siyamrupali;">পরিমান</span><br>(Qty)</th>';
        $itemsHtml .=   '<th style="border: 0.75pt solid #000; padding: 4pt 2pt; font-size: 9pt; font-weight: normal; text-align: center;">'
            . '<span class="bn" style="font-family: siyamrupali;">একক</span><br>(Unit)</th>';
        $itemsHtml .=   '<th style="border: 0.75pt solid #000; padding: 4pt; font-size: 9pt; font-weight: normal; text-align: center;">Reference</th>';
        $itemsHtml .= '</tr>';

        if ($rfq->items->isEmpty()) {
            $itemsHtml .= '<tr><td colspan="6" style="border: 0.75pt solid #000; padding: 10pt; text-align: center; font-style: italic; font-size: 10pt;">No items on this RFQ</td></tr>';
        } else {
            foreach ($rfq->items as $i => $item) {
                $sl      = str_pad((string)($i + 1), 2, '0', STR_PAD_LEFT);
                $desc    = $item->job_description ?: '—';
                $product = $item->product
                    ? $esc($item->product->name) . ' <span style="font-size: 8.5pt;">(' . $esc($item->product->code) . ')</span>'
                    : '<span style="font-style: italic;">Custom / New</span>';

                // Reference cell — plain text, no badges
                $refType = $item->reference_type ?? 'none';
                $refParts = [];
                if (in_array($refType, ['drawing', 'both']))         $refParts[] = 'Drawing';
                if (in_array($refType, ['physical_sample', 'both'])) {
                    $refParts[] = $item->sample_received ? 'Sample (received)' : 'Sample (pending)';
                }
                $refCell = empty($refParts) ? '—' : implode(', ', $refParts);
                if ($item->sample_description) {
                    $refCell .= '<div style="font-size: 8.5pt; margin-top: 2pt;">' . $esc($item->sample_description) . '</div>';
                }

                $itemsHtml .= '<tr>';
                $itemsHtml .=   '<td style="border: 0.75pt solid #000; padding: 6pt 2pt; font-size: 10pt; text-align: center; vertical-align: middle;">' . $sl . '</td>';
                $itemsHtml .=   '<td style="border: 0.75pt solid #000; padding: 6pt 8pt; font-size: 10pt; vertical-align: top; line-height: 1.4;">' . nl2br($esc($desc), false) . '</td>';
                $itemsHtml .=   '<td style="border: 0.75pt solid #000; padding: 6pt 6pt; font-size: 10pt; vertical-align: top;">' . $product . '</td>';
                $itemsHtml .=   '<td style="border: 0.75pt solid #000; padding: 6pt 4pt; font-size: 10pt; text-align: right; vertical-align: middle; white-space: nowrap;">' . number_format((float) $item->quantity, 2) . '</td>';
                $itemsHtml .=   '<td style="border: 0.75pt solid #000; padding: 6pt 2pt; font-size: 10pt; text-align: center; vertical-align: middle;">' . $esc($item->unit ?? '') . '</td>';
                $itemsHtml .=   '<td style="border: 0.75pt solid #000; padding: 6pt 6pt; font-size: 10pt; vertical-align: top;">' . $refCell . '</td>';
                $itemsHtml .= '</tr>';
            }
        }
        $itemsHtml .= '</table>';

        // ─── Linked quotations — minimal table ─────────────────────────
        $quotHtml = '';
        if ($rfq->quotations->count() > 0) {
            $quotHtml  = '<div style="margin-top: 14pt;">';
            $quotHtml .=   '<div style="font-size: 10pt; font-weight: bold; color: #000; margin-bottom: 4pt;">Linked Quotations</div>';
            $quotHtml .=   '<table width="100%" cellspacing="0" cellpadding="0" style="border-collapse: collapse; border: 0.75pt solid #000;">';
            $quotHtml .=     '<tr>';
            $quotHtml .=       '<th style="border: 0.75pt solid #000; padding: 4pt 8pt; font-size: 9pt; font-weight: normal; text-align: left;">Quotation #</th>';
            $quotHtml .=       '<th style="border: 0.75pt solid #000; padding: 4pt 8pt; font-size: 9pt; font-weight: normal; text-align: right;">Amount (BDT)</th>';
            $quotHtml .=       '<th style="border: 0.75pt solid #000; padding: 4pt 8pt; font-size: 9pt; font-weight: normal; text-align: center;">Version</th>';
            $quotHtml .=       '<th style="border: 0.75pt solid #000; padding: 4pt 8pt; font-size: 9pt; font-weight: normal; text-align: left;">Status</th>';
            $quotHtml .=     '</tr>';
            foreach ($rfq->quotations as $q) {
                $quotHtml .= '<tr>';
                $quotHtml .=   '<td style="border: 0.75pt solid #000; padding: 4pt 8pt; font-size: 10pt;">Q-' . str_pad((string) $q->id, 5, '0', STR_PAD_LEFT) . '</td>';
                $quotHtml .=   '<td style="border: 0.75pt solid #000; padding: 4pt 8pt; font-size: 10pt; text-align: right; white-space: nowrap;">' . number_format((float) $q->total_amount, 2) . '</td>';
                $quotHtml .=   '<td style="border: 0.75pt solid #000; padding: 4pt 8pt; font-size: 10pt; text-align: center;">v' . $q->version . '</td>';
                $quotHtml .=   '<td style="border: 0.75pt solid #000; padding: 4pt 8pt; font-size: 10pt;">' . $esc(ucfirst(str_replace('_', ' ', $q->status))) . '</td>';
                $quotHtml .= '</tr>';
            }
            $quotHtml .=   '</table>';
            $quotHtml .= '</div>';
        }

        // ─── Notes (free-text) ─────────────────────────────────────────
        $notesHtml = $rfq->notes
            ? '<div style="margin-top: 12pt; font-size: 10pt; color: #000; line-height: 1.4;">'
                . '<div style="font-weight: bold; margin-bottom: 2pt;">Notes</div>'
                . nl2br($esc($rfq->notes), false)
            . '</div>'
            : '';

        $bodyHtml = <<<HTML
        {$memoBlock}
        {$titleBlock}
        {$headerBlock}
        {$itemsHtml}
        {$quotHtml}
        {$notesHtml}
HTML;

        // Render via mPDF (handles Bangla complex-script shaping correctly,
        // unlike DomPDF). Letterhead service builds header/footer + page numbering.
        $bytes    = app(\App\Services\BitacLetterhead::class)->render($bodyHtml, "RFQ #{$rfq->id}");
        $filename = "RFQ-{$rfq->id}.pdf";

        // ?preview=base64 → JSON with base64 bytes (bypasses IDM/FDM download-manager
        //                  extensions for inline iframe preview).
        // ?preview=1      → inline PDF stream (may be intercepted by IDM).
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
