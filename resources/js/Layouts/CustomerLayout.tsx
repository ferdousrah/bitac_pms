import { Link, router, usePage } from '@inertiajs/react';
import { ReactNode } from 'react';
import NotificationBell from '@/Components/Customer/NotificationBell';

interface Props {
    title?: string;
    backHref?: string;
    backLabel?: string;
    children: ReactNode;
    width?: 'narrow' | 'wide';
}

const NAV_ITEMS: { href: string; label: string; icon: string; external?: boolean }[] = [
    { href: '/customer/dashboard',    label: 'Dashboard',                icon: 'fi-rr-apps' },
    { href: '/customer/rfqs',         label: 'My RFQs',                  icon: 'fi-rr-file-invoice' },
    { href: '/customer/work-orders',  label: 'My Orders',                icon: 'fi-rr-clipboard-list' },
    { href: '/customer/invoices',     label: 'Invoices',                 icon: 'fi-rr-receipt' },
    { href: '/customer/documents',    label: 'Documents',                icon: 'fi-rr-folder-open' },
    { href: '/customer/complaints',   label: 'Feedback/Compliment',      icon: 'fi-rr-comment-alt' },
    { href: '/portfolio',             label: 'Our Work',                 icon: 'fi-rr-briefcase',          external: true },
];

export default function CustomerLayout({ title, backHref, backLabel, children, width = 'wide' }: Props) {
    const { props } = usePage<any>();
    const customer = props.auth?.user ?? props.customer;
    const flash = props.flash ?? {};
    const currentPath = typeof window !== 'undefined' ? window.location.pathname : '';
    const maxW = width === 'narrow' ? 'max-w-4xl' : 'max-w-6xl';
    const theme = (props.appSettings ?? {}) as { logo_url?: string | null; brand_name?: string };
    const brandName = theme.brand_name || 'BITAC';
    const currentYear = new Date().getFullYear();

    const displayName = customer?.contact_person ?? customer?.name ?? 'Customer';
    const initial = (displayName).charAt(0).toUpperCase();

    return (
        <div className="min-h-screen bg-surface-50 flex flex-col">
            {/* Top accent gradient line — subtle brand signature */}
            <div className="h-1 bg-gradient-to-r from-brand-400 via-brand-500 to-brand-600 shrink-0" />

            {/* Top Nav */}
            <nav className="bg-white border-b border-surface-100 shadow-[0_1px_3px_rgba(15,23,42,0.04)] sticky top-1 z-30">
                <div className={`${maxW} mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-4`}>
                    <Link href="/customer/dashboard" className="flex items-center gap-3 shrink-0 group">
                        {theme.logo_url ? (
                            <div className="w-11 h-11 rounded-xl bg-white p-1 ring-1 ring-surface-200/70 flex items-center justify-center shrink-0 group-hover:ring-brand-300 transition-all">
                                <img src={theme.logo_url} alt={brandName} className="w-full h-full object-contain" />
                            </div>
                        ) : (
                            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-brand-400 to-brand-600 text-white flex items-center justify-center shadow-md shrink-0">
                                <span className="font-bold text-base">B</span>
                            </div>
                        )}
                        <div className="leading-tight">
                            <div className="flex items-center gap-1.5">
                                <p className="font-bold text-surface-900 text-[15px]">{brandName}</p>
                                <span className="hidden sm:inline-flex items-center px-1.5 py-0.5 rounded-md bg-brand-50 text-brand-700 text-[9px] font-bold uppercase tracking-wider">
                                    Customer Portal
                                </span>
                            </div>
                            <p className="text-[11px] text-surface-400 mt-0.5 hidden sm:block tracking-wide">
                                Bangladesh Industrial Technical Assistance Centre
                            </p>
                        </div>
                    </Link>

                    <div className="flex items-center gap-2 sm:gap-3">
                        <NotificationBell initialUnread={props.customerNotifications?.unread_count ?? 0} />

                        {/* Vertical divider — separates bell from profile chip */}
                        <div className="hidden sm:block w-px h-8 bg-surface-100" />

                        {/* Customer profile chip */}
                        <div className="hidden md:flex items-center gap-2.5 pl-1 pr-2 py-1 rounded-xl hover:bg-surface-50 transition-colors">
                            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-brand-400 to-brand-600 text-white flex items-center justify-center font-bold text-xs shadow-sm">
                                {initial}
                            </div>
                            <div className="leading-tight min-w-0">
                                <p className="text-[13px] font-semibold text-surface-900 truncate max-w-[160px]">{displayName}</p>
                                <p className="text-[10px] text-surface-400 uppercase tracking-wider font-semibold">Customer</p>
                            </div>
                        </div>

                        <button
                            type="button"
                            onClick={() => router.post('/customer/logout')}
                            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold text-surface-600 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                            title="Sign out"
                        >
                            <i className="fi fi-rr-sign-out-alt leading-none text-xs" />
                            <span className="hidden sm:inline">Logout</span>
                        </button>
                    </div>
                </div>

                {/* Secondary nav row — clean tab style with stronger active state */}
                <div className="border-t border-surface-100 bg-gradient-to-b from-white to-surface-50/40">
                    <div className={`${maxW} mx-auto px-2 sm:px-4 overflow-x-auto`}>
                        <div className="flex items-center gap-0.5 text-sm">
                            {NAV_ITEMS.map(item => {
                                const active = !item.external && (currentPath === item.href || (item.href !== '/customer/dashboard' && currentPath.startsWith(item.href)));
                                const className = `relative flex items-center gap-1.5 px-3 py-3 whitespace-nowrap transition-colors ${
                                    active
                                        ? 'text-brand-600 font-semibold'
                                        : 'text-surface-500 hover:text-surface-900 hover:bg-surface-100/60 rounded-lg'
                                }`;
                                const activeBar = active && (
                                    <span className="absolute left-2 right-2 bottom-0 h-[2.5px] rounded-t-full bg-gradient-to-r from-brand-400 to-brand-600" />
                                );
                                // External links (e.g. public portfolio) open in a
                                // new tab so the customer keeps their portal session.
                                if (item.external) {
                                    return (
                                        <a key={item.href} href={item.href} target="_blank" rel="noreferrer noopener" className={className}>
                                            <i className={`fi ${item.icon} leading-none text-xs`} />
                                            {item.label}
                                            <i className="fi fi-rr-arrow-up-right-from-square text-[9px] leading-none opacity-60" />
                                            {activeBar}
                                        </a>
                                    );
                                }
                                return (
                                    <Link key={item.href} href={item.href} className={className}>
                                        <i className={`fi ${item.icon} leading-none text-xs`} />
                                        {item.label}
                                        {activeBar}
                                    </Link>
                                );
                            })}
                        </div>
                    </div>
                </div>
            </nav>

            <div className={`${maxW} mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6 animate-fade-in flex-1 w-full`}>
                {flash.success && (
                    <div className="rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm px-4 py-2.5 flex items-start gap-2">
                        <i className="fi fi-rr-check-circle text-emerald-600 leading-none text-base mt-0.5" />
                        <span>{flash.success}</span>
                    </div>
                )}
                {flash.error && (
                    <div className="rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-sm px-4 py-2.5 flex items-start gap-2">
                        <i className="fi fi-rr-cross-circle text-rose-600 leading-none text-base mt-0.5" />
                        <span>{flash.error}</span>
                    </div>
                )}

                {(title || backHref) && (
                    <div className="flex items-center justify-between gap-4">
                        <div>
                            {backHref && (
                                <Link href={backHref} className="text-xs text-surface-500 hover:text-brand-600 inline-flex items-center gap-1 mb-1">
                                    <i className="fi fi-rr-arrow-left leading-none text-[10px]" /> {backLabel ?? 'Back'}
                                </Link>
                            )}
                            {title && <h1 className="text-xl sm:text-2xl font-bold text-surface-900">{title}</h1>}
                        </div>
                    </div>
                )}

                {children}
            </div>

            {/* Footer */}
            <footer className="bg-white border-t border-surface-100 mt-auto">
                <div className={`${maxW} mx-auto px-4 sm:px-6 py-5`}>
                    <div className="flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-surface-500">
                        <div className="flex items-center gap-2.5">
                            {theme.logo_url ? (
                                <img src={theme.logo_url} alt={brandName} className="w-7 h-7 object-contain shrink-0 opacity-80" />
                            ) : (
                                <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-brand-400 to-brand-600 text-white flex items-center justify-center shrink-0">
                                    <span className="font-bold text-[10px]">B</span>
                                </div>
                            )}
                            <span className="text-center sm:text-left">
                                &copy; {currentYear} <span className="font-semibold text-surface-700">Bangladesh Industrial Technical Assistance Centre</span>. All rights reserved.
                            </span>
                        </div>
                        <div className="flex items-center gap-1.5">
                            <span>Developed by</span>
                            <a
                                href="https://technocratsbd.com"
                                target="_blank"
                                rel="noreferrer noopener"
                                className="font-semibold text-brand-600 hover:text-brand-700 hover:underline inline-flex items-center gap-1"
                            >
                                Technocrats <i className="fi fi-rr-arrow-up-right-from-square text-[9px] leading-none" />
                            </a>
                        </div>
                    </div>
                </div>
            </footer>
        </div>
    );
}
