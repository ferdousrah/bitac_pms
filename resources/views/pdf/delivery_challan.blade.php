@extends('pdf.layout')

@section('doc_title', 'DELIVERY CHALLAN')
@section('doc_number', $delivery->challan_number)
@section('doc_date', 'Date: ' . now()->setTimezone('Asia/Dhaka')->format('d M Y'))

@section('content')
<div class="grid-2 section">
    <div>
        <div class="section-title">Deliver To</div>
        <dd style="font-size:13px;font-weight:bold;">{{ $delivery->workOrder->customer->name }}</dd>
        <dd style="margin-top:4px;color:#6b7280;">{{ $delivery->delivery_address ?? $delivery->workOrder->customer->address }}</dd>
    </div>
    <div>
        <div class="section-title">Delivery Details</div>
        <dl>
            <dt>Work Order</dt><dd style="font-family:monospace;color:#1d4ed8;">{{ $delivery->workOrder->wo_number }}</dd>
            <dt>Scheduled Date</dt><dd>{{ $delivery->scheduled_date ?? '—' }}</dd>
            <dt>Vehicle No.</dt><dd>{{ $delivery->vehicle_number ?? '—' }}</dd>
            <dt>Driver</dt><dd>{{ $delivery->driver_name ?? '—' }}</dd>
        </dl>
    </div>
</div>

<div class="section">
    <div class="section-title">Items</div>
    <table>
        <thead>
            <tr>
                <th>#</th>
                <th>Product</th>
                <th>Product Code</th>
                <th style="text-align:right;">Qty</th>
                <th>Unit</th>
                <th>Remarks</th>
            </tr>
        </thead>
        <tbody>
            <tr>
                <td>1</td>
                <td style="font-weight:600;">{{ $delivery->workOrder->product->name }}</td>
                <td style="font-family:monospace;">{{ $delivery->workOrder->product->code }}</td>
                <td style="text-align:right;font-weight:bold;">{{ $delivery->quantity_delivered }}</td>
                <td>{{ $delivery->workOrder->product->unit ?? 'pcs' }}</td>
                <td>{{ $delivery->notes ?? '' }}</td>
            </tr>
        </tbody>
    </table>
</div>

@if($delivery->pod)
<div class="section">
    <div class="section-title">Proof of Delivery</div>
    <dl>
        <dt>Received By</dt><dd>{{ $delivery->pod->received_by }}</dd>
        <dt>Received At</dt><dd>{{ \Carbon\Carbon::parse($delivery->pod->received_at)->setTimezone('Asia/Dhaka')->format('d M Y, H:i') }}</dd>
        @if($delivery->pod->notes)
        <dt>Notes</dt><dd>{{ $delivery->pod->notes }}</dd>
        @endif
    </dl>
    @if($delivery->pod->signature_path)
    <div style="margin-top:8px;">
        <div class="section-title">Recipient Signature</div>
        <img src="{{ storage_path('app/public/' . $delivery->pod->signature_path) }}" style="height:60px;" alt="Signature">
    </div>
    @endif
</div>
@else
<div style="display:flex;justify-content:space-between;margin-top:40px;">
    <div class="sig-box">Dispatched By (BITAC)</div>
    <div class="sig-box">Received By (Customer)</div>
    <div class="sig-box">Security / Gate</div>
</div>
@endif
@endsection
