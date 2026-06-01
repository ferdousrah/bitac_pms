import { useForm, Link } from '@inertiajs/react';
import CustomerLayout from '@/Layouts/CustomerLayout';

const CATEGORIES = [
    { value: 'general',  label: 'General Feedback' },
    { value: 'quality',  label: 'Quality Issue' },
    { value: 'delivery', label: 'Delivery Issue' },
    { value: 'billing',  label: 'Billing / Invoice Issue' },
    { value: 'other',    label: 'Other' },
];

export default function CustomerComplaintCreate({ workOrders, preselectedWo }: any) {
    const form = useForm({
        work_order_id: preselectedWo ?? '',
        subject: '',
        category: 'general',
        message: '',
        affected_qty: '' as string | number,
    });

    const submit = (e: React.FormEvent) => {
        e.preventDefault();
        form.post('/customer/complaints');
    };

    const selectedWo = workOrders.find((w: any) => Number(w.id) === Number(form.data.work_order_id));
    const totalQty   = selectedWo?.quantity;

    return (
        <CustomerLayout backHref="/customer/complaints" backLabel="All Feedback/Compliments" title="New Feedback / Compliment" width="narrow">
            <form onSubmit={submit} className="card">
                <div className="card-body space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="form-group">
                            <label className="form-label">Category <span className="text-red-500">*</span></label>
                            <select
                                value={form.data.category}
                                onChange={(e) => form.setData('category', e.target.value as any)}
                                className="form-select"
                            >
                                {CATEGORIES.map(c => (
                                    <option key={c.value} value={c.value}>{c.label}</option>
                                ))}
                            </select>
                        </div>

                        <div className="form-group">
                            <label className="form-label">Related Order <span className="form-label-optional">optional</span></label>
                            <select
                                value={form.data.work_order_id ?? ''}
                                onChange={(e) => form.setData('work_order_id', e.target.value ? Number(e.target.value) : ('' as any))}
                                className="form-select"
                            >
                                <option value="">— Not related to a specific job —</option>
                                {workOrders.map((w: any) => (
                                    <option key={w.id} value={w.id}>
                                        Job #{w.job_number ?? '—'} ({w.wo_number}) · qty {w.quantity}
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>

                    {selectedWo && (
                        <div className="form-group">
                            <label className="form-label">
                                How many units are defective? <span className="form-label-optional">leave blank if all</span>
                            </label>
                            <div className="flex items-center gap-3">
                                <input
                                    type="number"
                                    min="1"
                                    max={totalQty}
                                    value={form.data.affected_qty as any}
                                    onChange={(e) => form.setData('affected_qty', e.target.value)}
                                    className="form-input font-mono w-32"
                                    placeholder="e.g. 2"
                                />
                                <span className="text-sm text-surface-500">out of <span className="font-bold text-surface-800">{totalQty}</span> delivered</span>
                            </div>
                            <p className="form-hint">
                                Tells us how many parts to rework. If all are affected, leave blank.
                            </p>
                            {form.errors.affected_qty && <p className="form-error">{form.errors.affected_qty}</p>}
                        </div>
                    )}

                    <div className="form-group">
                        <label className="form-label">Subject <span className="text-red-500">*</span></label>
                        <input
                            type="text"
                            value={form.data.subject}
                            onChange={(e) => form.setData('subject', e.target.value)}
                            className="form-input"
                            placeholder="Brief summary of the issue"
                            maxLength={200}
                        />
                        {form.errors.subject && <p className="form-error">{form.errors.subject}</p>}
                    </div>

                    <div className="form-group">
                        <label className="form-label">Message <span className="text-red-500">*</span></label>
                        <textarea
                            value={form.data.message}
                            onChange={(e) => form.setData('message', e.target.value)}
                            rows={6}
                            className="form-input"
                            style={{ resize: 'vertical' }}
                            placeholder="Describe the issue in detail. Include relevant dates, item numbers, measurements, or any other details that will help us understand and resolve your concern."
                            maxLength={2000}
                        />
                        <p className="form-hint">{form.data.message.length} / 2000 characters</p>
                        {form.errors.message && <p className="form-error">{form.errors.message}</p>}
                    </div>
                </div>

                <div className="card-footer flex items-center justify-end gap-2">
                    <Link href="/customer/complaints" className="btn-outline">Cancel</Link>
                    <button
                        type="submit"
                        disabled={form.processing || !form.data.subject || !form.data.message}
                        className="btn-primary"
                    >
                        {form.processing ? (
                            <><i className="fi fi-rr-spinner animate-spin text-sm" /> Submitting...</>
                        ) : (
                            <><i className="fi fi-rr-paper-plane text-sm" /> Submit Feedback/Compliment</>
                        )}
                    </button>
                </div>
            </form>
        </CustomerLayout>
    );
}
