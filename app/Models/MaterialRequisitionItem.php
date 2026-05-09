<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class MaterialRequisitionItem extends Model
{
    protected $fillable = [
        'material_requisition_id', 'item_no', 'description', 'material_id',
        'unit', 'required_qty', 'stock_qty', 'issue_qty', 'pending_qty',
        'issue_date', 'remarks',
    ];

    protected function casts(): array
    {
        return [
            'required_qty' => 'decimal:3',
            'stock_qty'    => 'decimal:3',
            'issue_qty'    => 'decimal:3',
            'pending_qty'  => 'decimal:3',
            'issue_date'   => 'date',
        ];
    }

    public function requisition() { return $this->belongsTo(MaterialRequisition::class, 'material_requisition_id'); }
    public function material()    { return $this->belongsTo(Material::class); }
}
