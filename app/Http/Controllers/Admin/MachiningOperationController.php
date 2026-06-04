<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\MachiningOperation;
use App\Models\Section;
use Illuminate\Http\Request;
use Inertia\Inertia;

class MachiningOperationController extends Controller
{
    public function index(Request $request)
    {
        $query = MachiningOperation::with('section');
        if ($search = $request->input('search')) {
            $query->where('name', 'like', "%{$search}%");
        }
        if ($category = $request->input('category')) {
            $query->where('category', $category);
        }

        $operations = $query->orderBy('display_order')->orderBy('name')->paginate(30)->withQueryString();

        return Inertia::render('Admin/Operations/Index', [
            'operations' => $operations,
            'filters'    => $request->only(['search', 'category']),
            'categories' => ['machining', 'casting', 'plating', 'heat_treatment', 'surface_treatment', 'fabrication', 'other'],
        ]);
    }

    public function create()
    {
        return Inertia::render('Admin/Operations/CreateEdit', [
            'sections' => Section::active()->orderBy('display_order')->get(['id', 'name', 'code']),
        ]);
    }

    public function store(Request $request)
    {
        $validated = $this->validateOperation($request);
        MachiningOperation::create($validated);
        return redirect()->route('admin.operations.index')->with('success', 'Operation created.');
    }

    public function edit(MachiningOperation $operation)
    {
        return Inertia::render('Admin/Operations/CreateEdit', [
            'operation' => $operation->only([
                'id', 'name', 'category', 'default_unit',
                'rate_group_a', 'rate_group_b', 'rate_group_c', 'rate_group_student', 'rate_group_public',
                'section_id', 'notes', 'is_active', 'display_order',
            ]),
            'sections' => Section::active()->orderBy('display_order')->get(['id', 'name', 'code']),
        ]);
    }

    public function update(Request $request, MachiningOperation $operation)
    {
        $validated = $this->validateOperation($request);
        $operation->update($validated);
        return redirect()->route('admin.operations.index')->with('success', 'Operation updated.');
    }

    public function destroy(MachiningOperation $operation)
    {
        $operation->delete();
        return back()->with('success', 'Operation deleted.');
    }

    private function validateOperation(Request $request): array
    {
        return $request->validate([
            'name'         => 'required|string|max:150',
            'category'     => 'required|in:machining,casting,plating,heat_treatment,surface_treatment,fabrication,other',
            'default_unit' => 'required|string|max:20',
            'rate_group_a'       => 'nullable|numeric|min:0',
            'rate_group_b'       => 'nullable|numeric|min:0',
            'rate_group_c'       => 'nullable|numeric|min:0',
            'rate_group_student' => 'nullable|numeric|min:0',
            'rate_group_public'  => 'nullable|numeric|min:0',
            'section_id'   => 'nullable|exists:sections,id',
            'notes'        => 'nullable|string|max:255',
            'is_active'    => 'boolean',
            'display_order'=> 'nullable|integer|min:0',
        ]);
    }
}
