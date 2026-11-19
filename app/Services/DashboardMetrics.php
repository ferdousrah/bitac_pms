<?php

namespace App\Services;

use App\Http\Controllers\ReceivablesController;
use App\Models\AuditLog;
use App\Models\DeliveryOrder;
use App\Models\Invoice;
use App\Models\Machine;
use App\Models\MaintenanceRequest;
use App\Models\Ncr;
use App\Models\Payment;
use App\Models\Quotation;
use App\Models\Section;
use App\Models\User;
use App\Models\WorkOrder;
use App\Models\WorkOrderSection;
use App\Support\FinancialYear;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;

/**
 * The figures both dashboards show — /dashboard and /dashboard/live read the
 * same methods, so the two screens can never tell a different story.
 *
 * ⚠️ Money is never worked out here. Receivables come from
 * ReceivablesController::totals(), the pipeline from IedReportService, the
 * target from TargetAchievementService — the dashboard is a window onto those
 * reports, not a second copy of their arithmetic.
 *
 * Everything is centre-scoped the way the rest of the app is: HasCenter models
 * by the active centre, the DB::table reports by currentCentre().
 */
class DashboardMetrics
{
    /** Where an open job is in the BITAC workflow, in order. */
    public const STAGES = [
        'ied'      => ['label' => 'IED acceptance',     'statuses' => ['draft', 'approved', 'ied_pending'],                          'href' => '/ied/work-orders',  'color' => 'amber'],
        'pcd'      => ['label' => 'PCD planning',       'statuses' => ['pcd_review', 'pcd_pending', 'pcd_release_pending'],          'href' => '/pcd/job-planning', 'color' => 'violet'],
        'shops'    => ['label' => 'In the shops',       'statuses' => ['released_to_shops', 'in_production'],                        'href' => '/work-orders',      'color' => 'blue'],
        'qc'       => ['label' => 'Inspection',         'statuses' => ['qc_hold'],                                                   'href' => '/qc',               'color' => 'orange'],
        'delivery' => ['label' => 'Ready / part sent',  'statuses' => ['qc_passed', 'ready_for_delivery', 'partially_delivered'],    'href' => '/delivery',         'color' => 'teal'],
    ];

    /** A job is "in hand" until it is delivered in full or cancelled. */
    public const CLOSED = ['delivered', 'cancelled'];

    public static function currentCentre(): ?int
    {
        return app()->bound('current_center_id') ? app('current_center_id') : null;
    }

    /**
     * ⚠️ The centre's machines AND the ones with no centre. Every machine on
     * production was entered with center_id NULL, and CenterScope hides NULL
     * rows once a centre is picked — so a Dhaka user would see no machines.
     */
    public static function machines()
    {
        $centre = self::currentCentre();
        return Machine::withoutGlobalScopes()
            ->when($centre, fn ($q) => $q->where(fn ($q) => $q->where('center_id', $centre)->orWhereNull('center_id')));
    }

    public static function openStatuses(): array
    {
        return array_merge(...array_column(self::STAGES, 'statuses'));
    }

    // ── Jobs ──────────────────────────────────────────────────────────

    public function kpis(): array
    {
        $today = Carbon::today();

        return [
            'active_jobs'     => WorkOrder::whereNotIn('status', self::CLOSED)->count(),
            'delivered_today' => DeliveryOrder::where('status', 'delivered')->whereDate('delivered_at', $today)->count(),
            'at_qc'           => WorkOrder::where('status', 'qc_hold')->count(),
            'overdue'         => WorkOrder::whereNotIn('status', self::CLOSED)
                                    ->whereNotNull('due_date')->where('due_date', '<', $today)->count(),
            'open_ncrs'       => Ncr::whereIn('status', ['open', 'in_rework'])->count(),
            'machines_running'=> self::machines()->where('current_state', 'running')->count(),
        ];
    }

    /**
     * The job flow: how many jobs at each stage, then what is waiting AFTER
     * delivery — challans with no bill yet, delivered jobs not yet completed.
     */
    public function jobStages(): array
    {
        $counts = WorkOrder::whereNotIn('status', self::CLOSED)
            ->selectRaw('status, COUNT(*) n')->groupBy('status')->pluck('n', 'status');

        $stages = [];
        foreach (self::STAGES as $key => $s) {
            $stages[] = [
                'key'   => $key,
                'label' => $s['label'],
                'count' => (int) collect($s['statuses'])->sum(fn ($st) => $counts[$st] ?? 0),
                'href'  => $s['href'],
                'color' => $s['color'],
            ];
        }

        $stages[] = [
            'key'   => 'billing',
            'label' => 'Delivered, not billed',
            'unit'  => 'challans',
            'count' => DeliveryOrder::where('status', 'delivered')->whereNull('invoice_id')
                            ->whereNotNull('challan_number')->count(),
            'href'  => '/billing/delivery-challans',
            'color' => 'emerald',
        ];
        $stages[] = [
            'key'   => 'complete',
            'label' => 'To complete',
            'count' => WorkOrder::where('status', 'delivered')->whereNull('completed_at')->count(),
            'href'  => '/pcd/job-planning',
            'color' => 'green',
        ];

        return $stages;
    }

    // ── Money ─────────────────────────────────────────────────────────

    public function money(): array
    {
        $monthStart = Carbon::now()->startOfMonth();
        $centre     = self::currentCentre();
        $fy         = FinancialYear::current();

        $receivables = app(ReceivablesController::class)->totals();

        // Cash received this month: the cash kinds, net of what was deducted at
        // the counter (an applied advance is not cash — it moved the pool).
        $cash = Payment::cash()->where('paid_on', '>=', $monthStart->toDateString());
        $gross = (float) (clone $cash)->sum('gross_amount');
        $deducted = (float) DB::table('payment_deductions')
            ->whereIn('payment_id', (clone $cash)->select('id'))->sum('amount');

        $pipeline = app(IedReportService::class)->pipeline($centre)['total'];

        $target = collect(app(TargetAchievementService::class)->forYear($fy, $centre));
        $targetSum   = (float) $target->sum('target');
        $achievedSum = (float) $target->sum('achieved');

        // Orders received this month — dated by the customer's own work order,
        // valued at the quotation it was issued against (TargetAchievementService's rule).
        $orders = DB::table('work_orders')
            ->join('quotations', 'quotations.id', '=', 'work_orders.quotation_id')
            ->where('work_orders.status', '!=', 'cancelled')
            ->where(DB::raw('COALESCE(work_orders.customer_wo_date, DATE(work_orders.created_at))'), '>=', $monthStart->toDateString())
            ->when($centre, fn ($q) => $q->where('work_orders.center_id', $centre))
            ->selectRaw('COUNT(*) n, COALESCE(SUM(quotations.total_amount), 0) v')->first();

        return [
            'invoiced_month'   => round((float) Invoice::where('issued_at', '>=', $monthStart)->sum('total_amount'), 2),
            'received_month'   => round($gross - $deducted, 2),
            'receivable_due'   => $receivables['due'],
            'advance_in_hand'  => $receivables['advance_available'],
            'net_receivable'   => $receivables['net_receivable'],
            'overdue'          => $receivables['overdue'],
            'quoted_month'     => round((float) Quotation::applyStanding(Quotation::query())
                                    ->whereRaw(Quotation::quotedDateSql() . ' >= ?', [$monthStart->toDateString()])
                                    ->sum('quotations.total_amount'), 2),
            'orders_month'     => round((float) $orders->v, 2),
            'orders_month_count' => (int) $orders->n,
            'pipeline_jobs'    => $pipeline['jobs'],
            'pipeline_value'   => $pipeline['value'],
            'pipeline_oldest'  => $pipeline['oldest_days'],
            'target'           => [
                'year'     => $fy,
                'target'   => round($targetSum, 2),
                'achieved' => round($achievedSum, 2),
                'percent'  => $targetSum > 0 ? round($achievedSum / $targetSum * 100, 1) : null,
            ],
        ];
    }

    /** Bills raised per day, last seven days (by when they were issued). */
    public function billingTrend(): array
    {
        $from = Carbon::today()->subDays(6);
        $byDay = Invoice::where('issued_at', '>=', $from)
            ->selectRaw('DATE(issued_at) d, SUM(total_amount) v')->groupBy('d')->pluck('v', 'd');

        return collect(range(6, 0))->map(function ($back) use ($byDay) {
            $d = Carbon::today()->subDays($back);
            return ['date' => $d->format('M d'), 'day' => $d->format('D'), 'value' => (float) ($byDay[$d->toDateString()] ?? 0)];
        })->all();
    }

    // ── Shops & machines ──────────────────────────────────────────────

    /**
     * Each shop: the jobs at it now (its leg open), its machines and their
     * state. Machines on a bench count for the bench's shop.
     */
    public function shops(): array
    {
        $shops = Section::active()->shops()->topLevel()->orderBy('display_order')->get(['id', 'name', 'code']);
        $parentOf = Section::whereNotNull('parent_id')->pluck('parent_id', 'id');
        $shopOf = fn ($sectionId) => $parentOf[$sectionId] ?? $sectionId;

        $machines = self::machines()->whereNotNull('section_id')->get(['id', 'section_id', 'current_state'])
            ->groupBy(fn ($m) => $shopOf($m->section_id));

        $legs = WorkOrderSection::whereIn('status', ['ready', 'in_progress', 'rework', 'awaiting_rework'])
            ->whereHas('workOrder', fn ($q) => $q->whereNotIn('status', self::CLOSED))
            ->with(['workOrder:id,wo_number,job_number,status', 'workOrder.items:id,work_order_id,description', 'assignedTo:id,name'])
            ->get()->groupBy('section_id');

        return $shops->map(function ($shop) use ($machines, $legs) {
            $m = $machines->get($shop->id, collect());
            $mix = collect(['running', 'setup', 'idle', 'maintenance', 'breakdown', 'offline'])
                ->mapWithKeys(fn ($s) => [$s => $m->where('current_state', $s)->count()])->all();
            $jobs = $legs->get($shop->id, collect());

            return [
                'id'                => $shop->id,
                'name'              => $shop->name,
                'total_machines'    => $m->count(),
                'active_machines'   => $mix['running'],
                'active_jobs_count' => $jobs->count(),
                'state_mix'         => $mix,
                'active_jobs'       => $jobs->take(5)->map(fn ($leg) => [
                    'wo_number'  => $leg->workOrder->wo_number,
                    'job_number' => $leg->workOrder->job_number,
                    'product'    => (string) $leg->workOrder->items->first()?->description,
                    'operator'   => $leg->assignedTo?->name ?? '',
                ])->values()->all(),
                'status_color'      => $mix['breakdown'] > 0 ? 'red' : ($jobs->isNotEmpty() || $mix['running'] > 0 ? 'green' : 'gray'),
            ];
        })->values()->all();
    }

    /** Maintenance requests not yet done, by category, and the oldest few. */
    public function maintenance(): array
    {
        $open = MaintenanceRequest::whereIn('status', ['pending', 'approved', 'in_progress']);

        return [
            'electrical' => (clone $open)->where('category', 'electrical')->count(),
            'mechanical' => (clone $open)->where('category', 'mechanical')->count(),
            'pending'    => (clone $open)->where('status', 'pending')->count(),
            'list'       => (clone $open)->with('machine:id,name,machine_code')
                ->orderByRaw("FIELD(urgency, 'urgent', 'normal', 'low')")->oldest()->limit(5)->get()
                ->map(fn ($r) => [
                    'id'       => $r->id,
                    'machine'  => $r->machine?->name ?? '—',
                    'code'     => $r->machine?->machine_code,
                    'category' => $r->category,
                    'status'   => $r->status,
                    'urgency'  => $r->urgency,
                    'days'     => (int) $r->created_at->diffInDays(now()),
                ])->all(),
        ];
    }

    // ── Activity & personal queue ─────────────────────────────────────

    /** The latest movements worth seeing on a wall: jobs, deliveries, bills, payments. */
    public function activity(int $limit = 15): array
    {
        return AuditLog::query()
            ->where(function ($q) {
                $q->whereIn('action', ['qc_passed', 'qc_hold', 'ncr_closed'])
                  ->orWhere(fn ($q) => $q->where('action', 'status_changed')->whereIn('model_type', ['WorkOrder', 'DeliveryOrder', 'Quotation', 'Invoice']))
                  ->orWhere(fn ($q) => $q->where('action', 'created')->whereIn('model_type', ['Rfq', 'WorkOrder', 'DeliveryOrder', 'Invoice', 'Payment']));
            })
            ->latest('id')->limit($limit)->get()
            ->map(fn ($log) => [
                'id'        => $log->id,
                'action'    => $log->action,
                'message'   => $log->new_values['message'] ?? $log->action,
                'color'     => match (true) {
                    $log->action === 'qc_passed', $log->model_type === 'Payment' => 'green',
                    $log->action === 'qc_hold'                                   => 'amber',
                    $log->action === 'created'                                   => 'blue',
                    default                                                      => 'purple',
                },
                'time'      => $log->created_at->format('H:i'),
                'timestamp' => $log->created_at->toIso8601String(),
            ])->all();
    }

    /**
     * What is waiting on THIS person — each entry only for someone whose job
     * it is, so a shop engineer is not shown IED's inbox.
     */
    public function waitingFor(User $user): array
    {
        $items = [];
        $add = function (string $label, int $n, string $href, string $icon) use (&$items) {
            if ($n > 0) $items[] = compact('label', 'href', 'icon') + ['count' => $n];
        };

        $add('Quotations to approve', DB::table('quotation_approvals')
            ->where('status', 'pending')
            ->where(fn ($q) => $q->where('approver_id', $user->id)->orWhere('forwarded_to_user_id', $user->id))->count(),
            '/approvals', 'fi-rr-stamp');
        $add('Cost estimates to approve', DB::table('cost_estimate_approvals')
            ->where('status', 'pending')->where('approver_id', $user->id)->count(),
            '/approvals?type=estimate', 'fi-rr-calculator');

        if ($user->can('view rfqs')) {
            $add('Work orders to accept', WorkOrder::where('status', 'ied_pending')->count(), '/ied/work-orders', 'fi-rr-paper-plane');
        }
        if ($user->can('review pcd-inbox')) {
            $add('PCD Inbox — to review, release or sign',
                WorkOrder::whereIn('status', ['pcd_review', 'pcd_release_pending'])->count()
                + DeliveryOrder::where('challan_status', 'pending')->count(),
                '/pcd/inbox', 'fi-rr-inbox');
        }
        if ($user->can('view pcd-inbox')) {
            $add('Jobs to plan', WorkOrder::where('status', 'pcd_pending')->count(), '/pcd/job-planning', 'fi-rr-clipboard-list');
            $add('Material demands from the shops', \App\Models\MaterialDemand::where('status', 'submitted')->count(), '/material-demands', 'fi-rr-box-open');
        }
        if ($user->can('view pcd-inbox') || $user->can('review pcd-inbox')) {
            $add('Material requisitions to sign', RequisitionApproval::waitingFor($user)->count(), '/pcd/material-requisitions', 'fi-rr-pen-clip');
        }
        if ($user->can('use notes')) {
            $add('Notes to sign', count(NoteWorkflow::awaitingIds($user)), '/office-notes?tab=awaiting', 'fi-rr-document-signed');
        }
        if ($user->can('approve maintenance-requests')) {
            $add('Maintenance requests to approve', MaintenanceRequest::pending()->count(), '/maintenance-requests', 'fi-rr-tools');
        }
        if ($user->can('create invoices')) {
            $add('Delivered challans to bill', DeliveryOrder::where('status', 'delivered')->whereNull('invoice_id')
                ->whereNotNull('challan_number')->count(), '/billing/delivery-challans', 'fi-rr-receipt');
        }

        return $items;
    }
}
