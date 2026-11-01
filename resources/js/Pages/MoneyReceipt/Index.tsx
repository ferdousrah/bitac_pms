import AppLayout from '@/Layouts/AppLayout';
import { Head, Link, router, useForm } from '@inertiajs/react';
import { FormEvent, useState } from 'react';
import SearchableSelect from '@/Components/SearchableSelect';
import PdfPopupModal from '@/Components/PdfPopupModal';

interface Receipt {
    id: number;
    receipt_no: string;
    receipt_date: string;
    date_label: string;
    customer_id: number | null;
    payer_name: string;
    purpose: string;
    method: 'cash' | 'cheque';
    cheque_no: string | null;
    cheque_date: string | null;
    bank_name: string | null;
    received_through: string | null;
    amount: number;
    details: string | null;
    invoice_id: number | null;
    bill: string | null;
    status: 'issued' | 'cancelled';
    cancel_reason: string | null;
    entered_by: string | null;
    pdf_url: string;
    can_edit: boolean;
}

interface Props {
    receipts: { data: Receipt[]; links: any[]; last_page: number; from: number | null; total: number };
    summary: { total: number; cash: number; cheque: number; count: number };
    filters: { search: string; customer_id: string; method: string; date_from: string; date_to: string };
    customers: { id: number; name: string }[];
    invoices: { id: number; number: string; customer_id: number; total: number }[];
    nextNo: string;
    canRecord: boolean;
}

const BASE = '/billing/money-receipts';
const money = (n: number) => n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const BLANK = {
    receipt_no: '', receipt_date: '', customer_id: '' as string | number, other: false, payer_name: '',
    purpose: '', method: 'cash' as 'cash' | 'cheque', cheque_no: '', cheque_date: '', bank_name: '',
    received_through: '', amount: '', details: '', invoice_id: '' as string | number,
};

/**
 * Billing & Accounts → Money Receipt (BITAC, 2026-11-01): a receipt for an
 * organisation that pays in cash or by cheque, printed like BITAC's receipt
 * book. A book of its own — it moves no bill's dues.
 */
export default function MoneyReceiptIndex({ receipts, summary, filters, customers, invoices, nextNo, canRecord }: Props) {
    const [search, setSearch] = useState(filters.search ?? '');
    const [editing, setEditing] = useState<Receipt | 'new' | null>(null);
    const [pdf, setPdf] = useState<Receipt | null>(null);
    const form = useForm({ ...BLANK });
    const d = form.data;

    const go = (patch: Record<string, string>) =>
        router.get(BASE, { ...filters, search, ...patch }, { preserveState: true, preserveScroll: true, replace: true });

    const openNew = () => {
        form.clearErrors();
        form.setData({ ...BLANK, receipt_date: new Date().toISOString().slice(0, 10) });
        setEditing('new');
    };
    const openEdit = (r: Receipt) => {
        form.clearErrors();
        form.setData({
            receipt_no: r.receipt_no, receipt_date: r.receipt_date, customer_id: r.customer_id ?? '',
            other: !r.customer_id, payer_name: r.customer_id ? '' : r.payer_name, purpose: r.purpose, method: r.method,
            cheque_no: r.cheque_no ?? '', cheque_date: r.cheque_date ?? '', bank_name: r.bank_name ?? '',
            received_through: r.received_through ?? '', amount: String(r.amount), details: r.details ?? '',
            invoice_id: r.invoice_id ?? '',
        });
        setEditing(r);
    };
    const save = (ev: FormEvent) => {
        ev.preventDefault();
        const url = editing === 'new' ? BASE : `${BASE}/${(editing as Receipt).id}`;
        form.transform((x) => ({ ...x, customer_id: x.other ? '' : x.customer_id, payer_name: x.other ? x.payer_name : '' }));
        form.post(url, { preserveScroll: true, onSuccess: () => setEditing(null) });
    };
    const cancel = (r: Receipt) => {
        const reason = prompt(`Cancel receipt ${r.receipt_no}? It stays in the book, marked cancelled. Reason:`);
        if (reason === null) return;
        if (reason.trim().length < 3) { alert('Give a reason.'); return; }
        router.post(`${BASE}/${r.id}/cancel`, { reason }, { preserveScroll: true });
    };

    const clientBills = invoices.filter((i) => String(i.customer_id) === String(d.customer_id));
    const hasFilters = !!(filters.search || filters.customer_id || filters.method || filters.date_from || filters.date_to);

    return (
        <AppLayout header="Billing & Accounts · Money Receipt">
            <Head title="Money Receipt" />
            <div className="space-y-5 animate-fade-in">
                <div className="flex flex-col lg:flex-row lg:items-end gap-4 justify-between">
                    <div>
                        <div className="text-[11px] font-bold uppercase tracking-wider text-brand-600">Billing &amp; Accounts</div>
                        <h1 className="text-xl font-bold text-surface-900 leading-snug">Money Receipt</h1>
                        <p className="text-sm text-surface-500">
                            A receipt for cash or a cheque received from an organisation. Its own book — it does not change any bill's dues.
                        </p>
                    </div>
                    {canRecord && (
                        <button type="button" onClick={openNew} className="btn-primary shrink-0">
                            <i className="fi fi-rr-plus text-xs leading-none" /> New receipt
                        </button>
                    )}
                </div>

                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                    {([
                        ['Received' + (hasFilters ? ' (filtered)' : ''), `৳ ${money(summary.total)}`],
                        ['Cash', `৳ ${money(summary.cash)}`],
                        ['Cheque', `৳ ${money(summary.cheque)}`],
                        ['Receipts', String(summary.count)],
                    ] as const).map(([label, value]) => (
                        <div key={label} className="card card-body !py-3">
                            <div className="text-[11px] uppercase tracking-wider text-surface-500 font-semibold">{label}</div>
                            <div className="text-lg font-bold text-surface-900 tabular-nums mt-0.5">{value}</div>
                        </div>
                    ))}
                </div>

                <div className="card">
                    <div className="card-body border-b border-surface-100 grid grid-cols-1 md:grid-cols-[1fr_220px_130px_auto_auto_auto] gap-3">
                        <div className="relative">
                            <i className="fi fi-rr-search absolute left-3 top-1/2 -translate-y-1/2 text-[11px] leading-none text-surface-400" />
                            <input className="form-input !pl-9" value={search} placeholder="Receipt no., organisation, purpose, cheque no.…"
                                onChange={(e) => setSearch(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && go({ search })} />
                        </div>
                        <SearchableSelect value={filters.customer_id ? Number(filters.customer_id) : ''} placeholder="All organisations"
                            options={customers.map((c) => ({ value: c.id, label: c.name }))}
                            onChange={(v) => go({ customer_id: v ? String(v) : '' })} />
                        <select className="form-input" value={filters.method ?? ''} onChange={(e) => go({ method: e.target.value })}>
                            <option value="">Cash &amp; cheque</option>
                            <option value="cash">Cash</option>
                            <option value="cheque">Cheque</option>
                        </select>
                        <input type="date" className="form-input" value={filters.date_from ?? ''} title="From"
                            onChange={(e) => go({ date_from: e.target.value })} />
                        <input type="date" className="form-input" value={filters.date_to ?? ''} title="To"
                            onChange={(e) => go({ date_to: e.target.value })} />
                        {hasFilters
                            ? <button type="button" className="btn-ghost" onClick={() => { setSearch(''); router.get(BASE); }}>Clear</button>
                            : <button type="button" className="btn-outline" onClick={() => go({ search })}>Search</button>}
                    </div>

                    {receipts.data.length === 0 ? (
                        <div className="text-center py-14">
                            <div className="w-12 h-12 rounded-xl bg-surface-100 flex items-center justify-center mx-auto mb-3">
                                <i className="fi fi-rr-money-bill-wave text-surface-400 text-base leading-none" />
                            </div>
                            <p className="text-sm font-semibold text-surface-700">
                                {hasFilters ? 'No receipt matches these filters' : 'No money receipts yet'}
                            </p>
                            {!hasFilters && canRecord && (
                                <button type="button" onClick={openNew} className="btn-primary btn-sm mt-3">Issue the first receipt</button>
                            )}
                        </div>
                    ) : (
                        <>
                            <div className="hidden md:block overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="border-b border-surface-100 text-[11px] uppercase tracking-wider text-surface-500 font-bold">
                                            <th className="text-right px-4 py-2.5 w-12">Sl</th>
                                            <th className="text-left px-3 py-2.5">Receipt No.</th>
                                            <th className="text-left px-3 py-2.5 w-28">Date</th>
                                            <th className="text-left px-3 py-2.5">Organisation</th>
                                            <th className="text-left px-3 py-2.5">Purpose (বাবদ)</th>
                                            <th className="text-left px-3 py-2.5">Cash / Cheque</th>
                                            <th className="text-right px-3 py-2.5">Amount (৳)</th>
                                            <th className="px-4 py-2.5 w-28" />
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {receipts.data.map((r, i) => (
                                            <tr key={r.id} className={`border-b border-surface-50 hover:bg-surface-50/60 align-top ${r.status === 'cancelled' ? 'opacity-60' : ''}`}>
                                                <td className="px-4 py-2.5 text-right text-xs text-surface-400 tabular-nums">{(receipts.from ?? 1) + i}</td>
                                                <td className="px-3 py-2.5 font-mono text-xs font-semibold text-surface-800">
                                                    {r.receipt_no}
                                                    {r.status === 'cancelled' && <span className="badge badge-red ml-1.5 font-sans">Cancelled</span>}
                                                </td>
                                                <td className="px-3 py-2.5 text-xs text-surface-600 whitespace-nowrap">{r.date_label}</td>
                                                <td className="px-3 py-2.5 text-surface-900">
                                                    {r.payer_name}
                                                    {r.bill && <div className="text-[11px] text-surface-500">Bill <Link href={`/invoices/${r.invoice_id}`} className="font-mono text-brand-600 hover:underline">{r.bill}</Link></div>}
                                                </td>
                                                <td className="px-3 py-2.5 text-surface-700">
                                                    {r.purpose}
                                                    {r.details && <div className="text-[11px] text-surface-500">{r.details}</div>}
                                                    {r.status === 'cancelled' && r.cancel_reason && <div className="text-[11px] text-red-600">Cancelled: {r.cancel_reason}</div>}
                                                </td>
                                                <td className="px-3 py-2.5 text-xs text-surface-600">
                                                    {r.method === 'cash' ? 'Cash' : <>Cheque <span className="font-mono">{r.cheque_no}</span>{r.bank_name && <div>{r.bank_name}</div>}</>}
                                                </td>
                                                <td className={`px-3 py-2.5 text-right font-semibold tabular-nums ${r.status === 'cancelled' ? 'line-through text-surface-400' : 'text-surface-900'}`}>{money(r.amount)}</td>
                                                <td className="px-4 py-2.5"><Actions r={r} onPdf={() => setPdf(r)} onEdit={() => openEdit(r)} onCancel={() => cancel(r)} /></td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                            <div className="md:hidden divide-y divide-surface-100">
                                {receipts.data.map((r) => (
                                    <div key={r.id} className={`p-4 space-y-1 ${r.status === 'cancelled' ? 'opacity-60' : ''}`}>
                                        <div className="flex items-start justify-between gap-3">
                                            <div className="text-xs text-surface-500">
                                                <span className="font-mono font-semibold text-surface-800">{r.receipt_no}</span> · {r.date_label}
                                                {r.status === 'cancelled' && <span className="badge badge-red ml-1.5">Cancelled</span>}
                                            </div>
                                            <Actions r={r} onPdf={() => setPdf(r)} onEdit={() => openEdit(r)} onCancel={() => cancel(r)} />
                                        </div>
                                        <div className="flex items-baseline justify-between gap-3">
                                            <span className="text-sm font-semibold text-surface-900 min-w-0">{r.payer_name}</span>
                                            <span className="text-sm font-bold tabular-nums">৳ {money(r.amount)}</span>
                                        </div>
                                        <div className="text-xs text-surface-600">{r.purpose} · {r.method === 'cash' ? 'Cash' : `Cheque ${r.cheque_no ?? ''}`}</div>
                                    </div>
                                ))}
                            </div>
                        </>
                    )}
                </div>

                {receipts.last_page > 1 && (
                    <div className="flex flex-wrap items-center justify-center gap-1.5">
                        {receipts.links.map((link: any, i: number) => (
                            link.url ? (
                                <Link key={i} href={link.url} preserveScroll
                                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${link.active
                                        ? 'bg-brand-500 text-white border-brand-500'
                                        : 'bg-white text-surface-600 border-surface-200 hover:bg-surface-50'}`}
                                    dangerouslySetInnerHTML={{ __html: link.label }} />
                            ) : (
                                <span key={i} className="px-3 py-1.5 text-xs text-surface-300" dangerouslySetInnerHTML={{ __html: link.label }} />
                            )
                        ))}
                    </div>
                )}
            </div>

            {editing && (
                <div className="fixed inset-0 z-[150] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => !form.processing && setEditing(null)} />
                    <form onSubmit={save} className="relative bg-white rounded-2xl shadow-2xl w-full max-w-xl max-h-[92vh] overflow-y-auto">
                        <div className="px-5 py-3 border-b border-surface-100">
                            <h3 className="text-sm font-bold text-surface-900">{editing === 'new' ? 'New money receipt' : `Edit receipt ${(editing as Receipt).receipt_no}`}</h3>
                            <p className="text-[11px] text-surface-500 mt-0.5">Prints on the receipt book's layout — the payer's copy and the office copy on one sheet.</p>
                        </div>
                        <div className="p-5 space-y-4">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                    <label className="form-label">Receipt No. <span className="form-label-optional">blank = {editing === 'new' ? nextNo : 'keep'}</span></label>
                                    <input className="form-input font-mono" value={d.receipt_no} placeholder={editing === 'new' ? nextNo : ''}
                                        onChange={(e) => form.setData('receipt_no', e.target.value)} />
                                    {form.errors.receipt_no && <p className="form-error">{form.errors.receipt_no}</p>}
                                </div>
                                <div>
                                    <label className="form-label">Date *</label>
                                    <input type="date" className="form-input" value={d.receipt_date} required
                                        onChange={(e) => form.setData('receipt_date', e.target.value)} />
                                    {form.errors.receipt_date && <p className="form-error">{form.errors.receipt_date}</p>}
                                </div>
                            </div>

                            <div>
                                <label className="form-label">Received from (organisation) *</label>
                                {!d.other ? (
                                    <SearchableSelect value={d.customer_id === '' ? '' : Number(d.customer_id)}
                                        options={customers.map((c) => ({ value: c.id, label: c.name }))}
                                        onChange={(v) => form.setData((x) => ({ ...x, customer_id: v, invoice_id: '' }))}
                                        placeholder="Select the organisation" />
                                ) : (
                                    <input className="form-input" value={d.payer_name} placeholder="Name of the organisation"
                                        onChange={(e) => form.setData('payer_name', e.target.value)} />
                                )}
                                <button type="button" className="text-[11px] font-semibold text-brand-600 mt-1"
                                    onClick={() => form.setData((x) => ({ ...x, other: !x.other, customer_id: '', payer_name: '', invoice_id: '' }))}>
                                    {d.other ? '← Pick from the list' : 'Not on the list? Type the name'}
                                </button>
                                {(form.errors.customer_id || form.errors.payer_name) && <p className="form-error">{form.errors.customer_id ?? form.errors.payer_name}</p>}
                            </div>

                            <div>
                                <label className="form-label">Purpose — অত্র কেন্দ্রের … বাবদ *</label>
                                <input className="form-input" value={d.purpose} required placeholder="e.g. প্রশিক্ষণ ফি / টেস্টিং ফি / job work"
                                    onChange={(e) => form.setData('purpose', e.target.value)} />
                                {form.errors.purpose && <p className="form-error">{form.errors.purpose}</p>}
                            </div>

                            <div>
                                <label className="form-label">Paid by *</label>
                                <div className="inline-flex rounded-xl bg-surface-100 p-1">
                                    {(['cash', 'cheque'] as const).map((m) => (
                                        <button key={m} type="button" onClick={() => form.setData('method', m)}
                                            className={`px-4 py-1.5 rounded-lg text-sm font-semibold ${d.method === m ? 'bg-white shadow-sm text-surface-900' : 'text-surface-500'}`}>
                                            {m === 'cash' ? 'Cash (নগদ)' : 'Cheque (চেক)'}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            {d.method === 'cheque' && (
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                    <div>
                                        <label className="form-label">Cheque No. *</label>
                                        <input className="form-input font-mono" value={d.cheque_no} onChange={(e) => form.setData('cheque_no', e.target.value)} />
                                        {form.errors.cheque_no && <p className="form-error">{form.errors.cheque_no}</p>}
                                    </div>
                                    <div>
                                        <label className="form-label">Cheque date</label>
                                        <input type="date" className="form-input" value={d.cheque_date} onChange={(e) => form.setData('cheque_date', e.target.value)} />
                                    </div>
                                    <div>
                                        <label className="form-label">Bank</label>
                                        <input className="form-input" value={d.bank_name} onChange={(e) => form.setData('bank_name', e.target.value)} />
                                    </div>
                                </div>
                            )}

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                    <label className="form-label">Amount (৳) *</label>
                                    <input type="number" step="0.01" min="0.01" className="form-input text-right tabular-nums" value={d.amount} required
                                        onChange={(e) => form.setData('amount', e.target.value)} />
                                    {form.errors.amount && <p className="form-error">{form.errors.amount}</p>}
                                </div>
                                <div>
                                    <label className="form-label">Through (মারফত) <span className="form-label-optional">who brought it</span></label>
                                    <input className="form-input" value={d.received_through} onChange={(e) => form.setData('received_through', e.target.value)} />
                                </div>
                            </div>
                            <div>
                                <label className="form-label">Details <span className="form-label-optional">printed under the amount</span></label>
                                <input className="form-input" value={d.details} placeholder="e.g. ৩০ জন × ২৬০ = ৭৮০০"
                                    onChange={(e) => form.setData('details', e.target.value)} />
                            </div>
                            {!d.other && d.customer_id !== '' && clientBills.length > 0 && (
                                <div>
                                    <label className="form-label">Against a bill <span className="form-label-optional">optional — for reference only</span></label>
                                    <select className="form-input" value={d.invoice_id} onChange={(e) => form.setData('invoice_id', e.target.value)}>
                                        <option value="">— None —</option>
                                        {clientBills.map((b) => <option key={b.id} value={b.id}>{b.number} · ৳ {money(b.total)}</option>)}
                                    </select>
                                    <p className="text-[11px] text-surface-500 mt-1">This does not settle the bill — record the payment on the bill itself.</p>
                                    {form.errors.invoice_id && <p className="form-error">{form.errors.invoice_id}</p>}
                                </div>
                            )}
                        </div>
                        <div className="px-5 py-3 border-t border-surface-100 flex justify-end gap-2">
                            <button type="button" onClick={() => setEditing(null)} disabled={form.processing} className="btn-ghost">Cancel</button>
                            <button type="submit" disabled={form.processing} className="btn-primary">
                                {form.processing ? 'Saving…' : editing === 'new' ? 'Issue receipt' : 'Save'}
                            </button>
                        </div>
                    </form>
                </div>
            )}

            <PdfPopupModal
                open={!!pdf}
                pdfUrl={pdf ? pdf.pdf_url : null}
                title={pdf ? `Money Receipt ${pdf.receipt_no}` : ''}
                subtitle={pdf?.payer_name}
                onClose={() => setPdf(null)}
            />
        </AppLayout>
    );
}

function Actions({ r, onPdf, onEdit, onCancel }: { r: Receipt; onPdf: () => void; onEdit: () => void; onCancel: () => void }) {
    return (
        <div className="flex items-center justify-end gap-1">
            <button type="button" onClick={onPdf} title="View / print"
                className="w-7 h-7 inline-flex items-center justify-center rounded-lg text-brand-600 hover:bg-brand-50">
                <i className="fi fi-rr-print text-xs leading-none" />
            </button>
            {r.can_edit && (
                <>
                    <button type="button" onClick={onEdit} title="Edit"
                        className="w-7 h-7 inline-flex items-center justify-center rounded-lg text-surface-500 hover:bg-surface-100">
                        <i className="fi fi-rr-pencil text-xs leading-none" />
                    </button>
                    <button type="button" onClick={onCancel} title="Cancel receipt"
                        className="w-7 h-7 inline-flex items-center justify-center rounded-lg text-red-500 hover:bg-red-50">
                        <i className="fi fi-rr-ban text-xs leading-none" />
                    </button>
                </>
            )}
        </div>
    );
}
