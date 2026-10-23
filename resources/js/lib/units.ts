/**
 * Units a requisition or demand line can be counted in — offered as a plain
 * dropdown. ⚠️ Not a <datalist>: a datalist only suggests entries that match
 * what is already typed, so a box holding "kg" offered nothing but "kg".
 */
export const UNIT_GROUPS: { label: string; units: string[] }[] = [
    { label: 'Weight', units: ['kg', 'g', 'ton'] },
    { label: 'Count',  units: ['pcs', 'nos', 'pair', 'set', 'box', 'packet', 'roll', 'bag', 'bundle', 'dozen'] },
    { label: 'Length', units: ['m', 'mm', 'cm', 'ft', 'inch'] },
    { label: 'Area / sheet', units: ['sheet', 'm²', 'sq ft'] },
    { label: 'Volume', units: ['L', 'ml', 'm³', 'gallon', 'can', 'drum'] },
];

export const ALL_UNITS = UNIT_GROUPS.flatMap((g) => g.units);
