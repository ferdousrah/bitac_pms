<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class QuotationApprovalSetting extends Model
{
    protected $fillable = ['level', 'approver_id', 'label'];

    public function approver()
    {
        return $this->belongsTo(User::class, 'approver_id');
    }
}
