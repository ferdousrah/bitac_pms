<?php

namespace App\Models;

use App\Traits\HasCenter;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Storage;

class GatePass extends Model
{
    use HasCenter;

    protected $fillable = [
        'center_id', 'rfq_id', 'pass_no', 'direction',
        'customer_rep_name', 'customer_rep_phone', 'customer_rep_id_number', 'vehicle_no',
        'pass_date', 'notes',
        'issued_by', 'issued_at', 'issuer_signature_path',
        'status',
    ];

    protected function casts(): array
    {
        return [
            'pass_date' => 'date',
            'issued_at' => 'datetime',
        ];
    }

    public function rfq()       { return $this->belongsTo(Rfq::class); }
    public function items()     { return $this->hasMany(GatePassItem::class)->orderBy('sort_order'); }
    public function issuedBy()  { return $this->belongsTo(User::class, 'issued_by'); }
    public function center()    { return $this->belongsTo(Center::class); }

    /**
     * Auto-generate next pass number — prefix depends on direction.
     * GIN-2026-0001 for gate-in, GOUT-2026-0001 for gate-out.
     */
    public static function generatePassNo(string $direction): string
    {
        $prefix = $direction === 'in' ? 'GIN' : 'GOUT';
        $year = now()->format('Y');
        $lastSeq = static::where('pass_no', 'like', "{$prefix}-{$year}-%")
            ->orderByDesc('id')
            ->value('pass_no');
        $next = 1;
        if ($lastSeq && preg_match('/-(\d+)$/', $lastSeq, $m)) {
            $next = (int) $m[1] + 1;
        }
        return sprintf('%s-%s-%04d', $prefix, $year, $next);
    }

    public function signatureAbsolutePath(): ?string
    {
        if (!$this->issuer_signature_path) return null;
        $path = Storage::disk('public')->path($this->issuer_signature_path);
        return is_file($path) ? $path : null;
    }
}
