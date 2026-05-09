import { useState, useEffect } from 'react';

interface Props {
    open: boolean;
    onClose: () => void;
    onApply?: (weight: number, materialName?: string) => void;
    materials?: Array<{ id: number; name: string; density_kg_m3: number }>;
}

type Shape = 'rectangular' | 'square' | 'cylindrical' | 'cylindrical_hollow';
type Unit = 'mm' | 'cm' | 'm' | 'inch' | 'feet';

const SHAPES: { value: Shape; label: string; icon: string }[] = [
    { value: 'rectangular',        label: 'Rectangular', icon: 'fi-rr-square' },
    { value: 'square',             label: 'Square',      icon: 'fi-rr-square-small' },
    { value: 'cylindrical',        label: 'Cylinder',    icon: 'fi-rr-circle' },
    { value: 'cylindrical_hollow', label: 'Hollow Tube', icon: 'fi-rr-bullseye-arrow' },
];

const UNIT_TO_M: Record<Unit, number> = {
    mm:   0.001,
    cm:   0.01,
    m:    1,
    inch: 0.0254,
    feet: 0.3048,
};

export default function WeightCalculator({ open, onClose, onApply, materials = [] }: Props) {
    const [shape, setShape] = useState<Shape>('rectangular');
    const [unit, setUnit] = useState<Unit>('mm');
    const [length, setLength] = useState('');
    const [width, setWidth] = useState('');
    const [height, setHeight] = useState('');
    const [side, setSide] = useState('');
    const [diaOuter, setDiaOuter] = useState('');
    const [diaInner, setDiaInner] = useState('');
    const [materialId, setMaterialId] = useState<number | ''>('');
    const [customDensity, setCustomDensity] = useState('');
    const [pieceCount, setPieceCount] = useState('1');

    // Reset values when modal opens
    useEffect(() => {
        if (!open) return;
        setLength(''); setWidth(''); setHeight(''); setSide('');
        setDiaOuter(''); setDiaInner('');
    }, [open]);

    const m = (v: string) => (parseFloat(v) || 0) * UNIT_TO_M[unit];

    let volumeM3 = 0;
    if (shape === 'rectangular') {
        volumeM3 = m(length) * m(width) * m(height);
    } else if (shape === 'square') {
        volumeM3 = m(side) * m(side) * m(height);
    } else if (shape === 'cylindrical') {
        const r = m(diaOuter) / 2;
        volumeM3 = Math.PI * r * r * m(height);
    } else if (shape === 'cylindrical_hollow') {
        const ro = m(diaOuter) / 2;
        const ri = m(diaInner) / 2;
        volumeM3 = Math.PI * (ro * ro - ri * ri) * m(height);
    }

    const selectedMaterial = materials.find(m => m.id === materialId);
    const density = selectedMaterial?.density_kg_m3 ?? parseFloat(customDensity) ?? 0;
    const weightPerPiece = volumeM3 * (density || 0);
    const pieces = parseInt(pieceCount) || 1;
    const totalWeight = weightPerPiece * pieces;

    const handleApply = () => {
        if (totalWeight > 0 && onApply) {
            onApply(totalWeight, selectedMaterial?.name);
            onClose();
        }
    };

    if (!open) return null;

    return (
        <>
            <div className="fixed inset-0 z-[80] bg-black/50 backdrop-blur-sm animate-fade-in" onClick={onClose} />
            <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
                <div className="bg-white rounded-2xl shadow-premium-lg border border-surface-100 w-full max-w-2xl animate-scale-in max-h-[90vh] overflow-y-auto">

                    {/* Header */}
                    <div className="px-5 py-4 border-b border-surface-100 flex items-center justify-between bg-gradient-to-b from-blue-50 to-white">
                        <div className="flex items-center gap-2">
                            <div className="w-9 h-9 rounded-xl bg-blue-100 flex items-center justify-center">
                                <i className="fi fi-rr-scale text-blue-600 text-base leading-none" />
                            </div>
                            <div>
                                <h3 className="text-base font-bold text-surface-900">Weight Calculator</h3>
                                <p className="text-xs text-surface-500">Calculate raw material weight from dimensions</p>
                            </div>
                        </div>
                        <button onClick={onClose} className="btn-ghost btn-icon">
                            <i className="fi fi-rr-cross text-base leading-none" />
                        </button>
                    </div>

                    <div className="p-5 space-y-4">
                        {/* Shape selector */}
                        <div className="form-group">
                            <label className="form-label">Job Shape</label>
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                                {SHAPES.map(s => (
                                    <button key={s.value} type="button"
                                        onClick={() => setShape(s.value)}
                                        className={`flex flex-col items-center gap-1 p-3 rounded-xl border-2 transition-all ${
                                            shape === s.value
                                                ? 'border-brand-500 bg-brand-50 text-brand-700'
                                                : 'border-surface-200 text-surface-600 hover:border-surface-300'
                                        }`}>
                                        <i className={`fi ${s.icon} text-lg leading-none`} />
                                        <span className="text-[10px] font-semibold">{s.label}</span>
                                    </button>
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
                                                ? 'bg-white text-brand-700 shadow-premium'
                                                : 'text-surface-500 hover:text-surface-700'
                                        }`}>
                                        {u.toUpperCase()}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Dimensions based on shape */}
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                            {shape === 'rectangular' && (
                                <>
                                    <DimInput label="Length" value={length} setValue={setLength} unit={unit} />
                                    <DimInput label="Width"  value={width}  setValue={setWidth}  unit={unit} />
                                    <DimInput label="Height" value={height} setValue={setHeight} unit={unit} />
                                </>
                            )}
                            {shape === 'square' && (
                                <>
                                    <DimInput label="Side" value={side} setValue={setSide} unit={unit} />
                                    <DimInput label="Height" value={height} setValue={setHeight} unit={unit} />
                                </>
                            )}
                            {shape === 'cylindrical' && (
                                <>
                                    <DimInput label="Diameter" value={diaOuter} setValue={setDiaOuter} unit={unit} />
                                    <DimInput label="Height (Length)" value={height} setValue={setHeight} unit={unit} />
                                </>
                            )}
                            {shape === 'cylindrical_hollow' && (
                                <>
                                    <DimInput label="Outer Dia (D)" value={diaOuter} setValue={setDiaOuter} unit={unit} />
                                    <DimInput label="Inner Dia (d)" value={diaInner} setValue={setDiaInner} unit={unit} />
                                    <DimInput label="Height (Length)" value={height} setValue={setHeight} unit={unit} />
                                </>
                            )}
                        </div>

                        {/* Material */}
                        <div className="form-group">
                            <label className="form-label">Material</label>
                            <select value={materialId} onChange={e => { setMaterialId(e.target.value ? Number(e.target.value) : ''); setCustomDensity(''); }}
                                className="form-select">
                                <option value="">— Select material or enter custom density —</option>
                                {materials.map(m => (
                                    <option key={m.id} value={m.id}>{m.name} ({m.density_kg_m3} kg/m³)</option>
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

                        <div className="form-group">
                            <label className="form-label">Number of Pieces</label>
                            <input type="number" min="1" value={pieceCount}
                                onChange={e => setPieceCount(e.target.value)}
                                className="form-input" />
                        </div>

                        {/* Result */}
                        <div className="bg-gradient-to-br from-brand-50 to-amber-50 border border-brand-200 rounded-2xl p-5">
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
                                <ResultBlock label="Volume" value={`${volumeM3.toFixed(6)}`} unit="m³" />
                                <ResultBlock label="Density" value={`${(density || 0).toFixed(0)}`} unit="kg/m³" />
                                <ResultBlock label="Weight / piece" value={weightPerPiece.toFixed(3)} unit="kg" />
                                <ResultBlock label="Total weight" value={totalWeight.toFixed(3)} unit="kg" highlight />
                            </div>
                        </div>
                    </div>

                    {/* Footer */}
                    <div className="px-5 py-4 border-t border-surface-100 flex items-center gap-3 bg-surface-50">
                        {onApply && (
                            <button onClick={handleApply} disabled={totalWeight <= 0} className="btn-primary">
                                <i className="fi fi-rr-check text-sm leading-none" />
                                Use {totalWeight.toFixed(3)} kg
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
            <div className={`font-mono font-bold mt-1 ${highlight ? 'text-2xl text-brand-700' : 'text-base text-surface-800'}`}>
                {value}
            </div>
            <div className="text-[10px] text-surface-400">{unit}</div>
        </div>
    );
}
