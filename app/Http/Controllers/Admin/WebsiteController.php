<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\GalleryItem;
use App\Models\HeroSlide;
use App\Models\NewsPost;
use App\Models\Partner;
use App\Models\Center;
use App\Models\SiteLink;
use App\Models\SiteOffice;
use App\Models\SiteOfficeContact;
use App\Models\SiteService;
use App\Services\SettingService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Inertia\Inertia;

/**
 * Admin → Website: everything on BITAC's public site that isn't already a
 * record the system keeps.
 *
 * The site draws products from `portfolio_projects`, clients from `customers`
 * and the address from the centre's letterhead — all of which are maintained
 * elsewhere and must not be retyped here. What's left is the copy, the news,
 * the galleries and the links, and this is the one screen for them.
 *
 * ⚠️ There is no English/Bangla pair anywhere (BITAC): one field per thing,
 * holding whatever language it was typed in. Don't add `*_bn` columns.
 */
class WebsiteController extends Controller
{
    /** The editable copy on the public site. Keys are `site_*` in `settings`. */
    private const TEXT_KEYS = [
        'site_hero_title', 'site_hero_subtitle', 'site_about_lead',
        'site_about_body', 'site_mission',
    ];

    public function index(Request $request)
    {
        $s = app(SettingService::class);

        return Inertia::render('Admin/Website/Index', [
            'tab'  => in_array($request->input('tab'), ['hero', 'text', 'services', 'partners', 'offices', 'news', 'gallery', 'videos', 'links'], true)
                ? $request->input('tab') : 'text',
            'text' => collect(self::TEXT_KEYS)->mapWithKeys(fn ($k) => [$k => (string) $s->get($k, '')])->all(),
            'hero' => HeroSlide::orderBy('sort')->orderBy('id')->get()
                ->map(fn ($s) => [
                    'id'         => $s->id,
                    'kind'       => $s->kind,
                    'image_url'  => $s->image_url,
                    'video_src'  => $s->video_src,
                    'embed_url'  => $s->youtube_embed,
                    'video_url'  => $s->video_url,
                    'poster_url' => $s->poster_url,
                    'hold_seconds' => $s->hold_seconds,
                    'title'      => $s->title,
                    'subtitle'   => $s->subtitle,
                    'cta_label'  => $s->cta_label,
                    'cta_url'    => $s->cta_url,
                    'credit'     => $s->credit,
                    'credit_url' => $s->credit_url,
                    'sort'       => $s->sort,
                    'is_active'  => $s->is_active,
                    'has_media'  => $s->hasMedia(),
                ])->values(),
            'services' => SiteService::orderBy('sort')->orderBy('id')->get()
                ->map(fn ($x) => [
                    'id'        => $x->id,
                    'title'     => $x->title,
                    'summary'   => $x->summary,
                    'body'      => $x->body,
                    'icon'      => $x->icon,
                    'image_url' => $x->image_url,
                    'sort'      => $x->sort,
                    'is_active' => $x->is_active,
                ])->values(),
            'partners' => Partner::orderBy('sort')->orderBy('name')->get()
                ->map(fn ($p) => [
                    'id'        => $p->id,
                    'name'      => $p->name,
                    'kind'      => $p->kind,
                    'logo_url'  => $p->logo_url,
                    'url'       => $p->url,
                    'note'      => $p->note,
                    'sort'      => $p->sort,
                    'is_active' => $p->is_active,
                    'has_logo'  => $p->hasLogo(),
                ])->values(),
            'offices' => SiteOffice::with(['center', 'contacts'])
                ->orderByDesc('is_head_office')->orderBy('sort')->orderBy('id')->get()
                ->map(fn ($o) => [
                    'id' => $o->id, 'slug' => $o->slug, 'name' => $o->name, 'center_id' => $o->center_id,
                    'center_name' => $o->center?->name,
                    'address' => $o->address, 'phone' => $o->phone, 'fax' => $o->fax, 'email' => $o->email,
                    // What the public page will actually show, letterhead
                    // fallbacks included — so a blank field is not mistaken
                    // for a missing one.
                    'shown_address' => $o->shown_address, 'shown_phone' => $o->shown_phone, 'shown_email' => $o->shown_email,
                    'map_query' => $o->map_query, 'latitude' => $o->latitude, 'longitude' => $o->longitude,
                    'map_link' => $o->map_link,
                    'is_head_office' => $o->is_head_office, 'sort' => $o->sort, 'is_active' => $o->is_active,
                    'contacts' => $o->contacts->map(fn ($c) => [
                        'id' => $c->id, 'name' => $c->name, 'designation' => $c->designation,
                        'phone' => $c->phone, 'mobile' => $c->mobile, 'email' => $c->email,
                        'sort' => $c->sort, 'is_active' => $c->is_active,
                    ])->values(),
                ])->values(),
            // Centres an office may link to, for its letterhead fallbacks.
            'office_centers' => Center::withoutGlobalScopes()->orderBy('id')->get(['id', 'name'])
                ->map(fn ($c) => ['id' => $c->id, 'name' => $c->name])->values(),
            'news' => NewsPost::orderByDesc('published_at')->orderByDesc('id')->get()
                ->map(fn ($p) => [
                    'id'           => $p->id,
                    'title'        => $p->title,
                    'slug'         => $p->slug,
                    'kind'         => $p->kind,
                    'excerpt'      => $p->excerpt,
                    'cover_url'    => $p->cover_url,
                    'event_date'   => $p->event_date?->format('Y-m-d'),
                    'location'     => $p->location,
                    'published_at' => $p->published_at?->format('Y-m-d'),
                    'is_published' => $p->is_published,
                ])->values(),
            'gallery' => $this->galleryRows('photo'),
            'videos'  => $this->galleryRows('video'),
            'links'   => SiteLink::orderBy('group')->orderBy('sort')->orderBy('id')->get()
                ->map(fn ($l) => [
                    'id'        => $l->id,
                    'label'     => $l->label,
                    'url'       => $l->url,
                    'group'     => $l->group,
                    'sort'      => $l->sort,
                    'is_active' => $l->is_active,
                ])->values(),
            'albums' => GalleryItem::whereNotNull('album')->distinct()->orderBy('album')->pluck('album'),
            'kinds'  => NewsPost::KINDS,
            'groups' => SiteLink::GROUPS,
            'partner_kinds' => collect(Partner::KINDS)->map(fn ($label, $key) => ['key' => $key, 'label' => $label])->values(),
            'icons'  => collect(SiteService::ICONS)->map(fn ($cls, $key) => ['key' => $key, 'class' => $cls])->values(),
        ]);
    }

    // ── Editable copy ────────────────────────────────────────────────────

    public function updateText(Request $request)
    {
        $data = $request->validate([
            'site_hero_title'    => 'nullable|string|max:255',
            'site_hero_subtitle' => 'nullable|string|max:1000',
            'site_about_lead'    => 'nullable|string|max:1000',
            'site_about_body'    => 'nullable|string|max:20000',
            'site_mission'       => 'nullable|string|max:1000',
        ]);

        $s = app(SettingService::class);
        foreach (self::TEXT_KEYS as $key) {
            $s->set($key, (string) ($data[$key] ?? ''));
        }

        return back()->with('success', 'Website text updated.');
    }

    // ── News, events, notices, tenders ───────────────────────────────────

    public function newsCreate()
    {
        return Inertia::render('Admin/Website/NewsForm', [
            'post'  => null,
            'kinds' => NewsPost::KINDS,
        ]);
    }

    public function newsEdit(NewsPost $post)
    {
        return Inertia::render('Admin/Website/NewsForm', [
            'post' => [
                'id'           => $post->id,
                'title'        => $post->title,
                'kind'         => $post->kind,
                'excerpt'      => $post->excerpt,
                'body'         => $post->body,
                'cover_url'    => $post->cover_url,
                'event_date'   => $post->event_date?->format('Y-m-d'),
                'location'     => $post->location,
                'published_at' => $post->published_at?->format('Y-m-d'),
                'is_published' => $post->is_published,
                'sort'         => $post->sort,
            ],
            'kinds' => NewsPost::KINDS,
        ]);
    }

    public function newsStore(Request $request)
    {
        $data = $this->validateNews($request);

        $post = NewsPost::create($this->newsAttributes($data, $request) + [
            'slug'       => NewsPost::slugFor($data['title']),
            'created_by' => auth()->id(),
        ]);

        return redirect()->route('admin.website.index', ['tab' => 'news'])
            ->with('success', $post->is_published ? 'Post published.' : 'Post saved as a draft.');
    }

    public function newsUpdate(Request $request, NewsPost $post)
    {
        $data = $this->validateNews($request);
        $attrs = $this->newsAttributes($data, $request, $post);

        // ⚠️ The slug only follows the title while nothing links to the post
        // yet. Once it is published its URL is out in the world — in an email,
        // in someone's bookmarks — and renaming it breaks every one of them.
        if (! $post->is_published) {
            $attrs['slug'] = NewsPost::slugFor($data['title'], $post->id);
        }

        $post->update($attrs);

        return redirect()->route('admin.website.index', ['tab' => 'news'])
            ->with('success', 'Post updated.');
    }

    public function newsDestroy(NewsPost $post)
    {
        if ($post->cover_image_path) {
            Storage::disk('public')->delete($post->cover_image_path);
        }
        $post->delete();

        return redirect()->route('admin.website.index', ['tab' => 'news'])
            ->with('success', 'Post deleted.');
    }

    // ── Photo & video gallery ────────────────────────────────────────────

    public function galleryStore(Request $request)
    {
        $data = $request->validate([
            'kind'      => 'required|in:photo,video',
            'title'     => 'nullable|string|max:255',
            'caption'   => 'nullable|string|max:1000',
            'album'     => 'nullable|string|max:120',
            'taken_on'  => 'nullable|date',
            'sort'      => 'nullable|integer|min:0|max:9999',
            // A photo needs a file; a video needs a link. Neither is optional
            // for its own kind, or the row renders as an empty tile.
            'image'     => 'nullable|image|max:8192',
            'video_url' => 'nullable|url|max:500',
        ]);

        if ($data['kind'] === 'photo' && ! $request->hasFile('image')) {
            return back()->with('error', 'A photo needs an image file.');
        }
        if ($data['kind'] === 'video' && empty($data['video_url'])) {
            return back()->with('error', 'A video needs a link (YouTube, Vimeo or an embed URL).');
        }

        GalleryItem::create([
            'kind'       => $data['kind'],
            'title'      => $data['title'] ?? null,
            'caption'    => $data['caption'] ?? null,
            'album'      => $data['album'] ?? null,
            'taken_on'   => $data['taken_on'] ?? null,
            'sort'       => (int) ($data['sort'] ?? 0),
            'is_active'  => true,
            'image_path' => $request->hasFile('image')
                ? $request->file('image')->store('website/gallery', 'public') : null,
            'video_url'  => $data['video_url'] ?? null,
            'created_by' => auth()->id(),
        ]);

        return redirect()->route('admin.website.index', ['tab' => $data['kind'] === 'video' ? 'videos' : 'gallery'])
            ->with('success', $data['kind'] === 'video' ? 'Video added.' : 'Photo added.');
    }

    public function galleryUpdate(Request $request, GalleryItem $item)
    {
        $data = $request->validate([
            'title'     => 'nullable|string|max:255',
            'caption'   => 'nullable|string|max:1000',
            'album'     => 'nullable|string|max:120',
            'taken_on'  => 'nullable|date',
            'sort'      => 'nullable|integer|min:0|max:9999',
            'is_active' => 'boolean',
            'video_url' => 'nullable|url|max:500',
        ]);

        $item->update([
            'title'     => $data['title'] ?? null,
            'caption'   => $data['caption'] ?? null,
            'album'     => $data['album'] ?? null,
            'taken_on'  => $data['taken_on'] ?? null,
            'sort'      => (int) ($data['sort'] ?? 0),
            'is_active' => $request->boolean('is_active'),
            // A photo's video_url stays null — don't let an edit of one kind
            // write the other kind's media field.
            'video_url' => $item->kind === 'video' ? ($data['video_url'] ?? $item->video_url) : null,
        ]);

        return back()->with('success', 'Saved.');
    }

    public function galleryDestroy(GalleryItem $item)
    {
        if ($item->image_path) {
            Storage::disk('public')->delete($item->image_path);
        }
        $kind = $item->kind;
        $item->delete();

        return redirect()->route('admin.website.index', ['tab' => $kind === 'video' ? 'videos' : 'gallery'])
            ->with('success', $kind === 'video' ? 'Video removed.' : 'Photo removed.');
    }

    // ── Hero slides ──────────────────────────────────────────────────────

    public function heroStore(Request $request)
    {
        $data = $this->validateHero($request);

        $slide = new HeroSlide($this->heroAttributes($data, $request) + ['created_by' => auth()->id()]);

        // ⚠️ A slide with no media is a full-screen black rectangle at the top
        // of the front page. Refused, with a redirect and a flash, never an
        // abort().
        if (! $slide->hasMedia()) {
            return back()->with('error', match ($data['kind']) {
                'video'   => 'A video slide needs a video file or a direct video link.',
                // ⚠️ Says WHY, because a perfectly good YouTube link that this
                // cannot read looks like the form silently losing it.
                'youtube' => 'That does not look like a YouTube link — paste the address of the video page, e.g. https://www.youtube.com/watch?v=…',
                default   => 'An image slide needs an image.',
            });
        }

        $slide->save();

        return redirect()->route('admin.website.index', ['tab' => 'hero'])
            ->with('success', 'Slide added.');
    }

    public function heroUpdate(Request $request, HeroSlide $slide)
    {
        $data = $this->validateHero($request);
        $attrs = $this->heroAttributes($data, $request, $slide);

        $probe = (clone $slide)->fill($attrs);
        if (! $probe->hasMedia()) {
            return back()->with('error', 'That would leave the slide with nothing to show.');
        }

        $slide->update($attrs);

        return back()->with('success', 'Slide updated.');
    }

    public function heroDestroy(HeroSlide $slide)
    {
        foreach ([$slide->image_path, $slide->video_path, $slide->poster_path] as $path) {
            if ($path) {
                Storage::disk('public')->delete($path);
            }
        }
        $slide->delete();

        return redirect()->route('admin.website.index', ['tab' => 'hero'])
            ->with('success', 'Slide removed.');
    }

    // ── Partners & collaborators ─────────────────────────────────────────

    public function partnerStore(Request $request)
    {
        $data = $this->validatePartner($request);

        if (! $request->hasFile('logo')) {
            return back()->with('error', 'A partner needs a logo — that is the whole of this section.');
        }

        Partner::create($this->partnerAttributes($data, $request) + ['created_by' => auth()->id()]);

        return redirect()->route('admin.website.index', ['tab' => 'partners'])
            ->with('success', 'Partner added.');
    }

    public function partnerUpdate(Request $request, Partner $partner)
    {
        $partner->update($this->partnerAttributes($this->validatePartner($request), $request, $partner));

        return back()->with('success', 'Partner updated.');
    }

    public function partnerDestroy(Partner $partner)
    {
        if ($partner->logo_path) {
            Storage::disk('public')->delete($partner->logo_path);
        }
        $partner->delete();

        return redirect()->route('admin.website.index', ['tab' => 'partners'])
            ->with('success', 'Partner removed.');
    }

    // ── Offices & contact persons ────────────────────────────────────────

    public function officeStore(Request $request)
    {
        $data = $this->validateOffice($request);
        $office = SiteOffice::create($this->officeAttributes($data, $request));
        $this->onlyOneHeadOffice($office);

        return redirect()->route('admin.website.index', ['tab' => 'offices'])->with('success', 'Office added.');
    }

    public function officeUpdate(Request $request, SiteOffice $office)
    {
        $office->update($this->officeAttributes($this->validateOffice($request, $office), $request, $office));
        $this->onlyOneHeadOffice($office);

        return back()->with('success', 'Office updated.');
    }

    public function officeDestroy(SiteOffice $office)
    {
        // Its contact persons go with it (cascade).
        $office->delete();

        return redirect()->route('admin.website.index', ['tab' => 'offices'])->with('success', 'Office removed.');
    }

    public function contactStore(Request $request, SiteOffice $office)
    {
        $office->contacts()->create($this->validateContact($request) + [
            'is_active' => $request->boolean('is_active', true),
        ]);

        return back()->with('success', 'Contact person added.');
    }

    public function contactUpdate(Request $request, SiteOfficeContact $contact)
    {
        $contact->update($this->validateContact($request) + ['is_active' => $request->boolean('is_active')]);

        return back()->with('success', 'Contact person updated.');
    }

    public function contactDestroy(SiteOfficeContact $contact)
    {
        $contact->delete();

        return back()->with('success', 'Contact person removed.');
    }

    /**
     * ⚠️ Exactly one head office. Marking a second one quietly un-marks the
     * first, rather than refusing — the editor plainly meant to move it.
     */
    private function onlyOneHeadOffice(SiteOffice $office): void
    {
        if ($office->is_head_office) {
            SiteOffice::where('id', '!=', $office->id)->where('is_head_office', true)->update(['is_head_office' => false]);
        }
    }

    private function validateOffice(Request $request, ?SiteOffice $office = null): array
    {
        return $request->validate([
            'name'      => 'required|string|max:200',
            // The #anchor in /portfolio/contact#khulna — lower-case, no spaces.
            'slug'      => ['required', 'string', 'max:60', 'regex:/^[a-z0-9-]+$/',
                            \Illuminate\Validation\Rule::unique('site_offices', 'slug')->ignore($office?->id)],
            'center_id' => 'nullable|exists:centers,id',
            'address'   => 'nullable|string|max:1000',
            'phone'     => 'nullable|string|max:255',
            'fax'       => 'nullable|string|max:255',
            'email'     => 'nullable|email|max:255',
            'map_query' => 'nullable|string|max:255',
            // Both or neither — half a pin puts the marker in the sea.
            'latitude'  => 'nullable|numeric|between:-90,90|required_with:longitude',
            'longitude' => 'nullable|numeric|between:-180,180|required_with:latitude',
            'sort'      => 'nullable|integer|min:0|max:9999',
        ], [
            'slug.regex' => 'Use lower-case letters, digits and hyphens only, e.g. "khulna".',
        ]);
    }

    private function officeAttributes(array $data, Request $request, ?SiteOffice $office = null): array
    {
        $blank = fn ($k) => ($data[$k] ?? null) === '' ? null : ($data[$k] ?? null);

        return [
            'name'           => $data['name'],
            'slug'           => $data['slug'],
            'center_id'      => $blank('center_id'),
            'address'        => $blank('address'),
            'phone'          => $blank('phone'),
            'fax'            => $blank('fax'),
            'email'          => $blank('email'),
            'map_query'      => $blank('map_query'),
            'latitude'       => $blank('latitude'),
            'longitude'      => $blank('longitude'),
            'sort'           => (int) ($data['sort'] ?? 0),
            'is_head_office' => $request->boolean('is_head_office'),
            'is_active'      => $office ? $request->boolean('is_active') : $request->boolean('is_active', true),
        ];
    }

    private function validateContact(Request $request): array
    {
        $data = $request->validate([
            'name'        => 'nullable|string|max:200',
            'designation' => 'required|string|max:255',
            'phone'       => 'nullable|string|max:255',
            'mobile'      => 'nullable|string|max:255',
            'email'       => 'nullable|email|max:255',
            'sort'        => 'nullable|integer|min:0|max:9999',
        ]);

        return [
            'name'        => ($data['name'] ?? null) ?: null,
            'designation' => $data['designation'],
            'phone'       => ($data['phone'] ?? null) ?: null,
            'mobile'      => ($data['mobile'] ?? null) ?: null,
            'email'       => ($data['email'] ?? null) ?: null,
            'sort'        => (int) ($data['sort'] ?? 0),
        ];
    }

    // ── Services ─────────────────────────────────────────────────────────

    public function serviceStore(Request $request)
    {
        $data = $this->validateService($request);

        SiteService::create($this->serviceAttributes($data, $request) + ['created_by' => auth()->id()]);

        return redirect()->route('admin.website.index', ['tab' => 'services'])
            ->with('success', 'Service added.');
    }

    public function serviceUpdate(Request $request, SiteService $service)
    {
        $service->update($this->serviceAttributes($this->validateService($request), $request, $service));

        return back()->with('success', 'Service updated.');
    }

    public function serviceDestroy(SiteService $service)
    {
        if ($service->image_path) {
            Storage::disk('public')->delete($service->image_path);
        }
        $service->delete();

        return redirect()->route('admin.website.index', ['tab' => 'services'])
            ->with('success', 'Service removed.');
    }

    // ── Important links ──────────────────────────────────────────────────

    public function linkStore(Request $request)
    {
        $data = $this->validateLink($request);
        SiteLink::create($data + ['is_active' => $request->boolean('is_active', true)]);

        return redirect()->route('admin.website.index', ['tab' => 'links'])
            ->with('success', 'Link added.');
    }

    public function linkUpdate(Request $request, SiteLink $link)
    {
        $link->update($this->validateLink($request) + ['is_active' => $request->boolean('is_active')]);

        return back()->with('success', 'Link updated.');
    }

    public function linkDestroy(SiteLink $link)
    {
        $link->delete();

        return redirect()->route('admin.website.index', ['tab' => 'links'])
            ->with('success', 'Link removed.');
    }

    // ── Shared ───────────────────────────────────────────────────────────

    private function galleryRows(string $kind)
    {
        return GalleryItem::where('kind', $kind)->orderBy('sort')->orderByDesc('id')->get()
            ->map(fn ($g) => [
                'id'        => $g->id,
                'kind'      => $g->kind,
                'title'     => $g->title,
                'caption'   => $g->caption,
                'album'     => $g->album,
                'image_url' => $g->image_url,
                'video_url' => $g->video_url,
                'embed_url' => $g->embed_url,
                'thumb_url' => $g->thumb_url,
                'taken_on'  => $g->taken_on?->format('Y-m-d'),
                'sort'      => $g->sort,
                'is_active' => $g->is_active,
            ])->values();
    }

    private function validateNews(Request $request): array
    {
        return $request->validate([
            'title'        => 'required|string|max:255',
            'kind'         => 'required|in:' . implode(',', NewsPost::KINDS),
            'excerpt'      => 'nullable|string|max:500',
            'body'         => 'nullable|string|max:50000',
            'cover_image'  => 'nullable|image|max:8192',
            'event_date'   => 'nullable|date',
            'location'     => 'nullable|string|max:255',
            'published_at' => 'nullable|date',
            'sort'         => 'nullable|integer|min:0|max:9999',
        ]);
    }

    private function newsAttributes(array $data, Request $request, ?NewsPost $post = null): array
    {
        $attrs = [
            'title'        => $data['title'],
            'kind'         => $data['kind'],
            'excerpt'      => $data['excerpt'] ?? null,
            'body'         => $data['body'] ?? null,
            'event_date'   => $data['event_date'] ?? null,
            'location'     => $data['location'] ?? null,
            'is_published' => $request->boolean('is_published'),
            'sort'         => (int) ($data['sort'] ?? 0),
            // Publishing with no date means "now"; a date set by hand stands,
            // including one in the future, which is how a notice is scheduled.
            'published_at' => $data['published_at']
                ?? $post?->published_at
                ?? ($request->boolean('is_published') ? now() : null),
        ];

        if ($request->hasFile('cover_image')) {
            if ($post?->cover_image_path) {
                Storage::disk('public')->delete($post->cover_image_path);
            }
            $attrs['cover_image_path'] = $request->file('cover_image')->store('website/news', 'public');
        }

        return $attrs;
    }

    private function validateHero(Request $request): array
    {
        return $request->validate([
            'kind'      => 'required|in:image,video,youtube',
            'title'     => 'nullable|string|max:255',
            'subtitle'  => 'nullable|string|max:500',
            'cta_label' => 'nullable|string|max:80',
            'cta_url'   => 'nullable|string|max:500',
            // ⚠️ The licence's own condition for most free photos — see the
            // migration. Blank for BITAC's own pictures.
            'credit'     => 'nullable|string|max:255',
            'credit_url' => 'nullable|url|max:500',
            'sort'      => 'nullable|integer|min:0|max:9999',
            // How long the slide holds. A YouTube slide cannot tell us when it
            // has ended, so somebody has to say.
            'hold_seconds' => 'nullable|integer|min:2|max:600',
            'image'     => 'nullable|image|max:8192',
            'poster'    => 'nullable|image|max:8192',
            // ⚠️ A FILE, and only the two formats every browser plays. A
            // background video autoplays muted with no controls, which a
            // YouTube iframe will not do.
            'video'     => 'nullable|file|mimetypes:video/mp4,video/webm|max:65536',
            // Holds a direct .mp4 for a `video` slide and the page address for
            // a `youtube` one — one field, because they are alternatives. It
            // cannot be a plain `url` rule any more, since a YouTube id on its
            // own is accepted, so a `video` slide is checked on its own terms:
            // what goes into a <video src> has to be a real address.
            'video_url' => ['nullable', 'string', 'max:500', function ($attribute, $value, $fail) use ($request) {
                if ($request->input('kind') === 'video' && $value && ! filter_var($value, FILTER_VALIDATE_URL)) {
                    $fail('That needs to be a full address, e.g. https://example.org/clip.mp4');
                }
            }],
        ]);
    }

    private function heroAttributes(array $data, Request $request, ?HeroSlide $slide = null): array
    {
        $attrs = [
            'kind'      => $data['kind'],
            'title'     => $data['title'] ?? null,
            'subtitle'  => $data['subtitle'] ?? null,
            'cta_label' => $data['cta_label'] ?? null,
            'cta_url'   => $data['cta_url'] ?? null,
            'credit'     => ($data['credit'] ?? null) ?: null,
            'credit_url' => ($data['credit_url'] ?? null) ?: null,
            'sort'      => (int) ($data['sort'] ?? 0),
            'hold_seconds' => ($data['hold_seconds'] ?? null) ?: null,
            'is_active' => $slide ? $request->boolean('is_active') : $request->boolean('is_active', true),
        ];

        foreach ([['image', 'image_path', 'website/hero'],
                  ['poster', 'poster_path', 'website/hero'],
                  ['video', 'video_path', 'website/hero']] as [$field, $column, $dir]) {
            if ($request->hasFile($field)) {
                if ($slide?->{$column}) {
                    Storage::disk('public')->delete($slide->{$column});
                }
                $attrs[$column] = $request->file($field)->store($dir, 'public');
            }
        }

        // An uploaded file and a pasted link are alternatives, not a pair —
        // keep whichever was given and do not strand the other.
        if (array_key_exists('video_url', $data)) {
            $attrs['video_url'] = $data['video_url'] ?: null;
        }

        return $attrs;
    }

    private function validatePartner(Request $request): array
    {
        return $request->validate([
            'name' => 'required|string|max:200',
            'kind' => 'required|in:' . implode(',', array_keys(Partner::KINDS)),
            'url'  => 'nullable|url|max:500',
            'note' => 'nullable|string|max:255',
            'sort' => 'nullable|integer|min:0|max:9999',
            // A logo wall wants a transparent PNG or an SVG; anything the
            // browser can draw is accepted, kept small because a dozen of
            // these load at once.
            'logo' => 'nullable|image|max:4096',
        ]);
    }

    private function partnerAttributes(array $data, Request $request, ?Partner $partner = null): array
    {
        $attrs = [
            'name' => $data['name'],
            'kind' => $data['kind'],
            'url'  => ($data['url'] ?? null) ?: null,
            'note' => ($data['note'] ?? null) ?: null,
            'sort' => (int) ($data['sort'] ?? 0),
            'is_active' => $partner ? $request->boolean('is_active') : $request->boolean('is_active', true),
        ];

        if ($request->hasFile('logo')) {
            if ($partner?->logo_path) {
                Storage::disk('public')->delete($partner->logo_path);
            }
            $attrs['logo_path'] = $request->file('logo')->store('website/partners', 'public');
        }

        return $attrs;
    }

    private function validateService(Request $request): array
    {
        return $request->validate([
            'title'   => 'required|string|max:255',
            'summary' => 'nullable|string|max:500',
            'body'    => 'nullable|string|max:20000',
            // ⚠️ The icon is checked against the fixed list, so a value typed
            // by hand into the request cannot put an unknown class on the page.
            'icon'    => 'nullable|in:' . implode(',', array_keys(SiteService::ICONS)),
            'image'   => 'nullable|image|max:8192',
            'sort'    => 'nullable|integer|min:0|max:9999',
        ]);
    }

    private function serviceAttributes(array $data, Request $request, ?SiteService $service = null): array
    {
        $attrs = [
            'title'     => $data['title'],
            'summary'   => $data['summary'] ?? null,
            'body'      => $data['body'] ?? null,
            'icon'      => $data['icon'] ?? null,
            'sort'      => (int) ($data['sort'] ?? 0),
            // On create nothing has been said yet, so a new service is live;
            // on edit an unticked box genuinely means hide it.
            'is_active' => $service ? $request->boolean('is_active') : $request->boolean('is_active', true),
        ];

        if ($request->hasFile('image')) {
            if ($service?->image_path) {
                Storage::disk('public')->delete($service->image_path);
            }
            $attrs['image_path'] = $request->file('image')->store('website/services', 'public');
        }

        return $attrs;
    }

    private function validateLink(Request $request): array
    {
        return $request->validate([
            'label' => 'required|string|max:160',
            'url'   => 'required|string|max:500',
            'group' => 'required|in:' . implode(',', SiteLink::GROUPS),
            'sort'  => 'nullable|integer|min:0|max:9999',
        ]);
    }
}
