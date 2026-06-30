<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Section;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Inertia\Inertia;

class SectionController extends Controller
{
    public function index(Request $request)
    {
        $q = Section::withCount(['machines', 'operators', 'children']);

        if ($search = trim((string) $request->input('search'))) {
            $q->where(function ($q) use ($search) {
                $q->where('name', 'like', "%{$search}%")
                  ->orWhere('code', 'like', "%{$search}%")
                  ->orWhere('name_bn', 'like', "%{$search}%");
            });
        }
        if ($type = $request->input('type')) {
            $q->where('type', $type);
        }
        if (($status = $request->input('status')) !== null && $status !== '') {
            $q->where('is_active', $status === 'active');
        }

        $all = $q->orderBy('display_order')->get();

        // Order the list as a one-level tree: each top-level section followed by
        // its sub-sections, so the table reads hierarchically.
        $childrenByParent = $all->whereNotNull('parent_id')->groupBy('parent_id');
        $nameById = $all->pluck('name', 'id');
        $ordered = collect();
        foreach ($all->whereNull('parent_id') as $top) {
            $ordered->push($top);
            foreach ($childrenByParent->get($top->id, collect()) as $child) {
                $ordered->push($child);
            }
        }
        // Orphan sub-sections (parent filtered out) — append so nothing is hidden.
        foreach ($all->whereNotNull('parent_id') as $child) {
            if (!$ordered->contains('id', $child->id)) $ordered->push($child);
        }

        $sections = $ordered->map(fn ($s) => [
            'id'            => $s->id,
            'parent_id'     => $s->parent_id,
            'parent_name'   => $s->parent_id ? ($nameById[$s->parent_id] ?? null) : null,
            'is_sub'        => $s->parent_id !== null,
            'code'          => $s->code,
            'name'          => $s->name,
            'name_bn'       => $s->name_bn,
            'type'          => $s->type,
            'description'   => $s->description,
            'display_order' => $s->display_order,
            'is_active'     => $s->is_active,
            'machines_count'  => $s->machines_count,
            'operators_count' => $s->operators_count,
            'children_count'  => $s->children_count,
        ])->values();

        return Inertia::render('Admin/Sections/Index', [
            'sections' => $sections,
            'filters'  => $request->only(['search', 'type', 'status']),
        ]);
    }

    public function create()
    {
        return Inertia::render('Admin/Sections/CreateEdit', [
            'parents' => $this->parentOptions(),
        ]);
    }

    public function store(Request $request)
    {
        $validated = $this->validateSection($request, null);

        $validated['code'] = strtoupper($validated['code']);
        $validated['display_order'] = $validated['display_order'] ?? (Section::max('display_order') + 1);

        Section::create($validated);

        return redirect()->route('admin.sections.index')->with('success', 'Section created successfully.');
    }

    public function edit(Section $section)
    {
        return Inertia::render('Admin/Sections/CreateEdit', [
            'section' => $section->only([
                'id', 'parent_id', 'code', 'name', 'name_bn', 'type', 'description', 'display_order', 'is_active',
            ]),
            // A section that itself has sub-sections cannot become a sub-section.
            'parents'       => $this->parentOptions($section->id),
            'has_children'  => $section->children()->exists(),
        ]);
    }

    public function update(Request $request, Section $section)
    {
        $validated = $this->validateSection($request, $section);

        $validated['code'] = strtoupper($validated['code']);
        $section->update($validated);

        return redirect()->route('admin.sections.index')->with('success', 'Section updated.');
    }

    public function destroy(Section $section)
    {
        if ($section->children()->exists()) {
            return back()->with('error', 'Cannot delete: section has sub-sections. Remove them first.');
        }
        if ($section->machines()->exists() || $section->operators()->exists()) {
            return back()->with('error', 'Cannot delete: section has machines or operators assigned.');
        }
        $section->delete();
        return redirect()->route('admin.sections.index')->with('success', 'Section deleted.');
    }

    // ── Helpers ──────────────────────────────────────────────────────────────

    /** Top-level production shops that can be a sub-section's parent. */
    private function parentOptions(?int $excludeId = null)
    {
        return Section::topLevel()
            ->where('type', 'production_shop')
            ->when($excludeId, fn ($q) => $q->where('id', '!=', $excludeId))
            ->orderBy('display_order')
            ->get(['id', 'name', 'code']);
    }

    private function validateSection(Request $request, ?Section $section): array
    {
        $id = $section?->id;
        $validated = $request->validate([
            'parent_id'     => ['nullable', Rule::exists('sections', 'id')],
            'code'          => ['required', 'string', 'max:30', 'alpha_dash', Rule::unique('sections', 'code')->ignore($id)],
            'name'          => 'required|string|max:100',
            'name_bn'       => 'nullable|string|max:100',
            'type'          => 'required|in:functional,production_shop',
            'description'   => 'nullable|string|max:500',
            'display_order' => 'nullable|integer|min:0',
            'is_active'     => 'boolean',
        ]);

        // Sub-section rules: parent must be a top-level production shop; a section
        // cannot be its own parent, parent its own child, or become a sub-section
        // while it still has sub-sections of its own (one level deep).
        if (!empty($validated['parent_id'])) {
            $parent = Section::find($validated['parent_id']);
            abort_unless($parent, 422);
            if ($id && (int) $validated['parent_id'] === $id) {
                throw \Illuminate\Validation\ValidationException::withMessages(['parent_id' => 'A section cannot be its own parent.']);
            }
            if ($parent->parent_id !== null || $parent->type !== 'production_shop') {
                throw \Illuminate\Validation\ValidationException::withMessages(['parent_id' => 'Parent must be a top-level production shop.']);
            }
            if ($section && $section->children()->exists()) {
                throw \Illuminate\Validation\ValidationException::withMessages(['parent_id' => 'This section has sub-sections, so it cannot become one.']);
            }
            // A sub-section is always part of a production shop.
            $validated['type'] = 'production_shop';
        }

        return $validated;
    }
}
