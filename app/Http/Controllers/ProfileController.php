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
     * Update the user's saved signature. Accepts either:
     *   - signature_image : a real uploaded PNG/JPG file, OR
     *   - signature_data  : a base64 data URL from the in-browser canvas pad
     *
     * Posting `remove=1` (with no other field) clears the existing signature.
     */
    public function updateSignature(Request $request): RedirectResponse
    {
        $validated = $request->validate([
            'signature_image' => 'nullable|file|mimes:png,jpg,jpeg,webp|max:2048',
            'signature_data'  => 'nullable|string|max:500000', // base64 PNG data-URL
            'remove'          => 'nullable|boolean',
        ]);

        $user = $request->user();

        // Remove existing signature
        if (! empty($validated['remove'])) {
            if ($user->signature_path) {
                Storage::disk('public')->delete($user->signature_path);
            }
            $user->forceFill(['signature_path' => null])->save();
            return back()->with('status', 'Signature removed.');
        }

        // From inline canvas (data URL)
        if (! empty($validated['signature_data'])) {
            $dataUrl = $validated['signature_data'];
            if (! preg_match('/^data:image\/(png|jpeg|webp);base64,(.+)$/', $dataUrl, $m)) {
                return back()->withErrors(['signature_data' => 'Invalid signature data.']);
            }
            $ext  = $m[1] === 'jpeg' ? 'jpg' : $m[1];
            $bin  = base64_decode($m[2], true);
            if ($bin === false) {
                return back()->withErrors(['signature_data' => 'Could not decode signature.']);
            }
            $path = 'signatures/' . $user->id . '_' . time() . '.' . $ext;
            Storage::disk('public')->put($path, $bin);

            // Clean up previous file
            if ($user->signature_path && $user->signature_path !== $path) {
                Storage::disk('public')->delete($user->signature_path);
            }
            $user->forceFill(['signature_path' => $path])->save();
            return back()->with('status', 'Signature saved.');
        }

        // From uploaded file
        if ($request->hasFile('signature_image')) {
            $stored = $request->file('signature_image')->store('signatures', 'public');
            if ($user->signature_path && $user->signature_path !== $stored) {
                Storage::disk('public')->delete($user->signature_path);
            }
            $user->forceFill(['signature_path' => $stored])->save();
            return back()->with('status', 'Signature uploaded.');
        }

        return back()->withErrors(['signature_data' => 'No signature provided.']);
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
