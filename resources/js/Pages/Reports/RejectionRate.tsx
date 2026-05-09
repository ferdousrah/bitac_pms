import AppLayout from '@/Layouts/AppLayout';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';

const COLORS = ['#10b981', '#ef4444', '#f59e0b'];

function ChartTooltip({ active, payload, label }: any) {
    if (!active || !payload?.length) return null;
    return (
        <div className="glass px-3.5 py-2.5 text-xs !rounded-xl !shadow-premium-lg">
            {label && <p className="font-semibold text-surface-800 mb-1.5">{label}</p>}
            {payload.map((p: any, i: number) => (
                <p key={i} style={{ color: p.color ?? p.payload?.fill }} className="flex items-center gap-2 py-0.5">
                    <span className="w-2 h-2 rounded-full inline-block shrink-0" style={{ background: p.color ?? p.payload?.fill }} />
                    <span className="text-surface-600">{p.name}:</span>
                    <span className="font-bold">{p.value ?? '—'}</span>
                </p>
            ))}
        </div>
    );
}

const STAT_CONFIG = [
    { key: 'total_inspections', label: 'Total Inspections', icon: 'fi-rr-shield-check',  gradient: 'from-blue-400 to-blue-600',     suffix: '' },
    { key: 'pass_rate',         label: 'Pass Rate',          icon: 'fi-rr-check-circle',  gradient: 'from-emerald-400 to-emerald-600', suffix: '%' },
    { key: 'rejection_rate',    label: 'Rejection Rate',     icon: 'fi-rr-cross-circle',  gradient: 'from-red-400 to-red-600',        suffix: '%' },
    { key: 'open_ncrs',         label: 'Open NCRs',          icon: 'fi-rr-triangle-warning', gradient: 'from-orange-400 to-orange-600', suffix: '' },
];

export default function RejectionRateReport({ data }: any) {
    const pieData = [
        { name: 'Passed',      value: data?.total_passed ?? 0 },
        { name: 'Failed',      value: data?.total_failed ?? 0 },
        { name: 'Conditional', value: data?.total_conditional ?? 0 },
    ].filter(d => d.value > 0);

    return (
        <AppLayout header="Rejection Rate Report">
            <div className="space-y-6 animate-fade-in">
                {/* KPIs */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {STAT_CONFIG.map(s => (
                        <div key={s.key} className="stat-card animate-slide-up">
                            <div className={`stat-icon shadow-lg bg-gradient-to-br ${s.gradient} text-white`}>
                                <i className={`fi ${s.icon} leading-none`} />
                            </div>
                            <div className="min-w-0">
                                <div className="stat-value tabular-nums">{data?.[s.key] ?? 0}{s.suffix}</div>
                                <p className="stat-label">{s.label}</p>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Charts row */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <div className="card animate-slide-up">
                        <div className="card-header flex items-center justify-between">
                            <div>
                                <h3 className="text-sm font-semibold text-surface-800">Overall Results</h3>
                                <p className="text-xs text-surface-400 mt-0.5">Pass / fail / conditional distribution</p>
                            </div>
                            <div className="w-9 h-9 rounded-xl flex items-center justify-center text-sm shrink-0 bg-gradient-to-br from-emerald-400 to-emerald-600 text-white shadow-md">
                                <i className="fi fi-rr-chart-pie-alt leading-none" />
                            </div>
                        </div>
                        <div className="card-body">
                            <ResponsiveContainer width="100%" height={240}>
                                <PieChart>
                                    <Pie
                                        data={pieData}
                                        dataKey="value"
                                        nameKey="name"
                                        cx="50%" cy="50%"
                                        innerRadius={55}
                                        outerRadius={90}
                                        paddingAngle={3}
                                        label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}
                                        isAnimationActive
                                        animationDuration={1000}
                                    >
                                        {pieData.map((_, i) => <Cell key={i} fill={COLORS[i]} />)}
                                    </Pie>
                                    <Tooltip content={<ChartTooltip />} />
                                </PieChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    {data?.by_defect_type && data.by_defect_type.length > 0 && (
                        <div className="card animate-slide-up">
                            <div className="card-header flex items-center justify-between">
                                <div>
                                    <h3 className="text-sm font-semibold text-surface-800">Defects by Type</h3>
                                    <p className="text-xs text-surface-400 mt-0.5">Top defect categories</p>
                                </div>
                                <div className="w-9 h-9 rounded-xl flex items-center justify-center text-sm shrink-0 bg-gradient-to-br from-red-400 to-red-600 text-white shadow-md">
                                    <i className="fi fi-rr-triangle-warning leading-none" />
                                </div>
                            </div>
                            <div className="card-body">
                                <ResponsiveContainer width="100%" height={240}>
                                    <BarChart data={data.by_defect_type} layout="vertical">
                                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                                        <XAxis type="number" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                                        <YAxis type="category" dataKey="type" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} width={120} />
                                        <Tooltip content={<ChartTooltip />} />
                                        <Bar dataKey="count" fill="#ef4444" radius={[0, 6, 6, 0]} isAnimationActive animationDuration={1000} />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </div>
                    )}
                </div>

                {/* By product table */}
                <div className="card animate-slide-up">
                    <div className="card-header flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-xl flex items-center justify-center text-sm shrink-0 bg-gradient-to-br from-brand-400 to-brand-600 text-white shadow-md">
                                <i className="fi fi-rr-box leading-none" />
                            </div>
                            <div>
                                <h3 className="text-sm font-semibold text-surface-800">Rejection Rate by Product</h3>
                                <p className="text-xs text-surface-400 mt-0.5">Quality performance per product line</p>
                            </div>
                        </div>
                    </div>

                    <div className="hidden md:block overflow-x-auto">
                        <table className="premium-table">
                            <thead>
                                <tr>
                                    <th>Product</th>
                                    <th>Inspections</th>
                                    <th>Passed</th>
                                    <th>Failed</th>
                                    <th>Rejection Rate</th>
                                </tr>
                            </thead>
                            <tbody>
                                {data?.by_product?.map((row: any) => (
                                    <tr key={row.product}>
                                        <td className="font-medium text-surface-900">{row.product}</td>
                                        <td className="font-mono text-surface-700">{row.total}</td>
                                        <td className="font-mono text-emerald-600 font-semibold">{row.passed}</td>
                                        <td className="font-mono text-red-600 font-semibold">{row.failed}</td>
                                        <td><span className="font-mono font-bold text-surface-800">{row.rejection_rate}%</span></td>
                                    </tr>
                                ))}
                                {(!data?.by_product || data.by_product.length === 0) && (
                                    <tr>
                                        <td colSpan={5}>
                                            <div className="empty-state">
                                                <div className="empty-state-icon"><i className="fi fi-rr-shield-check" /></div>
                                                <p className="empty-state-title">No inspection data</p>
                                                <p className="empty-state-text">QC inspection records will appear here.</p>
                                            </div>
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* Mobile cards */}
                    <div className="md:hidden card-body space-y-3">
                        {data?.by_product?.map((row: any) => (
                            <div key={row.product} className="rounded-xl border border-surface-100 bg-surface-50/50 p-3.5">
                                <div className="flex items-center justify-between mb-2">
                                    <span className="font-medium text-surface-900">{row.product}</span>
                                    <span className="font-mono font-bold text-surface-800">{row.rejection_rate}%</span>
                                </div>
                                <div className="grid grid-cols-3 gap-2 text-xs pt-2 border-t border-surface-100">
                                    <div><p className="text-surface-400">Total</p><p className="font-mono text-surface-700">{row.total}</p></div>
                                    <div><p className="text-surface-400">Passed</p><p className="font-mono text-emerald-600 font-semibold">{row.passed}</p></div>
                                    <div><p className="text-surface-400">Failed</p><p className="font-mono text-red-600 font-semibold">{row.failed}</p></div>
                                </div>
                            </div>
                        ))}
                        {(!data?.by_product || data.by_product.length === 0) && (
                            <div className="empty-state">
                                <div className="empty-state-icon"><i className="fi fi-rr-shield-check" /></div>
                                <p className="empty-state-title">No inspection data</p>
                                <p className="empty-state-text">QC inspection records will appear here.</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </AppLayout>
    );
}
