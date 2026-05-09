import AppLayout from '@/Layouts/AppLayout';
import { Link, useForm } from '@inertiajs/react';

const resultBadge: Record<string, string> = {
    pass: 'badge-green',
    fail: 'badge-red',
    partial: 'badge-amber',
    conditional: 'badge-amber',
};

export default function QCResult({ inspection }: any) {
    const ncrForm = useForm({ qc_inspection_id: inspection.id });

    const totalQty = (inspection.qty_passed ?? 0) + (inspection.qty_failed ?? 0);
    const passRate = totalQty > 0 ? Math.round((inspection.qty_passed / totalQty) * 100) : 0;

    return (
        <AppLayout header={`QC Result — ${inspection.wo_number}`}>
            <div className="space-y-6 animate-fade-in">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Main content */}
                    <div className="lg:col-span-2 space-y-6">
                        {/* Summary card */}
                        <div className="card">
                            <div className="card-header flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                                <div>
                                    <h2 className="text-base font-bold text-surface-900 font-mono">{inspection.wo_number}</h2>
                                    <p className="text-xs text-surface-500 mt-1">
                                        {inspection.product}
                                        <span className="mx-1 text-surface-300">|</span>
                                        {inspection.inspection_type?.replace(/_/g, ' ')} inspection
                                    </p>
                                    <p className="text-[11px] text-surface-400 mt-1">
                                        <i className="fi fi-rr-user text-[10px] leading-none mr-1" />
                                        {inspection.inspector}
                                        <span className="mx-1 text-surface-300">|</span>
                                        <i className="fi fi-rr-calendar text-[10px] leading-none mr-1" />
                                        {inspection.inspected_at}
                                    </p>
                                </div>
                                <span className={`badge ${resultBadge[inspection.result] ?? 'badge-slate'}`}>
                                    {inspection.result?.toUpperCase()}
                                </span>
                            </div>
                            <div className="card-body">
                                <div className="grid grid-cols-3 gap-4">
                                    <div className="stat-card">
                                        <div className="text-2xl font-bold text-emerald-600">{inspection.qty_passed}</div>
                                        <div className="text-xs text-surface-500 mt-1">Passed</div>
                                    </div>
                                    <div className="stat-card">
                                        <div className="text-2xl font-bold text-rose-600">{inspection.qty_failed ?? 0}</div>
                                        <div className="text-xs text-surface-500 mt-1">Failed</div>
                                    </div>
                                    <div className="stat-card">
                                        <div className="text-2xl font-bold text-surface-800">{passRate}%</div>
                                        <div className="text-xs text-surface-500 mt-1">Pass Rate</div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Checklist */}
                        {inspection.checklist_items?.length > 0 && (
                            <div className="card">
                                <div className="card-header">
                                    <h3 className="text-base font-bold text-surface-900">Checklist Results</h3>
                                    <p className="text-xs text-surface-400 mt-0.5">Result of each inspection check point</p>
                                </div>
                                <div className="card-body">
                                    <div className="divide-y divide-surface-100">
                                        {inspection.checklist_items.map((item: any) => (
                                            <div key={item.id} className="flex items-center justify-between py-3 gap-3">
                                                <div className="flex-1 min-w-0">
                                                    <div className="text-sm font-medium text-surface-800">{item.check_point}</div>
                                                    {item.remarks && (
                                                        <div className="text-xs text-surface-400 mt-0.5">{item.remarks}</div>
                                                    )}
                                                </div>
                                                <span className={`badge ${resultBadge[item.result] ?? 'badge-slate'}`}>
                                                    {item.result}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Notes */}
                        {inspection.notes && (
                            <div className="card">
                                <div className="card-header">
                                    <h3 className="text-base font-bold text-surface-900">Notes</h3>
                                </div>
                                <div className="card-body">
                                    <p className="text-sm text-surface-700 whitespace-pre-line">{inspection.notes}</p>
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
                                {inspection.result === 'fail' && !inspection.has_ncr && (
                                    <button
                                        onClick={() => ncrForm.post('/ncr')}
                                        disabled={ncrForm.processing}
                                        className="btn-danger btn-sm w-full justify-center"
                                    >
                                        <i className="fi fi-rr-triangle-warning text-xs leading-none" />
                                        {ncrForm.processing ? 'Raising...' : 'Raise NCR'}
                                    </button>
                                )}
                                <Link
                                    href={`/work-orders/${inspection.work_order_id}`}
                                    className="btn-outline btn-sm w-full justify-center"
                                >
                                    <i className="fi fi-rr-briefcase text-xs leading-none" />
                                    View Work Order
                                </Link>
                                <Link href="/qc" className="btn-ghost btn-sm w-full justify-center">
                                    <i className="fi fi-rr-arrow-left text-xs leading-none" />
                                    Back to List
                                </Link>
                            </div>
                        </div>

                        {inspection.has_ncr && (
                            <div className="alert alert-warning">
                                <i className="fi fi-rr-triangle-warning text-sm leading-none" />
                                <div>
                                    <div className="font-semibold text-sm">NCR already raised</div>
                                    <div className="text-xs mt-0.5">A non-conformance report has been raised for this inspection.</div>
                                </div>
                            </div>
                        )}
                    </aside>
                </div>
            </div>
        </AppLayout>
    );
}
