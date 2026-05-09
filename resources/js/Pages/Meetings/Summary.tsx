import AppLayout from '@/Layouts/AppLayout';
import { Link } from '@inertiajs/react';
import { motion } from 'motion/react';
import {
    ArrowLeft, Calendar, Clock, Users, CheckCircle2, XCircle, Circle,
    FileText, Download, Printer, Share2, AlertCircle,
} from 'lucide-react';

interface Props {
    meeting: any;
    actionItems: any[];
    decisions: any[];
    messageCount: number;
}

export default function MeetingSummary({ meeting, actionItems, decisions, messageCount }: Props) {
    const pendingItems = actionItems.filter(a => a.status === 'pending' || a.status === 'in_progress');
    const completedItems = actionItems.filter(a => a.status === 'completed');

    const duration = meeting.started_at && meeting.ended_at
        ? Math.round((new Date(meeting.ended_at).getTime() - new Date(meeting.started_at).getTime()) / 60000)
        : null;

    const printPage = () => window.print();

    return (
        <AppLayout header="Meeting Summary">
            <div className="max-w-5xl space-y-6 animate-fade-in print:max-w-full">
                {/* Header */}
                <div className="flex items-center justify-between print:hidden">
                    <Link href="/meetings" className="btn-ghost">
                        <ArrowLeft className="w-4 h-4" />
                        Back to Meetings
                    </Link>
                    <div className="flex items-center gap-2">
                        <button onClick={printPage} className="btn-outline">
                            <Printer className="w-4 h-4" />
                            Print / PDF
                        </button>
                    </div>
                </div>

                {/* Meeting Info Card */}
                <motion.div
                    className="card print:shadow-none"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                >
                    <div className="card-body">
                        <div className="flex items-start justify-between mb-4">
                            <div>
                                <h1 className="text-2xl font-bold text-surface-900">{meeting.title}</h1>
                                {meeting.topic && <p className="text-surface-500 mt-1">{meeting.topic}</p>}
                            </div>
                            <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold ${
                                meeting.status === 'ended' ? 'bg-surface-100 text-surface-600' : 'bg-emerald-50 text-emerald-600'
                            }`}>
                                {meeting.status === 'ended' ? 'Ended' : 'Active'}
                            </span>
                        </div>

                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                            <div className="flex items-center gap-2">
                                <Calendar className="w-4 h-4 text-surface-400" />
                                <div>
                                    <div className="text-xs text-surface-400">Date</div>
                                    <div className="font-semibold text-surface-800">
                                        {new Date(meeting.started_at || meeting.created_at).toLocaleDateString()}
                                    </div>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <Clock className="w-4 h-4 text-surface-400" />
                                <div>
                                    <div className="text-xs text-surface-400">Duration</div>
                                    <div className="font-semibold text-surface-800">{duration ? `${duration} min` : '—'}</div>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <Users className="w-4 h-4 text-surface-400" />
                                <div>
                                    <div className="text-xs text-surface-400">Participants</div>
                                    <div className="font-semibold text-surface-800">{meeting.participants?.length || 0}</div>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <FileText className="w-4 h-4 text-surface-400" />
                                <div>
                                    <div className="text-xs text-surface-400">Messages</div>
                                    <div className="font-semibold text-surface-800">{messageCount}</div>
                                </div>
                            </div>
                        </div>

                        {/* Participants list */}
                        {meeting.participants && meeting.participants.length > 0 && (
                            <div className="mt-4 pt-4 border-t border-surface-100">
                                <div className="text-xs text-surface-400 font-semibold uppercase tracking-wider mb-2">Participants</div>
                                <div className="flex flex-wrap gap-2">
                                    {meeting.participants.map((p: any) => (
                                        <div key={p.id} className="flex items-center gap-2 px-2.5 py-1 rounded-full bg-surface-50 border border-surface-100">
                                            <div className="w-5 h-5 rounded-full bg-brand-100 flex items-center justify-center text-[9px] font-bold text-brand-600">
                                                {p.user?.name.split(' ').map((w: string) => w[0]).join('').slice(0, 2)}
                                            </div>
                                            <span className="text-xs font-medium text-surface-700">
                                                {p.user?.name} {p.role === 'host' && <span className="text-[9px] text-amber-500 ml-1">HOST</span>}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </motion.div>

                {/* Stats Summary */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <motion.div className="card" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
                        <div className="card-body">
                            <div className="flex items-center justify-between">
                                <div>
                                    <div className="text-xs text-surface-400 font-semibold uppercase">Action Items</div>
                                    <div className="text-3xl font-bold text-surface-900 mt-1">{actionItems.length}</div>
                                    <div className="text-xs text-surface-500 mt-1">
                                        {completedItems.length} completed · {pendingItems.length} pending
                                    </div>
                                </div>
                                <div className="w-12 h-12 rounded-2xl bg-amber-50 flex items-center justify-center">
                                    <Circle className="w-6 h-6 text-amber-500" />
                                </div>
                            </div>
                        </div>
                    </motion.div>
                    <motion.div className="card" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
                        <div className="card-body">
                            <div className="flex items-center justify-between">
                                <div>
                                    <div className="text-xs text-surface-400 font-semibold uppercase">Decisions</div>
                                    <div className="text-3xl font-bold text-surface-900 mt-1">{decisions.length}</div>
                                    <div className="text-xs text-surface-500 mt-1">Made during the meeting</div>
                                </div>
                                <div className="w-12 h-12 rounded-2xl bg-emerald-50 flex items-center justify-center">
                                    <CheckCircle2 className="w-6 h-6 text-emerald-500" />
                                </div>
                            </div>
                        </div>
                    </motion.div>
                    <motion.div className="card" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
                        <div className="card-body">
                            <div className="flex items-center justify-between">
                                <div>
                                    <div className="text-xs text-surface-400 font-semibold uppercase">Completion</div>
                                    <div className="text-3xl font-bold text-surface-900 mt-1">
                                        {actionItems.length > 0 ? Math.round((completedItems.length / actionItems.length) * 100) : 0}%
                                    </div>
                                    <div className="text-xs text-surface-500 mt-1">of action items done</div>
                                </div>
                                <div className="w-12 h-12 rounded-2xl bg-indigo-50 flex items-center justify-center">
                                    <AlertCircle className="w-6 h-6 text-indigo-500" />
                                </div>
                            </div>
                        </div>
                    </motion.div>
                </div>

                {/* AI-Generated Summary */}
                {meeting.meeting_notes?.summary && (
                    <motion.div className="card" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}>
                        <div className="card-header">
                            <div className="flex items-center gap-2">
                                <div className="w-8 h-8 rounded-xl bg-indigo-50 flex items-center justify-center">
                                    <FileText className="w-4 h-4 text-indigo-500" />
                                </div>
                                <div>
                                    <h3 className="font-bold text-surface-900">AI-Generated Summary</h3>
                                    <p className="text-xs text-surface-400">Generated by Oli</p>
                                </div>
                            </div>
                        </div>
                        <div className="card-body">
                            <div className="prose prose-sm max-w-none text-surface-700" style={{ whiteSpace: 'pre-wrap' }}>
                                {meeting.meeting_notes.summary}
                            </div>
                        </div>
                    </motion.div>
                )}

                {/* Decisions */}
                {decisions.length > 0 && (
                    <motion.div className="card" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
                        <div className="card-header">
                            <div className="flex items-center gap-2">
                                <div className="w-8 h-8 rounded-xl bg-emerald-50 flex items-center justify-center">
                                    <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                                </div>
                                <div>
                                    <h3 className="font-bold text-surface-900">Decisions Made</h3>
                                    <p className="text-xs text-surface-400">{decisions.length} decisions logged</p>
                                </div>
                            </div>
                        </div>
                        <div className="card-body space-y-3">
                            {decisions.map((d: any) => (
                                <div key={d.id} className="flex items-start gap-3 p-3 rounded-xl bg-emerald-50/50 border border-emerald-100">
                                    <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
                                    <div className="flex-1">
                                        <div className="font-semibold text-surface-900 text-sm">{d.description}</div>
                                        {d.context && <div className="text-xs text-surface-600 mt-1 italic">{d.context}</div>}
                                        {(d.decided_by_name || d.decidedBy?.name) && (
                                            <div className="text-[11px] text-emerald-600 mt-2 font-medium">
                                                by {d.decidedBy?.name || d.decided_by_name}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </motion.div>
                )}

                {/* Action Items */}
                {actionItems.length > 0 && (
                    <motion.div className="card" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}>
                        <div className="card-header">
                            <div className="flex items-center gap-2">
                                <div className="w-8 h-8 rounded-xl bg-amber-50 flex items-center justify-center">
                                    <Circle className="w-4 h-4 text-amber-500" />
                                </div>
                                <div>
                                    <h3 className="font-bold text-surface-900">Action Items</h3>
                                    <p className="text-xs text-surface-400">
                                        {pendingItems.length} pending · {completedItems.length} completed
                                    </p>
                                </div>
                            </div>
                        </div>
                        <div className="card-body space-y-2">
                            {actionItems.map((item: any) => {
                                const isDone = item.status === 'completed';
                                return (
                                    <div key={item.id} className={`flex items-start gap-3 p-3 rounded-xl border transition-all ${
                                        isDone ? 'bg-emerald-50/30 border-emerald-100' : item.priority === 'high' ? 'bg-red-50/30 border-red-100' : 'bg-white border-surface-100'
                                    }`}>
                                        {isDone ? (
                                            <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
                                        ) : (
                                            <Circle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                                        )}
                                        <div className="flex-1">
                                            <div className={`font-semibold text-sm ${isDone ? 'line-through text-surface-400' : 'text-surface-900'}`}>
                                                {item.description}
                                            </div>
                                            <div className="flex items-center gap-3 mt-1.5 text-xs flex-wrap">
                                                {(item.assigned_to_name || item.assignedTo?.name) && (
                                                    <span className="inline-flex items-center gap-1 text-indigo-600 font-medium">
                                                        👤 {item.assignedTo?.name || item.assigned_to_name}
                                                    </span>
                                                )}
                                                {item.due_date && (
                                                    <span className="inline-flex items-center gap-1 text-orange-600 font-medium">
                                                        📅 Due: {new Date(item.due_date).toLocaleDateString()}
                                                    </span>
                                                )}
                                                {item.priority === 'high' && (
                                                    <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-red-100 text-red-700 font-bold text-[10px]">HIGH</span>
                                                )}
                                                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                                    isDone ? 'bg-emerald-100 text-emerald-700' :
                                                    item.status === 'in_progress' ? 'bg-blue-100 text-blue-700' :
                                                    'bg-amber-100 text-amber-700'
                                                }`}>
                                                    {item.status.replace('_', ' ').toUpperCase()}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </motion.div>
                )}

                {/* Empty state */}
                {actionItems.length === 0 && decisions.length === 0 && !meeting.meeting_notes?.summary && (
                    <div className="card">
                        <div className="card-body text-center py-16">
                            <FileText className="w-12 h-12 text-surface-300 mx-auto mb-3" />
                            <h3 className="font-bold text-surface-700 mb-1">No intelligence data yet</h3>
                            <p className="text-sm text-surface-500">The meeting hasn't produced any action items, decisions, or summary.</p>
                        </div>
                    </div>
                )}
            </div>
        </AppLayout>
    );
}
