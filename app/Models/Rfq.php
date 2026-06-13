<?php

namespace App\Models;

use App\Traits\HasCenter;
use Illuminate\Database\Eloquent\Model;

class Rfq extends Model
{
    use HasCenter;

    protected $fillable = [
        'center_id', 'customer_id', 'job_category_id', 'required_by', 'notes', 'rfq_letter_path', 'rfq_letter_title',
        'customer_ref_no', 'job_type',
        'status', 'source', 'created_by', 'reference_type', 'drawing_path', 'sample_received', 'sample_description',
    ];

    protected function casts(): array
    {
        return ['required_by' => 'date', 'sample_received' => 'boolean'];
    }

    public function customer()        { return $this->belongsTo(Customer::class); }
    public function jobCategory()     { return $this->belongsTo(JobCategory::class); }
    public function createdBy()       { return $this->belongsTo(User::class, 'created_by'); }
    public function items()           { return $this->hasMany(RfqItem::class); }
    public function quotations()      { return $this->hasMany(Quotation::class); }
    public function latestQuotation() { return $this->hasOne(Quotation::class)->latest(); }
    public function gatePasses()      { return $this->hasMany(GatePass::class)->latest('pass_date'); }
}
