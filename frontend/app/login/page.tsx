"use client";
import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '../context/AuthContext';
import Navbar from '../components/Navbar';
import DeadlineBanner from '../components/DeadlineBanner';

export default function LoginPage() {
    const router = useRouter();
    const { login, googleLogin } = useAuth();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleGoogleSignIn = async () => {
        setLoading(true);
        setError('');
        try {
            await googleLogin();
            router.push('/');
        } catch (err: any) {
            setError(err.message || 'Google 로그인에 실패했습니다.');
        } finally {
            setLoading(false);
        }
    };



    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        try {
            await login(email, password);
            router.push('/');
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex flex-col" style={{ background: 'var(--bg-primary)' }}>
            <DeadlineBanner />
            <Navbar />
            <div className="flex-grow flex flex-col justify-center py-12 sm:px-6 lg:px-8">
                <div className="sm:mx-auto sm:w-full sm:max-w-md">
                    <Link href="/" className="block text-center text-2xl font-black mb-4">
                        <span className="gradient-text">Scorenix</span>
                    </Link>
                    <h2 className="text-center text-3xl font-extrabold" style={{ color: 'var(--text-primary)' }}>
                        로그인
                    </h2>
                    <p className="mt-2 text-center text-sm" style={{ color: 'var(--text-muted)' }}>
                        아직 회원이 아니신가요?{' '}
                        <Link href="/register" className="font-medium" style={{ color: 'var(--accent-primary)' }}>
                            회원가입
                        </Link>
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
                            Google 계정으로 로그인
                        </button>

                        <div className="flex items-center gap-3 mb-5">
                            <div className="flex-1 h-px" style={{ background: 'var(--glass-border)' }}></div>
                            <span className="text-xs font-bold" style={{ color: 'var(--text-muted)' }}>또는</span>
                            <div className="flex-1 h-px" style={{ background: 'var(--glass-border)' }}></div>
                        </div>

                        <form className="space-y-6" onSubmit={handleLogin}>
                            <div>
                                <label htmlFor="email" className="block text-sm font-bold" style={{ color: 'var(--text-secondary)' }}>
                                    이메일 주소
                                </label>
                                <div className="mt-1">
                                    <input
                                        id="email"
                                        name="email"
                                        type="email"
                                        autoComplete="email"
                                        required
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        placeholder="example@email.com"
                                        className="appearance-none block w-full px-4 py-3 rounded-xl text-sm transition"
                                        style={{
                                            background: 'var(--bg-elevated)',
                                            border: '1px solid var(--border-subtle)',
                                            color: 'var(--text-primary)',
                                        }}
                                    />
                                </div>
                            </div>

                            <div>
                                <label htmlFor="password" className="block text-sm font-bold" style={{ color: 'var(--text-secondary)' }}>
                                    비밀번호
                                </label>
                                <div className="mt-1">
                                    <input
                                        id="password"
                                        name="password"
                                        type="password"
                                        autoComplete="current-password"
                                        required
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        placeholder="••••••••"
                                        className="appearance-none block w-full px-4 py-3 rounded-xl text-sm transition"
                                        style={{
                                            background: 'var(--bg-elevated)',
                                            border: '1px solid var(--border-subtle)',
                                            color: 'var(--text-primary)',
                                        }}
                                    />
                                </div>
                            </div>

                            {error && (
                                <div className="flex items-center space-x-2 p-3 rounded-xl" style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)' }}>
                                    <span>⚠️</span>
                                    <span className="text-sm font-medium" style={{ color: '#f87171' }}>{error}</span>
                                </div>
                            )}

                            <div>
                                <button
                                    type="submit"
                                    disabled={loading}
                                    className="btn-primary w-full py-3 text-sm font-bold disabled:opacity-50 transition-all duration-200"
                                >
                                    {loading ? (
                                        <span className="flex items-center justify-center space-x-2">
                                            <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
                                            </svg>
                                            <span>로그인 중...</span>
                                        </span>
                                    ) : '로그인'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            </div>
        </div>
    );
}
