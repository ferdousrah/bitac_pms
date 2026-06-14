<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class ProductionMessage extends Model
{
    protected $fillable = [
        'operation_sheet_id', 'section_id', 'author_id',
        'author_role', 'body',
    ];

    public function operationSheet() { return $this->belongsTo(OperationSheet::class); }
    public function section()        { return $this->belongsTo(Section::class); }
    public function author()         { return $this->belongsTo(User::class, 'author_id'); }
    public function files()          { return $this->hasMany(ProductionMessageFile::class)->orderBy('id'); }
}
