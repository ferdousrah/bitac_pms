import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import axios from 'axios';
import { useAiEnabled } from '@/lib/useAiEnabled';

interface Props {
    action: 'approve' | 'request_changes' | 'reject' | 'handoff_quotation';
    entityType: 'cost_estimate' | 'quotation';
    entityId: number;
    currentText: string;
    onApplyText: (text: string) => void;
    color: 'emerald' | 'amber' | 'red';
}

interface Suggestion { label: string; text: string }

/**
 * AI-assisted note composer for approval workflows.
 * Offers "Suggest 3 ideas" and "Polish my writing" powered by Oli.
 */
export default function ApprovalNoteAI({ action, entityType, entityId, currentText, onApplyText, color }: Props) {
    const aiEnabled = useAiEnabled();

    // Keep hook order stable: declare all state/effects above, gate render at the bottom.
    const [loading, setLoading] = useState<'suggest' | 'polish' | null>(null);
    const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
    const [polished, setPolished] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    const colorClasses = {
        emerald: { button: 'bg-emerald-500 hover:bg-emerald-600 text-white', chip: 'bg-emerald-50 border-emerald-200 text-emerald-800 hover:bg-emerald-100', accent: 'text-emerald-600' },
        amber:   { button: 'bg-amber-500 hover:bg-amber-600 text-white',     chip: 'bg-amber-50 border-amber-200 text-amber-800 hover:bg-amber-100',     accent: 'text-amber-600' },
        red:     { button: 'bg-red-500 hover:bg-red-600 text-white',         chip: 'bg-red-50 border-red-200 text-red-800 hover:bg-red-100',             accent: 'text-red-600' },
    }[color];

    const runSuggest = async () => {
        setLoading('suggest');
        setError(null);
        setPolished(null);
        try {
            const { data } = await axios.post('/ai-assist/approval-note', {
                action, entity_type: entityType, entity_id: entityId,
                mode: 'suggest', text: currentText,
            });
            if (Array.isArray(data?.suggestions)) {
                setSuggestions(data.suggestions);
            } else {
                setError('No suggestions returned.');
            }
        } catch (err: any) {
            setError(err.response?.data?.error || 'AI request failed.');
        } finally {
            setLoading(null);
        }
    };

    const runPolish = async () => {
        if (!currentText.trim()) {
            setError('Write something first, then I can polish it.');
            return;
        }
        setLoading('polish');
        setError(null);
        setSuggestions([]);
        try {
            const { data } = await axios.post('/ai-assist/approval-note', {
                action, entity_type: entityType, entity_id: entityId,
                mode: 'polish', text: currentText,
            });
            if (data?.polished) {
                setPolished(data.polished);
            } else {
                setError('Could not polish the text.');
            }
        } catch (err: any) {
            setError(err.response?.data?.error || 'AI request failed.');
        } finally {
            setLoading(null);
        }
    };

    const applySuggestion = (s: Suggestion) => {
        onApplyText(s.text);
        setSuggestions([]);
    };

    const applyPolished = () => {
        if (polished) {
            onApplyText(polished);
            setPolished(null);
        }
    };

    if (!aiEnabled) return null;

    return (
        <div className="space-y-2">
            {/* Action buttons */}
            <div className="flex items-center gap-1.5">
                <button
                    type="button"
                    onClick={runSuggest}
                    disabled={loading !== null}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-semibold bg-gradient-to-r from-indigo-500 to-purple-500 text-white hover:opacity-90 transition-opacity disabled:opacity-50"
                >
                    {loading === 'suggest' ? (
                        <>
                            <i className="fi fi-rr-spinner animate-spin text-[10px] leading-none" />
                            Thinking...
                        </>
                    ) : (
                        <>
                            <span className="text-[11px]">✨</span>
                            Suggest with Oli
                        </>
                    )}
                </button>
                <button
                    type="button"
                    onClick={runPolish}
                    disabled={loading !== null || !currentText.trim()}
                    title={!currentText.trim() ? 'Write something first' : 'Polish your text'}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-semibold bg-white border border-indigo-200 text-indigo-700 hover:bg-indigo-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                    {loading === 'polish' ? (
                        <>
                            <i className="fi fi-rr-spinner animate-spin text-[10px] leading-none" />
                            Polishing...
                        </>
                    ) : (
                        <>
                            <span className="text-[11px]">💎</span>
                            Polish writing
                        </>
                    )}
                </button>
            </div>

            {/* Error message */}
            <AnimatePresence>
                {error && (
                    <motion.div
                        className="px-2.5 py-1.5 rounded-md bg-red-50 border border-red-200 text-[11px] text-red-700"
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                    >
                        ⚠️ {error}
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Suggestions */}
            <AnimatePresence>
                {suggestions.length > 0 && (
                    <motion.div
                        className="space-y-1.5"
                        initial={{ opacity: 0, y: -5 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -5 }}
                    >
                        <div className="flex items-center justify-between">
                            <div className="text-[10px] font-bold text-surface-500 uppercase tracking-wider flex items-center gap-1">
                                <span>✨</span>
                                <span>Oli's Suggestions</span>
                            </div>
                            <button
                                type="button"
                                onClick={() => setSuggestions([])}
                                className="text-[10px] text-surface-400 hover:text-surface-700"
                            >
                                Dismiss
                            </button>
                        </div>
                        {suggestions.map((s, i) => (
                            <button
                                key={i}
                                type="button"
                                onClick={() => applySuggestion(s)}
                                className={`group w-full text-left p-2 rounded-lg border-2 transition-all ${colorClasses.chip}`}
                            >
                                <div className="flex items-start gap-2">
                                    <div className="shrink-0 mt-0.5">
                                        <span className="inline-flex items-center justify-center w-5 h-5 rounded bg-white/80 text-[10px] font-bold">
                                            {i + 1}
                                        </span>
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className={`text-[9px] font-bold uppercase tracking-wider ${colorClasses.accent} mb-0.5`}>
                                            {s.label}
                                        </div>
                                        <div className="text-xs leading-relaxed">{s.text}</div>
                                    </div>
                                    <div className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity text-[10px] font-bold">
                                        Use →
                                    </div>
                                </div>
                            </button>
                        ))}
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Polished version */}
            <AnimatePresence>
                {polished && (
                    <motion.div
                        className="rounded-lg border-2 border-indigo-200 bg-gradient-to-br from-indigo-50 to-purple-50 p-2.5"
                        initial={{ opacity: 0, y: -5 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -5 }}
                    >
                        <div className="flex items-center justify-between mb-1">
                            <div className="text-[10px] font-bold text-indigo-700 uppercase tracking-wider flex items-center gap-1">
                                <span>💎</span>
                                <span>Polished version</span>
                            </div>
                            <button
                                type="button"
                                onClick={() => setPolished(null)}
                                className="text-[10px] text-surface-400 hover:text-surface-700"
                            >
                                Dismiss
                            </button>
                        </div>
                        <div className="text-xs text-surface-800 mb-2 leading-relaxed">{polished}</div>
                        <div className="flex items-center gap-1.5">
                            <button
                                type="button"
                                onClick={applyPolished}
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-bold bg-indigo-600 text-white hover:bg-indigo-700 transition-colors"
                            >
                                ✓ Replace my text
                            </button>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
