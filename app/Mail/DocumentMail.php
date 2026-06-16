<?php

namespace App\Mail;

use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Address;
use Illuminate\Mail\Mailables\Attachment;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

/**
 * Generic outgoing document email — supports CC, a custom From/Reply-To, an
 * HTML message body, and any number of PDF attachments. Used to email a
 * quotation together with its forwarding letter.
 *
 * @param array $files  list of ['data' => binaryString, 'name' => 'file.pdf']
 */
class DocumentMail extends Mailable
{
    use Queueable, SerializesModels;

    public function __construct(
        public string $toEmail,
        public string $subjectLine,
        public string $messageHtml,
        public array $files = [],
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
        return collect($this->files)
            ->filter(fn ($f) => !empty($f['data']))
            ->map(fn ($f) => Attachment::fromData(fn () => $f['data'], $f['name'])->withMime('application/pdf'))
            ->values()
            ->all();
    }
}
