import AppLayout from '@/Layouts/AppLayout';
import { Link, useForm } from '@inertiajs/react';
import { FormEvent, useState } from 'react';

export default function QCCreate({ sheets, preselected, checkpoints }: any) {
    // Checkpoints come from Master Data (Admin/QC Checkpoints). Each item starts
    // with a result of 'pass' (displayed as "Ok"); inspector flips per row.
    const seed = (checkpoints ?? []).map((c: any) => ({ name: c.name, result: 'pass', remarks: '' }));
    const [checklistItems, setChecklistItems] = useState(seed);

    // Keep `checklist` inside the form state so it actually serialises into the
    // POST payload. The previous `{ data: ... }` override hack didn't reach the
    // server — that's why the certificate showed "No specific checkpoints".
    const { data, setData, post, errors, processing } = useForm<any>({
        operation_sheet_id: preselected?.id ?? '',
        inspection_type: 'in_process',
        result: 'pass',
        notes: '',
        checklist: [] as any[],
    });

    // Resolve the picked sheet so the form can show the item info inline.
    const picked = (sheets ?? []).find((s: any) => String(s.id) === String(data.operation_sheet_id));

    const updateChecklist = (i: number, field: string, value: string) => {
        const updated = [...checklistItems];
        updated[i] = { ...updated[i], [field]: value };
        setChecklistItems(updated);
        // Auto-set overall result to 'fail' (shown as "Not Ok") when any row fails.
        if (field === 'result' && value === 'fail') {
            setData('result', 'fail');
        }
    };

    const submit = (e: FormEvent) => {
        e.preventDefault();
        setData('checklist', checklistItems);
        // setData is async — schedule the post for the next tick so the
        // checklist payload is actually present on the request.
        setTimeout(() => post('/qc'), 0);
    };

    return (
        <AppLayout header="New QC Inspection">
            <div className="max-w-4xl animate-fade-in">
                <form onSubmit={submit} className="space-y-6">
                    {/* Inspection Details */}
                    <div className="card">
                        <div className="card-header">
                            <h3 className="text-base font-bold text-surface-900">Inspection Details</h3>
                            <p className="text-xs text-surface-400 mt-0.5">Select the work order and inspection type</p>
                        </div>
                        <div className="card-body space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="form-group">
                                    <label className="form-label">Item (Operation Sheet) *</label>
                                    <select
                                        value={data.operation_sheet_id}
                                        onChange={e => setData('operation_sheet_id', e.target.value)}
                                        className="form-select"
                                        required
                                    >
                                        <option value="">Select item to inspect...</option>
                                        {sheets?.map((s: any) => (
                                            <option key={s.id} value={s.id}>
                                                Job# {s.job_number ?? '—'}
                                                {s.item ? ` · Item ${s.item.sequence}` : ''}
                                                {s.item?.description ? ` — ${String(s.item.description).slice(0, 60)}` : ''}
                                                {s.sheet_number ? ` (Sheet ${s.sheet_number})` : ''}
                                            </option>
                                        ))}
                                    </select>
                                    {errors.operation_sheet_id && <p className="form-error">{errors.operation_sheet_id}</p>}
                                    {picked?.item && (
                                        <p className="text-[11px] text-surface-500 mt-1">
                                            <i className="fi fi-rr-cube text-[10px] mr-1" />
                                            Inspecting <b>Item {picked.item.sequence}</b> · qty {picked.item.quantity} {picked.item.unit} · customer {picked.customer}
                                        </p>
                                    )}
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Inspection Type *</label>
                                    <select
                                        value={data.inspection_type}
                                        onChange={e => setData('inspection_type', e.target.value)}
                                        className="form-select"
                                    >
                                        <option value="incoming">Incoming</option>
                                        <option value="in_process">In-Process</option>
                                        <option value="final">Final</option>
                                    </select>
                                </div>
                            </div>

                            <div className="form-group max-w-xs">
                                <label className="form-label">Overall Result *</label>
                                <select
                                    value={data.result}
                                    onChange={e => setData('result', e.target.value)}
                                    className="form-select"
                                >
                                    <option value="pass">Ok</option>
                                    <option value="fail">Not Ok</option>
                                    <option value="conditional">N/A</option>
                                </select>
                            </div>
                        </div>
                    </div>

                    {/* Checklist */}
                    <div className="card">
                        <div className="card-header">
                            <h3 className="text-base font-bold text-surface-900">Inspection Checklist</h3>
                            <p className="text-xs text-surface-400 mt-0.5">
                                Mark each check point as Ok, Not Ok, or N/A.{' '}
                                <Link href="/admin/qc-checkpoints" className="text-brand-600 hover:underline">Manage checkpoints</Link>
                            </p>
                        </div>
                        <div className="card-body space-y-3">
                            {checklistItems.length === 0 && (
                                <div className="text-sm text-surface-400 italic">
                                    No checkpoints configured yet. Add some in Master Data → QC Checkpoints.
                                </div>
                            )}
                            {checklistItems.map((item: any, i: number) => (
                                <div
                                    key={i}
                                    className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center p-3 rounded-xl border border-surface-100 hover:bg-surface-50/40 transition-colors"
                                >
                                    <div className="md:col-span-4 text-sm font-medium text-surface-700">
                                        {item.name}
                                    </div>
                                    <div className="md:col-span-3">
                                        <select
                                            value={item.result}
                                            onChange={e => updateChecklist(i, 'result', e.target.value)}
                                            className="form-select"
                                        >
                                            <option value="pass">Ok</option>
                                            <option value="fail">Not Ok</option>
                                            <option value="na">N/A</option>
                                        </select>
                                    </div>
                                    <div className="md:col-span-5">
                                        <input
                                            type="text"
                                            value={item.remarks}
                                            onChange={e => updateChecklist(i, 'remarks', e.target.value)}
                                            placeholder="Remarks..."
                                            className="form-input"
                                        />
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Notes */}
                    <div className="card">
                        <div className="card-header">
                            <h3 className="text-base font-bold text-surface-900">Notes</h3>
                            <p className="text-xs text-surface-400 mt-0.5">Additional observations or comments</p>
                        </div>
                        <div className="card-body">
                            <div className="form-group">
                                <label className="form-label-optional">Inspection notes</label>
                                <textarea
                                    value={data.notes}
                                    onChange={e => setData('notes', e.target.value)}
                                    rows={4}
                                    className="form-textarea"
                                    placeholder="Any additional remarks about this inspection..."
                                />
                            </div>
                        </div>
                    </div>

                    {/* Actions */}
                    <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-end gap-3">
                        <Link href="/qc" className="btn-outline btn-sm">
                            Cancel
                        </Link>
                        <button type="submit" disabled={processing} className="btn-primary btn-sm">
                            <i className="fi fi-rr-disk text-xs leading-none" />
                            {processing ? 'Saving...' : 'Submit Inspection'}
                        </button>
                    </div>
                </form>
            </div>
        </AppLayout>
    );
}
