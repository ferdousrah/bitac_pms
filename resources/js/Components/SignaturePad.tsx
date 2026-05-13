import { useEffect, useImperativeHandle, useRef, forwardRef } from 'react';

/**
 * Minimal canvas-based signature pad. No external dependency.
 *
 * Captures mouse + touch input, draws smoothed black strokes on a transparent
 * background, and exposes:
 *   - clear()  : empty the canvas
 *   - toDataURL() : PNG data URL (null when empty)
 *   - isEmpty()
 *
 * Used inside ApprovalActionModal so approvers can sign each decision inline.
 */
export interface SignaturePadHandle {
    clear: () => void;
    toDataURL: () => string | null;
    isEmpty: () => boolean;
}

interface Props {
    width?: number;
    height?: number;
    className?: string;
}

const SignaturePad = forwardRef<SignaturePadHandle, Props>(function SignaturePad(
    { width = 520, height = 140, className = '' },
    ref
) {
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const drawingRef = useRef(false);
    const lastRef = useRef<{ x: number; y: number } | null>(null);
    const hasStrokeRef = useRef(false);

    // Scale for HiDPI screens so strokes look crisp.
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const dpr = window.devicePixelRatio || 1;
        canvas.width = width * dpr;
        canvas.height = height * dpr;
        canvas.style.width = `${width}px`;
        canvas.style.height = `${height}px`;
        const ctx = canvas.getContext('2d');
        if (ctx) {
            ctx.scale(dpr, dpr);
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
            ctx.strokeStyle = '#0f172a';
            ctx.lineWidth = 1.8;
        }
    }, [width, height]);

    const getPos = (e: MouseEvent | TouchEvent): { x: number; y: number } => {
        const canvas = canvasRef.current!;
        const rect = canvas.getBoundingClientRect();
        const clientX = 'touches' in e ? e.touches[0].clientX : (e as MouseEvent).clientX;
        const clientY = 'touches' in e ? e.touches[0].clientY : (e as MouseEvent).clientY;
        return { x: clientX - rect.left, y: clientY - rect.top };
    };

    const start = (e: any) => {
        e.preventDefault();
        drawingRef.current = true;
        lastRef.current = getPos(e);
    };
    const move = (e: any) => {
        if (!drawingRef.current) return;
        e.preventDefault();
        const ctx = canvasRef.current?.getContext('2d');
        const last = lastRef.current;
        const next = getPos(e);
        if (ctx && last) {
            ctx.beginPath();
            ctx.moveTo(last.x, last.y);
            ctx.lineTo(next.x, next.y);
            ctx.stroke();
        }
        lastRef.current = next;
        hasStrokeRef.current = true;
    };
    const end = () => {
        drawingRef.current = false;
        lastRef.current = null;
    };

    useImperativeHandle(ref, () => ({
        clear: () => {
            const canvas = canvasRef.current;
            if (!canvas) return;
            const ctx = canvas.getContext('2d');
            if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
            hasStrokeRef.current = false;
        },
        toDataURL: () => {
            if (!hasStrokeRef.current) return null;
            return canvasRef.current?.toDataURL('image/png') ?? null;
        },
        isEmpty: () => !hasStrokeRef.current,
    }));

    return (
        <canvas
            ref={canvasRef}
            className={`border border-dashed border-surface-300 rounded-lg bg-white cursor-crosshair touch-none ${className}`}
            onMouseDown={start}
            onMouseMove={move}
            onMouseUp={end}
            onMouseLeave={end}
            onTouchStart={start}
            onTouchMove={move}
            onTouchEnd={end}
        />
    );
});

export default SignaturePad;
