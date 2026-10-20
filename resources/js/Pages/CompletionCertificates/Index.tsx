import AppLayout from '@/Layouts/AppLayout';
import { Link, router, useForm } from '@inertiajs/react';
import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';

/**
 * IED → Completion Certificates. A job's certificate comes either from the
 * client in the customer portal, or as the client's signed paper certificate
 * that IED scans and uploads here. Only IED uploads can be replaced/deleted.
 */
const SOURCE_LABEL: Record<string, string> = { customer: 'Client portal', ied: 'Uploaded by IED' };
const SOURCE_BADGE: Record<string, string> = {
    customer: 'bg-indigo-50 text-indigo-700 border-indigo-200',
    ied:      'bg-emerald-50 text-emerald-700 border-emerald-200',
};

interface Job {
    id: number; wo_number: string; job_number: string | null; customer: string | null;
    description: string | null; status: string; status_label: string; delivered: boolean;
}
interface Cert {
    id: number; certificate_number: string; wo_id: number; wo_number: string; product: string | null;
    customer: string | null; mode: string; source: string; uploaded_by: string | null;
    issued_by_name: string; issued_by_designation: string | null; issued_date: string | null; issued_date_raw: string | null;
    client_ref_no: string | null; remarks: string | null; rating: number | null; created_at: string; can_edit: boolean;
}

export default function CompletionCertificatesIndex({ certificates, filters, stats, canManage, jobs, uploadFor }: any) {
    const [search, setSearch] = useState(filters?.search ?? '');
    const [source, setSource] = useState(filters?.source ?? '');
    const [rating, setRating] = useState(filters?.rating ?? '');
    const [modal, setModal] = useState<{ cert?: Cert; jobId?: number } | null>(null);

    // `?upload=<work order>` (from IED → Jobs) opens the form on that job.
    useEffect(() => { if (canManage && uploadFor) setModal({ jobId: uploadFor }); }, [canManage, uploadFor]);

    const apply = (over: Record<string, string> = {}) =>
        router.get('/ied/completion-certificates', { search, source, rating, ...over }, { preserveState: true, replace: true });
    const reset = () => { setSearch(''); setSource(''); setRating(''); router.get('/ied/completion-certificates'); };

    const rows: Cert[] = certificates?.data ?? [];

    const destroy = (c: Cert) => {
        if (confirm(`Delete completion certificate ${c.certificate_number} for ${c.wo_number}?\n\nThe uploaded file is removed too.`)) {
            router.delete(`/ied/completion-certificates/${c.id}`, { preserveScroll: true });
        }
    };

    return (
        <AppLayout header="Completion Certificates">
            <div className="space-y-6 animate-fade-in">
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                    <Stat label="Total"          value={stats.total}       tone="indigo"  icon="fi-rr-diploma" />
                    <Stat label="From client"    value={stats.from_client} tone="purple"  icon="fi-rr-user" />
                    <Stat label="Uploaded by IED" value={stats.by_ied}     tone="emerald" icon="fi-rr-cloud-upload" />
                    <Stat label="Delivered, no certificate" value={stats.awaiting} tone="amber" icon="fi-rr-time-past" />
                    <Stat label="Avg rating"     value={stats.avg_rating ? `${stats.avg_rating} ★` : '—'} tone="slate" icon="fi-rr-star" />
                </div>

                <div className="card">
                    <div className="card-header flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                        <div>
                            <h2 className="text-sm font-bold text-surface-900">Job completion certificates</h2>
                            <p className="text-xs text-surface-500 mt-0.5">
                                Issued by the client in the customer portal, or the client&rsquo;s signed certificate uploaded by IED. One per job.
                            </p>
                        </div>
                        {canManage && (
                            <button onClick={() => setModal({})} className="btn-primary btn-sm shrink-0">
                                <i className="fi fi-rr-cloud-upload text-xs leading-none" /> Upload certificate
                            </button>
                        )}
                    </div>

                    <div className="card-body border-b border-surface-100 flex flex-wrap items-center gap-2">
                        <div className="relative flex-1 min-w-[200px]">
                            <i className="fi fi-rr-search absolute left-3 top-1/2 -translate-y-1/2 text-surface-400 text-xs leading-none" />
                            <input type="text" value={search} onChange={e => setSearch(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && apply()}
                                placeholder="Search certificate #, WO #, client, signed by…"
                                className="form-input pl-9 w-full" />
                        </div>
                        <select value={source} onChange={e => { setSource(e.target.value); apply({ source: e.target.value }); }} className="form-select w-auto">
                            <option value="">All sources</option>
                            <option value="customer">Client portal</option>
                            <option value="ied">Uploaded by IED</option>
                        </select>
                        <select value={rating} onChange={e => { setRating(e.target.value); apply({ rating: e.target.value }); }} className="form-select w-auto">
                            <option value="">All ratings</option>
                            {[5, 4, 3, 2, 1].map(r => <option key={r} value={r}>{r} ★</option>)}
                        </select>
                        <button onClick={() => apply()} className="btn-outline btn-sm">
                            <i className="fi fi-rr-search text-xs leading-none" /> Search
                        </button>
                        {(search || source || rating) && (
                            <button onClick={reset} className="btn-ghost btn-sm text-surface-500">
                                <i className="fi fi-rr-refresh text-xs leading-none" /> Reset
                            </button>
                        )}
                    </div>

                    <div className="card-body p-0 overflow-x-auto">
                        <table className="premium-table">
                            <thead>
                                <tr>
                                    <th>Certificate</th>
                                    <th>Job</th>
                                    <th>Client</th>
                                    <th>Signed by</th>
                                    <th>Source</th>
                                    <th className="text-center">Rating</th>
                                    <th>Date</th>
                                    <th className="text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {rows.map(c => (
                                    <tr key={c.id}>
                                        <td>
                                            <span className="font-mono text-xs font-bold text-indigo-600">{c.certificate_number}</span>
                                            {c.client_ref_no && <div className="text-[10px] text-surface-500 mt-0.5">Client ref: {c.client_ref_no}</div>}
                                        </td>
                                        <td>
                                            <Link href={`/ied/jobs/${c.wo_id}`} className="font-mono text-xs font-semibold text-brand-600 hover:underline">
                                                {c.wo_number}
                                            </Link>
                                            {c.product && <div className="text-[10px] text-surface-400 mt-0.5 max-w-[180px] truncate">{c.product}</div>}
                                        </td>
                                        <td className="text-sm text-surface-700">{c.customer ?? '—'}</td>
                                        <td className="text-sm text-surface-700">
                                            {c.issued_by_name}
                                            {c.issued_by_designation && <div className="text-[10px] text-surface-400">{c.issued_by_designation}</div>}
                                        </td>
                                        <td>
                                            <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider border whitespace-nowrap ${SOURCE_BADGE[c.source] ?? SOURCE_BADGE.customer}`}>
                                                {SOURCE_LABEL[c.source] ?? c.source}
                                            </span>
                                            {c.source === 'ied' && c.uploaded_by && <div className="text-[10px] text-surface-400 mt-0.5">by {c.uploaded_by}</div>}
                                        </td>
                                        <td className="text-center">
                                            {c.rating ? (
                                                <span className="text-amber-500 text-sm font-bold whitespace-nowrap">
                                                    {'★'.repeat(c.rating)}<span className="text-surface-200">{'★'.repeat(5 - c.rating)}</span>
                                                </span>
                                            ) : <span className="text-surface-300">—</span>}
                                        </td>
                                        <td className="text-xs text-surface-500 whitespace-nowrap">{c.issued_date}</td>
                                        <td className="text-right">
                                            <div className="flex items-center justify-end gap-1">
                                                <a href={`/ied/completion-certificates/${c.id}/preview`} target="_blank" rel="noreferrer" className="btn-ghost btn-xs">
                                                    <i className="fi fi-rr-eye text-[11px] leading-none" /> View
                                                </a>
                                                <a href={`/ied/completion-certificates/${c.id}/download`} className="btn-ghost btn-xs" title="Download">
                                                    <i className="fi fi-rr-download text-[11px] leading-none" />
                                                </a>
                                                {c.can_edit && (
                                                    <>
                                                        <button onClick={() => setModal({ cert: c })} className="btn-ghost btn-xs" title="Replace / correct">
                                                            <i className="fi fi-rr-edit text-[11px] leading-none" />
                                                        </button>
                                                        <button onClick={() => destroy(c)} className="btn-ghost btn-xs text-rose-600 hover:bg-rose-50" title="Delete">
                                                            <i className="fi fi-rr-trash text-[11px] leading-none" />
                                                        </button>
                                                    </>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                                {rows.length === 0 && (
                                    <tr>
                                        <td colSpan={8}>
                                            <div className="empty-state">
                                                <div className="empty-state-icon"><i className="fi fi-rr-diploma" /></div>
                                                <p className="empty-state-title">No certificates yet</p>
                                                <p className="empty-state-text">
                                                    {canManage
                                                        ? 'Upload the client’s signed completion certificate for a job, or wait for the client to issue it in the customer portal.'
                                                        : 'Certificates appear here when a client issues one or IED uploads it.'}
                                                </p>
                                            </div>
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>

                    {certificates?.links && certificates.links.length > 3 && (
                        <div className="card-body border-t border-surface-100 flex items-center justify-center gap-1 flex-wrap">
                            {certificates.links.map((l: any, i: number) => (
                                <Link key={i} href={l.url ?? '#'} preserveScroll
                                    className={`px-3 py-1 rounded-md text-xs font-semibold ${
                                        l.active ? 'bg-surface-900 text-white'
                                        : l.url ? 'text-surface-700 hover:bg-surface-100'
                                        : 'text-surface-300 cursor-not-allowed'
                                    }`}
                                    dangerouslySetInnerHTML={{ __html: l.label }} />
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {modal && <CertificateModal jobs={jobs ?? []} cert={modal.cert} jobId={modal.jobId} onClose={() => setModal(null)} />}
        </AppLayout>
    );
}

/** Upload (pick a job) or, with `cert`, correct an IED upload and optionally replace its file. */
function CertificateModal({ jobs, cert, jobId, onClose }: { jobs: Job[]; cert?: Cert; jobId?: number; onClose: () => void }) {
    const editing = !!cert;
    const returnTo = useMemo(() => new URLSearchParams(window.location.search).get('return') ?? '', []);
    const today = new Date().toISOString().slice(0, 10);
    const [query, setQuery] = useState('');
    const fileRef = useRef<HTMLInputElement | null>(null);

    const { data, setData, post, processing, errors, transform } = useForm({
        work_order_id: (jobId && jobs.some(j => j.id === jobId) ? String(jobId) : '') as string,
        issued_by_name: cert?.issued_by_name ?? '',
        issued_by_designation: cert?.issued_by_designation ?? '',
        issued_date: cert?.issued_date_raw ?? today,
        client_ref_no: cert?.client_ref_no ?? '',
        remarks: cert?.remarks ?? '',
        file: null as File | null,
        return_to: returnTo,
    });

    const picked = jobs.find(j => String(j.id) === data.work_order_id);
    const shown = useMemo(() => {
        const q = query.trim().toLowerCase();
        const list = q ? jobs.filter(j => [j.wo_number, j.job_number, j.customer, j.description].some(v => (v ?? '').toLowerCase().includes(q))) : jobs;
        return list.slice(0, 60);
    }, [jobs, query]);

    const submit = (e: FormEvent) => {
        e.preventDefault();
        if (editing) {
            transform(d => ({ ...d, _method: 'put' }));
            post(`/ied/completion-certificates/${cert!.id}`, { forceFormData: true, preserveScroll: true, onSuccess: onClose });
        } else {
            post('/ied/completion-certificates', { forceFormData: true, preserveScroll: true, onSuccess: onClose });
        }
    };

    useEffect(() => {
        const esc = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
        document.addEventListener('keydown', esc);
        return () => document.removeEventListener('keydown', esc);
    }, [onClose]);

    return (
        <div className="fixed inset-0 z-50 bg-surface-900/50 backdrop-blur-sm flex items-start sm:items-center justify-center p-4 overflow-y-auto" onClick={onClose}>
            <form onSubmit={submit} onClick={e => e.stopPropagation()}
                  className="w-full max-w-2xl bg-white rounded-2xl shadow-2xl my-8">
                <div className="px-6 py-4 border-b border-surface-100 flex items-center justify-between gap-3">
                    <div>
                        <h3 className="text-base font-bold text-surface-900">
                            {editing ? `Correct ${cert!.certificate_number}` : 'Upload completion certificate'}
                        </h3>
                        <p className="text-xs text-surface-500 mt-0.5">
                            {editing ? `${cert!.wo_number} · ${cert!.customer ?? ''}` : 'The client’s signed certificate, scanned — one per job.'}
                        </p>
                    </div>
                    <button type="button" onClick={onClose} className="w-9 h-9 rounded-lg hover:bg-surface-100 flex items-center justify-center text-surface-500" aria-label="Close">
                        <i className="fi fi-rr-cross-small text-lg leading-none" />
                    </button>
                </div>

                <div className="px-6 py-5 space-y-5">
                    {!editing && (
                        <div>
                            <label className="form-label">Job <span className="text-rose-600">*</span></label>
                            {picked ? (
                                <div className="flex items-center justify-between gap-3 rounded-xl border border-brand-300 bg-brand-50 px-4 py-3">
                                    <JobLine j={picked} />
                                    <button type="button" onClick={() => setData('work_order_id', '')} className="text-xs font-semibold text-brand-700 hover:underline shrink-0">Change</button>
                                </div>
                            ) : (
                                <>
                                    <input value={query} onChange={e => setQuery(e.target.value)} autoFocus
                                           placeholder={jobs.length ? 'Find by WO no., job no., client or item…' : 'No job is waiting for a certificate'}
                                           className="form-input w-full" disabled={!jobs.length} />
                                    {jobs.length > 0 && (
                                        <div className="mt-2 max-h-56 overflow-y-auto rounded-xl border border-surface-200 divide-y divide-surface-100">
                                            {shown.map(j => (
                                                <button type="button" key={j.id} onClick={() => setData('work_order_id', String(j.id))}
                                                        className="w-full text-left px-4 py-2.5 hover:bg-surface-50">
                                                    <JobLine j={j} />
                                                </button>
                                            ))}
                                            {shown.length === 0 && <p className="px-4 py-3 text-sm text-surface-500">No job matches.</p>}
                                        </div>
                                    )}
                                </>
                            )}
                            {errors.work_order_id && <p className="form-error">{errors.work_order_id}</p>}
                        </div>
                    )}

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                            <label className="form-label">Signed by <span className="text-rose-600">*</span></label>
                            <input value={data.issued_by_name} onChange={e => setData('issued_by_name', e.target.value)} className="form-input w-full" maxLength={150} placeholder="Name on the certificate" />
                            {errors.issued_by_name && <p className="form-error">{errors.issued_by_name}</p>}
                        </div>
                        <div>
                            <label className="form-label">Designation</label>
                            <input value={data.issued_by_designation} onChange={e => setData('issued_by_designation', e.target.value)} className="form-input w-full" maxLength={150} />
                        </div>
                        <div>
                            <label className="form-label">Certificate date <span className="text-rose-600">*</span></label>
                            <input type="date" max={today} value={data.issued_date} onChange={e => setData('issued_date', e.target.value)} className="form-input w-full" />
                            {errors.issued_date && <p className="form-error">{errors.issued_date}</p>}
                        </div>
                        <div>
                            <label className="form-label">Client&rsquo;s ref. no.</label>
                            <input value={data.client_ref_no} onChange={e => setData('client_ref_no', e.target.value)} className="form-input w-full" maxLength={100} placeholder="As printed on the certificate" />
                        </div>
                    </div>

                    <div>
                        <label className="form-label">
                            {editing ? 'Replace the file' : <>Scanned certificate <span className="text-rose-600">*</span></>}
                        </label>
                        <button type="button" onClick={() => fileRef.current?.click()}
                                className={`w-full rounded-xl border-2 border-dashed px-4 py-5 text-center transition-colors ${
                                    data.file ? 'border-emerald-300 bg-emerald-50' : 'border-surface-300 hover:border-brand-400 bg-surface-50'
                                }`}>
                            {data.file ? (
                                <span className="text-sm font-semibold text-emerald-800 break-all">
                                    <i className="fi fi-rr-check text-xs mr-1.5" />{data.file.name}
                                </span>
                            ) : (
                                <span className="text-sm text-surface-700">
                                    <i className="fi fi-rr-cloud-upload text-brand-600 mr-1.5" />
                                    {editing ? 'Choose a new file to replace the current one (optional)' : 'Choose the PDF or photo'}
                                    <span className="block text-xs text-surface-500 mt-1">PDF, JPG or PNG · up to 10 MB</span>
                                </span>
                            )}
                        </button>
                        <input ref={fileRef} type="file" accept=".pdf,.jpg,.jpeg,.png" className="hidden"
                               onChange={e => setData('file', e.target.files?.[0] ?? null)} />
                        {errors.file && <p className="form-error">{errors.file}</p>}
                    </div>

                    <div>
                        <label className="form-label">Remarks</label>
                        <textarea value={data.remarks} onChange={e => setData('remarks', e.target.value)} rows={2} className="form-textarea w-full" maxLength={2000} />
                    </div>
                </div>

                <div className="px-6 py-4 border-t border-surface-100 flex items-center justify-end gap-2">
                    <button type="button" onClick={onClose} className="btn-ghost">Cancel</button>
                    <button type="submit" disabled={processing || (!editing && !data.work_order_id)} className="btn-primary disabled:opacity-50">
                        {processing ? <><i className="fi fi-rr-spinner animate-spin text-xs leading-none" /> Saving…</>
                            : editing ? 'Save changes' : <><i className="fi fi-rr-cloud-upload text-xs leading-none" /> Upload</>}
                    </button>
                </div>
            </form>
        </div>
    );
}

function JobLine({ j }: { j: Job }) {
    return (
        <span className="block min-w-0">
            <span className="flex items-center gap-2 flex-wrap">
                <span className="font-mono text-xs font-bold text-surface-900">{j.wo_number}</span>
                {j.job_number && <span className="font-mono text-[11px] text-surface-500">Job {j.job_number}</span>}
                <span className={`text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ${
                    j.delivered ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
                }`}>{j.delivered ? j.status_label : `${j.status_label} — not delivered yet`}</span>
            </span>
            <span className="block text-xs text-surface-600 mt-0.5 truncate">
                {j.customer ?? '—'}{j.description ? ` · ${j.description}` : ''}
            </span>
        </span>
    );
}

function Stat({ label, value, tone, icon }: { label: string; value: any; tone: string; icon: string }) {
    const tones: Record<string, string> = {
        indigo:  'bg-indigo-50 text-indigo-600',
        purple:  'bg-purple-50 text-purple-600',
        emerald: 'bg-emerald-50 text-emerald-600',
        amber:   'bg-amber-50 text-amber-600',
        slate:   'bg-slate-100 text-slate-600',
    };
    return (
        <div className="bg-white rounded-2xl border border-surface-100 p-4">
            <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                    <div className="text-[10px] uppercase tracking-wider font-bold text-surface-400 truncate">{label}</div>
                    <div className="font-bold text-2xl text-surface-900 mt-1 font-mono leading-none">{value}</div>
                </div>
                <div className={`w-10 h-10 rounded-xl ${tones[tone]} flex items-center justify-center shrink-0`}>
                    <i className={`fi ${icon} text-sm leading-none`} />
                </div>
            </div>
        </div>
    );
}
