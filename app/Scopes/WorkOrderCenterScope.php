<?php

namespace App\Scopes;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Scope;

/**
 * CenterScope for rows that have no centre of their own and belong to a centre
 * only THROUGH their job — a job's leg at a shop (`work_order_sections`), an
 * operation (`operation_steps`, via its sheet), a day's output
 * (`production_logs`).
 *
 * ⚠️ Shops are ONE national list (BITAC, 2026-10-26), so "every job at CNC" is
 * every centre's CNC work unless something narrows it. Without this,
 * Chattogram's CNC queue listed Dhaka's jobs and `/production/wos/{id}` opened
 * another centre's job by URL. Nothing applies when no centre is active (the
 * super admin / Head Office looking at all of BITAC), same as CenterScope.
 */
class WorkOrderCenterScope implements Scope
{
    /** @param string $via `work_order_id` (direct) or `operation_sheet_id` */
    public function __construct(private string $via = 'work_order_id') {}

    public function apply(Builder $builder, Model $model): void
    {
        $centerId = app()->bound('current_center_id') ? app('current_center_id') : null;
        if (! $centerId) {
            return;
        }

        $jobs = fn ($q) => $q->select('id')->from('work_orders')->where('center_id', $centerId);

        $column = $model->getTable() . '.' . $this->via;

        if ($this->via === 'operation_sheet_id') {
            $builder->whereIn($column, fn ($q) => $q->select('id')->from('operation_sheets')
                ->whereIn('work_order_id', $jobs));
            return;
        }

        $builder->whereIn($column, $jobs);
    }
}
