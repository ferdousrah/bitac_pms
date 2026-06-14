<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\QcCheckpoint;
use Illuminate\Http\Request;
use Inertia\Inertia;

class QcCheckpointController extends Controller
{
    public function index(Request $request)
    {
        $query = QcCheckpoint::query();
        if ($search = $request->input('search')) {
            $query->where(function ($q) use ($search) {
                $q->where('name', 'like', "%{$search}%")
                  ->orWhere('category', 'like', "%{$search}%");
            });
        }
        $checkpoints = $query->orderBy('display_order')->orderBy('name')->paginate(30)->withQueryString();

        return Inertia::render('Admin/QcCheckpoints/Index', [
            'checkpoints' => $checkpoints,
            'filters'     => $request->only(['search']),
        ]);
    }

    public function create()
    {
        return Inertia::render('Admin/QcCheckpoints/CreateEdit');
    }

    public function store(Request $request)
    {
        $validated = $this->validateInput($request);
        QcCheckpoint::create($validated);
        return redirect()->route('admin.qc-checkpoints.index')->with('success', 'QC checkpoint created.');
    }

    public function edit(QcCheckpoint $qcCheckpoint)
    {
        return Inertia::render('Admin/QcCheckpoints/CreateEdit', [
            'checkpoint' => $qcCheckpoint->only(['id', 'name', 'category', 'description', 'display_order', 'is_active']),
        ]);
    }

    public function update(Request $request, QcCheckpoint $qcCheckpoint)
    {
        $validated = $this->validateInput($request, $qcCheckpoint->id);
        $qcCheckpoint->update($validated);
        return redirect()->route('admin.qc-checkpoints.index')->with('success', 'QC checkpoint updated.');
    }

    public function destroy(QcCheckpoint $qcCheckpoint)
    {
        $qcCheckpoint->delete();
        return back()->with('success', 'QC checkpoint deleted.');
    }

    private function validateInput(Request $request, ?int $id = null): array
    {
        $centerId = app()->bound('current_center_id') ? app('current_center_id') : null;

        return $request->validate([
            'name'          => [
                'required', 'string', 'max:200',
                \Illuminate\Validation\Rule::unique('qc_checkpoints', 'name')
                    ->where(fn ($q) => $centerId ? $q->where('center_id', $centerId) : $q)
                    ->ignore($id),
            ],
            'category'      => 'nullable|string|max:100',
            'description'   => 'nullable|string|max:500',
            'display_order' => 'nullable|integer|min:0',
            'is_active'     => 'boolean',
        ]);
    }
}
