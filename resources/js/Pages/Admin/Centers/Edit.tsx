import AppLayout from '@/Layouts/AppLayout';
import { Link, useForm } from '@inertiajs/react';
import { FormEvent, useState } from 'react';

interface Center {
    id: number;
    name: string;
    code: string;
    address?: string | null;
    phone?: string | null;
    email?: string | null;
    is_active: boolean;
    name_bn?: string | null;
    caption_en?: string | null;
    ministry_bn?: string | null;
    government_bn?: string | null;
    address_bn?: string | null;
    phone_bn?: string | null;
    fax_bn?: string | null;
    website?: string | null;
    letterhead_color?: string | null;
    logo_left_url?: string | null;
    logo_right_url?: string | null;
}

export default function CenterEdit({ center }: { center: Center }) {
    const [leftPreview,  setLeftPreview]  = useState<string | null>(center.logo_left_url  ?? null);
    const [rightPreview, setRightPreview] = useState<string | null>(center.logo_right_url ?? null);

    const { data, setData, post, processing, errors, transform } = useForm<any>({
        name:              center.name             ?? '',
        code:              center.code             ?? '',
        address:           center.address          ?? '',
        phone:             center.phone            ?? '',
        email:             center.email            ?? '',
        is_active:         center.is_active,
        name_bn:           center.name_bn          ?? '',
        caption_en:        center.caption_en       ?? '',
        ministry_bn:       center.ministry_bn      ?? '',
        government_bn:     center.government_bn    ?? '',
        address_bn:        center.address_bn       ?? '',
        phone_bn:          center.phone_bn         ?? '',
        fax_bn:            center.fax_bn           ?? '',
        website:           center.website          ?? '',
        letterhead_color:  center.letterhead_color ?? '#1e40af',
        logo_left:         null as File | null,
        logo_right:        null as File | null,
        remove_logo_left:  false,
        remove_logo_right: false,
    });

    const handleFile = (side: 'left' | 'right', file: File | null) => {
        if (side === 'left') {
            setData('logo_left', file);
            setData('remove_logo_left', false);
            setLeftPreview(file ? URL.createObjectURL(file) : center.logo_left_url ?? null);
        } else {
            setData('logo_right', file);
            setData('remove_logo_right', false);
            setRightPreview(file ? URL.createObjectURL(file) : center.logo_right_url ?? null);
        }
    };

    const removeLogo = (side: 'left' | 'right') => {
        if (side === 'left')  { setData('remove_logo_left',  true); setData('logo_left',  null); setLeftPreview(null);  }
        else                  { setData('remove_logo_right', true); setData('logo_right', null); setRightPreview(null); }
    };

    const submit = (e: FormEvent) => {
        e.preventDefault();
        post(`/admin/centers/${center.id}`, { forceFormData: true });
    };

    return (
        <AppLayout header={`Edit Center · ${center.name}`}>
            <form onSubmit={submit} className="space-y-6 animate-fade-in max-w-5xl">
                <div className="page-header">
                    <div>
                        <h1 className="page-title">{center.name}</h1>
                        <p className="page-subtitle">Center info and PDF letterhead configuration.</p>
                    </div>
                    <Link href="/admin/centers" className="btn-ghost btn-sm">
                        <i className="fi fi-rr-arrow-left text-xs leading-none" /> Back
                    </Link>
                </div>

                {/* ─── Basic info ─── */}
                <div className="card">
                    <div className="card-header">
                        <h3 className="text-sm font-bold text-surface-900">Basic Information</h3>
                    </div>
                    <div className="card-body grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <Field label="Center name *" error={errors.name}>
                            <input className="form-input" value={data.name} onChange={e => setData('name', e.target.value)} />
                        </Field>
                        <Field label="Short code *" error={errors.code}>
                            <input className="form-input font-mono uppercase" value={data.code} onChange={e => setData('code', e.target.value.toUpperCase())} />
                        </Field>
                        <Field label="Address (English)" error={errors.address}>
                            <input className="form-input" value={data.address} onChange={e => setData('address', e.target.value)} />
                        </Field>
                        <Field label="Phone" error={errors.phone}>
                            <input className="form-input" value={data.phone} onChange={e => setData('phone', e.target.value)} />
                        </Field>
                        <Field label="Email" error={errors.email}>
                            <input type="email" className="form-input" value={data.email} onChange={e => setData('email', e.target.value)} />
                        </Field>
                        <Field label="Status">
                            <label className="inline-flex items-center gap-2 mt-2">
                                <input type="checkbox" checked={!!data.is_active} onChange={e => setData('is_active', e.target.checked)} />
                                <span className="text-sm">Active</span>
                            </label>
                        </Field>
                    </div>
                </div>

                {/* ─── Letterhead text ─── */}
                <div className="card">
                    <div className="card-header flex items-center justify-between">
                        <div>
                            <h3 className="text-sm font-bold text-surface-900">PDF Letterhead — Text</h3>
                            <p className="text-xs text-surface-400 mt-0.5">Shown at the top + bottom of every PDF this center generates. Bangla text uses Siyam Rupali; English uses DejaVu Sans.</p>
                        </div>
                    </div>
                    <div className="card-body space-y-4">
                        <Field label="English caption (italic small text above the Bangla name)" error={errors.caption_en}>
                            <input className="form-input" value={data.caption_en} onChange={e => setData('caption_en', e.target.value)} placeholder="BITAC – A Center of Excellence" />
                        </Field>
                        <Field label="Center name in Bangla *" error={errors.name_bn} hint="The big bold line in the header.">
                            <input className="form-input" style={{ fontFamily: 'SiyamRupali, sans-serif', fontSize: '15px' }} value={data.name_bn} onChange={e => setData('name_bn', e.target.value)} placeholder="বাংলাদেশ শিল্প কারিগরি সহায়তা কেন্দ্র (বিটাক)" />
                        </Field>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <Field label="Ministry (Bangla)" error={errors.ministry_bn}>
                                <input className="form-input" style={{ fontFamily: 'SiyamRupali, sans-serif' }} value={data.ministry_bn} onChange={e => setData('ministry_bn', e.target.value)} placeholder="শিল্প মন্ত্রণালয়" />
                            </Field>
                            <Field label="Government tag (Bangla)" error={errors.government_bn}>
                                <input className="form-input" style={{ fontFamily: 'SiyamRupali, sans-serif' }} value={data.government_bn} onChange={e => setData('government_bn', e.target.value)} placeholder="গণপ্রজাতন্ত্রী বাংলাদেশ সরকার" />
                            </Field>
                        </div>
                        <Field label="Footer address (Bangla)" error={errors.address_bn}>
                            <input className="form-input" style={{ fontFamily: 'SiyamRupali, sans-serif' }} value={data.address_bn} onChange={e => setData('address_bn', e.target.value)} placeholder="বিটাক, ১১৬ (খ), তেজগাঁও শিল্প এলাকা, ঢাকা-১২০৪।" />
                        </Field>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                            <Field label="Phone (Bangla numerals)" error={errors.phone_bn}>
                                <input className="form-input" style={{ fontFamily: 'SiyamRupali, sans-serif' }} value={data.phone_bn} onChange={e => setData('phone_bn', e.target.value)} placeholder="৮৮৭০২৬৬, ৮৮৭০৬৮০" />
                            </Field>
                            <Field label="Fax (Bangla numerals)" error={errors.fax_bn}>
                                <input className="form-input" style={{ fontFamily: 'SiyamRupali, sans-serif' }} value={data.fax_bn} onChange={e => setData('fax_bn', e.target.value)} placeholder="০২-৮৮৭০৭২৮" />
                            </Field>
                            <Field label="Website" error={errors.website}>
                                <input className="form-input font-mono" value={data.website} onChange={e => setData('website', e.target.value)} placeholder="www.bitac.gov.bd" />
                            </Field>
                        </div>
                        <Field label="Letterhead accent color" error={errors.letterhead_color} hint="Used for the header/footer separator lines and English caption.">
                            <div className="flex items-center gap-2">
                                <input type="color" value={data.letterhead_color} onChange={e => setData('letterhead_color', e.target.value)} className="w-12 h-9 rounded border border-surface-200 cursor-pointer" />
                                <input className="form-input font-mono w-32" value={data.letterhead_color} onChange={e => setData('letterhead_color', e.target.value)} />
                            </div>
                        </Field>
                    </div>
                </div>

                {/* ─── Logos ─── */}
                <div className="card">
                    <div className="card-header">
                        <h3 className="text-sm font-bold text-surface-900">PDF Letterhead — Logos</h3>
                        <p className="text-xs text-surface-400 mt-0.5">Two logos shown at left and right of the header. Transparent PNG recommended, ~200×200 px or larger.</p>
                    </div>
                    <div className="card-body grid grid-cols-1 sm:grid-cols-2 gap-6">
                        <LogoSlot
                            label="Left logo (Center / BITAC)"
                            previewUrl={leftPreview}
                            onPick={file => handleFile('left', file)}
                            onRemove={() => removeLogo('left')}
                        />
                        <LogoSlot
                            label="Right logo (Government seal)"
                            previewUrl={rightPreview}
                            onPick={file => handleFile('right', file)}
                            onRemove={() => removeLogo('right')}
                        />
                    </div>
                </div>

                {/* ─── Submit ─── */}
                <div className="flex items-center justify-end gap-3">
                    <Link href="/admin/centers" className="btn-ghost">Cancel</Link>
                    <button type="submit" disabled={processing} className="btn-primary">
                        <i className="fi fi-rr-disk text-xs leading-none" />
                        {processing ? 'Saving...' : 'Save Center'}
                    </button>
                </div>
            </form>
        </AppLayout>
    );
}

function Field({ label, error, hint, children }: { label: string; error?: string; hint?: string; children: React.ReactNode }) {
    return (
        <div className="form-group">
            <label className="form-label">{label}</label>
            {children}
            {hint  && <p className="text-[11px] text-surface-400 mt-1">{hint}</p>}
            {error && <p className="form-error">{error}</p>}
        </div>
    );
}

function LogoSlot({ label, previewUrl, onPick, onRemove }: {
    label: string;
    previewUrl: string | null;
    onPick:   (file: File | null) => void;
    onRemove: () => void;
}) {
    return (
        <div>
            <label className="form-label">{label}</label>
            <div className="flex items-start gap-4">
                <div className="w-24 h-24 rounded-xl border-2 border-dashed border-surface-200 flex items-center justify-center bg-surface-50 shrink-0">
                    {previewUrl ? (
                        <img src={previewUrl} alt="" className="max-w-full max-h-full object-contain p-2" />
                    ) : (
                        <span className="text-[10px] text-surface-400">No logo</span>
                    )}
                </div>
                <div className="flex-1 space-y-2">
                    <input
                        type="file"
                        accept="image/png,image/jpeg,image/webp,image/svg+xml"
                        onChange={e => onPick(e.target.files?.[0] ?? null)}
                        className="text-xs file:mr-2 file:px-3 file:py-1.5 file:rounded-md file:border-0 file:text-[11px] file:font-semibold file:bg-brand-50 file:text-brand-700 hover:file:bg-brand-100 w-full"
                    />
                    {previewUrl && (
                        <button type="button" onClick={onRemove}
                            className="text-[11px] text-red-600 hover:text-red-700 font-semibold">
                            Remove current logo
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}
