import AppLayout from '@/Layouts/AppLayout';
import { Link } from '@inertiajs/react';
import { useState } from 'react';
import PdfPopupModal from '@/Components/PdfPopupModal';

const STATUS_DOT: Record<string, string> = {
    amber: 'bg-amber-500', blue: 'bg-blue-500', indigo: 'bg-indigo-500',
    yellow: 'bg-yellow-500', orange: 'bg-orange-500', teal: 'bg-teal-500',
    green: 'bg-emerald-500', red: 'bg-rose-500', gray: 'bg-surface-400',
};
const SECTION_STATUS_BADGE: Record<string, string> = {
    pending: 'bg-surface-100 text-surface-600',
    ready:   'bg-amber-100 text-amber-700',
    in_progress: 'bg-blue-100 text-blue-700',
    completed: 'bg-emerald-100 text-emerald-700',
    skipped: 'bg-surface-100 text-surface-500',
};

export default function IedJobShow({ job }: any) {
    const [pdfPopup, setPdfPopup] = useState<{ open: boolean; url: string | null; title: string }>({
        open: false, url: null, title: '',
    });
    const dot = STATUS_DOT[job.status_color] ?? 'bg-surface-400';

    return (
        <AppLayout header={`Job ${job.job_number ?? job.wo_number}`}>
            <div className="space-y-5 max-w-6xl animate-fade-in">
                {/* Header */}
                <div className="card">
                    <div className="card-body flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
                        <div>
                            <div className="text-[10px] uppercase tracking-wider text-surface-400 font-bold mb-1">Job — IED View (read-only)</div>
                            <div className="flex flex-wrap items-center gap-2">
                                <h2 className="text-xl font-bold text-surface-900 font-mono">
                                    {job.job_number ? `Job #${job.job_number}` : job.wo_number}
                                </h2>
                                <span className="font-mono text-xs px-2 py-0.5 rounded-md bg-surface-100 text-surface-700">{job.wo_number}</span>
                                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-surface-100 text-xs">
                                    <span className={`w-1.5 h-1.5 rounded-full ${dot}`} />
                                    <span className="font-semibold text-surface-700">{job.status_label}</span>
                                </span>
                                {job.source === 'customer_portal' && (
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-violet-50 text-violet-700 border border-violet-200 text-[10px] font-bold uppercase">
                                        <i className="fi fi-rr-building text-[9px]" /> Customer-issued
                                    </span>
                                )}
                            </div>
                            <p className="text-sm text-surface-700 mt-1">{job.customer?.name}</p>
                            <div className="flex flex-wrap items-center gap-3 mt-2 text-xs text-surface-500">
                                <span>Submitted {job.created_at}</span>
                                {job.created_by && <span>· by {job.created_by}</span>}
                                {job.rfq_id && <span>· RFQ #{job.rfq_id}</span>}
                                {job.quotation_id && <span>· Q-{String(job.quotation_id).padStart(5, '0')}</span>}
                            </div>
                        </div>
                        <Link href="/ied/jobs" className="btn-ghost btn-sm shrink-0">
                            <i className="fi fi-rr-arrow-left text-xs leading-none" /> Jobs
                        </Link>
                    </div>
                </div>

                {/* Progress strip */}
                <div className="card">
                    <div className="card-body">
                        <div className="flex items-center justify-between text-[11px] uppercase tracking-wider font-bold text-surface-400 mb-1.5">
                            <span>Production Progress</span>
                            <span>{Math.round(job.progress_pct ?? 0)}%</span>
                        </div>
                        <div className="h-2 rounded-full bg-surface-100 overflow-hidden">
                            <div className={`h-full ${dot} transition-all`} style={{ width: `${Math.min(100, job.progress_pct ?? 0)}%` }} />
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
                    {/* Left: items + section flow */}
                    <div className="lg:col-span-2 space-y-4">
                        {/* Job items */}
                        <div className="card">
                            <div className="card-header">
                                <h3 className="text-sm font-bold text-surface-900">Job Items ({job.items?.length ?? 0})</h3>
                            </div>
                            <div className="card-body !p-0 overflow-x-auto">
                                <table className="w-full">
                                    <thead>
                                        <tr>
                                            <th className="px-4 py-2 text-left text-[10px] font-semibold text-surface-400 uppercase tracking-wider">Job #</th>
                                            <th className="px-4 py-2 text-left text-[10px] font-semibold text-surface-400 uppercase tracking-wider">Description</th>
                                            <th className="px-4 py-2 text-right text-[10px] font-semibold text-surface-400 uppercase tracking-wider">Qty</th>
                                            <th className="px-4 py-2 text-left text-[10px] font-semibold text-surface-400 uppercase tracking-wider">Status</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-surface-100">
                                        {(job.items ?? []).map((it: any) => (
                                            <tr key={it.id}>
                                                <td className="px-4 py-3 font-mono text-xs text-surface-600">{it.job_number ?? <span className="text-surface-300 italic">—</span>}</td>
                                                <td className="px-4 py-3 text-sm text-surface-900">
                                                    {it.description}
                                                    {it.product && <div className="text-[11px] text-surface-500">{it.product}</div>}
                                                </td>
                                                <td className="px-4 py-3 text-right font-mono text-sm tabular-nums">{it.quantity} {it.unit}</td>
                                                <td className="px-4 py-3 text-xs capitalize">{it.status?.replace(/_/g, ' ')}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        {/* Section flow */}
                        {(job.sections ?? []).length > 0 && (
                            <div className="card">
                                <div className="card-header">
                                    <h3 className="text-sm font-bold text-surface-900">Routing</h3>
                                    <p className="text-xs text-surface-400 mt-0.5">{job.sections.length} stops · set by PCD</p>
                                </div>
                                <div className="card-body space-y-2">
                                    {job.sections.map((s: any) => (
                                        <div key={s.id} className="flex items-center gap-3 p-2.5 rounded-lg border border-surface-100">
                                            <span className="inline-flex items-center justify-center w-7 h-7 rounded-md bg-surface-100 text-surface-700 text-xs font-bold">
                                                {s.sequence}
                                            </span>
                                            <div className="flex-1 min-w-0">
                                                <div className="text-sm font-semibold text-surface-900">{s.name}</div>
                                                <div className="text-[11px] text-surface-500">{s.code}</div>
                                                {s.notes && <div className="text-[11px] text-surface-500 mt-1 italic">"{s.notes}"</div>}
                                            </div>
                                            <span className={`px-2 py-0.5 rounded-md text-[10px] font-semibold capitalize ${SECTION_STATUS_BADGE[s.status] ?? 'bg-surface-100 text-surface-600'}`}>
                                                {s.status?.replace(/_/g, ' ')}
                                            </span>
                                            {s.completed_at && (
                                                <div className="text-[10px] text-surface-400 shrink-0">{s.completed_at}</div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Notes */}
                        {job.notes && (
                            <div className="card">
                                <div className="card-header"><h3 className="text-sm font-bold text-surface-900">Notes</h3></div>
                                <div className="card-body text-sm text-surface-700 whitespace-pre-line leading-relaxed">
                                    {job.notes}
                                </div>
                            </div>
                        )}

                        {/* Attachments — RFQ PDF, Quotation PDF, Customer WO, and any extras */}
                        {(job.attachments ?? []).length > 0 && (
                            <div className="card">
                                <div className="card-header">
                                    <h3 className="text-sm font-bold text-surface-900">Attachments</h3>
                                    <p className="text-xs text-surface-400 mt-0.5">Source documents for this job</p>
                                </div>
                                <div className="card-body space-y-2">
                                    {job.attachments.map((f: any) => {
                                        const accent = (() => {
                                            switch (f.kind) {
                                                case 'rfq_letter':           return { bg: 'bg-blue-50',    text: 'text-blue-600',    icon: 'fi-rr-envelope' };
                                                case 'cost_estimate':        return { bg: 'bg-purple-50',  text: 'text-purple-600',  icon: 'fi-rr-calculator' };
                                                case 'quotation_pdf':        return { bg: 'bg-emerald-50', text: 'text-emerald-600', icon: 'fi-rr-receipt' };
                                                case 'customer_work_order':  return { bg: 'bg-amber-50',   text: 'text-amber-600',   icon: 'fi-rr-clipboard-list' };
                                                default:                     return { bg: 'bg-rose-50',    text: 'text-rose-600',    icon: 'fi-rr-file-pdf' };
                                            }
                                        })();
                                        return (
                                            <button
                                                key={f.id}
                                                type="button"
                                                onClick={() => {
                                                    if (!f.url) return;
                                                    const sep = f.url.includes('?') ? '&' : '?';
                                                    const ext = (f.extension ?? '').toLowerCase();
                                                    if (ext === '' || ext === 'pdf') {
                                                        setPdfPopup({ open: true, url: `${f.url}${sep}preview=base64`, title: f.title });
                                                    } else {
                                                        window.open(`${f.url}${sep}preview=1`, '_blank', 'noreferrer');
                                                    }
                                                }}
                                                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg border border-surface-200 hover:border-brand-300 hover:bg-brand-50/40 transition-colors text-left group"
                                            >
                                                <div className={`w-10 h-10 rounded-lg ${accent.bg} ${accent.text} flex items-center justify-center shrink-0`}>
                                                    <i className={`fi ${accent.icon} text-base leading-none`} />
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <div className="text-sm font-semibold text-surface-900 truncate">{f.title}</div>
                                                    {f.subtitle && (
                                                        <div className="text-[11px] text-surface-500 truncate">{f.subtitle}</div>
                                                    )}
                                                </div>
                                                <i className="fi fi-rr-arrow-up-right-from-square text-[10px] text-surface-400 group-hover:text-brand-600 shrink-0" />
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Right: facts */}
                    <div className="space-y-4">
                        <div className="card">
                            <div className="card-header"><h3 className="text-xs font-bold text-surface-900 uppercase tracking-wider">Details</h3></div>
                            <div className="card-body space-y-3 text-sm">
                                <div>
                                    <dt className="text-[10px] uppercase tracking-wider text-surface-400 font-bold">Customer</dt>
                                    <dd className="font-semibold text-surface-900">{job.customer?.name}</dd>
                                    {job.customer?.email && <dd className="text-[11px] text-surface-500">{job.customer.email}</dd>}
                                </div>
                                {job.customer_po_no && (
                                    <div>
                                        <dt className="text-[10px] uppercase tracking-wider text-surface-400 font-bold">Customer PO</dt>
                                        <dd className="font-mono font-semibold text-surface-800">{job.customer_po_no}</dd>
                                    </div>
                                )}
                                {job.due_date && (
                                    <div>
                                        <dt className="text-[10px] uppercase tracking-wider text-surface-400 font-bold">Due Date</dt>
                                        <dd className="font-semibold text-surface-800">{job.due_date}</dd>
                                    </div>
                                )}
                                <div>
                                    <dt className="text-[10px] uppercase tracking-wider text-surface-400 font-bold">Priority</dt>
                                    <dd className="capitalize font-semibold text-surface-800">{job.priority}</dd>
                                </div>
                                <div>
                                    <dt className="text-[10px] uppercase tracking-wider text-surface-400 font-bold">Quantity</dt>
                                    <dd className="font-semibold text-surface-800">{job.quantity}</dd>
                                </div>
                                {job.pcd_handoff_at && (
                                    <div className="pt-3 border-t border-surface-100">
                                        <dt className="text-[10px] uppercase tracking-wider text-surface-400 font-bold">Forwarded to PCD</dt>
                                        <dd className="text-xs text-surface-700">{job.pcd_handoff_at}</dd>
                                        {job.pcd_handoff_by && <dd className="text-[11px] text-surface-500">by {job.pcd_handoff_by}</dd>}
                                    </div>
                                )}
                                {(job.rfq_id || job.quotation_id) && (
                                    <div className="pt-3 border-t border-surface-100 space-y-1.5">
                                        {job.rfq_id && (
                                            <Link href={`/rfqs/${job.rfq_id}`} className="block text-xs text-brand-600 hover:underline">
                                                <i className="fi fi-rr-arrow-up-right-from-square text-[10px] mr-1" />
                                                Open RFQ #{job.rfq_id}
                                            </Link>
                                        )}
                                        {job.quotation_id && (
                                            <Link href={`/quotations/${job.quotation_id}`} className="block text-xs text-brand-600 hover:underline">
                                                <i className="fi fi-rr-arrow-up-right-from-square text-[10px] mr-1" />
                                                Open Quotation
                                            </Link>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <PdfPopupModal
                open={pdfPopup.open}
                pdfUrl={pdfPopup.url}
                title={pdfPopup.title}
                onClose={() => setPdfPopup(s => ({ ...s, open: false }))}
            />
        </AppLayout>
    );
}
