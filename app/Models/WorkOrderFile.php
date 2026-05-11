<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Storage;

class WorkOrderFile extends Model
{
    protected $fillable = [
        'work_order_id', 'uploaded_by', 'kind',
        'stored_path', 'original_name', 'mime_type', 'size_bytes', 'description',
    ];

    protected $appends = ['url', 'human_size', 'extension'];

    public function workOrder() { return $this->belongsTo(WorkOrder::class); }
    public function uploadedBy(){ return $this->belongsTo(User::class, 'uploaded_by'); }

    public function getUrlAttribute(): ?string
    {
        return $this->stored_path ? Storage::disk('public')->url($this->stored_path) : null;
    }

    public function getExtensionAttribute(): ?string
    {
        return $this->original_name ? strtolower(pathinfo($this->original_name, PATHINFO_EXTENSION)) : null;
    }

    public function getHumanSizeAttribute(): ?string
    {
        if (!$this->size_bytes) return null;
        $units = ['B', 'KB', 'MB', 'GB'];
        $size  = (float) $this->size_bytes;
        $i     = 0;
        while ($size >= 1024 && $i < count($units) - 1) { $size /= 1024; $i++; }
        return round($size, $i === 0 ? 0 : 1) . ' ' . $units[$i];
    }
}
