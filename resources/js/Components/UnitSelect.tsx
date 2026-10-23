import { ALL_UNITS, UNIT_GROUPS } from '@/lib/units';

/**
 * The unit of a line, as a dropdown of every unit (grouped). A value that is
 * not in the list — e.g. a unit typed into the materials master — is kept as
 * its own option, so opening an old line never silently changes its unit.
 */
export default function UnitSelect({ value, onChange, className = '' }: {
    value: string; onChange: (unit: string) => void; className?: string;
}) {
    const extra = value && !ALL_UNITS.includes(value) ? value : null;
    return (
        <select value={value} onChange={(e) => onChange(e.target.value)} className={`form-select text-sm py-1.5 !pl-2 !pr-7 ${className}`}>
            {extra && <option value={extra}>{extra}</option>}
            {UNIT_GROUPS.map((g) => (
                <optgroup key={g.label} label={g.label}>
                    {g.units.map((u) => <option key={u} value={u}>{u}</option>)}
                </optgroup>
            ))}
        </select>
    );
}
