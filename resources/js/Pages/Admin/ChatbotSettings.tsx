import AppLayout from '@/Layouts/AppLayout';
import { useForm } from '@inertiajs/react';
import { useRef, useState } from 'react';

const colorPresets = [
    { label: 'Brand Orange', value: '#ff7a0f' },
    { label: 'Blue', value: '#3b82f6' },
    { label: 'Emerald', value: '#10b981' },
    { label: 'Purple', value: '#8b5cf6' },
    { label: 'Rose', value: '#f43f5e' },
    { label: 'Teal', value: '#14b8a6' },
    { label: 'Indigo', value: '#6366f1' },
    { label: 'Slate', value: '#475569' },
];

export default function ChatbotSettings({ settings }: any) {
    const { data, setData, post, processing, errors } = useForm({
        ...settings,
        chatbot_icon_image: null as File | null,
    });
    const iconFileRef = useRef<HTMLInputElement>(null);
    const [iconPreview, setIconPreview] = useState<string | null>(settings.chatbot_icon_image_url ?? null);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        post('/admin/chatbot-settings', { forceFormData: true });
    };

    const handleIconUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setData('chatbot_icon_image', file);
            setData('chatbot_icon_type', 'image');
            setIconPreview(URL.createObjectURL(file));
        }
    };

    return (
        <AppLayout header="Chatbot Settings">
            <form onSubmit={handleSubmit} className="space-y-6 animate-fade-in max-w-5xl mx-auto">

                <div className="page-header">
                    <div>
                        <h1 className="page-title">Oli — Chatbot Settings</h1>
                        <p className="page-subtitle">Customize the AI chatbot appearance, behavior, and branding</p>
                    </div>
                    <button type="submit" disabled={processing} className="btn-primary">
                        <i className="fi fi-rr-disk text-xs leading-none" />
                        {processing ? 'Saving…' : 'Save Settings'}
                    </button>
                </div>

                {/* Identity & Branding */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <div className="card transition-all duration-300 hover:shadow-premium-lg hover:border-brand-200">
                        <div className="card-header">
                            <div className="flex items-center gap-2.5">
                                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-brand-400 to-brand-600 text-white flex items-center justify-center shadow-md">
                                    <i className="fi fi-rr-robot leading-none" />
                                </div>
                                <div>
                                    <h2 className="text-sm font-bold text-surface-800">Identity & Branding</h2>
                                    <p className="text-xs text-surface-400 mt-0.5">Chatbot name, subtitle, and welcome message</p>
                                </div>
                            </div>
                        </div>
                        <div className="card-body space-y-4">
                            <div className="form-group">
                                <label className="form-label">Chatbot Name</label>
                                <input type="text" value={data.chatbot_name} onChange={e => setData('chatbot_name', e.target.value)}
                                    className="form-input" placeholder="e.g. Oli" />
                                {errors.chatbot_name && <p className="form-error">{errors.chatbot_name}</p>}
                            </div>
                            <div className="form-group">
                                <label className="form-label">Subtitle <span className="form-label-optional">(optional)</span></label>
                                <input type="text" value={data.chatbot_subtitle ?? ''} onChange={e => setData('chatbot_subtitle', e.target.value)}
                                    className="form-input" placeholder="e.g. AI Chatbot" />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Welcome Title</label>
                                <input type="text" value={data.chatbot_welcome ?? ''} onChange={e => setData('chatbot_welcome', e.target.value)}
                                    className="form-input" placeholder="Hi! I'm Oli 👋" />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Welcome Description</label>
                                <textarea value={data.chatbot_welcome_sub ?? ''} onChange={e => setData('chatbot_welcome_sub', e.target.value)}
                                    className="form-textarea" rows={3} placeholder="Your AI assistant for..." />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Input Placeholder</label>
                                <input type="text" value={data.chatbot_placeholder ?? ''} onChange={e => setData('chatbot_placeholder', e.target.value)}
                                    className="form-input" placeholder="Ask about production, machines..." />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Footer Text</label>
                                <input type="text" value={data.chatbot_footer ?? ''} onChange={e => setData('chatbot_footer', e.target.value)}
                                    className="form-input" placeholder="Powered by Technocrats" />
                            </div>

                            {/* Icon Settings */}
                            <div className="pt-4 border-t border-surface-100">
                                <label className="form-label mb-3">Chatbot Icon</label>
                                <div className="flex gap-3 mb-3">
                                    <button type="button" onClick={() => setData('chatbot_icon_type', 'font')}
                                        className={`flex-1 px-3 py-2.5 rounded-xl border-2 text-center text-xs font-semibold transition-all ${data.chatbot_icon_type === 'font' ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-surface-200 text-surface-600 hover:border-surface-300'}`}>
                                        <i className="fi fi-rr-text text-sm block mb-1" /> Font Icon
                                    </button>
                                    <button type="button" onClick={() => setData('chatbot_icon_type', 'image')}
                                        className={`flex-1 px-3 py-2.5 rounded-xl border-2 text-center text-xs font-semibold transition-all ${data.chatbot_icon_type === 'image' ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-surface-200 text-surface-600 hover:border-surface-300'}`}>
                                        <i className="fi fi-rr-picture text-sm block mb-1" /> Upload Image
                                    </button>
                                </div>

                                {data.chatbot_icon_type === 'font' ? (
                                    <div className="space-y-2">
                                        <input type="text" value={data.chatbot_icon_font ?? ''} onChange={e => setData('chatbot_icon_font', e.target.value)}
                                            className="form-input" placeholder="e.g. fi-rr-robot" />
                                        <p className="form-hint">Use any Flaticon UIcons class (e.g. fi-rr-robot, fi-rr-sparkles, fi-rr-headset)</p>
                                        <div className="flex items-center gap-3 pt-2">
                                            <span className="text-xs text-surface-500">Preview:</span>
                                            <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white"
                                                style={{ background: data.chatbot_primary_color || '#ff7a0f' }}>
                                                <i className={`fi ${data.chatbot_icon_font || 'fi-rr-robot'} text-lg leading-none`} />
                                            </div>
                                            {/* Quick picks */}
                                            <div className="flex gap-1.5">
                                                {['fi-rr-robot', 'fi-rr-sparkles', 'fi-rr-headset', 'fi-rr-comment', 'fi-rr-bolt', 'fi-rr-brain'].map(ic => (
                                                    <button key={ic} type="button" onClick={() => setData('chatbot_icon_font', ic)}
                                                        className={`w-8 h-8 rounded-lg border flex items-center justify-center text-sm transition-all ${data.chatbot_icon_font === ic ? 'border-brand-500 bg-brand-50 text-brand-600' : 'border-surface-200 text-surface-500 hover:border-surface-300'}`}>
                                                        <i className={`fi ${ic} leading-none`} />
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="space-y-3">
                                        <div className="flex items-center gap-4">
                                            {/* Current/preview */}
                                            <div className="w-14 h-14 rounded-2xl flex items-center justify-center overflow-hidden border-2 border-dashed border-surface-300 bg-surface-50 shrink-0"
                                                style={iconPreview ? { borderStyle: 'solid', borderColor: data.chatbot_primary_color || '#ff7a0f' } : undefined}>
                                                {iconPreview ? (
                                                    <img src={iconPreview} alt="Icon" className="w-full h-full object-contain" />
                                                ) : (
                                                    <i className="fi fi-rr-picture text-surface-400 text-xl leading-none" />
                                                )}
                                            </div>
                                            <div className="flex-1">
                                                <button type="button" onClick={() => iconFileRef.current?.click()}
                                                    className="btn-outline btn-sm w-full justify-center">
                                                    <i className="fi fi-rr-cloud-upload text-xs leading-none" /> Upload Icon
                                                </button>
                                                <p className="form-hint mt-1">SVG, PNG, JPG · Max 2MB · Square recommended</p>
                                            </div>
                                        </div>
                                        <input ref={iconFileRef} type="file" className="hidden" accept=".svg,.png,.jpg,.jpeg,.webp" onChange={handleIconUpload} />
                                        {errors.chatbot_icon_image && <p className="form-error">{errors.chatbot_icon_image}</p>}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Appearance */}
                    <div className="space-y-6">
                        <div className="card transition-all duration-300 hover:shadow-premium-lg hover:border-brand-200">
                            <div className="card-header">
                                <div className="flex items-center gap-2.5">
                                    <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-purple-400 to-purple-600 text-white flex items-center justify-center shadow-md">
                                        <i className="fi fi-rr-palette leading-none" />
                                    </div>
                                    <div>
                                        <h2 className="text-sm font-bold text-surface-800">Appearance</h2>
                                        <p className="text-xs text-surface-400 mt-0.5">Colors, bubble styles, and layout</p>
                                    </div>
                                </div>
                            </div>
                            <div className="card-body space-y-4">
                                {/* Primary Color */}
                                <div className="form-group">
                                    <label className="form-label">Primary Color</label>
                                    <div className="flex items-center gap-3">
                                        <input type="color" value={data.chatbot_primary_color ?? '#ff7a0f'}
                                            onChange={e => setData('chatbot_primary_color', e.target.value)}
                                            className="w-10 h-10 rounded-lg border border-surface-200 cursor-pointer p-0.5" />
                                        <div className="flex flex-wrap gap-1.5">
                                            {colorPresets.map(c => (
                                                <button key={c.value} type="button"
                                                    onClick={() => setData('chatbot_primary_color', c.value)}
                                                    title={c.label}
                                                    className={`w-7 h-7 rounded-lg border-2 transition-all hover:scale-110 ${data.chatbot_primary_color === c.value ? 'border-surface-900 ring-2 ring-offset-1 ring-surface-400' : 'border-surface-200'}`}
                                                    style={{ background: c.value }} />
                                            ))}
                                        </div>
                                    </div>
                                </div>

                                {/* User Bubble Style */}
                                <div className="form-group">
                                    <label className="form-label">User Bubble Style</label>
                                    <div className="grid grid-cols-3 gap-2">
                                        {[
                                            { val: 'light', label: 'Light', preview: 'bg-brand-50 border-brand-200 text-surface-800' },
                                            { val: 'dark', label: 'Dark', preview: 'bg-surface-800 border-surface-700 text-white' },
                                            { val: 'brand', label: 'Brand', preview: 'bg-brand-500 border-brand-600 text-white' },
                                        ].map(opt => (
                                            <button key={opt.val} type="button" onClick={() => setData('chatbot_bubble_user', opt.val)}
                                                className={`p-3 rounded-xl border-2 text-center transition-all ${data.chatbot_bubble_user === opt.val ? 'border-brand-500 ring-2 ring-brand-200' : 'border-surface-200 hover:border-surface-300'}`}>
                                                <div className={`w-full h-6 rounded-lg border mb-2 ${opt.preview}`} />
                                                <span className="text-[10px] font-semibold text-surface-600">{opt.label}</span>
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* Bot Bubble Style */}
                                <div className="form-group">
                                    <label className="form-label">Bot Bubble Style</label>
                                    <div className="grid grid-cols-2 gap-2">
                                        {[
                                            { val: 'light', label: 'Light', preview: 'bg-surface-50 border-surface-200 text-surface-800' },
                                            { val: 'dark', label: 'Dark', preview: 'bg-surface-800 border-surface-700 text-white' },
                                        ].map(opt => (
                                            <button key={opt.val} type="button" onClick={() => setData('chatbot_bubble_bot', opt.val)}
                                                className={`p-3 rounded-xl border-2 text-center transition-all ${data.chatbot_bubble_bot === opt.val ? 'border-brand-500 ring-2 ring-brand-200' : 'border-surface-200 hover:border-surface-300'}`}>
                                                <div className={`w-full h-6 rounded-lg border mb-2 ${opt.preview}`} />
                                                <span className="text-[10px] font-semibold text-surface-600">{opt.label}</span>
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* FAB Position */}
                                <div className="form-group">
                                    <label className="form-label">FAB Position</label>
                                    <div className="grid grid-cols-2 gap-2">
                                        {[{ val: 'bottom-right', label: '↘ Bottom Right' }, { val: 'bottom-left', label: '↙ Bottom Left' }].map(opt => (
                                            <button key={opt.val} type="button" onClick={() => setData('chatbot_fab_position', opt.val)}
                                                className={`px-3 py-2.5 rounded-xl border-2 text-xs font-semibold transition-all ${data.chatbot_fab_position === opt.val ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-surface-200 text-surface-600 hover:border-surface-300'}`}>
                                                {opt.label}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Behavior */}
                        <div className="card transition-all duration-300 hover:shadow-premium-lg hover:border-brand-200">
                            <div className="card-header">
                                <div className="flex items-center gap-2.5">
                                    <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-400 to-emerald-600 text-white flex items-center justify-center shadow-md">
                                        <i className="fi fi-rr-settings-sliders leading-none" />
                                    </div>
                                    <div>
                                        <h2 className="text-sm font-bold text-surface-800">Behavior</h2>
                                        <p className="text-xs text-surface-400 mt-0.5">Toggles and defaults</p>
                                    </div>
                                </div>
                            </div>
                            <div className="card-body space-y-4">
                                {/* Master AI switch — kills BOTH the chatbot and every inline AI assist panel across the app */}
                                <div className={`flex items-start justify-between gap-3 p-3 rounded-xl border-2 ${
                                    data.ai_enabled === 'yes' ? 'bg-indigo-50 border-indigo-200' : 'bg-red-50 border-red-200'
                                }`}>
                                    <div className="min-w-0 flex-1">
                                        <div className="text-sm font-bold flex items-center gap-2">
                                            <span>✨ AI Features (Master Switch)</span>
                                            <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider ${
                                                data.ai_enabled === 'yes' ? 'bg-emerald-100 text-emerald-700 border border-emerald-200'
                                                                          : 'bg-red-100 text-red-700 border border-red-200'
                                            }`}>
                                                {data.ai_enabled === 'yes' ? 'ON' : 'OFF'}
                                            </span>
                                        </div>
                                        <p className="text-xs text-surface-600 mt-1 leading-relaxed">
                                            When OFF, the Oli chatbot FAB <strong>and</strong> every inline AI assist panel
                                            (approval-note helper, quotation terms, sample-photo describer, handoff notes,
                                            comment-reply assist) will all disappear across the app. All <code className="bg-white px-1 rounded">/ai-assist/*</code> endpoints will also return <code className="bg-white px-1 rounded">503</code>.
                                        </p>
                                    </div>
                                    <button type="button" onClick={() => setData('ai_enabled', data.ai_enabled === 'yes' ? 'no' : 'yes')}
                                        className={`relative w-11 h-6 rounded-full transition-colors shrink-0 mt-1 ${data.ai_enabled === 'yes' ? 'bg-indigo-600' : 'bg-surface-300'}`}>
                                        <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${data.ai_enabled === 'yes' ? 'left-[1.375rem]' : 'left-0.5'}`} />
                                    </button>
                                </div>

                                {/* Toggle: Enabled */}
                                <div className="flex items-center justify-between">
                                    <div>
                                        <div className="text-sm font-semibold text-surface-800">Chatbot Enabled</div>
                                        <div className="text-xs text-surface-400">Show the chatbot FAB on all pages <span className="text-surface-400">(also needs master switch ON)</span></div>
                                    </div>
                                    <button type="button" onClick={() => setData('chatbot_enabled', data.chatbot_enabled === 'yes' ? 'no' : 'yes')}
                                        className={`relative w-11 h-6 rounded-full transition-colors ${data.chatbot_enabled === 'yes' ? 'bg-brand-500' : 'bg-surface-300'}`}>
                                        <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${data.chatbot_enabled === 'yes' ? 'left-[1.375rem]' : 'left-0.5'}`} />
                                    </button>
                                </div>

                                {/* Toggle: Avatar */}
                                <div className="flex items-center justify-between">
                                    <div>
                                        <div className="text-sm font-semibold text-surface-800">Show Avatars</div>
                                        <div className="text-xs text-surface-400">Display sender avatars next to messages</div>
                                    </div>
                                    <button type="button" onClick={() => setData('chatbot_show_avatar', data.chatbot_show_avatar === 'yes' ? 'no' : 'yes')}
                                        className={`relative w-11 h-6 rounded-full transition-colors ${data.chatbot_show_avatar === 'yes' ? 'bg-brand-500' : 'bg-surface-300'}`}>
                                        <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${data.chatbot_show_avatar === 'yes' ? 'left-[1.375rem]' : 'left-0.5'}`} />
                                    </button>
                                </div>

                                {/* Toggle: TTS Default */}
                                <div className="flex items-center justify-between">
                                    <div>
                                        <div className="text-sm font-semibold text-surface-800">Voice (TTS) Default</div>
                                        <div className="text-xs text-surface-400">Start with text-to-speech enabled</div>
                                    </div>
                                    <button type="button" onClick={() => setData('chatbot_tts_default', data.chatbot_tts_default === 'on' ? 'off' : 'on')}
                                        className={`relative w-11 h-6 rounded-full transition-colors ${data.chatbot_tts_default === 'on' ? 'bg-brand-500' : 'bg-surface-300'}`}>
                                        <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${data.chatbot_tts_default === 'on' ? 'left-[1.375rem]' : 'left-0.5'}`} />
                                    </button>
                                </div>

                                {/* AI Model (read-only) */}
                                <div className="pt-3 border-t border-surface-100">
                                    <div className="text-xs font-semibold text-surface-400 uppercase tracking-wider mb-1">AI Model</div>
                                    <div className="text-sm font-mono font-bold text-surface-700">{data.gemini_model}</div>
                                    <div className="text-[10px] text-surface-400 mt-0.5">Configured in .env (GEMINI_MODEL)</div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Knowledge Base */}
                <div className="card transition-all duration-300 hover:shadow-premium-lg hover:border-brand-200">
                    <div className="card-header">
                        <div className="flex items-center gap-2.5">
                            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-400 to-blue-600 text-white flex items-center justify-center shadow-md">
                                <i className="fi fi-rr-brain leading-none" />
                            </div>
                            <div>
                                <h2 className="text-sm font-bold text-surface-800">Knowledge Base</h2>
                                <p className="text-xs text-surface-400 mt-0.5">Teach the chatbot about your organization, policies, and domain knowledge</p>
                            </div>
                        </div>
                    </div>
                    <div className="card-body space-y-4">
                        <div className="px-3 py-2.5 rounded-lg bg-blue-50 border border-blue-200 text-xs text-blue-800">
                            <i className="fi fi-rr-info text-blue-500 mr-1.5 leading-none" />
                            <strong>Built-in knowledge</strong> about BITAC (history, departments, services, capabilities, clients) is already included. Use this field to add <strong>additional</strong> context like internal policies, specific procedures, team contacts, or domain-specific information.
                        </div>
                        <div className="form-group">
                            <label className="form-label">Custom Knowledge <span className="form-label-optional">(up to 10,000 characters)</span></label>
                            <textarea
                                value={data.chatbot_knowledge_base ?? ''}
                                onChange={e => setData('chatbot_knowledge_base', e.target.value)}
                                className="form-textarea font-mono text-xs"
                                rows={12}
                                placeholder={`Add any additional knowledge here. Examples:\n\n- Our working hours are Sunday to Thursday, 8 AM to 4 PM\n- The Machine Shop supervisor is Mr. Kamal (ext. 203)\n- For urgent jobs, contact the PCD section head directly\n- Our minimum order value is ৳5,000\n- Heat treatment capacity: max 500kg per batch\n- CNC tolerances: ±0.01mm standard, ±0.005mm precision\n- Payment terms: 50% advance for private sector, LC for government`}
                            />
                            <div className="flex items-center justify-between mt-1">
                                <p className="form-hint">This text is injected into the AI's system prompt. Be factual and concise.</p>
                                <span className={`text-[10px] font-mono ${(data.chatbot_knowledge_base?.length ?? 0) > 9000 ? 'text-red-500' : 'text-surface-400'}`}>
                                    {data.chatbot_knowledge_base?.length ?? 0} / 10,000
                                </span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Preview */}
                <div className="card transition-all duration-300 hover:shadow-premium-lg hover:border-brand-200">
                    <div className="card-header">
                        <h2 className="text-sm font-bold text-surface-800">Live Preview</h2>
                    </div>
                    <div className="card-body">
                        <div className="max-w-sm mx-auto bg-white rounded-2xl border border-surface-200 shadow-lg overflow-hidden">
                            {/* Mock header */}
                            <div className="px-4 py-3 flex items-center gap-3" style={{ background: data.chatbot_primary_color ?? '#ff7a0f' }}>
                                <div className="w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center overflow-hidden">
                                    {data.chatbot_icon_type === 'image' && iconPreview ? (
                                        <img src={iconPreview} alt="" className="w-6 h-6 object-contain" />
                                    ) : (
                                        <i className={`fi ${data.chatbot_icon_font || 'fi-rr-robot'} text-white leading-none`} />
                                    )}
                                </div>
                                <div>
                                    <h3 className="text-sm font-bold text-white leading-none">{data.chatbot_name || 'Oli'}</h3>
                                    <p className="text-[10px] text-white/60 mt-0.5">{data.chatbot_subtitle || 'AI Chatbot'}</p>
                                </div>
                            </div>
                            {/* Mock messages */}
                            <div className="p-4 space-y-3 bg-white">
                                <div className="text-center">
                                    <div className="text-sm font-bold text-surface-900">{data.chatbot_welcome || "Hi! I'm Oli 👋"}</div>
                                    <p className="text-[10px] text-surface-500 mt-1">{data.chatbot_welcome_sub?.substring(0, 80) || 'Your AI assistant'}...</p>
                                </div>
                                <div className="flex gap-2">
                                    <div className="w-6 h-6 rounded-full bg-surface-700 flex items-center justify-center text-white text-[8px] font-bold shrink-0">✦</div>
                                    <div className={`rounded-2xl rounded-tl-md px-3 py-2 text-xs max-w-[75%] ${data.chatbot_bubble_bot === 'dark' ? 'bg-surface-800 text-white' : 'bg-surface-50 border border-surface-100 text-surface-800'}`}>
                                        Hello! How can I help you today?
                                        <span className="block text-right text-[8px] opacity-50 mt-1">10:30 AM</span>
                                    </div>
                                </div>
                                <div className="flex gap-2 flex-row-reverse">
                                    <div className="w-6 h-6 rounded-full flex items-center justify-center text-[8px] font-bold shrink-0"
                                         style={{ background: data.chatbot_primary_color ?? '#ff7a0f', color: 'white', opacity: 0.8 }}>U</div>
                                    <div className={`rounded-2xl rounded-tr-md px-3 py-2 text-xs max-w-[75%] ${
                                        data.chatbot_bubble_user === 'brand' ? 'text-white' :
                                        data.chatbot_bubble_user === 'dark' ? 'bg-surface-800 text-white border border-surface-700' :
                                        'bg-brand-50 border border-brand-200 text-surface-800'
                                    }`} style={data.chatbot_bubble_user === 'brand' ? { background: data.chatbot_primary_color ?? '#ff7a0f' } : undefined}>
                                        Show me production stats
                                        <span className="block text-right text-[8px] opacity-50 mt-1">10:31 AM</span>
                                    </div>
                                </div>
                            </div>
                            {/* Mock input */}
                            <div className="px-3 py-2.5 border-t border-surface-100 bg-white">
                                <div className="flex items-center gap-2">
                                    <input type="text" disabled value="" placeholder={data.chatbot_placeholder || 'Ask something...'}
                                        className="flex-1 form-input !py-1.5 !text-xs !rounded-lg opacity-60" />
                                    <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: data.chatbot_primary_color ?? '#ff7a0f' }}>
                                        <i className="fi fi-rr-paper-plane text-white text-xs leading-none" />
                                    </div>
                                </div>
                                <p className="text-[8px] text-surface-400 text-center mt-1">{data.chatbot_footer || 'Powered by Technocrats'}</p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Bottom save */}
                <div className="flex justify-end">
                    <button type="submit" disabled={processing} className="btn-primary">
                        <i className="fi fi-rr-disk text-xs leading-none" />
                        {processing ? 'Saving…' : 'Save Settings'}
                    </button>
                </div>
            </form>
        </AppLayout>
    );
}
