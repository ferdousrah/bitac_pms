import AppLayout from '@/Layouts/AppLayout';
import { Link } from '@inertiajs/react';
import PdfPopupModal from '@/Components/PdfPopupModal';
import ProductionMessageThread from '@/Components/Production/ProductionMessageThread';
import { useState } from 'react';

const statusBadge: Record<string, string> = {
    pending: 'badge-slate',
    in_progress: 'badge-amber',
    completed: 'badge-green',
};

export default function OperationSheetShow({ sheet }: any) {
    const [pdfOpen, setPdfOpen] = useState(false);
    const steps = sheet.steps ?? [];

    return (
        <AppLayout header={`Operation Sheet — ${sheet.sheet_number}`}>
            <div className="max-w-5xl animate-fade-in space-y-6">
                {/* Header */}
                <div className="card">
                    <div className="card-body">
                        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                            <div>
                                <div className="text-xs uppercase text-surface-400 font-semibold tracking-wide">
                                    Operation Sheet
                                </div>
                                <h2 className="text-lg font-bold text-surface-900 mt-1 font-mono">
                                    {sheet.sheet_number}
                                </h2>
                                <p className="text-surface-600 text-sm mt-1">
                                    <Link
                                        href={`/work-orders/${sheet.work_order_id}`}
                                        className="font-mono text-brand-600 hover:underline"
                                    >
                                        Job# {sheet.work_order?.job_number ?? '—'}
                                    </Link>
                                    {' — '}
                                    {sheet.work_order?.product?.name}
                                </p>
                                <p className="text-surface-400 text-xs mt-0.5">
                                    Customer: {sheet.work_order?.customer?.name} | Qty:{' '}
                                    <span className="font-mono">{sheet.work_order?.quantity}</span>
                                </p>
                            </div>
                            <div className="flex flex-wrap gap-2">
                                <Link
                                    href={`/operation-sheets/${sheet.id}/edit`}
                                    className="btn-primary btn-sm"
                                >
                                    <i className="fi fi-rr-edit text-xs leading-none" />
                                    Edit
                                </Link>
                                <button
                                    type="button"
                                    onClick={() => setPdfOpen(true)}
                                    className="btn-danger btn-sm"
                                >
                                    <i className="fi fi-rr-file-pdf text-xs leading-none" />
                                    View PDF
                                </button>
                                {sheet.qr_code && (
                                    <a
                                        href={`data:image/svg+xml;base64,${sheet.qr_code}`}
                                        download={`${sheet.sheet_number}-qr.svg`}
                                        className="btn-outline btn-sm"
                                    >
                                        <i className="fi fi-rr-qrcode text-xs leading-none" />
                                        Download QR
                                    </a>
                                )}
                                <Link
                                    href={`/work-orders/${sheet.work_order_id}`}
                                    className="btn-ghost btn-sm"
                                >
                                    <i className="fi fi-rr-arrow-left text-xs leading-none" />
                                    Work Order
                                </Link>
                            </div>
                        </div>

                        {/* QR Code */}
                        {sheet.qr_code && (
                            <div className="mt-6 flex items-center gap-4 p-4 bg-surface-50 rounded-xl border border-surface-100">
                                <img
                                    src={`data:image/svg+xml;base64,${sheet.qr_code}`}
                                    alt="QR Code"
                                    className="w-24 h-24 rounded-lg bg-white p-1 border border-surface-200"
                                />
                                <div className="text-sm text-surface-600">
                                    <p className="font-semibold text-surface-900">Scan to view on mobile</p>
                                    <p className="text-xs text-surface-400 mt-1 font-mono">
                                        Sheet: {sheet.sheet_number}
                                    </p>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Steps */}
                <div className="card">
                    <div className="card-header flex items-center justify-between">
                        <div>
                            <h3 className="text-base font-bold text-surface-900">Operation Steps</h3>
                            <p className="text-xs text-surface-400 mt-0.5">
                                Sequence of operations defined for this work order
                            </p>
                        </div>
                    </div>

                    {steps.length > 0 ? (
                        <>
                            {/* Desktop table */}
                            <div className="card-body hidden lg:block overflow-x-auto">
                                <table className="premium-table">
                                    <thead>
                                        <tr>
                                            <th>Seq</th>
                                            <th>Operation</th>
                                            <th>Machine</th>
                                            <th>Section</th>
                                            <th>Status</th>
                                            <th>Notes</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {steps.map((step: any) => (
                                            <tr key={step.id}>
                                                <td>
                                                    <span className="w-7 h-7 rounded-full bg-brand-50 text-brand-600 text-xs font-bold inline-flex items-center justify-center">
                                                        {step.sequence_number}
                                                    </span>
                                                </td>
                                                <td className="font-semibold text-surface-900">
                                                    {step.operation_name}
                                                </td>
                                                <td className="text-surface-600">
                                                    {step.machine?.name ?? '--'}
                                                </td>
                                                <td className="text-surface-600">
                                                    {step.section?.name || '--'}
                                                </td>
                                                <td>
                                                    <span
                                                        className={`badge ${
                                                            statusBadge[step.status] ?? 'badge-slate'
                                                        }`}
                                                    >
                                                        {step.status}
                                                    </span>
                                                </td>
                                                <td className="text-xs text-surface-500 max-w-xs">
                                                    {step.notes ?? '--'}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                            {/* Mobile cards */}
                            <div className="card-body lg:hidden space-y-3">
                                {steps.map((step: any) => (
                                    <div
                                        key={step.id}
                                        className="rounded-xl border border-surface-100 p-4 space-y-3 animate-slide-up"
                                    >
                                        <div className="flex items-start justify-between gap-2">
                                            <div className="flex items-start gap-3">
                                                <span className="w-8 h-8 rounded-full bg-brand-50 text-brand-600 text-xs font-bold inline-flex items-center justify-center shrink-0">
                                                    {step.sequence_number}
                                                </span>
                                                <div>
                                                    <div className="font-semibold text-surface-900 text-sm">
                                                        {step.operation_name}
                                                    </div>
                                                    <div className="text-xs text-surface-500 mt-0.5">
                                                        {step.machine?.name ?? '--'}
                                                    </div>
                                                </div>
                                            </div>
                                            <span
                                                className={`badge ${
                                                    statusBadge[step.status] ?? 'badge-slate'
                                                }`}
                                            >
                                                {step.status}
                                            </span>
                                        </div>

                                        <div className="text-xs">
                                            <div className="text-surface-400">Section</div>
                                            <div className="text-surface-700">
                                                {step.section?.name || '--'}
                                            </div>
                                        </div>

                                        {step.notes && (
                                            <div className="text-xs text-surface-600 pt-2 border-t border-surface-50">
                                                {step.notes}
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>

                            {/* Footer summary */}
                            <div className="px-6 py-3 border-t border-surface-100 bg-surface-50 flex text-sm text-surface-500 rounded-b-2xl">
                                <span>{steps.length} steps</span>
                            </div>
                        </>
                    ) : (
                        <div className="card-body">
                            <div className="empty-state">
                                <div className="empty-state-icon">
                                    <i className="fi fi-rr-list" />
                                </div>
                                <div className="empty-state-title">No operation steps</div>
                                <div className="empty-state-text">
                                    This operation sheet does not have any steps defined yet.
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Production ↔ PCD query thread for this operation sheet */}
                <ProductionMessageThread
                    sheetId={sheet.id}
                    viewerRole="pcd"
                    title="Production Queries"
                    subtitle="Questions from the shop floor — reply with clarifications, revised drawings, or material confirmation."
                />
            </div>

            <PdfPopupModal
                open={pdfOpen}
                pdfUrl={pdfOpen ? `/operation-sheets/${sheet.id}/pdf?preview=base64` : null}
                title={`Operation Sheet ${sheet.sheet_number}`}
                subtitle={`Job# ${sheet.work_order?.job_number ?? '—'}`}
                onClose={() => setPdfOpen(false)}
            />
        </AppLayout>
    );
}
