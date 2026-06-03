import { useForm, usePage } from '@inertiajs/react';
import { FormEvent, useEffect, useState } from 'react';

interface Props {
    avatarUrl?: string | null;
    userName?: string;
    status?: string | null;
}

export default function UpdateAvatarForm({ avatarUrl, userName, status }: Props) {
    const [preview, setPreview] = useState<string | null>(null);
    const form = useForm<{ avatar: File | null; remove: boolean }>({
        avatar: null,
        remove: false,
    });

    // Cleanup the local object URL on unmount / preview change
    useEffect(() => {
        return () => { if (preview) URL.revokeObjectURL(preview); };
    }, [preview]);

    const handleFile = (file: File | null) => {
        if (preview) URL.revokeObjectURL(preview);
        form.setData('avatar', file);
        setPreview(file ? URL.createObjectURL(file) : null);
    };

    const save = (e: FormEvent) => {
        e.preventDefault();
        if (!form.data.avatar) {
            alert('Please choose a photo to upload.');
            return;
        }
        form.transform((d) => ({ ...d, remove: false }));
        form.post('/profile/avatar', {
            forceFormData: true,
            preserveScroll: true,
            onSuccess: () => {
                handleFile(null);
            },
        });
    };

    const remove = () => {
        if (!confirm('Remove your profile photo?')) return;
        form.transform((d) => ({ ...d, avatar: null, remove: true }));
        form.post('/profile/avatar', { preserveScroll: true });
    };

    const initials = (userName ?? '?')
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map(s => s[0]?.toUpperCase() ?? '')
        .join('') || '?';

    const displayUrl = preview ?? avatarUrl ?? null;

    return (
        <form onSubmit={save} className="space-y-5">
            <p className="text-sm text-surface-500">
                Square photo works best — it's shown in the sidebar, top bar, and on documents you sign.
            </p>

            <div className="flex items-center gap-5">
                {/* Avatar preview circle */}
                <div className="relative shrink-0">
                    {displayUrl ? (
                        <img
                            src={displayUrl}
                            alt={userName ?? 'Avatar'}
                            className="w-24 h-24 rounded-full object-cover ring-4 ring-white shadow-md border border-surface-200"
                        />
                    ) : (
                        <div className="w-24 h-24 rounded-full flex items-center justify-center bg-gradient-to-br from-brand-400 to-brand-600 text-white text-2xl font-bold shadow-md">
                            {initials}
                        </div>
                    )}
                    {preview && (
                        <span className="absolute -top-1 -right-1 px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider bg-amber-500 text-white shadow-sm">
                            Preview
                        </span>
                    )}
                </div>

                {/* Picker + actions */}
                <div className="flex-1 space-y-3">
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
                        PNG, JPG or WebP. Max 4 MB. Best result with a square photo (1:1).
                    </p>
                    {form.errors.avatar && <p className="form-error">{form.errors.avatar}</p>}
                </div>
            </div>

            <div className="flex items-center gap-3 pt-2 border-t border-surface-100">
                <button type="submit" disabled={form.processing || !form.data.avatar} className="btn-primary">
                    {form.processing
                        ? <><i className="fi fi-rr-spinner animate-spin text-sm" /> Saving…</>
                        : <><i className="fi fi-rr-disk text-sm" /> Save photo</>}
                </button>
                {avatarUrl && (
                    <button type="button"
                        onClick={remove}
                        disabled={form.processing}
                        className="btn-ghost text-red-600 hover:text-red-700 hover:bg-red-50">
                        <i className="fi fi-rr-trash text-sm" /> Remove
                    </button>
                )}
                {(status === 'Profile photo updated.' || status === 'Profile photo removed.') && (
                    <span className="text-xs text-emerald-700 inline-flex items-center gap-1">
                        <i className="fi fi-rr-check-circle text-xs" /> {status}
                    </span>
                )}
            </div>
        </form>
    );
}
