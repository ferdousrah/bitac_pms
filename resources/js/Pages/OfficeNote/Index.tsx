import AppLayout from '@/Layouts/AppLayout';
import { Head, Link, router, usePage } from '@inertiajs/react';
import { FormEvent, useState } from 'react';
import PdfPopupModal from '@/Components/PdfPopupModal';

export const NOTE_BADGE: Record<string, string> = {
    draft:    'bg-surface-100 text-surface-600 border-surface-200',
    pending:  'bg-amber-50 text-amber-700 border-amber-200',
    returned: 'bg-rose-50 text-rose-700 border-rose-200',
    approved: 'bg-emerald-50 text-emerald-700 border-emerald-200',
};

/** Notes — every department's register. A note is kept like a quotation, never thrown away once submitted. */
export default function OfficeNoteIndex({ notes, filters = {}, awaitingCount = 0, departments = [], statuses = {} }: any) {
    const { auth } = usePage().props as any;
    const canEnvelope = auth?.user?.is_super_admin || (auth?.user?.permissions ?? []).includes('view rfqs');
    const [search, setSearch] = useState(filters.search ?? '');
    const [pdf, setPdf] = useState<{ open: boolean; url: string | null; title: string }>({ open: false, url: null, title: '' });

    const go = (patch: Record<string, any>) =>
        router.get('/office-notes', { search, status: filters.status ?? '', tab: filters.tab ?? '', section_id: filters.section_id ?? '', ...patch },
            { preserveState: true, replace: true });

    const runSearch = (e: FormEvent) => { e.preventDefault(); go({ search }); };
    const duplicate = (n: any) => { if (confirm(`Duplicate “${n.subject}” into a new draft note?`)) router.post(`/office-notes/${n.id}/duplicate`); };

    const tab = filters.tab === 'awaiting' ? 'awaiting' : 'all';

    return (
        <AppLayout header="Notes">
            <Head title="Notes" />

            <div className="max-w-6xl mx-auto space-y-5 animate-fade-in">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="inline-flex p-1 rounded-xl bg-surface-100">
                        <button onClick={() => go({ tab: '', status: '' })}
                            className={`px-4 py-1.5 rounded-lg text-sm font-semibold ${tab === 'all' ? 'bg-white shadow-sm text-surface-900' : 'text-surface-500'}`}>
                            All notes
                        </button>
                        <button onClick={() => go({ tab: 'awaiting', status: '' })}
                            className={`px-4 py-1.5 rounded-lg text-sm font-semibold inline-flex items-center gap-2 ${tab === 'awaiting' ? 'bg-white shadow-sm text-surface-900' : 'text-surface-500'}`}>
                            Waiting for my signature
                            {awaitingCount > 0 && <span className="px-1.5 rounded-md bg-amber-500 text-white text-[11px]">{awaitingCount}</span>}
                        </button>
                    </div>
                    <Link href="/office-notes/create" className="btn-primary">
                        <i className="fi fi-rr-plus text-xs leading-none" /> New Note
                    </Link>
                </div>

                <div className="card">
                    <div className="card-header flex flex-wrap items-center gap-3">
                        <h3 className="text-sm font-bold text-surface-900">
                            Notes <span className="text-surface-400 font-normal">({notes.total})</span>
                        </h3>
                        <div className="flex flex-wrap items-center gap-2 ml-auto">
                            {tab === 'all' && (
                                <select value={filters.status ?? ''} onChange={(e) => go({ status: e.target.value })} className="form-input text-sm py-1.5 w-44">
                                    <option value="">All statuses</option>
                                    {Object.entries(statuses).map(([k, v]: any) => <option key={k} value={k}>{v}</option>)}
                                </select>
                            )}
                            <select value={filters.section_id ?? ''} onChange={(e) => go({ section_id: e.target.value })} className="form-input text-sm py-1.5 w-44">
                                <option value="">All departments</option>
                                {departments.map((d: any) => <option key={d.id} value={d.id}>{d.name}</option>)}
                            </select>
                            <form onSubmit={runSearch}>
                                <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Subject, number, department…" className="form-input text-sm py-1.5 w-56" />
                            </form>
                        </div>
                    </div>

                    <div className="card-body p-0 overflow-x-auto">
                        {notes.data.length === 0 ? (
                            <p className="text-center py-12 text-sm text-surface-400">
                                {tab === 'awaiting' ? 'Nothing is waiting for your signature.' : <>No notes yet — start one with <strong>New Note</strong>.</>}
                            </p>
                        ) : (
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b border-surface-100 text-[10px] uppercase tracking-wider text-surface-500 font-bold">
                                        <th className="text-left px-4 py-2 w-28">No.</th>
                                        <th className="text-left px-3 py-2">Subject</th>
                                        <th className="text-left px-3 py-2 w-32">Department</th>
                                        <th className="text-left px-3 py-2 w-28">Date</th>
                                        <th className="text-left px-3 py-2 w-40">Status</th>
                                        <th className="px-4 py-2 w-44" />
                                    </tr>
                                </thead>
                                <tbody>
                                    {notes.data.map((n: any) => (
                                        <tr key={n.id} className={`border-b border-surface-50 hover:bg-surface-50/60 ${n.awaiting_me ? 'bg-amber-50/50' : ''}`}>
                                            <td className="px-4 py-2.5 font-mono text-xs text-surface-600">{n.note_no ?? '—'}</td>
                                            <td className="px-3 py-2.5">
                                                <Link href={`/office-notes/${n.id}`} className="font-semibold text-surface-900 hover:text-brand-700">{n.subject}</Link>
                                                <p className="text-[11px] text-surface-400">by {n.created_by}</p>
                                            </td>
                                            <td className="px-3 py-2.5 text-xs text-surface-700" style={{ fontFamily: 'Nikosh, sans-serif', fontSize: 14 }}>{n.department ?? '—'}</td>
                                            <td className="px-3 py-2.5 text-xs text-surface-500">{n.note_date ?? '—'}</td>
                                            <td className="px-3 py-2.5">
                                                <span className={`text-[10px] px-1.5 py-0.5 rounded border font-semibold uppercase whitespace-nowrap ${NOTE_BADGE[n.status] ?? NOTE_BADGE.draft}`}>{n.status_label}</span>
                                                {n.awaiting_me && <p className="text-[10px] font-semibold text-amber-700 mt-0.5">your signature</p>}
                                            </td>
                                            <td className="px-4 py-2.5">
                                                <div className="flex items-center justify-end gap-1.5">
                                                    <Link href={`/office-notes/${n.id}`} className="px-2 py-1 rounded-lg text-[11px] font-semibold bg-brand-50 text-brand-700 border border-brand-200 hover:bg-brand-100">Open</Link>
                                                    <button onClick={() => setPdf({ open: true, url: `/office-notes/${n.id}/pdf?preview=base64&lang=bn`, title: n.subject })} title="PDF"
                                                        className="w-7 h-7 inline-flex items-center justify-center rounded-lg text-surface-500 hover:bg-surface-100"><i className="fi fi-rr-file-pdf text-xs leading-none" /></button>
                                                    {canEnvelope && (
                                                        <Link href={`/envelopes?office_note=${n.id}`} title="Print the envelope"
                                                            className="w-7 h-7 inline-flex items-center justify-center rounded-lg text-surface-500 hover:bg-surface-100"><i className="fi fi-rr-envelope-open text-xs leading-none" /></Link>
                                                    )}
                                                    <button onClick={() => duplicate(n)} title="Duplicate into a new draft"
                                                        className="w-7 h-7 inline-flex items-center justify-center rounded-lg text-surface-500 hover:bg-surface-100"><i className="fi fi-rr-copy text-xs leading-none" /></button>
                                                    {n.can_edit && (
                                                        <Link href={`/office-notes/${n.id}/edit`} title="Edit"
                                                            className="w-7 h-7 inline-flex items-center justify-center rounded-lg text-surface-500 hover:bg-surface-100"><i className="fi fi-rr-pencil text-xs leading-none" /></Link>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>

                    {notes.links && notes.links.length > 3 && (
                        <div className="card-body border-t border-surface-100 flex items-center justify-center gap-1 flex-wrap">
                            {notes.links.map((l: any, i: number) => (
                                <Link key={i} href={l.url ?? '#'} preserveScroll
                                    className={`px-3 py-1 rounded-md text-xs font-semibold ${l.active ? 'bg-surface-900 text-white' : l.url ? 'text-surface-700 hover:bg-surface-100' : 'text-surface-300 cursor-not-allowed'}`}
                                    dangerouslySetInnerHTML={{ __html: l.label }} />
                            ))}
                        </div>
                    )}
                </div>
            </div>

            <PdfPopupModal open={pdf.open} pdfUrl={pdf.url} title={pdf.title} onClose={() => setPdf({ open: false, url: null, title: '' })} />
        </AppLayout>
    );
}
