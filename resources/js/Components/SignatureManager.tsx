import { router, useForm } from '@inertiajs/react';
import { FormEvent, useState } from 'react';

export interface UserSignatureItem {
    id: number;
    label: string;
    url: string | null;
    is_default: boolean;
}

interface Props {
    signatures: UserSignatureItem[];
    /** Where to POST a new one. */
    storeUrl: string;
    /** Given a signature id, the set-default and delete endpoints. */
    defaultUrl: (id: number) => string;
    destroyUrl: (id: number) => string;
    /** Shown above the list — whose signatures these are. */
    ownerLabel?: string;
    max?: number;
}

/**
 * Manage the signature blocks a user signs documents with.
 *
 * These are scans of the whole block — the pen stroke WITH the name,
 * designation, centre and contacts printed under it — because that is exactly
 * what goes onto the PDF; nothing is typed beneath the image. The copy here
 * says so, since uploading a bare squiggle would print a document with no
 * signatory named on it.
 */
export default function SignatureManager({
    signatures,
    storeUrl,
    defaultUrl,
    destroyUrl,
    ownerLabel,
    max = 6,
}: Props) {
    const [preview, setPreview] = useState<string | null>(null);

    const form = useForm<{ label: string; image: File | null }>({ label: '', image: null });

    const add = (e: FormEvent) => {
        e.preventDefault();
        if (!form.data.image) {
            alert('Choose a signature image first.');
            return;
        }
        form.post(storeUrl, {
            forceFormData: true,
            preserveScroll: true,
            onSuccess: () => {
                form.reset();
                setPreview(null);
            },
        });
    };

    const pickFile = (file: File | null) => {
        form.setData('image', file);
        setPreview(file ? URL.createObjectURL(file) : null);
    };

    const makeDefault = (s: UserSignatureItem) => {
        router.patch(defaultUrl(s.id), {}, { preserveScroll: true });
    };

    const remove = (s: UserSignatureItem) => {
        if (!confirm(`Remove “${s.label}”?\n\nDocuments already signed with it keep their signature.`)) return;
        router.delete(destroyUrl(s.id), { preserveScroll: true });
    };

    const atLimit = signatures.length >= max;

    return (
        <div className="space-y-5">
            <p className="text-sm text-surface-500">
                Upload the <strong>whole signature block</strong> as it is scanned — the signature together with the
                name, designation, centre and contacts printed under it. Documents print this image on its own and
                add nothing beneath it{ownerLabel ? ` for ${ownerLabel}` : ''}.
            </p>

            {/* The saved blocks */}
            {signatures.length > 0 ? (
                <div className="space-y-2">
                    {signatures.map((s) => (
                        <div
                            key={s.id}
                            className={`rounded-xl border p-3 flex items-center gap-4 transition-colors ${
                                s.is_default
                                    ? 'border-brand-300 bg-brand-50/50'
                                    : 'border-surface-200 bg-white hover:border-surface-300'
                            }`}
                        >
                            <div className="flex items-center justify-center bg-white border border-surface-200 rounded-lg p-2 w-40 h-20 shrink-0">
                                {s.url ? (
                                    <img src={s.url} alt={s.label} className="max-h-full max-w-full object-contain" />
                                ) : (
                                    <span className="text-[10px] text-surface-400">file missing</span>
                                )}
                            </div>

                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                    <span className="font-semibold text-surface-900 truncate" title={s.label}>
                                        {s.label}
                                    </span>
                                    {s.is_default && (
                                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-brand-500 text-white font-bold uppercase tracking-wider shrink-0">
                                            Default
                                        </span>
                                    )}
                                </div>
                                <p className="text-xs text-surface-400 mt-0.5">
                                    {s.is_default
                                        ? 'Used unless you pick another when signing.'
                                        : 'Available to pick when you sign.'}
                                </p>
                            </div>

                            <div className="flex items-center gap-3 shrink-0">
                                {!s.is_default && (
                                    <button
                                        type="button"
                                        onClick={() => makeDefault(s)}
                                        className="text-xs font-semibold text-brand-600 hover:text-brand-700 transition-colors"
                                    >
                                        Make default
                                    </button>
                                )}
                                <button
                                    type="button"
                                    onClick={() => remove(s)}
                                    className="text-xs font-semibold text-red-600 hover:text-red-700 transition-colors"
                                    title="Remove this signature"
                                >
                                    <i className="fi fi-rr-trash text-[10px] leading-none mr-1" />
                                    Remove
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                <div className="rounded-xl border border-dashed border-surface-300 bg-surface-50/60 p-6 text-center">
                    <p className="text-sm text-surface-500">No signature yet.</p>
                    <p className="text-xs text-surface-400 mt-1">
                        Documents will print the typed name and designation until one is added.
                    </p>
                </div>
            )}

            {/* Add another */}
            <form onSubmit={add} className="rounded-xl border border-surface-200 p-4 space-y-3">
                <div className="text-[10px] font-semibold text-surface-400 uppercase tracking-wider">
                    Add a signature
                </div>

                {atLimit ? (
                    <p className="text-sm text-surface-500">
                        You have reached the limit of {max}. Remove one to add another.
                    </p>
                ) : (
                    <>
                        <div className="form-group">
                            <label className="form-label">Name it</label>
                            <input
                                className="form-input"
                                value={form.data.label}
                                onChange={(e) => form.setData('label', e.target.value)}
                                placeholder="e.g. Bangla block, English block, Executive Engineer"
                                maxLength={80}
                            />
                            {form.errors.label && <p className="form-error">{form.errors.label}</p>}
                        </div>

                        <input
                            type="file"
                            accept="image/png,image/jpeg,image/webp"
                            onChange={(e) => pickFile(e.target.files?.[0] ?? null)}
                            className="block w-full text-sm text-surface-500
                                       file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border-0
                                       file:text-sm file:font-semibold file:bg-brand-50 file:text-brand-700
                                       hover:file:bg-brand-100 file:cursor-pointer file:transition-colors"
                        />
                        <p className="text-xs text-surface-400">
                            PNG, JPG or WebP. Max 2 MB. A transparent PNG sits best on a letterhead.
                        </p>
                        {form.errors.image && <p className="form-error">{form.errors.image}</p>}

                        {preview && (
                            <div className="rounded-xl border border-surface-200 bg-white p-3 flex items-center justify-center min-h-[80px]">
                                <img src={preview} alt="Preview" className="max-h-24 object-contain" />
                            </div>
                        )}

                        <button type="submit" disabled={form.processing} className="btn-primary">
                            {form.processing ? (
                                <>
                                    <i className="fi fi-rr-spinner animate-spin text-sm" /> Uploading…
                                </>
                            ) : (
                                <>
                                    <i className="fi fi-rr-plus text-sm" /> Add signature
                                </>
                            )}
                        </button>
                    </>
                )}
            </form>
        </div>
    );
}
