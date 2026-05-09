import AppLayout from '@/Layouts/AppLayout';
import { router } from '@inertiajs/react';
import { useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

function ChartTooltip({ active, payload, label }: any) {
    if (!active || !payload?.length) return null;
    return (
        <div className="glass px-3.5 py-2.5 text-xs !rounded-xl !shadow-premium-lg">
            {label && <p className="font-semibold text-surface-800 mb-1.5">{label}</p>}
            {payload.map((p: any) => (
                <p key={p.name} style={{ color: p.color }} className="flex items-center gap-2 py-0.5">
                    <span className="w-2 h-2 rounded-full inline-block shrink-0" style={{ background: p.color }} />
                    <span className="text-surface-600">{p.name}:</span>
                    <span className="font-bold">{p.value ?? '—'}</span>
                </p>
            ))}
        </div>
    );
}

const STAT_CONFIG = [
    { key: 'total_wo',      label: 'Total Work Orders', icon: 'fi-rr-clipboard-list', gradient: 'from-blue-400 to-blue-600' },
    { key: 'completed',     label: 'Completed',         icon: 'fi-rr-check-circle',   gradient: 'from-emerald-400 to-emerald-600' },
    { key: 'in_production', label: 'In Production',     icon: 'fi-rr-settings',       gradient: 'from-amber-400 to-amber-600' },
    { key: 'overdue',       label: 'Overdue',           icon: 'fi-rr-clock',          gradient: 'from-red-400 to-red-600' },
];

const STATUS_BADGE: Record<string, string> = {
    draft:              'badge-slate',
    approved:           'badge-blue',
    in_production:      'badge-amber',
    qc_hold:            'badge-amber',
    qc_passed:          'badge-green',
    ready_for_delivery: 'badge-purple',
    delivered:          'badge-green',
    cancelled:          'badge-red',
};

export default function ProductionReport({ data, filters }: any) {
    const [from, setFrom] = useState(filters?.from ?? '');
    const [to, setTo] = useState(filters?.to ?? '');

    const apply = () => router.get('/reports/production', { from, to }, { preserveState: true });

    return (
        <AppLayout header="Production Report">
            <div className="space-y-6 animate-fade-in">
                {/* Filter Bar */}
                <div className="card">
                    <div className="card-body flex flex-col sm:flex-row sm:items-end gap-3">
                        <div className="form-group mb-0">
                            <label className="form-label">From</label>
                            <input type="date" value={from} onChange={e => setFrom(e.target.value)} className="form-input" />
                        </div>
                        <div className="form-group mb-0">
                            <label className="form-label">To</label>
                            <input type="date" value={to} onChange={e => setTo(e.target.value)} className="form-input" />
                        </div>
                        <button onClick={apply} className="btn-primary btn-sm">
                            <i className="fi fi-rr-filter leading-none text-xs" /> Apply
                        </button>
                        <a href={`/reports/production/export?from=${from}&to=${to}`} className="btn-outline btn-sm sm:ml-auto">
                            <i className="fi fi-rr-download leading-none text-xs" /> Export CSV
                        </a>
                    </div>
                </div>

                {/* KPI Row */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {STAT_CONFIG.map(s => (
                        <div key={s.key} className="stat-card animate-slide-up">
                            <div className={`stat-icon shadow-lg bg-gradient-to-br ${s.gradient} text-white`}>
                                <i className={`fi ${s.icon} leading-none`} />
                            </div>
                            <div className="min-w-0">
                                <div className="stat-value tabular-nums">{data?.[s.key] ?? 0}</div>
                                <p className="stat-label">{s.label}</p>
                            </div>
                        </div>
                    ))}
                </div>

                {/* WO by Month Chart */}
                {data?.by_month && (
                    <div className="card animate-slide-up">
                        <div className="card-header flex items-center justify-between">
                            <div>
                                <h3 className="text-sm font-semibold text-surface-800">Work Orders by Month</h3>
                                <p className="text-xs text-surface-400 mt-0.5">Completed vs in-production volumes</p>
                            </div>
                            <div className="w-9 h-9 rounded-xl flex items-center justify-center text-sm shrink-0 bg-gradient-to-br from-blue-400 to-blue-600 text-white shadow-md">
                                <i className="fi fi-rr-chart-histogram leading-none" />
                            </div>
                        </div>
                        <div className="card-body">
                            <ResponsiveContainer width="100%" height={260}>
                                <BarChart data={data.by_month} barGap={4} barCategoryGap="30%">
                                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                                    <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                                    <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} width={28} />
                                    <Tooltip content={<ChartTooltip />} />
                                    <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
                                    <Bar dataKey="completed"     name="Completed"     fill="#10b981" radius={[6,6,0,0]} isAnimationActive animationDuration={1000} />
                                    <Bar dataKey="in_production" name="In Production" fill="#f59e0b" radius={[6,6,0,0]} isAnimationActive animationDuration={1100} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                )}

                {/* Work Orders Table */}
                <div className="card animate-slide-up">
                    <div className="card-header flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-xl flex items-center justify-center text-sm shrink-0 bg-gradient-to-br from-brand-400 to-brand-600 text-white shadow-md">
                                <i className="fi fi-rr-clipboard-list leading-none" />
                            </div>
                            <div>
                                <h3 className="text-sm font-semibold text-surface-800">Work Orders</h3>
                                <p className="text-xs text-surface-400 mt-0.5">Detailed production records</p>
                            </div>
                        </div>
                    </div>
                    <div className="hidden md:block overflow-x-auto">
                        <table className="premium-table">
                            <thead>
                                <tr>
                                    <th>WO Number</th>
                                    <th>Product</th>
                                    <th>Customer</th>
                                    <th>Qty</th>
                                    <th>Status</th>
                                    <th>Lead Time (days)</th>
                                    <th>Due Date</th>
                                </tr>
                            </thead>
                            <tbody>
                                {data?.work_orders?.map((wo: any) => (
                                    <tr key={wo.id} className={wo.is_overdue ? '!bg-red-50/40' : ''}>
                                        <td><span className="font-mono font-semibold text-brand-600">{wo.wo_number}</span></td>
                                        <td className="text-surface-800 font-medium">{wo.product}</td>
                                        <td className="text-surface-500">{wo.customer}</td>
                                        <td className="font-mono text-surface-700">{wo.quantity}</td>
                                        <td>
                                            <span className={`badge ${STATUS_BADGE[wo.status] ?? 'badge-slate'}`}>
                                                {wo.status?.replace(/_/g, ' ')}
                                            </span>
                                        </td>
                                        <td className="font-mono text-surface-700">{wo.lead_time_days ?? '—'}</td>
                                        <td className={wo.is_overdue ? 'text-red-600 font-semibold' : 'text-surface-500'}>
                                            {wo.is_overdue && <i className="fi fi-rr-clock leading-none text-xs mr-1" />}
                                            {wo.due_date ?? '—'}
                                        </td>
                                    </tr>
                                ))}
                                {(!data?.work_orders || data.work_orders.length === 0) && (
                                    <tr>
                                        <td colSpan={7}>
                                            <div className="empty-state">
                                                <div className="empty-state-icon"><i className="fi fi-rr-clipboard-list" /></div>
                                                <p className="empty-state-title">No work orders</p>
                                                <p className="empty-state-text">Adjust the filters to view more results.</p>
                                            </div>
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* Mobile cards */}
                    <div className="md:hidden card-body space-y-3">
                        {data?.work_orders?.map((wo: any) => (
                            <div key={wo.id} className={`rounded-xl border p-3.5 ${wo.is_overdue ? 'border-red-200 bg-red-50/40' : 'border-surface-100 bg-surface-50/50'}`}>
                                <div className="flex items-center justify-between mb-2">
                                    <span className="font-mono text-sm font-bold text-brand-600">{wo.wo_number}</span>
                                    <span className={`badge ${STATUS_BADGE[wo.status] ?? 'badge-slate'}`}>{wo.status?.replace(/_/g, ' ')}</span>
                                </div>
                                <p className="text-sm font-medium text-surface-800 truncate">{wo.product}</p>
                                <p className="text-xs text-surface-500 mt-0.5">{wo.customer}</p>
                                <div className="flex items-center justify-between mt-2.5 pt-2 border-t border-surface-100 text-xs">
                                    <span className="text-surface-500">Qty <span className="font-mono text-surface-700">{wo.quantity}</span></span>
                                    <span className="text-surface-500">Lead <span className="font-mono text-surface-700">{wo.lead_time_days ?? '—'}</span></span>
                                    <span className={wo.is_overdue ? 'text-red-600 font-semibold' : 'text-surface-500'}>{wo.due_date ?? '—'}</span>
                                </div>
                            </div>
                        ))}
                        {(!data?.work_orders || data.work_orders.length === 0) && (
                            <div className="empty-state">
                                <div className="empty-state-icon"><i className="fi fi-rr-clipboard-list" /></div>
                                <p className="empty-state-title">No work orders</p>
                                <p className="empty-state-text">Adjust the filters to view more results.</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </AppLayout>
    );
}
