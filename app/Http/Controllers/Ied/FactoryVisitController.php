<?php

namespace App\Http\Controllers\Ied;

use App\Http\Controllers\Controller;
use App\Models\Customer;
use App\Models\FactoryVisit;
use Illuminate\Http\Request;

/**
 * Entering IED's factory visits — planned ones (Factory to be Visited) and
 * ones that happened (Factory Visited). The reports themselves are tabs of
 * IED → Reports (IedReportController / IedReportService).
 *
 * Every write returns to the tab it came from, keeping the year on screen.
 */
class FactoryVisitController extends Controller
{
    /** Add a planned visit, or a visit that already happened. */
    public function store(Request $request)
    {
        $kind = $request->input('kind') === 'visited' ? 'visited' : 'planned';
        $data = $this->validated($request, $kind);

        FactoryVisit::create($this->attributes($data, $kind) + [
            'status'     => $kind,
            'created_by' => $request->user()->id,
            'updated_by' => $request->user()->id,
        ]);

        return $this->back($request, $kind, $kind === 'visited' ? 'Factory visit recorded.' : 'Planned visit added.');
    }

    public function update(Request $request, FactoryVisit $factoryVisit)
    {
        $kind = $factoryVisit->status;
        $data = $this->validated($request, $kind);

        $factoryVisit->update($this->attributes($data, $kind) + ['updated_by' => $request->user()->id]);

        return $this->back($request, $kind, 'Saved.');
    }

    /**
     * A planned visit happened. The same row moves from "to be visited" to
     * "visited" — the factory, the visitors and the plan date are kept.
     */
    public function markVisited(Request $request, FactoryVisit $factoryVisit)
    {
        if ($factoryVisit->status !== 'planned') {
            return $this->back($request, 'visited', "{$factoryVisit->factory_name} is already recorded as visited.", 'error');
        }

        $data = $request->validate([
            'visited_on' => 'required|date|before_or_equal:today',
            'visit_work' => 'required|string|max:5000',
            'visitors'   => 'required|string|max:500',
            'remarks'    => 'nullable|string|max:2000',
        ], $this->messages());

        $factoryVisit->update([
            'status'     => 'visited',
            'visited_on' => $data['visited_on'],
            'visit_work' => $data['visit_work'],
            // Who actually went can differ from who was meant to.
            'visitors'   => $data['visitors'],
            'remarks'    => ($data['remarks'] ?? null) ?: $factoryVisit->remarks,
            'updated_by' => $request->user()->id,
        ]);

        return $this->back($request, 'tovisit', "{$factoryVisit->factory_name} marked as visited — it is now under Factory Visited.");
    }

    public function destroy(Request $request, FactoryVisit $factoryVisit)
    {
        $kind = $factoryVisit->status;
        $name = $factoryVisit->factory_name;
        $factoryVisit->delete();

        return $this->back($request, $kind, "{$name} removed.");
    }

    // ─────────────────────────────────────────────────────────────────────

    private function validated(Request $request, string $kind): array
    {
        return $request->validate([
            'customer_id'  => 'nullable|integer|exists:customers,id',
            'factory_name' => 'required_without:customer_id|nullable|string|max:200',
            'visitors'     => 'required|string|max:500',
            'planned_date' => $kind === 'planned' ? 'required|date' : 'nullable|date',
            'visited_on'   => $kind === 'visited' ? 'required|date|before_or_equal:today' : 'nullable',
            'visit_work'   => $kind === 'visited' ? 'required|string|max:5000' : 'nullable|string|max:5000',
            'remarks'      => 'nullable|string|max:2000',
        ], $this->messages());
    }

    private function messages(): array
    {
        return [
            'factory_name.required_without' => 'Choose the factory, or type its name.',
            'visitors.required'     => 'Who visited — a name or the delegation.',
            'planned_date.required' => 'When is the visit planned?',
            'visited_on.required'   => 'When was it visited?',
            'visited_on.before_or_equal' => 'A visit that has happened cannot be dated in the future.',
            'visit_work.required'   => 'What was done on the visit?',
        ];
    }

    /**
     * The factory's name is ALWAYS stored: the stakeholder's name when one is
     * picked (a snapshot — renaming the customer later must not rewrite a past
     * visit), else what was typed.
     */
    private function attributes(array $data, string $kind): array
    {
        $customerId = ($data['customer_id'] ?? null) ?: null;
        $name = $customerId ? Customer::withoutGlobalScopes()->whereKey($customerId)->value('name') : null;

        return [
            'customer_id'  => $customerId,
            'factory_name' => trim($name ?: (string) ($data['factory_name'] ?? '')),
            'visitors'     => trim($data['visitors']),
            'planned_date' => ($data['planned_date'] ?? null) ?: null,
            'visited_on'   => $kind === 'visited' ? $data['visited_on'] : null,
            'visit_work'   => ($data['visit_work'] ?? null) ?: null,
            'remarks'      => ($data['remarks'] ?? null) ?: null,
        ];
    }

    private function back(Request $request, string $kind, string $message, string $flash = 'success')
    {
        return redirect()->route('ied.reports', array_filter([
            'view'      => $kind === 'visited' ? 'visited' : 'tovisit',
            'year'      => $request->input('year'),
            'center_id' => $request->input('center_id'),
        ]))->with($flash, $message);
    }
}
