import { useState } from 'react';
import PdfPopupModal from '@/Components/PdfPopupModal';

export interface JobDocumentSet {
    rfq_letter: { label: string; title: string; date: string | null; extension: string; pdf_url: string } | null;
    quotation: { label: string; amount: number; status: string; pdf_url: string } | null;
    gate_passes: Array<{
        id: number; pass_no: string | null; direction: 'in' | 'out'; status: string;
        pass_date: string | null; party_name: string | null; item_count: number;
        items: string[]; pdf_url: string;
    }>;
    cost_estimates: Array<{
        id: number; estimate_no: string | null; job_name: string | null; part_no: string | null;
        grand_total: number; status: string; approval_status: string | null; pdf_url: string;
    }>;
    attachments: Array<{ id: number; kind: string | null; name: string | null; extension: string; pdf_url: string }>;
}

const money = (n: number) =>
    n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const chip = (text: string, tone: 'slate' | 'amber' | 'green' = 'slate') => {
    const tones = {
        slate: 'bg-surface-100 text-surface-600 border-surface-200',
        amber: 'bg-amber-50 text-amber-700 border-amber-200',
        green: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    };
    return `text-[10px] px-1.5 py-0.5 rounded border font-semibold uppercase ${tones[tone]}`;
};

/**
 * The paperwork that came with the job from IED.
 *
 * ⚠️ Rendered on BOTH PCD screens — the inbox (where the নির্বাহী প্রকৌশলী
 * decides) and the planning desk — from one `documents` prop packed by
 * `App\Services\PcdJobDocuments`. The boss and the planner must be looking at
 * the same papers.
 */
export default function JobDocuments({ documents, className = '' }: { documents: JobDocumentSet; className?: string }) {
    const [pdf, setPdf] = useState<{ url: string; title: string } | null>(null);

    const d = documents;
    const count =
        (d?.rfq_letter ? 1 : 0) + (d?.quotation ? 1 : 0) +
        (d?.gate_passes?.length ?? 0) + (d?.cost_estimates?.length ?? 0) +
        (d?.attachments?.length ?? 0);

    const open = (url: string, title: string) => setPdf({ url, title });

    const Row = ({ title, subtitle, onOpen, badge }: any) => (
        <div className="flex items-center justify-between gap-3 p-2.5 rounded-lg border border-surface-200 hover:border-brand-300 hover:bg-brand-50/30 transition-all">
            <div className="min-w-0">
                <div className="font-semibold text-surface-900 text-sm truncate">{title}</div>
                {subtitle && <p className="text-[11px] text-surface-500 truncate">{subtitle}</p>}
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
                {badge}
                <button type="button" onClick={onOpen} title="Open PDF"
                    className="px-2 py-1 rounded-lg text-[11px] font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200 hover:bg-indigo-100">
                    PDF
                </button>
            </div>
        </div>
    );

    return (
        <div className={`card ${className}`}>
            <div className="card-header">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
                        <h3 className="text-base font-semibold text-surface-900">Documents</h3>
                    </div>
                    <span className="badge badge-slate">{count}</span>
                </div>
                <p className="text-[11px] text-surface-400 mt-1">Everything that came with this job from IED.</p>
            </div>

            <div className="card-body space-y-4">
                {count === 0 && (
                    <p className="text-xs text-surface-400 py-4 text-center">
                        No documents were attached to this job.
                    </p>
                )}

                {d?.rfq_letter && (
                    <div className="space-y-2">
                        <p className="text-[10px] uppercase tracking-wider font-bold text-surface-400">Customer RFQ Letter</p>
                        <Row title={d.rfq_letter.title}
                            subtitle={`${d.rfq_letter.label}${d.rfq_letter.date ? ` · ${d.rfq_letter.date}` : ''}`}
                            onOpen={() => open(d.rfq_letter!.pdf_url, d.rfq_letter!.title)} />
                    </div>
                )}

                {d?.quotation && (
                    <div className="space-y-2">
                        <p className="text-[10px] uppercase tracking-wider font-bold text-surface-400">Approved Quotation</p>
                        <Row title={d.quotation.label}
                            subtitle={`৳ ${money(d.quotation.amount)}`}
                            badge={<span className={chip(d.quotation.status.replace(/_/g, ' '), 'green')}>{d.quotation.status.replace(/_/g, ' ')}</span>}
                            onOpen={() => open(d.quotation!.pdf_url, d.quotation!.label)} />
                    </div>
                )}

                {d?.cost_estimates?.length > 0 && (
                    <div className="space-y-2">
                        <p className="text-[10px] uppercase tracking-wider font-bold text-surface-400">
                            Cost Estimate{d.cost_estimates.length !== 1 ? `s (${d.cost_estimates.length})` : ''}
                        </p>
                        {d.cost_estimates.map((e) => (
                            <Row key={e.id}
                                title={e.estimate_no || `Estimate #${e.id}`}
                                subtitle={[e.job_name, e.part_no ? `Part ${e.part_no}` : null, `৳ ${money(e.grand_total)}`]
                                    .filter(Boolean).join(' · ')}
                                badge={e.approval_status === 'approved'
                                    ? <span className={chip('approved', 'green')}>approved</span>
                                    : <span className={chip(e.status, 'amber')}>{e.status}</span>}
                                onOpen={() => open(e.pdf_url, e.estimate_no || `Estimate #${e.id}`)} />
                        ))}
                    </div>
                )}

                {/* Grouped under BITAC's own labels. What came IN says what is on
                    the floor; what went OUT says what has gone back. */}
                {(['in', 'out'] as const).map((direction) => {
                    const passes = (d?.gate_passes ?? []).filter((gp) => gp.direction === direction);
                    if (passes.length === 0) return null;
                    const label = direction === 'in' ? 'Gate Pass In' : 'Gate Pass Out';
                    return (
                        <div key={direction} className="space-y-2">
                            <p className="text-[10px] uppercase tracking-wider font-bold text-surface-400">
                                {label}{passes.length !== 1 ? ` (${passes.length})` : ''}
                            </p>
                            {passes.map((gp) => (
                                <Row key={gp.id}
                                    title={gp.pass_no || `Pass #${gp.id}`}
                                    subtitle={[
                                        gp.pass_date,
                                        gp.party_name,
                                        `${gp.item_count} item${gp.item_count !== 1 ? 's' : ''}`,
                                        gp.items.slice(0, 2).join(', '),
                                    ].filter(Boolean).join(' · ')}
                                    badge={<span className={chip(gp.status.replace(/_/g, ' '))}>{gp.status.replace(/_/g, ' ')}</span>}
                                    onOpen={() => open(gp.pdf_url, gp.pass_no || `${label} #${gp.id}`)} />
                            ))}
                        </div>
                    );
                })}

                {d?.attachments?.length > 0 && (
                    <div className="space-y-2">
                        <p className="text-[10px] uppercase tracking-wider font-bold text-surface-400">
                            Attached files ({d.attachments.length})
                        </p>
                        {d.attachments.map((f) => (
                            <Row key={f.id}
                                title={f.name || `File #${f.id}`}
                                subtitle={f.kind ? f.kind.replace(/_/g, ' ') : undefined}
                                onOpen={() => open(f.pdf_url, f.name || `File #${f.id}`)} />
                        ))}
                    </div>
                )}
            </div>

            <PdfPopupModal open={pdf !== null} pdfUrl={pdf?.url ?? null}
                title={pdf?.title ?? 'Document'} onClose={() => setPdf(null)} />
        </div>
    );
}
