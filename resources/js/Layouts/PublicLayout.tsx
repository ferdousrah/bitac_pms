import { Head, Link } from '@inertiajs/react';
import { ReactNode } from 'react';

interface BitacInfo {
    name_bn?: string | null;
    name_en?: string | null;
    caption?: string | null;
    ministry_bn?: string | null;
    government_bn?: string | null;
    address_bn?: string | null;
    address?: string | null;
    phone_bn?: string | null;
    phone?: string | null;
    email?: string | null;
    website?: string | null;
    logo_left?: string | null;
}

interface Props {
    title: string;
    bitac?: BitacInfo;
    children: ReactNode;
}

/**
 * Marketing-style chrome for the public Portfolio. Intentionally distinct from
 * AppLayout — no sidebar, no auth header, simple BITAC branded top + footer.
 * Designed so it works the same whether hosted at /portfolio or under a
 * future portfolio.bitac.gov.bd subdomain.
 */
export default function PublicLayout({ title, bitac, children }: Props) {
    return (
        <div className="min-h-screen bg-surface-50 flex flex-col">
            <Head title={title} />

            {/* Top branding bar */}
            <header className="bg-white border-b border-surface-200">
                <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex items-center justify-between gap-4">
                    <Link href="/portfolio" className="flex items-center gap-3 group">
                        {bitac?.logo_left && (
                            <img src={bitac.logo_left} alt="BITAC" className="h-12 w-12 object-contain" />
                        )}
                        <div className="min-w-0">
                            {bitac?.caption && (
                                <div className="text-[10px] uppercase tracking-wider text-brand-600 font-semibold">
                                    {bitac.caption}
                                </div>
                            )}
                            <div className="text-base font-bold text-surface-900 group-hover:text-brand-600 transition-colors truncate">
                                {bitac?.name_bn || 'বাংলাদেশ শিল্প কারিগরি সহায়তা কেন্দ্র (বিটাক)'}
                            </div>
                            <div className="text-[11px] text-surface-500 hidden sm:block truncate">
                                {bitac?.ministry_bn || 'শিল্প মন্ত্রণালয়'} · {bitac?.government_bn || 'গণপ্রজাতন্ত্রী বাংলাদেশ সরকার'}
                            </div>
                        </div>
                    </Link>
                    <nav className="flex items-center gap-3 text-sm shrink-0">
                        <Link
                            href="/portfolio"
                            className="text-surface-600 hover:text-brand-600 font-medium transition-colors"
                        >
                            Portfolio
                        </Link>
                        <a
                            href="/login"
                            className="hidden sm:inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-surface-50 hover:bg-surface-100 text-surface-700 text-xs font-semibold border border-surface-200"
                        >
                            <i className="fi fi-rr-user text-[10px] leading-none" />
                            Staff Login
                        </a>
                    </nav>
                </div>
            </header>

            {/* Main content */}
            <main className="flex-1">{children}</main>

            {/* Footer with BITAC contact */}
            <footer className="bg-surface-900 text-surface-300 mt-12">
                <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10 grid grid-cols-1 md:grid-cols-3 gap-8">
                    <div>
                        <div className="text-sm font-bold text-white mb-2">
                            {bitac?.name_bn || 'বাংলাদেশ শিল্প কারিগরি সহায়তা কেন্দ্র'}
                        </div>
                        <div className="text-xs text-surface-400 leading-relaxed">
                            {bitac?.address_bn || '১১৬ (খ), তেজগাঁও শিল্প এলাকা, ঢাকা-১২০৮'}
                        </div>
                        {bitac?.address && (
                            <div className="text-xs text-surface-400 mt-1">{bitac.address}</div>
                        )}
                    </div>
                    <div>
                        <div className="text-xs font-bold text-white uppercase tracking-wider mb-2">Contact</div>
                        {(bitac?.phone || bitac?.phone_bn) && (
                            <div className="text-xs text-surface-400">
                                <span className="font-semibold">Phone:</span> {bitac?.phone_bn || bitac?.phone}
                            </div>
                        )}
                        {bitac?.email && (
                            <div className="text-xs text-surface-400 mt-1">
                                <span className="font-semibold">Email:</span>{' '}
                                <a href={`mailto:${bitac.email}`} className="hover:text-white underline">{bitac.email}</a>
                            </div>
                        )}
                        {bitac?.website && (
                            <div className="text-xs text-surface-400 mt-1">
                                <span className="font-semibold">Web:</span>{' '}
                                <a href={`https://${bitac.website}`} target="_blank" rel="noopener noreferrer" className="hover:text-white underline">{bitac.website}</a>
                            </div>
                        )}
                    </div>
                    <div>
                        <div className="text-xs font-bold text-white uppercase tracking-wider mb-2">About</div>
                        <p className="text-xs text-surface-400 leading-relaxed">
                            BITAC offers industrial training, import-substitute manufacturing, testing, and R&amp;D services for government and private sector clients across Bangladesh since 1962.
                        </p>
                    </div>
                </div>
                <div className="border-t border-surface-800 py-3 text-center text-[10px] text-surface-500">
                    © {new Date().getFullYear()} BITAC — Bangladesh Industrial Technical Assistance Centre
                </div>
            </footer>
        </div>
    );
}
