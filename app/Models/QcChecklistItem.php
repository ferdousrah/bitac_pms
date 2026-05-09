<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class QcChecklistItem extends Model
{
    protected $fillable = [
        'qc_inspection_id', 'check_description', 'measurement', 'tolerance', 'result',
    ];

    public function qcInspection()
    {
        return $this->belongsTo(QcInspection::class);
    }
}
