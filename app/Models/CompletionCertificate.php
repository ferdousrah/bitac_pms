<?php

namespace App\Models;

use App\Scopes\CenterScope;
use App\Traits\HasCenter;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Facades\Storage;

class CompletionCertificate extends Model
{
    use HasCenter;

    protected $fillable = [
        'center_id', 'work_order_id', 'customer_id', 'certificate_number',
        'mode', 'issued_by_name', 'issued_by_designation', 'issued_date',
        'rating', 'remarks',
        'uploaded_file_path', 'generated_pdf_path', 'signature_path',
    ];

    protected function casts(): array
    {
        return [
            'issued_date' => 'date',
            'rating'      => 'integer',
        ];
    }

    protected static function booted(): void
    {
        static::addGlobalScope(new CenterScope);
    }

    public function workOrder(): BelongsTo  { return $this->belongsTo(WorkOrder::class); }
    public function customer(): BelongsTo   { return $this->belongsTo(Customer::class); }

    /** URL to whichever PDF/image the customer's certificate is stored as. */
    public function getFileUrlAttribute(): ?string
    {
        $path = $this->uploaded_file_path ?? $this->generated_pdf_path;
        return $path ? Storage::disk('public')->url($path) : null;
    }

    public function getSignatureUrlAttribute(): ?string
    {
        return $this->signature_path ? Storage::disk('public')->url($this->signature_path) : null;
    }

    /**
     * Generate the next certificate number for a given year.
     * Format: CC-YYYY-NNNN (e.g. CC-2026-0001).
     */
    public static function generateCertificateNumber(): string
    {
        $year = now()->year;
        $prefix = "CC-{$year}-";
        $last = static::withoutGlobalScopes()
            ->where('certificate_number', 'like', "{$prefix}%")
            ->orderByDesc('certificate_number')
            ->value('certificate_number');
        $next = $last ? ((int) substr($last, strlen($prefix))) + 1 : 1;
        return $prefix . str_pad((string) $next, 4, '0', STR_PAD_LEFT);
    }
}
