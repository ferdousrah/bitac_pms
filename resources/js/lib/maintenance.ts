/**
 * Electrical / Mechanical maintenance (MaintenanceRequest::CATEGORIES) — each
 * has its own menu and colour. Classes are written out in full: Tailwind only
 * ships classes it can see in the source.
 */
export const CATEGORY_STYLE: Record<string, { icon: string; tile: string; chip: string }> = {
    electrical: { icon: 'fi-rr-bolt',  tile: 'from-sky-400 to-sky-600',     chip: 'bg-sky-50 text-sky-700 border-sky-200' },
    mechanical: { icon: 'fi-rr-gears', tile: 'from-amber-400 to-amber-600', chip: 'bg-amber-50 text-amber-800 border-amber-200' },
};
