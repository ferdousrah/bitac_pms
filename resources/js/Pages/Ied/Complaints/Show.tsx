import AppLayout from '@/Layouts/AppLayout';
import { Link, router, useForm } from '@inertiajs/react';
import { useEffect, useRef, useState } from 'react';
import axios from 'axios';
import SearchableSelect from '@/Components/SearchableSelect';

const STATUS_BADGE: Record<string, string> = {
    open:                'badge-amber',
    in_review:           'badge-blue',
    accepted_for_rework: 'badge-rose',
    resolved:            'badge-green',
    closed:              'badge-slate',
};

const REWORK_STATUS_BADGE: Record<string, string> = {
    open:        'badge-amber',
    in_progress: 'badge-blue',
    completed:   'badge-green',
};

const CATEGORY_LABEL: Record<string, string> = {
    general: 'General Feedback',
    quality: 'Quality Issue',
    delivery: 'Delivery Issue',
    billing: 'Billing / Invoice Issue',
    other: 'Other',
};

export default function IedComplaintShow({ complaint, candidateSections = [], assignableUsers = [], currentUserId }: any) {
    const isAccepted = !!complaint.ncr;
    const isResolved = ['resolved', 'closed'].includes(complaint.status);
    const hasResponse = !!complaint.response;

    return (
        <AppLayout header={`Feedback / Compliment — ${complaint.reference_number}`}>
            <div className="space-y-6 animate-fade-in max-w-5xl">
                {/* Header */}
                <div className="card">
                    <div className="card-body">
                        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
                            <div className="min-w-0">
                                <div className="text-xs uppercase text-surface-400 font-semibold tracking-wide">Feedback / Compliment</div>
                                <h2 className="text-xl font-bold font-mono text-rose-600 mt-1">{complaint.reference_number}</h2>
                                <p className="text-surface-800 text-base font-semibold mt-2">{complaint.subject}</p>
                                <div className="flex flex-wrap items-center gap-3 mt-2 text-xs text-surface-500">
                                    <span><i className="fi fi-rr-tag-alt text-[10px]" /> {CATEGORY_LABEL[complaint.category] ?? complaint.category}</span>
                                    <span><i className="fi fi-rr-calendar text-[10px]" /> {complaint.created_at}</span>
                                    {complaint.affected_qty != null && complaint.total_qty != null && (
                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-rose-50 border border-rose-100 text-rose-700 font-semibold">
                                            <i className="fi fi-rr-triangle-warning text-[10px]" />
                                            {complaint.affected_qty} of {complaint.total_qty} defective
                                        </span>
                                    )}
                                </div>
                            </div>
                            <div className="flex flex-col items-end gap-2">
                                <span className={`badge ${STATUS_BADGE[complaint.status] ?? 'badge-slate'}`}>
                                    {String(complaint.status).replace(/_/g, ' ')}
                                </span>
                                {complaint.status === 'open' && (
                                    <button
                                        type="button"
                                        onClick={() => router.post(`/ied/complaints/${complaint.id}/status`, { status: 'in_review' }, { preserveScroll: true })}
                                        className="btn-outline btn-xs"
                                        title="Acknowledge the complaint and mark it for review (no response sent yet)"
                                    >
                                        <i className="fi fi-rr-time-check text-[10px]" /> Mark In Review
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Main column */}
                    <div className="lg:col-span-2 space-y-6">
                        {/* Customer message */}
                        <div className="card">
                            <div className="card-header">
                                <h3 className="text-sm font-bold text-surface-900">Customer's Message</h3>
                            </div>
                            <div className="card-body">
                                <div className="text-sm text-surface-800 whitespace-pre-line leading-relaxed bg-surface-50/70 border border-surface-100 rounded-xl px-4 py-3">
                                    {complaint.message}
                                </div>
                            </div>
                        </div>

                        {/* Rework banner — when complaint has been approved for rework */}
                        {isAccepted && (
                            <div className="card border-rose-300 overflow-hidden">
                                <div className="px-5 py-3 bg-gradient-to-r from-rose-500 to-rose-700 text-white flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <i className="fi fi-rr-refresh text-base leading-none" />
                                        <span className="text-sm font-bold uppercase tracking-wider">Approved for Rework</span>
                                    </div>
                                    <span className="text-[11px] text-white/90">{complaint.accepted_at}</span>
                                </div>
                                <div className="card-body space-y-3">
                                    <div className="text-sm">
                                        <span className="text-surface-500">Approved by:</span>{' '}
                                        <span className="font-semibold text-surface-900">{complaint.accepted_by ?? '—'}</span>
                                    </div>
                                    <div className="text-sm flex items-center gap-2">
                                        <span className="text-surface-500">Linked NCR:</span>
                                        <Link href={`/ncrs/${complaint.ncr.id}`} className="font-mono font-semibold text-rose-600 hover:underline">
                                            {complaint.ncr.ncr_number}
                                        </Link>
                                        <span className={`badge ${complaint.ncr.status === 'closed' ? 'badge-green' : 'badge-amber'} text-[10px]`}>
                                            {String(complaint.ncr.status).replace(/_/g, ' ')}
                                        </span>
                                    </div>
                                    {complaint.ncr.reworks.length > 0 && (
                                        <div>
                                            <div className="text-xs font-semibold text-surface-500 uppercase tracking-wider mb-2">Rework Orders</div>
                                            <div className="space-y-2">
                                                {complaint.ncr.reworks.map((r: any, i: number) => (
                                                    <div key={i} className="rounded-lg border border-rose-100 bg-white px-3 py-2 text-xs">
                                                        <div className="flex items-center justify-between gap-2">
                                                            <span className="font-mono font-semibold text-rose-700">{r.rework_number}</span>
                                                            <div className="flex items-center gap-2">
                                                                {r.section && (
                                                                    <span className="text-surface-700">{r.section.name} ({r.section.code})</span>
                                                                )}
                                                                <span className={`badge ${REWORK_STATUS_BADGE[r.status] ?? 'badge-slate'} text-[9px]`}>
                                                                    {String(r.status).replace(/_/g, ' ')}
                                                                </span>
                                                            </div>
                                                        </div>
                                                        {r.notes && <div className="text-surface-600 mt-1">{r.notes}</div>}
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                    {complaint.gate_pass && (
                                        <div className="rounded-xl bg-amber-50 border border-amber-200 px-3 py-2 text-xs">
                                            <div className="flex items-center justify-between gap-2">
                                                <div className="flex items-center gap-2">
                                                    <i className="fi fi-rr-shield-check text-amber-700 text-[11px]" />
                                                    <span className="text-amber-900">Gate-In Pass auto-issued for sample return:</span>
                                                    <Link href={`/ied/gate-passes/${complaint.gate_pass.id}`} className="font-mono font-semibold text-amber-800 hover:underline">
                                                        {complaint.gate_pass.pass_no}
                                                    </Link>
                                                </div>
                                                <span className="text-[10px] text-amber-700">{complaint.gate_pass.pass_date}</span>
                                            </div>
                                        </div>
                                    )}
                                    {complaint.rework_hours > 0 && (
                                        <div className="text-xs text-surface-600">
                                            <i className="fi fi-rr-clock text-[10px]" /> Actual rework hours logged: <b>{complaint.rework_hours}h</b>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* Existing response (no rework) */}
                        {hasResponse && !isAccepted && (
                            <div className="card border-emerald-300 overflow-hidden">
                                <div className="px-5 py-3 bg-gradient-to-r from-emerald-500 to-emerald-700 text-white flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <i className="fi fi-rr-comment-check text-base leading-none" />
                                        <span className="text-sm font-bold uppercase tracking-wider">Sent Response</span>
                                    </div>
                                    <span className="text-[11px] text-white/90">{complaint.responded_at}</span>
                                </div>
                                <div className="card-body">
                                    <div className="text-sm text-surface-800 whitespace-pre-line leading-relaxed">{complaint.response}</div>
                                    {complaint.responded_by && (
                                        <div className="text-[11px] text-surface-500 italic mt-2">— {complaint.responded_by}</div>
                                    )}
                                    {complaint.decision_emailed_at && (
                                        <div className="mt-3 pt-3 border-t border-emerald-100 text-[11px] text-emerald-700 inline-flex items-center gap-1">
                                            <i className="fi fi-rr-envelope-circle-check text-xs leading-none" />
                                            Emailed to customer on {complaint.decision_emailed_at}
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* Decision-makers panel */}
                        {!isResolved && (
                            <DecisionMakersCard
                                complaintId={complaint.id}
                                decisionMakers={complaint.decision_makers ?? []}
                                assignableUsers={assignableUsers}
                            />
                        )}

                        {/* Internal discussion stream */}
                        {!isResolved && (
                            <DiscussionStream
                                complaintId={complaint.id}
                                initialMessages={complaint.discussions ?? []}
                                currentUserId={currentUserId}
                            />
                        )}

                        {/* Action panels — only when not yet resolved */}
                        {!isAccepted && !isResolved && (
                            <div className="grid grid-cols-1 gap-6">
                                <ApproveReworkCard complaintId={complaint.id} candidateSections={candidateSections} hasWorkOrder={!!complaint.work_order} />
                                <FinalDecisionCard complaintId={complaint.id} initialResponse={complaint.response ?? ''} />
                            </div>
                        )}
                    </div>

                    {/* Sidebar */}
                    <aside className="space-y-6">
                        <div className="card">
                            <div className="card-header">
                                <h3 className="text-sm font-bold text-surface-900">Customer</h3>
                            </div>
                            <div className="card-body space-y-2 text-sm">
                                <div>
                                    <div className="text-xs font-semibold text-surface-400 uppercase tracking-wider">Name</div>
                                    <div className="font-semibold text-surface-900 mt-0.5">{complaint.customer?.name ?? '—'}</div>
                                </div>
                                {complaint.customer?.email && (
                                    <div>
                                        <div className="text-xs font-semibold text-surface-400 uppercase tracking-wider">Email</div>
                                        <a href={`mailto:${complaint.customer.email}`} className="text-brand-600 hover:underline">{complaint.customer.email}</a>
                                    </div>
                                )}
                                {complaint.customer?.phone && (
                                    <div>
                                        <div className="text-xs font-semibold text-surface-400 uppercase tracking-wider">Phone</div>
                                        <div className="text-surface-800 mt-0.5 font-mono">{complaint.customer.phone}</div>
                                    </div>
                                )}
                            </div>
                        </div>

                        {complaint.work_order && (
                            <div className="card">
                                <div className="card-header">
                                    <h3 className="text-sm font-bold text-surface-900">Related Job</h3>
                                </div>
                                <div className="card-body space-y-2 text-sm">
                                    <Link href={`/work-orders/${complaint.work_order.id}`} className="block">
                                        <div className="font-bold text-brand-600 hover:underline text-base">Job #{complaint.work_order.job_number ?? '—'}</div>
                                        <div className="text-[11px] text-surface-400 font-mono mt-0.5">{complaint.work_order.wo_number}</div>
                                    </Link>
                                    {complaint.work_order.product && <div className="text-surface-700 text-xs">{complaint.work_order.product}</div>}
                                    <div>
                                        <span className="badge badge-slate text-[10px]">{String(complaint.work_order.status).replace(/_/g, ' ')}</span>
                                    </div>
                                </div>
                            </div>
                        )}

                        <Link href="/ied/complaints" className="btn-outline btn-sm w-full justify-center">
                            <i className="fi fi-rr-arrow-left text-xs leading-none" /> All Complaints
                        </Link>
                    </aside>
                </div>
            </div>
        </AppLayout>
    );
}

/* ─── Approve for Rework ─────────────────────────────────────────── */
function ApproveReworkCard({ complaintId, candidateSections, hasWorkOrder }: any) {
    const form = useForm<{
        target_section_ids: number[];
        defect_summary: string;
        notes: Record<string, string>;
    }>({
        target_section_ids: [],
        defect_summary: '',
        notes: {},
    });
    const [confirm, setConfirm] = useState(false);

    const toggleSection = (id: number) => {
        const current = form.data.target_section_ids;
        const next = current.includes(id) ? current.filter(x => x !== id) : [...current, id];
        form.setData('target_section_ids', next);
        if (!next.includes(id)) {
            const { [String(id)]: _drop, ...rest } = form.data.notes;
            form.setData('notes', rest);
        }
    };

    const submit = (e: React.FormEvent) => {
        e.preventDefault();
        form.post(`/ied/complaints/${complaintId}/approve-rework`, {
            onSuccess: () => setConfirm(false),
        });
    };

    if (!hasWorkOrder) {
        return (
            <div className="card border-amber-200 bg-amber-50/40">
                <div className="card-body text-sm text-amber-900">
                    <div className="font-semibold mb-1"><i className="fi fi-rr-triangle-warning text-amber-700 text-[11px]" /> Cannot route to rework</div>
                    <div className="text-xs text-amber-800">This complaint isn't linked to a work order, so it can't be sent to production. Resolve it via the "Resolve without rework" panel instead.</div>
                </div>
            </div>
        );
    }

    return (
        <form onSubmit={submit} className="card border-rose-200">
            <div className="card-header flex items-center gap-2">
                <div className="w-9 h-9 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center">
                    <i className="fi fi-rr-refresh leading-none" />
                </div>
                <div>
                    <h3 className="text-sm font-bold text-surface-900">Approve for Rework</h3>
                    <p className="text-xs text-surface-400 mt-0.5">Routes the job back to production with an NCR + auto-issued Gate-In pass</p>
                </div>
            </div>
            <div className="card-body space-y-4">
                <div className="form-group">
                    <label className="form-label">Defect Summary <span className="text-red-500">*</span></label>
                    <textarea
                        value={form.data.defect_summary}
                        onChange={(e) => form.setData('defect_summary', e.target.value)}
                        rows={3}
                        className="form-input"
                        style={{ resize: 'vertical' }}
                        placeholder="What's the defect — based on the customer's complaint + any internal review. This becomes the NCR's defect description."
                    />
                    {form.errors.defect_summary && <p className="form-error">{form.errors.defect_summary}</p>}
                </div>

                <div className="form-group">
                    <label className="form-label">Responsible Section(s) <span className="text-red-500">*</span></label>
                    {candidateSections.length === 0 ? (
                        <p className="form-hint text-red-600">No production sections found on this work order's routing.</p>
                    ) : (
                        <div className="space-y-2 border border-surface-200 rounded-xl p-2 max-h-80 overflow-y-auto">
                            {candidateSections.map((s: any) => {
                                const checked = form.data.target_section_ids.includes(s.id);
                                const note    = form.data.notes[String(s.id)] ?? '';
                                return (
                                    <div key={s.id} className={`rounded-lg border transition-colors ${checked ? 'bg-rose-50 border-rose-200' : 'bg-white border-surface-100'}`}>
                                        <label className="flex items-center gap-3 px-3 py-2 cursor-pointer">
                                            <input type="checkbox" checked={checked} onChange={() => toggleSection(s.id)}
                                                className="w-4 h-4 rounded border-surface-300 text-rose-600 focus:ring-rose-500" />
                                            <div className="flex-1 min-w-0">
                                                <div className="text-sm font-semibold text-surface-900">{s.sequence}. {s.name}</div>
                                                <div className="text-[11px] text-surface-500 font-mono">{s.code}</div>
                                            </div>
                                        </label>
                                        {checked && (
                                            <div className="px-3 pb-3 -mt-1">
                                                <textarea
                                                    value={note}
                                                    onChange={(e) => form.setData('notes', { ...form.data.notes, [String(s.id)]: e.target.value })}
                                                    rows={2}
                                                    className="form-input text-sm"
                                                    style={{ resize: 'vertical' }}
                                                    placeholder={`Note for ${s.name} — what specifically to rework`}
                                                />
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>
            <div className="card-footer flex items-center justify-end gap-2">
                <button
                    type="submit"
                    disabled={form.processing || form.data.target_section_ids.length === 0 || !form.data.defect_summary.trim()}
                    className="btn bg-rose-600 hover:bg-rose-700 text-white"
                >
                    {form.processing
                        ? <><i className="fi fi-rr-spinner animate-spin text-sm" /> Approving...</>
                        : <><i className="fi fi-rr-refresh text-sm" /> Approve & Route to Production</>}
                </button>
            </div>
        </form>
    );
}

/* ─── Resolve without rework ─────────────────────────────────────── */
function ResolveWithoutReworkCard({ complaintId, initialResponse }: any) {
    const form = useForm({
        response: initialResponse,
        status: 'resolved' as 'resolved' | 'closed',
    });

    const submit = (e: React.FormEvent) => {
        e.preventDefault();
        form.post(`/ied/complaints/${complaintId}/respond`);
    };

    return (
        <form onSubmit={submit} className="card">
            <div className="card-header flex items-center gap-2">
                <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                    <i className="fi fi-rr-comment-check leading-none" />
                </div>
                <div>
                    <h3 className="text-sm font-bold text-surface-900">Resolve Without Rework</h3>
                    <p className="text-xs text-surface-400 mt-0.5">Use when no defect found, or for non-quality complaints (delivery / billing / etc.)</p>
                </div>
            </div>
            <div className="card-body space-y-4">
                <div className="form-group">
                    <label className="form-label">Reply to customer <span className="text-red-500">*</span></label>
                    <textarea
                        value={form.data.response}
                        onChange={(e) => form.setData('response', e.target.value)}
                        rows={5}
                        className="form-input"
                        style={{ resize: 'vertical' }}
                        placeholder="Explain the action taken, the investigation result, or why no further action is needed."
                    />
                    {form.errors.response && <p className="form-error">{form.errors.response}</p>}
                </div>
                <div className="form-group">
                    <label className="form-label">Set Status <span className="text-red-500">*</span></label>
                    <select
                        value={form.data.status}
                        onChange={(e) => form.setData('status', e.target.value as any)}
                        className="form-select"
                    >
                        <option value="resolved">Resolved — issue addressed, customer satisfied</option>
                        <option value="closed">Closed — investigated, no further action (or rejected)</option>
                    </select>
                </div>
            </div>
            <div className="card-footer flex items-center justify-end gap-2">
                <button
                    type="submit"
                    disabled={form.processing || !form.data.response.trim()}
                    className="btn-primary"
                >
                    {form.processing
                        ? <><i className="fi fi-rr-spinner animate-spin text-sm" /> Sending...</>
                        : <><i className="fi fi-rr-paper-plane text-sm" /> Send Response</>}
                </button>
            </div>
        </form>
    );
}

/* ─── Decision Makers Panel ──────────────────────────────────────── */
function DecisionMakersCard({ complaintId, decisionMakers, assignableUsers }: any) {
    const [selectedUser, setSelectedUser] = useState<string | number | ''>('');

    const assignedIds = new Set(decisionMakers.map((d: any) => d.user_id));
    const options = (assignableUsers ?? [])
        .filter((u: any) => !assignedIds.has(u.id))
        .map((u: any) => ({ value: u.id, label: u.name, sublabel: u.email }));

    const add = () => {
        if (!selectedUser) return;
        router.post(`/ied/complaints/${complaintId}/decision-makers`,
            { user_id: selectedUser },
            { preserveScroll: true, onSuccess: () => setSelectedUser('') }
        );
    };

    const remove = (dmId: number, name: string) => {
        if (!confirm(`Remove ${name} from the panel?`)) return;
        router.delete(`/ied/complaints/${complaintId}/decision-makers/${dmId}`, { preserveScroll: true });
    };

    return (
        <div className="card">
            <div className="card-header flex items-center gap-2">
                <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                    <i className="fi fi-rr-users leading-none" />
                </div>
                <div className="flex-1">
                    <h3 className="text-sm font-bold text-surface-900">Decision Makers</h3>
                    <p className="text-xs text-surface-400 mt-0.5">Pull in IED colleagues to deliberate on this submission</p>
                </div>
                <span className="text-xs font-semibold text-indigo-700 bg-indigo-50 px-2.5 py-1 rounded-full">{decisionMakers.length}</span>
            </div>
            <div className="card-body space-y-3">
                {decisionMakers.length === 0 ? (
                    <p className="text-xs text-surface-400 italic">No decision makers yet — add a colleague to start the deliberation.</p>
                ) : (
                    <ul className="divide-y divide-surface-100">
                        {decisionMakers.map((dm: any) => (
                            <li key={dm.id} className="flex items-center justify-between py-2.5">
                                <div className="flex items-center gap-3 min-w-0">
                                    <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-xs font-bold shrink-0">
                                        {dm.name?.charAt(0)?.toUpperCase()}
                                    </div>
                                    <div className="min-w-0">
                                        <div className="text-sm font-medium text-surface-800 truncate">{dm.name}</div>
                                        <div className="text-[11px] text-surface-400 truncate">{dm.email}</div>
                                    </div>
                                </div>
                                <button onClick={() => remove(dm.id, dm.name)}
                                    className="text-surface-400 hover:text-rose-600 transition-colors p-1.5 rounded-lg hover:bg-rose-50"
                                    title="Remove from panel">
                                    <i className="fi fi-rr-cross-small text-sm leading-none" />
                                </button>
                            </li>
                        ))}
                    </ul>
                )}

                <div className="flex gap-2 pt-2 border-t border-surface-100">
                    <div className="flex-1">
                        <SearchableSelect
                            value={selectedUser}
                            onChange={(v) => setSelectedUser(v)}
                            options={options}
                            placeholder="Search & add a decision maker…"
                            clearable
                        />
                    </div>
                    <button onClick={add}
                        disabled={!selectedUser}
                        className="btn-primary btn-sm disabled:opacity-50 disabled:cursor-not-allowed">
                        <i className="fi fi-rr-plus text-xs leading-none" /> Add
                    </button>
                </div>
            </div>
        </div>
    );
}

/* ─── Internal Discussion Stream ──────────────────────────────────── */
function DiscussionStream({ complaintId, initialMessages, currentUserId }: any) {
    const [messages, setMessages] = useState<any[]>(initialMessages);
    const [text, setText] = useState('');
    const [sending, setSending] = useState(false);
    const scrollRef = useRef<HTMLDivElement>(null);
    const lastSeenRef = useRef<string>(new Date().toISOString());

    // Live polling every 5s
    useEffect(() => {
        const tick = async () => {
            try {
                const { data } = await axios.get(`/ied/complaints/${complaintId}/messages/poll`, {
                    params: { since: lastSeenRef.current },
                });
                if (Array.isArray(data?.messages) && data.messages.length > 0) {
                    setMessages(prev => {
                        const seen = new Set(prev.map((m: any) => m.id));
                        const fresh = data.messages.filter((m: any) => !seen.has(m.id));
                        return [...prev, ...fresh];
                    });
                }
                if (data?.now) lastSeenRef.current = data.now;
            } catch {/* swallow */}
        };
        const t = setInterval(tick, 5000);
        return () => clearInterval(t);
    }, [complaintId]);

    // Auto-scroll on new messages
    useEffect(() => {
        scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
    }, [messages.length]);

    const send = async (e: React.FormEvent) => {
        e.preventDefault();
        const msg = text.trim();
        if (!msg || sending) return;
        setSending(true);
        try {
            // Optimistic post: add immediately, then refresh with real ID via poll
            const optimistic = {
                id: 'temp-' + Date.now(),
                user_id: currentUserId,
                user_name: 'You',
                message: msg,
                created_at: new Date().toLocaleString(),
                is_mine: true,
            };
            setMessages(prev => [...prev, optimistic]);
            setText('');
            await axios.post(`/ied/complaints/${complaintId}/messages`, { message: msg });
        } catch {
            // Roll back optimistic on failure
            setMessages(prev => prev.filter(m => typeof m.id !== 'string' || !m.id.startsWith('temp-')));
        } finally {
            setSending(false);
        }
    };

    return (
        <div className="card">
            <div className="card-header flex items-center gap-2">
                <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                    <i className="fi fi-rr-comments leading-none" />
                </div>
                <div className="flex-1">
                    <h3 className="text-sm font-bold text-surface-900">Internal Discussion</h3>
                    <p className="text-xs text-surface-400 mt-0.5">Live opinion exchange between decision makers — not visible to the customer</p>
                </div>
                <span className="text-xs font-semibold text-blue-700 bg-blue-50 px-2.5 py-1 rounded-full">{messages.length}</span>
            </div>

            <div ref={scrollRef} className="card-body max-h-[420px] overflow-y-auto bg-surface-50/40">
                {messages.length === 0 ? (
                    <div className="text-center py-8">
                        <i className="fi fi-rr-comment-dots text-2xl text-surface-300" />
                        <p className="text-xs text-surface-400 mt-2">No messages yet — start the conversation.</p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {messages.map((m: any) => (
                            <div key={m.id} className={`flex ${m.is_mine ? 'justify-end' : 'justify-start'}`}>
                                <div className={`max-w-[80%] rounded-2xl px-3.5 py-2 shadow-sm ${
                                    m.is_mine
                                        ? 'bg-blue-600 text-white rounded-br-md'
                                        : 'bg-white border border-surface-200 text-surface-800 rounded-bl-md'
                                }`}>
                                    {!m.is_mine && (
                                        <div className="text-[11px] font-semibold text-blue-700 mb-0.5">{m.user_name}</div>
                                    )}
                                    <div className="text-sm whitespace-pre-line leading-relaxed">{m.message}</div>
                                    <div className={`text-[10px] mt-1 ${m.is_mine ? 'text-blue-100/80' : 'text-surface-400'}`}>{m.created_at}</div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            <form onSubmit={send} className="card-footer flex gap-2 border-t border-surface-100">
                <textarea
                    value={text}
                    onChange={e => setText(e.target.value)}
                    rows={1}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            send(e as any);
                        }
                    }}
                    placeholder="Share your opinion… (Enter to send, Shift+Enter for new line)"
                    className="form-input flex-1 resize-none"
                    style={{ minHeight: '42px', maxHeight: '120px' }}
                />
                <button type="submit" disabled={!text.trim() || sending}
                    className="btn-primary btn-sm disabled:opacity-50 disabled:cursor-not-allowed shrink-0">
                    {sending
                        ? <i className="fi fi-rr-spinner animate-spin text-sm leading-none" />
                        : <><i className="fi fi-rr-paper-plane text-sm leading-none" /> Send</>}
                </button>
            </form>
        </div>
    );
}

/* ─── Final Decision Card (with AI-draft generation) ─────────────── */
function FinalDecisionCard({ complaintId, initialResponse }: any) {
    const form = useForm({
        response: initialResponse,
        status: 'resolved' as 'resolved' | 'closed',
    });
    const [generating, setGenerating] = useState(false);
    const [draftSource, setDraftSource] = useState<string | null>(null);

    const generateDraft = async () => {
        if (generating) return;
        if (form.data.response.trim() && !confirm('Replace the current draft with an AI-generated one?')) return;
        setGenerating(true);
        try {
            const { data } = await axios.get(`/ied/complaints/${complaintId}/draft`);
            form.setData('response', data.draft || '');
            setDraftSource(data.source ?? null);
        } catch {
            alert('Could not generate the draft. Please check your connection and try again.');
        } finally {
            setGenerating(false);
        }
    };

    const submit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!form.data.response.trim()) return;
        if (!confirm('Confirm sending this decision to the customer? They will see it in their portal AND receive an email.')) return;
        form.post(`/ied/complaints/${complaintId}/respond`);
    };

    return (
        <form onSubmit={submit} className="card">
            <div className="card-header flex items-center gap-2">
                <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                    <i className="fi fi-rr-comment-check leading-none" />
                </div>
                <div className="flex-1">
                    <h3 className="text-sm font-bold text-surface-900">Final Decision to Customer</h3>
                    <p className="text-xs text-surface-400 mt-0.5">Auto-draft from the discussion, edit, and send. Customer sees it in portal + receives email.</p>
                </div>
                <button type="button"
                    onClick={generateDraft}
                    disabled={generating}
                    className="btn-sm rounded-xl px-3 py-1.5 bg-gradient-to-br from-purple-500 to-indigo-600 text-white font-semibold shadow-sm hover:shadow inline-flex items-center gap-1.5 disabled:opacity-60">
                    {generating
                        ? <><i className="fi fi-rr-spinner animate-spin text-xs leading-none" /> Generating…</>
                        : <><i className="fi fi-rr-magic-wand text-xs leading-none" /> Generate Final Decision</>}
                </button>
            </div>
            <div className="card-body space-y-4">
                {draftSource === 'ai' && (
                    <div className="rounded-lg bg-purple-50 border border-purple-100 px-3 py-2 text-[11px] text-purple-800 inline-flex items-center gap-1.5">
                        <i className="fi fi-rr-sparkles text-xs leading-none" />
                        Draft generated by AI based on the panel discussion — review carefully before sending.
                    </div>
                )}
                {draftSource === 'fallback' && (
                    <div className="rounded-lg bg-amber-50 border border-amber-100 px-3 py-2 text-[11px] text-amber-800 inline-flex items-center gap-1.5">
                        <i className="fi fi-rr-info text-xs leading-none" />
                        Used a template fallback — AI service was unavailable. Please tailor the text before sending.
                    </div>
                )}
                <div className="form-group">
                    <label className="form-label">Final decision to customer <span className="text-red-500">*</span></label>
                    <textarea
                        value={form.data.response}
                        onChange={(e) => { form.setData('response', e.target.value); setDraftSource(null); }}
                        rows={8}
                        className="form-input"
                        style={{ resize: 'vertical' }}
                        placeholder="Explain BITAC's decision, action taken, and any next steps for the customer."
                    />
                    {form.errors.response && <p className="form-error">{form.errors.response}</p>}
                </div>
                <div className="form-group">
                    <label className="form-label">Set Status <span className="text-red-500">*</span></label>
                    <select
                        value={form.data.status}
                        onChange={(e) => form.setData('status', e.target.value as any)}
                        className="form-select"
                    >
                        <option value="resolved">Resolved — issue addressed, customer satisfied</option>
                        <option value="closed">Closed — investigated, no further action (or rejected)</option>
                    </select>
                </div>
            </div>
            <div className="card-footer flex items-center justify-end gap-2">
                <button
                    type="submit"
                    disabled={form.processing || !form.data.response.trim()}
                    className="btn-primary"
                >
                    {form.processing
                        ? <><i className="fi fi-rr-spinner animate-spin text-sm" /> Sending…</>
                        : <><i className="fi fi-rr-paper-plane text-sm" /> Confirm &amp; Send to Customer</>}
                </button>
            </div>
        </form>
    );
}
