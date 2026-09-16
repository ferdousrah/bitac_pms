<?php

namespace App\Http\Controllers;

use App\Http\Requests\ProfileUpdateRequest;
use Illuminate\Contracts\Auth\MustVerifyEmail;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Redirect;
use Illuminate\Support\Facades\Storage;
use Inertia\Inertia;
use Inertia\Response;

class ProfileController extends Controller
{
    /**
     * Display the user's profile form.
     */
    public function edit(Request $request): Response
    {
        $user = $request->user();
        return Inertia::render('Profile/Edit', [
            'mustVerifyEmail' => $user instanceof MustVerifyEmail,
            'status'          => session('status'),
            'signatureUrl'    => $user?->signature_url,
            // Every signature block this user holds, default first.
            'signatures'      => $user?->signatures()->get(['id', 'label', 'path', 'is_default'])
                ->map(fn ($s) => ['id' => $s->id, 'label' => $s->label, 'url' => $s->url, 'is_default' => $s->is_default])
                ->values() ?? [],
            'avatarUrl'       => $user?->avatar_url,
        ]);
    }

    /**
     * Update the user's avatar (profile photo). Accepts a single image file
     * (PNG / JPG / WebP, max 4 MB) or a `remove=1` flag to clear it.
     */
    public function updateAvatar(Request $request): RedirectResponse
    {
        $validated = $request->validate([
            'avatar' => 'nullable|file|mimes:png,jpg,jpeg,webp|max:4096',
            'remove' => 'nullable|boolean',
        ]);

        $user = $request->user();

        if (! empty($validated['remove'])) {
            if ($user->avatar_path) {
                Storage::disk('public')->delete($user->avatar_path);
            }
            $user->forceFill(['avatar_path' => null])->save();
            return back()->with('status', 'Profile photo removed.');
        }

        if (! $request->hasFile('avatar')) {
            return back()->withErrors(['avatar' => 'Please choose a photo to upload.']);
        }

        $stored = $request->file('avatar')->store('avatars', 'public');
        if ($user->avatar_path && $user->avatar_path !== $stored) {
            Storage::disk('public')->delete($user->avatar_path);
        }
        $user->forceFill(['avatar_path' => $stored])->save();
        return back()->with('status', 'Profile photo updated.');
    }

    /**
     * Update the user's profile information.
     */
    public function update(ProfileUpdateRequest $request): RedirectResponse
    {
        $request->user()->fill($request->validated());

        if ($request->user()->isDirty('email')) {
            $request->user()->email_verified_at = null;
        }

        $request->user()->save();

        return Redirect::route('profile.edit');
    }

    /**
     * Delete the user's account.
     */
    public function destroy(Request $request): RedirectResponse
    {
        $request->validate([
            'password' => ['required', 'current_password'],
        ]);

        $user = $request->user();

        Auth::logout();

        $user->delete();

        $request->session()->invalidate();
        $request->session()->regenerateToken();

        return Redirect::to('/');
    }
}
