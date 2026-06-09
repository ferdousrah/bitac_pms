import { Link, usePage } from '@inertiajs/react';

export default function ConsultancyRequestSuccess({ requestNumber }: any) {
    const { props } = usePage<any>();
    const theme = (props.appSettings ?? {}) as { logo_url?: string | null; brand_name?: string };
    const brandName = theme.brand_name || 'BITAC';

    return (
        <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-surface-50 to-indigo-50 flex flex-col">
            <div className="bg-white border-b border-surface-100">
                <div className="max-w-4xl mx-auto px-4 sm:px-6 py-4 flex items-center gap-3">
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
                <div className="max-w-lg w-full text-center">
                    <div className="inline-flex w-20 h-20 rounded-full bg-emerald-100 text-emerald-600 items-center justify-center mb-5 shadow-lg shadow-emerald-100">
                        <i className="fi fi-rr-check text-3xl leading-none" />
                    </div>
                    <h1 className="text-2xl sm:text-3xl font-bold text-surface-900">Request Submitted</h1>
                    <p className="text-sm text-surface-600 mt-3 max-w-md mx-auto">
                        Thank you. Our IED team will review your request and get back to you within 5-7 working days at the email address you provided.
                    </p>

                    {requestNumber && requestNumber !== '—' && (
                        <div className="mt-5 inline-flex flex-col items-center px-5 py-3 rounded-xl bg-white border border-surface-200 shadow-sm">
                            <div className="text-[10px] uppercase tracking-wider text-surface-400 font-bold">Your Reference Number</div>
                            <div className="font-mono font-bold text-xl text-indigo-600 mt-1">{requestNumber}</div>
                            <div className="text-[10px] text-surface-400 mt-1">Please keep this for follow-up</div>
                        </div>
                    )}

                    <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
                        <Link href="/consultancy/request" className="btn-outline btn-sm">
                            <i className="fi fi-rr-plus text-xs leading-none" /> Submit Another
                        </Link>
                        <Link href="/portfolio" target="_blank" className="btn-ghost btn-sm">
                            See BITAC's Portfolio <i className="fi fi-rr-arrow-up-right-from-square text-[10px] leading-none" />
                        </Link>
                    </div>
                </div>
            </div>

            <footer className="bg-white border-t border-surface-100">
                <div className="max-w-4xl mx-auto px-4 sm:px-6 py-5 text-xs text-surface-500 text-center">
                    &copy; {new Date().getFullYear()} <span className="font-semibold text-surface-700">Bangladesh Industrial Technical Assistance Centre</span> · Ministry of Industries, GoB
                </div>
            </footer>
        </div>
    );
}
