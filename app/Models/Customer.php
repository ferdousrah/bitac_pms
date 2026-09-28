<?php

namespace App\Models;

use App\Traits\HasCenter;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\RoutesNotifications;

class Customer extends Authenticatable
{
    // RoutesNotifications (subset of Notifiable) gives us the `notify()` method
    // for Mail/Resend notifications without the database-notifications half —
    // we already expose our own `notifications()` relation pointing at the
    // CustomerNotification model, which would collide with the full trait.
    use HasCenter, RoutesNotifications;

    protected $guard = 'customer';

    protected $fillable = [
        'center_id', 'name', 'customer_type', 'sector_id',
        'contact_person', 'email', 'phone', 'address', 'password', 'is_active',
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
