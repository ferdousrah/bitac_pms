<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * The production-letter registers IED and PCD keep (BITAC, 2026-10-31):
 * আগত চিঠির রেকর্ড (letters received) and প্রেরিত চিঠির রেকর্ড (letters sent) —
 * ক্রমিক নং · প্রেরক · প্রাপক · স্মারক নম্বর · তারিখ · মন্তব্য.
 *
 * ONE table: the two registers of the two desks differ only in which desk
 * keeps them and which way the letter went. The Sl is the row's place in
 * the list, not stored.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('letter_registers', function (Blueprint $t) {
            $t->id();
            $t->foreignId('center_id')->nullable()->constrained('centers')->nullOnDelete();
            $t->string('desk', 10);          // ied | pcd
            $t->string('direction', 10);     // in (আগত) | out (প্রেরিত)
            $t->string('sender', 255);       // প্রেরক
            $t->string('recipient', 255);    // প্রাপক
            $t->string('memo_no', 120)->nullable();   // স্মারক নম্বর
            $t->date('letter_date');         // তারিখ
            $t->text('remarks')->nullable(); // মন্তব্য
            // The scanned letter, optional — on the PRIVATE disk.
            $t->string('file_path')->nullable();
            $t->string('file_name')->nullable();
            $t->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $t->timestamps();

            $t->index(['center_id', 'desk', 'direction', 'letter_date']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('letter_registers');
    }
};
