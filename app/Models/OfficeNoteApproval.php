<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/** One signature step on a note after the preparer — see App\Services\NoteWorkflow. */
class OfficeNoteApproval extends Model
{
    protected $fillable = [
        'office_note_id', 'level', 'step', 'section_id', 'status', 'skip_reason',
        'acted_by', 'acted_at', 'remarks', 'signature_path',
    ];

    protected $casts = ['acted_at' => 'datetime'];

    public function note()    { return $this->belongsTo(OfficeNote::class, 'office_note_id'); }
    public function actor()   { return $this->belongsTo(User::class, 'acted_by'); }
    public function section() { return $this->belongsTo(Section::class); }
}
