<?php

namespace App\Http\Controllers\Portfolio;

use App\Http\Controllers\Controller;
use App\Models\Center;
use App\Models\PortfolioProject;
use Inertia\Inertia;

/**
 * Public-facing portfolio — no authentication required.
 *
 * Routes mounted under /portfolio so clients can share a link without needing
 * a login. Designed to live cleanly under a separate subdomain later
 * (e.g. portfolio.bitac.gov.bd) by re-pointing the route group's domain.
 */
class PortfolioPublicController extends Controller
{
    /**
     * Public listing page — published projects grouped by category and a BITAC
     * company info block sourced from the Dhaka HQ letterhead.
     */
    public function index()
    {
        $projects = PortfolioProject::where('is_published', true)
            ->orderBy('display_order')
            ->orderByDesc('completed_at')
            ->get();

        return Inertia::render('Portfolio/Public/Index', [
            'projects'   => $projects->map(fn($p) => [
                'id'              => $p->id,
                'slug'            => $p->slug,
                'title'           => $p->title,
                'client_name'     => $p->client_name,
                'category'        => $p->category,
                'summary'         => $p->summary,
                'completed_at'    => $p->completed_at?->format('M Y'),
                'cover_image_url' => $p->cover_image_url,
            ])->values(),
            'categories' => $projects->pluck('category')->filter()->unique()->values(),
            'bitac'      => $this->bitacInfo(),
        ]);
    }

    /**
     * Project detail page — full description, specs, and photo gallery.
     */
    public function show(string $slug)
    {
        $project = PortfolioProject::where('slug', $slug)
            ->where('is_published', true)
            ->firstOrFail();
        $project->load('photos');

        return Inertia::render('Portfolio/Public/Show', [
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
                'photos'          => $project->photos->map(fn($f) => [
                    'id'      => $f->id,
                    'url'     => $f->url,
                    'caption' => $f->caption,
                ])->values(),
            ],
            'related' => PortfolioProject::where('is_published', true)
                ->where('id', '!=', $project->id)
                ->when($project->category, fn($q) => $q->where('category', $project->category))
                ->latest('completed_at')
                ->take(3)
                ->get()
                ->map(fn($p) => [
                    'slug'            => $p->slug,
                    'title'           => $p->title,
                    'client_name'     => $p->client_name,
                    'cover_image_url' => $p->cover_image_url,
                ])->values(),
            'bitac'   => $this->bitacInfo(),
        ]);
    }

    /**
     * Pulls the BITAC HQ (Dhaka, center #1) letterhead into a shape the public
     * pages can render — name, address, contact, website, logo. Falls back
     * gracefully if no center exists.
     */
    private function bitacInfo(): array
    {
        $center = Center::find(1) ?? Center::first();
        if (!$center) return [];

        return [
            'name_bn'     => $center->name_bn,
            'name_en'     => $center->name ?? 'BITAC',
            'caption'     => $center->caption_en,
            'ministry_bn' => $center->ministry_bn,
            'government_bn' => $center->government_bn,
            'address_bn'  => $center->address_bn,
            'address'     => $center->address,
            'phone_bn'    => $center->phone_bn,
            'phone'       => $center->phone,
            'email'       => $center->email,
            'website'     => $center->website,
            'logo_left'   => $center->logo_left_url,
        ];
    }
}
