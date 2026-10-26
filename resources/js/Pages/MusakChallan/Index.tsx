import AppLayout from '@/Layouts/AppLayout';
import { Head, Link, router, usePage } from '@inertiajs/react';
import { FormEvent, useRef, useState } from 'react';
import PdfPopupModal from '@/Components/PdfPopupModal';
import SignaturePicker, { SignaturePickerHandle } from '@/Components/SignaturePicker';

const COPIES = [
    { n: 1, label: 'প্রথম' },
    { n: 2, label: 'দ্বিতীয়' },
    { n: 3, label: 'তৃতীয়' },
];

export default function MusakChallanIndex({ challans, filters = {}, canSign = false }: any) {
    const [search, setSearch] = useState(filters.search ?? '');
    const [pdf, setPdf] = useState<{ url: string; title: string } | null>(null);

    // Sign Document — as on the bill: the officer's own saved blocks, default
    // preselected, or one drawn now.
    const mySignatures = (usePage().props as any)?.auth?.user?.signatures ?? [];
    const sigRef = useRef<SignaturePickerHandle>(null);
    const [signing, setSigning] = useState<any | null>(null);
    const [busy, setBusy] = useState(false);
    const doSign = () => {
        if (!signing) return;
        const choice = sigRef.current?.value();
        setBusy(true);
        router.post(`/musak-challans/${signing.id}/sign`, {
            signature: choice?.drawn ?? null,
            user_signature_id: choice?.userSignatureId ?? null,
        }, { preserveScroll: true, onFinish: () => setBusy(false), onSuccess: () => setSigning(null) });
    };
    const unsign = (c: any) => {
        if (!confirm(`Remove the signature from চালানপত্র ${c.challan_no ?? c.id}?`)) return;
        router.delete(`/musak-challans/${c.id}/sign`, { preserveScroll: true });
    };

    const go = (patch: Record<string, any>) =>
        router.get('/musak-challans', { search, status: filters.status ?? '', ...patch },
            { preserveState: true, replace: true });

    const runSearch = (e: FormEvent) => { e.preventDefault(); go({ search }); };

    const del = (c: any) => {
        if (!confirm('Delete this draft চালানপত্র?')) return;
        router.delete(`/musak-challans/${c.id}`, { preserveScroll: true });
    };

    // Whole taka, as the form prints it.
    const money = (n: number) => Math.round(n).toLocaleString('en-IN');

    return (
        <AppLayout header="মূসক ৬.৩">
            <Head title="মূসক ৬.৩" />

            <div className="max-w-6xl mx-auto space-y-5 animate-fade-in">

                <div className="rounded-2xl border border-surface-200 bg-surface-50/60 p-4 flex items-start justify-between gap-4">
                    <p className="text-sm text-surface-600">
                        <strong>কর চালানপত্র</strong> — the NBR VAT challan. Printed on plain paper with the
                        board's own masthead, in প্রথম / দ্বিতীয় / তৃতীয় কপি.
                    </p>
                    <Link href="/musak-challans/create" className="btn-primary shrink-0">
                        <i className="fi fi-rr-plus text-xs leading-none" /> New চালানপত্র
                    </Link>
                </div>

                <div className="card">
                    <div className="card-header flex flex-wrap items-center gap-3">
                        <h3 className="text-sm font-bold text-surface-900">
                            চালানপত্র <span className="text-surface-400 font-normal">({challans.total})</span>
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
                                    placeholder="Number, buyer or BIN…" className="form-input text-sm py-1.5 w-56" />
                            </form>
                        </div>
                    </div>

                    <div className="card-body p-0 overflow-x-auto">
                        {challans.data.length === 0 ? (
                            <p className="text-center py-12 text-sm text-surface-400">
                                None yet — start one with <strong>New চালানপত্র</strong>.
                            </p>
                        ) : (
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b border-surface-100 text-[10px] uppercase tracking-wider text-surface-500 font-bold">
                                        <th className="text-left px-4 py-2 w-24">নম্বর</th>
                                        <th className="text-left px-3 py-2">ক্রেতা</th>
                                        <th className="text-left px-3 py-2 w-36">বিআইএন</th>
                                        <th className="text-left px-3 py-2 w-36">ইস্যু</th>
                                        <th className="text-right px-3 py-2 w-32">সর্বমোট</th>
                                        <th className="text-left px-3 py-2 w-20">Status</th>
                                        <th className="px-4 py-2 w-56" />
                                    </tr>
                                </thead>
                                <tbody>
                                    {challans.data.map((c: any) => (
                                        <tr key={c.id} className="border-b border-surface-50 hover:bg-surface-50/60">
                                            <td className="px-4 py-2.5 font-mono text-xs text-surface-700">{c.challan_no ?? '—'}</td>
                                            <td className="px-3 py-2.5 font-semibold text-surface-900">{c.buyer_name}</td>
                                            <td className="px-3 py-2.5 text-xs text-surface-500">{c.buyer_bin ?? '—'}</td>
                                            <td className="px-3 py-2.5 text-xs text-surface-500">
                                                {c.issue_date ?? '—'}{c.issue_time ? ` · ${c.issue_time}` : ''}
                                            </td>
                                            <td className="px-3 py-2.5 text-right tabular-nums">৳ {money(c.total)}</td>
                                            <td className="px-3 py-2.5">
                                                <span className={`text-[10px] px-1.5 py-0.5 rounded border font-semibold uppercase ${
                                                    c.status === 'issued'
                                                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                                        : 'bg-surface-100 text-surface-500 border-surface-200'
                                                }`}>{c.status}</span>
                                                {c.signed_by
                                                    ? <div className="text-[10px] text-emerald-700 mt-1" title={c.signed_at ?? ''}>
                                                        <i className="fi fi-rr-signature mr-0.5" />Signed · {c.signed_by}
                                                      </div>
                                                    : <div className="text-[10px] text-surface-400 mt-1">Not signed</div>}
                                            </td>
                                            <td className="px-4 py-2.5">
                                                <div className="flex items-center justify-end gap-1.5">
                                                    {COPIES.map((copy) => (
                                                        <button key={copy.n}
                                                            onClick={() => setPdf({
                                                                url: `/musak-challans/${c.id}/pdf?preview=base64&copy=${copy.n}`,
                                                                title: `${copy.label} কপি — ${c.challan_no ?? c.id}`,
                                                            })}
                                                            title={`${copy.label} কপি`}
                                                            className="px-2 py-1 rounded-lg text-[11px] font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200 hover:bg-indigo-100">
                                                            {copy.label}
                                                        </button>
                                                    ))}
                                                    {canSign && (c.signed_by ? (
                                                        <button onClick={() => unsign(c)} title="Remove signature"
                                                            className="px-2 py-1 rounded-lg text-[11px] font-semibold text-surface-500 hover:bg-surface-100">
                                                            Unsign
                                                        </button>
                                                    ) : (
                                                        <button onClick={() => setSigning(c)} title="Sign Document"
                                                            className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-semibold text-white bg-brand-600 hover:bg-brand-500">
                                                            <i className="fi fi-rr-signature text-[10px] leading-none" /> Sign
                                                        </button>
                                                    ))}
                                                    <Link href={`/musak-challans/${c.id}/edit`} title="Edit"
                                                        className="w-7 h-7 inline-flex items-center justify-center rounded-lg text-surface-500 hover:bg-surface-100"><i className="fi fi-rr-pencil text-xs leading-none" /></Link>
                                                    {c.status !== 'issued' && (
                                                        <button onClick={() => del(c)} title="Delete draft"
                                                            className="w-7 h-7 inline-flex items-center justify-center rounded-lg text-red-500 hover:bg-red-50"><i className="fi fi-rr-trash text-xs leading-none" /></button>
                                                    )}
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

            <PdfPopupModal open={pdf !== null} pdfUrl={pdf?.url ?? null}
                title="মূসক ৬.৩ — কর চালানপত্র" subtitle={pdf?.title}
                onClose={() => setPdf(null)} />

            {signing && (
                <div className="fixed inset-0 z-[150] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => !busy && setSigning(null)} />
                    <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg">
                        <div className="px-5 py-3 border-b border-surface-100 flex items-center gap-3">
                            <div className="w-9 h-9 rounded-xl bg-brand-50 text-brand-600 flex items-center justify-center">
                                <i className="fi fi-rr-signature text-sm leading-none" />
                            </div>
                            <div>
                                <h3 className="text-sm font-bold text-surface-900">Sign চালানপত্র {signing.challan_no ?? `#${signing.id}`}</h3>
                                <p className="text-[11px] text-surface-500 leading-tight mt-0.5">
                                    Your signature prints at স্বাক্ষর, with your name and designation as the দায়িত্বপ্রাপ্ত ব্যক্তি.
                                </p>
                            </div>
                        </div>
                        <div className="p-5">
                            <SignaturePicker ref={sigRef} signatures={mySignatures} padHeight={110} />
                        </div>
                        <div className="px-5 py-3 border-t border-surface-100 flex items-center justify-end gap-2">
                            <button type="button" onClick={() => setSigning(null)} disabled={busy} className="btn-ghost">Cancel</button>
                            <button type="button" onClick={doSign} disabled={busy} className="btn-primary">
                                {busy
                                    ? <><i className="fi fi-rr-spinner animate-spin text-xs leading-none" /> Signing…</>
                                    : <><i className="fi fi-rr-check text-xs leading-none" /> Sign Document</>}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </AppLayout>
    );
}
