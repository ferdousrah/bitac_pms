<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/**
 * A centre's revenue target for one financial year, in taka.
 *
 * One figure per centre per year (enforced by a unique). Set by that centre's
 * admin for their own centre; a super admin may set any.
 *
 * No `HasCenter` — the report deliberately reads across centres so a super
 * admin can see all of them at once, and every query here names the centre it
 * wants explicitly.
 */
class CenterTarget extends Model
{
    protected $fillable = ['center_id', 'financial_year', 'target_amount', 'note', 'set_by'];

    protected $casts = ['target_amount' => 'decimal:2'];

    public function center() { return $this->belongsTo(Center::class); }
    public function setBy()  { return $this->belongsTo(User::class, 'set_by'); }
}
