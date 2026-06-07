<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\GatePassConditionNote;
use Illuminate\Http\Request;
use Inertia\Inertia;

class GatePassConditionNoteController extends Controller
{
    public function index(Request $request)
    {
        $q = GatePassConditionNote::query();
        if ($search = trim((string) $request->input('search'))) {
            $q->where('label', 'like', "%{$search}%");
        }
        $notes = $q->orderBy('display_order')->orderBy('label')
            ->paginate(30)->withQueryString();

        return Inertia::render('Admin/GatePassConditionNotes/Index', [
            'notes'   => $notes,
            'filters' => $request->only(['search']),
        ]);
    }

    public function create()
    {
        return Inertia::render('Admin/GatePassConditionNotes/CreateEdit');
    }

    public function store(Request $request)
    {
        GatePassConditionNote::create($this->validateInput($request));
        return redirect()->route('admin.gate-pass-condition-notes.index')->with('success', 'Condition note added.');
    }

    public function edit(GatePassConditionNote $gatePassConditionNote)
    {
        return Inertia::render('Admin/GatePassConditionNotes/CreateEdit', [
            'note' => $gatePassConditionNote->only(['id', 'label', 'display_order', 'is_active']),
        ]);
    }

    public function update(Request $request, GatePassConditionNote $gatePassConditionNote)
    {
        $gatePassConditionNote->update($this->validateInput($request, $gatePassConditionNote->id));
        return redirect()->route('admin.gate-pass-condition-notes.index')->with('success', 'Condition note updated.');
    }

    public function destroy(GatePassConditionNote $gatePassConditionNote)
    {
        $gatePassConditionNote->delete();
        return back()->with('success', 'Condition note deleted.');
    }

    private function validateInput(Request $request, ?int $id = null): array
    {
        return $request->validate([
            'label'         => 'required|string|max:150|unique:gate_pass_condition_notes,label' . ($id ? ",{$id}" : ''),
            'display_order' => 'nullable|integer|min:0',
            'is_active'     => 'boolean',
        ]);
    }
}
