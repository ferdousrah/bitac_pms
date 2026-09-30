<?php

namespace App\Services;

use App\Events\NotificationPushed;
use App\Models\Notification;
use App\Models\User;

class NotifyService
{
    /**
     * Send a notification to one or more users.
     */
    public static function send(
        int|array $userIds,
        string $type,
        string $title,
        ?string $body = null,
        ?string $link = null,
        string $icon = 'fi-rr-bell',
        string $color = 'blue',
        ?array $data = null,
    ): void {
        $userIds = is_array($userIds) ? $userIds : [$userIds];

        foreach ($userIds as $userId) {
            $notification = Notification::create([
                'user_id' => $userId,
                'type'    => $type,
                'title'   => $title,
                'body'    => $body,
                'icon'    => $icon,
                'color'   => $color,
                'link'    => $link,
                'data'    => $data,
            ]);

            // Broadcast if broadcasting is configured
            try {
                event(new NotificationPushed($notification));
            } catch (\Throwable) {
                // Broadcasting may not be configured — silently skip
            }
        }
    }

    /**
     * Notify all users with a specific role.
     */
    public static function toRole(
        string $role,
        string $type,
        string $title,
        ?string $body = null,
        ?string $link = null,
        string $icon = 'fi-rr-bell',
        string $color = 'blue',
        ?array $data = null,
    ): void {
        $userIds = User::role($role)->pluck('id')->toArray();
        if (!empty($userIds)) {
            static::send($userIds, $type, $title, $body, $link, $icon, $color, $data);
        }
    }

    /**
     * Notify every user who holds a permission — optionally only at one centre.
     *
     * Recipients are chosen by **who holds the permission**, directly or
     * through any role. Two things follow from that, and both have bitten:
     *
     *  ⚠️ **Granting a permission to a role puts that role on this fan-out.**
     *    A super admin can already open any screen via `Gate::before`, so
     *    granting them a permission adds no access — only notifications they
     *    did not ask for. Grant for access, not out of habit.
     *
     *  ⚠️ **`User` has no `CenterScope`**, so without `$centerId` this reaches
     *    holders at *every* BITAC centre. Pass the document's centre for
     *    anything centre-specific. Users with **no centre set are always
     *    included**: not notifying someone at all is a worse failure than a
     *    little cross-centre noise, and unset centres are real in this data.
     */
    public static function toPermission(
        string $permission,
        string $type,
        string $title,
        ?string $body = null,
        ?string $link = null,
        string $icon = 'fi-rr-bell',
        string $color = 'blue',
        ?array $data = null,
        ?int $centerId = null,
    ): void {
        // Resilient lookup: if the permission row doesn't exist yet (e.g. a
        // fresh deploy without the matching seeder), don't crash the caller —
        // just log and silently skip the fan-out. The feature itself keeps
        // working; only the notification is lost.
        try {
            $userIds = User::permission($permission)
                ->when($centerId !== null, fn ($q) => $q->where(
                    fn ($w) => $w->where('center_id', $centerId)->orWhereNull('center_id')
                ))
                ->pluck('id')->toArray();
        } catch (\Spatie\Permission\Exceptions\PermissionDoesNotExist $e) {
            \Log::warning("NotifyService::toPermission — permission '{$permission}' does not exist. "
                . "Run the seeder + php artisan permission:cache-reset to fix.");
            return;
        }
        if (!empty($userIds)) {
            static::send($userIds, $type, $title, $body, $link, $icon, $color, $data);
        }
    }
}
