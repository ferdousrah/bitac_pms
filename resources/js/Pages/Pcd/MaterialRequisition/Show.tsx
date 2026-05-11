import AppLayout from '@/Layouts/AppLayout';
import { Link, router } from '@inertiajs/react';

interface WorkOrderRef {
    id: number;
    wo_number: string;
    job_number?: string;
    customer?: string;
}

interface RequisitionItem {
    item_no: number;
    description: string;
    unit: string;
    required_qty: number | string;
    stock_qty: number | string | null;
    issue_qty: number | string | null;
    pending_qty?: number | string | null;
    issue_date?: string | null;
    remarks?: string | null;
}

interface Requisition {
    id: number;
    mrn_number: string;
    work_order_id: number;
    work_order: WorkOrderRef | null;
    request_date_display: string;
    status: string;
    notes?: string | null;
    requested_by?: string | null;
    approved_by?: string | null;
    approved_at?: string | null;
    issued_by?: string | null;
    issued_at?: string | null;
    received_by?: string | null;
    received_at?: string | null;
    // IMS push tracking
    ims_reference?: string | null;
    ims_pushed_at?: string | null;
    ims_pushed_by?: string | null;
    ims_status?: string | null;
    ims_last_error?: string | null;
    items: RequisitionItem[];
}

interface Props {
    requisition: Requisition;
}

const statusBadge: Record<string, string> = {
    draft: 'badge-slate',
    pending_approval: 'badge-amber',
    sent_to_ims: 'badge-blue',
    approved: 'badge-blue',
    partially_issued: 'badge-amber',
    issued: 'badge-green',
    received: 'badge-green',
    cancelled: 'badge-red',
};

const statusLabel: Record<string, string> = {
    draft: 'Draft',
    pending_approval: 'Pending Approval',
    approved: 'Approved',
    partially_issued: 'Partially Issued',
    issued: 'Issued',
    received: 'Received',
    cancelled: 'Cancelled',
};

interface SignatureBoxProps {
    role: string;
    roleBn: string;
    name?: string | null;
    date?: string | null;
}

function SignatureBox({ role, roleBn, name, date }: SignatureBoxProps) {
    const signed = !!name;
    return (
        <div
            className={`rounded-lg border p-4 text-center flex flex-col justify-between min-h-[130px] ${
                signed ? 'border-brand-200 bg-brand-50/40' : 'border-dashed border-surface-200 bg-surface-50/40'
            }`}
        >
            <div className="flex-1 flex items-center justify-center">
                {signed ? (
                    <div>
                        <div className="font-semibold text-surface-900 text-sm">{name}</div>
                        {date && <div className="text-[11px] text-surface-500 mt-1">{date}</div>}
                    </div>
                ) : (
                    <span className="text-xs text-surface-400 italic">Pending</span>
                )}
            </div>
            <div className="pt-3 mt-2 border-t border-surface-200">
                <div className="text-[11px] font-semibold text-surface-700 uppercase tracking-wide">{role}</div>
                <div className="text-[10px] text-surface-500 mt-0.5">{roleBn}</div>
            </div>
        </div>
    );
}

export default function MaterialRequisitionShow({ requisition }: Props) {
    const pushToIms = () => {
        if (!confirm('Push this requisition to IMS for approval and issuance? Approval happens inside IMS — you will see the IMS reference once it is accepted.')) return;
        router.post(`/pcd/material-requisitions/${requisition.id}/submit`);
    };

    const markIssued = () => {
        if (!confirm('Mark this requisition as issued?')) return;
        router.post(`/pcd/material-requisitions/${requisition.id}/issue`);
    };

    return (
        <AppLayout header={`Material Requisition ${requisition.mrn_number}`}>
            <div className="space-y-6 animate-fade-in">
                {/* Header card */}
                <div className="card">
                    <div className="card-body">
                        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
                            <div className="text-center lg:text-left flex-1">
                                <h2 className="text-lg font-bold text-surface-900">Material Requisition Note</h2>
                                <div className="text-sm text-surface-600 mt-1">
                                    বাংলাদেশ শিল্প কারিগরি সহায়তা কেন্দ্র (বিটাক)
                                </div>
                                <div className="text-xs text-surface-400">
                                    Bangladesh Industrial Technical Assistance Centre
                                </div>
                            </div>
                            <div className="flex flex-col items-center lg:items-end gap-2">
                                <div className="font-mono font-bold text-brand-600 text-lg">
                                    {requisition.mrn_number}
                                </div>
                                <span className={`badge ${statusBadge[requisition.status] ?? 'badge-slate'}`}>
                                    {statusLabel[requisition.status] ?? requisition.status}
                                </span>
                                <div className="text-xs text-surface-500">
                                    <i className="fi fi-rr-calendar text-xs leading-none mr-1" />
                                    {requisition.request_date_display}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Work Order info */}
                <div className="card">
                    <div className="card-header">
                        <h3 className="text-sm font-bold text-surface-900">Work Order Reference</h3>
                    </div>
                    <div className="card-body">
                        {requisition.work_order ? (
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
                                <div>
                                    <div className="text-[11px] font-semibold uppercase text-surface-400">WO Number</div>
                                    <Link
                                        href={`/work-orders/${requisition.work_order.id}`}
                                        className="font-mono font-semibold text-brand-600 hover:text-brand-700 mt-1 inline-block"
                                    >
                                        {requisition.work_order.wo_number}
                                    </Link>
                                </div>
                                {requisition.work_order.job_number && (
                                    <div>
                                        <div className="text-[11px] font-semibold uppercase text-surface-400">Job Number</div>
                                        <div className="text-surface-800 mt-1">{requisition.work_order.job_number}</div>
                                    </div>
                                )}
                                {requisition.work_order.customer && (
                                    <div>
                                        <div className="text-[11px] font-semibold uppercase text-surface-400">Customer</div>
                                        <div className="text-surface-800 mt-1">{requisition.work_order.customer}</div>
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className="text-xs text-surface-400 italic">No work order linked</div>
                        )}
                    </div>
                </div>

                {/* IMS status banner — appears once pushed (or on error) */}
                {(requisition.ims_reference || requisition.ims_last_error) && (
                    <div className={`card border-l-4 ${
                        requisition.ims_last_error && !requisition.ims_reference
                            ? 'border-red-500'
                            : 'border-indigo-500'
                    }`}>
                        <div className="card-body flex items-start gap-3">
                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                                requisition.ims_last_error && !requisition.ims_reference
                                    ? 'bg-red-50 text-red-600'
                                    : 'bg-indigo-50 text-indigo-600'
                            }`}>
                                <i className={`fi ${requisition.ims_reference ? 'fi-rr-arrow-up-right-from-square' : 'fi-rr-triangle-warning'} text-base leading-none`} />
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                    <span className="text-sm font-bold text-surface-900">
                                        {requisition.ims_reference ? 'Pushed to IMS' : 'IMS Push Failed'}
                                    </span>
                                    {requisition.ims_status && (
                                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-700 font-bold uppercase tracking-wider">
                                            IMS: {requisition.ims_status.replace(/_/g, ' ')}
                                        </span>
                                    )}
                                </div>
                                {requisition.ims_reference && (
                                    <div className="text-xs text-surface-700 mt-1 font-mono">
                                        Reference: <span className="font-bold">{requisition.ims_reference}</span>
                                    </div>
                                )}
                                {requisition.ims_pushed_at && (
                                    <div className="text-[11px] text-surface-500 mt-0.5">
                                        Pushed by {requisition.ims_pushed_by ?? '—'} · {requisition.ims_pushed_at}
                                    </div>
                                )}
                                {requisition.ims_last_error && (
                                    <div className="text-xs text-red-700 mt-1 bg-red-50 border border-red-200 rounded px-2 py-1.5">
                                        ⚠ {requisition.ims_last_error}
                                    </div>
                                )}
                                <p className="text-[11px] text-surface-500 italic mt-1">
                                    Approval &amp; issuance happen inside IMS. Status here will update automatically when IMS reports back.
                                </p>
                            </div>
                        </div>
                    </div>
                )}

                {/* Items table */}
                <div className="card">
                    <div className="card-header">
                        <h3 className="text-sm font-bold text-surface-900">Items</h3>
                        <p className="text-xs text-surface-400 mt-0.5">
                            Materials requested and issued against this requisition
                        </p>
                    </div>
                    <div className="card-body overflow-x-auto">
                        {requisition.items && requisition.items.length > 0 ? (
                            <table className="premium-table">
                                <thead>
                                    <tr>
                                        <th className="w-10">#</th>
                                        <th>Description</th>
                                        <th className="w-20">Unit</th>
                                        <th className="w-24 text-right">Required</th>
                                        <th className="w-24 text-right">Stock</th>
                                        <th className="w-24 text-right">Issued</th>
                                        <th className="w-24 text-right">Pending</th>
                                        <th className="w-32">Issue Date</th>
                                        <th>Remarks</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {requisition.items.map((it, i) => {
                                        const req = Number(it.required_qty) || 0;
                                        const iss = Number(it.issue_qty) || 0;
                                        const pending =
                                            it.pending_qty != null ? Number(it.pending_qty) : Math.max(req - iss, 0);
                                        return (
                                            <tr key={i}>
                                                <td className="text-center font-semibold text-surface-600">
                                                    {it.item_no}
                                                </td>
                                                <td className="font-medium text-surface-900">{it.description}</td>
                                                <td className="text-surface-600">{it.unit}</td>
                                                <td className="text-right font-mono text-surface-800">
                                                    {req || '--'}
                                                </td>
                                                <td className="text-right font-mono text-surface-600">
                                                    {it.stock_qty ?? <span className="text-surface-300">--</span>}
                                                </td>
                                                <td className="text-right font-mono text-surface-800">
                                                    {iss || <span className="text-surface-300">--</span>}
                                                </td>
                                                <td className="text-right font-mono font-semibold text-surface-700">
                                                    {pending}
                                                </td>
                                                <td className="text-surface-600">
                                                    {it.issue_date ?? <span className="text-surface-300">--</span>}
                                                </td>
                                                <td className="text-surface-600">
                                                    {it.remarks ?? <span className="text-surface-300">--</span>}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        ) : (
                            <div className="empty-state">
                                <div className="empty-state-icon">
                                    <i className="fi fi-rr-box" />
                                </div>
                                <div className="empty-state-title">No items</div>
                                <div className="empty-state-text">This requisition has no line items.</div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Notes */}
                {requisition.notes && (
                    <div className="card">
                        <div className="card-header">
                            <h3 className="text-sm font-bold text-surface-900">Notes</h3>
                        </div>
                        <div className="card-body">
                            <p className="text-sm text-surface-700 whitespace-pre-line">{requisition.notes}</p>
                        </div>
                    </div>
                )}

                {/* Signatures */}
                <div className="card">
                    <div className="card-header">
                        <h3 className="text-sm font-bold text-surface-900">Signatures</h3>
                        <p className="text-xs text-surface-400 mt-0.5">Authorisation & handover records</p>
                    </div>
                    <div className="card-body">
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                            <SignatureBox
                                role="Authorizing Officer"
                                roleBn="অনুমোদনকারী অফিসার"
                                name={requisition.approved_by}
                                date={requisition.approved_at}
                            />
                            <SignatureBox
                                role="Stock Keeper"
                                roleBn="দ্রব্য রক্ষক"
                                name={requisition.issued_by}
                                date={requisition.issued_at}
                            />
                            <SignatureBox
                                role="Material Receiver"
                                roleBn="দ্রব্য গ্রহিতা"
                                name={requisition.received_by}
                                date={requisition.received_at}
                            />
                            <SignatureBox
                                role="Asst Stock Keeper"
                                roleBn="সহকারী দ্রব্য রক্ষক কর্মকর্তা"
                                name={null}
                                date={null}
                            />
                        </div>
                    </div>
                </div>

                {/* Actions */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <Link href="/pcd/material-requisitions" className="btn-ghost btn-sm">
                        <i className="fi fi-rr-arrow-left text-xs leading-none" />
                        Back to list
                    </Link>
                    <div className="flex flex-col sm:flex-row gap-2">
                        {['draft', 'pending_approval'].includes(requisition.status) && (
                            <Link
                                href={`/pcd/material-requisitions/${requisition.id}/edit`}
                                className="btn-outline btn-sm"
                            >
                                <i className="fi fi-rr-edit text-xs leading-none" />
                                Edit
                            </Link>
                        )}
                        {(requisition.status === 'draft' || requisition.status === 'pending_approval') && (
                            <button type="button" onClick={pushToIms} className="btn-primary btn-sm">
                                <i className="fi fi-rr-arrow-up-right-from-square text-xs leading-none" />
                                Submit to IMS
                            </button>
                        )}
                        {requisition.status === 'sent_to_ims' && (
                            <button type="button" onClick={pushToIms} className="btn-outline btn-sm"
                                title="Resend if IMS lost it">
                                <i className="fi fi-rr-refresh text-xs leading-none" />
                                Resend to IMS
                            </button>
                        )}
                        {requisition.status === 'approved' && (
                            <button type="button" onClick={markIssued} className="btn-success btn-sm">
                                <i className="fi fi-rr-box-check text-xs leading-none" />
                                Mark as Issued
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </AppLayout>
    );
}
