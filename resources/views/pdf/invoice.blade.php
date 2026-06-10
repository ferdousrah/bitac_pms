@extends('pdf.layout')

@section('doc_title', 'INVOICE')
@section('doc_number', $invoice->invoice_number)
@section('doc_date', 'Date: ' . \Carbon\Carbon::parse($invoice->issued_date)->format('d M Y'))

@section('content')
<div class="grid-2 section">
    <div>
        <div class="section-title">Bill To</div>
        <dd style="font-size:13px;font-weight:bold;">{{ $invoice->workOrder->customer->name }}</dd>
        @if($invoice->workOrder->customer->contact_person)
        <dd>Attn: {{ $invoice->workOrder->customer->contact_person }}</dd>
        @endif
        <dd style="color:#6b7280;">{{ $invoice->workOrder->customer->address ?? '' }}</dd>
    </div>
    <div>
        <div class="section-title">Invoice Details</div>
        <dl>
            <dt>Invoice No.</dt><dd style="font-family:monospace;">{{ $invoice->invoice_number }}</dd>
            <dt>Work Order</dt><dd style="font-family:monospace;color:#1d4ed8;">{{ $invoice->workOrder->wo_number }}</dd>
            <dt>Issue Date</dt><dd>{{ \Carbon\Carbon::parse($invoice->issued_date)->format('d M Y') }}</dd>
            <dt>Due Date</dt><dd>{{ $invoice->due_date ? \Carbon\Carbon::parse($invoice->due_date)->format('d M Y') : 'On receipt' }}</dd>
            <dt>Payment Terms</dt><dd>{{ $invoice->payment_terms ?? 'Net 30 days' }}</dd>
            <dt>Status</dt>
            <dd><span class="badge badge-{{ $invoice->status === 'paid' ? 'green' : 'yellow' }}">{{ strtoupper($invoice->status) }}</span></dd>
        </dl>
    </div>
</div>

<div class="section">
    <div class="section-title">Items</div>
    <table>
        <thead>
            <tr>
                <th>#</th>
                <th>Description</th>
                <th style="text-align:right;">Qty</th>
                <th style="text-align:right;">Unit Price (৳)</th>
                <th style="text-align:right;">Amount (৳)</th>
            </tr>
        </thead>
        <tbody>
            <tr>
                <td>1</td>
                <td>
                    <strong>{{ $invoice->workOrder->product->name }}</strong><br>
                    <span style="font-size:9px;color:#6b7280;">{{ $invoice->workOrder->product->code }} | WO: {{ $invoice->workOrder->wo_number }}</span>
                </td>
                <td style="text-align:right;">{{ $invoice->workOrder->quantity }}</td>
                <td style="text-align:right;font-family:monospace;">{{ number_format($invoice->subtotal / $invoice->workOrder->quantity, 2) }}</td>
                <td style="text-align:right;font-family:monospace;">{{ number_format($invoice->subtotal, 2) }}</td>
            </tr>
        </tbody>
    </table>
    <div class="totals" style="max-width:280px;margin-left:auto;margin-top:8px;">
        <div class="total-row"><span>Subtotal</span><span style="font-family:monospace;">৳{{ number_format($invoice->subtotal, 2) }}</span></div>
        @if($invoice->discount > 0)
        <div class="total-row" style="color:#dc2626;"><span>Discount</span><span style="font-family:monospace;">- ৳{{ number_format($invoice->discount, 2) }}</span></div>
        @endif
        <div class="total-row"><span>VAT ({{ $invoice->vat_rate }}%)</span><span style="font-family:monospace;">৳{{ number_format($invoice->vat_amount, 2) }}</span></div>
        @if(($invoice->tax_amount ?? 0) > 0)
        <div class="total-row"><span>Tax ({{ rtrim(rtrim(number_format($invoice->tax_rate, 2), '0'), '.') }}%)</span><span style="font-family:monospace;">৳{{ number_format($invoice->tax_amount, 2) }}</span></div>
        @endif
        <div class="total-row total-final"><span>TOTAL DUE</span><span style="font-family:monospace;">৳{{ number_format($invoice->total_amount, 2) }}</span></div>
    </div>
</div>

<div class="section" style="background:#fefce8;border:1px solid #fde68a;border-radius:6px;padding:10px;margin-top:16px;">
    <p style="font-size:9px;color:#92400e;">
        <strong>Payment Instructions:</strong> Please make payment to BITAC Account No: 0000-0000-0000 | Bank: Sonali Bank Ltd, Tejgaon Branch.
        Quote invoice number {{ $invoice->invoice_number }} in transfer reference.
    </p>
</div>

<div style="display:flex;justify-content:space-between;margin-top:32px;">
    <div class="sig-box">Accounts Officer</div>
    <div class="sig-box">Authorised Signatory</div>
</div>
@endsection
