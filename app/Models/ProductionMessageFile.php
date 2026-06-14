<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Storage;

class ProductionMessageFile extends Model
{
    protected $fillable = [
        'production_message_id', 'stored_path', 'original_name',
        'mime_type', 'size',
    ];

    public function message() { return $this->belongsTo(ProductionMessage::class, 'production_message_id'); }

    public function getUrlAttribute(): ?string
    {
        return $this->stored_path ? Storage::disk('public')->url($this->stored_path) : null;
    }

    public function getExtensionAttribute(): ?string
    {
        return strtolower(pathinfo($this->original_name ?? '', PATHINFO_EXTENSION)) ?: null;
    }

    public function getHumanSizeAttribute(): ?string
    {
        if (!$this->size) return null;
        $units = ['B', 'KB', 'MB', 'GB'];
        $i = 0;
        $s = (int) $this->size;
        while ($s >= 1024 && $i < count($units) - 1) {
            $s /= 1024;
            $i++;
        }
        return round($s, $s < 10 ? 1 : 0) . ' ' . $units[$i];
    }
}
