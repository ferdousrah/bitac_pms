import React, { useState } from 'react';
import { Link } from '@inertiajs/react';
import AppLayout from '@/Layouts/AppLayout';
import PdfPopupModal from '@/Components/PdfPopupModal';
import JobTypeBadge from '@/Components/JobTypeBadge';

interface ItemFile {
    id: number;
    url: string;
    filename: string;
    extension: string | null;
    is_image: boolean;
}

interface RfqItem {
    id?: number;
    description: string;
    quantity: number;
    unit: string;
    ied_note?: string | null;
    drawings?: ItemFile[];
    samples?: ItemFile[];
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
    job_number: string | number | null;
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
    item_operation_sheets: Array<{
        item: {
            id: number;
            sequence: number;
            description: string | null;
            quantity: number;
            unit: string;
        };
        sheet: {
            id: number;
            sheet_number: string;
            step_count: number;
        } | null;
    }>;
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
        title?: string;
        extension?: string;
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
    gate_passes?: Array<{
        id: number;
        pass_no: string;
        direction: 'in' | 'out';
        status: string;
        pass_date: string | null;
        party_name: string | null;
        vehicle_no: string | null;
        item_count: number;
        items_summary: string[];
        notes: string | null;
        view_url: string;
    }>;
}

interface ChecklistItem {
    done: boolean;
    label: string;
    icon: string;
}

interface ChecklistSectionItem extends ChecklistItem {
    count: number;
}

interface ChecklistOpSheetItem extends ChecklistItem {
    items_total: number;
    items_covered: number;
}

interface Checklist {
    material_requisition: ChecklistItem;
    section_assign: ChecklistSectionItem;
    operation_sheet: ChecklistOpSheetItem;
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
    // Step 3 anchors to the item-wise operation-sheet panel below — each item
    // gets its own "Create / View Sheet" action there.
    const opSheetHref = '#operation-sheets';

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
    const [gatePassesOpen, setGatePassesOpen] = useState(true);

    const steps = [
        {
            number: 1,
            key: 'material_requisition',
            done: checklist.material_requisition.done,
            optional: true,
            label: checklist.material_requisition.label,
            icon: checklist.material_requisition.icon || 'fi-rr-box',
            href: mrHref,
            subtitle: checklist.material_requisition.done
                ? `${job.material_requisitions.length} MR${job.material_requisitions.length > 1 ? 's' : ''} created`
                : 'Optional — raise if needed',
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
            // Item-wise: show "X / N items" so PCD can see partial progress.
            subtitle: checklist.operation_sheet.items_total > 0
                ? `${checklist.operation_sheet.items_covered}/${checklist.operation_sheet.items_total} item${checklist.operation_sheet.items_total > 1 ? 's' : ''} done`
                : (checklist.operation_sheet.done ? `${job.operation_sheet?.step_count ?? 0} steps` : 'Not created'),
        },
    ];

    // Optional steps (like Material Requisition) don't count as "pending" —
    // they don't block release, so they shouldn't appear in the warning banner.
    const pendingSteps = steps.filter((s) => !s.done && !s.optional).map((s) => s.label);

    return (
        <AppLayout
            header={
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-brand-50 flex items-center justify-center">
                        <i className="fi fi-rr-briefcase text-brand-600 text-lg leading-none" />
                    </div>
                    <div>
                        <h1 className="text-xl font-bold text-surface-900">
                            {job.job_number ? `PCD Job #${job.job_number}` : `Work Order ${job.wo_number}`}
                        </h1>
                        <p className="text-sm text-surface-500">
                            {job.job_number
                                ? 'Process the 3-step PCD workflow to release this job'
                                : 'Set a job number to begin the PCD workflow'}
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
                                            {/* Header priority: PCD Job # → Customer PO → WO #. The
                                                customer recognises their own PO, so it takes
                                                precedence over the system WO number when no PCD
                                                job number has been allocated yet. */}
                                            {job.job_number
                                                ? `Job #${job.job_number}`
                                                : (job.customer_po_no ?? job.wo_number)}
                                        </h2>
                                        {job.customer && (
                                            <span className="text-sm text-surface-500">
                                                by <span className="font-semibold text-surface-800">{job.customer}</span>
                                            </span>
                                        )}
                                        {!job.job_number && (
                                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-50 text-amber-700 border border-amber-200 text-[10px] font-bold uppercase tracking-wider">
                                                <i className="fi fi-rr-bolt text-[9px]" />
                                                Job # not assigned
                                            </span>
                                        )}
                                        <JobTypeBadge type={job.job_type} />
                                        <span className={statusBadgeClass(job.status)}>
                                            {job.status}
                                        </span>
                                        <span className={priorityBadgeClass(job.priority)}>
                                            {job.priority}
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

                {/* Customer PO / authorisation document — show only the warning
                    when no Work Order is attached. The file itself is rendered
                    as a card inside the "Source Documents" section below, so we
                    don't duplicate the surface area. */}
                {(() => {
                    const customerPo = job.attachments?.find(a => a.kind === 'customer_po');
                    if (customerPo) return null;
                    return (
                        <div className="rounded-2xl border-2 border-dashed border-amber-200 bg-amber-50/40 p-4 flex items-start gap-3">
                            <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center shrink-0">
                                <i className="fi fi-rr-triangle-warning text-amber-600 text-base leading-none" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="text-sm font-bold text-amber-900">No Customer Work Order on file</div>
                                <p className="text-xs text-amber-700 mt-0.5">The customer's signed Work Order copy wasn't attached. Ask IED to upload it — needed as audit proof.</p>
                            </div>
                        </div>
                    );
                })()}

                {/* Job Items — collapsible (shown above the workflow progress) */}
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
                    <div className="card-body space-y-3">
                        {job.rfq_items.length > 0 ? (
                            job.rfq_items.map((item: any, idx: number) => {
                                const files = [
                                    ...(item.drawings ?? []).map((f: any) => ({ ...f, tag: 'Drawing' })),
                                    ...(item.samples ?? []).map((f: any) => ({ ...f, tag: 'Sample' })),
                                ];
                                return (
                                    <div key={item.id ?? idx} className="rounded-xl border border-surface-200 p-4 hover:border-brand-200 hover:shadow-sm transition-all">
                                        <div className="flex items-start gap-3">
                                            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-brand-400 to-brand-600 text-white flex items-center justify-center font-bold text-sm shrink-0">
                                                {idx + 1}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-start justify-between gap-3 flex-wrap">
                                                    <div className="font-semibold text-surface-900">{item.description}</div>
                                                    <span className="badge badge-blue text-[10px] shrink-0">Qty {item.quantity} {item.unit}</span>
                                                </div>

                                                {item.ied_note && (
                                                    <div className="mt-2 inline-flex items-start gap-1.5 px-2.5 py-1.5 rounded-lg bg-amber-50 border border-amber-200 text-[11px] text-amber-900">
                                                        <i className="fi fi-rr-comment-alt text-amber-600 text-[10px] leading-none mt-0.5 shrink-0" />
                                                        <span><span className="font-semibold">IED note:</span> {item.ied_note}</span>
                                                    </div>
                                                )}

                                                {files.length > 0 ? (
                                                    <div className="mt-3">
                                                        <div className="text-[10px] uppercase tracking-wider font-bold text-surface-400 mb-1.5 flex items-center gap-1">
                                                            <i className="fi fi-rr-blueprint text-[10px] leading-none" /> Drawings &amp; Samples
                                                        </div>
                                                        <div className="flex flex-wrap gap-2">
                                                            {files.map((f: any) => f.is_image ? (
                                                                <a
                                                                    key={`${f.tag}-${f.id}`}
                                                                    href={f.url}
                                                                    target="_blank"
                                                                    rel="noreferrer"
                                                                    title={`${f.tag}: ${f.filename}`}
                                                                    className="group relative w-16 h-16 rounded-lg overflow-hidden border border-surface-200 hover:border-brand-400 shrink-0"
                                                                >
                                                                    <img src={f.url} alt={f.filename} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                                                                    <span className={`absolute bottom-0 inset-x-0 text-white text-[8px] font-semibold text-center py-0.5 ${f.tag === 'Drawing' ? 'bg-blue-600/75' : 'bg-violet-600/75'}`}>{f.tag}</span>
                                                                </a>
                                                            ) : (
                                                                <a
                                                                    key={`${f.tag}-${f.id}`}
                                                                    href={f.url}
                                                                    target="_blank"
                                                                    rel="noreferrer"
                                                                    title={f.filename}
                                                                    className="flex items-center gap-2 px-2.5 py-2 rounded-lg border border-surface-200 hover:border-brand-400 hover:bg-brand-50/40 bg-white shrink-0"
                                                                >
                                                                    <span className={`w-8 h-8 rounded text-[9px] font-bold flex items-center justify-center shrink-0 ${f.tag === 'Drawing' ? 'bg-blue-50 text-blue-700' : 'bg-violet-50 text-violet-700'}`}>{f.extension || 'FILE'}</span>
                                                                    <span className="min-w-0">
                                                                        <span className="block text-xs font-medium text-surface-800 truncate max-w-[150px]">{f.filename}</span>
                                                                        <span className="block text-[10px] text-surface-400">{f.tag}</span>
                                                                    </span>
                                                                </a>
                                                            ))}
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <div className="mt-2 text-[11px] text-surface-300 italic">No drawings or samples from IED for this item.</div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })
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
                            <div className="flex items-center gap-2">
                                {checklist.section_assign.done && (
                                    <button
                                        type="button"
                                        onClick={async () => {
                                            // Stream the PDF via ?preview=base64 to dodge IDM/FDM interceptors.
                                            try {
                                                const res = await fetch(`/pcd/work-orders/${job.id}/pdf?preview=base64`, {
                                                    credentials: 'same-origin',
                                                    headers: { Accept: 'application/json' },
                                                });
                                                if (!res.ok) throw new Error('PDF fetch failed');
                                                const data = await res.json();
                                                const blob = new Blob(
                                                    [Uint8Array.from(atob(data.data), (c) => c.charCodeAt(0))],
                                                    { type: 'application/pdf' },
                                                );
                                                const url = URL.createObjectURL(blob);
                                                setPdfPopup({
                                                    open: true,
                                                    url,
                                                    title: 'Work Order',
                                                    subtitle: job.job_number ? `Job #${job.job_number}` : job.wo_number,
                                                });
                                            } catch (e) {
                                                window.open(`/pcd/work-orders/${job.id}/pdf?preview=1`, '_blank');
                                            }
                                        }}
                                        className="btn-outline btn-sm"
                                    >
                                        <i className="fi fi-rr-file-pdf mr-1.5" />
                                        View Work Order PDF
                                    </button>
                                )}
                                {checklist.all_done && !checklist.released && (
                                    <span className="badge badge-green">
                                        <i className="fi fi-rr-check-circle mr-1" />
                                        Ready to Release
                                    </span>
                                )}
                            </div>
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
                                                        ) : step.optional ? (
                                                            <span className="badge badge-slate">
                                                                Optional
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
                        {/* Job QC Certificate — appears once every item has a passing
                            final inspection (WO status reached qc_passed or beyond). */}
                        {['qc_passed', 'ready_for_delivery', 'delivered'].includes(job.status) && (
                            <div className="card border-emerald-200 bg-emerald-50/40 animate-slide-up">
                                <div className="card-body">
                                    <div className="flex items-start justify-between gap-3 flex-wrap">
                                        <div className="flex items-start gap-3 min-w-0">
                                            <div className="w-11 h-11 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                                                <i className="fi fi-rr-shield-check text-lg leading-none" />
                                            </div>
                                            <div className="min-w-0">
                                                <h3 className="text-sm font-bold text-emerald-900">Job QC Certificate</h3>
                                                <p className="text-xs text-emerald-700/80 mt-0.5">
                                                    Every item inspected and accepted (OK). The combined certificate is ready for the customer.
                                                </p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2 shrink-0">
                                            <button
                                                type="button"
                                                onClick={async () => {
                                                    try {
                                                        const res = await fetch(`/qc/work-orders/${job.id}/certificate?preview=base64`, {
                                                            credentials: 'same-origin',
                                                            headers: { Accept: 'application/json' },
                                                        });
                                                        if (!res.ok) throw new Error('certificate fetch failed');
                                                        const data = await res.json();
                                                        const blob = new Blob(
                                                            [Uint8Array.from(atob(data.data), c => c.charCodeAt(0))],
                                                            { type: 'application/pdf' },
                                                        );
                                                        const url = URL.createObjectURL(blob);
                                                        setPdfPopup({
                                                            open: true,
                                                            url,
                                                            title: 'Job QC Certificate',
                                                            subtitle: job.job_number ? `Job# ${job.job_number}` : job.wo_number,
                                                        });
                                                    } catch {
                                                        window.open(`/qc/work-orders/${job.id}/certificate?preview=1`, '_blank');
                                                    }
                                                }}
                                                className="btn-outline btn-sm"
                                            >
                                                <i className="fi fi-rr-eye text-xs leading-none mr-1" /> View
                                            </button>
                                            <a
                                                href={`/qc/work-orders/${job.id}/certificate`}
                                                className="btn-primary btn-sm"
                                            >
                                                <i className="fi fi-rr-file-download text-xs leading-none mr-1" /> Download
                                            </a>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Gate Passes — IN/OUT passes attached to the parent RFQ */}
                        {(job.gate_passes ?? []).length > 0 && (
                            <div className="card">
                                <button
                                    type="button"
                                    onClick={() => setGatePassesOpen(o => !o)}
                                    className="card-header w-full flex items-center justify-between hover:bg-surface-50/60 transition-colors text-left"
                                    aria-expanded={gatePassesOpen}
                                >
                                    <div className="min-w-0">
                                        <div className="flex items-center gap-2">
                                            <i className="fi fi-rr-shield-check text-brand-600" />
                                            <h3 className="text-base font-semibold text-surface-900">Gate Passes</h3>
                                            <span className="badge badge-slate">{(job.gate_passes ?? []).length}</span>
                                        </div>
                                        <p className="text-xs text-surface-500 mt-1">
                                            Reference samples / parts moving in and out of BITAC against this job.
                                        </p>
                                    </div>
                                    <i className={`fi fi-rr-angle-${gatePassesOpen ? 'up' : 'down'} text-surface-400 text-sm leading-none shrink-0 ml-3`} />
                                </button>
                                {gatePassesOpen && (
                                    <div className="card-body space-y-2">
                                        {(job.gate_passes ?? []).map((gp: any) => {
                                            const isIn = gp.direction === 'in';
                                            const dirCls = isIn
                                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                                : 'bg-amber-50 text-amber-700 border-amber-200';
                                            const statusCls = gp.status === 'completed'
                                                ? 'bg-emerald-100 text-emerald-700'
                                                : gp.status === 'cancelled'
                                                    ? 'bg-rose-100 text-rose-700'
                                                    : 'bg-surface-100 text-surface-700';
                                            return (
                                                <a
                                                    key={gp.id}
                                                    href={gp.view_url}
                                                    target="_blank"
                                                    rel="noreferrer"
                                                    className="flex items-center justify-between gap-3 p-3 rounded-xl border border-surface-200 hover:border-brand-300 hover:bg-brand-50/30 transition-colors"
                                                >
                                                    <div className="flex items-center gap-3 min-w-0">
                                                        <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${isIn ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                                                            <i className={`fi ${isIn ? 'fi-rr-sign-in-alt' : 'fi-rr-sign-out-alt'} text-sm leading-none`} />
                                                        </div>
                                                        <div className="min-w-0 flex-1">
                                                            <div className="flex items-center gap-1.5 flex-wrap">
                                                                <span className="font-mono text-sm font-bold text-surface-900">{gp.pass_no}</span>
                                                                <span className={`inline-flex items-center px-1.5 py-0.5 rounded border text-[9px] font-bold uppercase tracking-wider ${dirCls}`}>
                                                                    {isIn ? 'IN' : 'OUT'}
                                                                </span>
                                                                <span className={`px-2 py-0.5 rounded-md text-[10px] font-semibold capitalize ${statusCls}`}>{gp.status}</span>
                                                            </div>
                                                            <div className="text-[11px] text-surface-500 mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5">
                                                                <span>{gp.pass_date}</span>
                                                                {gp.party_name && <span>· {gp.party_name}</span>}
                                                                {gp.vehicle_no && <span>· Vehicle {gp.vehicle_no}</span>}
                                                                <span>· {gp.item_count} item{gp.item_count === 1 ? '' : 's'}</span>
                                                            </div>
                                                            {gp.items_summary?.length > 0 && (
                                                                <div className="text-[10px] text-surface-400 mt-0.5 truncate">
                                                                    {gp.items_summary.join(', ')}{gp.item_count > gp.items_summary.length ? '…' : ''}
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                    <i className="fi fi-rr-arrow-up-right-from-square text-[10px] text-surface-400 shrink-0" />
                                                </a>
                                            );
                                        })}
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

                        {/* Operation Sheets — per item (single consolidated section).
                            Each WO item has its own sheet/routing; falls back to the
                            legacy single-sheet view / empty state when no items. */}
                        <div id="operation-sheets" className="card">
                            <div className="card-header">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <i className="fi fi-rr-document text-brand-600" />
                                        <h3 className="text-base font-semibold text-surface-900">
                                            Operation Sheet{(job.item_operation_sheets?.length ?? 0) > 1 ? 's — per item' : ''}
                                        </h3>
                                    </div>
                                    {checklist.operation_sheet.items_total > 0 && (
                                        <span className="badge badge-slate">
                                            {checklist.operation_sheet.items_covered}/{checklist.operation_sheet.items_total} done
                                        </span>
                                    )}
                                </div>
                            </div>
                            <div className="card-body">
                                {job.item_operation_sheets && job.item_operation_sheets.length > 0 ? (
                                    <div className="space-y-3">
                                        {job.item_operation_sheets.map(({ item, sheet }) => (
                                            <div
                                                key={item.id}
                                                className={`flex items-start gap-3 p-3 rounded-xl border ${sheet ? 'bg-green-50/40 border-green-200' : 'bg-amber-50/40 border-amber-200'}`}
                                            >
                                                <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 font-bold ${sheet ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                                                    {sheet ? <i className="fi fi-rr-check text-sm leading-none" /> : item.sequence}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex flex-wrap items-center gap-2">
                                                        <span className="badge badge-slate text-[10px]">Item {item.sequence}</span>
                                                        <span className="text-xs text-surface-500">Qty {item.quantity} {item.unit}</span>
                                                        {sheet && (
                                                            <span className="badge badge-green text-[10px] font-mono">
                                                                Sheet {sheet.sheet_number} · {sheet.step_count} step{sheet.step_count !== 1 ? 's' : ''}
                                                            </span>
                                                        )}
                                                    </div>
                                                    <div className="text-sm font-semibold text-surface-900 mt-1 truncate">
                                                        {item.description ?? '—'}
                                                    </div>
                                                </div>
                                                <div className="shrink-0">
                                                    {sheet ? (
                                                        <Link href={`/operation-sheets/${sheet.id}`} className="btn-outline btn-sm">
                                                            <i className="fi fi-rr-eye mr-1" />
                                                            View
                                                        </Link>
                                                    ) : (
                                                        <Link href={`/operation-sheets/${job.id}/create?item_id=${item.id}`} className="btn-primary btn-sm">
                                                            <i className="fi fi-rr-plus mr-1" />
                                                            Create Sheet
                                                        </Link>
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                ) : job.operation_sheet ? (
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

                        {/* Documents — Customer RFQ Letter, Approved Quotation, Customer Work Order */}
                        {(() => {
                            const customerWo = job.attachments?.find(a => a.kind === 'customer_po');
                            if (!job.rfq_source && !job.quotation_source && !customerWo) return null;
                            const fmtAmt = (n: number) => n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                            return (
                                <div className="card">
                                    <div className="card-header">
                                        <div className="flex items-center gap-2">
                                            <i className="fi fi-rr-document-signed text-brand-600" />
                                            <h3 className="text-base font-semibold text-surface-900">Documents</h3>
                                        </div>
                                    </div>
                                    <div className="card-body space-y-2.5">
                                        {job.rfq_source && (
                                            <button
                                                type="button"
                                                onClick={() => setPdfPopup({ open: true, url: job.rfq_source!.pdf_url, title: job.rfq_source!.title ?? 'Customer RFQ Letter', subtitle: `${job.rfq_source!.rfq_no} · ${job.customer}` })}
                                                className="w-full flex items-center gap-3 p-3 rounded-xl border border-blue-200 bg-blue-50/50 hover:bg-blue-50 hover:border-blue-400 text-left transition-all"
                                            >
                                                <div className="w-10 h-10 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center shrink-0"><i className="fi fi-rr-envelope text-base leading-none" /></div>
                                                <div className="flex-1 min-w-0">
                                                    <div className="text-[10px] uppercase tracking-wider font-bold text-blue-600">RFQ Letter</div>
                                                    <div className="text-sm font-semibold text-blue-900 truncate font-mono">{job.rfq_source.rfq_no}</div>
                                                </div>
                                                <i className="fi fi-rr-eye text-blue-400 text-sm leading-none" />
                                            </button>
                                        )}
                                        {job.quotation_source && (
                                            <button
                                                type="button"
                                                onClick={() => setPdfPopup({ open: true, url: job.quotation_source!.pdf_url, title: job.quotation_source!.quotation_no, subtitle: `${job.customer} · BDT ${fmtAmt(job.quotation_source!.total_amount)}` })}
                                                className="w-full flex items-center gap-3 p-3 rounded-xl border border-emerald-200 bg-emerald-50/50 hover:bg-emerald-50 hover:border-emerald-400 text-left transition-all"
                                            >
                                                <div className="w-10 h-10 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0"><i className="fi fi-rr-file-invoice-dollar text-base leading-none" /></div>
                                                <div className="flex-1 min-w-0">
                                                    <div className="text-[10px] uppercase tracking-wider font-bold text-emerald-600">Approved Quotation</div>
                                                    <div className="text-sm font-semibold text-emerald-900 truncate font-mono">{job.quotation_source.quotation_no}</div>
                                                    <div className="text-[10px] text-emerald-700 font-mono">BDT {fmtAmt(job.quotation_source.total_amount)}</div>
                                                </div>
                                                <i className="fi fi-rr-eye text-emerald-400 text-sm leading-none" />
                                            </button>
                                        )}
                                        {customerWo && (
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    const sep = customerWo.url.includes('?') ? '&' : '?';
                                                    setPdfPopup({ open: true, url: `${customerWo.url}${sep}preview=base64`, title: 'Customer Work Order', subtitle: job.customer_po_no ? `PO ${job.customer_po_no}` : job.customer });
                                                }}
                                                className="w-full flex items-center gap-3 p-3 rounded-xl border border-amber-200 bg-amber-50/50 hover:bg-amber-50 hover:border-amber-400 text-left transition-all"
                                            >
                                                <div className="w-10 h-10 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center shrink-0"><i className="fi fi-rr-clipboard-list text-base leading-none" /></div>
                                                <div className="flex-1 min-w-0">
                                                    <div className="text-[10px] uppercase tracking-wider font-bold text-amber-700">Customer Work Order</div>
                                                    <div className="text-sm font-semibold text-amber-900 truncate">{customerWo.filename}</div>
                                                    {job.customer_po_no && <div className="text-[10px] text-amber-700 font-mono">PO: {job.customer_po_no}</div>}
                                                </div>
                                                <i className="fi fi-rr-eye text-amber-400 text-sm leading-none" />
                                            </button>
                                        )}
                                    </div>
                                </div>
                            );
                        })()}

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
