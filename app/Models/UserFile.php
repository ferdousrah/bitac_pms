<?php

namespace App\Models;

use App\Traits\HasCenter;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Storage;

class UserFile extends Model
{
    use HasCenter;

    protected $fillable = [
        'uploaded_by', 'center_id', 'folder_id', 'original_name', 'stored_path',
        'preview_path', 'preview_mime', 'preview_generated_at', 'preview_status', 'preview_error',
        'mime_type', 'extension', 'size_bytes', 'category',
        'description', 'usage_count',
    ];

    protected $casts = [
        'preview_generated_at' => 'datetime',
    ];

    protected $appends = ['url', 'human_size', 'preview_url'];

    public function uploader()
    {
        return $this->belongsTo(User::class, 'uploaded_by');
    }

    public function folder()
    {
        return $this->belongsTo(FileFolder::class, 'folder_id');
    }

    public function getUrlAttribute(): ?string
    {
        return $this->stored_path ? Storage::disk('public')->url($this->stored_path) : null;
    }

    public function getPreviewUrlAttribute(): ?string
    {
        return $this->preview_path ? Storage::disk('public')->url($this->preview_path) : null;
    }

    public function getHumanSizeAttribute(): string
    {
        $bytes = (int) $this->size_bytes;
        if ($bytes < 1024) return $bytes . ' B';
        if ($bytes < 1024 * 1024) return round($bytes / 1024, 1) . ' KB';
        if ($bytes < 1024 * 1024 * 1024) return round($bytes / (1024 * 1024), 1) . ' MB';
        return round($bytes / (1024 * 1024 * 1024), 2) . ' GB';
    }

    public function isImage(): bool
    {
        return str_starts_with($this->mime_type, 'image/');
    }

    public function incrementUsage(): void
    {
        $this->increment('usage_count');
    }
}
