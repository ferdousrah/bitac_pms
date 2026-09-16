import { forwardRef, useImperativeHandle, useRef, useState, useEffect } from 'react';
import SignaturePad, { SignaturePadHandle } from './SignaturePad';
import { UserSignatureItem } from './SignatureManager';

export interface SignatureChoice {
    /** A saved block was picked — send this as `user_signature_id`. */
    userSignatureId: number | null;
    /** One was drawn on the pad — send this data URL as `signature`. */
    drawn: string | null;
}

export interface SignaturePickerHandle {
    /** What the signer chose, read at submit time. */
    value: () => SignatureChoice;
}

interface Props {
    signatures: UserSignatureItem[];
    /** Whose signatures these are — shown when signing on someone else's behalf. */
    ownerName?: string;
    /** Offer the draw-it-now pad. Off where only a saved block makes sense. */
    allowDraw?: boolean;
    padWidth?: number;
    padHeight?: number;
    className?: string;
}

/**
 * Pick which signature goes on this document.
 *
 * Shown wherever someone signs — approving a quotation or a cost estimate,
 * issuing or approving a gate pass, issuing a letter. It starts on the
 * signer's default, so the common case is one glance and carry on.
 *
 * ⚠️ A drawn signature is only the pen stroke, so the document has nothing
 * naming the signatory under it. The saved blocks are scans that already carry
 * the name and designation — that is why they come first and drawing is the
 * fallback. The copy says so.
 */
const SignaturePicker = forwardRef<SignaturePickerHandle, Props>(function SignaturePicker(
    { signatures, ownerName, allowDraw = true, padWidth = 520, padHeight = 120, className = '' },
    ref,
) {
    const defaultId = signatures.find((s) => s.is_default)?.id ?? signatures[0]?.id ?? null;
    // A number = that saved block; 'draw' = the pad below.
    const [picked, setPicked] = useState<number | 'draw' | null>(defaultId ?? (allowDraw ? 'draw' : null));
    const padRef = useRef<SignaturePadHandle | null>(null);

    useEffect(() => {
        setPicked(defaultId ?? (allowDraw ? 'draw' : null));
    }, [defaultId, allowDraw]);

    useImperativeHandle(ref, () => ({
        value: () =>
            picked === 'draw'
                ? { userSignatureId: null, drawn: padRef.current?.toDataURL() ?? null }
                : { userSignatureId: typeof picked === 'number' ? picked : null, drawn: null },
    }), [picked]);

    if (signatures.length === 0 && !allowDraw) {
        return (
            <p className={`text-xs text-surface-400 ${className}`}>
                {ownerName ? `${ownerName} has` : 'You have'} no signature saved. Add one under Profile → Signatures.
            </p>
        );
    }

    return (
        <div className={`space-y-3 ${className}`}>
            <div className="text-[10px] font-semibold text-surface-400 uppercase tracking-wider">
                Sign with{ownerName ? ` — ${ownerName}` : ''}
            </div>

            {signatures.length > 0 ? (
                <div className="grid grid-cols-2 gap-2">
                    {signatures.map((s) => {
                        const on = picked === s.id;
                        return (
                            <button
                                key={s.id}
                                type="button"
                                onClick={() => setPicked(s.id)}
                                className={`rounded-xl border p-2 text-left transition-all ${
                                    on
                                        ? 'border-brand-500 bg-brand-50/60 ring-2 ring-brand-200'
                                        : 'border-surface-200 bg-white hover:border-surface-300'
                                }`}
                            >
                                <div className="flex items-center justify-center bg-white border border-surface-100 rounded-lg h-16 mb-1.5">
                                    {s.url ? (
                                        <img src={s.url} alt={s.label} className="max-h-full max-w-full object-contain" />
                                    ) : (
                                        <span className="text-[10px] text-surface-400">file missing</span>
                                    )}
                                </div>
                                <div className="flex items-center gap-1.5 min-w-0">
                                    <span className="text-xs font-semibold text-surface-800 truncate" title={s.label}>
                                        {s.label}
                                    </span>
                                    {s.is_default && (
                                        <span className="text-[9px] px-1 py-0.5 rounded bg-surface-200 text-surface-600 font-bold uppercase shrink-0">
                                            Default
                                        </span>
                                    )}
                                </div>
                            </button>
                        );
                    })}
                </div>
            ) : (
                <p className="text-xs text-surface-400">
                    No saved signature — draw one below, or add a scanned block under Profile → Signatures.
                </p>
            )}

            {allowDraw && (
                <>
                    <button
                        type="button"
                        onClick={() => setPicked('draw')}
                        className={`w-full rounded-xl border px-3 py-2 text-left text-xs font-semibold transition-all ${
                            picked === 'draw'
                                ? 'border-brand-500 bg-brand-50/60 text-brand-800'
                                : 'border-surface-200 bg-white text-surface-600 hover:border-surface-300'
                        }`}
                    >
                        <i className="fi fi-rr-signature text-[11px] leading-none mr-1.5" />
                        Draw one now instead
                    </button>

                    {picked === 'draw' && (
                        <div className="space-y-2">
                            <div className="rounded-xl border border-surface-200 bg-white p-2">
                                <SignaturePad ref={padRef} width={padWidth} height={padHeight} className="w-full" />
                            </div>
                            <div className="flex items-center justify-between text-[11px] text-surface-400">
                                <span>A drawn signature prints the pen stroke only — no name or designation under it.</span>
                                <button
                                    type="button"
                                    onClick={() => padRef.current?.clear()}
                                    className="text-surface-500 hover:text-surface-900 font-semibold shrink-0 ml-2"
                                >
                                    Clear
                                </button>
                            </div>
                        </div>
                    )}
                </>
            )}
        </div>
    );
});

export default SignaturePicker;
