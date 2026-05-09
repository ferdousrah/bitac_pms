<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Services\SettingService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Inertia\Inertia;

class BrandingController extends Controller
{
    public function __construct(private SettingService $settings) {}

    public function index()
    {
        $branding = $this->settings->branding();

        return Inertia::render('Admin/Branding/Index', [
            'settings' => [
                ...$branding,
                'logo_url' => $branding['logo_path']
                    ? Storage::disk('public')->url($branding['logo_path'])
                    : null,
            ],
        ]);
    }

    public function update(Request $request)
    {
        $validated = $request->validate([
            'brand_name'     => 'required|string|max:50',
            'brand_subtitle' => 'nullable|string|max:50',
            'primary_color'  => 'required|regex:/^#[0-9A-Fa-f]{6}$/',
            'sidebar_color'  => 'required|regex:/^#[0-9A-Fa-f]{6}$/',
            'sidebar_accent' => 'required|regex:/^#[0-9A-Fa-f]{6}$/',
            'logo'           => 'nullable|image|mimes:png,jpg,jpeg,svg,webp|max:2048',
            'remove_logo'    => 'nullable|boolean',
        ]);

        // Text settings
        foreach (['brand_name', 'brand_subtitle', 'primary_color', 'sidebar_color', 'sidebar_accent'] as $key) {
            if (isset($validated[$key])) {
                $this->settings->set($key, $validated[$key]);
            }
        }

        // Logo upload
        if ($request->hasFile('logo')) {
            $oldPath = $this->settings->get('logo_path');
            if ($oldPath) {
                Storage::disk('public')->delete($oldPath);
            }
            $path = $request->file('logo')->store('branding', 'public');
            $this->settings->set('logo_path', $path);
        }

        // Logo removal
        if ($request->boolean('remove_logo')) {
            $oldPath = $this->settings->get('logo_path');
            if ($oldPath) {
                Storage::disk('public')->delete($oldPath);
            }
            $this->settings->set('logo_path', null);
        }

        return redirect()->route('admin.branding')->with('success', 'Branding settings updated.');
    }
}
