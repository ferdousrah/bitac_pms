import AppLayout from '@/Layouts/AppLayout';
import { Link, useForm } from '@inertiajs/react';

export default function MRPShow({ workOrder, mrpItems, imsAvailable, canRunMrp }: any) {
    const { post, processing } = useForm({});

    const items = mrpItems ?? [];
    const hasShortage = items.some((i: any) => i.available === false);

    return (
        <AppLayout header={`MRP — ${workOrder.wo_number}`}>
            <div className="max-w-5xl animate-fade-in space-y-6">
                {/* Header */}
                <div className="card">
                    <div className="card-body">
                        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                            <div>
                                <div className="text-xs uppercase text-surface-400 font-semibold tracking-wide">
                                    Material Requirements Planning
                                </div>
                                <h2 className="text-lg font-bold text-surface-900 mt-1">
                                    {workOrder.wo_number}{' '}
                                    <span className="text-surface-500 font-normal">— {workOrder.product}</span>
                                </h2>
                                <p className="text-sm text-surface-500 mt-1">
                                    Qty: <span className="font-mono text-surface-700">{workOrder.quantity}</span>
                                    {' | '}
                                    Customer:{' '}
                                    <span className="text-surface-700">{workOrder.customer}</span>
                                </p>
                            </div>
                            <div className="flex flex-wrap items-center gap-3">
                                {!imsAvailable && (
                                    <span className="badge badge-amber">
                                        <i className="fi fi-rr-triangle-warning text-xs leading-none" />
                                        IMS offline — manual check
                                    </span>
                                )}
                                {canRunMrp && (
                                    <button
                                        onClick={() => post(`/mrp/${workOrder.id}/run`)}
                                        disabled={processing}
                                        className="btn-primary btn-sm"
                                    >
                                        <i className="fi fi-rr-calculator text-xs leading-none" />
                                        {processing ? 'Calculating...' : 'Run MRP'}
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                {hasShortage && (
                    <div className="alert alert-warning">
                        <i className="fi fi-rr-triangle-warning text-sm leading-none" />
                        <div>
                            <div className="font-semibold">Material shortage detected</div>
                            <div className="text-xs opacity-80 mt-0.5">
                                Create requisition notes to procure the required materials.
                            </div>
                        </div>
                    </div>
                )}

                {/* BOM Table */}
                <div className="card">
                    <div className="card-header">
                        <h3 className="text-base font-bold text-surface-900">BOM Requirements</h3>
                        <p className="text-xs text-surface-400 mt-0.5">
                            Per-unit requirements scaled to work order quantity
                        </p>
                    </div>

                    {items.length > 0 ? (
                        <>
                            {/* Desktop */}
                            <div className="card-body hidden lg:block overflow-x-auto">
                                <table className="premium-table">
                                    <thead>
                                        <tr>
                                            <th>Material</th>
                                            <th>BOM Qty/Unit</th>
                                            <th>Required</th>
                                            <th>IMS Stock</th>
                                            <th>Status</th>
                                            <th>Lead Time</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {items.map((item: any) => (
                                            <tr key={item.id}>
                                                <td>
                                                    <div className="font-semibold text-surface-900 text-sm">
                                                        {item.material_name}
                                                    </div>
                                                    <div className="text-xs text-surface-400 font-mono">
                                                        {item.material_code}
                                                    </div>
                                                </td>
                                                <td className="font-mono text-surface-700">
                                                    {item.bom_qty} {item.unit}
                                                </td>
                                                <td className="font-mono font-semibold text-surface-900">
                                                    {item.required_qty} {item.unit}
                                                </td>
                                                <td className="font-mono text-surface-700">
                                                    {imsAvailable ? (
                                                        item.stock_qty ?? '--'
                                                    ) : (
                                                        <span className="text-surface-300">N/A</span>
                                                    )}
                                                </td>
                                                <td>
                                                    {imsAvailable ? (
                                                        <span
                                                            className={`badge ${
                                                                item.available ? 'badge-green' : 'badge-red'
                                                            }`}
                                                        >
                                                            {item.available ? 'In Stock' : 'Shortage'}
                                                        </span>
                                                    ) : (
                                                        <span className="badge badge-slate">Manual</span>
                                                    )}
                                                </td>
                                                <td className="text-surface-600 text-sm">
                                                    {item.lead_time_days ? `${item.lead_time_days}d` : '--'}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                            {/* Mobile */}
                            <div className="card-body lg:hidden space-y-3">
                                {items.map((item: any) => (
                                    <div
                                        key={item.id}
                                        className="rounded-xl border border-surface-100 p-4 space-y-3 animate-slide-up"
                                    >
                                        <div className="flex items-start justify-between gap-2">
                                            <div>
                                                <div className="font-semibold text-surface-900 text-sm">
                                                    {item.material_name}
                                                </div>
                                                <div className="text-xs text-surface-400 font-mono">
                                                    {item.material_code}
                                                </div>
                                            </div>
                                            {imsAvailable ? (
                                                <span
                                                    className={`badge ${
                                                        item.available ? 'badge-green' : 'badge-red'
                                                    }`}
                                                >
                                                    {item.available ? 'In Stock' : 'Shortage'}
                                                </span>
                                            ) : (
                                                <span className="badge badge-slate">Manual</span>
                                            )}
                                        </div>

                                        <div className="grid grid-cols-2 gap-2 text-xs">
                                            <div>
                                                <div className="text-surface-400">BOM Qty/Unit</div>
                                                <div className="font-mono text-surface-700">
                                                    {item.bom_qty} {item.unit}
                                                </div>
                                            </div>
                                            <div>
                                                <div className="text-surface-400">Required</div>
                                                <div className="font-mono font-semibold text-surface-900">
                                                    {item.required_qty} {item.unit}
                                                </div>
                                            </div>
                                            <div>
                                                <div className="text-surface-400">IMS Stock</div>
                                                <div className="font-mono text-surface-700">
                                                    {imsAvailable ? item.stock_qty ?? '--' : 'N/A'}
                                                </div>
                                            </div>
                                            <div>
                                                <div className="text-surface-400">Lead Time</div>
                                                <div className="text-surface-700">
                                                    {item.lead_time_days ? `${item.lead_time_days}d` : '--'}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </>
                    ) : (
                        <div className="card-body">
                            <div className="empty-state">
                                <div className="empty-state-icon">
                                    <i className="fi fi-rr-box-open" />
                                </div>
                                <div className="empty-state-title">No BOM items found</div>
                                <div className="empty-state-text">
                                    <Link
                                        href={`/work-orders/${workOrder.id}`}
                                        className="text-brand-600 hover:underline"
                                    >
                                        Check product BOM
                                    </Link>{' '}
                                    on the work order.
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Actions */}
                <div className="flex flex-wrap items-center gap-3">
                    {canRunMrp && items.length > 0 && (
                        <button
                            onClick={() => post(`/mrp/${workOrder.id}/create-requisition`)}
                            disabled={processing}
                            className="btn-success btn-sm"
                        >
                            <i className="fi fi-rr-clipboard-list text-xs leading-none" />
                            Create Material Requisition Notes
                        </button>
                    )}
                    <Link href={`/work-orders/${workOrder.id}`} className="btn-outline btn-sm">
                        <i className="fi fi-rr-arrow-left text-xs leading-none" />
                        Back to WO
                    </Link>
                </div>
            </div>
        </AppLayout>
    );
}
