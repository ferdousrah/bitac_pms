<?php

namespace App\Models;

use App\Traits\HasCenter;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Storage;

/**
 * A quotation request sent in from the public website (Contact → "Want a
 * quotation?"). It is NOT an RFQ until IED converts it — see the migration.
 */
class QuotationRequest extends Model
{
    use HasCenter;

    protected $fillable = [
        'reference_no', 'center_id', 'site_office_id',
        'name', 'organisation', 'designation', 'email', 'phone', 'address',
        'subject', 'description', 'quantity', 'unit', 'needed_by',
        'status', 'staff_note', 'handled_by', 'handled_at',
        'customer_id', 'rfq_id', 'converted_at', 'ip', 'user_agent',
    ];

    protected $casts = [
        'quantity'     => 'float',
        'needed_by'    => 'date',
        'handled_at'   => 'datetime',
        'converted_at' => 'datetime',
    ];

    public const STATUSES = [
        'new'       => 'New',
        'in_review' => 'In review',
        'converted' => 'Converted to RFQ',
        'closed'    => 'Closed',
        'spam'      => 'Spam',
    ];

    /** Statuses a person may set by hand. `converted` only comes from converting. */
    public const SETTABLE = ['new', 'in_review', 'closed', 'spam'];

    /** Upload rules, shared by the form's validation and its hint text. */
    public const FILE_EXT  = ['pdf', 'jpg', 'jpeg', 'png', 'webp', 'dwg', 'dxf', 'doc', 'docx', 'xls', 'xlsx'];
    public const MAX_FILES = 5;
    public const MAX_KB    = 10240;

    public function files()    { return $this->hasMany(QuotationRequestFile::class)->orderBy('id'); }
    public function office()   { return $this->belongsTo(SiteOffice::class, 'site_office_id'); }
    public function handler()  { return $this->belongsTo(User::class, 'handled_by'); }
    public function customer() { return $this->belongsTo(Customer::class); }
    public function rfq()      { return $this->belongsTo(Rfq::class); }

    public function getStatusLabelAttribute(): string
    {
        return self::STATUSES[$this->status] ?? ucfirst(str_replace('_', ' ', $this->status));
    }

    /** QR-2026-0001 — numbered per calendar year, from the highest issued. */
    public static function nextReference(): string
    {
        $prefix = 'QR-' . now()->format('Y') . '-';
        $last = static::withoutGlobalScopes()
            ->where('reference_no', 'like', $prefix . '%')
            ->orderByDesc('reference_no')
            ->value('reference_no');
        $n = $last ? ((int) substr($last, strlen($prefix))) + 1 : 1;

        return $prefix . str_pad((string) $n, 4, '0', STR_PAD_LEFT);
    }

    /** Remove the request and every file it brought with it. */
    public function deleteWithFiles(): void
    {
        foreach ($this->files as $f) {
            Storage::disk('local')->delete($f->path);
        }
        Storage::disk('local')->deleteDirectory('quotation-requests/' . $this->id);
        $this->delete();
    }
}
