<?php

namespace Database\Seeders;

use App\Models\Customer;
use App\Models\JobCategory;
use App\Models\Product;
use App\Models\Rfq;
use App\Models\RfqItem;
use App\Models\User;
use App\Models\WorkOrder;
use App\Models\WorkOrderItem;
use App\Services\JobNumberService;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

/**
 * Creates realistic test data at every workflow stage so you can manually
 * test end-to-end paths repeatedly. Each stage has multiple entries so you
 * can burn one and still have backups.
 *
 * Idempotent — uses `[SAMPLE]` prefix on RFQ notes / WO notes so it can be
 * cleaned up easily (`WorkOrder::where('notes','like','[SAMPLE]%')->delete()`).
 *
 * Stages covered:
 *   1. RFQs — 5 fresh `pending` (3 staff, 2 customer-portal)
 *   2. WOs — 6 at various stages: draft → approved → in_production → qc_passed
 *           → ready_for_delivery → delivered (1 missing completion cert)
 */
class SampleWorkflowSeeder extends Seeder
{
    public function run(): void
    {
        $customers = Customer::limit(8)->get();
        $products  = Product::limit(8)->get();
        $jobCats   = JobCategory::limit(5)->get();
        $admin     = User::orderBy('id')->first();
        $centerId  = $admin->center_id ?? 1;

        if ($customers->isEmpty() || $products->isEmpty()) {
            $this->command?->error('No customers or products to seed against. Run base seeders first.');
            return;
        }

        $this->command?->info('Seeding fresh RFQs (pending, awaiting cost estimate)…');
        $this->seedRfqs($customers, $products, $jobCats, $admin, $centerId);

        $this->command?->info('Seeding Work Orders at various production stages…');
        $this->seedWorkOrders($customers, $products, $jobCats, $admin, $centerId);

        $this->command?->info('Done. Test data created.');
    }

    /**
     * 5 RFQs sitting at status='pending'. IED can pick any one and walk it
     * through Cost Estimate → Quotation → Work Order.
     */
    private function seedRfqs($customers, $products, $jobCats, User $admin, int $centerId): void
    {
        $samples = [
            [
                'customer_idx'    => 0, 'product_idx' => 0, 'source' => 'staff',
                'customer_ref_no' => 'PO-ACI-2026-0287',
                'job_type'        => 'regular',
                'required_by'     => now()->addDays(30)->toDateString(),
                'notes'           => '[SAMPLE] Centrifugal pump impellers for ACI Motors assembly line. Urgent. Material SS304, balance grade G2.5.',
                'items'           => [
                    ['desc' => 'Centrifugal Pump Impeller Ø180mm, SS304, 6-vane closed-type', 'qty' => 25, 'unit' => 'pcs'],
                    ['desc' => 'Impeller Lock Nut M30 × 2.0, SS316, hex flange',              'qty' => 25, 'unit' => 'pcs'],
                ],
            ],
            [
                'customer_idx'    => 1, 'product_idx' => 1, 'source' => 'staff',
                'customer_ref_no' => 'BR-MECH-2026-0042',
                'job_type'        => 'regular',
                'required_by'     => now()->addDays(45)->toDateString(),
                'notes'           => '[SAMPLE] Refurbishment of 50 worn brake blocks from BR MG locomotive fleet. Hardness 220 BHN min.',
                'items'           => [
                    ['desc' => 'Locomotive Composite Brake Block, BG class, BR spec BR-7821', 'qty' => 50, 'unit' => 'pcs'],
                ],
            ],
            [
                'customer_idx'    => 2, 'product_idx' => 2, 'source' => 'staff',
                'customer_ref_no' => 'CARW-SM-2026-019',
                'job_type'        => 'regular',
                'required_by'     => now()->addDays(60)->toDateString(),
                'notes'           => '[SAMPLE] Sugar mill top roller shaft repair — journal build-up + induction hardening + balancing.',
                'items'           => [
                    ['desc' => 'Sugar Mill Top Roller Shaft EN-19, Ø250×3200mm, journal build-up', 'qty' => 1, 'unit' => 'pcs'],
                ],
            ],
            [
                'customer_idx'    => 3, 'product_idx' => 3, 'source' => 'customer_portal',
                'customer_ref_no' => 'BPDB-GHO-2026-T4-008',
                'job_type'        => 'rnd',
                'required_by'     => now()->addDays(90)->toDateString(),
                'notes'           => '[SAMPLE] Submitted via customer portal — BPDB Ghorashal Unit-4 turbine refurb kit.',
                'items'           => [
                    ['desc' => 'Turbine Blade Set, MP stage, 12%Cr stainless, Ø450 root × 180 height', 'qty' => 12, 'unit' => 'set'],
                    ['desc' => 'Blade Lock Pin, hardened tool steel, Ø8 × 45mm',                       'qty' => 24, 'unit' => 'pcs'],
                    ['desc' => 'Diaphragm Seal Ring, bronze, Ø600 OD × Ø580 ID × 8mm',                 'qty' => 4,  'unit' => 'pcs'],
                ],
            ],
            [
                'customer_idx'    => 4, 'product_idx' => 4, 'source' => 'customer_portal',
                'customer_ref_no' => 'WAL-TI-2026-156',
                'job_type'        => 'regular',
                'required_by'     => now()->addDays(20)->toDateString(),
                'notes'           => '[SAMPLE] Tooling for stamping line — submitted via portal.',
                'items'           => [
                    ['desc' => 'Precision Stamping Die Set, D2 tool steel, hardness 58-60 HRC', 'qty' => 4, 'unit' => 'set'],
                ],
            ],
        ];

        foreach ($samples as $s) {
            $customer = $customers->get($s['customer_idx']) ?? $customers->first();
            DB::transaction(function () use ($s, $customer, $jobCats, $admin, $centerId, $products) {
                $rfq = Rfq::create([
                    'center_id'       => $centerId,
                    'customer_id'     => $customer->id,
                    'job_category_id' => optional($jobCats->random())->id,
                    'customer_ref_no' => $s['customer_ref_no'],
                    'job_type'        => $s['job_type'],
                    'required_by'     => $s['required_by'],
                    'notes'           => $s['notes'],
                    'status'          => 'pending',
                    'source'          => $s['source'],
                    'created_by'      => $s['source'] === 'customer_portal' ? null : $admin->id,
                ]);

                foreach ($s['items'] as $item) {
                    RfqItem::create([
                        'rfq_id'           => $rfq->id,
                        'product_id'       => $products->random()->id,
                        'job_description'  => $item['desc'],
                        'quantity'         => $item['qty'],
                        'unit'             => $item['unit'],
                        'reference_type'   => 'none',
                    ]);
                }
            });
        }
    }

    /**
     * 6 Work Orders covering every production stage. Each has a job_number,
     * minimal product/quantity, and a notes hint about what stage to test.
     */
    private function seedWorkOrders($customers, $products, $jobCats, User $admin, int $centerId): void
    {
        // Each entry: ['status' => ..., 'hint' => ...]
        $stages = [
            ['status' => 'draft',              'hint' => 'Just-created WO awaiting approval. Test the approve flow.'],
            ['status' => 'approved',           'hint' => 'Approved — ready for shop floor. Test "Start Production" → in_production.'],
            ['status' => 'in_production',     'hint' => 'On shop floor now. Test job execution logging + QC submission.'],
            ['status' => 'qc_passed',         'hint' => 'QC passed — ready to schedule delivery. Test creating a Delivery Order.'],
            ['status' => 'ready_for_delivery','hint' => 'Packed, awaiting dispatch. Test marking delivered.'],
            ['status' => 'delivered',         'hint' => 'Delivered — test Completion Certificate from customer side.'],
        ];

        $jobSvc = app(JobNumberService::class);
        $year   = now()->year;

        foreach ($stages as $i => $stage) {
            $customer = $customers->get($i % $customers->count()) ?? $customers->first();
            $product  = $products->get($i % $products->count()) ?? $products->first();

            DB::transaction(function () use ($stage, $customer, $product, $jobCats, $admin, $centerId, $jobSvc, $year, $i) {
                $woNumber = 'WO-' . $year . '-' . str_pad((string) (9000 + $i), 5, '0', STR_PAD_LEFT);

                $wo = WorkOrder::create([
                    'center_id'       => $centerId,
                    'wo_number'       => $woNumber,
                    'job_number'      => method_exists($jobSvc, 'next') ? $jobSvc->next() : null,
                    'customer_id'     => $customer->id,
                    'product_id'      => $product->id,
                    'job_category_id' => optional($jobCats->random())->id,
                    'quantity'        => 10 + ($i * 5),
                    'priority'        => $i === 0 ? 'urgent' : 'normal',
                    'status'          => $stage['status'],
                    'due_date'        => now()->addDays(15 + $i * 5)->toDateString(),
                    'notes'           => '[SAMPLE] ' . $stage['hint'],
                    'created_by'      => $admin->id,
                ]);

                // Add a single item line
                WorkOrderItem::create([
                    'work_order_id' => $wo->id,
                    'job_number'    => $wo->job_number,
                    'product_id'    => $product->id,
                    'description'   => $product->name,
                    'quantity'      => $wo->quantity,
                    'unit'          => 'pcs',
                    'status'        => $stage['status'],
                ]);

                // Stamp PCD handoff for anything past 'draft'
                if (in_array($stage['status'], ['approved', 'in_production', 'qc_passed', 'ready_for_delivery', 'delivered'], true)) {
                    $wo->update([
                        'pcd_handoff_at' => now()->subDays(10 - $i),
                        'pcd_handoff_by' => $admin->id,
                    ]);
                }
                // Stamp shops release for in_production+
                if (in_array($stage['status'], ['in_production', 'qc_passed', 'ready_for_delivery', 'delivered'], true)) {
                    $wo->update([
                        'released_to_shops_at' => now()->subDays(8 - $i),
                        'released_by'          => $admin->id,
                    ]);
                }
            });
        }
    }
}
