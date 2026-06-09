<?php

namespace App\Mail;

use App\Models\ConsultancyRequest;
use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

class ConsultancyRequestReceived extends Mailable
{
    use Queueable, SerializesModels;

    public function __construct(public ConsultancyRequest $request) {}

    public function envelope(): Envelope
    {
        return new Envelope(
            subject: 'BITAC: We have received your consultancy request (' . $this->request->request_number . ')',
        );
    }

    public function content(): Content
    {
        return new Content(
            view: 'emails.consultancy.received',
            with: ['cr' => $this->request],
        );
    }
}
