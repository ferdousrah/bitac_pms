@extends('pdf.layout')

@section('doc_title', 'GATE PASS')
@section('doc_number', 'GP-' . $delivery->challan_number)
@section('doc_date', now()->setTimezone('Asia/Dhaka')->format('d M Y, H:i'))

@section('content')
<div style="border:2px solid #d97706;border-radius:6px;padding:16px;margin-bottom:16px;text-align:center;">
    <div style="font-size:11px;color:#92400e;text-transform:uppercase;letter-spacing:.1em;">Outward Gate Pass</div>
    <div style="font-size:18px;font-weight:bold;font-family:monospace;margin-top:4px;">{{ $delivery->challan_number }}</div>
</div>

<div class="grid-2 section">
    <div>
        <div class="section-title">Consignee</div>
        <dd style="font-weight:bold;">{{ $delivery->workOrder->customer->name }}</dd>
        <dd style="color:#6b7280;">{{ $delivery->delivery_address ?? $delivery->workOrder->customer->address }}</dd>
    </div>
    <div>
        <div class="section-title">Vehicle / Transport</div>
        <dl>
            <dt>Vehicle No.</dt><dd>{{ $delivery->vehicle_number ?? '—' }}</dd>
            <dt>Driver</dt><dd>{{ $delivery->driver_name ?? '—' }}</dd>
            <dt>WO Ref</dt><dd style="font-family:monospace;">{{ $delivery->workOrder->wo_number }}</dd>
        </dl>
    </div>
</div>

<div class="section">
    <div class="section-title">Items to be Released</div>
    <table>
        <thead>
            <tr><th>Product</th><th>Code</th><th style="text-align:right;">Qty</th><th>Unit</th></tr>
        </thead>
        <tbody>
            <tr>
                <td style="font-weight:600;">{{ $delivery->workOrder->product->name }}</td>
                <td style="font-family:monospace;">{{ $delivery->workOrder->product->code }}</td>
                <td style="text-align:right;font-weight:bold;">{{ $delivery->quantity_delivered }}</td>
                <td>{{ $delivery->workOrder->product->unit ?? 'pcs' }}</td>
            </tr>
        </tbody>
    </table>
</div>

<div style="display:flex;justify-content:space-between;margin-top:40px;">
    <div class="sig-box">Store Keeper</div>
    <div class="sig-box">Security (Out)</div>
    <div class="sig-box">Driver / Carrier</div>
</div>
@endsection
