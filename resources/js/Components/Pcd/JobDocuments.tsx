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

/**
 * One colour per kind of paper, so a glance says what is there.
 *
 * ⚠️ Each tone is a complete set — tile, border, hover tint, heading, button —
 * kept together rather than spelled out at every use. Tailwind only ships
 * classes it can see in the source, so these must stay written out in full;
 * building a class name from a variable (`bg-${tone}-50`) silently produces
 * nothing.
 */
const TONES = {
    sky: {
        tile: 'bg-sky-100 text-sky-700', row: 'border-sky-200 bg-sky-50/40 hover:bg-sky-50',
        head: 'text-sky-700', btn: 'bg-white text-sky-700 border border-sky-200 hover:bg-sky-50',
    },
    emerald: {
        tile: 'bg-emerald-100 text-emerald-700', row: 'border-emerald-200 bg-emerald-50/40 hover:bg-emerald-50',
        head: 'text-emerald-700', btn: 'bg-white text-emerald-700 border border-emerald-200 hover:bg-emerald-50',
    },
    violet: {
        tile: 'bg-violet-100 text-violet-700', row: 'border-violet-200 bg-violet-50/40 hover:bg-violet-50',
        head: 'text-violet-700', btn: 'bg-white text-violet-700 border border-violet-200 hover:bg-violet-50',
    },
    teal: {
        tile: 'bg-teal-100 text-teal-700', row: 'border-teal-200 bg-teal-50/40 hover:bg-teal-50',
        head: 'text-teal-700', btn: 'bg-white text-teal-700 border border-teal-200 hover:bg-teal-50',
    },
    amber: {
        tile: 'bg-amber-100 text-amber-700', row: 'border-amber-200 bg-amber-50/40 hover:bg-amber-50',
        head: 'text-amber-700', btn: 'bg-white text-amber-700 border border-amber-200 hover:bg-amber-50',
    },
    slate: {
        tile: 'bg-surface-200 text-surface-600', row: 'border-surface-200 bg-surface-50/60 hover:bg-surface-100',
        head: 'text-surface-500', btn: 'bg-white text-surface-600 border border-surface-200 hover:bg-surface-50',
    },
} as const;

type Tone = keyof typeof TONES;

const statusChip = (text: string, tone: 'slate' | 'amber' | 'green') => {
    const tones = {
        slate: 'bg-white text-surface-600 border-surface-200',
        amber: 'bg-white text-amber-700 border-amber-200',
        green: 'bg-white text-emerald-700 border-emerald-200',
    };
    return `text-[9px] px-1.5 py-0.5 rounded border font-bold uppercase tracking-wide ${tones[tone]}`;
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

    const Section = ({ tone, icon, label, n, children }: {
        tone: Tone; icon: string; label: string; n?: number; children: any;
    }) => (
        <div className="space-y-1.5">
            <div className="flex items-center gap-1.5">
                <i className={`fi ${icon} text-[11px] leading-none ${TONES[tone].head}`} />
                <p className={`text-[10px] uppercase tracking-wider font-bold ${TONES[tone].head}`}>
                    {label}{n !== undefined && n > 1 ? ` (${n})` : ''}
                </p>
            </div>
            {children}
        </div>
    );

    const Row = ({ tone, icon, title, subtitle, onOpen, badge }: {
        tone: Tone; icon: string; title: string; subtitle?: string; onOpen: () => void; badge?: any;
    }) => (
        <div className={`flex items-center gap-2.5 p-2.5 rounded-xl border transition-all ${TONES[tone].row}`}>
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${TONES[tone].tile}`}>
                <i className={`fi ${icon} text-xs leading-none`} />
            </div>
            <div className="min-w-0 flex-1">
                <div className="font-bold text-surface-900 text-sm truncate leading-tight">{title}</div>
                {subtitle && <p className="text-[11px] text-surface-500 truncate mt-0.5">{subtitle}</p>}
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
                {badge}
                <button type="button" onClick={onOpen} title="Open PDF"
                    className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-bold shadow-sm transition-colors ${TONES[tone].btn}`}>
                    <i className="fi fi-rr-file-pdf text-[10px] leading-none" /> PDF
                </button>
            </div>
        </div>
    );

    return (
        <div className={`rounded-2xl border border-emerald-200 bg-white shadow-sm overflow-hidden animate-fade-in ${className}`}>
            {/* A tinted band, so the card is found at a glance on a long page
                without shouting over the content inside it. */}
            <div className="px-4 py-3 bg-emerald-50 border-b border-emerald-100 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                        <i className="fi fi-rr-folder-open text-sm leading-none" />
                    </div>
                    <div className="min-w-0">
                        <h3 className="text-sm font-bold text-emerald-900 leading-tight">Documents</h3>
                        <p className="text-[11px] text-emerald-700/70 leading-tight mt-0.5">
                            Everything that came with this job from IED
                        </p>
                    </div>
                </div>
                <span className="shrink-0 min-w-[28px] h-7 px-2 rounded-lg bg-emerald-100 text-emerald-700 text-sm font-extrabold flex items-center justify-center">
                    {count}
                </span>
            </div>

            <div className="p-4 space-y-4">
                {count === 0 && (
                    <div className="text-center py-6">
                        <div className="w-10 h-10 rounded-xl bg-surface-100 flex items-center justify-center mx-auto mb-2">
                            <i className="fi fi-rr-folder-open text-surface-400 text-sm leading-none" />
                        </div>
                        <p className="text-xs text-surface-400">No documents were attached to this job.</p>
                    </div>
                )}

                {d?.rfq_letter && (
                    <Section tone="sky" icon="fi-rr-envelope" label="Customer RFQ Letter">
                        <Row tone="sky" icon="fi-rr-envelope"
                            title={d.rfq_letter.title}
                            subtitle={[d.rfq_letter.label, d.rfq_letter.date].filter(Boolean).join(' · ')}
                            onOpen={() => open(d.rfq_letter!.pdf_url, d.rfq_letter!.title)} />
                    </Section>
                )}

                {d?.quotation && (
                    <Section tone="emerald" icon="fi-rr-coins" label="Approved Quotation">
                        <Row tone="emerald" icon="fi-rr-coins"
                            title={d.quotation.label}
                            subtitle={`৳ ${money(d.quotation.amount)}`}
                            badge={<span className={statusChip(d.quotation.status, 'green')}>{d.quotation.status.replace(/_/g, ' ')}</span>}
                            onOpen={() => open(d.quotation!.pdf_url, d.quotation!.label)} />
                    </Section>
                )}

                {d?.cost_estimates?.length > 0 && (
                    <Section tone="violet" icon="fi-rr-calculator" label="Cost Estimate" n={d.cost_estimates.length}>
                        <div className="space-y-1.5">
                            {d.cost_estimates.map((e) => (
                                <Row key={e.id} tone="violet" icon="fi-rr-calculator"
                                    title={e.estimate_no || `Estimate #${e.id}`}
                                    subtitle={[e.job_name, e.part_no ? `Part ${e.part_no}` : null, `৳ ${money(e.grand_total)}`]
                                        .filter(Boolean).join(' · ')}
                                    badge={e.approval_status === 'approved'
                                        ? <span className={statusChip('approved', 'green')}>approved</span>
                                        : <span className={statusChip(e.status, 'amber')}>{e.status.replace(/_/g, ' ')}</span>}
                                    onOpen={() => open(e.pdf_url, e.estimate_no || `Estimate #${e.id}`)} />
                            ))}
                        </div>
                    </Section>
                )}

                {/* Grouped under BITAC's own labels, and given opposite colours:
                    what came IN is on the floor, what went OUT has gone back. */}
                {(['in', 'out'] as const).map((direction) => {
                    const passes = (d?.gate_passes ?? []).filter((gp) => gp.direction === direction);
                    if (passes.length === 0) return null;
                    const label = direction === 'in' ? 'Gate Pass In' : 'Gate Pass Out';
                    const tone: Tone = direction === 'in' ? 'teal' : 'amber';
                    const icon = direction === 'in' ? 'fi-rr-sign-in-alt' : 'fi-rr-sign-out-alt';
                    return (
                        <Section key={direction} tone={tone} icon={icon} label={label} n={passes.length}>
                            <div className="space-y-1.5">
                                {passes.map((gp) => (
                                    <Row key={gp.id} tone={tone} icon={icon}
                                        title={gp.pass_no || `Pass #${gp.id}`}
                                        subtitle={[
                                            gp.pass_date,
                                            gp.party_name,
                                            `${gp.item_count} item${gp.item_count !== 1 ? 's' : ''}`,
                                            gp.items.slice(0, 2).join(', '),
                                        ].filter(Boolean).join(' · ')}
                                        badge={<span className={statusChip(gp.status, 'slate')}>{gp.status.replace(/_/g, ' ')}</span>}
                                        onOpen={() => open(gp.pdf_url, gp.pass_no || `${label} #${gp.id}`)} />
                                ))}
                            </div>
                        </Section>
                    );
                })}

                {d?.attachments?.length > 0 && (
                    <Section tone="slate" icon="fi-rr-clip" label="Attached files" n={d.attachments.length}>
                        <div className="space-y-1.5">
                            {d.attachments.map((f) => (
                                <Row key={f.id} tone="slate" icon="fi-rr-clip"
                                    title={f.name || `File #${f.id}`}
                                    subtitle={f.kind ? f.kind.replace(/_/g, ' ') : undefined}
                                    onOpen={() => open(f.pdf_url, f.name || `File #${f.id}`)} />
                            ))}
                        </div>
                    </Section>
                )}
            </div>

            <PdfPopupModal open={pdf !== null} pdfUrl={pdf?.url ?? null}
                title={pdf?.title ?? 'Document'} onClose={() => setPdf(null)} />
        </div>
    );
}
