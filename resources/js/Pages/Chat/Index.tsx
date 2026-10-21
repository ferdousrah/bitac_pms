import AppLayout from '@/Layouts/AppLayout';
import { Head, router } from '@inertiajs/react';
import { ChangeEvent, KeyboardEvent, ReactNode, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
    ArrowDown, ChevronLeft, ClipboardList, Factory, FileText, Globe2, Loader2, Lock, Megaphone, MessagesSquare,
    Package, Paperclip, PencilRuler, Pin, PinOff, Reply, SendHorizontal, ShieldCheck, Trash2, Users, X,
} from 'lucide-react';

/* ─── Types ─────────────────────────────────────────────────────────── */
interface Channel {
    key: string; name: string; name_bn: string | null; code: string | null; unread: number;
    last: { who: string | null; text: string; at: string | null } | null;
}
interface ChatFile { id: number; name: string; size: number; is_image: boolean; url: string }
interface Message {
    id: number; channel: string; body: string | null; deleted: boolean; is_instruction: boolean;
    created_at: string; mine: boolean;
    user: { id: number | null; name: string; designation: string | null; avatar_url: string | null; initials: string };
    reply_to: { id: number; name: string; excerpt: string | null } | null;
    files: ChatFile[]; can_delete: boolean; can_pin: boolean;
}
interface Member { id: number; name: string; designation: string | null; initials: string; avatar_url: string | null }
interface Props {
    channels: Channel[]; channel: string; messages: Message[]; hasMore: boolean; pinned: Message[];
    canInstruct: boolean; members: { count: number; list: Member[] }; serverTime: string;
}

const POLL_MS = 4000;
const axios = () => (window as any).axios;

/* ─── Small helpers ─────────────────────────────────────────────────── */
const byId = (list: Message[]) => [...new Map(list.map(m => [m.id, m])).values()].sort((a, b) => a.id - b.id);

const time = (iso: string) => new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });

function dayLabel(iso: string) {
    const d = new Date(iso); const today = new Date();
    const y = new Date(); y.setDate(today.getDate() - 1);
    if (d.toDateString() === today.toDateString()) return 'Today';
    if (d.toDateString() === y.toDateString()) return 'Yesterday';
    return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
}

function shortWhen(iso: string | null) {
    if (!iso) return '';
    const d = new Date(iso);
    return d.toDateString() === new Date().toDateString() ? time(iso) : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

const fileSize = (b: number) => b > 1048576 ? `${(b / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`;

/** Plain text with links made clickable — never HTML from the message. */
function Linkified({ text }: { text: string }) {
    const parts = text.split(/(https?:\/\/[^\s]+)/g);
    return <>{parts.map((p, i) => /^https?:\/\//.test(p)
        ? <a key={i} href={p} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 break-all">{p}</a>
        : <span key={i}>{p}</span>)}</>;
}

function channelIcon(c: { key: string; code: string | null }, cls = 'w-4 h-4') {
    if (c.key === 'common') return <Globe2 className={cls} />;
    switch ((c.code ?? '').toUpperCase()) {
        case 'IED': return <PencilRuler className={cls} />;
        case 'PCD': return <ClipboardList className={cls} />;
        case 'QC': return <ShieldCheck className={cls} />;
        case 'STORES': return <Package className={cls} />;
        default: return <Factory className={cls} />;
    }
}

function Avatar({ u, size = 'w-8 h-8 text-[11px]' }: { u: { avatar_url: string | null; initials: string; name: string }; size?: string }) {
    return u.avatar_url
        ? <img src={u.avatar_url} alt={u.name} className={`${size} rounded-full object-cover shrink-0`} />
        : <span className={`${size} rounded-full bg-brand-100 text-brand-700 font-bold grid place-items-center shrink-0`}>{u.initials || '?'}</span>;
}

/* ─── Page ──────────────────────────────────────────────────────────── */
export default function ChatIndex(props: Props) {
    const [channels, setChannels] = useState<Channel[]>(props.channels);
    const [messages, setMessages] = useState<Message[]>(props.messages);
    const [pinned, setPinned] = useState<Message[]>(props.pinned);
    const [hasMore, setHasMore] = useState(props.hasMore);
    const [loadingOlder, setLoadingOlder] = useState(false);
    const [showMembers, setShowMembers] = useState(false);
    const [showAllPinned, setShowAllPinned] = useState(false);
    const [mobileThread, setMobileThread] = useState(props.channel !== 'common' || new URLSearchParams(window.location.search).has('c'));
    const [newBelow, setNewBelow] = useState(0);
    const [flash, setFlash] = useState<number | null>(null);

    // Composer
    const [text, setText] = useState('');
    const [files, setFiles] = useState<File[]>([]);
    const [asInstruction, setAsInstruction] = useState(false);
    const [replyTo, setReplyTo] = useState<Message | null>(null);
    const [sending, setSending] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const scroller = useRef<HTMLDivElement>(null);
    const textarea = useRef<HTMLTextAreaElement>(null);
    const fileInput = useRef<HTMLInputElement>(null);
    const since = useRef(props.serverTime);
    const atBottom = useRef(true);
    const stickNext = useRef(true);
    const keepOffset = useRef<number | null>(null);

    const active = channels.find(c => c.key === props.channel) ?? channels[0];
    const lastId = messages.length ? messages[messages.length - 1].id : 0;

    /* Scrolling: stick to the bottom unless the reader has scrolled up. */
    useLayoutEffect(() => {
        const el = scroller.current; if (!el) return;
        if (keepOffset.current !== null) { el.scrollTop = el.scrollHeight - keepOffset.current; keepOffset.current = null; return; }
        if (stickNext.current) { el.scrollTop = el.scrollHeight; stickNext.current = false; }
    }, [messages]);

    const onScroll = () => {
        const el = scroller.current; if (!el) return;
        atBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
        if (atBottom.current) setNewBelow(0);
    };

    const toBottom = () => {
        const el = scroller.current; if (!el) return;
        el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' }); setNewBelow(0);
    };

    /* Polling — new messages, changes to old ones (removed / pinned), unread counts. */
    const lastIdRef = useRef(lastId);
    lastIdRef.current = lastId;
    const poll = useCallback(async () => {
        if (document.hidden) return;
        try {
            const { data } = await axios().get(`/chat/${props.channel}/poll`, { params: { after: lastIdRef.current, since: since.current } });
            since.current = data.serverTime;
            setChannels(data.channels);
            setPinned(data.pinned);
            if (data.messages.length || data.changed.length) {
                const incoming: Message[] = data.messages;
                if (incoming.length) {
                    if (atBottom.current) stickNext.current = true;
                    else setNewBelow(n => n + incoming.filter(m => !m.mine).length);
                }
                setMessages(prev => byId([...prev.map(m => data.changed.find((c: Message) => c.id === m.id) ?? m), ...incoming]));
            }
        } catch { /* a missed poll is retried on the next tick */ }
    }, [props.channel]);

    useEffect(() => {
        const t = window.setInterval(poll, POLL_MS);
        const onVisible = () => { if (!document.hidden) poll(); };
        document.addEventListener('visibilitychange', onVisible);
        return () => { window.clearInterval(t); document.removeEventListener('visibilitychange', onVisible); };
    }, [poll]);

    const loadOlder = async () => {
        if (!messages.length) return;
        setLoadingOlder(true);
        try {
            const { data } = await axios().get(`/chat/${props.channel}/older`, { params: { before: messages[0].id } });
            const el = scroller.current;
            keepOffset.current = el ? el.scrollHeight - el.scrollTop : null;
            setMessages(prev => byId([...data.messages, ...prev]));
            setHasMore(data.hasMore);
        } finally { setLoadingOlder(false); }
    };

    const open = (key: string) => {
        if (key === props.channel) { setMobileThread(true); return; }
        router.get('/chat', { c: key }, { preserveState: false });
    };

    /* Sending */
    const send = async () => {
        if (sending || (!text.trim() && !files.length)) return;
        setSending(true); setError(null);
        const fd = new FormData();
        fd.append('body', text);
        if (asInstruction) fd.append('is_instruction', '1');
        if (replyTo) fd.append('reply_to_id', String(replyTo.id));
        files.forEach(f => fd.append('files[]', f));
        try {
            const { data } = await axios().post(`/chat/${props.channel}/messages`, fd);
            stickNext.current = true;
            setMessages(prev => byId([...prev, data.message]));
            if (data.message.is_instruction) setPinned(p => [data.message, ...p]);
            setText(''); setFiles([]); setReplyTo(null); setAsInstruction(false);
            requestAnimationFrame(() => textarea.current?.focus());
        } catch (e: any) {
            const res = e?.response?.data;
            setError(res?.errors ? Object.values(res.errors).flat().join(' ') : (res?.message ?? 'Could not send. Check the connection and try again.'));
        } finally { setSending(false); }
    };

    const onKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); send(); }
    };

    const pickFiles = (e: ChangeEvent<HTMLInputElement>) => {
        const picked = Array.from(e.target.files ?? []);
        setFiles(f => [...f, ...picked].slice(0, 5));
        e.target.value = '';
    };

    const remove = async (m: Message) => {
        if (!confirm('Remove this message? Everyone in the chat will see “message removed”.')) return;
        try {
            await axios().delete(`/chat/messages/${m.id}`);
            setMessages(prev => prev.map(x => x.id === m.id ? { ...x, deleted: true, body: null, files: [], is_instruction: false, can_delete: false, can_pin: false } : x));
            setPinned(p => p.filter(x => x.id !== m.id));
        } catch (e: any) { alert(e?.response?.data?.message ?? 'Could not remove it.'); }
    };

    const togglePin = async (m: Message) => {
        try {
            const { data } = await axios().post(`/chat/messages/${m.id}/pin`);
            setMessages(prev => prev.map(x => x.id === m.id ? { ...x, is_instruction: data.is_instruction } : x));
            setPinned(p => data.is_instruction ? [{ ...m, is_instruction: true }, ...p.filter(x => x.id !== m.id)] : p.filter(x => x.id !== m.id));
        } catch (e: any) { alert(e?.response?.data?.message ?? 'Could not change the pin.'); }
    };

    const jumpTo = (id: number) => {
        const el = document.getElementById(`msg-${id}`);
        if (!el) return;
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        setFlash(id); window.setTimeout(() => setFlash(null), 1600);
    };

    /* Auto-grow the composer. */
    useEffect(() => {
        const t = textarea.current; if (!t) return;
        t.style.height = 'auto'; t.style.height = `${Math.min(t.scrollHeight, 160)}px`;
    }, [text]);

    const isCommon = props.channel === 'common';
    const visiblePinned = showAllPinned ? pinned : pinned.slice(0, 1);
    const totalUnread = channels.reduce((s, c) => s + (c.key === props.channel ? 0 : c.unread), 0);

    return (
        <AppLayout header="Chat">
            <Head title={`Chat · ${active?.name ?? ''}`} />

            <div className="card overflow-hidden grid grid-cols-1 lg:grid-cols-[300px_minmax(0,1fr)] h-[calc(100dvh-11.5rem)] lg:h-[calc(100dvh-8.5rem)] min-h-[460px]">
                {/* ── Chat list ── */}
                <aside className={`${mobileThread ? 'hidden lg:flex' : 'flex'} flex-col border-r border-surface-200 bg-surface-50/60 min-h-0`}>
                    <div className="px-4 pt-4 pb-3 border-b border-surface-200">
                        <div className="flex items-center gap-2">
                            <span className="w-9 h-9 rounded-xl bg-brand-500 text-white grid place-items-center"><MessagesSquare className="w-5 h-5" /></span>
                            <div>
                                <h2 className="font-bold text-surface-900 leading-tight">Chat</h2>
                                <p className="text-[11px] text-surface-500">Your section, and everyone</p>
                            </div>
                        </div>
                    </div>
                    <nav className="flex-1 overflow-y-auto p-2 space-y-0.5">
                        {channels.map((c, i) => (
                            <div key={c.key}>
                                {i === 1 && <p className="px-3 pt-3 pb-1 text-[10px] font-bold uppercase tracking-wider text-surface-400">My section</p>}
                                <ChannelRow c={c} active={c.key === props.channel} onClick={() => open(c.key)} />
                            </div>
                        ))}
                        {channels.length === 1 && (
                            <p className="px-3 py-4 text-xs text-surface-500 leading-relaxed">
                                You are not posted to a section yet, so only the common chat is open to you. An administrator sets your section at Admin → Users.
                            </p>
                        )}
                    </nav>
                </aside>

                {/* ── Conversation ── */}
                <section className={`${mobileThread ? 'flex' : 'hidden lg:flex'} flex-col min-h-0 relative bg-white`}>
                    {/* Header */}
                    <header className="flex items-center gap-3 px-4 py-3 border-b border-surface-200">
                        <button onClick={() => setMobileThread(false)} className="lg:hidden -ml-1 p-1.5 rounded-lg text-surface-600 hover:bg-surface-100 relative" aria-label="All chats">
                            <ChevronLeft className="w-5 h-5" />
                            {totalUnread > 0 && <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-amber-500" />}
                        </button>
                        <span className={`w-10 h-10 rounded-xl grid place-items-center shrink-0 ${isCommon ? 'bg-brand-500 text-white' : 'bg-brand-50 text-brand-600'}`}>
                            {channelIcon(active ?? { key: props.channel, code: null }, 'w-5 h-5')}
                        </span>
                        <div className="min-w-0 flex-1">
                            <h3 className="font-bold text-surface-900 truncate">
                                {active?.name}{active?.name_bn && <span className="font-medium text-surface-500"> · {active.name_bn}</span>}
                            </h3>
                            <p className="text-[11px] text-surface-500 flex items-center gap-1">
                                {isCommon
                                    ? <><Globe2 className="w-3 h-3" /> Everyone at the centre can read and reply</>
                                    : <><Lock className="w-3 h-3" /> Only this section’s people can see this chat</>}
                            </p>
                        </div>
                        <button onClick={() => setShowMembers(s => !s)}
                            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition ${showMembers ? 'bg-brand-50 border-brand-200 text-brand-700' : 'border-surface-200 text-surface-600 hover:bg-surface-50'}`}>
                            <Users className="w-4 h-4" /> {props.members.count}
                        </button>
                    </header>

                    {/* Members */}
                    {showMembers && (
                        <div className="absolute right-3 top-[62px] z-20 w-72 max-h-[60%] overflow-y-auto rounded-xl border border-surface-200 bg-white shadow-lg animate-fade-in">
                            <div className="px-4 py-3 border-b border-surface-100 flex items-center justify-between">
                                <p className="text-sm font-semibold text-surface-900">{props.members.count} {props.members.count === 1 ? 'person' : 'people'}</p>
                                <button onClick={() => setShowMembers(false)} className="p-1 rounded text-surface-400 hover:text-surface-700"><X className="w-4 h-4" /></button>
                            </div>
                            {isCommon ? (
                                <p className="px-4 py-3 text-xs text-surface-600 leading-relaxed">Everyone with an active staff account at this centre.</p>
                            ) : (
                                <>
                                    <ul className="py-1">
                                        {props.members.list.map(m => (
                                            <li key={m.id} className="flex items-center gap-2.5 px-4 py-2">
                                                <Avatar u={m} size="w-7 h-7 text-[10px]" />
                                                <div className="min-w-0">
                                                    <p className="text-sm text-surface-900 truncate">{m.name}</p>
                                                    {m.designation && <p className="text-[11px] text-surface-500 truncate">{m.designation}</p>}
                                                </div>
                                            </li>
                                        ))}
                                    </ul>
                                    <p className="px-4 py-2.5 border-t border-surface-100 text-[11px] text-surface-500 leading-relaxed">
                                        People posted to this section or holding its role. The system administrator can also open it.
                                    </p>
                                </>
                            )}
                        </div>
                    )}

                    {/* Pinned instructions */}
                    {pinned.length > 0 && (
                        <div className="border-b border-amber-200 bg-amber-50/80">
                            {visiblePinned.map(p => (
                                <div key={p.id} className="flex items-start gap-2.5 px-4 py-2.5 group">
                                    <Megaphone className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
                                    <button onClick={() => jumpTo(p.id)} className="min-w-0 flex-1 text-left">
                                        <p className="text-[11px] font-bold text-amber-800">
                                            নির্দেশনা · {p.user.name} <span className="font-normal text-amber-700">· {dayLabel(p.created_at)} {time(p.created_at)}</span>
                                        </p>
                                        <p className="text-sm text-surface-900 line-clamp-2 whitespace-pre-wrap">{p.body || (p.files.length ? `📎 ${p.files[0].name}` : '')}</p>
                                    </button>
                                    {p.can_pin && (
                                        <button onClick={() => togglePin(p)} title="Unpin" className="p-1 rounded text-amber-600 hover:bg-amber-100 opacity-60 group-hover:opacity-100">
                                            <PinOff className="w-3.5 h-3.5" />
                                        </button>
                                    )}
                                </div>
                            ))}
                            {pinned.length > 1 && (
                                <button onClick={() => setShowAllPinned(s => !s)} className="w-full px-4 pb-2 text-left text-[11px] font-semibold text-amber-700 hover:text-amber-900">
                                    {showAllPinned ? 'Show only the latest' : `+ ${pinned.length - 1} more নির্দেশনা`}
                                </button>
                            )}
                        </div>
                    )}

                    {/* Messages */}
                    <div ref={scroller} onScroll={onScroll} className="flex-1 overflow-y-auto px-3 sm:px-5 py-4 bg-surface-50/40">
                        {hasMore && (
                            <div className="text-center mb-4">
                                <button onClick={loadOlder} disabled={loadingOlder} className="btn-ghost text-xs">
                                    {loadingOlder ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Load earlier messages'}
                                </button>
                            </div>
                        )}
                        {messages.length === 0 ? (
                            <EmptyThread isCommon={isCommon} name={active?.name ?? ''} canInstruct={props.canInstruct} />
                        ) : (
                            <MessageList messages={messages} flash={flash}
                                onReply={m => { setReplyTo(m); textarea.current?.focus(); }}
                                onDelete={remove} onPin={togglePin} onJump={jumpTo} />
                        )}
                    </div>

                    {newBelow > 0 && (
                        <button onClick={toBottom}
                            className="absolute left-1/2 -translate-x-1/2 bottom-28 z-10 flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-brand-600 text-white text-xs font-semibold shadow-lg">
                            <ArrowDown className="w-3.5 h-3.5" /> {newBelow} new
                        </button>
                    )}

                    {/* Composer */}
                    <footer className="border-t border-surface-200 bg-white px-3 sm:px-4 py-3">
                        {replyTo && (
                            <div className="mb-2 flex items-center gap-2 rounded-lg border-l-4 border-brand-400 bg-brand-50/60 px-3 py-1.5">
                                <Reply className="w-3.5 h-3.5 text-brand-600 shrink-0" />
                                <p className="min-w-0 flex-1 text-xs text-surface-700 truncate">
                                    Replying to <b>{replyTo.user.name}</b>{replyTo.body && <> — {replyTo.body}</>}
                                </p>
                                <button onClick={() => setReplyTo(null)} className="p-0.5 text-surface-400 hover:text-surface-700"><X className="w-3.5 h-3.5" /></button>
                            </div>
                        )}
                        {files.length > 0 && (
                            <div className="mb-2 flex flex-wrap gap-1.5">
                                {files.map((f, i) => (
                                    <span key={i} className="inline-flex items-center gap-1.5 max-w-[220px] rounded-lg bg-surface-100 px-2 py-1 text-xs text-surface-700">
                                        <FileText className="w-3.5 h-3.5 shrink-0" /><span className="truncate">{f.name}</span>
                                        <button onClick={() => setFiles(fs => fs.filter((_, j) => j !== i))} className="text-surface-400 hover:text-rose-600"><X className="w-3 h-3" /></button>
                                    </span>
                                ))}
                            </div>
                        )}
                        {error && <p className="mb-2 text-xs text-rose-600">{error}</p>}

                        <div className={`flex items-end gap-2 rounded-2xl border px-2 py-1.5 transition ${asInstruction ? 'border-amber-300 bg-amber-50/60 ring-2 ring-amber-100' : 'border-surface-200 bg-surface-50 focus-within:border-brand-300 focus-within:ring-2 focus-within:ring-brand-100'}`}>
                            <button onClick={() => fileInput.current?.click()} title="Attach files (up to 5, 10 MB each)"
                                className="p-2 rounded-xl text-surface-500 hover:bg-surface-200/60 hover:text-surface-800">
                                <Paperclip className="w-[18px] h-[18px]" />
                            </button>
                            <input ref={fileInput} type="file" multiple className="hidden" onChange={pickFiles}
                                accept=".jpg,.jpeg,.png,.webp,.gif,.pdf,.doc,.docx,.xls,.xlsx,.dwg,.dxf,.txt,.csv" />
                            <textarea ref={textarea} value={text} onChange={e => setText(e.target.value)} onKeyDown={onKey} rows={1}
                                placeholder={asInstruction ? 'নির্দেশনা লিখুন — pinned for the whole section' : `Message ${active?.name ?? ''}…`}
                                className="flex-1 resize-none bg-transparent border-0 focus:ring-0 text-sm py-2 px-1 max-h-40 placeholder:text-surface-400" />
                            {props.canInstruct && (
                                <button onClick={() => setAsInstruction(s => !s)} title="Post as নির্দেশনা — pinned at the top and sent to everyone's notifications"
                                    className={`p-2 rounded-xl transition ${asInstruction ? 'bg-amber-500 text-white' : 'text-surface-500 hover:bg-amber-100 hover:text-amber-700'}`}>
                                    <Megaphone className="w-[18px] h-[18px]" />
                                </button>
                            )}
                            <button onClick={send} disabled={sending || (!text.trim() && !files.length)}
                                className={`p-2 rounded-xl text-white transition disabled:opacity-40 ${asInstruction ? 'bg-amber-500 hover:bg-amber-600' : 'bg-brand-500 hover:bg-brand-600'}`}
                                aria-label="Send">
                                {sending ? <Loader2 className="w-[18px] h-[18px] animate-spin" /> : <SendHorizontal className="w-[18px] h-[18px]" />}
                            </button>
                        </div>
                        <p className="mt-1.5 px-1 text-[10px] text-surface-400 hidden sm:block">
                            Enter to send · Shift + Enter for a new line
                            {props.canInstruct && <> · <Megaphone className="inline w-3 h-3 -mt-0.5" /> posts a নির্দেশনা</>}
                        </p>
                    </footer>
                </section>
            </div>
        </AppLayout>
    );
}

/* ─── Pieces ────────────────────────────────────────────────────────── */
function ChannelRow({ c, active, onClick }: { c: Channel; active: boolean; onClick: () => void }) {
    const common = c.key === 'common';
    return (
        <button onClick={onClick}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition ${active ? 'bg-white shadow-sm ring-1 ring-brand-200' : 'hover:bg-white/80'}`}>
            <span className={`w-10 h-10 rounded-xl grid place-items-center shrink-0 ${common ? 'bg-brand-500 text-white' : active ? 'bg-brand-100 text-brand-700' : 'bg-white border border-surface-200 text-surface-600'}`}>
                {channelIcon(c)}
            </span>
            <span className="min-w-0 flex-1">
                <span className="flex items-center gap-2">
                    <span className={`truncate text-sm ${c.unread ? 'font-bold text-surface-900' : 'font-semibold text-surface-800'}`}>
                        {common ? 'Common' : c.name}
                    </span>
                    {!common && <Lock className="w-3 h-3 text-surface-300 shrink-0" />}
                    <span className="ml-auto text-[10px] text-surface-400 shrink-0">{shortWhen(c.last?.at ?? null)}</span>
                </span>
                <span className="flex items-center gap-2 mt-0.5">
                    <span className={`truncate text-xs ${c.unread ? 'text-surface-800' : 'text-surface-500'}`}>
                        {c.last ? <>{c.last.who && <b className="font-semibold">{c.last.who.split(' ')[0]}: </b>}{c.last.text}</> : (c.name_bn ?? (common ? 'সকলের জন্য' : 'No messages yet'))}
                    </span>
                    {c.unread > 0 && (
                        <span className="ml-auto min-w-[20px] h-5 px-1.5 rounded-full bg-amber-500 text-white text-[10px] font-bold leading-5 text-center shrink-0">
                            {c.unread > 99 ? '99+' : c.unread}
                        </span>
                    )}
                </span>
            </span>
        </button>
    );
}

function EmptyThread({ isCommon, name, canInstruct }: { isCommon: boolean; name: string; canInstruct: boolean }) {
    return (
        <div className="h-full grid place-items-center text-center px-6">
            <div className="max-w-sm">
                <span className="mx-auto w-14 h-14 rounded-2xl bg-brand-50 text-brand-500 grid place-items-center mb-4">
                    <MessagesSquare className="w-7 h-7" />
                </span>
                <p className="font-semibold text-surface-900">{isCommon ? 'The common chat is quiet' : `Nothing in ${name} yet`}</p>
                <p className="mt-1 text-sm text-surface-500 leading-relaxed">
                    {isCommon
                        ? 'Anything written here is read by everyone at the centre.'
                        : 'Only the people of this section see what is written here.'}
                    {canInstruct && ' Use the megaphone to post a নির্দেশনা — it stays pinned at the top.'}
                </p>
            </div>
        </div>
    );
}

function MessageList({ messages, flash, onReply, onDelete, onPin, onJump }: {
    messages: Message[]; flash: number | null;
    onReply: (m: Message) => void; onDelete: (m: Message) => void; onPin: (m: Message) => void; onJump: (id: number) => void;
}) {
    const rows = useMemo(() => {
        const out: ReactNode[] = [];
        let lastDay = '';
        messages.forEach((m, i) => {
            const day = new Date(m.created_at).toDateString();
            if (day !== lastDay) {
                out.push(
                    <div key={`d-${m.id}`} className="flex items-center gap-3 my-4 first:mt-0">
                        <span className="flex-1 h-px bg-surface-200" />
                        <span className="text-[11px] font-semibold text-surface-500">{dayLabel(m.created_at)}</span>
                        <span className="flex-1 h-px bg-surface-200" />
                    </div>,
                );
                lastDay = day;
            }
            const prev = messages[i - 1];
            const grouped = !!prev && prev.user.id === m.user.id && new Date(prev.created_at).toDateString() === day
                && (new Date(m.created_at).getTime() - new Date(prev.created_at).getTime()) < 5 * 60_000
                && !m.is_instruction && !prev.is_instruction;
            out.push(<Bubble key={m.id} m={m} grouped={grouped} flash={flash === m.id}
                onReply={onReply} onDelete={onDelete} onPin={onPin} onJump={onJump} />);
        });
        return out;
    }, [messages, flash]);

    return <div className="space-y-0.5">{rows}</div>;
}

function Bubble({ m, grouped, flash, onReply, onDelete, onPin, onJump }: {
    m: Message; grouped: boolean; flash: boolean;
    onReply: (m: Message) => void; onDelete: (m: Message) => void; onPin: (m: Message) => void; onJump: (id: number) => void;
}) {
    const mine = m.mine;
    const tone = m.deleted
        ? 'bg-transparent border border-dashed border-surface-300 text-surface-400'
        : m.is_instruction
            ? 'bg-amber-50 border border-amber-300 text-surface-900'
            : mine ? 'bg-brand-500 text-white' : 'bg-white border border-surface-200 text-surface-900';

    return (
        <div id={`msg-${m.id}`} className={`group flex gap-2.5 ${mine ? 'flex-row-reverse' : ''} ${grouped ? 'mt-0.5' : 'mt-3'} rounded-xl transition ${flash ? 'bg-amber-100/70' : ''}`}>
            <div className="w-8 shrink-0">{!mine && !grouped && <Avatar u={m.user} />}</div>
            <div className={`min-w-0 max-w-[85%] sm:max-w-[70%] flex flex-col ${mine ? 'items-end' : 'items-start'}`}>
                {!grouped && (
                    <p className={`mb-1 text-[11px] text-surface-500 ${mine ? 'text-right' : ''}`}>
                        {!mine && <b className="font-semibold text-surface-800">{m.user.name}</b>}
                        {!mine && m.user.designation && <span> · {m.user.designation}</span>}
                        <span className="ml-1.5">{time(m.created_at)}</span>
                    </p>
                )}
                <div className="flex items-center gap-1.5">
                    {/* Hover actions sit on the inner side of the bubble. */}
                    <div className={`flex items-center gap-0.5 opacity-60 sm:opacity-0 sm:group-hover:opacity-100 focus-within:opacity-100 transition ${mine ? '' : 'order-2'}`}>
                        {!m.deleted && <IconBtn title="Reply" onClick={() => onReply(m)}><Reply className="w-3.5 h-3.5" /></IconBtn>}
                        {m.can_pin && (
                            <IconBtn title={m.is_instruction ? 'Unpin নির্দেশনা' : 'Pin as নির্দেশনা'} onClick={() => onPin(m)}>
                                {m.is_instruction ? <PinOff className="w-3.5 h-3.5" /> : <Pin className="w-3.5 h-3.5" />}
                            </IconBtn>
                        )}
                        {m.can_delete && <IconBtn title="Remove" danger onClick={() => onDelete(m)}><Trash2 className="w-3.5 h-3.5" /></IconBtn>}
                    </div>
                    <div className={`rounded-2xl px-3.5 py-2 text-sm leading-relaxed ${tone} ${mine ? 'rounded-tr-md' : 'rounded-tl-md'}`}>
                        {m.deleted ? (
                            <p className="italic text-xs">This message was removed</p>
                        ) : (
                            <>
                                {m.is_instruction && (
                                    <p className="mb-1 flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-amber-700">
                                        <Megaphone className="w-3 h-3" /> নির্দেশনা
                                    </p>
                                )}
                                {m.reply_to && (
                                    <button onClick={() => onJump(m.reply_to!.id)}
                                        className={`mb-1.5 block w-full text-left rounded-lg border-l-[3px] px-2 py-1 text-xs ${mine && !m.is_instruction ? 'border-white/70 bg-white/15 text-white/90' : 'border-brand-300 bg-surface-50 text-surface-600'}`}>
                                        <b className="font-semibold">{m.reply_to.name}</b>
                                        <span className="block truncate">{m.reply_to.excerpt ?? 'message removed'}</span>
                                    </button>
                                )}
                                {m.body && <p className="whitespace-pre-wrap break-words"><Linkified text={m.body} /></p>}
                                {m.files.length > 0 && <Files files={m.files} light={mine && !m.is_instruction} />}
                            </>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

function Files({ files, light }: { files: ChatFile[]; light: boolean }) {
    const images = files.filter(f => f.is_image);
    const others = files.filter(f => !f.is_image);
    return (
        <div className="mt-1.5 space-y-1.5">
            {images.length > 0 && (
                <div className={`grid gap-1.5 ${images.length > 1 ? 'grid-cols-2' : 'grid-cols-1'}`}>
                    {images.map(f => (
                        <a key={f.id} href={f.url} target="_blank" rel="noopener" className="block overflow-hidden rounded-lg bg-surface-100">
                            <img src={f.url} alt={f.name} loading="lazy" className="max-h-56 w-full object-cover hover:opacity-90 transition" />
                        </a>
                    ))}
                </div>
            )}
            {others.map(f => (
                <a key={f.id} href={f.url} target="_blank" rel="noopener"
                    className={`flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs ${light ? 'bg-white/15 hover:bg-white/25 text-white' : 'bg-surface-100 hover:bg-surface-200 text-surface-800'}`}>
                    <FileText className="w-4 h-4 shrink-0" />
                    <span className="truncate font-medium">{f.name}</span>
                    <span className={`ml-auto shrink-0 ${light ? 'text-white/70' : 'text-surface-500'}`}>{fileSize(f.size)}</span>
                </a>
            ))}
        </div>
    );
}

function IconBtn({ children, title, onClick, danger }: { children: ReactNode; title: string; onClick: () => void; danger?: boolean }) {
    return (
        <button onClick={onClick} title={title} aria-label={title}
            className={`p-1.5 rounded-lg text-surface-400 hover:bg-surface-100 ${danger ? 'hover:text-rose-600' : 'hover:text-surface-700'}`}>
            {children}
        </button>
    );
}
