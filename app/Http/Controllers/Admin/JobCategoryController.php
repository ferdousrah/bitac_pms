<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\JobCategory;
use Illuminate\Http\Request;
use Inertia\Inertia;

class JobCategoryController extends Controller
{
    public function index(Request $request)
    {
        $query = JobCategory::query();
        if ($search = $request->input('search')) {
            $query->where(function ($q) use ($search) {
                $q->where('name', 'like', "%{$search}%")->orWhere('code', 'like', "%{$search}%");
            });
        }
        $categories = $query->orderBy('display_order')->orderBy('name')->paginate(30)->withQueryString();

        return Inertia::render('Admin/JobCategories/Index', [
            'categories' => $categories,
            'filters'    => $request->only(['search']),
        ]);
    }

    public function create()
    {
        return Inertia::render('Admin/JobCategories/CreateEdit');
    }

    public function store(Request $request)
    {
        $validated = $this->validateInput($request);
        JobCategory::create($validated);
        return redirect()->route('admin.job-categories.index')->with('success', 'Job category created.');
    }

    public function edit(JobCategory $jobCategory)
    {
        return Inertia::render('Admin/JobCategories/CreateEdit', [
            'category' => $jobCategory->only(['id', 'name', 'code', 'description', 'display_order', 'is_active']),
        ]);
    }

    public function update(Request $request, JobCategory $jobCategory)
    {
        $validated = $this->validateInput($request, $jobCategory->id);
        $jobCategory->update($validated);
        return redirect()->route('admin.job-categories.index')->with('success', 'Job category updated.');
    }

    public function destroy(JobCategory $jobCategory)
    {
        // Prevent delete when in use; soft-block by deactivating instead.
        $inUse = $jobCategory->rfqs()->exists() || $jobCategory->quotations()->exists() || $jobCategory->workOrders()->exists();
        if ($inUse) {
            $jobCategory->update(['is_active' => false]);
            return back()->with('success', 'Category is in use — deactivated instead of deleted.');
        }
        $jobCategory->delete();
        return back()->with('success', 'Job category deleted.');
    }

    private function validateInput(Request $request, ?int $id = null): array
    {
        // Job categories are scoped per-center (HasCenter), so uniqueness
        // should also be per-center — two centres can run a "Material" category
        // independently without clashing on the global table.
        $centerId = app()->bound('current_center_id') ? app('current_center_id') : null;

        return $request->validate([
            'name'          => [
                'required', 'string', 'max:120',
                \Illuminate\Validation\Rule::unique('job_categories', 'name')
                    ->where(fn ($q) => $centerId ? $q->where('center_id', $centerId) : $q)
                    ->ignore($id),
            ],
            'code'          => 'nullable|string|max:32',
            'description'   => 'nullable|string|max:500',
            'display_order' => 'nullable|integer|min:0',
            'is_active'     => 'boolean',
        ]);
    }
}
