<?php

namespace App\Models;

use App\Traits\HasCenter;
use Illuminate\Database\Eloquent\Model;

/**
 * The pool of people who may approve a PCD gate pass — **per centre**.
 *
 * Any one of a centre's approvers can approve that centre's passes; there are
 * no levels. `HasCenter` scopes the admin screen to the active centre and
 * stamps `center_id` on create.
 */
class GatePassApprover extends Model
{
    use HasCenter;

    protected $fillable = ['center_id', 'user_id'];

    public function user()
    {
        return $this->belongsTo(User::class);
    }

    /**
     * May this user approve gate passes for this centre?
     *
     * ⚠️ `$centerId` is the PASS's centre, not the session's — an approver at
     * Dhaka must not be able to approve a Chittagong pass just because they
     * switched centres in the UI. Passing null asks "are they an approver
     * anywhere", which is only right for deciding whether to *show* a button
     * before a pass is in hand.
     */
    public static function isApprover(int $userId, ?int $centerId = null): bool
    {
        $q = static::withoutGlobalScopes()->where('user_id', $userId);

        if ($centerId !== null) {
            $q->where('center_id', $centerId);
        }

        return $q->exists();
    }
}
