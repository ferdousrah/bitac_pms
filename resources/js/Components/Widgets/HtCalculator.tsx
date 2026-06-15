import { useEffect, useState } from 'react';

/**
 * Heat Treatment Calculator — mirrors the "HT Cal" sheet from BITAC's master
 * costing workbook. Takes dimensions in metres (BITAC convention), outputs the
 * job's Volume in cubic inches (In³) which is the quantity unit for the
 * "Heat Treatment Cost" / "C. Surface Treatment Cost" section on the cost
 * estimate. Four shapes per the master file:
 *   1. Rectangular Job  : L × W × H
 *   2. Square Job       : Side × Side × Height
 *   3. Cylindrical Job  : π/4 × DIA² × L
 *   4. Cylindrical Hollow : π/4 × (D² − d²) × L
 */

interface Props {
    open: boolean;
    onClose: () => void;
    onApply?: (volumeIn3: number) => void;
    // Optional material list — when supplied, the planner can pick a material
    // and see Weight (KG) = Volume × density_kg_in3 (mirrors the Excel HT Cal
    // sheet's H column). Picking material doesn't change the applied value.
    materials?: Array<{ id: number; name: string; density_kg_m3?: number; density_kg_in3?: number }>;
}

type Shape = 'rectangular' | 'square' | 'cylindrical' | 'cylindrical_hollow';
type Unit  = 'mm' | 'cm' | 'm' | 'inch' | 'feet';

const UNIT_TO_M: Record<Unit, number> = {
    mm:   0.001,
    cm:   0.01,
    m:    1,
    inch: 0.0254,
    feet: 0.3048,
};

const M3_TO_IN3 = 61023.7440947; // 1 m³ in in³

const SHAPES: Array<{ value: Shape; label: string }> = [
    { value: 'rectangular',        label: 'Rectangular Job' },
    { value: 'square',             label: 'Square Job' },
    { value: 'cylindrical',        label: 'Cylindrical Job' },
    { value: 'cylindrical_hollow', label: 'Cylindrical Hollow Job' },
];

function ShapeIcon({ shape, active }: { shape: Shape; active: boolean }) {
    const stroke = active ? '#d97706' : '#94a3b8';
    const fill   = active ? '#fef3c7' : '#f1f5f9';
    const c      = { strokeWidth: 1.5, fill, stroke };
    switch (shape) {
        case 'rectangular':
            return <svg viewBox="0 0 24 24" width="22" height="22"><rect x="3" y="6" width="18" height="12" {...c} /></svg>;
        case 'square':
            return <svg viewBox="0 0 24 24" width="22" height="22"><rect x="5" y="5" width="14" height="14" {...c} /></svg>;
        case 'cylindrical':
            return <svg viewBox="0 0 24 24" width="22" height="22"><ellipse cx="12" cy="6" rx="7" ry="2.5" {...c} /><path d="M5 6 L5 18 A7 2.5 0 0 0 19 18 L19 6" {...c} /></svg>;
        case 'cylindrical_hollow':
            return <svg viewBox="0 0 24 24" width="22" height="22"><ellipse cx="12" cy="6" rx="7" ry="2.5" {...c} /><path d="M5 6 L5 18 A7 2.5 0 0 0 19 18 L19 6" {...c} /><ellipse cx="12" cy="6" rx="3" ry="1" fill="#fff" stroke={stroke} strokeWidth="1.2" /></svg>;
    }
}

export default function HtCalculator({ open, onClose, onApply, materials = [] }: Props) {
    const [shape, setShape] = useState<Shape>('rectangular');
    const [unit, setUnit]   = useState<Unit>('m');
    const [length, setLength] = useState('');
    const [width, setWidth]   = useState('');
    const [height, setHeight] = useState('');
    const [side, setSide]     = useState('');
    const [diaOuter, setDiaOuter] = useState('');
    const [diaInner, setDiaInner] = useState('');
    const [pieces, setPieces] = useState('1');
    const [materialId, setMaterialId] = useState<number | ''>('');

    useEffect(() => {
        if (!open) return;
        setLength(''); setWidth(''); setHeight(''); setSide('');
        setDiaOuter(''); setDiaInner(''); setPieces('1');
        setMaterialId('');
    }, [open]);

    if (!open) return null;

    const num = (s: string) => {
        const n = parseFloat(s);
        return Number.isFinite(n) && n > 0 ? n : 0;
    };
    const k = UNIT_TO_M[unit]; // multiplier → metres

    // Volume in m³ per shape (BITAC formula matches HT Cal sheet).
    let volumeM3 = 0;
    if (shape === 'rectangular') {
        volumeM3 = num(length) * num(width) * num(height) * k * k * k;
    } else if (shape === 'square') {
        volumeM3 = num(side) * num(side) * num(height) * k * k * k;
    } else if (shape === 'cylindrical') {
        const d = num(diaOuter) * k;
        volumeM3 = (Math.PI / 4) * d * d * (num(length) * k);
    } else if (shape === 'cylindrical_hollow') {
        const D = num(diaOuter) * k;
        const d = num(diaInner) * k;
        volumeM3 = (Math.PI / 4) * (D * D - d * d) * (num(length) * k);
    }
    if (volumeM3 < 0) volumeM3 = 0;

    const pieceCount = Math.max(1, Math.floor(num(pieces) || 1));
    const volumeIn3 = volumeM3 * M3_TO_IN3 * pieceCount;
    const valid = volumeIn3 > 0;

    // Weight derivation — mirrors HT Cal sheet column H. Uses kg/In³ when
    // available, otherwise falls back to kg/m³ × volume in m³.
    // Eloquent ships decimal columns as strings — coerce both densities to
    // numbers so multiplication + .toFixed() don't blow up at render time.
    const mat = materials.find(m => m.id === materialId);
    const matDensityIn3 = mat ? Number(mat.density_kg_in3) || 0 : 0;
    const matDensityM3  = mat ? Number(mat.density_kg_m3)  || 0 : 0;
    let weightKg = 0;
    if (mat) {
        if (matDensityIn3 > 0) {
            weightKg = volumeIn3 * matDensityIn3;
        } else if (matDensityM3 > 0) {
            weightKg = (volumeM3 * pieceCount) * matDensityM3;
        }
    }

    const apply = () => {
        if (!valid) return;
        onApply?.(Number(volumeIn3.toFixed(4)));
        onClose();
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 animate-fade-in" onClick={onClose}>
            <div onClick={e => e.stopPropagation()} className="bg-white rounded-2xl shadow-premium-lg w-full max-w-3xl max-h-[90vh] overflow-y-auto">
                {/* Header */}
                <div className="px-6 py-4 border-b border-surface-100 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-fuchsia-600 text-white flex items-center justify-center">
                            <i className="fi fi-rr-calculator text-lg leading-none" />
                        </div>
                        <div>
                            <h2 className="text-base font-bold text-surface-900">Heat Treatment Calculator</h2>
                            <p className="text-xs text-surface-500">Outputs job volume in In³ — used as the Heat Treatment Cost quantity</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="btn-icon text-surface-400 hover:text-surface-700">
                        <i className="fi fi-rr-cross-small text-lg leading-none" />
                    </button>
                </div>

                <div className="px-6 py-5 space-y-5">
                    {/* Shape picker */}
                    <div>
                        <div className="text-xs font-semibold text-surface-500 uppercase tracking-wider mb-2">Shape</div>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                            {SHAPES.map(s => (
                                <button
                                    key={s.value}
                                    type="button"
                                    onClick={() => setShape(s.value)}
                                    className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-xs font-medium transition-colors text-left ${
                                        shape === s.value
                                            ? 'border-amber-400 bg-amber-50 text-amber-900'
                                            : 'border-surface-200 bg-white text-surface-600 hover:border-amber-300'
                                    }`}
                                >
                                    <ShapeIcon shape={s.value} active={shape === s.value} />
                                    <span>{s.label}</span>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Unit + pieces + (optional) material */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div className="form-group mb-0">
                            <label className="form-label">Unit</label>
                            <select value={unit} onChange={e => setUnit(e.target.value as Unit)} className="form-select">
                                <option value="mm">mm</option>
                                <option value="cm">cm</option>
                                <option value="m">m (metres)</option>
                                <option value="inch">inch</option>
                                <option value="feet">feet</option>
                            </select>
                        </div>
                        <div className="form-group mb-0">
                            <label className="form-label">Number of Pieces</label>
                            <input type="number" min={1} step={1} value={pieces}
                                onChange={e => setPieces(e.target.value)} className="form-input" />
                        </div>
                        {materials.length > 0 && (
                            <div className="form-group mb-0">
                                <label className="form-label">Material <span className="form-label-optional">(for weight check)</span></label>
                                <select value={materialId}
                                    onChange={e => setMaterialId(e.target.value ? Number(e.target.value) : '')}
                                    className="form-select">
                                    <option value="">— None —</option>
                                    {materials.map(m => (
                                        <option key={m.id} value={m.id}>{m.name}</option>
                                    ))}
                                </select>
                            </div>
                        )}
                    </div>

                    {/* Dimension inputs vary by shape */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        {shape === 'rectangular' && <>
                            <NumberInput label="Length" value={length} setValue={setLength} unit={unit} />
                            <NumberInput label="Width"  value={width}  setValue={setWidth}  unit={unit} />
                            <NumberInput label="Height" value={height} setValue={setHeight} unit={unit} />
                        </>}
                        {shape === 'square' && <>
                            <NumberInput label="Side"   value={side}   setValue={setSide}   unit={unit} />
                            <NumberInput label="Height" value={height} setValue={setHeight} unit={unit} />
                        </>}
                        {shape === 'cylindrical' && <>
                            <NumberInput label="Length"   value={length}   setValue={setLength}   unit={unit} />
                            <NumberInput label="Diameter" value={diaOuter} setValue={setDiaOuter} unit={unit} />
                        </>}
                        {shape === 'cylindrical_hollow' && <>
                            <NumberInput label="Length"          value={length}   setValue={setLength}   unit={unit} />
                            <NumberInput label="Outer Dia (D)"   value={diaOuter} setValue={setDiaOuter} unit={unit} />
                            <NumberInput label="Inner Dia (d)"   value={diaInner} setValue={setDiaInner} unit={unit} />
                        </>}
                    </div>

                    {/* Result */}
                    <div className="rounded-xl border border-amber-200 bg-amber-50/60 px-4 py-3">
                        <div className="flex items-end justify-between flex-wrap gap-2">
                            <div>
                                <div className="text-[10px] uppercase tracking-wider font-semibold text-amber-700">Calculated Volume</div>
                                <div className="text-2xl font-bold text-surface-900 mt-0.5 font-mono">
                                    {volumeIn3.toFixed(2)} <span className="text-base text-surface-500">In³</span>
                                </div>
                            </div>
                            <div className="text-right text-[11px] text-surface-500">
                                Per piece: {(volumeIn3 / pieceCount).toFixed(2)} In³ × {pieceCount} pc{pieceCount > 1 ? 's' : ''}
                                <div className="mt-0.5">(equivalent {volumeM3.toFixed(6)} m³)</div>
                            </div>
                        </div>
                        {mat && weightKg > 0 && (
                            <div className="mt-3 pt-3 border-t border-amber-200/70 flex items-end justify-between flex-wrap gap-2">
                                <div>
                                    <div className="text-[10px] uppercase tracking-wider font-semibold text-amber-700">Derived Weight <span className="font-normal normal-case text-surface-500">({mat.name})</span></div>
                                    <div className="text-xl font-bold text-surface-900 mt-0.5 font-mono">
                                        {weightKg.toFixed(3)} <span className="text-sm text-surface-500">kg</span>
                                    </div>
                                </div>
                                <div className="text-right text-[10px] text-surface-500">
                                    Volume × {matDensityIn3.toFixed(5)} kg/In³
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Footer */}
                <div className="px-6 py-3 border-t border-surface-100 flex justify-end gap-2 bg-surface-50/40">
                    <button type="button" onClick={onClose} className="btn-outline btn-sm">Cancel</button>
                    <button type="button" onClick={apply} disabled={!valid} className="btn-primary btn-sm">
                        <i className="fi fi-rr-check text-xs leading-none mr-1" />
                        Apply Volume
                    </button>
                </div>
            </div>
        </div>
    );
}

function NumberInput({ label, value, setValue, unit }: { label: string; value: string; setValue: (v: string) => void; unit: Unit }) {
    return (
        <div className="form-group mb-0">
            <label className="form-label">{label} <span className="text-[10px] font-normal text-surface-400">({unit})</span></label>
            <input
                type="number"
                min={0}
                step="0.0001"
                value={value}
                onChange={e => setValue(e.target.value)}
                className="form-input font-mono"
                placeholder="0"
            />
        </div>
    );
}
