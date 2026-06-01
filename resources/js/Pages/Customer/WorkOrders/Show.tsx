import { Link, useForm, usePage } from '@inertiajs/react';
import { FormEvent, useState } from 'react';

const STATUS_BADGE: Record<string, string> = {
    draft:              'badge-slate',
    approved:           'badge-blue',
    in_production:      'badge-amber',
    qc_hold:            'badge-amber',
    qc_passed:          'badge-green',
    ready_for_delivery: 'badge-purple',
    delivered:          'badge-green',
    cancelled:          'badge-red',
};

const STAGES = [
    { key: 'approved',           label: 'Confirmed' },
    { key: 'in_production',      label: 'In Production' },
    { key: 'qc_passed',          label: 'QC Passed' },
    { key: 'ready_for_delivery', label: 'Ready' },
    { key: 'delivered',          label: 'Delivered' },
];

const stageOrder = STAGES.map(s => s.key);

export default function CustomerWorkOrderShow({ workOrder }: any) {
    const currentIdx = stageOrder.indexOf(workOrder.status);
    const { flash } = (usePage().props ?? {}) as any;
    const [showModal, setShowModal] = useState(false);

    const erForm = useForm({ reason: '', needed_by: '', work_order_item_id: '' as string });

    const submitEmergency = (e: FormEvent) => {
        e.preventDefault();
        erForm.post(`/customer/work-orders/${workOrder.id}/emergency-request`, {
            preserveScroll: true,
            onSuccess: () => { erForm.reset(); setShowModal(false); },
        });
    };

    const isUrgent = workOrder.priority === 'urgent';
    const hasMultipleItems = workOrder.items && workOrder.items.length > 1;
    // Multi-item WO: button always available (server dedupes per-item).
    // Single-item WO: hide while WO-wide request is pending.
    const canShowRequestButton = !isUrgent && (hasMultipleItems || !workOrder.pending_emergency);

    return (
        <div className="min-h-screen bg-surface-50">
            {/* Nav */}
            <nav className="bg-white border-b border-surface-100 shadow-sm sticky top-0 z-30">
                <div className="max-w-4xl mx-auto px-4 sm:px-6 py-3.5 flex items-center gap-4">
                    <Link href="/customer/work-orders" className="btn-ghost btn-xs">
                        <i className="fi fi-rr-arrow-left leading-none text-xs" /> My Orders
                    </Link>
                    <div className="h-5 w-px bg-surface-200" />
                    <h1 className="font-bold text-surface-900 text-sm sm:text-base font-mono">{workOrder.wo_number}</h1>
                </div>
            </nav>

            <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6 animate-fade-in">
                {/* Production progress (operation steps) */}
                {workOrder.status !== 'cancelled' && (
                    <div className="card animate-slide-up overflow-hidden">
                        <div className="card-header flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="w-9 h-9 rounded-xl flex items-center justify-center text-sm shrink-0 bg-gradient-to-br from-emerald-400 to-emerald-600 text-white shadow-md">
                                    <i className="fi fi-rr-bars-progress leading-none" />
                                </div>
                                <div>
                                    <h2 className="text-sm font-semibold text-surface-800">Production Progress</h2>
                                    <p className="text-xs text-surface-400 mt-0.5">Live status from the shop floor</p>
                                </div>
                            </div>
                            <div className="text-right">
                                <p className="text-2xl font-bold tabular-nums text-surface-900 leading-none">{workOrder.progress_pct ?? 0}%</p>
                                <p className="text-[10px] text-surface-400 uppercase tracking-wider mt-1">Complete</p>
                            </div>
                        </div>
                        <div className="card-body space-y-4">
                            {/* Big bar */}
                            {(() => {
                                const pct = workOrder.progress_pct ?? 0;
                                const barClasses =
                                    pct >= 100 ? 'from-emerald-400 to-emerald-600' :
                                    pct >= 70  ? 'from-blue-400 to-blue-600' :
                                    pct >= 30  ? 'from-amber-400 to-amber-500' :
                                                 'from-surface-300 to-surface-400';
                                return (
                                    <div className="h-2.5 rounded-full bg-surface-100 overflow-hidden">
                                        <div className={`h-full bg-gradient-to-r ${barClasses} transition-all duration-700`}
                                            style={{ width: `${Math.max(2, pct)}%` }} />
                                    </div>
                                );
                            })()}

                            {/* High-level stage chips */}
                            <div className="relative pt-2">
                                <div className="absolute top-[18px] left-3 right-3 h-px bg-surface-200" />
                                <div
                                    className="absolute top-[18px] left-3 h-px bg-emerald-500 transition-all duration-500"
                                    style={{ width: currentIdx >= 0 ? `calc((100% - 24px) * ${currentIdx / (STAGES.length - 1)})` : '0%' }}
                                />
                                <div className="relative flex items-start justify-between">
                                    {STAGES.map((stage, i) => {
                                        const done = currentIdx >= i;
                                        const active = currentIdx === i;
                                        return (
                                            <div key={stage.key} className="flex flex-col items-center flex-1">
                                                <div
                                                    className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold border-2 bg-white transition-all ${
                                                        done
                                                            ? 'bg-emerald-500 border-emerald-500 text-white'
                                                            : 'border-surface-200 text-surface-400'
                                                    } ${active ? 'ring-4 ring-emerald-100' : ''}`}
                                                >
                                                    {done ? <i className="fi fi-rr-check leading-none text-[9px]" /> : i + 1}
                                                </div>
                                                <p className={`text-[10px] mt-1.5 text-center font-medium ${
                                                    active ? 'text-emerald-700' : done ? 'text-surface-700' : 'text-surface-400'
                                                }`}>
                                                    {stage.label}
                                                </p>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Step-by-step breakdown */}
                            {workOrder.steps && workOrder.steps.length > 0 && (
                                <div className="pt-4 mt-2 border-t border-surface-100">
                                    <p className="text-[11px] font-semibold text-surface-400 uppercase tracking-wider mb-3">
                                        Operation Steps ({workOrder.steps.filter((s: any) => s.status === 'completed').length} / {workOrder.steps.length} complete)
                                    </p>
                                    <ol className="space-y-2">
                                        {workOrder.steps.map((step: any) => {
                                            const isDone = step.status === 'completed';
                                            const isWip  = step.status === 'in_progress';
                                            return (
                                                <li key={step.sequence} className={`flex items-center gap-3 px-3 py-2.5 rounded-lg border transition-colors ${
                                                    isDone ? 'bg-emerald-50/60 border-emerald-100' :
                                                    isWip  ? 'bg-amber-50/60 border-amber-100' :
                                                             'bg-surface-50/40 border-surface-100'
                                                }`}>
                                                    <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0 ${
                                                        isDone ? 'bg-emerald-500 text-white' :
                                                        isWip  ? 'bg-amber-500 text-white' :
                                                                 'bg-surface-200 text-surface-500'
                                                    }`}>
                                                        {isDone ? <i className="fi fi-rr-check leading-none text-[10px]" /> :
                                                         isWip  ? <i className="fi fi-rr-loading leading-none text-[10px] animate-spin" /> :
                                                                  step.sequence}
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <p className="text-sm font-medium text-surface-800 truncate">{step.operation}</p>
                                                        {step.weight > 0 && (
                                                            <p className="text-[10px] text-surface-400 mt-0.5">Weight {step.weight}%</p>
                                                        )}
                                                    </div>
                                                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                                                        isDone ? 'bg-emerald-100 text-emerald-700' :
                                                        isWip  ? 'bg-amber-100 text-amber-800' :
                                                                 'bg-surface-100 text-surface-500'
                                                    }`}>
                                                        {isDone ? 'Done' : isWip ? 'Running' : 'Pending'}
                                                    </span>
                                                </li>
                                            );
                                        })}
                                    </ol>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* Emergency request flash */}
                {flash?.success && (
                    <div className="rounded-2xl bg-emerald-50 border border-emerald-200 px-4 py-3 flex items-start gap-3 text-sm text-emerald-800 animate-slide-up">
                        <i className="fi fi-rr-check-circle text-base leading-none mt-0.5" />
                        <div>{flash.success}</div>
                    </div>
                )}
                {flash?.error && (
                    <div className="rounded-2xl bg-rose-50 border border-rose-200 px-4 py-3 flex items-start gap-3 text-sm text-rose-800 animate-slide-up">
                        <i className="fi fi-rr-exclamation text-base leading-none mt-0.5" />
                        <div>{flash.error}</div>
                    </div>
                )}

                {/* Emergency request panel — only meaningful while job is in flight */}
                {workOrder.in_progress_for_emergency && (
                    <div className={`card animate-slide-up overflow-hidden ${
                        isUrgent ? 'border-rose-200 bg-rose-50/30' : ''
                    }`}>
                        <div className="card-body flex flex-col sm:flex-row sm:items-center gap-4">
                            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 shadow-md ${
                                isUrgent
                                    ? 'bg-gradient-to-br from-rose-500 to-red-600 text-white'
                                    : 'bg-gradient-to-br from-amber-400 to-amber-600 text-white'
                            }`}>
                                <i className={`fi ${isUrgent ? 'fi-rr-siren-on' : 'fi-rr-bolt'} text-lg leading-none`} />
                            </div>
                            <div className="flex-1 min-w-0">
                                {isUrgent ? (
                                    <>
                                        <p className="text-sm font-bold text-rose-700">Urgent priority active</p>
                                        <p className="text-xs text-surface-500 mt-0.5">Your job is being expedited — BITAC has flagged this for urgent production.</p>
                                    </>
                                ) : workOrder.pending_emergency ? (
                                    <>
                                        <p className="text-sm font-bold text-amber-700">Emergency request pending</p>
                                        <p className="text-xs text-surface-500 mt-0.5">
                                            Submitted {workOrder.pending_emergency.created_at} — awaiting BITAC review.
                                        </p>
                                    </>
                                ) : workOrder.latest_emergency?.status === 'rejected' ? (
                                    <>
                                        <p className="text-sm font-bold text-surface-800">Need this job urgently?</p>
                                        <p className="text-xs text-surface-500 mt-0.5">
                                            Your previous request was not approved
                                            {workOrder.latest_emergency.review_notes && <> &mdash; {workOrder.latest_emergency.review_notes}</>}.
                                            You may submit another request.
                                        </p>
                                    </>
                                ) : (
                                    <>
                                        <p className="text-sm font-bold text-surface-800">Need this job urgently?</p>
                                        <p className="text-xs text-surface-500 mt-0.5">
                                            Request emergency production — BITAC will review and prioritise if feasible.
                                        </p>
                                    </>
                                )}
                            </div>
                            {canShowRequestButton && (
                                <button
                                    onClick={() => setShowModal(true)}
                                    className="btn-sm rounded-xl px-4 py-2 font-semibold inline-flex items-center gap-2 bg-rose-600 hover:bg-rose-700 text-white shadow-sm shrink-0 transition-colors"
                                >
                                    <i className="fi fi-rr-siren-on text-xs leading-none" /> Request Emergency
                                </button>
                            )}
                        </div>
                    </div>
                )}

                {/* Job Items */}
                {workOrder.items && workOrder.items.length > 0 && (
                    <div className="card animate-slide-up overflow-hidden">
                        <div className="card-header flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 bg-gradient-to-br from-indigo-400 to-indigo-600 text-white shadow-md">
                                    <i className="fi fi-rr-boxes text-sm leading-none" />
                                </div>
                                <div>
                                    <h2 className="text-sm font-semibold text-surface-800">Job Items</h2>
                                    <p className="text-xs text-surface-400 mt-0.5">
                                        {workOrder.items.length} item{workOrder.items.length === 1 ? '' : 's'} under this order
                                    </p>
                                </div>
                            </div>
                        </div>
                        <div className="card-body p-0">
                            <table className="w-full text-sm">
                                <thead className="bg-surface-50 text-[10px] uppercase tracking-wider text-surface-500">
                                    <tr>
                                        <th className="text-left px-4 py-2.5 font-semibold">Job #</th>
                                        <th className="text-left px-4 py-2.5 font-semibold">Product / Description</th>
                                        <th className="text-right px-4 py-2.5 font-semibold">Qty</th>
                                        <th className="text-left px-4 py-2.5 font-semibold">Status</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-surface-100">
                                    {workOrder.items.map((item: any) => (
                                        <tr key={item.id} className="hover:bg-surface-50/60">
                                            <td className="px-4 py-3 font-mono font-bold text-brand-600">{item.job_number}</td>
                                            <td className="px-4 py-3 text-surface-800">{item.product ?? <span className="text-surface-400 italic">—</span>}</td>
                                            <td className="px-4 py-3 text-right font-mono text-surface-700 tabular-nums">
                                                {Number(item.quantity).toLocaleString('en-IN')} <span className="text-surface-400 text-xs">{item.unit}</span>
                                            </td>
                                            <td className="px-4 py-3">
                                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wide bg-surface-100 text-surface-700">
                                                    {item.status?.replace(/_/g, ' ')}
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {/* Details */}
                <div className="card animate-slide-up">
                    <div className="card-header flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                            <div className="w-9 h-9 rounded-xl flex items-center justify-center text-sm shrink-0 bg-gradient-to-br from-brand-400 to-brand-600 text-white shadow-md">
                                <i className="fi fi-rr-clipboard-list leading-none" />
                            </div>
                            <div className="min-w-0">
                                <h2 className="text-base font-bold text-surface-900 font-mono">{workOrder.wo_number}</h2>
                                <p className="text-sm text-surface-500 mt-0.5 truncate">{workOrder.product}</p>
                            </div>
                        </div>
                        <span className={`badge ${STATUS_BADGE[workOrder.status] ?? 'badge-slate'}`}>
                            {workOrder.status?.replace(/_/g, ' ')}
                        </span>
                    </div>
                    <div className="card-body">
                        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                            <div>
                                <dt className="text-xs font-semibold text-surface-400 uppercase tracking-wide">Quantity</dt>
                                <dd className="font-mono font-semibold text-surface-900 mt-1">{workOrder.quantity}</dd>
                            </div>
                            <div>
                                <dt className="text-xs font-semibold text-surface-400 uppercase tracking-wide">Priority</dt>
                                <dd className="text-surface-800 mt-1 capitalize">{workOrder.priority}</dd>
                            </div>
                            <div>
                                <dt className="text-xs font-semibold text-surface-400 uppercase tracking-wide">Due Date</dt>
                                <dd className={`mt-1 ${workOrder.is_overdue ? 'text-red-600 font-semibold' : 'text-surface-800'}`}>
                                    {workOrder.is_overdue && <i className="fi fi-rr-clock leading-none text-xs mr-1" />}
                                    {workOrder.due_date ?? '—'}
                                </dd>
                            </div>
                            <div>
                                <dt className="text-xs font-semibold text-surface-400 uppercase tracking-wide">Created</dt>
                                <dd className="text-surface-800 mt-1">{workOrder.created_at}</dd>
                            </div>
                            {workOrder.notes && (
                                <div className="sm:col-span-2">
                                    <dt className="text-xs font-semibold text-surface-400 uppercase tracking-wide">Notes</dt>
                                    <dd className="text-surface-700 mt-1">{workOrder.notes}</dd>
                                </div>
                            )}
                        </dl>
                    </div>
                </div>

                {/* Delivery info */}
                {workOrder.delivery && (
                    <div className="card animate-slide-up border-emerald-200 bg-emerald-50/40">
                        <div className="card-header flex items-center justify-between !border-emerald-100">
                            <div className="flex items-center gap-3">
                                <div className="w-9 h-9 rounded-xl flex items-center justify-center text-sm shrink-0 bg-gradient-to-br from-emerald-400 to-emerald-600 text-white shadow-md">
                                    <i className="fi fi-rr-truck-side leading-none" />
                                </div>
                                <div>
                                    <h3 className="text-sm font-semibold text-emerald-800">Delivery Information</h3>
                                    <p className="text-xs text-emerald-600/80 mt-0.5">Your order has been delivered</p>
                                </div>
                            </div>
                        </div>
                        <div className="card-body">
                            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                                <div>
                                    <dt className="text-xs font-semibold text-emerald-600 uppercase tracking-wide">Challan</dt>
                                    <dd className="font-mono font-semibold text-surface-900 mt-1">{workOrder.delivery.challan_number}</dd>
                                </div>
                                <div>
                                    <dt className="text-xs font-semibold text-emerald-600 uppercase tracking-wide">Delivered At</dt>
                                    <dd className="text-surface-800 mt-1">{workOrder.delivery.delivered_at}</dd>
                                </div>
                            </dl>
                        </div>
                    </div>
                )}

                {/* Gate Passes */}
                {workOrder.gate_passes && workOrder.gate_passes.length > 0 && (
                    <div className="card animate-slide-up">
                        <div className="card-header flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="w-9 h-9 rounded-xl flex items-center justify-center text-sm shrink-0 bg-gradient-to-br from-rose-400 to-rose-600 text-white shadow-md">
                                    <i className="fi fi-rr-shield leading-none" />
                                </div>
                                <div>
                                    <h3 className="text-sm font-semibold text-surface-800">Gate Passes</h3>
                                    <p className="text-xs text-surface-400 mt-0.5">Print and present at BITAC's gate</p>
                                </div>
                            </div>
                        </div>
                        <div className="card-body p-0">
                            <ul className="divide-y divide-surface-100">
                                {workOrder.gate_passes.map((gp: any) => (
                                    <li key={gp.id} className="px-5 py-3 flex items-center justify-between gap-3">
                                        <div className="min-w-0">
                                            <div className="flex items-center gap-2">
                                                <span className="font-mono text-sm font-bold text-rose-700">{gp.pass_no}</span>
                                                <span className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ${
                                                    gp.direction === 'in' ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' : 'bg-amber-50 text-amber-700 border border-amber-100'
                                                }`}>
                                                    {gp.direction === 'in' ? 'Gate-In' : 'Gate-Out'}
                                                </span>
                                            </div>
                                            <p className="text-[11px] text-surface-400 mt-0.5">
                                                Issued {gp.pass_date ?? gp.issued_at ?? '—'} · Status: {String(gp.status).replace(/_/g, ' ')}
                                            </p>
                                        </div>
                                        <a
                                            href={`/customer/documents/gate-pass/${gp.id}`}
                                            target="_blank"
                                            rel="noreferrer"
                                            className="btn-outline btn-xs shrink-0"
                                        >
                                            <i className="fi fi-rr-print text-[10px] leading-none" /> View / Print
                                        </a>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    </div>
                )}

                {/* Invoice */}
                {workOrder.invoice && (
                    <div className="card animate-slide-up">
                        <div className="card-header flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="w-9 h-9 rounded-xl flex items-center justify-center text-sm shrink-0 bg-gradient-to-br from-teal-400 to-teal-600 text-white shadow-md">
                                    <i className="fi fi-rr-receipt leading-none" />
                                </div>
                                <div>
                                    <h3 className="text-sm font-semibold text-surface-800">Invoice</h3>
                                    <p className="text-xs text-surface-400 mt-0.5 font-mono">{workOrder.invoice.invoice_number}</p>
                                </div>
                            </div>
                            <div className="text-right">
                                <p className="text-lg font-bold text-surface-900 tabular-nums">BDT {Number(workOrder.invoice.total_amount).toLocaleString('en-IN')}</p>
                                <Link href={`/customer/invoices/${workOrder.invoice.id}`} className="btn-outline btn-xs mt-1">
                                    <i className="fi fi-rr-eye leading-none text-[10px]" /> View &amp; Download
                                </Link>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Emergency Request Modal */}
            {showModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-surface-900/50 backdrop-blur-sm animate-fade-in"
                    onClick={() => setShowModal(false)}>
                    <div className="bg-white rounded-2xl shadow-premium-lg w-full max-w-md overflow-hidden"
                        onClick={e => e.stopPropagation()}>
                        <div className="px-5 py-4 border-b border-surface-100 flex items-center gap-3">
                            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-rose-500 to-red-600 text-white flex items-center justify-center shadow-sm shrink-0">
                                <i className="fi fi-rr-siren-on text-sm leading-none" />
                            </div>
                            <div>
                                <h3 className="text-sm font-bold text-surface-900">Request Emergency Production</h3>
                                <p className="text-xs text-surface-500 mt-0.5">For job <span className="font-mono">{workOrder.wo_number}</span></p>
                            </div>
                            <button type="button" onClick={() => setShowModal(false)}
                                className="ml-auto text-surface-400 hover:text-surface-700 transition-colors p-1">
                                <i className="fi fi-rr-cross text-xs leading-none" />
                            </button>
                        </div>
                        <form onSubmit={submitEmergency} className="px-5 py-4 space-y-4">
                            {workOrder.items && workOrder.items.length > 1 && (
                                <div>
                                    <label className="block text-xs font-medium text-surface-600 mb-1.5">
                                        Which item is urgent? <span className="text-red-500">*</span>
                                    </label>
                                    <select
                                        value={erForm.data.work_order_item_id}
                                        onChange={e => erForm.setData('work_order_item_id', e.target.value)}
                                        required
                                        className="w-full px-3.5 py-2.5 rounded-lg border border-surface-200 bg-white text-sm
                                                   focus:outline-none focus:border-surface-900 focus:ring-0
                                                   transition-colors"
                                    >
                                        <option value="">Select an item…</option>
                                        {workOrder.items.map((it: any) => (
                                            <option key={it.id} value={it.id} disabled={it.has_pending_emergency}>
                                                Job #{it.job_number} — {it.product ?? 'Item'} (Qty {Number(it.quantity).toLocaleString('en-IN')} {it.unit})
                                                {it.has_pending_emergency && ' — pending'}
                                            </option>
                                        ))}
                                    </select>
                                    {erForm.errors.work_order_item_id && <p className="mt-1.5 text-[11px] text-red-600">{erForm.errors.work_order_item_id}</p>}
                                </div>
                            )}

                            <div>
                                <label className="block text-xs font-medium text-surface-600 mb-1.5">
                                    Reason <span className="text-red-500">*</span>
                                </label>
                                <textarea
                                    value={erForm.data.reason}
                                    onChange={e => erForm.setData('reason', e.target.value)}
                                    rows={4}
                                    required
                                    maxLength={1000}
                                    placeholder="Tell BITAC why this job needs to be prioritised — e.g. plant breakdown, customer demand, regulatory deadline…"
                                    className="w-full px-3.5 py-2.5 rounded-lg border border-surface-200 bg-white text-sm
                                               placeholder:text-surface-300
                                               focus:outline-none focus:border-surface-900 focus:ring-0
                                               transition-colors resize-none"
                                />
                                {erForm.errors.reason && <p className="mt-1.5 text-[11px] text-red-600">{erForm.errors.reason}</p>}
                            </div>

                            <div>
                                <label className="block text-xs font-medium text-surface-600 mb-1.5">
                                    Needed by <span className="form-label-optional">(optional)</span>
                                </label>
                                <input
                                    type="date"
                                    value={erForm.data.needed_by}
                                    min={new Date().toISOString().slice(0, 10)}
                                    onChange={e => erForm.setData('needed_by', e.target.value)}
                                    className="w-full px-3.5 py-2.5 rounded-lg border border-surface-200 bg-white text-sm
                                               focus:outline-none focus:border-surface-900 focus:ring-0
                                               transition-colors"
                                />
                                {erForm.errors.needed_by && <p className="mt-1.5 text-[11px] text-red-600">{erForm.errors.needed_by}</p>}
                            </div>

                            <div className="rounded-lg bg-amber-50 border border-amber-100 px-3 py-2 text-[11px] text-amber-800 leading-relaxed">
                                <i className="fi fi-rr-info text-xs leading-none mr-1" />
                                Approval depends on shop floor capacity. BITAC will respond — you'll see the decision here.
                            </div>

                            <div className="flex items-center gap-2 pt-2">
                                <button type="submit" disabled={erForm.processing}
                                    className="flex-1 py-2.5 rounded-lg text-sm font-medium text-white bg-rose-600 hover:bg-rose-700
                                               disabled:opacity-60 active:scale-[0.99] transition-all flex items-center justify-center gap-2">
                                    {erForm.processing
                                        ? <><i className="fi fi-rr-spinner animate-spin text-xs" /> Submitting</>
                                        : <><i className="fi fi-rr-paper-plane text-xs" /> Submit Request</>}
                                </button>
                                <button type="button" onClick={() => setShowModal(false)}
                                    className="px-4 py-2.5 rounded-lg text-sm font-medium text-surface-600 hover:bg-surface-100 transition-colors">
                                    Cancel
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
