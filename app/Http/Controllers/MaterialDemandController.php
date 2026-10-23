<?php

namespace App\Http\Controllers;

use App\Models\Material;
use App\Models\MaterialDemand;
use App\Models\MaterialRequisition;
use App\Models\Section;
use App\Models\User;
use App\Models\WorkOrderSection;
use App\Services\NotifyService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;

/**
 * Material demands — a shop asks PCD for material for a job (BITAC,
 * 2026-10-23). PCD answers by raising a material requisition to the store
 * from it (MaterialRequisitionController, `?demand_id=`), or rejects it with a
 * reason. The demand then follows that requisition; nothing is copied back.
 *
 * Who is who:
 *   - a SHOP raises them — anyone with `view production`, for the shop they
 *     are posted to (a bench counts as its shop); someone posted nowhere, or a
 *     super admin, may pick the shop;
 *   - PCD answers them — `view pcd-inbox`, the planners who raise requisitions.
 * A shop sees its own shop's demands; PCD sees all of them at the centre.
 */
class MaterialDemandController extends Controller
{
    // ── Who may do what ─────────────────────────────────────────────────

    private function canRaise(User $u): bool  { return $u->can('view production'); }
    private function canDecide(User $u): bool { return $u->can('view pcd-inbox'); }

    /** @return int[] the shops this person raises demands for */
    private function shopIdsFor(User $u): array
    {
        if (! $u->isSuperAdmin() && $u->section_id && ($s = Section::find($u->section_id))) {
            return [(int) ($s->parent_id ?: $s->id)];
        }

        return Section::topLevel()->where('type', 'production_shop')->where('is_active', true)
            ->orderBy('name')->pluck('id')->map(fn ($i) => (int) $i)->all();
    }

    private function seesAll(User $u): bool
    {
        return $u->isSuperAdmin() || $this->canDecide($u);
    }

    private function visible(User $u)
    {
        $q = MaterialDemand::query();
        if ($this->seesAll($u)) return $q;

        $posted = $u->section_id ? $this->shopIdsFor($u) : [];

        return $q->where(fn ($w) => $w->where('requested_by', $u->id)
            ->when($posted, fn ($x) => $x->orWhereIn('section_id', $posted)));
    }

    private function canSee(User $u, MaterialDemand $d): bool
    {
        return $this->visible($u)->whereKey($d->id)->exists();
    }

    /** The requester (or a super admin) may change or withdraw it until PCD answers. */
    private function canChange(User $u, MaterialDemand $d): bool
    {
        return $d->isOpen() && ((int) $d->requested_by === $u->id || $u->isSuperAdmin());
    }

    /**
     * The jobs a shop can ask material for: routed through that shop, its leg
     * not finished, the job itself still live.
     *
     * @return array<int, array<string, mixed>>
     */
    private function jobsFor(array $shopIds): array
    {
        return WorkOrderSection::with('workOrder.customer')
            ->whereIn('section_id', $shopIds ?: [0])
            ->where('status', '!=', 'completed')
            ->whereHas('workOrder', fn ($q) => $q->whereNotIn('status', ['cancelled', 'delivered', 'closed']))
            ->get()
            ->map(fn ($s) => [
                'section_id' => (int) $s->section_id,
                'id'         => $s->work_order_id,
                'wo_number'  => $s->workOrder->wo_number,
                'job_number' => $s->workOrder->job_number,
                'customer'   => $s->workOrder->customer?->name,
                'leg_status' => $s->status,
            ])
            ->unique(fn ($r) => $r['section_id'] . ':' . $r['id'])
            ->sortByDesc('id')->values()->all();
    }

    // ── Pages ───────────────────────────────────────────────────────────

    public function index(Request $request)
    {
        $user = $request->user();
        $tab = $request->query('tab') === 'all' ? 'all' : 'open';

        $rows = $this->visible($user)
            ->with(['section:id,name,code', 'workOrder:id,wo_number,job_number,customer_id', 'workOrder.customer:id,name',
                    'requestedBy:id,name', 'requisition:id,mrn_number,status', 'items'])
            ->when($tab === 'open', fn ($q) => $q->whereIn('status', ['submitted', 'accepted']))
            ->when($request->query('section_id'), fn ($q, $s) => $q->where('section_id', $s))
            ->when(trim((string) $request->query('search')), function ($q, $term) {
                $q->where(fn ($w) => $w->where('demand_no', 'like', "%{$term}%")
                    ->orWhereHas('workOrder', fn ($wo) => $wo->where('wo_number', 'like', "%{$term}%")->orWhere('job_number', 'like', "%{$term}%")));
            })
            ->orderByRaw("FIELD(status, 'submitted') DESC")->latest('id')
            ->paginate(20)->withQueryString()
            ->through(fn (MaterialDemand $d) => $this->row($d));

        return Inertia::render('MaterialDemand/Index', [
            'demands'       => $rows,
            'filters'       => ['tab' => $tab, 'section_id' => $request->query('section_id'), 'search' => $request->query('search')],
            'waitingCount'  => $this->visible($user)->where('status', 'submitted')->count(),
            'canRaise'      => $this->canRaise($user),
            'canDecide'     => $this->canDecide($user),
            'shops'         => Section::whereIn('id', $this->shopIdsFor($user))->orderBy('name')->get(['id', 'name']),
        ]);
    }

    public function create(Request $request)
    {
        $user = $request->user();
        abort_unless($this->canRaise($user), 403);

        return Inertia::render('MaterialDemand/Form', $this->formProps($user) + [
            'demand'   => null,
            'presets'  => [
                'section_id'    => $request->integer('section_id') ?: null,
                'work_order_id' => $request->integer('work_order_id') ?: null,
            ],
        ]);
    }

    public function store(Request $request)
    {
        $user = $request->user();
        abort_unless($this->canRaise($user), 403);
        $data = $this->validated($request, $user);

        $demand = DB::transaction(function () use ($data, $user) {
            $d = MaterialDemand::create([
                'demand_no'     => MaterialDemand::generateNo(),
                'section_id'    => $data['section_id'],
                'work_order_id' => $data['work_order_id'] ?? null,
                'requested_by'  => $user->id,
                'needed_by'     => $data['needed_by'] ?? null,
                'status'        => 'submitted',
                'notes'         => $data['notes'] ?? null,
            ]);
            $this->saveItems($d, $data['items']);
            return $d;
        });

        $demand->load('section', 'workOrder');
        NotifyService::toPermission(
            'view pcd-inbox', 'material_demand',
            "Material demand · {$demand->section->name}",
            "{$demand->demand_no} " . ($demand->workOrder ? "for {$demand->workOrder->wo_number}" : '(no job — shop use)') . ($demand->needed_by ? ', needed by ' . $demand->needed_by->format('d M Y') : '') . " — from {$user->name}",
            "/material-demands/{$demand->id}", 'fi-rr-boxes', 'amber', centerId: $demand->center_id,
        );

        return redirect()->route('material-demands.show', $demand)
            ->with('success', "{$demand->demand_no} sent to PCD.");
    }

    public function show(Request $request, MaterialDemand $materialDemand)
    {
        $user = $request->user();
        abort_unless($this->canSee($user, $materialDemand), 403);
        $d = $materialDemand->load(['section', 'workOrder.customer', 'requestedBy', 'decidedBy', 'items.material', 'requisition.items']);

        return Inertia::render('MaterialDemand/Show', [
            'demand' => $this->row($d) + [
                'notes'         => $d->notes,
                'reject_reason' => $d->reject_reason,
                'decided_by'    => $d->decidedBy?->name,
                'decided_at'    => $d->decided_at?->format('d M Y, H:i'),
                'created_at'    => $d->created_at?->format('d M Y, H:i'),
                'items'         => $d->items->map(fn ($i) => [
                    'id'          => $i->id,
                    'material'    => $i->material?->name,
                    'description' => $i->description,
                    'unit'        => $i->unit,
                    'quantity'    => (float) $i->quantity,
                    'remarks'     => $i->remarks,
                ]),
                'requisition_detail' => $d->requisition ? [
                    'id'           => $d->requisition->id,
                    'mrn_number'   => $d->requisition->mrn_number,
                    'status'       => $d->requisition->status,
                    'status_label' => $d->requisition->status_label,
                    'required'     => (float) $d->requisition->items->sum('required_qty'),
                    'issued'       => (float) $d->requisition->items->sum('issue_qty'),
                ] : null,
            ],
            'can' => [
                'edit'   => $this->canChange($user, $d),
                'decide' => $this->canDecide($user) && $d->isOpen(),
            ],
        ]);
    }

    public function edit(Request $request, MaterialDemand $materialDemand)
    {
        $user = $request->user();
        if (! $this->canChange($user, $materialDemand)) {
            return redirect()->route('material-demands.show', $materialDemand)
                ->with('error', "{$materialDemand->demand_no} is {$materialDemand->status_label} — it can no longer be changed.");
        }
        $materialDemand->load('items');

        return Inertia::render('MaterialDemand/Form', $this->formProps($user) + [
            'demand' => [
                'id'            => $materialDemand->id,
                'demand_no'     => $materialDemand->demand_no,
                'section_id'    => $materialDemand->section_id,
                'work_order_id' => $materialDemand->work_order_id,
                'needed_by'     => $materialDemand->needed_by?->toDateString(),
                'notes'         => $materialDemand->notes,
                'items'         => $materialDemand->items->map(fn ($i) => [
                    'material_id' => $i->material_id, 'description' => $i->description ?? '',
                    'unit' => $i->unit, 'quantity' => (float) $i->quantity, 'remarks' => $i->remarks ?? '',
                ]),
            ],
            'presets' => [],
        ]);
    }

    public function update(Request $request, MaterialDemand $materialDemand)
    {
        $user = $request->user();
        if (! $this->canChange($user, $materialDemand)) {
            return redirect()->route('material-demands.show', $materialDemand)
                ->with('error', "{$materialDemand->demand_no} is {$materialDemand->status_label} — it can no longer be changed.");
        }
        $data = $this->validated($request, $user);

        DB::transaction(function () use ($materialDemand, $data) {
            $materialDemand->update([
                'section_id'    => $data['section_id'],
                'work_order_id' => $data['work_order_id'] ?? null,
                'needed_by'     => $data['needed_by'] ?? null,
                'notes'         => $data['notes'] ?? null,
            ]);
            $materialDemand->items()->delete();
            $this->saveItems($materialDemand, $data['items']);
        });

        return redirect()->route('material-demands.show', $materialDemand)->with('success', 'Demand updated.');
    }

    /** The shop withdraws it — before PCD has answered. It stays on the record. */
    public function cancel(Request $request, MaterialDemand $materialDemand)
    {
        if (! $this->canChange($request->user(), $materialDemand)) {
            return back()->with('error', "{$materialDemand->demand_no} is {$materialDemand->status_label} — it can no longer be withdrawn.");
        }
        $materialDemand->update(['status' => 'cancelled', 'decided_by' => $request->user()->id, 'decided_at' => now()]);

        return back()->with('success', "{$materialDemand->demand_no} withdrawn.");
    }

    /** PCD turns it down — a reason is required, or the shop is left guessing. */
    public function reject(Request $request, MaterialDemand $materialDemand)
    {
        $user = $request->user();
        abort_unless($this->canDecide($user), 403);
        if (! $materialDemand->isOpen()) {
            return back()->with('error', "{$materialDemand->demand_no} is already {$materialDemand->status_label}.");
        }
        $data = $request->validate(['reason' => 'required|string|max:1000'], ['reason.required' => 'Say why it is rejected.']);

        $materialDemand->update([
            'status' => 'rejected', 'reject_reason' => trim($data['reason']),
            'decided_by' => $user->id, 'decided_at' => now(),
        ]);
        if ($materialDemand->requested_by) {
            NotifyService::send($materialDemand->requested_by, 'material_demand_rejected',
                "{$materialDemand->demand_no} rejected by PCD", trim($data['reason']),
                "/material-demands/{$materialDemand->id}", 'fi-rr-cross-circle', 'red');
        }

        return back()->with('success', "{$materialDemand->demand_no} rejected.");
    }

    /**
     * Called by MaterialRequisitionController once a requisition has been saved
     * from a demand: links the two and tells the shop. Refuses (returns false)
     * a demand already answered, or one for a different job ("no job" on both
     * sides is the same job).
     */
    public static function linkRequisition(MaterialDemand $demand, MaterialRequisition $mr, User $by): bool
    {
        if (! $demand->isOpen() || (int) $demand->work_order_id !== (int) $mr->work_order_id) return false;
        if (! $mr->section_id) $mr->update(['section_id' => $demand->section_id]);

        $demand->update([
            'status' => 'accepted', 'material_requisition_id' => $mr->id,
            'decided_by' => $by->id, 'decided_at' => now(),
        ]);
        if ($demand->requested_by) {
            NotifyService::send($demand->requested_by, 'material_demand_accepted',
                "{$demand->demand_no}: PCD raised {$mr->mrn_number}",
                'Your material demand has gone to the store as a requisition.',
                "/material-demands/{$demand->id}", 'fi-rr-check-circle', 'green');
        }

        return true;
    }

    // ── helpers ─────────────────────────────────────────────────────────

    private function formProps(User $user): array
    {
        $shopIds = $this->shopIdsFor($user);

        return [
            'shops'     => Section::whereIn('id', $shopIds)->orderBy('name')->get(['id', 'name', 'code']),
            'jobs'      => $this->jobsFor($shopIds),
            'materials' => Material::active()->orderBy('name')->get(['id', 'name', 'category', 'unit', 'density_kg_m3']),
        ];
    }

    private function validated(Request $request, User $user): array
    {
        $shopIds = $this->shopIdsFor($user);
        $data = $request->validate([
            'section_id'          => ['required', 'integer', \Illuminate\Validation\Rule::in($shopIds)],
            // Optional — a shop also needs material for no job (consumables, tools, upkeep).
            'work_order_id'       => 'nullable|integer',
            'needed_by'           => 'nullable|date',
            'notes'               => 'nullable|string|max:1000',
            'items'               => 'required|array|min:1',
            'items.*.material_id' => 'required|exists:materials,id',
            'items.*.description' => 'nullable|string|max:1000',
            'items.*.unit'        => 'nullable|string|max:20',
            'items.*.quantity'    => 'required|numeric|gt:0',
            'items.*.remarks'     => 'nullable|string|max:500',
        ], [
            'section_id.in'                 => 'You can only ask for material for your own shop.',
            'items.*.material_id.required'  => 'Pick a material for every line.',
            'items.*.quantity.gt'           => 'Enter how much is needed.',
        ]);

        // A job, when given, must actually be routed through that shop — not any job id.
        $routed = empty($data['work_order_id'])
            || collect($this->jobsFor([(int) $data['section_id']]))->pluck('id')->contains((int) $data['work_order_id']);
        if (! $routed) {
            throw \Illuminate\Validation\ValidationException::withMessages([
                'work_order_id' => 'That job is not open at this shop.',
            ]);
        }

        return $data;
    }

    private function saveItems(MaterialDemand $d, array $items): void
    {
        foreach ($items as $i) {
            $d->items()->create([
                'material_id' => $i['material_id'],
                'description' => ($i['description'] ?? null) ?: null,
                'unit'        => ($i['unit'] ?? null) ?: 'kg',
                'quantity'    => (float) $i['quantity'],
                'remarks'     => ($i['remarks'] ?? null) ?: null,
            ]);
        }
    }

    private function row(MaterialDemand $d): array
    {
        return [
            'id'           => $d->id,
            'demand_no'    => $d->demand_no,
            'status'       => $d->status,
            'status_label' => $d->status_label,
            'shop'         => $d->section?->name,
            'section_id'   => $d->section_id,
            'work_order'   => $d->workOrder ? [
                'id' => $d->workOrder->id, 'wo_number' => $d->workOrder->wo_number,
                'job_number' => $d->workOrder->job_number, 'customer' => $d->workOrder->customer?->name,
            ] : null,
            'requested_by' => $d->requestedBy?->name,
            'needed_by'    => $d->needed_by?->format('d M Y'),
            'overdue'      => $d->isOpen() && $d->needed_by && $d->needed_by->isPast() && ! $d->needed_by->isToday(),
            'item_count'   => $d->items->count(),
            'created'      => $d->created_at?->format('d M Y'),
            'requisition'  => $d->requisition ? [
                'id' => $d->requisition->id, 'mrn_number' => $d->requisition->mrn_number,
                'status' => $d->requisition->status, 'status_label' => $d->requisition->status_label,
            ] : null,
        ];
    }
}
