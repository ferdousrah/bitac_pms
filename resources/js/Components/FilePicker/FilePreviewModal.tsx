import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, ChevronLeft, ChevronRight, Download, FileText, Eye } from 'lucide-react';
import DxfPreview, { DwgUnsupportedCard } from './DxfPreview';

export interface PreviewableFile {
    id?: number;
    url: string;
    filename: string;              // original_name
    mime_type?: string;
    extension?: string;
    size_bytes?: number;
    human_size?: string;
    category?: string;
    preview_url?: string | null;   // server-side generated preview (for DWG)
    preview_status?: string | null;
    preview_error?: string | null;
}

interface Props {
    open: boolean;
    files: PreviewableFile[];
    initialIndex?: number;
    onClose: () => void;
    onUpdate?: (index: number, updated: Partial<PreviewableFile>) => void;
}

/**
 * FilePreviewModal — full-screen lightbox for previewing files with keyboard navigation.
 * Supports images, PDFs, DXF (client-side rendered), DWG (server-side PDF preview).
 */
export default function FilePreviewModal({ open, files, initialIndex = 0, onClose, onUpdate }: Props) {
    const [index, setIndex] = useState(initialIndex);

    useEffect(() => {
        if (open) setIndex(initialIndex);
    }, [open, initialIndex]);

    const current = files[index];
    const hasMultiple = files.length > 1;

    const next = () => setIndex(i => (i + 1) % files.length);
    const prev = () => setIndex(i => (i - 1 + files.length) % files.length);

    // Keyboard shortcuts
    useEffect(() => {
        if (!open) return;
        const handler = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
            else if (e.key === 'ArrowRight' && hasMultiple) next();
            else if (e.key === 'ArrowLeft' && hasMultiple) prev();
        };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, [open, hasMultiple]);

    if (!open || !current) return null;

    // Determine how to render the preview
    const ext = (current.extension || current.filename?.split('.').pop() || '').toLowerCase();
    const isImage = current.mime_type?.startsWith('image/') || /^(jpg|jpeg|png|gif|webp|svg)$/.test(ext);
    const isPdf = current.mime_type === 'application/pdf' || ext === 'pdf';
    const isDxf = ext === 'dxf';
    const isDwg = ext === 'dwg';

    return (
        <AnimatePresence>
            <motion.div
                className="fixed inset-0 z-[300] bg-black/90 flex items-center justify-center p-4"
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                onClick={onClose}
            >
                {/* Top bar */}
                <div
                    className="absolute top-0 left-0 right-0 flex items-center justify-between px-4 py-3 bg-gradient-to-b from-black/70 to-transparent z-10"
                    onClick={e => e.stopPropagation()}
                >
                    <div className="min-w-0 flex-1">
                        <div className="text-white font-bold truncate">{current.filename}</div>
                        <div className="text-white/60 text-xs flex items-center gap-2">
                            {hasMultiple && <span>{index + 1} of {files.length}</span>}
                            {current.human_size && <span>· {current.human_size}</span>}
                            {current.category && <span>· {current.category.replace('_', ' ')}</span>}
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <a
                            href={current.url}
                            target="_blank"
                            rel="noreferrer"
                            download={current.filename}
                            className="p-2 rounded-lg bg-white/10 text-white hover:bg-white/20 transition-colors"
                            title="Download"
                        >
                            <Download className="w-5 h-5" />
                        </a>
                        <button
                            onClick={onClose}
                            className="p-2 rounded-lg bg-white/10 text-white hover:bg-red-500 transition-colors"
                            title="Close (Esc)"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                {/* Prev/Next arrows */}
                {hasMultiple && (
                    <>
                        <button
                            onClick={e => { e.stopPropagation(); prev(); }}
                            className="absolute left-4 top-1/2 -translate-y-1/2 z-10 w-12 h-12 rounded-full bg-white/10 text-white hover:bg-white/20 flex items-center justify-center transition-all hover:scale-110"
                            title="Previous (←)"
                        >
                            <ChevronLeft className="w-7 h-7" />
                        </button>
                        <button
                            onClick={e => { e.stopPropagation(); next(); }}
                            className="absolute right-4 top-1/2 -translate-y-1/2 z-10 w-12 h-12 rounded-full bg-white/10 text-white hover:bg-white/20 flex items-center justify-center transition-all hover:scale-110"
                            title="Next (→)"
                        >
                            <ChevronRight className="w-7 h-7" />
                        </button>
                    </>
                )}

                {/* Content */}
                <motion.div
                    key={index}
                    className="relative max-w-6xl w-full max-h-[90vh] flex items-center justify-center"
                    initial={{ opacity: 0, scale: 0.97 }}
                    animate={{ opacity: 1, scale: 1 }}
                    onClick={e => e.stopPropagation()}
                >
                    {isImage ? (
                        <img src={current.url} alt={current.filename} className="max-w-full max-h-[85vh] object-contain rounded-lg" />
                    ) : isDxf ? (
                        <div className="bg-white rounded-2xl w-full h-[85vh] overflow-hidden">
                            <DxfPreview url={current.url} filename={current.filename} className="w-full h-full" />
                        </div>
                    ) : isDwg ? (
                        <div className="bg-white rounded-2xl w-full h-[85vh] overflow-hidden">
                            <DwgUnsupportedCard
                                url={current.url}
                                filename={current.filename}
                                fileId={current.id}
                                previewUrl={current.preview_url}
                                previewStatus={current.preview_status}
                                previewError={current.preview_error}
                                onPreviewGenerated={(updated) => onUpdate?.(index, updated)}
                            />
                        </div>
                    ) : isPdf ? (
                        <iframe
                            src={current.url}
                            className="w-full h-[85vh] rounded-2xl bg-white border-0"
                            title={current.filename}
                        />
                    ) : (
                        <div className="bg-white rounded-2xl p-12 text-center">
                            <FileText className="w-20 h-20 text-surface-300 mx-auto mb-4" />
                            <h4 className="font-bold text-surface-900 mb-2">Preview not available</h4>
                            <p className="text-sm text-surface-500 mb-4">This file type can't be previewed inline.</p>
                            <a href={current.url} target="_blank" rel="noreferrer" className="btn-primary">
                                <Eye className="w-4 h-4" /> Open in new tab
                            </a>
                        </div>
                    )}
                </motion.div>

                {/* Bottom thumbnails strip (when multiple) */}
                {hasMultiple && (
                    <div
                        className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-1.5 bg-black/60 backdrop-blur-sm rounded-xl px-3 py-2 border border-white/10 z-10 max-w-[90vw] overflow-x-auto"
                        onClick={e => e.stopPropagation()}
                    >
                        {files.map((f, i) => {
                            const active = i === index;
                            const thumbIsImage = f.mime_type?.startsWith('image/') || /\.(jpg|jpeg|png|gif|webp)$/i.test(f.filename);
                            return (
                                <button
                                    key={i}
                                    onClick={() => setIndex(i)}
                                    className={`shrink-0 w-12 h-12 rounded-lg overflow-hidden border-2 transition-all ${
                                        active ? 'border-brand-400 scale-110 shadow-lg' : 'border-transparent hover:border-white/30'
                                    }`}
                                    title={f.filename}
                                >
                                    {thumbIsImage ? (
                                        <img src={f.url} alt="" className="w-full h-full object-cover" />
                                    ) : (
                                        <div className="w-full h-full bg-slate-700 flex flex-col items-center justify-center">
                                            <FileText className="w-4 h-4 text-white/60" />
                                            <span className="text-[8px] font-bold text-white/60 mt-0.5 uppercase">
                                                {(f.extension || f.filename?.split('.').pop() || '').slice(0, 4)}
                                            </span>
                                        </div>
                                    )}
                                </button>
                            );
                        })}
                    </div>
                )}
            </motion.div>
        </AnimatePresence>
    );
}
