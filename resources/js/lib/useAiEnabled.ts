import { usePage } from '@inertiajs/react';

/**
 * Master AI switch. When this is `false`, every AI feature in the app
 * (Oli chatbot + all inline "AI assist" panels) should render nothing.
 *
 * Controlled by the `ai.enabled` setting, toggled by admins on the
 * Chatbot Settings page. Shared via Inertia's HandleInertiaRequests
 * under the `aiEnabled` key.
 */
export function useAiEnabled(): boolean {
    const { aiEnabled } = (usePage().props as any) ?? {};
    return aiEnabled !== false; // default ON when the prop hasn't loaded yet
}
