<?php

namespace App\Http\Controllers;

use App\Models\ServiceDemandLog;
use Illuminate\Http\Request;
use Inertia\Inertia;

class ServiceDemandController extends Controller
{
    private const CATEGORIES = [
        'machining'           => 'Machining',
        'welding'             => 'Welding',
        'heat_treatment'      => 'Heat Treatment',
        'casting'             => 'Casting',
        'surface_treatment'   => 'Surface Treatment',
        'inspection'          => 'Inspection / Testing',
        'training'            => 'Training',
        'fabrication'         => 'Fabrication',
        'repair'              => 'Repair / Overhaul',
        'design_consultancy'  => 'Design / Consultancy',
        'other'               => 'Other',
    ];

    public function index(Request $request)
    {
        $q = ServiceDemandLog::query()->with('loggedBy')->latest('id');

        if ($cat = $request->input('category'))   $q->where('service_category', $cat);
        if ($vol = $request->input('volume'))     $q->where('expected_volume', $vol);
        if ($val = $request->input('value'))      $q->where('potential_value', $val);
        if ($year = $request->input('year'))      $q->whereYear('logged_date', (int) $year);
        if ($search = trim((string) $request->input('search'))) {
            $q->where(function ($q) use ($search) {
                $q->where('requested_service', 'like', "%{$search}%")
                  ->orWhere('requester_name', 'like', "%{$search}%")
                  ->orWhere('requester_organization', 'like', "%{$search}%")
                  ->orWhere('context', 'like', "%{$search}%");
            });
        }

        $rows = $q->paginate(20)->withQueryString()->through(fn ($r) => [
            'id'                     => $r->id,
            'requested_service'      => $r->requested_service,
            'service_category'       => $r->service_category,
            'category_label'         => self::CATEGORIES[$r->service_category] ?? $r->service_category,
            'requester_name'         => $r->requester_name,
            'requester_organization' => $r->requester_organization,
            'expected_volume'        => $r->expected_volume,
            'potential_value'        => $r->potential_value,
            'logged_date'            => $r->logged_date?->format('d M Y'),
            'logged_by'              => $r->loggedBy?->name,
        ]);

        $availableYears = ServiceDemandLog::selectRaw('YEAR(logged_date) as y')
            ->distinct()->orderByDesc('y')->pluck('y')->all();
        if (empty($availableYears)) $availableYears = [now()->year];

        return Inertia::render('ServiceDemand/Index', [
            'logs'           => $rows,
            'filters'        => $request->only(['search', 'category', 'volume', 'value', 'year']),
            'categories'     => self::CATEGORIES,
            'availableYears' => $availableYears,
            'stats'          => [
                'total_year'  => ServiceDemandLog::whereYear('logged_date', now()->year)->count(),
                'high_value'  => ServiceDemandLog::where('potential_value', 'high')->whereYear('logged_date', now()->year)->count(),
                'unique_svc'  => ServiceDemandLog::distinct('requested_service')->count('requested_service'),
            ],
        ]);
    }

    public function create()
    {
        return Inertia::render('ServiceDemand/CreateEdit', [
            'log'        => null,
            'categories' => self::CATEGORIES,
        ]);
    }

    public function store(Request $request)
    {
        $validated = $this->validateInput($request);
        $validated['logged_by'] = auth()->id();
        ServiceDemandLog::create($validated);

        if ($request->boolean('save_and_add')) {
            return redirect()->route('ied.service-demand.create')
                ->with('success', 'Entry saved. Add another below.');
        }

        return redirect()->route('ied.service-demand.index')
            ->with('success', 'Service demand entry logged.');
    }

    public function edit(ServiceDemandLog $serviceDemand)
    {
        return Inertia::render('ServiceDemand/CreateEdit', [
            'log'        => $serviceDemand->toArray(),
            'categories' => self::CATEGORIES,
        ]);
    }

    public function update(Request $request, ServiceDemandLog $serviceDemand)
    {
        $serviceDemand->update($this->validateInput($request));
        return redirect()->route('ied.service-demand.index')->with('success', 'Entry updated.');
    }

    public function destroy(ServiceDemandLog $serviceDemand)
    {
        $serviceDemand->delete();
        return back()->with('success', 'Entry deleted.');
    }

    /** Strategic annual report — what BITAC's market is asking for. */
    public function report(Request $request)
    {
        $year = (int) ($request->input('year') ?? now()->year);
        $base = ServiceDemandLog::year($year);

        // Top services by request count (case-insensitive grouping on lowercase form)
        $topServices = (clone $base)
            ->selectRaw('requested_service, COUNT(*) as cnt,
                         SUM(CASE WHEN potential_value="high" THEN 1 ELSE 0 END) as high_cnt,
                         SUM(CASE WHEN expected_volume IN ("frequent","regular") THEN 1 ELSE 0 END) as freq_cnt')
            ->groupBy('requested_service')
            ->orderByDesc('cnt')
            ->limit(15)
            ->get()
            ->toArray();

        // By category
        $byCategory = (clone $base)->selectRaw('service_category, COUNT(*) as cnt')
            ->groupBy('service_category')->orderByDesc('cnt')->pluck('cnt', 'service_category')->all();

        // By value tier
        $byValue = (clone $base)->selectRaw('potential_value, COUNT(*) as cnt')
            ->groupBy('potential_value')->pluck('cnt', 'potential_value')->all();

        // By expected volume
        $byVolume = (clone $base)->selectRaw('expected_volume, COUNT(*) as cnt')
            ->groupBy('expected_volume')->pluck('cnt', 'expected_volume')->all();

        // Monthly trend
        $monthly = [];
        for ($m = 1; $m <= 12; $m++) {
            $monthly[] = [
                'month' => $m,
                'label' => date('M', mktime(0, 0, 0, $m, 1)),
                'count' => (clone $base)->whereMonth('logged_date', $m)->count(),
            ];
        }

        // Top organisations who keep asking for things BITAC doesn't have
        $topOrgs = (clone $base)
            ->whereNotNull('requester_organization')
            ->selectRaw('requester_organization, COUNT(*) as cnt')
            ->groupBy('requester_organization')
            ->orderByDesc('cnt')
            ->limit(10)
            ->get()
            ->toArray();

        $total = array_sum($byCategory);

        // Surface 3 actionable "investment hints" — services with high count AND
        // high value AND frequent volume.
        $investmentHints = (clone $base)
            ->selectRaw('requested_service, COUNT(*) as cnt')
            ->where('potential_value', 'high')
            ->whereIn('expected_volume', ['frequent', 'regular'])
            ->groupBy('requested_service')
            ->orderByDesc('cnt')
            ->limit(5)
            ->get()
            ->toArray();

        $availableYears = ServiceDemandLog::selectRaw('YEAR(logged_date) as y')
            ->distinct()->orderByDesc('y')->pluck('y')->all();
        if (empty($availableYears)) $availableYears = [now()->year];

        return Inertia::render('ServiceDemand/Report', [
            'year'            => $year,
            'availableYears'  => $availableYears,
            'categories'      => self::CATEGORIES,
            'summary'         => [
                'total'        => $total,
                'unique_svc'   => count($topServices),
                'high_value'   => $byValue['high'] ?? 0,
                'frequent'     => ($byVolume['frequent'] ?? 0) + ($byVolume['regular'] ?? 0),
            ],
            'topServices'     => $topServices,
            'byCategory'      => $byCategory,
            'byValue'         => $byValue,
            'byVolume'        => $byVolume,
            'monthly'         => $monthly,
            'topOrgs'         => $topOrgs,
            'investmentHints' => $investmentHints,
        ]);
    }

    public function exportReport(Request $request)
    {
        $year = (int) ($request->input('year') ?? now()->year);
        $rows = ServiceDemandLog::year($year)->orderBy('id')->get();

        $filename = "service-demand-{$year}.csv";
        $headers = [
            'Content-Type'        => 'text/csv; charset=UTF-8',
            'Content-Disposition' => "attachment; filename=\"{$filename}\"",
        ];

        $callback = function () use ($rows) {
            $h = fopen('php://output', 'w');
            fwrite($h, "\xEF\xBB\xBF");
            fputcsv($h, [
                'Date', 'Service Requested', 'Category',
                'Requester', 'Organisation', 'Contact', 'Type',
                'Volume', 'Potential Value', 'Context', 'Logged By',
            ]);
            foreach ($rows as $r) {
                fputcsv($h, [
                    $r->logged_date?->format('Y-m-d'),
                    $r->requested_service,
                    self::CATEGORIES[$r->service_category] ?? $r->service_category,
                    $r->requester_name,
                    $r->requester_organization,
                    $r->requester_contact,
                    $r->requester_type,
                    $r->expected_volume,
                    $r->potential_value,
                    $r->context,
                    $r->loggedBy?->name,
                ]);
            }
            fclose($h);
        };

        return response()->stream($callback, 200, $headers);
    }

    private function validateInput(Request $request): array
    {
        return $request->validate([
            'requested_service'      => 'required|string|max:200',
            'service_category'       => 'required|in:' . implode(',', array_keys(self::CATEGORIES)),
            'requester_name'         => 'nullable|string|max:150',
            'requester_organization' => 'nullable|string|max:200',
            'requester_contact'      => 'nullable|string|max:100',
            'requester_type'         => 'required|in:existing_customer,prospective_customer,individual,student,organization',
            'context'                => 'required|string|max:5000',
            'expected_volume'        => 'required|in:one_time,occasional,frequent,regular',
            'potential_value'        => 'required|in:low,medium,high',
            'logged_date'            => 'required|date',
            'notes'                  => 'nullable|string|max:2000',
        ]);
    }
}
