<?php

namespace App\Http\Controllers\Customer;

use App\Http\Controllers\Controller;
use App\Models\CompletionCertificate;
use App\Models\WorkOrder;
use App\Services\CompletionCertificatePdfService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;

class CustomerCompletionCertificateController extends Controller
{
    public function __construct(private CompletionCertificatePdfService $pdfService) {}

    public function store(Request $request, WorkOrder $workOrder)
    {
        $customer = auth('customer')->user();
        abort_unless($workOrder->customer_id === $customer->id, 403);
        abort_unless($workOrder->status === 'delivered', 422,
            'A completion certificate can only be issued after the work order is delivered.');

        // One cert per WO — re-submission overwrites the existing record. This
        // keeps the data model simple while still letting a customer fix a
        // mistake (wrong date, wrong signatory).
        $existing = CompletionCertificate::where('work_order_id', $workOrder->id)
            ->where('customer_id', $customer->id)->first();

        $validated = $request->validate([
            'mode'                  => 'required|in:uploaded,self_issued',
            'issued_by_name'        => 'required|string|max:150',
            'issued_by_designation' => 'nullable|string|max:150',
            'issued_date'           => 'required|date|before_or_equal:today',
            'rating'                => 'nullable|integer|min:1|max:5',
            'remarks'               => 'nullable|string|max:2000',
            // Mode-dependent fields:
            'file'                  => 'required_if:mode,uploaded|file|mimes:pdf,jpg,jpeg,png|max:10240',
            'signature'             => 'required_if:mode,self_issued|string', // base64 data URL
        ]);

        $cert = DB::transaction(function () use ($validated, $workOrder, $customer, $existing) {
            $payload = [
                'work_order_id'         => $workOrder->id,
                'customer_id'           => $customer->id,
                'center_id'             => $workOrder->center_id ?? $customer->center_id,
                'mode'                  => $validated['mode'],
                'issued_by_name'        => $validated['issued_by_name'],
                'issued_by_designation' => $validated['issued_by_designation'] ?? null,
                'issued_date'           => $validated['issued_date'],
                'rating'                => $validated['rating'] ?? null,
                'remarks'               => $validated['remarks'] ?? null,
            ];

            $cert = $existing
                ? tap($existing)->update($payload)
                : CompletionCertificate::create($payload + [
                    'certificate_number' => CompletionCertificate::generateCertificateNumber(),
                ]);

            // Persist files based on mode
            if ($validated['mode'] === 'uploaded') {
                // Clean up old upload if any
                if ($cert->uploaded_file_path) Storage::disk('public')->delete($cert->uploaded_file_path);
                $cert->update([
                    'uploaded_file_path' => request()->file('file')->store("completion-certificates/{$cert->id}", 'public'),
                    'signature_path'     => null,
                    'generated_pdf_path' => null,
                ]);
            } else {
                // self_issued — persist signature image + regenerate PDF
                if ($cert->signature_path) Storage::disk('public')->delete($cert->signature_path);
                if ($cert->generated_pdf_path) Storage::disk('public')->delete($cert->generated_pdf_path);

                $sigPath = $this->persistSignature($cert, $validated['signature']);
                $cert->update([
                    'signature_path'     => $sigPath,
                    'uploaded_file_path' => null,
                ]);

                $pdfBytes = $this->pdfService->generatePdf($cert->fresh());
                $pdfPath  = "completion-certificates/{$cert->id}/{$cert->certificate_number}.pdf";
                Storage::disk('public')->put($pdfPath, $pdfBytes);
                $cert->update(['generated_pdf_path' => $pdfPath]);
            }

            return $cert->fresh();
        });

        // Notify IED (everyone with view work-orders permission) that the
        // customer has formally accepted the job.
        try {
            \App\Services\NotifyService::toPermission(
                'view work-orders',
                'completion_certificate_issued',
                'Completion Certificate received',
                "{$customer->name} issued a completion certificate for WO {$workOrder->wo_number}",
                "/work-orders/{$workOrder->id}",
                'fi-rr-diploma',
                'green',
            );
        } catch (\Throwable $e) { /* silent */ }

        return back()->with('success', "Completion certificate {$cert->certificate_number} submitted. Thank you.");
    }

    /** Stream the cert PDF/image inline (supports preview=base64 to bypass IDM). */
    public function show(Request $request, CompletionCertificate $certificate)
    {
        $customer = auth('customer')->user();
        abort_unless($certificate->customer_id === $customer->id, 403);

        $path = $certificate->uploaded_file_path ?? $certificate->generated_pdf_path;
        abort_unless($path, 404);

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

    /** Convert base64 PNG data-URL signature to a file on the public disk. */
    private function persistSignature(CompletionCertificate $cert, string $dataUrl): ?string
    {
        if (! preg_match('#^data:image/(\w+);base64,#i', $dataUrl, $m)) return null;
        $ext   = strtolower($m[1]);
        $bytes = base64_decode(substr($dataUrl, strpos($dataUrl, ',') + 1));
        $path  = "completion-certificates/{$cert->id}/signature-" . uniqid() . ".{$ext}";
        Storage::disk('public')->put($path, $bytes);
        return $path;
    }
}
