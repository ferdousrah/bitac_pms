<?php

namespace App\Services;

use App\Models\Section;
use App\Models\User;
use App\Models\WorkOrderSection;

/**
 * Who in a shop may do what with a job — the one place that knows.
 *
 * BITAC's shops run নির্বাহী প্রকৌশলী over assistant engineers. A job arriving
 * at a shop is the XEN's until he hands it to an AE (or sends it straight to a
 * sub-section); the AE then receives it and does the work.
 *
 * ⚠️ **The XEN is whoever holds `assign shop-jobs` at that shop.** There is no
 * supervisor column to keep in step with people moving posts.
 *
 * ⚠️ **A shop with NO XEN behaves exactly as it always did** — `gateActive()`
 * is false and every rule here lets everyone through. That is deliberate: a
 * shop whose staff were never given the role must not wake up to an empty
 * queue, and in-flight jobs carry `assigned_to = null`. The same shape as an
 * empty quotation approval chain.
 */
class ShopAssignment
{
    public const PERMISSION = 'assign shop-jobs';

    /** Does this shop run the XEN → AE flow at all? */
    public static function gateActive(?int $shopId): bool
    {
        return $shopId !== null && self::xenIds($shopId) !== [];
    }

    /** @return array<int,int> the XENs posted to this shop */
    public static function xenIds(int $shopId): array
    {
        return self::staff($shopId)
            ->filter(fn (User $u) => $u->can(self::PERMISSION))
            ->pluck('id')->map(fn ($id) => (int) $id)->all();
    }

    /**
     * The assistant engineers a job can be handed to: posted to this shop and
     * NOT the XEN.
     *
     * ⚠️ Staff of a SUB-section are not here. A sub-section is a destination,
     * not a person — forwarding to one is the other half of the XEN's choice.
     */
    public static function assistants(int $shopId)
    {
        return self::staff($shopId)
            ->reject(fn (User $u) => $u->can(self::PERMISSION))
            ->values();
    }

    public static function isXen(?User $user, ?int $shopId): bool
    {
        if (! $user || ! $shopId) return false;

        // Someone who can open every shop (a super admin) is not thereby the
        // XEN of this one, but they must not be locked out either — see
        // canOversee().
        return (int) $user->section_id === (int) $shopId && $user->can(self::PERMISSION);
    }

    /** May this person act for the shop as a whole (forward, transfer, flag)? */
    public static function canOversee(?User $user, ?int $shopId): bool
    {
        if (! $user) return false;
        if (self::seesEverything($user)) return true;
        if (! self::gateActive($shopId)) return true;   // no XEN → the old behaviour

        return self::isXen($user, $shopId);
    }

    /**
     * Why this person cannot work on this job yet — null when they may.
     *
     * Three answers, and they are different things: the job is somebody
     * else's, the job has not been handed to anyone, or it has been handed
     * over but not taken in hand.
     */
    public static function workBlocker(WorkOrderSection $wos, ?User $user): ?string
    {
        if (! $user || self::seesEverything($user)) return null;
        if (! self::gateActive($wos->section_id)) return null;

        // A sub-section supervisor works to their own steps; the shop's
        // handover is not about them.
        if (self::isSubSectionStaff($user, $wos->section_id)) return null;

        if (self::isXen($user, $wos->section_id)) return null;

        if ($wos->assigned_to === null) {
            return 'This job has not been handed to anyone yet — the নির্বাহী প্রকৌশলী forwards it first.';
        }

        if ((int) $wos->assigned_to !== (int) $user->id) {
            return 'This job is with ' . ($wos->assignedTo?->name ?? 'another engineer') . '.';
        }

        if ($wos->received_at === null) {
            return 'Receive this job first — then you can assign sub-sections and log output.';
        }

        return null;
    }

    /** Should this person's queue be narrowed to what is theirs? */
    public static function scopedToOwnWork(?User $user, ?int $shopId): bool
    {
        if (! $user || ! self::gateActive($shopId)) return false;
        if (self::seesEverything($user)) return false;
        if (self::isXen($user, $shopId)) return false;

        // Only the shop's own assistants are narrowed. Sub-section staff are
        // already scoped by their steps.
        return (int) $user->section_id === (int) $shopId;
    }

    /** The shop's people, for a picker. */
    private static function staff(int $shopId)
    {
        return User::withoutGlobalScopes()
            ->where('section_id', $shopId)
            ->orderBy('name')
            ->get();
    }

    private static function isSubSectionStaff(?User $user, int $shopId): bool
    {
        if (! $user?->section_id || (int) $user->section_id === $shopId) return false;

        return (int) (Section::find($user->section_id)?->parent_id) === $shopId;
    }

    /** Admins see and do everything, here as everywhere. */
    private static function seesEverything(User $user): bool
    {
        return $user->isSuperAdmin() || $user->hasRole('admin') || $user->can('manage users');
    }
}
