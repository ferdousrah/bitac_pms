<?php

namespace App\Http\Controllers;

use App\Models\User;
use App\Models\UserSignature;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

/**
 * Add / remove / re-default a user's signatures.
 *
 * Two entry points share it: a user managing their own under Profile, and an
 * admin managing anyone's under Users & Access. Both land here so the rules
 * (one default, file cleanup, who may touch whose) live in one place.
 */
class UserSignatureController extends Controller
{
    /** Max images one person may keep — enough for a Bangla + English block and a spare. */
    private const MAX_PER_USER = 6;

    public function store(Request $request, ?User $user = null)
    {
        $target = $this->resolveTarget($user);
        if (is_string($target)) return back()->with('error', $target);

        $request->validate([
            'label' => 'nullable|string|max:80',
            'image' => 'required|image|mimes:png,jpg,jpeg,webp|max:2048',
        ], [], ['image' => 'signature image']);

        if ($target->signatures()->count() >= self::MAX_PER_USER) {
            return back()->with('error', 'A user can keep at most ' . self::MAX_PER_USER . ' signatures. Remove one first.');
        }

        $path = $request->file('image')->store('signatures', 'public');

        $signature = UserSignature::create([
            'user_id'    => $target->id,
            'label'      => trim((string) $request->input('label')) ?: 'Signature ' . ($target->signatures()->count() + 1),
            'path'       => $path,
            // The first one a user uploads is automatically their default —
            // otherwise they'd have signatures but nothing would be picked.
            'is_default' => $target->signatures()->count() === 0,
        ]);

        if ($signature->is_default) $signature->makeDefault();

        return back()->with('success', 'Signature added.');
    }

    public function setDefault(Request $request, UserSignature $signature)
    {
        if ($msg = $this->denyUnlessOwnerOrAdmin($signature)) return back()->with('error', $msg);

        $signature->makeDefault();

        return back()->with('success', '“' . $signature->label . '” is now the default signature.');
    }

    public function destroy(Request $request, UserSignature $signature)
    {
        if ($msg = $this->denyUnlessOwnerOrAdmin($signature)) return back()->with('error', $msg);

        $label = $signature->label;
        // Documents already signed with this image keep it — deleteWithFile()
        // only unlinks the file once nothing points at it any more.
        $signature->deleteWithFile();

        return back()->with('success', '“' . $label . '” removed.');
    }

    /**
     * Whose signatures are we touching? Null $user means "my own"; passing one
     * requires the manage-users right.
     *
     * @return User|string  The user, or a refusal message.
     */
    private function resolveTarget(?User $user): User|string
    {
        if (!$user || $user->id === Auth::id()) {
            return Auth::user();
        }

        return $this->canManageOthers()
            ? $user
            : 'You can only manage your own signatures.';
    }

    private function denyUnlessOwnerOrAdmin(UserSignature $signature): ?string
    {
        if ($signature->user_id === Auth::id() || $this->canManageOthers()) return null;

        return 'You can only manage your own signatures.';
    }

    private function canManageOthers(): bool
    {
        $u = Auth::user();

        return $u && (
            ($u->hasRole('super_admin') ?? false)
            || $u->can('manage users')
            || $u->can('edit users')
        );
    }
}
