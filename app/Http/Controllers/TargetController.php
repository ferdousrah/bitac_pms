<?php

namespace App\Http\Controllers;

use App\Models\Center;
use App\Models\CenterTarget;
use App\Services\TargetAchievementService;
use App\Support\FinancialYear;
use Illuminate\Http\Request;

/**
 * Target vs Achievement — taka, per centre, per financial year.
 *
 * ⚠️ **The report itself now lives in IED → Reports** (BITAC set the yearly
 * figure from IED, so the report and the form that sets it belong on the same
 * desk). This controller keeps the two things the page calls — saving a
 * target and tracing a figure back to its work orders — and redirects its old
 * index, because notifications and bookmarks written before the move point
 * there and a stale link must land somewhere useful.
 *
 * A centre admin sets and sees their own centre. A super admin sees every
 * centre side by side and may set any of them.
 */
class TargetController extends Controller
{
    public function __construct(private TargetAchievementService $service) {}

    /** The report moved to IED → Reports; old links land on it. */
    public function index(Request $request)
    {
        return redirect()->route('ied.reports', array_filter([
            'view' => 'target',
            'year' => $request->input('year'),
        ]));
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

    /**
     * ⚠️ The role is `super-admin` with a HYPHEN. This asked for
     * `super_admin`, which is a role nobody has, so it was always false — and
     * a super admin was quietly treated as a centre admin here, seeing and
     * setting one centre instead of all six, which is the entire point of
     * this report. User::isSuperAdmin() is the one place that knows it.
     */
    private function isSuperAdmin(): bool
    {
        return auth()->user()?->isSuperAdmin() ?? false;
    }

    private function myCenterId(): ?int
    {
        return auth()->user()?->center_id
            ?? (app()->bound('current_center_id') ? app('current_center_id') : null);
    }
}
