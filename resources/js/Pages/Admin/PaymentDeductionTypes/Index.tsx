import AppLayout from '@/Layouts/AppLayout';
import { Head, router, useForm } from '@inertiajs/react';
import { FormEvent, useState } from 'react';

interface Row {
    id: number;
    code: string;
    name: string;
    name_bn: string | null;
    is_recoverable: boolean;
    default_rate_pct: string | number | null;
    is_active: boolean;
    sort_order: number;
    deductions_count: number;
}

const blank = {
    name: '', name_bn: '', code: '', is_recoverable: false,
    default_rate_pct: '', is_active: true, sort_order: 0,
};

/**
 * Master data: what a client cuts out of a payment.
 *
 * ⚠️ The **Recoverable** switch is the one that matters. It decides whether a
 * deduction leaves money still owed to BITAC (security, performance deposit)
 * or settles the bill outright (tax at source, penalty, rounding). Flipping it
 * on a type already in use moves the dues on every bill that used it, which
 * is why the row says how many deductions hang off it.
 *
 * One NATIONAL list, like client sectors — "security held across BITAC" has to
 * be a single comparable figure.
 */
export default function PaymentDeductionTypes({ types = [], filters }: { types: Row[]; filters: any }) {
    const [editing, setEditing] = useState<number | 'new' | null>(null);
    const [search, setSearch] = useState(filters?.search ?? '');
    const form = useForm<any>({ ...blank });

    const openNew = () => { form.setData({ ...blank }); form.clearErrors(); setEditing('new'); };
    const openEdit = (row: Row) => {
        form.setData({
            name: row.name, name_bn: row.name_bn ?? '', code: row.code,
            is_recoverable: row.is_recoverable,
            default_rate_pct: row.default_rate_pct ?? '',
            is_active: row.is_active, sort_order: row.sort_order,
        });
        form.clearErrors();
        setEditing(row.id);
    };

    const submit = (e: FormEvent) => {
        e.preventDefault();
        const done = { preserveScroll: true, onSuccess: () => setEditing(null) };
        if (editing === 'new') form.post('/admin/payment-deduction-types', done);
        else form.put(`/admin/payment-deduction-types/${editing}`, done);
    };

    const remove = (row: Row) => {
        const message = row.deductions_count > 0
            ? `“${row.name}” is used on ${row.deductions_count} deduction(s).\n\nIt will be deactivated, not deleted.`
            : `Delete “${row.name}”?`;
        if (!confirm(message)) return;
        router.delete(`/admin/payment-deduction-types/${row.id}`, { preserveScroll: true });
    };

    return (
        <AppLayout header="Deduction Types">
            <Head title="Deduction Types" />

            <div className="max-w-4xl mx-auto space-y-5 animate-fade-in">

                <div className="rounded-2xl border border-surface-200 bg-surface-50/60 p-4">
                    <p className="text-sm text-surface-600">
                        What clients deduct from a payment. <strong>Recoverable</strong> means BITAC gets
                        the money back later — it stays in the client's dues until it is released.
                        Anything not recoverable (tax at source, a penalty, rounding) settles the bill.
                    </p>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3">
                    <input className="form-input !py-1.5 text-sm w-64" placeholder="Search…"
                        value={search} onChange={(e) => setSearch(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && router.get('/admin/payment-deduction-types',
                            search ? { search } : {}, { preserveState: true, replace: true })} />
                    <button type="button" onClick={openNew} className="btn-primary btn-sm">
                        <i className="fi fi-rr-plus text-xs leading-none" /> Add type
                    </button>
                </div>

                <div className="card">
                    <div className="card-body p-0 overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-surface-100 text-[10px] uppercase tracking-wider text-surface-500 font-bold">
                                    <th className="text-left px-4 py-2">Name</th>
                                    <th className="text-left px-3 py-2 w-32">Recoverable</th>
                                    <th className="text-right px-3 py-2 w-24">Default %</th>
                                    <th className="text-right px-3 py-2 w-20">Used</th>
                                    <th className="text-left px-3 py-2 w-24">Status</th>
                                    <th className="px-4 py-2 w-28" />
                                </tr>
                            </thead>
                            <tbody>
                                {types.map((row) => (
                                    <tr key={row.id} className="border-b border-surface-50 hover:bg-surface-50/60">
                                        <td className="px-4 py-2.5">
                                            <p className="font-semibold text-surface-900">{row.name}</p>
                                            {row.name_bn && <p className="text-[11px] text-surface-500">{row.name_bn}</p>}
                                        </td>
                                        <td className="px-3 py-2.5">
                                            <span className={`text-[10px] px-1.5 py-0.5 rounded border font-bold ${row.is_recoverable
                                                ? 'bg-amber-50 text-amber-700 border-amber-200'
                                                : 'bg-surface-100 text-surface-600 border-surface-200'}`}>
                                                {row.is_recoverable ? 'stays a due' : 'settles the bill'}
                                            </span>
                                        </td>
                                        <td className="px-3 py-2.5 text-right tabular-nums text-surface-600">
                                            {row.default_rate_pct ? `${Number(row.default_rate_pct)}%` : '—'}
                                        </td>
                                        <td className="px-3 py-2.5 text-right tabular-nums text-surface-500">
                                            {row.deductions_count || '—'}
                                        </td>
                                        <td className="px-3 py-2.5">
                                            <span className={`text-[10px] px-1.5 py-0.5 rounded border font-bold ${row.is_active
                                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                                : 'bg-surface-100 text-surface-500 border-surface-200'}`}>
                                                {row.is_active ? 'Active' : 'Inactive'}
                                            </span>
                                        </td>
                                        <td className="px-4 py-2.5 text-right whitespace-nowrap">
                                            <button type="button" onClick={() => openEdit(row)}
                                                className="text-xs font-semibold text-brand-600 hover:underline">Edit</button>
                                            <button type="button" onClick={() => remove(row)}
                                                className="ml-3 text-xs font-semibold text-red-500 hover:underline">
                                                {row.deductions_count > 0 ? 'Disable' : 'Delete'}
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            {editing !== null && (
                <div className="fixed inset-0 z-[150] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setEditing(null)} />
                    <form onSubmit={submit} className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg">
                        <div className="px-5 py-3 border-b border-surface-100">
                            <h3 className="text-sm font-bold text-surface-900">
                                {editing === 'new' ? 'Add deduction type' : 'Edit deduction type'}
                            </h3>
                        </div>
                        <div className="p-5 space-y-3">
                            <div className="grid grid-cols-2 gap-3">
                                <div className="form-group !mb-0">
                                    <label className="form-label">Name <span className="text-red-500">*</span></label>
                                    <input className="form-input" value={form.data.name}
                                        onChange={(e) => form.setData('name', e.target.value)} />
                                    {form.errors.name && <p className="form-error">{form.errors.name as any}</p>}
                                </div>
                                <div className="form-group !mb-0">
                                    <label className="form-label">বাংলা নাম</label>
                                    <input className="form-input" value={form.data.name_bn}
                                        onChange={(e) => form.setData('name_bn', e.target.value)} />
                                </div>
                            </div>
                            <div className="grid grid-cols-3 gap-3">
                                <div className="form-group !mb-0">
                                    <label className="form-label">Default %</label>
                                    <input type="number" step="0.001" min="0" max="100" className="form-input text-right"
                                        value={form.data.default_rate_pct}
                                        onChange={(e) => form.setData('default_rate_pct', e.target.value)} />
                                    <p className="form-hint">Prefills the amount.</p>
                                </div>
                                <div className="form-group !mb-0">
                                    <label className="form-label">Order</label>
                                    <input type="number" min="0" className="form-input text-right"
                                        value={form.data.sort_order}
                                        onChange={(e) => form.setData('sort_order', e.target.value)} />
                                </div>
                                <div className="form-group !mb-0">
                                    <label className="form-label">Code</label>
                                    <input className="form-input font-mono text-xs" value={form.data.code}
                                        onChange={(e) => form.setData('code', e.target.value)} placeholder="auto" />
                                    {form.errors.code && <p className="form-error">{form.errors.code as any}</p>}
                                </div>
                            </div>

                            <label className={`flex items-start gap-2.5 p-3 rounded-xl border cursor-pointer ${form.data.is_recoverable
                                ? 'border-amber-200 bg-amber-50/60' : 'border-surface-200'}`}>
                                <input type="checkbox" className="mt-0.5" checked={!!form.data.is_recoverable}
                                    onChange={(e) => form.setData('is_recoverable', e.target.checked)} />
                                <span>
                                    <span className="text-sm font-bold text-surface-900">Recoverable</span>
                                    <span className="block text-[11px] text-surface-500 leading-tight mt-0.5">
                                        BITAC gets this money back later (security, performance deposit).
                                        It stays in the client's dues until released. Leave off for tax
                                        deducted at source, penalties and rounding — those settle the bill.
                                    </span>
                                </span>
                            </label>

                            <label className="flex items-center gap-2 text-sm font-semibold text-surface-700">
                                <input type="checkbox" checked={!!form.data.is_active}
                                    onChange={(e) => form.setData('is_active', e.target.checked)} />
                                Active — offered on the payment form
                            </label>
                        </div>
                        <div className="px-5 py-3 border-t border-surface-100 flex items-center justify-end gap-2">
                            <button type="button" onClick={() => setEditing(null)} className="btn-ghost">Cancel</button>
                            <button type="submit" disabled={form.processing || !form.data.name.trim()} className="btn-primary">
                                Save
                            </button>
                        </div>
                    </form>
                </div>
            )}
        </AppLayout>
    );
}
