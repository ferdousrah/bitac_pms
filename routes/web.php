<?php

use App\Http\Controllers\Admin\ApprovalChainController;
use App\Http\Controllers\NotificationController;
use App\Http\Controllers\Pcd\MaterialRequisitionController as PcdMaterialRequisitionController;
use App\Http\Controllers\Pcd\PcdInboxController;
use App\Http\Controllers\Pcd\WorkOrderSectionController;
use App\Http\Controllers\Admin\BrandingController;
use App\Http\Controllers\Admin\MachineController;
use App\Http\Controllers\Admin\MachiningOperationController;
use App\Http\Controllers\Admin\MaterialController;
use App\Http\Controllers\Admin\OperatorController;
use App\Http\Controllers\Admin\SectionController;
use App\Http\Controllers\CostEstimateController;
use App\Http\Controllers\SearchController;
use App\Http\Controllers\Admin\AuditLogController;
use App\Http\Controllers\Admin\CustomerManagementController;
use App\Http\Controllers\Admin\RoleController;
use App\Http\Controllers\Admin\UserController;
use App\Http\Controllers\Auth\CustomerLoginController;
use App\Http\Controllers\Customer\CustomerComplaintController;
use App\Http\Controllers\Customer\CustomerDashboardController;
use App\Http\Controllers\Customer\CustomerInvoiceController;
use App\Http\Controllers\Customer\CustomerWorkOrderController;
use App\Http\Controllers\DashboardController;
use App\Http\Controllers\DeliveryController;
use App\Http\Controllers\InvoiceController;
use App\Http\Controllers\LiveDashboardController;
use App\Http\Controllers\MRPController;
use App\Http\Controllers\NcrController;
use App\Http\Controllers\OperationSheetController;
use App\Http\Controllers\ProfileController;
use App\Http\Controllers\QcController;
use App\Http\Controllers\QuotationController;
use App\Http\Controllers\ReportController;
use App\Http\Controllers\RfqController;
use App\Http\Controllers\ScheduleController;
use App\Http\Controllers\ShopFloorController;
use App\Http\Controllers\WIPController;
use App\Http\Controllers\WorkOrderController;
use Illuminate\Support\Facades\Route;

// ======================================================================
// Center switcher (super_admin only)
// ======================================================================
Route::post('/switch-center', function (\Illuminate\Http\Request $request) {
    abort_unless(auth()->check() && (auth()->user()->hasRole('super-admin') || auth()->user()->hasRole('super_admin')), 403);
    $centerId = $request->input('center_id');
    if ($centerId) {
        session(['active_center_id' => (int) $centerId]);
    } else {
        session()->forget('active_center_id');
    }
    return back();
})->middleware('auth')->name('center.switch');

// ======================================================================
// Root redirect
// ======================================================================
Route::get('/', function () {
    if (auth()->check()) {
        return redirect()->route('dashboard');
    }
    if (auth('customer')->check()) {
        return redirect()->route('customer.dashboard');
    }
    return redirect()->route('login');
});

// ======================================================================
// Staff Authentication (handled by Breeze)
// ======================================================================
require __DIR__.'/auth.php';

// ======================================================================
// Customer Authentication
// ======================================================================
Route::middleware('guest:customer')->prefix('customer')->group(function () {
    Route::get('login', [CustomerLoginController::class, 'showLoginForm'])->name('customer.login');
    Route::post('login', [CustomerLoginController::class, 'login'])->name('customer.login.post');
});

Route::post('customer/logout', [CustomerLoginController::class, 'logout'])
    ->middleware('auth:customer')
    ->name('customer.logout');

// ======================================================================
// Public Live Operations Dashboard (no auth required)
// ======================================================================
Route::get('/dashboard/live', [LiveDashboardController::class, 'index'])
    ->name('dashboard.live');

// ======================================================================
// Staff Routes (authenticated)
// ======================================================================
Route::middleware(['auth'])->group(function () {

    // Global search (JSON API)
    Route::get('/search', SearchController::class)->name('search');

    // Notifications (JSON API for AJAX)
    Route::prefix('notifications')->group(function () {
        Route::get('/',           [NotificationController::class, 'index'])->name('notifications.index');
        Route::get('/unread-count', [NotificationController::class, 'unreadCount'])->name('notifications.unread-count');
        Route::post('/{notification}/read', [NotificationController::class, 'markAsRead'])->name('notifications.read');
        Route::post('/read-all',  [NotificationController::class, 'markAllRead'])->name('notifications.read-all');
    });

    // Profile
    Route::get('/profile', [ProfileController::class, 'edit'])->name('profile.edit');
    Route::patch('/profile', [ProfileController::class, 'update'])->name('profile.update');
    Route::delete('/profile', [ProfileController::class, 'destroy'])->name('profile.destroy');

    // Dashboard
    Route::get('/dashboard', [DashboardController::class, 'index'])->name('dashboard');

    // AI Report Download (force download header)
    Route::get('/ai-reports/download/{filename}', function (string $filename) {
        $path = storage_path("app/public/ai-reports/{$filename}");
        if (!file_exists($path)) abort(404);
        // Return JSON presentation files as inline JSON (for PresentationViewer)
        if (str_ends_with($filename, '.json')) {
            return response()->file($path, ['Content-Type' => 'application/json']);
        }
        return response()->download($path, $filename);
    })->where('filename', '.*')->name('ai-report.download');

    // AI Assist — small helpers outside the main Oli chat (e.g. approval notes)
    // All routes guarded by the master ai.enabled switch.
    Route::middleware('ai.enabled')->group(function () {
        Route::post('/ai-assist/approval-note', [\App\Http\Controllers\AiAssistController::class, 'approvalNote'])
            ->name('ai-assist.approval-note');
        Route::post('/ai-assist/quotation-terms', [\App\Http\Controllers\AiAssistController::class, 'quotationTerms'])
            ->name('ai-assist.quotation-terms');
        Route::post('/ai-assist/comment-reply', [\App\Http\Controllers\AiAssistController::class, 'commentReply'])
            ->name('ai-assist.comment-reply');
        Route::post('/ai-assist/sample-description', [\App\Http\Controllers\AiAssistController::class, 'sampleDescription'])
            ->name('ai-assist.sample-description');
    });

    // Entity comments (threaded conversation on cost estimates + quotations)
    Route::post('/entity-comments', [\App\Http\Controllers\EntityCommentController::class, 'store'])
        ->name('entity-comments.store');
    Route::delete('/entity-comments/{comment}', [\App\Http\Controllers\EntityCommentController::class, 'destroy'])
        ->name('entity-comments.destroy');

    // AI Agent — the main Oli chat endpoints. Guarded by the master switch too.
    Route::middleware('ai.enabled')->prefix('ai-agent')->group(function () {
        Route::get('/conversations',               [\App\Http\Controllers\AiAgentController::class, 'conversations'])->name('ai-agent.conversations');
        Route::get('/conversations/{id}/messages',  [\App\Http\Controllers\AiAgentController::class, 'messages'])->name('ai-agent.messages');
        Route::post('/chat',                        [\App\Http\Controllers\AiAgentController::class, 'chat'])->name('ai-agent.chat');
        Route::post('/stream',                      [\App\Http\Controllers\AiAgentController::class, 'stream'])->name('ai-agent.stream');
        Route::post('/conversations/{id}/pin',      [\App\Http\Controllers\AiAgentController::class, 'togglePin'])->name('ai-agent.pin');
        Route::post('/conversations/{id}/rename',   [\App\Http\Controllers\AiAgentController::class, 'rename'])->name('ai-agent.rename');
        Route::delete('/conversations/{id}',        [\App\Http\Controllers\AiAgentController::class, 'deleteConversation'])->name('ai-agent.delete');
        Route::post('/reset',                       [\App\Http\Controllers\AiAgentController::class, 'reset'])->name('ai-agent.reset');
    });

    // Meetings
    Route::prefix('meetings')->group(function () {
        Route::get('/',                             [\App\Http\Controllers\MeetingController::class, 'index'])->name('meetings.index');
        Route::post('/',                            [\App\Http\Controllers\MeetingController::class, 'store'])->name('meetings.store');
        Route::post('/join',                        [\App\Http\Controllers\MeetingController::class, 'join'])->name('meetings.join');
        Route::get('/{meeting}',                    [\App\Http\Controllers\MeetingController::class, 'show'])->name('meetings.show');
        Route::post('/{meeting}/messages',          [\App\Http\Controllers\MeetingController::class, 'sendMessage'])->name('meetings.send');
        Route::get('/{meeting}/poll',               [\App\Http\Controllers\MeetingController::class, 'poll'])->name('meetings.poll');
        Route::post('/{meeting}/start',             [\App\Http\Controllers\MeetingController::class, 'start'])->name('meetings.start');
        Route::post('/{meeting}/end',               [\App\Http\Controllers\MeetingController::class, 'end'])->name('meetings.end');
        Route::post('/{meeting}/leave',             [\App\Http\Controllers\MeetingController::class, 'leave'])->name('meetings.leave');
        Route::post('/{meeting}/presentation',      [\App\Http\Controllers\MeetingController::class, 'updatePresentation'])->name('meetings.presentation');
        Route::post('/{meeting}/voice-activity',    [\App\Http\Controllers\MeetingController::class, 'voiceActivity'])->name('meetings.voice-activity');
        // WebRTC audio call signaling
        Route::post('/{meeting}/call/join',          [\App\Http\Controllers\MeetingController::class, 'joinCall'])->name('meetings.call.join');
        Route::post('/{meeting}/call/leave',         [\App\Http\Controllers\MeetingController::class, 'leaveCall'])->name('meetings.call.leave');
        Route::post('/{meeting}/call/signal',        [\App\Http\Controllers\MeetingController::class, 'sendSignal'])->name('meetings.call.signal');
        Route::get('/{meeting}/call/poll',           [\App\Http\Controllers\MeetingController::class, 'pollSignals'])->name('meetings.call.poll');
        // Action items + decisions
        Route::post('/{meeting}/action-items',                         [\App\Http\Controllers\MeetingController::class, 'createActionItem'])->name('meetings.action-items.create');
        Route::put('/{meeting}/action-items/{actionItem}',             [\App\Http\Controllers\MeetingController::class, 'updateActionItem'])->name('meetings.action-items.update');
        Route::delete('/{meeting}/action-items/{actionItem}',          [\App\Http\Controllers\MeetingController::class, 'deleteActionItem'])->name('meetings.action-items.delete');
        Route::delete('/{meeting}/decisions/{decision}',               [\App\Http\Controllers\MeetingController::class, 'deleteDecision'])->name('meetings.decisions.delete');
        // Summary + Analytics
        Route::get('/{meeting}/summary',             [\App\Http\Controllers\MeetingController::class, 'summary'])->name('meetings.summary');
        Route::get('/{meeting}/notes',              [\App\Http\Controllers\MeetingController::class, 'notes'])->name('meetings.notes');
    });
    Route::get('/meeting-analytics',                 [\App\Http\Controllers\MeetingController::class, 'analytics'])->name('meetings.analytics');

    // Files (My Files / File Manager)
    Route::get('/files',               [\App\Http\Controllers\UserFileController::class, 'index'])->name('files.index');
    Route::get('/files/browse',        [\App\Http\Controllers\UserFileController::class, 'browse'])->name('files.browse');
    Route::post('/files',              [\App\Http\Controllers\UserFileController::class, 'store'])->name('files.store');
    Route::delete('/files/{file}',     [\App\Http\Controllers\UserFileController::class, 'destroy'])->name('files.destroy');
    Route::post('/files/{file}/preview',       [\App\Http\Controllers\UserFileController::class, 'generatePreview'])->name('files.preview');
    Route::get('/files/converter-status',      [\App\Http\Controllers\UserFileController::class, 'converterStatus'])->name('files.converter-status');
    // Folders
    Route::get('/file-folders',                      [\App\Http\Controllers\UserFileController::class, 'listFolders'])->name('folders.list');
    Route::post('/file-folders',                     [\App\Http\Controllers\UserFileController::class, 'storeFolder'])->name('folders.store');
    Route::put('/file-folders/{folder}',             [\App\Http\Controllers\UserFileController::class, 'updateFolder'])->name('folders.update');
    Route::delete('/file-folders/{folder}',          [\App\Http\Controllers\UserFileController::class, 'destroyFolder'])->name('folders.destroy');
    Route::post('/files/move',                       [\App\Http\Controllers\UserFileController::class, 'moveFiles'])->name('files.move');

    // RFQ
    Route::resource('rfqs', RfqController::class)
        ->middleware('permission:view rfqs');
    Route::get('rfqs/{rfq}/pdf', [RfqController::class, 'exportPdf'])
        ->middleware('permission:view rfqs')
        ->name('rfqs.pdf');

    // Pending Approvals
    Route::get('/approvals', [\App\Http\Controllers\PendingApprovalsController::class, 'index'])
        ->middleware('permission:approve quotations')
        ->name('approvals.index');
    Route::post('/approvals/{approval}/approve', [\App\Http\Controllers\PendingApprovalsController::class, 'approve'])
        ->middleware('permission:approve quotations')
        ->name('approvals.approve');
    Route::post('/approvals/{approval}/reject', [\App\Http\Controllers\PendingApprovalsController::class, 'reject'])
        ->middleware('permission:reject quotations')
        ->name('approvals.reject');
    Route::post('/approvals/estimate/{approval}/approve', [\App\Http\Controllers\PendingApprovalsController::class, 'approveEstimate'])
        ->middleware('permission:approve quotations')
        ->name('approvals.estimate.approve');
    Route::post('/approvals/estimate/{approval}/reject', [\App\Http\Controllers\PendingApprovalsController::class, 'rejectEstimate'])
        ->middleware('permission:reject quotations')
        ->name('approvals.estimate.reject');

    // Cost Estimates (IED)
    Route::resource('cost-estimates', CostEstimateController::class)
        ->middleware('permission:view cost-estimates');
    Route::post('cost-estimates/{costEstimate}/use-as-quotation', [CostEstimateController::class, 'useAsQuotation'])
        ->middleware('permission:create quotations')
        ->name('cost-estimates.use-as-quotation');
    // Cost Estimate AI helpers
    Route::get('api/cost-estimates/rate-suggestions', [\App\Http\Controllers\CostEstimateAiController::class, 'rateSuggestions'])
        ->name('cost-estimates.rate-suggestions');
    Route::get('api/cost-estimates/find-similar', [\App\Http\Controllers\CostEstimateAiController::class, 'findSimilar'])
        ->name('cost-estimates.find-similar');

    Route::post('cost-estimates/{costEstimate}/submit-approval', [CostEstimateController::class, 'submitForApproval'])
        ->middleware('permission:view cost-estimates')
        ->name('cost-estimates.submit-approval');
    Route::post('cost-estimates/{costEstimate}/approve', [CostEstimateController::class, 'approveEstimate'])
        ->middleware('permission:approve quotations')
        ->name('cost-estimates.approve');
    Route::post('cost-estimates/{costEstimate}/reject', [CostEstimateController::class, 'rejectEstimate'])
        ->middleware('permission:reject quotations')
        ->name('cost-estimates.reject');
    Route::post('cost-estimates/{costEstimate}/request-changes', [CostEstimateController::class, 'requestChangesEstimate'])
        ->middleware('permission:reject quotations')
        ->name('cost-estimates.request-changes');
    Route::get('cost-estimates/{costEstimate}/pdf', [CostEstimateController::class, 'exportSinglePdf'])
        ->middleware('permission:view cost-estimates')
        ->name('cost-estimates.pdf');
    Route::get('cost-estimates-export/excel', [CostEstimateController::class, 'exportExcel'])
        ->middleware('permission:view cost-estimates')
        ->name('cost-estimates.export.excel');
    Route::get('cost-estimates-export/pdf', [CostEstimateController::class, 'exportPdf'])
        ->middleware('permission:view cost-estimates')
        ->name('cost-estimates.export.pdf');

    // PCD Module
    Route::prefix('pcd')->middleware('permission:view pcd-inbox')->name('pcd.')->group(function () {
        Route::get('/inbox', [PcdInboxController::class, 'index'])->name('inbox.index');
        Route::get('/inbox/{workOrder}', [PcdInboxController::class, 'show'])->name('inbox.show');

        // Material Requisitions
        Route::resource('material-requisitions', PcdMaterialRequisitionController::class);
        Route::post('material-requisitions/{materialRequisition}/submit', [PcdMaterialRequisitionController::class, 'submit'])
            ->name('material-requisitions.submit');
        Route::post('material-requisitions/{materialRequisition}/approve', [PcdMaterialRequisitionController::class, 'approve'])
            ->name('material-requisitions.approve');
        Route::post('material-requisitions/{materialRequisition}/issue', [PcdMaterialRequisitionController::class, 'issue'])
            ->name('material-requisitions.issue');

        // Section assignment
        Route::get('work-orders/{workOrder}/sections',  [WorkOrderSectionController::class, 'edit'])->name('sections.edit');
        Route::put('work-orders/{workOrder}/sections',  [WorkOrderSectionController::class, 'update'])->name('sections.update');
    });

    // Quotations
    Route::resource('quotations', QuotationController::class)
        ->middleware('permission:view quotations');
    Route::delete('quotation-files/{file}', [QuotationController::class, 'deleteFile'])
        ->name('quotation-files.destroy');
    Route::post('quotations/{quotation}/submit-approval', [QuotationController::class, 'submitForApproval'])
        ->middleware('permission:view quotations')
        ->name('quotations.submit-approval');
    Route::post('quotations/{quotation}/approve', [QuotationController::class, 'approve'])
        ->middleware('permission:approve quotations')
        ->name('quotations.approve');
    Route::post('quotations/{quotation}/reject', [QuotationController::class, 'reject'])
        ->middleware('permission:reject quotations')
        ->name('quotations.reject');
    Route::post('quotations/{quotation}/request-changes', [QuotationController::class, 'requestChanges'])
        ->middleware('permission:reject quotations')
        ->name('quotations.request-changes');
    Route::get('quotations/{quotation}/pdf', [QuotationController::class, 'pdf'])
        ->name('quotations.pdf');
    Route::post('quotations/{quotation}/send', [QuotationController::class, 'sendToCustomer'])
        ->middleware('permission:convert quotations')
        ->name('quotations.send');
    Route::post('quotations/{quotation}/customer-response', [QuotationController::class, 'recordCustomerResponse'])
        ->middleware('permission:convert quotations')
        ->name('quotations.customer-response');
    Route::post('quotations/{quotation}/revision', [QuotationController::class, 'createRevision'])
        ->middleware('permission:create quotations')
        ->name('quotations.revision');
    Route::post('quotations/{quotation}/convert', [QuotationController::class, 'convertToWorkOrder'])
        ->middleware('permission:convert quotations')
        ->name('quotations.convert');
    Route::get('quotations-export/excel', [QuotationController::class, 'exportExcel'])
        ->middleware('permission:view quotations')
        ->name('quotations.export.excel');
    Route::get('quotations-export/pdf', [QuotationController::class, 'exportPdf'])
        ->middleware('permission:view quotations')
        ->name('quotations.export.pdf');

    // Work Orders
    Route::resource('work-orders', WorkOrderController::class)
        ->middleware('permission:view work-orders');
    Route::post('work-orders/{workOrder}/approve', [WorkOrderController::class, 'approve'])
        ->middleware('permission:approve work-orders')
        ->name('work-orders.approve');

    // MRP
    Route::prefix('mrp')->middleware('permission:view mrp')->group(function () {
        Route::get('{workOrder}', [MRPController::class, 'show'])->name('mrp.show');
        Route::post('{workOrder}/run', [MRPController::class, 'run'])->name('mrp.run');
        Route::post('{workOrder}/requisition', [MRPController::class, 'createRequisition'])->name('mrp.requisition');
    });

    // Operation Sheets
    Route::prefix('operation-sheets')->middleware('permission:view operation-sheets')->group(function () {
        Route::get('/', [OperationSheetController::class, 'index'])->name('operation-sheets.index');
        Route::get('{workOrder}/create', [OperationSheetController::class, 'create'])->name('operation-sheets.create');
        Route::post('{workOrder}', [OperationSheetController::class, 'store'])->name('operation-sheets.store');
        Route::get('{sheet}', [OperationSheetController::class, 'show'])->name('operation-sheets.show');
        Route::get('{sheet}/pdf', [OperationSheetController::class, 'pdf'])->name('operation-sheets.pdf');
        Route::get('{sheet}/qr', [OperationSheetController::class, 'qr'])->name('operation-sheets.qr');
    });

    // Schedule (Gantt)
    Route::middleware('permission:view schedule')->group(function () {
        Route::get('/schedule', [ScheduleController::class, 'index'])->name('schedule.index');
        Route::post('/schedule', [ScheduleController::class, 'store'])->name('schedule.store');
    });

    // Shop Floor
    Route::prefix('shop-floor')->middleware('permission:view shop-floor')->group(function () {
        Route::get('/', [ShopFloorController::class, 'index'])->name('shop-floor.index');
        Route::post('/start', [ShopFloorController::class, 'start'])->name('shop-floor.start');
        Route::post('/stop', [ShopFloorController::class, 'stop'])->name('shop-floor.stop');
        Route::post('/downtime', [ShopFloorController::class, 'downtime'])->name('shop-floor.downtime');
        Route::get('/scan/{qrCode}', [ShopFloorController::class, 'scan'])->name('shop-floor.scan');
    });

    // WIP (Work in Progress)
    Route::get('/wip', [WIPController::class, 'index'])
        ->middleware('permission:view wip')
        ->name('wip.index');

    // QC
    Route::prefix('qc')->middleware('permission:view qc')->group(function () {
        Route::get('/', [QcController::class, 'index'])->name('qc.index');
        Route::get('{workOrder}/create', [QcController::class, 'create'])->name('qc.create');
        Route::post('{workOrder}', [QcController::class, 'store'])->name('qc.store');
        Route::get('inspection/{inspection}', [QcController::class, 'show'])->name('qc.show');
    });

    // NCR
    Route::prefix('ncrs')->middleware('permission:view qc')->group(function () {
        Route::get('/', [NcrController::class, 'index'])->name('ncrs.index');
        Route::get('{ncr}', [NcrController::class, 'show'])->name('ncrs.show');
        Route::post('{ncr}/rework', [NcrController::class, 'createRework'])->name('ncrs.rework');
    });

    // Delivery
    Route::prefix('delivery')->middleware('permission:view delivery')->group(function () {
        Route::get('/', [DeliveryController::class, 'index'])->name('delivery.index');
        Route::get('create', [DeliveryController::class, 'create'])->name('delivery.create');
        Route::post('/', [DeliveryController::class, 'store'])->name('delivery.store');
        Route::post('{delivery}/complete', [DeliveryController::class, 'complete'])->name('delivery.complete');
    });

    // Invoices
    Route::prefix('invoices')->middleware('permission:view invoices')->group(function () {
        Route::get('/', [InvoiceController::class, 'index'])->name('invoices.index');
        Route::get('{invoice}', [InvoiceController::class, 'show'])->name('invoices.show');
        Route::get('{invoice}/pdf', [InvoiceController::class, 'downloadPdf'])->name('invoices.pdf');
        Route::post('{invoice}/acknowledge', [InvoiceController::class, 'acknowledge'])->name('invoices.acknowledge');
    });

    // Reports
    Route::prefix('reports')->middleware('permission:view reports')->group(function () {
        Route::get('/production', [ReportController::class, 'production'])->name('reports.production');
        Route::get('/rejection-rate', [ReportController::class, 'rejectionRate'])->name('reports.rejection-rate');
        Route::get('/lead-time', [ReportController::class, 'leadTime'])->name('reports.lead-time');
        Route::get('/oee', [ReportController::class, 'oee'])->name('reports.oee');
        Route::get('/{type}/export', [ReportController::class, 'export'])->name('reports.export');
    });

    // Admin
    Route::prefix('admin')->group(function () {
        Route::resource('users', UserController::class)
            ->middleware('permission:manage users')
            ->names('admin.users');
        Route::post('users/{user}/deactivate', [UserController::class, 'deactivate'])
            ->middleware('permission:manage users')
            ->name('admin.users.deactivate');
        Route::post('users/{user}/activate', [UserController::class, 'activate'])
            ->middleware('permission:manage users')
            ->name('admin.users.activate');

        Route::resource('roles', RoleController::class)
            ->middleware('permission:manage roles')
            ->names('admin.roles')
            ->except(['show']);

        Route::resource('customers', CustomerManagementController::class)
            ->middleware('permission:manage customers')
            ->names('admin.customers');

        Route::get('audit-log', [AuditLogController::class, 'index'])
            ->middleware('permission:view audit-log')
            ->name('admin.audit-log');

        Route::get('branding', [BrandingController::class, 'index'])
            ->middleware('permission:manage users')
            ->name('admin.branding');
        Route::post('branding', [BrandingController::class, 'update'])
            ->middleware('permission:manage users')
            ->name('admin.branding.update');

        Route::get('chatbot-settings', [\App\Http\Controllers\Admin\ChatbotSettingsController::class, 'index'])
            ->middleware('permission:manage users')
            ->name('admin.chatbot-settings');
        Route::post('chatbot-settings', [\App\Http\Controllers\Admin\ChatbotSettingsController::class, 'update'])
            ->middleware('permission:manage users')
            ->name('admin.chatbot-settings.update');

        // Centers — manage each BITAC center + its PDF letterhead config
        Route::get('centers',                [\App\Http\Controllers\Admin\CenterController::class, 'index'])
            ->middleware('permission:manage users')
            ->name('admin.centers.index');
        Route::get('centers/{center}/edit',  [\App\Http\Controllers\Admin\CenterController::class, 'edit'])
            ->middleware('permission:manage users')
            ->name('admin.centers.edit');
        Route::post('centers/{center}',      [\App\Http\Controllers\Admin\CenterController::class, 'update'])
            ->middleware('permission:manage users')
            ->name('admin.centers.update');

        // Phase 0 — Foundation: Sections / Operators / Machines master data
        Route::resource('sections', SectionController::class)
            ->middleware('permission:manage sections')
            ->names('admin.sections');
        Route::resource('operators', OperatorController::class)
            ->middleware('permission:manage operators')
            ->names('admin.operators');
        Route::resource('machines', MachineController::class)
            ->middleware('permission:manage machines')
            ->names('admin.machines');
        Route::resource('materials', MaterialController::class)
            ->middleware('permission:manage materials-master')
            ->names('admin.materials');
        Route::resource('operations', MachiningOperationController::class)
            ->middleware('permission:manage operations-master')
            ->names('admin.operations')
            ->parameters(['operations' => 'operation']);
        Route::post('machines/{machine}/state', [MachineController::class, 'changeState'])
            ->middleware('permission:manage machines')
            ->name('admin.machines.state');
        Route::post('machines/{machine}/maintenance', [MachineController::class, 'logMaintenance'])
            ->middleware('permission:manage machines')
            ->name('admin.machines.maintenance');

        Route::get('approval-chain', [ApprovalChainController::class, 'index'])
            ->middleware('permission:manage users')
            ->name('admin.approval-chain');
        Route::post('approval-chain', [ApprovalChainController::class, 'store'])
            ->middleware('permission:manage users')
            ->name('admin.approval-chain.store');
        Route::put('approval-chain/{approvalChain}', [ApprovalChainController::class, 'update'])
            ->middleware('permission:manage users')
            ->name('admin.approval-chain.update');
        Route::delete('approval-chain/{approvalChain}', [ApprovalChainController::class, 'destroy'])
            ->middleware('permission:manage users')
            ->name('admin.approval-chain.destroy');
        Route::post('approval-chain/reorder', [ApprovalChainController::class, 'reorder'])
            ->middleware('permission:manage users')
            ->name('admin.approval-chain.reorder');
    });
});

// ======================================================================
// Customer Portal Routes
// ======================================================================
Route::middleware(['auth:customer'])->prefix('customer')->name('customer.')->group(function () {
    Route::get('/dashboard', [CustomerDashboardController::class, 'index'])->name('dashboard');

    Route::get('/work-orders', [CustomerWorkOrderController::class, 'index'])->name('work-orders.index');
    Route::get('/work-orders/{workOrder}', [CustomerWorkOrderController::class, 'show'])->name('work-orders.show');

    Route::get('/invoices/{invoice}/download', [CustomerInvoiceController::class, 'download'])->name('invoices.download');

    Route::post('/complaints', [CustomerComplaintController::class, 'store'])->name('complaints.store');
});
