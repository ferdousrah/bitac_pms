import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

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
    emptyText?: string;
    disabled?: boolean;
    required?: boolean;
    id?: string;
    name?: string;
    size?: 'sm' | 'md';
    clearable?: boolean;
    className?: string;
}

/**
 * Dependency-free searchable select dropdown.
 * The panel is rendered via React Portal into document.body, so it can never
 * be clipped or cause scrollbars on any ancestor with overflow:hidden/auto
 * (table cells, cards, modals, etc.). Position is calculated from the
 * trigger's bounding rect every time the panel opens.
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
    const [pos, setPos] = useState<{ top: number; left: number; width: number; dropUp: boolean } | null>(null);

    const rootRef = useRef<HTMLDivElement>(null);
    const triggerRef = useRef<HTMLButtonElement>(null);
    const panelRef = useRef<HTMLDivElement>(null);
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

    // Compute panel position from trigger rect
    const computePosition = () => {
        const rect = triggerRef.current?.getBoundingClientRect();
        if (!rect) return;
        const PANEL_MAX_HEIGHT = 320;
        const spaceBelow = window.innerHeight - rect.bottom;
        const spaceAbove = rect.top;
        const dropUp = spaceBelow < PANEL_MAX_HEIGHT && spaceAbove > spaceBelow;
        setPos({
            top: dropUp ? rect.top - 6 : rect.bottom + 6,
            left: rect.left,
            width: rect.width,
            dropUp,
        });
    };

    // Close on outside click — include both trigger root and panel
    useEffect(() => {
        if (!open) return;
        const onDown = (e: MouseEvent) => {
            const t = e.target as Node;
            if (rootRef.current?.contains(t)) return;
            if (panelRef.current?.contains(t)) return;
            setOpen(false);
        };
        document.addEventListener('mousedown', onDown);
        return () => document.removeEventListener('mousedown', onDown);
    }, [open]);

    // Recompute position when opening + on scroll/resize while open
    useLayoutEffect(() => {
        if (!open) return;
        computePosition();
        const onScrollOrResize = () => computePosition();
        window.addEventListener('scroll', onScrollOrResize, true);
        window.addEventListener('resize', onScrollOrResize);
        return () => {
            window.removeEventListener('scroll', onScrollOrResize, true);
            window.removeEventListener('resize', onScrollOrResize);
        };
    }, [open]);

    // Focus search when opening
    useEffect(() => {
        if (open) {
            setHighlight(0);
            requestAnimationFrame(() => searchRef.current?.focus());
        } else {
            setSearch('');
            setPos(null);
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
        <div ref={rootRef} className={className}>
            <button
                ref={triggerRef}
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

            {/* Portal-rendered panel — escapes any ancestor overflow:hidden / scroll */}
            {open && pos && typeof document !== 'undefined' && createPortal(
                <div
                    ref={panelRef}
                    style={{
                        position: 'fixed',
                        top: pos.dropUp ? undefined : pos.top,
                        bottom: pos.dropUp ? window.innerHeight - pos.top : undefined,
                        left: pos.left,
                        width: pos.width,
                        zIndex: 9999,
                    }}
                    className="bg-white border border-surface-200 rounded-xl shadow-premium-lg overflow-hidden animate-fade-in"
                >
                    <div className="p-2 border-b border-surface-100">
                        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-surface-50 border border-surface-100">
                            <i className="fi fi-rr-search text-xs text-surface-400 leading-none" />
                            <input
                                ref={searchRef}
                                type="text"
                                value={search}
                                onChange={e => { setSearch(e.target.value); setHighlight(0); }}
                                onKeyDown={handleKey}
                                placeholder="Type to search…"
                                className="flex-1 bg-transparent border-0 outline-none focus:outline-none focus:ring-0 focus:border-0 text-sm text-surface-900 placeholder:text-surface-400 p-0"
                                style={{ boxShadow: 'none' }}
                            />
                            {search && (
                                <button
                                    type="button"
                                    onClick={() => { setSearch(''); searchRef.current?.focus(); }}
                                    className="text-surface-400 hover:text-surface-700 transition-colors"
                                    aria-label="Clear search"
                                >
                                    <i className="fi fi-rr-cross-small text-xs leading-none" />
                                </button>
                            )}
                        </div>
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
                </div>,
                document.body
            )}
        </div>
    );
}
