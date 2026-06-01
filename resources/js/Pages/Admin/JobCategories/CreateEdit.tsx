import AppLayout from '@/Layouts/AppLayout';
import { Link, useForm } from '@inertiajs/react';
import { FormEvent } from 'react';

export default function JobCategoryCreateEdit({ category }: any) {
    const { data, setData, post, put, errors, processing } = useForm({
        name: category?.name ?? '',
        code: category?.code ?? '',
        description: category?.description ?? '',
        display_order: category?.display_order ?? 0,
        is_active: category?.is_active ?? true,
    });

    const submit = (e: FormEvent) => {
        e.preventDefault();
        if (category) put(`/admin/job-categories/${category.id}`);
        else          post('/admin/job-categories');
    };

    return (
        <AppLayout header={category ? 'Edit Job Category' : 'New Job Category'}>
            <div className="max-w-2xl animate-fade-in">
                <div className="card">
                    <div className="card-header">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white">
                                <i className={`fi fi-rr-${category ? 'pencil' : 'tags'} text-lg`} />
                            </div>
                            <div>
                                <h2 className="text-lg font-bold text-surface-900">
                                    {category ? 'Edit Job Category' : 'New Job Category'}
                                </h2>
                                <p className="text-sm text-surface-500">
                                    Used to classify RFQs, quotations and work orders
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="card-body">
                        <form onSubmit={submit} className="space-y-5">
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                <div className="form-group sm:col-span-2">
                                    <label className="form-label">Name <span className="text-red-500">*</span></label>
                                    <input type="text" value={data.name}
                                        onChange={e => setData('name', e.target.value)}
                                        className="form-input" placeholder="e.g. Machining" required maxLength={120} />
                                    {errors.name && <p className="form-error">{errors.name}</p>}
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Code <span className="form-label-optional">Optional</span></label>
                                    <input type="text" value={data.code}
                                        onChange={e => setData('code', e.target.value.toUpperCase())}
                                        className="form-input font-mono uppercase" placeholder="e.g. MCH" maxLength={32} />
                                    {errors.code && <p className="form-error">{errors.code}</p>}
                                </div>
                            </div>

                            <div className="form-group">
                                <label className="form-label">Description <span className="form-label-optional">Optional</span></label>
                                <textarea value={data.description}
                                    onChange={e => setData('description', e.target.value)}
                                    rows={2} className="form-textarea" placeholder="Brief description" maxLength={500} />
                            </div>

                            <div className="form-group max-w-[180px]">
                                <label className="form-label">Display Order</label>
                                <input type="number" min={0} value={data.display_order}
                                    onChange={e => setData('display_order', Number(e.target.value))}
                                    className="form-input" />
                                <p className="form-hint">Lower numbers appear first in dropdowns</p>
                            </div>

                            <div className="flex items-center gap-3 p-3 rounded-xl bg-surface-50 border border-surface-200">
                                <input type="checkbox" id="is_active"
                                    checked={Boolean(data.is_active)}
                                    onChange={e => setData('is_active', e.target.checked)}
                                    className="rounded border-surface-300 text-blue-600 focus:ring-blue-500" />
                                <label htmlFor="is_active" className="text-sm font-medium text-surface-700 select-none">Active</label>
                                <span className="text-xs text-surface-400">Inactive categories are hidden from dropdowns</span>
                            </div>

                            <div className="flex items-center gap-3 pt-4 border-t border-surface-200">
                                <button type="submit" disabled={processing} className="btn-primary">
                                    {processing ? <><i className="fi fi-rr-spinner animate-spin mr-1.5" /> Saving...</>
                                                 : <><i className={`fi fi-rr-${category ? 'check' : 'plus'} mr-1.5`} /> {category ? 'Update Category' : 'Create Category'}</>}
                                </button>
                                <Link href="/admin/job-categories" className="btn-ghost">Cancel</Link>
                            </div>
                        </form>
                    </div>
                </div>
            </div>
        </AppLayout>
    );
}
