<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class CostEstimateLine extends Model
{
    protected $fillable = [
        'cost_estimate_id', 'section', 'material_id', 'operation_id',
        'description', 'quantity', 'unit', 'rate', 'amount', 'sequence',
    ];

    protected function casts(): array
    {
        return [
            'quantity' => 'decimal:3',
            'rate'     => 'decimal:2',
            'amount'   => 'decimal:2',
        ];
    }

    public function estimate()  { return $this->belongsTo(CostEstimate::class, 'cost_estimate_id'); }
    public function material()  { return $this->belongsTo(Material::class); }
    public function operation() { return $this->belongsTo(MachiningOperation::class, 'operation_id'); }
}
