<?php

namespace App\Http\Controllers;

use App\Models\LetterRegister;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Inertia\Inertia;

/**
 * IED's and PCD's production-letter registers (BITAC, 2026-10-31):
 * আগত চিঠির রেকর্ড and প্রেরিত চিঠির রেকর্ড, kept by hand, each row able to
 * carry the scanned letter.
 *
 * `/{ied|pcd}/letters/{incoming|outgoing}` — the desk comes from the route
 * (each desk's group has its own permission), the register from the URL.
 * ⚠️ An entry is only ever reached through its OWN desk's routes: anything
 * else is a 404, so PCD cannot read or change IED's register by guessing an
 * id, and the other way round.
 */
class LetterRegisterController extends Controller
{
    private const SEGMENT = ['incoming' => 'in', 'outgoing' => 'out'];

    public function index(Request $request, string $direction)
    {
        [$desk, $dir] = $this->resolve($request, $direction);

        $q = LetterRegister::with('createdBy:id,name')
            ->where('desk', $desk)->where('direction', $dir)
            ->orderByDesc('letter_date')->orderByDesc('id');

        if ($s = trim((string) $request->input('search'))) {
            $q->where(fn ($w) => $w->where('sender', 'like', "%{$s}%")
                ->orWhere('recipient', 'like', "%{$s}%")
                ->orWhere('memo_no', 'like', "%{$s}%")
                ->orWhere('remarks', 'like', "%{$s}%"));
        }
        if ($from = $request->input('date_from')) $q->whereDate('letter_date', '>=', $from);
        if ($to = $request->input('date_to'))     $q->whereDate('letter_date', '<=', $to);

        $base = "/{$desk}/letters/{$direction}";
        $me   = auth()->user();

        return Inertia::render('LetterRegister/Index', [
            'desk'      => $desk,
            'deskLabel' => LetterRegister::DESKS[$desk],
            'direction' => $dir,
            'title'     => LetterRegister::DIRECTIONS[$dir],
            'basePath'  => $base,
            'entries'   => $q->paginate(20)->withQueryString()->through(fn (LetterRegister $e) => [
                'id'          => $e->id,
                'sender'      => $e->sender,
                'recipient'   => $e->recipient,
                'memo_no'     => $e->memo_no,
                'letter_date' => $e->letter_date?->format('Y-m-d'),
                'date_label'  => $e->letter_date?->format('d M Y'),
                'remarks'     => $e->remarks,
                'file_name'   => $e->file_name,
                'file_url'    => $e->file_path ? "{$base}/{$e->id}/file" : null,
                'entered_by'  => $e->createdBy?->name,
                'can_delete'  => $me && ($me->isSuperAdmin() || (int) $e->created_by === (int) $me->id),
            ]),
            'filters' => [
                'search'    => $request->input('search', ''),
                'date_from' => $request->input('date_from', ''),
                'date_to'   => $request->input('date_to', ''),
            ],
        ]);
    }

    public function store(Request $request, string $direction)
    {
        [$desk, $dir] = $this->resolve($request, $direction);
        $data = $this->validated($request);

        $entry = LetterRegister::create($data + [
            'desk' => $desk, 'direction' => $dir, 'created_by' => auth()->id(),
        ]);
        $this->saveFile($request, $entry);

        return back()->with('success', 'Letter recorded.');
    }

    public function update(Request $request, string $direction, LetterRegister $entry)
    {
        $this->own($request, $direction, $entry);
        $entry->update($this->validated($request));

        if ($request->boolean('remove_file') && $entry->file_path) {
            Storage::disk('local')->delete($entry->file_path);
            $entry->update(['file_path' => null, 'file_name' => null]);
        }
        $this->saveFile($request, $entry);

        return back()->with('success', 'Letter updated.');
    }

    public function destroy(Request $request, string $direction, LetterRegister $entry)
    {
        $this->own($request, $direction, $entry);

        $me = $request->user();
        if (! $me->isSuperAdmin() && (int) $entry->created_by !== (int) $me->id) {
            return back()->with('error', 'Only whoever recorded this letter can delete it.');
        }
        if ($entry->file_path) Storage::disk('local')->delete($entry->file_path);
        $entry->delete();

        return back()->with('success', 'Letter removed from the register.');
    }

    /** The scanned letter — private disk, through the desk's own gate. */
    public function file(Request $request, string $direction, LetterRegister $entry)
    {
        $this->own($request, $direction, $entry);
        abort_unless($entry->file_path && Storage::disk('local')->exists($entry->file_path), 404);

        $ext    = strtolower(pathinfo($entry->file_path, PATHINFO_EXTENSION));
        $inline = in_array($ext, ['pdf', 'jpg', 'jpeg', 'png', 'webp'], true);

        return Storage::disk('local')->response($entry->file_path, $entry->file_name ?: basename($entry->file_path), [
            'X-Content-Type-Options' => 'nosniff',
        ], $inline ? 'inline' : 'attachment');
    }

    // ─────────────────────────────────────────────────────────────────────

    /** [desk, direction] for this request; an unknown register is a 404. */
    private function resolve(Request $request, string $direction): array
    {
        $desk = $request->route()->defaults['desk'] ?? null;
        abort_unless(isset(LetterRegister::DESKS[$desk]) && isset(self::SEGMENT[$direction]), 404);

        return [$desk, self::SEGMENT[$direction]];
    }

    /** The entry must belong to this desk AND this register. */
    private function own(Request $request, string $direction, LetterRegister $entry): void
    {
        [$desk, $dir] = $this->resolve($request, $direction);
        abort_unless($entry->desk === $desk && $entry->direction === $dir, 404);
    }

    private function validated(Request $request): array
    {
        return $request->validate([
            'sender'      => 'required|string|max:255',
            'recipient'   => 'required|string|max:255',
            'memo_no'     => 'nullable|string|max:120',
            'letter_date' => 'required|date',
            'remarks'     => 'nullable|string|max:2000',
            'file'        => 'nullable|file|mimes:pdf,jpg,jpeg,png,webp|max:10240',
        ], [], [
            'sender' => 'প্রেরক (sender)', 'recipient' => 'প্রাপক (recipient)',
            'memo_no' => 'স্মারক নম্বর', 'letter_date' => 'তারিখ (date)',
        ]);
    }

    private function saveFile(Request $request, LetterRegister $entry): void
    {
        if (! $request->hasFile('file')) return;

        if ($entry->file_path) Storage::disk('local')->delete($entry->file_path);
        $file = $request->file('file');
        $entry->update([
            'file_path' => $file->store("letter-registers/{$entry->id}", 'local'),
            'file_name' => mb_substr($file->getClientOriginalName(), 0, 255),
        ]);
    }
}
