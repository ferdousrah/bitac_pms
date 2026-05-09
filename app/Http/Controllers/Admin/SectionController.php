<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Section;
use Illuminate\Http\Request;
use Inertia\Inertia;

class SectionController extends Controller
{
    public function index()
    {
        $sections = Section::orderBy('display_order')
            ->withCount(['machines', 'operators'])
            ->get()
            ->map(fn($s) => [
                'id'            => $s->id,
                'code'          => $s->code,
                'name'          => $s->name,
                'name_bn'       => $s->name_bn,
                'type'          => $s->type,
                'description'   => $s->description,
                'display_order' => $s->display_order,
                'is_active'     => $s->is_active,
                'machines_count'  => $s->machines_count,
                'operators_count' => $s->operators_count,
            ]);

        return Inertia::render('Admin/Sections/Index', [
            'sections' => $sections,
        ]);
    }

    public function create()
    {
        return Inertia::render('Admin/Sections/CreateEdit');
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'code'          => 'required|string|max:30|unique:sections,code|alpha_dash',
            'name'          => 'required|string|max:100',
            'name_bn'       => 'nullable|string|max:100',
            'type'          => 'required|in:functional,production_shop',
            'description'   => 'nullable|string|max:500',
            'display_order' => 'nullable|integer|min:0',
            'is_active'     => 'boolean',
        ]);

        $validated['code'] = strtoupper($validated['code']);
        $validated['display_order'] = $validated['display_order'] ?? (Section::max('display_order') + 1);

        Section::create($validated);

        return redirect()->route('admin.sections.index')->with('success', 'Section created successfully.');
    }

    public function edit(Section $section)
    {
        return Inertia::render('Admin/Sections/CreateEdit', [
            'section' => $section->only([
                'id', 'code', 'name', 'name_bn', 'type', 'description', 'display_order', 'is_active',
            ]),
        ]);
    }

    public function update(Request $request, Section $section)
    {
        $validated = $request->validate([
            'code'          => 'required|string|max:30|alpha_dash|unique:sections,code,' . $section->id,
            'name'          => 'required|string|max:100',
            'name_bn'       => 'nullable|string|max:100',
            'type'          => 'required|in:functional,production_shop',
            'description'   => 'nullable|string|max:500',
            'display_order' => 'nullable|integer|min:0',
            'is_active'     => 'boolean',
        ]);

        $validated['code'] = strtoupper($validated['code']);
        $section->update($validated);

        return redirect()->route('admin.sections.index')->with('success', 'Section updated.');
    }

    public function destroy(Section $section)
    {
        if ($section->machines()->exists() || $section->operators()->exists()) {
            return back()->with('error', 'Cannot delete: section has machines or operators assigned.');
        }
        $section->delete();
        return redirect()->route('admin.sections.index')->with('success', 'Section deleted.');
    }
}
