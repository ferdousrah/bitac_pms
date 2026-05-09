import defaultTheme from 'tailwindcss/defaultTheme';
import forms from '@tailwindcss/forms';

/** @type {import('tailwindcss').Config} */
export default {
    content: [
        './vendor/laravel/framework/src/Illuminate/Pagination/resources/views/*.blade.php',
        './storage/framework/views/*.php',
        './resources/views/**/*.blade.php',
        './resources/js/**/*.tsx',
    ],

    theme: {
        extend: {
            fontFamily: {
                sans: ['Inter', 'Figtree', 'SiyamRupali', 'SutonnyMJ', ...defaultTheme.fontFamily.sans],
                display: ['Inter', 'SiyamRupali', ...defaultTheme.fontFamily.sans],
                mono: ['JetBrains Mono', ...defaultTheme.fontFamily.mono],
                bangla: ['SiyamRupali', 'SutonnyMJ', 'Noto Sans Bengali', 'Kalpurush', 'sans-serif'],
            },
            colors: {
                brand: {
                    50:  'rgb(var(--brand-50, 255 248 237) / <alpha-value>)',
                    100: 'rgb(var(--brand-100, 255 238 212) / <alpha-value>)',
                    200: 'rgb(var(--brand-200, 255 217 168) / <alpha-value>)',
                    300: 'rgb(var(--brand-300, 255 189 113) / <alpha-value>)',
                    400: 'rgb(var(--brand-400, 255 150 51) / <alpha-value>)',
                    500: 'rgb(var(--brand-500, 255 122 15) / <alpha-value>)',
                    600: 'rgb(var(--brand-600, 240 96 6) / <alpha-value>)',
                    700: 'rgb(var(--brand-700, 199 72 7) / <alpha-value>)',
                    800: 'rgb(var(--brand-800, 158 57 14) / <alpha-value>)',
                    900: 'rgb(var(--brand-900, 127 49 15) / <alpha-value>)',
                    950: 'rgb(var(--brand-950, 69 22 5) / <alpha-value>)',
                },
                surface: {
                    0:   '#ffffff',
                    50:  '#f8fafc',
                    100: '#f1f5f9',
                    200: '#e2e8f0',
                    300: '#cbd5e1',
                    400: '#94a3b8',
                    500: '#64748b',
                    600: '#475569',
                    700: '#334155',
                    800: '#1e293b',
                    850: '#172033',
                    900: '#0f172a',
                    950: '#020617',
                },
            },
            borderRadius: {
                xl: '0.875rem',
                '2xl': '1rem',
                '3xl': '1.25rem',
            },
            boxShadow: {
                'premium': '0 1px 3px 0 rgb(0 0 0 / 0.04), 0 1px 2px -1px rgb(0 0 0 / 0.04)',
                'premium-md': '0 4px 6px -1px rgb(0 0 0 / 0.05), 0 2px 4px -2px rgb(0 0 0 / 0.05)',
                'premium-lg': '0 10px 15px -3px rgb(0 0 0 / 0.05), 0 4px 6px -4px rgb(0 0 0 / 0.05)',
                'glow': '0 0 20px -5px rgb(255 122 15 / 0.2)',
                'inner-glow': 'inset 0 1px 0 0 rgb(255 255 255 / 0.05)',
            },
            animation: {
                'fade-in': 'fadeIn 0.3s ease-out',
                'slide-up': 'slideUp 0.3s ease-out',
                'slide-in-left': 'slideInLeft 0.25s ease-out',
                'scale-in': 'scaleIn 0.2s ease-out',
                'pulse-soft': 'pulseSoft 2s ease-in-out infinite',
            },
            keyframes: {
                fadeIn: {
                    '0%': { opacity: '0' },
                    '100%': { opacity: '1' },
                },
                slideUp: {
                    '0%': { opacity: '0', transform: 'translateY(8px)' },
                    '100%': { opacity: '1', transform: 'translateY(0)' },
                },
                slideInLeft: {
                    '0%': { opacity: '0', transform: 'translateX(-12px)' },
                    '100%': { opacity: '1', transform: 'translateX(0)' },
                },
                scaleIn: {
                    '0%': { opacity: '0', transform: 'scale(0.95)' },
                    '100%': { opacity: '1', transform: 'scale(1)' },
                },
                pulseSoft: {
                    '0%, 100%': { opacity: '1' },
                    '50%': { opacity: '0.7' },
                },
            },
        },
    },

    plugins: [forms],
};
