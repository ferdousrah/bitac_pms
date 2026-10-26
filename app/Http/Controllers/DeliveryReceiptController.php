<?php

namespace App\Http\Controllers;

use App\Models\DeliveryOrder;
use App\Services\DeliveryReceipt;
use App\Support\AuthBranding;
use Illuminate\Http\Request;
use Inertia\Inertia;

/**
 * The PUBLIC page the receiver signs on — `/receive/{token}`, opened from the
 * QR code on PCD's screen, a WhatsApp link, or BITAC's tablet. No login: the
 * token is the key (App\Services\DeliveryReceipt).
 *
 * ⚠️ It is public, so it shows only what the receiver is signing for — the
 * challan, the job and the items with their quantities. No prices, no client
 * contacts, nothing from the rest of the system.
 */
class DeliveryReceiptController extends Controller
{
    public function show(string $token)
    {
        $d = DeliveryReceipt::find($token);

        return Inertia::render('Public/ReceiveDelivery', [
            'state'    => $d ? DeliveryReceipt::state($d) : 'invalid',
            'delivery' => $d ? $this->pack($d) : null,
            'signedBy' => $d?->pod?->isSignature() ? $d->pod->received_by : null,
            'bitac'    => AuthBranding::bitac(),
            'token'    => $token,
        ]);
    }

    public function store(Request $request, string $token)
    {
        $d = DeliveryReceipt::find($token);
        if (! $d || DeliveryReceipt::state($d) !== 'ok') {
            return redirect("/receive/{$token}");    // the page says why
        }

        $data = $request->validate([
            'name'        => 'required|string|max:120',
            'designation' => 'nullable|string|max:120',
            'phone'       => 'required|string|max:40',
            'signature'   => 'required|string|max:1500000',
            'confirm'     => 'accepted',
        ], [
            'signature.required' => 'Please sign in the box.',
            'confirm.accepted'   => 'Please confirm you have received the goods.',
        ]);

        // ⚠️ Anyone with the link can post here, so the "signature" must really
        // be a PNG image of a sane size before it is written to disk.
        $png = str_starts_with($data['signature'], 'data:image/png;base64,')
            ? base64_decode(substr($data['signature'], 22), true) : false;
        $info = $png ? @getimagesizefromstring($png) : false;
        if (! $info || $info[2] !== IMAGETYPE_PNG || $info[0] > 4000 || $info[1] > 2000) {
            return back()->withErrors(['signature' => 'The signature could not be read — please sign again.']);
        }

        DeliveryReceipt::sign($d, $data, $data['signature'], $request->ip());

        return redirect("/receive/{$token}");
    }

    private function pack(DeliveryOrder $d): array
    {
        $d->loadMissing(['workOrder:id,job_number,wo_number,customer_id', 'workOrder.customer:id,name', 'items']);

        return [
            'challan_number' => $d->challan_number,
            'type'           => $d->type,
            'customer'       => $d->workOrder?->customer?->name,
            'job_number'     => $d->workOrder?->job_number,
            'vehicle'        => $d->vehicle_number,
            'date'           => now()->format('d M Y'),
            'lines'          => $d->items->map(fn ($i) => [
                'part_no'     => $i->part_no,
                'description' => $i->description,
                'quantity'    => (float) $i->quantity,
                'unit'        => $i->unit,
            ])->values(),
            'quantity'       => (float) $d->quantity_delivered,
        ];
    }
}
