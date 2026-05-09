<?php

namespace App\Providers;

use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\Vite;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        $this->app->singleton(\App\Services\IMSService::class);
        $this->app->singleton(\App\Services\QuotationService::class);
        $this->app->singleton(\App\Services\WorkOrderService::class);
        $this->app->singleton(\App\Services\OperationSheetService::class);
        $this->app->singleton(\App\Services\InvoiceService::class);
        $this->app->singleton(\App\Services\NotificationService::class);
        $this->app->singleton(\App\Services\AuditService::class);
        $this->app->singleton(\App\Services\LiveDashboardService::class);
        $this->app->singleton(\App\Services\RfqAutomationService::class);
        $this->app->singleton(\App\Services\MRPService::class, function ($app) {
            return new \App\Services\MRPService($app->make(\App\Services\IMSService::class));
        });
    }

    public function boot(): void
    {
        Vite::prefetch(concurrency: 3);

        // RFQ Automation event listeners
        Event::listen(\App\Events\RfqCreated::class, \App\Listeners\TriggerAutoEstimation::class);
        Event::listen(\App\Events\RfqCreated::class, \App\Listeners\DetectDuplicateRfq::class);

        // Super-admin bypasses all permission checks
        Gate::before(function ($user, $ability) {
            if ($user instanceof \App\Models\User && $user->hasRole('super-admin')) {
                return true;
            }
        });
    }
}
