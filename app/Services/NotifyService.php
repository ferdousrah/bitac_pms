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
     * Notify all users with any of the given permissions.
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
    ): void {
        // Resilient lookup: if the permission row doesn't exist yet (e.g. a
        // fresh deploy without the matching seeder), don't crash the caller —
        // just log and silently skip the fan-out. The feature itself keeps
        // working; only the notification is lost.
        try {
            $userIds = User::permission($permission)->pluck('id')->toArray();
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
