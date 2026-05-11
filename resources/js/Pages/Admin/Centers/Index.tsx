import AppLayout from '@/Layouts/AppLayout';
import { Link } from '@inertiajs/react';

interface Center {
    id: number;
    name: string;
    code: string;
    name_bn?: string | null;
    address_bn?: string | null;
    is_active: boolean;
    logo_left_url?: string | null;
    logo_right_url?: string | null;
}

export default function CentersIndex({ centers }: { centers: Center[] }) {
    return (
        <AppLayout header="Centers">
            <div className="space-y-6 animate-fade-in max-w-5xl">
                <div className="page-header">
                    <div>
                        <h1 className="page-title">Centers</h1>
                        <p className="page-subtitle">Configure each BITAC center's info and its PDF letterhead (header + footer that appear on every generated document).</p>
                    </div>
                </div>

                <div className="card overflow-hidden">
                    <table className="premium-table">
                        <thead>
                            <tr>
                                <th className="w-12"></th>
                                <th>Center</th>
                                <th className="w-32">Code</th>
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
                                                <div className="text-xs text-surface-500 mt-0.5" style={{ fontFamily: 'SiyamRupali, sans-serif' }}>
                                                    {c.name_bn}
                                                </div>
                                            )}
                                        </td>
                                        <td>
                                            <span className="inline-flex items-center px-2 py-0.5 rounded bg-surface-100 text-surface-700 text-[11px] font-mono font-bold">
                                                {c.code}
                                            </span>
                                        </td>
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
