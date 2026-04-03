"use client";
import React, { useState, Suspense } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { useAuth } from '../context/AuthContext';
import { i18n } from '../lib/i18n-config';
import { useDictionarySafe } from '../context/DictionaryContext';
import Navbar from '../components/Navbar';
import DeadlineBanner from '../components/DeadlineBanner';

type LoginTab = 'email' | 'phone';

export default function LoginPage() {
    return (
        <Suspense fallback={<div className="min-h-screen" style={{ background: 'var(--bg-primary)' }} />}>
            <LoginContent />
        </Suspense>
    );
}

function LoginContent() {
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const redirectTo = searchParams.get('redirect');
    const { login, googleLogin, sendPhoneCode, verifyPhoneCode } = useAuth();
    const dict = useDictionarySafe();
    const t = dict?.auth || {};
    const sortedLocales = [...i18n.locales].sort((a, b) => b.length - a.length);
    const currentLang = sortedLocales.find((l) => pathname.startsWith(`/${l}/`) || pathname === `/${l}`) || i18n.defaultLocale;

    const navigateAfterLogin = () => {
        if (redirectTo) {
            router.push(redirectTo);
        } else {
            router.push(`/${currentLang}`);
        }
    };

    const [tab, setTab] = useState<LoginTab>('email');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [phone, setPhone] = useState('');
    const [otp, setOtp] = useState('');
    const [codeSent, setCodeSent] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleGoogleSignIn = async () => {
        setLoading(true);
        setError('');
        try {
            await googleLogin();
            navigateAfterLogin();
        } catch (err: any) {
            setError(err.message || 'Google sign-in failed.');
        } finally {
            setLoading(false);
        }
    };

    const handleEmailLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError('');
        try {
            await login(email, password);
            navigateAfterLogin();
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleSendCode = async () => {
        if (!phone.trim()) {
            setError('Please enter your phone number.');
            return;
        }
        setLoading(true);
        setError('');
        try {
            const formatted = phone.startsWith('+') ? phone : `+82${phone.replace(/^0/, '')}`;
            await sendPhoneCode(formatted, 'recaptcha-container');
            setCodeSent(true);
        } catch (err: any) {
            setError(err.message || 'Failed to send SMS.');
        } finally {
            setLoading(false);
        }
    };

    const handleVerifyCode = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError('');
        try {
            await verifyPhoneCode(otp);
            navigateAfterLogin();
        } catch (err: any) {
            setError(err.message || 'Invalid verification code.');
        } finally {
            setLoading(false);
        }
    };

    const inputStyle = {
        background: 'var(--bg-elevated)',
        border: '1px solid var(--border-subtle)',
        color: 'var(--text-primary)',
    };

    return (
        <div className="min-h-screen flex flex-col" style={{ background: 'var(--bg-primary)' }}>
            <DeadlineBanner />
            <Navbar />
            <div className="flex-grow flex flex-col justify-center py-12 sm:px-6 lg:px-8">
                <div className="sm:mx-auto sm:w-full sm:max-w-md">
                    <a href={`/${currentLang}`} className="block text-center text-2xl font-black mb-4">
                        <span className="gradient-text">Scorenix</span>
                    </a>
                    <h2 className="text-center text-3xl font-extrabold" style={{ color: 'var(--text-primary)' }}>
                        {t.loginTitle || 'Sign In'}
                    </h2>
                    <p className="mt-2 text-center text-sm" style={{ color: 'var(--text-muted)' }}>
                        {t.noAccount || 'Don\'t have an account?'}{' '}
                        <a href={`/${currentLang}/register`} className="font-medium" style={{ color: 'var(--accent-primary)' }}>
                            {t.registerLink || 'Sign Up'}
                        </a>
                    </p>
                </div>

                <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
                    <div className="glass-card py-8 px-6 sm:px-10">
                        {/* Google Sign-In */}
                        <button
                            onClick={handleGoogleSignIn}
                            disabled={loading}
                            className="w-full flex items-center justify-center gap-3 py-3 rounded-xl text-sm font-bold transition-all hover:brightness-110 mb-5 disabled:opacity-50"
                            style={{ background: '#fff', color: '#333', border: '1px solid #ddd' }}
                        >
                            <svg width="18" height="18" viewBox="0 0 48 48">
                                <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
                                <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
                                <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
                                <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
                            </svg>
                            {t.googleLogin || 'Sign in with Google'}
                        </button>

                        <div className="flex items-center gap-3 mb-5">
                            <div className="flex-1 h-px" style={{ background: 'var(--glass-border)' }}></div>
                            <span className="text-xs font-bold" style={{ color: 'var(--text-muted)' }}>or</span>
                            <div className="flex-1 h-px" style={{ background: 'var(--glass-border)' }}></div>
                        </div>

                        {/* Login Method Tabs */}
                        <div className="flex mb-5 rounded-xl overflow-hidden" style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)' }}>
                            <button
                                onClick={() => { setTab('email'); setError(''); }}
                                className="flex-1 py-2.5 text-sm font-bold transition-all flex items-center justify-center gap-2"
                                style={{
                                    background: tab === 'email' ? 'rgba(0,212,255,0.12)' : 'transparent',
                                    color: tab === 'email' ? 'var(--accent-primary)' : 'var(--text-muted)',
                                    borderBottom: tab === 'email' ? '2px solid var(--accent-primary)' : '2px solid transparent',
                                }}
                            >
                                <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                                </svg>
                                {t.emailLabel || 'Email'}
                            </button>
                            <button
                                onClick={() => { setTab('phone'); setError(''); setCodeSent(false); }}
                                className="flex-1 py-2.5 text-sm font-bold transition-all flex items-center justify-center gap-2"
                                style={{
                                    background: tab === 'phone' ? 'rgba(0,212,255,0.12)' : 'transparent',
                                    color: tab === 'phone' ? 'var(--accent-primary)' : 'var(--text-muted)',
                                    borderBottom: tab === 'phone' ? '2px solid var(--accent-primary)' : '2px solid transparent',
                                }}
                            >
                                <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                                </svg>
                                {t.phoneNumber || 'Phone Number'}
                            </button>
                        </div>

                        {/* ── Email Login Form ── */}
                        {tab === 'email' && (
                            <form className="space-y-5" onSubmit={handleEmailLogin}>
                                <div>
                                    <label htmlFor="email" className="block text-sm font-bold" style={{ color: 'var(--text-secondary)' }}>
                                        {t.emailLabel || 'Email Address'}
                                    </label>
                                    <div className="mt-1">
                                        <input
                                            id="email" type="email" autoComplete="email" required
                                            value={email} onChange={(e) => setEmail(e.target.value)}
                                            placeholder="example@email.com"
                                            className="appearance-none block w-full px-4 py-3 rounded-xl text-sm transition"
                                            style={inputStyle}
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label htmlFor="password" className="block text-sm font-bold" style={{ color: 'var(--text-secondary)' }}>
                                        {t.passwordLabel || 'Password'}
                                    </label>
                                    <div className="mt-1">
                                        <input
                                            id="password" type="password" autoComplete="current-password" required
                                            value={password} onChange={(e) => setPassword(e.target.value)}
                                            placeholder="••••••••"
                                            className="appearance-none block w-full px-4 py-3 rounded-xl text-sm transition"
                                            style={inputStyle}
                                        />
                                    </div>
                                </div>

                                {error && (
                                    <div className="flex items-center space-x-2 p-3 rounded-xl" style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)' }}>
                                        <span>⚠️</span>
                                        <span className="text-sm font-medium" style={{ color: '#f87171' }}>{error}</span>
                                    </div>
                                )}

                                <button
                                    type="submit" disabled={loading}
                                    className="btn-primary w-full py-3 text-sm font-bold disabled:opacity-50 transition-all duration-200"
                                >
                                    {loading ? (
                                        <span className="flex items-center justify-center space-x-2">
                                            <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
                                            </svg>
                                            <span>{t.loginButton || 'Sign In'}...</span>
                                        </span>
                                    ) : (t.loginButton || 'Sign In')}
                                </button>
                            </form>
                        )}

                        {/* ── Phone Login Form ── */}
                        {tab === 'phone' && (
                            <div className="space-y-5">
                                {!codeSent ? (
                                    /* Step 1: Enter phone number */
                                    <div className="space-y-4">
                                        <div>
                                            <label htmlFor="phone" className="block text-sm font-bold mb-1" style={{ color: 'var(--text-secondary)' }}>
                                                {t.phoneNumber || 'Phone Number'}
                                            </label>
                                            <div className="flex gap-2">
                                                <div className="flex items-center px-3 rounded-xl text-sm font-bold"
                                                    style={{ ...inputStyle, minWidth: '72px', justifyContent: 'center' }}>
                                                    🇰🇷 +82
                                                </div>
                                                <input
                                                    id="phone" type="tel" required
                                                    value={phone} onChange={(e) => setPhone(e.target.value)}
                                                    placeholder="01012345678"
                                                    className="appearance-none block w-full px-4 py-3 rounded-xl text-sm transition"
                                                    style={inputStyle}
                                                />
                                            </div>
                                            <p className="mt-1.5 text-xs" style={{ color: 'var(--text-muted)' }}>
                                                Enter numbers only, no hyphens (-)
                                            </p>
                                        </div>

                                        {error && (
                                            <div className="flex items-center space-x-2 p-3 rounded-xl" style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)' }}>
                                                <span>⚠️</span>
                                                <span className="text-sm font-medium" style={{ color: '#f87171' }}>{error}</span>
                                            </div>
                                        )}

                                        <button
                                            onClick={handleSendCode} disabled={loading}
                                            className="btn-primary w-full py-3 text-sm font-bold disabled:opacity-50 transition-all duration-200"
                                        >
                                            {loading ? (
                                                <span className="flex items-center justify-center space-x-2">
                                                    <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
                                                    </svg>
                                                    <span>Sending...</span>
                                                </span>
                                            ) : 'Get Verification Code'}
                                        </button>
                                    </div>
                                ) : (
                                    /* Step 2: Enter OTP code */
                                    <form className="space-y-4" onSubmit={handleVerifyCode}>
                                        <div className="flex items-center gap-2 p-3 rounded-xl" style={{ background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.2)' }}>
                                            <span>✅</span>
                                            <span className="text-sm font-medium" style={{ color: '#4ade80' }}>
                                                {phone} - Verification code sent
                                            </span>
                                        </div>

                                        <div>
                                            <label htmlFor="otp" className="block text-sm font-bold mb-1" style={{ color: 'var(--text-secondary)' }}>
                                                6-digit verification code
                                            </label>
                                            <input
                                                id="otp" type="text" inputMode="numeric" maxLength={6} required
                                                value={otp} onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                                                placeholder="000000"
                                                className="appearance-none block w-full px-4 py-3 rounded-xl text-sm text-center tracking-[0.5em] font-mono font-bold transition"
                                                style={{ ...inputStyle, fontSize: '1.25rem', letterSpacing: '0.3em' }}
                                                autoFocus
                                            />
                                        </div>

                                        {error && (
                                            <div className="flex items-center space-x-2 p-3 rounded-xl" style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)' }}>
                                                <span>⚠️</span>
                                                <span className="text-sm font-medium" style={{ color: '#f87171' }}>{error}</span>
                                            </div>
                                        )}

                                        <button
                                            type="submit" disabled={loading || otp.length < 6}
                                            className="btn-primary w-full py-3 text-sm font-bold disabled:opacity-50 transition-all duration-200"
                                        >
                                            {loading ? (
                                                <span className="flex items-center justify-center space-x-2">
                                                    <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
                                                    </svg>
                                                    <span>Verifying...</span>
                                                </span>
                                            ) : 'Sign In'}
                                        </button>

                                        <button
                                            type="button"
                                            onClick={() => { setCodeSent(false); setOtp(''); setError(''); }}
                                            className="w-full text-center text-xs font-bold py-2 transition"
                                            style={{ color: 'var(--text-muted)' }}
                                        >
                                            ← Re-enter phone number
                                        </button>
                                    </form>
                                )}
                            </div>
                        )}

                        {/* Invisible reCAPTCHA container */}
                        <div id="recaptcha-container"></div>
                    </div>
                </div>
            </div>
        </div>
    );
}
