<?php

namespace App\Http\Controllers\Pcd;

use App\Http\Controllers\Controller;
use App\Models\DeliveryOrder;
use App\Services\ChallanApproval;
use App\Support\SignatureResolver;
use Illuminate\Http\Request;

/**
 * PCD's নির্বাহী প্রকৌশলী signs — or rejects — a delivery challan from his
 * PCD Inbox (App\Services\ChallanApproval holds the rules).
 *
 * Refusals are redirect + flash, never abort(): a second click, or a challan
 * someone else has already decided, must read as a message, not a crash.
 */
class ChallanSignController extends Controller
{
    /** The challans waiting for this officer, for the inbox. */
    public static function waiting(): \Illuminate\Support\Collection
    {
        return DeliveryOrder::with(['workOrder:id,wo_number,job_number,quantity,customer_id', 'workOrder.customer:id,name', 'items', 'createdBy:id,name'])
            ->where('challan_status', 'pending')
            ->orderBy('created_at')
            ->get()
            ->filter(fn ($d) => ChallanApproval::maySign($d, (int) auth()->id()))
            ->map(fn (DeliveryOrder $d) => [
                'id'             => $d->id,
                'challan_number' => $d->challan_number,
                'type'           => $d->type,
                'job_number'     => $d->workOrder?->job_number,
                'wo_number'      => $d->workOrder?->wo_number,
                'customer'       => $d->workOrder?->customer?->name,
                'quantity'       => (float) $d->quantity_delivered,
                'ordered'        => (float) ($d->workOrder?->quantity ?? 0),
                'lines'          => $d->items->map(fn ($i) => [
                    'description' => $i->description, 'quantity' => (float) $i->quantity, 'unit' => $i->unit,
                ])->values(),
                'vehicle'        => $d->vehicle_number,
                'raised_by'      => $d->createdBy?->name,
                'raised_at'      => $d->created_at?->format('d M Y, h:i A'),
                'waiting_days'   => $d->created_at?->diffInDays(now()),
                'pdf_url'        => "/pcd/inbox/challans/{$d->id}/pdf?preview=base64",
            ])->values();
    }

    public function pdf(Request $request, DeliveryOrder $delivery)
    {
        return app(PcdDeliveryController::class)->challan($request, $delivery);
    }

    public function approve(Request $request, DeliveryOrder $delivery)
    {
        if ($r = $this->blocker($delivery)) return $r;

        $request->validate(SignatureResolver::rules());
        // His chosen block, else a drawn one, else his default — refusing
        // anyone else's block by id.
        $path = SignatureResolver::resolve(
            $request->integer('user_signature_id') ?: null, $request->input('signature'),
            'signatures/challans', (int) auth()->id()
        ) ?? SignatureResolver::defaultPathFor((int) auth()->id());

        ChallanApproval::approve($delivery, $path);

        return back()->with('success', "Challan {$delivery->challan_number} signed — the delivery can now go.");
    }

    public function reject(Request $request, DeliveryOrder $delivery)
    {
        if ($r = $this->blocker($delivery)) return $r;

        $data = $request->validate(['reason' => 'required|string|min:3|max:1000']);
        ChallanApproval::reject($delivery, $data['reason']);

        return back()->with('success', "Challan {$delivery->challan_number} rejected — the delivery was cancelled.");
    }

    private function blocker(DeliveryOrder $delivery)
    {
        if ($delivery->challan_status !== 'pending') {
            return back()->with('error', "Challan {$delivery->challan_number} is not waiting for a signature — it is "
                . strtolower(DeliveryOrder::CHALLAN_STATUSES[$delivery->challan_status] ?? 'decided') . '.');
        }
        if (! ChallanApproval::maySign($delivery, (int) auth()->id())) {
            return back()->with('error', "Only PCD's নির্বাহী প্রকৌশলী of this centre signs challan {$delivery->challan_number}.");
        }

        return null;
    }
}
