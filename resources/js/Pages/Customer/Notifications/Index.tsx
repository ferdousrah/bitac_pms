import CustomerLayout from '@/Layouts/CustomerLayout';
import { Link, router } from '@inertiajs/react';
import axios from 'axios';

const COLOR_BG: Record<string, string> = {
    blue:    'bg-blue-50 text-blue-600 border-blue-100',
    green:   'bg-emerald-50 text-emerald-600 border-emerald-100',
    red:     'bg-rose-50 text-rose-600 border-rose-100',
    amber:   'bg-amber-50 text-amber-600 border-amber-100',
    purple:  'bg-purple-50 text-purple-600 border-purple-100',
    indigo:  'bg-indigo-50 text-indigo-600 border-indigo-100',
    slate:   'bg-slate-50 text-slate-600 border-slate-100',
    teal:    'bg-teal-50 text-teal-600 border-teal-100',
};

export default function CustomerNotificationsIndex({ notifications, unread_count }: any) {
    const rows = notifications?.data ?? [];

    const open = async (n: any) => {
        if (!n.is_read) {
            try { await axios.post(`/customer/notifications/${n.id}/read`); } catch {}
        }
        if (n.link) router.visit(n.link);
    };

    const markAllRead = () => router.post('/customer/notifications/read-all', {}, { preserveScroll: true });

    return (
        <CustomerLayout title="Notifications">
            <div className="card">
                <div className="card-header flex items-center justify-between">
                    <div>
                        <h2 className="text-sm font-bold text-surface-900">All Notifications</h2>
                        <p className="text-xs text-surface-400 mt-0.5">
                            {notifications?.total ?? rows.length} total · {unread_count} unread
                        </p>
                    </div>
                    {unread_count > 0 && (
                        <button onClick={markAllRead} className="btn-outline btn-sm">
                            <i className="fi fi-rr-check-double text-xs leading-none" /> Mark all read
                        </button>
                    )}
                </div>

                <div className="card-body p-0">
                    {rows.length === 0 ? (
                        <div className="empty-state">
                            <div className="empty-state-icon"><i className="fi fi-rr-bell-slash" /></div>
                            <p className="empty-state-title">No notifications yet</p>
                            <p className="empty-state-text">Updates from BITAC will appear here.</p>
                        </div>
                    ) : (
                        <ul className="divide-y divide-surface-100">
                            {rows.map((n: any) => {
                                const colors = COLOR_BG[n.color] ?? COLOR_BG.blue;
                                const isClickable = !!n.link;
                                return (
                                    <li key={n.id}
                                        onClick={() => open(n)}
                                        className={`flex items-start gap-3 px-5 py-4 transition-colors
                                            ${isClickable ? 'cursor-pointer hover:bg-surface-50' : ''}
                                            ${!n.is_read ? 'bg-blue-50/30' : ''}`}
                                    >
                                        <div className={`w-10 h-10 rounded-xl shrink-0 border flex items-center justify-center ${colors}`}>
                                            <i className={`fi ${n.icon} text-base leading-none`} />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-start justify-between gap-2">
                                                <h3 className={`text-sm leading-tight ${!n.is_read ? 'font-bold text-surface-900' : 'font-medium text-surface-700'}`}>
                                                    {n.title}
                                                </h3>
                                                {!n.is_read && <span className="w-2 h-2 rounded-full bg-blue-500 mt-1.5 shrink-0" />}
                                            </div>
                                            <p className="text-xs text-surface-600 mt-1 whitespace-pre-line">{n.message}</p>
                                            <div className="flex items-center gap-2 mt-2 text-[10px] text-surface-400">
                                                <span>{n.time_ago}</span>
                                                <span>·</span>
                                                <span>{n.created_at}</span>
                                                {n.read_at && (
                                                    <>
                                                        <span>·</span>
                                                        <span className="text-emerald-600">Read {n.read_at}</span>
                                                    </>
                                                )}
                                            </div>
                                        </div>
                                        {isClickable && (
                                            <i className="fi fi-rr-arrow-right text-surface-300 text-xs leading-none mt-3" />
                                        )}
                                    </li>
                                );
                            })}
                        </ul>
                    )}
                </div>

                {/* Pagination */}
                {notifications?.links && notifications.links.length > 3 && (
                    <div className="card-body border-t border-surface-100 flex items-center justify-center gap-1 flex-wrap">
                        {notifications.links.map((l: any, i: number) => (
                            <Link key={i}
                                href={l.url ?? '#'}
                                preserveScroll
                                className={`px-3 py-1 rounded-md text-xs font-semibold
                                    ${l.active ? 'bg-surface-900 text-white' :
                                      l.url ? 'text-surface-700 hover:bg-surface-100' : 'text-surface-300 cursor-not-allowed'}`}
                                dangerouslySetInnerHTML={{ __html: l.label }}
                            />
                        ))}
                    </div>
                )}
            </div>
        </CustomerLayout>
    );
}
