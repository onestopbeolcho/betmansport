"use client";
import React, { useEffect, useState, Suspense } from 'react';
import { useSearchParams, usePathname } from 'next/navigation';
import Navbar from '../../components/Navbar';
import DeadlineBanner from '../../components/DeadlineBanner';
import { i18n } from '../../lib/i18n-config';

export default function PaymentSuccessPage() {
    return (
        <Suspense fallback={
            <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg-primary)' }}>
                <div className="inline-block w-8 h-8 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: 'var(--accent-primary)', borderTopColor: 'transparent' }} />
            </div>
        }>
            <SuccessContent />
        </Suspense>
    );
}

function SuccessContent() {
    const searchParams = useSearchParams();
    const pathname = usePathname();
    const sessionId = searchParams.get('session_id');
    const [show, setShow] = useState(false);
    const sortedLocales = [...i18n.locales].sort((a, b) => b.length - a.length);
    const currentLang = sortedLocales.find((l) => pathname.startsWith(`/${l}/`) || pathname === `/${l}`) || i18n.defaultLocale;

    useEffect(() => {
        setTimeout(() => setShow(true), 100);
    }, []);

    return (
        <div className="min-h-screen flex flex-col" style={{ background: 'var(--bg-primary)' }}>
            <DeadlineBanner />
            <Navbar />

            <main className="max-w-lg mx-auto px-4 py-20 flex-grow flex items-center">
                <div className={`glass-card p-8 w-full text-center space-y-6 transition-all duration-700 ${show ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>

                    {/* Success Icon */}
                    <div className="relative mx-auto w-24 h-24">
                        <div className="absolute inset-0 rounded-full animate-ping opacity-20" style={{ background: 'var(--accent-primary)' }} />
                        <div className="relative w-24 h-24 rounded-full flex items-center justify-center text-5xl"
                            style={{
                                background: 'linear-gradient(135deg, rgba(52,199,89,0.2), rgba(0,212,255,0.2))',
                                border: '2px solid rgba(52,199,89,0.4)',
                            }}>
                            🎉
                        </div>
                    </div>

                    <h1 className="text-2xl font-extrabold" style={{ color: 'var(--text-primary)' }}>
                        Payment Successful!
                    </h1>

                    <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                        Your premium membership has been activated.
                        <br />You now have access to all premium features.
                    </p>

                    {/* Quick Links */}
                    <div className="grid grid-cols-2 gap-3 pt-4">
                        <a href={`/${currentLang}/bets`}
                            className="p-3 rounded-xl text-xs font-bold text-center transition-all hover:scale-[1.02]"
                            style={{
                                background: 'rgba(0,212,255,0.1)',
                                color: 'var(--accent-primary)',
                                border: '1px solid rgba(0,212,255,0.2)',
                            }}>
                            📊 Value Analysis
                        </a>
                        <a href={`/${currentLang}/market`}
                            className="p-3 rounded-xl text-xs font-bold text-center transition-all hover:scale-[1.02]"
                            style={{
                                background: 'rgba(139,92,246,0.1)',
                                color: 'var(--accent-secondary)',
                                border: '1px solid rgba(139,92,246,0.2)',
                            }}>
                            🧠 AI Predictions
                        </a>
                    </div>

                    <a href={`/${currentLang}/mypage`} className="btn-primary block w-full py-3 text-sm font-bold text-center">
                        Manage My Subscription →
                    </a>

                    {sessionId && (
                        <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
                            Payment ID: {sessionId.slice(0, 20)}...
                        </p>
                    )}
                </div>
            </main>
        </div>
    );
}
