import { Head, useForm } from '@inertiajs/react';
import { FormEvent, useRef, useState } from 'react';
import SignaturePad, { SignaturePadHandle } from '@/Components/SignaturePad';

interface Line { part_no: string | null; description: string | null; quantity: number; unit: string | null }
interface Delivery {
    challan_number: string; type: 'full' | 'partial'; customer: string | null; job_number: string | number | null;
    vehicle: string | null; date: string; lines: Line[]; quantity: number;
}
interface Props {
    state: 'ok' | 'signed' | 'expired' | 'closed' | 'invalid';
    delivery: Delivery | null;
    signedBy: string | null;
    bitac: { name_bn?: string | null; ministry_bn?: string | null; logo_left?: string | null } | null;
    token: string;
}

/**
 * The page the client's man signs for the goods on — his own phone (from the
 * QR code or a WhatsApp link) or BITAC's tablet. Public; the link is the key.
 * Big targets, one column, nothing to scroll sideways.
 */
export default function ReceiveDelivery({ state, delivery, signedBy, bitac, token }: Props) {
    const pad = useRef<SignaturePadHandle>(null);
    const [padError, setPadError] = useState('');
    const { data, setData, post, processing, errors, transform } = useForm({
        name: '', designation: '', phone: '', signature: '', confirm: false as boolean,
    });

    const submit = (e: FormEvent) => {
        e.preventDefault();
        const sig = pad.current?.toDataURL() ?? null;
        if (!sig) { setPadError('Please sign in the box.'); return; }
        setPadError('');
        transform(d => ({ ...d, signature: sig }));
        post(`/receive/${token}`, { preserveScroll: true });
    };

    return (
        <div className="min-h-screen bg-surface-50">
            <Head title="Receive goods — BITAC" />

            <header className="bg-ink-950 text-white">
                <div className="max-w-lg mx-auto px-4 py-4 flex items-center gap-3">
                    {bitac?.logo_left && <img src={bitac.logo_left} alt="" className="w-10 h-10 object-contain bg-white rounded-full p-0.5" />}
                    <div className="min-w-0">
                        <div className="text-sm font-bold leading-tight truncate">{bitac?.name_bn ?? 'BITAC'}</div>
                        <div className="text-[11px] text-white/60 leading-tight">Delivery receipt</div>
                    </div>
                </div>
            </header>

            <main className="max-w-lg mx-auto px-4 py-5 space-y-4">
                {state !== 'ok' && (
                    <div className={`rounded-2xl border p-5 text-center ${state === 'signed' ? 'border-emerald-200 bg-emerald-50' : 'border-surface-200 bg-white'}`}>
                        <div className={`w-14 h-14 rounded-full mx-auto flex items-center justify-center text-2xl ${state === 'signed' ? 'bg-emerald-100 text-emerald-700' : 'bg-surface-100 text-surface-500'}`}>
                            <i className={`fi ${state === 'signed' ? 'fi-rr-check' : 'fi-rr-link-slash'} leading-none`} />
                        </div>
                        <h1 className="text-lg font-bold text-surface-900 mt-3">
                            {state === 'signed' ? 'Thank you — signed' : state === 'expired' ? 'This link has expired' : 'This link is not valid'}
                        </h1>
                        <p className="text-sm text-surface-600 mt-1">
                            {state === 'signed'
                                ? <>Received by <b>{signedBy}</b>{delivery ? <> for challan <b>{delivery.challan_number}</b></> : null}. You can close this page.</>
                                : 'Please ask the BITAC staff at the counter for a new link.'}
                        </p>
                    </div>
                )}

                {delivery && (
                    <section className="rounded-2xl bg-white border border-surface-200 overflow-hidden">
                        <div className="px-4 py-3 border-b border-surface-100">
                            <div className="text-[11px] uppercase tracking-wider font-bold text-surface-500">
                                {delivery.type === 'partial' ? 'Partial delivery challan' : 'Delivery challan'}
                            </div>
                            <div className="font-mono text-base font-bold text-surface-900">{delivery.challan_number}</div>
                            <div className="text-sm text-surface-700 mt-0.5">{delivery.customer ?? '—'}</div>
                            <div className="text-xs text-surface-500">
                                Job No. {delivery.job_number ?? '—'} · {delivery.date}{delivery.vehicle ? ` · ${delivery.vehicle}` : ''}
                            </div>
                        </div>
                        <ul className="divide-y divide-surface-100">
                            {delivery.lines.map((l, i) => (
                                <li key={i} className="px-4 py-2.5 flex items-start gap-3">
                                    <span className="text-xs text-surface-400 w-10 shrink-0 pt-0.5">{l.part_no ?? i + 1}</span>
                                    <span className="flex-1 text-sm text-surface-800">{l.description}</span>
                                    <span className="text-sm font-bold text-surface-900 whitespace-nowrap">{l.quantity} {l.unit ?? ''}</span>
                                </li>
                            ))}
                            {delivery.lines.length === 0 && (
                                <li className="px-4 py-2.5 text-sm text-surface-800">{delivery.quantity} pcs</li>
                            )}
                        </ul>
                    </section>
                )}

                {state === 'ok' && (
                    <form onSubmit={submit} className="rounded-2xl bg-white border border-surface-200 p-4 space-y-4">
                        <div>
                            <h2 className="text-base font-bold text-surface-900">Sign for the goods</h2>
                            <p className="text-xs text-surface-500 mt-0.5">Your details and signature print on the challan.</p>
                        </div>

                        <div>
                            <label className="form-label">Your name *</label>
                            <input className="form-input text-base" value={data.name} autoComplete="name"
                                onChange={e => setData('name', e.target.value)} required />
                            {errors.name && <p className="form-error">{errors.name}</p>}
                        </div>
                        <div>
                            <label className="form-label">Designation</label>
                            <input className="form-input text-base" value={data.designation} autoComplete="organization-title"
                                onChange={e => setData('designation', e.target.value)} />
                        </div>
                        <div>
                            <label className="form-label">Mobile number *</label>
                            <input className="form-input text-base" type="tel" inputMode="tel" value={data.phone} autoComplete="tel"
                                onChange={e => setData('phone', e.target.value)} required />
                            {errors.phone && <p className="form-error">{errors.phone}</p>}
                        </div>

                        <div>
                            <div className="flex items-center justify-between">
                                <label className="form-label mb-0">Signature *</label>
                                <button type="button" onClick={() => pad.current?.clear()} className="text-xs font-semibold text-brand-600">
                                    Clear
                                </button>
                            </div>
                            <div className="mt-1.5 rounded-xl border-2 border-dashed border-surface-300 bg-surface-50" style={{ touchAction: 'none' }}>
                                <SignaturePad ref={pad} height={190} />
                            </div>
                            <p className="text-[11px] text-surface-400 mt-1">Sign with your finger inside the box.</p>
                            {(padError || errors.signature) && <p className="form-error">{padError || errors.signature}</p>}
                        </div>

                        <label className="flex items-start gap-2.5 text-sm text-surface-700">
                            <input type="checkbox" className="mt-1 w-5 h-5" checked={data.confirm}
                                onChange={e => setData('confirm', e.target.checked)} />
                            <span>I have received the goods listed above.</span>
                        </label>
                        {errors.confirm && <p className="form-error">{errors.confirm}</p>}

                        <button type="submit" disabled={processing || !data.confirm}
                            className="btn-primary w-full justify-center py-3 text-base disabled:opacity-50">
                            {processing ? 'Saving…' : 'Sign & submit'}
                        </button>
                    </form>
                )}
            </main>
        </div>
    );
}
