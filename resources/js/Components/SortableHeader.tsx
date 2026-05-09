import { router } from '@inertiajs/react';

interface Props {
    label: string;
    column: string;
    currentSort: string;
    currentDir: string;
    baseUrl: string;
    filters: Record<string, string>;
    className?: string;
}

export default function SortableHeader({ label, column, currentSort, currentDir, baseUrl, filters, className = '' }: Props) {
    const isActive = currentSort === column;
    const nextDir = isActive && currentDir === 'asc' ? 'desc' : 'asc';

    const handleClick = () => {
        router.get(baseUrl, { ...filters, sort: column, dir: nextDir }, { preserveState: true, replace: true });
    };

    return (
        <th className={`cursor-pointer select-none group ${className}`} onClick={handleClick}>
            <div className="inline-flex items-center gap-1">
                <span>{label}</span>
                <span className={`inline-flex flex-col text-[8px] leading-none ${isActive ? 'text-brand-500' : 'text-surface-300 group-hover:text-surface-400'}`}>
                    <i className={`fi fi-rr-caret-up leading-none ${isActive && currentDir === 'asc' ? 'text-brand-500' : ''}`} style={{ marginBottom: '-2px' }} />
                    <i className={`fi fi-rr-caret-down leading-none ${isActive && currentDir === 'desc' ? 'text-brand-500' : ''}`} />
                </span>
            </div>
        </th>
    );
}
