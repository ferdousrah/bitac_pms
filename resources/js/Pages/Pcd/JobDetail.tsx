import React, { useState } from 'react';
import { Link } from '@inertiajs/react';
import AppLayout from '@/Layouts/AppLayout';
import PdfPopupModal from '@/Components/PdfPopupModal';
import JobTypeBadge from '@/Components/JobTypeBadge';

interface RfqItem {
    description: string;
    quantity: number;
    unit: string;
}

interface MaterialRequisition {
    id: number;
    mrn_number: string;
    status: string;
    item_count: number;
    request_date: string;
}

interface SectionEntry {
    id: number;
    section: {
        id: number;
        name: string;
        code: string;
    };
    sequence: number;
    status: string;
    completed_at: string | null;
}

interface OperationSheet {
    id: number;
    sheet_number: string;
    step_count: number;
}

interface Job {
    id: number;
    job_number: number;
    wo_number: string;
    job_type?: string;
    customer: string;
    customer_po_no: string | null;
    quantity: number;
    priority: string;
    due_date: string | null;
    status: string;
    notes: string | null;
    pcd_handoff_at: string;
    released_at: string | null;
    rfq_items: RfqItem[];
    material_requisitions: MaterialRequisition[];
    sections: SectionEntry[];
    operation_sheet: OperationSheet | null;
    attachments: Array<{
        id: number;
        kind: string;
        url: string;
        filename: string;
        extension: string | null;
        human_size: string | null;
        description: string | null;
        uploaded_by: string | null;
        uploaded_at: string;
    }>;
    all_attachments: Array<{
        id: number;
        source: 'rfq_drawing' | 'rfq_sample' | 'quotation' | 'work_order';
        kind: string | null;
        url: string;
        filename: string;
        extension: string | null;
        human_size: string | null;
        mime_type: string | null;
        description: string | null;
        item_description: string | null;
        uploaded_by: string | null;
        uploaded_at: string | null;
    }>;
    rfq_source: {
        id: number;
        rfq_no: string;
        created_at: string | null;
        pdf_url: string;
        view_url: string;
    } | null;
    quotation_source: {
        id: number;
        version: number;
        quotation_no: string;
        total_amount: number;
        status: string;
        pdf_url: string;
        view_url: string;
    } | null;
    cancellation?: {
        cancelled_at: string | null;
        cancelled_by: string | null;
        reason: string | null;
        attachments: Array<{
            id: number;
            url: string;
            filename: string;
            extension: string | null;
            human_size: string | null;
        }>;
    } | null;
}

interface ChecklistItem {
    done: boolean;
    label: string;
    icon: string;
}

interface ChecklistSectionItem extends ChecklistItem {
    count: number;
}

interface Checklist {
    material_requisition: ChecklistItem;
    section_assign: ChecklistSectionItem;
    operation_sheet: ChecklistItem;
    all_done: boolean;
    released: boolean;
}

interface Props {
    job: Job;
    checklist: Checklist;
}

const priorityBadgeClass = (priority: string): string => {
    switch (priority?.toLowerCase()) {
        case 'urgent':
        case 'high':
            return 'badge badge-red';
        case 'medium':
            return 'badge badge-amber';
        case 'low':
            return 'badge badge-blue';
        default:
            return 'badge badge-slate';
    }
};

const statusBadgeClass = (status: string): string => {
    const s = status?.toLowerCase();
    if (['released', 'completed', 'done', 'approved'].includes(s)) return 'badge badge-green';
    if (['pending', 'draft', 'new'].includes(s)) return 'badge badge-amber';
    if (['in_progress', 'active', 'processing'].includes(s)) return 'badge badge-blue';
    if (['rejected', 'cancelled', 'canceled'].includes(s)) return 'badge badge-red';
    return 'badge badge-slate';
};

const formatDate = (date: string | null): string => {
    if (!date) return '—';
    try {
        return new Date(date).toLocaleDateString('en-GB', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
        });
    } catch {
        return date;
    }
};

const formatDateTime = (date: string | null): string => {
    if (!date) return '—';
    try {
        return new Date(date).toLocaleString('en-GB', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        });
    } catch {
        return date;
    }
};

export default function JobDetail({ job, checklist }: Props) {
    const firstMrId = job.material_requisitions[0]?.id;
    const mrHref = firstMrId
        ? `/pcd/material-requisitions/${firstMrId}`
        : `/pcd/material-requisitions/create?work_order_id=${job.id}`;
    const sectionsHref = `/pcd/work-orders/${job.id}/sections`;
    const opSheetHref = job.operation_sheet
        ? `/operation-sheets/${job.operation_sheet.id}`
        : `/operation-sheets/${job.id}/create`;

    // PDF popup state — used by the Source Documents card to preview the
    // upstream RFQ and approved Quotation without leaving the PCD workflow.
    const [pdfPopup, setPdfPopup] = useState<{ open: boolean; url: string | null; title: string; subtitle?: string }>({
        open: false, url: null, title: '',
    });

    // Collapsible state for the reference sections — collapsed by default so
    // the workflow steps remain the focus when the PCD officer opens the page.
    const [sourceDocsOpen, setSourceDocsOpen] = useState(false);
    const [jobItemsOpen, setJobItemsOpen] = useState(false);
    const [docsOpen, setDocsOpen] = useState(false);

    const steps = [
        {
            number: 1,
            key: 'material_requisition',
            done: checklist.material_requisition.done,
            label: checklist.material_requisition.label,
            icon: checklist.material_requisition.icon || 'fi-rr-box',
            href: mrHref,
            subtitle: checklist.material_requisition.done
                ? `${job.material_requisitions.length} MR${job.material_requisitions.length > 1 ? 's' : ''} created`
                : 'Not started',
        },
        {
            number: 2,
            key: 'section_assign',
            done: checklist.section_assign.done,
            label: 'Work Order',
            icon: checklist.section_assign.icon || 'fi-rr-diagram-project',
            href: sectionsHref,
            subtitle: checklist.section_assign.done
                ? `${checklist.section_assign.count} shop${checklist.section_assign.count > 1 ? 's' : ''} routed`
                : 'Not created',
        },
        {
            number: 3,
            key: 'operation_sheet',
            done: checklist.operation_sheet.done,
            label: checklist.operation_sheet.label,
            icon: checklist.operation_sheet.icon || 'fi-rr-document',
            href: opSheetHref,
            subtitle: checklist.operation_sheet.done
                ? `${job.operation_sheet?.step_count ?? 0} steps`
                : 'Not created',
        },
    ];

    const pendingSteps = steps.filter((s) => !s.done).map((s) => s.label);

    return (
        <AppLayout
            header={
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-brand-50 flex items-center justify-center">
                        <i className="fi fi-rr-briefcase text-brand-600 text-lg leading-none" />
                    </div>
                    <div>
                        <h1 className="text-xl font-bold text-surface-900">
                            PCD Job #{job.job_number}
                        </h1>
                        <p className="text-sm text-surface-500">
                            Process the 3-step PCD workflow to release this job
                        </p>
                    </div>
                </div>
            }
        >
            <div className="space-y-6 animate-fade-in">
                {/* Header Card */}
                <div className="card">
                    <div className="card-body">
                        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
                            <div className="flex items-start gap-4 flex-1 min-w-0">
                                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center shrink-0 shadow-md">
                                    <i className="fi fi-rr-briefcase text-white text-2xl leading-none" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex flex-wrap items-center gap-2 mb-1">
                                        <h2 className="text-2xl font-bold text-surface-900">
                                            Job #{job.job_number}
                                        </h2>
                                        <JobTypeBadge type={job.job_type} />
                                        <span className={statusBadgeClass(job.status)}>
                                            {job.status}
                                        </span>
                                        <span className={priorityBadgeClass(job.priority)}>
                                            {job.priority}
                                        </span>
                                    </div>
                                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-surface-600">
                                        <span className="flex items-center gap-1.5">
                                            <i className="fi fi-rr-document text-surface-400" />
                                            {job.wo_number}
                                        </span>
                                        <span className="flex items-center gap-1.5">
                                            <i className="fi fi-rr-building text-surface-400" />
                                            {job.customer}
                                        </span>
                                        {job.customer_po_no && (
                                            <span className="flex items-center gap-1.5">
                                                <i className="fi fi-rr-receipt text-surface-400" />
                                                PO: {job.customer_po_no}
                                            </span>
                                        )}
                                        <span className="flex items-center gap-1.5">
                                            <i className="fi fi-rr-calendar text-surface-400" />
                                            Due: {formatDate(job.due_date)}
                                        </span>
                                        <span className="flex items-center gap-1.5">
                                            <i className="fi fi-rr-time-past text-surface-400" />
                                            Handoff: {formatDateTime(job.pcd_handoff_at)}
                                        </span>
                                    </div>
                                </div>
                            </div>
                            <div className="shrink-0">
                                <Link href="/pcd/inbox" className="btn-outline btn-sm">
                                    <i className="fi fi-rr-arrow-left mr-1.5" />
                                    Back to Inbox
                                </Link>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Cancellation banner — visible only when the job is closed */}
                {job.cancellation && (
                    <div className="card border-rose-300 overflow-hidden">
                        <div className="px-5 py-3 bg-gradient-to-r from-rose-500 to-rose-700 text-white flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <i className="fi fi-rr-cross-circle text-base leading-none" />
                                <span className="text-sm font-bold uppercase tracking-wider">Job Closed</span>
                            </div>
                            <span className="text-[11px] text-white/80">{job.cancellation.cancelled_at}</span>
                        </div>
                        <div className="card-body space-y-3">
                            <div className="text-sm">
                                <span className="text-surface-500">Closed by:</span>{' '}
                                <span className="font-semibold text-surface-900">{job.cancellation.cancelled_by ?? '—'}</span>
                            </div>
                            <div>
                                <div className="text-xs font-semibold text-surface-500 uppercase tracking-wider mb-1">Reason</div>
                                <div className="text-sm text-surface-800 whitespace-pre-line bg-rose-50/60 border border-rose-100 rounded-xl px-3 py-2.5">
                                    {job.cancellation.reason}
                                </div>
                            </div>
                            {job.cancellation.attachments?.length > 0 && (
                                <div>
                                    <div className="text-xs font-semibold text-surface-500 uppercase tracking-wider mb-2">Office Order / Supporting Documents</div>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                        {job.cancellation.attachments.map((f: any) => (
                                            <a
                                                key={f.id}
                                                href={f.url}
                                                target="_blank"
                                                rel="noreferrer"
                                                className="flex items-center gap-3 px-3 py-2.5 rounded-xl border border-surface-100 bg-white hover:border-brand-300 hover:bg-brand-50/30 transition-colors"
                                            >
                                                <div className="w-10 h-10 rounded-lg bg-rose-50 text-rose-700 text-[10px] font-bold flex items-center justify-center shrink-0">
                                                    {(f.extension ?? 'FILE').toUpperCase()}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <div className="text-xs font-semibold text-surface-800 truncate">{f.filename}</div>
                                                    <div className="text-[10px] text-surface-400">{f.human_size}</div>
                                                </div>
                                                <i className="fi fi-rr-download text-surface-400 text-sm" />
                                            </a>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* Customer PO / authorisation document — audit trail */}
                {(() => {
                    const customerPo = job.attachments?.find(a => a.kind === 'customer_po');
                    if (!customerPo) {
                        return (
                            <div className="rounded-2xl border-2 border-dashed border-amber-200 bg-amber-50/40 p-4 flex items-start gap-3">
                                <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center shrink-0">
                                    <i className="fi fi-rr-triangle-warning text-amber-600 text-base leading-none" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="text-sm font-bold text-amber-900">No Customer PO document on file</div>
                                    <p className="text-xs text-amber-700 mt-0.5">The customer's signed PO / Work Order copy wasn't attached when this job was created. Ask the IED team to upload it — needed as audit proof.</p>
                                </div>
                            </div>
                        );
                    }
                    const ext = (customerPo.extension ?? customerPo.filename.split('.').pop() ?? 'FILE').toUpperCase();
                    return (
                        <div className="card overflow-hidden">
                            <div className="px-5 py-3 bg-gradient-to-r from-indigo-500 to-purple-500 text-white flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <i className="fi fi-rr-receipt text-base leading-none" />
                                    <span className="text-xs font-bold uppercase tracking-wider">Customer PO / Work Order Copy</span>
                                </div>
                                <span className="text-[10px] text-white/80 italic">Audit reference</span>
                            </div>
                            <div className="card-body flex items-center gap-3">
                                <div className="w-12 h-12 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-700 text-[11px] font-bold shrink-0">
                                    {ext}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="text-sm font-semibold text-surface-900 truncate">{customerPo.filename}</div>
                                    <div className="text-[11px] text-surface-500 mt-0.5">
                                        {customerPo.human_size && <>{customerPo.human_size} · </>}
                                        uploaded by {customerPo.uploaded_by ?? '—'} · {customerPo.uploaded_at}
                                    </div>
                                    {job.customer_po_no && (
                                        <div className="text-[11px] text-surface-600 font-mono mt-0.5">PO No.: {job.customer_po_no}</div>
                                    )}
                                </div>
                                <a href={customerPo.url} target="_blank" rel="noreferrer" className="btn-outline btn-sm">
                                    <i className="fi fi-rr-eye text-xs leading-none" /> Open
                                </a>
                                <a href={customerPo.url} download={customerPo.filename} className="btn-primary btn-sm">
                                    <i className="fi fi-rr-download text-xs leading-none" /> Download
                                </a>
                            </div>
                        </div>
                    );
                })()}

                {/* PCD Progress Banner */}
                <div className="card animate-slide-up">
                    <div className="card-header">
                        <div className="flex items-center justify-between">
                            <div>
                                <h3 className="text-base font-semibold text-surface-900">
                                    PCD Workflow Progress
                                </h3>
                                <p className="text-xs text-surface-500 mt-0.5">
                                    Complete all 3 steps to release this job to the shops
                                </p>
                            </div>
                            {checklist.all_done && !checklist.released && (
                                <span className="badge badge-green">
                                    <i className="fi fi-rr-check-circle mr-1" />
                                    Ready to Release
                                </span>
                            )}
                        </div>
                    </div>
                    <div className="card-body">
                        {checklist.released && (
                            <div className="alert alert-success mb-5">
                                <i className="fi fi-rr-check-circle text-lg leading-none" />
                                <div>
                                    <div className="font-semibold">
                                        Job released to shops
                                    </div>
                                    <div className="text-sm">
                                        Released at {formatDateTime(job.released_at)}
                                    </div>
                                </div>
                            </div>
                        )}

                        {!checklist.released && pendingSteps.length > 0 && (
                            <div className="alert alert-warning mb-5">
                                <i className="fi fi-rr-exclamation text-lg leading-none" />
                                <div>
                                    <div className="font-semibold">Pending steps</div>
                                    <div className="text-sm">
                                        {pendingSteps.join(', ')}
                                    </div>
                                </div>
                            </div>
                        )}

                        {!checklist.released && checklist.all_done && (
                            <div className="alert alert-info mb-5">
                                <i className="fi fi-rr-info text-lg leading-none" />
                                <div>
                                    <div className="font-semibold">
                                        All steps complete
                                    </div>
                                    <div className="text-sm">
                                        This job is ready to be released to the shops.
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Steps pipeline */}
                        <div className="relative">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-0">
                                {steps.map((step, idx) => (
                                    <div
                                        key={step.key}
                                        className="relative flex-1"
                                    >
                                        {/* Connector line */}
                                        {idx < steps.length - 1 && (
                                            <div className="hidden md:block absolute top-7 left-1/2 right-0 h-0.5 bg-surface-200 z-0">
                                                <div
                                                    className={`h-full ${step.done ? 'bg-green-500' : 'bg-surface-200'}`}
                                                    style={{ width: '100%' }}
                                                />
                                            </div>
                                        )}
                                        <Link
                                            href={step.href}
                                            className="relative z-10 block group"
                                        >
                                            <div className="flex flex-col items-center text-center px-2">
                                                <div
                                                    className={`w-14 h-14 rounded-full flex items-center justify-center border-4 transition-all ${
                                                        step.done
                                                            ? 'bg-green-500 border-green-100 text-white'
                                                            : 'bg-white border-brand-100 text-brand-600 group-hover:border-brand-300'
                                                    }`}
                                                >
                                                    {step.done ? (
                                                        <i className="fi fi-rr-check text-xl leading-none" />
                                                    ) : (
                                                        <span className="text-lg font-bold">
                                                            {step.number}
                                                        </span>
                                                    )}
                                                </div>
                                                <div className="mt-3">
                                                    <div className="flex items-center justify-center gap-1.5 font-semibold text-surface-900 group-hover:text-brand-600 transition-colors">
                                                        <i className={`fi ${step.icon} text-sm leading-none`} />
                                                        {step.label}
                                                    </div>
                                                    <div className="text-xs text-surface-500 mt-0.5">
                                                        {step.subtitle}
                                                    </div>
                                                    <div className="mt-2">
                                                        {step.done ? (
                                                            <span className="badge badge-green">
                                                                Completed
                                                            </span>
                                                        ) : (
                                                            <span className="badge badge-amber">
                                                                Pending
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        </Link>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Two-column grid */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Left column */}
                    <div className="lg:col-span-2 space-y-6">
                        {/* Source Documents — collapsible. RFQ (IED form) + approved Quotation letter */}
                        {(job.rfq_source || job.quotation_source) && (
                            <div className="card">
                                <button
                                    type="button"
                                    onClick={() => setSourceDocsOpen(o => !o)}
                                    className="card-header w-full flex items-center justify-between hover:bg-surface-50/60 transition-colors text-left"
                                    aria-expanded={sourceDocsOpen}
                                >
                                    <div className="min-w-0">
                                        <div className="flex items-center gap-2">
                                            <i className="fi fi-rr-document-signed text-brand-600" />
                                            <h3 className="text-base font-semibold text-surface-900">
                                                Source Documents
                                            </h3>
                                            <span className="badge badge-slate">
                                                {(job.rfq_source ? 1 : 0) + (job.quotation_source ? 1 : 0)}
                                            </span>
                                        </div>
                                        <p className="text-xs text-surface-500 mt-1">
                                            Preview the upstream IED documents this job inherited from.
                                        </p>
                                    </div>
                                    <i className={`fi fi-rr-angle-${sourceDocsOpen ? 'up' : 'down'} text-surface-400 text-sm leading-none shrink-0 ml-3`} />
                                </button>
                                {sourceDocsOpen && (
                                <div className="card-body">
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                        {job.rfq_source && (
                                            <button
                                                type="button"
                                                onClick={() => setPdfPopup({
                                                    open: true,
                                                    url: job.rfq_source!.pdf_url,
                                                    title: job.rfq_source!.rfq_no,
                                                    subtitle: `Issued ${job.rfq_source!.created_at ?? '—'}`,
                                                })}
                                                className="group flex items-start gap-3 p-3 rounded-xl bg-blue-50/50 border border-blue-200 hover:border-blue-400 hover:bg-blue-50 text-left transition-all"
                                            >
                                                <div className="w-11 h-11 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center shrink-0">
                                                    <i className="fi fi-rr-clipboard-list text-lg leading-none" />
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <div className="text-[10px] uppercase tracking-wider font-bold text-blue-600">RFQ — IED Form</div>
                                                    <div className="text-sm font-bold text-blue-900 font-mono mt-0.5">{job.rfq_source.rfq_no}</div>
                                                    {job.rfq_source.created_at && (
                                                        <div className="text-[11px] text-blue-700 mt-0.5">Issued {job.rfq_source.created_at}</div>
                                                    )}
                                                    <div className="text-[10px] text-blue-600 mt-1 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                        <i className="fi fi-rr-eye text-[9px] leading-none" />
                                                        Click to preview PDF
                                                    </div>
                                                </div>
                                                <i className="fi fi-rr-file-pdf text-blue-400 text-base leading-none" />
                                            </button>
                                        )}

                                        {job.quotation_source && (
                                            <button
                                                type="button"
                                                onClick={() => setPdfPopup({
                                                    open: true,
                                                    url: job.quotation_source!.pdf_url,
                                                    title: job.quotation_source!.quotation_no,
                                                    subtitle: `${job.customer} · BDT ${job.quotation_source!.total_amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
                                                })}
                                                className="group flex items-start gap-3 p-3 rounded-xl bg-emerald-50/50 border border-emerald-200 hover:border-emerald-400 hover:bg-emerald-50 text-left transition-all"
                                            >
                                                <div className="w-11 h-11 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                                                    <i className="fi fi-rr-file-invoice-dollar text-lg leading-none" />
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <div className="text-[10px] uppercase tracking-wider font-bold text-emerald-600">Approved Quotation</div>
                                                    <div className="text-sm font-bold text-emerald-900 font-mono mt-0.5">{job.quotation_source.quotation_no}</div>
                                                    <div className="text-[11px] text-emerald-700 mt-0.5 font-mono">
                                                        BDT {job.quotation_source.total_amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                    </div>
                                                    <div className="text-[10px] text-emerald-600 mt-1 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                        <i className="fi fi-rr-eye text-[9px] leading-none" />
                                                        Click to preview PDF
                                                    </div>
                                                </div>
                                                <i className="fi fi-rr-file-pdf text-emerald-400 text-base leading-none" />
                                            </button>
                                        )}
                                    </div>
                                </div>
                                )}
                            </div>
                        )}

                        {/* Job Items — collapsible */}
                        <div className="card">
                            <button
                                type="button"
                                onClick={() => setJobItemsOpen(o => !o)}
                                className="card-header w-full flex items-center justify-between hover:bg-surface-50/60 transition-colors"
                                aria-expanded={jobItemsOpen}
                            >
                                <div className="flex items-center gap-2">
                                    <i className="fi fi-rr-boxes text-brand-600" />
                                    <h3 className="text-base font-semibold text-surface-900">
                                        Job Items
                                    </h3>
                                    <span className="badge badge-slate">
                                        {job.rfq_items.length}
                                    </span>
                                </div>
                                <i className={`fi fi-rr-angle-${jobItemsOpen ? 'up' : 'down'} text-surface-400 text-sm leading-none`} />
                            </button>
                            {jobItemsOpen && (
                            <div className="card-body p-0">
                                {job.rfq_items.length > 0 ? (
                                    <div className="overflow-x-auto">
                                        <table className="premium-table w-full">
                                            <thead>
                                                <tr>
                                                    <th className="text-left w-12">#</th>
                                                    <th className="text-left">Description</th>
                                                    <th className="text-right">Quantity</th>
                                                    <th className="text-left">Unit</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {job.rfq_items.map((item, idx) => (
                                                    <tr key={idx}>
                                                        <td className="text-surface-500">
                                                            {idx + 1}
                                                        </td>
                                                        <td className="font-medium text-surface-900">
                                                            {item.description}
                                                        </td>
                                                        <td className="text-right font-semibold text-surface-900">
                                                            {item.quantity}
                                                        </td>
                                                        <td className="text-surface-600">
                                                            {item.unit}
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                ) : (
                                    <div className="empty-state">
                                        <div className="empty-state-icon">
                                            <i className="fi fi-rr-box" />
                                        </div>
                                        <div className="empty-state-title">No items</div>
                                        <div className="empty-state-text">
                                            This job has no line items.
                                        </div>
                                    </div>
                                )}
                            </div>
                            )}
                        </div>

                        {/* All Job Documents — collapsible, aggregated from RFQ, Quotation, and Work Order */}
                        {job.all_attachments && job.all_attachments.length > 0 && (
                            <div className="card">
                                <button
                                    type="button"
                                    onClick={() => setDocsOpen(o => !o)}
                                    className="card-header w-full flex items-center justify-between hover:bg-surface-50/60 transition-colors text-left"
                                    aria-expanded={docsOpen}
                                >
                                    <div className="min-w-0">
                                        <div className="flex items-center gap-2">
                                            <i className="fi fi-rr-folder-open text-brand-600" />
                                            <h3 className="text-base font-semibold text-surface-900">
                                                All Job Documents
                                            </h3>
                                            <span className="badge badge-slate">{job.all_attachments.length}</span>
                                        </div>
                                        <p className="text-xs text-surface-500 mt-1">
                                            Every attachment inherited from the upstream RFQ, Quotation, and Work Order — one view.
                                        </p>
                                    </div>
                                    <i className={`fi fi-rr-angle-${docsOpen ? 'up' : 'down'} text-surface-400 text-sm leading-none shrink-0 ml-3`} />
                                </button>
                                {docsOpen && (
                                <div className="card-body">
                                    {(() => {
                                        const SOURCE_META: Record<string, { label: string; color: string; icon: string }> = {
                                            rfq_drawing:  { label: 'RFQ Drawing',   color: 'bg-blue-50 text-blue-700 border-blue-200',       icon: 'fi-rr-blueprint' },
                                            rfq_sample:   { label: 'RFQ Sample',    color: 'bg-violet-50 text-violet-700 border-violet-200', icon: 'fi-rr-picture' },
                                            quotation:    { label: 'Quotation',     color: 'bg-emerald-50 text-emerald-700 border-emerald-200', icon: 'fi-rr-document' },
                                            work_order:   { label: 'Work Order',    color: 'bg-amber-50 text-amber-700 border-amber-200',    icon: 'fi-rr-tools' },
                                        };
                                        // Group by source for readability — PCD usually reviews drawings first.
                                        const SOURCE_ORDER = ['rfq_drawing', 'rfq_sample', 'quotation', 'work_order'];
                                        const grouped = SOURCE_ORDER
                                            .map(src => ({ src, files: job.all_attachments.filter(a => a.source === src) }))
                                            .filter(g => g.files.length > 0);

                                        return (
                                            <div className="space-y-4">
                                                {grouped.map(group => {
                                                    const meta = SOURCE_META[group.src];
                                                    return (
                                                        <div key={group.src}>
                                                            <div className="flex items-center gap-2 mb-2">
                                                                <i className={`fi ${meta.icon} text-surface-500 text-sm`} />
                                                                <span className="text-xs font-bold text-surface-700 uppercase tracking-wider">{meta.label}</span>
                                                                <span className="text-[10px] text-surface-400">({group.files.length})</span>
                                                            </div>
                                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                                                {group.files.map((f) => (
                                                                    <a
                                                                        key={`${group.src}-${f.id}`}
                                                                        href={f.url}
                                                                        target="_blank"
                                                                        rel="noopener noreferrer"
                                                                        className="flex items-center gap-3 p-2.5 bg-white rounded-lg border border-surface-100 hover:border-brand-200 hover:shadow-sm transition-all"
                                                                    >
                                                                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-[10px] font-bold border shrink-0 ${meta.color}`}>
                                                                            {f.extension || 'FILE'}
                                                                        </div>
                                                                        <div className="flex-1 min-w-0">
                                                                            <div className="text-xs font-semibold text-surface-900 truncate">{f.filename}</div>
                                                                            <div className="text-[10px] text-surface-400 flex items-center gap-1.5 mt-0.5">
                                                                                {f.human_size && <span>{f.human_size}</span>}
                                                                                {f.kind && <><span>·</span><span className="capitalize">{f.kind.replace(/_/g, ' ')}</span></>}
                                                                                {f.uploaded_by && <><span>·</span><span>by {f.uploaded_by}</span></>}
                                                                            </div>
                                                                            {f.item_description && (
                                                                                <div className="text-[10px] text-surface-500 truncate mt-0.5 italic">
                                                                                    For: {f.item_description}
                                                                                </div>
                                                                            )}
                                                                        </div>
                                                                        <i className="fi fi-rr-arrow-up-right-from-square text-surface-400 text-xs leading-none shrink-0" />
                                                                    </a>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        );
                                    })()}
                                </div>
                                )}
                            </div>
                        )}

                        {/* Material Requisitions */}
                        <div className="card">
                            <div className="card-header">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <i className="fi fi-rr-box-alt text-brand-600" />
                                        <h3 className="text-base font-semibold text-surface-900">
                                            Material Requisitions
                                        </h3>
                                        <span className="badge badge-slate">
                                            {job.material_requisitions.length}
                                        </span>
                                    </div>
                                    <Link
                                        href={`/pcd/material-requisitions/create?work_order_id=${job.id}`}
                                        className="btn-primary btn-sm"
                                    >
                                        <i className="fi fi-rr-plus mr-1.5" />
                                        Create New MR
                                    </Link>
                                </div>
                            </div>
                            <div className="card-body">
                                {job.material_requisitions.length > 0 ? (
                                    <div className="space-y-2">
                                        {job.material_requisitions.map((mr) => (
                                            <div
                                                key={mr.id}
                                                className="flex items-center justify-between p-3 rounded-lg border border-surface-200 hover:border-brand-300 hover:bg-brand-50/30 transition-all"
                                            >
                                                <div className="flex items-center gap-3 min-w-0">
                                                    <div className="w-10 h-10 rounded-lg bg-brand-50 flex items-center justify-center shrink-0">
                                                        <i className="fi fi-rr-box-alt text-brand-600" />
                                                    </div>
                                                    <div className="min-w-0">
                                                        <div className="font-semibold text-surface-900 truncate">
                                                            {mr.mrn_number}
                                                        </div>
                                                        <div className="text-xs text-surface-500">
                                                            {mr.item_count} item{mr.item_count !== 1 ? 's' : ''} · {formatDate(mr.request_date)}
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-2 shrink-0">
                                                    <span className={statusBadgeClass(mr.status)}>
                                                        {mr.status}
                                                    </span>
                                                    <Link
                                                        href={`/pcd/material-requisitions/${mr.id}`}
                                                        className="btn-ghost btn-xs"
                                                    >
                                                        View
                                                        <i className="fi fi-rr-arrow-right ml-1" />
                                                    </Link>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="empty-state">
                                        <div className="empty-state-icon">
                                            <i className="fi fi-rr-box-alt" />
                                        </div>
                                        <div className="empty-state-title">
                                            No material requisitions
                                        </div>
                                        <div className="empty-state-text">
                                            Create the first MR to request materials for this job.
                                        </div>
                                        <Link
                                            href={`/pcd/material-requisitions/create?work_order_id=${job.id}`}
                                            className="btn-primary btn-sm mt-3"
                                        >
                                            <i className="fi fi-rr-plus mr-1.5" />
                                            Create MR
                                        </Link>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Work Order — PCD's internal routing slip. Defines the ordered
                            list of production shops the job will pass through. Shops
                            pick up the job from their inbox in this sequence. */}
                        <div className="card">
                            <div className="card-header">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <i className="fi fi-rr-diagram-project text-brand-600" />
                                        <h3 className="text-base font-semibold text-surface-900">
                                            Work Order
                                        </h3>
                                        <span className="badge badge-slate">
                                            {job.sections.length} {job.sections.length === 1 ? 'shop' : 'shops'}
                                        </span>
                                    </div>
                                    {job.sections.length > 0 && (
                                        <Link
                                            href={sectionsHref}
                                            className="btn-outline btn-sm"
                                        >
                                            <i className="fi fi-rr-edit mr-1.5" />
                                            Edit
                                        </Link>
                                    )}
                                </div>
                                <p className="text-xs text-surface-500 mt-1">
                                    Routing of production shops — each shop picks up this job in sequence.
                                </p>
                            </div>
                            <div className="card-body">
                                {job.sections.length > 0 ? (
                                    <div className="space-y-3">
                                        {[...job.sections]
                                            .sort((a, b) => a.sequence - b.sequence)
                                            .map((s, idx, arr) => (
                                                <div key={s.id} className="relative">
                                                    <div className="flex items-center gap-3 p-3 rounded-lg border border-surface-200 bg-white">
                                                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center text-white font-bold shrink-0">
                                                            {s.sequence}
                                                        </div>
                                                        <div className="flex-1 min-w-0">
                                                            <div className="font-semibold text-surface-900 truncate">
                                                                {s.section.name}
                                                            </div>
                                                            <div className="text-xs text-surface-500">
                                                                Code: {s.section.code}
                                                                {s.completed_at && (
                                                                    <> · Completed {formatDate(s.completed_at)}</>
                                                                )}
                                                            </div>
                                                        </div>
                                                        <span className={statusBadgeClass(s.status)}>
                                                            {s.status}
                                                        </span>
                                                    </div>
                                                    {idx < arr.length - 1 && (
                                                        <div className="flex justify-center py-1">
                                                            <i className="fi fi-rr-arrow-down text-surface-300" />
                                                        </div>
                                                    )}
                                                </div>
                                            ))}
                                    </div>
                                ) : (
                                    <div className="empty-state">
                                        <div className="empty-state-icon">
                                            <i className="fi fi-rr-diagram-project" />
                                        </div>
                                        <div className="empty-state-title">
                                            Work Order not created
                                        </div>
                                        <div className="empty-state-text">
                                            Create the work order by listing the production shops this job needs to pass through.
                                        </div>
                                        <Link href={sectionsHref} className="btn-primary btn-sm mt-3">
                                            <i className="fi fi-rr-plus mr-1.5" />
                                            Create Work Order
                                        </Link>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Operation Sheet */}
                        <div className="card">
                            <div className="card-header">
                                <div className="flex items-center gap-2">
                                    <i className="fi fi-rr-document text-brand-600" />
                                    <h3 className="text-base font-semibold text-surface-900">
                                        Operation Sheet
                                    </h3>
                                </div>
                            </div>
                            <div className="card-body">
                                {job.operation_sheet ? (
                                    <div className="flex items-center justify-between p-4 rounded-lg border border-surface-200 bg-brand-50/30">
                                        <div className="flex items-center gap-3 min-w-0">
                                            <div className="w-12 h-12 rounded-xl bg-white border border-brand-200 flex items-center justify-center shrink-0">
                                                <i className="fi fi-rr-document text-brand-600 text-lg" />
                                            </div>
                                            <div className="min-w-0">
                                                <div className="font-semibold text-surface-900 truncate">
                                                    {job.operation_sheet.sheet_number}
                                                </div>
                                                <div className="text-xs text-surface-500">
                                                    {job.operation_sheet.step_count} operation step
                                                    {job.operation_sheet.step_count !== 1 ? 's' : ''}
                                                </div>
                                            </div>
                                        </div>
                                        <Link
                                            href={`/operation-sheets/${job.operation_sheet.id}`}
                                            className="btn-outline btn-sm"
                                        >
                                            View
                                            <i className="fi fi-rr-arrow-right ml-1" />
                                        </Link>
                                    </div>
                                ) : (
                                    <div className="empty-state">
                                        <div className="empty-state-icon">
                                            <i className="fi fi-rr-document" />
                                        </div>
                                        <div className="empty-state-title">
                                            No operation sheet
                                        </div>
                                        <div className="empty-state-text">
                                            {job.sections.length === 0
                                                ? 'Assign sections first before creating the operation sheet.'
                                                : 'Create the operation sheet to define job steps.'}
                                        </div>
                                        {job.sections.length > 0 ? (
                                            <Link
                                                href={`/operation-sheets/${job.id}/create`}
                                                className="btn-primary btn-sm mt-3"
                                            >
                                                <i className="fi fi-rr-plus mr-1.5" />
                                                Create Op Sheet
                                            </Link>
                                        ) : (
                                            <button
                                                type="button"
                                                disabled
                                                className="btn-primary btn-sm mt-3 opacity-50 cursor-not-allowed"
                                            >
                                                <i className="fi fi-rr-plus mr-1.5" />
                                                Create Op Sheet
                                            </button>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Right sidebar */}
                    <div className="space-y-6">
                        {/* Job Details */}
                        <div className="card">
                            <div className="card-header">
                                <div className="flex items-center gap-2">
                                    <i className="fi fi-rr-info text-brand-600" />
                                    <h3 className="text-base font-semibold text-surface-900">
                                        Job Details
                                    </h3>
                                </div>
                            </div>
                            <div className="card-body space-y-4">
                                <div>
                                    <div className="form-label text-xs">Quantity</div>
                                    <div className="text-surface-900 font-semibold">
                                        {job.quantity}
                                    </div>
                                </div>
                                <div>
                                    <div className="form-label text-xs">Priority</div>
                                    <div>
                                        <span className={priorityBadgeClass(job.priority)}>
                                            {job.priority}
                                        </span>
                                    </div>
                                </div>
                                <div>
                                    <div className="form-label text-xs">Due Date</div>
                                    <div className="text-surface-900">
                                        {formatDate(job.due_date)}
                                    </div>
                                </div>
                                <div>
                                    <div className="form-label text-xs">Customer PO</div>
                                    <div className="text-surface-900">
                                        {job.customer_po_no || '—'}
                                    </div>
                                </div>
                                <div>
                                    <div className="form-label text-xs">Handoff Date</div>
                                    <div className="text-surface-900">
                                        {formatDateTime(job.pcd_handoff_at)}
                                    </div>
                                </div>
                                {job.notes && (
                                    <div>
                                        <div className="form-label text-xs">Notes</div>
                                        <div className="text-sm text-surface-700 whitespace-pre-wrap p-3 bg-surface-50 rounded-lg border border-surface-200">
                                            {job.notes}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Quick Actions */}
                        <div className="card">
                            <div className="card-header">
                                <div className="flex items-center gap-2">
                                    <i className="fi fi-rr-bolt text-brand-600" />
                                    <h3 className="text-base font-semibold text-surface-900">
                                        Quick Actions
                                    </h3>
                                </div>
                            </div>
                            <div className="card-body space-y-2">
                                <Link
                                    href={mrHref}
                                    className={`flex items-center justify-between w-full p-3 rounded-lg border transition-all ${
                                        checklist.material_requisition.done
                                            ? 'border-green-200 bg-green-50/50 hover:bg-green-50'
                                            : 'border-surface-200 hover:border-brand-300 hover:bg-brand-50/30'
                                    }`}
                                >
                                    <div className="flex items-center gap-3">
                                        <div
                                            className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                                                checklist.material_requisition.done
                                                    ? 'bg-green-500 text-white'
                                                    : 'bg-brand-50 text-brand-600'
                                            }`}
                                        >
                                            {checklist.material_requisition.done ? (
                                                <i className="fi fi-rr-check text-sm" />
                                            ) : (
                                                <span className="text-sm font-bold">1</span>
                                            )}
                                        </div>
                                        <div className="text-left">
                                            <div className="font-semibold text-surface-900 text-sm">
                                                Material Requisition
                                            </div>
                                            <div className="text-xs text-surface-500">
                                                {checklist.material_requisition.done
                                                    ? 'View / edit'
                                                    : 'Create MR'}
                                            </div>
                                        </div>
                                    </div>
                                    <i className="fi fi-rr-arrow-right text-surface-400" />
                                </Link>

                                <Link
                                    href={sectionsHref}
                                    className={`flex items-center justify-between w-full p-3 rounded-lg border transition-all ${
                                        checklist.section_assign.done
                                            ? 'border-green-200 bg-green-50/50 hover:bg-green-50'
                                            : 'border-surface-200 hover:border-brand-300 hover:bg-brand-50/30'
                                    }`}
                                >
                                    <div className="flex items-center gap-3">
                                        <div
                                            className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                                                checklist.section_assign.done
                                                    ? 'bg-green-500 text-white'
                                                    : 'bg-brand-50 text-brand-600'
                                            }`}
                                        >
                                            {checklist.section_assign.done ? (
                                                <i className="fi fi-rr-check text-sm" />
                                            ) : (
                                                <span className="text-sm font-bold">2</span>
                                            )}
                                        </div>
                                        <div className="text-left">
                                            <div className="font-semibold text-surface-900 text-sm">
                                                Work Order
                                            </div>
                                            <div className="text-xs text-surface-500">
                                                {checklist.section_assign.done
                                                    ? `${checklist.section_assign.count} shop${checklist.section_assign.count > 1 ? 's' : ''} routed`
                                                    : 'Create work order'}
                                            </div>
                                        </div>
                                    </div>
                                    <i className="fi fi-rr-arrow-right text-surface-400" />
                                </Link>

                                <Link
                                    href={opSheetHref}
                                    className={`flex items-center justify-between w-full p-3 rounded-lg border transition-all ${
                                        checklist.operation_sheet.done
                                            ? 'border-green-200 bg-green-50/50 hover:bg-green-50'
                                            : 'border-surface-200 hover:border-brand-300 hover:bg-brand-50/30'
                                    }`}
                                >
                                    <div className="flex items-center gap-3">
                                        <div
                                            className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                                                checklist.operation_sheet.done
                                                    ? 'bg-green-500 text-white'
                                                    : 'bg-brand-50 text-brand-600'
                                            }`}
                                        >
                                            {checklist.operation_sheet.done ? (
                                                <i className="fi fi-rr-check text-sm" />
                                            ) : (
                                                <span className="text-sm font-bold">3</span>
                                            )}
                                        </div>
                                        <div className="text-left">
                                            <div className="font-semibold text-surface-900 text-sm">
                                                Operation Sheet
                                            </div>
                                            <div className="text-xs text-surface-500">
                                                {checklist.operation_sheet.done
                                                    ? 'View / edit'
                                                    : 'Create sheet'}
                                            </div>
                                        </div>
                                    </div>
                                    <i className="fi fi-rr-arrow-right text-surface-400" />
                                </Link>

                                {checklist.all_done && !checklist.released && (
                                    <div className="pt-2">
                                        <button
                                            type="button"
                                            className="btn-success btn-sm w-full"
                                        >
                                            <i className="fi fi-rr-paper-plane mr-1.5" />
                                            Release to Shops
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

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
