<?php

use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware): void {
        $middleware->web(append: [
            // ⚠️ FIRST: it decides `current_center_id`, which HandleInertiaRequests
            // reads when it shares `currentCenter`. Listed after it, the header
            // always read "All centres" — picking BITAC Dhaka looked like it
            // did nothing, though the session had it.
            \App\Http\Middleware\SetActiveCenter::class,
            \App\Http\Middleware\HandleInertiaRequests::class,
            // Says which letterhead a PDF was printed on (X-Pdf-Pad), so the
            // PDF popup can offer বাংলা / English pad for every document.
            \App\Http\Middleware\AnnouncePdfPad::class,
            \Illuminate\Http\Middleware\AddLinkHeadersForPreloadedAssets::class,
        ]);

        $middleware->alias([
            'role'                       => \Spatie\Permission\Middleware\RoleMiddleware::class,
            'permission'                 => \Spatie\Permission\Middleware\PermissionMiddleware::class,
            'role_or_permission'         => \Spatie\Permission\Middleware\RoleOrPermissionMiddleware::class,
            'ai.enabled'                 => \App\Http\Middleware\EnsureAiEnabled::class,
            'customer.password.changed'  => \App\Http\Middleware\EnsureCustomerPasswordChanged::class,
        ]);

        // Smart redirect for already-authenticated users hitting a 'guest' route
        $middleware->redirectUsersTo(function (\Illuminate\Http\Request $request) {
            // If customer is logged in, send them to customer dashboard
            if (\Illuminate\Support\Facades\Auth::guard('customer')->check()) {
                return '/customer/dashboard';
            }
            // Otherwise, staff dashboard
            return '/dashboard';
        });

        // Where unauthenticated users get sent
        $middleware->redirectGuestsTo(function (\Illuminate\Http\Request $request) {
            // If they were trying to access customer area, send to customer login
            if ($request->is('customer*')) {
                return route('customer.login');
            }
            return route('login');
        });
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        //
    })->create();
