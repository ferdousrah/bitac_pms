<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <style>
        body { font-family: Arial, sans-serif; color: #1f2937; line-height: 1.6; max-width: 600px; margin: 24px auto; padding: 0 24px; }
        .header { color: #fff; padding: 20px 24px; border-radius: 12px 12px 0 0; }
        .header.accepted  { background: linear-gradient(135deg, #10b981, #047857); }
        .header.rejected  { background: linear-gradient(135deg, #6b7280, #4b5563); }
        .header.completed { background: linear-gradient(135deg, #4f46e5, #4338ca); }
        .header h1 { margin: 0; font-size: 18px; letter-spacing: 0.5px; }
        .body { background: #fff; padding: 24px; border: 1px solid #e5e7eb; border-top: 0; border-radius: 0 0 12px 12px; }
        .ref { background: #f8fafc; border-left: 3px solid #4f46e5; padding: 12px 16px; margin: 14px 0; font-family: monospace; font-size: 13px; }
        .notes { background: #fefce8; border-left: 3px solid #facc15; padding: 12px 16px; margin: 14px 0; font-style: italic; }
        .footer { color: #9ca3af; font-size: 12px; margin-top: 24px; padding-top: 16px; border-top: 1px solid #e5e7eb; }
    </style>
</head>
<body>
    @php
        $headlines = [
            'accepted'  => 'Your request has been accepted',
            'rejected'  => 'Update on your request',
            'completed' => 'Your request has been completed',
        ];
        $intro = [
            'accepted'  => 'We are pleased to inform you that BITAC has accepted your consultancy request. Our team will be in touch with you to coordinate the next steps.',
            'rejected'  => 'After reviewing your request, BITAC is unable to take it forward at this time. The reason is noted below for your reference.',
            'completed' => 'BITAC has completed the consultancy work for the request below. Thank you for choosing BITAC.',
        ];
    @endphp

    <div class="header {{ $decision }}"><h1>BITAC: {{ $headlines[$decision] ?? 'Update' }}</h1></div>
    <div class="body">
        <p>Dear <strong>{{ $cr->requester_name }}</strong>,</p>

        <p>{{ $intro[$decision] ?? '' }}</p>

        <div class="ref">
            <div><strong>Reference No.:</strong> {{ $cr->request_number }}</div>
            <div><strong>Subject:</strong> {{ $cr->subject }}</div>
        </div>

        @if ($decision === 'rejected' && $cr->rejection_reason)
            <div class="notes"><strong>Reason:</strong><br>{!! nl2br(e($cr->rejection_reason)) !!}</div>
        @endif

        @if (in_array($decision, ['accepted', 'completed']) && $cr->response_notes)
            <div class="notes"><strong>Notes from BITAC:</strong><br>{!! nl2br(e($cr->response_notes)) !!}</div>
        @endif

        <p>Should you have any questions, please contact us at +880-2-9116842 quoting the reference number above.</p>

        <p>Best regards,<br>
        <strong>BITAC IED Team</strong></p>

        <div class="footer">
            Bangladesh Industrial Technical Assistance Centre · Ministry of Industries, GoB
        </div>
    </div>
</body>
</html>
