import { useState, useRef, useEffect, useCallback } from 'react';
import { router, usePage } from '@inertiajs/react';
import { motion, AnimatePresence } from 'motion/react';
import {
    Bot, X, Send, RotateCcw, Sparkles, Loader2, Zap, ChevronDown,
    Mic, MicOff, Volume2, VolumeX, Smile, Paperclip, Eye, EyeOff,
    Maximize2, Minimize2, Bell, CheckSquare, Square, Navigation,
    Presentation, Play, ArrowUp,
} from 'lucide-react';
import axios from 'axios';
import PresentationViewer, { type PresentationData } from './PresentationViewer';

/* ─── Types ──────────────────────────────────────────────────────── */
interface Message {
    id: string;
    role: 'user' | 'assistant' | 'system';
    content: string;
    toolCalls?: { name: string; display_name?: string }[];
    timestamp: Date;
    options?: ChatOption[];
    checkboxes?: ChatCheckbox[];
    attachment?: { name: string; type: string; url: string };
    navigateTo?: { url: string; label: string };
    presentationUrl?: string;
    isStreaming?: boolean;
}

interface ChatOption { label: string; value: string }
interface ChatCheckbox { label: string; value: string; checked?: boolean }

/* ─── Constants ──────────────────────────────────────────────────── */
const SUGGESTIONS = [
    { icon: '👋', text: 'Oli, introduce yourself' },
    { icon: '🇧🇩', text: 'Oli, বাংলায় নিজের পরিচয় দাও' },
    { icon: '📊', text: 'What are today\'s production stats?' },
    { icon: '⚠️', text: 'Show me overdue work orders' },
    { icon: '🔧', text: 'Which machines need maintenance?' },
    { icon: '🎬', text: 'Present this month\'s production report live' },
];

const EMOJI_LIST = ['👍','👎','✅','❌','🔧','📊','💰','⚡','🏭','📦','🚛','🔍','💡','⏰','🎯','📈','📉','🔥','✨','👏'];

/* ─── Typing dots indicator ──────────────────────────────────────── */
function TypingDots() {
    return (
        <div className="flex items-center gap-1 px-1 py-1">
            {[0, 1, 2].map(i => (
                <motion.span
                    key={i}
                    className="w-1.5 h-1.5 rounded-full bg-brand-400"
                    animate={{ y: [0, -5, 0], opacity: [0.3, 1, 0.3] }}
                    transition={{ duration: 0.7, delay: i * 0.15, repeat: Infinity, ease: 'easeInOut' }}
                />
            ))}
        </div>
    );
}

/* ─── Tool activity indicator ────────────────────────────────────── */
// Tool display name mapping (mirrors backend ToolRegistry::displayName)
const TOOL_DISPLAY: Record<string, string> = {
    production_monitor:   '🏭 Production Monitor',
    work_order_tracker:   '📋 Work Order Tracker',
    machine_health_agent: '🔧 Machine Health Agent',
    finance_analyst:      '💰 Finance Analyst',
    qc_inspector:         '✅ QC Inspector',
    quality_analyst:      '📊 Quality Analyst',
    sales_pipeline_agent: '📈 Sales Pipeline Agent',
    downtime_analyst:     '⏱️ Downtime Analyst',
    live_presentation:    '🎬 Live Presenter',
    oli_introduction:     '👋 Oli Introduction',
};

function ToolIndicator({ tools }: { tools: string[] }) {
    return (
        <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="flex items-center gap-2 px-3 py-2 rounded-xl bg-brand-50 border border-brand-200 text-brand-700 text-[11px] font-semibold"
        >
            <Loader2 className="w-3 h-3 animate-spin shrink-0" />
            {tools.map(t => TOOL_DISPLAY[t] || t.replace(/_/g, ' ')).join(' → ')}
        </motion.div>
    );
}

/* ─── Markdown renderer ──────────────────────────────────────────── */
/* ─── File download card ─────────────────────────────────────────── */
const FILE_ICONS: Record<string, { icon: string; color: string; label: string }> = {
    xlsx: { icon: '📑', color: 'bg-emerald-50 border-emerald-200 text-emerald-700', label: 'Excel Spreadsheet' },
    pdf:  { icon: '📄', color: 'bg-red-50 border-red-200 text-red-700', label: 'PDF Document' },
    pptx: { icon: '📽️', color: 'bg-orange-50 border-orange-200 text-orange-700', label: 'PowerPoint Presentation' },
    svg:  { icon: '📊', color: 'bg-blue-50 border-blue-200 text-blue-700', label: 'Chart Image' },
};

function DownloadCard({ url, filename, type }: { url: string; filename: string; type: string }) {
    const fi = FILE_ICONS[type] ?? FILE_ICONS.pdf;
    return (
        <a href={url} target="_blank" rel="noopener noreferrer" download={filename}
            className={`flex items-center gap-3 px-3 py-2.5 rounded-xl border transition-all hover:-translate-y-0.5 hover:shadow-md ${fi.color}`}>
            <span className="text-xl">{fi.icon}</span>
            <div className="flex-1 min-w-0">
                <div className="text-xs font-bold truncate">{filename}</div>
                <div className="text-[10px] opacity-70">{fi.label} · Click to download</div>
            </div>
            <svg className="w-4 h-4 shrink-0 opacity-50" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3" />
            </svg>
        </a>
    );
}

function InlineChart({ url, title }: { url: string; title: string }) {
    return (
        <div className="mt-2 rounded-xl overflow-hidden border border-surface-200 bg-white">
            <img src={url} alt={title} className="w-full" />
        </div>
    );
}

/* ─── Extract quick-reply options from AI text ───────────────────── */
function extractQuickReplies(text: string): { cleanText: string; options: string[] } {
    const options: string[] = [];
    const lines = text.split('\n');
    const cleanLines: string[] = [];

    // Common option-starting emojis (as literal strings for reliable matching)
    const optionStarters = ['📅', '📐', '📦', '✅', '❌', '⏭️', '✏️', '🏢', '📝', '📋', '🔧', '💰', '📊', '📈', '📎', '🗓️', '📸'];

    for (const line of lines) {
        const trimmed = line.trim();

        // Check if line starts with a known option emoji
        const isOption = optionStarters.some(e => trimmed.startsWith(e));

        if (isOption && trimmed.length > 3 && trimmed.length < 100 && !trimmed.startsWith('**')) {
            options.push(trimmed);
        } else {
            cleanLines.push(line);
        }
    }

    // Only extract if we found 2+ options (single emoji line is just decoration)
    if (options.length >= 2) {
        return { cleanText: cleanLines.join('\n').replace(/\n{3,}/g, '\n\n').trim(), options };
    }

    return { cleanText: text, options: [] };
}

/* ─── Quick reply buttons component ──────────────────────────────── */
function QuickReplyButtons({ options, onSelect }: { options: string[]; onSelect: (text: string) => void }) {
    return (
        <div className="mt-2.5 flex flex-wrap gap-1.5">
            {options.map((opt, i) => (
                <button
                    key={i}
                    onClick={() => onSelect(opt)}
                    className="px-3 py-2 rounded-xl text-xs font-semibold text-left
                               bg-white border border-surface-200 text-surface-700
                               hover:bg-brand-50 hover:border-brand-300 hover:text-brand-700
                               active:scale-[0.97] transition-all shadow-sm"
                >
                    {opt}
                </button>
            ))}
        </div>
    );
}

/* ─── Navigation button inside messages ──────────────────────────── */
function NavigateButton({ url, label }: { url: string; label: string }) {
    return (
        <button
            onClick={() => { router.visit(url); }}
            className="mt-2 flex items-center gap-2.5 w-full px-3.5 py-2.5 rounded-xl
                       bg-gradient-to-r from-brand-500 to-brand-600 text-white text-sm font-semibold
                       shadow-md hover:from-brand-400 hover:to-brand-500
                       hover:-translate-y-0.5 hover:shadow-lg
                       active:scale-[0.98] transition-all"
        >
            <Navigation className="w-4 h-4 shrink-0" />
            <span>Open {label}</span>
            <svg className="w-3.5 h-3.5 ml-auto opacity-60" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12h14M12 5l7 7-7 7" />
            </svg>
        </button>
    );
}

/* ─── Live Presentation launch button ───────────────────────────── */
function PresentationLaunchButton({ onClick }: { onClick: () => void }) {
    return (
        <motion.button
            onClick={onClick}
            className="mt-3 flex items-center gap-3 w-full px-4 py-3.5 rounded-2xl
                       bg-gradient-to-r from-indigo-600 via-purple-600 to-indigo-700 text-white text-sm font-bold
                       shadow-lg shadow-indigo-500/25 hover:shadow-xl hover:shadow-indigo-500/40
                       hover:-translate-y-0.5 active:scale-[0.98] transition-all group overflow-hidden relative"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ type: 'spring', stiffness: 200 }}
        >
            {/* Animated background shimmer */}
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -skew-x-12 translate-x-[-200%] group-hover:translate-x-[200%] transition-transform duration-1000" />
            <div className="relative flex items-center gap-3 w-full">
                <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
                    <Presentation className="w-5 h-5" />
                </div>
                <div className="flex-1 text-left">
                    <div className="font-bold">Start Live Presentation</div>
                    <div className="text-[10px] text-white/60 font-normal">Voice narration · Interactive Q&A · Fullscreen</div>
                </div>
                <Play className="w-5 h-5 opacity-60 group-hover:opacity-100 transition-opacity" />
            </div>
        </motion.button>
    );
}

/* ─── Extract navigation links from AI response ─────────────────── */
function extractNavigation(text: string): { cleanText: string; nav: { url: string; label: string } | null } {
    let nav: { url: string; label: string } | null = null;

    // Match internal app URLs — both absolute (http://...) and relative (/rfqs/5)
    const absUrlMatch = text.match(/https?:\/\/[^\s)]+?(\/(?:admin|dashboard|rfqs|cost-estimates|quotations|pcd|work-orders|operation-sheets|schedule|shop-floor|wip|qc|ncrs|delivery|invoices|reports|profile|notifications)[a-z0-9\-\/]*)/i);
    const relUrlMatch = text.match(/(\/(?:admin|dashboard|rfqs|cost-estimates|quotations|pcd|work-orders|operation-sheets|schedule|shop-floor|wip|qc|ncrs|delivery|invoices|reports|profile|notifications)[a-z0-9\-\/]*)/i);

    const urlMatch = absUrlMatch || relUrlMatch;
    if (urlMatch) {
        const url = urlMatch[1];
        // Smart label: "/rfqs/5" → "View RFQ #5", "/admin/branding" → "Branding"
        let label = 'View Details';
        const idMatch = url.match(/\/(\w[\w-]*)\/(\d+)$/);
        if (idMatch) {
            const resource = idMatch[1].replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
            label = `View ${resource} #${idMatch[2]}`;
        } else {
            const contextMatch = text.match(/(?:view|open|go to|navigate to)\s+(?:the\s+)?(?:\*\*)?([^*\n.!?]{2,40})(?:\*\*)?/i);
            label = contextMatch?.[1]?.trim() || url.split('/').filter(Boolean).pop()?.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) || 'View Details';
        }
        nav = { url, label };

        // Clean the full absolute URL from text (keep it cleaner)
        let cleanText = text;
        if (absUrlMatch) {
            cleanText = cleanText.replace(absUrlMatch[0], '').replace(/📋\s*View RFQ:\s*$/m, '').trim();
        }
        return { cleanText, nav };
    }

    return { cleanText: text, nav };
}

/* ─── Extract file links from AI response text ──────────────────── */
function extractFiles(text: string): { cleanText: string; files: { url: string; filename: string; type: string }[] } {
    const files: { url: string; filename: string; type: string }[] = [];
    // Match absolute URLs to ai-reports download route or storage
    const absRegex = /(https?:\/\/[^\s)\]]+\/ai-reports\/(?:download\/)?[^\s)\]]+\.(xlsx|pdf|pptx|svg))/gi;
    let cleanText = text.replace(absRegex, (match, url, ext) => {
        const filename = url.split('/').pop() || `report.${ext}`;
        files.push({ url, filename, type: ext.toLowerCase() });
        return '';
    });
    // Match relative URLs
    const relRegex = /(\/ai-reports\/(?:download\/)?[^\s)\]]+\.(xlsx|pdf|pptx|svg))/gi;
    cleanText = cleanText.replace(relRegex, (match, url, ext) => {
        const filename = url.split('/').pop() || `report.${ext}`;
        if (!files.find(f => f.filename === filename)) {
            files.push({ url, filename, type: ext.toLowerCase() });
        }
        return '';
    });
    // Match markdown links: [text](url)
    const mdRegex = /\[([^\]]*)\]\(([^)]*\/ai-reports\/(?:download\/)?[^\s)]+\.(xlsx|pdf|pptx|svg))\)/gi;
    cleanText = cleanText.replace(mdRegex, (match, label, url, ext) => {
        const filename = url.split('/').pop() || `report.${ext}`;
        if (!files.find(f => f.filename === filename)) {
            files.push({ url, filename, type: ext.toLowerCase() });
        }
        return '';
    });
    // Clean up leftover empty lines, brackets
    cleanText = cleanText.replace(/\[\]\(?\)?/g, '').replace(/\n{3,}/g, '\n\n').trim();
    return { cleanText, files };
}

function MarkdownLite({ text, onQuickReply }: { text: string; onQuickReply?: (text: string) => void }) {
    const { cleanText: textAfterFiles, files } = extractFiles(text);
    const { cleanText: textAfterNav, nav } = extractNavigation(textAfterFiles);
    const { cleanText, options: quickReplies } = extractQuickReplies(textAfterNav);
    const lines = cleanText.split('\n');
    return (
        <div className="space-y-1 text-[13px] leading-relaxed">
            {lines.map((line, i) => {
                // Headers
                if (line.startsWith('### '))  return <h4 key={i} className="font-bold text-sm mt-2">{line.slice(4)}</h4>;
                if (line.startsWith('## '))   return <h3 key={i} className="font-bold text-sm mt-2">{line.slice(3)}</h3>;
                // Bold + inline code
                let html = line
                    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
                    .replace(/`(.+?)`/g, '<code class="px-1 py-0.5 bg-surface-100 rounded text-[11px] font-mono">$1</code>');
                // Bullets
                if (/^[-*]\s/.test(line)) {
                    return <div key={i} className="flex gap-2 pl-1">
                        <span className="text-brand-500 mt-0.5 shrink-0">•</span>
                        <span dangerouslySetInnerHTML={{ __html: html.replace(/^[-*]\s/, '') }} />
                    </div>;
                }
                // Numbered list
                const numMatch = line.match(/^(\d+)\.\s/);
                if (numMatch) {
                    return <div key={i} className="flex gap-2 pl-1">
                        <span className="text-brand-500 font-bold shrink-0 text-xs w-4 text-right">{numMatch[1]}.</span>
                        <span dangerouslySetInnerHTML={{ __html: html.replace(/^\d+\.\s/, '') }} />
                    </div>;
                }
                if (line.trim() === '') return <div key={i} className="h-1.5" />;
                // Table row (pipe-separated)
                if (line.includes('|') && !line.match(/^[\s|:-]+$/)) {
                    const cells = line.split('|').map(c => c.trim()).filter(Boolean);
                    return (
                        <div key={i} className="flex gap-2 text-[11px]">
                            {cells.map((c, j) => (
                                <span key={j} className="flex-1 truncate" dangerouslySetInnerHTML={{ __html: c.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>') }} />
                            ))}
                        </div>
                    );
                }
                if (line.match(/^[\s|:-]+$/)) return null; // skip table separators
                return <div key={i} dangerouslySetInnerHTML={{ __html: html }} />;
            })}

            {/* Render quick-reply buttons */}
            {quickReplies.length > 0 && onQuickReply && (
                <QuickReplyButtons options={quickReplies} onSelect={onQuickReply} />
            )}

            {/* Render navigation button */}
            {nav && <NavigateButton url={nav.url} label={nav.label} />}

            {/* Render file downloads */}
            {files.length > 0 && (
                <div className="mt-3 space-y-2">
                    {files.map((f, i) => (
                        f.type === 'svg'
                            ? <InlineChart key={i} url={f.url} title={f.filename} />
                            : <DownloadCard key={i} {...f} />
                    ))}
                </div>
            )}
        </div>
    );
}

interface Convo { id: number; title: string; pinned: boolean; updated_at: string }

/* ─── Main ChatPanel ─────────────────────────────────────────────── */
export default function ChatPanel() {
    const { auth, chatbotSettings: cs } = usePage().props as any;
    const userName = auth?.user?.name || 'You';

    // Chatbot settings (with defaults)
    const botName     = cs?.name || 'Oli';
    const botSubtitle = cs?.subtitle || 'AI Chatbot';
    const botWelcome  = cs?.welcome || "Hi! I'm Oli 👋";
    const botWelcomeSub = cs?.welcome_sub || 'Your AI assistant for BITAC PMS.';
    const botPlaceholder = cs?.placeholder || 'Ask about production, machines, finance...';
    const botFooter   = cs?.footer || 'Powered by Technocrats';
    const masterAiEnabled = (usePage().props as any)?.aiEnabled !== false;
    const botEnabled  = masterAiEnabled && cs?.enabled !== 'no';
    const showAvatar  = cs?.show_avatar !== 'no';
    const fabLeft     = cs?.fab_position === 'bottom-left';
    const primaryColor = cs?.primary_color || '#ff7a0f';
    const bubbleUser  = cs?.bubble_user || 'light';
    const bubbleBotStyle = cs?.bubble_bot || 'light';
    const iconType    = cs?.icon_type || 'font';
    const iconFont    = cs?.icon_font || 'fi-rr-robot';
    const iconImageUrl = cs?.icon_image_url || null;

    // Render the chatbot icon based on settings
    const BotIcon = ({ className = 'w-5 h-5', white = true }: { className?: string; white?: boolean }) => {
        if (iconType === 'image' && iconImageUrl) {
            return <img src={iconImageUrl} alt="" className={`${className} object-contain`} />;
        }
        return <i className={`fi ${iconFont} ${white ? 'text-white' : ''} leading-none`} />;
    };

    const [open, setOpen] = useState(() => {
        try { return localStorage.getItem('oli_open') === '1'; } catch { return false; }
    });
    const [fullscreen, setFullscreen] = useState(() => {
        try { return localStorage.getItem('oli_fullscreen') === '1'; } catch { return false; }
    });
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const [activeTools, setActiveTools] = useState<string[]>([]);
    const [unread, setUnread] = useState(0);

    // Conversation persistence
    const [conversationId, setConversationId] = useState<number | null>(() => {
        try { const v = localStorage.getItem('oli_convo_id'); return v ? parseInt(v) : null; } catch { return null; }
    });
    const [conversations, setConversations] = useState<Convo[]>([]);
    const [showHistory, setShowHistory] = useState(false);
    const [historyLoading, setHistoryLoading] = useState(false);

    // Persist open/fullscreen/conversationId to localStorage
    useEffect(() => { try { localStorage.setItem('oli_open', open ? '1' : '0'); } catch {} }, [open]);
    useEffect(() => { try { localStorage.setItem('oli_fullscreen', fullscreen ? '1' : '0'); } catch {} }, [fullscreen]);
    useEffect(() => { try { if (conversationId) localStorage.setItem('oli_convo_id', String(conversationId)); else localStorage.removeItem('oli_convo_id'); } catch {} }, [conversationId]);

    // Restore messages from DB when mounting with an existing conversation
    const [restored, setRestored] = useState(false);
    useEffect(() => {
        if (restored || !conversationId || !open) return;
        setRestored(true);
        (async () => {
            try {
                const { data } = await axios.get(`/ai-agent/conversations/${conversationId}/messages`);
                if (data.messages?.length) {
                    setMessages(data.messages.map((m: any) => ({
                        ...m,
                        timestamp: new Date(m.timestamp),
                        toolCalls: m.toolCalls?.map((t: any) => typeof t === 'string' ? { name: t } : t),
                    })));
                    setTimeout(scrollToBottom, 150);
                }
            } catch {
                // Conversation may have been deleted — start fresh
                setConversationId(null);
            }
        })();
    }, [conversationId, open, restored]);

    // Copy/download state
    const [copiedId, setCopiedId] = useState<string | null>(null);

    // Feature toggles
    const [showEmoji, setShowEmoji] = useState(false);
    const [sensitive, setSensitive] = useState(false);
    const [listening, setListening] = useState(false);
    const [inputFocused, setInputFocused] = useState(false);

    // Auto-grow the textarea as the user types, capped at maxHeight in CSS.
    useEffect(() => {
        const ta = inputRef.current;
        if (!ta) return;
        ta.style.height = 'auto';
        ta.style.height = Math.min(ta.scrollHeight, 140) + 'px';
    }, [input]);
    const [ttsEnabled, setTtsEnabled] = useState(false);

    // Live presentation state
    const [presentationData, setPresentationData] = useState<PresentationData | null>(null);
    const [presentationOpen, setPresentationOpen] = useState(false);

    const scrollRef = useRef<HTMLDivElement>(null);
    const inputRef  = useRef<HTMLTextAreaElement>(null);
    const fileRef   = useRef<HTMLInputElement>(null);
    const recognitionRef = useRef<any>(null);

    // ── Auto-scroll to bottom ──
    const scrollToBottom = useCallback(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, []);

    // Scroll on new messages / loading state changes
    useEffect(() => { scrollToBottom(); }, [messages, loading, activeTools, scrollToBottom]);

    // Scroll when panel opens (with delay so DOM renders first)
    useEffect(() => {
        if (open) {
            setTimeout(scrollToBottom, 100);
            setTimeout(scrollToBottom, 400); // second pass after messages load from DB
            setTimeout(() => inputRef.current?.focus(), 300);
        }
    }, [open, scrollToBottom]);

    // ── Load conversation list when panel opens ──
    const loadConversations = useCallback(async () => {
        try {
            const { data } = await axios.get('/ai-agent/conversations');
            setConversations(data.conversations ?? []);
        } catch {}
    }, []);

    useEffect(() => {
        if (open) loadConversations();
    }, [open, loadConversations]);

    // ── Load a specific conversation's messages ──
    const loadConversation = async (id: number) => {
        setHistoryLoading(true);
        try {
            const { data } = await axios.get(`/ai-agent/conversations/${id}/messages`);
            setConversationId(data.conversation_id);
            setMessages((data.messages ?? []).map((m: any) => ({
                ...m,
                timestamp: new Date(m.timestamp),
                toolCalls: m.toolCalls?.map((t: any) => typeof t === 'string' ? { name: t } : t),
            })));
            setShowHistory(false);
            setRestored(true);
            setTimeout(scrollToBottom, 150);
            setTimeout(() => inputRef.current?.focus(), 200);
        } catch {} finally {
            setHistoryLoading(false);
        }
    };

    // ── Delete a conversation ──
    const deleteConversation = async (id: number) => {
        try {
            await axios.delete(`/ai-agent/conversations/${id}`);
            setConversations(prev => prev.filter(c => c.id !== id));
            if (conversationId === id) {
                setConversationId(null);
                setMessages([]);
            }
        } catch {}
    };

    // ── Pin/unpin a conversation ──
    const togglePin = async (id: number) => {
        try {
            const { data } = await axios.post(`/ai-agent/conversations/${id}/pin`);
            setConversations(prev => prev.map(c =>
                c.id === id ? { ...c, pinned: data.pinned } : c
            ).sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0)));
        } catch {}
    };

    // ── Keyboard shortcut: Ctrl+Shift+A to open ──
    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            if (e.ctrlKey && e.shiftKey && e.key === 'A') {
                e.preventDefault();
                setOpen(prev => !prev);
            }
        };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, []);

    // ── Language detection helpers ──
    const detectLang = useCallback((text: string): string => {
        // Simple heuristic: check for script ranges
        if (/[\u0980-\u09FF]/.test(text)) return 'bn';    // Bengali
        if (/[\u0900-\u097F]/.test(text)) return 'hi';    // Hindi
        if (/[\u0600-\u06FF]/.test(text)) return 'ar';    // Arabic
        if (/[\u4E00-\u9FFF]/.test(text)) return 'zh';    // Chinese
        if (/[\u3040-\u309F\u30A0-\u30FF]/.test(text)) return 'ja'; // Japanese
        if (/[\uAC00-\uD7AF]/.test(text)) return 'ko';    // Korean
        if (/[\u0E00-\u0E7F]/.test(text)) return 'th';    // Thai
        return 'en';
    }, []);

    const [detectedLang, setDetectedLang] = useState('en');

    // ── Speech recognition setup (auto-detect browser language) ──
    useEffect(() => {
        const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
        if (!SR) return;
        const recognition = new SR();
        recognition.continuous = false;
        recognition.interimResults = true;
        // Use the browser's language or the last detected language
        recognition.lang = navigator.language || 'en-US';
        recognition.onresult = (e: any) => {
            const transcript = Array.from(e.results as SpeechRecognitionResultList)
                .map((r: any) => r[0].transcript)
                .join('');
            setInput(transcript);
            // Auto-detect the language from the spoken text
            const lang = detectLang(transcript);
            setDetectedLang(lang);
            // Update recognition language for next session
            recognition.lang = lang === 'bn' ? 'bn-BD'
                : lang === 'hi' ? 'hi-IN'
                : lang === 'ar' ? 'ar-SA'
                : lang === 'zh' ? 'zh-CN'
                : lang === 'ja' ? 'ja-JP'
                : lang === 'ko' ? 'ko-KR'
                : lang === 'th' ? 'th-TH'
                : navigator.language || 'en-US';
        };
        recognition.onend = () => setListening(false);
        recognition.onerror = () => setListening(false);
        recognitionRef.current = recognition;
    }, [detectLang]);

    // ── TTS (auto-selects voice matching detected language) ──
    const speak = useCallback((text: string) => {
        if (!ttsEnabled || !window.speechSynthesis) return;
        window.speechSynthesis.cancel();
        // Strip markdown
        const clean = text.replace(/\*\*(.+?)\*\*/g, '$1').replace(/[#*`\-|]/g, '').replace(/\n+/g, '. ');
        const utter = new SpeechSynthesisUtterance(clean);

        // Detect response language and pick matching voice
        const lang = detectLang(text);
        const langMap: Record<string, string> = {
            bn: 'bn-BD', hi: 'hi-IN', ar: 'ar-SA', zh: 'zh-CN',
            ja: 'ja-JP', ko: 'ko-KR', th: 'th-TH', en: 'en-US',
        };
        const bcp47 = langMap[lang] || 'en-US';
        utter.lang = bcp47;

        // Try to find a voice that matches the language
        const voices = window.speechSynthesis.getVoices();
        const matchedVoice = voices.find(v => v.lang.startsWith(lang))
            || voices.find(v => v.lang.startsWith(bcp47.split('-')[0]))
            || voices.find(v => v.default);
        if (matchedVoice) utter.voice = matchedVoice;

        utter.rate = lang === 'en' ? 1.05 : 1.0;
        utter.pitch = 1;
        window.speechSynthesis.speak(utter);
    }, [ttsEnabled, detectLang]);

    // ── Update speech recognition language when user types ──
    useEffect(() => {
        if (!input || !recognitionRef.current) return;
        const lang = detectLang(input);
        if (lang !== detectedLang) {
            setDetectedLang(lang);
            const langMap: Record<string, string> = {
                bn: 'bn-BD', hi: 'hi-IN', ar: 'ar-SA', zh: 'zh-CN',
                ja: 'ja-JP', ko: 'ko-KR', th: 'th-TH', en: navigator.language || 'en-US',
            };
            recognitionRef.current.lang = langMap[lang] || navigator.language || 'en-US';
        }
    }, [input, detectedLang, detectLang]);

    // ── Typing animation: reveal text word-by-word ──
    const typewriterRef = useRef<number>(0);

    const animateTyping = useCallback((aiId: string, fullText: string, toolCalls: any[], onDone: () => void) => {
        // Split into small chunks (1-3 words each) preserving whitespace
        const chunks = fullText.match(/.{1,12}(?:\s|$)/g) || [fullText];
        let index = 0;
        let revealed = '';

        // Show tool calls badge immediately
        if (toolCalls.length > 0) {
            setActiveTools(toolCalls.map((t: any) => t.display_name || t.name));
        }

        const tick = () => {
            if (index >= chunks.length) {
                // Done — finalize
                setMessages(prev => prev.map(m =>
                    m.id === aiId
                        ? { ...m, content: fullText, toolCalls: toolCalls.length > 0 ? toolCalls : undefined, isStreaming: false }
                        : m
                ));
                setActiveTools([]);
                onDone();
                return;
            }

            revealed += chunks[index];
            index++;

            setMessages(prev => prev.map(m =>
                m.id === aiId ? { ...m, content: revealed, isStreaming: true } : m
            ));

            // Natural typing speed: 15-35ms per chunk, slower for short responses
            const delay = fullText.length > 300 ? 15 : fullText.length > 100 ? 25 : 35;
            typewriterRef.current = window.setTimeout(tick, delay + Math.random() * 15);
        };

        // Start after a brief pause (feels like "thinking → typing")
        typewriterRef.current = window.setTimeout(tick, 200);
    }, []);

    // Cleanup typewriter on unmount
    useEffect(() => () => clearTimeout(typewriterRef.current), []);

    // ── Send message ──
    const sendMessage = async (text?: string) => {
        const msg = (text || input).trim();
        if (!msg || loading) return;

        const msgLang = detectLang(msg);
        setDetectedLang(msgLang);

        // Capture any pending image before clearing state
        const imageToSend = pendingImage;
        const imagePreview = pendingImagePreview;

        setMessages(prev => [...prev, {
            id: `u-${Date.now()}`, role: 'user', content: msg, timestamp: new Date(),
            attachment: imageToSend ? { name: imageToSend.name, type: imageToSend.type, url: imagePreview ?? '' } : undefined,
        }]);
        setInput('');
        setLoading(true);
        setShowEmoji(false);
        clearPendingImage();

        const aiId = `a-${Date.now()}`;
        setMessages(prev => [...prev, {
            id: aiId, role: 'assistant', content: '', timestamp: new Date(), isStreaming: true,
        }]);

        try {
            // Use FormData if there's an image, otherwise plain JSON
            let postData: any;
            const headers: any = {};
            if (imageToSend) {
                postData = new FormData();
                postData.append('message', msg);
                if (conversationId) postData.append('conversation_id', String(conversationId));
                postData.append('image', imageToSend);
                headers['Content-Type'] = 'multipart/form-data';
            } else {
                postData = { message: msg, conversation_id: conversationId };
            }
            const { data } = await axios.post('/ai-agent/chat', postData, { headers });

            if (data.conversation_id) setConversationId(data.conversation_id);
            const toolCalls = data.tool_calls ?? [];
            const fullText = data.response ?? '';

            // Check for live presentation tool call
            const presCall = toolCalls.find((t: any) => t.name === 'live_presentation' && t.presentation_url);
            const presUrl = presCall?.presentation_url ?? null;

            // Animate the response typing in word-by-word
            animateTyping(aiId, fullText, toolCalls, () => {
                // Auto-navigate if navigator tool was used
                const navCall = toolCalls.find((t: any) => t.name === 'navigator' && t.navigate_url);
                if (navCall) {
                    setTimeout(() => {
                        setOpen(false);
                        setFullscreen(false);
                        router.visit(navCall.navigate_url);
                    }, 600);
                }

                // Attach presentation URL to the message
                if (presUrl) {
                    setMessages(prev => prev.map(m =>
                        m.id === aiId ? { ...m, presentationUrl: presUrl } : m
                    ));
                }

                if (ttsEnabled && fullText) speak(fullText);
                if (!open) setUnread(prev => prev + 1);
                loadConversations();
            });

        } catch (err: any) {
            setMessages(prev => prev.map(m =>
                m.id === aiId
                    ? { ...m, content: err.response?.status === 419
                        ? 'Session expired. Please refresh the page.'
                        : 'Sorry, something went wrong. Please try again.', isStreaming: false }
                    : m
            ));
        } finally {
            setLoading(false);
            setTimeout(() => inputRef.current?.focus(), 100);
        }
    };

    // ── Option / quick-reply click ──
    const handleOption = (opt: ChatOption) => sendMessage(opt.value);

    // ── Checkbox toggle ──
    const toggleCheckbox = (msgId: string, cbValue: string) => {
        setMessages(prev => prev.map(m =>
            m.id === msgId && m.checkboxes
                ? { ...m, checkboxes: m.checkboxes.map(cb => cb.value === cbValue ? { ...cb, checked: !cb.checked } : cb) }
                : m
        ));
    };

    // ── File attachment ──
    // ── Pending image for next send ──
    const [pendingImage, setPendingImage] = useState<File | null>(null);
    const [pendingImagePreview, setPendingImagePreview] = useState<string | null>(null);

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const isProcessable = file.type.startsWith('image/') || file.type === 'application/pdf';
        const url = URL.createObjectURL(file);

        if (isProcessable) {
            // Stage the file — it will be sent with the next message for AI processing
            setPendingImage(file);
            setPendingImagePreview(file.type.startsWith('image/') ? url : null);
            setInput(prev => prev || (file.type === 'application/pdf' ? 'Process this PDF document' : 'Process this RFQ document'));
            setTimeout(() => inputRef.current?.focus(), 100);
        } else {
            // Non-processable: send as text mention
            const msg: Message = {
                id: `u-${Date.now()}`, role: 'user', content: `📎 Attached: ${file.name}`, timestamp: new Date(),
                attachment: { name: file.name, type: file.type, url },
            };
            setMessages(prev => [...prev, msg]);
            sendMessage(`I've attached a file: ${file.name} (${file.type}). Please acknowledge it.`);
        }
        e.target.value = '';
    };

    const clearPendingImage = () => {
        setPendingImage(null);
        setPendingImagePreview(null);
    };

    // ── Voice toggle ──
    const toggleVoice = () => {
        if (!recognitionRef.current) return;
        if (listening) {
            recognitionRef.current.stop();
            setListening(false);
        } else {
            recognitionRef.current.start();
            setListening(true);
        }
    };

    // ── New conversation (keeps old ones in history) ──
    const resetChat = async () => {
        setConversationId(null);
        setMessages([]);
        setActiveTools([]);
        setShowHistory(false);
        setRestored(false);
        window.speechSynthesis?.cancel();
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    };

    const handleOpen = () => {
        setOpen(true);
        setUnread(0);
    };

    const panelSize = fullscreen
        ? 'fixed inset-0 z-50 rounded-none'
        : 'fixed bottom-4 lg:bottom-6 right-4 lg:right-6 z-50 w-[calc(100vw-2rem)] sm:w-[420px] h-[calc(100dvh-7rem)] sm:h-[600px] max-h-[85dvh] rounded-2xl';

    // In fullscreen: force-open the history sidebar
    useEffect(() => {
        if (fullscreen && !showHistory) setShowHistory(true);
    }, [fullscreen]);

    if (!botEnabled) return null;

    return (
        <>
            {/* ─── FAB ──────────────────────────────────────────── */}
            <AnimatePresence>
                {!open && (
                    <motion.button
                        initial={{ scale: 0, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ scale: 0, opacity: 0 }}
                        transition={{ type: 'spring', stiffness: 260, damping: 18 }}
                        onClick={handleOpen}
                        className={`fixed bottom-20 lg:bottom-6 z-50 ${fabLeft ? 'left-4 lg:left-6' : 'right-4 lg:right-6'}
                                   w-14 h-14 rounded-2xl text-white
                                   flex items-center justify-center
                                   hover:-translate-y-0.5 active:scale-95 transition-all duration-200`}
                        style={{ background: primaryColor, boxShadow: `0 8px 30px -4px ${primaryColor}99` }}
                        title={`${botName} - ${botSubtitle} (Ctrl+Shift+A)`}
                    >
                        <motion.span
                            animate={{ rotate: [0, -10, 10, 0] }}
                            transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut', repeatDelay: 4 }}
                        >
                            <Sparkles className="w-6 h-6" />
                        </motion.span>
                        <span className="absolute inset-0 rounded-2xl animate-ping bg-brand-500 opacity-20" style={{ animationDuration: '3s' }} />
                        {/* Unread badge */}
                        {unread > 0 && (
                            <span className="absolute -top-1 -right-1 min-w-5 h-5 flex items-center justify-center px-1 rounded-full bg-red-500 text-white text-[10px] font-bold border-2 border-white">
                                {unread}
                            </span>
                        )}
                    </motion.button>
                )}
            </AnimatePresence>

            {/* ─── Chat Panel ───────────────────────────────────── */}
            <AnimatePresence>
                {open && (
                    <motion.div
                        initial={{ opacity: 0, y: fullscreen ? 0 : 20, scale: fullscreen ? 1 : 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: fullscreen ? 0 : 20, scale: fullscreen ? 1 : 0.95 }}
                        transition={{ type: 'spring', stiffness: 300, damping: 24 }}
                        className={`${panelSize} ${fullscreen ? 'bg-surface-50' : 'bg-white border border-surface-200 shadow-[0_25px_60px_-10px_rgba(0,0,0,0.3)]'} flex overflow-hidden`}
                    >
                        {/* ── Fullscreen: Left sidebar ── */}
                        {fullscreen && (
                            <div className="w-[280px] bg-surface-900 flex flex-col shrink-0">
                                {/* Sidebar header */}
                                <div className="p-4 flex items-center justify-between">
                                    <div className="flex items-center gap-2.5">
                                        <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: primaryColor }}>
                                            <BotIcon className="w-4 h-4" />
                                        </div>
                                        <div>
                                            <h2 className="text-sm font-bold text-white leading-none">Oli</h2>
                                            <p className="text-[10px] text-surface-400 mt-0.5">{botSubtitle}</p>
                                        </div>
                                    </div>
                                    <button onClick={resetChat} title="New chat"
                                        className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors">
                                        <RotateCcw className="w-3.5 h-3.5" />
                                    </button>
                                </div>

                                {/* Conversation list */}
                                <div className="flex-1 overflow-y-auto px-2 pb-3 space-y-0.5">
                                    {conversations.map(c => (
                                        <button key={c.id} onClick={() => loadConversation(c.id)}
                                            className={`w-full text-left px-3 py-2.5 rounded-lg text-xs transition-colors group ${
                                                conversationId === c.id
                                                    ? 'bg-white/15 text-white'
                                                    : 'text-surface-400 hover:bg-white/10 hover:text-white'
                                            }`}>
                                            <div className="flex items-center gap-2">
                                                {c.pinned && <span className="text-[10px]">📌</span>}
                                                <span className="font-medium truncate flex-1">{c.title}</span>
                                                <button onClick={(e) => { e.stopPropagation(); deleteConversation(c.id); }}
                                                    className="hidden group-hover:block p-0.5 rounded text-surface-500 hover:text-red-400">
                                                    <X className="w-3 h-3" />
                                                </button>
                                            </div>
                                            <div className="text-[10px] text-surface-500 mt-0.5">{c.updated_at}</div>
                                        </button>
                                    ))}
                                    {conversations.length === 0 && (
                                        <div className="text-center py-8 text-surface-500 text-xs">No conversations yet</div>
                                    )}
                                </div>

                                {/* Sidebar footer */}
                                <div className="p-3 border-t border-white/10 flex items-center gap-2">
                                    <button onClick={() => { setTtsEnabled(!ttsEnabled); window.speechSynthesis?.cancel(); }}
                                        className={`flex-1 py-2 rounded-lg text-[10px] font-semibold uppercase tracking-wider transition-colors ${ttsEnabled ? 'bg-white/20 text-white' : 'text-surface-500 hover:bg-white/10 hover:text-white'}`}>
                                        {ttsEnabled ? '🔊 Voice On' : '🔇 Voice Off'}
                                    </button>
                                    <button onClick={() => { setFullscreen(false); }}
                                        className="py-2 px-3 rounded-lg text-surface-500 hover:bg-white/10 hover:text-white text-[10px] font-semibold uppercase tracking-wider transition-colors">
                                        <Minimize2 className="w-3.5 h-3.5" />
                                    </button>
                                    <button onClick={() => { setOpen(false); setFullscreen(false); }}
                                        className="py-2 px-3 rounded-lg text-surface-500 hover:bg-white/10 hover:text-white text-[10px] font-semibold uppercase tracking-wider transition-colors">
                                        <X className="w-3.5 h-3.5" />
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* ── Main chat column ── */}
                        <div className="flex-1 flex flex-col min-w-0">

                        {/* ── Header (mini mode only) ── */}
                        {!fullscreen && (
                        <div className="shrink-0 px-4 py-3 flex items-center justify-between" style={{ background: primaryColor }}>
                            <div className="flex items-center gap-3">
                                <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center">
                                    <BotIcon />
                                </div>
                                <div>
                                    <h3 className="text-sm font-bold text-white leading-none">Oli</h3>
                                    <p className="text-[10px] text-white/60 mt-0.5">
                                        {loading ? 'Thinking...' : botSubtitle}
                                    </p>
                                </div>
                            </div>
                            <div className="flex items-center gap-0.5">
                                <button onClick={() => { setShowHistory(!showHistory); if (!showHistory) loadConversations(); }}
                                    title="Chat history"
                                    className={`p-1.5 rounded-lg transition-colors ${showHistory ? 'bg-white/25 text-white' : 'text-white/50 hover:text-white hover:bg-white/15'}`}>
                                    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M12 8v4l3 3" /><circle cx="12" cy="12" r="10" />
                                    </svg>
                                </button>
                                <button onClick={() => { setTtsEnabled(!ttsEnabled); window.speechSynthesis?.cancel(); }}
                                    title={ttsEnabled ? 'Disable voice' : 'Enable voice'}
                                    className={`p-1.5 rounded-lg transition-colors ${ttsEnabled ? 'bg-white/25 text-white' : 'text-white/50 hover:text-white hover:bg-white/15'}`}>
                                    {ttsEnabled ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
                                </button>
                                <button onClick={() => setFullscreen(!fullscreen)}
                                    title="Fullscreen"
                                    className="p-1.5 rounded-lg text-white/50 hover:text-white hover:bg-white/15 transition-colors">
                                    <Maximize2 className="w-3.5 h-3.5" />
                                </button>
                                {messages.length > 0 && (
                                <button title="Download conversation"
                                    onClick={() => {
                                        const text = messages.map(m => {
                                            const name = m.role === 'user' ? userName : botName;
                                            const time = (m.timestamp instanceof Date ? m.timestamp : new Date(m.timestamp)).toLocaleString();
                                            return `[${time}] ${name}:\n${m.content}\n`;
                                        }).join('\n---\n\n');
                                        const blob = new Blob([text], { type: 'text/plain' });
                                        const a = document.createElement('a');
                                        a.href = URL.createObjectURL(blob);
                                        a.download = `conversation-${new Date().toISOString().slice(0,10)}.txt`;
                                        a.click();
                                    }}
                                    className="p-1.5 rounded-lg text-white/50 hover:text-white hover:bg-white/15 transition-colors">
                                    <i className="fi fi-rr-download text-sm leading-none" />
                                </button>
                                )}
                                <button onClick={resetChat} title="New conversation"
                                    className="p-1.5 rounded-lg text-white/50 hover:text-white hover:bg-white/15 transition-colors">
                                    <RotateCcw className="w-3.5 h-3.5" />
                                </button>
                                <button onClick={() => { setOpen(false); setFullscreen(false); }} title="Close"
                                    className="p-1.5 rounded-lg text-white/50 hover:text-white hover:bg-white/15 transition-colors">
                                    <X className="w-3.5 h-3.5" />
                                </button>
                            </div>
                        </div>
                        )}

                        {/* ── Conversation history drawer (mini mode only) ── */}
                        {!fullscreen && (
                        <AnimatePresence>
                            {showHistory && (
                                <motion.div
                                    initial={{ height: 0, opacity: 0 }}
                                    animate={{ height: 'auto', opacity: 1 }}
                                    exit={{ height: 0, opacity: 0 }}
                                    transition={{ duration: 0.25 }}
                                    className="shrink-0 border-b border-surface-100 bg-surface-50/80 overflow-hidden"
                                >
                                    <div className="p-3 max-h-52 overflow-y-auto space-y-1">
                                        <div className="flex items-center justify-between mb-2">
                                            <span className="text-[10px] font-bold uppercase tracking-wider text-surface-400">Chat History</span>
                                            <button onClick={() => setShowHistory(false)} className="text-surface-400 hover:text-surface-600">
                                                <X className="w-3.5 h-3.5" />
                                            </button>
                                        </div>
                                        {conversations.length === 0 && (
                                            <p className="text-xs text-surface-400 text-center py-3">No previous conversations</p>
                                        )}
                                        {conversations.map(c => (
                                            <div key={c.id}
                                                className={`group flex items-center gap-2 px-2.5 py-2 rounded-lg cursor-pointer transition-all text-xs
                                                    ${conversationId === c.id
                                                        ? 'bg-brand-50 border border-brand-200 text-brand-700'
                                                        : 'hover:bg-surface-100 text-surface-700'}`}
                                            >
                                                <button onClick={() => loadConversation(c.id)} className="flex-1 min-w-0 text-left">
                                                    <div className="flex items-center gap-1.5">
                                                        {c.pinned && <span className="text-amber-500 text-[10px]">📌</span>}
                                                        <span className="font-medium truncate">{c.title}</span>
                                                    </div>
                                                    <div className="text-[10px] text-surface-400 mt-0.5">{c.updated_at}</div>
                                                </button>
                                                <div className="hidden group-hover:flex items-center gap-0.5 shrink-0">
                                                    <button onClick={() => togglePin(c.id)} title={c.pinned ? 'Unpin' : 'Pin'}
                                                        className="p-1 rounded text-surface-400 hover:text-amber-500 hover:bg-amber-50">
                                                        <span className="text-[10px]">{c.pinned ? '📌' : '📍'}</span>
                                                    </button>
                                                    <button onClick={() => deleteConversation(c.id)} title="Delete"
                                                        className="p-1 rounded text-surface-400 hover:text-red-500 hover:bg-red-50">
                                                        <X className="w-3 h-3" />
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>
                        )}

                        {/* ── Messages area ── */}
                        <div ref={scrollRef} className={`flex-1 overflow-y-auto p-4 ${fullscreen ? 'bg-white' : ''}`}>
                        <div className={`space-y-3 ${fullscreen ? 'max-w-3xl mx-auto w-full' : ''}`}>
                            {/* Welcome */}
                            {messages.length === 0 && !loading && (
                                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="text-center py-6">
                                    <div className="w-14 h-14 mx-auto rounded-2xl bg-gradient-to-br from-brand-100 to-brand-200 flex items-center justify-center mb-3">
                                        <Sparkles className="w-7 h-7 text-brand-600" />
                                    </div>
                                    <h4 className="font-bold text-surface-900 text-sm">{botWelcome}</h4>
                                    <p className="text-xs text-surface-500 mt-1 max-w-[260px] mx-auto leading-relaxed">
                                        {botWelcomeSub}
                                    </p>
                                </motion.div>
                            )}

                            {/* Suggestion chips */}
                            {messages.length === 0 && (
                                <div className="space-y-1.5">
                                    {SUGGESTIONS.map((s, i) => (
                                        <motion.button
                                            key={i}
                                            initial={{ opacity: 0, x: -10 }}
                                            animate={{ opacity: 1, x: 0 }}
                                            transition={{ delay: 0.1 + i * 0.06 }}
                                            onClick={() => sendMessage(s.text)}
                                            className="w-full text-left px-3 py-2 rounded-xl text-xs text-surface-700
                                                       bg-surface-50 border border-surface-100
                                                       hover:bg-brand-50 hover:border-brand-200 hover:text-brand-700
                                                       transition-all flex items-center gap-2.5 active:scale-[0.98]"
                                        >
                                            <span className="text-sm">{s.icon}</span>
                                            {s.text}
                                        </motion.button>
                                    ))}
                                </div>
                            )}

                            {/* Message bubbles */}
                            {messages.map((msg, idx) => {
                                const isUser = msg.role === 'user';
                                const senderName = isUser ? userName : botName;
                                const ts = msg.timestamp instanceof Date ? msg.timestamp : new Date(msg.timestamp);
                                const timeStr = ts.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                                const dateStr = ts.toLocaleDateString([], { day: '2-digit', month: 'short' });

                                // Show date separator if different day from previous message
                                const prevTs = idx > 0
                                    ? (messages[idx - 1].timestamp instanceof Date ? messages[idx - 1].timestamp : new Date(messages[idx - 1].timestamp))
                                    : null;
                                const showDateSep = !prevTs || ts.toDateString() !== prevTs.toDateString();

                                return (
                                    <div key={msg.id}>
                                        {/* Date separator */}
                                        {showDateSep && (
                                            <div className="flex items-center gap-3 my-3">
                                                <div className="flex-1 h-px bg-surface-200" />
                                                <span className="text-[9px] font-bold uppercase tracking-wider text-surface-400">
                                                    {ts.toLocaleDateString([], { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}
                                                </span>
                                                <div className="flex-1 h-px bg-surface-200" />
                                            </div>
                                        )}

                                        <motion.div
                                            initial={{ opacity: 0, y: 8 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            transition={{ duration: 0.2 }}
                                            className={`flex gap-2 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}
                                        >
                                            {/* Avatar */}
                                            {showAvatar && (
                                            <div className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5 text-white"
                                                style={{ background: isUser ? primaryColor : '#334155' }}>
                                                {isUser ? userName.charAt(0).toUpperCase() : '✦'}
                                            </div>
                                            )}

                                            <div className="max-w-[82%] min-w-0">
                                                {/* Sender name */}
                                                <div className={`mb-1 ${isUser ? 'text-right' : ''}`}>
                                                    <span className={`text-xs font-bold ${isUser ? 'text-surface-600' : 'text-brand-600'}`}>
                                                        {senderName}
                                                    </span>
                                                </div>

                                                {/* Bubble */}
                                                <div className={`group relative rounded-2xl px-3.5 py-2.5 pb-5 ${
                                                    isUser
                                                        ? bubbleUser === 'brand' ? 'text-white rounded-tr-md' :
                                                          bubbleUser === 'dark' ? 'bg-surface-800 border border-surface-700 text-white rounded-tr-md' :
                                                          'bg-brand-50 border border-brand-200 text-surface-800 rounded-tr-md'
                                                        : msg.role === 'system'
                                                            ? 'bg-blue-50 border border-blue-200 text-blue-800 rounded-tl-md text-xs'
                                                            : bubbleBotStyle === 'dark'
                                                                ? 'bg-surface-800 border border-surface-700 text-white rounded-tl-md'
                                                                : 'bg-surface-50 border border-surface-100 text-surface-800 rounded-tl-md'
                                                }`} style={isUser && bubbleUser === 'brand' ? { background: primaryColor } : undefined}>
                                                    {/* Content */}
                                                    {msg.role === 'assistant' && msg.isStreaming && !msg.content ? (
                                                        <TypingDots />
                                                    ) : msg.role === 'assistant' ? (
                                                        <MarkdownLite text={msg.content} onQuickReply={(text) => sendMessage(text)} />
                                                    ) : (
                                                        <p className="text-[13px] leading-relaxed">{msg.content}</p>
                                                    )}

                                                    {/* File attachment preview */}
                                                    {msg.attachment && (
                                                        <div className="mt-2 pt-2 border-t border-brand-200/50">
                                                            <div className="flex items-center gap-2 text-[11px]">
                                                                <Paperclip className="w-3 h-3 shrink-0" />
                                                                <span className="truncate">{msg.attachment.name}</span>
                                                            </div>
                                                            {msg.attachment.type.startsWith('image/') && (
                                                                <img src={msg.attachment.url} alt="" className="mt-1.5 rounded-lg max-h-32 w-auto" />
                                                            )}
                                                        </div>
                                                    )}

                                                    {/* Tool calls badge */}
                                                    {msg.toolCalls && msg.toolCalls.length > 0 && (
                                                        <div className="mt-2 pt-2 border-t border-surface-200/60">
                                                            <div className="flex items-center gap-1 text-[10px] text-surface-400 font-semibold">
                                                                <Zap className="w-3 h-3 text-brand-400" />
                                                                {msg.toolCalls.map((t: any) => t.display_name || t.name.replace(/_/g, ' ')).join(' → ')}
                                                            </div>
                                                        </div>
                                                    )}

                                                    {/* Live Presentation launch button */}
                                                    {msg.presentationUrl && (
                                                        <PresentationLaunchButton onClick={async () => {
                                                            try {
                                                                const { data: presData } = await axios.get(msg.presentationUrl!, { responseType: 'json' });
                                                                setPresentationData(presData);
                                                                setPresentationOpen(true);
                                                            } catch {
                                                                alert('Failed to load presentation data.');
                                                            }
                                                        }} />
                                                    )}

                                                    {/* Quick-reply options */}
                                                    {msg.options && msg.options.length > 0 && (
                                                        <div className="mt-2 pt-2 border-t border-surface-200/60 flex flex-wrap gap-1.5">
                                                            {msg.options.map(opt => (
                                                                <button key={opt.value} onClick={() => handleOption(opt)}
                                                                    className="px-2.5 py-1 rounded-lg text-[11px] font-semibold
                                                                               bg-brand-50 text-brand-700 border border-brand-200
                                                                               hover:bg-brand-100 transition-colors">
                                                                    {opt.label}
                                                                </button>
                                                            ))}
                                                        </div>
                                                    )}

                                                    {/* Checkboxes */}
                                                    {msg.checkboxes && msg.checkboxes.length > 0 && (
                                                        <div className="mt-2 pt-2 border-t border-surface-200/60 space-y-1">
                                                            {msg.checkboxes.map(cb => (
                                                                <button key={cb.value}
                                                                    onClick={() => toggleCheckbox(msg.id, cb.value)}
                                                                    className="flex items-center gap-2 text-[11px] w-full text-left hover:bg-surface-50 px-1 py-0.5 rounded">
                                                                    {cb.checked
                                                                        ? <CheckSquare className="w-3.5 h-3.5 text-brand-500 shrink-0" />
                                                                        : <Square className="w-3.5 h-3.5 text-surface-400 shrink-0" />}
                                                                    <span className={cb.checked ? 'text-surface-800 font-medium' : 'text-surface-600'}>{cb.label}</span>
                                                                </button>
                                                            ))}
                                                        </div>
                                                    )}

                                                    {/* Action bar — copy / download (shows on hover) */}
                                                    {msg.content && !msg.isStreaming && (
                                                        <div className={`flex items-center gap-0.5 mt-2 -mb-1 opacity-0 group-hover:opacity-100 transition-opacity ${isUser ? 'justify-end' : 'justify-start'}`}>
                                                            <button type="button" title="Copy text"
                                                                onClick={() => { navigator.clipboard.writeText(msg.content); setCopiedId(msg.id); setTimeout(() => setCopiedId(null), 1500); }}
                                                                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-medium text-surface-400 hover:text-surface-600 hover:bg-surface-100 transition-colors">
                                                                {copiedId === msg.id ? <><i className="fi fi-rr-check leading-none text-emerald-500" /> Copied</> : <><i className="fi fi-rr-copy leading-none" /> Copy</>}
                                                            </button>
                                                            {msg.role === 'assistant' && (
                                                                <button type="button" title="Download as text file"
                                                                    onClick={() => {
                                                                        const blob = new Blob([`${botName} — ${new Date(msg.timestamp).toLocaleString()}\n\n${msg.content}`], { type: 'text/plain' });
                                                                        const a = document.createElement('a');
                                                                        a.href = URL.createObjectURL(blob);
                                                                        a.download = `oli-response-${msg.id}.txt`;
                                                                        a.click();
                                                                    }}
                                                                    className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-medium text-surface-400 hover:text-surface-600 hover:bg-surface-100 transition-colors">
                                                                    <i className="fi fi-rr-download leading-none" /> Save
                                                                </button>
                                                            )}
                                                        </div>
                                                    )}

                                                    {/* Time — bottom right inside bubble */}
                                                    <span className="absolute bottom-1.5 right-3 text-[9px] text-surface-400">{timeStr}</span>
                                                </div>
                                            </div>
                                        </motion.div>
                                    </div>
                                );
                            })}

                            {/* Tool activity overlay */}
                            <AnimatePresence>
                                {activeTools.length > 0 && <ToolIndicator tools={activeTools} />}
                            </AnimatePresence>
                        </div>{/* closes inner max-w wrapper */}
                        </div>{/* closes scrollRef */}

                        {/* ── Scroll-to-bottom ── */}
                        {messages.length > 4 && (
                            <button
                                onClick={() => scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })}
                                className={`absolute ${fullscreen ? 'bottom-20 right-1/2 translate-x-1/2' : 'bottom-[68px] right-3'} w-7 h-7 rounded-full bg-white border border-surface-200 shadow-md
                                           flex items-center justify-center text-surface-400 hover:text-surface-600 transition-colors z-10`}
                            >
                                <ChevronDown className="w-4 h-4" />
                            </button>
                        )}

                        {/* ── Pending image preview bar ── */}
                        {pendingImage && (
                            <div className="shrink-0 px-3 py-2 border-t border-surface-100 bg-purple-50/50 flex items-center gap-3 animate-fade-in">
                                {pendingImagePreview ? (
                                    <img src={pendingImagePreview} alt="" className="w-12 h-12 rounded-lg object-cover border border-purple-200 shadow-sm" />
                                ) : (
                                    <div className="w-12 h-12 rounded-lg bg-red-50 border border-red-200 flex items-center justify-center shrink-0">
                                        <i className="fi fi-rr-file-pdf text-red-500 text-lg leading-none" />
                                    </div>
                                )}
                                <div className="flex-1 min-w-0">
                                    <div className="text-xs font-semibold text-purple-700">
                                        {pendingImage?.type === 'application/pdf' ? '📄 PDF ready to process' : '📷 Image ready to send'}
                                    </div>
                                    <div className="text-[10px] text-purple-500 truncate">{pendingImage?.name} · Type a message or press Enter to process</div>
                                </div>
                                <button type="button" onClick={clearPendingImage}
                                    className="p-1.5 rounded-lg text-purple-400 hover:text-purple-600 hover:bg-purple-100 transition-colors shrink-0">
                                    <i className="fi fi-rr-cross-small text-sm leading-none" />
                                </button>
                            </div>
                        )}

                        {/* ── Emoji picker ── */}
                        <AnimatePresence>
                            {showEmoji && (
                                <motion.div
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: 10 }}
                                    className="shrink-0 border-t border-surface-100 bg-surface-50 px-3 py-2"
                                >
                                    <div className={`flex flex-wrap gap-1 ${fullscreen ? 'max-w-3xl mx-auto' : ''}`}>
                                        {EMOJI_LIST.map(e => (
                                            <button key={e} onClick={() => { setInput(prev => prev + e); setShowEmoji(false); inputRef.current?.focus(); }}
                                                className="w-8 h-8 rounded-lg hover:bg-brand-50 flex items-center justify-center text-base transition-colors active:scale-90">
                                                {e}
                                            </button>
                                        ))}
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>

                        {/* ── Input area (modern composer) ── */}
                        <div className={`shrink-0 bg-white ${fullscreen ? 'px-4 py-4' : 'px-3 pb-3 pt-2'}`}>
                            <div className={`${fullscreen ? 'max-w-3xl mx-auto' : ''}`}>
                                <div
                                    className={`rounded-2xl border-2 bg-white transition-all ${
                                        inputFocused ? 'shadow-lg' : 'shadow-sm'
                                    }`}
                                    style={{
                                        borderColor: inputFocused ? primaryColor : '#e2e8f0',
                                    }}
                                >
                                    {/* Row 1: textarea */}
                                    <div className="px-4 pt-3">
                                        <textarea
                                            ref={inputRef as any}
                                            value={input}
                                            onChange={e => setInput(e.target.value)}
                                            onKeyDown={handleKeyDown}
                                            onFocus={() => setInputFocused(true)}
                                            onBlur={() => setInputFocused(false)}
                                            placeholder="Message..."
                                            rows={1}
                                            disabled={loading}
                                            className="w-full resize-none bg-transparent border-none outline-none focus:ring-0 text-sm text-surface-900 placeholder-surface-400 disabled:opacity-50 disabled:cursor-wait leading-relaxed"
                                            style={{ maxHeight: '140px', minHeight: '22px' }}
                                        />
                                    </div>

                                    {/* Row 2: toolbar */}
                                    <div className="flex items-center justify-between px-2 pb-2">
                                        <div className="flex items-center gap-0.5">
                                            {/* File attachment */}
                                            <button
                                                onClick={() => fileRef.current?.click()}
                                                title="Attach file"
                                                className="w-8 h-8 rounded-lg text-surface-400 hover:text-surface-700 hover:bg-surface-100 transition-colors flex items-center justify-center"
                                            >
                                                <Paperclip className="w-4 h-4" />
                                            </button>
                                            <input ref={fileRef} type="file" className="hidden" onChange={handleFileSelect} accept="image/*,.pdf,.csv,.xlsx,.doc,.docx" />

                                            {/* Emoji toggle */}
                                            <button
                                                onClick={() => setShowEmoji(!showEmoji)}
                                                title="Emoji"
                                                className={`w-8 h-8 rounded-lg transition-colors flex items-center justify-center ${
                                                    showEmoji
                                                        ? 'bg-brand-50 text-brand-600'
                                                        : 'text-surface-400 hover:text-surface-700 hover:bg-surface-100'
                                                }`}
                                            >
                                                <Smile className="w-4 h-4" />
                                            </button>

                                            {/* Voice input */}
                                            {recognitionRef.current && (
                                                <button
                                                    onClick={toggleVoice}
                                                    title={listening ? 'Stop listening' : 'Voice input'}
                                                    className={`w-8 h-8 rounded-lg transition-colors flex items-center justify-center ${
                                                        listening
                                                            ? 'bg-red-500 text-white animate-pulse'
                                                            : 'text-surface-400 hover:text-surface-700 hover:bg-surface-100'
                                                    }`}
                                                >
                                                    {listening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                                                </button>
                                            )}

                                            {/* Sensitive input toggle */}
                                            <button
                                                onClick={() => setSensitive(!sensitive)}
                                                title={sensitive ? 'Show input' : 'Mask input'}
                                                className={`w-8 h-8 rounded-lg transition-colors flex items-center justify-center ${
                                                    sensitive
                                                        ? 'bg-red-50 text-red-600'
                                                        : 'text-surface-400 hover:text-surface-700 hover:bg-surface-100'
                                                }`}
                                            >
                                                {sensitive ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                            </button>
                                        </div>

                                        {/* Send button */}
                                        <button
                                            onClick={() => sendMessage()}
                                            disabled={!input.trim() || loading}
                                            className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 disabled:cursor-not-allowed active:scale-95 transition-all"
                                            style={{
                                                background: input.trim() && !loading ? primaryColor : '#e2e8f0',
                                                color: input.trim() && !loading ? 'white' : '#94a3b8',
                                            }}
                                        >
                                            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowUp className="w-4 h-4" strokeWidth={2.5} />}
                                        </button>
                                    </div>
                                </div>
                                <p className="text-[9px] text-surface-400 text-center mt-2">
                                    {botFooter} · Ctrl+Shift+A to toggle
                                </p>
                            </div>
                        </div>

                        </div>{/* closes flex-1 main column */}
                    </motion.div>
                )}
            </AnimatePresence>

            {/* ── Live Presentation Viewer (fullscreen overlay) ── */}
            <AnimatePresence>
                {presentationOpen && presentationData && (
                    <PresentationViewer
                        data={presentationData}
                        conversationId={conversationId ? String(conversationId) : null}
                        onClose={() => {
                            setPresentationOpen(false);
                            setPresentationData(null);
                        }}
                    />
                )}
            </AnimatePresence>
        </>
    );
}
