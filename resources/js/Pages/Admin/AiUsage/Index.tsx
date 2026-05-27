import AppLayout from '@/Layouts/AppLayout';
import { router } from '@inertiajs/react';
import { useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

const fmtNum = (n: any) => Number(n ?? 0).toLocaleString('en-IN');
// Use 4–6 decimals for USD since per-call costs are tiny (~$0.0001 each).
const fmtUsd = (n: any) => `$${Number(n ?? 0).toFixed(6)}`;
const fmtBdt = (usd: any) => `৳${(Number(usd ?? 0) * 120).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;

export default function AiUsageIndex({ totals, daily, by_center, by_customer, top_users, recent, filters }: any) {
    const [from, setFrom] = useState(filters?.from ?? '');
    const [to, setTo]     = useState(filters?.to ?? '');

    const apply = () => router.get('/admin/ai-usage', { from, to }, { preserveState: true });

    return (
        <AppLayout header="AI Usage & Cost">
            <div className="space-y-6 animate-fade-in">
                {/* Filter */}
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
                            <i className="fi fi-rr-filter text-xs" /> Apply
                        </button>
                        <div className="sm:ml-auto text-xs text-surface-400 italic">
                            Cost is BITAC's internal Gemini bill. Hidden from non-admin views.
                        </div>
                    </div>
                </div>

                {/* KPI tiles */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    <StatTile label="Requests"      value={fmtNum(totals.requests)}      icon="fi-rr-bolt"              gradient="from-blue-400 to-blue-600" />
                    <StatTile label="Total Tokens"  value={fmtNum(totals.total_tokens)}  icon="fi-rr-comment-alt"       gradient="from-indigo-400 to-indigo-600" />
                    <StatTile label="Gemini Cost"   value={fmtUsd(totals.cost_usd)}      icon="fi-rr-coins"             gradient="from-emerald-400 to-emerald-600"
                              sub={`≈ ${fmtBdt(totals.cost_usd)} (BDT @ 120)`} />
                    <StatTile label="Avg Latency"   value={`${fmtNum(totals.avg_ms)}ms`} icon="fi-rr-time-quarter-past" gradient="from-amber-400 to-amber-600" />
                </div>

                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    <StatTile label="Input Tokens"  value={fmtNum(totals.input_tokens)}  icon="fi-rr-arrow-down-from-cloud" gradient="from-teal-400 to-teal-600" />
                    <StatTile label="Output Tokens" value={fmtNum(totals.output_tokens)} icon="fi-rr-arrow-up-from-square"   gradient="from-purple-400 to-purple-600" />
                    <StatTile label="Tool Calls"    value={fmtNum(totals.tool_calls)}    icon="fi-rr-tools"                  gradient="from-rose-400 to-rose-600" />
                    <StatTile label="Errors"        value={fmtNum(totals.errors)}        icon="fi-rr-triangle-warning"       gradient={totals.errors > 0 ? 'from-red-400 to-red-600' : 'from-slate-300 to-slate-500'} />
                </div>

                {/* Daily trend chart */}
                <div className="card">
                    <div className="card-header">
                        <h3 className="text-sm font-bold text-surface-900">Daily Usage Trend</h3>
                        <p className="text-xs text-surface-400 mt-0.5">Requests + tokens by day</p>
                    </div>
                    <div className="card-body">
                        <ResponsiveContainer width="100%" height={260}>
                            <BarChart data={daily}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                                <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                                <YAxis yAxisId="left" allowDecimals={false} tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} width={32} />
                                <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} width={42} />
                                <Tooltip />
                                <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
                                <Bar yAxisId="left"  dataKey="requests" name="Requests" fill="#3b82f6" radius={[6,6,0,0]} />
                                <Bar yAxisId="right" dataKey="tokens"   name="Tokens"   fill="#6366f1" radius={[6,6,0,0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Per-tenant tables */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <TenantTable title="By BITAC Center" rows={by_center} emptyText="No center-side usage" />
                    <TenantTable title="By Customer (Portal)" rows={by_customer} emptyText="No customer-portal usage yet" />
                </div>

                {/* Top users */}
                <div className="card">
                    <div className="card-header">
                        <h3 className="text-sm font-bold text-surface-900">Top Users</h3>
                        <p className="text-xs text-surface-400 mt-0.5">Most active staff users in the period</p>
                    </div>
                    <div className="card-body p-0">
                        {top_users.length === 0 ? (
                            <div className="empty-state"><div className="empty-state-icon"><i className="fi fi-rr-user" /></div><div className="empty-state-title">No user activity</div></div>
                        ) : (
                            <table className="premium-table">
                                <thead><tr><th>User</th><th className="text-right">Requests</th><th className="text-right">Tokens</th><th className="text-right">Cost</th></tr></thead>
                                <tbody>
                                    {top_users.map((u: any) => (
                                        <tr key={u.id}>
                                            <td>
                                                <div className="text-sm font-semibold text-surface-900">{u.name}</div>
                                                <div className="text-[11px] text-surface-400">{u.email}</div>
                                            </td>
                                            <td className="text-right font-mono">{fmtNum(u.requests)}</td>
                                            <td className="text-right font-mono">{fmtNum(u.tokens)}</td>
                                            <td className="text-right font-mono text-emerald-700">{fmtUsd(u.cost)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>
                </div>

                {/* Recent calls */}
                <div className="card">
                    <div className="card-header">
                        <h3 className="text-sm font-bold text-surface-900">Recent Calls</h3>
                        <p className="text-xs text-surface-400 mt-0.5">Last 25 requests</p>
                    </div>
                    <div className="card-body p-0">
                        <div className="overflow-x-auto">
                            <table className="premium-table">
                                <thead><tr>
                                    <th>Time</th><th>Tenant</th><th>Actor</th><th className="text-right">Input</th><th className="text-right">Output</th><th className="text-right">Cost</th><th className="text-right">Latency</th><th>Tools</th><th>Status</th>
                                </tr></thead>
                                <tbody>
                                    {recent.length === 0 && (
                                        <tr><td colSpan={9} className="text-center text-surface-400 italic py-8">No requests in the window.</td></tr>
                                    )}
                                    {recent.map((r: any) => (
                                        <tr key={r.id} className={r.status !== 'ok' ? '!bg-red-50/40' : ''}>
                                            <td className="text-xs text-surface-500">{r.created_at}</td>
                                            <td>
                                                <span className="text-sm text-surface-800">{r.tenant}</span>
                                                <span className={`badge ml-2 text-[9px] ${r.tenant_type === 'customer' ? 'badge-purple' : 'badge-blue'}`}>{r.tenant_type}</span>
                                            </td>
                                            <td className="text-xs text-surface-700">{r.actor}</td>
                                            <td className="text-right font-mono text-xs">{fmtNum(r.input_tokens)}</td>
                                            <td className="text-right font-mono text-xs">{fmtNum(r.output_tokens)}</td>
                                            <td className="text-right font-mono text-xs text-emerald-700">{fmtUsd(r.cost_usd)}</td>
                                            <td className="text-right font-mono text-xs text-surface-500">{r.request_ms}ms</td>
                                            <td className="text-center text-xs">{r.tool_calls > 0 ? r.tool_calls : '—'}</td>
                                            <td>
                                                <span className={`badge text-[9px] ${r.status === 'ok' ? 'badge-green' : 'badge-red'}`}>{r.status}</span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>
        </AppLayout>
    );
}

function StatTile({ label, value, icon, gradient, sub }: any) {
    return (
        <div className="stat-card">
            <div className={`stat-icon shadow-lg bg-gradient-to-br ${gradient} text-white`}>
                <i className={`fi ${icon} leading-none`} />
            </div>
            <div className="min-w-0">
                <div className="stat-value tabular-nums truncate" title={String(value)}>{value}</div>
                <p className="stat-label">{label}</p>
                {sub && <p className="text-[10px] text-surface-500 mt-0.5 truncate">{sub}</p>}
            </div>
        </div>
    );
}

function TenantTable({ title, rows, emptyText }: any) {
    return (
        <div className="card">
            <div className="card-header">
                <h3 className="text-sm font-bold text-surface-900">{title}</h3>
            </div>
            <div className="card-body p-0">
                {rows.length === 0 ? (
                    <div className="empty-state"><div className="empty-state-icon"><i className="fi fi-rr-building" /></div><div className="empty-state-title">{emptyText}</div></div>
                ) : (
                    <table className="premium-table">
                        <thead><tr><th>Name</th><th className="text-right">Requests</th><th className="text-right">Tokens</th><th className="text-right">Cost</th></tr></thead>
                        <tbody>
                            {rows.map((r: any) => (
                                <tr key={r.id}>
                                    <td className="font-semibold text-surface-900 text-sm">{r.name}</td>
                                    <td className="text-right font-mono">{fmtNum(r.requests)}</td>
                                    <td className="text-right font-mono">{fmtNum(r.tokens)}</td>
                                    <td className="text-right font-mono text-emerald-700">{fmtUsd(r.cost)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>
        </div>
    );
}
