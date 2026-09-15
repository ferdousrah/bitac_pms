import AppLayout from '@/Layouts/AppLayout';
import { Link, router } from '@inertiajs/react';
import { Fragment, useState } from 'react';
import PdfPopupModal from '@/Components/PdfPopupModal';

const fmt = (n: number | null | undefined) =>
    `৳${Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const SECTION_LABEL: Record<string, string> = {
    material: 'Material', machining: 'Machining', surface: 'Surface', other: 'Other',
};

const APPROVAL: Record<string, { label: string; cls: string }> = {
    not_submitted:    { label: 'Not submitted',    cls: 'bg-surface-100 text-surface-600 border-surface-200' },
    pending_approval: { label: 'Pending approval', cls: 'bg-amber-50 text-amber-700 border-amber-200' },
    approved:         { label: 'Approved',         cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
    rejected:         { label: 'Rejected',         cls: 'bg-red-50 text-red-700 border-red-200' },
};

/**
 * Job Costing — every part estimate of a job, consolidated.
 * Read-only: the numbers are derived from the estimates themselves, and the
 * job total is the same figure the quotation uses.
 */
export default function JobCosting({ job }: any) {
    const [pdfOpen, setPdfOpen] = useState(false);
    const [openRows, setOpenRows] = useState<Set<number>>(new Set());
    const toggle = (i: number) => setOpenRows(prev => {
        const next = new Set(prev);
        next.has(i) ? next.delete(i) : next.add(i);
        return next;
    });

    const t = job.totals;
    const submitJob = () => {
        const warn = job.missing > 0 ? `\n\nNote: ${job.missing} part(s) have no estimate yet and will not be included.` : '';
        if (!confirm(`Send all ${job.submittable} part estimates of this job for approval together?${warn}`)) return;
        router.post(`/cost-estimates/job/${job.rfq_item_id}/submit-approval`);
    };

    return (
        <AppLayout header="Job Costing">
            <div className="space-y-5 animate-fade-in">

                {/* ── Header ─────────────────────────────────────────────── */}
                <div className="card">
                    <div className="card-body flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
                        <div className="min-w-0">
                            <div className="text-[10px] uppercase tracking-wider font-bold text-surface-400 mb-1">
                                Job Costing · RFQ #{job.rfq_id}
                            </div>
                            <h2 className="text-lg font-bold text-surface-900">{job.job_description}</h2>
                            <div className="text-xs text-surface-500 mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
                                <span>Customer: <span className="font-semibold text-surface-700">{job.customer}</span></span>
                                <span>Job quantity: <span className="font-semibold text-surface-700">{job.job_quantity} {job.job_unit}</span></span>
                                <span>
                                    {job.mode === 'parts'
                                        ? `Costed part-wise · ${job.costed} of ${job.part_count} parts`
                                        : job.mode === 'item' ? 'Costed as a whole job' : 'Not costed yet'}
                                </span>
                            </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-2 shrink-0">
                            <Link href={`/cost-estimates/job/${job.rfq_item_id}/edit`} className="btn-primary btn-sm">
                                <i className="fi fi-rr-edit text-xs leading-none" /> Edit all parts
                            </Link>
                            <button type="button" onClick={() => setPdfOpen(true)} className="btn-outline btn-sm">
                                <i className="fi fi-rr-file-pdf text-xs leading-none" /> PDF
                            </button>
                            {job.submittable > 1 && (
                                <button type="button" onClick={submitJob} className="btn-sm inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500">
                                    <i className="fi fi-rr-layers text-xs leading-none" /> Submit Whole Job ({job.submittable})
                                </button>
                            )}
                            <Link href={`/rfqs/${job.rfq_id}`} className="btn-ghost btn-sm">
                                <i className="fi fi-rr-arrow-left text-xs leading-none" /> Back to RFQ
                            </Link>
                        </div>
                    </div>

                    {/* Totals strip */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-surface-100 border-t border-surface-100">
                        <div className="px-5 py-3.5">
                            <div className="text-[10px] uppercase tracking-wider font-semibold text-surface-500">Job total</div>
                            <div className="text-2xl font-bold text-surface-900 tabular-nums">{fmt(job.job_total)}</div>
                            <div className="text-[11px] text-surface-400">incl. VAT &amp; Tax · goes to the quotation</div>
                        </div>
                        <div className="px-5 py-3.5">
                            <div className="text-[10px] uppercase tracking-wider font-semibold text-surface-500">Per {job.job_unit}</div>
                            <div className="text-2xl font-bold text-surface-900 tabular-nums">{fmt(job.per_job_unit)}</div>
                            <div className="text-[11px] text-surface-400">job total ÷ {job.job_quantity}</div>
                        </div>
                        <div className="px-5 py-3.5">
                            <div className="text-[10px] uppercase tracking-wider font-semibold text-surface-500">Net production cost</div>
                            <div className="text-2xl font-bold text-surface-900 tabular-nums">
                                {fmt(t.material + t.machining + t.surface + t.other)}
                            </div>
                            <div className="text-[11px] text-surface-400">material + machining + surface + other</div>
                        </div>
                    </div>
                </div>

                {job.missing > 0 && (
                    <div className="flex items-start gap-3 p-4 rounded-xl bg-amber-50 border border-amber-200">
                        <i className="fi fi-rr-triangle-warning text-amber-600 text-base leading-none mt-0.5" />
                        <div className="text-sm text-amber-900">
                            <span className="font-bold">{job.missing} of {job.part_count} parts are not cost-estimated yet.</span>{' '}
                            The job total is short until they are.
                        </div>
                    </div>
                )}

                {/* ── Consolidated table ─────────────────────────────────── */}
                <div className="card">
                    <div className="card-header">
                        <h3 className="text-sm font-bold text-surface-900">Part-wise breakdown</h3>
                        <p className="text-xs text-surface-400 mt-0.5">
                            Each part's figures are extended by its quantity and multiplier, so every column adds up to the job.
                            Click a part to see its cost lines.
                        </p>
                    </div>
                    <div className="card-body p-0 overflow-x-auto">
                        {job.rows.length === 0 ? (
                            <div className="py-10 text-center text-sm text-surface-400">Nothing has been costed for this job yet.</div>
                        ) : (
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="text-[10px] uppercase tracking-wider text-surface-500 font-bold border-b border-surface-100 bg-surface-50/80">
                                        <th className="text-left px-4 py-2.5">Part</th>
                                        <th className="text-right px-3 py-2.5">Qty</th>
                                        <th className="text-right px-3 py-2.5">Material</th>
                                        <th className="text-right px-3 py-2.5">Machining</th>
                                        <th className="text-right px-3 py-2.5">Surface</th>
                                        <th className="text-right px-3 py-2.5">Other</th>
                                        <th className="text-right px-3 py-2.5">Overhead</th>
                                        <th className="text-right px-3 py-2.5">VAT + Tax</th>
                                        <th className="text-right px-3 py-2.5" title="Manual rounding applied to the estimate's grand total">Adjust.</th>
                                        <th className="text-right px-3 py-2.5">Unit cost</th>
                                        <th className="text-right px-4 py-2.5">Total</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-surface-100">
                                    {job.rows.map((r: any, i: number) => {
                                        const b = r.breakdown;
                                        const ap = APPROVAL[r.estimate?.approval_status] ?? APPROVAL.not_submitted;
                                        return (
                                            <Fragment key={i}>
                                                <tr className={r.estimate ? 'hover:bg-brand-50/30 cursor-pointer' : ''}
                                                    onClick={() => r.estimate && toggle(i)}>
                                                    <td className="px-4 py-3 align-top">
                                                        <div className="flex items-start gap-2">
                                                            <span className="shrink-0 font-mono text-[10px] font-bold px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-100">
                                                                {r.part_no}
                                                            </span>
                                                            <div className="min-w-0">
                                                                <div className="font-semibold text-surface-900">{r.name}</div>
                                                                {r.estimate ? (
                                                                    <div className="flex flex-wrap items-center gap-1.5 mt-1">
                                                                        <Link href={`/cost-estimates/${r.estimate.id}`}
                                                                            onClick={(e) => e.stopPropagation()}
                                                                            className="font-mono text-[10px] font-bold text-brand-600 hover:underline">
                                                                            {r.estimate.estimate_no}
                                                                        </Link>
                                                                        <span className={`text-[9px] px-1.5 py-0.5 rounded border font-semibold ${ap.cls}`}>{ap.label}</span>
                                                                        <span className="text-[10px] text-surface-400">group {r.estimate.pricing_group}</span>
                                                                    </div>
                                                                ) : (
                                                                    r.part_id && (
                                                                        <Link href={`/cost-estimates/create?rfq_item_part_id=${r.part_id}`}
                                                                            className="inline-flex items-center gap-1 mt-1 px-1.5 py-0.5 rounded bg-brand-50 text-brand-700 border border-brand-200 text-[10px] font-semibold hover:bg-brand-100">
                                                                            <i className="fi fi-rr-plus text-[9px] leading-none" /> Estimate this part
                                                                        </Link>
                                                                    )
                                                                )}
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className="px-3 py-3 text-right align-top whitespace-nowrap">{r.quantity} <span className="text-surface-400">{r.unit}</span></td>
                                                    {b ? (
                                                        <>
                                                            <td className="px-3 py-3 text-right align-top tabular-nums">{fmt(b.material)}</td>
                                                            <td className="px-3 py-3 text-right align-top tabular-nums">{fmt(b.machining)}</td>
                                                            <td className="px-3 py-3 text-right align-top tabular-nums">{fmt(b.surface)}</td>
                                                            <td className="px-3 py-3 text-right align-top tabular-nums">{fmt(b.other)}</td>
                                                            <td className="px-3 py-3 text-right align-top tabular-nums">{fmt(b.overhead + b.extra)}</td>
                                                            <td className="px-3 py-3 text-right align-top tabular-nums">{fmt(b.vat + b.tax)}</td>
                                                            <td className={`px-3 py-3 text-right align-top tabular-nums ${b.adjustment ? 'text-amber-700' : 'text-surface-300'}`}>
                                                                {b.adjustment ? fmt(b.adjustment) : '—'}
                                                            </td>
                                                            <td className="px-3 py-3 text-right align-top tabular-nums text-surface-600">{fmt(r.unit_cost)}</td>
                                                            <td className="px-4 py-3 text-right align-top tabular-nums font-bold text-surface-900">{fmt(r.grand_total)}</td>
                                                        </>
                                                    ) : (
                                                        <td colSpan={9} className="px-3 py-3 text-center align-top text-xs italic text-amber-700">
                                                            Not cost-estimated yet
                                                        </td>
                                                    )}
                                                </tr>

                                                {/* The part's own cost lines */}
                                                {openRows.has(i) && r.lines.length > 0 && (
                                                    <tr className="bg-surface-50/60">
                                                        <td colSpan={11} className="px-4 py-3">
                                                            <table className="w-full text-xs">
                                                                <thead>
                                                                    <tr className="text-[10px] uppercase tracking-wider text-surface-400">
                                                                        <th className="text-left py-1 w-24">Section</th>
                                                                        <th className="text-left py-1">Description</th>
                                                                        <th className="text-right py-1 w-24">Qty</th>
                                                                        <th className="text-right py-1 w-24">Rate</th>
                                                                        <th className="text-right py-1 w-28">Amount / unit</th>
                                                                    </tr>
                                                                </thead>
                                                                <tbody>
                                                                    {r.lines.map((l: any, li: number) => (
                                                                        <tr key={li} className="border-t border-surface-100">
                                                                            <td className="py-1 text-surface-500">{SECTION_LABEL[l.section] ?? l.section}</td>
                                                                            <td className="py-1 text-surface-800">{l.description || '—'}</td>
                                                                            <td className="py-1 text-right tabular-nums">{l.quantity} {l.unit}</td>
                                                                            <td className="py-1 text-right tabular-nums">{fmt(l.rate)}</td>
                                                                            <td className="py-1 text-right tabular-nums">{fmt(l.amount)}</td>
                                                                        </tr>
                                                                    ))}
                                                                </tbody>
                                                            </table>
                                                        </td>
                                                    </tr>
                                                )}
                                            </Fragment>
                                        );
                                    })}
                                </tbody>
                                <tfoot>
                                    <tr className="border-t-2 border-surface-200 bg-indigo-50/40 font-bold">
                                        <td className="px-4 py-3 text-surface-900">Job total</td>
                                        <td className="px-3 py-3" />
                                        <td className="px-3 py-3 text-right tabular-nums">{fmt(t.material)}</td>
                                        <td className="px-3 py-3 text-right tabular-nums">{fmt(t.machining)}</td>
                                        <td className="px-3 py-3 text-right tabular-nums">{fmt(t.surface)}</td>
                                        <td className="px-3 py-3 text-right tabular-nums">{fmt(t.other)}</td>
                                        <td className="px-3 py-3 text-right tabular-nums">{fmt(t.overhead + t.extra)}</td>
                                        <td className="px-3 py-3 text-right tabular-nums">{fmt(t.vat + t.tax)}</td>
                                        <td className="px-3 py-3 text-right tabular-nums">{t.adjustment ? fmt(t.adjustment) : '—'}</td>
                                        <td className="px-3 py-3" />
                                        <td className="px-4 py-3 text-right tabular-nums text-surface-900">{fmt(job.job_total)}</td>
                                    </tr>
                                </tfoot>
                            </table>
                        )}
                    </div>
                </div>
            </div>

            <PdfPopupModal
                open={pdfOpen}
                pdfUrl={`/cost-estimates/job/${job.rfq_item_id}/pdf?preview=base64`}
                title="Job Costing"
                subtitle={job.job_description}
                onClose={() => setPdfOpen(false)}
            />
        </AppLayout>
    );
}
