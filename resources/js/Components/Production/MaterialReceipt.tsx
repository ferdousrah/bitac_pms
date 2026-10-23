import { Link, router, usePage } from '@inertiajs/react';
import { useState } from 'react';
import { DEMAND_BADGE, mrBadge, mrLabel } from '@/lib/mrStatus';

export interface MaterialPanel {
    status: 'received' | 'not_received' | null;
    label: string;
    note?: string | null;
    marked_by?: string | null;
    marked_at?: string | null;
    requisitions: { id: number; mrn_number: string; status: string; status_label: string; lines: number; required: number; issued: number }[];
    demands: { id: number; demand_no: string; status: string; status_label: string; mrn_number?: string | null }[];
}

const qty = (v: number) => Number(v).toLocaleString('en-IN', { maximumFractionDigits: 3 });

/**
 * The shop's "material received or not" step for one job (BITAC, 2026-10-23),
 * with what is on its way: the requisitions to this shop for the job and the
 * shop's own demands. Received closes the issued requisitions; Not received
 * needs a reason and tells PCD. Either can be changed later.
 */
export default function MaterialReceipt({ wosId, material, readOnly = false }: { wosId: number; material: MaterialPanel; readOnly?: boolean }) {
    const { errors } = usePage().props as any;
    const [asking, setAsking] = useState(false);
    const [note, setNote] = useState('');
    const [busy, setBusy] = useState(false);

    const post = (status: 'received' | 'not_received') => {
        setBusy(true);
        router.post(`/production/wos/${wosId}/material`, { status, note: status === 'not_received' ? note : '' }, {
            preserveScroll: true,
            onSuccess: () => { setAsking(false); setNote(''); },
            onFinish: () => setBusy(false),
        });
    };

    const tone = material.status === 'received'
        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
        : material.status === 'not_received'
            ? 'bg-red-50 text-red-700 border-red-200'
            : 'bg-amber-50 text-amber-700 border-amber-200';
    const icon = material.status === 'received' ? 'fi-rr-check-circle' : material.status === 'not_received' ? 'fi-rr-cross-circle' : 'fi-rr-time-quarter-past';

    return (
        <div className="card">
            <div className="card-header flex items-center justify-between gap-2">
                <div>
                    <h3 className="text-sm font-bold text-surface-900">Material</h3>
                    <p className="text-[11px] text-surface-500 mt-0.5">Has the material for this job reached the shop?</p>
                </div>
            </div>
            <div className="card-body space-y-4">
                <div className={`rounded-xl border px-3 py-2.5 ${tone}`}>
                    <div className="flex items-center gap-2 text-sm font-semibold">
                        <i className={`fi ${icon} text-sm leading-none`} /> {material.label}
                    </div>
                    {material.marked_by && (
                        <div className="text-[11px] opacity-80 mt-0.5">{material.marked_by} · {material.marked_at}</div>
                    )}
                    {material.note && <div className="text-xs mt-1.5 whitespace-pre-line">{material.note}</div>}
                </div>

                {/* What is on its way */}
                {(material.requisitions.length > 0 || material.demands.length > 0) ? (
                    <div className="space-y-1.5">
                        {material.requisitions.map((mr) => (
                            <div key={mr.id} className="flex items-center justify-between gap-2 text-xs rounded-lg border border-surface-200 px-2.5 py-2">
                                <div className="min-w-0">
                                    <div className="font-mono font-semibold text-surface-900">{mr.mrn_number}</div>
                                    <div className="text-surface-500">
                                        {mr.issued > 0 ? `${qty(mr.issued)} of ${qty(mr.required)} issued` : `${mr.lines} line${mr.lines === 1 ? '' : 's'} · nothing issued yet`}
                                    </div>
                                </div>
                                <span className={`badge ${mrBadge(mr.status)} shrink-0`}>{mrLabel(mr.status)}</span>
                            </div>
                        ))}
                        {material.demands.filter((d) => d.status !== 'accepted').map((d) => (
                            <Link key={d.id} href={`/material-demands/${d.id}`}
                                className="flex items-center justify-between gap-2 text-xs rounded-lg border border-dashed border-surface-200 px-2.5 py-2 hover:bg-surface-50">
                                <span className="font-mono font-semibold text-surface-800">{d.demand_no}</span>
                                <span className={`badge ${DEMAND_BADGE[d.status] ?? 'badge-slate'}`}>{d.status_label}</span>
                            </Link>
                        ))}
                    </div>
                ) : (
                    <p className="text-xs text-surface-500">No requisition for this job yet. Use <b>Request Material</b> if the shop needs some.</p>
                )}

                {!readOnly && (asking ? (
                    <div className="space-y-2">
                        <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} autoFocus
                            className="form-textarea text-sm" placeholder="What has not arrived? e.g. EN-24 bar issued on MRN-0031 not received yet" />
                        {errors?.note && <div className="form-error">{errors.note}</div>}
                        <div className="flex gap-2">
                            <button type="button" onClick={() => setAsking(false)} className="btn-ghost btn-sm flex-1 justify-center">Back</button>
                            <button type="button" disabled={busy} onClick={() => post('not_received')}
                                className="btn-sm flex-1 justify-center inline-flex items-center gap-1.5 rounded-xl font-semibold bg-red-600 text-white hover:bg-red-700">
                                Tell PCD
                            </button>
                        </div>
                    </div>
                ) : (
                    <div className="grid grid-cols-2 gap-2">
                        <button type="button" disabled={busy || material.status === 'received'} onClick={() => post('received')}
                            className="btn-sm justify-center inline-flex items-center gap-1.5 rounded-xl font-semibold bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-40">
                            <i className="fi fi-rr-check text-xs leading-none" /> Received
                        </button>
                        <button type="button" disabled={busy} onClick={() => { setNote(material.status === 'not_received' ? (material.note ?? '') : ''); setAsking(true); }}
                            className="btn-sm justify-center inline-flex items-center gap-1.5 rounded-xl font-semibold border border-red-200 text-red-700 hover:bg-red-50">
                            <i className="fi fi-rr-cross-small text-xs leading-none" /> Not received
                        </button>
                    </div>
                ))}
            </div>
        </div>
    );
}
