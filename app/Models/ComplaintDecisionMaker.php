<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class ComplaintDecisionMaker extends Model
{
    protected $fillable = ['complaint_id', 'user_id', 'added_by', 'added_at'];

    protected function casts(): array
    {
        return ['added_at' => 'datetime'];
    }

    public function complaint() { return $this->belongsTo(CustomerComplaint::class); }
    public function user()      { return $this->belongsTo(User::class); }
    public function addedBy()   { return $this->belongsTo(User::class, 'added_by'); }
}
