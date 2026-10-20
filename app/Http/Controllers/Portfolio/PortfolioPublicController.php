<?php

namespace App\Http\Controllers\Portfolio;

use App\Http\Controllers\Controller;
use App\Models\Center;
use App\Models\Customer;
use App\Models\GalleryItem;
use App\Models\NewsPost;
use App\Models\PortfolioProject;
use App\Models\SiteLink;
use App\Models\SiteService;
use App\Services\SettingService;
use Inertia\Inertia;

/**
 * BITAC's public website — no authentication anywhere in here.
 *
 * It began as one page listing portfolio projects. It is now the corporate
 * site: about, products, clients, news & events, photo and video galleries,
 * important links and contact. Most of it is drawn from records the system
 * already keeps — projects from `portfolio_projects`, clients from
 * `customers`, the address and phone from the centre's own letterhead — so the
 * site cannot drift away from what the office actually does.
 *
 * ⚠️ Routes are mounted under `/portfolio` and the LITERAL sections must be
 * registered BEFORE `/portfolio/{slug}`, or `/portfolio/about` binds "about"
 * as a project slug and 404s. (Fifth time in this codebase; see the
 * receivables PDF, the PCD release routes and work-orders/create.)
 */
class PortfolioPublicController extends Controller
{
    /** How many customers' names a visitor can usefully read at once. */
    private const CLIENT_WALL = 24;

    // ── Pages ────────────────────────────────────────────────────────────

    public function index()
    {
        return Inertia::render('Portfolio/Public/Home', $this->chrome([
            'featured'   => $this->projects()->take(6),
            'news'       => $this->newsRows(NewsPost::live()->latest('published_at')->take(3)->get()),
            'events'     => $this->newsRows(
                NewsPost::live()->where('kind', 'event')
                    ->whereNotNull('event_date')->where('event_date', '>=', today())
                    ->orderBy('event_date')->take(3)->get()
            ),
            'services'   => $this->serviceRows(SiteService::active()->orderBy('sort')->orderBy('id')->take(4)->get()),
            'photos'     => $this->galleryRows(GalleryItem::active()->photos()->orderBy('sort')->latest('id')->take(8)->get()),
            'clients'    => $this->clientNames(12),
            'stats'      => $this->stats(),
        ]));
    }

    public function about()
    {
        return Inertia::render('Portfolio/Public/About', $this->chrome([
            'stats'    => $this->stats(),
            'centres'  => Center::where('is_active', true)->orderBy('id')
                ->get(['id', 'name', 'name_bn', 'address', 'address_bn', 'phone', 'phone_bn', 'email'])
                ->map(fn ($c) => [
                    'name'    => $c->name_bn ?: $c->name,
                    'sub'     => $c->name_bn ? $c->name : null,
                    'address' => $c->address_bn ?: $c->address,
                    'phone'   => $c->phone_bn ?: $c->phone,
                    'email'   => $c->email,
                ])->values(),
        ]));
    }

    /** What BITAC does — the service lines, as opposed to individual products. */
    public function services()
    {
        return Inertia::render('Portfolio/Public/Services', $this->chrome([
            'services' => $this->serviceRows(
                SiteService::active()->orderBy('sort')->orderBy('id')->get()
            ),
            'stats' => $this->stats(),
        ]));
    }

    /** What BITAC makes — the portfolio projects, filterable by capability. */
    public function products()
    {
        $projects = $this->projects();

        return Inertia::render('Portfolio/Public/Products', $this->chrome([
            'projects'   => $projects,
            'categories' => $projects->pluck('category')->filter()->unique()->values(),
        ]));
    }

    public function clients()
    {
        return Inertia::render('Portfolio/Public/Clients', $this->chrome([
            'clients' => $this->clientNames(null),
            'stats'   => $this->stats(),
        ]));
    }

    public function news()
    {
        return Inertia::render('Portfolio/Public/News', $this->chrome([
            'posts' => $this->newsRows(
                NewsPost::live()->orderByDesc('published_at')->orderByDesc('id')->take(60)->get()
            ),
        ]));
    }

    public function newsShow(string $slug)
    {
        $post = NewsPost::live()->where('slug', $slug)->firstOrFail();

        return Inertia::render('Portfolio/Public/NewsShow', $this->chrome([
            'post'  => [
                'title'      => $post->title,
                'kind'       => $post->kind,
                'excerpt'    => $post->excerpt,
                'body'       => $post->body,
                'cover_url'  => $post->cover_url,
                'event_date' => $post->event_date?->format('d M Y'),
                'location'   => $post->location,
                'published'  => $post->published_at?->format('d M Y'),
            ],
            'more' => $this->newsRows(
                NewsPost::live()->where('id', '!=', $post->id)
                    ->orderByDesc('published_at')->take(4)->get()
            ),
        ]));
    }

    public function gallery()
    {
        $photos = GalleryItem::active()->photos()->orderBy('sort')->latest('id')->get();

        return Inertia::render('Portfolio/Public/Gallery', $this->chrome([
            'photos' => $this->galleryRows($photos),
            'albums' => $photos->pluck('album')->filter()->unique()->values(),
        ]));
    }

    public function videos()
    {
        return Inertia::render('Portfolio/Public/Videos', $this->chrome([
            'videos' => $this->galleryRows(
                GalleryItem::active()->videos()->orderBy('sort')->latest('id')->get()
            ),
        ]));
    }

    public function contact()
    {
        return Inertia::render('Portfolio/Public/Contact', $this->chrome([
            'centres' => Center::where('is_active', true)->orderBy('id')
                ->get(['id', 'name', 'name_bn', 'address', 'address_bn', 'phone', 'phone_bn', 'email'])
                ->map(fn ($c) => [
                    'name'    => $c->name_bn ?: $c->name,
                    'sub'     => $c->name_bn ? $c->name : null,
                    'address' => $c->address_bn ?: $c->address,
                    'phone'   => $c->phone_bn ?: $c->phone,
                    'email'   => $c->email,
                ])->values(),
        ]));
    }

    /** A single project. ⚠️ Registered LAST — it swallows any path under /portfolio. */
    public function show(string $slug)
    {
        $project = PortfolioProject::where('slug', $slug)->where('is_published', true)->firstOrFail();
        $project->load('photos');

        return Inertia::render('Portfolio/Public/Show', $this->chrome([
            'project' => [
                'id'              => $project->id,
                'slug'            => $project->slug,
                'title'           => $project->title,
                'client_name'     => $project->client_name,
                'category'        => $project->category,
                'summary'         => $project->summary,
                'description'     => $project->description,
                'specs'           => $project->specs ?? [],
                'completed_at'    => $project->completed_at?->format('d F Y'),
                'cover_image_url' => $project->cover_image_url,
                'photos'          => $project->photos->map(fn ($f) => [
                    'id' => $f->id, 'url' => $f->url, 'caption' => $f->caption,
                ])->values(),
            ],
            'related' => PortfolioProject::where('is_published', true)
                ->where('id', '!=', $project->id)
                ->when($project->category, fn ($q) => $q->where('category', $project->category))
                ->latest('completed_at')->take(3)->get()
                ->map(fn ($p) => [
                    'slug' => $p->slug, 'title' => $p->title,
                    'client_name' => $p->client_name, 'cover_image_url' => $p->cover_image_url,
                ])->values(),
        ]));
    }

    // ── Shared shape ─────────────────────────────────────────────────────

    /**
     * Everything the chrome needs, on every page.
     *
     * ⚠️ One place, because a footer that carries the contact details on the
     * home page and not on the news page is how a site starts looking broken.
     */
    private function chrome(array $props): array
    {
        return array_merge($props, [
            'bitac' => $this->bitacInfo(),
            'site'  => $this->siteText(),
            'links' => SiteLink::active()->orderBy('group')->orderBy('sort')->get()
                ->groupBy('group')
                ->map(fn ($g) => $g->map(fn ($l) => ['label' => $l->label, 'url' => $l->url])->values()),
        ]);
    }

    /** Editable copy, from the existing settings store — strings, not rows. */
    private function siteText(): array
    {
        $s = app(SettingService::class);

        return [
            'hero_title'    => $s->get('site_hero_title', 'Engineering precision for Bangladesh\'s industry.'),
            'hero_subtitle' => $s->get('site_hero_subtitle', 'BITAC has delivered import-substitute manufacturing, training, testing and R&D to Railway, BPDB, Petrobangla, sugar mills and private industry for over six decades.'),
            'about_lead'    => $s->get('site_about_lead', 'Bangladesh Industrial Technical Assistance Centre (BITAC) is an autonomous body under the Ministry of Industries, serving the country\'s industry since 1962.'),
            'about_body'    => $s->get('site_about_body', ''),
            'mission'       => $s->get('site_mission', 'To support the nation\'s industrialisation through skilled manpower, import-substitute manufacturing and reliable technical services.'),
            'map_embed'     => $s->get('site_map_embed', ''),
        ];
    }

    /** @return \Illuminate\Support\Collection<int,array> */
    private function projects()
    {
        return PortfolioProject::where('is_published', true)
            ->orderBy('display_order')->orderByDesc('completed_at')->get()
            ->map(fn ($p) => [
                'id'              => $p->id,
                'slug'            => $p->slug,
                'title'           => $p->title,
                'client_name'     => $p->client_name,
                'category'        => $p->category,
                'summary'         => $p->summary,
                'completed_at'    => $p->completed_at?->format('M Y'),
                'cover_image_url' => $p->cover_image_url,
            ])->values();
    }

    private function serviceRows($services)
    {
        return $services->map(fn ($x) => [
            'id'         => $x->id,
            'title'      => $x->title,
            'summary'    => $x->summary,
            'body'       => $x->body,
            'icon_class' => $x->icon_class,
            'image_url'  => $x->image_url,
        ])->values();
    }

    private function newsRows($posts)
    {
        return $posts->map(fn ($p) => [
            'slug'       => $p->slug,
            'title'      => $p->title,
            'kind'       => $p->kind,
            'excerpt'    => $p->excerpt,
            'cover_url'  => $p->cover_url,
            'event_date' => $p->event_date?->format('d M Y'),
            'location'   => $p->location,
            'published'  => $p->published_at?->format('d M Y'),
        ])->values();
    }

    private function galleryRows($items)
    {
        return $items->map(fn ($g) => [
            'id'        => $g->id,
            'kind'      => $g->kind,
            'title'     => $g->title,
            'caption'   => $g->caption,
            'album'     => $g->album,
            'image_url' => $g->image_url,
            'embed_url' => $g->embed_url,
            'thumb_url' => $g->thumb_url,
            'taken_on'  => $g->taken_on?->format('M Y'),
        ])->values();
    }

    /**
     * Who BITAC works for.
     *
     * ⚠️ Names only — no contact details, no job figures. This is a public
     * page, and a client list that leaks what each one spent would be a
     * different document entirely.
     */
    private function clientNames(?int $limit)
    {
        return Customer::where('is_active', true)
            ->orderBy('name')
            ->when($limit, fn ($q) => $q->take($limit))
            ->when(! $limit, fn ($q) => $q->take(self::CLIENT_WALL * 4))
            ->get(['id', 'name', 'customer_type'])
            ->map(fn ($c) => [
                'name' => $c->name,
                'type' => $c->customer_type === 'government' ? 'Government'
                    : ($c->customer_type === 'private' ? 'Private' : null),
            ])->values();
    }

    private function stats(): array
    {
        return [
            'years'    => max(1, now()->year - 1962),
            'projects' => PortfolioProject::where('is_published', true)->count(),
            'clients'  => Customer::where('is_active', true)->count(),
            'centres'  => Center::where('is_active', true)->count(),
        ];
    }

    /**
     * The HQ letterhead, which is where the public site's address, phone and
     * logos come from — so the website and the printed page cannot disagree.
     */
    private function bitacInfo(): array
    {
        $center = Center::find(1) ?? Center::first();
        if (! $center) return [];

        return [
            'name_bn'       => $center->name_bn,
            'name_en'       => $center->name ?? 'BITAC',
            'caption'       => $center->caption_en,
            'ministry_bn'   => $center->ministry_bn,
            'government_bn' => $center->government_bn,
            'address_bn'    => $center->address_bn,
            'address'       => $center->address,
            'phone_bn'      => $center->phone_bn,
            'phone'         => $center->phone,
            'email'         => $center->email,
            'website'       => $center->website,
            'logo_left'     => $center->logo_left_url,
            'logo_right'    => $center->logo_right_url,
        ];
    }
}
