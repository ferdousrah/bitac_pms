import AppLayout from '@/Layouts/AppLayout';
import { Link, router } from '@inertiajs/react';
import ProgressGantt from '@/Components/WorkOrder/ProgressGantt';
import JobTypeBadge from '@/Components/JobTypeBadge';

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

export default function WorkOrderShow({ workOrder, canApprove, canTransitionTo, completion_certificate, bottlenecks = [] }: any) {
    const transition = (status: string) => {
        if (confirm(`Transition to "${status.replace(/_/g, ' ')}"?`)) {
            router.post(`/work-orders/${workOrder.id}/transition`, { status });
        }
    };

    return (
        <AppLayout header={`Job# ${workOrder.job_number ?? '—'}`}>
            <div className="space-y-6 max-w-6xl animate-fade-in">

                {/* Bottleneck alert — a section flagged this job; PCD can reroute */}
                {bottlenecks.length > 0 && (
                    <div className="card border-orange-300 bg-orange-50/60 animate-slide-up">
                        <div className="card-body flex items-start gap-3">
                            <i className="fi fi-rr-traffic-cone text-orange-500 text-lg leading-none mt-0.5" />
                            <div className="flex-1 min-w-0">
                                <div className="text-sm font-bold text-orange-900">
                                    Bottleneck flagged — this job is waiting on a busy section
                                </div>
                                {bottlenecks.map((b: any, i: number) => (
                                    <div key={i} className="text-sm text-orange-800 mt-1">
                                        <span className="font-semibold">{b.section}:</span> {b.reason}
                                        <span className="text-[11px] text-orange-600"> · {b.by} · {b.at}</span>
                                    </div>
                                ))}
                            </div>
                            <Link href={`/pcd/work-orders/${workOrder.id}/reroute`} className="btn-primary btn-sm shrink-0">
                                <i className="fi fi-rr-shuffle text-xs" /> Reroute
                            </Link>
                        </div>
                    </div>
                )}

                {/* Header Card */}
                <div className="card animate-slide-up">
                    <div className="card-header flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
                        <div className="flex items-start gap-3">
                            <div className="w-12 h-12 rounded-xl bg-brand-50 flex items-center justify-center flex-shrink-0">
                                <i className="fi fi-rr-box text-brand-500 text-lg leading-none" />
                            </div>
                            <div>
                                <div className="flex flex-wrap items-center gap-2">
                                    <h2 className="text-lg font-bold font-mono text-surface-900">Job# {workOrder.job_number ?? '—'}</h2>
                                    <JobTypeBadge type={workOrder.job_type} />
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
                    {(canApprove || (canTransitionTo && canTransitionTo.length > 0)) && (
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
                            // Pick the current step from the first item that has one in flight —
                            // gives the user a "where the job is right now" hint at the WO level.
                            const current = (workOrder.item_operation_sheets ?? [])
                                .map((row: any) => row.sheet?.progress?.current_step)
                                .filter(Boolean)[0] ?? null;

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

                        {/* QC Certificate — available once every item has a passing final
                            inspection (i.e. WO status reached qc_passed or beyond). */}
                        {['qc_passed', 'ready_for_delivery', 'delivered'].includes(workOrder.status) && (
                            <div className="card animate-slide-up border-emerald-200 bg-emerald-50/30">
                                <div className="card-header flex items-center justify-between gap-3">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                                            <i className="fi fi-rr-shield-check text-lg leading-none" />
                                        </div>
                                        <div>
                                            <h3 className="text-sm font-bold text-emerald-900">Job QC Certificate</h3>
                                            <p className="text-xs text-emerald-700/80 mt-0.5">
                                                Every item inspected and accepted. The combined certificate is ready for the customer.
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2 shrink-0">
                                        <a
                                            href={`/qc/work-orders/${workOrder.id}/certificate?preview=1`}
                                            target="_blank"
                                            rel="noreferrer"
                                            className="btn-outline btn-sm"
                                        >
                                            <i className="fi fi-rr-eye text-xs leading-none" /> Preview
                                        </a>
                                        <a
                                            href={`/qc/work-orders/${workOrder.id}/certificate`}
                                            className="btn-primary btn-sm"
                                        >
                                            <i className="fi fi-rr-file-download text-xs leading-none" /> Download PDF
                                        </a>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Per-item Operation Sheets — one card per item with its
                            own progress + Gantt. Replaces the old single-sheet card. */}
                        {workOrder.item_operation_sheets?.length > 0 && (
                            <div className="space-y-6 animate-slide-up">
                                {workOrder.item_operation_sheets.map(({ item, sheet }: any) => (
                                    <div key={item.id} className="space-y-3">
                                        <div className="card">
                                            <div className="card-header flex items-center justify-between">
                                                <div className="flex items-center gap-3 min-w-0">
                                                    <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-brand-400 to-brand-600 text-white flex items-center justify-center shadow-md shrink-0 font-bold text-sm">
                                                        {item.sequence}
                                                    </div>
                                                    <div className="min-w-0">
                                                        <h3 className="text-sm font-bold text-surface-900 truncate">
                                                            Item {item.sequence}: {item.description ?? '—'}
                                                        </h3>
                                                        <p className="text-xs text-surface-400 mt-0.5">
                                                            Qty {item.quantity} {item.unit}
                                                            {sheet ? ` · Sheet ${sheet.sheet_number} · ${sheet.steps?.length ?? 0} step${sheet.steps?.length !== 1 ? 's' : ''}` : ' · No operation sheet yet'}
                                                        </p>
                                                    </div>
                                                </div>
                                                <div className="flex gap-2 shrink-0">
                                                    {sheet ? (
                                                        <Link href={`/operation-sheets/${sheet.id}`}
                                                            title="View full operation sheet"
                                                            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-surface-600 hover:bg-surface-100 transition-colors">
                                                            <i className="fi fi-rr-eye text-sm leading-none" /> View Sheet
                                                        </Link>
                                                    ) : (
                                                        <Link href={`/operation-sheets/${workOrder.id}/create?item_id=${item.id}`}
                                                            className="btn-primary btn-sm">
                                                            <i className="fi fi-rr-plus text-xs leading-none" /> Create Sheet
                                                        </Link>
                                                    )}
                                                </div>
                                            </div>
                                        </div>

                                        {sheet?.progress && sheet.steps?.length > 0 && (
                                            <ProgressGantt
                                                steps={sheet.steps}
                                                progress={sheet.progress}
                                            />
                                        )}
                                    </div>
                                ))}
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
                                                <Link href={`/qc/inspection/${qc.id}`} className="btn-ghost btn-xs">
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

                        {/* Customer Completion Certificate — appears once customer has issued one */}
                        {completion_certificate && (
                            <div className="card animate-slide-up border-indigo-200 bg-indigo-50/30">
                                <div className="card-header flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <div className="w-8 h-8 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center shrink-0">
                                            <i className="fi fi-rr-diploma text-sm leading-none" />
                                        </div>
                                        <div>
                                            <h3 className="text-sm font-bold text-indigo-900">Completion Certificate (Customer-Issued)</h3>
                                            <p className="text-[11px] text-indigo-700/80 mt-0.5">
                                                <span className="font-mono font-bold">{completion_certificate.certificate_number}</span>
                                                {' '}· {completion_certificate.mode === 'self_issued' ? 'Self-issued (digitally signed)' : 'Uploaded letterhead'}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-1.5">
                                        <a href={`/ied/completion-certificates/${completion_certificate.id}/preview`}
                                            target="_blank" rel="noreferrer"
                                            className="btn-outline btn-xs">
                                            <i className="fi fi-rr-eye text-[10px] leading-none" /> View
                                        </a>
                                        <a href={`/ied/completion-certificates/${completion_certificate.id}/download`}
                                            className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 transition-colors">
                                            <i className="fi fi-rr-download text-[10px] leading-none" /> Download
                                        </a>
                                    </div>
                                </div>
                                <div className="card-body">
                                    <dl className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
                                        <div>
                                            <dt className="text-[10px] font-bold text-surface-400 uppercase tracking-wider">Issued By</dt>
                                            <dd className="text-surface-900 mt-0.5">{completion_certificate.issued_by_name}</dd>
                                            {completion_certificate.issued_by_designation && (
                                                <dd className="text-xs text-surface-500">{completion_certificate.issued_by_designation}</dd>
                                            )}
                                        </div>
                                        <div>
                                            <dt className="text-[10px] font-bold text-surface-400 uppercase tracking-wider">Issued Date</dt>
                                            <dd className="text-surface-900 mt-0.5">{completion_certificate.issued_date}</dd>
                                        </div>
                                        {completion_certificate.rating && (
                                            <div>
                                                <dt className="text-[10px] font-bold text-surface-400 uppercase tracking-wider">Satisfaction</dt>
                                                <dd className="text-amber-500 text-lg leading-none mt-0.5">
                                                    {'★'.repeat(completion_certificate.rating)}<span className="text-surface-200">{'★'.repeat(5 - completion_certificate.rating)}</span>
                                                </dd>
                                            </div>
                                        )}
                                    </dl>
                                    {completion_certificate.remarks && (
                                        <div className="mt-3 bg-white/70 border border-indigo-100 rounded-lg px-3 py-2">
                                            <div className="text-[10px] font-bold text-surface-400 uppercase tracking-wider mb-0.5">Remarks</div>
                                            <p className="text-sm text-surface-700 whitespace-pre-line italic">{completion_certificate.remarks}</p>
                                        </div>
                                    )}
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
                                <Link href={`/production/work-orders/${workOrder.id}/cycle`} className="btn-outline btn-sm w-full justify-center">
                                    <i className="fi fi-rr-time-past text-xs leading-none" /> Production Cycle
                                </Link>
                                <Link href={`/pcd/work-orders/${workOrder.id}/reroute`} className="btn-outline btn-sm w-full justify-center">
                                    <i className="fi fi-rr-shuffle text-xs leading-none" /> Reroute Sections
                                </Link>
                                {workOrder.item_operation_sheets?.some((row: any) => row.sheet) && (
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
