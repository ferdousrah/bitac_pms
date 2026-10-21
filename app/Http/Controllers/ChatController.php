<?php

namespace App\Http\Controllers;

use App\Models\ChatMessage;
use App\Models\ChatMessageFile;
use App\Models\Section;
use App\Services\NotifyService;
use App\Services\SectionChat;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Inertia\Inertia;

/**
 * Section chats + the common chat. The rules live in App\Services\SectionChat;
 * this only checks them and moves messages. Everything after the first page
 * load is JSON over axios, polled every few seconds — there are no WebSockets
 * in this deployment (BROADCAST_CONNECTION=null), the same as the meeting room.
 */
class ChatController extends Controller
{
    private const PAGE = 50;

    public function index(Request $request)
    {
        return Inertia::render('Chat/Index', $this->state($request));
    }

    /**
     * The same state as JSON — what the floating chat window opens with, and
     * what either view loads when switching to another chat.
     */
    public function stateJson(Request $request): JsonResponse
    {
        return response()->json($this->state($request));
    }

    /** Unread across this person's chats — the floating button's badge while it is closed. */
    public function unread(Request $request): JsonResponse
    {
        return response()->json(['unread' => SectionChat::unreadTotal($request->user())]);
    }

    private function state(Request $request): array
    {
        $user = $request->user();
        $centre = SectionChat::centreFor($user);
        $channel = SectionChat::parse($request->query('c', SectionChat::COMMON)) ?? SectionChat::COMMON;
        // A chat this person is not in is not shown, nor said to exist.
        if (! SectionChat::canRead($user, $channel)) $channel = SectionChat::COMMON;

        $canInstruct = SectionChat::canInstruct($user, $channel, $centre);
        $rows = SectionChat::query($channel, $centre)->with(SectionChat::relations())
            ->latest('id')->limit(self::PAGE + 1)->get();
        $hasMore = $rows->count() > self::PAGE;
        $rows = $rows->take(self::PAGE)->reverse()->values();

        SectionChat::markRead($user, $channel, $centre, (int) ($rows->last()?->id ?? 0));

        return [
            'channels'    => SectionChat::channelsFor($user, $centre),
            'channel'     => $channel,
            'messages'    => $rows->map(fn ($m) => SectionChat::pack($m, $user, $canInstruct))->all(),
            'hasMore'     => $hasMore,
            'pinned'      => $this->pinned($channel, $centre, $user, $canInstruct),
            'canInstruct' => $canInstruct,
            'members'     => $this->members($channel, $centre),
            'serverTime'  => now()->toIso8601String(),
        ];
    }

    /** New messages after `after`, and any older ones changed since `since` (deleted, pinned). */
    public function poll(Request $request, string $channel): JsonResponse
    {
        [$user, $centre, $channel] = $this->resolve($request, $channel);
        $canInstruct = SectionChat::canInstruct($user, $channel, $centre);
        $after = (int) $request->query('after', 0);
        $since = $request->query('since');

        $new = SectionChat::query($channel, $centre)->with(SectionChat::relations())
            ->where('id', '>', $after)->orderBy('id')->limit(200)->get();
        $changed = $since
            ? SectionChat::query($channel, $centre)->with(SectionChat::relations())
                ->where('id', '<=', $after)->where('updated_at', '>=', \Carbon\Carbon::parse($since)->subSecond())->get()
            : collect();

        SectionChat::markRead($user, $channel, $centre, (int) ($new->last()?->id ?? 0));

        return response()->json([
            'messages'   => $new->map(fn ($m) => SectionChat::pack($m, $user, $canInstruct))->all(),
            'changed'    => $changed->map(fn ($m) => SectionChat::pack($m, $user, $canInstruct))->all(),
            'pinned'     => $this->pinned($channel, $centre, $user, $canInstruct),
            'channels'   => SectionChat::channelsFor($user, $centre),
            'serverTime' => now()->toIso8601String(),
        ]);
    }

    public function older(Request $request, string $channel): JsonResponse
    {
        [$user, $centre, $channel] = $this->resolve($request, $channel);
        $canInstruct = SectionChat::canInstruct($user, $channel, $centre);
        $rows = SectionChat::query($channel, $centre)->with(SectionChat::relations())
            ->where('id', '<', (int) $request->query('before', PHP_INT_MAX))
            ->latest('id')->limit(self::PAGE + 1)->get();

        return response()->json([
            'messages' => $rows->take(self::PAGE)->reverse()->values()
                ->map(fn ($m) => SectionChat::pack($m, $user, $canInstruct))->all(),
            'hasMore'  => $rows->count() > self::PAGE,
        ]);
    }

    public function store(Request $request, string $channel): JsonResponse
    {
        [$user, $centre, $channel] = $this->resolve($request, $channel);

        $data = $request->validate([
            'body'           => 'nullable|string|max:4000',
            'is_instruction' => 'nullable|boolean',
            'reply_to_id'    => 'nullable|integer',
            'files'          => 'nullable|array|max:5',
            'files.*'        => 'file|max:10240|mimes:jpg,jpeg,png,webp,gif,pdf,doc,docx,xls,xlsx,dwg,dxf,txt,csv',
        ]);
        $body = trim((string) ($data['body'] ?? ''));
        $files = $request->file('files', []);
        if ($body === '' && ! $files) {
            return response()->json(['message' => 'Type a message or attach a file.'], 422);
        }

        $instruction = (bool) ($data['is_instruction'] ?? false);
        if ($instruction && ! SectionChat::canInstruct($user, $channel, $centre)) {
            return response()->json(['message' => 'Only the head of this section can post an instruction.'], 403);
        }

        // A reply must point into the same chat, or a message id from another
        // section's chat would quote that chat's text into this one.
        $replyTo = ($data['reply_to_id'] ?? null)
            ? SectionChat::query($channel, $centre)->whereKey($data['reply_to_id'])->value('id')
            : null;

        $message = ChatMessage::create([
            'center_id'      => $centre,
            'section_id'     => SectionChat::sectionOf($channel),
            'user_id'        => $user->id,
            'body'           => $body !== '' ? $body : null,
            'is_instruction' => $instruction,
            'reply_to_id'    => $replyTo,
        ]);

        foreach ($files as $file) {
            // ⚠️ PRIVATE disk: a section's files are that section's. They are
            // served only through chat.file, which checks membership.
            $path = $file->store("chat/{$message->id}", 'local');
            $message->files()->create([
                'path'          => $path,
                'original_name' => mb_substr($file->getClientOriginalName(), 0, 250),
                'mime'          => $file->getMimeType(),
                'size'          => $file->getSize(),
            ]);
        }

        if ($instruction) $this->announce($message, $user);

        SectionChat::markRead($user, $channel, $centre, $message->id);
        $message->load(SectionChat::relations());

        return response()->json(['message' => SectionChat::pack($message, $user, SectionChat::canInstruct($user, $channel, $centre))]);
    }

    /** Remove a message — the author or the super admin. It stays as "message removed". */
    public function destroy(Request $request, ChatMessage $message): JsonResponse
    {
        $user = $this->guardMessage($request, $message);
        if ((int) $message->user_id !== $user->id && ! $user->isSuperAdmin()) {
            return response()->json(['message' => 'You can only remove your own messages.'], 403);
        }
        if (! $message->deleted_at) {
            foreach ($message->files as $f) Storage::disk('local')->delete($f->path);
            $message->files()->delete();
            $message->update(['deleted_at' => now(), 'deleted_by' => $user->id, 'is_instruction' => false]);
        }

        return response()->json(['ok' => true]);
    }

    /** Pin as a নির্দেশনা, or unpin. */
    public function pin(Request $request, ChatMessage $message): JsonResponse
    {
        $user = $this->guardMessage($request, $message);
        if (! SectionChat::canInstruct($user, $message->channel, $message->center_id)) {
            return response()->json(['message' => 'Only the head of this section can pin an instruction.'], 403);
        }
        if ($message->deleted_at) return response()->json(['message' => 'That message was removed.'], 422);

        $pinning = ! $message->is_instruction;
        $message->update(['is_instruction' => $pinning]);
        if ($pinning) $this->announce($message, $user);

        return response()->json(['ok' => true, 'is_instruction' => $pinning]);
    }

    public function file(Request $request, ChatMessageFile $file)
    {
        $message = $file->message;
        abort_unless($message && ! $message->deleted_at, 404);
        $this->guardMessage($request, $message);
        abort_unless(Storage::disk('local')->exists($file->path), 404);

        $inline = $file->isImage() || $file->mime === 'application/pdf';
        $name = str_replace(['"', "\r", "\n"], '', $file->original_name);

        return Storage::disk('local')->response($file->path, $name, [
            'Content-Type'           => $file->mime ?: 'application/octet-stream',
            'X-Content-Type-Options' => 'nosniff',
            'Content-Disposition'    => ($inline ? 'inline' : 'attachment') . '; filename="' . $name . '"',
        ]);
    }

    // ── helpers ─────────────────────────────────────────────────────────

    /** @return array{0: \App\Models\User, 1: ?int, 2: string} */
    private function resolve(Request $request, string $channel): array
    {
        $user = $request->user();
        $parsed = SectionChat::parse($channel);
        // 404, not 403: a section's chat is not said to exist to outsiders.
        abort_unless($parsed && SectionChat::canRead($user, $parsed), 404);

        return [$user, SectionChat::centreFor($user), $parsed];
    }

    private function guardMessage(Request $request, ChatMessage $message): \App\Models\User
    {
        $user = $request->user();
        abort_unless(
            (int) $message->center_id === (int) SectionChat::centreFor($user)
                && SectionChat::canRead($user, $message->channel),
            404
        );

        return $user;
    }

    private function pinned(string $channel, ?int $centre, $user, bool $canInstruct): array
    {
        return SectionChat::query($channel, $centre)->with(SectionChat::relations())
            ->where('is_instruction', true)->whereNull('deleted_at')
            ->latest('id')->limit(10)->get()
            ->map(fn ($m) => SectionChat::pack($m, $user, $canInstruct))->all();
    }

    private function members(string $channel, ?int $centre): array
    {
        $members = SectionChat::members($channel, $centre);

        return [
            'count' => $members->count(),
            // The common chat is everyone — listing the whole centre helps nobody.
            'list'  => $channel === SectionChat::COMMON ? [] : $members->map(fn ($u) => [
                'id'          => $u->id,
                'name'        => $u->name,
                'designation' => $u->designation,
                'initials'    => SectionChat::initials($u->name),
                'avatar_url'  => $u->avatar_url,
            ])->values()->all(),
        ];
    }

    /** A নির্দেশনা reaches every member's bell, not just whoever has the chat open. */
    private function announce(ChatMessage $message, $author): void
    {
        $channel = $message->channel;
        $ids = SectionChat::members($channel, $message->center_id)->pluck('id')
            ->map(fn ($i) => (int) $i)->reject(fn ($i) => $i === $author->id)->values()->all();
        if (! $ids) return;

        $where = $channel === SectionChat::COMMON ? 'Common' : (Section::find((int) $channel)?->name ?? 'section');
        NotifyService::send(
            $ids, 'chat_instruction',
            "Instruction · {$where}",
            $author->name . ': ' . mb_strimwidth((string) ($message->body ?: 'sent a file'), 0, 140, '…'),
            '/chat?c=' . $channel,
            'fi-rr-megaphone', 'amber',
        );
    }
}
