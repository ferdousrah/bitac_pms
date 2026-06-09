<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <style>
        body { font-family: Arial, sans-serif; color: #1f2937; line-height: 1.6; max-width: 600px; margin: 24px auto; padding: 0 24px; }
        .header { background: linear-gradient(135deg, #4f46e5, #4338ca); color: #fff; padding: 20px 24px; border-radius: 12px 12px 0 0; }
        .header h1 { margin: 0; font-size: 18px; letter-spacing: 0.5px; }
        .body { background: #fff; padding: 24px; border: 1px solid #e5e7eb; border-top: 0; border-radius: 0 0 12px 12px; }
        .ref { background: #f8fafc; border-left: 3px solid #4f46e5; padding: 12px 16px; margin: 14px 0; font-family: monospace; font-size: 13px; }
        .meta { color: #6b7280; font-size: 13px; margin: 16px 0; }
        .footer { color: #9ca3af; font-size: 12px; margin-top: 24px; padding-top: 16px; border-top: 1px solid #e5e7eb; }
    </style>
</head>
<body>
    <div class="header"><h1>Bangladesh Industrial Technical Assistance Centre</h1></div>
    <div class="body">
        <p>Dear <strong>{{ $cr->requester_name }}</strong>,</p>

        <p>Thank you for reaching out to BITAC. We have received your request and our team will review it shortly.</p>

        <div class="ref">
            <div><strong>Reference No.:</strong> {{ $cr->request_number }}</div>
            <div><strong>Subject:</strong> {{ $cr->subject }}</div>
            <div><strong>Submitted:</strong> {{ $cr->created_at->format('d M Y, h:i A') }}</div>
        </div>

        <p>A member of our IED (Industrial Engineering Department) team will get back to you within 5 to 7 working days.</p>

        <p class="meta">If you have urgent queries, please contact us at +880-2-9116842 or reply to this email quoting the reference number above.</p>

        <p>Best regards,<br>
        <strong>BITAC IED Team</strong></p>

        <div class="footer">
            This is an automated confirmation. Please do not reply to system messages.<br>
            Bangladesh Industrial Technical Assistance Centre · Ministry of Industries, GoB
        </div>
    </div>
</body>
</html>
