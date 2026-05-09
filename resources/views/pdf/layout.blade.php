<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta http-equiv="Content-Type" content="text/html; charset=utf-8"/>
<style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'DejaVu Sans', sans-serif; font-size: 11px; color: #1f2937; line-height: 1.5; }
    .page { padding: 24px 32px; }

    /* Header */
    .header { border-bottom: 2px solid #d97706; padding-bottom: 12px; margin-bottom: 20px; }
    .header-inner { display: flex; justify-content: space-between; align-items: flex-start; }
    .logo-block { display: flex; align-items: center; gap: 10px; }
    .logo-box { width: 44px; height: 44px; background: #d97706; border-radius: 8px;
                display: flex; align-items: center; justify-content: center; color: white; font-size: 20px; font-weight: bold; }
    .org-name { font-size: 16px; font-weight: bold; color: #92400e; }
    .org-sub { font-size: 9px; color: #78716c; }
    .doc-meta { text-align: right; }
    .doc-title { font-size: 15px; font-weight: bold; color: #1e3a5f; }
    .doc-number { font-size: 11px; color: #6b7280; margin-top: 3px; }

    /* Section */
    .section { margin-bottom: 16px; }
    .section-title { font-size: 9px; font-weight: bold; text-transform: uppercase; color: #6b7280;
                     letter-spacing: 0.05em; border-bottom: 1px solid #e5e7eb; padding-bottom: 3px; margin-bottom: 8px; }

    /* Grid */
    .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; }
    .grid-3 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 16px; }
    dt { font-size: 9px; color: #9ca3af; text-transform: uppercase; }
    dd { font-size: 11px; font-weight: 600; margin-top: 1px; }

    /* Table */
    table { width: 100%; border-collapse: collapse; }
    th { background: #f3f4f6; font-size: 9px; font-weight: 700; text-transform: uppercase;
         letter-spacing: 0.05em; padding: 7px 10px; text-align: left; color: #6b7280; }
    td { padding: 7px 10px; border-bottom: 1px solid #f3f4f6; font-size: 10px; }
    tr:last-child td { border-bottom: none; }

    /* Totals */
    .totals { margin-top: 8px; }
    .total-row { display: flex; justify-content: space-between; padding: 4px 0; border-bottom: 1px solid #f3f4f6; }
    .total-final { font-size: 13px; font-weight: bold; padding-top: 8px; border-top: 2px solid #374151; }

    /* Badges */
    .badge { display: inline-block; padding: 2px 8px; border-radius: 10px; font-size: 9px; font-weight: 700; }
    .badge-green { background: #d1fae5; color: #065f46; }
    .badge-yellow { background: #fef3c7; color: #92400e; }
    .badge-blue { background: #dbeafe; color: #1e40af; }
    .badge-red { background: #fee2e2; color: #991b1b; }

    /* Footer */
    .footer { position: fixed; bottom: 0; left: 32px; right: 32px;
              border-top: 1px solid #e5e7eb; padding-top: 6px; font-size: 9px; color: #9ca3af;
              display: flex; justify-content: space-between; }

    /* Signature box */
    .sig-box { border-top: 1px solid #374151; width: 160px; margin-top: 40px; padding-top: 4px;
               font-size: 9px; color: #6b7280; text-align: center; }

    /* QR */
    .qr-block { float: right; text-align: center; }
    .qr-block img { width: 80px; height: 80px; }
    .qr-label { font-size: 8px; color: #9ca3af; margin-top: 2px; }
</style>
</head>
<body>
<div class="page">
    <div class="header">
        <div class="header-inner">
            <div class="logo-block">
                <div class="logo-box">B</div>
                <div>
                    <div class="org-name">BITAC</div>
                    <div class="org-sub">Bangladesh Industrial Technical Assistance Centre</div>
                    <div class="org-sub">Tejgaon Industrial Area, Dhaka-1208, Bangladesh</div>
                </div>
            </div>
            <div class="doc-meta">
                <div class="doc-title">@yield('doc_title')</div>
                <div class="doc-number">@yield('doc_number')</div>
                <div style="font-size:9px;color:#9ca3af;margin-top:3px;">@yield('doc_date')</div>
            </div>
        </div>
    </div>

    @yield('content')

    <div class="footer">
        <span>BITAC PMS — Confidential</span>
        <span>Generated: {{ now()->setTimezone('Asia/Dhaka')->format('d M Y, H:i') }}</span>
        <span>Page <span class="pagenum"></span></span>
    </div>
</div>
</body>
</html>
