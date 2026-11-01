<?php

namespace App\Services;

use App\Models\User;
use Illuminate\Support\Facades\DB;

/**
 * Handing a post over to the next person (BITAC, 2026-11-01):
 *
 *   "Mr. Mir Md. Anisuzzaman j kaj gulu kore gese, ja approve kore gese, j sign
 *    kore gese sob e tar name, tar sign onujayi record thakbe. notun j asse she
 *    ja krbe sudu tai tar name record thakbe."
 *
 * Accounts are made on the POST's email (xen.ied@…). Every record points at an
 * account id and shows that account's CURRENT name — and about fifteen PDFs
 * print the account's CURRENT default signature. So renaming the account for
 * the new person would rewrite every past approval to the new name, and reprint
 * old papers with the new signature. Instead:
 *
 *   - the outgoing account stays the outgoing person's — name, signatures,
 *     history untouched — and is retired (deactivated), its email moved to an
 *     archive address so the post's email is free;
 *   - a NEW account takes the post's email, with the same role(s), centre and
 *     posting, for the new person;
 *   - what was WAITING on the post moves to the new account (TRANSFERS below);
 *     nothing already done does.
 */
class PostHandover
{
    /**
     * label => [table, column, condition on the rest of the row]. Only work
     * still waiting on the post — a decision already taken stays with whoever
     * took it. Raw DB, so no centre scope hides a row from the move.
     */
    public const TRANSFERS = [
        'approval-chain places'          => ['quotation_approval_settings', 'approver_id', null],
        'gate pass approver places'      => ['gate_pass_approvers', 'user_id', null],
        'complaint decision-maker places' => ['complaint_decision_makers', 'user_id', null],
        'quotation approvals waiting'    => ['quotation_approvals', 'approver_id', ['status', ['pending']]],
        'quotation approvals forwarded'  => ['quotation_approvals', 'forwarded_to_user_id', ['status', ['pending']]],
        'cost estimate approvals waiting' => ['cost_estimate_approvals', 'approver_id', ['status', ['pending']]],
        'work order approvals waiting'   => ['work_order_approvals', 'approver_id', ['status', ['pending']]],
        'jobs held at a shop'            => ['work_order_sections', 'assigned_to', ['status!', ['completed']]],
        'operations named on'            => ['operation_steps', 'assigned_to', ['status!', ['completed', 'skipped']]],
        'draft letters to sign'          => ['rfq_letters', 'signatory_user_id', ['status', ['draft']]],
        'draft মূসক ৬.৩ to sign'         => ['musak_challans', 'signatory_user_id', ['status', ['draft']]],
        'bill letters to sign'           => ['invoices', 'signatory_user_id', ['letter_issued_at', null]],
        'draft notes'                    => ['office_notes', 'created_by', ['status', ['draft', 'returned']]],
        'consultancy requests assigned'  => ['consultancy_requests', 'assigned_to', ['status', ['pending', 'accepted']]],
    ];

    /** What would move, label => count, non-empty only — for the dialog. */
    public static function preview(User $from): array
    {
        $out = [];
        foreach (self::TRANSFERS as $label => $spec) {
            $n = self::query($from->id, $spec)->count();
            if ($n) $out[$label] = $n;
        }

        return $out;
    }

    /**
     * Retire $from, open the post's new account, move what was waiting.
     *
     * @param  array{name:string,password:string,phone?:?string,designation?:?string}  $new
     * @return array{0: User, 1: array<string,int>}  the new account, and what moved
     */
    public static function handOver(User $from, array $new, User $by): array
    {
        return DB::transaction(function () use ($from, $new, $by) {
            $postEmail = $from->email;
            $roles     = $from->getRoleNames()->all();

            // Free the post's email; the archive address still says whose it was.
            [$local, $domain] = array_pad(explode('@', $postEmail, 2), 2, 'bitac.local');
            $from->forceFill([
                'email'               => mb_substr($local, 0, 150) . '.handed-over-' . now()->format('Ymd-His') . '@' . $domain,
                'is_active'           => false,
                'deactivated_at'      => now(),
                'deactivation_reason' => "Post handed over to {$new['name']} on " . now()->format('d M Y') . '.',
                'handed_over_at'      => now(),
            ])->save();

            $to = User::create([
                'name'        => $new['name'],
                'email'       => $postEmail,
                'password'    => $new['password'],              // the cast hashes it
                'phone'       => $new['phone'] ?? null,
                'designation' => ($new['designation'] ?? null) ?: $from->designation,
                'center_id'   => $from->center_id,
                'section_id'  => $from->section_id,
                'is_active'   => true,
            ]);
            $to->syncRoles($roles);
            $from->forceFill(['handed_over_to_id' => $to->id])->save();

            $moved = [];
            foreach (self::TRANSFERS as $label => $spec) {
                $n = self::query($from->id, $spec)->update([$spec[1] => $to->id]);
                if ($n) $moved[$label] = $n;
            }

            \Log::info('Post handed over', ['from' => $from->id, 'to' => $to->id, 'by' => $by->id, 'moved' => $moved]);

            return [$to, $moved];
        });
    }

    private static function query(int $userId, array $spec)
    {
        [$table, $column, $cond] = $spec;
        $q = DB::table($table)->where($column, $userId);
        if ($cond) {
            [$col, $values] = $cond;
            if ($values === null)           $q->whereNull($col);
            elseif (str_ends_with($col, '!')) $q->where(fn ($w) => $w->whereNotIn(rtrim($col, '!'), $values)->orWhereNull(rtrim($col, '!')));
            else                             $q->whereIn($col, $values);
        }

        return $q;
    }
}
