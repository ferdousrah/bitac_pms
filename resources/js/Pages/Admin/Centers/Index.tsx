import AppLayout from '@/Layouts/AppLayout';
import { Link, useForm } from '@inertiajs/react';

interface Center {
    id: number;
    name: string;
    code: string;
    name_bn?: string | null;
    address_bn?: string | null;
    is_active: boolean;
    users_count?: number;
    logo_left_url?: string | null;
    logo_right_url?: string | null;
}

export default function CentersIndex({ centers, canCreate }: { centers: Center[]; canCreate: boolean }) {
    const { data, setData, post, processing, errors, reset } = useForm({ name: '', code: '' });
    const add = (e: React.FormEvent) => {
        e.preventDefault();
        post('/admin/centers', { onSuccess: () => reset() });
    };

    return (
        <AppLayout header="Centers">
            <div className="space-y-6 animate-fade-in max-w-5xl">
                <div className="page-header">
                    <div>
                        <h1 className="page-title">Centers</h1>
                        <p className="page-subtitle">Configure each BITAC center's info and its PDF letterhead (header + footer that appear on every generated document).</p>
                    </div>
                </div>

                {canCreate && (
                    <form onSubmit={add} className="card">
                        <div className="card-header">
                            <h3 className="text-sm font-bold text-surface-900">Add a centre</h3>
                            <p className="text-xs text-surface-500 mt-0.5">
                                Every centre is under BITAC Head Office. After adding it, fill in its letterhead and give one
                                of its people the <b>Centre Admin</b> role in Admin → Users.
                            </p>
                        </div>
                        <div className="card-body grid grid-cols-1 sm:grid-cols-[1fr_10rem_auto] gap-3 items-start">
                            <div>
                                <input className="form-input" placeholder="BITAC Chattogram" value={data.name}
                                    onChange={e => setData('name', e.target.value)} />
                                {errors.name && <p className="form-error">{errors.name}</p>}
                            </div>
                            <div>
                                <input className="form-input font-mono uppercase" placeholder="CTG" maxLength={10} value={data.code}
                                    onChange={e => setData('code', e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))} />
                                {errors.code
                                    ? <p className="form-error">{errors.code}</p>
                                    : <p className="form-hint">In its numbers: WO-{data.code || 'CTG'}-2026-0001</p>}
                            </div>
                            <button type="submit" className="btn-primary" disabled={processing || !data.name || !data.code}>
                                <i className="fi fi-rr-plus text-xs leading-none" /> Add centre
                            </button>
                        </div>
                    </form>
                )}

                <div className="card overflow-x-auto">
                    <table className="premium-table">
                        <thead>
                            <tr>
                                <th className="w-12"></th>
                                <th>Center</th>
                                <th className="w-32">Code</th>
                                <th className="w-20 text-right">Staff</th>
                                <th>Letterhead status</th>
                                <th className="w-24 text-center">Active</th>
                                <th className="w-32 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {centers.map((c) => {
                                const hasLetterhead = !!c.name_bn && !!c.address_bn;
                                return (
                                    <tr key={c.id}>
                                        <td>
                                            {c.logo_left_url ? (
                                                <img src={c.logo_left_url} alt="" className="w-9 h-9 rounded object-contain bg-surface-50 p-1" />
                                            ) : (
                                                <div className="w-9 h-9 rounded bg-surface-100 flex items-center justify-center text-[10px] font-bold text-surface-400">
                                                    {c.code}
                                                </div>
                                            )}
                                        </td>
                                        <td>
                                            <div className="font-semibold text-surface-900">{c.name}</div>
                                            {c.name_bn && (
                                                <div className="text-xs text-surface-500 mt-0.5" style={{ fontFamily: 'Nikosh, sans-serif' }}>
                                                    {c.name_bn}
                                                </div>
                                            )}
                                        </td>
                                        <td>
                                            <span className="inline-flex items-center px-2 py-0.5 rounded bg-surface-100 text-surface-700 text-[11px] font-mono font-bold">
                                                {c.code}
                                            </span>
                                        </td>
                                        <td className="text-right tabular-nums text-surface-700">{c.users_count ?? 0}</td>
                                        <td>
                                            {hasLetterhead ? (
                                                <span className="inline-flex items-center gap-1.5 text-xs text-emerald-700">
                                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                                    Configured
                                                </span>
                                            ) : (
                                                <span className="inline-flex items-center gap-1.5 text-xs text-amber-700">
                                                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                                                    Not set up yet
                                                </span>
                                            )}
                                        </td>
                                        <td className="text-center">
                                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold ${c.is_active ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
                                                {c.is_active ? 'Active' : 'Inactive'}
                                            </span>
                                        </td>
                                        <td className="text-right">
                                            <Link href={`/admin/centers/${c.id}/edit`} className="btn-primary btn-xs">
                                                <i className="fi fi-rr-pencil text-xs leading-none" /> Edit
                                            </Link>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>
        </AppLayout>
    );
}
