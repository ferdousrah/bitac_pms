<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Sector;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Inertia\Inertia;

/**
 * Master data for client sectors — BITAC maintains the list themselves;
 * nothing is hardcoded.
 *
 * ⚠️ The list is NATIONAL (see the Sector model), so editing it changes what
 * every centre sees. That is the point — sector-wise figures have to be
 * comparable across BITAC.
 */
class SectorController extends Controller
{
    public function index(Request $request)
    {
        $query = Sector::withCount('customers');

        if ($search = trim((string) $request->input('search'))) {
            $query->where(function ($q) use ($search) {
                $q->where('name', 'like', "%{$search}%")->orWhere('code', 'like', "%{$search}%");
            });
        }
        if (in_array($request->input('applies_to'), ['government', 'private', 'both'], true)) {
            $query->where('applies_to', $request->input('applies_to'));
        }

        return Inertia::render('Admin/Sectors/Index', [
            'sectors' => $query->ordered()->paginate(30)->withQueryString(),
            'filters' => $request->only(['search', 'applies_to']),
        ]);
    }

    public function store(Request $request)
    {
        Sector::create($this->validateInput($request));

        return back()->with('success', 'Sector added.');
    }

    public function update(Request $request, Sector $sector)
    {
        $sector->update($this->validateInput($request, $sector->id));

        return back()->with('success', 'Sector updated.');
    }

    public function destroy(Sector $sector)
    {
        // A sector already pinned to customers is deactivated, not deleted —
        // removing it would blank their classification and skew past reports.
        if ($sector->customers()->exists()) {
            $sector->update(['is_active' => false]);

            return back()->with('success',
                "“{$sector->name}” is used by " . $sector->customers()->count() .
                ' customer(s) — deactivated instead of deleted.');
        }

        $sector->delete();

        return back()->with('success', 'Sector deleted.');
    }

    private function validateInput(Request $request, ?int $id = null): array
    {
        return $request->validate([
            // One national list, so the name is globally unique.
            'name'          => ['required', 'string', 'max:120', Rule::unique('sectors', 'name')->ignore($id)],
            'code'          => 'nullable|string|max:32',
            'applies_to'    => 'required|in:government,private,both',
            'description'   => 'nullable|string|max:500',
            'display_order' => 'nullable|integer|min:0',
            'is_active'     => 'boolean',
        ]);
    }
}
