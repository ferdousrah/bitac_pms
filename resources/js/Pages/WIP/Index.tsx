import AppLayout from '@/Layouts/AppLayout';
import { router } from '@inertiajs/react';
import { useEffect, useState } from 'react';

function ElapsedCell({ startedAt, estimatedHours }: { startedAt: string; estimatedHours: number }) {
    const [elapsed, setElapsed] = useState(0);

    useEffect(() => {
        const start = new Date(startedAt).getTime();
        const update = () => setElapsed(Math.floor((Date.now() - start) / 60000));
        update();
        const timer = setInterval(update, 1000);
        return () => clearInterval(timer);
    }, [startedAt]);

    const estimatedMins = estimatedHours * 60;
    const pct = estimatedMins > 0 ? (elapsed / estimatedMins) * 100 : 0;
    const color = pct < 100 ? 'text-green-600' : pct < 120 ? 'text-amber-600' : 'text-red-600';

    return (
        <span className={`font-mono text-sm font-semibold ${color}`}>
            {Math.floor(elapsed / 60)}h {elapsed % 60}m
        </span>
    );
}

export default function WIPIndex({ activeJobs, wipSummary }: any) {
    // Auto-refresh every 30 seconds
    useEffect(() => {
        const timer = setInterval(() => {
            router.reload({ only: ['activeJobs', 'wipSummary'] });
        }, 30000);
        return () => clearInterval(timer);
    }, []);

    const formatTime = (dt: string) =>
        new Date(dt).toLocaleTimeString('en-BD', { hour: '2-digit', minute: '2-digit' });

    return (
        <AppLayout header="Work In Progress">
            <div className="space-y-6 animate-fade-in">
                <div className="card">
                    <div className="card-header flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                        <div>
                            <h2 className="text-base font-bold text-surface-900">Live WIP Board</h2>
                            <p className="text-xs text-surface-400 mt-0.5">Currently active jobs across the shop floor</p>
                        </div>
                        <span className="inline-flex items-center gap-1.5 text-xs text-surface-500">
                            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                            Auto-refreshes every 30s
                        </span>
                    </div>

                    {/* Desktop table */}
                    <div className="card-body hidden lg:block overflow-x-auto">
                        {activeJobs.length > 0 ? (
                            <table className="premium-table">
                                <thead>
                                    <tr>
                                        <th>WO Number</th>
                                        <th>Product</th>
                                        <th>Customer</th>
                                        <th>Step</th>
                                        <th>Machine</th>
                                        <th>Work Centre</th>
                                        <th>Operator</th>
                                        <th>Started</th>
                                        <th>Elapsed</th>
                                        <th>Status</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {activeJobs.map((job: any) => {
                                        const estimatedMins = job.estimated_hours * 60;
                                        const elapsedMins = job.elapsed_minutes;
                                        const pct = estimatedMins > 0 ? (elapsedMins / estimatedMins) * 100 : 0;
                                        const rowClass =
                                            pct > 120 ? 'bg-red-50/40' :
                                            pct > 100 ? 'bg-amber-50/40' :
                                            job.status === 'qc_hold' ? 'bg-blue-50/30' : '';

                                        return (
                                            <tr key={job.id} className={rowClass}>
                                                <td>
                                                    <span className="font-mono font-semibold text-brand-600">{job.wo_number}</span>
                                                </td>
                                                <td className="font-medium text-surface-900">{job.product}</td>
                                                <td className="text-surface-600">{job.customer}</td>
                                                <td className="text-surface-700">{job.current_step}</td>
                                                <td className="text-surface-600">{job.machine}</td>
                                                <td className="text-surface-600">{job.work_centre}</td>
                                                <td className="text-surface-700">{job.operator}</td>
                                                <td className="text-surface-500">
                                                    {job.started_at ? formatTime(job.started_at) : <span className="text-surface-300">--</span>}
                                                </td>
                                                <td>
                                                    {job.started_at ? (
                                                        <ElapsedCell startedAt={job.started_at} estimatedHours={job.estimated_hours} />
                                                    ) : (
                                                        <span className="text-surface-300">--</span>
                                                    )}
                                                </td>
                                                <td>
                                                    <span className={`badge ${job.status === 'qc_hold' ? 'badge-blue' : 'badge-amber'}`}>
                                                        {job.status}
                                                    </span>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        ) : (
                            <div className="empty-state">
                                <div className="empty-state-icon">
                                    <i className="fi fi-rr-time-fast" />
                                </div>
                                <div className="empty-state-title">No active jobs</div>
                                <div className="empty-state-text">There are currently no jobs running on the shop floor.</div>
                            </div>
                        )}
                    </div>

                    {/* Mobile cards */}
                    <div className="card-body lg:hidden space-y-3">
                        {activeJobs.length > 0 ? (
                            activeJobs.map((job: any) => {
                                const estimatedMins = job.estimated_hours * 60;
                                const elapsedMins = job.elapsed_minutes;
                                const pct = estimatedMins > 0 ? (elapsedMins / estimatedMins) * 100 : 0;
                                const borderClass =
                                    pct > 120 ? 'border-red-200 bg-red-50/20' :
                                    pct > 100 ? 'border-amber-200 bg-amber-50/20' :
                                    job.status === 'qc_hold' ? 'border-blue-200 bg-blue-50/20' :
                                    'border-surface-100';

                                return (
                                    <div
                                        key={job.id}
                                        className={`rounded-xl border p-4 space-y-3 animate-slide-up ${borderClass}`}
                                    >
                                        <div className="flex items-start justify-between">
                                            <div>
                                                <div className="font-mono font-semibold text-brand-600 text-sm">{job.wo_number}</div>
                                                <div className="font-medium text-surface-900 text-sm mt-0.5">{job.product}</div>
                                                <div className="text-xs text-surface-500">{job.customer}</div>
                                            </div>
                                            <span className={`badge ${job.status === 'qc_hold' ? 'badge-blue' : 'badge-amber'}`}>
                                                {job.status}
                                            </span>
                                        </div>

                                        <div className="grid grid-cols-2 gap-2 text-xs text-surface-600">
                                            <div>
                                                <span className="text-surface-400">Step: </span>
                                                <span className="text-surface-700">{job.current_step}</span>
                                            </div>
                                            <div>
                                                <span className="text-surface-400">Machine: </span>
                                                <span className="text-surface-700">{job.machine}</span>
                                            </div>
                                            <div>
                                                <span className="text-surface-400">WC: </span>
                                                <span className="text-surface-700">{job.work_centre}</span>
                                            </div>
                                            <div>
                                                <span className="text-surface-400">Operator: </span>
                                                <span className="text-surface-700">{job.operator}</span>
                                            </div>
                                        </div>

                                        <div className="flex items-center justify-between pt-2 border-t border-surface-50 text-xs">
                                            <span className="text-surface-500">
                                                <i className="fi fi-rr-clock text-xs leading-none mr-1" />
                                                Started {job.started_at ? formatTime(job.started_at) : '--'}
                                            </span>
                                            {job.started_at && (
                                                <ElapsedCell startedAt={job.started_at} estimatedHours={job.estimated_hours} />
                                            )}
                                        </div>
                                    </div>
                                );
                            })
                        ) : (
                            <div className="empty-state">
                                <div className="empty-state-icon">
                                    <i className="fi fi-rr-time-fast" />
                                </div>
                                <div className="empty-state-title">No active jobs</div>
                                <div className="empty-state-text">There are currently no jobs running on the shop floor.</div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </AppLayout>
    );
}
