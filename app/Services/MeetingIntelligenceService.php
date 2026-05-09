<?php

namespace App\Services;

use App\Models\Meeting;
use App\Models\MeetingActionItem;
use App\Models\MeetingDecision;
use App\Models\MeetingMessage;
use App\Models\User;
use App\Services\AiAgent\GeminiChatService;
use Illuminate\Support\Facades\Log;

/**
 * MeetingIntelligenceService
 *
 * Analyzes meeting transcripts to extract:
 * - Action items (who, what, when)
 * - Decisions made
 * - Topic segmentation
 * - Meeting summary
 */
class MeetingIntelligenceService
{
    public function __construct(private GeminiChatService $gemini) {}

    /**
     * Extract action items + decisions from the last N messages (real-time).
     * Returns counts of items extracted.
     */
    public function analyzeRecentMessages(Meeting $meeting, int $lastN = 10): array
    {
        $messages = $meeting->messages()
            ->with('user:id,name')
            ->orderBy('created_at', 'desc')
            ->limit($lastN)
            ->get()
            ->reverse();

        if ($messages->isEmpty()) return ['action_items' => 0, 'decisions' => 0];

        // Build transcript
        $transcript = $messages->map(fn ($m) => $this->formatMessage($m))->implode("\n");
        $userList = $meeting->participants()
            ->with('user:id,name')
            ->get()
            ->map(fn ($p) => $p->user->name)
            ->implode(', ');

        // Get already-extracted items so we don't duplicate
        $existingActions = $meeting->actionItems()->pluck('description')->toArray();
        $existingDecisions = $meeting->decisions()->pluck('description')->toArray();

        $existingContext = '';
        if (!empty($existingActions)) {
            $existingContext .= "\n\nALREADY EXTRACTED ACTION ITEMS (do not duplicate):\n- " . implode("\n- ", array_slice($existingActions, -10));
        }
        if (!empty($existingDecisions)) {
            $existingContext .= "\n\nALREADY EXTRACTED DECISIONS (do not duplicate):\n- " . implode("\n- ", array_slice($existingDecisions, -10));
        }

        $prompt = <<<PROMPT
You are an AI meeting intelligence analyst. Extract NEW action items and decisions from this meeting transcript.

Meeting: "{$meeting->title}"
Participants: {$userList}
Today's date: " . now()->toDateString() . "

RULES:
1. Extract ONLY CLEAR, SPECIFIC action items (things someone will DO). Not discussions, not questions.
2. Extract ONLY EXPLICIT decisions (things that were AGREED or DECIDED). Not suggestions.
3. Do NOT re-extract items already in the existing list below.
4. Match assignees to real participant names when mentioned.
5. Parse relative dates ("by Friday", "next week") to YYYY-MM-DD format.
6. Return STRICT JSON. Empty arrays if nothing new found.

OUTPUT FORMAT (JSON only, no markdown fences):
{
  "action_items": [
    {
      "description": "Clear description of what needs to be done",
      "assigned_to": "Participant name or null",
      "due_date": "YYYY-MM-DD or null",
      "priority": "low|normal|high",
      "context": "Brief quote or context"
    }
  ],
  "decisions": [
    {
      "description": "What was decided",
      "decided_by": "Participant name or null",
      "context": "Rationale or discussion that led to it"
    }
  ]
}
{$existingContext}

TRANSCRIPT:
{$transcript}

Respond with JSON only.
PROMPT;

        try {
            $result = $this->gemini->chat([], $prompt, ['role' => 'system', 'center' => 'All']);
            $response = $result['response'] ?? '{}';

            // Strip markdown fences if present
            $response = preg_replace('/```(?:json)?\s*|```\s*$/m', '', $response);
            $response = trim($response);

            $data = json_decode($response, true);
            if (!is_array($data)) return ['action_items' => 0, 'decisions' => 0];

            $actionCount = 0;
            $decisionCount = 0;

            // Save action items
            foreach (($data['action_items'] ?? []) as $item) {
                if (empty($item['description'])) continue;

                $assignedUser = null;
                if (!empty($item['assigned_to'])) {
                    $assignedUser = $this->matchUser($item['assigned_to'], $meeting);
                }

                MeetingActionItem::create([
                    'meeting_id'         => $meeting->id,
                    'description'        => $item['description'],
                    'assigned_to_user_id'=> $assignedUser?->id,
                    'assigned_to_name'   => $item['assigned_to'] ?? null,
                    'due_date'           => $this->parseDate($item['due_date'] ?? null),
                    'priority'           => in_array($item['priority'] ?? 'normal', ['low', 'normal', 'high'])
                                                ? $item['priority'] : 'normal',
                    'context'            => $item['context'] ?? null,
                    'status'             => 'pending',
                ]);
                $actionCount++;
            }

            // Save decisions
            foreach (($data['decisions'] ?? []) as $dec) {
                if (empty($dec['description'])) continue;

                $decidedUser = null;
                if (!empty($dec['decided_by'])) {
                    $decidedUser = $this->matchUser($dec['decided_by'], $meeting);
                }

                MeetingDecision::create([
                    'meeting_id'         => $meeting->id,
                    'description'        => $dec['description'],
                    'context'            => $dec['context'] ?? null,
                    'decided_by_user_id' => $decidedUser?->id,
                    'decided_by_name'    => $dec['decided_by'] ?? null,
                ]);
                $decisionCount++;
            }

            return ['action_items' => $actionCount, 'decisions' => $decisionCount];
        } catch (\Throwable $e) {
            Log::warning('Meeting intelligence analysis failed: ' . $e->getMessage());
            return ['action_items' => 0, 'decisions' => 0];
        }
    }

    /**
     * Generate a comprehensive meeting summary at the end.
     */
    public function generateFinalSummary(Meeting $meeting): string
    {
        $messages = $meeting->messages()->with('user:id,name')->orderBy('created_at')->get();
        $transcript = $messages->map(fn ($m) => $this->formatMessage($m))->implode("\n");

        $actionItems = $meeting->actionItems()->with('assignedTo:id,name')->get();
        $decisions = $meeting->decisions()->with('decidedBy:id,name')->get();

        $actionsList = $actionItems->map(fn ($a) =>
            "- {$a->description}" .
            ($a->assigned_to_name ? " (assigned to: {$a->assigned_to_name})" : '') .
            ($a->due_date ? " [due: {$a->due_date->format('Y-m-d')}]" : '')
        )->implode("\n");

        $decisionsList = $decisions->map(fn ($d) =>
            "- {$d->description}" .
            ($d->decided_by_name ? " (by: {$d->decided_by_name})" : '')
        )->implode("\n");

        $prompt = <<<PROMPT
Generate a professional meeting summary in markdown format.

Meeting: "{$meeting->title}"
Topic: {$meeting->topic}
Duration: {$meeting->started_at?->diffForHumans($meeting->ended_at ?? now(), true)}

STRUCTURE:
## 📝 Meeting Summary

### 🎯 Key Topics Discussed
(3-5 bullet points covering the main subjects)

### 💬 Key Discussion Points
(Most important takeaways, numbers, insights mentioned)

### ✅ Decisions Made
{$decisionsList}

### 📋 Action Items
{$actionsList}

### 🔮 Next Steps
(What should happen after this meeting)

Write it as a proper, polished meeting minutes document. Use bullet points. Keep it concise but comprehensive.

TRANSCRIPT:
{$transcript}
PROMPT;

        try {
            $result = $this->gemini->chat([], $prompt, ['role' => 'system', 'center' => 'All']);
            return $result['response'] ?? 'Summary generation failed.';
        } catch (\Throwable $e) {
            Log::warning('Meeting summary generation failed: ' . $e->getMessage());
            return 'Meeting summary could not be generated. Error: ' . $e->getMessage();
        }
    }

    /**
     * Match a name to a meeting participant (fuzzy).
     */
    private function matchUser(string $name, Meeting $meeting): ?User
    {
        $name = trim($name);
        if (empty($name)) return null;

        $participants = $meeting->participants()
            ->with('user:id,name')
            ->get()
            ->map(fn ($p) => $p->user)
            ->filter();

        // Exact match
        $exact = $participants->firstWhere('name', $name);
        if ($exact) return $exact;

        // Case insensitive
        $lower = strtolower($name);
        $ci = $participants->first(fn ($u) => strtolower($u->name) === $lower);
        if ($ci) return $ci;

        // Substring / partial match (first name matches, etc.)
        $partial = $participants->first(fn ($u) =>
            str_contains(strtolower($u->name), $lower) ||
            str_contains($lower, strtolower(explode(' ', $u->name)[0]))
        );
        return $partial;
    }

    /**
     * Parse date string (supports natural language).
     */
    private function parseDate(?string $input): ?string
    {
        if (empty($input) || $input === 'null') return null;
        try {
            // If it's already YYYY-MM-DD
            if (preg_match('/^\d{4}-\d{2}-\d{2}$/', $input)) return $input;
            return \Carbon\Carbon::parse($input)->toDateString();
        } catch (\Throwable) {
            return null;
        }
    }

    private function formatMessage($m): string
    {
        $sender = match ($m->sender_type) {
            'ai'     => 'Oli',
            'system' => '[System]',
            default  => $m->user->name ?? 'User',
        };
        return "[{$m->created_at->format('H:i')}] {$sender}: {$m->content}";
    }
}
