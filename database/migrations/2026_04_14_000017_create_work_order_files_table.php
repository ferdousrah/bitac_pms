<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Attachments tied to a Work Order — especially the **customer PO / WO copy** that
 * arrives when the customer accepts our quotation. Audit / legal proof that the
 * job was authorised by the customer. Also holds drawings, specs, internal docs.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('work_order_files', function (Blueprint $table) {
            $table->id();
            $table->foreignId('work_order_id')->constrained()->cascadeOnDelete();
            $table->foreignId('uploaded_by')->nullable()->constrained('users')->nullOnDelete();
            $table->string('kind', 40)->default('customer_po');   // customer_po | drawing | spec | other
            $table->string('stored_path');
            $table->string('original_name');
            $table->string('mime_type')->nullable();
            $table->unsignedBigInteger('size_bytes')->nullable();
            $table->text('description')->nullable();
            $table->timestamps();

            $table->index(['work_order_id', 'kind']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('work_order_files');
    }
};
