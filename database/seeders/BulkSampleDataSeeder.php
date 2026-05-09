<?php

namespace Database\Seeders;

use App\Models\CostEstimate;
use App\Models\CostEstimateLine;
use App\Models\Customer;
use App\Models\DeliveryOrder;
use App\Models\DowntimeEvent;
use App\Models\Invoice;
use App\Models\JobExecution;
use App\Models\Machine;
use App\Models\Material;
use App\Models\MaterialRequisition;
use App\Models\MaterialRequisitionItem;
use App\Models\Ncr;
use App\Models\OperationSheet;
use App\Models\OperationStep;
use App\Models\Operator;
use App\Models\Product;
use App\Models\QcInspection;
use App\Models\Quotation;
use App\Models\QuotationItem;
use App\Models\Rfq;
use App\Models\RfqItem;
use App\Models\Section;
use App\Models\User;
use App\Models\WorkOrder;
use Carbon\Carbon;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class BulkSampleDataSeeder extends Seeder
{
    private int $centerId;
    private $admin;
    private $sections;
    private $machines;
    private $operators;
    private $materials;
    private $customers;
    private $products;

    public function run(): void
    {
        $this->command->info('🏭 Seeding bulk sample data (6 months of production)...');

        $this->centerId = \App\Models\Center::first()->id ?? 1;
        app()->instance('current_center_id', $this->centerId);

        $this->admin     = User::first();
        $this->sections  = Section::pluck('id', 'code')->toArray();
        $this->machines  = Machine::all();
        $this->operators = Operator::all();
        $this->materials = Material::all();

        // ── Additional Customers ──
        $newCustomers = [
            ['name' => 'Dhaka WASA', 'contact_person' => 'Engr. Selim', 'email' => 'procurement@dwasa.org.bd', 'phone' => '02-8391234'],
            ['name' => 'Petrobangla', 'contact_person' => 'Md. Faruk', 'email' => 'store@petrobangla.org.bd', 'phone' => '02-9562345'],
            ['name' => 'BSRM Steel', 'contact_person' => 'Rashidul Hasan', 'email' => 'purchase@bsrm.com', 'phone' => '031-2891234'],
            ['name' => 'Meghna Group', 'contact_person' => 'Zahid Iqbal', 'email' => 'procurement@meghnagroup.com', 'phone' => '02-8873456'],
            ['name' => 'Jamuna Group', 'contact_person' => 'Imran Hossain', 'email' => 'purchase@jamunagroup.com', 'phone' => '02-9145678'],
            ['name' => 'Bangladesh Sugar & Food Industries', 'contact_person' => 'Md. Rafiq', 'email' => 'bsfic@gov.bd', 'phone' => '02-9116789'],
            ['name' => 'Bangladesh Textile Mills', 'contact_person' => 'Shaheda Begum', 'email' => 'btmc@gov.bd', 'phone' => '02-8317890'],
            ['name' => 'Bashundhara Group', 'contact_person' => 'Kamrul Hasan', 'email' => 'procurement@bashundhara.com', 'phone' => '02-8408901'],
        ];
        foreach ($newCustomers as $c) {
            Customer::firstOrCreate(['name' => $c['name']], array_merge($c, [
                'center_id' => $this->centerId, 'password' => Hash::make('customer123'), 'is_active' => true,
            ]));
        }
        $this->customers = Customer::all();
        $this->command->info("  ✓ Customers: {$this->customers->count()}");

        // ── Additional Products ──
        $newProducts = [
            ['name' => 'Turbine Blade', 'code' => 'PRD-TB-001', 'unit' => 'pcs', 'desc' => 'Gas turbine blade casting'],
            ['name' => 'Flywheel Assembly', 'code' => 'PRD-FW-001', 'unit' => 'pcs', 'desc' => 'Heavy duty flywheel'],
            ['name' => 'Valve Body', 'code' => 'PRD-VB-001', 'unit' => 'pcs', 'desc' => 'Gate valve body SS316'],
            ['name' => 'Sprocket Wheel', 'code' => 'PRD-SW-001', 'unit' => 'pcs', 'desc' => 'Chain sprocket hardened'],
            ['name' => 'Cylinder Liner', 'code' => 'PRD-CL-001', 'unit' => 'pcs', 'desc' => 'Engine cylinder liner CI'],
            ['name' => 'Crankshaft', 'code' => 'PRD-CS-001', 'unit' => 'pcs', 'desc' => 'Forged crankshaft EN8'],
            ['name' => 'Gearbox Housing', 'code' => 'PRD-GH-001', 'unit' => 'pcs', 'desc' => 'Aluminium gearbox casing'],
            ['name' => 'Spindle Assembly', 'code' => 'PRD-SA-001', 'unit' => 'pcs', 'desc' => 'Precision spindle for lathe'],
            ['name' => 'Die Block', 'code' => 'PRD-DB-002', 'unit' => 'pcs', 'desc' => 'Press die block tool steel'],
            ['name' => 'Pressure Vessel Nozzle', 'code' => 'PRD-PV-001', 'unit' => 'pcs', 'desc' => 'Pressure vessel connection nozzle'],
        ];
        foreach ($newProducts as $p) {
            Product::firstOrCreate(['code' => $p['code']], [
                'center_id' => $this->centerId, 'name' => $p['name'], 'code' => $p['code'], 'unit' => $p['unit'], 'description' => $p['desc'],
            ]);
        }
        $this->products = Product::all();
        $this->command->info("  ✓ Products: {$this->products->count()}");

        // ── Generate 6 months of pipeline data (25 pipelines) ──
        $statuses   = ['delivered', 'delivered', 'delivered', 'delivered', 'in_production', 'in_production', 'qc_hold', 'qc_passed', 'approved', 'draft'];
        $priorities = ['urgent', 'normal', 'normal', 'normal', 'low'];
        $groups     = ['A', 'B', 'B', 'C'];

        $woCounter = (int) WorkOrder::max('id') + 100;

        for ($i = 0; $i < 25; $i++) {
            $daysAgo  = rand(10, 180);
            $created  = now()->subDays($daysAgo);
            $customer = $this->customers->random();
            $product  = $this->products->random();
            $qty      = rand(5, 100);
            $status   = $statuses[$i % count($statuses)];
            $priority = $priorities[$i % count($priorities)];
            $group    = $groups[$i % count($groups)];

            $this->createPipeline($i, $woCounter + $i, $created, $customer, $product, $qty, $status, $priority, $group);
        }

        // ── Downtime Events ──
        $this->seedDowntimeEvents();

        $this->command->info('');
        $this->command->info('✅ Bulk sample data seeding complete!');
        $this->printStats();
    }

    private function createPipeline(int $idx, int $woNum, Carbon $created, $customer, $product, int $qty, string $status, string $priority, string $group): void
    {
        $matIdx   = rand(0, $this->materials->count() - 1);
        $material = $this->materials[$matIdx];

        // 1. RFQ
        $rfq = Rfq::create([
            'center_id' => $this->centerId, 'customer_id' => $customer->id,
            'customer_ref_no' => 'PO-' . strtoupper(substr($customer->name, 0, 3)) . '-' . (2026000 + $idx + 50),
            'required_by' => $created->copy()->addDays(rand(20, 45)),
            'reference_type' => ['none', 'drawing', 'physical_sample', 'both'][rand(0, 3)],
            'status' => in_array($status, ['draft']) ? 'pending' : 'quoted',
            'created_by' => $this->admin->id,
            'created_at' => $created, 'updated_at' => $created,
        ]);
        RfqItem::create([
            'rfq_id' => $rfq->id, 'product_id' => $product->id,
            'job_description' => $product->name, 'quantity' => $qty, 'unit' => $product->unit ?? 'pcs',
        ]);

        // 2. Cost Estimate
        $matCost   = (float) $material->rate_per_kg * rand(5, 25) * $qty;
        $machCost  = rand(2000, 10000) * $qty;
        $surfCost  = rand(300, 2000) * $qty;
        $otherCost = rand(100, 800) * $qty;
        $netCost   = $matCost + $machCost + $surfCost + $otherCost;
        $ohPct     = rand(10, 30);
        $vatPct    = 15;
        $overhead  = $netCost * ($ohPct / 100);
        $vat       = ($netCost + $overhead) * ($vatPct / 100);
        $grandTotal = $netCost + $overhead + $vat;

        $estimate = CostEstimate::create([
            'estimate_no' => CostEstimate::generateEstimateNo(),
            'rfq_id' => $rfq->id, 'customer_id' => $customer->id,
            'company_name' => $customer->name, 'job_name' => $product->name,
            'pricing_group' => $group, 'overhead_pct' => $ohPct, 'vat_pct' => $vatPct,
            'times_multiplier' => 1, 'job_quantity' => $qty,
            'material_cost' => $matCost, 'machining_cost' => $machCost,
            'surface_cost' => $surfCost, 'other_cost' => $otherCost,
            'net_cost' => $netCost, 'overhead_amount' => $overhead,
            'vat_amount' => $vat, 'total' => $netCost + $overhead + $vat, 'grand_total' => $grandTotal,
            'status' => 'finalized', 'created_by' => $this->admin->id,
            'created_at' => $created->copy()->addDays(1),
        ]);

        // Estimate lines
        foreach ([
            ['section' => 'material', 'desc' => $material->name, 'mat_id' => $material->id, 'qty' => rand(5, 25), 'rate' => $material->rate_per_kg],
            ['section' => 'machining', 'desc' => 'Turning', 'mat_id' => null, 'qty' => rand(2, 10), 'rate' => rand(300, 900)],
            ['section' => 'machining', 'desc' => 'Milling', 'mat_id' => null, 'qty' => rand(1, 6), 'rate' => rand(400, 1000)],
            ['section' => 'surface', 'desc' => 'Finishing', 'mat_id' => null, 'qty' => 1, 'rate' => rand(500, 3000)],
            ['section' => 'other', 'desc' => 'Miscellaneous', 'mat_id' => null, 'qty' => 1, 'rate' => rand(200, 1000)],
        ] as $seq => $line) {
            CostEstimateLine::create([
                'cost_estimate_id' => $estimate->id, 'section' => $line['section'],
                'material_id' => $line['mat_id'], 'description' => $line['desc'],
                'quantity' => $line['qty'], 'unit' => $line['section'] === 'material' ? 'kg' : 'hour',
                'rate' => $line['rate'], 'amount' => $line['qty'] * (float) $line['rate'], 'sequence' => $seq + 1,
            ]);
        }

        // 3. Quotation
        $quotStatus = match ($status) {
            'draft' => 'draft', 'approved' => 'approved', default => 'converted',
        };
        $quotation = Quotation::create([
            'center_id' => $this->centerId, 'rfq_id' => $rfq->id, 'customer_id' => $customer->id,
            'created_by' => $this->admin->id, 'version' => 1,
            'material_cost' => $matCost, 'labour_cost' => $machCost + $surfCost,
            'overhead_cost' => $overhead + $otherCost, 'profit_margin' => rand(10, 20),
            'discount' => 0, 'vat_rate' => $vatPct, 'vat_amount' => $vat,
            'total_amount' => $grandTotal, 'validity_days' => 30,
            'status' => $quotStatus, 'customer_po_no' => $rfq->customer_ref_no,
            'validity_expires_at' => $created->copy()->addDays(30),
            'created_at' => $created->copy()->addDays(2),
        ]);
        QuotationItem::create([
            'quotation_id' => $quotation->id, 'description' => $product->name,
            'quantity' => $qty, 'unit_price' => round($grandTotal / $qty, 2), 'amount' => $grandTotal,
        ]);

        if (in_array($status, ['draft', 'approved'])) {
            if ($status === 'approved') {
                WorkOrder::firstOrCreate(['wo_number' => sprintf('WO-%d-%04d', now()->year, $woNum)], [
                    'center_id' => $this->centerId, 'quotation_id' => $quotation->id,
                    'customer_id' => $customer->id, 'product_id' => $product->id,
                    'section_id' => $this->sections['MS'] ?? array_values($this->sections)[0],
                    'quantity' => $qty, 'priority' => $priority, 'status' => 'approved',
                    'due_date' => $created->copy()->addDays(30), 'created_by' => $this->admin->id,
                ]);
            }
            $this->command->info("  ✓ Pipeline #{$idx}: {$product->name} [{$status}]");
            return;
        }

        // 4. Work Order
        $wo = WorkOrder::firstOrCreate(['wo_number' => sprintf('WO-%d-%04d', now()->year, $woNum)], [
            'center_id' => $this->centerId, 'quotation_id' => $quotation->id,
            'customer_id' => $customer->id, 'product_id' => $product->id,
            'section_id' => $this->sections['MS'] ?? array_values($this->sections)[0],
            'quantity' => $qty, 'priority' => $priority, 'status' => $status,
            'due_date' => $created->copy()->addDays(25), 'created_by' => $this->admin->id,
            'pcd_handoff_at' => $created->copy()->addDays(3), 'pcd_handoff_by' => $this->admin->id,
            'released_to_shops_at' => $created->copy()->addDays(4), 'released_by' => $this->admin->id,
        ]);

        // 5. Operation Sheet
        $sheet = OperationSheet::create([
            'center_id' => $this->centerId, 'work_order_id' => $wo->id,
            'sheet_number' => 'OS-' . $wo->wo_number,
            'approved_by' => $this->admin->id, 'approved_at' => $created->copy()->addDays(4),
        ]);

        $stepOps = ['Turning', 'Milling', 'Drilling', 'Grinding', 'Heat Treatment'];
        $stepCount = rand(3, 5);
        $steps = [];
        for ($s = 0; $s < $stepCount; $s++) {
            $stepStatus = match ($status) {
                'delivered', 'qc_passed' => 'completed',
                'in_production' => $s < $stepCount - 2 ? 'completed' : ($s === $stepCount - 2 ? 'in_progress' : 'pending'),
                'qc_hold' => $s < $stepCount - 1 ? 'completed' : 'pending',
                default => 'pending',
            };
            $estH = rand(2, 8);
            $steps[] = OperationStep::create([
                'operation_sheet_id' => $sheet->id, 'sequence' => $s + 1,
                'operation_name' => $stepOps[$s % count($stepOps)],
                'section_id' => array_values($this->sections)[rand(0, min(count($this->sections) - 1, 3))],
                'machine_id' => $this->machines->isNotEmpty() ? $this->machines->random()->id : null,
                'operator_id' => $this->operators->isNotEmpty() ? $this->operators->random()->id : null,
                'estimated_hours' => $estH, 'status' => $stepStatus,
                'actual_hours' => $stepStatus === 'completed' ? max(1, $estH + rand(-2, 3)) : null,
                'started_at' => $stepStatus !== 'pending' ? $created->copy()->addDays(5 + $s) : null,
                'completed_at' => $stepStatus === 'completed' ? $created->copy()->addDays(6 + $s) : null,
            ]);
        }

        // 6. Material Requisition
        MaterialRequisition::create([
            'mrn_number' => MaterialRequisition::generateMrnNumber(), 'work_order_id' => $wo->id,
            'request_date' => $created->copy()->addDays(4), 'requested_by' => $this->admin->id,
            'approved_by' => $this->admin->id, 'approved_at' => $created->copy()->addDays(5), 'status' => 'issued',
        ]);

        // 7. Job Executions
        foreach ($steps as $step) {
            if (in_array($step->status, ['completed', 'in_progress'])) {
                JobExecution::create([
                    'operation_step_id' => $step->id, 'work_order_id' => $wo->id,
                    'operator_id' => $this->operators->isNotEmpty() ? $this->operators->random()->id : $this->admin->id,
                    'machine_id' => $this->machines->isNotEmpty() ? $this->machines->random()->id : null,
                    'started_at' => $step->started_at, 'stopped_at' => $step->completed_at,
                    'qty_completed' => $step->status === 'completed' ? $qty : rand(1, $qty),
                    'qty_rejected' => rand(0, 3),
                    'status' => $step->status === 'completed' ? 'stopped' : 'started',
                ]);
            }
        }

        // 8. QC
        if (in_array($status, ['qc_hold', 'qc_passed', 'delivered'])) {
            $qcResult = in_array($status, ['qc_passed', 'delivered']) ? 'pass' : 'fail';
            $qc = QcInspection::create([
                'center_id' => $this->centerId, 'work_order_id' => $wo->id,
                'inspector_id' => $this->admin->id, 'result' => $qcResult,
                'inspection_date' => $created->copy()->addDays(12 + $stepCount),
                'remarks' => $qcResult === 'pass' ? 'All items passed' : 'Defects found',
            ]);
            if ($qcResult === 'fail') {
                Ncr::create([
                    'center_id' => $this->centerId, 'qc_inspection_id' => $qc->id, 'work_order_id' => $wo->id,
                    'ncr_number' => 'NCR-' . now()->year . '-' . str_pad(Ncr::count() + 1, 4, '0', STR_PAD_LEFT),
                    'defect_type' => ['dimensional', 'surface', 'material', 'assembly'][rand(0, 3)],
                    'root_cause' => ['Tool wear', 'Incorrect setup', 'Material defect', 'Operator error'][rand(0, 3)],
                    'corrective_action' => 'Rework and re-inspect',
                    'responsible_user_id' => $this->admin->id, 'status' => ['open', 'in_rework', 'closed'][rand(0, 2)],
                ]);
            }
        }

        // 9. Delivery + Invoice
        if ($status === 'delivered') {
            $delivery = DeliveryOrder::create([
                'center_id' => $this->centerId, 'work_order_id' => $wo->id, 'customer_id' => $customer->id,
                'challan_number' => 'CH-' . now()->year . '-' . str_pad(DeliveryOrder::count() + 100, 4, '0', STR_PAD_LEFT),
                'scheduled_date' => $created->copy()->addDays(20),
                'transport_notes' => 'Vehicle: Dhaka Metro ' . rand(1000, 9999), 'status' => 'delivered',
            ]);
            Invoice::create([
                'center_id' => $this->centerId, 'work_order_id' => $wo->id,
                'customer_id' => $customer->id, 'delivery_order_id' => $delivery->id,
                'invoice_number' => 'INV-' . now()->year . '-' . str_pad(Invoice::count() + 100, 4, '0', STR_PAD_LEFT),
                'subtotal' => $grandTotal, 'discount' => 0,
                'vat_amount' => $vat, 'total_amount' => $grandTotal,
                'status' => ['draft', 'issued', 'issued', 'acknowledged'][rand(0, 3)],
                'issued_at' => $created->copy()->addDays(23),
            ]);
            $wo->update(['status' => 'delivered']);
        }

        $this->command->info("  ✓ Pipeline #{$idx}: {$product->name} for {$customer->name} [{$status}] ({$created->format('d M')})");
    }

    private function seedDowntimeEvents(): void
    {
        if ($this->machines->isEmpty()) return;

        $categories = ['breakdown', 'planned_maintenance', 'setup', 'no_operator', 'material_shortage', 'power_outage'];
        for ($i = 0; $i < 30; $i++) {
            $machine = $this->machines->random();
            $start   = now()->subDays(rand(1, 90))->setHour(rand(8, 16));
            $hours   = rand(1, 8);
            $je = JobExecution::inRandomOrder()->first();
            DowntimeEvent::create([
                'job_execution_id' => $je?->id ?? 1,
                'machine_id'  => $machine->id,
                'category'    => $categories[array_rand($categories)],
                'description' => 'Downtime event #' . ($i + 1),
                'started_at'  => $start,
                'ended_at'    => $start->copy()->addHours($hours),
            ]);
        }
        $this->command->info("  ✓ Downtime events: 30");
    }

    private function printStats(): void
    {
        $stats = [
            'Customers' => Customer::count(), 'Products' => Product::count(),
            'RFQs' => Rfq::count(), 'Cost Estimates' => CostEstimate::count(),
            'Quotations' => Quotation::count(), 'Work Orders' => WorkOrder::count(),
            'Op Sheets' => OperationSheet::count(), 'Job Executions' => JobExecution::count(),
            'QC Inspections' => QcInspection::count(), 'NCRs' => Ncr::count(),
            'Deliveries' => DeliveryOrder::count(), 'Invoices' => Invoice::count(),
            'Downtime Events' => DowntimeEvent::count(),
        ];
        foreach ($stats as $k => $v) $this->command->info("   {$k}: {$v}");
    }
}
