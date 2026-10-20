import AppLayout from '@/Layouts/AppLayout';
import { Head, Link, useForm } from '@inertiajs/react';
import { FormEvent, useEffect, useRef } from 'react';
import RichTextEditor from '@/Components/RichTextEditor';

interface Dept { id: number; name: string; label: string; chain: 'short' | 'long' }

/** The order of signatures this department's notes go through. */
const CHAIN: Record<'short' | 'long', string[]> = {
    short: ['প্রস্তুতকারী', 'নির্বাহী প্রকৌশলী', 'কেন্দ্র প্রধান'],
    long:  ['প্রস্তুতকারী', 'নির্বাহী প্রকৌশলী', 'নির্বাহী প্রকৌশলী (পি.সি.ডি)', 'কেন্দ্র প্রধান'],
};

export default function OfficeNoteCreate({ existing = null, departments = [], defaultSectionId = null }: {
    existing: any; departments: Dept[]; defaultSectionId: number | null;
}) {
    const isEdit = !!existing;
    const initialSection = existing?.section_id ?? defaultSectionId ?? (departments.length === 1 ? departments[0].id : '');
    const initialDept = departments.find(d => d.id === Number(initialSection));

    const { data, setData, post, put, transform, processing, errors } = useForm<any>({
        section_id:      initialSection ?? '',
        department_name: existing?.department_name ?? initialDept?.label ?? '',
        note_no:         existing?.note_no ?? '',
        note_date:       existing?.note_date ?? new Date().toISOString().slice(0, 10),
        subject:         existing?.subject ?? '',
        body:            existing?.body ?? '',
        recipient_block: existing?.recipient_block ?? '',
    });

    // The printed department name follows the department until someone types their own.
    const typedName = useRef(!!existing?.department_name && existing.department_name !== initialDept?.label);
    const dept = departments.find(d => d.id === Number(data.section_id));
    useEffect(() => {
        if (!typedName.current && dept) setData('department_name', dept.label);
    }, [data.section_id]);

    const save = (e: FormEvent, submit: boolean) => {
        e.preventDefault();
        if (submit && !confirm('Submit this note for signatures?\n\nYour own default signature goes on as the preparer, and it can no longer be changed unless it is sent back.')) return;
        transform((d: any) => ({ ...d, submit }));
        if (isEdit) put(`/office-notes/${existing.id}`);
        else post('/office-notes');
    };

    return (
        <AppLayout header={isEdit ? `Edit Note #${existing.id}` : 'New Note'}>
            <Head title={isEdit ? 'Edit Note' : 'New Note'} />

            <div className="max-w-4xl mx-auto p-4 sm:p-6 animate-fade-in">
                <form onSubmit={(e) => save(e, false)} className="space-y-5">

                    {existing?.status === 'returned' && (
                        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                            This note was <strong>sent back</strong>. Make the changes asked for, then submit it again — everyone signs afresh.
                        </div>
                    )}

                    <div className="card">
                        <div className="card-header"><h3 className="text-sm font-bold text-surface-900">Department</h3></div>
                        <div className="card-body space-y-4">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="form-group !mb-0">
                                    <label className="form-label">Department <span className="text-red-500">*</span></label>
                                    <select className="form-input" value={data.section_id} onChange={(e) => setData('section_id', e.target.value)}>
                                        <option value="">— Choose —</option>
                                        {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                                    </select>
                                    {errors.section_id && <p className="form-error">{errors.section_id as any}</p>}
                                </div>
                                <div className="form-group !mb-0">
                                    <label className="form-label">Department name as printed (বিভাগঃ)</label>
                                    <input className="form-input" style={{ fontFamily: 'Nikosh, sans-serif', fontSize: 15 }} value={data.department_name}
                                        onChange={(e) => { typedName.current = true; setData('department_name', e.target.value); }}
                                        placeholder="আই.ই.ডি" maxLength={120} />
                                </div>
                            </div>
                            {dept && (
                                <div className="rounded-xl bg-surface-50 border border-surface-200 px-4 py-3">
                                    <div className="text-[10px] uppercase tracking-wider font-bold text-surface-500 mb-2">Signed in this order</div>
                                    <div className="flex flex-wrap items-center gap-1.5" style={{ fontFamily: 'Nikosh, sans-serif' }}>
                                        {CHAIN[dept.chain].map((s, i) => (
                                            <span key={s} className="inline-flex items-center gap-1.5">
                                                <span className="px-2.5 py-1 rounded-lg bg-white border border-surface-200 text-sm text-surface-800">{s}</span>
                                                {i < CHAIN[dept.chain].length - 1 && <i className="fi fi-rr-angle-small-right text-surface-400" />}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="card">
                        <div className="card-body space-y-4">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="form-group !mb-0">
                                    <label className="form-label">Note No. (নং)</label>
                                    <input className="form-input" value={data.note_no} onChange={(e) => setData('note_no', e.target.value)}
                                        placeholder="From your own register" />
                                    {errors.note_no && <p className="form-error">{errors.note_no as any}</p>}
                                </div>
                                <div className="form-group !mb-0">
                                    <label className="form-label">Date</label>
                                    <input type="date" className="form-input" value={data.note_date} onChange={(e) => setData('note_date', e.target.value)} />
                                </div>
                            </div>

                            <div className="form-group !mb-0">
                                <label className="form-label">To (প্রতি) <span className="form-label-optional">Optional</span></label>
                                <textarea className="form-textarea" rows={3} value={data.recipient_block}
                                    onChange={(e) => setData('recipient_block', e.target.value)} placeholder={'নির্বাহী প্রকৌশলী\nউৎপাদন নিয়ন্ত্রণ বিভাগ'} />
                            </div>

                            <div className="form-group !mb-0">
                                <label className="form-label">Subject (বিষয়) <span className="text-red-500">*</span></label>
                                <input className="form-input" value={data.subject} onChange={(e) => setData('subject', e.target.value)} />
                                {errors.subject && <p className="form-error">{errors.subject as any}</p>}
                            </div>

                            <div className="form-group !mb-0">
                                <label className="form-label">Body <span className="text-red-500">*</span></label>
                                <RichTextEditor value={data.body} onChange={(v: string) => setData('body', v)} />
                                {errors.body && <p className="form-error">{errors.body as any}</p>}
                            </div>
                        </div>
                    </div>

                    <p className="text-xs text-surface-500">
                        Prints on plain legal paper — no letterhead. The top names the centre, its address and the department.
                    </p>

                    <div className="flex items-center justify-end gap-2.5">
                        <Link href={isEdit ? `/office-notes/${existing.id}` : '/office-notes'} className="btn-ghost">Cancel</Link>
                        <button type="submit" disabled={processing} className="btn-outline">
                            {isEdit ? 'Save' : 'Save as draft'}
                        </button>
                        <button type="button" disabled={processing} onClick={(e) => save(e, true)} className="btn-primary">
                            <i className="fi fi-rr-paper-plane text-xs leading-none" /> Submit for signatures
                        </button>
                    </div>
                </form>
            </div>
        </AppLayout>
    );
}
