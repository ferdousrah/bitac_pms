import { FormEvent, ReactNode, useMemo, useRef, useState } from 'react';
import { Link, useForm } from '@inertiajs/react';
import PublicLayout, { BitacInfo, SiteLinkRow } from '@/Layouts/PublicLayout';
import { PageHead, Section } from './parts';

interface OfficeOption {
    id: number;
    slug: string;
    name: string;
    phone: string | null;
    email: string | null;
    is_head_office: boolean;
}

interface Props {
    offices: OfficeOption[];
    bitac: BitacInfo;
    links: Record<string, SiteLinkRow[]>;
    form_token: string;
    file_ext: string[];
    max_files: number;
    max_mb: number;
    submitted: string | null;
    submitted_email: string | null;
}

/**
 * "Request a quotation" — the public form behind Contact → Want a quotation?
 *
 * Flat like the Contact page (BITAC: no shadows or text effects). What is sent
 * lands in IED → Quote Requests, NOT straight in as an RFQ: IED reads it and
 * converts it into a draft RFQ against a real customer.
 */
const BN = '০১২৩৪৫৬৭৮৯';
function telHref(n: string): string {
    return 'tel:' + n.replace(/[০-৯]/g, (d) => String(BN.indexOf(d))).replace(/[^\d+]/g, '');
}
const firstNumber = (v?: string | null) => (v ?? '').split(/[,;]/)[0]?.trim() || '';

const field = 'w-full rounded-xl border border-surface-300 bg-white px-3.5 py-2.5 text-[15px] text-surface-900 placeholder:text-surface-400 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 focus:outline-none';

function fmtSize(b: number) {
    return b >= 1048576 ? `${(b / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`;
}

export default function RequestQuote(props: Props) {
    const { offices, bitac, links, submitted } = props;

    return (
        <PublicLayout title="Request a Quotation — BITAC" bitac={bitac} links={links}>
            <PageHead
                eyebrow="Request a quotation"
                title={submitted ? 'Thank you — your request has reached us' : 'Tell us what you need made'}
                lead={submitted
                    ? 'An engineer will study it and contact you. Keep the reference number below.'
                    : 'Describe the part or job, attach a drawing or photo if you have one, and choose the centre you would like to work with. BITAC prepares a costing and a formal quotation against it.'}
            />
            <Section tint>
                {submitted ? <Received {...props} /> : offices.length === 0 ? (
                    <p className="text-sm text-surface-600">
                        Requests can be sent once the offices are published — please <Link href="/portfolio/contact" className="text-brand-700 font-semibold hover:underline">contact us</Link> in the meantime.
                    </p>
                ) : <RequestForm {...props} />}
            </Section>
        </PublicLayout>
    );
}

function RequestForm({ offices, form_token, file_ext, max_files, max_mb }: Props) {
    const initialOffice = useMemo(() => {
        const hash = typeof window !== 'undefined' ? decodeURIComponent(window.location.hash.replace('#', '')) : '';
        return (offices.find((o) => o.slug === hash) ?? offices.find((o) => o.is_head_office) ?? offices[0]).id;
    }, [offices]);

    const { data, setData, post, processing, errors, transform } = useForm({
        site_office_id: initialOffice as number,
        name: '', organisation: '', designation: '', email: '', phone: '', address: '',
        subject: '', description: '', quantity: '', unit: 'pcs', needed_by: '',
        files: [] as File[],
        website: '',            // honeypot — hidden from people
        form_token,
    });
    const [fileError, setFileError] = useState<string | null>(null);
    const [dragging, setDragging] = useState(false);
    const input = useRef<HTMLInputElement | null>(null);

    const office = offices.find((o) => o.id === data.site_office_id) ?? offices[0];
    const today = new Date().toISOString().slice(0, 10);
    const errs = errors as Record<string, string | undefined>;
    const fileErrs = Object.entries(errs).filter(([k]) => k === 'files' || k.startsWith('files.')).map(([, v]) => v);

    const addFiles = (list: FileList | null) => {
        if (!list) return;
        const next = [...data.files];
        const problems: string[] = [];
        for (const f of Array.from(list)) {
            const ext = f.name.split('.').pop()?.toLowerCase() ?? '';
            if (!file_ext.includes(ext)) { problems.push(`${f.name}: this type of file is not accepted.`); continue; }
            if (f.size > max_mb * 1048576) { problems.push(`${f.name}: larger than ${max_mb} MB.`); continue; }
            if (next.length >= max_files) { problems.push(`Only ${max_files} files can be attached.`); break; }
            if (next.some((x) => x.name === f.name && x.size === f.size)) continue;
            next.push(f);
        }
        setData('files', next);
        setFileError(problems.length ? problems.join(' ') : null);
        if (input.current) input.current.value = '';
    };

    const submit = (e: FormEvent) => {
        e.preventDefault();
        transform((d) => ({ ...d, quantity: d.quantity === '' ? null : d.quantity }));
        post('/portfolio/request-quotation', {
            forceFormData: true,
            preserveScroll: (page) => Object.keys(page.props.errors ?? {}).length > 0,
            onError: () => {
                // Bring the first problem into view — on a phone it is often off-screen.
                requestAnimationFrame(() => document.querySelector('[data-error="1"]')?.scrollIntoView({ behavior: 'smooth', block: 'center' }));
            },
        });
    };

    return (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            <form onSubmit={submit} noValidate className="lg:col-span-8 rounded-3xl border border-surface-200 bg-white">
                {errs.general && (
                    <div data-error="1" className="m-6 mb-0 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{errs.general}</div>
                )}

                {/* Honeypot. Off-screen rather than display:none, which some scripts skip. */}
                <div aria-hidden="true" className="absolute -left-[9999px] w-px h-px overflow-hidden">
                    <label>Website <input type="text" name="website" tabIndex={-1} autoComplete="off"
                        value={data.website} onChange={(e) => setData('website', e.target.value)} /></label>
                </div>

                <Block n={1} title="Which centre should quote?" hint="The one nearest you, or the one you already work with.">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {offices.map((o) => {
                            const on = o.id === data.site_office_id;
                            return (
                                <button key={o.id} type="button" onClick={() => setData('site_office_id', o.id)} aria-pressed={on}
                                    className={`text-left rounded-xl border px-4 py-3 transition-colors ${
                                        on ? 'border-brand-600 bg-brand-50 ring-1 ring-brand-600' : 'border-surface-200 hover:border-surface-400'
                                    }`}>
                                    <span className="flex items-center gap-2.5">
                                        <span className={`w-4 h-4 rounded-full border-2 shrink-0 flex items-center justify-center ${on ? 'border-brand-600' : 'border-surface-300'}`}>
                                            {on && <span className="w-2 h-2 rounded-full bg-brand-600" />}
                                        </span>
                                        <span className="text-[15px] font-semibold text-surface-900 leading-snug">{o.name}</span>
                                    </span>
                                    {o.is_head_office && <span className="block ml-[26px] mt-0.5 text-xs text-surface-600">Head office</span>}
                                </button>
                            );
                        })}
                    </div>
                    <Err msg={errs.site_office_id} />
                </Block>

                <Block n={2} title="About you" hint="So that the engineer who prices the job can reach you.">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <Field label="Your name" required error={errs.name}>
                            <input className={field} value={data.name} onChange={(e) => setData('name', e.target.value)} autoComplete="name" maxLength={150} />
                        </Field>
                        <Field label="Organisation" error={errs.organisation}>
                            <input className={field} value={data.organisation} onChange={(e) => setData('organisation', e.target.value)} autoComplete="organization" maxLength={200} placeholder="Company, mill or department" />
                        </Field>
                        <Field label="Designation" error={errs.designation}>
                            <input className={field} value={data.designation} onChange={(e) => setData('designation', e.target.value)} autoComplete="organization-title" maxLength={150} />
                        </Field>
                        <Field label="Mobile / phone" required error={errs.phone}>
                            <input className={field} type="tel" value={data.phone} onChange={(e) => setData('phone', e.target.value)} autoComplete="tel" maxLength={40} placeholder="01XXXXXXXXX" />
                        </Field>
                        <Field label="Email" required error={errs.email} className="sm:col-span-2">
                            <input className={field} type="email" value={data.email} onChange={(e) => setData('email', e.target.value)} autoComplete="email" maxLength={150} placeholder="We send a copy of your request here" />
                        </Field>
                        <Field label="Address" error={errs.address} className="sm:col-span-2">
                            <textarea className={field} rows={2} value={data.address} onChange={(e) => setData('address', e.target.value)} autoComplete="street-address" maxLength={500} />
                        </Field>
                    </div>
                </Block>

                <Block n={3} title="The job" hint="The more you tell us — material, size, tolerance, finish — the closer the first price will be.">
                    <div className="grid grid-cols-1 sm:grid-cols-6 gap-4">
                        <Field label="What do you need?" required error={errs.subject} className="sm:col-span-6">
                            <input className={field} value={data.subject} onChange={(e) => setData('subject', e.target.value)} maxLength={200} placeholder="e.g. Spur gear for a sugar-mill gearbox" />
                        </Field>
                        <Field label="Description" required error={errs.description} className="sm:col-span-6">
                            <textarea className={field} rows={6} value={data.description} onChange={(e) => setData('description', e.target.value)} maxLength={5000}
                                placeholder="Material, dimensions, drawing number, heat treatment, finish, whether you can send a sample…" />
                            <span className="block text-right text-xs text-surface-500 mt-1 tabular-nums">{data.description.length} / 5000</span>
                        </Field>
                        <Field label="Quantity" error={errs.quantity} className="sm:col-span-2">
                            <input className={field} type="number" min={0} step="any" inputMode="decimal" value={data.quantity} onChange={(e) => setData('quantity', e.target.value)} />
                        </Field>
                        <Field label="Unit" error={errs.unit} className="sm:col-span-2">
                            <input className={field} list="quote-units" value={data.unit} onChange={(e) => setData('unit', e.target.value)} maxLength={30} />
                            <datalist id="quote-units">
                                {['pcs', 'nos', 'set', 'pair', 'kg', 'ton', 'meter', 'lot'].map((u) => <option key={u} value={u} />)}
                            </datalist>
                        </Field>
                        <Field label="Needed by" error={errs.needed_by} className="sm:col-span-2">
                            <input className={field} type="date" min={today} value={data.needed_by} onChange={(e) => setData('needed_by', e.target.value)} />
                        </Field>
                    </div>
                </Block>

                <Block n={4} title="Drawings, photos or specifications" hint={`Optional — up to ${max_files} files, ${max_mb} MB each. PDF, JPG, PNG, DWG, DXF, Word or Excel.`}>
                    <div
                        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
                        onDragLeave={() => setDragging(false)}
                        onDrop={(e) => { e.preventDefault(); setDragging(false); addFiles(e.dataTransfer.files); }}
                        className={`rounded-2xl border-2 border-dashed px-5 py-7 text-center transition-colors ${
                            dragging ? 'border-brand-500 bg-brand-50' : 'border-surface-300 bg-surface-50'
                        }`}>
                        <i className="fi fi-rr-cloud-upload text-2xl leading-none text-brand-600" />
                        <p className="text-[15px] text-surface-900 mt-2">
                            Drag files here, or{' '}
                            <button type="button" onClick={() => input.current?.click()} className="font-semibold text-brand-700 hover:underline">choose files</button>
                        </p>
                        <input ref={input} type="file" multiple className="hidden"
                            accept={file_ext.map((x) => `.${x}`).join(',')}
                            onChange={(e) => addFiles(e.target.files)} />
                    </div>
                    {data.files.length > 0 && (
                        <ul className="mt-3 divide-y divide-surface-200 rounded-xl border border-surface-200">
                            {data.files.map((f, i) => (
                                <li key={f.name + f.size} className="flex items-center gap-3 px-4 py-2.5">
                                    <i className="fi fi-rr-file text-sm leading-none text-surface-500" />
                                    <span className="flex-1 min-w-0 truncate text-sm text-surface-900">{f.name}</span>
                                    <span className="text-xs text-surface-500 tabular-nums shrink-0">{fmtSize(f.size)}</span>
                                    <button type="button" onClick={() => setData('files', data.files.filter((_, j) => j !== i))}
                                        className="shrink-0 w-7 h-7 rounded-lg text-surface-500 hover:text-rose-700 hover:bg-rose-50 flex items-center justify-center"
                                        aria-label={`Remove ${f.name}`}>
                                        <i className="fi fi-rr-cross-small text-sm leading-none" />
                                    </button>
                                </li>
                            ))}
                        </ul>
                    )}
                    <Err msg={fileError ?? fileErrs[0]} />
                </Block>

                <div className="px-6 sm:px-8 py-6 border-t border-surface-200 flex flex-col sm:flex-row sm:items-center gap-4">
                    <p className="text-xs text-surface-600 leading-relaxed flex-1">
                        Your details are used only to answer this request. Sending it does not commit you to anything.
                    </p>
                    <button type="submit" disabled={processing}
                        className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-brand-600 hover:bg-brand-700 disabled:opacity-60 text-white text-sm font-semibold transition-colors">
                        {processing
                            ? <><i className="fi fi-rr-spinner animate-spin text-xs leading-none" /> Sending…</>
                            : <><i className="fi fi-rr-paper-plane text-xs leading-none" /> Send request</>}
                    </button>
                </div>
            </form>

            <aside className="lg:col-span-4 lg:sticky lg:top-24 space-y-4">
                <div className="rounded-3xl border border-surface-200 bg-white p-6">
                    <h3 className="text-base font-bold text-surface-900">What happens next</h3>
                    <ol className="mt-4 space-y-4">
                        {[
                            ['You get a reference number', 'On screen straight away, and by email.'],
                            ['An engineer studies the job', 'We may call you for a drawing, a sample or a detail we need.'],
                            ['BITAC costs it', 'Material, machining and finishing, priced part by part.'],
                            ['You receive a formal quotation', 'On BITAC letterhead, from the centre you chose.'],
                        ].map(([t, d], i) => (
                            <li key={t} className="flex gap-3">
                                <span className="w-7 h-7 rounded-full bg-brand-50 text-brand-700 text-xs font-bold flex items-center justify-center shrink-0 tabular-nums">{i + 1}</span>
                                <span>
                                    <span className="block text-sm font-semibold text-surface-900">{t}</span>
                                    <span className="block text-sm text-surface-700 mt-0.5 leading-snug">{d}</span>
                                </span>
                            </li>
                        ))}
                    </ol>
                </div>

                {office && (firstNumber(office.phone) || office.email) && (
                    <div className="rounded-3xl border border-surface-200 bg-white p-6">
                        <h3 className="text-base font-bold text-surface-900">Rather talk first?</h3>
                        <p className="text-sm text-surface-700 mt-1">{office.name}</p>
                        <div className="mt-3 space-y-1.5">
                            {firstNumber(office.phone) && (
                                <a href={telHref(firstNumber(office.phone))} className="flex items-center gap-2 text-[15px] font-bold text-brand-700 hover:underline">
                                    <i className="fi fi-rr-phone-call text-xs leading-none" />{firstNumber(office.phone)}
                                </a>
                            )}
                            {office.email && (
                                <a href={`mailto:${office.email}`} className="flex items-center gap-2 text-sm text-surface-900 hover:text-brand-700 hover:underline break-all">
                                    <i className="fi fi-rr-envelope text-xs leading-none text-surface-500" />{office.email}
                                </a>
                            )}
                        </div>
                        <Link href={`/portfolio/contact#${office.slug}`} className="inline-block mt-4 text-sm font-semibold text-brand-700 hover:underline">
                            Everyone to contact at this centre →
                        </Link>
                    </div>
                )}
            </aside>
        </div>
    );
}

function Received({ submitted, submitted_email, offices }: Props) {
    const head = offices.find((o) => o.is_head_office) ?? offices[0];
    return (
        <div className="max-w-2xl mx-auto rounded-3xl border border-surface-200 bg-white p-8 sm:p-10 text-center">
            <span className="mx-auto w-14 h-14 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center">
                <i className="fi fi-rr-check text-2xl leading-none" />
            </span>
            <h2 className="text-2xl font-bold text-surface-900 mt-5">Request received</h2>
            <p className="text-[15px] text-surface-700 mt-2">Your reference number is</p>
            <div className="mt-2 inline-block rounded-xl border border-surface-300 bg-surface-50 px-5 py-2.5 font-mono text-xl font-bold text-surface-900 tracking-wide">
                {submitted}
            </div>
            <p className="text-sm text-surface-700 mt-5 leading-relaxed">
                {submitted_email
                    ? <>A copy has been sent to <span className="font-semibold text-surface-900 break-all">{submitted_email}</span>. If it does not arrive, keep this number — quote it whenever you contact us about this request.</>
                    : <>Please quote it whenever you contact us about this request.</>}
            </p>
            <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center">
                <Link href="/portfolio/request-quotation"
                    className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl border border-surface-300 hover:border-brand-400 hover:bg-brand-50 text-surface-800 text-sm font-semibold transition-colors">
                    <i className="fi fi-rr-add text-xs leading-none" /> Send another request
                </Link>
                <Link href="/portfolio"
                    className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-sm font-semibold transition-colors">
                    Back to the home page
                </Link>
            </div>
            {head && firstNumber(head.phone) && (
                <p className="text-xs text-surface-600 mt-6">
                    Urgent? Call {head.name} at{' '}
                    <a href={telHref(firstNumber(head.phone))} className="font-semibold text-brand-700 hover:underline">{firstNumber(head.phone)}</a>
                </p>
            )}
        </div>
    );
}

function Block({ n, title, hint, children }: { n: number; title: string; hint?: string; children: ReactNode }) {
    return (
        <fieldset className="px-6 sm:px-8 py-6 border-b border-surface-200 last-of-type:border-b-0">
            <legend className="sr-only">{title}</legend>
            <div className="flex items-start gap-3 mb-4">
                <span className="w-7 h-7 rounded-full bg-surface-900 text-white text-xs font-bold flex items-center justify-center shrink-0 tabular-nums">{n}</span>
                <div>
                    <h3 className="text-base font-bold text-surface-900 leading-7">{title}</h3>
                    {hint && <p className="text-sm text-surface-600 leading-snug">{hint}</p>}
                </div>
            </div>
            {children}
        </fieldset>
    );
}

function Field({ label, required = false, error, className = '', children }: {
    label: string; required?: boolean; error?: string; className?: string; children: ReactNode;
}) {
    return (
        <label className={`block ${className}`}>
            <span className="block text-sm font-semibold text-surface-800 mb-1.5">
                {label}{required && <span className="text-rose-600"> *</span>}
            </span>
            {children}
            <Err msg={error} />
        </label>
    );
}

function Err({ msg }: { msg?: string | null }) {
    return msg ? <span data-error="1" className="block text-sm text-rose-700 mt-1.5">{msg}</span> : null;
}
