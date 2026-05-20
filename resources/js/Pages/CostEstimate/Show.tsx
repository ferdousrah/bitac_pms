import AppLayout from '@/Layouts/AppLayout';
import { Link, router } from '@inertiajs/react';
import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import RevisionTimeline from '@/Components/RevisionTimeline';
import ApprovalActionModal, { ApprovalAction } from '@/Components/ApprovalActionModal';
import JobTypeBadge from '@/Components/JobTypeBadge';
import ApprovalNoteAI from '@/Components/ApprovalNoteAI';
import { useAiEnabled } from '@/lib/useAiEnabled';
import RfqAttachmentsPanel from '@/Components/RfqAttachmentsPanel';
import CommentThread from '@/Components/CommentThread';
import PdfPopupModal from '@/Components/PdfPopupModal';

const STATUS_BADGE: Record<string, string> = {
    draft:     'badge-slate',
    finalized: 'badge-green',
    used:      'badge-blue',
};

const APPROVAL_STATUS: Record<string, { dot: string; text: string; label: string }> = {
    not_submitted:    { dot: 'bg-slate-400',   text: 'text-slate-600',   label: 'Not Submitted' },
    pending_approval: { dot: 'bg-amber-400',   text: 'text-amber-700',   label: 'Pending Approval' },
    approved:         { dot: 'bg-emerald-400', text: 'text-emerald-700', label: 'Approved' },
    rejected:         { dot: 'bg-red-400',     text: 'text-red-700',     label: 'Rejected' },
};

const fmt = (v: any) => Number(v ?? 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtInt = (v: any) => Number(v ?? 0).toLocaleString('en-IN');

export default function CostEstimateShow({ estimate, revisions = [], rfqAttachments = [], comments = [], canSubmit, canApprove, canReject }: any) {
    const currentVersion = revisions[0]?.revision_no ?? null;
    const sectionLines = (section: string) => estimate.lines.filter((l: any) => l.section === section);

    // Approval modal state
    const [approvalAction, setApprovalAction] = useState<ApprovalAction | null>(null);

    // "Use as Quotation" modal state
    const [useQuotationOpen, setUseQuotationOpen] = useState(false);
    const [useQuotationNote, setUseQuotationNote] = useState('');

    // PDF popup state
    const [pdfPopup, setPdfPopup] = useState<{ open: boolean; url: string | null; title: string; subtitle?: string }>({
        open: false, url: null, title: '',
    });
    const [useQuotationSubmitting, setUseQuotationSubmitting] = useState(false);

    const confirmUseAsQuotation = () => {
        setUseQuotationSubmitting(true);
        router.post(
            `/cost-estimates/${estimate.id}/use-as-quotation`,
            { note: useQuotationNote.trim() || null },
            {
                onFinish: () => {
                    setUseQuotationSubmitting(false);
                    setUseQuotationOpen(false);
                },
            }
        );
    };

    const handleApprovalConfirm = (remarks: string, signature?: string | null) => {
        if (!approvalAction) return;
        const url = approvalAction === 'approve'
            ? `/cost-estimates/${estimate.id}/approve`
            : approvalAction === 'reject'
            ? `/cost-estimates/${estimate.id}/reject`
            : `/cost-estimates/${estimate.id}/request-changes`;
        return new Promise<void>((resolve) => {
            router.post(url, {
                remarks: remarks || null,
                signature: signature || null, // base64 data URL when approver drew a fresh signature
            }, {
                onFinish: () => {
                    setApprovalAction(null);
                    resolve();
                },
            });
        });
    };

    return (
        <AppLayout header={`Cost Estimate ${estimate.estimate_no}`}>
            <div className="space-y-5 max-w-7xl animate-fade-in">

                {/* ── Document Header ─────────────────────────────── */}
                <div className="card overflow-hidden">
                    <div className="p-6 border-b border-surface-100">
                        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
                            <div className="min-w-0 flex-1">
                                {/* Estimate number + badges */}
                                <div className="flex flex-wrap items-center gap-2 mb-2">
                                    <span className="text-[10px] uppercase tracking-[0.18em] text-surface-400 font-bold">
                                        Cost Estimate
                                    </span>
                                    <span className={`badge ${STATUS_BADGE[estimate.status] ?? 'badge-slate'} capitalize`}>
                                        {estimate.status}
                                    </span>
                                    <JobTypeBadge type={estimate.job_type} />
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-surface-100 text-surface-700 text-[10px] font-bold">
                                        Pricing {estimate.pricing_group}
                                    </span>
                                    {currentVersion !== null && (
                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-indigo-100 text-indigo-700 text-[10px] font-bold font-mono" title={`Revision ${currentVersion}`}>
                                            v{currentVersion}
                                        </span>
                                    )}
                                </div>

                                <h1 className="text-2xl font-bold text-surface-900 font-mono tracking-tight mb-1">
                                    {estimate.estimate_no}
                                </h1>
                                <p className="text-base text-surface-800">{estimate.job_name}</p>

                                {/* Metadata grid */}
                                <dl className="grid grid-cols-2 sm:grid-cols-4 gap-x-6 gap-y-2 mt-4">
                                    <MetaItem label="Customer" value={estimate.customer?.name ?? estimate.company_name ?? '—'} />
                                    {estimate.part_no && <MetaItem label="Part No." value={estimate.part_no} mono />}
                                    <MetaItem label="Created" value={estimate.created_at} />
                                    <MetaItem label="Prepared by" value={estimate.created_by ?? '—'} />
                                </dl>

                                {/* RFQ Item link */}
                                {estimate.rfq_item && (
                                    <div className="mt-3 inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-indigo-50 border border-indigo-100 text-xs">
                                        <i className="fi fi-rr-link text-indigo-500 text-[11px] leading-none" />
                                        <span className="text-indigo-900 font-semibold">{estimate.rfq_item.job_description}</span>
                                        <span className="text-indigo-400">·</span>
                                        <span className="text-indigo-700">{estimate.rfq_item.quantity} {estimate.rfq_item.unit}</span>
                                        {estimate.rfq_id && (
                                            <Link href={`/rfqs/${estimate.rfq_id}`} className="ml-1 text-indigo-600 hover:text-indigo-800 font-bold">
                                                RFQ #{estimate.rfq_id} →
                                            </Link>
                                        )}
                                    </div>
                                )}
                            </div>

                            {/* Actions */}
                            <div className="flex items-center gap-2 shrink-0 flex-wrap">
                                <button
                                    type="button"
                                    onClick={() => setPdfPopup({
                                        open:     true,
                                        url:      `/cost-estimates/${estimate.id}/pdf?preview=base64`,
                                        title:    `Cost Estimate ${estimate.estimate_no}`,
                                        subtitle: `${estimate.job_name} · ${estimate.customer?.name ?? estimate.company_name ?? ''}`,
                                    })}
                                    className="btn-outline btn-sm text-red-700 border-red-200 hover:bg-red-50 hover:border-red-300">
                                    <i className="fi fi-rr-file-pdf text-xs leading-none" /> PDF
                                </button>
                                {estimate.status !== 'used' && (
                                    <button onClick={() => { setUseQuotationNote(''); setUseQuotationOpen(true); }} className="btn-success btn-sm">
                                        <i className="fi fi-rr-paper-plane text-xs leading-none" /> Use as Quotation
                                    </button>
                                )}
                                <Link href={`/cost-estimates/${estimate.id}/edit`} className="btn-outline btn-sm">
                                    <i className="fi fi-rr-pencil text-xs leading-none" /> Edit
                                </Link>
                                <Link href="/cost-estimates" className="btn-ghost btn-sm">
                                    <i className="fi fi-rr-arrow-left text-xs leading-none" /> Back
                                </Link>
                            </div>
                        </div>
                    </div>
                </div>

                {/* ── Main Grid ──────────────────────────────────── */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

                    {/* Left: Sections — empty sections (0 lines) are hidden to reduce noise */}
                    <div className="lg:col-span-2 space-y-4">
                        {[
                            { letter: 'A', title: 'Material Cost',     total: estimate.material_cost,  lines: sectionLines('material') },
                            { letter: 'B', title: 'Machining Cost',    total: estimate.machining_cost, lines: sectionLines('machining') },
                            { letter: 'C', title: 'Surface Treatment', total: estimate.surface_cost,   lines: sectionLines('surface') },
                            { letter: 'D', title: 'Other Parts',       total: estimate.other_cost,     lines: sectionLines('other') },
                        ]
                            .filter(s => s.lines.length > 0)
                            .map(s => (
                                <SectionCard
                                    key={s.letter}
                                    letter={s.letter}
                                    title={s.title}
                                    total={s.total}
                                    lines={s.lines}
                                />
                            ))}
                    </div>

                    {/* Right: Sticky Sidebar */}
                    <div className="space-y-4">
                        {/* Cost Summary */}
                        <div className="card sticky top-4 overflow-hidden">
                            <div className="px-5 py-3 border-b border-surface-100">
                                <h3 className="text-xs font-bold text-surface-900 uppercase tracking-wider">Cost Summary</h3>
                            </div>

                            {/* Section subtotals — only show sections that contribute */}
                            <div className="px-5 py-3 space-y-2 text-sm">
                                {[
                                    { label: 'Material',          value: estimate.material_cost,  letter: 'A', linesKey: 'material'  },
                                    { label: 'Machining',         value: estimate.machining_cost, letter: 'B', linesKey: 'machining' },
                                    { label: 'Surface Treatment', value: estimate.surface_cost,   letter: 'C', linesKey: 'surface'   },
                                    { label: 'Other Parts',       value: estimate.other_cost,     letter: 'D', linesKey: 'other'     },
                                ]
                                    .filter(s => sectionLines(s.linesKey).length > 0)
                                    .map(s => (
                                        <SummaryLine key={s.letter} label={s.label} value={s.value} letter={s.letter} />
                                    ))}
                            </div>

                            {/* Net Cost */}
                            <div className="px-5 py-3 border-t border-surface-100 bg-surface-50/50">
                                <div className="flex items-center justify-between">
                                    <span className="text-sm font-bold text-surface-900">Net Cost</span>
                                    <span className="font-mono text-sm font-bold text-surface-900 tabular-nums">{fmt(estimate.net_cost)}</span>
                                </div>
                            </div>

                            {/* Adjustments */}
                            <div className="px-5 py-3 border-t border-surface-100 space-y-1.5">
                                <div className="flex items-center justify-between text-xs">
                                    <span className="text-surface-600">Overhead</span>
                                    <div className="flex items-center gap-2">
                                        <span className="text-[10px] font-semibold text-surface-400">{estimate.overhead_pct}%</span>
                                        <span className="font-mono text-surface-800 tabular-nums">+ {fmt(estimate.overhead_amount)}</span>
                                    </div>
                                </div>
                                <div className="flex items-center justify-between text-xs">
                                    <span className="text-surface-600">VAT</span>
                                    <div className="flex items-center gap-2">
                                        <span className="text-[10px] font-semibold text-surface-400">{estimate.vat_pct}%</span>
                                        <span className="font-mono text-surface-800 tabular-nums">+ {fmt(estimate.vat_amount)}</span>
                                    </div>
                                </div>
                            </div>

                            {/* Multipliers */}
                            <div className="px-5 py-2 border-t border-dashed border-surface-200 space-y-1">
                                <div className="flex items-center justify-between text-[11px] text-surface-400 italic">
                                    <span>Times factor</span>
                                    <span className="font-mono">× {estimate.times_multiplier}</span>
                                </div>
                                <div className="flex items-center justify-between text-[11px] text-surface-400 italic">
                                    <span>Quantity</span>
                                    <span className="font-mono">× {fmtInt(estimate.job_quantity)}</span>
                                </div>
                            </div>

                            {/* Grand Total — refined */}
                            <div className="relative overflow-hidden">
                                <div className="absolute inset-0 bg-gradient-to-br from-slate-900 to-slate-800" />
                                <div className="relative px-5 py-5">
                                    <div className="flex items-baseline justify-between mb-1">
                                        <span className="text-[10px] uppercase tracking-[0.2em] text-white/60 font-bold">Grand Total</span>
                                        <span className="text-[10px] text-white/40 font-mono">BDT</span>
                                    </div>
                                    <div className="font-mono font-bold text-3xl text-white tabular-nums">
                                        {fmt(estimate.grand_total)}
                                    </div>
                                </div>
                            </div>
                        </div>

                    </div>
                </div>

                {/* ── Secondary Area: Approval + Notes side-by-side ──────── */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
                    {/* Approval Workflow */}
                    {(estimate.approvals?.length > 0 || canSubmit) ? (
                        <div className="card animate-slide-up lg:col-span-2">
                            <div className="px-5 py-3 border-b border-surface-100 flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <h3 className="text-xs font-bold text-surface-900 uppercase tracking-wider">Approval Workflow</h3>
                                    {(() => {
                                        const as_ = APPROVAL_STATUS[estimate.approval_status] ?? APPROVAL_STATUS.not_submitted;
                                        return (
                                            <span className="flex items-center gap-1.5 text-[11px]">
                                                <span className={`w-1.5 h-1.5 rounded-full ${as_.dot}`} />
                                                <span className={`${as_.text} font-semibold`}>{as_.label}</span>
                                            </span>
                                        );
                                    })()}
                                </div>
                                {canSubmit && (
                                    <button onClick={() => router.post(`/cost-estimates/${estimate.id}/submit-approval`)}
                                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white bg-amber-600 hover:bg-amber-500 transition-colors">
                                        <i className="fi fi-rr-paper-plane text-[11px] leading-none" /> Submit
                                    </button>
                                )}
                            </div>
                            <div className="px-5 py-4 space-y-2.5">
                                {/* Prepared By */}
                                <ApprovalRow
                                    label="Prepared By"
                                    name={estimate.created_by ?? '—'}
                                    status="drafted"
                                    date={estimate.created_at}
                                />

                                {/* Approval Steps */}
                                {estimate.approvals?.map((a: any) => (
                                    <ApprovalRow
                                        key={a.id}
                                        label={a.label}
                                        name={a.approver?.name ?? '—'}
                                        status={a.status}
                                        date={a.acted_at}
                                        remarks={a.remarks}
                                    />
                                ))}

                                {/* Approval Action Buttons — open modal on click */}
                                {(canApprove || canReject) && (
                                    <div className="pt-3 border-t border-surface-100">
                                        <div className="flex flex-wrap items-center gap-2">
                                            {canApprove && (
                                                <button onClick={() => setApprovalAction('approve')}
                                                    className="flex-1 min-w-[120px] py-2.5 px-3 rounded-lg text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 transition-colors flex items-center justify-center gap-1.5 shadow-sm">
                                                    <i className="fi fi-rr-check text-xs leading-none" /> Approve
                                                </button>
                                            )}
                                            {canReject && (
                                                <button onClick={() => setApprovalAction('request_changes')}
                                                    className="flex-1 min-w-[120px] py-2.5 px-3 rounded-lg text-xs font-bold text-amber-700 bg-amber-50 border border-amber-200 hover:bg-amber-100 transition-colors flex items-center justify-center gap-1.5">
                                                    <i className="fi fi-rr-pencil text-xs leading-none" /> Request Changes
                                                </button>
                                            )}
                                            {canReject && (
                                                <button onClick={() => setApprovalAction('reject')}
                                                    className="flex-1 min-w-[120px] py-2.5 px-3 rounded-lg text-xs font-bold text-red-600 bg-red-50 border border-red-200 hover:bg-red-100 transition-colors flex items-center justify-center gap-1.5">
                                                    <i className="fi fi-rr-cross text-xs leading-none" /> Reject
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    ) : null}

                    {/* Notes */}
                    {estimate.notes ? (
                        <div className={`card ${(estimate.approvals?.length > 0 || canSubmit) ? '' : 'lg:col-span-2'}`}>
                            <div className="px-5 py-3 border-b border-surface-100 flex items-center gap-2">
                                <i className="fi fi-rr-document text-surface-400 text-xs leading-none" />
                                <h3 className="text-xs font-bold text-surface-900 uppercase tracking-wider">Notes</h3>
                            </div>
                            <div className="px-5 py-4 text-sm text-surface-700 whitespace-pre-wrap leading-relaxed">
                                {estimate.notes}
                            </div>
                        </div>
                    ) : (
                        /* Placeholder if no notes to keep grid aligned — invisible spacer on large screens */
                        (estimate.approvals?.length > 0 || canSubmit) && <div className="hidden lg:block" />
                    )}
                </div>

                {/* ── RFQ Attachments (drawings + sample photos) ──────── */}
                <RfqAttachmentsPanel attachments={rfqAttachments} title="RFQ Attachments" inheritedFrom="rfq" />

                {/* ── Discussion thread ─────────────────────────────────── */}
                <CommentThread
                    entityType="cost_estimate"
                    entityId={estimate.id}
                    comments={comments}
                    title="Discussion"
                />

                {/* ── Change History — full width ──────────────────────── */}
                <RevisionTimeline revisions={revisions} title="Change History" />
            </div>

            {/* Approval Action Modal */}
            <ApprovalActionModal
                open={approvalAction !== null}
                action={approvalAction}
                entityType="cost_estimate"
                entityId={estimate.id}
                entityLabel={estimate.estimate_no}
                entityTitle={estimate.job_name}
                entityAmount={estimate.grand_total}
                onConfirm={handleApprovalConfirm}
                onClose={() => setApprovalAction(null)}
            />

            {/* Use as Quotation Modal */}
            <UseAsQuotationModal
                open={useQuotationOpen}
                estimate={estimate}
                note={useQuotationNote}
                onNoteChange={setUseQuotationNote}
                submitting={useQuotationSubmitting}
                onClose={() => !useQuotationSubmitting && setUseQuotationOpen(false)}
                onConfirm={confirmUseAsQuotation}
            />

            {/* PDF popup viewer (download button is in the popup header) */}
            <PdfPopupModal
                open={pdfPopup.open}
                pdfUrl={pdfPopup.url}
                title={pdfPopup.title}
                subtitle={pdfPopup.subtitle}
                onClose={() => setPdfPopup(s => ({ ...s, open: false }))}
            />
        </AppLayout>
    );
}

/* ─── Use as Quotation Modal ────────────────────────────────── */
function UseAsQuotationModal({
    open, estimate, note, onNoteChange, submitting, onClose, onConfirm,
}: {
    open: boolean;
    estimate: any;
    note: string;
    onNoteChange: (v: string) => void;
    submitting: boolean;
    onClose: () => void;
    onConfirm: () => void;
}) {
    const aiEnabled = useAiEnabled();
    useEffect(() => {
        if (!open) return;
        const handler = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && !submitting) onClose();
            if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) onConfirm();
        };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, [open, submitting, note]);

    if (!open) return null;

    return (
        <AnimatePresence>
            <motion.div
                className="fixed inset-0 z-[200] flex items-center justify-center p-4"
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            >
                <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={onClose} />
                <motion.div
                    className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden"
                    initial={{ scale: 0.95, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 20 }}
                    transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                >
                    {/* Header */}
                    <div className="relative px-6 py-4 bg-gradient-to-r from-emerald-500 to-green-600 text-white shrink-0">
                        <div className="flex items-start justify-between gap-3">
                            <div className="flex items-start gap-3 min-w-0">
                                <div className="w-11 h-11 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center shrink-0">
                                    <i className="fi fi-rr-paper-plane text-xl leading-none" />
                                </div>
                                <div className="min-w-0">
                                    <h3 className="text-base font-bold leading-tight">Use as Quotation</h3>
                                    <p className="text-xs text-white/80 mt-0.5">
                                        <span className="font-mono font-semibold">{estimate.estimate_no}</span>
                                        {estimate.job_name && <> · {estimate.job_name}</>}
                                    </p>
                                </div>
                            </div>
                            <button
                                onClick={onClose}
                                disabled={submitting}
                                className="p-1.5 rounded-lg hover:bg-white/20 transition-colors shrink-0 disabled:opacity-50"
                                aria-label="Close"
                            >
                                <i className="fi fi-rr-cross text-sm leading-none" />
                            </button>
                        </div>
                        <div className="mt-3 flex items-center gap-2 text-xs">
                            <span className="text-white/70">Grand Total:</span>
                            <span className="font-mono font-bold text-sm">{fmt(estimate.grand_total)}</span>
                            <span className="text-white/50">BDT</span>
                        </div>
                    </div>

                    {/* Body */}
                    <div className="flex-1 overflow-y-auto p-6 space-y-4">
                        <div className="p-3 rounded-xl border bg-emerald-50 border-emerald-200 text-emerald-900 text-xs">
                            <div className="flex items-start gap-2">
                                <i className="fi fi-rr-info text-sm leading-none mt-0.5 shrink-0" />
                                <div>
                                    This estimate will be marked as <span className="font-bold">Used</span> and a
                                    new draft quotation will be pre-filled with these numbers. You can review
                                    and adjust before sending to the customer.
                                </div>
                            </div>
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-surface-700 mb-1.5">
                                Handoff Note <span className="text-surface-400 font-normal">(optional)</span>
                            </label>
                            <textarea
                                value={note}
                                onChange={e => onNoteChange(e.target.value)}
                                rows={4}
                                autoFocus
                                placeholder="Anything the preparer of the quotation should know? Pricing caveats, margin guidance, special terms..."
                                className="form-textarea w-full text-sm"
                                disabled={submitting}
                            />
                            <div className="flex items-center justify-between text-[10px] text-surface-400 mt-1">
                                <span>{note.length > 0 && `${note.length} character${note.length === 1 ? '' : 's'}`}</span>
                                <span>Ctrl+Enter to confirm · Esc to cancel</span>
                            </div>
                        </div>

                        {/* AI Assist — only when the master AI switch is on */}
                        {aiEnabled && (
                            <div className="p-3 rounded-xl bg-indigo-50/50 border border-indigo-100">
                                <div className="flex items-center gap-1.5 mb-2">
                                    <span className="text-xs font-bold text-indigo-700 uppercase tracking-wider">
                                        ✨ Oli AI Assist
                                    </span>
                                    <span className="text-[10px] text-indigo-500">— help write a handoff note for the sales team</span>
                                </div>
                                <ApprovalNoteAI
                                    action="handoff_quotation"
                                    entityType="cost_estimate"
                                    entityId={estimate.id}
                                    currentText={note}
                                    onApplyText={onNoteChange}
                                    color="emerald"
                                />
                            </div>
                        )}
                    </div>

                    {/* Footer */}
                    <div className="px-6 py-4 bg-surface-50 border-t border-surface-100 flex items-center justify-between gap-2 shrink-0">
                        <button onClick={onClose} disabled={submitting} className="btn-ghost">
                            Cancel
                        </button>
                        <button
                            onClick={onConfirm}
                            disabled={submitting}
                            className="px-5 py-2 rounded-xl text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-500 transition-colors disabled:opacity-60 shadow-md hover:shadow-lg"
                        >
                            {submitting ? (
                                <span className="inline-flex items-center gap-2">
                                    <i className="fi fi-rr-spinner animate-spin text-xs leading-none" />
                                    Creating draft...
                                </span>
                            ) : (
                                <span className="inline-flex items-center gap-2">
                                    <i className="fi fi-rr-paper-plane text-xs leading-none" />
                                    Create Quotation Draft
                                </span>
                            )}
                        </button>
                    </div>
                </motion.div>
            </motion.div>
        </AnimatePresence>
    );
}

/* ─── Meta Item (document header) ──────────────────────────── */
function MetaItem({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
    return (
        <div>
            <dt className="text-[10px] uppercase tracking-wider text-surface-400 font-bold">{label}</dt>
            <dd className={`text-sm text-surface-800 font-semibold truncate ${mono ? 'font-mono' : ''}`} title={value}>{value}</dd>
        </div>
    );
}

/* ─── Section Card ──────────────────────────────────────────── */
const SECTION_COLORS: Record<string, { accent: string; tint: string; text: string; letterBg: string }> = {
    blue:    { accent: 'bg-blue-500',    tint: 'bg-blue-50/40',    text: 'text-blue-700',    letterBg: 'bg-blue-50 text-blue-700' },
    amber:   { accent: 'bg-amber-500',   tint: 'bg-amber-50/40',   text: 'text-amber-700',   letterBg: 'bg-amber-50 text-amber-700' },
    purple:  { accent: 'bg-purple-500',  tint: 'bg-purple-50/40',  text: 'text-purple-700',  letterBg: 'bg-purple-50 text-purple-700' },
    emerald: { accent: 'bg-emerald-500', tint: 'bg-emerald-50/40', text: 'text-emerald-700', letterBg: 'bg-emerald-50 text-emerald-700' },
};

function SectionCard({ letter, title, total, lines }: any) {
    // Empty sections are filtered out by the parent, but keep this guard so
    // the component is safe to use elsewhere.
    if (!lines || lines.length === 0) return null;

    return (
        <div className="card overflow-hidden">
            {/* Compact header — uniform neutral styling, no per-section accent color */}
            <div className="flex items-center justify-between px-5 py-3 border-b border-surface-100 bg-surface-50/40">
                <div className="flex items-center gap-2.5">
                    <span className="inline-flex w-6 h-6 rounded-md bg-surface-200 text-surface-700 items-center justify-center font-bold text-[11px]">
                        {letter}
                    </span>
                    <h3 className="text-sm font-bold text-surface-900">{title}</h3>
                    <span className="text-[11px] text-surface-400 font-medium">· {lines.length} {lines.length === 1 ? 'item' : 'items'}</span>
                </div>
                <div className="font-mono text-sm font-bold text-surface-900 tabular-nums">{fmt(total)}</div>
            </div>

            {/* Lines table */}
            <div className="overflow-x-auto">
                <table className="w-full">
                    <thead>
                        <tr>
                            <th className="w-10 px-4 py-2 text-left text-[10px] font-semibold text-surface-400 uppercase tracking-wider">#</th>
                            <th className="px-4 py-2 text-left text-[10px] font-semibold text-surface-400 uppercase tracking-wider">Description</th>
                            <th className="px-4 py-2 text-right text-[10px] font-semibold text-surface-400 uppercase tracking-wider">Qty</th>
                            <th className="px-4 py-2 text-left text-[10px] font-semibold text-surface-400 uppercase tracking-wider">Unit</th>
                            <th className="px-4 py-2 text-right text-[10px] font-semibold text-surface-400 uppercase tracking-wider">Rate</th>
                            <th className="px-4 py-2 text-right text-[10px] font-semibold text-surface-400 uppercase tracking-wider">Amount</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-surface-50">
                        {lines.map((l: any, i: number) => (
                            <tr key={l.id} className="hover:bg-surface-50/40 transition-colors">
                                <td className="px-4 py-2.5 text-surface-400 font-mono text-xs align-middle">{i + 1}</td>
                                <td className="px-4 py-2.5 text-sm text-surface-900 align-middle">{l.description}</td>
                                <td className="px-4 py-2.5 text-right font-mono text-sm text-surface-700 tabular-nums align-middle">{fmtInt(l.quantity)}</td>
                                <td className="px-4 py-2.5 text-surface-500 text-xs align-middle">{l.unit}</td>
                                <td className="px-4 py-2.5 text-right font-mono text-sm text-surface-700 tabular-nums align-middle">{fmt(l.rate)}</td>
                                <td className="px-4 py-2.5 text-right font-mono text-sm font-bold text-surface-900 tabular-nums align-middle">{fmt(l.amount)}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

/* ─── Summary Line ──────────────────────────────────────────── */
function SummaryLine({ label, value, letter }: { label: string; value: number; letter: string }) {
    return (
        <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm text-surface-700">
                <span className="inline-flex w-5 h-5 rounded bg-surface-100 text-surface-600 items-center justify-center text-[10px] font-bold">
                    {letter}
                </span>
                <span>{label}</span>
            </div>
            <span className="font-mono text-surface-900 tabular-nums">{fmt(value)}</span>
        </div>
    );
}

/* ─── Approval Row ──────────────────────────────────────────── */
function ApprovalRow({ label, name, status, date, remarks }: { label: string; name: string; status: string; date?: string; remarks?: string }) {
    const config = {
        drafted: { bg: 'bg-blue-50', border: 'border-blue-100', dot: 'bg-blue-400', label: 'Drafted', icon: 'fi-rr-pencil', iconColor: 'text-blue-500' },
        pending: { bg: 'bg-amber-50', border: 'border-amber-100', dot: 'bg-amber-400', label: 'Pending', icon: 'fi-rr-clock', iconColor: 'text-amber-500' },
        approved: { bg: 'bg-emerald-50', border: 'border-emerald-100', dot: 'bg-emerald-500', label: 'Approved', icon: 'fi-rr-check', iconColor: 'text-emerald-500' },
        rejected: { bg: 'bg-red-50', border: 'border-red-100', dot: 'bg-red-500', label: 'Rejected', icon: 'fi-rr-cross', iconColor: 'text-red-500' },
    }[status] ?? { bg: 'bg-surface-50', border: 'border-surface-100', dot: 'bg-surface-400', label: 'Pending', icon: 'fi-rr-clock', iconColor: 'text-surface-500' };

    return (
        <div className={`flex items-start gap-2.5 p-2.5 rounded-lg border ${config.bg} ${config.border}`}>
            <i className={`fi ${config.icon} ${config.iconColor} text-xs leading-none mt-0.5 shrink-0`} />
            <div className="flex-1 min-w-0">
                <div className="text-[10px] uppercase tracking-wider text-surface-500 font-bold">{label}</div>
                <div className="text-xs font-semibold text-surface-900 truncate">{name}</div>
                {remarks && <div className="text-[10px] text-surface-500 italic mt-0.5">"{remarks}"</div>}
            </div>
            <div className="text-right shrink-0">
                <div className="flex items-center gap-1 text-[10px] font-bold">
                    <span className={`w-1.5 h-1.5 rounded-full ${config.dot}`} />
                    <span className={`${config.iconColor}`}>{config.label}</span>
                </div>
                {date && <div className="text-[9px] text-surface-400 mt-0.5">{date}</div>}
            </div>
        </div>
    );
}
