import { useState, useEffect } from 'react';

interface Props {
    open: boolean;
    onClose: () => void;
    onApply?: (weight: number, materialName?: string) => void;
    materials?: Array<{ id: number; name: string; density_kg_m3: number }>;
}

type Shape =
    | 'rectangular'
    | 'square'
    | 'sheet_plate'
    | 'round_bar'
    | 'hexagonal_bar'
    | 'triangular_bar'
    | 'round_tube'
    | 'square_tube'
    | 'rectangular_tube'
    | 'angle'
    | 'channel'
    | 'i_beam'
    | 't_section'
    | 'ring';

type Unit = 'mm' | 'cm' | 'm' | 'inch' | 'feet';

type ShapeMeta = {
    value: Shape;
    label: string;
    group: 'Solid' | 'Hollow / Section' | 'Plate';
};

const SHAPES: ShapeMeta[] = [
    { value: 'round_bar',         label: 'Round Bar',        group: 'Solid' },
    { value: 'square',            label: 'Square Bar',       group: 'Solid' },
    { value: 'rectangular',       label: 'Rectangular Bar',  group: 'Solid' },
    { value: 'hexagonal_bar',     label: 'Hexagonal Bar',    group: 'Solid' },
    { value: 'triangular_bar',    label: 'Triangular Bar',   group: 'Solid' },
    { value: 'round_tube',        label: 'Round Tube',       group: 'Hollow / Section' },
    { value: 'square_tube',       label: 'Square Tube',      group: 'Hollow / Section' },
    { value: 'rectangular_tube',  label: 'Rectangular Tube', group: 'Hollow / Section' },
    { value: 'ring',              label: 'Ring / Washer',    group: 'Hollow / Section' },
    { value: 'angle',             label: 'Angle (L)',        group: 'Hollow / Section' },
    { value: 'channel',           label: 'Channel (C/U)',    group: 'Hollow / Section' },
    { value: 'i_beam',            label: 'I-Beam (H)',       group: 'Hollow / Section' },
    { value: 't_section',         label: 'T-Section',        group: 'Hollow / Section' },
    { value: 'sheet_plate',       label: 'Sheet / Plate',    group: 'Plate' },
];

const UNIT_TO_M: Record<Unit, number> = {
    mm:   0.001,
    cm:   0.01,
    m:    1,
    inch: 0.0254,
    feet: 0.3048,
};

// Compact SVG illustrations per shape (24×24, brand stroke)
function ShapeIcon({ shape, active }: { shape: Shape; active: boolean }) {
    const stroke = active ? '#d97706' : '#94a3b8';
    const fill   = active ? '#fef3c7' : '#f1f5f9';
    const common = { strokeWidth: 1.5, fill, stroke };
    switch (shape) {
        case 'round_bar':
            return <svg viewBox="0 0 24 24" width="24" height="24"><circle cx="12" cy="12" r="8" {...common} /></svg>;
        case 'square':
            return <svg viewBox="0 0 24 24" width="24" height="24"><rect x="5" y="5" width="14" height="14" {...common} /></svg>;
        case 'rectangular':
            return <svg viewBox="0 0 24 24" width="24" height="24"><rect x="3" y="7" width="18" height="10" {...common} /></svg>;
        case 'hexagonal_bar':
            return <svg viewBox="0 0 24 24" width="24" height="24"><polygon points="12,3 21,8 21,16 12,21 3,16 3,8" {...common} /></svg>;
        case 'triangular_bar':
            return <svg viewBox="0 0 24 24" width="24" height="24"><polygon points="12,3 21,20 3,20" {...common} /></svg>;
        case 'round_tube':
            return <svg viewBox="0 0 24 24" width="24" height="24"><circle cx="12" cy="12" r="8" {...common} /><circle cx="12" cy="12" r="4" fill="#fff" stroke={stroke} strokeWidth="1.5" /></svg>;
        case 'square_tube':
            return <svg viewBox="0 0 24 24" width="24" height="24"><rect x="4" y="4" width="16" height="16" {...common} /><rect x="9" y="9" width="6" height="6" fill="#fff" stroke={stroke} strokeWidth="1.5" /></svg>;
        case 'rectangular_tube':
            return <svg viewBox="0 0 24 24" width="24" height="24"><rect x="3" y="7" width="18" height="10" {...common} /><rect x="7" y="10" width="10" height="4" fill="#fff" stroke={stroke} strokeWidth="1.5" /></svg>;
        case 'ring':
            return <svg viewBox="0 0 24 24" width="24" height="24"><circle cx="12" cy="12" r="9" {...common} /><circle cx="12" cy="12" r="5" fill="#fff" stroke={stroke} strokeWidth="1.5" /></svg>;
        case 'angle':
            return <svg viewBox="0 0 24 24" width="24" height="24"><polygon points="4,4 8,4 8,16 20,16 20,20 4,20" {...common} /></svg>;
        case 'channel':
            return <svg viewBox="0 0 24 24" width="24" height="24"><polygon points="4,4 20,4 20,8 8,8 8,16 20,16 20,20 4,20" {...common} /></svg>;
        case 'i_beam':
            return <svg viewBox="0 0 24 24" width="24" height="24"><polygon points="4,4 20,4 20,8 14,8 14,16 20,16 20,20 4,20 4,16 10,16 10,8 4,8" {...common} /></svg>;
        case 't_section':
            return <svg viewBox="0 0 24 24" width="24" height="24"><polygon points="3,4 21,4 21,9 14,9 14,20 10,20 10,9 3,9" {...common} /></svg>;
        case 'sheet_plate':
            return <svg viewBox="0 0 24 24" width="24" height="24"><rect x="3" y="10" width="18" height="5" {...common} /></svg>;
        default:
            return null;
    }
}

export default function WeightCalculator({ open, onClose, onApply, materials = [] }: Props) {
    const [shape, setShape] = useState<Shape>('round_bar');
    const [unit, setUnit] = useState<Unit>('mm');
    // Universal dimensions — different shapes use different subsets
    const [length, setLength]   = useState(''); // bar length / sheet length
    const [width, setWidth]     = useState(''); // rect width / flange width
    const [height, setHeight]   = useState(''); // bar length OR cross-section height
    const [side, setSide]       = useState(''); // square side / triangle side / hex across-flats
    const [diaOuter, setDiaOuter] = useState('');
    const [diaInner, setDiaInner] = useState('');
    const [thickness, setThickness] = useState('');     // sheet / angle / leg thickness
    const [webThk, setWebThk] = useState('');           // I-Beam, channel, T web
    const [flangeThk, setFlangeThk] = useState('');     // I-Beam, channel, T flange
    const [flangeWidth, setFlangeWidth] = useState(''); // I-Beam / channel / T flange width

    const [materialId, setMaterialId] = useState<number | ''>('');
    const [customDensity, setCustomDensity] = useState('');
    const [pieceCount, setPieceCount] = useState('1');
    const [safetyFactor, setSafetyFactor] = useState('1');

    useEffect(() => {
        if (!open) return;
        setLength(''); setWidth(''); setHeight(''); setSide('');
        setDiaOuter(''); setDiaInner('');
        setThickness(''); setWebThk(''); setFlangeThk(''); setFlangeWidth('');
    }, [open]);

    const m = (v: string) => (parseFloat(v) || 0) * UNIT_TO_M[unit];

    /**
     * Volume formulas — cross-section area × length, all converted to m³.
     * For each shape we derive the cross-section area first, then multiply
     * by the bar/section length (or by the plate thickness for sheets).
     */
    let volumeM3 = 0;
    {
        const L = m(length);
        const W = m(width);
        const H = m(height);
        const S = m(side);
        const DO = m(diaOuter);
        const DI = m(diaInner);
        const T = m(thickness);
        const WT = m(webThk);
        const FT = m(flangeThk);
        const FW = m(flangeWidth);

        if (shape === 'rectangular')          volumeM3 = L * W * H;
        else if (shape === 'square')          volumeM3 = S * S * H;
        else if (shape === 'sheet_plate')     volumeM3 = L * W * T;
        else if (shape === 'round_bar')       volumeM3 = Math.PI * (DO / 2) ** 2 * H;
        else if (shape === 'hexagonal_bar')   volumeM3 = (Math.sqrt(3) / 2) * S * S * H;   // S = across-flats
        else if (shape === 'triangular_bar')  volumeM3 = (Math.sqrt(3) / 4) * S * S * H;   // equilateral
        else if (shape === 'round_tube')      volumeM3 = Math.PI * ((DO / 2) ** 2 - (DI / 2) ** 2) * H;
        else if (shape === 'square_tube')     volumeM3 = (S * S - (S - 2 * T) ** 2) * H;
        else if (shape === 'rectangular_tube') volumeM3 = (W * H - (W - 2 * T) * (H - 2 * T)) * L;
        else if (shape === 'ring')            volumeM3 = Math.PI * ((DO / 2) ** 2 - (DI / 2) ** 2) * T;
        else if (shape === 'angle') {
            // L-section: 2 legs of equal thickness — area = (leg1 + leg2 − thk) × thk
            const area = (W + H - T) * T;
            volumeM3 = area * L;
        }
        else if (shape === 'channel') {
            // C / U section — 2 flanges + 1 web
            const area = 2 * (FW * FT) + (H - 2 * FT) * WT;
            volumeM3 = area * L;
        }
        else if (shape === 'i_beam') {
            // I / H — 2 flanges + 1 web
            const area = 2 * (FW * FT) + (H - 2 * FT) * WT;
            volumeM3 = area * L;
        }
        else if (shape === 't_section') {
            // T — 1 flange + 1 web (stem)
            const area = (FW * FT) + (H - FT) * WT;
            volumeM3 = area * L;
        }
    }

    const selectedMaterial = materials.find(mat => mat.id === materialId);
    // Laravel returns `decimal` casts as strings in JSON. Coerce to a real
    // number so downstream .toFixed() / arithmetic stays safe.
    const density = Number(selectedMaterial?.density_kg_m3 ?? customDensity) || 0;
    const weightPerPiece = volumeM3 * density;
    const pieces = parseInt(pieceCount) || 1;
    const totalWeight = weightPerPiece * pieces;
    // Factor of Safety — final weight = total × FoS (defaults to 1 = no change).
    const fos = parseFloat(safetyFactor) || 1;
    const finalWeight = totalWeight * fos;

    const handleApply = () => {
        if (finalWeight > 0 && onApply) {
            onApply(finalWeight, selectedMaterial?.name);
            onClose();
        }
    };

    if (!open) return null;

    const groups: Array<ShapeMeta['group']> = ['Solid', 'Hollow / Section', 'Plate'];

    return (
        <>
            <div className="fixed inset-0 z-[80] bg-black/50 backdrop-blur-sm animate-fade-in" onClick={onClose} />
            <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
                <div className="bg-white rounded-2xl shadow-premium-lg border border-surface-100 w-full max-w-3xl animate-scale-in max-h-[92vh] overflow-y-auto">

                    {/* Header */}
                    <div className="px-5 py-4 border-b border-surface-100 flex items-center justify-between bg-gradient-to-b from-amber-50 to-white">
                        <div className="flex items-center gap-2.5">
                            <div className="w-10 h-10 rounded-xl bg-amber-100 ring-1 ring-amber-200 flex items-center justify-center">
                                <i className="fi fi-rr-scale text-amber-700 text-base leading-none" />
                            </div>
                            <div>
                                <h3 className="text-base font-bold text-surface-900">Metal Weight Calculator</h3>
                                <p className="text-xs text-surface-500">Choose a profile, enter dimensions — works for bars, tubes, plates and structural sections.</p>
                            </div>
                        </div>
                        <button onClick={onClose} className="btn-ghost btn-icon">
                            <i className="fi fi-rr-cross text-base leading-none" />
                        </button>
                    </div>

                    <div className="p-5 space-y-5">
                        {/* Shape picker — grouped grid with SVG icons */}
                        <div className="form-group">
                            <label className="form-label">Profile</label>
                            <div className="space-y-3">
                                {groups.map(g => (
                                    <div key={g}>
                                        <div className="text-[10px] font-bold text-surface-400 uppercase tracking-wider mb-1.5">{g}</div>
                                        <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                                            {SHAPES.filter(s => s.group === g).map(s => (
                                                <button key={s.value} type="button"
                                                    onClick={() => setShape(s.value)}
                                                    className={`flex flex-col items-center gap-1 p-2 rounded-xl border-2 transition-all ${
                                                        shape === s.value
                                                            ? 'border-amber-500 bg-amber-50/60 shadow-sm'
                                                            : 'border-surface-100 hover:border-surface-300 bg-white'
                                                    }`}
                                                >
                                                    <ShapeIcon shape={s.value} active={shape === s.value} />
                                                    <span className={`text-[10px] font-semibold leading-tight text-center ${shape === s.value ? 'text-amber-700' : 'text-surface-600'}`}>
                                                        {s.label}
                                                    </span>
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Unit selector */}
                        <div className="form-group">
                            <label className="form-label">Measurement Unit</label>
                            <div className="flex gap-1 bg-surface-100 p-1 rounded-xl">
                                {(['mm', 'cm', 'm', 'inch', 'feet'] as Unit[]).map(u => (
                                    <button key={u} type="button"
                                        onClick={() => setUnit(u)}
                                        className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all ${
                                            unit === u
                                                ? 'bg-white text-amber-700 shadow-premium'
                                                : 'text-surface-500 hover:text-surface-700'
                                        }`}>
                                        {u.toUpperCase()}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Dimensions — per shape */}
                        <div className="form-group">
                            <label className="form-label">Dimensions</label>
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                                {shape === 'rectangular' && <>
                                    <DimInput label="Length" value={length} setValue={setLength} unit={unit} />
                                    <DimInput label="Width"  value={width}  setValue={setWidth}  unit={unit} />
                                    <DimInput label="Height" value={height} setValue={setHeight} unit={unit} />
                                </>}
                                {shape === 'square' && <>
                                    <DimInput label="Side (A)" value={side} setValue={setSide} unit={unit} />
                                    <DimInput label="Length"   value={height} setValue={setHeight} unit={unit} />
                                </>}
                                {shape === 'sheet_plate' && <>
                                    <DimInput label="Length"    value={length} setValue={setLength} unit={unit} />
                                    <DimInput label="Width"     value={width}  setValue={setWidth}  unit={unit} />
                                    <DimInput label="Thickness" value={thickness} setValue={setThickness} unit={unit} />
                                </>}
                                {shape === 'round_bar' && <>
                                    <DimInput label="Diameter (D)" value={diaOuter} setValue={setDiaOuter} unit={unit} />
                                    <DimInput label="Length"        value={height} setValue={setHeight} unit={unit} />
                                </>}
                                {shape === 'hexagonal_bar' && <>
                                    <DimInput label="Across Flats (F)" value={side} setValue={setSide} unit={unit} />
                                    <DimInput label="Length"           value={height} setValue={setHeight} unit={unit} />
                                </>}
                                {shape === 'triangular_bar' && <>
                                    <DimInput label="Side (A)" value={side} setValue={setSide} unit={unit} />
                                    <DimInput label="Length"   value={height} setValue={setHeight} unit={unit} />
                                </>}
                                {shape === 'round_tube' && <>
                                    <DimInput label="Outer Dia (D)" value={diaOuter} setValue={setDiaOuter} unit={unit} />
                                    <DimInput label="Inner Dia (d)" value={diaInner} setValue={setDiaInner} unit={unit} />
                                    <DimInput label="Length"        value={height} setValue={setHeight} unit={unit} />
                                </>}
                                {shape === 'square_tube' && <>
                                    <DimInput label="Side (A)"   value={side} setValue={setSide} unit={unit} />
                                    <DimInput label="Wall Thk"   value={thickness} setValue={setThickness} unit={unit} />
                                    <DimInput label="Length"     value={height} setValue={setHeight} unit={unit} />
                                </>}
                                {shape === 'rectangular_tube' && <>
                                    <DimInput label="Outer W"    value={width}  setValue={setWidth}  unit={unit} />
                                    <DimInput label="Outer H"    value={height} setValue={setHeight} unit={unit} />
                                    <DimInput label="Wall Thk"   value={thickness} setValue={setThickness} unit={unit} />
                                    <DimInput label="Length"     value={length} setValue={setLength} unit={unit} />
                                </>}
                                {shape === 'ring' && <>
                                    <DimInput label="Outer Dia (D)" value={diaOuter} setValue={setDiaOuter} unit={unit} />
                                    <DimInput label="Inner Dia (d)" value={diaInner} setValue={setDiaInner} unit={unit} />
                                    <DimInput label="Thickness"     value={thickness} setValue={setThickness} unit={unit} />
                                </>}
                                {shape === 'angle' && <>
                                    <DimInput label="Leg A"      value={width}  setValue={setWidth}  unit={unit} />
                                    <DimInput label="Leg B"      value={height} setValue={setHeight} unit={unit} />
                                    <DimInput label="Thickness"  value={thickness} setValue={setThickness} unit={unit} />
                                    <DimInput label="Length"     value={length} setValue={setLength} unit={unit} />
                                </>}
                                {shape === 'channel' && <>
                                    <DimInput label="Height (H)"     value={height} setValue={setHeight} unit={unit} />
                                    <DimInput label="Flange Width"   value={flangeWidth} setValue={setFlangeWidth} unit={unit} />
                                    <DimInput label="Web Thk"        value={webThk} setValue={setWebThk} unit={unit} />
                                    <DimInput label="Flange Thk"     value={flangeThk} setValue={setFlangeThk} unit={unit} />
                                    <DimInput label="Length"         value={length} setValue={setLength} unit={unit} />
                                </>}
                                {shape === 'i_beam' && <>
                                    <DimInput label="Height (H)"     value={height} setValue={setHeight} unit={unit} />
                                    <DimInput label="Flange Width"   value={flangeWidth} setValue={setFlangeWidth} unit={unit} />
                                    <DimInput label="Web Thk"        value={webThk} setValue={setWebThk} unit={unit} />
                                    <DimInput label="Flange Thk"     value={flangeThk} setValue={setFlangeThk} unit={unit} />
                                    <DimInput label="Length"         value={length} setValue={setLength} unit={unit} />
                                </>}
                                {shape === 't_section' && <>
                                    <DimInput label="Height (H)"     value={height} setValue={setHeight} unit={unit} />
                                    <DimInput label="Flange Width"   value={flangeWidth} setValue={setFlangeWidth} unit={unit} />
                                    <DimInput label="Web Thk"        value={webThk} setValue={setWebThk} unit={unit} />
                                    <DimInput label="Flange Thk"     value={flangeThk} setValue={setFlangeThk} unit={unit} />
                                    <DimInput label="Length"         value={length} setValue={setLength} unit={unit} />
                                </>}
                            </div>
                        </div>

                        {/* Material */}
                        <div className="form-group">
                            <label className="form-label">Material</label>
                            <select value={materialId} onChange={e => { setMaterialId(e.target.value ? Number(e.target.value) : ''); setCustomDensity(''); }}
                                className="form-select">
                                <option value="">— Select material or enter custom density —</option>
                                {materials.map(mat => (
                                    <option key={mat.id} value={mat.id}>{mat.name} ({Number(mat.density_kg_m3)} kg/m³)</option>
                                ))}
                            </select>
                            {!materialId && (
                                <input type="number" min="0" step="0.01"
                                    value={customDensity}
                                    onChange={e => setCustomDensity(e.target.value)}
                                    placeholder="Custom density (kg/m³)"
                                    className="form-input mt-2" />
                            )}
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div className="form-group">
                                <label className="form-label">Number of Pieces</label>
                                <input type="number" min="1" value={pieceCount}
                                    onChange={e => setPieceCount(e.target.value)}
                                    className="form-input" />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Factor of Safety</label>
                                <input type="number" min="0" step="any" value={safetyFactor}
                                    onChange={e => setSafetyFactor(e.target.value)}
                                    placeholder="1"
                                    className="form-input" />
                                <p className="text-[11px] text-surface-400 mt-1">Total weight is multiplied by this (1 = no change).</p>
                            </div>
                        </div>

                        {/* Result */}
                        <div className="bg-gradient-to-br from-amber-50 to-brand-50 border border-amber-200 rounded-2xl p-5">
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
                                <ResultBlock label="Volume" value={`${volumeM3.toFixed(6)}`} unit="m³" />
                                <ResultBlock label="Density" value={`${(density || 0).toFixed(0)}`} unit="kg/m³" />
                                <ResultBlock label="Weight / piece" value={weightPerPiece.toFixed(3)} unit="kg" />
                                <ResultBlock label="Total weight" value={totalWeight.toFixed(3)} unit="kg" highlight={fos === 1} />
                            </div>
                            {fos !== 1 && (
                                <div className="mt-4 pt-4 border-t border-amber-200 flex items-center justify-between">
                                    <div className="text-xs text-surface-600">
                                        Total <span className="font-mono font-semibold">{totalWeight.toFixed(3)}</span> × FoS <span className="font-mono font-semibold">{fos}</span>
                                    </div>
                                    <div className="text-right">
                                        <div className="text-[10px] font-semibold text-surface-500 uppercase tracking-wider">Final weight</div>
                                        <div className="font-mono font-bold text-2xl text-amber-700">{finalWeight.toFixed(3)} <span className="text-sm">kg</span></div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Footer */}
                    <div className="px-5 py-4 border-t border-surface-100 flex items-center gap-3 bg-surface-50">
                        {onApply && (
                            <button onClick={handleApply} disabled={finalWeight <= 0} className="btn-primary">
                                <i className="fi fi-rr-check text-sm leading-none" />
                                Use {finalWeight.toFixed(3)} kg
                            </button>
                        )}
                        <button onClick={onClose} className="btn-outline">Close</button>
                    </div>
                </div>
            </div>
        </>
    );
}

function DimInput({ label, value, setValue, unit }: { label: string; value: string; setValue: (v: string) => void; unit: string }) {
    return (
        <div className="form-group">
            <label className="form-label text-xs">{label}</label>
            <div className="relative">
                <input type="number" min="0" step="any" value={value}
                    onChange={e => setValue(e.target.value)}
                    placeholder="0"
                    className="form-input pr-12" />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-surface-400 text-xs uppercase font-semibold">{unit}</span>
            </div>
        </div>
    );
}

function ResultBlock({ label, value, unit, highlight }: { label: string; value: string; unit: string; highlight?: boolean }) {
    return (
        <div>
            <div className="text-[10px] font-semibold text-surface-500 uppercase tracking-wider">{label}</div>
            <div className={`font-mono font-bold mt-1 ${highlight ? 'text-2xl text-amber-700' : 'text-base text-surface-800'}`}>
                {value}
            </div>
            <div className="text-[10px] text-surface-400">{unit}</div>
        </div>
    );
}
