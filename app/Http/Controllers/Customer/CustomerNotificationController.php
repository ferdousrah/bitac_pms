<?php

namespace App\Http\Controllers\Customer;

use App\Http\Controllers\Controller;
use App\Models\CustomerNotification;
use Illuminate\Http\Request;
use Inertia\Inertia;

class CustomerNotificationController extends Controller
{
    /** Full-page list of all notifications. */
    public function index(Request $request)
    {
        $customer = auth('customer')->user();

        $notifications = $customer->notifications()
            ->latest()
            ->paginate(30)
            ->through(fn ($n) => $this->serialize($n));

        return Inertia::render('Customer/Notifications/Index', [
            'notifications' => $notifications,
            'unread_count'  => $customer->notifications()->unread()->count(),
        ]);
    }

    /** Lightweight polling endpoint — returns count + recent few. */
    public function poll(Request $request)
    {
        $customer = auth('customer')->user();

        return response()->json([
            'unread_count' => $customer->notifications()->unread()->count(),
            'recent'       => $customer->notifications()->latest()->limit(10)->get()
                ->map(fn ($n) => $this->serialize($n))->values(),
        ]);
    }

    public function markRead(CustomerNotification $notification)
    {
        $customer = auth('customer')->user();
        abort_unless($notification->customer_id === $customer->id, 403);
        $notification->markRead();
        return response()->json(['ok' => true]);
    }

    public function markAllRead()
    {
        $customer = auth('customer')->user();
        $customer->notifications()->unread()->update(['is_read' => true, 'read_at' => now()]);
        return back();
    }

    private function serialize(CustomerNotification $n): array
    {
        return [
            'id'         => $n->id,
            'type'       => $n->type,
            'title'      => $n->title ?? $this->fallbackTitle($n),
            'message'    => $n->message,
            'link'       => $n->link,
            'icon'       => $n->icon ?: 'fi-rr-bell',
            'color'      => $n->color ?: 'blue',
            'is_read'    => (bool) $n->is_read,
            'read_at'    => $n->read_at?->format('d M Y, h:i A'),
            'created_at' => $n->created_at->format('d M Y, h:i A'),
            'time_ago'   => $n->created_at->diffForHumans(),
        ];
    }

    /** Friendly title fallback for legacy rows where title is null. */
    private function fallbackTitle(CustomerNotification $n): string
    {
        return match ($n->type) {
            'status_update'           => 'Order update',
            'complaint_response'      => 'Reply on your feedback',
            'complaint_accepted'      => 'Feedback accepted',
            'rfq_quoted'              => 'Quotation ready',
            'work_order_milestone'    => 'Production update',
            'invoice_issued'          => 'New invoice',
            default                   => 'Notification',
        };
    }
}
