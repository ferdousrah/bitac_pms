<?php

namespace App\Http\Controllers;

use App\Models\User;
use App\Models\WorkOrder;
use App\Models\WorkOrderFile;
use App\Services\NotifyService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;

/**
 * Production photos, and PCD completing a job with them (BITAC, 2026-10-24:
 * "Production photo (multiple) mandatory to complete a job, PCD have to
 * submit to complete the job").
 *
 * - The shop (from its job page) and PCD (from the job detail) add photos at
 *   any time while the job is open, each with an optional caption.
 * - PCD completes the job once it is FULLY delivered and has at least
 *   WorkOrder::MIN_COMPLETION_PHOTOS photos. The status stays `delivered`;
 *   completion is the `completed_at` / `completed_by` / `completion_note`
 *   stamp, so nothing that treats delivered as the end of a job changes.
 * - Once completed the photos are locked — the job is on record as closed.
 */
class JobCompletionController extends Controller
{
    /** What both pages render: the photos, and where completion stands. */
    public static function pack(WorkOrder $wo, ?User $viewer = null): array
    {
        $wo->loadMissing('productionPhotos.uploadedBy', 'completedBy');
        $viewer ??= auth()->user();
        $isPcd = $viewer && $viewer->can('view pcd-inbox');
        $open = ! $wo->completed_at;

        return [
            'min'       => WorkOrder::MIN_COMPLETION_PHOTOS,
            'locked'    => ! $open,
            'photos'    => $wo->productionPhotos->map(fn (WorkOrderFile $f) => [
                'id'          => $f->id,
                'url'         => $f->url,
                'caption'     => $f->title,
                'filename'    => $f->original_name,
                'uploaded_by' => $f->uploadedBy?->name,
                'uploaded_at' => $f->created_at?->format('d M Y, h:i A'),
                'can_delete'  => $open && $viewer && ($isPcd || (int) $f->uploaded_by === (int) $viewer->id),
            ])->values(),
            'completed' => $wo->completed_at ? [
                'at'   => $wo->completed_at->format('d M Y, h:i A'),
                'by'   => $wo->completedBy?->name,
                'note' => $wo->completion_note,
            ] : null,
            // Only PCD's page acts on this; the shop just sees the photos.
            'blocker'   => $open ? self::completionBlocker($wo) : null,
        ];
    }

    /** Why the job cannot be completed yet, in plain words — or null. */
    public static function completionBlocker(WorkOrder $wo): ?string
    {
        if ($wo->completed_at) {
            return 'This job was already completed on ' . $wo->completed_at->format('d M Y') . '.';
        }
        if ($wo->status !== 'delivered') {
            $ordered = (float) $wo->quantity;
            $done = (float) $wo->deliveredQty();

            return $wo->status === 'cancelled'
                ? 'This job was cancelled.'
                : 'A job is completed once it is fully delivered — '
                    . rtrim(rtrim(number_format($done, 3, '.', ''), '0'), '.') . ' of '
                    . rtrim(rtrim(number_format($ordered, 3, '.', ''), '0'), '.') . ' delivered so far.';
        }
        $have = $wo->productionPhotos()->count();
        if ($have < WorkOrder::MIN_COMPLETION_PHOTOS) {
            $need = WorkOrder::MIN_COMPLETION_PHOTOS - $have;

            return "Add {$need} more production photo" . ($need > 1 ? 's' : '')
                . ' — at least ' . WorkOrder::MIN_COMPLETION_PHOTOS . ' are needed to complete the job.';
        }

        return null;
    }

    /**
     * Store uploaded photos on a job. Shared by the shop's door
     * (ProductionController, behind its own access check) and PCD's.
     */
    public static function savePhotos(Request $request, WorkOrder $wo): RedirectResponse
    {
        if ($wo->completed_at) {
            return back()->with('error', 'This job is completed — its photos are locked.');
        }
        if ($wo->status === 'cancelled') {
            return back()->with('error', 'This job was cancelled.');
        }

        $request->validate([
            'photos'     => 'required|array|min:1|max:10',
            'photos.*'   => 'image|mimes:jpg,jpeg,png,webp|max:10240',
            'captions'   => 'nullable|array',
            'captions.*' => 'nullable|string|max:150',
        ], [
            'photos.required'  => 'Pick at least one photo.',
            'photos.max'       => 'Upload at most 10 photos at a time.',
            'photos.*.image'   => 'Only photos can be added here (JPG, PNG or WebP).',
            'photos.*.mimes'   => 'Only photos can be added here (JPG, PNG or WebP).',
            'photos.*.max'     => 'Each photo must be under 10 MB.',
        ]);

        $captions = $request->input('captions', []);
        $n = 0;
        foreach ($request->file('photos', []) as $i => $file) {
            $caption = trim((string) ($captions[$i] ?? ''));
            $wo->files()->create([
                'uploaded_by'   => auth()->id(),
                'kind'          => WorkOrderFile::PRODUCTION_PHOTO,
                'stored_path'   => $file->store("work-orders/{$wo->id}/photos", 'public'),
                'original_name' => $file->getClientOriginalName(),
                'title'         => $caption !== '' ? $caption : null,
                'mime_type'     => $file->getMimeType(),
                'size_bytes'    => $file->getSize(),
                'description'   => 'Production photo',
            ]);
            $n++;
        }

        return back()->with('success', "{$n} photo" . ($n > 1 ? 's' : '') . ' added.');
    }

    /** PCD's door for adding photos (route is behind view pcd-inbox). */
    public function storeForPcd(Request $request, WorkOrder $workOrder): RedirectResponse
    {
        return self::savePhotos($request, $workOrder);
    }

    /** Remove a photo: whoever added it, or PCD — never once the job is completed. */
    public function destroy(Request $request, WorkOrderFile $file): RedirectResponse
    {
        abort_unless($file->kind === WorkOrderFile::PRODUCTION_PHOTO, 404);
        $wo = $file->workOrder;
        $user = $request->user();

        if ($wo?->completed_at) {
            return back()->with('error', 'This job is completed — its photos are locked.');
        }
        if ((int) $file->uploaded_by !== (int) $user->id && ! $user->can('view pcd-inbox') && ! $user->isSuperAdmin()) {
            return back()->with('error', 'Only whoever added this photo, or PCD, can remove it.');
        }

        Storage::disk('public')->delete($file->stored_path);
        $file->delete();

        return back()->with('success', 'Photo removed.');
    }

    /** PCD completes a fully delivered job that has its photos. */
    public function complete(Request $request, WorkOrder $workOrder): RedirectResponse
    {
        $data = $request->validate(['note' => 'nullable|string|max:1000']);

        if ($why = self::completionBlocker($workOrder)) {
            return back()->with('error', $why);
        }

        $workOrder->update([
            'completed_at'    => now(),
            'completed_by'    => $request->user()->id,
            'completion_note' => trim((string) ($data['note'] ?? '')) ?: null,
        ]);

        // IED keeps the client side of the job (its completion certificate
        // among it), so IED hears that the job is closed.
        $job = $workOrder->job_number ? "Job {$workOrder->job_number}" : $workOrder->wo_number;
        NotifyService::toPermission('view rfqs', 'job_completed', "{$job} completed",
            "{$job} ({$workOrder->customer?->name}) was completed by PCD with "
                . $workOrder->productionPhotos()->count() . ' production photos — ' . $request->user()->name,
            "/ied/jobs/{$workOrder->id}", 'fi-rr-badge-check', 'green', centerId: $workOrder->center_id);

        return back()->with('success', "{$job} completed.");
    }
}
