<?php

namespace App\Models;

use App\Traits\HasCenter;
use Illuminate\Foundation\Auth\User as Authenticatable;

class Customer extends Authenticatable
{
    use HasCenter;

    protected $guard = 'customer';

    protected $fillable = [
        'center_id', 'name', 'contact_person', 'email', 'phone', 'address', 'password', 'is_active',
    ];

    protected $hidden = ['password', 'remember_token'];

    protected function casts(): array
    {
        return ['password' => 'hashed', 'is_active' => 'boolean'];
    }

    public function workOrders()    { return $this->hasMany(WorkOrder::class); }
    public function invoices()      { return $this->hasMany(Invoice::class); }
    public function notifications() { return $this->hasMany(CustomerNotification::class); }
}
