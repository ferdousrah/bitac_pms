import { useForm, usePage } from '@inertiajs/react';
import { FormEvent, useState } from 'react';

interface Question {
    id: number;
    section_id: number | null;
    question_text: string;
    help_text?: string;
    question_type: string;
    options: string[];
    settings: any;
    is_required: boolean;
}

interface Section {
    id: number;
    title: string;
    description?: string;
}

export default function StakeholderFormFill({ form, sections, questions, token, invitation }: any) {
    const { props } = usePage<any>();
    const theme = (props.appSettings ?? {}) as { logo_url?: string | null; brand_name?: string };
    const brandName = theme.brand_name || 'BITAC';

    const [answers, setAnswers] = useState<Record<number, { text?: string; options?: string[] }>>({});
    const [anonName, setAnonName] = useState('');
    const [anonOrg, setAnonOrg] = useState('');

    const { post, processing, errors } = useForm<any>({});

    const setAnswerText = (qid: number, text: string) => {
        setAnswers(prev => ({ ...prev, [qid]: { ...prev[qid], text } }));
    };
    const toggleOption = (qid: number, opt: string) => {
        setAnswers(prev => {
            const current = prev[qid]?.options ?? [];
            const next = current.includes(opt) ? current.filter(o => o !== opt) : [...current, opt];
            return { ...prev, [qid]: { ...prev[qid], options: next } };
        });
    };

    const sectionGroups: Array<{ section: Section | null; questions: Question[] }> = [];
    sections.forEach((s: Section) => {
        sectionGroups.push({
            section: s,
            questions: questions.filter((q: Question) => q.section_id === s.id),
        });
    });
    const orphanQuestions = questions.filter((q: Question) => q.section_id === null);
    if (orphanQuestions.length > 0) {
        sectionGroups.push({ section: null, questions: orphanQuestions });
    }

    const submit = (e: FormEvent) => {
        e.preventDefault();
        const payload = {
            answers: questions.map((q: Question) => ({
                question_id: q.id,
                text: answers[q.id]?.text ?? null,
                options: answers[q.id]?.options ?? null,
            })),
            anonymous_name: anonName,
            anonymous_organization: anonOrg,
        };
        post(`/stakeholder-form/${token}`, payload as any);
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-surface-50 via-surface-100 to-surface-50">
            {/* Brand header */}
            <div className="bg-white border-b border-surface-100">
                <div className="max-w-3xl mx-auto px-4 sm:px-6 py-4 flex items-center gap-3">
                    {theme.logo_url ? (
                        <img src={theme.logo_url} alt={brandName} className="w-11 h-11 object-contain" />
                    ) : (
                        <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-brand-400 to-brand-600 text-white flex items-center justify-center shadow-md">
                            <span className="font-bold text-base">B</span>
                        </div>
                    )}
                    <div className="leading-tight">
                        <p className="font-bold text-surface-900 text-[15px]">{brandName}</p>
                        <p className="text-[11px] text-surface-400">Bangladesh Industrial Technical Assistance Centre</p>
                    </div>
                </div>
            </div>

            <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
                {/* Title + intro */}
                <div className="text-center mb-8">
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-50 text-indigo-700 text-xs font-bold uppercase tracking-wider mb-3">
                        <i className="fi fi-rr-form text-xs leading-none" /> Stakeholder Consultation · {form.year}
                    </div>
                    <h1 className="text-2xl sm:text-3xl font-bold text-surface-900">{form.title}</h1>
                    {form.description && <p className="text-sm text-surface-500 mt-3 max-w-2xl mx-auto">{form.description}</p>}
                    {invitation && (
                        <div className="mt-4 inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-emerald-50 text-emerald-700 text-xs">
                            <i className="fi fi-rr-check-circle text-xs leading-none" />
                            Filling as <strong className="ml-1">{invitation.name}</strong>{invitation.organization && ` · ${invitation.organization}`}
                        </div>
                    )}
                </div>

                {Object.keys(errors).length > 0 && (
                    <div className="rounded-xl bg-rose-50 border border-rose-200 p-4 mb-6">
                        <ul className="text-xs text-rose-700 space-y-1">
                            {Object.values(errors).map((e, i) => <li key={i}>• {e as any}</li>)}
                        </ul>
                    </div>
                )}

                <form onSubmit={submit} className="space-y-4">

                    {/* Anonymous identity block */}
                    {!invitation && form.allow_anonymous && (
                        <div className="card bg-amber-50/40 border-amber-200">
                            <div className="card-body">
                                <h3 className="text-sm font-bold text-amber-900">Optional: Identify yourself</h3>
                                <p className="text-[11px] text-amber-700/80 mt-0.5 mb-3">Leave blank to submit anonymously.</p>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    <input type="text" value={anonName} onChange={e => setAnonName(e.target.value)}
                                        placeholder="Your name (optional)" className="form-input" />
                                    <input type="text" value={anonOrg} onChange={e => setAnonOrg(e.target.value)}
                                        placeholder="Your organisation (optional)" className="form-input" />
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Sections */}
                    {sectionGroups.map((group, gi) => (
                        <div key={gi} className="card">
                            {group.section && (
                                <div className="card-header bg-indigo-50/40">
                                    <h3 className="text-sm font-bold text-indigo-900">{group.section.title}</h3>
                                    {group.section.description && <p className="text-[11px] text-indigo-700/80 mt-0.5">{group.section.description}</p>}
                                </div>
                            )}
                            <div className="card-body space-y-5">
                                {group.questions.map((q: Question, qi: number) => (
                                    <QuestionField key={q.id} question={q} index={qi + 1}
                                        value={answers[q.id]}
                                        onTextChange={(v: string) => setAnswerText(q.id, v)}
                                        onOptionToggle={(opt: string) => toggleOption(q.id, opt)} />
                                ))}
                            </div>
                        </div>
                    ))}

                    <div className="card">
                        <div className="card-body flex items-center justify-between gap-3">
                            <p className="text-xs text-surface-500">Once submitted, your response cannot be edited.</p>
                            <button type="submit" disabled={processing} className="btn-primary">
                                {processing
                                    ? <><i className="fi fi-rr-spinner animate-spin text-sm" /> Submitting…</>
                                    : <><i className="fi fi-rr-paper-plane text-sm" /> Submit Response</>}
                            </button>
                        </div>
                    </div>
                </form>
            </div>

            <footer className="bg-white border-t border-surface-100 mt-8">
                <div className="max-w-3xl mx-auto px-4 sm:px-6 py-5 text-xs text-surface-500 text-center">
                    &copy; {new Date().getFullYear()} <span className="font-semibold">Bangladesh Industrial Technical Assistance Centre</span> · Ministry of Industries, GoB
                </div>
            </footer>
        </div>
    );
}

function QuestionField({ question, index, value, onTextChange, onOptionToggle }: any) {
    const q = question as Question;
    const v = value as { text?: string; options?: string[] } | undefined;

    return (
        <div>
            <label className="flex items-start gap-2 mb-2">
                <span className="font-mono text-xs font-bold text-surface-400 mt-0.5 shrink-0">{index}.</span>
                <span className="text-sm font-semibold text-surface-900">
                    {q.question_text}
                    {q.is_required && <span className="text-rose-500 ml-1">*</span>}
                </span>
            </label>
            {q.help_text && <p className="text-[11px] text-surface-500 ml-5 mb-2 italic">{q.help_text}</p>}

            <div className="ml-5">
                {q.question_type === 'text' && (
                    <input type="text" value={v?.text ?? ''} onChange={e => onTextChange(e.target.value)}
                        className="form-input" required={q.is_required} />
                )}
                {q.question_type === 'textarea' && (
                    <textarea value={v?.text ?? ''} onChange={e => onTextChange(e.target.value)}
                        rows={4} className="form-textarea" required={q.is_required} />
                )}
                {q.question_type === 'date' && (
                    <input type="date" value={v?.text ?? ''} onChange={e => onTextChange(e.target.value)}
                        className="form-input w-auto" required={q.is_required} />
                )}
                {q.question_type === 'number' && (
                    <input type="number" value={v?.text ?? ''} onChange={e => onTextChange(e.target.value)}
                        className="form-input w-auto font-mono" required={q.is_required} />
                )}
                {q.question_type === 'yes_no' && (
                    <div className="flex items-center gap-4 text-sm">
                        <label className="flex items-center gap-1.5 cursor-pointer">
                            <input type="radio" name={`q${q.id}`} checked={v?.text === 'yes'}
                                onChange={() => onTextChange('yes')} className="form-radio" />
                            Yes
                        </label>
                        <label className="flex items-center gap-1.5 cursor-pointer">
                            <input type="radio" name={`q${q.id}`} checked={v?.text === 'no'}
                                onChange={() => onTextChange('no')} className="form-radio" />
                            No
                        </label>
                    </div>
                )}
                {q.question_type === 'rating' && (
                    <div className="flex items-center gap-1">
                        {Array.from({ length: q.settings?.max ?? 5 }).map((_, i) => (
                            <button key={i} type="button"
                                onClick={() => onTextChange(String(i + 1))}
                                className="text-2xl leading-none transition-transform hover:scale-110">
                                <span className={parseInt(v?.text ?? '0') > i ? 'text-amber-400' : 'text-surface-200'}>★</span>
                            </button>
                        ))}
                        {v?.text && <span className="ml-3 text-xs text-surface-500 font-mono">{v.text}/{q.settings?.max ?? 5}</span>}
                    </div>
                )}
                {q.question_type === 'radio' && (
                    <div className="space-y-1.5">
                        {q.options.map((opt, oi) => (
                            <label key={oi} className="flex items-center gap-2 cursor-pointer text-sm hover:bg-surface-50/50 py-1 px-2 rounded">
                                <input type="radio" name={`q${q.id}`} checked={v?.text === opt}
                                    onChange={() => onTextChange(opt)} className="form-radio" />
                                {opt}
                            </label>
                        ))}
                    </div>
                )}
                {q.question_type === 'dropdown' && (
                    <select value={v?.text ?? ''} onChange={e => onTextChange(e.target.value)}
                        className="form-select" required={q.is_required}>
                        <option value="">— Select —</option>
                        {q.options.map((opt, oi) => <option key={oi} value={opt}>{opt}</option>)}
                    </select>
                )}
                {q.question_type === 'checkbox' && (
                    <div className="space-y-1.5">
                        {q.options.map((opt, oi) => (
                            <label key={oi} className="flex items-center gap-2 cursor-pointer text-sm hover:bg-surface-50/50 py-1 px-2 rounded">
                                <input type="checkbox" checked={(v?.options ?? []).includes(opt)}
                                    onChange={() => onOptionToggle(opt)} className="form-checkbox" />
                                {opt}
                            </label>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
