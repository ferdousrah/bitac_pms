<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('service_demand_logs', function (Blueprint $t) {
            $t->id();
            $t->foreignId('center_id')->nullable()->constrained('centers')->nullOnDelete();

            $t->string('requested_service', 200);
            $t->enum('service_category', [
                'machining', 'welding', 'heat_treatment', 'casting',
                'surface_treatment', 'inspection', 'training',
                'fabrication', 'repair', 'design_consultancy', 'other',
            ]);

            // Who asked (optional — sometimes just a verbal walk-in inquiry)
            $t->string('requester_name', 150)->nullable();
            $t->string('requester_organization', 200)->nullable();
            $t->string('requester_contact', 100)->nullable();
            $t->enum('requester_type', [
                'existing_customer', 'prospective_customer',
                'individual', 'student', 'organization',
            ])->default('prospective_customer');

            // Context + strategic indicators
            $t->text('context');
            $t->enum('expected_volume', ['one_time', 'occasional', 'frequent', 'regular'])->default('occasional');
            $t->enum('potential_value', ['low', 'medium', 'high'])->default('medium');

            $t->foreignId('logged_by')->constrained('users')->cascadeOnDelete();
            $t->date('logged_date');
            $t->text('notes')->nullable();

            $t->timestamps();

            $t->index('service_category');
            $t->index('logged_date');
            $t->index(['service_category', 'potential_value']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('service_demand_logs');
    }
};
