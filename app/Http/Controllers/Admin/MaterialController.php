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
            // Pull from the master so unused categories still appear in the filter
            // dropdown — gives admins a true picture of what's defined.
            'categories' => \App\Models\MaterialCategory::active()->orderBy('display_order')->orderBy('name')->pluck('code'),
        ]);
    }

    public function create()
    {
        return Inertia::render('Admin/Materials/CreateEdit', [
            'categories' => \App\Models\MaterialCategory::active()->orderBy('display_order')->orderBy('name')->get(['code', 'name']),
        ]);
    }

    public function store(Request $request)
    {
        $validated = $this->validateMaterial($request);
        $validated['density_kg_in3'] = $this->deriveKgIn3($validated['density_kg_m3'] ?? null);
        Material::create($validated);
        return redirect()->route('admin.materials.index')->with('success', 'Material created.');
    }

    public function edit(Material $material)
    {
        return Inertia::render('Admin/Materials/CreateEdit', [
            'material' => $material->only([
                'id', 'name', 'category', 'unit', 'rate_per_kg', 'density_kg_m3', 'density_kg_in3', 'notes', 'is_active',
            ]),
            'categories' => \App\Models\MaterialCategory::active()->orderBy('display_order')->orderBy('name')->get(['code', 'name']),
        ]);
    }

    public function update(Request $request, Material $material)
    {
        $validated = $this->validateMaterial($request, $material->id);
        $validated['density_kg_in3'] = $this->deriveKgIn3($validated['density_kg_m3'] ?? null);
        $material->update($validated);
        return redirect()->route('admin.materials.index')->with('success', 'Material updated.');
    }

    /**
     * Keep kg/In³ in lockstep with kg/m³ so the costing sheet never sees the
     * two diverge. 1 m³ = 61023.744 in³, so kg/in³ = kg/m³ ÷ 61023.744.
     * Per BITAC master file's Materials Rate sheet, EN-24 @ 7850 kg/m³ → 0.1286 kg/In³.
     */
    private function deriveKgIn3(?float $kgM3): ?float
    {
        if ($kgM3 === null || $kgM3 <= 0) return null;
        return round($kgM3 / 61023.7440947, 5);
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
