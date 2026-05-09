import AppLayout from '@/Layouts/AppLayout';
import { Link, useForm } from '@inertiajs/react';
import { FormEvent } from 'react';

const CATEGORIES = [
    { value: 'machining',          label: 'Machining' },
    { value: 'casting',            label: 'Casting' },
    { value: 'plating',            label: 'Plating' },
    { value: 'heat_treatment',     label: 'Heat Treatment' },
    { value: 'surface_treatment',  label: 'Surface Treatment' },
    { value: 'fabrication',        label: 'Fabrication' },
    { value: 'other',              label: 'Other' },
];

export default function OperationCreateEdit({ operation, sections }: any) {
    const isEdit = !!operation;
    const { data, setData, post, put, processing, errors } = useForm({
        name:          operation?.name ?? '',
        category:      operation?.category ?? 'machining',
        default_unit:  operation?.default_unit ?? 'hour',
        rate_group_a:  operation?.rate_group_a ?? '',
        rate_group_b:  operation?.rate_group_b ?? '',
        rate_group_c:  operation?.rate_group_c ?? '',
        section_id:    operation?.section_id ?? '',
        notes:         operation?.notes ?? '',
        is_active:     operation?.is_active ?? true,
        display_order: operation?.display_order ?? 0,
    });

    const submit = (e: FormEvent) => {
        e.preventDefault();
        if (isEdit) put(`/admin/operations/${operation.id}`);
        else post('/admin/operations');
    };

    return (
        <AppLayout header={isEdit ? 'Edit Operation' : 'New Operation'}>
            <div className="max-w-3xl animate-fade-in">
                <form onSubmit={submit} className="space-y-6">
                    <div className="card animate-slide-up">
                        <div className="card-header">
                            <h3 className="text-sm font-bold text-surface-900">Operation Details</h3>
                            <p className="text-xs text-surface-400">Master record used in IED cost calculations</p>
                        </div>
                        <div className="card-body space-y-4">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="form-group">
                                    <label className="form-label">Name *</label>
                                    <input type="text" value={data.name}
                                        onChange={e => setData('name', e.target.value)}
                                        className="form-input" required />
                                    {errors.name && <p className="form-error">{errors.name}</p>}
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Category *</label>
                                    <select value={data.category} onChange={e => setData('category', e.target.value)} className="form-select">
                                        {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                                    </select>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="form-group">
                                    <label className="form-label">Default Unit *</label>
                                    <select value={data.default_unit} onChange={e => setData('default_unit', e.target.value)} className="form-select">
                                        <option value="hour">Hour</option>
                                        <option value="kg">Kilogram (kg)</option>
                                        <option value="sqft">Square Foot (sqft)</option>
                                        <option value="pcs">Pieces (pcs)</option>
                                        <option value="m">Meter (m)</option>
                                    </select>
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Section <span className="form-label-optional">(performs this operation)</span></label>
                                    <select value={data.section_id} onChange={e => setData('section_id', e.target.value)} className="form-select">
                                        <option value="">— None —</option>
                                        {sections?.map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
                                    </select>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Rates */}
                    <div className="card animate-slide-up">
                        <div className="card-header">
                            <h3 className="text-sm font-bold text-surface-900">3-Tier Pricing</h3>
                            <p className="text-xs text-surface-400">A=Cottage · B=Corporate · C=Import Substitute</p>
                        </div>
                        <div className="card-body space-y-4">
                            <div className="alert alert-info">
                                <i className="fi fi-rr-info text-blue-500 text-base leading-none shrink-0 mt-0.5" />
                                <div className="text-xs">
                                    Rate is per <strong>{data.default_unit}</strong>. The rate is auto-applied in cost estimates based on the selected pricing group.
                                </div>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                {(['a', 'b', 'c'] as const).map(g => (
                                    <div key={g} className="form-group">
                                        <label className="form-label">Group {g.toUpperCase()} <span className="form-label-optional">৳/{data.default_unit}</span></label>
                                        <div className="relative">
                                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-surface-400 text-sm">৳</span>
                                            <input type="number" min="0" step="0.01"
                                                value={(data as any)[`rate_group_${g}`]}
                                                onChange={e => setData(`rate_group_${g}` as any, e.target.value)}
                                                className="form-input pl-8 font-mono" />
                                        </div>
                                    </div>
                                ))}
                            </div>
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input type="checkbox" checked={data.is_active}
                                    onChange={e => setData('is_active', e.target.checked)}
                                    className="w-4 h-4 rounded border-surface-300 text-brand-600 focus:ring-brand-500" />
                                <span className="text-sm text-surface-700">Active</span>
                            </label>
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        <button type="submit" disabled={processing} className="btn-primary">
                            {processing ? <><i className="fi fi-rr-spinner animate-spin text-sm" /> Saving...</> : <><i className="fi fi-rr-check text-sm" /> {isEdit ? 'Update' : 'Create'} Operation</>}
                        </button>
                        <Link href="/admin/operations" className="btn-outline">Cancel</Link>
                    </div>
                </form>
            </div>
        </AppLayout>
    );
}
