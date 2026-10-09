import AppLayout from '@/Layouts/AppLayout';
import { Link, router } from '@inertiajs/react';
import { useEffect, useState } from 'react';
import JobTypeBadge from '@/Components/JobTypeBadge';
import PdfPopupModal from '@/Components/PdfPopupModal';

interface SectionLite {
    id: number;
    name: string;
    code: string;
    name_bn?: string | null;
    is_sub?: boolean;
    parent_name?: string | null;
}

interface QueueJob {
    id: number;
    row_key: string;
    sequence: number;
    status: string;
    started_at: string | null;
    received_qty: number | null;
    sub_section_id: number | null;
    ready_to_transfer?: boolean;
    /** Open operations on this row named on ME. */
    my_steps?: number;
    /** How many of this row's steps the tab being shown is about. */
    bucket_steps?: number | null;
    /** On a bench's Upcoming row: the operations still waiting. */
    waiting_on?: string[];
    completed_at?: string | null;
    /** Where the open operations are and who has them — so the list answers it. */
    assignment_summary?: {
        open: number;
        sub_sections: string[];
        no_sub_section: number;
        no_person: number;
        people: string[];
    } | null;
    op_sheet_id?: number | null;
    work_order_pdf_url?: string | null;
    work_order: {
        id: number;
        wo_number: string;
        job_number: number | null;
        customer: string;
        product: string | null;
        quantity: number;
        job_type: string;
        due_date: string | null;
        priority: string;
    };
    // Per-item context — non-null when this row represents one item's work
    // at the section. WO with N items at this section produces N queue rows.
    item: {
        id: number;
        sequence: number;
        description: string | null;
        quantity: number;
        unit: string;
    } | null;
    sheet_number: string | null;
    steps_total: number | null;
    steps_done: number | null;
    rework: {
        from_section: string;
        transferred_by: string;
        note: string;
        transferred_at: string;
    } | null;
}

interface UpcomingJob {
    wos_id: number;
    wo_id: number;
    job_number: number | null;
    wo_number: string;
    customer: string | null;
    product: string | null;
    quantity: number;
    due_date: string | null;
    is_overdue: boolean;
    sequence: number;
    progress: number | null;
    current: { name: string | null; code: string | null; status: string; sequence: number };
    stops_away: number;
}

interface Props {
    section: SectionLite | null;
    jobs: QueueJob[];
    upcoming: UpcomingJob[];
    available_sections: SectionLite[];
    can_switch: boolean;
}

const STATUS_BADGE: Record<string, string> = {
    ready:           'badge-blue',
    in_progress:     'badge-amber',
    rework:          'badge-red',
    awaiting_rework: 'badge-slate',
};

const STATUS_LABEL: Record<string, string> = {
    ready:           'Ready',
    in_progress:     'In Progress',
    rework:          'Rework Required',
    awaiting_rework: 'Awaiting Rework',
};

const PRIORITY_BADGE: Record<string, string> = {
    low:    'badge-slate',
    normal: 'badge-blue',
    high:   'badge-amber',
    urgent: 'badge-red',
};

export default function ProductionQueue({ section, jobs, upcoming, completed = [], completed_capped = false, available_sections, can_switch, shop_flow = null }: Props & { completed?: QueueJob[]; completed_capped?: boolean; shop_flow?: any }) {
    if (!section) {
        return (
            <AppLayout header="Production">
                <div className="empty-state max-w-xl mx-auto mt-12">
                    <div className="empty-state-icon"><i className="fi fi-rr-industry-windows" /></div>
                    <div className="empty-state-title">No section assigned</div>
                    <div className="empty-state-text">
                        Your user account isn't linked to a production section yet. Ask an admin to set
                        your section under Admin → Users so the queue can populate.
                    </div>
                </div>
            </AppLayout>
        );
    }

    const switchSection = (id: number) => {
        router.get('/production/queue', { section: id }, { preserveScroll: true });
    };

    // The work order and the operation sheet, read from the list itself.
    const [pdfPopup, setPdfPopup] = useState<{ open: boolean; url: string | null; title: string; subtitle?: string }>(
        { open: false, url: null, title: '' });
    const openPdf = (url: string, title: string, subtitle?: string) =>
        setPdfPopup({ open: true, url, title, subtitle });

    // Three readings of the same section — what can be worked now, what is
    // heading here, and what it has finished. Stacking them made a long page
    // on which the thing you came for was never the thing on screen.
    const [tab, setTab] = useState<'active' | 'upcoming' | 'completed'>('active');

    // One box, filtering whatever tab is open — and the tab counts follow it,
    // so typing a job number says which tab the job is in without hunting.
    const [q, setQ] = useState('');
    const needle = q.trim().toLowerCase();

    // ⚠️ Two row shapes live here: a queue row (job nested under `work_order`)
    // and a shop's upcoming row (flat, plus `current`). Read both or searching
    // the Upcoming tab silently matches nothing.
    const haystack = (r: any) => [
        r.work_order?.job_number, r.work_order?.wo_number, r.work_order?.customer, r.work_order?.product,
        r.job_number, r.wo_number, r.customer, r.product,
        r.item?.description, r.sheet_number, r.assigned_to, r.assigned_by, r.current?.name,
        ...(r.assignment_summary?.sub_sections ?? []),
        ...(r.assignment_summary?.people ?? []),
        ...(r.waiting_on ?? []),
    ].filter(Boolean).join(' ').toLowerCase();

    const sift = <T,>(rows: T[]): T[] => needle ? rows.filter((r) => haystack(r).includes(needle)) : rows;
    const fJobs = sift(jobs);
    const fUpcoming = sift(upcoming);
    const fCompleted = sift(completed);

    // A shop can have dozens of jobs and sixty finished ones; one unbroken
    // scroll is where a row goes to be missed.
    const PER_PAGE = 15;
    const [page, setPage] = useState(1);
    // Switching tab or typing must not leave you on a page that no longer exists.
    useEffect(() => { setPage(1); }, [tab, needle]);

    const rowsFor = { active: fJobs, upcoming: fUpcoming, completed: fCompleted }[tab] as any[];
    const pageCount = Math.max(1, Math.ceil(rowsFor.length / PER_PAGE));
    const current = Math.min(page, pageCount);
    const from = (current - 1) * PER_PAGE;
    const paged = rowsFor.slice(from, from + PER_PAGE);
    // The Sl runs on across pages — restarting at 1 on page 2 makes the
    // number useless for pointing at a row.
    const sl = (i: number) => from + i + 1;

    return (
        <AppLayout header={`Production — ${section.name}`}>
            <div className="space-y-6 animate-fade-in">
                {/* Section header */}
                <div className="card">
                    <div className="card-body flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                        <div className="flex items-center gap-4">
                            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-brand-500 to-brand-700 text-white font-bold text-lg flex items-center justify-center shadow-md">
                                <i className="fi fi-rr-industry-windows" />
                            </div>
                            <div>
                                <div className="text-xs font-semibold text-surface-400 uppercase tracking-wider">
                                    {section.is_sub ? 'Sub-section Queue' : 'Section Queue'}
                                </div>
                                <h1 className="text-xl font-bold text-surface-900">{section.name}</h1>
                                <div className="text-xs text-surface-500 mt-0.5">
                                    <span className="font-mono">{section.code}</span>
                                    {section.name_bn && <span> · {section.name_bn}</span>}
                                    {section.is_sub && section.parent_name && <span className="text-violet-600"> · under {section.parent_name}</span>}
                                </div>
                            </div>
                        </div>
                        <div className="flex items-center gap-3 flex-wrap">
                            <Link
                                href={`/maintenance-requests/create?section_id=${section.id}`}
                                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-sm font-semibold
                                           bg-amber-50 text-amber-800 border border-amber-200
                                           hover:bg-amber-100 hover:border-amber-300 transition-colors shadow-sm"
                                title="Report a machine problem for the maintenance team"
                            >
                                <i className="fi fi-rr-wrench-simple text-xs leading-none" />
                                Request Maintenance
                            </Link>
                            {can_switch && available_sections.length > 1 && (
                                <div>
                                    <label className="form-label-optional text-[10px]">Switch section</label>
                                    <select
                                        value={section.id}
                                        onChange={(e) => switchSection(Number(e.target.value))}
                                        className="form-select w-56"
                                    >
                                        {available_sections.map((s) => (
                                            <option key={s.id} value={s.id}>
                                                {s.is_sub ? `   ↳ ${s.name}` : s.name} ({s.code})
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* One section, three readings of it */}
                <div className="card">
                    <div className="card-header">
                      <div className="flex items-center justify-between gap-3 flex-wrap">
                        {/* A segmented control rather than three loose buttons:
                            one trough, one raised pill, so which list you are
                            looking at is obvious without a saturated block. */}
                        <div className="inline-flex items-center gap-1 p-1 rounded-xl bg-surface-100 flex-wrap">
                            {([
                                ['active', shop_flow?.own_work_only ? 'Your Jobs' : 'Active Jobs', fJobs.length],
                                ['upcoming', 'Upcoming Jobs', fUpcoming.length],
                                ['completed', 'Completed Jobs', fCompleted.length],
                            ] as const).map(([key, label, count]) => (
                                <button
                                    key={key}
                                    type="button"
                                    onClick={() => setTab(key)}
                                    aria-pressed={tab === key}
                                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold transition-all ${
                                        tab === key
                                            ? 'bg-white text-brand-700 shadow-sm'
                                            : 'text-surface-500 hover:text-surface-700'
                                    }`}
                                >
                                    {label}
                                    <span className={`text-[11px] font-bold px-1.5 py-0.5 rounded-md tabular-nums ${
                                        tab === key ? 'bg-brand-50 text-brand-700' : 'bg-surface-200/80 text-surface-500'
                                    }`}>{count}</span>
                                </button>
                            ))}
                        </div>

                        <div className="relative w-full sm:w-72">
                            <i className="fi fi-rr-search absolute left-3 top-1/2 -translate-y-1/2 text-[11px] leading-none text-surface-400" />
                            <input
                                value={q}
                                onChange={(e) => setQ(e.target.value)}
                                placeholder="Job no, customer, item, person…"
                                aria-label="Filter the jobs on this tab"
                                className="form-input !py-1.5 !pl-8 !pr-8 text-sm"
                            />
                            {q && (
                                <button
                                    type="button"
                                    onClick={() => setQ('')}
                                    aria-label="Clear the filter"
                                    className="absolute right-2 top-1/2 -translate-y-1/2 text-surface-400 hover:text-surface-700"
                                >
                                    <i className="fi fi-rr-cross-small text-sm leading-none" />
                                </button>
                            )}
                        </div>
                      </div>
                        <p className="text-xs text-surface-400 mt-2">
                            {needle && (
                                <span className="text-surface-600 font-semibold">
                                    Showing matches for “{q.trim()}” ·{' '}
                                </span>
                            )}
                            {tab === 'active' && (shop_flow?.own_work_only
                                ? `${fJobs.length} job${fJobs.length === 1 ? '' : 's'} forwarded to you at ${section.name}`
                                : `${fJobs.length} job${fJobs.length === 1 ? '' : 's'} parked at ${section.name}`)}
                            {tab === 'upcoming' && (section.is_sub
                                ? `Named on ${section.name} but waiting on the operation before them.`
                                : `Routed to ${section.name} — currently being worked upstream. Plan machines & material ahead.`)}
                            {tab === 'completed' && (section.is_sub
                                ? `Operations ${section.name} has finished, newest first.`
                                : `Jobs ${section.name} has finished and forwarded on, newest first.`)}
                            {tab === 'active' && shop_flow?.can_forward && shop_flow?.unassigned > 0 && (
                                <span className="ml-2 text-indigo-600 font-semibold">
                                    · {shop_flow.unassigned} waiting with you to forward
                                </span>
                            )}
                        </p>
                    </div>
                    <div className="card-body p-0">
                        {tab === 'active' && (fJobs.length === 0 ? (
                            needle ? <NoMatch q={q} onClear={() => setQ('')} /> : (
                            <div className="empty-state">
                                <div className="empty-state-icon"><i className="fi fi-rr-check-circle" /></div>
                                <div className="empty-state-title">All clear</div>
                                <div className="empty-state-text">No jobs currently in this section's queue.</div>
                            </div>
                            )
                        ) : (
                            <div className="divide-y divide-surface-100">
                                {paged.map((job, i) => (
                                    <JobCard key={job.row_key} sl={sl(i)} job={{ ...job, shop_flow_active: shop_flow?.active }} onPdf={openPdf} />
                                ))}
                            </div>
                        ))}

                        {/* ⚠️ A shop's upcoming row is a WOS heading this way; a
                            bench's is its own step waiting on the one before it.
                            Two shapes, two cards — UpcomingCard on a bench row
                            would read an id that is not there. */}
                        {tab === 'upcoming' && (fUpcoming.length === 0 ? (
                            needle ? <NoMatch q={q} onClear={() => setQ('')} /> : (
                            <div className="empty-state">
                                <div className="empty-state-icon"><i className="fi fi-rr-truck-side" /></div>
                                <div className="empty-state-title">Nothing heading this way</div>
                                <div className="empty-state-text">
                                    {section.is_sub
                                        ? 'Every operation named on this bench can be worked now.'
                                        : 'No job is routed to this section from an earlier one right now.'}
                                </div>
                            </div>
                            )
                        ) : (
                            <div className="divide-y divide-surface-100">
                                {section.is_sub
                                    ? paged.map((job, i) => (
                                        <JobCard key={job.row_key} sl={sl(i)} job={{ ...job, shop_flow_active: shop_flow?.active }} onPdf={openPdf} />
                                    ))
                                    : paged.map((u, i) => <UpcomingCard key={u.wos_id} sl={sl(i)} u={u} />)}
                            </div>
                        ))}

                        {tab === 'completed' && (fCompleted.length === 0 ? (
                            needle ? <NoMatch q={q} onClear={() => setQ('')} /> : (
                            <div className="empty-state">
                                <div className="empty-state-icon"><i className="fi fi-rr-time-past" /></div>
                                <div className="empty-state-title">Nothing finished yet</div>
                                <div className="empty-state-text">
                                    {section.is_sub
                                        ? 'No operation on this bench has been completed.'
                                        : 'This section has not finished and forwarded a job yet.'}
                                </div>
                            </div>
                            )
                        ) : (
                            <div className="divide-y divide-surface-100">
                                {paged.map((job, i) => (
                                    <JobCard key={job.row_key} sl={sl(i)} job={{ ...job, shop_flow_active: shop_flow?.active }} onPdf={openPdf} done />
                                ))}
                            </div>
                        ))}
                    </div>
                    {(pageCount > 1 || (tab === 'completed' && completed_capped)) && (
                        <div className="card-body border-t border-surface-100 flex items-center justify-between gap-3 flex-wrap">
                            <div className="text-xs text-surface-500">
                                {rowsFor.length > 0 && (
                                    <>Showing {from + 1}–{Math.min(from + PER_PAGE, rowsFor.length)} of {rowsFor.length}</>
                                )}
                                {tab === 'completed' && completed_capped && (
                                    <span className="text-surface-400">
                                        {rowsFor.length > 0 ? ' · ' : ''}
                                        only the most recent are kept here — older finished work is in the job's own history
                                    </span>
                                )}
                            </div>
                            {pageCount > 1 && (
                                <div className="flex items-center gap-1.5">
                                    <button type="button" onClick={() => setPage(current - 1)} disabled={current === 1}
                                        className="btn-outline btn-sm disabled:opacity-40 disabled:cursor-not-allowed">
                                        <i className="fi fi-rr-angle-small-left text-xs leading-none" />
                                    </button>
                                    <span className="text-xs font-semibold text-surface-600 tabular-nums px-1">
                                        {current} / {pageCount}
                                    </span>
                                    <button type="button" onClick={() => setPage(current + 1)} disabled={current === pageCount}
                                        className="btn-outline btn-sm disabled:opacity-40 disabled:cursor-not-allowed">
                                        <i className="fi fi-rr-angle-small-right text-xs leading-none" />
                                    </button>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>

            <PdfPopupModal
                open={pdfPopup.open}
                pdfUrl={pdfPopup.url}
                title={pdfPopup.title}
                subtitle={pdfPopup.subtitle}
                onClose={() => setPdfPopup({ open: false, url: null, title: '' })}
            />
        </AppLayout>
    );
}

function UpcomingCard({ u, sl }: { u: UpcomingJob; sl?: number }) {
    const nf = (n: number) => Number(n).toLocaleString('en-IN', { maximumFractionDigits: 2 });
    return (
        <div className="px-5 py-4 flex items-center gap-4">
            {sl !== undefined && (
                <span className="shrink-0 w-6 text-right text-xs font-semibold text-surface-300 tabular-nums">
                    {sl}
                </span>
            )}
            {/* Distance chip */}
            <div className="shrink-0 w-16 text-center">
                <div className="text-lg font-bold text-surface-700 leading-none">{u.stops_away}</div>
                <div className="text-[10px] text-surface-400 mt-0.5">stop{u.stops_away === 1 ? '' : 's'} away</div>
            </div>
            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono text-xs font-semibold text-surface-700">Job# {u.job_number ?? '—'}</span>
                    <span className="badge badge-slate text-[10px]">Pending here</span>
                    {u.is_overdue && <span className="badge badge-red text-[10px]">Overdue</span>}
                    {u.progress != null && (
                        <span className="text-[11px] text-surface-400">{u.progress}% job done</span>
                    )}
                </div>
                <h3 className="text-sm font-semibold text-surface-900 mt-1">{u.customer ?? '—'}</h3>
                {u.product && <p className="text-xs text-surface-500 mt-0.5 truncate">{u.product}</p>}
                <div className="flex items-center gap-3 mt-2 text-xs text-surface-500 flex-wrap">
                    <span className="inline-flex items-center gap-1 text-brand-600">
                        <i className="fi fi-rr-marker text-[10px]" /> Now at <span className="font-semibold">{u.current.name ?? '—'}</span>
                    </span>
                    <span><i className="fi fi-rr-cube text-[10px]" /> qty {nf(u.quantity)}</span>
                    {u.due_date && <span><i className="fi fi-rr-calendar text-[10px]" /> Due {u.due_date}</span>}
                </div>
            </div>
            <div className="shrink-0">
                <Link href={`/work-orders/${u.wo_id}`} className="btn-ghost btn-sm text-surface-500">
                    <i className="fi fi-rr-eye text-xs leading-none" /> View
                </Link>
            </div>
        </div>
    );
}

/**
 * The empty state while filtering, which is a different fact from an empty
 * tab — saying "All clear" over a search that found nothing reads as though
 * the section has no work.
 */
function NoMatch({ q, onClear }: { q: string; onClear: () => void }) {
    return (
        <div className="empty-state">
            <div className="empty-state-icon"><i className="fi fi-rr-search" /></div>
            <div className="empty-state-title">Nothing matches “{q.trim()}”</div>
            <div className="empty-state-text">
                Try the job number, the customer, an item, a sub-section or a person's name.
            </div>
            <button type="button" onClick={onClear} className="btn-outline btn-sm mt-3">
                Clear the filter
            </button>
        </div>
    );
}

function JobCard({ job, onPdf, done = false, sl }: { job: QueueJob & { assigned_to?: string | null; assigned_by?: string | null; awaiting_receipt?: boolean; shop_flow_active?: boolean }; onPdf: (url: string, title: string, subtitle?: string) => void; done?: boolean; sl?: number }) {
    const isAwaiting = job.status === 'awaiting_rework';
    return (
        <div className={`px-5 py-3.5 transition-colors hover:bg-surface-50/70 ${
            job.status === 'rework' ? 'bg-rose-50/40' : done ? 'bg-surface-50/40' : ''
        }`}>
            <div className="flex items-start gap-4">
                {/* Sl — so a row can be pointed at out loud ("number four"),
                    and it runs on across pages rather than restarting. */}
                {sl !== undefined && (
                    <span className="shrink-0 w-6 pt-0.5 text-right text-xs font-semibold text-surface-300 tabular-nums">
                        {sl}
                    </span>
                )}
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono text-xs font-semibold text-surface-700">Job# {job.work_order.job_number ?? '—'}</span>
                        {job.item && (
                            <span className="badge badge-amber text-[10px]">Item {job.item.sequence}</span>
                        )}
                        <JobTypeBadge type={job.work_order.job_type} size="xs" />
                        {/* On the Completed tab the status and the priority are
                            history — the tab already says it is done, and how
                            urgent it WAS helps nobody. Seven chips on one line
                            is what made the row hard to read. */}
                        {!done && (
                            <span className={`badge ${STATUS_BADGE[job.status] ?? 'badge-slate'}`}>
                                {STATUS_LABEL[job.status] ?? job.status}
                            </span>
                        )}
                        {job.ready_to_transfer && (
                            <span className="badge badge-amber"><i className="fi fi-rr-paper-plane text-[9px]" /> Ready to transfer</span>
                        )}
                        {/* Operations named on me — an engineer has to be able to
                            pick his own work out of the shop's whole queue. */}
                        {!!job.my_steps && job.my_steps > 0 && (
                            <span className="badge badge-blue">
                                <i className="fi fi-rr-user text-[9px]" /> {job.my_steps} operation{job.my_steps === 1 ? '' : 's'} yours
                            </span>
                        )}
                        {/* Who holds this job at this shop. */}
                        {job.assigned_to
                            ? <span className={`badge ${job.awaiting_receipt ? 'badge-amber' : 'badge-green'}`}>
                                <i className="fi fi-rr-user-gear text-[9px]" /> {job.assigned_to}
                                {job.awaiting_receipt ? ' · not received' : ''}
                                {job.assigned_by ? ` · from ${job.assigned_by}` : ''}
                              </span>
                            : job.shop_flow_active
                                ? <span className="badge badge-blue"><i className="fi fi-rr-inbox text-[9px]" /> to forward</span>
                                : null}
                        {!done && (
                            <span className={`badge ${PRIORITY_BADGE[job.work_order.priority] ?? 'badge-slate'} capitalize`}>
                                {job.work_order.priority}
                            </span>
                        )}
                        <span className="text-[11px] text-surface-400">
                            Step {job.sequence}
                            {job.sheet_number && <span className="font-mono"> · Sheet {job.sheet_number}</span>}
                        </span>
                    </div>

                    <h3 className={`text-sm font-semibold mt-1 ${done ? 'text-surface-600' : 'text-surface-900'}`}>
                        {job.work_order.customer}
                    </h3>
                    {/* When this row represents a specific item, show the item
                        description + quantity rather than the WO-level product. */}
                    {job.item ? (
                        <p className="text-xs text-surface-700 mt-0.5 truncate">
                            {job.item.description ?? '—'}
                        </p>
                    ) : job.work_order.product ? (
                        <p className="text-xs text-surface-500 mt-0.5">{job.work_order.product}</p>
                    ) : null}

                    <div className="flex items-center gap-3 mt-2 text-xs text-surface-500">
                        <span>
                            <i className="fi fi-rr-cube text-[10px]" />{' '}
                            {job.received_qty !== null
                                ? <>received {job.received_qty} / {job.item ? job.item.quantity : job.work_order.quantity} {job.item?.unit ?? 'pcs'}</>
                                : <>qty {job.item ? `${job.item.quantity} ${job.item.unit}` : job.work_order.quantity}</>}
                        </span>
                        {job.steps_total != null && (
                            <span>
                                <i className="fi fi-rr-list-check text-[10px]" />{' '}
                                {job.steps_done}/{job.steps_total} ops done
                            </span>
                        )}
                        {job.work_order.due_date && <span><i className="fi fi-rr-calendar text-[10px]" /> Due {job.work_order.due_date}</span>}
                        {job.started_at && <span className="text-surface-400">· started {job.started_at}</span>}
                        {done && job.completed_at && (
                            <span className="text-emerald-600"><i className="fi fi-rr-check text-[10px]" /> finished {job.completed_at}</span>
                        )}
                    </div>

                    {/* On a bench's Upcoming row, WHICH operations are waiting. */}
                    {!!job.waiting_on?.length && (
                        <div className="flex flex-wrap items-center gap-1.5 mt-2">
                            {job.waiting_on.map((name) => (
                                <span key={name} className="inline-flex items-center gap-1 text-[11px] text-surface-600 bg-surface-100 border border-surface-200 rounded-md px-1.5 py-0.5">
                                    <i className="fi fi-rr-time-twenty-four text-[9px]" /> {name} — waiting on the previous operation
                                </span>
                            ))}
                        </div>
                    )}

                    {/* Where the open operations are and who holds them. The
                        in-charge had to open the job to learn any of this. */}
                    {!!job.assignment_summary && job.assignment_summary.open > 0 && (
                        <div className="flex flex-wrap items-center gap-1.5 mt-2">
                            {job.assignment_summary.sub_sections.map((name) => (
                                <span key={name} className="inline-flex items-center gap-1 text-[11px] text-violet-700 bg-violet-50 border border-violet-200 rounded-md px-1.5 py-0.5">
                                    <i className="fi fi-rr-corner-down-right text-[9px]" /> {name}
                                </span>
                            ))}
                            {job.assignment_summary.people.map((name) => (
                                <span key={name} className="inline-flex items-center gap-1 text-[11px] text-sky-700 bg-sky-50 border border-sky-200 rounded-md px-1.5 py-0.5">
                                    <i className="fi fi-rr-user text-[9px]" /> {name}
                                </span>
                            ))}
                            {/* ⚠️ The one thing that stops work moving: a bench
                                picked with nobody named does not reach it. */}
                            {job.assignment_summary.no_person > 0 && (
                                <span className="inline-flex items-center gap-1 text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-1.5 py-0.5">
                                    <i className="fi fi-rr-hourglass-end text-[9px]" />
                                    {job.assignment_summary.no_person} of {job.assignment_summary.open} need a person
                                </span>
                            )}
                            {job.assignment_summary.no_sub_section > 0 && (
                                <span className="inline-flex items-center gap-1 text-[11px] text-surface-500 bg-surface-100 border border-surface-200 rounded-md px-1.5 py-0.5">
                                    <i className="fi fi-rr-corner-down-right text-[9px]" />
                                    {job.assignment_summary.no_sub_section} without a sub-section
                                </span>
                            )}
                        </div>
                    )}

                    {job.rework && (
                        <div className="mt-3 px-3 py-2.5 rounded-xl bg-rose-100/70 border border-rose-200">
                            <div className="flex items-center gap-2 text-xs">
                                <i className="fi fi-rr-undo-alt text-rose-700 text-[11px]" />
                                <span className="font-bold text-rose-900">Rework requested by {job.rework.from_section}</span>
                                <span className="text-rose-600">· {job.rework.transferred_at}</span>
                            </div>
                            <div className="text-xs text-rose-900/80 mt-1 line-clamp-2">
                                {job.rework.note}
                            </div>
                            <div className="text-[10px] text-rose-700 mt-1">Flagged by {job.rework.transferred_by}</div>
                        </div>
                    )}

                    {isAwaiting && (
                        <div className="mt-3 px-3 py-2 rounded-xl bg-slate-100 border border-slate-200 text-xs text-slate-700">
                            <i className="fi fi-rr-time-twenty-four text-[11px]" /> Waiting for an earlier section to finish their rework before this section resumes.
                        </div>
                    )}
                </div>

                {/* ⚠️ These were three full-width buttons stacked, which made
                    every row about 110px tall and put the heaviest thing on the
                    page in the least important column. One compact line: the
                    papers as quiet icon buttons, Open as the only real button. */}
                <div className="shrink-0 flex items-center gap-1.5 pt-0.5">
                    {job.work_order_pdf_url && (
                        <button
                            type="button"
                            onClick={() => onPdf(
                                `${job.work_order_pdf_url}?preview=base64`,
                                'Work Order',
                                job.work_order.job_number ? `Job #${job.work_order.job_number}` : job.work_order.wo_number,
                            )}
                            title="Work order issued by PCD"
                            aria-label="Open the work order PDF"
                            className="inline-flex items-center gap-1 px-2 py-1.5 rounded-lg text-[11px] font-semibold text-indigo-700 bg-indigo-50/70 hover:bg-indigo-100 transition-colors"
                        >
                            <i className="fi fi-rr-file-pdf text-[11px] leading-none" />
                            <span className="hidden xl:inline">Work Order</span>
                        </button>
                    )}
                    {job.op_sheet_id && (
                        <button
                            type="button"
                            onClick={() => onPdf(
                                `/production/op-sheets/${job.op_sheet_id}/pdf?preview=base64`,
                                'Operation Sheet',
                                job.sheet_number ? `Sheet ${job.sheet_number}` : undefined,
                            )}
                            title="Operation sheet for this item"
                            aria-label="Open the operation sheet PDF"
                            className="inline-flex items-center gap-1 px-2 py-1.5 rounded-lg text-[11px] font-semibold text-amber-800 bg-amber-50 hover:bg-amber-100 transition-colors"
                        >
                            <i className="fi fi-rr-file-pdf text-[11px] leading-none" />
                            <span className="hidden xl:inline">Op Sheet</span>
                        </button>
                    )}
                    <Link
                        href={job.item
                            ? `/production/wos/${job.id}?item_id=${job.item.id}${job.sub_section_id ? `&sub_section=${job.sub_section_id}` : ''}`
                            : `/production/wos/${job.id}`}
                        className="btn-outline btn-sm whitespace-nowrap"
                    >
                        Open
                        <i className="fi fi-rr-arrow-right text-xs leading-none" />
                    </Link>
                </div>
            </div>
        </div>
    );
}
