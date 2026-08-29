<?php

namespace App\Models;

use App\Traits\HasCenter;
use Illuminate\Database\Eloquent\Model;

class RfqItem extends Model
{
    use HasCenter;

    protected $fillable = [
        'rfq_id', 'center_id', 'product_id', 'job_description', 'quantity', 'unit', 'notes',
        'reference_type', 'drawing_path', 'sample_received', 'sample_description', 'sample_photo_path',
    ];

    protected $casts = [
        'sample_received' => 'boolean',
    ];

    public function rfq()     { return $this->belongsTo(Rfq::class); }
    public function product() { return $this->belongsTo(Product::class); }

    /** Parts this job item is broken down into (numbered positionally). */
    public function parts()
    {
        return $this->hasMany(RfqItemPart::class)->orderBy('sort_order')->orderBy('id');
    }

    public function files()
    {
        return $this->hasMany(RfqItemFile::class)->orderBy('sort_order');
    }

    public function drawings()
    {
        return $this->hasMany(RfqItemFile::class)->where('type', 'drawing')->orderBy('sort_order');
    }

    public function samplePhotos()
    {
        return $this->hasMany(RfqItemFile::class)->where('type', 'sample_photo')->orderBy('sort_order');
    }

    public function costEstimates()
    {
        return $this->hasMany(CostEstimate::class)->latest();
    }
}
