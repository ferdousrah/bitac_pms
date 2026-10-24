import AppLayout from '@/Layouts/AppLayout';
import { Link, router, useForm } from '@inertiajs/react';
import { FormEvent, useEffect, useState } from 'react';
import SearchableSelect from '@/Components/SearchableSelect';

interface Props {
    machines: any[];
    sections?: any[];
    activeSection?: { id: number; name: string; code: string } | null;
    preselectedId?: number | null;
    category?: 'electrical' | 'mechanical' | null;
    categories?: Record<string, string>;
}

/** Each kind of request, as a card to pick. Classes written out in full for Tailwind. */
const CATEGORY_CARDS = [
    { value: 'electrical', icon: 'fi-rr-bolt',  hint: 'Wiring, motor, panel, power supply, lighting',
      on: 'bg-sky-50 border-sky-400 text-sky-900 ring-2 ring-sky-200', iconOn: 'bg-sky-500 text-white' },
    { value: 'mechanical', icon: 'fi-rr-gears', hint: 'Spindle, gearbox, bearings, hydraulics, alignment',
      on: 'bg-amber-50 border-amber-400 text-amber-900 ring-2 ring-amber-200', iconOn: 'bg-amber-500 text-white' },
] as const;

const URGENCY_OPTIONS = [
    { value: 'urgent', label: 'Urgent — production blocked', color: 'rose' },
    { value: 'normal', label: 'Normal — affecting throughput', color: 'amber' },
    { value: 'low',    label: 'Low — minor / preventive',     color: 'slate' },
];

export default function MaintenanceCreate({ machines, sections = [], activeSection, preselectedId, category = null, categories = {} }: Props) {
    const [previews, setPreviews] = useState<string[]>([]);
    const form = useForm<{
        category: string;
        machine_id: string | number | '';
        reported_problem: string;
        urgency: 'urgent' | 'normal' | 'low';
        expected_downtime_hours: string;
        photos: File[];
    }>({
        category: category ?? '',
        machine_id: preselectedId ?? '',
        reported_problem: '',
        urgency: 'normal',
        expected_downtime_hours: '',
        photos: [],
    });

    useEffect(() => {
        return () => previews.forEach(URL.revokeObjectURL);
    }, [previews]);

    const onFiles = (files: FileList | null) => {
        if (!files) return;
        const newFiles = Array.from(files).slice(0, 5 - form.data.photos.length);
        const merged = [...form.data.photos, ...newFiles];
        form.setData('photos', merged);
        const urls = merged.map(f => URL.createObjectURL(f));
        previews.forEach(URL.revokeObjectURL);
        setPreviews(urls);
    };

    const removePhoto = (i: number) => {
        const next = form.data.photos.filter((_, idx) => idx !== i);
        form.setData('photos', next);
        URL.revokeObjectURL(previews[i]);
        setPreviews(next.map(f => URL.createObjectURL(f)));
    };

    const submit = (e: FormEvent) => {
        e.preventDefault();
        form.post('/maintenance-requests', { forceFormData: true });
    };

    const selectedMachine = machines.find(m => String(m.id) === String(form.data.machine_id));
    const backTo = form.data.category ? `/maintenance/${form.data.category}` : '/maintenance-requests';

    return (
        <AppLayout header={form.data.category ? `New ${categories[form.data.category] ?? 'Maintenance'} Request` : 'New Maintenance Request'}>
            <div className="max-w-2xl animate-fade-in space-y-6">
                <form onSubmit={submit}>
                    <div className="card">
                        <div className="card-header">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-400 to-amber-600 text-white flex items-center justify-center shadow-md">
                                    <i className="fi fi-rr-wrench-simple text-lg leading-none" />
                                </div>
                                <div>
                                    <h2 className="text-base font-bold text-surface-900">Report a Machine Problem</h2>
                                    <p className="text-xs text-surface-400 mt-0.5">A maintenance manager will review and approve.</p>
                                </div>
                            </div>
                        </div>

                        <div className="card-body space-y-5">
                            {/* Electrical or mechanical — required. */}
                            <div className="form-group">
                                <label className="form-label">Type of maintenance <span className="text-red-500">*</span></label>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    {CATEGORY_CARDS.map((c) => {
                                        const on = form.data.category === c.value;
                                        return (
                                            <button key={c.value} type="button" onClick={() => form.setData('category', c.value)}
                                                className={`flex items-center gap-3 px-3 py-3 rounded-xl border text-left transition-all ${on ? c.on : 'bg-white border-surface-200 text-surface-700 hover:border-surface-300'}`}>
                                                <span className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${on ? c.iconOn : 'bg-surface-100 text-surface-500'}`}>
                                                    <i className={`fi ${c.icon} text-base leading-none`} />
                                                </span>
                                                <span className="min-w-0">
                                                    <span className="block text-sm font-bold">{categories[c.value] ?? c.value}</span>
                                                    <span className="block text-[11px] opacity-75">{c.hint}</span>
                                                </span>
                                            </button>
                                        );
                                    })}
                                </div>
                                {form.errors.category && <p className="form-error">{form.errors.category}</p>}
                            </div>

                            {/* Section scope banner */}
                            {(activeSection || sections.length > 0) && (
                                <div className="rounded-xl border border-indigo-100 bg-indigo-50/50 px-3 py-2 flex flex-wrap items-center gap-2 text-xs">
                                    <span className="text-indigo-700 font-semibold inline-flex items-center gap-1">
                                        <i className="fi fi-rr-filter text-[10px] leading-none" />
                                        Section scope:
                                    </span>
                                    {activeSection ? (
                                        <span className="px-2 py-0.5 bg-white border border-indigo-200 rounded-md font-bold text-indigo-800">
                                            {activeSection.name}
                                        </span>
                                    ) : (
                                        <span className="px-2 py-0.5 bg-white border border-surface-200 rounded-md text-surface-700">All machines</span>
                                    )}
                                    <span className="text-surface-400 ml-1">{machines.length} machine{machines.length === 1 ? '' : 's'} in list</span>
                                    <select
                                        onChange={(e) => {
                                            const v = e.target.value;
                                            // Keep the chosen category across the reload.
                                            const keep = form.data.category ? { category: form.data.category } : {};
                                            router.get('/maintenance-requests/create',
                                                v === 'all' ? { ...keep, section_id: 0 } : { ...keep, section_id: v },
                                                { preserveState: false, replace: true });
                                        }}
                                        value={activeSection?.id ?? 'all'}
                                        className="ml-auto text-xs px-2 py-1 rounded-md border border-surface-200 bg-white">
                                        <option value="all">All sections</option>
                                        {sections.map((s: any) => (
                                            <option key={s.id} value={s.id}>{s.name}</option>
                                        ))}
                                    </select>
                                </div>
                            )}

                            {/* Machine picker */}
                            <div className="form-group">
                                <label className="form-label">Machine <span className="text-red-500">*</span></label>
                                <SearchableSelect
                                    value={form.data.machine_id}
                                    onChange={(v) => form.setData('machine_id', v)}
                                    options={machines.map((m: any) => ({
                                        value: m.id,
                                        label: `${m.machine_code} — ${m.name}`,
                                        sublabel: m.current_state ? m.current_state.replace(/_/g, ' ') : undefined,
                                    }))}
                                    placeholder="Search & select machine…"
                                    clearable={false}
                                    required
                                />
                                {selectedMachine && (
                                    <p className="text-[11px] text-surface-500 mt-1.5 inline-flex items-center gap-1">
                                        <i className="fi fi-rr-info text-[10px]" />
                                        Current state: <span className="font-semibold capitalize">{selectedMachine.current_state ?? '—'}</span>
                                    </p>
                                )}
                                {form.errors.machine_id && <p className="form-error">{form.errors.machine_id}</p>}
                            </div>

                            {/* Problem */}
                            <div className="form-group">
                                <label className="form-label">What's the problem? <span className="text-red-500">*</span></label>
                                <textarea
                                    value={form.data.reported_problem}
                                    onChange={e => form.setData('reported_problem', e.target.value)}
                                    rows={5}
                                    required
                                    maxLength={2000}
                                    placeholder="Describe what's wrong — sounds, behaviour, error codes, when it started, etc."
                                    className="form-textarea"
                                />
                                {form.errors.reported_problem && <p className="form-error">{form.errors.reported_problem}</p>}
                            </div>

                            {/* Urgency */}
                            <div className="form-group">
                                <label className="form-label">Urgency <span className="text-red-500">*</span></label>
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                                    {URGENCY_OPTIONS.map(o => (
                                        <button key={o.value} type="button"
                                            onClick={() => form.setData('urgency', o.value as any)}
                                            className={`px-3 py-2.5 rounded-xl border text-left transition-all ${
                                                form.data.urgency === o.value
                                                    ? `bg-${o.color}-50 border-${o.color}-300 text-${o.color}-800 shadow-sm`
                                                    : 'bg-white border-surface-200 text-surface-600 hover:border-surface-300'
                                            }`}>
                                            <div className="text-xs font-bold uppercase tracking-wider">{o.value}</div>
                                            <div className="text-[11px] mt-0.5">{o.label.split(' — ')[1]}</div>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Expected downtime */}
                            <div className="form-group max-w-[200px]">
                                <label className="form-label">Expected Downtime <span className="form-label-optional">(hours)</span></label>
                                <input type="number" min={0} step="0.25"
                                    value={form.data.expected_downtime_hours}
                                    onChange={e => form.setData('expected_downtime_hours', e.target.value)}
                                    placeholder="e.g. 2.5"
                                    className="form-input font-mono" />
                                {form.errors.expected_downtime_hours && <p className="form-error">{form.errors.expected_downtime_hours}</p>}
                            </div>

                            {/* Photos */}
                            <div className="form-group">
                                <label className="form-label">Photos <span className="form-label-optional">(up to 5)</span></label>
                                <input type="file"
                                    accept="image/jpeg,image/png,image/webp"
                                    multiple
                                    onChange={(e) => onFiles(e.target.files)}
                                    className="block w-full text-sm text-surface-500
                                               file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border-0
                                               file:text-sm file:font-semibold file:bg-brand-50 file:text-brand-700
                                               hover:file:bg-brand-100 file:cursor-pointer file:transition-colors" />
                                <p className="text-[11px] text-surface-400 mt-1">JPG / PNG / WebP. Max 4 MB each.</p>
                                {previews.length > 0 && (
                                    <div className="mt-3 grid grid-cols-2 sm:grid-cols-5 gap-2">
                                        {previews.map((url, i) => (
                                            <div key={i} className="relative group">
                                                <img src={url} alt={`Photo ${i + 1}`}
                                                    className="w-full h-20 object-cover rounded-lg border border-surface-200" />
                                                <button type="button"
                                                    onClick={() => removePhoto(i)}
                                                    className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-rose-600 text-white text-[10px] flex items-center justify-center shadow opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <i className="fi fi-rr-cross-small leading-none" />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                                {form.errors['photos.0' as any] && <p className="form-error">{form.errors['photos.0' as any]}</p>}
                            </div>
                        </div>

                        <div className="card-body border-t border-surface-100 flex items-center gap-3">
                            <button type="submit" disabled={form.processing || !form.data.category} className="btn-primary"
                                title={form.data.category ? '' : 'Choose Electrical or Mechanical first'}>
                                {form.processing
                                    ? <><i className="fi fi-rr-spinner animate-spin text-sm" /> Submitting…</>
                                    : <><i className="fi fi-rr-paper-plane text-sm" /> Submit Request</>}
                            </button>
                            <Link href={backTo} className="btn-ghost">Cancel</Link>
                        </div>
                    </div>
                </form>
            </div>
        </AppLayout>
    );
}
