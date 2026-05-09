import AppLayout from '@/Layouts/AppLayout';
import { Link, useForm } from '@inertiajs/react';

const severityBadge: Record<string, string> = {
    low: 'badge-slate',
    minor: 'badge-slate',
    medium: 'badge-amber',
    major: 'badge-amber',
    high: 'badge-red',
    critical: 'badge-red',
};

const statusBadge: Record<string, string> = {
    open: 'badge-amber',
    in_progress: 'badge-blue',
    'in-progress': 'badge-blue',
    closed: 'badge-green',
    resolved: 'badge-green',
};

const reworkStatusBadge: Record<string, string> = {
    pending: 'badge-amber',
    in_progress: 'badge-blue',
    completed: 'badge-green',
};

const formatValue = (v?: string) => (v ? v.replace(/_/g, ' ') : '--');

export default function NCRShow({ ncr, canCreateRework }: any) {
    const reworkForm = useForm({ ncr_id: ncr.id });

    return (
        <AppLayout header={`NCR — ${ncr.ncr_number}`}>
            <div className="space-y-6 animate-fade-in">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Main content */}
                    <div className="lg:col-span-2 space-y-6">
                        {/* Header card */}
                        <div className="card">
                            <div className="card-header flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                                <div>
                                    <h2 className="text-base font-bold text-rose-600 font-mono">{ncr.ncr_number}</h2>
                                    <p className="text-xs text-surface-500 mt-1">
                                        <span className="font-mono">{ncr.wo_number}</span>
                                        <span className="mx-1 text-surface-300">|</span>
                                        Raised: {ncr.created_at}
                                    </p>
                                </div>
                                <div className="flex flex-wrap gap-2">
                                    <span className={`badge ${severityBadge[ncr.severity] ?? 'badge-slate'}`}>
                                        {ncr.severity}
                                    </span>
                                    <span className={`badge ${statusBadge[ncr.status] ?? 'badge-slate'}`}>
                                        {formatValue(ncr.status)}
                                    </span>
                                </div>
                            </div>
                            <div className="card-body">
                                <dl className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
                                    <div className="md:col-span-2">
                                        <dt className="text-[11px] font-semibold text-surface-400 uppercase tracking-wide">
                                            Defect Description
                                        </dt>
                                        <dd className="text-sm text-surface-800 mt-1 whitespace-pre-line">
                                            {ncr.defect_description}
                                        </dd>
                                    </div>
                                    <div>
                                        <dt className="text-[11px] font-semibold text-surface-400 uppercase tracking-wide">
                                            Disposition
                                        </dt>
                                        <dd className="text-sm text-surface-800 mt-1 capitalize">
                                            {formatValue(ncr.disposition)}
                                        </dd>
                                    </div>
                                    <div>
                                        <dt className="text-[11px] font-semibold text-surface-400 uppercase tracking-wide">
                                            Raised By
                                        </dt>
                                        <dd className="text-sm text-surface-800 mt-1">{ncr.raised_by_name}</dd>
                                    </div>
                                    {ncr.root_cause && (
                                        <div className="md:col-span-2">
                                            <dt className="text-[11px] font-semibold text-surface-400 uppercase tracking-wide">
                                                Root Cause Analysis
                                            </dt>
                                            <dd className="text-sm text-surface-800 mt-1 whitespace-pre-line">
                                                {ncr.root_cause}
                                            </dd>
                                        </div>
                                    )}
                                    {ncr.corrective_action && (
                                        <div className="md:col-span-2">
                                            <dt className="text-[11px] font-semibold text-surface-400 uppercase tracking-wide">
                                                Corrective Action
                                            </dt>
                                            <dd className="text-sm text-surface-800 mt-1 whitespace-pre-line">
                                                {ncr.corrective_action}
                                            </dd>
                                        </div>
                                    )}
                                </dl>
                            </div>
                        </div>

                        {/* Linked rework */}
                        {ncr.rework_order && (
                            <div className="card">
                                <div className="card-header">
                                    <h3 className="text-base font-bold text-surface-900">Linked Rework Order</h3>
                                    <p className="text-xs text-surface-400 mt-0.5">Rework created to resolve this NCR</p>
                                </div>
                                <div className="card-body">
                                    <div className="flex items-center justify-between gap-3">
                                        <span className="font-mono font-semibold text-brand-600 text-sm">
                                            {ncr.rework_order.rework_number}
                                        </span>
                                        <span className={`badge ${reworkStatusBadge[ncr.rework_order.status] ?? 'badge-slate'}`}>
                                            {formatValue(ncr.rework_order.status)}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Sidebar */}
                    <aside className="space-y-6">
                        <div className="card">
                            <div className="card-header">
                                <h3 className="text-base font-bold text-surface-900">Actions</h3>
                            </div>
                            <div className="card-body space-y-2">
                                {canCreateRework && ncr.status === 'open' && !ncr.rework_order && (
                                    <button
                                        onClick={() => reworkForm.post(`/ncr/${ncr.id}/rework`)}
                                        disabled={reworkForm.processing}
                                        className="btn-primary btn-sm w-full justify-center"
                                    >
                                        <i className="fi fi-rr-refresh text-xs leading-none" />
                                        {reworkForm.processing ? 'Creating...' : 'Create Rework Order'}
                                    </button>
                                )}
                                <Link
                                    href={`/work-orders/${ncr.work_order_id}`}
                                    className="btn-outline btn-sm w-full justify-center"
                                >
                                    <i className="fi fi-rr-briefcase text-xs leading-none" />
                                    View Work Order
                                </Link>
                                <Link href="/ncr" className="btn-ghost btn-sm w-full justify-center">
                                    <i className="fi fi-rr-arrow-left text-xs leading-none" />
                                    Back to List
                                </Link>
                            </div>
                        </div>

                        <div className="card">
                            <div className="card-header">
                                <h3 className="text-base font-bold text-surface-900">Summary</h3>
                            </div>
                            <div className="card-body space-y-3">
                                <div>
                                    <div className="text-[11px] font-semibold text-surface-400 uppercase tracking-wide">
                                        Severity
                                    </div>
                                    <div className="mt-1">
                                        <span className={`badge ${severityBadge[ncr.severity] ?? 'badge-slate'}`}>
                                            {ncr.severity}
                                        </span>
                                    </div>
                                </div>
                                <div>
                                    <div className="text-[11px] font-semibold text-surface-400 uppercase tracking-wide">
                                        Status
                                    </div>
                                    <div className="mt-1">
                                        <span className={`badge ${statusBadge[ncr.status] ?? 'badge-slate'}`}>
                                            {formatValue(ncr.status)}
                                        </span>
                                    </div>
                                </div>
                                <div>
                                    <div className="text-[11px] font-semibold text-surface-400 uppercase tracking-wide">
                                        Disposition
                                    </div>
                                    <div className="text-sm text-surface-800 mt-1 capitalize">
                                        {formatValue(ncr.disposition)}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </aside>
                </div>
            </div>
        </AppLayout>
    );
}
