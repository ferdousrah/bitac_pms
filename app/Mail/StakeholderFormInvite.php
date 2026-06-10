<?php

namespace App\Mail;

use App\Models\Stakeholder;
use App\Models\StakeholderForm;
use App\Models\StakeholderFormInvitation;
use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

class StakeholderFormInvite extends Mailable
{
    use Queueable, SerializesModels;

    public function __construct(
        public StakeholderForm $form,
        public StakeholderFormInvitation $invitation,
        public Stakeholder $stakeholder,
        public bool $isReminder = false,
    ) {}

    public function envelope(): Envelope
    {
        $prefix = $this->isReminder ? 'Reminder: ' : '';
        return new Envelope(
            subject: $prefix . 'BITAC ' . $this->form->year . ' Stakeholder Consultation — Your input requested',
        );
    }

    public function content(): Content
    {
        return new Content(
            view: 'emails.stakeholder-form.invite',
            with: [
                'form'         => $this->form,
                'stakeholder'  => $this->stakeholder,
                'fillUrl'      => url("/stakeholder-form/{$this->invitation->token}"),
                'isReminder'   => $this->isReminder,
            ],
        );
    }
}
