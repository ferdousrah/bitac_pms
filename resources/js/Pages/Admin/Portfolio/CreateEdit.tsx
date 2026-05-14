import AppLayout from '@/Layouts/AppLayout';
import { Link, router, useForm } from '@inertiajs/react';
import { FormEvent, useState } from 'react';

interface Spec { label: string; value: string }
interface Photo { id: number; url: string; caption: string | null }
interface Project {
    id: number;
    slug: string;
    title: string;
    client_name: string | null;
    category: string | null;
    summary: string | null;
    description: string | null;
    specs: Spec[];
    completed_at: string | null;
    is_published: boolean;
    display_order: number;
    cover_image_url: string | null;
    photos: Photo[];
}

interface Props {
    project: Project | null;
}

export default function PortfolioCreateEdit({ project }: Props) {
    const isEdit = !!project;

    const { data, setData, post, transform, errors, processing } = useForm<any>({
        title:          project?.title ?? '',
        client_name:    project?.client_name ?? '',
        category:       project?.category ?? '',
        summary:        project?.summary ?? '',
        description:    project?.description ?? '',
        specs:          project?.specs?.length ? project.specs : [{ label: '', value: '' }],
        completed_at:   project?.completed_at ?? '',
        is_published:   project?.is_published ?? false,
        display_order:  project?.display_order ?? 0,
        cover_image:    null as File | null,
        remove_cover:   false,
        photos:         [] as File[],
        photo_captions: [] as string[],
    });

    const [coverPreview, setCoverPreview] = useState<string | null>(project?.cover_image_url ?? null);

    const onCoverPicked = (file: File | null) => {
        setData('cover_image', file);
        setData('remove_cover', false);
        if (file) {
            const r = new FileReader();
            r.onload = () => setCoverPreview(r.result as string);
            r.readAsDataURL(file);
        } else {
            setCoverPreview(project?.cover_image_url ?? null);
        }
    };

    const clearCover = () => {
        setData('cover_image', null);
        setData('remove_cover', true);
        setCoverPreview(null);
    };

    const onPhotosPicked = (files: FileList | null) => {
        if (!files) return;
        const arr = Array.from(files);
        setData('photos', [...(data.photos as File[]), ...arr]);
        setData('photo_captions', [...(data.photo_captions as string[]), ...arr.map(() => '')]);
    };

    const removePhotoPick = (idx: number) => {
        const photos = (data.photos as File[]).filter((_, i) => i !== idx);
        const caps = (data.photo_captions as string[]).filter((_, i) => i !== idx);
        setData('photos', photos);
        setData('photo_captions', caps);
    };

    const setPhotoCaption = (idx: number, caption: string) => {
        const next = [...(data.photo_captions as string[])];
        next[idx] = caption;
        setData('photo_captions', next);
    };

    const addSpec = () => setData('specs', [...(data.specs as Spec[]), { label: '', value: '' }]);
    const updateSpec = (i: number, patch: Partial<Spec>) => {
        const next = [...(data.specs as Spec[])];
        next[i] = { ...next[i], ...patch };
        setData('specs', next);
    };
    const removeSpec = (i: number) => {
        const next = (data.specs as Spec[]).filter((_, idx) => idx !== i);
        setData('specs', next.length > 0 ? next : [{ label: '', value: '' }]);
    };

    const deleteExistingPhoto = (photoId: number) => {
        if (!confirm('Remove this photo?')) return;
        router.delete(`/admin/portfolio-photos/${photoId}`, { preserveScroll: true });
    };

    const submit = (e: FormEvent) => {
        e.preventDefault();
        if (isEdit) {
            transform((d: any) => ({ ...d, _method: 'put' }));
            post(`/admin/portfolio/${project!.id}`, { forceFormData: true });
        } else {
            post('/admin/portfolio', { forceFormData: true });
        }
    };

    return (
        <AppLayout header={isEdit ? `Edit — ${project!.title}` : 'New Portfolio Project'}>
            <div className="max-w-4xl space-y-6 animate-fade-in">
                <form onSubmit={submit} className="space-y-6">
                    {/* Basics */}
                    <div className="card">
                        <div className="card-header">
                            <h3 className="text-sm font-bold text-surface-900">Project Details</h3>
                            <p className="text-xs text-surface-400 mt-0.5">Title, client, and a short summary for the public listing card.</p>
                        </div>
                        <div className="card-body space-y-4">
                            <div className="form-group">
                                <label className="form-label">Title <span className="text-red-500">*</span></label>
                                <input
                                    type="text"
                                    value={data.title}
                                    onChange={e => setData('title', e.target.value)}
                                    className="form-input"
                                    placeholder="e.g. Custom Pump Impeller for ACI Motors"
                                    required
                                />
                                {errors.title && <p className="form-error">{errors.title as any}</p>}
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="form-group">
                                    <label className="form-label">Client</label>
                                    <input
                                        type="text"
                                        value={data.client_name}
                                        onChange={e => setData('client_name', e.target.value)}
                                        className="form-input"
                                        placeholder="e.g. Bangladesh Railway"
                                    />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Category</label>
                                    <input
                                        type="text"
                                        value={data.category}
                                        onChange={e => setData('category', e.target.value)}
                                        className="form-input"
                                        placeholder="e.g. Machining, Casting, Heat Treatment"
                                        list="portfolio-categories"
                                    />
                                    <datalist id="portfolio-categories">
                                        <option value="Machining" />
                                        <option value="Casting" />
                                        <option value="Heat Treatment" />
                                        <option value="Welding" />
                                        <option value="Pattern Making" />
                                        <option value="Surface Treatment" />
                                        <option value="Assembly" />
                                    </datalist>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="form-group">
                                    <label className="form-label">Completed On</label>
                                    <input
                                        type="date"
                                        value={data.completed_at}
                                        onChange={e => setData('completed_at', e.target.value)}
                                        className="form-input"
                                    />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Display Order</label>
                                    <input
                                        type="number"
                                        min="0"
                                        value={data.display_order}
                                        onChange={e => setData('display_order', e.target.value)}
                                        className="form-input"
                                        placeholder="0"
                                    />
                                    <p className="form-hint">Lower values appear first on the public listing.</p>
                                </div>
                            </div>

                            <div className="form-group">
                                <label className="form-label">Short Summary</label>
                                <textarea
                                    value={data.summary}
                                    onChange={e => setData('summary', e.target.value)}
                                    rows={2}
                                    maxLength={300}
                                    className="form-textarea"
                                    placeholder="1–2 lines shown on the listing card. Keep it punchy."
                                />
                                <p className="form-hint">{(data.summary || '').length} / 300 characters</p>
                            </div>

                            <div className="form-group">
                                <label className="form-label">Full Description</label>
                                <textarea
                                    value={data.description}
                                    onChange={e => setData('description', e.target.value)}
                                    rows={8}
                                    className="form-textarea"
                                    placeholder="What was made, the challenge, the approach, the outcome…"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Cover image */}
                    <div className="card">
                        <div className="card-header">
                            <h3 className="text-sm font-bold text-surface-900">Cover Image</h3>
                            <p className="text-xs text-surface-400 mt-0.5">Hero image used on listing card + detail page. Recommended 4:3, max 5 MB.</p>
                        </div>
                        <div className="card-body">
                            {coverPreview ? (
                                <div className="flex items-start gap-4 p-3 rounded-xl border border-surface-200 bg-surface-50/60">
                                    <img src={coverPreview} alt="Cover" className="h-32 w-44 object-cover rounded-lg bg-white border border-surface-100" />
                                    <div className="flex flex-col gap-2">
                                        <label className="btn-outline cursor-pointer text-xs self-start">
                                            <i className="fi fi-rr-refresh text-[10px] leading-none" /> Replace
                                            <input type="file" accept="image/*" className="hidden"
                                                   onChange={e => onCoverPicked(e.target.files?.[0] ?? null)} />
                                        </label>
                                        <button type="button" onClick={clearCover}
                                                className="text-xs text-red-600 hover:text-red-700 self-start flex items-center gap-1">
                                            <i className="fi fi-rr-trash text-[10px] leading-none" /> Remove
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <label className="flex items-center justify-center gap-2 p-6 rounded-xl border-2 border-dashed border-surface-200 bg-surface-50/40 hover:border-brand-300 hover:bg-brand-50/30 cursor-pointer">
                                    <i className="fi fi-rr-cloud-upload text-brand-500 text-base leading-none" />
                                    <span className="text-sm text-surface-600">Click to upload cover image</span>
                                    <input type="file" accept="image/*" className="hidden"
                                           onChange={e => onCoverPicked(e.target.files?.[0] ?? null)} />
                                </label>
                            )}
                            {errors.cover_image && <p className="form-error mt-2">{errors.cover_image as any}</p>}
                        </div>
                    </div>

                    {/* Technical Specs */}
                    <div className="card">
                        <div className="card-header flex items-center justify-between">
                            <div>
                                <h3 className="text-sm font-bold text-surface-900">Technical Specs</h3>
                                <p className="text-xs text-surface-400 mt-0.5">Label/value pairs shown in the sidebar of the public detail page.</p>
                            </div>
                            <button type="button" onClick={addSpec} className="text-xs font-semibold text-brand-600 hover:text-brand-700 flex items-center gap-1">
                                <i className="fi fi-rr-plus text-[10px] leading-none" /> Add Spec
                            </button>
                        </div>
                        <div className="card-body space-y-2">
                            {(data.specs as Spec[]).map((spec, i) => (
                                <div key={i} className="grid grid-cols-12 gap-2">
                                    <input
                                        type="text"
                                        value={spec.label}
                                        onChange={e => updateSpec(i, { label: e.target.value })}
                                        className="form-input col-span-4 text-sm"
                                        placeholder="Material"
                                    />
                                    <input
                                        type="text"
                                        value={spec.value}
                                        onChange={e => updateSpec(i, { value: e.target.value })}
                                        className="form-input col-span-7 text-sm"
                                        placeholder="Cast SS304, hardened to HRC 38"
                                    />
                                    <button type="button" onClick={() => removeSpec(i)}
                                            className="col-span-1 btn-icon text-surface-400 hover:text-red-600 hover:bg-red-50">
                                        <i className="fi fi-rr-trash text-sm leading-none" />
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Photo gallery */}
                    <div className="card">
                        <div className="card-header">
                            <h3 className="text-sm font-bold text-surface-900">Photo Gallery</h3>
                            <p className="text-xs text-surface-400 mt-0.5">Multiple work photos. Click an existing photo's trash icon to remove it.</p>
                        </div>
                        <div className="card-body space-y-3">
                            {/* Existing photos in edit mode */}
                            {project && project.photos.length > 0 && (
                                <div>
                                    <div className="text-[11px] uppercase tracking-wider font-bold text-surface-500 mb-2">Existing photos ({project.photos.length})</div>
                                    <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                                        {project.photos.map(p => (
                                            <div key={p.id} className="relative group">
                                                <img src={p.url} alt={p.caption ?? ''} className="aspect-square object-cover rounded-lg bg-surface-100" />
                                                <button
                                                    type="button"
                                                    onClick={() => deleteExistingPhoto(p.id)}
                                                    className="absolute top-1 right-1 w-7 h-7 rounded-full bg-red-500 text-white opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
                                                    aria-label="Remove"
                                                >
                                                    <i className="fi fi-rr-trash text-xs leading-none" />
                                                </button>
                                                {p.caption && (
                                                    <div className="text-[10px] text-surface-500 mt-1 truncate">{p.caption}</div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* New uploads */}
                            <label className="flex items-center justify-center gap-2 p-4 rounded-xl border-2 border-dashed border-surface-200 bg-surface-50/40 hover:border-brand-300 hover:bg-brand-50/30 cursor-pointer">
                                <i className="fi fi-rr-cloud-upload text-brand-500 text-base leading-none" />
                                <span className="text-sm text-surface-600">Add more photos</span>
                                <input type="file" accept="image/*" multiple className="hidden"
                                       onChange={e => { onPhotosPicked(e.target.files); e.currentTarget.value = ''; }} />
                            </label>

                            {(data.photos as File[]).length > 0 && (
                                <div className="space-y-2">
                                    <div className="text-[11px] uppercase tracking-wider font-bold text-surface-500">New uploads ({(data.photos as File[]).length})</div>
                                    {(data.photos as File[]).map((f, i) => (
                                        <div key={i} className="flex items-center gap-2 p-2 bg-white rounded-lg border border-surface-100">
                                            <div className="w-9 h-9 rounded-lg bg-brand-50 text-brand-700 text-[10px] font-bold flex items-center justify-center shrink-0">IMG</div>
                                            <div className="flex-1 min-w-0">
                                                <div className="text-xs font-semibold truncate">{f.name}</div>
                                                <input
                                                    type="text"
                                                    value={(data.photo_captions as string[])[i] ?? ''}
                                                    onChange={e => setPhotoCaption(i, e.target.value)}
                                                    placeholder="Caption (optional)"
                                                    className="form-input form-input-sm mt-1 text-xs"
                                                />
                                            </div>
                                            <button type="button" onClick={() => removePhotoPick(i)}
                                                    className="btn-icon text-surface-400 hover:text-red-600 hover:bg-red-50">
                                                <i className="fi fi-rr-trash text-xs leading-none" />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Publish toggle + submit */}
                    <div className="card">
                        <div className="card-body flex items-center justify-between gap-3 flex-wrap">
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={data.is_published}
                                    onChange={e => setData('is_published', e.target.checked)}
                                    className="w-4 h-4 rounded border-surface-300 text-brand-600 focus:ring-brand-500"
                                />
                                <div>
                                    <div className="text-sm font-semibold text-surface-900">Publish on public portfolio</div>
                                    <div className="text-[11px] text-surface-500">When checked, this project appears at /portfolio for anyone visiting.</div>
                                </div>
                            </label>
                            <div className="flex items-center gap-2">
                                <Link href="/admin/portfolio" className="btn-ghost">Cancel</Link>
                                <button type="submit" disabled={processing} className="btn-primary">
                                    <i className="fi fi-rr-disk text-xs leading-none" />
                                    {processing ? 'Saving…' : isEdit ? 'Save Changes' : 'Create Project'}
                                </button>
                            </div>
                        </div>
                    </div>
                </form>
            </div>
        </AppLayout>
    );
}
