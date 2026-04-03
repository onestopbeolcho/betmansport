"use client";
import React, { useState, Suspense } from 'react';
import { useSearchParams, usePathname } from 'next/navigation';
import Navbar from '../../components/Navbar';
import DeadlineBanner from '../../components/DeadlineBanner';
import { useAuth } from '../../context/AuthContext';
import { i18n } from '../../lib/i18n-config';
import * as PortOne from '@portone/browser-sdk/v2';

/* ── 요금제 정의 (강화된 설명) ──────────────────────────────── */
const PLANS: Record<string, {
    name: string; price: number; features: { icon: string; text: string }[];
    tagline: string; highlights: string[];
}> = {
    pro: {
        name: "Pro Investor",
        price: 55000,
        tagline: "Maximize returns with data-driven analysis",
        features: [
            { icon: '🧠', text: 'Unlimited LightGBM AI analysis (all leagues)' },
            { icon: '🎯', text: 'AI TOP PICK — Today\'s best recommended match' },
            { icon: '📊', text: 'Confidence gauge + EV (expected value) analysis' },
            { icon: '🔮', text: 'Combo analysis simulator + expected returns' },
            { icon: '📉', text: 'Pinnacle vs Betman odds gap analysis' },
            { icon: '💬', text: 'Unlimited AI expert chatbot' },
            { icon: '🔔', text: 'Real-time high-value analysis alerts' },
            { icon: '📱', text: 'Portfolio management + ROI tracker' },
        ],
        highlights: ['8,960+ matches trained AI', 'Auto-retrain daily at 03:00', '7-day refund guarantee'],
    },
    vip: {
        name: "VIP Elite",
        price: 105000,
        tagline: "AI Premium Analysis System",
        features: [
            { icon: '✦', text: 'All Pro Investor features included' },
            { icon: '📊', text: 'AI deep report (detailed analysis PDF per match)' },
            { icon: '⚡', text: 'Instant odds change alerts (email/push)' },
            { icon: '🔮', text: 'AI auto combo optimization (best return picks)' },
            { icon: '🏆', text: 'Premium match preview (6 hours early)' },
            { icon: '📈', text: 'Weekly AI ROI report (auto-sent)' },
            { icon: '🛡️', text: 'Priority customer support' },
        ],
        highlights: ['All Pro features included', 'AI deep analysis PDF', '7-day refund guarantee'],
    },
};

export default function PaymentRequestPage() {
    return (
        <Suspense fallback={
            <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg-primary)' }}>
                <div className="text-center">
                    <div className="inline-block w-8 h-8 border-2 border-t-transparent rounded-full animate-spin mb-3" style={{ borderColor: 'var(--accent-primary)', borderTopColor: 'transparent' }} />
                    <p style={{ color: 'var(--text-muted)' }}>Loading...</p>
                </div>
            </div>
        }>
            <PaymentRequestContent />
        </Suspense>
    );
}

function PaymentRequestContent() {
    const searchParams = useSearchParams();
    const pathname = usePathname();
    const planId = searchParams.get('plan') || 'pro';
    const billingParam = searchParams.get('billing') || 'monthly';
    const plan = PLANS[planId] || PLANS.pro;
    const { user, token } = useAuth();
    const sortedLocales = [...i18n.locales].sort((a, b) => b.length - a.length);
    const currentLang = sortedLocales.find((l) => pathname.startsWith(`/${l}/`) || pathname === `/${l}`) || i18n.defaultLocale;

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [buyerName, setBuyerName] = useState('');
    const [phoneNumber, setPhoneNumber] = useState('');
    const [agreedTerms, setAgreedTerms] = useState(false);
    const [agreedAge, setAgreedAge] = useState(false);

    // 로그인된 사용자 정보 자동 입력
    React.useEffect(() => {
        if (user) {
            if ((user as any).full_name && !buyerName) setBuyerName((user as any).full_name);
            if ((user as any).phone && !phoneNumber) {
                const digits = ((user as any).phone as string).replace(/\D/g, '');
                if (digits.length >= 10) {
                    setPhoneNumber(`${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`);
                }
            }
        }
    }, [user]);

    // Phone number formatting (010-0000-0000)
    const formatPhone = (value: string) => {
        const digits = value.replace(/\D/g, '').slice(0, 11);
        if (digits.length <= 3) return digits;
        if (digits.length <= 7) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
        return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
    };
    const phoneDigits = phoneNumber.replace(/\D/g, '');
    const isPhoneValid = phoneDigits.length === 10 || phoneDigits.length === 11;

    const isAnnual = billingParam === 'annual';
    const finalPrice = isAnnual ? Math.round(plan.price * 0.8) : plan.price;
    const totalAnnual = isAnnual ? finalPrice * 12 : null;

    const handleCheckout = async () => {
        if (!user) {
            setError('Login is required.');
            return;
        }
        if (!buyerName.trim()) {
            setError('Please enter your name.');
            return;
        }
        if (!isPhoneValid) {
            setError('Please enter a valid phone number.');
            return;
        }
        if (!agreedTerms || !agreedAge) {
            setError('Please agree to all terms.');
            return;
        }

        setLoading(true);
        setError('');

        try {
            const storeId = process.env.NEXT_PUBLIC_PORTONE_STORE_ID || '';
            const channelKey = process.env.NEXT_PUBLIC_PORTONE_CHANNEL_KEY || '';

            const paymentId = `SPI_${planId}_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;

            // PortOne payment window (KG Inicis)
            const response = await PortOne.requestPayment({
                storeId,
                channelKey,
                paymentId,
                orderName: `Scorenix - ${plan.name} ${isAnnual ? 'Annual' : 'Monthly'} Subscription`,
                totalAmount: isAnnual ? totalAnnual! : finalPrice,
                currency: 'CURRENCY_KRW',
                payMethod: 'CARD',
                customer: {
                    fullName: buyerName,
                    phoneNumber: phoneDigits,
                    email: user?.email || '',
                },
                redirectUrl: `${window.location.origin}/${currentLang}/payment/complete?paymentId=${paymentId}&planId=${planId}`,
            });

            if (response?.code) {
                // 사용자 취소
                if (response.code === 'PAYMENT_CANCELLED' || response.code === 'USER_CANCEL') {
                    setLoading(false);
                    return;
                }
                // 그 외 모든 실패 — 에러 메시지 표시
                setError(response.message || '결제에 실패했습니다. 다시 시도해주세요.');
                setLoading(false);
                return;
            }

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
                    billing: billingParam,
                }),
            });

            if (!verifyRes.ok) {
                const data = await verifyRes.json().catch(() => ({}));
                throw new Error(data.detail || 'Payment verification failed.');
            }

            window.location.href = `/${currentLang}/payment/complete?paymentId=${paymentId}&planId=${planId}&status=success`;

        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : 'An error occurred during payment.');
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex flex-col" style={{ background: 'var(--bg-primary)' }}>
            <DeadlineBanner />
            <Navbar />

            <main className="max-w-lg mx-auto px-4 py-16 flex-grow w-full">
                <h1 className="text-2xl font-extrabold mb-2 text-center" style={{ color: 'var(--text-primary)' }}>
                    Subscription Payment
                </h1>
                <p className="text-sm text-center mb-8" style={{ color: 'var(--text-muted)' }}>
                    Processed securely via KG Inicis payment gateway
                </p>

                <div className="glass-card p-6 space-y-6">
                    {/* ── Plan Header ──────────────────── */}
                    <div className="text-center p-5 rounded-xl" style={{
                        background: planId === 'vip'
                            ? 'linear-gradient(135deg, rgba(245,158,11,0.1), rgba(139,92,246,0.1))'
                            : 'linear-gradient(135deg, rgba(0,212,255,0.08), rgba(139,92,246,0.08))',
                        border: planId === 'vip'
                            ? '1px solid rgba(245,158,11,0.2)'
                            : '1px solid rgba(0,212,255,0.2)',
                    }}>
                        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-[11px] font-bold mb-3"
                            style={{
                                background: planId === 'vip' ? 'rgba(245,158,11,0.15)' : 'rgba(0,212,255,0.1)',
                                color: planId === 'vip' ? '#f59e0b' : 'var(--accent-primary)',
                            }}>
                            {planId === 'vip' ? '👑 PREMIUM' : '🔥 POPULAR'}
                        </div>
                        <p className="text-xl font-extrabold gradient-text">{plan.name}</p>
                        <p className="text-xs mt-1 font-medium" style={{ color: 'var(--text-muted)' }}>
                            {plan.tagline}
                        </p>
                        <div className="mt-3">
                            <span className="text-3xl font-extrabold" style={{ color: 'var(--text-primary)' }}>
                                {finalPrice.toLocaleString()} KRW
                            </span>
                            <span className="text-sm font-medium ml-1" style={{ color: 'var(--text-muted)' }}>
                                /{isAnnual ? 'mo' : 'mo'}
                            </span>
                        </div>
                        {isAnnual && totalAnnual && (
                            <div className="mt-1 space-y-0.5">
                                <p className="text-[11px] line-through" style={{ color: 'var(--text-muted)' }}>
                                    Regular price {(plan.price * 12).toLocaleString()} KRW/yr
                                </p>
                                <p className="text-xs font-bold" style={{ color: '#ef4444' }}>
                                    Annual {totalAnnual.toLocaleString()} KRW (20% off)
                                </p>
                            </div>
                        )}
                    </div>

                    {/* ── Highlight Badges ─────────────── */}
                    <div className="flex flex-wrap gap-2 justify-center">
                        {plan.highlights.map((h, i) => (
                            <span key={i} className="px-3 py-1 rounded-full text-[10px] font-bold"
                                style={{ background: 'rgba(0,212,255,0.08)', color: 'var(--accent-primary)', border: '1px solid rgba(0,212,255,0.15)' }}>
                                {h}
                            </span>
                        ))}
                    </div>

                    {/* ── Features List ────────────────── */}
                    <div>
                        <p className="text-xs font-bold mb-3" style={{ color: 'var(--text-muted)' }}>Features included with subscription:</p>
                        <ul className="space-y-2.5 text-sm">
                            {plan.features.map((f, i) => (
                                <li key={i} className="flex items-start gap-2.5" style={{ color: 'var(--text-secondary)' }}>
                                    <span className="text-base flex-shrink-0">{f.icon}</span>
                                    <span>{f.text}</span>
                                </li>
                            ))}
                        </ul>
                    </div>

                    {/* ── Payment Method ───────────────── */}
                    <div className="flex items-center justify-center gap-3 py-3 rounded-lg" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-subtle)' }}>
                        <div className="flex items-center gap-1.5">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: 'var(--text-muted)' }}>
                                <rect x="1" y="4" width="22" height="16" rx="2" ry="2" />
                                <line x1="1" y1="10" x2="23" y2="10" />
                            </svg>
                            <span className="text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>
                                KG Inicis Secure Payment
                            </span>
                        </div>
                        <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
                            Card · Easy Pay · Bank Transfer
                        </span>
                    </div>

                    {/* ── Buyer Info (KG Inicis required) ────── */}
                    <div className="space-y-4">
                        <p className="text-xs font-bold" style={{ color: 'var(--text-muted)' }}>Buyer Information (Required)</p>

                        <div className="space-y-1.5">
                            <label className="text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>
                                👤 Full Name <span style={{ color: '#ef4444' }}>*</span>
                            </label>
                            <input
                                type="text"
                                value={buyerName}
                                onChange={(e) => setBuyerName(e.target.value)}
                                placeholder="John Doe"
                                className="w-full px-4 py-3 rounded-xl text-sm outline-none transition-all"
                                style={{
                                    background: 'var(--bg-elevated)',
                                    color: 'var(--text-primary)',
                                    border: '1px solid var(--border-subtle)',
                                }}
                            />
                        </div>

                        <div className="space-y-1.5">
                            <label className="text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>
                                📱 Phone Number <span style={{ color: '#ef4444' }}>*</span>
                            </label>
                            <input
                                type="tel"
                                value={phoneNumber}
                                onChange={(e) => setPhoneNumber(formatPhone(e.target.value))}
                                placeholder="010-0000-0000"
                                className="w-full px-4 py-3 rounded-xl text-sm outline-none transition-all"
                                style={{
                                    background: 'var(--bg-elevated)',
                                    color: 'var(--text-primary)',
                                    border: `1px solid ${phoneNumber && !isPhoneValid ? '#ef4444' : 'var(--border-subtle)'}`,
                                }}
                            />
                        </div>
                        <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
                            Required for KG Inicis secure payment processing.
                        </p>
                    </div>

                    {/* ── Agreements ───────────────────── */}
                    <div className="space-y-3 pt-4" style={{ borderTop: '1px solid var(--border-subtle)' }}>
                        <label className="flex items-start gap-3 cursor-pointer">
                            <input
                                type="checkbox"
                                checked={agreedTerms}
                                onChange={(e) => setAgreedTerms(e.target.checked)}
                                className="mt-0.5 accent-[var(--accent-primary)]"
                            />
                            <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                                <a href={`/${currentLang}/terms`} className="underline" style={{ color: 'var(--accent-primary)' }}>Terms of Service</a>,{' '}
                                <a href={`/${currentLang}/privacy`} className="underline" style={{ color: 'var(--accent-primary)' }}>Privacy Policy</a>,{' '}
                                <a href={`/${currentLang}/refund`} className="underline" style={{ color: 'var(--accent-primary)' }}>Refund Policy</a>,{' '}
                                <a href={`/${currentLang}/disclaimer`} className="underline" style={{ color: 'var(--accent-primary)' }}>Risk Disclaimer</a> — I agree to all.
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
                                만 19세 이상이며, 본 서비스가 통계 분석 도구임을 이해합니다.
                            </span>
                        </label>
                    </div>

                    {/* ── Error ────────────────────────── */}
                    {error && (
                        <div className="p-3 rounded-lg text-xs text-center" style={{
                            background: 'rgba(255,59,48,0.1)',
                            color: '#FF3B30',
                            border: '1px solid rgba(255,59,48,0.3)',
                        }}>
                            {error}
                        </div>
                    )}

                    {/* ── CTA ─────────────────────────── */}
                    {!user ? (
                        <a href={`/${currentLang}/login?redirect=${encodeURIComponent(pathname + '?' + searchParams.toString())}`} className="block w-full py-3.5 text-sm font-bold text-center rounded-xl transition"
                            style={{
                                background: 'rgba(0,212,255,0.1)',
                                color: 'var(--accent-primary)',
                                border: '1px solid rgba(0,212,255,0.3)',
                            }}>
                            로그인 후 결제하기
                        </a>
                    ) : (
                        <button
                            onClick={handleCheckout}
                            disabled={loading || !buyerName.trim() || !isPhoneValid || !agreedTerms || !agreedAge}
                            className="btn-primary w-full py-4 text-sm font-bold disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                        >
                            {loading ? (
                                <>
                                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                    KG Inicis payment processing...
                                </>
                            ) : (
                                <>
                                    🔒 {isAnnual && totalAnnual
                                        ? `Pay ${totalAnnual.toLocaleString()} KRW (Annual)`
                                        : `Pay ${finalPrice.toLocaleString()} KRW`
                                    }
                                </>
                            )}
                        </button>
                    )}

                    {/* ── Notes ────────────────────────── */}
                    <div className="text-[10px] text-center space-y-1" style={{ color: 'var(--text-muted)' }}>
                        <p>🔒 KG Inicis PCI DSS certified secure payment</p>
                        <p>Available for {isAnnual ? '365 days' : '30 days'} from payment · Cancel anytime</p>
                        <p>100% refund guarantee within 7 days if unused</p>
                    </div>
                </div>

                <div className="mt-4 text-center">
                    <a href={`/${currentLang}/pricing`} className="text-xs underline transition" style={{ color: 'var(--text-muted)' }}>
                        ← View other plans
                    </a>
                </div>
            </main>
        </div>
    );
}
