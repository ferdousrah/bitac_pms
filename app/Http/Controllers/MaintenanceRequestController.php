<?php

namespace App\Http\Controllers;

use App\Models\Machine;
use App\Models\MaintenanceRequest;
use App\Services\MachineHealthService;
use App\Services\NotifyService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Inertia\Inertia;

class MaintenanceRequestController extends Controller
{
    public function index(Request $request)
    {
        $user = $request->user();
        $canApprove = $user?->can('approve maintenance-requests') ?? false;
        $canPerform = $user?->can('perform maintenance') ?? false;

        $status = $request->input('status', 'open');

        // Default scope:
        //   - Approvers & technicians see everything (they need the full inbox).
        //   - Shop-floor only roles see their own section by default — they can
        //     widen via the "All sections" pill on the toolbar.
        $defaultSectionScope = (! $canApprove && ! $canPerform && $user?->section_id)
            ? (string) $user->section_id
            : '';
        $sectionFilter = $request->input('section_id', $defaultSectionScope);

        $q = MaintenanceRequest::with([
            'machine:id,name,machine_code,current_state',
            'section:id,name,code',
            'requester:id,name',
            'reviewer:id,name',
        ])->latest();

        if ($status === 'open') {
            $q->whereIn('status', ['pending', 'approved', 'in_progress']);
        } elseif ($status !== 'all') {
            $q->where('status', $status);
        }

        if ($machineId = $request->input('machine_id')) {
            $q->where('machine_id', $machineId);
        }
        if ($urgency = $request->input('urgency')) {
            $q->where('urgency', $urgency);
        }
        if ($sectionFilter !== '' && $sectionFilter !== 'all') {
            $q->where('section_id', (int) $sectionFilter);
        }

        return Inertia::render('Maintenance/Index', [
            'sections' => \App\Models\Section::active()->shops()->orderBy('display_order')->get(['id', 'name', 'code']),
            'requests' => $q->paginate(20)->withQueryString()->through(fn ($r) => [
                'id'                       => $r->id,
                'machine'                  => $r->machine ? [
                    'id' => $r->machine->id,
                    'name' => $r->machine->name,
                    'machine_code' => $r->machine->machine_code,
                ] : null,
                'section'                  => $r->section?->name,
                'requester'                => $r->requester?->name,
                'reported_problem'         => $r->reported_problem,
                'urgency'                  => $r->urgency,
                'urgency_color'            => $r->urgency_color,
                'status'                   => $r->status,
                'status_label'             => $r->status_label,
                'status_color'             => $r->status_color,
                'expected_downtime_hours'  => $r->expected_downtime_hours,
                'attachment_count'         => count($r->attachment_paths ?? []),
                'created_at'               => $r->created_at->format('d M Y, h:i A'),
            ]),
            'filters' => [
                'status'     => $status,
                'machine_id' => $request->input('machine_id', ''),
                'urgency'    => $request->input('urgency', ''),
                'section_id' => $sectionFilter,
            ],
            'counts' => [
                'pending'     => MaintenanceRequest::pending()->count(),
                'approved'    => MaintenanceRequest::approved()->count(),
                'in_progress' => MaintenanceRequest::inProgress()->count(),
                'completed'   => MaintenanceRequest::where('status', 'completed')->count(),
                'rejected'    => MaintenanceRequest::where('status', 'rejected')->count(),
            ],
            'can' => [
                'submit'  => $request->user()?->can('submit maintenance-requests'),
                'approve' => $request->user()?->can('approve maintenance-requests'),
                'perform' => $request->user()?->can('perform maintenance'),
            ],
        ]);
    }

    public function create(Request $request)
    {
        // Section pre-filter: come from ?section_id=N OR fall back to the user's own section.
        // Shop-floor users almost always submit for a machine in their own section, so this
        // keeps the picker short. Pass ?section_id=0 to force "all machines".
        $sectionId = $request->query('section_id', $request->user()?->section_id);
        $sectionId = $sectionId === '0' || $sectionId === 0 ? null : ($sectionId ? (int) $sectionId : null);

        $machines = Machine::with('section:id,name,code')
            ->when($sectionId, fn ($q) => $q->where('section_id', $sectionId))
            ->orderBy('machine_code')
            ->get(['id', 'name', 'machine_code', 'section_id', 'current_state']);

        // Also pass all sections so the form can offer "Show machines in another section".
        $sections = \App\Models\Section::active()->shops()->orderBy('display_order')
            ->get(['id', 'name', 'code']);

        $activeSection = $sectionId
            ? \App\Models\Section::find($sectionId)?->only(['id', 'name', 'code'])
            : null;

        return Inertia::render('Maintenance/Create', [
            'machines'      => $machines,
            'sections'      => $sections,
            'activeSection' => $activeSection,
            'preselectedId' => $request->query('machine_id') ? (int) $request->query('machine_id') : null,
        ]);
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'machine_id'              => 'required|exists:machines,id',
            'reported_problem'        => 'required|string|max:2000',
            'urgency'                 => 'required|in:urgent,normal,low',
            'expected_downtime_hours' => 'nullable|numeric|min:0|max:1000',
            'photos'                  => 'nullable|array|max:5',
            'photos.*'                => 'file|mimes:jpg,jpeg,png,webp|max:4096',
        ]);

        $paths = [];
        if ($request->hasFile('photos')) {
            foreach ($request->file('photos') as $photo) {
                $paths[] = $photo->store('maintenance-requests', 'public');
            }
        }

        $user = $request->user();
        $machine = Machine::find($validated['machine_id']);

        $req = MaintenanceRequest::create([
            'machine_id'              => $machine->id,
            'section_id'              => $machine->section_id ?? $user->section_id,
            'requested_by'            => $user->id,
            'reported_problem'        => $validated['reported_problem'],
            'urgency'                 => $validated['urgency'],
            'expected_downtime_hours' => $validated['expected_downtime_hours'] ?? null,
            'attachment_paths'        => $paths,
            'status'                  => 'pending',
        ]);

        // Notify approvers.
        NotifyService::toPermission(
            'approve maintenance-requests',
            'maintenance_request',
            'New maintenance request',
            "{$user->name} reported a problem on {$machine->machine_code} ({$machine->name})",
            "/maintenance-requests/{$req->id}",
            'fi-rr-wrench-simple',
            $validated['urgency'] === 'urgent' ? 'red' : 'amber',
        );

        return redirect()->route('maintenance-requests.show', $req)
            ->with('success', 'Maintenance request submitted. The team will review shortly.');
    }

    public function show(MaintenanceRequest $maintenanceRequest)
    {
        $maintenanceRequest->load([
            'machine.section', 'section', 'requester', 'reviewer',
            'starter', 'completer', 'canceller', 'maintenanceLog',
        ]);

        $r = $maintenanceRequest;
        return Inertia::render('Maintenance/Show', [
            'request' => [
                'id'                      => $r->id,
                'status'                  => $r->status,
                'status_label'            => $r->status_label,
                'status_color'            => $r->status_color,
                'urgency'                 => $r->urgency,
                'urgency_color'           => $r->urgency_color,
                'reported_problem'        => $r->reported_problem,
                'expected_downtime_hours' => $r->expected_downtime_hours,
                'attachment_urls'         => $r->attachmentUrls(),
                'created_at'              => $r->created_at->format('d M Y, h:i A'),
                'machine' => $r->machine ? [
                    'id'            => $r->machine->id,
                    'name'          => $r->machine->name,
                    'machine_code'  => $r->machine->machine_code,
                    'current_state' => $r->machine->current_state,
                    'section'       => $r->machine->section?->name,
                ] : null,
                'requester'        => $r->requester ? ['id' => $r->requester->id, 'name' => $r->requester->name] : null,
                'section'          => $r->section?->name,
                // Decision audit
                'reviewer'         => $r->reviewer?->name,
                'reviewed_at'      => $r->reviewed_at?->format('d M Y, h:i A'),
                'review_notes'     => $r->review_notes,
                'starter'          => $r->starter?->name,
                'started_at'       => $r->started_at?->format('d M Y, h:i A'),
                'completer'        => $r->completer?->name,
                'completed_at'     => $r->completed_at?->format('d M Y, h:i A'),
                'canceller'        => $r->canceller?->name,
                'cancelled_at'     => $r->cancelled_at?->format('d M Y, h:i A'),
                'cancellation_reason' => $r->cancellation_reason,
                'maintenance_log_id' => $r->maintenance_log_id,
            ],
            'can' => [
                'approve' => auth()->user()?->can('approve maintenance-requests'),
                'perform' => auth()->user()?->can('perform maintenance'),
                'cancel'  => auth()->id() === $r->requested_by || auth()->user()?->can('approve maintenance-requests'),
            ],
        ]);
    }

    public function approve(Request $request, MaintenanceRequest $maintenanceRequest)
    {
        abort_unless($maintenanceRequest->status === 'pending', 422, 'Only pending requests can be approved.');

        $validated = $request->validate(['review_notes' => 'nullable|string|max:1000']);

        $maintenanceRequest->update([
            'status'       => 'approved',
            'reviewed_by'  => auth()->id(),
            'reviewed_at'  => now(),
            'review_notes' => $validated['review_notes'] ?? null,
        ]);

        // Notify requester + technicians.
        $body = "Request #{$maintenanceRequest->id} for {$maintenanceRequest->machine?->machine_code} is approved.";
        NotifyService::send(
            [$maintenanceRequest->requested_by], 'maintenance_approved',
            'Your maintenance request was approved', $body,
            "/maintenance-requests/{$maintenanceRequest->id}", 'fi-rr-check-circle', 'green',
        );
        NotifyService::toPermission(
            'perform maintenance', 'maintenance_ready',
            'Maintenance ready to start', $body,
            "/maintenance-requests/{$maintenanceRequest->id}", 'fi-rr-tools', 'blue',
        );

        return back()->with('success', 'Request approved. Technicians have been notified.');
    }

    public function reject(Request $request, MaintenanceRequest $maintenanceRequest)
    {
        abort_unless($maintenanceRequest->status === 'pending', 422, 'Only pending requests can be rejected.');

        $validated = $request->validate(['review_notes' => 'required|string|max:1000']);

        $maintenanceRequest->update([
            'status'       => 'rejected',
            'reviewed_by'  => auth()->id(),
            'reviewed_at'  => now(),
            'review_notes' => $validated['review_notes'],
        ]);

        NotifyService::send(
            [$maintenanceRequest->requested_by], 'maintenance_rejected',
            'Your maintenance request was rejected',
            "Request #{$maintenanceRequest->id}: {$validated['review_notes']}",
            "/maintenance-requests/{$maintenanceRequest->id}", 'fi-rr-cross-circle', 'rose',
        );

        return back()->with('success', 'Request rejected. The requester has been notified.');
    }

    public function start(Request $request, MaintenanceRequest $maintenanceRequest)
    {
        abort_unless($maintenanceRequest->status === 'approved', 422, 'Only approved requests can be started.');

        $machine = $maintenanceRequest->machine;
        $maintenanceRequest->update([
            'status'                => 'in_progress',
            'started_at'            => now(),
            'started_by'            => auth()->id(),
            'machine_state_before'  => $machine?->current_state,
        ]);

        // Flip machine to maintenance state — downtime starts ticking now.
        if ($machine) {
            $machine->update([
                'current_state'    => 'maintenance',
                'state_changed_at' => now(),
            ]);
        }

        return back()->with('success', 'Work started. Machine flipped to maintenance state.');
    }

    public function complete(Request $request, MaintenanceRequest $maintenanceRequest)
    {
        abort_unless($maintenanceRequest->status === 'in_progress', 422, 'Only in-progress requests can be completed.');

        $validated = $request->validate([
            'type'            => 'required|in:preventive,corrective,breakdown,inspection,overhaul',
            'description'     => 'required|string|max:2000',
            'cost'            => 'nullable|numeric|min:0',
            'downtime_hours'  => 'nullable|numeric|min:0',
            'parts_replaced'  => 'nullable|array',
            'parts_replaced.*'=> 'string|max:120',
            'next_due_date'   => 'nullable|date|after:today',
            'notes'           => 'nullable|string|max:1000',
        ]);

        $log = DB::transaction(function () use ($maintenanceRequest, $validated) {
            $log = MachineHealthService::recordMaintenance($maintenanceRequest->machine, [
                'type'            => $validated['type'],
                'performed_on'    => now()->toDateString(),
                'technician_name' => auth()->user()?->name,
                'performed_by'    => auth()->id(),
                'description'     => $validated['description'],
                'cost'            => $validated['cost'] ?? 0,
                'downtime_hours'  => $validated['downtime_hours'] ?? null,
                'parts_replaced'  => $validated['parts_replaced'] ?? [],
                'next_due_date'   => $validated['next_due_date'] ?? null,
                'notes'           => $validated['notes'] ?? null,
            ]);

            $maintenanceRequest->update([
                'status'             => 'completed',
                'completed_at'       => now(),
                'completed_by'       => auth()->id(),
                'maintenance_log_id' => $log->id,
            ]);

            return $log;
        });

        NotifyService::send(
            [$maintenanceRequest->requested_by], 'maintenance_completed',
            'Maintenance completed',
            "Request #{$maintenanceRequest->id} for {$maintenanceRequest->machine?->machine_code} has been completed.",
            "/maintenance-requests/{$maintenanceRequest->id}", 'fi-rr-check-circle', 'green',
        );

        return back()->with('success', 'Maintenance completed and logged. Machine returned to idle.');
    }

    public function cancel(Request $request, MaintenanceRequest $maintenanceRequest)
    {
        // Requester OR approver can cancel — but not after completion.
        $isOwner    = auth()->id() === $maintenanceRequest->requested_by;
        $canApprove = auth()->user()?->can('approve maintenance-requests') ?? false;
        abort_unless($isOwner || $canApprove, 403);
        abort_if(in_array($maintenanceRequest->status, ['completed', 'cancelled']), 422,
            'Cannot cancel a completed or already-cancelled request.');

        $validated = $request->validate(['cancellation_reason' => 'required|string|max:1000']);

        // If we'd already flipped the machine to maintenance, restore it.
        if ($maintenanceRequest->status === 'in_progress' && $maintenanceRequest->machine_state_before) {
            $maintenanceRequest->machine?->update([
                'current_state'    => $maintenanceRequest->machine_state_before,
                'state_changed_at' => now(),
            ]);
        }

        $maintenanceRequest->update([
            'status'              => 'cancelled',
            'cancelled_at'        => now(),
            'cancelled_by'        => auth()->id(),
            'cancellation_reason' => $validated['cancellation_reason'],
        ]);

        return back()->with('success', 'Request cancelled.');
    }
}
