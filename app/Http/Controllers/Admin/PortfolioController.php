<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\PortfolioPhoto;
use App\Models\PortfolioProject;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Inertia\Inertia;

class PortfolioController extends Controller
{
    public function index(Request $request)
    {
        $query = PortfolioProject::with('photos')->orderBy('display_order')->orderByDesc('id');

        if ($search = $request->input('search')) {
            $query->where(function ($q) use ($search) {
                $q->where('title', 'like', "%{$search}%")
                  ->orWhere('client_name', 'like', "%{$search}%")
                  ->orWhere('category', 'like', "%{$search}%");
            });
        }

        return Inertia::render('Admin/Portfolio/Index', [
            'projects' => $query->paginate(20)->through(fn($p) => [
                'id'              => $p->id,
                'slug'            => $p->slug,
                'title'           => $p->title,
                'client_name'     => $p->client_name,
                'category'        => $p->category,
                'summary'         => $p->summary,
                'completed_at'    => $p->completed_at?->format('d M Y'),
                'is_published'    => (bool) $p->is_published,
                'display_order'   => $p->display_order,
                'cover_image_url' => $p->cover_image_url,
                'photo_count'     => $p->photos->count(),
            ]),
            'filters' => ['search' => $request->input('search', '')],
        ]);
    }

    public function create()
    {
        return Inertia::render('Admin/Portfolio/CreateEdit', [
            'project' => null,
        ]);
    }

    public function store(Request $request)
    {
        $validated = $this->validateProject($request);

        $project = DB::transaction(function () use ($validated, $request) {
            $cover = $request->hasFile('cover_image')
                ? $request->file('cover_image')->store('portfolio/covers', 'public')
                : null;

            $p = PortfolioProject::create([
                'title'            => $validated['title'],
                'slug'             => PortfolioProject::generateUniqueSlug($validated['title']),
                'client_name'      => $validated['client_name'] ?? null,
                'category'         => $validated['category'] ?? null,
                'summary'          => $validated['summary'] ?? null,
                'description'      => $validated['description'] ?? null,
                'specs'            => $this->cleanSpecs($validated['specs'] ?? []),
                'completed_at'     => $validated['completed_at'] ?? null,
                'is_published'     => $request->boolean('is_published'),
                'display_order'    => (int) ($validated['display_order'] ?? 0),
                'cover_image_path' => $cover,
                'created_by'       => auth()->id(),
            ]);

            $this->savePhotos($p, $request);
            return $p;
        });

        return redirect()->route('admin.portfolio.index')
            ->with('success', 'Project created.');
    }

    public function edit(PortfolioProject $portfolio)
    {
        $portfolio->load('photos');

        return Inertia::render('Admin/Portfolio/CreateEdit', [
            'project' => [
                'id'              => $portfolio->id,
                'slug'            => $portfolio->slug,
                'title'           => $portfolio->title,
                'client_name'     => $portfolio->client_name,
                'category'        => $portfolio->category,
                'summary'         => $portfolio->summary,
                'description'     => $portfolio->description,
                'specs'           => $portfolio->specs ?? [],
                'completed_at'    => $portfolio->completed_at?->format('Y-m-d'),
                'is_published'    => (bool) $portfolio->is_published,
                'display_order'   => $portfolio->display_order,
                'cover_image_url' => $portfolio->cover_image_url,
                'photos'          => $portfolio->photos->map(fn($f) => [
                    'id'      => $f->id,
                    'url'     => $f->url,
                    'caption' => $f->caption,
                ])->values(),
            ],
        ]);
    }

    public function update(Request $request, PortfolioProject $portfolio)
    {
        $validated = $this->validateProject($request);

        DB::transaction(function () use ($validated, $request, $portfolio) {
            $data = [
                'title'         => $validated['title'],
                'client_name'   => $validated['client_name'] ?? null,
                'category'      => $validated['category'] ?? null,
                'summary'       => $validated['summary'] ?? null,
                'description'   => $validated['description'] ?? null,
                'specs'         => $this->cleanSpecs($validated['specs'] ?? []),
                'completed_at'  => $validated['completed_at'] ?? null,
                'is_published'  => $request->boolean('is_published'),
                'display_order' => (int) ($validated['display_order'] ?? 0),
            ];

            // Regenerate slug only when the title actually changed — keeps existing
            // public URLs stable across cosmetic edits.
            if ($validated['title'] !== $portfolio->title) {
                $data['slug'] = PortfolioProject::generateUniqueSlug($validated['title'], $portfolio->id);
            }

            // Replace cover if a new file was uploaded.
            if ($request->hasFile('cover_image')) {
                if ($portfolio->cover_image_path) {
                    Storage::disk('public')->delete($portfolio->cover_image_path);
                }
                $data['cover_image_path'] = $request->file('cover_image')->store('portfolio/covers', 'public');
            } elseif ($request->boolean('remove_cover') && $portfolio->cover_image_path) {
                Storage::disk('public')->delete($portfolio->cover_image_path);
                $data['cover_image_path'] = null;
            }

            $portfolio->update($data);

            // Append new gallery photos. Existing ones are removed individually via deletePhoto().
            $this->savePhotos($portfolio, $request);
        });

        return redirect()->route('admin.portfolio.edit', $portfolio)
            ->with('success', 'Project updated.');
    }

    public function destroy(PortfolioProject $portfolio)
    {
        // Cascade clean-up: remove cover + all gallery files before deleting the row.
        // FK on portfolio_photos handles the table-side cascade; we just clear disk.
        if ($portfolio->cover_image_path) {
            Storage::disk('public')->delete($portfolio->cover_image_path);
        }
        foreach ($portfolio->photos as $photo) {
            if ($photo->stored_path) Storage::disk('public')->delete($photo->stored_path);
        }
        $portfolio->delete();

        return back()->with('success', 'Project deleted.');
    }

    public function togglePublish(PortfolioProject $portfolio)
    {
        $portfolio->update(['is_published' => !$portfolio->is_published]);
        return back()->with('success', $portfolio->is_published ? 'Published.' : 'Unpublished.');
    }

    public function deletePhoto(PortfolioPhoto $photo)
    {
        if ($photo->stored_path) Storage::disk('public')->delete($photo->stored_path);
        $photo->delete();
        return back()->with('success', 'Photo removed.');
    }

    // ─── Helpers ─────────────────────────────────────────────────────────

    private function validateProject(Request $request): array
    {
        return $request->validate([
            'title'           => 'required|string|max:255',
            'client_name'     => 'nullable|string|max:255',
            'category'        => 'nullable|string|max:60',
            'summary'         => 'nullable|string|max:300',
            'description'     => 'nullable|string',
            'specs'           => 'nullable|array',
            'specs.*.label'   => 'nullable|string|max:60',
            'specs.*.value'   => 'nullable|string|max:255',
            'completed_at'    => 'nullable|date',
            'is_published'    => 'nullable|boolean',
            'display_order'   => 'nullable|integer|min:0',
            'cover_image'     => 'nullable|image|mimes:jpg,jpeg,png,webp|max:5120',
            'remove_cover'    => 'nullable|boolean',
            'photos'          => 'nullable|array',
            'photos.*'        => 'image|mimes:jpg,jpeg,png,webp|max:5120',
            'photo_captions'  => 'nullable|array',
            'photo_captions.*' => 'nullable|string|max:200',
        ]);
    }

    private function cleanSpecs($specs): array
    {
        return collect($specs)
            ->filter(fn($s) => is_array($s) && (trim($s['label'] ?? '') !== '' || trim($s['value'] ?? '') !== ''))
            ->map(fn($s) => [
                'label' => trim((string) ($s['label'] ?? '')),
                'value' => trim((string) ($s['value'] ?? '')),
            ])
            ->values()
            ->all();
    }

    private function savePhotos(PortfolioProject $project, Request $request): void
    {
        $files = $request->file('photos') ?? [];
        if (!is_array($files)) $files = [$files];
        $captions = $request->input('photo_captions') ?? [];
        $existingCount = $project->photos()->count();

        foreach ($files as $idx => $file) {
            if (!$file) continue;
            $path = $file->store('portfolio/gallery', 'public');
            $project->photos()->create([
                'stored_path' => $path,
                'caption'     => $captions[$idx] ?? null,
                'sort_order'  => $existingCount + $idx,
            ]);
        }
    }
}
