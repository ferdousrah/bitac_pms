<?php

namespace App\Scopes;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Scope;

class CenterScope implements Scope
{
    public function apply(Builder $builder, Model $model): void
    {
        $centerId = app()->bound('current_center_id') ? app('current_center_id') : null;

        // super_admin with no center selected = see all
        if ($centerId) {
            $builder->where($model->getTable() . '.center_id', $centerId);
        }
    }
}
