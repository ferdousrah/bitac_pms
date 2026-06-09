<?php

namespace App\Mail;

use App\Models\ConsultancyRequest;
use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

/**
 * Sent when BITAC accepts, rejects, or completes a consultancy request.
 * The `decision` is one of: accepted | rejected | completed.
 */
class ConsultancyRequestDecision extends Mailable
{
    use Queueable, SerializesModels;

    public function __construct(public ConsultancyRequest $request, public string $decision) {}

    public function envelope(): Envelope
    {
        $subjectMap = [
            'accepted'  => 'BITAC has accepted your consultancy request',
            'rejected'  => 'BITAC update on your consultancy request',
            'completed' => 'BITAC has completed your consultancy request',
        ];
        return new Envelope(
            subject: ($subjectMap[$this->decision] ?? 'Update on your consultancy request') . ' (' . $this->request->request_number . ')',
        );
    }

    public function content(): Content
    {
        return new Content(
            view: 'emails.consultancy.decision',
            with: [
                'cr'       => $this->request,
                'decision' => $this->decision,
            ],
        );
    }
}
