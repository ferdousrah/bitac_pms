<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <style>
        body { font-family: Arial, 'SiyamRupali', sans-serif; color: #1f2937; line-height: 1.6; max-width: 600px; margin: 24px auto; padding: 0 24px; }
        .header { background: #1b1233; color: #fff; padding: 20px 24px; border-radius: 12px 12px 0 0; border-bottom: 3px solid #763abb; }
        .header h1 { margin: 0; font-size: 17px; letter-spacing: 0.3px; }
        .body { background: #fff; padding: 24px; border: 1px solid #e5e7eb; border-top: 0; border-radius: 0 0 12px 12px; }
        .ref { background: #f7f4fb; border-left: 3px solid #5b2d90; padding: 12px 16px; margin: 14px 0; font-size: 13px; }
        .ref div { margin: 2px 0; }
        .meta { color: #6b7280; font-size: 13px; margin: 16px 0; }
        .footer { color: #9ca3af; font-size: 12px; margin-top: 24px; padding-top: 16px; border-top: 1px solid #e5e7eb; }
    </style>
</head>
<body>
    <div class="header"><h1>Bangladesh Industrial Technical Assistance Centre (BITAC)</h1></div>
    <div class="body">
        <p>Dear <strong>{{ $qr->name }}</strong>,</p>

        <p>Thank you for asking BITAC for a quotation. Your request has reached
            {{ $qr->office?->name ?? 'BITAC' }}, and an engineer will study it and contact you.</p>

        <div class="ref">
            <div><strong>Reference No.:</strong> {{ $qr->reference_no }}</div>
            <div><strong>Job:</strong> {{ $qr->subject }}</div>
            @if ($qr->quantity)
                <div><strong>Quantity:</strong> {{ rtrim(rtrim(number_format($qr->quantity, 2, '.', ''), '0'), '.') }} {{ $qr->unit }}</div>
            @endif
            <div><strong>Files attached:</strong> {{ $qr->files()->count() }}</div>
            <div><strong>Submitted:</strong> {{ $qr->created_at->format('d M Y, h:i A') }}</div>
        </div>

        <p>If we need a drawing, a sample or more detail before we can price the job, we will ask you.
            Please quote the reference number above whenever you contact us about this request.</p>

        @if ($qr->office && ($qr->office->shown_phone || $qr->office->shown_email))
            <p class="meta">{{ $qr->office->name }}
                @if ($qr->office->shown_phone) · Phone: {{ $qr->office->shown_phone }} @endif
                @if ($qr->office->shown_email) · Email: {{ $qr->office->shown_email }} @endif
            </p>
        @endif

        <p>Best regards,<br><strong>BITAC</strong></p>

        <div class="footer">
            This is an automated confirmation of a request sent from the BITAC website.<br>
            Bangladesh Industrial Technical Assistance Centre · Ministry of Industries, Government of Bangladesh
        </div>
    </div>
</body>
</html>
