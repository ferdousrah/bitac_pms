<?php

namespace App\Models;

use Database\Factories\UserFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Spatie\Permission\Traits\HasRoles;

class User extends Authenticatable
{
    use HasFactory, Notifiable, HasRoles;

    protected $fillable = [
        'name',
        'email',
        'phone',
        'designation',
        'signature_path',
        'avatar_path',
        'password',
        'center_id',
        'section_id',
        'is_active',
        'deactivated_at',
        'deactivation_reason',
    ];

    protected $hidden = [
        'password',
        'remember_token',
    ];

    protected function casts(): array
    {
        return [
            'email_verified_at'   => 'datetime',
            'password'            => 'hashed',
            'is_active'           => 'boolean',
            'deactivated_at'      => 'datetime',
        ];
    }

    public function center()
    {
        return $this->belongsTo(Center::class);
    }

    public function section()
    {
        return $this->belongsTo(Section::class);
    }

    /**
     * Every signature this user holds, their default first.
     *
     * A user may keep several — a Bangla block, an English one, one per post.
     * Each image already carries the name/designation/contacts under the pen
     * stroke, so documents print the image and nothing else.
     */
    public function signatures()
    {
        return $this->hasMany(UserSignature::class)->orderByDesc('is_default')->orderBy('id');
    }

    /** The one documents reach for unless the signer picks another. */
    public function defaultSignature(): ?UserSignature
    {
        return $this->relationLoaded('signatures')
            ? ($this->signatures->firstWhere('is_default', true) ?? $this->signatures->first())
            : $this->signatures()->first();
    }

    /**
     * Public URL of the user's default signature, or null if they have none.
     * Used in the Inertia payload for previews.
     */
    public function getSignatureUrlAttribute(): ?string
    {
        if ($sig = $this->defaultSignature()) {
            return $sig->url;
        }

        // Pre-`user_signatures` fallback. The migration copies every existing
        // signature across, so this only fires if that backfill was skipped.
        return $this->signature_path
            ? \Storage::disk('public')->url($this->signature_path)
            : null;
    }

    /**
     * Public URL of the user's profile photo (avatar), or null if not uploaded.
     */
    public function getAvatarUrlAttribute(): ?string
    {
        return $this->avatar_path
            ? \Storage::disk('public')->url($this->avatar_path)
            : null;
    }

    /**
     * Absolute filesystem path of the user's DEFAULT signature — used by mPDF
     * when embedding the image into a generated PDF (mPDF needs a local path).
     *
     * Every document that doesn't let the signer choose (operation sheets, work
     * orders, material requisitions, QC reports) resolves through here, so
     * changing your default changes what they print from then on.
     */
    public function signatureAbsolutePath(): ?string
    {
        if ($abs = $this->defaultSignature()?->absolutePath()) {
            return $abs;
        }

        if (!$this->signature_path) return null;
        $path = \Storage::disk('public')->path($this->signature_path);
        return is_file($path) ? $path : null;
    }

    public function rfqs()
    {
        return $this->hasMany(Rfq::class, 'created_by');
    }

    public function quotations()
    {
        return $this->hasMany(Quotation::class, 'created_by');
    }

    public function workOrders()
    {
        return $this->hasMany(WorkOrder::class, 'created_by');
    }

    public function operatorAssignments()
    {
        return $this->hasMany(OperatorAssignment::class);
    }

    public function jobExecutions()
    {
        return $this->hasMany(JobExecution::class, 'operator_id');
    }

    public function qcInspections()
    {
        return $this->hasMany(QcInspection::class, 'inspector_id');
    }

    public function quotationApprovals()
    {
        return $this->hasMany(QuotationApproval::class, 'approver_id');
    }
}
