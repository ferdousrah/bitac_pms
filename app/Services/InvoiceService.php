<?php

namespace App\Services;

use App\Models\DeliveryOrder;
use App\Models\Invoice;
use App\Models\WorkOrder;
use Barryvdh\DomPDF\Facade\Pdf;

class InvoiceService
{
    public function createFromDelivery(DeliveryOrder $delivery): Invoice
    {
        $workOrder  = $delivery->workOrder;
        $quotation  = $workOrder->quotation;
        $vatRate    = (float) config('app.vat_rate', 15);

        $subtotal  = $quotation ? (float)$quotation->total_amount : 0;
        $vatAmount = $subtotal * ($vatRate / 100);
        $total     = $subtotal + $vatAmount;

        return Invoice::create([
            'work_order_id'    => $workOrder->id,
            'delivery_order_id'=> $delivery->id,
            'customer_id'      => $workOrder->customer_id,
            'subtotal'         => round($subtotal, 2),
            'vat_amount'       => round($vatAmount, 2),
            'discount'         => 0,
            'total_amount'     => round($total, 2),
            'status'           => 'issued',
            'issued_at'        => now(),
        ]);
    }

    public function generatePdf(Invoice $invoice): mixed
    {
        $invoice->load(['workOrder.product', 'workOrder.customer', 'deliveryOrder']);
        return Pdf::loadView('pdf.invoice', ['invoice' => $invoice])
                  ->setPaper('a4', 'portrait');
    }
}
