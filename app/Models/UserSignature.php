<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;

/**
 * One of a user's signature images.
 *
 * The image is the whole signature block: the pen stroke plus the name,
 * designation, centre and contacts printed under it — that is what BITAC
 * officers scan. So documents embed it AS IS and print nothing beneath it
 * (see App\Support\SignatureBlock).
 *
 * A user may hold several (Bangla block, English block, a second post) and
 * marks one as their default; that is what every document reaches for unless
 * the signer picks another at approval / issue time.
 */
class UserSignature extends Model
{
    protected $fillable = ['user_id', 'label', 'path', 'is_default'];

    protected $casts = ['is_default' => 'boolean'];

    protected $appends = ['url'];

    public function user()
    {
        return $this->belongsTo(User::class);
    }

    /** Public URL — for previews in the Inertia payload. */
    public function getUrlAttribute(): ?string
    {
        return $this->path ? Storage::disk('public')->url($this->path) : null;
    }

    /** Absolute local path for mPDF, or null if the file has gone missing. */
    public function absolutePath(): ?string
    {
        if (!$this->path) return null;
        $path = Storage::disk('public')->path($this->path);
        return is_file($path) ? $path : null;
    }

    /**
     * Make this the owner's default, clearing the flag on their others.
     * Exactly one default per user is an invariant the picker relies on.
     */
    public function makeDefault(): void
    {
        DB::transaction(function () {
            static::where('user_id', $this->user_id)
                ->where('id', '!=', $this->id)
                ->update(['is_default' => false]);
            $this->forceFill(['is_default' => true])->save();
        });
    }

    /**
     * Delete the row and its file. If it was the default, the oldest remaining
     * signature takes over — a user with signatures always has a default, so
     * documents never silently lose their image.
     */
    public function deleteWithFile(): void
    {
        DB::transaction(function () {
            $wasDefault = $this->is_default;
            $userId = $this->user_id;
            $path = $this->path;

            $this->delete();

            if ($wasDefault) {
                static::where('user_id', $userId)->oldest('id')->first()?->makeDefault();
            }

            // Only unlink once nothing else points at the same file. Copying a
            // signature onto an approval stores the SAME relative path, so a
            // blind unlink would blank an already-signed document.
            if ($path && !static::where('path', $path)->exists() && !self::pathInUse($path)) {
                Storage::disk('public')->delete($path);
            }
        });
    }

    /**
     * Is this image already stamped on a document? Approvals, gate passes and
     * letters snapshot the path, so the file has to outlive the signature row.
     */
    private static function pathInUse(string $path): bool
    {
        $tables = [
            'quotation_approvals'     => 'signature_path',
            'cost_estimate_approvals' => 'signature_path',
            'gate_passes'             => 'issuer_signature_path',
            'rfq_letters'             => 'signature_path',
        ];

        foreach ($tables as $table => $column) {
            if (DB::table($table)->where($column, $path)->exists()) return true;
        }

        return DB::table('gate_passes')->where('approver_signature_path', $path)->exists()
            || DB::table('users')->where('signature_path', $path)->exists();
    }
}
