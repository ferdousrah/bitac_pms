import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
    Play, Pause, SkipForward, SkipBack, Volume2, VolumeX,
    Maximize2, Minimize2, X, Mic, MicOff, MessageSquare,
    ChevronLeft, ChevronRight, Send, Loader2, RotateCcw,
    Presentation, Clock, Gauge, Sparkles,
} from 'lucide-react';
import axios from 'axios';

/* ═══════════════════════════════════════════════════════════════════
   Types
   ═══════════════════════════════════════════════════════════════════ */
export interface PresentationSlide {
    title: string;
    body?: string;
    bullets?: string[];
    kpis?: { label: string; value: string; trend?: 'up' | 'down' | 'neutral'; color?: string }[];
    table?: { headers: string[]; rows: Record<string, string | number>[] };
    chart?: { type: 'bar' | 'pie' | 'line'; title: string; data: { label: string; value: number }[] };
    speaker_notes: string;
    layout?: 'title' | 'content' | 'kpi' | 'chart' | 'split' | 'closing';
}

export interface PresentationData {
    id: string;
    title: string;
    subtitle?: string;
    slides: PresentationSlide[];
    theme?: { primary: string; secondary: string; accent: string };
    generated_at: string;
}

interface Props {
    data: PresentationData;
    onClose: () => void;
    conversationId?: string | null;
}

/* ═══════════════════════════════════════════════════════════════════
   Chart Colors
   ═══════════════════════════════════════════════════════════════════ */
const CHART_COLORS = [
    '#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6',
    '#06b6d4', '#ec4899', '#14b8a6', '#f97316',
];

/* ═══════════════════════════════════════════════════════════════════
   Mini Bar Chart (SVG)
   ═══════════════════════════════════════════════════════════════════ */
function MiniBarChart({ data, animate }: { data: { label: string; value: number }[]; animate: boolean }) {
    const max = Math.max(...data.map(d => d.value), 1);
    const barW = Math.min(60, Math.floor(600 / data.length) - 8);
    const svgW = data.length * (barW + 8);

    return (
        <svg viewBox={`0 0 ${svgW} 220`} className="w-full max-h-[260px]" preserveAspectRatio="xMidYMax meet">
            {data.map((d, i) => {
                const h = (d.value / max) * 160;
                return (
                    <g key={i}>
                        <motion.rect
                            x={i * (barW + 8) + 4}
                            y={180 - h}
                            width={barW}
                            height={h}
                            rx={4}
                            fill={CHART_COLORS[i % CHART_COLORS.length]}
                            initial={animate ? { height: 0, y: 180 } : false}
                            animate={{ height: h, y: 180 - h }}
                            transition={{ duration: 0.6, delay: i * 0.08, ease: 'easeOut' }}
                        />
                        <text
                            x={i * (barW + 8) + 4 + barW / 2}
                            y={195}
                            textAnchor="middle"
                            className="fill-white/70 text-[9px]"
                        >
                            {d.label.length > 8 ? d.label.slice(0, 7) + '…' : d.label}
                        </text>
                        <motion.text
                            x={i * (barW + 8) + 4 + barW / 2}
                            y={175 - h}
                            textAnchor="middle"
                            className="fill-white font-bold text-[10px]"
                            initial={animate ? { opacity: 0 } : false}
                            animate={{ opacity: 1 }}
                            transition={{ delay: 0.4 + i * 0.08 }}
                        >
                            {d.value.toLocaleString()}
                        </motion.text>
                    </g>
                );
            })}
        </svg>
    );
}

/* ═══════════════════════════════════════════════════════════════════
   Mini Pie Chart (SVG)
   ═══════════════════════════════════════════════════════════════════ */
function MiniPieChart({ data, animate }: { data: { label: string; value: number }[]; animate: boolean }) {
    const total = data.reduce((s, d) => s + d.value, 0) || 1;
    let cumAngle = -90;
    const slices = data.map((d, i) => {
        const angle = (d.value / total) * 360;
        const start = cumAngle;
        cumAngle += angle;
        return { ...d, startAngle: start, angle, color: CHART_COLORS[i % CHART_COLORS.length] };
    });

    const toRad = (a: number) => (a * Math.PI) / 180;
    const cx = 120, cy = 120, r = 95;

    return (
        <svg viewBox="0 0 240 240" className="w-48 h-48 mx-auto">
            {slices.map((s, i) => {
                const x1 = cx + r * Math.cos(toRad(s.startAngle));
                const y1 = cy + r * Math.sin(toRad(s.startAngle));
                const x2 = cx + r * Math.cos(toRad(s.startAngle + s.angle));
                const y2 = cy + r * Math.sin(toRad(s.startAngle + s.angle));
                const large = s.angle > 180 ? 1 : 0;
                const path = `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2} Z`;
                return (
                    <motion.path
                        key={i}
                        d={path}
                        fill={s.color}
                        stroke="rgba(0,0,0,0.3)"
                        strokeWidth={1}
                        initial={animate ? { opacity: 0, scale: 0.8 } : false}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ duration: 0.5, delay: i * 0.1 }}
                    />
                );
            })}
        </svg>
    );
}

/* ═══════════════════════════════════════════════════════════════════
   Mini Line Chart (SVG)
   ═══════════════════════════════════════════════════════════════════ */
function MiniLineChart({ data, animate }: { data: { label: string; value: number }[]; animate: boolean }) {
    if (data.length < 2) return null;
    const max = Math.max(...data.map(d => d.value), 1);
    const min = Math.min(...data.map(d => d.value), 0);
    const range = max - min || 1;
    const w = 600, h = 200, px = 40, py = 20;

    const points = data.map((d, i) => ({
        x: px + (i / (data.length - 1)) * (w - 2 * px),
        y: py + (1 - (d.value - min) / range) * (h - 2 * py),
    }));

    const pathD = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');

    return (
        <svg viewBox={`0 0 ${w} ${h + 30}`} className="w-full max-h-[240px]" preserveAspectRatio="xMidYMid meet">
            <motion.path
                d={pathD}
                fill="none"
                stroke={CHART_COLORS[0]}
                strokeWidth={3}
                strokeLinecap="round"
                strokeLinejoin="round"
                initial={animate ? { pathLength: 0 } : false}
                animate={{ pathLength: 1 }}
                transition={{ duration: 1.2, ease: 'easeInOut' }}
            />
            {points.map((p, i) => (
                <motion.circle
                    key={i}
                    cx={p.x} cy={p.y} r={4}
                    fill={CHART_COLORS[0]}
                    stroke="white" strokeWidth={2}
                    initial={animate ? { scale: 0 } : false}
                    animate={{ scale: 1 }}
                    transition={{ delay: 0.3 + i * 0.08 }}
                />
            ))}
            {data.map((d, i) => (
                <text key={i} x={points[i].x} y={h + 15} textAnchor="middle" className="fill-white/60 text-[9px]">
                    {d.label.length > 6 ? d.label.slice(0, 5) + '…' : d.label}
                </text>
            ))}
        </svg>
    );
}

/* ═══════════════════════════════════════════════════════════════════
   Slide Renderer
   ═══════════════════════════════════════════════════════════════════ */
function SlideContent({ slide, animate }: { slide: PresentationSlide; animate: boolean }) {
    const layout = slide.layout || (slide.kpis ? 'kpi' : slide.chart ? 'chart' : 'content');

    return (
        <div className="h-full flex flex-col px-8 md:px-16 py-8 overflow-y-auto">
            {/* Slide Title */}
            <motion.h2
                className={`font-bold mb-6 ${layout === 'title' ? 'text-4xl md:text-5xl text-center mt-auto' : 'text-2xl md:text-3xl'}`}
                initial={animate ? { opacity: 0, y: 20 } : false}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
            >
                {slide.title}
            </motion.h2>

            {/* Body text */}
            {slide.body && (
                <motion.p
                    className={`text-white/80 text-lg leading-relaxed mb-6 ${layout === 'title' ? 'text-center text-xl' : ''}`}
                    initial={animate ? { opacity: 0 } : false}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.2 }}
                >
                    {slide.body}
                </motion.p>
            )}

            {/* KPI Cards */}
            {slide.kpis && slide.kpis.length > 0 && (
                <div className={`grid gap-4 mb-6 ${slide.kpis.length <= 3 ? 'grid-cols-1 md:grid-cols-3' : 'grid-cols-2 md:grid-cols-4'}`}>
                    {slide.kpis.map((kpi, i) => (
                        <motion.div
                            key={i}
                            className="bg-white/10 backdrop-blur-sm rounded-2xl p-5 border border-white/10"
                            initial={animate ? { opacity: 0, scale: 0.8 } : false}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ delay: 0.1 + i * 0.1, type: 'spring', stiffness: 200 }}
                        >
                            <div className="text-white/60 text-sm mb-1">{kpi.label}</div>
                            <div className={`text-2xl md:text-3xl font-bold ${kpi.color ? '' : 'text-white'}`} style={kpi.color ? { color: kpi.color } : {}}>
                                {kpi.value}
                            </div>
                            {kpi.trend && (
                                <div className={`text-sm mt-1 ${kpi.trend === 'up' ? 'text-emerald-400' : kpi.trend === 'down' ? 'text-red-400' : 'text-white/50'}`}>
                                    {kpi.trend === 'up' ? '↑' : kpi.trend === 'down' ? '↓' : '→'} {kpi.trend}
                                </div>
                            )}
                        </motion.div>
                    ))}
                </div>
            )}

            {/* Bullets */}
            {slide.bullets && slide.bullets.length > 0 && (
                <ul className="space-y-3 mb-6 flex-1">
                    {slide.bullets.map((b, i) => (
                        <motion.li
                            key={i}
                            className="flex items-start gap-3 text-lg text-white/90"
                            initial={animate ? { opacity: 0, x: -20 } : false}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: 0.2 + i * 0.12 }}
                        >
                            <span className="w-2 h-2 rounded-full bg-indigo-400 mt-2.5 shrink-0" />
                            <span>{b}</span>
                        </motion.li>
                    ))}
                </ul>
            )}

            {/* Chart */}
            {slide.chart && (
                <motion.div
                    className="flex-1 flex flex-col items-center justify-center mb-6"
                    initial={animate ? { opacity: 0 } : false}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.3 }}
                >
                    <div className="text-sm text-white/50 mb-2 font-semibold uppercase tracking-wider">{slide.chart.title}</div>
                    {slide.chart.type === 'bar' && <MiniBarChart data={slide.chart.data} animate={animate} />}
                    {slide.chart.type === 'pie' && (
                        <div className="flex items-center gap-8">
                            <MiniPieChart data={slide.chart.data} animate={animate} />
                            <div className="space-y-2">
                                {slide.chart.data.map((d, i) => (
                                    <div key={i} className="flex items-center gap-2 text-sm text-white/80">
                                        <span className="w-3 h-3 rounded-sm shrink-0" style={{ background: CHART_COLORS[i % CHART_COLORS.length] }} />
                                        {d.label}: {d.value.toLocaleString()}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                    {slide.chart.type === 'line' && <MiniLineChart data={slide.chart.data} animate={animate} />}
                </motion.div>
            )}

            {/* Table */}
            {slide.table && (
                <motion.div
                    className="mb-6 overflow-x-auto"
                    initial={animate ? { opacity: 0, y: 10 } : false}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 }}
                >
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b border-white/20">
                                {slide.table.headers.map((h, i) => (
                                    <th key={i} className="text-left py-3 px-4 text-white/60 font-semibold uppercase tracking-wider text-xs">{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {slide.table.rows.map((row, i) => (
                                <motion.tr
                                    key={i}
                                    className="border-b border-white/5 hover:bg-white/5"
                                    initial={animate ? { opacity: 0 } : false}
                                    animate={{ opacity: 1 }}
                                    transition={{ delay: 0.3 + i * 0.05 }}
                                >
                                    {slide.table!.headers.map((h, j) => (
                                        <td key={j} className="py-2.5 px-4 text-white/80">{String(row[h] ?? '')}</td>
                                    ))}
                                </motion.tr>
                            ))}
                        </tbody>
                    </table>
                </motion.div>
            )}

            {/* Spacer for title slides */}
            {layout === 'title' && <div className="mt-auto" />}
        </div>
    );
}

/* ═══════════════════════════════════════════════════════════════════
   MAIN: Presentation Viewer
   ═══════════════════════════════════════════════════════════════════ */
export default function PresentationViewer({ data, onClose, conversationId }: Props) {
    const [slides, setSlides] = useState<PresentationSlide[]>(data.slides);
    const [currentSlide, setCurrentSlide] = useState(0);
    const [isPlaying, setIsPlaying] = useState(false);
    const [isSpeaking, setIsSpeaking] = useState(false);
    const [isMuted, setIsMuted] = useState(false);
    const [speed, setSpeed] = useState(1);
    const [showNotes, setShowNotes] = useState(false);
    const [showQA, setShowQA] = useState(false);
    const [qaInput, setQaInput] = useState('');
    const [qaMessages, setQaMessages] = useState<{ role: 'user' | 'assistant'; text: string }[]>([]);
    const [qaLoading, setQaLoading] = useState(false);
    const [isListening, setIsListening] = useState(false);
    const [slideDirection, setSlideDirection] = useState(1);
    const [animateSlide, setAnimateSlide] = useState(true);
    const [elapsed, setElapsed] = useState(0);
    const [dynamicSlideLabel, setDynamicSlideLabel] = useState<string | null>(null);
    const [dynamicSlideIndices, setDynamicSlideIndices] = useState<Set<number>>(new Set());

    const synthRef = useRef<SpeechSynthesisUtterance | null>(null);
    const recognitionRef = useRef<any>(null);
    const timerRef = useRef<ReturnType<typeof setInterval>>();
    const qaEndRef = useRef<HTMLDivElement>(null);

    const slide = slides[currentSlide];
    const totalSlides = slides.length;
    const progress = ((currentSlide + 1) / totalSlides) * 100;

    /* ── Timer ──────────────────────────────────────────────────── */
    useEffect(() => {
        if (isPlaying) {
            timerRef.current = setInterval(() => setElapsed(e => e + 1), 1000);
        } else if (timerRef.current) {
            clearInterval(timerRef.current);
        }
        return () => { if (timerRef.current) clearInterval(timerRef.current); };
    }, [isPlaying]);

    const formatTime = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

    /* ── Speech Synthesis (Narration) ──────────────────────────── */
    const speak = useCallback((text: string) => {
        if (isMuted || !window.speechSynthesis) return;
        window.speechSynthesis.cancel();
        const isBangla = /[\u0980-\u09FF]/.test(text);
        const utter = new SpeechSynthesisUtterance(text);
        utter.rate = isBangla ? speed * 0.95 : speed;
        utter.pitch = 1;
        utter.volume = 1;
        utter.lang = isBangla ? 'bn-BD' : 'en-US';
        // Pick appropriate voice based on language
        const voices = window.speechSynthesis.getVoices();
        const preferred = isBangla
            ? (voices.find(v => v.lang.startsWith('bn'))
                || voices.find(v => v.name.toLowerCase().includes('bangla'))
                || voices.find(v => v.name.toLowerCase().includes('bengali'))
                || voices[0])
            : (voices.find(v => v.name.includes('Google') && v.lang.startsWith('en'))
                || voices.find(v => v.lang.startsWith('en') && v.localService)
                || voices[0]);
        if (preferred) utter.voice = preferred;

        utter.onstart = () => setIsSpeaking(true);
        utter.onend = () => {
            setIsSpeaking(false);
            // Auto-advance to next slide when narration finishes (if playing)
            if (isPlaying) {
                setTimeout(() => {
                    setCurrentSlide(prev => {
                        if (prev < totalSlides - 1) {
                            setSlideDirection(1);
                            setAnimateSlide(true);
                            return prev + 1;
                        }
                        setIsPlaying(false);
                        return prev;
                    });
                }, 800); // small pause between slides
            }
        };
        synthRef.current = utter;
        window.speechSynthesis.speak(utter);
    }, [isMuted, speed, isPlaying, totalSlides]);

    // Narrate current slide when it changes (if playing or manually triggered)
    useEffect(() => {
        if (isPlaying && slide?.speaker_notes) {
            speak(slide.speaker_notes);
        }
    }, [currentSlide, isPlaying]);

    // Ensure voices are loaded
    useEffect(() => {
        window.speechSynthesis?.getVoices();
        const onVoices = () => window.speechSynthesis.getVoices();
        window.speechSynthesis?.addEventListener?.('voiceschanged', onVoices);
        return () => window.speechSynthesis?.removeEventListener?.('voiceschanged', onVoices);
    }, []);

    /* ── Speech Recognition (Voice Q&A) ───────────────────────── */
    const toggleListening = () => {
        const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
        if (!SpeechRecognition) return;

        if (isListening) {
            recognitionRef.current?.stop();
            setIsListening(false);
            return;
        }

        const recog = new SpeechRecognition();
        recog.lang = 'en-US';
        recog.continuous = false;
        recog.interimResults = false;

        recog.onresult = (e: any) => {
            const transcript = e.results[0][0].transcript;
            setQaInput(transcript);
            setIsListening(false);
            // Auto-submit voice question
            handleQaSubmit(transcript);
        };
        recog.onerror = () => setIsListening(false);
        recog.onend = () => setIsListening(false);

        recognitionRef.current = recog;
        recog.start();
        setIsListening(true);

        // Pause narration while listening
        window.speechSynthesis.pause();
    };

    /* ── Q&A with Oli ─────────────────────────────────────────── */
    const handleQaSubmit = async (text?: string) => {
        const question = text || qaInput.trim();
        if (!question) return;
        setQaInput('');
        setQaMessages(prev => [...prev, { role: 'user', text: question }]);
        setQaLoading(true);

        // Pause narration
        const wasPlaying = isPlaying;
        setIsPlaying(false);
        window.speechSynthesis.cancel();

        try {
            // Build a summary of ALL slide titles so Oli knows the full presentation scope
            const allSlides = slides.map((s, i) => `Slide ${i + 1}: ${s.title}`).join(', ');
            const ctx = [
                `[LIVE PRESENTATION Q&A — INTERACTIVE MODE]`,
                `Presentation: "${data.title}" (${totalSlides} slides: ${allSlides}).`,
                `Currently viewing slide ${currentSlide + 1}/${totalSlides}: "${slide.title}".`,
                `Current slide notes: ${slide.speaker_notes}`,
                ``,
                `IMPORTANT INSTRUCTIONS:`,
                `- Answer the user's question conversationally (2-4 sentences). You're presenting live.`,
                `- If the question is about data IN the presentation, answer from what you know.`,
                `- If the question is about data NOT in the presentation (e.g., they ask about financials but the presentation is about production), USE YOUR TOOLS (finance_analyst, production_monitor, etc.) to fetch real data and answer.`,
                ``,
                `DYNAMIC SLIDE GENERATION:`,
                `When you fetch NEW data via tools to answer a question, you MUST also include a dynamic slide JSON at the END of your response in this exact format:`,
                `[SLIDE]{"title":"Slide Title","body":"optional body text","kpis":[{"label":"Revenue","value":"৳12.5L","trend":"up","color":"#10b981"}],"bullets":["Point 1","Point 2"],"chart":{"type":"bar","title":"Chart Title","data":[{"label":"Jan","value":100}]},"table":{"headers":["Col1","Col2"],"rows":[{"Col1":"val","Col2":"val"}]},"speaker_notes":"What Oli says aloud for this slide","layout":"kpi"}[/SLIDE]`,
                ``,
                `Include ONLY the fields that make sense. Always include title and speaker_notes. The slide will be instantly shown to the audience.`,
                `- For financial data: use kpis + chart (bar or pie)`,
                `- For lists/status: use bullets or table`,
                `- For trends: use chart (line)`,
                `- speaker_notes should be your verbal explanation of the data`,
                ``,
                `Write your conversational answer FIRST, then the [SLIDE] block. The answer is shown in the Q&A chat, the slide appears on screen.`,
            ].join('\n');
            const res = await axios.post('/ai-agent/chat', {
                message: `${ctx}\n\nUser question: ${question}`,
                conversation_id: conversationId,
            });
            const rawAnswer = res.data.response || "I'm not sure about that. Let me continue with the presentation.";

            // Extract dynamic slide if present
            let displayAnswer = rawAnswer;
            let dynamicSlide: PresentationSlide | null = null;
            const slideMatch = rawAnswer.match(/\[SLIDE\]([\s\S]*?)\[\/SLIDE\]/);
            if (slideMatch) {
                displayAnswer = rawAnswer.replace(/\[SLIDE\][\s\S]*?\[\/SLIDE\]/, '').trim();
                try {
                    const parsed = JSON.parse(slideMatch[1]);
                    dynamicSlide = {
                        title: parsed.title || 'Additional Information',
                        body: parsed.body,
                        bullets: parsed.bullets,
                        kpis: parsed.kpis,
                        table: parsed.table,
                        chart: parsed.chart,
                        speaker_notes: parsed.speaker_notes || displayAnswer,
                        layout: parsed.layout || (parsed.kpis ? 'kpi' : parsed.chart ? 'chart' : 'content'),
                    };
                } catch { /* JSON parse failed, just show text answer */ }
            }

            setQaMessages(prev => [...prev, { role: 'assistant', text: displayAnswer }]);

            // Inject dynamic slide if we got one
            if (dynamicSlide) {
                const insertAt = currentSlide + 1;
                setSlides(prev => {
                    const updated = [...prev];
                    updated.splice(insertAt, 0, dynamicSlide!);
                    return updated;
                });
                setDynamicSlideIndices(prev => new Set([...prev, insertAt]));
                setDynamicSlideLabel(dynamicSlide.title);
                // Short delay then navigate to the new slide
                setTimeout(() => {
                    setSlideDirection(1);
                    setAnimateSlide(true);
                    setCurrentSlide(insertAt);
                    // Clear label after a few seconds
                    setTimeout(() => setDynamicSlideLabel(null), 4000);
                }, 400);
            }

            // Speak the answer + slide narration
            const speakText = dynamicSlide?.speaker_notes || displayAnswer;
            if (!isMuted) {
                const cleanText = speakText.replace(/\*\*/g, '').replace(/[#*_`]/g, '').replace(/\[.*?\]/g, '');
                const utter = new SpeechSynthesisUtterance(cleanText);
                utter.rate = speed;
                const voices = window.speechSynthesis.getVoices();
                const preferred = voices.find(v => v.name.includes('Google') && v.lang.startsWith('en'))
                    || voices.find(v => v.lang.startsWith('en'));
                if (preferred) utter.voice = preferred;
                utter.onend = () => {
                    // Resume if was playing (after a pause)
                    if (wasPlaying) {
                        setTimeout(() => setIsPlaying(true), 800);
                    }
                };
                window.speechSynthesis.speak(utter);
            }
        } catch {
            setQaMessages(prev => [...prev, { role: 'assistant', text: "Sorry, I couldn't process that question. Let me continue the presentation." }]);
        } finally {
            setQaLoading(false);
        }
    };

    // Scroll Q&A to bottom
    useEffect(() => {
        qaEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [qaMessages]);

    /* ── Navigation ────────────────────────────────────────────── */
    const goTo = (index: number) => {
        if (index < 0 || index >= totalSlides || index === currentSlide) return;
        window.speechSynthesis.cancel();
        setSlideDirection(index > currentSlide ? 1 : -1);
        setAnimateSlide(true);
        setCurrentSlide(index);
    };

    const next = () => goTo(currentSlide + 1);
    const prev = () => goTo(currentSlide - 1);

    const togglePlay = () => {
        if (isPlaying) {
            setIsPlaying(false);
            window.speechSynthesis.cancel();
        } else {
            setIsPlaying(true);
            // Will trigger narration via useEffect
        }
    };

    /* ── Keyboard shortcuts ───────────────────────────────────── */
    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            if (showQA && e.key !== 'Escape') return; // Don't capture when typing
            switch (e.key) {
                case 'ArrowRight': case ' ': e.preventDefault(); next(); break;
                case 'ArrowLeft': e.preventDefault(); prev(); break;
                case 'Escape': e.preventDefault(); onClose(); break;
                case 'p': togglePlay(); break;
                case 'm': setIsMuted(m => !m); break;
                case 'q': setShowQA(q => !q); break;
            }
        };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, [currentSlide, isPlaying, showQA]);

    // Cleanup speech on unmount
    useEffect(() => {
        return () => {
            window.speechSynthesis?.cancel();
            recognitionRef.current?.stop();
            if (timerRef.current) clearInterval(timerRef.current);
        };
    }, []);

    /* ── Slide animation variants ─────────────────────────────── */
    const slideVariants = {
        enter: (dir: number) => ({ x: dir > 0 ? 300 : -300, opacity: 0 }),
        center: { x: 0, opacity: 1 },
        exit: (dir: number) => ({ x: dir > 0 ? -300 : 300, opacity: 0 }),
    };

    return (
        <motion.div
            className="fixed inset-0 z-[200] bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-950 flex flex-col"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
        >
            {/* ── Top Bar ──────────────────────────────────────────── */}
            <div className="flex items-center justify-between px-4 py-2.5 bg-black/30 backdrop-blur-sm border-b border-white/10">
                <div className="flex items-center gap-3">
                    <Presentation className="w-5 h-5 text-indigo-400" />
                    <div>
                        <div className="text-white font-bold text-sm">{data.title}</div>
                        <div className="text-white/40 text-[10px]">
                            Slide {currentSlide + 1} of {totalSlides} · {formatTime(elapsed)}
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    {/* Speed control */}
                    <div className="flex items-center gap-1 bg-white/10 rounded-lg px-2 py-1">
                        <Gauge className="w-3 h-3 text-white/50" />
                        {[0.75, 1, 1.25, 1.5].map(s => (
                            <button
                                key={s}
                                onClick={() => setSpeed(s)}
                                className={`text-[10px] px-1.5 py-0.5 rounded font-mono transition-colors ${
                                    speed === s ? 'bg-indigo-500 text-white' : 'text-white/50 hover:text-white'
                                }`}
                            >
                                {s}x
                            </button>
                        ))}
                    </div>

                    <button onClick={() => setShowNotes(n => !n)}
                        className={`p-2 rounded-lg transition-colors ${showNotes ? 'bg-indigo-500/30 text-indigo-300' : 'text-white/50 hover:text-white hover:bg-white/10'}`}
                        title="Speaker Notes">
                        <MessageSquare className="w-4 h-4" />
                    </button>
                    <button onClick={() => setShowQA(q => !q)}
                        className={`p-2 rounded-lg transition-colors ${showQA ? 'bg-indigo-500/30 text-indigo-300' : 'text-white/50 hover:text-white hover:bg-white/10'}`}
                        title="Ask a Question (Q)">
                        <Mic className="w-4 h-4" />
                    </button>
                    <button onClick={onClose}
                        className="p-2 rounded-lg text-white/50 hover:text-red-400 hover:bg-white/10 transition-colors"
                        title="Exit (Esc)">
                        <X className="w-4 h-4" />
                    </button>
                </div>
            </div>

            {/* ── Progress Bar ─────────────────────────────────────── */}
            <div className="h-1 bg-white/10">
                <motion.div
                    className="h-full bg-gradient-to-r from-indigo-500 to-purple-500"
                    animate={{ width: `${progress}%` }}
                    transition={{ duration: 0.3 }}
                />
            </div>

            {/* ── Main Content ─────────────────────────────────────── */}
            <div className="flex-1 flex overflow-hidden relative">
                {/* Slide Area */}
                <div className="flex-1 relative overflow-hidden">
                    <AnimatePresence mode="wait" custom={slideDirection}>
                        <motion.div
                            key={currentSlide}
                            custom={slideDirection}
                            variants={slideVariants}
                            initial="enter"
                            animate="center"
                            exit="exit"
                            transition={{ duration: 0.4, ease: 'easeInOut' }}
                            className="absolute inset-0 text-white"
                        >
                            <SlideContent slide={slide} animate={animateSlide} />
                        </motion.div>
                    </AnimatePresence>

                    {/* Click-to-navigate zones */}
                    <div className="absolute inset-0 flex pointer-events-none">
                        <div className="w-1/4 h-full pointer-events-auto cursor-pointer group" onClick={prev}>
                            <div className="h-full flex items-center pl-3 opacity-0 group-hover:opacity-100 transition-opacity">
                                <ChevronLeft className="w-10 h-10 text-white/30" />
                            </div>
                        </div>
                        <div className="flex-1" />
                        <div className="w-1/4 h-full pointer-events-auto cursor-pointer group" onClick={next}>
                            <div className="h-full flex items-center justify-end pr-3 opacity-0 group-hover:opacity-100 transition-opacity">
                                <ChevronRight className="w-10 h-10 text-white/30" />
                            </div>
                        </div>
                    </div>

                    {/* Speaking indicator */}
                    <AnimatePresence>
                        {isSpeaking && (
                            <motion.div
                                className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-indigo-500/20 backdrop-blur-sm rounded-full px-4 py-2 border border-indigo-500/30"
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: 10 }}
                            >
                                <div className="flex gap-0.5">
                                    {[0,1,2,3,4].map(i => (
                                        <motion.div
                                            key={i}
                                            className="w-0.5 bg-indigo-400 rounded-full"
                                            animate={{ height: [4, 16, 4] }}
                                            transition={{ duration: 0.5, delay: i * 0.1, repeat: Infinity }}
                                        />
                                    ))}
                                </div>
                                <span className="text-indigo-300 text-xs font-medium">Oli is presenting...</span>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    {/* Dynamic slide injected indicator */}
                    <AnimatePresence>
                        {dynamicSlideLabel && (
                            <motion.div
                                className="absolute top-4 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-emerald-500/20 backdrop-blur-sm rounded-full px-4 py-2 border border-emerald-500/30"
                                initial={{ opacity: 0, y: -20, scale: 0.9 }}
                                animate={{ opacity: 1, y: 0, scale: 1 }}
                                exit={{ opacity: 0, y: -20, scale: 0.9 }}
                            >
                                <Sparkles className="w-4 h-4 text-emerald-400" />
                                <span className="text-emerald-300 text-xs font-semibold">Live slide: {dynamicSlideLabel}</span>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>

                {/* ── Speaker Notes Panel ──────────────────────────── */}
                <AnimatePresence>
                    {showNotes && (
                        <motion.div
                            className="w-80 bg-black/40 backdrop-blur-sm border-l border-white/10 p-4 overflow-y-auto"
                            initial={{ width: 0, opacity: 0 }}
                            animate={{ width: 320, opacity: 1 }}
                            exit={{ width: 0, opacity: 0 }}
                        >
                            <div className="text-white/40 text-xs font-semibold uppercase tracking-wider mb-3">Speaker Notes</div>
                            <p className="text-white/80 text-sm leading-relaxed">{slide.speaker_notes}</p>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* ── Q&A Panel ────────────────────────────────────── */}
                <AnimatePresence>
                    {showQA && (
                        <motion.div
                            className="w-96 bg-black/40 backdrop-blur-sm border-l border-white/10 flex flex-col"
                            initial={{ width: 0, opacity: 0 }}
                            animate={{ width: 384, opacity: 1 }}
                            exit={{ width: 0, opacity: 0 }}
                        >
                            <div className="p-4 border-b border-white/10">
                                <div className="text-white font-bold text-sm flex items-center gap-2">
                                    <MessageSquare className="w-4 h-4 text-indigo-400" />
                                    Ask Oli a Question
                                </div>
                                <div className="text-white/40 text-[10px] mt-1">Voice or type your question — Oli will answer in context</div>
                            </div>

                            {/* Messages */}
                            <div className="flex-1 overflow-y-auto p-4 space-y-3">
                                {qaMessages.length === 0 && (
                                    <div className="text-center text-white/30 text-sm mt-8">
                                        <Mic className="w-8 h-8 mx-auto mb-3 opacity-50" />
                                        <p>Ask anything — even beyond this presentation</p>
                                        <p className="text-[10px] mt-2 text-white/20 leading-relaxed">
                                            Oli can fetch live data from the system to answer questions
                                            not covered in the slides.
                                        </p>
                                        <div className="mt-4 space-y-1.5">
                                            {[
                                                'Explain this chart in detail',
                                                'What\'s the financial summary?',
                                                'Which machines are down right now?',
                                                'Show me overdue work orders',
                                            ].map((q, i) => (
                                                <button
                                                    key={i}
                                                    onClick={() => handleQaSubmit(q)}
                                                    className="block w-full text-left px-3 py-1.5 rounded-lg bg-white/5 text-white/40 text-[11px]
                                                               hover:bg-white/10 hover:text-white/60 transition-colors"
                                                >
                                                    "{q}"
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}
                                {qaMessages.map((msg, i) => (
                                    <motion.div
                                        key={i}
                                        className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                                        initial={{ opacity: 0, y: 5 }}
                                        animate={{ opacity: 1, y: 0 }}
                                    >
                                        <div className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm ${
                                            msg.role === 'user'
                                                ? 'bg-indigo-500/30 text-white'
                                                : 'bg-white/10 text-white/90'
                                        }`}>
                                            {msg.text}
                                        </div>
                                    </motion.div>
                                ))}
                                {qaLoading && (
                                    <div className="flex justify-start">
                                        <div className="bg-white/10 rounded-2xl px-3 py-2">
                                            <Loader2 className="w-4 h-4 text-indigo-400 animate-spin" />
                                        </div>
                                    </div>
                                )}
                                <div ref={qaEndRef} />
                            </div>

                            {/* Input */}
                            <div className="p-3 border-t border-white/10">
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={toggleListening}
                                        className={`p-2 rounded-xl transition-all ${
                                            isListening
                                                ? 'bg-red-500/30 text-red-400 animate-pulse'
                                                : 'bg-white/10 text-white/50 hover:text-white'
                                        }`}
                                        title="Voice input"
                                    >
                                        {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                                    </button>
                                    <input
                                        type="text"
                                        value={qaInput}
                                        onChange={e => setQaInput(e.target.value)}
                                        onKeyDown={e => e.key === 'Enter' && handleQaSubmit()}
                                        placeholder="Type a question..."
                                        className="flex-1 bg-white/10 border border-white/10 rounded-xl px-3 py-2 text-sm text-white placeholder-white/30 focus:outline-none focus:border-indigo-500/50"
                                    />
                                    <button
                                        onClick={() => handleQaSubmit()}
                                        disabled={!qaInput.trim() || qaLoading}
                                        className="p-2 rounded-xl bg-indigo-500 text-white disabled:opacity-30 hover:bg-indigo-600 transition-colors"
                                    >
                                        <Send className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            {/* ── Bottom Controls ──────────────────────────────────── */}
            <div className="bg-black/30 backdrop-blur-sm border-t border-white/10 px-4 py-3">
                {/* Slide thumbnails / dots */}
                <div className="flex items-center justify-center gap-1.5 mb-3">
                    {slides.map((_, i) => {
                        const isDyn = dynamicSlideIndices.has(i);
                        return (
                            <button
                                key={i}
                                onClick={() => goTo(i)}
                                className={`transition-all rounded-full ${
                                    i === currentSlide
                                        ? isDyn ? 'w-8 h-2 bg-emerald-400' : 'w-8 h-2 bg-indigo-500'
                                        : i < currentSlide
                                        ? isDyn ? 'w-2 h-2 bg-emerald-400/50 hover:bg-emerald-400' : 'w-2 h-2 bg-indigo-500/50 hover:bg-indigo-400'
                                        : isDyn ? 'w-2 h-2 bg-emerald-400/30 hover:bg-emerald-400' : 'w-2 h-2 bg-white/20 hover:bg-white/40'
                                }`}
                                title={`${isDyn ? '✨ Live: ' : ''}Slide ${i + 1}: ${slides[i].title}`}
                            />
                        );
                    })}
                </div>

                {/* Main controls */}
                <div className="flex items-center justify-center gap-3">
                    <button onClick={prev} disabled={currentSlide === 0}
                        className="p-2.5 rounded-xl text-white/70 hover:text-white hover:bg-white/10 disabled:opacity-20 transition-all">
                        <SkipBack className="w-5 h-5" />
                    </button>

                    <button
                        onClick={togglePlay}
                        className={`p-4 rounded-2xl transition-all ${
                            isPlaying
                                ? 'bg-indigo-500 text-white shadow-lg shadow-indigo-500/30'
                                : 'bg-white/10 text-white hover:bg-indigo-500 hover:shadow-lg hover:shadow-indigo-500/30'
                        }`}
                    >
                        {isPlaying ? <Pause className="w-6 h-6" /> : <Play className="w-6 h-6 ml-0.5" />}
                    </button>

                    <button onClick={next} disabled={currentSlide === totalSlides - 1}
                        className="p-2.5 rounded-xl text-white/70 hover:text-white hover:bg-white/10 disabled:opacity-20 transition-all">
                        <SkipForward className="w-5 h-5" />
                    </button>

                    <div className="w-px h-8 bg-white/10 mx-2" />

                    <button onClick={() => setIsMuted(m => !m)}
                        className={`p-2.5 rounded-xl transition-all ${isMuted ? 'text-red-400 bg-red-500/10' : 'text-white/70 hover:text-white hover:bg-white/10'}`}>
                        {isMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
                    </button>

                    <button onClick={() => { setCurrentSlide(0); setIsPlaying(false); window.speechSynthesis.cancel(); setElapsed(0); }}
                        className="p-2.5 rounded-xl text-white/70 hover:text-white hover:bg-white/10 transition-all"
                        title="Restart">
                        <RotateCcw className="w-5 h-5" />
                    </button>
                </div>

                {/* Keyboard hints */}
                <div className="flex items-center justify-center gap-4 mt-2 text-[10px] text-white/30">
                    <span>← → Navigate</span>
                    <span>Space Next</span>
                    <span>P Play/Pause</span>
                    <span>M Mute</span>
                    <span>Q Ask Question</span>
                    <span>Esc Exit</span>
                </div>
            </div>
        </motion.div>
    );
}
