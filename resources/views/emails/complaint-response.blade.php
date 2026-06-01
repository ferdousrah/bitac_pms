<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>BITAC response to your feedback</title>
</head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#0f172a;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f8fafc;padding:32px 16px;">
        <tr>
            <td align="center">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;background:#ffffff;border:1px solid #e2e8f0;border-radius:14px;overflow:hidden;">
                    <tr>
                        <td style="padding:24px 32px 18px 32px;border-bottom:1px solid #f1f5f9;">
                            <div style="font-size:11px;font-weight:600;color:#64748b;letter-spacing:0.5px;text-transform:uppercase;">{{ $brand }} &mdash; Feedback Response</div>
                            <div style="font-size:20px;font-weight:600;color:#0f172a;margin-top:6px;letter-spacing:-0.01em;">{{ $complaint->reference_number }}</div>
                            <div style="font-size:13px;color:#64748b;margin-top:2px;">{{ $complaint->subject }}</div>
                        </td>
                    </tr>

                    <tr>
                        <td style="padding:24px 32px;font-size:14px;line-height:1.65;color:#334155;">
                            <p style="margin:0 0 14px 0;">Dear {{ $customer->contact_person ?: $customer->name }},</p>
                            <p style="margin:0 0 14px 0;">
                                Thank you for sharing your feedback with us. After internal review, BITAC has reached the following decision:
                            </p>

                            <div style="background:#f8fafc;border-left:3px solid #0f172a;padding:14px 16px;margin:18px 0;border-radius:6px;font-size:14px;line-height:1.7;white-space:pre-line;">{{ $complaint->response }}</div>

                            <p style="margin:18px 0 8px 0;font-size:13px;color:#475569;">
                                You can view this submission and any further updates in the customer portal:
                            </p>
                            <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:12px 0;">
                                <tr>
                                    <td style="background:#0f172a;border-radius:8px;">
                                        <a href="{{ $portalUrl }}" style="display:inline-block;padding:10px 20px;font-size:13px;font-weight:500;color:#ffffff;text-decoration:none;">
                                            Open in portal &nbsp;&rarr;
                                        </a>
                                    </td>
                                </tr>
                            </table>

                            <p style="margin:18px 0 0 0;font-size:13px;color:#475569;">Sincerely,<br><strong>BITAC IED Team</strong></p>
                        </td>
                    </tr>

                    <tr>
                        <td style="padding:16px 32px;background:#f8fafc;border-top:1px solid #f1f5f9;font-size:11px;color:#94a3b8;">
                            &copy; {{ date('Y') }} {{ $brand }} &mdash; Bangladesh Industrial Technical Assistance Centre
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>
