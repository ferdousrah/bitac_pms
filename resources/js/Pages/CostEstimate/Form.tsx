import AppLayout from '@/Layouts/AppLayout';
import { Link, useForm } from '@inertiajs/react';
import { FormEvent } from 'react';
import EstimateEditor, { Line, newLine } from '@/Components/CostEstimate/EstimateEditor';

export default function CostEstimateForm({ estimate, rfq, rfqItem, rfqItemPart, materials, operations, customers }: any) {
    const isEdit = !!estimate;

    const initLines = (section: Line['section']) =>
        estimate?.lines?.filter((l: any) => l.section === section).map((l: any) => ({
            section: l.section, material_id: l.material_id, operation_id: l.operation_id,
            description: l.description, quantity: String(l.quantity), unit: l.unit, rate: String(l.rate),
        })) ?? [newLine(section)];

    // Pre-fill from RFQ item context if creating. Costing a single PART takes
    // its quantity from the part (an absolute piece count for the order), and
    // its part number is positional so it comes ready-made from the server.
    const defaultJobName = estimate?.job_name
        ?? rfqItem?.job_description
        ?? '';
    const defaultJobQty = estimate?.job_quantity
        ?? (rfqItemPart?.quantity ? Number(rfqItemPart.quantity)
            : rfqItem?.quantity ? Number(rfqItem.quantity) : 1);

    const { data, setData, post, put, processing, errors } = useForm<any>({
        rfq_id:           estimate?.rfq_id ?? rfqItem?.rfq_id ?? rfq?.id ?? null,
        rfq_item_id:      estimate?.rfq_item_id ?? rfqItem?.id ?? null,
        rfq_item_part_id: estimate?.rfq_item_part_id ?? rfqItemPart?.id ?? null,
        customer_id:      estimate?.customer_id ?? rfqItem?.customer_id ?? rfq?.customer_id ?? '',
        company_name:     estimate?.company_name ?? rfqItem?.customer_name ?? rfq?.customer_name ?? '',
        job_name:         defaultJobName,
        part_no:          estimate?.part_no ?? rfqItemPart?.part_no ?? '',
        actual_size:      estimate?.actual_size ?? '',
        materials_size:   estimate?.materials_size ?? '',
        pricing_group:    estimate?.pricing_group ?? 'B',
        overhead_pct:     estimate?.overhead_pct ?? 25,
        extra_cost:       estimate?.extra_cost ?? 0,
        vat_pct:          estimate?.vat_pct ?? 15,
        tax_pct:          estimate?.tax_pct ?? 0,
        times_multiplier: estimate?.times_multiplier ?? 1,
        job_quantity:     defaultJobQty,
        // Manual round-off override (e.g. ৳250,500 → ৳250,000). Blank = auto.
        grand_total_override: estimate?.grand_total_override ?? '',
        notes:            estimate?.notes ?? '',
        lines: [
            ...initLines('material'),
            ...initLines('machining'),
            ...initLines('surface'),
            ...initLines('other'),
        ] as Line[],
    });

    const submit = (e: FormEvent) => {
        e.preventDefault();
        if (isEdit) put(`/cost-estimates/${estimate.id}`);
        else post('/cost-estimates');
    };

    return (
        <AppLayout header={isEdit ? `Cost Estimate ${estimate.estimate_no}` : 'New Cost Estimate'}>
            <div className="max-w-7xl animate-fade-in pb-32">
                <form onSubmit={submit} className="space-y-6">

                    {/* ── RFQ Item context banner (when creating from an RFQ item) ──── */}
                    {rfqItem && !isEdit && (
                        <div className="rounded-2xl p-4 bg-gradient-to-r from-indigo-50 to-purple-50 border border-indigo-200 flex items-start gap-3">
                            <div className="w-10 h-10 rounded-xl bg-indigo-500 flex items-center justify-center text-white shrink-0">
                                <i className="fi fi-rr-link text-base leading-none" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="text-xs font-bold text-indigo-700 uppercase tracking-wider mb-0.5">
                                    {rfqItemPart ? 'Estimating one part of this job' : 'Estimating for RFQ Item'}
                                </div>
                                <div className="text-sm font-semibold text-surface-900">
                                    {rfqItemPart && (
                                        <span className="font-mono text-xs font-bold px-1.5 py-0.5 mr-2 rounded bg-indigo-100 text-indigo-700 border border-indigo-200">
                                            Part {rfqItemPart.part_no}
                                        </span>
                                    )}
                                    {rfqItemPart ? rfqItemPart.name : rfqItem.job_description}
                                </div>
                                {rfqItemPart && (
                                    <div className="text-xs text-surface-500 mt-0.5">
                                        Job: {rfqItem.job_description} — this part is costed on its own, and the job total
                                        is the sum of all its parts. The customer only ever sees the job total.
                                    </div>
                                )}
                                <div className="text-xs text-surface-600 mt-0.5 flex items-center gap-3 flex-wrap">
                                    <span>📦 Quantity: <span className="font-bold text-surface-800">
                                        {rfqItemPart ? `${rfqItemPart.quantity} ${rfqItemPart.unit}` : `${rfqItem.quantity} ${rfqItem.unit}`}
                                    </span></span>
                                    <span>🏢 Customer: <span className="font-semibold text-surface-800">{rfqItem.customer_name || '—'}</span></span>
                                    <Link href={`/rfqs/${rfqItem.rfq_id}`} className="text-indigo-600 hover:text-indigo-800 font-semibold">
                                        View RFQ #{rfqItem.rfq_id} →
                                    </Link>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Show linked item on edit */}
                    {isEdit && estimate?.rfq_item && (
                        <div className="rounded-xl p-3 bg-indigo-50/70 border border-indigo-200 flex items-center gap-3 text-xs">
                            <i className="fi fi-rr-link text-indigo-500 text-sm leading-none" />
                            <span className="text-surface-700">
                                Linked to RFQ Item: <span className="font-bold text-surface-900">{estimate.rfq_item.job_description}</span>
                                {' · '}Qty: <span className="font-semibold">{estimate.rfq_item.quantity} {estimate.rfq_item.unit}</span>
                            </span>
                            {estimate.rfq_id && (
                                <Link href={`/rfqs/${estimate.rfq_id}`} className="ml-auto text-indigo-600 hover:text-indigo-800 font-semibold">
                                    View RFQ #{estimate.rfq_id} →
                                </Link>
                            )}
                        </div>
                    )}

                    <EstimateEditor
                        data={data}
                        setData={setData}
                        errors={errors}
                        materials={materials}
                        operations={operations}
                        customers={customers}
                        footer={
                            <div className="flex items-center gap-3">
                                <button type="submit" disabled={processing} className="btn-primary">
                                    {processing ? (
                                        <><i className="fi fi-rr-spinner animate-spin text-sm leading-none" /> Saving...</>
                                    ) : (
                                        <><i className="fi fi-rr-check text-sm leading-none" /> {isEdit ? 'Update' : 'Save'} Estimate</>
                                    )}
                                </button>
                                <Link href="/cost-estimates" className="btn-outline">Cancel</Link>
                            </div>
                        }
                    />
                </form>
            </div>
        </AppLayout>
    );
}
