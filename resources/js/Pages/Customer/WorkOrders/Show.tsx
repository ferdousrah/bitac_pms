import { Link } from '@inertiajs/react';

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
                {/* Progress tracker */}
                {workOrder.status !== 'cancelled' && (
                    <div className="card animate-slide-up">
                        <div className="card-header flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="w-9 h-9 rounded-xl flex items-center justify-center text-sm shrink-0 bg-gradient-to-br from-emerald-400 to-emerald-600 text-white shadow-md">
                                    <i className="fi fi-rr-route leading-none" />
                                </div>
                                <div>
                                    <h2 className="text-sm font-semibold text-surface-800">Order Progress</h2>
                                    <p className="text-xs text-surface-400 mt-0.5">Track your order through production</p>
                                </div>
                            </div>
                        </div>
                        <div className="card-body">
                            <div className="relative">
                                <div className="absolute top-4 left-4 right-4 h-0.5 bg-surface-200" />
                                <div
                                    className="absolute top-4 left-4 h-0.5 bg-emerald-500 transition-all duration-500"
                                    style={{ width: currentIdx >= 0 ? `calc(${(currentIdx / (STAGES.length - 1)) * 100}% - ${currentIdx === STAGES.length - 1 ? 0 : 0}px)` : '0%' }}
                                />
                                <div className="relative flex items-start justify-between">
                                    {STAGES.map((stage, i) => {
                                        const done = currentIdx >= i;
                                        const active = currentIdx === i;
                                        return (
                                            <div key={stage.key} className="flex flex-col items-center flex-1">
                                                <div
                                                    className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold border-2 bg-white transition-all ${
                                                        done
                                                            ? 'bg-emerald-500 border-emerald-500 text-white shadow-md'
                                                            : 'border-surface-200 text-surface-400'
                                                    } ${active ? 'ring-4 ring-emerald-200' : ''}`}
                                                >
                                                    {done ? <i className="fi fi-rr-check leading-none text-xs" /> : i + 1}
                                                </div>
                                                <p
                                                    className={`text-[11px] mt-2 text-center font-medium ${
                                                        active ? 'text-emerald-700' : done ? 'text-surface-700' : 'text-surface-400'
                                                    }`}
                                                >
                                                    {stage.label}
                                                </p>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
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
        </div>
    );
}
