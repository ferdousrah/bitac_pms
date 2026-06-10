import AppLayout from '@/Layouts/AppLayout';
import { Link, useForm } from '@inertiajs/react';
import { FormEvent } from 'react';

export default function ServiceDemandCreateEdit({ log, categories }: any) {
    const isEdit = !!log?.id;

    const { data, setData, post, put, processing, errors } = useForm<any>({
        requested_service:      log?.requested_service ?? '',
        service_category:       log?.service_category ?? 'machining',
        requester_name:         log?.requester_name ?? '',
        requester_organization: log?.requester_organization ?? '',
        requester_contact:      log?.requester_contact ?? '',
        requester_type:         log?.requester_type ?? 'prospective_customer',
        context:                log?.context ?? '',
        expected_volume:        log?.expected_volume ?? 'occasional',
        potential_value:        log?.potential_value ?? 'medium',
        logged_date:            log?.logged_date ?? new Date().toISOString().slice(0, 10),
        notes:                  log?.notes ?? '',
        save_and_add:           false,
    });

    const submit = (e: FormEvent, saveAndAdd = false) => {
        e.preventDefault();
        setData('save_and_add', saveAndAdd);
        requestAnimationFrame(() => {
            if (isEdit) put(`/ied/service-demand/${log.id}`);
            else        post('/ied/service-demand');
        });
    };

    return (
        <AppLayout header={isEdit ? 'Edit Service Demand Entry' : 'New Service Demand Entry'}>
            <div className="max-w-3xl space-y-4 animate-fade-in">

                <Link href="/ied/service-demand" className="text-xs text-surface-500 hover:text-brand-600 inline-flex items-center gap-1">
                    <i className="fi fi-rr-arrow-left text-[10px] leading-none" /> Back to log
                </Link>

                <form onSubmit={e => submit(e, false)} className="card overflow-hidden">
                    <div className="card-header">
                        <h2 className="text-base font-bold text-surface-900">
                            {isEdit ? 'Edit entry' : 'Log a new service demand'}
                        </h2>
                        <p className="text-xs text-surface-400 mt-0.5">
                            Capture services people asked for that BITAC currently cannot deliver. Year-end report uses these entries to guide capability investments.
                        </p>
                    </div>

                    {/* Service block */}
                    <div className="card-body border-b border-surface-100 space-y-4">
                        <h3 className="text-[10px] uppercase tracking-wider font-bold text-surface-400">Service Asked For</h3>
                        <div className="form-group">
                            <label className="form-label">Service Requested <span className="text-red-500">*</span></label>
                            <input type="text" value={data.requested_service}
                                onChange={e => setData('requested_service', e.target.value)}
                                className="form-input"
                                placeholder="e.g. 5-axis CNC milling for aerospace bracket" required />
                            {errors.requested_service && <p className="form-error">{errors.requested_service as any}</p>}
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                            <div className="form-group">
                                <label className="form-label">Category <span className="text-red-500">*</span></label>
                                <select value={data.service_category}
                                    onChange={e => setData('service_category', e.target.value)}
                                    className="form-select" required>
                                    {Object.entries(categories).map(([k, v]: any) => <option key={k} value={k}>{v}</option>)}
                                </select>
                            </div>
                            <div className="form-group">
                                <label className="form-label">Expected Volume <span className="text-red-500">*</span></label>
                                <select value={data.expected_volume}
                                    onChange={e => setData('expected_volume', e.target.value)}
                                    className="form-select" required>
                                    <option value="one_time">One-time</option>
                                    <option value="occasional">Occasional</option>
                                    <option value="frequent">Frequent</option>
                                    <option value="regular">Regular / Ongoing</option>
                                </select>
                            </div>
                            <div className="form-group">
                                <label className="form-label">Potential Value <span className="text-red-500">*</span></label>
                                <select value={data.potential_value}
                                    onChange={e => setData('potential_value', e.target.value)}
                                    className="form-select" required>
                                    <option value="low">Low</option>
                                    <option value="medium">Medium</option>
                                    <option value="high">High</option>
                                </select>
                            </div>
                        </div>
                    </div>

                    {/* Requester block */}
                    <div className="card-body border-b border-surface-100 space-y-4">
                        <h3 className="text-[10px] uppercase tracking-wider font-bold text-surface-400">Requester <span className="text-surface-300 normal-case">(optional — for walk-in / verbal inquiries leave blank)</span></h3>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div className="form-group">
                                <label className="form-label">Name</label>
                                <input type="text" value={data.requester_name}
                                    onChange={e => setData('requester_name', e.target.value)}
                                    className="form-input" placeholder="Md. Tofazzal Hossain" />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Organisation</label>
                                <input type="text" value={data.requester_organization}
                                    onChange={e => setData('requester_organization', e.target.value)}
                                    className="form-input" placeholder="Walton Hi-Tech Industries" />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Type</label>
                                <select value={data.requester_type}
                                    onChange={e => setData('requester_type', e.target.value)}
                                    className="form-select">
                                    <option value="existing_customer">Existing Customer</option>
                                    <option value="prospective_customer">Prospective Customer</option>
                                    <option value="individual">Individual</option>
                                    <option value="student">Student</option>
                                    <option value="organization">Organization</option>
                                </select>
                            </div>
                            <div className="form-group">
                                <label className="form-label">Contact (phone / email)</label>
                                <input type="text" value={data.requester_contact}
                                    onChange={e => setData('requester_contact', e.target.value)}
                                    className="form-input" placeholder="01XXX-XXXXXX" />
                            </div>
                        </div>
                    </div>

                    {/* Context block */}
                    <div className="card-body border-b border-surface-100 space-y-4">
                        <div className="form-group">
                            <label className="form-label">Why BITAC couldn't help <span className="text-red-500">*</span></label>
                            <textarea value={data.context}
                                onChange={e => setData('context', e.target.value)}
                                rows={4} required
                                placeholder="What was the use case? Why couldn't BITAC fulfil it? Were they diverted elsewhere? Any technical details that help understand the gap."
                                className="form-textarea" />
                            {errors.context && <p className="form-error">{errors.context as any}</p>}
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div className="form-group">
                                <label className="form-label">Date logged</label>
                                <input type="date" value={data.logged_date}
                                    max={new Date().toISOString().slice(0, 10)}
                                    onChange={e => setData('logged_date', e.target.value)}
                                    className="form-input" />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Internal notes</label>
                                <input type="text" value={data.notes}
                                    onChange={e => setData('notes', e.target.value)}
                                    className="form-input"
                                    placeholder="Any follow-up actions / staff who handled it" />
                            </div>
                        </div>
                    </div>

                    {/* Submit */}
                    <div className="card-body flex flex-wrap items-center gap-2">
                        <button type="submit" disabled={processing} className="btn-primary">
                            {processing
                                ? <><i className="fi fi-rr-spinner animate-spin text-sm" /> Saving…</>
                                : <><i className="fi fi-rr-check text-sm" /> {isEdit ? 'Update' : 'Save Entry'}</>}
                        </button>
                        {!isEdit && (
                            <button type="button" onClick={e => submit(e as any, true)} disabled={processing}
                                className="btn-outline btn-sm">
                                <i className="fi fi-rr-add text-sm" /> Save &amp; Add Another
                            </button>
                        )}
                        <Link href="/ied/service-demand" className="btn-ghost btn-sm">Cancel</Link>
                    </div>
                </form>
            </div>
        </AppLayout>
    );
}
