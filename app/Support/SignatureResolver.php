<?php

namespace App\Support;

use App\Models\UserSignature;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Storage;

/**
 * Work out which image a signer just signed with, and return the path to
 * stamp on the document.
 *
 * Every place that captures a signature — approving a quotation or a cost
 * estimate, issuing or approving a gate pass, issuing a letter — sends the
 * same two optional fields:
 *
 *   user_signature_id  the signer picked one of their saved blocks
 *   signature          they drew one instead (a base64 data URL)
 *
 * Documents store the PATH, not the id, so a signature that is later renamed
 * or deleted can never change or blank a document that already went out.
 * (UserSignature::deleteWithFile keeps the file for exactly this reason.)
 */
class SignatureResolver
{
    /**
     * @param  int|null     $userSignatureId  A saved block belonging to $ownerId.
     * @param  string|null  $drawnDataUrl     A freshly drawn data URL.
     * @param  string       $drawnDir         Where a drawn image is filed.
     * @param  int|null     $ownerId          Whose signature this must be; defaults
     *                                        to the logged-in user. Guards against
     *                                        signing with someone else's block.
     * @return string|null  Path on the `public` disk, or null if neither was given.
     */
    public static function resolve(
        ?int $userSignatureId,
        ?string $drawnDataUrl,
        string $drawnDir,
        ?int $ownerId = null,
    ): ?string {
        // ⚠️ Cast before comparing. A signatory id picked in a form arrives as
        // a string, and a strict === against the int user_id silently refused
        // every legitimate signature on the letter path.
        $ownerId = (int) ($ownerId ?? Auth::id());

        if ($userSignatureId) {
            $signature = UserSignature::find($userSignatureId);
            // Signing with a block that isn't yours is refused silently — the
            // caller then falls back to the default, so nothing breaks, but no
            // one can stamp another officer's signature by guessing an id.
            if ($signature && (int) $signature->user_id === $ownerId) {
                return $signature->path;
            }
            return null;
        }

        return self::storeDrawn($drawnDataUrl, $drawnDir);
    }

    /**
     * The signer's default block — what a document uses when nothing was
     * picked or drawn.
     */
    public static function defaultPathFor(?int $userId): ?string
    {
        if (!$userId) return null;

        return UserSignature::where('user_id', $userId)
            ->orderByDesc('is_default')->orderBy('id')
            ->value('path');
    }

    /** Decode a canvas data URL onto the public disk. Null if it isn't one. */
    public static function storeDrawn(?string $dataUrl, string $dir): ?string
    {
        if (!$dataUrl || !str_starts_with($dataUrl, 'data:image/')) return null;

        $parts = explode(',', $dataUrl, 2);
        if (count($parts) !== 2) return null;

        $binary = base64_decode($parts[1], true);
        if ($binary === false) return null;

        $path = rtrim($dir, '/') . '/' . uniqid('sig-', true) . '.png';
        Storage::disk('public')->put($path, $binary);

        return $path;
    }

    /** Validation rules for the two fields, for any request that signs something. */
    public static function rules(): array
    {
        return [
            'user_signature_id' => 'nullable|integer|exists:user_signatures,id',
            'signature'         => 'nullable|string',
        ];
    }
}
