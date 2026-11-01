import AppLayout from '@/Layouts/AppLayout';
import { Head, Link, router, useForm } from '@inertiajs/react';
import { FormEvent, useState } from 'react';
import SearchableSelect from '@/Components/SearchableSelect';

interface Entry {
    id: number;
    customer_id: number | null;
    client: string | null;
    invoice_id: number | null;
    bill_ref: string | null;
    bill: string | null;
    record_date: string;
    date_label: string;
    certificate_no: string | null;
    amount: number;
    remarks: string | null;
    file_name: string | null;
    file_url: string | null;
    entered_by: string | null;
    can_edit: boolean;
    can_delete: boolean;
}

interface Props {
    kind: 'ait' | 'vat';
    labels: { title: string; subtitle: string; certificate: string };
    basePath: string;
    entries: { data: Entry[]; links: any[]; last_page: number; from: number | null; total: number };
    summary: { total: number; count: number };
    filters: { search: string; customer_id: string; date_from: string; date_to: string };
    customers: { id: number; name: string }[];
    invoices: { id: number; number: string; customer_id: number; total: number }[];
    canRecord: boolean;
}

const money = (n: number) => n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const BLANK = {
    customer_id: '' as string | number, invoice_id: '' as string | number, bill_ref: '', record_date: '',
    certificate_no: '', amount: '', remarks: '', file: null as File | null, remove_file: false,
};

/**
 * Billing & Accounts → AIT Records / VAT Records (BITAC, 2026-11-01): what a
 * client deducted at source from BITAC's bills, kept by hand with the
 * certificate. One page for both registers; `kind` says which.
 */
export default function TaxRecordIndex({ kind, labels, basePath, entries, summary, filters, customers, invoices, canRecord }: Props) {
    const other = kind === 'ait' ? { href: '/billing/vat-records', label: 'VAT Records' } : { href: '/billing/ait-records', label: 'AIT Records' };
    const [search, setSearch] = useState(filters.search ?? '');
    const [editing, setEditing] = useState<Entry | 'new' | null>(null);
    const form = useForm({ ...BLANK });

    const go = (patch: Record<string, string>) =>
        router.get(basePath, { ...filters, search, ...patch }, { preserveState: true, preserveScroll: true, replace: true });

    const openNew = () => {
        form.reset();
        form.clearErrors();
        form.setData({ ...BLANK, record_date: new Date().toISOString().slice(0, 10) });
        setEditing('new');
    };
    const openEdit = (e: Entry) => {
        form.clearErrors();
        form.setData({
            customer_id: e.customer_id ?? '', invoice_id: e.invoice_id ?? '', bill_ref: e.bill_ref ?? '',
            record_date: e.record_date, certificate_no: e.certificate_no ?? '', amount: String(e.amount),
            remarks: e.remarks ?? '', file: null, remove_file: false,
        });
        setEditing(e);
    };
    const save = (ev: FormEvent) => {
        ev.preventDefault();
        const url = editing === 'new' ? basePath : `${basePath}/${(editing as Entry).id}`;
        form.post(url, { forceFormData: true, preserveScroll: true, onSuccess: () => setEditing(null) });
    };
    const remove = (e: Entry) => {
        if (!confirm(`Remove this ${kind.toUpperCase()} record (${e.client ?? ''}, ৳ ${money(e.amount)})?`)) return;
        router.delete(`${basePath}/${e.id}`, { preserveScroll: true });
    };

    const clientBills = invoices.filter((i) => String(i.customer_id) === String(form.data.customer_id));
    const hasFilters = !!(filters.search || filters.customer_id || filters.date_from || filters.date_to);

    return (
        <AppLayout header={`Billing & Accounts · ${labels.title}`}>
            <Head title={labels.title} />
            <div className="space-y-5 animate-fade-in">
                <div className="flex flex-col lg:flex-row lg:items-end gap-4 justify-between">
                    <div>
                        <div className="text-[11px] font-bold uppercase tracking-wider text-brand-600">Billing &amp; Accounts</div>
                        <h1 className="text-xl font-bold text-surface-900 leading-snug">{labels.title}</h1>
                        <p className="text-sm text-surface-500">{labels.subtitle}</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                        <Link href={other.href} className="btn-ghost btn-sm">{other.label} →</Link>
                        {canRecord && (
                            <button type="button" onClick={openNew} className="btn-primary">
                                <i className="fi fi-rr-plus text-xs leading-none" /> Add record
                            </button>
                        )}
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-3 max-w-xl">
                    <div className="card card-body !py-3">
                        <div className="text-[11px] uppercase tracking-wider text-surface-500 font-semibold">
                            Total {kind.toUpperCase()}{hasFilters ? ' (filtered)' : ''}
                        </div>
                        <div className="text-lg font-bold text-surface-900 tabular-nums mt-0.5">৳ {money(summary.total)}</div>
                    </div>
                    <div className="card card-body !py-3">
                        <div className="text-[11px] uppercase tracking-wider text-surface-500 font-semibold">Records</div>
                        <div className="text-lg font-bold text-surface-900 tabular-nums mt-0.5">{summary.count}</div>
                    </div>
                </div>

                <div className="card">
                    <div className="card-body border-b border-surface-100 grid grid-cols-1 md:grid-cols-[1fr_220px_auto_auto_auto] gap-3">
                        <div className="relative">
                            <i className="fi fi-rr-search absolute left-3 top-1/2 -translate-y-1/2 text-[11px] leading-none text-surface-400" />
                            <input className="form-input !pl-9" value={search} placeholder="Client, bill, certificate no., remarks…"
                                onChange={(e) => setSearch(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && go({ search })} />
                        </div>
                        <SearchableSelect value={filters.customer_id ? Number(filters.customer_id) : ''} placeholder="All clients"
                            options={customers.map((c) => ({ value: c.id, label: c.name }))}
                            onChange={(v) => go({ customer_id: v ? String(v) : '' })} />
                        <input type="date" className="form-input" value={filters.date_from ?? ''} title="From"
                            onChange={(e) => go({ date_from: e.target.value })} />
                        <input type="date" className="form-input" value={filters.date_to ?? ''} title="To"
                            onChange={(e) => go({ date_to: e.target.value })} />
                        {hasFilters
                            ? <button type="button" className="btn-ghost" onClick={() => { setSearch(''); router.get(basePath); }}>Clear</button>
                            : <button type="button" className="btn-outline" onClick={() => go({ search })}>Search</button>}
                    </div>

                    {entries.data.length === 0 ? (
                        <div className="text-center py-14">
                            <div className="w-12 h-12 rounded-xl bg-surface-100 flex items-center justify-center mx-auto mb-3">
                                <i className="fi fi-rr-document-signed text-surface-400 text-base leading-none" />
                            </div>
                            <p className="text-sm font-semibold text-surface-700">
                                {hasFilters ? 'No record matches these filters' : `No ${kind.toUpperCase()} records yet`}
                            </p>
                            {!hasFilters && canRecord && (
                                <button type="button" onClick={openNew} className="btn-primary btn-sm mt-3">Add the first record</button>
                            )}
                        </div>
                    ) : (
                        <>
                            <div className="hidden md:block overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="border-b border-surface-100 text-[11px] uppercase tracking-wider text-surface-500 font-bold">
                                            <th className="text-right px-4 py-2.5 w-12">Sl</th>
                                            <th className="text-left px-3 py-2.5 w-28">Date</th>
                                            <th className="text-left px-3 py-2.5">Client</th>
                                            <th className="text-left px-3 py-2.5">Bill No.</th>
                                            <th className="text-left px-3 py-2.5">{labels.certificate}</th>
                                            <th className="text-right px-3 py-2.5">Amount (৳)</th>
                                            <th className="text-left px-3 py-2.5">Remarks</th>
                                            <th className="px-4 py-2.5 w-28" />
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {entries.data.map((e, i) => (
                                            <tr key={e.id} className="border-b border-surface-50 hover:bg-surface-50/60 align-top">
                                                <td className="px-4 py-2.5 text-right text-xs text-surface-400 tabular-nums">{(entries.from ?? 1) + i}</td>
                                                <td className="px-3 py-2.5 text-xs text-surface-600 whitespace-nowrap">{e.date_label}</td>
                                                <td className="px-3 py-2.5 text-surface-900">{e.client ?? '—'}</td>
                                                <td className="px-3 py-2.5 font-mono text-xs text-surface-700">
                                                    {e.invoice_id
                                                        ? <Link href={`/invoices/${e.invoice_id}`} className="text-brand-600 hover:underline">{e.bill}</Link>
                                                        : (e.bill || '—')}
                                                </td>
                                                <td className="px-3 py-2.5 font-mono text-xs text-surface-700 break-all">{e.certificate_no || '—'}</td>
                                                <td className="px-3 py-2.5 text-right font-semibold text-surface-900 tabular-nums">{money(e.amount)}</td>
                                                <td className="px-3 py-2.5 text-xs text-surface-600 whitespace-pre-line">{e.remarks || '—'}</td>
                                                <td className="px-4 py-2.5"><Actions e={e} onEdit={() => openEdit(e)} onRemove={() => remove(e)} /></td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                            <div className="md:hidden divide-y divide-surface-100">
                                {entries.data.map((e, i) => (
                                    <div key={e.id} className="p-4 space-y-1">
                                        <div className="flex items-start justify-between gap-3">
                                            <div className="text-xs text-surface-400">#{(entries.from ?? 1) + i} · {e.date_label}</div>
                                            <Actions e={e} onEdit={() => openEdit(e)} onRemove={() => remove(e)} />
                                        </div>
                                        <div className="flex items-baseline justify-between gap-3">
                                            <span className="text-sm font-semibold text-surface-900 min-w-0">{e.client ?? '—'}</span>
                                            <span className="text-sm font-bold tabular-nums">৳ {money(e.amount)}</span>
                                        </div>
                                        <div className="text-xs text-surface-600">
                                            {e.bill && <>Bill <span className="font-mono">{e.bill}</span></>}
                                            {e.certificate_no && <> · <span className="font-mono">{e.certificate_no}</span></>}
                                        </div>
                                        {e.remarks && <div className="text-xs text-surface-500 whitespace-pre-line">{e.remarks}</div>}
                                    </div>
                                ))}
                            </div>
                        </>
                    )}
                </div>

                {entries.last_page > 1 && (
                    <div className="flex flex-wrap items-center justify-center gap-1.5">
                        {entries.links.map((link: any, i: number) => (
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
                    <form onSubmit={save} className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[92vh] overflow-y-auto">
                        <div className="px-5 py-3 border-b border-surface-100">
                            <h3 className="text-sm font-bold text-surface-900">
                                {editing === 'new' ? `Add ${kind.toUpperCase()} record` : `Edit ${kind.toUpperCase()} record`}
                            </h3>
                            <p className="text-[11px] text-surface-500 mt-0.5">{labels.subtitle}</p>
                        </div>
                        <div className="p-5 space-y-4">
                            <div>
                                <label className="form-label">Client *</label>
                                <SearchableSelect value={form.data.customer_id === '' ? '' : Number(form.data.customer_id)} required
                                    options={customers.map((c) => ({ value: c.id, label: c.name }))}
                                    onChange={(v) => form.setData((d) => ({ ...d, customer_id: v, invoice_id: '' }))}
                                    placeholder="Select the client" />
                                {form.errors.customer_id && <p className="form-error">{form.errors.customer_id}</p>}
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                    <label className="form-label">Bill <span className="form-label-optional">optional</span></label>
                                    <select className="form-input" value={form.data.invoice_id} disabled={!form.data.customer_id}
                                        onChange={(e) => form.setData('invoice_id', e.target.value)}>
                                        <option value="">{form.data.customer_id ? '— Not in the system —' : 'Pick the client first'}</option>
                                        {clientBills.map((b) => <option key={b.id} value={b.id}>{b.number} · ৳ {money(b.total)}</option>)}
                                    </select>
                                    {form.errors.invoice_id && <p className="form-error">{form.errors.invoice_id}</p>}
                                </div>
                                {!form.data.invoice_id && (
                                    <div>
                                        <label className="form-label">Bill No. <span className="form-label-optional">typed</span></label>
                                        <input className="form-input font-mono" value={form.data.bill_ref}
                                            onChange={(e) => form.setData('bill_ref', e.target.value)} placeholder="e.g. an older bill" />
                                    </div>
                                )}
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                    <label className="form-label">Date *</label>
                                    <input type="date" className="form-input" value={form.data.record_date} required
                                        onChange={(e) => form.setData('record_date', e.target.value)} />
                                    {form.errors.record_date && <p className="form-error">{form.errors.record_date}</p>}
                                </div>
                                <div>
                                    <label className="form-label">Amount (৳) *</label>
                                    <input type="number" step="0.01" min="0.01" className="form-input text-right tabular-nums" value={form.data.amount} required
                                        onChange={(e) => form.setData('amount', e.target.value)} />
                                    {form.errors.amount && <p className="form-error">{form.errors.amount}</p>}
                                </div>
                            </div>
                            <div>
                                <label className="form-label">{labels.certificate}</label>
                                <input className="form-input font-mono" value={form.data.certificate_no}
                                    onChange={(e) => form.setData('certificate_no', e.target.value)} />
                                {form.errors.certificate_no && <p className="form-error">{form.errors.certificate_no}</p>}
                            </div>
                            <div>
                                <label className="form-label">Remarks</label>
                                <textarea rows={2} className="form-textarea" value={form.data.remarks}
                                    onChange={(e) => form.setData('remarks', e.target.value)} />
                            </div>
                            <div>
                                <label className="form-label">Certificate / challan file <span className="form-label-optional">PDF or image, up to 10 MB</span></label>
                                {editing !== 'new' && (editing as Entry).file_url && !form.data.remove_file && (
                                    <div className="flex items-center gap-2 text-xs mb-1.5">
                                        <a href={(editing as Entry).file_url!} target="_blank" rel="noopener" className="text-brand-600 font-semibold truncate">
                                            <i className="fi fi-rr-clip mr-1" />{(editing as Entry).file_name}
                                        </a>
                                        <button type="button" className="text-rose-600 font-semibold" onClick={() => form.setData('remove_file', true)}>Remove</button>
                                    </div>
                                )}
                                <input type="file" accept="application/pdf,image/*" className="form-input"
                                    onChange={(e) => form.setData('file', e.target.files?.[0] ?? null)} />
                                {form.errors.file && <p className="form-error">{form.errors.file}</p>}
                            </div>
                        </div>
                        <div className="px-5 py-3 border-t border-surface-100 flex justify-end gap-2">
                            <button type="button" onClick={() => setEditing(null)} disabled={form.processing} className="btn-ghost">Cancel</button>
                            <button type="submit" disabled={form.processing} className="btn-primary">{form.processing ? 'Saving…' : 'Save'}</button>
                        </div>
                    </form>
                </div>
            )}
        </AppLayout>
    );
}

function Actions({ e, onEdit, onRemove }: { e: Entry; onEdit: () => void; onRemove: () => void }) {
    return (
        <div className="flex items-center justify-end gap-1">
            {e.file_url && (
                <a href={e.file_url} target="_blank" rel="noopener" title={e.file_name ?? 'Certificate'}
                    className="w-7 h-7 inline-flex items-center justify-center rounded-lg text-brand-600 hover:bg-brand-50">
                    <i className="fi fi-rr-clip text-xs leading-none" />
                </a>
            )}
            {e.can_edit && (
                <button type="button" onClick={onEdit} title="Edit"
                    className="w-7 h-7 inline-flex items-center justify-center rounded-lg text-surface-500 hover:bg-surface-100">
                    <i className="fi fi-rr-pencil text-xs leading-none" />
                </button>
            )}
            {e.can_delete && (
                <button type="button" onClick={onRemove} title="Remove"
                    className="w-7 h-7 inline-flex items-center justify-center rounded-lg text-red-500 hover:bg-red-50">
                    <i className="fi fi-rr-trash text-xs leading-none" />
                </button>
            )}
        </div>
    );
}
