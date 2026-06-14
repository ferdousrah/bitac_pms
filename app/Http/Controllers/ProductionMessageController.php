<?php

namespace App\Http\Controllers;

use App\Models\OperationSheet;
use App\Models\ProductionMessage;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;

class ProductionMessageController extends Controller
{
    /**
     * GET /operation-sheets/{sheet}/messages → list every message for this sheet.
     * Used by both sides (PCD and Production) to poll the latest state.
     */
    public function index(OperationSheet $sheet)
    {
        $messages = $sheet->messages()
            ->with(['author', 'section', 'files'])
            ->orderBy('created_at')
            ->get()
            ->map(fn ($m) => $this->serialize($m))
            ->values();

        return response()->json(['messages' => $messages]);
    }

    /**
     * POST /operation-sheets/{sheet}/messages
     * Author role is inferred from the user's section assignment:
     *   - user with section_id of a production shop → 'production'
     *   - everyone else (PCD planners, admins) → 'pcd'
     * Section context tags the message with where it originated from (when
     * posted by Production); blank for PCD replies.
     */
    public function store(Request $request, OperationSheet $sheet)
    {
        $validated = $request->validate([
            'body'            => 'required|string|max:4000',
            'section_id'      => 'nullable|exists:sections,id',
            'attachments'     => 'nullable|array|max:4',
            'attachments.*'   => 'file|max:5120|mimes:pdf,jpg,jpeg,png,gif,webp,xls,xlsx,doc,docx',
        ]);

        $user  = auth()->user();
        $isPcd = $user->hasAnyRole(['super_admin', 'admin']) || $user->can('view pcd-inbox');
        $role  = $isPcd ? 'pcd' : 'production';

        $message = DB::transaction(function () use ($sheet, $validated, $user, $role, $request) {
            $msg = $sheet->messages()->create([
                // PCD replies don't carry section context; production posts may
                // include their user's section (or whatever frontend sends).
                'section_id'  => $role === 'pcd' ? null : ($validated['section_id'] ?? $user->section_id),
                'author_id'   => $user->id,
                'author_role' => $role,
                'body'        => $validated['body'],
            ]);

            foreach ($request->file('attachments') ?? [] as $file) {
                $path = $file->store("production-messages/{$sheet->id}", 'public');
                $msg->files()->create([
                    'stored_path'   => $path,
                    'original_name' => $file->getClientOriginalName(),
                    'mime_type'     => $file->getMimeType(),
                    'size'          => $file->getSize(),
                ]);
            }
            return $msg;
        });

        $message->load(['author', 'section', 'files']);
        return response()->json(['message' => $this->serialize($message)]);
    }

    /**
     * Stream a file inline. The popup viewer uses ?preview=base64 (JSON) to
     * dodge IDM/FDM interception; default returns the file as inline attachment.
     */
    public function attachment(Request $request, \App\Models\ProductionMessageFile $file)
    {
        abort_unless($file->stored_path && Storage::disk('public')->exists($file->stored_path), 404);

        $abs   = Storage::disk('public')->path($file->stored_path);
        $bytes = file_get_contents($abs);
        $mime  = $file->mime_type ?: (function_exists('mime_content_type') ? mime_content_type($abs) : 'application/octet-stream');

        if ($request->query('preview') === 'base64') {
            return response()->json([
                'filename' => $file->original_name,
                'mime'     => $mime,
                'size'     => strlen($bytes),
                'data'     => base64_encode($bytes),
            ]);
        }

        $disposition = $request->boolean('preview') ? 'inline' : 'attachment';
        return response($bytes, 200, [
            'Content-Type'        => $mime,
            'Content-Disposition' => $disposition . '; filename="' . $file->original_name . '"',
            'Content-Length'      => strlen($bytes),
        ]);
    }

    private function serialize(ProductionMessage $m): array
    {
        return [
            'id'           => $m->id,
            'body'         => $m->body,
            'author_role'  => $m->author_role,
            'author'       => [
                'id'          => $m->author?->id,
                'name'        => $m->author?->name ?? '—',
                'designation' => $m->author?->designation,
            ],
            'section'      => $m->section ? [
                'id'   => $m->section->id,
                'name' => $m->section->name,
                'code' => $m->section->code,
            ] : null,
            'files' => $m->files->map(fn ($f) => [
                'id'         => $f->id,
                'name'       => $f->original_name,
                'extension'  => $f->extension,
                'human_size' => $f->human_size,
                'mime'       => $f->mime_type,
                'url'        => route('production-messages.attachment', $f),
            ])->values(),
            'created_at'   => $m->created_at?->toIso8601String(),
            'created_human'=> $m->created_at?->diffForHumans(),
        ];
    }
}
