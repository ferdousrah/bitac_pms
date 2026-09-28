import AppLayout from '@/Layouts/AppLayout';
import { Head, Link, router } from '@inertiajs/react';
import { FormEvent, useState } from 'react';
import PdfPopupModal from '@/Components/PdfPopupModal';

export default function OfficeNoteIndex({ notes, filters = {} }: any) {
    const [search, setSearch] = useState(filters.search ?? '');
    const [pdf, setPdf] = useState<{ open: boolean; url: string | null; title: string }>({
        open: false, url: null, title: '',
    });

    const go = (patch: Record<string, any>) =>
        router.get('/office-notes', { search, status: filters.status ?? '', ...patch },
            { preserveState: true, replace: true });

    const runSearch = (e: FormEvent) => { e.preventDefault(); go({ search }); };

    const openPdf = (id: number, lang: 'bn' | 'en', subject: string) =>
        setPdf({ open: true, url: `/office-notes/${id}/pdf?preview=base64&lang=${lang}`, title: subject });

    const duplicate = (n: any) => {
        if (!confirm(`Duplicate “${n.subject}” into a new draft note?`)) return;
        router.post(`/office-notes/${n.id}/duplicate`);
    };

    const del = (n: any) => {
        if (!confirm('Delete this note? This cannot be undone.')) return;
        router.delete(`/office-notes/${n.id}`, { preserveScroll: true });
    };

    return (
        <AppLayout header="Notes">
            <Head title="Notes" />

            <div className="max-w-6xl mx-auto space-y-5 animate-fade-in">

                <div className="rounded-2xl border border-surface-200 bg-surface-50/60 p-4 flex items-start justify-between gap-4">
                    <p className="text-sm text-surface-600">
                        Internal office notes — written like a letter, but printed on plain legal paper
                        (8.5″ × 14″) with <strong>no letterhead</strong>.
                    </p>
                    <Link href="/office-notes/create" className="btn-primary shrink-0">
                        <i className="fi fi-rr-plus text-xs leading-none" /> New Note
                    </Link>
                </div>

                <div className="card">
                    <div className="card-header flex flex-wrap items-center gap-3">
                        <h3 className="text-sm font-bold text-surface-900">
                            Notes <span className="text-surface-400 font-normal">({notes.total})</span>
                        </h3>
                        <div className="flex items-center gap-2 ml-auto">
                            <select value={filters.status ?? ''} onChange={(e) => go({ status: e.target.value })}
                                className="form-input text-sm py-1.5 w-32">
                                <option value="">All</option>
                                <option value="draft">Draft</option>
                                <option value="issued">Issued</option>
                            </select>
                            <form onSubmit={runSearch}>
                                <input value={search} onChange={(e) => setSearch(e.target.value)}
                                    placeholder="Subject or number…" className="form-input text-sm py-1.5 w-52" />
                            </form>
                        </div>
                    </div>

                    <div className="card-body p-0 overflow-x-auto">
                        {notes.data.length === 0 ? (
                            <p className="text-center py-12 text-sm text-surface-400">
                                No notes yet — start one with <strong>New Note</strong>.
                            </p>
                        ) : (
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b border-surface-100 text-[10px] uppercase tracking-wider text-surface-500 font-bold">
                                        <th className="text-left px-4 py-2 w-32">No.</th>
                                        <th className="text-left px-3 py-2">Subject</th>
                                        <th className="text-left px-3 py-2 w-40">To</th>
                                        <th className="text-left px-3 py-2 w-28">Date</th>
                                        <th className="text-left px-3 py-2 w-20">Status</th>
                                        <th className="px-4 py-2 w-40" />
                                    </tr>
                                </thead>
                                <tbody>
                                    {notes.data.map((n: any) => (
                                        <tr key={n.id} className="border-b border-surface-50 hover:bg-surface-50/60">
                                            <td className="px-4 py-2.5 font-mono text-xs text-surface-600">{n.note_no ?? '—'}</td>
                                            <td className="px-3 py-2.5">
                                                <span className="font-semibold text-surface-900">{n.subject}</span>
                                                {n.signatory && <p className="text-[11px] text-surface-400">Signed by {n.signatory}</p>}
                                            </td>
                                            <td className="px-3 py-2.5 text-surface-600 text-xs">{n.recipient || '—'}</td>
                                            <td className="px-3 py-2.5 text-xs text-surface-500">{n.note_date ?? '—'}</td>
                                            <td className="px-3 py-2.5">
                                                <span className={`text-[10px] px-1.5 py-0.5 rounded border font-semibold uppercase ${
                                                    n.status === 'issued'
                                                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                                        : 'bg-surface-100 text-surface-500 border-surface-200'
                                                }`}>{n.status}</span>
                                            </td>
                                            <td className="px-4 py-2.5">
                                                <div className="flex items-center justify-end gap-1.5">
                                                    <button onClick={() => openPdf(n.id, 'bn', n.subject)} title="Bangla PDF"
                                                        className="px-2 py-1 rounded-lg text-[11px] font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200 hover:bg-indigo-100">বাংলা</button>
                                                    <button onClick={() => openPdf(n.id, 'en', n.subject)} title="English PDF"
                                                        className="px-2 py-1 rounded-lg text-[11px] font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200 hover:bg-indigo-100">EN</button>
                                                    <Link href={`/envelopes?office_note=${n.id}`} title="Print the envelope"
                                                        className="w-7 h-7 inline-flex items-center justify-center rounded-lg text-surface-500 hover:bg-surface-100"><i className="fi fi-rr-envelope-open text-xs leading-none" /></Link>
                                                    <button onClick={() => duplicate(n)} title="Duplicate into a new draft"
                                                        className="w-7 h-7 inline-flex items-center justify-center rounded-lg text-surface-500 hover:bg-surface-100"><i className="fi fi-rr-copy text-xs leading-none" /></button>
                                                    <Link href={`/office-notes/${n.id}/edit`} title="Edit"
                                                        className="w-7 h-7 inline-flex items-center justify-center rounded-lg text-surface-500 hover:bg-surface-100"><i className="fi fi-rr-pencil text-xs leading-none" /></Link>
                                                    <button onClick={() => del(n)} title="Delete"
                                                        className="w-7 h-7 inline-flex items-center justify-center rounded-lg text-red-500 hover:bg-red-50"><i className="fi fi-rr-trash text-xs leading-none" /></button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>
                </div>
            </div>

            <PdfPopupModal
                open={pdf.open}
                pdfUrl={pdf.url}
                title={pdf.title}
                onClose={() => setPdf({ open: false, url: null, title: '' })}
            />
        </AppLayout>
    );
}
