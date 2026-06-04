import '../css/app.css';
import '@flaticon/flaticon-uicons/css/regular/rounded.css';
import '@flaticon/flaticon-uicons/css/solid/rounded.css';
import './bootstrap';

import { createInertiaApp } from '@inertiajs/react';
import { resolvePageComponent } from 'laravel-vite-plugin/inertia-helpers';
import { createRoot } from 'react-dom/client';

// Pulls the live brand name from the blade template (kept in sync with
// SettingService::get('brand_name')) so admins can rename via /admin/branding
// without rebuilding the bundle. Falls back to build-time env or hard default.
const appName = (window as any).__BRAND_NAME__
    || import.meta.env.VITE_APP_NAME
    || 'BITAC PMS';

createInertiaApp({
    title: (title) => `${title} - ${appName}`,
    resolve: (name) =>
        resolvePageComponent(
            `./Pages/${name}.tsx`,
            import.meta.glob('./Pages/**/*.tsx'),
        ),
    setup({ el, App, props }) {
        const root = createRoot(el);

        root.render(<App {...props} />);
    },
    progress: {
        color: '#4B5563',
    },
});
