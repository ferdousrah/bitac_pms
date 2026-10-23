import AppLayout from '@/Layouts/AppLayout';
import { Link, router } from '@inertiajs/react';
import { DEMAND_BADGE, mrBadge, mrLabel } from '@/lib/mrStatus';

const qty = (v: any) => Number(v).toLocaleString('en-IN', { maximumFractionDigits: 3 });

/**
 * One demand. Until PCD answers, the shop may change or withdraw it and PCD may
 * raise a requisition from it or reject it. After that, its progress is the
 * requisition's — shown here, never copied.
 */
export default function MaterialDemandShow({ demand, can }: any) {
    const mr = demand.requisition_detail;

    const reject = () => {
        const reason = prompt('Reject this demand? Say why — the shop will see it:');
        if (reason === null) return;
        router.post(`/material-demands/${demand.id}/reject`, { reason }, { preserveScroll: true });
    };
    const withdraw = () => {
        if (!confirm(`Withdraw ${demand.demand_no}? PCD will no longer act on it.`)) return;
        router.post(`/material-demands/${demand.id}/cancel`, {}, { preserveScroll: true });
    };

    return (
        <AppLayout header={`Material Demand ${demand.demand_no}`}>
            <div className="space-y-6 animate-fade-in">
                <div className="card">
                    <div className="card-body flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
                        <div className="min-w-0">
                            <div className="flex items-center gap-3 flex-wrap">
                                <h2 className="font-mono font-bold text-brand-600 text-xl">{demand.demand_no}</h2>
                                <span className={`badge ${DEMAND_BADGE[demand.status] ?? 'badge-slate'}`}>{demand.status_label}</span>
                            </div>
                            <p className="text-sm text-surface-600 mt-1">
                                <b className="font-semibold text-surface-800">{demand.shop}</b> asked on {demand.created}
                                {demand.requested_by && <> · {demand.requested_by}</>}
                                {demand.needed_by && <> · needed by <b className={demand.overdue ? 'text-red-600' : 'text-surface-800'}>{demand.needed_by}</b></>}
                            </p>
                            {!demand.work_order && (
                                <p className="text-sm text-surface-600 mt-1">No job — for the shop's own use</p>
                            )}
                            {demand.work_order && (
                                <p className="text-sm text-surface-600 mt-1">
                                    For <span className="font-mono font-semibold text-surface-800">{demand.work_order.wo_number}</span>
                                    {demand.work_order.job_number && <> · Job <b className="font-semibold text-surface-800">{demand.work_order.job_number}</b></>}
                                    {demand.work_order.customer && <> · {demand.work_order.customer}</>}
                                </p>
                            )}
                        </div>
                        <div className="flex flex-wrap gap-2 shrink-0">
                            {can.edit && (
                                <>
                                    <Link href={`/material-demands/${demand.id}/edit`} className="btn-outline btn-sm">
                                        <i className="fi fi-rr-edit text-xs leading-none" /> Edit
                                    </Link>
                                    <button type="button" onClick={withdraw} className="btn-ghost btn-sm text-red-600 hover:bg-red-50">
                                        <i className="fi fi-rr-cross-circle text-xs leading-none" /> Withdraw
                                    </button>
                                </>
                            )}
                        </div>
                    </div>
                </div>

                {/* PCD's answer, or what PCD can do */}
                {can.decide && (
                    <div className="card border-l-4 border-brand-500">
                        <div className="card-body flex flex-col md:flex-row md:items-center gap-4">
                            <div className="flex-1 min-w-0">
                                <h3 className="text-sm font-bold text-surface-900">Waiting for PCD</h3>
                                <p className="text-xs text-surface-600 mt-0.5">
                                    Raise a material requisition to the store from these lines — you can still adjust them there — or reject the demand with a reason.
                                </p>
                            </div>
                            <div className="flex gap-2 shrink-0">
                                <button type="button" onClick={reject} className="btn-outline btn-sm text-red-600 hover:bg-red-50">
                                    <i className="fi fi-rr-cross-circle text-xs leading-none" /> Reject
                                </button>
                                <Link href={`/pcd/material-requisitions/create?demand_id=${demand.id}`} className="btn-primary btn-sm">
                                    <i className="fi fi-rr-clipboard-list text-xs leading-none" /> Raise MR from this
                                </Link>
                            </div>
                        </div>
                    </div>
                )}
                {!can.decide && demand.status === 'submitted' && (
                    <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                        With PCD — waiting for them to raise the requisition to the store.
                    </div>
                )}
                {demand.status === 'rejected' && (
                    <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
                        <b>Rejected by {demand.decided_by ?? 'PCD'}</b>{demand.decided_at ? ` on ${demand.decided_at}` : ''}: {demand.reject_reason}
                    </div>
                )}
                {demand.status === 'cancelled' && (
                    <div className="rounded-xl border border-surface-200 bg-surface-50 px-4 py-3 text-sm text-surface-700">
                        Withdrawn{demand.decided_by ? ` by ${demand.decided_by}` : ''}{demand.decided_at ? ` on ${demand.decided_at}` : ''}.
                    </div>
                )}
                {mr && (
                    <div className="card">
                        <div className="card-body flex flex-col sm:flex-row sm:items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-sky-50 text-sky-600 grid place-items-center shrink-0">
                                <i className="fi fi-rr-clipboard-list" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-sm text-surface-900">
                                    PCD raised <span className="font-mono font-semibold">{mr.mrn_number}</span>
                                    {demand.decided_by && <> ({demand.decided_by}{demand.decided_at ? `, ${demand.decided_at}` : ''})</>}
                                </p>
                                <p className="text-xs text-surface-500 mt-0.5">
                                    {mr.issued > 0 ? `${qty(mr.issued)} of ${qty(mr.required)} issued by the store` : 'Nothing issued by the store yet'}
                                </p>
                            </div>
                            <span className={`badge ${mrBadge(mr.status)} shrink-0`}>{mrLabel(mr.status)}</span>
                            {can.decide && (
                                <Link href={`/pcd/material-requisitions/${mr.id}`} className="btn-outline btn-sm shrink-0">Open MR</Link>
                            )}
                        </div>
                    </div>
                )}

                <div className="card">
                    <div className="card-header">
                        <h3 className="text-sm font-bold text-surface-900">Material asked for</h3>
                    </div>
                    <div className="card-body p-0 overflow-x-auto">
                        <table className="premium-table w-full min-w-[700px]">
                            <thead>
                                <tr>
                                    <th className="w-10">#</th>
                                    <th>Material</th>
                                    <th>Size / spec</th>
                                    <th className="text-right w-32">Quantity</th>
                                    <th>Why / remarks</th>
                                </tr>
                            </thead>
                            <tbody>
                                {demand.items.map((i: any, n: number) => (
                                    <tr key={i.id} className="align-top">
                                        <td className="text-center text-xs font-semibold text-surface-500">{n + 1}</td>
                                        <td className="font-semibold text-surface-900">{i.material}</td>
                                        <td className="text-surface-700 whitespace-pre-line">{i.description || <span className="text-surface-300">—</span>}</td>
                                        <td className="text-right font-mono">{qty(i.quantity)} <span className="text-xs text-surface-400">{i.unit}</span></td>
                                        <td className="text-surface-600 text-xs">{i.remarks || <span className="text-surface-300">—</span>}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

                {demand.notes && (
                    <div className="card">
                        <div className="card-header"><h3 className="text-sm font-bold text-surface-900">Note to PCD</h3></div>
                        <div className="card-body"><p className="text-sm text-surface-700 whitespace-pre-line">{demand.notes}</p></div>
                    </div>
                )}

                <Link href="/material-demands" className="btn-ghost btn-sm">
                    <i className="fi fi-rr-arrow-left text-xs leading-none" /> All demands
                </Link>
            </div>
        </AppLayout>
    );
}
