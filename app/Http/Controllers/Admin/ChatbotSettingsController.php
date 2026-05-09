<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Services\SettingService;
use Illuminate\Http\Request;
use Inertia\Inertia;

class ChatbotSettingsController extends Controller
{
    public function __construct(private SettingService $settings) {}

    public function index()
    {
        return Inertia::render('Admin/ChatbotSettings', [
            'settings' => [
                'chatbot_name'        => $this->settings->get('chatbot.name', 'Oli'),
                'chatbot_subtitle'    => $this->settings->get('chatbot.subtitle', 'AI Chatbot'),
                'chatbot_welcome'     => $this->settings->get('chatbot.welcome', "Hi! I'm Oli 👋"),
                'chatbot_welcome_sub' => $this->settings->get('chatbot.welcome_sub', 'Your AI assistant for BITAC PMS. I can analyze data, generate reports, navigate pages and more!'),
                'chatbot_placeholder' => $this->settings->get('chatbot.placeholder', 'Ask about production, machines, finance...'),
                'chatbot_footer'      => $this->settings->get('chatbot.footer', 'Powered by Technocrats'),
                'chatbot_primary_color'   => $this->settings->get('chatbot.primary_color', '#ff7a0f'),
                'chatbot_bubble_user'     => $this->settings->get('chatbot.bubble_user', 'light'),
                'chatbot_bubble_bot'      => $this->settings->get('chatbot.bubble_bot', 'light'),
                'chatbot_fab_position'    => $this->settings->get('chatbot.fab_position', 'bottom-right'),
                'chatbot_tts_default'     => $this->settings->get('chatbot.tts_default', 'off'),
                'chatbot_show_avatar'     => $this->settings->get('chatbot.show_avatar', 'yes'),
                'chatbot_enabled'         => $this->settings->get('chatbot.enabled', 'yes'),
                'chatbot_icon_type'       => $this->settings->get('chatbot.icon_type', 'font'),
                'chatbot_icon_font'       => $this->settings->get('chatbot.icon_font', 'fi-rr-robot'),
                'chatbot_icon_image'      => $this->settings->get('chatbot.icon_image'),
                'chatbot_icon_image_url'  => $this->settings->get('chatbot.icon_image')
                    ? \Illuminate\Support\Facades\Storage::disk('public')->url($this->settings->get('chatbot.icon_image'))
                    : null,
                'chatbot_knowledge_base'  => $this->settings->get('chatbot.knowledge_base', ''),
                'ai_enabled'              => $this->settings->get('ai.enabled', 'yes'),
                'gemini_model'            => config('services.gemini.model', 'gemini-2.5-flash'),
            ],
        ]);
    }

    public function update(Request $request)
    {
        $validated = $request->validate([
            'chatbot_name'         => 'required|string|max:50',
            'chatbot_subtitle'     => 'nullable|string|max:100',
            'chatbot_welcome'      => 'nullable|string|max:200',
            'chatbot_welcome_sub'  => 'nullable|string|max:500',
            'chatbot_placeholder'  => 'nullable|string|max:200',
            'chatbot_footer'       => 'nullable|string|max:200',
            'chatbot_primary_color'=> 'nullable|string|max:20',
            'chatbot_bubble_user'  => 'required|in:light,dark,brand',
            'chatbot_bubble_bot'   => 'required|in:light,dark',
            'chatbot_fab_position' => 'required|in:bottom-right,bottom-left',
            'chatbot_tts_default'  => 'required|in:on,off',
            'chatbot_show_avatar'  => 'required|in:yes,no',
            'chatbot_enabled'      => 'required|in:yes,no',
            'chatbot_icon_type'    => 'required|in:font,image',
            'chatbot_icon_font'    => 'nullable|string|max:100',
            'chatbot_icon_image'   => 'nullable|file|mimes:svg,png,jpg,jpeg,webp|max:2048',
            'chatbot_knowledge_base' => 'nullable|string|max:10000',
            'ai_enabled'             => 'required|in:yes,no',
        ]);

        // Handle icon image upload
        if ($request->hasFile('chatbot_icon_image')) {
            $path = $request->file('chatbot_icon_image')->store('chatbot', 'public');
            $this->settings->set('chatbot.icon_image', $path);
        }

        $map = [
            'chatbot_name'         => 'chatbot.name',
            'chatbot_subtitle'     => 'chatbot.subtitle',
            'chatbot_welcome'      => 'chatbot.welcome',
            'chatbot_welcome_sub'  => 'chatbot.welcome_sub',
            'chatbot_placeholder'  => 'chatbot.placeholder',
            'chatbot_footer'       => 'chatbot.footer',
            'chatbot_primary_color'=> 'chatbot.primary_color',
            'chatbot_bubble_user'  => 'chatbot.bubble_user',
            'chatbot_bubble_bot'   => 'chatbot.bubble_bot',
            'chatbot_fab_position' => 'chatbot.fab_position',
            'chatbot_tts_default'  => 'chatbot.tts_default',
            'chatbot_show_avatar'  => 'chatbot.show_avatar',
            'chatbot_enabled'      => 'chatbot.enabled',
            'chatbot_icon_type'    => 'chatbot.icon_type',
            'chatbot_icon_font'    => 'chatbot.icon_font',
            'chatbot_knowledge_base' => 'chatbot.knowledge_base',
            'ai_enabled'             => 'ai.enabled',
        ];

        foreach ($map as $field => $key) {
            $this->settings->set($key, $validated[$field] ?? '');
        }

        return back()->with('success', 'Chatbot settings updated.');
    }
}
