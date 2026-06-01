<?php

namespace App\Mail;

use App\Models\CustomerComplaint;
use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

class ComplaintResponseMail extends Mailable
{
    use Queueable, SerializesModels;

    public function __construct(public CustomerComplaint $complaint) {}

    public function envelope(): Envelope
    {
        return new Envelope(
            subject: 'BITAC response to your feedback #' . $this->complaint->reference_number,
            to: [$this->complaint->customer->email],
        );
    }

    public function content(): Content
    {
        return new Content(
            view: 'emails.complaint-response',
            with: [
                'complaint' => $this->complaint,
                'customer'  => $this->complaint->customer,
                'portalUrl' => url('/customer/complaints/' . $this->complaint->id),
                'brand'     => config('app.name'),
            ],
        );
    }
}
