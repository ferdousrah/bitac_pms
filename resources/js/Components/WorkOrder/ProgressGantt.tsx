/**
 * Visual Gantt timeline + progress bar for Work Order operation steps.
 * Shows each step as a horizontal bar with estimated vs actual hours.
 */

const STATUS_CONFIG: Record<string, { bg: string; bar: string; icon: string; label: string }> = {
    completed:   { bg: 'bg-emerald-50',  bar: 'bg-gradient-to-r from-emerald-500 to-emerald-400', icon: 'fi-rr-check-circle', label: 'Completed' },
    in_progress: { bg: 'bg-amber-50',    bar: 'bg-gradient-to-r from-amber-500 to-amber-400',     icon: 'fi-rr-settings',     label: 'In Progress' },
    pending:     { bg: 'bg-surface-50',   bar: 'bg-surface-200',                                   icon: 'fi-rr-clock',        label: 'Pending' },
    skipped:     { bg: 'bg-slate-50',     bar: 'bg-slate-300',                                     icon: 'fi-rr-cross',        label: 'Skipped' },
};

interface Step {
    id: number;
    sequence: number;
    operation_name: string;
    machine: { name: string };
    operator?: string | null;
    estimated_hours: number;
    actual_hours: number;
    status: string;
    started_at: string | null;
    completed_at: string | null;
}

interface Progress {
    pct: number;
    completed: number;
    in_progress: number;
    pending: number;
    total: number;
    estimated_hours: number;
    actual_hours: number;
    efficiency: number | null;
}

export default function ProgressGantt({ steps, progress }: { steps: Step[]; progress: Progress }) {
    const maxHours = Math.max(...steps.map(s => Math.max(s.estimated_hours, s.actual_hours)), 1);

    return (
        <div className="space-y-5">
            {/* ── Overall Progress ── */}
            <div className="rounded-xl border border-surface-200 bg-white p-4">
                <div className="flex items-center justify-between mb-3">
                    <div>
                        <h3 className="text-sm font-bold text-surface-900">Overall Progress</h3>
                        <p className="text-xs text-surface-400 mt-0.5">
                            {progress.completed}/{progress.total} steps completed
                            {progress.in_progress > 0 && ` · ${progress.in_progress} in progress`}
                        </p>
                    </div>
                    <div className="text-right">
                        <div className="text-3xl font-bold tabular-nums leading-none" style={{
                            color: progress.pct >= 100 ? '#10b981' : progress.pct >= 50 ? '#f59e0b' : '#64748b'
                        }}>
                            {progress.pct}%
                        </div>
                    </div>
                </div>

                {/* Progress bar */}
                <div className="h-3 bg-surface-100 rounded-full overflow-hidden mb-3">
                    <div className="h-full rounded-full transition-all duration-700 ease-out"
                        style={{
                            width: `${progress.pct}%`,
                            background: progress.pct >= 100 ? 'linear-gradient(90deg, #10b981, #34d399)' :
                                       progress.pct >= 50 ? 'linear-gradient(90deg, #f59e0b, #fbbf24)' :
                                       'linear-gradient(90deg, #94a3b8, #cbd5e1)',
                        }} />
                </div>

                {/* Stats chips */}
                <div className="flex flex-wrap gap-2">
                    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-50 border border-emerald-200">
                        <span className="w-2 h-2 rounded-full bg-emerald-500" />
                        <span className="text-[10px] font-semibold text-emerald-700">{progress.completed} Completed</span>
                    </div>
                    {progress.in_progress > 0 && (
                        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-50 border border-amber-200">
                            <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                            <span className="text-[10px] font-semibold text-amber-700">{progress.in_progress} In Progress</span>
                        </div>
                    )}
                    {progress.pending > 0 && (
                        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-surface-50 border border-surface-200">
                            <span className="w-2 h-2 rounded-full bg-surface-400" />
                            <span className="text-[10px] font-semibold text-surface-600">{progress.pending} Pending</span>
                        </div>
                    )}
                    <div className="ml-auto flex items-center gap-3 text-[10px] text-surface-500 font-semibold">
                        <span>Est: {progress.estimated_hours}h</span>
                        <span>Act: {progress.actual_hours}h</span>
                        {progress.efficiency !== null && (
                            <span className={progress.efficiency >= 100 ? 'text-emerald-600' : 'text-amber-600'}>
                                Efficiency: {progress.efficiency}%
                            </span>
                        )}
                    </div>
                </div>
            </div>

            {/* ── Gantt Timeline ── */}
            <div className="rounded-xl border border-surface-200 bg-white overflow-hidden">
                <div className="px-4 py-3 border-b border-surface-100 flex items-center justify-between">
                    <h3 className="text-sm font-bold text-surface-900">Step-by-Step Timeline</h3>
                    <div className="flex items-center gap-3 text-[10px]">
                        <div className="flex items-center gap-1">
                            <div className="w-3 h-2 rounded-sm bg-gradient-to-r from-blue-400 to-blue-300 opacity-40" />
                            <span className="text-surface-500">Estimated</span>
                        </div>
                        <div className="flex items-center gap-1">
                            <div className="w-3 h-2 rounded-sm bg-gradient-to-r from-emerald-500 to-emerald-400" />
                            <span className="text-surface-500">Actual</span>
                        </div>
                    </div>
                </div>

                <div className="divide-y divide-surface-100">
                    {steps.map((step, idx) => {
                        const st = STATUS_CONFIG[step.status] ?? STATUS_CONFIG.pending;
                        const estPct = maxHours > 0 ? (step.estimated_hours / maxHours) * 100 : 0;
                        const actPct = maxHours > 0 ? (step.actual_hours / maxHours) * 100 : 0;
                        const overrun = step.actual_hours > step.estimated_hours && step.estimated_hours > 0;
                        const startTime = step.started_at ? new Date(step.started_at) : null;
                        const endTime = step.completed_at ? new Date(step.completed_at) : null;

                        return (
                            <div key={step.id} className={`px-4 py-3 ${st.bg} transition-colors`}>
                                {/* Step header */}
                                <div className="flex items-center justify-between mb-2">
                                    <div className="flex items-center gap-2.5 min-w-0">
                                        <span className="w-6 h-6 rounded-lg bg-white border border-surface-200 flex items-center justify-center text-[10px] font-bold text-surface-600 shrink-0 shadow-sm">
                                            {step.sequence}
                                        </span>
                                        <div className="min-w-0">
                                            <div className="text-sm font-semibold text-surface-900 truncate">{step.operation_name}</div>
                                            <div className="text-[10px] text-surface-400 flex items-center gap-2 mt-0.5">
                                                <span>{step.machine.name}</span>
                                                {step.operator && <span>· {step.operator}</span>}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2 shrink-0">
                                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold border ${
                                            step.status === 'completed' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                                            step.status === 'in_progress' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                                            'bg-surface-50 text-surface-600 border-surface-200'
                                        }`}>
                                            <i className={`fi ${st.icon} leading-none`} />
                                            {st.label}
                                        </span>
                                    </div>
                                </div>

                                {/* Gantt bars */}
                                <div className="space-y-1 pl-8">
                                    {/* Estimated bar */}
                                    <div className="flex items-center gap-2">
                                        <div className="w-10 text-[9px] text-surface-400 text-right shrink-0">Est</div>
                                        <div className="flex-1 h-4 bg-surface-100 rounded overflow-hidden relative">
                                            <div className="h-full rounded bg-blue-300/40 transition-all duration-700"
                                                style={{ width: `${Math.max(estPct, 1)}%` }} />
                                            <span className="absolute inset-y-0 right-2 flex items-center text-[9px] text-surface-500 font-mono font-bold">
                                                {step.estimated_hours}h
                                            </span>
                                        </div>
                                    </div>
                                    {/* Actual bar (only if started) */}
                                    {step.status !== 'pending' && (
                                        <div className="flex items-center gap-2">
                                            <div className="w-10 text-[9px] text-surface-400 text-right shrink-0">Act</div>
                                            <div className="flex-1 h-4 bg-surface-100 rounded overflow-hidden relative">
                                                <div className={`h-full rounded transition-all duration-700 ${overrun
                                                    ? 'bg-gradient-to-r from-red-500 to-red-400'
                                                    : st.bar}`}
                                                    style={{ width: `${Math.max(actPct, 1)}%` }} />
                                                <span className={`absolute inset-y-0 right-2 flex items-center text-[9px] font-mono font-bold ${overrun ? 'text-red-600' : 'text-surface-600'}`}>
                                                    {step.actual_hours}h
                                                    {overrun && <span className="ml-1 text-[8px]">⚠️</span>}
                                                </span>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* Timestamps */}
                                {(startTime || endTime) && (
                                    <div className="pl-8 mt-1.5 flex items-center gap-3 text-[9px] text-surface-400">
                                        {startTime && (
                                            <span>Started: {startTime.toLocaleDateString([], { day: '2-digit', month: 'short' })} {startTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                        )}
                                        {endTime && (
                                            <span>Finished: {endTime.toLocaleDateString([], { day: '2-digit', month: 'short' })} {endTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                        )}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}
