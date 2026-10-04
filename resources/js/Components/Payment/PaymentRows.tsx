import { router } from '@inertiajs/react';

export interface PaymentRow {
    id: number;
    payment_no: string;
    kind: string;
    kind_label: string;
    is_cash: boolean;
    paid_on: string | null;
    gross: number;
    deducted: number;
    net: number;
    settled: number;
    method: string | null;
    method_label: string | null;
    bank_branch: string | null;
    reference: string | null;
    notes: string | null;
    customer?: string | null;
    invoice?: string | null;
    invoice_id?: number | null;
    wo_number?: string | null;
    recorded_by: string | null;
    deductions: {
        id: number;
        type: string | null;
        is_recoverable: boolean;
        amount: number;
        note: string | null;
        released: boolean;
    }[];
    files: { id: number; url: string; name: string | null; label: string | null; is_image: boolean }[];
}

const money = (n: number) =>
    `৳${Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const kindTone: Record<string, string> = {
    advance: 'bg-sky-50 text-sky-700 border-sky-200',
    against_bill: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    advance_applied: 'bg-violet-50 text-violet-700 border-violet-200',
    security_release: 'bg-amber-50 text-amber-700 border-amber-200',
};

/**
 * The ledger, row by row.
 *
 * ⚠️ An `advance_applied` row carries NO cash — it spends an advance that was
 * already received. It is badged differently and its "cash" column reads "—",
 * because showing it as money arriving would count the same taka twice.
 */
export default function PaymentRows({
    payments, canDelete = false, showInvoice = false, emptyText = 'No payments recorded yet.',
}: {
    payments: PaymentRow[];
    canDelete?: boolean;
    showInvoice?: boolean;
    emptyText?: string;
}) {
    const remove = (p: PaymentRow) => {
        if (!confirm(`Remove payment ${p.payment_no}?\n\nThe bill's due will be recalculated.`)) return;
        router.delete(`/payments/${p.id}`, { preserveScroll: true });
    };

    if (payments.length === 0) {
        return <p className="text-xs text-surface-400 text-center py-6">{emptyText}</p>;
    }

    return (
        <div className="divide-y divide-surface-100">
            {payments.map((p) => (
                <div key={p.id} className="py-3 first:pt-0 last:pb-0">
                    <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-mono text-xs font-bold text-surface-900">{p.payment_no}</span>
                                <span className={`text-[10px] px-1.5 py-0.5 rounded border font-bold ${kindTone[p.kind] ?? 'bg-surface-100 text-surface-600 border-surface-200'}`}>
                                    {p.kind_label}
                                </span>
                                {showInvoice && p.invoice && (
                                    <a href={`/invoices/${p.invoice_id}`} className="text-[11px] text-brand-600 hover:underline font-semibold">
                                        {p.invoice}
                                    </a>
                                )}
                            </div>
                            <p className="text-[11px] text-surface-500 mt-0.5">
                                {p.paid_on ?? '—'}
                                {p.method_label ? ` · ${p.method_label}` : ''}
                                {p.reference ? ` · ${p.reference}` : ''}
                                {p.bank_branch ? ` · ${p.bank_branch}` : ''}
                                {p.recorded_by ? ` · by ${p.recorded_by}` : ''}
                            </p>
                        </div>
                        <div className="text-right shrink-0">
                            <p className="font-mono font-bold text-surface-900 text-sm">{money(p.gross)}</p>
                            <p className="text-[11px] text-surface-500">
                                {p.is_cash ? `cash ${money(p.net)}` : 'no cash — advance spent'}
                            </p>
                            {canDelete && (
                                <button type="button" onClick={() => remove(p)}
                                    className="mt-1 text-[11px] text-red-500 hover:text-red-600 font-semibold">
                                    Remove
                                </button>
                            )}
                        </div>
                    </div>

                    {p.deductions.length > 0 && (
                        <div className="mt-2 ml-0 rounded-lg bg-surface-50 border border-surface-100 divide-y divide-surface-100">
                            {p.deductions.map((d) => (
                                <div key={d.id} className="px-2.5 py-1.5 flex items-center justify-between gap-2 text-[11px]">
                                    <span className="min-w-0 truncate">
                                        <span className="font-semibold text-surface-700">{d.type ?? '—'}</span>
                                        {d.is_recoverable && (
                                            <span className={`ml-1.5 px-1 py-0.5 rounded border font-bold ${d.released
                                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                                : 'bg-amber-50 text-amber-700 border-amber-200'}`}>
                                                {d.released ? 'released' : 'held'}
                                            </span>
                                        )}
                                        {d.note && <span className="text-surface-400"> · {d.note}</span>}
                                    </span>
                                    <span className="font-mono text-surface-600 shrink-0">− {money(d.amount)}</span>
                                </div>
                            ))}
                            <div className="px-2.5 py-1.5 flex items-center justify-between text-[11px] font-bold">
                                <span className="text-surface-600">Settles on the bill</span>
                                <span className="font-mono text-surface-900">{money(p.settled)}</span>
                            </div>
                        </div>
                    )}

                    {p.files.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1.5">
                            {p.files.map((f) => (
                                <a key={f.id} href={f.url} target="_blank" rel="noreferrer"
                                    className="inline-flex items-center gap-1 px-2 py-1 rounded-lg border border-surface-200 bg-white text-[11px] font-semibold text-surface-700 hover:bg-surface-50">
                                    <i className={`fi ${f.is_image ? 'fi-rr-picture' : 'fi-rr-file-pdf'} text-[10px] leading-none`} />
                                    {f.label || f.name || 'Attachment'}
                                </a>
                            ))}
                        </div>
                    )}

                    {p.notes && <p className="mt-1.5 text-[11px] text-surface-500 italic">{p.notes}</p>}
                </div>
            ))}
        </div>
    );
}
