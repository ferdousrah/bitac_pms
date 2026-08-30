<?php

namespace App\Http\Controllers\Ied;

use App\Http\Controllers\Controller;
use App\Mail\ComplaintResponseMail;
use App\Models\ComplaintDecisionMaker;
use App\Models\ComplaintDiscussion;
use App\Models\CustomerComplaint;
use App\Models\GatePass;
use App\Models\Ncr;
use App\Models\User;
use App\Models\WorkOrderSection;
use App\Services\NotifyService;
use App\Services\ReworkOrderService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;
use Inertia\Inertia;

/**
 * IED-side inbox for customer complaints.
 * Each customer-filed complaint lands here; an IED officer reads, responds,
 * and tracks status (open → in_review → resolved → closed). The customer
 * sees responses live on their /customer/complaints/{id} page.
 */
class ComplaintController extends Controller
{
    public function index(Request $request)
    {
        $query = CustomerComplaint::with(['customer', 'workOrder', 'respondedBy']);

        if ($search = $request->input('search')) {
            $query->where(function ($q) use ($search) {
                $q->where('reference_number', 'like', "%{$search}%")
                  ->orWhere('subject', 'like', "%{$search}%")
                  ->orWhereHas('customer', fn($c) => $c->where('name', 'like', "%{$search}%"));
            });
        }
        if ($status = $request->input('status'))   $query->where('status', $status);
        if ($category = $request->input('category')) $query->where('category', $category);

        $complaints = $query->latest('id')->paginate(15)->withQueryString()
            ->through(fn($c) => [
                'id'               => $c->id,
                'reference_number' => $c->reference_number,
                'subject'          => $c->subject,
                'category'         => $c->category,
                'status'           => $c->status,
                'customer'         => $c->customer ? ['id' => $c->customer->id, 'name' => $c->customer->name] : null,
                'work_order'       => $c->workOrder ? [
                    'id'         => $c->workOrder->id,
                    'wo_number'  => $c->workOrder->wo_number,
                    'job_number' => $c->workOrder->job_number,
                ] : null,
                'created_at'       => $c->created_at->format('d M Y, h:i A'),
                'responded_at'     => $c->responded_at?->format('d M Y'),
                'responded_by'     => $c->respondedBy?->name,
            ]);

        $stats = [
            'open'      => CustomerComplaint::where('status', 'open')->count(),
            'in_review' => CustomerComplaint::where('status', 'in_review')->count(),
            'resolved'  => CustomerComplaint::where('status', 'resolved')->count(),
            'closed'    => CustomerComplaint::where('status', 'closed')->count(),
            'total'     => CustomerComplaint::count(),
        ];

        return Inertia::render('Ied/Complaints/Index', [
            'complaints' => $complaints,
            'stats'      => $stats,
            'filters'    => [
                'search'   => $request->input('search', ''),
                'status'   => $request->input('status', ''),
                'category' => $request->input('category', ''),
            ],
        ]);
    }

    public function show(CustomerComplaint $complaint)
    {
        $complaint->load([
            'customer', 'workOrder.product', 'workOrder.sections.section', 'respondedBy',
            'acceptedBy', 'ncr.reworkOrders.targetSection', 'gatePass',
            'decisionMakers.user:id,name,email',
            'decisionMakers.addedBy:id,name',
            'discussions.user:id,name',
        ]);

        // Candidate sections for rework — only sections that are part of this WO's routing
        $candidateSections = $complaint->workOrder?->sections
            ->filter(fn($s) => $s->section && $s->section->type === 'production_shop')
            ->sortBy('sequence')
            ->map(fn($s) => [
                'id'       => $s->section->id,
                'name'     => $s->section->name,
                'code'     => $s->section->code,
                'sequence' => $s->sequence,
                'status'   => $s->status,
            ])->values() ?? collect();

        // Total rework cost rollup (hours × rate is too much for now — just hours).
        $reworkHours = 0;
        if ($complaint->ncr) {
            $reworkHours = (float) (\App\Models\OperationStep::query()
                ->whereHas('operationSheet', fn($q) => $q->where('work_order_id', $complaint->workOrder?->id))
                ->whereNotNull('completed_at')
                ->where('completed_at', '>=', $complaint->accepted_at ?? $complaint->created_at)
                ->sum('actual_hours') ?? 0);
        }

        return Inertia::render('Ied/Complaints/Show', [
            'complaint' => [
                'id'               => $complaint->id,
                'reference_number' => $complaint->reference_number,
                'subject'          => $complaint->subject,
                'category'         => $complaint->category,
                'message'          => $complaint->message,
                'affected_qty'     => $complaint->affected_qty,
                'total_qty'        => $complaint->total_qty,
                'status'           => $complaint->status,
                'customer'         => $complaint->customer ? [
                    'id'    => $complaint->customer->id,
                    'name'  => $complaint->customer->name,
                    'email' => $complaint->customer->email,
                    'phone' => $complaint->customer->phone ?? null,
                ] : null,
                'work_order'       => $complaint->workOrder ? [
                    'id'         => $complaint->workOrder->id,
                    'wo_number'  => $complaint->workOrder->wo_number,
                    'job_number' => $complaint->workOrder->job_number,
                    'product'    => $complaint->workOrder->product->name ?? null,
                    'status'     => $complaint->workOrder->status,
                ] : null,
                'response'         => $complaint->response,
                'responded_by'     => $complaint->respondedBy?->name,
                'responded_at'     => $complaint->responded_at?->format('d M Y, h:i A'),
                'created_at'       => $complaint->created_at->format('d M Y, h:i A'),
                'accepted_at'      => $complaint->accepted_at?->format('d M Y, h:i A'),
                'accepted_by'      => $complaint->acceptedBy?->name,
                'ncr'              => $complaint->ncr ? [
                    'id'         => $complaint->ncr->id,
                    'ncr_number' => $complaint->ncr->ncr_number,
                    'status'     => $complaint->ncr->status,
                    'reworks'    => $complaint->ncr->reworkOrders->map(fn($r) => [
                        'rework_number' => $r->rework_wo_number,
                        'status'        => $r->status,
                        'section'       => $r->targetSection ? [
                            'name' => $r->targetSection->name,
                            'code' => $r->targetSection->code,
                        ] : null,
                        'notes'         => $r->notes,
                    ])->values(),
                ] : null,
                'gate_pass'        => $complaint->gatePass ? [
                    'id'         => $complaint->gatePass->id,
                    'pass_no'    => $complaint->gatePass->pass_no,
                    'direction'  => $complaint->gatePass->direction,
                    'status'     => $complaint->gatePass->status,
                    'pass_date'  => $complaint->gatePass->pass_date?->format('d M Y'),
                ] : null,
                'rework_hours'     => round($reworkHours, 2),
                'decision_emailed_at' => $complaint->decision_emailed_at?->format('d M Y, h:i A'),
                'decision_makers'  => $complaint->decisionMakers->map(fn ($dm) => [
                    'id'         => $dm->id,
                    'user_id'    => $dm->user_id,
                    'name'       => $dm->user?->name,
                    'email'      => $dm->user?->email,
                    'added_by'   => $dm->addedBy?->name,
                    'added_at'   => $dm->added_at?->format('d M Y, h:i A'),
                ])->values(),
                'discussions'      => $complaint->discussions->map(fn ($d) => [
                    'id'         => $d->id,
                    'user_id'    => $d->user_id,
                    'user_name'  => $d->user?->name,
                    'message'    => $d->message,
                    'created_at' => $d->created_at?->format('d M Y, h:i A'),
                    'is_mine'    => $d->user_id === auth()->id(),
                ])->values(),
            ],
            'candidateSections'  => $candidateSections,
            'assignableUsers'    => User::orderBy('name')->get(['id', 'name', 'email']),
            'currentUserId'      => auth()->id(),
        ]);
    }

    /**
     * Add a decision maker to a complaint. Notifies the added user.
     */
    public function addDecisionMaker(Request $request, CustomerComplaint $complaint)
    {
        $validated = $request->validate([
            'user_id' => 'required|integer|exists:users,id',
        ]);

        $exists = ComplaintDecisionMaker::where('complaint_id', $complaint->id)
            ->where('user_id', $validated['user_id'])->exists();
        if ($exists) {
            return back()->with('error', 'That person is already on the panel.');
        }

        ComplaintDecisionMaker::create([
            'complaint_id' => $complaint->id,
            'user_id'      => $validated['user_id'],
            'added_by'     => auth()->id(),
            'added_at'     => now(),
        ]);

        NotifyService::send(
            [$validated['user_id']],
            'complaint_panel',
            'Added to a feedback panel',
            "You've been added as a decision maker on feedback/compliment {$complaint->reference_number}",
            "/ied/complaints/{$complaint->id}",
            'fi-rr-users',
            'indigo',
        );

        return back()->with('success', 'Decision maker added and notified.');
    }

    public function removeDecisionMaker(CustomerComplaint $complaint, ComplaintDecisionMaker $decisionMaker)
    {
        abort_unless($decisionMaker->complaint_id === $complaint->id, 404);
        $decisionMaker->delete();
        return back()->with('success', 'Removed from panel.');
    }

    /**
     * Post a message into the complaint's deliberation stream. Notifies other
     * decision makers + the IED reviewer.
     */
    public function postMessage(Request $request, CustomerComplaint $complaint)
    {
        $validated = $request->validate([
            'message' => 'required|string|max:4000',
        ]);

        $msg = ComplaintDiscussion::create([
            'complaint_id' => $complaint->id,
            'user_id'      => auth()->id(),
            'message'      => $validated['message'],
        ]);

        // Notify other panel members (not the author).
        $recipients = $complaint->decisionMakers()->where('user_id', '!=', auth()->id())->pluck('user_id')->toArray();
        if (! empty($recipients)) {
            NotifyService::send(
                $recipients,
                'complaint_message',
                'New message on feedback panel',
                "New opinion shared on {$complaint->reference_number}",
                "/ied/complaints/{$complaint->id}",
                'fi-rr-comment-alt',
                'blue',
            );
        }

        return back();
    }

    /**
     * Fetch new messages since a given timestamp — used by the frontend for
     * lightweight polling so the discussion stream stays live.
     */
    public function pollMessages(Request $request, CustomerComplaint $complaint)
    {
        $since = $request->query('since');
        $q = $complaint->discussions()->with('user:id,name');
        if ($since) $q->where('created_at', '>', $since);
        $messages = $q->orderBy('created_at')->get()->map(fn ($d) => [
            'id'         => $d->id,
            'user_id'    => $d->user_id,
            'user_name'  => $d->user?->name,
            'message'    => $d->message,
            'created_at' => $d->created_at?->format('d M Y, h:i A'),
            'is_mine'    => $d->user_id === auth()->id(),
        ]);
        return response()->json([
            'messages' => $messages,
            'now'      => now()->toIso8601String(),
        ]);
    }

    /**
     * Generate a draft final decision using Gemini, summarising the complaint
     * + discussion stream into a polite formal response to the customer.
     * Returns plain text — the IED reviewer can edit it before confirming.
     */
    public function generateDraft(CustomerComplaint $complaint)
    {
        $complaint->load(['customer', 'workOrder', 'discussions.user']);
        $apiKey = config('services.gemini.api_key');
        $model  = config('services.gemini.model', 'gemini-2.0-flash');

        $discussion = $complaint->discussions
            ->map(fn ($d) => '[' . ($d->user?->name ?? 'Unknown') . '] ' . $d->message)
            ->implode("\n");

        $contextLines = [];
        $contextLines[] = "Customer: " . ($complaint->customer?->name ?? '—');
        $contextLines[] = "Reference: {$complaint->reference_number}";
        $contextLines[] = "Subject: {$complaint->subject}";
        if ($complaint->category)    $contextLines[] = "Category: {$complaint->category}";
        if ($complaint->workOrder)   $contextLines[] = "Work order: {$complaint->workOrder->wo_number}";
        if ($complaint->affected_qty) $contextLines[] = "Affected qty: {$complaint->affected_qty} of {$complaint->total_qty}";

        $prompt = "You are an IED officer at BITAC (Bangladesh Industrial Technical Assistance Centre)."
            . " A customer has filed a complaint. Internal decision makers have discussed the matter."
            . " Based on the complaint details and the panel's discussion below, write a polite, professional final response"
            . " to the customer in clear English. Be specific about what BITAC has decided to do. Keep it concise (3–5 short paragraphs)."
            . " Do NOT mention the internal discussion explicitly — just present BITAC's decision."
            . "\n\n=== COMPLAINT DETAILS ===\n" . implode("\n", $contextLines)
            . "\n\nCustomer's message:\n{$complaint->message}"
            . "\n\n=== PANEL DISCUSSION ===\n"
            . ($discussion !== '' ? $discussion : '(no internal discussion recorded yet — base the draft on the complaint alone.)')
            . "\n\n=== DRAFT RESPONSE ===";

        // Default template fallback if Gemini isn't configured / fails.
        $fallback = "Dear {$complaint->customer?->name},\n\n"
            . "Thank you for bringing complaint {$complaint->reference_number} to our attention. "
            . "After reviewing the matter internally, BITAC has decided to take appropriate action. "
            . "Our team will follow up shortly with the next steps.\n\nSincerely,\nBITAC IED Team";

        if (empty($apiKey)) return response()->json(['draft' => $fallback, 'source' => 'fallback']);

        try {
            $resp = Http::timeout(30)->post(
                "https://generativelanguage.googleapis.com/v1beta/models/{$model}:generateContent?key={$apiKey}",
                [
                    'contents' => [['parts' => [['text' => $prompt]]]],
                    'generationConfig' => ['temperature' => 0.7, 'maxOutputTokens' => 800],
                ],
            );
            if (! $resp->successful()) {
                Log::warning('Gemini draft failed', ['status' => $resp->status(), 'body' => $resp->body()]);
                return response()->json(['draft' => $fallback, 'source' => 'fallback']);
            }
            $text = data_get($resp->json(), 'candidates.0.content.parts.0.text', $fallback);
            return response()->json(['draft' => trim($text), 'source' => 'ai']);
        } catch (\Throwable $e) {
            Log::warning('Gemini draft exception', ['error' => $e->getMessage()]);
            return response()->json(['draft' => $fallback, 'source' => 'fallback']);
        }
    }

    /**
     * IED officer responds to a complaint. Writes the response, optionally
     * changes status, stamps responded_by + responded_at, notifies customer.
     */
    public function respond(Request $request, CustomerComplaint $complaint)
    {
        $validated = $request->validate([
            'response' => 'required|string|max:4000',
            // A response is sent only when the case is finalised — either
            // resolved (issue fixed) or closed (no further action / rejected).
            // Use the separate /status endpoint for interim triage like 'in_review'.
            'status'   => 'required|in:resolved,closed',
        ]);

        $complaint->update([
            'response'     => $validated['response'],
            'status'       => $validated['status'],
            'responded_by' => auth()->id(),
            'responded_at' => now(),
        ]);

        // Optional customer notification (best-effort — only if Customer model
        // supports notifications, otherwise silently skipped).
        try {
            $customer = $complaint->customer;
            if ($customer && method_exists($customer, 'notifications')) {
                $customer->notifications()->create([
                    'type'    => 'complaint_response',
                    'title'   => "BITAC has responded to your feedback",
                    'body'    => "Your submission {$complaint->reference_number} has a new response. Status: " . str_replace('_', ' ', $complaint->status) . ".",
                    'link'    => "/customer/complaints/{$complaint->id}",
                    'icon'    => 'fi-rr-comment-check',
                    'color'   => 'green',
                ]);
            }
        } catch (\Throwable $e) {
            // Don't block the response save on notification failure.
        }

        // Send the decision by email via Resend. Failure shouldn't roll back the response.
        $emailFlash = '';
        try {
            if ($complaint->customer?->email) {
                Mail::to($complaint->customer->email)->send(new ComplaintResponseMail($complaint->fresh(['customer'])));
                $complaint->update(['decision_emailed_at' => now()]);
                $emailFlash = ' Email sent to ' . $complaint->customer->email . '.';
            }
        } catch (\Throwable $e) {
            Log::warning('Complaint response email failed', ['complaint_id' => $complaint->id, 'error' => $e->getMessage()]);
            $emailFlash = ' (Email delivery failed — check RESEND_API_KEY / sender verification.)';
        }

        return back()->with('success', "Response sent to {$complaint->customer?->name}. Submission marked "
            . str_replace('_', ' ', $complaint->status) . '.' . $emailFlash);
    }

    /**
     * Approve a customer complaint for rework. This:
     *   1. Auto-raises an NCR against the linked work order
     *   2. Creates rework orders for the chosen section(s) — reusing
     *      ReworkOrderService so the section queue + WOS routing all
     *      "just work" the same way as in-house NCR rework
     *   3. Auto-issues a Gate Pass In so the customer can return the
     *      defective sample(s)
     *   4. Flips complaint status to accepted_for_rework with audit stamps
     *   5. Notifies the customer
     */
    public function approveRework(Request $request, CustomerComplaint $complaint, ReworkOrderService $reworkService)
    {
        if (!$complaint->workOrder) {
            return back()->with('error', 'This submission is not linked to a work order — cannot route to rework.');
        }
        if ($complaint->linked_ncr_id) {
            return back()->with('error', 'This submission has already been approved for rework.');
        }

        $validated = $request->validate([
            'target_section_ids'   => 'required|array|min:1',
            'target_section_ids.*' => 'integer|exists:sections,id',
            'defect_summary'       => 'required|string|max:1000',
            'notes'                => 'nullable|array',
            'notes.*'              => 'nullable|string|max:1000',
        ]);

        $wo = $complaint->workOrder;

        $affectedQty = $complaint->affected_qty;
        $totalQty    = $complaint->total_qty ?? (int) $wo->quantity;
        $partial     = $affectedQty !== null && $affectedQty < $totalQty;

        DB::transaction(function () use ($complaint, $wo, $validated, $reworkService, $affectedQty, $totalQty, $partial) {
            // (1) NCR — carries the affected qty so production knows the sub-batch size
            $ncrNo = 'NCR-' . str_pad((int) (Ncr::max('id') + 1), 5, '0', STR_PAD_LEFT);
            $qtySuffix = $partial ? " ({$affectedQty} of {$totalQty} units affected)" : '';
            $ncr = Ncr::create([
                'qc_inspection_id' => null,
                'work_order_id'    => $wo->id,
                'ncr_number'       => $ncrNo,
                'defect_type'      => '[' . $complaint->reference_number . '] ' . $validated['defect_summary'] . $qtySuffix,
                'affected_qty'     => $affectedQty,
                'status'           => 'open',
            ]);

            // (2) Rework orders + WOS routing (reused service)
            $reworkService->createForNcr(
                $ncr,
                $validated['target_section_ids'],
                $validated['notes'] ?? [],
                auth()->id(),
            );

            // (3) Gate Pass In for the defective sample return
            $gatePass = null;
            $rfqId = $wo->rfq_id ?? $wo->quotation?->rfq_id;
            if ($rfqId) {
                $qtyLine = $partial
                    ? "Defective Qty: {$affectedQty} of {$totalQty}"
                    : "Defective Qty: {$totalQty} (full lot)";
                $gatePass = GatePass::create([
                    'rfq_id'              => $rfqId,
                    'pass_no'             => GatePass::generatePassNo('in'),
                    'direction'           => 'in',
                    'customer_rep_name'   => $complaint->customer?->contact_person ?? $complaint->customer?->name ?? 'Customer Representative',
                    'customer_rep_phone'  => $complaint->customer?->phone ?? null,
                    'pass_date'           => now(),
                    'notes'               => "Auto-issued for complaint {$complaint->reference_number} — defective sample return.\n"
                                            . $qtyLine . "\n\nDefect: " . $validated['defect_summary'],
                    'issued_by'           => auth()->id(),
                    'issued_at'           => now(),
                    'status'              => 'issued',
                ]);
            }

            // (4) Update complaint
            $complaint->update([
                'status'              => 'accepted_for_rework',
                'linked_ncr_id'       => $ncr->id,
                'linked_gate_pass_id' => $gatePass?->id,
                'accepted_at'         => now(),
                'accepted_by'         => auth()->id(),
            ]);
        });

        // (5) Customer notification (best-effort)
        try {
            $customer = $complaint->customer;
            if ($customer && method_exists($customer, 'notifications')) {
                $customer->notifications()->create([
                    'type'  => 'complaint_accepted',
                    'title' => 'Feedback accepted for rework',
                    'body'  => "Your submission {$complaint->reference_number} has been approved for rework. We'll keep you updated.",
                    'link'  => "/customer/complaints/{$complaint->id}",
                    'icon'  => 'fi-rr-refresh',
                    'color' => 'blue',
                ]);
            }
        } catch (\Throwable $e) {
            // skip silently
        }

        return back()->with('success', 'Submission approved for rework. NCR raised, sections notified, Gate Pass In issued.');
    }

    /** Change just the status (without sending a response — for triage). */
    public function updateStatus(Request $request, CustomerComplaint $complaint)
    {
        $validated = $request->validate([
            'status' => 'required|in:open,in_review,resolved,closed',
        ]);
        $complaint->update(['status' => $validated['status']]);
        return back()->with('success', 'Status updated.');
    }
}
