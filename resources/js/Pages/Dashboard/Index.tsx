import AppLayout from '@/Layouts/AppLayout';
import { Link } from '@inertiajs/react';
import { useEffect, useMemo, useState, type ComponentType } from 'react';
import { motion } from 'motion/react';
import {
    AreaChart, Area, BarChart, Bar, LineChart, Line,
    PieChart, Pie, Cell, Sector,
    XAxis, YAxis, CartesianGrid, Tooltip, Legend,
    ResponsiveContainer,
} from 'recharts';
import {
    SpinningCog, DrivingTruck, PoppingShield, TickingClock,
    ShakingAlert, FlippingReceipt,
} from '@/Components/AnimatedIcons';
import type { LucideProps } from 'lucide-react';

// Map the legacy flaticon string -> animated Lucide component
const ANIM_ICON_MAP: Record<string, ComponentType<LucideProps>> = {
    'fi-rr-settings':         SpinningCog,
    'fi-rr-truck-side':       DrivingTruck,
    'fi-rr-shield-check':     PoppingShield,
    'fi-rr-clock':            TickingClock,
    'fi-rr-triangle-warning': ShakingAlert,
    'fi-rr-receipt':          FlippingReceipt,
};

/* ─── Count-up hook ─────────────────────────────────────────────── */
function useCountUp(target: number, duration = 1200) {
    const [value, setValue] = useState(0);
    useEffect(() => {
        if (target === 0) { setValue(0); return; }
        let start = 0;
        const step = Math.ceil(duration / target);
        const timer = setInterval(() => {
            start += 1;
            setValue(start);
            if (start >= target) clearInterval(timer);
        }, Math.max(step, 16));
        return () => clearInterval(timer);
    }, [target, duration]);
    return value;
}

/* ─── Stat card config ──────────────────────────────────────────── */
const STAT_ICON_STYLES: Record<string, string> = {
    blue:   'bg-gradient-to-br from-blue-400 to-blue-600 text-white',
    green:  'bg-gradient-to-br from-emerald-400 to-emerald-600 text-white',
    red:    'bg-gradient-to-br from-red-400 to-red-600 text-white',
    amber:  'bg-gradient-to-br from-amber-400 to-amber-600 text-white',
    orange: 'bg-gradient-to-br from-orange-400 to-orange-600 text-white',
    teal:   'bg-gradient-to-br from-teal-400 to-teal-600 text-white',
    brand:  'bg-gradient-to-br from-brand-400 to-brand-600 text-white',
};

function StatCard({ label, value, color, icon, href, alert }: {
    label: string; value: number; color: string; icon: string; href?: string; alert?: boolean;
}) {
    const animated = useCountUp(value);
    const AnimIcon = ANIM_ICON_MAP[icon];
    const card = (
        <motion.div
            whileHover="hover"
            className={`stat-card group relative overflow-hidden transition-all duration-200 hover:shadow-premium-lg hover:-translate-y-0.5 ${alert ? 'ring-2 ring-red-400/60 ring-offset-2' : ''}`}
        >
            {alert && (
                <span className="absolute top-3 right-3 flex h-2.5 w-2.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500" />
                </span>
            )}
            <div className={`stat-icon shadow-lg ${STAT_ICON_STYLES[color] ?? STAT_ICON_STYLES.blue}`}>
                {AnimIcon
                    ? <AnimIcon className="w-5 h-5 text-white" strokeWidth={2.4} />
                    : <i className={`fi ${icon} leading-none`} />}
            </div>
            <div className="min-w-0">
                <div className="stat-value tabular-nums">{animated}</div>
                <p className="stat-label">{label}</p>
            </div>
        </motion.div>
    );
    return href ? <Link href={href} className="block animate-fade-in h-full">{card}</Link> : <div className="animate-fade-in h-full">{card}</div>;
}

/* ─── Color palette ─────────────────────────────────────────────── */
const PIPELINE_COLORS: Record<string, string> = {
    'Draft':         '#94a3b8',
    'Approved':      '#60a5fa',
    'In Production': '#fbbf24',
    'QC Hold':       '#fb923c',
    'QC Passed':     '#34d399',
    'Ready':         '#818cf8',
    'Delivered':     '#22c55e',
    'Cancelled':     '#f87171',
};

const STATUS_BADGE_MAP: Record<string, string> = {
    draft: 'badge-slate', approved: 'badge-blue', in_production: 'badge-amber',
    released_to_shops: 'badge-blue',
    qc_hold: 'badge-amber', qc_passed: 'badge-green',
    ready_for_delivery: 'badge-purple', delivered: 'badge-green', cancelled: 'badge-red',
    in_rework: 'badge-red',
};

const PRIORITY_BADGE_MAP: Record<string, string> = {
    urgent: 'badge-red', high: 'badge-amber', normal: 'badge-blue', low: 'badge-slate',
};

/** Slim weighted-progress bar + numeric pct, used in the Recent Work Orders table. */
function ProgressCell({ pct }: { pct: number | null | undefined }) {
    if (pct === null || pct === undefined) {
        return <span className="text-xs text-surface-300">—</span>;
    }
    const v = Math.max(0, Math.min(100, pct));
    const barColor = v === 100 ? 'bg-emerald-500' : v >= 50 ? 'bg-brand-500' : 'bg-amber-500';
    return (
        <div className="flex items-center gap-2 min-w-[100px]">
            <div className="flex-1 h-1.5 rounded-full bg-surface-100 overflow-hidden">
                <div className={`h-full ${barColor} transition-all`} style={{ width: `${v}%` }} />
            </div>
            <span className="text-[11px] font-semibold tabular-nums text-surface-700 w-9 text-right">{v}%</span>
        </div>
    );
}

/* ─── Pro tooltip ───────────────────────────────────────────────── */
function ChartTooltip({ active, payload, label }: any) {
    if (!active || !payload?.length) return null;
    return (
        <div className="bg-white/95 backdrop-blur-xl px-4 py-3 rounded-2xl border border-slate-200/70 shadow-2xl text-xs animate-fade-in"
             style={{ boxShadow: '0 20px 50px -12px rgba(15,23,42,0.25), 0 8px 20px -8px rgba(15,23,42,0.15)' }}>
            {label && <p className="font-bold text-surface-900 mb-2 text-[13px]">{label}</p>}
            <div className="space-y-1.5">
                {payload.map((p: any) => (
                    <div key={p.name} className="flex items-center gap-2.5">
                        <span className="w-2.5 h-2.5 rounded-full inline-block shrink-0 ring-2 ring-white shadow"
                              style={{ background: p.color, boxShadow: `0 0 0 1px ${p.color}40, 0 2px 4px ${p.color}30` }} />
                        <span className="text-surface-500 font-medium">{p.name}</span>
                        <span className="font-bold text-surface-900 ml-auto tabular-nums">{p.value ?? '—'}</span>
                    </div>
                ))}
            </div>
        </div>
    );
}

/* ─── Custom 3D Bar shape (renders top + side faces) ────────────── */
function Bar3D(props: any) {
    const { x, y, width, height, fill, payload, dataKey } = props;
    if (height < 0 || width < 0) return null;
    const depth = Math.min(8, width * 0.35);
    const topY = y - depth * 0.55;
    const sideX = x + width;

    // Generate stable IDs from dataKey + index info
    const gradId = `bar3d-${dataKey ?? 'bar'}-${Math.round(x)}`;
    const topGradId = `bar3d-top-${dataKey ?? 'bar'}-${Math.round(x)}`;
    const sideGradId = `bar3d-side-${dataKey ?? 'bar'}-${Math.round(x)}`;

    return (
        <g>
            <defs>
                <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={fill} stopOpacity={1} />
                    <stop offset="100%" stopColor={fill} stopOpacity={0.65} />
                </linearGradient>
                <linearGradient id={topGradId} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="white" stopOpacity={0.55} />
                    <stop offset="100%" stopColor={fill} stopOpacity={0.95} />
                </linearGradient>
                <linearGradient id={sideGradId} x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor={fill} stopOpacity={0.85} />
                    <stop offset="100%" stopColor="black" stopOpacity={0.35} />
                </linearGradient>
            </defs>

            {/* Right side face (parallelogram) */}
            <path
                d={`M ${sideX} ${y} L ${sideX + depth} ${topY} L ${sideX + depth} ${topY + height} L ${sideX} ${y + height} Z`}
                fill={`url(#${sideGradId})`}
            />

            {/* Top face (parallelogram) */}
            <path
                d={`M ${x} ${y} L ${x + depth} ${topY} L ${sideX + depth} ${topY} L ${sideX} ${y} Z`}
                fill={`url(#${topGradId})`}
            />

            {/* Front face with rounded top */}
            <path
                d={`M ${x} ${y + 4}
                    Q ${x} ${y} ${x + 4} ${y}
                    L ${sideX - 4} ${y}
                    Q ${sideX} ${y} ${sideX} ${y + 4}
                    L ${sideX} ${y + height}
                    L ${x} ${y + height} Z`}
                fill={`url(#${gradId})`}
            />

            {/* Subtle highlight stripe */}
            <line
                x1={x + 2} y1={y + 6}
                x2={x + 2} y2={y + height - 4}
                stroke="white" strokeOpacity={0.35} strokeWidth="1.5" strokeLinecap="round"
            />
        </g>
    );
}

/* ─── Custom click-only animated SVG donut ──────────────────────── */
/* Builds an annular-sector path for one slice */
function donutSlicePath(
    cx: number, cy: number,
    innerR: number, outerR: number,
    startAngle: number, endAngle: number
): string {
    const x1 = cx + outerR * Math.cos(startAngle);
    const y1 = cy + outerR * Math.sin(startAngle);
    const x2 = cx + outerR * Math.cos(endAngle);
    const y2 = cy + outerR * Math.sin(endAngle);
    const x3 = cx + innerR * Math.cos(endAngle);
    const y3 = cy + innerR * Math.sin(endAngle);
    const x4 = cx + innerR * Math.cos(startAngle);
    const y4 = cy + innerR * Math.sin(startAngle);
    const largeArc = endAngle - startAngle > Math.PI ? 1 : 0;
    return [
        `M ${x1} ${y1}`,
        `A ${outerR} ${outerR} 0 ${largeArc} 1 ${x2} ${y2}`,
        `L ${x3} ${y3}`,
        `A ${innerR} ${innerR} 0 ${largeArc} 0 ${x4} ${y4}`,
        'Z',
    ].join(' ');
}

interface DonutProps {
    data: { status: string; count: number }[];
    total: number;
    activeIdx: number;
    progress: number;
    onSliceClick: (idx: number) => void;
}

function CustomDonut({ data, total, activeIdx, progress, onSliceClick }: DonutProps) {
    // Fixed viewBox — ResponsiveContainer not needed
    const W = 300, H = 240;
    const cx = W / 2, cy = H / 2;
    const innerR = 62, outerR = 92;
    const PAD_RADIANS = (2 * Math.PI) / 360 * 2; // 2° padding between slices

    // Compute slice geometry — start at top (12 o'clock), go clockwise
    let cursor = -Math.PI / 2;
    const slices = data.map((item, idx) => {
        const fraction = total > 0 ? item.count / total : 0;
        const sliceAngle = fraction * 2 * Math.PI;
        const startAngle = cursor + PAD_RADIANS / 2;
        const endAngle = cursor + sliceAngle - PAD_RADIANS / 2;
        cursor += sliceAngle;
        const midAngle = (startAngle + endAngle) / 2;
        return { ...item, idx, startAngle, endAngle, midAngle, fraction };
    });

    /* ── Entrance animation: sweep clockwise from 12 o'clock ── */
    const [entrance, setEntrance] = useState(0);
    useEffect(() => {
        const start = performance.now();
        const duration = 1100;
        const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);
        let raf = 0;
        const step = (now: number) => {
            const t = Math.min(1, (now - start) / duration);
            setEntrance(easeOutCubic(t));
            if (t < 1) raf = requestAnimationFrame(step);
        };
        raf = requestAnimationFrame(step);
        return () => cancelAnimationFrame(raf);
    }, []);

    // Wipe front sweeps from -PI/2 to (-PI/2 + 2*PI) over the entrance
    const wipeFront = -Math.PI / 2 + entrance * 2 * Math.PI;
    const isFullyDrawn = entrance >= 0.999;

    return (
        <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} style={{ overflow: 'visible' }}>
            <defs>
                {/* Per-status radial gradients (shiny 3D look) */}
                {data.map((entry) => {
                    const c = PIPELINE_COLORS[entry.status] ?? '#94a3b8';
                    const id = `donutGrad-${entry.status.replace(/\s+/g, '_')}`;
                    return (
                        <radialGradient key={id} id={id} cx="50%" cy="35%" r="65%">
                            <stop offset="0%"   stopColor="white" stopOpacity={0.5} />
                            <stop offset="35%"  stopColor={c}     stopOpacity={1} />
                            <stop offset="100%" stopColor={c}     stopOpacity={0.85} />
                        </radialGradient>
                    );
                })}
                <filter id="donutDropShadow" x="-50%" y="-50%" width="200%" height="200%">
                    <feGaussianBlur in="SourceAlpha" stdDeviation="5" />
                    <feOffset dx="0" dy="8" result="offsetblur" />
                    <feComponentTransfer><feFuncA type="linear" slope="0.28" /></feComponentTransfer>
                    <feMerge><feMergeNode /><feMergeNode in="SourceGraphic" /></feMerge>
                </filter>
            </defs>

            {/* 3D base ellipse — donut sitting on the table (fades in with entrance) */}
            <ellipse
                cx={cx}
                cy={cy + outerR * 0.6}
                rx={outerR + 2}
                ry={20}
                fill="rgba(15,23,42,0.10)"
                filter="blur(6px)"
                opacity={entrance}
            />

            {/* All slices — drawn with sweep-in entrance */}
            <g filter={isFullyDrawn ? 'url(#donutDropShadow)' : undefined}>
                {slices.map((s) => {
                    // Sweep clipping: skip slice if wipe front hasn't reached it yet,
                    // otherwise clip the slice's end angle to the wipe front.
                    if (s.startAngle >= wipeFront) return null;
                    const renderedEnd = Math.min(s.endAngle, wipeFront);
                    if (renderedEnd <= s.startAngle) return null;

                    const isActive = s.idx === activeIdx;
                    const offset = isActive ? 12 * progress : 0;
                    const expand = isActive ? 8  * progress : 0;
                    const ox = Math.cos(s.midAngle) * offset;
                    const oy = Math.sin(s.midAngle) * offset;
                    const c = PIPELINE_COLORS[s.status] ?? '#94a3b8';
                    const gradId = `donutGrad-${s.status.replace(/\s+/g, '_')}`;

                    return (
                        <g
                            key={s.status}
                            style={{ cursor: isFullyDrawn ? 'pointer' : 'default' }}
                            onClick={() => isFullyDrawn && onSliceClick(s.idx)}
                        >
                            {/* Glow halo (only on active, after entrance complete) */}
                            {isActive && progress > 0.05 && isFullyDrawn && (
                                <path
                                    d={donutSlicePath(cx + ox, cy + oy + 3 * progress, innerR - 2, outerR + 14 * progress, s.startAngle, renderedEnd)}
                                    fill={c}
                                    opacity={0.25 * progress}
                                    style={{ filter: 'blur(8px)', pointerEvents: 'none' }}
                                />
                            )}
                            {/* Main slice */}
                            <path
                                d={donutSlicePath(cx + ox, cy + oy, innerR, outerR + expand, s.startAngle, renderedEnd)}
                                fill={`url(#${gradId})`}
                                stroke="white"
                                strokeWidth={3}
                                strokeLinejoin="round"
                            />
                            {/* Rim highlight (only on active, after entrance complete) */}
                            {isActive && progress > 0.1 && isFullyDrawn && (
                                <path
                                    d={donutSlicePath(cx + ox, cy + oy, outerR + 3 * progress, outerR + 6 * progress, s.startAngle, renderedEnd)}
                                    fill="white"
                                    opacity={0.7 * progress}
                                    style={{ pointerEvents: 'none' }}
                                />
                            )}
                            {/* Inner shimmer (only on active, after entrance complete) */}
                            {isActive && progress > 0.1 && isFullyDrawn && (
                                <path
                                    d={donutSlicePath(cx + ox, cy + oy, innerR, innerR + 3 * progress, s.startAngle, renderedEnd)}
                                    fill="white"
                                    opacity={0.4 * progress}
                                    style={{ pointerEvents: 'none' }}
                                />
                            )}
                        </g>
                    );
                })}
            </g>
        </svg>
    );
}

/* ─── Main Dashboard ────────────────────────────────────────────── */
export default function DashboardIndex({ stats, recentWorkOrders, charts }: any) {
    // Pie click-to-explode state. -1 means none active.
    const [activePieIdx, setActivePieIdx] = useState<number>(-1);
    // The slice that is *currently being rendered* as active — kept around
    // during the close animation so we can tween it back to 0.
    const [renderedActiveIdx, setRenderedActiveIdx] = useState<number>(-1);
    // Tweened explosion amount 0 → 1 over ~400 ms with easeOutCubic.
    const [explodeProgress, setExplodeProgress] = useState<number>(0);
    const [hiddenSeries, setHiddenSeries] = useState<Record<string, boolean>>({});

    // Animate explodeProgress whenever activePieIdx changes.
    useEffect(() => {
        const target = activePieIdx >= 0 ? 1 : 0;
        if (activePieIdx >= 0) setRenderedActiveIdx(activePieIdx);

        const start = performance.now();
        const from = explodeProgress;
        const duration = 450;
        const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);

        let raf = 0;
        const step = (now: number) => {
            const t = Math.min(1, (now - start) / duration);
            const eased = easeOutCubic(t);
            const v = from + (target - from) * eased;
            setExplodeProgress(v);
            if (t < 1) {
                raf = requestAnimationFrame(step);
            } else if (target === 0) {
                // Once the close animation finishes, drop the rendered slice
                setRenderedActiveIdx(-1);
            }
        };
        raf = requestAnimationFrame(step);
        return () => cancelAnimationFrame(raf);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activePieIdx]);

    const pipelineTotal = useMemo(
        () => (charts.pipeline ?? []).reduce((s: number, p: any) => s + (p.count ?? 0), 0),
        [charts.pipeline]
    );

    const onPieClick = (idx: number) => {
        setActivePieIdx(prev => (prev === idx ? -1 : idx));
    };

    const toggleSeries = (name: string) => {
        setHiddenSeries(prev => ({ ...prev, [name]: !prev[name] }));
    };

    return (
        <AppLayout header="Dashboard">
            <div className="space-y-8">

                {/* ── KPI Stat Cards ── */}
                <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
                    <StatCard label="Active Jobs"      value={stats.active_work_orders}  color="blue"   icon="fi-rr-settings"         href="/work-orders?status=in_production" />
                    <StatCard label="Delivered Today"  value={stats.delivered_today}      color="green"  icon="fi-rr-truck-side"       href="/work-orders?status=delivered" />
                    <StatCard label="Pending QC"       value={stats.pending_qc}           color="amber"  icon="fi-rr-shield-check"     href="/qc"           alert={stats.pending_qc > 3} />
                    <StatCard label="Overdue Jobs"     value={stats.overdue_work_orders}  color="red"    icon="fi-rr-clock"            href="/work-orders"  alert={stats.overdue_work_orders > 0} />
                    <StatCard label="Open NCRs"        value={stats.open_ncrs}            color="orange" icon="fi-rr-triangle-warning" href="/ncrs"         alert={stats.open_ncrs > 2} />
                    <StatCard label="Outstanding Invoices" value={stats.draft_invoices}   color="teal"   icon="fi-rr-receipt"          href="/invoices" />
                </div>

                {/* ── Charts Row 1 ── */}
                <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">

                    {/* ── 3D Bar — Monthly Production Volume ── */}
                    <div className="xl:col-span-2 animate-slide-up flex">
                        <div className="card h-full w-full relative overflow-hidden flex flex-col transition-all duration-300 ease-out hover:shadow-premium-lg hover:-translate-y-1 hover:border-brand-200">
                            <div className="absolute -top-20 -right-20 w-56 h-56 rounded-full bg-blue-100/40 blur-3xl pointer-events-none" />
                            <div className="card-header flex items-center justify-between relative">
                                <div>
                                    <h3 className="text-sm font-bold text-surface-800">Monthly Production Volume</h3>
                                    <p className="text-xs text-surface-400 mt-0.5">Work orders created vs delivered — last 6 months</p>
                                </div>
                                <div className="flex items-center gap-2">
                                    <button onClick={() => toggleSeries('Created')}
                                        className={`text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-lg border transition-all ${
                                            hiddenSeries['Created']
                                                ? 'bg-slate-50 border-slate-200 text-slate-400 line-through'
                                                : 'bg-blue-50 border-blue-200 text-blue-700 hover:bg-blue-100'
                                        }`}>● Created</button>
                                    <button onClick={() => toggleSeries('Delivered')}
                                        className={`text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-lg border transition-all ${
                                            hiddenSeries['Delivered']
                                                ? 'bg-slate-50 border-slate-200 text-slate-400 line-through'
                                                : 'bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100'
                                        }`}>● Delivered</button>
                                </div>
                            </div>
                            <div className="card-body relative">
                                <ResponsiveContainer width="100%" height={260}>
                                    <BarChart data={charts.monthlyVolume} barGap={6} barCategoryGap="28%" margin={{ top: 16, right: 20, left: 0, bottom: 0 }}>
                                        <defs>
                                            <linearGradient id="barCreatedFill" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="0%" stopColor="#3b82f6" />
                                                <stop offset="100%" stopColor="#1e40af" />
                                            </linearGradient>
                                            <linearGradient id="barDeliveredFill" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="0%" stopColor="#10b981" />
                                                <stop offset="100%" stopColor="#047857" />
                                            </linearGradient>
                                        </defs>
                                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                                        <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#64748b', fontWeight: 600 }} axisLine={false} tickLine={false} />
                                        <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} width={32} />
                                        <Tooltip content={<ChartTooltip />} cursor={{ fill: 'rgba(148,163,184,0.08)', radius: 8 }} />
                                        {!hiddenSeries['Created'] && (
                                            <Bar dataKey="created" name="Created" fill="#3b82f6" shape={<Bar3D />} isAnimationActive animationDuration={900} animationEasing="ease-out" />
                                        )}
                                        {!hiddenSeries['Delivered'] && (
                                            <Bar dataKey="delivered" name="Delivered" fill="#10b981" shape={<Bar3D />} isAnimationActive animationDuration={1100} animationEasing="ease-out" />
                                        )}
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </div>
                    </div>

                    {/* ── Pipeline Pie (pro 3D + side legend) ── */}
                    <div className="animate-slide-up flex">
                        <div className="card h-full w-full relative overflow-hidden flex flex-col transition-all duration-300 ease-out hover:shadow-premium-lg hover:-translate-y-1 hover:border-brand-200">
                            <div className="absolute -bottom-24 -left-24 w-72 h-72 rounded-full bg-purple-200/40 blur-3xl pointer-events-none" />
                            <div className="absolute -top-24 -right-24 w-64 h-64 rounded-full bg-violet-100/30 blur-3xl pointer-events-none" />
                            <div className="card-header flex items-center justify-between relative">
                                <div>
                                    <h3 className="text-sm font-bold text-surface-800">Work Order Pipeline</h3>
                                    <p className="text-xs text-surface-400 mt-0.5">
                                        {activePieIdx >= 0 ? `Focused on ${charts.pipeline[activePieIdx]?.status}` : 'Tap any slice to focus'}
                                    </p>
                                </div>
                                <div className="w-9 h-9 rounded-xl flex items-center justify-center text-sm shrink-0 bg-gradient-to-br from-purple-400 to-purple-600 text-white shadow-md">
                                    <i className="fi fi-rr-chart-pie-alt leading-none" />
                                </div>
                            </div>
                            <div className="card-body relative">
                                {/* Pie chart with center overlay */}
                                <div className="relative">
                                    <CustomDonut
                                        data={charts.pipeline}
                                        total={pipelineTotal}
                                        activeIdx={renderedActiveIdx}
                                        progress={explodeProgress}
                                        onSliceClick={onPieClick}
                                    />

                                    {/* Center display: big number + sub label */}
                                    <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                                        {activePieIdx >= 0 ? (
                                            <>
                                                <div className="text-[9px] uppercase tracking-wider text-surface-400 font-bold mb-0.5">
                                                    {charts.pipeline[activePieIdx]?.status}
                                                </div>
                                                <div className="text-4xl font-bold tabular-nums leading-none"
                                                     style={{ color: PIPELINE_COLORS[charts.pipeline[activePieIdx]?.status] ?? '#0f172a' }}>
                                                    {charts.pipeline[activePieIdx]?.count}
                                                </div>
                                                <div className="text-[10px] text-surface-500 font-semibold mt-1 tabular-nums">
                                                    {pipelineTotal > 0
                                                        ? `${Math.round((charts.pipeline[activePieIdx]?.count / pipelineTotal) * 100)}% of total`
                                                        : '—'}
                                                </div>
                                            </>
                                        ) : (
                                            <>
                                                <div className="text-4xl font-bold text-surface-900 tabular-nums leading-none bg-gradient-to-br from-surface-900 to-surface-700 bg-clip-text text-transparent">
                                                    {pipelineTotal}
                                                </div>
                                                <div className="text-[10px] uppercase tracking-[0.15em] text-surface-400 font-bold mt-1.5">
                                                    Total Jobs
                                                </div>
                                                <div className="text-[9px] text-surface-400 mt-1 italic">tap a slice</div>
                                            </>
                                        )}
                                    </div>
                                </div>

                                {/* Side legend with progress bars */}
                                <div className="mt-4 pt-3 border-t border-surface-100 space-y-1.5 max-h-44 overflow-y-auto pr-1">
                                    {charts.pipeline.map((entry: any, idx: number) => {
                                        const pct = pipelineTotal > 0 ? (entry.count / pipelineTotal) * 100 : 0;
                                        const color = PIPELINE_COLORS[entry.status] ?? '#94a3b8';
                                        const isActive = activePieIdx === idx;
                                        return (
                                            <button
                                                key={entry.status}
                                                onClick={() => setActivePieIdx(prev => prev === idx ? -1 : idx)}
                                                className={`group w-full flex items-center gap-2.5 px-2 py-1.5 rounded-lg transition-all text-left
                                                    ${isActive ? 'bg-surface-50 ring-1 ring-surface-200 shadow-sm' : 'hover:bg-surface-50/70'}`}
                                            >
                                                <span
                                                    className={`w-2.5 h-2.5 rounded-full shrink-0 transition-transform ${isActive ? 'scale-125' : 'group-hover:scale-110'}`}
                                                    style={{ background: color, boxShadow: `0 0 0 2px white, 0 0 0 3px ${color}40` }}
                                                />
                                                <span className={`text-[11px] font-semibold w-[88px] truncate ${isActive ? 'text-surface-900' : 'text-surface-700'}`}>
                                                    {entry.status}
                                                </span>
                                                <div className="flex-1 h-1.5 bg-surface-100 rounded-full overflow-hidden">
                                                    <div
                                                        className="h-full rounded-full transition-all duration-700 ease-out"
                                                        style={{
                                                            width: `${pct}%`,
                                                            background: `linear-gradient(90deg, ${color}, ${color}cc)`,
                                                            boxShadow: isActive ? `0 0 8px ${color}80` : 'none',
                                                        }}
                                                    />
                                                </div>
                                                <span className={`text-[11px] font-bold tabular-nums w-7 text-right shrink-0 ${isActive ? 'text-surface-900' : 'text-surface-600'}`}>
                                                    {entry.count}
                                                </span>
                                                <span className="text-[9px] font-semibold text-surface-400 tabular-nums w-8 text-right shrink-0">
                                                    {pct.toFixed(0)}%
                                                </span>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* ── Charts Row 2 ── */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

                    {/* QC Pass Rate — Glow Area */}
                    <div className="animate-slide-up">
                        <div className="card h-full relative overflow-hidden transition-all duration-300 ease-out hover:shadow-premium-lg hover:-translate-y-1 hover:border-brand-200">
                            <div className="absolute -top-16 -right-16 w-44 h-44 rounded-full bg-emerald-100/50 blur-3xl pointer-events-none" />
                            <div className="card-header flex items-center justify-between relative">
                                <div>
                                    <h3 className="text-sm font-bold text-surface-800">QC Pass Rate</h3>
                                    <p className="text-xs text-surface-400 mt-0.5">Monthly quality trend (%)</p>
                                </div>
                                <div className="w-9 h-9 rounded-xl flex items-center justify-center text-sm shrink-0 bg-gradient-to-br from-emerald-400 to-emerald-600 text-white shadow-md">
                                    <i className="fi fi-rr-shield-check leading-none" />
                                </div>
                            </div>
                            <div className="card-body relative">
                                <ResponsiveContainer width="100%" height={200}>
                                    <AreaChart data={charts.qcTrend} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                                        <defs>
                                            <linearGradient id="qcGrad" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="0%"  stopColor="#10b981" stopOpacity={0.55} />
                                                <stop offset="50%" stopColor="#10b981" stopOpacity={0.25} />
                                                <stop offset="100%" stopColor="#10b981" stopOpacity={0} />
                                            </linearGradient>
                                            <linearGradient id="qcStroke" x1="0" y1="0" x2="1" y2="0">
                                                <stop offset="0%" stopColor="#34d399" />
                                                <stop offset="100%" stopColor="#059669" />
                                            </linearGradient>
                                            <filter id="qcGlow" x="-20%" y="-20%" width="140%" height="140%">
                                                <feGaussianBlur in="SourceGraphic" stdDeviation="3" result="blur" />
                                                <feMerge>
                                                    <feMergeNode in="blur" />
                                                    <feMergeNode in="SourceGraphic" />
                                                </feMerge>
                                            </filter>
                                        </defs>
                                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                                        <XAxis dataKey="month" tick={{ fontSize: 10, fill: '#94a3b8', fontWeight: 600 }} axisLine={false} tickLine={false} />
                                        <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} width={28} unit="%" />
                                        <Tooltip content={<ChartTooltip />} cursor={{ stroke: '#10b981', strokeWidth: 1, strokeDasharray: '4 4' }} />
                                        <Area
                                            type="monotone" dataKey="pass_rate" name="Pass Rate %"
                                            stroke="url(#qcStroke)" strokeWidth={3} fill="url(#qcGrad)"
                                            dot={{ r: 5, fill: '#10b981', stroke: 'white', strokeWidth: 2 }}
                                            activeDot={{ r: 8, fill: '#10b981', stroke: 'white', strokeWidth: 3, style: { filter: 'url(#qcGlow)' } }}
                                            connectNulls
                                            isAnimationActive animationDuration={1200} animationEasing="ease-out"
                                        />
                                    </AreaChart>
                                </ResponsiveContainer>
                            </div>
                        </div>
                    </div>

                    {/* On-Time Delivery — Stacked 3D Bar */}
                    <div className="animate-slide-up">
                        <div className="card h-full relative overflow-hidden transition-all duration-300 ease-out hover:shadow-premium-lg hover:-translate-y-1 hover:border-brand-200">
                            <div className="absolute -bottom-16 -right-16 w-44 h-44 rounded-full bg-orange-100/40 blur-3xl pointer-events-none" />
                            <div className="card-header flex items-center justify-between relative">
                                <div>
                                    <h3 className="text-sm font-bold text-surface-800">On-Time Delivery</h3>
                                    <p className="text-xs text-surface-400 mt-0.5">Delivered on time vs late</p>
                                </div>
                                <div className="w-9 h-9 rounded-xl flex items-center justify-center text-sm shrink-0 bg-gradient-to-br from-brand-400 to-brand-600 text-white shadow-md">
                                    <i className="fi fi-rr-time-check leading-none" />
                                </div>
                            </div>
                            <div className="card-body relative">
                                <ResponsiveContainer width="100%" height={200}>
                                    <BarChart data={charts.deliveryPerf} barCategoryGap="32%" margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                                        <XAxis dataKey="month" tick={{ fontSize: 10, fill: '#94a3b8', fontWeight: 600 }} axisLine={false} tickLine={false} />
                                        <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} width={26} />
                                        <Tooltip content={<ChartTooltip />} cursor={{ fill: 'rgba(148,163,184,0.08)', radius: 8 }} />
                                        <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 10, paddingTop: 6 }} />
                                        <Bar dataKey="on_time" name="On Time" stackId="a" fill="#10b981" shape={<Bar3D />} isAnimationActive animationDuration={1000} animationEasing="ease-out" />
                                        <Bar dataKey="late"    name="Late"    stackId="a" fill="#ef4444" shape={<Bar3D />} isAnimationActive animationDuration={1000} animationEasing="ease-out" />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </div>
                    </div>

                    {/* NCR Trend — Glow Line */}
                    <div className="animate-slide-up">
                        <div className="card h-full relative overflow-hidden transition-all duration-300 ease-out hover:shadow-premium-lg hover:-translate-y-1 hover:border-brand-200">
                            <div className="absolute -top-16 -left-16 w-44 h-44 rounded-full bg-orange-100/50 blur-3xl pointer-events-none" />
                            <div className="card-header flex items-center justify-between relative">
                                <div>
                                    <h3 className="text-sm font-bold text-surface-800">NCR Trend</h3>
                                    <p className="text-xs text-surface-400 mt-0.5">Non-conformances per month</p>
                                </div>
                                <div className="w-9 h-9 rounded-xl flex items-center justify-center text-sm shrink-0 bg-gradient-to-br from-orange-400 to-orange-600 text-white shadow-md">
                                    <i className="fi fi-rr-triangle-warning leading-none" />
                                </div>
                            </div>
                            <div className="card-body relative">
                                <ResponsiveContainer width="100%" height={200}>
                                    <LineChart data={charts.ncrTrend} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                                        <defs>
                                            <linearGradient id="ncrStroke" x1="0" y1="0" x2="1" y2="0">
                                                <stop offset="0%" stopColor="#fb923c" />
                                                <stop offset="100%" stopColor="#ea580c" />
                                            </linearGradient>
                                            <filter id="ncrGlow" x="-20%" y="-20%" width="140%" height="140%">
                                                <feGaussianBlur in="SourceGraphic" stdDeviation="2.5" result="blur" />
                                                <feMerge>
                                                    <feMergeNode in="blur" />
                                                    <feMergeNode in="SourceGraphic" />
                                                </feMerge>
                                            </filter>
                                        </defs>
                                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                                        <XAxis dataKey="month" tick={{ fontSize: 10, fill: '#94a3b8', fontWeight: 600 }} axisLine={false} tickLine={false} />
                                        <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} width={26} />
                                        <Tooltip content={<ChartTooltip />} cursor={{ stroke: '#fb923c', strokeWidth: 1, strokeDasharray: '4 4' }} />
                                        <Line
                                            type="monotone" dataKey="ncrs" name="NCRs"
                                            stroke="url(#ncrStroke)" strokeWidth={3}
                                            dot={{ r: 5, fill: '#f97316', stroke: 'white', strokeWidth: 2 }}
                                            activeDot={{ r: 8, fill: '#f97316', stroke: 'white', strokeWidth: 3, style: { filter: 'url(#ncrGlow)' } }}
                                            isAnimationActive animationDuration={1300} animationEasing="ease-out"
                                        />
                                    </LineChart>
                                </ResponsiveContainer>
                            </div>
                        </div>
                    </div>
                </div>

                {/* ── Live Dashboard CTA ── */}
                <div className="glass bg-gradient-to-r from-surface-800 to-surface-900 !border-surface-700/50 p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 animate-fade-in transition-all duration-300 ease-out hover:-translate-y-1 hover:shadow-[0_20px_50px_-12px_rgba(16,185,129,0.4)] hover:!border-emerald-500/40">
                    <div className="flex items-center gap-4">
                        <div className="w-11 h-11 rounded-2xl bg-emerald-500/20 flex items-center justify-center shrink-0">
                            <i className="fi fi-rr-monitor text-emerald-400 text-lg leading-none" />
                        </div>
                        <div>
                            <h3 className="font-semibold text-white">Management Live Dashboard</h3>
                            <p className="text-sm text-surface-400 mt-0.5">Real-time view of all active production — designed for wall-mounted screens</p>
                        </div>
                    </div>
                    <a href="/dashboard/live" target="_blank" rel="noopener noreferrer"
                        className="btn-primary btn-sm whitespace-nowrap !from-emerald-500 !to-emerald-600 hover:!from-emerald-400 hover:!to-emerald-500">
                        <i className="fi fi-rr-monitor leading-none" /> Open Live View
                    </a>
                </div>

                {/* ── Recent Work Orders ── */}
                <div className="card animate-slide-up transition-all duration-300 ease-out hover:shadow-premium-lg hover:-translate-y-0.5 hover:border-brand-200">
                    <div className="card-header flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-xl flex items-center justify-center text-sm shrink-0 bg-gradient-to-br from-brand-400 to-brand-600 text-white shadow-md">
                                <i className="fi fi-rr-clipboard-list leading-none" />
                            </div>
                            <div>
                                <h2 className="text-sm font-semibold text-surface-800">Recent Jobs</h2>
                                <p className="text-xs text-surface-400 mt-0.5">Latest production jobs across all centers</p>
                            </div>
                        </div>
                        <Link href="/work-orders" className="btn-outline btn-xs">
                            View all <i className="fi fi-rr-arrow-right leading-none text-[10px]" />
                        </Link>
                    </div>

                    {/* Desktop table */}
                    <div className="hidden md:block overflow-x-auto">
                        <table className="premium-table">
                            <thead>
                                <tr>
                                    {['Job Number', 'Product', 'Customer', 'Status', 'Progress', 'Priority', 'Due Date'].map(h => (
                                        <th key={h}>{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {recentWorkOrders.map((wo: any) => (
                                    <tr key={wo.id} className={wo.is_overdue ? '!bg-red-50/40' : ''}>
                                        <td>
                                            <Link href={`/work-orders/${wo.id}`} className="block hover:text-brand-700 group">
                                                <div className="font-bold text-surface-900 text-sm group-hover:text-brand-600">
                                                    Job #{wo.job_number ?? '—'}
                                                </div>
                                                <div className="text-[11px] text-surface-400 font-mono mt-0.5">{wo.wo_number}</div>
                                            </Link>
                                        </td>
                                        <td className="text-surface-800 font-medium">{wo.product}</td>
                                        <td className="text-surface-500">{wo.customer}</td>
                                        <td>
                                            <span className={`badge ${STATUS_BADGE_MAP[wo.status] ?? 'badge-slate'}`}>
                                                {wo.status_label}
                                            </span>
                                        </td>
                                        <td className="w-36">
                                            <ProgressCell pct={wo.progress_pct} />
                                        </td>
                                        <td>
                                            <span className={`badge ${PRIORITY_BADGE_MAP[wo.priority] ?? 'badge-blue'}`}>
                                                {wo.priority}
                                            </span>
                                        </td>
                                        <td className="text-surface-500">
                                            {wo.is_overdue
                                                ? <span className="flex items-center gap-1.5 text-red-600 font-semibold">
                                                    <i className="fi fi-rr-clock leading-none text-xs" />{wo.due_date}
                                                  </span>
                                                : wo.due_date ?? '—'}
                                        </td>
                                    </tr>
                                ))}
                                {recentWorkOrders.length === 0 && (
                                    <tr>
                                        <td colSpan={7}>
                                            <div className="empty-state">
                                                <div className="empty-state-icon"><i className="fi fi-rr-clipboard-list" /></div>
                                                <p className="empty-state-title">No work orders yet</p>
                                                <p className="empty-state-text">Work orders will appear here once created.</p>
                                            </div>
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* Mobile card list */}
                    <div className="md:hidden card-body space-y-3">
                        {recentWorkOrders.map((wo: any) => (
                            <Link
                                key={wo.id}
                                href={`/work-orders/${wo.id}`}
                                className={`block rounded-xl border p-3.5 transition-all hover:shadow-md ${wo.is_overdue ? 'border-red-200 bg-red-50/40' : 'border-surface-100 bg-surface-50/50 hover:bg-white'}`}
                            >
                                <div className="flex items-center justify-between mb-2">
                                    <div>
                                        <div className="font-bold text-surface-900 text-sm">Job #{wo.job_number ?? '—'}</div>
                                        <div className="text-[10px] text-surface-400 font-mono">{wo.wo_number}</div>
                                    </div>
                                    <span className={`badge ${STATUS_BADGE_MAP[wo.status] ?? 'badge-slate'}`}>
                                        {wo.status_label}
                                    </span>
                                </div>
                                <p className="text-sm font-medium text-surface-800 truncate">{wo.product}</p>
                                <p className="text-xs text-surface-500 mt-0.5">{wo.customer}</p>
                                <div className="mt-2.5">
                                    <ProgressCell pct={wo.progress_pct} />
                                </div>
                                <div className="flex items-center justify-between mt-2 pt-2 border-t border-surface-100">
                                    <span className={`badge ${PRIORITY_BADGE_MAP[wo.priority] ?? 'badge-blue'}`}>
                                        {wo.priority}
                                    </span>
                                    <span className={`text-xs ${wo.is_overdue ? 'text-red-600 font-semibold' : 'text-surface-500'}`}>
                                        {wo.is_overdue && <i className="fi fi-rr-clock leading-none text-[10px] mr-1" />}
                                        {wo.due_date ?? '—'}
                                    </span>
                                </div>
                            </Link>
                        ))}
                        {recentWorkOrders.length === 0 && (
                            <div className="empty-state">
                                <div className="empty-state-icon"><i className="fi fi-rr-clipboard-list" /></div>
                                <p className="empty-state-title">No work orders yet</p>
                                <p className="empty-state-text">Work orders will appear here once created.</p>
                            </div>
                        )}
                    </div>
                </div>

            </div>
        </AppLayout>
    );
}
