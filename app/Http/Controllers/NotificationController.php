<?php

namespace App\Http\Controllers;

use App\Models\Notification;
use Illuminate\Http\Request;
use Inertia\Inertia;

class NotificationController extends Controller
{
    /**
     * Dual-mode endpoint:
     *   - Inertia visits (Link clicks) → render the full Notifications page.
     *   - AJAX/axios (no X-Inertia header) → return JSON for the bell dropdown.
     */
    public function index(Request $request)
    {
        $notifications = Notification::forUser(auth()->id())
            ->latest()
            ->take(50)
            ->get()
            ->map(fn($n) => [
                'id'         => $n->id,
                'type'       => $n->type,
                'title'      => $n->title,
                'body'       => $n->body,
                'icon'       => $n->icon,
                'color'      => $n->color,
                'link'       => $n->link,
                'read'       => $n->read_at !== null,
                'created_at' => $n->created_at->diffForHumans(),
            ]);

        if ($request->header('X-Inertia')) {
            return Inertia::render('Notifications/Index', [
                'notifications' => $notifications,
            ]);
        }

        return response()->json($notifications);
    }

    public function unreadCount()
    {
        $count = Notification::forUser(auth()->id())->unread()->count();
        return response()->json(['count' => $count]);
    }

    public function markAsRead(Notification $notification)
    {
        abort_unless($notification->user_id === auth()->id(), 403);
        $notification->markAsRead();
        return response()->json(['ok' => true]);
    }

    public function markAllRead()
    {
        Notification::forUser(auth()->id())
            ->unread()
            ->update(['read_at' => now()]);

        return response()->json(['ok' => true]);
    }
}
