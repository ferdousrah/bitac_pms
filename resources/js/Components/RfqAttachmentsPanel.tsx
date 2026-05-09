import { useState } from 'react';
import FilePreviewModal, { PreviewableFile } from '@/Components/FilePicker/FilePreviewModal';

interface DrawingFile {
    id: number;
    url: string;
    filename: string;
    extension?: string;
}

interface SamplePhoto {
    id: number;
    url: string;
    filename: string;
}

interface AttachmentItem {
    item_id: number;
    job_description?: string | null;
    reference_type?: string | null;
    sample_received?: boolean;
    sample_description?: string | null;
    drawings: DrawingFile[];
    sample_photos: SamplePhoto[];
}

interface Props {
    attachments: AttachmentItem[];
    title?: string;
    inheritedFrom?: 'rfq' | 'estimate';
}

/**
 * Displays drawings + sample photos that were uploaded against RFQ items.
 * Read-only — these flow through to every downstream step (cost estimate,
 * quotation, work order) so reviewers can always see the source reference.
 */
export default function RfqAttachmentsPanel({ attachments, title = 'RFQ Attachments', inheritedFrom = 'rfq' }: Props) {
    const [lightboxFiles, setLightboxFiles] = useState<PreviewableFile[]>([]);
    const [lightboxIndex, setLightboxIndex] = useState(0);
    const [lightboxOpen, setLightboxOpen] = useState(false);

    if (!attachments || attachments.length === 0) return null;

    const totalDrawings = attachments.reduce((s, a) => s + a.drawings.length, 0);
    const totalPhotos   = attachments.reduce((s, a) => s + a.sample_photos.length, 0);
    if (totalDrawings === 0 && totalPhotos === 0 && !attachments.some(a => a.sample_description)) {
        return null;
    }

    const openLightbox = (files: (DrawingFile | SamplePhoto)[], index: number) => {
        const previewable: PreviewableFile[] = files.map((f: any) => ({
            id: f.id,
            url: f.url,
            filename: f.filename,
            extension: f.extension ?? f.filename?.split('.').pop()?.toLowerCase(),
        }));
        setLightboxFiles(previewable);
        setLightboxIndex(index);
        setLightboxOpen(true);
    };

    return (
        <>
            <div className="card animate-fade-in">
                <div className="px-5 py-3 border-b border-surface-100 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <i className="fi fi-rr-paperclip text-surface-400 text-xs leading-none" />
                        <h3 className="text-xs font-bold text-surface-900 uppercase tracking-wider">{title}</h3>
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-indigo-50 border border-indigo-100 text-[10px] font-bold text-indigo-700">
                            {totalDrawings + totalPhotos} file{(totalDrawings + totalPhotos) === 1 ? '' : 's'}
                        </span>
                    </div>
                    <span className="text-[10px] text-surface-400 italic">
                        Inherited from {inheritedFrom === 'rfq' ? 'RFQ' : 'source estimate'}
                    </span>
                </div>

                <div className="divide-y divide-surface-100">
                    {attachments.map((item) => {
                        const hasAny = item.drawings.length > 0 || item.sample_photos.length > 0 || item.sample_description;
                        if (!hasAny) return null;
                        return (
                            <div key={item.item_id} className="px-5 py-4 space-y-3">
                                {/* Item context header */}
                                {item.job_description && attachments.length > 1 && (
                                    <div className="text-[11px] uppercase tracking-wider font-bold text-surface-500 flex items-center gap-1.5">
                                        <i className="fi fi-rr-box text-[10px] leading-none" />
                                        {item.job_description}
                                    </div>
                                )}

                                {/* Drawings */}
                                {item.drawings.length > 0 && (
                                    <div className="space-y-1.5">
                                        {item.drawings.map((d, idx) => {
                                            const isImage = /\.(jpg|jpeg|png|gif|webp)$/i.test(d.filename);
                                            const ext = (d.extension || d.filename?.split('.').pop() || '').toUpperCase();
                                            return (
                                                <div key={d.id} className="flex items-center gap-3 p-2 bg-blue-50/60 rounded-lg border border-blue-100">
                                                    {isImage ? (
                                                        <button
                                                            onClick={() => openLightbox(item.drawings, idx)}
                                                            className="w-10 h-10 rounded overflow-hidden shrink-0 hover:ring-2 hover:ring-brand-400 transition-all"
                                                        >
                                                            <img src={d.url} alt="" className="w-full h-full object-cover" />
                                                        </button>
                                                    ) : (
                                                        <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center text-blue-600 text-[9px] font-bold shrink-0">
                                                            {ext}
                                                        </div>
                                                    )}
                                                    <div className="flex-1 min-w-0">
                                                        <div className="text-xs font-semibold text-surface-900 truncate">{d.filename}</div>
                                                        <div className="text-[10px] text-surface-400">Technical drawing</div>
                                                    </div>
                                                    <button
                                                        onClick={() => openLightbox(item.drawings, idx)}
                                                        className="btn-primary btn-xs shrink-0"
                                                    >
                                                        <i className="fi fi-rr-eye text-xs leading-none" /> View
                                                    </button>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}

                                {/* Sample section */}
                                {(item.sample_description || item.sample_photos.length > 0) && (
                                    <div className="p-2.5 bg-amber-50/60 rounded-lg border border-amber-100 space-y-2">
                                        {item.sample_description && (
                                            <p className="text-xs text-surface-700">
                                                <span className="font-bold text-amber-900">Sample:</span>{' '}
                                                {item.sample_description}
                                                {item.sample_received ? (
                                                    <span className="ml-2 inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-green-100 text-green-700 text-[9px] font-bold">✓ Received</span>
                                                ) : (
                                                    <span className="ml-2 inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 text-[9px] font-bold">⏳ Pending</span>
                                                )}
                                            </p>
                                        )}
                                        {item.sample_photos.length > 0 && (
                                            <div className="flex flex-wrap gap-1.5">
                                                {item.sample_photos.map((p, idx) => (
                                                    <button
                                                        key={p.id}
                                                        onClick={() => openLightbox(item.sample_photos, idx)}
                                                        className="block"
                                                    >
                                                        <img
                                                            src={p.url}
                                                            alt={p.filename}
                                                            title={p.filename}
                                                            className="w-16 h-16 rounded-lg object-cover border border-amber-200 hover:border-amber-400 transition-colors cursor-zoom-in"
                                                        />
                                                    </button>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>

            <FilePreviewModal
                open={lightboxOpen}
                files={lightboxFiles}
                initialIndex={lightboxIndex}
                onClose={() => setLightboxOpen(false)}
            />
        </>
    );
}
