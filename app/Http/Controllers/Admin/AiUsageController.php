<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\AiUsageLog;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;

/**
 * Internal usage dashboard for the AI assistant (Oli).
 * Aggregates token + cost data per tenant (BITAC center / customer) so admins
 * can see who's using how much before pricing tiers are introduced.
 *
 * cost_usd is BITAC's internal Gemini bill — sensitive. Only super-admins
 * (gated by 'view ai-usage' permission on the route) should see this page.
 */
class AiUsageController extends Controller
{
    public function index(Request $request)
    {
        $from = $request->input('from')
            ? Carbon::parse($request->input('from'))->startOfDay()
            : Carbon::now()->subDays(29)->startOfDay();
        $to   = $request->input('to')
            ? Carbon::parse($request->input('to'))->endOfDay()
            : Carbon::now()->endOfDay();

        $base = AiUsageLog::whereBetween('created_at', [$from, $to]);

        // ── KPI totals ───────────────────────────────────────────────
        $totals = (clone $base)
            ->selectRaw('
                COUNT(*) as requests,
                COALESCE(SUM(total_tokens), 0)   as total_tokens,
                COALESCE(SUM(input_tokens), 0)   as input_tokens,
                COALESCE(SUM(output_tokens), 0)  as output_tokens,
                COALESCE(SUM(cost_usd), 0)       as cost_usd,
                COALESCE(AVG(request_ms), 0)     as avg_ms,
                COALESCE(SUM(tool_calls), 0)     as tool_calls
            ')->first();

        $errorCount = (clone $base)->where('status', '!=', 'ok')->count();

        // ── Daily trend ──────────────────────────────────────────────
        $daily = (clone $base)
            ->selectRaw('DATE(created_at) as d, COUNT(*) as requests, SUM(total_tokens) as tokens, SUM(cost_usd) as cost')
            ->groupBy('d')->orderBy('d')->get()
            ->map(fn($r) => [
                'date'     => Carbon::parse($r->d)->format('d M'),
                'requests' => (int) $r->requests,
                'tokens'   => (int) $r->tokens,
                'cost'     => round((float) $r->cost, 6),
            ])->values();

        // ── By center ────────────────────────────────────────────────
        $byCenter = (clone $base)
            ->whereNotNull('center_id')
            ->leftJoin('centers', 'centers.id', '=', 'ai_usage_logs.center_id')
            ->selectRaw('centers.name as name, ai_usage_logs.center_id as id,
                         COUNT(*) as requests, SUM(total_tokens) as tokens, SUM(cost_usd) as cost')
            ->groupBy('centers.name', 'ai_usage_logs.center_id')
            ->orderByDesc('cost')->get()
            ->map(fn($r) => [
                'id'       => (int) $r->id,
                'name'     => $r->name ?? '—',
                'requests' => (int) $r->requests,
                'tokens'   => (int) $r->tokens,
                'cost'     => round((float) $r->cost, 6),
            ])->values();

        // ── By customer (only the external ones — those with customer_id set) ─
        $byCustomer = (clone $base)
            ->whereNotNull('customer_id')
            ->leftJoin('customers', 'customers.id', '=', 'ai_usage_logs.customer_id')
            ->selectRaw('customers.name as name, ai_usage_logs.customer_id as id,
                         COUNT(*) as requests, SUM(total_tokens) as tokens, SUM(cost_usd) as cost')
            ->groupBy('customers.name', 'ai_usage_logs.customer_id')
            ->orderByDesc('cost')->limit(20)->get()
            ->map(fn($r) => [
                'id'       => (int) $r->id,
                'name'     => $r->name ?? '—',
                'requests' => (int) $r->requests,
                'tokens'   => (int) $r->tokens,
                'cost'     => round((float) $r->cost, 6),
            ])->values();

        // ── Top users (by request count) ─────────────────────────────
        $topUsers = (clone $base)
            ->whereNotNull('actor_id')
            ->where('actor_type', 'App\\Models\\User')
            ->leftJoin('users', 'users.id', '=', 'ai_usage_logs.actor_id')
            ->selectRaw('users.name as name, users.email as email, ai_usage_logs.actor_id as id,
                         COUNT(*) as requests, SUM(total_tokens) as tokens, SUM(cost_usd) as cost')
            ->groupBy('users.name', 'users.email', 'ai_usage_logs.actor_id')
            ->orderByDesc('requests')->limit(10)->get()
            ->map(fn($r) => [
                'id'       => (int) $r->id,
                'name'     => $r->name ?? '—',
                'email'    => $r->email ?? '',
                'requests' => (int) $r->requests,
                'tokens'   => (int) $r->tokens,
                'cost'     => round((float) $r->cost, 6),
            ])->values();

        // ── Recent calls ─────────────────────────────────────────────
        $recent = (clone $base)
            ->with(['center:id,name', 'customer:id,name'])
            ->orderByDesc('id')->limit(25)->get()
            ->map(function ($r) {
                // Resolve actor name
                $actorName = '—';
                if ($r->actor_id) {
                    if ($r->actor_type === \App\Models\User::class) {
                        $actorName = \App\Models\User::find($r->actor_id)?->name ?? "User #{$r->actor_id}";
                    } elseif ($r->actor_type === \App\Models\Customer::class) {
                        $actorName = \App\Models\Customer::find($r->actor_id)?->name ?? "Customer #{$r->actor_id}";
                    }
                }
                return [
                    'id'            => $r->id,
                    'created_at'    => $r->created_at->format('d M Y, h:i:s A'),
                    'model'         => $r->model,
                    'tenant'        => $r->customer?->name ?? $r->center?->name ?? '—',
                    'tenant_type'   => $r->customer ? 'customer' : ($r->center ? 'center' : '—'),
                    'actor'         => $actorName,
                    'input_tokens'  => $r->input_tokens,
                    'output_tokens' => $r->output_tokens,
                    'total_tokens'  => $r->total_tokens,
                    'cost_usd'      => (float) $r->cost_usd,
                    'request_ms'    => $r->request_ms,
                    'tool_calls'    => $r->tool_calls,
                    'status'        => $r->status,
                ];
            });

        return Inertia::render('Admin/AiUsage/Index', [
            'totals'      => [
                'requests'      => (int) $totals->requests,
                'total_tokens'  => (int) $totals->total_tokens,
                'input_tokens'  => (int) $totals->input_tokens,
                'output_tokens' => (int) $totals->output_tokens,
                'cost_usd'      => round((float) $totals->cost_usd, 6),
                'avg_ms'        => (int) round((float) $totals->avg_ms),
                'tool_calls'    => (int) $totals->tool_calls,
                'errors'        => $errorCount,
            ],
            'daily'       => $daily,
            'by_center'   => $byCenter,
            'by_customer' => $byCustomer,
            'top_users'   => $topUsers,
            'recent'      => $recent,
            'filters'     => [
                'from' => $from->toDateString(),
                'to'   => $to->toDateString(),
            ],
        ]);
    }
}
