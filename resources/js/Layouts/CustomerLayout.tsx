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

const NAV_ITEMS = [
    { href: '/customer/dashboard',    label: 'Dashboard',   icon: 'fi-rr-apps' },
    { href: '/customer/rfqs',         label: 'My RFQs',     icon: 'fi-rr-file-invoice' },
    { href: '/customer/work-orders',  label: 'My Orders',   icon: 'fi-rr-clipboard-list' },
    { href: '/customer/invoices',     label: 'Invoices',    icon: 'fi-rr-receipt' },
    { href: '/customer/documents',    label: 'Documents',   icon: 'fi-rr-folder-open' },
    { href: '/customer/complaints',   label: 'Feedback/Compliment',  icon: 'fi-rr-comment-alt' },
];

export default function CustomerLayout({ title, backHref, backLabel, children, width = 'wide' }: Props) {
    const { props } = usePage<any>();
    const customer = props.auth?.user ?? props.customer;
    const flash = props.flash ?? {};
    const currentPath = typeof window !== 'undefined' ? window.location.pathname : '';
    const maxW = width === 'narrow' ? 'max-w-4xl' : 'max-w-6xl';

    return (
        <div className="min-h-screen bg-surface-50">
            {/* Top Nav */}
            <nav className="bg-white border-b border-surface-100 shadow-sm sticky top-0 z-30">
                <div className={`${maxW} mx-auto px-4 sm:px-6 py-3.5 flex items-center justify-between gap-4`}>
                    <Link href="/customer/dashboard" className="flex items-center gap-3 shrink-0">
                        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-brand-400 to-brand-600 text-white flex items-center justify-center shadow-md">
                            <span className="font-bold text-sm">B</span>
                        </div>
                        <div>
                            <p className="font-bold text-surface-900 text-sm leading-tight">BITAC Customer Portal</p>
                            <p className="text-xs text-surface-400 leading-tight hidden sm:block">Project management</p>
                        </div>
                    </Link>

                    <div className="flex items-center gap-2">
                        <NotificationBell initialUnread={props.customerNotifications?.unread_count ?? 0} />
                        <span className="text-sm font-medium text-surface-700 hidden md:inline ml-1">{customer?.contact_person ?? customer?.name}</span>
                        <button
                            type="button"
                            onClick={() => router.post('/customer/logout')}
                            className="btn-ghost btn-xs"
                        >
                            <i className="fi fi-rr-sign-out-alt leading-none text-xs" /> Logout
                        </button>
                    </div>
                </div>

                {/* Secondary nav row */}
                <div className={`${maxW} mx-auto px-4 sm:px-6 -mb-px overflow-x-auto`}>
                    <div className="flex items-center gap-1 text-sm">
                        {NAV_ITEMS.map(item => {
                            const active = currentPath === item.href || (item.href !== '/customer/dashboard' && currentPath.startsWith(item.href));
                            return (
                                <Link
                                    key={item.href}
                                    href={item.href}
                                    className={`flex items-center gap-1.5 px-3 py-2.5 border-b-2 whitespace-nowrap transition-colors ${
                                        active
                                            ? 'border-brand-500 text-brand-600 font-semibold'
                                            : 'border-transparent text-surface-500 hover:text-surface-800 hover:border-surface-200'
                                    }`}
                                >
                                    <i className={`fi ${item.icon} leading-none text-xs`} />
                                    {item.label}
                                </Link>
                            );
                        })}
                    </div>
                </div>
            </nav>

            <div className={`${maxW} mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6 animate-fade-in`}>
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
        </div>
    );
}
