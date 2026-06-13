<?php

namespace App\Http\Controllers;

use App\Models\CostEstimate;
use App\Models\Quotation;
use App\Services\AiAgent\GeminiChatService;
use Illuminate\Http\Request;

/**
 * AI assistance endpoints — lightweight helpers that use Oli/Gemini
 * for specific tasks outside the main chat panel (e.g. drafting approval notes).
 */
class AiAssistController extends Controller
{
    public function __construct(private GeminiChatService $gemini) {}

    /**
     * Draft or polish an approval note for cost estimates / quotations.
     *
     * Body:
     *  - action: 'approve' | 'request_changes' | 'reject'
     *  - entity_type: 'cost_estimate' | 'quotation'
     *  - entity_id: int
     *  - mode: 'suggest' (generate 3 ideas) | 'polish' (improve given text)
     *  - text: existing user text (for polish mode)
     */
    public function approvalNote(Request $request)
    {
        $data = $request->validate([
            'action'      => 'required|in:approve,request_changes,reject,handoff_quotation',
            'entity_type' => 'required|in:cost_estimate,quotation',
            'entity_id'   => 'required|integer',
            'mode'        => 'required|in:suggest,polish',
            'text'        => 'nullable|string|max:2000',
        ]);

        // Build a compact context about the estimate/quotation
        $context = $this->buildEntityContext($data['entity_type'], (int) $data['entity_id']);
        if (!$context) {
            return response()->json(['error' => 'Entity not found'], 404);
        }

        $prompt = $this->buildPrompt($data['action'], $data['mode'], $context, $data['text'] ?? '');

        try {
            $result = $this->gemini->chat([], $prompt, ['role' => 'staff', 'center' => 'All']);
            $raw = $result['response'] ?? '';

            // Parse JSON response from the model
            $json = $this->extractJson($raw);
            if (!$json) {
                return response()->json([
                    'error' => 'Could not parse AI response',
                    'raw'   => $raw,
                ], 500);
            }

            return response()->json($json);
        } catch (\Throwable $e) {
            \Log::warning('AI approval note failed: ' . $e->getMessage());
            return response()->json(['error' => $e->getMessage()], 500);
        }
    }

    /**
     * Draft or polish customer-facing Notes & Terms on a quotation draft.
     * Pre-save, so no entity_id — context comes from the form state (rfq_id + line items).
     *
     * Body:
     *  - mode: 'suggest' | 'polish'
     *  - text: string (for polish mode)
     *  - rfq_id: int (for customer context)
     *  - validity_days: int
     *  - vat_rate: number
     *  - items: [{description, quantity, unit_price}, ...]
     */
    public function quotationTerms(Request $request)
    {
        $data = $request->validate([
            'mode'                => 'required|in:suggest,polish',
            'text'                => 'nullable|string|max:2000',
            'rfq_id'              => 'nullable|integer',
            'validity_days'       => 'nullable|integer|min:1',
            'vat_rate'            => 'nullable|numeric|min:0',
            'items'               => 'nullable|array',
            'items.*.description' => 'nullable|string',
            'items.*.quantity'    => 'nullable|numeric',
            'items.*.unit_price'  => 'nullable|numeric',
        ]);

        // Compose lightweight context
        $rfq = $data['rfq_id'] ? \App\Models\Rfq::with('customer')->find($data['rfq_id']) : null;
        $subtotal = 0.0;
        $itemLines = [];
        foreach ($data['items'] ?? [] as $i) {
            $qty = (float) ($i['quantity'] ?? 0);
            $price = (float) ($i['unit_price'] ?? 0);
            $subtotal += $qty * $price;
            $itemLines[] = [
                'description' => $i['description'] ?? '',
                'quantity'    => $qty,
                'unit_price'  => $price,
                'amount'      => round($qty * $price, 2),
            ];
        }
        $vatRate  = (float) ($data['vat_rate'] ?? 15);
        $vatAmt   = round($subtotal * $vatRate / 100, 2);
        $total    = round($subtotal + $vatAmt, 2);

        $ctx = [
            'customer'      => $rfq?->customer?->name,
            'rfq_no'        => $rfq?->id ? "RFQ #{$rfq->id}" : null,
            'validity_days' => $data['validity_days'] ?? 30,
            'vat_rate'      => $vatRate,
            'subtotal'      => round($subtotal, 2),
            'vat_amount'    => $vatAmt,
            'grand_total'   => $total,
            'item_count'    => count($itemLines),
            'items'         => array_slice($itemLines, 0, 6),
        ];

        $prompt = $this->buildTermsPrompt($data['mode'], $ctx, $data['text'] ?? '');

        try {
            $result = $this->gemini->chat([], $prompt, ['role' => 'staff', 'center' => 'All']);
            $raw = $result['response'] ?? '';
            $json = $this->extractJson($raw);
            if (!$json) {
                return response()->json(['error' => 'Could not parse AI response', 'raw' => $raw], 500);
            }
            return response()->json($json);
        } catch (\Throwable $e) {
            \Log::warning('AI quotation terms failed: ' . $e->getMessage());
            return response()->json(['error' => $e->getMessage()], 500);
        }
    }

    /**
     * Draft or polish a comment reply in an entity discussion thread.
     * Context = the entity summary + the full prior comment thread.
     *
     * Body:
     *  - mode: 'suggest' | 'polish'
     *  - text: string
     *  - entity_type: 'cost_estimate' | 'quotation'
     *  - entity_id: int
     */
    public function commentReply(Request $request)
    {
        $data = $request->validate([
            'mode'        => 'required|in:suggest,polish',
            'text'        => 'nullable|string|max:2000',
            'entity_type' => 'required|in:cost_estimate,quotation',
            'entity_id'   => 'required|integer',
        ]);

        $entityCtx = $this->buildEntityContext($data['entity_type'], (int) $data['entity_id']);
        if (!$entityCtx) {
            return response()->json(['error' => 'Entity not found'], 404);
        }

        // Thread — last 20 comments is plenty
        $thread = \App\Models\EntityComment::forEntity($data['entity_type'], (int) $data['entity_id'])
            ->with('user:id,name')
            ->orderBy('created_at')
            ->take(20)
            ->get()
            ->map(fn($c) => [
                'author' => $c->user?->name ?? 'Unknown',
                'kind'   => $c->kind,
                'body'   => $c->body,
                'when'   => $c->created_at->diffForHumans(),
            ])->toArray();

        $currentUser = auth()->user()?->name ?? 'the preparer';

        $prompt = $this->buildReplyPrompt($data['mode'], $entityCtx, $thread, $data['text'] ?? '', $currentUser);

        try {
            $result = $this->gemini->chat([], $prompt, ['role' => 'staff', 'center' => 'All']);
            $raw = $result['response'] ?? '';
            $json = $this->extractJson($raw);
            if (!$json) {
                return response()->json(['error' => 'Could not parse AI response', 'raw' => $raw], 500);
            }
            return response()->json($json);
        } catch (\Throwable $e) {
            \Log::warning('AI comment reply failed: ' . $e->getMessage());
            return response()->json(['error' => $e->getMessage()], 500);
        }
    }

    /**
     * Prompt builder for comment-thread replies.
     */
    private function buildReplyPrompt(string $mode, array $entityCtx, array $thread, string $userText, string $currentUser): string
    {
        $entityJson = json_encode($entityCtx, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
        $threadText = empty($thread)
            ? '(no prior comments yet)'
            : implode("\n", array_map(
                fn($c) => "[{$c['author']} · {$c['kind']} · {$c['when']}]\n{$c['body']}\n",
                $thread
            ));

        if ($mode === 'polish') {
            return <<<PROMPT
You are an AI assistant for BITAC (Bangladesh Industrial Technical Assistance Centre).

Item under discussion:
{$entityJson}

Conversation so far:
{$threadText}

"{$currentUser}" drafted this reply:
"{$userText}"

TASK: Polish the reply. Make it:
- Professional and respectful (peer-to-peer engineer/sales discussion, not formal approval language).
- Concise (1-3 short sentences or short paragraph).
- Directly address what was asked or raised in the conversation.
- Specific where possible — reference costs, quantities, rates from the item context if relevant.
- English by default, Bangla if the user wrote Bangla.

Return JSON ONLY:
{
  "polished": "the improved reply",
  "reasoning": "one short sentence on what was improved"
}
PROMPT;
        }

        return <<<PROMPT
You are an AI assistant for BITAC (Bangladesh Industrial Technical Assistance Centre), helping a team member reply in a work discussion.

Item under discussion:
{$entityJson}

Conversation so far:
{$threadText}

The current user ("{$currentUser}") is about to reply. Generate 3 distinct, professional reply drafts they could use.

RULES:
- Each reply: 1-3 short sentences, conversational but professional.
- Make each suggestion DIFFERENT in stance:
  1. A DIRECT answer / acknowledgment.
  2. A CLARIFYING question (if the thread has unclear asks) or a counter-proposal.
  3. A STATUS update / commitment (e.g. "I'll revise by tomorrow and share here").
- Reference concrete numbers from the item context where it adds value.
- Do NOT invent details not implied by context.
- English by default; use Bangla only if the conversation is in Bangla.

Return JSON ONLY:
{
  "suggestions": [
    {"label": "Direct answer",       "text": "..."},
    {"label": "Clarifying question", "text": "..."},
    {"label": "Status update",       "text": "..."}
  ]
}
PROMPT;
    }

    /**
     * Prompt for customer-facing quotation Notes & Terms.
     */
    /**
     * Draft or polish a forwarding letter that accompanies a quotation PDF.
     *
     * Body:
     *  - mode: 'suggest' | 'polish'
     *  - text: string (current body — required for polish, optional for suggest)
     *  - subject: string (optional — used as a hint)
     *  - rfq_id: int (optional — for customer/job context)
     *  - validity_days, vat_rate, items: same shape as quotationTerms()
     */
    public function forwardingLetter(Request $request)
    {
        $data = $request->validate([
            'mode'                => 'required|in:suggest,polish',
            'text'                => 'nullable|string|max:5000',
            'subject'             => 'nullable|string|max:255',
            'rfq_id'              => 'nullable|integer',
            'customer_ref_no'     => 'nullable|string|max:200',
            'validity_days'       => 'nullable|integer|min:1',
            'vat_rate'            => 'nullable|numeric|min:0',
            'items'               => 'nullable|array',
            'items.*.description' => 'nullable|string',
            'items.*.quantity'    => 'nullable|numeric',
            'items.*.unit_price'  => 'nullable|numeric',
        ]);

        $rfq = $data['rfq_id'] ? \App\Models\Rfq::with('customer')->find($data['rfq_id']) : null;
        $subtotal = 0.0;
        $itemLines = [];
        foreach ($data['items'] ?? [] as $i) {
            $qty   = (float) ($i['quantity'] ?? 0);
            $price = (float) ($i['unit_price'] ?? 0);
            $subtotal += $qty * $price;
            $itemLines[] = [
                'description' => $i['description'] ?? '',
                'quantity'    => $qty,
                'unit_price'  => $price,
                'amount'      => round($qty * $price, 2),
            ];
        }
        $vatRate = (float) ($data['vat_rate'] ?? 15);
        $total   = round($subtotal + ($subtotal * $vatRate / 100), 2);

        // The form-passed customer_ref_no wins (preparer may have overridden it
        // on the quotation), falling back to the RFQ's value. We deliberately
        // do NOT pass our internal RFQ #id to the prompt — customers don't
        // recognise it; they recognise the ref they themselves issued.
        $customerRef = trim((string) ($data['customer_ref_no'] ?? '')) !== ''
            ? $data['customer_ref_no']
            : $rfq?->customer_ref_no;

        $ctx = [
            'customer'        => $rfq?->customer?->name,
            'customer_ref_no' => $customerRef,
            'subject'         => $data['subject'] ?? null,
            'validity_days'   => $data['validity_days'] ?? 30,
            'vat_rate'        => $vatRate,
            'grand_total'     => $total,
            'item_count'      => count($itemLines),
            'items'           => array_slice($itemLines, 0, 6),
        ];

        $prompt = $this->buildForwardingLetterPrompt($data['mode'], $ctx, $data['text'] ?? '');

        try {
            $result = $this->gemini->chat([], $prompt, ['role' => 'staff', 'center' => 'All']);
            $raw  = $result['response'] ?? '';
            $json = $this->extractJson($raw);
            if (!$json) {
                return response()->json(['error' => 'Could not parse AI response', 'raw' => $raw], 500);
            }
            return response()->json($json);
        } catch (\Throwable $e) {
            \Log::warning('AI forwarding letter failed: ' . $e->getMessage());
            return response()->json(['error' => $e->getMessage()], 500);
        }
    }

    private function buildForwardingLetterPrompt(string $mode, array $ctx, string $userText): string
    {
        $contextJson = json_encode($ctx, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);

        if ($mode === 'polish') {
            return <<<PROMPT
You are an AI assistant for BITAC (Bangladesh Industrial Technical Assistance Centre), an autonomous government body that prepares formal quotations for industrial B2B customers.

Quotation context:
{$contextJson}

The preparer drafted this forwarding-letter body (the cover note that ships with the quotation PDF):
"{$userText}"

TASK: Polish it into a formal forwarding letter body, AND propose a matching subject line. Rules:
- 3-5 short paragraphs, professional government letter register.
- DO NOT include "Date:", "Ref:", recipient/address block, or a signature line — those are added by the PDF generator automatically.
- DO start naturally (e.g. "With reference to..." or "Please find enclosed...").
- When referencing the customer's incoming request, use ONLY the customer's own reference number (context.customer_ref_no). NEVER mention "RFQ #" or our internal RFQ id — customers don't recognise it.
- Reference customer / total naturally when context provides them; do not invent numbers.
- Keep the writer's intent — don't reword aggressively, just clean it up.
- Keep language consistent with user input (English default, Bangla if user wrote Bangla).
- Plain text only — use \\n for line breaks, no markdown.
- Subject: short (under 80 chars), title-cased, references the work/customer at a glance.

Return JSON ONLY:
{
  "polished": "the improved letter body as a single string with \\n line breaks",
  "polished_subject": "a matching subject line under 80 characters",
  "reasoning": "one short sentence on what was improved"
}
PROMPT;
        }

        // suggest mode
        return <<<PROMPT
You are an AI assistant for BITAC (Bangladesh Industrial Technical Assistance Centre), an autonomous government body that prepares formal quotations for industrial B2B customers.

Quotation context:
{$contextJson}

TASK: Generate 3 distinct forwarding-letter drafts the preparer can use directly. Each draft is a cover note that ships alongside the quotation PDF and explains what's enclosed. Each draft has BOTH a subject line and a body.

RULES:
- Body: 3-5 short paragraphs each, professional government letter register.
- DO NOT include "Date:", "Ref:", recipient/address block, or a signature line in the body — those are added by the PDF generator automatically.
- DO start naturally (e.g. "With reference to your enquiry...").
- When referencing the customer's incoming request, use ONLY the customer's own reference number (context.customer_ref_no). NEVER write "RFQ #" or any internal id — customers don't recognise it.
- Each draft should differ in style/emphasis:
  1. CONCISE  — minimal, just the essentials (2-3 short paragraphs).
  2. STANDARD — balanced, mentions reference, scope summary, validity, next step.
  3. WARM     — same content as Standard but a touch more relationship-oriented language while staying formal.
- Reference actual numbers from context where natural ("with reference to your Ref. {customer_ref_no}", "Total ৳{grand_total}", "valid for {validity_days} days").
- Plain text only — use \\n for line breaks, no markdown.
- Subject: short (under 80 chars), title-cased, references the work/customer at a glance.

Return JSON ONLY:
{
  "suggestions": [
    {"label": "Concise",  "subject": "Short subject line", "text": "Full letter body with \\n line breaks"},
    {"label": "Standard", "subject": "Short subject line", "text": "Full letter body with \\n line breaks"},
    {"label": "Warm",     "subject": "Short subject line", "text": "Full letter body with \\n line breaks"}
  ]
}
PROMPT;
    }

    private function buildTermsPrompt(string $mode, array $ctx, string $userText): string
    {
        $contextJson = json_encode($ctx, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);

        if ($mode === 'polish') {
            return <<<PROMPT
You are an AI assistant for BITAC (Bangladesh Industrial Technical Assistance Centre), an autonomous government body.

Quotation context:
{$contextJson}

The preparer drafted these customer-facing Notes & Terms:
"{$userText}"

TASK: Polish them into professional quotation terms for a B2B customer. Make them:
- Clear, formal, and customer-facing (not internal notes).
- Structured with short bullet-style lines or short paragraphs as appropriate.
- Specific if context suggests (validity, payment terms, delivery, warranty, scope exclusions).
- Suitable tone for a government technical services organization dealing with industrial customers.
- Keep language consistent with user input (English default, Bangla if user wrote Bangla).
- Do not invent facts not implied by context (e.g. don't claim specific warranty length if not given).

Return JSON ONLY:
{
  "polished": "the improved terms as a single string (may contain line breaks using \\n)",
  "reasoning": "one short sentence on what was improved"
}
PROMPT;
        }

        // suggest mode
        return <<<PROMPT
You are an AI assistant for BITAC (Bangladesh Industrial Technical Assistance Centre), an autonomous government body dealing with industrial B2B customers.

Quotation context:
{$contextJson}

TASK: Generate 3 distinct, professional Notes & Terms blocks the preparer can use directly on this customer quotation.

RULES:
- Customer-facing, not internal handoff notes.
- Each suggestion: 3-6 short lines covering the typical terms (validity, payment terms, delivery schedule, warranty if applicable, price-escalation clause, taxes, dispute resolution).
- Make each of the 3 suggestions DIFFERENT in style/emphasis:
  1. CONCISE — minimal essential terms (3-4 lines).
  2. STANDARD — balanced typical B2B terms.
  3. COMPREHENSIVE — detailed terms including risk/scope exclusions.
- Reference actual numbers from context where natural (e.g. "Validity: {validity_days} days from quotation date", "VAT {vat_rate}% as applicable").
- Formal, professional register. Avoid marketing fluff.
- Use line breaks (\\n) to separate clauses — return plain text, not markdown.

Return JSON ONLY:
{
  "suggestions": [
    {"label": "Concise", "text": "Full terms text with \\n line breaks"},
    {"label": "Standard", "text": "Full terms text with \\n line breaks"},
    {"label": "Comprehensive", "text": "Full terms text with \\n line breaks"}
  ]
}
PROMPT;
    }

    /**
     * Analyse drawings and/or sample photos and draft a description for the RFQ item.
     * Uses Gemini vision. Supports multiple images (drawing + sample + both).
     *
     * Body (multipart/form-data):
     *  - purpose: 'item_description' | 'sample_description'  (defaults to item_description)
     *  - drawings[]:      uploaded files (image/*)
     *  - sample_photos[]: uploaded files (image/*)
     *  - drawing_urls[]:      existing gallery image URLs (optional)
     *  - sample_photo_urls[]: existing gallery image URLs (optional)
     *  - job_description: optional context string
     *  - existing_text:   optional current text the user has already typed
     *  - mode: 'suggest' (default) | 'polish'
     */
    public function sampleDescription(Request $request)
    {
        $data = $request->validate([
            'purpose'            => 'nullable|in:item_description,sample_description',
            'job_description'    => 'nullable|string|max:500',
            'existing_text'      => 'nullable|string|max:1500',
            'mode'               => 'nullable|in:suggest,polish',
            'drawings'           => 'nullable|array',
            'drawings.*'         => 'file|mimetypes:image/jpeg,image/png,image/gif,image/webp,application/pdf|max:10240',
            'sample_photos'      => 'nullable|array',
            'sample_photos.*'    => 'file|mimetypes:image/jpeg,image/png,image/gif,image/webp,application/pdf|max:10240',
            'drawing_urls'       => 'nullable|array',
            'drawing_urls.*'     => 'url',
            'sample_photo_urls'  => 'nullable|array',
            'sample_photo_urls.*'=> 'url',
            // Legacy single-image fallback
            'image'              => 'nullable|image|max:10240',
            'image_url'          => 'nullable|url',
        ]);

        // Collect all images into a single typed list. Cap at 4 to keep the Gemini
        // payload reasonable (model supports more but cost/latency scales).
        $images = []; // [['kind' => 'drawing|sample', 'bytes' => ..., 'mime' => ...], ...]

        // Uploaded files — drawings
        foreach ($request->file('drawings', []) as $file) {
            if (!$file) continue;
            $images[] = [
                'kind'  => 'drawing',
                'bytes' => file_get_contents($file->getRealPath()),
                'mime'  => $file->getMimeType() ?: 'image/jpeg',
            ];
        }
        // Uploaded files — sample photos
        foreach ($request->file('sample_photos', []) as $file) {
            if (!$file) continue;
            $images[] = [
                'kind'  => 'sample',
                'bytes' => file_get_contents($file->getRealPath()),
                'mime'  => $file->getMimeType() ?: 'image/jpeg',
            ];
        }
        // Gallery URLs — drawings
        foreach ($data['drawing_urls'] ?? [] as $url) {
            $bytes = @file_get_contents($url);
            if ($bytes !== false) {
                $images[] = ['kind' => 'drawing', 'bytes' => $bytes, 'mime' => $this->guessMimeFromUrl($url)];
            }
        }
        // Gallery URLs — sample photos
        foreach ($data['sample_photo_urls'] ?? [] as $url) {
            $bytes = @file_get_contents($url);
            if ($bytes !== false) {
                $images[] = ['kind' => 'sample', 'bytes' => $bytes, 'mime' => $this->guessMimeFromUrl($url)];
            }
        }
        // Legacy single image fallback
        if (empty($images) && $request->hasFile('image')) {
            $file = $request->file('image');
            $images[] = [
                'kind'  => 'sample',
                'bytes' => file_get_contents($file->getRealPath()),
                'mime'  => $file->getMimeType() ?: 'image/jpeg',
            ];
        }
        if (empty($images) && !empty($data['image_url'])) {
            $bytes = @file_get_contents($data['image_url']);
            if ($bytes !== false) {
                $images[] = ['kind' => 'sample', 'bytes' => $bytes, 'mime' => $this->guessMimeFromUrl($data['image_url'])];
            }
        }

        $images = array_slice($images, 0, 4);
        if (empty($images)) {
            return response()->json(['error' => 'No drawings or sample photos provided. Attach at least one reference first.'], 422);
        }

        $purpose        = $data['purpose'] ?? 'item_description';
        $mode           = $data['mode'] ?? 'suggest';
        $jobDescription = $data['job_description'] ?? null;
        $existing       = $data['existing_text'] ?? '';

        // Count kinds for prompt context
        $drawingCount = count(array_filter($images, fn($i) => $i['kind'] === 'drawing'));
        $sampleCount  = count(array_filter($images, fn($i) => $i['kind'] === 'sample'));

        $prompt = $this->buildSampleDescriptionPrompt(
            $mode, $jobDescription, $existing,
            $purpose, $drawingCount, $sampleCount,
        );

        try {
            // Build the Gemini inline_data payload for every image (drawings + samples).
            $imagePayload = array_map(fn($img) => [
                'mime_type' => $img['mime'],
                'base64'    => base64_encode($img['bytes']),
            ], $images);

            $result = $this->gemini->chat(
                [],
                $prompt,
                ['role' => 'staff', 'center' => 'All'],
                $imagePayload,
            );
            $raw = $result['response'] ?? '';
            $json = $this->extractJson($raw);
            if (!$json) {
                return response()->json(['error' => 'Could not parse AI response', 'raw' => $raw], 500);
            }
            return response()->json($json);
        } catch (\Throwable $e) {
            \Log::warning('AI sample description failed: ' . $e->getMessage());
            return response()->json(['error' => $e->getMessage()], 500);
        }
    }

    private function guessMimeFromUrl(string $url): string
    {
        $ext = strtolower(pathinfo(parse_url($url, PHP_URL_PATH), PATHINFO_EXTENSION));
        return match ($ext) {
            'png'  => 'image/png',
            'gif'  => 'image/gif',
            'webp' => 'image/webp',
            default => 'image/jpeg',
        };
    }

    private function buildSampleDescriptionPrompt(
        string $mode,
        ?string $jobDescription,
        string $existing,
        string $purpose = 'item_description',
        int $drawingCount = 0,
        int $sampleCount = 0,
    ): string {
        $jobLine   = $jobDescription ? "The RFQ item is: \"{$jobDescription}\"." : '';
        $existLine = $existing !== '' ? "The preparer has already typed: \"{$existing}\"" : '';

        // Describe what images were attached (and in what order)
        $imagesLine = 'Attached image(s):';
        $order = [];
        if ($drawingCount > 0) $order[] = "{$drawingCount} technical drawing" . ($drawingCount > 1 ? 's' : '');
        if ($sampleCount  > 0) $order[] = "{$sampleCount} physical-sample photo" . ($sampleCount  > 1 ? 's' : '');
        $imagesLine .= ' ' . implode(' and ', $order) . '.';
        if ($drawingCount > 0 && $sampleCount > 0) {
            $imagesLine .= " The drawings come first, then the sample photos.";
        }

        // Purpose-specific framing
        $purposeIntro = $purpose === 'sample_description'
            ? "You are drafting the PHYSICAL-SAMPLE CONDITION field (describes only the physical reference sample — its material, condition, defects, wear)."
            : "You are drafting the ITEM DESCRIPTION field on the RFQ (a general technical description of what's being manufactured — combining whatever is visible in the drawing(s) and/or sample photo(s)).";

        $specificChecklist = $purpose === 'sample_description'
            ? "- Focus on the physical sample: material/finish, visible defects, wear/corrosion, general condition (new / used / broken / prototype), obvious features (threads, machining marks, coating).\n- Do NOT describe the drawing as if it were the sample — if only a drawing is attached, clearly state 'Sample not physically provided; description inferred from drawing.'"
            : "- Identify: likely material, general shape (flange, gear, shaft, bushing, housing, plate, coupling, etc.), approximate size class (small/medium/large) if visible, obvious features (threads, bores, keyways, mounting holes, splines), likely manufacturing method (machined, cast, forged, welded, sheet-metal).\n- If a TECHNICAL DRAWING is attached, pull specific callouts you can read (dimensions with units, material notes, tolerance bands, surface finish symbols).\n- If a SAMPLE PHOTO is attached, use it to supplement the drawing with actual condition, finish quality, and wear.";

        if ($mode === 'polish' && $existing !== '') {
            return <<<PROMPT
You are an AI assistant at BITAC (an industrial manufacturing organisation).

{$purposeIntro}

{$jobLine}
{$existLine}

{$imagesLine}

TASK: Polish the preparer's draft, informed by what you see in the image(s).

RULES:
- Keep it concise: 1-3 short sentences.
{$specificChecklist}
- Do NOT invent exact dimensions unless clearly visible (e.g. a ruler in frame or a callout on the drawing).
- English (or Bangla if the user's draft is Bangla).

Return JSON ONLY:
{
  "polished": "the improved description",
  "reasoning": "one short sentence explaining what was improved"
}
PROMPT;
        }

        return <<<PROMPT
You are an AI assistant at BITAC (an industrial manufacturing organisation).

{$purposeIntro}

{$jobLine}
{$existLine}

{$imagesLine}

TASK: Analyse the attached image(s) and generate 3 distinct draft descriptions the preparer can use.

RULES:
- Each description: 1-3 short sentences, professional and specific.
{$specificChecklist}
- Make each of the 3 options DIFFERENT in emphasis:
  1. CONCISE — a one-liner with just the essentials.
  2. DETAILED — focus on condition, defects, and visible features.
  3. TECHNICAL — focus on likely material, manufacturing process, and any dimensions/tolerances you can read.
- Do NOT invent exact dimensions unless clearly visible.
- English unless the RFQ item is clearly Bangla.

Return JSON ONLY:
{
  "suggestions": [
    {"label": "Concise",  "text": "..."},
    {"label": "Detailed", "text": "..."},
    {"label": "Technical","text": "..."}
  ]
}
PROMPT;
    }

    /**
     * Build a short context summary for the AI prompt.
     */
    private function buildEntityContext(string $type, int $id): ?array
    {
        if ($type === 'cost_estimate') {
            $e = CostEstimate::with('rfqItem', 'customer', 'lines')->find($id);
            if (!$e) return null;
            return [
                'label'          => "Cost Estimate {$e->estimate_no}",
                'job'            => $e->job_name,
                'customer'       => $e->customer?->name ?? $e->company_name,
                'pricing_group'  => $e->pricing_group,
                'material_cost'  => (float) $e->material_cost,
                'machining_cost' => (float) $e->machining_cost,
                'surface_cost'   => (float) $e->surface_cost,
                'other_cost'     => (float) $e->other_cost,
                'net_cost'       => (float) $e->net_cost,
                'overhead_pct'   => (float) $e->overhead_pct,
                'vat_pct'        => (float) $e->vat_pct,
                'job_quantity'   => (int) $e->job_quantity,
                'grand_total'    => (float) $e->grand_total,
                'line_count'     => $e->lines->count(),
                'sample_lines'   => $e->lines->take(8)->map(fn($l) => [
                    'section'     => $l->section,
                    'description' => $l->description,
                    'quantity'    => (float) $l->quantity,
                    'rate'        => (float) $l->rate,
                ])->toArray(),
            ];
        }

        if ($type === 'quotation') {
            $q = Quotation::with('rfq', 'customer')->find($id);
            if (!$q) return null;
            return [
                'label'          => "Quotation #{$q->id} v{$q->version}",
                'customer'       => $q->customer?->name,
                'material_cost'  => (float) $q->material_cost,
                'labour_cost'    => (float) $q->labour_cost,
                'overhead_cost'  => (float) $q->overhead_cost,
                'profit_margin'  => (float) $q->profit_margin,
                'discount'       => (float) $q->discount,
                'vat_rate'       => (float) $q->vat_rate,
                'total_amount'   => (float) $q->total_amount,
                'validity_days'  => $q->validity_days,
            ];
        }

        return null;
    }

    /**
     * Build the prompt for the AI model.
     */
    private function buildPrompt(string $action, string $mode, array $ctx, string $userText): string
    {
        $actionLabel = match ($action) {
            'approve'           => 'approving',
            'request_changes'   => 'requesting changes (correction) on',
            'reject'            => 'rejecting',
            'handoff_quotation' => 'handing off (using as the basis for a new quotation)',
        };

        $contextJson = json_encode($ctx, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);

        // Handoff mode: the note goes to whoever prepares the quotation from this estimate.
        // The tone is collaborative guidance, not approval/rejection.
        if ($action === 'handoff_quotation') {
            if ($mode === 'polish') {
                return <<<PROMPT
You are an AI assistant for BITAC (Bangladesh Industrial Technical Assistance Centre).

Context: An engineer is handing this finalized cost estimate to the sales team to create a customer quotation:
{$contextJson}

Their rough handoff note:
"{$userText}"

TASK: Polish the note for the sales/quotation preparer. Make it:
- Professional, clear, collaborative tone (engineer → sales handoff).
- Concise (1-3 sentences).
- Focused on what the preparer needs to watch for: margin guidance, pricing group rationale, special terms, risks, customer-specific considerations.
- In English (unless user wrote in Bangla, then respond in Bangla).

Return JSON ONLY:
{
  "polished": "the improved note as a single string",
  "reasoning": "one short sentence explaining what was improved"
}
PROMPT;
            }
            // suggest
            return <<<PROMPT
You are an AI assistant for BITAC (Bangladesh Industrial Technical Assistance Centre), an autonomous body under the Ministry of Industries.

Context: An engineer is handing this finalized cost estimate to the sales team so they can build a customer quotation on top of it.

Estimate details:
{$contextJson}

Generate 3 distinct handoff notes the engineer could leave for the quotation preparer.

RULES:
- Each note: 1-3 sentences, collaborative and specific.
- Different angles:
  1. Margin / pricing guidance (e.g. minimum acceptable markup, ceiling, negotiation room).
  2. Technical or material caveat (things that could change the cost if scope shifts).
  3. Customer-relationship context (how to pitch, validity, payment terms, follow-up).
- Reference actual numbers from the context when it adds value (net cost, grand total, quantities).
- Professional government/industrial register. English unless the context suggests Bangla.

Return JSON ONLY:
{
  "suggestions": [
    {"label": "Short 3-word label", "text": "The full note text"},
    {"label": "Short 3-word label", "text": "The full note text"},
    {"label": "Short 3-word label", "text": "The full note text"}
  ]
}
PROMPT;
        }

        if ($mode === 'polish') {
            return <<<PROMPT
You are an AI assistant for BITAC (Bangladesh Industrial Technical Assistance Centre).

Context: A senior engineer is {$actionLabel} this item:
{$contextJson}

They wrote this rough note:
"{$userText}"

TASK: Polish the note. Make it:
- Professional and clear (suitable for a government industrial organization)
- Concise (1-3 sentences)
- Specific if possible (reference costs, quantities, pricing group if relevant)
- Respectful but direct
- In English (unless user wrote in Bangla, then respond in Bangla)

Return JSON ONLY in this exact format:
{
  "polished": "the improved note as a single string",
  "reasoning": "one short sentence explaining what was improved"
}
PROMPT;
        }

        // suggest mode — generate 3 different notes
        return <<<PROMPT
You are an AI assistant for BITAC (Bangladesh Industrial Technical Assistance Centre), an autonomous body under the Ministry of Industries.

Context: A senior engineer is reviewing this item and needs to write a note for their decision:

Item details:
{$contextJson}

They are {$actionLabel} it. Generate 3 distinct, professional notes they could use.

RULES:
- Each note: 1-3 sentences, clear and respectful.
- Make each suggestion DIFFERENT in angle — e.g. one focused on specifics (rates, quantities), one general, one asking for verification.
- For "approving": acknowledgment + optional guidance for next steps.
- For "requesting changes": specific, actionable asks (what to check/fix).
- For "rejecting": clear, professional reason.
- Reference relevant numbers from the context when it adds value.
- Use English (professional government/industrial register).

Return JSON ONLY in this exact format:
{
  "suggestions": [
    {"label": "Short 3-word label", "text": "The full note text"},
    {"label": "Short 3-word label", "text": "The full note text"},
    {"label": "Short 3-word label", "text": "The full note text"}
  ]
}
PROMPT;
    }

    /**
     * Extract JSON from a possibly-markdown-wrapped response.
     */
    private function extractJson(string $raw): ?array
    {
        // Strip markdown code fences
        $cleaned = preg_replace('/```(?:json)?\s*|```\s*$/m', '', $raw);
        $cleaned = trim($cleaned);

        // Try direct parse
        $parsed = json_decode($cleaned, true);
        if (is_array($parsed)) return $parsed;

        // Try to find a JSON block
        if (preg_match('/\{[\s\S]*\}/', $cleaned, $m)) {
            $parsed = json_decode($m[0], true);
            if (is_array($parsed)) return $parsed;
        }

        return null;
    }
}
