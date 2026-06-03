import { useForm } from '@inertiajs/react';
import { FormEvent, useRef, useState } from 'react';
import SignaturePad, { SignaturePadHandle } from '@/Components/SignaturePad';

interface Props {
    signatureUrl?: string | null;
    status?: string | null;
}

type Mode = 'draw' | 'upload';

export default function UpdateSignatureForm({ signatureUrl, status }: Props) {
    const [mode, setMode] = useState<Mode>('draw');
    const padRef = useRef<SignaturePadHandle | null>(null);
    const [uploadPreview, setUploadPreview] = useState<string | null>(null);

    const form = useForm<{
        signature_data: string | null;
        signature_image: File | null;
        remove: boolean;
    }>({
        signature_data: null,
        signature_image: null,
        remove: false,
    });

    const save = (e: FormEvent) => {
        e.preventDefault();

        if (mode === 'draw') {
            const data = padRef.current?.toDataURL();
            if (!data) {
                alert('Please draw your signature before saving.');
                return;
            }
            form.transform((d) => ({ ...d, signature_data: data, signature_image: null, remove: false }));
            form.post('/profile/signature', {
                preserveScroll: true,
                onSuccess: () => padRef.current?.clear(),
            });
        } else {
            if (!form.data.signature_image) {
                alert('Please choose an image to upload.');
                return;
            }
            form.transform((d) => ({ ...d, signature_data: null, remove: false }));
            form.post('/profile/signature', {
                forceFormData: true,
                preserveScroll: true,
                onSuccess: () => {
                    setUploadPreview(null);
                    form.setData('signature_image', null);
                },
            });
        }
    };

    const remove = () => {
        if (!confirm('Remove your saved signature?')) return;
        form.transform((d) => ({ ...d, signature_data: null, signature_image: null, remove: true }));
        form.post('/profile/signature', { preserveScroll: true });
    };

    const handleFile = (file: File | null) => {
        form.setData('signature_image', file);
        if (file) {
            const url = URL.createObjectURL(file);
            setUploadPreview(url);
        } else {
            setUploadPreview(null);
        }
    };

    return (
        <form onSubmit={save} className="space-y-5">
            <p className="text-sm text-surface-500">
                Your signature is used on official documents — Gate Passes, Quotations, Approvals, and Inspection Certificates.
            </p>

            {/* Current signature preview */}
            {signatureUrl && (
                <div className="rounded-xl border border-surface-200 bg-surface-50/60 p-4 flex items-center gap-4">
                    <div className="text-[10px] font-semibold text-surface-400 uppercase tracking-wider shrink-0 w-20">
                        Current
                    </div>
                    <div className="flex-1 flex items-center justify-center bg-white border border-surface-200 rounded-lg p-2 min-h-[60px]">
                        <img src={signatureUrl} alt="Current signature" className="max-h-16 object-contain" />
                    </div>
                    <button
                        type="button"
                        onClick={remove}
                        disabled={form.processing}
                        className="text-xs font-semibold text-red-600 hover:text-red-700 transition-colors shrink-0"
                    >
                        <i className="fi fi-rr-trash text-[10px] leading-none mr-1" /> Remove
                    </button>
                </div>
            )}

            {/* Mode toggle */}
            <div className="inline-flex rounded-xl bg-surface-100 p-1">
                <button type="button"
                    onClick={() => setMode('draw')}
                    className={`px-3.5 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all ${
                        mode === 'draw' ? 'bg-white text-surface-900 shadow-sm' : 'text-surface-500 hover:text-surface-700'
                    }`}>
                    <i className="fi fi-rr-signature text-[10px] leading-none mr-1.5" /> Draw
                </button>
                <button type="button"
                    onClick={() => setMode('upload')}
                    className={`px-3.5 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all ${
                        mode === 'upload' ? 'bg-white text-surface-900 shadow-sm' : 'text-surface-500 hover:text-surface-700'
                    }`}>
                    <i className="fi fi-rr-upload text-[10px] leading-none mr-1.5" /> Upload Image
                </button>
            </div>

            {/* Draw mode */}
            {mode === 'draw' && (
                <div className="space-y-3">
                    <div className="rounded-xl border border-surface-200 bg-white p-3">
                        <SignaturePad ref={padRef} width={520} height={140} className="w-full" />
                    </div>
                    <div className="flex items-center justify-between text-xs text-surface-400">
                        <span>Use mouse or touch to sign on the pad above.</span>
                        <button type="button" onClick={() => padRef.current?.clear()}
                            className="text-surface-500 hover:text-surface-900 font-semibold inline-flex items-center gap-1">
                            <i className="fi fi-rr-eraser text-[10px] leading-none" /> Clear
                        </button>
                    </div>
                    {form.errors.signature_data && <p className="form-error">{form.errors.signature_data}</p>}
                </div>
            )}

            {/* Upload mode */}
            {mode === 'upload' && (
                <div className="space-y-3">
                    <input
                        type="file"
                        accept="image/png,image/jpeg,image/webp"
                        onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
                        className="block w-full text-sm text-surface-500
                                   file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border-0
                                   file:text-sm file:font-semibold file:bg-brand-50 file:text-brand-700
                                   hover:file:bg-brand-100 file:cursor-pointer file:transition-colors"
                    />
                    <p className="text-xs text-surface-400">
                        PNG, JPG or WebP. Max 2 MB. Transparent PNG works best on documents.
                    </p>
                    {uploadPreview && (
                        <div className="rounded-xl border border-surface-200 bg-white p-3 flex items-center justify-center min-h-[80px]">
                            <img src={uploadPreview} alt="Preview" className="max-h-20 object-contain" />
                        </div>
                    )}
                    {form.errors.signature_image && <p className="form-error">{form.errors.signature_image}</p>}
                </div>
            )}

            {/* Submit + flash */}
            <div className="flex items-center gap-3 pt-2">
                <button type="submit" disabled={form.processing} className="btn-primary">
                    {form.processing
                        ? <><i className="fi fi-rr-spinner animate-spin text-sm" /> Saving…</>
                        : <><i className="fi fi-rr-disk text-sm" /> Save signature</>}
                </button>
                {status === 'Signature saved.' || status === 'Signature uploaded.' || status === 'Signature removed.' ? (
                    <span className="text-xs text-emerald-700 inline-flex items-center gap-1">
                        <i className="fi fi-rr-check-circle text-xs" /> {status}
                    </span>
                ) : null}
            </div>
        </form>
    );
}
