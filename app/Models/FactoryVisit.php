<?php

namespace App\Models;

use App\Traits\HasCenter;
use Illuminate\Database\Eloquent\Model;

/**
 * A factory IED visited, or plans to visit — see the migration for why both
 * live in one row. `planned` rows feed "Factory to be Visited", `visited` rows
 * feed "Factory Visited" (IED → Reports).
 */
class FactoryVisit extends Model
{
    use HasCenter;

    protected $fillable = [
        'center_id', 'customer_id', 'factory_name', 'visitors', 'status',
        'planned_date', 'visited_on', 'visit_work', 'remarks', 'created_by', 'updated_by',
    ];

    protected $casts = [
        'planned_date' => 'date',
        'visited_on'   => 'date',
    ];

    public function customer() { return $this->belongsTo(Customer::class); }
    public function creator()  { return $this->belongsTo(User::class, 'created_by'); }
}
