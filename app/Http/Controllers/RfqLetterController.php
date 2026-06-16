<?php

namespace App\Http\Controllers;

use App\Mail\RfqLetterMail;
use App\Models\Customer;
use App\Models\Rfq;
use App\Models\RfqLetter;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Mail;
use Inertia\Inertia;

class RfqLetterController extends Controller
{
    /** Listing of issued/draft letters, with search + status filter. */
    public function index(Request $request)
    {
        $search = trim((string) $request->query('search', ''));
        $status = $request->query('status');

        $query = RfqLetter::with(['rfq.customer', 'customer', 'signatory', 'createdBy'])->latest();

        if ($search !== '') {
            $query->where(function ($w) use ($search) {
                $w->where('subject', 'like', "%{$search}%")
                    ->orWhere('letter_no', 'like', "%{$search}%")
                    ->orWhereHas('customer', fn ($c) => $c->where('name', 'like', "%{$search}%"))
                    ->orWhereHas('rfq.customer', fn ($c) => $c->where('name', 'like', "%{$search}%"));
            });
        }
        if (in_array($status, ['draft', 'issued'], true)) {
            $query->where('status', $status);
        }

        $letters = $query->paginate(20)->withQueryString()
            ->through(fn (RfqLetter $l) => [
                'id'            => $l->id,
                'letter_no'     => $l->letter_no,
                'subject'       => $l->subject,
                'rfq_id'        => $l->rfq_id,
                'customer'      => $l->customer?->name ?? $l->rfq?->customer?->name,
                'customer_email' => $l->customer?->email ?? $l->rfq?->customer?->email,
                'signatory'     => $l->signatory?->name,
                'status'        => $l->status,
                'letter_date'   => $l->letter_date?->format('d M Y'),
                'emailed_at'    => $l->emailed_at?->format('d M Y, H:i'),
                'created_by'    => $l->createdBy?->name,
            ]);

        return Inertia::render('RfqLetter/Index', [
            'letters' => $letters,
            'filters' => ['search' => $search, 'status' => $status ?? ''],
        ]);
    }

    /** Create form — optionally pre-filled from an RFQ. */
    public function create(Request $request)
    {
        $rfq = $request->query('rfq_id')
            ? Rfq::with('customer')->find($request->query('rfq_id'))
            : null;

        return Inertia::render('RfqLetter/Create', $this->formProps($rfq, null));
    }

    public function store(Request $request)
    {
        $data = $this->validateLetter($request);
        $issue = $request->boolean('issue');

        $rfq = $data['rfq_id'] ? Rfq::find($data['rfq_id']) : null;

        $letter = RfqLetter::create([
            'rfq_id'            => $data['rfq_id'] ?? null,
            'customer_id'       => $rfq?->customer_id ?? ($data['customer_id'] ?? null),
            'letter_no'         => $data['letter_no'] ?? null,
            'letter_date'       => $data['letter_date'] ?? now()->toDateString(),
            'subject'           => $data['subject'],
            'body'              => $data['body'],
            'recipient_block'   => $data['recipient_block'] ?? null,
            'customer_ref_no'   => $data['customer_ref_no'] ?? null,
            'customer_ref_date' => $data['customer_ref_date'] ?? null,
            'signatory_user_id' => $data['signatory_user_id'] ?? null,
            'status'            => $issue ? 'issued' : 'draft',
            'issued_at'         => $issue ? now() : null,
            'created_by'        => auth()->id(),
        ]);

        return redirect()->route('rfq-letters.index')
            ->with('success', $issue ? 'Letter issued.' : 'Letter saved as draft.');
    }

    public function edit(RfqLetter $rfqLetter)
    {
        $rfqLetter->load(['rfq.customer']);
        return Inertia::render('RfqLetter/Create', $this->formProps($rfqLetter->rfq, $rfqLetter));
    }

    public function update(Request $request, RfqLetter $rfqLetter)
    {
        $data = $this->validateLetter($request);
        $issue = $request->boolean('issue');

        $rfqLetter->update([
            'rfq_id'            => $data['rfq_id'] ?? $rfqLetter->rfq_id,
            'letter_no'         => $data['letter_no'] ?? null,
            'letter_date'       => $data['letter_date'] ?? $rfqLetter->letter_date,
            'subject'           => $data['subject'],
            'body'              => $data['body'],
            'recipient_block'   => $data['recipient_block'] ?? null,
            'customer_ref_no'   => $data['customer_ref_no'] ?? null,
            'customer_ref_date' => $data['customer_ref_date'] ?? null,
            'signatory_user_id' => $data['signatory_user_id'] ?? null,
            'status'            => $issue ? 'issued' : $rfqLetter->status,
            'issued_at'         => $issue && !$rfqLetter->issued_at ? now() : $rfqLetter->issued_at,
        ]);

        return redirect()->route('rfq-letters.index')
            ->with('success', $issue ? 'Letter issued.' : 'Letter updated.');
    }

    public function destroy(RfqLetter $rfqLetter)
    {
        $rfqLetter->delete();
        return back()->with('success', 'Letter deleted.');
    }

    /** Render the letter PDF (Bangla default, ?lang=en for English). */
    public function pdf(Request $request, RfqLetter $rfqLetter)
    {
        $lang  = $request->query('lang') === 'en' ? 'en' : 'bn';
        $bytes = $this->renderPdf($rfqLetter, $lang);

        $filename = 'letter-' . str_pad((string) $rfqLetter->id, 5, '0', STR_PAD_LEFT)
            . ($lang === 'en' ? '-EN' : '-BN') . '.pdf';

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

    /** Email the letter (as a PDF attachment) to the customer. */
    public function email(Request $request, RfqLetter $rfqLetter)
    {
        $validated = $request->validate([
            'email'      => 'nullable|email',
            'cc'         => 'nullable|string|max:1000',
            'from_email' => 'nullable|email',
            'subject'    => 'required|string|max:255',
            'message'    => 'nullable|string|max:5000',
            'lang'       => 'nullable|in:bn,en',
        ]);

        // "From" defaults to the issuing user; can be overridden in the dialog.
        $fromEmail = $validated['from_email'] ?? auth()->user()?->email;
        $fromName  = auth()->user()?->name;

        // CC — comma/semicolon separated; keep only valid addresses.
        $ccList = collect(preg_split('/[,;]+/', (string) ($validated['cc'] ?? '')))
            ->map(fn ($e) => trim($e))
            ->filter(fn ($e) => $e !== '' && filter_var($e, FILTER_VALIDATE_EMAIL))
            ->unique()
            ->values()
            ->all();

        $rfqLetter->load(['customer', 'rfq.customer']);
        $customer = $rfqLetter->customer ?? $rfqLetter->rfq?->customer;
        $to = $validated['email'] ?? $customer?->email;
        if (!$to) {
            return back()->with('error', 'No customer email on file. Add one to the customer, or provide an email address.');
        }

        $lang  = ($validated['lang'] ?? 'bn') === 'en' ? 'en' : 'bn';
        $bytes = $this->renderPdf($rfqLetter, $lang);
        $filename = 'BITAC-Letter-' . str_pad((string) $rfqLetter->id, 5, '0', STR_PAD_LEFT) . '.pdf';

        // Compose the email body — rich-text HTML from the editor, sanitised.
        $message = trim((string) ($validated['message'] ?? ''));
        if (trim(strip_tags($message)) === '') {
            $name = $customer?->contact_person ?? $customer?->name ?? 'Sir/Madam';
            $message = '<p>Dear ' . e($name) . ',</p>'
                . '<p>Please find attached an official letter from BITAC. Kindly review the attached document.</p>'
                . '<p>Best regards,<br>Bangladesh Industrial Technical Assistance Centre (BITAC)</p>';
        }
        $messageHtml = $this->sanitizeBody($message);

        try {
            Mail::send(new RfqLetterMail(
                toEmail: $to,
                subjectLine: $validated['subject'],
                messageHtml: $messageHtml,
                pdfData: $bytes,
                pdfName: $filename,
                ccList: $ccList,
                fromEmail: $fromEmail,
                fromName: $fromName,
            ));
        } catch (\Throwable $e) {
            \Log::error('RFQ letter email failed: ' . $e->getMessage());
            return back()->with('error', 'Could not send email: ' . $e->getMessage());
        }

        $rfqLetter->update([
            'emailed_at' => now(),
            'status'     => $rfqLetter->status === 'draft' ? 'issued' : $rfqLetter->status,
            'issued_at'  => $rfqLetter->issued_at ?? now(),
        ]);

        return back()->with('success', "Letter emailed to {$to}.");
    }

    // ── Helpers ────────────────────────────────────────────────────────────

    private function renderPdf(RfqLetter $letter, string $lang): string
    {
        $letter->loadMissing('signatory.center');
        $signer = $letter->signatory;

        $sigPath = $signer?->signatureAbsolutePath();
        $signatureImgHtml = ($sigPath && is_file($sigPath))
            ? '<img src="' . $sigPath . '" style="height: 36pt; max-width: 160pt;" alt="signature" />'
            : '<div style="height: 36pt;"></div>';

        $signerCenter = $signer?->center?->name
            ?? \App\Models\Center::find($letter->center_id ?? auth()->user()?->center_id ?? 1)?->name
            ?? 'BITAC, Dhaka';

        $html = app(\App\Services\OfficialLetterRenderer::class)->buildHtml([
            'memoNo'            => $letter->letter_no,
            'issued'            => ($letter->letter_date ?? $letter->created_at)->format('d/m/Y'),
            'subject'           => $letter->subject,
            'custRefNo'         => $letter->customer_ref_no,
            'custRefDate'       => $letter->customer_ref_date?->format('d/m/Y'),
            'recipientBlock'    => $letter->recipient_block,
            'bodyHtml'          => $this->sanitizeBody($letter->body),
            'signerName'        => $signer?->name,
            'signerDesignation' => $signer?->designation,
            'signerCenter'      => $signerCenter,
            'signerEmail'       => $signer?->email,
            'signerPhone'       => $signer?->phone,
            'signatureImgHtml'  => $signatureImgHtml,
        ], $lang);

        return app(\App\Services\BitacLetterhead::class)
            ->render($html, 'Letter ' . str_pad((string) $letter->id, 5, '0', STR_PAD_LEFT), null, $lang);
    }

    private function sanitizeBody(string $body): string
    {
        $body = trim($body);
        if ($body === '') return '';
        if (!(str_contains($body, '<') && str_contains($body, '>'))) {
            return nl2br(htmlspecialchars($body, ENT_QUOTES | ENT_HTML5, 'UTF-8'));
        }
        $body = preg_replace('#<\s*(script|style|iframe|object|embed)\b[^>]*>.*?<\s*/\s*\1\s*>#is', '', $body);
        $body = preg_replace('#\son[a-z]+\s*=\s*"[^"]*"#i', '', $body);
        $body = preg_replace("#\son[a-z]+\s*=\s*'[^']*'#i", '', $body);
        $body = preg_replace('#javascript\s*:#i', '', $body);
        return strip_tags($body, '<p><br><b><strong><i><em><u><s><strike><ul><ol><li><div><span>');
    }

    private function validateLetter(Request $request): array
    {
        return $request->validate([
            'rfq_id'            => 'nullable|exists:rfqs,id',
            'customer_id'       => 'nullable|exists:customers,id',
            'letter_no'         => 'nullable|string|max:120',
            'letter_date'       => 'nullable|date',
            'subject'           => 'required|string|max:255',
            'body'              => 'required|string',
            'recipient_block'   => 'nullable|string|max:1000',
            'customer_ref_no'   => 'nullable|string|max:150',
            'customer_ref_date' => 'nullable|date',
            'signatory_user_id' => 'nullable|exists:users,id',
        ]);
    }

    private function formProps(?Rfq $rfq, ?RfqLetter $letter): array
    {
        // Default recipient from the customer's stored contact + address.
        $defaultRecipient = '';
        if ($rfq && $rfq->customer) {
            $c = $rfq->customer;
            $defaultRecipient = implode("\n", array_filter([
                $c->contact_person, $c->name, $c->address,
            ]));
        }

        $signatories = User::orderBy('name')->get(['id', 'name', 'designation'])
            ->map(fn ($u) => [
                'id'          => $u->id,
                'name'        => $u->name,
                'designation' => $u->designation,
            ]);

        // RFQ picker — selecting one auto-fills the customer ref + recipient.
        $rfqs = Rfq::with('customer')->latest()->limit(300)->get()
            ->map(fn (Rfq $r) => [
                'id'              => $r->id,
                'label'           => '#' . $r->id . ($r->customer ? ' — ' . $r->customer->name : ''),
                'customer_ref_no' => $r->customer_ref_no,
                'recipient'       => $r->customer
                    ? implode("\n", array_filter([$r->customer->contact_person, $r->customer->name, $r->customer->address]))
                    : '',
            ]);

        return [
            'rfq' => $rfq ? [
                'id'              => $rfq->id,
                'customer_name'   => $rfq->customer?->name,
                'customer_ref_no' => $rfq->customer_ref_no,
            ] : null,
            'signatories'            => $signatories,
            'rfqs'                   => $rfqs,
            'defaultRecipient'       => $defaultRecipient,
            'defaultLetterNo'        => '36.06.2692.028.51.',
            'defaultCustomerRefNo'   => $rfq?->customer_ref_no ?? '',
            'defaultSignatoryId'     => auth()->id(),
            'existing' => $letter ? [
                'id'                => $letter->id,
                'rfq_id'            => $letter->rfq_id,
                'letter_no'         => $letter->letter_no,
                'letter_date'       => $letter->letter_date?->format('Y-m-d'),
                'subject'           => $letter->subject,
                'body'              => $letter->body,
                'recipient_block'   => $letter->recipient_block,
                'customer_ref_no'   => $letter->customer_ref_no,
                'customer_ref_date' => $letter->customer_ref_date?->format('Y-m-d'),
                'signatory_user_id' => $letter->signatory_user_id,
                'status'            => $letter->status,
            ] : null,
        ];
    }
}
