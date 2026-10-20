import { Link, useForm } from '@inertiajs/react';
import { FormEventHandler } from 'react';
import StaffAuthShell, { StaffCardHead } from '@/Components/Auth/StaffAuthShell';
import { AuthBitac, AuthField, AuthStatus, authInputClass } from '@/Components/Auth/AuthField';

/** Staff "forgot password" — the same card on the same backdrop as the staff sign-in. */
export default function ForgotPassword({ status, bitac, expireMinutes = 60 }: {
    status?: string; bitac?: AuthBitac | null; expireMinutes?: number;
}) {
    const { data, setData, post, processing, errors } = useForm({ email: '' });

    const submit: FormEventHandler = (e) => {
        e.preventDefault();
        post(route('password.email'));
    };

    return (
        <StaffAuthShell title="Forgot Password — BITAC PMS" bitac={bitac}>
            <StaffCardHead
                title="Forgot your password?"
                subtitle="Enter the email you sign in with and we will send a link to set a new one."
                icon="fi-rr-key"
            />

            {status && (
                <div className="mt-6">
                    <AuthStatus>
                        {status}
                        <span className="block text-emerald-700/80 mt-1">The link expires in {expireMinutes} minutes. Not there? Check spam, or send it again.</span>
                    </AuthStatus>
                </div>
            )}

            <form onSubmit={submit} className="mt-7 space-y-5">
                <AuthField id="email" label="Email" icon="fi-rr-envelope" error={errors.email}>
                    <input
                        id="email" type="email" value={data.email}
                        onChange={e => setData('email', e.target.value)}
                        className={authInputClass(!!errors.email, true)}
                        placeholder="you@bitac.gov.bd" autoComplete="username" autoFocus required
                    />
                </AuthField>

                <button type="submit" disabled={processing}
                        className="group w-full h-12 rounded-xl bg-ink-950 hover:bg-brand-700 text-white text-[15px] font-semibold
                                   disabled:opacity-60 disabled:cursor-not-allowed active:scale-[0.99] transition-all
                                   flex items-center justify-center gap-2">
                    {processing
                        ? <><i className="fi fi-rr-spinner animate-spin text-sm leading-none" /> Sending…</>
                        : <><i className="fi fi-rr-paper-plane text-sm leading-none" /> {status ? 'Send the link again' : 'Send reset link'}</>}
                </button>
            </form>

            <div className="mt-7 pt-5 border-t border-surface-200 flex items-center justify-between gap-3">
                <Link href={route('login')} className="shrink-0 whitespace-nowrap inline-flex items-center gap-1.5 text-sm font-semibold text-surface-800 hover:text-brand-700 transition-colors">
                    <i className="fi fi-rr-arrow-small-left text-base leading-none" /> Back to sign in
                </Link>
                <span className="text-xs text-surface-500 text-right">No email on file? Ask the system administrator.</span>
            </div>
        </StaffAuthShell>
    );
}
