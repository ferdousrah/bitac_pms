<?php

namespace App\Mail;

use App\Models\Customer;
use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

class CustomerWelcomeMail extends Mailable
{
    use Queueable, SerializesModels;

    public function __construct(
        public Customer $customer,
        public string $plainPassword,
    ) {}

    public function envelope(): Envelope
    {
        return new Envelope(
            subject: 'Welcome to ' . config('app.name') . ' — your customer portal login',
            to: [$this->customer->email],
        );
    }

    public function content(): Content
    {
        return new Content(
            view: 'emails.customer-welcome',
            with: [
                'customer'      => $this->customer,
                'email'         => $this->customer->email,
                'plainPassword' => $this->plainPassword,
                'portalUrl'     => url('/customer/login'),
                'brand'         => config('app.name'),
            ],
        );
    }
}
