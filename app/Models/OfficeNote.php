<?php

namespace App\Models;

use App\Traits\HasCenter;
use Illuminate\Database\Eloquent\Model;

/**
 * An internal office note.
 *
 * Written like a letter, but it never leaves BITAC: it prints on plain legal
 * paper with **no letterhead**, and it is addressed to a colleague or another
 * section rather than a customer.
 */
class OfficeNote extends Model
{
    use HasCenter;

    protected $fillable = [
        'center_id', 'note_no', 'note_date', 'subject', 'body',
        'recipient_block', 'signatory_user_id', 'signature_path',
        'status', 'issued_at', 'created_by',
    ];

    protected function casts(): array
    {
        return [
            'note_date' => 'date',
            'issued_at' => 'datetime',
        ];
    }

    public function signatory() { return $this->belongsTo(User::class, 'signatory_user_id'); }
    public function createdBy() { return $this->belongsTo(User::class, 'created_by'); }
}
