<?php

namespace App\Http\Controllers;

use App\Services\LiveDashboardService;
use Inertia\Inertia;

class LiveDashboardController extends Controller
{
    public function __construct(private LiveDashboardService $service) {}

    public function index()
    {
        $data = $this->service->getData();
        return Inertia::render('Dashboard/Live', $data);
    }
}
