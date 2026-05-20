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
    });

    const submit = (e: React.FormEvent) => {
        e.preventDefault();
        form.post('/customer/complaints');
    };

    return (
        <CustomerLayout backHref="/customer/complaints" backLabel="All Complaints" title="New Complaint / Feedback" width="narrow">
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
                                        Job #{w.job_number ?? '—'} ({w.wo_number})
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>

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
                            <><i className="fi fi-rr-paper-plane text-sm" /> Submit Complaint</>
                        )}
                    </button>
                </div>
            </form>
        </CustomerLayout>
    );
}
