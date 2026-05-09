@extends('pdf.layout')

@section('doc_title', 'QUOTATION')
@section('doc_number', 'Q-' . str_pad($quotation->id, 5, '0', STR_PAD_LEFT) . ' v' . $quotation->version)
@section('doc_date', 'Date: ' . $quotation->created_at->format('d M Y'))

@section('content')
@php
    $subtotal = $quotation->material_cost + $quotation->labour_cost + $quotation->overhead_cost;
    $withMargin = $subtotal * (1 + $quotation->profit_margin / 100);
    $afterDiscount = $withMargin - $quotation->discount;
    $vat = $afterDiscount * ($quotation->vat_rate / 100);
    $total = $afterDiscount + $vat;
@endphp

<div class="grid-2 section">
    <div>
        <div class="section-title">Bill To</div>
        <dd style="font-size:13px;">{{ $quotation->rfq->customer->name ?? '—' }}</dd>
        <dt style="margin-top:4px;">Contact</dt>
        <dd>{{ $quotation->rfq->customer->contact_person ?? '—' }}</dd>
        <dt style="margin-top:4px;">Address</dt>
        <dd>{{ $quotation->rfq->customer->address ?? '—' }}</dd>
    </div>
    <div>
        <div class="section-title">Details</div>
        <dl>
            <dt>Product</dt><dd>{{ $quotation->rfq?->items->first()?->job_description ?? $quotation->rfq?->items->first()?->product?->name ?? '—' }}</dd>
            <dt>Product Code</dt><dd>{{ $quotation->rfq?->items->first()?->product?->code ?? '—' }}</dd>
            <dt>Quantity</dt><dd>{{ $quotation->rfq?->items->first()?->quantity ?? '—' }} {{ $quotation->rfq?->items->first()?->unit ?? '' }}</dd>
            <dt>Valid For</dt><dd>{{ $quotation->validity_days }} days from date</dd>
            <dt>Status</dt><dd><span class="badge badge-{{ $quotation->status === 'approved' ? 'green' : 'yellow' }}">{{ strtoupper($quotation->status) }}</span></dd>
        </dl>
    </div>
</div>

<div class="section">
    <div class="section-title">Cost Breakdown</div>
    <table>
        <thead>
            <tr><th>Item</th><th style="text-align:right;">Amount (৳)</th></tr>
        </thead>
        <tbody>
            <tr><td>Material Cost</td><td style="text-align:right;font-family:monospace;">{{ number_format($quotation->material_cost, 2) }}</td></tr>
            <tr><td>Labour Cost</td><td style="text-align:right;font-family:monospace;">{{ number_format($quotation->labour_cost, 2) }}</td></tr>
            <tr><td>Overhead</td><td style="text-align:right;font-family:monospace;">{{ number_format($quotation->overhead_cost, 2) }}</td></tr>
            <tr><td>Profit Margin ({{ $quotation->profit_margin }}%)</td><td style="text-align:right;font-family:monospace;">{{ number_format($withMargin - $subtotal, 2) }}</td></tr>
            @if($quotation->discount > 0)
            <tr><td style="color:#dc2626;">Discount</td><td style="text-align:right;font-family:monospace;color:#dc2626;">- {{ number_format($quotation->discount, 2) }}</td></tr>
            @endif
            <tr><td>VAT ({{ $quotation->vat_rate }}%)</td><td style="text-align:right;font-family:monospace;">{{ number_format($vat, 2) }}</td></tr>
        </tbody>
    </table>
    <div class="totals">
        <div class="total-row total-final">
            <span>TOTAL AMOUNT</span>
            <span style="font-family:monospace;">৳{{ number_format($total, 2) }}</span>
        </div>
    </div>
</div>

@if($quotation->notes)
<div class="section">
    <div class="section-title">Terms & Notes</div>
    <p style="font-size:10px;color:#374151;">{{ $quotation->notes }}</p>
</div>
@endif

<div style="display:flex;justify-content:space-between;margin-top:40px;">
    <div class="sig-box">Prepared By</div>
    <div class="sig-box">Approved By (L1)</div>
    <div class="sig-box">Approved By (L2)</div>
    <div class="sig-box">Customer Acknowledgement</div>
</div>
@endsection
