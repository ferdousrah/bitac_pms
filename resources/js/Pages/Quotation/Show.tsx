import AppLayout from '@/Layouts/AppLayout';
import { Link, router, useForm, usePage } from '@inertiajs/react';
import { useState, FormEvent } from 'react';
import RichTextEditor from '@/Components/RichTextEditor';
import RevisionTimeline from '@/Components/RevisionTimeline';
import ApprovalActionModal, { ApprovalAction } from '@/Components/ApprovalActionModal';
import JobTypeBadge from '@/Components/JobTypeBadge';
import RfqAttachmentsPanel from '@/Components/RfqAttachmentsPanel';
import CommentThread from '@/Components/CommentThread';
import FilePreviewModal, { PreviewableFile } from '@/Components/FilePicker/FilePreviewModal';
import PdfPopupModal from '@/Components/PdfPopupModal';

const statusBadge: Record<string, string> = {
    draft:                'badge-slate',
    pending_approval:     'badge-amber',
    approved:             'badge-green',
    sent_to_customer:     'badge-purple',
    customer_accepted:    'badge-green',
    customer_rejected:    'badge-red',
    revision_requested:   'badge-amber',
    superseded:           'badge-slate',
    rejected:             'badge-red',
    converted:            'badge-blue',
};

const statusLabel: Record<string, string> = {
    draft:                'Draft',
    pending_approval:     'Pending Approval',
    approved:             'Approved',
    sent_to_customer:     'Sent to Customer',
    customer_accepted:    'Customer Accepted',
    customer_rejected:    'Customer Rejected',
    revision_requested:   'Revision Requested',
    superseded:           'Superseded',
    rejected:             'Rejected (Internal)',
    converted:            'Converted to WO',
};

const responseTypeBadge: Record<string, string> = {
    accepted:           'badge-green',
    rejected:           'badge-red',
    revision_requested: 'badge-amber',
};

const responseTypeIcon: Record<string, string> = {
    accepted:           'fi-sr-check-circle',
    rejected:           'fi-sr-cross-circle',
    revision_requested: 'fi-sr-comment-alt-edit',
};

const fmt = (v: any) => Number(v).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/* ─── Approval Chain ──────────────────────────────────────────────────── */
function ApprovalChain({ approvals }: { approvals: any[] }) {
    if (!approvals || approvals.length === 0) {
        return (
            <div className="text-center py-6">
                <i className="fi fi-rr-shield-check text-surface-300 text-2xl leading-none" />
                <p className="text-xs text-surface-400 mt-2">No approval chain configured.</p>
            </div>
        );
    }

    // "Changes Requested" is stored at the DB level as decision=rejected with a
    // "[Changes Requested]" prefix on remarks. Detect that and re-label the badge
    // so reviewers don't think the quotation was outright rejected.
    const isChangesRequested = (a: any) =>
        a.decision === 'rejected' && typeof a.comments === 'string' && a.comments.startsWith('[Changes Requested]');

    const getStyle = (a: any) => {
        if (a.decision === 'approved') return {
            ring: 'border-emerald-300 bg-emerald-50',
            icon: 'fi fi-sr-check-circle text-emerald-500',
            text: 'text-emerald-700',
            line: 'bg-emerald-300',
            label: 'approved',
        };
        if (isChangesRequested(a)) return {
            ring: 'border-amber-300 bg-amber-50',
            icon: 'fi fi-sr-comment-alt-edit text-amber-500',
            text: 'text-amber-700',
            line: 'bg-amber-300',
            label: 'changes requested',
        };
        if (a.decision === 'rejected') return {
            ring: 'border-red-300 bg-red-50',
            icon: 'fi fi-sr-cross-circle text-red-500',
            text: 'text-red-700',
            line: 'bg-red-300',
            label: 'rejected',
        };
        return {
            ring: 'border-amber-300 bg-amber-50',
            icon: 'fi fi-sr-clock text-amber-500',
            text: 'text-amber-700',
            line: 'bg-surface-200',
            label: 'pending',
        };
    };

    return (
        <div className="space-y-3">
            {approvals.map((a: any, i: number) => {
                const style = getStyle(a);
                const displayComment = isChangesRequested(a)
                    ? a.comments.replace(/^\[Changes Requested\]\s*/, '')
                    : a.comments;
                const u = a.approver;
                return (
                    <div key={a.id} className={`border-2 rounded-xl p-4 ${style.ring}`}>
                        {/* Header row */}
                        <div className="flex items-center justify-between gap-2 mb-3 pb-2 border-b border-surface-100">
                            <div className="flex items-center gap-2 min-w-0">
                                <span className="inline-flex items-center justify-center w-6 h-6 rounded-md bg-white/70 text-[10px] font-bold text-surface-700">
                                    {a.level}
                                </span>
                                <div className="flex items-center gap-1.5">
                                    <i className={`${style.icon} text-sm leading-none`} />
                                    <span className={`text-xs font-bold capitalize ${style.text}`}>{style.label}</span>
                                </div>
                            </div>
                            {a.acted_at && (
                                <span className="text-[10px] text-surface-400 font-mono shrink-0">{a.acted_at}</span>
                            )}
                        </div>

                        {/* Approver identity block */}
                        {u && (
                            <div className="flex gap-3">
                                {/* Signature panel */}
                                <div className="shrink-0 w-28">
                                    {u.signature_url ? (
                                        <div className="rounded-lg bg-white border border-surface-200 p-2 h-14 flex items-center justify-center">
                                            <img src={u.signature_url} alt="" className="max-h-10 max-w-full object-contain" />
                                        </div>
                                    ) : (
                                        <div className="rounded-lg bg-surface-50 border border-dashed border-surface-200 h-14 flex flex-col items-center justify-center text-[9px] text-surface-400">
                                            <i className="fi fi-rr-pencil-paintbrush leading-none mb-0.5" />
                                            no signature
                                        </div>
                                    )}
                                    <div className="text-[9px] text-surface-400 uppercase tracking-wider text-center mt-1 font-semibold">Signature</div>
                                </div>

                                {/* Identity + contact */}
                                <div className="flex-1 min-w-0 space-y-0.5">
                                    <div className="text-sm font-bold text-surface-900 leading-tight">{u.name}</div>
                                    {u.designation && (
                                        <div className="text-[11px] text-surface-600 leading-tight">{u.designation}</div>
                                    )}
                                    {u.center && (
                                        <div className="text-[11px] text-surface-500 leading-tight">{u.center}</div>
                                    )}
                                    <div className="flex flex-wrap gap-x-3 gap-y-0.5 pt-1.5 text-[11px] text-surface-500">
                                        {u.email && (
                                            <a href={`mailto:${u.email}`} className="inline-flex items-center gap-1 hover:text-surface-800">
                                                <i className="fi fi-rr-envelope text-[10px] leading-none" />
                                                <span className="truncate max-w-[180px]">{u.email}</span>
                                            </a>
                                        )}
                                        {u.phone && (
                                            <a href={`tel:${u.phone}`} className="inline-flex items-center gap-1 hover:text-surface-800">
                                                <i className="fi fi-rr-phone-call text-[10px] leading-none" />
                                                {u.phone}
                                            </a>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Comment */}
                        {displayComment && (
                            <div className="mt-3 px-2.5 py-1.5 rounded-md bg-white/70 border border-surface-100 text-xs text-surface-600 italic">
                                "{displayComment}"
                            </div>
                        )}

                        {/* Forwarded-to badge */}
                        {a.forwarded_to && (
                            <div className="mt-3 px-2.5 py-2 rounded-md bg-indigo-50 border border-indigo-100 text-[11px] text-indigo-800">
                                <div className="flex items-center gap-1 font-bold mb-0.5">
                                    <i className="fi fi-rr-share text-[10px] leading-none" />
                                    Forwarded to {a.forwarded_to.name}
                                </div>
                                {a.forwarded_to.designation && (
                                    <div className="text-indigo-700">{a.forwarded_to.designation}{a.forwarded_to.center ? ` · ${a.forwarded_to.center}` : ''}</div>
                                )}
                                {a.forward_reason && (
                                    <div className="text-indigo-600 italic mt-1">"{a.forward_reason}"</div>
                                )}
                            </div>
                        )}

                        {/* Down chevron between levels */}
                        {i < approvals.length - 1 && (
                            <div className="flex justify-center mt-2">
                                <i className="fi fi-rr-angle-down text-surface-300 text-base leading-none" />
                            </div>
                        )}
                    </div>
                );
            })}
        </div>
    );
}

/* ─── Main ────────────────────────────────────────────────────────────── */
export default function QuotationShow({
    quotation, revisions = [], rfqAttachments = [], comments = [], attachments = [],
    sourceEstimates = [], forwardableUsers = [],
    canSubmitForApproval, canApprove, canReject, canRequestChanges, canSendToCustomer, canConvert,
    canRecordResponse, canCreateRevision,
}: any) {
    // Unit prices are stored VAT/Tax-inclusive. When the preparer opts to itemise
    // VAT/Tax, line items are shown EX-tax so they reconcile with the additive
    // Subtotal + VAT + Tax = Grand Total layout.
    const qHasTax = (Number(quotation.vat_amount) || 0) + (Number(quotation.tax_amount) || 0) > 0;
    const qShowBreakdown = !!quotation.show_tax_breakdown && qHasTax;
    const qTaxFactor = 1 + ((Number(quotation.vat_rate) || 0) + (Number(quotation.tax_rate) || 0)) / 100;
    const exTax = (v: any) => (qShowBreakdown && qTaxFactor > 0 ? Number(v) / qTaxFactor : Number(v));

    // Re-quotations read just "Re-Quotation"; the revision number rides at the
    // end of the Memo No. (e.g. "…028.51.(2)") instead of in the title.
    const isRevision = quotation.version > 1;
    const titleLabel = isRevision ? 'Re-Quotation' : 'Quotation';
    const memoNoDisplay = quotation.memo_no
        ? (isRevision ? `${String(quotation.memo_no).replace(/\s*$/, '')}(${quotation.version})` : quotation.memo_no)
        : '';

    const [forwardOpen, setForwardOpen] = useState(false);
    const forwardForm = useForm<any>({ forwarded_to_user_id: '', reason: '' });
    const sendForm    = useForm({});
    const convertForm = useForm<any>({
        customer_po_no:   quotation.customer_po_no ?? '',
        priority:         'normal',
        due_date:         '',
        notes:            '',
        customer_po_file: null as File | null,
    });
    const responseForm = useForm<any>({
        response_type: 'accepted',
        customer_po_no: '',
        feedback: '',
        response_date: new Date().toISOString().slice(0, 10),
        attachment: null,
    });
    const revisionForm = useForm({});

    const [showResponseModal, setShowResponseModal] = useState(false);
    const [approvalAction, setApprovalAction] = useState<ApprovalAction | null>(null);

    // Change-management revision number (from entity_revisions — increments on every event)
    const currentRevisionNo = revisions[0]?.revision_no ?? null;

    // Cost-estimate PDF popup state
    const [estimatePdf, setEstimatePdf] = useState<{ open: boolean; url: string | null; title: string; subtitle?: string }>({
        open: false, url: null, title: '',
    });
    const openEstimatePdf = (est: any) => {
        setEstimatePdf({
            open: true,
            url: est.pdf_url,
            title: `Cost Estimate ${est.estimate_no}`,
            subtitle: `${est.item_desc ?? est.job_name} · Pricing ${est.pricing_group}`,
        });
    };

    // Email-to-customer modal state
    const authUser = (usePage().props as any)?.auth?.user;
    const hasForwarding = !!(quotation.forwarding_letter && String(quotation.forwarding_letter).trim().length > 0);
    const [mail, setMail] = useState<{ open: boolean; from: string; to: string; cc: string; subject: string; message: string; lang: 'bn' | 'en'; includeFwd: boolean; sending: boolean }>({
        open: false, from: '', to: '', cc: '', subject: '', message: '', lang: 'bn', includeFwd: true, sending: false,
    });
    const openMail = () => setMail({
        open: true,
        from: authUser?.email ?? '',
        to: quotation.customer_email ?? '',
        cc: '',
        subject: `Quotation Q-${String(quotation.id).padStart(5, '0')}${typeof quotation.customer === 'string' && quotation.customer ? ` — ${quotation.customer}` : ''}`,
        message: `<p>Dear ${(typeof quotation.customer === 'string' && quotation.customer) || 'Sir/Madam'},</p><p>Please find attached our quotation${hasForwarding ? ' along with the forwarding letter' : ''} for your kind consideration.</p><p>Best regards,<br>Bangladesh Industrial Technical Assistance Centre (BITAC)</p>`,
        lang: 'bn',
        includeFwd: hasForwarding,
        sending: false,
    });
    const sendMail = () => {
        setMail(s => ({ ...s, sending: true }));
        router.post(`/quotations/${quotation.id}/email`, {
            from_email: mail.from.trim() || undefined,
            email: mail.to.trim() || undefined,
            cc: mail.cc.trim() || undefined,
            subject: mail.subject,
            message: mail.message,
            lang: mail.lang,
            include_forwarding: mail.includeFwd,
        }, {
            preserveScroll: true,
            onSuccess: () => setMail(s => ({ ...s, open: false, sending: false })),
            onError:   () => setMail(s => ({ ...s, sending: false })),
            onFinish:  () => setMail(s => ({ ...s, sending: false })),
        });
    };

    // Attachment lightbox state
    const [attachmentLightbox, setAttachmentLightbox] = useState<{ files: PreviewableFile[]; index: number; open: boolean }>({
        files: [], index: 0, open: false,
    });
    const openAttachmentPreview = (idx: number) => {
        const files: PreviewableFile[] = (attachments as any[]).map(a => ({
            id: a.id,
            url: a.url,
            filename: a.filename,
            extension: a.extension,
            mime_type: a.mime_type,
            size_bytes: a.size_bytes,
            human_size: a.human_size,
        }));
        setAttachmentLightbox({ files, index: idx, open: true });
    };
    const deleteAttachment = (id: number) => {
        if (!confirm('Remove this attachment?')) return;
        router.delete(`/quotation-files/${id}`, { preserveScroll: true });
    };

    const handleQuotationApproval = (remarks: string, signature?: string | null) => {
        if (!approvalAction) return;
        const url = approvalAction === 'approve'
            ? `/quotations/${quotation.id}/approve`
            : approvalAction === 'request_changes'
                ? `/quotations/${quotation.id}/request-changes`
                : `/quotations/${quotation.id}/reject`;
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

    const submitResponse = (e: FormEvent) => {
        e.preventDefault();
        responseForm.post(`/quotations/${quotation.id}/customer-response`, {
            forceFormData: true,
            onSuccess: () => {
                setShowResponseModal(false);
                responseForm.reset();
            },
        });
    };

    const createRevision = () => {
        if (!confirm('Create a new revision (v' + (Math.max(...quotation.revision_chain.map((q: any) => q.version)) + 1) + ') and supersede this version?')) return;
        revisionForm.post(`/quotations/${quotation.id}/revision`);
    };

    return (
        <AppLayout header={`${titleLabel} #${quotation.id}`}>
            <div className="space-y-6 animate-fade-in">

                {/* ── Revision chain banner ──────────────────────────── */}
                {quotation.revision_chain && quotation.revision_chain.length > 1 && (
                    <div className="card bg-gradient-to-r from-amber-50 to-orange-50 border-amber-200">
                        <div className="card-body">
                            <div className="flex items-center gap-3 flex-wrap">
                                <div className="flex items-center gap-2">
                                    <i className="fi fi-rr-rotate-right text-amber-600 text-base leading-none" />
                                    <span className="text-xs font-bold text-amber-900 uppercase tracking-wider">Revision Chain</span>
                                </div>
                                <div className="flex items-center gap-1.5 flex-wrap">
                                    {quotation.revision_chain.map((q: any, idx: number) => (
                                        <div key={q.id} className="flex items-center gap-1.5">
                                            <Link href={`/quotations/${q.id}`}
                                                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold transition-all
                                                    ${q.is_current ? 'bg-amber-600 text-white shadow-premium' : 'bg-white border border-amber-200 text-amber-800 hover:bg-amber-100'}`}>
                                                v{q.version}
                                                <span className="text-[9px] opacity-70">{q.status?.replace(/_/g, ' ')}</span>
                                            </Link>
                                            {idx < quotation.revision_chain.length - 1 && (
                                                <i className="fi fi-rr-arrow-right text-amber-400 text-xs leading-none" />
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* ── Header Card ──────────────────────────────────────── */}
                <div className="card">
                    <div className="card-body">
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-brand-500 to-brand-600 flex items-center justify-center shrink-0">
                                    <i className="fi fi-rr-file-invoice text-white text-lg leading-none" />
                                </div>
                                <div>
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <h2 className="text-lg font-bold text-surface-900">
                                            {titleLabel} #{quotation.id}
                                        </h2>
                                        {currentRevisionNo !== null && (
                                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-indigo-100 text-indigo-700 text-[10px] font-bold font-mono" title={`Change revision ${currentRevisionNo}`}>
                                                rev {currentRevisionNo}
                                            </span>
                                        )}
                                        <JobTypeBadge type={quotation.job_type} />
                                        <span className={`badge ${statusBadge[quotation.status] ?? 'badge-slate'}`}>
                                            {statusLabel[quotation.status] ?? quotation.status?.replace(/_/g, ' ')}
                                        </span>
                                    </div>
                                    <p className="text-sm text-surface-500 mt-0.5">{quotation.customer}</p>
                                    {quotation.memo_no && (
                                        <p className="text-xs text-surface-400 mt-0.5">
                                            <i className="fi fi-rr-document text-[10px] leading-none" /> নং: <span className="font-mono font-semibold text-surface-700">{memoNoDisplay}</span>
                                        </p>
                                    )}
                                    {quotation.customer_ref_no && (
                                        <p className="text-xs text-surface-400 mt-0.5">
                                            <i className="fi fi-rr-link text-[10px] leading-none" /> Ref: <span className="font-mono font-semibold text-surface-700">{quotation.customer_ref_no}</span>
                                            {quotation.customer_ref_date && <span className="text-surface-400"> &middot; {quotation.customer_ref_date}</span>}
                                        </p>
                                    )}
                                    {quotation.customer_po_no && (
                                        <p className="text-xs text-surface-400 mt-0.5">
                                            <i className="fi fi-rr-document text-[10px] leading-none" /> Customer PO: <span className="font-mono font-semibold text-surface-700">{quotation.customer_po_no}</span>
                                        </p>
                                    )}
                                </div>
                            </div>
                            <div className="text-right sm:text-right">
                                <div className="text-2xl font-bold text-surface-900 font-mono tracking-tight">{fmt(quotation.total_amount)}</div>
                                <div className="text-xs text-surface-400 mt-0.5">incl. {quotation.vat_rate}% VAT &middot; Valid {quotation.validity_days} days</div>
                                {quotation.work_order && (
                                    <Link href={`/work-orders/${quotation.work_order.id}`}
                                        className="inline-flex items-center gap-1 mt-1 text-xs font-semibold text-brand-600 hover:text-brand-700">
                                        <i className="fi fi-rr-tools leading-none" />
                                        WO: {quotation.work_order.wo_number} ({quotation.work_order.job_number})
                                    </Link>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                {/* ── Two-Column Layout ────────────────────────────────── */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                    {/* Left column (2/3) */}
                    <div className="lg:col-span-2 space-y-6">

                        {/* Line Items */}
                        <div className="card">
                            <div className="card-header flex items-center gap-2">
                                <i className="fi fi-rr-list text-brand-500 text-sm leading-none" />
                                <h3 className="text-sm font-bold text-surface-900">Line Items</h3>
                                {quotation.line_items?.length > 0 && (
                                    <span className="ml-auto inline-flex items-center gap-1 px-2 py-0.5 rounded bg-surface-100 text-surface-600 text-[10px] font-bold">
                                        {quotation.line_items.length} item{quotation.line_items.length === 1 ? '' : 's'}
                                    </span>
                                )}
                            </div>

                            {quotation.line_items?.length > 0 ? (
                                <div className="overflow-x-auto">
                                    <table className="w-full text-sm">
                                        <thead>
                                            <tr className="text-[10px] uppercase tracking-wider text-surface-400 font-bold border-b border-surface-100 bg-surface-50/50">
                                                <th className="text-left px-5 py-2.5 w-10">#</th>
                                                <th className="text-left px-3 py-2.5">Description</th>
                                                <th className="text-right px-3 py-2.5 w-24">Qty</th>
                                                <th className="text-right px-3 py-2.5 w-36">Unit Price</th>
                                                <th className="text-right px-5 py-2.5 w-36">Amount</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-surface-100">
                                            {quotation.line_items.map((li: any, idx: number) => (
                                                <tr key={li.id} className="hover:bg-surface-50/40 transition-colors">
                                                    <td className="px-5 py-3 text-xs text-surface-400 font-mono">{idx + 1}</td>
                                                    <td className="px-3 py-3 text-surface-800">{li.description}</td>
                                                    <td className="px-3 py-3 text-right font-mono text-surface-700 tabular-nums">{Number(li.quantity).toLocaleString('en-IN')}</td>
                                                    <td className="px-3 py-3 text-right font-mono text-surface-700 tabular-nums">{fmt(exTax(li.unit_price))}</td>
                                                    <td className="px-5 py-3 text-right font-mono font-bold text-surface-900 tabular-nums">{fmt(exTax(li.amount))}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            ) : (
                                <div className="card-body">
                                    <div className="py-6 text-center text-xs text-surface-400 italic">
                                        No line items recorded for this quotation.
                                    </div>
                                </div>
                            )}

                            {/* Totals footer — VAT and Tax shown separately. */}
                            <div className="border-t border-surface-100 px-5 py-4 bg-surface-50/30">
                                <div className="max-w-md ml-auto space-y-1.5 text-sm">
                                    {(() => {
                                        const vat   = Number(quotation.vat_amount ?? 0);
                                        const tax   = Number(quotation.tax_amount ?? 0);
                                        const disc  = Number(quotation.discount ?? 0);
                                        const total = Number(quotation.total_amount ?? 0);
                                        const hasTax = vat > 0 || tax > 0;
                                        const showBreakdown = qShowBreakdown;
                                        // Standard tax invoice when itemised: ex-tax Subtotal,
                                        // then VAT + Tax = Grand Total. Otherwise all-inclusive.
                                        const subtotal = total - vat - tax + disc;
                                        return (
                                            <>
                                                {(showBreakdown || disc > 0) && (
                                                    <div className="flex items-center justify-between text-surface-600">
                                                        <span>Subtotal</span>
                                                        <span className="font-mono tabular-nums">{fmt(showBreakdown ? subtotal : total + disc)}</span>
                                                    </div>
                                                )}
                                                {showBreakdown && vat > 0 && (
                                                    <div className="flex items-center justify-between text-surface-600">
                                                        <span>VAT <span className="text-[10px] text-surface-400">({quotation.vat_rate}%)</span></span>
                                                        <span className="font-mono tabular-nums">+ {fmt(vat)}</span>
                                                    </div>
                                                )}
                                                {showBreakdown && tax > 0 && (
                                                    <div className="flex items-center justify-between text-surface-600">
                                                        <span>Tax <span className="text-[10px] text-surface-400">({quotation.tax_rate}%)</span></span>
                                                        <span className="font-mono tabular-nums">+ {fmt(tax)}</span>
                                                    </div>
                                                )}
                                                {disc > 0 && (
                                                    <div className="flex items-center justify-between text-emerald-700">
                                                        <span>Discount {quotation.discount_type === 'percent' ? '(%)' : '(৳)'}</span>
                                                        <span className="font-mono tabular-nums">− {fmt(disc)}</span>
                                                    </div>
                                                )}
                                                <div className="flex items-center justify-between pt-2 border-t border-surface-200 mt-2">
                                                    <span className="text-base font-bold text-surface-900">Grand Total{!showBreakdown && hasTax ? ' (incl. VAT & Tax)' : ''}</span>
                                                    <span className="text-xl font-bold font-mono text-surface-900 tabular-nums">{fmt(total)}</span>
                                                </div>
                                            </>
                                        );
                                    })()}
                                </div>
                            </div>
                        </div>

                        {/* Letter content — recipient + terms (BITAC official format) */}
                        {(quotation.recipient_block || (quotation.terms && quotation.terms.length > 0)) && (
                            <div className="card">
                                <div className="card-header flex items-center gap-2">
                                    <i className="fi fi-rr-letter text-sky-500 text-sm leading-none" />
                                    <h3 className="text-sm font-bold text-surface-900">Letter Content</h3>
                                </div>
                                <div className="card-body space-y-5">
                                    {quotation.recipient_block && (
                                        <div>
                                            <div className="text-[10px] uppercase tracking-wider font-bold text-surface-400 mb-1.5">Recipient</div>
                                            <div className="text-sm font-bold text-surface-800 mb-1">To,</div>
                                            <div className="text-sm text-surface-800 whitespace-pre-line leading-relaxed font-medium">
                                                {quotation.recipient_block}
                                            </div>
                                        </div>
                                    )}
                                    {quotation.terms && quotation.terms.length > 0 && (
                                        <div>
                                            <div className="text-[10px] uppercase tracking-wider font-bold text-surface-400 mb-2">
                                                দরপত্রের শর্ত সমূহ — Terms &amp; Conditions
                                            </div>
                                            <ol className="space-y-1.5 list-decimal pl-5 text-sm text-surface-700">
                                                {quotation.terms.map((term: string, idx: number) => (
                                                    <li key={idx} className="leading-relaxed">{term}</li>
                                                ))}
                                            </ol>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* Approval Workflow */}
                        <div className="card">
                            <div className="card-header flex items-center gap-2">
                                <i className="fi fi-rr-shield-check text-brand-500 text-sm leading-none" />
                                <h3 className="text-sm font-bold text-surface-900">Approval Workflow</h3>
                            </div>
                            <div className="card-body">
                                {/* Prepared By — static info (the creator) */}
                                <div className="flex items-center gap-3 p-3 rounded-xl border bg-blue-50 border-blue-200 mb-3">
                                    <div className="w-8 h-8 rounded-lg bg-blue-500 text-white flex items-center justify-center">
                                        <i className="fi fi-rr-pencil text-xs leading-none" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="text-xs font-bold text-blue-900">Prepared By</div>
                                        <div className="text-[11px] text-blue-700">{quotation.created_by_name ?? '—'}</div>
                                    </div>
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold border bg-blue-100 text-blue-700 border-blue-200">
                                        ✍️ Drafted
                                    </span>
                                </div>
                                <ApprovalChain approvals={quotation.approvals ?? []} />

                                {/* Submit for Approval (draft only) */}
                                {canSubmitForApproval && (
                                    <div className="mt-4 p-4 rounded-xl bg-amber-50 border border-amber-200">
                                        <div className="flex items-center justify-between gap-3 flex-wrap">
                                            <div>
                                                <h4 className="text-sm font-bold text-amber-900">This quotation is in Draft</h4>
                                                <p className="text-xs text-amber-700 mt-0.5">Edit if needed, then submit for approval.</p>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <Link
                                                    href={`/quotations/${quotation.id}/edit`}
                                                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-amber-800 bg-white hover:bg-amber-100 border border-amber-300 shadow-sm transition-all"
                                                >
                                                    <i className="fi fi-rr-pencil text-sm leading-none" /> Edit
                                                </Link>
                                                <button onClick={() => router.post(`/quotations/${quotation.id}/submit-approval`)}
                                                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-white bg-amber-600 hover:bg-amber-500 shadow-md transition-all hover:-translate-y-0.5">
                                                    <i className="fi fi-rr-paper-plane text-sm leading-none" /> Submit for Approval
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* Approve / Request Changes / Reject / Forward / Edit forms */}
                                {(canApprove || canReject || canRequestChanges) && quotation.status === 'pending_approval' && (
                                    <div className="mt-6 pt-5 border-t border-surface-100 space-y-3">
                                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                            {canApprove && (
                                                <button
                                                    onClick={() => setApprovalAction('approve')}
                                                    className="btn-success w-full"
                                                >
                                                    <i className="fi fi-rr-check text-xs leading-none" />
                                                    Approve
                                                </button>
                                            )}
                                            {canRequestChanges && (
                                                <button
                                                    onClick={() => setApprovalAction('request_changes')}
                                                    className="w-full inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200 text-sm font-semibold transition-colors"
                                                >
                                                    <i className="fi fi-rr-edit text-xs leading-none" />
                                                    Request Changes
                                                </button>
                                            )}
                                            {canReject && (
                                                <button
                                                    onClick={() => setApprovalAction('reject')}
                                                    className="btn-danger w-full"
                                                >
                                                    <i className="fi fi-rr-cross text-xs leading-none" />
                                                    Reject
                                                </button>
                                            )}
                                        </div>
                                        {/* Forward + Approver Edit row */}
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                            {canApprove && (
                                                <button
                                                    onClick={() => setForwardOpen(true)}
                                                    className="w-full inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 text-sm font-semibold transition-colors"
                                                >
                                                    <i className="fi fi-rr-share text-xs leading-none" />
                                                    Forward to another reviewer
                                                </button>
                                            )}
                                            <Link
                                                href={`/quotations/${quotation.id}/edit`}
                                                className="w-full inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-surface-100 hover:bg-surface-200 text-surface-700 border border-surface-200 text-sm font-semibold transition-colors"
                                            >
                                                <i className="fi fi-rr-pencil text-xs leading-none" />
                                                Edit Quotation
                                            </Link>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* ── Customer Responses Timeline ─────────────── */}
                        {(quotation.customer_responses?.length > 0 || canRecordResponse) && (
                            <div className="card">
                                <div className="card-header flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <i className="fi fi-rr-comments text-brand-500 text-sm leading-none" />
                                        <h3 className="text-sm font-bold text-surface-900">Customer Responses</h3>
                                    </div>
                                    {canRecordResponse && (
                                        <button onClick={() => setShowResponseModal(true)} className="btn-primary btn-sm">
                                            <i className="fi fi-rr-plus text-xs leading-none" />
                                            Record Response
                                        </button>
                                    )}
                                </div>
                                <div className="card-body p-0">
                                    {quotation.customer_responses?.length === 0 ? (
                                        <div className="empty-state">
                                            <div className="empty-state-icon"><i className="fi fi-rr-comment-dots" /></div>
                                            <div className="empty-state-title">No customer response yet</div>
                                            <div className="empty-state-text">Quotation has been sent. Awaiting customer feedback.</div>
                                        </div>
                                    ) : (
                                        <div className="divide-y divide-surface-50">
                                            {quotation.customer_responses.map((r: any) => (
                                                <div key={r.id} className="px-5 py-4">
                                                    <div className="flex items-start gap-3">
                                                        <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0
                                                            ${r.response_type === 'accepted' ? 'bg-emerald-50 text-emerald-600' :
                                                              r.response_type === 'rejected' ? 'bg-red-50 text-red-600' :
                                                              'bg-amber-50 text-amber-600'}`}>
                                                            <i className={`fi ${responseTypeIcon[r.response_type]} text-base leading-none`} />
                                                        </div>
                                                        <div className="flex-1 min-w-0">
                                                            <div className="flex items-center gap-2 flex-wrap">
                                                                <span className={`badge ${responseTypeBadge[r.response_type]} capitalize`}>
                                                                    {r.response_type.replace(/_/g, ' ')}
                                                                </span>
                                                                <span className="text-xs text-surface-500">{r.response_date}</span>
                                                                {r.recorded_by && <span className="text-xs text-surface-400">· logged by {r.recorded_by}</span>}
                                                            </div>
                                                            {r.customer_po_no && (
                                                                <div className="mt-1.5 text-sm">
                                                                    <span className="text-surface-500">Customer PO:</span>{' '}
                                                                    <span className="font-mono font-semibold text-surface-800">{r.customer_po_no}</span>
                                                                </div>
                                                            )}
                                                            {r.feedback && (
                                                                <p className="text-sm text-surface-700 mt-1.5 italic">"{r.feedback}"</p>
                                                            )}
                                                            {r.attachment_url && (
                                                                <a href={r.attachment_url} target="_blank" rel="noreferrer"
                                                                    className="inline-flex items-center gap-1 mt-2 text-xs font-semibold text-brand-600 hover:text-brand-700">
                                                                    <i className="fi fi-rr-paperclip text-[10px] leading-none" />
                                                                    View attachment
                                                                </a>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* ── Create Revision (when revision_requested) ─── */}
                        {canCreateRevision && (
                            <div className="card border-2 border-amber-200 bg-amber-50/30">
                                <div className="card-body flex items-center justify-between gap-3">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center">
                                            <i className="fi fi-rr-rotate-right text-amber-600 text-base leading-none" />
                                        </div>
                                        <div>
                                            <h4 className="text-sm font-bold text-amber-900">Customer requested revision</h4>
                                            <p className="text-xs text-amber-700 mt-0.5">Create a new version with the requested changes. The new version will go through approval again.</p>
                                        </div>
                                    </div>
                                    <button onClick={createRevision} disabled={revisionForm.processing}
                                        className="btn-sm shrink-0 inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-semibold text-xs transition-all active:scale-95">
                                        <i className="fi fi-rr-plus text-xs leading-none" /> Create Revision
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* Issue Work Order */}
                        {canConvert && (
                            <div className="card animate-scale-in">
                                <div className="card-header flex items-center gap-2">
                                    <i className="fi fi-rr-briefcase text-brand-500 text-sm leading-none" />
                                    <div>
                                        <h3 className="text-sm font-bold text-surface-900">Issue Work Order</h3>
                                        <p className="text-xs text-surface-400 mt-0.5">Customer accepted — fill in PO details and create the Work Order</p>
                                    </div>
                                </div>
                                <div className="card-body">
                                    <form onSubmit={e => { e.preventDefault(); convertForm.post(`/quotations/${quotation.id}/convert`, { forceFormData: true }); }}
                                        className="space-y-4">
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                            <div className="form-group">
                                                <label className="form-label">Customer PO / Reference No.</label>
                                                <input
                                                    type="text"
                                                    value={convertForm.data.customer_po_no}
                                                    onChange={e => convertForm.setData('customer_po_no', e.target.value)}
                                                    placeholder="e.g. PO-2024-456"
                                                    className="form-input"
                                                />
                                            </div>
                                            <div className="form-group">
                                                <label className="form-label">Priority</label>
                                                <select
                                                    value={convertForm.data.priority}
                                                    onChange={e => convertForm.setData('priority', e.target.value)}
                                                    className="form-select"
                                                >
                                                    <option value="low">Low</option>
                                                    <option value="normal">Normal</option>
                                                    <option value="high">High</option>
                                                    <option value="urgent">Urgent</option>
                                                </select>
                                            </div>
                                        </div>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                            <div className="form-group">
                                                <label className="form-label">Due Date</label>
                                                <input
                                                    type="date"
                                                    value={convertForm.data.due_date}
                                                    onChange={e => convertForm.setData('due_date', e.target.value)}
                                                    className="form-input"
                                                />
                                            </div>
                                            <div className="form-group">
                                                <label className="form-label">Notes</label>
                                                <input
                                                    type="text"
                                                    value={convertForm.data.notes}
                                                    onChange={e => convertForm.setData('notes', e.target.value)}
                                                    placeholder="Any special instructions..."
                                                    className="form-input"
                                                />
                                            </div>
                                        </div>

                                        {/* Customer PO file — audit trail + legal proof */}
                                        <div className="form-group">
                                            <label className="form-label flex items-center gap-1.5">
                                                <i className="fi fi-rr-paperclip text-xs leading-none text-amber-600" />
                                                Customer PO / Work Order Copy
                                                <span className="form-label-optional">(strongly recommended)</span>
                                            </label>
                                            {convertForm.data.customer_po_file ? (
                                                <div className="flex items-center gap-3 p-2.5 bg-amber-50 rounded-lg border border-amber-200">
                                                    <div className="w-9 h-9 rounded-lg bg-amber-100 flex items-center justify-center text-amber-700 text-[10px] font-bold shrink-0">
                                                        {(convertForm.data.customer_po_file as File).name.split('.').pop()?.toUpperCase() ?? 'FILE'}
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <div className="text-xs font-semibold text-surface-900 truncate">{(convertForm.data.customer_po_file as File).name}</div>
                                                        <div className="text-[10px] text-surface-500">{((convertForm.data.customer_po_file as File).size / 1024).toFixed(0)} KB</div>
                                                    </div>
                                                    <button type="button"
                                                        onClick={() => convertForm.setData('customer_po_file', null)}
                                                        className="text-surface-400 hover:text-red-600 text-xs"
                                                    >
                                                        ✕ Remove
                                                    </button>
                                                </div>
                                            ) : (
                                                <label className="flex flex-col items-center justify-center gap-1 p-4 rounded-lg border-2 border-dashed border-amber-300 bg-amber-50/40 hover:bg-amber-50 cursor-pointer transition-colors">
                                                    <i className="fi fi-rr-cloud-upload text-amber-500 text-base leading-none" />
                                                    <span className="text-xs font-semibold text-amber-800">Click to upload customer's PO / WO document</span>
                                                    <span className="text-[10px] text-amber-600">PDF / image / Word · max 10 MB · attached to the work order as audit trail</span>
                                                    <input
                                                        type="file"
                                                        accept=".pdf,image/*,.doc,.docx"
                                                        className="hidden"
                                                        onChange={(e) => convertForm.setData('customer_po_file', e.target.files?.[0] ?? null)}
                                                    />
                                                </label>
                                            )}
                                            {(convertForm.errors as any).customer_po_file && (
                                                <p className="form-error">{(convertForm.errors as any).customer_po_file}</p>
                                            )}
                                        </div>
                                        <button type="submit" disabled={convertForm.processing} className="btn-primary">
                                            <i className="fi fi-rr-briefcase text-xs leading-none" />
                                            {convertForm.processing ? 'Creating...' : 'Issue Work Order'}
                                        </button>
                                    </form>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Right sidebar (1/3) */}
                    <div className="space-y-6">

                        {/* Details card */}
                        <div className="card">
                            <div className="card-header">
                                <h3 className="text-xs font-semibold text-surface-400 uppercase tracking-wider">Details</h3>
                            </div>
                            <div className="card-body space-y-4">
                                {/* Customer's Ref No. */}
                                {quotation.customer_ref_no && (
                                    <div>
                                        <dt className="text-xs text-surface-400 font-medium">Customer Ref No.</dt>
                                        <dd className="text-sm font-mono font-semibold text-surface-800 mt-0.5">{quotation.customer_ref_no}</dd>
                                        {quotation.customer_ref_date && (
                                            <div className="text-[11px] text-surface-400 mt-0.5">dated {quotation.customer_ref_date}</div>
                                        )}
                                    </div>
                                )}

                                {/* Memo No. */}
                                {quotation.memo_no && (
                                    <div>
                                        <dt className="text-xs text-surface-400 font-medium">Memo No.</dt>
                                        <dd className="text-sm font-mono font-semibold text-surface-800 mt-0.5 break-all">{memoNoDisplay}</dd>
                                    </div>
                                )}

                                {/* Prepared By — full block with signature + contact */}
                                <div className="pt-3 border-t border-surface-100">
                                    <dt className="text-xs text-surface-400 font-medium mb-1.5">Prepared By</dt>
                                    {quotation.created_by ? (
                                        <div className="space-y-1">
                                            {quotation.created_by.signature_url && (
                                                <div className="rounded-lg bg-white border border-surface-200 p-2 h-12 flex items-center justify-center mb-1.5">
                                                    <img src={quotation.created_by.signature_url} alt="" className="max-h-9 max-w-full object-contain" />
                                                </div>
                                            )}
                                            <div className="text-sm font-bold text-surface-900">{quotation.created_by.name}</div>
                                            {quotation.created_by.designation && (
                                                <div className="text-[11px] text-surface-600">{quotation.created_by.designation}</div>
                                            )}
                                            {quotation.created_by.center && (
                                                <div className="text-[11px] text-surface-500">{quotation.created_by.center}</div>
                                            )}
                                            <div className="flex flex-wrap gap-x-2.5 gap-y-0.5 pt-1 text-[11px] text-surface-500">
                                                {quotation.created_by.email && (
                                                    <a href={`mailto:${quotation.created_by.email}`} className="inline-flex items-center gap-1 hover:text-surface-800">
                                                        <i className="fi fi-rr-envelope text-[10px] leading-none" />
                                                        <span className="truncate max-w-[140px]">{quotation.created_by.email}</span>
                                                    </a>
                                                )}
                                                {quotation.created_by.phone && (
                                                    <a href={`tel:${quotation.created_by.phone}`} className="inline-flex items-center gap-1 hover:text-surface-800">
                                                        <i className="fi fi-rr-phone-call text-[10px] leading-none" />
                                                        {quotation.created_by.phone}
                                                    </a>
                                                )}
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="text-sm font-semibold text-surface-800">{quotation.created_by_name}</div>
                                    )}
                                </div>

                                <div>
                                    <dt className="text-xs text-surface-400 font-medium">Date</dt>
                                    <dd className="text-sm text-surface-700 mt-0.5">{quotation.created_at}</dd>
                                </div>

                                {quotation.notes && (
                                    <div>
                                        <dt className="text-xs text-surface-400 font-medium">Notes</dt>
                                        <dd className="text-sm text-surface-600 mt-0.5 leading-relaxed">{quotation.notes}</dd>
                                    </div>
                                )}
                                {quotation.line_items?.length > 0 && (
                                    <div className="pt-3 border-t border-surface-100">
                                        <dt className="text-xs text-surface-400 font-medium">Line Items</dt>
                                        <dd className="text-sm text-surface-700 mt-0.5">
                                            {quotation.line_items.length} item{quotation.line_items.length === 1 ? '' : 's'} · {fmt(quotation.total_amount)} BDT (Grand Total)
                                        </dd>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Action buttons */}
                        <div className="card">
                            <div className="card-body space-y-2.5">
                                {/* PDF preview popup (download button is inside the popup header) */}
                                <button
                                    type="button"
                                    onClick={() => setEstimatePdf({
                                        open:     true,
                                        url:      `/quotations/${quotation.id}/pdf?preview=base64`,
                                        title:    `Quotation Q-${String(quotation.id).padStart(5, '0')} v${quotation.version}`,
                                        subtitle: typeof quotation.customer === 'string' ? quotation.customer : quotation.customer?.name,
                                    })}
                                    className="btn-secondary w-full"
                                >
                                    <i className="fi fi-rr-file-pdf text-sm leading-none" />
                                    Preview / Download PDF
                                </button>

                                {/* Forwarding Letter PDF — Bangla & English variants */}
                                {quotation.forwarding_letter && quotation.forwarding_letter.trim().length > 0 && (
                                    <div>
                                        <div className="text-[10px] uppercase tracking-wider font-bold text-surface-400 mb-1.5 flex items-center gap-1.5">
                                            <i className="fi fi-rr-envelope text-[11px] leading-none" /> Forwarding Letter PDF
                                        </div>
                                        <div className="grid grid-cols-2 gap-2">
                                            {([['bn', 'বাংলা'], ['en', 'English']] as const).map(([lng, label]) => (
                                                <button
                                                    key={lng}
                                                    type="button"
                                                    onClick={() => setEstimatePdf({
                                                        open:     true,
                                                        url:      `/quotations/${quotation.id}/forwarding-letter/pdf?preview=base64&lang=${lng}`,
                                                        title:    `Forwarding Letter (${label}) — Q-${String(quotation.id).padStart(5, '0')}`,
                                                        subtitle: quotation.forwarding_letter_subject ?? '',
                                                    })}
                                                    className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 text-sm font-semibold transition-colors"
                                                >
                                                    <i className="fi fi-rr-file-pdf text-sm leading-none" />
                                                    {label}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* Email to Customer — quotation + forwarding letter together */}
                                <button
                                    type="button"
                                    onClick={openMail}
                                    className="w-full inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-sky-50 hover:bg-sky-100 text-sky-700 border border-sky-200 text-sm font-semibold transition-colors"
                                >
                                    <i className="fi fi-rr-envelope text-sm leading-none" />
                                    Email to Customer
                                </button>

                                {/* Send to Customer */}
                                {canSendToCustomer && (
                                    <form onSubmit={e => { e.preventDefault(); sendForm.post(`/quotations/${quotation.id}/send`); }}>
                                        <button type="submit" disabled={sendForm.processing}
                                            className="btn w-full bg-purple-600 text-white hover:bg-purple-500 focus-visible:ring-purple-500">
                                            <i className="fi fi-rr-paper-plane text-sm leading-none" />
                                            Mark as Sent to Customer
                                        </button>
                                    </form>
                                )}

                                {quotation.status === 'sent_to_customer' && (
                                    <button onClick={() => setShowResponseModal(true)}
                                        className="btn w-full bg-purple-50 text-purple-700 border border-purple-200 hover:bg-purple-100 font-semibold">
                                        <i className="fi fi-rr-comment text-sm leading-none" />
                                        Record Customer Response
                                    </button>
                                )}

                                {quotation.status === 'customer_accepted' && !quotation.work_order && (
                                    <div className="alert alert-success text-center !py-2">
                                        <i className="fi fi-rr-check-circle text-emerald-500 text-sm leading-none" />
                                        <span className="text-xs font-semibold text-emerald-700">Customer accepted — ready to issue Work Order</span>
                                    </div>
                                )}

                                {quotation.rfq_id && (
                                    <Link href={`/rfqs/${quotation.rfq_id}`} className="btn-outline w-full">
                                        <i className="fi fi-rr-document text-sm leading-none" />
                                        View RFQ
                                    </Link>
                                )}

                                {sourceEstimates.length > 0 && (
                                    <button
                                        type="button"
                                        onClick={() => openEstimatePdf(sourceEstimates[0])}
                                        className="btn-outline w-full text-indigo-700 border-indigo-200 hover:bg-indigo-50"
                                        title={`Preview ${sourceEstimates[0].estimate_no} PDF`}
                                    >
                                        <i className="fi fi-rr-calculator text-sm leading-none" />
                                        View Cost Estimate
                                        {sourceEstimates.length > 1 && (
                                            <span className="ml-1 inline-flex items-center px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-700 text-[10px] font-bold">
                                                +{sourceEstimates.length - 1}
                                            </span>
                                        )}
                                    </button>
                                )}

                                <Link href="/quotations" className="btn-ghost w-full">
                                    <i className="fi fi-rr-arrow-left text-xs leading-none" />
                                    Back to Quotations
                                </Link>
                            </div>
                        </div>
                    </div>
                </div>

                {/* ── RFQ Attachments — full width ──────────────────────── */}
                <RfqAttachmentsPanel attachments={rfqAttachments} title="RFQ Attachments" inheritedFrom="rfq" />

                {/* ── Quotation Attachments uploaded by the preparer ───── */}
                {attachments.length > 0 && (
                    <div className="card">
                        <div className="px-5 py-3 border-b border-surface-100 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <i className="fi fi-rr-paperclip text-surface-400 text-xs leading-none" />
                                <h3 className="text-xs font-bold text-surface-900 uppercase tracking-wider">Quotation Attachments</h3>
                                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-amber-50 border border-amber-100 text-[10px] font-bold text-amber-700">
                                    {attachments.length}
                                </span>
                            </div>
                            <span className="text-[10px] text-surface-400 italic">Uploaded by the preparer</span>
                        </div>
                        <div className="divide-y divide-surface-100">
                            {attachments.map((a: any, idx: number) => {
                                const isImage = /^(jpg|jpeg|png|gif|webp)$/i.test(a.extension ?? '');
                                const kindColor: Record<string, string> = {
                                    supporting: 'bg-blue-50 text-blue-700 border-blue-200',
                                    annexure:   'bg-purple-50 text-purple-700 border-purple-200',
                                    spec:       'bg-emerald-50 text-emerald-700 border-emerald-200',
                                    other:      'bg-surface-100 text-surface-600 border-surface-200',
                                };
                                return (
                                    <div key={a.id} className="px-5 py-3 flex items-center gap-3">
                                        {isImage ? (
                                            <button
                                                onClick={() => openAttachmentPreview(idx)}
                                                className="w-10 h-10 rounded-lg overflow-hidden shrink-0 hover:ring-2 hover:ring-brand-400 transition-all"
                                            >
                                                <img src={a.url} alt="" className="w-full h-full object-cover" />
                                            </button>
                                        ) : (
                                            <div className="w-10 h-10 rounded-lg bg-amber-100 text-amber-700 text-[10px] font-bold flex items-center justify-center shrink-0">
                                                {a.extension?.toUpperCase() ?? 'FILE'}
                                            </div>
                                        )}
                                        <div className="flex-1 min-w-0">
                                            <div className="text-sm font-semibold text-surface-900 truncate">{a.filename}</div>
                                            <div className="text-[10px] text-surface-400 flex items-center gap-2 flex-wrap mt-0.5">
                                                <span className={`inline-flex items-center px-1.5 py-0.5 rounded border text-[9px] font-bold uppercase tracking-wider ${kindColor[a.kind] ?? kindColor.other}`}>
                                                    {a.kind}
                                                </span>
                                                {a.human_size && <span>{a.human_size}</span>}
                                                <span>· by {a.uploaded_by ?? '—'}</span>
                                                <span>· {a.uploaded_at}</span>
                                            </div>
                                        </div>
                                        <button
                                            onClick={() => openAttachmentPreview(idx)}
                                            className="btn-outline btn-xs"
                                            title="Preview"
                                        >
                                            <i className="fi fi-rr-eye text-xs leading-none" /> View
                                        </button>
                                        <a
                                            href={a.url}
                                            download={a.filename}
                                            className="btn-ghost btn-xs"
                                            title="Download"
                                        >
                                            <i className="fi fi-rr-download text-xs leading-none" />
                                        </a>
                                        {a.can_delete && (
                                            <button
                                                onClick={() => deleteAttachment(a.id)}
                                                className="w-7 h-7 rounded-lg flex items-center justify-center text-surface-400 hover:bg-red-50 hover:text-red-600 transition-colors"
                                                title="Remove"
                                            >
                                                <i className="fi fi-rr-trash text-xs leading-none" />
                                            </button>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}

                {/* ── Discussion thread ─────────────────────────────────── */}
                <CommentThread
                    entityType="quotation"
                    entityId={quotation.id}
                    comments={comments}
                    title="Discussion"
                />

                {/* ── Change Management / Revision History — full width ── */}
                <RevisionTimeline revisions={revisions} title="Change History" />
            </div>

            {/* ─── Cost Estimate PDF Popup ───────────────────────────── */}
            <PdfPopupModal
                open={estimatePdf.open}
                pdfUrl={estimatePdf.url}
                title={estimatePdf.title}
                subtitle={estimatePdf.subtitle}
                onClose={() => setEstimatePdf(s => ({ ...s, open: false }))}
            />

            {/* ─── Email to Customer modal ───────────────────────────── */}
            {mail.open && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40" onClick={() => !mail.sending && setMail(s => ({ ...s, open: false }))}>
                    <div className="relative overflow-hidden bg-white rounded-2xl shadow-xl w-full max-w-3xl animate-fade-in" onClick={e => e.stopPropagation()}>
                        {mail.sending && (
                            <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-5 bg-white/85 backdrop-blur-sm">
                                <style>{`
                                    @keyframes planeFly { 0%{transform:translate(-16px,10px) rotate(-8deg);opacity:0} 25%{opacity:1} 70%{opacity:1} 100%{transform:translate(18px,-12px) rotate(-8deg);opacity:0} }
                                    @keyframes ringPulse { 0%,100%{transform:scale(1);opacity:.35} 50%{transform:scale(1.18);opacity:.7} }
                                    @keyframes dotPulse { 0%,80%,100%{opacity:.2} 40%{opacity:1} }
                                `}</style>
                                <div className="relative w-20 h-20 flex items-center justify-center">
                                    <span className="absolute inset-0 rounded-full bg-brand-100" style={{ animation: 'ringPulse 1.6s ease-in-out infinite' }} />
                                    <span className="absolute inset-0 rounded-full border-4 border-brand-200 border-t-brand-500 animate-spin" />
                                    <i className="fi fi-rr-paper-plane text-brand-600 text-2xl relative" style={{ animation: 'planeFly 1.2s ease-in-out infinite' }} />
                                </div>
                                <div className="text-sm font-semibold text-surface-700">
                                    Sending email
                                    <span style={{ animation: 'dotPulse 1.4s infinite' }}>.</span>
                                    <span style={{ animation: 'dotPulse 1.4s infinite .2s' }}>.</span>
                                    <span style={{ animation: 'dotPulse 1.4s infinite .4s' }}>.</span>
                                </div>
                                <div className="text-[11px] text-surface-400">Attaching the documents and delivering now</div>
                            </div>
                        )}
                        <div className="flex items-center gap-2 px-5 py-4 border-b border-surface-100">
                            <i className="fi fi-rr-envelope text-sky-500 text-sm leading-none" />
                            <h3 className="text-sm font-bold text-surface-900">Email Quotation to Customer</h3>
                            <button onClick={() => setMail(s => ({ ...s, open: false }))} className="ml-auto w-7 h-7 inline-flex items-center justify-center rounded-lg text-surface-400 hover:bg-surface-100">
                                <i className="fi fi-rr-cross-small text-base leading-none" />
                            </button>
                        </div>
                        <div className="p-5 space-y-3.5">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                                <div className="form-group !mb-0">
                                    <label className="form-label">From</label>
                                    <input type="email" value={mail.from} onChange={e => setMail(s => ({ ...s, from: e.target.value }))} className="form-input" placeholder="your.name@bitac.gov.bd" />
                                </div>
                                <div className="form-group !mb-0">
                                    <label className="form-label">To</label>
                                    <input type="email" value={mail.to} onChange={e => setMail(s => ({ ...s, to: e.target.value }))} className="form-input" placeholder="customer@example.com" />
                                </div>
                            </div>
                            <div className="form-group !mb-0">
                                <label className="form-label">CC <span className="form-label-optional">(optional)</span></label>
                                <input type="text" value={mail.cc} onChange={e => setMail(s => ({ ...s, cc: e.target.value }))} className="form-input" placeholder="one@x.com, two@y.com" />
                            </div>
                            <div className="form-group !mb-0">
                                <label className="form-label">Subject</label>
                                <input type="text" value={mail.subject} onChange={e => setMail(s => ({ ...s, subject: e.target.value }))} className="form-input" required />
                            </div>
                            <div className="form-group !mb-0">
                                <label className="form-label">Message</label>
                                <RichTextEditor value={mail.message} onChange={(html) => setMail(s => ({ ...s, message: html }))} placeholder="Write your message…" minHeight="180px" />
                            </div>
                            <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
                                {hasForwarding && (
                                    <label className="inline-flex items-center gap-2 text-sm text-surface-700 cursor-pointer">
                                        <input type="checkbox" checked={mail.includeFwd} onChange={e => setMail(s => ({ ...s, includeFwd: e.target.checked }))} className="rounded border-surface-300" />
                                        Attach forwarding letter
                                    </label>
                                )}
                                {hasForwarding && (
                                    <div className="flex items-center gap-2">
                                        <span className="text-xs text-surface-500">Forwarding letter language:</span>
                                        {(['bn', 'en'] as const).map(lng => (
                                            <button key={lng} type="button" onClick={() => setMail(s => ({ ...s, lang: lng }))}
                                                className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition-colors ${mail.lang === lng ? 'bg-brand-500 text-white border-brand-500' : 'bg-surface-50 text-surface-600 border-surface-200 hover:bg-surface-100'}`}>
                                                {lng === 'bn' ? 'বাংলা' : 'English'}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                            <p className="text-[11px] text-surface-400">
                                <i className="fi fi-rr-paperclip text-[10px] leading-none mr-1" />
                                Attachments: Quotation PDF{hasForwarding && mail.includeFwd ? ' + Forwarding Letter PDF' : ''}.
                            </p>
                        </div>
                        <div className="flex items-center justify-end gap-2.5 px-5 py-4 border-t border-surface-100">
                            <button onClick={() => setMail(s => ({ ...s, open: false }))} className="btn-ghost" disabled={mail.sending}>Cancel</button>
                            <button onClick={sendMail} className="btn-primary" disabled={mail.sending || !mail.subject.trim()}>
                                <i className="fi fi-rr-paper-plane text-sm leading-none" /> {mail.sending ? 'Sending…' : 'Send Email'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ─── Attachment Lightbox ───────────────────────────────── */}
            <FilePreviewModal
                open={attachmentLightbox.open}
                files={attachmentLightbox.files}
                initialIndex={attachmentLightbox.index}
                onClose={() => setAttachmentLightbox(s => ({ ...s, open: false }))}
            />

            {/* ─── Approval Action Modal ─────────────────────────────── */}
            <ApprovalActionModal
                open={approvalAction !== null}
                action={approvalAction}
                entityType="quotation"
                entityId={quotation.id}
                entityLabel={`Quotation #${quotation.id} v${quotation.version}`}
                entityTitle={quotation.customer?.name}
                entityAmount={quotation.total_amount}
                onConfirm={handleQuotationApproval}
                onClose={() => setApprovalAction(null)}
            />

            {/* ─── Customer Response Modal ─────────────────────────────── */}
            {showResponseModal && (
                <>
                    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm animate-fade-in" onClick={() => setShowResponseModal(false)} />
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                        <div className="bg-white rounded-2xl shadow-premium-lg border border-surface-100 w-full max-w-2xl animate-scale-in max-h-[90vh] overflow-y-auto">
                            <div className="px-5 py-4 border-b border-surface-100 flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <div className="w-9 h-9 rounded-xl bg-purple-50 flex items-center justify-center">
                                        <i className="fi fi-rr-comment text-purple-600 text-base leading-none" />
                                    </div>
                                    <div>
                                        <h3 className="text-base font-bold text-surface-900">Record Customer Response</h3>
                                        <p className="text-xs text-surface-400 mt-0.5">Capture how the customer responded to this quotation</p>
                                    </div>
                                </div>
                                <button onClick={() => setShowResponseModal(false)} className="btn-ghost btn-icon">
                                    <i className="fi fi-rr-cross text-base leading-none" />
                                </button>
                            </div>

                            <form onSubmit={submitResponse} className="p-5 space-y-4">
                                {/* Response type selector */}
                                <div className="form-group">
                                    <label className="form-label">Response Type *</label>
                                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                                        {[
                                            { value: 'accepted',           label: 'Accepted',          icon: 'fi-sr-check-circle',     color: 'emerald' },
                                            { value: 'revision_requested', label: 'Revision Requested',icon: 'fi-sr-comment-alt-edit', color: 'amber' },
                                            { value: 'rejected',           label: 'Rejected',          icon: 'fi-sr-cross-circle',     color: 'red' },
                                        ].map(opt => (
                                            <button key={opt.value} type="button"
                                                onClick={() => responseForm.setData('response_type', opt.value)}
                                                className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 transition-all
                                                    ${responseForm.data.response_type === opt.value
                                                        ? `border-${opt.color}-500 bg-${opt.color}-50 text-${opt.color}-700`
                                                        : 'border-surface-200 text-surface-500 hover:border-surface-300'}`}>
                                                <i className={`fi ${opt.icon} text-lg leading-none`} />
                                                <span className="text-xs font-semibold">{opt.label}</span>
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* Customer PO (only for accepted) */}
                                {responseForm.data.response_type === 'accepted' && (
                                    <div className="form-group animate-slide-up">
                                        <label className="form-label">Customer PO / Reference No. *</label>
                                        <input type="text" value={responseForm.data.customer_po_no}
                                            onChange={e => responseForm.setData('customer_po_no', e.target.value)}
                                            placeholder="e.g. PO-2024-456"
                                            className="form-input font-mono" required />
                                        {responseForm.errors.customer_po_no && <p className="form-error">{responseForm.errors.customer_po_no}</p>}
                                    </div>
                                )}

                                {/* Feedback (required for revision/rejected) */}
                                <div className="form-group">
                                    <label className="form-label">
                                        {responseForm.data.response_type === 'accepted' ? 'Notes' : 'Feedback / Reason'}
                                        {responseForm.data.response_type !== 'accepted' && ' *'}
                                    </label>
                                    <textarea value={responseForm.data.feedback}
                                        onChange={e => responseForm.setData('feedback', e.target.value)}
                                        rows={3} className="form-textarea"
                                        placeholder={
                                            responseForm.data.response_type === 'revision_requested'
                                                ? 'What changes are requested? (price, delivery, specs, etc.)'
                                                : responseForm.data.response_type === 'rejected'
                                                    ? 'Why was the quotation rejected?'
                                                    : 'Any acceptance conditions or notes...'
                                        }
                                        required={responseForm.data.response_type !== 'accepted'} />
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div className="form-group">
                                        <label className="form-label">Response Date *</label>
                                        <input type="date" value={responseForm.data.response_date}
                                            onChange={e => responseForm.setData('response_date', e.target.value)}
                                            className="form-input" required />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">Attachment <span className="form-label-optional">PO/letter</span></label>
                                        <input type="file" accept=".pdf,.jpg,.jpeg,.png"
                                            onChange={e => responseForm.setData('attachment', e.target.files?.[0] ?? null)}
                                            className="block w-full text-xs text-surface-500 file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-brand-50 file:text-brand-700" />
                                    </div>
                                </div>

                                <div className="flex items-center gap-3 pt-3 border-t border-surface-100">
                                    <button type="submit" disabled={responseForm.processing} className="btn-primary">
                                        {responseForm.processing ? (
                                            <><i className="fi fi-rr-spinner animate-spin text-sm leading-none" /> Saving...</>
                                        ) : (
                                            <><i className="fi fi-rr-check text-sm leading-none" /> Save Response</>
                                        )}
                                    </button>
                                    <button type="button" onClick={() => setShowResponseModal(false)} className="btn-outline">
                                        Cancel
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </>
            )}

            {/* Forward Approval Modal */}
            {forwardOpen && (
                <>
                    <div className="fixed inset-0 z-[80] bg-black/50 backdrop-blur-sm" onClick={() => setForwardOpen(false)} />
                    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
                        <div className="bg-white rounded-2xl shadow-premium-lg border border-surface-100 w-full max-w-md animate-scale-in">
                            <div className="px-5 py-4 border-b border-surface-100 flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <div className="w-9 h-9 rounded-xl bg-indigo-50 flex items-center justify-center">
                                        <i className="fi fi-rr-share text-indigo-600 leading-none" />
                                    </div>
                                    <div>
                                        <h3 className="text-base font-bold text-surface-900">Forward Approval</h3>
                                        <p className="text-xs text-surface-500">Pick someone outside the configured chain.</p>
                                    </div>
                                </div>
                                <button onClick={() => setForwardOpen(false)} className="btn-ghost btn-icon">
                                    <i className="fi fi-rr-cross text-base leading-none" />
                                </button>
                            </div>
                            <form
                                onSubmit={(e) => {
                                    e.preventDefault();
                                    forwardForm.post(`/quotations/${quotation.id}/forward-approval`, {
                                        preserveScroll: true,
                                        onSuccess: () => { setForwardOpen(false); forwardForm.reset(); },
                                    });
                                }}
                                className="p-5 space-y-4"
                            >
                                <div className="form-group !mb-0">
                                    <label className="form-label">Forward to</label>
                                    <select
                                        value={forwardForm.data.forwarded_to_user_id}
                                        onChange={e => forwardForm.setData('forwarded_to_user_id', e.target.value)}
                                        className="form-select"
                                        required
                                    >
                                        <option value="">— Select reviewer —</option>
                                        {(forwardableUsers ?? []).map((u: any) => (
                                            <option key={u.id} value={u.id}>{u.name}{u.designation ? ` · ${u.designation}` : ''}</option>
                                        ))}
                                    </select>
                                    {forwardForm.errors.forwarded_to_user_id && <p className="form-error">{forwardForm.errors.forwarded_to_user_id as any}</p>}
                                </div>
                                <div className="form-group !mb-0">
                                    <label className="form-label">Reason <span className="form-label-optional">(optional)</span></label>
                                    <textarea
                                        value={forwardForm.data.reason}
                                        onChange={e => forwardForm.setData('reason', e.target.value)}
                                        rows={3}
                                        placeholder="Why are you forwarding this?"
                                        className="form-textarea text-sm"
                                    />
                                </div>
                                <div className="rounded-lg bg-indigo-50/50 border border-indigo-100 p-3 text-[11px] text-indigo-800 flex gap-2">
                                    <i className="fi fi-rr-info text-indigo-500 leading-none mt-0.5 shrink-0" />
                                    <span>The forwarded reviewer can approve or reject on your behalf. Their decision completes your step.</span>
                                </div>
                                <div className="flex items-center justify-end gap-2 pt-2 border-t border-surface-100">
                                    <button type="button" onClick={() => setForwardOpen(false)} className="btn-ghost btn-sm">Cancel</button>
                                    <button type="submit" disabled={forwardForm.processing || !forwardForm.data.forwarded_to_user_id} className="btn-primary btn-sm">
                                        {forwardForm.processing ? 'Forwarding…' : 'Forward'}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </>
            )}
        </AppLayout>
    );
}
