import { useForm } from '@inertiajs/react';
import { FormEvent, useEffect, useMemo, useState } from 'react';

export interface DeductionType {
    id: number;
    name: string;
    name_bn: string | null;
    is_recoverable: boolean;
    default_rate_pct: number | null;
}

export interface AdvanceableWorkOrder {
    id: number;
    wo_number: string;
    customer: string | null;
    job_number: number | string | null;
    advance: number;
    available: number;
}

interface Props {
    open: boolean;
    onClose: () => void;
    /** `advance` needs a job; `against_bill` needs the bill. */
    kind: 'advance' | 'against_bill';
    invoiceId?: number;
    invoiceNumber?: string;
    /** What is still unsettled — the amount field starts here. */
    dueAmount?: number;
    workOrderId?: number;
    workOrders?: AdvanceableWorkOrder[];
    deductionTypes: DeductionType[];
    methods: Record<string, string>;
    suggestedNo: string;
}

const money = (n: number) =>
    `৳${Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

interface Line {
    deduction_type_id: number | '';
    amount: string;
    note: string;
}

/**
 * Record money arriving.
 *
 * ⚠️ The sum at the bottom is the point of this form. A client rarely pays the
 * bill figure — they deduct security and tax at source and send the rest, so
 * the officer needs to see, as they type, that **gross − deductions = the cash
 * in the bank** and that the **bill is only settled by the part that is not
 * coming back**. Security withheld is still a due; tax at source is not.
 */
export default function RecordPaymentModal({
    open, onClose, kind, invoiceId, invoiceNumber, dueAmount,
    workOrderId, workOrders = [], deductionTypes, methods, suggestedNo,
}: Props) {
    const [lines, setLines] = useState<Line[]>([]);
    const [files, setFiles] = useState<File[]>([]);
    const [labels, setLabels] = useState<string[]>([]);

    const form = useForm<any>({
        kind,
        invoice_id: invoiceId ?? null,
        work_order_id: workOrderId ?? null,
        payment_no: suggestedNo,
        paid_on: new Date().toISOString().slice(0, 10),
        gross_amount: dueAmount && dueAmount > 0 ? String(dueAmount.toFixed(2)) : '',
        method: 'bank_transfer',
        bank_branch: '',
        reference: '',
        notes: '',
    });

    // Reopening the modal must not show the last attempt's figures.
    useEffect(() => {
        if (!open) return;
        form.setData({
            kind,
            invoice_id: invoiceId ?? null,
            work_order_id: workOrderId ?? null,
            payment_no: suggestedNo,
            paid_on: new Date().toISOString().slice(0, 10),
            gross_amount: dueAmount && dueAmount > 0 ? String(dueAmount.toFixed(2)) : '',
            method: 'bank_transfer',
            bank_branch: '',
            reference: '',
            notes: '',
        });
        setLines([]);
        setFiles([]);
        setLabels([]);
        form.clearErrors();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open]);

    const gross = Number(form.data.gross_amount || 0);

    const totals = useMemo(() => {
        let deducted = 0;
        let held = 0;
        for (const line of lines) {
            const amount = Number(line.amount || 0);
            if (!amount) continue;
            deducted += amount;
            const type = deductionTypes.find((t) => t.id === Number(line.deduction_type_id));
            if (type?.is_recoverable) held += amount;
        }
        return {
            deducted,
            held,
            net: gross - deducted,
            settles: gross - held,
        };
    }, [lines, gross, deductionTypes]);

    const addLine = () => setLines((l) => [...l, { deduction_type_id: '', amount: '', note: '' }]);
    const removeLine = (i: number) => setLines((l) => l.filter((_, idx) => idx !== i));
    const setLine = (i: number, patch: Partial<Line>) =>
        setLines((l) => l.map((row, idx) => (idx === i ? { ...row, ...patch } : row)));

    /** Picking a type with a default rate fills the amount from the gross. */
    const pickType = (i: number, id: number) => {
        const type = deductionTypes.find((t) => t.id === id);
        const suggested = type?.default_rate_pct && gross > 0
            ? ((gross * type.default_rate_pct) / 100).toFixed(2)
            : undefined;
        setLine(i, { deduction_type_id: id, ...(suggested && !lines[i].amount ? { amount: suggested } : {}) });
    };

    const submit = (e: FormEvent) => {
        e.preventDefault();
        form.transform((data: any) => ({
            ...data,
            deductions: lines
                .filter((l) => l.deduction_type_id && Number(l.amount) > 0)
                .map((l) => ({
                    deduction_type_id: l.deduction_type_id,
                    amount: l.amount,
                    note: l.note || null,
                })),
            files,
            labels,
        }));
        form.post('/payments', {
            forceFormData: true,
            preserveScroll: true,
            onSuccess: () => onClose(),
        });
    };

    if (!open) return null;

    const selectedWo = workOrders.find((w) => Number(w.id) === Number(form.data.work_order_id));

    return (
        <div className="fixed inset-0 z-[150] flex items-start justify-center p-4 overflow-y-auto">
            <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => !form.processing && onClose()} />
            <form onSubmit={submit} className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl my-6">
                <div className="px-5 py-3 border-b border-surface-100 flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                        <i className="fi fi-rr-sack-dollar text-sm leading-none" />
                    </div>
                    <div>
                        <h3 className="text-sm font-bold text-surface-900">
                            {kind === 'advance' ? 'Record advance' : `Record payment${invoiceNumber ? ` — ${invoiceNumber}` : ''}`}
                        </h3>
                        <p className="text-[11px] text-surface-500 leading-tight mt-0.5">
                            {kind === 'advance'
                                ? 'Money taken before the bill. It sits against the job until a bill draws on it.'
                                : 'Enter what the client paid, then what they deducted out of it.'}
                        </p>
                    </div>
                </div>

                <div className="p-5 space-y-4">
                    {kind === 'advance' && (
                        <div className="form-group !mb-0">
                            <label className="form-label">Job / Work Order <span className="text-red-500">*</span></label>
                            <select className="form-input" value={form.data.work_order_id ?? ''}
                                onChange={(e) => form.setData('work_order_id', e.target.value ? Number(e.target.value) : null)}>
                                <option value="">Select a job…</option>
                                {workOrders.map((w) => (
                                    <option key={w.id} value={w.id}>
                                        {w.wo_number}{w.job_number ? ` · Job #${w.job_number}` : ''}{w.customer ? ` — ${w.customer}` : ''}
                                    </option>
                                ))}
                            </select>
                            {form.errors.work_order_id && <p className="form-error">{form.errors.work_order_id as any}</p>}
                            {selectedWo && selectedWo.advance > 0 && (
                                <p className="form-hint">
                                    Already taken: {money(selectedWo.advance)} · unapplied {money(selectedWo.available)}
                                </p>
                            )}
                        </div>
                    )}

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div className="form-group !mb-0">
                            <label className="form-label">Receipt No.</label>
                            <input className="form-input font-mono text-sm" value={form.data.payment_no}
                                onChange={(e) => form.setData('payment_no', e.target.value)} />
                            {form.errors.payment_no && <p className="form-error">{form.errors.payment_no as any}</p>}
                        </div>
                        <div className="form-group !mb-0">
                            <label className="form-label">Date <span className="text-red-500">*</span></label>
                            <input type="date" className="form-input" value={form.data.paid_on}
                                onChange={(e) => form.setData('paid_on', e.target.value)} />
                            {form.errors.paid_on && <p className="form-error">{form.errors.paid_on as any}</p>}
                        </div>
                        <div className="form-group !mb-0">
                            <label className="form-label">
                                Amount paid <span className="text-red-500">*</span>
                            </label>
                            <input type="number" step="0.01" min="0.01" className="form-input text-right font-mono"
                                value={form.data.gross_amount}
                                onChange={(e) => form.setData('gross_amount', e.target.value)} />
                            {form.errors.gross_amount && <p className="form-error">{form.errors.gross_amount as any}</p>}
                            {kind === 'against_bill' && dueAmount !== undefined && (
                                <p className="form-hint">Due on this bill: {money(dueAmount)}</p>
                            )}
                        </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div className="form-group !mb-0">
                            <label className="form-label">Method <span className="text-red-500">*</span></label>
                            <select className="form-input" value={form.data.method}
                                onChange={(e) => form.setData('method', e.target.value)}>
                                {Object.entries(methods).map(([value, label]) => (
                                    <option key={value} value={value}>{label}</option>
                                ))}
                            </select>
                        </div>
                        <div className="form-group !mb-0">
                            <label className="form-label">Cheque / Transaction No.</label>
                            <input className="form-input" value={form.data.reference}
                                onChange={(e) => form.setData('reference', e.target.value)} />
                        </div>
                        <div className="form-group !mb-0">
                            <label className="form-label">Bank / Branch</label>
                            <input className="form-input" value={form.data.bank_branch}
                                onChange={(e) => form.setData('bank_branch', e.target.value)} />
                        </div>
                    </div>

                    {/* Deductions */}
                    <div className="rounded-xl border border-surface-200 overflow-hidden">
                        <div className="px-3 py-2 bg-surface-50 flex items-center justify-between gap-2">
                            <div>
                                <p className="text-xs font-bold text-surface-800">Deductions</p>
                                <p className="text-[10px] text-surface-500 leading-tight">
                                    What the client cut out — security, tax at source, penalty.
                                </p>
                            </div>
                            <button type="button" onClick={addLine} className="btn-outline btn-sm">
                                <i className="fi fi-rr-plus text-[10px] leading-none" /> Add
                            </button>
                        </div>
                        {lines.length === 0 ? (
                            <p className="px-3 py-3 text-xs text-surface-400">
                                Nothing deducted — the full amount settles the bill.
                            </p>
                        ) : (
                            <div className="divide-y divide-surface-100">
                                {lines.map((line, i) => {
                                    const type = deductionTypes.find((t) => t.id === Number(line.deduction_type_id));
                                    return (
                                        <div key={i} className="p-3 space-y-2">
                                            <div className="flex items-start gap-2">
                                                <select className="form-input flex-1 text-sm"
                                                    value={line.deduction_type_id}
                                                    onChange={(e) => pickType(i, Number(e.target.value))}>
                                                    <option value="">Deduction type…</option>
                                                    {deductionTypes.map((t) => (
                                                        <option key={t.id} value={t.id}>
                                                            {t.name}{t.default_rate_pct ? ` (${t.default_rate_pct}%)` : ''}
                                                        </option>
                                                    ))}
                                                </select>
                                                <input type="number" step="0.01" min="0"
                                                    className="form-input w-32 text-right font-mono text-sm"
                                                    placeholder="0.00" value={line.amount}
                                                    onChange={(e) => setLine(i, { amount: e.target.value })} />
                                                <button type="button" onClick={() => removeLine(i)}
                                                    className="w-9 h-9 shrink-0 rounded-lg text-red-500 hover:bg-red-50 flex items-center justify-center">
                                                    <i className="fi fi-rr-trash text-xs leading-none" />
                                                </button>
                                            </div>
                                            <input className="form-input text-xs" placeholder="Note (optional)"
                                                value={line.note} onChange={(e) => setLine(i, { note: e.target.value })} />
                                            {type && (
                                                <p className={`text-[11px] font-semibold ${type.is_recoverable ? 'text-amber-700' : 'text-surface-500'}`}>
                                                    {type.is_recoverable
                                                        ? '⚠️ Recoverable — stays in the dues until released.'
                                                        : 'Not recoverable — this part settles the bill.'}
                                                </p>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>

                    {/* The sum, as typed */}
                    <div className="rounded-xl border border-surface-200 bg-surface-50/60 p-3 space-y-1.5 text-sm">
                        <div className="flex justify-between">
                            <span className="text-surface-600">Amount paid</span>
                            <span className="font-mono">{money(gross)}</span>
                        </div>
                        {totals.deducted > 0 && (
                            <div className="flex justify-between text-surface-600">
                                <span>Less deductions</span>
                                <span className="font-mono">− {money(totals.deducted)}</span>
                            </div>
                        )}
                        <div className="flex justify-between font-bold border-t border-surface-200 pt-1.5">
                            <span className="text-surface-900">Cash received</span>
                            <span className={`font-mono ${totals.net < 0 ? 'text-red-600' : 'text-emerald-700'}`}>
                                {money(totals.net)}
                            </span>
                        </div>
                        {kind === 'against_bill' && (
                            <div className="flex justify-between text-xs pt-1">
                                <span className="text-surface-500">Settles on the bill</span>
                                <span className="font-mono font-semibold text-surface-800">{money(totals.settles)}</span>
                            </div>
                        )}
                        {totals.held > 0 && (
                            <p className="text-[11px] text-amber-700 pt-0.5">
                                {money(totals.held)} held as recoverable security — still owed to BITAC.
                            </p>
                        )}
                        {totals.net < 0 && (
                            <p className="text-[11px] text-red-600 font-semibold pt-0.5">
                                Deductions are more than the payment.
                            </p>
                        )}
                    </div>

                    {/* Proof */}
                    <div className="form-group !mb-0">
                        <label className="form-label">
                            Attachments <span className="form-label-optional">Optional</span>
                        </label>
                        <input type="file" multiple className="form-input" accept=".pdf,.jpg,.jpeg,.png,.webp"
                            onChange={(e) => {
                                const picked = Array.from(e.target.files ?? []);
                                setFiles(picked);
                                setLabels(picked.map(() => ''));
                            }} />
                        <p className="form-hint">Bank slip, cheque scan, treasury challan. Up to 6 files, 10 MB each.</p>
                        {files.length > 0 && (
                            <div className="mt-2 space-y-1.5">
                                {files.map((f, i) => (
                                    <div key={i} className="flex items-center gap-2">
                                        <span className="text-[11px] text-surface-600 flex-1 min-w-0 truncate">{f.name}</span>
                                        <input className="form-input !py-1 text-[11px] w-44" placeholder="Label (e.g. Bank slip)"
                                            value={labels[i] ?? ''}
                                            onChange={(e) => setLabels((l) => l.map((v, idx) => (idx === i ? e.target.value : v)))} />
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    <div className="form-group !mb-0">
                        <label className="form-label">Notes <span className="form-label-optional">Optional</span></label>
                        <textarea className="form-textarea" rows={2} value={form.data.notes}
                            onChange={(e) => form.setData('notes', e.target.value)} />
                    </div>
                </div>

                <div className="px-5 py-3 border-t border-surface-100 flex items-center justify-end gap-2">
                    <button type="button" onClick={onClose} disabled={form.processing} className="btn-ghost">Cancel</button>
                    <button type="submit" className="btn-primary"
                        disabled={form.processing || gross <= 0 || totals.net < 0
                            || (kind === 'advance' && !form.data.work_order_id)}>
                        {form.processing
                            ? <><i className="fi fi-rr-spinner animate-spin text-xs leading-none" /> Saving…</>
                            : <><i className="fi fi-rr-check text-xs leading-none" /> Record</>}
                    </button>
                </div>
            </form>
        </div>
    );
}
