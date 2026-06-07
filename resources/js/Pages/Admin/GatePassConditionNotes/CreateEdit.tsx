import AppLayout from '@/Layouts/AppLayout';
import { Link, useForm } from '@inertiajs/react';

export default function GatePassConditionNoteCreateEdit({ note }: any) {
    const isEdit = !!note?.id;
    const { data, setData, post, put, processing, errors } = useForm({
        label:         note?.label ?? '',
        display_order: note?.display_order ?? 0,
        is_active:     note?.is_active ?? true,
    });

    const submit = (e: any) => {
        e.preventDefault();
        if (isEdit) put(`/admin/gate-pass-condition-notes/${note.id}`);
        else        post('/admin/gate-pass-condition-notes');
    };

    return (
        <AppLayout header={isEdit ? 'Edit Condition Note' : 'New Condition Note'}>
            <div className="max-w-xl mx-auto space-y-4 animate-fade-in">
                <Link href="/admin/gate-pass-condition-notes" className="text-xs text-surface-500 hover:text-brand-600 inline-flex items-center gap-1">
                    <i className="fi fi-rr-arrow-left text-[10px] leading-none" /> Back to list
                </Link>

                <form onSubmit={submit} className="card">
                    <div className="card-header">
                        <h2 className="text-base font-bold text-surface-900">
                            {isEdit ? 'Edit Condition Note' : 'New Condition Note'}
                        </h2>
                        <p className="text-xs text-surface-400 mt-0.5">
                            Shown in the Gate Pass create form's "Condition Note" dropdown.
                        </p>
                    </div>
                    <div className="card-body space-y-4">
                        <div className="form-group">
                            <label className="form-label">Label <span className="text-red-500">*</span></label>
                            <input type="text"
                                value={data.label}
                                onChange={e => setData('label', e.target.value)}
                                className="form-input"
                                placeholder="e.g. Re-machined / Repaired" />
                            {errors.label && <p className="form-error">{errors.label}</p>}
                        </div>

                        <div className="form-group">
                            <label className="form-label">Display Order <span className="form-label-optional">smaller = top of list</span></label>
                            <input type="number" min="0"
                                value={data.display_order}
                                onChange={e => setData('display_order', Number(e.target.value))}
                                className="form-input font-mono" />
                        </div>

                        <label className="flex items-center gap-2 text-sm text-surface-700 cursor-pointer">
                            <input type="checkbox" checked={data.is_active}
                                onChange={e => setData('is_active', e.target.checked)}
                                className="form-checkbox" />
                            Active (visible to users in gate-pass form)
                        </label>
                    </div>
                    <div className="card-body border-t border-surface-100 flex items-center gap-2">
                        <button type="submit" disabled={processing} className="btn-primary">
                            {processing
                                ? <><i className="fi fi-rr-spinner animate-spin text-sm" /> Saving…</>
                                : <><i className="fi fi-rr-check text-sm" /> {isEdit ? 'Update' : 'Create'}</>}
                        </button>
                        <Link href="/admin/gate-pass-condition-notes" className="btn-outline btn-sm">Cancel</Link>
                    </div>
                </form>
            </div>
        </AppLayout>
    );
}
