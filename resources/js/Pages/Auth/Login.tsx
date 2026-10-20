import { Link, useForm } from '@inertiajs/react';
import { FormEventHandler, useState } from 'react';
import StaffAuthShell, { StaffCardHead } from '@/Components/Auth/StaffAuthShell';
import { AuthBitac, AuthField, AuthStatus, authInputClass } from '@/Components/Auth/AuthField';

/** Staff sign-in for BITAC PMS — see `StaffAuthShell` for why it looks unlike the stakeholder one. */
export default function Login({ status, canResetPassword, bitac }: {
    status?: string;
    canResetPassword: boolean;
    bitac?: AuthBitac | null;
}) {
    const [showPassword, setShowPassword] = useState(false);

    const { data, setData, post, processing, errors, reset } = useForm({
        email: '',
        password: '',
        remember: false as boolean,
    });

    const submit: FormEventHandler = (e) => {
        e.preventDefault();
        post(route('login'), { onFinish: () => reset('password') });
    };

    return (
        <StaffAuthShell title="Staff Sign In — BITAC PMS" bitac={bitac}>
            <StaffCardHead title="Staff sign in" subtitle="BITAC PMS · Production Management System" icon="fi-rr-shield-check" />

            {status && <div className="mt-6"><AuthStatus>{status}</AuthStatus></div>}

            <form onSubmit={submit} className="mt-7 space-y-5">
                <AuthField id="email" label="Email" icon="fi-rr-envelope" error={errors.email}>
                    <input
                        id="email" type="email" value={data.email}
                        onChange={e => setData('email', e.target.value)}
                        className={authInputClass(!!errors.email, true)}
                        placeholder="you@bitac.gov.bd" autoComplete="username" autoFocus required
                    />
                </AuthField>

                <AuthField id="password" label="Password" icon="fi-rr-lock" error={errors.password}
                           aside={canResetPassword && (
                               <Link href={route('password.request')} className="text-[13px] font-semibold text-brand-700 hover:underline underline-offset-2">
                                   Forgot password?
                               </Link>
                           )}>
                    <input
                        id="password" type={showPassword ? 'text' : 'password'} value={data.password}
                        onChange={e => setData('password', e.target.value)}
                        className={authInputClass(!!errors.password, true) + ' pr-12'}
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
                           onChange={e => setData('remember', e.target.checked as any)}
                           className="w-4 h-4 rounded border-surface-300 text-brand-600 focus:ring-brand-500/30" />
                    <span className="text-sm text-surface-700">Keep me signed in</span>
                </label>

                <button type="submit" disabled={processing}
                        className="group w-full h-12 rounded-xl bg-ink-950 hover:bg-brand-700 text-white text-[15px] font-semibold
                                   disabled:opacity-60 disabled:cursor-not-allowed active:scale-[0.99] transition-all
                                   flex items-center justify-center gap-2">
                    {processing
                        ? <><i className="fi fi-rr-spinner animate-spin text-sm leading-none" /> Signing in…</>
                        : <>Sign in <i className="fi fi-rr-arrow-small-right text-lg leading-none group-hover:translate-x-0.5 transition-transform" /></>}
                </button>
            </form>

            <p className="mt-7 pt-5 border-t border-surface-200 text-xs text-surface-500 leading-relaxed flex items-start gap-2">
                <i className="fi fi-rr-info text-xs leading-none mt-0.5 shrink-0" />
                For BITAC staff only. Accounts are created by the system administrator.
            </p>
        </StaffAuthShell>
    );
}
