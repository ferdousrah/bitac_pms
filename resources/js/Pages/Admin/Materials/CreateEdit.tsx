import AppLayout from '@/Layouts/AppLayout';
import { Link, useForm } from '@inertiajs/react';
import { FormEvent } from 'react';

export default function MaterialCreateEdit({ material, categories = [] }: any) {
    const isEdit = !!material;
    const { data, setData, post, put, processing, errors } = useForm({
        name:           material?.name ?? '',
        category:       material?.category ?? '',
        unit:           material?.unit ?? 'kg',
        rate_per_kg:    material?.rate_per_kg ?? '',
        density_kg_m3:  material?.density_kg_m3 ?? '',
        notes:          material?.notes ?? '',
        is_active:      material?.is_active ?? true,
    });

    const submit = (e: FormEvent) => {
        e.preventDefault();
        if (isEdit) put(`/admin/materials/${material.id}`);
        else post('/admin/materials');
    };

    return (
        <AppLayout header={isEdit ? 'Edit Material' : 'New Material'}>
            <div className="max-w-2xl animate-fade-in">
                <form onSubmit={submit} className="space-y-6">
                    <div className="card animate-slide-up">
                        <div className="card-header">
                            <h3 className="text-sm font-bold text-surface-900">Material Details</h3>
                            <p className="text-xs text-surface-400">Used in IED cost estimates</p>
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
                                    <label className="form-label">
                                        Category
                                        <Link href="/admin/material-categories" className="ml-2 text-[10px] text-brand-600 hover:text-brand-700 font-semibold">
                                            Manage →
                                        </Link>
                                    </label>
                                    <select value={data.category} onChange={e => setData('category', e.target.value)} className="form-select">
                                        <option value="">— None —</option>
                                        {categories.map((c: any) => (
                                            <option key={c.code} value={c.code}>{c.name}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                                <div className="form-group">
                                    <label className="form-label">Unit</label>
                                    <input type="text" value={data.unit}
                                        onChange={e => setData('unit', e.target.value)}
                                        className="form-input"
                                        placeholder="kg" list="material-units" />
                                    <datalist id="material-units">
                                        <option value="kg" />
                                        <option value="g" />
                                        <option value="ton" />
                                        <option value="L" />
                                        <option value="mL" />
                                        <option value="pcs" />
                                        <option value="set" />
                                        <option value="m" />
                                        <option value="m²" />
                                        <option value="m³" />
                                        <option value="sheet" />
                                    </datalist>
                                    <p className="form-hint">Default unit for requisitions. Most materials use <strong>kg</strong>.</p>
                                    {errors.unit && <p className="form-error">{errors.unit}</p>}
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Rate * <span className="form-label-optional">৳/Kg</span></label>
                                    <input type="number" min="0" step="0.01" value={data.rate_per_kg}
                                        onChange={e => setData('rate_per_kg', e.target.value)}
                                        className="form-input font-mono" required />
                                    {errors.rate_per_kg && <p className="form-error">{errors.rate_per_kg}</p>}
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Density <span className="form-label-optional">kg/m³</span></label>
                                    <input type="number" min="0" step="0.01" value={data.density_kg_m3}
                                        onChange={e => setData('density_kg_m3', e.target.value)}
                                        className="form-input font-mono" />
                                    {/* kg/In³ auto-derived from kg/m³ — kept in lockstep on save.
                                        Per BITAC master file: EN-24 @ 7850 kg/m³ → 0.1286 kg/In³. */}
                                    {Number(data.density_kg_m3) > 0 && (
                                        <p className="text-[11px] text-surface-500 mt-1">
                                            ≈ <span className="font-mono">{(Number(data.density_kg_m3) / 61023.7440947).toFixed(5)}</span> kg/In³ <span className="text-surface-400">(auto-computed)</span>
                                        </p>
                                    )}
                                </div>
                            </div>

                            <div className="form-group">
                                <label className="form-label">Notes <span className="form-label-optional">optional</span></label>
                                <input type="text" value={data.notes}
                                    onChange={e => setData('notes', e.target.value)}
                                    className="form-input" />
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
                            {processing ? <><i className="fi fi-rr-spinner animate-spin text-sm" /> Saving...</> : <><i className="fi fi-rr-check text-sm" /> {isEdit ? 'Update' : 'Create'} Material</>}
                        </button>
                        <Link href="/admin/materials" className="btn-outline">Cancel</Link>
                    </div>
                </form>
            </div>
        </AppLayout>
    );
}
