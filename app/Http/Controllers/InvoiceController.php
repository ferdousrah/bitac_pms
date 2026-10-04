<?php

namespace App\Http\Controllers;

use App\Models\DeliveryOrder;
use App\Models\Invoice;
use App\Models\User;
use App\Services\BitacLetterhead;
use App\Http\Controllers\MusakChallanController;
use App\Services\InvoiceService;
use App\Services\OfficialLetterRenderer;
use App\Support\SignatureResolver;
use Illuminate\Http\Request;
use Inertia\Inertia;

class InvoiceController extends Controller
{
    public function __construct(private InvoiceService $service) {}

    public function index(Request $request)
    {
        $query = Invoice::with(['workOrder.product', 'workOrder.customer', 'musakChallans']);

        // Search
        if ($search = $request->input('search')) {
            $query->where(function ($q) use ($search) {
                $q->where('invoice_number', 'like', "%{$search}%")
                  ->orWhereHas('workOrder.customer', fn($c) => $c->where('name', 'like', "%{$search}%"));
            });
        }

        // Filter by status
        if ($status = $request->input('status')) {
            $query->where('status', $status);
        }

        // Sorting
        $sort = $request->input('sort', 'id');
        $dir  = $request->input('dir', 'desc');
        $allowed = ['id', 'total_amount', 'status', 'created_at'];
        if (in_array($sort, $allowed)) {
            $query->orderBy($sort, $dir === 'asc' ? 'asc' : 'desc');
        } else {
            $query->latest();
        }

        $invoices = $query->paginate(15)->withQueryString()
            ->through(fn($i) => [
                'id'             => $i->id,
                'invoice_number' => $i->invoice_number,
                'wo_number'      => $i->workOrder->wo_number ?? '',
                'work_order_id'  => $i->work_order_id,
                'customer'       => $i->workOrder->customer->name ?? '',
                'total_amount'   => $i->total_amount,
                'status'         => $i->status,
                'issued_date'    => $i->issued_date ? \Carbon\Carbon::parse($i->issued_date)->format('d/m/Y') : null,
                'due_date'       => $i->due_date ? \Carbon\Carbon::parse($i->due_date)->format('d/m/Y') : null,
                'is_overdue'     => $i->due_date && now()->gt(\Carbon\Carbon::parse($i->due_date)) && $i->status !== 'paid',
                // The bill and the মূসক ৬.৩ are raised together and travel
                // together, so the bill links straight to its challan.
                'musak_challan'  => $i->musakChallans->first()?->only(['id', 'challan_no']),
            ]);

        return Inertia::render('Invoice/Index', [
            'invoices' => $invoices,
            'filters' => [
                'search' => $request->input('search', ''),
                'status' => $request->input('status', ''),
                'sort'   => $sort,
                'dir'    => $dir,
            ],
        ]);
    }

    /**
     * Raise the bill for a delivery.
     *
     * ⚠️ This used to happen inside `DeliveryController@complete`, so
     * confirming a delivery silently issued an invoice. BITAC wanted them apart
     * (2026-09-29): the **delivery challan** belongs to the delivery, but
     * billing is accounts' own act, done whenever they get to it. The মূসক ৬.৩
     * then comes off the bill, equally deliberately.
     *
     * Refusals are a redirect + flash, never `abort()` — a second click on a
     * stale list must read as a message, not a crash.
     */
    public function storeFromDelivery(DeliveryOrder $delivery)
    {
        if ($delivery->status !== 'delivered') {
            return back()->with('error', 'This delivery has not been confirmed yet, so there is nothing to bill.');
        }

        if ($existing = $delivery->invoice) {
            return redirect()->route('invoices.show', $existing)
                ->with('error', "This delivery is already billed on {$existing->invoice_number}.");
        }

        $invoice = $this->service->createFromDelivery($delivery);

        \App\Services\CustomerNotifyService::invoiceIssued($invoice->fresh('customer', 'workOrder'));

        return redirect()->route('invoices.show', $invoice)
            ->with('success', "Bill {$invoice->invoice_number} raised.");
    }

    // ─── The forwarding letter that travels with the bill ────────────────
    //
    // Three documents reach the customer together: the **forwarding letter**,
    // the **bill** and the **মূসক ৬.৩**. The letter is the one that carries the
    // office's reference, the customer's reference and the signature, so it is
    // rendered by `OfficialLetterRenderer` exactly like a quotation's.

    public function editLetter(Invoice $invoice)
    {
        $invoice->load(['customer', 'workOrder.customer', 'signatory']);
        $customer = $invoice->customer ?? $invoice->workOrder?->customer;

        return Inertia::render('Invoice/Letter', [
            'invoice' => [
                'id'             => $invoice->id,
                'invoice_number' => $invoice->invoice_number,
                'customer'       => $customer?->name,
                'total_amount'   => (float) $invoice->total_amount,
                'issued_date'    => $invoice->issued_at?->format('d M Y'),
                'memo_no'                   => $invoice->memo_no,
                'forwarding_letter_subject' => $invoice->forwarding_letter_subject,
                'forwarding_letter'         => $invoice->forwarding_letter,
                // A blank recipient falls back to the customer, which is what
                // the letter would print anyway — better typed in than guessed
                // silently at render time.
                'recipient_block'   => $invoice->recipient_block
                    ?: trim(implode("\n", array_filter([$customer?->name, $customer?->address]))),
                'customer_ref_no'   => $invoice->customer_ref_no,
                'customer_ref_date' => $invoice->customer_ref_date?->format('Y-m-d'),
                'signatory_user_id' => $invoice->signatory_user_id,
                'letter_issued_at'  => $invoice->letter_issued_at?->format('d M Y, h:i A'),
            ],
            // Each signatory carries their own blocks — a letter is routinely
            // drafted by one person and signed by another.
            'signatories' => User::with('signatures')->orderBy('name')->get(['id', 'name', 'designation'])
                ->map(fn ($u) => [
                    'id'          => $u->id,
                    'name'        => $u->name,
                    'designation' => $u->designation,
                    'signatures'  => $u->signatures->map(fn ($sig) => [
                        'id' => $sig->id, 'label' => $sig->label,
                        'url' => $sig->url, 'is_default' => $sig->is_default,
                    ])->values(),
                ]),
            'defaultSignatoryId' => auth()->id(),
        ]);
    }

    public function updateLetter(Request $request, Invoice $invoice)
    {
        $data = $request->validate([
            'memo_no'                   => 'nullable|string|max:120',
            'forwarding_letter_subject' => 'nullable|string|max:255',
            'forwarding_letter'         => 'required|string',
            'recipient_block'           => 'nullable|string|max:1000',
            'customer_ref_no'           => 'nullable|string|max:120',
            'customer_ref_date'         => 'nullable|date',
            'signatory_user_id'         => 'nullable|exists:users,id',
            'user_signature_id'         => 'nullable|integer|exists:user_signatures,id',
        ]);

        $invoice->update([
            'memo_no'                   => $data['memo_no'] ?? null,
            'forwarding_letter_subject' => $data['forwarding_letter_subject'] ?? null,
            'forwarding_letter'         => $data['forwarding_letter'],
            'recipient_block'           => $data['recipient_block'] ?? null,
            'customer_ref_no'           => $data['customer_ref_no'] ?? null,
            'customer_ref_date'         => $data['customer_ref_date'] ?? null,
            'signatory_user_id'         => $data['signatory_user_id'] ?? null,
            // The snapshot is only replaced when a block was actually picked —
            // saving a typo fix must not un-sign a letter that went out.
            'signature_path'            => SignatureResolver::resolve(
                $data['user_signature_id'] ?? null,
                null,
                'signatures/invoice-letters',
                $data['signatory_user_id'] ?? null,
            ) ?? $invoice->signature_path,
            'letter_issued_at'          => $invoice->letter_issued_at ?? now(),
        ]);

        return redirect()->route('invoices.show', $invoice)->with('success', 'Forwarding letter saved.');
    }

    /** The letter, on the BITAC pad, in Bangla or English. */
    public function letterPdf(Request $request, Invoice $invoice)
    {
        $body = trim((string) $invoice->forwarding_letter);
        if ($body === '') {
            return redirect()->route('invoices.letter.edit', $invoice)
                ->with('error', 'This bill has no forwarding letter yet — write one first.');
        }

        $invoice->load(['customer', 'workOrder.customer', 'signatory.center']);
        $lang = $request->query('lang') === 'en' ? 'en' : 'bn';

        $signer   = $invoice->signatory;
        $customer = $invoice->customer ?? $invoice->workOrder?->customer;

        $sigPath = $invoice->signature_path
            ? \Storage::disk('public')->path($invoice->signature_path)
            : $signer?->signatureAbsolutePath();
        $sigPath = ($sigPath && is_file($sigPath)) ? $sigPath : null;

        $html = app(OfficialLetterRenderer::class)->buildHtml([
            'memoNo'            => $invoice->memo_no,
            'issued'            => ($invoice->letter_issued_at ?? $invoice->issued_at ?? $invoice->created_at)->format('d/m/Y'),
            'subject'           => $invoice->forwarding_letter_subject ?: 'Bill — Forwarding Letter',
            'custRefNo'         => $invoice->customer_ref_no,
            'custRefDate'       => $invoice->customer_ref_date?->format('d/m/Y'),
            'recipientBlock'    => $invoice->recipient_block
                ?: trim(implode("\n", array_filter([$customer?->name, $customer?->address]))),
            'bodyHtml'          => \App\Support\LetterHtml::toPrintable($body),
            'signerName'        => $signer?->name,
            'signerDesignation' => $signer?->designation,
            'signerCenter'      => $signer?->center?->name
                ?? \App\Models\Center::find($invoice->center_id ?? 1)?->name,
            'signerEmail'       => $signer?->email,
            'signerPhone'       => $signer?->phone,
            'signaturePath'     => $sigPath,
        ], $lang);

        $bytes = app(BitacLetterhead::class)->render(
            $html, "Forwarding Letter {$invoice->invoice_number}", null, $lang,
        );
        $filename = "forwarding-letter-{$invoice->invoice_number}" . ($lang === 'en' ? '-EN' : '-BN') . '.pdf';

        if ($request->input('preview') === 'base64') {
            return response()->json([
                'filename' => $filename,
                'size'     => strlen($bytes),
                'data'     => base64_encode($bytes),
            ]);
        }

        return response($bytes, 200, [
            'Content-Type'        => 'application/pdf',
            'Content-Disposition' => ($request->boolean('preview') ? 'inline' : 'attachment')
                . '; filename="' . $filename . '"',
            'Content-Length'      => strlen($bytes),
        ]);
    }

    /**
     * Send the three that travel together.
     *
     * The bill always goes. The forwarding letter and the মূসক ৬.৩ go when they
     * exist and the sender asked for them — a bill with no challan raised yet
     * must still be sendable.
     */
    public function email(Request $request, Invoice $invoice)
    {
        $data = $request->validate([
            'to'                => 'required|email',
            'cc'                => 'nullable|string|max:500',
            'subject'           => 'required|string|max:255',
            'message'           => 'nullable|string',
            'from_email'        => 'nullable|email',
            'lang'              => 'nullable|in:bn,en',
            'include_letter'    => 'nullable|boolean',
            'include_musak'     => 'nullable|boolean',
        ]);

        if (! config('mail.mailers.' . config('mail.default') . '.host') && config('mail.default') === 'smtp') {
            return back()->with('error', 'No SMTP server is configured — set the MAIL_* settings first.');
        }

        $lang  = ($data['lang'] ?? 'bn') === 'en' ? 'en' : 'bn';
        $grab  = fn ($resp) => base64_decode(json_decode($resp->getContent(), true)['data'] ?? '');
        $files = [];

        // The letter goes first — it is the covering document.
        if ($request->boolean('include_letter', true) && trim((string) $invoice->forwarding_letter) !== '') {
            $letter = $this->letterPdf(new Request(['preview' => 'base64', 'lang' => $lang]), $invoice);
            if ($letter instanceof \Illuminate\Http\JsonResponse) {
                $files[] = ['data' => $grab($letter), 'name' => "Forwarding-Letter-{$invoice->invoice_number}.pdf"];
            }
        }

        $files[] = [
            'data' => $grab($this->downloadPdf(new Request(['preview' => 'base64']), $invoice)),
            'name' => "Bill-{$invoice->invoice_number}.pdf",
        ];

        if ($request->boolean('include_musak', true) && ($challan = $invoice->musakChallans()->first())) {
            $files[] = [
                'data' => $grab(app(MusakChallanController::class)
                    ->pdf(new Request(['preview' => 'base64', 'copy' => 1]), $challan)),
                'name' => "Musak-6.3-{$challan->challan_no}.pdf",
            ];
        }

        $ccList = collect(preg_split('/[,;]+/', (string) ($data['cc'] ?? '')))
            ->map(fn ($e) => trim($e))
            ->filter(fn ($e) => $e !== '' && filter_var($e, FILTER_VALIDATE_EMAIL))
            ->unique()->values()->all();

        $message = trim((string) ($data['message'] ?? ''));
        if (trim(strip_tags($message)) === '') {
            $message = '<p>Dear Sir/Madam,</p><p>Please find attached our bill '
                . e($invoice->invoice_number) . ' with its supporting documents.</p>';
        }

        try {
            \Illuminate\Support\Facades\Mail::send(new \App\Mail\DocumentMail(
                $data['to'],
                $data['subject'],
                \App\Support\LetterHtml::sanitize($message),
                $files,
                $ccList,
                $data['from_email'] ?? auth()->user()?->email,
                auth()->user()?->name,
            ));
        } catch (\Throwable $e) {
            return back()->with('error', 'Could not send: ' . $e->getMessage());
        }

        $invoice->update(['emailed_at' => now()]);

        return back()->with('success', 'Sent ' . count($files) . ' document(s) to ' . $data['to'] . '.');
    }

    public function show(Invoice $invoice)
    {
        $invoice->load(['workOrder.product', 'workOrder.customer', 'markedPaidBy', 'musakChallans', 'customer', 'accountsSignedBy']);

        return Inertia::render('Invoice/Show', [
            'invoice' => [
                'id'                => $invoice->id,
                'invoice_number'    => $invoice->invoice_number,
                'wo_number'         => $invoice->workOrder->wo_number ?? '',
                'job_number'        => $invoice->workOrder->job_number ?? null,
                'work_order_id'     => $invoice->work_order_id,
                'customer'          => $invoice->workOrder->customer->name ?? '',
                'customer_address'  => $invoice->workOrder->customer->address ?? '',
                'subtotal'          => $invoice->subtotal,
                'discount'          => $invoice->discount ?? 0,
                'vat_rate'          => $invoice->vat_rate,
                'vat_amount'        => $invoice->vat_amount,
                'tax_rate'          => $invoice->tax_rate,
                'tax_amount'        => $invoice->tax_amount,
                'total_amount'      => $invoice->total_amount,
                'status'            => $invoice->status,
                'issued_date'       => $invoice->issued_at?->format('d M Y'),
                'due_date'          => $invoice->due_date ? \Carbon\Carbon::parse($invoice->due_date)->format('d M Y') : null,
                'payment_terms'     => $invoice->payment_terms,
                'paid_at'           => $invoice->paid_at?->format('d M Y'),
                'paid_amount'       => $invoice->paid_amount,
                'payment_method'    => $invoice->payment_method,
                'payment_reference' => $invoice->payment_reference,
                'payment_notes'     => $invoice->payment_notes,
                'marked_paid_by'    => $invoice->markedPaidBy?->name,
                // The two that travel with the bill.
                'has_letter'        => trim((string) $invoice->forwarding_letter) !== '',
                'letter_subject'    => $invoice->forwarding_letter_subject,
                'letter_issued_at'  => $invoice->letter_issued_at?->format('d M Y'),
                'emailed_at'        => $invoice->emailed_at?->format('d M Y, h:i A'),
                'musak_challan'     => $invoice->musakChallans->first()?->only(['id', 'challan_no']),
                'customer_email'    => $invoice->customer?->email ?? $invoice->workOrder?->customer?->email,
                // The accounts desk's signature on the bill itself.
                'signed'            => $invoice->isAccountsSigned(),
                'signed_by'         => $invoice->accountsSignedBy?->name,
                'signed_at'         => $invoice->accounts_signed_at?->format('d M Y, h:i A'),
                'signature_url'     => $invoice->accounts_signature_path
                    ? \Storage::disk('public')->url($invoice->accounts_signature_path)
                    : null,
            ],
            'canSign' => auth()->user()?->can('create invoices') ?? false,
        ]);
    }

    /**
     * Stream the BITAC-style invoice PDF inline (browser preview).
     * `?download=1` forces a download instead.
     */
    public function downloadPdf(Request $request, Invoice $invoice)
    {
        $bytes = $this->service->generatePdf($invoice);

        // `?preview=base64` is how PdfPopupModal fetches a PDF (download
        // managers hijack an application/pdf response), and how `email()`
        // reuses this generator instead of a second copy of it.
        if ($request->input('preview') === 'base64') {
            return response()->json([
                'filename' => $invoice->invoice_number . '.pdf',
                'size'     => strlen($bytes),
                'data'     => base64_encode($bytes),
            ]);
        }

        $disp = $request->boolean('download') ? 'attachment' : 'inline';

        return response($bytes, 200, [
            'Content-Type'        => 'application/pdf',
            'Content-Disposition' => $disp . '; filename="' . $invoice->invoice_number . '.pdf"',
            'Content-Length'      => strlen($bytes),
        ]);
    }

    public function acknowledge(Invoice $invoice)
    {
        $invoice->update(['status' => 'acknowledged']);
        return back()->with('success', 'Invoice acknowledged.');
    }

    /**
     * Record customer payment against this invoice and mark it paid.
     * Captures amount, method, reference (cheque no / TX id), payment date,
     * and an optional note. Sets status='paid' and stamps marked_paid_by.
     */
    public function markPaid(Request $request, Invoice $invoice)
    {
        if ($invoice->status === 'paid') {
            return back()->with('error', 'Invoice is already marked as paid.');
        }

        $validated = $request->validate([
            'paid_amount'       => 'required|numeric|min:0.01',
            'payment_method'    => 'required|in:cash,cheque,bank_transfer,online,other',
            'payment_reference' => 'nullable|string|max:100',
            'paid_at'           => 'required|date',
            'payment_notes'     => 'nullable|string|max:500',
        ]);

        $invoice->update([
            'status'            => 'paid',
            'paid_at'           => $validated['paid_at'],
            'paid_amount'       => $validated['paid_amount'],
            'payment_method'    => $validated['payment_method'],
            'payment_reference' => $validated['payment_reference'] ?? null,
            'payment_notes'     => $validated['payment_notes'] ?? null,
            'marked_paid_by'    => auth()->id(),
        ]);

        \App\Services\CustomerNotifyService::invoicePaid($invoice->fresh(['customer', 'workOrder']));

        return back()->with('success', "Invoice {$invoice->invoice_number} marked as paid.");
    }

    /**
     * The Accounts Officer signs the bill.
     *
     * BITAC's rule: once a bill is generated the accounts desk signs it, and
     * that signature prints on the document itself. It is a separate act from
     * signing the forwarding letter that travels with it, and it is stored in
     * its own columns for exactly that reason (migration 000056).
     *
     * Only the PATH is kept, so deleting the signature later cannot blank a
     * bill that has already gone out.
     */
    public function sign(Request $request, Invoice $invoice)
    {
        $data = $request->validate(SignatureResolver::rules());

        $path = SignatureResolver::resolve(
            $data['user_signature_id'] ?? null,
            $data['signature'] ?? null,
            'signatures/invoices',
        );

        // Nothing picked and nothing drawn — fall back to the signer's own
        // default block, the same way every other signing screen does.
        $path ??= SignatureResolver::defaultPathFor(auth()->id());

        if (! $path) {
            return back()->with('error',
                'No signature to sign with — add one under Profile → Signatures first.');
        }

        $invoice->update([
            'accounts_signature_path' => $path,
            'accounts_signed_by'      => auth()->id(),
            'accounts_signed_at'      => now(),
        ]);

        return back()->with('success', "Bill {$invoice->invoice_number} signed.");
    }

    /**
     * Take the signature back off.
     *
     * Signing the wrong bill, or signing with the wrong block, must not be a
     * dead end — the figure is still the same figure and the bill can be
     * signed again. The stamp is cleared, not overwritten with a blank.
     */
    public function unsign(Invoice $invoice)
    {
        if (! $invoice->isAccountsSigned()) {
            return back()->with('error', 'This bill is not signed.');
        }

        $invoice->update([
            'accounts_signature_path' => null,
            'accounts_signed_by'      => null,
            'accounts_signed_at'      => null,
        ]);

        return back()->with('success', 'Signature removed.');
    }
}
