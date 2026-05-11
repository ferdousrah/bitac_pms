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
    public function index()
    {
        return Inertia::render('Admin/Centers/Index', [
            'centers' => Center::orderBy('id')->get(),
        ]);
    }

    public function edit(Center $center)
    {
        return Inertia::render('Admin/Centers/Edit', [
            'center' => array_merge($center->toArray(), [
                // toArray() includes accessor-driven URLs already, but make them
                // explicit so the form preview always has them.
                'logo_left_url'  => $center->logo_left_url,
                'logo_right_url' => $center->logo_right_url,
            ]),
        ]);
    }

    public function update(Request $request, Center $center)
    {
        $validated = $request->validate([
            'name'              => 'required|string|max:255',
            'code'              => 'required|string|max:20',
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

        $center->fill(array_filter($validated, function ($_, $k) {
            return !in_array($k, ['logo_left', 'logo_right', 'remove_logo_left', 'remove_logo_right'], true);
        }, ARRAY_FILTER_USE_BOTH));
        $center->save();

        return redirect()->route('admin.centers.index')->with('success', "{$center->name} updated.");
    }
}
