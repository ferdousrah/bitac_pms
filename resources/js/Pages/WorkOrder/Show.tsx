import AppLayout from '@/Layouts/AppLayout';
import { Link, router } from '@inertiajs/react';
import ProgressGantt from '@/Components/WorkOrder/ProgressGantt';

const statusBadge: Record<string, string> = {
    draft: 'badge-slate',
    approved: 'badge-blue',
    in_production: 'badge-amber',
    qc_hold: 'badge-amber',
    qc_passed: 'badge-green',
    ready_for_delivery: 'badge-blue',
    delivered: 'badge-green',
    cancelled: 'badge-red',
};

const priorityBadge: Record<string, string> = {
    low: 'badge-slate',
    normal: 'badge-blue',
    high: 'badge-amber',
    urgent: 'badge-red',
};

const stepStatusBadge: Record<string, string> = {
    pending: 'badge-slate',
    in_progress: 'badge-amber',
    completed: 'badge-green',
};

export default function WorkOrderShow({ workOrder, canApprove, canTransitionTo }: any) {
    const transition = (status: string) => {
        if (confirm(`Transition to "${status.replace(/_/g, ' ')}"?`)) {
            router.post(`/work-orders/${workOrder.id}/transition`, { status });
        }
    };

    return (
        <AppLayout header={`Job — ${workOrder.wo_number}`}>
            <div className="space-y-6 max-w-6xl animate-fade-in">

                {/* Header Card */}
                <div className="card animate-slide-up">
                    <div className="card-header flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
                        <div className="flex items-start gap-3">
                            <div className="w-12 h-12 rounded-xl bg-brand-50 flex items-center justify-center flex-shrink-0">
                                <i className="fi fi-rr-box text-brand-500 text-lg leading-none" />
                            </div>
                            <div>
                                <div className="flex flex-wrap items-center gap-2">
                                    <h2 className="text-lg font-bold font-mono text-surface-900">{workOrder.wo_number}</h2>
                                    <span className={`badge ${statusBadge[workOrder.status] ?? 'badge-slate'}`}>
                                        {workOrder.status_label}
                                    </span>
                                    <span className={`badge ${priorityBadge[workOrder.priority] ?? 'badge-slate'}`}>
                                        {workOrder.priority}
                                    </span>
                                    {workOrder.is_overdue && (
                                        <span className="badge badge-red">
                                            <i className="fi fi-rr-clock text-xs leading-none" /> Overdue
                                        </span>
                                    )}
                                </div>
                                <p className="text-sm text-surface-600 mt-1">{workOrder.product}</p>
                                <p className="text-xs text-surface-400 mt-0.5">{workOrder.customer}</p>
                            </div>
                        </div>
                        <div className="grid grid-cols-3 gap-4 text-right lg:text-right">
                            <div>
                                <div className="text-xs font-semibold text-surface-400 uppercase">Qty</div>
                                <div className="text-sm font-bold text-surface-900 mt-0.5">{workOrder.quantity}</div>
                            </div>
                            <div>
                                <div className="text-xs font-semibold text-surface-400 uppercase">Due</div>
                                <div className={`text-sm font-bold mt-0.5 ${workOrder.is_overdue ? 'text-red-600' : 'text-surface-900'}`}>
                                    {workOrder.due_date ?? '—'}
                                </div>
                            </div>
                            <div>
                                <div className="text-xs font-semibold text-surface-400 uppercase">Created</div>
                                <div className="text-sm font-medium text-surface-700 mt-0.5">{workOrder.created_at}</div>
                            </div>
                        </div>
                    </div>

                    {/* Transition Buttons */}
                    {(canApprove || (canTransitionTo && canTransitionTo.length > 0) || (workOrder.status === 'approved' && !workOrder.operation_sheet)) && (
                        <div className="card-body border-t border-surface-100 flex gap-2 flex-wrap">
                            {canApprove && workOrder.status === 'draft' && (
                                <button
                                    onClick={() => router.post(`/work-orders/${workOrder.id}/approve`)}
                                    className="btn-primary btn-sm"
                                >
                                    <i className="fi fi-rr-check text-xs leading-none" /> Approve WO
                                </button>
                            )}
                            {canTransitionTo?.map((s: string) => (
                                <button key={s} onClick={() => transition(s)} className="btn-outline btn-sm">
                                    <i className="fi fi-rr-arrow-right text-xs leading-none" />
                                    {s.replace(/_/g, ' ')}
                                </button>
                            ))}
                            {workOrder.status === 'approved' && !workOrder.operation_sheet && (
                                <Link href={`/operation-sheets/create?work_order_id=${workOrder.id}`} className="btn-success btn-sm">
                                    <i className="fi fi-rr-plus text-xs leading-none" /> Create Operation Sheet
                                </Link>
                            )}
                        </div>
                    )}
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Main column */}
                    <div className="lg:col-span-2 space-y-6">

                        {/* Job Progress — always shown, even before operation sheet exists */}
                        {(() => {
                            // Map WorkOrder status → user-friendly stage label and color.
                            // Lets the user see where the job is in the BITAC flow at a glance.
                            // Static class strings so Tailwind's JIT picks them up at build.
                            const STAGE: Record<string, { label: string; subtitle: string; iconBg: string; icon: string }> = {
                                draft:              { label: 'Draft',                subtitle: 'Awaiting approval to begin',     iconBg: 'bg-slate-50 text-slate-600',     icon: 'fi-rr-pencil' },
                                approved:           { label: 'Approved',             subtitle: 'Operation sheet pending',        iconBg: 'bg-blue-50 text-blue-600',       icon: 'fi-rr-check' },
                                pcd_pending:        { label: 'Awaiting PCD Setup',   subtitle: 'PCD completing 3-step workflow', iconBg: 'bg-amber-50 text-amber-600',     icon: 'fi-rr-clipboard-list-check' },
                                released_to_shops:  { label: 'Released to Shops',    subtitle: 'Production shops can pick up',   iconBg: 'bg-indigo-50 text-indigo-600',   icon: 'fi-rr-tools' },
                                in_production:      { label: 'In Production',        subtitle: 'Active on the shop floor',       iconBg: 'bg-amber-50 text-amber-600',     icon: 'fi-rr-settings' },
                                qc_hold:            { label: 'On QC Hold',           subtitle: 'Awaiting quality inspection',    iconBg: 'bg-orange-50 text-orange-600',   icon: 'fi-rr-shield-check' },
                                qc_passed:          { label: 'QC Passed',            subtitle: 'Quality cleared',                iconBg: 'bg-emerald-50 text-emerald-600', icon: 'fi-rr-shield-check' },
                                ready_for_delivery: { label: 'Ready for Delivery',   subtitle: 'Packed, awaiting dispatch',      iconBg: 'bg-emerald-50 text-emerald-600', icon: 'fi-rr-truck-side' },
                                delivered:          { label: 'Delivered',            subtitle: 'Handed over to customer',        iconBg: 'bg-green-50 text-green-600',     icon: 'fi-rr-check-double' },
                                cancelled:          { label: 'Cancelled',            subtitle: 'Job cancelled',                  iconBg: 'bg-red-50 text-red-600',         icon: 'fi-rr-cross-circle' },
                            };
                            const stage = STAGE[workOrder.status] ?? { label: workOrder.status_label || workOrder.status, subtitle: '', iconBg: 'bg-slate-50 text-slate-600', icon: 'fi-rr-circle' };
                            const pct = workOrder.progress?.pct ?? 0;
                            const current = workOrder.progress?.current_step;

                            const barColor =
                                pct >= 100 ? 'bg-emerald-500' :
                                pct >= 50  ? 'bg-brand-500'   :
                                pct > 0    ? 'bg-amber-500'   :
                                             'bg-surface-300';

                            return (
                                <div className="card animate-slide-up">
                                    <div className="card-body">
                                        <div className="flex items-start justify-between gap-4 flex-wrap">
                                            <div className="flex items-start gap-3">
                                                <div className={`w-11 h-11 rounded-xl ${stage.iconBg} flex items-center justify-center shrink-0`}>
                                                    <i className={`fi ${stage.icon} text-base leading-none`} />
                                                </div>
                                                <div>
                                                    <div className="text-[10px] uppercase tracking-wider font-bold text-surface-400">Current Stage</div>
                                                    <div className="text-base font-bold text-surface-900 mt-0.5">{stage.label}</div>
                                                    <div className="text-xs text-surface-500 mt-0.5">{stage.subtitle}</div>
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <div className="text-[10px] uppercase tracking-wider font-bold text-surface-400">Progress</div>
                                                <div className="text-2xl font-bold text-surface-900 font-mono tabular-nums mt-0.5">{pct}<span className="text-base text-surface-400">%</span></div>
                                                {workOrder.progress && (
                                                    <div className="text-[10px] text-surface-500 mt-0.5">
                                                        {workOrder.progress.completed} / {workOrder.progress.total} steps done
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        {/* Progress bar */}
                                        <div className="mt-4">
                                            <div className="h-2.5 bg-surface-100 rounded-full overflow-hidden">
                                                <div
                                                    className={`h-full ${barColor} transition-all duration-500`}
                                                    style={{ width: `${Math.max(2, pct)}%` }}
                                                />
                                            </div>
                                        </div>

                                        {/* Current step strip — appears once an op sheet exists */}
                                        {current && (
                                            <div className="mt-4 p-3 rounded-xl bg-brand-50/60 border border-brand-100 flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-lg bg-white border border-brand-200 flex items-center justify-center text-brand-600 font-bold text-sm">
                                                    {current.sequence}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <div className="text-[10px] uppercase tracking-wider font-bold text-brand-600">Current Step</div>
                                                    <div className="text-sm font-semibold text-surface-900 truncate">{current.operation_name}</div>
                                                    <div className="text-[11px] text-surface-500 mt-0.5">
                                                        {current.section && <>at <span className="font-medium text-surface-700">{current.section}</span> · </>}
                                                        <span className="capitalize">{current.status.replace(/_/g, ' ')}</span>
                                                        {current.weight_pct > 0 && <> · weight {current.weight_pct.toFixed(1)}%</>}
                                                    </div>
                                                </div>
                                            </div>
                                        )}

                                        {/* Pipeline stats */}
                                        {workOrder.progress && workOrder.progress.total > 0 && (
                                            <div className="mt-4 grid grid-cols-3 gap-3 text-center">
                                                <div className="p-2 rounded-lg bg-emerald-50/50">
                                                    <div className="text-lg font-bold text-emerald-700">{workOrder.progress.completed}</div>
                                                    <div className="text-[10px] uppercase tracking-wider text-emerald-600 font-semibold">Done</div>
                                                </div>
                                                <div className="p-2 rounded-lg bg-amber-50/50">
                                                    <div className="text-lg font-bold text-amber-700">{workOrder.progress.in_progress}</div>
                                                    <div className="text-[10px] uppercase tracking-wider text-amber-600 font-semibold">In Progress</div>
                                                </div>
                                                <div className="p-2 rounded-lg bg-surface-50">
                                                    <div className="text-lg font-bold text-surface-700">{workOrder.progress.pending}</div>
                                                    <div className="text-[10px] uppercase tracking-wider text-surface-500 font-semibold">Pending</div>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            );
                        })()}

                        {/* Quotation */}
                        {workOrder.quotation && (
                            <div className="card animate-slide-up">
                                <div className="card-header">
                                    <h3 className="text-sm font-bold text-surface-900">Linked Quotation</h3>
                                </div>
                                <div className="card-body">
                                    <div className="flex items-center justify-between flex-wrap gap-3">
                                        <div className="flex items-center gap-3 flex-wrap">
                                            <span className="font-mono text-sm font-semibold text-surface-700">v{workOrder.quotation.version}</span>
                                            <span className="font-bold text-surface-900">BDT {Number(workOrder.quotation.total_amount).toLocaleString('en-IN')}</span>
                                            <span className="text-xs text-surface-400">incl. {workOrder.quotation.vat_rate}% VAT</span>
                                        </div>
                                        <Link href={`/quotations/${workOrder.quotation.id}`} className="btn-ghost btn-xs">
                                            <i className="fi fi-rr-eye text-xs leading-none" /> View Quotation
                                        </Link>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Operation Sheet — Progress + Gantt Timeline */}
                        {workOrder.operation_sheet && (
                            <div className="space-y-4 animate-slide-up">
                                {/* Header card */}
                                <div className="card">
                                    <div className="card-header flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-brand-400 to-brand-600 text-white flex items-center justify-center shadow-md">
                                                <i className="fi fi-rr-document leading-none" />
                                            </div>
                                            <div>
                                                <h3 className="text-sm font-bold text-surface-900">Operation Sheet & Progress</h3>
                                                <p className="text-xs text-surface-400 mt-0.5">
                                                    {workOrder.operation_sheet.steps?.length ?? 0} steps · Visual timeline
                                                </p>
                                            </div>
                                        </div>
                                        <div className="flex gap-2">
                                            <Link href={`/operation-sheets/${workOrder.operation_sheet.id}`}
                                                title="View full operation sheet"
                                                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-surface-600 hover:bg-surface-100 transition-colors">
                                                <i className="fi fi-rr-eye text-sm leading-none" /> View Sheet
                                            </Link>
                                        </div>
                                    </div>
                                </div>

                                {/* Progress + Gantt */}
                                {workOrder.progress && workOrder.operation_sheet.steps?.length > 0 && (
                                    <ProgressGantt
                                        steps={workOrder.operation_sheet.steps}
                                        progress={workOrder.progress}
                                    />
                                )}
                            </div>
                        )}

                        {/* MRP Result */}
                        {workOrder.mrp_result && (
                            <div className="card animate-slide-up">
                                <div className="card-header flex items-center justify-between">
                                    <h3 className="text-sm font-bold text-surface-900">Material Requirements</h3>
                                    <Link href={`/mrp/${workOrder.id}`} className="btn-ghost btn-xs">
                                        <i className="fi fi-rr-arrow-right text-xs leading-none" /> Details
                                    </Link>
                                </div>
                                <div className="card-body space-y-1">
                                    {workOrder.mrp_result.map((item: any) => (
                                        <div key={item.id} className="flex items-center justify-between text-sm py-1.5 border-b border-surface-50 last:border-0">
                                            <span className="text-surface-700">{item.material_name}</span>
                                            <span className={`font-mono font-semibold inline-flex items-center gap-1 ${item.available ? 'text-green-600' : 'text-red-600'}`}>
                                                {item.required_qty} {item.unit}
                                                {!item.available && <i className="fi fi-rr-exclamation text-xs leading-none" />}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* QC Inspections */}
                        {workOrder.qc_inspections?.length > 0 && (
                            <div className="card animate-slide-up">
                                <div className="card-header">
                                    <h3 className="text-sm font-bold text-surface-900">QC Inspections</h3>
                                </div>
                                <div className="card-body">
                                    {workOrder.qc_inspections.map((qc: any) => (
                                        <div key={qc.id} className="flex items-center justify-between py-2 border-b border-surface-50 last:border-0">
                                            <div>
                                                <div className="text-sm font-medium text-surface-900">{qc.inspection_type}</div>
                                                <div className="text-xs text-surface-400">{qc.inspected_at}</div>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <span className={`badge ${qc.result === 'pass' ? 'badge-green' : 'badge-red'}`}>
                                                    {qc.result}
                                                </span>
                                                <Link href={`/qc/${qc.id}`} className="btn-ghost btn-xs">
                                                    <i className="fi fi-rr-eye text-xs leading-none" /> View
                                                </Link>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* NCRs */}
                        {workOrder.ncrs?.length > 0 && (
                            <div className="card animate-slide-up">
                                <div className="card-header">
                                    <h3 className="text-sm font-bold text-surface-900">Non-Conformance Reports</h3>
                                </div>
                                <div className="card-body">
                                    {workOrder.ncrs.map((ncr: any) => (
                                        <div key={ncr.id} className="flex items-center justify-between py-2 border-b border-surface-50 last:border-0 gap-3">
                                            <div className="min-w-0">
                                                <div className="font-mono text-sm font-semibold text-red-600">{ncr.ncr_number}</div>
                                                <div className="text-xs text-surface-500 truncate">{ncr.defect_description?.substring(0, 80)}</div>
                                            </div>
                                            <div className="flex items-center gap-2 flex-shrink-0">
                                                <span className={`badge ${ncr.status === 'open' ? 'badge-red' : 'badge-green'}`}>
                                                    {ncr.status}
                                                </span>
                                                <Link href={`/ncr/${ncr.id}`} className="btn-ghost btn-xs">
                                                    <i className="fi fi-rr-eye text-xs leading-none" /> View
                                                </Link>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Delivery */}
                        {workOrder.delivery_order && (
                            <div className="card animate-slide-up">
                                <div className="card-header flex items-center justify-between">
                                    <h3 className="text-sm font-bold text-surface-900">Delivery</h3>
                                    <Link href={`/delivery/${workOrder.delivery_order.id}`} className="btn-ghost btn-xs">
                                        <i className="fi fi-rr-eye text-xs leading-none" /> View
                                    </Link>
                                </div>
                                <div className="card-body">
                                    <div className="flex items-center flex-wrap gap-3 text-sm">
                                        <span className="font-mono font-semibold text-surface-700">{workOrder.delivery_order.challan_number}</span>
                                        <span className="badge badge-slate">{workOrder.delivery_order.status}</span>
                                        {workOrder.delivery_order.delivered_at && (
                                            <span className="text-green-600 text-xs font-semibold">
                                                <i className="fi fi-rr-check text-xs leading-none mr-1" />
                                                Delivered {workOrder.delivery_order.delivered_at}
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Invoice */}
                        {workOrder.invoice && (
                            <div className="card animate-slide-up">
                                <div className="card-header flex items-center justify-between">
                                    <h3 className="text-sm font-bold text-surface-900">Invoice</h3>
                                    <Link href={`/invoices/${workOrder.invoice.id}`} className="btn-ghost btn-xs">
                                        <i className="fi fi-rr-eye text-xs leading-none" /> View
                                    </Link>
                                </div>
                                <div className="card-body">
                                    <div className="flex items-center flex-wrap gap-3 text-sm">
                                        <span className="font-mono font-semibold text-surface-700">{workOrder.invoice.invoice_number}</span>
                                        <span className="font-bold text-surface-900">BDT {Number(workOrder.invoice.total_amount).toLocaleString('en-IN')}</span>
                                        <span className={`badge ${workOrder.invoice.status === 'paid' ? 'badge-green' : 'badge-amber'}`}>
                                            {workOrder.invoice.status}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Sidebar */}
                    <div className="space-y-4">
                        {/* Notes */}
                        {workOrder.notes && (
                            <div className="card animate-slide-up">
                                <div className="card-header">
                                    <h3 className="text-xs font-semibold text-surface-400 uppercase tracking-wider">Notes</h3>
                                </div>
                                <div className="card-body">
                                    <p className="text-sm text-surface-700 whitespace-pre-line">{workOrder.notes}</p>
                                </div>
                            </div>
                        )}

                        {/* Quick Actions */}
                        <div className="card animate-slide-up">
                            <div className="card-header">
                                <h3 className="text-xs font-semibold text-surface-400 uppercase tracking-wider">Actions</h3>
                            </div>
                            <div className="card-body space-y-2">
                                {workOrder.operation_sheet && (
                                    <Link href={`/mrp/${workOrder.id}`} className="btn-outline btn-sm w-full justify-center">
                                        <i className="fi fi-rr-calculator text-xs leading-none" /> Run MRP
                                    </Link>
                                )}
                                {workOrder.status === 'qc_passed' && !workOrder.delivery_order && (
                                    <Link href={`/delivery/create?work_order_id=${workOrder.id}`} className="btn-primary btn-sm w-full justify-center">
                                        <i className="fi fi-rr-truck-side text-xs leading-none" /> Create Delivery
                                    </Link>
                                )}
                                {workOrder.status === 'in_production' && (
                                    <Link href={`/qc/create?work_order_id=${workOrder.id}`} className="btn-success btn-sm w-full justify-center">
                                        <i className="fi fi-rr-shield-check text-xs leading-none" /> QC Inspection
                                    </Link>
                                )}
                                <Link href="/work-orders" className="btn-ghost btn-sm w-full justify-center">
                                    <i className="fi fi-rr-arrow-left text-xs leading-none" /> Back to List
                                </Link>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </AppLayout>
    );
}
