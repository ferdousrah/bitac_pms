import AppLayout from '@/Layouts/AppLayout';
import { Link, router } from '@inertiajs/react';
import { motion, AnimatePresence } from 'motion/react';
import { useState, useRef, useEffect } from 'react';
import axios from 'axios';
import {
    Upload, Search, FileText, Image as ImageIcon, Folder, FolderPlus,
    Trash2, Eye, Download, Loader2, Grid3x3, HardDrive, Home,
    ChevronRight, MoreVertical, CheckSquare, Square, FolderOpen,
    Edit2, X, ArrowLeft, MoveRight,
} from 'lucide-react';
import DxfPreview, { DwgUnsupportedCard } from '@/Components/FilePicker/DxfPreview';

interface UserFile {
    id: number;
    folder_id: number | null;
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

interface FileFolder {
    id: number;
    parent_folder_id: number | null;
    name: string;
    color: string;
    icon: string | null;
    description: string | null;
    file_count: number;
    subfolder_count: number;
}

interface Breadcrumb {
    id: number;
    name: string;
    color: string;
}

interface Props {
    files: { data: UserFile[]; links: any[]; current_page: number; last_page: number; total: number };
    subfolders: FileFolder[];
    currentFolder: FileFolder | null;
    breadcrumb: Breadcrumb[];
    stats: {
        total_count: number;
        total_size: number;
        drawings_count: number;
        images_count: number;
        documents_count: number;
        folders_count: number;
    };
    filters: { category?: string; search?: string; folder?: string };
}

const CATEGORIES = [
    { value: '',             label: 'All Files',      icon: Grid3x3,    color: 'text-slate-500' },
    { value: 'drawing',      label: 'Drawings',       icon: FileText,   color: 'text-blue-500' },
    { value: 'sample_photo', label: 'Sample Photos',  icon: ImageIcon,  color: 'text-amber-500' },
    { value: 'image',        label: 'Images',         icon: ImageIcon,  color: 'text-emerald-500' },
    { value: 'document',     label: 'Documents',      icon: FileText,   color: 'text-red-500' },
    { value: 'other',        label: 'Other',          icon: Folder,     color: 'text-slate-400' },
];

const CATEGORY_COLORS: Record<string, { bg: string; text: string }> = {
    drawing:      { bg: 'bg-blue-50',    text: 'text-blue-700' },
    sample_photo: { bg: 'bg-amber-50',   text: 'text-amber-700' },
    image:        { bg: 'bg-emerald-50', text: 'text-emerald-700' },
    document:     { bg: 'bg-red-50',     text: 'text-red-700' },
    other:        { bg: 'bg-slate-50',   text: 'text-slate-700' },
};

const FOLDER_COLORS: Record<string, { bg: string; ring: string; icon: string }> = {
    indigo:  { bg: 'bg-indigo-100',  ring: 'ring-indigo-400',  icon: 'text-indigo-600' },
    blue:    { bg: 'bg-blue-100',    ring: 'ring-blue-400',    icon: 'text-blue-600' },
    emerald: { bg: 'bg-emerald-100', ring: 'ring-emerald-400', icon: 'text-emerald-600' },
    amber:   { bg: 'bg-amber-100',   ring: 'ring-amber-400',   icon: 'text-amber-600' },
    rose:    { bg: 'bg-rose-100',    ring: 'ring-rose-400',    icon: 'text-rose-600' },
    slate:   { bg: 'bg-slate-100',   ring: 'ring-slate-400',   icon: 'text-slate-600' },
    purple:  { bg: 'bg-purple-100',  ring: 'ring-purple-400',  icon: 'text-purple-600' },
    orange:  { bg: 'bg-orange-100',  ring: 'ring-orange-400',  icon: 'text-orange-600' },
};

const COLOR_SWATCHES = ['indigo', 'blue', 'emerald', 'amber', 'rose', 'slate', 'purple', 'orange'];

function humanSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

export default function FilesIndex({ files, subfolders, currentFolder, breadcrumb, stats, filters }: Props) {
    const [category, setCategory] = useState(filters.category || '');
    const [search, setSearch] = useState(filters.search || '');
    const [uploading, setUploading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState<{ current: number; total: number; name: string } | null>(null);
    const [dragOverPage, setDragOverPage] = useState(false);
    const [dragOverFolderId, setDragOverFolderId] = useState<number | null>(null);
    const [preview, setPreview] = useState<UserFile | null>(null);
    const [showNewFolder, setShowNewFolder] = useState(false);
    const [newFolderName, setNewFolderName] = useState('');
    const [newFolderColor, setNewFolderColor] = useState('indigo');
    const [selectedFiles, setSelectedFiles] = useState<Set<number>>(new Set());
    const [showMoveModal, setShowMoveModal] = useState(false);
    const [allFolders, setAllFolders] = useState<FileFolder[]>([]);
    const [showFolderMenu, setShowFolderMenu] = useState<number | null>(null);
    const [editingFolder, setEditingFolder] = useState<FileFolder | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const applyFilters = (params: Partial<{ category: string; search: string; folder: string | number | null }>) => {
        router.get('/files', {
            category: params.category !== undefined ? params.category : category,
            search:   params.search   !== undefined ? params.search   : search,
            folder:   params.folder   !== undefined ? params.folder   : currentFolder?.id ?? '',
        }, { preserveState: true, preserveScroll: true });
    };

    const navigateToFolder = (folderId: number | null) => {
        router.get('/files', { folder: folderId ?? '' }, { preserveState: false });
    };

    /* ── File Upload (single or multiple, to current folder) ─── */
    const uploadFiles = async (files: File[] | FileList, targetFolderId: number | null = null) => {
        const fileList = Array.from(files);
        if (fileList.length === 0) return;

        const folderId = targetFolderId !== null ? targetFolderId : currentFolder?.id ?? null;
        setUploading(true);
        setUploadProgress({ current: 0, total: fileList.length, name: '' });

        try {
            for (let i = 0; i < fileList.length; i++) {
                const file = fileList[i];
                setUploadProgress({ current: i + 1, total: fileList.length, name: file.name });
                const form = new FormData();
                form.append('file', file);
                if (category) form.append('category', category);
                if (folderId) form.append('folder_id', String(folderId));
                try {
                    await axios.post('/files', form, { headers: { 'Content-Type': 'multipart/form-data' } });
                } catch (err: any) {
                    // Continue with remaining files even if one fails
                    console.warn(`Failed to upload ${file.name}:`, err);
                }
            }
            router.reload({ only: ['files', 'subfolders', 'stats'] });
        } finally {
            setUploading(false);
            setUploadProgress(null);
        }
    };

    const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files || files.length === 0) return;
        e.target.value = '';
        await uploadFiles(files);
    };

    /* ── File Delete ──────────────────────────────────────── */
    const handleDelete = async (fileId: number) => {
        if (!confirm('Delete this file? This cannot be undone.')) return;
        try {
            await axios.delete(`/files/${fileId}`);
            router.reload({ only: ['files', 'stats'] });
        } catch {}
    };

    /* ── Folder Create ────────────────────────────────────── */
    const createFolder = async () => {
        const name = newFolderName.trim();
        if (!name) return;
        try {
            await axios.post('/file-folders', {
                name,
                color: newFolderColor,
                parent_folder_id: currentFolder?.id ?? null,
            });
            setShowNewFolder(false);
            setNewFolderName('');
            router.reload({ only: ['subfolders', 'stats'] });
        } catch (err: any) {
            alert(err.response?.data?.message || 'Failed to create folder');
        }
    };

    /* ── Folder Delete ────────────────────────────────────── */
    const deleteFolder = async (folder: FileFolder, action: 'move_to_root' | 'delete_files') => {
        const msg = action === 'delete_files'
            ? `Delete folder "${folder.name}" AND all ${folder.file_count} file(s) inside? This cannot be undone.`
            : `Delete folder "${folder.name}"? Files inside will be moved out.`;
        if (!confirm(msg)) return;
        try {
            await axios.delete(`/file-folders/${folder.id}`, { data: { action } });
            router.reload({ only: ['subfolders', 'files', 'stats'] });
        } catch {}
    };

    /* ── Folder Update ────────────────────────────────────── */
    const updateFolder = async (folder: FileFolder, changes: Partial<FileFolder>) => {
        try {
            await axios.put(`/file-folders/${folder.id}`, changes);
            router.reload({ only: ['subfolders'] });
            setEditingFolder(null);
        } catch {}
    };

    /* ── File Selection + Move ────────────────────────────── */
    const toggleSelect = (id: number) => {
        setSelectedFiles(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const openMoveModal = async () => {
        if (selectedFiles.size === 0) return;
        try {
            const { data } = await axios.get('/file-folders');
            setAllFolders(data.folders || []);
            setShowMoveModal(true);
        } catch {}
    };

    const moveTo = async (folderId: number | null) => {
        try {
            await axios.post('/files/move', {
                file_ids: Array.from(selectedFiles),
                folder_id: folderId,
            });
            setSelectedFiles(new Set());
            setShowMoveModal(false);
            router.reload({ only: ['files'] });
        } catch {}
    };

    // Close folder menu on outside click
    useEffect(() => {
        const closer = () => setShowFolderMenu(null);
        document.addEventListener('click', closer);
        return () => document.removeEventListener('click', closer);
    }, []);

    /* ── Page-level drag-drop (upload to current folder) ───────── */
    useEffect(() => {
        let counter = 0; // drag enter/leave counter to handle nested elements

        const onDragEnter = (e: DragEvent) => {
            if (!e.dataTransfer?.types.includes('Files')) return;
            e.preventDefault();
            counter++;
            setDragOverPage(true);
        };
        const onDragLeave = (e: DragEvent) => {
            if (!e.dataTransfer?.types.includes('Files')) return;
            counter--;
            if (counter <= 0) {
                counter = 0;
                setDragOverPage(false);
            }
        };
        const onDragOver = (e: DragEvent) => {
            if (!e.dataTransfer?.types.includes('Files')) return;
            e.preventDefault();
        };
        const onDrop = (e: DragEvent) => {
            if (!e.dataTransfer?.types.includes('Files')) return;
            e.preventDefault();
            counter = 0;
            setDragOverPage(false);
            // If a folder card handled the drop (via stopPropagation), we don't reach here.
            const files = e.dataTransfer.files;
            if (files && files.length > 0) {
                uploadFiles(files);
            }
        };

        window.addEventListener('dragenter', onDragEnter);
        window.addEventListener('dragleave', onDragLeave);
        window.addEventListener('dragover', onDragOver);
        window.addEventListener('drop', onDrop);

        return () => {
            window.removeEventListener('dragenter', onDragEnter);
            window.removeEventListener('dragleave', onDragLeave);
            window.removeEventListener('dragover', onDragOver);
            window.removeEventListener('drop', onDrop);
        };
    }, [currentFolder, category]);

    const filtering = !!(category || search);

    return (
        <AppLayout header="My Files">
            {/* Page-level drag overlay */}
            <AnimatePresence>
                {dragOverPage && dragOverFolderId === null && (
                    <motion.div
                        className="fixed inset-0 z-[200] pointer-events-none flex items-center justify-center"
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                    >
                        <div className="absolute inset-0 bg-brand-500/10 backdrop-blur-sm border-4 border-dashed border-brand-500" />
                        <div className="relative bg-white rounded-2xl shadow-2xl px-8 py-6 border-2 border-brand-500">
                            <div className="flex flex-col items-center">
                                <div className="w-16 h-16 rounded-2xl bg-brand-100 flex items-center justify-center mb-3">
                                    <Upload className="w-8 h-8 text-brand-500 animate-bounce" />
                                </div>
                                <div className="text-lg font-bold text-surface-900">
                                    Drop to upload {currentFolder ? `to "${currentFolder.name}"` : 'to My Files'}
                                </div>
                                <div className="text-xs text-surface-500 mt-1">
                                    Or drop on a specific folder to upload there
                                </div>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Upload progress toast */}
            <AnimatePresence>
                {uploadProgress && (
                    <motion.div
                        className="fixed bottom-6 right-6 z-[250] bg-white rounded-2xl shadow-2xl border border-surface-100 p-4 min-w-[280px]"
                        initial={{ opacity: 0, y: 20, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 20, scale: 0.95 }}
                    >
                        <div className="flex items-center gap-3 mb-2">
                            <Loader2 className="w-5 h-5 text-brand-500 animate-spin" />
                            <div className="flex-1 min-w-0">
                                <div className="text-sm font-bold text-surface-900">
                                    Uploading {uploadProgress.current} of {uploadProgress.total}
                                </div>
                                <div className="text-xs text-surface-500 truncate">{uploadProgress.name}</div>
                            </div>
                        </div>
                        <div className="h-1.5 bg-surface-100 rounded-full overflow-hidden">
                            <motion.div
                                className="h-full bg-gradient-to-r from-brand-500 to-brand-600"
                                animate={{ width: `${(uploadProgress.current / uploadProgress.total) * 100}%` }}
                                transition={{ duration: 0.3 }}
                            />
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            <div className="max-w-7xl space-y-5 animate-fade-in">
                {/* ── Stats Row ─────────────────────────────────────── */}
                <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
                    <StatCard label="Total Files" value={stats.total_count} icon={HardDrive} color="bg-brand-50 text-brand-500" />
                    <StatCard label="Storage" value={humanSize(stats.total_size)} icon={Folder} color="bg-purple-50 text-purple-500" />
                    <StatCard label="Folders" value={stats.folders_count} icon={FolderOpen} color="bg-indigo-50 text-indigo-500" />
                    <StatCard label="Drawings" value={stats.drawings_count} icon={FileText} color="bg-blue-50 text-blue-500" />
                    <StatCard label="Images" value={stats.images_count} icon={ImageIcon} color="bg-emerald-50 text-emerald-500" />
                    <StatCard label="Documents" value={stats.documents_count} icon={FileText} color="bg-red-50 text-red-500" />
                </div>

                {/* ── Breadcrumb ────────────────────────────────────── */}
                <div className="flex items-center gap-1.5 text-sm flex-wrap">
                    <button
                        onClick={() => navigateToFolder(null)}
                        className={`flex items-center gap-1.5 px-2 py-1 rounded-lg transition-colors ${
                            !currentFolder ? 'text-brand-600 font-bold bg-brand-50' : 'text-surface-500 hover:text-surface-900 hover:bg-surface-50'
                        }`}
                    >
                        <Home className="w-4 h-4" />
                        My Files
                    </button>
                    {breadcrumb.map((crumb, i) => {
                        const isLast = i === breadcrumb.length - 1;
                        return (
                            <div key={crumb.id} className="flex items-center gap-1.5">
                                <ChevronRight className="w-3.5 h-3.5 text-surface-300" />
                                <button
                                    onClick={() => navigateToFolder(crumb.id)}
                                    className={`px-2 py-1 rounded-lg font-semibold transition-colors ${
                                        isLast ? 'text-brand-600 bg-brand-50' : 'text-surface-600 hover:text-surface-900 hover:bg-surface-50'
                                    }`}
                                >
                                    📁 {crumb.name}
                                </button>
                            </div>
                        );
                    })}
                </div>

                {/* ── Actions Bar ───────────────────────────────────── */}
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-400" />
                        <input
                            type="text"
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && applyFilters({ search })}
                            placeholder="Search files (searches across all folders)..."
                            className="form-input pl-9 w-full"
                        />
                    </div>
                    <input ref={fileInputRef} type="file" multiple className="hidden" onChange={handleUpload} />
                    <button onClick={() => setShowNewFolder(true)} className="btn-outline">
                        <FolderPlus className="w-4 h-4" /> New Folder
                    </button>
                    <button
                        onClick={() => !uploading && fileInputRef.current?.click()}
                        disabled={uploading}
                        className="btn-primary"
                    >
                        {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                        {uploading ? 'Uploading...' : `Upload${currentFolder ? ` to "${currentFolder.name}"` : ''}`}
                    </button>
                </div>

                {/* Drag-drop hint */}
                <div className="text-xs text-surface-400 flex items-center gap-1.5">
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-surface-100 text-surface-500 font-semibold">
                        💡 Tip
                    </span>
                    <span>Drag files directly onto a folder to upload there, or drop anywhere on the page to upload to the current location.</span>
                </div>

                {/* ── Category Tabs ─────────────────────────────────── */}
                <div className="flex items-center gap-2 overflow-x-auto pb-1">
                    {CATEGORIES.map(cat => {
                        const Icon = cat.icon;
                        const active = category === cat.value;
                        return (
                            <button
                                key={cat.value}
                                onClick={() => { setCategory(cat.value); applyFilters({ category: cat.value }); }}
                                className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold whitespace-nowrap transition-all ${
                                    active
                                        ? 'bg-brand-500 text-white shadow-md'
                                        : 'bg-white text-surface-600 border border-surface-200 hover:border-brand-300 hover:text-brand-600'
                                }`}
                            >
                                <Icon className={`w-4 h-4 ${active ? 'text-white' : cat.color}`} />
                                {cat.label}
                            </button>
                        );
                    })}
                </div>

                {/* ── Selected Files Bar ────────────────────────────── */}
                <AnimatePresence>
                    {selectedFiles.size > 0 && (
                        <motion.div
                            className="flex items-center gap-3 p-3 rounded-xl bg-brand-500 text-white shadow-lg"
                            initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
                        >
                            <CheckSquare className="w-5 h-5" />
                            <span className="font-bold">{selectedFiles.size} file{selectedFiles.size > 1 ? 's' : ''} selected</span>
                            <div className="ml-auto flex items-center gap-2">
                                <button onClick={openMoveModal} className="px-3 py-1.5 rounded-lg bg-white/20 hover:bg-white/30 text-white text-xs font-bold flex items-center gap-1.5">
                                    <MoveRight className="w-3.5 h-3.5" /> Move to folder
                                </button>
                                <button onClick={() => setSelectedFiles(new Set())} className="p-1.5 rounded-lg hover:bg-white/20 text-white">
                                    <X className="w-4 h-4" />
                                </button>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* ── Filtering Banner ──────────────────────────────── */}
                {filtering && (
                    <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs flex items-center gap-2">
                        <Search className="w-4 h-4 text-amber-600 shrink-0" />
                        <span>Showing files across all folders matching your filter. Clear search/category to browse folders normally.</span>
                        <button onClick={() => { setCategory(''); setSearch(''); applyFilters({ category: '', search: '' }); }} className="ml-auto text-amber-900 font-bold hover:underline">Clear</button>
                    </div>
                )}

                {/* ── Folders Grid (only when not filtering) ────────── */}
                {!filtering && subfolders.length > 0 && (
                    <div>
                        <div className="text-xs font-bold text-surface-400 uppercase tracking-wider mb-2">Folders ({subfolders.length})</div>
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
                            {subfolders.map((folder) => {
                                const colors = FOLDER_COLORS[folder.color] || FOLDER_COLORS.indigo;
                                const isDragOver = dragOverFolderId === folder.id;
                                return (
                                    <motion.div
                                        key={folder.id}
                                        className={`group relative card hover:-translate-y-0.5 hover:shadow-md transition-all cursor-pointer ${
                                            isDragOver ? `ring-2 ring-offset-2 ${colors.ring} scale-[1.02] shadow-lg` : ''
                                        }`}
                                        onDoubleClick={() => navigateToFolder(folder.id)}
                                        onClick={() => navigateToFolder(folder.id)}
                                        onDragEnter={(e) => {
                                            if (e.dataTransfer.types.includes('Files')) {
                                                e.preventDefault();
                                                e.stopPropagation();
                                                setDragOverFolderId(folder.id);
                                            }
                                        }}
                                        onDragOver={(e) => {
                                            if (e.dataTransfer.types.includes('Files')) {
                                                e.preventDefault();
                                                e.stopPropagation();
                                            }
                                        }}
                                        onDragLeave={(e) => {
                                            e.stopPropagation();
                                            setDragOverFolderId(null);
                                        }}
                                        onDrop={(e) => {
                                            if (e.dataTransfer.types.includes('Files')) {
                                                e.preventDefault();
                                                e.stopPropagation();
                                                setDragOverFolderId(null);
                                                setDragOverPage(false);
                                                const files = e.dataTransfer.files;
                                                if (files && files.length > 0) {
                                                    uploadFiles(files, folder.id);
                                                }
                                            }
                                        }}
                                        initial={{ opacity: 0, y: 5 }}
                                        animate={{ opacity: 1, y: 0 }}
                                    >
                                        <div className="card-body p-3">
                                            <div className="flex items-center justify-between mb-2">
                                                <div className={`w-10 h-10 rounded-xl ${colors.bg} flex items-center justify-center`}>
                                                    <Folder className={`w-5 h-5 ${colors.icon}`} fill="currentColor" />
                                                </div>
                                                <div className="flex items-center gap-0.5">
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            // Create a one-off file input for this folder
                                                            const input = document.createElement('input');
                                                            input.type = 'file';
                                                            input.multiple = true;
                                                            input.onchange = (ev: any) => {
                                                                const files = ev.target.files;
                                                                if (files && files.length > 0) uploadFiles(files, folder.id);
                                                            };
                                                            input.click();
                                                        }}
                                                        className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-brand-50 text-brand-500 transition-all"
                                                        title="Upload to this folder"
                                                    >
                                                        <Upload className="w-4 h-4" />
                                                    </button>
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); setShowFolderMenu(showFolderMenu === folder.id ? null : folder.id); }}
                                                        className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-surface-100 text-surface-500 transition-all"
                                                    >
                                                        <MoreVertical className="w-4 h-4" />
                                                    </button>
                                                </div>
                                                {showFolderMenu === folder.id && (
                                                    <div className="absolute top-10 right-2 z-10 bg-white rounded-xl shadow-lg border border-surface-100 py-1 min-w-[160px]" onClick={e => e.stopPropagation()}>
                                                        <button onClick={() => { setEditingFolder(folder); setShowFolderMenu(null); }} className="w-full px-3 py-1.5 text-left text-xs hover:bg-surface-50 flex items-center gap-2">
                                                            <Edit2 className="w-3 h-3" /> Rename / Color
                                                        </button>
                                                        <button onClick={() => { deleteFolder(folder, 'move_to_root'); setShowFolderMenu(null); }} className="w-full px-3 py-1.5 text-left text-xs hover:bg-amber-50 text-amber-700 flex items-center gap-2">
                                                            <FolderOpen className="w-3 h-3" /> Delete (keep files)
                                                        </button>
                                                        <button onClick={() => { deleteFolder(folder, 'delete_files'); setShowFolderMenu(null); }} className="w-full px-3 py-1.5 text-left text-xs hover:bg-red-50 text-red-700 flex items-center gap-2">
                                                            <Trash2 className="w-3 h-3" /> Delete folder + files
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
                                            <div className="font-bold text-sm text-surface-900 truncate" title={folder.name}>{folder.name}</div>
                                            <div className="text-[10px] text-surface-400 mt-0.5">
                                                {folder.file_count} file{folder.file_count !== 1 ? 's' : ''}
                                                {folder.subfolder_count > 0 && ` · ${folder.subfolder_count} subfolder${folder.subfolder_count > 1 ? 's' : ''}`}
                                            </div>

                                            {/* Drop overlay — visible when dragging files over this folder */}
                                            {isDragOver && (
                                                <div className={`absolute inset-0 ${colors.bg} bg-opacity-95 rounded-lg flex flex-col items-center justify-center pointer-events-none z-[5]`}>
                                                    <Upload className={`w-6 h-6 ${colors.icon} mb-1 animate-bounce`} />
                                                    <span className={`text-[10px] font-bold ${colors.icon} uppercase`}>Drop to upload</span>
                                                </div>
                                            )}
                                        </div>
                                    </motion.div>
                                );
                            })}
                        </div>
                    </div>
                )}

                {/* ── Files Grid ────────────────────────────────────── */}
                {files.data.length === 0 && subfolders.length === 0 && !filtering ? (
                    <div className="card">
                        <div className="card-body text-center py-16">
                            <div className="w-20 h-20 rounded-2xl bg-surface-50 flex items-center justify-center mx-auto mb-4">
                                <Folder className="w-10 h-10 text-surface-300" />
                            </div>
                            <h3 className="text-lg font-bold text-surface-900 mb-1">
                                {currentFolder ? 'This folder is empty' : 'No files yet'}
                            </h3>
                            <p className="text-sm text-surface-400 mb-4">
                                Create a folder or upload files to get started.
                            </p>
                            <div className="flex items-center justify-center gap-2">
                                <button onClick={() => setShowNewFolder(true)} className="btn-outline">
                                    <FolderPlus className="w-4 h-4" /> New Folder
                                </button>
                                <button onClick={() => fileInputRef.current?.click()} className="btn-primary">
                                    <Upload className="w-4 h-4" /> Upload File
                                </button>
                            </div>
                        </div>
                    </div>
                ) : files.data.length > 0 && (
                    <div>
                        <div className="text-xs font-bold text-surface-400 uppercase tracking-wider mb-2">
                            Files ({files.total})
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
                            {files.data.map((file, i) => {
                                const isImage = file.mime_type.startsWith('image/');
                                const colors = CATEGORY_COLORS[file.category] || CATEGORY_COLORS.other;
                                const selected = selectedFiles.has(file.id);
                                return (
                                    <motion.div
                                        key={file.id}
                                        className={`group card overflow-hidden hover:-translate-y-0.5 hover:shadow-lg transition-all ${selected ? 'ring-2 ring-brand-500' : ''}`}
                                        initial={{ opacity: 0, y: 5 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ delay: i * 0.02 }}
                                    >
                                        {/* Selection checkbox overlay */}
                                        <button
                                            onClick={() => toggleSelect(file.id)}
                                            className={`absolute top-2 left-2 z-10 p-1 rounded-md transition-all ${
                                                selected ? 'bg-brand-500 text-white' : 'bg-white/90 text-surface-500 opacity-0 group-hover:opacity-100'
                                            }`}
                                        >
                                            {selected ? <CheckSquare className="w-3.5 h-3.5" /> : <Square className="w-3.5 h-3.5" />}
                                        </button>

                                        {/* Thumbnail */}
                                        <div className={`aspect-square ${colors.bg} flex items-center justify-center overflow-hidden relative`}>
                                            {isImage ? (
                                                <img src={file.url} alt={file.original_name} className="w-full h-full object-cover" />
                                            ) : (
                                                <div className="flex flex-col items-center gap-2">
                                                    <FileText className="w-12 h-12 opacity-60" />
                                                    <span className="text-xs font-bold uppercase opacity-70">{file.extension}</span>
                                                </div>
                                            )}
                                            {/* Hover actions */}
                                            <div className="absolute top-2 right-2 flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <button onClick={() => setPreview(file)} className="p-1.5 rounded-lg bg-white/95 text-surface-700 hover:bg-white shadow-md" title="Preview">
                                                    <Eye className="w-3.5 h-3.5" />
                                                </button>
                                                <a href={file.url} target="_blank" rel="noreferrer" download={file.original_name} className="p-1.5 rounded-lg bg-white/95 text-surface-700 hover:bg-white shadow-md block" title="Download">
                                                    <Download className="w-3.5 h-3.5" />
                                                </a>
                                                <button onClick={() => handleDelete(file.id)} className="p-1.5 rounded-lg bg-white/95 text-red-500 hover:bg-red-50 shadow-md" title="Delete">
                                                    <Trash2 className="w-3.5 h-3.5" />
                                                </button>
                                            </div>
                                        </div>
                                        {/* Info */}
                                        <div className="p-2.5">
                                            <div className="text-xs font-semibold text-surface-900 truncate" title={file.original_name}>
                                                {file.original_name}
                                            </div>
                                            <div className="text-[10px] text-surface-500 mt-0.5 flex items-center justify-between">
                                                <span>{file.human_size}</span>
                                                <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase ${colors.bg} ${colors.text}`}>
                                                    {file.category.replace('_', ' ')}
                                                </span>
                                            </div>
                                        </div>
                                    </motion.div>
                                );
                            })}
                        </div>
                    </div>
                )}

                {/* Pagination */}
                {files.last_page > 1 && (
                    <div className="flex items-center justify-center gap-1">
                        {files.links.map((link, i) => (
                            <button
                                key={i}
                                onClick={() => link.url && router.get(link.url, {}, { preserveState: true, preserveScroll: true })}
                                disabled={!link.url}
                                className={`min-w-[32px] h-8 px-2 rounded-lg text-xs font-semibold transition-colors ${
                                    link.active
                                        ? 'bg-brand-500 text-white'
                                        : 'bg-white border border-surface-200 text-surface-600 hover:border-brand-300'
                                } disabled:opacity-30`}
                                dangerouslySetInnerHTML={{ __html: link.label }}
                            />
                        ))}
                    </div>
                )}

                {/* ── New Folder Modal ──────────────────────────────── */}
                <AnimatePresence>
                    {showNewFolder && (
                        <motion.div
                            className="fixed inset-0 z-[250] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4"
                            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                            onClick={() => setShowNewFolder(false)}
                        >
                            <motion.div
                                className="bg-white rounded-2xl shadow-xl w-full max-w-md"
                                initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }}
                                onClick={e => e.stopPropagation()}
                            >
                                <div className="p-5 border-b border-surface-100">
                                    <h3 className="font-bold text-surface-900 flex items-center gap-2">
                                        <FolderPlus className="w-5 h-5 text-brand-500" />
                                        New Folder
                                    </h3>
                                    <p className="text-xs text-surface-500 mt-1">
                                        {currentFolder ? `Inside: ${currentFolder.name}` : 'At root level'}
                                    </p>
                                </div>
                                <div className="p-5 space-y-4">
                                    <div className="form-group">
                                        <label className="form-label">Folder Name *</label>
                                        <input
                                            type="text"
                                            value={newFolderName}
                                            onChange={e => setNewFolderName(e.target.value)}
                                            onKeyDown={e => e.key === 'Enter' && createFolder()}
                                            placeholder="e.g. Railway Project 2026"
                                            className="form-input"
                                            autoFocus
                                        />
                                    </div>
                                    <div>
                                        <label className="form-label mb-2 block">Color</label>
                                        <div className="flex gap-2 flex-wrap">
                                            {COLOR_SWATCHES.map(c => {
                                                const colors = FOLDER_COLORS[c];
                                                return (
                                                    <button
                                                        key={c}
                                                        onClick={() => setNewFolderColor(c)}
                                                        className={`w-10 h-10 rounded-xl ${colors.bg} flex items-center justify-center transition-all ${
                                                            newFolderColor === c ? `ring-2 ${colors.ring} ring-offset-2` : 'hover:scale-110'
                                                        }`}
                                                    >
                                                        <Folder className={`w-5 h-5 ${colors.icon}`} fill="currentColor" />
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>
                                </div>
                                <div className="flex justify-end gap-2 p-5 border-t border-surface-100">
                                    <button onClick={() => setShowNewFolder(false)} className="btn-ghost">Cancel</button>
                                    <button onClick={createFolder} disabled={!newFolderName.trim()} className="btn-primary">
                                        <FolderPlus className="w-4 h-4" /> Create
                                    </button>
                                </div>
                            </motion.div>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* ── Edit Folder Modal ─────────────────────────────── */}
                <AnimatePresence>
                    {editingFolder && (
                        <EditFolderModal folder={editingFolder} onClose={() => setEditingFolder(null)} onSave={updateFolder} />
                    )}
                </AnimatePresence>

                {/* ── Move Files Modal ──────────────────────────────── */}
                <AnimatePresence>
                    {showMoveModal && (
                        <motion.div
                            className="fixed inset-0 z-[250] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4"
                            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                            onClick={() => setShowMoveModal(false)}
                        >
                            <motion.div
                                className="bg-white rounded-2xl shadow-xl w-full max-w-md max-h-[70vh] flex flex-col"
                                initial={{ scale: 0.95 }} animate={{ scale: 1 }}
                                onClick={e => e.stopPropagation()}
                            >
                                <div className="p-4 border-b border-surface-100">
                                    <h3 className="font-bold text-surface-900 flex items-center gap-2">
                                        <MoveRight className="w-5 h-5 text-brand-500" />
                                        Move {selectedFiles.size} file{selectedFiles.size > 1 ? 's' : ''}
                                    </h3>
                                </div>
                                <div className="flex-1 overflow-y-auto p-2">
                                    <button
                                        onClick={() => moveTo(null)}
                                        className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-surface-50 text-left transition-colors"
                                    >
                                        <Home className="w-4 h-4 text-surface-400" />
                                        <span className="text-sm font-semibold text-surface-700">Root (My Files)</span>
                                    </button>
                                    {allFolders.map(f => {
                                        const colors = FOLDER_COLORS[f.color] || FOLDER_COLORS.indigo;
                                        return (
                                            <button
                                                key={f.id}
                                                onClick={() => moveTo(f.id)}
                                                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-surface-50 text-left transition-colors"
                                            >
                                                <div className={`w-7 h-7 rounded-lg ${colors.bg} flex items-center justify-center`}>
                                                    <Folder className={`w-3.5 h-3.5 ${colors.icon}`} fill="currentColor" />
                                                </div>
                                                <span className="text-sm font-semibold text-surface-700">{f.name}</span>
                                            </button>
                                        );
                                    })}
                                    {allFolders.length === 0 && (
                                        <div className="text-center py-6 text-sm text-surface-400">
                                            No folders yet. Create one first.
                                        </div>
                                    )}
                                </div>
                                <div className="flex justify-end gap-2 p-3 border-t border-surface-100">
                                    <button onClick={() => setShowMoveModal(false)} className="btn-ghost btn-sm">Cancel</button>
                                </div>
                            </motion.div>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* ── Preview Modal ─────────────────────────────────── */}
                {preview && (
                    <div className="fixed inset-0 z-[250] bg-black/80 flex items-center justify-center p-4" onClick={() => setPreview(null)}>
                        <motion.div
                            className="bg-white rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col"
                            initial={{ scale: 0.95 }} animate={{ scale: 1 }}
                            onClick={e => e.stopPropagation()}
                        >
                            <div className="flex items-center justify-between px-4 py-3 border-b border-surface-100">
                                <div className="min-w-0 flex-1">
                                    <div className="font-bold text-surface-900 truncate">{preview.original_name}</div>
                                    <div className="text-xs text-surface-500">{preview.human_size} · {preview.category.replace('_', ' ')}</div>
                                </div>
                                <button onClick={() => setPreview(null)} className="p-2 text-surface-400 hover:text-surface-700">✕</button>
                            </div>
                            <div className="flex-1 overflow-auto bg-surface-50 flex items-center justify-center p-4">
                                {preview.mime_type.startsWith('image/') ? (
                                    <img src={preview.url} alt={preview.original_name} className="max-w-full max-h-full" />
                                ) : preview.extension === 'dxf' ? (
                                    <DxfPreview url={preview.url} filename={preview.original_name} className="w-full h-full min-h-[500px]" />
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
                        </motion.div>
                    </div>
                )}
            </div>
        </AppLayout>
    );
}

/* ═══════════════════════════════════════════════════════════════════ */
function StatCard({ label, value, icon: Icon, color }: any) {
    return (
        <motion.div className="card" initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }}>
            <div className="card-body p-3">
                <div className="flex items-center gap-2">
                    <div className={`w-8 h-8 rounded-xl ${color} flex items-center justify-center`}>
                        <Icon className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                        <div className="text-[10px] text-surface-400 font-semibold uppercase truncate">{label}</div>
                        <div className="text-lg font-bold text-surface-900">{value}</div>
                    </div>
                </div>
            </div>
        </motion.div>
    );
}

function EditFolderModal({ folder, onClose, onSave }: { folder: FileFolder; onClose: () => void; onSave: (f: FileFolder, changes: Partial<FileFolder>) => void }) {
    const [name, setName] = useState(folder.name);
    const [color, setColor] = useState(folder.color);

    return (
        <motion.div
            className="fixed inset-0 z-[250] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={onClose}
        >
            <motion.div
                className="bg-white rounded-2xl shadow-xl w-full max-w-md"
                initial={{ scale: 0.95 }} animate={{ scale: 1 }}
                onClick={e => e.stopPropagation()}
            >
                <div className="p-5 border-b border-surface-100">
                    <h3 className="font-bold text-surface-900 flex items-center gap-2">
                        <Edit2 className="w-5 h-5 text-brand-500" />
                        Edit Folder
                    </h3>
                </div>
                <div className="p-5 space-y-4">
                    <div className="form-group">
                        <label className="form-label">Name</label>
                        <input type="text" value={name} onChange={e => setName(e.target.value)} className="form-input" />
                    </div>
                    <div>
                        <label className="form-label mb-2 block">Color</label>
                        <div className="flex gap-2 flex-wrap">
                            {COLOR_SWATCHES.map(c => {
                                const colors = FOLDER_COLORS[c];
                                return (
                                    <button key={c} onClick={() => setColor(c)}
                                        className={`w-10 h-10 rounded-xl ${colors.bg} flex items-center justify-center transition-all ${
                                            color === c ? `ring-2 ${colors.ring} ring-offset-2` : 'hover:scale-110'
                                        }`}>
                                        <Folder className={`w-5 h-5 ${colors.icon}`} fill="currentColor" />
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                </div>
                <div className="flex justify-end gap-2 p-5 border-t border-surface-100">
                    <button onClick={onClose} className="btn-ghost">Cancel</button>
                    <button onClick={() => onSave(folder, { name, color })} disabled={!name.trim()} className="btn-primary">
                        Save Changes
                    </button>
                </div>
            </motion.div>
        </motion.div>
    );
}
