import AppLayout from '@/Layouts/AppLayout';
import { Link, useForm } from '@inertiajs/react';
import { FormEvent } from 'react';

interface Line {
    key: number;
    description: string;
    part_no: string | null;
    unit: string;
    ordered: number;
    earlier: number;
    remaining: number;
}

const num = (n: number) => Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 });

/**
 * A delivery is FULL (every item of the job at once) or PARTIAL — a quantity
 * per item, printed as the Partial Challan (BITAC, 2026-10-24). The server
 * re-checks every line against what is left and against what has passed QC,
 * and records full / partial from the figures, not from the button.
 */
export default function DeliveryCreate({ workOrders, workOrder }: any) {
    const linesFor = (wo: any) => (wo?.lines ?? []).map((l: Line) => ({ key: l.key, quantity: String(l.remaining) }));
    const { data, setData, post, errors, processing } = useForm<any>({
        work_order_id: workOrder?.id ?? '',
        // Full only when everything left has passed QC.
        delivery_type: !workOrder || (workOrder.lines ?? []).reduce((s: number, l: Line) => s + l.remaining, 0) <= Number(workOrder.deliverable ?? 0) + 0.001
            ? 'full' : 'partial',
        lines: linesFor(workOrder),
        scheduled_date: '',
        delivery_address: workOrder?.customer_address ?? '',
        vehicle_number: '',
        driver_name: '',
        notes: '',
    });

    const selectedWo = (workOrders ?? []).find((w: any) => String(w.id) === String(data.work_order_id)) ?? workOrder;
    const lines: Line[] = selectedWo?.lines ?? [];
    const deliverable = Number(selectedWo?.deliverable ?? 0);
    const remainingTotal = lines.reduce((s, l) => s + l.remaining, 0);
    const isFull = data.delivery_type === 'full';
    // Everything left can only go at once if all of it has passed QC.
    const fullPossible = remainingTotal > 0 && remainingTotal <= deliverable + 0.001;
    const qtyOf = (key: number) => {
        if (isFull) return lines.find((l) => l.key === key)?.remaining ?? 0;
        return Number(data.lines.find((x: any) => x.key === key)?.quantity ?? 0);
    };
    const total = lines.reduce((s, l) => s + qtyOf(l.key), 0);
    const finishes = lines.every((l) => l.remaining - qtyOf(l.key) <= 0.001);

    const chooseWo = (id: string) => {
        const wo = (workOrders ?? []).find((w: any) => String(w.id) === String(id));
        const canFull = wo && (wo.lines ?? []).reduce((s: number, l: Line) => s + l.remaining, 0) <= Number(wo.deliverable ?? 0) + 0.001;
        setData((d: any) => ({
            ...d,
            work_order_id: id,
            delivery_type: canFull ? 'full' : 'partial',
            lines: linesFor(wo),
            delivery_address: wo?.customer_address || d.delivery_address,
        }));
    };
    const setLine = (key: number, value: string) =>
        setData('lines', data.lines.map((x: any) => (x.key === key ? { ...x, quantity: value } : x)));

    const submit = (e: FormEvent) => {
        e.preventDefault();
        post('/delivery');
    };

    const typeCard = (value: 'full' | 'partial', title: string, hint: string, icon: string, disabled = false) => {
        const on = data.delivery_type === value;
        return (
            <button type="button" disabled={disabled} onClick={() => setData('delivery_type', value)}
                className={`flex items-start gap-3 p-3 rounded-xl border text-left transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
                    on ? (value === 'full' ? 'bg-emerald-50 border-emerald-400 ring-2 ring-emerald-200' : 'bg-orange-50 border-orange-400 ring-2 ring-orange-200')
                       : 'bg-white border-surface-200 hover:border-surface-300'}`}>
                <span className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
                    on ? (value === 'full' ? 'bg-emerald-500 text-white' : 'bg-orange-500 text-white') : 'bg-surface-100 text-surface-500'}`}>
                    <i className={`fi ${icon} text-sm leading-none`} />
                </span>
                <span className="min-w-0">
                    <span className="block text-sm font-bold text-surface-900">{title}</span>
                    <span className="block text-[11px] text-surface-500 mt-0.5">{hint}</span>
                </span>
            </button>
        );
    };

    return (
        <AppLayout header="New Delivery Order">
            <div className="max-w-4xl animate-fade-in">
                <form onSubmit={submit} className="space-y-6">
                    <div className="card">
                        <div className="card-header">
                            <h3 className="text-base font-bold text-surface-900">Delivery Details</h3>
                            <p className="text-xs text-surface-400 mt-0.5">Select the job, then deliver everything at once or part of it</p>
                        </div>
                        <div className="card-body space-y-5">
                            <div className="form-group">
                                <label className="form-label">Work Order *</label>
                                <select value={data.work_order_id} onChange={(e) => chooseWo(e.target.value)} className="form-select" required>
                                    <option value="">Select work order...</option>
                                    {workOrders?.map((wo: any) => (
                                        <option key={wo.id} value={wo.id}>
                                            {wo.wo_number} — {wo.product} ({wo.customer}) · {wo.deliverable} of {wo.quantity} ready
                                        </option>
                                    ))}
                                </select>
                                {errors.work_order_id && <p className="form-error">{errors.work_order_id}</p>}
                                {(!workOrders || workOrders.length === 0) && (
                                    <p className="form-hint text-amber-600">
                                        <i className="fi fi-rr-info text-[10px]" /> No jobs have QC-passed qty ready to deliver. A job appears here once some quantity passes QC (partial QC is supported — only the passed qty is deliverable).
                                    </p>
                                )}
                            </div>

                            {selectedWo && lines.length > 0 && (
                                <>
                                    <div className="form-group">
                                        <label className="form-label">Delivery *</label>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                            {typeCard('full',
                                                selectedWo.has_earlier ? 'Everything that is left' : 'Full delivery — all goods at once',
                                                fullPossible
                                                    ? (selectedWo.has_earlier ? 'Every item\'s balance on one challan — the last part of the delivery' : 'Every item of the job on one challan')
                                                    : `Only ${num(deliverable)} of ${num(remainingTotal)} have passed QC — deliver partially for now`,
                                                'fi-rr-boxes', !fullPossible)}
                                            {typeCard('partial', 'Partial delivery (Partial Challan)',
                                                'Choose how much of each item goes now; the rest follows on another challan', 'fi-rr-box-open')}
                                        </div>
                                    </div>

                                    {/* Per item: what was ordered, what went, what is left, and what goes now. */}
                                    <div className="rounded-xl border border-surface-200 overflow-x-auto">
                                        <table className="w-full text-sm">
                                            <thead>
                                                <tr className="bg-surface-50 text-[10px] uppercase tracking-wider text-surface-500 font-bold">
                                                    <th className="text-left px-3 py-2 w-16">Part</th>
                                                    <th className="text-left px-3 py-2">Item</th>
                                                    <th className="text-right px-3 py-2 w-20">Ordered</th>
                                                    <th className="text-right px-3 py-2 w-24">Delivered earlier</th>
                                                    <th className="text-right px-3 py-2 w-20">Left</th>
                                                    <th className="text-right px-3 py-2 w-36">This delivery</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {lines.map((l, n) => {
                                                    const err = (errors as any)[`lines.${n}.quantity`];
                                                    return (
                                                        <tr key={l.key} className="border-t border-surface-100 align-top">
                                                            <td className="px-3 py-2 text-surface-500 font-mono text-xs">{l.part_no ?? n + 1}</td>
                                                            <td className="px-3 py-2 text-surface-800">
                                                                <div className="line-clamp-2">{l.description}</div>
                                                                {err && <p className="form-error">{err}</p>}
                                                            </td>
                                                            <td className="px-3 py-2 text-right tabular-nums text-surface-600">{num(l.ordered)} <span className="text-[10px] text-surface-400">{l.unit}</span></td>
                                                            <td className="px-3 py-2 text-right tabular-nums text-surface-500">{l.earlier > 0 ? num(l.earlier) : '—'}</td>
                                                            <td className="px-3 py-2 text-right tabular-nums font-semibold text-surface-700">{num(l.remaining)}</td>
                                                            <td className="px-3 py-2 text-right">
                                                                {isFull ? (
                                                                    <span className="tabular-nums font-bold text-emerald-700">{num(l.remaining)} {l.unit}</span>
                                                                ) : (
                                                                    <input type="number" min={0} max={l.remaining} step="any"
                                                                        disabled={l.remaining <= 0}
                                                                        value={data.lines.find((x: any) => x.key === l.key)?.quantity ?? ''}
                                                                        onChange={(e) => setLine(l.key, e.target.value)}
                                                                        className={`form-input !py-1 text-sm text-right w-28 ml-auto ${err ? '!border-red-400' : ''}`} />
                                                                )}
                                                            </td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                            <tfoot>
                                                <tr className="border-t-2 border-surface-200 bg-surface-50">
                                                    <td colSpan={5} className="px-3 py-2 text-xs text-surface-600">
                                                        {total > deliverable + 0.001
                                                            ? <span className="text-red-600 font-semibold">More than has passed QC — only {num(deliverable)} available.</span>
                                                            : finishes
                                                                ? <span className="text-emerald-700 font-semibold">With this delivery the whole order will have gone.</span>
                                                                : <span className="text-orange-700 font-semibold">Partial — the rest stays to be delivered on another challan.</span>}
                                                        <span className="text-surface-400"> · {num(deliverable)} QC-passed &amp; available</span>
                                                    </td>
                                                    <td className="px-3 py-2 text-right tabular-nums font-bold text-surface-900">{num(total)}</td>
                                                </tr>
                                            </tfoot>
                                        </table>
                                    </div>
                                    {(errors as any).lines && <p className="form-error">{(errors as any).lines}</p>}
                                </>
                            )}

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="form-group">
                                    <label className="form-label-optional">Scheduled Date</label>
                                    <input type="date" value={data.scheduled_date} onChange={(e) => setData('scheduled_date', e.target.value)} className="form-input" />
                                </div>
                            </div>

                            <div className="form-group">
                                <label className="form-label-optional">Delivery Address</label>
                                <textarea value={data.delivery_address} onChange={(e) => setData('delivery_address', e.target.value)} rows={2} className="form-textarea" />
                            </div>
                        </div>
                    </div>

                    <div className="card">
                        <div className="card-header">
                            <h3 className="text-base font-bold text-surface-900">Transport Info</h3>
                            <p className="text-xs text-surface-400 mt-0.5">Vehicle and driver details for dispatch</p>
                        </div>
                        <div className="card-body space-y-4">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="form-group">
                                    <label className="form-label-optional">Vehicle Number</label>
                                    <input type="text" value={data.vehicle_number} onChange={(e) => setData('vehicle_number', e.target.value)}
                                        className="form-input" placeholder="e.g. Dhaka Metro Ba-11-1234" />
                                </div>
                                <div className="form-group">
                                    <label className="form-label-optional">Driver Name</label>
                                    <input type="text" value={data.driver_name} onChange={(e) => setData('driver_name', e.target.value)} className="form-input" />
                                </div>
                            </div>
                            <div className="form-group">
                                <label className="form-label-optional">Notes</label>
                                <textarea value={data.notes} onChange={(e) => setData('notes', e.target.value)} rows={2} className="form-textarea"
                                    placeholder="Any special instructions..." />
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        <button type="submit" disabled={processing || total <= 0 || total > deliverable + 0.001} className="btn-primary">
                            <i className="fi fi-rr-truck-side text-xs leading-none" />
                            {processing ? 'Creating...' : isFull ? 'Create Delivery Order' : 'Create Partial Delivery'}
                        </button>
                        <Link href="/delivery" className="btn-outline">Cancel</Link>
                    </div>
                </form>
            </div>
        </AppLayout>
    );
}
