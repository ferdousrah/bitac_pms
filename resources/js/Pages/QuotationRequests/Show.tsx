import AppLayout from '@/Layouts/AppLayout';
import { Link, router, useForm } from '@inertiajs/react';
import { ReactNode, useMemo, useState } from 'react';
import { QR_STATUS_BADGE } from './Index';

interface QrFile { id: number; name: string; size: number; is_image: boolean; is_pdf: boolean; url: string }
interface Customer { id: number; name: string; contact_person: string | null; email: string | null; phone: string | null }

const BN = '০১২৩৪৫৬৭৮৯';
const telHref = (n: string) => 'tel:' + n.replace(/[০-৯]/g, (d) => String(BN.indexOf(d))).replace(/[^\d+]/g, '');
const fmtSize = (b: number) => (b >= 1048576 ? `${(b / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`);

export default function QuotationRequestShow({ request: r, customers, suggestedCustomerId, settable, can }: {
    request: any; customers: Customer[]; suggestedCustomerId: number | null; settable: Record<string, string>;
    can: { edit: boolean; convert: boolean };
}) {
    const converted = r.status === 'converted';
    const files: QrFile[] = r.files;
    const images = files.filter((f) => f.is_image);
    const others = files.filter((f) => !f.is_image);

    const handling = useForm({ status: r.status, staff_note: r.staff_note ?? '' });
    const conv = useForm({ customer_id: suggestedCustomerId ? String(suggestedCustomerId) : '' });
    const [query, setQuery] = useState('');

    const suggested = customers.find((c) => c.id === suggestedCustomerId);
    const shown = useMemo(() => {
        const q = query.trim().toLowerCase();
        if (!q) return customers;
        return customers.filter((c) => [c.name, c.contact_person, c.email, c.phone].some((v) => (v ?? '').toLowerCase().includes(q)));
    }, [customers, query]);

    const saveHandling = () => handling.put(`/ied/quotation-requests/${r.id}`, { preserveScroll: true });
    const convert = () => {
        const c = customers.find((x) => String(x.id) === conv.data.customer_id);
        if (!c) return;
        if (confirm(`Create a draft RFQ for ${c.name} from ${r.reference_no}?\n\nThe job, quantity, date and ${files.length} file(s) will be copied into it. Nothing is sent to anyone.`)) {
            conv.post(`/ied/quotation-requests/${r.id}/convert`);
        }
    };
    const destroy = () => {
        if (confirm(`Delete ${r.reference_no} and its ${files.length} file(s)? This cannot be undone.`)) {
            router.delete(`/ied/quotation-requests/${r.id}`);
        }
    };

    return (
        <AppLayout header="Quote Request">
            <div className="space-y-6 animate-fade-in">
                <div className="flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
                    <div className="flex items-center gap-3 min-w-0">
                        <Link href="/ied/quotation-requests" className="btn-ghost btn-sm shrink-0">
                            <i className="fi fi-rr-arrow-left text-xs leading-none" /> All requests
                        </Link>
                        <h1 className="font-mono text-lg font-bold text-surface-900">{r.reference_no}</h1>
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider border ${QR_STATUS_BADGE[r.status] ?? QR_STATUS_BADGE.closed}`}>
                            {r.status_label}
                        </span>
                    </div>
                    <div className="text-xs text-surface-500">Received {r.created_at} · {r.age}</div>
                </div>

                {converted && r.rfq && (
                    <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-4 flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
                        <div className="text-sm text-emerald-900">
                            Converted to <span className="font-bold">draft RFQ #{r.rfq.id}</span>
                            {r.customer && <> for <span className="font-bold">{r.customer.name}</span></>}
                            {r.converted_at && <> on {r.converted_at}</>}.
                            {r.rfq.status === 'draft' && ' It is still a draft — complete and submit it from the RFQ.'}
                        </div>
                        <Link href={r.rfq.status === 'draft' ? `/rfqs/${r.rfq.id}/edit` : `/rfqs/${r.rfq.id}`} className="btn-primary btn-sm shrink-0">
                            Open RFQ #{r.rfq.id} <i className="fi fi-rr-arrow-right text-[10px] leading-none" />
                        </Link>
                    </div>
                )}

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
                    <div className="lg:col-span-2 space-y-6">
                        <Card title="The job">
                            <h2 className="text-lg font-bold text-surface-900">{r.subject}</h2>
                            <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
                                <Fact label="Quantity" value={r.quantity != null ? `${r.quantity} ${r.unit ?? ''}` : '—'} />
                                <Fact label="Needed by" value={r.needed_by ?? '—'} />
                                <Fact label="Centre asked" value={r.office?.name ?? '—'} />
                            </div>
                            <p className="mt-5 text-[15px] text-surface-800 leading-relaxed whitespace-pre-wrap break-words">{r.description}</p>
                        </Card>

                        <Card title={`Attachments (${files.length})`}>
                            {files.length === 0 ? (
                                <p className="text-sm text-surface-500">No files were attached. Ask for a drawing or a sample if the job needs one.</p>
                            ) : (
                                <div className="space-y-4">
                                    {images.length > 0 && (
                                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                                            {images.map((f) => (
                                                <a key={f.id} href={f.url} target="_blank" rel="noopener" className="group block rounded-xl border border-surface-200 overflow-hidden">
                                                    <img src={f.url} alt={f.name} className="w-full aspect-[4/3] object-cover bg-surface-50 group-hover:opacity-90" loading="lazy" />
                                                    <div className="px-2.5 py-1.5 text-[11px] text-surface-700 truncate">{f.name}</div>
                                                </a>
                                            ))}
                                        </div>
                                    )}
                                    {others.length > 0 && (
                                        <ul className="divide-y divide-surface-100 rounded-xl border border-surface-200">
                                            {others.map((f) => (
                                                <li key={f.id} className="flex items-center gap-3 px-4 py-2.5">
                                                    <i className={`fi ${f.is_pdf ? 'fi-rr-file-pdf text-rose-500' : 'fi-rr-file text-surface-500'} text-sm leading-none`} />
                                                    <span className="flex-1 min-w-0 truncate text-sm text-surface-900">{f.name}</span>
                                                    <span className="text-xs text-surface-500 tabular-nums">{fmtSize(f.size)}</span>
                                                    <a href={f.url} target="_blank" rel="noopener" className="btn-ghost btn-xs">
                                                        {f.is_pdf ? 'Open' : 'Download'}
                                                    </a>
                                                </li>
                                            ))}
                                        </ul>
                                    )}
                                    <p className="text-[11px] text-surface-500">Sent by a member of the public — open with the usual care.</p>
                                </div>
                            )}
                        </Card>
                    </div>

                    <div className="space-y-6">
                        <Card title="From">
                            <div className="text-[15px] font-bold text-surface-900">{r.name}</div>
                            {(r.designation || r.organisation) && (
                                <div className="text-sm text-surface-700 mt-0.5">{[r.designation, r.organisation].filter(Boolean).join(', ')}</div>
                            )}
                            <div className="mt-3 space-y-1.5">
                                <a href={telHref(r.phone)} className="flex items-center gap-2 text-sm font-semibold text-brand-700 hover:underline">
                                    <i className="fi fi-rr-phone-call text-xs leading-none" />{r.phone}
                                </a>
                                <a href={`mailto:${r.email}?subject=${encodeURIComponent(`Your quotation request ${r.reference_no}`)}`}
                                   className="flex items-center gap-2 text-sm text-surface-900 hover:text-brand-700 hover:underline break-all">
                                    <i className="fi fi-rr-envelope text-xs leading-none text-surface-500" />{r.email}
                                </a>
                                {r.address && (
                                    <div className="flex items-start gap-2 text-sm text-surface-800">
                                        <i className="fi fi-rr-marker text-xs leading-none text-surface-500 mt-1" />
                                        <span className="whitespace-pre-wrap">{r.address}</span>
                                    </div>
                                )}
                            </div>
                            {r.ip && <div className="mt-3 text-[11px] text-surface-400">Sent from {r.ip}</div>}
                        </Card>

                        <Card title="Convert to RFQ">
                            {converted ? (
                                <p className="text-sm text-surface-700">Done — see RFQ #{r.rfq?.id ?? '—'} above.</p>
                            ) : !can.convert ? (
                                <p className="text-sm text-surface-600">Someone who can create RFQs converts this.</p>
                            ) : (
                                <>
                                    <p className="text-sm text-surface-700 leading-relaxed">
                                        Makes a <span className="font-semibold">draft</span> RFQ for the customer with the job, quantity,
                                        date and files. It goes nowhere until you submit it.
                                    </p>
                                    {suggested && (
                                        <div className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-900">
                                            Looks like <span className="font-bold">{suggested.name}</span> — matched on their email, phone or name.
                                        </div>
                                    )}
                                    <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Find a customer…" className="form-input w-full mt-3" />
                                    <select value={conv.data.customer_id} onChange={(e) => conv.setData('customer_id', e.target.value)}
                                        className="form-select w-full mt-2" size={Math.min(6, Math.max(3, shown.length))}>
                                        {shown.map((c) => (
                                            <option key={c.id} value={c.id}>{c.name}{c.contact_person ? ` — ${c.contact_person}` : ''}</option>
                                        ))}
                                    </select>
                                    {conv.errors.customer_id && <p className="form-error">{conv.errors.customer_id}</p>}
                                    <button onClick={convert} disabled={!conv.data.customer_id || conv.processing || r.status === 'spam'}
                                        className="btn-primary w-full mt-3 justify-center disabled:opacity-50">
                                        <i className="fi fi-rr-file-invoice text-xs leading-none" /> Create draft RFQ
                                    </button>
                                    {r.status === 'spam' && <p className="text-xs text-rose-700 mt-2">Marked as spam — change the status first.</p>}
                                    <p className="text-xs text-surface-500 mt-3">
                                        New customer?{' '}
                                        <a href="/admin/customers/create" target="_blank" rel="noopener" className="text-brand-600 font-semibold hover:underline">Add them first</a>
                                        {' '}— with {r.organisation || r.name}, {r.email} — then reload this page.
                                    </p>
                                </>
                            )}
                        </Card>

                        <Card title="Handling">
                            {r.handler && (
                                <p className="text-xs text-surface-500 mb-3">Last handled by <span className="font-semibold text-surface-700">{r.handler}</span>{r.handled_at && <> · {r.handled_at}</>}</p>
                            )}
                            {can.edit ? (
                                <div className="space-y-3">
                                    {!converted && (
                                        <div>
                                            <label className="form-label">Status</label>
                                            <select value={handling.data.status} onChange={(e) => handling.setData('status', e.target.value)} className="form-select w-full">
                                                {Object.entries(settable).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                                            </select>
                                        </div>
                                    )}
                                    <div>
                                        <label className="form-label">Note for colleagues</label>
                                        <textarea value={handling.data.staff_note} onChange={(e) => handling.setData('staff_note', e.target.value)}
                                            rows={4} className="form-textarea w-full" placeholder="Called them on…, waiting for the drawing…" />
                                    </div>
                                    <button onClick={saveHandling} disabled={handling.processing} className="btn-outline w-full justify-center">
                                        Save
                                    </button>
                                    {!converted && (
                                        <button onClick={destroy} className="btn-ghost w-full justify-center text-rose-600 hover:bg-rose-50">
                                            <i className="fi fi-rr-trash text-xs leading-none" /> Delete request
                                        </button>
                                    )}
                                </div>
                            ) : (
                                <p className="text-sm text-surface-700 whitespace-pre-wrap">{r.staff_note || 'No note.'}</p>
                            )}
                        </Card>
                    </div>
                </div>
            </div>
        </AppLayout>
    );
}

function Card({ title, children }: { title: string; children: ReactNode }) {
    return (
        <div className="card">
            <div className="card-header"><h3 className="text-sm font-bold text-surface-900">{title}</h3></div>
            <div className="card-body">{children}</div>
        </div>
    );
}

function Fact({ label, value }: { label: string; value: string }) {
    return (
        <div className="rounded-xl bg-surface-50 border border-surface-100 px-3 py-2.5">
            <div className="text-[10px] uppercase tracking-wider font-bold text-surface-400">{label}</div>
            <div className="text-sm font-semibold text-surface-900 mt-0.5">{value}</div>
        </div>
    );
}
