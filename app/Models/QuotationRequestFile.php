<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class QuotationRequestFile extends Model
{
    protected $fillable = ['quotation_request_id', 'path', 'original_name', 'mime', 'size'];

    public const IMAGE_EXT = ['jpg', 'jpeg', 'png', 'webp', 'gif'];

    public function request()
    {
        return $this->belongsTo(QuotationRequest::class, 'quotation_request_id');
    }

    public function isImage(): bool
    {
        return in_array(strtolower(pathinfo($this->original_name, PATHINFO_EXTENSION)), self::IMAGE_EXT, true);
    }
}
