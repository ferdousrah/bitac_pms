<?php

namespace App\Mail;

use App\Models\QuotationRequest;
use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

/** Sent to whoever asked for a quotation on the website, quoting their reference. */
class QuotationRequestReceived extends Mailable
{
    use Queueable, SerializesModels;

    public function __construct(public QuotationRequest $qr) {}

    public function envelope(): Envelope
    {
        return new Envelope(
            subject: 'BITAC: we have received your quotation request (' . $this->qr->reference_no . ')',
        );
    }

    public function content(): Content
    {
        return new Content(view: 'emails.quotation-request.received', with: ['qr' => $this->qr]);
    }
}
