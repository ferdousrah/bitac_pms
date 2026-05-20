/**
 * Visual indicator for an RFQ's job_type (regular vs rnd). Propagated down
 * to Cost Estimate, Quotation, Job, and PCD views so the type is visible
 * at every step of the workflow.
 *
 * Defaults to `regular` so legacy rows (without the field) render sensibly.
 */
export type JobType = 'regular' | 'rnd';

interface Props {
    type: JobType | string | null | undefined;
    size?: 'xs' | 'sm';
    /** When true, the Regular variant is hidden — useful for list views where
        only R&D needs to stand out. */
    onlyRnd?: boolean;
}

const SIZE_CLASSES = {
    xs: 'px-1.5 py-0.5 text-[9px]',
    sm: 'px-2 py-0.5 text-[10px]',
};

export default function JobTypeBadge({ type, size = 'sm', onlyRnd = false }: Props) {
    const t = (type ?? 'regular').toString().toLowerCase();
    const isRnd = t === 'rnd';

    if (!isRnd && onlyRnd) return null;

    const cls = SIZE_CLASSES[size];

    if (isRnd) {
        return (
            <span className={`inline-flex items-center gap-1 rounded-md bg-purple-50 text-purple-700 border border-purple-200 font-bold uppercase tracking-wider ${cls}`}>
                <i className="fi fi-rr-lab text-[9px] leading-none" />
                R&amp;D
            </span>
        );
    }

    return (
        <span className={`inline-flex items-center gap-1 rounded-md bg-blue-50 text-blue-700 border border-blue-200 font-bold uppercase tracking-wider ${cls}`}>
            <i className="fi fi-rr-tools text-[9px] leading-none" />
            Regular
        </span>
    );
}
