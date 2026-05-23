import { router } from '@inertiajs/react';
import { useEffect, useRef, useState } from 'react';
import { motion } from 'motion/react';
import { SunMoon, CloudDownload, Sparkles } from '@/Components/AnimatedIcons';

/* ─── Types ──────────────────────────────────────────────────────── */
interface KPICard { key: string; value: number; label: string; color: string; alert: boolean }

interface ActiveJob {
    id: number; wo_number: string; job_number: number | null; product: string; customer: string;
    current_step: string; work_centre: string; operator: string;
    started_at: string | null; estimated_hours: number;
    status: string; status_label: string; due_date: string | null; is_overdue: boolean;
}

interface WorkCentreStatus {
    id: number; name: string; total_machines: number; active_machines: number;
    active_jobs: { wo_number: string; product: string; operator: string }[];
    status_color: string;
}

interface Alert { id: number; action: string; message: string; color: string; time: string; timestamp: string }

interface RevenuePoint { date: string; day: string; value: number; pct: number }

interface Financial {
    invoiced_today: number; invoiced_month: number; outstanding: number;
    quoted_month: number; converted_month: number; conversion_rate: number;
    approved_quotes: number; pending_quotes: number; revenue_trend: RevenuePoint[];
}

interface CriticalMachine {
    id: number; name: string; code: string; work_centre: string;
    health_score: number; health_label: string; state: string; state_color: string;
}

interface MaintenanceDue {
    id: number; name: string; code: string;
    days_left: number; overdue: boolean; next_date: string | null;
}

interface MachinesData {
    total: number;
    state_breakdown: { running: number; idle: number; setup: number; maintenance: number; breakdown: number; offline: number };
    avg_health: number;
    critical_machines: CriticalMachine[];
    maintenance_due: MaintenanceDue[];
    downtime_today_h: number; downtime_week_h: number;
    utilization_pct: number;
}

interface Props {
    kpi_cards: KPICard[];
    financial: Financial;
    machines_data: MachinesData;
    active_jobs: ActiveJob[];
    work_centre_status: WorkCentreStatus[];
    recent_alerts: Alert[];
    last_updated: string;
}

/* ─── Theme tokens ───────────────────────────────────────────────── */
type Mood = 'night' | 'day';

const T = {
    night: {
        page:           'bg-gradient-to-br from-surface-950 via-surface-900 to-surface-950 text-white',
        header:         'border-b border-surface-800/80 bg-surface-900/70 backdrop-blur-xl',
        headerDivider:  'border-surface-700/60',
        title:          'text-white',
        titleAccent:    'text-brand-300',
        titleSep:       'text-surface-500',
        subtitle:       'text-surface-400',
        clock:          'text-white',
        meta:           'text-surface-400',
        metaLabel:      'text-surface-500',
        cardBg:         'bg-surface-800/70 backdrop-blur-xl',
        cardBorder:     'border-surface-700/60',
        cardSection:    'bg-surface-900/60 border-surface-700/60',
        sectionTitle:   'text-white',
        sectionSubtitle:'text-surface-400',
        sectionDivider: 'border-surface-700/60',
        label:          'text-surface-400',
        labelMuted:     'text-surface-500',
        text:           'text-surface-200',
        textMuted:      'text-surface-400',
        textStrong:     'text-white',
        kpiTrack:       'rgba(255,255,255,0.05)',
        donutTrack:     'rgba(255,255,255,0.05)',
        gaugeTrack:     'rgba(255,255,255,0.05)',
        barTrack:       'bg-surface-700/60',
        rowSubtle:      'bg-surface-800/60 border-surface-700/40',
        rowHover:       'hover:bg-surface-900/40',
        tableHead:      'bg-surface-900/80 backdrop-blur-xl text-surface-400',
        tableDivider:   'divide-surface-700/60',
        chipBlue:       'bg-blue-500/20 text-blue-300 ring-1 ring-blue-500/30',
        chipAmber:      'bg-amber-500/20 text-amber-300 ring-1 ring-amber-500/30',
        toggleBg:       'bg-surface-800/70 border-surface-700/60 hover:border-surface-600 text-surface-300',
        footer:         'text-surface-600',
    },
    day: {
        page:           'bg-gradient-to-br from-orange-50 via-sky-50 to-indigo-50 text-surface-900',
        header:         'border-b border-white bg-white/70 backdrop-blur-2xl shadow-[0_4px_20px_-8px_rgba(255,122,15,0.15)]',
        headerDivider:  'border-slate-300',
        title:          'text-surface-900',
        titleAccent:    'bg-gradient-to-r from-brand-500 to-brand-700 bg-clip-text text-transparent',
        titleSep:       'text-slate-300',
        subtitle:       'text-slate-500',
        clock:          'bg-gradient-to-br from-slate-900 to-slate-700 bg-clip-text text-transparent',
        meta:           'text-slate-500',
        metaLabel:      'text-slate-400',
        cardBg:         'bg-gradient-to-br from-white via-white to-slate-50/80 backdrop-blur-xl',
        cardBorder:     'border-white shadow-[0_8px_30px_-8px_rgba(15,23,42,0.12)]',
        cardSection:    'bg-gradient-to-br from-white to-slate-50/60 border-slate-200/70',
        sectionTitle:   'text-surface-900',
        sectionSubtitle:'text-slate-500',
        sectionDivider: 'border-slate-200/70',
        label:          'text-slate-500',
        labelMuted:     'text-slate-400',
        text:           'text-slate-700',
        textMuted:      'text-slate-500',
        textStrong:     'text-surface-900',
        kpiTrack:       'rgba(15,23,42,0.06)',
        donutTrack:     'rgba(15,23,42,0.06)',
        gaugeTrack:     'rgba(15,23,42,0.06)',
        barTrack:       'bg-slate-200',
        rowSubtle:      'bg-white border-slate-200',
        rowHover:       'hover:bg-slate-50',
        tableHead:      'bg-slate-50 text-slate-500',
        tableDivider:   'divide-slate-200',
        chipBlue:       'bg-blue-100 text-blue-700 ring-1 ring-blue-300',
        chipAmber:      'bg-amber-100 text-amber-700 ring-1 ring-amber-300',
        toggleBg:       'bg-white border-slate-200 hover:border-slate-300 text-slate-600 shadow-md',
        footer:         'text-slate-400',
    },
};

/* ─── KPI / state palettes (work in both modes) ──────────────────── */
const kpiTheme = {
    night: {
        blue:   { ring: 'ring-blue-500/40',    text: 'text-blue-300',    glow: 'from-blue-500/20 to-blue-500/0',       icon: 'fi-rr-settings',         bar: 'bg-blue-500' },
        green:  { ring: 'ring-emerald-500/40', text: 'text-emerald-300', glow: 'from-emerald-500/20 to-emerald-500/0', icon: 'fi-rr-check-circle',     bar: 'bg-emerald-500' },
        amber:  { ring: 'ring-amber-500/40',   text: 'text-amber-300',   glow: 'from-amber-500/20 to-amber-500/0',     icon: 'fi-rr-shield-check',     bar: 'bg-amber-500' },
        red:    { ring: 'ring-red-500/40',     text: 'text-red-300',     glow: 'from-red-500/20 to-red-500/0',         icon: 'fi-rr-triangle-warning', bar: 'bg-red-500' },
        teal:   { ring: 'ring-teal-500/40',    text: 'text-teal-300',    glow: 'from-teal-500/20 to-teal-500/0',       icon: 'fi-rr-box',              bar: 'bg-teal-500' },
        orange: { ring: 'ring-orange-500/40',  text: 'text-orange-300',  glow: 'from-orange-500/20 to-orange-500/0',   icon: 'fi-rr-clock',            bar: 'bg-orange-500' },
    },
    day: {
        blue:   { ring: 'ring-blue-300',    text: 'text-blue-700',    glow: 'from-blue-100 to-transparent',    icon: 'fi-rr-settings',         bar: 'bg-gradient-to-r from-blue-500 to-cyan-400' },
        green:  { ring: 'ring-emerald-300', text: 'text-emerald-700', glow: 'from-emerald-100 to-transparent', icon: 'fi-rr-check-circle',     bar: 'bg-gradient-to-r from-emerald-500 to-green-400' },
        amber:  { ring: 'ring-amber-300',   text: 'text-amber-700',   glow: 'from-amber-100 to-transparent',   icon: 'fi-rr-shield-check',     bar: 'bg-gradient-to-r from-amber-500 to-yellow-400' },
        red:    { ring: 'ring-red-300',     text: 'text-red-700',     glow: 'from-red-100 to-transparent',     icon: 'fi-rr-triangle-warning', bar: 'bg-gradient-to-r from-red-500 to-rose-400' },
        teal:   { ring: 'ring-teal-300',    text: 'text-teal-700',    glow: 'from-teal-100 to-transparent',    icon: 'fi-rr-box',              bar: 'bg-gradient-to-r from-teal-500 to-cyan-400' },
        orange: { ring: 'ring-orange-300',  text: 'text-orange-700',  glow: 'from-orange-100 to-transparent',  icon: 'fi-rr-clock',            bar: 'bg-gradient-to-r from-orange-500 to-amber-400' },
    },
} as const;

const dayHoverShadow: Record<string, string> = {
    blue:   'hover:shadow-[0_20px_40px_-12px_rgba(59,130,246,0.45)]',
    green:  'hover:shadow-[0_20px_40px_-12px_rgba(16,185,129,0.45)]',
    amber:  'hover:shadow-[0_20px_40px_-12px_rgba(245,158,11,0.45)]',
    red:    'hover:shadow-[0_20px_40px_-12px_rgba(239,68,68,0.45)]',
    teal:   'hover:shadow-[0_20px_40px_-12px_rgba(20,184,166,0.45)]',
    orange: 'hover:shadow-[0_20px_40px_-12px_rgba(249,115,22,0.45)]',
};

const stateTheme = {
    night: {
        running:     { bg: 'bg-emerald-500/15', text: 'text-emerald-300', dot: 'bg-emerald-500',  label: 'Running' },
        idle:        { bg: 'bg-blue-500/15',    text: 'text-blue-300',    dot: 'bg-blue-500',     label: 'Idle' },
        setup:       { bg: 'bg-amber-500/15',   text: 'text-amber-300',   dot: 'bg-amber-500',    label: 'Setup' },
        maintenance: { bg: 'bg-purple-500/15',  text: 'text-purple-300',  dot: 'bg-purple-500',   label: 'Maintenance' },
        breakdown:   { bg: 'bg-red-500/15',     text: 'text-red-300',     dot: 'bg-red-500',      label: 'Breakdown' },
        offline:     { bg: 'bg-slate-500/15',   text: 'text-slate-300',   dot: 'bg-slate-500',    label: 'Offline' },
    },
    day: {
        running:     { bg: 'bg-emerald-100', text: 'text-emerald-700', dot: 'bg-emerald-500',  label: 'Running' },
        idle:        { bg: 'bg-blue-100',    text: 'text-blue-700',    dot: 'bg-blue-500',     label: 'Idle' },
        setup:       { bg: 'bg-amber-100',   text: 'text-amber-700',   dot: 'bg-amber-500',    label: 'Setup' },
        maintenance: { bg: 'bg-purple-100',  text: 'text-purple-700',  dot: 'bg-purple-500',   label: 'Maintenance' },
        breakdown:   { bg: 'bg-red-100',     text: 'text-red-700',     dot: 'bg-red-500',      label: 'Breakdown' },
        offline:     { bg: 'bg-slate-200',   text: 'text-slate-700',   dot: 'bg-slate-500',    label: 'Offline' },
    },
} as const;

const alertBorder: Record<string, string> = {
    green: 'border-l-emerald-500',
    red:   'border-l-red-500',
    amber: 'border-l-amber-500',
    blue:  'border-l-blue-500',
};

/* ─── Helpers ────────────────────────────────────────────────────── */
function formatBDT(amount: number): string {
    if (amount >= 10000000) return `৳${(amount / 10000000).toFixed(2)} Cr`;
    if (amount >= 100000)   return `৳${(amount / 100000).toFixed(2)} L`;
    if (amount >= 1000)     return `৳${(amount / 1000).toFixed(1)} K`;
    return `৳${Math.round(amount)}`;
}

function useElapsedSeconds(startedAt: string | null): number {
    const [elapsed, setElapsed] = useState(0);
    useEffect(() => {
        if (!startedAt) return;
        const start = new Date(startedAt).getTime();
        const update = () => setElapsed(Math.floor((Date.now() - start) / 1000));
        update();
        const timer = setInterval(update, 1000);
        return () => clearInterval(timer);
    }, [startedAt]);
    return elapsed;
}

function ElapsedTimer({ startedAt, estimatedHours, mood }: { startedAt: string | null; estimatedHours: number; mood: Mood }) {
    const elapsed = useElapsedSeconds(startedAt);
    const estimatedSeconds = estimatedHours * 3600;
    const ratio = estimatedSeconds > 0 ? elapsed / estimatedSeconds : 0;
    const h = Math.floor(elapsed / 3600);
    const m = Math.floor((elapsed % 3600) / 60);
    const s = elapsed % 60;
    const formatted = `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
    const color = mood === 'night'
        ? (ratio < 1 ? 'text-emerald-300' : ratio < 1.2 ? 'text-amber-300' : 'text-red-300')
        : (ratio < 1 ? 'text-emerald-600' : ratio < 1.2 ? 'text-amber-600' : 'text-red-600');
    return <span className={`font-mono font-bold ${color}`}>{formatted}</span>;
}

function getJobRowColor(job: ActiveJob, estimatedHours: number, startedAt: string | null, mood: Mood): string {
    if (job.status === 'qc_hold') {
        return mood === 'night' ? 'border-l-4 border-l-blue-500 bg-blue-950/40' : 'border-l-4 border-l-blue-500 bg-blue-50';
    }
    if (!startedAt) return mood === 'night' ? 'border-l-4 border-l-surface-600' : 'border-l-4 border-l-slate-300';
    const elapsed = (Date.now() - new Date(startedAt).getTime()) / 3600000;
    if (elapsed > estimatedHours * 1.2) return mood === 'night' ? 'border-l-4 border-l-red-500 bg-red-950/40' : 'border-l-4 border-l-red-500 bg-red-50';
    if (elapsed > estimatedHours)       return mood === 'night' ? 'border-l-4 border-l-amber-500 bg-amber-950/40' : 'border-l-4 border-l-amber-500 bg-amber-50';
    return mood === 'night' ? 'border-l-4 border-l-emerald-500 bg-emerald-950/30' : 'border-l-4 border-l-emerald-500 bg-emerald-50';
}

/* ─── Section header ─────────────────────────────────────────────── */
function SectionHeader({ icon, color, title, subtitle, action, t }: {
    icon: string; color: string; title: string; subtitle?: string; action?: React.ReactNode; t: typeof T['night'];
}) {
    return (
        <div className={`px-3 sm:px-5 py-3 sm:py-3.5 flex items-center justify-between gap-2 border-b ${t.sectionDivider}`}>
            <div className="flex items-center gap-2.5 sm:gap-3 min-w-0 flex-1">
                <div className={`w-8 h-8 sm:w-9 sm:h-9 rounded-xl flex items-center justify-center shrink-0 ${color}`}>
                    <i className={`fi ${icon} leading-none text-sm sm:text-base`} />
                </div>
                <div className="min-w-0">
                    <h2 className={`text-sm sm:text-base font-semibold leading-tight truncate ${t.sectionTitle}`}>{title}</h2>
                    {subtitle && <div className={`hidden sm:block text-[11px] mt-0.5 truncate ${t.sectionSubtitle}`}>{subtitle}</div>}
                </div>
            </div>
            {action && <div className="shrink-0">{action}</div>}
        </div>
    );
}

/* ─── Donut chart ────────────────────────────────────────────────── */
function StateDonut({ data, total, t }: { data: MachinesData['state_breakdown']; total: number; t: typeof T['night'] }) {
    const r = 56;
    const c = 2 * Math.PI * r;
    const segments = [
        { key: 'running',     val: data.running,     color: '#10b981' },
        { key: 'idle',        val: data.idle,        color: '#3b82f6' },
        { key: 'setup',       val: data.setup,       color: '#f59e0b' },
        { key: 'maintenance', val: data.maintenance, color: '#a855f7' },
        { key: 'breakdown',   val: data.breakdown,   color: '#ef4444' },
        { key: 'offline',     val: data.offline,     color: '#64748b' },
    ];
    let offset = 0;
    return (
        <div className="relative w-36 h-36 shrink-0">
            <svg viewBox="0 0 140 140" className="-rotate-90">
                <circle cx="70" cy="70" r={r} fill="none" stroke={t.donutTrack} strokeWidth="14" />
                {total > 0 && segments.map(seg => {
                    if (seg.val === 0) return null;
                    const len = (seg.val / total) * c;
                    const dasharray = `${len} ${c - len}`;
                    const el = (
                        <circle key={seg.key} cx="70" cy="70" r={r}
                            fill="none" stroke={seg.color} strokeWidth="14"
                            strokeDasharray={dasharray} strokeDashoffset={-offset} strokeLinecap="butt" />
                    );
                    offset += len;
                    return el;
                })}
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
                <div className={`text-3xl font-bold tabular-nums leading-none ${t.textStrong}`}>{total}</div>
                <div className={`text-[10px] uppercase tracking-wider mt-1 ${t.label}`}>Machines</div>
            </div>
        </div>
    );
}

/* ─── Health gauge ───────────────────────────────────────────────── */
function HealthGauge({ score, t }: { score: number; t: typeof T['night'] }) {
    const angle = (score / 100) * 180;
    const r = 50, cx = 60, cy = 60;
    const a1 = ((180 - angle) * Math.PI) / 180;
    const x = cx + r * Math.cos(a1);
    const y = cy - r * Math.sin(a1);
    const largeArc = angle > 180 ? 1 : 0;
    const color = score >= 80 ? '#10b981' : score >= 60 ? '#3b82f6' : score >= 40 ? '#f59e0b' : score >= 20 ? '#f97316' : '#ef4444';
    const label = score >= 80 ? 'Excellent' : score >= 60 ? 'Good' : score >= 40 ? 'Fair' : score >= 20 ? 'Poor' : 'Critical';
    return (
        <div className="relative w-36 h-24 shrink-0">
            <svg viewBox="0 0 120 70">
                <path d={`M 10 60 A ${r} ${r} 0 0 1 110 60`} fill="none" stroke={t.gaugeTrack} strokeWidth="10" strokeLinecap="round" />
                {score > 0 && (
                    <path d={`M 10 60 A ${r} ${r} 0 ${largeArc} 1 ${x} ${y}`} fill="none" stroke={color} strokeWidth="10" strokeLinecap="round" />
                )}
            </svg>
            <div className="absolute inset-x-0 bottom-1 flex flex-col items-center">
                <div className={`text-3xl font-bold tabular-nums leading-none ${t.textStrong}`}>{score}<span className={`text-sm ${t.label}`}>/100</span></div>
                <div className={`text-[10px] uppercase tracking-wider mt-0.5 ${t.label}`}>{label}</div>
            </div>
        </div>
    );
}

/* ─── Financial mini-stat ────────────────────────────────────────── */
function FinStat({ icon, label, value, accent, sublabel, t }: {
    icon: string; label: string; value: string; accent: string; sublabel?: string; t: typeof T['night'];
}) {
    return (
        <div className={`group rounded-xl p-3 sm:p-4 border transition-all duration-300 ease-out cursor-default
                        hover:-translate-y-0.5 hover:shadow-lg hover:shadow-black/5 hover:border-brand-400/60
                        ${t.cardSection}`}>
            <div className="flex items-center gap-1.5 sm:gap-2 mb-1.5 sm:mb-2">
                <i className={`fi ${icon} text-xs sm:text-sm leading-none ${accent} transition-transform duration-300 group-hover:scale-110 shrink-0`} />
                <span className={`text-[9px] sm:text-[10px] font-bold uppercase tracking-wider truncate ${t.label}`}>{label}</span>
            </div>
            <div className={`text-xl sm:text-2xl font-bold tabular-nums leading-none ${accent}`}>{value}</div>
            {sublabel && <div className={`text-[10px] sm:text-[11px] mt-1 sm:mt-1.5 truncate ${t.labelMuted}`}>{sublabel}</div>}
        </div>
    );
}

/* ─── Install (PWA) button ───────────────────────────────────────── */
type BIPEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }> };

function InstallButton({ mood, t }: { mood: Mood; t: typeof T['night'] }) {
    const [deferred, setDeferred] = useState<BIPEvent | null>(null);
    const [installed, setInstalled] = useState(false);
    const [isIos, setIsIos] = useState(false);
    const [showIosTip, setShowIosTip] = useState(false);

    useEffect(() => {
        // iOS detection (no beforeinstallprompt support)
        const ua = window.navigator.userAgent.toLowerCase();
        const ios = /iphone|ipad|ipod/.test(ua) && !(window as any).MSStream;
        setIsIos(ios);

        // Already installed (running in standalone mode)?
        const standalone = window.matchMedia('(display-mode: standalone)').matches
            || (window.navigator as any).standalone === true;
        setInstalled(standalone);

        const onPrompt = (e: Event) => {
            e.preventDefault();
            setDeferred(e as BIPEvent);
        };
        const onInstalled = () => { setInstalled(true); setDeferred(null); };

        window.addEventListener('beforeinstallprompt', onPrompt);
        window.addEventListener('appinstalled', onInstalled);
        return () => {
            window.removeEventListener('beforeinstallprompt', onPrompt);
            window.removeEventListener('appinstalled', onInstalled);
        };
    }, []);

    if (installed) return null;

    const handleClick = async () => {
        if (deferred) {
            await deferred.prompt();
            await deferred.userChoice;
            setDeferred(null);
        } else if (isIos) {
            setShowIosTip(true);
        }
    };

    // Don't render if browser doesn't support installation and isn't iOS
    if (!deferred && !isIos) return null;

    return (
        <>
            <motion.button
                whileHover="hover"
                onClick={handleClick}
                title="Install BITAC Live Operations app"
                className={`group relative flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3.5 py-1.5 sm:py-2 rounded-xl border text-[10px] sm:text-xs font-bold uppercase tracking-wider
                            transition-all duration-300 ease-out hover:-translate-y-0.5 active:scale-95
                            ${mood === 'night'
                                ? 'bg-brand-500/15 border-brand-500/40 text-brand-300 hover:bg-brand-500/25 hover:border-brand-400/70 hover:shadow-[0_8px_24px_-8px_rgba(255,122,15,0.6)]'
                                : 'bg-gradient-to-br from-brand-500 to-brand-600 border-brand-400 text-white shadow-[0_6px_18px_-4px_rgba(255,122,15,0.5)] hover:shadow-[0_10px_28px_-6px_rgba(255,122,15,0.7)] hover:from-brand-400 hover:to-brand-500'}`}
            >
                <CloudDownload className="w-4 h-4" strokeWidth={2.4} />
                <span className="hidden sm:inline">Install App</span>
                <span className="sm:hidden">Install</span>
            </motion.button>

            {showIosTip && (
                <div
                    className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-4"
                    onClick={() => setShowIosTip(false)}
                >
                    <div
                        className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-2xl"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="flex items-center gap-3 mb-3">
                            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-brand-400 to-brand-600 flex items-center justify-center text-white">
                                <CloudDownload className="w-5 h-5" strokeWidth={2.4} />
                            </div>
                            <div>
                                <h3 className="font-bold text-surface-900">Install on iOS</h3>
                                <div className="text-xs text-slate-500">Add to Home Screen</div>
                            </div>
                        </div>
                        <ol className="text-sm text-slate-700 space-y-2 list-decimal list-inside">
                            <li>Tap the <strong>Share</strong> icon <i className="fi fi-rr-share text-brand-500 mx-0.5" /> in Safari</li>
                            <li>Scroll and tap <strong>Add to Home Screen</strong></li>
                            <li>Tap <strong>Add</strong> in the top right</li>
                        </ol>
                        <button onClick={() => setShowIosTip(false)} className="mt-4 w-full py-2 rounded-xl bg-slate-100 text-slate-700 font-semibold text-sm hover:bg-slate-200">Got it</button>
                    </div>
                </div>
            )}
        </>
    );
}

/* ─── Mood toggle button ─────────────────────────────────────────── */
function MoodToggle({ mood, onToggle, t }: { mood: Mood; onToggle: () => void; t: typeof T['night'] }) {
    return (
        <button
            onClick={onToggle}
            title={mood === 'night' ? 'Switch to Day mood' : 'Switch to Night mood'}
            className={`relative w-14 h-7 rounded-full border transition-all duration-300 ease-out ${t.toggleBg}`}
        >
            <span
                className={`absolute top-0.5 w-6 h-6 rounded-full flex items-center justify-center text-xs transition-all duration-300 ease-out shadow-md
                    ${mood === 'night'
                        ? 'left-0.5 bg-gradient-to-br from-indigo-500 to-purple-700 text-white'
                        : 'left-[1.875rem] bg-gradient-to-br from-amber-300 to-amber-500 text-white'}`}
            >
                <SunMoon mood={mood === 'night' ? 'night' : 'day'} className="w-3.5 h-3.5" strokeWidth={2.6} />
            </span>
        </button>
    );
}

/* ─── Main page ──────────────────────────────────────────────────── */
export default function LiveDashboard({
    kpi_cards, financial, machines_data, active_jobs, work_centre_status, recent_alerts, last_updated,
}: Props) {
    const [mood, setMood] = useState<Mood>(() => {
        if (typeof window === 'undefined') return 'night';
        return (localStorage.getItem('live_mood') as Mood) || 'night';
    });
    const t = T[mood];
    const kpiPalette = kpiTheme[mood];
    const statePalette = stateTheme[mood];

    const toggleMood = () => {
        setMood(prev => {
            const next = prev === 'night' ? 'day' : 'night';
            try { localStorage.setItem('live_mood', next); } catch {}
            return next;
        });
    };

    const [clock, setClock] = useState(new Date());
    const [lastUpdated, setLastUpdated] = useState(new Date(last_updated));
    const [connectionLost, setConnectionLost] = useState(false);
    const reloadRef = useRef<ReturnType<typeof setInterval>>();

    useEffect(() => {
        const timer = setInterval(() => setClock(new Date()), 1000);
        return () => clearInterval(timer);
    }, []);

    useEffect(() => {
        reloadRef.current = setInterval(() => {
            router.reload({
                only: ['active_jobs', 'kpi_cards', 'financial', 'machines_data', 'work_centre_status', 'recent_alerts', 'last_updated'],
                onSuccess: () => { setLastUpdated(new Date()); setConnectionLost(false); },
                onError:   () => setConnectionLost(true),
            });
        }, 10000);
        return () => clearInterval(reloadRef.current);
    }, []);

    const sortedJobs = [...active_jobs].sort((a, b) => {
        const priority = (j: ActiveJob) => {
            if (!j.started_at) return 2;
            const ratio = (Date.now() - new Date(j.started_at).getTime()) / (j.estimated_hours * 3600000);
            if (ratio > 1.2) return 0;
            if (ratio > 1) return 1;
            return 2;
        };
        if (a.status === 'qc_hold') return 1;
        if (b.status === 'qc_hold') return -1;
        return priority(a) - priority(b);
    });

    return (
        <div className={`relative min-h-screen select-none font-sans transition-colors duration-500 overflow-hidden ${t.page}`}>
            {/* Day-mode decorative background blobs */}
            {mood === 'day' && (
                <div className="pointer-events-none absolute inset-0 overflow-hidden">
                    <div className="absolute -top-32 -left-32 w-[28rem] h-[28rem] rounded-full bg-brand-300/20 blur-3xl animate-pulse" style={{ animationDuration: '8s' }} />
                    <div className="absolute top-1/3 -right-40 w-[32rem] h-[32rem] rounded-full bg-sky-300/20 blur-3xl animate-pulse" style={{ animationDuration: '10s', animationDelay: '2s' }} />
                    <div className="absolute bottom-0 left-1/3 w-[26rem] h-[26rem] rounded-full bg-emerald-300/15 blur-3xl animate-pulse" style={{ animationDuration: '12s', animationDelay: '4s' }} />
                </div>
            )}
            <div className="relative">
            {/* ─── HEADER ─────────────────────────────────────────── */}
            <header className={`relative px-3 sm:px-6 py-3 sm:py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4 sticky top-0 z-30 transition-colors duration-500 ${t.header}`}>
                <div className="flex items-center gap-3 sm:gap-4 min-w-0">
                    <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-2xl bg-gradient-to-br from-brand-400 to-brand-600 flex items-center justify-center shadow-xl shadow-brand-500/20 shrink-0">
                        <i className="fi fi-sr-factory text-white text-lg sm:text-xl leading-none" />
                    </div>
                    <div className="min-w-0 flex-1">
                        <h1 className={`text-base sm:text-2xl font-bold tracking-tight truncate ${t.title}`}>
                            <span className={t.titleAccent}>BITAC PMS</span>
                            <span className={`mx-1.5 sm:mx-2 ${t.titleSep}`}>/</span>
                            <span>Live Ops</span>
                        </h1>
                        <p className={`hidden sm:block text-xs mt-0.5 ${t.subtitle}`}>
                            Bangladesh Industrial Technical Assistance Centre &middot; Network Operations Center
                        </p>
                    </div>
                    {/* Mobile-only controls (right side of title) */}
                    <div className="sm:hidden shrink-0 flex items-center gap-2">
                        <InstallButton mood={mood} t={t} />
                        <MoodToggle mood={mood} onToggle={toggleMood} t={t} />
                    </div>
                </div>
                <div className="flex items-center justify-between sm:justify-end gap-3 sm:gap-5">
                    <div className="hidden sm:flex items-center gap-3">
                        <InstallButton mood={mood} t={t} />
                        <MoodToggle mood={mood} onToggle={toggleMood} t={t} />
                    </div>
                    <div className="text-left sm:text-right">
                        <div className={`text-2xl sm:text-3xl font-mono font-bold tabular-nums leading-none tracking-tight ${t.clock}`}>
                            {clock.toLocaleTimeString('en-BD', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                        </div>
                        <div className={`hidden sm:block text-xs mt-1 ${t.meta}`}>
                            {clock.toLocaleDateString('en-BD', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                        </div>
                        <div className={`sm:hidden text-[10px] mt-0.5 ${t.meta}`}>
                            {clock.toLocaleDateString('en-BD', { weekday: 'short', day: 'numeric', month: 'short' })}
                        </div>
                        <div className={`text-[10px] sm:text-[11px] mt-1 sm:mt-1.5 flex items-center sm:justify-end gap-1.5 font-medium ${
                            connectionLost
                                ? (mood === 'night' ? 'text-amber-400' : 'text-amber-600') + ' animate-pulse'
                                : (mood === 'night' ? 'text-emerald-400' : 'text-emerald-600')
                        }`}>
                            {connectionLost ? (
                                <><i className="fi fi-rr-triangle-warning leading-none" /> Retrying…</>
                            ) : (
                                <>
                                    <span className="relative flex h-2 w-2">
                                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                                        <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                                    </span>
                                    <span className="hidden sm:inline">Live · synced </span>
                                    <span className="sm:hidden">Live · </span>
                                    {lastUpdated.toLocaleTimeString('en-BD', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                                </>
                            )}
                        </div>
                    </div>
                </div>
            </header>

            <div className="p-3 sm:p-5 space-y-4 sm:space-y-5">
                {/* ─── PRODUCTION KPI STRIP ───────────────────────── */}
                <div>
                    <div className="flex items-center justify-between mb-2.5">
                        <div className="flex items-center gap-2">
                            <i className={`fi fi-rr-chart-line-up text-sm ${mood === 'night' ? 'text-brand-400' : 'text-brand-600'}`} />
                            <h3 className={`text-[11px] font-bold uppercase tracking-[0.15em] ${t.label}`}>Production Pulse</h3>
                        </div>
                        <span className={`text-[10px] uppercase tracking-wider ${t.labelMuted}`}>Auto · 10s</span>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 sm:gap-3">
                        {kpi_cards.map((kpi) => {
                            const k = kpiPalette[kpi.color as keyof typeof kpiPalette] ?? kpiPalette.blue;
                            return (
                                <div key={kpi.key}
                                    className={`group relative overflow-hidden rounded-xl sm:rounded-2xl border ring-1 p-3 sm:p-4 shadow-xl cursor-default
                                                transition-all duration-300 ease-out
                                                hover:-translate-y-1 hover:shadow-2xl hover:ring-2
                                                ${mood === 'day' ? dayHoverShadow[kpi.color] ?? '' : ''}
                                                ${t.cardBg} ${t.cardBorder} ${k.ring}
                                                ${kpi.alert ? 'animate-pulse ring-2' : ''}`}>
                                    <div className={`absolute inset-0 bg-gradient-to-br ${k.glow} pointer-events-none transition-opacity duration-300 group-hover:opacity-150`} />
                                    <div className={`absolute top-0 left-0 right-0 h-0.5 ${k.bar} transition-all duration-300 group-hover:h-1`} />
                                    <div className="relative flex items-start justify-between mb-1.5 sm:mb-2">
                                        <i className={`fi ${k.icon} ${k.text} text-base sm:text-lg leading-none transition-transform duration-300 group-hover:scale-125 group-hover:-rotate-6`} />
                                        {kpi.alert && (
                                            <span className="relative flex h-2.5 w-2.5">
                                                <span className="animate-ping absolute inline-flex h-2.5 w-2.5 rounded-full bg-red-400 opacity-75" />
                                                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500" />
                                            </span>
                                        )}
                                    </div>
                                    <div className={`relative text-3xl sm:text-4xl font-bold tabular-nums leading-none ${k.text} transition-transform duration-300 group-hover:scale-105 origin-left`}>{kpi.value}</div>
                                    <div className={`relative text-[10px] sm:text-[11px] mt-1.5 font-semibold uppercase tracking-wide ${t.label} truncate`}>{kpi.label}</div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* ─── FINANCIAL OVERVIEW ──────────────────────────── */}
                <div className={`rounded-2xl border overflow-hidden shadow-xl transition-all duration-300 ease-out
                                hover:shadow-2xl hover:border-brand-400/40
                                ${t.cardBg} ${t.cardBorder}`}>
                    <SectionHeader t={t}
                        icon="fi-rr-chart-pie-alt"
                        color={mood === 'night' ? 'bg-emerald-500/20 text-emerald-300' : 'bg-emerald-100 text-emerald-700'}
                        title="Financial Overview"
                        subtitle="Revenue, billing & sales pipeline"
                        action={
                            <span className={`text-[10px] px-2.5 py-1 rounded-lg uppercase tracking-wider font-semibold border ${
                                mood === 'night' ? 'text-emerald-300 bg-emerald-500/10 border-emerald-500/30' : 'text-emerald-700 bg-emerald-50 border-emerald-200'
                            }`}>Month-to-Date</span>
                        }
                    />
                    <div className="p-3 sm:p-5 grid grid-cols-1 lg:grid-cols-12 gap-3 sm:gap-5">
                        <div className="lg:col-span-7 grid grid-cols-2 sm:grid-cols-3 gap-2.5 sm:gap-3">
                            <FinStat t={t} icon="fi-rr-receipt"           label="Invoiced Today"   value={formatBDT(financial.invoiced_today)}  accent={mood === 'night' ? 'text-emerald-300' : 'text-emerald-700'} />
                            <FinStat t={t} icon="fi-rr-money-bill-wave"   label="Invoiced (Month)" value={formatBDT(financial.invoiced_month)}  accent={mood === 'night' ? 'text-emerald-300' : 'text-emerald-700'} />
                            <FinStat t={t} icon="fi-rr-hourglass-end"     label="Outstanding"      value={formatBDT(financial.outstanding)}     accent={mood === 'night' ? 'text-amber-300' : 'text-amber-700'} sublabel="Issued · awaiting receipt" />
                            <FinStat t={t} icon="fi-rr-document-signed"   label="Quoted (Month)"   value={formatBDT(financial.quoted_month)}    accent={mood === 'night' ? 'text-blue-300' : 'text-blue-700'} />
                            <FinStat t={t} icon="fi-rr-handshake"         label="Converted"        value={formatBDT(financial.converted_month)} accent={mood === 'night' ? 'text-teal-300' : 'text-teal-700'} sublabel={`${financial.conversion_rate}% conversion`} />
                            <FinStat t={t} icon="fi-rr-time-quarter-past" label="Pipeline"         value={`${financial.approved_quotes + financial.pending_quotes}`} accent={mood === 'night' ? 'text-purple-300' : 'text-purple-700'} sublabel={`${financial.pending_quotes} pending · ${financial.approved_quotes} approved`} />
                        </div>

                        <div className={`lg:col-span-5 rounded-xl p-4 border transition-all duration-300 ease-out
                                          hover:-translate-y-0.5 hover:shadow-lg hover:shadow-black/5 hover:border-brand-400/60
                                          ${t.cardSection}`}>
                            <div className="flex items-center justify-between mb-4">
                                <div>
                                    <div className={`text-[10px] font-bold uppercase tracking-wider ${t.label}`}>7-Day Revenue Trend</div>
                                    <div className={`text-lg font-bold mt-0.5 ${t.textStrong}`}>
                                        {formatBDT(financial.revenue_trend.reduce((s, p) => s + p.value, 0))}
                                    </div>
                                </div>
                                <div className="text-right">
                                    <div className={`text-[10px] font-bold uppercase tracking-wider ${t.label}`}>Conversion</div>
                                    <div className={`text-lg font-bold mt-0.5 ${
                                        financial.conversion_rate >= 50
                                            ? (mood === 'night' ? 'text-emerald-300' : 'text-emerald-700')
                                            : financial.conversion_rate >= 25
                                                ? (mood === 'night' ? 'text-amber-300' : 'text-amber-700')
                                                : (mood === 'night' ? 'text-red-300' : 'text-red-700')
                                    }`}>{financial.conversion_rate}%</div>
                                </div>
                            </div>
                            <div className="flex items-end justify-between gap-1.5 h-28">
                                {financial.revenue_trend.map((p, i) => (
                                    <div key={i} className="flex-1 flex flex-col items-center gap-1.5 group">
                                        <div className="w-full flex items-end h-full">
                                            <div
                                                className="w-full bg-gradient-to-t from-brand-600 to-brand-400 rounded-t-md transition-all group-hover:from-brand-500 group-hover:to-brand-300"
                                                style={{ height: `${Math.max(p.pct, 2)}%` }}
                                                title={`${p.date}: ${formatBDT(p.value)}`}
                                            />
                                        </div>
                                        <div className={`text-[9px] font-semibold uppercase ${t.labelMuted}`}>{p.day}</div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>

                {/* ─── MACHINE HEALTH ──────────────────────────────── */}
                <div className={`rounded-2xl border overflow-hidden shadow-xl transition-all duration-300 ease-out
                                hover:shadow-2xl hover:border-brand-400/40
                                ${t.cardBg} ${t.cardBorder}`}>
                    <SectionHeader t={t}
                        icon="fi-rr-settings-sliders"
                        color={mood === 'night' ? 'bg-purple-500/20 text-purple-300' : 'bg-purple-100 text-purple-700'}
                        title="Machine Health & Utilization"
                        subtitle="Real-time fleet status and maintenance alerts"
                        action={
                            <span className={`text-[10px] px-2.5 py-1 rounded-lg uppercase tracking-wider font-semibold border ${
                                machines_data.utilization_pct >= 60
                                    ? (mood === 'night' ? 'text-emerald-300 bg-emerald-500/10 border-emerald-500/30' : 'text-emerald-700 bg-emerald-50 border-emerald-200')
                                    : machines_data.utilization_pct >= 30
                                        ? (mood === 'night' ? 'text-amber-300 bg-amber-500/10 border-amber-500/30' : 'text-amber-700 bg-amber-50 border-amber-200')
                                        : (mood === 'night' ? 'text-red-300 bg-red-500/10 border-red-500/30' : 'text-red-700 bg-red-50 border-red-200')
                            }`}>Utilization {machines_data.utilization_pct}%</span>
                        }
                    />
                    <div className="p-3 sm:p-5 grid grid-cols-1 lg:grid-cols-12 gap-3 sm:gap-5">
                        <div className={`lg:col-span-4 rounded-xl p-3 sm:p-4 border transition-all duration-300 ease-out
                                          hover:-translate-y-0.5 hover:shadow-lg hover:shadow-black/5 hover:border-purple-400/60
                                          ${t.cardSection}`}>
                            <div className={`text-[10px] font-bold uppercase tracking-wider mb-3 ${t.label}`}>Fleet State</div>
                            <div className="flex items-center justify-center gap-4 sm:gap-6">
                                <StateDonut data={machines_data.state_breakdown} total={machines_data.total} t={t} />
                                <div className="space-y-1.5">
                                    {Object.entries(machines_data.state_breakdown).map(([key, val]) => {
                                        const st = statePalette[key as keyof typeof statePalette];
                                        return (
                                            <div key={key} className="flex items-center gap-2 text-xs">
                                                <span className={`w-2 h-2 rounded-sm ${st.dot}`} />
                                                <span className={`w-16 sm:w-20 ${t.text}`}>{st.label}</span>
                                                <span className={`font-bold tabular-nums ${st.text}`}>{val}</span>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>

                        <div className={`lg:col-span-3 rounded-xl p-3 sm:p-4 border flex flex-col items-center transition-all duration-300 ease-out
                                          hover:-translate-y-0.5 hover:shadow-lg hover:shadow-black/5 hover:border-purple-400/60
                                          ${t.cardSection}`}>
                            <div className={`text-[10px] font-bold uppercase tracking-wider mb-2 ${t.label}`}>Avg Health Score</div>
                            <HealthGauge score={machines_data.avg_health} t={t} />
                            <div className={`grid grid-cols-2 gap-3 mt-4 w-full pt-3 border-t ${t.sectionDivider}`}>
                                <div className="text-center">
                                    <div className={`text-[9px] uppercase tracking-wider font-bold ${t.labelMuted}`}>Downtime Today</div>
                                    <div className={`text-lg font-bold tabular-nums mt-0.5 ${mood === 'night' ? 'text-amber-300' : 'text-amber-700'}`}>{machines_data.downtime_today_h}h</div>
                                </div>
                                <div className="text-center">
                                    <div className={`text-[9px] uppercase tracking-wider font-bold ${t.labelMuted}`}>This Week</div>
                                    <div className={`text-lg font-bold tabular-nums mt-0.5 ${mood === 'night' ? 'text-orange-300' : 'text-orange-700'}`}>{machines_data.downtime_week_h}h</div>
                                </div>
                            </div>
                        </div>

                        <div className={`lg:col-span-5 rounded-xl p-3 sm:p-4 border transition-all duration-300 ease-out
                                          hover:-translate-y-0.5 hover:shadow-lg hover:shadow-black/5 hover:border-red-400/60
                                          ${t.cardSection}`}>
                            <div className="flex items-center justify-between mb-3">
                                <div className={`text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5 ${t.label}`}>
                                    <i className={`fi fi-rr-triangle-warning ${mood === 'night' ? 'text-red-400' : 'text-red-600'}`} /> Critical Machines
                                </div>
                                <span className={`text-[10px] px-2 py-0.5 rounded font-semibold ${mood === 'night' ? 'text-red-300 bg-red-500/10' : 'text-red-700 bg-red-50'}`}>
                                    {machines_data.critical_machines.length} flagged
                                </span>
                            </div>
                            {machines_data.critical_machines.length > 0 ? (
                                <div className="space-y-1.5 max-h-44 overflow-y-auto pr-1">
                                    {machines_data.critical_machines.map((m) => {
                                        const st = statePalette[m.state as keyof typeof statePalette] ?? statePalette.offline;
                                        return (
                                            <div key={m.id} className={`flex items-center gap-3 px-2.5 py-2 rounded-lg border transition-colors hover:border-red-400/60 ${t.rowSubtle}`}>
                                                <span className={`w-1.5 h-1.5 rounded-full ${st.dot} shrink-0`} />
                                                <div className="flex-1 min-w-0">
                                                    <div className={`text-xs font-semibold truncate ${t.textStrong}`}>{m.name}</div>
                                                    <div className={`text-[10px] truncate ${t.labelMuted}`}>{m.code} · {m.work_centre}</div>
                                                </div>
                                                <div className="flex items-center gap-2 shrink-0">
                                                    <span className={`text-[10px] px-1.5 py-0.5 rounded font-semibold uppercase ${st.bg} ${st.text}`}>{st.label}</span>
                                                    <div className="text-right">
                                                        <div className={`text-sm font-bold tabular-nums leading-none ${mood === 'night' ? 'text-red-300' : 'text-red-700'}`}>{m.health_score}</div>
                                                        <div className={`text-[9px] ${t.labelMuted}`}>/100</div>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            ) : (
                                <div className={`text-center py-8 text-xs ${mood === 'night' ? 'text-emerald-400' : 'text-emerald-600'}`}>
                                    <i className="fi fi-rr-shield-check text-2xl block mb-1.5" />
                                    All machines healthy
                                </div>
                            )}
                            {machines_data.maintenance_due.length > 0 && (
                                <div className={`mt-4 pt-3 border-t ${t.sectionDivider}`}>
                                    <div className={`text-[10px] font-bold uppercase tracking-wider mb-2 flex items-center gap-1.5 ${t.label}`}>
                                        <i className={`fi fi-rr-tools ${mood === 'night' ? 'text-amber-400' : 'text-amber-600'}`} /> Maintenance Due (≤7 days)
                                    </div>
                                    <div className="flex flex-wrap gap-1.5">
                                        {machines_data.maintenance_due.map((m) => (
                                            <span key={m.id} className={`text-[10px] px-2 py-1 rounded-md font-semibold border ${
                                                m.overdue
                                                    ? (mood === 'night' ? 'bg-red-500/15 text-red-300 border-red-500/30' : 'bg-red-100 text-red-700 border-red-300')
                                                    : (mood === 'night' ? 'bg-amber-500/15 text-amber-300 border-amber-500/30' : 'bg-amber-100 text-amber-700 border-amber-300')
                                            }`}>
                                                {m.code || m.name} · {m.overdue ? `${Math.abs(m.days_left)}d overdue` : `${m.days_left}d`}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* ─── ACTIVE JOBS ─────────────────────────────────── */}
                <div className={`rounded-2xl border overflow-hidden shadow-xl transition-all duration-300 ease-out
                                hover:shadow-2xl hover:border-brand-400/40
                                ${t.cardBg} ${t.cardBorder}`}>
                    <SectionHeader t={t}
                        icon="fi-rr-settings"
                        color={mood === 'night' ? 'bg-amber-500/20 text-amber-300' : 'bg-amber-100 text-amber-700'}
                        title="Active Jobs — In Production / QC / Ready"
                        subtitle="Sorted by overdue / at-risk first"
                        action={<span className={`text-sm font-medium tabular-nums ${t.label}`}>{active_jobs.length} jobs</span>}
                    />
                    {/* Desktop / tablet table */}
                    <div className="hidden md:block overflow-x-auto max-h-[26rem] overflow-y-auto">
                        <table className="min-w-full">
                            <thead className={`sticky top-0 ${t.tableHead}`}>
                                <tr className="text-[11px] font-semibold uppercase tracking-wide">
                                    <th className="px-4 py-3 text-left">Job Number</th>
                                    <th className="px-4 py-3 text-left">Product</th>
                                    <th className="px-4 py-3 text-left">Customer</th>
                                    <th className="px-4 py-3 text-left">Current Step</th>
                                    <th className="px-4 py-3 text-left">Work Centre</th>
                                    <th className="px-4 py-3 text-left">Operator</th>
                                    <th className="px-4 py-3 text-left">Elapsed</th>
                                    <th className="px-4 py-3 text-left">Status</th>
                                </tr>
                            </thead>
                            <tbody className={t.tableDivider}>
                                {sortedJobs.map((job) => (
                                    <tr key={job.id} className={`${getJobRowColor(job, job.estimated_hours, job.started_at, mood)} text-sm`}>
                                        <td className="px-4 py-3">
                                            <div className={`font-bold ${mood === 'night' ? 'text-amber-300' : 'text-amber-700'}`}>{job.job_number ?? '—'}</div>
                                            <div className={`text-[10px] font-mono ${t.labelMuted}`}>{job.wo_number}</div>
                                        </td>
                                        <td className={`px-4 py-3 font-medium ${t.textStrong}`}>{job.product}</td>
                                        <td className={`px-4 py-3 ${t.textMuted}`}>{job.customer}</td>
                                        <td className={`px-4 py-3 ${t.text}`}>{job.current_step}</td>
                                        <td className={`px-4 py-3 ${t.textMuted}`}>{job.work_centre}</td>
                                        <td className={`px-4 py-3 ${t.text}`}>{job.operator}</td>
                                        <td className="px-4 py-3"><ElapsedTimer startedAt={job.started_at} estimatedHours={job.estimated_hours} mood={mood} /></td>
                                        <td className="px-4 py-3">
                                            <span className={`px-2.5 py-0.5 rounded-lg text-[11px] font-semibold uppercase tracking-wide ${
                                                job.status === 'qc_hold' ? t.chipBlue : t.chipAmber
                                            }`}>{job.status_label}</span>
                                        </td>
                                    </tr>
                                ))}
                                {active_jobs.length === 0 && (
                                    <tr><td colSpan={8} className={`px-4 py-12 text-center ${t.labelMuted}`}>
                                        <i className="fi fi-rr-settings text-3xl block mb-2 opacity-50" />No active jobs
                                    </td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* Mobile card list */}
                    <div className="md:hidden p-3 space-y-2.5 max-h-[28rem] overflow-y-auto">
                        {sortedJobs.map((job) => (
                            <div key={job.id} className={`rounded-xl p-3 ${getJobRowColor(job, job.estimated_hours, job.started_at, mood)}`}>
                                <div className="flex items-start justify-between gap-2 mb-1.5">
                                    <div>
                                        <div className={`font-bold text-sm ${mood === 'night' ? 'text-amber-300' : 'text-amber-700'}`}>{job.job_number ?? '—'}</div>
                                        <div className={`text-[10px] font-mono ${t.labelMuted}`}>{job.wo_number}</div>
                                    </div>
                                    <span className={`px-2 py-0.5 rounded-md text-[10px] font-semibold uppercase tracking-wide shrink-0 ${
                                        job.status === 'qc_hold' ? t.chipBlue : t.chipAmber
                                    }`}>{job.status_label}</span>
                                </div>
                                <div className={`text-sm font-semibold ${t.textStrong}`}>{job.product}</div>
                                <div className={`text-xs mt-0.5 ${t.textMuted}`}>{job.customer}</div>
                                <div className={`grid grid-cols-2 gap-x-3 gap-y-1 mt-2 pt-2 border-t ${t.sectionDivider}`}>
                                    <div className="min-w-0">
                                        <div className={`text-[9px] uppercase tracking-wider font-bold ${t.labelMuted}`}>Step</div>
                                        <div className={`text-[11px] truncate ${t.text}`}>{job.current_step || '—'}</div>
                                    </div>
                                    <div className="min-w-0">
                                        <div className={`text-[9px] uppercase tracking-wider font-bold ${t.labelMuted}`}>Centre</div>
                                        <div className={`text-[11px] truncate ${t.text}`}>{job.work_centre || '—'}</div>
                                    </div>
                                    <div className="min-w-0">
                                        <div className={`text-[9px] uppercase tracking-wider font-bold ${t.labelMuted}`}>Operator</div>
                                        <div className={`text-[11px] truncate ${t.text}`}>{job.operator || '—'}</div>
                                    </div>
                                    <div className="min-w-0">
                                        <div className={`text-[9px] uppercase tracking-wider font-bold ${t.labelMuted}`}>Elapsed</div>
                                        <div className="text-[11px]"><ElapsedTimer startedAt={job.started_at} estimatedHours={job.estimated_hours} mood={mood} /></div>
                                    </div>
                                </div>
                            </div>
                        ))}
                        {active_jobs.length === 0 && (
                            <div className={`py-10 text-center ${t.labelMuted}`}>
                                <i className="fi fi-rr-settings text-3xl block mb-2 opacity-50" />
                                <div className="text-sm">No active jobs</div>
                            </div>
                        )}
                    </div>
                </div>

                {/* ─── WORK CENTRES + ALERTS ───────────────────────── */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-5">
                    <div className={`rounded-2xl border overflow-hidden shadow-xl transition-all duration-300 ease-out
                                hover:shadow-2xl hover:border-brand-400/40
                                ${t.cardBg} ${t.cardBorder}`}>
                        <SectionHeader t={t}
                            icon="fi-rr-factory"
                            color={mood === 'night' ? 'bg-emerald-500/20 text-emerald-300' : 'bg-emerald-100 text-emerald-700'}
                            title="Work Centre Status" subtitle="Live machine occupancy per shop" />
                        <div className="p-3 sm:p-4 space-y-2.5 sm:space-y-3 max-h-[26rem] overflow-y-auto">
                            {work_centre_status.map((wc) => {
                                const pct = wc.total_machines > 0 ? Math.round((wc.active_machines / wc.total_machines) * 100) : 0;
                                const wcBg = wc.status_color === 'red'
                                    ? (mood === 'night' ? 'border-red-500/40 bg-red-950/30' : 'border-red-300 bg-red-50')
                                    : wc.status_color === 'green'
                                        ? (mood === 'night' ? 'border-emerald-500/40 bg-emerald-950/30' : 'border-emerald-300 bg-emerald-50')
                                        : (mood === 'night' ? 'border-surface-700/60 bg-surface-900/50' : 'border-slate-200 bg-slate-50');
                                const wcCount = wc.status_color === 'green'
                                    ? (mood === 'night' ? 'text-emerald-300' : 'text-emerald-700')
                                    : wc.status_color === 'red'
                                        ? (mood === 'night' ? 'text-red-300' : 'text-red-700')
                                        : t.label;
                                return (
                                    <div key={wc.id} className={`rounded-xl p-3 sm:p-4 border transition-all duration-300 ease-out
                                                                  hover:-translate-y-0.5 hover:shadow-lg hover:shadow-black/10
                                                                  ${wcBg}`}>
                                        <div className="flex items-center justify-between mb-2">
                                            <span className={`font-semibold text-base ${t.textStrong}`}>{wc.name}</span>
                                            <span className={`text-sm font-mono font-semibold tabular-nums ${wcCount}`}>{wc.active_machines}/{wc.total_machines} running</span>
                                        </div>
                                        <div className={`h-1.5 rounded-full overflow-hidden mb-2 ${t.barTrack}`}>
                                            <div className={`h-full transition-all duration-700 ${
                                                wc.status_color === 'green' ? 'bg-gradient-to-r from-emerald-500 to-emerald-400'
                                                : wc.status_color === 'red' ? 'bg-gradient-to-r from-red-500 to-red-400'
                                                : 'bg-slate-400'}`} style={{ width: `${pct}%` }} />
                                        </div>
                                        {(wc as any).state_mix && (
                                            <div className="flex flex-wrap gap-1.5 mb-2">
                                                {([
                                                    { k: 'running',     l: 'Running',     color: mood === 'night' ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' : 'bg-emerald-100 text-emerald-800 border-emerald-200' },
                                                    { k: 'setup',       l: 'Setup',       color: mood === 'night' ? 'bg-amber-500/20 text-amber-300 border-amber-500/30'    : 'bg-amber-100 text-amber-800 border-amber-200' },
                                                    { k: 'idle',        l: 'Idle',        color: mood === 'night' ? 'bg-surface-700/40 text-surface-300 border-surface-600/40' : 'bg-slate-100 text-slate-700 border-slate-200' },
                                                    { k: 'maintenance', l: 'Maintenance', color: mood === 'night' ? 'bg-blue-500/20 text-blue-300 border-blue-500/30'      : 'bg-blue-100 text-blue-800 border-blue-200' },
                                                    { k: 'breakdown',   l: 'Breakdown',   color: mood === 'night' ? 'bg-red-500/20 text-red-300 border-red-500/30'         : 'bg-red-100 text-red-800 border-red-200' },
                                                    { k: 'offline',     l: 'Offline',     color: mood === 'night' ? 'bg-surface-800/60 text-surface-400 border-surface-700' : 'bg-slate-200 text-slate-600 border-slate-300' },
                                                ] as const).filter(s => ((wc as any).state_mix[s.k] ?? 0) > 0).map(s => (
                                                    <span key={s.k} className={`text-[10px] px-1.5 py-0.5 rounded-md border font-semibold ${s.color}`}>
                                                        {(wc as any).state_mix[s.k]} {s.l}
                                                    </span>
                                                ))}
                                            </div>
                                        )}
                                        {wc.active_jobs.length > 0 && (
                                            <div className={`space-y-1.5 pt-2 border-t ${t.sectionDivider}`}>
                                                {wc.active_jobs.slice(0, 3).map((job: any, i) => (
                                                    <div key={i} className={`text-xs flex items-center gap-2 ${t.textMuted}`}>
                                                        <span className={`font-bold ${mood === 'night' ? 'text-amber-300' : 'text-amber-700'}`}>{job.job_number ?? '—'}</span>
                                                        <span className={t.labelMuted}>·</span>
                                                        <span className="truncate">{job.product}</span>
                                                        <span className={`ml-auto ${t.labelMuted}`}>({job.operator})</span>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                            {work_centre_status.length === 0 && (
                                <div className={`text-center py-10 text-sm ${t.labelMuted}`}>
                                    <i className="fi fi-rr-factory text-3xl block mb-2 opacity-50" />No work centres
                                </div>
                            )}
                        </div>
                    </div>

                    <div className={`rounded-2xl border overflow-hidden shadow-xl transition-all duration-300 ease-out
                                hover:shadow-2xl hover:border-brand-400/40
                                ${t.cardBg} ${t.cardBorder}`}>
                        <SectionHeader t={t}
                            icon="fi-rr-bell"
                            color={mood === 'night' ? 'bg-red-500/20 text-red-300' : 'bg-red-100 text-red-700'}
                            title="Live Alert Feed" subtitle="Last 15 production events" />
                        <div className="overflow-y-auto max-h-[26rem]">
                            {recent_alerts.map((alert) => (
                                <div key={alert.id}
                                    className={`border-l-4 px-3 sm:px-5 py-2.5 sm:py-3 border-b transition-colors ${alertBorder[alert.color] ?? 'border-l-slate-400'} ${t.sectionDivider} ${t.rowHover}`}>
                                    <div className="flex items-start justify-between gap-3">
                                        <p className={`text-xs sm:text-sm flex-1 leading-snug ${t.text}`}>{alert.message}</p>
                                        <span className={`text-[10px] sm:text-xs font-mono whitespace-nowrap tabular-nums ${t.labelMuted}`}>{alert.time}</span>
                                    </div>
                                </div>
                            ))}
                            {recent_alerts.length === 0 && (
                                <div className={`px-5 py-12 text-center text-sm ${t.labelMuted}`}>
                                    <i className="fi fi-rr-bell text-3xl block mb-2 opacity-50" />No recent alerts
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                <footer className={`text-center text-[10px] uppercase tracking-[0.2em] py-4 ${t.footer}`}>
                    BITAC PMS · Live Operations Console · Refreshing every 10s
                </footer>
            </div>
            </div>
        </div>
    );
}
