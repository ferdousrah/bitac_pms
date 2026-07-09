<?php

namespace App\Support;

/**
 * Standard approval-chain role labels for Cost Estimates & Quotations.
 *
 * Work cycle: the document is PREPARED by its creator (not an approver),
 * then the chain runs — the FIRST approver "Checks" it, the LAST approver
 * gives final "Approval", any approvers in between are "Reviewers".
 *
 *   1 approver  → [Approved By]
 *   2 approvers → [Checked By, Approved By]
 *   3 approvers → [Checked By, Reviewer 2, Approved By]
 *   N approvers → [Checked By, Reviewer 2 … Reviewer N-1, Approved By]
 */
class ApprovalChainLabels
{
    /** The full ordered list of labels for a chain of $total approvers. */
    public static function forCount(int $total): array
    {
        if ($total <= 1) return ['Approved By'];
        $labels = [];
        for ($i = 0; $i < $total; $i++) {
            $labels[] = self::forIndex($i, $total);
        }
        return $labels;
    }

    /** Label for the approver at 0-based $index in a chain of $total. */
    public static function forIndex(int $index, int $total): string
    {
        if ($total <= 1) return 'Approved By';
        if ($index === 0) return 'Checked By';
        if ($index === $total - 1) return 'Approved By';
        return 'Reviewer ' . ($index + 1);
    }
}
