import { useEffect, useRef, useState } from 'react';
import { Loader2, AlertTriangle, Maximize2, Sparkles, Download } from 'lucide-react';
import axios from 'axios';

/**
 * DxfPreview — renders a DXF file in a canvas using dxf-viewer + Three.js.
 *
 * Notes:
 * - DXF only (DWG is not supported without commercial libraries).
 * - Lazy-loads dxf-viewer so it doesn't bloat the main bundle.
 * - Handles resize, clean shutdown on unmount.
 */
interface Props {
    url: string;
    filename?: string;
    className?: string;
}

export default function DxfPreview({ url, filename = 'drawing.dxf', className = '' }: Props) {
    const containerRef = useRef<HTMLDivElement>(null);
    const viewerRef = useRef<any>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [progress, setProgress] = useState<string>('');

    useEffect(() => {
        let cancelled = false;

        async function init() {
            if (!containerRef.current) return;

            setLoading(true);
            setError(null);
            setProgress('Loading DXF viewer...');

            try {
                // Lazy-load the library + THREE so they're only fetched when needed
                const [{ DxfViewer }, THREE] = await Promise.all([
                    import('dxf-viewer'),
                    // @ts-ignore - no types shipped, used only for Color
                    import('three'),
                ]);

                if (cancelled || !containerRef.current) return;

                const options = {
                    clearColor: new THREE.Color(0xfafafa), // light background
                    clearAlpha: 1.0,
                    autoResize: false,
                    colorCorrection: true,
                    sceneOptions: {
                        wireframeMesh: false,
                    },
                };

                const viewer = new DxfViewer(containerRef.current, options);
                viewerRef.current = viewer;

                // Size the canvas to the container
                const rect = containerRef.current.getBoundingClientRect();
                viewer.SetSize(rect.width, rect.height);

                setProgress('Downloading file...');
                await viewer.Load({
                    url,
                    progressCbk: (phase: string) => {
                        if (!cancelled) {
                            if (phase === 'font') setProgress('Loading fonts...');
                            else if (phase === 'fetch') setProgress('Downloading file...');
                            else if (phase === 'parse') setProgress('Parsing drawing...');
                            else if (phase === 'prepare') setProgress('Preparing view...');
                        }
                    },
                });

                if (cancelled) return;
                setLoading(false);
            } catch (err: any) {
                if (cancelled) return;
                console.warn('DXF preview error:', err);
                setError(err?.message || 'Could not render this DXF file.');
                setLoading(false);
            }
        }

        init();

        // Resize observer
        const resizeObserver = new ResizeObserver((entries) => {
            if (!viewerRef.current || !containerRef.current) return;
            const { width, height } = entries[0].contentRect;
            try { viewerRef.current.SetSize(width, height); } catch {}
        });
        if (containerRef.current) resizeObserver.observe(containerRef.current);

        return () => {
            cancelled = true;
            resizeObserver.disconnect();
            if (viewerRef.current) {
                try { viewerRef.current.Destroy?.(); } catch {}
                viewerRef.current = null;
            }
        };
    }, [url]);

    const openFullscreen = () => {
        if (containerRef.current?.requestFullscreen) {
            containerRef.current.requestFullscreen();
        }
    };

    return (
        <div className={`relative bg-white rounded-lg overflow-hidden ${className}`}>
            <div
                ref={containerRef}
                className="w-full h-full min-h-[300px]"
                style={{ background: '#fafafa' }}
            />

            {/* Loading overlay */}
            {loading && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/90 backdrop-blur-sm">
                    <Loader2 className="w-10 h-10 text-brand-500 animate-spin mb-3" />
                    <div className="text-sm font-semibold text-surface-800">{progress || 'Loading...'}</div>
                    <div className="text-xs text-surface-400 mt-1">{filename}</div>
                </div>
            )}

            {/* Error overlay */}
            {error && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-white p-6 text-center">
                    <AlertTriangle className="w-12 h-12 text-amber-500 mb-3" />
                    <h4 className="font-bold text-surface-900 mb-1">Can't render this DXF</h4>
                    <p className="text-xs text-surface-500 max-w-md mb-3">{error}</p>
                    <p className="text-xs text-surface-400">
                        The file might use unsupported features. Try downloading to view in AutoCAD / DraftSight.
                    </p>
                </div>
            )}

            {/* Fullscreen button */}
            {!loading && !error && (
                <button
                    onClick={openFullscreen}
                    className="absolute top-2 right-2 p-1.5 rounded-lg bg-white/90 border border-surface-200 text-surface-600 hover:text-brand-600 hover:bg-white shadow-md transition-colors"
                    title="Fullscreen"
                >
                    <Maximize2 className="w-3.5 h-3.5" />
                </button>
            )}

            {/* DXF badge */}
            {!loading && !error && (
                <div className="absolute top-2 left-2 px-2 py-1 rounded-md bg-blue-500/10 border border-blue-500/30 text-blue-700 text-[10px] font-bold uppercase tracking-wider">
                    DXF Preview
                </div>
            )}
        </div>
    );
}

/**
 * DWG preview handler:
 * - If a server-side PDF preview exists → show it inline via iframe
 * - If no preview yet → offer "Generate Preview" button (uses LibreOffice on server)
 * - If LibreOffice unavailable → fall back to download guidance
 */
export function DwgUnsupportedCard({
    url, filename, fileId, previewUrl, previewStatus, previewError, onPreviewGenerated,
}: {
    url: string;
    filename: string;
    fileId?: number;
    previewUrl?: string | null;
    previewStatus?: string | null;
    previewError?: string | null;
    onPreviewGenerated?: (updatedFile: any) => void;
}) {
    const [generating, setGenerating] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [libreOfficeAvailable, setLibreOfficeAvailable] = useState<boolean | null>(null);

    // If preview is ready, show it as an iframe
    if (previewStatus === 'ready' && previewUrl) {
        return (
            <div className="relative w-full h-full bg-white rounded-lg overflow-hidden flex flex-col">
                <div className="flex items-center gap-2 px-3 py-2 border-b border-surface-100 bg-amber-50/50">
                    <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                    <span className="text-xs font-bold text-amber-700">DWG Preview (converted server-side)</span>
                    <a href={url} download={filename} className="ml-auto text-[10px] text-surface-500 hover:text-surface-900 flex items-center gap-1">
                        <Download className="w-3 h-3" /> Download original DWG
                    </a>
                </div>
                <iframe src={previewUrl} className="flex-1 w-full border-0" title={filename} />
            </div>
        );
    }

    const handleGenerate = async () => {
        if (!fileId) return;
        setGenerating(true);
        setError(null);
        try {
            const { data } = await axios.post(`/files/${fileId}/preview`);
            if (data.file?.preview_status === 'ready') {
                onPreviewGenerated?.(data.file);
            } else {
                setError(data.file?.preview_error || 'Preview generation failed.');
            }
        } catch (err: any) {
            setError(err.response?.data?.error || 'Preview generation failed.');
            if (err.response?.data?.libreoffice_available === false) {
                setLibreOfficeAvailable(false);
            }
        } finally {
            setGenerating(false);
        }
    };

    const hasFailed = previewStatus === 'failed';
    const libreOfficeMissing = libreOfficeAvailable === false ||
        (hasFailed && previewError?.toLowerCase().includes('libreoffice'));

    return (
        <div className="flex flex-col items-center justify-center text-center p-8 bg-gradient-to-br from-amber-50 to-orange-50 rounded-lg border border-amber-200">
            <div className="w-16 h-16 rounded-2xl bg-amber-100 flex items-center justify-center mb-4">
                {generating ? <Loader2 className="w-8 h-8 text-amber-600 animate-spin" /> : <AlertTriangle className="w-8 h-8 text-amber-600" />}
            </div>

            {generating ? (
                <>
                    <h4 className="font-bold text-surface-900 mb-1">Converting DWG...</h4>
                    <p className="text-sm text-surface-600 max-w-md mb-2">
                        Running LibreOffice to generate a PDF preview. This can take up to a minute for large drawings.
                    </p>
                </>
            ) : libreOfficeMissing ? (
                <>
                    <h4 className="font-bold text-surface-900 mb-2">DWG Preview Not Available</h4>
                    <p className="text-sm text-surface-600 max-w-md mb-4">
                        Server doesn't have LibreOffice installed. To enable automatic DWG previews:
                    </p>
                    <div className="space-y-1.5 text-xs text-left mb-4 bg-white/60 rounded-lg p-3 border border-amber-100 max-w-md">
                        <div className="font-bold text-amber-700 mb-1">Server setup (one-time):</div>
                        <div className="flex items-start gap-2"><span className="text-amber-600">▸</span><span><strong>Windows:</strong> install from <a href="https://libreoffice.org" target="_blank" className="underline">libreoffice.org</a></span></div>
                        <div className="flex items-start gap-2"><span className="text-amber-600">▸</span><span><strong>Linux:</strong> <code className="bg-amber-100 px-1 rounded">sudo apt install libreoffice</code></span></div>
                        <div className="flex items-start gap-2"><span className="text-amber-600">▸</span><span><strong>macOS:</strong> <code className="bg-amber-100 px-1 rounded">brew install --cask libreoffice</code></span></div>
                    </div>
                    <div className="space-y-2 text-xs text-left mb-4 bg-white/60 rounded-lg p-3 border border-amber-100 max-w-md">
                        <div className="font-bold text-amber-700 mb-1">Or, in the meantime:</div>
                        <div className="flex items-start gap-2"><span className="text-amber-600">▸</span><span>Download and open in AutoCAD / DraftSight / FreeCAD</span></div>
                        <div className="flex items-start gap-2"><span className="text-amber-600">▸</span><span>Re-save as <strong>DXF</strong> from your CAD software</span></div>
                    </div>
                    <a href={url} target="_blank" rel="noreferrer" download={filename} className="btn-primary btn-sm">
                        <Download className="w-4 h-4" /> Download DWG File
                    </a>
                </>
            ) : (
                <>
                    <h4 className="font-bold text-surface-900 mb-2">Preview Not Yet Generated</h4>
                    <p className="text-sm text-surface-600 max-w-md mb-4">
                        DWG files need server-side conversion to preview. Click below to generate a PDF preview of this drawing.
                    </p>
                    {error && (
                        <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2 mb-3 max-w-md">
                            ⚠️ {error}
                        </div>
                    )}
                    <div className="flex items-center gap-2">
                        {fileId ? (
                            <button onClick={handleGenerate} disabled={generating} className="btn-primary btn-sm">
                                <Sparkles className="w-4 h-4" /> Generate Preview
                            </button>
                        ) : null}
                        <a href={url} target="_blank" rel="noreferrer" download={filename} className="btn-outline btn-sm">
                            <Download className="w-4 h-4" /> Download
                        </a>
                    </div>
                </>
            )}
        </div>
    );
}
