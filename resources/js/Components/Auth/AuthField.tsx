import { ReactNode } from 'react';

/** The BITAC identity every sign-in page receives (`App\Support\AuthBranding`). */
export interface AuthBitac {
    name_bn?: string | null;
    ministry_bn?: string | null;
    government_bn?: string | null;
    phone_bn?: string | null;
    email?: string | null;
    logo_left?: string | null;
}

export const BITAC_NAME_FALLBACK = 'বাংলাদেশ শিল্প কারিগরি সহায়তা কেন্দ্র (বিটাক)';

/** A Bangla-digit `tel:` dials nothing — the number keeps its face, the link goes ASCII. */
export function telHref(n: string): string {
    return 'tel:' + n.replace(/[০-৯]/g, d => String('০১২৩৪৫৬৭৮৯'.indexOf(d))).replace(/[^\d+]/g, '');
}

/**
 * An input on a sign-in page. `filled` is the staff look (a light grey well
 * that turns white on focus); the stakeholder pages use a white field.
 * Pass `pr-12` yourself when there is a button at the right edge.
 */
export function authInputClass(invalid: boolean, filled = false): string {
    return 'w-full h-12 pl-11 pr-4 rounded-xl border text-[15px] text-surface-900 placeholder:text-surface-400 '
        + 'focus:outline-none focus:ring-4 transition-colors '
        + (filled ? 'bg-surface-50 focus:bg-white ' : 'bg-white ')
        + (invalid
            ? 'border-rose-400 focus:border-rose-500 focus:ring-rose-500/10'
            : filled
                ? 'border-surface-200 hover:border-surface-300 focus:border-brand-500 focus:ring-brand-500/15'
                : 'border-surface-300 hover:border-surface-400 focus:border-brand-500 focus:ring-brand-500/15');
}

export function AuthField({ id, label, icon, error, aside, children }: {
    id: string; label: string; icon: string; error?: string; aside?: ReactNode; children: ReactNode;
}) {
    return (
        <div>
            <div className="flex items-center justify-between mb-2">
                <label htmlFor={id} className="text-sm font-semibold text-surface-800">{label}</label>
                {aside}
            </div>
            <div className="relative">
                <i className={`fi ${icon} absolute left-4 top-1/2 -translate-y-1/2 text-sm leading-none text-surface-400 pointer-events-none`} />
                {children}
            </div>
            {error && (
                <p className="mt-2 text-sm text-rose-700 flex items-center gap-1.5">
                    <i className="fi fi-rr-exclamation text-xs leading-none" />{error}
                </p>
            )}
        </div>
    );
}

/** The green "it worked" line — a sent reset link, a changed password. */
export function AuthStatus({ children }: { children: ReactNode }) {
    return (
        <div className="px-4 py-3 rounded-xl bg-emerald-50 border border-emerald-200 text-sm text-emerald-800 flex items-start gap-2.5">
            <i className="fi fi-rr-check-circle text-sm leading-none shrink-0 mt-0.5" />
            <span>{children}</span>
        </div>
    );
}
