<?php

namespace App\Http\Controllers\Public;

use App\Http\Controllers\Controller;
use App\Models\StakeholderForm;
use App\Models\StakeholderFormInvitation;
use App\Models\StakeholderFormResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;

class StakeholderFormFillController extends Controller
{
    /**
     * Public fill endpoint. The token is either:
     *  - the form's `shareable_token` (anonymous / public link mode), OR
     *  - an invitation's per-stakeholder `token` (identified)
     */
    public function show(string $token)
    {
        [$form, $invitation] = $this->resolveToken($token);
        if (!$form) abort(404, 'Form not found.');
        if (!$form->isOpen()) {
            return Inertia::render('Public/StakeholderFormClosed', [
                'form' => ['title' => $form->title, 'status' => $form->status],
            ]);
        }

        // Track invitation open
        if ($invitation && !$invitation->opened_at) {
            $invitation->update(['opened_at' => now()]);
        }

        $form->load(['sections', 'questions.section']);

        return Inertia::render('Public/StakeholderFormFill', [
            'form'      => [
                'id'              => $form->id,
                'title'           => $form->title,
                'description'     => $form->description,
                'year'            => $form->year,
                'allow_anonymous' => $form->allow_anonymous,
            ],
            'sections'   => $form->sections->map(fn ($s) => [
                'id' => $s->id, 'title' => $s->title, 'description' => $s->description,
            ])->values(),
            'questions'  => $form->questions->map(fn ($q) => [
                'id'             => $q->id,
                'section_id'     => $q->section_id,
                'question_text'  => $q->question_text,
                'help_text'      => $q->help_text,
                'question_type'  => $q->question_type,
                'options'        => $q->options ?? [],
                'settings'       => $q->settings ?? [],
                'is_required'    => $q->is_required,
            ])->values(),
            'token'      => $token,
            'invitation' => $invitation ? [
                'name'         => $invitation->stakeholder?->name,
                'organization' => $invitation->stakeholder?->organization,
            ] : null,
        ]);
    }

    public function store(Request $request, string $token)
    {
        [$form, $invitation] = $this->resolveToken($token);
        if (!$form) abort(404);
        abort_unless($form->isOpen(), 422, 'This form is no longer accepting responses.');

        $validated = $request->validate([
            'answers'                => 'required|array',
            'answers.*.question_id'  => 'required|integer',
            'answers.*.text'         => 'nullable|string|max:10000',
            'answers.*.options'      => 'nullable|array',
            'anonymous_name'         => 'nullable|string|max:150',
            'anonymous_organization' => 'nullable|string|max:200',
        ]);

        // Server-side required validation
        foreach ($form->questions as $q) {
            if (!$q->is_required) continue;
            $ans = collect($validated['answers'])->firstWhere('question_id', $q->id);
            $hasValue = $ans && (
                (!empty($ans['text']) && trim((string) $ans['text']) !== '')
                || (!empty($ans['options']) && count($ans['options']) > 0)
            );
            if (!$hasValue) {
                return back()->withErrors(['general' => "Required question not answered: \"{$q->question_text}\""])->withInput();
            }
        }

        $response = DB::transaction(function () use ($form, $invitation, $validated, $request) {
            $resp = StakeholderFormResponse::create([
                'form_id'              => $form->id,
                'invitation_id'        => $invitation?->id,
                'stakeholder_id'       => $invitation?->stakeholder_id,
                'anonymous_name'       => $invitation ? null : ($validated['anonymous_name'] ?? null),
                'anonymous_organization' => $invitation ? null : ($validated['anonymous_organization'] ?? null),
                'ip_address'           => $request->ip(),
                'is_complete'          => true,
                'submitted_at'         => now(),
            ]);

            foreach ($validated['answers'] as $a) {
                $resp->answers()->create([
                    'question_id'    => $a['question_id'],
                    'answer_text'    => $a['text']    ?? null,
                    'answer_options' => $a['options'] ?? null,
                ]);
            }

            if ($invitation) {
                $invitation->update(['completed_at' => now()]);
            }

            return $resp;
        });

        return redirect()->route('public.stakeholder-form.success', $token);
    }

    public function success(string $token)
    {
        [$form] = $this->resolveToken($token);
        return Inertia::render('Public/StakeholderFormSuccess', [
            'title' => $form?->title,
        ]);
    }

    /**
     * Resolve a token to [form, invitation]. Either could be an invitation
     * token (identified) or a form's shareable token (anonymous public).
     */
    private function resolveToken(string $token): array
    {
        // Try invitation first
        $invitation = StakeholderFormInvitation::where('token', $token)
            ->with(['form', 'stakeholder'])->first();
        if ($invitation) {
            return [$invitation->form, $invitation];
        }
        // Fall back to form shareable token (public)
        $form = StakeholderForm::withoutGlobalScopes()->where('shareable_token', $token)->first();
        return [$form, null];
    }
}
