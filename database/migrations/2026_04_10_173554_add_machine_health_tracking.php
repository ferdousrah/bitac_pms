<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        // Extend machines with asset + health fields
        Schema::table('machines', function (Blueprint $table) {
            // Add description if missing
            if (!Schema::hasColumn('machines', 'description')) {
                $table->text('description')->nullable()->after('rate_group_c');
            }

            // Asset info
            $table->string('manufacturer', 100)->nullable()->after('rate_group_c');
            $table->string('model', 100)->nullable()->after('manufacturer');
            $table->string('serial_number', 100)->nullable()->after('model');
            $table->date('purchased_on')->nullable()->after('serial_number');
            $table->date('warranty_expires_on')->nullable()->after('purchased_on');
            $table->decimal('asset_value', 12, 2)->nullable()->after('warranty_expires_on');
            $table->string('location', 100)->nullable()->after('asset_value');

            // Real-time operational state (separate from status which represents availability)
            $table->enum('current_state', ['running', 'idle', 'setup', 'maintenance', 'breakdown', 'offline'])
                ->default('idle')->after('status');
            $table->timestamp('state_changed_at')->nullable()->after('current_state');

            // Maintenance tracking
            $table->date('last_maintenance_date')->nullable()->after('state_changed_at');
            $table->date('next_maintenance_date')->nullable()->after('last_maintenance_date');
            $table->unsignedSmallInteger('maintenance_interval_days')->nullable()->after('next_maintenance_date');
            $table->unsignedInteger('maintenance_interval_hours')->nullable()->after('maintenance_interval_days');

            // Runtime tracking (auto-updated by JobExecution close events)
            $table->decimal('total_runtime_hours', 10, 2)->default(0)->after('maintenance_interval_hours');
            $table->decimal('runtime_since_maintenance', 10, 2)->default(0)->after('total_runtime_hours');

            $table->index(['current_state', 'status']);
            $table->index('next_maintenance_date');
        });

        // Update old machines `status` allowed values via just keeping it; current_state is the new authoritative.

        // Maintenance event log
        Schema::create('machine_maintenance_logs', function (Blueprint $table) {
            $table->id();
            $table->foreignId('machine_id')->constrained()->cascadeOnDelete();
            $table->enum('type', ['preventive', 'corrective', 'breakdown', 'inspection', 'overhaul'])->default('preventive');
            $table->date('performed_on');
            $table->foreignId('performed_by')->nullable()->constrained('users')->nullOnDelete();
            $table->string('technician_name', 100)->nullable();   // for external technicians
            $table->text('description');
            $table->json('parts_replaced')->nullable();           // [{name, qty, cost}]
            $table->decimal('cost', 12, 2)->nullable();
            $table->decimal('downtime_hours', 8, 2)->nullable();  // how long machine was down
            $table->date('next_due_date')->nullable();            // updates machine.next_maintenance_date
            $table->text('notes')->nullable();
            $table->timestamps();

            $table->index(['machine_id', 'performed_on']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('machine_maintenance_logs');
        Schema::table('machines', function (Blueprint $table) {
            $table->dropColumn([
                'manufacturer', 'model', 'serial_number', 'purchased_on', 'warranty_expires_on',
                'asset_value', 'location', 'current_state', 'state_changed_at',
                'last_maintenance_date', 'next_maintenance_date',
                'maintenance_interval_days', 'maintenance_interval_hours',
                'total_runtime_hours', 'runtime_since_maintenance',
            ]);
        });
    }
};
