import AppLayout from '@/Layouts/AppLayout';
import { Head, Link } from '@inertiajs/react';
import { useState } from 'react';
import PaymentRows from '@/Components/Payment/PaymentRows';

const money = (n: number) =>
    `৳${Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const statusTone: Record<string, string> = {
    paid: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    partially_paid: 'bg-amber-50 text-amber-700 border-amber-200',
    issued: 'bg-sky-50 text-sky-700 border-sky-200',
    sent: 'bg-sky-50 text-sky-700 border-sky-200',
    acknowledged: 'bg-sky-50 text-sky-700 border-sky-200',
    overdue: 'bg-rose-50 text-rose-700 border-rose-200',
};

/** One client's account: every bill, every receipt, and what is still held. */
export default function CustomerLedger({
    customer, totals, invoices = [], advances = [], security = [], bucketLabels, can = {},
}: any) {
    const [open, setOpen] = useState<number | null>(invoices[0]?.id ?? null);

    return (
        <AppLayout header={customer.name}>
            <Head title={`${customer.name} — ledger`} />

            <div className="max-w-6xl mx-auto space-y-5 animate-fade-in">

                <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                        <h2 className="text-xl font-bold text-surface-900">{customer.name}</h2>
                        <p className="text-sm text-surface-500 mt-0.5">
                            {[customer.type, customer.phone, customer.email].filter(Boolean).join(' · ') || '—'}
                        </p>
                    </div>
                    <Link href="/receivables" className="btn-outline btn-sm">
                        <i className="fi fi-rr-arrow-left text-xs leading-none" /> Receivables
                    </Link>
                </div>

                <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
                    {[
                        ['Billed', money(totals.billed), 'text-surface-900'],
                        ['Settled', money(totals.settled), 'text-emerald-600'],
                        ['Cash received', money(totals.received), 'text-surface-900'],
                        ['Due', money(totals.due), totals.due > 0 ? 'text-surface-900' : 'text-emerald-600'],
                        ['Security held', money(totals.security_held), totals.security_held > 0 ? 'text-amber-600' : 'text-surface-400'],
                        ['Advance in hand', money(totals.advance_available), totals.advance_available > 0 ? 'text-sky-600' : 'text-surface-400'],
                    ].map(([label, value, tone]) => (
                        <div key={label} className="card"><div className="card-body !p-3">
                            <p className="text-[10px] uppercase tracking-wider font-bold text-surface-400">{label}</p>
                            <p className={`text-base font-bold mt-1 font-mono ${tone}`}>{value}</p>
                        </div></div>
                    ))}
                </div>

                {/* Security still in their hands — the part of the due that
                    comes back as a release, not as a fresh payment. */}
                {security.length > 0 && (
                    <div className="rounded-2xl border border-amber-200 bg-white shadow-sm overflow-hidden">
                        <div className="px-4 py-3 bg-amber-50 border-b border-amber-100">
                            <h3 className="text-sm font-bold text-amber-900">Security held by this client</h3>
                            <p className="text-[11px] text-amber-700/80 leading-tight mt-0.5">
                                Deducted from payments and not yet returned. Release it from the bill it was cut from.
                            </p>
                        </div>
                        <div className="divide-y divide-amber-100">
                            {security.map((s: any) => (
                                <div key={s.id} className="px-4 py-2.5 flex items-center justify-between gap-3 text-sm">
                                    <span className="min-w-0">
                                        <span className="font-semibold text-surface-800">{s.type}</span>
                                        <span className="text-[11px] text-surface-400">
                                            {' '}· {s.payment_no}{s.deducted_on ? ` · ${s.deducted_on}` : ''}
                                        </span>
                                    </span>
                                    {s.invoice_id && (
                                        <Link href={`/invoices/${s.invoice_id}`} className="text-[11px] font-semibold text-brand-600 hover:underline shrink-0">
                                            {s.invoice}
                                        </Link>
                                    )}
                                    <span className="font-mono font-bold text-amber-700 shrink-0">{money(s.amount)}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Advances — including any with no bill drawn on them yet. */}
                {advances.length > 0 && (
                    <div className="card">
                        <div className="card-header">
                            <h3 className="text-sm font-bold text-surface-900">Advances</h3>
                        </div>
                        <div className="card-body">
                            <PaymentRows payments={advances} canDelete={can.delete} showInvoice />
                        </div>
                    </div>
                )}

                <div className="card">
                    <div className="card-header">
                        <h3 className="text-sm font-bold text-surface-900">
                            Bills <span className="text-surface-400 font-normal">({invoices.length})</span>
                        </h3>
                    </div>
                    <div className="card-body p-0">
                        {invoices.length === 0 ? (
                            <p className="text-xs text-surface-400 text-center py-10">No bills raised for this client.</p>
                        ) : (
                            <div className="divide-y divide-surface-100">
                                {invoices.map((inv: any) => (
                                    <div key={inv.id}>
                                        <button type="button" onClick={() => setOpen(open === inv.id ? null : inv.id)}
                                            className="w-full px-4 py-3 flex items-center gap-3 text-left hover:bg-surface-50/60">
                                            <i className={`fi ${open === inv.id ? 'fi-rr-angle-small-down' : 'fi-rr-angle-small-right'} text-surface-400 text-sm leading-none shrink-0`} />
                                            <div className="min-w-0 flex-1">
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    <span className="font-mono text-xs font-bold text-surface-900">{inv.invoice_number}</span>
                                                    <span className={`text-[10px] px-1.5 py-0.5 rounded border font-bold uppercase ${statusTone[inv.status] ?? 'bg-surface-100 text-surface-600 border-surface-200'}`}>
                                                        {String(inv.status).replace('_', ' ')}
                                                    </span>
                                                    {inv.bucket && inv.bucket !== 'current' && (
                                                        <span className="text-[10px] px-1.5 py-0.5 rounded border font-bold bg-rose-50 text-rose-700 border-rose-200">
                                                            {bucketLabels[inv.bucket]}
                                                        </span>
                                                    )}
                                                </div>
                                                <p className="text-[11px] text-surface-400 mt-0.5">
                                                    {inv.wo_number ?? '—'}{inv.job_number ? ` · Job #${inv.job_number}` : ''}
                                                    {inv.issued ? ` · issued ${inv.issued}` : ''}
                                                    {inv.due_date ? ` · due ${inv.due_date}` : ''}
                                                </p>
                                            </div>
                                            <div className="text-right shrink-0">
                                                <p className="font-mono text-sm font-bold text-surface-900">{money(inv.billed)}</p>
                                                <p className="text-[11px]">
                                                    <span className="text-emerald-700">{money(inv.settled)} settled</span>
                                                    {inv.due > 0.01 && <span className="text-surface-500"> · {money(inv.due)} due</span>}
                                                </p>
                                                {inv.security_held > 0 && (
                                                    <p className="text-[11px] text-amber-700">{money(inv.security_held)} security held</p>
                                                )}
                                            </div>
                                        </button>
                                        {open === inv.id && (
                                            <div className="px-4 pb-4 pl-10 bg-surface-50/40">
                                                <PaymentRows payments={inv.payments} canDelete={can.delete} />
                                                <Link href={`/invoices/${inv.id}`} className="btn-outline btn-sm mt-3">
                                                    Open bill
                                                </Link>
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </AppLayout>
    );
}
