<?php

namespace App\Notifications;

use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

class CustomerResetPasswordNotification extends Notification
{
    use Queueable;

    public function __construct(public string $token) {}

    public function via(object $notifiable): array
    {
        return ['mail'];
    }

    public function toMail(object $notifiable): MailMessage
    {
        $url = url('/customer/password/reset/' . $this->token . '?email=' . urlencode($notifiable->getEmailForPasswordReset()));
        $expiry = (int) config('auth.passwords.customers.expire', 60);

        return (new MailMessage)
            ->subject('Reset your ' . config('app.name') . ' customer portal password')
            ->greeting('Hello ' . ($notifiable->contact_person ?: $notifiable->name) . ',')
            ->line('We received a request to reset the password for your customer portal account at ' . config('app.name') . '.')
            ->action('Reset password', $url)
            ->line('This link will expire in ' . $expiry . ' minutes.')
            ->line('If you did not request a password reset, no further action is required — your account is safe.')
            ->salutation('— BITAC IED Team');
    }
}
