<?php

namespace App\Services;

use App\Models\MaterialRequisition;
use App\Models\User;
use App\Support\SignatureResolver;
use Illuminate\Support\Collection;

/**
 * Who checks and who approves a PCD material requisition (BITAC, 2026-11-01):
 * *"PCD er Material Requisition jei toiri koruk, Checked by AE, approved by XEN PCD."*
 *
 *   Prepared  — whoever raised it (their default signature goes on at submit)
 *   Checked   — an Assistant Engineer (PCD) of the requisition's centre
 *   Approved  — the Executive Engineer (PCD) of that centre (`review pcd-inbox`,
 *               the same officer who releases jobs and signs challans)
 *
 * The pools are worked out when it is that step's turn, never stored, so giving
 * someone the role takes effect on requisitions already waiting.
 *
 * ⚠️ A gate with nobody behind it must not hold the material up:
 *   - no Assistant Engineer (PCD) other than the preparer → the check is
 *     SKIPPED on submit (an AE does not check his own requisition);
 *   - no Executive Engineer (PCD) at the centre → the planning desk marks it
 *     approved, exactly as it did before this chain existed.
 */
class RequisitionApproval
{
    public const CHECKER_ROLE = 'Assistant Engineer (PCD)';

    /** The Assistant Engineers (PCD) who may check it — never its preparer. */
    public static function checkerIds(MaterialRequisition $mr): array
    {
        try {
            $ids = User::role(self::CHECKER_ROLE)
                ->where('is_active', true)
                ->where(fn ($w) => $w->where('center_id', $mr->center_id)->orWhereNull('center_id'))
                ->pluck('id')->map(fn ($id) => (int) $id)->all();
        } catch (\Spatie\Permission\Exceptions\RoleDoesNotExist $e) {
            $ids = [];
        }

        return array_values(array_diff($ids, [(int) $mr->requested_by]));
    }

    /** The Executive Engineers (PCD) of its centre. */
    public static function approverIds(MaterialRequisition $mr): array
    {
        return PcdReleaseService::xenIdsAt($mr->center_id);
    }

    public static function mayCheck(MaterialRequisition $mr, ?User $user): bool
    {
        if (! $user || $mr->status !== 'pending_approval') return false;

        return $user->isSuperAdmin() || in_array((int) $user->id, self::checkerIds($mr), true);
    }

    public static function mayApprove(MaterialRequisition $mr, ?User $user): bool
    {
        if (! $user || $mr->status !== 'checked') return false;
        if ($user->isSuperAdmin()) return true;

        $xens = self::approverIds($mr);

        return $xens === []
            ? $user->can('view pcd-inbox')                       // nobody in the seat — the desk, as before
            : in_array((int) $user->id, $xens, true);
    }

    /** Back to draft: the preparer withdraws it, or the officer whose turn it is sends it back. */
    public static function maySendBack(MaterialRequisition $mr, ?User $user): bool
    {
        if (! $user || ! in_array($mr->status, ['pending_approval', 'checked'], true)) return false;

        return (int) $mr->requested_by === (int) $user->id
            || self::mayCheck($mr, $user) || self::mayApprove($mr, $user);
    }

    /**
     * It has just been submitted. Stamp the preparer's signature, skip the
     * check if there is nobody to do it, and tell whoever is next.
     */
    public static function submitted(MaterialRequisition $mr): string
    {
        $mr->update([
            'prepared_signature_path' => SignatureResolver::defaultPathFor($mr->requested_by),
            'checked_by' => null, 'checked_at' => null, 'checked_signature_path' => null,
            'approved_by' => null, 'approved_at' => null, 'approved_signature_path' => null,
        ]);

        $checkers = self::checkerIds($mr);
        if ($checkers !== []) {
            self::tell($checkers, $mr, 'mr_to_check', "Material requisition {$mr->mrn_number} — to check");
            return ' It has gone to the Assistant Engineer (PCD) to check.';
        }

        // Nobody to check it — straight on to the approval.
        $mr->update(['status' => 'checked', 'checked_at' => now()]);   // checked_at with no checked_by = skipped

        return ' No Assistant Engineer (PCD) to check it, so it went straight on for approval.' . self::askApproval($mr);
    }

    public static function check(MaterialRequisition $mr, User $user, ?string $signaturePath): string
    {
        $mr->update([
            'status' => 'checked',
            'checked_by' => $user->id, 'checked_at' => now(),
            'checked_signature_path' => $signaturePath,
        ]);

        return self::askApproval($mr);
    }

    public static function approve(MaterialRequisition $mr, User $user, ?string $signaturePath): void
    {
        $mr->update([
            'status' => 'approved',
            'approved_by' => $user->id, 'approved_at' => now(),
            'approved_signature_path' => $signaturePath,
        ]);

        $tell = array_diff(array_filter([(int) $mr->requested_by, (int) $mr->checked_by]), [(int) $user->id]);
        self::tell(array_values($tell), $mr, 'mr_approved', "Material requisition {$mr->mrn_number} approved", 'green');
    }

    /** Back to draft. Every signature comes off — whoever signs next signs afresh. */
    public static function sendBack(MaterialRequisition $mr, User $user, string $reason): void
    {
        $byPreparer = (int) $mr->requested_by === (int) $user->id;
        $note = $byPreparer && $reason === '' ? null
            : '[Sent back · ' . $user->name . ', ' . now()->format('d M Y') . ']' . ($reason !== '' ? ' ' . $reason : '');

        $mr->update([
            'status' => 'draft',
            'prepared_signature_path' => null,
            'checked_by' => null, 'checked_at' => null, 'checked_signature_path' => null,
            'approved_by' => null, 'approved_at' => null, 'approved_signature_path' => null,
            'notes' => $note ? trim(($mr->notes ? $mr->notes . "\n" : '') . $note) : $mr->notes,
        ]);

        if (! $byPreparer) {
            self::tell([(int) $mr->requested_by], $mr, 'mr_sent_back',
                "Material requisition {$mr->mrn_number} sent back", 'red', $reason);
        }
    }

    /** What is waiting on this person, oldest first — the inbox card and the list's tab. */
    public static function waitingFor(User $user): Collection
    {
        return MaterialRequisition::with(['workOrder:id,wo_number,job_number,customer_id', 'workOrder.customer:id,name',
                'section:id,name', 'requestedBy:id,name', 'checkedBy:id,name', 'items'])
            ->whereIn('status', ['pending_approval', 'checked'])
            ->orderBy('updated_at')
            ->get()
            ->filter(fn ($mr) => self::mayCheck($mr, $user) || ($mr->status === 'checked'
                // On the approval step only the XENs count it as theirs; with
                // no XEN the desk approves from the list, not from an inbox.
                && self::approverIds($mr) !== [] && self::mayApprove($mr, $user)))
            ->values();
    }

    /** A plain sentence for the page: what it is waiting on, and who. */
    public static function waitingOn(MaterialRequisition $mr): ?string
    {
        if ($mr->status === 'pending_approval') {
            return 'Waiting for the Assistant Engineer (PCD) to check it.';
        }
        if ($mr->status === 'checked') {
            return self::approverIds($mr) === []
                ? 'No Executive Engineer (PCD) at this centre — the planning desk approves it.'
                : 'Waiting for the Executive Engineer (PCD) to approve it.';
        }

        return null;
    }

    private static function askApproval(MaterialRequisition $mr): string
    {
        $xens = self::approverIds($mr);
        if ($xens === []) return ' There is no Executive Engineer (PCD) at this centre — the planning desk approves it.';

        self::tell($xens, $mr, 'mr_to_approve', "Material requisition {$mr->mrn_number} — to approve");

        return ' It has gone to the Executive Engineer (PCD) for approval.';
    }

    private static function tell(array $ids, MaterialRequisition $mr, string $type, string $title, string $color = 'amber', string $extra = ''): void
    {
        $ids = array_values(array_diff($ids, [(int) auth()->id()]));
        if ($ids === []) return;

        $mr->loadMissing('workOrder', 'section');
        $for = $mr->workOrder ? "Job #{$mr->workOrder->job_number} ({$mr->workOrder->wo_number})" : ('No job — ' . ($mr->section?->name ?? 'shop use'));
        NotifyService::send($ids, $type, $title, $for . ($extra !== '' ? " — {$extra}" : '') . '.',
            "/pcd/material-requisitions/{$mr->id}", 'fi-rr-clipboard-list', $color);
    }
}
