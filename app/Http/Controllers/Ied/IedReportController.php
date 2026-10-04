<?php

namespace App\Http\Controllers\Ied;

use App\Http\Controllers\Controller;
use App\Models\Center;
use App\Services\IedReportService;
use App\Services\Reports\IedReportSheets;
use App\Services\ReportSheetRenderer;
use App\Services\TargetAchievementService;
use App\Support\FinancialYear;
use Illuminate\Http\Request;
use Inertia\Inertia;

/**
 * IED's commercial reports — who the work is for and what it is worth.
 *
 * One page with five views, because they share the same financial-year and
 * centre filters and IED reads them together.
 *
 * ⚠️ **Target vs Achievement lives here**, not under the production Reports
 * group: BITAC set the yearly figure from IED, so the report and the form
 * that sets it belong on the same desk. The old /reports/target-achievement
 * URL redirects here. The figures still come from
 * App\Services\TargetAchievementService — there is one implementation, so
 * this page and anything else that asks can never disagree.
 */
class IedReportController extends Controller
{
    public function __construct(
        private IedReportService $service,
        private TargetAchievementService $targets,
    ) {}

    public const VIEWS = ['clients', 'sector', 'quotations', 'pipeline', 'target'];

    public function index(Request $request)
    {
        [$view, $year, $centerId] = $this->resolve($request);

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
            'target'     => $view === 'target'     ? $this->targetData($year, $centerId) : null,
        ]);
    }

    /**
     * The same report, on the BITAC pad.
     *
     * ⚠️ It asks the SAME services with the SAME filters as index(), through
     * resolve(), and the sheet builders compute nothing — a printed figure
     * that disagrees with the screen is the one failure nobody can explain
     * away.
     */
    public function pdf(Request $request)
    {
        [$view, $year, $centerId] = $this->resolve($request);

        $centre = $centerId ? Center::find($centerId)?->name : null;
        $label  = FinancialYear::describe($year);

        $sheet = match ($view) {
            'sector'     => IedReportSheets::sector($label, $centre, $this->service->bySector($year, $centerId)),
            'quotations' => IedReportSheets::quotationValue($label, $centre, $this->service->quotationValue($year, $centerId)),
            'pipeline'   => IedReportSheets::pipeline($centre, $this->service->pipeline($centerId)),
            'target'     => IedReportSheets::target($label, $centre, $this->targetData($year, $centerId)),
            default      => IedReportSheets::clients($label, $centre,
                $this->service->clients($year, $centerId, $request->input('search')),
                $request->input('search')),
        };

        return $this->stream(app(ReportSheetRenderer::class)->render($sheet), $view, $request);
    }

    /** One place decides what is being looked at, for the screen and the print. */
    private function resolve(Request $request): array
    {
        $year = (string) $request->input('year', FinancialYear::current());
        if (! FinancialYear::isValid($year)) $year = FinancialYear::current();

        $view = in_array($request->input('view'), self::VIEWS, true)
            ? $request->input('view')
            : 'clients';

        // A super admin looks across BITAC; everyone else sees their own centre.
        $centerId = $this->isSuperAdmin() ? $request->integer('center_id') ?: null : $this->myCenterId();

        return [$view, $year, $centerId];
    }

    /**
     * `?preview=base64` is how PdfPopupModal fetches a PDF (download managers
     * hijack an application/pdf response); `?download=1` forces a save.
     */
    private function stream(string $bytes, string $name, Request $request)
    {
        $filename = $name . '-' . now()->format('Y-m-d') . '.pdf';

        if ($request->input('preview') === 'base64') {
            return response()->json([
                'filename' => $filename,
                'size'     => strlen($bytes),
                'data'     => base64_encode($bytes),
            ]);
        }

        return response($bytes, 200, [
            'Content-Type'        => 'application/pdf',
            'Content-Disposition' => ($request->boolean('download') ? 'attachment' : 'inline')
                . '; filename="' . $filename . '"',
            'Content-Length'      => strlen($bytes),
        ]);
    }

    /**
     * Target vs Achievement for the year on screen.
     *
     * ⚠️ `canSetFor` is empty unless the viewer holds `set targets` — the
     * report is readable by anyone who can open IED Reports, but setting the
     * figure is IED's act, so the form simply is not there for everyone else.
     * The server refuses it too (TargetController@store); this only keeps the
     * screen honest about what the person can do.
     */
    private function targetData(string $year, ?int $centerId): array
    {
        $rows = $this->targets->forYear($year, $this->isSuperAdmin() ? $centerId : $this->myCenterId());

        $canSet = auth()->user()?->can('set targets') ?? false;

        return [
            'rows'   => $rows,
            'totals' => [
                'target'      => round(array_sum(array_column($rows, 'target')), 2),
                'achieved'    => round(array_sum(array_column($rows, 'achieved')), 2),
                'work_orders' => array_sum(array_column($rows, 'work_orders')),
            ],
            // A centre admin may only set their own; a super admin, any.
            'canSetFor' => ! $canSet ? []
                : ($this->isSuperAdmin()
                    ? Center::orderBy('id')->get(['id', 'name'])
                    : Center::where('id', $this->myCenterId())->get(['id', 'name'])),
            'isSuperAdmin' => $this->isSuperAdmin(),
        ];
    }

    /**
     * ⚠️ The role is `super-admin` with a HYPHEN. This asked for
     * `super_admin`, which is a role nobody has, so it was always false — and
     * a super admin was quietly scoped to one centre on every view of this
     * page. User::isSuperAdmin() is the one place that knows the spelling.
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
