import { Link } from '@inertiajs/react';
import CustomerLayout from '@/Layouts/CustomerLayout';

const STATUS_BADGE: Record<string, string> = {
    pending:  'badge-amber',
    quoted:   'badge-blue',
    accepted: 'badge-green',
    rejected: 'badge-slate',
};

const STATUS_LABEL: Record<string, string> = {
    pending:  'Pending Review',
    quoted:   'Quotation Sent',
    accepted: 'Accepted',
    rejected: 'Cancelled',
};

export default function CustomerRfqIndex({ rfqs }: any) {
    const rows = rfqs?.data ?? [];

    return (
        <CustomerLayout title="My RFQs">
            <div className="flex items-center justify-end">
                <Link href="/customer/rfqs/create" className="btn-primary btn-sm">
                    <i className="fi fi-rr-plus text-xs leading-none" /> New RFQ
                </Link>
            </div>

            <div className="card">
                <div className="card-header">
                    <h2 className="text-sm font-semibold text-surface-800">All RFQs</h2>
                    <p className="text-xs text-surface-400 mt-0.5">Request for Quotation history</p>
                </div>
                <div className="card-body p-0">
                    {rows.length === 0 ? (
                        <div className="empty-state">
                            <div className="empty-state-icon"><i className="fi fi-rr-file-invoice" /></div>
                            <p className="empty-state-title">No RFQs yet</p>
                            <p className="empty-state-text">Submit your first Request for Quotation to BITAC.</p>
                            <div className="mt-4">
                                <Link href="/customer/rfqs/create" className="btn-primary btn-sm">
                                    <i className="fi fi-rr-plus text-xs leading-none" /> Submit New RFQ
                                </Link>
                            </div>
                        </div>
                    ) : (
                        <table className="premium-table">
                            <thead>
                                <tr>
                                    <th>RFQ #</th>
                                    <th>Items</th>
                                    <th>Customer Ref</th>
                                    <th>Required By</th>
                                    <th>Status</th>
                                    <th>Submitted</th>
                                    <th></th>
                                </tr>
                            </thead>
                            <tbody>
                                {rows.map((r: any) => (
                                    <tr key={r.id}>
                                        <td>
                                            <Link href={`/customer/rfqs/${r.id}`} className="font-mono font-semibold text-brand-600 hover:underline">
                                                #{r.id}
                                            </Link>
                                        </td>
                                        <td className="max-w-[260px]">
                                            <div className="text-xs text-surface-700 truncate">
                                                {r.items_summary?.join(', ')}
                                                {r.item_count > 3 && <span className="text-surface-400"> · +{r.item_count - 3} more</span>}
                                            </div>
                                            <div className="text-[10px] text-surface-400 mt-0.5">{r.item_count} item{r.item_count > 1 ? 's' : ''}</div>
                                        </td>
                                        <td className="font-mono text-xs text-surface-500">{r.customer_ref_no ?? '—'}</td>
                                        <td className="text-xs text-surface-500">{r.required_by ?? '—'}</td>
                                        <td>
                                            <span className={`badge ${STATUS_BADGE[r.status] ?? 'badge-slate'}`}>
                                                {STATUS_LABEL[r.status] ?? r.status}
                                            </span>
                                        </td>
                                        <td className="text-xs text-surface-400">{r.created_at}</td>
                                        <td className="text-right">
                                            <Link href={`/customer/rfqs/${r.id}`} className="btn-outline btn-xs">
                                                View <i className="fi fi-rr-arrow-right text-[10px] leading-none" />
                                            </Link>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>
        </CustomerLayout>
    );
}
