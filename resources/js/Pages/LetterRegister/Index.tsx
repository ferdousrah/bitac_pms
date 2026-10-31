import AppLayout from '@/Layouts/AppLayout';
import { Head, Link, router, useForm } from '@inertiajs/react';
import { FormEvent, useState } from 'react';

interface Entry {
    id: number;
    sender: string;
    recipient: string;
    memo_no: string | null;
    letter_date: string;
    date_label: string;
    remarks: string | null;
    file_name: string | null;
    file_url: string | null;
    entered_by: string | null;
    /** Issued from IED → Letters; the letter keeps this row in step. */
    from_letters: boolean;
    letter_url: string | null;
    can_delete: boolean;
}

interface Props {
    desk: 'ied' | 'pcd';
    deskLabel: string;
    direction: 'in' | 'out';
    title: { bn: string; en: string };
    basePath: string;
    entries: { data: Entry[]; links: any[]; last_page: number; from: number | null; total: number };
    filters: { search: string; date_from: string; date_to: string };
}

const BLANK = { sender: '', recipient: '', memo_no: '', letter_date: '', remarks: '', file: null as File | null, remove_file: false };

/**
 * IED's / PCD's production-letter registers (BITAC, 2026-10-31):
 * আগত চিঠির রেকর্ড — Sl · প্রেরক · প্রাপক · স্মারক নম্বর · তারিখ · মন্তব্য
 * প্রেরিত চিঠির রেকর্ড — Sl · প্রাপক · প্রেরক · স্মারক নম্বর · তারিখ · মন্তব্য
 * The column order is BITAC's: a received letter is read by who sent it, a
 * sent one by whom it went to.
 */
export default function LetterRegisterIndex({ desk, deskLabel, direction, title, basePath, entries, filters }: Props) {
    const incoming = direction === 'in';
    const [search, setSearch] = useState(filters.search ?? '');
    const [editing, setEditing] = useState<Entry | 'new' | null>(null);
    const form = useForm({ ...BLANK });

    // Columns in BITAC's order for this register.
    const cols: { key: 'sender' | 'recipient'; bn: string; en: string }[] = incoming
        ? [{ key: 'sender', bn: 'প্রেরক', en: 'Sender' }, { key: 'recipient', bn: 'প্রাপক', en: 'Recipient' }]
        : [{ key: 'recipient', bn: 'প্রাপক', en: 'Recipient' }, { key: 'sender', bn: 'প্রেরক', en: 'Sender' }];

    const go = (patch: Record<string, string>) =>
        router.get(basePath, { search, date_from: filters.date_from, date_to: filters.date_to, ...patch },
            { preserveState: true, preserveScroll: true, replace: true });

    const openNew = () => {
        form.reset();
        form.clearErrors();
        form.setData({ ...BLANK, letter_date: new Date().toISOString().slice(0, 10) });
        setEditing('new');
    };
    const openEdit = (e: Entry) => {
        form.clearErrors();
        form.setData({
            sender: e.sender, recipient: e.recipient, memo_no: e.memo_no ?? '', letter_date: e.letter_date,
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
        if (!confirm(`Remove this letter (${e.memo_no || e.date_label}) from the register?`)) return;
        router.delete(`${basePath}/${e.id}`, { preserveScroll: true });
    };

    const other = incoming ? 'outgoing' : 'incoming';
    const hasFilters = !!(filters.search || filters.date_from || filters.date_to);

    return (
        <AppLayout header={`${deskLabel} · ${title.en}`}>
            <Head title={`${title.en} — ${deskLabel}`} />
            <div className="space-y-5 animate-fade-in">
                <div className="flex flex-col lg:flex-row lg:items-end gap-4 justify-between">
                    <div>
                        <div className="text-[11px] font-bold uppercase tracking-wider text-brand-600">{deskLabel} · Production letters</div>
                        <h1 className="text-xl font-bold text-surface-900 font-bangla leading-snug">{title.bn}</h1>
                        <p className="text-sm text-surface-500">{title.en} — {entries.total} recorded</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                        {/* The two registers, one trough, one raised pill. */}
                        <div className="inline-flex p-1 rounded-xl bg-surface-100 gap-1">
                            {(['incoming', 'outgoing'] as const).map(seg => {
                                const active = (seg === 'incoming') === incoming;
                                return (
                                    <Link key={seg} href={`/${desk}/letters/${seg}`}
                                        className={`px-3 py-1.5 rounded-lg text-sm font-semibold transition ${active ? 'bg-white text-surface-900 shadow-sm' : 'text-surface-500 hover:text-surface-700'}`}>
                                        <i className={`fi ${seg === 'incoming' ? 'fi-rr-inbox-in' : 'fi-rr-paper-plane'} text-xs mr-1.5 leading-none`} />
                                        <span className="font-bangla">{seg === 'incoming' ? 'আগত' : 'প্রেরিত'}</span>
                                    </Link>
                                );
                            })}
                        </div>
                        <button type="button" onClick={openNew} className="btn-primary">
                            <i className="fi fi-rr-plus text-xs leading-none" /> Record letter
                        </button>
                    </div>
                </div>

                <div className="card">
                    <div className="card-body border-b border-surface-100 grid grid-cols-1 sm:grid-cols-[1fr_auto_auto_auto] gap-3">
                        <div className="relative">
                            <i className="fi fi-rr-search absolute left-3 top-1/2 -translate-y-1/2 text-[11px] leading-none text-surface-400" />
                            <input className="form-input !pl-9" value={search} placeholder="Sender, recipient, memo no., remarks…"
                                onChange={e => setSearch(e.target.value)} onKeyDown={e => e.key === 'Enter' && go({ search })} />
                        </div>
                        <input type="date" className="form-input" value={filters.date_from ?? ''} title="From"
                            onChange={e => go({ date_from: e.target.value })} />
                        <input type="date" className="form-input" value={filters.date_to ?? ''} title="To"
                            onChange={e => go({ date_to: e.target.value })} />
                        {hasFilters
                            ? <button type="button" className="btn-ghost" onClick={() => { setSearch(''); router.get(basePath); }}>Clear</button>
                            : <button type="button" className="btn-outline" onClick={() => go({ search })}>Search</button>}
                    </div>

                    {entries.data.length === 0 ? (
                        <div className="text-center py-14">
                            <div className="w-12 h-12 rounded-xl bg-surface-100 flex items-center justify-center mx-auto mb-3">
                                <i className={`fi ${incoming ? 'fi-rr-inbox-in' : 'fi-rr-paper-plane'} text-surface-400 text-base leading-none`} />
                            </div>
                            <p className="text-sm font-semibold text-surface-700">
                                {hasFilters ? 'No letter matches these filters' : 'No letters recorded yet'}
                            </p>
                            {!hasFilters && (
                                <button type="button" onClick={openNew} className="btn-primary btn-sm mt-3">Record the first letter</button>
                            )}
                        </div>
                    ) : (
                        <>
                            {/* Desktop: the register as BITAC keeps it. */}
                            <div className="hidden md:block overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="border-b border-surface-100 text-[11px] uppercase tracking-wider text-surface-500 font-bold">
                                            <th className="text-right px-4 py-2.5 w-14 font-bangla normal-case text-xs">ক্রমিক নং</th>
                                            {cols.map(c => (
                                                <th key={c.key} className="text-left px-3 py-2.5"><span className="font-bangla normal-case text-xs">{c.bn}</span></th>
                                            ))}
                                            <th className="text-left px-3 py-2.5 w-44"><span className="font-bangla normal-case text-xs">স্মারক নম্বর</span></th>
                                            <th className="text-left px-3 py-2.5 w-28"><span className="font-bangla normal-case text-xs">তারিখ</span></th>
                                            <th className="text-left px-3 py-2.5"><span className="font-bangla normal-case text-xs">মন্তব্য</span></th>
                                            <th className="px-4 py-2.5 w-28" />
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {entries.data.map((e, i) => (
                                            <tr key={e.id} className="border-b border-surface-50 hover:bg-surface-50/60 align-top">
                                                <td className="px-4 py-2.5 text-right text-xs text-surface-400 tabular-nums">{(entries.from ?? 1) + i}</td>
                                                {cols.map(c => (
                                                    <td key={c.key} className="px-3 py-2.5 text-surface-900 whitespace-pre-line">{e[c.key]}</td>
                                                ))}
                                                <td className="px-3 py-2.5 font-mono text-xs text-surface-700 break-all">{e.memo_no || '—'}</td>
                                                <td className="px-3 py-2.5 text-xs text-surface-600 whitespace-nowrap">{e.date_label}</td>
                                                <td className="px-3 py-2.5 text-xs text-surface-600 whitespace-pre-line">
                                                    {e.remarks || '—'}
                                                    {e.from_letters && <FromLetters />}
                                                </td>
                                                <td className="px-4 py-2.5">
                                                    <Actions e={e} onEdit={() => openEdit(e)} onRemove={() => remove(e)} />
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                            {/* Phone: one card per letter, in the same order. */}
                            <div className="md:hidden divide-y divide-surface-100">
                                {entries.data.map((e, i) => (
                                    <div key={e.id} className="p-4 space-y-1.5">
                                        <div className="flex items-start justify-between gap-3">
                                            <div className="text-xs text-surface-400">#{(entries.from ?? 1) + i} · {e.date_label}</div>
                                            <Actions e={e} onEdit={() => openEdit(e)} onRemove={() => remove(e)} />
                                        </div>
                                        {cols.map(c => (
                                            <div key={c.key} className="text-sm">
                                                <span className="font-bangla text-surface-500 mr-1.5">{c.bn}:</span>
                                                <span className="text-surface-900">{e[c.key]}</span>
                                            </div>
                                        ))}
                                        {e.memo_no && <div className="text-xs"><span className="font-bangla text-surface-500 mr-1.5">স্মারক:</span><span className="font-mono">{e.memo_no}</span></div>}
                                        {e.remarks && <div className="text-xs text-surface-600 whitespace-pre-line">{e.remarks}</div>}
                                        {e.from_letters && <FromLetters />}
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

                <p className="text-xs text-surface-400">
                    Looking for the other register? <Link href={`/${desk}/letters/${other}`} className="text-brand-600 font-semibold font-bangla">
                        {incoming ? 'প্রেরিত চিঠির রেকর্ড' : 'আগত চিঠির রেকর্ড'}</Link>
                </p>
            </div>

            {editing && (
                <div className="fixed inset-0 z-[150] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => !form.processing && setEditing(null)} />
                    <form onSubmit={save} className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[92vh] overflow-y-auto">
                        <div className="px-5 py-3 border-b border-surface-100">
                            <h3 className="text-sm font-bold text-surface-900">
                                {editing === 'new' ? 'Record a letter' : 'Edit letter'} — <span className="font-bangla">{title.bn}</span>
                            </h3>
                            <p className="text-[11px] text-surface-500 mt-0.5">{deskLabel} · production letters</p>
                        </div>
                        <div className="p-5 space-y-4">
                            {cols.map(c => (
                                <div key={c.key}>
                                    <label className="form-label"><span className="font-bangla">{c.bn}</span> ({c.en}) *</label>
                                    <textarea rows={2} className="form-textarea" value={form.data[c.key]} required
                                        onChange={e => form.setData(c.key, e.target.value)}
                                        placeholder={c.key === (incoming ? 'recipient' : 'sender') ? `e.g. নির্বাহী প্রকৌশলী, ${deskLabel}, বিটাক` : 'Name / designation / organisation'} />
                                    {form.errors[c.key] && <p className="form-error">{form.errors[c.key]}</p>}
                                </div>
                            ))}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                    <label className="form-label"><span className="font-bangla">স্মারক নম্বর</span> (Memo no.)</label>
                                    <input className="form-input font-mono" value={form.data.memo_no}
                                        onChange={e => form.setData('memo_no', e.target.value)} />
                                    {form.errors.memo_no && <p className="form-error">{form.errors.memo_no}</p>}
                                </div>
                                <div>
                                    <label className="form-label"><span className="font-bangla">তারিখ</span> (Date) *</label>
                                    <input type="date" className="form-input" value={form.data.letter_date} required
                                        onChange={e => form.setData('letter_date', e.target.value)} />
                                    {form.errors.letter_date && <p className="form-error">{form.errors.letter_date}</p>}
                                </div>
                            </div>
                            <div>
                                <label className="form-label"><span className="font-bangla">মন্তব্য</span> (Remarks)</label>
                                <textarea rows={2} className="form-textarea" value={form.data.remarks}
                                    onChange={e => form.setData('remarks', e.target.value)} />
                            </div>
                            <div>
                                <label className="form-label-optional">Scanned letter (PDF / image, optional)</label>
                                {editing !== 'new' && (editing as Entry).file_url && !form.data.remove_file && (
                                    <div className="flex items-center gap-2 text-xs mb-1.5">
                                        <a href={(editing as Entry).file_url!} target="_blank" rel="noopener" className="text-brand-600 font-semibold truncate">
                                            <i className="fi fi-rr-clip mr-1" />{(editing as Entry).file_name}
                                        </a>
                                        <button type="button" className="text-rose-600 font-semibold" onClick={() => form.setData('remove_file', true)}>Remove</button>
                                    </div>
                                )}
                                <input type="file" accept="application/pdf,image/*" className="form-input"
                                    onChange={e => form.setData('file', e.target.files?.[0] ?? null)} />
                                {form.errors.file && <p className="form-error">{form.errors.file}</p>}
                            </div>
                        </div>
                        <div className="px-5 py-3 border-t border-surface-100 flex justify-end gap-2">
                            <button type="button" onClick={() => setEditing(null)} disabled={form.processing} className="btn-ghost">Cancel</button>
                            <button type="submit" disabled={form.processing} className="btn-primary">
                                {form.processing ? 'Saving…' : 'Save'}
                            </button>
                        </div>
                    </form>
                </div>
            )}
        </AppLayout>
    );
}

function FromLetters() {
    return (
        <div className="mt-1">
            <span className="badge-blue text-[10px]" title="Entered when the letter was issued from IED → Letters">
                <i className="fi fi-rr-envelope text-[9px] mr-1 leading-none" />From Letters
            </span>
        </div>
    );
}

function Actions({ e, onEdit, onRemove }: { e: Entry; onEdit: () => void; onRemove: () => void }) {
    return (
        <div className="flex items-center justify-end gap-1">
            {e.file_url && (
                <a href={e.file_url} target="_blank" rel="noopener" title={e.from_letters ? 'Letter PDF' : (e.file_name ?? 'Scanned letter')}
                    className="w-7 h-7 inline-flex items-center justify-center rounded-lg text-brand-600 hover:bg-brand-50">
                    <i className="fi fi-rr-clip text-xs leading-none" />
                </a>
            )}
            {/* A letter issued from IED → Letters is changed there, and this row follows. */}
            {e.from_letters ? (
                <Link href={e.letter_url!} title="Open in Letters"
                    className="w-7 h-7 inline-flex items-center justify-center rounded-lg text-surface-500 hover:bg-surface-100">
                    <i className="fi fi-rr-arrow-up-right-from-square text-xs leading-none" />
                </Link>
            ) : (
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
