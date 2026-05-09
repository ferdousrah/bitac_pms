import { useForm, usePage } from '@inertiajs/react';
import { FormEvent, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import axios from 'axios';
import { useAiEnabled } from '@/lib/useAiEnabled';

interface Comment {
    id: number;
    body: string;
    kind: string;
    user: { id: number; name: string } | null;
    created_at: string;
    created_at_diff: string;
    can_delete?: boolean;
}

interface Props {
    entityType: 'cost_estimate' | 'quotation';
    entityId: number;
    comments: Comment[];
    title?: string;
}

const KIND_BADGES: Record<string, { label: string; dot: string; text: string }> = {
    comment:       { label: 'Comment',       dot: 'bg-blue-400',    text: 'text-blue-700' },
    question:      { label: 'Question',      dot: 'bg-amber-400',   text: 'text-amber-700' },
    clarification: { label: 'Clarification', dot: 'bg-purple-400',  text: 'text-purple-700' },
};

export default function CommentThread({ entityType, entityId, comments = [], title = 'Discussion' }: Props) {
    const { auth } = usePage().props as any;
    const currentUserId: number | null = auth?.user?.id ?? null;

    const { data, setData, post, processing, reset, errors } = useForm({
        entity_type: entityType,
        entity_id:   entityId,
        body:        '',
        kind:        'comment',
    });

    const [showKindPicker, setShowKindPicker] = useState(false);

    // AI assist state
    const aiEnabled = useAiEnabled();
    const [aiLoading, setAiLoading] = useState<'suggest' | 'polish' | null>(null);
    const [aiSuggestions, setAiSuggestions] = useState<Array<{ label: string; text: string }>>([]);
    const [aiPolished, setAiPolished] = useState<string | null>(null);
    const [aiError, setAiError] = useState<string | null>(null);

    const aiSuggest = async () => {
        setAiLoading('suggest');
        setAiError(null);
        setAiPolished(null);
        try {
            const { data: res } = await axios.post('/ai-assist/comment-reply', {
                mode: 'suggest', text: data.body, entity_type: entityType, entity_id: entityId,
            });
            if (Array.isArray(res?.suggestions)) setAiSuggestions(res.suggestions);
            else setAiError('No suggestions returned.');
        } catch (err: any) {
            setAiError(err.response?.data?.error || 'AI request failed.');
        } finally {
            setAiLoading(null);
        }
    };

    const aiPolish = async () => {
        if (!data.body.trim()) {
            setAiError('Write something first, then I can polish it.');
            return;
        }
        setAiLoading('polish');
        setAiError(null);
        setAiSuggestions([]);
        try {
            const { data: res } = await axios.post('/ai-assist/comment-reply', {
                mode: 'polish', text: data.body, entity_type: entityType, entity_id: entityId,
            });
            if (res?.polished) setAiPolished(res.polished);
            else setAiError('Could not polish the text.');
        } catch (err: any) {
            setAiError(err.response?.data?.error || 'AI request failed.');
        } finally {
            setAiLoading(null);
        }
    };

    const submit = (e: FormEvent) => {
        e.preventDefault();
        if (!data.body.trim()) return;
        post('/entity-comments', {
            onSuccess: () => reset('body'),
            preserveScroll: true,
        });
    };

    const deleteComment = (id: number) => {
        if (!confirm('Delete this comment?')) return;
        // Use router delete via fetch-like approach — inertia's destroy
        import('@inertiajs/react').then(({ router }) => {
            router.delete(`/entity-comments/${id}`, { preserveScroll: true });
        });
    };

    return (
        <div className="card">
            <div className="px-5 py-3 border-b border-surface-100 flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <i className="fi fi-rr-comments text-surface-400 text-xs leading-none" />
                    <h3 className="text-xs font-bold text-surface-900 uppercase tracking-wider">{title}</h3>
                    {comments.length > 0 && (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-blue-50 border border-blue-100 text-[10px] font-bold text-blue-700">
                            {comments.length}
                        </span>
                    )}
                </div>
                <span className="text-[10px] text-surface-400 italic">
                    Preparer ↔ Approver conversation
                </span>
            </div>

            {/* Thread */}
            <div className="divide-y divide-surface-100">
                {comments.length === 0 ? (
                    <div className="px-5 py-8 text-center">
                        <div className="w-12 h-12 rounded-2xl bg-surface-50 flex items-center justify-center mx-auto mb-2">
                            <i className="fi fi-rr-comment text-surface-300 text-lg leading-none" />
                        </div>
                        <p className="text-xs text-surface-400">No discussion yet. Be the first to post a note.</p>
                    </div>
                ) : (
                    <AnimatePresence initial={false}>
                        {comments.map((c) => {
                            const kindCfg = KIND_BADGES[c.kind] ?? KIND_BADGES.comment;
                            const isMine = currentUserId !== null && c.user?.id === currentUserId;
                            return (
                                <motion.div
                                    key={c.id}
                                    layout
                                    initial={{ opacity: 0, y: -4 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0 }}
                                    className={`px-5 py-3 flex gap-3 ${isMine ? 'bg-indigo-50/30' : ''}`}
                                >
                                    {/* Avatar */}
                                    <div className="shrink-0">
                                        <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-xs font-bold ${
                                            isMine
                                                ? 'bg-gradient-to-br from-indigo-500 to-purple-500 text-white'
                                                : 'bg-gradient-to-br from-slate-400 to-slate-500 text-white'
                                        }`}>
                                            {(c.user?.name?.[0] ?? '?').toUpperCase()}
                                        </div>
                                    </div>
                                    {/* Body */}
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <span className={`text-xs font-bold ${isMine ? 'text-indigo-900' : 'text-surface-900'}`}>
                                                {c.user?.name ?? 'Unknown'}
                                                {isMine && <span className="ml-1 text-[10px] text-indigo-500">(you)</span>}
                                            </span>
                                            <span className="inline-flex items-center gap-1 text-[10px]">
                                                <span className={`w-1.5 h-1.5 rounded-full ${kindCfg.dot}`} />
                                                <span className={`${kindCfg.text} font-semibold`}>{kindCfg.label}</span>
                                            </span>
                                            <span className="text-[10px] text-surface-400" title={c.created_at}>
                                                · {c.created_at_diff}
                                            </span>
                                            {c.can_delete && (
                                                <button
                                                    onClick={() => deleteComment(c.id)}
                                                    className="ml-auto text-[10px] text-surface-400 hover:text-red-600 transition-colors"
                                                    title="Delete comment"
                                                >
                                                    <i className="fi fi-rr-trash text-[10px] leading-none" /> Delete
                                                </button>
                                            )}
                                        </div>
                                        <div className="text-sm text-surface-800 mt-1 whitespace-pre-wrap leading-relaxed">
                                            {c.body}
                                        </div>
                                    </div>
                                </motion.div>
                            );
                        })}
                    </AnimatePresence>
                )}
            </div>

            {/* Composer */}
            <form onSubmit={submit} className="px-5 py-4 border-t border-surface-100 bg-surface-50/40 space-y-2">
                <textarea
                    value={data.body}
                    onChange={e => setData('body', e.target.value)}
                    rows={3}
                    placeholder="Reply, clarify, or ask a question... (Shift+Enter for new line)"
                    className="form-textarea text-sm w-full"
                    onKeyDown={e => {
                        if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) submit(e as any);
                    }}
                    disabled={processing}
                />
                {errors.body && <p className="form-error">{errors.body}</p>}

                {/* AI Assist — only when the master AI switch is on */}
                {aiEnabled && <>
                <div className="flex items-center gap-1.5 flex-wrap pt-1">
                    <span className="text-[10px] font-bold text-indigo-600 uppercase tracking-wider mr-1">
                        ✨ Oli
                    </span>
                    <button
                        type="button"
                        onClick={aiSuggest}
                        disabled={aiLoading !== null || processing}
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold bg-gradient-to-r from-indigo-500 to-purple-500 text-white hover:opacity-90 transition-opacity disabled:opacity-50"
                    >
                        {aiLoading === 'suggest' ? (
                            <><i className="fi fi-rr-spinner animate-spin text-[9px] leading-none" />Thinking...</>
                        ) : (
                            <>✨ Suggest reply</>
                        )}
                    </button>
                    <button
                        type="button"
                        onClick={aiPolish}
                        disabled={aiLoading !== null || !data.body.trim() || processing}
                        title={!data.body.trim() ? 'Write something first' : 'Polish your reply'}
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold bg-white border border-indigo-200 text-indigo-700 hover:bg-indigo-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                        {aiLoading === 'polish' ? (
                            <><i className="fi fi-rr-spinner animate-spin text-[9px] leading-none" />Polishing...</>
                        ) : (
                            <>💎 Polish</>
                        )}
                    </button>
                </div>

                <AnimatePresence>
                    {aiError && (
                        <motion.div
                            className="px-2 py-1 rounded-md bg-red-50 border border-red-200 text-[11px] text-red-700"
                            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        >
                            ⚠️ {aiError}
                        </motion.div>
                    )}
                </AnimatePresence>

                <AnimatePresence>
                    {aiSuggestions.length > 0 && (
                        <motion.div
                            className="space-y-1.5"
                            initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                        >
                            <div className="flex items-center justify-between">
                                <div className="text-[10px] font-bold text-surface-500 uppercase tracking-wider flex items-center gap-1">
                                    ✨ <span>Oli's Suggestions</span>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setAiSuggestions([])}
                                    className="text-[10px] text-surface-400 hover:text-surface-700"
                                >
                                    Dismiss
                                </button>
                            </div>
                            {aiSuggestions.map((s, i) => (
                                <button
                                    key={i}
                                    type="button"
                                    onClick={() => { setData('body', s.text); setAiSuggestions([]); }}
                                    className="group w-full text-left p-2 rounded-lg border-2 bg-indigo-50 border-indigo-200 text-indigo-900 hover:bg-indigo-100 transition-all"
                                >
                                    <div className="flex items-start gap-2">
                                        <span className="shrink-0 inline-flex items-center justify-center w-5 h-5 rounded bg-white/90 text-[10px] font-bold mt-0.5">
                                            {i + 1}
                                        </span>
                                        <div className="flex-1 min-w-0">
                                            <div className="text-[9px] font-bold uppercase tracking-wider text-indigo-600 mb-0.5">
                                                {s.label}
                                            </div>
                                            <div className="text-xs leading-relaxed">{s.text}</div>
                                        </div>
                                        <span className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity text-[10px] font-bold">
                                            Use →
                                        </span>
                                    </div>
                                </button>
                            ))}
                        </motion.div>
                    )}
                </AnimatePresence>

                <AnimatePresence>
                    {aiPolished && (
                        <motion.div
                            className="rounded-lg border-2 border-indigo-200 bg-gradient-to-br from-indigo-50 to-purple-50 p-2.5"
                            initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                        >
                            <div className="flex items-center justify-between mb-1">
                                <div className="text-[10px] font-bold text-indigo-700 uppercase tracking-wider flex items-center gap-1">
                                    💎 <span>Polished version</span>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setAiPolished(null)}
                                    className="text-[10px] text-surface-400 hover:text-surface-700"
                                >
                                    Dismiss
                                </button>
                            </div>
                            <div className="text-xs text-surface-800 mb-2 leading-relaxed whitespace-pre-wrap">
                                {aiPolished}
                            </div>
                            <button
                                type="button"
                                onClick={() => { setData('body', aiPolished); setAiPolished(null); }}
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-bold bg-indigo-600 text-white hover:bg-indigo-700 transition-colors"
                            >
                                ✓ Replace my text
                            </button>
                        </motion.div>
                    )}
                </AnimatePresence>
                </>}

                <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-[10px] font-semibold text-surface-400 uppercase tracking-wider">Post as:</span>
                        {(['comment', 'question', 'clarification'] as const).map((k) => {
                            const cfg = KIND_BADGES[k];
                            return (
                                <button
                                    key={k}
                                    type="button"
                                    onClick={() => setData('kind', k)}
                                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold transition-colors ${
                                        data.kind === k
                                            ? `bg-white border-2 border-current ${cfg.text}`
                                            : 'bg-white border border-surface-200 text-surface-500 hover:border-surface-300'
                                    }`}
                                >
                                    <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
                                    {cfg.label}
                                </button>
                            );
                        })}
                    </div>

                    <div className="flex items-center gap-2">
                        <span className="text-[10px] text-surface-400">Ctrl+Enter to post</span>
                        <button
                            type="submit"
                            disabled={processing || !data.body.trim()}
                            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {processing ? (
                                <>
                                    <i className="fi fi-rr-spinner animate-spin text-xs leading-none" />
                                    Posting...
                                </>
                            ) : (
                                <>
                                    <i className="fi fi-rr-paper-plane text-xs leading-none" />
                                    Post
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </form>
        </div>
    );
}
