<?php

namespace App\Traits;

use App\Scopes\CenterScope;

trait HasCenter
{
    public static function bootHasCenter(): void
    {
        static::addGlobalScope(new CenterScope());

        /*
         * Auto-set center_id on create.
         *
         * ⚠️ **Never leave it NULL.** `current_center_id` is null for a super
         * admin who has not picked a centre — deliberately, so CenterScope
         * shows them everything — but a row written in that state belonged to
         * no centre at all. It was then invisible to every centre-scoped user
         * and matched no per-centre configuration: that is how an approval
         * chain could be listed on the admin screen and still never apply,
         * with quotations silently falling through to the management-role
         * fallback instead. Seeing all centres and writing into none are two
         * different things.
         *
         * So: the active centre, else the signed-in user's own, else the
         * default centre — the same fallback the centre migration used.
         */
        static::creating(function ($model) {
            if (! empty($model->center_id)) {
                return;
            }

            // ⚠️ A row that belongs to a job or an RFQ belongs to THAT centre,
            // whoever is typing — Head Office raising a gate pass for a
            // Chattogram job, or a client writing in from the portal (whose
            // session has no centre at all), must not land it in Dhaka.
            foreach (['work_order_id' => 'work_orders', 'rfq_id' => 'rfqs', 'quotation_id' => 'quotations'] as $fk => $table) {
                $parent = $model->getAttribute($fk);
                if ($parent && ($c = \Illuminate\Support\Facades\DB::table($table)->where('id', $parent)->value('center_id'))) {
                    $model->center_id = $c;
                    return;
                }
            }

            $model->center_id = (app()->bound('current_center_id') ? app('current_center_id') : null)
                ?: (auth('web')->user()?->center_id)
                ?: (auth('customer')->user()?->center_id)
                ?: \App\Models\Center::defaultId();
        });
    }

    public function center()
    {
        return $this->belongsTo(\App\Models\Center::class);
    }
}
