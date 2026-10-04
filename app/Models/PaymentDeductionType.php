<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/**
 * A kind of deduction a client makes out of a payment.
 *
 * ⚠️ **`is_recoverable` is the whole point of this table.** It says whether the
 * deducted money is still owed to BITAC:
 *
 *   true  — security / performance deposit. The client is holding BITAC's
 *           money and will release it later, so the bill is NOT settled for
 *           that part and it stays in the dues.
 *   false — income tax or VAT at source, a revenue stamp, a penalty, a
 *           rounding adjustment. The money is gone for good (to the treasury
 *           or as a reduction), so the bill IS settled for that part.
 *
 * National, not per centre — "how much security is held across BITAC" has to
 * be a single comparable figure, which per-centre rows with their own ids
 * break. Same reasoning as `sectors`; deliberately unlike `job_categories`.
 */
class PaymentDeductionType extends Model
{
    protected $fillable = [
        'code', 'name', 'name_bn', 'is_recoverable', 'default_rate_pct', 'is_active', 'sort_order',
    ];

    protected function casts(): array
    {
        return [
            'is_recoverable'   => 'boolean',
            'is_active'        => 'boolean',
            'default_rate_pct' => 'decimal:3',
        ];
    }

    public function deductions() { return $this->hasMany(PaymentDeduction::class, 'deduction_type_id'); }

    public function scopeActive($query) { return $query->where('is_active', true); }

    public function scopeOrdered($query) { return $query->orderBy('sort_order')->orderBy('name'); }

    /** Is this type attached to anything? A used type is deactivated, never deleted. */
    public function isInUse(): bool
    {
        return $this->deductions()->exists();
    }
}
