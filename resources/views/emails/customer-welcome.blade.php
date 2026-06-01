<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Welcome to {{ $brand }}</title>
</head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#0f172a;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f8fafc;padding:32px 16px;">
        <tr>
            <td align="center">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:520px;background:#ffffff;border:1px solid #e2e8f0;border-radius:14px;overflow:hidden;">
                    <!-- Header -->
                    <tr>
                        <td style="padding:28px 32px 18px 32px;border-bottom:1px solid #f1f5f9;">
                            <div style="font-size:13px;font-weight:600;color:#64748b;letter-spacing:0.5px;text-transform:uppercase;">{{ $brand }}</div>
                            <div style="font-size:22px;font-weight:600;color:#0f172a;margin-top:6px;letter-spacing:-0.01em;">Welcome, {{ $customer->contact_person ?: $customer->name }}</div>
                        </td>
                    </tr>

                    <!-- Body -->
                    <tr>
                        <td style="padding:24px 32px;font-size:14px;line-height:1.65;color:#334155;">
                            <p style="margin:0 0 16px 0;">
                                A customer portal account has been created for <strong>{{ $customer->name }}</strong>. Use the credentials below to sign in and track your orders, invoices and documents.
                            </p>

                            <!-- Credentials box -->
                            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;margin:18px 0;">
                                <tr>
                                    <td style="padding:16px 20px;">
                                        <div style="font-size:11px;color:#94a3b8;text-transform:uppercase;letter-spacing:0.06em;font-weight:600;margin-bottom:4px;">Email</div>
                                        <div style="font-size:14px;color:#0f172a;font-weight:500;font-family:Menlo,Consolas,monospace;">{{ $email }}</div>
                                    </td>
                                </tr>
                                <tr>
                                    <td style="padding:0 20px 16px 20px;border-top:1px solid #e2e8f0;">
                                        <div style="font-size:11px;color:#94a3b8;text-transform:uppercase;letter-spacing:0.06em;font-weight:600;margin:14px 0 4px 0;">Temporary password</div>
                                        <div style="font-size:15px;color:#0f172a;font-weight:600;font-family:Menlo,Consolas,monospace;letter-spacing:0.04em;">{{ $plainPassword }}</div>
                                    </td>
                                </tr>
                            </table>

                            <p style="margin:0 0 18px 0;color:#475569;font-size:13px;">
                                For security, you will be asked to set a new password the first time you sign in.
                            </p>

                            <!-- CTA -->
                            <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:18px 0 8px 0;">
                                <tr>
                                    <td style="background:#0f172a;border-radius:8px;">
                                        <a href="{{ $portalUrl }}" style="display:inline-block;padding:11px 22px;font-size:14px;font-weight:500;color:#ffffff;text-decoration:none;">
                                            Sign in to portal &nbsp;&rarr;
                                        </a>
                                    </td>
                                </tr>
                            </table>

                            <p style="margin:24px 0 0 0;font-size:12px;color:#94a3b8;line-height:1.6;">
                                If you didn't expect this email, you can ignore it. Otherwise, please keep these credentials confidential and do not share them.
                            </p>
                        </td>
                    </tr>

                    <!-- Footer -->
                    <tr>
                        <td style="padding:18px 32px;background:#f8fafc;border-top:1px solid #f1f5f9;font-size:11px;color:#94a3b8;">
                            &copy; {{ date('Y') }} {{ $brand }} &mdash; Bangladesh Industrial Technical Assistance Centre
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>
