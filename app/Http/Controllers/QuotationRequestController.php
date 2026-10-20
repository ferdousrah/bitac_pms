<?php

namespace App\Http\Controllers;

use App\Models\Customer;
use App\Models\QuotationRequest;
use App\Models\QuotationRequestFile;
use App\Models\Rfq;
use App\Models\RfqItem;
use App\Models\RfqItemFile;
use App\Models\SiteOffice;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Inertia\Inertia;

/**
 * IED → Quote Requests: what visitors asked for on the public website.
 *
 * A request is read, then either turned into a DRAFT RFQ against a real
 * customer (`convert`), closed, or marked spam. Converting is the only way a
 * request reaches the pipeline — and it lands as a draft, so nothing fires
 * (auto-estimate, PCD notification) until a person submits that RFQ.
 */
class QuotationRequestController extends Controller
{
    public function index(Request $request)
    {
        $status = $request->input('status');
        $search = trim((string) $request->input('search'));
        $office = $request->input('office');

        $requests = QuotationRequest::query()
            ->with('office:id,name')
            ->withCount('files')
            ->when($status && isset(QuotationRequest::STATUSES[$status]), fn ($q) => $q->where('status', $status))
            ->when($office, fn ($q) => $q->where('site_office_id', $office))
            ->when($search !== '', fn ($q) => $q->where(fn ($w) => $w
                ->where('reference_no', 'like', "%{$search}%")
                ->orWhere('name', 'like', "%{$search}%")
                ->orWhere('organisation', 'like', "%{$search}%")
                ->orWhere('email', 'like', "%{$search}%")
                ->orWhere('phone', 'like', "%{$search}%")
                ->orWhere('subject', 'like', "%{$search}%")))
            ->latest()
            ->paginate(20)
            ->withQueryString()
            ->through(fn (QuotationRequest $r) => [
                'id'           => $r->id,
                'reference_no' => $r->reference_no,
                'name'         => $r->name,
                'organisation' => $r->organisation,
                'email'        => $r->email,
                'phone'        => $r->phone,
                'subject'      => $r->subject,
                'quantity'     => $r->quantity,
                'unit'         => $r->unit,
                'office'       => $r->office?->name,
                'files_count'  => $r->files_count,
                'status'       => $r->status,
                'status_label' => $r->status_label,
                'rfq_id'       => $r->rfq_id,
                'created_at'   => $r->created_at->format('d M Y, h:i A'),
                'age'          => $r->created_at->diffForHumans(),
            ]);

        $counts = QuotationRequest::query()
            ->selectRaw('status, COUNT(*) AS n')->groupBy('status')->pluck('n', 'status');

        return Inertia::render('QuotationRequests/Index', [
            'requests' => $requests,
            'filters'  => ['status' => $status, 'search' => $search, 'office' => $office],
            'stats'    => [
                'new'       => (int) ($counts['new'] ?? 0),
                'in_review' => (int) ($counts['in_review'] ?? 0),
                'converted' => (int) ($counts['converted'] ?? 0),
                'closed'    => (int) ($counts['closed'] ?? 0) + (int) ($counts['spam'] ?? 0),
                'total'     => (int) $counts->sum(),
            ],
            'statuses' => QuotationRequest::STATUSES,
            'offices'  => SiteOffice::orderByDesc('is_head_office')->orderBy('sort')->get(['id', 'name']),
        ]);
    }

    public function show(Request $request, QuotationRequest $quotationRequest)
    {
        $qr = $quotationRequest;

        // Opening a new request is what "someone has seen it" means. Only for
        // someone who could act on it — a read-only viewer does not claim it.
        if ($qr->status === 'new' && $request->user()->can('edit rfqs')) {
            $qr->update(['status' => 'in_review', 'handled_by' => $request->user()->id, 'handled_at' => now()]);
        }

        $qr->load(['files', 'office', 'handler:id,name', 'customer:id,name', 'rfq:id,status']);

        $customers = Customer::where('is_active', true)->orderBy('name')
            ->get(['id', 'name', 'contact_person', 'email', 'phone']);

        return Inertia::render('QuotationRequests/Show', [
            'request' => [
                'id'           => $qr->id,
                'reference_no' => $qr->reference_no,
                'name'         => $qr->name,
                'organisation' => $qr->organisation,
                'designation'  => $qr->designation,
                'email'        => $qr->email,
                'phone'        => $qr->phone,
                'address'      => $qr->address,
                'subject'      => $qr->subject,
                'description'  => $qr->description,
                'quantity'     => $qr->quantity,
                'unit'         => $qr->unit,
                'needed_by'    => $qr->needed_by?->format('d M Y'),
                'office'       => $qr->office ? ['name' => $qr->office->name, 'email' => $qr->office->shown_email] : null,
                'status'       => $qr->status,
                'status_label' => $qr->status_label,
                'staff_note'   => $qr->staff_note,
                'handler'      => $qr->handler?->name,
                'handled_at'   => $qr->handled_at?->format('d M Y, h:i A'),
                'customer'     => $qr->customer?->only(['id', 'name']),
                'rfq'          => $qr->rfq ? ['id' => $qr->rfq->id, 'status' => $qr->rfq->status] : null,
                'converted_at' => $qr->converted_at?->format('d M Y, h:i A'),
                'ip'           => $qr->ip,
                'created_at'   => $qr->created_at->format('d M Y, h:i A'),
                'age'          => $qr->created_at->diffForHumans(),
                'files'        => $qr->files->map(fn (QuotationRequestFile $f) => [
                    'id'       => $f->id,
                    'name'     => $f->original_name,
                    'size'     => $f->size,
                    'is_image' => $f->isImage(),
                    'is_pdf'   => str_ends_with(strtolower($f->original_name), '.pdf'),
                    'url'      => route('ied.quotation-requests.file', [$qr, $f]),
                ])->values(),
            ],
            'customers'           => $customers,
            'suggestedCustomerId' => $this->matchCustomer($qr, $customers),
            'settable'            => collect(QuotationRequest::SETTABLE)
                ->mapWithKeys(fn ($s) => [$s => QuotationRequest::STATUSES[$s]]),
            'can' => [
                'edit'    => $request->user()->can('edit rfqs'),
                'convert' => $request->user()->can('create rfqs'),
            ],
        ]);
    }

    public function update(Request $request, QuotationRequest $quotationRequest)
    {
        // A converted request points at its RFQ; its status is fixed, so that
        // RFQ keeps a record of where it came from. Only the note can change.
        $converted = $quotationRequest->status === 'converted';

        $data = $request->validate([
            'status'     => $converted ? 'nullable' : 'required|in:' . implode(',', QuotationRequest::SETTABLE),
            'staff_note' => 'nullable|string|max:5000',
        ]);

        $quotationRequest->update([
            'status'     => $converted ? 'converted' : $data['status'],
            'staff_note' => ($data['staff_note'] ?? null) ?: null,
            'handled_by' => $request->user()->id,
            'handled_at' => now(),
        ]);

        return back()->with('success', $converted ? 'Note saved.' : 'Request updated.');
    }

    /**
     * Turn the request into a DRAFT RFQ for a customer that already exists.
     * The job, quantity, date and every attached file come across; the RFQ
     * then opens for editing, where IED completes it and submits it.
     */
    public function convert(Request $request, QuotationRequest $quotationRequest)
    {
        $qr = $quotationRequest;
        $data = $request->validate(['customer_id' => 'required|integer|exists:customers,id']);

        if ($qr->rfq_id) {
            return redirect()->route('rfqs.edit', $qr->rfq_id)->with('error', "{$qr->reference_no} was already converted — this is its RFQ.");
        }
        if ($qr->status === 'spam') {
            return back()->with('error', 'A request marked as spam cannot be converted. Change its status first.');
        }

        $copied = [];
        try {
            $rfq = DB::transaction(function () use ($qr, $data, $request, &$copied) {
                $rfq = Rfq::create([
                    'center_id'   => $qr->center_id,
                    'customer_id' => $data['customer_id'],
                    'required_by' => $qr->needed_by,
                    'notes'       => "From website quotation request {$qr->reference_no} — {$qr->name}"
                        . ($qr->organisation ? ", {$qr->organisation}" : '')
                        . ", {$qr->phone}, {$qr->email}.",
                    'status'      => 'draft',
                    'source'      => 'website',
                    'created_by'  => $request->user()->id,
                ]);

                $item = RfqItem::create([
                    'rfq_id'          => $rfq->id,
                    'center_id'       => $rfq->center_id,
                    'job_description' => trim($qr->subject . "\n\n" . $qr->description),
                    'quantity'        => $qr->quantity ?? 0,
                    'unit'            => $qr->unit ?: 'pcs',
                ]);

                // Copied, not moved: the request keeps its own files, and the
                // RFQ's copies can be deleted with it (no user_file_id).
                foreach ($qr->files as $i => $f) {
                    if (! Storage::disk('local')->exists($f->path)) continue;
                    $ext  = strtolower(pathinfo($f->original_name, PATHINFO_EXTENSION));
                    $dest = "rfq-items/{$item->id}/" . Str::random(32) . ($ext ? ".{$ext}" : '');
                    Storage::disk('public')->put($dest, Storage::disk('local')->get($f->path));
                    $copied[] = $dest;

                    RfqItemFile::create([
                        'rfq_item_id'   => $item->id,
                        'type'          => 'drawing',
                        'stored_path'   => $dest,
                        'original_name' => $f->original_name,
                        'sort_order'    => $i,
                    ]);
                }
                if ($copied) {
                    $item->update(['reference_type' => 'drawing', 'drawing_path' => $copied[0]]);
                }

                $qr->update([
                    'status'       => 'converted',
                    'customer_id'  => $data['customer_id'],
                    'rfq_id'       => $rfq->id,
                    'converted_at' => now(),
                    'handled_by'   => $request->user()->id,
                    'handled_at'   => now(),
                ]);

                return $rfq;
            });
        } catch (\Throwable $e) {
            // The rows rolled back; the copied files did not.
            foreach ($copied as $p) Storage::disk('public')->delete($p);
            throw $e;
        }

        return redirect()->route('rfqs.edit', $rfq)
            ->with('success', "Draft RFQ #{$rfq->id} created from {$qr->reference_no}. Complete it and submit when ready.");
    }

    public function file(QuotationRequest $quotationRequest, QuotationRequestFile $file)
    {
        abort_unless($file->quotation_request_id === $quotationRequest->id, 404);
        abort_unless(Storage::disk('local')->exists($file->path), 404);

        // Uploaded by a stranger: only an image or a PDF is shown in the
        // browser; everything else is a download.
        $inline = $file->isImage() || str_ends_with(strtolower($file->original_name), '.pdf');

        return Storage::disk('local')->response($file->path, $file->original_name, [
            'X-Content-Type-Options' => 'nosniff',
        ], $inline ? 'inline' : 'attachment');
    }

    public function destroy(QuotationRequest $quotationRequest)
    {
        if ($quotationRequest->status === 'converted') {
            return back()->with('error', 'A converted request is the record of where its RFQ came from, so it is kept.');
        }

        $ref = $quotationRequest->reference_no;
        $quotationRequest->deleteWithFiles();

        return redirect()->route('ied.quotation-requests.index')->with('success', "{$ref} deleted.");
    }

    /**
     * The customer this request most likely came from: same email, else same
     * phone digits, else an organisation name that matches.
     */
    private function matchCustomer(QuotationRequest $qr, $customers): ?int
    {
        $email = strtolower(trim($qr->email));
        $digits = fn ($s) => substr(preg_replace('/\D/', '', strtr((string) $s, ['০' => 0, '১' => 1, '২' => 2, '৩' => 3, '৪' => 4, '৫' => 5, '৬' => 6, '৭' => 7, '৮' => 8, '৯' => 9])), -10);
        $phone = $digits($qr->phone);
        $org = strtolower(trim((string) $qr->organisation));

        foreach ($customers as $c) {
            if ($email !== '' && strtolower(trim((string) $c->email)) === $email) return $c->id;
        }
        if (strlen($phone) >= 7) {
            foreach ($customers as $c) {
                if ($c->phone && $digits($c->phone) === $phone) return $c->id;
            }
        }
        if ($org !== '') {
            foreach ($customers as $c) {
                if (strtolower(trim($c->name)) === $org) return $c->id;
            }
        }

        return null;
    }
}
