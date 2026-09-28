<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Stakeholder forms go to CLIENTS, not to a separate directory.
 *
 * BITAC's stakeholders are their customers, so keeping a second list of people
 * — with the organisation typed in again as free text — meant maintaining the
 * same names twice and never being sure which copy was current. The
 * `stakeholders` table goes; invitations and responses point at `customers`.
 *
 * ⚠️ Nothing is thrown away blind. Before the table is dropped:
 *   - invitations and responses are matched to a customer **by email**;
 *   - any response that can't be matched keeps its author's name and
 *     organisation inline (the `anonymous_*` columns that already exist for
 *     public submissions), so no answer is left without an author.
 *
 * Rows that pointed at a non-customer (a ministry official, an academic
 * partner) therefore survive as readable history, they simply no longer hang
 * off a directory record.
 */
return new class extends Migration
{
    public function up(): void
    {
        // ── 1. Invitations get a customer ────────────────────────────────
        if (! Schema::hasColumn('stakeholder_form_invitations', 'customer_id')) {
            Schema::table('stakeholder_form_invitations', function (Blueprint $t) {
                $t->foreignId('customer_id')->nullable()->after('form_id')
                    ->constrained('customers')->cascadeOnDelete();
            });
        }

        if (! Schema::hasColumn('stakeholder_form_responses', 'customer_id')) {
            Schema::table('stakeholder_form_responses', function (Blueprint $t) {
                $t->foreignId('customer_id')->nullable()->after('invitation_id')
                    ->constrained('customers')->nullOnDelete();
            });
        }

        // ── 2. Carry the old links across, matching on email ─────────────
        if (Schema::hasTable('stakeholders')) {
            foreach (['stakeholder_form_invitations', 'stakeholder_form_responses'] as $table) {
                if (! Schema::hasColumn($table, 'stakeholder_id')) continue;

                DB::statement("
                    UPDATE {$table} t
                    JOIN stakeholders s ON s.id = t.stakeholder_id
                    JOIN customers c ON c.email = s.email
                    SET t.customer_id = c.id
                    WHERE t.customer_id IS NULL
                ");
            }

            // Anything left unmatched was never a customer. Keep the author on
            // the response itself so the answers stay attributable.
            if (Schema::hasColumn('stakeholder_form_responses', 'stakeholder_id')) {
                DB::statement("
                    UPDATE stakeholder_form_responses r
                    JOIN stakeholders s ON s.id = r.stakeholder_id
                    SET r.anonymous_name = COALESCE(NULLIF(r.anonymous_name, ''), s.name),
                        r.anonymous_organization = COALESCE(NULLIF(r.anonymous_organization, ''), s.organization)
                    WHERE r.customer_id IS NULL
                ");
            }
        }

        // ── 3. Swap the old link for the new one ─────────────────────────
        //
        // ⚠️ Order matters. The old `(form_id, stakeholder_id)` unique is what
        // backs the form_id foreign key, and MySQL refuses to drop the last
        // index a foreign key sits on. Create the replacement FIRST — it also
        // leads with form_id — then remove the old column and finally the old
        // index. Doing it the obvious way round fails with errno 1553.
        if (! $this->hasIndex('stakeholder_form_invitations', 'sfi_form_customer_unique')) {
            Schema::table('stakeholder_form_invitations', function (Blueprint $t) {
                $t->unique(['form_id', 'customer_id'], 'sfi_form_customer_unique');
            });
        }

        // The foreign key and the column are dropped separately and each is
        // checked first: a half-applied earlier run can leave the key gone but
        // the column still there, and dropConstrainedForeignId would then die
        // on a key that no longer exists.
        foreach (['stakeholder_form_invitations', 'stakeholder_form_responses'] as $table) {
            $this->dropForeignIfExists($table, "{$table}_stakeholder_id_foreign");
        }

        // Now that the replacement unique exists (and also leads with form_id,
        // so the form_id foreign key still has an index), the old composite can
        // go. It has to go BEFORE the column: MySQL will not drop a column that
        // an index is still built on.
        $this->dropIndexIfExists(
            'stakeholder_form_invitations',
            'stakeholder_form_invitations_form_id_stakeholder_id_unique'
        );

        foreach (['stakeholder_form_invitations', 'stakeholder_form_responses'] as $table) {
            if (Schema::hasColumn($table, 'stakeholder_id')) {
                Schema::table($table, fn (Blueprint $t) => $t->dropColumn('stakeholder_id'));
            }
        }

        // ── 4. The directory itself ──────────────────────────────────────
        Schema::dropIfExists('stakeholders');
    }

    public function down(): void
    {
        // The directory can be recreated empty, but the people in it are gone —
        // their identities live on the responses now. Recreating the shape is
        // the most an automatic rollback can honestly do.
        if (! Schema::hasTable('stakeholders')) {
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
        }

        foreach (['stakeholder_form_invitations', 'stakeholder_form_responses'] as $table) {
            if (! Schema::hasColumn($table, 'stakeholder_id')) {
                Schema::table($table, function (Blueprint $t) {
                    $t->foreignId('stakeholder_id')->nullable()->constrained('stakeholders')->nullOnDelete();
                });
            }
        }

        $this->dropIndexIfExists('stakeholder_form_invitations', 'sfi_form_customer_unique');

        foreach (['stakeholder_form_invitations', 'stakeholder_form_responses'] as $table) {
            if (Schema::hasColumn($table, 'customer_id')) {
                Schema::table($table, fn (Blueprint $t) => $t->dropConstrainedForeignId('customer_id'));
            }
        }
    }

    private function hasIndex(string $table, string $index): bool
    {
        return DB::table('information_schema.STATISTICS')
            ->where('TABLE_SCHEMA', DB::getDatabaseName())
            ->where('TABLE_NAME', $table)
            ->where('INDEX_NAME', $index)
            ->exists();
    }

    private function dropIndexIfExists(string $table, string $index): void
    {
        if ($this->hasIndex($table, $index)) {
            Schema::table($table, fn (Blueprint $t) => $t->dropUnique($index));
        }
    }

    private function dropForeignIfExists(string $table, string $constraint): void
    {
        $exists = DB::table('information_schema.TABLE_CONSTRAINTS')
            ->where('TABLE_SCHEMA', DB::getDatabaseName())
            ->where('TABLE_NAME', $table)
            ->where('CONSTRAINT_NAME', $constraint)
            ->where('CONSTRAINT_TYPE', 'FOREIGN KEY')
            ->exists();

        if ($exists) {
            Schema::table($table, fn (Blueprint $t) => $t->dropForeign($constraint));
        }
    }
};
