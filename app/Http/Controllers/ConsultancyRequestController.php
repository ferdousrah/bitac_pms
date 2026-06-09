<?php

namespace App\Http\Controllers;

use App\Mail\ConsultancyRequestDecision;
use App\Models\ConsultancyRequest;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Storage;
use Inertia\Inertia;

class ConsultancyRequestController extends Controller
{
    public function index(Request $request)
    {
        $q = ConsultancyRequest::query()
            ->with(['reviewer', 'assignedTo', 'completedBy'])
            ->latest('id');

        if ($status = $request->input('status')) {
            $q->where('status', $status);
        }
        if ($type = $request->input('type')) {
            $q->where('requester_type', $type);
        }
        if ($search = trim((string) $request->input('search'))) {
            $q->where(function ($q) use ($search) {
                $q->where('request_number', 'like', "%{$search}%")
                  ->orWhere('requester_name', 'like', "%{$search}%")
                  ->orWhere('subject', 'like', "%{$search}%")
                  ->orWhere('organization_name', 'like', "%{$search}%");
            });
        }

        $rows = $q->paginate(20)->withQueryString()->through(fn ($cr) => [
            'id'                  => $cr->id,
            'request_number'      => $cr->request_number,
            'requester_type'      => $cr->requester_type,
            'requester_name'      => $cr->requester_name,
            'organization_name'   => $cr->organization_name,
            'subject'             => $cr->subject,
            'status'              => $cr->status,
            'preferred_mode'      => $cr->preferred_mode,
            'created_at'          => $cr->created_at->format('d M Y'),
            'reviewed_at'         => $cr->reviewed_at?->format('d M Y'),
        ]);

        $stats = [
            'pending'   => ConsultancyRequest::where('status', 'pending')->count(),
            'accepted'  => ConsultancyRequest::where('status', 'accepted')->count(),
            'completed' => ConsultancyRequest::where('status', 'completed')->count(),
            'rejected'  => ConsultancyRequest::where('status', 'rejected')->count(),
            'total'     => ConsultancyRequest::count(),
        ];

        return Inertia::render('ConsultancyRequests/Index', [
            'requests' => $rows,
            'filters'  => $request->only(['status', 'type', 'search']),
            'stats'    => $stats,
        ]);
    }

    public function show(ConsultancyRequest $consultancyRequest)
    {
        $consultancyRequest->load(['reviewer', 'assignedTo', 'completedBy']);
        return Inertia::render('ConsultancyRequests/Show', [
            'cr'              => $this->serialize($consultancyRequest),
            'assignableUsers' => User::orderBy('name')->get(['id', 'name'])->all(),
        ]);
    }

    public function accept(Request $request, ConsultancyRequest $consultancyRequest)
    {
        abort_unless($consultancyRequest->status === 'pending', 422, 'Only pending requests can be accepted.');

        $validated = $request->validate([
            'response_notes' => 'nullable|string|max:2000',
            'assigned_to'    => 'nullable|exists:users,id',
        ]);

        $consultancyRequest->update([
            'status'         => 'accepted',
            'reviewed_by'    => auth()->id(),
            'reviewed_at'    => now(),
            'response_notes' => $validated['response_notes'] ?? null,
            'assigned_to'    => $validated['assigned_to'] ?? null,
        ]);

        $this->emailDecision($consultancyRequest->fresh(), 'accepted');

        return back()->with('success', "Request {$consultancyRequest->request_number} accepted.");
    }

    public function reject(Request $request, ConsultancyRequest $consultancyRequest)
    {
        abort_unless($consultancyRequest->status === 'pending', 422, 'Only pending requests can be rejected.');

        $validated = $request->validate([
            'rejection_reason' => 'required|string|max:2000',
        ]);

        $consultancyRequest->update([
            'status'           => 'rejected',
            'reviewed_by'      => auth()->id(),
            'reviewed_at'      => now(),
            'rejection_reason' => $validated['rejection_reason'],
        ]);

        $this->emailDecision($consultancyRequest->fresh(), 'rejected');

        return back()->with('success', "Request {$consultancyRequest->request_number} rejected.");
    }

    public function complete(Request $request, ConsultancyRequest $consultancyRequest)
    {
        abort_unless($consultancyRequest->status === 'accepted', 422, 'Only accepted requests can be marked completed.');

        $validated = $request->validate([
            'response_notes' => 'nullable|string|max:2000',
        ]);

        $consultancyRequest->update([
            'status'         => 'completed',
            'completed_at'   => now(),
            'completed_by'   => auth()->id(),
            'response_notes' => $validated['response_notes'] ?? $consultancyRequest->response_notes,
        ]);

        $this->emailDecision($consultancyRequest->fresh(), 'completed');

        return back()->with('success', "Request {$consultancyRequest->request_number} marked as completed.");
    }

    /** Annual report — comprehensive counts + monthly trend + breakdowns. */
    public function report(Request $request)
    {
        $year = (int) ($request->input('year') ?? now()->year);

        $base = ConsultancyRequest::year($year);

        $byStatus = (clone $base)->selectRaw('status, COUNT(*) as cnt')
            ->groupBy('status')->pluck('cnt', 'status')->all();

        $byType = (clone $base)->selectRaw('requester_type, COUNT(*) as cnt')
            ->groupBy('requester_type')->pluck('cnt', 'requester_type')->all();

        $byMode = (clone $base)->selectRaw('preferred_mode, COUNT(*) as cnt')
            ->groupBy('preferred_mode')->pluck('cnt', 'preferred_mode')->all();

        // Monthly trend — submitted vs completed counts per month
        $monthly = [];
        for ($m = 1; $m <= 12; $m++) {
            $submitted = (clone $base)->whereMonth('created_at', $m)->count();
            $completed = (clone $base)->where('status', 'completed')->whereMonth('completed_at', $m)->count();
            $monthly[] = [
                'month'     => $m,
                'label'     => date('M', mktime(0, 0, 0, $m, 1)),
                'submitted' => $submitted,
                'completed' => $completed,
            ];
        }

        // Top 10 most frequent subjects (rough keyword grouping by first 4 words)
        $topSubjects = (clone $base)->selectRaw('subject, COUNT(*) as cnt')
            ->groupBy('subject')
            ->orderByDesc('cnt')
            ->limit(10)
            ->get()
            ->toArray();

        $availableYears = ConsultancyRequest::selectRaw('YEAR(created_at) as y')
            ->distinct()->orderByDesc('y')->pluck('y')->all();
        if (empty($availableYears)) $availableYears = [now()->year];

        return Inertia::render('ConsultancyRequests/Report', [
            'year'           => $year,
            'availableYears' => $availableYears,
            'summary'        => [
                'total'      => array_sum($byStatus),
                'pending'    => $byStatus['pending']   ?? 0,
                'accepted'   => $byStatus['accepted']  ?? 0,
                'rejected'   => $byStatus['rejected']  ?? 0,
                'completed'  => $byStatus['completed'] ?? 0,
                'cancelled'  => $byStatus['cancelled'] ?? 0,
            ],
            'byType'         => $byType,
            'byMode'         => $byMode,
            'monthly'        => $monthly,
            'topSubjects'    => $topSubjects,
        ]);
    }

    public function exportReport(Request $request)
    {
        $year = (int) ($request->input('year') ?? now()->year);

        $rows = ConsultancyRequest::year($year)
            ->orderBy('id')
            ->get();

        $filename = "consultancy-requests-{$year}.csv";

        $headers = [
            'Content-Type'        => 'text/csv; charset=UTF-8',
            'Content-Disposition' => "attachment; filename=\"{$filename}\"",
        ];

        $callback = function () use ($rows) {
            $h = fopen('php://output', 'w');
            // BOM for Excel UTF-8 friendliness
            fwrite($h, "\xEF\xBB\xBF");
            fputcsv($h, [
                'Request #', 'Date', 'Type', 'Name', 'Email', 'Phone',
                'Organisation', 'Designation', 'Subject', 'Mode',
                'Status', 'Reviewed At', 'Completed At',
            ]);
            foreach ($rows as $r) {
                fputcsv($h, [
                    $r->request_number,
                    $r->created_at?->format('Y-m-d H:i'),
                    $r->requester_type,
                    $r->requester_name,
                    $r->requester_email,
                    $r->requester_phone,
                    $r->organization_name,
                    $r->designation_or_year,
                    $r->subject,
                    $r->preferred_mode,
                    $r->status,
                    $r->reviewed_at?->format('Y-m-d H:i'),
                    $r->completed_at?->format('Y-m-d H:i'),
                ]);
            }
            fclose($h);
        };

        return response()->stream($callback, 200, $headers);
    }

    public function downloadAttachment(ConsultancyRequest $consultancyRequest)
    {
        abort_unless($consultancyRequest->attachment_path, 404);
        return Storage::disk('public')->download(
            $consultancyRequest->attachment_path,
            $consultancyRequest->request_number . '-attachment.' .
                pathinfo($consultancyRequest->attachment_path, PATHINFO_EXTENSION),
        );
    }

    /** Best-effort email — swallows failures so workflow stays smooth. */
    private function emailDecision(ConsultancyRequest $cr, string $decision): void
    {
        try {
            Mail::to($cr->requester_email)->send(new ConsultancyRequestDecision($cr, $decision));
        } catch (\Throwable $e) {
            \Log::warning("Consultancy decision email failed ({$decision})", ['error' => $e->getMessage()]);
        }
    }

    private function serialize(ConsultancyRequest $cr): array
    {
        return [
            'id'                  => $cr->id,
            'request_number'      => $cr->request_number,
            'requester_type'      => $cr->requester_type,
            'requester_name'      => $cr->requester_name,
            'requester_email'     => $cr->requester_email,
            'requester_phone'     => $cr->requester_phone,
            'organization_name'   => $cr->organization_name,
            'designation_or_year' => $cr->designation_or_year,
            'subject'             => $cr->subject,
            'description'         => $cr->description,
            'preferred_mode'      => $cr->preferred_mode,
            'attachment_url'      => $cr->attachment_path ? Storage::disk('public')->url($cr->attachment_path) : null,
            'status'              => $cr->status,
            'created_at'          => $cr->created_at->format('d M Y, h:i A'),
            'reviewed_at'         => $cr->reviewed_at?->format('d M Y, h:i A'),
            'reviewed_by'         => $cr->reviewer?->name,
            'assigned_to'         => $cr->assignedTo ? ['id' => $cr->assignedTo->id, 'name' => $cr->assignedTo->name] : null,
            'response_notes'      => $cr->response_notes,
            'rejection_reason'    => $cr->rejection_reason,
            'completed_at'        => $cr->completed_at?->format('d M Y, h:i A'),
            'completed_by'        => $cr->completedBy?->name,
        ];
    }
}
