<?php

namespace App\Traits;

use App\Services\AuditService;
use Illuminate\Database\Eloquent\Model;

/**
 * Writes the audit trail for a record: created, every real change (old → new),
 * deleted. A change that touches `status` is logged as `status_changed`.
 *
 * ⚠️ Passwords and remember tokens are never recorded — a password change is
 * logged as the fact, not the value. Timestamps alone are not a change.
 *
 * Skipped: migrations / seeders / tinker (a deploy must not write thousands of
 * rows as somebody), and the RFQ form's autosave, which saves every 2.5 s.
 */
trait Audited
{
    /** Human names for the Model column and the description. */
    private static array $AUDIT_LABELS = [
        'Rfq'                      => 'RFQ',
        'Quotation'                => 'Quotation',
        'CostEstimate'             => 'Cost estimate',
        'WorkOrder'                => 'Job',
        'DeliveryOrder'            => 'Delivery',
        'Invoice'                  => 'Bill',
        'Payment'                  => 'Payment',
        'GatePass'                 => 'Gate pass',
        'MaterialRequisition'      => 'Material requisition',
        'MusakChallan'             => 'Musak 6.3',
        'MoneyReceipt'             => 'Money receipt',
        'RfqLetter'                => 'Letter',
        'OfficeNote'               => 'Note',
        'TaxRecord'                => 'AIT/VAT record',
        'QuotationApprovalSetting' => 'Approval chain step',
        'GatePassApprover'         => 'Gate pass approver',
        'Center'                   => 'Centre',
        'User'                     => 'User',
        'Customer'                 => 'Client',
    ];

    private static array $AUDIT_IGNORED = ['created_at', 'updated_at', 'remember_token'];
    private static array $AUDIT_SECRET  = ['password'];

    public static function bootAudited(): void
    {
        static::created(fn (Model $m) => static::writeAudit($m, 'created'));
        static::updated(fn (Model $m) => static::writeAudit($m, 'updated'));
        static::deleted(fn (Model $m) => static::writeAudit($m, 'deleted'));
    }

    private static function writeAudit(Model $m, string $event): void
    {
        if (app()->runningInConsole() && ! AuditService::$recordInConsole) return;
        if (request()->routeIs('rfqs.autosave')) return;

        $old = $new = [];
        if ($event === 'updated') {
            foreach (array_keys($m->getChanges()) as $field) {
                if (in_array($field, self::$AUDIT_IGNORED, true)) continue;
                $secret = in_array($field, self::$AUDIT_SECRET, true);
                $old[$field] = $secret ? '••••' : self::auditValue($m->getOriginal($field));
                $new[$field] = $secret ? '(changed)' : self::auditValue($m->getAttribute($field));
            }
            if (! $new) return;   // only timestamps moved
            if (array_key_exists('status', $new)) $event = 'status_changed';
        }

        $label = self::$AUDIT_LABELS[class_basename($m)] ?? class_basename($m);
        $what  = trim($label . ' ' . $m->auditReference());

        $message = match ($event) {
            'created' => "{$what} created",
            'deleted' => "{$what} deleted",
            default   => "{$what}: " . self::auditSummary($old, $new),
        };

        try {
            app(AuditService::class)->log(
                $event, class_basename($m), $m->getKey(), $old,
                $new + ['message' => $message],
                $m->getAttribute('center_id'),
            );
        } catch (\Throwable $e) {
            // The audit trail must never break the act it records.
            \Log::warning('Audit write failed', ['model' => $what, 'error' => $e->getMessage()]);
        }
    }

    /** How the record is named in the log — its own number where it has one. */
    public function auditReference(): string
    {
        foreach (['wo_number', 'estimate_no', 'invoice_number', 'payment_no', 'pass_no', 'mrn_number',
                  'challan_number', 'receipt_no', 'challan_no', 'letter_no', 'note_no', 'name', 'email'] as $col) {
            $v = $this->getAttribute($col);
            if (is_string($v) && trim($v) !== '') return $v;
        }
        $ref = '#' . $this->getKey();
        if ($this->getAttribute('version') && class_basename($this) === 'Quotation') {
            $ref .= ' v' . $this->getAttribute('version');
        }
        return $ref;
    }

    private static function auditValue($v)
    {
        if ($v instanceof \DateTimeInterface) return $v->format('Y-m-d H:i');
        if (is_array($v) || is_object($v)) $v = json_encode($v, JSON_UNESCAPED_UNICODE);
        if (is_string($v) && mb_strlen($v) > 500) $v = mb_substr($v, 0, 500) . '…';
        return $v;
    }

    private static function auditSummary(array $old, array $new): string
    {
        $show = fn ($v) => $v === null || $v === '' ? '—'
            : (mb_strlen((string) $v) > 40 ? mb_substr((string) $v, 0, 40) . '…' : (string) $v);

        $parts = [];
        foreach (array_slice(array_keys($new), 0, 4) as $f) {
            $parts[] = str_replace('_', ' ', $f) . ' ' . $show($old[$f] ?? null) . ' → ' . $show($new[$f]);
        }
        $more = count($new) - 4;
        return implode(' · ', $parts) . ($more > 0 ? " · +{$more} more" : '');
    }
}
