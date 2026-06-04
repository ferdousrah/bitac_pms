import AppLayout from '@/Layouts/AppLayout';
import { Link, useForm } from '@inertiajs/react';
import { FormEvent, useEffect, useState } from 'react';
import SearchableSelect from '@/Components/SearchableSelect';

interface Props {
    machines: any[];
    preselectedId?: number | null;
}

const URGENCY_OPTIONS = [
    { value: 'urgent', label: 'Urgent — production blocked', color: 'rose' },
    { value: 'normal', label: 'Normal — affecting throughput', color: 'amber' },
    { value: 'low',    label: 'Low — minor / preventive',     color: 'slate' },
];

export default function MaintenanceCreate({ machines, preselectedId }: Props) {
    const [previews, setPreviews] = useState<string[]>([]);
    const form = useForm<{
        machine_id: string | number | '';
        reported_problem: string;
        urgency: 'urgent' | 'normal' | 'low';
        expected_downtime_hours: string;
        photos: File[];
    }>({
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

    return (
        <AppLayout header="New Maintenance Request">
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
                            <button type="submit" disabled={form.processing} className="btn-primary">
                                {form.processing
                                    ? <><i className="fi fi-rr-spinner animate-spin text-sm" /> Submitting…</>
                                    : <><i className="fi fi-rr-paper-plane text-sm" /> Submit Request</>}
                            </button>
                            <Link href="/maintenance-requests" className="btn-ghost">Cancel</Link>
                        </div>
                    </div>
                </form>
            </div>
        </AppLayout>
    );
}
