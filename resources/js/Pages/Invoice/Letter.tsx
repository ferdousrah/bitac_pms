import AppLayout from '@/Layouts/AppLayout';
import { Head, Link, useForm } from '@inertiajs/react';
import { FormEvent, useRef, useState } from 'react';
import RichTextEditor from '@/Components/RichTextEditor';
import SignaturePicker, { SignaturePickerHandle } from '@/Components/SignaturePicker';
import PdfPopupModal from '@/Components/PdfPopupModal';

export default function InvoiceLetter({ invoice, signatories = [], defaultSignatoryId = null }: any) {
    const [pdf, setPdf] = useState<string | null>(null);

    const { data, setData, put, transform, processing, errors } = useForm<any>({
        memo_no:                   invoice.memo_no ?? '',
        forwarding_letter_subject: invoice.forwarding_letter_subject ?? '',
        forwarding_letter:         invoice.forwarding_letter ?? '',
        recipient_block:           invoice.recipient_block ?? '',
        customer_ref_no:           invoice.customer_ref_no ?? '',
        customer_ref_date:         invoice.customer_ref_date ?? '',
        signatory_user_id:         invoice.signatory_user_id ?? defaultSignatoryId ?? '',
    });

    const pickerRef = useRef<SignaturePickerHandle | null>(null);
    const signatory = signatories.find((u: any) => String(u.id) === String(data.signatory_user_id)) ?? null;

    const submit = (e: FormEvent) => {
        e.preventDefault();
        const picked = pickerRef.current?.value().userSignatureId ?? null;
        transform((d: any) => ({ ...d, user_signature_id: picked }));
        put(`/invoices/${invoice.id}/letter`);
    };

    const money = (n: number) =>
        n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    return (
        <AppLayout header={`Forwarding Letter — ${invoice.invoice_number}`}>
            <Head title="Bill Forwarding Letter" />

            <div className="max-w-4xl mx-auto p-4 sm:p-6 animate-fade-in">
                <form onSubmit={submit} className="space-y-5">

                    <div className="rounded-2xl border border-surface-200 bg-surface-50/60 p-4 flex items-start justify-between gap-4">
                        <p className="text-sm text-surface-600">
                            The covering letter for <strong>{invoice.invoice_number}</strong>
                            {invoice.customer ? <> to <strong>{invoice.customer}</strong></> : null}
                            {' '}— ৳ {money(invoice.total_amount)}. It goes out on the BITAC pad with the bill
                            and the মূসক ৬.৩.
                        </p>
                        <Link href={`/invoices/${invoice.id}`} className="btn-ghost shrink-0">Back to bill</Link>
                    </div>

                    <div className="card">
                        <div className="card-body space-y-4">
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                <div className="form-group !mb-0">
                                    <label className="form-label">Ref No.</label>
                                    <input className="form-input" value={data.memo_no}
                                        onChange={(e) => setData('memo_no', e.target.value)}
                                        placeholder="From your own register" />
                                    {errors.memo_no && <p className="form-error">{errors.memo_no as any}</p>}
                                </div>
                                <div className="form-group !mb-0">
                                    <label className="form-label">Customer's ref.</label>
                                    <input className="form-input" value={data.customer_ref_no}
                                        onChange={(e) => setData('customer_ref_no', e.target.value)} />
                                </div>
                                <div className="form-group !mb-0">
                                    <label className="form-label">Customer's ref. date</label>
                                    <input type="date" className="form-input" value={data.customer_ref_date}
                                        onChange={(e) => setData('customer_ref_date', e.target.value)} />
                                </div>
                            </div>

                            <div className="form-group !mb-0">
                                <label className="form-label">Subject</label>
                                <input className="form-input" value={data.forwarding_letter_subject}
                                    onChange={(e) => setData('forwarding_letter_subject', e.target.value)}
                                    placeholder="Bill — Forwarding Letter" />
                            </div>

                            <div className="form-group !mb-0">
                                <label className="form-label">To</label>
                                <textarea className="form-textarea" rows={3} value={data.recipient_block}
                                    onChange={(e) => setData('recipient_block', e.target.value)} />
                                <p className="form-hint">One line per line, as it should print.</p>
                            </div>

                            <div className="form-group !mb-0">
                                <label className="form-label">Body <span className="text-red-500">*</span></label>
                                <RichTextEditor value={data.forwarding_letter} minHeight="260px"
                                    onChange={(v: string) => setData('forwarding_letter', v)} />
                                {errors.forwarding_letter && <p className="form-error">{errors.forwarding_letter as any}</p>}
                                <p className="form-hint">
                                    The salutation lives in the body. Tables, headings and lists all print.
                                </p>
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
                        <Link href={`/invoices/${invoice.id}`} className="btn-ghost">Cancel</Link>
                        {invoice.forwarding_letter && (
                            <>
                                <button type="button"
                                    onClick={() => setPdf(`/invoices/${invoice.id}/letter/pdf?preview=base64&lang=bn`)}
                                    className="btn-outline">বাংলা PDF</button>
                                <button type="button"
                                    onClick={() => setPdf(`/invoices/${invoice.id}/letter/pdf?preview=base64&lang=en`)}
                                    className="btn-outline">EN PDF</button>
                            </>
                        )}
                        <button type="submit" disabled={processing} className="btn-primary">
                            <i className="fi fi-rr-disk text-xs leading-none" /> Save letter
                        </button>
                    </div>
                </form>
            </div>

            <PdfPopupModal open={pdf !== null} pdfUrl={pdf} title="Forwarding Letter"
                subtitle={invoice.invoice_number} onClose={() => setPdf(null)} />
        </AppLayout>
    );
}
