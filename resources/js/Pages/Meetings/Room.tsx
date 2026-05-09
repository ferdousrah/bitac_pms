import { useState, useEffect, useRef, useCallback } from 'react';
import { router } from '@inertiajs/react';
import { motion, AnimatePresence } from 'motion/react';
import {
    Users, Send, Mic, MicOff, MonitorPlay, MessageSquare,
    Phone, PhoneOff, Copy, Bot, User, Clock, FileText,
    Play, Pause, SkipForward, SkipBack, Volume2, VolumeX,
    ChevronLeft, ChevronRight, Sparkles, LogOut, Settings,
    Presentation as PresentationIcon, Loader2, PhoneCall, Headphones,
    Radio, Wifi, WifiOff, Paperclip, X, Image as ImageIcon,
} from 'lucide-react';
import axios from 'axios';
import { WebRTCManager, type PeerState } from '@/lib/WebRTCManager';

/* ═══════════════════════════════════════════════════════════════════
   Types
   ═══════════════════════════════════════════════════════════════════ */
interface MeetingMsg {
    id: number;
    sender_type: 'user' | 'ai' | 'system';
    sender_name: string;
    user_id: number | null;
    content: string;
    message_type: string;
    metadata: any;
    created_at: string;
}

interface Participant {
    id: number;
    user_id: number;
    name: string;
    role: string;
    is_online: boolean;
    is_speaking?: boolean;
}

interface SlideData {
    title: string;
    body?: string;
    bullets?: string[];
    kpis?: { label: string; value: string; trend?: string; color?: string }[];
    chart?: { type: string; title: string; data: { label: string; value: number }[] };
    table?: { headers: string[]; rows: Record<string, any>[] };
    image_url?: string;
    shared_by?: string;
    layout?: string;
    speaker_notes?: string;
}

interface ActionItem {
    id: number;
    description: string;
    assigned_to_user_id: number | null;
    assigned_to_name: string | null;
    due_date: string | null;
    status: 'pending' | 'in_progress' | 'completed' | 'cancelled';
    priority: 'low' | 'normal' | 'high';
    context?: string | null;
    completed_at: string | null;
    created_at: string;
}

interface Decision {
    id: number;
    description: string;
    context: string | null;
    decided_by_user_id: number | null;
    decided_by_name: string | null;
    created_at: string;
}

interface Props {
    meeting: any;
    messages: MeetingMsg[];
    participants: Participant[];
    actionItems: ActionItem[];
    decisions: Decision[];
    currentUserId: number;
}

/* ═══════════════════════════════════════════════════════════════════
   Chart Colors
   ═══════════════════════════════════════════════════════════════════ */
const CHART_COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899', '#14b8a6'];

/* ═══════════════════════════════════════════════════════════════════
   Helper: compact number format (1.2K, 3.4M, 5.6B)
   ═══════════════════════════════════════════════════════════════════ */
function compactNum(n: number): string {
    if (n === 0) return '0';
    const abs = Math.abs(n);
    if (abs >= 1e9) return (n / 1e9).toFixed(1) + 'B';
    if (abs >= 1e6) return (n / 1e6).toFixed(1) + 'M';
    if (abs >= 1e3) return (n / 1e3).toFixed(1) + 'K';
    return n.toLocaleString();
}

/* ═══════════════════════════════════════════════════════════════════
   Mini Bar Chart (responsive, contained)
   ═══════════════════════════════════════════════════════════════════ */
function MiniBar({ data }: { data: { label: string; value: number }[] }) {
    const max = Math.max(...data.map(d => d.value), 1);
    const VB_W = 400;
    const VB_H = 180;
    const padX = 8;
    const padTop = 20;
    const padBottom = 25;
    const plotH = VB_H - padTop - padBottom;
    const slotW = (VB_W - 2 * padX) / data.length;
    const barW = Math.min(slotW * 0.7, 40);
    const barOffset = (slotW - barW) / 2;

    return (
        <div className="w-full max-w-[500px] mx-auto">
            <svg viewBox={`0 0 ${VB_W} ${VB_H}`} className="w-full h-auto" preserveAspectRatio="xMidYMid meet">
                {/* Baseline */}
                <line x1={padX} y1={padTop + plotH} x2={VB_W - padX} y2={padTop + plotH}
                    stroke="rgba(255,255,255,0.15)" strokeWidth="1" />
                {data.map((d, i) => {
                    const h = Math.max((d.value / max) * plotH, 2);
                    const x = padX + i * slotW + barOffset;
                    const y = padTop + plotH - h;
                    const color = CHART_COLORS[i % CHART_COLORS.length];
                    return (
                        <g key={i}>
                            <rect
                                x={x} y={y} width={barW} height={h} rx={2}
                                fill={color}
                                style={{
                                    animation: `barGrow 0.6s ${i * 0.08}s cubic-bezier(0.16, 1, 0.3, 1) both`,
                                    transformOrigin: `${x + barW / 2}px ${padTop + plotH}px`,
                                }}
                            />
                            <text
                                x={x + barW / 2} y={VB_H - 10}
                                textAnchor="middle" fontSize="8" fill="rgba(255,255,255,0.7)"
                            >
                                {d.label.length > 10 ? d.label.slice(0, 9) + '…' : d.label}
                            </text>
                            <text
                                x={x + barW / 2} y={y - 4}
                                textAnchor="middle" fontSize="10" fill="#fff" fontWeight="bold"
                            >
                                {compactNum(d.value)}
                            </text>
                        </g>
                    );
                })}
            </svg>
            <style>{`
                @keyframes barGrow {
                    from { transform: scaleY(0); }
                    to { transform: scaleY(1); }
                }
            `}</style>
        </div>
    );
}

/* ═══════════════════════════════════════════════════════════════════
   Mini Pie Chart (responsive, contained)
   ═══════════════════════════════════════════════════════════════════ */
function MiniPie({ data }: { data: { label: string; value: number }[] }) {
    const total = data.reduce((s, d) => s + d.value, 0) || 1;
    let cum = -90;
    const cx = 90, cy = 90, r = 70;
    const toRad = (a: number) => (a * Math.PI) / 180;
    return (
        <div className="flex items-center gap-4 max-w-full">
            <svg viewBox="0 0 180 180" className="w-32 h-32 shrink-0">
                {data.map((d, i) => {
                    const angle = (d.value / total) * 360;
                    const start = cum; cum += angle;
                    const x1 = cx + r * Math.cos(toRad(start));
                    const y1 = cy + r * Math.sin(toRad(start));
                    const x2 = cx + r * Math.cos(toRad(start + angle));
                    const y2 = cy + r * Math.sin(toRad(start + angle));
                    const path = `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${angle > 180 ? 1 : 0} 1 ${x2} ${y2} Z`;
                    return <motion.path key={i} d={path} fill={CHART_COLORS[i % CHART_COLORS.length]}
                        stroke="rgba(0,0,0,0.3)" strokeWidth={1}
                        initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }}
                        transition={{ duration: 0.4, delay: i * 0.08 }} />;
                })}
            </svg>
            <div className="space-y-1.5 min-w-0 flex-1 overflow-hidden">
                {data.map((d, i) => (
                    <div key={i} className="flex items-center gap-2 text-xs text-white/80 truncate">
                        <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: CHART_COLORS[i % CHART_COLORS.length] }} />
                        <span className="truncate">{d.label}: {compactNum(d.value)}</span>
                    </div>
                ))}
            </div>
        </div>
    );
}

/* ═══════════════════════════════════════════════════════════════════
   Shared Screen Slide Renderer
   ═══════════════════════════════════════════════════════════════════ */
function SharedSlide({ slide }: { slide: SlideData }) {
    // Image-only slide (when user shares a screenshot to the shared screen)
    if (slide.layout === 'image' && slide.image_url) {
        return (
            <div className="absolute inset-0 flex flex-col p-4 md:p-6 overflow-hidden">
                <div className="flex items-center justify-between mb-3 shrink-0">
                    <motion.h2 className="text-lg md:text-xl font-bold text-white" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                        {slide.title}
                    </motion.h2>
                    {slide.shared_by && (
                        <span className="text-[10px] text-indigo-300 bg-indigo-500/10 px-2 py-1 rounded-full border border-indigo-500/30">
                            Shared by {slide.shared_by}
                        </span>
                    )}
                </div>
                <motion.div
                    className="flex-1 flex items-center justify-center bg-black/30 rounded-xl overflow-hidden min-h-0"
                    initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
                >
                    <img
                        src={slide.image_url}
                        alt={slide.title}
                        className="max-w-full max-h-full object-contain"
                    />
                </motion.div>
                {slide.body && slide.body !== '[Shared an image]' && (
                    <div className="mt-3 px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-white/80 text-sm italic shrink-0">
                        "{slide.body}"
                    </div>
                )}
            </div>
        );
    }

    return (
        <div className="absolute inset-0 flex flex-col p-6 md:p-8 overflow-y-auto overflow-x-hidden">
            <motion.h2 className="text-xl md:text-2xl font-bold text-white mb-4 shrink-0" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                {slide.title}
            </motion.h2>
            {slide.body && <p className="text-white/70 text-sm mb-4 leading-relaxed shrink-0">{slide.body}</p>}

            {/* KPIs */}
            {slide.kpis && slide.kpis.length > 0 && (
                <div className={`grid gap-3 mb-4 shrink-0 ${slide.kpis.length <= 2 ? 'grid-cols-2' : slide.kpis.length === 3 ? 'grid-cols-3' : 'grid-cols-4'}`}>
                    {slide.kpis.map((k, i) => (
                        <motion.div key={i} className="bg-white/10 rounded-xl p-3 border border-white/10 min-w-0"
                            initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
                            transition={{ delay: i * 0.08 }}>
                            <div className="text-white/60 text-[10px] uppercase tracking-wider truncate">{k.label}</div>
                            <div className="text-lg md:text-xl font-bold mt-1 truncate" style={{ color: k.color || '#fff' }} title={k.value}>{k.value}</div>
                            {k.trend && <div className={`text-[10px] mt-0.5 ${k.trend === 'up' ? 'text-emerald-400' : k.trend === 'down' ? 'text-red-400' : 'text-white/40'}`}>
                                {k.trend === 'up' ? '↑ up' : k.trend === 'down' ? '↓ down' : '→ steady'}
                            </div>}
                        </motion.div>
                    ))}
                </div>
            )}

            {/* Bullets */}
            {slide.bullets && slide.bullets.length > 0 && (
                <ul className="space-y-2 mb-4 shrink-0">
                    {slide.bullets.map((b, i) => (
                        <motion.li key={i} className="flex items-start gap-2 text-white/85 text-sm"
                            initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.08 }}>
                            <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 mt-1.5 shrink-0" />
                            <span className="min-w-0 break-words">{b}</span>
                        </motion.li>
                    ))}
                </ul>
            )}

            {/* Chart */}
            {slide.chart && slide.chart.data && slide.chart.data.length > 0 && (
                <div className="flex flex-col items-center justify-center mb-4 max-w-full overflow-hidden">
                    <div className="text-xs text-white/50 mb-2 font-semibold uppercase tracking-wider text-center">{slide.chart.title}</div>
                    <div className="w-full max-w-[600px] px-4">
                        {slide.chart.type === 'bar' && <MiniBar data={slide.chart.data} />}
                        {slide.chart.type === 'pie' && <MiniPie data={slide.chart.data} />}
                        {slide.chart.type === 'line' && <MiniBar data={slide.chart.data} />}
                    </div>
                </div>
            )}

            {/* Table */}
            {slide.table && slide.table.rows && slide.table.rows.length > 0 && (
                <div className="overflow-x-auto mb-4 max-w-full">
                    <table className="w-full text-xs">
                        <thead><tr className="border-b border-white/20">
                            {slide.table.headers.map((h, i) => <th key={i} className="text-left py-2 px-3 text-white/60 font-semibold uppercase">{h}</th>)}
                        </tr></thead>
                        <tbody>
                            {slide.table.rows.map((row, i) => (
                                <tr key={i} className="border-b border-white/5">
                                    {slide.table!.headers.map((h, j) => <td key={j} className="py-2 px-3 text-white/80">{String(row[h] ?? '')}</td>)}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}

/* ═══════════════════════════════════════════════════════════════════
   Markdown-lite for chat messages
   ═══════════════════════════════════════════════════════════════════ */
function ChatMarkdown({ text }: { text: string }) {
    const lines = text.split('\n');
    return (
        <div className="space-y-0.5 text-[13px] leading-relaxed">
            {lines.map((line, i) => {
                if (line.startsWith('### ')) return <h4 key={i} className="font-bold text-xs mt-1.5">{line.slice(4)}</h4>;
                if (line.startsWith('## ')) return <h3 key={i} className="font-bold text-sm mt-1.5">{line.slice(3)}</h3>;
                let html = line.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>').replace(/`(.+?)`/g, '<code class="px-1 py-0.5 bg-black/20 rounded text-[11px]">$1</code>');
                if (/^[-*]\s/.test(line)) return <div key={i} className="flex gap-1.5 pl-1"><span className="text-indigo-400 mt-0.5">•</span><span dangerouslySetInnerHTML={{ __html: html.replace(/^[-*]\s/, '') }} /></div>;
                if (line.trim() === '') return <div key={i} className="h-1" />;
                return <div key={i} dangerouslySetInnerHTML={{ __html: html }} />;
            })}
        </div>
    );
}

/* ═══════════════════════════════════════════════════════════════════
   Intelligence Panel (Actions / Decisions / Notes)
   ═══════════════════════════════════════════════════════════════════ */
function IntelligencePanel({
    notes, actionItems, decisions, participants, currentUserId, isActive,
    newItemDraft, setNewItemDraft, onAddItem, onToggleStatus, onDeleteItem, onDeleteDecision,
}: {
    notes: any;
    actionItems: ActionItem[];
    decisions: Decision[];
    participants: Participant[];
    currentUserId: number;
    isActive: boolean;
    newItemDraft: string;
    setNewItemDraft: (v: string) => void;
    onAddItem: () => void;
    onToggleStatus: (item: ActionItem) => void;
    onDeleteItem: (id: number) => void;
    onDeleteDecision: (id: number) => void;
}) {
    const [tab, setTab] = useState<'actions' | 'decisions' | 'notes'>('actions');
    const pendingCount = actionItems.filter(a => a.status === 'pending' || a.status === 'in_progress').length;

    return (
        <>
            {/* Tab Header */}
            <div className="p-2 border-b border-white/10">
                <div className="flex items-center gap-1">
                    <button
                        onClick={() => setTab('actions')}
                        className={`flex-1 px-2.5 py-1.5 rounded-lg text-[11px] font-bold transition-colors flex items-center justify-center gap-1.5 ${
                            tab === 'actions' ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40' : 'text-white/60 hover:text-white hover:bg-white/5'
                        }`}
                    >
                        ☐ Actions
                        {pendingCount > 0 && <span className="px-1.5 py-0.5 rounded-full bg-amber-500/30 text-amber-200 text-[9px] font-bold">{pendingCount}</span>}
                    </button>
                    <button
                        onClick={() => setTab('decisions')}
                        className={`flex-1 px-2.5 py-1.5 rounded-lg text-[11px] font-bold transition-colors flex items-center justify-center gap-1.5 ${
                            tab === 'decisions' ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40' : 'text-white/60 hover:text-white hover:bg-white/5'
                        }`}
                    >
                        ✓ Decisions
                        {decisions.length > 0 && <span className="px-1.5 py-0.5 rounded-full bg-emerald-500/30 text-emerald-200 text-[9px] font-bold">{decisions.length}</span>}
                    </button>
                    <button
                        onClick={() => setTab('notes')}
                        className={`flex-1 px-2.5 py-1.5 rounded-lg text-[11px] font-bold transition-colors flex items-center justify-center gap-1.5 ${
                            tab === 'notes' ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40' : 'text-white/60 hover:text-white hover:bg-white/5'
                        }`}
                    >
                        📝 Notes
                    </button>
                </div>
                <div className="flex items-center gap-1.5 mt-2 px-1">
                    <Sparkles className="w-2.5 h-2.5 text-indigo-400" />
                    <span className="text-[9px] text-white/50 italic">Oli auto-extracts these every 5 messages</span>
                </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-3">
                {/* ── Actions Tab ── */}
                {tab === 'actions' && (
                    <div className="space-y-2">
                        {actionItems.length === 0 ? (
                            <div className="text-center text-white/50 text-sm mt-6">
                                <div className="text-3xl mb-2">📋</div>
                                <p className="font-medium text-white/70">No action items yet</p>
                                <p className="text-xs mt-1.5 text-white/40">
                                    Oli will extract action items as people speak.<br/>You can also add them manually below.
                                </p>
                            </div>
                        ) : (
                            actionItems.map(item => {
                                const isDone = item.status === 'completed';
                                const priorityColor = item.priority === 'high' ? 'border-red-500/40' : item.priority === 'low' ? 'border-white/10' : 'border-amber-500/30';
                                const isMine = item.assigned_to_user_id === currentUserId;
                                return (
                                    <motion.div
                                        key={item.id}
                                        className={`group rounded-xl p-2.5 border transition-all ${
                                            isDone ? 'bg-emerald-500/5 border-emerald-500/20 opacity-60' : `bg-white/5 ${priorityColor}`
                                        } ${isMine && !isDone ? 'ring-1 ring-indigo-500/40' : ''}`}
                                        initial={{ opacity: 0, y: 5 }}
                                        animate={{ opacity: isDone ? 0.6 : 1, y: 0 }}
                                    >
                                        <div className="flex items-start gap-2">
                                            <button
                                                onClick={() => onToggleStatus(item)}
                                                className={`mt-0.5 shrink-0 w-4 h-4 rounded border-2 transition-all ${
                                                    isDone
                                                        ? 'bg-emerald-500 border-emerald-500 flex items-center justify-center'
                                                        : 'border-white/40 hover:border-amber-400'
                                                }`}
                                            >
                                                {isDone && <span className="text-white text-[9px] font-bold">✓</span>}
                                            </button>
                                            <div className="flex-1 min-w-0">
                                                <div className={`text-xs font-medium ${isDone ? 'text-white/50 line-through' : 'text-white/90'}`}>
                                                    {item.description}
                                                </div>
                                                <div className="flex items-center gap-2 mt-1 flex-wrap">
                                                    {item.assigned_to_name && (
                                                        <span className={`inline-flex items-center gap-0.5 text-[9px] ${isMine ? 'text-indigo-300 font-bold' : 'text-white/50'}`}>
                                                            👤 {item.assigned_to_name}{isMine && ' (you)'}
                                                        </span>
                                                    )}
                                                    {item.due_date && (
                                                        <span className="inline-flex items-center gap-0.5 text-[9px] text-orange-300">
                                                            📅 {item.due_date}
                                                        </span>
                                                    )}
                                                    {item.priority === 'high' && (
                                                        <span className="inline-flex items-center px-1.5 py-0.5 rounded-full bg-red-500/20 text-red-300 text-[9px] font-bold">HIGH</span>
                                                    )}
                                                </div>
                                            </div>
                                            <button
                                                onClick={() => onDeleteItem(item.id)}
                                                className="opacity-0 group-hover:opacity-100 text-white/30 hover:text-red-400 transition-all shrink-0"
                                                title="Delete"
                                            >
                                                <span className="text-sm">✕</span>
                                            </button>
                                        </div>
                                    </motion.div>
                                );
                            })
                        )}
                    </div>
                )}

                {/* ── Decisions Tab ── */}
                {tab === 'decisions' && (
                    <div className="space-y-2">
                        {decisions.length === 0 ? (
                            <div className="text-center text-white/50 text-sm mt-6">
                                <div className="text-3xl mb-2">✓</div>
                                <p className="font-medium text-white/70">No decisions tracked yet</p>
                                <p className="text-xs mt-1.5 text-white/40">
                                    When the team agrees on something,<br />Oli will log it here automatically.
                                </p>
                            </div>
                        ) : (
                            decisions.map(d => (
                                <motion.div
                                    key={d.id}
                                    className="group rounded-xl p-2.5 bg-emerald-500/5 border border-emerald-500/20"
                                    initial={{ opacity: 0, y: 5 }}
                                    animate={{ opacity: 1, y: 0 }}
                                >
                                    <div className="flex items-start gap-2">
                                        <div className="w-4 h-4 rounded-full bg-emerald-500/30 border-2 border-emerald-500 shrink-0 flex items-center justify-center">
                                            <span className="text-emerald-300 text-[9px] font-bold">✓</span>
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="text-xs text-white/90 font-medium">{d.description}</div>
                                            {d.context && <div className="text-[10px] text-white/50 italic mt-1">{d.context}</div>}
                                            {d.decided_by_name && (
                                                <div className="text-[9px] text-emerald-400 mt-1">
                                                    by {d.decided_by_name}
                                                </div>
                                            )}
                                        </div>
                                        <button
                                            onClick={() => onDeleteDecision(d.id)}
                                            className="opacity-0 group-hover:opacity-100 text-white/30 hover:text-red-400 transition-all shrink-0"
                                        >
                                            <span className="text-sm">✕</span>
                                        </button>
                                    </div>
                                </motion.div>
                            ))
                        )}
                    </div>
                )}

                {/* ── Notes Tab ── */}
                {tab === 'notes' && (
                    <>
                        {notes?.summary ? (
                            <div className="text-white/80 text-xs leading-relaxed">
                                <ChatMarkdown text={notes.summary} />
                            </div>
                        ) : (
                            <div className="text-center text-white/50 text-sm mt-6">
                                <FileText className="w-8 h-8 mx-auto mb-2 text-white/30" />
                                <p className="font-medium text-white/70">No notes yet</p>
                                <p className="text-xs mt-1.5 text-white/40">Oli will generate polished meeting notes when the meeting ends.</p>
                            </div>
                        )}
                    </>
                )}
            </div>

            {/* Add Action Item Input */}
            {tab === 'actions' && isActive && (
                <div className="p-2 border-t border-white/10 bg-slate-900/80">
                    <div className="flex items-center gap-1.5">
                        <input
                            type="text"
                            value={newItemDraft}
                            onChange={e => setNewItemDraft(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && onAddItem()}
                            placeholder="Add action item manually..."
                            className="flex-1 bg-white/10 border border-white/15 rounded-lg px-2 py-1.5 text-[11px] text-white
                                       placeholder-white/40 focus:outline-none focus:border-amber-500/50"
                        />
                        <button
                            onClick={onAddItem}
                            disabled={!newItemDraft.trim()}
                            className="px-2 py-1.5 rounded-lg bg-amber-500/20 text-amber-300 disabled:opacity-30 hover:bg-amber-500/30 transition-colors text-[11px] font-bold"
                        >
                            Add
                        </button>
                    </div>
                </div>
            )}
        </>
    );
}

/* ═══════════════════════════════════════════════════════════════════
   MAIN: Meeting Room
   ═══════════════════════════════════════════════════════════════════ */
export default function MeetingRoom({ meeting, messages: initialMessages, participants: initialParticipants, actionItems: initialActionItems = [], decisions: initialDecisions = [], currentUserId }: Props) {
    const [messages, setMessages] = useState<MeetingMsg[]>(initialMessages);
    const [participants, setParticipants] = useState<Participant[]>(initialParticipants);
    const [input, setInput] = useState('');
    const [sending, setSending] = useState(false);
    const [meetingStatus, setMeetingStatus] = useState(meeting.status);
    const [slides, setSlides] = useState<SlideData[]>(meeting.presentation_state?.slides ?? []);
    const [currentSlideIdx, setCurrentSlideIdx] = useState(meeting.presentation_state?.current_index ?? 0);
    const [showParticipants, setShowParticipants] = useState(true);
    const [showNotes, setShowNotes] = useState(false);
    const [notes, setNotes] = useState<any>(meeting.meeting_notes);
    const [isSpeaking, setIsSpeaking] = useState(false);
    const [isMuted, setIsMuted] = useState(false);
    const [newSlideFlash, setNewSlideFlash] = useState(false);

    // Voice input state
    const [isListening, setIsListening] = useState(false);
    const [listenMode, setListenMode] = useState<'push' | 'continuous'>('push');
    const [interimTranscript, setInterimTranscript] = useState('');
    const [voiceLang, setVoiceLang] = useState<'en-US' | 'bn-BD'>('en-US');
    const [voiceSupported, setVoiceSupported] = useState(true);
    const [voiceError, setVoiceError] = useState<string | null>(null);

    // WebRTC audio call state
    const [inCall, setInCall] = useState(false);
    const [callJoining, setCallJoining] = useState(false);
    const [micMuted, setMicMuted] = useState(false);
    const [callError, setCallError] = useState<string | null>(null);
    const [remotePeers, setRemotePeers] = useState<Map<number, PeerState>>(new Map());
    const [webRTCSupported, setWebRTCSupported] = useState(true);

    // Meeting Intelligence state
    const [actionItems, setActionItems] = useState<ActionItem[]>(initialActionItems);
    const [decisions, setDecisions] = useState<Decision[]>(initialDecisions);
    const [showIntelligence, setShowIntelligence] = useState(true);
    const [newItemDraft, setNewItemDraft] = useState('');

    // Auto-play presentation mode (for Oli intro / full decks)
    const [autoPlayPresentation, setAutoPlayPresentation] = useState(false);
    const autoPlayTimeoutRef = useRef<ReturnType<typeof setTimeout>>();

    // Image/file upload state
    const [pendingFile, setPendingFile] = useState<File | null>(null);
    const [pendingFilePreview, setPendingFilePreview] = useState<string | null>(null);
    const [shareToScreen, setShareToScreen] = useState(true); // default: share images to shared screen
    const fileInputRef = useRef<HTMLInputElement>(null);

    const chatEndRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const pollRef = useRef<ReturnType<typeof setInterval>>();
    const lastMsgIdRef = useRef<number>(initialMessages.length ? initialMessages[initialMessages.length - 1].id : 0);
    const recognitionRef = useRef<any>(null);
    const silenceTimerRef = useRef<ReturnType<typeof setTimeout>>();
    const webRTCRef = useRef<WebRTCManager | null>(null);

    const isHost = meeting.host_user_id === currentUserId;
    const isActive = meetingStatus === 'active';
    const isEnded = meetingStatus === 'ended';

    /* ── Scroll chat to bottom ─────────────────────────────────── */
    const scrollChat = useCallback(() => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, []);
    useEffect(scrollChat, [messages]);

    /* ── Polling for new messages ──────────────────────────────── */
    useEffect(() => {
        if (isEnded) return;
        pollRef.current = setInterval(async () => {
            try {
                const { data } = await axios.get(`/meetings/${meeting.id}/poll`, {
                    params: { since_id: lastMsgIdRef.current },
                });
                if (data.messages?.length) {
                    setMessages(prev => {
                        const existingIds = new Set(prev.map(m => m.id));
                        const newMsgs = data.messages.filter((m: MeetingMsg) => !existingIds.has(m.id));
                        if (newMsgs.length) {
                            lastMsgIdRef.current = Math.max(...newMsgs.map((m: MeetingMsg) => m.id));
                            return [...prev, ...newMsgs];
                        }
                        return prev;
                    });
                }
                if (data.participants) setParticipants(data.participants);
                if (data.status) setMeetingStatus(data.status);
                if (data.action_items) setActionItems(data.action_items);
                if (data.decisions) setDecisions(data.decisions);

                // Sync presentation state
                if (data.presentation_state) {
                    const newSlides = data.presentation_state.slides ?? [];
                    if (newSlides.length > slides.length) {
                        setSlides(newSlides);
                        setCurrentSlideIdx(data.presentation_state.current_index ?? newSlides.length - 1);
                        setNewSlideFlash(true);
                        setTimeout(() => setNewSlideFlash(false), 3000);
                    }
                }
            } catch { /* ignore poll errors */ }
        }, 2500);

        return () => { if (pollRef.current) clearInterval(pollRef.current); };
    }, [meeting.id, isEnded, slides.length]);

    /* ── Send message ─────────────────────────────────────────── */
    const sendMessage = async () => {
        const text = input.trim();
        if ((!text && !pendingFile) || sending) return;
        setInput('');
        setSending(true);

        const fileToSend = pendingFile;
        const filePreview = pendingFilePreview;
        const shareFlag = shareToScreen;
        clearPendingFile();

        try {
            let postData: any;
            const headers: any = {};
            if (fileToSend) {
                postData = new FormData();
                postData.append('content', text);
                postData.append('image', fileToSend);
                postData.append('share_screen', shareFlag ? '1' : '0');
                headers['Content-Type'] = 'multipart/form-data';
            } else {
                postData = { content: text };
            }
            const { data } = await axios.post(`/meetings/${meeting.id}/messages`, postData, { headers });
            if (data.message) {
                setMessages(prev => {
                    const exists = prev.some(m => m.id === data.message.id);
                    return exists ? prev : [...prev, data.message];
                });
                lastMsgIdRef.current = Math.max(lastMsgIdRef.current, data.message.id);
            }
            // Oli response comes back immediately
            if (data.oli_response) {
                setMessages(prev => {
                    const exists = prev.some(m => m.id === data.oli_response.id);
                    return exists ? prev : [...prev, data.oli_response];
                });
                lastMsgIdRef.current = Math.max(lastMsgIdRef.current, data.oli_response.id);

                // Check for full presentation (Oli intro / multi-slide deck) — synced via polling
                // The poll loop will detect new slides; auto-play when it syncs them.
                if (data.oli_response.metadata?.is_full_presentation) {
                    setAutoPlayPresentation(true);
                    setNewSlideFlash(true);
                    setTimeout(() => setNewSlideFlash(false), 3000);
                    // Speak intro text first
                    if (!isMuted && data.oli_response.content) {
                        speakText(data.oli_response.content);
                    }
                }
                // Check for single dynamic slide
                else if (data.oli_response.metadata?.slide) {
                    const newSlide = data.oli_response.metadata.slide;
                    setSlides(prev => {
                        const updated = [...prev, newSlide];
                        setCurrentSlideIdx(updated.length - 1); // Navigate to new slide
                        return updated;
                    });
                    setNewSlideFlash(true);
                    setTimeout(() => setNewSlideFlash(false), 3000);

                    // Narrate the slide
                    if (!isMuted && newSlide.speaker_notes) {
                        speakText(newSlide.speaker_notes);
                    }
                }
                // Narrate Oli's text response if no slide
                else if (!isMuted && data.oli_response.content) {
                    speakText(data.oli_response.content);
                }
            }
        } catch { /* error handled */ }
        finally { setSending(false); inputRef.current?.focus(); }
    };

    /* ── Voice Recognition (Speech-to-Text) ───────────────────── */
    const startListening = useCallback(() => {
        const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
        if (!SpeechRecognition) {
            setVoiceSupported(false);
            setVoiceError('Voice input not supported in this browser. Use Chrome or Edge.');
            return;
        }

        // Stop TTS while listening (to avoid feedback)
        window.speechSynthesis?.cancel();

        const recog = new SpeechRecognition();
        recog.lang = voiceLang;
        recog.continuous = listenMode === 'continuous';
        recog.interimResults = true;
        recog.maxAlternatives = 1;

        let finalText = '';

        recog.onresult = (event: any) => {
            let interim = '';
            for (let i = event.resultIndex; i < event.results.length; i++) {
                const transcript = event.results[i][0].transcript;
                if (event.results[i].isFinal) {
                    finalText += transcript + ' ';
                } else {
                    interim += transcript;
                }
            }
            setInterimTranscript(interim);
            setInput(finalText + interim);

            // Auto-stop after 1.5s of silence in continuous mode
            if (listenMode === 'continuous' && finalText) {
                if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
                silenceTimerRef.current = setTimeout(() => {
                    recog.stop();
                }, 1500);
            }
        };

        recog.onerror = (event: any) => {
            console.warn('Voice error:', event.error);
            if (event.error === 'no-speech') {
                setVoiceError('No speech detected. Try again.');
            } else if (event.error === 'not-allowed') {
                setVoiceError('Microphone access denied. Please allow mic access.');
            } else if (event.error === 'network') {
                setVoiceError('Network error. Check your connection.');
            } else {
                setVoiceError(`Voice error: ${event.error}`);
            }
            setIsListening(false);
            setTimeout(() => setVoiceError(null), 4000);
        };

        recog.onend = () => {
            setIsListening(false);
            setInterimTranscript('');
            if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
            // Auto-send if we got text and we're in push mode ended by user
            if (finalText.trim() && listenMode === 'push') {
                setInput(finalText.trim());
                // Auto-send after brief delay to let user review
                setTimeout(() => inputRef.current?.focus(), 100);
            }
        };

        recog.onstart = () => {
            setIsListening(true);
            setVoiceError(null);
            setInterimTranscript('');
        };

        recognitionRef.current = recog;
        try {
            recog.start();
        } catch (e) {
            console.warn('Failed to start recognition:', e);
        }
    }, [voiceLang, listenMode]);

    const stopListening = useCallback(() => {
        if (recognitionRef.current) {
            try { recognitionRef.current.stop(); } catch {}
        }
        if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
        setIsListening(false);
        setInterimTranscript('');
    }, []);

    const toggleListening = () => {
        if (isListening) stopListening();
        else startListening();
    };

    // Push-to-talk: hold Space to talk (when input isn't focused)
    useEffect(() => {
        const onKeyDown = (e: KeyboardEvent) => {
            const target = e.target as HTMLElement;
            if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return;
            if (e.code === 'Space' && !isListening && !e.repeat) {
                e.preventDefault();
                startListening();
            }
        };
        const onKeyUp = (e: KeyboardEvent) => {
            const target = e.target as HTMLElement;
            if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return;
            if (e.code === 'Space' && isListening && listenMode === 'push') {
                e.preventDefault();
                stopListening();
            }
        };
        window.addEventListener('keydown', onKeyDown);
        window.addEventListener('keyup', onKeyUp);
        return () => {
            window.removeEventListener('keydown', onKeyDown);
            window.removeEventListener('keyup', onKeyUp);
        };
    }, [isListening, listenMode, startListening, stopListening]);

    // Check voice support on mount
    useEffect(() => {
        const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
        setVoiceSupported(!!SR);
    }, []);

    // Broadcast voice activity to server when listening state changes
    useEffect(() => {
        axios.post(`/meetings/${meeting.id}/voice-activity`, { is_speaking: isListening }).catch(() => {});
    }, [isListening, meeting.id]);

    /* ── WebRTC Audio Call ───────────────────────────────────── */
    const joinAudioCall = async () => {
        if (callJoining || inCall) return;
        setCallJoining(true);
        setCallError(null);

        // Check WebRTC support
        if (!navigator.mediaDevices?.getUserMedia || !window.RTCPeerConnection) {
            setWebRTCSupported(false);
            setCallError('Voice calls are not supported in this browser.');
            setCallJoining(false);
            return;
        }

        // Check HTTPS (except localhost)
        const isSecure = window.location.protocol === 'https:' || window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
        if (!isSecure) {
            setCallError('Voice calls require HTTPS. Please use a secure connection.');
            setCallJoining(false);
            return;
        }

        // Stop TTS (to avoid echo)
        window.speechSynthesis?.cancel();
        // Stop speech recognition
        if (isListening) stopListening();

        const manager = new WebRTCManager(meeting.id, currentUserId, {
            onPeerAdded: (userId, peer) => {
                setRemotePeers(prev => {
                    const next = new Map(prev);
                    next.set(userId, peer);
                    return next;
                });
            },
            onPeerUpdated: (userId, peer) => {
                setRemotePeers(prev => {
                    const next = new Map(prev);
                    next.set(userId, peer);
                    return next;
                });
            },
            onPeerRemoved: (userId) => {
                setRemotePeers(prev => {
                    const next = new Map(prev);
                    next.delete(userId);
                    return next;
                });
            },
            onError: (msg) => {
                setCallError(msg);
                setTimeout(() => setCallError(null), 6000);
            },
        });

        webRTCRef.current = manager;

        try {
            await manager.joinCall();
            setInCall(true);
        } catch {
            webRTCRef.current = null;
        } finally {
            setCallJoining(false);
        }
    };

    const leaveAudioCall = async () => {
        if (!webRTCRef.current) return;
        await webRTCRef.current.leaveCall();
        webRTCRef.current = null;
        setInCall(false);
        setMicMuted(false);
        setRemotePeers(new Map());
    };

    const toggleMicMute = () => {
        if (!webRTCRef.current) return;
        const newMuted = !micMuted;
        webRTCRef.current.setMuted(newMuted);
        setMicMuted(newMuted);
    };

    // Cleanup call on unmount
    useEffect(() => {
        return () => {
            if (webRTCRef.current) {
                webRTCRef.current.leaveCall();
            }
        };
    }, []);

    /* ── Auto-play presentation (for Oli intro / full decks) ───── */
    useEffect(() => {
        if (!autoPlayPresentation || isMuted) return;
        const slide = slides[currentSlideIdx];
        if (!slide?.speaker_notes) return;

        // Narrate the current slide; on end, auto-advance to next
        if (!window.speechSynthesis) return;
        window.speechSynthesis.cancel();
        const clean = slide.speaker_notes.replace(/\*\*/g, '').replace(/[#*_`]/g, '').replace(/\[.*?\]/g, '');

        // Auto-detect Bangla
        const isBangla = /[\u0980-\u09FF]/.test(clean);
        const utter = new SpeechSynthesisUtterance(clean);
        utter.rate = isBangla ? 0.9 : 0.95;
        utter.lang = isBangla ? 'bn-BD' : 'en-US';
        const voices = window.speechSynthesis.getVoices();
        const pref = isBangla
            ? (voices.find(v => v.lang.startsWith('bn')) || voices.find(v => v.name.toLowerCase().includes('bangla')) || voices.find(v => v.name.toLowerCase().includes('bengali')))
            : (voices.find(v => v.name.includes('Google') && v.lang.startsWith('en')) || voices.find(v => v.lang.startsWith('en')));
        if (pref) utter.voice = pref;
        utter.onstart = () => setIsSpeaking(true);
        utter.onend = () => {
            setIsSpeaking(false);
            // Auto-advance to next slide after brief pause
            if (autoPlayPresentation && currentSlideIdx < slides.length - 1) {
                if (autoPlayTimeoutRef.current) clearTimeout(autoPlayTimeoutRef.current);
                autoPlayTimeoutRef.current = setTimeout(() => {
                    setCurrentSlideIdx((prev: number) => prev + 1);
                }, 1200);
            } else if (currentSlideIdx >= slides.length - 1) {
                setAutoPlayPresentation(false);
            }
        };
        window.speechSynthesis.speak(utter);

        return () => {
            window.speechSynthesis.cancel();
            if (autoPlayTimeoutRef.current) clearTimeout(autoPlayTimeoutRef.current);
        };
    }, [autoPlayPresentation, currentSlideIdx, slides.length, isMuted]);

    /* ── Text-to-Speech (auto-detects English/Bangla) ─────────── */
    const speakText = (text: string) => {
        if (!window.speechSynthesis) return;
        window.speechSynthesis.cancel();
        const clean = text.replace(/\*\*/g, '').replace(/[#*_`]/g, '').replace(/\[.*?\]/g, '');
        const isBangla = /[\u0980-\u09FF]/.test(clean);
        const utter = new SpeechSynthesisUtterance(clean);
        utter.rate = isBangla ? 0.9 : 1;
        utter.lang = isBangla ? 'bn-BD' : 'en-US';
        const voices = window.speechSynthesis.getVoices();
        const pref = isBangla
            ? (voices.find(v => v.lang.startsWith('bn')) || voices.find(v => v.name.toLowerCase().includes('bangla')) || voices.find(v => v.name.toLowerCase().includes('bengali')))
            : (voices.find(v => v.name.includes('Google') && v.lang.startsWith('en')) || voices.find(v => v.lang.startsWith('en')));
        if (pref) utter.voice = pref;
        utter.onstart = () => setIsSpeaking(true);
        utter.onend = () => setIsSpeaking(false);
        window.speechSynthesis.speak(utter);
    };

    /* ── Meeting actions ──────────────────────────────────────── */
    const startMeeting = async () => {
        await axios.post(`/meetings/${meeting.id}/start`);
        setMeetingStatus('active');
    };
    const endMeeting = async () => {
        if (!confirm('End the meeting? Meeting notes will be auto-generated.')) return;
        await axios.post(`/meetings/${meeting.id}/end`);
        setMeetingStatus('ended');
        window.speechSynthesis?.cancel();
    };
    const leaveMeeting = () => {
        window.speechSynthesis?.cancel();
        router.post(`/meetings/${meeting.id}/leave`);
    };
    const copyCode = () => {
        navigator.clipboard.writeText(meeting.meeting_code);
    };

    /* ── File Upload Handling ────────────────────────────────── */
    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const maxBytes = 20 * 1024 * 1024; // 20MB
        if (file.size > maxBytes) {
            alert('File size must be under 20MB');
            return;
        }
        const name = file.name.toLowerCase();
        const isImage = file.type.startsWith('image/');
        const isPdf = file.type === 'application/pdf' || name.endsWith('.pdf');
        const isPptx = name.endsWith('.pptx') || name.endsWith('.ppt') || file.type === 'application/vnd.openxmlformats-officedocument.presentationml.presentation' || file.type === 'application/vnd.ms-powerpoint';
        if (!isImage && !isPdf && !isPptx) {
            alert('Supported: Images (JPG, PNG, GIF, WebP), PDFs, PowerPoint (PPTX, PPT).');
            return;
        }
        setPendingFile(file);
        if (isImage) {
            setPendingFilePreview(URL.createObjectURL(file));
        } else {
            setPendingFilePreview(null);
        }
        // PPTX always goes to shared screen
        if (isPptx) setShareToScreen(true);
        // Reset input so the same file can be re-selected
        e.target.value = '';
    };

    const clearPendingFile = () => {
        if (pendingFilePreview) URL.revokeObjectURL(pendingFilePreview);
        setPendingFile(null);
        setPendingFilePreview(null);
    };

    /* ── Action Item Management ──────────────────────────────── */
    const addActionItem = async () => {
        const desc = newItemDraft.trim();
        if (!desc) return;
        setNewItemDraft('');
        try {
            const { data } = await axios.post(`/meetings/${meeting.id}/action-items`, {
                description: desc,
                priority: 'normal',
            });
            if (data.action_item) {
                setActionItems(prev => [{
                    ...data.action_item,
                    assigned_to_name: data.action_item.assigned_to?.name ?? null,
                    due_date: data.action_item.due_date ?? null,
                }, ...prev]);
            }
        } catch {}
    };

    const toggleActionItemStatus = async (item: ActionItem) => {
        const newStatus = item.status === 'completed' ? 'pending' : 'completed';
        // Optimistic update
        setActionItems(prev => prev.map(a => a.id === item.id ? { ...a, status: newStatus } : a));
        try {
            await axios.put(`/meetings/${meeting.id}/action-items/${item.id}`, { status: newStatus });
        } catch {
            // Revert on error
            setActionItems(prev => prev.map(a => a.id === item.id ? { ...a, status: item.status } : a));
        }
    };

    const deleteActionItem = async (id: number) => {
        setActionItems(prev => prev.filter(a => a.id !== id));
        try { await axios.delete(`/meetings/${meeting.id}/action-items/${id}`); } catch {}
    };

    const deleteDecision = async (id: number) => {
        setDecisions(prev => prev.filter(d => d.id !== id));
        try { await axios.delete(`/meetings/${meeting.id}/decisions/${id}`); } catch {}
    };

    /* ── Cleanup ──────────────────────────────────────────────── */
    useEffect(() => {
        return () => {
            window.speechSynthesis?.cancel();
            if (pollRef.current) clearInterval(pollRef.current);
            if (recognitionRef.current) { try { recognitionRef.current.stop(); } catch {} }
            if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
        };
    }, []);

    /* ── Lock body scroll + dark bg while meeting is open ───────── */
    useEffect(() => {
        const prevBg = document.body.style.backgroundColor;
        const prevOverflow = document.body.style.overflow;
        document.body.style.backgroundColor = '#020617'; // slate-950
        document.body.style.overflow = 'hidden';
        return () => {
            document.body.style.backgroundColor = prevBg;
            document.body.style.overflow = prevOverflow;
        };
    }, []);

    /* ── Time formatting ──────────────────────────────────────── */
    const formatTime = (iso: string) => {
        const d = new Date(iso);
        return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
    };

    const onlineCount = participants.filter(p => p.is_online).length;

    return (
        <div className="fixed inset-0 z-[200] bg-slate-950 flex flex-col w-screen h-screen overflow-hidden">
            {/* ── Top Bar ────────────────────────────────────────── */}
            <div className="flex items-center justify-between px-4 py-2.5 bg-slate-900 border-b border-white/10 shrink-0">
                <div className="flex items-center gap-3">
                    <div className={`w-3 h-3 rounded-full ${isActive ? 'bg-red-500 animate-pulse' : isEnded ? 'bg-surface-400' : 'bg-yellow-500'}`} />
                    <div>
                        <div className="text-white font-bold text-sm">{meeting.title}</div>
                        <div className="text-white/70 text-[11px] flex items-center gap-2">
                            <span className={isActive ? 'text-red-400 font-semibold' : isEnded ? 'text-slate-400' : 'text-yellow-400 font-semibold'}>
                                {isActive ? 'Live' : isEnded ? 'Ended' : 'Waiting'}
                            </span>
                            <span className="text-white/30">·</span>
                            <button onClick={copyCode} className="flex items-center gap-1 text-white/80 hover:text-white transition-colors">
                                <span className="font-mono font-semibold">{meeting.meeting_code}</span>
                                <Copy className="w-2.5 h-2.5" />
                            </button>
                            <span className="text-white/30">·</span>
                            <span className="text-white/80">{onlineCount} online</span>
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    {/* Speaking indicator */}
                    <AnimatePresence>
                        {isSpeaking && (
                            <motion.div className="flex items-center gap-1.5 bg-indigo-500/20 rounded-full px-3 py-1 border border-indigo-500/30"
                                initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }}>
                                <div className="flex gap-0.5">
                                    {[0,1,2,3].map(i => <motion.div key={i} className="w-0.5 bg-indigo-400 rounded-full"
                                        animate={{ height: [3, 12, 3] }} transition={{ duration: 0.4, delay: i * 0.08, repeat: Infinity }} />)}
                                </div>
                                <span className="text-indigo-300 text-[10px] font-medium">Oli speaking</span>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    <button onClick={() => setIsMuted(m => !m)} className={`p-2 rounded-lg transition-colors ${isMuted ? 'text-red-400 bg-red-500/10' : 'text-white/50 hover:text-white hover:bg-white/10'}`}>
                        {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                    </button>
                    <button onClick={() => setShowParticipants(p => !p)} className={`p-2 rounded-lg transition-colors ${showParticipants ? 'bg-white/10 text-white' : 'text-white/50 hover:text-white hover:bg-white/10'}`}>
                        <Users className="w-4 h-4" />
                    </button>
                    <button onClick={() => setShowNotes(n => !n)} className={`p-2 rounded-lg transition-colors ${showNotes ? 'bg-white/10 text-white' : 'text-white/50 hover:text-white hover:bg-white/10'}`}>
                        <FileText className="w-4 h-4" />
                    </button>

                    {/* Audio Call Controls */}
                    {isActive && !inCall && (
                        <button
                            onClick={joinAudioCall}
                            disabled={callJoining}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-500 transition-colors disabled:opacity-60"
                            title="Join voice call"
                        >
                            {callJoining ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <PhoneCall className="w-3.5 h-3.5" />}
                            {callJoining ? 'Joining...' : 'Join Call'}
                        </button>
                    )}
                    {inCall && (
                        <div className="flex items-center gap-1">
                            <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-emerald-500/20 border border-emerald-500/40">
                                <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                                <span className="text-emerald-300 text-[10px] font-bold">LIVE</span>
                                <span className="text-white/60 text-[10px]">·</span>
                                <span className="text-white/80 text-[10px] font-medium">{remotePeers.size + 1}</span>
                            </div>
                            <button
                                onClick={toggleMicMute}
                                className={`p-2 rounded-lg transition-colors ${
                                    micMuted
                                        ? 'bg-red-500/20 text-red-400 border border-red-500/40'
                                        : 'bg-white/10 text-white/70 hover:text-white hover:bg-white/20'
                                }`}
                                title={micMuted ? 'Unmute mic' : 'Mute mic'}
                            >
                                {micMuted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                            </button>
                            <button
                                onClick={leaveAudioCall}
                                className="p-2 rounded-lg bg-red-600 text-white hover:bg-red-500 transition-colors"
                                title="Leave voice call"
                            >
                                <PhoneOff className="w-4 h-4" />
                            </button>
                        </div>
                    )}

                    {isHost && !isActive && !isEnded && (
                        <button onClick={startMeeting} className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-500 transition-colors">
                            Start Meeting
                        </button>
                    )}
                    {isHost && isActive && (
                        <button onClick={endMeeting} className="px-3 py-1.5 rounded-lg bg-red-600 text-white text-xs font-bold hover:bg-red-500 transition-colors flex items-center gap-1.5">
                            <PhoneOff className="w-3.5 h-3.5" /> End
                        </button>
                    )}
                    {!isHost && (
                        <button onClick={leaveMeeting} className="px-3 py-1.5 rounded-lg bg-red-600/20 text-red-400 text-xs font-bold hover:bg-red-600/30 transition-colors flex items-center gap-1.5">
                            <LogOut className="w-3.5 h-3.5" /> Leave
                        </button>
                    )}
                </div>
            </div>

            {/* Call error banner */}
            <AnimatePresence>
                {callError && (
                    <motion.div
                        className="px-4 py-2 bg-red-500/20 border-b border-red-500/40 flex items-center gap-2"
                        initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                    >
                        <PhoneOff className="w-4 h-4 text-red-400 shrink-0" />
                        <span className="text-red-300 text-xs font-medium flex-1">{callError}</span>
                        <button onClick={() => setCallError(null)} className="text-white/50 hover:text-white">
                            <MicOff className="w-3 h-3" />
                        </button>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* ── Main Layout ────────────────────────────────────── */}
            <div className="flex-1 flex overflow-hidden">
                {/* ── Participants Sidebar ────────────────────────── */}
                <AnimatePresence>
                    {showParticipants && (
                        <motion.div className="w-56 bg-slate-900 border-r border-white/10 flex flex-col"
                            initial={{ width: 0, opacity: 0 }} animate={{ width: 224, opacity: 1 }} exit={{ width: 0, opacity: 0 }}>
                            <div className="p-3 border-b border-white/10">
                                <div className="text-white/80 text-[11px] font-semibold uppercase tracking-wider">
                                    Participants ({onlineCount})
                                </div>
                            </div>
                            <div className="flex-1 overflow-y-auto p-2 space-y-1">
                                {/* Oli (always present) */}
                                <div className="flex items-center gap-2.5 px-2.5 py-2 rounded-xl bg-indigo-500/10 border border-indigo-500/20">
                                    <div className="relative">
                                        <div className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center">
                                            <Bot className="w-4 h-4 text-white" />
                                        </div>
                                        <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-emerald-400 border-2 border-slate-900" />
                                    </div>
                                    <div>
                                        <div className="text-white text-xs font-bold">Oli</div>
                                        <div className="text-indigo-300 text-[9px]">AI Assistant</div>
                                    </div>
                                </div>

                                {participants.map(p => {
                                    const peer = remotePeers.get(p.user_id);
                                    const inCallNow = p.user_id === currentUserId ? inCall : !!peer;
                                    const isTransmitting = peer?.isSpeaking || p.is_speaking;
                                    const volumeLevel = peer?.volumeLevel ?? 0;
                                    const connState = peer?.connectionState;

                                    return (
                                        <div key={p.id} className={`flex items-center gap-2.5 px-2.5 py-2 rounded-xl transition-all ${
                                            isTransmitting
                                                ? 'bg-emerald-500/20 border border-emerald-500/40 shadow-lg shadow-emerald-500/10'
                                                : inCallNow
                                                ? 'bg-indigo-500/10 border border-indigo-500/30'
                                                : 'hover:bg-white/5 border border-transparent'
                                        }`}>
                                            <div className="relative">
                                                {/* Speaking pulse ring */}
                                                {isTransmitting && (
                                                    <motion.div
                                                        className="absolute -inset-1 rounded-full border-2 border-emerald-400"
                                                        animate={{ scale: [1, 1.15, 1], opacity: [0.8, 0.3, 0.8] }}
                                                        transition={{ duration: 1.2, repeat: Infinity }}
                                                    />
                                                )}
                                                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold relative ${
                                                    isTransmitting ? 'bg-emerald-600 ring-2 ring-emerald-400' : inCallNow ? 'bg-indigo-600' : 'bg-slate-700'
                                                }`}>
                                                    {p.name.split(' ').map(w => w[0]).join('').slice(0, 2)}
                                                </div>
                                                {/* Status badge */}
                                                {inCallNow ? (
                                                    <div className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-emerald-500 border-2 border-slate-900 flex items-center justify-center">
                                                        {isTransmitting ? <Mic className="w-2 h-2 text-white" /> : <PhoneCall className="w-2 h-2 text-white" />}
                                                    </div>
                                                ) : (
                                                    <div className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-slate-900 ${p.is_online ? 'bg-emerald-400' : 'bg-slate-500'}`} />
                                                )}
                                            </div>
                                            <div className="min-w-0 flex-1">
                                                <div className={`text-xs font-medium flex items-center gap-1 ${isTransmitting ? 'text-emerald-300' : 'text-white'}`}>
                                                    <span className="truncate">{p.name}</span>
                                                    {p.user_id === currentUserId && <span className="text-[9px] text-white/60 shrink-0">(you)</span>}
                                                </div>
                                                <div className={`text-[10px] capitalize flex items-center gap-1 ${
                                                    isTransmitting ? 'text-emerald-400' : inCallNow ? 'text-indigo-300' : 'text-white/60'
                                                }`}>
                                                    {isTransmitting ? '🎤 Speaking...' : inCallNow ? (
                                                        connState === 'connected' ? '📞 In call' :
                                                        connState === 'connecting' || connState === 'new' ? '⏳ Connecting...' :
                                                        connState === 'failed' || connState === 'disconnected' ? '⚠️ Disconnected' :
                                                        '📞 In call'
                                                    ) : p.role}
                                                </div>
                                                {/* Volume bar for remote peer */}
                                                {inCallNow && p.user_id !== currentUserId && (
                                                    <div className="mt-0.5 h-0.5 bg-white/10 rounded-full overflow-hidden">
                                                        <div
                                                            className="h-full bg-gradient-to-r from-emerald-500 to-emerald-300 transition-all"
                                                            style={{ width: `${Math.min(100, volumeLevel * 100)}%` }}
                                                        />
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* ── Shared Screen Area ──────────────────────────── */}
                <div className="flex-1 flex flex-col">
                    {slides.length > 0 ? (
                        <div className="flex-1 relative bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-950 overflow-hidden">
                            {/* New slide flash */}
                            <AnimatePresence>
                                {newSlideFlash && (
                                    <motion.div className="absolute top-3 left-1/2 -translate-x-1/2 z-10 flex items-center gap-2 bg-emerald-500/20 backdrop-blur-sm rounded-full px-4 py-1.5 border border-emerald-500/30"
                                        initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
                                        <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                                        <span className="text-emerald-300 text-xs font-semibold">New live slide</span>
                                    </motion.div>
                                )}
                            </AnimatePresence>

                            {/* Auto-play presentation indicator */}
                            <AnimatePresence>
                                {autoPlayPresentation && (
                                    <motion.div className="absolute top-3 left-1/2 -translate-x-1/2 z-10 flex items-center gap-2 bg-indigo-500/20 backdrop-blur-sm rounded-full px-4 py-2 border border-indigo-500/40"
                                        initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
                                        <PresentationIcon className="w-3.5 h-3.5 text-indigo-300" />
                                        <span className="text-indigo-200 text-xs font-semibold">
                                            Oli Presenting — Slide {currentSlideIdx + 1} of {slides.length}
                                        </span>
                                        <button
                                            onClick={() => {
                                                setAutoPlayPresentation(false);
                                                window.speechSynthesis?.cancel();
                                            }}
                                            className="ml-2 text-indigo-300 hover:text-white text-xs font-bold"
                                        >
                                            Stop
                                        </button>
                                    </motion.div>
                                )}
                            </AnimatePresence>

                            {/* Active speakers indicator */}
                            <AnimatePresence>
                                {participants.some(p => p.is_speaking && p.user_id !== currentUserId) && (
                                    <motion.div
                                        className="absolute top-3 right-3 z-10 flex items-center gap-2 bg-emerald-500/20 backdrop-blur-sm rounded-full px-3 py-1.5 border border-emerald-500/40"
                                        initial={{ opacity: 0, x: 20 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        exit={{ opacity: 0, x: 20 }}
                                    >
                                        <Mic className="w-3.5 h-3.5 text-emerald-400" />
                                        <span className="text-emerald-300 text-xs font-semibold">
                                            {participants.filter(p => p.is_speaking && p.user_id !== currentUserId).map(p => p.name).join(', ')} speaking
                                        </span>
                                        <div className="flex gap-0.5 ml-1">
                                            {[0,1,2,3].map(i => (
                                                <motion.div key={i} className="w-0.5 bg-emerald-400 rounded-full"
                                                    animate={{ height: [3, 10, 3] }}
                                                    transition={{ duration: 0.4, delay: i * 0.08, repeat: Infinity }} />
                                            ))}
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>

                            {/* Slide content */}
                            <AnimatePresence mode="wait">
                                <motion.div key={currentSlideIdx} className="absolute inset-0 overflow-hidden"
                                    initial={{ opacity: 0, x: 50 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -50 }}
                                    transition={{ duration: 0.3 }}>
                                    {slides[currentSlideIdx] && <SharedSlide slide={slides[currentSlideIdx]} />}
                                </motion.div>
                            </AnimatePresence>

                            {/* Slide navigation */}
                            {slides.length > 1 && (
                                <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-black/40 backdrop-blur-sm rounded-full px-3 py-1.5 border border-white/10">
                                    <button onClick={() => setCurrentSlideIdx(Math.max(0, currentSlideIdx - 1))} disabled={currentSlideIdx === 0}
                                        className="text-white/50 hover:text-white disabled:opacity-20 transition-colors">
                                        <ChevronLeft className="w-4 h-4" />
                                    </button>
                                    <span className="text-white/50 text-xs font-mono px-2">
                                        {currentSlideIdx + 1} / {slides.length}
                                    </span>
                                    <button onClick={() => setCurrentSlideIdx(Math.min(slides.length - 1, currentSlideIdx + 1))} disabled={currentSlideIdx === slides.length - 1}
                                        className="text-white/50 hover:text-white disabled:opacity-20 transition-colors">
                                        <ChevronRight className="w-4 h-4" />
                                    </button>
                                </div>
                            )}
                        </div>
                    ) : (
                        /* No presentation yet — waiting screen */
                        <div className="flex-1 flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-950">
                            <div className="text-center max-w-md px-6">
                                <div className="w-24 h-24 rounded-2xl bg-indigo-500/10 border-2 border-indigo-500/30 flex items-center justify-center mx-auto mb-6">
                                    <PresentationIcon className="w-12 h-12 text-indigo-300" />
                                </div>
                                <div className="text-white text-xl font-bold mb-2">No presentation yet</div>
                                <div className="text-white/70 text-sm mb-5">Ask Oli to present something to get started:</div>
                                <div className="space-y-2">
                                    {['Oli, present the production report', 'Oli, show financial summary', 'Oli, present machine status'].map((s, i) => (
                                        <button key={i} onClick={() => { setInput(s); inputRef.current?.focus(); }}
                                            className="block w-full px-4 py-2.5 rounded-xl bg-white/10 border border-white/15 text-white/90 text-sm font-medium
                                                       hover:bg-indigo-500/20 hover:border-indigo-500/40 hover:text-white transition-all text-left">
                                            <span className="text-indigo-400 mr-2">💬</span>
                                            {s}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* ── Chat Panel ──────────────────────────────────── */}
                <div className="w-96 bg-slate-900 border-l border-white/10 flex flex-col">
                    <div className="p-3 border-b border-white/10 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <MessageSquare className="w-4 h-4 text-indigo-400" />
                            <span className="text-white text-sm font-bold">Meeting Chat</span>
                        </div>
                        <div className="text-white/60 text-[11px]">{messages.length} messages</div>
                    </div>

                    {/* Messages */}
                    <div className="flex-1 overflow-y-auto p-3 space-y-3">
                        {messages.map(msg => (
                            <motion.div key={msg.id}
                                initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }}
                                className={msg.message_type === 'system' ? 'text-center' : ''}>

                                {msg.message_type === 'system' ? (
                                    <div className="text-white/50 text-[11px] py-1 italic">{msg.content}</div>
                                ) : (
                                    <div className={`flex gap-2 ${msg.user_id === currentUserId ? 'flex-row-reverse' : ''}`}>
                                        {/* Avatar */}
                                        <div className="shrink-0">
                                            {msg.sender_type === 'ai' ? (
                                                <div className="w-7 h-7 rounded-full bg-indigo-600 flex items-center justify-center">
                                                    <Bot className="w-3.5 h-3.5 text-white" />
                                                </div>
                                            ) : (
                                                <div className="w-7 h-7 rounded-full bg-slate-700 flex items-center justify-center text-white text-[10px] font-bold">
                                                    {msg.sender_name.split(' ').map(w => w[0]).join('').slice(0, 2)}
                                                </div>
                                            )}
                                        </div>
                                        {/* Bubble */}
                                        <div className={`max-w-[80%] rounded-2xl px-3 py-2 ${
                                            msg.sender_type === 'ai'
                                                ? 'bg-indigo-500/15 border border-indigo-500/20'
                                                : msg.user_id === currentUserId
                                                ? 'bg-slate-700 border border-slate-600'
                                                : 'bg-white/5 border border-white/10'
                                        }`}>
                                            <div className="flex items-center gap-2 mb-0.5">
                                                <span className={`text-[10px] font-bold ${msg.sender_type === 'ai' ? 'text-indigo-300' : 'text-white/60'}`}>
                                                    {msg.sender_name}
                                                </span>
                                                <span className="text-white/20 text-[9px]">{formatTime(msg.created_at)}</span>
                                            </div>
                                            <div className="text-white/80">
                                                <ChatMarkdown text={msg.content} />
                                            </div>
                                            {/* Attached image/PDF/PPTX */}
                                            {msg.metadata?.attachment && (
                                                <div className="mt-2">
                                                    {msg.metadata.attachment.type === 'image' ? (
                                                        <a href={msg.metadata.attachment.url} target="_blank" rel="noopener noreferrer">
                                                            <img
                                                                src={msg.metadata.attachment.url}
                                                                alt={msg.metadata.attachment.name}
                                                                className="rounded-lg max-h-40 w-auto border border-white/10 hover:border-white/30 transition-colors"
                                                            />
                                                        </a>
                                                    ) : msg.metadata.attachment.type === 'pptx' ? (
                                                        <a
                                                            href={msg.metadata.attachment.url}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            download={msg.metadata.attachment.name}
                                                            className="flex items-center gap-2 px-2.5 py-2 rounded-lg bg-orange-500/10 border border-orange-500/30 hover:bg-orange-500/20 transition-colors"
                                                        >
                                                            <span className="text-2xl">📽️</span>
                                                            <div className="min-w-0 flex-1">
                                                                <div className="text-white text-xs font-semibold truncate">{msg.metadata.attachment.name}</div>
                                                                <div className="text-orange-300 text-[10px]">
                                                                    PowerPoint · {msg.metadata.attachment.slide_count ?? '?'} slides · Click to download
                                                                </div>
                                                            </div>
                                                        </a>
                                                    ) : (
                                                        <a
                                                            href={msg.metadata.attachment.url}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="flex items-center gap-2 px-2.5 py-2 rounded-lg bg-red-500/10 border border-red-500/30 hover:bg-red-500/20 transition-colors"
                                                        >
                                                            <span className="text-2xl">📄</span>
                                                            <div className="min-w-0 flex-1">
                                                                <div className="text-white text-xs font-semibold truncate">{msg.metadata.attachment.name}</div>
                                                                <div className="text-white/50 text-[10px]">PDF document · Click to open</div>
                                                            </div>
                                                        </a>
                                                    )}
                                                    {msg.metadata.attachment.shared_to_screen && (
                                                        <div className="mt-1 text-[9px] text-indigo-300 flex items-center gap-1">
                                                            <MonitorPlay className="w-2.5 h-2.5" />
                                                            {msg.metadata.attachment.type === 'pptx'
                                                                ? `${msg.metadata.attachment.slide_count ?? 'All'} slides loaded on shared screen`
                                                                : 'Shared on screen'}
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                            {/* Tool calls badge */}
                                            {msg.metadata?.tool_calls && msg.metadata.tool_calls.length > 0 && (
                                                <div className="mt-1.5 pt-1.5 border-t border-white/10">
                                                    <div className="flex items-center gap-1 text-[9px] text-indigo-300/60 font-medium">
                                                        <Sparkles className="w-2.5 h-2.5" />
                                                        Used: {msg.metadata.tool_calls.join(', ')}
                                                    </div>
                                                </div>
                                            )}
                                            {/* Slide indicator */}
                                            {msg.metadata?.slide && (
                                                <div className="mt-1.5 pt-1.5 border-t border-emerald-500/20">
                                                    <div className="flex items-center gap-1.5 text-[10px] text-emerald-400 font-semibold">
                                                        <PresentationIcon className="w-3 h-3" />
                                                        Shared: {msg.metadata.slide.title}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </motion.div>
                        ))}
                        <div ref={chatEndRef} />
                    </div>

                    {/* Input */}
                    {!isEnded && (
                        <div className="p-3 border-t border-white/10">
                            {!isActive && meetingStatus === 'waiting' && (
                                <div className="mb-2 px-3 py-2 rounded-lg bg-yellow-500/10 border border-yellow-500/30 text-yellow-300 text-xs text-center">
                                    {isHost ? '👑 You are the host. Click "Start Meeting" above to begin.' : '⏳ Waiting for the host to start the meeting...'}
                                </div>
                            )}

                            {/* Listening state banner */}
                            <AnimatePresence>
                                {isListening && (
                                    <motion.div
                                        className="mb-2 px-3 py-2.5 rounded-xl bg-red-500/10 border border-red-500/30 flex items-center gap-3"
                                        initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 5 }}
                                    >
                                        <div className="relative flex items-center justify-center w-8 h-8 shrink-0">
                                            <motion.div className="absolute inset-0 rounded-full bg-red-500/30"
                                                animate={{ scale: [1, 1.5, 1], opacity: [0.6, 0, 0.6] }}
                                                transition={{ duration: 1.5, repeat: Infinity }} />
                                            <Mic className="w-4 h-4 text-red-400 relative z-10" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="text-red-300 text-xs font-bold">Listening...</div>
                                            <div className="text-white/80 text-[11px] truncate italic">
                                                {interimTranscript || input || (listenMode === 'push' ? 'Hold and speak...' : 'Speak now — auto-stops after silence')}
                                            </div>
                                        </div>
                                        <button onClick={stopListening} className="text-white/50 hover:text-white shrink-0">
                                            <MicOff className="w-4 h-4" />
                                        </button>
                                    </motion.div>
                                )}
                            </AnimatePresence>

                            {/* Voice error banner */}
                            <AnimatePresence>
                                {voiceError && (
                                    <motion.div
                                        className="mb-2 px-3 py-2 rounded-lg bg-orange-500/10 border border-orange-500/30 text-orange-300 text-[11px]"
                                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                                    >
                                        ⚠️ {voiceError}
                                    </motion.div>
                                )}
                            </AnimatePresence>

                            {/* File preview (if pending) */}
                            <AnimatePresence>
                                {pendingFile && (
                                    <motion.div
                                        className="mb-2 p-2.5 rounded-xl bg-indigo-500/10 border border-indigo-500/30"
                                        initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 5 }}
                                    >
                                        <div className="flex items-center gap-2">
                                            {pendingFilePreview ? (
                                                <img src={pendingFilePreview} alt="Preview" className="w-12 h-12 rounded-lg object-cover border border-white/20" />
                                            ) : (() => {
                                                const n = pendingFile.name.toLowerCase();
                                                const isPptx = n.endsWith('.pptx') || n.endsWith('.ppt');
                                                return isPptx ? (
                                                    <div className="w-12 h-12 rounded-lg bg-orange-500/20 border border-orange-500/30 flex items-center justify-center text-2xl">
                                                        📽️
                                                    </div>
                                                ) : (
                                                    <div className="w-12 h-12 rounded-lg bg-red-500/20 border border-red-500/30 flex items-center justify-center text-2xl">
                                                        📄
                                                    </div>
                                                );
                                            })()}
                                            <div className="flex-1 min-w-0">
                                                <div className="text-white text-xs font-semibold truncate">{pendingFile.name}</div>
                                                <div className="text-white/50 text-[10px]">
                                                    {(pendingFile.size / 1024).toFixed(1)} KB
                                                    {(pendingFile.name.toLowerCase().endsWith('.pptx') || pendingFile.name.toLowerCase().endsWith('.ppt')) && ' · PowerPoint'}
                                                </div>
                                            </div>
                                            <button
                                                onClick={clearPendingFile}
                                                className="text-white/50 hover:text-red-400 shrink-0"
                                            >
                                                <X className="w-4 h-4" />
                                            </button>
                                        </div>
                                        {pendingFile.type.startsWith('image/') && (
                                            <label className="flex items-center gap-1.5 mt-2 cursor-pointer group">
                                                <input
                                                    type="checkbox"
                                                    checked={shareToScreen}
                                                    onChange={e => setShareToScreen(e.target.checked)}
                                                    className="w-3.5 h-3.5 rounded accent-indigo-500"
                                                />
                                                <span className="text-[10px] text-white/70 group-hover:text-white">
                                                    🖥️ Share to all participants' screen
                                                </span>
                                            </label>
                                        )}
                                        {(pendingFile.name.toLowerCase().endsWith('.pptx') || pendingFile.name.toLowerCase().endsWith('.ppt')) && (
                                            <div className="mt-2 text-[10px] text-orange-300 flex items-center gap-1">
                                                <MonitorPlay className="w-2.5 h-2.5" />
                                                Slides will be loaded on the shared screen automatically
                                            </div>
                                        )}
                                        <div className="text-[10px] text-indigo-300 mt-1.5 italic">
                                            ✨ Oli will see this and respond.
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>

                            <div className="flex items-center gap-2">
                                {/* File upload button */}
                                <input
                                    ref={fileInputRef}
                                    type="file"
                                    accept="image/*,application/pdf,.pptx,.ppt,application/vnd.openxmlformats-officedocument.presentationml.presentation,application/vnd.ms-powerpoint"
                                    onChange={handleFileSelect}
                                    className="hidden"
                                />
                                <button
                                    onClick={() => fileInputRef.current?.click()}
                                    disabled={!isActive || !!pendingFile}
                                    title="Upload image or PDF"
                                    className={`p-2.5 rounded-xl transition-all shrink-0 ${
                                        pendingFile
                                            ? 'bg-indigo-500/30 text-indigo-300 border border-indigo-500/50'
                                            : 'bg-white/10 text-white/70 hover:bg-white/20 hover:text-white disabled:opacity-30'
                                    }`}
                                >
                                    <Paperclip className="w-4 h-4" />
                                </button>

                                {/* Voice input button */}
                                {voiceSupported && (
                                    <button
                                        onClick={toggleListening}
                                        disabled={!isActive}
                                        title={listenMode === 'push' ? 'Click or hold Space to talk' : 'Click to start/stop listening'}
                                        className={`p-2.5 rounded-xl transition-all shrink-0 ${
                                            isListening
                                                ? 'bg-red-500 text-white shadow-lg shadow-red-500/40 animate-pulse'
                                                : 'bg-white/10 text-white/70 hover:bg-white/20 hover:text-white disabled:opacity-30'
                                        }`}
                                    >
                                        {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                                    </button>
                                )}

                                <input
                                    ref={inputRef}
                                    type="text"
                                    value={input}
                                    onChange={e => setInput(e.target.value)}
                                    onKeyDown={e => e.key === 'Enter' && sendMessage()}
                                    placeholder={isActive ? (isListening ? 'Listening...' : pendingFile ? 'Add a message with your file...' : 'Type, share images, or tap mic...') : 'Start the meeting to chat'}
                                    disabled={!isActive}
                                    className="flex-1 bg-white/10 border border-white/15 rounded-xl px-3 py-2.5 text-sm text-white
                                               placeholder-white/50 focus:outline-none focus:border-indigo-500/50 focus:bg-white/15 disabled:opacity-50 transition-colors"
                                />
                                <button
                                    onClick={sendMessage}
                                    disabled={(!input.trim() && !pendingFile) || sending || !isActive}
                                    className="p-2.5 rounded-xl bg-indigo-600 text-white disabled:opacity-30 hover:bg-indigo-500 transition-colors shrink-0"
                                >
                                    {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                                </button>
                            </div>

                            {/* Voice controls row */}
                            {voiceSupported && isActive && (
                                <div className="flex items-center justify-between gap-2 mt-2 text-[10px]">
                                    <div className="flex items-center gap-2 text-white/50">
                                        {/* Language toggle */}
                                        <button
                                            onClick={() => setVoiceLang(l => l === 'en-US' ? 'bn-BD' : 'en-US')}
                                            className="flex items-center gap-1 px-2 py-1 rounded-md bg-white/5 hover:bg-white/10 transition-colors"
                                            title="Voice input language"
                                        >
                                            🌐 <span className="font-semibold">{voiceLang === 'en-US' ? 'EN' : 'বাং'}</span>
                                        </button>
                                        {/* Mode toggle */}
                                        <button
                                            onClick={() => setListenMode(m => m === 'push' ? 'continuous' : 'push')}
                                            className="flex items-center gap-1 px-2 py-1 rounded-md bg-white/5 hover:bg-white/10 transition-colors"
                                            title="Voice input mode"
                                        >
                                            {listenMode === 'push' ? '👆 Push-to-Talk' : '🔄 Continuous'}
                                        </button>
                                    </div>
                                    <div className="text-white/40">
                                        {listenMode === 'push' ? 'Hold Space to talk' : 'Auto-stop on silence'}
                                    </div>
                                </div>
                            )}

                            <div className="text-[10px] text-white/50 mt-1.5 text-center">
                                💡 Start with <span className="text-indigo-300 font-semibold">"Oli"</span> to ask the AI
                                {voiceSupported && <> · 🎤 Click mic to speak</>}
                            </div>
                        </div>
                    )}

                    {/* Meeting ended banner */}
                    {isEnded && (
                        <div className="p-3 border-t border-white/10 bg-slate-900">
                            <div className="text-center text-white/70 text-sm">
                                This meeting has ended.
                                <button onClick={() => router.visit('/meetings')} className="ml-1 text-indigo-400 hover:text-indigo-300 font-semibold">
                                    Back to meetings
                                </button>
                            </div>
                        </div>
                    )}
                </div>

                {/* ── Intelligence Panel (Notes / Actions / Decisions) ─ */}
                <AnimatePresence>
                    {showNotes && (
                        <motion.div className="w-80 bg-slate-900 border-l border-white/10 flex flex-col"
                            initial={{ width: 0, opacity: 0 }} animate={{ width: 320, opacity: 1 }} exit={{ width: 0, opacity: 0 }}>
                            <IntelligencePanel
                                notes={notes}
                                actionItems={actionItems}
                                decisions={decisions}
                                participants={participants}
                                currentUserId={currentUserId}
                                isActive={isActive}
                                newItemDraft={newItemDraft}
                                setNewItemDraft={setNewItemDraft}
                                onAddItem={addActionItem}
                                onToggleStatus={toggleActionItemStatus}
                                onDeleteItem={deleteActionItem}
                                onDeleteDecision={deleteDecision}
                            />
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </div>
    );
}
