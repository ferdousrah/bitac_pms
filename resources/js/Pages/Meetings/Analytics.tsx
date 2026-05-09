import AppLayout from '@/Layouts/AppLayout';
import { Link } from '@inertiajs/react';
import { motion } from 'motion/react';
import {
    Users, Video, CheckCircle2, Circle, TrendingUp, Calendar,
    Clock, AlertTriangle, BarChart3, ArrowRight, Activity,
} from 'lucide-react';

interface Props {
    meetings: any[];
    stats: {
        total_meetings: number;
        active_now: number;
        ended_this_month: number;
        total_action_items: number;
        pending_action_items: number;
        completed_action_items: number;
        total_decisions: number;
    };
    myActionItems: any[];
}

const STAT_CARDS = [
    { key: 'total_meetings', label: 'Total Meetings', icon: Video, color: 'text-indigo-500', bg: 'bg-indigo-50' },
    { key: 'active_now', label: 'Active Now', icon: Activity, color: 'text-emerald-500', bg: 'bg-emerald-50' },
    { key: 'ended_this_month', label: 'This Month', icon: Calendar, color: 'text-purple-500', bg: 'bg-purple-50' },
    { key: 'pending_action_items', label: 'Pending Items', icon: AlertTriangle, color: 'text-amber-500', bg: 'bg-amber-50' },
    { key: 'completed_action_items', label: 'Completed', icon: CheckCircle2, color: 'text-green-500', bg: 'bg-green-50' },
    { key: 'total_decisions', label: 'Decisions Made', icon: TrendingUp, color: 'text-rose-500', bg: 'bg-rose-50' },
];

const STATUS_BADGES: Record<string, { bg: string; text: string; label: string }> = {
    active:  { bg: 'bg-emerald-100', text: 'text-emerald-700', label: 'Live' },
    waiting: { bg: 'bg-yellow-100', text: 'text-yellow-700', label: 'Waiting' },
    ended:   { bg: 'bg-surface-100', text: 'text-surface-600', label: 'Ended' },
};

export default function MeetingAnalytics({ meetings, stats, myActionItems }: Props) {
    const completionRate = stats.total_action_items > 0
        ? Math.round((stats.completed_action_items / stats.total_action_items) * 100)
        : 0;

    return (
        <AppLayout header="Meeting Analytics">
            <div className="max-w-7xl space-y-6 animate-fade-in">
                {/* Stats Grid */}
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                    {STAT_CARDS.map((card, i) => {
                        const Icon = card.icon;
                        return (
                            <motion.div
                                key={card.key}
                                className="card hover:shadow-md transition-all"
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: i * 0.05 }}
                            >
                                <div className="card-body p-3">
                                    <div className="flex items-center gap-2">
                                        <div className={`w-8 h-8 rounded-xl ${card.bg} flex items-center justify-center shrink-0`}>
                                            <Icon className={`w-4 h-4 ${card.color}`} />
                                        </div>
                                        <div className="min-w-0">
                                            <div className="text-xs text-surface-400 font-semibold uppercase tracking-wider truncate">{card.label}</div>
                                            <div className="text-xl font-bold text-surface-900">{(stats as any)[card.key]}</div>
                                        </div>
                                    </div>
                                </div>
                            </motion.div>
                        );
                    })}
                </div>

                {/* Completion Rate + My Action Items */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                    {/* Completion rate card */}
                    <div className="card">
                        <div className="card-header">
                            <div className="flex items-center gap-2">
                                <BarChart3 className="w-4 h-4 text-indigo-500" />
                                <h3 className="font-bold text-surface-900">Action Item Completion</h3>
                            </div>
                        </div>
                        <div className="card-body">
                            <div className="flex items-center justify-center py-4">
                                <div className="relative w-32 h-32">
                                    <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                                        <circle cx="50" cy="50" r="40" stroke="rgb(243 244 246)" strokeWidth="8" fill="none" />
                                        <motion.circle
                                            cx="50" cy="50" r="40"
                                            stroke="rgb(99 102 241)"
                                            strokeWidth="8"
                                            fill="none"
                                            strokeDasharray={`${2 * Math.PI * 40}`}
                                            initial={{ strokeDashoffset: 2 * Math.PI * 40 }}
                                            animate={{ strokeDashoffset: 2 * Math.PI * 40 * (1 - completionRate / 100) }}
                                            transition={{ duration: 1, ease: 'easeOut' }}
                                            strokeLinecap="round"
                                        />
                                    </svg>
                                    <div className="absolute inset-0 flex items-center justify-center">
                                        <div className="text-center">
                                            <div className="text-3xl font-bold text-surface-900">{completionRate}%</div>
                                            <div className="text-xs text-surface-400">done</div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <div className="flex items-center justify-around text-xs">
                                <div className="text-center">
                                    <div className="font-bold text-surface-800">{stats.completed_action_items}</div>
                                    <div className="text-surface-400">Completed</div>
                                </div>
                                <div className="text-center">
                                    <div className="font-bold text-amber-600">{stats.pending_action_items}</div>
                                    <div className="text-surface-400">Pending</div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* My action items */}
                    <div className="card lg:col-span-2">
                        <div className="card-header">
                            <div className="flex items-center gap-2">
                                <Circle className="w-4 h-4 text-amber-500" />
                                <h3 className="font-bold text-surface-900">My Action Items</h3>
                                <span className="ml-auto text-xs text-surface-400">{myActionItems.length} open</span>
                            </div>
                        </div>
                        <div className="card-body p-0">
                            {myActionItems.length === 0 ? (
                                <div className="text-center py-8 text-surface-400 text-sm">
                                    <CheckCircle2 className="w-8 h-8 mx-auto mb-2 text-emerald-300" />
                                    No pending action items assigned to you.
                                </div>
                            ) : (
                                <div className="divide-y divide-surface-100">
                                    {myActionItems.slice(0, 8).map((item) => (
                                        <Link
                                            key={item.id}
                                            href={`/meetings/${item.meeting_id}/summary`}
                                            className="block px-4 py-2.5 hover:bg-surface-50 transition-colors"
                                        >
                                            <div className="flex items-start gap-3">
                                                <Circle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                                                <div className="flex-1 min-w-0">
                                                    <div className="text-sm font-medium text-surface-900 truncate">{item.description}</div>
                                                    <div className="flex items-center gap-2 mt-0.5 text-xs text-surface-500">
                                                        <span className="truncate">{item.meeting?.title}</span>
                                                        {item.due_date && (
                                                            <span className="text-orange-500">
                                                                📅 {new Date(item.due_date).toLocaleDateString()}
                                                            </span>
                                                        )}
                                                        {item.priority === 'high' && (
                                                            <span className="px-1.5 py-0.5 rounded-full bg-red-100 text-red-700 text-[9px] font-bold">HIGH</span>
                                                        )}
                                                    </div>
                                                </div>
                                                <ArrowRight className="w-4 h-4 text-surface-300 shrink-0" />
                                            </div>
                                        </Link>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Recent Meetings Table */}
                <div className="card">
                    <div className="card-header">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <Video className="w-4 h-4 text-indigo-500" />
                                <h3 className="font-bold text-surface-900">Recent Meetings</h3>
                            </div>
                            <Link href="/meetings" className="text-xs text-brand-500 hover:text-brand-600 font-semibold">
                                View all →
                            </Link>
                        </div>
                    </div>
                    <div className="card-body p-0 overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead className="bg-surface-50 border-b border-surface-100">
                                <tr>
                                    <th className="text-left py-2 px-4 text-xs font-semibold text-surface-500 uppercase">Meeting</th>
                                    <th className="text-left py-2 px-4 text-xs font-semibold text-surface-500 uppercase">Host</th>
                                    <th className="text-center py-2 px-4 text-xs font-semibold text-surface-500 uppercase">Status</th>
                                    <th className="text-center py-2 px-4 text-xs font-semibold text-surface-500 uppercase">Participants</th>
                                    <th className="text-center py-2 px-4 text-xs font-semibold text-surface-500 uppercase">Messages</th>
                                    <th className="text-center py-2 px-4 text-xs font-semibold text-surface-500 uppercase">Actions</th>
                                    <th className="text-center py-2 px-4 text-xs font-semibold text-surface-500 uppercase">Decisions</th>
                                    <th className="text-left py-2 px-4 text-xs font-semibold text-surface-500 uppercase">Date</th>
                                    <th></th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-surface-100">
                                {meetings.length === 0 ? (
                                    <tr>
                                        <td colSpan={9} className="text-center py-8 text-surface-400">No meetings yet.</td>
                                    </tr>
                                ) : meetings.map((m) => {
                                    const badge = STATUS_BADGES[m.status] || STATUS_BADGES.ended;
                                    return (
                                        <tr key={m.id} className="hover:bg-surface-50/50 transition-colors">
                                            <td className="py-2.5 px-4">
                                                <div className="font-semibold text-surface-900 text-sm">{m.title}</div>
                                                {m.topic && <div className="text-xs text-surface-400 truncate max-w-xs">{m.topic}</div>}
                                            </td>
                                            <td className="py-2.5 px-4 text-xs text-surface-600">{m.host?.name || '—'}</td>
                                            <td className="py-2.5 px-4 text-center">
                                                <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold ${badge.bg} ${badge.text}`}>
                                                    {badge.label}
                                                </span>
                                            </td>
                                            <td className="py-2.5 px-4 text-center text-xs font-semibold text-surface-700">{m.participants_count}</td>
                                            <td className="py-2.5 px-4 text-center text-xs text-surface-600">{m.messages_count}</td>
                                            <td className="py-2.5 px-4 text-center text-xs text-amber-600 font-bold">{m.action_items_count}</td>
                                            <td className="py-2.5 px-4 text-center text-xs text-emerald-600 font-bold">{m.decisions_count}</td>
                                            <td className="py-2.5 px-4 text-xs text-surface-400">
                                                {new Date(m.created_at).toLocaleDateString()}
                                            </td>
                                            <td className="py-2.5 px-4">
                                                <Link
                                                    href={m.status === 'ended' ? `/meetings/${m.id}/summary` : `/meetings/${m.id}`}
                                                    className="text-xs text-brand-500 hover:text-brand-600 font-semibold"
                                                >
                                                    {m.status === 'ended' ? 'Summary' : 'Join'} →
                                                </Link>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </AppLayout>
    );
}
