"use client";
import React, { useState } from 'react';
import { usePathname } from 'next/navigation';
import Navbar from '../../components/Navbar';
import DeadlineBanner from '../../components/DeadlineBanner';
import { useAuth } from '../../context/AuthContext';
import { i18n } from '../../lib/i18n-config';

/* ── 요금제 데이터 (강화된 설명) ──────────────────────────────── */
const PLANS = {
    free: {
        name: 'Free',
        badge: '체험판',
        badgeBg: 'rgba(255,255,255,0.08)',
        badgeColor: 'var(--text-muted)',
        price: '0원',
        period: '/월',
        tagline: '데이터 분석 체험',
        description: 'AI 분석의 가치를 먼저 확인해보세요. 기본적인 데이터 비교와 제한된 AI 분석을 무료로 체험할 수 있습니다.',
        features: [
            { icon: '📊', text: '실시간 데이터 비교 (3개 리그)', highlight: false },
            { icon: '🤖', text: 'AI 분석 리포트 일일 1건', highlight: false },
            { icon: '📈', text: '기본 성과 분석기', highlight: false },
            { icon: '💬', text: 'AI 챗봇 일일 5회', highlight: false },
        ],
        limitations: ['AI TOP PICK 잠금', '조합 분석 잠금', '신뢰도 게이지 제한'],
        accent: 'var(--text-muted)',
    },
    pro: {
        name: 'Pro Analyst',
        badge: '🔥 인기',
        badgeBg: 'linear-gradient(135deg, #00d4ff, #8b5cf6)',
        badgeColor: '#fff',
        price: '55,000원',
        period: '/월',
        tagline: '데이터 기반 정밀 분석',
        description: '8,960경기 학습 AI 엔진의 정밀 분석으로 인사이트를 극대화하세요. 모든 프리미엄 분석 기능이 무제한으로 열립니다.',
        features: [
            { icon: '🧠', text: 'LightGBM AI 분석 무제한 (전 리그)', highlight: true },
            { icon: '🎯', text: 'AI TOP PICK — 오늘의 핵심 분석 경기', highlight: true },
            { icon: '📊', text: '신뢰도 게이지 + EV(기대값) 분석', highlight: true },
            { icon: '🔮', text: '조합 시뮬레이터 + 확률 분석 계산', highlight: true },
            { icon: '📉', text: '글로벌 데이터 지표 비교 분석', highlight: false },
            { icon: '💬', text: 'AI 전문 챗봇 무제한 이용', highlight: false },
            { icon: '🔔', text: '핵심 분석 실시간 알림', highlight: false },
            { icon: '📱', text: '포트폴리오 관리 + ROI 트래커', highlight: false },
        ],
        limitations: [],
        accent: 'var(--accent-primary)',
    },
    vip: {
        name: 'VIP Elite',
        badge: '👑 PREMIUM',
        badgeBg: 'linear-gradient(135deg, #f59e0b, #ef4444)',
        badgeColor: '#fff',
        price: '105,000원',
        period: '/월',
        tagline: 'AI 프리미엄 분석 시스템',
        description: 'Pro의 모든 분석에 AI 심층 리포트와 자동 조합 최적화가 추가됩니다. 실시간 변동 알림과 주간 분석 리포트로 인사이트를 극대화하세요.',
        features: [
            { icon: '✦', text: 'Pro Investor 전체 기능 포함', highlight: false },
            { icon: '📊', text: 'AI 심층 리포트 (경기당 상세 분석 PDF)', highlight: true },
            { icon: '⚡', text: '데이터 변동 즉시 알림 (이메일/푸시)', highlight: true },
            { icon: '🔮', text: 'AI 자동 조합 최적화 (최적 분석)', highlight: true },
            { icon: '🏆', text: '프리미엄 경기 미리보기 (경기 6시간 전)', highlight: true },
            { icon: '📈', text: '주간 AI 분석 리포트 (자동 발송)', highlight: false },
            { icon: '🛡️', text: '우선적 고객 지원', highlight: false },
        ],
        limitations: [],
        accent: 'var(--accent-secondary)',
    },
};

const FAQ_ITEMS = [
    { q: '구독 후 바로 이용 가능한가요?', a: '네, 결제 즉시 모든 프리미엄 기능이 활성화됩니다. KG이니시스 보안 결제로 안전하게 처리됩니다.' },
    { q: '환불 정책은 어떻게 되나요?', a: '결제일로부터 7일 이내 미사용 시 100% 환불 가능합니다. 이후에는 잔여 기간에 대한 부분 환불이 적용됩니다.' },
    { q: 'AI 분석의 정확도는 어떤가요?', a: '8,960+ 경기 데이터를 학습한 LightGBM 모델이 실시간 분석합니다. 매일 새벽 3시 자동 재학습으로 정확도를 지속 개선합니다.' },
    { q: '어떤 스포츠를 분석하나요?', a: '축구(EPL, 라리가, 분데스리가, 세리에A, 리그1, UCL), 농구(NBA), 야구(MLB), 아이스하키(NHL)를 분석합니다.' },
    { q: '구독 해지는 어떻게 하나요?', a: '마이페이지에서 언제든 해지할 수 있습니다. 해지해도 남은 기간까지는 계속 이용 가능합니다.' },
];

export default function PricingPage() {
    const pathname = usePathname();
    const { user } = useAuth();
    const currentLang = i18n.locales.find((l) => pathname.startsWith(`/${l}/`) || pathname === `/${l}`) || i18n.defaultLocale;
    const [openFaq, setOpenFaq] = useState<number | null>(null);
    const [billing, setBilling] = useState<'monthly' | 'annual'>('monthly');

    return (
        <div className="min-h-screen flex flex-col" style={{ background: 'var(--bg-primary)' }}>
            <DeadlineBanner />
            <Navbar />

            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 flex-grow">
                {/* ── Hero Section ──────────────────── */}
                <div className="text-center mb-16">
                    <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-bold mb-6"
                        style={{ background: 'rgba(0,212,255,0.1)', color: 'var(--accent-primary)', border: '1px solid rgba(0,212,255,0.2)' }}>
                        🧠 8,960+ 경기 학습 AI · 매일 자동 재학습
                    </div>
                    <h1 className="text-4xl font-extrabold sm:text-5xl leading-tight" style={{ color: 'var(--text-primary)' }}>
                        AI가 분석한 <span className="gradient-text">스마트 데이터</span>
                    </h1>
                    <p className="mt-4 text-lg max-w-2xl mx-auto" style={{ color: 'var(--text-muted)' }}>
                        LightGBM 머신러닝 엔진이 스포츠 데이터를 정밀 분석합니다.<br />
                        데이터에 기반한 과학적 분석 시스템을 경험하세요.
                    </p>

                    {/* Billing Toggle */}
                    <div className="mt-8 inline-flex items-center rounded-xl p-1" style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)' }}>
                        <button
                            onClick={() => setBilling('monthly')}
                            className="px-5 py-2 text-sm font-semibold rounded-lg transition-all"
                            style={{
                                background: billing === 'monthly' ? 'var(--accent-primary)' : 'transparent',
                                color: billing === 'monthly' ? '#fff' : 'var(--text-muted)',
                            }}>
                            월간
                        </button>
                        <button
                            onClick={() => setBilling('annual')}
                            className="px-5 py-2 text-sm font-semibold rounded-lg transition-all relative"
                            style={{
                                background: billing === 'annual' ? 'var(--accent-primary)' : 'transparent',
                                color: billing === 'annual' ? '#fff' : 'var(--text-muted)',
                            }}>
                            연간
                            <span className="absolute -top-2 -right-4 px-1.5 py-0.5 rounded-full text-[10px] font-bold"
                                style={{ background: '#ef4444', color: '#fff' }}>
                                -20%
                            </span>
                        </button>
                    </div>
                </div>

                {/* ── Plan Cards ───────────────────── */}
                <div className="grid gap-8 lg:grid-cols-3 lg:gap-x-6 mb-20">
                    {Object.entries(PLANS).map(([id, plan]) => {
                        const isPro = id === 'pro';
                        const isVip = id === 'vip';
                        const monthlyPrice = id === 'pro' ? 55000 : id === 'vip' ? 105000 : 0;
                        const displayPrice = billing === 'annual' && monthlyPrice > 0
                            ? Math.round(monthlyPrice * 0.8).toLocaleString() + '원'
                            : plan.price;

                        return (
                            <div key={id} className="glass-card relative p-8 flex flex-col"
                                style={{
                                    border: isPro ? '2px solid var(--accent-primary)' : isVip ? '2px solid var(--accent-secondary)' : undefined,
                                    boxShadow: isPro ? '0 0 40px rgba(0,212,255,0.15)' : isVip ? '0 0 40px rgba(139,92,246,0.12)' : undefined,
                                    transform: isPro ? 'scale(1.03)' : undefined,
                                }}>

                                {/* Badge */}
                                <p className="absolute top-0 py-1.5 px-4 rounded-full text-xs font-bold uppercase tracking-wide transform -translate-y-1/2"
                                    style={{ background: plan.badgeBg, color: plan.badgeColor }}>
                                    {plan.badge}
                                </p>

                                <div className="flex-1">
                                    {/* Plan Name + Tagline */}
                                    <h3 className="text-xl font-bold mt-2" style={{ color: 'var(--text-primary)' }}>
                                        {plan.name}
                                    </h3>
                                    <p className="text-xs mt-1 font-medium" style={{ color: plan.accent }}>
                                        {plan.tagline}
                                    </p>

                                    {/* Price */}
                                    <div className="mt-4 flex items-baseline justify-center" style={{ color: 'var(--text-primary)' }}>
                                        <span className={`text-4xl font-extrabold tracking-tight ${isPro ? 'gradient-text' : ''}`}>
                                            {displayPrice}
                                        </span>
                                        <span className="ml-1 text-base font-semibold" style={{ color: 'var(--text-muted)' }}>
                                            {plan.period}
                                        </span>
                                    </div>
                                    {billing === 'annual' && monthlyPrice > 0 && (
                                        <p className="text-xs mt-1 text-center" style={{ color: '#ef4444' }}>
                                            연 {(monthlyPrice * 12 * 0.8).toLocaleString()}원 (월 {Math.round(monthlyPrice * 0.8).toLocaleString()}원)
                                        </p>
                                    )}

                                    {/* Description */}
                                    <p className="mt-5 text-sm leading-relaxed text-left" style={{ color: 'var(--text-muted)' }}>
                                        {plan.description}
                                    </p>

                                    {/* Features */}
                                    <ul role="list" className="mt-6 space-y-3 text-sm text-left">
                                        {plan.features.map((f, i) => (
                                            <li key={i} className="flex items-start gap-2.5"
                                                style={{ color: f.highlight ? 'var(--text-primary)' : 'var(--text-secondary)' }}>
                                                <span className="text-base flex-shrink-0">{f.icon}</span>
                                                <span className={f.highlight ? 'font-semibold' : ''}>{f.text}</span>
                                            </li>
                                        ))}
                                    </ul>

                                    {/* Limitations (Free only) */}
                                    {plan.limitations && plan.limitations.length > 0 && (
                                        <div className="mt-4 pt-4" style={{ borderTop: '1px solid var(--border-subtle)' }}>
                                            <p className="text-[11px] font-semibold mb-2" style={{ color: 'var(--text-muted)' }}>
                                                제한 사항:
                                            </p>
                                            <ul className="space-y-1.5 text-xs" style={{ color: 'var(--text-muted)' }}>
                                                {plan.limitations.map((l, i) => (
                                                    <li key={i} className="flex items-center gap-2">
                                                        <span style={{ color: '#ef4444' }}>✕</span>{l}
                                                    </li>
                                                ))}
                                            </ul>
                                        </div>
                                    )}
                                </div>

                                {/* CTA Button */}
                                {id === 'free' ? (
                                    user ? (
                                        <span className="mt-8 block w-full py-3 text-sm font-semibold text-center rounded-xl"
                                            style={{ background: 'rgba(74,222,128,0.1)', color: '#4ade80', border: '1px solid rgba(74,222,128,0.3)' }}>
                                            ✓ 현재 이용 중
                                        </span>
                                    ) : (
                                        <a href={`/${currentLang}/register`} className="mt-8 block w-full py-3 text-sm font-semibold text-center rounded-xl transition-all hover:opacity-80"
                                            style={{ background: 'rgba(0,212,255,0.1)', color: 'var(--accent-primary)', border: '1px solid rgba(0,212,255,0.3)' }}>
                                            무료로 시작하기
                                        </a>
                                    )
                                ) : isPro ? (
                                    <a href={`/${currentLang}/payment/request?plan=pro&billing=${billing}`}
                                        className="btn-primary mt-8 block w-full py-3.5 text-sm font-bold text-center">
                                        💳 지금 구독하기
                                    </a>
                                ) : (
                                    <a href={`/${currentLang}/payment/request?plan=vip&billing=${billing}`}
                                        className="mt-8 block w-full py-3.5 text-sm font-bold text-center rounded-xl transition-all hover:opacity-80"
                                        style={{ background: 'rgba(139,92,246,0.15)', color: 'var(--accent-secondary)', border: '1px solid rgba(139,92,246,0.3)' }}>
                                        👑 VIP 시작하기
                                    </a>
                                )}
                            </div>
                        );
                    })}
                </div>

                {/* ── Feature Comparison Table ─────── */}
                <div className="glass-card overflow-hidden mb-20">
                    <div className="p-6 pb-0">
                        <h2 className="text-xl font-bold text-center" style={{ color: 'var(--text-primary)' }}>
                            📋 요금제별 기능 비교
                        </h2>
                    </div>
                    <div className="overflow-x-auto p-6">
                        <table className="w-full text-sm">
                            <thead>
                                <tr style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                                    <th className="text-left py-3 pr-4 font-semibold" style={{ color: 'var(--text-muted)' }}>기능</th>
                                    <th className="text-center py-3 px-4 font-semibold" style={{ color: 'var(--text-muted)' }}>Free</th>
                                    <th className="text-center py-3 px-4 font-bold" style={{ color: 'var(--accent-primary)' }}>Pro</th>
                                    <th className="text-center py-3 px-4 font-bold" style={{ color: 'var(--accent-secondary)' }}>VIP</th>
                                </tr>
                            </thead>
                            <tbody style={{ color: 'var(--text-secondary)' }}>
                                {[
                                    ['실시간 데이터 비교', '3개 리그', '전체 리그', '전체 리그'],
                                    ['AI 분석 리포트', '일 1건', '무제한', '무제한'],
                                    ['AI TOP PICK', '🔒', '✅', '✅'],
                                    ['신뢰도 게이지', '제한', '✅', '✅'],
                                    ['EV(기대값) 분석', '🔒', '✅', '✅'],
                                    ['조합 시뮬레이터', '🔒', '✅', '✅'],
                                    ['AI 챗봇', '일 5회', '무제한', '무제한'],
                                    ['핵심 분석 알림', '🔒', '✅', '✅ + 텔레그램'],
                                    ['포트폴리오 관리', '기본', '고급', '고급 + 리포트'],
                                    ['전용 텔레그램 채널', '🔒', '🔒', '✅'],
                                    ['1:1 전문가 상담', '🔒', '🔒', '주 3회'],
                                    ['주간 전략 리포트', '🔒', '🔒', '✅'],
                                ].map(([feature, free, pro, vip], i) => (
                                    <tr key={i} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                                        <td className="py-3 pr-4 font-medium">{feature}</td>
                                        <td className="text-center py-3 px-4">{free}</td>
                                        <td className="text-center py-3 px-4 font-semibold">{pro}</td>
                                        <td className="text-center py-3 px-4 font-semibold">{vip}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* ── Trust Badges ─────────────────── */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-20">
                    {[
                        { icon: '🔒', label: 'KG이니시스 보안 결제', desc: 'PCI DSS 인증' },
                        { icon: '🧠', label: 'LightGBM ML 엔진', desc: '8,960+ 경기 학습' },
                        { icon: '🔄', label: '매일 자동 재학습', desc: '새벽 3시 자동 갱신' },
                        { icon: '💯', label: '7일 환불 보장', desc: '100% 환불 가능' },
                    ].map((badge, i) => (
                        <div key={i} className="glass-card p-4 text-center">
                            <p className="text-2xl mb-2">{badge.icon}</p>
                            <p className="text-xs font-bold" style={{ color: 'var(--text-primary)' }}>{badge.label}</p>
                            <p className="text-[10px] mt-0.5" style={{ color: 'var(--text-muted)' }}>{badge.desc}</p>
                        </div>
                    ))}
                </div>

                {/* ── FAQ ──────────────────────────── */}
                <div className="max-w-2xl mx-auto mb-12">
                    <h2 className="text-2xl font-bold text-center mb-8" style={{ color: 'var(--text-primary)' }}>
                        ❓ 자주 묻는 질문
                    </h2>
                    <div className="space-y-3">
                        {FAQ_ITEMS.map((item, i) => (
                            <div key={i} className="glass-card overflow-hidden">
                                <button
                                    onClick={() => setOpenFaq(openFaq === i ? null : i)}
                                    className="w-full px-5 py-4 text-left flex items-center justify-between"
                                    style={{ color: 'var(--text-primary)' }}>
                                    <span className="text-sm font-semibold">{item.q}</span>
                                    <span className="text-lg transition-transform"
                                        style={{ transform: openFaq === i ? 'rotate(180deg)' : 'rotate(0)' }}>▾</span>
                                </button>
                                {openFaq === i && (
                                    <div className="px-5 pb-4 text-sm leading-relaxed" style={{ color: 'var(--text-muted)' }}>
                                        {item.a}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>

                {/* ── Payment Method Notice ────────── */}
                <div className="text-center text-xs space-y-1" style={{ color: 'var(--text-muted)' }}>
                    <p>결제는 <strong>KG이니시스</strong>를 통해 안전하게 처리됩니다.</p>
                    <p>신용카드 · 체크카드 · 간편결제(카카오페이, 네이버페이) · 계좌이체 지원</p>
                    <p className="mt-2 text-[10px]">사업자등록번호: 534-40-01041 | 통신판매업: 2024-전남나주-0053</p>
                </div>
            </main>
        </div>
    );
}
