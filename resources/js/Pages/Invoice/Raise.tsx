import AppLayout from '@/Layouts/AppLayout';
import { Link, useForm } from '@inertiajs/react';
import { FormEvent, useMemo } from 'react';

const money = (v: any) => `৳${Number(v ?? 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
const qty = (v: any) => Number(v ?? 0).toLocaleString('en-IN', { maximumFractionDigits: 2 });

/**
 * Raise a bill for delivered challans of one job (App\Services\JobBilling):
 * one challan = a partial bill, every challan = the full bill. The job's
 * advance bills are recovered from the goods value until they are used up.
 * The server works the figures out again on save — this page only previews them.
 */
export default function InvoiceRaise({ job, standing, challans, selected, bills }: any) {
    const form = useForm<{ work_order_id: number; delivery_ids: number[] }>({
        work_order_id: job.id,
        delivery_ids: selected ?? [],
    });
    const picked = (challans as any[]).filter((c) => form.data.delivery_ids.includes(c.id));
    const toggle = (id: number, on: boolean) =>
        form.setData('delivery_ids', on ? [...form.data.delivery_ids, id] : form.data.delivery_ids.filter((x) => x !== id));

    const goods = useMemo(() => picked.reduce((s, c) => s + Number(c.value), 0), [picked]);
    const adjust = Math.min(goods, Number(standing.advance_in_hand ?? 0));
    const all = challans.length > 0 && picked.length === challans.length;
    const fullyDelivered = job.status === 'delivered';

    const submit = (e: FormEvent) => {
        e.preventDefault();
        form.post('/invoices/raise');
    };

    return (
        <AppLayout header="Raise bill">
            <form onSubmit={submit} className="max-w-4xl animate-fade-in space-y-6">
                <div className="card">
                    <div className="card-body flex flex-col sm:flex-row sm:items-center gap-4 justify-between">
                        <div className="min-w-0">
                            <div className="text-xs uppercase text-surface-400 font-semibold tracking-wide">Raise bill</div>
                            <h2 className="text-lg font-bold text-surface-900 mt-0.5">
                                Job {job.job_number ?? '—'} <span className="font-mono text-sm text-brand-600">{job.wo_number}</span>
                            </h2>
                            <p className="text-sm text-surface-600">{job.customer}</p>
                        </div>
                        <div className="grid grid-cols-3 gap-2 text-center shrink-0">
                            <Tile label="Quotation" value={money(standing.quotation_total)} />
                            <Tile label="Billed so far" value={money(standing.billed_total)} />
                            <Tile label="Advance to recover" value={money(standing.advance_in_hand)} tone={standing.advance_in_hand > 0 ? 'amber' : undefined} />
                        </div>
                    </div>
                </div>

                <div className="card">
                    <div className="card-header">
                        <div>
                            <h3 className="text-base font-bold text-surface-900">Delivered challans not billed yet</h3>
                            <p className="text-xs text-surface-500 mt-0.5">
                                Tick one for a partial bill, or several to put them on one bill. {qty(job.delivered)} of {qty(job.ordered)} delivered
                                {fullyDelivered ? ' — the whole order has gone.' : '; more is still to go.'}
                            </p>
                        </div>
                    </div>
                    {challans.length === 0 ? (
                        <div className="card-body text-sm text-surface-500">Every delivered challan of this job is already on a bill.</div>
                    ) : (
                        <div className="divide-y divide-surface-100">
                            {challans.map((c: any) => {
                                const on = form.data.delivery_ids.includes(c.id);
                                return (
                                    <label key={c.id} className={`block px-5 py-4 cursor-pointer ${on ? 'bg-brand-50/60' : 'hover:bg-surface-50'}`}>
                                        <div className="flex items-start gap-3">
                                            <input type="checkbox" checked={on} onChange={(e) => toggle(c.id, e.target.checked)}
                                                className="mt-1 rounded border-surface-300 text-brand-600" />
                                            <div className="flex-1 min-w-0">
                                                <div className="flex flex-wrap items-center gap-2">
                                                    <span className="font-mono font-semibold text-surface-900">{c.challan_number}</span>
                                                    {c.type === 'partial' && <span className="badge badge-amber">Partial</span>}
                                                    <span className="text-xs text-surface-500">delivered {c.delivered_at}</span>
                                                    <span className="ml-auto font-semibold tabular-nums text-surface-900">{money(c.value)}</span>
                                                </div>
                                                <table className="w-full mt-2 text-xs">
                                                    <tbody>
                                                        {c.lines.map((l: any, i: number) => (
                                                            <tr key={i} className="text-surface-600">
                                                                <td className="py-0.5 pr-2">{l.part_no && <span className="text-surface-400 mr-1">{l.part_no}</span>}{l.description}</td>
                                                                <td className="py-0.5 pr-2 text-right whitespace-nowrap tabular-nums">{qty(l.quantity)} {l.unit} × {money(l.unit_price)}</td>
                                                                <td className="py-0.5 text-right whitespace-nowrap tabular-nums w-28">{money(l.amount)}</td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                        </div>
                                    </label>
                                );
                            })}
                        </div>
                    )}
                    {form.errors.delivery_ids && <p className="form-error px-5 pb-3">{form.errors.delivery_ids}</p>}
                </div>

                <div className="card sticky bottom-4">
                    <div className="card-body flex flex-col sm:flex-row sm:items-center gap-4">
                        <div className="flex-1 text-sm space-y-0.5 tabular-nums">
                            <div className="flex justify-between max-w-sm"><span className="text-surface-600">Value of goods ({picked.length} challan{picked.length === 1 ? '' : 's'})</span><span>{money(goods)}</span></div>
                            {adjust > 0 && (
                                <div className="flex justify-between max-w-sm text-amber-700"><span>Less: advance billed</span><span>− {money(adjust)}</span></div>
                            )}
                            <div className="flex justify-between max-w-sm font-bold text-surface-900 border-t border-surface-200 pt-1"><span>This bill</span><span>{money(goods - adjust)}</span></div>
                            <div className="text-xs text-surface-500">
                                {picked.length === 0 ? 'Tick a challan.' : all && fullyDelivered ? 'Full bill — every challan of the job.' : 'Partial bill.'} Prices are the quotation's (VAT included).
                            </div>
                        </div>
                        <div className="flex gap-2 shrink-0">
                            <Link href="/delivery" className="btn-ghost">Cancel</Link>
                            <button type="submit" disabled={form.processing || picked.length === 0} className="btn-primary">
                                <i className="fi fi-rr-receipt text-xs leading-none" /> {form.processing ? 'Raising…' : 'Raise bill'}
                            </button>
                        </div>
                    </div>
                </div>

                {bills.length > 0 && <JobBills bills={bills} />}
            </form>
        </AppLayout>
    );
}

export function Tile({ label, value, tone }: { label: string; value: string; tone?: 'amber' }) {
    return (
        <div className={`rounded-xl border px-3 py-2 ${tone === 'amber' ? 'border-amber-200 bg-amber-50' : 'border-surface-200'}`}>
            <div className="text-[10px] uppercase tracking-wide text-surface-500 font-semibold">{label}</div>
            <div className={`text-sm font-bold tabular-nums ${tone === 'amber' ? 'text-amber-800' : 'text-surface-900'}`}>{value}</div>
        </div>
    );
}

/** The bills already raised on the job. */
export function JobBills({ bills }: { bills: any[] }) {
    return (
        <div className="card">
            <div className="card-header"><h3 className="text-base font-bold text-surface-900">Bills on this job</h3></div>
            <div className="divide-y divide-surface-100">
                {bills.map((b) => (
                    <Link key={b.id} href={`/invoices/${b.id}`} className="flex items-center gap-3 px-5 py-3 text-sm hover:bg-surface-50">
                        <span className="font-mono font-semibold text-brand-600">{b.invoice_number}</span>
                        <span className={`badge ${b.kind === 'advance' ? 'badge-purple' : 'badge-slate'}`}>{b.kind === 'advance' ? 'Advance' : 'Delivery'}</span>
                        <span className="text-xs text-surface-500">{b.issued}</span>
                        {b.adjusted > 0 && <span className="text-xs text-amber-700">advance recovered {money(b.adjusted)}</span>}
                        <span className="ml-auto font-semibold tabular-nums">{money(b.total)}</span>
                    </Link>
                ))}
            </div>
        </div>
    );
}
