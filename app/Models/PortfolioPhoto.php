<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Storage;

class PortfolioPhoto extends Model
{
    protected $fillable = [
        'portfolio_project_id', 'stored_path', 'caption', 'sort_order',
    ];

    protected $appends = ['url'];

    public function project()
    {
        return $this->belongsTo(PortfolioProject::class, 'portfolio_project_id');
    }

    public function getUrlAttribute(): ?string
    {
        return $this->stored_path
            ? Storage::disk('public')->url($this->stored_path)
            : null;
    }
}
