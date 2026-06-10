import { usePage } from '@inertiajs/react';

export default function StakeholderFormSuccess({ title }: any) {
    const { props } = usePage<any>();
    const theme = (props.appSettings ?? {}) as { logo_url?: string | null; brand_name?: string };
    const brandName = theme.brand_name || 'BITAC';

    return (
        <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-surface-50 to-indigo-50 flex flex-col">
            <div className="bg-white border-b border-surface-100">
                <div className="max-w-3xl mx-auto px-4 sm:px-6 py-4 flex items-center gap-3">
                    {theme.logo_url ? (
                        <img src={theme.logo_url} alt={brandName} className="w-11 h-11 object-contain" />
                    ) : (
                        <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-brand-400 to-brand-600 text-white flex items-center justify-center shadow-md">
                            <span className="font-bold text-base">B</span>
                        </div>
                    )}
                    <div className="leading-tight">
                        <p className="font-bold text-surface-900 text-[15px]">{brandName}</p>
                        <p className="text-[11px] text-surface-400">Bangladesh Industrial Technical Assistance Centre</p>
                    </div>
                </div>
            </div>

            <div className="flex-1 flex items-center justify-center px-4 py-12">
                <div className="max-w-md text-center">
                    <div className="inline-flex w-20 h-20 rounded-full bg-emerald-100 text-emerald-600 items-center justify-center mb-5 shadow-lg shadow-emerald-100">
                        <i className="fi fi-rr-check text-3xl leading-none" />
                    </div>
                    <h1 className="text-2xl sm:text-3xl font-bold text-surface-900">Thank You!</h1>
                    <p className="text-sm text-surface-600 mt-3">
                        Your response to <strong>"{title}"</strong> has been submitted.
                    </p>
                    <p className="text-xs text-surface-400 mt-5">
                        Your feedback helps BITAC shape its services. We appreciate your time.
                    </p>
                </div>
            </div>

            <footer className="bg-white border-t border-surface-100">
                <div className="max-w-3xl mx-auto px-4 sm:px-6 py-5 text-xs text-surface-500 text-center">
                    &copy; {new Date().getFullYear()} BITAC · Ministry of Industries, GoB
                </div>
            </footer>
        </div>
    );
}
