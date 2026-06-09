import { Link, useForm, usePage } from '@inertiajs/react';
import { FormEvent } from 'react';

const TYPE_OPTIONS = [
    { value: 'student',       label: 'Student',                description: 'School / college / university student seeking academic or project assistance.' },
    { value: 'consultancy',   label: 'Consultancy Seeker',     description: 'Individual or business looking for technical advice on a problem.' },
    { value: 'organization',  label: 'Organization / Institute', description: 'Public or private organization seeking technical support.' },
];

const MODE_OPTIONS = [
    { value: 'in_person', label: 'In-person at BITAC', icon: 'fi-rr-building' },
    { value: 'online',    label: 'Online meeting',     icon: 'fi-rr-video-camera-alt' },
    { value: 'written',   label: 'Written response',   icon: 'fi-rr-envelope' },
];

export default function ConsultancyRequest() {
    const { props } = usePage<any>();
    const theme = (props.appSettings ?? {}) as { logo_url?: string | null; brand_name?: string };
    const brandName = theme.brand_name || 'BITAC';

    const { data, setData, post, processing, errors } = useForm<any>({
        requester_type:       '',
        requester_name:       '',
        requester_email:      '',
        requester_phone:      '',
        organization_name:    '',
        designation_or_year:  '',
        subject:              '',
        description:          '',
        preferred_mode:       '',
        attachment:           null as File | null,
        website:              '', // honeypot — must stay empty
    });

    const submit = (e: FormEvent) => {
        e.preventDefault();
        post('/consultancy/request', { forceFormData: true });
    };

    const errorKeys = Object.keys(errors as any);

    return (
        <div className="min-h-screen bg-gradient-to-br from-surface-50 via-surface-100 to-surface-50">
            {/* Top brand strip */}
            <div className="bg-white border-b border-surface-100">
                <div className="max-w-4xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
                    <Link href="/" className="flex items-center gap-3">
                        {theme.logo_url ? (
                            <img src={theme.logo_url} alt={brandName} className="w-11 h-11 object-contain" />
                        ) : (
                            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-brand-400 to-brand-600 text-white flex items-center justify-center shadow-md">
                                <span className="font-bold text-base">B</span>
                            </div>
                        )}
                        <div className="leading-tight">
                            <p className="font-bold text-surface-900 text-[15px]">{brandName}</p>
                            <p className="text-[11px] text-surface-400">Bangladesh Industrial Technical Assistance Centre</p>
                        </div>
                    </Link>
                    <Link href="/portfolio" target="_blank" className="text-xs font-semibold text-surface-500 hover:text-brand-600 hidden sm:inline-flex items-center gap-1">
                        Our Work <i className="fi fi-rr-arrow-up-right-from-square text-[9px] leading-none" />
                    </Link>
                </div>
            </div>

            <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
                {/* Intro */}
                <div className="text-center mb-8">
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-50 text-indigo-700 text-xs font-bold uppercase tracking-wider mb-3">
                        <i className="fi fi-rr-graduation-cap text-xs leading-none" /> Consultancy & Student Assistance
                    </div>
                    <h1 className="text-2xl sm:text-3xl font-bold text-surface-900">Request Free Technical Assistance</h1>
                    <p className="text-sm text-surface-500 mt-2 max-w-xl mx-auto">
                        BITAC offers limited pro-bono consultancy and student-assistance support as part of our public-service mandate.
                        Submit your request below and our IED team will respond within <strong>5-7 working days</strong>.
                    </p>
                </div>

                {/* Form card */}
                <form onSubmit={submit} className="card overflow-hidden">
                    {/* Honeypot — hidden from real users */}
                    <input type="text" name="website" value={data.website}
                        onChange={e => setData('website', e.target.value)}
                        tabIndex={-1} autoComplete="off"
                        style={{ position: 'absolute', left: '-9999px', width: '1px', height: '1px' }} />

                    {errorKeys.length > 0 && (
                        <div className="bg-rose-50 border-b border-rose-200 px-5 py-3">
                            <div className="flex items-start gap-2">
                                <i className="fi fi-rr-exclamation text-rose-600 mt-0.5 text-base leading-none" />
                                <div>
                                    <p className="text-sm font-semibold text-rose-800">Please fix the following:</p>
                                    <ul className="text-xs text-rose-700 mt-1 space-y-0.5 list-disc list-inside">
                                        {errorKeys.map(k => <li key={k}>{(errors as any)[k]}</li>)}
                                    </ul>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Section 1: Requester type */}
                    <div className="px-5 sm:px-7 py-5 border-b border-surface-100">
                        <h2 className="text-sm font-bold text-surface-900 mb-3">1. Who are you?</h2>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                            {TYPE_OPTIONS.map(t => (
                                <button key={t.value} type="button"
                                    onClick={() => setData('requester_type', t.value)}
                                    className={`text-left p-3 rounded-xl border-2 transition-all
                                        ${data.requester_type === t.value
                                            ? 'border-brand-500 bg-brand-50/50'
                                            : 'border-surface-200 hover:border-surface-300 bg-white'}`}>
                                    <div className="font-bold text-sm text-surface-900">{t.label}</div>
                                    <div className="text-[11px] text-surface-500 mt-1 leading-snug">{t.description}</div>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Section 2: Contact */}
                    <div className="px-5 sm:px-7 py-5 border-b border-surface-100">
                        <h2 className="text-sm font-bold text-surface-900 mb-3">2. Contact details</h2>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="form-group">
                                <label className="form-label">Full Name <span className="text-red-500">*</span></label>
                                <input type="text" value={data.requester_name}
                                    onChange={e => setData('requester_name', e.target.value)}
                                    className="form-input" placeholder="Md. Rahim Uddin" required />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Email <span className="text-red-500">*</span></label>
                                <input type="email" value={data.requester_email}
                                    onChange={e => setData('requester_email', e.target.value)}
                                    className="form-input" placeholder="you@example.com" required />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Phone <span className="text-red-500">*</span></label>
                                <input type="tel" value={data.requester_phone}
                                    onChange={e => setData('requester_phone', e.target.value)}
                                    className="form-input" placeholder="01XXX-XXXXXX" required />
                            </div>
                            <div className="form-group">
                                <label className="form-label">
                                    {data.requester_type === 'student' ? 'Institution / University' : 'Organization / Company'}
                                </label>
                                <input type="text" value={data.organization_name}
                                    onChange={e => setData('organization_name', e.target.value)}
                                    className="form-input"
                                    placeholder={data.requester_type === 'student' ? 'BUET, RUET, etc.' : 'ACI Motors Ltd.'} />
                            </div>
                            <div className="form-group sm:col-span-2">
                                <label className="form-label">
                                    {data.requester_type === 'student' ? 'Year of study / department' : 'Designation'}
                                </label>
                                <input type="text" value={data.designation_or_year}
                                    onChange={e => setData('designation_or_year', e.target.value)}
                                    className="form-input"
                                    placeholder={data.requester_type === 'student' ? 'e.g. BSc Mech 3rd year' : 'e.g. Production Engineer'} />
                            </div>
                        </div>
                    </div>

                    {/* Section 3: Request */}
                    <div className="px-5 sm:px-7 py-5 border-b border-surface-100">
                        <h2 className="text-sm font-bold text-surface-900 mb-3">3. Your request</h2>
                        <div className="space-y-4">
                            <div className="form-group">
                                <label className="form-label">Subject <span className="text-red-500">*</span></label>
                                <input type="text" value={data.subject}
                                    onChange={e => setData('subject', e.target.value)}
                                    className="form-input" maxLength={200}
                                    placeholder="Short title for your request" required />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Description <span className="text-red-500">*</span></label>
                                <textarea value={data.description}
                                    onChange={e => setData('description', e.target.value)}
                                    rows={6} maxLength={5000}
                                    placeholder="Please describe your problem or request in detail — what kind of assistance are you looking for, what have you tried, what's the context?"
                                    className="form-textarea" required />
                                <p className="text-[10px] text-surface-400 mt-1">{(data.description ?? '').length} / 5000</p>
                            </div>
                            <div className="form-group">
                                <label className="form-label">Preferred Mode of Help <span className="text-red-500">*</span></label>
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mt-1">
                                    {MODE_OPTIONS.map(m => (
                                        <button key={m.value} type="button"
                                            onClick={() => setData('preferred_mode', m.value)}
                                            className={`p-3 rounded-xl border-2 transition-all flex items-center gap-2
                                                ${data.preferred_mode === m.value
                                                    ? 'border-brand-500 bg-brand-50/50'
                                                    : 'border-surface-200 hover:border-surface-300 bg-white'}`}>
                                            <i className={`fi ${m.icon} text-sm leading-none text-surface-600`} />
                                            <span className="text-xs font-semibold text-surface-700">{m.label}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <div className="form-group">
                                <label className="form-label">Attachment <span className="form-label-optional">optional</span></label>
                                <input type="file"
                                    accept=".pdf,.jpg,.jpeg,.png"
                                    onChange={e => setData('attachment', e.target.files?.[0] ?? null)}
                                    className="block w-full text-sm text-surface-500
                                        file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0
                                        file:text-xs file:font-semibold file:bg-indigo-50 file:text-indigo-700
                                        hover:file:bg-indigo-100 file:cursor-pointer" />
                                <p className="text-[10px] text-surface-400 mt-1">PDF / JPG / PNG. Max 5 MB.</p>
                                {data.attachment && (
                                    <p className="text-[11px] text-emerald-700 mt-1">
                                        <i className="fi fi-rr-check text-[10px] leading-none mr-1" />{data.attachment.name}
                                    </p>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Submit */}
                    <div className="px-5 sm:px-7 py-5 bg-surface-50/40">
                        <button type="submit" disabled={processing || !data.requester_type || !data.preferred_mode}
                            className="btn-primary w-full sm:w-auto">
                            {processing
                                ? <><i className="fi fi-rr-spinner animate-spin text-sm" /> Submitting…</>
                                : <><i className="fi fi-rr-paper-plane text-sm" /> Submit Request</>}
                        </button>
                        <p className="text-[11px] text-surface-400 mt-3">
                            By submitting, you consent to BITAC contacting you via the details provided. We respond to all eligible requests within 5-7 working days.
                        </p>
                    </div>
                </form>
            </div>

            {/* Footer */}
            <footer className="bg-white border-t border-surface-100 mt-8">
                <div className="max-w-4xl mx-auto px-4 sm:px-6 py-5 text-xs text-surface-500 text-center">
                    &copy; {new Date().getFullYear()} <span className="font-semibold text-surface-700">Bangladesh Industrial Technical Assistance Centre</span> · Ministry of Industries, GoB
                </div>
            </footer>
        </div>
    );
}
