import { Link, usePage } from '@inertiajs/react';
import { useCallback, useEffect, useState } from 'react';
import { Loader2, Maximize2, MessagesSquare, X } from 'lucide-react';
import ChatWindow, { ChatState } from '@/Components/Chat/ChatWindow';

const UNREAD_POLL_MS = 30_000;
const OPEN_KEY = 'bitac.chatDock.open';

// sessionStorage can throw (private mode, blocked site data) — the dock must work without it.
const remembered = () => { try { return sessionStorage.getItem(OPEN_KEY) === '1'; } catch { return false; } };
const remember = (open: boolean) => { try { sessionStorage.setItem(OPEN_KEY, open ? '1' : '0'); } catch { /* ignore */ } };

/**
 * The floating chat button, bottom-right on every staff page — where the AI
 * assistant's button used to be (BITAC, 2026-10-21: "AI floating chatbot ta
 * lagbena, ekhane chat er optionta niye asho"). It opens the section chats in
 * a small window; the expand button goes to the full /chat page. It stays open
 * across page changes for the rest of the browser session.
 */
export default function ChatDock() {
    const page = usePage() as any;
    const onChatPage = String(page.url ?? '').startsWith('/chat');
    const badge = Number(page.props.navBadges?.chat_unread ?? 0);
    const [open, setOpen] = useState(false);
    const [state, setState] = useState<ChatState | null>(null);
    const [loading, setLoading] = useState(false);
    const [unread, setUnread] = useState<number>(badge);
    useEffect(() => setUnread(badge), [badge]);   // every page load brings a fresh count

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const { data } = await (window as any).axios.get('/chat/state');
            setState(data);
        } catch { setState(null); }
        finally { setLoading(false); }
    }, []);

    const refreshUnread = useCallback(async () => {
        if (document.hidden) return;
        try {
            const { data } = await (window as any).axios.get('/chat/unread');
            setUnread(Number(data.unread ?? 0));
        } catch { /* next tick */ }
    }, []);

    const show = () => { setOpen(true); remember(true); load(); };
    const hide = () => { setOpen(false); remember(false); setState(null); refreshUnread(); };

    // Re-open after navigating if it was open.
    useEffect(() => { if (remembered() && !onChatPage) show(); }, []);

    // While closed, keep the badge honest.
    useEffect(() => {
        if (open) return;
        const t = window.setInterval(refreshUnread, UNREAD_POLL_MS);
        return () => window.clearInterval(t);
    }, [open, refreshUnread]);

    useEffect(() => {
        if (!open) return;
        const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') hide(); };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [open]);

    // The page already is the chat.
    if (onChatPage) return null;

    return (
        <>
            {!open && (
                <button onClick={show} aria-label="Open chat"
                    className="fixed bottom-20 lg:bottom-6 right-4 lg:right-6 z-50 w-14 h-14 rounded-full bg-brand-500 hover:bg-brand-600 text-white shadow-lg shadow-glow grid place-items-center transition hover:scale-105 active:scale-95">
                    <MessagesSquare className="w-6 h-6" />
                    {unread > 0 && (
                        <span className="absolute -top-1 -right-1 min-w-[22px] h-[22px] px-1.5 rounded-full bg-amber-500 text-white text-[11px] font-bold leading-[22px] text-center ring-2 ring-white tabular-nums">
                            {unread > 99 ? '99+' : unread}
                        </span>
                    )}
                </button>
            )}

            {open && (
                <div role="dialog" aria-label="Chat"
                    className="fixed bottom-4 lg:bottom-6 right-4 lg:right-6 z-50 w-[calc(100vw-2rem)] sm:w-[400px] h-[calc(100dvh-6rem)] sm:h-[620px] max-h-[85dvh] rounded-2xl bg-white border border-surface-200 shadow-2xl overflow-hidden animate-fade-in">
                    {state ? (
                        <ChatWindow initial={state} compact startInThread={state.channels.length === 1}
                            actions={(channel) => (
                                <div className="flex items-center gap-0.5 shrink-0">
                                    <Link href={`/chat?c=${channel}`} onClick={() => remember(false)} title="Open full page"
                                        className="p-1.5 rounded-lg text-surface-500 hover:bg-surface-100 hover:text-surface-800">
                                        <Maximize2 className="w-4 h-4" />
                                    </Link>
                                    <button onClick={hide} title="Close" aria-label="Close chat"
                                        className="p-1.5 rounded-lg text-surface-500 hover:bg-surface-100 hover:text-surface-800">
                                        <X className="w-4 h-4" />
                                    </button>
                                </div>
                            )} />
                    ) : (
                        <div className="h-full grid place-items-center text-sm text-surface-500">
                            {loading
                                ? <Loader2 className="w-6 h-6 animate-spin text-brand-500" />
                                : <div className="text-center px-6">
                                    <p>Could not open the chat.</p>
                                    <div className="mt-3 flex justify-center gap-2">
                                        <button onClick={load} className="btn-primary text-xs">Try again</button>
                                        <button onClick={hide} className="btn-outline text-xs">Close</button>
                                    </div>
                                </div>}
                        </div>
                    )}
                </div>
            )}
        </>
    );
}
