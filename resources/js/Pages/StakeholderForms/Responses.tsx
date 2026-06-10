import AppLayout from '@/Layouts/AppLayout';
import { Link } from '@inertiajs/react';
import axios from 'axios';
import { useState } from 'react';

export default function Responses({ form, questions, sections, aggregates, responses, stats }: any) {
    const [tab, setTab] = useState<'summary' | 'individual'>('summary');
    const [aiSummary, setAiSummary] = useState<string | null>(null);
    const [aiLoading, setAiLoading] = useState(false);
    const [selectedResponse, setSelectedResponse] = useState<any | null>(null);

    const generateAiSummary = async () => {
        setAiLoading(true);
        try {
            const { data } = await axios.get(`/ied/stakeholder-forms/${form.id}/ai-summary`);
            setAiSummary(data.summary);
        } catch (e: any) {
            setAiSummary('AI summary failed: ' + (e?.response?.data?.summary ?? e.message));
        }
        setAiLoading(false);
    };

    const responseRate = stats.total_invited > 0
        ? Math.round((stats.completed / stats.total_invited) * 100)
        : 0;

    return (
        <AppLayout header={`Responses — ${form.title}`}>
            <div className="space-y-4 animate-fade-in">

                <Link href="/ied/stakeholder-forms" className="text-xs text-surface-500 hover:text-brand-600 inline-flex items-center gap-1">
                    <i className="fi fi-rr-arrow-left text-[10px] leading-none" /> Back to forms
                </Link>

                {/* Response rate header */}
                <div className="card">
                    <div className="card-body">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                            <div>
                                <h2 className="text-base font-bold text-surface-900">{form.title}</h2>
                                <p className="text-xs text-surface-400 mt-0.5">
                                    {stats.total_responses} responses · {stats.total_invited} invited · {responseRate}% response rate
                                </p>
                                <div className="w-full max-w-md mt-3 h-2 rounded-full bg-surface-100 overflow-hidden">
                                    <div className="h-full bg-gradient-to-r from-emerald-400 to-emerald-600 rounded-full transition-all"
                                        style={{ width: `${responseRate}%` }} />
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <Link href={`/ied/stakeholder-forms/${form.id}/distribute`} className="btn-outline btn-sm">
                                    <i className="fi fi-rr-paper-plane text-xs leading-none" /> Distribute
                                </Link>
                                <a href={`/ied/stakeholder-forms/${form.id}/export`} className="btn-outline btn-sm">
                                    <i className="fi fi-rr-download text-xs leading-none" /> Export CSV
                                </a>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-4 pt-4 border-t border-surface-100">
                            <SmallStat label="Invited"   value={stats.total_invited} />
                            <SmallStat label="Opened"    value={stats.opened}        color="amber" />
                            <SmallStat label="Completed" value={stats.completed}     color="emerald" />
                            <SmallStat label="All Resp." value={stats.total_responses} color="indigo" />
                        </div>
                    </div>
                </div>

                {/* Tabs */}
                <div className="flex items-center gap-1">
                    <button onClick={() => setTab('summary')}
                        className={`px-4 py-2 rounded-lg text-xs font-semibold ${tab === 'summary' ? 'bg-surface-900 text-white' : 'text-surface-600 hover:bg-surface-100'}`}>
                        Aggregate Summary
                    </button>
                    <button onClick={() => setTab('individual')}
                        className={`px-4 py-2 rounded-lg text-xs font-semibold ${tab === 'individual' ? 'bg-surface-900 text-white' : 'text-surface-600 hover:bg-surface-100'}`}>
                        Individual Responses ({responses.length})
                    </button>
                </div>

                {tab === 'summary' && (
                    <>
                        {/* AI Summary */}
                        <div className="card border-violet-200 bg-gradient-to-br from-violet-50 to-violet-100/40">
                            <div className="card-body">
                                <div className="flex items-center justify-between gap-3 mb-3">
                                    <div className="flex items-center gap-2">
                                        <div className="w-9 h-9 rounded-xl bg-violet-100 text-violet-700 flex items-center justify-center">
                                            <i className="fi fi-rr-magic-wand text-sm leading-none" />
                                        </div>
                                        <div>
                                            <h3 className="text-sm font-bold text-violet-900">AI Theme Summary</h3>
                                            <p className="text-[11px] text-violet-700/80 mt-0.5">Gemini extracts themes from open-text answers</p>
                                        </div>
                                    </div>
                                    <button onClick={generateAiSummary} disabled={aiLoading}
                                        className="btn-primary btn-sm">
                                        {aiLoading
                                            ? <><i className="fi fi-rr-spinner animate-spin text-xs" /> Analyzing…</>
                                            : <><i className="fi fi-rr-magic-wand text-xs leading-none" /> {aiSummary ? 'Regenerate' : 'Generate Summary'}</>}
                                    </button>
                                </div>
                                {aiSummary ? (
                                    <div className="bg-white/80 backdrop-blur border border-violet-200 rounded-lg p-4 prose prose-sm max-w-none">
                                        <pre className="whitespace-pre-wrap text-sm text-surface-800 font-sans">{aiSummary}</pre>
                                    </div>
                                ) : (
                                    <p className="text-xs text-violet-700/80 italic">Click "Generate Summary" to extract themes, sentiment, and standout concerns from text responses.</p>
                                )}
                            </div>
                        </div>

                        {/* Per-question aggregate */}
                        {questions.map((q: any, qi: number) => {
                            const agg = aggregates[q.id];
                            if (!agg) return null;
                            return (
                                <div key={q.id} className="card">
                                    <div className="card-body">
                                        <div className="flex items-start gap-3 mb-3">
                                            <span className="font-mono text-xs font-bold text-surface-400 mt-0.5">Q{qi + 1}</span>
                                            <div className="flex-1">
                                                <h4 className="text-sm font-bold text-surface-900">{q.question_text}</h4>
                                                <p className="text-[10px] text-surface-400 mt-0.5 inline-flex items-center gap-1">
                                                    <span className="px-1.5 py-0.5 rounded bg-surface-100 font-bold uppercase tracking-wider">{q.question_type}</span>
                                                    <span>{agg.count} responses</span>
                                                </p>
                                            </div>
                                        </div>

                                        {/* Distribution chart for choice types */}
                                        {agg.distribution && (
                                            <div className="space-y-1.5">
                                                {Object.entries(agg.distribution).map(([opt, count]: any) => {
                                                    const pct = agg.count > 0 ? Math.round((count / agg.count) * 100) : 0;
                                                    return (
                                                        <div key={opt}>
                                                            <div className="flex items-center justify-between text-xs mb-0.5">
                                                                <span className="text-surface-700">{opt}</span>
                                                                <span className="font-mono font-bold text-surface-900">{count} <span className="text-surface-400">({pct}%)</span></span>
                                                            </div>
                                                            <div className="h-2 rounded-full bg-surface-100 overflow-hidden">
                                                                <div className="h-full bg-gradient-to-r from-indigo-500 to-indigo-400 rounded-full"
                                                                    style={{ width: `${pct}%` }} />
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        )}

                                        {/* Rating average */}
                                        {q.question_type === 'rating' && agg.avg !== null && (
                                            <div className="flex items-center gap-3 mt-2">
                                                <span className="text-xs text-surface-500">Average:</span>
                                                <span className="text-amber-500 text-xl leading-none">
                                                    {'★'.repeat(Math.round(agg.avg))}<span className="text-surface-200">{'★'.repeat((q.settings?.max ?? 5) - Math.round(agg.avg))}</span>
                                                </span>
                                                <span className="font-mono font-bold text-surface-900">{agg.avg} / {q.settings?.max ?? 5}</span>
                                            </div>
                                        )}

                                        {/* Number stats */}
                                        {q.question_type === 'number' && agg.avg !== null && (
                                            <div className="grid grid-cols-3 gap-3 mt-2">
                                                <NumStat label="Avg" value={agg.avg} />
                                                <NumStat label="Min" value={agg.min} />
                                                <NumStat label="Max" value={agg.max} />
                                            </div>
                                        )}

                                        {/* Text/textarea samples */}
                                        {agg.samples && (
                                            <ul className="space-y-1.5 max-h-64 overflow-y-auto pr-1">
                                                {agg.samples.length === 0 ? (
                                                    <li className="text-xs text-surface-400 italic">No text responses yet.</li>
                                                ) : agg.samples.map((s: string, i: number) => (
                                                    <li key={i} className="bg-surface-50 border border-surface-100 rounded-lg px-3 py-2 text-xs text-surface-700">
                                                        {s}
                                                    </li>
                                                ))}
                                            </ul>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </>
                )}

                {tab === 'individual' && (
                    <div className="grid grid-cols-1 lg:grid-cols-[300px_1fr] gap-4">
                        {/* Response list */}
                        <div className="card max-h-[600px] overflow-y-auto">
                            <div className="card-header">
                                <h3 className="text-sm font-bold text-surface-900">Responses</h3>
                            </div>
                            <ul className="divide-y divide-surface-100">
                                {responses.length === 0 ? (
                                    <li className="px-5 py-8 text-center text-xs text-surface-400">No responses yet.</li>
                                ) : responses.map((r: any) => (
                                    <li key={r.id}>
                                        <button onClick={() => setSelectedResponse(r)}
                                            className={`w-full text-left px-4 py-3 hover:bg-surface-50 transition-colors ${selectedResponse?.id === r.id ? 'bg-indigo-50' : ''}`}>
                                            <div className="text-sm font-semibold text-surface-900 truncate">{r.display_name}</div>
                                            {r.organization && <div className="text-[10px] text-surface-400 mt-0.5 truncate">{r.organization}</div>}
                                            <div className="text-[10px] text-surface-400 mt-1">{r.submitted_at}</div>
                                        </button>
                                    </li>
                                ))}
                            </ul>
                        </div>

                        {/* Selected response */}
                        <div className="card">
                            {selectedResponse ? (
                                <>
                                    <div className="card-header">
                                        <h3 className="text-sm font-bold text-surface-900">{selectedResponse.display_name}</h3>
                                        <p className="text-[11px] text-surface-400 mt-0.5">
                                            {selectedResponse.organization && `${selectedResponse.organization} · `}
                                            Submitted {selectedResponse.submitted_at}
                                        </p>
                                    </div>
                                    <div className="card-body space-y-4">
                                        {questions.map((q: any, qi: number) => {
                                            const ans = selectedResponse.answers.find((a: any) => a.question_id === q.id);
                                            return (
                                                <div key={q.id}>
                                                    <div className="text-xs font-semibold text-surface-900 mb-1">
                                                        <span className="font-mono text-surface-400">Q{qi + 1}.</span> {q.question_text}
                                                    </div>
                                                    <div className="text-sm text-surface-700 pl-4 italic">
                                                        {q.question_type === 'checkbox' && ans?.answer_options
                                                            ? ans.answer_options.join(', ')
                                                            : ans?.answer_text || <span className="text-surface-300">(blank)</span>}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </>
                            ) : (
                                <div className="card-body text-center py-12 text-xs text-surface-400">
                                    Select a response from the list to view details.
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </AppLayout>
    );
}

function SmallStat({ label, value, color = 'slate' }: any) {
    const colors: Record<string, string> = {
        slate:   'text-surface-700',
        amber:   'text-amber-600',
        emerald: 'text-emerald-600',
        indigo:  'text-indigo-600',
    };
    return (
        <div>
            <div className="text-[10px] uppercase tracking-wider font-bold text-surface-400">{label}</div>
            <div className={`font-bold text-xl ${colors[color]} mt-0.5 font-mono`}>{value}</div>
        </div>
    );
}

function NumStat({ label, value }: any) {
    return (
        <div className="bg-surface-50 rounded-lg p-3 text-center">
            <div className="text-[10px] uppercase tracking-wider font-bold text-surface-400">{label}</div>
            <div className="font-bold text-lg text-surface-900 mt-0.5 font-mono">{value}</div>
        </div>
    );
}
