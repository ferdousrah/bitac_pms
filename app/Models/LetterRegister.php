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
        'rfq_letter_id',
    ];

    protected function casts(): array
    {
        return ['letter_date' => 'date'];
    }

    public function createdBy() { return $this->belongsTo(User::class, 'created_by'); }
    public function rfqLetter() { return $this->belongsTo(RfqLetter::class); }

    /** Entered by IED → Letters, and kept in step by it — not edited here. */
    public function isFromLetters(): bool
    {
        return $this->rfq_letter_id !== null;
    }

    /**
     * Enter an ISSUED letter from IED → Letters in IED's প্রেরিত register, or
     * bring its entry up to date. A draft has not gone anywhere and is not
     * entered. One row per letter (`rfq_letter_id` is unique).
     */
    public static function syncFromRfqLetter(RfqLetter $letter): void
    {
        if ($letter->status === 'draft') return;

        $signer = $letter->signatory;
        $sender = $signer
            ? trim($signer->name . ($signer->designation ? ', ' . $signer->designation : ''))
            : 'IED, BITAC';

        $lines     = preg_split('/\r\n|\r|\n/', (string) $letter->recipient_block);
        $recipient = implode(', ', array_filter(array_map('trim', $lines), fn ($l) => $l !== ''));
        if ($recipient === '') $recipient = $letter->customer?->name ?: '—';

        static::withoutGlobalScopes()->updateOrCreate(
            ['rfq_letter_id' => $letter->id],
            [
                'center_id'   => $letter->center_id,
                'desk'        => 'ied',
                'direction'   => 'out',
                'sender'      => mb_substr($sender, 0, 255),
                'recipient'   => mb_substr($recipient, 0, 255),
                'memo_no'     => $letter->letter_no ? mb_substr($letter->letter_no, 0, 120) : null,
                'letter_date' => $letter->letter_date ?? $letter->issued_at ?? now(),
                'remarks'     => $letter->subject ? mb_substr(strip_tags($letter->subject), 0, 2000) : null,
                'created_by'  => $letter->created_by,
            ],
        );
    }
}
