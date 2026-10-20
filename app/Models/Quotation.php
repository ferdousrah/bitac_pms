<?php

namespace App\Models;

use App\Traits\HasCenter;
use Illuminate\Database\Eloquent\Model;

class Quotation extends Model
{
    use HasCenter;

    protected $fillable = [
        'center_id', 'rfq_id', 'customer_id', 'work_order_id', 'job_category_id', 'created_by', 'version',
        'material_cost', 'labour_cost', 'overhead_cost', 'profit_margin',
        'discount', 'vat_rate', 'vat_amount', 'tax_rate', 'tax_amount', 'show_tax_breakdown', 'total_amount',
        'validity_days', 'status', 'notes',
        'sent_to_customer_at', 'customer_responded_at', 'parent_quotation_id', 'customer_po_no',
        // BITAC official quotation letter fields
        'memo_no', 'memo_date', 'customer_ref_no', 'customer_ref_date', 'recipient_block', 'terms',
        'forwarding_letter', 'forwarding_letter_subject', 'discount_type',
    ];

    protected function casts(): array
    {
        return [
            'sent_to_customer_at'   => 'datetime',
            'customer_responded_at' => 'datetime',
            'memo_date'             => 'date',
            'customer_ref_date'     => 'date',
            'terms'                 => 'array',
            'show_tax_breakdown'    => 'boolean',
        ];
    }

    public function rfq()              { return $this->belongsTo(Rfq::class); }
    public function customer()         { return $this->belongsTo(Customer::class); }
    public function jobCategory()      { return $this->belongsTo(JobCategory::class); }
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

    // ── Which version a report counts ────────────────────────────────────

    /**
     * Statuses that mean the quotation was given out (or ready to go) and is
     * a real figure. `superseded` is handled separately — see applyStanding().
     */
    public const GIVEN_STATUSES = [
        'approved', 'sent_to_customer', 'revision_requested',
        'customer_accepted', 'customer_rejected', 'converted',
    ];

    /**
     * Narrow a query on `quotations` (aliased `$alias`) to the ONE version per
     * RFQ that a report should count: the newest version that was given out.
     *
     * BITAC (2026-10-20): once a re-quotation is given, every figure uses the
     * re-quotation's price. So:
     *  - v1 sent, v2 still a draft or awaiting approval → **v1 counts**. The
     *    customer is holding v1's price; the job must not vanish from the
     *    reports while the re-quotation is being prepared. (Creating the
     *    revision marks v1 `superseded` at once, which is why a plain "not
     *    superseded" filter dropped the job entirely in that window.)
     *  - v2 given → **v2 counts, v1 does not**. Never both.
     *  - A superseded version counts only if it actually went out
     *    (`sent_to_customer_at`); one superseded by "request changes" during
     *    approval never reached anybody.
     *
     * Versions are numbered per RFQ (`getNextVersion($rfqId)`), so the RFQ is
     * the chain. Works on Eloquent and on `DB::table()` builders alike.
     *
     * `$approvedCounts = false` is the stricter reading the pipeline's
     * "Quoted" stage uses: an approved re-quotation that has not gone out yet
     * has not replaced what the customer is holding.
     */
    public static function applyStanding($query, string $alias = 'quotations', bool $approvedCounts = true)
    {
        $statuses = $approvedCounts ? self::GIVEN_STATUSES : array_values(array_diff(self::GIVEN_STATUSES, ['approved']));

        $given = function ($q, string $a) use ($statuses) {
            $q->where(fn ($w) => $w->whereIn("{$a}.status", $statuses)
                ->orWhere(fn ($s) => $s->where("{$a}.status", 'superseded')->whereNotNull("{$a}.sent_to_customer_at")));
        };

        $given($query, $alias);

        return $query->whereNotExists(function ($sub) use ($alias, $given) {
            $sub->select(\Illuminate\Support\Facades\DB::raw(1))
                ->from('quotations as newer_q')
                ->whereColumn('newer_q.rfq_id', "{$alias}.rfq_id")
                ->whereColumn('newer_q.version', '>', "{$alias}.version");
            $given($sub, 'newer_q');
        });
    }

    /** The date a quotation counts on: when it went out, else its memo date, else entry. */
    public const QUOTED_DATE_SQL = 'COALESCE(DATE(%1$s.sent_to_customer_at), %1$s.memo_date, DATE(%1$s.created_at))';

    public static function quotedDateSql(string $alias = 'quotations'): string
    {
        return sprintf(self::QUOTED_DATE_SQL, $alias);
    }
}
