import { Link, router } from '@inertiajs/react';
import { useState } from 'react';
import CustomerLayout from '@/Layouts/CustomerLayout';
import PdfPopupModal from '@/Components/PdfPopupModal';

const STATUS_BADGE: Record<string, string> = {
    draft:        'badge-slate',
    issued:       'badge-blue',
    acknowledged: 'badge-blue',
    paid:         'badge-green',
    overdue:      'badge-red',
};

const fmtBDT = (n: any) => `৳${Number(n ?? 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;

export default function CustomerInvoicesIndex({ invoices, filters, totals }: any) {
    const [search, setSearch] = useState(filters?.search ?? '');
    const [status, setStatus] = useState(filters?.status ?? '');
    const [previewInv, setPreviewInv] = useState<any>(null);

    const submit = (e: React.FormEvent) => {
        e.preventDefault();
        router.get('/customer/invoices', { search, status }, { preserveScroll: true, preserveState: true });
    };

    const rows = invoices?.data ?? [];

    return (
        <CustomerLayout title="Invoices">
            {/* Summary tiles */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <StatTile label="Total Invoices" value={totals.total_count} icon="fi-rr-receipt" gradient="from-blue-400 to-blue-600" />
                <StatTile label="Outstanding"    value={totals.outstanding_count} icon="fi-rr-time-check" gradient="from-amber-400 to-amber-600" sub={fmtBDT(totals.outstanding_sum)} />
                <StatTile label="Paid"           value={totals.paid_count} icon="fi-rr-badge-check" gradient="from-emerald-400 to-emerald-600" sub={fmtBDT(totals.paid_sum)} />
                <StatTile label="Paid (Total)"   value={fmtBDT(totals.paid_sum)} icon="fi-rr-coins" gradient="from-teal-400 to-teal-600" small />
            </div>

            <div className="card">
                <div className="card-header flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div>
                        <h2 className="text-sm font-semibold text-surface-800">All Invoices</h2>
                        <p className="text-xs text-surface-400 mt-0.5">Track billing and payment status</p>
                    </div>
                    <form onSubmit={submit} className="flex items-center gap-2 flex-wrap">
                        <input
                            type="text"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="form-input form-input-sm w-48"
                            placeholder="Search invoice / WO #"
                        />
                        <select
                            value={status}
                            onChange={(e) => setStatus(e.target.value)}
                            className="form-select form-input-sm w-40"
                        >
                            <option value="">All Status</option>
                            <option value="issued">Issued</option>
                            <option value="acknowledged">Acknowledged</option>
                            <option value="paid">Paid</option>
                            <option value="overdue">Overdue</option>
                        </select>
                        <button type="submit" className="btn-primary btn-sm">
                            <i className="fi fi-rr-search text-xs" /> Search
                        </button>
                    </form>
                </div>

                <div className="card-body p-0">
                    {rows.length === 0 ? (
                        <div className="empty-state">
                            <div className="empty-state-icon"><i className="fi fi-rr-receipt" /></div>
                            <p className="empty-state-title">No invoices found</p>
                            <p className="empty-state-text">Invoices are generated once your orders are delivered.</p>
                        </div>
                    ) : (
                        <table className="premium-table">
                            <thead>
                                <tr>
                                    <th>Invoice #</th>
                                    <th>Job #</th>
                                    <th>Product</th>
                                    <th className="text-right">Total</th>
                                    <th>Status</th>
                                    <th>Issued</th>
                                    <th>Paid</th>
                                    <th className="text-right w-24">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {rows.map((inv: any) => (
                                    <tr key={inv.id} className="group">
                                        <td>
                                            <Link href={`/customer/invoices/${inv.id}`} className="font-mono font-semibold text-brand-600 hover:underline">
                                                {inv.invoice_number}
                                            </Link>
                                        </td>
                                        <td>
                                            <div className="font-bold text-surface-900">{inv.job_number ?? '—'}</div>
                                            {inv.wo_number && (
                                                <div className="text-[11px] text-surface-400 font-mono mt-0.5">{inv.wo_number}</div>
                                            )}
                                        </td>
                                        <td className="text-surface-700 text-sm">{inv.product || '—'}</td>
                                        <td className="text-right font-mono font-semibold tabular-nums">{fmtBDT(inv.total_amount)}</td>
                                        <td>
                                            <span className={`badge ${STATUS_BADGE[inv.status] ?? 'badge-slate'}`}>{inv.status}</span>
                                        </td>
                                        <td className="text-xs text-surface-500">{inv.issued_date ?? '—'}</td>
                                        <td className="text-xs text-surface-500">{inv.paid_at ?? '—'}</td>
                                        <td>
                                            <div className="flex items-center justify-end gap-1.5">
                                                <button
                                                    type="button"
                                                    onClick={() => setPreviewInv(inv)}
                                                    className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-brand-600 hover:bg-brand-50 transition-colors"
                                                    title="Preview PDF"
                                                >
                                                    <i className="fi fi-rr-file-pdf text-sm leading-none" /> PDF
                                                </button>
                                                <Link
                                                    href={`/customer/invoices/${inv.id}`}
                                                    className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-surface-600 hover:bg-surface-100 hover:text-surface-800 transition-colors"
                                                >
                                                    <i className="fi fi-rr-eye text-sm leading-none" /> Details
                                                </Link>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>

            <PdfPopupModal
                open={previewInv !== null}
                pdfUrl={previewInv ? `/customer/invoices/${previewInv.id}/pdf` : null}
                title={previewInv ? `Invoice ${previewInv.invoice_number}` : 'Invoice'}
                subtitle={previewInv ? `Job #${previewInv.job_number ?? '—'}` : undefined}
                onClose={() => setPreviewInv(null)}
            />
        </CustomerLayout>
    );
}

function StatTile({ label, value, icon, gradient, sub, small }: any) {
    return (
        <div className="stat-card">
            <div className={`stat-icon shadow-lg bg-gradient-to-br ${gradient} text-white`}>
                <i className={`fi ${icon} leading-none`} />
            </div>
            <div className="min-w-0">
                <div className={`${small ? 'text-base font-bold' : 'stat-value'} tabular-nums truncate`} title={String(value)}>{value}</div>
                <p className="stat-label">{label}</p>
                {sub && <p className="text-[10px] text-surface-500 mt-0.5 truncate">{sub}</p>}
            </div>
        </div>
    );
}
