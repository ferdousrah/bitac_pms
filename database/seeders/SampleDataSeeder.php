<?php

namespace Database\Seeders;

use App\Models\Center;
use App\Models\CostEstimate;
use App\Models\CostEstimateLine;
use App\Models\Customer;
use App\Models\DeliveryOrder;
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
use App\Models\WorkCentre;
use App\Models\WorkOrder;
use Carbon\Carbon;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class SampleDataSeeder extends Seeder
{
    public function run(): void
    {
        $this->command->info('Seeding sample data (RFQ → Delivery → Invoice pipeline)...');

        // ─── Center ──────────────────────────────────────────
        $center = Center::firstOrCreate(['code' => 'DHK'], [
            'name' => 'BITAC Dhaka', 'address' => 'Tejgaon, Dhaka-1208', 'phone' => '02-8870655', 'email' => 'dhaka@bitac.gov.bd', 'is_active' => true,
        ]);
        app()->instance('current_center_id', $center->id);

        // ─── Users ───────────────────────────────────────────
        $admin = User::firstOrCreate(['email' => 'admin@bitac.gov.bd'], [
            'name' => 'System Admin', 'password' => Hash::make('password'), 'center_id' => $center->id,
        ]);
        $iedOfficer = User::firstOrCreate(['email' => 'ied@bitac.gov.bd'], [
            'name' => 'Md. Kamal Hossain', 'password' => Hash::make('password'), 'center_id' => $center->id,
        ]);
        $pcdOfficer = User::firstOrCreate(['email' => 'pcd@bitac.gov.bd'], [
            'name' => 'Fatema Akter', 'password' => Hash::make('password'), 'center_id' => $center->id,
        ]);
        $qcInspector = User::firstOrCreate(['email' => 'qc@bitac.gov.bd'], [
            'name' => 'Aminul Islam', 'password' => Hash::make('password'), 'center_id' => $center->id,
        ]);

        // ─── Sections ────────────────────────────────────────
        $sections = [];
        foreach ([
            ['code' => 'MS', 'name' => 'Machine Shop', 'type' => 'production_shop'],
            ['code' => 'HT', 'name' => 'Heat Treatment', 'type' => 'production_shop'],
            ['code' => 'FT', 'name' => 'Fitting & Assembly', 'type' => 'production_shop'],
            ['code' => 'WD', 'name' => 'Welding Shop', 'type' => 'production_shop'],
            ['code' => 'GR', 'name' => 'Grinding Section', 'type' => 'production_shop'],
        ] as $i => $s) {
            $sections[$s['code']] = Section::firstOrCreate(['code' => $s['code']], array_merge($s, ['display_order' => $i + 1, 'is_active' => true]));
        }

        // ─── Work Centres ────────────────────────────────────
        $workCentres = [];
        foreach (['Lathe Section', 'Milling Section', 'CNC Section', 'Grinding Section', 'Heat Treatment Bay'] as $name) {
            $workCentres[] = WorkCentre::firstOrCreate(['name' => $name, 'center_id' => $center->id], ['description' => $name, 'is_active' => true]);
        }

        // ─── Machines ────────────────────────────────────────
        $machines = [];
        $machineData = [
            ['name' => 'Lathe Machine L-001', 'code' => 'LM-001', 'wc' => 0, 'sec' => 'MS', 'state' => 'running'],
            ['name' => 'Lathe Machine L-002', 'code' => 'LM-002', 'wc' => 0, 'sec' => 'MS', 'state' => 'idle'],
            ['name' => 'Milling Machine M-001', 'code' => 'MM-001', 'wc' => 1, 'sec' => 'MS', 'state' => 'running'],
            ['name' => 'CNC Turning Center', 'code' => 'CNC-001', 'wc' => 2, 'sec' => 'MS', 'state' => 'running'],
            ['name' => 'CNC Milling VMC', 'code' => 'CNC-002', 'wc' => 2, 'sec' => 'MS', 'state' => 'setup'],
            ['name' => 'Surface Grinder SG-001', 'code' => 'SG-001', 'wc' => 3, 'sec' => 'GR', 'state' => 'idle'],
            ['name' => 'Cylindrical Grinder CG-001', 'code' => 'CG-001', 'wc' => 3, 'sec' => 'GR', 'state' => 'running'],
            ['name' => 'Heat Treatment Furnace HT-001', 'code' => 'HT-001', 'wc' => 4, 'sec' => 'HT', 'state' => 'idle'],
            ['name' => 'Drilling Machine D-001', 'code' => 'DM-001', 'wc' => 1, 'sec' => 'MS', 'state' => 'breakdown'],
            ['name' => 'Shaping Machine SH-001', 'code' => 'SH-001', 'wc' => 0, 'sec' => 'MS', 'state' => 'maintenance'],
            ['name' => 'Welding Machine W-001', 'code' => 'WM-001', 'wc' => 0, 'sec' => 'WD', 'state' => 'running'],
            ['name' => 'Planer Machine PL-001', 'code' => 'PL-001', 'wc' => 0, 'sec' => 'MS', 'state' => 'idle'],
            ['name' => 'Boring Machine BM-001', 'code' => 'BM-001', 'wc' => 1, 'sec' => 'MS', 'state' => 'running'],
            ['name' => 'Slotting Machine SL-001', 'code' => 'SL-001', 'wc' => 1, 'sec' => 'MS', 'state' => 'offline'],
            ['name' => 'Power Press PP-001', 'code' => 'PP-001', 'wc' => 0, 'sec' => 'FT', 'state' => 'idle'],
        ];
        foreach ($machineData as $md) {
            $machines[] = Machine::firstOrCreate(['machine_code' => $md['code']], [
                'center_id' => $center->id, 'name' => $md['name'], 'machine_code' => $md['code'],
                'work_centre_id' => $workCentres[$md['wc']]->id, 'section_id' => $sections[$md['sec']]->id,
                'status' => 'active', 'current_state' => $md['state'], 'state_changed_at' => now()->subHours(rand(1, 48)),
                'rate_group_a' => rand(200, 800), 'rate_group_b' => rand(150, 600), 'rate_group_c' => rand(100, 400),
                'manufacturer' => ['Hmt', 'Batliboi', 'Jyoti', 'DMTG', 'Mazak'][rand(0, 4)],
                'purchased_on' => now()->subYears(rand(2, 15)), 'asset_value' => rand(500000, 5000000),
                'last_maintenance_date' => now()->subDays(rand(10, 60)),
                'next_maintenance_date' => now()->addDays(rand(-5, 30)),
                'total_runtime_hours' => rand(1000, 25000),
            ]);
        }

        // ─── Materials ───────────────────────────────────────
        $materials = [];
        foreach ([
            ['name' => 'Mild Steel (MS)', 'cat' => 'Ferrous', 'rate' => 85, 'density' => 7850],
            ['name' => 'Cast Iron (CI)', 'cat' => 'Ferrous', 'rate' => 70, 'density' => 7200],
            ['name' => 'Stainless Steel 304', 'cat' => 'Ferrous', 'rate' => 280, 'density' => 8000],
            ['name' => 'Brass', 'cat' => 'Non-Ferrous', 'rate' => 520, 'density' => 8500],
            ['name' => 'Copper', 'cat' => 'Non-Ferrous', 'rate' => 750, 'density' => 8960],
            ['name' => 'Aluminium 6061', 'cat' => 'Non-Ferrous', 'rate' => 220, 'density' => 2700],
            ['name' => 'Gun Metal', 'cat' => 'Non-Ferrous', 'rate' => 600, 'density' => 8700],
            ['name' => 'Phosphor Bronze', 'cat' => 'Non-Ferrous', 'rate' => 950, 'density' => 8800],
        ] as $m) {
            $materials[] = Material::firstOrCreate(['name' => $m['name']], [
                'category' => $m['cat'], 'rate_per_kg' => $m['rate'], 'density_kg_m3' => $m['density'], 'is_active' => true,
            ]);
        }

        // ─── Operators ───────────────────────────────────────
        $operators = [];
        foreach ([
            ['name' => 'Rafiqul Islam', 'eid' => 'OP-001', 'sec' => 'MS', 'skills' => ['lathe', 'turning']],
            ['name' => 'Shamsul Haque', 'eid' => 'OP-002', 'sec' => 'MS', 'skills' => ['milling', 'drilling']],
            ['name' => 'Abdur Rahman', 'eid' => 'OP-003', 'sec' => 'MS', 'skills' => ['cnc_turning', 'cnc_milling']],
            ['name' => 'Jahangir Alam', 'eid' => 'OP-004', 'sec' => 'GR', 'skills' => ['grinding', 'finishing']],
            ['name' => 'Mizanur Rahman', 'eid' => 'OP-005', 'sec' => 'HT', 'skills' => ['heat_treatment', 'hardening']],
            ['name' => 'Nurul Huda', 'eid' => 'OP-006', 'sec' => 'WD', 'skills' => ['arc_welding', 'gas_welding']],
        ] as $o) {
            $operators[] = Operator::firstOrCreate(['employee_id' => $o['eid']], [
                'name' => $o['name'], 'section_id' => $sections[$o['sec']]->id,
                'phone' => '017' . rand(10000000, 99999999), 'skills' => $o['skills'],
                'shift' => 'day', 'is_active' => true, 'joined_on' => now()->subYears(rand(1, 10)),
            ]);
        }

        // ─── Customers ───────────────────────────────────────
        $customers = [];
        foreach ([
            ['name' => 'Bangladesh Railway', 'contact' => 'Md. Habibur Rahman', 'email' => 'procurement@railway.gov.bd', 'phone' => '02-9330100'],
            ['name' => 'Bangladesh Shipyard', 'contact' => 'Engr. Nasir Uddin', 'email' => 'purchase@bsy.gov.bd', 'phone' => '031-2520245'],
            ['name' => 'BPDB (Bangladesh Power Development Board)', 'contact' => 'Engr. Fazlul Karim', 'email' => 'store@bpdb.gov.bd', 'phone' => '02-9561234'],
            ['name' => 'ACI Motors', 'contact' => 'Tanvir Ahmed', 'email' => 'purchase@acimotors.com', 'phone' => '02-8432741'],
            ['name' => 'Walton Hi-Tech Industries', 'contact' => 'Shahed Iqbal', 'email' => 'procurement@waltonbd.com', 'phone' => '02-7912345'],
        ] as $c) {
            $customers[] = Customer::firstOrCreate(['name' => $c['name']], [
                'center_id' => $center->id, 'contact_person' => $c['contact'], 'email' => $c['email'],
                'phone' => $c['phone'], 'password' => Hash::make('customer123'), 'is_active' => true,
            ]);
        }

        // ─── Products ────────────────────────────────────────
        $products = [];
        foreach ([
            ['name' => 'Gear Shaft Assembly', 'code' => 'PRD-GS-001', 'unit' => 'pcs', 'desc' => 'Precision gear shaft for railway bogies'],
            ['name' => 'Coupling Flange', 'code' => 'PRD-CF-001', 'unit' => 'pcs', 'desc' => 'Marine coupling flange SS304'],
            ['name' => 'Piston Ring Set', 'code' => 'PRD-PR-001', 'unit' => 'set', 'desc' => 'Engine piston ring set'],
            ['name' => 'Bearing Housing', 'code' => 'PRD-BH-001', 'unit' => 'pcs', 'desc' => 'Heavy duty bearing housing CI'],
            ['name' => 'Pump Impeller', 'code' => 'PRD-PI-001', 'unit' => 'pcs', 'desc' => 'Centrifugal pump impeller brass'],
            ['name' => 'Connecting Rod', 'code' => 'PRD-CR-001', 'unit' => 'pcs', 'desc' => 'Forged connecting rod'],
            ['name' => 'Brake Drum', 'code' => 'PRD-BD-001', 'unit' => 'pcs', 'desc' => 'Railway brake drum assembly'],
            ['name' => 'Bogie Pin', 'code' => 'PRD-BP-001', 'unit' => 'pcs', 'desc' => 'Railway bogie center pin'],
        ] as $p) {
            $products[] = Product::firstOrCreate(['code' => $p['code']], [
                'center_id' => $center->id, 'name' => $p['name'], 'code' => $p['code'], 'unit' => $p['unit'], 'description' => $p['desc'],
            ]);
        }

        $this->command->info('  ✓ Base data (center, users, sections, machines, materials, operators, customers, products)');

        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        // PIPELINE DATA — 5 complete RFQ→Invoice chains
        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

        $pipelines = [
            // Pipeline 1: Bangladesh Railway — Gear Shaft (DELIVERED)
            ['customer' => 0, 'product' => 0, 'qty' => 20, 'price' => 15000, 'status' => 'delivered', 'days_ago' => 45, 'material' => 0, 'priority' => 'urgent'],
            // Pipeline 2: BPDB — Pump Impeller (IN PRODUCTION)
            ['customer' => 2, 'product' => 4, 'qty' => 10, 'price' => 28000, 'status' => 'in_production', 'days_ago' => 20, 'material' => 3, 'priority' => 'normal'],
            // Pipeline 3: ACI Motors — Piston Ring Set (QC HOLD)
            ['customer' => 3, 'product' => 2, 'qty' => 50, 'price' => 8500, 'status' => 'qc_hold', 'days_ago' => 15, 'material' => 0, 'priority' => 'urgent'],
            // Pipeline 4: Walton — Bearing Housing (APPROVED, pending production)
            ['customer' => 4, 'product' => 3, 'qty' => 30, 'price' => 12000, 'status' => 'approved', 'days_ago' => 8, 'material' => 1, 'priority' => 'normal'],
            // Pipeline 5: Bangladesh Shipyard — Coupling Flange (DRAFT)
            ['customer' => 1, 'product' => 1, 'qty' => 15, 'price' => 22000, 'status' => 'draft', 'days_ago' => 3, 'material' => 2, 'priority' => 'low'],
        ];

        foreach ($pipelines as $idx => $p) {
            $customer = $customers[$p['customer']];
            $product  = $products[$p['product']];
            $created  = now()->subDays($p['days_ago']);
            $unitPrice= $p['price'];
            $qty      = $p['qty'];
            $total    = $unitPrice * $qty;

            // ── 1. RFQ ──
            $rfq = Rfq::create([
                'center_id' => $center->id, 'customer_id' => $customer->id,
                'customer_ref_no' => 'PO-' . strtoupper(substr($customer->name, 0, 3)) . '-' . (2026000 + $idx),
                'required_by' => $created->copy()->addDays(30), 'notes' => "Sample RFQ #{$idx} for seeding",
                'reference_type' => ['none', 'drawing', 'physical_sample', 'both', 'drawing'][$idx],
                'status' => $p['status'] === 'draft' ? 'pending' : 'quoted',
                'created_by' => $iedOfficer->id, 'created_at' => $created, 'updated_at' => $created,
            ]);
            RfqItem::create([
                'rfq_id' => $rfq->id, 'product_id' => $product->id,
                'job_description' => $product->name, 'quantity' => $qty, 'unit' => $product->unit ?? 'pcs',
            ]);

            // ── 2. Cost Estimate ──
            $matCost  = $materials[$p['material']]->rate_per_kg * rand(5, 20) * $qty;
            $machCost = rand(2000, 8000) * $qty;
            $surfCost = rand(500, 2000) * $qty;
            $otherCost= rand(200, 1000) * $qty;
            $netCost  = $matCost + $machCost + $surfCost + $otherCost;
            $overhead = $netCost * 0.10;
            $vat      = ($netCost + $overhead) * 0.15;
            $grandTotal = $netCost + $overhead + $vat;

            $estimate = CostEstimate::create([
                'estimate_no' => CostEstimate::generateEstimateNo(), 'rfq_id' => $rfq->id,
                'customer_id' => $customer->id, 'company_name' => $customer->name,
                'job_name' => $product->name, 'pricing_group' => 'A',
                'overhead_pct' => 10, 'vat_pct' => 15, 'times_multiplier' => 1, 'job_quantity' => $qty,
                'material_cost' => $matCost, 'machining_cost' => $machCost,
                'surface_cost' => $surfCost, 'other_cost' => $otherCost,
                'net_cost' => $netCost, 'overhead_amount' => $overhead,
                'vat_amount' => $vat, 'total' => $netCost + $overhead + $vat, 'grand_total' => $grandTotal,
                'status' => 'finalized', 'created_by' => $iedOfficer->id,
                'created_at' => $created->copy()->addDays(1), 'updated_at' => $created->copy()->addDays(1),
            ]);
            // Estimate lines
            foreach ([
                ['section' => 'material', 'desc' => $materials[$p['material']]->name, 'mat_id' => $materials[$p['material']]->id, 'qty' => rand(5, 20), 'rate' => $materials[$p['material']]->rate_per_kg, 'seq' => 1],
                ['section' => 'machining', 'desc' => 'Turning Operation', 'mat_id' => null, 'qty' => rand(2, 8), 'rate' => rand(300, 800), 'seq' => 1],
                ['section' => 'machining', 'desc' => 'Milling Operation', 'mat_id' => null, 'qty' => rand(1, 5), 'rate' => rand(400, 900), 'seq' => 2],
                ['section' => 'surface', 'desc' => 'Surface Finishing', 'mat_id' => null, 'qty' => 1, 'rate' => rand(500, 2000), 'seq' => 1],
            ] as $line) {
                CostEstimateLine::create([
                    'cost_estimate_id' => $estimate->id, 'section' => $line['section'],
                    'material_id' => $line['mat_id'], 'description' => $line['desc'],
                    'quantity' => $line['qty'], 'unit' => 'kg', 'rate' => $line['rate'],
                    'amount' => $line['qty'] * $line['rate'], 'sequence' => $line['seq'],
                ]);
            }

            // ── 3. Quotation ──
            $profitMargin = 15;
            $discount     = 0;
            $qMaterialCost = $matCost;
            $qLabourCost   = $machCost + $surfCost;
            $qOverheadCost = $overhead + $otherCost;
            $qTotal        = $total;

            $quotation = Quotation::create([
                'center_id' => $center->id, 'rfq_id' => $rfq->id, 'customer_id' => $customer->id,
                'created_by' => $iedOfficer->id, 'version' => 1,
                'material_cost' => $qMaterialCost, 'labour_cost' => $qLabourCost, 'overhead_cost' => $qOverheadCost,
                'profit_margin' => $profitMargin, 'discount' => $discount,
                'vat_rate' => 15, 'vat_amount' => $qTotal * 0.15, 'total_amount' => $qTotal * 1.15,
                'validity_days' => 30,
                'status' => $p['status'] === 'draft' ? 'draft' : ($p['status'] === 'approved' ? 'approved' : 'converted'),
                'notes' => 'Auto-seeded quotation', 'customer_po_no' => $rfq->customer_ref_no,
                'validity_expires_at' => $created->copy()->addDays(30),
                'created_at' => $created->copy()->addDays(2), 'updated_at' => $created->copy()->addDays(2),
            ]);
            QuotationItem::create([
                'quotation_id' => $quotation->id, 'description' => $product->name,
                'quantity' => $qty, 'unit_price' => $unitPrice, 'amount' => $total,
            ]);

            // Skip WO+ for draft/approved-only pipelines
            if (in_array($p['status'], ['draft', 'approved'])) {
                // For "approved" — create a WO in approved status
                if ($p['status'] === 'approved') {
                    WorkOrder::firstOrCreate(['wo_number' => sprintf('WO-%d-%04d', now()->year, 100 + $idx)], [
                        'center_id' => $center->id,
                        'job_number' => 37700 + $idx, 'quotation_id' => $quotation->id,
                        'customer_id' => $customer->id, 'product_id' => $product->id,
                        'section_id' => $sections['MS']->id, 'quantity' => $qty,
                        'priority' => $p['priority'], 'status' => 'approved',
                        'due_date' => $created->copy()->addDays(30), 'customer_po_no' => $rfq->customer_ref_no,
                        'created_by' => $pcdOfficer->id,
                    ]);
                }
                $this->command->info("  ✓ Pipeline #{$idx}: {$product->name} for {$customer->name} [{$p['status']}]");
                continue;
            }

            // ── 4. Work Order ──
            $wo = WorkOrder::firstOrCreate(["wo_number" => sprintf("WO-%d-%04d", now()->year, 100 + $idx)], [
                "center_id" => $center->id,
                "job_number" => 37700 + $idx, "quotation_id" => $quotation->id,
                "customer_id" => $customer->id, "product_id" => $product->id,
                "section_id" => $sections["MS"]->id, "quantity" => $qty,
                "priority" => $p["priority"], "status" => $p["status"],
                "due_date" => $created->copy()->addDays(25),
                "customer_po_no" => $rfq->customer_ref_no, "created_by" => $pcdOfficer->id,
                "pcd_handoff_at" => $created->copy()->addDays(3), "pcd_handoff_by" => $pcdOfficer->id,
                "released_to_shops_at" => $created->copy()->addDays(4), "released_by" => $pcdOfficer->id,
            ]);













            // ── 5. Operation Sheet + Steps ──
            $sheet = OperationSheet::create([
                'center_id' => $center->id, 'work_order_id' => $wo->id,
                'sheet_number' => 'OS-' . $wo->wo_number,
                'approved_by' => $pcdOfficer->id, 'approved_at' => $created->copy()->addDays(4),
            ]);
            $steps = [];
            foreach ([
                ['op' => 'Turning', 'sec' => 'MS', 'machine' => 0, 'operator' => 0, 'hours' => rand(2, 8)],
                ['op' => 'Milling', 'sec' => 'MS', 'machine' => 2, 'operator' => 1, 'hours' => rand(1, 5)],
                ['op' => 'Grinding', 'sec' => 'GR', 'machine' => 5, 'operator' => 3, 'hours' => rand(1, 3)],
                ['op' => 'Heat Treatment', 'sec' => 'HT', 'machine' => 7, 'operator' => 4, 'hours' => rand(2, 6)],
                ['op' => 'Final Inspection', 'sec' => 'MS', 'machine' => null, 'operator' => null, 'hours' => 1],
            ] as $seq => $step) {
                $stepStatus = match ($p['status']) {
                    'delivered' => 'completed',
                    'in_production' => $seq < 2 ? 'completed' : ($seq === 2 ? 'in_progress' : 'pending'),
                    'qc_hold' => $seq < 4 ? 'completed' : 'pending',
                    default => 'pending',
                };
                $steps[] = OperationStep::create([
                    'operation_sheet_id' => $sheet->id, 'sequence' => $seq + 1,
                    'operation_name' => $step['op'], 'section_id' => $sections[$step['sec']]->id,
                    'machine_id' => $step['machine'] !== null ? $machines[$step['machine']]->id : null,
                    'operator_id' => $step['operator'] !== null ? $operators[$step['operator']]->id : null,
                    'estimated_hours' => $step['hours'], 'status' => $stepStatus,
                    'actual_hours' => $stepStatus === 'completed' ? $step['hours'] + rand(-1, 2) : null,
                    'started_at' => $stepStatus !== 'pending' ? $created->copy()->addDays(5 + $seq) : null,
                    'completed_at' => $stepStatus === 'completed' ? $created->copy()->addDays(5 + $seq + 1) : null,
                ]);
            }

            // ── 6. Material Requisition ──
            $mrn = MaterialRequisition::create([
                'mrn_number' => MaterialRequisition::generateMrnNumber(), 'work_order_id' => $wo->id,
                'request_date' => $created->copy()->addDays(4), 'requested_by' => $pcdOfficer->id,
                'approved_by' => $admin->id, 'approved_at' => $created->copy()->addDays(5),
                'status' => 'issued',
            ]);
            MaterialRequisitionItem::create([
                'material_requisition_id' => $mrn->id, 'item_no' => 1,
                'description' => $materials[$p['material']]->name, 'material_id' => $materials[$p['material']]->id,
                'unit' => 'kg', 'required_qty' => rand(20, 100), 'stock_qty' => rand(50, 200),
                'issue_qty' => rand(20, 100), 'issue_date' => $created->copy()->addDays(5),
            ]);

            // ── 7. Job Executions (for in_production / qc_hold / delivered) ──
            if (in_array($p['status'], ['in_production', 'qc_hold', 'delivered'])) {
                foreach ($steps as $si => $step) {
                    if ($step->status === 'completed' || $step->status === 'in_progress') {
                        JobExecution::create([
                            'operation_step_id' => $step->id, 'work_order_id' => $wo->id,
                            'operator_id' => $operators[$si % count($operators)]->id,
                            'machine_id' => $machines[$si % count($machines)]->id,
                            'started_at' => $step->started_at, 'stopped_at' => $step->completed_at,
                            'qty_completed' => $step->status === 'completed' ? $qty : rand(1, $qty),
                            'qty_rejected' => rand(0, 2),
                            'status' => $step->status === 'completed' ? 'stopped' : 'started',
                        ]);
                    }
                }
            }

            // ── 8. QC Inspection ──
            if (in_array($p['status'], ['qc_hold', 'delivered'])) {
                $qcResult = $p['status'] === 'delivered' ? 'pass' : 'fail';
                $qc = QcInspection::create([
                    'center_id' => $center->id, 'work_order_id' => $wo->id,
                    'inspector_id' => $qcInspector->id, 'result' => $qcResult,
                    'inspection_date' => $created->copy()->addDays(12),
                    'remarks' => $qcResult === 'pass' ? 'All items passed final QC' : 'Minor defects found',
                ]);

                if ($qcResult === 'fail') {
                    Ncr::create([
                        'center_id' => $center->id, 'qc_inspection_id' => $qc->id, 'work_order_id' => $wo->id,
                        'ncr_number' => 'NCR-' . now()->year . '-' . str_pad(200 + $idx, 4, '0', STR_PAD_LEFT),
                        'defect_type' => 'dimensional', 'root_cause' => 'Tool wear during final machining pass',
                        'corrective_action' => 'Rework with new tool insert, re-inspect',
                        'responsible_user_id' => $admin->id, 'status' => 'in_rework',
                    ]);
                }
            }

            // ── 9. Delivery + Invoice (delivered only) ──
            if ($p['status'] === 'delivered') {
                $delivery = DeliveryOrder::create([
                    'center_id' => $center->id, 'work_order_id' => $wo->id, 'customer_id' => $customer->id,
                    'challan_number' => 'CH-' . now()->year . '-' . str_pad(200 + $idx, 4, '0', STR_PAD_LEFT),
                    'scheduled_date' => $created->copy()->addDays(20),
                    'transport_notes' => 'Vehicle: Dhaka Metro ' . rand(1000, 9999),
                    'status' => 'delivered',
                ]);

                $subtotal = $qTotal;
                $vatAmt   = $subtotal * 0.15;
                Invoice::create([
                    'center_id' => $center->id, 'work_order_id' => $wo->id,
                    'customer_id' => $customer->id, 'delivery_order_id' => $delivery->id,
                    'invoice_number' => 'INV-' . now()->year . '-' . str_pad(200 + $idx, 4, '0', STR_PAD_LEFT),
                    'subtotal' => $subtotal, 'discount' => 0,
                    'vat_amount' => $vatAmt, 'total_amount' => $subtotal + $vatAmt,
                    'status' => 'issued', 'issued_at' => $created->copy()->addDays(23),
                ]);

                $wo->update(['status' => 'delivered']);
            }

            $this->command->info("  ✓ Pipeline #{$idx}: {$product->name} for {$customer->name} [{$p['status']}]");
        }

        $this->command->info('✅ Sample data seeding complete!');
        $this->command->info("   → 5 customers, 8 products, 15 machines, 6 operators");
        $this->command->info("   → 5 RFQs → 5 Cost Estimates → 5 Quotations");
        $this->command->info("   → 4 Work Orders (1 delivered, 1 in_production, 1 qc_hold, 1 approved)");
        $this->command->info("   → 1 Delivery Order + 1 Invoice (for delivered pipeline)");
    }
}
