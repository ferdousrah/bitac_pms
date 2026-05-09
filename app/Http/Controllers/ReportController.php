<?php

namespace App\Http\Controllers;

use App\Models\JobExecution;
use App\Models\WorkOrder;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Maatwebsite\Excel\Facades\Excel;

class ReportController extends Controller
{
    public function production(Request $request)
    {
        $from = Carbon::parse($request->input('from', Carbon::now()->startOfMonth()));
        $to   = Carbon::parse($request->input('to', Carbon::now()->endOfMonth()));

        $data = WorkOrder::whereBetween('created_at', [$from, $to])
            ->selectRaw('DATE(created_at) as date, status, COUNT(*) as count')
            ->groupBy('date', 'status')
            ->get();

        $chartData = $data->groupBy('date')->map(fn($rows, $date) => [
            'date'         => $date,
            'in_production'=> $rows->where('status', 'in_production')->sum('count'),
            'delivered'    => $rows->where('status', 'delivered')->sum('count'),
            'cancelled'    => $rows->where('status', 'cancelled')->sum('count'),
        ])->values();

        return Inertia::render('Reports/Production', [
            'chartData' => $chartData,
            'from'      => $from->toDateString(),
            'to'        => $to->toDateString(),
            'totals'    => [
                'total'     => WorkOrder::whereBetween('created_at', [$from, $to])->count(),
                'delivered' => WorkOrder::whereBetween('created_at', [$from, $to])->where('status', 'delivered')->count(),
            ],
        ]);
    }

    public function rejectionRate(Request $request)
    {
        $from = Carbon::parse($request->input('from', Carbon::now()->startOfMonth()));
        $to   = Carbon::parse($request->input('to', Carbon::now()->endOfMonth()));

        $executions = JobExecution::whereBetween('created_at', [$from, $to])
            ->selectRaw('SUM(qty_completed) as total_completed, SUM(qty_rejected) as total_rejected')
            ->first();

        $rejectionRate = $executions->total_completed > 0
            ? round(($executions->total_rejected / $executions->total_completed) * 100, 2)
            : 0;

        return Inertia::render('Reports/RejectionRate', [
            'rejectionRate'  => $rejectionRate,
            'totalCompleted' => $executions->total_completed ?? 0,
            'totalRejected'  => $executions->total_rejected ?? 0,
            'from'           => $from->toDateString(),
            'to'             => $to->toDateString(),
        ]);
    }

    public function leadTime(Request $request)
    {
        $from = Carbon::parse($request->input('from', Carbon::now()->startOfMonth()));
        $to   = Carbon::parse($request->input('to', Carbon::now()->endOfMonth()));

        $deliveredWos = WorkOrder::where('status', 'delivered')
            ->whereBetween('updated_at', [$from, $to])
            ->with('product')
            ->get()
            ->map(fn($wo) => [
                'wo_number'  => $wo->wo_number,
                'product'    => $wo->product->name ?? '',
                'created_at' => $wo->created_at->toDateString(),
                'delivered_at'=> $wo->updated_at->toDateString(),
                'lead_days'  => $wo->created_at->diffInDays($wo->updated_at),
                'was_on_time'=> !$wo->is_overdue,
            ]);

        $avgLeadTime = $deliveredWos->avg('lead_days');

        return Inertia::render('Reports/LeadTime', [
            'workOrders'  => $deliveredWos,
            'avgLeadTime' => round($avgLeadTime ?? 0, 1),
            'from'        => $from->toDateString(),
            'to'          => $to->toDateString(),
        ]);
    }

    public function oee(Request $request)
    {
        $from = Carbon::parse($request->input('from', Carbon::now()->startOfMonth()));
        $to   = Carbon::parse($request->input('to', Carbon::now()->endOfMonth()));

        $executions = JobExecution::whereBetween('created_at', [$from, $to])
            ->with('machine.workCentre')->get();

        $availableHours   = $executions->count() * 8; // assuming 8h shifts
        $operatingSeconds = $executions->filter(fn($je) => $je->started_at && $je->stopped_at)
            ->sum(fn($je) => $je->started_at->diffInSeconds($je->stopped_at));
        $operatingHours = $operatingSeconds / 3600;

        $availability = $availableHours > 0 ? ($operatingHours / $availableHours) * 100 : 0;
        $totalOutput  = $executions->sum('qty_completed') + $executions->sum('qty_rejected');
        $goodOutput   = $executions->sum('qty_completed');
        $quality      = $totalOutput > 0 ? ($goodOutput / $totalOutput) * 100 : 0;
        $oee          = ($availability / 100) * ($quality / 100) * 100;

        return Inertia::render('Reports/OEE', [
            'oee'          => round($oee, 1),
            'availability' => round($availability, 1),
            'quality'      => round($quality, 1),
            'performance'  => 100, // simplified
            'from'         => $from->toDateString(),
            'to'           => $to->toDateString(),
        ]);
    }

    public function export(Request $request, string $type)
    {
        // Simple CSV export
        $headers = ['Content-Type' => 'text/csv', 'Content-Disposition' => "attachment; filename={$type}-report.csv"];
        $callback = function() use ($type) {
            $handle = fopen('php://output', 'w');
            fputcsv($handle, ['Report Type', $type, 'Generated', now()->format('d/m/Y H:i')]);
            fputcsv($handle, []);
            fputcsv($handle, ['WO Number', 'Product', 'Customer', 'Status', 'Due Date']);

            WorkOrder::with(['product', 'customer'])->get()->each(function($wo) use ($handle) {
                fputcsv($handle, [
                    $wo->wo_number,
                    $wo->product->name ?? '',
                    $wo->customer->name ?? '',
                    $wo->status,
                    $wo->due_date?->format('d/m/Y') ?? '',
                ]);
            });
            fclose($handle);
        };

        return response()->stream($callback, 200, $headers);
    }
}
