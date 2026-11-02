import AppLayout from '@/Layouts/AppLayout';
import { Link, router, useForm } from '@inertiajs/react';
import { FormEvent, useState } from 'react';
import { JobBills, Tile } from './Raise';

const money = (v: any) => `৳${Number(v ?? 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;

/**
 * An advance bill — before delivery (App\Services\JobBilling). Later delivery
 * bills recover it from their goods value until it is used up.
 */
export default function InvoiceAdvance({ jobs, job, standing, bills }: any) {
    const form = useForm<any>({ work_order_id: job?.id ?? '', amount: '', note: '' });
    const [pct, setPct] = useState('');
    const quoted = Number(standing?.quotation_total ?? 0);

    const pickJob = (id: string) => router.get('/invoices/advance', id ? { work_order_id: id } : {}, { preserveScroll: true });
    const fromPct = (v: string) => {
        setPct(v);
        const n = parseFloat(v);
        form.setData('amount', n > 0 && quoted > 0 ? (Math.round(quoted * n) / 100).toFixed(2) : '');
    };
    const submit = (e: FormEvent) => {
        e.preventDefault();
        form.post('/invoices/advance');
    };

    return (
        <AppLayout header="Advance bill">
            <form onSubmit={submit} className="max-w-3xl animate-fade-in space-y-6">
                <div className="card">
                    <div className="card-header">
                        <div>
                            <h3 className="text-base font-bold text-surface-900">Advance bill</h3>
                            <p className="text-xs text-surface-500 mt-0.5">
                                A bill before delivery. The delivery bills after it deduct this amount until it is used up.
                            </p>
                        </div>
                    </div>
                    <div className="card-body space-y-5">
                        <div className="form-group !mb-0">
                            <label className="form-label">Job <span className="text-red-500">*</span></label>
                            <select className="form-input" value={job?.id ?? ''} onChange={(e) => pickJob(e.target.value)}>
                                <option value="">Pick the job…</option>
                                {job && !jobs.some((j: any) => j.id === job.id) && <option value={job.id}>Job {job.job_number} · {job.wo_number}</option>}
                                {jobs.map((j: any) => <option key={j.id} value={j.id}>{j.label}</option>)}
                            </select>
                            {form.errors.work_order_id && <p className="form-error">{form.errors.work_order_id}</p>}
                        </div>

                        {job && standing && (
                            <>
                                <div className="grid grid-cols-3 gap-2 text-center">
                                    <Tile label="Quotation" value={money(standing.quotation_total)} />
                                    <Tile label="Billed so far" value={money(standing.billed_total)} />
                                    <Tile label="Can still ask" value={money(standing.advance_room)} tone="amber" />
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                    <div className="form-group !mb-0">
                                        <label className="form-label">% of quotation</label>
                                        <input type="number" step="0.01" min="0" max="100" className="form-input text-right"
                                            value={pct} onChange={(e) => fromPct(e.target.value)} placeholder="e.g. 40" />
                                    </div>
                                    <div className="form-group !mb-0 sm:col-span-2">
                                        <label className="form-label">Amount (VAT incl.) <span className="text-red-500">*</span></label>
                                        <input type="number" step="0.01" min="1" className="form-input text-right tabular-nums"
                                            value={form.data.amount} onChange={(e) => { setPct(''); form.setData('amount', e.target.value); }} />
                                        {form.errors.amount && <p className="form-error">{form.errors.amount}</p>}
                                    </div>
                                </div>
                                <div className="form-group !mb-0">
                                    <label className="form-label">Note <span className="form-label-optional">Optional</span></label>
                                    <input className="form-input" maxLength={200} value={form.data.note}
                                        onChange={(e) => form.setData('note', e.target.value)} placeholder="e.g. As per work order clause 4 — 40% advance" />
                                    <p className="form-hint">Prints on the bill's line, after "Advance against Job …".</p>
                                </div>
                            </>
                        )}
                    </div>
                    <div className="px-5 py-3 border-t border-surface-100 flex justify-end gap-2">
                        <Link href="/invoices" className="btn-ghost">Cancel</Link>
                        <button type="submit" disabled={!job || form.processing || !(Number(form.data.amount) > 0)} className="btn-primary">
                            <i className="fi fi-rr-receipt text-xs leading-none" /> {form.processing ? 'Raising…' : 'Raise advance bill'}
                        </button>
                    </div>
                </div>

                {bills.length > 0 && <JobBills bills={bills} />}
            </form>
        </AppLayout>
    );
}
