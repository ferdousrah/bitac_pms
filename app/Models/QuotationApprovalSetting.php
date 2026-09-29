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

    /** Quotations and cost estimates share `quotation`; work orders have their own. */
    public const DOC_QUOTATION  = 'quotation';
    public const DOC_WORK_ORDER = 'work_order';

    public const DOC_TYPES = [
        self::DOC_QUOTATION  => 'Quotations & Cost Estimates',
        self::DOC_WORK_ORDER => 'Work Order Acceptance',
    ];

    protected $fillable = ['center_id', 'document_type', 'level', 'approver_id', 'label'];

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
    public static function forCenter(?int $centerId, string $documentType = self::DOC_QUOTATION)
    {
        return static::withoutGlobalScopes()
            ->where('center_id', $centerId)
            ->where('document_type', $documentType)
            ->orderBy('level');
    }

    /**
     * The chain to build for a document — what every chain builder should call.
     *
     * ⚠️ A document with **no centre at all** is a data defect, not a second
     * centre: it can only have been written before `HasCenter` stopped
     * allowing NULL. It falls back to the default centre's chain, because the
     * alternative — no chain — sends the document to the management-role
     * fallback and quietly ignores the approvers BITAC configured.
     *
     * A **real** centre with no chain of its own does NOT borrow another's.
     * Chains are separate per centre (BITAC's decision); that case keeps the
     * caller's own fallback.
     */
    public static function resolveFor(?int $centerId, string $documentType = self::DOC_QUOTATION)
    {
        $rows = static::forCenter($centerId, $documentType)->get();

        if ($rows->isEmpty() && $centerId === null) {
            $default = \App\Models\Center::defaultId();
            if ($default !== null) {
                return static::forCenter($default, $documentType)->get();
            }
        }

        return $rows;
    }
}
