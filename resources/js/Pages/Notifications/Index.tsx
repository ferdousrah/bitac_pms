import AppLayout from '@/Layouts/AppLayout';
import { Link, router } from '@inertiajs/react';
import { useMemo, useState } from 'react';
import axios from 'axios';

interface Notification {
    id: number;
    type: string;
    title: string;
    body: string | null;
    icon: string | null;
    color: string | null;
    link: string | null;
    read: boolean;
    created_at: string;
}

interface Props {
    notifications: Notification[];
}

// Color palette per notification type/color string from the backend.
// Static class names so Tailwind's JIT compiles them at build.
const COLOR_CLASSES: Record<string, { bg: string; text: string; dot: string }> = {
    green:   { bg: 'bg-emerald-50',  text: 'text-emerald-700', dot: 'bg-emerald-500' },
    blue:    { bg: 'bg-blue-50',     text: 'text-blue-700',    dot: 'bg-blue-500' },
    amber:   { bg: 'bg-amber-50',    text: 'text-amber-700',   dot: 'bg-amber-500' },
    red:     { bg: 'bg-red-50',      text: 'text-red-700',     dot: 'bg-red-500' },
    purple:  { bg: 'bg-purple-50',   text: 'text-purple-700',  dot: 'bg-purple-500' },
    brand:   { bg: 'bg-brand-50',    text: 'text-brand-700',   dot: 'bg-brand-500' },
};

export default function NotificationsIndex({ notifications }: Props) {
    const [filter, setFilter] = useState<'all' | 'unread' | 'read'>('all');
    const [items, setItems] = useState(notifications);

    const filtered = useMemo(() => {
        if (filter === 'unread') return items.filter(n => !n.read);
        if (filter === 'read')   return items.filter(n => n.read);
        return items;
    }, [items, filter]);

    const unreadCount = items.filter(n => !n.read).length;

    const markRead = (id: number) => {
        axios.post(`/notifications/${id}/read`).catch(() => {});
        setItems(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
    };

    const markAllRead = () => {
        if (unreadCount === 0) return;
        axios.post('/notifications/read-all').catch(() => {});
        setItems(prev => prev.map(n => ({ ...n, read: true })));
    };

    const open = (n: Notification) => {
        if (!n.read) markRead(n.id);
        if (n.link) router.visit(n.link);
    };

    return (
        <AppLayout header="Notifications">
            <div className="max-w-3xl space-y-6 animate-fade-in">
                <div className="page-header">
                    <div>
                        <h1 className="page-title">Notifications</h1>
                        <p className="page-subtitle">
                            {unreadCount > 0
                                ? `${unreadCount} unread · ${items.length} total`
                                : `All caught up · ${items.length} total`}
                        </p>
                    </div>
                    {unreadCount > 0 && (
                        <button onClick={markAllRead} className="btn-outline btn-sm">
                            <i className="fi fi-rr-check-double text-xs leading-none" />
                            Mark all as read
                        </button>
                    )}
                </div>

                {/* Filter tabs */}
                <div className="inline-flex rounded-xl bg-white border border-surface-200 p-0.5 text-sm">
                    {(['all', 'unread', 'read'] as const).map(f => (
                        <button
                            key={f}
                            onClick={() => setFilter(f)}
                            className={`px-4 py-1.5 rounded-lg font-semibold capitalize transition-colors ${
                                filter === f
                                    ? 'bg-brand-500 text-white'
                                    : 'text-surface-500 hover:bg-surface-50'
                            }`}
                        >
                            {f}
                            {f === 'unread' && unreadCount > 0 && (
                                <span className={`ml-1.5 text-[10px] px-1.5 py-0.5 rounded-md font-bold ${
                                    filter === f ? 'bg-white/20 text-white' : 'bg-amber-100 text-amber-700'
                                }`}>{unreadCount}</span>
                            )}
                        </button>
                    ))}
                </div>

                {/* Notification list */}
                {filtered.length === 0 ? (
                    <div className="card">
                        <div className="card-body py-12 text-center">
                            <div className="w-16 h-16 mx-auto rounded-2xl bg-surface-100 flex items-center justify-center mb-3">
                                <i className="fi fi-rr-bell text-surface-400 text-2xl" />
                            </div>
                            <div className="text-base font-bold text-surface-900">
                                {filter === 'unread' ? 'No unread notifications' : filter === 'read' ? 'No read notifications yet' : 'No notifications yet'}
                            </div>
                            <p className="text-xs text-surface-500 mt-1">You'll see updates here as work progresses through the system.</p>
                        </div>
                    </div>
                ) : (
                    <div className="space-y-2">
                        {filtered.map(n => {
                            const palette = COLOR_CLASSES[n.color ?? 'brand'] ?? COLOR_CLASSES.brand;
                            return (
                                <div
                                    key={n.id}
                                    className={`card group cursor-pointer hover:shadow-md transition-all ${!n.read ? 'border-l-4 border-l-amber-400' : ''}`}
                                    onClick={() => open(n)}
                                >
                                    <div className="card-body flex items-start gap-3">
                                        <div className={`w-10 h-10 rounded-xl ${palette.bg} ${palette.text} flex items-center justify-center shrink-0`}>
                                            <i className={`fi ${n.icon || 'fi-rr-bell'} text-base leading-none`} />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-start justify-between gap-2 flex-wrap">
                                                <div className="text-sm font-bold text-surface-900">{n.title}</div>
                                                <div className="flex items-center gap-2 shrink-0">
                                                    {!n.read && <span className={`w-2 h-2 rounded-full ${palette.dot}`} title="Unread" />}
                                                    <span className="text-[11px] text-surface-400 font-medium">{n.created_at}</span>
                                                </div>
                                            </div>
                                            {n.body && (
                                                <p className="text-xs text-surface-600 mt-1 whitespace-pre-line leading-relaxed">{n.body}</p>
                                            )}
                                            {n.link && (
                                                <div className="text-[11px] font-semibold text-brand-600 mt-1.5 inline-flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    View details <i className="fi fi-rr-arrow-small-right text-[10px] leading-none" />
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}

                <div className="text-center text-[11px] text-surface-400">
                    Showing the {items.length} most recent. Older notifications are auto-archived.
                </div>
            </div>
        </AppLayout>
    );
}
