import AppLayout from '@/Layouts/AppLayout';
import { useForm, Link } from '@inertiajs/react';
import { FormEvent } from 'react';

export default function SectionCreateEdit({ section }: any) {
    const isEdit = !!section;
    const { data, setData, post, put, processing, errors } = useForm({
        code:          section?.code ?? '',
        name:          section?.name ?? '',
        name_bn:       section?.name_bn ?? '',
        type:          section?.type ?? 'production_shop',
        description:   section?.description ?? '',
        display_order: section?.display_order ?? 0,
        is_active:     section?.is_active ?? true,
    });

    const submit = (e: FormEvent) => {
        e.preventDefault();
        if (isEdit) put(`/admin/sections/${section.id}`);
        else post('/admin/sections');
    };

    return (
        <AppLayout header={isEdit ? 'Edit Section' : 'New Section'}>
            <div className="max-w-2xl animate-fade-in">
                <form onSubmit={submit} className="space-y-6">
                    <div className="card animate-slide-up">
                        <div className="card-header">
                            <div className="flex items-center gap-2">
                                <div className="w-8 h-8 rounded-xl bg-brand-50 flex items-center justify-center">
                                    <i className="fi fi-rr-building text-brand-500 text-sm leading-none" />
                                </div>
                                <div>
                                    <h3 className="text-sm font-bold text-surface-900">Section Details</h3>
                                    <p className="text-xs text-surface-400">Department or production shop</p>
                                </div>
                            </div>
                        </div>
                        <div className="card-body space-y-4">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="form-group">
                                    <label className="form-label">Section Code *</label>
                                    <input type="text" value={data.code}
                                        onChange={e => setData('code', e.target.value.toUpperCase())}
                                        placeholder="e.g. CNC, MACHINE_SHOP"
                                        className="form-input font-mono uppercase"
                                        required />
                                    {errors.code && <p className="form-error">{errors.code}</p>}
                                    <p className="form-hint">Letters, numbers, dash, underscore only</p>
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Type *</label>
                                    <select value={data.type} onChange={e => setData('type', e.target.value)}
                                        className="form-select" required>
                                        <option value="functional">Functional Department (IED, PCD, QC)</option>
                                        <option value="production_shop">Production Shop (CNC, Machine Shop, etc.)</option>
                                    </select>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="form-group">
                                    <label className="form-label">Name (English) *</label>
                                    <input type="text" value={data.name}
                                        onChange={e => setData('name', e.target.value)}
                                        placeholder="e.g. Machine Shop"
                                        className="form-input" required />
                                    {errors.name && <p className="form-error">{errors.name}</p>}
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Name (Bengali) <span className="form-label-optional">optional</span></label>
                                    <input type="text" value={data.name_bn}
                                        onChange={e => setData('name_bn', e.target.value)}
                                        placeholder="যান্ত্রিক"
                                        className="form-input" />
                                </div>
                            </div>

                            <div className="form-group">
                                <label className="form-label">Description <span className="form-label-optional">optional</span></label>
                                <textarea value={data.description ?? ''}
                                    onChange={e => setData('description', e.target.value)}
                                    rows={2} className="form-textarea"
                                    placeholder="Brief description of this section's role..." />
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="form-group">
                                    <label className="form-label">Display Order</label>
                                    <input type="number" value={data.display_order}
                                        onChange={e => setData('display_order', parseInt(e.target.value) || 0)}
                                        min="0"
                                        className="form-input" />
                                    <p className="form-hint">Lower numbers appear first</p>
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Status</label>
                                    <label className="flex items-center gap-2 mt-2.5 cursor-pointer">
                                        <input type="checkbox" checked={data.is_active}
                                            onChange={e => setData('is_active', e.target.checked)}
                                            className="w-4 h-4 rounded border-surface-300 text-brand-600 focus:ring-brand-500" />
                                        <span className="text-sm text-surface-700">Active</span>
                                    </label>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        <button type="submit" disabled={processing} className="btn-primary">
                            {processing ? (
                                <><i className="fi fi-rr-spinner animate-spin text-sm leading-none" /> Saving...</>
                            ) : (
                                <><i className="fi fi-rr-check text-sm leading-none" /> {isEdit ? 'Update' : 'Create'} Section</>
                            )}
                        </button>
                        <Link href="/admin/sections" className="btn-outline">Cancel</Link>
                    </div>
                </form>
            </div>
        </AppLayout>
    );
}
