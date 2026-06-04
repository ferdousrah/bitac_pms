<!DOCTYPE html>
<html lang="{{ str_replace('_', '-', app()->getLocale()) }}">
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
        <meta name="apple-mobile-web-app-capable" content="yes">
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
        <meta name="mobile-web-app-capable" content="yes">

        @php
            $ss = app(\App\Services\SettingService::class);
            $brandName  = $ss->get('brand_name', config('app.name', 'BITAC PMS'));
            $primaryHex = $ss->get('primary_color', '#ff7a0f');
            $sidebarHex = $ss->get('sidebar_color', '#0f172a');
            $isLiveDashboard = request()->routeIs('dashboard.live');
            $logoPath = $ss->get('logo_path');
        @endphp
        <title inertia>{{ $brandName }}</title>

        <!-- Make brand name available to the JS bundle for the Inertia title callback -->
        <script>window.__BRAND_NAME__ = @json($brandName);</script>

        <!-- Server-side theme injection (prevents flash of default colors) -->
        @php
            $logoUrl = $logoPath ? \Illuminate\Support\Facades\Storage::disk('public')->url($logoPath) : null;
            $logoMime = $logoUrl ? (\Illuminate\Support\Str::endsWith(strtolower($logoPath), '.svg') ? 'image/svg+xml'
                                : (\Illuminate\Support\Str::endsWith(strtolower($logoPath), '.png') ? 'image/png'
                                : (\Illuminate\Support\Str::endsWith(strtolower($logoPath), '.webp') ? 'image/webp'
                                : 'image/jpeg'))) : null;
        @endphp
        <meta name="theme-color" content="{{ $isLiveDashboard ? $primaryHex : $sidebarHex }}">

        <!-- PWA Manifest (Live dashboard gets its own installable scope) -->
        <link rel="manifest" href="{{ $isLiveDashboard ? '/manifest-live.json' : '/manifest.json' }}">

        <!-- Icons — uploaded brand logo if present, else default -->
        @if($logoUrl)
            <link rel="icon" type="{{ $logoMime }}" href="{{ $logoUrl }}">
            <link rel="apple-touch-icon" href="{{ $logoUrl }}">
        @else
            <link rel="icon" type="image/svg+xml" href="/favicon.svg">
            <link rel="apple-touch-icon" sizes="192x192" href="/apple-touch-icon.png">
        @endif

        <!-- Fonts — Inter (premium) + JetBrains Mono (code) -->
        <link rel="preconnect" href="https://fonts.bunny.net">
        <link href="https://fonts.bunny.net/css?family=inter:400,500,600,700,800|jetbrains-mono:400,500&display=swap" rel="stylesheet" />

        @routes
        @viteReactRefresh
        @vite(['resources/js/app.tsx', "resources/js/Pages/{$page['component']}.tsx"])
        @inertiaHead
    </head>
    <body class="font-sans antialiased bg-surface-50 text-surface-800">
        @inertia

        <!-- PWA Service Worker -->
        <script>
            if ('serviceWorker' in navigator) {
                window.addEventListener('load', () => {
                    navigator.serviceWorker.register('/sw.js').catch(() => {});
                });
            }
        </script>
    </body>
</html>
