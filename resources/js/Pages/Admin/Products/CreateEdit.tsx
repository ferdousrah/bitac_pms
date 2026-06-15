import AppLayout from '@/Layouts/AppLayout';
import { Link, useForm } from '@inertiajs/react';
import { FormEvent } from 'react';

const COMMON_UNITS = ['pcs', 'kg', 'm', 'mm', 'set', 'pair', 'liter', 'sheet'];

export default function ProductCreateEdit({ product }: any) {
    const { data, setData, post, put, errors, processing } = useForm({
        name: product?.name ?? '',
        code: product?.code ?? '',
        unit: product?.unit ?? 'pcs',
        description: product?.description ?? '',
    });

    const submit = (e: FormEvent) => {
        e.preventDefault();
        if (product) put(`/admin/products/${product.id}`);
        else         post('/admin/products');
    };

    return (
        <AppLayout header={product ? 'Edit Product' : 'New Product'}>
            <div className="max-w-2xl animate-fade-in">
                <div className="card">
                    <div className="card-header">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center text-white">
                                <i className={`fi fi-rr-${product ? 'pencil' : 'box'} text-lg`} />
                            </div>
                            <div>
                                <h2 className="text-lg font-bold text-surface-900">
                                    {product ? 'Edit Product' : 'New Product'}
                                </h2>
                                <p className="text-sm text-surface-500">
                                    Appears in the RFQ "Product Type" dropdown
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
                                        className="form-input" placeholder="e.g. Bracket (Engine Mount)" required maxLength={200} />
                                    {errors.name && <p className="form-error">{errors.name}</p>}
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Code <span className="form-label-optional">Optional</span></label>
                                    <input type="text" value={data.code}
                                        onChange={e => setData('code', e.target.value.toUpperCase())}
                                        className="form-input font-mono uppercase" placeholder="e.g. BK-004" maxLength={50} />
                                    {errors.code && <p className="form-error">{errors.code}</p>}
                                </div>
                            </div>

                            <div className="form-group max-w-[200px]">
                                <label className="form-label">Default Unit</label>
                                <select value={data.unit}
                                    onChange={e => setData('unit', e.target.value)}
                                    className="form-select">
                                    {COMMON_UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                                </select>
                            </div>

                            <div className="form-group">
                                <label className="form-label">Description <span className="form-label-optional">Optional</span></label>
                                <textarea value={data.description}
                                    onChange={e => setData('description', e.target.value)}
                                    rows={2} className="form-textarea" placeholder="Brief description, drawing reference..." maxLength={500} />
                            </div>

                            <div className="flex items-center gap-3 pt-4 border-t border-surface-200">
                                <button type="submit" disabled={processing} className="btn-primary">
                                    {processing ? <><i className="fi fi-rr-spinner animate-spin mr-1.5" /> Saving...</>
                                                 : <><i className={`fi fi-rr-${product ? 'check' : 'plus'} mr-1.5`} /> {product ? 'Update Product' : 'Create Product'}</>}
                                </button>
                                <Link href="/admin/products" className="btn-ghost">Cancel</Link>
                            </div>
                        </form>
                    </div>
                </div>
            </div>
        </AppLayout>
    );
}
