import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';

export interface Revision {
    id: number;
    revision_no: number;
    event: string;
    event_label: string;
    event_icon: string;
    event_color: string;
    grand_total_at: string | null;
    change_reason: string | null;
    auto_summary: string | null;
    changes: Record<string, { old: any; new: any }> | null;
    changed_by: string;
    created_at: string;
    created_at_diff: string;
}

interface Props {
    revisions: Revision[];
    title?: string;
    description?: string;
}

const COLOR_MAP: Record<string, { bg: string; ring: string; text: string; line: string; iconBg: string }> = {
    blue:    { bg: 'bg-blue-50',    ring: 'ring-blue-200',    text: 'text-blue-700',    line: 'bg-blue-200',    iconBg: 'bg-blue-500' },
    amber:   { bg: 'bg-amber-50',   ring: 'ring-amber-200',   text: 'text-amber-700',   line: 'bg-amber-200',   iconBg: 'bg-amber-500' },
    emerald: { bg: 'bg-emerald-50', ring: 'ring-emerald-200', text: 'text-emerald-700', line: 'bg-emerald-200', iconBg: 'bg-emerald-500' },
    red:     { bg: 'bg-red-50',     ring: 'ring-red-200',     text: 'text-red-700',     line: 'bg-red-200',     iconBg: 'bg-red-500' },
    orange:  { bg: 'bg-orange-50',  ring: 'ring-orange-200',  text: 'text-orange-700',  line: 'bg-orange-200',  iconBg: 'bg-orange-500' },
    indigo:  { bg: 'bg-indigo-50',  ring: 'ring-indigo-200',  text: 'text-indigo-700',  line: 'bg-indigo-200',  iconBg: 'bg-indigo-500' },
    purple:  { bg: 'bg-purple-50',  ring: 'ring-purple-200',  text: 'text-purple-700',  line: 'bg-purple-200',  iconBg: 'bg-purple-500' },
    slate:   { bg: 'bg-slate-50',   ring: 'ring-slate-200',   text: 'text-slate-700',   line: 'bg-slate-200',   iconBg: 'bg-slate-500' },
};

const fmt = (v: any) => v != null ? Number(v).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : null;

export default function RevisionTimeline({ revisions, title = 'Change History', description }: Props) {
    const [expandedId, setExpandedId] = useState<number | null>(null);

    if (!revisions || revisions.length === 0) {
        return (
            <div className="card">
                <div className="px-5 py-3 border-b border-surface-100">
                    <h3 className="text-xs font-bold text-surface-900 uppercase tracking-wider">{title}</h3>
                </div>
                <div className="px-5 py-6 text-center text-xs text-surface-400">
                    <i className="fi fi-rr-time-past text-2xl block mb-2 opacity-40" />
                    No changes recorded yet.
                </div>
            </div>
        );
    }

    const latestVersion = revisions[0]?.revision_no ?? 0;

    return (
        <div className="card overflow-hidden">
            <div className="px-5 py-3 border-b border-surface-100 flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <h3 className="text-xs font-bold text-surface-900 uppercase tracking-wider">{title}</h3>
                    <span className="px-2 py-0.5 rounded-md bg-indigo-100 text-indigo-700 text-[10px] font-bold">
                        {revisions.length} {revisions.length === 1 ? 'entry' : 'entries'}
                    </span>
                </div>
                <span className="text-[10px] font-mono font-bold text-surface-400">Latest: v{latestVersion}</span>
            </div>

            <div className="relative px-5 py-4 max-h-[640px] overflow-y-auto">
                {revisions.map((rev, idx) => {
                    const colors = COLOR_MAP[rev.event_color] || COLOR_MAP.slate;
                    const isLast = idx === revisions.length - 1;
                    const isExpanded = expandedId === rev.id;
                    const hasDetails = rev.auto_summary || rev.change_reason || (rev.changes && Object.keys(rev.changes).length > 0);

                    return (
                        <motion.div
                            key={rev.id}
                            className="relative pl-8 pb-4"
                            initial={{ opacity: 0, x: -5 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: idx * 0.03 }}
                        >
                            {/* Connector line */}
                            {!isLast && <div className={`absolute left-[11px] top-6 bottom-0 w-px ${colors.line}`} />}

                            {/* Dot / icon */}
                            <div className={`absolute left-0 top-0.5 w-6 h-6 rounded-full ${colors.iconBg} text-white flex items-center justify-center ring-4 ring-white shadow-sm`}>
                                <i className={`fi ${rev.event_icon} text-[10px] leading-none`} />
                            </div>

                            {/* Content */}
                            <div className={`rounded-xl border ${colors.ring.replace('ring-', 'border-')} ${colors.bg} overflow-hidden`}>
                                <button
                                    onClick={() => hasDetails && setExpandedId(isExpanded ? null : rev.id)}
                                    className={`w-full px-3 py-2 text-left ${hasDetails ? 'cursor-pointer hover:bg-white/50' : 'cursor-default'} transition-colors`}
                                >
                                    <div className="flex items-start gap-2">
                                        <div className="flex-1 min-w-0">
                                            <div className="flex flex-wrap items-center gap-1.5 mb-0.5">
                                                <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded font-mono text-[10px] font-bold ${colors.iconBg} text-white`}>
                                                    v{rev.revision_no}
                                                </span>
                                                <span className={`text-xs font-bold ${colors.text}`}>{rev.event_label}</span>
                                                {rev.grand_total_at && (
                                                    <span className="ml-auto font-mono text-xs font-bold text-surface-900 tabular-nums">
                                                        {fmt(rev.grand_total_at)}
                                                    </span>
                                                )}
                                            </div>
                                            <div className="text-[11px] text-surface-600">
                                                by <span className="font-semibold">{rev.changed_by}</span>
                                                <span className="text-surface-400"> · </span>
                                                <span title={rev.created_at}>{rev.created_at_diff}</span>
                                            </div>

                                            {/* Auto summary (always shown) */}
                                            {rev.auto_summary && (
                                                <div className="mt-1.5 text-[11px] text-surface-700 font-medium">
                                                    {rev.auto_summary}
                                                </div>
                                            )}
                                        </div>
                                        {hasDetails && (
                                            <i className={`fi fi-rr-angle-${isExpanded ? 'up' : 'down'} text-[10px] text-surface-400 mt-1 shrink-0`} />
                                        )}
                                    </div>
                                </button>

                                {/* Expandable details */}
                                <AnimatePresence>
                                    {isExpanded && hasDetails && (
                                        <motion.div
                                            className="border-t border-white/60 bg-white/40 px-3 py-2.5 space-y-2"
                                            initial={{ height: 0, opacity: 0 }}
                                            animate={{ height: 'auto', opacity: 1 }}
                                            exit={{ height: 0, opacity: 0 }}
                                        >
                                            {/* User-provided reason */}
                                            {rev.change_reason && (
                                                <div>
                                                    <div className="text-[9px] font-bold text-surface-400 uppercase tracking-wider mb-0.5">Note / Remarks</div>
                                                    <div className="text-xs text-surface-800 italic bg-white rounded-lg px-2.5 py-1.5 border border-surface-200">
                                                        "{rev.change_reason}"
                                                    </div>
                                                </div>
                                            )}

                                            {/* Field-level changes */}
                                            {rev.changes && Object.keys(rev.changes).length > 0 && (
                                                <div>
                                                    <div className="text-[9px] font-bold text-surface-400 uppercase tracking-wider mb-1">Field Changes</div>
                                                    <div className="space-y-1">
                                                        {Object.entries(rev.changes).map(([field, change]) => (
                                                            <div key={field} className="flex items-center gap-2 text-[11px]">
                                                                <span className="font-semibold text-surface-700 capitalize min-w-[100px]">
                                                                    {field === '_lines' ? 'Line items' : field.replace(/_/g, ' ')}
                                                                </span>
                                                                <span className="font-mono text-red-600 line-through text-[10px]">
                                                                    {formatValue(change.old)}
                                                                </span>
                                                                <span className="text-surface-400">→</span>
                                                                <span className="font-mono text-emerald-700 font-semibold text-[10px]">
                                                                    {formatValue(change.new)}
                                                                </span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </div>
                        </motion.div>
                    );
                })}
            </div>
        </div>
    );
}

function formatValue(v: any): string {
    if (v === null || v === undefined || v === '') return '—';
    if (typeof v === 'number') return Number(v).toLocaleString('en-IN', { maximumFractionDigits: 2 });
    if (typeof v === 'boolean') return v ? 'yes' : 'no';
    const str = String(v);
    return str.length > 40 ? str.slice(0, 37) + '...' : str;
}
