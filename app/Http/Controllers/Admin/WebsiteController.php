<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\GalleryItem;
use App\Models\NewsPost;
use App\Models\SiteLink;
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
        'site_about_body', 'site_mission', 'site_map_embed',
    ];

    public function index(Request $request)
    {
        $s = app(SettingService::class);

        return Inertia::render('Admin/Website/Index', [
            'tab'  => in_array($request->input('tab'), ['text', 'services', 'news', 'gallery', 'videos', 'links'], true)
                ? $request->input('tab') : 'text',
            'text' => collect(self::TEXT_KEYS)->mapWithKeys(fn ($k) => [$k => (string) $s->get($k, '')])->all(),
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
            'site_map_embed'     => 'nullable|url|max:2000',
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
