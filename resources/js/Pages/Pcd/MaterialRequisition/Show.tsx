import AppLayout from '@/Layouts/AppLayout';
import { Link, router, usePage } from '@inertiajs/react';
import { useState } from 'react';
import PdfPopupModal from '@/Components/PdfPopupModal';
import { MR_STEPS, mrBadge } from '@/lib/mrStatus';

interface RequisitionItem {
    id: number;
    item_no: number;
    description: string | null;
    material_id?: number | null;
    material_name?: string | null;
    unit: string;
    required_qty: number | string;
    issue_qty: number | string | null;
    pending_qty?: number | string | null;
    issue_date?: string | null;
    remarks?: string | null;
}

interface Requisition {
    id: number;
    mrn_number: string;
    work_order: { id: number; wo_number: string; job_number?: string; customer?: string } | null;
    request_date_display: string;
    status: string;
    status_label: string;
    can_edit: boolean;
    can_delete: boolean;
    actions: string[];
    notes?: string | null;
    requested_by?: string | null;
    approved_by?: string | null;
    approved_at?: string | null;
    issued_by?: string | null;
    issued_at?: string | null;
    received_by?: string | null;
    received_at?: string | null;
    items: RequisitionItem[];
}

const num = (v: any) => Number(v) || 0;
const qty = (v: any) => (v == null || v === '' ? '—' : Number(v).toLocaleString('en-IN', { maximumFractionDigits: 3 }));

/** What each hand-moved step says on its button, and what it means. */
const ACTIONS: Record<string, { label: string; hint: string; icon: string; tone: string; confirm?: string }> = {
    submit:  { label: 'Submit to store', hint: 'Send the requisition to the store. Its lines can still be corrected until it is approved.',
               icon: 'fi-rr-paper-plane', tone: 'btn-primary' },
    approve: { label: 'Mark approved', hint: 'The requisition has been approved. Its lines are locked from here on.',
               icon: 'fi-rr-check', tone: 'btn-primary', confirm: 'Mark this requisition approved? Its lines can no longer be edited after this.' },
    issue:   { label: 'Record issue', hint: 'Enter what the store handed over, line by line. A part issue leaves the rest pending.',
               icon: 'fi-rr-box-open', tone: 'btn-success' },
    receive: { label: 'Mark received', hint: 'The shop has the material. This closes the requisition.',
               icon: 'fi-rr-hand-holding-box', tone: 'btn-primary', confirm: 'Mark this requisition received by the shop?' },
    revert:  { label: 'Back to draft', hint: 'Take it back to fix the lines.',
               icon: 'fi-rr-undo', tone: 'btn-outline' },
    cancel:  { label: 'Cancel requisition', hint: 'It stays on the register as cancelled.',
               icon: 'fi-rr-cross-circle', tone: 'btn-outline text-red-600 hover:bg-red-50' },
};

function SignatureBox({ role, roleBn, name, date }: { role: string; roleBn: string; name?: string | null; date?: string | null }) {
    const signed = !!name;
    return (
        <div className={`rounded-lg border p-4 text-center flex flex-col justify-between min-h-[120px] ${
            signed ? 'border-brand-200 bg-brand-50/40' : 'border-dashed border-surface-200 bg-surface-50/40'}`}>
            <div className="flex-1 flex items-center justify-center">
                {signed ? (
                    <div>
                        <div className="font-semibold text-surface-900 text-sm">{name}</div>
                        {date && <div className="text-[11px] text-surface-500 mt-1">{date}</div>}
                    </div>
                ) : <span className="text-xs text-surface-400 italic">Pending</span>}
            </div>
            <div className="pt-3 mt-2 border-t border-surface-200">
                <div className="text-[11px] font-semibold text-surface-700 uppercase tracking-wide">{role}</div>
                <div className="text-[10px] text-surface-500 mt-0.5">{roleBn}</div>
            </div>
        </div>
    );
}

/** Draft → Submitted → Approved → Issued → Received, with where this one is. */
function Stepper({ status }: { status: string }) {
    const at = MR_STEPS.findIndex((s) => s.covers.includes(status));
    return (
        <ol className="flex items-center gap-1 sm:gap-2 overflow-x-auto">
            {MR_STEPS.map((s, i) => {
                const done = at > i || status === 'received';
                const current = at === i && status !== 'received';
                const label = s.key === 'issued' && status === 'partially_issued' ? 'Partially issued' : s.label;
                return (
                    <li key={s.key} className="flex items-center gap-1 sm:gap-2 shrink-0">
                        <span className={`flex items-center gap-2 rounded-full pl-1 pr-3 py-1 text-xs font-semibold ${
                            current ? 'bg-brand-600 text-white' : done ? 'bg-emerald-50 text-emerald-700' : 'bg-surface-100 text-surface-500'}`}>
                            <span className={`w-5 h-5 rounded-full grid place-items-center text-[10px] ${
                                current ? 'bg-white/20' : done ? 'bg-emerald-500 text-white' : 'bg-white text-surface-400'}`}>
                                {done ? <i className="fi fi-rr-check text-[9px] leading-none" /> : i + 1}
                            </span>
                            {label}
                        </span>
                        {i < MR_STEPS.length - 1 && <span className={`w-4 sm:w-8 h-px ${done ? 'bg-emerald-300' : 'bg-surface-200'}`} />}
                    </li>
                );
            })}
        </ol>
    );
}

export default function MaterialRequisitionShow({ requisition }: { requisition: Requisition }) {
    const [pdfOpen, setPdfOpen] = useState(false);
    const [issueOpen, setIssueOpen] = useState(false);
    const [busy, setBusy] = useState(false);
    // The IMS number often arrives after the paper reaches the store — it can be set at any stage.
    const { errors } = usePage().props as any;
    const [editingNo, setEditingNo] = useState(false);
    const [mrnNo, setMrnNo] = useState(requisition.mrn_number);
    const saveNo = () => router.patch(`/pcd/material-requisitions/${requisition.id}/number`, { mrn_number: mrnNo },
        { preserveScroll: true, onSuccess: () => setEditingNo(false) });
    const base = `/pcd/material-requisitions/${requisition.id}`;

    const run = (action: string) => {
        if (action === 'issue') { setIssueOpen(true); return; }
        const a = ACTIONS[action];
        let payload: Record<string, string> = {};
        if (action === 'cancel') {
            const reason = prompt('Cancel this requisition? Give a reason (optional):');
            if (reason === null) return;
            payload = { reason };
        } else if (a.confirm && !confirm(a.confirm)) {
            return;
        }
        setBusy(true);
        router.post(`${base}/${action}`, payload, { preserveScroll: true, onFinish: () => setBusy(false) });
    };

    const remove = () => {
        if (!confirm(`Delete draft ${requisition.mrn_number}?`)) return;
        router.delete(base);
    };

    const totalReq = requisition.items.reduce((s, i) => s + num(i.required_qty), 0);
    const totalIss = requisition.items.reduce((s, i) => s + num(i.issue_qty), 0);
    const primary = requisition.actions.filter((a) => !['revert', 'cancel'].includes(a));
    const secondary = requisition.actions.filter((a) => ['revert', 'cancel'].includes(a));

    return (
        <AppLayout header={`Material Requisition ${requisition.mrn_number}`}>
            <div className="space-y-6 animate-fade-in">
                {/* Header */}
                <div className="card">
                    <div className="card-body space-y-5">
                        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
                            <div className="min-w-0">
                                <div className="flex items-center gap-3 flex-wrap">
                                    {editingNo ? (
                                        <span className="flex items-center gap-1.5">
                                            <input autoFocus value={mrnNo} maxLength={30} onChange={(e) => setMrnNo(e.target.value)}
                                                onKeyDown={(e) => { if (e.key === 'Enter') saveNo(); if (e.key === 'Escape') { setEditingNo(false); setMrnNo(requisition.mrn_number); } }}
                                                className="form-input font-mono font-bold text-brand-700 !py-1.5 w-56" placeholder="IMS MRN number" />
                                            <button type="button" onClick={saveNo} className="btn-primary btn-sm">Save</button>
                                            <button type="button" onClick={() => { setEditingNo(false); setMrnNo(requisition.mrn_number); }} className="btn-ghost btn-sm">Cancel</button>
                                        </span>
                                    ) : (
                                        <span className="flex items-center gap-1">
                                            <h2 className="font-mono font-bold text-brand-600 text-xl">{requisition.mrn_number}</h2>
                                            <button type="button" onClick={() => setEditingNo(true)} title="Change the MRN number (e.g. the IMS number)"
                                                className="btn-ghost btn-icon text-surface-400 hover:text-brand-600">
                                                <i className="fi fi-rr-pencil text-xs leading-none" />
                                            </button>
                                        </span>
                                    )}
                                    <span className={`badge ${mrBadge(requisition.status)}`}>{requisition.status_label}</span>
                                </div>
                                {editingNo && errors?.mrn_number && <p className="form-error">{errors.mrn_number}</p>}
                                <p className="text-sm text-surface-600 mt-1">
                                    Material Requisition Note · requested {requisition.request_date_display}
                                    {requisition.requested_by && <> by <b className="font-semibold text-surface-800">{requisition.requested_by}</b></>}
                                </p>
                                {requisition.work_order && (
                                    <p className="text-sm text-surface-600 mt-1">
                                        For <Link href={`/pcd/job-planning/${requisition.work_order.id}`} className="font-mono font-semibold text-brand-600 hover:underline">
                                            {requisition.work_order.wo_number}</Link>
                                        {requisition.work_order.job_number && <> · Job <b className="font-semibold text-surface-800">{requisition.work_order.job_number}</b></>}
                                        {requisition.work_order.customer && <> · {requisition.work_order.customer}</>}
                                    </p>
                                )}
                            </div>
                            <div className="flex flex-wrap gap-2 shrink-0">
                                <button type="button" onClick={() => setPdfOpen(true)} className="btn-outline btn-sm">
                                    <i className="fi fi-rr-file-pdf text-xs leading-none" /> PDF
                                </button>
                                {requisition.can_edit && (
                                    <Link href={`${base}/edit`} className="btn-outline btn-sm">
                                        <i className="fi fi-rr-edit text-xs leading-none" /> Edit lines
                                    </Link>
                                )}
                                {requisition.can_delete && (
                                    <button type="button" onClick={remove} className="btn-ghost btn-sm text-red-600 hover:bg-red-50">
                                        <i className="fi fi-rr-trash text-xs leading-none" /> Delete
                                    </button>
                                )}
                            </div>
                        </div>

                        {requisition.status === 'cancelled' ? (
                            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
                                This requisition was cancelled. It stays on the register; raise a new one if the material is still needed.
                            </div>
                        ) : <Stepper status={requisition.status} />}
                    </div>
                </div>

                {/* Next step */}
                {requisition.actions.length > 0 && (
                    <div className="card border-l-4 border-brand-500">
                        <div className="card-body flex flex-col md:flex-row md:items-center gap-4">
                            <div className="min-w-0 flex-1">
                                <h3 className="text-sm font-bold text-surface-900">Next step</h3>
                                <p className="text-xs text-surface-600 mt-0.5">
                                    {primary.length ? ACTIONS[primary[0]].hint : 'Nothing further is due.'}
                                    {' '}There is no IMS link — move the status here as the paper moves through the store.
                                </p>
                            </div>
                            <div className="flex flex-wrap gap-2 shrink-0">
                                {secondary.map((a) => (
                                    <button key={a} type="button" disabled={busy} onClick={() => run(a)} className={`${ACTIONS[a].tone} btn-sm`}>
                                        <i className={`fi ${ACTIONS[a].icon} text-xs leading-none`} /> {ACTIONS[a].label}
                                    </button>
                                ))}
                                {primary.map((a) => (
                                    <button key={a} type="button" disabled={busy} onClick={() => run(a)} className={`${ACTIONS[a].tone} btn-sm`}>
                                        <i className={`fi ${ACTIONS[a].icon} text-xs leading-none`} /> {ACTIONS[a].label}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                )}

                {/* Lines */}
                <div className="card">
                    <div className="card-header flex items-center justify-between gap-3">
                        <div>
                            <h3 className="text-sm font-bold text-surface-900">Materials</h3>
                            <p className="text-xs text-surface-500 mt-0.5">What was asked for, and what the store has handed over.</p>
                        </div>
                        {totalIss > 0 && (
                            <span className="badge badge-slate shrink-0">{qty(totalIss)} of {qty(totalReq)} issued</span>
                        )}
                    </div>
                    <div className="card-body p-0 overflow-x-auto">
                        {requisition.items.length > 0 ? (
                            <table className="premium-table w-full min-w-[820px]">
                                <thead>
                                    <tr>
                                        <th className="w-10">#</th>
                                        <th>Material</th>
                                        <th>Size / spec</th>
                                        <th className="text-right w-28">Required</th>
                                        <th className="text-right w-28">Issued</th>
                                        <th className="text-right w-28">Pending</th>
                                        <th className="w-28">Issued on</th>
                                        <th>Remarks</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {requisition.items.map((it) => {
                                        const pending = Math.max(num(it.required_qty) - num(it.issue_qty), 0);
                                        return (
                                            <tr key={it.id} className="align-top">
                                                <td className="text-center text-xs font-semibold text-surface-500">{it.item_no}</td>
                                                <td className="font-semibold text-surface-900">{it.material_name ?? '—'}</td>
                                                <td className="text-surface-700 whitespace-pre-line">{it.description || <span className="text-surface-300">—</span>}</td>
                                                <td className="text-right font-mono">{qty(it.required_qty)} <span className="text-surface-400 text-xs">{it.unit}</span></td>
                                                <td className="text-right font-mono">{num(it.issue_qty) ? qty(it.issue_qty) : <span className="text-surface-300">—</span>}</td>
                                                <td className={`text-right font-mono font-semibold ${pending > 0 && num(it.issue_qty) > 0 ? 'text-amber-600' : 'text-surface-700'}`}>
                                                    {pending > 0 ? qty(pending) : <span className="text-emerald-600">✓</span>}
                                                </td>
                                                <td className="text-surface-600 text-xs">{it.issue_date ?? <span className="text-surface-300">—</span>}</td>
                                                <td className="text-surface-600 text-xs">{it.remarks ?? <span className="text-surface-300">—</span>}</td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        ) : (
                            <div className="empty-state">
                                <div className="empty-state-title">No lines</div>
                                <div className="empty-state-text">Edit the requisition to add the materials it needs.</div>
                            </div>
                        )}
                    </div>
                </div>

                {requisition.notes && (
                    <div className="card">
                        <div className="card-header"><h3 className="text-sm font-bold text-surface-900">Notes</h3></div>
                        <div className="card-body"><p className="text-sm text-surface-700 whitespace-pre-line">{requisition.notes}</p></div>
                    </div>
                )}

                {/* Who did what */}
                <div className="card">
                    <div className="card-header">
                        <h3 className="text-sm font-bold text-surface-900">Record</h3>
                        <p className="text-xs text-surface-500 mt-0.5">Stamped as each step is marked</p>
                    </div>
                    <div className="card-body grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                        <SignatureBox role="Requested by" roleBn="চাহিদাকারী" name={requisition.requested_by} date={requisition.request_date_display} />
                        <SignatureBox role="Approved by" roleBn="অনুমোদনকারী অফিসার" name={requisition.approved_by} date={requisition.approved_at} />
                        <SignatureBox role="Issue recorded by" roleBn="দ্রব্য রক্ষক" name={requisition.issued_by} date={requisition.issued_at} />
                        <SignatureBox role="Received by" roleBn="দ্রব্য গ্রহিতা" name={requisition.received_by} date={requisition.received_at} />
                    </div>
                </div>

                <Link href="/pcd/material-requisitions" className="btn-ghost btn-sm">
                    <i className="fi fi-rr-arrow-left text-xs leading-none" /> Back to list
                </Link>
            </div>

            {issueOpen && <IssueDialog requisition={requisition} onClose={() => setIssueOpen(false)} />}

            <PdfPopupModal
                open={pdfOpen}
                pdfUrl={pdfOpen ? `${base}/pdf?preview=base64` : null}
                title={`MRN ${requisition.mrn_number}`}
                subtitle={requisition.work_order ? `WO ${requisition.work_order.wo_number}` : undefined}
                onClose={() => setPdfOpen(false)}
            />
        </AppLayout>
    );
}

/**
 * What the store handed over, per line — the running TOTAL, not an increment,
 * so a typo is corrected by typing the right number. Blank = nothing yet.
 */
function IssueDialog({ requisition, onClose }: { requisition: Requisition; onClose: () => void }) {
    const today = new Date().toISOString().slice(0, 10);
    const [rows, setRows] = useState(requisition.items.map((i) => ({
        id: i.id,
        issue_qty: num(i.issue_qty) ? String(i.issue_qty) : '',
        issue_date: i.issue_date ?? today,
    })));
    const [saving, setSaving] = useState(false);
    const set = (idx: number, patch: Partial<(typeof rows)[number]>) =>
        setRows((r) => r.map((x, i) => (i === idx ? { ...x, ...patch } : x)));
    const fillAll = () => setRows((r) => r.map((x, i) => ({ ...x, issue_qty: String(num(requisition.items[i].required_qty)) })));

    const save = () => {
        setSaving(true);
        router.post(`/pcd/material-requisitions/${requisition.id}/issue`, { items: rows }, {
            preserveScroll: true,
            onSuccess: onClose,
            onFinish: () => setSaving(false),
        });
    };

    return (
        <div className="fixed inset-0 z-50 bg-black/40 grid place-items-center p-4" onClick={onClose}>
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col animate-fade-in" onClick={(e) => e.stopPropagation()}>
                <div className="px-5 py-4 border-b border-surface-200 flex items-start justify-between gap-3">
                    <div>
                        <h3 className="font-bold text-surface-900">Record issue — {requisition.mrn_number}</h3>
                        <p className="text-xs text-surface-500 mt-0.5">
                            The total handed over so far on each line. Everything covered → Issued; anything less → Partially Issued.
                        </p>
                    </div>
                    <button onClick={onClose} className="btn-ghost btn-icon"><i className="fi fi-rr-cross-small" /></button>
                </div>
                <div className="overflow-auto">
                    <table className="premium-table w-full min-w-[620px]">
                        <thead>
                            <tr>
                                <th>Material</th>
                                <th className="text-right w-28">Required</th>
                                <th className="w-36">Issued (total)</th>
                                <th className="w-40">Issued on</th>
                            </tr>
                        </thead>
                        <tbody>
                            {requisition.items.map((it, idx) => (
                                <tr key={it.id}>
                                    <td>
                                        <div className="font-semibold text-surface-900">{it.material_name}</div>
                                        {it.description && <div className="text-xs text-surface-500 truncate max-w-[260px]">{it.description}</div>}
                                    </td>
                                    <td className="text-right font-mono">{qty(it.required_qty)} <span className="text-xs text-surface-400">{it.unit}</span></td>
                                    <td>
                                        <input type="number" min="0" step="0.001" value={rows[idx].issue_qty}
                                            onChange={(e) => set(idx, { issue_qty: e.target.value })}
                                            className="form-input text-sm py-1.5 text-right font-mono" placeholder="0" />
                                    </td>
                                    <td>
                                        <input type="date" value={rows[idx].issue_date}
                                            onChange={(e) => set(idx, { issue_date: e.target.value })}
                                            className="form-input text-sm py-1.5" />
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                <div className="px-5 py-4 border-t border-surface-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                    <button type="button" onClick={fillAll} className="btn-ghost btn-sm">Everything issued in full</button>
                    <div className="flex gap-2">
                        <button type="button" onClick={onClose} className="btn-outline btn-sm">Cancel</button>
                        <button type="button" onClick={save} disabled={saving} className="btn-success btn-sm">
                            <i className="fi fi-rr-box-open text-xs leading-none" /> Save issue
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
