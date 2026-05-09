import AppLayout from '@/Layouts/AppLayout';
import { router, useForm } from '@inertiajs/react';
import { useEffect, useState } from 'react';

export default function ShopFloorTerminal({ assignedSteps, activeExecution, machines }: any) {
    const [view, setView] = useState<'list' | 'stop' | 'downtime'>('list');
    const [elapsed, setElapsed] = useState(0);

    const stopForm = useForm({
        execution_id: activeExecution?.id ?? '',
        qty_completed: '',
        qty_rejected: '',
        reject_reason: '',
    });

    const downtimeForm = useForm({
        execution_id: activeExecution?.id ?? '',
        category: 'machine_breakdown',
        description: '',
    });

    const startForm = useForm({
        operation_step_id: '',
        machine_id: '',
    });

    // Refresh every 30 seconds
    useEffect(() => {
        const timer = setInterval(() => {
            router.reload({ only: ['assignedSteps', 'activeExecution'] });
        }, 30000);
        return () => clearInterval(timer);
    }, []);

    // Elapsed timer for active job
    useEffect(() => {
        if (!activeExecution?.started_at) return;
        const start = new Date(activeExecution.started_at).getTime();
        const update = () => setElapsed(Math.floor((Date.now() - start) / 60));
        update();
        const timer = setInterval(update, 1000);
        return () => clearInterval(timer);
    }, [activeExecution?.started_at]);

    return (
        <AppLayout header="Shop Floor Terminal">
            <div className="max-w-3xl mx-auto space-y-6 animate-fade-in">

                {/* Active Job Banner */}
                {activeExecution && (
                    <div className="card border-2 border-green-400 bg-gradient-to-br from-green-50 to-white animate-scale-in">
                        <div className="card-body">
                            <div className="flex items-start justify-between flex-wrap gap-4">
                                <div className="flex items-start gap-3">
                                    <div className="w-12 h-12 rounded-xl bg-green-100 flex items-center justify-center flex-shrink-0">
                                        <i className="fi fi-sr-play text-green-600 text-lg leading-none" />
                                    </div>
                                    <div>
                                        <div className="text-xs font-bold text-green-600 uppercase tracking-wider">Active Job</div>
                                        <h2 className="text-2xl font-bold text-green-800 mt-1 font-mono">
                                            {activeExecution.work_order?.wo_number}
                                        </h2>
                                        <p className="text-sm text-green-700 font-medium">{activeExecution.work_order?.product?.name}</p>
                                        <p className="text-xs text-green-600 mt-1">
                                            {activeExecution.operation_step?.operation_name} &middot; {activeExecution.machine?.name}
                                        </p>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <div className="text-4xl font-mono font-bold text-green-800">
                                        {Math.floor(elapsed / 60)}h {elapsed % 60}m
                                    </div>
                                    <div className="text-xs font-semibold text-green-600 uppercase tracking-wider">elapsed</div>
                                </div>
                            </div>
                        </div>
                        <div className="card-body border-t border-green-200/60 flex gap-3">
                            <button
                                onClick={() => setView('stop')}
                                className="flex-1 py-4 text-lg font-bold bg-red-500 hover:bg-red-600 text-white rounded-xl transition-colors inline-flex items-center justify-center gap-2 shadow-sm"
                            >
                                <i className="fi fi-sr-square text-lg leading-none" />
                                STOP JOB
                            </button>
                            <button
                                onClick={() => setView('downtime')}
                                className="flex-1 py-4 text-lg font-bold bg-amber-500 hover:bg-amber-600 text-white rounded-xl transition-colors inline-flex items-center justify-center gap-2 shadow-sm"
                            >
                                <i className="fi fi-sr-triangle-warning text-lg leading-none" />
                                DOWNTIME
                            </button>
                        </div>
                    </div>
                )}

                {/* Stop Job Form */}
                {view === 'stop' && activeExecution && (
                    <div className="card border-2 border-red-200 animate-slide-up">
                        <div className="card-header">
                            <h3 className="text-base font-bold text-surface-900">Stop Job — {activeExecution.work_order?.wo_number}</h3>
                            <p className="text-xs text-surface-400 mt-0.5">Enter completion details to finish this step</p>
                        </div>
                        <form
                            onSubmit={e => {
                                e.preventDefault();
                                stopForm.post('/shop-floor/stop', { onSuccess: () => setView('list') });
                            }}
                        >
                            <div className="card-body space-y-5">
                                <div className="form-group">
                                    <label className="form-label">Qty Completed</label>
                                    <input
                                        type="number"
                                        min="0"
                                        step="1"
                                        value={stopForm.data.qty_completed}
                                        onChange={e => stopForm.setData('qty_completed', e.target.value)}
                                        className="form-input text-2xl text-center font-bold py-4"
                                        required
                                    />
                                    {stopForm.errors.qty_completed && <p className="form-error">{stopForm.errors.qty_completed}</p>}
                                </div>
                                <div className="form-group">
                                    <label className="form-label form-label-optional">Qty Rejected</label>
                                    <input
                                        type="number"
                                        min="0"
                                        step="1"
                                        value={stopForm.data.qty_rejected}
                                        onChange={e => stopForm.setData('qty_rejected', e.target.value)}
                                        className="form-input text-2xl text-center font-bold py-4"
                                    />
                                </div>
                                {Number(stopForm.data.qty_rejected) > 0 && (
                                    <div className="form-group animate-slide-up">
                                        <label className="form-label">Reject Reason</label>
                                        <select
                                            value={stopForm.data.reject_reason}
                                            onChange={e => stopForm.setData('reject_reason', e.target.value)}
                                            className="form-select"
                                        >
                                            <option value="">Select reason...</option>
                                            <option>Dimensional error</option>
                                            <option>Surface defect</option>
                                            <option>Material defect</option>
                                            <option>Setup error</option>
                                            <option>Tool breakage</option>
                                        </select>
                                    </div>
                                )}
                            </div>
                            <div className="card-body border-t border-surface-100 flex gap-3">
                                <button
                                    type="submit"
                                    disabled={stopForm.processing}
                                    className="flex-1 py-4 text-lg font-bold bg-red-500 hover:bg-red-600 text-white rounded-xl disabled:opacity-50 inline-flex items-center justify-center gap-2"
                                >
                                    <i className="fi fi-rr-check text-sm leading-none" />
                                    {stopForm.processing ? 'Stopping...' : 'Confirm Stop'}
                                </button>
                                <button type="button" onClick={() => setView('list')} className="btn-outline btn-sm px-6">
                                    Cancel
                                </button>
                            </div>
                        </form>
                    </div>
                )}

                {/* Downtime Form */}
                {view === 'downtime' && activeExecution && (
                    <div className="card border-2 border-amber-200 animate-slide-up">
                        <div className="card-header">
                            <h3 className="text-base font-bold text-surface-900">Log Downtime</h3>
                            <p className="text-xs text-surface-400 mt-0.5">Record any interruption to production</p>
                        </div>
                        <form
                            onSubmit={e => {
                                e.preventDefault();
                                downtimeForm.post('/shop-floor/downtime', { onSuccess: () => setView('list') });
                            }}
                        >
                            <div className="card-body space-y-5">
                                <div className="form-group">
                                    <label className="form-label">Category</label>
                                    <select
                                        value={downtimeForm.data.category}
                                        onChange={e => downtimeForm.setData('category', e.target.value)}
                                        className="form-select"
                                        required
                                    >
                                        <option value="machine_breakdown">Machine Breakdown</option>
                                        <option value="material_shortage">Material Shortage</option>
                                        <option value="operator_absence">Operator Absence</option>
                                        <option value="power_outage">Power Outage</option>
                                        <option value="other">Other</option>
                                    </select>
                                </div>
                                <div className="form-group">
                                    <label className="form-label form-label-optional">Description</label>
                                    <textarea
                                        value={downtimeForm.data.description}
                                        onChange={e => downtimeForm.setData('description', e.target.value)}
                                        rows={3}
                                        className="form-textarea"
                                        placeholder="Describe the issue..."
                                    />
                                </div>
                            </div>
                            <div className="card-body border-t border-surface-100 flex gap-3">
                                <button
                                    type="submit"
                                    disabled={downtimeForm.processing}
                                    className="flex-1 py-4 text-lg font-bold bg-amber-500 hover:bg-amber-600 text-white rounded-xl disabled:opacity-50 inline-flex items-center justify-center gap-2"
                                >
                                    <i className="fi fi-rr-triangle-warning text-sm leading-none" />
                                    {downtimeForm.processing ? 'Logging...' : 'Log Downtime'}
                                </button>
                                <button type="button" onClick={() => setView('list')} className="btn-outline btn-sm px-6">
                                    Cancel
                                </button>
                            </div>
                        </form>
                    </div>
                )}

                {/* Assigned Steps / Start Job */}
                {!activeExecution && view === 'list' && (
                    <div className="card animate-slide-up">
                        <div className="card-header">
                            <h3 className="text-base font-bold text-surface-900">Assigned Jobs</h3>
                            <p className="text-xs text-surface-400 mt-0.5">Select a job to begin working</p>
                        </div>
                        <div className="card-body">
                            {assignedSteps.length === 0 ? (
                                <div className="empty-state">
                                    <div className="empty-state-icon">
                                        <i className="fi fi-rr-clipboard-list" />
                                    </div>
                                    <div className="empty-state-title">No jobs assigned</div>
                                    <div className="empty-state-text">There are currently no jobs assigned to you.</div>
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    {assignedSteps.map((step: any) => (
                                        <div
                                            key={step.id}
                                            className="rounded-xl border border-surface-100 p-4 flex items-center justify-between flex-wrap gap-3 hover:border-brand-200 hover:bg-brand-50/20 transition-colors"
                                        >
                                            <div>
                                                <div className="font-mono font-bold text-surface-900 text-base">
                                                    {step.operation_sheet?.work_order?.wo_number}
                                                </div>
                                                <div className="text-sm text-surface-700 font-medium mt-0.5">{step.operation_name}</div>
                                                <div className="text-xs text-surface-400 mt-0.5">
                                                    {step.machine?.name} &middot; {step.estimated_hours}h estimated
                                                </div>
                                            </div>
                                            <form
                                                onSubmit={e => {
                                                    e.preventDefault();
                                                    startForm.setData('operation_step_id', step.id);
                                                    startForm.setData('machine_id', step.machine_id ?? machines[0]?.id);
                                                    startForm.post('/shop-floor/start');
                                                }}
                                            >
                                                <button
                                                    type="submit"
                                                    className="px-6 py-3 text-base font-bold bg-green-500 hover:bg-green-600 text-white rounded-xl inline-flex items-center gap-2 transition-colors shadow-sm"
                                                >
                                                    <i className="fi fi-sr-play text-sm leading-none" />
                                                    START
                                                </button>
                                            </form>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </AppLayout>
    );
}
