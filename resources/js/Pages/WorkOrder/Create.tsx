import AppLayout from '@/Layouts/AppLayout';
import { Link, useForm } from '@inertiajs/react';
import { FormEvent } from 'react';

export default function WorkOrderCreate({ customers, products, rfq, quotation }: any) {
    const { data, setData, post, errors, processing } = useForm({
        customer_id: rfq?.customer_id ?? quotation?.rfq?.customer_id ?? '',
        product_id: rfq?.product_id ?? quotation?.rfq?.product_id ?? '',
        quotation_id: quotation?.id ?? '',
        quantity: rfq?.quantity ?? quotation?.rfq?.quantity ?? '',
        priority: 'normal',
        due_date: '',
        notes: '',
    });

    const submit = (e: FormEvent) => {
        e.preventDefault();
        post('/work-orders');
    };

    return (
        <AppLayout header="New Job">
            <div className="max-w-3xl space-y-6 animate-fade-in">
                <form onSubmit={submit} className="space-y-6">
                    {/* Header */}
                    <div className="card animate-slide-up">
                        <div className="card-header flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-brand-50 flex items-center justify-center">
                                    <i className="fi fi-rr-box text-brand-500 text-base leading-none" />
                                </div>
                                <div>
                                    <h2 className="text-base font-bold text-surface-900">New Job</h2>
                                    <p className="text-xs text-surface-400 mt-0.5">Start a new production job</p>
                                </div>
                            </div>
                            <Link href="/work-orders" className="btn-ghost btn-sm">
                                <i className="fi fi-rr-arrow-left text-xs leading-none" /> Back
                            </Link>
                        </div>

                        <div className="card-body space-y-5">
                            {quotation && (
                                <div className="alert alert-info">
                                    <i className="fi fi-rr-info text-sm leading-none" />
                                    <div>
                                        <div className="font-semibold">Creating from Quotation v{quotation.version}</div>
                                        <div className="text-xs mt-0.5">Total: BDT {Number(quotation.total_amount).toLocaleString('en-IN')}</div>
                                    </div>
                                </div>
                            )}

                            <div className="form-group">
                                <label className="form-label">Customer</label>
                                <select
                                    value={data.customer_id}
                                    onChange={e => setData('customer_id', e.target.value)}
                                    className="form-select"
                                    required
                                >
                                    <option value="">Select customer...</option>
                                    {customers?.map((c: any) => (
                                        <option key={c.id} value={c.id}>{c.name}</option>
                                    ))}
                                </select>
                                {errors.customer_id && <p className="form-error">{errors.customer_id}</p>}
                            </div>

                            <div className="form-group">
                                <label className="form-label">Product</label>
                                <select
                                    value={data.product_id}
                                    onChange={e => setData('product_id', e.target.value)}
                                    className="form-select"
                                    required
                                >
                                    <option value="">Select product...</option>
                                    {products?.map((p: any) => (
                                        <option key={p.id} value={p.id}>{p.name} ({p.code})</option>
                                    ))}
                                </select>
                                {errors.product_id && <p className="form-error">{errors.product_id}</p>}
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                                <div className="form-group">
                                    <label className="form-label">Quantity</label>
                                    <input
                                        type="number"
                                        min="1"
                                        value={data.quantity}
                                        onChange={e => setData('quantity', e.target.value)}
                                        className="form-input"
                                        required
                                    />
                                    {errors.quantity && <p className="form-error">{errors.quantity}</p>}
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Priority</label>
                                    <select
                                        value={data.priority}
                                        onChange={e => setData('priority', e.target.value)}
                                        className="form-select"
                                    >
                                        <option value="low">Low</option>
                                        <option value="normal">Normal</option>
                                        <option value="urgent">Urgent</option>
                                    </select>
                                </div>
                            </div>

                            <div className="form-group">
                                <label className="form-label form-label-optional">Due Date</label>
                                <input
                                    type="date"
                                    value={data.due_date}
                                    onChange={e => setData('due_date', e.target.value)}
                                    className="form-input"
                                />
                                {errors.due_date && <p className="form-error">{errors.due_date}</p>}
                            </div>

                            <div className="form-group">
                                <label className="form-label form-label-optional">Notes</label>
                                <textarea
                                    value={data.notes}
                                    onChange={e => setData('notes', e.target.value)}
                                    rows={3}
                                    className="form-textarea"
                                    placeholder="Optional notes for this work order..."
                                />
                                {errors.notes && <p className="form-error">{errors.notes}</p>}
                            </div>
                        </div>

                        <div className="card-body border-t border-surface-100 flex flex-col sm:flex-row gap-2">
                            <button type="submit" disabled={processing} className="btn-primary btn-sm">
                                <i className="fi fi-rr-check text-xs leading-none" />
                                {processing ? 'Creating...' : 'Create Job'}
                            </button>
                            <Link href="/work-orders" className="btn-outline btn-sm">
                                Cancel
                            </Link>
                        </div>
                    </div>
                </form>
            </div>
        </AppLayout>
    );
}
