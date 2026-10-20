import AppLayout from '@/Layouts/AppLayout';
import { Head, Link, router, useForm, usePage } from '@inertiajs/react';
import { useRef, useState } from 'react';
import PdfPopupModal from '@/Components/PdfPopupModal';
import SignaturePicker, { SignaturePickerHandle } from '@/Components/SignaturePicker';
import { NOTE_BADGE } from './Index';

const STEP_TONE: Record<string, string> = {
    approved: 'bg-emerald-500 text-white',
    pending:  'bg-white border-2 border-surface-300 text-surface-500',
    returned: 'bg-rose-500 text-white',
    skipped:  'bg-surface-200 text-surface-500',
};

/** A note: its text, the signature chain step by step, and what the viewer may do with it. */
export default function OfficeNoteShow({ note, steps, can, currentStepLabel, currentStepIsHead }: any) {
    const { auth } = usePage().props as any;
    const [pdf, setPdf] = useState<string | null>(null);
    const [backOpen, setBackOpen] = useState(false);
    const pickerRef = useRef<SignaturePickerHandle | null>(null);

    const sign = useForm({ remarks: '', user_signature_id: null as number | null });
    const back = useForm({ remarks: '' });

    const approve = () => {
        sign.transform(d => ({ ...d, user_signature_id: pickerRef.current?.value().userSignatureId ?? null }));
        sign.post(`/office-notes/${note.id}/approve`, { preserveScroll: true });
    };

    return (
        <AppLayout header={`Note — ${note.subject}`}>
            <Head title={note.subject} />

            <div className="max-w-6xl mx-auto space-y-5 animate-fade-in">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                        <Link href="/office-notes" className="btn-ghost btn-sm shrink-0"><i className="fi fi-rr-arrow-left text-xs leading-none" /> Notes</Link>
                        <span className={`text-[11px] px-2 py-0.5 rounded border font-bold uppercase ${NOTE_BADGE[note.status]}`}>{note.status_label}</span>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                        <button onClick={() => setPdf(`/office-notes/${note.id}/pdf?preview=base64&lang=bn`)} className={note.status === 'approved' ? 'btn-primary btn-sm' : 'btn-outline btn-sm'}>
                            <i className="fi fi-rr-print text-xs leading-none" /> {note.status === 'approved' ? 'Print' : 'Preview'}
                        </button>
                        <button onClick={() => setPdf(`/office-notes/${note.id}/pdf?preview=base64&lang=en`)} className="btn-ghost btn-sm">English</button>
                        {can.edit && <Link href={`/office-notes/${note.id}/edit`} className="btn-outline btn-sm"><i className="fi fi-rr-pencil text-xs leading-none" /> Edit</Link>}
                        {can.submit && (
                            <button onClick={() => confirm('Submit this note for signatures? Your default signature goes on as the preparer.')
                                && router.post(`/office-notes/${note.id}/submit`, {}, { preserveScroll: true })}
                                className="btn-primary btn-sm"><i className="fi fi-rr-paper-plane text-xs leading-none" /> {note.status === 'returned' ? 'Submit again' : 'Submit for signatures'}</button>
                        )}
                        {can.delete && (
                            <button onClick={() => confirm('Delete this draft?') && router.delete(`/office-notes/${note.id}`)}
                                className="btn-ghost btn-sm text-rose-600"><i className="fi fi-rr-trash text-xs leading-none" /></button>
                        )}
                    </div>
                </div>

                {note.status === 'approved' && (
                    <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-3 text-sm text-emerald-900">
                        <i className="fi fi-rr-check-circle mr-1.5" /> Passed by the centre head on {note.approved_at} — back with the department and ready to print.
                    </div>
                )}
                {note.status === 'returned' && (
                    <div className="rounded-2xl border border-rose-200 bg-rose-50 px-5 py-3 text-sm text-rose-900">
                        Sent back to the preparer — see the comment in the chain. {can.edit ? 'Edit it and submit again.' : ''}
                    </div>
                )}

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 items-start">
                    {/* The note */}
                    <div className="card lg:col-span-2">
                        <div className="card-body" style={{ fontFamily: 'Nikosh, sans-serif' }}>
                            <div className="text-center text-surface-900">
                                <div className="font-bold text-lg">বাংলাদেশ শিল্প কারিগরি সহায়তা কেন্দ্র (বিটাক)</div>
                                {note.department && <div className="font-semibold mt-1">বিভাগঃ {note.department}</div>}
                            </div>
                            <div className="flex justify-between mt-5 text-[15px]">
                                <span><b>নং-</b> {note.note_no ?? ''}</span>
                                <span><b>তারিখঃ</b> {note.note_date}</span>
                            </div>
                            {note.recipient_block && (
                                <div className="mt-4 text-[15px] whitespace-pre-line"><b>প্রতি,</b><br />{note.recipient_block}</div>
                            )}
                            <div className="mt-4 text-[15px]"><b>বিষয়ঃ-</b> {note.subject}</div>
                            <div className="mt-4 prose prose-sm max-w-none text-[15px] leading-relaxed" dangerouslySetInnerHTML={{ __html: note.body }} />
                        </div>
                    </div>

                    {/* The chain */}
                    <div className="space-y-4">
                        <div className="card">
                            <div className="card-header"><h3 className="text-sm font-bold text-surface-900">Signatures</h3></div>
                            <div className="card-body">
                                <ol className="space-y-4">
                                    <Step tone={note.status === 'draft' ? 'pending' : 'approved'} n={0} label="প্রস্তুতকারী" sub="Prepared by"
                                        who={note.created_by} when={note.submitted_at} />
                                    {steps.map((s: any, i: number) => (
                                        <Step key={s.id} tone={s.status} n={i + 1} label={s.label} sub={s.label_en}
                                            who={s.actor} when={s.acted_at} current={s.is_current}
                                            extra={
                                                <>
                                                    {s.status === 'skipped' && <p className="text-[11px] text-surface-500 mt-0.5">Skipped — {s.skip_reason}</p>}
                                                    {s.is_current && s.waiting_on.length > 0 && (
                                                        <p className="text-[11px] text-amber-700 mt-0.5">Waiting on {s.waiting_on.join(', ')}</p>
                                                    )}
                                                    {s.remarks && (
                                                        <p className={`text-xs mt-1.5 rounded-lg px-2.5 py-1.5 ${s.status === 'returned' ? 'bg-rose-50 text-rose-800' : 'bg-surface-50 text-surface-700'}`}>
                                                            “{s.remarks}”
                                                        </p>
                                                    )}
                                                </>
                                            } />
                                    ))}
                                </ol>
                                {note.head_stand_in && note.status !== 'approved' && (
                                    <p className="text-[11px] text-surface-500 mt-4">
                                        Nobody holds the <b>Centre Head</b> role yet, so management signs for the centre head. Assign it under Admin → Users.
                                    </p>
                                )}
                            </div>
                        </div>

                        {can.act && (
                            <div className="card border-brand-200">
                                <div className="card-header bg-brand-50">
                                    <h3 className="text-sm font-bold text-brand-800">Your signature — <span style={{ fontFamily: 'Nikosh, sans-serif' }}>{currentStepLabel}</span></h3>
                                </div>
                                <div className="card-body space-y-3">
                                    <SignaturePicker ref={pickerRef} signatures={auth?.user?.signatures ?? []} allowDraw={false} />
                                    <div>
                                        <label className="form-label">{currentStepIsHead ? 'Comment (prints under the signatures)' : 'Remarks'} <span className="form-label-optional">Optional</span></label>
                                        <textarea rows={3} className="form-textarea w-full" value={sign.data.remarks} onChange={e => sign.setData('remarks', e.target.value)} />
                                    </div>
                                    <button onClick={approve} disabled={sign.processing} className="btn-primary w-full justify-center">
                                        <i className="fi fi-rr-pen-clip text-xs leading-none" /> {currentStepIsHead ? 'Pass the note' : 'Sign and send on'}
                                    </button>
                                    {!backOpen ? (
                                        <button onClick={() => setBackOpen(true)} className="btn-ghost w-full justify-center text-rose-600">Send back to the preparer…</button>
                                    ) : (
                                        <div className="space-y-2 pt-2 border-t border-surface-100">
                                            <textarea rows={3} className="form-textarea w-full" placeholder="What needs changing?" value={back.data.remarks} onChange={e => back.setData('remarks', e.target.value)} />
                                            {back.errors.remarks && <p className="form-error">{back.errors.remarks}</p>}
                                            <button onClick={() => back.post(`/office-notes/${note.id}/send-back`, { preserveScroll: true })} disabled={back.processing}
                                                className="btn-outline w-full justify-center text-rose-700 border-rose-200">Send back</button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <PdfPopupModal open={pdf !== null} pdfUrl={pdf} title={note.subject} subtitle={note.department} onClose={() => setPdf(null)} />
        </AppLayout>
    );
}

function Step({ tone, n, label, sub, who, when, current = false, extra }: any) {
    return (
        <li className={`flex gap-3 ${current ? 'rounded-xl bg-amber-50 -mx-2 px-2 py-1.5' : ''}`}>
            <span className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${STEP_TONE[tone] ?? STEP_TONE.pending}`}>
                {tone === 'approved' ? <i className="fi fi-rr-check text-[11px] leading-none" /> : tone === 'returned' ? <i className="fi fi-rr-undo text-[11px] leading-none" /> : n + 1}
            </span>
            <div className="min-w-0">
                <div className="text-sm font-semibold text-surface-900" style={{ fontFamily: 'Nikosh, sans-serif', fontSize: 15 }}>{label}</div>
                <div className="text-[11px] text-surface-400">{sub}</div>
                {who && <div className="text-xs text-surface-700 mt-0.5">{who}{when ? ` · ${when}` : ''}</div>}
                {extra}
            </div>
        </li>
    );
}
