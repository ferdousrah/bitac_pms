<?php

namespace App\Http\Controllers\Ied;

use App\Http\Controllers\Controller;
use App\Models\Center;
use App\Services\IedReportService;
use App\Support\FinancialYear;
use Illuminate\Http\Request;
use Inertia\Inertia;

/**
 * IED's commercial reports — who the work is for and what it is worth.
 *
 * One page with four views, because they share the same financial-year and
 * centre filters and IED reads them together.
 */
class IedReportController extends Controller
{
    public function __construct(private IedReportService $service) {}

    public function index(Request $request)
    {
        $year = (string) $request->input('year', FinancialYear::current());
        if (! FinancialYear::isValid($year)) $year = FinancialYear::current();

        $view = in_array($request->input('view'), ['clients', 'sector', 'quotations', 'pipeline'], true)
            ? $request->input('view')
            : 'clients';

        // A super admin looks across BITAC; everyone else sees their own centre.
        $centerId = $this->isSuperAdmin() ? $request->integer('center_id') ?: null : $this->myCenterId();

        return Inertia::render('Ied/Reports/Index', [
            'view'      => $view,
            'year'      => $year,
            'yearLabel' => FinancialYear::describe($year),
            'years'     => collect(FinancialYear::options(5, 1))
                ->map(fn ($y) => ['value' => $y, 'label' => $y . ' · ' . FinancialYear::describe($y)])
                ->values(),
            'centerId'  => $centerId,
            'centers'   => $this->isSuperAdmin() ? Center::orderBy('id')->get(['id', 'name']) : [],
            'search'    => $request->input('search', ''),

            // Only the view being looked at is queried — the others are a click away.
            'clients'    => $view === 'clients'
                ? $this->service->clients($year, $centerId, $request->input('search'))
                : null,
            'sectors'    => $view === 'sector'     ? $this->service->bySector($year, $centerId) : null,
            'quotations' => $view === 'quotations' ? $this->service->quotationValue($year, $centerId) : null,
            'pipeline'   => $view === 'pipeline'   ? $this->service->pipeline($centerId) : null,
        ]);
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
