<?php

namespace App\Services;

use App\Models\Center;
use App\Models\ChatMessage;
use App\Models\ChatRead;
use App\Models\Section;
use App\Models\User;
use Illuminate\Support\Collection;

/**
 * Who may read and write which chat (BITAC, 2026-10-21):
 *
 *   - **Common** — everyone at the centre reads and replies.
 *   - **A section's chat** — ONLY the people of that section. Nobody else sees
 *     it exists: not management, not the centre head, not another section.
 *
 * A person belongs to a section by where they are POSTED (`users.section_id`;
 * a bench counts as its shop) or by the role that IS that desk (ROLE_SECTIONS)
 * — most IED/PCD/QC/Stores staff have no `section_id` set, the same reason
 * NoteWorkflow::departmentsOf() reads permissions. Roles are used here rather
 * than permissions because `view rfqs` / `view qc` are also held by management,
 * and management is not a member of IED's chat.
 *
 * ⚠️ The super admin can open every chat — they administer the system, and a
 * moderation path has to exist. That is the one exception, and the members
 * list says so.
 *
 * A নির্দেশনা (instruction) is pinned at the top of its chat and notifies
 * every member. In a section it is posted by the section's নির্বাহী প্রকৌশলী
 * (NoteWorkflow::departmentHeadIds); in a section with nobody in that seat,
 * by any member — a gate with nobody behind it must not silence the section.
 * In the common chat, by the centre head (`head notes`) or management.
 *
 * Every chat is per CENTRE: sections are national, so Dhaka's CNC chat and
 * Chattogram's are told apart by `chat_messages.center_id`.
 */
class SectionChat
{
    public const COMMON = 'common';

    /** The desks a role IS, by section code. Shops are joined by posting. */
    public const ROLE_SECTIONS = [
        'IED'    => ['ied-officer', 'Executive Engineer (IED)', 'Estimator', 'sales-officer'],
        'PCD'    => ['pcd-officer', 'Executive Engineer (PCD)', 'Assistant Engineer (PCD)'],
        'QC'     => ['qc-inspector', 'qc-officer'],
        'STORES' => ['stores-officer', 'procurement-officer'],
    ];

    /** The centre whose chats this person is in. */
    public static function centreFor(User $u): ?int
    {
        $active = app()->bound('current_center_id') ? app('current_center_id') : null;

        return (int) ($active ?: $u->center_id ?: Center::defaultId()) ?: null;
    }

    /** @return int[] the sections whose chat this person belongs to */
    public static function sectionIdsOf(User $u): array
    {
        if ($u->isSuperAdmin()) {
            return Section::topLevel()->where('is_active', true)->pluck('id')->map(fn ($i) => (int) $i)->all();
        }

        $ids = [];
        if ($u->section_id && ($s = Section::find($u->section_id))) {
            $ids[] = (int) ($s->parent_id ?: $s->id);
        }
        $roles = $u->getRoleNames()->all();
        foreach (self::ROLE_SECTIONS as $code => $sectionRoles) {
            if (array_intersect($roles, $sectionRoles) && ($id = Section::where('code', $code)->value('id'))) {
                $ids[] = (int) $id;
            }
        }

        return array_values(array_unique($ids));
    }

    /** Normalise a channel key; null when it is not a chat at all. */
    public static function parse(string|int|null $channel): ?string
    {
        $channel = (string) $channel;
        if ($channel === self::COMMON) return self::COMMON;

        return ctype_digit($channel) && (int) $channel > 0 ? (string) (int) $channel : null;
    }

    public static function sectionOf(string $channel): ?int
    {
        return $channel === self::COMMON ? null : (int) $channel;
    }

    public static function canRead(User $u, string $channel): bool
    {
        return $channel === self::COMMON || in_array((int) $channel, self::sectionIdsOf($u), true);
    }

    /** May this person post a নির্দেশনা (or pin / unpin one) here? */
    public static function canInstruct(User $u, string $channel, ?int $centre): bool
    {
        if ($u->isSuperAdmin()) return true;
        if ($channel === self::COMMON) return $u->can('head notes') || $u->hasRole('management');
        if (! self::canRead($u, $channel)) return false;

        $heads = NoteWorkflow::departmentHeadIds((int) $channel, $centre);

        return $heads === [] || in_array($u->id, $heads, true);
    }

    /**
     * The people of a section at a centre — who can read its chat (plus the
     * super admin). Active accounts only, at the centre or with none set.
     *
     * @return Collection<int, User>
     */
    public static function members(string $channel, ?int $centre): Collection
    {
        $q = User::query()->where('is_active', true)
            ->where(fn ($w) => $w->whereNull('center_id')->when($centre, fn ($x) => $x->orWhere('center_id', $centre)));

        if ($channel === self::COMMON) return $q->orderBy('name')->get();

        $section = Section::find((int) $channel);
        if (! $section) return collect();

        $benches = Section::where('parent_id', $section->id)->pluck('id')->all();
        $roles = self::ROLE_SECTIONS[strtoupper((string) $section->code)] ?? [];

        return $q->where(fn ($w) => $w
                ->whereIn('section_id', array_merge([$section->id], $benches))
                ->when($roles, fn ($x) => $x->orWhereHas('roles', fn ($r) => $r->whereIn('name', $roles))))
            ->orderBy('name')->get();
    }

    /** Messages of one chat at one centre. */
    public static function query(string $channel, ?int $centre)
    {
        return ChatMessage::query()
            ->where('center_id', $centre)
            ->when($channel === self::COMMON,
                fn ($q) => $q->whereNull('section_id'),
                fn ($q) => $q->where('section_id', (int) $channel));
    }

    /**
     * The chats this person is in, each with its unread count and last message.
     *
     * @return array<int, array<string, mixed>>
     */
    public static function channelsFor(User $u, ?int $centre): array
    {
        $reads = ChatRead::where('user_id', $u->id)->where('center_id', $centre)
            ->pluck('last_read_id', 'channel');

        $sections = Section::whereIn('id', self::sectionIdsOf($u) ?: [0])->orderBy('id')->get();
        $list = [['key' => self::COMMON, 'name' => 'Common', 'name_bn' => 'সকলের জন্য', 'code' => null]];
        foreach ($sections as $s) {
            $list[] = ['key' => (string) $s->id, 'name' => $s->name,
                       'name_bn' => NoteWorkflow::DEPARTMENT_BN[strtoupper((string) $s->code)] ?? null,
                       'code' => $s->code];
        }

        return array_map(function (array $c) use ($u, $centre, $reads) {
            $base = fn () => self::query($c['key'], $centre)->whereNull('deleted_at');
            $last = $base()->with('user:id,name')->latest('id')->first();

            return $c + [
                'unread' => $base()->where('id', '>', (int) ($reads[$c['key']] ?? 0))
                    ->where(fn ($w) => $w->whereNull('user_id')->orWhere('user_id', '!=', $u->id))->count(),
                'last' => $last ? [
                    'who'  => $last->user?->name,
                    'text' => $last->body ? mb_strimwidth(trim(preg_replace('/\s+/u', ' ', $last->body)), 0, 70, '…')
                                          : ($last->files()->exists() ? '📎 File' : ''),
                    'at'   => $last->created_at?->toIso8601String(),
                ] : null,
            ];
        }, $list);
    }

    /** Total unread across this person's chats — the sidebar badge. */
    public static function unreadTotal(User $u): int
    {
        return array_sum(array_column(self::channelsFor($u, self::centreFor($u)), 'unread'));
    }

    public static function markRead(User $u, string $channel, ?int $centre, int $upTo): void
    {
        if ($upTo <= 0) return;
        $row = ChatRead::firstOrNew(['user_id' => $u->id, 'center_id' => $centre, 'channel' => $channel]);
        if ((int) $row->last_read_id < $upTo) {
            $row->last_read_id = $upTo;
            $row->save();
        }
    }

    public static function initials(?string $name): string
    {
        $parts = preg_split('/\s+/u', trim((string) $name)) ?: [];
        $parts = array_values(array_filter($parts, fn ($p) => ! in_array(rtrim($p, '.'), ['Md', 'Mohammad', 'Muhammad', 'মোঃ', 'মো'], true)));

        return mb_strtoupper(mb_substr($parts[0] ?? '?', 0, 1) . mb_substr($parts[1] ?? '', 0, 1));
    }

    /** One message as the page reads it. */
    public static function pack(ChatMessage $m, User $viewer, bool $canInstruct): array
    {
        $deleted = $m->deleted_at !== null;

        return [
            'id'             => $m->id,
            'channel'        => $m->channel,
            'body'           => $deleted ? null : $m->body,
            'deleted'        => $deleted,
            'is_instruction' => ! $deleted && $m->is_instruction,
            'created_at'     => $m->created_at?->toIso8601String(),
            'mine'           => (int) $m->user_id === $viewer->id,
            'user'           => [
                'id'          => $m->user_id,
                'name'        => $m->user?->name ?? 'Former staff',
                'designation' => $m->user?->designation,
                'avatar_url'  => $m->user?->avatar_url,
                'initials'    => self::initials($m->user?->name),
            ],
            'reply_to' => $m->replyTo ? [
                'id'      => $m->replyTo->id,
                'name'    => $m->replyTo->user?->name ?? 'Former staff',
                'excerpt' => $m->replyTo->deleted_at ? null
                    : mb_strimwidth((string) ($m->replyTo->body ?: '📎 File'), 0, 90, '…'),
            ] : null,
            'files' => $deleted ? [] : $m->files->map(fn ($f) => [
                'id'       => $f->id,
                'name'     => $f->original_name,
                'size'     => (int) $f->size,
                'is_image' => $f->isImage(),
                'url'      => route('chat.file', $f->id),
            ])->all(),
            'can_delete' => ! $deleted && ((int) $m->user_id === $viewer->id || $viewer->isSuperAdmin()),
            'can_pin'    => ! $deleted && $canInstruct,
        ];
    }

    public static function relations(): array
    {
        return ['user:id,name,designation,avatar_path', 'replyTo.user:id,name', 'files'];
    }
}
