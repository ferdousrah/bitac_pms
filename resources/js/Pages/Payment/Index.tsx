import AppLayout from '@/Layouts/AppLayout';
import { Head, Link, router } from '@inertiajs/react';
import { useState } from 'react';
import RecordPaymentModal from '@/Components/Payment/RecordPaymentModal';
import PaymentRows from '@/Components/Payment/PaymentRows';

const money = (n: number) =>
    `৳${Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/**
 * Every receipt, newest first.
 *
 * ⚠️ The totals count CASH kinds only. An `advance_applied` row spends money
 * that already arrived, so adding it would report the same taka twice.
 *
 * Payments against a bill are recorded from the bill itself — that is where
 * the due is. This screen records the one thing that has no bill yet: an
 * **advance** taken against a job.
 */
export default function PaymentIndex({
    payments, filters, summary, customers = [], kinds = {}, methods = {},
    deductionTypes = [], suggestedNo = '', openWorkOrders = [], can = {},
}: any) {
    const [showAdvance, setShowAdvance] = useState(false);
    const [form, setForm] = useState({
        search: filters.search ?? '',
        customer_id: filters.customer_id ?? '',
        kind: filters.kind ?? '',
        method: filters.method ?? '',
        date_from: filters.date_from ?? '',
        date_to: filters.date_to ?? '',
    });

    const apply = (patch: Partial<typeof form> = {}) => {
        const next = { ...form, ...patch };
        setForm(next);
        router.get('/payments', Object.fromEntries(Object.entries(next).filter(([, v]) => v !== '')), {
            preserveState: true, preserveScroll: true, replace: true,
        });
    };

    const clear = () => {
        const empty = { search: '', customer_id: '', kind: '', method: '', date_from: '', date_to: '' };
        setForm(empty);
        router.get('/payments', {}, { preserveState: true, replace: true });
    };

    const hasFilters = Object.values(form).some((v) => v !== '');

    return (
        <AppLayout header="Payments">
            <Head title="Payments" />

            <div className="max-w-6xl mx-auto space-y-5 animate-fade-in">

                <div className="flex flex-wrap items-center justify-between gap-3">
                    <p className="text-sm text-surface-600">
                        Money received against bills and advances taken against jobs.
                    </p>
                    <div className="flex items-center gap-2">
                        <Link href="/receivables" className="btn-outline btn-sm">
                            <i className="fi fi-rr-chart-pie text-xs leading-none" /> Receivables
                        </Link>
                        {can.record && (
                            <button type="button" onClick={() => setShowAdvance(true)} className="btn-primary btn-sm">
                                <i className="fi fi-rr-plus text-xs leading-none" /> Record advance
                            </button>
                        )}
                    </div>
                </div>

                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    {[
                        ['Receipts', String(summary.count), 'text-surface-900'],
                        ['Gross received', money(summary.gross), 'text-surface-900'],
                        ['Deducted', money(summary.deducted), 'text-amber-600'],
                        ['Net in hand', money(summary.net), 'text-emerald-600'],
                    ].map(([label, value, tone]) => (
                        <div key={label} className="card"><div className="card-body">
                            <p className="text-[11px] uppercase tracking-wider font-bold text-surface-400">{label}</p>
                            <p className={`text-xl font-bold mt-1 font-mono ${tone}`}>{value}</p>
                        </div></div>
                    ))}
                </div>

                <div className="card">
                    <div className="card-body grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                        <input className="form-input lg:col-span-2" placeholder="Receipt no, reference, client, bill…"
                            value={form.search}
                            onChange={(e) => setForm({ ...form, search: e.target.value })}
                            onKeyDown={(e) => e.key === 'Enter' && apply()} />
                        <select className="form-input" value={form.customer_id}
                            onChange={(e) => apply({ customer_id: e.target.value })}>
                            <option value="">All clients</option>
                            {customers.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>
                        <select className="form-input" value={form.kind} onChange={(e) => apply({ kind: e.target.value })}>
                            <option value="">All kinds</option>
                            {Object.entries(kinds).map(([v, l]) => <option key={v} value={v}>{l as string}</option>)}
                        </select>
                        <input type="date" className="form-input" value={form.date_from}
                            onChange={(e) => apply({ date_from: e.target.value })} />
                        <input type="date" className="form-input" value={form.date_to}
                            onChange={(e) => apply({ date_to: e.target.value })} />
                        {hasFilters && (
                            <button type="button" onClick={clear} className="btn-ghost btn-sm sm:col-span-3 lg:col-span-6 justify-self-start">
                                Clear filters
                            </button>
                        )}
                    </div>
                </div>

                <div className="card">
                    <div className="card-body">
                        <PaymentRows payments={payments.data} canDelete={can.delete} showInvoice
                            emptyText={hasFilters ? 'No receipts match these filters.' : 'No payments recorded yet.'} />
                    </div>
                </div>

                {payments.links && payments.last_page > 1 && (
                    <div className="flex flex-wrap items-center justify-center gap-1.5">
                        {payments.links.map((link: any, i: number) => (
                            link.url ? (
                                <Link key={i} href={link.url} preserveScroll
                                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold border ${link.active
                                        ? 'bg-brand-500 text-white border-brand-500'
                                        : 'bg-white text-surface-600 border-surface-200 hover:bg-surface-50'}`}
                                    dangerouslySetInnerHTML={{ __html: link.label }} />
                            ) : (
                                <span key={i} className="px-3 py-1.5 text-xs text-surface-300"
                                    dangerouslySetInnerHTML={{ __html: link.label }} />
                            )
                        ))}
                    </div>
                )}
            </div>

            <RecordPaymentModal
                open={showAdvance}
                onClose={() => setShowAdvance(false)}
                kind="advance"
                workOrders={openWorkOrders}
                deductionTypes={deductionTypes}
                methods={methods}
                suggestedNo={suggestedNo}
            />
        </AppLayout>
    );
}
