<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class CustomerResponse extends Model
{
    protected $fillable = [
        'quotation_id', 'response_type', 'customer_po_no', 'feedback',
        'response_date', 'attachment_path', 'recorded_by',
    ];

    protected function casts(): array
    {
        return ['response_date' => 'date'];
    }

    public function quotation()  { return $this->belongsTo(Quotation::class); }
    public function recordedBy() { return $this->belongsTo(User::class, 'recorded_by'); }
}
