/**
 * Dynamic Theme System
 * Generates a full brand color palette from a single hex color
 * and applies it as CSS custom properties for Tailwind to consume.
 */

export interface AppSettings {
    brand_name: string;
    brand_subtitle: string;
    primary_color: string;
    sidebar_color: string;
    sidebar_accent: string;
    logo_url: string | null;
    logo_path: string | null;
}

// ── Color utilities ─────────────────────────────────────────────────────

function hexToHsl(hex: string): [number, number, number] {
    const r = parseInt(hex.slice(1, 3), 16) / 255;
    const g = parseInt(hex.slice(3, 5), 16) / 255;
    const b = parseInt(hex.slice(5, 7), 16) / 255;

    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    let h = 0, s = 0;
    const l = (max + min) / 2;

    if (max !== min) {
        const d = max - min;
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
        switch (max) {
            case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
            case g: h = ((b - r) / d + 2) / 6; break;
            case b: h = ((r - g) / d + 4) / 6; break;
        }
    }
    return [h * 360, s * 100, l * 100];
}

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
    h /= 360; s /= 100; l /= 100;
    let r: number, g: number, b: number;

    if (s === 0) {
        r = g = b = l;
    } else {
        const hue2rgb = (p: number, q: number, t: number) => {
            if (t < 0) t += 1;
            if (t > 1) t -= 1;
            if (t < 1/6) return p + (q - p) * 6 * t;
            if (t < 1/2) return q;
            if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
            return p;
        };
        const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
        const p = 2 * l - q;
        r = hue2rgb(p, q, h + 1/3);
        g = hue2rgb(p, q, h);
        b = hue2rgb(p, q, h - 1/3);
    }
    return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
}

function hexToRgbStr(hex: string): string {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `${r} ${g} ${b}`;
}

// ── Palette generation ──────────────────────────────────────────────────

// Shade → target lightness mapping
const SHADE_LIGHTNESS: Record<number, number> = {
    50: 97, 100: 94, 200: 86, 300: 74, 400: 60,
    500: 48, 600: 40, 700: 32, 800: 26, 900: 21, 950: 12,
};

function generatePalette(hex: string): Record<number, string> {
    const [h, s] = hexToHsl(hex);
    const palette: Record<number, string> = {};

    for (const [shade, lightness] of Object.entries(SHADE_LIGHTNESS)) {
        // Slightly desaturate lighter shades, slightly boost darker ones
        const shadeNum = Number(shade);
        const satAdj = shadeNum <= 100 ? s * 0.3 :
                       shadeNum <= 300 ? s * 0.6 :
                       shadeNum >= 800 ? Math.min(s * 1.1, 100) : s;
        const [r, g, b] = hslToRgb(h, satAdj, lightness);
        palette[shadeNum] = `${r} ${g} ${b}`;
    }
    return palette;
}

// ── Apply theme to DOM ──────────────────────────────────────────────────

export function applyTheme(settings: Partial<AppSettings>): void {
    const root = document.documentElement;

    // Brand color palette
    if (settings.primary_color) {
        const palette = generatePalette(settings.primary_color);
        for (const [shade, rgb] of Object.entries(palette)) {
            root.style.setProperty(`--brand-${shade}`, rgb);
        }
    }

    // Sidebar colors
    if (settings.sidebar_color) {
        root.style.setProperty('--sidebar-bg', hexToRgbStr(settings.sidebar_color));
    }
    if (settings.sidebar_accent) {
        root.style.setProperty('--sidebar-accent', hexToRgbStr(settings.sidebar_accent));
    }
}

/**
 * Generate CSS string for server-side injection (prevents FOUC)
 */
export function themeToCSS(settings: Partial<AppSettings>): string {
    const lines: string[] = [];
    if (settings.primary_color) {
        const palette = generatePalette(settings.primary_color);
        for (const [shade, rgb] of Object.entries(palette)) {
            lines.push(`--brand-${shade}: ${rgb};`);
        }
    }
    if (settings.sidebar_color) lines.push(`--sidebar-bg: ${hexToRgbStr(settings.sidebar_color)};`);
    if (settings.sidebar_accent) lines.push(`--sidebar-accent: ${hexToRgbStr(settings.sidebar_accent)};`);
    return lines.length ? `:root { ${lines.join(' ')} }` : '';
}
