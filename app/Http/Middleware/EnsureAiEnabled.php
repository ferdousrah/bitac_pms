<?php

namespace App\Http\Middleware;

use App\Services\SettingService;
use Closure;
use Illuminate\Http\Request;

/**
 * Guards AI endpoints. When the master AI switch (ai.enabled) is 'no',
 * returns 503 with a clear message so client-side callers can surface
 * a consistent error.
 */
class EnsureAiEnabled
{
    public function handle(Request $request, Closure $next)
    {
        $enabled = app(SettingService::class)->get('ai.enabled', 'yes') !== 'no';
        if (!$enabled) {
            return response()->json([
                'error'      => 'AI features are currently disabled by the administrator.',
                'ai_enabled' => false,
            ], 503);
        }
        return $next($request);
    }
}
