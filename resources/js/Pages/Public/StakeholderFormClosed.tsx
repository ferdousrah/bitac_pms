import { usePage } from '@inertiajs/react';

export default function StakeholderFormClosed({ form }: any) {
    const { props } = usePage<any>();
    const theme = (props.appSettings ?? {}) as { logo_url?: string | null; brand_name?: string };
    const brandName = theme.brand_name || 'BITAC';

    const message = form.status === 'closed'
        ? 'This consultation has now closed. Thank you to all stakeholders who participated.'
        : 'This form is not yet open for submissions. Please come back later.';

    return (
        <div className="min-h-screen bg-gradient-to-br from-surface-50 via-surface-100 to-surface-50 flex flex-col">
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
                    <div className="inline-flex w-16 h-16 rounded-full bg-surface-200 text-surface-500 items-center justify-center mb-4">
                        <i className="fi fi-rr-time-check text-2xl leading-none" />
                    </div>
                    <h1 className="text-xl sm:text-2xl font-bold text-surface-900">{form.title}</h1>
                    <p className="text-sm text-surface-600 mt-3">{message}</p>
                </div>
            </div>
        </div>
    );
}
