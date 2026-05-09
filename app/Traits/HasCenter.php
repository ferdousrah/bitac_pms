<?php

namespace App\Traits;

use App\Scopes\CenterScope;

trait HasCenter
{
    public static function bootHasCenter(): void
    {
        static::addGlobalScope(new CenterScope());

        // Auto-set center_id on create
        static::creating(function ($model) {
            if (empty($model->center_id)) {
                $centerId = app()->bound('current_center_id') ? app('current_center_id') : null;
                if ($centerId) {
                    $model->center_id = $centerId;
                }
            }
        });
    }

    public function center()
    {
        return $this->belongsTo(\App\Models\Center::class);
    }
}
