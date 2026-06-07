<?php

namespace App\Http\Controllers;

use App\Models\CompletionCertificate;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Inertia\Inertia;

/**
 * Staff-side controller for browsing + downloading customer-issued
 * completion certificates. Lives under the IED section since IED owns
 * customer-facing acknowledgements and the BITAC tender portfolio.
 */
class CompletionCertificateController extends Controller
{
    public function index(Request $request)
    {
        $q = CompletionCertificate::query()
            ->with(['workOrder.product', 'customer'])
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

        $rows = $q->paginate(20)->withQueryString()->through(fn ($c) => [
            'id'                 => $c->id,
            'certificate_number' => $c->certificate_number,
            'wo_id'              => $c->work_order_id,
            'wo_number'          => $c->workOrder?->wo_number,
            'product'            => $c->workOrder?->product?->name,
            'customer'           => $c->customer?->name,
            'mode'               => $c->mode,
            'issued_by_name'     => $c->issued_by_name,
            'issued_date'        => $c->issued_date?->format('d M Y'),
            'rating'             => $c->rating,
            'created_at'         => $c->created_at->format('d M Y'),
        ]);

        // Aggregate stats for the inbox header tiles
        $stats = [
            'total'    => CompletionCertificate::count(),
            'uploaded' => CompletionCertificate::where('mode', 'uploaded')->count(),
            'self'     => CompletionCertificate::where('mode', 'self_issued')->count(),
            'avg_rating' => round((float) CompletionCertificate::whereNotNull('rating')->avg('rating'), 1),
        ];

        return Inertia::render('CompletionCertificates/Index', [
            'certificates' => $rows,
            'filters'      => $request->only(['search', 'mode', 'rating']),
            'stats'        => $stats,
        ]);
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
