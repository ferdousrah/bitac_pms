<?php

namespace App\Http\Controllers;

use App\Models\DeliveryOrder;
use App\Models\ProofOfDelivery;
use App\Models\WorkOrder;
use App\Services\DeliveryChallanService;
use App\Services\InvoiceService;
use App\Services\NotificationService;
use Illuminate\Http\Request;
use Inertia\Inertia;

class DeliveryController extends Controller
{
    public function __construct(
        private InvoiceService $invoiceService,
        private NotificationService $notificationService
    ) {}

    public function index(Request $request)
    {
        $query = DeliveryOrder::with(['workOrder.product', 'workOrder.customer', 'invoice', 'items', 'challanApprovedBy:id,name']);

        // Search
        if ($search = $request->input('search')) {
            $query->where(function ($q) use ($search) {
                $q->where('challan_number', 'like', "%{$search}%")
                  ->orWhereHas('workOrder', fn($w) => $w->where('wo_number', 'like', "%{$search}%"))
                  ->orWhereHas('workOrder.customer', fn($c) => $c->where('name', 'like', "%{$search}%"));
            });
        }

        // Filter by status
        if ($status = $request->input('status')) {
            $query->where('status', $status);
        }

        // Sorting
        $sort = $request->input('sort', 'id');
        $dir  = $request->input('dir', 'desc');
        $allowed = ['id', 'status', 'scheduled_date', 'created_at'];
        if (in_array($sort, $allowed)) {
            $query->orderBy($sort, $dir === 'asc' ? 'asc' : 'desc');
        } else {
            $query->latest();
        }

        $deliveries = $query->paginate(15)->withQueryString()
            ->through(fn($d) => [
                'id'                  => $d->id,
                'challan_number'      => $d->challan_number,
                'work_order_id'       => $d->work_order_id,
                'wo_number'           => $d->workOrder->wo_number ?? '',
                'customer'            => $d->workOrder->customer->name ?? '',
                'quantity_delivered'  => $d->quantity_delivered,
                'ordered'             => (float) ($d->workOrder->quantity ?? 0),
                'type'                => $d->type,
                'lines'               => $d->items->map(fn ($i) => [
                    'description' => $i->description, 'quantity' => (float) $i->quantity, 'unit' => $i->unit,
                ])->values(),
                'status'              => $d->status,
                'scheduled_date'      => $d->scheduled_date?->format('d/m/Y'),
                'delivered_at'        => $d->delivered_at?->format('d/m/Y H:i'),
                // Billing is a separate act now, so the list has to show which
                // deliveries are still waiting for one.
                'invoice'             => $d->invoice?->only(['id', 'invoice_number']),
                // Signed by PCD's নির্বাহী প্রকৌশলী before it may go (ChallanApproval).
                'challan_status'      => $d->challan_status ?? 'approved',
                'challan_signed_by'   => $d->challanApprovedBy?->name,
                'challan_signed_at'   => $d->challan_approved_at?->format('d/m/Y H:i'),
                'challan_rejection'   => $d->challan_rejection_reason,
            ]);

        return Inertia::render('Delivery/Index', [
            'deliveries' => $deliveries,
            'filters' => [
                'search' => $request->input('search', ''),
                'status' => $request->input('status', ''),
                'sort'   => $sort,
                'dir'    => $dir,
            ],
        ]);
    }

    public function create(Request $request)
    {
        // Any WO with QC-passed-but-undelivered qty can be (partially) shipped —
        // not just fully-QC'd ones. deliverableQty = qcPassed − alreadyCommitted.
        $readyWos = WorkOrder::whereIn('status', ['qc_hold', 'qc_passed', 'ready_for_delivery', 'partially_delivered'])
            ->with(['product', 'customer', 'qcInspections', 'deliveryOrders'])->get()
            ->map(fn($wo) => [
                'id'               => $wo->id,
                'wo_number'        => $wo->wo_number,
                'product'          => $wo->product->name ?? '',
                'customer'         => $wo->customer->name ?? '',
                'quantity'         => (float) $wo->quantity,
                'deliverable'      => $wo->deliverableQty(),
                'customer_address' => $wo->customer->address ?? '',
                // Per item: ordered, already on a delivery, still to go.
                'lines'            => \App\Services\DeliveryLines::forWorkOrder($wo),
                'has_earlier'      => $wo->committedDeliveryQty() > 0.001,
            ])
            ->filter(fn ($w) => $w['deliverable'] > 0.001)
            ->values();

        $preselected = $request->query('work_order_id')
            ? WorkOrder::with(['product', 'customer', 'qcInspections', 'deliveryOrders'])->find($request->query('work_order_id'))
            : null;

        return Inertia::render('Delivery/Create', [
            'workOrders' => $readyWos,
            'workOrder'  => $preselected ? [
                'id'               => $preselected->id,
                'wo_number'        => $preselected->wo_number,
                'quantity'         => (float) $preselected->quantity,
                'deliverable'      => $preselected->deliverableQty(),
                'customer_address' => $preselected->customer->address ?? '',
                'lines'            => \App\Services\DeliveryLines::forWorkOrder($preselected),
                'has_earlier'      => $preselected->committedDeliveryQty() > 0.001,
            ] : null,
        ]);
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'work_order_id'      => 'required|exists:work_orders,id',
            // Full = every item at once; Partial = a quantity per item (BITAC, 2026-10-24).
            'delivery_type'      => 'required|in:full,partial',
            'lines'              => 'required|array|min:1',
            'lines.*.key'        => 'required|integer',
            'lines.*.quantity'   => 'nullable|numeric|min:0',
            'scheduled_date'     => 'nullable|date',
            'delivery_address'   => 'nullable|string',
            'vehicle_number'     => 'nullable|string|max:50',
            'driver_name'        => 'nullable|string|max:100',
            'notes'              => 'nullable|string',
        ]);

        $workOrder = WorkOrder::findOrFail($validated['work_order_id']);
        $fmt = fn ($q) => rtrim(rtrim(number_format((float) $q, 2, '.', ''), '0'), '.');

        // ⚠️ The lines are recomputed here, never trusted from the form: each
        // quantity is checked against what that item still has to go.
        $lines = \App\Services\DeliveryLines::forWorkOrder($workOrder)->keyBy('key');
        $posted = collect($validated['lines'])->values();
        $isFull = $validated['delivery_type'] === 'full';

        $send = []; $errors = [];
        foreach ($posted as $n => $row) {
            $line = $lines->get((int) $row['key']);
            if (! $line) continue;    // an item of another job is ignored
            $qty = $isFull ? $line['remaining'] : round((float) ($row['quantity'] ?? 0), 2);
            if ($qty > $line['remaining'] + 0.001) {
                $errors["lines.{$n}.quantity"] = "Only {$fmt($line['remaining'])} {$line['unit']} of this item are left to deliver.";
            }
            if ($qty > 0) $send[$line['key']] = $qty;
        }
        if ($isFull) {
            // Full means every item, so every item must be in it.
            foreach ($lines as $line) if ($line['remaining'] > 0) $send[$line['key']] = $line['remaining'];
        }
        if ($errors) {
            return back()->withInput()->withErrors($errors);
        }

        $total = array_sum($send);
        if ($total <= 0) {
            return back()->withInput()->withErrors(['lines' => 'Enter a quantity for at least one item.']);
        }

        // Can't send more than what's QC-passed & not already committed.
        $deliverable = $workOrder->deliverableQty();
        if ($total > $deliverable + 0.001) {
            return back()->withInput()->withErrors(['lines' => $isFull
                ? "Only {$fmt($deliverable)} of {$fmt($total)} have passed QC — deliver the rest partially once it passes."
                : "Only {$fmt($deliverable)} pc(s) are QC-passed and available to deliver; this delivery has {$fmt($total)}."]);
        }

        // Recorded from the figures, not the button: FULL only when this one
        // challan carries the whole order. All that remained after earlier
        // deliveries is still a partial delivery — the last part of one.
        $wholeOrder = $lines->every(fn ($l) => $l['earlier'] <= 0.001 && abs(($send[$l['key']] ?? 0) - $l['ordered']) <= 0.001);
        $type = $wholeOrder ? 'full' : 'partial';

        // The job's centre's own series — `CH-DHK-2026-0012` (App\Support\DocNumber).
        $challan = \App\Support\DocNumber::next('delivery_orders', 'challan_number', 'CH', $workOrder->center_id);

        $delivery = \Illuminate\Support\Facades\DB::transaction(function () use ($validated, $workOrder, $challan, $send, $lines, $total, $type) {
            $delivery = DeliveryOrder::create([
                'center_id'          => $workOrder->center_id,
                'work_order_id'      => $workOrder->id,
                'customer_id'        => $workOrder->customer_id,
                'challan_number'     => $challan,
                'quantity_delivered' => $total,
                'delivery_type'      => $type,
                // ⚠️ NOT NULL in the table while the form calls it optional —
                // a blank date used to 500 the whole save. Blank means today.
                'scheduled_date'     => $validated['scheduled_date'] ?? now()->toDateString(),
                'delivery_address'   => $validated['delivery_address'] ?? null,
                'vehicle_number'     => $validated['vehicle_number'] ?? null,
                'driver_name'        => $validated['driver_name'] ?? null,
                'notes'              => $validated['notes'] ?? null,
                'status'             => 'scheduled',
                'created_by'         => auth()->id(),
            ]);
            $sort = 0;
            foreach ($lines as $line) {
                if (empty($send[$line['key']])) continue;
                $delivery->items()->create([
                    'work_order_item_id' => $line['work_order_item_id'],
                    'description'        => $line['description'],
                    'part_no'            => $line['part_no'],
                    'unit'               => $line['unit'],
                    'quantity'           => $send[$line['key']],
                    'sort_order'         => $sort++,
                ]);
            }

            return $delivery;
        });

        // Only mark the WHOLE WO "ready for delivery" once everything is
        // committed to a delivery; a partial schedule leaves the status alone.
        if ($workOrder->committedDeliveryQty() >= (float) $workOrder->quantity - 0.001
            && !in_array($workOrder->status, ['partially_delivered', 'delivered'], true)) {
            $workOrder->update(['status' => 'ready_for_delivery']);
        }

        // The challan goes to PCD's নির্বাহী প্রকৌশলী for his signature
        // (none at this centre → it is approved on the spot).
        $waits = \App\Services\ChallanApproval::request($delivery);

        return redirect()->route('delivery.index')->with('success',
            ($type === 'full' ? 'Full delivery' : 'Partial delivery') . " scheduled. Challan: {$challan}"
            . ($waits ? ' — sent to the নির্বাহী প্রকৌশলী (PCD) for his signature.' : '.'));
    }

    public function show(DeliveryOrder $delivery)
    {
        $delivery->load(['workOrder.product', 'workOrder.customer', 'challanApprovedBy:id,name']);
        $d = $delivery;

        return Inertia::render('Delivery/Complete', [
            'delivery' => [
                'id'                 => $delivery->id,
                'challan_number'     => $delivery->challan_number,
                'wo_number'          => $delivery->workOrder->wo_number ?? '',
                'product'            => $delivery->workOrder->product->name ?? '',
                'customer'           => $delivery->workOrder->customer->name ?? '',
                'quantity_delivered' => $delivery->quantity_delivered,
                'status'             => $delivery->status,
                'work_order_id'      => $delivery->work_order_id,
                // Signed by PCD's নির্বাহী প্রকৌশলী before it may go (ChallanApproval).
                'challan_status'      => $d->challan_status ?? 'approved',
                'challan_signed_by'   => $d->challanApprovedBy?->name,
                'challan_signed_at'   => $d->challan_approved_at?->format('d/m/Y H:i'),
                'challan_rejection'   => $d->challan_rejection_reason,
            ],
            // The receiver's signature: the link / QR to sign on, and what has
            // come back from it (App\Services\DeliveryReceipt).
            'receipt' => \App\Services\DeliveryReceipt::packForStaff($delivery->load('pod')),
            'receiptBlocker' => \App\Services\DeliveryReceipt::blocker($delivery),
        ]);
    }

    /**
     * Stream the BITAC-letterhead Delivery Challan PDF. Supports
     *   ?preview=base64 — JSON-wrapped base64 (used by PdfPopupModal so
     *                     IDM/FDM extensions don't hijack the download)
     *   ?preview=1     — inline preview in new tab
     *   (none)         — force download
     */
    public function pdf(Request $request, DeliveryOrder $delivery)
    {
        $bytes    = app(DeliveryChallanService::class)->generatePdf($delivery);
        $filename = "challan-{$delivery->challan_number}.pdf";

        if ($request->query('preview') === 'base64') {
            return response()->json([
                'filename' => $filename,
                'data'     => base64_encode($bytes),
            ]);
        }

        $disposition = $request->boolean('preview') ? 'inline' : 'attachment';
        return response($bytes, 200, [
            'Content-Type'        => 'application/pdf',
            'Content-Disposition' => $disposition . '; filename="' . $filename . '"',
            'Content-Length'      => strlen($bytes),
        ]);
    }

    /** A one-time link (and its QR code) for the receiver to sign on. */
    public function receiptLink(DeliveryOrder $delivery)
    {
        if ($why = \App\Services\DeliveryReceipt::blocker($delivery)) {
            return back()->with('error', $why);
        }
        \App\Services\DeliveryReceipt::issue($delivery);

        return back()->with('success', 'Signing link ready — let the receiver scan the QR code, or send him the link.');
    }

    public function complete(Request $request, DeliveryOrder $delivery)
    {
        // ⚠️ Not before the XEN has signed the challan (BITAC, 2026-10-27) —
        // the signed paper is what travels with the goods.
        if (! $delivery->isChallanSigned()) {
            return redirect()->route('delivery.index')->with('error', $delivery->challan_status === 'rejected'
                ? "Challan {$delivery->challan_number} was rejected — raise a new delivery."
                : "Challan {$delivery->challan_number} is waiting for the নির্বাহী প্রকৌশলী (PCD) to sign it.");
        }
        if ($delivery->status === 'delivered') {
            return redirect()->route('delivery.index')->with('error', "Challan {$delivery->challan_number} is already delivered.");
        }

        // The receiver signs for the goods one of two ways (BITAC, 2026-10-27):
        //  - `link`: on his phone / BITAC's tablet — the signature is already
        //    here, from the public page (App\Services\DeliveryReceipt);
        //  - `photo`: by pen on the paper challan, which PCD photographs.
        $mode = $request->input('mode') === 'photo' ? 'photo' : 'link';
        $pod  = $delivery->pod()->first();

        if ($mode === 'link') {
            if (! $pod || ! $pod->isSignature()) {
                return back()->with('error', 'The receiver has not signed yet — let him open the link, or upload a photo of the signed challan.');
            }
            $request->validate(['notes' => 'nullable|string|max:1000']);
            $pod->update(['notes' => $request->input('notes') ?: null]);
        } else {
            $validated = $request->validate([
                'received_by'          => 'required|string|max:120',
                'receiver_designation' => 'nullable|string|max:120',
                'receiver_phone'       => 'nullable|string|max:40',
                'received_at'          => 'required|date',
                'photo'                => 'required|file|mimes:jpg,jpeg,png,webp,pdf|max:10240',
                'notes'                => 'nullable|string|max:1000',
            ], ['photo.required' => 'Upload a photo of the challan the receiver signed.']);

            // A link signature nobody confirmed gives way to the paper one.
            \App\Services\DeliveryReceipt::discardUnconfirmed($delivery);

            ProofOfDelivery::create([
                'delivery_order_id'    => $delivery->id,
                'received_by'          => $validated['received_by'],
                'receiver_designation' => $validated['receiver_designation'] ?? null,
                'receiver_phone'       => $validated['receiver_phone'] ?? null,
                'proof_type'           => 'photo',
                'proof_path'           => $request->file('photo')->store('pod/photos', 'public'),
                'delivered_at'         => $validated['received_at'],
                // `notes` is nullable, so it is simply absent when nothing was
                // typed — reading it straight threw and the whole confirmation 500'd.
                'notes'                => $validated['notes'] ?? null,
            ]);
        }

        // The link has done its job.
        $delivery->update(['receipt_token_expires_at' => now()]);

        $delivery->update(['status' => 'delivered', 'delivered_at' => now()]);
        $workOrder = $delivery->workOrder;
        $previousWoStatus = $workOrder->status;
        // Fully delivered only when the cumulative delivered qty covers the
        // whole order; otherwise the job is PARTIALLY delivered (more to come).
        $fully = $workOrder->fresh()->deliveredQty() >= (float) $workOrder->quantity - 0.001;
        $workOrder->update(['status' => $fully ? 'delivered' : 'partially_delivered']);

        // ⚠️ Confirming a delivery does NOT raise the bill (BITAC, 2026-09-29).
        // The delivery challan belongs to the delivery, but billing is its own
        // act and happens whenever accounts get to it — see
        // `InvoiceController@storeFromDelivery`. The মূসক ৬.৩ then comes off
        // the bill, equally deliberately.
        \App\Services\CustomerNotifyService::workOrderStateChanged($delivery->workOrder->fresh('customer'), $previousWoStatus);

        return redirect()->route('delivery.index')
            ->with('success', 'Delivery confirmed. Raise the bill from this delivery when you are ready.');
    }
}
