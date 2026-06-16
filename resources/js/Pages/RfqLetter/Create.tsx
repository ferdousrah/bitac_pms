import AppLayout from '@/Layouts/AppLayout';
import { Link, useForm } from '@inertiajs/react';
import { FormEvent } from 'react';
import RichTextEditor from '@/Components/RichTextEditor';

export default function RfqLetterCreate({
    rfq = null,
    rfqs = [],
    signatories = [],
    defaultRecipient = '',
    defaultLetterNo = '',
    defaultCustomerRefNo = '',
    defaultSignatoryId = null,
    existing = null,
}: any) {
    const isEdit = !!existing;

    const { data, setData, post, put, transform, processing, errors } = useForm<any>({
        rfq_id:            existing?.rfq_id ?? rfq?.id ?? '',
        letter_no:         existing?.letter_no ?? defaultLetterNo,
        letter_date:       existing?.letter_date ?? new Date().toISOString().slice(0, 10),
        subject:           existing?.subject ?? '',
        body:              existing?.body ?? '',
        recipient_block:   existing?.recipient_block ?? defaultRecipient ?? '',
        customer_ref_no:   existing?.customer_ref_no ?? defaultCustomerRefNo ?? '',
        customer_ref_date: existing?.customer_ref_date ?? '',
        signatory_user_id: existing?.signatory_user_id ?? defaultSignatoryId ?? '',
        issue:             false,
    });

    const onSelectRfq = (id: string) => {
        setData('rfq_id', id);
        const picked = rfqs.find((r: any) => String(r.id) === String(id));
        if (picked) {
            // Auto-fill the customer reference; fill recipient too when still empty.
            setData('customer_ref_no', picked.customer_ref_no ?? '');
            if (!data.recipient_block?.trim() && picked.recipient) {
                setData('recipient_block', picked.recipient);
            }
        }
    };

    const submit = (e: FormEvent, issue: boolean) => {
        e.preventDefault();
        transform((d: any) => ({ ...d, issue }));
        if (isEdit) put(`/rfq-letters/${existing.id}`);
        else post('/rfq-letters');
    };

    return (
        <AppLayout header={isEdit ? `Edit Letter #${existing.id}` : 'New Letter'}>
            <div className="max-w-4xl mx-auto p-4 sm:p-6 animate-fade-in">
                <form onSubmit={(e) => submit(e, false)} className="space-y-5">
                    {/* Context */}
                    <div className="card">
                        <div className="card-body">
                            <div className="flex items-center gap-3">
                                <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 text-white flex items-center justify-center shadow-md shrink-0">
                                    <i className="fi fi-rr-document text-base leading-none" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <h2 className="text-base font-bold text-surface-900">{isEdit ? 'Edit Official Letter' : 'Issue Official Letter'}</h2>
                                    <p className="text-xs text-surface-500">
                                        {rfq ? <>Against RFQ #{rfq.id}{rfq.customer_name ? ` — ${rfq.customer_name}` : ''}</> : 'BITAC letterhead format (Bangla / English)'}
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Header fields */}
                    <div className="card">
                        <div className="card-header"><h3 className="text-sm font-bold text-surface-900">Letter Header</h3></div>
                        <div className="card-body grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="form-group !mb-0 sm:col-span-2">
                                <label className="form-label">Against RFQ <span className="form-label-optional">(optional)</span></label>
                                <select value={data.rfq_id} onChange={e => onSelectRfq(e.target.value)} className="form-input">
                                    <option value="">— No RFQ (general letter) —</option>
                                    {rfqs.map((r: any) => (
                                        <option key={r.id} value={r.id}>{r.label}</option>
                                    ))}
                                </select>
                                <p className="form-hint">Selecting an RFQ auto-fills the Customer Ref No. and recipient.</p>
                                {errors.rfq_id && <p className="form-error">{errors.rfq_id as any}</p>}
                            </div>
                            <div className="form-group !mb-0">
                                <label className="form-label">Memo No. (নং)</label>
                                <input type="text" value={data.letter_no} onChange={e => setData('letter_no', e.target.value)}
                                    className="form-input font-mono text-xs" placeholder="36.06.2692.028.51." />
                                {errors.letter_no && <p className="form-error">{errors.letter_no as any}</p>}
                            </div>
                            <div className="form-group !mb-0">
                                <label className="form-label">Date</label>
                                <input type="date" value={data.letter_date} onChange={e => setData('letter_date', e.target.value)} className="form-input" />
                                {errors.letter_date && <p className="form-error">{errors.letter_date as any}</p>}
                            </div>
                            <div className="form-group !mb-0">
                                <label className="form-label">Customer Ref No. <span className="form-label-optional">(পত্র সূত্র)</span></label>
                                <input type="text" value={data.customer_ref_no} onChange={e => setData('customer_ref_no', e.target.value)}
                                    className="form-input font-mono text-xs" placeholder="SFCL/FP/MTS/MM-354/567" />
                            </div>
                            <div className="form-group !mb-0">
                                <label className="form-label">Customer Ref Date</label>
                                <input type="date" value={data.customer_ref_date} onChange={e => setData('customer_ref_date', e.target.value)} className="form-input" />
                            </div>
                        </div>
                    </div>

                    {/* Subject + recipient */}
                    <div className="card">
                        <div className="card-header"><h3 className="text-sm font-bold text-surface-900">Subject & Recipient</h3></div>
                        <div className="card-body space-y-4">
                            <div className="form-group !mb-0">
                                <label className="form-label">Subject (বিষয়)</label>
                                <input type="text" value={data.subject} onChange={e => setData('subject', e.target.value)}
                                    className="form-input" placeholder="দরপত্র প্রদান প্রসঙ্গে। / Regarding ..." required />
                                {errors.subject && <p className="form-error">{errors.subject as any}</p>}
                            </div>
                            <div className="form-group !mb-0">
                                <label className="form-label">Recipient (To whom — bottom-left block)</label>
                                <textarea value={data.recipient_block} onChange={e => setData('recipient_block', e.target.value)}
                                    rows={3} className="form-textarea text-sm"
                                    placeholder={'Managing Director\nShahjalal Fertilizer Company Limited\nFenchuganj, Sylhet.'} />
                                {errors.recipient_block && <p className="form-error">{errors.recipient_block as any}</p>}
                            </div>
                        </div>
                    </div>

                    {/* Body */}
                    <div className="card">
                        <div className="card-header"><h3 className="text-sm font-bold text-surface-900">Letter Body</h3></div>
                        <div className="card-body">
                            <RichTextEditor
                                value={data.body}
                                onChange={(html) => setData('body', html)}
                                placeholder={'Dear Sir/Madam,\nWith reference to your letter …'}
                                minHeight="240px"
                            />
                            {errors.body && <p className="form-error">{errors.body as any}</p>}
                            <p className="form-hint flex items-center gap-1 mt-2">
                                <i className="fi fi-rr-info text-[10px] leading-none" />
                                Letterhead, memo no, date, recipient and the signatory block are added automatically.
                            </p>
                        </div>
                    </div>

                    {/* Signatory */}
                    <div className="card">
                        <div className="card-header"><h3 className="text-sm font-bold text-surface-900">Signatory</h3></div>
                        <div className="card-body">
                            <div className="form-group !mb-0">
                                <label className="form-label">Signed by</label>
                                <select value={data.signatory_user_id} onChange={e => setData('signatory_user_id', e.target.value)} className="form-input">
                                    <option value="">— Select signatory —</option>
                                    {signatories.map((u: any) => (
                                        <option key={u.id} value={u.id}>{u.name}{u.designation ? ` — ${u.designation}` : ''}</option>
                                    ))}
                                </select>
                                {errors.signatory_user_id && <p className="form-error">{errors.signatory_user_id as any}</p>}
                                <p className="form-hint">The signatory's name, designation, centre, email & phone and saved signature appear in the bottom-right block, above the “For / Director (Centre Head)” line.</p>
                            </div>
                        </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center justify-end gap-2.5">
                        <Link href="/rfq-letters" className="btn-ghost">Cancel</Link>
                        <button type="submit" disabled={processing} className="btn-outline">
                            <i className="fi fi-rr-disk text-sm leading-none" /> Save Draft
                        </button>
                        <button type="button" disabled={processing} onClick={(e) => submit(e, true)} className="btn-primary">
                            <i className="fi fi-rr-paper-plane text-sm leading-none" /> {isEdit ? 'Update & Issue' : 'Issue Letter'}
                        </button>
                    </div>
                </form>
            </div>
        </AppLayout>
    );
}
