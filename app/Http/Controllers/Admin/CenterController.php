<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Center;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Inertia\Inertia;

/**
 * Admin → System → Centers. Lets super admins configure each BITAC center's
 * basic info AND letterhead (Bangla name, ministry tag, address, contacts, logos).
 * The letterhead is rendered into every PDF by BitacLetterhead.
 */
class CenterController extends Controller
{
    /**
     * ⚠️ A centre admin (`manage users`, one centre) sees and edits only their
     * own centre — its letterhead is theirs to keep right. Adding a centre and
     * changing a centre's CODE are the super admin's: the code is inside every
     * document number the centre issues (`WO-DHK-2026-0001`).
     */
    public function index()
    {
        $all = auth()->user()->isSuperAdmin();

        return Inertia::render('Admin/Centers/Index', [
            'centers'   => Center::orderBy('id')
                ->when(! $all, fn ($q) => $q->whereKey(auth()->user()->center_id ?: 0))
                ->withCount(['users' => fn ($q) => $q->where('is_active', true)])
                ->get(),
            'canCreate' => $all,
        ]);
    }

    /** A new centre: name + code here; the letterhead on its edit page. */
    public function store(Request $request)
    {
        abort_unless(auth()->user()->isSuperAdmin(), 403);

        $data = $request->validate([
            'name' => 'required|string|max:255|unique:centers,name',
            'code' => ['required', 'string', 'max:10', 'regex:/^[A-Za-z0-9]+$/', 'unique:centers,code'],
        ], ['code.regex' => 'The code is letters and digits only — it goes inside document numbers.']);

        $center = Center::create([
            'name'      => trim($data['name']),
            'code'      => strtoupper($data['code']),
            'is_active' => true,
        ]);

        return redirect()->route('admin.centers.edit', $center)
            ->with('success', "{$center->name} added. Fill in its letterhead, then give it a Centre Admin in Admin → Users.");
    }

    public function edit(Center $center)
    {
        $this->authorizeCentre($center);

        return Inertia::render('Admin/Centers/Edit', [
            'center' => array_merge($center->toArray(), [
                // toArray() includes accessor-driven URLs already, but make them
                // explicit so the form preview always has them.
                'logo_left_url'  => $center->logo_left_url,
                'logo_right_url' => $center->logo_right_url,
            ]),
            'canEditCode' => auth()->user()->isSuperAdmin(),
        ]);
    }

    public function update(Request $request, Center $center)
    {
        $this->authorizeCentre($center);

        $validated = $request->validate([
            'name'              => 'required|string|max:255|unique:centers,name,' . $center->id,
            'code'              => ['required', 'string', 'max:10', 'regex:/^[A-Za-z0-9]+$/', 'unique:centers,code,' . $center->id],
            'bin_number'        => 'nullable|string|max:40',
            'address'           => 'nullable|string|max:255',
            'phone'             => 'nullable|string|max:255',
            'email'             => 'nullable|email|max:255',
            'is_active'         => 'boolean',
            // Letterhead fields
            'name_bn'           => 'nullable|string|max:200',
            'caption_en'        => 'nullable|string|max:200',
            'ministry_bn'       => 'nullable|string|max:200',
            'government_bn'     => 'nullable|string|max:200',
            'address_bn'        => 'nullable|string|max:300',
            'phone_bn'          => 'nullable|string|max:120',
            'fax_bn'            => 'nullable|string|max:120',
            'website'           => 'nullable|string|max:120',
            // English letterhead
            'name_en'           => 'nullable|string|max:200',
            'ministry_en'       => 'nullable|string|max:200',
            'government_en'     => 'nullable|string|max:200',
            'address_en'        => 'nullable|string|max:300',
            'phone_en'          => 'nullable|string|max:120',
            'fax_en'            => 'nullable|string|max:120',
            'letterhead_color'  => 'nullable|string|max:16',
            'logo_left'         => 'nullable|image|max:2048',
            'logo_right'        => 'nullable|image|max:2048',
            'remove_logo_left'  => 'boolean',
            'remove_logo_right' => 'boolean',
        ]);

        // Handle the optional logo file uploads + explicit removals
        foreach ([
            'logo_left'  => 'logo_left_path',
            'logo_right' => 'logo_right_path',
        ] as $field => $column) {
            if ($request->boolean('remove_' . $field)) {
                if ($center->{$column}) {
                    Storage::disk('public')->delete($center->{$column});
                }
                $center->{$column} = null;
            }
            if ($request->hasFile($field)) {
                if ($center->{$column}) {
                    Storage::disk('public')->delete($center->{$column});
                }
                $center->{$column} = $request->file($field)->store("centers/{$center->id}", 'public');
            }
        }

        $validated['code'] = strtoupper($validated['code']);
        // The code numbers every document the centre issues — the super admin's.
        if (! auth()->user()->isSuperAdmin()) {
            unset($validated['code'], $validated['is_active']);
        }

        $center->fill(array_filter($validated, function ($_, $k) {
            return !in_array($k, ['logo_left', 'logo_right', 'remove_logo_left', 'remove_logo_right'], true);
        }, ARRAY_FILTER_USE_BOTH));
        $center->save();

        return redirect()->route('admin.centers.index')->with('success', "{$center->name} updated.");
    }

    private function authorizeCentre(Center $center): void
    {
        abort_unless(
            auth()->user()->isSuperAdmin() || (int) auth()->user()->center_id === (int) $center->id,
            403, 'You can only manage your own centre.'
        );
    }
}
