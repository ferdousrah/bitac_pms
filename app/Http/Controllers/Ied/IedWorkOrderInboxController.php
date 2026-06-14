<?php

namespace App\Http\Controllers\Ied;

use App\Http\Controllers\Controller;
use App\Models\WorkOrder;
use App\Services\CustomerNotifyService;
use App\Services\NotifyService;
use Illuminate\Http\Request;
use Inertia\Inertia;

/**
 * IED's Work Order acceptance inbox.
 *
 * Every Work Order (customer-issued or staff-converted) lands here first as
 * `ied_pending`. IED reviews the PO/authorisation file + delivery date, then
 * either accepts and forwards to PCD or rejects. Acceptance flips the WO to
 * `pcd_pending` and stamps `pcd_handoff_at/by`.
 */
class IedWorkOrderInboxController extends Controller
{
    public function index(Request $request)
    {
        $query = WorkOrder::with(['customer', 'rfq', 'quotation', 'createdBy'])
            ->where('status', 'ied_pending')
            ->latest();

        if ($search = $request->input('search')) {
            $query->where(function ($q) use ($search) {
                $q->where('wo_number', 'like', "%{$search}%")
                  ->orWhere('job_number', 'like', "%{$search}%")
                  ->orWhere('customer_po_no', 'like', "%{$search}%")
                  ->orWhereHas('customer', fn($c) => $c->where('name', 'like', "%{$search}%"));
            });
        }

        $workOrders = $query->paginate(15)->withQueryString()
            ->through(fn ($wo) => [
                'id'              => $wo->id,
                'wo_number'       => $wo->wo_number,
                'job_number'      => $wo->job_number,
                'customer_name'   => $wo->customer?->name ?? '—',
                'rfq_id'          => $wo->rfq_id,
                'quotation_id'    => $wo->quotation_id,
                'customer_po_no'  => $wo->customer_po_no,
                'quantity'        => (float) $wo->quantity,
                'priority'        => $wo->priority,
                'due_date'        => $wo->due_date?->format('d M Y'),
                'notes'           => $wo->notes,
                'created_by'      => $wo->createdBy?->name,
                'source'          => $wo->createdBy ? 'staff' : 'customer_portal',
                'created_at'      => $wo->created_at->format('d M Y, H:i'),
            ]);

        return Inertia::render('Ied/WorkOrders/Index', [
            'workOrders' => $workOrders,
            'filters'    => ['search' => $request->input('search', '')],
        ]);
    }

    public function show(WorkOrder $workOrder)
    {
        $workOrder->load([
            'customer', 'rfq.items.product', 'quotation', 'createdBy',
            'items.product', 'files',
        ]);

        return Inertia::render('Ied/WorkOrders/Show', [
            'workOrder' => [
                'id'             => $workOrder->id,
                'wo_number'      => $workOrder->wo_number,
                'job_number'     => $workOrder->job_number,
                'status'         => $workOrder->status,
                'priority'       => $workOrder->priority,
                'quantity'       => (float) $workOrder->quantity,
                'due_date'       => $workOrder->due_date?->format('Y-m-d'),
                'due_date_label' => $workOrder->due_date?->format('d M Y'),
                'notes'          => $workOrder->notes,
                'customer_po_no' => $workOrder->customer_po_no,
                'created_at'     => $workOrder->created_at->format('d M Y, H:i'),
                'source'         => $workOrder->createdBy ? 'staff' : 'customer_portal',
                'customer'       => $workOrder->customer ? [
                    'id'   => $workOrder->customer->id,
                    'name' => $workOrder->customer->name,
                    'email'=> $workOrder->customer->email,
                ] : null,
                'rfq_id'         => $workOrder->rfq_id,
                'quotation_id'   => $workOrder->quotation_id,
                'created_by'     => $workOrder->createdBy?->name,
                'items'          => $workOrder->items->map(fn ($i) => [
                    'id'          => $i->id,
                    'job_number'  => $i->job_number,
                    'description' => $i->description,
                    'product'     => $i->product?->name,
                    'quantity'    => (float) $i->quantity,
                    'unit'        => $i->unit,
                    'notes'       => $i->notes,
                ])->values(),
                'files'          => $workOrder->files->map(fn ($f) => [
                    'id'            => $f->id,
                    'kind'          => $f->kind,
                    // Preferred display name — falls back to the original
                    // file name for legacy rows that pre-date the title col.
                    'title'         => $f->title ?: ($f->kind === 'customer_po' ? 'Customer Work Order' : $f->original_name),
                    'original_name' => $f->original_name,
                    // Streamed via controller so the PDF popup's base64 mode
                    // bypasses IDM/FDM intercept.
                    'url'           => $f->stored_path ? route('ied.work-orders.files.show', $f) : null,
                    'mime_type'     => $f->mime_type,
                ])->values(),
            ],
        ]);
    }

    /**
     * IED accepts the WO and hands it off to PCD. Status flips to
     * `pcd_pending`, handoff timestamps are stamped, PCD is notified, and
     * the customer gets a "your order has been accepted" alert.
     */
    public function accept(Request $request, WorkOrder $workOrder)
    {
        abort_unless($workOrder->status === 'ied_pending', 422,
            'Only IED-pending work orders can be forwarded to PCD.');

        $validated = $request->validate([
            'note'             => 'nullable|string|max:1000',
            'item_notes'       => 'nullable|array',
            'item_notes.*'     => 'nullable|string|max:1000',
        ]);

        $note = trim((string) ($validated['note'] ?? ''));

        // Append the overall handoff note to the WO's notes (tagged so PCD can
        // spot it at a glance) — preserves any customer-supplied notes already
        // there.
        $updatedNotes = $workOrder->notes;
        if ($note !== '') {
            $stamp = '[IED → PCD · ' . (auth()->user()?->name ?? 'IED') . ', ' . now()->format('d M Y') . '] ' . $note;
            $updatedNotes = trim(($updatedNotes ? $updatedNotes . "\n\n" : '') . $stamp);
        }

        // Persist per-item IED notes on the work_order_items rows.
        $itemNotes = $validated['item_notes'] ?? [];
        $itemNoteCount = 0;
        foreach ($itemNotes as $itemId => $itemNote) {
            $itemNote = trim((string) $itemNote);
            if ($itemNote === '') continue;
            $workOrder->items()->where('id', (int) $itemId)->update(['ied_note' => $itemNote]);
            $itemNoteCount++;
        }

        // Job numbers are set by PCD manually once the WO lands in their
        // inbox — don't allocate them on this side.
        $workOrder->update([
            'status'         => 'pcd_pending',
            'pcd_handoff_at' => now(),
            'pcd_handoff_by' => auth()->id(),
            'notes'          => $updatedNotes,
        ]);

        // Notify PCD officers — include the IED note in the message body
        // so the most actionable context is on the notification itself.
        $pcdMessage = "WO {$workOrder->wo_number} ({$workOrder->customer?->name}) has been accepted by IED and is awaiting PCD setup.";
        if ($note !== '') {
            $pcdMessage .= "\n\nNote from IED: {$note}";
        }
        if ($itemNoteCount > 0) {
            $pcdMessage .= "\n\n(+{$itemNoteCount} per-item note" . ($itemNoteCount === 1 ? '' : 's') . " attached.)";
        }
        NotifyService::toPermission(
            'view pcd-inbox',
            'work_order_forwarded_to_pcd',
            'New Work Order — PCD action required',
            $pcdMessage,
            "/pcd/inbox/{$workOrder->id}",
            'fi-rr-tools',
            'brand',
        );

        // Notify the customer — their work order is now in production planning.
        $workOrder->loadMissing('customer');
        if ($workOrder->customer) {
            try {
                CustomerNotifyService::send(
                    $workOrder->customer,
                    'work_order_accepted',
                    'Your Work Order has been accepted',
                    "WO {$workOrder->wo_number} has been reviewed by BITAC's IED team and forwarded to production. We'll keep you updated as the job progresses.",
                    "/customer/rfqs/{$workOrder->rfq_id}",
                    'fi-rr-check-circle',
                    'emerald',
                    $workOrder,
                );
            } catch (\Throwable $e) {
                \Log::warning('Customer notify (work_order_accepted) failed: ' . $e->getMessage());
            }
        }

        return redirect()
            ->route('ied.work-orders.index')
            ->with('success', "WO {$workOrder->wo_number} forwarded to PCD. The customer has been notified.");
    }

    /**
     * Streams a work-order file through the controller (not the raw
     * /storage/... URL) so the PdfPopupModal's base64 mode works and
     * IDM/FDM extensions don't intercept the response.
     *
     *   ?preview=base64 → JSON { data, filename, mime }
     *   ?preview=1      → inline binary
     *   (none)          → force download
     */
    public function file(Request $request, \App\Models\WorkOrderFile $file)
    {
        $workOrder = $file->workOrder;
        abort_unless($workOrder, 404);

        abort_unless(\Storage::disk('public')->exists($file->stored_path), 404, 'File missing on disk.');

        $bytes = \Storage::disk('public')->get($file->stored_path);
        $ext   = strtolower(pathinfo($file->original_name ?? '', PATHINFO_EXTENSION));
        $title = $file->title ?: ($file->original_name ?: 'document');
        $safe  = preg_replace('/[^A-Za-z0-9 _\-]/', '_', pathinfo($title, PATHINFO_FILENAME));
        $filename = $safe . ($ext ? ".{$ext}" : '');

        $mime = $file->mime_type ?: match ($ext) {
            'pdf'         => 'application/pdf',
            'jpg', 'jpeg' => 'image/jpeg',
            'png'         => 'image/png',
            'webp'        => 'image/webp',
            'doc'         => 'application/msword',
            'docx'        => 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            default       => 'application/octet-stream',
        };

        if ($request->query('preview') === 'base64') {
            return response()->json([
                'filename' => $filename,
                'data'     => base64_encode($bytes),
                'mime'     => $mime,
            ]);
        }

        $disposition = $request->boolean('preview') ? 'inline' : 'attachment';
        return response($bytes, 200, [
            'Content-Type'        => $mime,
            'Content-Disposition' => $disposition . '; filename="' . $filename . '"',
            'Content-Length'      => strlen($bytes),
        ]);
    }

    /**
     * IED rejects the work order. Status flips to `cancelled` — the source
     * quotation is reopened so the customer can be re-engaged if needed.
     */
    public function reject(Request $request, WorkOrder $workOrder)
    {
        abort_unless($workOrder->status === 'ied_pending', 422,
            'Only IED-pending work orders can be rejected at this stage.');

        $validated = $request->validate([
            'reason' => 'required|string|max:1000',
        ]);

        $workOrder->update([
            'status' => 'cancelled',
            'notes'  => trim(($workOrder->notes ? $workOrder->notes . "\n\n" : '') . "[IED Rejected] " . $validated['reason']),
        ]);

        // Reopen the source quotation so a fresh WO can be issued later.
        if ($workOrder->quotation) {
            $workOrder->quotation->update(['status' => 'sent_to_customer']);
        }

        // Notify the customer
        $workOrder->loadMissing('customer');
        if ($workOrder->customer) {
            try {
                CustomerNotifyService::send(
                    $workOrder->customer,
                    'work_order_rejected',
                    'Work Order needs your attention',
                    "WO {$workOrder->wo_number} could not be accepted: {$validated['reason']}. Please contact BITAC IED to resolve.",
                    "/customer/rfqs/{$workOrder->rfq_id}",
                    'fi-rr-triangle-warning',
                    'rose',
                    $workOrder,
                );
            } catch (\Throwable $e) {
                \Log::warning('Customer notify (work_order_rejected) failed: ' . $e->getMessage());
            }
        }

        return redirect()
            ->route('ied.work-orders.index')
            ->with('success', "WO {$workOrder->wo_number} rejected. The customer has been notified.");
    }
}
