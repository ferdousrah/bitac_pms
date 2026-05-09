<?php

namespace App\Http\Controllers;

use App\Models\Meeting;
use App\Models\MeetingActionItem;
use App\Models\MeetingDecision;
use App\Models\MeetingMessage;
use App\Models\MeetingParticipant;
use App\Services\AiAgent\GeminiChatService;
use App\Services\AiAgent\ToolRegistry;
use App\Services\MeetingIntelligenceService;
use App\Services\PptxParser;
use Illuminate\Http\Request;
use Inertia\Inertia;

class MeetingController extends Controller
{
    /* ─── Index: list meetings ──────────────────────────────────────── */
    public function index(Request $request)
    {
        $query = Meeting::with(['host:id,name', 'onlineParticipants.user:id,name'])
            ->withCount('participants')
            ->latest();

        if ($search = $request->input('search')) {
            $query->where(fn ($q) =>
                $q->where('title', 'like', "%{$search}%")
                  ->orWhere('meeting_code', 'like', "%{$search}%")
                  ->orWhere('topic', 'like', "%{$search}%")
            );
        }

        if ($status = $request->input('status')) {
            $query->where('status', $status);
        }

        return Inertia::render('Meetings/Index', [
            'meetings' => $query->paginate(12)->withQueryString(),
            'filters'  => $request->only(['search', 'status']),
        ]);
    }

    /* ─── Create meeting ──────────────────────────────────────────── */
    public function store(Request $request)
    {
        $data = $request->validate([
            'title' => 'required|string|max:255',
            'topic' => 'nullable|string|max:1000',
        ]);

        $meeting = Meeting::create([
            ...$data,
            'host_user_id' => auth()->id(),
            'status'       => 'waiting',
        ]);

        // Host auto-joins
        MeetingParticipant::create([
            'meeting_id' => $meeting->id,
            'user_id'    => auth()->id(),
            'role'       => 'host',
            'is_online'  => true,
            'joined_at'  => now(),
        ]);

        // System message
        MeetingMessage::create([
            'meeting_id'   => $meeting->id,
            'sender_type'  => 'system',
            'content'      => auth()->user()->name . ' created the meeting.',
            'message_type' => 'system',
        ]);

        // Oli welcome
        MeetingMessage::create([
            'meeting_id'   => $meeting->id,
            'sender_type'  => 'ai',
            'content'      => "Hello everyone! I'm **Oli**, your AI assistant in this meeting. I can:\n\n- 📊 Present data live on the shared screen\n- 💬 Answer questions about production, finance, quality\n- 📝 Take meeting notes automatically\n- 🔧 Run system queries in real-time\n\nJust start your message with \"Oli\" and I'll respond. Try: **\"Oli, present the production report\"** — the slide will appear on the shared screen and I'll narrate it aloud.",
            'message_type' => 'chat',
        ]);

        return redirect("/meetings/{$meeting->id}");
    }

    /* ─── Show: meeting room ──────────────────────────────────────── */
    public function show(Meeting $meeting)
    {
        // Auto-join if not already a participant
        $participant = MeetingParticipant::where('meeting_id', $meeting->id)
            ->where('user_id', auth()->id())
            ->first();

        if (!$participant) {
            MeetingParticipant::create([
                'meeting_id' => $meeting->id,
                'user_id'    => auth()->id(),
                'role'       => 'participant',
                'is_online'  => true,
                'joined_at'  => now(),
            ]);

            MeetingMessage::create([
                'meeting_id'   => $meeting->id,
                'sender_type'  => 'system',
                'content'      => auth()->user()->name . ' joined the meeting.',
                'message_type' => 'system',
            ]);
        } else {
            $participant->update(['is_online' => true, 'left_at' => null]);
        }

        $meeting->load([
            'host:id,name',
            'participants.user:id,name',
        ]);

        $messages = $meeting->messages()
            ->with('user:id,name')
            ->orderBy('created_at')
            ->limit(200)
            ->get()
            ->map(fn ($m) => [
                'id'          => $m->id,
                'sender_type' => $m->sender_type,
                'sender_name' => $m->sender_type === 'user' ? ($m->user->name ?? 'Unknown') : ($m->sender_type === 'ai' ? 'Oli' : 'System'),
                'user_id'     => $m->user_id,
                'content'     => $m->content,
                'message_type'=> $m->message_type,
                'metadata'    => $m->metadata,
                'created_at'  => $m->created_at->toIso8601String(),
            ]);

        // Load action items & decisions
        $actionItems = $meeting->actionItems()
            ->with('assignedTo:id,name')
            ->latest()
            ->get()
            ->map(fn ($a) => [
                'id'                 => $a->id,
                'description'        => $a->description,
                'assigned_to_user_id'=> $a->assigned_to_user_id,
                'assigned_to_name'   => $a->assignedTo?->name ?? $a->assigned_to_name,
                'due_date'           => $a->due_date?->format('Y-m-d'),
                'status'             => $a->status,
                'priority'           => $a->priority,
                'context'            => $a->context,
                'completed_at'       => $a->completed_at?->toIso8601String(),
                'created_at'         => $a->created_at->toIso8601String(),
            ]);

        $decisions = $meeting->decisions()
            ->with('decidedBy:id,name')
            ->latest()
            ->get()
            ->map(fn ($d) => [
                'id'                => $d->id,
                'description'       => $d->description,
                'context'           => $d->context,
                'decided_by_user_id'=> $d->decided_by_user_id,
                'decided_by_name'   => $d->decidedBy?->name ?? $d->decided_by_name,
                'created_at'        => $d->created_at->toIso8601String(),
            ]);

        return Inertia::render('Meetings/Room', [
            'meeting'      => $meeting,
            'messages'     => $messages,
            'participants' => $meeting->participants->map(fn ($p) => [
                'id'        => $p->id,
                'user_id'   => $p->user_id,
                'name'      => $p->user->name ?? 'Unknown',
                'role'      => $p->role,
                'is_online' => $p->is_online,
            ]),
            'actionItems'  => $actionItems,
            'decisions'    => $decisions,
            'currentUserId' => auth()->id(),
        ]);
    }

    /* ─── Join via code ───────────────────────────────────────────── */
    public function join(Request $request)
    {
        $code = strtoupper(str_replace(' ', '', $request->input('code', '')));
        $meeting = Meeting::where('meeting_code', $code)
            ->whereIn('status', ['waiting', 'active'])
            ->first();

        if (!$meeting) {
            return back()->withErrors(['code' => 'Meeting not found or already ended.']);
        }

        return redirect("/meetings/{$meeting->id}");
    }

    /* ─── Send message ────────────────────────────────────────────── */
    public function sendMessage(Request $request, Meeting $meeting)
    {
        $data = $request->validate([
            'content'      => 'nullable|string|max:5000',
            'image'        => 'nullable|file|mimes:jpeg,png,jpg,gif,webp,pdf,pptx,ppt|max:20480',
            'share_screen' => 'nullable|boolean',
        ]);

        $content = $data['content'] ?? '';
        $imageData = null;
        $attachmentMeta = null;
        $pptxSlides = null; // parsed PowerPoint slides

        // Handle image/file upload
        if ($request->hasFile('image')) {
            $file = $request->file('image');
            $mime = $file->getMimeType();
            $ext = strtolower($file->getClientOriginalExtension());

            // Store file publicly for display/download
            $filename = 'meeting_' . $meeting->id . '_' . uniqid() . '.' . $ext;
            \Storage::disk('public')->putFileAs('meeting-uploads', $file, $filename);
            $url = url('/storage/meeting-uploads/' . $filename);

            // Determine type
            $type = str_starts_with($mime, 'image/') ? 'image'
                   : ($ext === 'pptx' || $ext === 'ppt' ? 'pptx' : 'pdf');

            $attachmentMeta = [
                'type' => $type,
                'mime' => $mime,
                'url'  => $url,
                'name' => $file->getClientOriginalName(),
                'shared_to_screen' => (bool) ($data['share_screen'] ?? false),
            ];

            // For PPTX: parse slides and push to shared screen
            if ($type === 'pptx') {
                $parser = app(PptxParser::class);
                $parsed = $parser->parse(\Storage::disk('public')->path("meeting-uploads/{$filename}"));
                if (!empty($parsed['slides'])) {
                    $pptxSlides = $parsed['slides'];
                    // Add "shared by" attribution to the first slide
                    $pptxSlides[0]['title'] = ($pptxSlides[0]['title'] ?? 'Shared Presentation') . ' (shared by ' . auth()->user()->name . ')';
                    $attachmentMeta['slide_count'] = count($pptxSlides);
                    $attachmentMeta['shared_to_screen'] = true; // PPTX always goes to shared screen
                }
            }

            // For images and PDFs: prepare Gemini multimodal data
            if ($type === 'image' || $type === 'pdf') {
                $imageData = [
                    'mime_type' => $mime,
                    'base64'    => base64_encode(file_get_contents($file->getPathname())),
                ];
            }

            if (empty($content)) {
                $content = match ($type) {
                    'image' => '[Shared an image]',
                    'pdf'   => '[Shared a PDF document]',
                    'pptx'  => '[Shared a PowerPoint presentation: ' . $file->getClientOriginalName() . ']',
                    default => '[Shared a file]',
                };
            }
        }

        if (empty($content) && !$attachmentMeta) {
            return response()->json(['error' => 'Message or file is required'], 422);
        }

        $msg = MeetingMessage::create([
            'meeting_id'   => $meeting->id,
            'user_id'      => auth()->id(),
            'sender_type'  => 'user',
            'content'      => $content,
            'message_type' => 'chat',
            'metadata'     => $attachmentMeta ? ['attachment' => $attachmentMeta] : null,
        ]);

        // Push to shared screen
        if ($attachmentMeta && ($attachmentMeta['shared_to_screen'] ?? false)) {
            $currentState = $meeting->presentation_state ?? ['slides' => [], 'current_index' => 0];
            $existingSlides = $currentState['slides'] ?? [];

            if ($attachmentMeta['type'] === 'image') {
                $existingSlides[] = [
                    'title' => 'Shared by ' . auth()->user()->name,
                    'image_url' => $attachmentMeta['url'],
                    'body' => $content !== '[Shared an image]' ? $content : null,
                    'shared_by' => auth()->user()->name,
                    'layout' => 'image',
                    'speaker_notes' => '',
                ];
            } elseif ($attachmentMeta['type'] === 'pptx' && $pptxSlides) {
                // Push ALL parsed PPTX slides to shared screen
                foreach ($pptxSlides as $slide) {
                    $slide['shared_by'] = auth()->user()->name;
                    $existingSlides[] = $slide;
                }
            }

            $newFirstIndex = count($currentState['slides'] ?? []);
            $meeting->update([
                'presentation_state' => [
                    'slides'        => $existingSlides,
                    'current_index' => $newFirstIndex, // Start at the first newly-added slide
                    'updated_at'    => now()->toIso8601String(),
                ],
            ]);
        }

        $response = [
            'message' => [
                'id'          => $msg->id,
                'sender_type' => 'user',
                'sender_name' => auth()->user()->name,
                'user_id'     => auth()->id(),
                'content'     => $content,
                'message_type'=> 'chat',
                'metadata'    => $msg->metadata,
                'created_at'  => $msg->created_at->toIso8601String(),
            ],
        ];

        // Check if message is directed at Oli
        $lowContent = strtolower($content);
        $isForOli = str_starts_with($lowContent, 'oli') ||
                    str_starts_with($lowContent, '@oli') ||
                    str_contains($lowContent, '@oli') ||
                    str_contains($lowContent, 'present') ||
                    // Auto-respond to questions in active meetings
                    (str_contains($lowContent, '?') && $meeting->status === 'active') ||
                    // If image/pdf was shared, Oli should respond (he can see it!)
                    ($attachmentMeta !== null);

        // If PPTX was uploaded, include text summary for Oli
        $pptxTextSummary = null;
        if ($pptxSlides) {
            $pptxTextSummary = app(PptxParser::class)->toTextSummary($pptxSlides);
        }

        if ($isForOli) {
            $oliResponse = $this->askOli($meeting, $content, $imageData, $attachmentMeta, $pptxTextSummary);
            $response['oli_response'] = $oliResponse;
        }

        // Trigger async intelligence analysis every 5 messages
        if ($meeting->messages()->count() % 5 === 0) {
            try {
                app(MeetingIntelligenceService::class)->analyzeRecentMessages($meeting, 12);
            } catch (\Throwable $e) {
                \Log::warning('Live intelligence analysis skipped: ' . $e->getMessage());
            }
        }

        return response()->json($response);
    }

    /* ─── Update voice activity status ─────────────────────────── */
    public function voiceActivity(Request $request, Meeting $meeting)
    {
        $isSpeaking = $request->boolean('is_speaking');
        $key = "meeting:{$meeting->id}:speaking:" . auth()->id();
        if ($isSpeaking) {
            cache()->put($key, auth()->user()->name, now()->addSeconds(10));
        } else {
            cache()->forget($key);
        }
        return response()->json(['ok' => true]);
    }

    /* ─── WebRTC Signaling: Send a signal to another peer ────────── */
    public function sendSignal(Request $request, Meeting $meeting)
    {
        $data = $request->validate([
            'to_user_id' => 'required|integer|exists:users,id',
            'type'       => 'required|in:offer,answer,ice,bye,join-request,join-response',
            'payload'    => 'required',
        ]);

        $key = "meeting:{$meeting->id}:signals:{$data['to_user_id']}";
        $signals = cache()->get($key, []);
        $signals[] = [
            'from_user_id' => auth()->id(),
            'from_name'    => auth()->user()->name,
            'type'         => $data['type'],
            'payload'      => $data['payload'],
            'timestamp'    => now()->toIso8601String(),
        ];
        // Keep signals for 30 seconds (ICE candidates should be fetched quickly)
        cache()->put($key, $signals, now()->addSeconds(30));

        return response()->json(['ok' => true]);
    }

    /* ─── WebRTC Signaling: Poll for pending signals ─────────────── */
    public function pollSignals(Meeting $meeting)
    {
        $key = "meeting:{$meeting->id}:signals:" . auth()->id();
        $signals = cache()->pull($key, []); // pull = get + delete

        // Who's currently in the audio call
        $callKey = "meeting:{$meeting->id}:call_participants";
        $callParticipants = cache()->get($callKey, []);

        return response()->json([
            'signals'           => $signals,
            'call_participants' => array_values($callParticipants),
        ]);
    }

    /* ─── WebRTC: Join audio call ────────────────────────────────── */
    public function joinCall(Meeting $meeting)
    {
        $key = "meeting:{$meeting->id}:call_participants";
        $participants = cache()->get($key, []);
        $participants[auth()->id()] = [
            'user_id'   => auth()->id(),
            'name'      => auth()->user()->name,
            'joined_at' => now()->toIso8601String(),
        ];
        cache()->put($key, $participants, now()->addHours(4));

        return response()->json([
            'ok'           => true,
            'participants' => array_values($participants),
        ]);
    }

    /* ─── WebRTC: Leave audio call ───────────────────────────────── */
    public function leaveCall(Meeting $meeting)
    {
        $key = "meeting:{$meeting->id}:call_participants";
        $participants = cache()->get($key, []);
        unset($participants[auth()->id()]);
        cache()->put($key, $participants, now()->addHours(4));

        // Clear any pending signals for this user
        cache()->forget("meeting:{$meeting->id}:signals:" . auth()->id());

        return response()->json(['ok' => true]);
    }

    /* ─── Poll for new messages ──────────────────────────────────── */
    public function poll(Request $request, Meeting $meeting)
    {
        $since = $request->input('since'); // ISO timestamp or message ID
        $sinceId = $request->input('since_id', 0);

        // Update user's online status
        MeetingParticipant::where('meeting_id', $meeting->id)
            ->where('user_id', auth()->id())
            ->update(['is_online' => true]);

        // Mark users who haven't polled in 15s as offline
        MeetingParticipant::where('meeting_id', $meeting->id)
            ->where('user_id', '!=', auth()->id())
            ->where('updated_at', '<', now()->subSeconds(15))
            ->where('is_online', true)
            ->update(['is_online' => false]);

        $query = $meeting->messages()->with('user:id,name');

        if ($sinceId > 0) {
            $query->where('id', '>', $sinceId);
        } elseif ($since) {
            $query->where('created_at', '>', $since);
        }

        $messages = $query->orderBy('created_at')->limit(50)->get()
            ->map(fn ($m) => [
                'id'          => $m->id,
                'sender_type' => $m->sender_type,
                'sender_name' => $m->sender_type === 'user' ? ($m->user->name ?? 'Unknown') : ($m->sender_type === 'ai' ? 'Oli' : 'System'),
                'user_id'     => $m->user_id,
                'content'     => $m->content,
                'message_type'=> $m->message_type,
                'metadata'    => $m->metadata,
                'created_at'  => $m->created_at->toIso8601String(),
            ]);

        // Current participants
        $participants = $meeting->participants()
            ->with('user:id,name')
            ->get();

        // Check who's currently speaking (via cache)
        $speakingUsers = [];
        foreach ($participants as $p) {
            $key = "meeting:{$meeting->id}:speaking:{$p->user_id}";
            if (cache()->has($key)) {
                $speakingUsers[] = $p->user_id;
            }
        }

        $participantData = $participants->map(fn ($p) => [
            'id'          => $p->id,
            'user_id'     => $p->user_id,
            'name'        => $p->user->name ?? 'Unknown',
            'role'        => $p->role,
            'is_online'   => $p->is_online,
            'is_speaking' => in_array($p->user_id, $speakingUsers),
        ]);

        // Action items & decisions (latest updates)
        $actionItems = $meeting->actionItems()->with('assignedTo:id,name')->latest()->get()
            ->map(fn ($a) => [
                'id'                 => $a->id,
                'description'        => $a->description,
                'assigned_to_user_id'=> $a->assigned_to_user_id,
                'assigned_to_name'   => $a->assignedTo?->name ?? $a->assigned_to_name,
                'due_date'           => $a->due_date?->format('Y-m-d'),
                'status'             => $a->status,
                'priority'           => $a->priority,
                'context'            => $a->context,
                'completed_at'       => $a->completed_at?->toIso8601String(),
                'created_at'         => $a->created_at->toIso8601String(),
            ]);

        $decisions = $meeting->decisions()->with('decidedBy:id,name')->latest()->get()
            ->map(fn ($d) => [
                'id'                => $d->id,
                'description'       => $d->description,
                'context'           => $d->context,
                'decided_by_user_id'=> $d->decided_by_user_id,
                'decided_by_name'   => $d->decidedBy?->name ?? $d->decided_by_name,
                'created_at'        => $d->created_at->toIso8601String(),
            ]);

        return response()->json([
            'messages'           => $messages,
            'participants'       => $participantData,
            'presentation_state' => $meeting->fresh()->presentation_state,
            'status'             => $meeting->fresh()->status,
            'speaking_users'     => $speakingUsers,
            'action_items'       => $actionItems,
            'decisions'          => $decisions,
        ]);
    }

    /* ─── Ask Oli (AI participant) ────────────────────────────────── */
    private function askOli(Meeting $meeting, string $userMessage, ?array $imageData = null, ?array $attachmentMeta = null, ?string $pptxTextSummary = null): array
    {
        $participants = $meeting->participants()->with('user:id,name')->get()
            ->map(fn ($p) => $p->user->name)->implode(', ');

        // Get recent chat context (last 20 messages)
        $recentChat = $meeting->messages()
            ->with('user:id,name')
            ->latest()
            ->limit(20)
            ->get()
            ->reverse()
            ->map(fn ($m) => $m->sender_type === 'user'
                ? ($m->user->name ?? 'User') . ': ' . $m->content
                : ($m->sender_type === 'ai' ? 'Oli: ' . $m->content : '[System] ' . $m->content)
            )->implode("\n");

        $systemContext = [
            '[MEETING ROOM MODE — You are Oli, an AI participant in a live meeting]',
            "Meeting: \"{$meeting->title}\"",
            "Topic: " . ($meeting->topic ?: 'General'),
            "Participants: {$participants}",
            "Status: {$meeting->status}",
            '',
            'MEETING CONTEXT (recent discussion):',
            $recentChat,
            '',
            'CRITICAL — HOW THIS MEETING ROOM WORKS:',
            '- You are IN a meeting room. There is a SHARED SCREEN visible to all participants.',
            '- When you include a [SLIDE] block, it appears INSTANTLY on the shared screen for everyone to see.',
            '- There is NO "button to click" — slides appear automatically when you generate them.',
            '- DO NOT say things like "click the button below", "click to start presentation", or "launch the presentation".',
            '- Instead say: "Here it is on the shared screen", "Let me show you...", "As you can see on the screen..."',
            '',
            'SELF-INTRODUCTION (when someone asks "Oli, introduce yourself", "show your capabilities", "who are you", "give a demo", "tell us about yourself", OR in Bangla: "নিজের পরিচয় দাও", "আপনার পরিচয় দিন", "তুমি কে"):',
            '- Use the `oli_introduction` tool — it loads a pre-built 10-slide professional introduction onto the shared screen',
            '- **LANGUAGE**: If user writes in Bangla (বাংলা), pass `language="bn"` to the tool. Otherwise pass `language="en"`.',
            '- After the tool runs in English, say: "Hello everyone! I\'ve prepared a proper introduction for you. Let me walk you through my capabilities on the shared screen."',
            '- After the tool runs in Bangla, say: "সবাইকে শুভেচ্ছা! আমি শেয়ার্ড স্ক্রিনে আমার পূর্ণ পরিচয় তুলে ধরছি। আসুন আমি আমার সামর্থ্যগুলো আপনাদের দেখাই।"',
            '- Do NOT try to [SLIDE] this yourself — the tool is specifically designed for this.',
            '',
            'INSTRUCTIONS:',
            '- You are a meeting participant, not just a chatbot. Be collaborative and professional.',
            '- Address people by name when relevant.',
            '- Keep text responses concise (2-5 sentences). The SLIDE carries the detailed data.',
            '- USE YOUR TOOLS freely — fetch production stats, financials, work orders, etc.',
            '- When asked to present ANYTHING, you MUST:',
            '  1. Call the relevant data tool (production_monitor, finance_analyst, etc.)',
            '  2. Return a [SLIDE] JSON block with the data (will appear on shared screen)',
            '  3. Write a short conversational intro in your text response',
            '',
            'SLIDE JSON FORMAT (required when presenting):',
            '[SLIDE]{"title":"Slide Title","kpis":[{"label":"Revenue","value":"৳12.5L","trend":"up","color":"#10b981"}],"bullets":["Point 1","Point 2"],"chart":{"type":"bar","title":"Chart Title","data":[{"label":"Jan","value":100}]},"table":{"headers":["Col1","Col2"],"rows":[{"Col1":"val","Col2":"val"}]},"speaker_notes":"What Oli says aloud"}[/SLIDE]',
            '',
            '- Always include: title and speaker_notes.',
            '- Include relevant: kpis, bullets, chart, table.',
            '- For financial data: use kpis + chart (bar or pie)',
            '- For lists/status: use bullets or table',
            '- For trends: use chart (line)',
            '- The speaker_notes will be spoken aloud via text-to-speech — write conversationally.',
            '',
            'EXAMPLE RESPONSE when asked "Present production report":',
            'Text: "Sure! Here is this month\'s production overview on the shared screen."',
            '[SLIDE]{"title":"Production Report - April 2026","kpis":[{"label":"Active Jobs","value":"23","trend":"up"},{"label":"Completed","value":"47","trend":"up","color":"#10b981"},{"label":"Overdue","value":"3","trend":"down","color":"#ef4444"}],"bullets":["23 active work orders in production","47 jobs completed this month","3 overdue jobs need attention"],"speaker_notes":"Here is our production overview for April. We currently have 23 active work orders in production, and we have completed 47 jobs this month, which is a great result. However, we have 3 overdue jobs that need immediate attention."}[/SLIDE]',
            '',
            '- When you detect action items or decisions, note them with [ACTION] prefix.',
            '- Be proactive: if someone mentions a topic you have data on, offer to show it.',
        ];

        try {
            $gemini = app(GeminiChatService::class);
            $context = [
                'role'   => 'staff',
                'center' => 'All Centers',
            ];
            $history = [];
            // Add attachment context if present
            $promptText = implode("\n", $systemContext) . "\n\nUser says: " . $userMessage;
            if ($attachmentMeta) {
                if ($attachmentMeta['type'] === 'pptx' && $pptxTextSummary) {
                    $promptText .= "\n\n[SHARED POWERPOINT FILE: \"{$attachmentMeta['name']}\"]";
                    $promptText .= "\nThe user has shared a PowerPoint presentation. The slides have been displayed on the shared screen for all participants to see. Here's the extracted content of every slide:\n\n";
                    $promptText .= $pptxTextSummary;
                    $promptText .= "\n[End of PowerPoint content]\n\nSummarize what the presentation is about, highlight key points, and answer any question the user asked. Be conversational — you're presenting to the team.";
                } else {
                    $fileType = $attachmentMeta['type'] === 'pdf' ? 'PDF document' : 'image/screenshot';
                    $promptText .= "\n\n[NOTE: The user has shared a {$fileType} with this message. You can see it. Describe what you see, extract relevant info, and respond to their question in context of the shared content.]";
                }
            }

            $result = $gemini->chat($history, $promptText, $context, $imageData);

            $oliText = $result['response'] ?? "I'm here! How can I help with the meeting?";

            // Extract slide data if present
            $slideData = null;
            $slideMatch = null;
            if (preg_match('/\[SLIDE\](.*?)\[\/SLIDE\]/s', $oliText, $slideMatch)) {
                $cleanText = preg_replace('/\[SLIDE\].*?\[\/SLIDE\]/s', '', $oliText);
                $oliText = trim($cleanText);
                $slideData = json_decode($slideMatch[1], true);
            }

            // Check for full presentation tools (oli_introduction, live_presentation)
            // that generate multi-slide presentations as JSON files
            $fullPresentationSlides = null;
            foreach ($result['tool_calls'] ?? [] as $tc) {
                if (in_array($tc['name'] ?? '', ['oli_introduction', 'live_presentation']) && !empty($tc['presentation_url'])) {
                    try {
                        // Fetch the JSON file to get all slides
                        $filename = basename(parse_url($tc['presentation_url'], PHP_URL_PATH));
                        $path = storage_path("app/public/ai-reports/{$filename}");
                        if (file_exists($path)) {
                            $data = json_decode(file_get_contents($path), true);
                            if (!empty($data['slides'])) {
                                $fullPresentationSlides = $data['slides'];
                            }
                        }
                    } catch (\Throwable $e) {
                        \Log::warning('Failed to load presentation slides: ' . $e->getMessage());
                    }
                    break;
                }
            }

            // Extract action items
            $actionItems = [];
            if (preg_match_all('/\[ACTION\]\s*(.+)/m', $oliText, $actionMatches)) {
                $actionItems = $actionMatches[1];
                $oliText = preg_replace('/\[ACTION\]\s*.+/m', '', $oliText);
                $oliText = trim($oliText);
            }

            // Save Oli's message
            $oliMsg = MeetingMessage::create([
                'meeting_id'   => $meeting->id,
                'sender_type'  => 'ai',
                'content'      => $oliText,
                'message_type' => ($slideData || $fullPresentationSlides) ? 'presentation' : 'chat',
                'metadata'     => array_filter([
                    'slide'              => $slideData,
                    'action_items'       => $actionItems ?: null,
                    'tool_calls'         => collect($result['tool_calls'] ?? [])->pluck('name')->toArray() ?: null,
                    'is_full_presentation' => $fullPresentationSlides ? true : null,
                    'presentation_slide_count' => $fullPresentationSlides ? count($fullPresentationSlides) : null,
                ]),
            ]);

            // Update presentation state if slide was generated
            if ($slideData) {
                $currentState = $meeting->presentation_state ?? ['slides' => [], 'current_index' => 0];
                $slides = $currentState['slides'] ?? [];
                $slides[] = $slideData;
                $meeting->update([
                    'presentation_state' => [
                        'slides'        => $slides,
                        'current_index' => count($slides) - 1,
                        'updated_at'    => now()->toIso8601String(),
                    ],
                ]);
            }

            // Load full presentation (Oli intro / live presentation) onto shared screen
            if ($fullPresentationSlides) {
                $currentState = $meeting->presentation_state ?? ['slides' => [], 'current_index' => 0];
                $existingSlides = $currentState['slides'] ?? [];
                $newSlides = array_merge($existingSlides, $fullPresentationSlides);
                $meeting->update([
                    'presentation_state' => [
                        'slides'        => $newSlides,
                        'current_index' => count($existingSlides), // start at the first new slide
                        'updated_at'    => now()->toIso8601String(),
                    ],
                ]);
                // Also update the oli message metadata to indicate this is an auto-play presentation
                $oliMsg = null; // will be set below; we'll update after save
            }

            // Save action items as separate notes
            if (!empty($actionItems)) {
                $notes = $meeting->meeting_notes ?? [];
                foreach ($actionItems as $item) {
                    $notes[] = [
                        'type'       => 'action_item',
                        'content'    => trim($item),
                        'created_at' => now()->toIso8601String(),
                        'context'    => $userMessage,
                    ];
                }
                $meeting->update(['meeting_notes' => $notes]);
            }

            return [
                'id'          => $oliMsg->id,
                'sender_type' => 'ai',
                'sender_name' => 'Oli',
                'user_id'     => null,
                'content'     => $oliText,
                'message_type'=> $slideData ? 'presentation' : 'chat',
                'metadata'    => $oliMsg->metadata,
                'created_at'  => $oliMsg->created_at->toIso8601String(),
            ];
        } catch (\Throwable $e) {
            \Log::warning('Meeting Oli error: ' . $e->getMessage());

            $msg = MeetingMessage::create([
                'meeting_id'   => $meeting->id,
                'sender_type'  => 'ai',
                'content'      => "I apologize, I had trouble processing that. Could you rephrase your question?",
                'message_type' => 'chat',
            ]);

            return [
                'id'          => $msg->id,
                'sender_type' => 'ai',
                'sender_name' => 'Oli',
                'user_id'     => null,
                'content'     => $msg->content,
                'message_type'=> 'chat',
                'metadata'    => null,
                'created_at'  => $msg->created_at->toIso8601String(),
            ];
        }
    }

    /* ─── Start meeting ──────────────────────────────────────────── */
    public function start(Meeting $meeting)
    {
        $meeting->update(['status' => 'active', 'started_at' => now()]);

        MeetingMessage::create([
            'meeting_id'   => $meeting->id,
            'sender_type'  => 'system',
            'content'      => 'Meeting started by ' . auth()->user()->name . '.',
            'message_type' => 'system',
        ]);

        return response()->json(['success' => true]);
    }

    /* ─── End meeting ────────────────────────────────────────────── */
    public function end(Meeting $meeting)
    {
        // Final intelligence pass: extract any remaining action items + decisions
        try {
            $intel = app(MeetingIntelligenceService::class);
            $intel->analyzeRecentMessages($meeting, 30);

            // Generate polished summary
            $summary = $intel->generateFinalSummary($meeting);
            $notes = $meeting->meeting_notes ?? [];
            $notes['summary'] = $summary;
            $notes['generated_at'] = now()->toIso8601String();
            $meeting->update(['meeting_notes' => $notes]);
        } catch (\Throwable $e) {
            \Log::warning('Meeting end intelligence failed: ' . $e->getMessage());
        }

        $meeting->update(['status' => 'ended', 'ended_at' => now()]);

        MeetingParticipant::where('meeting_id', $meeting->id)
            ->update(['is_online' => false, 'left_at' => now()]);

        $actionCount = $meeting->actionItems()->count();
        $decisionCount = $meeting->decisions()->count();

        MeetingMessage::create([
            'meeting_id'   => $meeting->id,
            'sender_type'  => 'system',
            'content'      => "Meeting ended by " . auth()->user()->name . ". Summary generated: {$actionCount} action items and {$decisionCount} decisions captured.",
            'message_type' => 'system',
        ]);

        return response()->json(['success' => true]);
    }

    /* ─── Action Item CRUD ───────────────────────────────────────── */
    public function createActionItem(Request $request, Meeting $meeting)
    {
        $data = $request->validate([
            'description' => 'required|string|max:1000',
            'assigned_to_user_id' => 'nullable|exists:users,id',
            'due_date' => 'nullable|date',
            'priority' => 'nullable|in:low,normal,high',
        ]);

        $item = MeetingActionItem::create([
            ...$data,
            'meeting_id' => $meeting->id,
            'created_by_user_id' => auth()->id(),
            'status' => 'pending',
            'priority' => $data['priority'] ?? 'normal',
        ]);

        return response()->json(['action_item' => $item->load('assignedTo:id,name')]);
    }

    public function updateActionItem(Request $request, Meeting $meeting, MeetingActionItem $actionItem)
    {
        $data = $request->validate([
            'description' => 'sometimes|string|max:1000',
            'assigned_to_user_id' => 'sometimes|nullable|exists:users,id',
            'due_date' => 'sometimes|nullable|date',
            'priority' => 'sometimes|in:low,normal,high',
            'status' => 'sometimes|in:pending,in_progress,completed,cancelled',
        ]);

        if (isset($data['status']) && $data['status'] === 'completed' && $actionItem->status !== 'completed') {
            $data['completed_at'] = now();
        }

        $actionItem->update($data);
        return response()->json(['action_item' => $actionItem->fresh()->load('assignedTo:id,name')]);
    }

    public function deleteActionItem(Meeting $meeting, MeetingActionItem $actionItem)
    {
        $actionItem->delete();
        return response()->json(['ok' => true]);
    }

    public function deleteDecision(Meeting $meeting, MeetingDecision $decision)
    {
        $decision->delete();
        return response()->json(['ok' => true]);
    }

    /* ─── Post-Meeting Summary Page ──────────────────────────────── */
    public function summary(Meeting $meeting)
    {
        $meeting->load(['host:id,name', 'participants.user:id,name']);

        $actionItems = $meeting->actionItems()
            ->with(['assignedTo:id,name', 'createdBy:id,name'])
            ->orderByRaw("CASE status WHEN 'pending' THEN 1 WHEN 'in_progress' THEN 2 WHEN 'completed' THEN 3 ELSE 4 END")
            ->orderBy('priority', 'desc')
            ->get();

        $decisions = $meeting->decisions()
            ->with('decidedBy:id,name')
            ->latest()
            ->get();

        $messageCount = $meeting->messages()->where('sender_type', '!=', 'system')->count();

        return Inertia::render('Meetings/Summary', [
            'meeting'      => $meeting,
            'actionItems'  => $actionItems,
            'decisions'    => $decisions,
            'messageCount' => $messageCount,
        ]);
    }

    /* ─── Meeting Analytics Dashboard ────────────────────────────── */
    public function analytics(Request $request)
    {
        $meetings = Meeting::with(['host:id,name'])
            ->withCount(['messages', 'actionItems', 'decisions', 'participants'])
            ->latest()
            ->limit(50)
            ->get();

        $stats = [
            'total_meetings'      => Meeting::count(),
            'active_now'          => Meeting::where('status', 'active')->count(),
            'ended_this_month'    => Meeting::where('status', 'ended')
                                            ->whereMonth('ended_at', now()->month)
                                            ->count(),
            'total_action_items'  => MeetingActionItem::count(),
            'pending_action_items'=> MeetingActionItem::where('status', 'pending')->count(),
            'completed_action_items' => MeetingActionItem::where('status', 'completed')->count(),
            'total_decisions'     => MeetingDecision::count(),
        ];

        $myActionItems = MeetingActionItem::where('assigned_to_user_id', auth()->id())
            ->whereIn('status', ['pending', 'in_progress'])
            ->with('meeting:id,title')
            ->orderBy('due_date', 'asc')
            ->limit(20)
            ->get();

        return Inertia::render('Meetings/Analytics', [
            'meetings'        => $meetings,
            'stats'           => $stats,
            'myActionItems'   => $myActionItems,
        ]);
    }

    /* ─── Leave meeting ──────────────────────────────────────────── */
    public function leave(Meeting $meeting)
    {
        MeetingParticipant::where('meeting_id', $meeting->id)
            ->where('user_id', auth()->id())
            ->update(['is_online' => false, 'left_at' => now()]);

        MeetingMessage::create([
            'meeting_id'   => $meeting->id,
            'sender_type'  => 'system',
            'content'      => auth()->user()->name . ' left the meeting.',
            'message_type' => 'system',
        ]);

        return redirect('/meetings');
    }

    /* ─── Update shared presentation state ────────────────────────── */
    public function updatePresentation(Request $request, Meeting $meeting)
    {
        $meeting->update([
            'presentation_state' => $request->input('state'),
        ]);

        return response()->json(['success' => true]);
    }

    /* ─── Generate meeting notes ──────────────────────────────────── */
    private function generateMeetingNotes(Meeting $meeting): void
    {
        try {
            $allMessages = $meeting->messages()
                ->with('user:id,name')
                ->orderBy('created_at')
                ->get()
                ->map(fn ($m) => [
                    'sender' => $m->sender_type === 'user' ? ($m->user->name ?? 'User') : ($m->sender_type === 'ai' ? 'Oli' : 'System'),
                    'text'   => $m->content,
                    'type'   => $m->message_type,
                ])->toArray();

            $transcript = collect($allMessages)
                ->filter(fn ($m) => $m['type'] !== 'system')
                ->map(fn ($m) => "{$m['sender']}: {$m['text']}")
                ->implode("\n");

            $gemini = app(GeminiChatService::class);
            $result = $gemini->chat([], "Generate concise meeting notes from this transcript. Include: 1) Key Discussion Points (3-5 bullets), 2) Decisions Made, 3) Action Items (with who is responsible if mentioned), 4) Data/numbers discussed. Format in markdown.\n\nMeeting: \"{$meeting->title}\"\nTopic: " . ($meeting->topic ?: 'General') . "\n\nTranscript:\n{$transcript}", [
                'role'   => 'staff',
                'center' => 'All Centers',
            ]);

            $existingNotes = $meeting->meeting_notes ?? [];
            $existingNotes['summary'] = $result['response'] ?? 'No summary available.';
            $existingNotes['generated_at'] = now()->toIso8601String();
            $meeting->update(['meeting_notes' => $existingNotes]);
        } catch (\Throwable $e) {
            \Log::warning('Meeting notes generation failed: ' . $e->getMessage());
        }
    }

    /* ─── Get meeting notes ──────────────────────────────────────── */
    public function notes(Meeting $meeting)
    {
        return response()->json([
            'notes'    => $meeting->meeting_notes,
            'messages' => $meeting->messages()->with('user:id,name')->orderBy('created_at')->get(),
        ]);
    }
}
