import { useEffect, useRef, useState } from 'react';

interface Props {
    open: boolean;
    onClose: () => void;
}

type Mode = 'basic' | 'scientific';

const STORAGE_KEY = 'bitac_calc_position';

export default function FloatingCalculator({ open, onClose }: Props) {
    const [display, setDisplay] = useState('0');
    const [expression, setExpression] = useState('');
    const [history, setHistory] = useState<string[]>([]);
    const [mode, setMode] = useState<Mode>('scientific');
    const [memory, setMemory] = useState<number>(0);
    const [angleDeg, setAngleDeg] = useState(true);
    const [shiftMode, setShiftMode] = useState(false);

    // Position (draggable)
    const [pos, setPos] = useState<{ x: number; y: number }>(() => {
        if (typeof window === 'undefined') return { x: 100, y: 100 };
        try {
            const saved = localStorage.getItem(STORAGE_KEY);
            if (saved) return JSON.parse(saved);
        } catch {}
        return { x: window.innerWidth - 360, y: 100 };
    });
    const [dragging, setDragging] = useState(false);
    const dragOffset = useRef({ x: 0, y: 0 });
    const calcRef = useRef<HTMLDivElement>(null);

    // Persist position
    useEffect(() => {
        try { localStorage.setItem(STORAGE_KEY, JSON.stringify(pos)); } catch {}
    }, [pos]);

    // Drag handlers
    const onDragStart = (e: React.MouseEvent | React.TouchEvent) => {
        const point = 'touches' in e ? e.touches[0] : e;
        const rect = calcRef.current?.getBoundingClientRect();
        if (!rect) return;
        dragOffset.current = { x: point.clientX - rect.left, y: point.clientY - rect.top };
        setDragging(true);
    };

    useEffect(() => {
        if (!dragging) return;
        const onMove = (e: MouseEvent | TouchEvent) => {
            const point = 'touches' in e ? e.touches[0] : (e as MouseEvent);
            const rect = calcRef.current?.getBoundingClientRect();
            const w = rect?.width ?? 320;
            const h = rect?.height ?? 480;
            setPos({
                x: Math.max(0, Math.min(window.innerWidth - w, point.clientX - dragOffset.current.x)),
                y: Math.max(0, Math.min(window.innerHeight - h, point.clientY - dragOffset.current.y)),
            });
        };
        const onUp = () => setDragging(false);
        window.addEventListener('mousemove', onMove);
        window.addEventListener('mouseup', onUp);
        window.addEventListener('touchmove', onMove);
        window.addEventListener('touchend', onUp);
        return () => {
            window.removeEventListener('mousemove', onMove);
            window.removeEventListener('mouseup', onUp);
            window.removeEventListener('touchmove', onMove);
            window.removeEventListener('touchend', onUp);
        };
    }, [dragging]);

    // ── Calculator logic ──────────────────────────────────────────
    const append = (val: string) => {
        if (display === '0' || display === 'Error') {
            setDisplay(val);
        } else {
            setDisplay(display + val);
        }
    };

    const appendOp = (op: string) => {
        if (display === 'Error') return;
        setDisplay(display + op);
    };

    const clear = () => { setDisplay('0'); setExpression(''); };
    const clearEntry = () => setDisplay('0');
    const backspace = () => setDisplay(display.length > 1 ? display.slice(0, -1) : '0');

    const evaluate = () => {
        try {
            // Replace display-only symbols with JS-safe ones
            let expr = display
                .replace(/×/g, '*')
                .replace(/÷/g, '/')
                .replace(/π/g, 'Math.PI')
                .replace(/(\d+(?:\.\d+)?)\s*%/g, '($1/100)')
                .replace(/√\(/g, 'Math.sqrt(')
                .replace(/\^/g, '**');

            // eslint-disable-next-line no-new-func
            const result = Function('"use strict"; return (' + expr + ')')();
            if (typeof result !== 'number' || !isFinite(result)) {
                setDisplay('Error');
                return;
            }
            const formatted = formatResult(result);
            setHistory([...history.slice(-9), `${display} = ${formatted}`]);
            setDisplay(formatted);
        } catch {
            setDisplay('Error');
        }
    };

    const formatResult = (n: number): string => {
        if (Number.isInteger(n)) return n.toString();
        const fixed = n.toFixed(10).replace(/\.?0+$/, '');
        return fixed;
    };

    const applyFunction = (fn: string) => {
        try {
            const value = parseFloat(display);
            if (isNaN(value)) { setDisplay('Error'); return; }
            const angleConv = angleDeg ? Math.PI / 180 : 1;
            let result: number;
            switch (fn) {
                case 'sin':   result = Math.sin(value * angleConv); break;
                case 'cos':   result = Math.cos(value * angleConv); break;
                case 'tan':   result = Math.tan(value * angleConv); break;
                case 'asin':  result = Math.asin(value) / angleConv; break;
                case 'acos':  result = Math.acos(value) / angleConv; break;
                case 'atan':  result = Math.atan(value) / angleConv; break;
                case 'log':   result = Math.log10(value); break;
                case 'ln':    result = Math.log(value); break;
                case 'sqrt':  result = Math.sqrt(value); break;
                case 'cube':  result = value ** 3; break;
                case 'square':result = value ** 2; break;
                case 'exp':   result = Math.exp(value); break;
                case 'fact':  result = factorial(value); break;
                case '1/x':   result = 1 / value; break;
                case 'neg':   result = -value; break;
                case 'abs':   result = Math.abs(value); break;
                default:      return;
            }
            if (!isFinite(result)) { setDisplay('Error'); return; }
            setDisplay(formatResult(result));
        } catch {
            setDisplay('Error');
        }
    };

    const factorial = (n: number): number => {
        if (n < 0 || !Number.isInteger(n)) return NaN;
        if (n <= 1) return 1;
        let r = 1;
        for (let i = 2; i <= n; i++) r *= i;
        return r;
    };

    const memoryOp = (op: 'MS' | 'MR' | 'MC' | 'M+' | 'M-') => {
        const value = parseFloat(display);
        if (op !== 'MR' && isNaN(value)) return;
        switch (op) {
            case 'MS': setMemory(value); break;
            case 'MR': setDisplay(formatResult(memory)); break;
            case 'MC': setMemory(0); break;
            case 'M+': setMemory(memory + value); break;
            case 'M-': setMemory(memory - value); break;
        }
    };

    // Keyboard support
    useEffect(() => {
        if (!open) return;
        const onKey = (e: KeyboardEvent) => {
            if ((e.target as HTMLElement)?.tagName === 'INPUT' || (e.target as HTMLElement)?.tagName === 'TEXTAREA') return;
            if (/^\d$/.test(e.key)) { append(e.key); e.preventDefault(); }
            else if (e.key === '.')  { append('.'); e.preventDefault(); }
            else if (e.key === '+' || e.key === '-' || e.key === '*' || e.key === '/') {
                appendOp(e.key === '*' ? '×' : e.key === '/' ? '÷' : e.key); e.preventDefault();
            }
            else if (e.key === '(' || e.key === ')') { append(e.key); e.preventDefault(); }
            else if (e.key === 'Enter' || e.key === '=') { evaluate(); e.preventDefault(); }
            else if (e.key === 'Backspace') { backspace(); e.preventDefault(); }
            else if (e.key === 'Escape') { onClose(); e.preventDefault(); }
            else if (e.key.toLowerCase() === 'c') { clear(); e.preventDefault(); }
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [open, display, history, memory]);

    if (!open) return null;

    return (
        <div
            ref={calcRef}
            className="fixed z-[100] select-none animate-scale-in"
            style={{ left: pos.x, top: pos.y, width: mode === 'scientific' ? 360 : 300 }}
        >
            <div className="bg-white rounded-3xl shadow-[0_20px_60px_-15px_rgba(0,0,0,0.35)] border border-surface-200/80 overflow-hidden backdrop-blur-xl">

                {/* ─── Header / Drag handle ───────────────────────────── */}
                <div
                    onMouseDown={onDragStart}
                    onTouchStart={onDragStart}
                    className="relative flex items-center justify-between px-4 py-3 bg-gradient-to-br from-surface-900 via-surface-850 to-surface-950 cursor-grab active:cursor-grabbing border-b border-white/5"
                >
                    <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-brand-400 to-brand-600 flex items-center justify-center shadow-[0_2px_8px_rgba(255,122,15,0.4)]">
                            <i className="fi fi-sr-calculator text-white text-[11px] leading-none" />
                        </div>
                        <div>
                            <div className="text-[13px] font-bold text-white leading-tight">Calculator</div>
                            <div className="text-[9px] text-white/40 font-mono uppercase tracking-wider leading-tight">
                                {mode === 'scientific' ? 'Scientific' : 'Standard'}
                                {memory !== 0 && <span className="text-brand-400 ml-1.5">• M</span>}
                            </div>
                        </div>
                    </div>
                    <div className="flex items-center gap-1">
                        {mode === 'scientific' && (
                            <button
                                onClick={() => setAngleDeg(!angleDeg)}
                                className="text-white/70 hover:text-white text-[10px] px-2 py-1 rounded-md hover:bg-white/10 font-bold transition-colors"
                                title="Toggle angle unit"
                            >
                                {angleDeg ? 'DEG' : 'RAD'}
                            </button>
                        )}
                        <button
                            onClick={() => setMode(mode === 'basic' ? 'scientific' : 'basic')}
                            className="text-white/70 hover:text-white p-1.5 rounded-md hover:bg-white/10 transition-colors"
                            title={mode === 'basic' ? 'Scientific mode' : 'Standard mode'}
                        >
                            <i className={`fi ${mode === 'basic' ? 'fi-rr-function' : 'fi-rr-grid'} text-xs leading-none`} />
                        </button>
                        <button
                            onClick={onClose}
                            className="text-white/70 hover:text-white p-1.5 rounded-md hover:bg-red-500/20 hover:text-red-400 transition-colors"
                            title="Close"
                        >
                            <i className="fi fi-rr-cross text-xs leading-none" />
                        </button>
                    </div>
                </div>

                {/* ─── Display ────────────────────────────────────────── */}
                <div className="bg-gradient-to-b from-surface-50 to-white px-5 py-5 border-b border-surface-100">
                    {/* History line */}
                    <div className="min-h-[14px] mb-1.5">
                        {history.length > 0 && (
                            <div className="text-[11px] text-surface-400 text-right truncate font-mono">
                                {history[history.length - 1]}
                            </div>
                        )}
                    </div>
                    {/* Main display */}
                    <div
                        className="text-right font-mono font-bold text-surface-900 truncate tracking-tight leading-none"
                        style={{ fontSize: display.length > 12 ? '1.75rem' : '2.25rem' }}
                    >
                        {display}
                    </div>
                </div>

                {/* ─── Buttons ───────────────────────────────────────── */}
                <div className="p-3 bg-surface-50/50">
                    {/* Memory row */}
                    <div className="grid grid-cols-5 gap-1.5 mb-1.5">
                        {(['MC', 'MR', 'M+', 'M-', 'MS'] as const).map(op => (
                            <BtnSmall key={op} onClick={() => memoryOp(op)} variant="memory">{op}</BtnSmall>
                        ))}
                    </div>

                    {/* Scientific functions */}
                    {mode === 'scientific' && (
                        <div className="space-y-1.5 mb-2 pb-2 border-b border-surface-200/60">
                            <div className="grid grid-cols-5 gap-1.5">
                                <BtnSmall onClick={() => applyFunction(shiftMode ? 'asin' : 'sin')}>{shiftMode ? 'sin⁻¹' : 'sin'}</BtnSmall>
                                <BtnSmall onClick={() => applyFunction(shiftMode ? 'acos' : 'cos')}>{shiftMode ? 'cos⁻¹' : 'cos'}</BtnSmall>
                                <BtnSmall onClick={() => applyFunction(shiftMode ? 'atan' : 'tan')}>{shiftMode ? 'tan⁻¹' : 'tan'}</BtnSmall>
                                <BtnSmall onClick={() => applyFunction('log')}>log</BtnSmall>
                                <BtnSmall onClick={() => applyFunction('ln')}>ln</BtnSmall>
                            </div>
                            <div className="grid grid-cols-5 gap-1.5">
                                <BtnSmall onClick={() => setShiftMode(!shiftMode)} variant={shiftMode ? 'accent' : 'default'}>shift</BtnSmall>
                                <BtnSmall onClick={() => applyFunction('square')}>x²</BtnSmall>
                                <BtnSmall onClick={() => applyFunction('cube')}>x³</BtnSmall>
                                <BtnSmall onClick={() => appendOp('^')}>xʸ</BtnSmall>
                                <BtnSmall onClick={() => applyFunction('sqrt')}>√</BtnSmall>
                            </div>
                            <div className="grid grid-cols-5 gap-1.5">
                                <BtnSmall onClick={() => append('π')}>π</BtnSmall>
                                <BtnSmall onClick={() => applyFunction('exp')}>eˣ</BtnSmall>
                                <BtnSmall onClick={() => applyFunction('fact')}>n!</BtnSmall>
                                <BtnSmall onClick={() => applyFunction('1/x')}>1/x</BtnSmall>
                                <BtnSmall onClick={() => applyFunction('abs')}>|x|</BtnSmall>
                            </div>
                        </div>
                    )}

                    {/* Main keypad */}
                    <div className="grid grid-cols-4 gap-1.5">
                        <Btn onClick={clear} variant="danger">AC</Btn>
                        <Btn onClick={clearEntry} variant="secondary">CE</Btn>
                        <Btn onClick={backspace} variant="secondary"><i className="fi fi-rr-delete-left text-base leading-none" /></Btn>
                        <Btn onClick={() => appendOp('÷')} variant="op">÷</Btn>

                        <Btn onClick={() => append('7')}>7</Btn>
                        <Btn onClick={() => append('8')}>8</Btn>
                        <Btn onClick={() => append('9')}>9</Btn>
                        <Btn onClick={() => appendOp('×')} variant="op">×</Btn>

                        <Btn onClick={() => append('4')}>4</Btn>
                        <Btn onClick={() => append('5')}>5</Btn>
                        <Btn onClick={() => append('6')}>6</Btn>
                        <Btn onClick={() => appendOp('-')} variant="op">−</Btn>

                        <Btn onClick={() => append('1')}>1</Btn>
                        <Btn onClick={() => append('2')}>2</Btn>
                        <Btn onClick={() => append('3')}>3</Btn>
                        <Btn onClick={() => appendOp('+')} variant="op">+</Btn>

                        <Btn onClick={() => applyFunction('neg')}>±</Btn>
                        <Btn onClick={() => append('0')}>0</Btn>
                        <Btn onClick={() => append('.')}>.</Btn>
                        <Btn onClick={evaluate} variant="primary">=</Btn>
                    </div>
                </div>
            </div>
        </div>
    );
}

function Btn({ onClick, children, variant = 'default' }: { onClick: () => void; children: any; variant?: 'default' | 'primary' | 'secondary' | 'danger' | 'op' }) {
    const styles: Record<string, string> = {
        // Digit buttons: crisp white with inner shadow for subtle depth
        default: `
            bg-white text-surface-900
            border border-surface-200
            shadow-[0_1px_2px_rgba(15,23,42,0.04),inset_0_-1px_0_rgba(15,23,42,0.06)]
            hover:bg-surface-50 hover:border-surface-300
            hover:shadow-[0_2px_4px_rgba(15,23,42,0.08),inset_0_-1px_0_rgba(15,23,42,0.08)]
        `,
        // Equals: primary action with glow
        primary: `
            bg-gradient-to-b from-brand-500 to-brand-600 text-white
            border border-brand-600
            shadow-[0_4px_12px_-2px_rgba(255,122,15,0.5),inset_0_1px_0_rgba(255,255,255,0.2)]
            hover:from-brand-400 hover:to-brand-500
            hover:shadow-[0_6px_16px_-2px_rgba(255,122,15,0.6),inset_0_1px_0_rgba(255,255,255,0.3)]
        `,
        // CE, backspace: subtle gray
        secondary: `
            bg-surface-100 text-surface-700
            border border-surface-200
            shadow-[0_1px_2px_rgba(15,23,42,0.04),inset_0_-1px_0_rgba(15,23,42,0.06)]
            hover:bg-surface-200 hover:border-surface-300
        `,
        // AC: subtle red
        danger: `
            bg-red-50 text-red-600 font-extrabold
            border border-red-200
            shadow-[0_1px_2px_rgba(239,68,68,0.08),inset_0_-1px_0_rgba(239,68,68,0.1)]
            hover:bg-red-100 hover:border-red-300
        `,
        // Operators (+, -, ×, ÷): brand-tinted for hierarchy
        op: `
            bg-brand-50 text-brand-700 font-extrabold
            border border-brand-200
            shadow-[0_1px_2px_rgba(255,122,15,0.08),inset_0_-1px_0_rgba(255,122,15,0.1)]
            hover:bg-brand-100 hover:border-brand-300 hover:text-brand-800
        `,
    };
    return (
        <button onClick={onClick}
            className={`h-12 rounded-xl text-[17px] font-bold transition-all duration-150 active:scale-[0.96] active:shadow-inner ${styles[variant]}`}>
            {children}
        </button>
    );
}

function BtnSmall({ onClick, children, variant = 'default' }: { onClick: () => void; children: any; variant?: 'default' | 'memory' | 'accent' }) {
    const styles: Record<string, string> = {
        default: `
            bg-white text-surface-800
            border border-surface-200
            shadow-[0_1px_1px_rgba(15,23,42,0.03)]
            hover:bg-surface-50 hover:border-surface-300 hover:text-surface-900
        `,
        memory: `
            bg-blue-50 text-blue-700
            border border-blue-200
            shadow-[0_1px_1px_rgba(59,130,246,0.05)]
            hover:bg-blue-100 hover:border-blue-300
        `,
        accent: `
            bg-amber-100 text-amber-800
            border border-amber-300
            shadow-[0_1px_1px_rgba(245,158,11,0.1),inset_0_0_0_1px_rgba(245,158,11,0.2)]
            hover:bg-amber-200
        `,
    };
    return (
        <button onClick={onClick}
            className={`h-9 rounded-lg text-[11px] font-bold transition-all duration-150 active:scale-[0.96] tracking-tight ${styles[variant]}`}>
            {children}
        </button>
    );
}
