<?php

namespace App\Http\Controllers;

use App\Models\OfficeNote;
use App\Models\User;
use App\Services\BitacLetterhead;
use App\Support\BanglaDigits;
use App\Support\SignatureBlock;
use App\Support\SignatureResolver;
use Illuminate\Http\Request;
use Inertia\Inertia;

/**
 * IED → Notes. Internal notes, written like a letter but printed on plain
 * legal paper with **no letterhead**.
 *
 * Direct issue, no approval, selectable signatory — the same conventions as
 * RFQ Letters.
 */
class OfficeNoteController extends Controller
{
    public function index(Request $request)
    {
        $query = OfficeNote::with(['signatory', 'createdBy'])->latest();

        if ($search = trim((string) $request->input('search'))) {
            $query->where(fn ($w) => $w->where('subject', 'like', "%{$search}%")
                ->orWhere('note_no', 'like', "%{$search}%"));
        }
        if (in_array($request->input('status'), ['draft', 'issued'], true)) {
            $query->where('status', $request->input('status'));
        }

        return Inertia::render('OfficeNote/Index', [
            'notes' => $query->paginate(20)->withQueryString()->through(fn (OfficeNote $n) => [
                'id'         => $n->id,
                'note_no'    => $n->note_no,
                'subject'    => $n->subject,
                'recipient'  => \Illuminate\Support\Str::limit(strtok((string) $n->recipient_block, "\n"), 40),
                'signatory'  => $n->signatory?->name,
                'status'     => $n->status,
                'note_date'  => $n->note_date?->format('d M Y'),
                'created_by' => $n->createdBy?->name,
            ]),
            'filters' => ['search' => $search, 'status' => $request->input('status', '')],
        ]);
    }

    public function create()
    {
        return Inertia::render('OfficeNote/Create', $this->formProps(null));
    }

    public function store(Request $request)
    {
        $data  = $this->validateNote($request);
        $issue = $request->boolean('issue');

        OfficeNote::create([
            'note_no'           => $data['note_no'] ?? null,
            'note_date'         => $data['note_date'] ?? now()->toDateString(),
            'subject'           => $data['subject'],
            'body'              => $data['body'],
            'recipient_block'   => $data['recipient_block'] ?? null,
            'signatory_user_id' => $data['signatory_user_id'] ?? null,
            'signature_path'    => $this->resolveSignature($data),
            'status'            => $issue ? 'issued' : 'draft',
            'issued_at'         => $issue ? now() : null,
            'created_by'        => auth()->id(),
        ]);

        return redirect()->route('office-notes.index')
            ->with('success', $issue ? 'Note issued.' : 'Note saved as draft.');
    }

    public function edit(OfficeNote $officeNote)
    {
        return Inertia::render('OfficeNote/Create', $this->formProps($officeNote));
    }

    public function update(Request $request, OfficeNote $officeNote)
    {
        $data  = $this->validateNote($request);
        $issue = $request->boolean('issue');

        $officeNote->update([
            'note_no'           => $data['note_no'] ?? null,
            'note_date'         => $data['note_date'] ?? $officeNote->note_date,
            'subject'           => $data['subject'],
            'body'              => $data['body'],
            'recipient_block'   => $data['recipient_block'] ?? null,
            'signatory_user_id' => $data['signatory_user_id'] ?? null,
            'signature_path'    => $this->resolveSignature($data) ?? $officeNote->signature_path,
            'status'            => $issue ? 'issued' : $officeNote->status,
            'issued_at'         => $issue && ! $officeNote->issued_at ? now() : $officeNote->issued_at,
        ]);

        return redirect()->route('office-notes.index')
            ->with('success', $issue ? 'Note issued.' : 'Note updated.');
    }

    public function destroy(OfficeNote $officeNote)
    {
        $officeNote->delete();

        return back()->with('success', 'Note deleted.');
    }

    /** Duplicate into a fresh draft — same rules as a letter. */
    public function duplicate(OfficeNote $officeNote)
    {
        $copy = OfficeNote::create([
            'note_no'           => null,           // its own number, from the register
            'note_date'         => now()->toDateString(),
            'subject'           => $officeNote->subject,
            'body'              => $officeNote->body,
            'recipient_block'   => $officeNote->recipient_block,
            'signatory_user_id' => $officeNote->signatory_user_id,
            'signature_path'    => null,           // signed when THIS note is issued
            'status'            => 'draft',
            'created_by'        => auth()->id(),
        ]);

        return redirect()->route('office-notes.edit', $copy)
            ->with('success', 'Copied. Give it a number and check the recipient before issuing.');
    }

    /** The note as a PDF — plain legal paper, no letterhead. */
    public function pdf(Request $request, OfficeNote $officeNote)
    {
        $lang  = $request->query('lang') === 'en' ? 'en' : 'bn';
        $bytes = app(BitacLetterhead::class)->renderPlain(
            $this->buildHtml($officeNote, $lang),
            'Note ' . ($officeNote->note_no ?: $officeNote->id),
        );

        $filename = 'note-' . str_pad((string) $officeNote->id, 5, '0', STR_PAD_LEFT)
            . ($lang === 'en' ? '-EN' : '-BN') . '.pdf';

        if ($request->input('preview') === 'base64') {
            return response()->json([
                'filename' => $filename,
                'size'     => strlen($bytes),
                'data'     => base64_encode($bytes),
            ]);
        }

        return response($bytes, 200, [
            'Content-Type'        => 'application/pdf',
            'Content-Disposition' => ($request->boolean('preview') ? 'inline' : 'attachment')
                . '; filename="' . $filename . '"',
            'Content-Length'      => strlen($bytes),
        ]);
    }

    /**
     * The note's body HTML.
     *
     * No letterhead, so the note names the office itself at the top — otherwise
     * a plain sheet says nothing about where it came from.
     */
    private function buildHtml(OfficeNote $note, string $lang): string
    {
        $note->loadMissing(['signatory.center']);
        $esc  = fn ($v) => htmlspecialchars((string) ($v ?? ''), ENT_QUOTES | ENT_HTML5, 'UTF-8');
        $isBn = $lang !== 'en';
        $num  = fn ($v) => $isBn ? BanglaDigits::from($v) : (string) $v;

        $centre = $note->signatory?->center
            ?? \App\Models\Center::find($note->center_id ?? auth()->user()?->center_id ?? 1);
        $office = $isBn
            ? ($centre?->name_bn ?: $centre?->name)
            : ($centre?->name ?: 'BITAC');

        $L = $isBn
            ? ['note' => 'অফিস নোট', 'no' => 'নং-', 'date' => 'তারিখঃ', 'subject' => 'বিষয়ঃ-', 'to' => 'প্রতি,']
            : ['note' => 'OFFICE NOTE', 'no' => 'Ref No.-', 'date' => 'Date:', 'subject' => 'Subject:-', 'to' => 'To,'];

        $lf = $isBn ? 'font-family: nikosh;' : '';

        $sigPath = $note->signature_path
            ? \Storage::disk('public')->path($note->signature_path)
            : $note->signatory?->signatureAbsolutePath();
        $sigPath = ($sigPath && is_file($sigPath)) ? $sigPath : null;

        $signer = SignatureBlock::html(
            $sigPath,
            SignatureBlock::linesFor($note->signatory, [], $lang),
            imageMaxWidthPt: 175,
            align: 'right',
        );

        $head = '<div style="' . $lf . ' text-align: center; margin-bottom: 14pt;">'
            . '<div style="font-size: 13pt; font-weight: bold; color: #000;">' . $esc($office) . '</div>'
            . '<div style="font-size: 12pt; font-weight: bold; color: #000; margin-top: 3pt;">' . $L['note'] . '</div>'
            . '</div>';

        $meta = '<table width="100%" cellspacing="0" cellpadding="0" style="margin-bottom: 14pt;">'
            . '<tr>'
            .   '<td style="' . $lf . ' font-size: 11pt; color: #000;"><b>' . $L['no'] . '</b> '
            .     $num($esc($note->note_no)) . '</td>'
            .   '<td align="right" style="' . $lf . ' font-size: 11pt; color: #000;"><b>' . $L['date'] . '</b> '
            .     $num(optional($note->note_date)->format('d/m/Y')) . '</td>'
            . '</tr></table>';

        $to = trim((string) $note->recipient_block) !== ''
            ? '<div style="' . $lf . ' font-size: 11pt; color: #000; margin-bottom: 12pt; line-height: 1.4;">'
                . '<b>' . $L['to'] . '</b><br>' . nl2br($esc($note->recipient_block)) . '</div>'
            : '';

        $subject = '<div style="' . $lf . ' font-size: 11pt; color: #000; margin-bottom: 12pt;">'
            . '<b>' . $L['subject'] . '</b> ' . $esc($note->subject) . '</div>';

        // The body is rich text from the editor — already sanitised on save.
        $body = '<div style="' . $lf . ' font-size: 11pt; color: #000; line-height: 1.7; text-align: justify;">'
            . $note->body . '</div>';

        return $head . $meta . $to . $subject . $body
            . '<table width="100%" cellspacing="0" cellpadding="0" style="margin-top: 36pt;">'
            . '<tr><td width="52%"></td>'
            . '<td width="48%" align="right" style="vertical-align: top; text-align: right;">' . $signer . '</td>'
            . '</tr></table>';
    }

    private function formProps(?OfficeNote $note): array
    {
        return [
            'existing' => $note ? [
                'id'                => $note->id,
                'note_no'           => $note->note_no,
                'note_date'         => $note->note_date?->format('Y-m-d'),
                'subject'           => $note->subject,
                'body'              => $note->body,
                'recipient_block'   => $note->recipient_block,
                'signatory_user_id' => $note->signatory_user_id,
                'status'            => $note->status,
            ] : null,
            // Each signatory carries their own blocks — a note is often drafted
            // by one person and signed by another.
            'signatories' => User::with('signatures')->orderBy('name')->get(['id', 'name', 'designation'])
                ->map(fn ($u) => [
                    'id'          => $u->id,
                    'name'        => $u->name,
                    'designation' => $u->designation,
                    'signatures'  => $u->signatures->map(fn ($s) => [
                        'id' => $s->id, 'label' => $s->label, 'url' => $s->url, 'is_default' => $s->is_default,
                    ])->values(),
                ]),
            'defaultSignatoryId' => auth()->id(),
        ];
    }

    private function resolveSignature(array $data): ?string
    {
        return SignatureResolver::resolve(
            $data['user_signature_id'] ?? null,
            null,                                    // notes are never hand-drawn
            'signatures/notes',
            $data['signatory_user_id'] ?? null,
        );
    }

    private function validateNote(Request $request): array
    {
        return $request->validate([
            'note_no'           => 'nullable|string|max:120',
            'note_date'         => 'nullable|date',
            'subject'           => 'required|string|max:255',
            'body'              => 'required|string',
            'recipient_block'   => 'nullable|string|max:1000',
            'signatory_user_id' => 'nullable|exists:users,id',
            'user_signature_id' => 'nullable|integer|exists:user_signatures,id',
        ]);
    }
}
