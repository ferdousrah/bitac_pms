import { useEffect, useMemo, useRef, useState } from 'react';

export interface SearchOption {
    value: string | number;
    label: string;
    sublabel?: string;
}

interface Props {
    value: string | number | '';
    onChange: (value: string | number | '') => void;
    options: SearchOption[];
    placeholder?: string;
    /** Optional placeholder when nothing matches the search */
    emptyText?: string;
    disabled?: boolean;
    /** Required field flag (adds invisible required input for form submission) */
    required?: boolean;
    /** ID of the underlying hidden input — pass for accessibility / label-htmlFor pairing */
    id?: string;
    /** Optional `name` attribute on the hidden input — useful for non-controlled forms */
    name?: string;
    /** Style the trigger differently (e.g. small) */
    size?: 'sm' | 'md';
    /** Allow clearing the selection — defaults to true */
    clearable?: boolean;
    /** className override for the trigger button */
    className?: string;
}

/**
 * Dependency-free searchable select dropdown.
 * Filters options client-side by label + sublabel (case-insensitive).
 * Keyboard: ↑↓ to navigate, Enter to select, Esc to close, type to search.
 */
export default function SearchableSelect({
    value,
    onChange,
    options,
    placeholder = 'Select…',
    emptyText = 'No matches found',
    disabled = false,
    required = false,
    id,
    name,
    size = 'md',
    clearable = true,
    className = '',
}: Props) {
    const [open, setOpen] = useState(false);
    const [search, setSearch] = useState('');
    const [highlight, setHighlight] = useState(0);
    const rootRef = useRef<HTMLDivElement>(null);
    const searchRef = useRef<HTMLInputElement>(null);
    const listRef = useRef<HTMLDivElement>(null);

    const selected = useMemo(
        () => options.find(o => String(o.value) === String(value)) ?? null,
        [options, value],
    );

    const filtered = useMemo(() => {
        const q = search.trim().toLowerCase();
        if (!q) return options;
        return options.filter(o => {
            const blob = `${o.label} ${o.sublabel ?? ''}`.toLowerCase();
            return blob.includes(q);
        });
    }, [options, search]);

    // Close on outside click
    useEffect(() => {
        if (!open) return;
        const onDown = (e: MouseEvent) => {
            if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
        };
        document.addEventListener('mousedown', onDown);
        return () => document.removeEventListener('mousedown', onDown);
    }, [open]);

    // Focus search when opening
    useEffect(() => {
        if (open) {
            setHighlight(0);
            requestAnimationFrame(() => searchRef.current?.focus());
        } else {
            setSearch('');
        }
    }, [open]);

    // Keep highlighted item in view
    useEffect(() => {
        if (!open) return;
        const el = listRef.current?.querySelector<HTMLButtonElement>(`[data-idx="${highlight}"]`);
        el?.scrollIntoView({ block: 'nearest' });
    }, [highlight, open]);

    const select = (val: string | number) => {
        onChange(val);
        setOpen(false);
    };

    const handleKey = (e: React.KeyboardEvent) => {
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            setHighlight(h => Math.min(filtered.length - 1, h + 1));
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setHighlight(h => Math.max(0, h - 1));
        } else if (e.key === 'Enter') {
            e.preventDefault();
            if (filtered[highlight]) select(filtered[highlight].value);
        } else if (e.key === 'Escape') {
            setOpen(false);
        }
    };

    const trigger = `w-full text-left flex items-center justify-between gap-2 rounded-xl border border-surface-200 bg-white
                     hover:border-surface-300 focus:outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100
                     transition-colors ${size === 'sm' ? 'px-2.5 py-1.5 text-xs' : 'px-3.5 py-2.5 text-sm'}
                     ${disabled ? 'opacity-60 cursor-not-allowed bg-surface-50' : ''}
                     ${open ? 'border-brand-400 ring-2 ring-brand-100' : ''}`;

    return (
        <div ref={rootRef} className={`relative ${className}`}>
            <button
                type="button"
                id={id}
                disabled={disabled}
                onClick={() => !disabled && setOpen(o => !o)}
                className={trigger}
            >
                <span className={`flex-1 truncate ${selected ? 'text-surface-900' : 'text-surface-400'}`}>
                    {selected ? (
                        <>
                            {selected.label}
                            {selected.sublabel && <span className="text-surface-400 ml-2 text-xs">{selected.sublabel}</span>}
                        </>
                    ) : placeholder}
                </span>
                <div className="flex items-center gap-1 shrink-0">
                    {clearable && selected && !disabled && (
                        <span
                            role="button"
                            tabIndex={-1}
                            onClick={(e) => { e.stopPropagation(); onChange(''); }}
                            className="text-surface-400 hover:text-surface-700 transition-colors p-0.5"
                            aria-label="Clear"
                        >
                            <i className="fi fi-rr-cross-small text-sm leading-none" />
                        </span>
                    )}
                    <i className={`fi fi-rr-angle-small-down text-sm leading-none text-surface-400 transition-transform ${open ? 'rotate-180' : ''}`} />
                </div>
            </button>

            {/* Hidden input — keeps native form submission working when used outside Inertia */}
            {name && <input type="hidden" name={name} value={value} required={required} />}

            {open && (
                <div className="absolute z-50 mt-1.5 w-full bg-white border border-surface-200 rounded-xl shadow-premium-lg overflow-hidden animate-fade-in">
                    <div className="border-b border-surface-100 px-2.5 py-2 flex items-center gap-2 bg-surface-50/50">
                        <i className="fi fi-rr-search text-xs text-surface-400 leading-none" />
                        <input
                            ref={searchRef}
                            type="text"
                            value={search}
                            onChange={e => { setSearch(e.target.value); setHighlight(0); }}
                            onKeyDown={handleKey}
                            placeholder="Type to search…"
                            className="flex-1 bg-transparent outline-none text-sm text-surface-900 placeholder:text-surface-400"
                        />
                    </div>

                    <div ref={listRef} className="max-h-64 overflow-y-auto py-1">
                        {filtered.length === 0 ? (
                            <div className="px-4 py-6 text-center text-xs text-surface-400">{emptyText}</div>
                        ) : (
                            filtered.map((o, i) => {
                                const isSelected = String(o.value) === String(value);
                                const isHi = i === highlight;
                                return (
                                    <button
                                        key={o.value}
                                        type="button"
                                        data-idx={i}
                                        onMouseEnter={() => setHighlight(i)}
                                        onClick={() => select(o.value)}
                                        className={`w-full text-left px-3 py-2 flex items-center justify-between gap-2 transition-colors
                                            ${isHi ? 'bg-brand-50' : ''}
                                            ${isSelected ? 'text-brand-700 font-medium' : 'text-surface-800'}
                                            hover:bg-brand-50`}
                                    >
                                        <span className="flex-1 truncate text-sm">
                                            {o.label}
                                            {o.sublabel && <span className="text-surface-400 ml-2 text-xs">{o.sublabel}</span>}
                                        </span>
                                        {isSelected && <i className="fi fi-rr-check text-xs leading-none text-brand-600" />}
                                    </button>
                                );
                            })
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
