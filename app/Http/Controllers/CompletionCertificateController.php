<?php

namespace App\Http\Controllers;

use App\Models\CompletionCertificate;
use App\Models\WorkOrder;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Inertia\Inertia;

/**
 * IED → Completion Certificates: every job's completion certificate.
 *
 * A certificate reaches here two ways: the client issues it in the customer
 * portal (`source = customer`), or the client hands BITAC a signed paper
 * certificate and IED scans and uploads it (`source = ied`, 2026-10-20).
 * One certificate per job. Staff may replace or delete only what IED
 * uploaded — a certificate the client issued themselves is theirs.
 */
class CompletionCertificateController extends Controller
{
    public function index(Request $request)
    {
        $q = CompletionCertificate::query()
            ->with(['workOrder.product', 'customer', 'uploader:id,name'])
            ->latest('id');

        if ($search = trim((string) $request->input('search'))) {
            $q->where(function ($q) use ($search) {
                $q->where('certificate_number', 'like', "%{$search}%")
                  ->orWhere('issued_by_name', 'like', "%{$search}%")
                  ->orWhereHas('workOrder', fn($w) => $w->where('wo_number', 'like', "%{$search}%"))
                  ->orWhereHas('customer',  fn($c) => $c->where('name', 'like', "%{$search}%"));
            });
        }
        if ($mode = $request->input('mode')) {
            $q->where('mode', $mode);
        }
        if ($rating = $request->input('rating')) {
            $q->where('rating', $rating);
        }
        if (($source = $request->input('source')) && isset(CompletionCertificate::SOURCES[$source])) {
            $q->where('source', $source);
        }

        $canManage = (bool) $request->user()?->can('manage completion-certificates');

        $rows = $q->paginate(20)->withQueryString()->through(fn ($c) => [
            'id'                 => $c->id,
            'certificate_number' => $c->certificate_number,
            'wo_id'              => $c->work_order_id,
            'wo_number'          => $c->workOrder?->wo_number,
            'product'            => $c->workOrder?->product?->name,
            'customer'           => $c->customer?->name,
            'mode'               => $c->mode,
            'source'             => $c->source ?? 'customer',
            'uploaded_by'        => $c->uploader?->name,
            'issued_by_name'     => $c->issued_by_name,
            'issued_by_designation' => $c->issued_by_designation,
            'issued_date'        => $c->issued_date?->format('d M Y'),
            'issued_date_raw'    => $c->issued_date?->toDateString(),
            'client_ref_no'      => $c->client_ref_no,
            'remarks'            => $c->remarks,
            'rating'             => $c->rating,
            'created_at'         => $c->created_at->format('d M Y'),
            'can_edit'           => $canManage && $c->isIedUpload(),
        ]);

        // Aggregate stats for the inbox header tiles
        $stats = [
            'total'      => CompletionCertificate::count(),
            'from_client'=> CompletionCertificate::where('source', 'customer')->count(),
            'by_ied'     => CompletionCertificate::where('source', 'ied')->count(),
            'awaiting'   => WorkOrder::where('status', 'delivered')->whereDoesntHave('completionCertificate')->count(),
            'avg_rating' => round((float) CompletionCertificate::whereNotNull('rating')->avg('rating'), 1),
        ];

        return Inertia::render('CompletionCertificates/Index', [
            'certificates' => $rows,
            'filters'      => $request->only(['search', 'mode', 'rating', 'source']),
            'stats'        => $stats,
            'canManage'    => $canManage,
            // The jobs a certificate can be uploaded for — only sent to someone
            // who may upload, and only jobs that do not have one yet.
            'jobs'         => $canManage ? $this->uploadableJobs() : [],
            // `?upload=<work order id>` opens the form on that job (IED → Jobs).
            'uploadFor'    => $canManage ? ((int) $request->query('upload') ?: null) : null,
        ]);
    }

    /** Upload the client's signed certificate for a job. */
    public function store(Request $request)
    {
        $data = $this->validated($request, fileRequired: true);

        $wo = WorkOrder::with('customer')->find($data['work_order_id']);
        if (! $wo || $wo->status === 'cancelled') {
            return back()->with('error', 'That job cannot take a completion certificate — it was cancelled.');
        }
        $existing = CompletionCertificate::withoutGlobalScopes()->where('work_order_id', $wo->id)->first();
        if ($existing) {
            return back()->with('error', "{$wo->wo_number} already has completion certificate {$existing->certificate_number}"
                . ($existing->isIedUpload() ? ' — use Replace on that row to change it.' : ', issued by the client.'));
        }

        $cert = CompletionCertificate::create([
            'center_id'             => $wo->center_id,
            'work_order_id'         => $wo->id,
            'customer_id'           => $wo->customer_id,
            'certificate_number'    => CompletionCertificate::generateCertificateNumber(),
            'mode'                  => 'uploaded',
            'source'                => 'ied',
            'uploaded_by'           => $request->user()->id,
            'issued_by_name'        => $data['issued_by_name'],
            'issued_by_designation' => $data['issued_by_designation'] ?? null,
            'issued_date'           => $data['issued_date'],
            'client_ref_no'         => $data['client_ref_no'] ?? null,
            'remarks'               => $data['remarks'] ?? null,
        ]);
        $cert->update(['uploaded_file_path' => $request->file('file')->store("completion-certificates/{$cert->id}", 'public')]);

        return $this->backTo($request, "Completion certificate {$cert->certificate_number} uploaded for {$wo->wo_number}.");
    }

    /** Correct an IED upload — the details, and the file if a new one is given. */
    public function update(Request $request, CompletionCertificate $certificate)
    {
        if (! $certificate->isIedUpload()) {
            return back()->with('error', 'This certificate was issued by the client in the customer portal, so it cannot be changed here.');
        }
        $data = $this->validated($request, fileRequired: false, editing: true);

        $certificate->update([
            'issued_by_name'        => $data['issued_by_name'],
            'issued_by_designation' => $data['issued_by_designation'] ?? null,
            'issued_date'           => $data['issued_date'],
            'client_ref_no'         => $data['client_ref_no'] ?? null,
            'remarks'               => $data['remarks'] ?? null,
            'uploaded_by'           => $request->user()->id,
        ]);
        if ($request->hasFile('file')) {
            $old = $certificate->uploaded_file_path;
            $certificate->update(['uploaded_file_path' => $request->file('file')->store("completion-certificates/{$certificate->id}", 'public')]);
            if ($old) Storage::disk('public')->delete($old);
        }

        return $this->backTo($request, "Completion certificate {$certificate->certificate_number} updated.");
    }

    public function destroy(Request $request, CompletionCertificate $certificate)
    {
        if (! $certificate->isIedUpload()) {
            return back()->with('error', 'This certificate was issued by the client in the customer portal, so it cannot be deleted here.');
        }
        $number = $certificate->certificate_number;
        if ($certificate->uploaded_file_path) Storage::disk('public')->delete($certificate->uploaded_file_path);
        Storage::disk('public')->deleteDirectory("completion-certificates/{$certificate->id}");
        $certificate->delete();

        return $this->backTo($request, "Completion certificate {$number} deleted.");
    }

    private function validated(Request $request, bool $fileRequired, bool $editing = false): array
    {
        return $request->validate([
            'work_order_id'         => $editing ? 'nullable' : 'required|integer|exists:work_orders,id',
            'issued_by_name'        => 'required|string|max:150',
            'issued_by_designation' => 'nullable|string|max:150',
            'issued_date'           => 'required|date|before_or_equal:today',
            'client_ref_no'         => 'nullable|string|max:100',
            'remarks'               => 'nullable|string|max:2000',
            'file'                  => ($fileRequired ? 'required' : 'nullable') . '|file|mimes:pdf,jpg,jpeg,png|max:10240',
        ], [
            'work_order_id.required' => 'Choose the job this certificate is for.',
            'issued_by_name.required'=> 'Who signed the certificate?',
            'issued_date.before_or_equal' => 'The certificate date cannot be in the future.',
            'file.required'          => 'Attach the scanned certificate.',
            'file.mimes'             => 'Attach a PDF, JPG or PNG.',
            'file.max'               => 'The file must be under 10 MB.',
        ]);
    }

    /** Back to the job page when the upload started there, else to the list. */
    private function backTo(Request $request, string $message)
    {
        $from = $request->input('return_to');
        if ($from && str_starts_with($from, '/ied/jobs/')) {
            return redirect($from)->with('success', $message);
        }
        return redirect()->route('ied.completion-certificates.index')->with('success', $message);
    }

    /**
     * Jobs with no certificate yet, newest first. Delivered ones lead — that
     * is when a client signs — but any job that was not cancelled is offered,
     * because a certificate for older work can arrive for a job whose status
     * in this system never reached "delivered".
     */
    private function uploadableJobs(): array
    {
        return WorkOrder::query()
            ->with(['customer:id,name', 'items' => fn ($q) => $q->select('id', 'work_order_id', 'description', 'display_order')])
            ->where('status', '<>', 'cancelled')
            ->whereDoesntHave('completionCertificate')
            ->orderByRaw("CASE WHEN status IN ('delivered','partially_delivered') THEN 0 ELSE 1 END")
            ->latest('id')
            ->limit(400)
            ->get(['id', 'wo_number', 'job_number', 'customer_id', 'status', 'product_id'])
            ->map(fn (WorkOrder $w) => [
                'id'           => $w->id,
                'wo_number'    => $w->wo_number,
                'job_number'   => $w->job_number,
                'customer'     => $w->customer?->name,
                'description'  => $w->items->first()?->description,
                'status'       => $w->status,
                'status_label' => $w->status_label,
                'delivered'    => in_array($w->status, ['delivered', 'partially_delivered'], true),
            ])->values()->all();
    }

    /**
     * Force-download the certificate file (PDF for self-issued, original
     * PDF/JPG/PNG for uploaded mode). Falls back to streaming if storage
     * disk doesn't support download().
     */
    public function download(CompletionCertificate $certificate)
    {
        $path = $certificate->uploaded_file_path ?? $certificate->generated_pdf_path;
        abort_unless($path && Storage::disk('public')->exists($path), 404,
            'Certificate file not found on disk.');

        $ext = strtolower(pathinfo($path, PATHINFO_EXTENSION));
        $filename = "{$certificate->certificate_number}.{$ext}";

        return Storage::disk('public')->download($path, $filename);
    }

    /** Open in a new tab — inline preview, no force-download. */
    public function preview(Request $request, CompletionCertificate $certificate)
    {
        $path = $certificate->uploaded_file_path ?? $certificate->generated_pdf_path;
        abort_unless($path && Storage::disk('public')->exists($path), 404);

        $bytes = Storage::disk('public')->get($path);
        $ext = strtolower(pathinfo($path, PATHINFO_EXTENSION));
        $mime = match ($ext) {
            'pdf'         => 'application/pdf',
            'jpg', 'jpeg' => 'image/jpeg',
            'png'         => 'image/png',
            default       => 'application/octet-stream',
        };

        if ($request->query('preview') === 'base64') {
            return response()->json([
                'data'     => base64_encode($bytes),
                'filename' => "{$certificate->certificate_number}.{$ext}",
                'mime'     => $mime,
            ]);
        }

        return response($bytes, 200, [
            'Content-Type'        => $mime,
            'Content-Disposition' => 'inline; filename="' . $certificate->certificate_number . '.' . $ext . '"',
        ]);
    }
}
