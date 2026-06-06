import { Link, router } from '@inertiajs/react';
import axios from 'axios';
import { useEffect, useRef, useState } from 'react';

interface Notification {
    id: number;
    type: string;
    title: string;
    message: string;
    link?: string | null;
    icon: string;
    color: string;
    is_read: boolean;
    created_at: string;
    time_ago: string;
}

interface Props {
    initialUnread: number;
}

const COLOR_BG: Record<string, string> = {
    blue:    'bg-blue-50 text-blue-600',
    green:   'bg-emerald-50 text-emerald-600',
    red:     'bg-rose-50 text-rose-600',
    amber:   'bg-amber-50 text-amber-600',
    purple:  'bg-purple-50 text-purple-600',
    indigo:  'bg-indigo-50 text-indigo-600',
    slate:   'bg-slate-50 text-slate-600',
    teal:    'bg-teal-50 text-teal-600',
};

export default function NotificationBell({ initialUnread }: Props) {
    const [open, setOpen] = useState(false);
    const [unread, setUnread] = useState(initialUnread);
    const [items, setItems] = useState<Notification[]>([]);
    const [loading, setLoading] = useState(false);
    const wrapperRef = useRef<HTMLDivElement>(null);

    // Poll every 20s for new notifications
    useEffect(() => {
        const fetchOnce = async () => {
            try {
                const { data } = await axios.get('/customer/notifications/poll');
                setUnread(data.unread_count ?? 0);
                if (Array.isArray(data.recent)) setItems(data.recent);
            } catch { /* silent */ }
        };
        fetchOnce(); // initial fetch for the dropdown content
        const t = setInterval(fetchOnce, 20_000);
        return () => clearInterval(t);
    }, []);

    // Close on outside click
    useEffect(() => {
        if (!open) return;
        const onDown = (e: MouseEvent) => {
            if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) setOpen(false);
        };
        document.addEventListener('mousedown', onDown);
        return () => document.removeEventListener('mousedown', onDown);
    }, [open]);

    const handleClickNotif = async (n: Notification) => {
        if (!n.is_read) {
            try {
                await axios.post(`/customer/notifications/${n.id}/read`);
                setUnread(u => Math.max(0, u - 1));
                setItems(prev => prev.map(x => x.id === n.id ? { ...x, is_read: true } : x));
            } catch { /* silent */ }
        }
        setOpen(false);
        if (n.link) router.visit(n.link);
    };

    const markAllRead = async () => {
        setLoading(true);
        try {
            await axios.post('/customer/notifications/read-all');
            setUnread(0);
            setItems(prev => prev.map(x => ({ ...x, is_read: true })));
        } catch { /* silent */ }
        setLoading(false);
    };

    return (
        <div ref={wrapperRef} className="relative">
            <button
                onClick={() => setOpen(o => !o)}
                className={`relative p-2 rounded-xl transition-colors
                    ${open ? 'bg-surface-100' : 'hover:bg-surface-50'}`}
                title="Notifications"
                aria-label="Notifications"
            >
                <i className="fi fi-rr-bell text-lg leading-none text-surface-700" />
                {unread > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full
                                     bg-rose-600 text-white text-[10px] font-bold flex items-center justify-center
                                     ring-2 ring-white shadow-sm">
                        {unread > 99 ? '99+' : unread}
                    </span>
                )}
            </button>

            {open && (
                <div className="absolute right-0 mt-2 w-[360px] max-w-[calc(100vw-32px)] bg-white rounded-2xl shadow-[0_20px_60px_-15px_rgba(0,0,0,0.25)] border border-surface-100 z-50 overflow-hidden animate-scale-in origin-top-right">
                    <div className="px-4 py-3 border-b border-surface-100 flex items-center justify-between">
                        <div>
                            <h3 className="text-sm font-bold text-surface-900">Notifications</h3>
                            <p className="text-[10px] text-surface-400 mt-0.5">
                                {unread > 0 ? `${unread} unread` : 'You\'re all caught up'}
                            </p>
                        </div>
                        {unread > 0 && (
                            <button onClick={markAllRead} disabled={loading}
                                className="text-[11px] font-semibold text-brand-600 hover:text-brand-700">
                                Mark all read
                            </button>
                        )}
                    </div>

                    <div className="max-h-[400px] overflow-y-auto">
                        {items.length === 0 ? (
                            <div className="px-4 py-8 text-center">
                                <i className="fi fi-rr-bell-slash text-2xl text-surface-300" />
                                <p className="text-xs text-surface-400 mt-2">No notifications yet</p>
                            </div>
                        ) : (
                            <ul className="divide-y divide-surface-50">
                                {items.map((n) => {
                                    const isClickable = !!n.link;
                                    return (
                                        <li
                                            key={n.id}
                                            onClick={() => handleClickNotif(n)}
                                            className={`px-4 py-3 flex items-start gap-3 transition-colors
                                                ${isClickable ? 'cursor-pointer hover:bg-surface-50' : ''}
                                                ${!n.is_read ? 'bg-blue-50/30' : ''}`}
                                        >
                                            <div className={`w-9 h-9 rounded-xl shrink-0 flex items-center justify-center ${COLOR_BG[n.color] ?? COLOR_BG.blue}`}>
                                                <i className={`fi ${n.icon} text-sm leading-none`} />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-start justify-between gap-2">
                                                    <p className={`text-sm leading-tight ${!n.is_read ? 'font-bold text-surface-900' : 'font-medium text-surface-700'}`}>
                                                        {n.title}
                                                    </p>
                                                    {!n.is_read && (
                                                        <span className="w-2 h-2 rounded-full bg-blue-500 mt-1.5 shrink-0" />
                                                    )}
                                                </div>
                                                <p className="text-xs text-surface-500 mt-0.5 line-clamp-2">{n.message}</p>
                                                <p className="text-[10px] text-surface-400 mt-1">{n.time_ago}</p>
                                            </div>
                                        </li>
                                    );
                                })}
                            </ul>
                        )}
                    </div>

                    <div className="px-4 py-2.5 border-t border-surface-100 bg-surface-50/50">
                        <Link href="/customer/notifications" onClick={() => setOpen(false)}
                            className="block text-center text-xs font-semibold text-brand-600 hover:text-brand-700">
                            View all notifications →
                        </Link>
                    </div>
                </div>
            )}
        </div>
    );
}
