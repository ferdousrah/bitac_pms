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

    /**
     * ⚠️ The role is **`super-admin`**, with a hyphen — that is what the
     * seeder creates and what every live account carries.
     *
     * A dozen controllers check `hasRole('super_admin')` with an underscore,
     * which is a role that does not exist, so the check is **always false**.
     * On Target vs Achievement that quietly cost the super admin the whole
     * point of the report: they saw one centre instead of all six. Ask here
     * instead of spelling it again, and accept both so an older spelling
     * cannot resurrect the bug.
     */
    /**
     * What would be DESTROYED if this account were hard-deleted.
     *
     * ⚠️ These foreign keys are ON DELETE CASCADE, so deleting a user does not
     * merely orphan their work — it takes it. `work_orders.created_by` is the
     * worst: a work order carries its deliveries, invoices, payments, QC
     * inspections, operation sheets and production logs down with it.
     *
     * Retiring someone is `is_active = false` (Deactivate), which LoginRequest
     * honours. This exists so the admin delete can refuse, naming what it
     * would have destroyed.
     *
     * @return array<string,int> label => count, only what is non-empty
     */
    public function destructiveFootprint(): array
    {
        $counts = [];
        foreach (self::CASCADE_PATHS as $label => [$table, $column]) {
            $counts[$label] = \DB::table($table)->where($column, $this->id)->count();
        }

        return array_filter($counts);
    }

    /**
     * Every CASCADE path into `users`: label => [table, column].
     *
     * ⚠️ One list, because the per-user footprint and the bulk check the user
     * list uses must never disagree. A row offered as deletable that the guard
     * then refuses is exactly the button we are trying not to ship.
     *
     * Raw `DB::table` rather than the models, so no global scope (CenterScope)
     * can hide work that the database would still cascade away.
     */
    private const CASCADE_PATHS = [
        'quotations'              => ['quotations', 'created_by'],
        'work orders'             => ['work_orders', 'created_by'],
        'QC inspections'          => ['qc_inspections', 'inspector_id'],
        'rework orders'           => ['rework_orders', 'created_by'],
        'quotation approvals'     => ['quotation_approvals', 'approver_id'],
        'cost estimate approvals' => ['cost_estimate_approvals', 'approver_id'],
        'work order approvals'    => ['work_order_approvals', 'approver_id'],
        'stakeholder forms'       => ['stakeholder_forms', 'created_by'],
        'service demand logs'     => ['service_demand_logs', 'logged_by'],
    ];

    /** Nothing of theirs would be destroyed, so the row may simply go. */
    public function canBeHardDeleted(): bool
    {
        return $this->destructiveFootprint() === [];
    }

    /**
     * Which of these accounts have done nothing, so may be hard-deleted.
     *
     * ⚠️ Asking each row `canBeHardDeleted()` is nine queries PER USER — 180 on
     * a page of twenty. This answers for the whole page in nine, by looking for
     * the ids that appear anywhere and taking the complement.
     *
     * @param  array<int>  $ids
     * @return array<int>  the subset that is safe to delete
     */
    public static function hardDeletableIds(array $ids): array
    {
        $ids = array_values(array_unique(array_filter(array_map('intval', $ids))));
        if (! $ids) {
            return [];
        }

        $busy = [];
        foreach (self::CASCADE_PATHS as [$table, $column]) {
            foreach (\DB::table($table)->whereIn($column, $ids)->distinct()->pluck($column) as $id) {
                $busy[(int) $id] = true;
            }
        }

        return array_values(array_diff($ids, array_keys($busy)));
    }

    public function isSuperAdmin(): bool
    {
        return $this->hasRole('super-admin') || $this->hasRole('super_admin');
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
