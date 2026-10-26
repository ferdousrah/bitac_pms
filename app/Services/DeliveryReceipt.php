<?php

namespace App\Services;

use App\Models\DeliveryOrder;
use App\Models\ProofOfDelivery;
use App\Support\SignatureResolver;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

/**
 * The client's man signs for the goods (BITAC, 2026-10-27) — two ways:
 *
 *  1. **A one-time link.** PCD opens it on screen as a QR code (or sends it on
 *     WhatsApp); the receiver opens it on his own phone — or BITAC's tablet —
 *     types his name, designation and phone, and signs with his finger. PCD's
 *     page sees it arrive and confirms the delivery.
 *  2. **A photo of the paper.** He signs the printed challan with a pen; PCD
 *     uploads a photo of it with his name, designation and phone.
 *
 * Either way it is the delivery's `ProofOfDelivery`, and the challan prints
 * it in the "Signature of receiver" block.
 *
 * ⚠️ The link is a bearer token on a PUBLIC page, so: 48 random characters,
 * valid for 24 hours, used once; it only opens a challan the XEN has signed
 * and that is not yet delivered, and shows no money — challan, job and the
 * items being taken, nothing more.
 */
class DeliveryReceipt
{
    public const LINK_HOURS = 24;

    /** Why no link can be made / signed for this delivery now; null when it can. */
    public static function blocker(DeliveryOrder $d): ?string
    {
        if (! $d->isChallanSigned()) return 'The challan is not signed by the নির্বাহী প্রকৌশলী (PCD) yet.';
        if (! in_array($d->status, ['scheduled', 'dispatched'], true)) return 'This delivery is already ' . $d->status . '.';

        return null;
    }

    /**
     * A fresh link. Any earlier link stops working, and a signature collected
     * on it that PCD had not yet confirmed is discarded — "send a new link"
     * is how a wrong signer is put right.
     */
    public static function issue(DeliveryOrder $d): string
    {
        self::discardUnconfirmed($d);

        $d->update([
            'receipt_token'            => Str::random(48),
            'receipt_token_expires_at' => now()->addHours(self::LINK_HOURS),
        ]);

        return self::url($d);
    }

    public static function url(DeliveryOrder $d): string
    {
        return url('/receive/' . $d->receipt_token);
    }

    /** The delivery behind a link, whatever its state (the page explains the state). */
    public static function find(string $token): ?DeliveryOrder
    {
        if (strlen($token) < 40) return null;

        return DeliveryOrder::withoutGlobalScopes()->where('receipt_token', $token)->first();
    }

    /** ok | signed | expired | closed — what the public page shows. */
    public static function state(DeliveryOrder $d): string
    {
        if ($d->pod && $d->pod->isSignature()) return 'signed';
        if (self::blocker($d)) return 'closed';
        if (! $d->receipt_token_expires_at || $d->receipt_token_expires_at->isPast()) return 'expired';

        return 'ok';
    }

    /** The receiver signs on the link. */
    public static function sign(DeliveryOrder $d, array $who, string $drawn, ?string $ip): ProofOfDelivery
    {
        $path = SignatureResolver::storeDrawn($drawn, 'pod');

        $pod = ProofOfDelivery::create([
            'delivery_order_id'    => $d->id,
            'received_by'          => $who['name'],
            'receiver_designation' => $who['designation'] ?? null,
            'receiver_phone'       => $who['phone'] ?? null,
            'proof_type'           => 'signature',
            'proof_path'           => $path,
            'delivered_at'         => now(),
            'signed_ip'            => $ip,
        ]);

        // Used: the link now only says "already signed".
        $d->update(['receipt_token_expires_at' => now()]);

        if ($d->created_by) {
            NotifyService::send($d->created_by, 'delivery_receiver_signed',
                "{$who['name']} signed for challan {$d->challan_number}",
                'The receiver has signed — confirm the delivery.',
                "/delivery/{$d->id}", 'fi-rr-signature', 'green');
        }

        return $pod;
    }

    /** A link signature PCD has not confirmed yet is thrown away (with its file). */
    public static function discardUnconfirmed(DeliveryOrder $d): void
    {
        $pod = $d->pod()->first();
        if ($pod && $d->status !== 'delivered') {
            if ($pod->proof_path) Storage::disk('public')->delete($pod->proof_path);
            $pod->delete();
        }
        $d->unsetRelation('pod');
    }

    /** What PCD's page shows about the receiver's signature. */
    public static function packForStaff(DeliveryOrder $d): array
    {
        $pod  = $d->pod;
        $live = $d->receipt_token && $d->receipt_token_expires_at?->isFuture();
        $url  = $live ? self::url($d) : null;

        return [
            'link'       => $url,
            'qr_svg'     => $url ? (string) \SimpleSoftwareIO\QrCode\Facades\QrCode::format('svg')->size(220)->margin(1)->generate($url) : null,
            'expires_at' => $live ? $d->receipt_token_expires_at->format('d M Y, h:i A') : null,
            'signed'     => $pod ? [
                'type'        => $pod->proof_type,
                'name'        => $pod->received_by,
                'designation' => $pod->receiver_designation,
                'phone'       => $pod->receiver_phone,
                'at'          => $pod->delivered_at?->format('d M Y, h:i A'),
                'url'         => $pod->proof_url,
            ] : null,
        ];
    }
}
