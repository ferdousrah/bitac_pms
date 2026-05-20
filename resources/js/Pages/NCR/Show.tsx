import AppLayout from '@/Layouts/AppLayout';
import { Link, useForm } from '@inertiajs/react';
import { useState } from 'react';

const severityBadge: Record<string, string> = {
    low: 'badge-slate',
    minor: 'badge-slate',
    medium: 'badge-amber',
    major: 'badge-amber',
    high: 'badge-red',
    critical: 'badge-red',
};

const statusBadge: Record<string, string> = {
    open: 'badge-amber',
    in_progress: 'badge-blue',
    'in-progress': 'badge-blue',
    closed: 'badge-green',
    resolved: 'badge-green',
};

const reworkStatusBadge: Record<string, string> = {
    pending: 'badge-amber',
    in_progress: 'badge-blue',
    completed: 'badge-green',
};

const formatValue = (v?: string) => (v ? v.replace(/_/g, ' ') : '--');

export default function NCRShow({ ncr, canCreateRework, candidateSections = [] }: any) {
    const [showRework, setShowRework] = useState(false);
    const reworkForm = useForm<{ target_section_ids: number[]; notes: Record<string, string> }>({
        target_section_ids: [],
        notes: {},
    });

    const toggleSection = (id: number) => {
        const current = reworkForm.data.target_section_ids;
        const next    = current.includes(id) ? current.filter((x) => x !== id) : [...current, id];
        reworkForm.setData('target_section_ids', next);
        // Drop the note for any section that just got unchecked.
        if (!next.includes(id)) {
            const { [String(id)]: _drop, ...rest } = reworkForm.data.notes;
            reworkForm.setData('notes', rest);
        }
    };

    const setSectionNote = (id: number, value: string) => {
        reworkForm.setData('notes', { ...reworkForm.data.notes, [String(id)]: value });
    };

    const submitRework = () => {
        if (reworkForm.data.target_section_ids.length === 0) return;
        reworkForm.post(`/ncrs/${ncr.id}/rework`, {
            onSuccess: () => {
                setShowRework(false);
                reworkForm.reset();
            },
        });
    };

    return (
        <AppLayout header={`NCR — ${ncr.ncr_number}`}>
            <div className="space-y-6 animate-fade-in">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Main content */}
                    <div className="lg:col-span-2 space-y-6">
                        {/* Header card */}
                        <div className="card">
                            <div className="card-header flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                                <div>
                                    <h2 className="text-base font-bold text-rose-600 font-mono">{ncr.ncr_number}</h2>
                                    <p className="text-xs text-surface-500 mt-1">
                                        <span className="font-mono">{ncr.wo_number}</span>
                                        <span className="mx-1 text-surface-300">|</span>
                                        Raised: {ncr.created_at}
                                    </p>
                                </div>
                                <div className="flex flex-wrap gap-2">
                                    <span className={`badge ${severityBadge[ncr.severity] ?? 'badge-slate'}`}>
                                        {ncr.severity}
                                    </span>
                                    <span className={`badge ${statusBadge[ncr.status] ?? 'badge-slate'}`}>
                                        {formatValue(ncr.status)}
                                    </span>
                                </div>
                            </div>
                            <div className="card-body">
                                <dl className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
                                    <div className="md:col-span-2">
                                        <dt className="text-[11px] font-semibold text-surface-400 uppercase tracking-wide">
                                            Defect Description
                                        </dt>
                                        <dd className="text-sm text-surface-800 mt-1 whitespace-pre-line">
                                            {ncr.defect_description}
                                        </dd>
                                    </div>
                                    <div>
                                        <dt className="text-[11px] font-semibold text-surface-400 uppercase tracking-wide">
                                            Disposition
                                        </dt>
                                        <dd className="text-sm text-surface-800 mt-1 capitalize">
                                            {formatValue(ncr.disposition)}
                                        </dd>
                                    </div>
                                    <div>
                                        <dt className="text-[11px] font-semibold text-surface-400 uppercase tracking-wide">
                                            Raised By
                                        </dt>
                                        <dd className="text-sm text-surface-800 mt-1">{ncr.raised_by_name}</dd>
                                    </div>
                                    {ncr.root_cause && (
                                        <div className="md:col-span-2">
                                            <dt className="text-[11px] font-semibold text-surface-400 uppercase tracking-wide">
                                                Root Cause Analysis
                                            </dt>
                                            <dd className="text-sm text-surface-800 mt-1 whitespace-pre-line">
                                                {ncr.root_cause}
                                            </dd>
                                        </div>
                                    )}
                                    {ncr.corrective_action && (
                                        <div className="md:col-span-2">
                                            <dt className="text-[11px] font-semibold text-surface-400 uppercase tracking-wide">
                                                Corrective Action
                                            </dt>
                                            <dd className="text-sm text-surface-800 mt-1 whitespace-pre-line">
                                                {ncr.corrective_action}
                                            </dd>
                                        </div>
                                    )}
                                </dl>
                            </div>
                        </div>

                        {/* Linked rework orders (one per responsible section) */}
                        {ncr.rework_orders && ncr.rework_orders.length > 0 && (
                            <div className="card">
                                <div className="card-header">
                                    <h3 className="text-base font-bold text-surface-900">
                                        Linked Rework Order{ncr.rework_orders.length > 1 ? 's' : ''}
                                    </h3>
                                    <p className="text-xs text-surface-400 mt-0.5">
                                        {ncr.rework_orders.length === 1
                                            ? 'Rework created to resolve this NCR'
                                            : `${ncr.rework_orders.length} sections responsible — one rework order per section`}
                                    </p>
                                </div>
                                <div className="card-body space-y-3">
                                    {ncr.rework_orders.map((r: any) => (
                                        <div key={r.id} className="rounded-xl border border-surface-100 bg-white p-3 space-y-2">
                                            <div className="flex items-center justify-between gap-3">
                                                <span className="font-mono font-semibold text-brand-600 text-sm">
                                                    {r.rework_number}
                                                </span>
                                                <span className={`badge ${reworkStatusBadge[r.status] ?? 'badge-slate'}`}>
                                                    {formatValue(r.status)}
                                                </span>
                                            </div>
                                            {r.target_section && (
                                                <div className="rounded-lg bg-amber-50 border border-amber-200 px-2.5 py-1.5 text-xs">
                                                    <div className="font-semibold text-amber-900">
                                                        Sent back to <span className="font-bold">{r.target_section.name}</span> ({r.target_section.code}) for rework
                                                    </div>
                                                </div>
                                            )}
                                            {r.notes && (
                                                <div className="text-xs text-surface-700 whitespace-pre-line bg-surface-50 border border-surface-100 rounded-lg px-2.5 py-1.5">
                                                    {r.notes}
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                    <div className="text-[11px] text-surface-500 italic pt-1">
                                        Each section will see this job in their production queue with a rework banner.
                                        After all reworks finish and the remaining routing completes, the job returns to QC for re-inspection.
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Sidebar */}
                    <aside className="space-y-6">
                        <div className="card">
                            <div className="card-header">
                                <h3 className="text-base font-bold text-surface-900">Actions</h3>
                            </div>
                            <div className="card-body space-y-2">
                                {canCreateRework && ncr.status === 'open' && (!ncr.rework_orders || ncr.rework_orders.length === 0) && (
                                    <button
                                        onClick={() => setShowRework(true)}
                                        className="btn-primary btn-sm w-full justify-center"
                                    >
                                        <i className="fi fi-rr-refresh text-xs leading-none" />
                                        Create Rework Order
                                    </button>
                                )}
                                <Link
                                    href={`/work-orders/${ncr.work_order_id}`}
                                    className="btn-outline btn-sm w-full justify-center"
                                >
                                    <i className="fi fi-rr-briefcase text-xs leading-none" />
                                    View Work Order
                                </Link>
                                <Link href="/ncr" className="btn-ghost btn-sm w-full justify-center">
                                    <i className="fi fi-rr-arrow-left text-xs leading-none" />
                                    Back to List
                                </Link>
                            </div>
                        </div>

                        <div className="card">
                            <div className="card-header">
                                <h3 className="text-base font-bold text-surface-900">Summary</h3>
                            </div>
                            <div className="card-body space-y-3">
                                <div>
                                    <div className="text-[11px] font-semibold text-surface-400 uppercase tracking-wide">
                                        Severity
                                    </div>
                                    <div className="mt-1">
                                        <span className={`badge ${severityBadge[ncr.severity] ?? 'badge-slate'}`}>
                                            {ncr.severity}
                                        </span>
                                    </div>
                                </div>
                                <div>
                                    <div className="text-[11px] font-semibold text-surface-400 uppercase tracking-wide">
                                        Status
                                    </div>
                                    <div className="mt-1">
                                        <span className={`badge ${statusBadge[ncr.status] ?? 'badge-slate'}`}>
                                            {formatValue(ncr.status)}
                                        </span>
                                    </div>
                                </div>
                                <div>
                                    <div className="text-[11px] font-semibold text-surface-400 uppercase tracking-wide">
                                        Disposition
                                    </div>
                                    <div className="text-sm text-surface-800 mt-1 capitalize">
                                        {formatValue(ncr.disposition)}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </aside>
                </div>
            </div>

            {showRework && (
                <div
                    className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4 animate-fade-in"
                    onClick={() => !reworkForm.processing && setShowRework(false)}
                >
                    <div
                        className="bg-white rounded-2xl max-w-lg w-full shadow-2xl max-h-[90vh] flex flex-col"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="p-5 border-b border-surface-100">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
                                    <i className="fi fi-rr-refresh text-base" />
                                </div>
                                <div>
                                    <h3 className="text-base font-bold text-surface-900">Create Rework Order</h3>
                                    <p className="text-xs text-surface-500">NCR {ncr.ncr_number} · Job #{ncr.job_number ?? '—'}</p>
                                </div>
                            </div>
                        </div>

                        <div className="p-5 space-y-4 overflow-y-auto">
                            <div className="text-sm text-surface-700">
                                Pick every section responsible for the defect, and add a section-specific note
                                so each shop knows exactly what to rework. One rework order is created per section.
                            </div>

                            <div className="form-group">
                                <label className="form-label">
                                    Responsible Section(s) <span className="text-red-500">*</span>
                                </label>
                                {candidateSections.length === 0 ? (
                                    <p className="form-hint text-red-600">
                                        No production sections are linked to this work order's routing.
                                    </p>
                                ) : (
                                    <div className="space-y-2 border border-surface-200 rounded-xl p-2 max-h-[420px] overflow-y-auto">
                                        {candidateSections.map((s: any) => {
                                            const checked = reworkForm.data.target_section_ids.includes(s.id);
                                            const note = reworkForm.data.notes[String(s.id)] ?? '';
                                            return (
                                                <div
                                                    key={s.id}
                                                    className={`rounded-lg border transition-colors ${
                                                        checked ? 'bg-amber-50 border-amber-200' : 'bg-white border-surface-100'
                                                    }`}
                                                >
                                                    <label className="flex items-center gap-3 px-3 py-2 cursor-pointer">
                                                        <input
                                                            type="checkbox"
                                                            checked={checked}
                                                            onChange={() => toggleSection(s.id)}
                                                            className="w-4 h-4 rounded border-surface-300 text-brand-600 focus:ring-brand-500"
                                                        />
                                                        <div className="flex-1 min-w-0">
                                                            <div className="text-sm font-semibold text-surface-900">
                                                                {s.sequence}. {s.name}
                                                            </div>
                                                            <div className="text-[11px] text-surface-500 font-mono">{s.code}</div>
                                                        </div>
                                                    </label>
                                                    {checked && (
                                                        <div className="px-3 pb-3 -mt-1">
                                                            <label className="block text-[11px] font-semibold text-amber-900 mb-1">
                                                                Note for {s.name}
                                                            </label>
                                                            <textarea
                                                                value={note}
                                                                onChange={(e) => setSectionNote(s.id, e.target.value)}
                                                                rows={2}
                                                                className="form-input text-sm"
                                                                style={{ resize: 'vertical' }}
                                                                placeholder={`What ${s.name} needs to rework — measurements, tolerances, expected outcome…`}
                                                            />
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                                {reworkForm.errors.target_section_ids && (
                                    <p className="form-error">{reworkForm.errors.target_section_ids as any}</p>
                                )}
                                {reworkForm.data.target_section_ids.length > 0 && (
                                    <p className="form-hint text-amber-700 mt-1.5">
                                        <i className="fi fi-rr-info text-[10px]" /> {reworkForm.data.target_section_ids.length} section(s) selected — one rework order will be created per section.
                                    </p>
                                )}
                            </div>
                        </div>

                        <div className="p-4 bg-surface-50 border-t border-surface-100 flex items-center justify-end gap-2 rounded-b-2xl">
                            <button
                                type="button"
                                onClick={() => setShowRework(false)}
                                disabled={reworkForm.processing}
                                className="btn-outline"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={submitRework}
                                disabled={reworkForm.processing || reworkForm.data.target_section_ids.length === 0}
                                className="btn-primary"
                            >
                                {reworkForm.processing ? (
                                    <><i className="fi fi-rr-spinner animate-spin text-sm" /> Creating...</>
                                ) : (
                                    <>
                                        <i className="fi fi-rr-refresh text-sm" />
                                        Create Rework Order{reworkForm.data.target_section_ids.length > 1 ? 's' : ''}
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </AppLayout>
    );
}
