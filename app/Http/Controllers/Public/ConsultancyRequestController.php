<?php

namespace App\Http\Controllers\Public;

use App\Http\Controllers\Controller;
use App\Mail\ConsultancyRequestReceived;
use App\Models\ConsultancyRequest;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Mail;
use Inertia\Inertia;

/**
 * Public-facing controller for consultancy / student-assistance requests.
 * Open access — no authentication required so students or external
 * organisations can submit a request without registering.
 *
 * Includes a basic honeypot field (`website`) and rate-limit-by-IP to keep
 * spam manageable without forcing a captcha.
 */
class ConsultancyRequestController extends Controller
{
    public function showForm()
    {
        return Inertia::render('Public/ConsultancyRequest');
    }

    public function store(Request $request)
    {
        // Honeypot — bots usually fill every field
        if ($request->filled('website')) {
            // Pretend success so bots don't probe for the validation
            return redirect()->route('public.consultancy.success', ['n' => '—']);
        }

        // Rate limit: 5 submissions per hour per IP — generous enough for
        // legitimate use but blocks scripted spam.
        $key = 'consultancy-form:' . $request->ip();
        if (\Illuminate\Support\Facades\RateLimiter::tooManyAttempts($key, 5)) {
            return back()->withErrors(['general' => 'Too many submissions from this network. Please try again later.']);
        }
        \Illuminate\Support\Facades\RateLimiter::hit($key, 3600);

        $validated = $request->validate([
            'requester_type'       => 'required|in:student,consultancy,organization',
            'requester_name'       => 'required|string|max:150',
            'requester_email'      => 'required|email|max:150',
            'requester_phone'      => 'required|string|max:30',
            'organization_name'    => 'nullable|string|max:200',
            'designation_or_year'  => 'nullable|string|max:150',
            'subject'              => 'required|string|max:200',
            'description'          => 'required|string|max:5000',
            'preferred_mode'       => 'required|in:in_person,online,written',
            'attachment'           => 'nullable|file|mimes:pdf,jpg,jpeg,png|max:5120',
        ]);

        $payload = [
            'request_number'       => ConsultancyRequest::generateRequestNumber(),
            'center_id'            => 1, // HQ Dhaka by default for public submissions
            'requester_type'       => $validated['requester_type'],
            'requester_name'       => $validated['requester_name'],
            'requester_email'      => $validated['requester_email'],
            'requester_phone'      => $validated['requester_phone'],
            'organization_name'    => $validated['organization_name'] ?? null,
            'designation_or_year'  => $validated['designation_or_year'] ?? null,
            'subject'              => $validated['subject'],
            'description'          => $validated['description'],
            'preferred_mode'       => $validated['preferred_mode'],
            'status'               => 'pending',
        ];

        if ($request->hasFile('attachment')) {
            $payload['attachment_path'] = $request->file('attachment')
                ->store('consultancy-requests', 'public');
        }

        $cr = ConsultancyRequest::create($payload);

        // Confirmation email to the requester
        try {
            Mail::to($cr->requester_email)->send(new ConsultancyRequestReceived($cr));
        } catch (\Throwable $e) {
            \Log::warning('Consultancy confirmation email failed', ['error' => $e->getMessage()]);
        }

        // Notify IED
        try {
            \App\Services\NotifyService::toPermission(
                'view consultancy-requests',
                'consultancy_request_submitted',
                'New consultancy request',
                "{$cr->requester_name} ({$cr->requester_type}) submitted: {$cr->subject}",
                "/ied/consultancy-requests/{$cr->id}",
                'fi-rr-graduation-cap',
                'indigo',
            );
        } catch (\Throwable $e) { /* silent */ }

        return redirect()->route('public.consultancy.success', ['n' => $cr->request_number]);
    }

    public function success(Request $request)
    {
        return Inertia::render('Public/ConsultancyRequestSuccess', [
            'requestNumber' => $request->query('n', '—'),
        ]);
    }
}
