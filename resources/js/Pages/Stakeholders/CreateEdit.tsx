import AppLayout from '@/Layouts/AppLayout';
import { Link, useForm } from '@inertiajs/react';

export default function StakeholderCreateEdit({ stakeholder, categories }: any) {
    const isEdit = !!stakeholder?.id;
    const { data, setData, post, put, processing, errors } = useForm<any>({
        name:         stakeholder?.name ?? '',
        email:        stakeholder?.email ?? '',
        phone:        stakeholder?.phone ?? '',
        organization: stakeholder?.organization ?? '',
        designation:  stakeholder?.designation ?? '',
        category:     stakeholder?.category ?? 'industry_customer',
        is_active:    stakeholder?.is_active ?? true,
        notes:        stakeholder?.notes ?? '',
    });

    const submit = (e: any) => {
        e.preventDefault();
        if (isEdit) put(`/ied/stakeholders/${stakeholder.id}`);
        else        post('/ied/stakeholders');
    };

    return (
        <AppLayout header={isEdit ? 'Edit Stakeholder' : 'New Stakeholder'}>
            <div className="max-w-2xl space-y-4 animate-fade-in">
                <Link href="/ied/stakeholders" className="text-xs text-surface-500 hover:text-brand-600 inline-flex items-center gap-1">
                    <i className="fi fi-rr-arrow-left text-[10px] leading-none" /> Back to directory
                </Link>

                <form onSubmit={submit} className="card">
                    <div className="card-header">
                        <h2 className="text-base font-bold text-surface-900">{isEdit ? 'Edit stakeholder' : 'Add stakeholder'}</h2>
                    </div>
                    <div className="card-body space-y-4">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div className="form-group">
                                <label className="form-label">Name <span className="text-red-500">*</span></label>
                                <input type="text" value={data.name} onChange={e => setData('name', e.target.value)} className="form-input" required />
                                {errors.name && <p className="form-error">{errors.name as any}</p>}
                            </div>
                            <div className="form-group">
                                <label className="form-label">Email <span className="text-red-500">*</span></label>
                                <input type="email" value={data.email} onChange={e => setData('email', e.target.value)} className="form-input" required />
                                {errors.email && <p className="form-error">{errors.email as any}</p>}
                            </div>
                            <div className="form-group">
                                <label className="form-label">Phone</label>
                                <input type="tel" value={data.phone} onChange={e => setData('phone', e.target.value)} className="form-input" />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Category <span className="text-red-500">*</span></label>
                                <select value={data.category} onChange={e => setData('category', e.target.value)} className="form-select">
                                    {Object.entries(categories).map(([k, v]: any) => <option key={k} value={k}>{v}</option>)}
                                </select>
                            </div>
                            <div className="form-group">
                                <label className="form-label">Organisation</label>
                                <input type="text" value={data.organization} onChange={e => setData('organization', e.target.value)} className="form-input" />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Designation</label>
                                <input type="text" value={data.designation} onChange={e => setData('designation', e.target.value)} className="form-input" />
                            </div>
                        </div>
                        <div className="form-group">
                            <label className="form-label">Notes</label>
                            <textarea value={data.notes} onChange={e => setData('notes', e.target.value)} rows={2} className="form-textarea" />
                        </div>
                        <label className="flex items-center gap-2 text-sm">
                            <input type="checkbox" checked={data.is_active} onChange={e => setData('is_active', e.target.checked)} className="form-checkbox" />
                            Active (eligible for invitations)
                        </label>
                    </div>
                    <div className="card-body border-t border-surface-100 flex items-center gap-2">
                        <button type="submit" disabled={processing} className="btn-primary">
                            {processing ? 'Saving…' : (isEdit ? 'Update' : 'Add Stakeholder')}
                        </button>
                        <Link href="/ied/stakeholders" className="btn-ghost btn-sm">Cancel</Link>
                    </div>
                </form>
            </div>
        </AppLayout>
    );
}
