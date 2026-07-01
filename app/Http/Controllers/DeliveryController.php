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
        $query = DeliveryOrder::with(['workOrder.product', 'workOrder.customer']);

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
                'status'              => $d->status,
                'scheduled_date'      => $d->scheduled_date?->format('d/m/Y'),
                'delivered_at'        => $d->delivered_at?->format('d/m/Y H:i'),
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
            ] : null,
        ]);
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'work_order_id'      => 'required|exists:work_orders,id',
            'quantity_delivered' => 'required|integer|min:1',
            'scheduled_date'     => 'nullable|date',
            'delivery_address'   => 'nullable|string',
            'vehicle_number'     => 'nullable|string|max:50',
            'driver_name'        => 'nullable|string|max:100',
            'notes'              => 'nullable|string',
        ]);

        $workOrder = WorkOrder::findOrFail($validated['work_order_id']);

        // Can't schedule more than what's QC-passed & not already committed.
        $deliverable = $workOrder->deliverableQty();
        if ((float) $validated['quantity_delivered'] > $deliverable + 0.001) {
            return back()->withInput()->withErrors([
                'quantity_delivered' => 'Only ' . rtrim(rtrim(number_format($deliverable, 2), '0'), '.') . ' pc(s) are QC-passed and available to deliver.',
            ]);
        }

        $year    = now()->year;
        $count   = DeliveryOrder::whereYear('created_at', $year)->count();
        $challan = 'CH-' . $year . '-' . str_pad($count + 1, 4, '0', STR_PAD_LEFT);

        $delivery = DeliveryOrder::create([
            ...$validated,
            'customer_id'    => $workOrder->customer_id,
            'challan_number' => $challan,
            'status'         => 'scheduled',
        ]);

        // Only mark the WHOLE WO "ready for delivery" once everything is
        // committed to a delivery; a partial schedule leaves the status alone.
        if ($workOrder->committedDeliveryQty() >= (float) $workOrder->quantity - 0.001
            && !in_array($workOrder->status, ['partially_delivered', 'delivered'], true)) {
            $workOrder->update(['status' => 'ready_for_delivery']);
        }

        return redirect()->route('delivery.index')->with('success', "Delivery scheduled. Challan: {$challan}");
    }

    public function show(DeliveryOrder $delivery)
    {
        $delivery->load(['workOrder.product', 'workOrder.customer']);

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
            ],
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

    public function complete(Request $request, DeliveryOrder $delivery)
    {
        $validated = $request->validate([
            'received_by' => 'required|string|max:255',
            'received_at' => 'required|date',
            'signature'   => 'nullable|string',
            'notes'       => 'nullable|string',
        ]);

        $signaturePath = null;
        if (!empty($validated['signature'])) {
            $imgData = base64_decode(preg_replace('#^data:image/\w+;base64,#i', '', $validated['signature']));
            $filename = 'pod/sig-' . $delivery->id . '-' . time() . '.png';
            \Illuminate\Support\Facades\Storage::disk('public')->put($filename, $imgData);
            $signaturePath = $filename;
        }

        ProofOfDelivery::create([
            'delivery_order_id' => $delivery->id,
            'received_by'       => $validated['received_by'],
            'received_at'       => $validated['received_at'],
            'signature_path'    => $signaturePath,
            'notes'             => $validated['notes'],
        ]);

        $delivery->update(['status' => 'delivered', 'delivered_at' => now()]);
        $workOrder = $delivery->workOrder;
        $previousWoStatus = $workOrder->status;
        // Fully delivered only when the cumulative delivered qty covers the
        // whole order; otherwise the job is PARTIALLY delivered (more to come).
        $fully = $workOrder->fresh()->deliveredQty() >= (float) $workOrder->quantity - 0.001;
        $workOrder->update(['status' => $fully ? 'delivered' : 'partially_delivered']);

        $invoice = $this->invoiceService->createFromDelivery($delivery);

        // Customer-portal live notifications
        \App\Services\CustomerNotifyService::workOrderStateChanged($delivery->workOrder->fresh('customer'), $previousWoStatus);
        if ($invoice) {
            \App\Services\CustomerNotifyService::invoiceIssued($invoice->fresh('customer', 'workOrder'));
        }

        return redirect()->route('delivery.index')
            ->with('success', "Delivery confirmed. Invoice {$invoice->invoice_number} created.");
    }
}
