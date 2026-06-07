import { useForm } from '@inertiajs/react';
import { FormEvent, useEffect, useRef, useState } from 'react';
import SignaturePad, { SignaturePadHandle } from '@/Components/SignaturePad';

interface Props {
    open: boolean;
    onClose: () => void;
    workOrder: { id: number; wo_number: string; product: string };
    existing?: any | null;
}

type Mode = 'uploaded' | 'self_issued';

export default function CompletionCertificateModal({ open, onClose, workOrder, existing }: Props) {
    const [mode, setMode] = useState<Mode>(existing?.mode ?? 'self_issued');
    const padRef = useRef<SignaturePadHandle | null>(null);

    const { data, setData, post, processing, errors, reset } = useForm<any>({
        mode,
        issued_by_name:        existing?.issued_by_name ?? '',
        issued_by_designation: existing?.issued_by_designation ?? '',
        issued_date:           new Date().toISOString().slice(0, 10),
        rating:                existing?.rating ?? '',
        remarks:               existing?.remarks ?? '',
        file:                  null as File | null,
        signature:             '' as string,
    });

    useEffect(() => { setData('mode', mode); }, [mode]);

    useEffect(() => {
        if (!open) {
            setMode(existing?.mode ?? 'self_issued');
            reset();
        }
    }, [open]);

    if (!open) return null;

    const submit = (e: FormEvent) => {
        e.preventDefault();
        if (mode === 'self_issued') {
            const sig = padRef.current?.toDataURL();
            if (!sig) {
                alert('Please sign the certificate before submitting.');
                return;
            }
            setData('signature', sig);
            // Defer post by a tick so the data state updates first
            requestAnimationFrame(() => post(`/customer/work-orders/${workOrder.id}/completion-certificate`, {
                forceFormData: true,
                onSuccess: onClose,
            }));
            return;
        }
        // uploaded mode
        if (!data.file) {
            alert('Please attach the signed certificate file.');
            return;
        }
        post(`/customer/work-orders/${workOrder.id}/completion-certificate`, {
            forceFormData: true,
            onSuccess: onClose,
        });
    };

    return (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/60 backdrop-blur-sm p-4 sm:p-8 animate-fade-in">
            <div className="w-full max-w-2xl bg-white rounded-2xl shadow-2xl overflow-hidden animate-scale-in origin-top">
                {/* Header */}
                <div className="px-5 py-4 border-b border-surface-100 flex items-center justify-between">
                    <div className="flex items-center gap-3 min-w-0">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-400 to-emerald-600 text-white flex items-center justify-center shrink-0">
                            <i className="fi fi-rr-diploma text-base leading-none" />
                        </div>
                        <div className="min-w-0">
                            <h3 className="text-sm font-bold text-surface-900">Completion Certificate</h3>
                            <p className="text-[11px] text-surface-500 mt-0.5 truncate">
                                {workOrder.wo_number} · {workOrder.product}
                            </p>
                        </div>
                    </div>
                    <button onClick={onClose} type="button" className="btn-ghost btn-icon">
                        <i className="fi fi-rr-cross-small text-sm leading-none" />
                    </button>
                </div>

                {/* Mode tabs */}
                <div className="px-5 pt-4">
                    <div className="grid grid-cols-2 gap-1 p-1 bg-surface-100 rounded-xl">
                        <button type="button" onClick={() => setMode('self_issued')}
                            className={`py-2 px-3 rounded-lg text-xs font-bold transition-colors ${
                                mode === 'self_issued' ? 'bg-white text-surface-900 shadow-sm' : 'text-surface-500 hover:text-surface-700'
                            }`}>
                            <i className="fi fi-rr-edit text-xs leading-none mr-1" /> Self-Issue (in portal)
                        </button>
                        <button type="button" onClick={() => setMode('uploaded')}
                            className={`py-2 px-3 rounded-lg text-xs font-bold transition-colors ${
                                mode === 'uploaded' ? 'bg-white text-surface-900 shadow-sm' : 'text-surface-500 hover:text-surface-700'
                            }`}>
                            <i className="fi fi-rr-cloud-upload text-xs leading-none mr-1" /> Upload Signed PDF
                        </button>
                    </div>
                </div>

                <form onSubmit={submit} className="p-5 space-y-4">

                    {/* Shared fields */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="form-group">
                            <label className="form-label">Issued By <span className="text-red-500">*</span></label>
                            <input type="text" value={data.issued_by_name}
                                onChange={e => setData('issued_by_name', e.target.value)}
                                className="form-input" placeholder="Md. Rahim Uddin" required />
                            {errors.issued_by_name && <p className="form-error">{errors.issued_by_name as any}</p>}
                        </div>
                        <div className="form-group">
                            <label className="form-label">Designation</label>
                            <input type="text" value={data.issued_by_designation}
                                onChange={e => setData('issued_by_designation', e.target.value)}
                                className="form-input" placeholder="Executive Engineer" />
                        </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="form-group">
                            <label className="form-label">Issued Date <span className="text-red-500">*</span></label>
                            <input type="date" value={data.issued_date}
                                max={new Date().toISOString().slice(0, 10)}
                                onChange={e => setData('issued_date', e.target.value)}
                                className="form-input" required />
                        </div>
                        <div className="form-group">
                            <label className="form-label">Satisfaction Rating <span className="form-label-optional">optional</span></label>
                            <div className="flex items-center gap-1 mt-1">
                                {[1, 2, 3, 4, 5].map(n => (
                                    <button key={n} type="button"
                                        onClick={() => setData('rating', data.rating === n ? '' : n)}
                                        className="text-2xl leading-none transition-transform hover:scale-110">
                                        <span className={Number(data.rating) >= n ? 'text-amber-400' : 'text-surface-200'}>★</span>
                                    </button>
                                ))}
                                {data.rating && (
                                    <span className="ml-2 text-xs text-surface-500 font-mono">{data.rating}/5</span>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="form-group">
                        <label className="form-label">Remarks <span className="form-label-optional">optional</span></label>
                        <textarea value={data.remarks}
                            onChange={e => setData('remarks', e.target.value)}
                            rows={3}
                            placeholder="e.g. Work completed satisfactorily. All items delivered in good condition."
                            className="form-textarea" />
                    </div>

                    {/* Mode-specific block */}
                    {mode === 'self_issued' ? (
                        <div className="form-group">
                            <label className="form-label">Your Signature <span className="text-red-500">*</span></label>
                            <div className="relative">
                                <SignaturePad ref={padRef} height={140} />
                                <button type="button" onClick={() => padRef.current?.clear()}
                                    className="absolute top-2 right-2 inline-flex items-center gap-1 px-2 py-1 rounded-md bg-white/90 backdrop-blur text-[10px] font-semibold text-red-600 hover:text-red-700 hover:bg-red-50 shadow-sm border border-surface-200">
                                    <i className="fi fi-rr-eraser text-[10px] leading-none" /> Clear
                                </button>
                            </div>
                            <p className="text-[10px] text-surface-400 mt-1">
                                Your signature will be embedded on the BITAC-formatted certificate PDF that is auto-generated on submit.
                            </p>
                        </div>
                    ) : (
                        <div className="form-group">
                            <label className="form-label">Signed Certificate File <span className="text-red-500">*</span></label>
                            <input type="file"
                                accept=".pdf,.jpg,.jpeg,.png"
                                onChange={e => setData('file', e.target.files?.[0] ?? null)}
                                className="block w-full text-sm text-surface-500
                                    file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0
                                    file:text-xs file:font-semibold file:bg-emerald-50 file:text-emerald-700
                                    hover:file:bg-emerald-100 file:cursor-pointer" />
                            <p className="text-[10px] text-surface-400 mt-1">PDF / JPG / PNG. Max 10 MB. Upload the cert signed on your organisation's letterhead.</p>
                            {data.file && (
                                <p className="text-[11px] text-emerald-700 mt-1 inline-flex items-center gap-1">
                                    <i className="fi fi-rr-check leading-none text-[10px]" /> {data.file.name}
                                </p>
                            )}
                            {errors.file && <p className="form-error">{errors.file as any}</p>}
                        </div>
                    )}

                    {existing && (
                        <div className="rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-800">
                            <i className="fi fi-rr-info leading-none text-[10px] mr-1" />
                            You have already issued certificate <span className="font-mono font-bold">{existing.certificate_number}</span>. Submitting again will replace it.
                        </div>
                    )}

                    <div className="flex items-center gap-2 pt-2">
                        <button type="submit" disabled={processing} className="btn-primary">
                            {processing
                                ? <><i className="fi fi-rr-spinner animate-spin text-sm" /> Submitting…</>
                                : <><i className="fi fi-rr-paper-plane text-sm" /> Submit Certificate</>}
                        </button>
                        <button type="button" onClick={onClose} className="btn-outline btn-sm">Cancel</button>
                    </div>
                </form>
            </div>
        </div>
    );
}
