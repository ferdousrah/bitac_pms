<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Machine;
use App\Models\Section;
use App\Services\MachineHealthService;
use Illuminate\Http\Request;
use Inertia\Inertia;

class MachineController extends Controller
{
    /**
     * Active production shops + their sub-sections, ordered as a one-level tree
     * (each shop followed by its sub-sections) with parent context — so the
     * machine form's section dropdown reads hierarchically.
     */
    private function sectionOptions()
    {
        $all = Section::active()->shops()->orderBy('display_order')->get(['id', 'name', 'code', 'parent_id']);
        $byParent = $all->whereNotNull('parent_id')->groupBy('parent_id');
        $nameById = $all->pluck('name', 'id');
        $ordered = collect();
        foreach ($all->whereNull('parent_id') as $top) {
            $ordered->push($top);
            foreach ($byParent->get($top->id, collect()) as $c) $ordered->push($c);
        }
        foreach ($all->whereNotNull('parent_id') as $c) {
            if (!$ordered->contains('id', $c->id)) $ordered->push($c);
        }
        return $ordered->map(fn ($s) => [
            'id'          => $s->id,
            'name'        => $s->name,
            'code'        => $s->code,
            'parent_id'   => $s->parent_id,
            'parent_name' => $s->parent_id ? ($nameById[$s->parent_id] ?? null) : null,
        ])->values();
    }

    public function index(Request $request)
    {
        $q = Machine::with('section')->orderBy('name');

        if ($search = trim((string) $request->input('search'))) {
            $q->where(function ($q) use ($search) {
                $q->where('name', 'like', "%{$search}%")
                  ->orWhere('machine_code', 'like', "%{$search}%")
                  ->orWhere('manufacturer', 'like', "%{$search}%")
                  ->orWhere('model', 'like', "%{$search}%")
                  ->orWhere('location', 'like', "%{$search}%");
            });
        }
        if ($sectionId = $request->input('section_id')) {
            $q->where('section_id', $sectionId);
        }
        if ($state = $request->input('current_state')) {
            $q->where('current_state', $state);
        }
        if ($status = $request->input('status')) {
            $q->where('status', $status);
        }

        $machines = $q->paginate(20)->withQueryString()
            ->through(fn($m) => [
                'id'                 => $m->id,
                'name'               => $m->name,
                'machine_code'       => $m->machine_code,
                'section'            => $m->section ? ['id' => $m->section->id, 'name' => $m->section->name, 'code' => $m->section->code] : null,
                'status'             => $m->status,
                'current_state'      => $m->current_state,
                'state_color'        => $m->state_color,
                'health_score'       => $m->health_score,
                'health_label'       => $m->health_label,
                'health_color'       => $m->health_color,
                'maintenance_status' => $m->maintenance_status,
                'days_until_maint'   => $m->days_until_maintenance,
                'rate_group_a'       => $m->rate_group_a,
                'rate_group_b'       => $m->rate_group_b,
                'rate_group_c'       => $m->rate_group_c,
                'rate_group_student' => $m->rate_group_student,
                'rate_group_public'  => $m->rate_group_public,
            ]);

        return Inertia::render('Admin/Machines/Index', [
            'machines' => $machines,
            'fleet'    => MachineHealthService::fleetSummary(),
            'sections' => $this->sectionOptions(),
            'filters'  => $request->only(['search', 'section_id', 'current_state', 'status']),
        ]);
    }

    public function create()
    {
        return Inertia::render('Admin/Machines/CreateEdit', [
            'sections' => $this->sectionOptions(),
        ]);
    }

    public function store(Request $request)
    {
        $validated = $this->validateMachine($request);
        Machine::create($validated);
        return redirect()->route('admin.machines.index')->with('success', 'Machine created successfully.');
    }

    public function show(Machine $machine)
    {
        $machine->load('section', 'maintenanceLogs.performedBy');

        return Inertia::render('Admin/Machines/Show', [
            'machine' => [
                'id'                        => $machine->id,
                'name'                      => $machine->name,
                'machine_code'              => $machine->machine_code,
                'section'                   => $machine->section ? ['id' => $machine->section->id, 'name' => $machine->section->name, 'code' => $machine->section->code] : null,
                'status'                    => $machine->status,
                'description'               => $machine->description,
                'manufacturer'              => $machine->manufacturer,
                'model'                     => $machine->model,
                'serial_number'             => $machine->serial_number,
                'purchased_on'              => $machine->purchased_on?->format('d M Y'),
                'warranty_expires_on'       => $machine->warranty_expires_on?->format('d M Y'),
                'warranty_expired'          => $machine->warranty_expires_on?->isPast() ?? false,
                'asset_value'               => $machine->asset_value,
                'location'                  => $machine->location,
                'current_state'             => $machine->current_state,
                'state_color'               => $machine->state_color,
                'state_changed_at'          => $machine->state_changed_at?->diffForHumans(),
                'last_maintenance_date'     => $machine->last_maintenance_date?->format('d M Y'),
                'next_maintenance_date'     => $machine->next_maintenance_date?->format('d M Y'),
                'maintenance_interval_days' => $machine->maintenance_interval_days,
                'maintenance_status'        => $machine->maintenance_status,
                'days_until_maint'          => $machine->days_until_maintenance,
                'total_runtime_hours'       => $machine->total_runtime_hours,
                'runtime_since_maintenance' => $machine->runtime_since_maintenance,
                'health_score'              => $machine->health_score,
                'health_label'               => $machine->health_label,
                'health_color'              => $machine->health_color,
                'rate_group_a'              => $machine->rate_group_a,
                'rate_group_b'              => $machine->rate_group_b,
                'rate_group_c'              => $machine->rate_group_c,
                'rate_group_student'        => $machine->rate_group_student,
                'rate_group_public'         => $machine->rate_group_public,
                'mtbf_days'                 => MachineHealthService::mtbf($machine),
                'mttr_hours'                => MachineHealthService::mttr($machine),
                'downtime_30d'              => MachineHealthService::totalDowntime($machine, 30),
                'maintenance_logs'          => $machine->maintenanceLogs->map(fn($l) => [
                    'id'              => $l->id,
                    'type'            => $l->type,
                    'performed_on'    => $l->performed_on->format('d M Y'),
                    'description'     => $l->description,
                    'technician'      => $l->performedBy?->name ?? $l->technician_name,
                    'cost'            => $l->cost,
                    'downtime_hours'  => $l->downtime_hours,
                    'parts_replaced'  => $l->parts_replaced ?? [],
                    'next_due_date'   => $l->next_due_date?->format('d M Y'),
                    'notes'           => $l->notes,
                ]),
            ],
        ]);
    }

    public function edit(Machine $machine)
    {
        return Inertia::render('Admin/Machines/CreateEdit', [
            'machine' => [
                'id'                        => $machine->id,
                'name'                      => $machine->name,
                'machine_code'              => $machine->machine_code,
                'section_id'                => $machine->section_id,
                'status'                    => $machine->status,
                'description'               => $machine->description,
                'manufacturer'              => $machine->manufacturer,
                'model'                     => $machine->model,
                'serial_number'             => $machine->serial_number,
                'purchased_on'              => $machine->purchased_on?->format('Y-m-d'),
                'warranty_expires_on'       => $machine->warranty_expires_on?->format('Y-m-d'),
                'asset_value'               => $machine->asset_value,
                'location'                  => $machine->location,
                'current_state'             => $machine->current_state,
                'last_maintenance_date'     => $machine->last_maintenance_date?->format('Y-m-d'),
                'next_maintenance_date'     => $machine->next_maintenance_date?->format('Y-m-d'),
                'maintenance_interval_days' => $machine->maintenance_interval_days,
                'rate_group_a'              => $machine->rate_group_a,
                'rate_group_b'              => $machine->rate_group_b,
                'rate_group_c'              => $machine->rate_group_c,
                'rate_group_student'        => $machine->rate_group_student,
                'rate_group_public'         => $machine->rate_group_public,
            ],
            'sections' => $this->sectionOptions(),
        ]);
    }

    public function update(Request $request, Machine $machine)
    {
        $validated = $this->validateMachine($request, $machine->id);
        $machine->update($validated);
        return redirect()->route('admin.machines.index')->with('success', 'Machine updated.');
    }

    public function destroy(Machine $machine)
    {
        $machine->delete();
        return redirect()->route('admin.machines.index')->with('success', 'Machine deleted.');
    }

    /**
     * Quick state change (running/idle/setup/etc) — used by shop terminals & dashboards.
     */
    public function changeState(Request $request, Machine $machine)
    {
        $validated = $request->validate([
            'state' => 'required|in:running,idle,setup,maintenance,breakdown,offline',
        ]);
        $machine->changeState($validated['state']);
        return back()->with('success', "Machine state changed to {$validated['state']}.");
    }

    /**
     * Record a maintenance event.
     */
    public function logMaintenance(Request $request, Machine $machine)
    {
        $validated = $request->validate([
            'type'            => 'required|in:preventive,corrective,breakdown,inspection,overhaul',
            'performed_on'    => 'required|date',
            'technician_name' => 'nullable|string|max:100',
            'description'     => 'required|string|max:1000',
            'cost'            => 'nullable|numeric|min:0',
            'downtime_hours'  => 'nullable|numeric|min:0',
            'next_due_date'   => 'nullable|date|after:performed_on',
            'parts_replaced'  => 'nullable|array',
            'notes'           => 'nullable|string|max:1000',
        ]);

        $validated['performed_by'] = auth()->id();
        MachineHealthService::recordMaintenance($machine, $validated);

        return back()->with('success', 'Maintenance event recorded.');
    }

    private function validateMachine(Request $request, ?int $id = null): array
    {
        return $request->validate([
            'name'                      => 'required|string|max:100',
            'machine_code'              => 'required|string|max:50|unique:machines,machine_code' . ($id ? ",{$id}" : ''),
            'section_id'                => 'required|exists:sections,id',
            'status'                    => 'required|in:operational,maintenance,offline',
            'current_state'             => 'nullable|in:running,idle,setup,maintenance,breakdown,offline',
            'description'               => 'nullable|string|max:500',
            'rate_group_a'              => 'nullable|numeric|min:0',
            'rate_group_b'              => 'nullable|numeric|min:0',
            'rate_group_c'              => 'nullable|numeric|min:0',
            'rate_group_student'        => 'nullable|numeric|min:0',
            'rate_group_public'         => 'nullable|numeric|min:0',
            // Asset
            'manufacturer'              => 'nullable|string|max:100',
            'model'                     => 'nullable|string|max:100',
            'serial_number'             => 'nullable|string|max:100',
            'purchased_on'              => 'nullable|date',
            'warranty_expires_on'       => 'nullable|date',
            'asset_value'               => 'nullable|numeric|min:0',
            'location'                  => 'nullable|string|max:100',
            // Maintenance
            'last_maintenance_date'     => 'nullable|date',
            'next_maintenance_date'     => 'nullable|date',
            'maintenance_interval_days' => 'nullable|integer|min:1',
        ]);
    }
}
