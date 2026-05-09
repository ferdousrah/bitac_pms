@extends('pdf.layout')

@section('doc_title', 'OPERATION SHEET')
@section('doc_number', $sheet->sheet_number)
@section('doc_date', 'Issued: ' . $sheet->created_at->format('d M Y'))

@section('content')
<div class="grid-2 section">
    <div>
        <div class="section-title">Work Order</div>
        <dl>
            <dt>WO Number</dt><dd style="font-size:14px;font-family:monospace;color:#1d4ed8;">{{ $sheet->workOrder->wo_number }}</dd>
            <dt>Product</dt><dd>{{ $sheet->workOrder->product->name }}</dd>
            <dt>Product Code</dt><dd>{{ $sheet->workOrder->product->code }}</dd>
            <dt>Quantity</dt><dd>{{ $sheet->workOrder->quantity }} {{ $sheet->workOrder->product->unit ?? '' }}</dd>
            <dt>Customer</dt><dd>{{ $sheet->workOrder->customer->name }}</dd>
            <dt>Due Date</dt><dd>{{ $sheet->workOrder->due_date ?? '—' }}</dd>
        </dl>
    </div>
    <div>
        @if($qrCode)
        <div class="qr-block">
            <img src="data:image/png;base64,{{ $qrCode }}" alt="QR">
            <div class="qr-label">Scan to view on mobile</div>
        </div>
        @endif
        <div class="section-title">Sheet Info</div>
        <dl>
            <dt>Sheet Number</dt><dd>{{ $sheet->sheet_number }}</dd>
            <dt>Total Steps</dt><dd>{{ $sheet->steps->count() }}</dd>
            <dt>Total Est. Hours</dt><dd>{{ $sheet->steps->sum('estimated_hours') }}h</dd>
        </dl>
    </div>
</div>

<div class="section">
    <div class="section-title">Operation Steps</div>
    <table>
        <thead>
            <tr>
                <th style="width:30px;">Seq</th>
                <th>Operation</th>
                <th>Machine</th>
                <th>Work Centre</th>
                <th>Operator</th>
                <th>Est. Hrs</th>
                <th>Instructions</th>
                <th style="width:60px;">Sign-off</th>
            </tr>
        </thead>
        <tbody>
            @foreach($sheet->steps as $step)
            <tr>
                <td style="text-align:center;font-weight:bold;">{{ $step->sequence_number }}</td>
                <td style="font-weight:600;">{{ $step->operation_name }}</td>
                <td>{{ $step->machine->name ?? '—' }}</td>
                <td>{{ $step->machine->workCentre->name ?? '—' }}</td>
                <td>{{ $step->assignment->operator->name ?? 'Unassigned' }}</td>
                <td style="text-align:center;font-family:monospace;">{{ $step->estimated_hours }}</td>
                <td style="font-size:9px;color:#6b7280;">{{ $step->instructions ?? '' }}</td>
                <td style="border-left:1px solid #e5e7eb;"></td>
            </tr>
            @endforeach
        </tbody>
    </table>
</div>

<div style="display:flex;justify-content:space-between;margin-top:32px;">
    <div class="sig-box">Production Supervisor</div>
    <div class="sig-box">QC Inspector</div>
    <div class="sig-box">Store / Issue</div>
</div>
@endsection
