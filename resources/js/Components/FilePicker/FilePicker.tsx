import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
    X, Upload, Search, Image as ImageIcon, FileText, File,
    Loader2, Check, Trash2, Eye, Folder, Grid3x3, Home, ChevronRight,
} from 'lucide-react';
import axios from 'axios';
import DxfPreview, { DwgUnsupportedCard } from './DxfPreview';

/* ═══════════════════════════════════════════════════════════════════
   Types
   ═══════════════════════════════════════════════════════════════════ */
export interface UserFileItem {
    id: number;
    original_name: string;
    stored_path: string;
    mime_type: string;
    extension: string;
    size_bytes: number;
    category: string;
    description: string | null;
    url: string;
    human_size: string;
    created_at: string;
    preview_url?: string | null;
    preview_status?: string | null;
    preview_error?: string | null;
}

export type FileCategory = 'drawing' | 'sample_photo' | 'image' | 'document' | 'other' | 'all';

interface FolderItem {
    id: number;
    parent_folder_id: number | null;
    name: string;
    color: string;
}

interface BreadcrumbItem {
    id: number;
    name: string;
    color: string;
}

const FOLDER_COLORS: Record<string, { bg: string; icon: string }> = {
    indigo:  { bg: 'bg-indigo-100',  icon: 'text-indigo-600' },
    blue:    { bg: 'bg-blue-100',    icon: 'text-blue-600' },
    emerald: { bg: 'bg-emerald-100', icon: 'text-emerald-600' },
    amber:   { bg: 'bg-amber-100',   icon: 'text-amber-600' },
    rose:    { bg: 'bg-rose-100',    icon: 'text-rose-600' },
    slate:   { bg: 'bg-slate-100',   icon: 'text-slate-600' },
    purple:  { bg: 'bg-purple-100',  icon: 'text-purple-600' },
    orange:  { bg: 'bg-orange-100',  icon: 'text-orange-600' },
};

interface Props {
    open: boolean;
    onClose: () => void;
    onSelect: (file: UserFileItem) => void;
    /** Preselected category filter (e.g. 'drawing' for RFQ drawing picker) */
    defaultCategory?: FileCategory;
    /** Accept attribute for the upload input */
    accept?: string;
    /** Title shown in the modal header */
    title?: string;
    /** Only allow uploading of files matching this category (for the default upload category) */
    uploadCategory?: FileCategory;
}

const CATEGORY_TABS: { value: FileCategory; label: string; icon: any }[] = [
    { value: 'all',          label: 'All',      icon: Grid3x3 },
    { value: 'drawing',      label: 'Drawings', icon: FileText },
    { value: 'sample_photo', label: 'Samples',  icon: ImageIcon },
    { value: 'image',        label: 'Images',   icon: ImageIcon },
    { value: 'document',     label: 'Docs',     icon: FileText },
];

const CATEGORY_COLORS: Record<string, { bg: string; text: string; icon: string }> = {
    drawing:      { bg: 'bg-blue-50',    text: 'text-blue-700',    icon: 'text-blue-500' },
    sample_photo: { bg: 'bg-amber-50',   text: 'text-amber-700',   icon: 'text-amber-500' },
    image:        { bg: 'bg-emerald-50', text: 'text-emerald-700', icon: 'text-emerald-500' },
    document:     { bg: 'bg-red-50',     text: 'text-red-700',     icon: 'text-red-500' },
    other:        { bg: 'bg-slate-50',   text: 'text-slate-700',   icon: 'text-slate-500' },
};

/* ═══════════════════════════════════════════════════════════════════
   FilePicker Modal
   ═══════════════════════════════════════════════════════════════════ */
export default function FilePicker({
    open, onClose, onSelect,
    defaultCategory = 'all',
    accept = 'image/*,application/pdf,.dwg,.dxf',
    title = 'Pick a file',
    uploadCategory,
}: Props) {
    const [mode, setMode] = useState<'browse' | 'upload'>('browse');
    const [files, setFiles] = useState<UserFileItem[]>([]);
    const [subfolders, setSubfolders] = useState<FolderItem[]>([]);
    const [breadcrumb, setBreadcrumb] = useState<BreadcrumbItem[]>([]);
    const [currentFolderId, setCurrentFolderId] = useState<number | null>(null);
    const [loading, setLoading] = useState(false);
    const [category, setCategory] = useState<FileCategory>(defaultCategory);
    const [search, setSearch] = useState('');
    const [uploading, setUploading] = useState(false);
    const [uploadError, setUploadError] = useState<string | null>(null);
    const [preview, setPreview] = useState<UserFileItem | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const searchDebounceRef = useRef<ReturnType<typeof setTimeout>>();

    /* ── Load files + folders ───────────────────────────────── */
    const loadFiles = useCallback(async () => {
        setLoading(true);
        try {
            const { data } = await axios.get('/files/browse', {
                params: { category, search, folder: currentFolderId ?? '' },
            });
            setFiles(data.files || []);
            setSubfolders(data.subfolders || []);
            setBreadcrumb(data.breadcrumb || []);
        } catch {
            setFiles([]);
            setSubfolders([]);
        } finally {
            setLoading(false);
        }
    }, [category, search, currentFolderId]);

    useEffect(() => {
        if (!open) return;
        if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
        searchDebounceRef.current = setTimeout(loadFiles, 250);
        return () => { if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current); };
    }, [open, category, search, currentFolderId, loadFiles]);

    const navigateToFolder = (folderId: number | null) => {
        setCurrentFolderId(folderId);
        // clear filters when navigating into a folder
        setSearch('');
        setCategory(defaultCategory);
    };

    /* ── Upload new file ─────────────────────────────────────── */
    const handleUpload = async (file: File) => {
        if (!file) return;
        setUploading(true);
        setUploadError(null);
        try {
            const form = new FormData();
            form.append('file', file);
            if (uploadCategory && uploadCategory !== 'all') form.append('category', uploadCategory);
            else if (category !== 'all') form.append('category', category);
            // Upload into current folder (if browsing inside one)
            if (currentFolderId) form.append('folder_id', String(currentFolderId));

            const { data } = await axios.post('/files', form, {
                headers: { 'Content-Type': 'multipart/form-data' },
            });
            if (data.file) {
                // Auto-select the newly uploaded file
                onSelect(data.file);
                onClose();
            }
        } catch (err: any) {
            setUploadError(err.response?.data?.message || 'Upload failed');
        } finally {
            setUploading(false);
        }
    };

    /* ── Delete file ─────────────────────────────────────────── */
    const handleDelete = async (e: React.MouseEvent, fileId: number) => {
        e.stopPropagation();
        if (!confirm('Delete this file permanently? Items currently using it will keep working until re-edited.')) return;
        try {
            await axios.delete(`/files/${fileId}`);
            setFiles(prev => prev.filter(f => f.id !== fileId));
        } catch {}
    };

    /* ── Reset when modal opens ──────────────────────────────── */
    useEffect(() => {
        if (open) {
            setMode('browse');
            setCategory(defaultCategory);
            setSearch('');
            setPreview(null);
            setUploadError(null);
            setCurrentFolderId(null);
            setBreadcrumb([]);
        }
    }, [open, defaultCategory]);

    if (!open) return null;

    return (
        <AnimatePresence>
            <motion.div
                className="fixed inset-0 z-[300] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                onClick={onClose}
            >
                <motion.div
                    className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl h-[85vh] flex flex-col overflow-hidden"
                    initial={{ scale: 0.95, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 20 }}
                    onClick={e => e.stopPropagation()}
                >
                    {/* Header */}
                    <div className="flex items-center justify-between px-5 py-3.5 border-b border-surface-100 bg-gradient-to-r from-brand-50 to-white">
                        <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-xl bg-brand-500 flex items-center justify-center text-white shadow-sm">
                                <Folder className="w-4 h-4" />
                            </div>
                            <div>
                                <h3 className="font-bold text-surface-900">{title}</h3>
                                <p className="text-xs text-surface-500">Pick from your uploads or add a new file</p>
                            </div>
                        </div>
                        <button onClick={onClose} className="p-2 rounded-lg text-surface-400 hover:text-surface-700 hover:bg-surface-100 transition-colors">
                            <X className="w-5 h-5" />
                        </button>
                    </div>

                    {/* Mode Tabs */}
                    <div className="flex items-center gap-1 px-5 pt-3 border-b border-surface-100">
                        <button
                            onClick={() => setMode('browse')}
                            className={`flex items-center gap-2 px-4 py-2 rounded-t-lg text-sm font-semibold transition-colors ${
                                mode === 'browse'
                                    ? 'bg-white text-brand-600 border-t-2 border-brand-500'
                                    : 'text-surface-500 hover:text-surface-800'
                            }`}
                        >
                            <Grid3x3 className="w-4 h-4" />
                            Gallery ({files.length})
                        </button>
                        <button
                            onClick={() => setMode('upload')}
                            className={`flex items-center gap-2 px-4 py-2 rounded-t-lg text-sm font-semibold transition-colors ${
                                mode === 'upload'
                                    ? 'bg-white text-brand-600 border-t-2 border-brand-500'
                                    : 'text-surface-500 hover:text-surface-800'
                            }`}
                        >
                            <Upload className="w-4 h-4" />
                            Upload New
                        </button>
                    </div>

                    {/* Filters (only for browse mode) */}
                    {mode === 'browse' && (
                        <div className="px-5 py-3 border-b border-surface-100 space-y-2.5">
                            {/* Breadcrumb */}
                            <div className="flex items-center gap-1 text-xs flex-wrap">
                                <button
                                    onClick={() => navigateToFolder(null)}
                                    className={`flex items-center gap-1 px-2 py-1 rounded-md transition-colors ${
                                        currentFolderId === null ? 'text-brand-600 font-bold bg-brand-50' : 'text-surface-500 hover:text-surface-800 hover:bg-surface-50'
                                    }`}
                                >
                                    <Home className="w-3 h-3" />
                                    My Files
                                </button>
                                {breadcrumb.map((crumb, i) => {
                                    const isLast = i === breadcrumb.length - 1;
                                    return (
                                        <div key={crumb.id} className="flex items-center gap-1">
                                            <ChevronRight className="w-3 h-3 text-surface-300" />
                                            <button
                                                onClick={() => navigateToFolder(crumb.id)}
                                                className={`px-2 py-1 rounded-md font-semibold transition-colors ${
                                                    isLast ? 'text-brand-600 bg-brand-50' : 'text-surface-600 hover:text-surface-900 hover:bg-surface-50'
                                                }`}
                                            >
                                                📁 {crumb.name}
                                            </button>
                                        </div>
                                    );
                                })}
                            </div>

                            {/* Category tabs */}
                            <div className="flex items-center gap-1.5 overflow-x-auto">
                                {CATEGORY_TABS.map(tab => {
                                    const Icon = tab.icon;
                                    return (
                                        <button
                                            key={tab.value}
                                            onClick={() => setCategory(tab.value)}
                                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all whitespace-nowrap ${
                                                category === tab.value
                                                    ? 'bg-brand-500 text-white shadow-sm'
                                                    : 'bg-surface-100 text-surface-600 hover:bg-surface-200'
                                            }`}
                                        >
                                            <Icon className="w-3.5 h-3.5" />
                                            {tab.label}
                                        </button>
                                    );
                                })}
                            </div>

                            {/* Search */}
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-400" />
                                <input
                                    type="text"
                                    value={search}
                                    onChange={e => setSearch(e.target.value)}
                                    placeholder={search || category !== 'all' ? 'Searching across all folders...' : 'Search files by name...'}
                                    className="form-input pl-9 w-full"
                                />
                            </div>
                        </div>
                    )}

                    {/* Content Area */}
                    <div className="flex-1 overflow-y-auto p-5">
                        {mode === 'browse' ? (
                            <>
                                {loading ? (
                                    <div className="flex items-center justify-center h-full">
                                        <Loader2 className="w-8 h-8 text-brand-500 animate-spin" />
                                    </div>
                                ) : files.length === 0 && subfolders.length === 0 ? (
                                    <div className="flex flex-col items-center justify-center h-full text-center">
                                        <Folder className="w-16 h-16 text-surface-200 mb-3" />
                                        <h4 className="font-bold text-surface-700 mb-1">
                                            {search ? 'No results' : currentFolderId ? 'This folder is empty' : 'No files found'}
                                        </h4>
                                        <p className="text-sm text-surface-400 mb-4">
                                            {search ? `No match for "${search}"` : 'Upload your first file to get started'}
                                        </p>
                                        <button onClick={() => setMode('upload')} className="btn-primary btn-sm">
                                            <Upload className="w-4 h-4" /> Upload File
                                        </button>
                                    </div>
                                ) : (
                                    <div className="space-y-4">
                                        {/* Folders */}
                                        {subfolders.length > 0 && (
                                            <div>
                                                <div className="text-[10px] font-bold text-surface-400 uppercase tracking-wider mb-2">
                                                    Folders ({subfolders.length})
                                                </div>
                                                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                                                    {subfolders.map(folder => {
                                                        const colors = FOLDER_COLORS[folder.color] || FOLDER_COLORS.indigo;
                                                        return (
                                                            <motion.div
                                                                key={folder.id}
                                                                className="group rounded-xl border-2 border-surface-100 bg-white overflow-hidden cursor-pointer hover:border-brand-500 hover:shadow-md transition-all"
                                                                onClick={() => navigateToFolder(folder.id)}
                                                                initial={{ opacity: 0, y: 5 }}
                                                                animate={{ opacity: 1, y: 0 }}
                                                            >
                                                                <div className={`aspect-square ${colors.bg} flex items-center justify-center`}>
                                                                    <Folder className={`w-14 h-14 ${colors.icon} group-hover:scale-110 transition-transform`} fill="currentColor" />
                                                                </div>
                                                                <div className="p-2">
                                                                    <div className="text-[11px] font-semibold text-surface-900 truncate" title={folder.name}>
                                                                        {folder.name}
                                                                    </div>
                                                                    <div className="text-[9px] text-surface-400 mt-0.5">Folder</div>
                                                                </div>
                                                            </motion.div>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        )}

                                        {/* Files */}
                                        {files.length > 0 && (
                                            <div>
                                                {subfolders.length > 0 && (
                                                    <div className="text-[10px] font-bold text-surface-400 uppercase tracking-wider mb-2">
                                                        Files ({files.length})
                                                    </div>
                                                )}
                                                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                                                    {files.map(file => {
                                            const isImage = file.mime_type.startsWith('image/');
                                            const colors = CATEGORY_COLORS[file.category] || CATEGORY_COLORS.other;
                                            return (
                                                <motion.div
                                                    key={file.id}
                                                    className="group relative rounded-xl border-2 border-surface-100 bg-white overflow-hidden cursor-pointer hover:border-brand-500 hover:shadow-md transition-all"
                                                    onClick={() => onSelect(file)}
                                                    initial={{ opacity: 0, y: 5 }}
                                                    animate={{ opacity: 1, y: 0 }}
                                                >
                                                    {/* Thumbnail */}
                                                    <div className={`aspect-square ${colors.bg} flex items-center justify-center overflow-hidden`}>
                                                        {isImage ? (
                                                            <img
                                                                src={file.url}
                                                                alt={file.original_name}
                                                                className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                                                            />
                                                        ) : (
                                                            <div className={`flex flex-col items-center gap-1 ${colors.icon}`}>
                                                                <FileText className="w-10 h-10" />
                                                                <span className="text-[10px] font-bold uppercase">{file.extension}</span>
                                                            </div>
                                                        )}
                                                    </div>

                                                    {/* Meta */}
                                                    <div className="p-2">
                                                        <div className="text-[11px] font-semibold text-surface-900 truncate" title={file.original_name}>
                                                            {file.original_name}
                                                        </div>
                                                        <div className="text-[9px] text-surface-500 mt-0.5 flex items-center justify-between">
                                                            <span>{file.human_size}</span>
                                                            <span className={`px-1.5 py-0.5 rounded text-[8px] font-bold uppercase ${colors.bg} ${colors.text}`}>
                                                                {file.category.replace('_', ' ')}
                                                            </span>
                                                        </div>
                                                    </div>

                                                    {/* Hover actions */}
                                                    <div className="absolute top-1.5 right-1.5 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                        <button
                                                            onClick={(e) => { e.stopPropagation(); setPreview(file); }}
                                                            className="p-1.5 rounded-lg bg-white/90 text-surface-700 hover:bg-white shadow-md"
                                                            title="Preview"
                                                        >
                                                            <Eye className="w-3 h-3" />
                                                        </button>
                                                        <button
                                                            onClick={(e) => handleDelete(e, file.id)}
                                                            className="p-1.5 rounded-lg bg-white/90 text-red-500 hover:bg-red-50 hover:text-red-700 shadow-md"
                                                            title="Delete"
                                                        >
                                                            <Trash2 className="w-3 h-3" />
                                                        </button>
                                                    </div>

                                                    {/* Select overlay */}
                                                    <div className="absolute inset-0 bg-brand-500/0 group-hover:bg-brand-500/10 transition-colors pointer-events-none" />
                                                </motion.div>
                                            );
                                        })}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </>
                        ) : (
                            /* Upload mode */
                            <div
                                className="h-full flex flex-col items-center justify-center border-2 border-dashed border-surface-200 rounded-2xl p-8 cursor-pointer hover:border-brand-400 hover:bg-brand-50/30 transition-colors"
                                onClick={() => !uploading && fileInputRef.current?.click()}
                                onDragOver={e => { e.preventDefault(); }}
                                onDrop={e => {
                                    e.preventDefault();
                                    const f = e.dataTransfer.files?.[0];
                                    if (f && !uploading) handleUpload(f);
                                }}
                            >
                                <input
                                    ref={fileInputRef}
                                    type="file"
                                    accept={accept}
                                    onChange={e => {
                                        const f = e.target.files?.[0];
                                        if (f) handleUpload(f);
                                        e.target.value = '';
                                    }}
                                    className="hidden"
                                />
                                {uploading ? (
                                    <>
                                        <Loader2 className="w-12 h-12 text-brand-500 animate-spin mb-3" />
                                        <h4 className="font-bold text-surface-900 mb-1">Uploading...</h4>
                                        <p className="text-sm text-surface-500">Please wait</p>
                                    </>
                                ) : (
                                    <>
                                        <div className="w-16 h-16 rounded-2xl bg-brand-100 flex items-center justify-center text-brand-500 mb-3">
                                            <Upload className="w-8 h-8" />
                                        </div>
                                        <h4 className="font-bold text-surface-900 mb-1">Drop a file here or click to upload</h4>
                                        <p className="text-sm text-surface-500 mb-4">
                                            Images, PDFs, DWG/DXF, documents — up to 20 MB
                                        </p>
                                        <button
                                            onClick={e => { e.stopPropagation(); fileInputRef.current?.click(); }}
                                            className="btn-primary"
                                        >
                                            <Upload className="w-4 h-4" /> Choose File
                                        </button>
                                        {uploadError && (
                                            <p className="mt-3 text-sm text-red-500">⚠️ {uploadError}</p>
                                        )}
                                    </>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Preview Modal */}
                    <AnimatePresence>
                        {preview && (
                            <motion.div
                                className="absolute inset-0 bg-black/80 flex items-center justify-center p-6 z-10"
                                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                                onClick={() => setPreview(null)}
                            >
                                <motion.div
                                    className="bg-white rounded-2xl max-w-2xl w-full max-h-[80vh] overflow-hidden flex flex-col"
                                    initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }}
                                    onClick={e => e.stopPropagation()}
                                >
                                    <div className="flex items-center justify-between px-4 py-3 border-b border-surface-100">
                                        <div className="min-w-0 flex-1">
                                            <div className="font-bold text-surface-900 truncate">{preview.original_name}</div>
                                            <div className="text-xs text-surface-500">{preview.human_size} · {preview.category}</div>
                                        </div>
                                        <button onClick={() => setPreview(null)} className="p-2 text-surface-400 hover:text-surface-700">
                                            <X className="w-5 h-5" />
                                        </button>
                                    </div>
                                    <div className="flex-1 overflow-auto bg-surface-50 flex items-center justify-center p-4">
                                        {preview.mime_type.startsWith('image/') ? (
                                            <img src={preview.url} alt={preview.original_name} className="max-w-full max-h-full" />
                                        ) : preview.extension === 'dxf' ? (
                                            <DxfPreview url={preview.url} filename={preview.original_name} className="w-full h-full min-h-[400px]" />
                                        ) : preview.extension === 'dwg' ? (
                                            <DwgUnsupportedCard
                                                url={preview.url}
                                                filename={preview.original_name}
                                                fileId={preview.id}
                                                previewUrl={preview.preview_url}
                                                previewStatus={preview.preview_status}
                                                previewError={preview.preview_error}
                                                onPreviewGenerated={(updated) => setPreview({ ...preview, ...updated })}
                                            />
                                        ) : preview.mime_type === 'application/pdf' ? (
                                            <iframe src={preview.url} className="w-full h-full min-h-[500px] border-0" title={preview.original_name} />
                                        ) : (
                                            <div className="text-center">
                                                <FileText className="w-20 h-20 text-surface-300 mx-auto mb-3" />
                                                <a href={preview.url} target="_blank" rel="noreferrer" className="btn-primary">
                                                    <Eye className="w-4 h-4" /> Open file
                                                </a>
                                            </div>
                                        )}
                                    </div>
                                    <div className="flex items-center justify-end gap-2 px-4 py-3 border-t border-surface-100">
                                        <button onClick={() => setPreview(null)} className="btn-ghost btn-sm">Close</button>
                                        <button
                                            onClick={() => { onSelect(preview); onClose(); }}
                                            className="btn-primary btn-sm"
                                        >
                                            <Check className="w-4 h-4" /> Use This File
                                        </button>
                                    </div>
                                </motion.div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </motion.div>
            </motion.div>
        </AnimatePresence>
    );
}
