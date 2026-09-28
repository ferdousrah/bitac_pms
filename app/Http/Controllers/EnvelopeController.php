<?php

namespace App\Http\Controllers;

use App\Models\Center;
use App\Models\OfficeNote;
use App\Models\RfqLetter;
use App\Services\BitacLetterhead;
use Illuminate\Http\Request;
use Inertia\Inertia;

/**
 * Envelope printing — To and From on the envelope itself.
 *
 * Nothing is stored. An envelope is not a document: it is the same two
 * addresses printed on a different piece of paper, and the letter or note it
 * goes with is already on record. So the screen posts nothing — it just asks
 * for the PDF.
 *
 * Two ways in, both wanted by BITAC:
 *   • from a letter or a note — the recipient comes across already filled;
 *   • on its own — type any address and print.
 */
class EnvelopeController extends Controller
{
    /** The screen, optionally prefilled from a letter or a note. */
    public function index(Request $request)
    {
        $centre = $this->centre();
        $prefill = $this->prefillFrom($request);

        return Inertia::render('Envelope/Create', [
            'sizes' => collect(config('envelopes.sizes'))
                ->map(fn ($s, $key) => [
                    'key'   => $key,
                    'label' => $s['label'],
                    // Shown under the picker so the clerk can match it against
                    // the envelopes actually in the drawer.
                    'mm'    => round($s['size'][0]) . ' × ' . round($s['size'][1]) . ' mm',
                    'ratio' => $s['size'][1] > 0 ? round($s['size'][0] / $s['size'][1], 4) : 1,
                ])->values(),
            'sender' => [
                'bn' => $this->senderBlock($centre, 'bn'),
                'en' => $this->senderBlock($centre, 'en'),
            ],
            'prefill' => $prefill,
        ]);
    }

    /** The envelope itself. */
    public function pdf(Request $request)
    {
        $data = $request->validate([
            'size'   => 'required|string|in:' . implode(',', array_keys(config('envelopes.sizes'))),
            'to'     => 'required|string|max:600',
            'from'   => 'nullable|string|max:600',
            'lang'   => 'nullable|in:bn,en',
            'note'   => 'nullable|string|max:200',   // e.g. the letter's Ref No.
            'emblem' => 'nullable',
        ]);

        $spec  = config('envelopes.sizes')[$data['size']];
        $lang  = $data['lang'] ?? 'bn';
        $bytes = app(BitacLetterhead::class)->renderPlain(
            $this->buildHtml($data, $spec, $lang),
            'Envelope',
            $spec['size'],
            marginMm: 12,
        );

        $filename = 'envelope-' . $data['size'] . '-' . strtoupper($lang) . '.pdf';

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
     * The envelope layout.
     *
     * From sits top-left, small. To sits in the lower-right half, large —
     * where a postal address goes, and where the franking machine leaves it
     * alone. The whole sheet is one table so the two blocks hold their place
     * whatever the envelope size.
     */
    private function buildHtml(array $data, array $spec, string $lang): string
    {
        $esc  = fn ($v) => nl2br(htmlspecialchars(trim((string) $v), ENT_QUOTES | ENT_HTML5, 'UTF-8'));
        $isBn = $lang !== 'en';
        $lf   = $isBn ? 'font-family: nikosh;' : '';

        $emblem = '';
        if (filter_var($data['emblem'] ?? false, FILTER_VALIDATE_BOOLEAN)) {
            $path = $this->emblemPath();
            if ($path) {
                $emblem = '<img src="' . $path . '" style="height: ' . ($spec['from_pt'] * 3) . 'pt;">';
            }
        }

        $L = $isBn
            ? ['from' => 'প্রেরক', 'to' => 'প্রাপক']
            : ['from' => 'From', 'to' => 'To'];

        $label = fn (string $t, float $pt) => '<div style="' . $lf . ' font-size: ' . round($pt * 0.8, 1)
            . 'pt; color: #555; letter-spacing: 0.5pt; margin-bottom: 2pt;">' . $t . '</div>';

        $from = '<table cellspacing="0" cellpadding="0"><tr>'
            . ($emblem ? '<td style="padding-right: 8pt; vertical-align: top;">' . $emblem . '</td>' : '')
            . '<td style="vertical-align: top;">'
            .   $label($L['from'], $spec['from_pt'])
            .   '<div style="' . $lf . ' font-size: ' . $spec['from_pt'] . 'pt; color: #000; line-height: 1.45;">'
            .     $esc($data['from'] ?? '') . '</div>'
            . '</td></tr></table>';

        $to = $label($L['to'], $spec['to_pt'])
            . '<div style="' . $lf . ' font-size: ' . $spec['to_pt'] . 'pt; color: #000; line-height: 1.55; font-weight: bold;">'
            . $esc($data['to']) . '</div>';

        // The letter's Ref No., so a returned envelope can be traced back.
        $note = trim((string) ($data['note'] ?? '')) !== ''
            ? '<div style="' . $lf . ' font-size: ' . $spec['from_pt'] . 'pt; color: #444; margin-top: 6pt;">'
                . $esc($data['note']) . '</div>'
            : '';

        return '<table width="100%" cellspacing="0" cellpadding="0">'
            . '<tr><td colspan="2" style="vertical-align: top;">' . $from . '</td></tr>'
            . '<tr><td colspan="2" style="height: ' . round($spec['size'][1] * 0.22) . 'mm;"></td></tr>'
            . '<tr><td width="30%"></td><td width="70%" style="vertical-align: top;">' . $to . $note . '</td></tr>'
            . '</table>';
    }

    /** Where the envelope comes from — filled in, but the clerk can overtype it. */
    private function senderBlock(?Center $centre, string $lang): string
    {
        if (! $centre) {
            return 'BITAC';
        }

        $lines = $lang === 'en'
            ? [$centre->name, $centre->address]
            : [$centre->name_bn ?: $centre->name, $centre->address_bn ?: $centre->address];

        $phone = $lang === 'en' ? $centre->phone : ($centre->phone_bn ?: $centre->phone);
        if ($phone) {
            $lines[] = ($lang === 'en' ? 'Phone: ' : 'ফোন: ') . $phone;
        }

        return implode("\n", array_filter(array_map('trim', $lines)));
    }

    /**
     * Where the envelope is going, when it was opened from a letter or a note.
     *
     * A letter without its own recipient block falls back to the customer's
     * name and address — that is what the letter itself prints.
     */
    private function prefillFrom(Request $request): ?array
    {
        if ($id = $request->query('rfq_letter')) {
            $letter = RfqLetter::with('customer')->find($id);
            if (! $letter) {
                return null;
            }

            $to = trim((string) $letter->recipient_block);
            if ($to === '' && $letter->customer) {
                $to = implode("\n", array_filter([$letter->customer->name, $letter->customer->address]));
            }

            return [
                'to'     => $to,
                'note'   => $letter->letter_no ? 'Ref: ' . $letter->letter_no : '',
                'source' => 'Letter — ' . $letter->subject,
            ];
        }

        if ($id = $request->query('office_note')) {
            $note = OfficeNote::find($id);
            if (! $note) {
                return null;
            }

            return [
                'to'     => trim((string) $note->recipient_block),
                'note'   => $note->note_no ? 'Ref: ' . $note->note_no : '',
                'source' => 'Note — ' . $note->subject,
            ];
        }

        return null;
    }

    private function centre(): ?Center
    {
        return Center::find(session('active_center_id') ?? auth()->user()?->center_id ?? 1);
    }

    /** The national emblem from the centre's letterhead settings. */
    private function emblemPath(): ?string
    {
        $stored = $this->centre()?->logo_left_path;
        if (! $stored) {
            return null;
        }

        $path = \Storage::disk('public')->path($stored);

        return is_file($path) ? $path : null;
    }
}
