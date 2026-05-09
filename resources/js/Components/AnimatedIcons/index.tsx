/**
 * Animated Lucide-based icons.
 *
 * Each component wraps a Lucide icon in a `motion` component so we can
 * trigger keyframes on hover, tap, mount, or via a `play` prop.
 *
 * Usage:
 *   <BellRing className="w-5 h-5 text-amber-500" play={hasUnread} />
 *   <CloudDownload className="w-4 h-4" />   // animates on hover
 *
 * All icons accept the standard Lucide props (size, strokeWidth, color, ...).
 */

import { AnimatePresence, motion, useAnimation, useReducedMotion } from 'motion/react';
import {
    Bell,
    Clock,
    Cloud,
    CloudDownload as LucideCloudDownload,
    Cog,
    Download,
    Loader2,
    Moon,
    Receipt,
    ShieldCheck,
    Sparkles as LucideSparkles,
    Sun,
    TriangleAlert,
    Truck,
    Zap,
    type LucideProps,
} from 'lucide-react';
import { useEffect } from 'react';

/* ─── Bell that rings when `play` flips true ────────────────────── */
export function BellRing({ play, ...props }: LucideProps & { play?: boolean }) {
    const controls = useAnimation();
    const reduce = useReducedMotion();

    useEffect(() => {
        if (reduce) return;
        if (play) {
            controls.start({
                rotate: [0, -18, 18, -14, 14, -8, 8, 0],
                transition: { duration: 0.9, ease: 'easeInOut' },
            });
        }
    }, [play, controls, reduce]);

    const wobble = reduce ? {} : { rotate: [0, -10, 10, -6, 6, 0], transition: { duration: 0.5, ease: 'easeInOut' as const } };

    return (
        <motion.span
            animate={controls}
            style={{ display: 'inline-flex', transformOrigin: 'top center' }}
            variants={{ hover: wobble }}
            whileHover={wobble}
        >
            <Bell {...props} />
        </motion.span>
    );
}

/* ─── Cloud-download that bounces on hover (own + parent) ───────── */
/* Uses both `whileHover` (direct hover) AND a `hover` variant
   that's triggered by a parent motion component with `whileHover="hover"`. */
export function CloudDownload(props: LucideProps) {
    const reduce = useReducedMotion();
    const bounce = reduce ? {} : {
        y: [0, -3, 0, -3, 0],
        transition: { duration: 0.7, ease: 'easeOut' as const },
    };
    return (
        <motion.span
            style={{ display: 'inline-flex' }}
            variants={{ hover: bounce }}
            whileHover={bounce}
        >
            <LucideCloudDownload {...props} />
        </motion.span>
    );
}

/* ─── Standalone download arrow (bounces down on hover) ─────────── */
export function DownloadBounce(props: LucideProps) {
    const reduce = useReducedMotion();
    return (
        <motion.span
            style={{ display: 'inline-flex' }}
            whileHover={reduce ? undefined : {
                y: [0, 2, -1, 0],
                transition: { duration: 0.5, ease: 'easeOut' as const },
            }}
        >
            <Download {...props} />
        </motion.span>
    );
}

/* ─── Sun / Moon swap with rotation (uses AnimatePresence) ──────── */
export function SunMoon({ mood, ...props }: LucideProps & { mood: 'day' | 'night' }) {
    const reduce = useReducedMotion();
    const Icon = mood === 'day' ? Sun : Moon;

    if (reduce) {
        return <span style={{ display: 'inline-flex' }}><Icon {...props} /></span>;
    }

    return (
        <span style={{ display: 'inline-flex', position: 'relative' }}>
            <AnimatePresence mode="wait" initial={false}>
                <motion.span
                    key={mood}
                    initial={{ rotate: -180, scale: 0.3, opacity: 0 }}
                    animate={{ rotate: 0,    scale: 1,   opacity: 1 }}
                    exit={{    rotate: 180,  scale: 0.3, opacity: 0 }}
                    transition={{ type: 'spring', stiffness: 240, damping: 16 }}
                    style={{ display: 'inline-flex' }}
                >
                    <Icon {...props} />
                </motion.span>
            </AnimatePresence>
        </span>
    );
}

/* ─── Sparkles that twinkle on mount + hover ────────────────────── */
export function Sparkles(props: LucideProps) {
    const reduce = useReducedMotion();
    return (
        <motion.span
            initial={reduce ? false : { scale: 0.6, opacity: 0, rotate: -20 }}
            animate={{ scale: 1, opacity: 1, rotate: 0 }}
            transition={{ type: 'spring', stiffness: 200, damping: 12 }}
            whileHover={reduce ? undefined : { rotate: [0, -8, 8, -4, 4, 0], transition: { duration: 0.6, ease: 'easeInOut' as const } }}
            style={{ display: 'inline-flex' }}
        >
            <LucideSparkles {...props} />
        </motion.span>
    );
}

/* ─── Continuous spinner (Lucide Loader2) ───────────────────────── */
export function Spinner(props: LucideProps) {
    return (
        <motion.span
            animate={{ rotate: 360 }}
            transition={{ duration: 0.9, ease: 'linear', repeat: Infinity }}
            style={{ display: 'inline-flex' }}
        >
            <Loader2 {...props} />
        </motion.span>
    );
}

/* ─── Lightning bolt that flashes on hover ──────────────────────── */
export function Lightning(props: LucideProps) {
    const reduce = useReducedMotion();
    return (
        <motion.span
            whileHover={reduce ? undefined : {
                scale:    [1, 1.25, 0.95, 1.1, 1],
                rotate:   [0, -8, 8, -4, 0],
                filter:   ['drop-shadow(0 0 0 rgba(250,204,21,0))', 'drop-shadow(0 0 8px rgba(250,204,21,0.8))', 'drop-shadow(0 0 0 rgba(250,204,21,0))'],
                transition: { duration: 0.6, ease: 'easeOut' as const },
            }}
            style={{ display: 'inline-flex' }}
        >
            <Zap {...props} />
        </motion.span>
    );
}

/* ─── A "live cloud" that breathes (for connection-status pulse) ── */
export function PulseCloud(props: LucideProps) {
    const reduce = useReducedMotion();
    return (
        <motion.span
            animate={reduce ? undefined : { scale: [1, 1.08, 1], opacity: [0.85, 1, 0.85] }}
            transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' as const }}
            style={{ display: 'inline-flex' }}
        >
            <Cloud {...props} />
        </motion.span>
    );
}

/* ─── Stat-card icons (for KPI tiles) ─────────────────────────── */
/* Each animates on hover. Animations are inspired by icons.pqoqubbw.dev
   — full rotations and bigger movements rather than subtle wobbles.
   They have `variants={{ hover: ... }}` so a parent motion element with
   whileHover="hover" can drive them, plus inline `whileHover` for
   direct icon hover. */

export function SpinningCog(props: LucideProps) {
    const reduce = useReducedMotion();
    const spin = reduce ? {} : {
        rotate: 360,
        transition: { duration: 1.1, ease: 'easeInOut' as const },
    };
    return (
        <motion.span
            style={{ display: 'inline-flex', transformOrigin: '50% 50%' }}
            variants={{ hover: spin }}
            whileHover={spin}
        >
            <Cog {...props} />
        </motion.span>
    );
}

export function DrivingTruck(props: LucideProps) {
    const reduce = useReducedMotion();
    const drive = reduce ? {} : {
        x: [0, -6, 6, -3, 3, 0],
        transition: { duration: 1, ease: 'easeInOut' as const },
    };
    return (
        <motion.span
            style={{ display: 'inline-flex' }}
            variants={{ hover: drive }}
            whileHover={drive}
        >
            <Truck {...props} />
        </motion.span>
    );
}

export function PoppingShield(props: LucideProps) {
    const reduce = useReducedMotion();
    const pop = reduce ? {} : {
        scale: [1, 1.25, 0.92, 1.12, 1],
        rotate: [0, -8, 8, -3, 0],
        transition: { duration: 0.9, ease: 'easeOut' as const },
    };
    return (
        <motion.span
            style={{ display: 'inline-flex', transformOrigin: '50% 50%' }}
            variants={{ hover: pop }}
            whileHover={pop}
        >
            <ShieldCheck {...props} />
        </motion.span>
    );
}

/* Clock — full 360° rotation like a clock hand sweeping a cycle */
export function TickingClock(props: LucideProps) {
    const reduce = useReducedMotion();
    const tick = reduce ? {} : {
        rotate: 360,
        transition: { duration: 1.1, ease: 'easeInOut' as const },
    };
    return (
        <motion.span
            style={{ display: 'inline-flex', transformOrigin: '50% 50%' }}
            variants={{ hover: tick }}
            whileHover={tick}
        >
            <Clock {...props} />
        </motion.span>
    );
}

export function ShakingAlert(props: LucideProps) {
    const reduce = useReducedMotion();
    const shake = reduce ? {} : {
        x: [0, -4, 4, -4, 4, -2, 2, 0],
        rotate: [0, -6, 6, -4, 4, -2, 2, 0],
        transition: { duration: 0.7, ease: 'easeInOut' as const },
    };
    return (
        <motion.span
            style={{ display: 'inline-flex' }}
            variants={{ hover: shake }}
            whileHover={shake}
        >
            <TriangleAlert {...props} />
        </motion.span>
    );
}

export function FlippingReceipt(props: LucideProps) {
    const reduce = useReducedMotion();
    const flip = reduce ? {} : {
        rotateY: [0, 360],
        transition: { duration: 1, ease: 'easeInOut' as const },
    };
    return (
        <motion.span
            style={{ display: 'inline-flex', transformOrigin: '50% 50%' }}
            variants={{ hover: flip }}
            whileHover={flip}
        >
            <Receipt {...props} />
        </motion.span>
    );
}
