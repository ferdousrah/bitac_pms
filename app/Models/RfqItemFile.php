<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Storage;

class RfqItemFile extends Model
{
    protected $fillable = [
        'rfq_item_id', 'user_file_id', 'type', 'stored_path', 'original_name', 'sort_order',
    ];

    protected $appends = ['url'];

    public function rfqItem()
    {
        return $this->belongsTo(RfqItem::class);
    }

    public function userFile()
    {
        return $this->belongsTo(UserFile::class);
    }

    public function getUrlAttribute(): ?string
    {
        return $this->stored_path ? Storage::disk('public')->url($this->stored_path) : null;
    }
}
