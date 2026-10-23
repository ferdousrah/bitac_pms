<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/**
 * A Material Requisition Note (MRN) — what PCD asks the store for, against a job.
 *
 * ⚠️ There is NO IMS integration (BITAC, 2026-10-23). The requisition is
 * raised here and then its status is simply moved along by hand as the paper
 * goes through the store. The `ims_*` columns are a read-only legacy snapshot
 * from when a push was planned; nothing writes them.
 */
class MaterialRequisition extends Model
{
    /** Status → label, in the order a requisition moves through them. */
    public const STATUSES = [
        'draft'            => 'Draft',
        'pending_approval' => 'Submitted',
        'approved'         => 'Approved',
        'partially_issued' => 'Partially Issued',
        'issued'           => 'Issued',
        'received'         => 'Received',
        'cancelled'        => 'Cancelled',
    ];

    /** Only these may still be edited — once approved the lines are what the store works from. */
    public const EDITABLE = ['draft', 'pending_approval'];

    /** A requisition that has gone to the store counts for PCD's (optional) MR gate. */
    public const RAISED = ['pending_approval', 'approved', 'partially_issued', 'issued', 'received'];

    /**
     * The hand-moved steps: action → [from statuses, to status]. Recording an
     * issue is NOT here — it carries quantities, and the status follows them.
     */
    public const TRANSITIONS = [
        'submit'  => [['draft'], 'pending_approval'],
        'revert'  => [['pending_approval'], 'draft'],
        'approve' => [['pending_approval'], 'approved'],
        'receive' => [['partially_issued', 'issued'], 'received'],
        'cancel'  => [['draft', 'pending_approval', 'approved'], 'cancelled'],
    ];

    /** Statuses at which the store may record what it handed over. */
    public const ISSUABLE = ['approved', 'partially_issued'];

    protected $fillable = [
        'mrn_number', 'work_order_id', 'section_id', 'request_date',
        'requested_by', 'approved_by', 'approved_at',
        'issued_by', 'issued_at', 'received_by', 'received_at',
        'status', 'notes',
        // Legacy IMS push tracking — read-only, see the class doc.
        'ims_reference', 'ims_pushed_at', 'ims_pushed_by', 'ims_status', 'ims_last_error', 'ims_response',
    ];

    protected function casts(): array
    {
        return [
            'request_date'  => 'date',
            'approved_at'   => 'datetime',
            'issued_at'     => 'datetime',
            'received_at'   => 'datetime',
            'ims_pushed_at' => 'datetime',
            'ims_response'  => 'array',
        ];
    }

    public function imsPushedBy() { return $this->belongsTo(User::class, 'ims_pushed_by'); }

    public function workOrder()  { return $this->belongsTo(WorkOrder::class); }
    /** The shop it is for — what a requisition with NO job says instead (BITAC, 2026-10-23). */
    public function section()    { return $this->belongsTo(Section::class); }
    public function items()      { return $this->hasMany(MaterialRequisitionItem::class)->orderBy('item_no'); }
    public function requestedBy(){ return $this->belongsTo(User::class, 'requested_by'); }
    public function approvedBy() { return $this->belongsTo(User::class, 'approved_by'); }
    public function issuedBy()   { return $this->belongsTo(User::class, 'issued_by'); }
    public function receivedBy() { return $this->belongsTo(User::class, 'received_by'); }

    public function getStatusLabelAttribute(): string
    {
        return self::STATUSES[$this->status] ?? ucfirst(str_replace('_', ' ', (string) $this->status));
    }

    public function isEditable(): bool
    {
        return in_array($this->status, self::EDITABLE, true);
    }

    /** The hand-moved actions open from the current status. */
    public function availableActions(): array
    {
        $out = [];
        foreach (self::TRANSITIONS as $action => [$from]) {
            if (in_array($this->status, $from, true)) $out[] = $action;
        }
        if (in_array($this->status, self::ISSUABLE, true)) $out[] = 'issue';

        return $out;
    }

    public static function generateMrnNumber(): string
    {
        $year = now()->format('Y');
        $last = static::where('mrn_number', 'like', "MRN-{$year}-%")->max('mrn_number');
        $next = $last ? ((int) substr($last, -4)) + 1 : 1;
        return sprintf('MRN-%s-%04d', $year, $next);
    }
}
