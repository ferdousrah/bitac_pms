import AppLayout from '@/Layouts/AppLayout';
import { Link, router, useForm } from '@inertiajs/react';
import { useState } from 'react';

interface Question {
    id?: number;
    section_index: number | null;
    question_text: string;
    help_text?: string;
    question_type: 'text' | 'textarea' | 'radio' | 'checkbox' | 'rating' | 'yes_no' | 'dropdown' | 'date' | 'number';
    options: string[];
    settings: any;
    is_required: boolean;
    sort_order: number;
}

interface Section {
    id?: number;
    title: string;
    description?: string;
    sort_order: number;
}

const QUESTION_TYPES = [
    { value: 'text',     label: 'Short Text',     icon: 'fi-rr-text', hint: 'Single-line answer' },
    { value: 'textarea', label: 'Long Text',      icon: 'fi-rr-align-left', hint: 'Multi-line / paragraph' },
    { value: 'radio',    label: 'Single Choice',  icon: 'fi-rr-circle-dashed', hint: 'Pick one from a list' },
    { value: 'checkbox', label: 'Multiple Choice',icon: 'fi-rr-checkbox', hint: 'Pick many from a list' },
    { value: 'rating',   label: 'Rating',         icon: 'fi-rr-star', hint: '1-5 or 1-10 stars/scale' },
    { value: 'yes_no',   label: 'Yes / No',       icon: 'fi-rr-check', hint: 'Boolean question' },
    { value: 'dropdown', label: 'Dropdown',       icon: 'fi-rr-angle-down', hint: 'Pick one from a long list' },
    { value: 'date',     label: 'Date',           icon: 'fi-rr-calendar', hint: 'Date picker' },
    { value: 'number',   label: 'Number',         icon: 'fi-rr-hashtag', hint: 'Numeric input' },
];

export default function StakeholderFormBuilder({ form, sections: initSections, questions: initQuestions }: any) {
    const isNew = !form;
    const [sections, setSections] = useState<Section[]>(initSections ?? []);
    const [questions, setQuestions] = useState<Question[]>((initQuestions ?? []).map((q: any, i: number) => ({
        ...q,
        section_index: q.section_id ? (initSections ?? []).findIndex((s: any) => s.id === q.section_id) : null,
        sort_order: q.sort_order ?? i,
    })));
    const [saving, setSaving] = useState(false);
    const [openSettings, setOpenSettings] = useState(false);

    if (isNew) {
        // Should never reach here — index modal creates the form first
        return <div>Redirecting…</div>;
    }

    const addSection = () => {
        setSections([...sections, { title: 'New Section', description: '', sort_order: sections.length }]);
    };
    const updateSection = (i: number, patch: Partial<Section>) => {
        setSections(sections.map((s, idx) => idx === i ? { ...s, ...patch } : s));
    };
    const removeSection = (i: number) => {
        setSections(sections.filter((_, idx) => idx !== i));
        // Clear section_index on questions that referenced it
        setQuestions(questions.map(q => q.section_index === i ? { ...q, section_index: null }
            : (q.section_index !== null && q.section_index > i ? { ...q, section_index: q.section_index - 1 } : q)));
    };

    const addQuestion = (type: Question['question_type']) => {
        const newQ: Question = {
            section_index: sections.length > 0 ? sections.length - 1 : null,
            question_text: '',
            help_text: '',
            question_type: type,
            options: ['radio','checkbox','dropdown'].includes(type) ? ['Option 1', 'Option 2'] : [],
            settings: type === 'rating' ? { max: 5 } : {},
            is_required: false,
            sort_order: questions.length,
        };
        setQuestions([...questions, newQ]);
    };

    const updateQuestion = (i: number, patch: Partial<Question>) => {
        setQuestions(questions.map((q, idx) => idx === i ? { ...q, ...patch } : q));
    };

    const removeQuestion = (i: number) => {
        setQuestions(questions.filter((_, idx) => idx !== i));
    };

    const moveQuestion = (i: number, dir: -1 | 1) => {
        const j = i + dir;
        if (j < 0 || j >= questions.length) return;
        const arr = [...questions];
        [arr[i], arr[j]] = [arr[j], arr[i]];
        setQuestions(arr.map((q, idx) => ({ ...q, sort_order: idx })));
    };

    const save = () => {
        setSaving(true);
        router.put(`/ied/stakeholder-forms/${form.id}/builder`, {
            sections, questions,
        } as any, {
            onFinish: () => setSaving(false),
            preserveScroll: true,
        });
    };

    const publish = () => {
        if (!confirm('Publish this form? Once published, you can distribute the link and start collecting responses.')) return;
        router.post(`/ied/stakeholder-forms/${form.id}/publish`, {}, { preserveScroll: true });
    };

    return (
        <AppLayout header={`Builder — ${form.title}`}>
            <div className="space-y-4 animate-fade-in">

                <div className="flex items-center justify-between gap-3 flex-wrap">
                    <div className="flex items-center gap-2">
                        <Link href="/ied/stakeholder-forms" className="text-xs text-surface-500 hover:text-brand-600 inline-flex items-center gap-1">
                            <i className="fi fi-rr-arrow-left text-[10px] leading-none" /> Back
                        </Link>
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider border ${
                            form.status === 'published' ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : form.status === 'closed' ? 'bg-rose-50 text-rose-700 border-rose-200'
                            : 'bg-slate-50 text-slate-600 border-slate-200'
                        }`}>{form.status}</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <button onClick={() => setOpenSettings(true)} className="btn-outline btn-sm">
                            <i className="fi fi-rr-settings text-xs leading-none" /> Settings
                        </button>
                        <button onClick={save} disabled={saving} className="btn-primary btn-sm">
                            {saving
                                ? <><i className="fi fi-rr-spinner animate-spin text-xs" /> Saving…</>
                                : <><i className="fi fi-rr-check text-xs leading-none" /> Save Form</>}
                        </button>
                        {form.status === 'draft' && (
                            <button onClick={publish} className="btn-success btn-sm">
                                <i className="fi fi-rr-paper-plane text-xs leading-none" /> Publish
                            </button>
                        )}
                        {form.status === 'published' && (
                            <Link href={`/ied/stakeholder-forms/${form.id}/distribute`} className="btn-success btn-sm">
                                <i className="fi fi-rr-paper-plane text-xs leading-none" /> Distribute
                            </Link>
                        )}
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-4">

                    {/* Left column — question type palette */}
                    <div className="card sticky top-4 self-start">
                        <div className="card-header">
                            <h3 className="text-sm font-bold text-surface-900">Add Question</h3>
                            <p className="text-[11px] text-surface-400 mt-0.5">Click a type to add</p>
                        </div>
                        <div className="card-body p-2 space-y-1">
                            {QUESTION_TYPES.map(qt => (
                                <button key={qt.value} type="button"
                                    onClick={() => addQuestion(qt.value as any)}
                                    className="w-full text-left px-3 py-2 rounded-lg hover:bg-surface-50 transition-colors flex items-center gap-2.5 group">
                                    <div className="w-7 h-7 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0 group-hover:bg-indigo-100">
                                        <i className={`fi ${qt.icon} text-xs leading-none`} />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="text-xs font-semibold text-surface-900">{qt.label}</div>
                                        <div className="text-[10px] text-surface-400 truncate">{qt.hint}</div>
                                    </div>
                                </button>
                            ))}
                            <hr className="my-2 border-surface-100" />
                            <button type="button" onClick={addSection}
                                className="w-full text-left px-3 py-2 rounded-lg hover:bg-amber-50 transition-colors flex items-center gap-2.5">
                                <div className="w-7 h-7 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
                                    <i className="fi fi-rr-layers text-xs leading-none" />
                                </div>
                                <div className="flex-1">
                                    <div className="text-xs font-semibold text-surface-900">Add Section</div>
                                    <div className="text-[10px] text-surface-400">Group related questions</div>
                                </div>
                            </button>
                        </div>
                    </div>

                    {/* Right column — the form */}
                    <div className="space-y-4">

                        {/* Form header card */}
                        <div className="card">
                            <div className="card-body">
                                <h2 className="text-xl font-bold text-surface-900">{form.title}</h2>
                                {form.description && <p className="text-sm text-surface-500 mt-1">{form.description}</p>}
                                <p className="text-[11px] text-surface-400 mt-2">Year {form.year} · {questions.length} question{questions.length !== 1 ? 's' : ''}{sections.length > 0 && ` · ${sections.length} section${sections.length !== 1 ? 's' : ''}`}</p>
                            </div>
                        </div>

                        {/* Sections render */}
                        {sections.map((sec, si) => (
                            <div key={si} className="card border-amber-200 bg-amber-50/30">
                                <div className="card-body">
                                    <div className="flex items-start gap-2">
                                        <i className="fi fi-rr-layers text-amber-600 text-base leading-none mt-1" />
                                        <div className="flex-1">
                                            <input type="text" value={sec.title}
                                                onChange={e => updateSection(si, { title: e.target.value })}
                                                placeholder="Section title"
                                                className="text-base font-bold text-surface-900 w-full bg-transparent border-0 outline-none focus:ring-0 px-0" />
                                            <input type="text" value={sec.description ?? ''}
                                                onChange={e => updateSection(si, { description: e.target.value })}
                                                placeholder="Section description (optional)"
                                                className="text-sm text-surface-500 w-full bg-transparent border-0 outline-none focus:ring-0 px-0 mt-1" />
                                        </div>
                                        <button onClick={() => removeSection(si)} className="text-amber-700 hover:text-rose-600">
                                            <i className="fi fi-rr-trash text-xs leading-none" />
                                        </button>
                                    </div>
                                </div>

                                {/* Questions in this section */}
                                {questions
                                    .map((q: Question, qi: number) => ({ q, qi }))
                                    .filter(({ q }: any) => q.section_index === si)
                                    .map(({ q, qi }: any) => (
                                        <QuestionCard key={qi} question={q} index={qi}
                                            sections={sections}
                                            onUpdate={(patch: Partial<Question>) => updateQuestion(qi, patch)}
                                            onRemove={() => removeQuestion(qi)}
                                            onMoveUp={() => moveQuestion(qi, -1)}
                                            onMoveDown={() => moveQuestion(qi, 1)} />
                                    ))}
                            </div>
                        ))}

                        {/* Section-less (orphan) questions */}
                        {questions
                            .map((q: Question, qi: number) => ({ q, qi }))
                            .filter(({ q }: any) => q.section_index === null)
                            .map(({ q, qi }: any) => (
                                <QuestionCard key={qi} question={q} index={qi}
                                    sections={sections}
                                    onUpdate={(patch: Partial<Question>) => updateQuestion(qi, patch)}
                                    onRemove={() => removeQuestion(qi)}
                                    onMoveUp={() => moveQuestion(qi, -1)}
                                    onMoveDown={() => moveQuestion(qi, 1)} />
                            ))}

                        {questions.length === 0 && sections.length === 0 && (
                            <div className="card">
                                <div className="empty-state">
                                    <div className="empty-state-icon"><i className="fi fi-rr-form" /></div>
                                    <p className="empty-state-title">Empty form</p>
                                    <p className="empty-state-text">Click a question type from the left panel to add your first question.</p>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Settings modal */}
            {openSettings && (
                <FormSettingsModal form={form} onClose={() => setOpenSettings(false)} />
            )}
        </AppLayout>
    );
}

/* ───────────────────────── Question card ───────────────────────── */
function QuestionCard({ question, index, sections, onUpdate, onRemove, onMoveUp, onMoveDown }: any) {
    const typeMeta = QUESTION_TYPES.find(t => t.value === question.question_type);
    const needsOptions = ['radio', 'checkbox', 'dropdown'].includes(question.question_type);

    return (
        <div className="card">
            <div className="card-body space-y-3">
                <div className="flex items-start gap-2">
                    <span className="font-mono text-xs font-bold text-surface-400 mt-1">Q{index + 1}</span>
                    <div className="flex-1 min-w-0">
                        <textarea value={question.question_text}
                            onChange={e => onUpdate({ question_text: e.target.value })}
                            placeholder="Question text"
                            rows={1}
                            className="w-full text-sm font-semibold text-surface-900 border-0 outline-none focus:ring-0 resize-none p-0 bg-transparent" />
                        <input type="text" value={question.help_text ?? ''}
                            onChange={e => onUpdate({ help_text: e.target.value })}
                            placeholder="Help text (optional)"
                            className="w-full text-xs text-surface-500 border-0 outline-none focus:ring-0 p-0 bg-transparent mt-1" />
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                        <button onClick={onMoveUp} className="text-surface-400 hover:text-surface-700" title="Move up">
                            <i className="fi fi-rr-angle-up text-xs leading-none" />
                        </button>
                        <button onClick={onMoveDown} className="text-surface-400 hover:text-surface-700" title="Move down">
                            <i className="fi fi-rr-angle-down text-xs leading-none" />
                        </button>
                        <button onClick={onRemove} className="text-rose-600 hover:text-rose-700" title="Remove">
                            <i className="fi fi-rr-trash text-xs leading-none" />
                        </button>
                    </div>
                </div>

                {/* Live preview by type */}
                <div className="pl-7">
                    {question.question_type === 'text' && <input type="text" disabled placeholder="Short text answer…" className="form-input bg-surface-50/50 text-xs" />}
                    {question.question_type === 'textarea' && <textarea disabled rows={2} placeholder="Long text answer…" className="form-textarea bg-surface-50/50 text-xs" />}
                    {question.question_type === 'date' && <input type="date" disabled className="form-input bg-surface-50/50 text-xs w-auto" />}
                    {question.question_type === 'number' && <input type="number" disabled placeholder="0" className="form-input bg-surface-50/50 text-xs w-auto" />}
                    {question.question_type === 'yes_no' && (
                        <div className="flex items-center gap-3 text-xs">
                            <label className="flex items-center gap-1.5"><input type="radio" disabled /> Yes</label>
                            <label className="flex items-center gap-1.5"><input type="radio" disabled /> No</label>
                        </div>
                    )}
                    {question.question_type === 'rating' && (
                        <div className="flex items-center gap-1">
                            {Array.from({ length: question.settings?.max ?? 5 }).map((_, i) => (
                                <i key={i} className="fi fi-rr-star text-surface-300 text-sm leading-none" />
                            ))}
                            <select value={question.settings?.max ?? 5}
                                onChange={e => onUpdate({ settings: { ...question.settings, max: parseInt(e.target.value) } })}
                                className="ml-3 form-select text-xs py-1 px-2 w-auto">
                                <option value={5}>1-5</option>
                                <option value={10}>1-10</option>
                            </select>
                        </div>
                    )}
                    {needsOptions && (
                        <div className="space-y-1">
                            {(question.options ?? []).map((opt: string, oi: number) => (
                                <div key={oi} className="flex items-center gap-2">
                                    <i className={`fi ${question.question_type === 'checkbox' ? 'fi-rr-square' : 'fi-rr-circle'} text-xs leading-none text-surface-300`} />
                                    <input type="text" value={opt}
                                        onChange={e => {
                                            const opts = [...question.options];
                                            opts[oi] = e.target.value;
                                            onUpdate({ options: opts });
                                        }}
                                        placeholder={`Option ${oi + 1}`}
                                        className="form-input text-xs py-1 flex-1" />
                                    <button type="button"
                                        onClick={() => onUpdate({ options: question.options.filter((_: any, i: number) => i !== oi) })}
                                        className="text-surface-400 hover:text-rose-600">
                                        <i className="fi fi-rr-cross-small text-xs leading-none" />
                                    </button>
                                </div>
                            ))}
                            <button type="button"
                                onClick={() => onUpdate({ options: [...(question.options ?? []), `Option ${question.options.length + 1}`] })}
                                className="text-[11px] text-brand-600 hover:text-brand-700 font-semibold inline-flex items-center gap-1 mt-1">
                                <i className="fi fi-rr-plus text-[10px] leading-none" /> Add option
                            </button>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between gap-2 pt-2 border-t border-surface-100">
                    <div className="flex items-center gap-3 text-[11px] text-surface-500">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 font-bold uppercase tracking-wider text-[9px]">
                            <i className={`fi ${typeMeta?.icon} text-[9px] leading-none`} /> {typeMeta?.label}
                        </span>
                        {sections.length > 0 && (
                            <select value={question.section_index ?? ''}
                                onChange={e => onUpdate({ section_index: e.target.value === '' ? null : parseInt(e.target.value) })}
                                className="form-select text-[11px] py-1 px-2 w-auto">
                                <option value="">No section</option>
                                {sections.map((s: Section, i: number) => <option key={i} value={i}>{s.title}</option>)}
                            </select>
                        )}
                    </div>
                    <label className="flex items-center gap-1.5 text-xs text-surface-600 cursor-pointer">
                        <input type="checkbox" checked={question.is_required}
                            onChange={e => onUpdate({ is_required: e.target.checked })}
                            className="form-checkbox" />
                        Required
                    </label>
                </div>
            </div>
        </div>
    );
}

/* ───────────────────────── Settings modal ───────────────────────── */
function FormSettingsModal({ form, onClose }: any) {
    const settingsForm = useForm({
        title: form.title,
        description: form.description ?? '',
        year: form.year,
        allow_anonymous: form.allow_anonymous,
        allow_public_link: form.allow_public_link,
        opens_at: form.opens_at ?? '',
        closes_at: form.closes_at ?? '',
    });

    const submit = (e: any) => {
        e.preventDefault();
        settingsForm.put(`/ied/stakeholder-forms/${form.id}`, { onSuccess: onClose });
    };

    return (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/60 backdrop-blur-sm p-4 sm:p-8 animate-fade-in" onClick={onClose}>
            <div className="w-full max-w-xl bg-white rounded-2xl shadow-2xl animate-scale-in origin-top" onClick={e => e.stopPropagation()}>
                <div className="px-5 py-4 border-b border-surface-100 flex items-center justify-between">
                    <h3 className="text-sm font-bold text-surface-900">Form Settings</h3>
                    <button onClick={onClose} className="btn-ghost btn-icon"><i className="fi fi-rr-cross-small text-sm leading-none" /></button>
                </div>
                <form onSubmit={submit} className="p-5 space-y-3">
                    <div className="form-group">
                        <label className="form-label">Title</label>
                        <input type="text" value={settingsForm.data.title} onChange={e => settingsForm.setData('title', e.target.value)} className="form-input" />
                    </div>
                    <div className="form-group">
                        <label className="form-label">Description</label>
                        <textarea value={settingsForm.data.description} onChange={e => settingsForm.setData('description', e.target.value)} rows={2} className="form-textarea" />
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                        <div className="form-group">
                            <label className="form-label">Year</label>
                            <input type="number" value={settingsForm.data.year} onChange={e => settingsForm.setData('year', parseInt(e.target.value))} className="form-input font-mono" />
                        </div>
                        <div className="form-group">
                            <label className="form-label">Opens</label>
                            <input type="datetime-local" value={settingsForm.data.opens_at} onChange={e => settingsForm.setData('opens_at', e.target.value)} className="form-input" />
                        </div>
                        <div className="form-group">
                            <label className="form-label">Closes</label>
                            <input type="datetime-local" value={settingsForm.data.closes_at} onChange={e => settingsForm.setData('closes_at', e.target.value)} className="form-input" />
                        </div>
                    </div>
                    <label className="flex items-center gap-2 text-xs">
                        <input type="checkbox" checked={settingsForm.data.allow_public_link} onChange={e => settingsForm.setData('allow_public_link', e.target.checked)} className="form-checkbox" />
                        Allow public shareable link
                    </label>
                    <label className="flex items-center gap-2 text-xs">
                        <input type="checkbox" checked={settingsForm.data.allow_anonymous} onChange={e => settingsForm.setData('allow_anonymous', e.target.checked)} className="form-checkbox" />
                        Allow anonymous responses
                    </label>
                    <div className="flex items-center gap-2 pt-2">
                        <button type="submit" disabled={settingsForm.processing} className="btn-primary btn-sm">Save</button>
                        <button type="button" onClick={onClose} className="btn-ghost btn-sm">Cancel</button>
                    </div>
                </form>
            </div>
        </div>
    );
}
