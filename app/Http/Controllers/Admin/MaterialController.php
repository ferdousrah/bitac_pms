<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Material;
use Illuminate\Http\Request;
use Inertia\Inertia;

class MaterialController extends Controller
{
    public function index(Request $request)
    {
        $query = Material::query();
        if ($search = $request->input('search')) {
            $query->where('name', 'like', "%{$search}%");
        }
        if ($category = $request->input('category')) {
            $query->where('category', $category);
        }

        $materials = $query->orderBy('name')->paginate(30)->withQueryString();

        return Inertia::render('Admin/Materials/Index', [
            'materials'  => $materials,
            'filters'    => $request->only(['search', 'category']),
            'categories' => Material::distinct()->pluck('category')->filter()->values(),
        ]);
    }

    public function create()
    {
        return Inertia::render('Admin/Materials/CreateEdit');
    }

    public function store(Request $request)
    {
        $validated = $this->validateMaterial($request);
        Material::create($validated);
        return redirect()->route('admin.materials.index')->with('success', 'Material created.');
    }

    public function edit(Material $material)
    {
        return Inertia::render('Admin/Materials/CreateEdit', [
            'material' => $material->only([
                'id', 'name', 'category', 'unit', 'rate_per_kg', 'density_kg_m3', 'notes', 'is_active',
            ]),
        ]);
    }

    public function update(Request $request, Material $material)
    {
        $validated = $this->validateMaterial($request, $material->id);
        $material->update($validated);
        return redirect()->route('admin.materials.index')->with('success', 'Material updated.');
    }

    public function destroy(Material $material)
    {
        $material->delete();
        return back()->with('success', 'Material deleted.');
    }

    private function validateMaterial(Request $request, ?int $id = null): array
    {
        return $request->validate([
            'name'           => 'required|string|max:150|unique:materials,name' . ($id ? ",{$id}" : ''),
            'category'       => 'nullable|string|max:50',
            'unit'           => 'nullable|string|max:20',
            'rate_per_kg'    => 'required|numeric|min:0',
            'density_kg_m3'  => 'nullable|numeric|min:0',
            'notes'          => 'nullable|string|max:255',
            'is_active'      => 'boolean',
        ]);
    }
}
