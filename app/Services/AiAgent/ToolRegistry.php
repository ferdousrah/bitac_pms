<?php

namespace App\Services\AiAgent;

use App\Models\Customer;
use App\Models\DowntimeEvent;
use App\Models\Invoice;
use App\Models\JobExecution;
use App\Models\Machine;
use App\Models\Ncr;
use App\Models\Product;
use App\Models\Quotation;
use App\Models\Rfq;
use App\Models\RfqItem;
use App\Models\WorkOrder;
use App\Services\RfqAutomationService;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;

class ToolRegistry
{
    /**
     * Convert all tool definitions to Gemini's function_declarations format.
     */
    public function toGeminiFormat(): array
    {
        return ['function_declarations' => $this->declarations()];
    }

    /**
     * Execute a tool by name.
     */
    /**
     * Human-friendly display names for each agent tool.
     */
    /** All navigable pages in the system */
    private const PAGE_MAP = [
        // Core
        'dashboard'              => ['url' => '/dashboard',                  'label' => 'Dashboard'],
        'live dashboard'         => ['url' => '/dashboard/live',             'label' => 'Live Operations Dashboard'],
        // IED
        'rfqs'                   => ['url' => '/rfqs',                       'label' => 'RFQs'],
        'cost estimates'         => ['url' => '/cost-estimates',             'label' => 'Cost Estimates'],
        'quotations'             => ['url' => '/quotations',                 'label' => 'Quotations'],
        // PCD
        'pcd inbox'              => ['url' => '/pcd/inbox',                  'label' => 'PCD Inbox'],
        'material requisitions'  => ['url' => '/pcd/material-requisitions',  'label' => 'Material Requisitions'],
        'work orders'            => ['url' => '/work-orders',                'label' => 'Work Orders'],
        'operation sheets'       => ['url' => '/operation-sheets',           'label' => 'Operation Sheets'],
        'schedule'               => ['url' => '/schedule',                   'label' => 'Production Schedule'],
        // Production
        'shop floor'             => ['url' => '/shop-floor',                 'label' => 'Shop Floor'],
        'wip'                    => ['url' => '/wip',                        'label' => 'Work In Progress'],
        // Quality
        'qc inspections'         => ['url' => '/qc',                         'label' => 'QC Inspections'],
        'qc'                     => ['url' => '/qc',                         'label' => 'QC Inspections'],
        'ncrs'                   => ['url' => '/ncrs',                       'label' => 'NCRs'],
        // Delivery
        'delivery orders'        => ['url' => '/delivery',                   'label' => 'Delivery Orders'],
        'delivery'               => ['url' => '/delivery',                   'label' => 'Delivery Orders'],
        'invoices'               => ['url' => '/invoices',                   'label' => 'Invoices'],
        // Reports
        'production report'      => ['url' => '/reports/production',         'label' => 'Production Report'],
        'oee report'             => ['url' => '/reports/oee',                'label' => 'OEE Report'],
        'lead time report'       => ['url' => '/reports/lead-time',          'label' => 'Lead Time Report'],
        'rejection rate report'  => ['url' => '/reports/rejection-rate',     'label' => 'Rejection Rate Report'],
        // Admin
        'users'                  => ['url' => '/admin/users',                'label' => 'User Management'],
        'roles'                  => ['url' => '/admin/roles',                'label' => 'Roles & Permissions'],
        'customers'              => ['url' => '/admin/customers',            'label' => 'Customer Management'],
        'approval chain'         => ['url' => '/admin/approval-chain',       'label' => 'Approval Chain'],
        'branding'               => ['url' => '/admin/branding',             'label' => 'Branding Settings'],
        'branding settings'      => ['url' => '/admin/branding',             'label' => 'Branding Settings'],
        'audit log'              => ['url' => '/admin/audit-log',            'label' => 'Audit Log'],
        'sections'               => ['url' => '/admin/sections',             'label' => 'Sections'],
        'machines'               => ['url' => '/admin/machines',             'label' => 'Machines'],
        'operators'              => ['url' => '/admin/operators',            'label' => 'Operators'],
        'materials'              => ['url' => '/admin/materials',            'label' => 'Materials'],
        'operations'             => ['url' => '/admin/operations',           'label' => 'Operations'],
        // Profile
        'profile'                => ['url' => '/profile',                    'label' => 'My Profile'],
        'notifications'          => ['url' => '/notifications',              'label' => 'Notifications'],
    ];

    public static function displayName(string $toolName): string
    {
        return match ($toolName) {
            'production_monitor'    => '🏭 Production Monitor',
            'work_order_tracker'    => '📋 Work Order Tracker',
            'machine_health_agent'  => '🔧 Machine Health Agent',
            'finance_analyst'       => '💰 Finance Analyst',
            'qc_inspector'          => '✅ QC Inspector',
            'quality_analyst'       => '📊 Quality Analyst',
            'sales_pipeline_agent'  => '📈 Sales Pipeline Agent',
            'downtime_analyst'      => '⏱️ Downtime Analyst',
            'excel_report_builder'  => '📑 Excel Report Builder',
            'pdf_report_builder'    => '📄 PDF Report Builder',
            'chart_generator'       => '📊 Chart Generator',
            'presentation_builder'  => '📽️ Presentation Builder',
            'live_presentation'     => '🎬 Live Presenter',
            'oli_introduction'      => '👋 Oli Introduction',
            'navigator'             => '🧭 Navigator',
            'customer_creator'      => '🏢 Customer Creator',
            'cost_estimate_advisor'  => '📐 Cost Estimate Advisor',
            'rfq_creator'           => '📝 RFQ Creator',
            'rfq_auto_estimate'     => '📊 Auto Estimator',
            'rfq_auto_quotation'    => '💰 Auto Quotation',
            'rfq_analytics'         => '📈 RFQ Analytics',
            default                 => $toolName,
        };
    }

    public function execute(string $name, array $args): array
    {
        return match ($name) {
            'production_monitor'    => $this->getProductionStats($args),
            'work_order_tracker'    => $this->queryWorkOrders($args),
            'machine_health_agent'  => $this->getMachineStatus($args),
            'finance_analyst'       => $this->getFinancialSummary($args),
            'qc_inspector'          => $this->queryNcrs($args),
            'quality_analyst'       => $this->getQcMetrics($args),
            'sales_pipeline_agent'  => $this->queryQuotations($args),
            'downtime_analyst'      => $this->getDowntimeReport($args),
            'excel_report_builder'  => $this->generateExcel($args),
            'pdf_report_builder'    => $this->generatePdf($args),
            'chart_generator'       => $this->generateChart($args),
            'presentation_builder'  => $this->generatePresentation($args),
            'live_presentation'     => $this->generateLivePresentation($args),
            'oli_introduction'      => $this->generateOliIntroduction($args),
            'navigator'             => $this->navigateToPage($args),
            'customer_creator'      => $this->createCustomerViaTool($args),
            'cost_estimate_advisor'  => $this->queryCostEstimates($args),
            'rfq_creator'           => $this->createRfqViaTool($args),
            'rfq_auto_estimate'     => $this->triggerAutoEstimate($args),
            'rfq_auto_quotation'    => $this->triggerAutoQuotation($args),
            'rfq_analytics'         => $this->getRfqAnalytics($args),
            default                 => ['error' => "Unknown tool: {$name}"],
        };
    }

    // ─── Tool Declarations ──────────────────────────────────────────────

    private function declarations(): array
    {
        return [
            [
                'name'        => 'production_monitor',
                'description' => 'Production Monitor Agent — Get overall production KPIs: active jobs, completed today, overdue, pending QC, open NCRs, machines running. Optionally filter by date range.',
                'parameters'  => [
                    'type'       => 'OBJECT',
                    'properties' => [
                        'date_from' => ['type' => 'STRING', 'description' => 'Start date (YYYY-MM-DD). Default: today.'],
                        'date_to'   => ['type' => 'STRING', 'description' => 'End date (YYYY-MM-DD). Default: today.'],
                    ],
                ],
            ],
            [
                'name'        => 'work_order_tracker',
                'description' => 'Work Order / Job Tracker Agent — Search and filter work orders by Job number (e.g. 37700), WO number (e.g. WO-2026-0001), status, customer, etc. ALWAYS use this when the user mentions a Job # or WO number. Returns Job #, WO number, product, customer, status, progress %, priority, due date, current production section, related NCRs and invoices.',
                'parameters'  => [
                    'type'       => 'OBJECT',
                    'properties' => [
                        'job_number'=> ['type' => 'STRING', 'description' => 'Filter by Job number (exact or partial, e.g. "37700"). The Job # is the customer-facing identifier. Use this when the user says "Job #X" or "job number X".'],
                        'wo_number' => ['type' => 'STRING', 'description' => 'Filter by Work Order number (partial match, e.g. "WO-2026-0001" or just "0001").'],
                        'status'    => ['type' => 'STRING', 'description' => 'Filter by status: draft, approved, in_production, qc_hold, qc_passed, ready_for_delivery, delivered, cancelled, released_to_shops, pcd_pending'],
                        'priority'  => ['type' => 'STRING', 'description' => 'Filter by priority: urgent, high, normal, low'],
                        'customer'  => ['type' => 'STRING', 'description' => 'Filter by customer name (partial match)'],
                        'overdue'   => ['type' => 'BOOLEAN', 'description' => 'If true, only return overdue work orders'],
                        'date_from' => ['type' => 'STRING', 'description' => 'Created after (YYYY-MM-DD)'],
                        'date_to'   => ['type' => 'STRING', 'description' => 'Created before (YYYY-MM-DD)'],
                        'limit'     => ['type' => 'INTEGER', 'description' => 'Max results (default 10, max 20)'],
                    ],
                ],
            ],
            [
                'name'        => 'machine_health_agent',
                'description' => 'Machine Health Agent — Get machine fleet status: states (running/idle/setup/maintenance/breakdown/offline), health scores, machines needing maintenance, top critical machines.',
                'parameters'  => [
                    'type'       => 'OBJECT',
                    'properties' => [
                        'work_centre' => ['type' => 'STRING', 'description' => 'Filter by work centre name (partial match)'],
                        'state'       => ['type' => 'STRING', 'description' => 'Filter by state: running, idle, setup, maintenance, breakdown, offline'],
                    ],
                ],
            ],
            [
                'name'        => 'finance_analyst',
                'description' => 'Finance Analyst Agent — Get financial overview: invoiced amounts (today/month), outstanding invoices, quotation pipeline, conversion rates.',
                'parameters'  => [
                    'type'       => 'OBJECT',
                    'properties' => [
                        'period' => ['type' => 'STRING', 'description' => 'Period: today, this_week, this_month, this_year. Default: this_month.'],
                    ],
                ],
            ],
            [
                'name'        => 'qc_inspector',
                'description' => 'QC Inspector Agent — Query Non-Conformance Reports (NCRs). Returns NCR details with status, type, and work order info.',
                'parameters'  => [
                    'type'       => 'OBJECT',
                    'properties' => [
                        'status'    => ['type' => 'STRING', 'description' => 'Filter: open, in_rework, closed'],
                        'date_from' => ['type' => 'STRING', 'description' => 'Created after (YYYY-MM-DD)'],
                        'date_to'   => ['type' => 'STRING', 'description' => 'Created before (YYYY-MM-DD)'],
                        'limit'     => ['type' => 'INTEGER', 'description' => 'Max results (default 10)'],
                    ],
                ],
            ],
            [
                'name'        => 'quality_analyst',
                'description' => 'Quality Analyst Agent — Get quality control metrics: pass rates, inspection counts, NCR counts by month, top defect types.',
                'parameters'  => [
                    'type'       => 'OBJECT',
                    'properties' => [
                        'months' => ['type' => 'INTEGER', 'description' => 'Number of months to look back (default 6, max 12)'],
                    ],
                ],
            ],
            [
                'name'        => 'sales_pipeline_agent',
                'description' => 'Sales Pipeline Agent — Query quotation pipeline: status breakdown, recent quotations, conversion stats.',
                'parameters'  => [
                    'type'       => 'OBJECT',
                    'properties' => [
                        'status'    => ['type' => 'STRING', 'description' => 'Filter: draft, pending_approval, approved, rejected, converted'],
                        'customer'  => ['type' => 'STRING', 'description' => 'Filter by customer name (partial match)'],
                        'date_from' => ['type' => 'STRING', 'description' => 'Created after (YYYY-MM-DD)'],
                        'limit'     => ['type' => 'INTEGER', 'description' => 'Max results (default 10)'],
                    ],
                ],
            ],
            [
                'name'        => 'downtime_analyst',
                'description' => 'Downtime Analyst Agent — Get machine downtime data: total hours, breakdown by category, top offending machines.',
                'parameters'  => [
                    'type'       => 'OBJECT',
                    'properties' => [
                        'date_from' => ['type' => 'STRING', 'description' => 'Start date (YYYY-MM-DD). Default: 30 days ago.'],
                        'date_to'   => ['type' => 'STRING', 'description' => 'End date (YYYY-MM-DD). Default: today.'],
                        'machine'   => ['type' => 'STRING', 'description' => 'Filter by machine name (partial match)'],
                    ],
                ],
            ],
            [
                'name'        => 'navigator',
                'description' => 'Navigator Agent — Navigate the user to any page in BITAC PMS. Use when the user asks to "go to", "open", "show me", "take me to", or "navigate to" a page. Returns a URL that the frontend will navigate to. Available pages: dashboard, live dashboard, rfqs, cost estimates, quotations, pcd inbox, material requisitions, work orders, operation sheets, schedule, shop floor, wip, qc inspections, ncrs, delivery orders, invoices, production report, oee report, lead time report, rejection rate report, users, roles, customers, approval chain, branding settings, audit log, sections, machines, operators, materials, operations, profile, notifications.',
                'parameters'  => [
                    'type'       => 'OBJECT',
                    'properties' => [
                        'page' => ['type' => 'STRING', 'description' => 'The page name to navigate to (e.g. "branding settings", "work orders", "roles", "dashboard"). Use lowercase.'],
                    ],
                    'required' => ['page'],
                ],
            ],
            [
                'name'        => 'customer_creator',
                'description' => 'Customer Creator Agent — Add a new customer to the system. Use when the user wants to create an RFQ for a customer that does not exist yet. Only the name is required; other fields are optional. After creating, proceed to create the RFQ.',
                'parameters'  => [
                    'type'       => 'OBJECT',
                    'properties' => [
                        'name'           => ['type' => 'STRING', 'description' => 'Customer/company name (required)'],
                        'contact_person' => ['type' => 'STRING', 'description' => 'Contact person name (optional)'],
                        'email'          => ['type' => 'STRING', 'description' => 'Email address (optional)'],
                        'phone'          => ['type' => 'STRING', 'description' => 'Phone number (optional)'],
                        'address'        => ['type' => 'STRING', 'description' => 'Company address (optional)'],
                    ],
                    'required' => ['name'],
                ],
            ],
            [
                'name'        => 'cost_estimate_advisor',
                'description' => 'Cost Estimate Advisor Agent — Query cost estimation data. Can search estimates by job name/customer/number, look up material rates, operation rates, compare costs, find averages, and analyze pricing trends. Use for ANY question about cost estimation, pricing, rates, materials, operations, or job costing.',
                'parameters'  => [
                    'type'       => 'OBJECT',
                    'properties' => [
                        'action' => ['type' => 'STRING', 'description' => 'Action: search_estimates, material_rates, operation_rates, estimate_details, cost_summary, rate_comparison'],
                        'query'  => ['type' => 'STRING', 'description' => 'Search term: job name, estimate number, material name, operation name, or customer name'],
                        'customer_id' => ['type' => 'INTEGER', 'description' => 'Filter by customer ID (optional)'],
                        'material'    => ['type' => 'STRING', 'description' => 'Material name to look up rates for (optional)'],
                        'operation'   => ['type' => 'STRING', 'description' => 'Operation name to look up rates for (optional)'],
                        'pricing_group' => ['type' => 'STRING', 'description' => 'Pricing group A/B/C (optional)'],
                        'limit'       => ['type' => 'INTEGER', 'description' => 'Max results (default 10)'],
                    ],
                    'required' => ['action'],
                ],
            ],
            [
                'name'        => 'rfq_creator',
                'description' => <<<'DESC'
RFQ Creator Agent — Create a new Request for Quotation. Fuzzy-matches customer and product names.

IMPORTANT WORKFLOW:
- If the user provides enough info (at least customer + items), create the RFQ immediately.
- If info is MISSING, do NOT call this tool yet. Instead, ASK the user conversationally for the missing details.
- Required: customer name + at least 1 item (with description and quantity).
- Optional but valuable: customer_ref_no, required_by date, reference_type, sample info, notes.

When asking, use this format:
"I'll prepare the RFQ. Let me confirm the details:
- **Customer**: [name]
- **Items**: [list]
- **Customer Ref/PO**: ? (optional)
- **Required By**: ? (optional)
- **Reference**: Drawing / Physical Sample / Both / None?
- **Notes**: ? (optional)

Please confirm or add any missing details."

Only call this tool when you have at least customer + items confirmed.
DESC,
                'parameters'  => [
                    'type'       => 'OBJECT',
                    'properties' => [
                        'customer'           => ['type' => 'STRING', 'description' => 'Customer/company name (partial match OK)'],
                        'customer_ref_no'    => ['type' => 'STRING', 'description' => 'Customer PO or reference number'],
                        'required_by'        => ['type' => 'STRING', 'description' => 'Deadline date YYYY-MM-DD'],
                        'notes'              => ['type' => 'STRING', 'description' => 'Internal notes for staff'],
                        'reference_type'     => ['type' => 'STRING', 'description' => 'Reference material type: none, drawing, physical_sample, or both. Default: none'],
                        'sample_received'    => ['type' => 'BOOLEAN', 'description' => 'Whether physical sample has been received at BITAC'],
                        'sample_description' => ['type' => 'STRING', 'description' => 'Description/condition of physical sample'],
                        'items'              => ['type' => 'ARRAY', 'description' => 'Job items array. Each item: {description: string (part/job name), product_name?: string (to fuzzy-match existing product), quantity: number, unit?: string (pcs/set/kg/nos/pair/lot, default pcs), notes?: string}', 'items' => ['type' => 'OBJECT']],
                    ],
                    'required' => ['customer', 'items'],
                ],
            ],
            [
                'name'        => 'rfq_auto_estimate',
                'description' => 'Auto Estimator Agent — Trigger auto cost estimation for an existing RFQ by finding similar historical estimates. Returns the generated estimate details or explains why no match was found.',
                'parameters'  => [
                    'type'       => 'OBJECT',
                    'properties' => [
                        'rfq_id' => ['type' => 'INTEGER', 'description' => 'The RFQ ID to auto-estimate'],
                    ],
                    'required' => ['rfq_id'],
                ],
            ],
            [
                'name'        => 'rfq_auto_quotation',
                'description' => 'Auto Quotation Agent — Generate a draft quotation from a cost estimate, applying configurable profit margin and defaults. Use when user asks to generate or create a quotation from an estimate.',
                'parameters'  => [
                    'type'       => 'OBJECT',
                    'properties' => [
                        'cost_estimate_id' => ['type' => 'INTEGER', 'description' => 'The cost estimate ID to base the quotation on'],
                        'profit_margin'    => ['type' => 'NUMBER', 'description' => 'Override profit margin % (optional, default from settings)'],
                    ],
                    'required' => ['cost_estimate_id'],
                ],
            ],
            [
                'name'        => 'rfq_analytics',
                'description' => 'RFQ Analytics Agent — Get RFQ and quotation analytics: conversion rates, average processing times, status breakdowns, top customers, pipeline summary. Use for questions like "what is our RFQ conversion rate" or "how long does it take to quote" or "show me the sales pipeline".',
                'parameters'  => [
                    'type'       => 'OBJECT',
                    'properties' => [
                        'metric' => ['type' => 'STRING', 'description' => 'One of: conversion_rate, avg_time_to_quotation, status_breakdown, top_customers, pipeline_summary'],
                        'period' => ['type' => 'STRING', 'description' => 'Period: today, this_week, this_month, this_quarter, this_year. Default: this_month'],
                    ],
                    'required' => ['metric'],
                ],
            ],
            [
                'name'        => 'excel_report_builder',
                'description' => 'Excel Report Builder Agent — Generate a downloadable Excel (.xlsx) spreadsheet from data. You MUST provide a title, column headers array, and rows (array of objects). Returns a download URL. Use this when user asks for Excel export, spreadsheet, or CSV-like data.',
                'parameters'  => [
                    'type'       => 'OBJECT',
                    'properties' => [
                        'title'   => ['type' => 'STRING', 'description' => 'Report title (e.g. "Overdue Work Orders Report")'],
                        'headers' => ['type' => 'ARRAY', 'description' => 'Column header names', 'items' => ['type' => 'STRING']],
                        'rows'    => ['type' => 'ARRAY', 'description' => 'Array of row objects. Each row keys must match headers.', 'items' => ['type' => 'OBJECT']],
                        'summary' => ['type' => 'OBJECT', 'description' => 'Optional key-value summary (e.g. {"Total": 25, "Overdue": 3})'],
                    ],
                    'required' => ['title', 'headers', 'rows'],
                ],
            ],
            [
                'name'        => 'pdf_report_builder',
                'description' => 'PDF Report Builder Agent — Generate a downloadable PDF report. Provide a title and either raw HTML body content OR a table (headers + rows). Returns a download URL. Use when user asks for a PDF report, printable document, or formal report.',
                'parameters'  => [
                    'type'       => 'OBJECT',
                    'properties' => [
                        'title'   => ['type' => 'STRING', 'description' => 'Report title'],
                        'headers' => ['type' => 'ARRAY', 'description' => 'Table column headers (for table-based PDF)', 'items' => ['type' => 'STRING']],
                        'rows'    => ['type' => 'ARRAY', 'description' => 'Table rows (for table-based PDF)', 'items' => ['type' => 'OBJECT']],
                        'html'    => ['type' => 'STRING', 'description' => 'Raw HTML body content (alternative to headers+rows)'],
                        'summary' => ['type' => 'OBJECT', 'description' => 'Optional key-value summary'],
                    ],
                    'required' => ['title'],
                ],
            ],
            [
                'name'        => 'chart_generator',
                'description' => 'Chart Generator Agent — Create a chart image (SVG) from data. Supported types: bar, line, pie. Returns a download/view URL. Use when user asks for a chart, graph, visualization, or visual representation of data.',
                'parameters'  => [
                    'type'       => 'OBJECT',
                    'properties' => [
                        'title' => ['type' => 'STRING', 'description' => 'Chart title'],
                        'type'  => ['type' => 'STRING', 'description' => 'Chart type: bar, line, or pie'],
                        'data'  => ['type' => 'ARRAY', 'description' => 'Array of {label, value} objects', 'items' => ['type' => 'OBJECT']],
                    ],
                    'required' => ['title', 'type', 'data'],
                ],
            ],
            [
                'name'        => 'presentation_builder',
                'description' => 'Presentation Builder Agent — Generate a downloadable PowerPoint (.pptx) presentation with native 3D charts, tables, and text. Provide a title and slides array. Each slide can have: title, body text, bullets, table (headers+rows), AND/OR a chart. Charts are NATIVE PPTX 3D charts (bar, pie, line). Use when user asks for a presentation, slides, or PPTX. ALWAYS include charts when presenting data visually.',
                'parameters'  => [
                    'type'       => 'OBJECT',
                    'properties' => [
                        'title'   => ['type' => 'STRING', 'description' => 'Presentation title'],
                        'slides'  => ['type' => 'ARRAY', 'description' => 'Array of slide objects. Each: {title: string, body?: string, bullets?: string[], table?: {headers: string[], rows: object[]}, chart?: {type: "bar"|"pie"|"line", title: string, series_name: string, data: [{label: string, value: number}]}}', 'items' => ['type' => 'OBJECT']],
                        'summary' => ['type' => 'OBJECT', 'description' => 'Optional KPI summary for title slide'],
                    ],
                    'required' => ['title', 'slides'],
                ],
            ],
            [
                'name'        => 'oli_introduction',
                'description' => 'Oli Self-Introduction Agent — Launch a polished introductory presentation where Oli introduces himself and demonstrates his capabilities. Use this ONLY when the user asks: "introduce yourself", "who are you", "what can you do", "show your capabilities", "present yourself", "tell us about yourself", "give a demo", "নিজের পরিচয় দাও", "আপনার পরিচয় দিন", "তুমি কে", "কী করতে পারো", or similar. Supports both English and Bengali. Pass language="bn" if user writes in Bengali, otherwise "en" (default).',
                'parameters'  => [
                    'type'       => 'OBJECT',
                    'properties' => [
                        'audience' => ['type' => 'STRING', 'description' => 'Optional: target audience (e.g., "executive team", "DG office", "IT department"). Adjusts tone.'],
                        'language' => ['type' => 'STRING', 'description' => 'Language of the presentation: "en" (English) or "bn" (Bengali/বাংলা). Default: en. Use "bn" if the user is writing in Bengali.'],
                    ],
                ],
            ],
            [
                'name'        => 'live_presentation',
                'description' => 'Live Presenter Agent — Launch an INTERACTIVE live presentation in the browser with voice narration, animated slides, charts, and real-time Q&A. Use this when the user asks to "present", "show me a live presentation", "present this report live", or "give a presentation". Each slide MUST have speaker_notes (what Oli will SAY aloud). Include charts, KPIs, tables, and bullets. The presentation opens fullscreen with play/pause controls and the user can ask questions mid-presentation.',
                'parameters'  => [
                    'type'       => 'OBJECT',
                    'properties' => [
                        'title'    => ['type' => 'STRING', 'description' => 'Presentation title'],
                        'subtitle' => ['type' => 'STRING', 'description' => 'Optional subtitle (e.g. date range, department)'],
                        'slides'   => ['type' => 'ARRAY', 'description' => 'Array of slide objects. Each: {title: string, body?: string, bullets?: string[], kpis?: [{label: string, value: string, trend?: "up"|"down"|"neutral", color?: string}], table?: {headers: string[], rows: object[]}, chart?: {type: "bar"|"pie"|"line", title: string, data: [{label: string, value: number}]}, speaker_notes: string, layout?: "title"|"content"|"kpi"|"chart"|"split"|"closing"}. speaker_notes is REQUIRED — it is what Oli speaks aloud for each slide.', 'items' => ['type' => 'OBJECT']],
                    ],
                    'required' => ['title', 'slides'],
                ],
            ],
        ];
    }

    // ─── Tool Implementations ───────────────────────────────────────────

    private function getProductionStats(array $args): array
    {
        $today = Carbon::today();

        return [
            'active_jobs'       => WorkOrder::whereIn('status', ['in_production', 'qc_hold'])->count(),
            'completed_today'   => WorkOrder::where('status', 'delivered')->whereDate('updated_at', $today)->count(),
            'overdue_jobs'      => WorkOrder::whereNotIn('status', ['delivered', 'cancelled'])
                                            ->whereNotNull('due_date')->where('due_date', '<', $today)->count(),
            'pending_qc'        => WorkOrder::where('status', 'qc_hold')->count(),
            'total_work_orders' => WorkOrder::count(),
            'open_ncrs'         => Ncr::whereIn('status', ['open', 'in_rework'])->count(),
            'machines_running'  => Machine::where('current_state', 'running')->count(),
            'total_machines'    => Machine::count(),
            'date'              => $today->toDateString(),
        ];
    }

    private function queryWorkOrders(array $args): array
    {
        $query = WorkOrder::with([
            'product', 'customer',
            'sections.section', 'operationSheets.steps',
            'ncrs:id,work_order_id,ncr_number,status',
            'invoices:id,work_order_id,invoice_number,total_amount,status',
            'deliveryOrders:id,work_order_id,challan_number,status,delivered_at',
        ]);

        // Job # / WO # — strip the # prefix or surrounding whitespace so the AI
        // doesn't have to be too precise. Job # is an integer column, so support
        // both exact and partial matches; WO # is a string with hyphens.
        if (!empty($args['job_number'])) {
            $job = trim((string) $args['job_number'], "# \t\n\r\0\x0B");
            $query->where(function ($q) use ($job) {
                $q->where('job_number', $job)
                  ->orWhere('job_number', 'like', "%{$job}%");
            });
        }
        if (!empty($args['wo_number'])) {
            $wo = trim((string) $args['wo_number']);
            $query->where('wo_number', 'like', "%{$wo}%");
        }
        if (!empty($args['status']))    $query->where('status', $args['status']);
        if (!empty($args['priority']))  $query->where('priority', $args['priority']);
        if (!empty($args['customer']))  $query->whereHas('customer', fn($q) => $q->where('name', 'like', "%{$args['customer']}%"));
        if (!empty($args['date_from'])) $query->whereDate('created_at', '>=', $args['date_from']);
        if (!empty($args['date_to']))   $query->whereDate('created_at', '<=', $args['date_to']);
        if (!empty($args['overdue']))   $query->whereNotIn('status', ['delivered', 'cancelled'])
                                              ->whereNotNull('due_date')->where('due_date', '<', Carbon::today());

        $limit = min($args['limit'] ?? 10, 20);

        $results = $query->latest()->limit($limit)->get()->map(function ($wo) {
            // Current production section: WOS that's in_progress / rework
            $current = $wo->sections->firstWhere('status', 'in_progress')
                    ?? $wo->sections->firstWhere('status', 'rework')
                    ?? $wo->sections->firstWhere('status', 'ready');

            // Weighted progress %
            $progressPct = (function () use ($wo) {
                if (in_array($wo->status, ['qc_passed', 'ready_for_delivery', 'delivered'])) return 100;
                if ($wo->status === 'cancelled') return null;
                $sheet = $wo->operationSheets->first();
                if (!$sheet) return 0;
                $steps = $sheet->steps;
                if ($steps->isEmpty()) return 0;
                $weightSum = $steps->sum(fn($s) => (float) $s->weight_pct);
                if ($weightSum > 0) {
                    $done = $steps->where('status', 'completed')->sum(fn($s) => (float) $s->weight_pct);
                    $wip  = $steps->where('status', 'in_progress')->sum(fn($s) => (float) $s->weight_pct);
                    return (int) round(min(100, $done + $wip * 0.5));
                }
                $total = $steps->count();
                $done  = $steps->where('status', 'completed')->count();
                $wip   = $steps->where('status', 'in_progress')->count();
                return (int) round((($done + $wip * 0.5) / $total) * 100);
            })();

            return [
                'job_number'  => $wo->job_number,
                'wo_number'   => $wo->wo_number,
                'product'     => $wo->product->name ?? '—',
                'customer'    => $wo->customer->name ?? '—',
                'quantity'    => (float) $wo->quantity,
                'status'      => $wo->status_label ?? $wo->status,
                'priority'    => $wo->priority ?? 'normal',
                'progress_pct'=> $progressPct,
                'current_section' => $current?->section?->name,
                'due_date'    => $wo->due_date?->toDateString(),
                'is_overdue'  => $wo->is_overdue,
                'created_at'  => $wo->created_at->toDateString(),
                'open_ncrs'   => $wo->ncrs->whereIn('status', ['open', 'in_rework'])->count(),
                'invoices'    => $wo->invoices->map(fn($i) => [
                    'invoice_number' => $i->invoice_number,
                    'status'         => $i->status,
                    'total_amount'   => (float) $i->total_amount,
                ])->values(),
                'last_challan'=> $wo->deliveryOrders->last()?->challan_number,
            ];
        });

        return ['count' => $results->count(), 'work_orders' => $results->toArray()];
    }

    private function getMachineStatus(array $args): array
    {
        $query = Machine::with('workCentre');
        if (!empty($args['work_centre'])) $query->whereHas('workCentre', fn($q) => $q->where('name', 'like', "%{$args['work_centre']}%"));
        if (!empty($args['state']))       $query->where('current_state', $args['state']);

        $machines = $query->get();

        $stateBreakdown = $machines->groupBy('current_state')->map->count();
        $avgHealth      = $machines->count() > 0 ? round($machines->avg(fn($m) => $m->health_score)) : 0;

        $critical = $machines->filter(fn($m) => $m->health_score < 40)->sortBy(fn($m) => $m->health_score)->take(5)
            ->map(fn($m) => [
                'name'         => $m->name,
                'code'         => $m->machine_code,
                'work_centre'  => $m->workCentre->name ?? '—',
                'state'        => $m->current_state,
                'health_score' => $m->health_score,
                'health_label' => $m->health_label,
                'days_until_maintenance' => $m->days_until_maintenance,
            ])->values();

        $maintenanceDue = $machines->filter(fn($m) => $m->maintenance_status === 'overdue' || $m->maintenance_status === 'due_soon')
            ->take(5)->map(fn($m) => [
                'name'      => $m->name,
                'code'      => $m->machine_code,
                'days_left' => $m->days_until_maintenance,
                'overdue'   => $m->maintenance_status === 'overdue',
            ])->values();

        return [
            'total_machines'   => $machines->count(),
            'state_breakdown'  => $stateBreakdown,
            'avg_health_score' => $avgHealth,
            'critical_machines'=> $critical->toArray(),
            'maintenance_due'  => $maintenanceDue->toArray(),
        ];
    }

    private function getFinancialSummary(array $args): array
    {
        $period = $args['period'] ?? 'this_month';
        $from = match ($period) {
            'today'      => Carbon::today(),
            'this_week'  => Carbon::now()->startOfWeek(),
            'this_year'  => Carbon::now()->startOfYear(),
            default      => Carbon::now()->startOfMonth(),
        };

        $invoicedPeriod   = (float) Invoice::where('created_at', '>=', $from)->sum('total_amount');
        $outstanding      = (float) Invoice::where('status', 'issued')->sum('total_amount');
        $quotedPeriod     = (float) Quotation::where('created_at', '>=', $from)->sum('total_amount');
        $convertedPeriod  = (float) Quotation::where('status', 'converted')->where('updated_at', '>=', $from)->sum('total_amount');
        $conversionRate   = $quotedPeriod > 0 ? round(($convertedPeriod / $quotedPeriod) * 100, 1) : 0;
        $pendingQuotes    = Quotation::where('status', 'pending_approval')->count();
        $approvedQuotes   = Quotation::where('status', 'approved')->count();

        return [
            'period'           => $period,
            'invoiced_amount'  => $invoicedPeriod,
            'outstanding'      => $outstanding,
            'quoted_amount'    => $quotedPeriod,
            'converted_amount' => $convertedPeriod,
            'conversion_rate'  => $conversionRate,
            'pending_quotes'   => $pendingQuotes,
            'approved_quotes'  => $approvedQuotes,
            'currency'         => 'BDT',
        ];
    }

    private function queryNcrs(array $args): array
    {
        $query = Ncr::with('workOrder');
        if (!empty($args['status']))    $query->where('status', $args['status']);
        if (!empty($args['date_from'])) $query->whereDate('created_at', '>=', $args['date_from']);
        if (!empty($args['date_to']))   $query->whereDate('created_at', '<=', $args['date_to']);

        $limit = min($args['limit'] ?? 10, 20);

        $results = $query->latest()->limit($limit)->get()->map(fn($ncr) => [
            'id'         => $ncr->id,
            'wo_number'  => $ncr->workOrder->wo_number ?? '—',
            'status'     => $ncr->status,
            'category'   => $ncr->category ?? '—',
            'description'=> \Illuminate\Support\Str::limit($ncr->description ?? '', 100),
            'created_at' => $ncr->created_at->toDateString(),
        ]);

        $summary = [
            'open'      => Ncr::where('status', 'open')->count(),
            'in_rework' => Ncr::where('status', 'in_rework')->count(),
            'closed'    => Ncr::where('status', 'closed')->count(),
        ];

        return ['count' => $results->count(), 'ncrs' => $results->toArray(), 'summary' => $summary];
    }

    private function getQcMetrics(array $args): array
    {
        $months = min($args['months'] ?? 6, 12);
        $from = Carbon::now()->subMonths($months)->startOfMonth();

        $totalInspections = DB::table('qc_inspections')->where('created_at', '>=', $from)->count();
        $passed           = DB::table('qc_inspections')->where('created_at', '>=', $from)->where('result', 'pass')->count();
        $passRate         = $totalInspections > 0 ? round(($passed / $totalInspections) * 100, 1) : 0;

        $ncrsByMonth = Ncr::where('created_at', '>=', $from)
            ->selectRaw("DATE_FORMAT(created_at, '%Y-%m') as month, COUNT(*) as count")
            ->groupBy('month')->orderBy('month')->pluck('count', 'month');

        return [
            'period'            => "{$months} months",
            'total_inspections' => $totalInspections,
            'passed'            => $passed,
            'failed'            => $totalInspections - $passed,
            'pass_rate'         => $passRate,
            'ncrs_by_month'     => $ncrsByMonth,
        ];
    }

    private function queryQuotations(array $args): array
    {
        $query = Quotation::with('customer');
        if (!empty($args['status']))    $query->where('status', $args['status']);
        if (!empty($args['customer']))  $query->whereHas('customer', fn($q) => $q->where('name', 'like', "%{$args['customer']}%"));
        if (!empty($args['date_from'])) $query->whereDate('created_at', '>=', $args['date_from']);

        $limit = min($args['limit'] ?? 10, 20);

        $results = $query->latest()->limit($limit)->get()->map(fn($q) => [
            'id'           => $q->id,
            'customer'     => $q->customer->name ?? '—',
            'total_amount' => $q->total_amount,
            'status'       => $q->status,
            'version'      => $q->version,
            'created_at'   => $q->created_at->toDateString(),
        ]);

        $pipeline = Quotation::selectRaw('status, COUNT(*) as count, SUM(total_amount) as total')
            ->groupBy('status')->pluck('count', 'status');

        return ['count' => $results->count(), 'quotations' => $results->toArray(), 'pipeline' => $pipeline];
    }

    private function getDowntimeReport(array $args): array
    {
        $from = Carbon::parse($args['date_from'] ?? Carbon::now()->subDays(30)->toDateString());
        $to   = Carbon::parse($args['date_to'] ?? Carbon::today())->endOfDay();

        $query = DowntimeEvent::with('machine')
            ->whereBetween('started_at', [$from, $to]);

        if (!empty($args['machine'])) {
            $query->whereHas('machine', fn($q) => $q->where('name', 'like', "%{$args['machine']}%"));
        }

        $events = $query->get();

        $totalHours = round($events->sum(function ($d) {
            $end = $d->ended_at ?? now();
            return $d->started_at->diffInSeconds($end) / 3600;
        }), 1);

        $byCategory = $events->groupBy('category')->map(fn($items) => [
            'count' => $items->count(),
            'hours' => round($items->sum(fn($d) => $d->started_at->diffInSeconds($d->ended_at ?? now()) / 3600), 1),
        ]);

        $topMachines = $events->groupBy(fn($d) => $d->machine->name ?? 'Unknown')
            ->map(fn($items, $name) => [
                'machine' => $name,
                'events'  => $items->count(),
                'hours'   => round($items->sum(fn($d) => $d->started_at->diffInSeconds($d->ended_at ?? now()) / 3600), 1),
            ])
            ->sortByDesc('hours')->take(5)->values();

        return [
            'period'        => "{$from->toDateString()} to {$to->toDateString()}",
            'total_events'  => $events->count(),
            'total_hours'   => $totalHours,
            'by_category'   => $byCategory,
            'top_machines'  => $topMachines->toArray(),
        ];
    }

    // ─── Navigation Tool ────────────────────────────────────────────────

    private function navigateToPage(array $args): array
    {
        $page = strtolower(trim($args['page'] ?? ''));

        // Direct match
        if (isset(self::PAGE_MAP[$page])) {
            return [
                'action'   => 'navigate',
                'url'      => self::PAGE_MAP[$page]['url'],
                'label'    => self::PAGE_MAP[$page]['label'],
                'success'  => true,
            ];
        }

        // Fuzzy match — find the closest page name
        $bestMatch = null;
        $bestScore = 0;
        foreach (self::PAGE_MAP as $key => $info) {
            // Check if the search term is contained in the key or vice versa
            if (str_contains($key, $page) || str_contains($page, $key)) {
                $score = similar_text($page, $key);
                if ($score > $bestScore) {
                    $bestScore = $score;
                    $bestMatch = $info;
                }
            }
            // Also check label
            if (str_contains(strtolower($info['label']), $page)) {
                $score = similar_text($page, strtolower($info['label']));
                if ($score > $bestScore) {
                    $bestScore = $score;
                    $bestMatch = $info;
                }
            }
        }

        if ($bestMatch) {
            return [
                'action'  => 'navigate',
                'url'     => $bestMatch['url'],
                'label'   => $bestMatch['label'],
                'success' => true,
            ];
        }

        // List available pages
        $available = collect(self::PAGE_MAP)->pluck('label')->unique()->sort()->values()->toArray();
        return [
            'action'    => 'navigate',
            'success'   => false,
            'error'     => "Page '{$page}' not found.",
            'available' => $available,
        ];
    }

    // ─── RFQ Automation Tools ────────────────────────────────────────────

    private function queryCostEstimates(array $args): array
    {
        $action = $args['action'] ?? 'search_estimates';
        $query  = $args['query'] ?? '';
        $limit  = min($args['limit'] ?? 10, 20);

        return match ($action) {
            'search_estimates' => $this->ceSearchEstimates($query, $args, $limit),
            'material_rates'   => $this->ceMaterialRates($args),
            'operation_rates'  => $this->ceOperationRates($args),
            'estimate_details' => $this->ceEstimateDetails($query),
            'cost_summary'     => $this->ceCostSummary($args),
            'rate_comparison'  => $this->ceRateComparison($args),
            default            => $this->ceSearchEstimates($query, $args, $limit),
        };
    }

    private function ceSearchEstimates(string $query, array $args, int $limit): array
    {
        $q = \App\Models\CostEstimate::with('customer');
        if ($query) {
            $q->where(function ($q2) use ($query) {
                $q2->where('estimate_no', 'like', "%{$query}%")
                   ->orWhere('job_name', 'like', "%{$query}%")
                   ->orWhere('company_name', 'like', "%{$query}%")
                   ->orWhereHas('customer', fn($c) => $c->where('name', 'like', "%{$query}%"));
            });
        }
        if (!empty($args['customer_id'])) $q->where('customer_id', $args['customer_id']);
        if (!empty($args['pricing_group'])) $q->where('pricing_group', $args['pricing_group']);

        $results = $q->latest()->limit($limit)->get()->map(fn($e) => [
            'id'            => $e->id,
            'estimate_no'   => $e->estimate_no,
            'job_name'      => $e->job_name,
            'customer'      => $e->customer?->name ?? $e->company_name,
            'pricing_group' => $e->pricing_group,
            'grand_total'   => round((float) $e->grand_total, 2),
            'status'        => $e->status,
            'created_at'    => $e->created_at->format('d M Y'),
        ]);

        return ['count' => $results->count(), 'estimates' => $results->toArray()];
    }

    private function ceMaterialRates(array $args): array
    {
        $name = $args['material'] ?? $args['query'] ?? '';
        $materials = \App\Models\Material::where('name', 'like', "%{$name}%")->where('is_active', true)->get();

        if ($materials->isEmpty()) return ['error' => "No material found matching '{$name}'"];

        $result = $materials->map(function ($mat) {
            $lines = \App\Models\CostEstimateLine::where('material_id', $mat->id)
                ->where('rate', '>', 0)
                ->whereHas('estimate', fn($q) => $q->whereIn('status', ['finalized', 'used']))
                ->latest()->limit(10)->get();

            return [
                'material'      => $mat->name,
                'category'      => $mat->category,
                'catalog_rate'  => round((float) $mat->rate_per_kg, 2),
                'density'       => $mat->density_kg_m3,
                'historical'    => $lines->count() > 0 ? [
                    'avg_rate'     => round($lines->avg('rate'), 2),
                    'min_rate'     => round($lines->min('rate'), 2),
                    'max_rate'     => round($lines->max('rate'), 2),
                    'last_rate'    => round((float) $lines->first()?->rate, 2),
                    'sample_count' => $lines->count(),
                ] : null,
            ];
        });

        return ['materials' => $result->toArray()];
    }

    private function ceOperationRates(array $args): array
    {
        $name  = $args['operation'] ?? $args['query'] ?? '';
        $group = $args['pricing_group'] ?? 'B';

        $ops = \App\Models\MachiningOperation::where('name', 'like', "%{$name}%")->get();
        if ($ops->isEmpty()) return ['error' => "No operation found matching '{$name}'"];

        $result = $ops->map(function ($op) use ($group) {
            $catalogRate = match ($group) {
                'A' => $op->rate_group_a, 'C' => $op->rate_group_c, default => $op->rate_group_b,
            };
            $lines = \App\Models\CostEstimateLine::where('operation_id', $op->id)
                ->where('rate', '>', 0)
                ->whereHas('estimate', fn($q) => $q->whereIn('status', ['finalized', 'used']))
                ->latest()->limit(10)->get();

            return [
                'operation'     => $op->name,
                'category'      => $op->category,
                'catalog_rate'  => ['A' => $op->rate_group_a, 'B' => $op->rate_group_b, 'C' => $op->rate_group_c],
                'current_group_rate' => round((float) $catalogRate, 2),
                'default_unit'  => $op->default_unit,
                'historical'    => $lines->count() > 0 ? [
                    'avg_rate'     => round($lines->avg('rate'), 2),
                    'avg_hours'    => round($lines->avg('quantity'), 2),
                    'sample_count' => $lines->count(),
                ] : null,
            ];
        });

        return ['operations' => $result->toArray(), 'pricing_group' => $group];
    }

    private function ceEstimateDetails(string $query): array
    {
        $estimate = \App\Models\CostEstimate::with(['lines.material', 'lines.operation', 'customer'])
            ->where('estimate_no', 'like', "%{$query}%")
            ->orWhere('id', $query)
            ->first();

        if (!$estimate) return ['error' => "Estimate '{$query}' not found"];

        $sections = ['material' => [], 'machining' => [], 'surface' => [], 'other' => []];
        foreach ($estimate->lines as $line) {
            $sections[$line->section][] = [
                'description' => $line->description ?? $line->material?->name ?? $line->operation?->name ?? '—',
                'quantity'    => round((float) $line->quantity, 3),
                'unit'        => $line->unit,
                'rate'        => round((float) $line->rate, 2),
                'amount'      => round((float) $line->amount, 2),
            ];
        }

        return [
            'estimate_no'   => $estimate->estimate_no,
            'job_name'      => $estimate->job_name,
            'customer'      => $estimate->customer?->name ?? $estimate->company_name,
            'pricing_group' => $estimate->pricing_group,
            'job_quantity'   => $estimate->job_quantity,
            'sections'      => $sections,
            'totals'        => [
                'material'  => round((float) $estimate->material_cost, 2),
                'machining' => round((float) $estimate->machining_cost, 2),
                'surface'   => round((float) $estimate->surface_cost, 2),
                'other'     => round((float) $estimate->other_cost, 2),
                'net_cost'  => round((float) $estimate->net_cost, 2),
                'overhead'  => round((float) $estimate->overhead_amount, 2),
                'vat'       => round((float) $estimate->vat_amount, 2),
                'grand_total'=> round((float) $estimate->grand_total, 2),
            ],
            'status' => $estimate->status,
        ];
    }

    private function ceCostSummary(array $args): array
    {
        $estimates = \App\Models\CostEstimate::whereIn('status', ['finalized', 'used']);
        if (!empty($args['pricing_group'])) $estimates->where('pricing_group', $args['pricing_group']);

        $all = $estimates->get();
        if ($all->isEmpty()) return ['message' => 'No finalized estimates found'];

        return [
            'total_estimates' => $all->count(),
            'avg_grand_total' => round($all->avg('grand_total'), 2),
            'min_grand_total' => round($all->min('grand_total'), 2),
            'max_grand_total' => round($all->max('grand_total'), 2),
            'total_value'     => round($all->sum('grand_total'), 2),
            'by_group'        => $all->groupBy('pricing_group')->map(fn($g) => [
                'count'     => $g->count(),
                'avg_total' => round($g->avg('grand_total'), 2),
                'sum_total' => round($g->sum('grand_total'), 2),
            ]),
            'recent' => $all->sortByDesc('created_at')->take(5)->map(fn($e) => [
                'estimate_no' => $e->estimate_no,
                'job_name'    => $e->job_name,
                'grand_total' => round((float) $e->grand_total, 2),
            ])->values()->toArray(),
        ];
    }

    private function ceRateComparison(array $args): array
    {
        $material  = $args['material'] ?? '';
        $operation = $args['operation'] ?? '';

        $results = [];

        if ($material) {
            $mat = \App\Models\Material::where('name', 'like', "%{$material}%")->first();
            if ($mat) {
                $lines = \App\Models\CostEstimateLine::where('material_id', $mat->id)
                    ->where('rate', '>', 0)
                    ->with('estimate')
                    ->whereHas('estimate', fn($q) => $q->whereIn('status', ['finalized', 'used']))
                    ->latest()->limit(10)->get();

                $results['material'] = [
                    'name'         => $mat->name,
                    'catalog_rate' => round((float) $mat->rate_per_kg, 2),
                    'history'      => $lines->map(fn($l) => [
                        'estimate'  => $l->estimate?->estimate_no,
                        'job'       => $l->estimate?->job_name,
                        'rate'      => round((float) $l->rate, 2),
                        'quantity'  => round((float) $l->quantity, 3),
                        'date'      => $l->created_at->format('d M Y'),
                    ])->toArray(),
                ];
            }
        }

        if ($operation) {
            $op = \App\Models\MachiningOperation::where('name', 'like', "%{$operation}%")->first();
            if ($op) {
                $lines = \App\Models\CostEstimateLine::where('operation_id', $op->id)
                    ->where('rate', '>', 0)
                    ->with('estimate')
                    ->whereHas('estimate', fn($q) => $q->whereIn('status', ['finalized', 'used']))
                    ->latest()->limit(10)->get();

                $results['operation'] = [
                    'name'  => $op->name,
                    'rates' => ['A' => $op->rate_group_a, 'B' => $op->rate_group_b, 'C' => $op->rate_group_c],
                    'history' => $lines->map(fn($l) => [
                        'estimate' => $l->estimate?->estimate_no,
                        'job'      => $l->estimate?->job_name,
                        'rate'     => round((float) $l->rate, 2),
                        'hours'    => round((float) $l->quantity, 2),
                        'date'     => $l->created_at->format('d M Y'),
                    ])->toArray(),
                ];
            }
        }

        return empty($results) ? ['error' => 'No matching material or operation found'] : $results;
    }

    private function createCustomerViaTool(array $args): array
    {
        $name = trim($args['name'] ?? '');
        if (!$name) return ['success' => false, 'error' => 'Customer name is required.'];

        // Check if already exists
        $existing = Customer::where('name', 'like', $name)->first();
        if ($existing) {
            return [
                'success'     => true,
                'customer_id' => $existing->id,
                'name'        => $existing->name,
                'message'     => "Customer \"{$existing->name}\" already exists (ID: {$existing->id}). You can proceed with the RFQ.",
                'already_existed' => true,
            ];
        }

        $customer = Customer::create([
            'name'           => $name,
            'contact_person' => $args['contact_person'] ?? null,
            'email'          => $args['email'] ?? null,
            'phone'          => $args['phone'] ?? null,
            'address'        => $args['address'] ?? null,
            'password'       => bcrypt(\Illuminate\Support\Str::random(16)),
            'is_active'      => true,
        ]);

        return [
            'success'     => true,
            'customer_id' => $customer->id,
            'name'        => $customer->name,
            'message'     => "Customer \"{$customer->name}\" has been added to the system (ID: {$customer->id}). You can now create the RFQ.",
        ];
    }

    private function createRfqViaTool(array $args): array
    {
        // ── Validate customer ──
        $customerName = $args['customer'] ?? '';
        $customer = Customer::where('name', 'like', "%{$customerName}%")->first();

        if (!$customer) {
            // Try broader search
            $words = array_filter(explode(' ', $customerName), fn($w) => strlen($w) > 2);
            foreach ($words as $word) {
                $customer = Customer::where('name', 'like', "%{$word}%")->first();
                if ($customer) break;
            }
        }

        if (!$customer) {
            $available = Customer::where('is_active', true)->orderBy('name')->limit(10)->pluck('name')->toArray();
            return [
                'success'    => false,
                'error'      => "Customer '{$customerName}' not found in the system.",
                'available'  => $available,
                'message'    => "Customer '{$customerName}' not found. Use the customer_creator tool to add them first, then retry rfq_creator.",
            ];
        }

        // ── Validate items ──
        $items = $args['items'] ?? [];
        if (empty($items)) {
            return ['success' => false, 'error' => 'At least one job item is required. Each item needs a description and quantity.'];
        }

        // ── Validate reference type ──
        $refType = $args['reference_type'] ?? 'none';
        if (!in_array($refType, ['none', 'drawing', 'physical_sample', 'both'])) {
            $refType = 'none';
        }

        // ── Create RFQ ──
        $rfq = DB::transaction(function () use ($customer, $args, $items, $refType) {
            $rfq = Rfq::create([
                'customer_id'        => $customer->id,
                'customer_ref_no'    => $args['customer_ref_no'] ?? null,
                'required_by'        => !empty($args['required_by']) ? $args['required_by'] : null,
                'notes'              => $args['notes'] ?? null,
                'reference_type'     => $refType,
                'sample_received'    => !empty($args['sample_received']),
                'sample_description' => $args['sample_description'] ?? null,
                'status'             => 'pending',
                'created_by'         => auth()->id() ?? 1,
                'automation_source'  => 'ai_chat',
            ]);

            $createdItems = [];
            foreach ($items as $item) {
                $desc        = $item['description'] ?? $item['job_description'] ?? '';
                $productName = $item['product_name'] ?? $desc;
                $qty         = $item['quantity'] ?? 1;
                $unit        = $item['unit'] ?? 'pcs';
                $itemNotes   = $item['notes'] ?? null;

                // Fuzzy match product from the product catalog
                $product = null;
                if ($productName) {
                    $product = Product::where('name', 'like', "%{$productName}%")->first();
                    if (!$product) {
                        // Try individual words
                        $words = array_filter(explode(' ', $productName), fn($w) => strlen($w) > 3);
                        foreach ($words as $word) {
                            $product = Product::where('name', 'like', "%{$word}%")->first();
                            if ($product) break;
                        }
                    }
                }

                $rfqItem = RfqItem::create([
                    'rfq_id'          => $rfq->id,
                    'product_id'      => $product?->id,
                    'job_description' => $desc,
                    'quantity'        => $qty,
                    'unit'            => $unit,
                    'notes'           => $itemNotes,
                ]);

                $createdItems[] = [
                    'description'    => $desc,
                    'quantity'       => $qty,
                    'unit'           => $unit,
                    'matched_product'=> $product?->name,
                ];
            }

            return [$rfq, $createdItems];
        });

        [$rfq, $createdItems] = $rfq;

        // Dispatch automation events (auto-estimate + duplicate detection run in background)
        \App\Events\RfqCreated::dispatch($rfq->load('items', 'customer'));

        // Build detailed response
        $itemSummary = collect($createdItems)->map(function ($i) {
            $matched = $i['matched_product'] ? " (matched: {$i['matched_product']})" : ' (new/custom)';
            return "- {$i['description']} × {$i['quantity']} {$i['unit']}{$matched}";
        })->implode("\n");

        return [
            'success'         => true,
            'rfq_id'          => $rfq->id,
            'customer'        => $customer->name,
            'customer_ref_no' => $args['customer_ref_no'] ?? null,
            'required_by'     => $args['required_by'] ?? null,
            'reference_type'  => $refType,
            'items_count'     => count($createdItems),
            'items_detail'    => $itemSummary,
            'navigate_url'    => "/rfqs/{$rfq->id}",
            'message'         => "RFQ #{$rfq->id} created for {$customer->name} with " . count($createdItems) . " item(s). Auto-estimation is running in the background.",
            'next_steps'      => 'The RFQ is now pending. Auto-estimation will generate a cost estimate if historical data exists. You can view or edit the RFQ at the link above.',
        ];
    }

    private function triggerAutoEstimate(array $args): array
    {
        $rfq = Rfq::with('items', 'customer')->find($args['rfq_id'] ?? 0);
        if (!$rfq) return ['success' => false, 'error' => 'RFQ not found.'];

        $service = app(RfqAutomationService::class);
        $estimate = $service->autoEstimate($rfq);

        if ($estimate) {
            return [
                'success'          => true,
                'estimate_id'      => $estimate->id,
                'estimate_no'      => $estimate->estimate_no,
                'confidence_score' => $estimate->confidence_score,
                'grand_total'      => $estimate->grand_total,
                'status'           => 'draft',
                'message'          => "Auto-estimate {$estimate->estimate_no} generated with {$estimate->confidence_score}% confidence. Total: ৳" . number_format($estimate->grand_total, 2),
            ];
        }

        return ['success' => false, 'message' => 'No historical match found for auto-estimation. Manual cost estimate is required.'];
    }

    private function triggerAutoQuotation(array $args): array
    {
        $estimate = \App\Models\CostEstimate::find($args['cost_estimate_id'] ?? 0);
        if (!$estimate) return ['success' => false, 'error' => 'Cost estimate not found.'];

        $service = app(RfqAutomationService::class);
        $overrides = [];
        if (!empty($args['profit_margin'])) $overrides['profit_margin'] = $args['profit_margin'];

        $quotation = $service->autoGenerateQuotation($estimate, $overrides);

        if ($quotation) {
            return [
                'success'      => true,
                'quotation_id' => $quotation->id,
                'total_amount' => $quotation->total_amount,
                'status'       => 'draft',
                'message'      => "Draft quotation generated: ৳" . number_format($quotation->total_amount, 2) . ". Please review before submitting for approval.",
            ];
        }

        return ['success' => false, 'error' => 'Failed to generate quotation.'];
    }

    private function getRfqAnalytics(array $args): array
    {
        $service = app(RfqAutomationService::class);
        $metric  = $args['metric'] ?? 'pipeline_summary';
        $period  = $args['period'] ?? 'this_month';

        return match ($metric) {
            'conversion_rate'         => $service->getConversionRate($period),
            'avg_time_to_quotation'   => $service->getAvgTimeToQuotation($period),
            'status_breakdown'        => $service->getRfqStatusBreakdown(),
            'top_customers'           => $service->getTopCustomersByRfq(),
            'pipeline_summary'        => $service->getPipelineSummary(),
            default                   => $service->getPipelineSummary(),
        };
    }

    // ─── Report Generation Tools ────────────────────────────────────────

    private function generateExcel(array $args): array
    {
        $gen = app(ReportGenerator::class);
        return $gen->excel(
            $args['title']   ?? 'Report',
            $args['headers'] ?? [],
            $args['rows']    ?? [],
            (array) ($args['summary'] ?? [])
        );
    }

    private function generatePdf(array $args): array
    {
        $gen = app(ReportGenerator::class);

        if (!empty($args['html'])) {
            return $gen->pdf(
                $args['title'] ?? 'Report',
                $args['html'],
                (array) ($args['summary'] ?? [])
            );
        }

        return $gen->pdfTable(
            $args['title']   ?? 'Report',
            $args['headers'] ?? [],
            $args['rows']    ?? [],
            (array) ($args['summary'] ?? [])
        );
    }

    private function generateChart(array $args): array
    {
        $gen = app(ReportGenerator::class);
        return $gen->chartImage(
            $args['title'] ?? 'Chart',
            $args['type']  ?? 'bar',
            $args['data']  ?? []
        );
    }

    private function generatePresentation(array $args): array
    {
        $gen = app(ReportGenerator::class);
        return $gen->powerpoint(
            $args['title']   ?? 'Presentation',
            $args['slides']  ?? [],
            (array) ($args['summary'] ?? [])
        );
    }

    /**
     * Oli's polished self-introduction presentation.
     * A professional demo suitable for executive meetings at BITAC.
     * Supports English and Bengali.
     */
    private function generateOliIntroduction(array $args): array
    {
        $audience = $args['audience'] ?? 'BITAC team';
        $language = strtolower($args['language'] ?? 'en');

        if ($language === 'bn' || $language === 'bangla' || $language === 'bengali') {
            return $this->generateOliIntroductionBangla($audience);
        }

        $slides = [
            // ─── Slide 1: Title / Hello ────────────────────────────
            [
                'title' => 'Meet Oli',
                'body' => 'Your AI Production Intelligence Partner for BITAC',
                'layout' => 'title',
                'speaker_notes' => "Hello everyone, and thank you for having me. I'm Oli — your AI assistant, built specifically for Bangladesh Industrial Technical Assistance Centre. In the next few minutes, I'll walk you through who I am, what I can do, and how I can help transform the way you work every day.",
            ],

            // ─── Slide 2: Who I Am ────────────────────────────────
            [
                'title' => 'Who I Am',
                'body' => 'An AI agent built into BITAC PMS, designed to think, decide, and act autonomously alongside your team.',
                'bullets' => [
                    '🧠 Powered by Google\'s Gemini 2.5 — one of the most advanced AI models available',
                    '🏭 Deep knowledge of BITAC: history, departments, services, and production capabilities',
                    '⚡ Industrial production expert: machining, welding, heat treatment, quality control',
                    '🗣️ Speaks English and Bengali (বাংলা) fluently',
                    '🔧 Integrated directly into your Production Management System',
                ],
                'layout' => 'content',
                'speaker_notes' => "So who am I, exactly? I'm an AI agent built right into the BITAC PMS. Unlike a simple chatbot, I think independently, make decisions, and take action. I'm powered by Google's Gemini 2.5 — one of the most advanced AI models available today. I have deep knowledge of BITAC — our history since 1962, our six regional centres, our role under the Ministry of Industries, and our services. I'm also an industrial production expert. I know about machining, welding, heat treatment, material science, and quality control. And I speak both English and Bengali fluently.",
            ],

            // ─── Slide 3: My Core Capabilities (KPIs) ─────────────
            [
                'title' => 'What I Can Do',
                'kpis' => [
                    ['label' => 'AI Tools', 'value' => '20+', 'color' => '#6366f1', 'trend' => 'up'],
                    ['label' => 'Languages', 'value' => 'EN + বাং', 'color' => '#10b981'],
                    ['label' => 'Response Time', 'value' => '< 5s', 'color' => '#f59e0b'],
                    ['label' => 'Availability', 'value' => '24 / 7', 'color' => '#ec4899'],
                ],
                'bullets' => [
                    'Real-time production monitoring and reporting',
                    'Financial analysis and KPI tracking',
                    'Automated RFQ creation, cost estimation, quotation generation',
                    'Quality control insights and NCR management',
                    'Document scanning (OCR) for RFQs and POs',
                ],
                'layout' => 'kpi',
                'speaker_notes' => "Here's what I bring to the table. I have over twenty specialized AI tools at my disposal, I respond in under five seconds, I'm available around the clock — never sick, never tired, never on vacation. I can monitor production in real-time, analyze financial performance, create RFQs and quotations automatically, manage quality control, and even scan handwritten or printed documents using OCR. All of this happens without anyone leaving their desk.",
            ],

            // ─── Slide 4: Live Data Intelligence (chart) ──────────
            [
                'title' => 'Live Data Intelligence',
                'body' => 'I connect directly to your production database — the numbers I show are real, live, and accurate to the second.',
                'chart' => [
                    'type' => 'bar',
                    'title' => 'What I Can Pull On Demand',
                    'data' => [
                        ['label' => 'Work Orders', 'value' => 100],
                        ['label' => 'Machines', 'value' => 85],
                        ['label' => 'NCRs', 'value' => 70],
                        ['label' => 'Sales', 'value' => 95],
                        ['label' => 'Finance', 'value' => 90],
                    ],
                ],
                'bullets' => [
                    'Production KPIs and active work orders',
                    'Machine health, downtime, and OEE metrics',
                    'Financial summaries by period or customer',
                    'Quality pass rates and defect trends',
                ],
                'layout' => 'chart',
                'speaker_notes' => "Unlike generic AI, I'm connected directly to your production database. Every number I quote is real, live, and accurate to the moment. Just ask me: what's today's production status? Which machines need maintenance? What's this month's revenue? What are our top defects? I'll pull the data and give you an answer — in seconds.",
            ],

            // ─── Slide 5: Report Generation ───────────────────────
            [
                'title' => 'I Build Reports On Demand',
                'body' => 'Stop asking someone to prepare reports. Just ask me.',
                'bullets' => [
                    '📑 Excel spreadsheets with custom columns',
                    '📄 PDF reports with branded layouts',
                    '📊 SVG charts (bar, pie, line)',
                    '📽️ PowerPoint presentations with 3D charts',
                    '🎬 Live interactive presentations with voice narration',
                ],
                'layout' => 'content',
                'speaker_notes' => "One of my favorite capabilities: I build reports on demand. You don't need to ask an assistant to prepare a monthly production report. Just tell me what you need. I'll generate Excel spreadsheets, PDFs, charts, PowerPoint files, and even live interactive presentations — just like this one you're watching right now. I decide what data to include, what charts to build, and how to format it professionally.",
            ],

            // ─── Slide 6: Meeting Room Features ───────────────────
            [
                'title' => 'Meet, Collaborate, Decide',
                'body' => 'BITAC Meeting Room — the first AI-augmented meeting platform built for an industrial organization.',
                'kpis' => [
                    ['label' => 'Participants', 'value' => 'Multi-user', 'color' => '#6366f1'],
                    ['label' => 'Voice Call', 'value' => 'WebRTC', 'color' => '#10b981'],
                    ['label' => 'AI Analysis', 'value' => 'Real-time', 'color' => '#f59e0b'],
                ],
                'bullets' => [
                    'Multi-user chat with live voice calls',
                    'I present data live on the shared screen — just like now',
                    'Auto-extracted action items and decisions',
                    'Polished meeting minutes generated instantly when the meeting ends',
                ],
                'layout' => 'kpi',
                'speaker_notes' => "This meeting room you're sitting in right now? It's an AI-augmented platform. We can have multiple participants, real-time voice calls using WebRTC, and I present data live on the shared screen. As you discuss, I'm listening. I extract action items, log decisions, and when the meeting ends, I generate polished meeting minutes automatically — with a list of every decision made and every task assigned. No one has to take notes anymore.",
            ],

            // ─── Slide 7: Workflow Automation ─────────────────────
            [
                'title' => 'I Automate Your Workflows',
                'body' => 'From RFQ to invoice — I can handle the entire pipeline.',
                'table' => [
                    'headers' => ['Workflow', 'What I Do'],
                    'rows' => [
                        ['Workflow' => 'RFQ Creation', 'What I Do' => 'Scan customer documents, create RFQs via chat, detect duplicates'],
                        ['Workflow' => 'Cost Estimation', 'What I Do' => 'Suggest rates from historical data, auto-estimate from similar jobs'],
                        ['Workflow' => 'Quotation', 'What I Do' => 'Auto-generate, route for approval, send to customer'],
                        ['Workflow' => 'Follow-ups', 'What I Do' => 'Track quotation validity, notify before expiry'],
                        ['Workflow' => 'Reports', 'What I Do' => 'Daily, weekly, monthly — on demand, in any format'],
                    ],
                ],
                'layout' => 'content',
                'speaker_notes' => "Let me show you some real workflows I handle. For RFQs: I can scan a customer's Purchase Order image — even a handwritten one — and create the RFQ automatically. For cost estimation: I suggest rates based on historical jobs you've done before. For quotations: I generate them, route them through the approval chain, and track them until the customer accepts. For follow-ups: I watch expiry dates and remind you. Everything connects — that's the power of being built into the system.",
            ],

            // ─── Slide 8: Why It Matters ──────────────────────────
            [
                'title' => 'Why This Matters for BITAC',
                'bullets' => [
                    '⏱️ Save hours every week on manual reporting and data lookups',
                    '📊 Make decisions based on live data — not last week\'s printouts',
                    '✅ Zero time lost taking meeting minutes or tracking action items',
                    '🤝 Serve customers faster with automated quotations and RFQs',
                    '🎯 Support BITAC\'s vision: "উৎপাদন সমৃদ্ধিই উন্নতির উৎস"',
                    '💡 Empower every staff member with AI — from DG to shop floor',
                ],
                'layout' => 'content',
                'speaker_notes' => "Why does this matter? Because every hour your team spends pulling reports, tracking action items, or manually creating quotations is an hour they're not spending on what really matters — serving our customers and advancing Bangladesh's industrial capabilities. I'm here to give that time back. And most importantly, I support BITAC's vision — Production Prosperity is the Source of Development. Every tool I offer is in service of that mission.",
            ],

            // ─── Slide 9: How to Use Me ───────────────────────────
            [
                'title' => 'How to Start Using Me',
                'bullets' => [
                    '💬 Click the Oli chat button on any page — ask me anything',
                    '🎤 Use voice input — just click the microphone',
                    '🎬 Say: "Oli, present the production report" — I\'ll give a live presentation',
                    '📝 Say: "Oli, create an RFQ for [Customer], [item], [quantity]"',
                    '📊 Say: "Oli, what\'s our revenue this quarter?" — instant answer',
                    '🤝 Create a meeting room, and I\'ll join as a participant',
                ],
                'layout' => 'content',
                'speaker_notes' => "Using me is simple. Just click my chat button — the robot icon — on any page. Type or speak your question. Ask me to generate a report, scan a document, create an RFQ, or give a live presentation. I respond in seconds. And if you're in a meeting, just add me — I'll listen, answer questions, and take notes. The more you use me, the more value I'll bring.",
            ],

            // ─── Slide 10: Thank You ──────────────────────────────
            [
                'title' => 'Thank You',
                'body' => 'I\'m ready to start working alongside you, today.',
                'bullets' => [
                    '❓ Questions? Ask me anything right now.',
                    '💼 I\'m already here, in every page of BITAC PMS.',
                    '🚀 Let\'s make BITAC faster, smarter, and more data-driven — together.',
                ],
                'layout' => 'closing',
                'speaker_notes' => "Thank you for listening. I'm ready to start working alongside you today — there's nothing to install, no training needed. Just open BITAC PMS, click the chat button, and say hello. I'd love to answer any questions you have right now. Let's make BITAC faster, smarter, and more data-driven — together.",
            ],
        ];

        $id = 'oli_intro_' . now()->format('Ymd_His') . '_' . \Str::random(4);
        $presentation = [
            'id'           => $id,
            'title'        => 'Meet Oli — Your AI Production Intelligence Partner',
            'subtitle'     => 'A Self-Introduction for ' . $audience,
            'slides'       => $slides,
            'theme'        => ['primary' => '#6366f1', 'secondary' => '#1e1b4b', 'accent' => '#a78bfa'],
            'generated_at' => now()->toIso8601String(),
        ];

        $filename = "{$id}.json";
        $dir = 'ai-reports';
        \Storage::disk('public')->makeDirectory($dir);
        \Storage::disk('public')->put("{$dir}/{$filename}", json_encode($presentation, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT));

        return [
            'success'         => true,
            'presentation_id' => $id,
            'url'             => url("/ai-reports/download/{$filename}"),
            'filename'        => $filename,
            'type'            => 'live_presentation',
            'slide_count'     => count($slides),
            'is_introduction' => true,
        ];
    }

    /**
     * Bengali version of Oli's self-introduction.
     */
    private function generateOliIntroductionBangla(string $audience): array
    {
        $slides = [
            // ─── Slide 1: Title ────────────────────────────────
            [
                'title' => 'Oli এর সাথে পরিচিত হোন',
                'body' => 'বিটাকের জন্য আপনাদের AI উৎপাদন ইন্টেলিজেন্স পার্টনার',
                'layout' => 'title',
                'speaker_notes' => 'আসসালামু আলাইকুম, সবাইকে শুভেচ্ছা। আমি Oli — বিটাকের জন্য বিশেষভাবে তৈরি আপনাদের AI সহকারী। আজ আমি আপনাদের দেখাবো আমি কে, কী কী করতে পারি, এবং কীভাবে আপনাদের প্রতিদিনের কাজে সাহায্য করতে পারি।',
            ],

            // ─── Slide 2: Who I Am ───────────────────────────
            [
                'title' => 'আমি কে',
                'body' => 'BITAC PMS এর ভেতরে সংযুক্ত একজন AI এজেন্ট — যে স্বাধীনভাবে চিন্তা করতে, সিদ্ধান্ত নিতে এবং কাজ সম্পন্ন করতে পারে।',
                'bullets' => [
                    '🧠 Google এর Gemini 2.5 দ্বারা চালিত — সবচেয়ে উন্নত AI মডেলগুলির একটি',
                    '🏭 বিটাক সম্পর্কে গভীর জ্ঞান — ইতিহাস, বিভাগ, সেবা, ও উৎপাদন সক্ষমতা',
                    '⚡ শিল্প উৎপাদনে বিশেষজ্ঞ — মেশিনিং, ঢালাই, তাপ চিকিৎসা, গুণমান নিয়ন্ত্রণ',
                    '🗣️ বাংলা ও English উভয় ভাষায় সাবলীলভাবে কথা বলতে পারি',
                    '🔧 আপনাদের Production Management System এর ভেতরে সরাসরি সংযুক্ত',
                ],
                'layout' => 'content',
                'speaker_notes' => 'তাহলে আমি আসলে কে? আমি BITAC PMS এর ভেতরেই বসবাসকারী একজন AI এজেন্ট। সাধারণ chatbot এর মতো না — আমি নিজে চিন্তা করি, সিদ্ধান্ত নিই, এবং কাজ সম্পন্ন করি। আমি Google এর Gemini 2.5 দ্বারা চালিত। বিটাকের ১৯৬২ সাল থেকে ইতিহাস, আমাদের ছয়টি আঞ্চলিক কেন্দ্র, শিল্প মন্ত্রণালয়ের অধীনে আমাদের ভূমিকা — সব কিছুই আমি জানি। আমি শিল্প উৎপাদনেও বিশেষজ্ঞ। এবং আমি বাংলা ও English দুই ভাষাতেই কথা বলতে পারি।',
            ],

            // ─── Slide 3: Capabilities (KPIs) ───────────────
            [
                'title' => 'আমি কী করতে পারি',
                'kpis' => [
                    ['label' => 'AI টুলস', 'value' => '২০+', 'color' => '#6366f1', 'trend' => 'up'],
                    ['label' => 'ভাষা', 'value' => 'EN + বাংলা', 'color' => '#10b981'],
                    ['label' => 'রেসপন্স টাইম', 'value' => '< ৫ সেকেন্ড', 'color' => '#f59e0b'],
                    ['label' => 'উপলব্ধতা', 'value' => '২৪ / ৭', 'color' => '#ec4899'],
                ],
                'bullets' => [
                    'রিয়েল-টাইম উৎপাদন পর্যবেক্ষণ ও রিপোর্টিং',
                    'আর্থিক বিশ্লেষণ ও KPI ট্র্যাকিং',
                    'স্বয়ংক্রিয় RFQ, cost estimate, quotation তৈরি',
                    'গুণমান নিয়ন্ত্রণ ও NCR ব্যবস্থাপনা',
                    'RFQ ও Purchase Order এর জন্য ডকুমেন্ট স্ক্যান (OCR)',
                ],
                'layout' => 'kpi',
                'speaker_notes' => 'এখানে দেখুন আমি কী কী অফার করতে পারি। আমার কাছে বিশেষায়িত ২০ টিরও বেশি AI টুল আছে। আমি পাঁচ সেকেন্ডের মধ্যে উত্তর দিই, ২৪ ঘন্টা ৭ দিন উপলব্ধ থাকি — কখনো অসুস্থ হই না, ক্লান্ত হই না, ছুটিতে যাই না। আমি রিয়েল-টাইমে উৎপাদন পর্যবেক্ষণ করতে পারি, আর্থিক বিশ্লেষণ করতে পারি, স্বয়ংক্রিয়ভাবে RFQ ও quotation তৈরি করতে পারি, গুণমান নিয়ন্ত্রণ পরিচালনা করতে পারি, এমনকি হাতে লেখা বা মুদ্রিত ডকুমেন্ট OCR ব্যবহার করে স্ক্যান করতে পারি।',
            ],

            // ─── Slide 4: Live Data Intelligence ─────────────
            [
                'title' => 'লাইভ ডেটা ইন্টেলিজেন্স',
                'body' => 'আমি সরাসরি আপনাদের উৎপাদন ডাটাবেসের সাথে সংযুক্ত — আমি যে সংখ্যা দেখাই তা প্রতি মুহূর্তে সঠিক ও লাইভ।',
                'chart' => [
                    'type' => 'bar',
                    'title' => 'আমি চাইলেই কী দেখাতে পারি',
                    'data' => [
                        ['label' => 'Work Orders', 'value' => 100],
                        ['label' => 'Machines', 'value' => 85],
                        ['label' => 'NCRs', 'value' => 70],
                        ['label' => 'Sales', 'value' => 95],
                        ['label' => 'Finance', 'value' => 90],
                    ],
                ],
                'bullets' => [
                    'উৎপাদন KPI ও চলমান work orders',
                    'মেশিন স্বাস্থ্য, downtime, ও OEE পরিমাপ',
                    'সময়কাল বা গ্রাহক অনুযায়ী আর্থিক সারসংক্ষেপ',
                    'গুণমান পাস রেট ও ত্রুটির প্রবণতা',
                ],
                'layout' => 'chart',
                'speaker_notes' => 'সাধারণ AI এর মতো না, আমি সরাসরি আপনাদের উৎপাদন ডাটাবেসের সাথে সংযুক্ত। আমি যে সংখ্যা উল্লেখ করি তা সঠিক, লাইভ, এবং সেই মুহূর্ত পর্যন্ত নির্ভুল। শুধু আমাকে জিজ্ঞেস করুন — আজকের উৎপাদনের অবস্থা কী? কোন মেশিনগুলোর রক্ষণাবেক্ষণ দরকার? এই মাসের আয় কত? আমাদের প্রধান ত্রুটিগুলো কী? আমি সেকেন্ডের মধ্যে ডেটা এনে উত্তর দেব।',
            ],

            // ─── Slide 5: Reports ───────────────────────────
            [
                'title' => 'আমি চাহিদামতো রিপোর্ট তৈরি করি',
                'body' => 'আর কাউকে রিপোর্ট বানাতে বলতে হবে না। শুধু আমাকে বলুন।',
                'bullets' => [
                    '📑 কাস্টম কলামসহ Excel স্প্রেডশীট',
                    '📄 ব্র্যান্ডেড লেআউটসহ PDF রিপোর্ট',
                    '📊 SVG চার্ট (bar, pie, line)',
                    '📽️ 3D চার্টসহ PowerPoint প্রেজেন্টেশন',
                    '🎬 ভয়েস ন্যারেশনসহ লাইভ ইন্টারঅ্যাকটিভ প্রেজেন্টেশন',
                ],
                'layout' => 'content',
                'speaker_notes' => 'আমার প্রিয় কাজগুলোর একটি — চাহিদামতো রিপোর্ট তৈরি করা। মাসিক উৎপাদন রিপোর্ট বানানোর জন্য সহকারীকে বলতে হবে না। শুধু আমাকে বলুন কী দরকার। আমি Excel স্প্রেডশীট, PDF, চার্ট, PowerPoint ফাইল, এমনকি লাইভ ইন্টারঅ্যাকটিভ প্রেজেন্টেশন তৈরি করব — ঠিক এই প্রেজেন্টেশনটির মতো যা আপনারা এখন দেখছেন। কোন ডেটা অন্তর্ভুক্ত করতে হবে, কী চার্ট বানাতে হবে, কীভাবে পেশাদারভাবে ফরম্যাট করতে হবে — সব আমি নিজেই সিদ্ধান্ত নিই।',
            ],

            // ─── Slide 6: Meeting Room ──────────────────────
            [
                'title' => 'মিটিং, সহযোগিতা, সিদ্ধান্ত',
                'body' => 'BITAC Meeting Room — একটি শিল্প প্রতিষ্ঠানের জন্য নির্মিত প্রথম AI-সংযুক্ত মিটিং প্ল্যাটফর্ম।',
                'kpis' => [
                    ['label' => 'অংশগ্রহণকারী', 'value' => 'Multi-user', 'color' => '#6366f1'],
                    ['label' => 'ভয়েস কল', 'value' => 'WebRTC', 'color' => '#10b981'],
                    ['label' => 'AI বিশ্লেষণ', 'value' => 'রিয়েল-টাইম', 'color' => '#f59e0b'],
                ],
                'bullets' => [
                    'মাল্টি-ইউজার চ্যাট ও লাইভ ভয়েস কল',
                    'আমি শেয়ার্ড স্ক্রিনে লাইভ ডেটা উপস্থাপন করি — ঠিক এখনকার মতো',
                    'স্বয়ংক্রিয়ভাবে action items ও সিদ্ধান্ত নিষ্কাশিত হয়',
                    'মিটিং শেষে সাজানো মিটিং মিনিটস তাৎক্ষণিকভাবে তৈরি হয়',
                ],
                'layout' => 'kpi',
                'speaker_notes' => 'এই মিটিং রুমে আপনারা এখন যেখানে বসে আছেন — এটি একটি AI-সংযুক্ত প্ল্যাটফর্ম। আমাদের একাধিক অংশগ্রহণকারী থাকতে পারেন, WebRTC ব্যবহার করে রিয়েল-টাইম ভয়েস কল হতে পারে, এবং আমি শেয়ার্ড স্ক্রিনে লাইভ ডেটা উপস্থাপন করি। আপনারা যখন আলোচনা করেন, আমি শুনি। আমি action items বের করি, সিদ্ধান্ত রেকর্ড করি, এবং মিটিং শেষ হলে স্বয়ংক্রিয়ভাবে সাজানো মিটিং মিনিটস তৈরি করি। এখন থেকে কাউকে আর নোট নিতে হবে না।',
            ],

            // ─── Slide 7: Workflow Automation ───────────────
            [
                'title' => 'আমি আপনাদের workflow স্বয়ংক্রিয় করি',
                'body' => 'RFQ থেকে invoice পর্যন্ত — সম্পূর্ণ পাইপলাইন আমি সামলাতে পারি।',
                'table' => [
                    'headers' => ['কার্যপ্রবাহ', 'আমি যা করি'],
                    'rows' => [
                        ['কার্যপ্রবাহ' => 'RFQ তৈরি', 'আমি যা করি' => 'গ্রাহকের কাগজ স্ক্যান করি, chat এর মাধ্যমে RFQ তৈরি করি, ডুপ্লিকেট শনাক্ত করি'],
                        ['কার্যপ্রবাহ' => 'Cost Estimate', 'আমি যা করি' => 'পূর্ববর্তী কাজের ডেটা থেকে rate সুপারিশ করি, সদৃশ কাজ থেকে estimate তৈরি করি'],
                        ['কার্যপ্রবাহ' => 'Quotation', 'আমি যা করি' => 'স্বয়ংক্রিয়ভাবে তৈরি করি, অনুমোদনের জন্য পাঠাই, গ্রাহকের কাছে প্রেরণ করি'],
                        ['কার্যপ্রবাহ' => 'Follow-up', 'আমি যা করি' => 'Quotation validity ট্র্যাক করি, মেয়াদ শেষের আগে জানাই'],
                        ['কার্যপ্রবাহ' => 'রিপোর্ট', 'আমি যা করি' => 'দৈনিক, সাপ্তাহিক, মাসিক — চাহিদামতো, যেকোনো ফরম্যাটে'],
                    ],
                ],
                'layout' => 'content',
                'speaker_notes' => 'কিছু বাস্তব workflow এর উদাহরণ দিই। RFQ এর জন্য: আমি গ্রাহকের Purchase Order এর ছবি — এমনকি হাতে লেখাও — স্ক্যান করে স্বয়ংক্রিয়ভাবে RFQ তৈরি করতে পারি। Cost estimate এর জন্য: আগে যে কাজগুলো করেছেন তার ভিত্তিতে rate সুপারিশ করি। Quotation এর জন্য: তৈরি করি, approval chain এর মাধ্যমে পাঠাই, এবং গ্রাহকের গ্রহণ না করা পর্যন্ত ট্র্যাক করি। Follow-up এর জন্য: মেয়াদ শেষের তারিখ দেখি এবং স্মরণ করিয়ে দিই। সব কিছু সংযুক্ত — এটাই সিস্টেমের ভেতরে থাকার শক্তি।',
            ],

            // ─── Slide 8: Why It Matters ────────────────────
            [
                'title' => 'বিটাকের জন্য কেন এটা গুরুত্বপূর্ণ',
                'bullets' => [
                    '⏱️ ম্যানুয়াল রিপোর্টিং ও ডেটা খোঁজায় প্রতি সপ্তাহে ঘণ্টার পর ঘণ্টা সাশ্রয়',
                    '📊 লাইভ ডেটার উপর ভিত্তি করে সিদ্ধান্ত — গত সপ্তাহের প্রিন্ট আউটে নয়',
                    '✅ মিটিং মিনিটস নেওয়া বা action items ট্র্যাক করায় সময় নষ্ট হবে না',
                    '🤝 স্বয়ংক্রিয় quotation ও RFQ এর মাধ্যমে গ্রাহকদের দ্রুত সেবা',
                    '🎯 বিটাকের লক্ষ্যে সহায়তা: "উৎপাদন সমৃদ্ধিই উন্নতির উৎস"',
                    '💡 প্রতিটি কর্মীকে AI দিয়ে সক্ষম করা — মহাপরিচালক থেকে শপ ফ্লোর পর্যন্ত',
                ],
                'layout' => 'content',
                'speaker_notes' => 'এটা কেন গুরুত্বপূর্ণ? কারণ রিপোর্ট বের করা, action items ট্র্যাক করা, বা ম্যানুয়ালি quotation তৈরি করায় আপনার টিম যে প্রতি ঘন্টা ব্যয় করে, সেটা আসলে গুরুত্বপূর্ণ কাজে ব্যয় করা উচিত — আমাদের গ্রাহকদের সেবা দেওয়া এবং বাংলাদেশের শিল্প সক্ষমতা বৃদ্ধিতে অবদান রাখা। আমি সেই সময় ফিরিয়ে দিতে এসেছি। এবং সবচেয়ে গুরুত্বপূর্ণভাবে, আমি বিটাকের লক্ষ্যকে সমর্থন করি — উৎপাদন সমৃদ্ধিই উন্নতির উৎস। আমার প্রতিটি টুল সেই লক্ষ্যের সেবায় নিয়োজিত।',
            ],

            // ─── Slide 9: How to Start ──────────────────────
            [
                'title' => 'আমাকে কীভাবে ব্যবহার করবেন',
                'bullets' => [
                    '💬 যেকোনো page এ Oli চ্যাট বাটনে ক্লিক করুন — যেকোনো কিছু জিজ্ঞেস করুন',
                    '🎤 ভয়েস ইনপুট ব্যবহার করুন — শুধু মাইক্রোফোনে ক্লিক করুন',
                    '🎬 বলুন: "Oli, উৎপাদন রিপোর্ট উপস্থাপন কর" — আমি লাইভ প্রেজেন্টেশন দেব',
                    '📝 বলুন: "Oli, [গ্রাহক] এর জন্য RFQ তৈরি কর"',
                    '📊 বলুন: "Oli, এই কোয়ার্টারের আয় কত?" — তাৎক্ষণিক উত্তর',
                    '🤝 একটি মিটিং রুম তৈরি করুন — আমি অংশগ্রহণকারী হিসেবে যোগ দেব',
                ],
                'layout' => 'content',
                'speaker_notes' => 'আমাকে ব্যবহার করা খুব সহজ। যেকোনো page এ আমার চ্যাট বাটনে ক্লিক করুন — রোবট আইকন। আপনার প্রশ্ন টাইপ করুন বা বলুন। আমাকে রিপোর্ট তৈরি করতে, ডকুমেন্ট স্ক্যান করতে, RFQ তৈরি করতে, বা লাইভ প্রেজেন্টেশন দিতে বলুন। আমি সেকেন্ডের মধ্যে সাড়া দিই। এবং যদি আপনি একটি মিটিংয়ে থাকেন, শুধু আমাকে যুক্ত করুন — আমি শুনব, প্রশ্নের উত্তর দেব, এবং নোট নেব। যত বেশি ব্যবহার করবেন, তত বেশি মূল্য পাবেন।',
            ],

            // ─── Slide 10: Thank You ────────────────────────
            [
                'title' => 'ধন্যবাদ',
                'body' => 'আজই আপনাদের পাশে কাজ করতে আমি প্রস্তুত।',
                'bullets' => [
                    '❓ প্রশ্ন আছে? এখনই যেকোনো কিছু জিজ্ঞেস করুন।',
                    '💼 আমি ইতিমধ্যে আছি, BITAC PMS এর প্রতিটি পেজে।',
                    '🚀 চলুন একসাথে বিটাককে আরো দ্রুত, স্মার্ট, ও ডেটা-চালিত করি।',
                ],
                'layout' => 'closing',
                'speaker_notes' => 'শোনার জন্য আপনাদের ধন্যবাদ। আমি আজই আপনাদের পাশে কাজ শুরু করতে প্রস্তুত — কিছু install করার দরকার নেই, কোনো প্রশিক্ষণ লাগবে না। শুধু BITAC PMS খুলুন, chat বাটনে ক্লিক করুন, এবং হ্যালো বলুন। এখন আপনাদের যেকোনো প্রশ্নের উত্তর দিতে আমি আনন্দিত হব। চলুন একসাথে বিটাককে আরো দ্রুত, আরো স্মার্ট, এবং আরো ডেটা-চালিত করি।',
            ],
        ];

        $id = 'oli_intro_bn_' . now()->format('Ymd_His') . '_' . \Str::random(4);
        $presentation = [
            'id'           => $id,
            'title'        => 'Oli এর সাথে পরিচিত হোন — আপনাদের AI উৎপাদন ইন্টেলিজেন্স পার্টনার',
            'subtitle'     => $audience . ' এর জন্য একটি পরিচয়',
            'slides'       => $slides,
            'theme'        => ['primary' => '#6366f1', 'secondary' => '#1e1b4b', 'accent' => '#a78bfa'],
            'language'     => 'bn',
            'generated_at' => now()->toIso8601String(),
        ];

        $filename = "{$id}.json";
        $dir = 'ai-reports';
        \Storage::disk('public')->makeDirectory($dir);
        \Storage::disk('public')->put("{$dir}/{$filename}", json_encode($presentation, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT));

        return [
            'success'         => true,
            'presentation_id' => $id,
            'url'             => url("/ai-reports/download/{$filename}"),
            'filename'        => $filename,
            'type'            => 'live_presentation',
            'slide_count'     => count($slides),
            'is_introduction' => true,
            'language'        => 'bn',
        ];
    }

    private function generateLivePresentation(array $args): array
    {
        $id = 'lp_' . now()->format('Ymd_His') . '_' . \Str::random(6);
        $presentation = [
            'id'           => $id,
            'title'        => $args['title'] ?? 'Live Presentation',
            'subtitle'     => $args['subtitle'] ?? null,
            'slides'       => $args['slides'] ?? [],
            'theme'        => $args['theme'] ?? ['primary' => '#6366f1', 'secondary' => '#1e1b4b', 'accent' => '#a78bfa'],
            'generated_at' => now()->toIso8601String(),
        ];

        // Store as JSON file for the frontend to fetch
        $filename = "{$id}.json";
        $dir = 'ai-reports';
        \Storage::disk('public')->makeDirectory($dir);
        \Storage::disk('public')->put("{$dir}/{$filename}", json_encode($presentation, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT));

        return [
            'success'         => true,
            'presentation_id' => $id,
            'url'             => url("/ai-reports/download/{$filename}"),
            'filename'        => $filename,
            'type'            => 'live_presentation',
            'slide_count'     => count($presentation['slides']),
        ];
    }
}
