import AppLayout from '@/Layouts/AppLayout';
import { Link, router } from '@inertiajs/react';
import { useState } from 'react';
import JobTypeBadge from '@/Components/JobTypeBadge';

interface SectionLite {
    id: number;
    name: string;
    code: string;
    name_bn?: string | null;
}

interface QueueJob {
    id: number;
    sequence: number;
    status: string;
    started_at: string | null;
    work_order: {
        id: number;
        wo_number: string;
        job_number: number | null;
        customer: string;
        product: string | null;
        quantity: number;
        job_type: string;
        due_date: string | null;
        priority: string;
    };
    rework: {
        from_section: string;
        transferred_by: string;
        note: string;
        transferred_at: string;
    } | null;
}

interface Props {
    section: SectionLite | null;
    jobs: QueueJob[];
    available_sections: SectionLite[];
    can_switch: boolean;
}

const STATUS_BADGE: Record<string, string> = {
    ready:           'badge-blue',
    in_progress:     'badge-amber',
    rework:          'badge-red',
    awaiting_rework: 'badge-slate',
};

const STATUS_LABEL: Record<string, string> = {
    ready:           'Ready',
    in_progress:     'In Progress',
    rework:          'Rework Required',
    awaiting_rework: 'Awaiting Rework',
};

const PRIORITY_BADGE: Record<string, string> = {
    low:    'badge-slate',
    normal: 'badge-blue',
    high:   'badge-amber',
    urgent: 'badge-red',
};

export default function ProductionQueue({ section, jobs, available_sections, can_switch }: Props) {
    if (!section) {
        return (
            <AppLayout header="Production">
                <div className="empty-state max-w-xl mx-auto mt-12">
                    <div className="empty-state-icon"><i className="fi fi-rr-industry-windows" /></div>
                    <div className="empty-state-title">No section assigned</div>
                    <div className="empty-state-text">
                        Your user account isn't linked to a production section yet. Ask an admin to set
                        your section under Admin → Users so the queue can populate.
                    </div>
                </div>
            </AppLayout>
        );
    }

    const switchSection = (id: number) => {
        router.get('/production/queue', { section: id }, { preserveScroll: true });
    };

    return (
        <AppLayout header={`Production — ${section.name}`}>
            <div className="space-y-6 animate-fade-in">
                {/* Section header */}
                <div className="card">
                    <div className="card-body flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                        <div className="flex items-center gap-4">
                            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-brand-500 to-brand-700 text-white font-bold text-lg flex items-center justify-center shadow-md">
                                <i className="fi fi-rr-industry-windows" />
                            </div>
                            <div>
                                <div className="text-xs font-semibold text-surface-400 uppercase tracking-wider">Section Queue</div>
                                <h1 className="text-xl font-bold text-surface-900">{section.name}</h1>
                                <div className="text-xs text-surface-500 mt-0.5">
                                    <span className="font-mono">{section.code}</span>
                                    {section.name_bn && <span> · {section.name_bn}</span>}
                                </div>
                            </div>
                        </div>
                        {can_switch && available_sections.length > 1 && (
                            <div>
                                <label className="form-label-optional text-[10px]">Switch section</label>
                                <select
                                    value={section.id}
                                    onChange={(e) => switchSection(Number(e.target.value))}
                                    className="form-select w-56"
                                >
                                    {available_sections.map((s) => (
                                        <option key={s.id} value={s.id}>
                                            {s.name} ({s.code})
                                        </option>
                                    ))}
                                </select>
                            </div>
                        )}
                    </div>
                </div>

                {/* Active jobs */}
                <div className="card">
                    <div className="card-header">
                        <h2 className="text-base font-bold text-surface-900">Active Jobs</h2>
                        <p className="text-xs text-surface-400 mt-0.5">
                            {jobs.length} job{jobs.length === 1 ? '' : 's'} parked at {section.name}
                        </p>
                    </div>
                    <div className="card-body p-0">
                        {jobs.length === 0 ? (
                            <div className="empty-state">
                                <div className="empty-state-icon"><i className="fi fi-rr-check-circle" /></div>
                                <div className="empty-state-title">All clear</div>
                                <div className="empty-state-text">No jobs currently in this section's queue.</div>
                            </div>
                        ) : (
                            <div className="divide-y divide-surface-100">
                                {jobs.map((job) => (
                                    <JobCard key={job.id} job={job} />
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </AppLayout>
    );
}

function JobCard({ job }: { job: QueueJob }) {
    const isAwaiting = job.status === 'awaiting_rework';
    return (
        <div className={`px-5 py-4 ${job.status === 'rework' ? 'bg-rose-50/40' : ''}`}>
            <div className="flex items-start gap-4">
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-white font-bold text-lg shrink-0 ${
                    job.status === 'rework' ? 'bg-rose-500' : 'bg-gradient-to-br from-brand-400 to-brand-600'
                }`}>
                    {job.work_order.job_number ?? '#'}
                </div>

                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono text-xs font-semibold text-surface-700">{job.work_order.wo_number}</span>
                        <JobTypeBadge type={job.work_order.job_type} size="xs" />
                        <span className={`badge ${STATUS_BADGE[job.status] ?? 'badge-slate'}`}>
                            {STATUS_LABEL[job.status] ?? job.status}
                        </span>
                        <span className={`badge ${PRIORITY_BADGE[job.work_order.priority] ?? 'badge-slate'} capitalize`}>
                            {job.work_order.priority}
                        </span>
                        <span className="text-[11px] text-surface-400">Step {job.sequence} of routing</span>
                    </div>

                    <h3 className="text-sm font-semibold text-surface-900 mt-1">{job.work_order.customer}</h3>
                    {job.work_order.product && (
                        <p className="text-xs text-surface-500 mt-0.5">{job.work_order.product}</p>
                    )}

                    <div className="flex items-center gap-3 mt-2 text-xs text-surface-500">
                        <span><i className="fi fi-rr-cube text-[10px]" /> qty {job.work_order.quantity}</span>
                        {job.work_order.due_date && <span><i className="fi fi-rr-calendar text-[10px]" /> Due {job.work_order.due_date}</span>}
                        {job.started_at && <span className="text-surface-400">· started {job.started_at}</span>}
                    </div>

                    {job.rework && (
                        <div className="mt-3 px-3 py-2.5 rounded-xl bg-rose-100/70 border border-rose-200">
                            <div className="flex items-center gap-2 text-xs">
                                <i className="fi fi-rr-undo-alt text-rose-700 text-[11px]" />
                                <span className="font-bold text-rose-900">Rework requested by {job.rework.from_section}</span>
                                <span className="text-rose-600">· {job.rework.transferred_at}</span>
                            </div>
                            <div className="text-xs text-rose-900/80 mt-1 line-clamp-2">
                                {job.rework.note}
                            </div>
                            <div className="text-[10px] text-rose-700 mt-1">Flagged by {job.rework.transferred_by}</div>
                        </div>
                    )}

                    {isAwaiting && (
                        <div className="mt-3 px-3 py-2 rounded-xl bg-slate-100 border border-slate-200 text-xs text-slate-700">
                            <i className="fi fi-rr-time-twenty-four text-[11px]" /> Waiting for an earlier section to finish their rework before this section resumes.
                        </div>
                    )}
                </div>

                <div className="shrink-0">
                    <Link href={`/production/wos/${job.id}`} className="btn-outline btn-sm">
                        <i className="fi fi-rr-arrow-right text-xs leading-none" />
                        Open
                    </Link>
                </div>
            </div>
        </div>
    );
}
