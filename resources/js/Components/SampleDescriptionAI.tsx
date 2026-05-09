import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import axios from 'axios';
import { useAiEnabled } from '@/lib/useAiEnabled';

/**
 * One sample photo attachment — can be either an already-uploaded file
 * (user picked from their device) or a reference to a gallery image (already on server).
 */
export type SamplePhotoAttachment =
    | { kind: 'upload'; file: File; previewUrl?: string }
    | { kind: 'gallery'; url: string; filename?: string };

interface Props {
    samplePhotos?: SamplePhotoAttachment[];
    drawings?: SamplePhotoAttachment[];
    jobDescription?: string;
    currentText: string;
    onApplyText: (text: string) => void;
    /**
     * 'item_description' — drafts the main item description (considers drawing + sample).
     * 'sample_description' — drafts the sample-condition field only (samples only).
     */
    purpose?: 'item_description' | 'sample_description';
    labelSuggest?: string;
}

interface Suggestion { label: string; text: string }

// Gemini Vision only accepts images (JPG/PNG/WEBP/GIF) and PDFs.
// CAD formats (DXF/DWG/STEP/etc.) can't be analysed — skip them.
const SUPPORTED_RE = /\.(jpe?g|png|gif|webp|pdf)$/i;
const isSupportedStatic = (att: SamplePhotoAttachment): boolean => {
    if (att.kind === 'upload') {
        return SUPPORTED_RE.test(att.file.name) || att.file.type.startsWith('image/') || att.file.type === 'application/pdf';
    }
    return !!att.url && (SUPPORTED_RE.test(att.url) || SUPPORTED_RE.test(att.filename ?? ''));
};

/**
 * AI assist panel that analyses an uploaded sample photo and drafts/polishes
 * the physical-sample description on an RFQ item. Uses /ai-assist/sample-description.
 */
export default function SampleDescriptionAI({
    samplePhotos = [], drawings = [], jobDescription, currentText, onApplyText,
    purpose = 'item_description', labelSuggest,
}: Props) {
    const aiEnabled = useAiEnabled();
    const [loading, setLoading] = useState<'suggest' | 'polish' | null>(null);
    const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
    const [polished, setPolished] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    const supportedDrawings     = drawings.filter(isSupportedStatic);
    const supportedSamplePhotos = samplePhotos.filter(isSupportedStatic);
    const totalImages            = supportedDrawings.length + supportedSamplePhotos.length;
    const hasAny                 = totalImages > 0;

    const appendAttachments = (fd: FormData, field: 'drawings' | 'sample_photos', urlField: 'drawing_urls' | 'sample_photo_urls', list: SamplePhotoAttachment[]) => {
        list.filter(isSupportedStatic).forEach((att) => {
            if (att.kind === 'upload') {
                fd.append(`${field}[]`, att.file);
            } else if (att.url) {
                fd.append(`${urlField}[]`, att.url);
            }
        });
    };

    const skippedFiles = [...drawings, ...samplePhotos]
        .filter((a) => !isSupportedStatic(a))
        .map((a) => a.kind === 'upload' ? a.file.name : (a.filename ?? 'file'));

    const buildFormData = (mode: 'suggest' | 'polish'): FormData | null => {
        if (!hasAny) return null;
        const fd = new FormData();
        fd.append('mode', mode);
        fd.append('purpose', purpose);
        if (jobDescription) fd.append('job_description', jobDescription);
        if (currentText)    fd.append('existing_text', currentText);

        // For sample_description, only send sample photos.
        // For item_description, send both drawings and samples.
        if (purpose === 'sample_description') {
            appendAttachments(fd, 'sample_photos', 'sample_photo_urls', samplePhotos);
        } else {
            appendAttachments(fd, 'drawings',      'drawing_urls',       drawings);
            appendAttachments(fd, 'sample_photos', 'sample_photo_urls',  samplePhotos);
        }
        return fd;
    };

    const totalAttached = drawings.length + samplePhotos.length;
    const noImageMsg = purpose === 'sample_description'
        ? 'Upload a sample photo first (JPG/PNG).'
        : (totalAttached > 0
            ? 'No AI-readable files. Upload a JPG/PNG/PDF — CAD formats (DXF/DWG) can\'t be analysed.'
            : 'Attach a JPG/PNG/PDF drawing or sample photo first.');

    const runSuggest = async () => {
        if (!hasAny) { setError(noImageMsg); return; }
        setLoading('suggest');
        setError(null);
        setPolished(null);
        try {
            const fd = buildFormData('suggest');
            if (!fd) { setError('No usable image found.'); return; }
            const { data } = await axios.post('/ai-assist/sample-description', fd);
            if (Array.isArray(data?.suggestions)) setSuggestions(data.suggestions);
            else setError('No suggestions returned.');
        } catch (err: any) {
            setError(err.response?.data?.error || 'AI request failed.');
        } finally {
            setLoading(null);
        }
    };

    const runPolish = async () => {
        if (!hasAny) { setError(noImageMsg); return; }
        if (!currentText.trim()) {
            setError('Write some text first, then I can polish it.');
            return;
        }
        setLoading('polish');
        setError(null);
        setSuggestions([]);
        try {
            const fd = buildFormData('polish');
            if (!fd) { setError('No usable image found.'); return; }
            const { data } = await axios.post('/ai-assist/sample-description', fd);
            if (data?.polished) setPolished(data.polished);
            else setError('Could not polish the text.');
        } catch (err: any) {
            setError(err.response?.data?.error || 'AI request failed.');
        } finally {
            setLoading(null);
        }
    };

    if (!aiEnabled) return null;

    return (
        <div className="space-y-1.5">
            <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-[10px] font-bold text-indigo-600 uppercase tracking-wider mr-1">
                    ✨ Oli
                </span>
                <button
                    type="button"
                    onClick={runSuggest}
                    disabled={loading !== null || !hasAny}
                    title={hasAny ? 'Ask Oli to describe the attached images' : noImageMsg}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold bg-gradient-to-r from-indigo-500 to-purple-500 text-white hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
                >
                    {loading === 'suggest' ? (
                        <><i className="fi fi-rr-spinner animate-spin text-[9px] leading-none" />Analysing {supportedDrawings.length > 0 && supportedSamplePhotos.length > 0 ? 'images' : supportedDrawings.length > 0 ? 'drawing' : 'photo'}...</>
                    ) : (
                        <>
                            ✨ {labelSuggest ?? (
                                supportedDrawings.length > 0 && supportedSamplePhotos.length > 0 ? 'Describe from drawing + sample'
                              : supportedDrawings.length > 0 ? 'Describe from drawing'
                              : 'Describe from sample photo'
                            )}
                        </>
                    )}
                </button>
                <button
                    type="button"
                    onClick={runPolish}
                    disabled={loading !== null || !hasAny || !currentText.trim()}
                    title={!hasAny ? noImageMsg : !currentText.trim() ? 'Write something first' : 'Polish your description using the attached images'}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold bg-white border border-indigo-200 text-indigo-700 hover:bg-indigo-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                    {loading === 'polish' ? (
                        <><i className="fi fi-rr-spinner animate-spin text-[9px] leading-none" />Polishing...</>
                    ) : (
                        <>💎 Polish</>
                    )}
                </button>
            </div>

            <AnimatePresence>
                {error && (
                    <motion.div
                        className="px-2 py-1 rounded-md bg-red-50 border border-red-200 text-[11px] text-red-700"
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                    >
                        ⚠️ {error}
                    </motion.div>
                )}
            </AnimatePresence>

            {skippedFiles.length > 0 && (
                <div className="px-2 py-1 rounded-md bg-amber-50 border border-amber-200 text-[10px] text-amber-800">
                    ℹ️ Skipped {skippedFiles.length === 1 ? 'file' : `${skippedFiles.length} files`} ({skippedFiles.slice(0, 2).join(', ')}{skippedFiles.length > 2 ? '…' : ''}) — CAD / non-image formats can't be AI-analysed.
                </div>
            )}

            <AnimatePresence>
                {suggestions.length > 0 && (
                    <motion.div
                        className="space-y-1.5"
                        initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                    >
                        <div className="flex items-center justify-between">
                            <div className="text-[10px] font-bold text-surface-500 uppercase tracking-wider flex items-center gap-1">
                                ✨ <span>Oli's Suggestions (from photo)</span>
                            </div>
                            <button type="button" onClick={() => setSuggestions([])} className="text-[10px] text-surface-400 hover:text-surface-700">
                                Dismiss
                            </button>
                        </div>
                        {suggestions.map((s, i) => (
                            <button
                                key={i}
                                type="button"
                                onClick={() => { onApplyText(s.text); setSuggestions([]); }}
                                className="group w-full text-left p-2 rounded-lg border-2 bg-amber-50 border-amber-200 text-amber-900 hover:bg-amber-100 transition-all"
                            >
                                <div className="flex items-start gap-2">
                                    <span className="shrink-0 inline-flex items-center justify-center w-5 h-5 rounded bg-white/90 text-[10px] font-bold mt-0.5">
                                        {i + 1}
                                    </span>
                                    <div className="flex-1 min-w-0">
                                        <div className="text-[9px] font-bold uppercase tracking-wider text-amber-600 mb-0.5">
                                            {s.label}
                                        </div>
                                        <div className="text-xs leading-relaxed">{s.text}</div>
                                    </div>
                                    <span className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity text-[10px] font-bold">Use →</span>
                                </div>
                            </button>
                        ))}
                    </motion.div>
                )}
            </AnimatePresence>

            <AnimatePresence>
                {polished && (
                    <motion.div
                        className="rounded-lg border-2 border-indigo-200 bg-gradient-to-br from-indigo-50 to-purple-50 p-2"
                        initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                    >
                        <div className="flex items-center justify-between mb-1">
                            <div className="text-[10px] font-bold text-indigo-700 uppercase tracking-wider flex items-center gap-1">
                                💎 <span>Polished version</span>
                            </div>
                            <button type="button" onClick={() => setPolished(null)} className="text-[10px] text-surface-400 hover:text-surface-700">
                                Dismiss
                            </button>
                        </div>
                        <div className="text-xs text-surface-800 mb-1.5 leading-relaxed whitespace-pre-wrap">{polished}</div>
                        <button
                            type="button"
                            onClick={() => { onApplyText(polished); setPolished(null); }}
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-indigo-600 text-white hover:bg-indigo-700 transition-colors"
                        >
                            ✓ Replace my text
                        </button>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
