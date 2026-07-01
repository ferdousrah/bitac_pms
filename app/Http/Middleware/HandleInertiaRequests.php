<?php

namespace App\Http\Middleware;

use App\Models\Center;
use App\Models\Notification;
use App\Services\SettingService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Inertia\Middleware;

class HandleInertiaRequests extends Middleware
{
    /**
     * The root template that is loaded on the first page visit.
     *
     * @var string
     */
    protected $rootView = 'app';

    /**
     * Determine the current asset version.
     */
    public function version(Request $request): ?string
    {
        return parent::version($request);
    }

    /**
     * Define the props that are shared by default.
     *
     * @return array<string, mixed>
     */
    public function share(Request $request): array
    {
        $user       = $request->user();
        $centerId   = app()->bound('current_center_id') ? app('current_center_id') : null;
        $center     = $centerId ? Center::find($centerId) : null;

        // Only staff users have Spatie roles/permissions. Customers (separate guard) do not.
        $hasSpatieRoles = $user && method_exists($user, 'hasRole');
        $isSuperAdmin = $hasSpatieRoles
            ? ($user->hasRole('super-admin') || $user->hasRole('super_admin'))
            : false;

        // All permissions the user has (via roles + direct), as a flat string array
        $permissions = $hasSpatieRoles
            ? $user->getAllPermissions()->pluck('name')->toArray()
            : [];

        // Customer guard awareness — used for the customer portal bell + dashboard.
        $customer = auth('customer')->user();

        return [
            ...parent::share($request),
            'customerNotifications' => $customer ? [
                'unread_count' => $customer->notifications()->where('is_read', false)->count(),
            ] : null,
            'auth' => [
                'user' => $user ? [
                    'id'             => $user->id,
                    'name'           => $user->name,
                    'email'          => $user->email,
                    'center_id'      => $user->center_id,
                    'permissions'    => $permissions,
                    'is_super_admin' => $isSuperAdmin,
                    // Approver's saved signature — shown as the default option in
                    // the approval modal's "Use my saved signature" toggle.
                    'signature_url'  => method_exists($user, 'getSignatureUrlAttribute') ? $user->signature_url : null,
                    // Profile photo — used in sidebar / topbar avatar widgets.
                    'avatar_url'     => method_exists($user, 'getAvatarUrlAttribute') ? $user->avatar_url : null,
                ] : null,
            ],
            'flash' => [
                'success' => $request->session()->get('success'),
                'error'   => $request->session()->get('error'),
            ],
            'currentCenter'  => $center ? ['id' => $center->id, 'name' => $center->name, 'code' => $center->code] : null,
            'isSuperAdmin'   => $isSuperAdmin,
            'availableCenters' => $isSuperAdmin
                ? Center::where('is_active', true)->get(['id', 'name', 'code'])
                : [],
            'unreadNotifications' => ($user && $hasSpatieRoles)
                ? Notification::forUser($user->id)->unread()->count()
                : 0,
            // Production sections to show as submenu items under "Production".
            // Super-admin sees every active shop section; a supervisor sees only their own.
            'productionSections' => function () use ($user, $hasSpatieRoles, $isSuperAdmin) {
                if (!$user || !$hasSpatieRoles) return [];
                if (!$user->can('view production')) return [];

                // Which shops (and sub-sections) this user's sidebar lists:
                //  - super-admin: every shop + its sub-sections.
                //  - shop supervisor (section is top-level): that shop + its subs.
                //  - sub-section supervisor: just their sub-section.
                $ownSub = null;
                $shopQ = \App\Models\Section::active()->shops()->topLevel()
                    ->with(['children' => fn ($q) => $q->where('is_active', true)->orderBy('display_order')])
                    ->orderBy('display_order');
                if (!$isSuperAdmin && $user->section_id) {
                    $own = \App\Models\Section::find($user->section_id);
                    if ($own && $own->parent_id) {
                        $ownSub = $own;                       // sub-section supervisor
                        $shopQ->where('id', $own->parent_id); // (loaded for parent name only)
                    } else {
                        $shopQ->where('id', $user->section_id); // shop supervisor
                    }
                }
                $shops = $shopQ->get(['id', 'name', 'code']);

                // Counts: shop = items with any OPEN step there; sub-section =
                // items with an OPEN step ASSIGNED to that sub-section. Matches
                // ProductionController::queue so badges never drift.
                $activeStatuses = ['ready', 'in_progress', 'rework', 'awaiting_rework'];
                $activeWoSections = \App\Models\WorkOrderSection::query()
                    ->whereIn('status', $activeStatuses)
                    ->with(['workOrder.items', 'workOrder.operationSheets.steps'])
                    ->get();

                $shopCount = [];
                $subCount  = [];
                foreach ($activeWoSections as $wos) {
                    $wo = $wos->workOrder; $sectionId = $wos->section_id;
                    $sheets = $wo->operationSheets;
                    $buckets = $wo->items->map(fn ($it) => $sheets->firstWhere('work_order_item_id', $it->id))
                        ->filter()
                        ->merge($sheets->whereNull('work_order_item_id'));
                    foreach ($buckets as $sheet) {
                        $openSteps = $sheet->steps->where('section_id', $sectionId)
                            ->filter(fn ($s) => !in_array($s->status, ['completed', 'skipped']));
                        if ($openSteps->isEmpty()) continue;
                        $shopCount[$sectionId] = ($shopCount[$sectionId] ?? 0) + 1;
                        foreach ($openSteps->pluck('sub_section_id')->filter()->unique() as $sid) {
                            $subCount[$sid] = ($subCount[$sid] ?? 0) + 1;
                        }
                    }
                }

                // Flatten to a nested list (shop then its sub-sections).
                $out = [];
                if ($ownSub) {
                    $out[] = ['id' => $ownSub->id, 'name' => $ownSub->name, 'code' => $ownSub->code,
                              'parent_id' => $ownSub->parent_id, 'is_sub' => true,
                              'pending_count' => (int) ($subCount[$ownSub->id] ?? 0)];
                } else {
                    foreach ($shops as $s) {
                        $out[] = ['id' => $s->id, 'name' => $s->name, 'code' => $s->code,
                                  'parent_id' => null, 'is_sub' => false,
                                  'pending_count' => (int) ($shopCount[$s->id] ?? 0)];
                        foreach ($s->children as $c) {
                            $out[] = ['id' => $c->id, 'name' => $c->name, 'code' => $c->code,
                                      'parent_id' => $s->id, 'is_sub' => true,
                                      'pending_count' => (int) ($subCount[$c->id] ?? 0)];
                        }
                    }
                }
                return $out;
            },
            'appSettings' => function () {
                $s = app(SettingService::class);
                $branding = $s->branding();
                return [
                    ...$branding,
                    'logo_url' => $branding['logo_path']
                        ? Storage::disk('public')->url($branding['logo_path'])
                        : null,
                ];
            },
            'aiEnabled' => function () {
                // Master AI switch. When 'no', the chatbot + all inline AI assist
                // panels across the app are hidden and AI endpoints return 503.
                return app(SettingService::class)->get('ai.enabled', 'yes') !== 'no';
            },
            'chatbotSettings' => function () {
                $s = app(SettingService::class);
                return [
                    'name'          => $s->get('chatbot.name', 'Oli'),
                    'subtitle'      => $s->get('chatbot.subtitle', 'AI Chatbot'),
                    'welcome'       => $s->get('chatbot.welcome', "Hi! I'm Oli 👋"),
                    'welcome_sub'   => $s->get('chatbot.welcome_sub', 'Your AI assistant for BITAC PMS.'),
                    'placeholder'   => $s->get('chatbot.placeholder', 'Ask about production, machines, finance...'),
                    'footer'        => $s->get('chatbot.footer', 'Powered by Technocrats'),
                    'primary_color' => $s->get('chatbot.primary_color', '#ff7a0f'),
                    'bubble_user'   => $s->get('chatbot.bubble_user', 'light'),
                    'bubble_bot'    => $s->get('chatbot.bubble_bot', 'light'),
                    'fab_position'  => $s->get('chatbot.fab_position', 'bottom-right'),
                    'tts_default'   => $s->get('chatbot.tts_default', 'off'),
                    'show_avatar'   => $s->get('chatbot.show_avatar', 'yes'),
                    'enabled'       => $s->get('chatbot.enabled', 'yes'),
                    'icon_type'     => $s->get('chatbot.icon_type', 'font'),
                    'icon_font'     => $s->get('chatbot.icon_font', 'fi-rr-robot'),
                    'icon_image_url'=> $s->get('chatbot.icon_image')
                        ? Storage::disk('public')->url($s->get('chatbot.icon_image'))
                        : null,
                ];
            },
        ];
    }
}
