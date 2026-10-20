<?php

namespace App\Http\Controllers;

use App\Models\Center;
use App\Models\OfficeNote;
use App\Models\Section;
use App\Services\BitacLetterhead;
use App\Services\NoteWorkflow;
use App\Support\BanglaDigits;
use App\Support\SignatureResolver;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Inertia\Inertia;

/**
 * Notes — internal notes for EVERY department, printed on plain legal paper
 * with no letterhead, and signed in order (BITAC, 2026-10-20).
 *
 * A note is written as a draft, submitted (the preparer's own signature goes
 * on automatically), signed step by step — see App\Services\NoteWorkflow for
 * the chain — and, once the centre head passes it, comes back to the
 * department and prints. Any signer can send it back with a comment; the
 * preparer edits and submits again.
 *
 * Every note is kept, like a quotation: the list is the register.
 */
class OfficeNoteController extends Controller
{
    public function index(Request $request)
    {
        $user = $request->user();
        $awaiting = NoteWorkflow::awaitingIds($user);

        $query = NoteWorkflow::scopeVisible(OfficeNote::with(['createdBy', 'section'])->latest('id'), $user);

        if ($search = trim((string) $request->input('search'))) {
            $query->where(fn ($w) => $w->where('subject', 'like', "%{$search}%")
                ->orWhere('note_no', 'like', "%{$search}%")
                ->orWhere('department_name', 'like', "%{$search}%"));
        }
        $tab = $request->input('tab');
        if ($tab === 'awaiting') {
            $query->whereIn('office_notes.id', $awaiting ?: [0]);
        } elseif (isset(OfficeNote::STATUSES[$status = (string) $request->input('status')])) {
            $query->where('status', $status);
        }
        if ($dept = $request->integer('section_id')) {
            $query->where('section_id', $dept);
        }

        return Inertia::render('OfficeNote/Index', [
            'notes' => $query->paginate(20)->withQueryString()->through(fn (OfficeNote $n) => [
                'id'           => $n->id,
                'note_no'      => $n->note_no,
                'subject'      => $n->subject,
                'department'   => $n->department_name ?: $n->section?->name,
                'status'       => $n->status,
                'status_label' => OfficeNote::STATUSES[$n->status] ?? $n->status,
                'note_date'    => $n->note_date?->format('d M Y'),
                'created_by'   => $n->createdBy?->name,
                'mine'         => (int) $n->created_by === $user->id,
                'awaiting_me'  => in_array($n->id, $awaiting, true),
                'can_edit'     => $n->isEditable() && (int) $n->created_by === $user->id,
            ]),
            'filters'       => ['search' => $search, 'status' => $request->input('status', ''), 'tab' => $tab ?? '',
                                'section_id' => $dept ?: ''],
            'awaitingCount' => count($awaiting),
            'departments'   => Section::whereNull('parent_id')->where('is_active', true)->orderBy('id')->get(['id', 'name']),
            'statuses'      => OfficeNote::STATUSES,
        ]);
    }

    public function create()
    {
        return Inertia::render('OfficeNote/Create', $this->formProps(null));
    }

    public function store(Request $request)
    {
        $data = $this->validateNote($request);

        $note = OfficeNote::create($this->attributes($data) + [
            'status'     => 'draft',
            'created_by' => $request->user()->id,
        ]);

        if ($request->boolean('submit')) {
            NoteWorkflow::submit($note, $request->user());
            return redirect()->route('office-notes.show', $note)->with('success', 'Note submitted for signatures.');
        }

        return redirect()->route('office-notes.show', $note)->with('success', 'Note saved as draft.');
    }

    public function show(Request $request, OfficeNote $officeNote)
    {
        $user = $request->user();
        abort_unless(NoteWorkflow::canSee($user, $officeNote), 403, 'This note belongs to another department.');

        $officeNote->load(['createdBy', 'section', 'approvals.actor', 'approvals.section']);
        $current = NoteWorkflow::current($officeNote);

        $steps = $officeNote->approvals->map(fn ($a) => [
            'id'          => $a->id,
            'step'        => $a->step,
            'label'       => NoteWorkflow::LABELS[$a->step]['bn'] ?? $a->step,
            'label_en'    => NoteWorkflow::LABELS[$a->step]['en'] ?? $a->step,
            'status'      => $a->status,
            'skip_reason' => $a->skip_reason,
            'actor'       => $a->actor?->name,
            'acted_at'    => $a->acted_at?->format('d M Y, h:i A'),
            'remarks'     => $a->remarks,
            'is_current'  => $current?->id === $a->id,
            // Who could sign it — so a waiting step says whose desk it is on.
            'waiting_on'  => $current?->id === $a->id
                ? \App\Models\User::whereIn('id', NoteWorkflow::pool($officeNote, $a->step, $a->section_id))->pluck('name')->all()
                : [],
        ])->values();

        return Inertia::render('OfficeNote/Show', [
            'note' => [
                'id'              => $officeNote->id,
                'note_no'         => $officeNote->note_no,
                'note_date'       => $officeNote->note_date?->format('d M Y'),
                'subject'         => $officeNote->subject,
                'body'            => $officeNote->body,
                'recipient_block' => $officeNote->recipient_block,
                'department'      => $officeNote->department_name ?: $officeNote->section?->name,
                'status'          => $officeNote->status,
                'status_label'    => OfficeNote::STATUSES[$officeNote->status] ?? $officeNote->status,
                'created_by'      => $officeNote->createdBy?->name,
                'submitted_at'    => $officeNote->submitted_at?->format('d M Y, h:i A'),
                'approved_at'     => $officeNote->approved_at?->format('d M Y, h:i A'),
                'chain'           => NoteWorkflow::isShortChain($officeNote->section) ? 'short' : 'long',
                'head_stand_in'   => NoteWorkflow::headIsStandIn($officeNote),
            ],
            'steps' => $steps,
            'can'   => [
                'edit'   => $officeNote->isEditable() && (int) $officeNote->created_by === $user->id,
                'submit' => $officeNote->isEditable() && (int) $officeNote->created_by === $user->id,
                'act'    => NoteWorkflow::canAct($user, $officeNote),
                'delete' => $officeNote->status === 'draft' && ((int) $officeNote->created_by === $user->id || $user->isSuperAdmin()),
            ],
            'currentStepLabel' => $current ? NoteWorkflow::LABELS[$current->step]['bn'] : null,
            'currentStepIsHead' => $current?->step === 'head',
        ]);
    }

    public function edit(Request $request, OfficeNote $officeNote)
    {
        if (! $officeNote->isEditable() || (int) $officeNote->created_by !== $request->user()->id) {
            return redirect()->route('office-notes.show', $officeNote)
                ->with('error', 'Only the preparer can change a note, and only while it is a draft or after it was sent back.');
        }

        return Inertia::render('OfficeNote/Create', $this->formProps($officeNote));
    }

    public function update(Request $request, OfficeNote $officeNote)
    {
        if (! $officeNote->isEditable() || (int) $officeNote->created_by !== $request->user()->id) {
            return redirect()->route('office-notes.show', $officeNote)
                ->with('error', 'This note is with the signers — it cannot be changed now.');
        }

        $officeNote->update($this->attributes($this->validateNote($request)));

        if ($request->boolean('submit')) {
            NoteWorkflow::submit($officeNote->fresh(), $request->user());
            return redirect()->route('office-notes.show', $officeNote)->with('success', 'Note submitted for signatures.');
        }

        return redirect()->route('office-notes.show', $officeNote)->with('success', 'Note saved.');
    }

    /** Submit a saved draft (or a note that was sent back) for signatures. */
    public function submit(Request $request, OfficeNote $officeNote)
    {
        if (! $officeNote->isEditable() || (int) $officeNote->created_by !== $request->user()->id) {
            return back()->with('error', 'Only the preparer can submit this note, and it is already with the signers.');
        }
        if (! $officeNote->section_id) {
            return back()->with('error', 'Choose the department this note comes from before submitting it.');
        }

        NoteWorkflow::submit($officeNote, $request->user());

        return back()->with('success', 'Note submitted for signatures.');
    }

    /** Sign the current step — the centre head may add a comment that prints. */
    public function approve(Request $request, OfficeNote $officeNote)
    {
        if (! NoteWorkflow::canAct($request->user(), $officeNote)) {
            return back()->with('error', 'It is not your turn to sign this note.');
        }
        $data = $request->validate([
            'remarks'           => 'nullable|string|max:3000',
            'user_signature_id' => 'nullable|integer|exists:user_signatures,id',
        ]);

        // A picked block that is not the signer's own is refused → their default.
        $sig = SignatureResolver::resolve($data['user_signature_id'] ?? null, null, 'signatures/notes', $request->user()->id);
        $wasHead = NoteWorkflow::current($officeNote)?->step === 'head';

        NoteWorkflow::approve($officeNote, $request->user(), $sig, $data['remarks'] ?? null);

        return back()->with('success', $wasHead
            ? 'Passed. The note is back with its department and can be printed.'
            : 'Signed. The note has gone to the next signer.');
    }

    public function sendBack(Request $request, OfficeNote $officeNote)
    {
        if (! NoteWorkflow::canAct($request->user(), $officeNote)) {
            return back()->with('error', 'It is not your turn to act on this note.');
        }
        $data = $request->validate(['remarks' => 'required|string|max:3000'],
            ['remarks.required' => 'Say what needs changing — a note sent back with no reason gets lost.']);

        NoteWorkflow::sendBack($officeNote, $request->user(), $data['remarks']);

        return back()->with('success', 'Sent back to the preparer.');
    }

    public function destroy(Request $request, OfficeNote $officeNote)
    {
        if ($officeNote->status !== 'draft'
            || ((int) $officeNote->created_by !== $request->user()->id && ! $request->user()->isSuperAdmin())) {
            return back()->with('error', 'Only a draft can be deleted — a submitted note stays on the register.');
        }
        $officeNote->delete();

        return redirect()->route('office-notes.index')->with('success', 'Note deleted.');
    }

    /** Duplicate into a fresh draft — its own number, its own signatures. */
    public function duplicate(Request $request, OfficeNote $officeNote)
    {
        abort_unless(NoteWorkflow::canSee($request->user(), $officeNote), 403);

        $copy = OfficeNote::create([
            'section_id'      => $officeNote->section_id,
            'department_name' => $officeNote->department_name,
            'note_no'         => null,
            'note_date'       => now()->toDateString(),
            'subject'         => $officeNote->subject,
            'body'            => $officeNote->body,
            'recipient_block' => $officeNote->recipient_block,
            'status'          => 'draft',
            'created_by'      => $request->user()->id,
        ]);

        return redirect()->route('office-notes.edit', $copy)
            ->with('success', 'Copied. Give it a number and check it before submitting.');
    }

    /** The note as a PDF — plain legal paper, no letterhead. */
    public function pdf(Request $request, OfficeNote $officeNote)
    {
        abort_unless(NoteWorkflow::canSee($request->user(), $officeNote), 403);

        $lang  = $request->query('lang') === 'en' ? 'en' : 'bn';
        $bytes = app(BitacLetterhead::class)->renderPlain(
            $this->buildHtml($officeNote, $lang),
            'Note ' . ($officeNote->note_no ?: $officeNote->id),
        );

        $filename = 'note-' . str_pad((string) $officeNote->id, 5, '0', STR_PAD_LEFT)
            . ($lang === 'en' ? '-EN' : '-BN') . '.pdf';

        if ($request->input('preview') === 'base64') {
            return response()->json(['filename' => $filename, 'size' => strlen($bytes), 'data' => base64_encode($bytes)]);
        }

        return response($bytes, 200, [
            'Content-Type'        => 'application/pdf',
            'Content-Disposition' => ($request->boolean('preview') ? 'inline' : 'attachment') . '; filename="' . $filename . '"',
            'Content-Length'      => strlen($bytes),
        ]);
    }

    /**
     * The note on plain paper. No letterhead, so the top names the office
     * itself (BITAC, 2026-10-20):
     *
     *     বাংলাদেশ শিল্প কারিগরি সহায়তা কেন্দ্র (বিটাক)
     *     ১১৬/খ, তেজগাঁও শিল্প এলাকা, ঢাকা-১২০৮।
     *     বিভাগঃ আই.ই.ডি
     *
     * and the signatures run along the foot in chain order — preparer, then
     * each step that was signed (a skipped step prints nothing). The centre
     * head's comment prints under them.
     */
    private function buildHtml(OfficeNote $note, string $lang): string
    {
        $note->loadMissing(['createdBy', 'section', 'approvals.actor']);
        $esc  = fn ($v) => htmlspecialchars((string) ($v ?? ''), ENT_QUOTES | ENT_HTML5, 'UTF-8');
        $isBn = $lang !== 'en';
        $num  = fn ($v) => $isBn ? BanglaDigits::from($v) : (string) $v;
        $lf   = $isBn ? 'font-family: nikosh;' : '';

        $centre = Center::find($note->center_id ?: Center::defaultId());
        $office  = $isBn ? ($centre?->name_bn ?: $centre?->name) : ($centre?->name_en ?: 'Bangladesh Industrial Technical Assistance Center (BITAC)');
        $address = $isBn ? ($centre?->address_bn ?: '') : ($centre?->address_en ?: $centre?->address ?: '');
        $dept    = $note->department_name ?: NoteWorkflow::departmentLabel($note->section);

        $L = $isBn
            ? ['dept' => 'বিভাগঃ', 'no' => 'নং-', 'date' => 'তারিখঃ', 'subject' => 'বিষয়ঃ-', 'to' => 'প্রতি,', 'comment' => 'কেন্দ্র প্রধানের মন্তব্যঃ']
            : ['dept' => 'Department:', 'no' => 'Ref No.-', 'date' => 'Date:', 'subject' => 'Subject:-', 'to' => 'To,', 'comment' => "Centre Head's comment:"];

        $head = '<div style="' . $lf . ' text-align: center; margin-bottom: 14pt; color: #000;">'
            . '<div style="font-size: 14pt; font-weight: bold;">' . $esc($office) . '</div>'
            . ($address ? '<div style="font-size: 11pt; margin-top: 2pt;">' . $esc($address) . '</div>' : '')
            . ($dept ? '<div style="font-size: 11pt; font-weight: bold; margin-top: 3pt;">' . $L['dept'] . ' ' . $esc($dept) . '</div>' : '')
            . '</div>';

        $meta = '<table width="100%" cellspacing="0" cellpadding="0" style="margin-bottom: 14pt;"><tr>'
            . '<td style="' . $lf . ' font-size: 11pt; color: #000;"><b>' . $L['no'] . '</b> ' . $num($esc($note->note_no)) . '</td>'
            . '<td align="right" style="' . $lf . ' font-size: 11pt; color: #000;"><b>' . $L['date'] . '</b> '
            . $num(optional($note->note_date)->format('d/m/Y')) . '</td>'
            . '</tr></table>';

        $to = trim((string) $note->recipient_block) !== ''
            ? '<div style="' . $lf . ' font-size: 11pt; color: #000; margin-bottom: 12pt; line-height: 1.4;"><b>' . $L['to'] . '</b><br>'
                . nl2br($esc($note->recipient_block)) . '</div>'
            : '';

        $subject = '<div style="' . $lf . ' font-size: 11pt; color: #000; margin-bottom: 12pt;"><b>' . $L['subject'] . '</b> ' . $esc($note->subject) . '</div>';

        $body = '<div class="letter-body" style="' . $lf . ' font-size: 11pt; color: #000; line-height: 1.7; text-align: justify;">'
            . \App\Support\LetterHtml::toPrintable((string) $note->body) . '</div>';

        return $head . $meta . $to . $subject . $body . $this->signatureRow($note, $lang);
    }

    /** Preparer + every signed step, left to right; the centre head's comment beneath. */
    private function signatureRow(OfficeNote $note, string $lang): string
    {
        $esc  = fn ($v) => htmlspecialchars((string) ($v ?? ''), ENT_QUOTES | ENT_HTML5, 'UTF-8');
        $isBn = $lang !== 'en';
        $lf   = $isBn ? 'font-family: nikosh;' : '';
        $date = fn ($d) => $d ? ($isBn ? BanglaDigits::from($d->format('d/m/Y')) : $d->format('d/m/Y')) : '';

        $cells = [[
            'label' => NoteWorkflow::LABELS['preparer'][$lang],
            'path'  => $note->preparer_signature_path,
            'name'  => $note->createdBy?->name,
            'date'  => $note->submitted_at,
            'done'  => $note->status !== 'draft',
        ]];
        foreach ($note->approvals as $a) {
            if ($a->status === 'skipped') continue;
            $cells[] = [
                'label' => NoteWorkflow::LABELS[$a->step][$lang] ?? $a->step,
                'path'  => $a->status === 'approved' ? $a->signature_path : null,
                'name'  => $a->status === 'approved' ? $a->actor?->name : null,
                'date'  => $a->status === 'approved' ? $a->acted_at : null,
                'done'  => $a->status === 'approved',
            ];
        }

        // ⚠️ Three ROWS, the rule on the label CELL: mPDF draws a border on a
        // <div> inside a cell only as wide as its text, so a rule under each
        // signature has to be a table-cell border (same lesson as the
        // delivery challan). mPDF ignores cellspacing here, so narrow empty
        // gap columns keep each signature's rule its own.
        $gap = 4;
        $w = (int) floor((100 - $gap * (count($cells) - 1)) / max(1, count($cells)));
        $rowImg = $rowLabel = $rowWho = '';
        foreach ($cells as $k => $c) {
            if ($k > 0) {
                $spacer = '<td width="' . $gap . '%"></td>';
                $rowImg .= $spacer; $rowLabel .= $spacer; $rowWho .= $spacer;
            }
            $abs = $c['path'] ? Storage::disk('public')->path($c['path']) : null;
            $img = ($abs && is_file($abs))
                ? '<img src="' . $abs . '" style="max-width: 110pt; max-height: 70pt;" />'
                : '<div style="height: 46pt;"></div>';
            $rowImg   .= '<td width="' . $w . '%" align="center" style="vertical-align: bottom;">' . $img . '</td>';
            $rowLabel .= '<td align="center" style="border-top: 0.6pt solid #000; padding-top: 2pt; ' . $lf
                . ' font-size: 9.5pt; font-weight: bold; color: #000;">' . $esc($c['label']) . '</td>';
            $rowWho   .= '<td align="center" style="vertical-align: top; font-size: 8pt; color: #333;">'
                . ($c['done'] && $c['name'] ? $esc($c['name']) : '')
                . ($c['done'] && $c['date'] ? '<br><span style="' . $lf . '">' . $date($c['date']) . '</span>' : '')
                . '</td>';
        }
        $html = '<table width="100%" cellspacing="0" cellpadding="0" style="margin-top: 34pt;">'
            . '<tr>' . $rowImg . '</tr><tr>' . $rowLabel . '</tr><tr>' . $rowWho . '</tr></table>';

        $headComment = $note->approvals->first(fn ($a) => $a->step === 'head' && $a->status === 'approved' && trim((string) $a->remarks) !== '');
        if ($headComment) {
            $html .= '<div style="' . $lf . ' font-size: 10.5pt; color: #000; margin-top: 14pt; border-top: 0.4pt solid #999; padding-top: 6pt;">'
                . '<b>' . ($isBn ? 'কেন্দ্র প্রধানের মন্তব্যঃ' : "Centre Head's comment:") . '</b> '
                . nl2br($esc($headComment->remarks)) . '</div>';
        }

        return $html;
    }

    private function attributes(array $data): array
    {
        return [
            'section_id'      => $data['section_id'] ?? null,
            'department_name' => trim((string) ($data['department_name'] ?? '')) ?: null,
            'note_no'         => $data['note_no'] ?? null,
            'note_date'       => $data['note_date'] ?? now()->toDateString(),
            'subject'         => $data['subject'],
            'body'            => \App\Support\LetterHtml::sanitize($data['body']),
            'recipient_block' => $data['recipient_block'] ?? null,
        ];
    }

    private function formProps(?OfficeNote $note): array
    {
        $user  = auth()->user();
        $mine  = NoteWorkflow::departmentsOf($user);
        $depts = Section::whereNull('parent_id')->where('is_active', true)
            // Anyone who sees every note (centre head, management, super admin)
            // or has no department of their own may pick any.
            ->when(! NoteWorkflow::seesAll($user) && $mine, fn ($q) => $q->whereIn('id', $mine))
            ->orderBy('id')->get(['id', 'name', 'code']);

        return [
            'existing' => $note ? [
                'id'              => $note->id,
                'section_id'      => $note->section_id,
                'department_name' => $note->department_name,
                'note_no'         => $note->note_no,
                'note_date'       => $note->note_date?->format('Y-m-d'),
                'subject'         => $note->subject,
                'body'            => $note->body,
                'recipient_block' => $note->recipient_block,
                'status'          => $note->status,
            ] : null,
            'departments' => $depts->map(fn ($s) => [
                'id'    => $s->id,
                'name'  => $s->name,
                'label' => NoteWorkflow::departmentLabel($s),
                'chain' => NoteWorkflow::isShortChain($s) ? 'short' : 'long',
            ])->values(),
            'defaultSectionId' => $mine[0] ?? null,
        ];
    }

    private function validateNote(Request $request): array
    {
        $user = $request->user();
        $mine = NoteWorkflow::departmentsOf($user);

        return $request->validate([
            // ⚠️ The department decides who signs, so a person may only write
            // for their own — unless they see every note, or have none.
            'section_id'      => ['required', 'integer', 'exists:sections,id',
                function ($attr, $value, $fail) use ($user, $mine) {
                    if (! NoteWorkflow::seesAll($user) && $mine && ! in_array((int) $value, $mine, true)) {
                        $fail('You can only write notes for your own department.');
                    }
                }],
            'department_name' => 'nullable|string|max:120',
            'note_no'         => 'nullable|string|max:120',
            'note_date'       => 'nullable|date',
            'subject'         => 'required|string|max:255',
            'body'            => 'required|string',
            'recipient_block' => 'nullable|string|max:1000',
        ], ['section_id.required' => 'Choose the department this note comes from.']);
    }
}
