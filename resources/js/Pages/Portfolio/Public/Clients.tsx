import { useMemo, useState } from 'react';
import PublicLayout from '@/Layouts/PublicLayout';
import { Empty, PageHead, Section, Stat } from './parts';

interface Props {
    clients: { name: string; type: string | null }[];
    stats: { years: number; projects: number; clients: number; centres: number };
    bitac: any; site: any; links: any;
}

export default function Clients({ clients, bitac, links }: Props) {
    const [type, setType] = useState<string | null>(null);
    const [q, setQ] = useState('');

    const shown = useMemo(() => {
        const needle = q.trim().toLowerCase();
        return clients.filter((c) =>
            (!type || c.type === type) && (!needle || c.name.toLowerCase().includes(needle)));
    }, [clients, type, q]);

    const govt = clients.filter((c) => c.type === 'Government').length;
    const priv = clients.filter((c) => c.type === 'Private').length;

    return (
        <PublicLayout title="Clients — BITAC" bitac={bitac} links={links}>
            <PageHead
                eyebrow="Who we serve"
                title="Our clients"
                lead="Government bodies and private manufacturers who bring their work to BITAC."
            />

            <Section>
                <div className="grid grid-cols-3 gap-6 mb-10 max-w-lg">
                    <Stat value={clients.length} label="Clients" />
                    <Stat value={govt} label="Government" />
                    <Stat value={priv} label="Private" />
                </div>

                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-8">
                    <div className="flex items-center gap-2">
                        {([[null, 'All'], ['Government', 'Government'], ['Private', 'Private']] as const).map(([v, l]) => (
                            <button
                                key={l}
                                type="button"
                                onClick={() => setType(v)}
                                className={`px-3.5 py-2 rounded-lg text-sm font-semibold transition-colors ${
                                    type === v ? 'bg-brand-500 text-white' : 'bg-surface-100 text-surface-600 hover:bg-surface-200'
                                }`}
                            >
                                {l}
                            </button>
                        ))}
                    </div>
                    <div className="relative w-full sm:w-64">
                        <i className="fi fi-rr-search absolute left-3 top-1/2 -translate-y-1/2 text-[11px] leading-none text-surface-400" />
                        <input
                            value={q}
                            onChange={(e) => setQ(e.target.value)}
                            placeholder="Search clients…"
                            aria-label="Search clients"
                            className="w-full pl-8 pr-3 py-2 rounded-lg border border-surface-300 text-sm outline-none focus:border-brand-400"
                        />
                    </div>
                </div>

                {shown.length ? (
                    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                        {shown.map((c) => (
                            <div key={c.name} className="flex items-center gap-3 p-4 rounded-xl bg-white border border-surface-200">
                                <span className="w-10 h-10 rounded-lg bg-brand-50 text-brand-700 flex items-center justify-center font-bold shrink-0">
                                    {c.name.charAt(0)}
                                </span>
                                <div className="min-w-0">
                                    <div className="text-sm font-semibold text-surface-900 truncate">{c.name}</div>
                                    {c.type && <div className="text-[11px] text-surface-500">{c.type}</div>}
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <Empty icon="fi-rr-building" title="No clients match" />
                )}
            </Section>
        </PublicLayout>
    );
}
