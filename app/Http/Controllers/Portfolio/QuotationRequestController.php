<?php

namespace App\Http\Controllers\Portfolio;

use App\Http\Controllers\Controller;
use App\Mail\QuotationRequestReceived;
use App\Models\Center;
use App\Models\QuotationRequest;
use App\Models\SiteOffice;
use App\Services\NotifyService;
use Illuminate\Database\QueryException;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\RateLimiter;

/**
 * Receives "Request a quotation" from the public website. No sign-in.
 *
 * ⚠️ This is the one place a stranger can write into the database, so it is
 * guarded three ways and none of them asks a person to solve a puzzle:
 *  - a **honeypot** field (`website`) that is hidden from people and that
 *    scripts fill in;
 *  - a **time trap** — the form carries an encrypted "drawn at" stamp, and
 *    a post that comes back within `MIN_SECONDS` was not typed by a human;
 *  - a **rate limit** of `PER_HOUR` per address.
 * A tripped honeypot or time trap is answered with a normal-looking thank-you
 * (and nothing is stored), so a script learns nothing from probing it.
 */
class QuotationRequestController extends Controller
{
    private const MIN_SECONDS = 3;
    private const PER_HOUR    = 5;

    public function store(Request $request)
    {
        if ($request->filled('website') || $this->tooFast($request->input('form_token'))) {
            return redirect()->route('portfolio.public.quote')->with('quote_ref', 'QR-' . now()->format('Y') . '-0000');
        }

        $key = 'quote-request:' . $request->ip();
        if (RateLimiter::tooManyAttempts($key, self::PER_HOUR)) {
            return back()->withErrors([
                'general' => 'Too many requests have been sent from this network. Please try again in an hour, or call the office directly.',
            ])->withInput();
        }

        $data = $request->validate([
            'site_office_id' => 'required|integer|exists:site_offices,id',
            'name'           => 'required|string|max:150',
            'organisation'   => 'nullable|string|max:200',
            'designation'    => 'nullable|string|max:150',
            'email'          => 'required|email|max:150',
            // ASCII or Bangla digits, with the usual separators.
            'phone'          => ['required', 'string', 'max:40', 'regex:/^[0-9০-৯+\-\s().]{7,40}$/u'],
            'address'        => 'nullable|string|max:500',
            'subject'        => 'required|string|max:200',
            'description'    => 'required|string|min:10|max:5000',
            'quantity'       => 'nullable|numeric|min:0|max:9999999',
            'unit'           => 'nullable|string|max:30',
            'needed_by'      => 'nullable|date|after_or_equal:today',
            'files'          => 'nullable|array|max:' . QuotationRequest::MAX_FILES,
            'files.*'        => 'file|max:' . QuotationRequest::MAX_KB . '|extensions:' . implode(',', QuotationRequest::FILE_EXT),
        ], [
            'phone.regex'         => 'Enter a phone number we can call.',
            'files.max'           => 'Attach at most ' . QuotationRequest::MAX_FILES . ' files.',
            'files.*.max'         => 'Each file must be under ' . (QuotationRequest::MAX_KB / 1024) . ' MB.',
            'files.*.extensions'  => 'Attach PDF, image, CAD (DWG/DXF), Word or Excel files only.',
            'description.min'     => 'Tell us a little more about the job.',
            'needed_by.after_or_equal' => 'The date you need it by cannot be in the past.',
        ]);

        // A hidden office is not offered on the form, so it cannot be picked.
        $office = SiteOffice::active()->find($data['site_office_id']);
        if (! $office) {
            return back()->withErrors(['site_office_id' => 'Choose one of the offices listed.'])->withInput();
        }

        RateLimiter::hit($key, 3600);

        $qr = $this->createWithReference([
            // The office's own PMS centre when it has one; otherwise the head
            // office answers it, as every other public submission does.
            'center_id'      => $office->center_id ?: Center::defaultId(),
            'site_office_id' => $office->id,
            'name'           => $data['name'],
            'organisation'   => $data['organisation'] ?? null,
            'designation'    => $data['designation'] ?? null,
            'email'          => $data['email'],
            'phone'          => $data['phone'],
            'address'        => $data['address'] ?? null,
            'subject'        => $data['subject'],
            'description'    => $data['description'],
            'quantity'       => $data['quantity'] ?? null,
            'unit'           => $data['unit'] ?? null,
            'needed_by'      => $data['needed_by'] ?? null,
            'status'         => 'new',
            'ip'             => $request->ip(),
            'user_agent'     => mb_substr((string) $request->userAgent(), 0, 255),
        ]);

        foreach ((array) $request->file('files', []) as $file) {
            if (! $file) continue;
            $qr->files()->create([
                'path'          => $file->store('quotation-requests/' . $qr->id, 'local'),
                'original_name' => mb_substr($file->getClientOriginalName(), 0, 255),
                'mime'          => $file->getClientMimeType(),
                'size'          => $file->getSize() ?: 0,
            ]);
        }

        $from = $qr->organisation ? "{$qr->name} ({$qr->organisation})" : $qr->name;
        NotifyService::toPermission(
            'view rfqs',
            'quotation_request_submitted',
            "Quotation request {$qr->reference_no}",
            "{$from} asked {$office->name} for a quotation: {$qr->subject}",
            "/ied/quotation-requests/{$qr->id}",
            'fi-rr-inbox-in',
            'indigo',
            centerId: $qr->center_id,
        );

        // Needs SMTP. A failed send must not lose a request that was saved.
        try {
            Mail::to($qr->email)->send(new QuotationRequestReceived($qr->load('office')));
        } catch (\Throwable $e) {
            Log::warning('Quotation request confirmation email failed', ['ref' => $qr->reference_no, 'error' => $e->getMessage()]);
        }

        return redirect()->route('portfolio.public.quote')
            ->with('quote_ref', $qr->reference_no)
            ->with('quote_email', $qr->email);
    }

    private function tooFast(?string $token): bool
    {
        try {
            $drawnAt = (int) decrypt((string) $token);
        } catch (\Throwable) {
            return true; // no token, or one we did not issue
        }

        return now()->timestamp - $drawnAt < self::MIN_SECONDS;
    }

    /** Two requests in the same second can race for a number — take the next one. */
    private function createWithReference(array $attrs): QuotationRequest
    {
        for ($try = 0; ; $try++) {
            try {
                return DB::transaction(fn () => QuotationRequest::create($attrs + [
                    'reference_no' => QuotationRequest::nextReference(),
                ]));
            } catch (QueryException $e) {
                if ($try >= 4 || ! str_contains($e->getMessage(), 'reference_no')) throw $e;
            }
        }
    }
}
