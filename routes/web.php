<?php

use App\Http\Controllers\Admin\ApprovalChainController;
use App\Http\Controllers\NotificationController;
use App\Http\Controllers\Pcd\MaterialRequisitionController as PcdMaterialRequisitionController;
use App\Http\Controllers\Pcd\PcdInboxController;
use App\Http\Controllers\Pcd\WorkOrderSectionController;
use App\Http\Controllers\Admin\BrandingController;
use App\Http\Controllers\Admin\MachineController;
use App\Http\Controllers\Admin\MachiningOperationController;
use App\Http\Controllers\Admin\JobCategoryController;
use App\Http\Controllers\Admin\MaterialController;
use App\Http\Controllers\Admin\OperatorController;
use App\Http\Controllers\Admin\SectionController;
use App\Http\Controllers\CostEstimateController;
use App\Http\Controllers\SearchController;
use App\Http\Controllers\Admin\AuditLogController;
use App\Http\Controllers\Admin\CustomerManagementController;
use App\Http\Controllers\Admin\RoleController;
use App\Http\Controllers\Admin\UserController;
use App\Http\Controllers\Admin\PortfolioController as AdminPortfolioController;
use App\Http\Controllers\Admin\SystemResetController;
use App\Http\Controllers\Ied\GatePassController;
use App\Http\Controllers\Portfolio\PortfolioPublicController;
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
use App\Http\Controllers\ProductionController;
use App\Http\Controllers\ProfileController;
use App\Http\Controllers\QcController;
use App\Http\Controllers\QuotationController;
use App\Http\Controllers\ReportController;
use App\Http\Controllers\RfqController;
use App\Http\Controllers\RfqLetterController;
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

    // ─── Customer Password Reset ─────────────────────────────────
    Route::get('password/forgot',  [\App\Http\Controllers\Auth\CustomerPasswordResetController::class, 'showRequestForm'])->name('customer.password.request');
    Route::post('password/forgot', [\App\Http\Controllers\Auth\CustomerPasswordResetController::class, 'sendResetLink'])->name('customer.password.email');
    Route::get('password/reset/{token}',  [\App\Http\Controllers\Auth\CustomerPasswordResetController::class, 'showResetForm'])->name('customer.password.reset');
    Route::post('password/reset',         [\App\Http\Controllers\Auth\CustomerPasswordResetController::class, 'reset'])->name('customer.password.update');
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
// Public Portfolio — share BITAC's previous work with anyone, no auth needed.
// Designed to live cleanly under a future portfolio.bitac.gov.bd subdomain
// by wrapping in Route::domain(...) when DNS is configured.
// ======================================================================
Route::get('/portfolio',         [PortfolioPublicController::class, 'index'])->name('portfolio.public.index');
Route::get('/portfolio/{slug}',  [PortfolioPublicController::class, 'show'])->name('portfolio.public.show');

// Public stakeholder form fill — no auth, identified by token.
Route::get('/stakeholder-form/{token}',             [\App\Http\Controllers\Public\StakeholderFormFillController::class, 'show'])->name('public.stakeholder-form.show');
Route::post('/stakeholder-form/{token}',            [\App\Http\Controllers\Public\StakeholderFormFillController::class, 'store'])->name('public.stakeholder-form.store');
Route::get('/stakeholder-form/{token}/success',     [\App\Http\Controllers\Public\StakeholderFormFillController::class, 'success'])->name('public.stakeholder-form.success');

// Public consultancy / student-assistance request form — no auth required.
Route::get('/consultancy/request',          [\App\Http\Controllers\Public\ConsultancyRequestController::class, 'showForm'])->name('public.consultancy.form');
Route::post('/consultancy/request',         [\App\Http\Controllers\Public\ConsultancyRequestController::class, 'store'])->name('public.consultancy.store');
Route::get('/consultancy/request/success',  [\App\Http\Controllers\Public\ConsultancyRequestController::class, 'success'])->name('public.consultancy.success');

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
    Route::post('/profile/signature', [ProfileController::class, 'updateSignature'])->name('profile.signature.update');
    Route::post('/profile/avatar',    [ProfileController::class, 'updateAvatar'])->name('profile.avatar.update');
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
        Route::post('/ai-assist/forwarding-letter', [\App\Http\Controllers\AiAssistController::class, 'forwardingLetter'])
            ->name('ai-assist.forwarding-letter');
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
    // Declared before the resource so it isn't shadowed by rfqs/{rfq}.
    Route::post('rfqs/autosave', [RfqController::class, 'autosave'])
        ->middleware('permission:view rfqs')
        ->name('rfqs.autosave');
    Route::resource('rfqs', RfqController::class)
        ->middleware('permission:view rfqs');
    Route::get('rfqs/{rfq}/pdf', [RfqController::class, 'exportPdf'])
        ->middleware('permission:view rfqs')
        ->name('rfqs.pdf');
    Route::get('rfqs/{rfq}/letter', [RfqController::class, 'letter'])
        ->middleware('permission:view rfqs')
        ->name('rfqs.letter');

    // ─── IED Customer Complaint Inbox ─────────────────────────────────
    Route::prefix('ied/complaints')->middleware('permission:manage complaints')->name('ied.complaints.')->group(function () {
        Route::get('/',                       [\App\Http\Controllers\Ied\ComplaintController::class, 'index'])->name('index');
        Route::get('/{complaint}',            [\App\Http\Controllers\Ied\ComplaintController::class, 'show'])->name('show');
        Route::post('/{complaint}/respond',           [\App\Http\Controllers\Ied\ComplaintController::class, 'respond'])->name('respond');
        Route::post('/{complaint}/approve-rework',    [\App\Http\Controllers\Ied\ComplaintController::class, 'approveRework'])->name('approve-rework');
        Route::post('/{complaint}/status',            [\App\Http\Controllers\Ied\ComplaintController::class, 'updateStatus'])->name('status');
        // Deliberation panel — decision makers, discussion, AI draft
        Route::post('/{complaint}/decision-makers',                          [\App\Http\Controllers\Ied\ComplaintController::class, 'addDecisionMaker'])->name('add-decision-maker');
        Route::delete('/{complaint}/decision-makers/{decisionMaker}',        [\App\Http\Controllers\Ied\ComplaintController::class, 'removeDecisionMaker'])->name('remove-decision-maker');
        Route::post('/{complaint}/messages',                                 [\App\Http\Controllers\Ied\ComplaintController::class, 'postMessage'])->name('post-message');
        Route::get('/{complaint}/messages/poll',                             [\App\Http\Controllers\Ied\ComplaintController::class, 'pollMessages'])->name('poll-messages');
        Route::get('/{complaint}/draft',                                     [\App\Http\Controllers\Ied\ComplaintController::class, 'generateDraft'])->name('draft');
    });

    // ─── IED Emergency Production Requests ───────────────────────────
    // Reviewers — same permission gate as RFQ management.
    // ─── IED Work Order Acceptance Inbox — gate before PCD ────────────────────
    Route::prefix('ied/work-orders')->middleware('permission:view rfqs')->name('ied.work-orders.')->group(function () {
        Route::get('/',                       [\App\Http\Controllers\Ied\IedWorkOrderInboxController::class, 'index'])->name('index');
        Route::get('/files/{file}',           [\App\Http\Controllers\Ied\IedWorkOrderInboxController::class, 'file'])->name('files.show');
        Route::get('/{workOrder}',            [\App\Http\Controllers\Ied\IedWorkOrderInboxController::class, 'show'])->name('show');
        Route::post('/{workOrder}/accept',    [\App\Http\Controllers\Ied\IedWorkOrderInboxController::class, 'accept'])->name('accept');
        Route::post('/{workOrder}/reject',    [\App\Http\Controllers\Ied\IedWorkOrderInboxController::class, 'reject'])->name('reject');
    });

    // ─── IED Jobs — read-only browse of every WO past the IED gate ────────────
    Route::prefix('ied/jobs')->middleware('permission:view rfqs')->name('ied.jobs.')->group(function () {
        Route::get('/',            [\App\Http\Controllers\Ied\IedJobsController::class, 'index'])->name('index');
        Route::get('/{workOrder}', [\App\Http\Controllers\Ied\IedJobsController::class, 'show'])->name('show');
    });

    Route::prefix('ied/emergency-requests')->middleware('permission:manage rfqs')->name('ied.emergency-requests.')->group(function () {
        Route::get('/',                              [\App\Http\Controllers\Ied\EmergencyRequestController::class, 'index'])->name('index');
        Route::get('/{emergencyRequest}',            [\App\Http\Controllers\Ied\EmergencyRequestController::class, 'show'])->name('show');
        Route::post('/{emergencyRequest}/approve',   [\App\Http\Controllers\Ied\EmergencyRequestController::class, 'approve'])->name('approve');
        Route::post('/{emergencyRequest}/reject',    [\App\Http\Controllers\Ied\EmergencyRequestController::class, 'reject'])->name('reject');
    });

    // ─── IED Gate Passes (Gate-In / Gate-Out for customer reference samples) ───
    Route::prefix('ied/gate-passes')->middleware('permission:manage gate-passes')->name('ied.gate-passes.')->group(function () {
        Route::get('/',                [GatePassController::class, 'index'])->name('index');
        Route::get('/create',          [GatePassController::class, 'create'])->name('create');
        Route::post('/',               [GatePassController::class, 'store'])->name('store');
        Route::get('/{gatePass}',      [GatePassController::class, 'show'])->name('show');
        Route::get('/{gatePass}/pdf',  [GatePassController::class, 'pdf'])->name('pdf');
        Route::post('/{gatePass}/cancel',   [GatePassController::class, 'cancel'])->name('cancel');
        Route::post('/{gatePass}/complete', [GatePassController::class, 'complete'])->name('complete');
    });

    // ─── IED Stakeholder Forms ──────────────────────────────
    Route::prefix('ied/stakeholder-forms')->middleware('permission:view stakeholder-forms')->name('ied.stakeholder-forms.')->group(function () {
        Route::get('/',                              [\App\Http\Controllers\StakeholderFormController::class, 'index'])->name('index');
        Route::get('/create',                        [\App\Http\Controllers\StakeholderFormController::class, 'create'])->name('create');
        Route::post('/',                             [\App\Http\Controllers\StakeholderFormController::class, 'store'])->name('store');
        Route::get('/{stakeholderForm}/edit',        [\App\Http\Controllers\StakeholderFormController::class, 'edit'])->name('edit');
        Route::put('/{stakeholderForm}',             [\App\Http\Controllers\StakeholderFormController::class, 'update'])->name('update');
        Route::put('/{stakeholderForm}/builder',     [\App\Http\Controllers\StakeholderFormController::class, 'saveBuilder'])->name('save-builder');
        Route::post('/{stakeholderForm}/publish',    [\App\Http\Controllers\StakeholderFormController::class, 'publish'])->name('publish');
        Route::post('/{stakeholderForm}/close',      [\App\Http\Controllers\StakeholderFormController::class, 'close'])->name('close');
        Route::delete('/{stakeholderForm}',          [\App\Http\Controllers\StakeholderFormController::class, 'destroy'])->name('destroy');

        Route::get('/{stakeholderForm}/distribute',  [\App\Http\Controllers\StakeholderFormController::class, 'distribute'])->name('distribute');
        Route::post('/{stakeholderForm}/distribute', [\App\Http\Controllers\StakeholderFormController::class, 'sendInvites'])->name('send-invites');
        Route::post('/{stakeholderForm}/remind',     [\App\Http\Controllers\StakeholderFormController::class, 'sendReminders'])->name('send-reminders');

        Route::get('/{stakeholderForm}/responses',   [\App\Http\Controllers\StakeholderFormController::class, 'responses'])->name('responses');
        Route::get('/{stakeholderForm}/ai-summary',  [\App\Http\Controllers\StakeholderFormController::class, 'aiSummary'])->name('ai-summary');
        Route::get('/{stakeholderForm}/export',      [\App\Http\Controllers\StakeholderFormController::class, 'exportCsv'])->name('export-csv');
    });

    // ─── IED Stakeholder Directory ──────────────────────────
    Route::prefix('ied/stakeholders')->middleware('permission:view stakeholder-forms')->name('ied.stakeholders.')->group(function () {
        Route::get('/',                              [\App\Http\Controllers\StakeholderController::class, 'index'])->name('index');
        Route::get('/create',                        [\App\Http\Controllers\StakeholderController::class, 'create'])->name('create');
        Route::post('/',                             [\App\Http\Controllers\StakeholderController::class, 'store'])->name('store');
        Route::get('/{stakeholder}/edit',            [\App\Http\Controllers\StakeholderController::class, 'edit'])->name('edit');
        Route::put('/{stakeholder}',                 [\App\Http\Controllers\StakeholderController::class, 'update'])->name('update');
        Route::delete('/{stakeholder}',              [\App\Http\Controllers\StakeholderController::class, 'destroy'])->name('destroy');
        Route::post('/import',                       [\App\Http\Controllers\StakeholderController::class, 'bulkImport'])->name('import');
    });

    // ─── IED Service Demand Log + Report ───
    Route::prefix('ied/service-demand')->middleware('permission:view service-demand')->name('ied.service-demand.')->group(function () {
        Route::get('/',                          [\App\Http\Controllers\ServiceDemandController::class, 'index'])->name('index');
        Route::get('/create',                    [\App\Http\Controllers\ServiceDemandController::class, 'create'])->name('create');
        Route::post('/',                         [\App\Http\Controllers\ServiceDemandController::class, 'store'])->name('store');
        Route::get('/report',                    [\App\Http\Controllers\ServiceDemandController::class, 'report'])->name('report');
        Route::get('/report/export',             [\App\Http\Controllers\ServiceDemandController::class, 'exportReport'])->name('report.export');
        Route::get('/{serviceDemand}/edit',      [\App\Http\Controllers\ServiceDemandController::class, 'edit'])->name('edit');
        Route::put('/{serviceDemand}',           [\App\Http\Controllers\ServiceDemandController::class, 'update'])->name('update');
        Route::delete('/{serviceDemand}',        [\App\Http\Controllers\ServiceDemandController::class, 'destroy'])->name('destroy');
    });

    // ─── IED Consultancy Requests inbox + report ───
    Route::prefix('ied/consultancy-requests')->middleware('permission:view consultancy-requests')->name('ied.consultancy-requests.')->group(function () {
        Route::get('/',                                       [\App\Http\Controllers\ConsultancyRequestController::class, 'index'])->name('index');
        Route::get('/report',                                 [\App\Http\Controllers\ConsultancyRequestController::class, 'report'])->name('report');
        Route::get('/report/export',                          [\App\Http\Controllers\ConsultancyRequestController::class, 'exportReport'])->name('report.export');
        Route::get('/{consultancyRequest}',                   [\App\Http\Controllers\ConsultancyRequestController::class, 'show'])->name('show');
        Route::post('/{consultancyRequest}/accept',           [\App\Http\Controllers\ConsultancyRequestController::class, 'accept'])->name('accept');
        Route::post('/{consultancyRequest}/reject',           [\App\Http\Controllers\ConsultancyRequestController::class, 'reject'])->name('reject');
        Route::post('/{consultancyRequest}/complete',         [\App\Http\Controllers\ConsultancyRequestController::class, 'complete'])->name('complete');
        Route::get('/{consultancyRequest}/attachment',        [\App\Http\Controllers\ConsultancyRequestController::class, 'downloadAttachment'])->name('attachment');
    });

    // ─── IED Completion Certificates inbox + download ───
    Route::prefix('ied/completion-certificates')->middleware('permission:view completion-certificates')->name('ied.completion-certificates.')->group(function () {
        Route::get('/',                            [\App\Http\Controllers\CompletionCertificateController::class, 'index'])->name('index');
        Route::get('/{certificate}/download',      [\App\Http\Controllers\CompletionCertificateController::class, 'download'])->name('download');
        Route::get('/{certificate}/preview',       [\App\Http\Controllers\CompletionCertificateController::class, 'preview'])->name('preview');
    });

    // ─── PCD Gate-Out (production team issues these for sample / finished items leaving the floor) ───
    Route::prefix('pcd/gate-passes')->middleware('permission:view pcd')->name('pcd.gate-passes.')->group(function () {
        Route::get('/',                     [GatePassController::class, 'index'])->name('index');
        Route::get('/create',               [GatePassController::class, 'create'])->name('create');
        Route::post('/',                    [GatePassController::class, 'store'])->name('store');
        Route::get('/{gatePass}',           [GatePassController::class, 'show'])->name('show');
        Route::get('/{gatePass}/pdf',       [GatePassController::class, 'pdf'])->name('pdf');
        Route::post('/{gatePass}/cancel',   [GatePassController::class, 'cancel'])->name('cancel');
        Route::post('/{gatePass}/complete', [GatePassController::class, 'complete'])->name('complete');
        // Approval — any one configured approver finalises (→ issued) or rejects.
        Route::post('/{gatePass}/approve',  [GatePassController::class, 'approve'])->name('approve');
        Route::post('/{gatePass}/reject',   [GatePassController::class, 'reject'])->name('reject');
    });

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
    // Copy an existing costing into a new estimate — declared before the
    // find-similar route's neighbours so {costEstimate} can't swallow it.
    Route::get('api/cost-estimates/copy-search', [CostEstimateController::class, 'copySearch'])
        ->middleware('permission:view cost-estimates')
        ->name('cost-estimates.copy-search');
    Route::get('api/cost-estimates/{costEstimate}/copy-source', [CostEstimateController::class, 'copySource'])
        ->middleware('permission:view cost-estimates')
        ->name('cost-estimates.copy-source');
    Route::get('api/cost-estimates/find-similar', [\App\Http\Controllers\CostEstimateAiController::class, 'findSimilar'])
        ->name('cost-estimates.find-similar');

    Route::post('cost-estimates/{costEstimate}/submit-approval', [CostEstimateController::class, 'submitForApproval'])
        ->middleware('permission:view cost-estimates')
        ->name('cost-estimates.submit-approval');
    // Job-wise alternative: sends every part estimate of the job in one batch.
    Route::post('cost-estimates/job/{rfqItem}/submit-approval', [CostEstimateController::class, 'submitJobForApproval'])
        ->middleware('permission:view cost-estimates')
        ->name('cost-estimates.submit-job-approval');
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
        Route::get('/inbox/files/{file}', [PcdInboxController::class, 'file'])->name('inbox.files.show');
        Route::post('/inbox/{workOrder}/cancel', [PcdInboxController::class, 'cancel'])->name('inbox.cancel');
        Route::post('/inbox/{workOrder}/job-number', [PcdInboxController::class, 'setJobNumber'])->name('inbox.set-job-number');

        // Material Requisitions
        Route::resource('material-requisitions', PcdMaterialRequisitionController::class);
        Route::post('material-requisitions/{materialRequisition}/submit', [PcdMaterialRequisitionController::class, 'submit'])
            ->name('material-requisitions.submit');
        Route::post('material-requisitions/{materialRequisition}/approve', [PcdMaterialRequisitionController::class, 'approve'])
            ->name('material-requisitions.approve');
        Route::post('material-requisitions/{materialRequisition}/issue', [PcdMaterialRequisitionController::class, 'issue'])
            ->name('material-requisitions.issue');
        Route::get('material-requisitions/{materialRequisition}/pdf', [PcdMaterialRequisitionController::class, 'pdf'])
            ->name('material-requisitions.pdf');

        // Section assignment
        Route::get('work-orders/{workOrder}/sections',  [WorkOrderSectionController::class, 'edit'])->name('sections.edit');
        Route::put('work-orders/{workOrder}/sections',  [WorkOrderSectionController::class, 'update'])->name('sections.update');
        // Reroute a live job's remaining routing (bottleneck handling).
        Route::get('work-orders/{workOrder}/reroute',   [WorkOrderSectionController::class, 'rerouteForm'])->name('reroute.form');
        Route::put('work-orders/{workOrder}/reroute',   [WorkOrderSectionController::class, 'reroute'])->name('reroute');
        Route::get('work-orders/{workOrder}/pdf',       [WorkOrderSectionController::class, 'pdf'])->name('work-orders.pdf');
    });

    // Quotations
    // Copy an existing quotation onto another customer, chain and all.
    Route::post('quotations/{quotation}/duplicate', [QuotationController::class, 'duplicateForCustomer'])
        ->middleware('permission:create quotations')
        ->name('quotations.duplicate');
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
    // Forwarding letter as a separate PDF — same letterhead.
    Route::get('quotations/{quotation}/forwarding-letter/pdf', [QuotationController::class, 'exportForwardingLetterPdf'])
        ->name('quotations.forwarding-letter.pdf');
    Route::post('quotations/{quotation}/email', [QuotationController::class, 'emailToCustomer'])
        ->name('quotations.email');
    // Approver hands off their pending row to someone outside the chain.
    Route::post('quotations/{quotation}/forward-approval', [QuotationController::class, 'forwardApproval'])
        ->middleware('permission:approve quotations')
        ->name('quotations.forward-approval');
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

    // RFQ Letters — issue official BITAC letters against an RFQ (Bangla/English),
    // print as PDF or email to the customer.
    Route::resource('rfq-letters', RfqLetterController::class)
        ->except(['show'])
        ->parameters(['rfq-letters' => 'rfqLetter']);
    Route::get('rfq-letters/{rfqLetter}/pdf', [RfqLetterController::class, 'pdf'])
        ->name('rfq-letters.pdf');
    Route::post('rfq-letters/{rfqLetter}/email', [RfqLetterController::class, 'email'])
        ->name('rfq-letters.email');

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
        Route::get('{sheet}/edit', [OperationSheetController::class, 'edit'])->name('operation-sheets.edit');
        Route::put('{sheet}', [OperationSheetController::class, 'update'])->name('operation-sheets.update');
        Route::get('{sheet}', [OperationSheetController::class, 'show'])->name('operation-sheets.show');
        Route::get('{sheet}/pdf', [OperationSheetController::class, 'pdf'])->name('operation-sheets.pdf');
        Route::get('{sheet}/qr', [OperationSheetController::class, 'qr'])->name('operation-sheets.qr');

        // Production ↔ PCD query thread per operation sheet.
        Route::get('{sheet}/messages',  [\App\Http\Controllers\ProductionMessageController::class, 'index'])->name('production-messages.index');
        Route::post('{sheet}/messages', [\App\Http\Controllers\ProductionMessageController::class, 'store'])->name('production-messages.store');
    });

    // Streamed message attachment download/preview.
    Route::get('production-messages/files/{file}', [\App\Http\Controllers\ProductionMessageController::class, 'attachment'])
        ->name('production-messages.attachment');

    // ─── Maintenance Requests (shop-floor → manager → technician flow) ───
    Route::prefix('maintenance-requests')->name('maintenance-requests.')->group(function () {
        Route::get('/',                       [\App\Http\Controllers\MaintenanceRequestController::class, 'index'])->name('index');
        Route::get('/create',                 [\App\Http\Controllers\MaintenanceRequestController::class, 'create'])->middleware('permission:submit maintenance-requests')->name('create');
        Route::post('/',                      [\App\Http\Controllers\MaintenanceRequestController::class, 'store'])->middleware('permission:submit maintenance-requests')->name('store');
        Route::get('/{maintenanceRequest}',   [\App\Http\Controllers\MaintenanceRequestController::class, 'show'])->name('show');
        Route::post('/{maintenanceRequest}/approve',  [\App\Http\Controllers\MaintenanceRequestController::class, 'approve'])->middleware('permission:approve maintenance-requests')->name('approve');
        Route::post('/{maintenanceRequest}/reject',   [\App\Http\Controllers\MaintenanceRequestController::class, 'reject'])->middleware('permission:approve maintenance-requests')->name('reject');
        // Start/complete are gated *inline* in the controller — the requesting
        // section + anyone with `perform maintenance` can act, not just techs.
        Route::post('/{maintenanceRequest}/start',    [\App\Http\Controllers\MaintenanceRequestController::class, 'start'])->name('start');
        Route::post('/{maintenanceRequest}/complete', [\App\Http\Controllers\MaintenanceRequestController::class, 'complete'])->name('complete');
        Route::post('/{maintenanceRequest}/cancel',   [\App\Http\Controllers\MaintenanceRequestController::class, 'cancel'])->name('cancel');
    });

    // Production (per-section supervisor queue + section handoff routing)
    Route::prefix('production')->middleware('permission:view production')->name('production.')->group(function () {
        Route::get('/queue', [ProductionController::class, 'queue'])->name('queue');
        Route::get('/wos/{workOrderSection}', [ProductionController::class, 'show'])->name('show');
        // Holistic production-cycle timeline for a whole work order.
        Route::get('/work-orders/{workOrder}/cycle', [ProductionController::class, 'cycle'])->name('cycle');
        Route::post('/wos/{workOrderSection}/complete', [ProductionController::class, 'complete'])->name('complete');
        // Partial forward — transfer a quantity of finished pieces to the next section.
        Route::post('/wos/{workOrderSection}/transfer', [ProductionController::class, 'transfer'])->name('transfer');
        // Shop-floor bottleneck flag (→ PCD reroute).
        Route::post('/wos/{workOrderSection}/bottleneck', [ProductionController::class, 'flagBottleneck'])->name('wos.bottleneck');
        Route::delete('/wos/{workOrderSection}/bottleneck', [ProductionController::class, 'clearBottleneck'])->name('wos.bottleneck.clear');
        // View the PCD operation sheet PDF from the shop floor (production-permission gated).
        Route::get('/op-sheets/{sheet}/pdf', [\App\Http\Controllers\OperationSheetController::class, 'pdf'])->name('op-sheet.pdf');
        Route::post('/wos/{workOrderSection}/send-back', [ProductionController::class, 'sendBack'])->name('send-back');
        Route::post('/op-steps/{step}/mark', [ProductionController::class, 'markStep'])->name('op-steps.mark');
        // Shop in-charge assigns a step to one of the shop's sub-sections.
        Route::post('/op-steps/{step}/assign-sub-section', [ProductionController::class, 'assignSubSection'])->name('op-steps.assign-sub');
        // Quantity-based daily production logging.
        Route::post('/op-steps/{step}/log', [ProductionController::class, 'logProduction'])->name('op-steps.log');
        Route::delete('/production-logs/{productionLog}', [ProductionController::class, 'deleteProductionLog'])->name('logs.destroy');
    });

    // Schedule (Gantt)
    Route::middleware('permission:view schedule')->group(function () {
        Route::get('/schedule', [ScheduleController::class, 'index'])->name('schedule.index');
        Route::post('/schedule', [ScheduleController::class, 'store'])->name('schedule.store');
        Route::post('/schedule/auto', [ScheduleController::class, 'autoSchedule'])->name('schedule.auto');
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
        Route::get('/create', [QcController::class, 'create'])->name('qc.create');
        Route::post('/', [QcController::class, 'store'])->name('qc.store');
        Route::get('inspection/{inspection}', [QcController::class, 'show'])->name('qc.show');
        Route::get('inspection/{inspection}/pdf', [QcController::class, 'pdf'])->name('qc.pdf');
        Route::post('inspection/{inspection}/share', [QcController::class, 'toggleShare'])->name('qc.share');
        // Combined Job-level QC certificate (multi-item) — only renders when
        // every operation sheet has a passing final inspection.
        Route::get('work-orders/{workOrder}/certificate', [QcController::class, 'jobCertificate'])->name('qc.job-certificate');
    });

    // NCR
    Route::prefix('ncrs')->middleware('permission:view qc')->group(function () {
        Route::get('/', [NcrController::class, 'index'])->name('ncrs.index');
        Route::post('/', [NcrController::class, 'store'])->name('ncrs.store');
        Route::get('{ncr}', [NcrController::class, 'show'])->name('ncrs.show');
        Route::post('{ncr}/rework', [NcrController::class, 'createRework'])->name('ncrs.rework');
    });

    // Delivery
    Route::prefix('delivery')->middleware('permission:view delivery')->group(function () {
        Route::get('/', [DeliveryController::class, 'index'])->name('delivery.index');
        Route::get('create', [DeliveryController::class, 'create'])->name('delivery.create');
        Route::post('/', [DeliveryController::class, 'store'])->name('delivery.store');
        Route::get('{delivery}', [DeliveryController::class, 'show'])->name('delivery.show');
        Route::get('{delivery}/pdf', [DeliveryController::class, 'pdf'])->name('delivery.pdf');
        Route::post('{delivery}/complete', [DeliveryController::class, 'complete'])->name('delivery.complete');
    });

    // Invoices
    Route::prefix('invoices')->middleware('permission:view invoices')->group(function () {
        Route::get('/', [InvoiceController::class, 'index'])->name('invoices.index');
        Route::get('{invoice}', [InvoiceController::class, 'show'])->name('invoices.show');
        Route::get('{invoice}/pdf', [InvoiceController::class, 'downloadPdf'])->name('invoices.pdf');
        Route::post('{invoice}/acknowledge', [InvoiceController::class, 'acknowledge'])->name('invoices.acknowledge');
        Route::post('{invoice}/mark-paid', [InvoiceController::class, 'markPaid'])->name('invoices.mark-paid');
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

        // PCD gate-pass approver pool (any one approves a pass).
        Route::middleware('permission:manage users')->group(function () {
            Route::get('gate-pass-approvers',  [\App\Http\Controllers\Admin\GatePassApproverController::class, 'index'])->name('admin.gate-pass-approvers.index');
            Route::post('gate-pass-approvers', [\App\Http\Controllers\Admin\GatePassApproverController::class, 'store'])->name('admin.gate-pass-approvers.store');
            Route::delete('gate-pass-approvers/{approver}', [\App\Http\Controllers\Admin\GatePassApproverController::class, 'destroy'])->name('admin.gate-pass-approvers.destroy');
        });

        Route::resource('roles', RoleController::class)
            ->middleware('permission:manage roles')
            ->names('admin.roles')
            ->except(['show']);

        Route::resource('customers', CustomerManagementController::class)
            ->middleware('permission:manage customers')
            ->names('admin.customers');

        // ─── Portfolio (public-facing content management) ────────────────
        Route::resource('portfolio', AdminPortfolioController::class)
            ->middleware('permission:manage portfolio')
            ->names('admin.portfolio')
            ->parameters(['portfolio' => 'portfolio']);
        Route::post('portfolio/{portfolio}/toggle-publish', [AdminPortfolioController::class, 'togglePublish'])
            ->middleware('permission:manage portfolio')
            ->name('admin.portfolio.toggle-publish');
        Route::delete('portfolio-photos/{photo}', [AdminPortfolioController::class, 'deletePhoto'])
            ->middleware('permission:manage portfolio')
            ->name('admin.portfolio.delete-photo');

        // ─── System Reset (super-admin only — guarded inside controller) ───
        Route::get('system/reset',  [SystemResetController::class, 'index'])
            ->name('admin.system.reset.index');
        Route::post('system/reset', [SystemResetController::class, 'wipe'])
            ->name('admin.system.reset.wipe');

        Route::get('audit-log', [AuditLogController::class, 'index'])
            ->middleware('permission:view audit-log')
            ->name('admin.audit-log');

        Route::get('ai-usage', [\App\Http\Controllers\Admin\AiUsageController::class, 'index'])
            ->middleware('permission:view ai-usage')
            ->name('admin.ai-usage');

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
        Route::resource('material-categories', \App\Http\Controllers\Admin\MaterialCategoryController::class)
            ->middleware('permission:manage materials-master')
            ->names('admin.material-categories')
            ->parameters(['material-categories' => 'materialCategory'])
            ->except(['show']);
        Route::resource('gate-pass-condition-notes', \App\Http\Controllers\Admin\GatePassConditionNoteController::class)
            ->middleware('permission:manage gate-pass-notes')
            ->names('admin.gate-pass-condition-notes')
            ->parameters(['gate-pass-condition-notes' => 'gatePassConditionNote'])
            ->except(['show']);
        Route::resource('operations', MachiningOperationController::class)
            ->middleware('permission:manage operations-master')
            ->names('admin.operations')
            ->parameters(['operations' => 'operation']);
        Route::resource('job-categories', JobCategoryController::class)
            ->middleware('permission:manage materials-master')
            ->names('admin.job-categories')
            ->parameters(['job-categories' => 'jobCategory'])
            ->except(['show']);
        Route::resource('qc-checkpoints', \App\Http\Controllers\Admin\QcCheckpointController::class)
            ->middleware('permission:manage materials-master')
            ->names('admin.qc-checkpoints')
            ->parameters(['qc-checkpoints' => 'qcCheckpoint'])
            ->except(['show']);
        Route::resource('products', \App\Http\Controllers\Admin\ProductController::class)
            ->middleware('permission:manage materials-master')
            ->names('admin.products')
            ->parameters(['products' => 'product'])
            ->except(['show']);
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
// Force-change-password routes — auth required but exempt from the change-required gate
Route::middleware(['auth:customer'])->prefix('customer')->name('customer.')->group(function () {
    Route::get('/password/force',  [\App\Http\Controllers\Customer\CustomerForcePasswordController::class, 'show'])->name('password.force.show');
    Route::post('/password/force', [\App\Http\Controllers\Customer\CustomerForcePasswordController::class, 'update'])->name('password.force.update');
});

Route::middleware(['auth:customer', 'customer.password.changed'])->prefix('customer')->name('customer.')->group(function () {
    Route::get('/dashboard', [CustomerDashboardController::class, 'index'])->name('dashboard');

    // Notifications (bell + full-page list)
    Route::get('/notifications',                       [\App\Http\Controllers\Customer\CustomerNotificationController::class, 'index'])->name('notifications.index');
    Route::get('/notifications/poll',                  [\App\Http\Controllers\Customer\CustomerNotificationController::class, 'poll'])->name('notifications.poll');
    Route::post('/notifications/{notification}/read',  [\App\Http\Controllers\Customer\CustomerNotificationController::class, 'markRead'])->name('notifications.read');
    Route::post('/notifications/read-all',             [\App\Http\Controllers\Customer\CustomerNotificationController::class, 'markAllRead'])->name('notifications.read-all');

    Route::get('/rfqs',                       [\App\Http\Controllers\Customer\CustomerRfqController::class, 'index'])->name('rfqs.index');
    Route::get('/rfqs/create',                [\App\Http\Controllers\Customer\CustomerRfqController::class, 'create'])->name('rfqs.create');
    Route::post('/rfqs',                      [\App\Http\Controllers\Customer\CustomerRfqController::class, 'store'])->name('rfqs.store');
    Route::get('/rfqs/{rfq}',                 [\App\Http\Controllers\Customer\CustomerRfqController::class, 'show'])->name('rfqs.show');
    Route::post('/rfqs/{rfq}/cancel',         [\App\Http\Controllers\Customer\CustomerRfqController::class, 'cancel'])->name('rfqs.cancel');
    Route::get('/rfqs/{rfq}/letter',          [\App\Http\Controllers\Customer\CustomerRfqController::class, 'letter'])->name('rfqs.letter');
    Route::post('/rfqs/{rfq}/issue-work-order', [\App\Http\Controllers\Customer\CustomerRfqController::class, 'issueWorkOrder'])->name('rfqs.issue-work-order');

    Route::get('/work-orders', [CustomerWorkOrderController::class, 'index'])->name('work-orders.index');
    Route::get('/work-orders/{workOrder}', [CustomerWorkOrderController::class, 'show'])->name('work-orders.show');
    Route::post('/work-orders/{workOrder}/emergency-request',
        [\App\Http\Controllers\Customer\CustomerEmergencyRequestController::class, 'store']
    )->name('work-orders.emergency-request');

    Route::get('/invoices',                     [CustomerInvoiceController::class, 'index'])->name('invoices.index');
    Route::get('/invoices/{invoice}',           [CustomerInvoiceController::class, 'show'])->name('invoices.show');
    Route::get('/invoices/{invoice}/pdf',       [CustomerInvoiceController::class, 'pdf'])->name('invoices.pdf');
    Route::get('/invoices/{invoice}/download',  [CustomerInvoiceController::class, 'download'])->name('invoices.download');

    Route::get('/complaints',         [\App\Http\Controllers\Customer\CustomerComplaintController::class, 'index'])->name('complaints.index');
    Route::get('/complaints/create',  [\App\Http\Controllers\Customer\CustomerComplaintController::class, 'create'])->name('complaints.create');
    Route::get('/complaints/{complaint}', [\App\Http\Controllers\Customer\CustomerComplaintController::class, 'show'])->name('complaints.show');
    Route::post('/complaints',        [\App\Http\Controllers\Customer\CustomerComplaintController::class, 'store'])->name('complaints.store');

    Route::get('/documents', [\App\Http\Controllers\Customer\CustomerDocumentController::class, 'index'])->name('documents.index');
    Route::get('/documents/quotation/{quotation}',     [\App\Http\Controllers\Customer\CustomerDocumentController::class, 'quotation'])->name('documents.quotation');
    Route::get('/documents/quotation/{quotation}/forwarding-letter', [\App\Http\Controllers\Customer\CustomerDocumentController::class, 'quotationForwardingLetter'])->name('documents.quotation.forwarding-letter');
    Route::get('/documents/challan/{delivery}',        [\App\Http\Controllers\Customer\CustomerDocumentController::class, 'challan'])->name('documents.challan');
    Route::get('/documents/inspection/{inspection}',   [\App\Http\Controllers\Customer\CustomerDocumentController::class, 'inspectionCert'])->name('documents.inspection');
    Route::get('/documents/gate-pass/{gatePass}',      [\App\Http\Controllers\Customer\CustomerDocumentController::class, 'gatePass'])->name('documents.gate-pass');

    // Completion certificates — customer issues after WO delivered.
    Route::post('/work-orders/{workOrder}/completion-certificate',  [\App\Http\Controllers\Customer\CustomerCompletionCertificateController::class, 'store'])->name('work-orders.completion-certificate.store');
    Route::get('/documents/completion-certificate/{certificate}',   [\App\Http\Controllers\Customer\CustomerCompletionCertificateController::class, 'show'])->name('documents.completion-certificate');
});
