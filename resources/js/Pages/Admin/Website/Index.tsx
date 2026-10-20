import AppLayout from '@/Layouts/AppLayout';
import { Head, Link, router, useForm } from '@inertiajs/react';
import { FormEvent, useState } from 'react';

/**
 * Admin → Website.
 *
 * One screen, five tabs, because each of these is a short list that somebody
 * edits once in a while — five sidebar entries for them would bury the rest of
 * the menu. Products, clients and the address are NOT here: they are kept in
 * Portfolio, Customers and Centres, and the site reads them from there.
 */

interface NewsRow {
    id: number; title: string; slug: string; kind: string; excerpt: string | null;
    cover_url: string | null; event_date: string | null; location: string | null;
    published_at: string | null; is_published: boolean;
}
interface GalleryRow {
    id: number; kind: string; title: string | null; caption: string | null; album: string | null;
    image_url: string | null; video_url: string | null; thumb_url: string | null;
    taken_on: string | null; sort: number; is_active: boolean;
}
interface LinkRow {
    id: number; label: string; url: string; group: string; sort: number; is_active: boolean;
}
interface ServiceRow {
    id: number; title: string; summary: string | null; body: string | null;
    icon: string | null; image_url: string | null; sort: number; is_active: boolean;
}
interface IconRow { key: string; class: string }
interface PartnerRow {
    id: number; name: string; kind: string; logo_url: string | null;
    url: string | null; note: string | null; sort: number; is_active: boolean; has_logo: boolean;
}
interface KindRow { key: string; label: string }
interface OfficeContactRow {
    id: number; name: string | null; designation: string; phone: string | null;
    mobile: string | null; email: string | null; sort: number; is_active: boolean;
}
interface OfficeRow {
    id: number; slug: string; name: string; center_id: number | null; center_name: string | null;
    address: string | null; phone: string | null; fax: string | null; email: string | null;
    shown_address: string | null; shown_phone: string | null; shown_email: string | null;
    map_query: string | null; latitude: number | null; longitude: number | null; map_link: string;
    is_head_office: boolean; sort: number; is_active: boolean; contacts: OfficeContactRow[];
}
interface CenterOpt { id: number; name: string }
interface HeroRow {
    id: number; kind: 'image' | 'video' | 'youtube';
    image_url: string | null; video_src: string | null; poster_url: string | null;
    embed_url: string | null; video_url: string | null; hold_seconds: number | null;
    title: string | null; subtitle: string | null;
    cta_label: string | null; cta_url: string | null;
    credit: string | null; credit_url: string | null;
    sort: number; is_active: boolean; has_media: boolean;
}

interface Props {
    tab: string;
    hero: HeroRow[];
    text: Record<string, string>;
    services: ServiceRow[];
    partners: PartnerRow[];
    offices: OfficeRow[];
    office_centers: CenterOpt[];
    news: NewsRow[];
    gallery: GalleryRow[];
    videos: GalleryRow[];
    links: LinkRow[];
    albums: string[];
    kinds: string[];
    groups: string[];
    icons: IconRow[];
    partner_kinds: KindRow[];
}

const TABS = [
    { key: 'hero',     label: 'Hero slider',   icon: 'fi-rr-play-alt' },
    { key: 'text',     label: 'Site text',     icon: 'fi-rr-text' },
    { key: 'services', label: 'Services',      icon: 'fi-rr-tools' },
    { key: 'partners', label: 'Partners',      icon: 'fi-rr-handshake' },
    { key: 'offices',  label: 'Offices',       icon: 'fi-rr-marker' },
    { key: 'news',     label: 'News & Events', icon: 'fi-rr-newspaper' },
    { key: 'gallery', label: 'Photos',       icon: 'fi-rr-picture' },
    { key: 'videos',  label: 'Videos',       icon: 'fi-rr-play' },
    { key: 'links',   label: 'Links',        icon: 'fi-rr-link' },
] as const;

const KIND_TONE: Record<string, string> = {
    news:   'bg-sky-50 text-sky-700 border-sky-200',
    event:  'bg-violet-50 text-violet-700 border-violet-200',
    notice: 'bg-amber-50 text-amber-800 border-amber-200',
    tender: 'bg-emerald-50 text-emerald-700 border-emerald-200',
};

const GROUP_LABEL: Record<string, string> = {
    important: 'Important links',
    ministry:  'Ministry & Government',
    service:   'Services',
};

export default function WebsiteIndex({ tab, hero, text, services, partners, offices, office_centers, news, gallery, videos, links, albums, kinds, groups, icons, partner_kinds }: Props) {
    const [active, setActive] = useState(tab);

    const go = (key: string) => {
        setActive(key);
        // Keep the tab in the URL so a save redirecting back lands where the
        // editor was, rather than on the first tab.
        window.history.replaceState({}, '', `/admin/website?tab=${key}`);
    };

    return (
        <AppLayout>
            <Head title="Website" />

            <div className="animate-fade-in">
                <div className="flex flex-wrap items-end justify-between gap-4 mb-6">
                    <div>
                        <h1 className="text-xl font-bold text-surface-900">Website</h1>
                        <p className="text-sm text-surface-500 mt-1">
                            The public site at <a href="/portfolio" target="_blank" rel="noreferrer"
                               className="text-brand-600 hover:text-brand-700 font-medium">/portfolio</a>.
                            Products come from Portfolio, clients from Customers and the address from Centres.
                        </p>
                    </div>
                    <a href="/portfolio" target="_blank" rel="noreferrer" className="btn-outline">
                        <i className="fi fi-rr-arrow-up-right-from-square text-xs mr-1.5" />
                        View site
                    </a>
                </div>

                <div className="flex items-center gap-1 p-1 bg-surface-100 rounded-xl mb-6 overflow-x-auto">
                    {TABS.map((t) => (
                        <button
                            key={t.key}
                            type="button"
                            onClick={() => go(t.key)}
                            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold whitespace-nowrap transition-colors ${
                                active === t.key
                                    ? 'bg-white text-surface-900 shadow-sm'
                                    : 'text-surface-500 hover:text-surface-700'
                            }`}
                        >
                            <i className={`fi ${t.icon} text-xs leading-none`} />
                            {t.label}
                            {t.key === 'hero' && hero.length > 0 && <Count n={hero.length} on={active === t.key} />}
                            {t.key === 'services' && services.length > 0 && <Count n={services.length} on={active === t.key} />}
                            {t.key === 'partners' && partners.length > 0 && <Count n={partners.length} on={active === t.key} />}
                            {t.key === 'offices' && offices.length > 0 && <Count n={offices.length} on={active === t.key} />}
                            {t.key === 'news' && news.length > 0 && <Count n={news.length} on={active === t.key} />}
                            {t.key === 'gallery' && gallery.length > 0 && <Count n={gallery.length} on={active === t.key} />}
                            {t.key === 'videos' && videos.length > 0 && <Count n={videos.length} on={active === t.key} />}
                            {t.key === 'links' && links.length > 0 && <Count n={links.length} on={active === t.key} />}
                        </button>
                    ))}
                </div>

                {active === 'hero' && <HeroTab slides={hero} />}
                {active === 'text' && <TextTab text={text} />}
                {active === 'partners' && <PartnersTab partners={partners} kinds={partner_kinds} />}
                {active === 'offices' && <OfficesTab offices={offices} centers={office_centers} />}
                {active === 'services' && <ServicesTab services={services} icons={icons} />}
                {active === 'news' && <NewsTab news={news} />}
                {active === 'gallery' && <MediaTab kind="photo" rows={gallery} albums={albums} />}
                {active === 'videos' && <MediaTab kind="video" rows={videos} albums={albums} />}
                {active === 'links' && <LinksTab links={links} groups={groups} />}
            </div>
        </AppLayout>
    );
}

function Count({ n, on }: { n: number; on: boolean }) {
    return (
        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded tabular-nums ${
            on ? 'bg-surface-100 text-surface-600' : 'bg-surface-200 text-surface-600'
        }`}>{n}</span>
    );
}

// ── Site text ────────────────────────────────────────────────────────────

function TextTab({ text }: { text: Record<string, string> }) {
    const form = useForm<any>({ ...text });

    const submit = (e: FormEvent) => {
        e.preventDefault();
        form.put('/admin/website/text', { preserveScroll: true });
    };

    return (
        <form onSubmit={submit} className="max-w-3xl space-y-6">
            <div className="card">
                <div className="card-header">
                    <h2 className="font-semibold text-surface-800">Home page</h2>
                    <p className="text-xs text-surface-500 mt-0.5">The headline a first-time visitor reads.</p>
                </div>
                <div className="card-body space-y-5">
                    <Field label="Headline" error={form.errors.site_hero_title}>
                        <input className="form-input" value={form.data.site_hero_title}
                               onChange={(e) => form.setData('site_hero_title', e.target.value)} />
                    </Field>
                    <Field label="Sub-headline" error={form.errors.site_hero_subtitle}>
                        <textarea className="form-textarea" rows={3} value={form.data.site_hero_subtitle}
                                  onChange={(e) => form.setData('site_hero_subtitle', e.target.value)} />
                    </Field>
                </div>
            </div>

            <div className="card">
                <div className="card-header">
                    <h2 className="font-semibold text-surface-800">About BITAC</h2>
                </div>
                <div className="card-body space-y-5">
                    <Field label="Opening paragraph" error={form.errors.site_about_lead}>
                        <textarea className="form-textarea" rows={3} value={form.data.site_about_lead}
                                  onChange={(e) => form.setData('site_about_lead', e.target.value)} />
                    </Field>
                    <Field label="Full text" hint="Plain text — line breaks are kept." error={form.errors.site_about_body}>
                        <textarea className="form-textarea" rows={10} value={form.data.site_about_body}
                                  onChange={(e) => form.setData('site_about_body', e.target.value)} />
                    </Field>
                    <Field label="Mission" error={form.errors.site_mission}>
                        <textarea className="form-textarea" rows={3} value={form.data.site_mission}
                                  onChange={(e) => form.setData('site_mission', e.target.value)} />
                    </Field>
                </div>
            </div>

            <div className="alert alert-info text-xs">
                Maps and addresses for the Contact page are set per office, under the <strong>Offices</strong> tab.
            </div>

            <div className="flex justify-end">
                <button type="submit" className="btn-primary" disabled={form.processing}>
                    {form.processing ? 'Saving…' : 'Save text'}
                </button>
            </div>
        </form>
    );
}

function Field({ label, hint, error, children }: {
    label: string; hint?: string; error?: string; children: React.ReactNode;
}) {
    return (
        <div className="form-group">
            <label className="form-label">{label}</label>
            {children}
            {hint && <div className="text-[11px] text-surface-400 mt-1">{hint}</div>}
            {error && <div className="form-error">{error}</div>}
        </div>
    );
}

// ── Hero slider ──────────────────────────────────────────────────────────

function HeroTab({ slides }: { slides: HeroRow[] }) {
    const [editing, setEditing] = useState<HeroRow | null>(null);

    const add = useForm<any>({
        kind: 'image', title: '', subtitle: '', cta_label: '', cta_url: '', sort: 0,
        image: null as File | null, video: null as File | null,
        poster: null as File | null, video_url: '', hold_seconds: '', is_active: true,
        credit: '', credit_url: '',
    });

    const submit = (e: FormEvent) => {
        e.preventDefault();
        add.post('/admin/website/hero', {
            forceFormData: true,
            preserveScroll: true,
            onSuccess: () => add.reset('title', 'subtitle', 'cta_label', 'cta_url', 'image', 'video', 'poster', 'video_url', 'hold_seconds', 'credit', 'credit_url'),
        });
    };

    const remove = (x: HeroRow) => {
        if (confirm('Remove this slide? This cannot be undone.')) {
            router.delete(`/admin/website/hero/${x.id}`, { preserveScroll: true });
        }
    };

    const isVideo = add.data.kind === 'video';
    const isYouTube = add.data.kind === 'youtube';

    return (
        <div className="grid lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 card">
                <div className="card-header">
                    <h2 className="font-semibold text-surface-800">Home page slides</h2>
                    <p className="text-xs text-surface-500 mt-0.5">
                        {slides.length} slide{slides.length === 1 ? '' : 's'} · they play in this order, lowest first
                    </p>
                </div>
                {slides.length === 0 ? (
                    <div className="card-body text-center py-14">
                        <i className="fi fi-rr-play-alt text-3xl text-surface-300" />
                        <div className="text-sm font-bold text-surface-700 mt-3">No slides yet</div>
                        <div className="text-xs text-surface-500 mt-1 max-w-md mx-auto">
                            Until there is one, the home page shows its plain gradient banner — nothing
                            looks broken. Add a photograph or a short clip and it becomes the slider.
                        </div>
                    </div>
                ) : (
                    <div className="card-body space-y-3">
                        {slides.map((x, i) => (
                            <div key={x.id}
                                 className={`flex gap-4 p-3 rounded-xl border ${x.is_active ? 'border-surface-200' : 'border-surface-200 bg-surface-50/70'}`}>
                                <span className="text-xs text-surface-400 tabular-nums w-5 pt-6">{i + 1}</span>
                                <div className="w-32 h-20 rounded-lg overflow-hidden bg-surface-900 shrink-0 relative">
                                    {x.kind === 'youtube' ? (
                                        x.poster_url ? (
                                            <img src={x.poster_url} alt="" className="w-full h-full object-cover" />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center">
                                                <i className="fi fi-brands-youtube text-xl text-red-500" />
                                            </div>
                                        )
                                    ) : x.kind === 'video' && x.video_src ? (
                                        <video src={x.video_src} poster={x.poster_url ?? undefined}
                                               muted playsInline className="w-full h-full object-cover" />
                                    ) : x.image_url ? (
                                        <img src={x.image_url} alt="" className="w-full h-full object-cover" />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center">
                                            <i className="fi fi-rr-picture text-surface-500" />
                                        </div>
                                    )}
                                    <span className="absolute bottom-1 left-1 text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-black/60 text-white">
                                        {x.kind}
                                    </span>
                                </div>
                                <div className="min-w-0 grow">
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <span className="text-sm font-bold text-surface-900">
                                            {x.title || <span className="text-surface-400 font-normal">(uses the site headline)</span>}
                                        </span>
                                        {!x.is_active && <span className="badge-slate">Hidden</span>}
                                        {!x.has_media && <span className="badge-amber">No media</span>}
                                        <span className="text-[11px] text-surface-400 tabular-nums">#{x.sort}</span>
                                    </div>
                                    {x.subtitle && (
                                        <p className="text-xs text-surface-600 mt-1 leading-relaxed line-clamp-2">{x.subtitle}</p>
                                    )}
                                    {x.cta_label && (
                                        <div className="text-[11px] text-brand-700 mt-1.5">
                                            <i className="fi fi-rr-link text-[9px] mr-1" />{x.cta_label} → {x.cta_url}
                                        </div>
                                    )}
                                    {x.credit && (
                                        <div className="text-[11px] text-surface-400 mt-1 truncate">
                                            <i className="fi fi-rr-copyright text-[9px] mr-1" />{x.credit}
                                        </div>
                                    )}
                                </div>
                                <div className="flex items-start gap-1 shrink-0">
                                    <button type="button" onClick={() => setEditing(x)} title="Edit"
                                            className="w-8 h-8 rounded-lg hover:bg-surface-100 text-surface-500 flex items-center justify-center">
                                        <i className="fi fi-rr-pencil text-xs" />
                                    </button>
                                    <button type="button" onClick={() => remove(x)} title="Remove"
                                            className="w-8 h-8 rounded-lg hover:bg-red-50 text-surface-400 hover:text-red-600 flex items-center justify-center">
                                        <i className="fi fi-rr-trash text-xs" />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            <form onSubmit={submit} className="card self-start">
                <div className="card-header"><h2 className="font-semibold text-surface-800">Add a slide</h2></div>
                <div className="card-body space-y-4">
                    <div className="grid grid-cols-3 gap-2">
                        {([['image', 'fi-rr-picture', 'Image'],
                           ['video', 'fi-rr-play', 'Video file'],
                           ['youtube', 'fi-rr-play-alt', 'YouTube']] as const).map(([k, ic, label]) => (
                            <button
                                key={k}
                                type="button"
                                onClick={() => add.setData('kind', k)}
                                className={`py-2.5 rounded-lg text-xs font-semibold border transition-colors ${
                                    add.data.kind === k
                                        ? 'border-brand-400 bg-brand-50 text-brand-700'
                                        : 'border-surface-200 text-surface-500 hover:bg-surface-50'
                                }`}
                            >
                                <i className={`fi ${ic} text-xs mr-1`} />
                                {label}
                            </button>
                        ))}
                    </div>

                    {isYouTube ? (
                        <>
                            <Field label="YouTube link *"
                                   hint="The address of the video page. It plays muted, on a loop, with no controls."
                                   error={add.errors.video_url}>
                                <input className="form-input" value={add.data.video_url}
                                       onChange={(e) => add.setData('video_url', e.target.value)}
                                       placeholder="https://www.youtube.com/watch?v=…" />
                            </Field>
                            <div className="alert alert-info text-[11px] leading-relaxed">
                                YouTube always draws its own watermark and title over the picture, and no
                                setting turns that off. The slide is zoomed slightly and cropped so they
                                fall outside the frame, which works — but a video file uploaded here is the
                                only way to be certain nothing of theirs ever shows.
                            </div>
                            <Field label="Poster image"
                                   hint="Shown for the moment before YouTube starts playing."
                                   error={add.errors.poster}>
                                <input type="file" accept="image/*" className="text-sm"
                                       onChange={(e) => add.setData('poster', e.target.files?.[0] ?? null)} />
                            </Field>
                        </>
                    ) : isVideo ? (
                        <>
                            <Field label="Video file"
                                   hint="An .mp4 or .webm, up to 64 MB. Keep it short and compressed — every visitor downloads it."
                                   error={add.errors.video}>
                                <input type="file" accept="video/mp4,video/webm" className="text-sm"
                                       onChange={(e) => add.setData('video', e.target.files?.[0] ?? null)} />
                            </Field>
                            <Field label="…or a direct video link"
                                   hint="A direct .mp4 address. Not a YouTube page — a background video has to play muted with no controls, which a YouTube player will not do."
                                   error={add.errors.video_url}>
                                <input className="form-input" value={add.data.video_url}
                                       onChange={(e) => add.setData('video_url', e.target.value)}
                                       placeholder="https://…/clip.mp4" />
                            </Field>
                            <Field label="Poster image"
                                   hint="Shown while the video loads, and on phones that refuse to autoplay."
                                   error={add.errors.poster}>
                                <input type="file" accept="image/*" className="text-sm"
                                       onChange={(e) => add.setData('poster', e.target.files?.[0] ?? null)} />
                            </Field>
                        </>
                    ) : (
                        <Field label="Image *" hint="Landscape, at least 1600px wide. Up to 8 MB."
                               error={add.errors.image}>
                            <input type="file" accept="image/*" className="text-sm"
                                   onChange={(e) => add.setData('image', e.target.files?.[0] ?? null)} />
                        </Field>
                    )}

                    <Field label="Headline" hint="Leave blank to use the site headline from Site text."
                           error={add.errors.title}>
                        <input className="form-input" value={add.data.title}
                               onChange={(e) => add.setData('title', e.target.value)} />
                    </Field>
                    <Field label="Sub-headline" error={add.errors.subtitle}>
                        <textarea className="form-textarea" rows={3} value={add.data.subtitle}
                                  onChange={(e) => add.setData('subtitle', e.target.value)} />
                    </Field>
                    <div className="grid grid-cols-2 gap-3">
                        <Field label="Button text" error={add.errors.cta_label}>
                            <input className="form-input" value={add.data.cta_label}
                                   onChange={(e) => add.setData('cta_label', e.target.value)} placeholder="Our Services" />
                        </Field>
                        <Field label="Button link" error={add.errors.cta_url}>
                            <input className="form-input" value={add.data.cta_url}
                                   onChange={(e) => add.setData('cta_url', e.target.value)} placeholder="/portfolio/services" />
                        </Field>
                    </div>
                    <Field label="Credit"
                           hint="Required by most free-licence photos and videos (CC BY / CC BY-SA). Leave blank for BITAC's own pictures."
                           error={add.errors.credit}>
                        <input className="form-input" value={add.data.credit}
                               onChange={(e) => add.setData('credit', e.target.value)}
                               placeholder="Photo: Name · CC BY-SA 4.0" />
                    </Field>
                    <Field label="Credit link" hint="The source page, e.g. the Wikimedia Commons file page." error={add.errors.credit_url}>
                        <input className="form-input" value={add.data.credit_url}
                               onChange={(e) => add.setData('credit_url', e.target.value)} placeholder="https://commons.wikimedia.org/wiki/File:…" />
                    </Field>
                    <div className="grid grid-cols-2 gap-3">
                        <Field label="Order" error={add.errors.sort}>
                            <input type="number" min={0} className="form-input" value={add.data.sort}
                                   onChange={(e) => add.setData('sort', Number(e.target.value))} />
                        </Field>
                        {!isVideo && (
                            <Field label="Hold (seconds)"
                                   hint={isYouTube ? 'Blank = 30s. A YouTube slide cannot tell the page it has ended.' : 'Blank = 8s.'}
                                   error={add.errors.hold_seconds}>
                                <input type="number" min={2} max={600} className="form-input" value={add.data.hold_seconds}
                                       onChange={(e) => add.setData('hold_seconds', e.target.value)} />
                            </Field>
                        )}
                    </div>
                    <button type="submit" className="btn-primary w-full" disabled={add.processing}>
                        {add.processing ? 'Uploading…' : 'Add slide'}
                    </button>
                    {add.progress && (
                        <div className="h-1.5 rounded-full bg-surface-200 overflow-hidden">
                            <div className="h-full bg-brand-500 transition-all"
                                 style={{ width: `${add.progress.percentage ?? 0}%` }} />
                        </div>
                    )}
                </div>
            </form>

            {editing && <HeroEditModal slide={editing} onClose={() => setEditing(null)} />}
        </div>
    );
}

function HeroEditModal({ slide, onClose }: { slide: HeroRow; onClose: () => void }) {
    const form = useForm<any>({
        kind: slide.kind,
        title: slide.title ?? '', subtitle: slide.subtitle ?? '',
        cta_label: slide.cta_label ?? '', cta_url: slide.cta_url ?? '',
        sort: slide.sort, is_active: slide.is_active,
        // ⚠️ Seeded with what is stored, not blank: the save writes `video_url`
        // whenever the key is present, so an empty box would wipe the link.
        video_url: slide.video_url ?? '',
        hold_seconds: slide.hold_seconds ?? '',
        credit: slide.credit ?? '', credit_url: slide.credit_url ?? '',
        image: null as File | null, video: null as File | null, poster: null as File | null,
    });

    const submit = (e: FormEvent) => {
        e.preventDefault();
        // A file upload with PUT needs Laravel's method spoofing.
        form.transform((d: any) => ({ ...d, _method: 'put' }));
        form.post(`/admin/website/hero/${slide.id}`, {
            forceFormData: true, preserveScroll: true, onSuccess: onClose,
        });
    };

    return (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={onClose}>
            <form onClick={(e) => e.stopPropagation()} onSubmit={submit}
                  className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
                <div className="px-5 py-4 border-b border-surface-200 flex items-center justify-between">
                    <h3 className="font-semibold text-surface-900">Edit slide</h3>
                    <button type="button" onClick={onClose}
                            className="w-8 h-8 rounded-lg hover:bg-surface-100 text-surface-400 flex items-center justify-center">
                        <i className="fi fi-rr-cross-small text-lg" />
                    </button>
                </div>
                <div className="p-5 space-y-4">
                    <div className="rounded-xl overflow-hidden bg-surface-900 aspect-video">
                        {slide.kind === 'youtube' && slide.embed_url ? (
                            <iframe src={slide.embed_url} title="" className="w-full h-full border-0"
                                    allow="autoplay; encrypted-media" />
                        ) : slide.kind === 'video' && slide.video_src ? (
                            <video src={slide.video_src} poster={slide.poster_url ?? undefined}
                                   controls muted playsInline className="w-full h-full object-cover" />
                        ) : slide.image_url ? (
                            <img src={slide.image_url} alt="" className="w-full h-full object-cover" />
                        ) : null}
                    </div>
                    {slide.kind === 'youtube' ? (
                        <>
                            <Field label="YouTube link" error={form.errors.video_url}>
                                <input className="form-input" value={form.data.video_url}
                                       onChange={(e) => form.setData('video_url', e.target.value)} />
                            </Field>
                            <Field label="Replace the poster" error={form.errors.poster}>
                                <input type="file" accept="image/*" className="text-sm"
                                       onChange={(e) => form.setData('poster', e.target.files?.[0] ?? null)} />
                            </Field>
                        </>
                    ) : slide.kind === 'video' ? (
                        <>
                            <Field label="Replace the video" hint="Leave empty to keep the current one."
                                   error={form.errors.video}>
                                <input type="file" accept="video/mp4,video/webm" className="text-sm"
                                       onChange={(e) => form.setData('video', e.target.files?.[0] ?? null)} />
                            </Field>
                            <Field label="Replace the poster" error={form.errors.poster}>
                                <input type="file" accept="image/*" className="text-sm"
                                       onChange={(e) => form.setData('poster', e.target.files?.[0] ?? null)} />
                            </Field>
                        </>
                    ) : (
                        <Field label="Replace the image" hint="Leave empty to keep the current one."
                               error={form.errors.image}>
                            <input type="file" accept="image/*" className="text-sm"
                                   onChange={(e) => form.setData('image', e.target.files?.[0] ?? null)} />
                        </Field>
                    )}
                    <Field label="Headline" error={form.errors.title}>
                        <input className="form-input" value={form.data.title}
                               onChange={(e) => form.setData('title', e.target.value)} />
                    </Field>
                    <Field label="Sub-headline" error={form.errors.subtitle}>
                        <textarea className="form-textarea" rows={3} value={form.data.subtitle}
                                  onChange={(e) => form.setData('subtitle', e.target.value)} />
                    </Field>
                    <div className="grid grid-cols-2 gap-3">
                        <Field label="Button text" error={form.errors.cta_label}>
                            <input className="form-input" value={form.data.cta_label}
                                   onChange={(e) => form.setData('cta_label', e.target.value)} />
                        </Field>
                        <Field label="Button link" error={form.errors.cta_url}>
                            <input className="form-input" value={form.data.cta_url}
                                   onChange={(e) => form.setData('cta_url', e.target.value)} />
                        </Field>
                    </div>
                    <Field label="Credit" hint="Blank for BITAC's own pictures." error={form.errors.credit}>
                        <input className="form-input" value={form.data.credit}
                               onChange={(e) => form.setData('credit', e.target.value)} />
                    </Field>
                    <Field label="Credit link" error={form.errors.credit_url}>
                        <input className="form-input" value={form.data.credit_url}
                               onChange={(e) => form.setData('credit_url', e.target.value)} />
                    </Field>
                    <div className="grid grid-cols-2 gap-3">
                        <Field label="Order" error={form.errors.sort}>
                            <input type="number" min={0} className="form-input" value={form.data.sort}
                                   onChange={(e) => form.setData('sort', Number(e.target.value))} />
                        </Field>
                        {slide.kind !== 'video' && (
                            <Field label="Hold (seconds)" error={form.errors.hold_seconds}>
                                <input type="number" min={2} max={600} className="form-input" value={form.data.hold_seconds}
                                       onChange={(e) => form.setData('hold_seconds', e.target.value)} />
                            </Field>
                        )}
                    </div>
                    <label className="flex items-center gap-3 cursor-pointer">
                        <input type="checkbox" checked={form.data.is_active}
                               onChange={(e) => form.setData('is_active', e.target.checked)}
                               className="rounded border-surface-300 text-brand-500 focus:ring-brand-400" />
                        <span className="text-sm text-surface-700">Show in the slider</span>
                    </label>
                </div>
                <div className="px-5 py-4 border-t border-surface-200 flex justify-end gap-3">
                    <button type="button" onClick={onClose} className="btn-ghost">Cancel</button>
                    <button type="submit" className="btn-primary" disabled={form.processing}>
                        {form.processing ? 'Saving…' : 'Save'}
                    </button>
                </div>
            </form>
        </div>
    );
}

// ── Services ─────────────────────────────────────────────────────────────

function ServicesTab({ services, icons }: { services: ServiceRow[]; icons: IconRow[] }) {
    const [editing, setEditing] = useState<ServiceRow | null>(null);

    const add = useForm<any>({
        title: '', summary: '', body: '', icon: icons[0]?.key ?? '', sort: 0,
        image: null as File | null, is_active: true,
    });

    const submitAdd = (e: FormEvent) => {
        e.preventDefault();
        add.post('/admin/website/services', {
            forceFormData: true,
            preserveScroll: true,
            onSuccess: () => add.reset('title', 'summary', 'body', 'image'),
        });
    };

    const remove = (x: ServiceRow) => {
        if (confirm(`Remove "${x.title}"? This cannot be undone.`)) {
            router.delete(`/admin/website/services/${x.id}`, { preserveScroll: true });
        }
    };

    const iconClass = (key: string | null) =>
        icons.find((i) => i.key === key)?.class ?? 'fi-rr-settings';

    return (
        <div className="grid lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 card">
                <div className="card-header">
                    <h2 className="font-semibold text-surface-800">Service lines</h2>
                    <p className="text-xs text-surface-500 mt-0.5">
                        {services.length} service{services.length === 1 ? '' : 's'} ·
                        shown on the Services page and the home page, lowest order first
                    </p>
                </div>
                {services.length === 0 ? (
                    <div className="card-body text-center py-14 text-sm text-surface-500">
                        No services yet. The Services page shows an empty state until there is one.
                    </div>
                ) : (
                    <div className="card-body space-y-3">
                        {services.map((x, i) => (
                            <div key={x.id}
                                 className={`flex gap-4 p-4 rounded-xl border ${x.is_active ? 'border-surface-200' : 'border-surface-200 bg-surface-50/70'}`}>
                                <span className="text-xs text-surface-400 tabular-nums w-5 pt-1">{i + 1}</span>
                                <span className="w-10 h-10 rounded-xl bg-brand-50 text-brand-600 flex items-center justify-center shrink-0">
                                    <i className={`fi ${iconClass(x.icon)} text-sm leading-none`} />
                                </span>
                                <div className="min-w-0 grow">
                                    <div className="flex items-center gap-2">
                                        <span className="text-sm font-bold text-surface-900">{x.title}</span>
                                        {!x.is_active && <span className="badge-slate">Hidden</span>}
                                        <span className="text-[11px] text-surface-400 tabular-nums">#{x.sort}</span>
                                    </div>
                                    {x.summary && (
                                        <p className="text-xs text-surface-600 mt-1 leading-relaxed line-clamp-2">{x.summary}</p>
                                    )}
                                </div>
                                {x.image_url && (
                                    <img src={x.image_url} alt="" className="w-16 h-12 rounded-lg object-cover shrink-0" />
                                )}
                                <div className="flex items-start gap-1 shrink-0">
                                    <button type="button" onClick={() => setEditing(x)} title="Edit"
                                            className="w-8 h-8 rounded-lg hover:bg-surface-100 text-surface-500 flex items-center justify-center">
                                        <i className="fi fi-rr-pencil text-xs" />
                                    </button>
                                    <button type="button" onClick={() => remove(x)} title="Remove"
                                            className="w-8 h-8 rounded-lg hover:bg-red-50 text-surface-400 hover:text-red-600 flex items-center justify-center">
                                        <i className="fi fi-rr-trash text-xs" />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            <form onSubmit={submitAdd} className="card self-start">
                <div className="card-header"><h2 className="font-semibold text-surface-800">Add a service</h2></div>
                <div className="card-body space-y-4">
                    <Field label="Title *" error={add.errors.title}>
                        <input className="form-input" value={add.data.title}
                               onChange={(e) => add.setData('title', e.target.value)} />
                    </Field>
                    <Field label="Short summary" hint="The paragraph under the title." error={add.errors.summary}>
                        <textarea className="form-textarea" rows={3} value={add.data.summary}
                                  onChange={(e) => add.setData('summary', e.target.value)} />
                    </Field>
                    <Field label="Full text" hint="Optional. Plain text — line breaks are kept." error={add.errors.body}>
                        <textarea className="form-textarea" rows={4} value={add.data.body}
                                  onChange={(e) => add.setData('body', e.target.value)} />
                    </Field>
                    <IconPicker icons={icons} value={add.data.icon} onChange={(k) => add.setData('icon', k)}
                                error={add.errors.icon} />
                    <Field label="Image" hint="Optional. Up to 8 MB." error={add.errors.image}>
                        <input type="file" accept="image/*" className="text-sm"
                               onChange={(e) => add.setData('image', e.target.files?.[0] ?? null)} />
                    </Field>
                    <Field label="Order" error={add.errors.sort}>
                        <input type="number" min={0} className="form-input" value={add.data.sort}
                               onChange={(e) => add.setData('sort', Number(e.target.value))} />
                    </Field>
                    <button type="submit" className="btn-primary w-full" disabled={add.processing}>
                        {add.processing ? 'Saving…' : 'Add service'}
                    </button>
                </div>
            </form>

            {editing && <ServiceEditModal service={editing} icons={icons} onClose={() => setEditing(null)} />}
        </div>
    );
}

/**
 * The icon is picked, never typed.
 *
 * ⚠️ A mistyped Flaticon class renders nothing at all — no icon, no error — so
 * the list is fixed and the server validates against the same one.
 */
function IconPicker({ icons, value, onChange, error }: {
    icons: IconRow[]; value: string; onChange: (key: string) => void; error?: string;
}) {
    return (
        <div className="form-group">
            <label className="form-label">Icon</label>
            <div className="grid grid-cols-6 gap-2">
                {icons.map((ic) => (
                    <button
                        key={ic.key}
                        type="button"
                        onClick={() => onChange(ic.key)}
                        title={ic.key}
                        aria-label={ic.key}
                        className={`h-10 rounded-lg border flex items-center justify-center transition-colors ${
                            value === ic.key
                                ? 'border-brand-400 bg-brand-50 text-brand-700'
                                : 'border-surface-200 text-surface-500 hover:bg-surface-50'
                        }`}
                    >
                        <i className={`fi ${ic.class} text-sm leading-none`} />
                    </button>
                ))}
            </div>
            {error && <div className="form-error">{error}</div>}
        </div>
    );
}

function ServiceEditModal({ service, icons, onClose }: {
    service: ServiceRow; icons: IconRow[]; onClose: () => void;
}) {
    const form = useForm<any>({
        title: service.title, summary: service.summary ?? '', body: service.body ?? '',
        icon: service.icon ?? (icons[0]?.key ?? ''), sort: service.sort,
        is_active: service.is_active, image: null as File | null,
    });

    const submit = (e: FormEvent) => {
        e.preventDefault();
        // A file upload with PUT needs Laravel's method spoofing.
        form.transform((d: any) => ({ ...d, _method: 'put' }));
        form.post(`/admin/website/services/${service.id}`, {
            forceFormData: true, preserveScroll: true, onSuccess: onClose,
        });
    };

    return (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={onClose}>
            <form onClick={(e) => e.stopPropagation()} onSubmit={submit}
                  className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
                <div className="px-5 py-4 border-b border-surface-200 flex items-center justify-between">
                    <h3 className="font-semibold text-surface-900">Edit service</h3>
                    <button type="button" onClick={onClose}
                            className="w-8 h-8 rounded-lg hover:bg-surface-100 text-surface-400 flex items-center justify-center">
                        <i className="fi fi-rr-cross-small text-lg" />
                    </button>
                </div>
                <div className="p-5 space-y-4">
                    <Field label="Title *" error={form.errors.title}>
                        <input className="form-input" value={form.data.title}
                               onChange={(e) => form.setData('title', e.target.value)} />
                    </Field>
                    <Field label="Short summary" error={form.errors.summary}>
                        <textarea className="form-textarea" rows={3} value={form.data.summary}
                                  onChange={(e) => form.setData('summary', e.target.value)} />
                    </Field>
                    <Field label="Full text" error={form.errors.body}>
                        <textarea className="form-textarea" rows={4} value={form.data.body}
                                  onChange={(e) => form.setData('body', e.target.value)} />
                    </Field>
                    <IconPicker icons={icons} value={form.data.icon} onChange={(k) => form.setData('icon', k)}
                                error={form.errors.icon} />
                    <Field label="Image"
                           hint={service.image_url ? 'Choosing a file replaces the current image.' : 'Optional.'}
                           error={form.errors.image}>
                        <div className="flex items-center gap-3">
                            {service.image_url && (
                                <img src={service.image_url} alt="" className="w-20 h-14 rounded-lg object-cover" />
                            )}
                            <input type="file" accept="image/*" className="text-sm"
                                   onChange={(e) => form.setData('image', e.target.files?.[0] ?? null)} />
                        </div>
                    </Field>
                    <Field label="Order" error={form.errors.sort}>
                        <input type="number" min={0} className="form-input" value={form.data.sort}
                               onChange={(e) => form.setData('sort', Number(e.target.value))} />
                    </Field>
                    <label className="flex items-center gap-3 cursor-pointer">
                        <input type="checkbox" checked={form.data.is_active}
                               onChange={(e) => form.setData('is_active', e.target.checked)}
                               className="rounded border-surface-300 text-brand-500 focus:ring-brand-400" />
                        <span className="text-sm text-surface-700">Show on the website</span>
                    </label>
                </div>
                <div className="px-5 py-4 border-t border-surface-200 flex justify-end gap-3">
                    <button type="button" onClick={onClose} className="btn-ghost">Cancel</button>
                    <button type="submit" className="btn-primary" disabled={form.processing}>
                        {form.processing ? 'Saving…' : 'Save'}
                    </button>
                </div>
            </form>
        </div>
    );
}

// ── Partners & collaborators ─────────────────────────────────────────────

function PartnersTab({ partners, kinds }: { partners: PartnerRow[]; kinds: KindRow[] }) {
    const [editing, setEditing] = useState<PartnerRow | null>(null);

    const add = useForm<any>({
        name: '', kind: kinds[0]?.key ?? 'partner', url: '', note: '', sort: 0,
        logo: null as File | null, is_active: true,
    });

    const submit = (e: FormEvent) => {
        e.preventDefault();
        add.post('/admin/website/partners', {
            forceFormData: true,
            preserveScroll: true,
            onSuccess: () => add.reset('name', 'url', 'note', 'logo'),
        });
    };

    const remove = (x: PartnerRow) => {
        if (confirm(`Remove "${x.name}"? This cannot be undone.`)) {
            router.delete(`/admin/website/partners/${x.id}`, { preserveScroll: true });
        }
    };

    return (
        <div className="grid lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 card">
                <div className="card-header">
                    <h2 className="font-semibold text-surface-800">Collaborators &amp; partners</h2>
                    <p className="text-xs text-surface-500 mt-0.5">
                        {partners.length} logo{partners.length === 1 ? '' : 's'} · shown on the home page and the Clients page
                    </p>
                </div>
                {partners.length === 0 ? (
                    <div className="card-body text-center py-14">
                        <i className="fi fi-rr-handshake text-3xl text-surface-300" />
                        <div className="text-sm font-bold text-surface-700 mt-3">No partners yet</div>
                        <div className="text-xs text-surface-500 mt-1 max-w-md mx-auto">
                            The section only appears once there is at least one logo, so the public
                            pages never show an empty band.
                        </div>
                    </div>
                ) : (
                    <div className="card-body grid sm:grid-cols-2 gap-3">
                        {partners.map(x => (
                            <div key={x.id}
                                 className={`flex gap-3 p-3 rounded-xl border ${x.is_active ? 'border-surface-200' : 'border-surface-200 bg-surface-50/70'}`}>
                                <div className="w-20 h-14 rounded-lg bg-surface-50 border border-surface-200 shrink-0 flex items-center justify-center overflow-hidden">
                                    {x.logo_url
                                        ? <img src={x.logo_url} alt="" className="max-h-12 max-w-[4.5rem] object-contain" />
                                        : <i className="fi fi-rr-picture text-surface-300" />}
                                </div>
                                <div className="min-w-0 grow">
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <span className="text-sm font-bold text-surface-900 truncate">{x.name}</span>
                                        {!x.is_active && <span className="badge-slate">Hidden</span>}
                                        {!x.has_logo && <span className="badge-amber">No logo</span>}
                                    </div>
                                    <div className="text-[11px] text-surface-500 mt-0.5 capitalize">
                                        {x.kind} · #{x.sort}
                                    </div>
                                    {x.note && <div className="text-[11px] text-surface-400 mt-0.5 truncate">{x.note}</div>}
                                    {x.url && (
                                        <a href={x.url} target="_blank" rel="noreferrer"
                                           className="text-[11px] text-brand-600 hover:text-brand-700 truncate block mt-0.5">
                                            {x.url}
                                        </a>
                                    )}
                                </div>
                                <div className="flex items-start gap-1 shrink-0">
                                    <button type="button" onClick={() => setEditing(x)} title="Edit"
                                            className="w-8 h-8 rounded-lg hover:bg-surface-100 text-surface-500 flex items-center justify-center">
                                        <i className="fi fi-rr-pencil text-xs" />
                                    </button>
                                    <button type="button" onClick={() => remove(x)} title="Remove"
                                            className="w-8 h-8 rounded-lg hover:bg-red-50 text-surface-400 hover:text-red-600 flex items-center justify-center">
                                        <i className="fi fi-rr-trash text-xs" />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            <form onSubmit={submit} className="card self-start">
                <div className="card-header"><h2 className="font-semibold text-surface-800">Add a partner</h2></div>
                <div className="card-body space-y-4">
                    <Field label="Name *" error={add.errors.name}>
                        <input className="form-input" value={add.data.name}
                               onChange={(e) => add.setData('name', e.target.value)}
                               placeholder="Ministry of Industries" />
                    </Field>
                    <Field label="Logo *"
                           hint="A transparent PNG or an SVG reads best — the wall sets every logo in grey and lifts it to colour on hover. Up to 4 MB."
                           error={add.errors.logo}>
                        <input type="file" accept="image/*" className="text-sm"
                               onChange={(e) => add.setData('logo', e.target.files?.[0] ?? null)} />
                    </Field>
                    <Field label="Type" error={add.errors.kind}>
                        <select className="form-input" value={add.data.kind}
                                onChange={(e) => add.setData('kind', e.target.value)}>
                            {kinds.map(k => <option key={k.key} value={k.key}>{k.label}</option>)}
                        </select>
                    </Field>
                    <Field label="Website" hint="Optional. The logo becomes a link." error={add.errors.url}>
                        <input className="form-input" value={add.data.url}
                               onChange={(e) => add.setData('url', e.target.value)} placeholder="https://moind.gov.bd" />
                    </Field>
                    <Field label="Note" hint="Optional one-liner under the name." error={add.errors.note}>
                        <input className="form-input" value={add.data.note}
                               onChange={(e) => add.setData('note', e.target.value)} placeholder="Technical collaboration, 2024—" />
                    </Field>
                    <Field label="Order" error={add.errors.sort}>
                        <input type="number" min={0} className="form-input" value={add.data.sort}
                               onChange={(e) => add.setData('sort', Number(e.target.value))} />
                    </Field>
                    <button type="submit" className="btn-primary w-full" disabled={add.processing}>
                        {add.processing ? 'Uploading…' : 'Add partner'}
                    </button>
                </div>
            </form>

            {editing && <PartnerEditModal partner={editing} kinds={kinds} onClose={() => setEditing(null)} />}
        </div>
    );
}

function PartnerEditModal({ partner, kinds, onClose }: {
    partner: PartnerRow; kinds: KindRow[]; onClose: () => void;
}) {
    const form = useForm<any>({
        name: partner.name, kind: partner.kind, url: partner.url ?? '', note: partner.note ?? '',
        sort: partner.sort, is_active: partner.is_active, logo: null as File | null,
    });

    const submit = (e: FormEvent) => {
        e.preventDefault();
        // A file upload with PUT needs Laravel's method spoofing.
        form.transform((d: any) => ({ ...d, _method: 'put' }));
        form.post(`/admin/website/partners/${partner.id}`, {
            forceFormData: true, preserveScroll: true, onSuccess: onClose,
        });
    };

    return (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={onClose}>
            <form onClick={(e) => e.stopPropagation()} onSubmit={submit}
                  className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
                <div className="px-5 py-4 border-b border-surface-200 flex items-center justify-between">
                    <h3 className="font-semibold text-surface-900">Edit partner</h3>
                    <button type="button" onClick={onClose}
                            className="w-8 h-8 rounded-lg hover:bg-surface-100 text-surface-400 flex items-center justify-center">
                        <i className="fi fi-rr-cross-small text-lg" />
                    </button>
                </div>
                <div className="p-5 space-y-4">
                    {partner.logo_url && (
                        <div className="h-24 rounded-xl bg-surface-50 border border-surface-200 flex items-center justify-center">
                            <img src={partner.logo_url} alt="" className="max-h-16 max-w-[70%] object-contain" />
                        </div>
                    )}
                    <Field label="Name *" error={form.errors.name}>
                        <input className="form-input" value={form.data.name}
                               onChange={(e) => form.setData('name', e.target.value)} />
                    </Field>
                    <Field label="Replace the logo" hint="Leave empty to keep the current one." error={form.errors.logo}>
                        <input type="file" accept="image/*" className="text-sm"
                               onChange={(e) => form.setData('logo', e.target.files?.[0] ?? null)} />
                    </Field>
                    <Field label="Type" error={form.errors.kind}>
                        <select className="form-input" value={form.data.kind}
                                onChange={(e) => form.setData('kind', e.target.value)}>
                            {kinds.map(k => <option key={k.key} value={k.key}>{k.label}</option>)}
                        </select>
                    </Field>
                    <Field label="Website" error={form.errors.url}>
                        <input className="form-input" value={form.data.url}
                               onChange={(e) => form.setData('url', e.target.value)} />
                    </Field>
                    <Field label="Note" error={form.errors.note}>
                        <input className="form-input" value={form.data.note}
                               onChange={(e) => form.setData('note', e.target.value)} />
                    </Field>
                    <Field label="Order" error={form.errors.sort}>
                        <input type="number" min={0} className="form-input" value={form.data.sort}
                               onChange={(e) => form.setData('sort', Number(e.target.value))} />
                    </Field>
                    <label className="flex items-center gap-3 cursor-pointer">
                        <input type="checkbox" checked={form.data.is_active}
                               onChange={(e) => form.setData('is_active', e.target.checked)}
                               className="rounded border-surface-300 text-brand-500 focus:ring-brand-400" />
                        <span className="text-sm text-surface-700">Show on the website</span>
                    </label>
                </div>
                <div className="px-5 py-4 border-t border-surface-200 flex justify-end gap-3">
                    <button type="button" onClick={onClose} className="btn-ghost">Cancel</button>
                    <button type="submit" className="btn-primary" disabled={form.processing}>
                        {form.processing ? 'Saving…' : 'Save'}
                    </button>
                </div>
            </form>
        </div>
    );
}

// ── Offices & contact persons ────────────────────────────────────────────

function OfficesTab({ offices, centers }: { offices: OfficeRow[]; centers: CenterOpt[] }) {
    const [editing, setEditing] = useState<OfficeRow | 'new' | null>(null);
    const [contactEdit, setContactEdit] = useState<{ office: OfficeRow; contact: OfficeContactRow | null } | null>(null);

    const removeOffice = (o: OfficeRow) => {
        if (confirm(`Remove "${o.name}" and its ${o.contacts.length} contact person(s)? This cannot be undone.`)) {
            router.delete(`/admin/website/offices/${o.id}`, { preserveScroll: true });
        }
    };
    const removeContact = (c: OfficeContactRow) => {
        if (confirm(`Remove ${c.name || c.designation}?`)) {
            router.delete(`/admin/website/office-contacts/${c.id}`, { preserveScroll: true });
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm text-surface-500 max-w-2xl">
                    The offices on the public Contact page, each with its map pin and contact persons. An office
                    linked to a PMS centre takes any field left blank from that centre&rsquo;s letterhead.
                </p>
                <button type="button" onClick={() => setEditing('new')} className="btn-primary">
                    <i className="fi fi-rr-plus text-xs mr-1.5" />Add office
                </button>
            </div>

            {offices.length === 0 && (
                <div className="card"><div className="card-body text-center py-14 text-sm text-surface-500">
                    No offices yet. The Contact page says so until there is one.
                </div></div>
            )}

            {offices.map((o) => (
                <div key={o.id} className={`card ${o.is_active ? '' : 'opacity-70'}`}>
                    <div className="card-header flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                                <h2 className="font-semibold text-surface-900">{o.name}</h2>
                                {o.is_head_office && <span className="badge-amber">Head office</span>}
                                {!o.is_active && <span className="badge-slate">Hidden</span>}
                                <span className="text-[11px] text-surface-400 font-mono">#{o.slug}</span>
                            </div>
                            <div className="text-xs text-surface-500 mt-1 space-y-0.5">
                                <div>
                                    <i className="fi fi-rr-marker text-[10px] mr-1.5" />{o.shown_address || '—'}
                                    {!o.address && o.shown_address && <span className="ml-1.5 text-surface-400">(from {o.center_name} letterhead)</span>}
                                </div>
                                <div>
                                    <i className="fi fi-rr-phone-call text-[10px] mr-1.5" />{o.shown_phone || '—'}
                                    {o.fax && <span className="ml-3"><i className="fi fi-rr-print text-[10px] mr-1" />{o.fax}</span>}
                                    {o.shown_email && <span className="ml-3"><i className="fi fi-rr-envelope text-[10px] mr-1" />{o.shown_email}</span>}
                                </div>
                                <div className="text-surface-400">
                                    <i className="fi fi-rr-map-marker text-[10px] mr-1.5" />
                                    {o.latitude !== null ? `Pin ${o.latitude}, ${o.longitude}` : `Map search: ${o.map_query || '(name + address)'}`}
                                </div>
                            </div>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                            <a href={o.map_link} target="_blank" rel="noreferrer" title="Check the map"
                               className="w-8 h-8 rounded-lg hover:bg-surface-100 text-surface-500 flex items-center justify-center">
                                <i className="fi fi-rr-map text-xs" />
                            </a>
                            <a href={`/portfolio/contact#${o.slug}`} target="_blank" rel="noreferrer" title="View on the site"
                               className="w-8 h-8 rounded-lg hover:bg-surface-100 text-surface-500 flex items-center justify-center">
                                <i className="fi fi-rr-eye text-xs" />
                            </a>
                            <button type="button" onClick={() => setEditing(o)} title="Edit office"
                                    className="w-8 h-8 rounded-lg hover:bg-surface-100 text-surface-500 flex items-center justify-center">
                                <i className="fi fi-rr-pencil text-xs" />
                            </button>
                            <button type="button" onClick={() => removeOffice(o)} title="Remove office"
                                    className="w-8 h-8 rounded-lg hover:bg-red-50 text-surface-400 hover:text-red-600 flex items-center justify-center">
                                <i className="fi fi-rr-trash text-xs" />
                            </button>
                        </div>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead className="bg-surface-50 text-left text-[11px] uppercase tracking-wider text-surface-500">
                                <tr>
                                    <th className="px-4 py-2.5 w-12">Sl</th>
                                    <th className="px-4 py-2.5">Contact person</th>
                                    <th className="px-4 py-2.5">Mobile</th>
                                    <th className="px-4 py-2.5">Phone</th>
                                    <th className="px-4 py-2.5">Email</th>
                                    <th className="px-4 py-2.5 w-24 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-surface-100">
                                {o.contacts.map((c, i) => (
                                    <tr key={c.id} className={`hover:bg-surface-50/70 ${c.is_active ? '' : 'opacity-60'}`}>
                                        <td className="px-4 py-2.5 text-surface-400 tabular-nums">{i + 1}</td>
                                        <td className="px-4 py-2.5">
                                            {c.name && <div className="font-medium text-surface-900">{c.name}</div>}
                                            <div className={c.name ? 'text-xs text-surface-500' : 'text-surface-800'}>{c.designation}</div>
                                            {!c.is_active && <span className="badge-slate mt-1 inline-block">Hidden</span>}
                                        </td>
                                        <td className="px-4 py-2.5 text-surface-700 whitespace-nowrap">{c.mobile || <span className="text-surface-300">—</span>}</td>
                                        <td className="px-4 py-2.5 text-surface-600 whitespace-nowrap">{c.phone || <span className="text-surface-300">—</span>}</td>
                                        <td className="px-4 py-2.5 text-surface-600 text-xs">{c.email || <span className="text-surface-300">—</span>}</td>
                                        <td className="px-4 py-2.5">
                                            <div className="flex items-center justify-end gap-1">
                                                <button type="button" onClick={() => setContactEdit({ office: o, contact: c })} title="Edit"
                                                        className="w-8 h-8 rounded-lg hover:bg-surface-100 text-surface-500 flex items-center justify-center">
                                                    <i className="fi fi-rr-pencil text-xs" />
                                                </button>
                                                <button type="button" onClick={() => removeContact(c)} title="Remove"
                                                        className="w-8 h-8 rounded-lg hover:bg-red-50 text-surface-400 hover:text-red-600 flex items-center justify-center">
                                                    <i className="fi fi-rr-trash text-xs" />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                                {o.contacts.length === 0 && (
                                    <tr><td colSpan={6} className="px-4 py-6 text-center text-xs text-surface-400">No contact persons yet.</td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                    <div className="px-4 py-3 border-t border-surface-100">
                        <button type="button" onClick={() => setContactEdit({ office: o, contact: null })}
                                className="text-xs font-semibold text-brand-700 hover:text-brand-800">
                            <i className="fi fi-rr-user-add text-[11px] mr-1.5" />Add contact person
                        </button>
                    </div>
                </div>
            ))}

            {editing && (
                <OfficeModal office={editing === 'new' ? null : editing} centers={centers} onClose={() => setEditing(null)} />
            )}
            {contactEdit && (
                <ContactModal office={contactEdit.office} contact={contactEdit.contact} onClose={() => setContactEdit(null)} />
            )}
        </div>
    );
}

function OfficeModal({ office, centers, onClose }: { office: OfficeRow | null; centers: CenterOpt[]; onClose: () => void }) {
    const form = useForm<any>({
        name: office?.name ?? '', slug: office?.slug ?? '', center_id: office?.center_id ?? '',
        address: office?.address ?? '', phone: office?.phone ?? '', fax: office?.fax ?? '', email: office?.email ?? '',
        map_query: office?.map_query ?? '', latitude: office?.latitude ?? '', longitude: office?.longitude ?? '',
        sort: office?.sort ?? 0, is_head_office: office?.is_head_office ?? false, is_active: office?.is_active ?? true,
    });

    const submit = (e: FormEvent) => {
        e.preventDefault();
        if (office) form.put(`/admin/website/offices/${office.id}`, { preserveScroll: true, onSuccess: onClose });
        else form.post('/admin/website/offices', { preserveScroll: true, onSuccess: onClose });
    };

    const linked = form.data.center_id !== '' && form.data.center_id !== null;

    return (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={onClose}>
            <form onClick={(e) => e.stopPropagation()} onSubmit={submit}
                  className="bg-white rounded-2xl w-full max-w-2xl max-h-[92vh] overflow-y-auto">
                <div className="px-5 py-4 border-b border-surface-200 flex items-center justify-between sticky top-0 bg-white z-10">
                    <h3 className="font-semibold text-surface-900">{office ? 'Edit office' : 'Add office'}</h3>
                    <button type="button" onClick={onClose}
                            className="w-8 h-8 rounded-lg hover:bg-surface-100 text-surface-400 flex items-center justify-center">
                        <i className="fi fi-rr-cross-small text-lg" />
                    </button>
                </div>
                <div className="p-5 space-y-4">
                    <div className="grid sm:grid-cols-3 gap-3">
                        <div className="sm:col-span-2">
                            <Field label="Name *" error={form.errors.name}>
                                <input className="form-input" value={form.data.name} onChange={(e) => form.setData('name', e.target.value)}
                                       placeholder="বিটাক, খুলনা" />
                            </Field>
                        </div>
                        <Field label="Link name *" hint="For /contact#… — lower-case." error={form.errors.slug}>
                            <input className="form-input font-mono" value={form.data.slug}
                                   onChange={(e) => form.setData('slug', e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-'))}
                                   placeholder="khulna" />
                        </Field>
                    </div>
                    <Field label="Linked PMS centre"
                           hint="Optional. Any field below left blank is then taken from that centre's letterhead."
                           error={form.errors.center_id}>
                        <select className="form-input" value={form.data.center_id ?? ''} onChange={(e) => form.setData('center_id', e.target.value)}>
                            <option value="">— none —</option>
                            {centers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>
                    </Field>
                    <Field label="Address" hint={linked ? 'Blank = the centre letterhead\u2019s address.' : undefined} error={form.errors.address}>
                        <textarea className="form-textarea" rows={2} value={form.data.address} onChange={(e) => form.setData('address', e.target.value)} />
                    </Field>
                    <div className="grid sm:grid-cols-3 gap-3">
                        <Field label="Phone" hint="Several? Separate with commas." error={form.errors.phone}>
                            <input className="form-input" value={form.data.phone} onChange={(e) => form.setData('phone', e.target.value)} />
                        </Field>
                        <Field label="Fax" error={form.errors.fax}>
                            <input className="form-input" value={form.data.fax} onChange={(e) => form.setData('fax', e.target.value)} />
                        </Field>
                        <Field label="Email" error={form.errors.email}>
                            <input className="form-input" value={form.data.email} onChange={(e) => form.setData('email', e.target.value)} />
                        </Field>
                    </div>

                    <div className="rounded-xl border border-surface-200 p-4 space-y-3 bg-surface-50/60">
                        <div className="text-xs font-bold text-surface-700 uppercase tracking-wider">Map location</div>
                        <Field label="Map search"
                               hint="What the map looks for — English finds places far more reliably than a Bangla address. Blank = name + address."
                               error={form.errors.map_query}>
                            <input className="form-input" value={form.data.map_query} onChange={(e) => form.setData('map_query', e.target.value)}
                                   placeholder="BITAC Khulna, Shiromoni Industrial Area, Khulna 9204" />
                        </Field>
                        <div className="grid grid-cols-2 gap-3">
                            <Field label="Exact pin — latitude" error={form.errors.latitude}>
                                <input className="form-input" value={form.data.latitude} onChange={(e) => form.setData('latitude', e.target.value)}
                                       placeholder="23.7650" />
                            </Field>
                            <Field label="Longitude" error={form.errors.longitude}>
                                <input className="form-input" value={form.data.longitude} onChange={(e) => form.setData('longitude', e.target.value)}
                                       placeholder="90.3990" />
                            </Field>
                        </div>
                        <p className="text-[11px] text-surface-500">
                            An exact pin wins over the search. To get one: right-click the building in Google Maps
                            and click the numbers at the top of the menu — they copy as &ldquo;latitude, longitude&rdquo;.
                        </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-6">
                        <Field label="Order" error={form.errors.sort}>
                            <input type="number" min={0} className="form-input w-28" value={form.data.sort}
                                   onChange={(e) => form.setData('sort', Number(e.target.value))} />
                        </Field>
                        <label className="flex items-center gap-2 cursor-pointer pt-5">
                            <input type="checkbox" checked={form.data.is_head_office}
                                   onChange={(e) => form.setData('is_head_office', e.target.checked)}
                                   className="rounded border-surface-300 text-brand-500 focus:ring-brand-400" />
                            <span className="text-sm text-surface-700">Head office</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer pt-5">
                            <input type="checkbox" checked={form.data.is_active}
                                   onChange={(e) => form.setData('is_active', e.target.checked)}
                                   className="rounded border-surface-300 text-brand-500 focus:ring-brand-400" />
                            <span className="text-sm text-surface-700">Show on the website</span>
                        </label>
                    </div>
                </div>
                <div className="px-5 py-4 border-t border-surface-200 flex justify-end gap-3 sticky bottom-0 bg-white">
                    <button type="button" onClick={onClose} className="btn-ghost">Cancel</button>
                    <button type="submit" className="btn-primary" disabled={form.processing}>
                        {form.processing ? 'Saving…' : office ? 'Save' : 'Add office'}
                    </button>
                </div>
            </form>
        </div>
    );
}

function ContactModal({ office, contact, onClose }: { office: OfficeRow; contact: OfficeContactRow | null; onClose: () => void }) {
    const form = useForm<any>({
        name: contact?.name ?? '', designation: contact?.designation ?? '', mobile: contact?.mobile ?? '',
        phone: contact?.phone ?? '', email: contact?.email ?? '', sort: contact?.sort ?? (office.contacts.length + 1),
        is_active: contact?.is_active ?? true,
    });

    const submit = (e: FormEvent) => {
        e.preventDefault();
        if (contact) form.put(`/admin/website/office-contacts/${contact.id}`, { preserveScroll: true, onSuccess: onClose });
        else form.post(`/admin/website/offices/${office.id}/contacts`, { preserveScroll: true, onSuccess: onClose });
    };

    return (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={onClose}>
            <form onClick={(e) => e.stopPropagation()} onSubmit={submit}
                  className="bg-white rounded-2xl w-full max-w-lg max-h-[92vh] overflow-y-auto">
                <div className="px-5 py-4 border-b border-surface-200 flex items-center justify-between">
                    <div>
                        <h3 className="font-semibold text-surface-900">{contact ? 'Edit contact person' : 'Add contact person'}</h3>
                        <div className="text-xs text-surface-500">{office.name}</div>
                    </div>
                    <button type="button" onClick={onClose}
                            className="w-8 h-8 rounded-lg hover:bg-surface-100 text-surface-400 flex items-center justify-center">
                        <i className="fi fi-rr-cross-small text-lg" />
                    </button>
                </div>
                <div className="p-5 space-y-4">
                    <Field label="Designation *" hint="The post — e.g. নির্বাহী প্রকৌশলী (কেন্দ্র প্রধান)." error={form.errors.designation}>
                        <input className="form-input" value={form.data.designation} onChange={(e) => form.setData('designation', e.target.value)} />
                    </Field>
                    <Field label="Name"
                           hint="Optional. A post with its official email is a valid contact on its own — and survives the officer being transferred."
                           error={form.errors.name}>
                        <input className="form-input" value={form.data.name} onChange={(e) => form.setData('name', e.target.value)} />
                    </Field>
                    <div className="grid grid-cols-2 gap-3">
                        <Field label="Mobile" error={form.errors.mobile}>
                            <input className="form-input" value={form.data.mobile} onChange={(e) => form.setData('mobile', e.target.value)}
                                   placeholder="+৮৮০১…" />
                        </Field>
                        <Field label="Office phone" error={form.errors.phone}>
                            <input className="form-input" value={form.data.phone} onChange={(e) => form.setData('phone', e.target.value)} />
                        </Field>
                    </div>
                    <Field label="Email" hint="Prefer the post's @bitac.gov.bd address to a personal one." error={form.errors.email}>
                        <input className="form-input" value={form.data.email} onChange={(e) => form.setData('email', e.target.value)} />
                    </Field>
                    <div className="flex items-center gap-6">
                        <Field label="Order" error={form.errors.sort}>
                            <input type="number" min={0} className="form-input w-28" value={form.data.sort}
                                   onChange={(e) => form.setData('sort', Number(e.target.value))} />
                        </Field>
                        <label className="flex items-center gap-2 cursor-pointer pt-5">
                            <input type="checkbox" checked={form.data.is_active}
                                   onChange={(e) => form.setData('is_active', e.target.checked)}
                                   className="rounded border-surface-300 text-brand-500 focus:ring-brand-400" />
                            <span className="text-sm text-surface-700">Show on the website</span>
                        </label>
                    </div>
                </div>
                <div className="px-5 py-4 border-t border-surface-200 flex justify-end gap-3">
                    <button type="button" onClick={onClose} className="btn-ghost">Cancel</button>
                    <button type="submit" className="btn-primary" disabled={form.processing}>
                        {form.processing ? 'Saving…' : contact ? 'Save' : 'Add'}
                    </button>
                </div>
            </form>
        </div>
    );
}

// ── News ─────────────────────────────────────────────────────────────────

function NewsTab({ news }: { news: NewsRow[] }) {
    const [q, setQ] = useState('');
    const needle = q.trim().toLowerCase();
    const rows = needle
        ? news.filter((n) => [n.title, n.excerpt, n.location, n.kind].filter(Boolean).join(' ').toLowerCase().includes(needle))
        : news;

    const remove = (n: NewsRow) => {
        if (confirm(`Delete "${n.title}"? This cannot be undone.`)) {
            router.delete(`/admin/website/news/${n.id}`);
        }
    };

    return (
        <div className="card">
            <div className="card-header flex flex-wrap items-center justify-between gap-3">
                <div>
                    <h2 className="font-semibold text-surface-800">News, events, notices &amp; tenders</h2>
                    <p className="text-xs text-surface-500 mt-0.5">{news.length} post{news.length === 1 ? '' : 's'}</p>
                </div>
                <div className="flex items-center gap-2">
                    <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search posts…"
                           className="form-input py-2 text-sm w-48" />
                    <Link href="/admin/website/news/create" className="btn-primary">
                        <i className="fi fi-rr-plus text-xs mr-1.5" />New post
                    </Link>
                </div>
            </div>
            {rows.length === 0 ? (
                <div className="card-body text-center py-14 text-sm text-surface-500">
                    {news.length ? 'Nothing matches that search.' : 'No posts yet. The news page shows an empty state until there is one.'}
                </div>
            ) : (
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead className="bg-surface-50 text-left text-[11px] uppercase tracking-wider text-surface-500">
                            <tr>
                                <th className="px-4 py-3 w-12">Sl</th>
                                <th className="px-4 py-3">Title</th>
                                <th className="px-4 py-3 w-24">Type</th>
                                <th className="px-4 py-3 w-28">Date</th>
                                <th className="px-4 py-3 w-24">Status</th>
                                <th className="px-4 py-3 w-28 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-surface-100">
                            {rows.map((n, i) => (
                                <tr key={n.id} className="hover:bg-surface-50/70">
                                    <td className="px-4 py-3 text-surface-400 tabular-nums">{i + 1}</td>
                                    <td className="px-4 py-3">
                                        <div className="flex items-center gap-3">
                                            {n.cover_url
                                                ? <img src={n.cover_url} alt="" className="w-10 h-10 rounded-lg object-cover shrink-0" />
                                                : <span className="w-10 h-10 rounded-lg bg-surface-100 flex items-center justify-center shrink-0">
                                                      <i className="fi fi-rr-newspaper text-xs text-surface-400" />
                                                  </span>}
                                            <div className="min-w-0">
                                                <div className="font-medium text-surface-900 truncate max-w-md">{n.title}</div>
                                                {n.location && <div className="text-[11px] text-surface-500 truncate">{n.location}</div>}
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-4 py-3">
                                        <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border ${KIND_TONE[n.kind] ?? 'bg-surface-100 text-surface-600 border-surface-200'}`}>
                                            {n.kind}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3 text-surface-600 text-xs tabular-nums">
                                        {n.event_date || n.published_at || '—'}
                                    </td>
                                    <td className="px-4 py-3">
                                        {n.is_published
                                            ? <span className="badge-green">Live</span>
                                            : <span className="badge-slate">Draft</span>}
                                    </td>
                                    <td className="px-4 py-3">
                                        <div className="flex items-center justify-end gap-1">
                                            {n.is_published && (
                                                <a href={`/portfolio/news/${n.slug}`} target="_blank" rel="noreferrer"
                                                   title="View on site"
                                                   className="w-8 h-8 rounded-lg hover:bg-surface-100 text-surface-500 flex items-center justify-center">
                                                    <i className="fi fi-rr-eye text-xs" />
                                                </a>
                                            )}
                                            <Link href={`/admin/website/news/${n.id}/edit`} title="Edit"
                                                  className="w-8 h-8 rounded-lg hover:bg-surface-100 text-surface-500 flex items-center justify-center">
                                                <i className="fi fi-rr-pencil text-xs" />
                                            </Link>
                                            <button type="button" onClick={() => remove(n)} title="Delete"
                                                    className="w-8 h-8 rounded-lg hover:bg-red-50 text-surface-400 hover:text-red-600 flex items-center justify-center">
                                                <i className="fi fi-rr-trash text-xs" />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}

// ── Photos & videos (one component — they differ only in the media field) ──

function MediaTab({ kind, rows, albums }: { kind: 'photo' | 'video'; rows: GalleryRow[]; albums: string[] }) {
    const isVideo = kind === 'video';
    const [editing, setEditing] = useState<GalleryRow | null>(null);

    const add = useForm<any>({
        kind, title: '', caption: '', album: '', taken_on: '', sort: 0,
        image: null as File | null, video_url: '',
    });

    const submitAdd = (e: FormEvent) => {
        e.preventDefault();
        add.post('/admin/website/gallery', {
            forceFormData: true,
            preserveScroll: true,
            onSuccess: () => add.reset('title', 'caption', 'taken_on', 'image', 'video_url'),
        });
    };

    const remove = (g: GalleryRow) => {
        if (confirm(`Remove this ${kind}? This cannot be undone.`)) {
            router.delete(`/admin/website/gallery/${g.id}`, { preserveScroll: true });
        }
    };

    const toggle = (g: GalleryRow) => {
        router.put(`/admin/website/gallery/${g.id}`, {
            title: g.title ?? '', caption: g.caption ?? '', album: g.album ?? '',
            taken_on: g.taken_on ?? '', sort: g.sort, is_active: !g.is_active,
            video_url: g.video_url ?? '',
        }, { preserveScroll: true });
    };

    return (
        <div className="grid lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 card">
                <div className="card-header">
                    <h2 className="font-semibold text-surface-800">{isVideo ? 'Videos' : 'Photos'}</h2>
                    <p className="text-xs text-surface-500 mt-0.5">
                        {rows.length} item{rows.length === 1 ? '' : 's'} · lower order numbers come first
                    </p>
                </div>
                {rows.length === 0 ? (
                    <div className="card-body text-center py-14 text-sm text-surface-500">
                        Nothing here yet. The {isVideo ? 'video' : 'photo'} gallery shows an empty state until there is.
                    </div>
                ) : (
                    <div className="card-body grid sm:grid-cols-2 gap-4">
                        {rows.map((g) => (
                            <div key={g.id} className={`rounded-xl border overflow-hidden ${g.is_active ? 'border-surface-200' : 'border-surface-200 opacity-60'}`}>
                                <div className="aspect-video bg-surface-100 relative">
                                    {g.thumb_url
                                        ? <img src={g.thumb_url} alt="" className="w-full h-full object-cover" />
                                        : <div className="w-full h-full flex items-center justify-center">
                                              <i className={`fi ${isVideo ? 'fi-rr-play' : 'fi-rr-picture'} text-2xl text-surface-300`} />
                                          </div>}
                                    {!g.is_active && (
                                        <span className="absolute top-2 left-2 badge-slate">Hidden</span>
                                    )}
                                </div>
                                <div className="p-3">
                                    <div className="text-xs font-semibold text-surface-900 truncate">{g.title || '(untitled)'}</div>
                                    <div className="flex items-center gap-2 mt-1 text-[11px] text-surface-400">
                                        {g.album && <span className="truncate">{g.album}</span>}
                                        {g.taken_on && <span className="tabular-nums">{g.taken_on}</span>}
                                        <span className="tabular-nums">#{g.sort}</span>
                                    </div>
                                    <div className="flex items-center gap-1 mt-2">
                                        <button type="button" onClick={() => setEditing(g)}
                                                className="text-[11px] font-semibold text-brand-700 hover:text-brand-800 px-2 py-1 rounded hover:bg-brand-50">
                                            Edit
                                        </button>
                                        <button type="button" onClick={() => toggle(g)}
                                                className="text-[11px] font-semibold text-surface-500 hover:text-surface-700 px-2 py-1 rounded hover:bg-surface-100">
                                            {g.is_active ? 'Hide' : 'Show'}
                                        </button>
                                        <button type="button" onClick={() => remove(g)}
                                                className="text-[11px] font-semibold text-surface-400 hover:text-red-600 px-2 py-1 rounded hover:bg-red-50 ml-auto">
                                            Delete
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            <form onSubmit={submitAdd} className="card self-start">
                <div className="card-header">
                    <h2 className="font-semibold text-surface-800">Add a {kind}</h2>
                </div>
                <div className="card-body space-y-4">
                    {isVideo ? (
                        <Field label="Video link *" hint="A YouTube, Vimeo or embed URL — it is converted to an embeddable address automatically."
                               error={add.errors.video_url}>
                            <input className="form-input" value={add.data.video_url}
                                   onChange={(e) => add.setData('video_url', e.target.value)}
                                   placeholder="https://www.youtube.com/watch?v=…" />
                        </Field>
                    ) : (
                        <Field label="Image file *" hint="Up to 8 MB." error={add.errors.image}>
                            <input type="file" accept="image/*" className="text-sm"
                                   onChange={(e) => add.setData('image', e.target.files?.[0] ?? null)} />
                        </Field>
                    )}
                    <Field label="Title" error={add.errors.title}>
                        <input className="form-input" value={add.data.title}
                               onChange={(e) => add.setData('title', e.target.value)} />
                    </Field>
                    <Field label="Caption" error={add.errors.caption}>
                        <textarea className="form-textarea" rows={2} value={add.data.caption}
                                  onChange={(e) => add.setData('caption', e.target.value)} />
                    </Field>
                    <Field label="Album" hint="Groups items into a filter on the gallery page." error={add.errors.album}>
                        <input className="form-input" list="website-albums" value={add.data.album}
                               onChange={(e) => add.setData('album', e.target.value)} />
                        <datalist id="website-albums">
                            {albums.map((a) => <option key={a} value={a} />)}
                        </datalist>
                    </Field>
                    <div className="grid grid-cols-2 gap-3">
                        <Field label="Date" error={add.errors.taken_on}>
                            <input type="date" className="form-input" value={add.data.taken_on}
                                   onChange={(e) => add.setData('taken_on', e.target.value)} />
                        </Field>
                        <Field label="Order" error={add.errors.sort}>
                            <input type="number" min={0} className="form-input" value={add.data.sort}
                                   onChange={(e) => add.setData('sort', Number(e.target.value))} />
                        </Field>
                    </div>
                    <button type="submit" className="btn-primary w-full" disabled={add.processing}>
                        {add.processing ? 'Uploading…' : `Add ${kind}`}
                    </button>
                </div>
            </form>

            {editing && (
                <MediaEditModal item={editing} albums={albums} onClose={() => setEditing(null)} />
            )}
        </div>
    );
}

function MediaEditModal({ item, albums, onClose }: { item: GalleryRow; albums: string[]; onClose: () => void }) {
    const form = useForm<any>({
        title: item.title ?? '', caption: item.caption ?? '', album: item.album ?? '',
        taken_on: item.taken_on ?? '', sort: item.sort, is_active: item.is_active,
        video_url: item.video_url ?? '',
    });

    const submit = (e: FormEvent) => {
        e.preventDefault();
        form.put(`/admin/website/gallery/${item.id}`, { preserveScroll: true, onSuccess: onClose });
    };

    return (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={onClose}>
            <form onClick={(e) => e.stopPropagation()} onSubmit={submit}
                  className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
                <div className="px-5 py-4 border-b border-surface-200 flex items-center justify-between">
                    <h3 className="font-semibold text-surface-900">Edit {item.kind}</h3>
                    <button type="button" onClick={onClose}
                            className="w-8 h-8 rounded-lg hover:bg-surface-100 text-surface-400 flex items-center justify-center">
                        <i className="fi fi-rr-cross-small text-lg" />
                    </button>
                </div>
                <div className="p-5 space-y-4">
                    {item.kind === 'video' && (
                        <Field label="Video link" error={form.errors.video_url}>
                            <input className="form-input" value={form.data.video_url}
                                   onChange={(e) => form.setData('video_url', e.target.value)} />
                        </Field>
                    )}
                    <Field label="Title" error={form.errors.title}>
                        <input className="form-input" value={form.data.title}
                               onChange={(e) => form.setData('title', e.target.value)} />
                    </Field>
                    <Field label="Caption" error={form.errors.caption}>
                        <textarea className="form-textarea" rows={2} value={form.data.caption}
                                  onChange={(e) => form.setData('caption', e.target.value)} />
                    </Field>
                    <Field label="Album" error={form.errors.album}>
                        <input className="form-input" list="website-albums-edit" value={form.data.album}
                               onChange={(e) => form.setData('album', e.target.value)} />
                        <datalist id="website-albums-edit">
                            {albums.map((a) => <option key={a} value={a} />)}
                        </datalist>
                    </Field>
                    <div className="grid grid-cols-2 gap-3">
                        <Field label="Date" error={form.errors.taken_on}>
                            <input type="date" className="form-input" value={form.data.taken_on}
                                   onChange={(e) => form.setData('taken_on', e.target.value)} />
                        </Field>
                        <Field label="Order" error={form.errors.sort}>
                            <input type="number" min={0} className="form-input" value={form.data.sort}
                                   onChange={(e) => form.setData('sort', Number(e.target.value))} />
                        </Field>
                    </div>
                    <label className="flex items-center gap-3 cursor-pointer">
                        <input type="checkbox" checked={form.data.is_active}
                               onChange={(e) => form.setData('is_active', e.target.checked)}
                               className="rounded border-surface-300 text-brand-500 focus:ring-brand-400" />
                        <span className="text-sm text-surface-700">Show on the website</span>
                    </label>
                </div>
                <div className="px-5 py-4 border-t border-surface-200 flex justify-end gap-3">
                    <button type="button" onClick={onClose} className="btn-ghost">Cancel</button>
                    <button type="submit" className="btn-primary" disabled={form.processing}>
                        {form.processing ? 'Saving…' : 'Save'}
                    </button>
                </div>
            </form>
        </div>
    );
}

// ── Links ────────────────────────────────────────────────────────────────

function LinksTab({ links, groups }: { links: LinkRow[]; groups: string[] }) {
    const [editing, setEditing] = useState<number | null>(null);

    const add = useForm<any>({ label: '', url: '', group: 'important', sort: 0, is_active: true });
    const edit = useForm<any>({ label: '', url: '', group: 'important', sort: 0, is_active: true });

    const submitAdd = (e: FormEvent) => {
        e.preventDefault();
        add.post('/admin/website/links', {
            preserveScroll: true,
            onSuccess: () => add.reset('label', 'url'),
        });
    };

    const startEdit = (l: LinkRow) => {
        setEditing(l.id);
        edit.setData({ label: l.label, url: l.url, group: l.group, sort: l.sort, is_active: l.is_active });
    };

    const submitEdit = (e: FormEvent, id: number) => {
        e.preventDefault();
        edit.put(`/admin/website/links/${id}`, { preserveScroll: true, onSuccess: () => setEditing(null) });
    };

    const remove = (l: LinkRow) => {
        if (confirm(`Remove "${l.label}"?`)) router.delete(`/admin/website/links/${l.id}`, { preserveScroll: true });
    };

    return (
        <div className="grid lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
                {groups.map((g) => {
                    const rows = links.filter((l) => l.group === g);
                    return (
                        <div key={g} className="card">
                            <div className="card-header">
                                <h2 className="font-semibold text-surface-800">{GROUP_LABEL[g] ?? g}</h2>
                                <p className="text-xs text-surface-500 mt-0.5">
                                    {g === 'ministry'
                                        ? 'Shown in the thin strip above the header and in the footer.'
                                        : g === 'important'
                                            ? 'Shown in the footer under “Important Links”.'
                                            : 'Service links shown in the footer.'}
                                </p>
                            </div>
                            {rows.length === 0 ? (
                                <div className="card-body text-sm text-surface-500 py-8 text-center">No links in this group.</div>
                            ) : (
                                <table className="w-full text-sm">
                                    <thead className="bg-surface-50 text-left text-[11px] uppercase tracking-wider text-surface-500">
                                        <tr>
                                            <th className="px-4 py-2.5 w-12">Sl</th>
                                            <th className="px-4 py-2.5">Label</th>
                                            <th className="px-4 py-2.5">URL</th>
                                            <th className="px-4 py-2.5 w-20">Order</th>
                                            <th className="px-4 py-2.5 w-24 text-right">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-surface-100">
                                        {rows.map((l, i) => editing === l.id ? (
                                            <tr key={l.id} className="bg-brand-50/40">
                                                <td colSpan={5} className="px-4 py-3">
                                                    <form onSubmit={(e) => submitEdit(e, l.id)} className="flex flex-wrap items-end gap-3">
                                                        <div className="grow min-w-[10rem]">
                                                            <label className="form-label text-[11px]">Label</label>
                                                            <input className="form-input py-2 text-sm" value={edit.data.label}
                                                                   onChange={(e) => edit.setData('label', e.target.value)} />
                                                        </div>
                                                        <div className="grow min-w-[14rem]">
                                                            <label className="form-label text-[11px]">URL</label>
                                                            <input className="form-input py-2 text-sm" value={edit.data.url}
                                                                   onChange={(e) => edit.setData('url', e.target.value)} />
                                                        </div>
                                                        <div className="w-36">
                                                            <label className="form-label text-[11px]">Group</label>
                                                            <select className="form-input py-2 text-sm capitalize" value={edit.data.group}
                                                                    onChange={(e) => edit.setData('group', e.target.value)}>
                                                                {groups.map((gg) => <option key={gg} value={gg}>{gg}</option>)}
                                                            </select>
                                                        </div>
                                                        <div className="w-20">
                                                            <label className="form-label text-[11px]">Order</label>
                                                            <input type="number" min={0} className="form-input py-2 text-sm" value={edit.data.sort}
                                                                   onChange={(e) => edit.setData('sort', Number(e.target.value))} />
                                                        </div>
                                                        <label className="flex items-center gap-2 pb-2.5 cursor-pointer">
                                                            <input type="checkbox" checked={edit.data.is_active}
                                                                   onChange={(e) => edit.setData('is_active', e.target.checked)}
                                                                   className="rounded border-surface-300 text-brand-500 focus:ring-brand-400" />
                                                            <span className="text-xs text-surface-600">Active</span>
                                                        </label>
                                                        <div className="flex items-center gap-2 pb-0.5">
                                                            <button type="submit" className="btn-primary py-2 text-sm" disabled={edit.processing}>Save</button>
                                                            <button type="button" className="btn-ghost py-2 text-sm" onClick={() => setEditing(null)}>Cancel</button>
                                                        </div>
                                                    </form>
                                                </td>
                                            </tr>
                                        ) : (
                                            <tr key={l.id} className="hover:bg-surface-50/70">
                                                <td className="px-4 py-3 text-surface-400 tabular-nums">{i + 1}</td>
                                                <td className="px-4 py-3">
                                                    <span className="font-medium text-surface-900">{l.label}</span>
                                                    {!l.is_active && <span className="badge-slate ml-2">Hidden</span>}
                                                </td>
                                                <td className="px-4 py-3">
                                                    <a href={l.url} target="_blank" rel="noreferrer"
                                                       className="text-xs text-brand-600 hover:text-brand-700 break-all">{l.url}</a>
                                                </td>
                                                <td className="px-4 py-3 text-surface-500 tabular-nums">{l.sort}</td>
                                                <td className="px-4 py-3">
                                                    <div className="flex items-center justify-end gap-1">
                                                        <button type="button" onClick={() => startEdit(l)} title="Edit"
                                                                className="w-8 h-8 rounded-lg hover:bg-surface-100 text-surface-500 flex items-center justify-center">
                                                            <i className="fi fi-rr-pencil text-xs" />
                                                        </button>
                                                        <button type="button" onClick={() => remove(l)} title="Remove"
                                                                className="w-8 h-8 rounded-lg hover:bg-red-50 text-surface-400 hover:text-red-600 flex items-center justify-center">
                                                            <i className="fi fi-rr-trash text-xs" />
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            )}
                        </div>
                    );
                })}
            </div>

            <form onSubmit={submitAdd} className="card self-start">
                <div className="card-header"><h2 className="font-semibold text-surface-800">Add a link</h2></div>
                <div className="card-body space-y-4">
                    <Field label="Label *" error={add.errors.label}>
                        <input className="form-input" value={add.data.label}
                               onChange={(e) => add.setData('label', e.target.value)} placeholder="ই-জিপি (e-GP)" />
                    </Field>
                    <Field label="URL *" error={add.errors.url}>
                        <input className="form-input" value={add.data.url}
                               onChange={(e) => add.setData('url', e.target.value)} placeholder="https://www.eprocure.gov.bd" />
                    </Field>
                    <Field label="Group" error={add.errors.group}>
                        <select className="form-input capitalize" value={add.data.group}
                                onChange={(e) => add.setData('group', e.target.value)}>
                            {groups.map((g) => <option key={g} value={g}>{GROUP_LABEL[g] ?? g}</option>)}
                        </select>
                    </Field>
                    <Field label="Order" error={add.errors.sort}>
                        <input type="number" min={0} className="form-input" value={add.data.sort}
                               onChange={(e) => add.setData('sort', Number(e.target.value))} />
                    </Field>
                    <button type="submit" className="btn-primary w-full" disabled={add.processing}>
                        {add.processing ? 'Adding…' : 'Add link'}
                    </button>
                </div>
            </form>
        </div>
    );
}
