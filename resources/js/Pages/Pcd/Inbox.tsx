import AppLayout from '@/Layouts/AppLayout';
import { Link } from '@inertiajs/react';

const STATUS_BADGE: Record<string, string> = {
    pcd_pending:       'badge-amber',
    released_to_shops: 'badge-green',
};

const PRIORITY_BADGE: Record<string, string> = {
    low:    'badge-slate',
    normal: 'badge-blue',
    high:   'badge-amber',
    urgent: 'badge-red',
};

export default function PcdInbox({ jobs, stats }: any) {
    return (
        <AppLayout header="PCD Inbox">
            <div className="space-y-6 animate-fade-in">

                {/* Stats */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <StatTile label="Total Jobs" value={stats.total} icon="fi-rr-clipboard-list" color="blue" />
                    <StatTile label="Pending PCD" value={stats.pending} icon="fi-rr-time-check" color="amber" />
                    <StatTile label="Released to Shops" value={stats.released} icon="fi-rr-check-circle" color="green" />
                    <StatTile label="MR Pending" value={stats.mr_pending} icon="fi-rr-document" color="red" />
                </div>

                {/* Jobs */}
                <div className="card">
                    <div className="card-header flex items-center justify-between">
                        <div>
                            <h2 className="text-base font-bold text-surface-900">PCD Job Queue</h2>
                            <p className="text-xs text-surface-400 mt-0.5">Jobs handed off from IED awaiting PCD processing</p>
                        </div>
                    </div>

                    <div className="card-body p-0">
                        {jobs.length === 0 ? (
                            <div className="empty-state">
                                <div className="empty-state-icon"><i className="fi fi-rr-inbox" /></div>
                                <div className="empty-state-title">No jobs in PCD inbox</div>
                                <div className="empty-state-text">Jobs will appear here once IED issues a Work Order from an accepted quotation.</div>
                            </div>
                        ) : (
                            <div className="divide-y divide-surface-100">
                                {jobs.map((job: any) => (
                                    <Link key={job.id} href={`/pcd/inbox/${job.id}`}
                                        className="block px-5 py-4 hover:bg-brand-50/30 transition-colors">
                                        <div className="flex items-start gap-4">
                                            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-brand-400 to-brand-600 flex items-center justify-center text-white font-bold text-lg shrink-0">
                                                {job.job_number ?? '#'}
                                            </div>

                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    <span className="font-mono text-xs font-semibold text-surface-700">{job.wo_number}</span>
                                                    <span className={`badge ${STATUS_BADGE[job.status] ?? 'badge-slate'}`}>{job.status?.replace(/_/g, ' ')}</span>
                                                    <span className={`badge ${PRIORITY_BADGE[job.priority] ?? 'badge-slate'} capitalize`}>{job.priority}</span>
                                                </div>
                                                <h3 className="text-sm font-semibold text-surface-900 mt-1">{job.customer}</h3>
                                                {job.customer_po_no && (
                                                    <p className="text-xs text-surface-400 mt-0.5">PO: <span className="font-mono">{job.customer_po_no}</span></p>
                                                )}
                                                <div className="flex items-center gap-3 mt-2 text-xs text-surface-500">
                                                    <span><i className="fi fi-rr-boxes text-[10px]" /> {job.item_count} items</span>
                                                    <span><i className="fi fi-rr-cube text-[10px]" /> qty {job.quantity}</span>
                                                    {job.due_date && <span><i className="fi fi-rr-calendar text-[10px]" /> {job.due_date}</span>}
                                                    <span className="text-surface-400">· handed off {job.pcd_handoff_at}</span>
                                                </div>
                                            </div>

                                            {/* Checklist progress */}
                                            <div className="hidden lg:flex items-center gap-2 shrink-0">
                                                <ChecklistDot done={job.checklist.material_requisition.done} label="MR" icon="fi-rr-clipboard-list" />
                                                <ChecklistDot done={job.checklist.section_assign.done} label="Sections" icon="fi-rr-sitemap" sub={job.checklist.section_assign.count > 0 ? job.checklist.section_assign.count : undefined} />
                                                <ChecklistDot done={job.checklist.operation_sheet.done} label="Op Sheet" icon="fi-rr-document" />
                                            </div>
                                        </div>

                                        {/* Mobile checklist */}
                                        <div className="lg:hidden flex items-center gap-2 mt-3 pt-3 border-t border-surface-50">
                                            <ChecklistDot done={job.checklist.material_requisition.done} label="MR" icon="fi-rr-clipboard-list" />
                                            <ChecklistDot done={job.checklist.section_assign.done} label="Sec" icon="fi-rr-sitemap" />
                                            <ChecklistDot done={job.checklist.operation_sheet.done} label="OS" icon="fi-rr-document" />
                                        </div>
                                    </Link>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </AppLayout>
    );
}

function StatTile({ label, value, icon, color }: any) {
    const colors: Record<string, string> = {
        blue:  'bg-blue-50 text-blue-600',
        amber: 'bg-amber-50 text-amber-600',
        green: 'bg-emerald-50 text-emerald-600',
        red:   'bg-red-50 text-red-600',
    };
    return (
        <div className="card p-4 flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${colors[color]}`}>
                <i className={`fi ${icon} text-base leading-none`} />
            </div>
            <div>
                <div className="text-2xl font-bold text-surface-900 leading-none">{value}</div>
                <div className="text-[10px] font-semibold text-surface-400 uppercase tracking-wider mt-1">{label}</div>
            </div>
        </div>
    );
}

function ChecklistDot({ done, label, icon, sub }: { done: boolean; label: string; icon: string; sub?: number }) {
    return (
        <div className={`flex flex-col items-center gap-1 px-2.5 py-1.5 rounded-xl border ${done ? 'border-emerald-200 bg-emerald-50' : 'border-surface-200 bg-surface-50'}`}>
            <div className="relative">
                <i className={`fi ${icon} text-sm leading-none ${done ? 'text-emerald-600' : 'text-surface-400'}`} />
                {done && (
                    <div className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-emerald-500 flex items-center justify-center">
                        <i className="fi fi-rr-check text-white text-[6px] leading-none" />
                    </div>
                )}
            </div>
            <span className={`text-[9px] font-semibold ${done ? 'text-emerald-700' : 'text-surface-500'}`}>
                {label}{sub != null && ` ${sub}`}
            </span>
        </div>
    );
}
