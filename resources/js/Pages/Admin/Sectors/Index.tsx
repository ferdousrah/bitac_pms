import AppLayout from '@/Layouts/AppLayout';
import { Head, router, useForm } from '@inertiajs/react';
import { FormEvent, useState } from 'react';

interface Sector {
    id: number;
    name: string;
    code: string | null;
    applies_to: 'government' | 'private' | 'both';
    description: string | null;
    display_order: number;
    is_active: boolean;
    customers_count: number;
}

const APPLIES = [
    { value: 'both',       label: 'Both',       hint: 'Offered under either customer type' },
    { value: 'government', label: 'Government', hint: 'Only for Government Entity customers' },
    { value: 'private',    label: 'Private',    hint: 'Only for Private Organization customers' },
] as const;

const badge = (a: Sector['applies_to']) =>
    a === 'government' ? 'bg-blue-50 text-blue-700 border-blue-200'
    : a === 'private'  ? 'bg-violet-50 text-violet-700 border-violet-200'
    :                    'bg-surface-100 text-surface-600 border-surface-200';

export default function SectorsIndex({ sectors, filters = {} }: any) {
    const [editing, setEditing] = useState<Sector | null>(null);
    const [search, setSearch] = useState(filters.search ?? '');

    const blank = { name: '', code: '', applies_to: 'both', description: '', display_order: 0, is_active: true };
    const form = useForm<any>(blank);

    const startEdit = (s: Sector) => {
        setEditing(s);
        form.setData({
            name: s.name,
            code: s.code ?? '',
            applies_to: s.applies_to,
            description: s.description ?? '',
            display_order: s.display_order,
            is_active: s.is_active,
        });
    };

    const cancel = () => {
        setEditing(null);
        form.setData(blank);
        form.clearErrors();
    };

    const submit = (e: FormEvent) => {
        e.preventDefault();
        const done = { preserveScroll: true, onSuccess: () => cancel() };
        if (editing) form.put(`/admin/sectors/${editing.id}`, done);
        else form.post('/admin/sectors', done);
    };

    const remove = (s: Sector) => {
        const msg = s.customers_count > 0
            ? `“${s.name}” is used by ${s.customers_count} customer(s), so it will be deactivated rather than deleted. Continue?`
            : `Delete “${s.name}”?`;
        if (!confirm(msg)) return;
        router.delete(`/admin/sectors/${s.id}`, { preserveScroll: true });
    };

    const runSearch = (e: FormEvent) => {
        e.preventDefault();
        router.get('/admin/sectors', { search }, { preserveState: true, replace: true });
    };

    return (
        <AppLayout header="Client Sectors">
            <Head title="Client Sectors" />

            <div className="max-w-6xl mx-auto space-y-6 animate-fade-in">
                <div className="rounded-2xl border border-surface-200 bg-surface-50/60 p-4">
                    <p className="text-sm text-surface-600">
                        The sectors a client can belong to — Power, BCIC, Defence, textiles, and so on. Each customer
                        is a <strong>Government Entity</strong> or a <strong>Private Organization</strong>, and a
                        sector within that.
                    </p>
                    <p className="text-xs text-surface-400 mt-1.5">
                        This list is shared by every BITAC centre, so sector-wise figures stay comparable across all of
                        them. Editing it here changes what every centre sees.
                    </p>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* The list */}
                    <div className="lg:col-span-2 card">
                        <div className="card-header flex items-center justify-between gap-3">
                            <h3 className="text-sm font-bold text-surface-900">
                                Sectors <span className="text-surface-400 font-normal">({sectors.total})</span>
                            </h3>
                            <form onSubmit={runSearch} className="shrink-0">
                                <input
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                    placeholder="Search…"
                                    className="form-input text-sm py-1.5 w-44"
                                />
                            </form>
                        </div>

                        <div className="card-body p-0 overflow-x-auto">
                            {sectors.data.length === 0 ? (
                                <p className="text-sm text-surface-400 text-center py-10">
                                    No sectors yet — add the first one on the right.
                                </p>
                            ) : (
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="border-b border-surface-100 text-[10px] uppercase tracking-wider text-surface-500 font-bold">
                                            <th className="text-left px-4 py-2">Sector</th>
                                            <th className="text-left px-3 py-2 w-28">Applies to</th>
                                            <th className="text-right px-3 py-2 w-24">Customers</th>
                                            <th className="px-3 py-2 w-20" />
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {sectors.data.map((s: Sector) => (
                                            <tr key={s.id} className={`border-b border-surface-50 hover:bg-surface-50/60 ${!s.is_active ? 'opacity-50' : ''}`}>
                                                <td className="px-4 py-2.5">
                                                    <div className="flex items-center gap-2">
                                                        <span className="font-semibold text-surface-900">{s.name}</span>
                                                        {s.code && <span className="text-[10px] font-mono text-surface-400">{s.code}</span>}
                                                        {!s.is_active && (
                                                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-surface-200 text-surface-600 font-bold uppercase">
                                                                Inactive
                                                            </span>
                                                        )}
                                                    </div>
                                                    {s.description && (
                                                        <p className="text-xs text-surface-400 mt-0.5">{s.description}</p>
                                                    )}
                                                </td>
                                                <td className="px-3 py-2.5">
                                                    <span className={`text-[10px] px-1.5 py-0.5 rounded border font-semibold uppercase ${badge(s.applies_to)}`}>
                                                        {s.applies_to}
                                                    </span>
                                                </td>
                                                <td className="px-3 py-2.5 text-right font-mono text-surface-600">
                                                    {s.customers_count}
                                                </td>
                                                <td className="px-3 py-2.5">
                                                    <div className="flex items-center justify-end gap-1">
                                                        <button type="button" onClick={() => startEdit(s)}
                                                            className="w-7 h-7 rounded-lg flex items-center justify-center text-surface-400 hover:bg-brand-50 hover:text-brand-600"
                                                            title="Edit">
                                                            <i className="fi fi-rr-pencil text-xs leading-none" />
                                                        </button>
                                                        <button type="button" onClick={() => remove(s)}
                                                            className="w-7 h-7 rounded-lg flex items-center justify-center text-surface-400 hover:bg-red-50 hover:text-red-600"
                                                            title={s.customers_count > 0 ? 'In use — will deactivate' : 'Delete'}>
                                                            <i className="fi fi-rr-trash text-xs leading-none" />
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            )}
                        </div>
                    </div>

                    {/* Add / edit */}
                    <div className="card h-fit">
                        <div className="card-header">
                            <h3 className="text-sm font-bold text-surface-900">
                                {editing ? `Edit “${editing.name}”` : 'Add a sector'}
                            </h3>
                        </div>
                        <form onSubmit={submit} className="card-body space-y-3">
                            <div className="form-group !mb-0">
                                <label className="form-label">Name <span className="text-red-500">*</span></label>
                                <input className="form-input" value={form.data.name}
                                    onChange={(e) => form.setData('name', e.target.value)}
                                    placeholder="e.g. BCIC, Power, Defence, Textile" />
                                {form.errors.name && <p className="form-error">{form.errors.name}</p>}
                            </div>

                            <div className="form-group !mb-0">
                                <label className="form-label">Applies to</label>
                                <div className="space-y-1.5">
                                    {APPLIES.map((a) => (
                                        <label key={a.value}
                                            className={`flex items-start gap-2 p-2 rounded-lg border cursor-pointer transition-colors ${
                                                form.data.applies_to === a.value
                                                    ? 'border-brand-300 bg-brand-50/50'
                                                    : 'border-surface-200 hover:border-surface-300'
                                            }`}>
                                            <input type="radio" name="applies_to" className="mt-0.5"
                                                checked={form.data.applies_to === a.value}
                                                onChange={() => form.setData('applies_to', a.value)} />
                                            <span>
                                                <span className="text-sm font-semibold text-surface-800">{a.label}</span>
                                                <span className="block text-[11px] text-surface-400">{a.hint}</span>
                                            </span>
                                        </label>
                                    ))}
                                </div>
                                {form.errors.applies_to && <p className="form-error">{form.errors.applies_to as any}</p>}
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div className="form-group !mb-0">
                                    <label className="form-label">Code</label>
                                    <input className="form-input" value={form.data.code}
                                        onChange={(e) => form.setData('code', e.target.value)} placeholder="Optional" />
                                </div>
                                <div className="form-group !mb-0">
                                    <label className="form-label">Order</label>
                                    <input type="number" min={0} className="form-input" value={form.data.display_order}
                                        onChange={(e) => form.setData('display_order', e.target.value)} />
                                </div>
                            </div>

                            <div className="form-group !mb-0">
                                <label className="form-label">Description</label>
                                <textarea className="form-textarea" rows={2} value={form.data.description}
                                    onChange={(e) => form.setData('description', e.target.value)} />
                            </div>

                            <label className="flex items-center gap-2 text-sm text-surface-700">
                                <input type="checkbox" checked={!!form.data.is_active}
                                    onChange={(e) => form.setData('is_active', e.target.checked)} />
                                Active
                            </label>

                            <div className="flex items-center gap-2 pt-1">
                                <button type="submit" disabled={form.processing} className="btn-primary btn-sm">
                                    {editing ? 'Save changes' : 'Add sector'}
                                </button>
                                {editing && (
                                    <button type="button" onClick={cancel} className="btn-ghost btn-sm">Cancel</button>
                                )}
                            </div>
                        </form>
                    </div>
                </div>
            </div>
        </AppLayout>
    );
}
