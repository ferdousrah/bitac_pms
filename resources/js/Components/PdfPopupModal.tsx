import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';

interface Props {
    open: boolean;
    pdfUrl: string | null;
    title?: string;
    subtitle?: string;
    onClose: () => void;
}

type Pad = 'bn' | 'en';

/** The same URL with `pad` set — every letterhead PDF honours it (BitacLetterhead). */
function withPad(url: string, pad: Pad | null): string {
    if (!pad || url.startsWith('blob:')) return url;
    const u = new URL(url, window.location.origin);
    u.searchParams.set('pad', pad);
    return u.pathname + u.search;
}

/** "inline; filename=\"x.pdf\"" → x.pdf */
function filenameFrom(disposition: string | null): string | null {
    const m = disposition?.match(/filename\*?=(?:UTF-8'')?"?([^";]+)"?/i);
    return m ? decodeURIComponent(m[1]) : null;
}

/**
 * Fullscreen modal that embeds a PDF via iframe.
 * Fetches the PDF as a blob and uses a blob: URL so download manager extensions
 * (IDM, FDM, etc.) can't intercept the request.
 *
 * **বাংলা / English pad** (BITAC, 2026-10-20): every PDF printed on the BITAC
 * letterhead can be switched to the other pad from here — the server says it
 * has one via `X-Pdf-Pad` (AnnouncePdfPad), and plain-paper documents (notes,
 * envelopes, মূসক ৬.৩) say nothing, so the switch is not offered for them.
 *
 * ⚠️ Open and Download use the PDF ALREADY LOADED here (the blob), not the
 * request URL: that URL usually carries `preview=base64` and answers with
 * JSON, so linking to it saved a data file instead of the PDF — and it would
 * also lose the pad that was chosen.
 */
export default function PdfPopupModal({ open, pdfUrl, title = 'Document', subtitle, onClose }: Props) {
    const [blobUrl, setBlobUrl] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [pad, setPad] = useState<Pad | null>(null);              // null = the document's own pad
    const [padInfo, setPadInfo] = useState<{ used: Pad; default: Pad } | null>(null);
    const [filename, setFilename] = useState<string | null>(null);

    // A different document starts on its own pad again.
    useEffect(() => { setPad(null); setPadInfo(null); }, [pdfUrl]);

    const effectiveUrl = pdfUrl ? withPad(pdfUrl, pad) : null;

    useEffect(() => {
        if (!open) return;
        const handler = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, [open]);

    useEffect(() => {
        if (!open || !effectiveUrl) {
            setBlobUrl(null);
            setError(null);
            return;
        }
        const pdfUrl = effectiveUrl;
        let revokedUrl: string | null = null;
        let cancelled = false;

        setLoading(true);
        setError(null);

        // Server returns JSON { data: base64 } when URL has ?preview=base64.
        // This bypasses download-manager extensions (IDM/FDM) which only intercept
        // responses with application/pdf content-type. We decode client-side.
        const isBase64 = /\bpreview=base64\b/.test(pdfUrl);

        const readPad = (res: Response) => {
            const used = res.headers.get('X-Pdf-Pad');
            const def  = res.headers.get('X-Pdf-Pad-Default');
            if (!cancelled) {
                setPadInfo(used === 'bn' || used === 'en'
                    ? { used, default: def === 'en' ? 'en' : 'bn' }
                    : null);
            }
        };

        const request = isBase64
            ? fetch(pdfUrl, { credentials: 'same-origin', headers: { Accept: 'application/json' } })
                .then(async (res) => {
                    if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
                    readPad(res);
                    const json = await res.json();
                    if (!json?.data) throw new Error('Server returned no PDF data.');
                    if (!cancelled) setFilename(json.filename ?? null);
                    // base64 → Uint8Array
                    const binary = atob(json.data);
                    const bytes = new Uint8Array(binary.length);
                    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
                    return bytes;
                })
            : fetch(pdfUrl, {
                credentials: 'same-origin',
                headers: { Accept: 'application/pdf' },
            }).then(async (res) => {
                if (!res.ok) {
                    // Read a snippet of the body for diagnostics (HTML error pages, etc.)
                    let detail = '';
                    try { detail = (await res.text()).slice(0, 200); } catch {}
                    throw new Error(`HTTP ${res.status} ${res.statusText}${detail ? ' — ' + detail : ''}`);
                }
                readPad(res);
                if (!cancelled) setFilename(filenameFrom(res.headers.get('content-disposition')));
                const ct = res.headers.get('content-type') ?? '';
                const buf = await res.arrayBuffer();
                if (!ct.includes('pdf')) {
                    // Try to surface what was returned (helps diagnose redirects / HTML pages).
                    let preview = '';
                    try { preview = new TextDecoder().decode(buf.slice(0, 200)); } catch {}
                    throw new Error(`Server returned ${ct || 'unknown'} (${buf.byteLength} bytes) — ${preview.replace(/\s+/g, ' ')}`);
                }
                return new Uint8Array(buf);
            });

        request
            .then((bytes) => {
                if (cancelled) return;
                if (bytes.byteLength === 0) throw new Error('Received empty response.');
                const blob = new Blob([bytes], { type: 'application/pdf' });
                const url = URL.createObjectURL(blob);
                revokedUrl = url;
                setBlobUrl(url);
            })
            .catch((err) => {
                if (cancelled) return;
                setError(err?.message || 'Failed to load PDF.');
            })
            .finally(() => {
                if (!cancelled) setLoading(false);
            });

        return () => {
            cancelled = true;
            if (revokedUrl) URL.revokeObjectURL(revokedUrl);
        };
    }, [open, effectiveUrl]);

    if (!open || !pdfUrl) return null;

    // The saved file says which pad it is on when that is not the document's own.
    const baseName = (filename ?? `${title}.pdf`).replace(/[\\/:*?"<>|]+/g, '-');
    const downloadName = padInfo && padInfo.used !== padInfo.default && !/-EN\.pdf$|-BN\.pdf$/i.test(baseName)
        ? baseName.replace(/\.pdf$/i, '') + (padInfo.used === 'en' ? '-EN-pad.pdf' : '-BN-pad.pdf')
        : baseName;

    return (
        <AnimatePresence>
            <motion.div
                className="fixed inset-0 z-[200] flex items-center justify-center p-4"
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            >
                <div className="absolute inset-0 bg-slate-900/70 backdrop-blur-sm" onClick={onClose} />

                <motion.div
                    className="relative bg-white rounded-2xl shadow-2xl w-full max-w-5xl h-[90vh] flex flex-col overflow-hidden"
                    initial={{ scale: 0.96, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.96, y: 20 }}
                    transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                >
                    {/* Header */}
                    <div className="relative px-5 py-3 bg-gradient-to-r from-slate-900 to-slate-800 text-white shrink-0 flex items-center justify-between">
                        <div className="flex items-center gap-3 min-w-0">
                            <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center shrink-0">
                                <i className="fi fi-rr-file-pdf text-red-300 text-base leading-none" />
                            </div>
                            <div className="min-w-0">
                                <h3 className="text-sm font-bold leading-tight truncate">{title}</h3>
                                {subtitle && <p className="text-[11px] text-white/70 mt-0.5 truncate">{subtitle}</p>}
                            </div>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                            {/* বাংলা / English pad — only for a PDF that is on the letterhead. */}
                            {padInfo && (
                                <div className="hidden sm:flex items-center mr-2 p-0.5 rounded-lg bg-white/10" role="group" aria-label="Letterhead">
                                    {(['bn', 'en'] as const).map(p => {
                                        const on = (pad ?? padInfo.default) === p;
                                        return (
                                            <button key={p} type="button" disabled={loading}
                                                onClick={() => setPad(p === padInfo.default ? null : p)}
                                                aria-pressed={on}
                                                className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-colors ${
                                                    on ? 'bg-white text-slate-900' : 'text-white/75 hover:text-white'
                                                }`}>
                                                {p === 'bn' ? 'বাংলা প্যাড' : 'English pad'}
                                            </button>
                                        );
                                    })}
                                </div>
                            )}
                            <a
                                href={blobUrl ?? undefined}
                                target="_blank"
                                rel="noreferrer"
                                aria-disabled={!blobUrl}
                                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-white bg-white/10 hover:bg-white/20 transition-colors ${blobUrl ? '' : 'pointer-events-none opacity-50'}`}
                                title="Open in new tab"
                            >
                                <i className="fi fi-rr-arrow-up-right-from-square text-xs leading-none" />
                                Open
                            </a>
                            <a
                                href={blobUrl ?? undefined}
                                download={downloadName}
                                aria-disabled={!blobUrl}
                                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-white bg-white/10 hover:bg-white/20 transition-colors ${blobUrl ? '' : 'pointer-events-none opacity-50'}`}
                                title="Download"
                            >
                                <i className="fi fi-rr-download text-xs leading-none" />
                                Download
                            </a>
                            <button
                                onClick={onClose}
                                className="w-8 h-8 rounded-lg hover:bg-white/20 transition-colors flex items-center justify-center"
                                aria-label="Close"
                            >
                                <i className="fi fi-rr-cross text-sm leading-none" />
                            </button>
                        </div>
                    </div>

                    {padInfo && (
                        <div className="sm:hidden flex items-center justify-center gap-1 px-3 py-2 bg-slate-800 shrink-0">
                            {(['bn', 'en'] as const).map(p => {
                                const on = (pad ?? padInfo.default) === p;
                                return (
                                    <button key={p} type="button" disabled={loading}
                                        onClick={() => setPad(p === padInfo.default ? null : p)}
                                        className={`flex-1 px-3 py-1.5 rounded-lg text-xs font-bold ${on ? 'bg-white text-slate-900' : 'bg-white/10 text-white/80'}`}>
                                        {p === 'bn' ? 'বাংলা প্যাড' : 'English pad'}
                                    </button>
                                );
                            })}
                        </div>
                    )}

                    {/* PDF iframe */}
                    <div className="flex-1 bg-surface-100 relative">
                        {loading && (
                            <div className="absolute inset-0 flex items-center justify-center bg-surface-50">
                                <div className="flex items-center gap-2 text-sm text-surface-500">
                                    <i className="fi fi-rr-spinner animate-spin text-sm leading-none" />
                                    Loading PDF...
                                </div>
                            </div>
                        )}
                        {error && !loading && (
                            <div className="absolute inset-0 flex items-center justify-center bg-surface-50 p-4">
                                <div className="max-w-md text-center space-y-2">
                                    <div className="w-12 h-12 rounded-xl bg-red-50 flex items-center justify-center mx-auto">
                                        <i className="fi fi-rr-exclamation text-red-500 text-base leading-none" />
                                    </div>
                                    <p className="text-sm font-semibold text-surface-800">Failed to load PDF</p>
                                    <p className="text-xs text-surface-500">{error}</p>
                                    <a href={(effectiveUrl ?? pdfUrl).replace(/([?&])preview=base64(&|$)/, '$1')} target="_blank" rel="noreferrer" className="btn-outline btn-sm">
                                        <i className="fi fi-rr-arrow-up-right-from-square text-xs leading-none" />
                                        Open in new tab
                                    </a>
                                </div>
                            </div>
                        )}
                        {blobUrl && !error && (
                            <object
                                data={blobUrl}
                                type="application/pdf"
                                className="w-full h-full"
                                aria-label={title}
                            >
                                {/* Fallback when <object> can't render (e.g. missing native PDF viewer) */}
                                <div className="absolute inset-0 flex items-center justify-center bg-surface-50 p-4">
                                    <div className="max-w-md text-center space-y-2">
                                        <div className="w-12 h-12 rounded-xl bg-surface-100 flex items-center justify-center mx-auto">
                                            <i className="fi fi-rr-file-pdf text-surface-400 text-base leading-none" />
                                        </div>
                                        <p className="text-sm font-semibold text-surface-800">Your browser can't display this PDF inline.</p>
                                        <a href={blobUrl} target="_blank" rel="noreferrer" className="btn-outline btn-sm">
                                            <i className="fi fi-rr-arrow-up-right-from-square text-xs leading-none" />
                                            Open in new tab
                                        </a>
                                    </div>
                                </div>
                            </object>
                        )}
                    </div>
                </motion.div>
            </motion.div>
        </AnimatePresence>
    );
}
