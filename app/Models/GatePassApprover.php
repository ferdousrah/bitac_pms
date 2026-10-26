<?php

namespace App\Models;

use App\Traits\HasCenter;
use Illuminate\Database\Eloquent\Model;

/**
 * The pool of people who may approve a gate pass — **per centre and per desk**.
 *
 * BITAC (2026-10-27): a pass IED issues is approved by IED's নির্বাহী
 * প্রকৌশলী, one PCD issues by PCD's — so each desk has its own pool
 * (`desk` = the pass's `origin`). Any one of the pool approves; there are no
 * levels. `HasCenter` scopes the admin screen to the active centre and stamps
 * `center_id` on create.
 */
class GatePassApprover extends Model
{
    use HasCenter;

    public const DESKS = ['ied' => 'IED', 'pcd' => 'PCD'];

    protected $fillable = ['center_id', 'user_id', 'desk'];

    public function user()
    {
        return $this->belongsTo(User::class);
    }

    /**
     * May this user approve gate passes for this centre and desk?
     *
     * ⚠️ `$centerId` is the PASS's centre, not the session's — an approver at
     * Dhaka must not be able to approve a Chittagong pass just because they
     * switched centres in the UI. Passing null asks "are they an approver
     * anywhere", which is only right for deciding whether to *show* a button
     * before a pass is in hand. `$desk` is the pass's `origin`.
     */
    public static function isApprover(int $userId, ?int $centerId = null, ?string $desk = null): bool
    {
        return static::withoutGlobalScopes()->where('user_id', $userId)
            ->when($centerId !== null, fn ($q) => $q->where('center_id', $centerId))
            ->when($desk !== null, fn ($q) => $q->where('desk', $desk))
            ->exists();
    }

    /**
     * The active approvers of one desk at one centre — who is told a pass is
     * waiting, and whether it has to wait at all: a desk with nobody in its
     * pool issues directly, as IED's always did (a gate with nobody behind it
     * must not hold the goods up).
     *
     * @return array<int>
     */
    public static function approverIds(?int $centerId, string $desk): array
    {
        return static::withoutGlobalScopes()
            ->join('users', 'users.id', '=', 'gate_pass_approvers.user_id')
            ->where('users.is_active', true)
            ->where('gate_pass_approvers.desk', $desk)
            ->when($centerId, fn ($q) => $q->where('gate_pass_approvers.center_id', $centerId))
            ->pluck('gate_pass_approvers.user_id')->map(fn ($id) => (int) $id)->unique()->values()->all();
    }
}
