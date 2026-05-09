<?php

namespace App\Http\Controllers;

use App\Models\FileFolder;
use App\Models\UserFile;
use App\Services\CadConverter;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Inertia\Inertia;

class UserFileController extends Controller
{
    /**
     * Files index page — lists the user's own uploads with filters + folders.
     */
    public function index(Request $request)
    {
        $folderId = $request->input('folder');
        $userId = auth()->id();

        // Validate folder ownership
        $currentFolder = null;
        if ($folderId) {
            $currentFolder = FileFolder::where('user_id', $userId)->find($folderId);
            if (!$currentFolder) $folderId = null;
        }

        // Subfolders at current level
        $subfolders = FileFolder::where('user_id', $userId)
            ->where('parent_folder_id', $folderId)
            ->orderBy('name')
            ->get();

        // Files query — scoped to current folder (or unfiled if root)
        // When user applies category filter OR search, show ALL files (cross-folder) for easier discovery
        $category = $request->input('category');
        $search   = $request->input('search');
        $filtering = $category || $search;

        $query = UserFile::where('uploaded_by', $userId)->latest();

        if (!$filtering) {
            $query->where('folder_id', $folderId); // root = null folder_id
        }
        if ($category) $query->where('category', $category);
        if ($search)   $query->where('original_name', 'like', "%{$search}%");

        $files = $query->paginate(24)->withQueryString();

        // Stats (user's total across everything)
        $stats = [
            'total_count'     => UserFile::where('uploaded_by', $userId)->count(),
            'total_size'      => (int) UserFile::where('uploaded_by', $userId)->sum('size_bytes'),
            'drawings_count'  => UserFile::where('uploaded_by', $userId)->where('category', 'drawing')->count(),
            'images_count'    => UserFile::where('uploaded_by', $userId)
                                          ->whereIn('category', ['image', 'sample_photo'])->count(),
            'documents_count' => UserFile::where('uploaded_by', $userId)->where('category', 'document')->count(),
            'folders_count'   => FileFolder::where('user_id', $userId)->count(),
        ];

        return Inertia::render('Files/Index', [
            'files'         => $files,
            'subfolders'    => $subfolders,
            'currentFolder' => $currentFolder,
            'breadcrumb'    => $currentFolder ? $currentFolder->breadcrumb() : [],
            'stats'         => $stats,
            'filters'       => $request->only(['category', 'search', 'folder']),
        ]);
    }

    /* ─── Folder CRUD ───────────────────────────────────────────── */

    public function storeFolder(Request $request)
    {
        $data = $request->validate([
            'name'             => 'required|string|max:150',
            'parent_folder_id' => 'nullable|exists:file_folders,id',
            'color'            => 'nullable|in:indigo,blue,emerald,amber,rose,slate,purple,orange',
            'description'      => 'nullable|string|max:500',
        ]);

        // Enforce parent ownership
        if (!empty($data['parent_folder_id'])) {
            $parent = FileFolder::where('user_id', auth()->id())->find($data['parent_folder_id']);
            if (!$parent) return response()->json(['error' => 'Parent folder not found.'], 404);
        }

        $folder = FileFolder::create([
            ...$data,
            'user_id' => auth()->id(),
            'color'   => $data['color'] ?? 'indigo',
        ]);

        return response()->json(['folder' => $folder]);
    }

    public function updateFolder(Request $request, FileFolder $folder)
    {
        if ($folder->user_id !== auth()->id()) {
            return response()->json(['error' => 'Forbidden'], 403);
        }
        $data = $request->validate([
            'name'        => 'sometimes|string|max:150',
            'color'       => 'sometimes|in:indigo,blue,emerald,amber,rose,slate,purple,orange',
            'description' => 'sometimes|nullable|string|max:500',
        ]);
        $folder->update($data);
        return response()->json(['folder' => $folder->fresh()]);
    }

    public function destroyFolder(Request $request, FileFolder $folder)
    {
        if ($folder->user_id !== auth()->id()) {
            return response()->json(['error' => 'Forbidden'], 403);
        }

        $action = $request->input('action', 'move_to_root'); // 'move_to_root' or 'delete_files'

        if ($action === 'delete_files') {
            // Delete files inside recursively
            $this->deleteFolder($folder);
        } else {
            // Move contents to parent folder (null = root)
            $folder->files()->update(['folder_id' => $folder->parent_folder_id]);
            $folder->children()->update(['parent_folder_id' => $folder->parent_folder_id]);
            $folder->delete();
        }

        return response()->json(['ok' => true]);
    }

    private function deleteFolder(FileFolder $folder): void
    {
        // Recursively delete child folders
        foreach ($folder->children as $child) {
            $this->deleteFolder($child);
        }
        // Delete all files in this folder
        foreach ($folder->files as $file) {
            if ($file->stored_path) Storage::disk('public')->delete($file->stored_path);
            if ($file->preview_path) Storage::disk('public')->delete($file->preview_path);
            $file->delete();
        }
        $folder->delete();
    }

    /**
     * Move one or more files to a folder.
     */
    public function moveFiles(Request $request)
    {
        $data = $request->validate([
            'file_ids'  => 'required|array|min:1',
            'file_ids.*' => 'integer|exists:user_files,id',
            'folder_id' => 'nullable|exists:file_folders,id',
        ]);

        // Verify target folder ownership
        if (!empty($data['folder_id'])) {
            $folder = FileFolder::where('user_id', auth()->id())->find($data['folder_id']);
            if (!$folder) return response()->json(['error' => 'Folder not found.'], 404);
        }

        // Only move files owned by the user
        $updated = UserFile::where('uploaded_by', auth()->id())
            ->whereIn('id', $data['file_ids'])
            ->update(['folder_id' => $data['folder_id'] ?? null]);

        return response()->json(['moved' => $updated]);
    }

    public function listFolders()
    {
        $folders = FileFolder::where('user_id', auth()->id())
            ->orderBy('parent_folder_id')
            ->orderBy('name')
            ->get(['id', 'parent_folder_id', 'name', 'color']);

        return response()->json(['folders' => $folders]);
    }

    /**
     * Browse files + folders as JSON (used by FilePicker).
     */
    public function browse(Request $request)
    {
        $userId = auth()->id();
        $folderId = $request->input('folder') ?: null;
        $category = $request->input('category');
        $search = $request->input('search');
        $filtering = ($category && $category !== 'all') || $search;

        // Resolve current folder + breadcrumb
        $currentFolder = null;
        $breadcrumb = [];
        if ($folderId) {
            $currentFolder = FileFolder::where('user_id', $userId)->find($folderId);
            if ($currentFolder) {
                $breadcrumb = $currentFolder->breadcrumb();
            } else {
                $folderId = null; // fallback to root
            }
        }

        // Subfolders — only shown when NOT filtering (filtering goes cross-folder)
        $subfolders = [];
        if (!$filtering) {
            $subfolders = FileFolder::where('user_id', $userId)
                ->where('parent_folder_id', $folderId)
                ->orderBy('name')
                ->get(['id', 'parent_folder_id', 'name', 'color']);
        }

        // Files query
        $query = UserFile::where('uploaded_by', $userId)->latest();
        if (!$filtering) {
            $query->where('folder_id', $folderId);
        }
        if ($category && $category !== 'all') $query->where('category', $category);
        if ($search) $query->where('original_name', 'like', "%{$search}%");

        return response()->json([
            'files'         => $query->limit(60)->get(),
            'subfolders'    => $subfolders,
            'currentFolder' => $currentFolder,
            'breadcrumb'    => $breadcrumb,
            'is_filtering'  => $filtering,
        ]);
    }

    /**
     * Upload a new file and register it in user_files.
     */
    public function store(Request $request)
    {
        $request->validate([
            'file'        => 'required|file|max:20480', // 20 MB
            'category'    => 'nullable|in:drawing,sample_photo,image,document,other',
            'description' => 'nullable|string|max:500',
            'folder_id'   => 'nullable|exists:file_folders,id',
        ]);

        // Validate folder ownership if provided
        $folderId = $request->input('folder_id');
        if ($folderId) {
            $folder = FileFolder::where('user_id', auth()->id())->find($folderId);
            if (!$folder) $folderId = null;
        }

        $file = $request->file('file');
        $category = $request->input('category') ?: $this->detectCategory($file->getMimeType(), $file->getClientOriginalExtension());

        // Store in category-specific folder
        $folder = match ($category) {
            'drawing'      => 'user-files/drawings',
            'sample_photo' => 'user-files/samples',
            'image'        => 'user-files/images',
            'document'     => 'user-files/documents',
            default        => 'user-files/other',
        };
        $storedPath = $file->store($folder, 'public');

        $userFile = UserFile::create([
            'uploaded_by'   => auth()->id(),
            'folder_id'     => $folderId,
            'original_name' => $file->getClientOriginalName(),
            'stored_path'   => $storedPath,
            'mime_type'     => $file->getMimeType(),
            'extension'     => strtolower($file->getClientOriginalExtension()),
            'size_bytes'    => $file->getSize(),
            'category'      => $category,
            'description'   => $request->input('description'),
        ]);

        // Auto-generate preview for DWG (since browsers can't render DWG)
        // DXF is rendered in-browser, so no server preview needed
        $ext = strtolower($userFile->extension);
        if ($ext === 'dwg') {
            $converter = app(CadConverter::class);
            if ($converter->isAvailable()) {
                $converter->generatePreview($userFile);
                $userFile->refresh();
            } else {
                $userFile->update([
                    'preview_status' => 'failed',
                    'preview_error'  => 'LibreOffice not installed. Install it to enable DWG previews.',
                ]);
            }
        }

        return response()->json(['file' => $userFile]);
    }

    /**
     * Manually trigger preview generation for a file.
     */
    public function generatePreview(UserFile $file)
    {
        if ($file->uploaded_by !== auth()->id()) {
            return response()->json(['error' => 'Forbidden'], 403);
        }

        $converter = app(CadConverter::class);
        if (!$converter->isAvailable()) {
            return response()->json([
                'error' => 'LibreOffice is not installed on the server. Install it to enable DWG/CAD previews.',
                'libreoffice_available' => false,
            ], 422);
        }

        $converter->generatePreview($file);
        return response()->json(['file' => $file->fresh()]);
    }

    /**
     * Diagnostic endpoint — checks if LibreOffice is installed.
     */
    public function converterStatus()
    {
        $converter = app(CadConverter::class);
        $path = $converter->detectLibreOfficePath();
        return response()->json([
            'libreoffice_available' => $path !== null,
            'libreoffice_path'      => $path,
        ]);
    }

    /**
     * Delete a file (if owned by the user).
     */
    public function destroy(UserFile $file)
    {
        if ($file->uploaded_by !== auth()->id()) {
            return response()->json(['error' => 'Forbidden'], 403);
        }

        // Delete from disk
        if ($file->stored_path) {
            Storage::disk('public')->delete($file->stored_path);
        }
        $file->delete();

        return response()->json(['ok' => true]);
    }

    /**
     * Heuristic to guess the file category from MIME + extension.
     */
    private function detectCategory(string $mime, string $ext): string
    {
        $ext = strtolower($ext);
        if (in_array($ext, ['dwg', 'dxf'])) return 'drawing';
        if (str_starts_with($mime, 'image/')) return 'image';
        if ($mime === 'application/pdf') return 'document';
        if (in_array($ext, ['doc', 'docx', 'xls', 'xlsx', 'pptx', 'ppt', 'odt'])) return 'document';
        return 'other';
    }
}
