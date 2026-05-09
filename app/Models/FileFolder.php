<?php

namespace App\Models;

use App\Traits\HasCenter;
use Illuminate\Database\Eloquent\Model;

class FileFolder extends Model
{
    use HasCenter;

    protected $fillable = [
        'user_id', 'center_id', 'parent_folder_id', 'name', 'color', 'icon', 'description',
    ];

    protected $appends = ['file_count', 'subfolder_count'];

    public function user()
    {
        return $this->belongsTo(User::class);
    }

    public function parent()
    {
        return $this->belongsTo(FileFolder::class, 'parent_folder_id');
    }

    public function children()
    {
        return $this->hasMany(FileFolder::class, 'parent_folder_id');
    }

    public function files()
    {
        return $this->hasMany(UserFile::class, 'folder_id');
    }

    public function getFileCountAttribute(): int
    {
        return $this->files()->count();
    }

    public function getSubfolderCountAttribute(): int
    {
        return $this->children()->count();
    }

    /**
     * Build a breadcrumb trail from root to this folder.
     */
    public function breadcrumb(): array
    {
        $trail = [];
        $current = $this;
        while ($current) {
            array_unshift($trail, [
                'id'    => $current->id,
                'name'  => $current->name,
                'color' => $current->color,
            ]);
            $current = $current->parent;
        }
        return $trail;
    }
}
