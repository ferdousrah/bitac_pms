import { Link, router, usePage } from '@inertiajs/react';
import { PropsWithChildren, ReactNode, useState, useEffect, useRef, useCallback } from 'react';
import axios from 'axios';
import { applyTheme, type AppSettings } from '@/lib/theme';
import FloatingCalculator from '@/Components/Widgets/FloatingCalculator';
import ChatPanel from '@/Components/AiChat/ChatPanel';
import { dashboardItem, flatGroups, type NavGroup, type NavItem as TypedNavItem } from '@/lib/navigation';
import { BellRing, CloudDownload, Sparkles } from '@/Components/AnimatedIcons';
import { motion } from 'motion/react';

interface NavItem { label: string; href: string; icon: string; }
interface Notif {
    id: number; type: string; title: string; body?: string;
    icon: string; color: string; link?: string; read: boolean; created_at: string;
}

// Bottom nav — Home in center (raised), 2 items on each side
const bottomNavLeft: NavItem[] = [
    { label: 'RFQs',    href: '/rfqs',        icon: 'fi-rr-file-invoice' },
    { label: 'Quotes',  href: '/quotations',  icon: 'fi-rr-coins' },
];
const bottomNavCenter: NavItem = { label: 'Home', href: '/dashboard', icon: 'fi-rr-home' };
const bottomNavRight: NavItem[] = [
    { label: 'Orders',  href: '/work-orders', icon: 'fi-rr-tools' },
    // "More" is rendered separately
];

/* ─── PWA install prompt hook ──────────────────────────────────────── */
type BIPEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }> };

function useInstallPrompt() {
    const [deferred, setDeferred] = useState<BIPEvent | null>(null);
    const [installed, setInstalled] = useState(false);
    const [isIos, setIsIos] = useState(false);

    useEffect(() => {
        const ua = window.navigator.userAgent.toLowerCase();
        setIsIos(/iphone|ipad|ipod/.test(ua) && !(window as any).MSStream);
        const standalone = window.matchMedia('(display-mode: standalone)').matches
            || (window.navigator as any).standalone === true;
        setInstalled(standalone);

        const onPrompt = (e: Event) => { e.preventDefault(); setDeferred(e as BIPEvent); };
        const onInstalled = () => { setInstalled(true); setDeferred(null); };
        window.addEventListener('beforeinstallprompt', onPrompt);
        window.addEventListener('appinstalled', onInstalled);
        return () => {
            window.removeEventListener('beforeinstallprompt', onPrompt);
            window.removeEventListener('appinstalled', onInstalled);
        };
    }, []);

    const trigger = async () => {
        if (!deferred) return false;
        await deferred.prompt();
        await deferred.userChoice;
        setDeferred(null);
        return true;
    };

    return {
        canInstall: !!deferred || (isIos && !installed),
        installed,
        isIos,
        trigger,
    };
}

function NavLink({ item, isActive, collapsed }: { item: NavItem; isActive: boolean; collapsed?: boolean }) {
    return (
        <Link
            href={item.href}
            className={`nav-item ${isActive ? 'nav-item-active' : 'nav-item-inactive'} ${collapsed ? 'lg:justify-center lg:!px-0 lg:!mx-1' : ''}`}
            title={collapsed ? item.label : undefined}
        >
            <i className={`nav-icon fi ${item.icon} ${collapsed ? 'lg:!text-lg' : ''}`} />
            <span className={collapsed ? 'lg:hidden' : ''}>{item.label}</span>
            {isActive && <span className={`ml-auto w-1.5 h-1.5 rounded-full bg-brand-400 ${collapsed ? 'lg:hidden' : ''}`} />}
        </Link>
    );
}

export default function AppLayout({ header, children }: PropsWithChildren<{ header?: ReactNode }>) {
    const { auth, currentCenter, isSuperAdmin, availableCenters, unreadNotifications, appSettings } = usePage().props as any;
    const theme = (appSettings ?? {}) as Partial<AppSettings>;
    const userPermissions: string[] = auth?.user?.permissions ?? [];
    const navGroups = flatGroups(userPermissions, isSuperAdmin ?? false);

    // Initialize openGroup synchronously during first render to avoid the
    // closed→open flicker after every navigation. We compute the active group
    // from window.location.pathname before the DOM paints.
    // Rule: if the active page belongs to a group, that group is open.
    //       otherwise (e.g. Dashboard), no group is open.
    const [openGroup, setOpenGroup] = useState<string>(() => {
        if (typeof window === 'undefined') return '';
        const path = window.location.pathname;
        const activeGroup = navGroups.find(g => g.items.some(i => path.startsWith(i.href)));
        return activeGroup ? activeGroup.label : '';
    });
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
    const [centerOpen, setCenterOpen] = useState(false);
    const [userOpen, setUserOpen] = useState(false);
    const [moreOpen, setMoreOpen] = useState(false);
    const [notifOpen, setNotifOpen] = useState(false);
    const [notifications, setNotifications] = useState<Notif[]>([]);
    const [unreadCount, setUnreadCount] = useState<number>(unreadNotifications ?? 0);
    const [notifLoading, setNotifLoading] = useState(false);
    const [logoutConfirm, setLogoutConfirm] = useState(false);
    const [calcOpen, setCalcOpen] = useState(false);
    const install = useInstallPrompt();
    const [showIosTip, setShowIosTip] = useState(false);
    const [searchOpen, setSearchOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<any[]>([]);
    const [searchLoading, setSearchLoading] = useState(false);
    const [searchIdx, setSearchIdx] = useState(-1); // keyboard nav index
    const searchInputRef = useRef<HTMLInputElement>(null);
    const centerRef = useRef<HTMLDivElement>(null);
    const userRef = useRef<HTMLDivElement>(null);
    const notifRef = useRef<HTMLDivElement>(null);
    const currentUrl = typeof window !== 'undefined' ? window.location.pathname : '';

    // ── Sidebar accordion: keep openGroup in sync if layout persists across navigations ──
    // (Skip on initial mount since useState initializer already handled it.)
    const isInitialMount = useRef(true);
    useEffect(() => {
        if (isInitialMount.current) {
            isInitialMount.current = false;
            return;
        }
        const activeGroup = navGroups.find(g => g.items.some(i => currentUrl.startsWith(i.href)));
        const target = activeGroup ? activeGroup.label : '';
        if (target !== openGroup) {
            setOpenGroup(target);
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [currentUrl]);

    const toggleGroup = (label: string) => {
        setOpenGroup(prev => prev === label ? '' : label);
    };

    // Close dropdowns on outside click
    useEffect(() => {
        const handle = (e: MouseEvent) => {
            if (centerRef.current && !centerRef.current.contains(e.target as Node)) setCenterOpen(false);
            if (userRef.current && !userRef.current.contains(e.target as Node)) setUserOpen(false);
            if (notifRef.current && !notifRef.current.contains(e.target as Node)) setNotifOpen(false);
        };
        document.addEventListener('mousedown', handle);
        return () => document.removeEventListener('mousedown', handle);
    }, []);

    // Close mobile sidebar when a navigation STARTS (single event, no flicker).
    // Uses Inertia's router event bus so we close immediately on click,
    // regardless of whether the layout persists across navigations.
    useEffect(() => {
        const remove = router.on('start', () => {
            setSidebarOpen(false);
            setMoreOpen(false);
        });
        return () => remove();
    }, []);

    // Apply theme colors from settings
    useEffect(() => { applyTheme(theme); }, [theme.primary_color, theme.sidebar_color, theme.sidebar_accent]);

    // Alt+C / Cmd+Shift+C → toggle calculator
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if ((e.altKey && e.key.toLowerCase() === 'c') || (e.metaKey && e.shiftKey && e.key.toLowerCase() === 'c')) {
                e.preventDefault();
                setCalcOpen(prev => !prev);
            }
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, []);

    // Sync unread count from server prop
    useEffect(() => { setUnreadCount(unreadNotifications ?? 0); }, [unreadNotifications]);

    // Poll unread count every 30s
    useEffect(() => {
        const poll = setInterval(() => {
            axios.get('/notifications/unread-count').then(r => setUnreadCount(r.data.count)).catch(() => {});
        }, 30000);
        return () => clearInterval(poll);
    }, []);

    // Fetch notifications when panel opens
    const fetchNotifications = useCallback(() => {
        if (notifLoading) return;
        setNotifLoading(true);
        axios.get('/notifications').then(r => {
            setNotifications(r.data);
            setNotifLoading(false);
        }).catch(() => setNotifLoading(false));
    }, [notifLoading]);

    const openNotifPanel = () => {
        setNotifOpen(true);
        fetchNotifications();
    };

    const markRead = (id: number) => {
        axios.post(`/notifications/${id}/read`).then(() => {
            setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
            setUnreadCount(prev => Math.max(0, prev - 1));
        });
    };

    const markAllRead = () => {
        axios.post('/notifications/read-all').then(() => {
            setNotifications(prev => prev.map(n => ({ ...n, read: true })));
            setUnreadCount(0);
        });
    };

    const handleNotifClick = (n: Notif) => {
        if (!n.read) markRead(n.id);
        if (n.link) {
            setNotifOpen(false);
            router.visit(n.link);
        }
    };

    // ── Search ──────────────────────────────────────────────────────────
    // Ctrl+K / Cmd+K to open
    useEffect(() => {
        const handle = (e: KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
                e.preventDefault();
                setSearchOpen(true);
                setTimeout(() => searchInputRef.current?.focus(), 50);
            }
            if (e.key === 'Escape' && searchOpen) {
                setSearchOpen(false);
                setSearchQuery('');
                setSearchResults([]);
                setSearchIdx(-1);
            }
        };
        document.addEventListener('keydown', handle);
        return () => document.removeEventListener('keydown', handle);
    }, [searchOpen]);

    // Debounced search
    useEffect(() => {
        if (searchQuery.length < 2) { setSearchResults([]); setSearchIdx(-1); return; }
        setSearchLoading(true);
        const timer = setTimeout(() => {
            axios.get('/search', { params: { q: searchQuery } })
                .then(r => { setSearchResults(r.data); setSearchIdx(-1); })
                .catch(() => {})
                .finally(() => setSearchLoading(false));
        }, 300);
        return () => clearTimeout(timer);
    }, [searchQuery]);

    const handleSearchKey = (e: React.KeyboardEvent) => {
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            setSearchIdx(prev => Math.min(prev + 1, searchResults.length - 1));
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setSearchIdx(prev => Math.max(prev - 1, -1));
        } else if (e.key === 'Enter' && searchIdx >= 0 && searchResults[searchIdx]) {
            e.preventDefault();
            navigateToResult(searchResults[searchIdx]);
        }
    };

    const navigateToResult = (result: any) => {
        setSearchOpen(false);
        setSearchQuery('');
        setSearchResults([]);
        setSearchIdx(-1);
        if (result.link) router.visit(result.link);
    };

    // Listen for real-time notifications via Echo (if configured)
    useEffect(() => {
        if (!(window as any).Echo || !auth?.user?.id) return;
        const channel = (window as any).Echo.private(`user.${auth.user.id}`);
        channel.listen('.notification.new', (data: any) => {
            setNotifications(prev => [{ ...data, read: false }, ...prev]);
            setUnreadCount(prev => prev + 1);
        });
        return () => channel.stopListening('.notification.new');
    }, [auth?.user?.id]);

    // Toggle handler — mobile vs desktop
    const toggleSidebar = () => {
        if (window.innerWidth >= 1024) {
            setSidebarCollapsed(prev => !prev);
        } else {
            setSidebarOpen(prev => !prev);
        }
    };

    return (
        <div className="flex h-[100dvh] overflow-hidden">

            {/* ─── Desktop Sidebar ─────────────────────────────────────────── */}
            <aside
                className={`
                    hidden lg:flex fixed inset-y-0 left-0 z-50 flex-col
                    border-r border-white/5
                    transition-all duration-300 ease-out
                    ${sidebarCollapsed ? 'w-[68px]' : 'w-[260px]'}
                    lg:static
                `}
                style={{ background: `linear-gradient(to bottom, ${theme.sidebar_color || '#0f172a'}, ${theme.sidebar_accent || '#1e293b'})` }}
            >
                {/* Logo */}
                <div className={`h-16 flex items-center border-b border-white/5 shrink-0 ${sidebarCollapsed ? 'justify-center px-0' : 'px-5'}`}>
                    <div className={`flex items-center ${sidebarCollapsed ? 'justify-center' : 'gap-3'}`}>
                        {theme.logo_url ? (
                            <img src={theme.logo_url} className="w-9 h-9 rounded-xl object-cover shrink-0" alt="" />
                        ) : (
                            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-brand-400 to-brand-600 flex items-center justify-center shadow-glow shrink-0">
                                <i className="fi fi-sr-industry-windows text-white text-sm leading-none" />
                            </div>
                        )}
                        {!sidebarCollapsed && (
                            <div>
                                <div className="text-sm font-bold text-white tracking-tight">{theme.brand_name || 'BITAC PMS'}</div>
                                <div className="text-[10px] text-white/40 font-medium tracking-wider uppercase">
                                    {currentCenter?.name ?? theme.brand_subtitle ?? 'Production'}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
                <nav className="flex-1 overflow-y-auto py-4 space-y-1">
                    {/* GENERAL section — always expanded, Dashboard sits here */}
                    {!sidebarCollapsed && (
                        <div className="px-5 pb-1.5">
                            <span className="text-[10px] font-bold text-surface-300/50 uppercase tracking-[0.15em]">
                                General
                            </span>
                        </div>
                    )}
                    <NavLink
                        item={dashboardItem as TypedNavItem & { label: string; href: string; icon: string }}
                        isActive={currentUrl === '/dashboard' || currentUrl === '/'}
                        collapsed={sidebarCollapsed}
                    />

                    {/* Accordion groups */}
                    <div className={sidebarCollapsed ? '' : 'pt-2 mt-2 border-t border-white/[0.06]'} />
                    {navGroups.map(group => (
                        <SidebarGroup
                            key={group.label}
                            group={group}
                            currentUrl={currentUrl}
                            collapsed={sidebarCollapsed}
                            isOpen={openGroup === group.label}
                            onToggle={() => toggleGroup(group.label)}
                        />
                    ))}
                </nav>
                <div className="p-3 border-t border-white/5 shrink-0">
                    <a href="/dashboard/live" target="_blank" rel="noopener noreferrer" title="Live Dashboard"
                        className={`group relative flex items-center justify-center w-full rounded-xl overflow-hidden
                                   bg-gradient-to-br from-emerald-500 via-emerald-600 to-emerald-700
                                   text-white font-semibold tracking-wide
                                   border border-emerald-400/40
                                   shadow-[0_4px_14px_-2px_rgba(16,185,129,0.45),inset_0_1px_0_0_rgba(255,255,255,0.18)]
                                   hover:shadow-[0_6px_20px_-2px_rgba(16,185,129,0.65),inset_0_1px_0_0_rgba(255,255,255,0.25)]
                                   hover:border-emerald-300/60
                                   active:scale-[0.98]
                                   transition-all duration-200 ease-out
                                   ${sidebarCollapsed ? 'px-0 py-2.5' : 'px-3.5 py-2.5 gap-2.5 text-sm'}`}>
                        {/* Subtle top sheen */}
                        <span className="pointer-events-none absolute inset-x-0 top-0 h-1/2 bg-gradient-to-b from-white/15 to-transparent" />
                        {/* Pulsing red live indicator */}
                        <span className="relative flex h-2.5 w-2.5 shrink-0">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-80" />
                            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500 ring-2 ring-white/40 shadow-[0_0_8px_rgba(239,68,68,0.9)]" />
                        </span>
                        {!sidebarCollapsed && (
                            <span className="relative drop-shadow-[0_1px_1px_rgba(0,0,0,0.25)]">Live Dashboard</span>
                        )}
                    </a>
                </div>
            </aside>

            {/* ─── Mobile Drawer (Android-style) ──────────────────────────────── */}
            <MobileDrawer
                open={sidebarOpen}
                onClose={() => setSidebarOpen(false)}
                auth={auth}
                currentCenter={currentCenter}
                currentUrl={currentUrl}
                unreadCount={unreadCount}
                theme={theme}
                onLogout={() => setLogoutConfirm(true)}
                onInstall={async () => {
                    if (install.isIos) setShowIosTip(true);
                    else await install.trigger();
                }}
                canInstall={install.canInstall}
                navGroups={navGroups}
                openGroup={openGroup}
                onToggleGroup={toggleGroup}
            />

            {/* ─── Main content ────────────────────────────────────────────── */}
            <div className="flex-1 flex flex-col overflow-hidden min-w-0">

                {/* ─── Top bar ──────────────────────────────────────────────── */}
                <header className="h-16 shrink-0 bg-white/80 backdrop-blur-xl border-b border-surface-100 flex items-center justify-between px-4 lg:px-6 z-30">
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                        {/* Sidebar toggle */}
                        <button
                            onClick={toggleSidebar}
                            className="btn-icon btn-ghost -ml-1 shrink-0"
                            title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
                        >
                            <i className={`fi ${
                                sidebarOpen ? 'fi-rr-cross' :
                                sidebarCollapsed ? 'fi-rr-menu-burger' :
                                'fi-rr-sidebar'
                            } text-lg leading-none`} />
                        </button>

                        {/* Page header */}
                        {header && (
                            <h1 className="text-lg font-bold text-surface-900 truncate shrink-0">{header}</h1>
                        )}

                        {/* Search trigger — inline in left area */}
                        <button
                            onClick={() => { setSearchOpen(true); setTimeout(() => searchInputRef.current?.focus(), 50); }}
                            className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-xl border border-surface-200 bg-surface-50/80 hover:bg-white hover:border-surface-300 transition-all text-surface-400 text-sm cursor-pointer ml-2 max-w-xs flex-1"
                        >
                            <i className="fi fi-rr-search text-sm leading-none shrink-0" />
                            <span className="flex-1 text-left truncate">Search...</span>
                            <kbd className="hidden lg:inline-flex items-center gap-0.5 px-1.5 py-0.5 bg-white border border-surface-200 rounded-md text-[10px] font-mono text-surface-400 shrink-0">
                                Ctrl K
                            </kbd>
                        </button>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                        {/* Mobile search icon */}
                        <button
                            onClick={() => { setSearchOpen(true); setTimeout(() => searchInputRef.current?.focus(), 50); }}
                            className="md:hidden p-2 rounded-xl hover:bg-surface-50 transition-colors text-surface-500"
                        >
                            <i className="fi fi-rr-search text-lg leading-none" />
                        </button>

                        {/* Center switcher */}
                        {currentCenter && (
                            <div ref={centerRef} className="relative">
                                <button
                                    onClick={() => isSuperAdmin && setCenterOpen(!centerOpen)}
                                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold
                                        bg-brand-50 text-brand-700 border border-brand-200
                                        transition-all duration-150
                                        ${isSuperAdmin ? 'cursor-pointer hover:bg-brand-100 hover:border-brand-300' : 'cursor-default'}`}
                                >
                                    <i className="fi fi-rr-building leading-none" />
                                    <span className="hidden sm:inline">{currentCenter.name}</span>
                                    <span className="sm:hidden">{currentCenter.code}</span>
                                    {isSuperAdmin && <i className="fi fi-rr-angle-small-down leading-none text-brand-400" />}
                                </button>

                                {isSuperAdmin && centerOpen && (
                                    <div className="absolute right-0 mt-2 w-56 bg-white rounded-2xl shadow-premium-lg border border-surface-100 z-50 py-1 animate-scale-in origin-top-right">
                                        <div className="px-4 py-2.5 text-[10px] font-bold text-surface-400 uppercase tracking-widest border-b border-surface-50">
                                            Switch Center
                                        </div>
                                        {availableCenters?.map((c: any) => (
                                            <button key={c.id}
                                                onClick={() => { router.post('/switch-center', { center_id: c.id }); setCenterOpen(false); }}
                                                className={`w-full text-left px-4 py-2.5 text-sm hover:bg-brand-50 flex items-center gap-2.5 transition-colors
                                                    ${c.id === currentCenter.id ? 'text-brand-700 font-semibold' : 'text-surface-700'}`}
                                            >
                                                <i className="fi fi-rr-marker leading-none text-surface-400" />
                                                {c.name}
                                                {c.id === currentCenter.id && <i className="fi fi-rr-check leading-none text-brand-500 ml-auto" />}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Calculator */}
                        <button
                            onClick={() => setCalcOpen(!calcOpen)}
                            title="Calculator (Alt+C)"
                            className={`p-2 rounded-xl transition-colors ${calcOpen ? 'bg-brand-50 text-brand-600' : 'text-surface-500 hover:bg-surface-50'}`}
                        >
                            <i className={`fi ${calcOpen ? 'fi-rr-cross' : 'fi-rr-calculator'} text-lg leading-none`} />
                        </button>

                        {/* Notifications bell */}
                        <div ref={notifRef} className="relative">
                            <button
                                onClick={openNotifPanel}
                                className="relative p-2 rounded-xl hover:bg-surface-50 transition-colors"
                            >
                                <BellRing
                                    play={unreadCount > 0}
                                    className={`w-5 h-5 ${notifOpen ? 'text-brand-600' : 'text-surface-500'}`}
                                    strokeWidth={notifOpen ? 2.4 : 2}
                                    fill={notifOpen ? 'currentColor' : 'none'}
                                />
                                {unreadCount > 0 && (
                                    <span className="absolute -top-0.5 -right-0.5 min-w-5 h-5 flex items-center justify-center px-1 rounded-full bg-red-500 text-white text-[10px] font-bold border-2 border-white">
                                        {unreadCount > 99 ? '99+' : unreadCount}
                                    </span>
                                )}
                            </button>

                            {notifOpen && (
                                <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white rounded-2xl shadow-premium-lg border border-surface-100 z-50 animate-scale-in origin-top-right flex flex-col max-h-[70vh]">
                                    {/* Header */}
                                    <div className="px-4 py-3 border-b border-surface-100 flex items-center justify-between shrink-0">
                                        <div>
                                            <h3 className="text-sm font-bold text-surface-900">Notifications</h3>
                                            {unreadCount > 0 && (
                                                <p className="text-[11px] text-surface-400">{unreadCount} unread</p>
                                            )}
                                        </div>
                                        {unreadCount > 0 && (
                                            <button onClick={markAllRead} className="text-xs font-semibold text-brand-600 hover:text-brand-700">
                                                Mark all read
                                            </button>
                                        )}
                                    </div>

                                    {/* List */}
                                    <div className="overflow-y-auto flex-1">
                                        {notifLoading && notifications.length === 0 ? (
                                            <div className="py-10 text-center">
                                                <i className="fi fi-rr-spinner animate-spin text-surface-300 text-xl leading-none" />
                                            </div>
                                        ) : notifications.length === 0 ? (
                                            <div className="py-10 text-center">
                                                <i className="fi fi-rr-bell text-surface-200 text-2xl leading-none" />
                                                <p className="text-xs text-surface-400 mt-2">No notifications yet</p>
                                            </div>
                                        ) : (
                                            notifications.map(n => (
                                                <button
                                                    key={n.id}
                                                    onClick={() => handleNotifClick(n)}
                                                    className={`w-full text-left px-4 py-3 flex gap-3 hover:bg-surface-50 transition-colors border-b border-surface-50 last:border-0
                                                        ${!n.read ? 'bg-brand-50/30' : ''}`}
                                                >
                                                    <NotifIcon icon={n.icon} color={n.color} />
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex items-start justify-between gap-2">
                                                            <p className={`text-sm leading-tight ${!n.read ? 'font-semibold text-surface-900' : 'text-surface-700'}`}>
                                                                {n.title}
                                                            </p>
                                                            {!n.read && <span className="w-2 h-2 rounded-full bg-brand-500 shrink-0 mt-1.5" />}
                                                        </div>
                                                        {n.body && (
                                                            <p className="text-xs text-surface-500 mt-0.5 line-clamp-2">{n.body}</p>
                                                        )}
                                                        <p className="text-[10px] text-surface-400 mt-1">{n.created_at}</p>
                                                    </div>
                                                </button>
                                            ))
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* User menu */}
                        <div ref={userRef} className="relative">
                            <button
                                onClick={() => setUserOpen(!userOpen)}
                                className={`flex items-center gap-2 pl-1 pr-2 py-1 rounded-xl transition-all
                                    ${userOpen ? 'bg-surface-100' : 'hover:bg-surface-50'}`}
                            >
                                <div className="relative">
                                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-surface-800 to-surface-900 flex items-center justify-center text-white text-xs font-bold shrink-0 ring-2 ring-white shadow-sm">
                                        {(auth?.user?.name || auth?.customer?.name || 'U').charAt(0).toUpperCase()}
                                    </div>
                                    {/* Online indicator */}
                                    <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-emerald-500 border-2 border-white" />
                                </div>
                                <span className="hidden md:block text-sm font-semibold text-surface-700 truncate max-w-32">
                                    {auth?.user?.name || auth?.customer?.name}
                                </span>
                                <i className={`fi fi-rr-angle-small-down leading-none text-surface-400 hidden md:block transition-transform duration-200 ${userOpen ? 'rotate-180' : ''}`} />
                            </button>

                            {userOpen && (
                                <div className="absolute right-0 mt-2 w-72 bg-white rounded-2xl shadow-[0_20px_60px_-15px_rgba(0,0,0,0.3)] border border-surface-100 z-50 overflow-hidden animate-scale-in origin-top-right">
                                    {/* ── Profile Header with gradient background ─── */}
                                    <div className="relative px-5 pt-5 pb-4 bg-gradient-to-br from-surface-900 via-surface-850 to-surface-950 overflow-hidden">
                                        {/* Decorative background */}
                                        <div className="absolute -top-10 -right-10 w-32 h-32 rounded-full bg-brand-500/10 blur-2xl" />
                                        <div className="absolute -bottom-10 -left-10 w-32 h-32 rounded-full bg-brand-400/10 blur-2xl" />

                                        <div className="relative flex items-center gap-3">
                                            <div className="relative">
                                                <div className="w-14 h-14 rounded-full bg-gradient-to-br from-brand-400 to-brand-600 flex items-center justify-center text-white text-xl font-bold ring-4 ring-white/10 shadow-[0_4px_16px_rgba(255,122,15,0.35)]">
                                                    {(auth?.user?.name || auth?.customer?.name || 'U').charAt(0).toUpperCase()}
                                                </div>
                                                <span className="absolute bottom-0 right-0 w-3.5 h-3.5 rounded-full bg-emerald-500 border-2 border-surface-900 shadow-sm" />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-bold text-white truncate">{auth?.user?.name || auth?.customer?.name}</p>
                                                <p className="text-[11px] text-white/50 truncate">{auth?.user?.email}</p>
                                                {auth?.user?.is_super_admin && (
                                                    <span className="inline-flex items-center gap-1 mt-1.5 px-2 py-0.5 rounded-full bg-brand-500/20 border border-brand-400/30 text-brand-300 text-[9px] font-bold uppercase tracking-wider">
                                                        <i className="fi fi-sr-shield-check text-[8px] leading-none" />
                                                        Super Admin
                                                    </span>
                                                )}
                                            </div>
                                        </div>

                                        {/* Current center chip */}
                                        {currentCenter && (
                                            <div className="relative mt-3 pt-3 border-t border-white/10 flex items-center gap-2">
                                                <i className="fi fi-rr-building text-white/40 text-xs leading-none" />
                                                <span className="text-[11px] text-white/60">
                                                    <span className="text-white/40">at</span> <span className="font-semibold text-white/90">{currentCenter.name}</span>
                                                </span>
                                            </div>
                                        )}
                                    </div>

                                    {/* ── Menu items ────────────────────────────── */}
                                    <div className="p-2">
                                        <Link href="/profile"
                                            className="group flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-surface-700 hover:bg-surface-50 transition-colors">
                                            <div className="w-8 h-8 rounded-lg bg-surface-100 group-hover:bg-brand-50 flex items-center justify-center transition-colors">
                                                <i className="fi fi-rr-user text-surface-600 group-hover:text-brand-600 text-sm leading-none transition-colors" />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="font-semibold text-surface-800">My Profile</div>
                                                <div className="text-[11px] text-surface-400">Personal information & preferences</div>
                                            </div>
                                            <i className="fi fi-rr-angle-small-right text-surface-300 group-hover:text-surface-500 text-sm leading-none transition-colors" />
                                        </Link>

                                        <Link href="/notifications"
                                            className="group flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-surface-700 hover:bg-surface-50 transition-colors">
                                            <div className="w-8 h-8 rounded-lg bg-surface-100 group-hover:bg-blue-50 flex items-center justify-center transition-colors">
                                                <i className="fi fi-rr-bell text-surface-600 group-hover:text-blue-600 text-sm leading-none transition-colors" />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="font-semibold text-surface-800">Notifications</div>
                                                <div className="text-[11px] text-surface-400">{unreadCount > 0 ? `${unreadCount} unread` : 'All caught up'}</div>
                                            </div>
                                            {unreadCount > 0 && (
                                                <span className="badge badge-red text-[9px]">{unreadCount}</span>
                                            )}
                                        </Link>

                                        {/* Install App (only when supported and not already installed) */}
                                        {install.canInstall && (
                                            <motion.button
                                                whileHover="hover"
                                                onClick={async () => {
                                                    setUserOpen(false);
                                                    if (install.isIos) {
                                                        setShowIosTip(true);
                                                    } else {
                                                        await install.trigger();
                                                    }
                                                }}
                                                className="group w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm hover:bg-brand-50 transition-colors"
                                            >
                                                <div className="w-8 h-8 rounded-lg bg-brand-50 group-hover:bg-brand-100 flex items-center justify-center transition-colors">
                                                    <CloudDownload className="w-4 h-4 text-brand-600" strokeWidth={2.4} />
                                                </div>
                                                <div className="flex-1 min-w-0 text-left">
                                                    <div className="font-semibold text-surface-800">Install App</div>
                                                    <div className="text-[11px] text-surface-400">Use BITAC PMS as a standalone app</div>
                                                </div>
                                                <span className="badge bg-brand-100 text-brand-700 border-brand-200 text-[9px]">NEW</span>
                                            </motion.button>
                                        )}

                                        {/* Divider */}
                                        <div className="my-1.5 border-t border-surface-100" />

                                        <button
                                            onClick={() => { setUserOpen(false); setLogoutConfirm(true); }}
                                            className="group w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm hover:bg-red-50 transition-colors"
                                        >
                                            <div className="w-8 h-8 rounded-lg bg-red-50 group-hover:bg-red-100 flex items-center justify-center transition-colors">
                                                <i className="fi fi-rr-exit text-red-600 text-sm leading-none" />
                                            </div>
                                            <div className="flex-1 min-w-0 text-left">
                                                <div className="font-semibold text-red-600">Sign Out</div>
                                                <div className="text-[11px] text-red-400/70">End your session</div>
                                            </div>
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </header>

                {/* ─── Page content ─────────────────────────────────────────── */}
                <main className="flex-1 overflow-y-auto">
                    <div className="p-4 lg:p-6 pb-24 lg:pb-6 max-w-[1440px] mx-auto page-enter">
                        <FlashMessages />
                        {children}
                    </div>
                </main>
            </div>

            {/* ─── iOS Install Tip Modal ────────────────────────────────────── */}
            {showIosTip && (
                <>
                    <div className="fixed inset-0 z-[70] bg-black/50 backdrop-blur-sm animate-fade-in" onClick={() => setShowIosTip(false)} />
                    <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center p-4">
                        <div className="bg-white rounded-2xl shadow-premium-lg border border-surface-100 w-full max-w-sm animate-scale-in overflow-hidden p-5">
                            <div className="flex items-center gap-3 mb-4">
                                <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-brand-400 to-brand-600 flex items-center justify-center text-white shadow-glow shrink-0">
                                    <CloudDownload className="w-5 h-5" strokeWidth={2.4} />
                                </div>
                                <div>
                                    <h3 className="text-base font-bold text-surface-900">Install on iOS</h3>
                                    <div className="text-xs text-surface-500">Add BITAC PMS to your Home Screen</div>
                                </div>
                            </div>
                            <ol className="text-sm text-surface-700 space-y-2.5 list-decimal list-inside marker:text-brand-500 marker:font-bold">
                                <li>Tap the <strong>Share</strong> icon <i className="fi fi-rr-share text-brand-500 mx-0.5" /> at the bottom of Safari</li>
                                <li>Scroll down and tap <strong>Add to Home Screen</strong></li>
                                <li>Tap <strong>Add</strong> in the top right corner</li>
                            </ol>
                            <button onClick={() => setShowIosTip(false)} className="mt-5 w-full btn-primary">
                                Got it
                            </button>
                        </div>
                    </div>
                </>
            )}

            {/* ─── Logout Confirmation Modal ────────────────────────────────── */}
            {logoutConfirm && (
                <>
                    <div className="fixed inset-0 z-[70] bg-black/50 backdrop-blur-sm animate-fade-in" onClick={() => setLogoutConfirm(false)} />
                    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
                        <div className="bg-white rounded-2xl shadow-premium-lg border border-surface-100 w-full max-w-sm animate-scale-in overflow-hidden">
                            <div className="p-6 text-center">
                                <div className="w-14 h-14 rounded-2xl bg-red-50 flex items-center justify-center mx-auto mb-4">
                                    <i className="fi fi-rr-exit text-red-500 text-2xl leading-none" />
                                </div>
                                <h3 className="text-lg font-bold text-surface-900">Sign Out?</h3>
                                <p className="text-sm text-surface-500 mt-2">Are you sure you want to sign out of your account?</p>
                            </div>
                            <div className="px-6 pb-6 flex gap-3">
                                <button
                                    onClick={() => setLogoutConfirm(false)}
                                    className="btn-outline flex-1"
                                >
                                    Cancel
                                </button>
                                <Link
                                    href="/logout"
                                    method="post"
                                    as="button"
                                    className="btn-danger flex-1"
                                >
                                    <i className="fi fi-rr-exit text-sm leading-none" />
                                    Sign Out
                                </Link>
                            </div>
                        </div>
                    </div>
                </>
            )}

            {/* ─── Global Search Modal ──────────────────────────────────────── */}
            {searchOpen && (
                <>
                    <div className="fixed inset-0 z-[60] bg-black/40 backdrop-blur-sm animate-fade-in" onClick={() => { setSearchOpen(false); setSearchQuery(''); setSearchResults([]); setSearchIdx(-1); }} />
                    <div className="fixed inset-x-0 top-0 z-[60] flex justify-center pt-[15vh] sm:pt-[12vh] px-4">
                        <div className="w-full max-w-lg bg-white rounded-2xl shadow-premium-lg border border-surface-100 animate-scale-in overflow-hidden">
                            {/* Search input */}
                            <div className="flex items-center gap-3 px-4 py-3 border-b border-surface-100">
                                <i className={`fi fi-rr-search text-lg leading-none ${searchLoading ? 'animate-pulse-soft text-brand-500' : 'text-surface-400'}`} />
                                <input
                                    ref={searchInputRef}
                                    type="text"
                                    value={searchQuery}
                                    onChange={e => setSearchQuery(e.target.value)}
                                    onKeyDown={handleSearchKey}
                                    placeholder="Search work orders, RFQs, quotations, customers..."
                                    className="flex-1 bg-transparent border-none outline-none text-sm text-surface-900 placeholder:text-surface-400 focus:ring-0 p-0"
                                    autoComplete="off"
                                />
                                <kbd className="hidden sm:inline-flex items-center px-1.5 py-0.5 bg-surface-100 rounded-md text-[10px] font-mono text-surface-400">
                                    ESC
                                </kbd>
                            </div>

                            {/* Results */}
                            <div className="max-h-[50vh] overflow-y-auto">
                                {searchQuery.length < 2 ? (
                                    <div className="px-4 py-8 text-center">
                                        <i className="fi fi-rr-search text-surface-200 text-3xl leading-none" />
                                        <p className="text-xs text-surface-400 mt-3">Type at least 2 characters to search</p>
                                        <div className="flex flex-wrap justify-center gap-2 mt-4">
                                            {['WO-2026', 'Bangladesh Railway', 'RFQ #', 'Shaft'].map(hint => (
                                                <button key={hint} onClick={() => setSearchQuery(hint)}
                                                    className="px-2.5 py-1 bg-surface-50 border border-surface-200 rounded-lg text-xs text-surface-500 hover:bg-surface-100 transition-colors">
                                                    {hint}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                ) : searchLoading && searchResults.length === 0 ? (
                                    <div className="px-4 py-8 text-center">
                                        <i className="fi fi-rr-spinner animate-spin text-surface-300 text-xl leading-none" />
                                        <p className="text-xs text-surface-400 mt-2">Searching...</p>
                                    </div>
                                ) : searchResults.length === 0 && searchQuery.length >= 2 ? (
                                    <div className="px-4 py-8 text-center">
                                        <i className="fi fi-rr-interrogation text-surface-200 text-2xl leading-none" />
                                        <p className="text-xs text-surface-500 mt-2 font-medium">No results for "{searchQuery}"</p>
                                        <p className="text-[11px] text-surface-400 mt-1">Try a Job number, customer name, or RFQ ID</p>
                                    </div>
                                ) : (
                                    <>
                                        {/* Group by type */}
                                        {(() => {
                                            const grouped: Record<string, any[]> = {};
                                            searchResults.forEach(r => {
                                                (grouped[r.type] ??= []).push(r);
                                            });
                                            let globalIdx = -1;
                                            return Object.entries(grouped).map(([type, items]) => (
                                                <div key={type}>
                                                    <div className="px-4 py-1.5 bg-surface-50 sticky top-0">
                                                        <span className="text-[10px] font-bold text-surface-400 uppercase tracking-widest">{type}s</span>
                                                    </div>
                                                    {items.map(r => {
                                                        globalIdx++;
                                                        const idx = globalIdx;
                                                        return (
                                                            <button
                                                                key={`${r.type}-${r.title}-${idx}`}
                                                                onClick={() => navigateToResult(r)}
                                                                onMouseEnter={() => setSearchIdx(idx)}
                                                                className={`w-full text-left px-4 py-2.5 flex items-center gap-3 transition-colors
                                                                    ${idx === searchIdx ? 'bg-brand-50' : 'hover:bg-surface-50'}`}
                                                            >
                                                                <SearchIcon icon={r.icon} color={r.color} />
                                                                <div className="flex-1 min-w-0">
                                                                    <p className="text-sm font-medium text-surface-900 truncate">{r.title}</p>
                                                                    <p className="text-xs text-surface-500 truncate">{r.sub}</p>
                                                                </div>
                                                                {r.badge && (
                                                                    <span className="badge badge-slate text-[10px]">{r.badge?.replace(/_/g, ' ')}</span>
                                                                )}
                                                                <i className="fi fi-rr-angle-small-right text-surface-300 leading-none" />
                                                            </button>
                                                        );
                                                    })}
                                                </div>
                                            ));
                                        })()}
                                    </>
                                )}
                            </div>

                            {/* Footer */}
                            {searchResults.length > 0 && (
                                <div className="px-4 py-2 border-t border-surface-100 flex items-center justify-between text-[10px] text-surface-400">
                                    <span>{searchResults.length} result{searchResults.length !== 1 && 's'}</span>
                                    <div className="flex items-center gap-2">
                                        <span className="flex items-center gap-1"><kbd className="px-1 py-0.5 bg-surface-100 rounded text-[9px] font-mono">↑↓</kbd> navigate</span>
                                        <span className="flex items-center gap-1"><kbd className="px-1 py-0.5 bg-surface-100 rounded text-[9px] font-mono">↵</kbd> open</span>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </>
            )}

            {/* ─── Mobile Bottom Nav ────────────────────────────────────────── */}
            <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-40 safe-area-bottom">
                {/* Background with notch cutout for raised center button */}
                <div className="absolute inset-0 bg-white/90 backdrop-blur-xl border-t border-surface-100" />

                <div className="relative flex items-end">
                    {/* Left items */}
                    {bottomNavLeft.map(item => (
                        <BottomTab key={item.href} item={item} currentUrl={currentUrl} />
                    ))}

                    {/* Center — raised Home button */}
                    {(() => {
                        const isActive = currentUrl === '/dashboard' || currentUrl === '/';
                        return (
                            <Link
                                href={bottomNavCenter.href}
                                className="flex-1 flex flex-col items-center -mt-5 touch-target"
                            >
                                <div className={`
                                    w-14 h-14 rounded-2xl flex items-center justify-center
                                    shadow-premium-lg transition-all duration-200
                                    active:scale-90
                                    ${isActive
                                        ? 'bg-gradient-to-br from-brand-500 to-brand-600 shadow-glow'
                                        : 'bg-surface-900 shadow-premium-lg'
                                    }
                                `}>
                                    <i className={`fi ${isActive ? 'fi-sr' : 'fi-rr'}-home text-white text-xl leading-none`} />
                                </div>
                                <span className={`text-[10px] font-bold mt-1 ${isActive ? 'text-brand-600' : 'text-surface-400'}`}>
                                    Home
                                </span>
                            </Link>
                        );
                    })()}

                    {/* Right items */}
                    {bottomNavRight.map(item => (
                        <BottomTab key={item.href} item={item} currentUrl={currentUrl} />
                    ))}

                    {/* More button */}
                    <button
                        onClick={() => setMoreOpen(true)}
                        className={`flex-1 flex flex-col items-center justify-center gap-0.5 py-2.5 touch-target
                            active:scale-90 transition-transform
                            ${moreOpen ? 'text-brand-600' : 'text-surface-400'}`}
                    >
                        <i className={`fi ${moreOpen ? 'fi-sr' : 'fi-rr'}-apps text-xl leading-none`} />
                        <span className="text-[10px] font-semibold">More</span>
                    </button>
                </div>
            </nav>

            {/* ─── "More" Bottom Sheet (mobile) ────────────────────────────────── */}
            {moreOpen && (
                <>
                    <div
                        className="lg:hidden fixed inset-0 z-50 bg-black/40 backdrop-blur-sm animate-fade-in"
                        onClick={() => setMoreOpen(false)}
                    />
                    <div className="lg:hidden fixed bottom-0 left-0 right-0 z-50 bg-white rounded-t-3xl shadow-premium-lg animate-slide-up safe-area-bottom max-h-[80dvh] flex flex-col">
                        {/* Handle */}
                        <div className="flex justify-center pt-3 pb-1 shrink-0">
                            <div className="w-10 h-1 rounded-full bg-surface-200" />
                        </div>

                        <div className="overflow-y-auto px-2 pb-4">
                            {/* Render each group as a section with icon grid */}
                            {navGroups.map(group => {
                                const itemsToShow = group.items.filter(n =>
                                    n.href !== bottomNavCenter.href &&
                                    !bottomNavLeft.some(b => b.href === n.href) &&
                                    !bottomNavRight.some(b => b.href === n.href)
                                );
                                if (itemsToShow.length === 0) return null;
                                return (
                                    <div key={group.label}>
                                        <div className="px-3 pt-3 pb-1 flex items-center gap-2">
                                            <i className={`fi ${group.icon} text-xs leading-none text-brand-500`} />
                                            <span className="text-[10px] font-bold text-surface-400 uppercase tracking-widest">{group.label}</span>
                                        </div>
                                        <div className="grid grid-cols-4 gap-1 px-1">
                                            {itemsToShow.map(item => {
                                                const isActive = currentUrl.startsWith(item.href);
                                                return (
                                                    <Link key={item.href} href={item.href} onClick={() => setMoreOpen(false)}
                                                        className={`flex flex-col items-center gap-1.5 py-3 px-1 rounded-2xl transition-colors
                                                            ${isActive ? 'bg-brand-50 text-brand-600' : 'text-surface-600 hover:bg-surface-50 active:bg-surface-100'}`}>
                                                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center
                                                            ${isActive ? 'bg-brand-100' : 'bg-surface-100'}`}>
                                                            <i className={`fi ${item.icon} text-base leading-none`} />
                                                        </div>
                                                        <span className="text-[10px] font-semibold text-center leading-tight">{item.label}</span>
                                                    </Link>
                                                );
                                            })}
                                        </div>
                                    </div>
                                );
                            })}

                            {/* Live Dashboard link */}
                            <div className="px-3 pt-4">
                                <a
                                    href="/dashboard/live"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex items-center justify-center gap-2 w-full py-3 rounded-2xl
                                               bg-gradient-to-r from-emerald-600 to-emerald-500
                                               text-white text-sm font-semibold shadow-premium"
                                >
                                    <span className="relative flex h-2 w-2">
                                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75" />
                                        <span className="relative inline-flex rounded-full h-2 w-2 bg-white" />
                                    </span>
                                    Live Dashboard
                                </a>
                            </div>
                        </div>
                    </div>
                </>
            )}

            {/* Sidebar overlay handled inside MobileDrawer */}

            {/* ─── Scientific Calculator (triggered from header) ─────────── */}
            <FloatingCalculator open={calcOpen} onClose={() => setCalcOpen(false)} />

            {/* AI Chat Panel */}
            <ChatPanel />
        </div>
    );
}

const NOTIF_ICON_BG: Record<string, string> = {
    blue:   'bg-blue-100 text-blue-600',
    green:  'bg-emerald-100 text-emerald-600',
    red:    'bg-red-100 text-red-600',
    amber:  'bg-amber-100 text-amber-600',
    brand:  'bg-brand-100 text-brand-600',
    purple: 'bg-purple-100 text-purple-600',
};

/* ─── Sidebar Accordion Group ─────────────────────────────────────── */
function SidebarGroup({ group, currentUrl, collapsed, isOpen, onToggle }: {
    group: NavGroup;
    currentUrl: string;
    collapsed?: boolean;
    isOpen: boolean;
    onToggle: () => void;
}) {
    const hasActiveItem = group.items.some(i => currentUrl.startsWith(i.href));

    // ─── Collapsed (icon-only) sidebar ─────────────────────────────────
    // Show one parent-group icon; on hover reveal a fixed-position
    // popover with the group title + sub-items list.
    const [popTop, setPopTop] = useState<number | null>(null);
    const iconRef = useRef<HTMLDivElement>(null);
    const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

    const openPop = () => {
        if (closeTimer.current) { clearTimeout(closeTimer.current); closeTimer.current = null; }
        if (iconRef.current) {
            const rect = iconRef.current.getBoundingClientRect();
            setPopTop(rect.top);
        }
    };
    const schedulePopClose = () => {
        if (closeTimer.current) clearTimeout(closeTimer.current);
        closeTimer.current = setTimeout(() => setPopTop(null), 120);
    };

    // Close popover on scroll (its anchored position would otherwise drift)
    useEffect(() => {
        if (popTop === null) return;
        const onScroll = () => setPopTop(null);
        window.addEventListener('scroll', onScroll, true);
        return () => window.removeEventListener('scroll', onScroll, true);
    }, [popTop]);

    if (collapsed) {
        return (
            <>
                <div
                    ref={iconRef}
                    className="px-2"
                    onMouseEnter={openPop}
                    onMouseLeave={schedulePopClose}
                >
                    <div
                        className={`nav-item lg:justify-center lg:!px-0 lg:!mx-0 cursor-pointer
                            ${hasActiveItem ? 'nav-item-active' : 'nav-item-inactive'}`}
                        title={group.label}
                    >
                        <i className={`nav-icon fi ${group.icon} !text-lg`} />
                    </div>
                </div>

                {popTop !== null && (
                    <div
                        className="fixed z-[100] pl-2 animate-fade-in"
                        style={{ left: 68, top: popTop }}
                        onMouseEnter={openPop}
                        onMouseLeave={schedulePopClose}
                    >
                        <div className="bg-surface-900 border border-white/10 rounded-xl shadow-2xl py-1.5 min-w-[220px]">
                            <div className="px-3 py-1.5 mb-0.5 border-b border-white/10">
                                <div className="text-[10px] font-bold uppercase tracking-[0.12em] text-brand-400">
                                    {group.label}
                                </div>
                            </div>
                            {group.items.map(item => {
                                const active = currentUrl.startsWith(item.href);
                                return (
                                    <Link
                                        key={item.href}
                                        href={item.href}
                                        onClick={() => setPopTop(null)}
                                        className={`flex items-center gap-2.5 px-3 py-2 text-[13px] font-medium transition-colors
                                            border-l-2
                                            ${active
                                                ? 'text-white bg-brand-500/15 border-brand-500'
                                                : 'text-surface-300 hover:bg-white/5 hover:text-white border-transparent'}`}
                                    >
                                        <i className={`fi ${item.icon} text-xs leading-none ${active ? 'text-brand-400' : 'text-surface-400'}`} />
                                        <span className="truncate">{item.label}</span>
                                    </Link>
                                );
                            })}
                        </div>
                    </div>
                )}
            </>
        );
    }

    return (
        <div className="px-2">
            {/* Accordion header */}
            <button
                onClick={onToggle}
                className={`hover-draw-icon relative w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl transition-all duration-200
                    ${hasActiveItem
                        ? 'text-white bg-brand-500/15 border border-brand-500/40 shadow-[inset_0_0_0_1px_rgba(255,122,15,0.1)]'
                        : 'text-surface-300/70 hover:text-white hover:bg-white/[0.04] border border-transparent'}`}
            >
                <i className={`fi ${group.icon} text-base leading-none shrink-0 ${hasActiveItem ? 'text-brand-400' : ''}`} />
                <span className="flex-1 text-left text-[11px] font-bold uppercase tracking-[0.12em]">
                    {group.label}
                </span>
                <i className={`fi fi-rr-angle-small-down text-sm leading-none transition-transform duration-300 ease-out
                    ${isOpen ? 'rotate-0 text-brand-400' : '-rotate-90 text-surface-300/50'}`} />
            </button>

            {/* Accordion panel with smooth CSS grid height animation */}
            <div className={`accordion-panel ${isOpen ? 'is-open' : ''}`}>
                <div>
                    <div className="py-2 pl-7">
                        {(() => {
                            const activeIndex = group.items.findIndex(i => currentUrl.startsWith(i.href));
                            const N = group.items.length;
                            // Bottom offset = half of one item (to stop at center of last item)
                            const bottomOffset = N > 0 ? `${(0.5 / N) * 100}%` : '50%';
                            // Brand line height reaches the center of the active item,
                            // measured from the top of the panel (-8px to extend into py-2 padding)
                            const brandHeight = activeIndex >= 0 && N > 0
                                ? `calc(${((activeIndex + 0.5) / N) * 100}% + 8px)`
                                : '0px';

                            return (
                                <div className="relative">
                                    {/* Neutral base trunk — from top of panel to center of last item */}
                                    {N > 0 && (
                                        <span
                                            className="absolute left-[-12px] w-px bg-white/25 pointer-events-none"
                                            style={{ top: '-8px', bottom: bottomOffset }}
                                        />
                                    )}
                                    {/* Brand overlay — smoothly grows from parent header down to active item */}
                                    {N > 0 && (
                                        <span
                                            className="absolute left-[-12px] w-px bg-brand-500 pointer-events-none
                                                       transition-[height] duration-700 ease-out"
                                            style={{
                                                top: '-8px',
                                                height: brandHeight,
                                                transitionDelay: '150ms',
                                            }}
                                        />
                                    )}
                                    {group.items.map((item, idx) => (
                                        <SidebarSubItem key={item.href}
                                            item={item}
                                            isActive={idx === activeIndex}
                                            isBeforeActive={activeIndex !== -1 && idx < activeIndex} />
                                    ))}
                                </div>
                            );
                        })()}
                    </div>
                </div>
            </div>
        </div>
    );
}

/* ─── Sub-item with horizontal connector (trunk drawn by parent) ───── */
function SidebarSubItem({ item, isActive, isBeforeActive }: {
    item: TypedNavItem; isActive: boolean; isBeforeActive?: boolean;
}) {
    return (
        <Link href={item.href}
            className={`relative flex items-center pl-3 pr-3 py-2 my-0.5 rounded-lg text-[13px] font-medium transition-all duration-150
                ${isActive
                    ? 'text-white bg-surface-800/80 shadow-sm'
                    : 'text-surface-300/70 hover:text-white hover:bg-white/[0.03]'}`}
        >
            {/* Horizontal connector: from trunk to link edge */}
            <span className={`absolute left-[-12px] top-1/2 -translate-y-1/2 w-3 h-px pointer-events-none
                transition-colors duration-500 ease-out
                ${(isActive || isBeforeActive) ? 'bg-brand-500' : 'bg-white/25'}`}
                style={{ transitionDelay: isActive ? '600ms' : '0ms' }}
            />
            <span className="truncate">{item.label}</span>
            {isActive && (
                <span className="ml-auto relative flex h-1.5 w-1.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-brand-500 opacity-75" />
                    <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-brand-500" />
                </span>
            )}
        </Link>
    );
}

function NotifIcon({ icon, color }: { icon: string; color: string }) {
    return (
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${NOTIF_ICON_BG[color] ?? NOTIF_ICON_BG.blue}`}>
            <i className={`fi ${icon} text-sm leading-none`} />
        </div>
    );
}

function SearchIcon({ icon, color }: { icon: string; color: string }) {
    return (
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${NOTIF_ICON_BG[color] ?? NOTIF_ICON_BG.blue}`}>
            <i className={`fi ${icon} text-xs leading-none`} />
        </div>
    );
}

/* ─── Mobile Nav Accordion Group ──────────────────────────────────── */
function MobileNavGroup({ group, currentUrl, onClose, isOpen, onToggle }: {
    group: NavGroup; currentUrl: string; onClose: () => void;
    isOpen: boolean; onToggle: () => void;
}) {
    const hasActiveItem = group.items.some(i => currentUrl.startsWith(i.href));

    return (
        <div>
            <button onClick={onToggle}
                className={`hover-draw-icon relative w-full flex items-center gap-3 px-5 py-3.5 touch-target transition-colors
                    ${hasActiveItem ? 'text-brand-700' : 'text-surface-600 hover:bg-surface-50 active:bg-surface-100'}`}>
                {hasActiveItem && (
                    <span className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-7 rounded-r-full bg-brand-500" />
                )}
                <i className={`fi ${group.icon} text-base leading-none ${hasActiveItem ? 'text-brand-500' : 'text-surface-400'}`} />
                <span className="flex-1 text-left text-[11px] font-bold uppercase tracking-[0.12em]">
                    {group.label}
                </span>
                <i className={`fi fi-rr-angle-small-right text-base leading-none transition-transform duration-300 ease-out
                    ${isOpen ? 'rotate-90 text-brand-500' : 'text-surface-400'}`} />
            </button>

            <div className={`accordion-panel ${isOpen ? 'is-open' : ''}`}>
                <div>
                    <div className="py-1 bg-surface-50/50 pl-8">
                        {(() => {
                            const activeIndex = group.items.findIndex(i => currentUrl.startsWith(i.href));
                            const N = group.items.length;
                            const bottomOffset = N > 0 ? `${(0.5 / N) * 100}%` : '50%';
                            // Extend trunk 22px above the relative container so it reaches
                            // into the parent button area (button py-3.5 + panel py-1 ≈ 18px gap)
                            const brandHeight = activeIndex >= 0 && N > 0
                                ? `calc(${((activeIndex + 0.5) / N) * 100}% + 22px)`
                                : '0px';

                            return (
                                <div className="relative">
                                    {/* Neutral base trunk */}
                                    {N > 0 && (
                                        <span
                                            className="absolute left-0 w-px bg-surface-200 pointer-events-none"
                                            style={{ top: '-22px', bottom: bottomOffset }}
                                        />
                                    )}
                                    {/* Brand overlay — draws from parent down to active item */}
                                    {N > 0 && activeIndex >= 0 && (
                                        <span
                                            className="absolute left-0 w-px bg-brand-500 pointer-events-none
                                                       transition-[height] duration-700 ease-out"
                                            style={{
                                                top: '-22px',
                                                height: brandHeight,
                                                transitionDelay: '150ms',
                                            }}
                                        />
                                    )}
                                    {group.items.map((item, idx) => (
                                        <MobileNavLink key={item.href}
                                            item={item}
                                            currentUrl={currentUrl}
                                            onClose={onClose}
                                            asSubItem
                                            isBeforeActive={false} />
                                    ))}
                                </div>
                            );
                        })()}
                    </div>
                </div>
            </div>
        </div>
    );
}

function MobileNavLink({ item, currentUrl, asSubItem, isBeforeActive }: {
    item: TypedNavItem; currentUrl: string; onClose?: () => void; asSubItem?: boolean; isLast?: boolean; isBeforeActive?: boolean;
}) {
    const isActive = item.href === '/dashboard'
        ? (currentUrl === '/dashboard' || currentUrl === '/')
        : currentUrl.startsWith(item.href);

    // Sub-item mode: no icon, trunk is drawn by parent, only horizontal connector here
    // NOTE: no manual onClose — drawer auto-closes via router.on('start') in the parent
    if (asSubItem) {
        return (
            <Link href={item.href}
                className={`relative flex items-center pl-5 pr-5 py-3 text-sm font-medium transition-colors touch-target
                    ${isActive ? 'text-brand-700 bg-brand-50' : 'text-surface-600 hover:bg-surface-100 active:bg-surface-200'}`}
            >
                {/* Horizontal connector — only the active row gets brand colour */}
                <span className={`absolute left-0 top-1/2 -translate-y-1/2 w-3 h-px pointer-events-none
                    transition-colors duration-300 ease-out
                    ${isActive ? 'bg-brand-500' : 'bg-surface-200'}`}
                />
                <span className="ml-2">{item.label}</span>
                {isActive && (
                    <span className="ml-auto relative flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-brand-500 opacity-75" />
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-brand-500" />
                    </span>
                )}
            </Link>
        );
    }

    // Top-level mode: with icon (Dashboard)
    return (
        <Link href={item.href}
            className={`flex items-center gap-3.5 px-5 py-3 text-sm font-medium transition-colors touch-target
                ${isActive
                    ? 'bg-brand-50 text-brand-700 border-r-[3px] border-brand-500'
                    : 'text-surface-700 hover:bg-surface-50 active:bg-surface-100'}`}>
            <i className={`fi ${item.icon} text-base leading-none ${isActive ? 'text-brand-500' : 'text-surface-400'}`} />
            <span>{item.label}</span>
            {isActive && <span className="ml-auto w-1.5 h-1.5 rounded-full bg-brand-500" />}
        </Link>
    );
}

/* ─── Android-style Mobile Drawer ────────────────────────────────────── */
function MobileDrawer({ open, onClose, auth, currentCenter, currentUrl, unreadCount, theme, onLogout, onInstall, canInstall, navGroups, openGroup, onToggleGroup }: {
    open: boolean; onClose: () => void; auth: any; currentCenter: any; currentUrl: string; unreadCount: number; theme: Partial<AppSettings>; onLogout: () => void;
    onInstall: () => void; canInstall: boolean;
    navGroups: NavGroup[];
    openGroup: string;
    onToggleGroup: (label: string) => void;
}) {
    const drawerRef = useRef<HTMLDivElement>(null);
    const startX = useRef(0);
    const currentX = useRef(0);
    const isDragging = useRef(false);

    // Swipe-to-close gesture (only triggers on actual horizontal drag)
    const hasMoved = useRef(false);
    const onTouchStart = (e: React.TouchEvent) => {
        startX.current = e.touches[0].clientX;
        currentX.current = e.touches[0].clientX;  // initialize to start position
        hasMoved.current = false;
        isDragging.current = true;
    };
    const onTouchMove = (e: React.TouchEvent) => {
        if (!isDragging.current) return;
        currentX.current = e.touches[0].clientX;
        const diff = startX.current - currentX.current;
        // Require at least 5px of movement before considering it a drag
        if (Math.abs(diff) > 5) hasMoved.current = true;
        if (diff > 0 && drawerRef.current) {
            drawerRef.current.style.transform = `translateX(-${Math.min(diff, 300)}px)`;
        }
    };
    const onTouchEnd = () => {
        if (!isDragging.current) return;
        isDragging.current = false;
        if (drawerRef.current) drawerRef.current.style.transform = '';
        // Only close if user actually swiped (not just tapped)
        if (!hasMoved.current) return;
        const diff = startX.current - currentX.current;
        if (diff > 80) onClose();
    };

    const userName = auth?.user?.name || auth?.customer?.name || 'User';
    const userEmail = auth?.user?.email || '';
    const initials = userName.split(' ').map((w: string) => w[0]).join('').toUpperCase().slice(0, 2);

    return (
        <>
            {/* Scrim / overlay */}
            <div
                className={`lg:hidden fixed inset-0 z-[55] bg-black/50 transition-opacity duration-300
                    ${open ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}
                onClick={onClose}
            />

            {/* Drawer */}
            <div
                ref={drawerRef}
                onTouchStart={onTouchStart}
                onTouchMove={onTouchMove}
                onTouchEnd={onTouchEnd}
                className={`lg:hidden fixed inset-y-0 left-0 z-[56] w-[85vw] max-w-[320px] bg-white flex flex-col
                    shadow-[4px_0_24px_rgba(0,0,0,0.15)]
                    transition-transform duration-300 ease-out
                    ${open ? 'translate-x-0' : '-translate-x-full'}`}
            >
                {/* ── Profile Header ─────────────────────────────────── */}
                <div className="px-5 pt-10 pb-5 safe-area-top"
                    style={{ background: `linear-gradient(135deg, ${theme.sidebar_color || '#0f172a'}, ${theme.sidebar_accent || '#1e293b'})` }}>
                    <div className="flex items-center gap-3">
                        <div className="w-14 h-14 rounded-full bg-gradient-to-br from-brand-400 to-brand-600 flex items-center justify-center text-white text-lg font-bold shadow-lg ring-2 ring-white/20">
                            {initials}
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-white font-bold text-base truncate">{userName}</p>
                            <p className="text-surface-400 text-xs truncate">{userEmail}</p>
                            {currentCenter && (
                                <span className="inline-flex items-center gap-1 mt-1.5 px-2 py-0.5 bg-white/10 rounded-md text-[10px] text-brand-300 font-semibold">
                                    <i className="fi fi-rr-building leading-none" />
                                    {currentCenter.name}
                                </span>
                            )}
                        </div>
                    </div>
                    {/* Quick stats */}
                    <div className="flex gap-4 mt-4 pt-3 border-t border-white/10">
                        <Link href="/notifications" onClick={onClose} className="text-center flex-1">
                            <div className="text-white font-bold text-sm">{unreadCount}</div>
                            <div className="text-surface-400 text-[10px] uppercase tracking-wider">Alerts</div>
                        </Link>
                        <Link href="/work-orders" onClick={onClose} className="text-center flex-1">
                            <div className="text-white font-bold text-sm"><i className="fi fi-rr-tools leading-none" /></div>
                            <div className="text-surface-400 text-[10px] uppercase tracking-wider">Orders</div>
                        </Link>
                        <Link href="/profile" onClick={onClose} className="text-center flex-1">
                            <div className="text-white font-bold text-sm"><i className="fi fi-rr-settings leading-none" /></div>
                            <div className="text-surface-400 text-[10px] uppercase tracking-wider">Profile</div>
                        </Link>
                    </div>
                </div>

                {/* ── Navigation ──────────────────────────────────────── */}
                <nav className="flex-1 overflow-y-auto py-3">
                    {/* GENERAL section — always visible */}
                    <div className="px-5 pb-2">
                        <span className="text-[10px] font-bold text-surface-400 uppercase tracking-[0.15em]">
                            General
                        </span>
                    </div>
                    <MobileNavLink item={dashboardItem} currentUrl={currentUrl} onClose={onClose} />

                    <div className="mt-3 pt-3 border-t border-surface-100" />

                    {/* Accordion groups */}
                    {navGroups.map(group => (
                        <MobileNavGroup key={group.label}
                            group={group}
                            currentUrl={currentUrl}
                            onClose={onClose}
                            isOpen={openGroup === group.label}
                            onToggle={() => onToggleGroup(group.label)} />
                    ))}
                </nav>

                {/* ── Footer ──────────────────────────────────────────── */}
                <div className="border-t border-surface-100 p-3 space-y-2 shrink-0">
                    <a href="/dashboard/live" target="_blank" rel="noopener noreferrer"
                        className="flex items-center justify-center gap-2 w-full py-3 rounded-xl
                                   bg-gradient-to-r from-emerald-600 to-emerald-500 text-white text-sm font-semibold shadow-premium">
                        <span className="relative flex h-2 w-2">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75" />
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-white" />
                        </span>
                        Live Dashboard
                    </a>
                    {canInstall && (
                        <motion.button
                            whileHover="hover"
                            onClick={() => { onClose(); onInstall(); }}
                            className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl
                                       bg-brand-50 border border-brand-200 text-brand-700 text-sm font-semibold
                                       hover:bg-brand-100 hover:border-brand-300 transition-colors">
                            <CloudDownload className="w-4 h-4" strokeWidth={2.4} />
                            Install App
                        </motion.button>
                    )}
                    <button onClick={() => { onClose(); onLogout(); }}
                        className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl text-sm text-red-600 hover:bg-red-50 transition-colors font-medium">
                        <i className="fi fi-rr-exit leading-none" />
                        Sign Out
                    </button>
                </div>
            </div>
        </>
    );
}

function BottomTab({ item, currentUrl }: { item: NavItem; currentUrl: string }) {
    const isActive = currentUrl.startsWith(item.href);
    return (
        <Link
            href={item.href}
            className={`flex-1 flex flex-col items-center justify-center gap-0.5 py-2.5 relative
                touch-target active:scale-90 transition-transform
                ${isActive ? 'text-brand-600' : 'text-surface-400'}`}
        >
            {isActive && (
                <span className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 rounded-full bg-brand-500" />
            )}
            <i className={`fi ${isActive ? 'fi-sr' : 'fi-rr'}-${item.icon.replace('fi-rr-', '')} text-xl leading-none`} />
            <span className="text-[10px] font-semibold">{item.label}</span>
        </Link>
    );
}

function FlashMessages() {
    const { flash } = usePage().props as any;
    const [visible, setVisible] = useState(true);

    useEffect(() => {
        if (flash?.success || flash?.error) {
            setVisible(true);
            const t = setTimeout(() => setVisible(false), 5000);
            return () => clearTimeout(t);
        }
    }, [flash?.success, flash?.error]);

    if (!visible || (!flash?.success && !flash?.error)) return null;

    return (
        <div className="mb-5">
            {flash.success && (
                <div className="alert alert-success">
                    <i className="fi fi-rr-check-circle text-emerald-500 text-base leading-none shrink-0 mt-0.5" />
                    <span className="flex-1">{flash.success}</span>
                    <button onClick={() => setVisible(false)} className="text-emerald-400 hover:text-emerald-600 shrink-0">
                        <i className="fi fi-rr-cross-small leading-none" />
                    </button>
                </div>
            )}
            {flash.error && (
                <div className="alert alert-error">
                    <i className="fi fi-rr-cross-circle text-red-500 text-base leading-none shrink-0 mt-0.5" />
                    <span className="flex-1">{flash.error}</span>
                    <button onClick={() => setVisible(false)} className="text-red-400 hover:text-red-600 shrink-0">
                        <i className="fi fi-rr-cross-small leading-none" />
                    </button>
                </div>
            )}
        </div>
    );
}
