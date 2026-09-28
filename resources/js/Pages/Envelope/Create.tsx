import AppLayout from '@/Layouts/AppLayout';
import { Head } from '@inertiajs/react';
import { useMemo, useState } from 'react';
import PdfPopupModal from '@/Components/PdfPopupModal';

interface Size { key: string; label: string; mm: string; ratio: number }

export default function EnvelopeCreate({ sizes = [], sender, prefill = null }: any) {
    const [lang, setLang] = useState<'bn' | 'en'>('bn');
    const [size, setSize] = useState<string>(sizes[0]?.key ?? '');
    const [to, setTo] = useState<string>(prefill?.to ?? '');
    const [from, setFrom] = useState<string>(sender?.bn ?? '');
    const [note, setNote] = useState<string>(prefill?.note ?? '');
    const [emblem, setEmblem] = useState(true);
    const [pdf, setPdf] = useState<string | null>(null);

    // The sender block is written in whichever language the envelope prints in,
    // so switching language swaps it — unless it has been overtyped.
    const switchLang = (next: 'bn' | 'en') => {
        if (from.trim() === '' || from === sender?.bn || from === sender?.en) {
            setFrom(sender?.[next] ?? '');
        }
        setLang(next);
    };

    const picked: Size | undefined = sizes.find((s: Size) => s.key === size);

    const url = useMemo(() => {
        const q = new URLSearchParams({
            size, to, from, note, lang,
            emblem: emblem ? '1' : '0',
            preview: 'base64',
        });
        return `/envelopes/pdf?${q.toString()}`;
    }, [size, to, from, note, lang, emblem]);

    const ready = to.trim() !== '' && size !== '';

    return (
        <AppLayout header="Envelope">
            <Head title="Envelope" />

            <div className="max-w-5xl mx-auto space-y-5 animate-fade-in">

                <div className="rounded-2xl border border-surface-200 bg-surface-50/60 p-4">
                    <p className="text-sm text-surface-600">
                        Print the envelope itself — <strong>To</strong> and <strong>From</strong>, nothing else.
                        Nothing is saved; the letter or note it travels with is already on record.
                    </p>
                    {prefill?.source && (
                        <p className="mt-2 text-xs font-semibold text-brand-600">
                            <i className="fi fi-rr-link-alt text-[10px] leading-none" /> Filled from — {prefill.source}
                        </p>
                    )}
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
                    <div className="lg:col-span-3 space-y-5">
                        <div className="card">
                            <div className="card-header flex items-center justify-between">
                                <h3 className="text-sm font-bold text-surface-900">Addresses</h3>
                                <div className="flex rounded-lg border border-surface-200 overflow-hidden text-xs font-bold">
                                    {(['bn', 'en'] as const).map((l) => (
                                        <button key={l} type="button" onClick={() => switchLang(l)}
                                            className={`px-3 py-1.5 ${lang === l ? 'bg-brand-500 text-white' : 'text-surface-500 hover:bg-surface-50'}`}>
                                            {l === 'bn' ? 'বাংলা' : 'EN'}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <div className="card-body space-y-4">
                                <div className="form-group !mb-0">
                                    <label className="form-label">To <span className="text-red-500">*</span></label>
                                    <textarea className="form-textarea" rows={4} value={to}
                                        onChange={(e) => setTo(e.target.value)}
                                        placeholder={lang === 'bn'
                                            ? 'ব্যবস্থাপনা পরিচালক\nপ্রতিষ্ঠানের নাম\nঠিকানা'
                                            : 'The Managing Director\nCompany Name\nAddress'} />
                                    <p className="form-hint">One line per line, exactly as it should print.</p>
                                </div>

                                <div className="form-group !mb-0">
                                    <label className="form-label">From</label>
                                    <textarea className="form-textarea" rows={4} value={from}
                                        onChange={(e) => setFrom(e.target.value)} />
                                    <p className="form-hint">Prefilled from this centre — overtype it if the envelope goes out from elsewhere.</p>
                                </div>

                                <div className="form-group !mb-0">
                                    <label className="form-label">Reference <span className="form-label-optional">Optional</span></label>
                                    <input className="form-input" value={note} onChange={(e) => setNote(e.target.value)}
                                        placeholder="Ref: BITAC/IED/2026/…" />
                                    <p className="form-hint">Prints under the address, so a returned envelope can be traced back.</p>
                                </div>

                                <label className="flex items-center gap-2 text-sm text-surface-700 cursor-pointer">
                                    <input type="checkbox" checked={emblem} onChange={(e) => setEmblem(e.target.checked)}
                                        className="rounded border-surface-300" />
                                    Print the national emblem beside the sender
                                </label>
                            </div>
                        </div>
                    </div>

                    <div className="lg:col-span-2 space-y-5">
                        <div className="card">
                            <div className="card-header"><h3 className="text-sm font-bold text-surface-900">Envelope size</h3></div>
                            <div className="card-body space-y-2">
                                {sizes.map((s: Size) => (
                                    <label key={s.key}
                                        className={`flex items-center gap-3 p-2.5 rounded-xl border cursor-pointer transition-colors ${
                                            size === s.key ? 'border-brand-400 bg-brand-50/60' : 'border-surface-200 hover:bg-surface-50'
                                        }`}>
                                        <input type="radio" name="size" value={s.key} checked={size === s.key}
                                            onChange={() => setSize(s.key)} className="shrink-0" />
                                        <span className="min-w-0 flex-1">
                                            <span className="block text-sm font-semibold text-surface-900">{s.label}</span>
                                            <span className="block text-[11px] text-surface-400">{s.mm}</span>
                                        </span>
                                        <span className="shrink-0 border border-surface-300 rounded bg-white"
                                            style={{ width: 34, height: Math.max(12, Math.round(34 / (s.ratio || 1))) }} />
                                    </label>
                                ))}
                                <p className="form-hint pt-1">
                                    Provisional sizes — tell us the envelopes actually in use and they can be corrected.
                                </p>
                            </div>
                        </div>

                        <div className="card">
                            <div className="card-body space-y-2">
                                <button type="button" disabled={!ready} onClick={() => setPdf(url)}
                                    className="btn-primary w-full justify-center disabled:opacity-40">
                                    <i className="fi fi-rr-print text-xs leading-none" /> Preview &amp; print
                                </button>
                                <a href={ready ? url.replace('preview=base64', 'preview=0') : undefined}
                                    className={`btn-outline w-full justify-center ${ready ? '' : 'pointer-events-none opacity-40'}`}>
                                    <i className="fi fi-rr-download text-xs leading-none" /> Download
                                </a>
                                {!ready && <p className="text-[11px] text-center text-surface-400">Type the recipient first.</p>}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <PdfPopupModal open={pdf !== null} pdfUrl={pdf} title="Envelope"
                subtitle={picked?.label} onClose={() => setPdf(null)} />
        </AppLayout>
    );
}
