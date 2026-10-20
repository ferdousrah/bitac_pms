import { Link } from '@inertiajs/react';
import { useCallback, useEffect, useRef, useState } from 'react';

export interface HeroSlide {
    id: number;
    kind: 'image' | 'video' | 'youtube';
    image_url: string | null;
    video_src: string | null;
    embed_url: string | null;
    poster_url: string | null;
    hold_ms: number;
    title: string | null;
    subtitle: string | null;
    cta_label: string | null;
    cta_url: string | null;
}

interface Props {
    slides: HeroSlide[];
    /** Shown on a slide that carries no words of its own. */
    fallbackTitle?: string;
    fallbackSubtitle?: string;
    children?: React.ReactNode;   // the stats strip, which sits on the hero's edge
}

/** An uploaded video holds until it ends; everything else holds for its own `hold_ms`. */
const FADE_MS = 1100;

/**
 * The home page's hero.
 *
 * Cinematic means three things here, and each is a deliberate choice rather
 * than an effect:
 *
 * - **Crossfade, not slide.** Pictures of a workshop have no reading
 *   direction; sliding them sideways draws the eye to the motion instead of
 *   the picture.
 * - **A slow push in (Ken Burns).** A still photograph on a full screen reads
 *   as a dead page; a 1.0 → 1.12 scale over the slide's whole life reads as
 *   footage. It is on the image, never on the text — moving type is unreadable.
 * - **A video slide holds until it ends**, rather than being cut off at a
 *   fixed interval. Footage someone filmed is worth the seconds it takes.
 *
 * ⚠️ It respects `prefers-reduced-motion`: no push in, no auto-advance. For
 * some people this kind of movement is not a style preference.
 */
export default function HeroSlider({ slides, fallbackTitle, fallbackSubtitle, children }: Props) {
    const [index, setIndex] = useState(0);
    const [paused, setPaused] = useState(false);
    const videoRef = useRef<HTMLVideoElement | null>(null);
    const [reduced, setReduced] = useState(false);

    useEffect(() => {
        const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
        const sync = () => setReduced(mq.matches);
        sync();
        mq.addEventListener('change', sync);
        return () => mq.removeEventListener('change', sync);
    }, []);

    const count = slides.length;
    const go = useCallback((n: number) => setIndex(((n % count) + count) % count), [count]);
    const next = useCallback(() => go(index + 1), [go, index]);

    const current = slides[index];
    // An uploaded video is driven by its own `onEnded`, so nothing here cuts
    // it short. ⚠️ A YouTube slide CANNOT say when it has finished without the
    // IFrame Player API — a whole script and a state machine for one number —
    // so it holds for `hold_ms` like an image does.
    const isFileVideo = current?.kind === 'video' && !!current.video_src;
    const isYouTube = current?.kind === 'youtube' && !!current.embed_url;
    const holdMs = current?.hold_ms || 8000;

    useEffect(() => {
        if (count < 2 || paused || reduced || isFileVideo) return;
        const t = window.setTimeout(next, holdMs);
        return () => window.clearTimeout(t);
    }, [count, paused, reduced, isFileVideo, holdMs, next, index]);

    // A hero playing to an empty room is wasted bandwidth and a hot laptop.
    useEffect(() => {
        const onVis = () => setPaused(document.hidden);
        document.addEventListener('visibilitychange', onVis);
        return () => document.removeEventListener('visibilitychange', onVis);
    }, []);

    // Whichever picture is coming next is fetched now, so the crossfade does
    // not reveal a half-loaded photograph.
    useEffect(() => {
        const after = slides[(index + 1) % count];
        const url = after?.image_url ?? after?.poster_url;
        if (url) { const img = new Image(); img.src = url; }
    }, [index, slides, count]);

    useEffect(() => {
        const v = videoRef.current;
        if (!v) return;
        if (paused) { v.pause(); return; }
        if (v.currentTime > 0.1) { v.play().catch(() => {}); return; }
        // Autoplay is refused on some devices however muted the video is; the
        // poster then stands in, which is why every video slide should have one.
        v.play().catch(() => {});
    }, [index, paused]);

    const onKey = (e: React.KeyboardEvent) => {
        if (e.key === 'ArrowRight') { e.preventDefault(); next(); }
        if (e.key === 'ArrowLeft') { e.preventDefault(); go(index - 1); }
    };

    if (!count) return null;

    const title = current.title || fallbackTitle;
    const subtitle = current.subtitle || fallbackSubtitle;

    return (
        <section
            className="relative overflow-hidden bg-brand-950"
            aria-roledescription="carousel"
            aria-label="BITAC"
            tabIndex={0}
            onKeyDown={onKey}
            onMouseEnter={() => setPaused(true)}
            onMouseLeave={() => setPaused(false)}
        >
            {/* ── The media, stacked and crossfaded ───────────────────── */}
            <div className="absolute inset-0">
                {slides.map((s, i) => {
                    const on = i === index;
                    return (
                        <div
                            key={s.id}
                            className="absolute inset-0 transition-opacity ease-out"
                            style={{ opacity: on ? 1 : 0, transitionDuration: `${FADE_MS}ms` }}
                            aria-hidden={!on}
                        >
                            {s.kind === 'youtube' && s.embed_url ? (
                                /* ⚠️ The iframe is deliberately BIGGER than the
                                   frame and cropped. No parameter removes
                                   YouTube's watermark or its title bar —
                                   `modestbranding` has been ignored since 2023
                                   — so the chrome is pushed outside the visible
                                   area, and the whole layer takes no pointer
                                   events so nothing of theirs can be hovered or
                                   clicked. 16:9 sizing (177.78vh × 56.25vw)
                                   covers the band at any aspect ratio. */
                                <div className="absolute inset-0 overflow-hidden pointer-events-none">
                                    {s.poster_url && (
                                        <img src={s.poster_url} alt="" className="absolute inset-0 w-full h-full object-cover" />
                                    )}
                                    {on && (
                                        <iframe
                                            src={s.embed_url}
                                            title=""
                                            tabIndex={-1}
                                            allow="autoplay; encrypted-media; picture-in-picture"
                                            referrerPolicy="strict-origin-when-cross-origin"
                                            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 border-0"
                                            style={{ width: '177.78vh', height: '56.25vw', minWidth: '132%', minHeight: '132%' }}
                                        />
                                    )}
                                </div>
                            ) : s.kind === 'video' && s.video_src ? (
                                <video
                                    ref={on ? videoRef : undefined}
                                    src={s.video_src}
                                    poster={s.poster_url ?? undefined}
                                    muted
                                    playsInline
                                    autoPlay={on}
                                    // One video, one pass, then the next slide —
                                    // looping a slide show never moves on.
                                    onEnded={count > 1 ? next : undefined}
                                    loop={count === 1}
                                    preload={on ? 'auto' : 'none'}
                                    className="w-full h-full object-cover"
                                />
                            ) : s.image_url ? (
                                <img
                                    src={s.image_url}
                                    alt=""
                                    loading={i === 0 ? 'eager' : 'lazy'}
                                    className="w-full h-full object-cover will-change-transform"
                                    style={reduced ? undefined : {
                                        transform: on ? 'scale(1.12)' : 'scale(1)',
                                        transition: `transform ${holdMs + FADE_MS * 2}ms linear`,
                                    }}
                                />
                            ) : null}
                        </div>
                    );
                })}
            </div>

            {/* ⚠️ The scrim is not decoration — white type over a photograph
                nobody has seen yet is unreadable on half of them. It is
                heaviest on the left, where the words are. */}
            <div className="absolute inset-0 bg-gradient-to-r from-brand-950/95 via-brand-950/75 to-brand-950/30" />
            <div className="absolute inset-0 bg-gradient-to-t from-brand-950 via-transparent to-brand-950/50" />

            {/* ── The words ───────────────────────────────────────────── */}
            <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24 sm:py-32 lg:py-40">
                <div className="max-w-3xl" key={index}>
                    <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/10 text-brand-200 text-[11px] font-bold uppercase tracking-[0.15em] mb-6 backdrop-blur animate-fade-in">
                        <i className="fi fi-rr-industry-windows text-[11px] leading-none" />
                        Since 1962 · Government of Bangladesh
                    </div>
                    {title && (
                        <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-white leading-[1.1] animate-fade-in">
                            {title}
                        </h1>
                    )}
                    {subtitle && (
                        <p className="text-base sm:text-lg text-white/75 mt-6 leading-relaxed max-w-2xl animate-fade-in">
                            {subtitle}
                        </p>
                    )}
                    <div className="mt-9 flex flex-wrap items-center gap-3 animate-fade-in">
                        {current.cta_label && current.cta_url ? (
                            <CtaLink href={current.cta_url} className="bg-brand-500 hover:bg-brand-600 text-white shadow-lg shadow-brand-900/40">
                                {current.cta_label}
                                <i className="fi fi-rr-arrow-small-right text-base leading-none" />
                            </CtaLink>
                        ) : (
                            <CtaLink href="/portfolio/services" className="bg-brand-500 hover:bg-brand-600 text-white shadow-lg shadow-brand-900/40">
                                Our Services
                                <i className="fi fi-rr-arrow-small-right text-base leading-none" />
                            </CtaLink>
                        )}
                        <CtaLink href="/portfolio/contact" className="bg-white/10 hover:bg-white/20 text-white backdrop-blur">
                            <i className="fi fi-rr-envelope text-sm leading-none" />
                            Contact Us
                        </CtaLink>
                    </div>
                </div>
            </div>

            {/* ── Controls ────────────────────────────────────────────── */}
            {count > 1 && (
                <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-8 flex items-center justify-between gap-6">
                    {/* Bars rather than dots: a bar can show how far through the
                        slide you are, and a dot cannot. */}
                    <div className="flex items-center gap-2">
                        {slides.map((s, i) => (
                            <button
                                key={s.id}
                                type="button"
                                onClick={() => go(i)}
                                aria-label={`Slide ${i + 1}`}
                                aria-current={i === index}
                                className="group h-1.5 rounded-full bg-white/25 hover:bg-white/40 transition-all"
                                style={{ width: i === index ? 48 : 20 }}
                            >
                                {i === index && !reduced && !isFileVideo && !paused && (
                                    <span
                                        key={`${index}-fill`}
                                        className="block h-full rounded-full bg-white origin-left hero-progress"
                                        style={{ animationDuration: `${holdMs}ms` }}
                                    />
                                )}
                                {i === index && (reduced || isFileVideo || paused) && (
                                    <span className="block h-full w-full rounded-full bg-white" />
                                )}
                            </button>
                        ))}
                    </div>

                    <div className="flex items-center gap-2">
                        <span className="text-[11px] text-white/50 tabular-nums mr-1">
                            {String(index + 1).padStart(2, '0')} / {String(count).padStart(2, '0')}
                        </span>
                        <Arrow label="Previous slide" icon="fi-rr-angle-small-left" onClick={() => go(index - 1)} />
                        <Arrow label="Next slide" icon="fi-rr-angle-small-right" onClick={next} />
                    </div>
                </div>
            )}

            {children}
        </section>
    );
}

/** An internal route goes through Inertia; anything else is a plain link. */
function CtaLink({ href, className, children }: { href: string; className: string; children: React.ReactNode }) {
    const classes = `inline-flex items-center gap-2 px-5 py-3 rounded-xl text-sm font-bold transition-colors ${className}`;
    return href.startsWith('/') && !href.startsWith('//')
        ? <Link href={href} className={classes}>{children}</Link>
        : <a href={href} target="_blank" rel="noopener noreferrer" className={classes}>{children}</a>;
}

function Arrow({ label, icon, onClick }: { label: string; icon: string; onClick: () => void }) {
    return (
        <button
            type="button"
            onClick={onClick}
            aria-label={label}
            className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/25 text-white flex items-center justify-center backdrop-blur transition-colors"
        >
            <i className={`fi ${icon} text-base leading-none`} />
        </button>
    );
}
