<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class ComplaintDiscussion extends Model
{
    protected $fillable = ['complaint_id', 'user_id', 'message'];

    public function complaint() { return $this->belongsTo(CustomerComplaint::class); }
    public function user()      { return $this->belongsTo(User::class); }
}
