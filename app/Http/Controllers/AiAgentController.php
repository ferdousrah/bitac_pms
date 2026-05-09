<?php

namespace App\Http\Controllers;

use App\Models\AiConversation;
use App\Models\AiMessage;
use App\Services\AiAgent\GeminiChatService;
use App\Services\AiAgent\ToolRegistry as Tools;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class AiAgentController extends Controller
{
    public function __construct(private GeminiChatService $gemini) {}

    /**
     * GET /ai-agent/conversations — list user's conversations
     */
    public function conversations(Request $request): JsonResponse
    {
        $convos = AiConversation::where('user_id', $request->user()->id)
            ->orderByDesc('pinned')
            ->orderByDesc('last_message_at')
            ->limit(50)
            ->get(['id', 'title', 'pinned', 'last_message_at', 'created_at'])
            ->map(fn($c) => [
                'id'         => $c->id,
                'title'      => $c->title ?? 'New conversation',
                'pinned'     => $c->pinned,
                'updated_at' => $c->last_message_at?->diffForHumans() ?? $c->created_at->diffForHumans(),
            ]);

        return response()->json(['conversations' => $convos]);
    }

    /**
     * GET /ai-agent/conversations/{id}/messages — load conversation messages
     */
    public function messages(Request $request, int $id): JsonResponse
    {
        $convo = AiConversation::where('user_id', $request->user()->id)->findOrFail($id);

        $messages = $convo->messages->map(fn($m) => [
            'id'         => 'db-' . $m->id,
            'role'       => $m->role,
            'content'    => $m->content,
            'toolCalls'  => $m->tool_calls,
            'attachment'  => $m->attachment,
            'timestamp'  => $m->created_at->toIso8601String(),
        ]);

        return response()->json([
            'conversation_id' => $convo->id,
            'title'           => $convo->title,
            'messages'        => $messages,
        ]);
    }

    /**
     * POST /ai-agent/chat — send message (persisted)
     */
    public function chat(Request $request): JsonResponse
    {
        $request->validate([
            'message'         => 'required|string|max:2000',
            'conversation_id' => 'nullable|integer',
            'image'           => 'nullable|file|mimes:jpg,jpeg,png,webp,gif,pdf|max:10240',
        ]);

        $user    = $request->user();
        $message = $request->input('message');

        // Get or create conversation
        $convoId = $request->input('conversation_id');
        $convo   = $convoId
            ? AiConversation::where('user_id', $user->id)->find($convoId)
            : null;

        if (!$convo) {
            $convo = AiConversation::create([
                'user_id'         => $user->id,
                'last_message_at' => now(),
            ]);
        }

        // Handle image upload
        $imageData = null;
        if ($request->hasFile('image')) {
            $file = $request->file('image');
            $imageData = [
                'mime_type' => $file->getMimeType(),
                'base64'    => base64_encode(file_get_contents($file->getPathname())),
            ];
        }

        // Save user message
        AiMessage::create([
            'conversation_id' => $convo->id,
            'role'            => 'user',
            'content'         => $message,
            'attachment'      => $imageData ? ['type' => 'image', 'mime' => $imageData['mime_type']] : null,
        ]);

        // Load Gemini history from the conversation
        $history = $convo->gemini_history ?? [];
        $context = $this->buildContext($request);

        // Call Gemini (with image if provided)
        $result = $this->gemini->chat($history, $message, $context, $imageData);

        // Enrich tool calls with display names + preserve navigate_url
        $toolCalls = collect($result['tool_calls'])->map(fn($tc) => array_filter([
            'name'              => $tc['name'],
            'display_name'      => Tools::displayName($tc['name']),
            'navigate_url'      => $tc['navigate_url'] ?? null,
            'navigate_label'    => $tc['navigate_label'] ?? null,
            'presentation_url'  => $tc['presentation_url'] ?? null,
            'presentation_id'   => $tc['presentation_id'] ?? null,
        ]))->toArray();

        // Save assistant message
        AiMessage::create([
            'conversation_id' => $convo->id,
            'role'            => 'assistant',
            'content'         => $result['response'],
            'tool_calls'      => !empty($toolCalls) ? $toolCalls : null,
        ]);

        // Update conversation
        $convo->update([
            // Strip inline_data (images) from history before saving to prevent DB bloat
            'gemini_history'  => array_map(function ($entry) {
                if (isset($entry['parts'])) {
                    $entry['parts'] = array_values(array_filter($entry['parts'], fn($p) => !isset($p['inline_data'])));
                    if (empty($entry['parts'])) $entry['parts'] = [['text' => '[image]']];
                }
                return $entry;
            }, array_slice($result['history'], -40)),
            'last_message_at' => now(),
        ]);
        $convo->generateTitle();

        return response()->json([
            'conversation_id' => $convo->id,
            'title'           => $convo->title ?? 'New conversation',
            'response'        => $result['response'],
            'tool_calls'      => $toolCalls,
        ]);
    }

    /**
     * POST /ai-agent/stream — Simulated SSE streaming with persistence.
     *
     * Calls Gemini non-streaming (reliable), then streams the response
     * word-by-word back to the frontend for a typing effect.
     */
    public function stream(Request $request): \Symfony\Component\HttpFoundation\StreamedResponse
    {
        $request->validate([
            'message'         => 'required|string|max:2000',
            'conversation_id' => 'nullable|integer',
        ]);

        $user    = $request->user();
        $message = $request->input('message');
        $convoId = $request->input('conversation_id');

        // Get or create conversation
        $convo = $convoId ? AiConversation::where('user_id', $user->id)->find($convoId) : null;
        if (!$convo) {
            $convo = AiConversation::create(['user_id' => $user->id, 'last_message_at' => now()]);
        }

        // Save user message
        AiMessage::create(['conversation_id' => $convo->id, 'role' => 'user', 'content' => $message]);

        // Get the full response from Gemini (non-streaming — reliable)
        $history = $convo->gemini_history ?? [];
        $context = $this->buildContext($request);
        $result  = $this->gemini->chat($history, $message, $context);

        $fullText   = $result['response'];
        $toolCalls  = collect($result['tool_calls'])->map(fn($tc) => [
            'name'         => $tc['name'],
            'display_name' => Tools::displayName($tc['name']),
        ])->toArray();

        // Save assistant message
        AiMessage::create([
            'conversation_id' => $convo->id,
            'role'            => 'assistant',
            'content'         => $fullText,
            'tool_calls'      => !empty($toolCalls) ? $toolCalls : null,
        ]);
        $convo->update([
            'gemini_history'  => array_slice($result['history'], -40),
            'last_message_at' => now(),
        ]);
        $convo->generateTitle();

        $convoId    = $convo->id;
        $convoTitle = $convo->title;

        return response()->stream(function () use ($fullText, $toolCalls, $convoId, $convoTitle) {
            // Kill all output buffers so flush() actually sends data
            while (ob_get_level()) ob_end_clean();

            // Send tool calls first (if any)
            if (!empty($toolCalls)) {
                $this->sse('tools', json_encode(array_column($toolCalls, 'display_name')));
                usleep(300_000); // 300ms pause so the user sees the tool indicator
            }

            // Stream the response word-by-word for typing effect
            // Split by words but keep markdown structure (newlines, bullets, etc.)
            $chunks = preg_split('/([\s,.:;!?]+)/', $fullText, -1, PREG_SPLIT_DELIM_CAPTURE | PREG_SPLIT_NO_EMPTY);
            $buffer = '';
            $wordCount = 0;

            foreach ($chunks as $chunk) {
                $buffer .= $chunk;
                $wordCount++;

                // Send every 1-3 words for a natural typing cadence
                $flushEvery = strlen($fullText) > 500 ? 3 : (strlen($fullText) > 200 ? 2 : 1);

                if ($wordCount >= $flushEvery || str_contains($chunk, "\n")) {
                    $this->sse('text', $buffer);
                    $buffer = '';
                    $wordCount = 0;

                    // Typing speed: ~30-50ms per word group (feels natural)
                    usleep(rand(20_000, 45_000));
                }
            }

            // Flush remaining buffer
            if ($buffer !== '') {
                $this->sse('text', $buffer);
            }

            // Send done event
            $this->sse('done', json_encode([
                'conversation_id' => $convoId,
                'tool_calls'      => $toolCalls,
                'title'           => $convoTitle,
            ]));

        }, 200, [
            'Content-Type'      => 'text/event-stream',
            'Cache-Control'     => 'no-cache, no-store',
            'Connection'        => 'keep-alive',
            'X-Accel-Buffering' => 'no',
        ]);
    }

    private function sse(string $event, string $data): void
    {
        echo "event: {$event}\ndata: {$data}\n\n";
        flush();
    }

    /**
     * POST /ai-agent/conversations/{id}/pin — toggle pin
     */
    public function togglePin(Request $request, int $id): JsonResponse
    {
        $convo = AiConversation::where('user_id', $request->user()->id)->findOrFail($id);
        $convo->update(['pinned' => !$convo->pinned]);
        return response()->json(['pinned' => $convo->pinned]);
    }

    /**
     * POST /ai-agent/conversations/{id}/rename
     */
    public function rename(Request $request, int $id): JsonResponse
    {
        $request->validate(['title' => 'required|string|max:255']);
        $convo = AiConversation::where('user_id', $request->user()->id)->findOrFail($id);
        $convo->update(['title' => $request->input('title')]);
        return response()->json(['title' => $convo->title]);
    }

    /**
     * DELETE /ai-agent/conversations/{id}
     */
    public function deleteConversation(Request $request, int $id): JsonResponse
    {
        $convo = AiConversation::where('user_id', $request->user()->id)->findOrFail($id);
        $convo->delete();
        return response()->json(['status' => 'ok']);
    }

    /**
     * POST /ai-agent/reset — create a new conversation (doesn't delete old ones)
     */
    public function reset(Request $request): JsonResponse
    {
        return response()->json(['status' => 'ok', 'conversation_id' => null]);
    }

    private function buildContext(Request $request): array
    {
        $user   = $request->user();
        $center = app()->bound('current_center_id')
            ? \App\Models\Center::find(app('current_center_id'))
            : null;

        return [
            'role'   => $user?->roles->first()?->name ?? 'staff',
            'center' => $center?->name ?? 'All Centers',
        ];
    }
}
