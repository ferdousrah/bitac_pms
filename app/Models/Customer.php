<?php

namespace App\Models;

use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\RoutesNotifications;

class Customer extends Authenticatable
{
    // RoutesNotifications (subset of Notifiable) gives us the `notify()` method
    // for Mail/Resend notifications without the database-notifications half —
    // we already expose our own `notifications()` relation pointing at the
    // CustomerNotification model, which would collide with the full trait.
    use RoutesNotifications;

    /*
     * ⚠️ A client is ONE record across BITAC (2026-10-26) — Railway works with
     * Dhaka and Chattogram alike, with one portal login, and `customers.email`
     * is unique, so a per-centre copy could not even be created. So no
     * CenterScope here: every centre sees the same client list, while each JOB
     * still belongs to its centre. `center_id` stays as the client's HOME
     * centre (where they were first registered; where a portal RFQ goes).
     */
    protected static function booted(): void
    {
        static::creating(function (Customer $c) {
            $c->center_id ??= \App\Support\DocNumber::currentCentreId();
        });
    }

    public function center()
    {
        return $this->belongsTo(Center::class);
    }

    protected $guard = 'customer';

    protected $fillable = [
        'center_id', 'name', 'customer_type', 'sector_id',
        'contact_person', 'email', 'phone', 'address', 'bin_number', 'password', 'is_active',
        'password_change_required',
    ];

    /** Government Entity or Private Organization — drives IED's sector reports. */
    public const TYPES = [
        'government' => 'Government Entity',
        'private'    => 'Private Organization',
    ];

    public function sector()
    {
        return $this->belongsTo(Sector::class);
    }

    /** Label for the type, or a clear stand-in when nobody has classified them yet. */
    public function getCustomerTypeLabelAttribute(): string
    {
        return self::TYPES[$this->customer_type] ?? 'Unspecified';
    }

    protected $hidden = ['password', 'remember_token'];

    protected function casts(): array
    {
        return [
            'password' => 'hashed',
            'is_active' => 'boolean',
            'password_change_required' => 'boolean',
        ];
    }

    public function workOrders()    { return $this->hasMany(WorkOrder::class); }
    public function invoices()      { return $this->hasMany(Invoice::class); }
    public function payments()      { return $this->hasMany(Payment::class); }
    public function notifications() { return $this->hasMany(CustomerNotification::class); }

    /**
     * Send the password reset notification using our own template,
     * so the link points at the customer portal — not the staff one.
     */
    public function sendPasswordResetNotification($token)
    {
        $this->notify(new \App\Notifications\CustomerResetPasswordNotification($token));
    }
}
