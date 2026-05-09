import AppLayout from '@/Layouts/AppLayout';
import { RadialBarChart, RadialBar, ResponsiveContainer } from 'recharts';

function OeeGauge({ value, label, color, gradient, icon }: { value: number; label: string; color: string; gradient: string; icon: string }) {
    return (
        <div className="card animate-slide-up">
            <div className="card-header flex items-center justify-between">
                <h3 className="text-sm font-semibold text-surface-800">{label}</h3>
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-sm shrink-0 bg-gradient-to-br ${gradient} text-white shadow-md`}>
                    <i className={`fi ${icon} leading-none`} />
                </div>
            </div>
            <div className="card-body">
                <div className="relative" style={{ height: 140 }}>
                    <ResponsiveContainer width="100%" height={140}>
                        <RadialBarChart innerRadius="65%" outerRadius="95%" data={[{ value, fill: color }]} startAngle={180} endAngle={0}>
                            <RadialBar dataKey="value" cornerRadius={8} background={{ fill: '#f1f5f9' }} />
                        </RadialBarChart>
                    </ResponsiveContainer>
                    <div className="absolute inset-0 flex items-end justify-center pb-1">
                        <span className="text-3xl font-bold tabular-nums" style={{ color }}>{value}%</span>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default function OEEReport({ data }: any) {
    return (
        <AppLayout header="OEE — Overall Equipment Effectiveness">
            <div className="space-y-6 animate-fade-in">
                {/* Formula */}
                <div className="glass px-5 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-brand-50 text-brand-500 flex items-center justify-center">
                            <i className="fi fi-rr-calculator leading-none" />
                        </div>
                        <div>
                            <p className="text-xs font-semibold text-surface-500 uppercase tracking-wide">OEE Formula</p>
                            <p className="text-sm text-surface-700">Availability x Performance x Quality</p>
                        </div>
                    </div>
                    <div className="text-right">
                        <p className="text-xs text-surface-400">Overall</p>
                        <p className="text-2xl font-bold text-brand-600 tabular-nums">{data?.oee ?? 0}%</p>
                    </div>
                </div>

                {/* Gauges */}
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
                    <OeeGauge value={data?.oee ?? 0}          label="OEE"          color="#3b82f6" gradient="from-blue-400 to-blue-600"       icon="fi-rr-gauge" />
                    <OeeGauge value={data?.availability ?? 0} label="Availability" color="#10b981" gradient="from-emerald-400 to-emerald-600" icon="fi-rr-time-check" />
                    <OeeGauge value={data?.performance ?? 0}  label="Performance"  color="#f59e0b" gradient="from-amber-400 to-amber-600"     icon="fi-rr-bolt" />
                    <OeeGauge value={data?.quality ?? 0}      label="Quality"      color="#8b5cf6" gradient="from-purple-400 to-purple-600"   icon="fi-rr-shield-check" />
                </div>

                {/* By Machine */}
                <div className="card animate-slide-up">
                    <div className="card-header flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-xl flex items-center justify-center text-sm shrink-0 bg-gradient-to-br from-brand-400 to-brand-600 text-white shadow-md">
                                <i className="fi fi-rr-settings leading-none" />
                            </div>
                            <div>
                                <h3 className="text-sm font-semibold text-surface-800">OEE by Machine</h3>
                                <p className="text-xs text-surface-400 mt-0.5">Detailed performance breakdown</p>
                            </div>
                        </div>
                    </div>

                    <div className="hidden md:block overflow-x-auto">
                        <table className="premium-table">
                            <thead>
                                <tr>
                                    <th>Machine</th>
                                    <th>Work Centre</th>
                                    <th>Available Hrs</th>
                                    <th>Productive Hrs</th>
                                    <th>Downtime Hrs</th>
                                    <th>Availability</th>
                                    <th>Performance</th>
                                    <th>Quality</th>
                                    <th>OEE</th>
                                </tr>
                            </thead>
                            <tbody>
                                {data?.by_machine?.map((row: any) => (
                                    <tr key={row.machine}>
                                        <td className="font-semibold text-surface-900">{row.machine}</td>
                                        <td className="text-surface-500">{row.work_centre}</td>
                                        <td className="font-mono text-surface-700">{row.available_hours}h</td>
                                        <td className="font-mono text-surface-700">{row.productive_hours}h</td>
                                        <td className="font-mono text-red-600">{row.downtime_hours}h</td>
                                        <td className="font-mono text-surface-700">{row.availability}%</td>
                                        <td className="font-mono text-surface-700">{row.performance}%</td>
                                        <td className="font-mono text-surface-700">{row.quality}%</td>
                                        <td><span className="font-mono font-bold text-brand-700">{row.oee}%</span></td>
                                    </tr>
                                ))}
                                {(!data?.by_machine || data.by_machine.length === 0) && (
                                    <tr>
                                        <td colSpan={9}>
                                            <div className="empty-state">
                                                <div className="empty-state-icon"><i className="fi fi-rr-settings" /></div>
                                                <p className="empty-state-title">No machine data</p>
                                                <p className="empty-state-text">Machine OEE records will appear here.</p>
                                            </div>
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* Mobile cards */}
                    <div className="md:hidden card-body space-y-3">
                        {data?.by_machine?.map((row: any) => (
                            <div key={row.machine} className="rounded-xl border border-surface-100 bg-surface-50/50 p-3.5">
                                <div className="flex items-center justify-between mb-2">
                                    <span className="font-semibold text-surface-900">{row.machine}</span>
                                    <span className="font-mono font-bold text-brand-700">{row.oee}%</span>
                                </div>
                                <p className="text-xs text-surface-500 mb-2">{row.work_centre}</p>
                                <div className="grid grid-cols-3 gap-2 text-xs pt-2 border-t border-surface-100">
                                    <div><p className="text-surface-400">Avail</p><p className="font-mono text-surface-700">{row.availability}%</p></div>
                                    <div><p className="text-surface-400">Perf</p><p className="font-mono text-surface-700">{row.performance}%</p></div>
                                    <div><p className="text-surface-400">Quality</p><p className="font-mono text-surface-700">{row.quality}%</p></div>
                                </div>
                            </div>
                        ))}
                        {(!data?.by_machine || data.by_machine.length === 0) && (
                            <div className="empty-state">
                                <div className="empty-state-icon"><i className="fi fi-rr-settings" /></div>
                                <p className="empty-state-title">No machine data</p>
                                <p className="empty-state-text">Machine OEE records will appear here.</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </AppLayout>
    );
}
