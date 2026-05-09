import AppLayout from '@/Layouts/AppLayout';
import { Link, useForm } from '@inertiajs/react';
import { FormEvent, useState } from 'react';

const DEFAULT_CHECKLIST = [
    'Dimensional accuracy',
    'Surface finish',
    'Material grade',
    'Heat treatment',
    'Visual inspection',
];

export default function QCCreate({ workOrders, workOrder }: any) {
    const [checklistItems, setChecklistItems] = useState(
        DEFAULT_CHECKLIST.map(name => ({ name, result: 'pass', remarks: '' }))
    );

    const { data, setData, post, errors, processing } = useForm({
        work_order_id: workOrder?.id ?? '',
        inspection_type: 'in_process',
        qty_passed: '',
        qty_failed: '',
        result: 'pass',
        notes: '',
    });

    const updateChecklist = (i: number, field: string, value: string) => {
        const updated = [...checklistItems];
        updated[i] = { ...updated[i], [field]: value };
        setChecklistItems(updated);
        // Auto-set overall result to fail if any item fails
        if (field === 'result' && value === 'fail') {
            setData('result', 'fail');
        }
    };

    const submit = (e: FormEvent) => {
        e.preventDefault();
        post('/qc', { data: { ...data, checklist: checklistItems } } as any);
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
                                    <label className="form-label">Work Order *</label>
                                    <select
                                        value={data.work_order_id}
                                        onChange={e => setData('work_order_id', e.target.value)}
                                        className="form-select"
                                        required
                                    >
                                        <option value="">Select work order...</option>
                                        {workOrders?.map((wo: any) => (
                                            <option key={wo.id} value={wo.id}>
                                                {wo.wo_number} — {wo.product}
                                            </option>
                                        ))}
                                    </select>
                                    {errors.work_order_id && <p className="form-error">{errors.work_order_id}</p>}
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

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div className="form-group">
                                    <label className="form-label">Qty Passed *</label>
                                    <input
                                        type="number"
                                        min="0"
                                        value={data.qty_passed}
                                        onChange={e => setData('qty_passed', e.target.value)}
                                        className="form-input"
                                        required
                                    />
                                    {errors.qty_passed && <p className="form-error">{errors.qty_passed}</p>}
                                </div>
                                <div className="form-group">
                                    <label className="form-label-optional">Qty Failed</label>
                                    <input
                                        type="number"
                                        min="0"
                                        value={data.qty_failed}
                                        onChange={e => setData('qty_failed', e.target.value)}
                                        className="form-input"
                                    />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Overall Result *</label>
                                    <select
                                        value={data.result}
                                        onChange={e => setData('result', e.target.value)}
                                        className="form-select"
                                    >
                                        <option value="pass">Pass</option>
                                        <option value="fail">Fail</option>
                                        <option value="conditional">Conditional</option>
                                    </select>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Checklist */}
                    <div className="card">
                        <div className="card-header">
                            <h3 className="text-base font-bold text-surface-900">Inspection Checklist</h3>
                            <p className="text-xs text-surface-400 mt-0.5">Mark each check point as pass, fail, or not applicable</p>
                        </div>
                        <div className="card-body space-y-3">
                            {checklistItems.map((item, i) => (
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
                                            <option value="pass">Pass</option>
                                            <option value="fail">Fail</option>
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
