<?php

namespace App\Models;

use App\Traits\HasCenter;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Storage;

class GatePass extends Model
{
    use HasCenter;

    protected $fillable = [
        'center_id', 'rfq_id', 'source_gate_pass_id', 'customer_id', 'pass_no', 'direction', 'party_name',
        'completed_at', 'completed_by', 'completion_remarks',
        'cancelled_at', 'cancelled_by', 'cancellation_reason',
        'customer_rep_name', 'customer_rep_phone', 'customer_rep_id_number', 'vehicle_no',
        'pass_date', 'notes',
        'issued_by', 'issued_at', 'issuer_signature_path',
        'approved_by', 'approved_at', 'approver_signature_path',
        'rejected_by', 'rejected_at', 'rejection_reason',
        'status',
    ];

    protected function casts(): array
    {
        return [
            'pass_date'    => 'date',
            'issued_at'    => 'datetime',
            'completed_at' => 'datetime',
            'cancelled_at' => 'datetime',
            'approved_at'  => 'datetime',
            'rejected_at'  => 'datetime',
        ];
    }

    public function rfq()         { return $this->belongsTo(Rfq::class); }
    public function customer()    { return $this->belongsTo(Customer::class); }
    public function items()       { return $this->hasMany(GatePassItem::class)->orderBy('sort_order'); }
    public function returns()     { return $this->hasMany(GatePassReturn::class)->latest('returned_on')->latest('id'); }
    public function issuedBy()    { return $this->belongsTo(User::class, 'issued_by'); }
    public function approvedBy()  { return $this->belongsTo(User::class, 'approved_by'); }
    public function rejectedBy()  { return $this->belongsTo(User::class, 'rejected_by'); }
    public function completedBy() { return $this->belongsTo(User::class, 'completed_by'); }
    public function cancelledBy() { return $this->belongsTo(User::class, 'cancelled_by'); }
    public function center()      { return $this->belongsTo(Center::class); }

    /** The Gate Pass In this Out was raised against (null for a pass raised on its own). */
    public function sourcePass()  { return $this->belongsTo(GatePass::class, 'source_gate_pass_id'); }

    /** The Out passes raised against this In pass — one In can send things back in several trips. */
    public function outPasses()   { return $this->hasMany(GatePass::class, 'source_gate_pass_id')->orderBy('id'); }

    /**
     * Auto-generate next pass number — prefix depends on direction.
     * GIN-2026-0001 for gate-in, GOUT-2026-0001 for gate-out.
     */
    /**
     * Where this pass stands on returns: 'none', 'partial' or 'full'.
     * Goods that went out on a pass come back (and vice versa), item by item.
     */
    /**
     * Statuses in which a pass is live enough to book goods back.
     *
     * ⚠️ `completed` IS included. On a Gate Pass In, "Completed" means the
     * goods ARRIVED — the inward movement finished. Whatever came in still
     * goes back out later, which is a separate event. Excluding `completed`
     * left arrived-and-closed passes with no way to record the return at all.
     * (`recordReturn` also lands a pass on `completed` once everything is back;
     * that case is harmless because nothing is outstanding by then.)
     */
    public const RETURNABLE_STATUSES = ['issued', 'partially_returned', 'completed'];

    /** How much of this pass has still not gone back. */
    public function outstandingQty(): float
    {
        $items = $this->relationLoaded('items') ? $this->items : $this->items()->get();

        return round($items->sum(fn ($i) => $i->outstandingQty()), 2);
    }

    /**
     * Can goods still be booked back against this pass? The one rule the
     * return form, the Gate Pass Out and the UI all read, so they cannot drift.
     */
    public function canAcceptReturns(): bool
    {
        return in_array($this->status, self::RETURNABLE_STATUSES, true)
            && $this->outstandingQty() > 0;
    }

    public function returnState(): string
    {
        $items = $this->relationLoaded('items') ? $this->items : $this->items()->get();
        if ($items->isEmpty()) return 'none';

        $returned = (float) $items->sum('returned_qty');
        if ($returned <= 0) return 'none';

        return $items->every(fn ($i) => $i->isFullyReturned()) ? 'full' : 'partial';
    }

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
