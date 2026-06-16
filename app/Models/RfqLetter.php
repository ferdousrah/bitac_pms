<?php

namespace App\Models;

use App\Traits\HasCenter;
use Illuminate\Database\Eloquent\Model;

class RfqLetter extends Model
{
    use HasCenter;

    protected $fillable = [
        'center_id', 'rfq_id', 'customer_id',
        'letter_no', 'letter_date', 'subject', 'body', 'recipient_block',
        'customer_ref_no', 'customer_ref_date',
        'signatory_user_id', 'status', 'issued_at', 'emailed_at', 'created_by',
    ];

    protected function casts(): array
    {
        return [
            'letter_date'       => 'date',
            'customer_ref_date' => 'date',
            'issued_at'         => 'datetime',
            'emailed_at'        => 'datetime',
        ];
    }

    public function rfq()       { return $this->belongsTo(Rfq::class); }
    public function customer()  { return $this->belongsTo(Customer::class); }
    public function signatory() { return $this->belongsTo(User::class, 'signatory_user_id'); }
    public function createdBy() { return $this->belongsTo(User::class, 'created_by'); }
}
