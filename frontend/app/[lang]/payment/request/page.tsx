"use client";
import React, { useState, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams, usePathname } from 'next/navigation';
import Navbar from '../../../components/Navbar';
import DeadlineBanner from '../../../components/DeadlineBanner';
import { useAuth } from '../../../context/AuthContext';
import { useDictionary } from '../../../context/DictionaryContext';
import { i18n } from '../../../lib/i18n-config';
import * as PortOne from '@portone/browser-sdk/v2';

const PLANS: Record<string, Record<string, { name: string; orderLabel: string; price: number; features: string[] }>> = {
    ko: {
        pro: {
            name: "Basic Pass (데이터 분석 리포트 구독권)",
            orderLabel: "스코어닉스 데이터 분석 리포트 구독권 (Basic Pass)",
            price: 3900,
            features: [
                "전 리그 머신러닝 시뮬레이션 확률 무제한 열람",
                "AI 핵심 밸류 리포트 (+EV 상위 3경기) 잠금 해제",
                "포아송 득점 기대치(xG) 및 7-Factor 전력 지표",
                "글로벌 표준 시장 확률 지수 편차 분석",
            ],
        },
        vip: {
            name: "Pro Quant (통합 퀀트 데이터 멤버십)",
            orderLabel: "스코어닉스 통합 퀀트 데이터 멤버십 (Pro Quant)",
            price: 9900,
            features: [
                "Basic Pass 전체 데이터 리포트 기능 포함",
                "켈리 공식(Kelly Criterion) 비중 배분 시뮬레이터",
                "다중 경기 확률 조합 시뮬레이터 무제한",
                "배당률 왜곡 감지 실시간 알림 & 백테스트 원본 지표",
            ],
        },
    },
    en: {
        pro: {
            name: "Basic Pass (Data Analytics Report Membership)",
            orderLabel: "Scorenix Digital Data Report Membership (Basic Pass)",
            price: 299,
            features: [
                "Unlimited ML simulation probability reports (17 leagues)",
                "Top 3 +EV Value Anomaly Reports unlocked",
                "Poisson xG & 7-Factor tactical index breakdown",
                "Global market implied probability gap analysis",
            ],
        },
        vip: {
            name: "Pro Quant (Full Quant Data Membership)",
            orderLabel: "Scorenix Digital Data Report Membership (Pro Quant)",
            price: 699,
            features: [
                "All Basic Pass data report features included",
                "Kelly Criterion capital allocation simulator",
                "Multi-match probability combination simulator",
                "Real-time odds distortion alerts & raw backtest logs",
            ],
        },
    },
};

export default function PaymentRequestPage() {
    return (
        <Suspense fallback={
            <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg-primary)' }}>
                <div className="text-center">
                    <div className="inline-block w-8 h-8 border-2 border-t-transparent rounded-full animate-spin mb-3" style={{ borderColor: 'var(--accent-primary)', borderTopColor: 'transparent' }} />
                </div>
            </div>
        }>
            <PaymentRequestContent />
        </Suspense>
    );
}

function PaymentRequestContent() {
    const searchParams = useSearchParams();
    const pathname = usePathname() || '';
    const planId = searchParams.get('plan') || 'pro';
    const billingParam = searchParams.get('billing') === 'annual' ? 'annual' : 'monthly';
    const currentLang = i18n.locales.find((l) => pathname.startsWith(`/${l}/`) || pathname === `/${l}`) || i18n.defaultLocale;
    const currency = currentLang === 'en' ? 'USD' : 'KRW';
    const planSet = PLANS[currentLang] || PLANS.ko;
    const plan = planSet[planId] || planSet.pro;
    const { user, token } = useAuth();

    const finalAmount = billingParam === 'annual' && currency === 'KRW'
        ? Math.round(plan.price * 0.8) * 12
        : plan.price;

    let dict;
    try {
        // eslint-disable-next-line react-hooks/rules-of-hooks
        dict = useDictionary();
    } catch { dict = null; }
    const t = dict?.payment || {};

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [buyerName, setBuyerName] = useState('');
    const [phoneNumber, setPhoneNumber] = useState('');
    const [agreedTerms, setAgreedTerms] = useState(false);
    const [agreedAge, setAgreedAge] = useState(false);

    React.useEffect(() => {
        if (user) {
            if (user.full_name && !buyerName) setBuyerName(user.full_name);
            if (user.phone && !phoneNumber) {
                const digits = user.phone.replace(/\D/g, '');
                if (digits.length >= 10) {
                    setPhoneNumber(`${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`);
                }
            }
        }
    }, [user]);

    const formatPhone = (value: string) => {
        const digits = value.replace(/\D/g, '').slice(0, 11);
        if (digits.length <= 3) return digits;
        if (digits.length <= 7) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
        return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
    };
    const phoneDigits = phoneNumber.replace(/\D/g, '');
    const isPhoneValid = phoneDigits.length === 10 || phoneDigits.length === 11;

    const formatPrice = (amount: number) => {
        if (currency === 'USD') return `$${(amount / 100).toFixed(2)}`;
        return `${amount.toLocaleString()}원`;
    };

    const handleCheckout = async () => {
        if (!user) { setError(t.errorLogin || '로그인이 필요합니다.'); return; }
        if (!buyerName.trim()) { setError('구매자명을 입력해주세요.'); return; }
        if (!isPhoneValid) { setError('휴대폰 번호를 정확히 입력해주세요.'); return; }
        if (!agreedTerms || !agreedAge) { setError(t.errorAgree || '모든 동의 항목을 체크해주세요.'); return; }

        setLoading(true); setError('');

        try {
            const storeId = process.env.NEXT_PUBLIC_PORTONE_STORE_ID || '';
            const channelKey = process.env.NEXT_PUBLIC_PORTONE_CHANNEL_KEY || '';
            const paymentId = `SPI_${planId}_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;

            const response = await PortOne.requestPayment({
                storeId, channelKey, paymentId,
                orderName: plan.orderLabel,
                totalAmount: finalAmount,
                currency: currency === 'USD' ? 'CURRENCY_USD' : 'CURRENCY_KRW',
                payMethod: 'CARD',
                customer: {
                    fullName: buyerName.trim() || undefined,
                    email: user.email || undefined,
                    phoneNumber: phoneDigits || undefined,
                },
                redirectUrl: `${window.location.origin}/${currentLang}/payment/complete?paymentId=${paymentId}&planId=${planId}`,
            });

            if (response?.code) {
                if (response.code === 'FAILURE_TYPE_PG') throw new Error(response.message || 'Payment failed.');
                setLoading(false); return;
            }

            const apiUrl = process.env.NEXT_PUBLIC_API_URL || '';
            const verifyRes = await fetch(`${apiUrl}/api/payments/verify`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({ payment_id: paymentId, plan_id: planId, billing: billingParam }),
            });

            if (!verifyRes.ok) {
                const data = await verifyRes.json().catch(() => ({}));
                throw new Error(data.detail || 'Payment verification failed.');
            }

            window.location.href = `/${currentLang}/payment/complete?paymentId=${paymentId}&planId=${planId}&status=success`;
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : (t.errorGeneral || '결제 처리 중 오류가 발생했습니다.'));
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex flex-col" style={{ background: 'var(--bg-primary)' }}>
            <DeadlineBanner />
            <Navbar />

            <main className="max-w-lg mx-auto px-4 py-16 flex-grow">
                <h1 className="text-2xl font-extrabold mb-3 text-center" style={{ color: 'var(--text-primary)' }}>
                    데이터 분석 리포트 구독 결제
                </h1>
                <p className="text-xs text-center mb-8" style={{ color: 'var(--text-muted)' }}>
                    스포츠 통계 데이터베이스 및 알고리즘 시뮬레이션 SaaS 멤버십
                </p>

                <div className="glass-card p-6 space-y-6">
                    <div className="text-center p-4 rounded-xl" style={{ background: 'linear-gradient(135deg, rgba(0,212,255,0.08), rgba(139,92,246,0.08))', border: '1px solid rgba(0,212,255,0.2)' }}>
                        <p className="text-xs font-bold" style={{ color: 'var(--text-muted)' }}>선택한 디지털 리포트 구독권</p>
                        <p className="text-lg font-extrabold mt-1 gradient-text">{plan.name}</p>
                        <p className="text-3xl font-extrabold mt-2" style={{ color: 'var(--text-primary)' }}>
                            {formatPrice(finalAmount)}
                            <span className="text-sm font-normal" style={{ color: 'var(--text-muted)' }}>
                                {billingParam === 'annual' ? '/연 (20% 할인)' : '/월'}
                            </span>
                        </p>
                    </div>

                    <ul className="space-y-2.5 text-sm" style={{ color: 'var(--text-secondary)' }}>
                        {plan.features.map((f, i) => (
                            <li key={i} className="flex items-center gap-2">
                                <span style={{ color: 'var(--accent-primary)' }}>✓</span>{f}
                            </li>
                        ))}
                    </ul>

                    <div className="flex items-center justify-center gap-2 py-2 text-xs" style={{ color: 'var(--text-muted)' }}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <rect x="1" y="4" width="22" height="16" rx="2" ry="2" />
                            <line x1="1" y1="10" x2="23" y2="10" />
                        </svg>
                        KG이니시스 보안 결제 · 신용/체크카드 / 카카오페이 / 네이버페이
                    </div>

                    {/* ── 구매자 정보 (KG이니시스 필수) ── */}
                    <div className="space-y-3 pt-4" style={{ borderTop: '1px solid var(--border-subtle)' }}>
                        <p className="text-xs font-bold" style={{ color: 'var(--text-muted)' }}>구매자 정보 (필수)</p>
                        <div className="space-y-1.5">
                            <label className="text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>
                                👤 구매자명 <span style={{ color: '#ef4444' }}>*</span>
                            </label>
                            <input
                                type="text"
                                value={buyerName}
                                onChange={(e) => setBuyerName(e.target.value)}
                                placeholder="홍길동"
                                className="w-full px-4 py-3 rounded-xl text-sm outline-none"
                                style={{ background: 'var(--bg-elevated)', color: 'var(--text-primary)', border: '1px solid var(--border-subtle)' }}
                            />
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>
                                📱 휴대폰 번호 <span style={{ color: '#ef4444' }}>*</span>
                            </label>
                            <input
                                type="tel"
                                value={phoneNumber}
                                onChange={(e) => setPhoneNumber(formatPhone(e.target.value))}
                                placeholder="010-0000-0000"
                                className="w-full px-4 py-3 rounded-xl text-sm outline-none"
                                style={{
                                    background: 'var(--bg-elevated)',
                                    color: 'var(--text-primary)',
                                    border: `1px solid ${phoneNumber && !isPhoneValid ? '#ef4444' : 'var(--border-subtle)'}`,
                                }}
                            />
                        </div>
                    </div>

                    {/* ── 필수 법적 면책 조항 고지 ── */}
                    <div className="p-3.5 rounded-xl text-[11px] leading-relaxed"
                        style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-subtle)', color: 'var(--text-muted)' }}>
                        ⚖️ <strong>필수 고지:</strong> 본 서비스는 공개된 스포츠 데이터와 머신러닝 알고리즘에 기반한 통계적 시뮬레이션 지표를 제공하며, 특정 베팅을 권유하거나 결과를 보장하지 않습니다. 모든 스포츠 관전 및 분석의 최종 판단과 책임은 사용자 본인에게 있습니다.
                    </div>

                    <div className="space-y-3 pt-2" style={{ borderTop: '1px solid var(--border-subtle)' }}>
                        <label className="flex items-start gap-3 cursor-pointer">
                            <input type="checkbox" checked={agreedTerms} onChange={(e) => setAgreedTerms(e.target.checked)} className="mt-0.5 accent-[var(--accent-primary)]" />
                            <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                                <Link href={`/${currentLang}/terms`} className="underline" style={{ color: 'var(--accent-primary)' }}>이용약관</Link>,{' '}
                                <Link href={`/${currentLang}/privacy`} className="underline" style={{ color: 'var(--accent-primary)' }}>개인정보처리방침</Link>,{' '}
                                <Link href={`/${currentLang}/refund`} className="underline" style={{ color: 'var(--accent-primary)' }}>환불 및 해지 정책</Link>,{' '}
                                <Link href={`/${currentLang}/disclaimer`} className="underline" style={{ color: 'var(--accent-primary)' }}>통계 시뮬레이션 면책 고지</Link>에 동의합니다.
                            </span>
                        </label>
                        <label className="flex items-start gap-3 cursor-pointer">
                            <input type="checkbox" checked={agreedAge} onChange={(e) => setAgreedAge(e.target.checked)} className="mt-0.5 accent-[var(--accent-primary)]" />
                            <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                                만 19세 이상이며, 본 상품이 디지털 통계 데이터 리포트 구독권임을 이해합니다.
                            </span>
                        </label>
                    </div>

                    {error && (
                        <div className="p-3 rounded-lg text-xs text-center" style={{ background: 'rgba(255,59,48,0.1)', color: '#FF3B30', border: '1px solid rgba(255,59,48,0.3)' }}>
                            {error}
                        </div>
                    )}

                    {!user ? (
                        <Link href={`/${currentLang}/login?redirect=${encodeURIComponent(pathname + '?' + searchParams.toString())}`} className="block w-full py-3 text-sm font-bold text-center rounded-xl transition"
                            style={{ background: 'rgba(0,212,255,0.1)', color: 'var(--accent-primary)', border: '1px solid rgba(0,212,255,0.3)' }}>
                            로그인 후 결제하기
                        </Link>
                    ) : (
                        <button onClick={handleCheckout} disabled={loading || !buyerName.trim() || !isPhoneValid || !agreedTerms || !agreedAge}
                            className="btn-primary w-full py-3.5 text-sm font-bold disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2">
                            {loading ? (
                                <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />결제 처리 중...</>
                            ) : (
                                `💳 ${formatPrice(finalAmount)} 데이터 멤버십 결제하기`
                            )}
                        </button>
                    )}

                    <p className="text-center text-xs" style={{ color: 'var(--text-muted)' }}>
                        언제든 마이페이지에서 원클릭으로 해지할 수 있습니다 ·{' '}
                        <Link href={`/${currentLang}/pricing`} className="underline" style={{ color: 'var(--accent-primary)' }}>
                            요금제 변경
                        </Link>
                    </p>
                </div>
            </main>
        </div>
    );
}
