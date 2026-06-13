import { ReactNode, useState } from 'react';

interface Props {
    title: ReactNode;                       // main heading
    summary?: ReactNode;                    // right-side meta when collapsed (e.g. total, count, status pill)
    icon?: string;                          // optional fi-* icon class for the title row
    iconColor?: 'brand' | 'blue' | 'amber' | 'purple' | 'emerald' | 'rose' | 'indigo' | 'slate';
    defaultOpen?: boolean;                  // false by default — minimised
    headerRight?: ReactNode;                // arbitrary header-right content shown in both states (e.g. action buttons)
    className?: string;                     // extra classes on the outer card
    bodyClassName?: string;                 // extra classes on the inner body wrapper
    children: ReactNode;
}

const ICON_TINT: Record<NonNullable<Props['iconColor']>, string> = {
    brand:   'bg-brand-50 text-brand-600 ring-brand-100',
    blue:    'bg-blue-50 text-blue-600 ring-blue-100',
    amber:   'bg-amber-50 text-amber-600 ring-amber-100',
    purple:  'bg-purple-50 text-purple-600 ring-purple-100',
    emerald: 'bg-emerald-50 text-emerald-600 ring-emerald-100',
    rose:    'bg-rose-50 text-rose-600 ring-rose-100',
    indigo:  'bg-indigo-50 text-indigo-600 ring-indigo-100',
    slate:   'bg-slate-50 text-slate-600 ring-slate-200',
};

/**
 * Card wrapper with an expandable / minimisable body. Defaults to closed —
 * lets a long page (cost estimate, RFQ details, etc.) stay scannable while
 * the user opens just the section they care about.
 *
 * The header is the click target. A small "summary" slot is rendered on the
 * right when collapsed so each section still communicates its key fact at a
 * glance (e.g. "৳ 12,500 · 3 items").
 */
export default function CollapsibleCard({
    title, summary, icon, iconColor = 'slate', defaultOpen = false,
    headerRight, className = '', bodyClassName = '', children,
}: Props) {
    const [open, setOpen] = useState(defaultOpen);

    return (
        <div className={`card overflow-hidden ${className}`}>
            <div className={`px-5 py-3 flex items-center justify-between gap-3 ${open ? 'border-b border-surface-100' : ''}`}>
                <button
                    type="button"
                    onClick={() => setOpen(o => !o)}
                    className="flex items-center gap-2.5 flex-1 min-w-0 text-left group"
                    aria-expanded={open}
                >
                    {icon && (
                        <div className={`w-7 h-7 rounded-lg ring-1 flex items-center justify-center shrink-0 ${ICON_TINT[iconColor]}`}>
                            <i className={`fi ${icon} text-xs leading-none`} />
                        </div>
                    )}
                    <div className="min-w-0 flex items-center gap-2 flex-wrap">
                        {typeof title === 'string'
                            ? <h3 className="text-xs font-bold text-surface-900 uppercase tracking-wider">{title}</h3>
                            : title}
                        {!open && summary && (
                            <span className="text-[11px] text-surface-500 truncate">{summary}</span>
                        )}
                    </div>
                    <i className={`fi fi-rr-angle-down text-[10px] leading-none text-surface-400 transition-transform shrink-0 ml-1 ${open ? 'rotate-180' : ''} group-hover:text-surface-600`} />
                </button>
                {headerRight && <div className="shrink-0">{headerRight}</div>}
            </div>
            {open && (
                <div className={bodyClassName}>
                    {children}
                </div>
            )}
        </div>
    );
}
