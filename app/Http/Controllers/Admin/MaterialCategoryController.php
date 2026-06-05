<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\MaterialCategory;
use Illuminate\Http\Request;
use Inertia\Inertia;

class MaterialCategoryController extends Controller
{
    public function index(Request $request)
    {
        $q = MaterialCategory::query()->withCount('materials');
        if ($search = trim((string) $request->input('search'))) {
            $q->where(fn ($q) => $q->where('name', 'like', "%{$search}%")
                                   ->orWhere('code', 'like', "%{$search}%"));
        }
        $categories = $q->orderBy('display_order')->orderBy('name')
            ->paginate(30)->withQueryString();

        return Inertia::render('Admin/MaterialCategories/Index', [
            'categories' => $categories,
            'filters'    => $request->only(['search']),
        ]);
    }

    public function create()
    {
        return Inertia::render('Admin/MaterialCategories/CreateEdit');
    }

    public function store(Request $request)
    {
        $validated = $this->validateInput($request);
        // Auto-derive code from name if user left it blank.
        if (empty($validated['code'])) {
            $validated['code'] = str($validated['name'])->snake()->toString();
        }
        MaterialCategory::create($validated);
        return redirect()->route('admin.material-categories.index')->with('success', 'Category created.');
    }

    public function edit(MaterialCategory $materialCategory)
    {
        return Inertia::render('Admin/MaterialCategories/CreateEdit', [
            'category' => $materialCategory->only(['id', 'code', 'name', 'description', 'display_order', 'is_active']),
        ]);
    }

    public function update(Request $request, MaterialCategory $materialCategory)
    {
        $validated = $this->validateInput($request, $materialCategory->id);
        $materialCategory->update($validated);
        return redirect()->route('admin.material-categories.index')->with('success', 'Category updated.');
    }

    public function destroy(MaterialCategory $materialCategory)
    {
        // Soft-block: if any material uses this category, deactivate instead of delete.
        $inUse = $materialCategory->materials()->exists();
        if ($inUse) {
            $materialCategory->update(['is_active' => false]);
            return back()->with('success', 'Category is in use by materials — deactivated instead of deleted.');
        }
        $materialCategory->delete();
        return back()->with('success', 'Category deleted.');
    }

    private function validateInput(Request $request, ?int $id = null): array
    {
        return $request->validate([
            'name'          => 'required|string|max:100',
            'code'          => 'nullable|string|max:50|alpha_dash|unique:material_categories,code' . ($id ? ",{$id}" : ''),
            'description'   => 'nullable|string|max:500',
            'display_order' => 'nullable|integer|min:0',
            'is_active'     => 'boolean',
        ]);
    }
}
