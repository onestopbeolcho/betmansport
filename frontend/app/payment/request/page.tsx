"use client";
import React, { useState, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import Navbar from '../../components/Navbar';
import DeadlineBanner from '../../components/DeadlineBanner';
import { useAuth } from '../../context/AuthContext';
import * as PortOne from '@portone/browser-sdk/v2';

const PLANS: Record<string, { name: string; price: number; features: string[] }> = {
    pro: {
        name: "Pro Investor",
        price: 55000,
        features: ["무제한 AI 분석 리포트", "실시간 알림 서비스", "고급 포트폴리오 관리", "단일 경기 심층 분석"],
    },
    vip: {
        name: "VIP",
        price: 105000,
        features: ["Pro 플랜의 모든 기능", "전용 텔레그램 채널", "우선적 고객 지원", "1:1 프리미엄 리포트"],
    },
};

export default function PaymentRequestPage() {
    return (
        <Suspense fallback={
            <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg-primary)' }}>
                <div className="text-center">
                    <div className="inline-block w-8 h-8 border-2 border-t-transparent rounded-full animate-spin mb-3" style={{ borderColor: 'var(--accent-primary)', borderTopColor: 'transparent' }} />
                    <p style={{ color: 'var(--text-muted)' }}>로딩 중...</p>
                </div>
            </div>
        }>
            <PaymentRequestContent />
        </Suspense>
    );
}

function PaymentRequestContent() {
    const searchParams = useSearchParams();
    const planId = searchParams.get('plan') || 'pro';
    const plan = PLANS[planId] || PLANS.pro;
    const { user, token } = useAuth();

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [agreedTerms, setAgreedTerms] = useState(false);
    const [agreedAge, setAgreedAge] = useState(false);

    const handleCheckout = async () => {
        if (!user) {
            setError('로그인이 필요합니다.');
            return;
        }
        if (!agreedTerms || !agreedAge) {
            setError('모든 동의 항목을 체크해주세요.');
            return;
        }

        setLoading(true);
        setError('');

        try {
            const storeId = process.env.NEXT_PUBLIC_PORTONE_STORE_ID || '';
            const channelKey = process.env.NEXT_PUBLIC_PORTONE_CHANNEL_KEY || '';

            // 고유 주문번호 생성
            const paymentId = `SPI_${planId}_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;

            // PortOne 결제창 호출
            const response = await PortOne.requestPayment({
                storeId,
                channelKey,
                paymentId,
                orderName: `Scorenix - ${plan.name} 월간 구독`,
                totalAmount: plan.price,
                currency: 'CURRENCY_KRW',
                payMethod: 'CARD',
                customer: {
                    email: user.email || undefined,
                },
                redirectUrl: `${window.location.origin}/payment/complete?paymentId=${paymentId}&planId=${planId}`,
            });

            // 결제 실패 처리
            if (response?.code) {
                if (response.code === 'FAILURE_TYPE_PG') {
                    throw new Error(response.message || '결제가 실패했습니다.');
                }
                // 사용자가 결제창을 닫은 경우
                setLoading(false);
                return;
            }

            // 결제 성공 → 백엔드에서 검증
            const apiUrl = process.env.NEXT_PUBLIC_API_URL || '';
            const verifyRes = await fetch(`${apiUrl}/api/payments/verify`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`,
                },
                body: JSON.stringify({
                    payment_id: paymentId,
                    plan_id: planId,
                }),
            });

            if (!verifyRes.ok) {
                const data = await verifyRes.json().catch(() => ({}));
                throw new Error(data.detail || '결제 검증에 실패했습니다.');
            }

            // 결제 완료 페이지로 이동
            window.location.href = `/payment/complete?paymentId=${paymentId}&planId=${planId}&status=success`;

        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : '결제 처리 중 오류가 발생했습니다.');
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex flex-col" style={{ background: 'var(--bg-primary)' }}>
            <DeadlineBanner />
            <Navbar />

            <main className="max-w-lg mx-auto px-4 py-16 flex-grow">
                <h1 className="text-2xl font-extrabold mb-8 text-center" style={{ color: 'var(--text-primary)' }}>
                    구독 결제
                </h1>

                <div className="glass-card p-6 space-y-6">
                    {/* Plan Summary */}
                    <div className="text-center p-4 rounded-xl" style={{
                        background: 'linear-gradient(135deg, rgba(0,212,255,0.08), rgba(139,92,246,0.08))',
                        border: '1px solid rgba(0,212,255,0.2)',
                    }}>
                        <p className="text-sm font-bold" style={{ color: 'var(--text-muted)' }}>선택한 요금제</p>
                        <p className="text-xl font-extrabold mt-1 gradient-text">{plan.name}</p>
                        <p className="text-3xl font-extrabold mt-2" style={{ color: 'var(--text-primary)' }}>
                            {plan.price.toLocaleString()}원
                            <span className="text-sm font-normal" style={{ color: 'var(--text-muted)' }}>/월</span>
                        </p>
                    </div>

                    {/* Features */}
                    <ul className="space-y-2.5 text-sm" style={{ color: 'var(--text-secondary)' }}>
                        {plan.features.map((f, i) => (
                            <li key={i} className="flex items-center gap-2">
                                <span style={{ color: 'var(--accent-primary)' }}>✓</span>
                                {f}
                            </li>
                        ))}
                    </ul>

                    {/* Payment Badge */}
                    <div className="flex items-center justify-center gap-2 py-2 text-xs" style={{ color: 'var(--text-muted)' }}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <rect x="1" y="4" width="22" height="16" rx="2" ry="2" />
                            <line x1="1" y1="10" x2="23" y2="10" />
                        </svg>
                        PortOne 보안 결제 · 카드 / 간편결제 / 계좌이체
                    </div>

                    {/* Agreements */}
                    <div className="space-y-3 pt-4" style={{ borderTop: '1px solid var(--border-subtle)' }}>
                        <label className="flex items-start gap-3 cursor-pointer">
                            <input
                                type="checkbox"
                                checked={agreedTerms}
                                onChange={(e) => setAgreedTerms(e.target.checked)}
                                className="mt-0.5 accent-[var(--accent-primary)]"
                            />
                            <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                                <Link href="/terms" className="underline" style={{ color: 'var(--accent-primary)' }}>이용약관</Link>,{' '}
                                <Link href="/privacy" className="underline" style={{ color: 'var(--accent-primary)' }}>개인정보처리방침</Link>,{' '}
                                <Link href="/refund" className="underline" style={{ color: 'var(--accent-primary)' }}>환불정책</Link>,{' '}
                                <Link href="/disclaimer" className="underline" style={{ color: 'var(--accent-primary)' }}>분석 위험 고지</Link>에 동의합니다.
                            </span>
                        </label>
                        <label className="flex items-start gap-3 cursor-pointer">
                            <input
                                type="checkbox"
                                checked={agreedAge}
                                onChange={(e) => setAgreedAge(e.target.checked)}
                                className="mt-0.5 accent-[var(--accent-primary)]"
                            />
                            <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                                만 19세 이상이며, 본 서비스가 투자 조언이 아닌 통계 분석 도구임을 이해합니다.
                            </span>
                        </label>
                    </div>

                    {/* Error */}
                    {error && (
                        <div className="p-3 rounded-lg text-xs text-center" style={{
                            background: 'rgba(255,59,48,0.1)',
                            color: '#FF3B30',
                            border: '1px solid rgba(255,59,48,0.3)',
                        }}>
                            {error}
                        </div>
                    )}

                    {/* CTA */}
                    {!user ? (
                        <Link href="/login" className="block w-full py-3 text-sm font-bold text-center rounded-xl transition"
                            style={{
                                background: 'rgba(0,212,255,0.1)',
                                color: 'var(--accent-primary)',
                                border: '1px solid rgba(0,212,255,0.3)',
                            }}>
                            로그인 후 결제하기
                        </Link>
                    ) : (
                        <button
                            onClick={handleCheckout}
                            disabled={loading || !agreedTerms || !agreedAge}
                            className="btn-primary w-full py-3.5 text-sm font-bold disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                        >
                            {loading ? (
                                <>
                                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                    결제 처리 중...
                                </>
                            ) : (
                                `💳 ${plan.price.toLocaleString()}원 결제하기`
                            )}
                        </button>
                    )}

                    {/* Notes */}
                    <div className="text-[10px] text-center space-y-1" style={{ color: 'var(--text-muted)' }}>
                        <p>PortOne 보안 결제 · 카드/간편결제 지원</p>
                        <p>결제일로부터 30일간 이용 가능 · 언제든 해지 가능</p>
                    </div>
                </div>

                <div className="mt-4 text-center">
                    <Link href="/pricing" className="text-xs underline transition" style={{ color: 'var(--text-muted)' }}>
                        ← 다른 요금제 보기
                    </Link>
                </div>
            </main>
        </div>
    );
}
