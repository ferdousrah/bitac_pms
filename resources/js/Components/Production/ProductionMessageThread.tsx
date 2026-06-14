import { useEffect, useRef, useState } from 'react';

/**
 * Production ↔ PCD query thread for a single Operation Sheet. Rendered on:
 *   - /operation-sheets/{id}  → PCD side (replies as 'pcd')
 *   - /production/wos/{id}    → shop side (posts as 'production' with section context)
 *
 * Polls every 2.5s to pick up replies. Files are streamed through the
 * controller's IDM-safe ?preview=base64 endpoint when previewing.
 */

interface MessageFile {
    id: number;
    name: string;
    extension: string | null;
    human_size: string | null;
    mime: string | null;
    url: string;
}

interface Message {
    id: number;
    body: string;
    author_role: 'production' | 'pcd';
    author: { id: number | null; name: string; designation: string | null };
    section: { id: number; name: string; code: string } | null;
    files: MessageFile[];
    created_at: string;
    created_human: string;
}

interface Props {
    sheetId: number;
    // Override who the viewer is — when not provided, we infer role from the
    // server response on send. Used to colour incoming vs outgoing rows.
    viewerRole?: 'production' | 'pcd';
    title?: string;
    subtitle?: string;
}

const POLL_INTERVAL_MS = 2500;
const MAX_FILES = 4;
const MAX_FILE_MB = 5;

function isImage(mime: string | null, ext: string | null): boolean {
    if (mime?.startsWith('image/')) return true;
    return ['png', 'jpg', 'jpeg', 'gif', 'webp'].includes((ext ?? '').toLowerCase());
}

export default function ProductionMessageThread({ sheetId, viewerRole, title, subtitle }: Props) {
    const [messages, setMessages] = useState<Message[]>([]);
    const [loading, setLoading] = useState(true);
    const [body, setBody] = useState('');
    const [files, setFiles] = useState<File[]>([]);
    const [sending, setSending] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const scrollRef = useRef<HTMLDivElement>(null);

    const fetchMessages = async () => {
        try {
            // Use axios (set up in bootstrap.ts) so the XSRF cookie token is
            // auto-decoded and sent as the X-XSRF-TOKEN header — keeps CSRF
            // working without needing a meta tag in the layout head.
            const { data } = await (window as any).axios.get(`/operation-sheets/${sheetId}/messages`);
            setMessages(data.messages ?? []);
        } catch {
            // swallow — polling will retry
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchMessages();
        const t = setInterval(fetchMessages, POLL_INTERVAL_MS);
        return () => clearInterval(t);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [sheetId]);

    useEffect(() => {
        // Pin to the bottom when new messages arrive.
        scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
    }, [messages.length]);

    const onPickFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
        const picked = Array.from(e.target.files ?? []);
        const trimmed = picked.slice(0, MAX_FILES - files.length);
        const oversized = trimmed.find(f => f.size > MAX_FILE_MB * 1024 * 1024);
        if (oversized) {
            setError(`"${oversized.name}" is over ${MAX_FILE_MB}MB.`);
            return;
        }
        setError(null);
        setFiles(prev => [...prev, ...trimmed].slice(0, MAX_FILES));
        e.target.value = '';
    };

    const removeFile = (idx: number) => setFiles(prev => prev.filter((_, i) => i !== idx));

    const send = async () => {
        const trimmed = body.trim();
        if (!trimmed && files.length === 0) return;
        setSending(true);
        setError(null);
        try {
            const fd = new FormData();
            fd.append('body', trimmed || `[Attachment]`);
            files.forEach(f => fd.append('attachments[]', f));
            // Axios reads the XSRF-TOKEN cookie automatically — no manual CSRF
            // header needed. Same auth/session as Inertia requests.
            await (window as any).axios.post(`/operation-sheets/${sheetId}/messages`, fd);
            setBody('');
            setFiles([]);
            await fetchMessages();
        } catch (e: any) {
            const msg = e?.response?.data?.message ?? e?.message ?? 'Send failed';
            setError(msg);
        } finally {
            setSending(false);
        }
    };

    return (
        <div className="card animate-slide-up">
            <div className="card-header">
                <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                        <i className="fi fi-rr-comments leading-none" />
                    </div>
                    <div className="min-w-0">
                        <h3 className="text-sm font-bold text-surface-900">{title ?? 'Production Queries'}</h3>
                        <p className="text-xs text-surface-500 mt-0.5">
                            {subtitle ?? 'Two-way thread between the shop floor and PCD planners.'}
                        </p>
                    </div>
                </div>
            </div>

            {/* Messages list */}
            <div
                ref={scrollRef}
                className="card-body max-h-[420px] overflow-y-auto space-y-3 bg-surface-50/40"
            >
                {loading ? (
                    <div className="text-center text-surface-400 text-xs py-6">Loading…</div>
                ) : messages.length === 0 ? (
                    <div className="text-center py-8">
                        <i className="fi fi-rr-comment-dots text-surface-300 text-2xl" />
                        <div className="text-sm text-surface-500 mt-2">No messages yet.</div>
                        <div className="text-xs text-surface-400 mt-1">
                            {viewerRole === 'production'
                                ? 'Ask PCD a question if anything is unclear.'
                                : 'Production will post queries here.'}
                        </div>
                    </div>
                ) : (
                    messages.map((m) => {
                        const mine = viewerRole && m.author_role === viewerRole;
                        return (
                            <div key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                                <div className={`max-w-[80%] rounded-2xl px-3 py-2 shadow-sm border ${
                                    m.author_role === 'pcd'
                                        ? 'bg-brand-50/70 border-brand-200'
                                        : 'bg-white border-surface-200'
                                }`}>
                                    <div className="flex items-center gap-1.5 flex-wrap">
                                        <span className="text-[11px] font-bold text-surface-900">{m.author.name}</span>
                                        <span className={`badge text-[9px] ${m.author_role === 'pcd' ? 'badge-blue' : 'badge-amber'}`}>
                                            {m.author_role === 'pcd' ? 'PCD' : 'Production'}
                                        </span>
                                        {m.section && (
                                            <span className="text-[10px] text-surface-500 font-mono">{m.section.code}</span>
                                        )}
                                        <span className="text-[10px] text-surface-400 ml-auto">{m.created_human}</span>
                                    </div>
                                    {m.body && (
                                        <div className="text-xs text-surface-700 mt-1 whitespace-pre-line">{m.body}</div>
                                    )}
                                    {m.files.length > 0 && (
                                        <div className="mt-2 grid grid-cols-2 gap-1.5">
                                            {m.files.map((f) => (
                                                <a
                                                    key={f.id}
                                                    href={f.url}
                                                    target="_blank"
                                                    rel="noreferrer"
                                                    className="flex items-center gap-1.5 text-[11px] px-2 py-1.5 rounded-lg bg-white border border-surface-200 hover:border-brand-400 hover:bg-brand-50/40 transition-colors"
                                                    title={f.name}
                                                >
                                                    <i className={`fi ${isImage(f.mime, f.extension) ? 'fi-rr-picture' : f.extension === 'pdf' ? 'fi-rr-file-pdf' : 'fi-rr-document'} text-surface-500`} />
                                                    <span className="truncate font-medium text-surface-800">{f.name}</span>
                                                    {f.human_size && <span className="text-surface-400 text-[10px] shrink-0">{f.human_size}</span>}
                                                </a>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })
                )}
            </div>

            {/* Composer */}
            <div className="card-body border-t border-surface-100 space-y-2">
                {error && (
                    <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                        {error}
                    </div>
                )}

                {files.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                        {files.map((f, i) => (
                            <div key={i} className="inline-flex items-center gap-1.5 bg-surface-50 border border-surface-200 rounded-lg pl-2 pr-1 py-1 text-xs">
                                <i className="fi fi-rr-clip text-surface-500" />
                                <span className="font-medium text-surface-700 max-w-[180px] truncate">{f.name}</span>
                                <button
                                    type="button"
                                    onClick={() => removeFile(i)}
                                    className="w-5 h-5 rounded hover:bg-surface-200 text-surface-500 inline-flex items-center justify-center"
                                    aria-label="Remove"
                                >
                                    <i className="fi fi-rr-cross-small text-[10px] leading-none" />
                                </button>
                            </div>
                        ))}
                    </div>
                )}

                <textarea
                    value={body}
                    onChange={(e) => setBody(e.target.value)}
                    className="form-textarea w-full text-sm"
                    rows={2}
                    placeholder={
                        viewerRole === 'production'
                            ? 'Ask PCD — material clarification, drawing query, machine issue…'
                            : 'Reply to production…'
                    }
                    disabled={sending}
                />
                <div className="flex items-center justify-between gap-2">
                    <label className="btn-ghost btn-sm cursor-pointer">
                        <i className="fi fi-rr-clip text-xs leading-none" />
                        <span>Attach</span>
                        <input
                            type="file"
                            multiple
                            className="hidden"
                            accept=".pdf,.jpg,.jpeg,.png,.gif,.webp,.xls,.xlsx,.doc,.docx"
                            onChange={onPickFiles}
                            disabled={sending || files.length >= MAX_FILES}
                        />
                    </label>
                    <button
                        type="button"
                        onClick={send}
                        disabled={sending || (!body.trim() && files.length === 0)}
                        className="btn-primary btn-sm"
                    >
                        <i className="fi fi-rr-paper-plane text-xs leading-none" />
                        {sending ? 'Sending…' : 'Send'}
                    </button>
                </div>
                <div className="text-[10px] text-surface-400">
                    Max {MAX_FILES} files · {MAX_FILE_MB}MB each · PDF/JPG/PNG/Excel/Word
                </div>
            </div>
        </div>
    );
}
