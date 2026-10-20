<?php

namespace App\Http\Controllers\Portfolio;

use App\Http\Controllers\Controller;
use App\Models\Center;
use App\Models\Customer;
use App\Models\GalleryItem;
use App\Models\HeroSlide;
use App\Models\NewsPost;
use App\Models\Partner;
use App\Models\PortfolioProject;
use App\Models\SiteLink;
use App\Models\SiteOffice;
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

    /**
     * The About paragraphs the home and About pages open with.
     *
     * ⚠️ A DEFAULT, not fixed copy — everything here is editable at
     * Admin → Website → Site text, and the moment anything is typed there this
     * is never seen again. It exists so the page reads as a finished site on
     * the day it goes up rather than as two lines over a lot of white space.
     * Blank paragraphs are split on the empty line between them.
     */
    private const ABOUT_BODY = <<<'TXT'
        Established in 1962, BITAC was set up to give the country's industry something it could not buy in: the means to make its own spare parts, train its own technicians and prove its own materials. Six decades on, that is still the work. Our shops take a drawing, a sample or a broken component and return a part made to specification — and where no drawing exists, our engineers reverse-engineer one.

        We work from six centres — Dhaka, Chittagong, Chandpur, Khulna, Bogra and the Tool & Technology Institute — each serving the industry around it. Bangladesh Railway, the Power Development Board, the Water Development Board, the sugar mills and a long list of private manufacturers bring us work that would otherwise be imported, and wait on a ship.

        Every job runs the same route whoever the client is: an enquiry is costed part by part, quoted formally, planned and routed through the shops, inspected before it leaves, and delivered with a challan and a bill. Nothing is priced by guess, and the figures behind a quotation can be shown on request.
        TXT;

    // ── Pages ────────────────────────────────────────────────────────────

    public function index()
    {
        return Inertia::render('Portfolio/Public/Home', $this->chrome([
            'slides'     => $this->heroSlides(),
            'featured'   => $this->projects()->take(6),
            // ⚠️ Events are excluded here because they have a column of their
            // own beside the news. Left in, an upcoming event showed twice in
            // the one section — once as a story, once in the diary.
            'news'       => $this->newsRows(
                NewsPost::live()->where('kind', '!=', 'event')
                    ->orderByDesc('published_at')->orderByDesc('id')->take(4)->get()
            ),
            'events'     => $this->newsRows(
                NewsPost::live()->where('kind', 'event')
                    ->whereNotNull('event_date')->where('event_date', '>=', today())
                    ->orderBy('event_date')->take(3)->get()
            ),
            'services'   => $this->serviceRows(SiteService::active()->orderBy('sort')->orderBy('id')->take(4)->get()),
            'photos'     => $this->galleryRows(GalleryItem::active()->photos()->orderBy('sort')->latest('id')->take(8)->get()),
            'clients'    => $this->clientNames(40),
            'partners'   => $this->partnerRows(),
            'stats'      => $this->stats(),
        ]));
    }

    public function about()
    {
        return Inertia::render('Portfolio/Public/About', $this->chrome([
            'stats'    => $this->stats(),
            // ⚠️ From the offices, not `centers` — the PMS only knows the
            // centres it runs, and Chattogram, Chandpur, Khulna and Bogura
            // are not in it. The About page listed one centre because of that.
            'centres'  => $this->officeRows()->map(fn ($o) => [
                'slug'    => $o['slug'],
                'name'    => $o['name'],
                'sub'     => $o['is_head_office'] ? 'Head office' : null,
                'address' => $o['address'],
                'phone'   => $o['phone'],
                'email'   => $o['email'],
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
            'clients'  => $this->clientNames(null),
            'partners' => $this->partnerRows(),
            'stats'    => $this->stats(),
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
            'offices' => $this->officeRows(),
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
            // The footer's "What we do" column. Titles only — four rows, on
            // every page, so it stays a list of names rather than a payload.
            'footer_services' => SiteService::active()->orderBy('sort')->orderBy('id')
                ->get(['id', 'title'])->map(fn ($x) => ['id' => $x->id, 'title' => $x->title])->values(),
        ]);
    }

    /** Editable copy, from the existing settings store — strings, not rows. */
    private function siteText(): array
    {
        return [
            'hero_title'    => self::text('site_hero_title', 'Engineering precision for Bangladesh\'s industry.'),
            'hero_subtitle' => self::text('site_hero_subtitle', 'BITAC has delivered import-substitute manufacturing, training, testing and R&D to Railway, BPDB, Petrobangla, sugar mills and private industry for over six decades.'),
            'about_lead'    => self::text('site_about_lead', 'Bangladesh Industrial Technical Assistance Centre (BITAC) is an autonomous body under the Ministry of Industries, serving the country\'s industry since 1962.'),
            'about_body'    => self::text('site_about_body', self::ABOUT_BODY),
            'mission'       => self::text('site_mission', 'To support the nation\'s industrialisation through skilled manpower, import-substitute manufacturing and reliable technical services.'),
        ];
    }

    /**
     * ⚠️ A BLANK setting falls back to the default, not to blank.
     *
     * `SettingService::get()`'s default only applies when the key is missing,
     * and clearing a field in Admin → Website stores an empty string — so the
     * key exists and the fallback never fired. The home page's headline and
     * sub-headline simply vanished, leaving a hero with nothing in it.
     */
    private static function text(string $key, string $default): string
    {
        $value = trim((string) app(SettingService::class)->get($key, ''));

        return $value !== '' ? $value : $default;
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

    /**
     * The hero slide show.
     *
     * ⚠️ A slide with no media is filtered out here as well as refused on
     * save. One is a full-screen black rectangle at the top of BITAC's front
     * page, so it is worth catching twice.
     */
    private function heroSlides()
    {
        return HeroSlide::active()->orderBy('sort')->orderBy('id')->get()
            ->filter(fn ($s) => $s->hasMedia())
            ->map(fn ($s) => [
                'id'         => $s->id,
                'kind'       => $s->kind,
                'image_url'  => $s->image_url,
                'video_src'  => $s->video_src,
                'embed_url'  => $s->youtube_embed,
                'poster_url' => $s->poster_url,
                'hold_ms'    => $s->hold_ms,
                'title'      => $s->title,
                'subtitle'   => $s->subtitle,
                'cta_label'  => $s->cta_label,
                'cta_url'    => $s->cta_url,
                'credit'     => $s->credit,
                'credit_url' => $s->credit_url,
            ])->values();
    }

    /**
     * The logo wall.
     *
     * ⚠️ A row with no logo is filtered out here as well as refused on save —
     * on a wall of logos it would be a name floating in an empty box.
     */
    private function partnerRows()
    {
        return Partner::active()->orderBy('sort')->orderBy('name')->get()
            ->filter(fn ($p) => $p->hasLogo())
            ->map(fn ($p) => [
                'id'       => $p->id,
                'name'     => $p->name,
                'kind'     => $p->kind,
                'kind_label' => $p->kind_label,
                'logo_url' => $p->logo_url,
                'url'      => $p->url,
                'note'     => $p->note,
            ])->values();
    }

    /**
     * BITAC's offices with their contact persons, head office first.
     *
     * Each office's blank fields fall back to its linked centre's letterhead
     * (`shown_*`), so Dhaka's address is kept in one place.
     */
    private function officeRows()
    {
        return SiteOffice::active()
            ->with(['center', 'contacts' => fn ($q) => $q->where('is_active', true)])
            ->orderByDesc('is_head_office')->orderBy('sort')->orderBy('id')
            ->get()
            ->map(fn ($o) => [
                'id'             => $o->id,
                'slug'           => $o->slug,
                'name'           => $o->name,
                'address'        => $o->shown_address,
                'phone'          => $o->shown_phone,
                'fax'            => $o->fax,
                'email'          => $o->shown_email,
                'is_head_office' => $o->is_head_office,
                'map_embed_url'  => $o->map_embed_url,
                'map_link'       => $o->map_link,
                'contacts'       => $o->contacts->map(fn ($c) => [
                    'id'          => $c->id,
                    'name'        => $c->name,
                    'designation' => $c->designation,
                    'phone'       => $c->phone,
                    'mobile'      => $c->mobile,
                    'email'       => $c->email,
                ])->values(),
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
            ->get(['id', 'name', 'customer_type'])
            // ⚠️ One name once. Customers are records, not organisations —
            // the same company can sit in the table twice (two contacts, two
            // centres), and on the public page it read "ACI Motors, ACI
            // Motors". Deduped on the trimmed, case-folded name, and BEFORE
            // the limit, so the limit counts organisations rather than rows.
            ->unique(fn ($c) => mb_strtolower(trim($c->name)))
            ->take($limit ?: self::CLIENT_WALL * 4)
            ->map(fn ($c) => [
                'name' => trim($c->name),
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
            // ⚠️ The offices, not the PMS centres: the PMS runs only Dhaka so
            // far, and the public site said "1 centre nationwide" because of
            // it. Falls back to the centre count before any office exists.
            'centres'  => SiteOffice::active()->count() ?: Center::where('is_active', true)->count(),
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
