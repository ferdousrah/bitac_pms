<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class EntityRevision extends Model
{
    public $timestamps = false; // only created_at

    protected $fillable = [
        'entity_type', 'entity_id', 'revision_no', 'event',
        'snapshot', 'changes', 'grand_total_at',
        'changed_by', 'change_reason', 'auto_summary',
        'center_id',
    ];

    protected $casts = [
        'snapshot'       => 'array',
        'changes'        => 'array',
        'created_at'     => 'datetime',
        'grand_total_at' => 'decimal:2',
    ];

    public function changedBy()
    {
        return $this->belongsTo(User::class, 'changed_by');
    }

    /**
     * Event icons + colors for UI timeline.
     */
    public static function eventMeta(string $event): array
    {
        return match ($event) {
            'created'                 => ['icon' => 'fi-rr-plus',          'color' => 'blue',    'label' => 'Created'],
            'updated'                 => ['icon' => 'fi-rr-pencil',        'color' => 'slate',   'label' => 'Updated'],
            'submitted_for_approval'  => ['icon' => 'fi-rr-paper-plane',   'color' => 'amber',   'label' => 'Submitted for Approval'],
            'approved'                => ['icon' => 'fi-rr-check',         'color' => 'emerald', 'label' => 'Approved'],
            'rejected'                => ['icon' => 'fi-rr-cross',         'color' => 'red',     'label' => 'Rejected'],
            'changes_requested'       => ['icon' => 'fi-rr-edit',          'color' => 'orange',  'label' => 'Changes Requested'],
            'resubmitted'             => ['icon' => 'fi-rr-refresh',       'color' => 'indigo',  'label' => 'Resubmitted'],
            'used_as_quotation'       => ['icon' => 'fi-rr-arrow-right',   'color' => 'purple',  'label' => 'Used as Quotation'],
            'converted_to_workorder'  => ['icon' => 'fi-rr-tools',         'color' => 'blue',    'label' => 'Converted to Work Order'],
            'sent_to_customer'        => ['icon' => 'fi-rr-paper-plane',   'color' => 'indigo',  'label' => 'Sent to Customer'],
            'customer_accepted'       => ['icon' => 'fi-rr-thumbs-up',     'color' => 'emerald', 'label' => 'Customer Accepted'],
            'customer_rejected'       => ['icon' => 'fi-rr-thumbs-down',   'color' => 'red',     'label' => 'Customer Rejected'],
            default                   => ['icon' => 'fi-rr-file',          'color' => 'slate',   'label' => ucfirst(str_replace('_', ' ', $event))],
        };
    }
}
