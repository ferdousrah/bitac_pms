import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import axios from 'axios';
import { useAiEnabled } from '@/lib/useAiEnabled';

interface ContextPayload {
    rfq_id?: number | string | null;
    validity_days?: number | string;
    vat_rate?: number | string;
    items?: Array<{ description: string; quantity: number | string; unit_price: number | string }>;
}

interface Props {
    currentText: string;
    onApplyText: (text: string) => void;
    context: ContextPayload;
}

interface Suggestion { label: string; text: string }

/**
 * AI assist for customer-facing Notes & Terms on a new quotation.
 * Uses /ai-assist/quotation-terms (pre-save, no entity_id needed).
 */
export default function QuotationTermsAI({ currentText, onApplyText, context }: Props) {
    const aiEnabled = useAiEnabled();
    const [loading, setLoading] = useState<'suggest' | 'polish' | null>(null);
    const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
    const [polished, setPolished] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    const payload = () => ({
        ...context,
        items: (context.items ?? []).map(i => ({
            description: i.description,
            quantity:    Number(i.quantity) || 0,
            unit_price:  Number(i.unit_price) || 0,
        })),
    });

    const runSuggest = async () => {
        setLoading('suggest');
        setError(null);
        setPolished(null);
        try {
            const { data } = await axios.post('/ai-assist/quotation-terms', {
                mode: 'suggest', text: currentText, ...payload(),
            });
            if (Array.isArray(data?.suggestions)) setSuggestions(data.suggestions);
            else setError('No suggestions returned.');
        } catch (err: any) {
            setError(err.response?.data?.error || 'AI request failed.');
        } finally {
            setLoading(null);
        }
    };

    const runPolish = async () => {
        if (!currentText.trim()) {
            setError('Write some terms first, then I can polish them.');
            return;
        }
        setLoading('polish');
        setError(null);
        setSuggestions([]);
        try {
            const { data } = await axios.post('/ai-assist/quotation-terms', {
                mode: 'polish', text: currentText, ...payload(),
            });
            if (data?.polished) setPolished(data.polished);
            else setError('Could not polish the text.');
        } catch (err: any) {
            setError(err.response?.data?.error || 'AI request failed.');
        } finally {
            setLoading(null);
        }
    };

    const applySuggestion = (s: Suggestion) => { onApplyText(s.text); setSuggestions([]); };
    const applyPolished = () => { if (polished) { onApplyText(polished); setPolished(null); } };

    if (!aiEnabled) return null;

    return (
        <div className="space-y-2">
            <div className="flex items-center gap-1.5 flex-wrap">
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
                            Suggest Terms with Oli
                        </>
                    )}
                </button>
                <button
                    type="button"
                    onClick={runPolish}
                    disabled={loading !== null || !currentText.trim()}
                    title={!currentText.trim() ? 'Write some terms first' : 'Polish your terms'}
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

            <AnimatePresence>
                {suggestions.length > 0 && (
                    <motion.div
                        className="space-y-1.5"
                        initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -5 }}
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
                                className="group w-full text-left p-2.5 rounded-lg border-2 bg-purple-50 border-purple-200 text-purple-900 hover:bg-purple-100 transition-all"
                            >
                                <div className="flex items-start gap-2">
                                    <div className="shrink-0 mt-0.5">
                                        <span className="inline-flex items-center justify-center w-5 h-5 rounded bg-white/90 text-[10px] font-bold">
                                            {i + 1}
                                        </span>
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="text-[9px] font-bold uppercase tracking-wider text-purple-600 mb-0.5">
                                            {s.label}
                                        </div>
                                        <div className="text-xs leading-relaxed whitespace-pre-wrap">{s.text}</div>
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

            <AnimatePresence>
                {polished && (
                    <motion.div
                        className="rounded-lg border-2 border-indigo-200 bg-gradient-to-br from-indigo-50 to-purple-50 p-2.5"
                        initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -5 }}
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
                        <div className="text-xs text-surface-800 mb-2 leading-relaxed whitespace-pre-wrap">{polished}</div>
                        <div className="flex items-center gap-1.5">
                            <button
                                type="button"
                                onClick={applyPolished}
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-bold bg-indigo-600 text-white hover:bg-indigo-700 transition-colors"
                            >
                                ✓ Replace my terms
                            </button>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
