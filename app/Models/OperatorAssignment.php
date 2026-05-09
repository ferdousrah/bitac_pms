<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class OperatorAssignment extends Model
{
    protected $fillable = ['operation_step_id', 'user_id', 'shift'];

    public function operationStep()
    {
        return $this->belongsTo(OperationStep::class);
    }

    public function user()
    {
        return $this->belongsTo(User::class);
    }
}
