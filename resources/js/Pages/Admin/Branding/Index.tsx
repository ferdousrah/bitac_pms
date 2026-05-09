import AppLayout from '@/Layouts/AppLayout';
import { useForm } from '@inertiajs/react';
import { FormEvent, useEffect } from 'react';
import { applyTheme } from '@/lib/theme';

const COLOR_PRESETS = [
    { label: 'Orange',  hex: '#ff7a0f' },
    { label: 'Blue',    hex: '#3b82f6' },
    { label: 'Emerald', hex: '#10b981' },
    { label: 'Violet',  hex: '#8b5cf6' },
    { label: 'Rose',    hex: '#f43f5e' },
    { label: 'Cyan',    hex: '#06b6d4' },
    { label: 'Amber',   hex: '#f59e0b' },
    { label: 'Indigo',  hex: '#6366f1' },
];

const SIDEBAR_PRESETS = [
    { label: 'Slate',   hex: '#0f172a' },
    { label: 'Zinc',    hex: '#18181b' },
    { label: 'Neutral', hex: '#171717' },
    { label: 'Gray',    hex: '#111827' },
    { label: 'Stone',   hex: '#1c1917' },
    { label: 'Blue',    hex: '#172554' },
    { label: 'Emerald', hex: '#022c22' },
    { label: 'Purple',  hex: '#2e1065' },
];

export default function BrandingIndex({ settings }: any) {
    const { data, setData, post, errors, processing } = useForm({
        brand_name:     settings.brand_name ?? 'BITAC PMS',
        brand_subtitle: settings.brand_subtitle ?? 'Production Management',
        primary_color:  settings.primary_color ?? '#ff7a0f',
        sidebar_color:  settings.sidebar_color ?? '#0f172a',
        sidebar_accent: settings.sidebar_accent ?? '#1e293b',
        logo:           null as File | null,
        remove_logo:    false,
    });

    // Live preview — apply theme as user changes colors
    useEffect(() => {
        applyTheme({
            primary_color: data.primary_color,
            sidebar_color: data.sidebar_color,
            sidebar_accent: data.sidebar_accent,
        });
    }, [data.primary_color, data.sidebar_color, data.sidebar_accent]);

    const submit = (e: FormEvent) => {
        e.preventDefault();
        post('/admin/branding', { forceFormData: true });
    };

    return (
        <AppLayout header="Branding & Theme">
            <div className="max-w-5xl animate-fade-in">
                <form onSubmit={submit} className="space-y-6">

                    <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">

                        {/* ── Left: Settings Form (3/5) ─────────────────── */}
                        <div className="lg:col-span-3 space-y-6">

                            {/* Brand Identity */}
                            <div className="card animate-slide-up">
                                <div className="card-header">
                                    <div className="flex items-center gap-2">
                                        <div className="w-8 h-8 rounded-xl bg-brand-50 flex items-center justify-center">
                                            <i className="fi fi-rr-text text-brand-500 text-sm leading-none" />
                                        </div>
                                        <div>
                                            <h3 className="text-sm font-bold text-surface-900">Brand Identity</h3>
                                            <p className="text-xs text-surface-400">Software name and branding text</p>
                                        </div>
                                    </div>
                                </div>
                                <div className="card-body space-y-4">
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        <div className="form-group">
                                            <label className="form-label">Software Name *</label>
                                            <input type="text" value={data.brand_name}
                                                onChange={e => setData('brand_name', e.target.value)}
                                                className="form-input" required maxLength={50} />
                                            {errors.brand_name && <p className="form-error">{errors.brand_name}</p>}
                                        </div>
                                        <div className="form-group">
                                            <label className="form-label">
                                                Subtitle <span className="form-label-optional">(optional)</span>
                                            </label>
                                            <input type="text" value={data.brand_subtitle}
                                                onChange={e => setData('brand_subtitle', e.target.value)}
                                                placeholder="e.g. Production Management"
                                                className="form-input" maxLength={50} />
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Logo Upload */}
                            <div className="card animate-slide-up">
                                <div className="card-header">
                                    <div className="flex items-center gap-2">
                                        <div className="w-8 h-8 rounded-xl bg-purple-50 flex items-center justify-center">
                                            <i className="fi fi-rr-picture text-purple-500 text-sm leading-none" />
                                        </div>
                                        <div>
                                            <h3 className="text-sm font-bold text-surface-900">Logo / Brand Icon</h3>
                                            <p className="text-xs text-surface-400">Shown in sidebar and mobile drawer</p>
                                        </div>
                                    </div>
                                </div>
                                <div className="card-body">
                                    <div className="flex items-start gap-4">
                                        {/* Current logo preview */}
                                        <div className="w-16 h-16 rounded-2xl bg-surface-100 border-2 border-dashed border-surface-200 flex items-center justify-center shrink-0 overflow-hidden">
                                            {(data.logo || settings.logo_url) && !data.remove_logo ? (
                                                <img
                                                    src={data.logo ? URL.createObjectURL(data.logo) : settings.logo_url}
                                                    className="w-full h-full object-cover rounded-xl"
                                                    alt="Logo"
                                                />
                                            ) : (
                                                <i className="fi fi-rr-picture text-surface-300 text-xl leading-none" />
                                            )}
                                        </div>
                                        <div className="flex-1 space-y-2">
                                            <input
                                                type="file"
                                                accept="image/png,image/jpeg,image/svg+xml,image/webp"
                                                onChange={e => { setData('logo', e.target.files?.[0] ?? null); setData('remove_logo', false); }}
                                                className="block w-full text-sm text-surface-500 file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-sm file:font-semibold file:bg-brand-50 file:text-brand-700 hover:file:bg-brand-100 file:cursor-pointer file:transition-colors"
                                            />
                                            <p className="text-xs text-surface-400">PNG, JPG, SVG, or WebP. Max 2MB. Recommended: 128x128px square.</p>
                                            {(settings.logo_url || data.logo) && !data.remove_logo && (
                                                <button type="button" onClick={() => { setData('remove_logo', true); setData('logo', null); }}
                                                    className="text-xs text-red-600 hover:text-red-700 font-medium">
                                                    <i className="fi fi-rr-trash text-[10px] mr-1" />Remove logo
                                                </button>
                                            )}
                                            {errors.logo && <p className="form-error">{errors.logo}</p>}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Theme Colors */}
                            <div className="card animate-slide-up">
                                <div className="card-header">
                                    <div className="flex items-center gap-2">
                                        <div className="w-8 h-8 rounded-xl bg-emerald-50 flex items-center justify-center">
                                            <i className="fi fi-rr-palette text-emerald-500 text-sm leading-none" />
                                        </div>
                                        <div>
                                            <h3 className="text-sm font-bold text-surface-900">Theme Colors</h3>
                                            <p className="text-xs text-surface-400">Changes apply live — preview on the right</p>
                                        </div>
                                    </div>
                                </div>
                                <div className="card-body space-y-6">
                                    {/* Primary Color */}
                                    <div>
                                        <label className="form-label">Primary / Accent Color</label>
                                        <div className="flex items-center gap-3">
                                            <input type="color" value={data.primary_color}
                                                onChange={e => setData('primary_color', e.target.value)}
                                                className="w-12 h-10 rounded-xl border border-surface-200 cursor-pointer p-0.5" />
                                            <input type="text" value={data.primary_color}
                                                onChange={e => setData('primary_color', e.target.value)}
                                                className="form-input w-32 font-mono text-sm uppercase" maxLength={7} />
                                        </div>
                                        <div className="flex flex-wrap gap-2 mt-3">
                                            {COLOR_PRESETS.map(p => (
                                                <button key={p.hex} type="button"
                                                    onClick={() => setData('primary_color', p.hex)}
                                                    className={`w-8 h-8 rounded-xl border-2 transition-all hover:scale-110
                                                        ${data.primary_color === p.hex ? 'border-surface-900 ring-2 ring-surface-300 scale-110' : 'border-transparent'}`}
                                                    style={{ backgroundColor: p.hex }}
                                                    title={p.label}
                                                />
                                            ))}
                                        </div>
                                        {errors.primary_color && <p className="form-error">{errors.primary_color}</p>}
                                    </div>

                                    {/* Sidebar Color */}
                                    <div>
                                        <label className="form-label">Sidebar Background</label>
                                        <div className="flex items-center gap-3">
                                            <input type="color" value={data.sidebar_color}
                                                onChange={e => setData('sidebar_color', e.target.value)}
                                                className="w-12 h-10 rounded-xl border border-surface-200 cursor-pointer p-0.5" />
                                            <input type="text" value={data.sidebar_color}
                                                onChange={e => setData('sidebar_color', e.target.value)}
                                                className="form-input w-32 font-mono text-sm uppercase" maxLength={7} />
                                        </div>
                                        <div className="flex flex-wrap gap-2 mt-3">
                                            {SIDEBAR_PRESETS.map(p => (
                                                <button key={p.hex} type="button"
                                                    onClick={() => setData('sidebar_color', p.hex)}
                                                    className={`w-8 h-8 rounded-xl border-2 transition-all hover:scale-110
                                                        ${data.sidebar_color === p.hex ? 'border-white ring-2 ring-surface-300 scale-110' : 'border-surface-300'}`}
                                                    style={{ backgroundColor: p.hex }}
                                                    title={p.label}
                                                />
                                            ))}
                                        </div>
                                        {errors.sidebar_color && <p className="form-error">{errors.sidebar_color}</p>}
                                    </div>

                                    {/* Sidebar Accent */}
                                    <div>
                                        <label className="form-label">Sidebar Active/Accent</label>
                                        <div className="flex items-center gap-3">
                                            <input type="color" value={data.sidebar_accent}
                                                onChange={e => setData('sidebar_accent', e.target.value)}
                                                className="w-12 h-10 rounded-xl border border-surface-200 cursor-pointer p-0.5" />
                                            <input type="text" value={data.sidebar_accent}
                                                onChange={e => setData('sidebar_accent', e.target.value)}
                                                className="form-input w-32 font-mono text-sm uppercase" maxLength={7} />
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Save */}
                            <div className="flex items-center gap-3">
                                <button type="submit" disabled={processing} className="btn-primary">
                                    {processing ? (
                                        <><i className="fi fi-rr-spinner animate-spin text-sm leading-none" /> Saving...</>
                                    ) : (
                                        <><i className="fi fi-rr-check text-sm leading-none" /> Save Changes</>
                                    )}
                                </button>
                                <button type="button" className="btn-outline"
                                    onClick={() => {
                                        setData('primary_color', '#ff7a0f');
                                        setData('sidebar_color', '#0f172a');
                                        setData('sidebar_accent', '#1e293b');
                                    }}>
                                    Reset to Default
                                </button>
                            </div>
                        </div>

                        {/* ── Right: Live Preview (2/5) ─────────────────── */}
                        <div className="lg:col-span-2">
                            <div className="lg:sticky lg:top-6 space-y-4">
                                <div className="card animate-slide-up overflow-hidden">
                                    <div className="card-header">
                                        <h3 className="text-sm font-bold text-surface-900">Live Preview</h3>
                                        <p className="text-xs text-surface-400 mt-0.5">Updates as you change settings</p>
                                    </div>
                                    <div className="card-body p-0">
                                        {/* Mini sidebar preview */}
                                        <div className="flex h-[400px] border border-surface-100 rounded-xl m-4 overflow-hidden">
                                            {/* Sidebar mock */}
                                            <div className="w-[140px] shrink-0 flex flex-col text-white text-[10px]"
                                                style={{ background: `linear-gradient(to bottom, ${data.sidebar_color}, ${data.sidebar_accent})` }}>
                                                {/* Logo area */}
                                                <div className="p-3 border-b border-white/10 flex items-center gap-2">
                                                    {(data.logo || settings.logo_url) && !data.remove_logo ? (
                                                        <img
                                                            src={data.logo ? URL.createObjectURL(data.logo) : settings.logo_url}
                                                            className="w-6 h-6 rounded-md object-cover"
                                                            alt=""
                                                        />
                                                    ) : (
                                                        <div className="w-6 h-6 rounded-md flex items-center justify-center"
                                                            style={{ background: `linear-gradient(135deg, ${data.primary_color}, ${data.primary_color}dd)` }}>
                                                            <i className="fi fi-sr-industry-windows text-white text-[8px] leading-none" />
                                                        </div>
                                                    )}
                                                    <div className="min-w-0">
                                                        <div className="font-bold truncate leading-tight" style={{ fontSize: '9px' }}>{data.brand_name || 'BITAC PMS'}</div>
                                                        <div className="text-white/40 truncate leading-tight" style={{ fontSize: '7px' }}>{data.brand_subtitle || 'Production'}</div>
                                                    </div>
                                                </div>
                                                {/* Nav items mock */}
                                                <div className="flex-1 py-2 space-y-0.5 overflow-hidden">
                                                    {['Dashboard', 'RFQs', 'Quotations', 'Work Orders', 'Schedule'].map((item, i) => (
                                                        <div key={item} className={`flex items-center gap-1.5 px-3 py-1.5 mx-1 rounded-md ${i === 0 ? 'bg-white/10' : 'text-white/50'}`}>
                                                            <div className="w-3 h-3 rounded bg-white/20" />
                                                            <span>{item}</span>
                                                        </div>
                                                    ))}
                                                    <div className="mx-3 my-2 border-t border-white/10" />
                                                    {['Users', 'Branding'].map(item => (
                                                        <div key={item} className="flex items-center gap-1.5 px-3 py-1.5 mx-1 text-white/50">
                                                            <div className="w-3 h-3 rounded bg-white/20" />
                                                            <span>{item}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                            {/* Content mock */}
                                            <div className="flex-1 bg-surface-50 flex flex-col min-w-0">
                                                <div className="h-8 bg-white border-b border-surface-100 flex items-center px-3">
                                                    <div className="text-[9px] font-bold text-surface-900">Dashboard</div>
                                                </div>
                                                <div className="flex-1 p-3 space-y-2">
                                                    {/* Stat cards mock */}
                                                    <div className="grid grid-cols-3 gap-1.5">
                                                        {[1, 2, 3].map(i => (
                                                            <div key={i} className="bg-white rounded-lg p-2 border border-surface-100">
                                                                <div className="w-5 h-5 rounded-md mb-1" style={{ backgroundColor: data.primary_color, opacity: 0.8 }} />
                                                                <div className="w-4 h-2 bg-surface-200 rounded" />
                                                            </div>
                                                        ))}
                                                    </div>
                                                    {/* Chart mock */}
                                                    <div className="bg-white rounded-lg p-2 border border-surface-100 flex-1">
                                                        <div className="w-16 h-1.5 bg-surface-200 rounded mb-2" />
                                                        <div className="flex items-end gap-1 h-16">
                                                            {[40, 65, 50, 80, 60, 75].map((h, i) => (
                                                                <div key={i} className="flex-1 rounded-t-sm" style={{ height: `${h}%`, backgroundColor: data.primary_color, opacity: 0.15 + i * 0.12 }} />
                                                            ))}
                                                        </div>
                                                    </div>
                                                    {/* Button mock */}
                                                    <div className="flex gap-1.5">
                                                        <div className="px-3 py-1 rounded-md text-white text-[8px] font-semibold" style={{ backgroundColor: data.primary_color }}>
                                                            Primary Button
                                                        </div>
                                                        <div className="px-3 py-1 rounded-md border border-surface-200 text-surface-500 text-[8px]">
                                                            Outline
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </form>
            </div>
        </AppLayout>
    );
}
