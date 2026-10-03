import AppLayout from '@/Layouts/AppLayout';
import { Head, Link, useForm } from '@inertiajs/react';
import { FormEvent, useState } from 'react';
import JobDocuments from '@/Components/Pcd/JobDocuments';
import PdfPopupModal from '@/Components/PdfPopupModal';

export default function PcdRelease({ job, documents }: any) {
    const [showReject, setShowReject] = useState(false);
    const [pdf, setPdf] = useState<{ url: string; title: string } | null>(null);

    const approve = useForm<any>({ note: '' });
    const reject = useForm<any>({ reason: '' });

    const submitApprove = (e: FormEvent) => {
        e.preventDefault();
        approve.post(`/pcd/inbox/release/${job.id}/approve`);
    };
    const submitReject = (e: FormEvent) => {
        e.preventDefault();
        reject.post(`/pcd/inbox/release/${job.id}/reject`, { onSuccess: () => setShowReject(false) });
    };

    return (
        <AppLayout header={`Release — ${job.wo_number}`}>
            <Head title={`Release ${job.wo_number}`} />

            <div className="max-w-5xl mx-auto space-y-5 animate-fade-in">

                <div className="rounded-2xl border border-indigo-200 bg-indigo-50 p-4 flex items-start justify-between gap-4">
                    <div>
                        <p className="text-sm font-semibold text-indigo-900">
                            Planning is finished — this job is waiting to go to the shops.
                        </p>
                        <p className="text-xs text-indigo-700/80 mt-0.5">
                            {job.job_number ? `Job #${job.job_number} · ` : ''}{job.customer ?? ''}
                            {job.requested_at ? ` · planned ${job.requested_at}` : ''}
                        </p>
                    </div>
                    <Link href="/pcd/inbox" className="btn-ghost shrink-0">Back to inbox</Link>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
                    <div className="lg:col-span-2 space-y-5">

                        {/* The routing — which shops, in what order. */}
                        <div className="rounded-2xl border border-indigo-200 bg-white shadow-sm overflow-hidden">
                            <div className="px-4 py-3 bg-indigo-50 border-b border-indigo-100 flex items-center justify-between gap-2">
                                <div className="flex items-center gap-2.5">
                                    <div className="w-9 h-9 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center">
                                        <i className="fi fi-rr-route text-sm leading-none" />
                                    </div>
                                    <div>
                                        <h3 className="text-sm font-bold text-indigo-900 leading-tight">Work Order</h3>
                                        <p className="text-[11px] text-indigo-700/70 leading-tight mt-0.5">
                                            The shops this job will pass through, in sequence.
                                        </p>
                                    </div>
                                </div>
                                <button type="button"
                                    onClick={() => setPdf({ url: job.pdf_url, title: `Work Order ${job.wo_number}` })}
                                    className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold text-indigo-700 bg-white border border-indigo-200 hover:bg-indigo-50 transition-colors">
                                    <i className="fi fi-rr-file-pdf text-[11px] leading-none" /> PDF
                                </button>
                            </div>
                            <div className="p-4 space-y-2">
                                {job.sections.length === 0 ? (
                                    <p className="text-xs text-surface-400 text-center py-4">No shops routed.</p>
                                ) : job.sections.map((s: any) => (
                                    <div key={s.id} className="flex items-center gap-3 p-2.5 rounded-xl border border-surface-200">
                                        <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-sm shrink-0">
                                            {s.sequence}
                                        </div>
                                        <span className="font-semibold text-surface-900 text-sm flex-1 min-w-0 truncate">
                                            {s.name ?? '—'}
                                        </span>
                                        {s.weight_pct > 0 && (
                                            <span className="text-[10px] px-1.5 py-0.5 rounded border font-bold bg-violet-50 text-violet-700 border-violet-200">
                                                {s.weight_pct}% of job
                                            </span>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* The operation sheets — machine and operator per step. */}
                        <div className="rounded-2xl border border-indigo-200 bg-white shadow-sm overflow-hidden">
                            <div className="px-4 py-3 bg-indigo-50 border-b border-indigo-100 flex items-center gap-2.5">
                                <div className="w-9 h-9 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center">
                                    <i className="fi fi-rr-list-check text-sm leading-none" />
                                </div>
                                <div>
                                    <h3 className="text-sm font-bold text-indigo-900 leading-tight">Operation Sheets</h3>
                                    <p className="text-[11px] text-indigo-700/70 leading-tight mt-0.5">
                                        Every step the shops will work to.
                                    </p>
                                </div>
                            </div>
                            <div className="p-4 space-y-3">
                                {job.items.map((item: any) => (
                                    <div key={item.id} className="rounded-xl border border-surface-200 overflow-hidden">
                                        <div className="px-3 py-2 bg-surface-50 flex items-center justify-between gap-2">
                                            <div className="min-w-0">
                                                <p className="text-sm font-bold text-surface-900 truncate">{item.description ?? '—'}</p>
                                                <p className="text-[11px] text-surface-500">
                                                    {item.quantity} {item.unit ?? 'pcs'}
                                                    {item.sheet_number ? ` · ${item.sheet_number} · ${item.step_count} step${item.step_count !== 1 ? 's' : ''}` : ''}
                                                </p>
                                            </div>
                                            {item.sheet_pdf_url && (
                                                <button type="button"
                                                    onClick={() => setPdf({ url: item.sheet_pdf_url, title: item.sheet_number })}
                                                    className="shrink-0 px-2 py-1 rounded-lg text-[11px] font-bold bg-white text-indigo-700 border border-indigo-200 hover:bg-indigo-50">
                                                    PDF
                                                </button>
                                            )}
                                        </div>
                                        {item.steps.length > 0 ? (
                                            <div className="divide-y divide-surface-100">
                                                {item.steps.map((st: any, i: number) => (
                                                    <div key={i} className="flex items-center gap-3 px-3 py-2 text-sm">
                                                        <span className="w-5 text-[11px] text-surface-400 font-mono">{st.sequence}</span>
                                                        <span className="flex-1 min-w-0 truncate text-surface-800">{st.operation ?? '—'}</span>
                                                        <span className="text-[11px] text-surface-500 truncate max-w-[9rem]">{st.section ?? '—'}</span>
                                                        <span className="text-[11px] text-surface-400 truncate max-w-[8rem]">{st.machine ?? ''}</span>
                                                        {st.target_qty > 0 && (
                                                            <span className="text-[11px] font-semibold text-surface-600 tabular-nums">{st.target_qty}</span>
                                                        )}
                                                    </div>
                                                ))}
                                            </div>
                                        ) : (
                                            <p className="px-3 py-3 text-xs text-amber-700 bg-amber-50">
                                                No operation sheet for this item yet.
                                            </p>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>

                        <form onSubmit={submitApprove} className="card">
                            <div className="card-header">
                                <h3 className="text-sm font-bold text-surface-900">Release to the shops</h3>
                            </div>
                            <div className="card-body space-y-3">
                                <div className="form-group !mb-0">
                                    <label className="form-label">
                                        Note <span className="form-label-optional">Optional</span>
                                    </label>
                                    <textarea className="form-textarea" rows={3} value={approve.data.note}
                                        onChange={(e) => approve.setData('note', e.target.value)}
                                        placeholder="Anything the shops should know…" />
                                </div>
                                <div className="flex items-center justify-end gap-2.5">
                                    <button type="button" onClick={() => setShowReject(true)} className="btn-outline">
                                        <i className="fi fi-rr-undo text-xs leading-none" /> Send back to planning
                                    </button>
                                    <button type="submit" disabled={approve.processing} className="btn-primary">
                                        <i className="fi fi-rr-check text-xs leading-none" /> Approve &amp; release
                                    </button>
                                </div>
                            </div>
                        </form>
                    </div>

                    <div className="space-y-5">
                        <div className="card">
                            <div className="card-header">
                                <h3 className="text-base font-semibold text-surface-900">Job</h3>
                            </div>
                            <div className="card-body divide-y divide-surface-50 text-sm">
                                {[
                                    ['WO No.', job.wo_number],
                                    ['Job No.', job.job_number],
                                    ['Customer', job.customer],
                                    ['Quantity', job.quantity],
                                    ['Priority', job.priority],
                                    ['Due date', job.due_date],
                                    ['Material requisitions', job.mr_count],
                                ].map(([label, value]) => (
                                    <div key={label as string} className="flex items-start justify-between gap-3 py-1.5">
                                        <span className="text-xs text-surface-500">{label}</span>
                                        <span className="font-semibold text-surface-900 text-right capitalize">{value ?? '—'}</span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {documents && <JobDocuments documents={documents} />}
                    </div>
                </div>
            </div>

            {showReject && (
                <div className="fixed inset-0 z-[150] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setShowReject(false)} />
                    <form onSubmit={submitReject} className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg">
                        <div className="px-5 py-3 border-b border-surface-100">
                            <h3 className="text-sm font-bold text-surface-900">Send {job.wo_number} back to planning</h3>
                        </div>
                        <div className="p-5">
                            <div className="form-group !mb-0">
                                <label className="form-label">Reason <span className="text-red-500">*</span></label>
                                <textarea className="form-textarea" rows={4} value={reject.data.reason}
                                    onChange={(e) => reject.setData('reason', e.target.value)}
                                    placeholder="What needs changing before this can go to the shops?" />
                                {reject.errors.reason && <p className="form-error">{reject.errors.reason as any}</p>}
                                <p className="form-hint">
                                    The job returns to Job Planning and the planner is notified.
                                </p>
                            </div>
                        </div>
                        <div className="px-5 py-3 border-t border-surface-100 flex items-center justify-end gap-2">
                            <button type="button" onClick={() => setShowReject(false)} className="btn-ghost">Cancel</button>
                            <button type="submit" disabled={reject.processing || !reject.data.reason.trim()}
                                className="btn bg-red-600 hover:bg-red-500 text-white disabled:opacity-40">
                                <i className="fi fi-rr-undo text-xs leading-none" /> Send back
                            </button>
                        </div>
                    </form>
                </div>
            )}

            <PdfPopupModal open={pdf !== null} pdfUrl={pdf?.url ?? null}
                title={pdf?.title ?? 'Document'} onClose={() => setPdf(null)} />
        </AppLayout>
    );
}
