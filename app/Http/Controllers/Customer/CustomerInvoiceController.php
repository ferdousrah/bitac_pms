<?php

namespace App\Http\Controllers\Customer;

use App\Http\Controllers\Controller;
use App\Models\Invoice;
use App\Services\InvoiceService;

class CustomerInvoiceController extends Controller
{
    public function __construct(private InvoiceService $service) {}

    public function download(Invoice $invoice)
    {
        $customer = auth('customer')->user();
        abort_unless($invoice->customer_id === $customer->id, 403);

        $invoice->update(['status' => 'acknowledged']);
        return $this->service->generatePdf($invoice)->download("invoice-{$invoice->invoice_number}.pdf");
    }
}
