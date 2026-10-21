<?php

namespace App\Services;

use App\Models\OfficeNote;
use App\Models\OfficeNoteApproval;
use App\Models\Section;
use App\Models\User;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

/**
 * Who signs a note, in what order, and who may see it (BITAC, 2026-10-20).
 *
 *   IED / PCD notes:      প্রস্তুতকারী → নির্বাহী প্রকৌশলী → কেন্দ্র প্রধান
 *   every other dept:     প্রস্তুতকারী → নির্বাহী প্রকৌশলী → নির্বাহী প্রকৌশলী (পি.সি.ডি) → কেন্দ্র প্রধান
 *
 * i.e. every note except IED's and PCD's own goes to the centre head THROUGH
 * PCD. The centre head may write a comment; once they pass it the note is
 * `approved`, goes back to the department that wrote it, and prints.
 *
 * Who may sign a step (its POOL) is worked out when it is that step's turn, not
 * stored — so assigning someone a role takes effect on notes already waiting:
 *   - নির্বাহী প্রকৌশলী of IED / PCD → `Executive Engineer (IED)` / `(PCD)`;
 *     of a shop → its in-charge (ShopAssignment::xenIds — `assign shop-jobs`).
 *   - নির্বাহী প্রকৌশলী (পি.সি.ডি) → `Executive Engineer (PCD)`.
 *   - কেন্দ্র প্রধান → whoever holds `head notes` (the `Centre Head` role);
 *     ⚠️ until somebody does, `management` signs for the centre head.
 * Only people at the note's centre (or with no centre set) are in a pool.
 *
 * ⚠️ **A step with nobody to sign it is SKIPPED, with the reason shown** — the
 * PcdReleaseService rule: a gate with nobody behind it must not hold the work
 * up. A step whose signer IS the preparer is skipped too (they signed once
 * already, as the preparer).
 */
class NoteWorkflow
{
    public const LABELS = [
        'preparer' => ['bn' => 'প্রস্তুতকারী',               'en' => 'Prepared by'],
        'xen'      => ['bn' => 'নির্বাহী প্রকৌশলী',           'en' => 'Executive Engineer'],
        'pcd_xen'  => ['bn' => 'নির্বাহী প্রকৌশলী (পি.সি.ডি)', 'en' => 'Executive Engineer (PCD)'],
        'head'     => ['bn' => 'কেন্দ্র প্রধান',               'en' => 'Centre Head'],
    ];

    /** What prints after "বিভাগঃ" by default — editable on the note. */
    public const DEPARTMENT_BN = [
        'IED' => 'আই.ই.ডি', 'PCD' => 'পি.সি.ডি', 'MS' => 'মেশিন শপ', 'CNC' => 'সিএনসি',
        'CASTING' => 'ফাউন্ড্রি', 'QC' => 'কিউ.সি', 'STORES' => 'স্টোর',
    ];

    public static function departmentLabel(?Section $s): string
    {
        if (! $s) return '';
        return self::DEPARTMENT_BN[strtoupper((string) $s->code)] ?? $s->name;
    }

    /** IED and PCD sign among themselves; everyone else goes through PCD. */
    public static function isShortChain(?Section $s): bool
    {
        return in_array(strtoupper((string) $s?->code), ['IED', 'PCD'], true);
    }

    public static function sectionId(string $code): ?int
    {
        return Section::where('code', $code)->value('id');
    }

    /** The steps after the preparer, in order. */
    public static function stepsFor(OfficeNote $note): array
    {
        $note->loadMissing('section');
        $steps = [['step' => 'xen', 'section_id' => $note->section_id]];
        if (! self::isShortChain($note->section)) {
            $steps[] = ['step' => 'pcd_xen', 'section_id' => self::sectionId('PCD')];
        }
        $steps[] = ['step' => 'head', 'section_id' => null];

        return $steps;
    }

    /**
     * Who may sign this step of this note. ⚠️ Not stored — see the class doc.
     *
     * @return Collection<int, int>
     */
    public static function pool(OfficeNote $note, string $step, ?int $sectionId): Collection
    {
        $centre = $note->center_id;
        $atCentre = fn ($q) => $q->where('is_active', true)
            ->where(fn ($w) => $w->whereNull('center_id')->when($centre, fn ($x) => $x->orWhere('center_id', $centre)));
        $byRole = function (string $role) use ($atCentre) {
            try { return $atCentre(User::role($role))->pluck('id'); }
            catch (\Spatie\Permission\Exceptions\RoleDoesNotExist) { return collect(); }
        };

        $ids = match ($step) {
            'xen' => $sectionId ? collect(self::departmentHeadIds($sectionId, $centre)) : collect(),
            'pcd_xen' => $byRole('Executive Engineer (PCD)'),
            'head'    => (function () use ($atCentre, $byRole) {
                try { $heads = $atCentre(User::permission('head notes'))->pluck('id'); }
                catch (\Spatie\Permission\Exceptions\PermissionDoesNotExist) { $heads = collect(); }
                // ⚠️ Nobody is Centre Head yet → management signs for them.
                return $heads->isNotEmpty() ? $heads : $byRole('management');
            })(),
            default => collect(),
        };

        return $ids->map(fn ($id) => (int) $id)->unique()->values();
    }

    /**
     * The নির্বাহী প্রকৌশলী of a department, at a centre (or with no centre
     * set): IED / PCD by their Executive Engineer role, a shop by its
     * in-charge (`assign shop-jobs`). Empty for a department with none —
     * Stores and QC today. Also read by SectionChat (who may post a নির্দেশনা).
     *
     * @return int[]
     */
    public static function departmentHeadIds(int $sectionId, ?int $centre): array
    {
        $atCentre = fn ($q) => $q->where('is_active', true)
            ->where(fn ($w) => $w->whereNull('center_id')->when($centre, fn ($x) => $x->orWhere('center_id', $centre)));
        $code = strtoupper((string) Section::whereKey($sectionId)->value('code'));
        $role = ['IED' => 'Executive Engineer (IED)', 'PCD' => 'Executive Engineer (PCD)'][$code] ?? null;

        if ($role) {
            try { $q = User::role($role); }
            catch (\Spatie\Permission\Exceptions\RoleDoesNotExist) { return []; }
        } else {
            $q = User::whereIn('id', ShopAssignment::xenIds($sectionId) ?: [0]);
        }

        return $atCentre($q)->pluck('id')->map(fn ($id) => (int) $id)->all();
    }

    /** Is the head step being signed by management because nobody holds Centre Head? */
    public static function headIsStandIn(OfficeNote $note): bool
    {
        try {
            return User::permission('head notes')->where('is_active', true)
                ->where(fn ($w) => $w->whereNull('center_id')->orWhere('center_id', $note->center_id))
                ->doesntExist();
        } catch (\Throwable) {
            return true;
        }
    }

    // ── Moving a note ───────────────────────────────────────────────────

    /**
     * Send for signatures. The preparer's own default signature goes on
     * automatically; the chain is (re)built from scratch — a note sent back
     * and submitted again is a fresh decision for everybody.
     */
    public static function submit(OfficeNote $note, User $preparer): void
    {
        DB::transaction(function () use ($note, $preparer) {
            $note->approvals()->delete();

            foreach (self::stepsFor($note) as $i => $s) {
                $pool = self::pool($note, $s['step'], $s['section_id']);
                $row = ['office_note_id' => $note->id, 'level' => $i + 1, 'step' => $s['step'],
                        'section_id' => $s['section_id'], 'status' => 'pending'];

                // ⚠️ Assign, never `+=`: `+` keeps the existing 'status' key, so a
                // "skipped" step silently stayed pending and the note waited on
                // a step nobody could sign.
                if ($pool->isEmpty()) {
                    $row['status'] = 'skipped';
                    $row['skip_reason'] = self::nobodyReason($s['step']);
                } elseif ($pool->contains($preparer->id) && $s['step'] !== 'head') {
                    // The preparer IS this step's signer — they signed once already.
                    $row['status'] = 'skipped';
                    $row['skip_reason'] = 'Prepared by the same officer';
                }
                OfficeNoteApproval::create($row);
            }

            $note->update([
                'status'                  => 'pending',
                'submitted_at'            => now(),
                'approved_at'             => null,
                'preparer_signature_path' => $preparer->defaultSignature()?->path ?: $preparer->signature_path,
            ]);
        });

        self::advance($note->fresh(), $preparer);
    }

    public static function current(OfficeNote $note): ?OfficeNoteApproval
    {
        return $note->approvals()->where('status', 'pending')->orderBy('level')->first();
    }

    public static function canAct(?User $user, OfficeNote $note): bool
    {
        if (! $user || $note->status !== 'pending') return false;
        $step = self::current($note);

        return $step && self::pool($note, $step->step, $step->section_id)->contains($user->id);
    }

    public static function approve(OfficeNote $note, User $user, ?string $signaturePath, ?string $remarks): void
    {
        $step = self::current($note);
        $step->update([
            'status'         => 'approved',
            'acted_by'       => $user->id,
            'acted_at'       => now(),
            'remarks'        => $remarks ?: null,
            'signature_path' => $signaturePath ?: ($user->defaultSignature()?->path ?: $user->signature_path),
        ]);

        self::advance($note->fresh(), $user);
    }

    public static function sendBack(OfficeNote $note, User $user, string $remarks): void
    {
        self::current($note)?->update([
            'status' => 'returned', 'acted_by' => $user->id, 'acted_at' => now(), 'remarks' => $remarks,
        ]);
        $note->update(['status' => 'returned']);

        NotifyService::send(
            (int) $note->created_by, 'note_returned',
            'Note sent back: ' . $note->subject,
            "{$user->name} sent it back — {$remarks}",
            "/office-notes/{$note->id}", 'fi-rr-undo', 'amber',
        );
    }

    /** Tell the next step it is their turn — or, at the end, the preparer that it passed. */
    private static function advance(OfficeNote $note, User $actor): void
    {
        $next = self::current($note);

        if (! $next) {
            $note->update(['status' => 'approved', 'approved_at' => now()]);
            if ((int) $note->created_by !== $actor->id) {
                NotifyService::send(
                    (int) $note->created_by, 'note_approved',
                    'Note approved: ' . $note->subject,
                    'Signed by everyone in the chain — it is back with your department and can be printed.',
                    "/office-notes/{$note->id}", 'fi-rr-check-circle', 'green',
                );
            }
            return;
        }

        $pool = self::pool($note, $next->step, $next->section_id)->reject(fn ($id) => $id === $actor->id)->values();
        if ($pool->isNotEmpty()) {
            NotifyService::send(
                $pool->all(), 'note_awaiting_signature',
                'Note to sign: ' . $note->subject,
                ($note->department_name ? "বিভাগঃ {$note->department_name} · " : '')
                    . 'Waiting for your signature as ' . self::LABELS[$next->step]['en'] . '.',
                "/office-notes/{$note->id}", 'fi-rr-pen-clip', 'indigo',
            );
        }
    }

    private static function nobodyReason(string $step): string
    {
        return match ($step) {
            'xen'     => 'No Executive Engineer is assigned to this department',
            'pcd_xen' => 'Nobody holds the Executive Engineer (PCD) role',
            'head'    => 'Nobody holds the Centre Head role, and no management user is set',
            default   => 'Nobody to sign',
        };
    }

    // ── Who sees what ───────────────────────────────────────────────────

    /** Sees every note at the centre: super admin, the centre head (or stand-in), management. */
    public static function seesAll(User $u): bool
    {
        return $u->isSuperAdmin() || $u->can('head notes') || $u->hasRole('management');
    }

    /**
     * The departments a person writes notes for: where they are posted (a
     * bench counts as its shop), plus IED / PCD by the permissions that
     * define those desks — most staff have no `section_id` set.
     *
     * @return int[]
     */
    public static function departmentsOf(User $u): array
    {
        $ids = [];
        if ($u->section_id) {
            $s = Section::find($u->section_id);
            if ($s) $ids[] = (int) ($s->parent_id ?: $s->id);
        }
        if ($u->can('view rfqs') && ($id = self::sectionId('IED'))) $ids[] = $id;
        if (($u->can('view pcd-inbox') || $u->can('review pcd-inbox')) && ($id = self::sectionId('PCD'))) $ids[] = $id;

        return array_values(array_unique($ids));
    }

    /** The notes a person may open: their department's, their own, and any they sign. */
    public static function scopeVisible($query, User $u)
    {
        if (self::seesAll($u)) return $query;

        $depts = self::departmentsOf($u);

        return $query->where(fn ($w) => $w
            ->where('created_by', $u->id)
            ->when($depts, fn ($x) => $x->orWhereIn('section_id', $depts))
            ->orWhereHas('approvals', fn ($a) => $a->where('acted_by', $u->id))
            // Notes waiting on a step this person could sign.
            ->orWhereIn('office_notes.id', self::awaitingIds($u)));
    }

    public static function canSee(User $u, OfficeNote $note): bool
    {
        return self::seesAll($u)
            || (int) $note->created_by === $u->id
            || in_array((int) $note->section_id, self::departmentsOf($u), true)
            || $note->approvals()->where('acted_by', $u->id)->exists()
            || self::canAct($u, $note);
    }

    /**
     * Notes whose CURRENT step this person could sign. Pools are not stored,
     * so this walks the pending notes — a centre has tens of these, not
     * thousands.
     *
     * @return int[]
     */
    public static function awaitingIds(User $u): array
    {
        return OfficeNote::withoutGlobalScopes()->where('status', 'pending')->get()
            ->filter(fn (OfficeNote $n) => self::canAct($u, $n))
            ->pluck('id')->map(fn ($id) => (int) $id)->all();
    }
}
