<?php

namespace App\Models;

use App\Traits\HasCenter;
use Illuminate\Database\Eloquent\Model;

/**
 * One letter in a desk's register — received (`in`, আগত) or sent (`out`,
 * প্রেরিত). IED and PCD each keep both (BITAC, 2026-10-31).
 */
class LetterRegister extends Model
{
    use HasCenter;

    public const DESKS = ['ied' => 'IED', 'pcd' => 'PCD'];

    public const DIRECTIONS = [
        'in'  => ['bn' => 'আগত চিঠির রেকর্ড',   'en' => 'Incoming Letters'],
        'out' => ['bn' => 'প্রেরিত চিঠির রেকর্ড', 'en' => 'Outgoing Letters'],
    ];

    protected $fillable = [
        'center_id', 'desk', 'direction', 'sender', 'recipient', 'memo_no',
        'letter_date', 'remarks', 'file_path', 'file_name', 'created_by',
    ];

    protected function casts(): array
    {
        return ['letter_date' => 'date'];
    }

    public function createdBy() { return $this->belongsTo(User::class, 'created_by'); }
}
