import AppLayout from '@/Layouts/AppLayout';
import { Head, Link, router, useForm } from '@inertiajs/react';
import { FormEvent, useMemo, useRef } from 'react';
import SignaturePicker, { SignaturePickerHandle } from '@/Components/SignaturePicker';

interface Line {
    description: string;
    unit: string;
    quantity: number | string;
    unit_price: number | string;
    sd_rate: number | string;
    vat_rate: number | string;
}

const blankLine = (vatRate: number = 15): Line => ({
    description: '', unit: '', quantity: 1, unit_price: 0, sd_rate: 0, vat_rate: vatRate,
});

const money = (n: number) =>
    n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** The same arithmetic the server writes — shown live so the preparer sees it. */
const compute = (l: Line) => {
    const value = (Number(l.quantity) || 0) * (Number(l.unit_price) || 0);
    const sd    = value * (Number(l.sd_rate) || 0) / 100;
    const vat   = (value + sd) * (Number(l.vat_rate) || 0) / 100;
    return { value, sd, vat, incl: value + sd + vat };
};

export default function MusakChallanCreate({
    existing = null, prefill = null, suggestedNo = null,
    supplier = {}, invoices = [], signatories = [], defaultSignatoryId = null,
}: any) {
    const isEdit = !!existing;
    const now = new Date();

    const { data, setData, post, put, transform, processing, errors } = useForm<any>({
        invoice_id:        existing?.invoice_id ?? prefill?.invoice_id ?? '',
        customer_id:       existing?.customer_id ?? prefill?.customer_id ?? '',
        work_order_id:     existing?.work_order_id ?? prefill?.work_order_id ?? '',
        delivery_order_id: existing?.delivery_order_id ?? prefill?.delivery_order_id ?? '',
        challan_no:        existing?.challan_no ?? suggestedNo ?? '',
        issue_date:        existing?.issue_date ?? now.toISOString().slice(0, 10),
        issue_time:        existing?.issue_time ?? now.toTimeString().slice(0, 5),
        supplier_name:     existing?.supplier_name ?? supplier?.name ?? '',
        supplier_bin:      existing?.supplier_bin ?? supplier?.bin ?? '',
        supplier_address:  existing?.supplier_address ?? supplier?.address ?? '',
        buyer_name:        existing?.buyer_name ?? prefill?.buyer_name ?? '',
        buyer_bin:         existing?.buyer_bin ?? prefill?.buyer_bin ?? '',
        buyer_address:     existing?.buyer_address ?? prefill?.buyer_address ?? '',
        destination:       existing?.destination ?? prefill?.destination ?? '',
        vehicle:           existing?.vehicle ?? prefill?.vehicle ?? '',
        signatory_user_id: existing?.signatory_user_id ?? defaultSignatoryId ?? '',
        note:              existing?.note ?? '',
        items:             (existing?.items ?? prefill?.items ?? [blankLine()]) as Line[],
    });

    const pickerRef = useRef<SignaturePickerHandle | null>(null);
    const signatory = signatories.find((u: any) => String(u.id) === String(data.signatory_user_id)) ?? null;

    const setLine = (i: number, key: keyof Line, value: any) =>
        setData('items', data.items.map((l: Line, n: number) => (n === i ? { ...l, [key]: value } : l)));

    const addLine = () =>
        setData('items', [...data.items, blankLine(Number(data.items.at(-1)?.vat_rate) || 15)]);

    const removeLine = (i: number) =>
        setData('items', data.items.filter((_: Line, n: number) => n !== i));

    const totals = useMemo(() => data.items.reduce(
        (a: any, l: Line) => {
            const c = compute(l);
            return { value: a.value + c.value, sd: a.sd + c.sd, vat: a.vat + c.vat, incl: a.incl + c.incl };
        },
        { value: 0, sd: 0, vat: 0, incl: 0 },
    ), [data.items]);

    const submit = (e: FormEvent, issue: boolean) => {
        e.preventDefault();
        const picked = pickerRef.current?.value().userSignatureId ?? null;
        transform((d: any) => ({ ...d, issue, user_signature_id: picked }));
        if (isEdit) put(`/musak-challans/${existing.id}`);
        else post('/musak-challans');
    };

    const err = (k: string) => errors[k] as any;

    return (
        <AppLayout header={isEdit ? `Edit চালানপত্র ${existing.challan_no ?? ''}` : 'New চালানপত্র'}>
            <Head title="মূসক ৬.৩" />

            <div className="max-w-6xl mx-auto p-4 sm:p-6 animate-fade-in">
                <form onSubmit={(e) => submit(e, false)} className="space-y-5">

                    {/* Where it came from ------------------------------------ */}
                    {!isEdit && (
                        <div className="card">
                            <div className="card-body">
                                <div className="form-group !mb-0">
                                    <label className="form-label">Raise against an invoice <span className="form-label-optional">Optional</span></label>
                                    <select className="form-input" value={data.invoice_id}
                                        onChange={(e) => {
                                            const v = e.target.value;
                                            router.get('/musak-challans/create', v ? { invoice: v } : {},
                                                { preserveScroll: true });
                                        }}>
                                        <option value="">— None, type it all in —</option>
                                        {invoices.map((inv: any) => (
                                            <option key={inv.id} value={inv.id}>{inv.label}</option>
                                        ))}
                                    </select>
                                    <p className="form-hint">Picking one fills the buyer and the lines from it.</p>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* The AIT question, named rather than hidden -------------- */}
                    {prefill?.excluded_tax > 0 && (
                        <div className="rounded-2xl border border-amber-200 bg-amber-50/70 p-4 text-sm text-amber-900">
                            <p className="font-semibold">মূসক ৬.৩ carries VAT only — ৳ {money(prefill.excluded_tax)} of tax is not on this form.</p>
                            <p className="mt-1 text-amber-800">
                                The form has columns for সম্পূরক শুল্ক and মূসক and nothing else, so the
                                income tax ({prefill.tax_rate}%) embedded in invoice {prefill.invoice_number} has
                                been left out of the prices below. The usual practice is that the buyer deducts
                                it at source. <strong>Confirm this with accounts before issuing.</strong>
                            </p>
                        </div>
                    )}

                    {/* Header ------------------------------------------------- */}
                    <div className="card">
                        <div className="card-header"><h3 className="text-sm font-bold text-surface-900">চালানপত্রের পরিচয়</h3></div>
                        <div className="card-body grid grid-cols-1 sm:grid-cols-3 gap-4">
                            <div className="form-group !mb-0">
                                <label className="form-label">চালানপত্র নম্বর</label>
                                <input className="form-input" value={data.challan_no}
                                    onChange={(e) => setData('challan_no', e.target.value)} />
                                {err('challan_no') && <p className="form-error">{err('challan_no')}</p>}
                            </div>
                            <div className="form-group !mb-0">
                                <label className="form-label">ইস্যুর তারিখ</label>
                                <input type="date" className="form-input" value={data.issue_date}
                                    onChange={(e) => setData('issue_date', e.target.value)} />
                            </div>
                            <div className="form-group !mb-0">
                                <label className="form-label">ইস্যুর সময়</label>
                                <input type="time" className="form-input" value={data.issue_time}
                                    onChange={(e) => setData('issue_time', e.target.value)} />
                                {err('issue_time') && <p className="form-error">{err('issue_time')}</p>}
                            </div>
                        </div>
                    </div>

                    {/* Supplier + buyer --------------------------------------- */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                        <div className="card">
                            <div className="card-header"><h3 className="text-sm font-bold text-surface-900">নিবন্ধিত ব্যক্তি (সরবরাহকারী)</h3></div>
                            <div className="card-body space-y-4">
                                <div className="form-group !mb-0">
                                    <label className="form-label">নিবন্ধিত ব্যক্তির নাম</label>
                                    <input className="form-input" value={data.supplier_name}
                                        onChange={(e) => setData('supplier_name', e.target.value)} />
                                </div>
                                <div className="form-group !mb-0">
                                    <label className="form-label">নিবন্ধিত ব্যক্তির বিআইএন</label>
                                    <input className="form-input" value={data.supplier_bin}
                                        onChange={(e) => setData('supplier_bin', e.target.value)} />
                                    {!supplier?.bin && (
                                        <p className="form-hint text-amber-700">
                                            This centre has no BIN on record — set it once under Admin → Centers.
                                        </p>
                                    )}
                                </div>
                                <div className="form-group !mb-0">
                                    <label className="form-label">চালানপত্র ইস্যুর ঠিকানা</label>
                                    <textarea className="form-textarea" rows={3} value={data.supplier_address}
                                        onChange={(e) => setData('supplier_address', e.target.value)} />
                                </div>
                            </div>
                        </div>

                        <div className="card">
                            <div className="card-header"><h3 className="text-sm font-bold text-surface-900">ক্রেতা</h3></div>
                            <div className="card-body space-y-4">
                                <div className="form-group !mb-0">
                                    <label className="form-label">ক্রেতার নাম <span className="text-red-500">*</span></label>
                                    <input className="form-input" value={data.buyer_name}
                                        onChange={(e) => setData('buyer_name', e.target.value)} />
                                    {err('buyer_name') && <p className="form-error">{err('buyer_name')}</p>}
                                </div>
                                <div className="form-group !mb-0">
                                    <label className="form-label">ক্রেতার বিআইএন <span className="form-label-optional">প্রযোজ্য ক্ষেত্রে</span></label>
                                    <input className="form-input" value={data.buyer_bin}
                                        onChange={(e) => setData('buyer_bin', e.target.value)} />
                                </div>
                                <div className="form-group !mb-0">
                                    <label className="form-label">ক্রেতার ঠিকানা</label>
                                    <textarea className="form-textarea" rows={3} value={data.buyer_address}
                                        onChange={(e) => setData('buyer_address', e.target.value)} />
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="card">
                        <div className="card-body grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="form-group !mb-0">
                                <label className="form-label">সরবরাহের গন্তব্যস্থল</label>
                                <input className="form-input" value={data.destination}
                                    onChange={(e) => setData('destination', e.target.value)} />
                            </div>
                            <div className="form-group !mb-0">
                                <label className="form-label">যানবাহনের প্রকৃতি ও নম্বর</label>
                                <input className="form-input" value={data.vehicle}
                                    onChange={(e) => setData('vehicle', e.target.value)}
                                    placeholder="ট্রাক — ঢাকা মেট্রো-ট ১১-১১১১" />
                            </div>
                        </div>
                    </div>

                    {/* The eleven columns ------------------------------------- */}
                    <div className="card">
                        <div className="card-header flex items-center justify-between">
                            <h3 className="text-sm font-bold text-surface-900">পণ্য বা সেবার বিবরণ</h3>
                            <button type="button" onClick={addLine} className="btn-outline btn-sm">
                                <i className="fi fi-rr-plus text-xs leading-none" /> Add line
                            </button>
                        </div>
                        <div className="card-body p-0 overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b border-surface-100 text-[10px] uppercase tracking-wider text-surface-500 font-bold">
                                        <th className="text-left px-3 py-2">বর্ণনা</th>
                                        <th className="text-left px-2 py-2 w-20">একক</th>
                                        <th className="text-right px-2 py-2 w-24">পরিমাণ</th>
                                        <th className="text-right px-2 py-2 w-28">একক মূল্য</th>
                                        <th className="text-right px-2 py-2 w-28">মোট মূল্য</th>
                                        <th className="text-right px-2 py-2 w-20">সম্পূরক %</th>
                                        <th className="text-right px-2 py-2 w-20">মূসক %</th>
                                        <th className="text-right px-2 py-2 w-28">মূসক</th>
                                        <th className="text-right px-3 py-2 w-32">করসহ মূল্য</th>
                                        <th className="w-10" />
                                    </tr>
                                </thead>
                                <tbody>
                                    {data.items.map((l: Line, i: number) => {
                                        const c = compute(l);
                                        return (
                                            <tr key={i} className="border-b border-surface-50 align-top">
                                                <td className="px-3 py-2">
                                                    <textarea rows={2} className="form-textarea text-sm py-1.5"
                                                        value={l.description} onChange={(e) => setLine(i, 'description', e.target.value)} />
                                                    {err(`items.${i}.description`) && <p className="form-error">{err(`items.${i}.description`)}</p>}
                                                </td>
                                                <td className="px-2 py-2">
                                                    <input className="form-input text-sm py-1.5" value={l.unit}
                                                        onChange={(e) => setLine(i, 'unit', e.target.value)} />
                                                </td>
                                                <td className="px-2 py-2">
                                                    <input type="number" step="0.001" className="form-input text-sm py-1.5 text-right"
                                                        value={l.quantity} onChange={(e) => setLine(i, 'quantity', e.target.value)} />
                                                </td>
                                                <td className="px-2 py-2">
                                                    <input type="number" step="0.01" className="form-input text-sm py-1.5 text-right"
                                                        value={l.unit_price} onChange={(e) => setLine(i, 'unit_price', e.target.value)} />
                                                </td>
                                                <td className="px-2 py-2 text-right tabular-nums text-surface-700">{money(c.value)}</td>
                                                <td className="px-2 py-2">
                                                    <input type="number" step="0.01" className="form-input text-sm py-1.5 text-right"
                                                        value={l.sd_rate} onChange={(e) => setLine(i, 'sd_rate', e.target.value)} />
                                                </td>
                                                <td className="px-2 py-2">
                                                    <input type="number" step="0.01" className="form-input text-sm py-1.5 text-right"
                                                        value={l.vat_rate} onChange={(e) => setLine(i, 'vat_rate', e.target.value)} />
                                                </td>
                                                <td className="px-2 py-2 text-right tabular-nums text-surface-700">{money(c.vat)}</td>
                                                <td className="px-3 py-2 text-right tabular-nums font-semibold text-surface-900">{money(c.incl)}</td>
                                                <td className="px-1 py-2">
                                                    {data.items.length > 1 && (
                                                        <button type="button" onClick={() => removeLine(i)}
                                                            className="w-7 h-7 inline-flex items-center justify-center rounded-lg text-red-500 hover:bg-red-50">
                                                            <i className="fi fi-rr-cross-small text-sm leading-none" />
                                                        </button>
                                                    )}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                                <tfoot>
                                    <tr className="bg-surface-50 font-bold text-surface-900">
                                        <td colSpan={4} className="px-3 py-2.5 text-right">সর্বমোট</td>
                                        <td className="px-2 py-2.5 text-right tabular-nums">{money(totals.value)}</td>
                                        <td />
                                        <td />
                                        <td className="px-2 py-2.5 text-right tabular-nums">{money(totals.vat)}</td>
                                        <td className="px-3 py-2.5 text-right tabular-nums">{money(totals.incl)}</td>
                                        <td />
                                    </tr>
                                </tfoot>
                            </table>
                        </div>
                        {typeof errors.items === 'string' && <p className="form-error px-4 pb-3">{errors.items}</p>}
                        <div className="px-4 pb-4 text-[11px] text-surface-400">
                            একক মূল্য is <strong>সকল প্রকার কর ব্যতীত</strong> — the price before any duty or tax.
                        </div>
                    </div>

                    {/* Signatory ---------------------------------------------- */}
                    <div className="card">
                        <div className="card-header"><h3 className="text-sm font-bold text-surface-900">প্রতিষ্ঠান কর্তৃপক্ষের দায়িত্বপ্রাপ্ত ব্যক্তি</h3></div>
                        <div className="card-body">
                            <div className="form-group !mb-0">
                                <label className="form-label">নাম ও পদবি</label>
                                <select className="form-input" value={data.signatory_user_id}
                                    onChange={(e) => setData('signatory_user_id', e.target.value)}>
                                    <option value="">— Select —</option>
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

                            <div className="form-group !mb-0 mt-4">
                                <label className="form-label">Note <span className="form-label-optional">Optional</span></label>
                                <textarea className="form-textarea" rows={2} value={data.note}
                                    onChange={(e) => setData('note', e.target.value)} />
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center justify-end gap-2.5">
                        <Link href="/musak-challans" className="btn-ghost">Cancel</Link>
                        <button type="submit" disabled={processing} className="btn-outline">
                            {isEdit ? 'Save changes' : 'Save as draft'}
                        </button>
                        <button type="button" disabled={processing} onClick={(e) => submit(e, true)} className="btn-primary">
                            <i className="fi fi-rr-stamp text-xs leading-none" /> ইস্যু করুন
                        </button>
                    </div>
                </form>
            </div>
        </AppLayout>
    );
}
