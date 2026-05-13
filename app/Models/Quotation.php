<?php

namespace App\Models;

use App\Traits\HasCenter;
use Illuminate\Database\Eloquent\Model;

class Quotation extends Model
{
    use HasCenter;

    protected $fillable = [
        'center_id', 'rfq_id', 'customer_id', 'work_order_id', 'created_by', 'version',
        'material_cost', 'labour_cost', 'overhead_cost', 'profit_margin',
        'discount', 'vat_rate', 'vat_amount', 'total_amount',
        'validity_days', 'status', 'notes',
        'sent_to_customer_at', 'customer_responded_at', 'parent_quotation_id', 'customer_po_no',
        // BITAC official quotation letter fields
        'memo_no', 'customer_ref_no', 'customer_ref_date', 'recipient_block', 'terms',
    ];

    protected function casts(): array
    {
        return [
            'sent_to_customer_at'   => 'datetime',
            'customer_responded_at' => 'datetime',
            'customer_ref_date'     => 'date',
            'terms'                 => 'array',
        ];
    }

    public function rfq()              { return $this->belongsTo(Rfq::class); }
    public function customer()         { return $this->belongsTo(Customer::class); }
    public function workOrder()        { return $this->belongsTo(WorkOrder::class); }
    public function createdBy()        { return $this->belongsTo(User::class, 'created_by'); }
    public function items()            { return $this->hasMany(QuotationItem::class); }
    public function files()            { return $this->hasMany(QuotationFile::class)->orderBy('sort_order')->orderBy('id'); }
    public function approvals()        { return $this->hasMany(QuotationApproval::class); }
    public function customerResponses(){ return $this->hasMany(CustomerResponse::class)->latest('response_date'); }
    public function latestResponse()   { return $this->hasOne(CustomerResponse::class)->latest('response_date'); }

    /** Self-referential parent/child for revisions */
    public function parent()           { return $this->belongsTo(Quotation::class, 'parent_quotation_id'); }
    public function revisions()        { return $this->hasMany(Quotation::class, 'parent_quotation_id'); }

    /**
     * Get the entire revision chain (root to latest) for this quotation.
     */
    public function revisionChain()
    {
        $root = $this;
        while ($root->parent_quotation_id) {
            $root = $root->parent;
        }

        $chain = collect([$root]);
        $current = $root;
        while ($current->revisions()->exists()) {
            $next = $current->revisions()->latest()->first();
            if ($next) {
                $chain->push($next);
                $current = $next;
            } else {
                break;
            }
        }
        return $chain;
    }
}
