import AppLayout from '@/Layouts/AppLayout';
import { Link, router, useForm } from '@inertiajs/react';
import { FormEvent, useState } from 'react';

const STATE_BADGE: Record<string, string> = {
    running:     'badge-green',
    idle:        'badge-blue',
    setup:       'badge-amber',
    maintenance: 'badge-purple',
    breakdown:   'badge-red',
    offline:     'badge-slate',
};

const HEALTH_BADGE: Record<string, string> = {
    green:  'badge-green',
    blue:   'badge-blue',
    amber:  'badge-amber',
    orange: 'badge-amber',
    red:    'badge-red',
};

const MAINT_TYPE_BADGE: Record<string, string> = {
    preventive: 'badge-green',
    corrective: 'badge-amber',
    breakdown:  'badge-red',
    inspection: 'badge-blue',
    overhaul:   'badge-purple',
};

const fmt = (v: any) => v != null ? `৳${Number(v).toLocaleString('en-IN')}` : '—';

// Health gauge component (SVG circular progress)
function HealthGauge({ score, color }: { score: number; color: string }) {
    const radius = 70;
    const circumference = 2 * Math.PI * radius;
    const offset = circumference - (score / 100) * circumference;

    const colorMap: Record<string, string> = {
        green:  '#22c55e',
        blue:   '#3b82f6',
        amber:  '#f59e0b',
        orange: '#f97316',
        red:    '#ef4444',
    };
    const stroke = colorMap[color] ?? '#94a3b8';

    return (
        <div className="relative w-44 h-44">
            <svg className="transform -rotate-90 w-full h-full" viewBox="0 0 160 160">
                <circle cx="80" cy="80" r={radius} stroke="#e2e8f0" strokeWidth="10" fill="none" />
                <circle cx="80" cy="80" r={radius} stroke={stroke} strokeWidth="10" fill="none"
                    strokeDasharray={circumference} strokeDashoffset={offset} strokeLinecap="round"
                    style={{ transition: 'stroke-dashoffset 1s ease-out' }} />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
                <div className="text-4xl font-bold tabular-nums" style={{ color: stroke }}>{score}</div>
                <div className="text-[10px] font-semibold text-surface-400 uppercase tracking-wider">Health Score</div>
            </div>
        </div>
    );
}

export default function MachineShow({ machine }: any) {
    const [showStateMenu, setShowStateMenu] = useState(false);
    const [showMaintForm, setShowMaintForm] = useState(false);

    const stateForm = useForm({ state: machine.current_state });
    const maintForm = useForm({
        type: 'preventive',
        performed_on: new Date().toISOString().slice(0, 10),
        technician_name: '',
        description: '',
        cost: '',
        downtime_hours: '',
        next_due_date: '',
        notes: '',
    });

    const changeState = (newState: string) => {
        stateForm.data.state = newState;
        router.post(`/admin/machines/${machine.id}/state`, { state: newState });
        setShowStateMenu(false);
    };

    const submitMaintenance = (e: FormEvent) => {
        e.preventDefault();
        maintForm.post(`/admin/machines/${machine.id}/maintenance`, {
            onSuccess: () => {
                maintForm.reset();
                setShowMaintForm(false);
            },
        });
    };

    return (
        <AppLayout header={`${machine.name}`}>
            <div className="space-y-6 max-w-6xl animate-fade-in">

                {/* Header card */}
                <div className="card animate-slide-up">
                    <div className="card-header flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                        <div className="flex items-start gap-3">
                            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-brand-400 to-brand-600 flex items-center justify-center text-white shrink-0">
                                <i className="fi fi-rr-settings text-xl leading-none" />
                            </div>
                            <div>
                                <h2 className="text-base font-bold text-surface-900">{machine.name}</h2>
                                <div className="flex items-center gap-2 mt-1 flex-wrap">
                                    <span className="font-mono text-xs bg-surface-100 text-surface-700 px-2 py-0.5 rounded">{machine.machine_code}</span>
                                    {machine.section && <span className="text-xs text-surface-500"><i className="fi fi-rr-building text-[10px]" /> {machine.section.name}</span>}
                                    {machine.location && <span className="text-xs text-surface-500"><i className="fi fi-rr-marker text-[10px]" /> {machine.location}</span>}
                                </div>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            {/* State changer */}
                            <div className="relative">
                                <button onClick={() => setShowStateMenu(!showStateMenu)}
                                    className={`btn-sm badge ${STATE_BADGE[machine.current_state]} cursor-pointer hover:opacity-80`}>
                                    <span className="relative flex h-2 w-2">
                                        <span className={`absolute inline-flex h-full w-full rounded-full ${machine.current_state === 'running' ? 'animate-ping' : ''} bg-current opacity-75`} />
                                        <span className="relative inline-flex rounded-full h-2 w-2 bg-current" />
                                    </span>
                                    {machine.current_state}
                                    <i className="fi fi-rr-angle-small-down text-[10px] leading-none" />
                                </button>
                                {showStateMenu && (
                                    <div className="absolute right-0 mt-2 w-44 bg-white rounded-2xl shadow-premium-lg border border-surface-100 z-50 py-1 animate-scale-in origin-top-right">
                                        {['running', 'idle', 'setup', 'maintenance', 'breakdown', 'offline'].map(s => (
                                            <button key={s} onClick={() => changeState(s)}
                                                className="w-full text-left px-4 py-2 text-sm hover:bg-surface-50 flex items-center gap-2 capitalize">
                                                <span className={`w-2 h-2 rounded-full bg-${s === 'running' ? 'emerald' : s === 'idle' ? 'blue' : s === 'setup' ? 'amber' : s === 'maintenance' ? 'purple' : s === 'breakdown' ? 'red' : 'slate'}-500`} />
                                                {s}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                            <button onClick={() => setShowMaintForm(true)} className="btn-primary btn-sm">
                                <i className="fi fi-rr-wrench-simple text-xs leading-none" /> Log Maintenance
                            </button>
                            <Link href={`/admin/machines/${machine.id}/edit`} className="btn-outline btn-sm">
                                <i className="fi fi-rr-pencil text-xs leading-none" /> Edit
                            </Link>
                            <Link href="/admin/machines" className="btn-ghost btn-sm">
                                <i className="fi fi-rr-arrow-left text-xs leading-none" /> Back
                            </Link>
                        </div>
                    </div>
                </div>

                {/* Top row: Health Gauge + Quick Stats */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                    {/* Health Gauge Card */}
                    <div className="card animate-slide-up">
                        <div className="card-header">
                            <h3 className="text-sm font-bold text-surface-900">Health Score</h3>
                            <p className="text-xs text-surface-400 mt-0.5">Composite indicator</p>
                        </div>
                        <div className="card-body flex flex-col items-center pb-6">
                            <HealthGauge score={machine.health_score} color={machine.health_color} />
                            <span className={`badge ${HEALTH_BADGE[machine.health_color] ?? 'badge-slate'} mt-3 text-sm`}>
                                {machine.health_label}
                            </span>
                        </div>
                    </div>

                    {/* Stats Grid */}
                    <div className="lg:col-span-2 grid grid-cols-2 gap-4 animate-slide-up">
                        <StatTile icon="fi-rr-time-fast" label="Total Runtime" value={`${machine.total_runtime_hours}h`} color="blue" />
                        <StatTile icon="fi-rr-clock-three" label="Since Last Service" value={`${machine.runtime_since_maintenance}h`} color="amber" />
                        <StatTile icon="fi-rr-calendar-clock" label="Next Service"
                            value={machine.next_maintenance_date ?? 'Not scheduled'}
                            sub={machine.days_until_maint != null
                                ? (machine.days_until_maint < 0 ? `${Math.abs(machine.days_until_maint)} days overdue` : `in ${machine.days_until_maint} days`)
                                : null}
                            color={machine.maintenance_status === 'overdue' ? 'red' : machine.maintenance_status === 'due_soon' ? 'amber' : 'green'} />
                        <StatTile icon="fi-rr-rotate-right" label="MTBF" value={machine.mtbf_days != null ? `${machine.mtbf_days} days` : 'N/A'} sub="Mean Time Between Failures" color="purple" />
                        <StatTile icon="fi-rr-stopwatch" label="MTTR" value={machine.mttr_hours != null ? `${machine.mttr_hours}h` : 'N/A'} sub="Mean Time To Repair" color="orange" />
                        <StatTile icon="fi-rr-pause-circle" label="Downtime (30d)" value={`${machine.downtime_30d}h`} color="red" />
                    </div>
                </div>

                {/* Asset Info + Maintenance Log */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                    {/* Asset Info */}
                    <div className="card animate-slide-up">
                        <div className="card-header">
                            <h3 className="text-sm font-bold text-surface-900">Asset Information</h3>
                        </div>
                        <div className="card-body">
                            <dl className="space-y-3 text-sm">
                                <Field label="Manufacturer" value={machine.manufacturer} />
                                <Field label="Model" value={machine.model} />
                                <Field label="Serial Number" value={machine.serial_number} mono />
                                <Field label="Purchased On" value={machine.purchased_on} />
                                <Field label="Warranty"
                                    value={machine.warranty_expires_on}
                                    badge={machine.warranty_expired ? { text: 'Expired', color: 'red' } : null} />
                                <Field label="Asset Value" value={fmt(machine.asset_value)} />
                            </dl>
                        </div>
                    </div>

                    {/* Maintenance History */}
                    <div className="lg:col-span-2 card animate-slide-up">
                        <div className="card-header flex items-center justify-between">
                            <div>
                                <h3 className="text-sm font-bold text-surface-900">Maintenance History</h3>
                                <p className="text-xs text-surface-400 mt-0.5">{machine.maintenance_logs.length} record{machine.maintenance_logs.length !== 1 && 's'}</p>
                            </div>
                            <button onClick={() => setShowMaintForm(true)} className="btn-outline btn-sm">
                                <i className="fi fi-rr-plus text-xs leading-none" /> Add Entry
                            </button>
                        </div>
                        <div className="card-body p-0">
                            {machine.maintenance_logs.length === 0 ? (
                                <div className="empty-state">
                                    <div className="empty-state-icon"><i className="fi fi-rr-wrench-simple" /></div>
                                    <div className="empty-state-title">No maintenance records</div>
                                    <div className="empty-state-text">Click "Add Entry" to log your first service.</div>
                                </div>
                            ) : (
                                <div className="divide-y divide-surface-50">
                                    {machine.maintenance_logs.map((log: any) => (
                                        <div key={log.id} className="px-5 py-4">
                                            <div className="flex items-start justify-between gap-3">
                                                <div className="flex items-start gap-3 flex-1 min-w-0">
                                                    <div className="w-9 h-9 rounded-xl bg-surface-100 flex items-center justify-center shrink-0">
                                                        <i className={`fi ${log.type === 'breakdown' ? 'fi-rr-triangle-warning' : log.type === 'inspection' ? 'fi-rr-search' : 'fi-rr-wrench-simple'} text-surface-600 text-sm leading-none`} />
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex items-center gap-2 flex-wrap">
                                                            <span className={`badge ${MAINT_TYPE_BADGE[log.type] ?? 'badge-slate'}`}>{log.type}</span>
                                                            <span className="text-xs text-surface-500">{log.performed_on}</span>
                                                            {log.technician && <span className="text-xs text-surface-500">· {log.technician}</span>}
                                                        </div>
                                                        <p className="text-sm text-surface-800 mt-1">{log.description}</p>
                                                        {log.parts_replaced?.length > 0 && (
                                                            <div className="mt-2 flex flex-wrap gap-1">
                                                                {log.parts_replaced.map((p: any, i: number) => (
                                                                    <span key={i} className="chip chip-default text-[10px]">
                                                                        {p.name} {p.qty && `× ${p.qty}`}
                                                                    </span>
                                                                ))}
                                                            </div>
                                                        )}
                                                        {log.notes && <p className="text-xs text-surface-500 mt-1 italic">"{log.notes}"</p>}
                                                    </div>
                                                </div>
                                                <div className="text-right text-xs shrink-0">
                                                    {log.cost != null && <div className="font-mono font-semibold text-surface-700">{fmt(log.cost)}</div>}
                                                    {log.downtime_hours != null && <div className="text-surface-400">{log.downtime_hours}h down</div>}
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* ── Maintenance Log Modal ───────────────────────────────────── */}
            {showMaintForm && (
                <>
                    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm animate-fade-in" onClick={() => setShowMaintForm(false)} />
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                        <div className="bg-white rounded-2xl shadow-premium-lg border border-surface-100 w-full max-w-2xl animate-scale-in max-h-[90vh] overflow-y-auto">
                            <div className="px-5 py-4 border-b border-surface-100 flex items-center justify-between">
                                <div>
                                    <h3 className="text-base font-bold text-surface-900">Log Maintenance Event</h3>
                                    <p className="text-xs text-surface-400 mt-0.5">Record service details for {machine.name}</p>
                                </div>
                                <button onClick={() => setShowMaintForm(false)} className="btn-ghost btn-icon">
                                    <i className="fi fi-rr-cross text-base leading-none" />
                                </button>
                            </div>
                            <form onSubmit={submitMaintenance} className="p-5 space-y-4">
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div className="form-group">
                                        <label className="form-label">Type *</label>
                                        <select value={maintForm.data.type} onChange={e => maintForm.setData('type', e.target.value)}
                                            className="form-select" required>
                                            <option value="preventive">Preventive</option>
                                            <option value="corrective">Corrective</option>
                                            <option value="breakdown">Breakdown</option>
                                            <option value="inspection">Inspection</option>
                                            <option value="overhaul">Overhaul</option>
                                        </select>
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">Performed On *</label>
                                        <input type="date" value={maintForm.data.performed_on}
                                            onChange={e => maintForm.setData('performed_on', e.target.value)}
                                            className="form-input" required />
                                    </div>
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Technician Name <span className="form-label-optional">(if external)</span></label>
                                    <input type="text" value={maintForm.data.technician_name}
                                        onChange={e => maintForm.setData('technician_name', e.target.value)}
                                        className="form-input" />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Description *</label>
                                    <textarea value={maintForm.data.description}
                                        onChange={e => maintForm.setData('description', e.target.value)}
                                        rows={3} className="form-textarea"
                                        placeholder="What was done? What was the issue?" required />
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                    <div className="form-group">
                                        <label className="form-label">Cost <span className="form-label-optional">৳</span></label>
                                        <input type="number" min="0" step="0.01" value={maintForm.data.cost}
                                            onChange={e => maintForm.setData('cost', e.target.value)}
                                            className="form-input" placeholder="0.00" />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">Downtime <span className="form-label-optional">hours</span></label>
                                        <input type="number" min="0" step="0.1" value={maintForm.data.downtime_hours}
                                            onChange={e => maintForm.setData('downtime_hours', e.target.value)}
                                            className="form-input" placeholder="0.0" />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">Next Due</label>
                                        <input type="date" value={maintForm.data.next_due_date}
                                            onChange={e => maintForm.setData('next_due_date', e.target.value)}
                                            className="form-input" />
                                    </div>
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Notes <span className="form-label-optional">optional</span></label>
                                    <textarea value={maintForm.data.notes}
                                        onChange={e => maintForm.setData('notes', e.target.value)}
                                        rows={2} className="form-textarea" />
                                </div>
                                <div className="flex items-center gap-3 pt-2 border-t border-surface-100">
                                    <button type="submit" disabled={maintForm.processing} className="btn-primary">
                                        {maintForm.processing ? (
                                            <><i className="fi fi-rr-spinner animate-spin text-sm leading-none" /> Saving...</>
                                        ) : (
                                            <><i className="fi fi-rr-check text-sm leading-none" /> Save Entry</>
                                        )}
                                    </button>
                                    <button type="button" onClick={() => setShowMaintForm(false)} className="btn-outline">
                                        Cancel
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </>
            )}
        </AppLayout>
    );
}

function StatTile({ icon, label, value, sub, color }: { icon: string; label: string; value: string; sub?: string | null; color: string }) {
    const bg: Record<string, string> = {
        blue: 'bg-blue-50 text-blue-600',
        amber: 'bg-amber-50 text-amber-600',
        green: 'bg-emerald-50 text-emerald-600',
        red: 'bg-red-50 text-red-600',
        purple: 'bg-purple-50 text-purple-600',
        orange: 'bg-orange-50 text-orange-600',
    };
    return (
        <div className="card p-4 flex items-start gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${bg[color] ?? bg.blue}`}>
                <i className={`fi ${icon} text-base leading-none`} />
            </div>
            <div className="flex-1 min-w-0">
                <div className="text-[10px] font-semibold text-surface-400 uppercase tracking-wider">{label}</div>
                <div className="text-base font-bold text-surface-900 truncate">{value}</div>
                {sub && <div className="text-[10px] text-surface-400 mt-0.5">{sub}</div>}
            </div>
        </div>
    );
}

function Field({ label, value, mono, badge }: { label: string; value: any; mono?: boolean; badge?: { text: string; color: string } | null }) {
    return (
        <div className="flex items-start justify-between gap-3 py-1">
            <dt className="text-xs text-surface-500 shrink-0">{label}</dt>
            <dd className={`text-sm text-surface-800 text-right ${mono ? 'font-mono' : 'font-medium'}`}>
                {value || <span className="text-surface-300">—</span>}
                {badge && (
                    <span className={`badge badge-${badge.color} ml-2`}>{badge.text}</span>
                )}
            </dd>
        </div>
    );
}
