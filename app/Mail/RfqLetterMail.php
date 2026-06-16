<?php

namespace App\Mail;

use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Address;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Mail\Mailables\Attachment;
use Illuminate\Queue\SerializesModels;

class RfqLetterMail extends Mailable
{
    use Queueable, SerializesModels;

    public function __construct(
        public string $toEmail,
        public string $subjectLine,
        public string $messageHtml,
        public string $pdfData,
        public string $pdfName,
        public array $ccList = [],
        public ?string $fromEmail = null,
        public ?string $fromName = null,
    ) {}

    public function envelope(): Envelope
    {
        $env = new Envelope(
            subject: $this->subjectLine,
            to: [$this->toEmail],
            cc: $this->ccList,
        );

        // Send "from" the issuing user. Reply-To is also set so replies reach
        // them even when the SMTP relay rewrites the From header (SPF/DKIM).
        if ($this->fromEmail) {
            $env->from = new Address($this->fromEmail, $this->fromName ?? '');
            $env->replyTo = [new Address($this->fromEmail, $this->fromName ?? '')];
        }

        return $env;
    }

    public function content(): Content
    {
        $html = '<div style="font-family: Arial, sans-serif; font-size: 14px; color: #1f2937; line-height: 1.6;">'
            . $this->messageHtml
            . '</div>';

        return new Content(htmlString: $html);
    }

    public function attachments(): array
    {
        return [
            Attachment::fromData(fn () => $this->pdfData, $this->pdfName)
                ->withMime('application/pdf'),
        ];
    }
}
