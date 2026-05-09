<?php

namespace App\Services;

use App\Models\Setting;
use Illuminate\Support\Facades\Cache;

class SettingService
{
    protected array $settings = [];

    public function __construct()
    {
        $this->settings = Cache::rememberForever('app_settings', function () {
            return Setting::pluck('value', 'key')->toArray();
        });
    }

    public function get(string $key, mixed $default = null): mixed
    {
        return $this->settings[$key] ?? $default;
    }

    public function set(string $key, mixed $value): void
    {
        Setting::updateOrCreate(['key' => $key], ['value' => $value]);
        $this->settings[$key] = $value;
        Cache::forget('app_settings');
    }

    public function all(): array
    {
        return $this->settings;
    }

    /**
     * Return only specific keys with defaults.
     */
    public function branding(): array
    {
        return [
            'brand_name'     => $this->get('brand_name', 'BITAC PMS'),
            'brand_subtitle' => $this->get('brand_subtitle', 'Production Management'),
            'primary_color'  => $this->get('primary_color', '#ff7a0f'),
            'sidebar_color'  => $this->get('sidebar_color', '#0f172a'),
            'sidebar_accent' => $this->get('sidebar_accent', '#1e293b'),
            'logo_path'      => $this->get('logo_path'),
        ];
    }
}
