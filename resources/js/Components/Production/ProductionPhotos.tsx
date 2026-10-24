import { router, usePage } from '@inertiajs/react';
import { useEffect, useMemo, useRef, useState } from 'react';
import FilePreviewModal, { PreviewableFile } from '@/Components/FilePicker/FilePreviewModal';

export interface PhotoPanel {
    min: number;
    locked: boolean;
    photos: { id: number; url: string; caption?: string | null; filename: string; uploaded_by?: string | null; uploaded_at?: string | null; can_delete: boolean }[];
    completed: { at: string; by?: string | null; note?: string | null } | null;
    blocker: string | null;
}

/**
 * Production photos of a job (BITAC, 2026-10-24). The shop and PCD add them
 * while the job is open; PCD needs at least `min` to complete a delivered job.
 * With `completeUrl` (PCD's page) the card also carries Complete Job.
 */
export default function ProductionPhotos({ data, uploadUrl, completeUrl }: { data: PhotoPanel; uploadUrl: string | null; completeUrl?: string }) {
    const { errors } = usePage().props as any;
    const [staged, setStaged] = useState<{ file: File; preview: string; caption: string }[]>([]);
    const [busy, setBusy] = useState(false);
    const [note, setNote] = useState('');
    const [lightbox, setLightbox] = useState<number | null>(null);
    const input = useRef<HTMLInputElement>(null);

    // Release the previews' object URLs when they leave the screen.
    useEffect(() => () => staged.forEach((s) => URL.revokeObjectURL(s.preview)), []);  // eslint-disable-line react-hooks/exhaustive-deps

    const have = data.photos.length;
    const short = Math.max(0, data.min - have);
    const canUpload = !!uploadUrl && !data.locked;

    const pick = (list: FileList | null) => {
        const files = Array.from(list ?? []).filter((f) => f.type.startsWith('image/')).slice(0, Math.max(0, 10 - staged.length));
        setStaged((s) => [...s, ...files.map((file) => ({ file, preview: URL.createObjectURL(file), caption: '' }))]);
    };
    const unstage = (i: number) => setStaged((s) => {
        URL.revokeObjectURL(s[i].preview);
        return s.filter((_, j) => j !== i);
    });
    const upload = () => {
        if (!uploadUrl || !staged.length) return;
        setBusy(true);
        router.post(uploadUrl, {
            photos: staged.map((s) => s.file),
            captions: staged.map((s) => s.caption),
        } as any, {
            forceFormData: true,
            preserveScroll: true,
            onSuccess: () => { staged.forEach((s) => URL.revokeObjectURL(s.preview)); setStaged([]); },
            onFinish: () => setBusy(false),
        });
    };
    const remove = (id: number) => {
        if (!confirm('Remove this photo?')) return;
        router.delete(`/production-photos/${id}`, { preserveScroll: true });
    };
    const complete = () => {
        if (!completeUrl || !confirm(`Complete this job with ${have} production photos? The photos are locked once it is completed.`)) return;
        setBusy(true);
        router.post(completeUrl, { note }, { preserveScroll: true, onFinish: () => setBusy(false) });
    };

    const previews: PreviewableFile[] = useMemo(() => data.photos.map((p) => ({
        id: p.id, url: p.url, filename: p.caption || p.filename,
        // The display name is the caption, so say it is an image outright.
        extension: (p.filename.split('.').pop() ?? 'jpg').toLowerCase(), mime_type: 'image/jpeg',
    })), [data.photos]);

    const photoErrors = Object.entries(errors ?? {}).filter(([k]) => k === 'photos' || k.startsWith('photos.')).map(([, v]) => v as string);

    return (
        <div className="card">
            <div className="card-header flex items-center justify-between gap-2">
                <div>
                    <h3 className="text-sm font-bold text-surface-900">{completeUrl ? 'Job Completion' : 'Production Photos'}</h3>
                    <p className="text-[11px] text-surface-500 mt-0.5">
                        {completeUrl
                            ? `Production photos — at least ${data.min} to complete the job`
                            : `Photos of the finished work — PCD needs at least ${data.min} to complete the job`}
                    </p>
                </div>
                <span className={`shrink-0 text-[11px] font-bold px-2 py-0.5 rounded-full ${short === 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-800'}`}>
                    <i className="fi fi-rr-camera text-[10px] mr-1" />{have}{data.locked ? '' : ` / ${data.min}`}
                </span>
            </div>
            <div className="card-body space-y-4">
                {data.completed && (
                    <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-emerald-800">
                        <div className="flex items-center gap-2 text-sm font-semibold">
                            <i className="fi fi-rr-badge-check text-sm leading-none" /> Job completed
                        </div>
                        <div className="text-[11px] opacity-80 mt-0.5">{data.completed.by ?? 'Automatically'} · {data.completed.at}</div>
                        {data.completed.note && <div className="text-xs mt-1.5 whitespace-pre-line">{data.completed.note}</div>}
                    </div>
                )}

                {have > 0 ? (
                    <div className="grid grid-cols-3 gap-2">
                        {data.photos.map((p, i) => (
                            <div key={p.id} className="group relative aspect-square rounded-lg overflow-hidden border border-surface-200 bg-surface-100">
                                <button type="button" onClick={() => setLightbox(i)} className="absolute inset-0" title={p.caption || p.filename}>
                                    <img src={p.url} alt={p.caption || p.filename} loading="lazy" className="w-full h-full object-cover" />
                                </button>
                                {p.caption && (
                                    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent px-1.5 pt-4 pb-1 text-[10px] font-medium text-white truncate pointer-events-none">
                                        {p.caption}
                                    </div>
                                )}
                                {p.can_delete && (
                                    <button type="button" onClick={() => remove(p.id)} title="Remove photo"
                                        className="absolute top-1 right-1 w-6 h-6 rounded-full bg-black/55 text-white text-xs flex items-center justify-center opacity-100 sm:opacity-0 group-hover:opacity-100 hover:bg-red-600 transition">
                                        ✕
                                    </button>
                                )}
                            </div>
                        ))}
                    </div>
                ) : (
                    <p className="text-xs text-surface-500">No production photos yet.</p>
                )}

                {/* Picked, not uploaded yet — each can carry a caption. */}
                {staged.length > 0 && (
                    <div className="space-y-2 rounded-xl border border-dashed border-brand-200 bg-brand-50/40 p-2.5">
                        {staged.map((s, i) => (
                            <div key={s.preview} className="flex items-center gap-2.5">
                                <img src={s.preview} alt="" className="w-12 h-12 rounded-lg object-cover border border-surface-200 shrink-0" />
                                <div className="flex-1 min-w-0">
                                    <input type="text" value={s.caption} maxLength={150}
                                        onChange={(e) => setStaged((all) => all.map((x, j) => j === i ? { ...x, caption: e.target.value } : x))}
                                        placeholder="Caption (optional, e.g. Finished shaft, front view)"
                                        className="form-input !py-1 text-xs" />
                                    <div className="text-[10px] text-surface-500 truncate mt-0.5">{s.file.name} · {(s.file.size / 1024).toFixed(0)} KB</div>
                                </div>
                                <button type="button" onClick={() => unstage(i)} className="text-surface-400 hover:text-red-600 text-xs shrink-0" title="Remove">✕</button>
                            </div>
                        ))}
                        <div className="flex gap-2 pt-1">
                            <button type="button" onClick={() => input.current?.click()} className="btn-ghost btn-sm flex-1 justify-center" disabled={busy || staged.length >= 10}>
                                Add more
                            </button>
                            <button type="button" onClick={upload} disabled={busy} className="btn-primary btn-sm flex-1 justify-center">
                                <i className="fi fi-rr-cloud-upload text-xs leading-none" /> Upload {staged.length} photo{staged.length > 1 ? 's' : ''}
                            </button>
                        </div>
                    </div>
                )}
                {photoErrors.length > 0 && <div className="form-error">{photoErrors[0]}</div>}

                {canUpload && staged.length === 0 && (
                    <button type="button" onClick={() => input.current?.click()}
                        className="w-full flex flex-col items-center justify-center gap-1 p-3 rounded-lg border-2 border-dashed border-brand-200 bg-brand-50/30 hover:bg-brand-50 transition-colors">
                        <i className="fi fi-rr-camera text-brand-500 text-base leading-none" />
                        <span className="text-xs font-semibold text-brand-700">Add production photos</span>
                        <span className="text-[10px] text-surface-500">JPG / PNG / WebP · up to 10 at a time · max 10 MB each</span>
                    </button>
                )}
                <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" multiple className="hidden"
                    onChange={(e) => { pick(e.target.files); e.target.value = ''; }} />

                {/* PCD: complete the job */}
                {completeUrl && !data.completed && (
                    data.blocker ? (
                        <div className="rounded-lg bg-surface-50 border border-surface-200 px-3 py-2 text-xs text-surface-600 flex gap-2">
                            <i className="fi fi-rr-info text-xs leading-none mt-0.5 text-surface-400" />
                            <span>{data.blocker}</span>
                        </div>
                    ) : (
                        <div className="space-y-2 border-t border-surface-100 pt-3">
                            <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} maxLength={1000}
                                className="form-textarea text-sm" placeholder="Completion note (optional)" />
                            <button type="button" onClick={complete} disabled={busy || staged.length > 0}
                                title={staged.length > 0 ? 'Upload or remove the picked photos first' : ''}
                                className="btn-sm w-full justify-center inline-flex items-center gap-1.5 rounded-xl font-semibold bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-40">
                                <i className="fi fi-rr-badge-check text-xs leading-none" /> Complete Job
                            </button>
                        </div>
                    )
                )}
            </div>

            <FilePreviewModal open={lightbox !== null} files={previews} initialIndex={lightbox ?? 0} onClose={() => setLightbox(null)} />
        </div>
    );
}
