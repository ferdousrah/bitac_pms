/**
 * Application navigation structure — grouped by department for the sidebar.
 *
 * Each item can declare a `permission` it requires; groups are auto-hidden
 * if all of their items are filtered out by the user's permissions.
 */

export interface NavItem {
    label: string;
    href: string;
    icon: string;
    permission?: string;          // single permission required
    permissionAny?: string[];      // any of these permissions
    badgeKey?: string;              // key to look up dynamic badge count
}

export interface NavGroup {
    label: string;
    icon: string;
    items: NavItem[];
    children?: NavGroup[];          // for two-level (Admin)
}

/* ─── Top-level (no group) ─────────────────────────────────────────── */
export const dashboardItem: NavItem = {
    label: 'Dashboard',
    href: '/dashboard',
    icon: 'fi-rr-chart-tree',
};

/* ─── Main groups (single-level) ───────────────────────────────────── */
export const mainGroups: NavGroup[] = [
    {
        label: 'IED',
        icon: 'fi-rr-pencil-ruler',
        items: [
            { label: 'RFQs',           href: '/rfqs',           icon: 'fi-rr-file-invoice', permission: 'view rfqs' },
            { label: 'Cost Estimates', href: '/cost-estimates', icon: 'fi-rr-calculator',   permission: 'view cost-estimates' },
            { label: 'Quotations',     href: '/quotations',     icon: 'fi-rr-coins',        permission: 'view quotations' },
            { label: 'Approvals',      href: '/approvals',      icon: 'fi-rr-stamp',        permission: 'approve quotations' },
        ],
    },
    {
        label: 'PCD',
        icon: 'fi-rr-clipboard-list-check',
        items: [
            { label: 'PCD Inbox',            href: '/pcd/inbox',                 icon: 'fi-rr-inbox',           permission: 'view pcd-inbox', badgeKey: 'pcd_pending' },
            { label: 'Material Requisitions',href: '/pcd/material-requisitions', icon: 'fi-rr-clipboard-list',  permission: 'create material-requisitions' },
            { label: 'Work Orders',          href: '/work-orders',               icon: 'fi-rr-tools',           permission: 'view work-orders' },
            { label: 'Operation Sheets',     href: '/operation-sheets',          icon: 'fi-rr-document',        permission: 'view operation-sheets' },
            { label: 'Schedule',             href: '/schedule',                  icon: 'fi-rr-calendar',        permission: 'view schedule' },
        ],
    },
    {
        label: 'Production',
        icon: 'fi-rr-industry-windows',
        items: [
            { label: 'Shop Floor', href: '/shop-floor', icon: 'fi-rr-industry-windows', permission: 'view shop-floor' },
            { label: 'WIP',        href: '/wip',        icon: 'fi-rr-settings',         permission: 'view wip' },
        ],
    },
    {
        label: 'Quality',
        icon: 'fi-rr-shield-check',
        items: [
            { label: 'QC Inspections', href: '/qc',   icon: 'fi-rr-shield-check',    permission: 'view qc' },
            { label: 'NCRs',           href: '/ncrs', icon: 'fi-rr-triangle-warning',permission: 'view qc' },
        ],
    },
    {
        label: 'Delivery & Billing',
        icon: 'fi-rr-truck-side',
        items: [
            { label: 'Delivery Orders', href: '/delivery', icon: 'fi-rr-truck-side', permission: 'view delivery' },
            { label: 'Invoices',        href: '/invoices', icon: 'fi-rr-receipt',    permission: 'view invoices' },
        ],
    },
    {
        label: 'Reports',
        icon: 'fi-rr-stats',
        items: [
            { label: 'Production',     href: '/reports/production',     icon: 'fi-rr-chart-histogram', permission: 'view reports' },
            { label: 'OEE',            href: '/reports/oee',            icon: 'fi-rr-gauge',           permission: 'view reports' },
            { label: 'Lead Time',      href: '/reports/lead-time',      icon: 'fi-rr-clock-three',     permission: 'view reports' },
            { label: 'Rejection Rate', href: '/reports/rejection-rate', icon: 'fi-rr-cross-circle',    permission: 'view reports' },
        ],
    },
    {
        label: 'Collaboration',
        icon: 'fi-rr-users',
        items: [
            { label: 'Meeting Room',       href: '/meetings',         icon: 'fi-rr-video-camera-alt' },
            { label: 'Meeting Analytics',  href: '/meeting-analytics',icon: 'fi-rr-chart-simple' },
            { label: 'My Files',           href: '/files',            icon: 'fi-rr-folder' },
        ],
    },
];

/* ─── Admin (two-level) ────────────────────────────────────────────── */
export const adminGroup: NavGroup = {
    label: 'Admin',
    icon: 'fi-rr-shield',
    items: [],
    children: [
        {
            label: 'Master Data',
            icon: 'fi-rr-database',
            items: [
                { label: 'Sections',   href: '/admin/sections',   icon: 'fi-rr-sitemap',              permission: 'manage sections' },
                { label: 'Machines',   href: '/admin/machines',   icon: 'fi-rr-settings',             permission: 'manage machines' },
                { label: 'Operators',  href: '/admin/operators',  icon: 'fi-rr-user-helmet-safety',   permission: 'manage operators' },
                { label: 'Materials',  href: '/admin/materials',  icon: 'fi-rr-cube',                 permission: 'manage materials-master' },
                { label: 'Operations', href: '/admin/operations', icon: 'fi-rr-tools',                permission: 'manage operations-master' },
            ],
        },
        {
            label: 'Users & Access',
            icon: 'fi-rr-users',
            items: [
                { label: 'Users',          href: '/admin/users',          icon: 'fi-rr-users',          permission: 'manage users' },
                { label: 'Roles',          href: '/admin/roles',          icon: 'fi-rr-shield',         permission: 'manage roles' },
                { label: 'Customers',      href: '/admin/customers',      icon: 'fi-rr-building',       permission: 'manage customers' },
                { label: 'Approval Chain', href: '/admin/approval-chain', icon: 'fi-rr-workflow',       permission: 'manage users' },
            ],
        },
        {
            label: 'System',
            icon: 'fi-rr-settings',
            items: [
                { label: 'Branding',         href: '/admin/branding',          icon: 'fi-rr-palette',  permission: 'manage users' },
                { label: 'Centers',          href: '/admin/centers',           icon: 'fi-rr-building', permission: 'manage users' },
                { label: 'Chatbot Settings', href: '/admin/chatbot-settings',  icon: 'fi-rr-robot',    permission: 'manage users' },
                { label: 'Audit Log',        href: '/admin/audit-log',         icon: 'fi-rr-notebook', permission: 'view audit-log' },
            ],
        },
    ],
};

/* ─── Permission helpers ────────────────────────────────────────────── */

export function hasPermission(userPerms: string[], item: NavItem | NavGroup, isSuperAdmin: boolean): boolean {
    if (isSuperAdmin) return true;
    if ('items' in item) {
        // Group: visible if any nested item is visible
        const directVisible = item.items.some(i => hasPermission(userPerms, i, isSuperAdmin));
        const childVisible  = item.children?.some(g => hasPermission(userPerms, g, isSuperAdmin)) ?? false;
        return directVisible || childVisible;
    }
    if (item.permission) return userPerms.includes(item.permission);
    if (item.permissionAny) return item.permissionAny.some(p => userPerms.includes(p));
    return true; // no permission required
}

export function filterNav(userPerms: string[], isSuperAdmin: boolean) {
    const filterItems = (items: NavItem[]) => items.filter(i => hasPermission(userPerms, i, isSuperAdmin));

    const filterGroup = (g: NavGroup): NavGroup | null => {
        const items = filterItems(g.items);
        const children = g.children?.map(filterGroup).filter((c): c is NavGroup => c !== null) ?? [];
        if (items.length === 0 && children.length === 0) return null;
        return { ...g, items, children };
    };

    const groups = mainGroups.map(filterGroup).filter((g): g is NavGroup => g !== null);
    const admin  = filterGroup(adminGroup);
    return { groups, admin };
}

/**
 * Flatten nav into a single list of top-level accordion groups.
 * Admin's children (Master Data / Users & Access / System) become independent groups
 * so each can be toggled in the accordion.
 */
export function flatGroups(userPerms: string[], isSuperAdmin: boolean): NavGroup[] {
    const { groups, admin } = filterNav(userPerms, isSuperAdmin);
    const flat = [...groups];
    if (admin?.children?.length) {
        flat.push(...admin.children);
    } else if (admin && admin.items.length > 0) {
        flat.push(admin);
    }
    return flat;
}
