import AppLayout from '@/Layouts/AppLayout';
import { router } from '@inertiajs/react';

const ROW_HEIGHT = 48;

function GanttBar({ job, startHour, totalHours }: { job: any; startHour: number; totalHours: number }) {
    const left = ((job.offset_hours - startHour) / totalHours) * 100;
    const width = (job.estimated_hours / totalHours) * 100;
    const isConflict = job.conflict;
    const isOverdue = job.is_overdue;

    const barClass = isConflict
        ? 'bg-red-500 hover:bg-red-600'
        : isOverdue
            ? 'bg-amber-500 hover:bg-amber-600'
            : 'bg-brand-500 hover:bg-brand-600';

    return (
        <div
            className={`absolute top-2 bottom-2 rounded-lg flex items-center px-2 text-xs font-semibold text-white overflow-hidden cursor-pointer shadow-sm transition-colors ${barClass}`}
            style={{
                left: `${Math.max(0, left)}%`,
                width: `${Math.min(width, 100 - Math.max(0, left))}%`,
            }}
            title={`${job.wo_number} | ${job.operation_name} | ${job.estimated_hours}h${isConflict ? ' CONFLICT' : ''}`}
        >
            <span className="truncate">{job.wo_number}</span>
        </div>
    );
}

export default function ScheduleIndex({ ganttData, dateRange, conflicts, unscheduledCount = 0, currentStart }: any) {
    const machines: string[] = ganttData ? Object.keys(ganttData) : [];

    const runAutoSchedule = () => {
        if (!confirm(`Auto-schedule ${unscheduledCount} pending operation step(s) starting ${dateRange?.label?.split(' – ')[0]}?\n\nThe system will fill each machine's shifts in WO order. You can adjust afterwards.`)) return;
        router.post('/schedule/auto', { start: currentStart });
    };
    const totalHours = 16; // 7am–11pm display window
    const hours = Array.from({ length: totalHours + 1 }, (_, i) => i + 7);

    return (
        <AppLayout header="Production Schedule">
            <div className="space-y-6 animate-fade-in">
                <div className="card">
                    <div className="card-header flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
                        <div>
                            <h2 className="text-base font-bold text-surface-900">Production Schedule</h2>
                            <p className="text-xs text-surface-400 mt-0.5">Gantt view of jobs across machines and work centres</p>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                            {unscheduledCount > 0 && (
                                <button onClick={runAutoSchedule} className="btn-primary btn-xs">
                                    <i className="fi fi-rr-magic-wand text-xs leading-none" /> Auto-Schedule ({unscheduledCount})
                                </button>
                            )}
                            <button
                                onClick={() => router.get('/schedule', { date: dateRange?.prev })}
                                className="btn-outline btn-xs"
                            >
                                <i className="fi fi-rr-arrow-left text-xs leading-none" /> Prev
                            </button>
                            <span className="px-3 py-1 text-xs font-semibold text-surface-700 bg-surface-100 rounded-lg">
                                {dateRange?.label}
                            </span>
                            <button
                                onClick={() => router.get('/schedule', { date: dateRange?.next })}
                                className="btn-outline btn-xs"
                            >
                                Next <i className="fi fi-rr-arrow-right text-xs leading-none" />
                            </button>
                        </div>
                    </div>

                    <div className="card-body border-b border-surface-100 flex flex-wrap items-center justify-between gap-3">
                        <div className="flex items-center gap-4 text-xs text-surface-600">
                            <span className="flex items-center gap-1.5">
                                <span className="w-4 h-3 rounded bg-brand-500 inline-block"></span> Scheduled
                            </span>
                            <span className="flex items-center gap-1.5">
                                <span className="w-4 h-3 rounded bg-amber-500 inline-block"></span> Overdue
                            </span>
                            <span className="flex items-center gap-1.5">
                                <span className="w-4 h-3 rounded bg-red-500 inline-block"></span> Conflict
                            </span>
                        </div>
                        {conflicts > 0 && (
                            <span className="badge badge-red">
                                <i className="fi fi-rr-exclamation text-xs leading-none" />
                                {conflicts} scheduling conflict{conflicts > 1 ? 's' : ''}
                            </span>
                        )}
                    </div>

                    {machines.length === 0 ? (
                        <div className="card-body">
                            <div className="empty-state">
                                <div className="empty-state-icon">
                                    <i className="fi fi-rr-calendar" />
                                </div>
                                <div className="empty-state-title">No scheduled jobs for this period</div>
                                <div className="empty-state-text">
                                    {unscheduledCount > 0
                                        ? `${unscheduledCount} operation step(s) are awaiting scheduling. Click below to auto-schedule them.`
                                        : 'There are no pending operation steps to schedule yet. Create an Operation Sheet with machine assignments first.'}
                                </div>
                                {unscheduledCount > 0 && (
                                    <div className="mt-4">
                                        <button onClick={runAutoSchedule} className="btn-primary btn-sm">
                                            <i className="fi fi-rr-magic-wand text-xs leading-none" /> Auto-Schedule {unscheduledCount} Step{unscheduledCount !== 1 ? 's' : ''}
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            {/* Time header */}
                            <div className="flex border-b border-surface-100 bg-surface-50 sticky top-0 z-10">
                                <div className="w-48 flex-shrink-0 px-4 py-2.5 text-xs font-semibold text-surface-500 uppercase tracking-wider border-r border-surface-100">
                                    Machine / Work Centre
                                </div>
                                <div className="flex-1 flex min-w-[600px]">
                                    {hours.map(h => (
                                        <div
                                            key={h}
                                            className="flex-1 text-center text-xs text-surface-400 py-2.5 border-r border-surface-100 last:border-0"
                                        >
                                            {h}:00
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Rows */}
                            {machines.map(machineName => {
                                const jobs = ganttData[machineName] ?? [];
                                return (
                                    <div
                                        key={machineName}
                                        className="flex border-b border-surface-100 last:border-0 hover:bg-surface-50/50 transition-colors"
                                        style={{ height: ROW_HEIGHT }}
                                    >
                                        <div className="w-48 flex-shrink-0 px-4 flex items-center border-r border-surface-100 bg-surface-50/50">
                                            <div className="text-xs font-semibold text-surface-700 truncate">
                                                {machineName}
                                            </div>
                                        </div>
                                        <div className="flex-1 relative min-w-[600px]">
                                            <div className="absolute inset-0 flex">
                                                {hours.map(h => (
                                                    <div
                                                        key={h}
                                                        className="flex-1 border-r border-surface-100/60 last:border-0"
                                                    ></div>
                                                ))}
                                            </div>
                                            {jobs.map((job: any) => (
                                                <GanttBar key={job.id} job={job} startHour={7} totalHours={totalHours} />
                                            ))}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>
        </AppLayout>
    );
}
