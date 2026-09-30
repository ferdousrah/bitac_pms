import AppLayout from '@/Layouts/AppLayout';
import { Head, Link, useForm } from '@inertiajs/react';
import { FormEvent, useState } from 'react';

const money = (n: number) =>
    n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function PcdReview({ job }: any) {
    const [showBack, setShowBack] = useState(false);

    const forwardForm = useForm<any>({ note: '' });
    const backForm = useForm<any>({ reason: '' });

    const forward = (e: FormEvent) => {
        e.preventDefault();
        forwardForm.post(`/pcd/inbox/${job.id}/forward`);
    };

    const sendBack = (e: FormEvent) => {
        e.preventDefault();
        backForm.post(`/pcd/inbox/${job.id}/send-back`, { onSuccess: () => setShowBack(false) });
    };

    const row = (label: string, value: any) => (
        <div className="flex items-start justify-between gap-4 py-1.5">
            <span className="text-xs text-surface-500">{label}</span>
            <span className="text-sm font-semibold text-surface-900 text-right">{value ?? '—'}</span>
        </div>
    );

    return (
        <AppLayout header={`Review — ${job.wo_number}`}>
            <Head title={`Review ${job.wo_number}`} />

            <div className="max-w-5xl mx-auto space-y-5 animate-fade-in">

                <div className="rounded-2xl border border-violet-200 bg-violet-50/60 p-4 flex items-start justify-between gap-4">
                    <div>
                        <p className="text-sm font-semibold text-violet-900">
                            This work order is waiting for your decision.
                        </p>
                        <p className="text-xs text-violet-700 mt-0.5">
                            Forward it to Job Planning, or send it back to IED with a reason.
                            {job.handed_over_by ? ` Accepted by ${job.handed_over_by}` : ''}
                            {job.handed_over_at ? ` on ${job.handed_over_at}.` : ''}
                        </p>
                    </div>
                    <Link href="/pcd/inbox" className="btn-ghost shrink-0">Back to inbox</Link>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
                    <div className="lg:col-span-2 space-y-5">
                        <div className="card">
                            <div className="card-header">
                                <h3 className="text-sm font-bold text-surface-900">
                                    Job items <span className="text-surface-400 font-normal">({job.items.length})</span>
                                </h3>
                            </div>
                            <div className="card-body p-0 overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="border-b border-surface-100 text-[10px] uppercase tracking-wider text-surface-500 font-bold">
                                            <th className="text-left px-4 py-2 w-10">#</th>
                                            <th className="text-left px-3 py-2">Description</th>
                                            <th className="text-right px-3 py-2 w-24">Qty</th>
                                            <th className="text-left px-3 py-2 w-20">Unit</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {job.items.map((item: any, i: number) => (
                                            <tr key={item.id} className="border-b border-surface-50 align-top">
                                                <td className="px-4 py-2.5 text-surface-400">{i + 1}</td>
                                                <td className="px-3 py-2.5">
                                                    <span className="text-surface-900">{item.description ?? '—'}</span>
                                                    {item.part_no && (
                                                        <span className="ml-1.5 text-[10px] font-mono text-surface-400">{item.part_no}</span>
                                                    )}
                                                    {item.ied_note && (
                                                        <p className="mt-1 text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-2 py-1">
                                                            <strong>IED:</strong> {item.ied_note}
                                                        </p>
                                                    )}
                                                </td>
                                                <td className="px-3 py-2.5 text-right tabular-nums">{item.quantity}</td>
                                                <td className="px-3 py-2.5 text-xs text-surface-500">{item.unit ?? '—'}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        {job.notes && (
                            <div className="card">
                                <div className="card-header"><h3 className="text-sm font-bold text-surface-900">Notes</h3></div>
                                <div className="card-body">
                                    <p className="text-sm text-surface-700 whitespace-pre-wrap leading-relaxed">{job.notes}</p>
                                </div>
                            </div>
                        )}

                        <form onSubmit={forward} className="card">
                            <div className="card-header">
                                <h3 className="text-sm font-bold text-surface-900">Forward to Job Planning</h3>
                            </div>
                            <div className="card-body space-y-3">
                                <div className="form-group !mb-0">
                                    <label className="form-label">
                                        Note for PCD <span className="form-label-optional">Optional</span>
                                    </label>
                                    <textarea className="form-textarea" rows={3} value={forwardForm.data.note}
                                        onChange={(e) => forwardForm.setData('note', e.target.value)}
                                        placeholder="Anything the planner should know before setting this up…" />
                                    <p className="form-hint">Prints on the job's notes, tagged with your name and today's date.</p>
                                </div>
                                <div className="flex items-center justify-end gap-2.5">
                                    <button type="button" onClick={() => setShowBack(true)} className="btn-outline">
                                        <i className="fi fi-rr-undo text-xs leading-none" /> Send back to IED
                                    </button>
                                    <button type="submit" disabled={forwardForm.processing} className="btn-primary">
                                        <i className="fi fi-rr-paper-plane text-xs leading-none" /> Forward to Job Planning
                                    </button>
                                </div>
                            </div>
                        </form>
                    </div>

                    <div className="space-y-5">
                        <div className="card">
                            <div className="card-header">
                                <div className="flex items-center gap-2">
                                    <span className="w-2 h-2 rounded-full bg-violet-500 shrink-0" />
                                    <h3 className="text-base font-semibold text-surface-900">Work Order</h3>
                                </div>
                            </div>
                            <div className="card-body divide-y divide-surface-50">
                                {row('WO No.', <span className="font-mono">{job.wo_number}</span>)}
                                {row('Customer', job.customer)}
                                {row('Customer PO', job.customer_po_no)}
                                {row('Quotation', job.quotation_no)}
                                {row('Value', job.amount ? `৳ ${money(job.amount)}` : null)}
                                {row('Quantity', job.quantity)}
                                {row('Priority', <span className="capitalize">{job.priority ?? 'normal'}</span>)}
                                {row('Due date', job.due_date)}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {showBack && (
                <div className="fixed inset-0 z-[150] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setShowBack(false)} />
                    <form onSubmit={sendBack} className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg">
                        <div className="px-5 py-3 border-b border-surface-100">
                            <h3 className="text-sm font-bold text-surface-900">Send {job.wo_number} back to IED</h3>
                        </div>
                        <div className="p-5">
                            <div className="form-group !mb-0">
                                <label className="form-label">Reason <span className="text-red-500">*</span></label>
                                <textarea className="form-textarea" rows={4} value={backForm.data.reason}
                                    onChange={(e) => backForm.setData('reason', e.target.value)}
                                    placeholder="What needs correcting before PCD can take this on?" />
                                {backForm.errors.reason && <p className="form-error">{backForm.errors.reason as any}</p>}
                                <p className="form-hint">
                                    The work order returns to the IED Work Order Inbox and IED is notified.
                                </p>
                            </div>
                        </div>
                        <div className="px-5 py-3 border-t border-surface-100 flex items-center justify-end gap-2">
                            <button type="button" onClick={() => setShowBack(false)} className="btn-ghost">Cancel</button>
                            <button type="submit" disabled={backForm.processing || !backForm.data.reason.trim()}
                                className="btn bg-red-600 hover:bg-red-500 text-white disabled:opacity-40">
                                <i className="fi fi-rr-undo text-xs leading-none" /> Send back
                            </button>
                        </div>
                    </form>
                </div>
            )}
        </AppLayout>
    );
}
