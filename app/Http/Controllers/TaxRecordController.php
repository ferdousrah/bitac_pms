<?php

namespace App\Http\Controllers;

use App\Models\Customer;
use App\Models\Invoice;
use App\Models\TaxRecord;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rule;
use Inertia\Inertia;

/**
 * Billing & Accounts → AIT Records / VAT Records (BITAC, 2026-11-01).
 *
 * What clients deducted at source, kept by hand with the certificate — one
 * controller for both registers; the kind comes from the route's default
 * (`/billing/ait-records`, `/billing/vat-records`). Reading is `view payments`,
 * writing `record payments`; only whoever recorded an entry (or the super
 * admin) deletes it. ⚠️ An entry is reached only through its OWN register, so
 * an AIT id under the VAT URL is a 404.
 */
class TaxRecordController extends Controller
{
    public function index(Request $request)
    {
        $kind = $this->kind($request);

        $q = TaxRecord::with(['customer:id,name', 'invoice:id,invoice_number', 'createdBy:id,name'])
            ->where('kind', $kind);

        if ($s = trim((string) $request->input('search'))) {
            $q->where(fn ($w) => $w->where('certificate_no', 'like', "%{$s}%")
                ->orWhere('bill_ref', 'like', "%{$s}%")
                ->orWhere('remarks', 'like', "%{$s}%")
                ->orWhereHas('customer', fn ($c) => $c->where('name', 'like', "%{$s}%"))
                ->orWhereHas('invoice', fn ($i) => $i->where('invoice_number', 'like', "%{$s}%")));
        }
        if ($c = $request->input('customer_id')) $q->where('customer_id', $c);
        if ($from = $request->input('date_from')) $q->whereDate('record_date', '>=', $from);
        if ($to = $request->input('date_to'))     $q->whereDate('record_date', '<=', $to);

        $total = (float) (clone $q)->sum('amount');
        $count = (clone $q)->count();

        $base = $this->basePath($kind);
        $me   = $request->user();
        $canRecord = (bool) $me?->can('record payments');

        return Inertia::render('TaxRecord/Index', [
            'kind'     => $kind,
            'labels'   => TaxRecord::KINDS[$kind],
            'basePath' => $base,
            'entries'  => $q->orderByDesc('record_date')->orderByDesc('id')
                ->paginate(20)->withQueryString()
                ->through(fn (TaxRecord $r) => [
                    'id'             => $r->id,
                    'customer_id'    => $r->customer_id,
                    'client'         => $r->customer?->name,
                    'invoice_id'     => $r->invoice_id,
                    'bill_ref'       => $r->bill_ref,
                    'bill'           => $r->bill_label,
                    'record_date'    => $r->record_date?->format('Y-m-d'),
                    'date_label'     => $r->record_date?->format('d M Y'),
                    'certificate_no' => $r->certificate_no,
                    'amount'         => (float) $r->amount,
                    'remarks'        => $r->remarks,
                    'file_name'      => $r->file_name,
                    'file_url'       => $r->file_path ? "{$base}/{$r->id}/file" : null,
                    'entered_by'     => $r->createdBy?->name,
                    'can_edit'       => $canRecord,
                    'can_delete'     => $canRecord && ($me->isSuperAdmin() || (int) $r->created_by === (int) $me->id),
                ]),
            'summary'  => ['total' => $total, 'count' => $count],
            'filters'  => [
                'search'      => $request->input('search', ''),
                'customer_id' => $request->input('customer_id', ''),
                'date_from'   => $request->input('date_from', ''),
                'date_to'     => $request->input('date_to', ''),
            ],
            'customers' => Customer::orderBy('name')->get(['id', 'name']),
            // This centre's bills, to link an entry to (each picker narrows to its client).
            'invoices'  => Invoice::orderByDesc('id')->limit(1000)->get(['id', 'invoice_number', 'customer_id', 'total_amount'])
                ->map(fn ($i) => ['id' => $i->id, 'number' => $i->invoice_number, 'customer_id' => $i->customer_id,
                    'total' => (float) $i->total_amount]),
            'canRecord' => $canRecord,
        ]);
    }

    public function store(Request $request)
    {
        $kind = $this->kind($request);
        $data = $this->validated($request);

        $record = TaxRecord::create($data + ['kind' => $kind, 'created_by' => auth()->id()]);
        $this->saveFile($request, $record);

        return back()->with('success', strtoupper($kind) . ' record added.');
    }

    public function update(Request $request, TaxRecord $record)
    {
        $this->own($request, $record);
        $record->update($this->validated($request));

        if ($request->boolean('remove_file') && $record->file_path) {
            Storage::disk('local')->delete($record->file_path);
            $record->update(['file_path' => null, 'file_name' => null]);
        }
        $this->saveFile($request, $record);

        return back()->with('success', 'Record updated.');
    }

    public function destroy(Request $request, TaxRecord $record)
    {
        $this->own($request, $record);

        $me = $request->user();
        if (! $me->isSuperAdmin() && (int) $record->created_by !== (int) $me->id) {
            return back()->with('error', 'Only whoever recorded this entry can delete it.');
        }
        if ($record->file_path) Storage::disk('local')->delete($record->file_path);
        $record->delete();

        return back()->with('success', 'Record removed.');
    }

    /** The certificate — private disk, behind this register's own gate. */
    public function file(Request $request, TaxRecord $record)
    {
        $this->own($request, $record);
        abort_unless($record->file_path && Storage::disk('local')->exists($record->file_path), 404);

        $ext    = strtolower(pathinfo($record->file_path, PATHINFO_EXTENSION));
        $inline = in_array($ext, ['pdf', 'jpg', 'jpeg', 'png', 'webp'], true);

        return Storage::disk('local')->response($record->file_path, $record->file_name ?: basename($record->file_path), [
            'X-Content-Type-Options' => 'nosniff',
        ], $inline ? 'inline' : 'attachment');
    }

    // ─────────────────────────────────────────────────────────────────────

    private function kind(Request $request): string
    {
        $kind = $request->route()->defaults['kind'] ?? null;
        abort_unless(isset(TaxRecord::KINDS[$kind]), 404);
        return $kind;
    }

    private function basePath(string $kind): string
    {
        return "/billing/{$kind}-records";
    }

    private function own(Request $request, TaxRecord $record): void
    {
        abort_unless($record->kind === $this->kind($request), 404);
    }

    private function validated(Request $request): array
    {
        $data = $request->validate([
            'customer_id'    => 'required|exists:customers,id',
            // A bill of THAT client, or none (then a typed bill no., if any).
            'invoice_id'     => ['nullable', Rule::exists('invoices', 'id')->where('customer_id', $request->input('customer_id'))],
            'bill_ref'       => 'nullable|string|max:120',
            'record_date'    => 'required|date',
            'certificate_no' => 'nullable|string|max:120',
            'amount'         => 'required|numeric|min:0.01|max:9999999999',
            'remarks'        => 'nullable|string|max:2000',
            'file'           => 'nullable|file|mimes:pdf,jpg,jpeg,png,webp|max:10240',
        ], [
            'invoice_id.exists' => 'That bill is not one of this client\'s.',
        ], [
            'customer_id' => 'client', 'record_date' => 'date', 'certificate_no' => 'certificate no.',
        ]);
        unset($data['file']);
        $data['invoice_id'] = ($data['invoice_id'] ?? null) ?: null;
        $data['bill_ref']   = $data['invoice_id'] ? null : (trim((string) ($data['bill_ref'] ?? '')) ?: null);

        return $data;
    }

    private function saveFile(Request $request, TaxRecord $record): void
    {
        if (! $request->hasFile('file')) return;

        if ($record->file_path) Storage::disk('local')->delete($record->file_path);
        $file = $request->file('file');
        $record->update([
            'file_path' => $file->store("tax-records/{$record->id}", 'local'),
            'file_name' => mb_substr($file->getClientOriginalName(), 0, 255),
        ]);
    }
}
