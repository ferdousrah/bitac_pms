import AppLayout from '@/Layouts/AppLayout';
import { Head, Link, useForm } from '@inertiajs/react';
import { FormEvent, useRef } from 'react';
import RichTextEditor from '@/Components/RichTextEditor';
import SignaturePicker, { SignaturePickerHandle } from '@/Components/SignaturePicker';

export default function OfficeNoteCreate({
    signatories = [],
    defaultSignatoryId = null,
    existing = null,
}: any) {
    const isEdit = !!existing;

    const { data, setData, post, put, transform, processing, errors } = useForm<any>({
        note_no:           existing?.note_no ?? '',
        note_date:         existing?.note_date ?? new Date().toISOString().slice(0, 10),
        subject:           existing?.subject ?? '',
        body:              existing?.body ?? '',
        recipient_block:   existing?.recipient_block ?? '',
        signatory_user_id: existing?.signatory_user_id ?? defaultSignatoryId ?? '',
        issue:             false,
    });

    const pickerRef = useRef<SignaturePickerHandle | null>(null);
    // The picker shows the chosen SIGNATORY's blocks — a note is often drafted
    // by one person and signed by another.
    const signatory = signatories.find((u: any) => String(u.id) === String(data.signatory_user_id)) ?? null;

    const submit = (e: FormEvent, issue: boolean) => {
        e.preventDefault();
        const picked = pickerRef.current?.value().userSignatureId ?? null;
        transform((d: any) => ({ ...d, issue, user_signature_id: picked }));
        if (isEdit) put(`/office-notes/${existing.id}`);
        else post('/office-notes');
    };

    return (
        <AppLayout header={isEdit ? `Edit Note #${existing.id}` : 'New Note'}>
            <Head title={isEdit ? 'Edit Note' : 'New Note'} />

            <div className="max-w-4xl mx-auto p-4 sm:p-6 animate-fade-in">
                <form onSubmit={(e) => submit(e, false)} className="space-y-5">

                    <div className="rounded-2xl border border-surface-200 bg-surface-50/60 p-4">
                        <p className="text-sm text-surface-600">
                            An <strong>internal</strong> note. It prints on plain legal paper (8.5″ × 14″) with
                            <strong> no letterhead</strong> — no emblem, no centre block, no rule.
                        </p>
                    </div>

                    <div className="card">
                        <div className="card-body space-y-4">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="form-group !mb-0">
                                    <label className="form-label">Note No. (নং)</label>
                                    <input className="form-input" value={data.note_no}
                                        onChange={(e) => setData('note_no', e.target.value)}
                                        placeholder="From your own register" />
                                    {errors.note_no && <p className="form-error">{errors.note_no as any}</p>}
                                </div>
                                <div className="form-group !mb-0">
                                    <label className="form-label">Date</label>
                                    <input type="date" className="form-input" value={data.note_date}
                                        onChange={(e) => setData('note_date', e.target.value)} />
                                </div>
                            </div>

                            <div className="form-group !mb-0">
                                <label className="form-label">To <span className="form-label-optional">Optional</span></label>
                                <textarea className="form-textarea" rows={3} value={data.recipient_block}
                                    onChange={(e) => setData('recipient_block', e.target.value)}
                                    placeholder={'Executive Engineer\nProduction Planning Department'} />
                                <p className="form-hint">One line per line, as it should print.</p>
                            </div>

                            <div className="form-group !mb-0">
                                <label className="form-label">Subject <span className="text-red-500">*</span></label>
                                <input className="form-input" value={data.subject}
                                    onChange={(e) => setData('subject', e.target.value)} />
                                {errors.subject && <p className="form-error">{errors.subject as any}</p>}
                            </div>

                            <div className="form-group !mb-0">
                                <label className="form-label">Body <span className="text-red-500">*</span></label>
                                <RichTextEditor value={data.body} onChange={(v: string) => setData('body', v)} />
                                {errors.body && <p className="form-error">{errors.body as any}</p>}
                            </div>
                        </div>
                    </div>

                    <div className="card">
                        <div className="card-header"><h3 className="text-sm font-bold text-surface-900">Signatory</h3></div>
                        <div className="card-body">
                            <div className="form-group !mb-0">
                                <label className="form-label">Signed by</label>
                                <select className="form-input" value={data.signatory_user_id}
                                    onChange={(e) => setData('signatory_user_id', e.target.value)}>
                                    <option value="">— Select signatory —</option>
                                    {signatories.map((u: any) => (
                                        <option key={u.id} value={u.id}>
                                            {u.name}{u.designation ? ` — ${u.designation}` : ''}
                                        </option>
                                    ))}
                                </select>
                                {errors.signatory_user_id && <p className="form-error">{errors.signatory_user_id as any}</p>}
                            </div>

                            {signatory && (
                                <div className="mt-4 pt-4 border-t border-surface-100">
                                    <SignaturePicker
                                        key={signatory.id}
                                        ref={pickerRef}
                                        signatures={signatory.signatures ?? []}
                                        ownerName={signatory.name}
                                        allowDraw={false}
                                    />
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="flex items-center justify-end gap-2.5">
                        <Link href="/office-notes" className="btn-ghost">Cancel</Link>
                        <button type="submit" disabled={processing} className="btn-outline">
                            {isEdit ? 'Save changes' : 'Save as draft'}
                        </button>
                        <button type="button" disabled={processing} onClick={(e) => submit(e, true)} className="btn-primary">
                            <i className="fi fi-rr-paper-plane text-xs leading-none" /> Issue note
                        </button>
                    </div>
                </form>
            </div>
        </AppLayout>
    );
}
