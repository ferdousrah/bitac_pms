import AppLayout from '@/Layouts/AppLayout';
import { Link } from '@inertiajs/react';
import { useState } from 'react';
import FilePreviewModal, { PreviewableFile } from '@/Components/FilePicker/FilePreviewModal';
import PdfPopupModal from '@/Components/PdfPopupModal';

const statusBadge: Record<string, string> = {
    draft:    'badge-slate',
    pending:  'badge-amber',
    quoted:   'badge-blue',
    rejected: 'badge-red',
    closed:   'badge-slate',
};

const quotationStatusBadge: Record<string, string> = {
    draft:            'badge-slate',
    approved:         'badge-green',
    sent_to_customer: 'badge-purple',
    converted:        'badge-blue',
    rejected:         'badge-red',
};

/**
 * The parts a job item breaks down into. Part numbers come from the server
 * already in `n/total` form — they are positional, never stored.
 */
function PartsList({ parts }: { parts?: any[] }) {
    if (!parts || parts.length === 0) return null;
    const fmt = (n: number) => `৳${Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
    return (
        <ul className="mt-2 space-y-1">
            {parts.map((p: any) => (
                <li key={p.id} className="flex items-center gap-2 text-xs">
                    <span className="shrink-0 font-mono font-bold text-[10px] px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-100">
                        {p.part_no}
                    </span>
                    <span className="text-surface-600 font-normal truncate max-w-[160px]" title={p.name}>{p.name}</span>
                    <span className="shrink-0 text-surface-400">×{p.quantity} {p.unit}</span>
                    {p.estimate ? (
                        <Link href={`/cost-estimates/${p.estimate.id}`}
                            className="shrink-0 ml-auto font-semibold text-emerald-700 hover:underline"
                            title={`${p.estimate.estimate_no} · ${p.estimate.status}`}>
                            {fmt(p.estimate.grand_total)}
                        </Link>
                    ) : (
                        <Link href={`/cost-estimates/create?rfq_item_part_id=${p.id}`}
                            className="shrink-0 ml-auto inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-brand-50 text-brand-700 border border-brand-200 font-semibold hover:bg-brand-100">
                            <i className="fi fi-rr-plus text-[9px] leading-none" /> Estimate
                        </Link>
                    )}
                </li>
            ))}
        </ul>
    );
}

/** Displays cost estimates attached to an RFQ item + Create/View buttons */
function ItemEstimateCell({ item }: { item: any }) {
    const estimates = item.cost_estimates || [];
    const fmt = (n: number) => `৳${Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
    const cost = item.job_cost;

    // Part-wise costing: the job's cost is the sum of its parts' estimates.
    // The parts themselves (and the links to cost them) live in the
    // description column, so this cell just reports the roll-up.
    if (cost?.mode === 'parts') {
        return (
            <div className="space-y-1">
                <div className="font-bold text-surface-900 text-sm">{fmt(cost.total)}</div>
                <div className="text-[10px] text-surface-400">
                    sum of {cost.costed} part{cost.costed !== 1 && 's'}
                </div>
                {cost.missing > 0 && (
                    <div className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200 text-[10px] font-semibold">
                        <i className="fi fi-rr-triangle-warning text-[9px] leading-none" />
                        {cost.missing} part{cost.missing !== 1 && 's'} not costed
                    </div>
                )}
            </div>
        );
    }
    const statusColor: Record<string, string> = {
        draft:     'bg-amber-100 text-amber-700',
        finalized: 'bg-emerald-100 text-emerald-700',
        used:      'bg-indigo-100 text-indigo-700',
    };

    if (estimates.length === 0) {
        return (
            <Link
                href={`/cost-estimates/create?rfq_item_id=${item.id}`}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-brand-500 text-white text-xs font-semibold hover:bg-brand-600 transition-colors"
            >
                <i className="fi fi-rr-plus text-[10px] leading-none" /> Create Estimate
            </Link>
        );
    }

    return (
        <div className="space-y-1">
            {estimates.map((est: any) => (
                <Link
                    key={est.id}
                    href={`/cost-estimates/${est.id}`}
                    className="flex items-center gap-2 px-2 py-1 rounded-lg bg-surface-50 hover:bg-brand-50 border border-surface-200 hover:border-brand-300 transition-colors group"
                >
                    <span className="font-mono text-[10px] font-bold text-brand-600">{est.estimate_no}</span>
                    <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-bold uppercase ${statusColor[est.status] ?? 'bg-surface-200 text-surface-600'}`}>
                        {est.status}
                    </span>
                    <span className="text-xs font-semibold text-surface-800 ml-auto">{fmt(est.grand_total)}</span>
                </Link>
            ))}
            <Link
                href={`/cost-estimates/create?rfq_item_id=${item.id}`}
                className="inline-flex items-center gap-1 text-[10px] text-brand-600 hover:text-brand-800 font-semibold"
            >
                <i className="fi fi-rr-plus text-[9px] leading-none" /> Add another
            </Link>
        </div>
    );
}

function ReferenceBadges({ item }: { item: any }) {
    const drawings = item.drawings || [];
    const samplePhotos = item.sample_photos || [];
    const hasDrawing = item.reference_type === 'drawing' || item.reference_type === 'both';
    const hasSample  = item.reference_type === 'physical_sample' || item.reference_type === 'both';
    if (!hasDrawing && !hasSample) {
        return <span className="text-surface-300 text-xs">—</span>;
    }
    return (
        <div className="flex flex-wrap gap-1">
            {hasDrawing && (
                <span className="badge badge-blue" title={`${drawings.length} drawing(s)`}>
                    <i className="fi fi-rr-drafting-compass text-xs leading-none" />
                    Drawing{drawings.length > 1 ? `s (${drawings.length})` : ''}
                </span>
            )}
            {hasSample && (
                <span className={`badge ${item.sample_received ? 'badge-green' : 'badge-amber'}`}
                    title={item.sample_received ? 'Sample received' : 'Sample not yet received'}>
                    <i className="fi fi-rr-cube text-xs leading-none" />
                    Sample {item.sample_received ? '✓' : '⏳'}
                    {samplePhotos.length > 0 && ` · ${samplePhotos.length} photo${samplePhotos.length > 1 ? 's' : ''}`}
                </span>
            )}
        </div>
    );
}

function ReferenceDetails({ item, onPreview }: { item: any; onPreview: (files: any[], index: number) => void }) {
    const drawings = item.drawings || [];
    const samplePhotos = item.sample_photos || [];
    const hasDrawing = item.reference_type === 'drawing' || item.reference_type === 'both';
    const hasSample  = item.reference_type === 'physical_sample' || item.reference_type === 'both';
    if (!hasDrawing && !hasSample) return null;
    return (
        <div className="mt-2 space-y-2">
            {hasDrawing && drawings.length > 0 && (
                <div className="space-y-1.5">
                    {drawings.map((d: any, idx: number) => {
                        const isImage = /\.(jpg|jpeg|png|gif|webp)$/i.test(d.filename);
                        return (
                            <div key={d.id} className="flex items-center gap-3 p-2 bg-blue-50/80 rounded-lg border border-blue-100">
                                {isImage ? (
                                    <button onClick={() => onPreview(drawings, idx)}
                                        className="w-9 h-9 rounded overflow-hidden shrink-0 hover:ring-2 hover:ring-brand-400 transition-all">
                                        <img src={d.url} alt="" className="w-full h-full object-cover" />
                                    </button>
                                ) : (
                                    <div className="w-9 h-9 bg-blue-100 rounded-lg flex items-center justify-center text-blue-600 text-[9px] font-bold shrink-0">
                                        {d.extension?.toUpperCase() || d.filename?.split('.').pop()?.toUpperCase()}
                                    </div>
                                )}
                                <div className="flex-1 min-w-0">
                                    <div className="text-xs font-semibold text-surface-900 truncate">{d.filename}</div>
                                    <div className="text-[10px] text-surface-400">Technical drawing</div>
                                </div>
                                <button
                                    onClick={() => onPreview(drawings, idx)}
                                    className="btn-primary btn-xs shrink-0"
                                >
                                    <i className="fi fi-rr-eye text-xs leading-none" /> View
                                </button>
                            </div>
                        );
                    })}
                </div>
            )}
            {hasSample && (item.sample_description || samplePhotos.length > 0) && (
                <div className="p-2.5 bg-amber-50/80 rounded-lg border border-amber-100 space-y-2">
                    {item.sample_description && (
                        <p className="text-xs text-surface-700"><span className="font-semibold text-amber-900">Sample:</span> {item.sample_description}</p>
                    )}
                    {samplePhotos.length > 0 && (
                        <div className="flex flex-wrap gap-1.5">
                            {samplePhotos.map((p: any, idx: number) => (
                                <button key={p.id} onClick={() => onPreview(samplePhotos, idx)} className="block">
                                    <img src={p.url} alt={p.filename}
                                        className="w-16 h-16 rounded-lg object-cover border border-amber-200 hover:border-amber-400 transition-colors cursor-zoom-in"
                                        title={p.filename} />
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

export default function RFQShow({ rfq }: any) {
    // Aggregate: does any item have reference material?
    const anyReference = rfq.items?.some((i: any) => i.reference_type && i.reference_type !== 'none');

    // Lightbox state
    const [lightboxFiles, setLightboxFiles] = useState<PreviewableFile[]>([]);
    const [lightboxIndex, setLightboxIndex] = useState(0);
    const [lightboxOpen, setLightboxOpen] = useState(false);
    const [letterPdfOpen, setLetterPdfOpen] = useState(false);

    const openLightbox = (files: any[], index: number) => {
        const previewableFiles: PreviewableFile[] = files.map((f: any) => ({
            id:       f.id,
            url:      f.url,
            filename: f.filename,
            extension: f.extension || f.filename?.split('.').pop()?.toLowerCase(),
        }));
        setLightboxFiles(previewableFiles);
        setLightboxIndex(index);
        setLightboxOpen(true);
    };

    return (
        <AppLayout header={`RFQ #${rfq.id}`}>
            <div className="space-y-6 max-w-7xl animate-fade-in">

                {/* ── Header Card ──────────────────────────────────── */}
                <div className="card animate-slide-up">
                    <div className="card-header flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-brand-50 flex items-center justify-center">
                                <i className="fi fi-rr-document text-brand-500 text-base leading-none" />
                            </div>
                            <div>
                                <div className="flex items-center gap-2 flex-wrap">
                                    <h2 className="text-base font-bold text-surface-900">RFQ #{rfq.id}</h2>
                                    <span className={`badge ${statusBadge[rfq.status] ?? 'badge-slate'}`}>
                                        {rfq.status}
                                    </span>
                                    {rfq.job_type === 'rnd' ? (
                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-purple-50 text-purple-700 border border-purple-200 text-[10px] font-bold uppercase tracking-wider">
                                            <i className="fi fi-rr-lab text-[9px] leading-none" /> R&amp;D
                                        </span>
                                    ) : (
                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 border border-blue-200 text-[10px] font-bold uppercase tracking-wider">
                                            <i className="fi fi-rr-tools text-[9px] leading-none" /> Regular
                                        </span>
                                    )}
                                </div>
                                <p className="text-xs text-surface-400 mt-0.5 flex items-center gap-1.5 flex-wrap">
                                    <span>Received {rfq.created_at}</span>
                                    {rfq.created_by ? (
                                        <>
                                            <span>·</span>
                                            <span>by <span className="font-semibold text-surface-600">{rfq.created_by}</span></span>
                                        </>
                                    ) : (
                                        <>
                                            <span>·</span>
                                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-violet-50 text-violet-700 border border-violet-100 text-[9px] font-semibold uppercase tracking-wide">
                                                <i className="fi fi-rr-building text-[8px] leading-none" /> via Customer Portal
                                            </span>
                                        </>
                                    )}
                                    {rfq.customer?.name && (
                                        <>
                                            <span>·</span>
                                            <span>from <span className="font-semibold text-surface-700">{rfq.customer.name}</span></span>
                                        </>
                                    )}
                                </p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            {/* PDF export temporarily hidden — re-enable when finalised. */}
                            {false && (
                                <a href={`/rfqs/${rfq.id}/pdf`}
                                    className="btn-outline btn-sm text-red-700 border-red-200 hover:bg-red-50 hover:border-red-300">
                                    <i className="fi fi-rr-file-pdf text-xs leading-none" /> PDF
                                </a>
                            )}
                            {rfq.status === 'pending' && (
                                <Link href={`/quotations/create?rfq_id=${rfq.id}`} className="btn-success btn-sm">
                                    <i className="fi fi-rr-file-invoice text-xs leading-none" />
                                    Prepare Quotation
                                </Link>
                            )}
                            <Link href={`/rfq-letters/create?rfq_id=${rfq.id}`} className="btn-outline btn-sm">
                                <i className="fi fi-rr-envelope text-xs leading-none" /> Issue Letter
                            </Link>
                            <Link href={`/rfqs/${rfq.id}/edit`} className="btn-outline btn-sm">
                                <i className="fi fi-rr-pencil text-xs leading-none" /> Edit
                            </Link>
                            <Link href="/rfqs" className="btn-ghost btn-sm">
                                <i className="fi fi-rr-arrow-left text-xs leading-none" /> Back
                            </Link>
                        </div>
                    </div>
                </div>

                {/* ── Main Content Grid ────────────────────────────── */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                    {/* Left: Details + Items */}
                    <div className="lg:col-span-2 space-y-6">

                        {/* Job Items */}
                        <div className="card animate-slide-up">
                            <div className="card-header">
                                <h3 className="text-sm font-bold text-surface-900">Jobs</h3>
                                <p className="text-xs text-surface-400 mt-0.5">{rfq.items?.length ?? 0} item(s) in this request</p>
                            </div>
                            <div className="card-body overflow-x-auto">
                                {/* Desktop table */}
                                <div className="hidden sm:block">
                                    <table className="premium-table">
                                        <thead>
                                            <tr>
                                                <th>#</th>
                                                <th>Job Description</th>
                                                <th>Product Type</th>
                                                <th>Quantity</th>
                                                <th>Reference</th>
                                                <th>Cost Estimate</th>
                                                <th>Notes</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {rfq.items?.map((item: any, i: number) => (
                                                <tr key={item.id}>
                                                    <td className="text-surface-400 font-mono align-top">{i + 1}</td>
                                                    <td className="font-semibold text-surface-900 align-top">
                                                        <div className="whitespace-pre-line">{item.job_description || '--'}</div>
                                                        <PartsList parts={item.parts} />
                                                    </td>
                                                    <td className="text-surface-500 align-top">
                                                        {item.product ? (
                                                            <span>{item.product.name} <span className="text-surface-400">({item.product.code})</span></span>
                                                        ) : (
                                                            <span className="text-surface-300 italic">custom / new</span>
                                                        )}
                                                    </td>
                                                    <td className="align-top">
                                                        <span className="font-semibold">{item.quantity}</span>
                                                        <span className="text-surface-400 ml-1">{item.unit}</span>
                                                    </td>
                                                    <td className="align-top">
                                                        <ReferenceBadges item={item} />
                                                        <ReferenceDetails item={item} onPreview={openLightbox} />
                                                    </td>
                                                    <td className="align-top">
                                                        <ItemEstimateCell item={item} />
                                                    </td>
                                                    <td className="text-surface-500 text-xs align-top">{item.notes || '--'}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>

                                {/* Mobile cards */}
                                <div className="sm:hidden space-y-3">
                                    {rfq.items?.map((item: any, i: number) => (
                                        <div key={item.id} className="rounded-xl border border-surface-100 p-3 space-y-2">
                                            <div className="flex items-center justify-between">
                                                <span className="badge badge-slate">#{i + 1}</span>
                                                <span className="text-sm font-semibold">
                                                    {item.quantity} <span className="text-surface-400 font-normal">{item.unit}</span>
                                                </span>
                                            </div>
                                            <div className="text-sm font-semibold text-surface-900 whitespace-pre-line">{item.job_description || '--'}</div>
                                            <PartsList parts={item.parts} />
                                            {item.product && (
                                                <div className="text-xs text-surface-500">
                                                    {item.product.name} <span className="text-surface-400">({item.product.code})</span>
                                                </div>
                                            )}
                                            {item.reference_type && item.reference_type !== 'none' && (
                                                <div>
                                                    <ReferenceBadges item={item} />
                                                    <ReferenceDetails item={item} onPreview={openLightbox} />
                                                </div>
                                            )}
                                            <div className="pt-2 border-t border-surface-100">
                                                <div className="text-[10px] font-semibold text-surface-400 uppercase tracking-wider mb-1">Cost Estimate</div>
                                                <ItemEstimateCell item={item} />
                                            </div>
                                            {item.notes && (
                                                <div className="text-xs text-surface-400">{item.notes}</div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* Reference material summary (references are shown inside each item above) */}
                        {anyReference && (
                            <div className="alert alert-info">
                                <i className="fi fi-rr-info text-blue-500 text-base leading-none shrink-0 mt-0.5" />
                                <div className="text-xs text-blue-900">
                                    Reference material (drawings, samples) is attached to individual items above — click each item's reference badge to view.
                                </div>
                            </div>
                        )}

                        {/* Gate Passes — sample/reference item entry-exit tracking */}
                        <div className="card animate-slide-up">
                            <div className="card-header flex items-center justify-between">
                                <div>
                                    <h3 className="text-sm font-bold text-surface-900">Gate Passes</h3>
                                    <p className="text-xs text-surface-400 mt-0.5">
                                        Reference samples entering / leaving BITAC · {(rfq.gate_passes ?? []).length} pass{(rfq.gate_passes ?? []).length === 1 ? '' : 'es'}
                                    </p>
                                </div>
                                <div className="flex items-center gap-2">
                                    <Link href={`/ied/gate-passes/create?rfq_id=${rfq.id}&direction=in`} className="btn-outline btn-sm">
                                        <i className="fi fi-rr-sign-in-alt text-xs leading-none" /> Gate Pass In
                                    </Link>
                                    <Link href={`/ied/gate-passes/create?rfq_id=${rfq.id}&direction=out`} className="btn-primary btn-sm">
                                        <i className="fi fi-rr-sign-out-alt text-xs leading-none" /> Gate Pass Out
                                    </Link>
                                </div>
                            </div>
                            <div className="card-body">
                                {(rfq.gate_passes ?? []).length === 0 ? (
                                    <div className="flex flex-col items-center justify-center py-6 px-4 rounded-xl bg-surface-50/60 border border-dashed border-surface-200">
                                        <div className="w-10 h-10 rounded-xl bg-white shadow-sm flex items-center justify-center text-surface-400 mb-2">
                                            <i className="fi fi-rr-shield-check text-base leading-none" />
                                        </div>
                                        <div className="text-xs font-semibold text-surface-600">No gate passes issued yet</div>
                                        <div className="text-[11px] text-surface-400 mt-1 text-center max-w-xs">
                                            Issue one when the customer brings or collects a physical sample.
                                        </div>
                                    </div>
                                ) : (
                                    <div className="space-y-2">
                                        {(rfq.gate_passes ?? []).map((gp: any) => {
                                            const isIn = gp.direction === 'in';
                                            const dirBadge = isIn
                                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                                : 'bg-amber-50 text-amber-700 border-amber-200';
                                            const statusBadge = gp.status === 'issued'
                                                ? 'badge-green'
                                                : gp.status === 'cancelled' ? 'badge-red' : 'badge-slate';
                                            return (
                                                <Link
                                                    key={gp.id}
                                                    href={`/ied/gate-passes/${gp.id}`}
                                                    className="flex items-center justify-between p-3 rounded-xl border border-surface-100 hover:border-brand-300 hover:bg-brand-50/30 transition-colors"
                                                >
                                                    <div className="flex items-center gap-3">
                                                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${isIn ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'}`}>
                                                            <i className={`fi ${isIn ? 'fi-rr-sign-in-alt' : 'fi-rr-sign-out-alt'} text-sm leading-none`} />
                                                        </div>
                                                        <div>
                                                            <div className="flex items-center gap-1.5">
                                                                <span className="font-mono text-sm font-bold text-surface-900">{gp.pass_no}</span>
                                                                <span className={`inline-flex items-center px-1.5 py-0.5 rounded border text-[9px] font-bold uppercase tracking-wider ${dirBadge}`}>
                                                                    {isIn ? 'IN' : 'OUT'}
                                                                </span>
                                                            </div>
                                                            <div className="text-[11px] text-surface-500 mt-0.5">{gp.item_count} items · {gp.pass_date}</div>
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <span className={`badge ${statusBadge} capitalize`}>{gp.status}</span>
                                                        <i className="fi fi-rr-arrow-right text-xs leading-none text-surface-400" />
                                                    </div>
                                                </Link>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Linked Quotations */}
                        {rfq.quotations?.length > 0 && (
                            <div className="card animate-slide-up">
                                <div className="card-header">
                                    <h3 className="text-sm font-bold text-surface-900">Linked Quotations</h3>
                                    <p className="text-xs text-surface-400 mt-0.5">{rfq.quotations.length} quotation(s) prepared</p>
                                </div>
                                <div className="card-body space-y-2">
                                    {rfq.quotations.map((q: any) => (
                                        <div key={q.id} className="flex items-center justify-between p-3 rounded-xl border border-surface-100 hover:bg-surface-50 transition-colors duration-100">
                                            <div className="flex items-center gap-3">
                                                <div className="w-9 h-9 rounded-xl bg-surface-100 flex items-center justify-center">
                                                    <i className="fi fi-rr-file-invoice text-surface-500 text-sm leading-none" />
                                                </div>
                                                <div>
                                                    <span className="font-mono text-xs text-surface-500">v{q.version}</span>
                                                    <span className="ml-2 text-sm font-bold text-surface-900">
                                                        ৳{Number(q.total_amount).toLocaleString('en-IN')}
                                                    </span>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-3">
                                                <span className={`badge ${quotationStatusBadge[q.status] ?? 'badge-slate'}`}>
                                                    {q.status?.replace(/_/g, ' ')}
                                                </span>
                                                <Link href={`/quotations/${q.id}`} className="btn-ghost btn-xs">
                                                    View <i className="fi fi-rr-arrow-right text-xs leading-none" />
                                                </Link>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Right: Quick Info Sidebar */}
                    <div className="space-y-6">
                        {/* Automation Status Card */}
                        {(rfq.automation_source !== 'manual' || rfq.auto_estimate || rfq.duplicate_of_rfq_id) && (
                            <div className="card animate-slide-up border-brand-200 bg-gradient-to-br from-brand-50/30 to-white">
                                <div className="card-header">
                                    <div className="flex items-center gap-2">
                                        <i className="fi fi-rr-sparkles text-brand-500 leading-none" />
                                        <h3 className="text-sm font-bold text-surface-900">AI Automation</h3>
                                    </div>
                                </div>
                                <div className="card-body space-y-3">
                                    {/* Source badge */}
                                    <div className="flex items-center gap-2">
                                        <span className="text-[10px] uppercase tracking-wider text-surface-500 font-bold">Source</span>
                                        <span className={`badge ${rfq.automation_source === 'ai_chat' ? 'badge-purple' : 'badge-slate'}`}>
                                            {rfq.automation_source === 'ai_chat' ? '🤖 Oli (AI Chat)' : '✍️ Manual'}
                                        </span>
                                    </div>

                                    {/* Duplicate warning */}
                                    {rfq.duplicate_of_rfq_id && (
                                        <div className="flex items-start gap-2 px-3 py-2 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-xs">
                                            <i className="fi fi-rr-triangle-warning text-amber-500 mt-0.5 leading-none shrink-0" />
                                            <span>Possible duplicate of <Link href={`/rfqs/${rfq.duplicate_of_rfq_id}`} className="font-bold underline hover:text-amber-900">RFQ #{rfq.duplicate_of_rfq_id}</Link></span>
                                        </div>
                                    )}

                                    {/* Auto-estimate status */}
                                    {rfq.auto_estimate ? (
                                        <div className="px-3 py-2.5 rounded-lg bg-emerald-50 border border-emerald-200">
                                            <div className="flex items-center justify-between">
                                                <span className="text-xs font-bold text-emerald-800">
                                                    <i className="fi fi-rr-check-circle text-emerald-500 mr-1 leading-none" />
                                                    Auto-Estimate Generated
                                                </span>
                                                <span className="badge badge-green text-[9px]">{rfq.auto_estimate.confidence_score}% confidence</span>
                                            </div>
                                            <div className="mt-1.5 text-xs text-emerald-700">
                                                <Link href={`/cost-estimates/${rfq.auto_estimate.id}`} className="font-mono font-bold hover:underline">
                                                    {rfq.auto_estimate.estimate_no}
                                                </Link>
                                                {rfq.auto_estimate.grand_total && (
                                                    <span className="ml-2">৳{Number(rfq.auto_estimate.grand_total).toLocaleString()}</span>
                                                )}
                                                <span className={`ml-2 badge ${rfq.auto_estimate.status === 'draft' ? 'badge-amber' : 'badge-green'} text-[9px]`}>
                                                    {rfq.auto_estimate.status}
                                                </span>
                                            </div>
                                        </div>
                                    ) : rfq.automation_source === 'ai_chat' ? (
                                        <div className="px-3 py-2 rounded-lg bg-surface-50 border border-surface-200 text-xs text-surface-600">
                                            <i className="fi fi-rr-clock text-surface-400 mr-1 leading-none" />
                                            Auto-estimation pending or no historical match found
                                        </div>
                                    ) : null}
                                </div>
                            </div>
                        )}

                        <div className="card animate-slide-up overflow-hidden">
                            {/* Header strip: customer is the hero */}
                            <div className="px-5 py-4 bg-gradient-to-br from-brand-50/40 via-white to-brand-50/20 border-b border-surface-100">
                                <div className="flex items-start gap-3">
                                    <div className="w-10 h-10 rounded-xl bg-white shadow-sm ring-1 ring-brand-100 flex items-center justify-center text-brand-600 shrink-0">
                                        <i className="fi fi-rr-building text-base leading-none" />
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <div className="text-[10px] font-semibold text-surface-400 uppercase tracking-wider">Customer</div>
                                        <div className="text-sm font-bold text-surface-900 mt-0.5 truncate">{rfq.customer?.name}</div>
                                        {rfq.customer_ref_no && (
                                            <div className="text-[11px] text-surface-500 mt-0.5">
                                                Ref <span className="font-mono font-semibold text-surface-700">{rfq.customer_ref_no}</span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Compact 2-col fact grid — no rule-lines between rows */}
                            <div className="grid grid-cols-2 gap-y-3 gap-x-4 px-5 py-4">
                                <div>
                                    <dt className="text-[10px] font-semibold text-surface-400 uppercase tracking-wider">Status</dt>
                                    <dd className="mt-1">
                                        <span className={`badge ${statusBadge[rfq.status] ?? 'badge-slate'} capitalize`}>{rfq.status}</span>
                                    </dd>
                                </div>
                                <div>
                                    <dt className="text-[10px] font-semibold text-surface-400 uppercase tracking-wider">Job Type</dt>
                                    <dd className="mt-1">
                                        {rfq.job_type === 'rnd' ? (
                                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-purple-50 text-purple-700 border border-purple-200 text-[10px] font-bold uppercase tracking-wider">
                                                <i className="fi fi-rr-lab text-[9px] leading-none" /> R&amp;D
                                            </span>
                                        ) : (
                                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 border border-blue-200 text-[10px] font-bold uppercase tracking-wider">
                                                <i className="fi fi-rr-tools text-[9px] leading-none" /> Regular
                                            </span>
                                        )}
                                    </dd>
                                </div>

                                {rfq.required_by ? (
                                    <div>
                                        <dt className="text-[10px] font-semibold text-surface-400 uppercase tracking-wider">Required By</dt>
                                        <dd className="text-xs font-semibold text-surface-700 mt-1 flex items-center gap-1.5">
                                            <i className="fi fi-rr-calendar text-surface-400 text-[11px] leading-none" />
                                            {rfq.required_by}
                                        </dd>
                                    </div>
                                ) : <div />}

                                <div>
                                    <dt className="text-[10px] font-semibold text-surface-400 uppercase tracking-wider">Received</dt>
                                    <dd className="text-xs font-semibold text-surface-700 mt-1 flex items-center gap-1.5">
                                        <i className="fi fi-rr-clock text-surface-400 text-[11px] leading-none" />
                                        {rfq.created_at}
                                    </dd>
                                    {rfq.created_by && (
                                        <dd className="text-[10px] text-surface-400 mt-0.5 truncate" title={rfq.created_by}>by {rfq.created_by}</dd>
                                    )}
                                </div>

                                {rfq.job_category && (
                                    <div className="col-span-2">
                                        <dt className="text-[10px] font-semibold text-surface-400 uppercase tracking-wider">Job Category</dt>
                                        <dd className="text-xs font-semibold text-surface-700 mt-1 flex items-center gap-1.5">
                                            <i className="fi fi-rr-tags text-surface-400 text-[11px] leading-none" />
                                            {rfq.job_category.name}
                                            {rfq.job_category.code && (
                                                <span className="font-mono text-[10px] text-surface-400">({rfq.job_category.code})</span>
                                            )}
                                        </dd>
                                    </div>
                                )}

                                {rfq.notes && (
                                    <div className="col-span-2 mt-1 px-3 py-2 rounded-lg bg-amber-50/40 border border-amber-100/80">
                                        <dt className="text-[10px] font-semibold text-amber-700 uppercase tracking-wider flex items-center gap-1">
                                            <i className="fi fi-rr-comment-alt text-[10px] leading-none" /> Internal Note
                                        </dt>
                                        <dd className="text-xs text-surface-700 mt-1 leading-relaxed whitespace-pre-line">{rfq.notes}</dd>
                                    </div>
                                )}
                            </div>

                            {/* RFQ Letter — full-width clickable card at the bottom */}
                            {rfq.rfq_letter_url && (
                                <div className="px-5 pb-4 -mt-1">
                                    <dt className="text-[10px] font-semibold text-surface-400 uppercase tracking-wider mb-1.5">Customer's RFQ Letter</dt>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            if (rfq.rfq_letter_ext === 'pdf') {
                                                setLetterPdfOpen(true);
                                            } else {
                                                window.open(rfq.rfq_letter_url, '_blank', 'noreferrer');
                                            }
                                        }}
                                        className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg border border-surface-200 hover:border-rose-300 hover:bg-rose-50/40 transition-colors text-left group"
                                        title="Open attachment"
                                    >
                                        <div className="w-9 h-9 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center shrink-0">
                                            <i className={`fi ${rfq.rfq_letter_ext === 'pdf' ? 'fi-rr-file-pdf' : 'fi-rr-document'} text-base leading-none`} />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="text-xs font-semibold text-surface-900 truncate">{rfq.rfq_letter_title ?? 'RFQ letter'}</div>
                                            <div className="text-[10px] text-surface-400 uppercase tracking-wider mt-0.5">{rfq.rfq_letter_ext}</div>
                                        </div>
                                        <i className="fi fi-rr-arrow-up-right-from-square text-[10px] text-surface-400 group-hover:text-rose-600 leading-none shrink-0" />
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* RFQ Letter PDF popup */}
            <PdfPopupModal
                open={letterPdfOpen}
                pdfUrl={letterPdfOpen && rfq.rfq_letter_url
                    ? `${rfq.rfq_letter_url}${rfq.rfq_letter_url.includes('?') ? '&' : '?'}preview=base64`
                    : null}
                title={rfq.rfq_letter_title ?? 'RFQ letter'}
                subtitle={`RFQ #${rfq.id} · ${rfq.customer?.name ?? ''}`}
                onClose={() => setLetterPdfOpen(false)}
            />

            {/* Lightbox */}
            <FilePreviewModal
                open={lightboxOpen}
                files={lightboxFiles}
                initialIndex={lightboxIndex}
                onClose={() => setLightboxOpen(false)}
            />
        </AppLayout>
    );
}
