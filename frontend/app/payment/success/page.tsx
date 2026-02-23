"use client";
import React, { useEffect, useState, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import Navbar from '../../components/Navbar';
import DeadlineBanner from '../../components/DeadlineBanner';

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
    const sessionId = searchParams.get('session_id');
    const [show, setShow] = useState(false);

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
                        결제가 완료되었습니다!
                    </h1>

                    <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                        프리미엄 멤버십이 활성화되었습니다.
                        <br />지금부터 모든 프리미엄 기능을 이용하실 수 있습니다.
                    </p>

                    {/* Quick Links */}
                    <div className="grid grid-cols-2 gap-3 pt-4">
                        <Link href="/bets"
                            className="p-3 rounded-xl text-xs font-bold text-center transition-all hover:scale-[1.02]"
                            style={{
                                background: 'rgba(0,212,255,0.1)',
                                color: 'var(--accent-primary)',
                                border: '1px solid rgba(0,212,255,0.2)',
                            }}>
                            📊 밸류벳 분석
                        </Link>
                        <Link href="/market"
                            className="p-3 rounded-xl text-xs font-bold text-center transition-all hover:scale-[1.02]"
                            style={{
                                background: 'rgba(139,92,246,0.1)',
                                color: 'var(--accent-secondary)',
                                border: '1px solid rgba(139,92,246,0.2)',
                            }}>
                            🧠 AI 예측
                        </Link>
                    </div>

                    <Link href="/mypage" className="btn-primary block w-full py-3 text-sm font-bold text-center">
                        내 구독 관리 →
                    </Link>

                    {sessionId && (
                        <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
                            결제 ID: {sessionId.slice(0, 20)}...
                        </p>
                    )}
                </div>
            </main>
        </div>
    );
}
