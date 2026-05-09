<?php

namespace App\Http\Controllers;

use App\Models\CostEstimate;
use App\Models\CostEstimateApproval;
use App\Models\EntityComment;
use App\Models\Quotation;
use App\Models\QuotationApproval;
use App\Services\NotifyService;
use Illuminate\Http\Request;

class EntityCommentController extends Controller
{
    /**
     * Post a new comment on a cost estimate or quotation.
     * Notifies all participants (creator + approvers + prior commenters) except the author.
     */
    public function store(Request $request)
    {
        $data = $request->validate([
            'entity_type' => 'required|in:cost_estimate,quotation',
            'entity_id'   => 'required|integer',
            'body'        => 'required|string|max:3000',
            'kind'        => 'nullable|in:comment,question,clarification',
        ]);

        $entity = $this->resolveEntity($data['entity_type'], (int) $data['entity_id']);
        if (!$entity) {
            return back()->with('error', 'Item not found.');
        }

        $userId = auth()->id();
        $comment = EntityComment::create([
            'entity_type' => $data['entity_type'],
            'entity_id'   => $data['entity_id'],
            'user_id'     => $userId,
            'body'        => $data['body'],
            'kind'        => $data['kind'] ?? 'comment',
            'center_id'   => $entity->center_id ?? null,
        ]);

        $this->notifyParticipants($comment, $entity, $data['entity_type']);

        return back()->with('success', 'Comment posted.');
    }

    /**
     * Delete your own comment. Admins can delete any.
     */
    public function destroy(EntityComment $comment)
    {
        $user = auth()->user();
        $isAuthor = $comment->user_id === $user->id;
        $isAdmin  = method_exists($user, 'hasRole') && $user->hasRole('super_admin');

        if (!$isAuthor && !$isAdmin) {
            abort(403, 'You can only delete your own comments.');
        }

        $comment->delete();
        return back()->with('success', 'Comment deleted.');
    }

    /* ─── helpers ─────────────────────────────────────────── */

    private function resolveEntity(string $type, int $id)
    {
        return match ($type) {
            'cost_estimate' => CostEstimate::find($id),
            'quotation'     => Quotation::find($id),
            default         => null,
        };
    }

    private function notifyParticipants(EntityComment $comment, $entity, string $type): void
    {
        $authorId = $comment->user_id;
        $participantIds = collect();

        // Entity creator
        if ($entity->created_by) $participantIds->push($entity->created_by);

        // Approvers on the approval chain
        if ($type === 'cost_estimate') {
            $approverIds = CostEstimateApproval::where('cost_estimate_id', $entity->id)
                ->pluck('approver_id')->toArray();
        } else {
            $approverIds = QuotationApproval::where('quotation_id', $entity->id)
                ->pluck('approver_id')->toArray();
        }
        $participantIds = $participantIds->merge($approverIds);

        // Prior commenters
        $priorCommenterIds = EntityComment::forEntity($type, $entity->id)
            ->where('id', '!=', $comment->id)
            ->pluck('user_id')->toArray();
        $participantIds = $participantIds->merge($priorCommenterIds);

        // Dedupe + exclude the author
        $recipients = $participantIds->unique()->filter(fn($id) => $id && $id !== $authorId)->values()->toArray();
        if (empty($recipients)) return;

        $authorName = $comment->user?->name ?? 'Someone';
        $label = $type === 'cost_estimate'
            ? ($entity->estimate_no ?? "Estimate #{$entity->id}")
            : "Quotation #{$entity->id}";
        $link  = $type === 'cost_estimate'
            ? "/cost-estimates/{$entity->id}"
            : "/quotations/{$entity->id}";

        $snippet = mb_strimwidth($comment->body, 0, 200, '…');

        NotifyService::send(
            $recipients,
            $type === 'cost_estimate' ? 'estimate_comment' : 'quotation_comment',
            "New comment on {$label}",
            "{$authorName}: \"{$snippet}\"",
            $link,
            'fi-rr-comment',
            'blue',
        );
    }
}
