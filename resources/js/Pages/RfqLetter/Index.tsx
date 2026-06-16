import AppLayout from '@/Layouts/AppLayout';
import { Link, router, usePage } from '@inertiajs/react';
import { useState, useEffect, useRef } from 'react';
import PdfPopupModal from '@/Components/PdfPopupModal';
import RichTextEditor from '@/Components/RichTextEditor';

export default function RfqLetterIndex({ letters, filters = {} }: any) {
    const rows = letters?.data ?? [];
    const authUser = (usePage().props as any)?.auth?.user;

    const [search, setSearch] = useState(filters.search ?? '');
    const [status, setStatus] = useState(filters.status ?? '');
    const firstRun = useRef(true);

    // Debounced server-side filtering via query params.
    useEffect(() => {
        if (firstRun.current) { firstRun.current = false; return; }
        const t = setTimeout(() => {
            router.get('/rfq-letters',
                { search: search || undefined, status: status || undefined },
                { preserveState: true, replace: true, preserveScroll: true });
        }, 300);
        return () => clearTimeout(t);
    }, [search, status]);
    const [pdf, setPdf] = useState<{ open: boolean; url: string | null; title: string; subtitle?: string }>({
        open: false, url: null, title: '',
    });

    const [mail, setMail] = useState<{ open: boolean; id: number | null; from: string; to: string; cc: string; subject: string; message: string; lang: 'bn' | 'en'; sending: boolean }>({
        open: false, id: null, from: '', to: '', cc: '', subject: '', message: '', lang: 'bn', sending: false,
    });

    const openPdf = (id: number, lang: 'bn' | 'en', subject: string) =>
        setPdf({ open: true, url: `/rfq-letters/${id}/pdf?preview=base64&lang=${lang}`, title: `Letter #${id} (${lang === 'bn' ? 'বাংলা' : 'English'})`, subtitle: subject });

    const openMail = (l: any) => setMail({
        open: true,
        id: l.id,
        from: authUser?.email ?? '',
        to: l.customer_email ?? '',
        cc: '',
        subject: l.subject ?? '',
        message: `<p>Dear ${l.customer ?? 'Sir/Madam'},</p><p>Please find attached an official letter from BITAC. Kindly review the attached document.</p><p>Best regards,<br>Bangladesh Industrial Technical Assistance Centre (BITAC)</p>`,
        lang: 'bn',
        sending: false,
    });

    const sendMail = () => {
        if (!mail.id) return;
        setMail(s => ({ ...s, sending: true }));
        router.post(`/rfq-letters/${mail.id}/email`,
            { from_email: mail.from.trim() || undefined, email: mail.to.trim() || undefined, cc: mail.cc.trim() || undefined, subject: mail.subject, message: mail.message, lang: mail.lang },
            {
                preserveScroll: true,
                onSuccess: () => setMail(s => ({ ...s, open: false, sending: false })),
                onError:   () => setMail(s => ({ ...s, sending: false })),
                onFinish:  () => setMail(s => ({ ...s, sending: false })),
            });
    };

    const del = (id: number) => {
        if (!confirm('Delete this letter? This cannot be undone.')) return;
        router.delete(`/rfq-letters/${id}`, { preserveScroll: true });
    };

    return (
        <AppLayout header="Letters">
            <div className="max-w-6xl mx-auto p-4 sm:p-6 animate-fade-in">
                <div className="flex items-center justify-between mb-5">
                    <div>
                        <h1 className="text-lg font-bold text-surface-900">Official Letters</h1>
                        <p className="text-xs text-surface-500">BITAC letterhead letters issued against RFQs — print (Bangla/English) or email.</p>
                    </div>
                    <Link href="/rfq-letters/create" className="btn-primary">
                        <i className="fi fi-rr-plus text-sm leading-none" /> New Letter
                    </Link>
                </div>

                {/* Filters */}
                <div className="flex flex-col sm:flex-row gap-2.5 mb-4">
                    <div className="relative flex-1">
                        <i className="fi fi-rr-search absolute left-3 top-1/2 -translate-y-1/2 text-surface-400 text-xs leading-none" />
                        <input
                            type="text"
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            placeholder="Search by subject, memo no, or customer…"
                            className="form-input pl-9 w-full"
                        />
                    </div>
                    <select value={status} onChange={e => setStatus(e.target.value)} className="form-input sm:w-44">
                        <option value="">All statuses</option>
                        <option value="draft">Draft</option>
                        <option value="issued">Issued</option>
                    </select>
                    {(search || status) && (
                        <button onClick={() => { setSearch(''); setStatus(''); }} className="btn-ghost shrink-0">
                            <i className="fi fi-rr-cross-small text-sm leading-none" /> Clear
                        </button>
                    )}
                </div>

                <div className="card overflow-hidden">
                    {rows.length === 0 ? (
                        <div className="card-body py-16 text-center text-sm text-surface-400 italic">
                            No letters yet. Click “New Letter”, or issue one from an RFQ.
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="text-[10px] uppercase tracking-wider text-surface-400 font-bold border-b border-surface-100 bg-surface-50/50">
                                        <th className="text-left px-4 py-2.5">Subject</th>
                                        <th className="text-left px-3 py-2.5">Customer</th>
                                        <th className="text-left px-3 py-2.5">RFQ</th>
                                        <th className="text-left px-3 py-2.5">Signatory</th>
                                        <th className="text-left px-3 py-2.5">Date</th>
                                        <th className="text-center px-3 py-2.5">Status</th>
                                        <th className="text-right px-4 py-2.5">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-surface-100">
                                    {rows.map((l: any) => (
                                        <tr key={l.id} className="hover:bg-surface-50/40 transition-colors">
                                            <td className="px-4 py-3 text-surface-800 font-medium max-w-xs truncate">{l.subject}</td>
                                            <td className="px-3 py-3 text-surface-600">{l.customer ?? '—'}</td>
                                            <td className="px-3 py-3 text-surface-600">{l.rfq_id ? <Link href={`/rfqs/${l.rfq_id}`} className="text-brand-600 hover:underline">#{l.rfq_id}</Link> : '—'}</td>
                                            <td className="px-3 py-3 text-surface-600">{l.signatory ?? '—'}</td>
                                            <td className="px-3 py-3 text-surface-600 whitespace-nowrap">{l.letter_date ?? '—'}</td>
                                            <td className="px-3 py-3 text-center">
                                                <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold border ${l.status === 'issued' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-amber-50 text-amber-700 border-amber-200'}`}>
                                                    {l.status === 'issued' ? 'Issued' : 'Draft'}
                                                </span>
                                                {l.emailed_at && <div className="text-[9px] text-surface-400 mt-0.5">✉ {l.emailed_at}</div>}
                                            </td>
                                            <td className="px-4 py-3">
                                                <div className="flex items-center justify-end gap-1.5">
                                                    <button onClick={() => openPdf(l.id, 'bn', l.subject)} title="Bangla PDF"
                                                        className="px-2 py-1 rounded-lg text-[11px] font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200 hover:bg-indigo-100">বাংলা</button>
                                                    <button onClick={() => openPdf(l.id, 'en', l.subject)} title="English PDF"
                                                        className="px-2 py-1 rounded-lg text-[11px] font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200 hover:bg-indigo-100">EN</button>
                                                    <button onClick={() => openMail(l)} title="Email to customer"
                                                        className="w-7 h-7 inline-flex items-center justify-center rounded-lg text-sky-600 hover:bg-sky-50 border border-transparent hover:border-sky-200"><i className="fi fi-rr-envelope text-xs leading-none" /></button>
                                                    <Link href={`/rfq-letters/${l.id}/edit`} title="Edit"
                                                        className="w-7 h-7 inline-flex items-center justify-center rounded-lg text-surface-500 hover:bg-surface-100"><i className="fi fi-rr-pencil text-xs leading-none" /></Link>
                                                    <button onClick={() => del(l.id)} title="Delete"
                                                        className="w-7 h-7 inline-flex items-center justify-center rounded-lg text-red-500 hover:bg-red-50"><i className="fi fi-rr-trash text-xs leading-none" /></button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>

            <PdfPopupModal
                open={pdf.open}
                pdfUrl={pdf.url}
                title={pdf.title}
                subtitle={pdf.subtitle}
                onClose={() => setPdf(s => ({ ...s, open: false }))}
            />

            {/* Email compose modal */}
            {mail.open && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40" onClick={() => !mail.sending && setMail(s => ({ ...s, open: false }))}>
                    <div className="relative overflow-hidden bg-white rounded-2xl shadow-xl w-full max-w-3xl animate-fade-in" onClick={e => e.stopPropagation()}>
                        {/* Sending overlay */}
                        {mail.sending && (
                            <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-5 bg-white/85 backdrop-blur-sm">
                                <style>{`
                                    @keyframes planeFly { 0%{transform:translate(-16px,10px) rotate(-8deg);opacity:0} 25%{opacity:1} 70%{opacity:1} 100%{transform:translate(18px,-12px) rotate(-8deg);opacity:0} }
                                    @keyframes ringPulse { 0%,100%{transform:scale(1);opacity:.35} 50%{transform:scale(1.18);opacity:.7} }
                                    @keyframes dotPulse { 0%,80%,100%{opacity:.2} 40%{opacity:1} }
                                `}</style>
                                <div className="relative w-20 h-20 flex items-center justify-center">
                                    <span className="absolute inset-0 rounded-full bg-brand-100" style={{ animation: 'ringPulse 1.6s ease-in-out infinite' }} />
                                    <span className="absolute inset-0 rounded-full border-4 border-brand-200 border-t-brand-500 animate-spin" />
                                    <i className="fi fi-rr-paper-plane text-brand-600 text-2xl relative" style={{ animation: 'planeFly 1.2s ease-in-out infinite' }} />
                                </div>
                                <div className="text-sm font-semibold text-surface-700">
                                    Sending email
                                    <span style={{ animation: 'dotPulse 1.4s infinite' }}>.</span>
                                    <span style={{ animation: 'dotPulse 1.4s infinite .2s' }}>.</span>
                                    <span style={{ animation: 'dotPulse 1.4s infinite .4s' }}>.</span>
                                </div>
                                <div className="text-[11px] text-surface-400">Attaching the PDF and delivering it now</div>
                            </div>
                        )}
                        <div className="flex items-center gap-2 px-5 py-4 border-b border-surface-100">
                            <i className="fi fi-rr-envelope text-sky-500 text-sm leading-none" />
                            <h3 className="text-sm font-bold text-surface-900">Email Letter to Customer</h3>
                            <button onClick={() => setMail(s => ({ ...s, open: false }))} className="ml-auto w-7 h-7 inline-flex items-center justify-center rounded-lg text-surface-400 hover:bg-surface-100">
                                <i className="fi fi-rr-cross-small text-base leading-none" />
                            </button>
                        </div>
                        <div className="p-5 space-y-3.5">
                            <div className="form-group !mb-0">
                                <label className="form-label">From</label>
                                <input type="email" value={mail.from} onChange={e => setMail(s => ({ ...s, from: e.target.value }))}
                                    className="form-input" placeholder="your.name@bitac.gov.bd" />
                                <p className="form-hint">Sender address (your email). Replies come back here.</p>
                            </div>
                            <div className="form-group !mb-0">
                                <label className="form-label">To</label>
                                <input type="email" value={mail.to} onChange={e => setMail(s => ({ ...s, to: e.target.value }))}
                                    className="form-input" placeholder="customer@example.com" />
                                <p className="form-hint">Leave blank to use the customer's email on file.</p>
                            </div>
                            <div className="form-group !mb-0">
                                <label className="form-label">CC <span className="form-label-optional">(optional)</span></label>
                                <input type="text" value={mail.cc} onChange={e => setMail(s => ({ ...s, cc: e.target.value }))}
                                    className="form-input" placeholder="one@x.com, two@y.com" />
                                <p className="form-hint">Comma-separated email addresses.</p>
                            </div>
                            <div className="form-group !mb-0">
                                <label className="form-label">Subject</label>
                                <input type="text" value={mail.subject} onChange={e => setMail(s => ({ ...s, subject: e.target.value }))}
                                    className="form-input" required />
                            </div>
                            <div className="form-group !mb-0">
                                <label className="form-label">Message</label>
                                <RichTextEditor
                                    value={mail.message}
                                    onChange={(html) => setMail(s => ({ ...s, message: html }))}
                                    placeholder="Write your message…"
                                    minHeight="180px"
                                />
                            </div>
                            <div className="form-group !mb-0">
                                <label className="form-label">Attached letter (PDF)</label>
                                <div className="flex gap-2">
                                    {(['bn', 'en'] as const).map(lng => (
                                        <button key={lng} type="button" onClick={() => setMail(s => ({ ...s, lang: lng }))}
                                            className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${mail.lang === lng ? 'bg-brand-500 text-white border-brand-500' : 'bg-surface-50 text-surface-600 border-surface-200 hover:bg-surface-100'}`}>
                                            {lng === 'bn' ? 'বাংলা' : 'English'}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                        <div className="flex items-center justify-end gap-2.5 px-5 py-4 border-t border-surface-100">
                            <button onClick={() => setMail(s => ({ ...s, open: false }))} className="btn-ghost" disabled={mail.sending}>Cancel</button>
                            <button onClick={sendMail} className="btn-primary" disabled={mail.sending || !mail.subject.trim()}>
                                <i className="fi fi-rr-paper-plane text-sm leading-none" /> {mail.sending ? 'Sending…' : 'Send Email'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </AppLayout>
    );
}
