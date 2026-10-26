<?php

namespace App\Services;

use App\Models\DeliveryOrder;

/**
 * The delivery challan is signed by PCD's নির্বাহী প্রকৌশলী (BITAC,
 * 2026-10-27): *"Delivery Challan create/initiate hoar por ata PCD'r XEN er
 * kase jabe signature or approve er jonne, xen ata approve korle sign boshe
 * jabe, approve korar por billing and accounts e visible hobe."*
 *
 * - Raised → `pending`, and the XEN is told.
 * - He signs → `approved`: his signature prints in the challan's
 *   "Executive Engineer, Production Control Division" block, the delivery
 *   can be confirmed (BITAC: not before — the signed paper goes with the
 *   goods), and Billing & Accounts can see it.
 * - He rejects (reason required) → the delivery is CANCELLED, which frees its
 *   quantities, and PCD raises a corrected one. A delivery cannot be edited,
 *   so there is nothing to send back to.
 *
 * ⚠️ No XEN at the centre → approved on the spot, unsigned. A gate with
 * nobody behind it must not hold the goods (the PcdReleaseService rule; the
 * XEN pool is the same one, `PcdReleaseService::xenIdsAt`).
 */
class ChallanApproval
{
    /** A new delivery's challan: to the XEN, or straight through if there is none. */
    public static function request(DeliveryOrder $delivery): bool
    {
        $xens = PcdReleaseService::xenIdsAt($delivery->center_id);

        if ($xens === []) {
            $delivery->update(['challan_status' => 'approved', 'challan_approved_at' => now()]);
            return false;
        }

        $delivery->update(['challan_status' => 'pending']);

        // A XEN who raised it himself signs it from his inbox; no notice to him.
        $tell = array_values(array_diff($xens, [(int) auth()->id()]));
        if ($tell === []) return true;

        $delivery->loadMissing('workOrder', 'customer');
        NotifyService::send($tell, 'challan_awaiting_signature',
            "Delivery challan {$delivery->challan_number} — your signature needed",
            ($delivery->type === 'partial' ? 'Partial delivery' : 'Delivery')
                . " of {$delivery->quantity_delivered} pcs, job #{$delivery->workOrder?->job_number}"
                . ($delivery->customer ? " for {$delivery->customer->name}" : '') . '.',
            '/pcd/inbox#challans', 'fi-rr-file-signature', 'amber');

        return true;
    }

    /** May this person sign this challan? A XEN of its own centre. */
    public static function maySign(DeliveryOrder $delivery, ?int $userId): bool
    {
        return $userId && in_array($userId, PcdReleaseService::xenIdsAt($delivery->center_id), true);
    }

    public static function approve(DeliveryOrder $delivery, ?string $signaturePath): void
    {
        $delivery->update([
            'challan_status'         => 'approved',
            'challan_approved_by'    => auth()->id(),
            'challan_approved_at'    => now(),
            'challan_signature_path' => $signaturePath,
        ]);

        if ($delivery->created_by && (int) $delivery->created_by !== (int) auth()->id()) {
            NotifyService::send($delivery->created_by, 'challan_signed',
                "Challan {$delivery->challan_number} signed",
                (auth()->user()?->name ?? 'The Executive Engineer') . ' signed it — the delivery can go and be confirmed.',
                "/delivery/{$delivery->id}", 'fi-rr-badge-check', 'green');
        }
    }

    public static function reject(DeliveryOrder $delivery, string $reason): void
    {
        $delivery->update([
            'challan_status'           => 'rejected',
            'challan_rejected_by'      => auth()->id(),
            'challan_rejected_at'      => now(),
            'challan_rejection_reason' => $reason,
            // Frees the quantities (DeliveryOrder::COMMITTED leaves it out).
            'status'                   => 'cancelled',
        ]);

        // The job may have gone "ready for delivery" because this delivery
        // committed the last of it — with it gone, that is no longer true.
        $wo = $delivery->workOrder;
        if ($wo && $wo->status === 'ready_for_delivery' && $wo->committedDeliveryQty() < (float) $wo->quantity - 0.001) {
            $wo->update(['status' => $wo->deliveredQty() > 0 ? 'partially_delivered'
                : ($wo->qcPassedQty() >= (float) $wo->quantity - 0.001 ? 'qc_passed' : 'qc_hold')]);
        }

        if ($delivery->created_by && (int) $delivery->created_by !== (int) auth()->id()) {
            NotifyService::send($delivery->created_by, 'challan_rejected',
                "Challan {$delivery->challan_number} rejected",
                (auth()->user()?->name ?? 'The Executive Engineer') . " did not sign it, and the delivery was cancelled.\n\nReason: {$reason}",
                "/delivery/{$delivery->id}", 'fi-rr-cross-circle', 'red');
        }
    }
}
