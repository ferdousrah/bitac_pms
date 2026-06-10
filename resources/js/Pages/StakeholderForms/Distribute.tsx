import AppLayout from '@/Layouts/AppLayout';
import { Link, router } from '@inertiajs/react';
import { useMemo, useState } from 'react';

const CATEGORY_LABEL: Record<string, string> = {
    govt_ministry:     'Government / Ministry',
    industry_customer: 'Industry Customer',
    academic:          'Academic Partner',
    industry_body:     'Industry Body',
    internal:          'Internal',
    other:             'Other',
};

export default function Distribute({ form, stakeholders, invited, publicUrl }: any) {
    const [selected, setSelected] = useState<Set<number>>(new Set());
    const [filter, setFilter] = useState('');
    const [categoryFilter, setCategoryFilter] = useState('');
    const [linkCopied, setLinkCopied] = useState(false);

    const invitedIds = useMemo(() => new Set<number>(invited.map((i: any) => i.stakeholder_id)), [invited]);

    const filtered = useMemo(() => stakeholders.filter((s: any) => {
        if (categoryFilter && s.category !== categoryFilter) return false;
        if (filter && !`${s.name} ${s.email} ${s.organization ?? ''}`.toLowerCase().includes(filter.toLowerCase())) return false;
        return true;
    }), [stakeholders, filter, categoryFilter]);

    const toggle = (id: number) => {
        const next = new Set(selected);
        next.has(id) ? next.delete(id) : next.add(id);
        setSelected(next);
    };

    const toggleAll = () => {
        if (selected.size === filtered.length) setSelected(new Set());
        else setSelected(new Set(filtered.map((s: any) => s.id)));
    };

    const sendInvites = () => {
        if (selected.size === 0) return alert('Please pick at least one stakeholder.');
        const newOnes = Array.from(selected).filter(id => !invitedIds.has(id));
        const reinvites = Array.from(selected).filter(id => invitedIds.has(id));
        const msg = reinvites.length > 0
            ? `Send to ${newOnes.length} new stakeholder(s) + ${reinvites.length} already invited (resend)?`
            : `Send invitations to ${selected.size} stakeholder(s)?`;
        if (!confirm(msg)) return;

        router.post(`/ied/stakeholder-forms/${form.id}/distribute`, {
            stakeholder_ids: Array.from(selected),
        } as any, {
            onSuccess: () => setSelected(new Set()),
        });
    };

    const sendReminders = () => {
        const pending = invited.filter((i: any) => !i.completed_at);
        if (pending.length === 0) return alert('No pending invites to remind.');
        if (!confirm(`Send reminder to ${pending.length} stakeholder(s) who haven't responded?`)) return;
        router.post(`/ied/stakeholder-forms/${form.id}/remind`);
    };

    const copyLink = () => {
        if (!publicUrl) return;
        navigator.clipboard.writeText(publicUrl);
        setLinkCopied(true);
        setTimeout(() => setLinkCopied(false), 2000);
    };

    return (
        <AppLayout header={`Distribute — ${form.title}`}>
            <div className="space-y-4 animate-fade-in">

                <Link href="/ied/stakeholder-forms" className="text-xs text-surface-500 hover:text-brand-600 inline-flex items-center gap-1">
                    <i className="fi fi-rr-arrow-left text-[10px] leading-none" /> Back to forms
                </Link>

                {/* Public link card */}
                {publicUrl && (
                    <div className="card border-indigo-200 bg-indigo-50/40">
                        <div className="card-body flex flex-col sm:flex-row sm:items-center gap-3">
                            <div className="flex items-center gap-3 flex-1 min-w-0">
                                <div className="w-10 h-10 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center shrink-0">
                                    <i className="fi fi-rr-link text-base leading-none" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <h3 className="text-sm font-bold text-indigo-900">Public Shareable Link</h3>
                                    <p className="text-[11px] text-indigo-700/80 mt-0.5 break-all font-mono">{publicUrl}</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                                <button onClick={copyLink} className="btn-outline btn-sm">
                                    {linkCopied ? <><i className="fi fi-rr-check text-xs leading-none" /> Copied!</> : <><i className="fi fi-rr-copy text-xs leading-none" /> Copy</>}
                                </button>
                                <a href={publicUrl} target="_blank" rel="noreferrer" className="btn-ghost btn-sm">
                                    <i className="fi fi-rr-eye text-xs leading-none" /> Open
                                </a>
                            </div>
                        </div>
                    </div>
                )}

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

                    {/* LEFT — picker (2 cols) */}
                    <div className="lg:col-span-2 card">
                        <div className="card-header flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                            <div>
                                <h3 className="text-sm font-bold text-surface-900">Send Invitations</h3>
                                <p className="text-[11px] text-surface-400 mt-0.5">Pick stakeholders to send a personalised invite email.</p>
                            </div>
                            <div className="flex items-center gap-2">
                                <Link href="/ied/stakeholders" className="text-[11px] font-semibold text-brand-600 hover:underline inline-flex items-center gap-1">
                                    Manage directory <i className="fi fi-rr-arrow-right text-[10px] leading-none" />
                                </Link>
                            </div>
                        </div>

                        <div className="card-body border-b border-surface-100 flex flex-wrap items-center gap-2">
                            <input type="text" value={filter} onChange={e => setFilter(e.target.value)}
                                placeholder="Filter by name / email / org…"
                                className="form-input text-xs flex-1 min-w-[180px]" />
                            <select value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)} className="form-select text-xs w-auto">
                                <option value="">All categories</option>
                                {Object.entries(CATEGORY_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                            </select>
                            <span className="text-[11px] text-surface-500 ml-auto">
                                <strong className="text-surface-900">{selected.size}</strong> selected / {filtered.length} shown
                            </span>
                        </div>

                        <div className="card-body p-0 max-h-[500px] overflow-y-auto">
                            <table className="premium-table">
                                <thead>
                                    <tr>
                                        <th className="w-8">
                                            <input type="checkbox"
                                                checked={selected.size > 0 && selected.size === filtered.length}
                                                onChange={toggleAll}
                                                className="form-checkbox" />
                                        </th>
                                        <th>Name / Org</th>
                                        <th>Category</th>
                                        <th>Status</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filtered.map((s: any) => {
                                        const inv = invited.find((i: any) => i.stakeholder_id === s.id);
                                        return (
                                            <tr key={s.id}
                                                onClick={() => toggle(s.id)}
                                                className={`cursor-pointer ${selected.has(s.id) ? 'bg-indigo-50/50' : ''}`}>
                                                <td>
                                                    <input type="checkbox" checked={selected.has(s.id)}
                                                        onChange={() => toggle(s.id)}
                                                        className="form-checkbox" />
                                                </td>
                                                <td>
                                                    <div className="text-sm font-medium text-surface-900">{s.name}</div>
                                                    <div className="text-[10px] text-surface-400 mt-0.5">{s.email}{s.organization && ` · ${s.organization}`}</div>
                                                </td>
                                                <td className="text-xs text-surface-500">{CATEGORY_LABEL[s.category] ?? s.category}</td>
                                                <td>
                                                    {inv ? (
                                                        inv.completed_at ? <span className="badge badge-green">Responded</span>
                                                        : inv.opened_at  ? <span className="badge badge-amber">Opened</span>
                                                        : <span className="badge badge-blue">Sent</span>
                                                    ) : <span className="text-[10px] text-surface-400">Not invited</span>}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>

                        <div className="card-body border-t border-surface-100 flex items-center gap-2">
                            <button onClick={sendInvites} disabled={selected.size === 0} className="btn-primary btn-sm">
                                <i className="fi fi-rr-paper-plane text-xs leading-none" /> Send {selected.size > 0 && `(${selected.size})`}
                            </button>
                            <button onClick={sendReminders} className="btn-outline btn-sm">
                                <i className="fi fi-rr-bell text-xs leading-none" /> Send Reminders to Pending
                            </button>
                        </div>
                    </div>

                    {/* RIGHT — invitation tracker (1 col) */}
                    <div className="card">
                        <div className="card-header">
                            <h3 className="text-sm font-bold text-surface-900">Invited ({invited.length})</h3>
                            <p className="text-[11px] text-surface-400 mt-0.5">Response tracker</p>
                        </div>
                        <div className="card-body p-0 max-h-[600px] overflow-y-auto">
                            {invited.length === 0 ? (
                                <div className="px-5 py-8 text-center text-xs text-surface-400">
                                    No invitations sent yet.
                                </div>
                            ) : (
                                <ul className="divide-y divide-surface-100">
                                    {invited.map((i: any) => (
                                        <li key={i.id} className="px-4 py-3">
                                            <div className="flex items-start justify-between gap-2">
                                                <div className="min-w-0 flex-1">
                                                    <div className="text-sm font-semibold text-surface-900 truncate">{i.name}</div>
                                                    <div className="text-[10px] text-surface-400 mt-0.5 truncate">{i.email}</div>
                                                </div>
                                                {i.completed_at ? (
                                                    <span className="badge badge-green text-[9px] shrink-0">Done</span>
                                                ) : i.opened_at ? (
                                                    <span className="badge badge-amber text-[9px] shrink-0">Opened</span>
                                                ) : (
                                                    <span className="badge badge-blue text-[9px] shrink-0">Sent</span>
                                                )}
                                            </div>
                                            <div className="text-[10px] text-surface-400 mt-1">
                                                Sent {i.sent_at ?? '—'}
                                                {i.completed_at && ` · Responded ${i.completed_at}`}
                                            </div>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </div>
                    </div>
                </div>

                <div className="flex items-center justify-end gap-2">
                    <Link href={`/ied/stakeholder-forms/${form.id}/responses`} className="btn-primary">
                        View Responses <i className="fi fi-rr-arrow-right text-xs leading-none" />
                    </Link>
                </div>
            </div>
        </AppLayout>
    );
}
