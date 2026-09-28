<?php

namespace App\Http\Controllers;

use App\Models\Center;
use App\Models\CenterTarget;
use App\Services\TargetAchievementService;
use App\Support\FinancialYear;
use Illuminate\Http\Request;
use Inertia\Inertia;

/**
 * Target vs Achievement — taka, per centre, per financial year.
 *
 * A centre admin sets and sees their own centre. A super admin sees every
 * centre side by side and may set any of them.
 */
class TargetController extends Controller
{
    public function __construct(private TargetAchievementService $service) {}

    public function index(Request $request)
    {
        $year = (string) $request->input('year', FinancialYear::current());
        if (! FinancialYear::isValid($year)) {
            $year = FinancialYear::current();
        }

        // A super admin looks across BITAC; everyone else sees their own centre.
        $scopeCenterId = $this->isSuperAdmin() ? null : $this->myCenterId();

        $rows = $this->service->forYear($year, $scopeCenterId);

        return Inertia::render('Reports/TargetAchievement', [
            'year'        => $year,
            'yearLabel'   => FinancialYear::describe($year),
            'years'       => collect(FinancialYear::options(5, 1))
                ->map(fn ($y) => ['value' => $y, 'label' => $y . ' · ' . FinancialYear::describe($y)])
                ->values(),
            'rows'        => $rows,
            'totals'      => [
                'target'      => round(array_sum(array_column($rows, 'target')), 2),
                'achieved'    => round(array_sum(array_column($rows, 'achieved')), 2),
                'work_orders' => array_sum(array_column($rows, 'work_orders')),
            ],
            'canSetFor'   => $this->isSuperAdmin()
                ? Center::orderBy('id')->get(['id', 'name'])
                : Center::where('id', $this->myCenterId())->get(['id', 'name']),
            'isSuperAdmin' => $this->isSuperAdmin(),
        ]);
    }

    /** The work orders behind one centre's figure, so it can be traced. */
    public function breakdown(Request $request, Center $center)
    {
        $year = (string) $request->input('year', FinancialYear::current());
        if (! FinancialYear::isValid($year)) $year = FinancialYear::current();

        if (! $this->isSuperAdmin() && $center->id !== $this->myCenterId()) {
            abort(403, 'You can only see your own centre.');
        }

        return response()->json([
            'year'        => $year,
            'center'      => $center->name,
            'workOrders'  => $this->service->workOrdersFor($year, $center->id),
        ]);
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'center_id'      => 'required|exists:centers,id',
            'financial_year' => 'required|string|max:9',
            'target_amount'  => 'required|numeric|min:0',
            'note'           => 'nullable|string|max:500',
        ]);

        if (! FinancialYear::isValid($validated['financial_year'])) {
            return back()->with('error', 'That is not a valid financial year.');
        }

        // A centre admin may only set their own centre's figure.
        if (! $this->isSuperAdmin() && (int) $validated['center_id'] !== $this->myCenterId()) {
            return back()->with('error', 'You can only set the target for your own centre.');
        }

        // One figure per centre per year — update in place rather than stacking.
        CenterTarget::updateOrCreate(
            ['center_id' => $validated['center_id'], 'financial_year' => $validated['financial_year']],
            [
                'target_amount' => $validated['target_amount'],
                'note'          => $validated['note'] ?? null,
                'set_by'        => auth()->id(),
            ]
        );

        return back()->with('success', 'Target saved for ' . $validated['financial_year'] . '.');
    }

    private function isSuperAdmin(): bool
    {
        $u = auth()->user();

        return $u && method_exists($u, 'hasRole') && $u->hasRole('super_admin');
    }

    private function myCenterId(): ?int
    {
        return auth()->user()?->center_id
            ?? (app()->bound('current_center_id') ? app('current_center_id') : null);
    }
}
