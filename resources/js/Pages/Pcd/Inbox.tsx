import AppLayout from '@/Layouts/AppLayout';
import { Head, Link } from '@inertiajs/react';

interface Job {
    id: number;
    wo_number: string;
    customer: string | null;
    customer_po_no: string | null;
    quantity: number;
    item_count: number;
    priority: string | null;
    due_date: string | null;
    amount: number;
    handed_over_at: string | null;
    waiting_days: number | null;
    notes: string | null;
}

const money = (n: number) =>
    n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function PcdInbox({ jobs = [], releases = [], stats }: { jobs: Job[]; releases: any[]; stats: any }) {
    return (
        <AppLayout header="PCD Inbox">
            <Head title="PCD Inbox" />

            <div className="max-w-6xl mx-auto space-y-5 animate-fade-in">

                <div className="rounded-2xl border border-surface-200 bg-surface-50/60 p-4">
                    <p className="text-sm text-surface-600">
                        Work orders accepted by IED, waiting to be read and released for planning.
                        Once forwarded they reach <strong>Job Planning</strong>, where the job number,
                        material requisition, routing and operation sheets are prepared.
                    </p>
                </div>

                <div className="grid grid-cols-3 gap-4">
                    <div className="card"><div className="card-body">
                        <p className="text-[11px] uppercase tracking-wider font-bold text-surface-400">To review</p>
                        <p className="text-2xl font-bold text-surface-900 mt-1">{stats?.waiting ?? 0}</p>
                    </div></div>
                    <div className="card"><div className="card-body">
                        <p className="text-[11px] uppercase tracking-wider font-bold text-surface-400">To release</p>
                        <p className={`text-2xl font-bold mt-1 ${stats?.releases ? 'text-indigo-600' : 'text-surface-900'}`}>
                            {stats?.releases ?? 0}
                        </p>
                    </div></div>
                    <div className="card"><div className="card-body">
                        <p className="text-[11px] uppercase tracking-wider font-bold text-surface-400">Waiting 2+ days</p>
                        <p className={`text-2xl font-bold mt-1 ${stats?.overdue ? 'text-amber-600' : 'text-surface-900'}`}>
                            {stats?.overdue ?? 0}
                        </p>
                    </div></div>
                </div>

                {/* Planned and waiting to be let onto the shop floor — the second
                    half of this officer's job, on the same screen because it is
                    the same person. */}
                {releases.length > 0 && (
                    <div className="rounded-2xl border border-indigo-200 bg-white shadow-sm overflow-hidden">
                        <div className="px-4 py-3 bg-indigo-50 border-b border-indigo-100 flex items-center justify-between gap-3">
                            <div className="flex items-center gap-2.5">
                                <div className="w-9 h-9 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center">
                                    <i className="fi fi-rr-shield-check text-sm leading-none" />
                                </div>
                                <div>
                                    <h3 className="text-sm font-bold text-indigo-900 leading-tight">Waiting to be released</h3>
                                    <p className="text-[11px] text-indigo-700/70 leading-tight mt-0.5">
                                        Planned by the সহকারী প্রকৌশলী — your approval opens the shop floor.
                                    </p>
                                </div>
                            </div>
                            <span className="min-w-[28px] h-7 px-2 rounded-lg bg-indigo-100 text-indigo-700 text-sm font-extrabold flex items-center justify-center">
                                {releases.length}
                            </span>
                        </div>
                        <div className="p-0 overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b border-surface-100 text-[10px] uppercase tracking-wider text-surface-500 font-bold">
                                        <th className="text-left px-4 py-2 w-40">Work Order</th>
                                        <th className="text-left px-3 py-2">Customer</th>
                                        <th className="text-left px-3 py-2">Routing</th>
                                        <th className="text-left px-3 py-2 w-40">Planned</th>
                                        <th className="px-4 py-2 w-28" />
                                    </tr>
                                </thead>
                                <tbody>
                                    {releases.map((r: any) => (
                                        <tr key={r.id} className="border-b border-surface-50 hover:bg-surface-50/60">
                                            <td className="px-4 py-2.5">
                                                <Link href={`/pcd/inbox/release/${r.id}`}
                                                    className="font-mono text-xs font-bold text-brand-600 hover:underline">
                                                    {r.wo_number}
                                                </Link>
                                                {r.job_number && <p className="text-[11px] text-surface-400">Job #{r.job_number}</p>}
                                            </td>
                                            <td className="px-3 py-2.5">
                                                <span className="font-semibold text-surface-900">{r.customer ?? '—'}</span>
                                                <p className="text-[11px] text-surface-400">
                                                    {r.quantity} pc{r.quantity !== 1 ? 's' : ''} · {r.item_count} item{r.item_count !== 1 ? 's' : ''}
                                                </p>
                                            </td>
                                            <td className="px-3 py-2.5 text-xs text-surface-600">
                                                {r.shops.length > 0 ? r.shops.join(' → ') : <span className="text-amber-600">no shops routed</span>}
                                            </td>
                                            <td className="px-3 py-2.5 text-xs text-surface-500">
                                                {r.requested_at ?? '—'}
                                                {(r.waiting_days ?? 0) >= 2 && (
                                                    <span className="ml-1.5 text-[10px] px-1.5 py-0.5 rounded border font-semibold bg-amber-50 text-amber-700 border-amber-200">
                                                        {r.waiting_days}d
                                                    </span>
                                                )}
                                            </td>
                                            <td className="px-4 py-2.5 text-right">
                                                <Link href={`/pcd/inbox/release/${r.id}`} className="btn-primary btn-sm">
                                                    Review
                                                </Link>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                <div className="card">
                    <div className="card-header">
                        <h3 className="text-sm font-bold text-surface-900">
                            Awaiting review <span className="text-surface-400 font-normal">({jobs.length})</span>
                        </h3>
                    </div>
                    <div className="card-body p-0 overflow-x-auto">
                        {jobs.length === 0 ? (
                            <div className="text-center py-14">
                                <div className="w-12 h-12 rounded-xl bg-surface-100 flex items-center justify-center mx-auto mb-3">
                                    <i className="fi fi-rr-inbox text-surface-400 text-base leading-none" />
                                </div>
                                <p className="text-sm font-semibold text-surface-700">Nothing waiting</p>
                                <p className="text-xs text-surface-400 mt-1">
                                    New work orders from IED will appear here.
                                </p>
                            </div>
                        ) : (
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b border-surface-100 text-[10px] uppercase tracking-wider text-surface-500 font-bold">
                                        <th className="text-left px-4 py-2 w-40">Work Order</th>
                                        <th className="text-left px-3 py-2">Customer</th>
                                        <th className="text-right px-3 py-2 w-24">Qty</th>
                                        <th className="text-right px-3 py-2 w-32">Value</th>
                                        <th className="text-left px-3 py-2 w-28">Due</th>
                                        <th className="text-left px-3 py-2 w-40">Arrived</th>
                                        <th className="px-4 py-2 w-28" />
                                    </tr>
                                </thead>
                                <tbody>
                                    {jobs.map((job) => (
                                        <tr key={job.id} className="border-b border-surface-50 hover:bg-surface-50/60">
                                            <td className="px-4 py-2.5">
                                                <Link href={`/pcd/inbox/${job.id}`}
                                                    className="font-mono text-xs font-bold text-brand-600 hover:underline">
                                                    {job.wo_number}
                                                </Link>
                                                {job.priority && job.priority !== 'normal' && (
                                                    <span className="ml-1.5 text-[10px] px-1.5 py-0.5 rounded border font-semibold uppercase bg-red-50 text-red-700 border-red-200">
                                                        {job.priority}
                                                    </span>
                                                )}
                                            </td>
                                            <td className="px-3 py-2.5">
                                                <span className="font-semibold text-surface-900">{job.customer ?? '—'}</span>
                                                <p className="text-[11px] text-surface-400">
                                                    {job.item_count} item{job.item_count !== 1 ? 's' : ''}
                                                    {job.customer_po_no ? ` · PO ${job.customer_po_no}` : ''}
                                                </p>
                                            </td>
                                            <td className="px-3 py-2.5 text-right tabular-nums">{job.quantity}</td>
                                            <td className="px-3 py-2.5 text-right tabular-nums text-surface-600">
                                                {job.amount ? `৳ ${money(job.amount)}` : '—'}
                                            </td>
                                            <td className="px-3 py-2.5 text-xs text-surface-500">{job.due_date ?? '—'}</td>
                                            <td className="px-3 py-2.5 text-xs text-surface-500">
                                                {job.handed_over_at ?? '—'}
                                                {(job.waiting_days ?? 0) >= 2 && (
                                                    <span className="ml-1.5 text-[10px] px-1.5 py-0.5 rounded border font-semibold bg-amber-50 text-amber-700 border-amber-200">
                                                        {job.waiting_days}d
                                                    </span>
                                                )}
                                            </td>
                                            <td className="px-4 py-2.5 text-right">
                                                <Link href={`/pcd/inbox/${job.id}`} className="btn-primary btn-sm">
                                                    Review
                                                </Link>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>
                </div>
            </div>
        </AppLayout>
    );
}
