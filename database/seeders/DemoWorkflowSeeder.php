<?php

namespace Database\Seeders;

use App\Models\Bom;
use App\Models\Customer;
use App\Models\DeliveryOrder;
use App\Models\DowntimeEvent;
use App\Models\JobExecution;
use App\Models\Machine;
use App\Models\Ncr;
use App\Models\OperationSheet;
use App\Models\OperationStep;
use App\Models\OperatorAssignment;
use App\Models\Product;
use App\Models\ProductionSchedule;
use App\Models\QcChecklistItem;
use App\Models\QcInspection;
use App\Models\Quotation;
use App\Models\QuotationApproval;
use App\Models\Rfq;
use App\Models\User;
use App\Models\WorkOrder;
use Carbon\Carbon;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

class DemoWorkflowSeeder extends Seeder
{
    public function run(): void
    {
        $customer  = Customer::first();
        $product   = Product::where('code', 'GS-001')->first();
        $bom       = $product->boms()->where('is_active', true)->first();
        $salesUser = User::whereHas('roles', fn($q) => $q->where('name', 'sales-officer'))->first();
        $mgmtUser  = User::whereHas('roles', fn($q) => $q->where('name', 'management'))->first();
        $operator  = User::whereHas('roles', fn($q) => $q->where('name', 'machine-operator'))->first();
        $supervisor= User::whereHas('roles', fn($q) => $q->where('name', 'production-supervisor'))->first();
        $qcUser    = User::whereHas('roles', fn($q) => $q->where('name', 'qc-inspector'))->first();

        // ==================================================================
        // RFQ
        // ==================================================================
        $rfq = Rfq::create([
            'customer_id' => $customer->id,
            'product_id'  => $product->id,
            'quantity'    => 50,
            'required_by' => Carbon::now()->addDays(45),
            'notes'       => 'Urgently required for Q2 maintenance schedule. Standard specification.',
            'status'      => 'quoted',
            'created_by'  => $salesUser->id,
        ]);

        // ==================================================================
        // Quotation (approved, 2-level)
        // ==================================================================
        $quotation = Quotation::create([
            'rfq_id'        => $rfq->id,
            'customer_id'   => $customer->id,
            'version'       => 1,
            'material_cost' => 180000,
            'labour_cost'   => 85000,
            'overhead_cost' => 45000,
            'profit_margin' => 15,
            'discount'      => 10000,
            'vat_rate'      => 15,
            'vat_amount'    => 51750,
            'total_amount'  => 398250,
            'validity_days' => 30,
            'notes'         => 'Price valid for 30 days. Delivery within 45 days of order confirmation.',
            'status'        => 'approved',
            'created_by'    => $salesUser->id,
        ]);

        // 2-level approval chain
        $approvers = User::whereHas('roles', fn($q) => $q->where('name', 'management'))
                        ->take(2)->get();

        foreach ($approvers as $i => $approver) {
            QuotationApproval::create([
                'quotation_id' => $quotation->id,
                'approver_id'  => $approver->id,
                'level'        => $i + 1,
                'status'       => 'approved',
                'remarks'      => 'Approved — cost within budget. Proceed with production.',
                'approved_at'  => Carbon::now()->subDays(5 - $i),
            ]);
        }

        // ==================================================================
        // Work Order (in production)
        // ==================================================================
        $workOrder = WorkOrder::create([
            'quotation_id' => $quotation->id,
            'customer_id'  => $customer->id,
            'product_id'   => $product->id,
            'bom_id'       => $bom->id,
            'wo_number'    => 'WO-' . date('Y') . '-0001',
            'quantity'     => 50,
            'status'       => 'in_production',
            'priority'     => 'normal',
            'due_date'     => Carbon::now()->addDays(30),
            'notes'        => 'Standard production run. Follow op sheet BITAC-GS-001.',
            'created_by'   => $salesUser->id,
        ]);

        // Update RFQ status
        $rfq->update(['status' => 'quoted']);
        $quotation->update(['status' => 'converted']);

        // ==================================================================
        // Operation Sheet with 5 steps
        // ==================================================================
        $sheet = OperationSheet::create([
            'work_order_id' => $workOrder->id,
            'sheet_number'  => '01',
            'qr_code'       => 'WO-' . date('Y') . '-0001-SHEET-01',
            'notes'         => 'Follow all safety protocols. Use PPE at all times.',
            'approved_by'   => $supervisor->id,
            'approved_at'   => Carbon::now()->subDays(3),
        ]);

        $machines = Machine::all()->keyBy('machine_code');

        $steps = [
            [
                'sequence'        => 1,
                'operation_name'  => 'Rough Turning',
                'machine_code'    => 'MS-CL-001',
                'estimated_hours' => 2.5,
                'tooling_notes'   => 'Use CNMG insert, depth of cut 3mm, feed 0.3mm/rev',
            ],
            [
                'sequence'        => 2,
                'operation_name'  => 'Finish Turning',
                'machine_code'    => 'MS-CL-001',
                'estimated_hours' => 1.5,
                'tooling_notes'   => 'Use CNMG insert fine, depth of cut 0.5mm, feed 0.1mm/rev',
            ],
            [
                'sequence'        => 3,
                'operation_name'  => 'Heat Treatment (Hardening)',
                'machine_code'    => 'HT-BF-001',
                'estimated_hours' => 4.0,
                'tooling_notes'   => 'Harden at 850°C, quench in oil, temper at 200°C',
            ],
            [
                'sequence'        => 4,
                'operation_name'  => 'Grinding',
                'machine_code'    => 'MS-CL-001',
                'estimated_hours' => 1.0,
                'tooling_notes'   => 'Final size: 38.98-39.00mm, Ra 0.8',
            ],
            [
                'sequence'        => 5,
                'operation_name'  => 'Inspection & Packing',
                'machine_code'    => 'AS-TB-003',
                'estimated_hours' => 0.5,
                'tooling_notes'   => 'Final dimension check. Pack in oiled paper.',
            ],
        ];

        $createdSteps = [];
        foreach ($steps as $stepData) {
            $machine = $machines->get($stepData['machine_code']);
            $step = OperationStep::create([
                'operation_sheet_id' => $sheet->id,
                'sequence'           => $stepData['sequence'],
                'operation_name'     => $stepData['operation_name'],
                'machine_id'         => $machine?->id,
                'estimated_hours'    => $stepData['estimated_hours'],
                'tooling_notes'      => $stepData['tooling_notes'],
            ]);
            $createdSteps[] = $step;

            OperatorAssignment::create([
                'operation_step_id' => $step->id,
                'user_id'           => $operator->id,
                'shift'             => 'morning',
            ]);

            ProductionSchedule::create([
                'operation_step_id' => $step->id,
                'machine_id'        => $machine?->id ?? $machines->first()->id,
                'scheduled_date'    => Carbon::now()->addDays($stepData['sequence']),
                'shift'             => 'morning',
                'status'            => $stepData['sequence'] <= 2 ? 'completed' : 'scheduled',
            ]);
        }

        // ==================================================================
        // Material Requisition Notes (from MRP)
        // ==================================================================
        $mrqItems = [
            ['material_name' => 'EN24 Steel Bar (40mm dia)', 'material_code' => 'RM-EN24-40', 'required_qty' => 81.0, 'available_qty' => 65.0, 'shortage_qty' => 16.0, 'unit' => 'kg'],
            ['material_name' => 'Cutting Oil',               'material_code' => 'RM-CUT-OIL', 'required_qty' => 10.0, 'available_qty' => 10.0, 'shortage_qty' => 0,    'unit' => 'ltr'],
            ['material_name' => 'Grinding Wheel',            'material_code' => 'RM-GW-125',  'required_qty' => 2.5,  'available_qty' => 2.5,  'shortage_qty' => 0,    'unit' => 'pcs'],
        ];

        $procUser = User::whereHas('roles', fn($q) => $q->where('name', 'procurement-officer'))->first();
        foreach ($mrqItems as $item) {
            DB::table('material_requisition_notes')->insert(array_merge($item, [
                'work_order_id' => $workOrder->id,
                'status'        => $item['shortage_qty'] > 0 ? 'pending' : 'issued',
                'requested_by'  => $procUser->id,
                'created_at'    => now(),
                'updated_at'    => now(),
            ]));
        }

        // ==================================================================
        // Job Execution (currently in progress — step 1 & 2 done, step 3 active)
        // ==================================================================
        // Step 1 (completed)
        $machine1 = $machines->get('MS-CL-001');
        JobExecution::create([
            'operation_step_id' => $createdSteps[0]->id,
            'work_order_id'     => $workOrder->id,
            'operator_id'       => $operator->id,
            'machine_id'        => $machine1->id,
            'started_at'        => Carbon::now()->subHours(10),
            'stopped_at'        => Carbon::now()->subHours(7),
            'qty_completed'     => 50,
            'qty_rejected'      => 2,
            'reject_reason'     => 'Minor surface defect',
            'status'            => 'stopped',
        ]);

        // Step 2 (completed)
        JobExecution::create([
            'operation_step_id' => $createdSteps[1]->id,
            'work_order_id'     => $workOrder->id,
            'operator_id'       => $operator->id,
            'machine_id'        => $machine1->id,
            'started_at'        => Carbon::now()->subHours(6),
            'stopped_at'        => Carbon::now()->subHours(4),
            'qty_completed'     => 48,
            'qty_rejected'      => 0,
            'status'            => 'stopped',
        ]);

        // Step 3 (currently active — this shows on the live dashboard)
        $machine3 = $machines->get('HT-BF-001');
        $activeExecution = JobExecution::create([
            'operation_step_id' => $createdSteps[2]->id,
            'work_order_id'     => $workOrder->id,
            'operator_id'       => $operator->id,
            'machine_id'        => $machine3->id,
            'started_at'        => Carbon::now()->subHours(2),
            'qty_completed'     => 0,
            'qty_rejected'      => 0,
            'status'            => 'started',
        ]);

        // ==================================================================
        // Create a 2nd Work Order (QC Hold — for variety on live dashboard)
        // ==================================================================
        $product2  = Product::where('code', 'FL-002')->first();
        $bom2      = $product2->boms()->where('is_active', true)->first();

        $workOrder2 = WorkOrder::create([
            'quotation_id' => null,
            'customer_id'  => Customer::skip(1)->first()->id ?? $customer->id,
            'product_id'   => $product2->id,
            'bom_id'       => $bom2->id,
            'wo_number'    => 'WO-' . date('Y') . '-0002',
            'quantity'     => 20,
            'status'       => 'qc_hold',
            'priority'     => 'urgent',
            'due_date'     => Carbon::now()->addDays(5),
            'notes'        => 'Urgent order for BPDB shutdown maintenance.',
            'created_by'   => $salesUser->id,
        ]);

        $sheet2 = OperationSheet::create([
            'work_order_id' => $workOrder2->id,
            'sheet_number'  => '01',
            'qr_code'       => 'WO-' . date('Y') . '-0002-SHEET-01',
            'approved_by'   => $supervisor->id,
            'approved_at'   => Carbon::now()->subDays(1),
        ]);

        $machine2 = $machines->get('FB-PB-001');
        $step2 = OperationStep::create([
            'operation_sheet_id' => $sheet2->id,
            'sequence'           => 1,
            'operation_name'     => 'Press Forming',
            'machine_id'         => $machine2?->id,
            'estimated_hours'    => 3.0,
            'tooling_notes'      => 'Use 100T die set D-002',
        ]);

        // ==================================================================
        // QC Inspection (triggered the QC Hold)
        // ==================================================================
        $qcInspection = QcInspection::create([
            'work_order_id'     => $workOrder2->id,
            'operation_step_id' => $step2->id,
            'inspector_id'      => $qcUser->id,
            'result'            => 'fail',
            'inspection_date'   => Carbon::today(),
            'remarks'           => 'Dimensional non-conformance detected on flange face. OD 0.3mm oversize.',
        ]);

        QcChecklistItem::create(['qc_inspection_id' => $qcInspection->id, 'check_description' => 'OD measurement', 'measurement' => '200.3mm', 'tolerance' => '200±0.1mm', 'result' => 'fail']);
        QcChecklistItem::create(['qc_inspection_id' => $qcInspection->id, 'check_description' => 'Face flatness', 'measurement' => '0.05mm', 'tolerance' => '0.1mm max', 'result' => 'pass']);
        QcChecklistItem::create(['qc_inspection_id' => $qcInspection->id, 'check_description' => 'Bolt holes PCD', 'measurement' => '160.0mm', 'tolerance' => '160±0.05mm', 'result' => 'pass']);

        // NCR
        $ncr = Ncr::create([
            'qc_inspection_id'   => $qcInspection->id,
            'work_order_id'      => $workOrder2->id,
            'ncr_number'         => 'NCR-' . date('Y') . '-001',
            'defect_type'        => 'Dimensional Non-conformance',
            'root_cause'         => 'Tool wear not compensated in CNC program',
            'corrective_action'  => 'Re-machine to correct dimension. Update tool offset in program.',
            'responsible_user_id'=> $supervisor->id,
            'status'             => 'open',
        ]);

        // ==================================================================
        // Also create one overdue WO (for KPI testing)
        // ==================================================================
        WorkOrder::create([
            'quotation_id' => null,
            'customer_id'  => $customer->id,
            'product_id'   => Product::where('code', 'BS-003')->first()->id,
            'bom_id'       => Product::where('code', 'BS-003')->first()->boms()->first()->id,
            'wo_number'    => 'WO-' . date('Y') . '-0003',
            'quantity'     => 100,
            'status'       => 'in_production',
            'priority'     => 'urgent',
            'due_date'     => Carbon::now()->subDays(3),
            'notes'        => 'OVERDUE — urgent rescheduling needed.',
            'created_by'   => $salesUser->id,
        ]);

        // Audit log entries (for recent alerts feed)
        \App\Models\AuditLog::insert([
            ['user_id' => $operator->id, 'user_type' => 'staff', 'action' => 'job_started',    'model_type' => 'JobExecution', 'model_id' => $activeExecution->id, 'new_values' => json_encode(['message' => "Job started: WO-" . date('Y') . "-0001 on HT Furnace 1 by {$operator->name}"]), 'ip_address' => '127.0.0.1', 'created_at' => Carbon::now()->subHours(2), 'updated_at' => Carbon::now()->subHours(2)],
            ['user_id' => $operator->id, 'user_type' => 'staff', 'action' => 'job_stopped',    'model_type' => 'JobExecution', 'model_id' => 2, 'new_values' => json_encode(['message' => "Job completed: WO-" . date('Y') . "-0001 Step 2 — 48 pcs"]),                              'ip_address' => '127.0.0.1', 'created_at' => Carbon::now()->subHours(4), 'updated_at' => Carbon::now()->subHours(4)],
            ['user_id' => $qcUser->id,   'user_type' => 'staff', 'action' => 'qc_hold',        'model_type' => 'WorkOrder',    'model_id' => $workOrder2->id, 'new_values' => json_encode(['message' => "QC Hold placed: WO-" . date('Y') . "-0002 by {$qcUser->name}"]),             'ip_address' => '127.0.0.1', 'created_at' => Carbon::now()->subHours(1), 'updated_at' => Carbon::now()->subHours(1)],
            ['user_id' => $qcUser->id,   'user_type' => 'staff', 'action' => 'ncr_created',    'model_type' => 'Ncr',          'model_id' => $ncr->id,         'new_values' => json_encode(['message' => "NCR raised: NCR-" . date('Y') . "-001 on WO-" . date('Y') . "-0002 — Dimensional Non-conformance"]), 'ip_address' => '127.0.0.1', 'created_at' => Carbon::now()->subMinutes(45), 'updated_at' => Carbon::now()->subMinutes(45)],
            ['user_id' => $operator->id, 'user_type' => 'staff', 'action' => 'job_started',    'model_type' => 'JobExecution', 'model_id' => 1, 'new_values' => json_encode(['message' => "Job started: WO-" . date('Y') . "-0001 Step 1 on CNC Lathe 1"]),                           'ip_address' => '127.0.0.1', 'created_at' => Carbon::now()->subHours(10), 'updated_at' => Carbon::now()->subHours(10)],
        ]);
    }
}
