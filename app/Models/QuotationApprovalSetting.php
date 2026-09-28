<?php

namespace App\Models;

use App\Traits\HasCenter;
use Illuminate\Database\Eloquent\Model;

/**
 * One step of a centre's approval chain.
 *
 * ⚠️ Used by BOTH quotations and cost estimates — `QuotationService` and
 * `CostEstimateController::buildApprovalChain()` read the same rows. The name
 * is historical.
 *
 * **Chains are per centre.** `HasCenter` scopes reads to the active centre and
 * stamps `center_id` on create, which is what the admin screen wants. Building
 * a chain for a DOCUMENT is different — it must follow that document's centre,
 * not whoever happens to be logged in — so use `forCenter()` there.
 */
class QuotationApprovalSetting extends Model
{
    use HasCenter;

    protected $fillable = ['center_id', 'level', 'approver_id', 'label'];

    public function approver()
    {
        return $this->belongsTo(User::class, 'approver_id');
    }

    /**
     * The chain belonging to a given centre, in order.
     *
     * Deliberately bypasses the global scope: a super admin with another
     * centre selected (or no centre at all) must still build the chain that
     * belongs to the document, not the one they happen to be looking at.
     */
    public static function forCenter(?int $centerId)
    {
        return static::withoutGlobalScopes()
            ->where('center_id', $centerId)
            ->orderBy('level');
    }
}
