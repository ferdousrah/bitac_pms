import AppLayout from '@/Layouts/AppLayout';
import { Link, useForm } from '@inertiajs/react';
import { FormEvent } from 'react';

export default function DeliveryCreate({ workOrders, workOrder }: any) {
    const { data, setData, post, errors, processing } = useForm({
        work_order_id: workOrder?.id ?? '',
        quantity_delivered: workOrder?.quantity ?? '',
        scheduled_date: '',
        delivery_address: workOrder?.customer_address ?? '',
        vehicle_number: '',
        driver_name: '',
        notes: '',
    });

    const submit = (e: FormEvent) => {
        e.preventDefault();
        post('/delivery');
    };

    return (
        <AppLayout header="New Delivery Order">
            <div className="max-w-3xl animate-fade-in">
                <form onSubmit={submit} className="space-y-6">
                    <div className="card">
                        <div className="card-header">
                            <h3 className="text-base font-bold text-surface-900">Delivery Details</h3>
                            <p className="text-xs text-surface-400 mt-0.5">
                                Select the work order and specify the shipment quantity
                            </p>
                        </div>
                        <div className="card-body space-y-4">
                            <div className="form-group">
                                <label className="form-label">Work Order *</label>
                                <select
                                    value={data.work_order_id}
                                    onChange={(e) => setData('work_order_id', e.target.value)}
                                    className="form-select"
                                    required
                                >
                                    <option value="">Select work order...</option>
                                    {workOrders?.map((wo: any) => (
                                        <option key={wo.id} value={wo.id}>
                                            {wo.wo_number} — {wo.product} ({wo.customer})
                                        </option>
                                    ))}
                                </select>
                                {errors.work_order_id && (
                                    <p className="form-error">{errors.work_order_id}</p>
                                )}
                                {(!workOrders || workOrders.length === 0) && (
                                    <p className="form-hint text-amber-600">
                                        <i className="fi fi-rr-info text-[10px]" /> No jobs are ready for delivery yet. A job appears here only after a passing <b>Final</b> QC inspection (→ status QC Passed).
                                    </p>
                                )}
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="form-group">
                                    <label className="form-label">Quantity to Deliver *</label>
                                    <input
                                        type="number"
                                        min="1"
                                        value={data.quantity_delivered}
                                        onChange={(e) => setData('quantity_delivered', e.target.value)}
                                        className="form-input"
                                        required
                                    />
                                    {errors.quantity_delivered && (
                                        <p className="form-error">{errors.quantity_delivered}</p>
                                    )}
                                </div>
                                <div className="form-group">
                                    <label className="form-label-optional">Scheduled Date</label>
                                    <input
                                        type="date"
                                        value={data.scheduled_date}
                                        onChange={(e) => setData('scheduled_date', e.target.value)}
                                        className="form-input"
                                    />
                                </div>
                            </div>

                            <div className="form-group">
                                <label className="form-label-optional">Delivery Address</label>
                                <textarea
                                    value={data.delivery_address}
                                    onChange={(e) => setData('delivery_address', e.target.value)}
                                    rows={2}
                                    className="form-textarea"
                                />
                            </div>
                        </div>
                    </div>

                    <div className="card">
                        <div className="card-header">
                            <h3 className="text-base font-bold text-surface-900">Transport Info</h3>
                            <p className="text-xs text-surface-400 mt-0.5">
                                Vehicle and driver details for dispatch
                            </p>
                        </div>
                        <div className="card-body space-y-4">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="form-group">
                                    <label className="form-label-optional">Vehicle Number</label>
                                    <input
                                        type="text"
                                        value={data.vehicle_number}
                                        onChange={(e) => setData('vehicle_number', e.target.value)}
                                        className="form-input"
                                        placeholder="e.g. Dhaka Metro Ba-11-1234"
                                    />
                                </div>
                                <div className="form-group">
                                    <label className="form-label-optional">Driver Name</label>
                                    <input
                                        type="text"
                                        value={data.driver_name}
                                        onChange={(e) => setData('driver_name', e.target.value)}
                                        className="form-input"
                                    />
                                </div>
                            </div>

                            <div className="form-group">
                                <label className="form-label-optional">Notes</label>
                                <textarea
                                    value={data.notes}
                                    onChange={(e) => setData('notes', e.target.value)}
                                    rows={2}
                                    className="form-textarea"
                                    placeholder="Any special instructions..."
                                />
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        <button type="submit" disabled={processing} className="btn-primary">
                            <i className="fi fi-rr-truck-side text-xs leading-none" />
                            {processing ? 'Creating...' : 'Create Delivery Order'}
                        </button>
                        <Link href="/delivery" className="btn-outline">
                            Cancel
                        </Link>
                    </div>
                </form>
            </div>
        </AppLayout>
    );
}
