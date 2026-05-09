import AppLayout from '@/Layouts/AppLayout';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';

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
    { key: 'avg_lead_time', label: 'Avg Lead Time', icon: 'fi-rr-time-half-past', gradient: 'from-blue-400 to-blue-600' },
    { key: 'min_lead_time', label: 'Min Lead Time', icon: 'fi-rr-rocket-lunch',   gradient: 'from-emerald-400 to-emerald-600' },
    { key: 'max_lead_time', label: 'Max Lead Time', icon: 'fi-rr-hourglass-end',  gradient: 'from-red-400 to-red-600' },
];

export default function LeadTimeReport({ data }: any) {
    return (
        <AppLayout header="Lead Time Report">
            <div className="space-y-6 animate-fade-in">
                {/* KPIs */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {STAT_CONFIG.map(s => (
                        <div key={s.key} className="stat-card animate-slide-up">
                            <div className={`stat-icon shadow-lg bg-gradient-to-br ${s.gradient} text-white`}>
                                <i className={`fi ${s.icon} leading-none`} />
                            </div>
                            <div className="min-w-0">
                                <div className="stat-value tabular-nums">{data?.[s.key] ?? 0}<span className="text-base font-medium text-surface-400 ml-1">days</span></div>
                                <p className="stat-label">{s.label}</p>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Lead time by product */}
                {data?.by_product && (
                    <div className="card animate-slide-up">
                        <div className="card-header flex items-center justify-between">
                            <div>
                                <h3 className="text-sm font-semibold text-surface-800">Lead Time by Product</h3>
                                <p className="text-xs text-surface-400 mt-0.5">Average days from start to delivery</p>
                            </div>
                            <div className="w-9 h-9 rounded-xl flex items-center justify-center text-sm shrink-0 bg-gradient-to-br from-blue-400 to-blue-600 text-white shadow-md">
                                <i className="fi fi-rr-chart-histogram leading-none" />
                            </div>
                        </div>
                        <div className="card-body">
                            <ResponsiveContainer width="100%" height={300}>
                                <BarChart data={data.by_product}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                                    <XAxis dataKey="product" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                                    <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} width={32} label={{ value: 'Days', angle: -90, position: 'insideLeft', fontSize: 11, fill: '#94a3b8' }} />
                                    <Tooltip content={<ChartTooltip />} />
                                    {data.avg_lead_time && (
                                        <ReferenceLine y={data.avg_lead_time} stroke="#6366f1" strokeDasharray="5 5" label={{ value: 'Avg', fontSize: 10, fill: '#6366f1' }} />
                                    )}
                                    <Bar dataKey="avg_days" name="Avg Lead Time (days)" fill="#3b82f6" radius={[6, 6, 0, 0]} isAnimationActive animationDuration={1000} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                )}

                {/* Work orders table */}
                <div className="card animate-slide-up">
                    <div className="card-header flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-xl flex items-center justify-center text-sm shrink-0 bg-gradient-to-br from-brand-400 to-brand-600 text-white shadow-md">
                                <i className="fi fi-rr-clipboard-list leading-none" />
                            </div>
                            <div>
                                <h3 className="text-sm font-semibold text-surface-800">Work Order Details</h3>
                                <p className="text-xs text-surface-400 mt-0.5">Per-order lead time and on-time status</p>
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
                                    <th>Start</th>
                                    <th>End</th>
                                    <th>Lead Time</th>
                                    <th>On Time</th>
                                </tr>
                            </thead>
                            <tbody>
                                {data?.work_orders?.map((wo: any) => (
                                    <tr key={wo.id} className={wo.on_time === false ? '!bg-red-50/40' : ''}>
                                        <td><span className="font-mono font-semibold text-brand-600">{wo.wo_number}</span></td>
                                        <td className="text-surface-800 font-medium">{wo.product}</td>
                                        <td className="text-surface-500">{wo.customer}</td>
                                        <td className="text-surface-500">{wo.started_date ?? '—'}</td>
                                        <td className="text-surface-500">{wo.completed_date ?? '—'}</td>
                                        <td className="font-mono font-semibold text-surface-700">{wo.lead_time_days ? `${wo.lead_time_days}d` : '—'}</td>
                                        <td>
                                            {wo.on_time === null || wo.on_time === undefined ? (
                                                <span className="text-surface-300">—</span>
                                            ) : wo.on_time ? (
                                                <span className="badge badge-green">On time</span>
                                            ) : (
                                                <span className="badge badge-red">Late</span>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                                {(!data?.work_orders || data.work_orders.length === 0) && (
                                    <tr>
                                        <td colSpan={7}>
                                            <div className="empty-state">
                                                <div className="empty-state-icon"><i className="fi fi-rr-time-half-past" /></div>
                                                <p className="empty-state-title">No lead time data</p>
                                                <p className="empty-state-text">Completed work orders will appear here.</p>
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
                            <div key={wo.id} className={`rounded-xl border p-3.5 ${wo.on_time === false ? 'border-red-200 bg-red-50/40' : 'border-surface-100 bg-surface-50/50'}`}>
                                <div className="flex items-center justify-between mb-2">
                                    <span className="font-mono text-sm font-bold text-brand-600">{wo.wo_number}</span>
                                    {wo.on_time === null || wo.on_time === undefined ? (
                                        <span className="text-surface-300 text-xs">—</span>
                                    ) : wo.on_time ? (
                                        <span className="badge badge-green">On time</span>
                                    ) : (
                                        <span className="badge badge-red">Late</span>
                                    )}
                                </div>
                                <p className="text-sm font-medium text-surface-800 truncate">{wo.product}</p>
                                <p className="text-xs text-surface-500 mt-0.5">{wo.customer}</p>
                                <div className="flex items-center justify-between mt-2.5 pt-2 border-t border-surface-100 text-xs">
                                    <span className="text-surface-500">Start: {wo.started_date ?? '—'}</span>
                                    <span className="font-mono font-semibold text-surface-700">{wo.lead_time_days ? `${wo.lead_time_days}d` : '—'}</span>
                                </div>
                            </div>
                        ))}
                        {(!data?.work_orders || data.work_orders.length === 0) && (
                            <div className="empty-state">
                                <div className="empty-state-icon"><i className="fi fi-rr-time-half-past" /></div>
                                <p className="empty-state-title">No lead time data</p>
                                <p className="empty-state-text">Completed work orders will appear here.</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </AppLayout>
    );
}
