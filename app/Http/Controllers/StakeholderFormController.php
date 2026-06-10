<?php

namespace App\Http\Controllers;

use App\Mail\StakeholderFormInvite;
use App\Models\Stakeholder;
use App\Models\StakeholderForm;
use App\Models\StakeholderFormInvitation;
use App\Models\StakeholderFormQuestion;
use App\Models\StakeholderFormSection;
use App\Services\AiAgent\GeminiChatService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Mail;
use Inertia\Inertia;

class StakeholderFormController extends Controller
{
    public function index(Request $request)
    {
        $forms = StakeholderForm::with(['createdBy'])
            ->withCount(['questions', 'invitations', 'responses' => fn($q) => $q->where('is_complete', true)])
            ->latest('id')
            ->paginate(15)
            ->through(fn ($f) => [
                'id'              => $f->id,
                'title'           => $f->title,
                'year'            => $f->year,
                'status'          => $f->status,
                'questions_count' => $f->questions_count,
                'invitations_count' => $f->invitations_count,
                'responses_count' => $f->responses_count,
                'opens_at'        => $f->opens_at?->format('d M Y'),
                'closes_at'       => $f->closes_at?->format('d M Y'),
                'created_by'      => $f->createdBy?->name,
                'created_at'      => $f->created_at->format('d M Y'),
            ]);

        return Inertia::render('StakeholderForms/Index', [
            'forms' => $forms,
        ]);
    }

    public function create()
    {
        return Inertia::render('StakeholderForms/Builder', [
            'form'     => null,
            'sections' => [],
            'questions'=> [],
        ]);
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'title'             => 'required|string|max:200',
            'description'       => 'nullable|string|max:2000',
            'year'              => 'required|integer|min:2020|max:2100',
            'allow_anonymous'   => 'boolean',
            'allow_public_link' => 'boolean',
            'opens_at'          => 'nullable|date',
            'closes_at'         => 'nullable|date|after_or_equal:opens_at',
        ]);

        $form = StakeholderForm::create([
            ...$validated,
            'status'     => 'draft',
            'created_by' => auth()->id(),
            'center_id'  => auth()->user()->center_id,
        ]);

        return redirect()->route('ied.stakeholder-forms.edit', $form)
            ->with('success', "Form draft created — add your questions.");
    }

    public function edit(StakeholderForm $stakeholderForm)
    {
        $stakeholderForm->load(['sections', 'questions.section']);
        return Inertia::render('StakeholderForms/Builder', [
            'form'      => $this->serializeForm($stakeholderForm),
            'sections'  => $stakeholderForm->sections->map(fn($s) => [
                'id' => $s->id, 'title' => $s->title, 'description' => $s->description, 'sort_order' => $s->sort_order,
            ])->values(),
            'questions' => $stakeholderForm->questions->map(fn($q) => $this->serializeQuestion($q))->values(),
        ]);
    }

    public function update(Request $request, StakeholderForm $stakeholderForm)
    {
        $validated = $request->validate([
            'title'             => 'required|string|max:200',
            'description'       => 'nullable|string|max:2000',
            'year'              => 'required|integer|min:2020|max:2100',
            'allow_anonymous'   => 'boolean',
            'allow_public_link' => 'boolean',
            'opens_at'          => 'nullable|date',
            'closes_at'         => 'nullable|date|after_or_equal:opens_at',
        ]);
        $stakeholderForm->update($validated);
        return back()->with('success', 'Form settings updated.');
    }

    /** Persist the entire builder state (sections + questions) in one shot. */
    public function saveBuilder(Request $request, StakeholderForm $stakeholderForm)
    {
        abort_if($stakeholderForm->status === 'closed', 422, 'Cannot edit a closed form.');

        $validated = $request->validate([
            'sections'              => 'array',
            'sections.*.id'         => 'nullable|integer',
            'sections.*.title'      => 'required|string|max:200',
            'sections.*.description'=> 'nullable|string|max:1000',
            'sections.*.sort_order' => 'integer',

            'questions'                 => 'array',
            'questions.*.id'            => 'nullable|integer',
            'questions.*.section_index' => 'nullable|integer',
            'questions.*.question_text' => 'required|string',
            'questions.*.help_text'     => 'nullable|string',
            'questions.*.question_type' => 'required|in:text,textarea,radio,checkbox,rating,yes_no,dropdown,date,number',
            'questions.*.options'       => 'nullable|array',
            'questions.*.settings'      => 'nullable|array',
            'questions.*.is_required'   => 'boolean',
            'questions.*.sort_order'    => 'integer',
        ]);

        DB::transaction(function () use ($validated, $stakeholderForm) {
            // 1. Sections — wipe & recreate, tracking old IDs → new IDs for questions
            $oldSections = $stakeholderForm->sections;
            $stakeholderForm->sections()->delete();

            $sectionIdMap = []; // index → new id
            foreach (($validated['sections'] ?? []) as $idx => $s) {
                $created = $stakeholderForm->sections()->create([
                    'title'       => $s['title'],
                    'description' => $s['description'] ?? null,
                    'sort_order'  => $s['sort_order'] ?? $idx,
                ]);
                $sectionIdMap[$idx] = $created->id;
            }

            // 2. Questions — wipe & recreate, mapping section_index → new section_id
            $stakeholderForm->questions()->delete();
            foreach (($validated['questions'] ?? []) as $idx => $q) {
                $stakeholderForm->questions()->create([
                    'section_id'    => isset($q['section_index']) ? ($sectionIdMap[$q['section_index']] ?? null) : null,
                    'question_text' => $q['question_text'],
                    'help_text'     => $q['help_text'] ?? null,
                    'question_type' => $q['question_type'],
                    'options'       => $q['options'] ?? null,
                    'settings'      => $q['settings'] ?? null,
                    'is_required'   => $q['is_required'] ?? false,
                    'sort_order'    => $q['sort_order'] ?? $idx,
                ]);
            }
        });

        return back()->with('success', 'Form saved.');
    }

    public function publish(StakeholderForm $stakeholderForm)
    {
        abort_if($stakeholderForm->questions()->count() === 0, 422, 'Add at least one question before publishing.');

        $stakeholderForm->update([
            'status'       => 'published',
            'published_at' => now(),
        ]);

        return back()->with('success', "Form published. Share the public link or send invitations.");
    }

    public function close(StakeholderForm $stakeholderForm)
    {
        $stakeholderForm->update(['status' => 'closed']);
        return back()->with('success', 'Form closed — no new responses accepted.');
    }

    public function destroy(StakeholderForm $stakeholderForm)
    {
        $stakeholderForm->delete();
        return redirect()->route('ied.stakeholder-forms.index')->with('success', 'Form deleted.');
    }

    /** Distribution page — pick stakeholders + send invite emails. */
    public function distribute(StakeholderForm $stakeholderForm)
    {
        abort_if($stakeholderForm->status !== 'published', 422, 'Form must be published before distributing.');

        $stakeholders = Stakeholder::active()->orderBy('category')->orderBy('name')->get();

        $invited = $stakeholderForm->invitations()->with('stakeholder')->get()->map(fn ($inv) => [
            'id'             => $inv->id,
            'stakeholder_id' => $inv->stakeholder_id,
            'name'           => $inv->stakeholder?->name,
            'organization'   => $inv->stakeholder?->organization,
            'email'          => $inv->stakeholder?->email,
            'sent_at'        => $inv->sent_at?->format('d M Y'),
            'opened_at'      => $inv->opened_at?->format('d M Y'),
            'completed_at'   => $inv->completed_at?->format('d M Y'),
        ]);

        return Inertia::render('StakeholderForms/Distribute', [
            'form'         => $this->serializeForm($stakeholderForm),
            'stakeholders' => $stakeholders,
            'invited'      => $invited,
            'publicUrl'    => $stakeholderForm->allow_public_link
                ? url("/stakeholder-form/{$stakeholderForm->shareable_token}")
                : null,
        ]);
    }

    public function sendInvites(Request $request, StakeholderForm $stakeholderForm)
    {
        $validated = $request->validate([
            'stakeholder_ids'   => 'required|array|min:1',
            'stakeholder_ids.*' => 'integer|exists:stakeholders,id',
        ]);

        $sent = 0;
        foreach ($validated['stakeholder_ids'] as $sid) {
            // Idempotent — reuse existing invitation if one exists for this form/stakeholder
            $inv = StakeholderFormInvitation::firstOrCreate(
                ['form_id' => $stakeholderForm->id, 'stakeholder_id' => $sid],
            );

            $stakeholder = $inv->stakeholder;
            if (!$stakeholder) continue;

            try {
                Mail::to($stakeholder->email)->send(new StakeholderFormInvite($stakeholderForm, $inv, $stakeholder));
                $inv->update(['sent_at' => now()]);
                $sent++;
            } catch (\Throwable $e) {
                \Log::warning('Stakeholder invite email failed', ['error' => $e->getMessage(), 'sid' => $sid]);
            }
        }

        return back()->with('success', "{$sent} invitation(s) sent.");
    }

    public function sendReminders(StakeholderForm $stakeholderForm)
    {
        $pending = $stakeholderForm->invitations()
            ->whereNull('completed_at')
            ->whereNotNull('sent_at')
            ->with('stakeholder')
            ->get();

        $sent = 0;
        foreach ($pending as $inv) {
            $stakeholder = $inv->stakeholder;
            if (!$stakeholder) continue;
            try {
                Mail::to($stakeholder->email)->send(new StakeholderFormInvite($stakeholderForm, $inv, $stakeholder, true));
                $inv->update([
                    'reminder_count'   => $inv->reminder_count + 1,
                    'last_reminder_at' => now(),
                ]);
                $sent++;
            } catch (\Throwable $e) { /* silent */ }
        }
        return back()->with('success', "{$sent} reminder(s) sent.");
    }

    /** Responses dashboard with aggregate analytics. */
    public function responses(StakeholderForm $stakeholderForm)
    {
        $stakeholderForm->load(['questions.section', 'sections']);

        $responses = $stakeholderForm->responses()
            ->with(['answers', 'stakeholder', 'invitation.stakeholder'])
            ->where('is_complete', true)
            ->latest('submitted_at')
            ->get();

        // Aggregate per question
        $aggregates = [];
        foreach ($stakeholderForm->questions as $q) {
            $answers = $responses->flatMap(fn ($r) => $r->answers->where('question_id', $q->id));
            $aggregates[$q->id] = $this->aggregateForQuestion($q, $answers);
        }

        return Inertia::render('StakeholderForms/Responses', [
            'form'      => $this->serializeForm($stakeholderForm),
            'questions' => $stakeholderForm->questions->map(fn ($q) => $this->serializeQuestion($q))->values(),
            'sections'  => $stakeholderForm->sections,
            'aggregates'=> $aggregates,
            'responses' => $responses->map(fn ($r) => [
                'id'            => $r->id,
                'display_name'  => $r->display_name,
                'organization'  => $r->stakeholder?->organization ?? $r->invitation?->stakeholder?->organization ?? $r->anonymous_organization,
                'category'      => $r->stakeholder?->category ?? $r->invitation?->stakeholder?->category,
                'submitted_at'  => $r->submitted_at?->format('d M Y, h:i A'),
                'answers'       => $r->answers->map(fn ($a) => [
                    'question_id'    => $a->question_id,
                    'answer_text'    => $a->answer_text,
                    'answer_options' => $a->answer_options,
                ]),
            ]),
            'stats' => [
                'total_invited'   => $stakeholderForm->invitations()->count(),
                'total_responses' => $responses->count(),
                'opened'          => $stakeholderForm->invitations()->whereNotNull('opened_at')->count(),
                'completed'       => $stakeholderForm->invitations()->whereNotNull('completed_at')->count(),
            ],
        ]);
    }

    /** AI summary of open-text answers via Gemini. */
    public function aiSummary(StakeholderForm $stakeholderForm, GeminiChatService $gemini)
    {
        $textQuestions = $stakeholderForm->questions()
            ->whereIn('question_type', ['text', 'textarea'])
            ->get();

        if ($textQuestions->isEmpty()) {
            return response()->json(['summary' => 'No open-text questions to summarize.']);
        }

        $blocks = [];
        foreach ($textQuestions as $q) {
            $answers = \App\Models\StakeholderFormAnswer::where('question_id', $q->id)
                ->whereHas('response', fn ($r) => $r->where('is_complete', true))
                ->pluck('answer_text')
                ->filter()
                ->take(100); // cap to keep prompt manageable
            if ($answers->isEmpty()) continue;

            $blocks[] = "Question: \"{$q->question_text}\"\n\nResponses:\n- " . $answers->implode("\n- ");
        }

        if (empty($blocks)) {
            return response()->json(['summary' => 'No text responses yet.']);
        }

        $prompt = "You are analyzing stakeholder feedback for BITAC (Bangladesh Industrial Technical Assistance Centre). "
            . "For each question below, extract the top themes (max 4 per question), measure overall sentiment, "
            . "and surface any standout concerns or suggestions. Use markdown with question headings.\n\n"
            . implode("\n\n---\n\n", $blocks);

        try {
            $result = $gemini->chat([], $prompt, []);
            return response()->json(['summary' => $result['response'] ?? 'No response from AI.']);
        } catch (\Throwable $e) {
            return response()->json(['summary' => 'AI summary unavailable: ' . $e->getMessage()], 500);
        }
    }

    /** Export all completed responses to CSV — one row per response, one column per question. */
    public function exportCsv(StakeholderForm $stakeholderForm)
    {
        $stakeholderForm->load('questions');
        $responses = $stakeholderForm->responses()
            ->with(['answers', 'stakeholder', 'invitation.stakeholder'])
            ->where('is_complete', true)
            ->get();

        $filename = 'stakeholder-form-' . $stakeholderForm->id . '-responses.csv';
        $headers = [
            'Content-Type'        => 'text/csv; charset=UTF-8',
            'Content-Disposition' => "attachment; filename=\"{$filename}\"",
        ];

        $callback = function () use ($stakeholderForm, $responses) {
            $h = fopen('php://output', 'w');
            fwrite($h, "\xEF\xBB\xBF");

            // Header row
            $head = ['Response #', 'Stakeholder', 'Organization', 'Submitted At'];
            foreach ($stakeholderForm->questions as $q) {
                $head[] = $q->question_text;
            }
            fputcsv($h, $head);

            // Data rows
            foreach ($responses as $r) {
                $row = [
                    $r->id,
                    $r->display_name,
                    $r->stakeholder?->organization ?? $r->invitation?->stakeholder?->organization ?? $r->anonymous_organization,
                    $r->submitted_at?->format('Y-m-d H:i'),
                ];
                foreach ($stakeholderForm->questions as $q) {
                    $a = $r->answers->firstWhere('question_id', $q->id);
                    if (!$a) { $row[] = ''; continue; }
                    if ($q->question_type === 'checkbox') {
                        $row[] = is_array($a->answer_options) ? implode(' | ', $a->answer_options) : '';
                    } else {
                        $row[] = $a->answer_text ?? '';
                    }
                }
                fputcsv($h, $row);
            }
            fclose($h);
        };

        return response()->stream($callback, 200, $headers);
    }

    // ── Helpers ──────────────────────────────────────────────────────

    private function aggregateForQuestion(StakeholderFormQuestion $q, $answers): array
    {
        $count = $answers->count();
        $base = ['count' => $count, 'type' => $q->question_type];

        if (in_array($q->question_type, ['radio', 'yes_no', 'dropdown'], true)) {
            $tally = [];
            foreach ($answers as $a) {
                $v = (string) $a->answer_text;
                if ($v === '') continue;
                $tally[$v] = ($tally[$v] ?? 0) + 1;
            }
            arsort($tally);
            return [...$base, 'distribution' => $tally];
        }

        if ($q->question_type === 'checkbox') {
            $tally = [];
            foreach ($answers as $a) {
                foreach ((array) $a->answer_options as $opt) {
                    $tally[$opt] = ($tally[$opt] ?? 0) + 1;
                }
            }
            arsort($tally);
            return [...$base, 'distribution' => $tally];
        }

        if ($q->question_type === 'rating') {
            $sum = 0; $valid = 0; $tally = [];
            foreach ($answers as $a) {
                $v = (int) $a->answer_text;
                if ($v > 0) {
                    $sum += $v; $valid++;
                    $tally[$v] = ($tally[$v] ?? 0) + 1;
                }
            }
            ksort($tally);
            return [...$base, 'avg' => $valid > 0 ? round($sum / $valid, 1) : null, 'distribution' => $tally];
        }

        if ($q->question_type === 'number') {
            $nums = $answers->pluck('answer_text')->filter(fn ($v) => is_numeric($v))->map(fn ($v) => (float) $v);
            return [...$base,
                'avg' => $nums->count() ? round($nums->avg(), 2) : null,
                'min' => $nums->count() ? $nums->min() : null,
                'max' => $nums->count() ? $nums->max() : null,
            ];
        }

        // text / textarea / date — list samples for browser
        $samples = $answers->pluck('answer_text')->filter()->take(50)->values()->all();
        return [...$base, 'samples' => $samples];
    }

    private function serializeForm(StakeholderForm $f): array
    {
        return [
            'id'                => $f->id,
            'title'             => $f->title,
            'description'       => $f->description,
            'year'              => $f->year,
            'status'            => $f->status,
            'allow_anonymous'   => $f->allow_anonymous,
            'allow_public_link' => $f->allow_public_link,
            'opens_at'          => $f->opens_at?->format('Y-m-d\TH:i'),
            'closes_at'         => $f->closes_at?->format('Y-m-d\TH:i'),
            'shareable_token'   => $f->shareable_token,
            'created_at'        => $f->created_at->format('d M Y, h:i A'),
            'created_by'        => $f->createdBy?->name,
            'public_url'        => $f->allow_public_link ? url("/stakeholder-form/{$f->shareable_token}") : null,
        ];
    }

    private function serializeQuestion(StakeholderFormQuestion $q): array
    {
        return [
            'id'             => $q->id,
            'section_id'     => $q->section_id,
            'question_text'  => $q->question_text,
            'help_text'      => $q->help_text,
            'question_type'  => $q->question_type,
            'options'        => $q->options ?? [],
            'settings'       => $q->settings ?? [],
            'is_required'    => $q->is_required,
            'sort_order'     => $q->sort_order,
        ];
    }
}
