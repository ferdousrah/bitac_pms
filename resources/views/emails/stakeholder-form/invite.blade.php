<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <style>
        body { font-family: Arial, sans-serif; color: #1f2937; line-height: 1.6; max-width: 600px; margin: 24px auto; padding: 0 24px; }
        .header { background: linear-gradient(135deg, #4f46e5, #4338ca); color: #fff; padding: 22px 24px; border-radius: 12px 12px 0 0; }
        .header h1 { margin: 0 0 4px; font-size: 18px; letter-spacing: 0.5px; }
        .header p  { margin: 0; font-size: 12px; opacity: 0.85; }
        .body { background: #fff; padding: 24px; border: 1px solid #e5e7eb; border-top: 0; border-radius: 0 0 12px 12px; }
        .ref  { background: #f8fafc; border-left: 3px solid #4f46e5; padding: 12px 16px; margin: 16px 0; font-size: 13px; }
        .cta  { display: inline-block; background: #4f46e5; color: #fff; padding: 12px 28px; border-radius: 8px; text-decoration: none; font-weight: bold; margin: 16px 0; }
        .footer { color: #9ca3af; font-size: 12px; margin-top: 24px; padding-top: 16px; border-top: 1px solid #e5e7eb; }
    </style>
</head>
<body>
    <div class="header">
        <h1>BITAC {{ $form->year }} Stakeholder Consultation</h1>
        <p>Bangladesh Industrial Technical Assistance Centre · Ministry of Industries</p>
    </div>
    <div class="body">
        <p>Dear <strong>{{ $stakeholder->name }}</strong>,</p>

        @if ($isReminder)
            <p>This is a friendly reminder that we are still awaiting your input on the <strong>{{ $form->title }}</strong>.</p>
        @else
            <p>You are invited to participate in our {{ $form->year }} stakeholder consultation. Your feedback helps shape BITAC's services for the year ahead.</p>
        @endif

        <div class="ref">
            <strong>Form:</strong> {{ $form->title }}<br>
            @if ($form->description)
                <span style="color: #6b7280; font-size: 12px;">{{ Str::limit($form->description, 200) }}</span>
            @endif
        </div>

        <p>Please use the link below to fill in the form. It is personalised to you — no login required.</p>

        <p style="text-align: center;">
            <a href="{{ $fillUrl }}" class="cta">Open Form</a>
        </p>

        <p style="font-size: 12px; color: #6b7280;">
            Or copy and paste this link into your browser:<br>
            <a href="{{ $fillUrl }}" style="color: #4f46e5; word-break: break-all;">{{ $fillUrl }}</a>
        </p>

        @if ($form->closes_at)
            <p style="font-size: 12px; color: #6b7280; margin-top: 16px;">
                <strong>Closes:</strong> {{ \Carbon\Carbon::parse($form->closes_at)->format('d M Y') }}
            </p>
        @endif

        <p>Best regards,<br>
        <strong>BITAC IED Team</strong></p>

        <div class="footer">
            Bangladesh Industrial Technical Assistance Centre · Ministry of Industries, GoB
        </div>
    </div>
</body>
</html>
