import { Link, useForm, usePage } from '@inertiajs/react';
import { FormEvent, useState } from 'react';
import StakeholderAuthShell, { StakeholderHead } from '@/Components/Auth/StakeholderAuthShell';
import { AuthBitac, AuthField, AuthStatus, authInputClass } from '@/Components/Auth/AuthField';

/**
 * The customer portal's sign-in — reached from the public website's
 * "Stakeholder Login", so it calls itself the Stakeholder Portal.
 */
export default function CustomerLogin({ bitac }: { bitac?: AuthBitac | null }) {
    const { flash } = usePage().props as any;
    const [showPassword, setShowPassword] = useState(false);
    const successMsg = flash?.success as string | undefined;

    const { data, setData, post, errors, processing } = useForm({
        email: '',
        password: '',
        remember: false,
    });

    const submit = (e: FormEvent) => {
        e.preventDefault();
        post('/customer/login');
    };

    return (
        <StakeholderAuthShell title="Stakeholder Portal — Sign In" bitac={bitac}>
            <StakeholderHead title="Welcome back" lead="Sign in to follow your jobs, quotations, bills and documents." />

            {successMsg && <div className="mt-6"><AuthStatus>{successMsg}</AuthStatus></div>}

            <form onSubmit={submit} className="mt-8 space-y-5">
                <AuthField id="email" label="Email" error={errors.email} icon="fi-rr-envelope">
                    <input
                        id="email" type="email" value={data.email}
                        onChange={e => setData('email', e.target.value)}
                        className={authInputClass(!!errors.email)}
                        placeholder="you@company.com" autoComplete="username" autoFocus required
                    />
                </AuthField>

                <AuthField id="password" label="Password" error={errors.password} icon="fi-rr-lock"
                           aside={<Link href="/customer/password/forgot" className="text-[13px] font-semibold text-brand-700 hover:underline underline-offset-2">Forgot password?</Link>}>
                    <input
                        id="password" type={showPassword ? 'text' : 'password'} value={data.password}
                        onChange={e => setData('password', e.target.value)}
                        className={authInputClass(!!errors.password) + ' pr-12'}
                        placeholder="Your password" autoComplete="current-password" required
                    />
                    <button type="button" onClick={() => setShowPassword(!showPassword)}
                            aria-label={showPassword ? 'Hide password' : 'Show password'}
                            className="absolute inset-y-0 right-0 w-12 flex items-center justify-center text-surface-400 hover:text-surface-800 transition-colors">
                        <i className={`fi ${showPassword ? 'fi-rr-eye-crossed' : 'fi-rr-eye'} text-sm leading-none`} />
                    </button>
                </AuthField>

                <label className="flex items-center gap-2.5 cursor-pointer select-none w-fit">
                    <input type="checkbox" checked={data.remember}
                           onChange={e => setData('remember', e.target.checked)}
                           className="w-4 h-4 rounded border-surface-300 text-brand-600 focus:ring-brand-500/30" />
                    <span className="text-sm text-surface-700">Keep me signed in</span>
                </label>

                <button type="submit" disabled={processing}
                        className="w-full h-12 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-[15px] font-semibold
                                   disabled:opacity-60 disabled:cursor-not-allowed active:scale-[0.99] transition-all
                                   flex items-center justify-center gap-2">
                    {processing
                        ? <><i className="fi fi-rr-spinner animate-spin text-sm leading-none" /> Signing in…</>
                        : <>Sign in <i className="fi fi-rr-arrow-small-right text-lg leading-none" /></>}
                </button>
            </form>

            <div className="mt-10 pt-6 border-t border-surface-200 text-sm text-surface-600 leading-relaxed">
                Accounts are opened by BITAC for the organisations it works with.
            </div>
        </StakeholderAuthShell>
    );
}
