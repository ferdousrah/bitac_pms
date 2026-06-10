<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        // ── Forms ──────────────────────────────────────────────────────
        Schema::create('stakeholder_forms', function (Blueprint $t) {
            $t->id();
            $t->foreignId('center_id')->nullable()->constrained('centers')->nullOnDelete();
            $t->string('title', 200);
            $t->text('description')->nullable();
            $t->unsignedSmallInteger('year');
            $t->enum('status', ['draft', 'published', 'closed'])->default('draft');
            $t->boolean('allow_anonymous')->default(false);
            $t->boolean('allow_public_link')->default(true);
            $t->timestamp('opens_at')->nullable();
            $t->timestamp('closes_at')->nullable();
            $t->string('shareable_token', 64)->unique();
            $t->foreignId('created_by')->constrained('users')->cascadeOnDelete();
            $t->timestamp('published_at')->nullable();
            $t->timestamps();

            $t->index(['status', 'year']);
        });

        // ── Sections (optional grouping inside a form) ─────────────────
        Schema::create('stakeholder_form_sections', function (Blueprint $t) {
            $t->id();
            $t->foreignId('form_id')->constrained('stakeholder_forms')->cascadeOnDelete();
            $t->string('title', 200);
            $t->text('description')->nullable();
            $t->unsignedSmallInteger('sort_order')->default(0);
            $t->timestamps();
        });

        // ── Questions ──────────────────────────────────────────────────
        Schema::create('stakeholder_form_questions', function (Blueprint $t) {
            $t->id();
            $t->foreignId('form_id')->constrained('stakeholder_forms')->cascadeOnDelete();
            $t->foreignId('section_id')->nullable()->constrained('stakeholder_form_sections')->nullOnDelete();
            $t->text('question_text');
            $t->text('help_text')->nullable();
            // text, textarea, radio, checkbox, rating, yes_no, dropdown, date, number
            $t->enum('question_type', [
                'text', 'textarea', 'radio', 'checkbox', 'rating',
                'yes_no', 'dropdown', 'date', 'number',
            ]);
            $t->json('options')->nullable();   // for radio/checkbox/dropdown — array of choices
            $t->json('settings')->nullable();  // type-specific (rating min/max, number min/max etc.)
            $t->boolean('is_required')->default(false);
            $t->unsignedSmallInteger('sort_order')->default(0);
            $t->timestamps();

            $t->index(['form_id', 'sort_order']);
        });

        // ── Stakeholder directory ─────────────────────────────────────
        Schema::create('stakeholders', function (Blueprint $t) {
            $t->id();
            $t->foreignId('center_id')->nullable()->constrained('centers')->nullOnDelete();
            $t->string('name', 150);
            $t->string('email', 150)->unique();
            $t->string('phone', 30)->nullable();
            $t->string('organization', 200)->nullable();
            $t->string('designation', 150)->nullable();
            $t->enum('category', [
                'govt_ministry', 'industry_customer', 'academic',
                'industry_body', 'internal', 'other',
            ])->default('industry_customer');
            $t->boolean('is_active')->default(true);
            $t->text('notes')->nullable();
            $t->timestamps();

            $t->index('category');
            $t->index('is_active');
        });

        // ── Invitations (per form × stakeholder) ──────────────────────
        Schema::create('stakeholder_form_invitations', function (Blueprint $t) {
            $t->id();
            $t->foreignId('form_id')->constrained('stakeholder_forms')->cascadeOnDelete();
            $t->foreignId('stakeholder_id')->constrained('stakeholders')->cascadeOnDelete();
            $t->string('token', 64)->unique();  // single-use per-invite identifier
            $t->timestamp('sent_at')->nullable();
            $t->timestamp('opened_at')->nullable();
            $t->timestamp('completed_at')->nullable();
            $t->unsignedSmallInteger('reminder_count')->default(0);
            $t->timestamp('last_reminder_at')->nullable();
            $t->timestamps();

            $t->unique(['form_id', 'stakeholder_id']);
            $t->index('token');
        });

        // ── Responses ─────────────────────────────────────────────────
        Schema::create('stakeholder_form_responses', function (Blueprint $t) {
            $t->id();
            $t->foreignId('form_id')->constrained('stakeholder_forms')->cascadeOnDelete();
            // Either via an invitation, or anonymous public
            $t->foreignId('invitation_id')->nullable()->constrained('stakeholder_form_invitations')->nullOnDelete();
            $t->foreignId('stakeholder_id')->nullable()->constrained('stakeholders')->nullOnDelete();
            // For anonymous public submissions — capture an opt-in identity
            $t->string('anonymous_name', 150)->nullable();
            $t->string('anonymous_organization', 200)->nullable();
            $t->string('ip_address', 45)->nullable();
            $t->boolean('is_complete')->default(false);
            $t->timestamp('submitted_at')->nullable();
            $t->timestamps();

            $t->index(['form_id', 'is_complete']);
        });

        // ── Answers (one row per question per response) ───────────────
        Schema::create('stakeholder_form_answers', function (Blueprint $t) {
            $t->id();
            $t->foreignId('response_id')->constrained('stakeholder_form_responses')->cascadeOnDelete();
            $t->foreignId('question_id')->constrained('stakeholder_form_questions')->cascadeOnDelete();
            $t->text('answer_text')->nullable();           // text/textarea/date/number/yes_no/radio/dropdown
            $t->json('answer_options')->nullable();        // checkbox — array of selected values
            $t->timestamps();

            $t->unique(['response_id', 'question_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('stakeholder_form_answers');
        Schema::dropIfExists('stakeholder_form_responses');
        Schema::dropIfExists('stakeholder_form_invitations');
        Schema::dropIfExists('stakeholders');
        Schema::dropIfExists('stakeholder_form_questions');
        Schema::dropIfExists('stakeholder_form_sections');
        Schema::dropIfExists('stakeholder_forms');
    }
};
