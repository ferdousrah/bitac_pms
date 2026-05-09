import AppLayout from '@/Layouts/AppLayout';
import { useForm, Link } from '@inertiajs/react';
import { FormEvent } from 'react';

export default function MachineCreateEdit({ machine, sections }: any) {
    const isEdit = !!machine;
    const { data, setData, post, put, processing, errors } = useForm({
        name:                       machine?.name ?? '',
        machine_code:               machine?.machine_code ?? '',
        section_id:                 machine?.section_id ?? '',
        status:                     machine?.status ?? 'operational',
        current_state:              machine?.current_state ?? 'idle',
        description:                machine?.description ?? '',
        rate_group_a:               machine?.rate_group_a ?? '',
        rate_group_b:               machine?.rate_group_b ?? '',
        rate_group_c:               machine?.rate_group_c ?? '',
        manufacturer:               machine?.manufacturer ?? '',
        model:                      machine?.model ?? '',
        serial_number:              machine?.serial_number ?? '',
        purchased_on:               machine?.purchased_on ?? '',
        warranty_expires_on:        machine?.warranty_expires_on ?? '',
        asset_value:                machine?.asset_value ?? '',
        location:                   machine?.location ?? '',
        last_maintenance_date:      machine?.last_maintenance_date ?? '',
        next_maintenance_date:      machine?.next_maintenance_date ?? '',
        maintenance_interval_days:  machine?.maintenance_interval_days ?? '',
    });

    const submit = (e: FormEvent) => {
        e.preventDefault();
        if (isEdit) put(`/admin/machines/${machine.id}`);
        else post('/admin/machines');
    };

    return (
        <AppLayout header={isEdit ? 'Edit Machine' : 'New Machine'}>
            <div className="max-w-3xl animate-fade-in">
                <form onSubmit={submit} className="space-y-6">

                    {/* Basic Info */}
                    <div className="card animate-slide-up">
                        <div className="card-header">
                            <div className="flex items-center gap-2">
                                <div className="w-8 h-8 rounded-xl bg-brand-50 flex items-center justify-center">
                                    <i className="fi fi-rr-settings text-brand-500 text-sm leading-none" />
                                </div>
                                <div>
                                    <h3 className="text-sm font-bold text-surface-900">Basic Information</h3>
                                    <p className="text-xs text-surface-400">Identification and section assignment</p>
                                </div>
                            </div>
                        </div>
                        <div className="card-body space-y-4">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="form-group">
                                    <label className="form-label">Machine Name *</label>
                                    <input type="text" value={data.name}
                                        onChange={e => setData('name', e.target.value)}
                                        placeholder="e.g. Heavy Duty Lathe #1"
                                        className="form-input" required />
                                    {errors.name && <p className="form-error">{errors.name}</p>}
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Machine Code *</label>
                                    <input type="text" value={data.machine_code}
                                        onChange={e => setData('machine_code', e.target.value)}
                                        placeholder="e.g. LATHE-001"
                                        className="form-input font-mono" required />
                                    {errors.machine_code && <p className="form-error">{errors.machine_code}</p>}
                                </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="form-group">
                                    <label className="form-label">Section *</label>
                                    <select value={data.section_id} onChange={e => setData('section_id', e.target.value)}
                                        className="form-select" required>
                                        <option value="">Select section...</option>
                                        {sections.map((s: any) => (
                                            <option key={s.id} value={s.id}>{s.name} ({s.code})</option>
                                        ))}
                                    </select>
                                    {errors.section_id && <p className="form-error">{errors.section_id}</p>}
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Location <span className="form-label-optional">in shop</span></label>
                                    <input type="text" value={data.location}
                                        onChange={e => setData('location', e.target.value)}
                                        placeholder="e.g. Shop A, Bay 3"
                                        className="form-input" />
                                </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="form-group">
                                    <label className="form-label">Availability Status *</label>
                                    <select value={data.status} onChange={e => setData('status', e.target.value)}
                                        className="form-select" required>
                                        <option value="operational">Operational</option>
                                        <option value="maintenance">Under Maintenance</option>
                                        <option value="offline">Offline</option>
                                    </select>
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Current State</label>
                                    <select value={data.current_state} onChange={e => setData('current_state', e.target.value)}
                                        className="form-select">
                                        <option value="idle">Idle</option>
                                        <option value="running">Running</option>
                                        <option value="setup">Setup</option>
                                        <option value="maintenance">Maintenance</option>
                                        <option value="breakdown">Breakdown</option>
                                        <option value="offline">Offline</option>
                                    </select>
                                </div>
                            </div>

                            <div className="form-group">
                                <label className="form-label">Description <span className="form-label-optional">optional</span></label>
                                <textarea value={data.description}
                                    onChange={e => setData('description', e.target.value)}
                                    rows={2} className="form-textarea"
                                    placeholder="Specifications, capacity, special features..." />
                            </div>
                        </div>
                    </div>

                    {/* Asset Info */}
                    <div className="card animate-slide-up">
                        <div className="card-header">
                            <div className="flex items-center gap-2">
                                <div className="w-8 h-8 rounded-xl bg-purple-50 flex items-center justify-center">
                                    <i className="fi fi-rr-box-alt text-purple-500 text-sm leading-none" />
                                </div>
                                <div>
                                    <h3 className="text-sm font-bold text-surface-900">Asset Information</h3>
                                    <p className="text-xs text-surface-400">Manufacturer, warranty &amp; purchase details</p>
                                </div>
                            </div>
                        </div>
                        <div className="card-body space-y-4">
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                <div className="form-group">
                                    <label className="form-label">Manufacturer</label>
                                    <input type="text" value={data.manufacturer}
                                        onChange={e => setData('manufacturer', e.target.value)}
                                        placeholder="e.g. Mazak, Haas"
                                        className="form-input" />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Model</label>
                                    <input type="text" value={data.model}
                                        onChange={e => setData('model', e.target.value)}
                                        placeholder="e.g. CK6140"
                                        className="form-input" />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Serial Number</label>
                                    <input type="text" value={data.serial_number}
                                        onChange={e => setData('serial_number', e.target.value)}
                                        placeholder="e.g. SN-2023-0047"
                                        className="form-input font-mono text-sm" />
                                </div>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                <div className="form-group">
                                    <label className="form-label">Purchased On</label>
                                    <input type="date" value={data.purchased_on}
                                        onChange={e => setData('purchased_on', e.target.value)}
                                        className="form-input" />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Warranty Expires</label>
                                    <input type="date" value={data.warranty_expires_on}
                                        onChange={e => setData('warranty_expires_on', e.target.value)}
                                        className="form-input" />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Asset Value <span className="form-label-optional">৳</span></label>
                                    <div className="relative">
                                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-surface-400 text-sm">৳</span>
                                        <input type="number" min="0" step="0.01" value={data.asset_value}
                                            onChange={e => setData('asset_value', e.target.value)}
                                            placeholder="0.00"
                                            className="form-input pl-8" />
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Maintenance Schedule */}
                    <div className="card animate-slide-up">
                        <div className="card-header">
                            <div className="flex items-center gap-2">
                                <div className="w-8 h-8 rounded-xl bg-amber-50 flex items-center justify-center">
                                    <i className="fi fi-rr-wrench-simple text-amber-500 text-sm leading-none" />
                                </div>
                                <div>
                                    <h3 className="text-sm font-bold text-surface-900">Maintenance Schedule</h3>
                                    <p className="text-xs text-surface-400">Service intervals and last/next service dates</p>
                                </div>
                            </div>
                        </div>
                        <div className="card-body space-y-4">
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                <div className="form-group">
                                    <label className="form-label">Last Service</label>
                                    <input type="date" value={data.last_maintenance_date}
                                        onChange={e => setData('last_maintenance_date', e.target.value)}
                                        className="form-input" />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Next Service Due</label>
                                    <input type="date" value={data.next_maintenance_date}
                                        onChange={e => setData('next_maintenance_date', e.target.value)}
                                        className="form-input" />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Interval <span className="form-label-optional">days</span></label>
                                    <input type="number" min="1" value={data.maintenance_interval_days}
                                        onChange={e => setData('maintenance_interval_days', e.target.value)}
                                        placeholder="e.g. 90"
                                        className="form-input" />
                                    <p className="form-hint">Auto-calculates next service after each maintenance</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Pricing Rates */}
                    <div className="card animate-slide-up">
                        <div className="card-header">
                            <div className="flex items-center gap-2">
                                <div className="w-8 h-8 rounded-xl bg-emerald-50 flex items-center justify-center">
                                    <i className="fi fi-rr-coins text-emerald-500 text-sm leading-none" />
                                </div>
                                <div>
                                    <h3 className="text-sm font-bold text-surface-900">Hourly Rates by Customer Group</h3>
                                    <p className="text-xs text-surface-400">Used in cost calculation</p>
                                </div>
                            </div>
                        </div>
                        <div className="card-body space-y-4">
                            <div className="alert alert-info">
                                <i className="fi fi-rr-info text-blue-500 text-base leading-none shrink-0 mt-0.5" />
                                <div className="text-xs">
                                    <strong>Group A</strong> = Small &amp; Cottage Industry &nbsp;·&nbsp;
                                    <strong>Group B</strong> = Corporate / Multinational &nbsp;·&nbsp;
                                    <strong>Group C</strong> = Import Substitute
                                </div>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                {(['a', 'b', 'c'] as const).map(g => (
                                    <div key={g} className="form-group">
                                        <label className="form-label">Group {g.toUpperCase()} Rate <span className="form-label-optional">৳/hour</span></label>
                                        <div className="relative">
                                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-surface-400 text-sm">৳</span>
                                            <input type="number" min="0" step="0.01"
                                                value={(data as any)[`rate_group_${g}`]}
                                                onChange={e => setData(`rate_group_${g}` as any, e.target.value)}
                                                placeholder="0.00"
                                                className="form-input pl-8" />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        <button type="submit" disabled={processing} className="btn-primary">
                            {processing ? (
                                <><i className="fi fi-rr-spinner animate-spin text-sm leading-none" /> Saving...</>
                            ) : (
                                <><i className="fi fi-rr-check text-sm leading-none" /> {isEdit ? 'Update' : 'Create'} Machine</>
                            )}
                        </button>
                        <Link href="/admin/machines" className="btn-outline">Cancel</Link>
                    </div>
                </form>
            </div>
        </AppLayout>
    );
}
