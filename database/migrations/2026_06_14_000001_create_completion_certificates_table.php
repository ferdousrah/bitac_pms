<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('completion_certificates', function (Blueprint $t) {
            $t->id();
            $t->foreignId('center_id')->nullable()->constrained('centers')->nullOnDelete();
            $t->foreignId('work_order_id')->constrained('work_orders')->cascadeOnDelete();
            $t->foreignId('customer_id')->constrained('customers')->cascadeOnDelete();
            $t->string('certificate_number', 30)->unique();

            // 'uploaded'   — customer uploaded a signed PDF/image on their letterhead.
            // 'self_issued'— customer filled the in-portal form and signed digitally.
            $t->enum('mode', ['uploaded', 'self_issued']);

            // Issuer identity — who from the customer's side issued the cert.
            $t->string('issued_by_name', 150);
            $t->string('issued_by_designation', 150)->nullable();
            $t->date('issued_date');

            // Optional satisfaction signal — useful for BITAC's internal quality metric.
            $t->unsignedTinyInteger('rating')->nullable(); // 1..5
            $t->text('remarks')->nullable();

            // File paths — exactly one of these will be populated per row.
            $t->string('uploaded_file_path')->nullable();   // mode=uploaded
            $t->string('generated_pdf_path')->nullable();   // mode=self_issued — system-generated PDF
            $t->string('signature_path')->nullable();       // mode=self_issued — captured signature image

            $t->timestamps();

            $t->index(['work_order_id']);
            $t->index(['customer_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('completion_certificates');
    }
};
