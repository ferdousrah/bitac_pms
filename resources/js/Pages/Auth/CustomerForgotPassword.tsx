import { Link, useForm } from '@inertiajs/react';
import { FormEventHandler } from 'react';
import StakeholderAuthShell, { StakeholderHead } from '@/Components/Auth/StakeholderAuthShell';
import { AuthBitac, AuthField, AuthStatus, authInputClass } from '@/Components/Auth/AuthField';

/** Stakeholder "forgot password" — the same panel and form as the stakeholder sign-in. */
export default function CustomerForgotPassword({ status, bitac, expireMinutes = 60 }: {
    status?: string; bitac?: AuthBitac | null; expireMinutes?: number;
}) {
    const { data, setData, post, processing, errors } = useForm({ email: '' });

    const submit: FormEventHandler = (e) => {
        e.preventDefault();
        post('/customer/password/forgot');
    };

    return (
        <StakeholderAuthShell title="Stakeholder Portal — Reset Password" bitac={bitac}>
            <StakeholderHead
                title="Forgot your password?"
                lead="Enter the email your account is registered with and we will send a link to set a new one."
                badgeIcon="fi-rr-key"
            />

            {status && (
                <div className="mt-6">
                    <AuthStatus>
                        {status}
                        <span className="block text-emerald-700/80 mt-1">The link expires in {expireMinutes} minutes. Not there? Check spam, or send it again.</span>
                    </AuthStatus>
                </div>
            )}

            <form onSubmit={submit} className="mt-8 space-y-5">
                <AuthField id="email" label="Email" icon="fi-rr-envelope" error={errors.email}>
                    <input
                        id="email" type="email" value={data.email}
                        onChange={e => setData('email', e.target.value)}
                        className={authInputClass(!!errors.email)}
                        placeholder="you@company.com" autoComplete="username" autoFocus required
                    />
                </AuthField>

                <button type="submit" disabled={processing}
                        className="w-full h-12 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-[15px] font-semibold
                                   disabled:opacity-60 disabled:cursor-not-allowed active:scale-[0.99] transition-all
                                   flex items-center justify-center gap-2">
                    {processing
                        ? <><i className="fi fi-rr-spinner animate-spin text-sm leading-none" /> Sending…</>
                        : <><i className="fi fi-rr-paper-plane text-sm leading-none" /> {status ? 'Send the link again' : 'Send reset link'}</>}
                </button>
            </form>

            <div className="mt-8">
                <Link href="/customer/login" className="inline-flex items-center gap-1.5 text-sm font-semibold text-surface-800 hover:text-brand-700 transition-colors">
                    <i className="fi fi-rr-arrow-small-left text-base leading-none" /> Back to sign in
                </Link>
            </div>

            <div className="mt-8 pt-6 border-t border-surface-200 text-sm text-surface-600 leading-relaxed">
                Changed your email, or no longer have access to it? BITAC can update it for you.
            </div>
        </StakeholderAuthShell>
    );
}
