import AppLayout from '@/Layouts/AppLayout';
import { Link, router, useForm } from '@inertiajs/react';
import { useState } from 'react';

const fmt = (v: any) => Number(v ?? 0).toLocaleString('en-IN');

const TAB_CONFIG: Record<string, { label: string; icon: string; color: string }> = {
    pending:  { label: 'Pending',  icon: 'fi-rr-clock',        color: 'text-amber-600 bg-amber-50 border-amber-200' },
    approved: { label: 'Approved', icon: 'fi-rr-check-circle', color: 'text-emerald-600 bg-emerald-50 border-emerald-200' },
    rejected: { label: 'Rejected', icon: 'fi-rr-cross-circle', color: 'text-red-600 bg-red-50 border-red-200' },
};

function ApproveModal({ approval, onClose }: { approval: any; onClose: () => void }) {
    const { data, setData, post, processing } = useForm({ remarks: '' });
    const url = approval.type === 'estimate' ? `/approvals/estimate/${approval.id}/approve` : `/approvals/${approval.id}/approve`;
    const label = approval.type === 'estimate' ? 'Cost Estimate' : 'Quotation';
    return (
        <>
            <div className="fixed inset-0 z-[70] bg-black/50 backdrop-blur-sm animate-fade-in" onClick={onClose} />
            <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
                <div className="bg-white rounded-2xl shadow-premium-lg border border-surface-100 w-full max-w-md animate-scale-in overflow-hidden">
                    <div className="p-6">
                        <div className="w-14 h-14 rounded-2xl bg-emerald-50 flex items-center justify-center mx-auto mb-4">
                            <i className="fi fi-rr-check-circle text-emerald-500 text-2xl leading-none" />
                        </div>
                        <h3 className="text-lg font-bold text-surface-900 text-center">Approve {label}</h3>
                        <p className="text-sm text-surface-500 text-center mt-1">
                            {approval.ref_label} · {fmt(approval.amount)} BDT
                        </p>
                        <p className="text-xs text-surface-400 text-center mt-0.5">{approval.label} — {approval.customer}</p>
                        <div className="mt-4">
                            <label className="form-label">Remarks <span className="form-label-optional">(optional)</span></label>
                            <textarea value={data.remarks} onChange={e => setData('remarks', e.target.value)}
                                className="form-textarea" rows={3} placeholder="Add a note..." />
                        </div>
                    </div>
                    <div className="px-6 pb-6 flex gap-3">
                        <button onClick={onClose} className="btn-outline flex-1">Cancel</button>
                        <button onClick={() => post(url, { onSuccess: onClose })}
                            disabled={processing} className="btn-success flex-1">
                            <i className="fi fi-rr-check text-sm leading-none" /> {processing ? 'Approving...' : 'Approve'}
                        </button>
                    </div>
                </div>
            </div>
        </>
    );
}

function RejectModal({ approval, onClose }: { approval: any; onClose: () => void }) {
    const { data, setData, post, processing, errors } = useForm({ remarks: '' });
    const url = approval.type === 'estimate' ? `/approvals/estimate/${approval.id}/reject` : `/approvals/${approval.id}/reject`;
    const label = approval.type === 'estimate' ? 'Cost Estimate' : 'Quotation';
    return (
        <>
            <div className="fixed inset-0 z-[70] bg-black/50 backdrop-blur-sm animate-fade-in" onClick={onClose} />
            <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
                <div className="bg-white rounded-2xl shadow-premium-lg border border-surface-100 w-full max-w-md animate-scale-in overflow-hidden">
                    <div className="p-6">
                        <div className="w-14 h-14 rounded-2xl bg-red-50 flex items-center justify-center mx-auto mb-4">
                            <i className="fi fi-rr-cross-circle text-red-500 text-2xl leading-none" />
                        </div>
                        <h3 className="text-lg font-bold text-surface-900 text-center">Reject {label}</h3>
                        <p className="text-sm text-surface-500 text-center mt-1">
                            {approval.ref_label} · {fmt(approval.amount)} BDT
                        </p>
                        <div className="mt-4">
                            <label className="form-label">Reason for rejection <span className="text-red-500">*</span></label>
                            <textarea value={data.remarks} onChange={e => setData('remarks', e.target.value)}
                                className="form-textarea" rows={3} placeholder="Please provide a reason..." />
                            {errors.remarks && <p className="form-error">{errors.remarks}</p>}
                        </div>
                    </div>
                    <div className="px-6 pb-6 flex gap-3">
                        <button onClick={onClose} className="btn-outline flex-1">Cancel</button>
                        <button onClick={() => post(url, { onSuccess: onClose })}
                            disabled={processing || !data.remarks.trim()} className="btn-danger flex-1">
                            <i className="fi fi-rr-cross text-sm leading-none" /> {processing ? 'Rejecting...' : 'Reject'}
                        </button>
                    </div>
                </div>
            </div>
        </>
    );
}

export default function ApprovalsIndex({ approvals, counts, filters }: any) {
    const [search, setSearch] = useState(filters?.search ?? '');
    const [approveModal, setApproveModal] = useState<any>(null);
    const [rejectModal, setRejectModal] = useState<any>(null);
    const tab = filters?.tab ?? 'pending';

    const switchTab = (t: string) => {
        router.get('/approvals', { tab: t, search }, { preserveState: true, replace: true });
    };

    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault();
        router.get('/approvals', { tab, search }, { preserveState: true, replace: true });
    };

    return (
        <AppLayout header="Pending Approvals">
            <div className="space-y-6 animate-fade-in">

                <div className="page-header">
                    <div>
                        <h1 className="page-title">My Approvals</h1>
                        <p className="page-subtitle">Quotations assigned to you for approval</p>
                    </div>
                </div>

                {/* Tab chips */}
                <div className="flex flex-wrap gap-3">
                    {Object.entries(TAB_CONFIG).map(([key, cfg]) => (
                        <button key={key} onClick={() => switchTab(key)}
                            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border text-sm font-semibold transition-all
                                ${tab === key
                                    ? `${cfg.color} ring-2 ring-offset-1 ring-current shadow-sm`
                                    : 'bg-white border-surface-200 text-surface-600 hover:border-surface-300'}`}>
                            <i className={`fi ${cfg.icon} text-sm leading-none`} />
                            {cfg.label}
                            <span className={`ml-1 px-1.5 py-0.5 rounded-md text-[10px] font-bold ${tab === key ? 'bg-white/80 text-inherit' : 'bg-surface-100 text-surface-500'}`}>
                                {counts[key] ?? 0}
                            </span>
                        </button>
                    ))}
                </div>

                <div className="card transition-all duration-300 hover:shadow-premium-lg">
                    {/* Search */}
                    <div className="px-4 sm:px-5 py-3.5 border-b border-surface-100">
                        <form onSubmit={handleSearch} className="flex gap-2.5">
                            <div className="relative flex-1">
                                <i className="fi fi-rr-search absolute left-3 top-1/2 -translate-y-1/2 text-surface-400 text-xs" />
                                <input type="text" value={search} onChange={e => setSearch(e.target.value)}
                                    placeholder="Search by quotation ID or customer..."
                                    className="form-input !pl-9 !py-2 text-sm w-full" />
                            </div>
                            <button type="submit" className="btn-primary btn-sm">
                                <i className="fi fi-rr-search text-xs leading-none" /> Search
                            </button>
                        </form>
                    </div>

                    {/* Desktop table */}
                    <div className="hidden lg:block overflow-x-auto">
                        {approvals.data?.length > 0 ? (
                            <table className="premium-table">
                                <thead>
                                    <tr>
                                        <th className="w-36">Reference</th>
                                        <th>Customer / Description</th>
                                        <th className="w-28 text-right">Amount</th>
                                        <th className="w-20 text-center">Role</th>
                                        <th className="w-28">By</th>
                                        <th className="w-28">Date</th>
                                        {tab === 'pending' && <th className="w-48 text-right">Actions</th>}
                                        {tab !== 'pending' && <th className="w-36">Decision</th>}
                                    </tr>
                                </thead>
                                <tbody>
                                    {approvals.data.map((a: any) => (
                                        <tr key={`${a.type}-${a.id}`} className="group">
                                            <td>
                                                <Link href={a.ref_url}>
                                                    <span className="font-mono text-sm font-bold text-brand-600 group-hover:underline">{a.ref_label}</span>
                                                </Link>
                                                <div className="mt-0.5">
                                                    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-semibold border ${
                                                        a.type === 'estimate' ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-purple-50 text-purple-700 border-purple-200'
                                                    }`}>
                                                        {a.type === 'estimate' ? '📐 Estimate' : '💰 Quotation'}
                                                    </span>
                                                </div>
                                            </td>
                                            <td>
                                                <div className="font-semibold text-surface-900 text-sm">{a.customer}</div>
                                                <div className="text-xs text-surface-400 truncate max-w-[200px]">{a.description}</div>
                                            </td>
                                            <td className="text-right">
                                                <span className="font-mono text-sm font-bold text-surface-900">{fmt(a.amount)}</span>
                                            </td>
                                            <td className="text-center">
                                                <span className="inline-flex items-center justify-center px-2 py-1 rounded-md bg-surface-100 text-surface-600 text-[10px] font-bold">
                                                    {a.label}
                                                </span>
                                            </td>
                                            <td className="text-xs text-surface-600">{a.created_by}</td>
                                            <td className="text-xs text-surface-500">{a.acted_at ?? a.created_at}</td>
                                            {tab === 'pending' && (
                                                <td>
                                                    <div className="flex items-center justify-end gap-1.5">
                                                        <Link href={a.ref_url} title={`View full ${a.type === 'estimate' ? 'cost estimate' : 'quotation'}`}
                                                            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-surface-600 hover:bg-surface-100 transition-colors">
                                                            <i className="fi fi-rr-eye text-sm leading-none" /> View
                                                        </Link>
                                                        <button onClick={() => setApproveModal(a)} title="Approve this quotation"
                                                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 transition-colors">
                                                            <i className="fi fi-rr-check text-sm leading-none" /> Approve
                                                        </button>
                                                        <button onClick={() => setRejectModal(a)} title="Reject this quotation"
                                                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-red-600 bg-red-50 border border-red-200 hover:bg-red-100 transition-colors">
                                                            <i className="fi fi-rr-cross text-sm leading-none" /> Reject
                                                        </button>
                                                    </div>
                                                </td>
                                            )}
                                            {tab !== 'pending' && (
                                                <td>
                                                    <div>
                                                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold border ${
                                                            a.status === 'approved' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-red-50 text-red-700 border-red-200'
                                                        }`}>
                                                            <i className={`fi ${a.status === 'approved' ? 'fi-rr-check-circle' : 'fi-rr-cross-circle'} leading-none`} />
                                                            {a.status === 'approved' ? 'Approved' : 'Rejected'}
                                                        </span>
                                                        {a.remarks && <div className="text-[10px] text-surface-400 mt-1 truncate max-w-[140px]" title={a.remarks}>{a.remarks}</div>}
                                                    </div>
                                                </td>
                                            )}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        ) : (
                            <div className="empty-state">
                                <div className="empty-state-icon"><i className={`fi ${TAB_CONFIG[tab]?.icon ?? 'fi-rr-clock'}`} /></div>
                                <div className="empty-state-title">
                                    {tab === 'pending' ? 'No pending approvals' : `No ${tab} quotations`}
                                </div>
                                <div className="empty-state-text">
                                    {tab === 'pending' ? "You're all caught up! No quotations need your attention." : `You haven't ${tab} any quotations yet.`}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Mobile cards */}
                    <div className="lg:hidden px-4 pb-4 pt-3 space-y-3">
                        {approvals.data?.length > 0 ? approvals.data.map((a: any) => (
                            <div key={`${a.type}-${a.id}`} className="rounded-xl border border-surface-100 bg-white p-4 space-y-3">
                                <div className="flex items-start justify-between gap-2">
                                    <Link href={a.ref_url} className="min-w-0">
                                        <div className="flex items-center gap-2">
                                            <span className="font-mono text-sm font-bold text-brand-600">{a.ref_label}</span>
                                            <span className={`px-1.5 py-0.5 rounded text-[8px] font-bold border ${
                                                a.type === 'estimate' ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-purple-50 text-purple-700 border-purple-200'
                                            }`}>{a.type === 'estimate' ? 'EST' : 'QTN'}</span>
                                        </div>
                                        <div className="font-semibold text-surface-900 text-sm mt-0.5">{a.customer}</div>
                                        <div className="text-xs text-surface-400 truncate">{a.description}</div>
                                    </Link>
                                    <span className="font-mono font-bold text-surface-900 shrink-0">{fmt(a.amount)}</span>
                                </div>
                                {tab === 'pending' ? (
                                    <div className="flex gap-2 pt-2 border-t border-surface-100">
                                        <button onClick={() => setApproveModal(a)}
                                            className="flex-1 py-2 rounded-xl text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 text-center transition-colors">
                                            <i className="fi fi-rr-check leading-none mr-1" /> Approve
                                        </button>
                                        <button onClick={() => setRejectModal(a)}
                                            className="flex-1 py-2 rounded-xl text-xs font-semibold text-red-600 bg-red-50 border border-red-200 hover:bg-red-100 text-center transition-colors">
                                            <i className="fi fi-rr-cross leading-none mr-1" /> Reject
                                        </button>
                                    </div>
                                ) : (
                                    <div className="flex items-center justify-between pt-2 border-t border-surface-100 text-[10px]">
                                        <span className={a.status === 'approved' ? 'text-emerald-600 font-semibold' : 'text-red-600 font-semibold'}>
                                            {a.status === 'approved' ? '✅ Approved' : '❌ Rejected'} · {a.approved_at}
                                        </span>
                                    </div>
                                )}
                            </div>
                        )) : (
                            <div className="empty-state">
                                <div className="empty-state-icon"><i className="fi fi-rr-clock" /></div>
                                <div className="empty-state-title">{tab === 'pending' ? 'All clear!' : 'Nothing here'}</div>
                            </div>
                        )}
                    </div>

                    {/* Pagination */}
                    {approvals?.last_page > 1 && (
                        <div className="pagination">
                            <div className="pagination-info">Showing {approvals.from}–{approvals.to} of {approvals.total}</div>
                            <div className="pagination-controls">
                                {approvals.links.map((link: any, i: number) => {
                                    if (link.label.includes('Previous')) return <Link key={i} href={link.url ?? '#'} className={`pagination-btn ${!link.url ? 'opacity-40 pointer-events-none' : ''}`} preserveState><i className="fi fi-rr-angle-left text-xs leading-none" /></Link>;
                                    if (link.label.includes('Next')) return <Link key={i} href={link.url ?? '#'} className={`pagination-btn ${!link.url ? 'opacity-40 pointer-events-none' : ''}`} preserveState><i className="fi fi-rr-angle-right text-xs leading-none" /></Link>;
                                    return <Link key={i} href={link.url ?? '#'} className={`pagination-btn ${link.active ? 'pagination-btn-active' : ''}`} preserveState dangerouslySetInnerHTML={{ __html: link.label }} />;
                                })}
                            </div>
                        </div>
                    )}
                </div>

                {/* Modals */}
                {approveModal && <ApproveModal approval={approveModal} onClose={() => setApproveModal(null)} />}
                {rejectModal && <RejectModal approval={rejectModal} onClose={() => setRejectModal(null)} />}
            </div>
        </AppLayout>
    );
}
