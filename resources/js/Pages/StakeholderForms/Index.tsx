import AppLayout from '@/Layouts/AppLayout';
import { Link, router, useForm } from '@inertiajs/react';
import { FormEvent, useState } from 'react';

const STATUS_BADGE: Record<string, string> = {
    draft:     'bg-slate-50 text-slate-600 border-slate-200',
    published: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    closed:    'bg-rose-50 text-rose-700 border-rose-200',
};

export default function StakeholderFormsIndex({ forms }: any) {
    const [showCreate, setShowCreate] = useState(false);
    const createForm = useForm({
        title: '',
        description: '',
        year: new Date().getFullYear(),
        allow_anonymous: false,
        allow_public_link: true,
        opens_at: '',
        closes_at: '',
    });

    const submit = (e: FormEvent) => {
        e.preventDefault();
        createForm.post('/ied/stakeholder-forms', { onSuccess: () => setShowCreate(false) });
    };

    const remove = (id: number, title: string) => {
        if (!confirm(`Delete "${title}"?\n\nAll associated questions, responses and invitations will be removed.`)) return;
        router.delete(`/ied/stakeholder-forms/${id}`);
    };

    const rows = forms?.data ?? [];

    return (
        <AppLayout header="Stakeholder Forms">
            <div className="space-y-6 animate-fade-in">

                <div className="card">
                    <div className="card-header flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                        <div>
                            <h2 className="text-sm font-bold text-surface-900">Stakeholder Consultation Forms</h2>
                            <p className="text-xs text-surface-400 mt-0.5">
                                Build yearly questionnaires for BITAC's stakeholder meetings — government, industry, academic partners.
                            </p>
                        </div>
                        <div className="flex items-center gap-2">
                            <Link href="/ied/stakeholders" className="btn-outline btn-sm">
                                <i className="fi fi-rr-users text-xs leading-none" /> Stakeholders
                            </Link>
                            <button onClick={() => setShowCreate(true)} className="btn-primary btn-sm">
                                <i className="fi fi-rr-plus text-xs leading-none" /> New Form
                            </button>
                        </div>
                    </div>

                    <div className="card-body p-0 overflow-x-auto">
                        <table className="premium-table">
                            <thead>
                                <tr>
                                    <th>Title</th>
                                    <th className="text-center">Year</th>
                                    <th>Status</th>
                                    <th className="text-center">Questions</th>
                                    <th className="text-center">Invitations</th>
                                    <th className="text-center">Responses</th>
                                    <th className="text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {rows.map((f: any) => (
                                    <tr key={f.id}>
                                        <td>
                                            <Link href={`/ied/stakeholder-forms/${f.id}/edit`} className="font-semibold text-brand-600 hover:underline">
                                                {f.title}
                                            </Link>
                                            <div className="text-[10px] text-surface-400 mt-0.5">by {f.created_by} · {f.created_at}</div>
                                        </td>
                                        <td className="text-center font-mono text-surface-700">{f.year}</td>
                                        <td>
                                            <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider border ${STATUS_BADGE[f.status]}`}>
                                                {f.status}
                                            </span>
                                        </td>
                                        <td className="text-center font-mono text-sm text-surface-700">{f.questions_count}</td>
                                        <td className="text-center font-mono text-sm text-surface-700">{f.invitations_count}</td>
                                        <td className="text-center">
                                            <span className="font-mono font-bold text-emerald-600">{f.responses_count}</span>
                                            {f.invitations_count > 0 && (
                                                <span className="text-[10px] text-surface-400">/{f.invitations_count}</span>
                                            )}
                                        </td>
                                        <td className="text-right">
                                            <div className="flex items-center justify-end gap-1">
                                                <Link href={`/ied/stakeholder-forms/${f.id}/edit`} className="btn-ghost btn-xs" title="Edit / builder">
                                                    <i className="fi fi-rr-pencil text-[10px] leading-none" />
                                                </Link>
                                                {f.status === 'published' && (
                                                    <Link href={`/ied/stakeholder-forms/${f.id}/distribute`} className="btn-ghost btn-xs" title="Distribute">
                                                        <i className="fi fi-rr-paper-plane text-[10px] leading-none" />
                                                    </Link>
                                                )}
                                                <Link href={`/ied/stakeholder-forms/${f.id}/responses`} className="btn-ghost btn-xs" title="Responses">
                                                    <i className="fi fi-rr-chart-pie text-[10px] leading-none" />
                                                </Link>
                                                <button onClick={() => remove(f.id, f.title)} className="btn-ghost btn-xs text-red-600 hover:text-red-700" title="Delete">
                                                    <i className="fi fi-rr-trash text-[10px] leading-none" />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                                {rows.length === 0 && (
                                    <tr>
                                        <td colSpan={7}>
                                            <div className="empty-state">
                                                <div className="empty-state-icon"><i className="fi fi-rr-form" /></div>
                                                <p className="empty-state-title">No forms yet</p>
                                                <p className="empty-state-text">Create your first stakeholder consultation form.</p>
                                                <div className="mt-4">
                                                    <button onClick={() => setShowCreate(true)} className="btn-primary btn-sm">
                                                        <i className="fi fi-rr-plus text-xs leading-none" /> Create First Form
                                                    </button>
                                                </div>
                                            </div>
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            {/* Create form modal */}
            {showCreate && (
                <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/60 backdrop-blur-sm p-4 sm:p-8 animate-fade-in"
                    onClick={() => setShowCreate(false)}>
                    <div className="w-full max-w-xl bg-white rounded-2xl shadow-2xl animate-scale-in origin-top" onClick={e => e.stopPropagation()}>
                        <div className="px-5 py-4 border-b border-surface-100 flex items-center justify-between">
                            <h3 className="text-sm font-bold text-surface-900">New Stakeholder Form</h3>
                            <button onClick={() => setShowCreate(false)} type="button" className="btn-ghost btn-icon">
                                <i className="fi fi-rr-cross-small text-sm leading-none" />
                            </button>
                        </div>
                        <form onSubmit={submit} className="p-5 space-y-3">
                            <div className="form-group">
                                <label className="form-label">Title <span className="text-red-500">*</span></label>
                                <input type="text" value={createForm.data.title}
                                    onChange={e => createForm.setData('title', e.target.value)}
                                    placeholder="e.g. Annual Stakeholder Consultation 2026"
                                    className="form-input" required />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Description</label>
                                <textarea value={createForm.data.description}
                                    onChange={e => createForm.setData('description', e.target.value)}
                                    rows={2} placeholder="Optional intro shown above the questions"
                                    className="form-textarea" />
                            </div>
                            <div className="grid grid-cols-3 gap-3">
                                <div className="form-group">
                                    <label className="form-label">Year</label>
                                    <input type="number" value={createForm.data.year}
                                        onChange={e => createForm.setData('year', parseInt(e.target.value))}
                                        className="form-input font-mono" />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Opens</label>
                                    <input type="datetime-local" value={createForm.data.opens_at}
                                        onChange={e => createForm.setData('opens_at', e.target.value)}
                                        className="form-input" />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Closes</label>
                                    <input type="datetime-local" value={createForm.data.closes_at}
                                        onChange={e => createForm.setData('closes_at', e.target.value)}
                                        className="form-input" />
                                </div>
                            </div>
                            <div className="space-y-2 pt-1">
                                <label className="flex items-center gap-2 text-xs text-surface-700">
                                    <input type="checkbox" checked={createForm.data.allow_public_link}
                                        onChange={e => createForm.setData('allow_public_link', e.target.checked)}
                                        className="form-checkbox" />
                                    Allow public shareable link (anyone with the link can fill)
                                </label>
                                <label className="flex items-center gap-2 text-xs text-surface-700">
                                    <input type="checkbox" checked={createForm.data.allow_anonymous}
                                        onChange={e => createForm.setData('allow_anonymous', e.target.checked)}
                                        className="form-checkbox" />
                                    Allow anonymous responses via the public link
                                </label>
                            </div>
                            <div className="flex items-center gap-2 pt-2">
                                <button type="submit" disabled={createForm.processing} className="btn-primary btn-sm">
                                    Create &amp; Open Builder
                                </button>
                                <button type="button" onClick={() => setShowCreate(false)} className="btn-ghost btn-sm">Cancel</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </AppLayout>
    );
}
