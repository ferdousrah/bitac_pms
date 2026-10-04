<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;

/**
 * Bring what the bills already say into the new ledger, and open the module up.
 *
 * ⚠️ Without the backfill every bill that has been marked paid would read as
 * unpaid the moment this deploys, because the due is now derived from the
 * ledger and the ledger would be empty. One row per already-paid bill, built
 * from the columns the old "Mark as Paid" wrote, keeps every figure on screen
 * exactly as the accounts desk left it.
 *
 * `invoices.paid_amount` / `paid_at` / `payment_method` / `payment_reference` /
 * `payment_notes` / `marked_paid_by` become **read-only** after this — nothing
 * writes them again (the same shape as `users.signature_path`).
 *
 * Idempotent: a bill that already has a payment row is left alone, so a
 * half-applied run can simply be run again.
 */
return new class extends Migration
{
    public function up(): void
    {
        // ── Permissions ────────────────────────────────────────────────────
        // ⚠️ A seeder edit alone only helps a fresh install; on the live
        // database the menu would appear for nobody.
        foreach (['view payments', 'record payments', 'delete payments'] as $name) {
            Permission::firstOrCreate(['name' => $name, 'guard_name' => 'web']);
        }

        // The accounts desk collects the money.
        if ($finance = Role::where('name', 'finance-officer')->first()) {
            $finance->givePermissionTo('view payments', 'record payments', 'delete payments');
        }
        // Management reads the dues but does not key receipts.
        if ($management = Role::where('name', 'management')->first()) {
            $management->givePermissionTo('view payments');
        }
        // ⚠️ super-admin is deliberately NOT granted: Gate::before already
        // lets them open anything, so the grant would only add noise.

        app()[\Spatie\Permission\PermissionRegistrar::class]->forgetCachedPermissions();

        // ── Backfill ───────────────────────────────────────────────────────
        $legacy = DB::table('invoices')
            ->whereNotExists(fn ($q) => $q->select(DB::raw(1))->from('payments')
                ->whereColumn('payments.invoice_id', 'invoices.id'))
            ->where(fn ($q) => $q->where('paid_amount', '>', 0)->orWhere('status', 'paid'))
            ->orderBy('id')
            ->get();

        $seq = 0;

        foreach ($legacy as $invoice) {
            // A bill flipped to paid without an amount was settled in full —
            // that is what the button meant.
            $gross = (float) ($invoice->paid_amount ?: 0);
            if ($gross <= 0) {
                $gross = (float) $invoice->total_amount;
            }

            $paidOn = $invoice->paid_at ?? $invoice->issued_at ?? $invoice->created_at;

            DB::table('payments')->insert([
                'center_id'     => $invoice->center_id,
                'customer_id'   => $invoice->customer_id,
                'work_order_id' => $invoice->work_order_id,
                'invoice_id'    => $invoice->id,
                'payment_no'    => 'RCV-LEGACY-' . str_pad((string) (++$seq), 4, '0', STR_PAD_LEFT),
                'kind'          => 'against_bill',
                'paid_on'       => $paidOn ? date('Y-m-d', strtotime((string) $paidOn)) : date('Y-m-d'),
                'gross_amount'  => $gross,
                'method'        => $invoice->payment_method,
                'reference'     => $invoice->payment_reference,
                'notes'         => trim((string) $invoice->payment_notes),
                'recorded_by'   => $invoice->marked_paid_by,
                'created_at'    => now(),
                'updated_at'    => now(),
            ]);

            // The status now follows the ledger. A legacy part-payment that
            // was never flipped to paid becomes partially_paid, which is what
            // it always was.
            $status = $gross + 0.01 >= (float) $invoice->total_amount ? 'paid' : 'partially_paid';

            DB::table('invoices')->where('id', $invoice->id)->update(['status' => $status]);
        }
    }

    public function down(): void
    {
        DB::table('payments')->where('payment_no', 'like', 'RCV-LEGACY-%')->delete();

        foreach (['view payments', 'record payments', 'delete payments'] as $name) {
            Permission::where('name', $name)->where('guard_name', 'web')->delete();
        }
    }
};
