import AppLayout from '@/Layouts/AppLayout';
import { Link, useForm } from '@inertiajs/react';
import { FormEvent, useRef, useState, useEffect } from 'react';

export default function DeliveryComplete({ delivery }: any) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [isSigning, setIsSigning] = useState(false);
    const [, setHasSig] = useState(false);

    const { data, setData, post, errors, processing } = useForm({
        received_by: '',
        received_at: new Date().toISOString().slice(0, 16),
        signature: '',
        notes: '',
    });

    // Signature pad init
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        ctx.fillStyle = '#f8fafc';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.strokeStyle = '#1e293b';
        ctx.lineWidth = 2;
        ctx.lineCap = 'round';
    }, []);

    const startDraw = (e: React.MouseEvent<HTMLCanvasElement>) => {
        setIsSigning(true);
        const canvas = canvasRef.current!;
        const ctx = canvas.getContext('2d')!;
        const rect = canvas.getBoundingClientRect();
        ctx.beginPath();
        ctx.moveTo(e.clientX - rect.left, e.clientY - rect.top);
    };

    const draw = (e: React.MouseEvent<HTMLCanvasElement>) => {
        if (!isSigning) return;
        const canvas = canvasRef.current!;
        const ctx = canvas.getContext('2d')!;
        const rect = canvas.getBoundingClientRect();
        ctx.lineTo(e.clientX - rect.left, e.clientY - rect.top);
        ctx.stroke();
        setHasSig(true);
    };

    const endDraw = () => {
        setIsSigning(false);
        const canvas = canvasRef.current!;
        setData('signature', canvas.toDataURL('image/png'));
    };

    const clearSig = () => {
        const canvas = canvasRef.current!;
        const ctx = canvas.getContext('2d')!;
        ctx.fillStyle = '#f8fafc';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        setHasSig(false);
        setData('signature', '');
    };

    const submit = (e: FormEvent) => {
        e.preventDefault();
        post(`/delivery/${delivery.id}/complete`);
    };

    return (
        <AppLayout header={`Complete Delivery — ${delivery.challan_number}`}>
            <div className="max-w-3xl animate-fade-in space-y-6">
                {/* Summary */}
                <div className="alert alert-info">
                    <i className="fi fi-rr-info text-sm leading-none" />
                    <div>
                        <div className="font-semibold">
                            {delivery.wo_number} — {delivery.product} × {delivery.quantity_delivered} units
                        </div>
                        <div className="text-xs opacity-80 mt-0.5">Customer: {delivery.customer}</div>
                    </div>
                </div>

                <form onSubmit={submit} className="space-y-6">
                    <div className="card">
                        <div className="card-header">
                            <h3 className="text-base font-bold text-surface-900">Proof of Delivery</h3>
                            <p className="text-xs text-surface-400 mt-0.5">
                                Recipient details and timestamp
                            </p>
                        </div>
                        <div className="card-body space-y-4">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="form-group">
                                    <label className="form-label">Received By *</label>
                                    <input
                                        type="text"
                                        value={data.received_by}
                                        onChange={(e) => setData('received_by', e.target.value)}
                                        className="form-input"
                                        required
                                        placeholder="Name of recipient"
                                    />
                                    {errors.received_by && (
                                        <p className="form-error">{errors.received_by}</p>
                                    )}
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Received At *</label>
                                    <input
                                        type="datetime-local"
                                        value={data.received_at}
                                        onChange={(e) => setData('received_at', e.target.value)}
                                        className="form-input"
                                        required
                                    />
                                    {errors.received_at && (
                                        <p className="form-error">{errors.received_at}</p>
                                    )}
                                </div>
                            </div>

                            <div className="form-group">
                                <label className="form-label-optional">Notes</label>
                                <textarea
                                    value={data.notes}
                                    onChange={(e) => setData('notes', e.target.value)}
                                    rows={2}
                                    className="form-textarea"
                                    placeholder="Any remarks on delivery condition..."
                                />
                            </div>
                        </div>
                    </div>

                    <div className="card">
                        <div className="card-header">
                            <h3 className="text-base font-bold text-surface-900">Recipient Signature</h3>
                            <p className="text-xs text-surface-400 mt-0.5">
                                Sign below to confirm handover
                            </p>
                        </div>
                        <div className="card-body space-y-3">
                            <canvas
                                ref={canvasRef}
                                width={720}
                                height={180}
                                className="border border-surface-200 rounded-xl w-full cursor-crosshair bg-surface-50"
                                onMouseDown={startDraw}
                                onMouseMove={draw}
                                onMouseUp={endDraw}
                                onMouseLeave={endDraw}
                            />
                            <div className="flex items-center justify-between">
                                <p className="form-hint">Draw signature using mouse or touch</p>
                                <button
                                    type="button"
                                    onClick={clearSig}
                                    className="btn-ghost btn-xs"
                                >
                                    <i className="fi fi-rr-refresh text-xs leading-none" /> Clear
                                </button>
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        <button type="submit" disabled={processing} className="btn-success">
                            <i className="fi fi-rr-check text-xs leading-none" />
                            {processing ? 'Completing...' : 'Confirm Delivery'}
                        </button>
                        <Link href="/delivery" className="btn-outline">
                            Cancel
                        </Link>
                    </div>
                </form>
            </div>
        </AppLayout>
    );
}
