/**
 * Full delivery (every item of the job at once) or Partial — the Partial
 * Challan. Classes written out in full for Tailwind.
 */
export default function DeliveryTypeBadge({ type, className = '' }: { type?: string | null; className?: string }) {
    if (!type) return null;
    const full = type === 'full';
    return (
        <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded border text-[10px] font-bold whitespace-nowrap ${
            full ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-orange-50 text-orange-700 border-orange-200'} ${className}`}>
            <i className={`fi ${full ? 'fi-rr-boxes' : 'fi-rr-box-open'} text-[9px] leading-none`} />
            {full ? 'Full' : 'Partial'}
        </span>
    );
}

/** "Shaft ×6 · Bush ×12" — what went on a challan, in one line. */
export function deliveryLinesText(lines: { description?: string | null; quantity: number; unit?: string | null }[] = []): string {
    return lines.map((l) => `${(l.description ?? '').split('\n')[0].slice(0, 40)} ×${Number(l.quantity).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`).join(' · ');
}
