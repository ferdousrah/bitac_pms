<?php

namespace App\Http\Controllers;

use App\Models\Stakeholder;
use Illuminate\Http\Request;
use Inertia\Inertia;

class StakeholderController extends Controller
{
    private const CATEGORIES = [
        'govt_ministry'     => 'Government / Ministry',
        'industry_customer' => 'Industry Customer',
        'academic'          => 'Academic Partner',
        'industry_body'     => 'Industry Body / Association',
        'internal'          => 'Internal (BITAC)',
        'other'             => 'Other',
    ];

    public function index(Request $request)
    {
        $q = Stakeholder::query()->latest('id');

        if ($cat = $request->input('category')) $q->where('category', $cat);
        if ($search = trim((string) $request->input('search'))) {
            $q->where(function ($q) use ($search) {
                $q->where('name', 'like', "%{$search}%")
                  ->orWhere('email', 'like', "%{$search}%")
                  ->orWhere('organization', 'like', "%{$search}%");
            });
        }

        $rows = $q->paginate(20)->withQueryString()->through(fn ($s) => [
            'id'           => $s->id,
            'name'         => $s->name,
            'email'        => $s->email,
            'phone'        => $s->phone,
            'organization' => $s->organization,
            'designation'  => $s->designation,
            'category'     => $s->category,
            'category_label' => self::CATEGORIES[$s->category] ?? $s->category,
            'is_active'    => $s->is_active,
        ]);

        return Inertia::render('Stakeholders/Index', [
            'stakeholders' => $rows,
            'filters'      => $request->only(['search', 'category']),
            'categories'   => self::CATEGORIES,
            'stats'        => [
                'total'  => Stakeholder::count(),
                'active' => Stakeholder::active()->count(),
                'by_category' => Stakeholder::selectRaw('category, COUNT(*) as cnt')
                    ->groupBy('category')->pluck('cnt', 'category')->all(),
            ],
        ]);
    }

    public function create()
    {
        return Inertia::render('Stakeholders/CreateEdit', [
            'stakeholder' => null,
            'categories'  => self::CATEGORIES,
        ]);
    }

    public function store(Request $request)
    {
        Stakeholder::create($this->validateInput($request));
        return redirect()->route('ied.stakeholders.index')->with('success', 'Stakeholder added.');
    }

    public function edit(Stakeholder $stakeholder)
    {
        return Inertia::render('Stakeholders/CreateEdit', [
            'stakeholder' => $stakeholder->toArray(),
            'categories'  => self::CATEGORIES,
        ]);
    }

    public function update(Request $request, Stakeholder $stakeholder)
    {
        $stakeholder->update($this->validateInput($request, $stakeholder->id));
        return redirect()->route('ied.stakeholders.index')->with('success', 'Stakeholder updated.');
    }

    public function destroy(Stakeholder $stakeholder)
    {
        $stakeholder->delete();
        return back()->with('success', 'Stakeholder removed.');
    }

    /** Bulk CSV import. Expects columns: name, email, phone, organization, designation, category */
    public function bulkImport(Request $request)
    {
        $request->validate([
            'csv' => 'required|file|mimes:csv,txt|max:5120',
        ]);

        $h = fopen($request->file('csv')->getRealPath(), 'r');
        $header = array_map(fn ($v) => strtolower(trim($v)), fgetcsv($h) ?? []);
        $required = ['name', 'email'];
        foreach ($required as $r) {
            if (!in_array($r, $header, true)) {
                fclose($h);
                return back()->withErrors(['csv' => "Missing required column: {$r}"]);
            }
        }

        $imported = 0; $skipped = 0;
        while (($row = fgetcsv($h)) !== false) {
            $data = array_combine($header, $row);
            if (empty($data['email']) || empty($data['name'])) { $skipped++; continue; }
            $exists = Stakeholder::where('email', $data['email'])->exists();
            if ($exists) { $skipped++; continue; }

            Stakeholder::create([
                'name'         => $data['name'],
                'email'        => $data['email'],
                'phone'        => $data['phone'] ?? null,
                'organization' => $data['organization'] ?? null,
                'designation'  => $data['designation'] ?? null,
                'category'     => array_key_exists($data['category'] ?? '', self::CATEGORIES) ? $data['category'] : 'industry_customer',
                'is_active'    => true,
                'center_id'    => auth()->user()->center_id,
            ]);
            $imported++;
        }
        fclose($h);

        return back()->with('success', "Imported {$imported} new stakeholders. Skipped {$skipped} (duplicates / blanks).");
    }

    private function validateInput(Request $request, ?int $id = null): array
    {
        $emailRule = 'required|email|max:150|unique:stakeholders,email';
        if ($id) $emailRule .= ",{$id}";

        return $request->validate([
            'name'         => 'required|string|max:150',
            'email'        => $emailRule,
            'phone'        => 'nullable|string|max:30',
            'organization' => 'nullable|string|max:200',
            'designation'  => 'nullable|string|max:150',
            'category'     => 'required|in:' . implode(',', array_keys(self::CATEGORIES)),
            'is_active'    => 'boolean',
            'notes'        => 'nullable|string|max:2000',
        ]);
    }
}
