<?php

namespace App\Models;

use App\Traits\HasCenter;
use Illuminate\Database\Eloquent\Model;

/**
 * An internal office note.
 *
 * Written like a letter, but it never leaves BITAC: it prints on plain legal
 * paper with **no letterhead** — the sheet names the centre, its address and
 * the DEPARTMENT it comes from at the top instead.
 *
 * Any department writes notes (2026-10-20), and each is signed in order by
 * the department's chain — see App\Services\NoteWorkflow. Status:
 * draft → pending → approved, or → returned (sent back with a comment).
 */
class OfficeNote extends Model
{
    use HasCenter;

    protected $fillable = [
        'center_id', 'section_id', 'department_name', 'note_no', 'note_date', 'subject', 'body',
        'recipient_block', 'signatory_user_id', 'signature_path', 'preparer_signature_path',
        'status', 'issued_at', 'submitted_at', 'approved_at', 'created_by',
    ];

    protected function casts(): array
    {
        return [
            'note_date'    => 'date',
            'issued_at'    => 'datetime',
            'submitted_at' => 'datetime',
            'approved_at'  => 'datetime',
        ];
    }

    public const STATUSES = [
        'draft'    => 'Draft',
        'pending'  => 'Awaiting signatures',
        'returned' => 'Sent back',
        'approved' => 'Approved',
    ];

    public function signatory() { return $this->belongsTo(User::class, 'signatory_user_id'); }
    public function createdBy() { return $this->belongsTo(User::class, 'created_by'); }
    public function section()   { return $this->belongsTo(Section::class); }
    public function approvals() { return $this->hasMany(OfficeNoteApproval::class)->orderBy('level'); }

    /** The preparer may change it only before it is submitted, or after it was sent back. */
    public function isEditable(): bool
    {
        return in_array($this->status, ['draft', 'returned'], true);
    }
}
