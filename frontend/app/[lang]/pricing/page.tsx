"use client";
import React, { useState } from 'react';
import { usePathname } from 'next/navigation';
import Navbar from '../../components/Navbar';
import DeadlineBanner from '../../components/DeadlineBanner';
import { useAuth } from '../../context/AuthContext';
import { i18n } from '../../lib/i18n-config';

/* ── 요금제 데이터 (개인 B2C 모바일 구독 & 전국 6,277개 판매점 점주 100% 무상 상생 파트너십) ── */
const PLANS = {
    round_pass: {
        name: '이번 회차 즉시 열람권',
        badge: '⚡ 단건 간편결제 · 매장 QR 특가',
        badgeBg: 'linear-gradient(135deg, #f59e0b, #eab308)',
        badgeColor: '#0f172a',
        price: '3,900원',
        monthlyNumeric: 0,
        period: '/회차',
        tagline: '현재 발매 중인 승무패·프로토 회차 즉시 해금',
        description: '정기결제 부담 없이 이번 회차 승무패 14경기 경합 구간 복수 지표와 프로토 승부식 AI 확신도 85%+ 핵심 주력 픽을 스마트폰에서 즉시 확인하세요.',
        features: [
            { icon: '🔓', text: '이번 회차 승무패·승5패 14경기 경합 구간 복수 지표 오픈', highlight: true },
            { icon: '💎', text: '프로토 승부식 AI 확신도 85%+ 핵심 주력 픽 전체 공개', highlight: true },
            { icon: '🎯', text: '환급률 극대화 주력 2폴더 & 중배당 3폴더 추천 조합 열람', highlight: true },
            { icon: '💰', text: '베트맨 공시 배당 대비 +EV 데이터 가치 Top 5 제공', highlight: false },
            { icon: '⚠️', text: '대중 투표 쏠림 저배당 함정 경기 주의보 포함', highlight: false },
        ],
        limitations: ['현재 발매 회차(5일간)에 한해 적용 (자동 정기결제 없음)'],
        accent: '#fbbf24',
    },
    pro: {
        name: '개인 올인원 월 무제한 패스',
        badge: '🔥 개인 회원 최다 선택 · 집에서 편하게',
        badgeBg: 'linear-gradient(135deg, #0046b8, #0284c7)',
        badgeColor: '#fff',
        price: '29,900원',
        monthlyNumeric: 29900,
        period: '/월',
        tagline: '매번 판매점 방문 없이 스마트폰으로 전 회차 공략',
        description: '한 달 내내 발행되는 모든 베트맨 게임(축구 승무패, 농구 승5패, 스페셜N, 프로토 승부식 월 12~15회차)과 마감 직전 실시간 배당 변동을 집에서 편하게 확인합니다.',
        features: [
            { icon: '📱', text: '한 달간 모든 베트맨 회차(승무패·승5패·스페셜N·프로토) 무제한', highlight: true },
            { icon: '⏱️', text: '판매점 종이 벽보에 없는 마감 직전 배당 급변동·결장자 실시간 반영', highlight: true },
            { icon: '💎', text: 'AI 확신도 85%+ 핵심 우위 픽 & 2·3폴더 조합기 무제한', highlight: true },
            { icon: '📊', text: '7-Factor 구단 전력·포아송 기대득점(xG) 상세 리포트', highlight: true },
            { icon: '💬', text: 'AI 스포츠 통계 챗봇 및 과거 적중 아카이브 무제한', highlight: false },
        ],
        limitations: [],
        accent: '#38bdf8',
    },
    vip: {
        name: 'VIP 프로 퀀트 & 조합기 패스',
        badge: '👑 14경기 예산별 자동 마킹 · 프로 전용',
        badgeBg: 'linear-gradient(135deg, #7c3aed, #db2777)',
        badgeColor: '#fff',
        price: '39,000원',
        monthlyNumeric: 39000,
        period: '/월',
        tagline: '승무패 14경기 예산별 복수 마킹 시뮬레이터 올인원',
        description: '개인 올인원 패스의 모든 혜택에 더해, 승무패·승5패 14경기 예산별(8천원/1.6만원/3.2만원) 최적 복수 마킹 자동 배분기와 켈리 비중 계산기를 무제한 제공합니다.',
        features: [
            { icon: '👑', text: '개인 올인원 월 무제한 패스(29,900원)의 전 기능 100% 포함', highlight: true },
            { icon: '🧮', text: '승무패·승5패 14경기 예산별 복수 마킹 OMR 자동 배분 시뮬레이터', highlight: true },
            { icon: '⚖️', text: '켈리 공식(Kelly Criterion) 최적 비중 배분 계산기 무제한', highlight: true },
            { icon: '🚨', text: '글로벌 배당 왜곡 감지 및 이변 경보 실시간 우선 알림', highlight: true },
            { icon: '📈', text: '3-Pillar 머신러닝 백테스트 원본 지표 전체 열람', highlight: true },
        ],
        limitations: [],
        accent: '#c084fc',
    },
};

const FAQ_ITEMS = [
    { q: '오프라인 판매점에서는 왜 무료인데 개인 모바일 구독은 유료인가요?', a: '스코어닉스는 전국 6,277개 공식 프로토·토토 판매점 사장님들의 매장 활성화와 건전 레저문화 정착을 위해 매장 비치용 A4 요약 벽보와 매장 모니터 전광판을 100% 무상으로 지원합니다. 반면 매번 판매점에 방문하기 번거로우시거나, 종이 벽보 인쇄 이후 발생하는 마감 직전 실시간 해외배당 급변동·선발 라인업 결장자 반영 최종 픽 및 개인 맞춤형 14경기 예산별 조합기를 스마트폰에서 편하게 이용하고자 하는 개인 회원님께는 프리미엄 모바일 구독 서비스를 제공합니다.' },
    { q: '본 서비스는 어떤 성격의 서비스인가요?', a: '스코어닉스는 공개된 스포츠 데이터와 머신러닝 알고리즘에 기반한 스포츠 통계 데이터베이스 및 시뮬레이션 SaaS 소프트웨어입니다. 특정 베팅을 권유하거나 결과를 보장하지 않으며 순수 통계 리포트 구독권을 제공합니다.' },
    { q: '결제 후 바로 이용 가능한가요?', a: '네, KG이니시스 보안 결제(신용/체크카드, 카카오페이, 네이버페이) 완료 즉시 계정에 데이터 멤버십 등급이 자동 반영되어 스마트폰과 PC에서 전 경기 리포트를 열람하실 수 있습니다.' },
    { q: '구독 해지 및 환불 정책은 어떻게 되나요?', a: '마이페이지에서 CS 문의 없이 언제든 원클릭으로 구독을 해지할 수 있습니다. 결제일로부터 7일 이내 미사용 시 100% 환불되며, 사용 이력이 있는 경우 전자상거래법 기준 일할 계산 산식에 따라 잔여 기간 환불이 처리됩니다.' },
];

export default function PricingPage() {
    const pathname = usePathname() || '';
    useAuth();
    const currentLang = i18n.locales.find((l) => pathname.startsWith(`/${l}/`) || pathname === `/${l}`) || i18n.defaultLocale;
    const [openFaq, setOpenFaq] = useState<number | null>(0);
    const [billing, setBilling] = useState<'monthly' | 'annual'>('monthly');

    return (
        <div className="min-h-screen flex flex-col" style={{ background: 'var(--bg-primary)' }}>
            <DeadlineBanner />
            <Navbar />

            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14 flex-grow">
                {/* ── Hero Section ──────────────────── */}
                <div className="text-center mb-12">
                    <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-extrabold mb-5"
                        style={{ background: 'rgba(0,70,184,0.1)', color: 'var(--accent-primary)', border: '1px solid rgba(0,70,184,0.25)' }}>
                        📱 매번 판매점 갈 필요 없이 내 스마트폰에서 마감 직전 실시간 AI 픽까지!
                    </div>
                    <h1 className="text-3xl font-black sm:text-5xl leading-tight" style={{ color: 'var(--text-primary)' }}>
                        개인 모바일 무제한 패스 &amp; <span className="gradient-text">판매점 무상 상생 파트너십</span>
                    </h1>
                    <p className="mt-4 text-sm sm:text-base max-w-2xl mx-auto leading-relaxed" style={{ color: 'var(--text-muted)' }}>
                        전국 6,277개 공식 판매점 비치용 A4 요약 벽보는 <strong>점주님께 100% 무료</strong>로 제공됩니다.<br />
                        판매점 방문 없이 <strong>집에서 스마트폰으로 실시간 배당 급변동·결장자 반영 픽과 전 경기 AI 조합기</strong>를 무제한 이용하세요!
                    </p>

                    {/* Billing Toggle */}
                    <div className="mt-7 inline-flex items-center rounded-xl p-1" style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)' }}>
                        <button
                            onClick={() => setBilling('monthly')}
                            className="px-5 py-2 text-sm font-bold rounded-lg transition-all cursor-pointer"
                            style={{
                                background: billing === 'monthly' ? 'var(--accent-primary)' : 'transparent',
                                color: billing === 'monthly' ? '#fff' : 'var(--text-muted)',
                            }}>
                            월간 구독
                        </button>
                        <button
                            onClick={() => setBilling('annual')}
                            className="px-5 py-2 text-sm font-bold rounded-lg transition-all relative cursor-pointer"
                            style={{
                                background: billing === 'annual' ? 'var(--accent-primary)' : 'transparent',
                                color: billing === 'annual' ? '#fff' : 'var(--text-muted)',
                            }}>
                            연간 구독
                            <span className="absolute -top-2 -right-4 px-1.5 py-0.5 rounded-full text-[10px] font-bold"
                                style={{ background: '#ef4444', color: '#fff' }}>
                                -20%
                            </span>
                        </button>
                    </div>
                </div>

                {/* ── B2C Personal Plan Cards (3 Tiers) ───────────────────── */}
                <div className="grid gap-8 lg:grid-cols-3 lg:gap-x-6 mb-12">
                    {Object.entries(PLANS).map(([id, plan]) => {
                        const isRoundPass = id === 'round_pass';
                        const isPro = id === 'pro';
                        const isVip = id === 'vip';
                        const monthlyPrice = plan.monthlyNumeric;
                        const displayPrice = billing === 'annual' && monthlyPrice > 0
                            ? Math.round(monthlyPrice * 0.8).toLocaleString() + '원'
                            : plan.price;

                        return (
                            <div key={id} className="glass-card relative p-7 sm:p-8 flex flex-col"
                                style={{
                                    border: isPro ? '2px solid var(--accent-primary)' : isVip ? '2px solid #9333ea' : '1px solid rgba(245,158,11,0.45)',
                                    boxShadow: isPro ? '0 10px 35px rgba(0,70,184,0.12)' : isVip ? '0 10px 35px rgba(147,51,234,0.12)' : undefined,
                                    transform: isPro ? 'scale(1.02)' : undefined,
                                }}>

                                {/* Badge */}
                                <p className="absolute top-0 py-1.5 px-4 rounded-full text-xs font-extrabold tracking-wide transform -translate-y-1/2"
                                    style={{ background: plan.badgeBg, color: plan.badgeColor }}>
                                    {plan.badge}
                                </p>

                                <div className="flex-1">
                                    <h3 className="text-xl font-black mt-2" style={{ color: 'var(--text-primary)' }}>
                                        {plan.name}
                                    </h3>
                                    <p className="text-xs mt-1 font-bold" style={{ color: 'var(--accent-primary)' }}>
                                        {plan.tagline}
                                    </p>

                                    {/* Price */}
                                    <div className="mt-4 flex items-baseline justify-center" style={{ color: 'var(--text-primary)' }}>
                                        <span className={`text-4xl font-black tracking-tight ${isPro ? 'gradient-text' : ''}`}>
                                            {displayPrice}
                                        </span>
                                        <span className="ml-1 text-base font-bold" style={{ color: 'var(--text-muted)' }}>
                                            {plan.period}
                                        </span>
                                    </div>
                                    {billing === 'annual' && monthlyPrice > 0 ? (
                                        <p className="text-xs mt-1 text-center font-bold" style={{ color: '#ef4444' }}>
                                            연 {(Math.round(monthlyPrice * 0.8) * 12).toLocaleString()}원 (월 {Math.round(monthlyPrice * 0.8).toLocaleString()}원꼴)
                                        </p>
                                    ) : isRoundPass ? (
                                        <p className="text-xs mt-1 text-center font-bold" style={{ color: '#d97706' }}>
                                            정기결제 부담 없는 1회차 즉시 열람권
                                        </p>
                                    ) : isPro ? (
                                        <p className="text-xs mt-1 text-center font-bold" style={{ color: '#059669' }}>
                                            회차당 약 2,100원꼴 · 언제든 1클릭 해지 가능
                                        </p>
                                    ) : (
                                        <p className="text-xs mt-1 text-center font-bold" style={{ color: '#7c3aed' }}>
                                            14경기 복수 마킹 예산 배분기 + 켈리 계산기 무제한
                                        </p>
                                    )}

                                    <p className="mt-5 text-xs sm:text-sm leading-relaxed text-left" style={{ color: 'var(--text-secondary)' }}>
                                        {plan.description}
                                    </p>

                                    <ul role="list" className="mt-6 space-y-3 text-xs sm:text-sm text-left">
                                        {plan.features.map((f, i) => (
                                            <li key={i} className="flex items-start gap-2.5"
                                                style={{ color: f.highlight ? 'var(--text-primary)' : 'var(--text-secondary)' }}>
                                                <span className="text-base flex-shrink-0">{f.icon}</span>
                                                <span className={f.highlight ? 'font-bold' : ''}>{f.text}</span>
                                            </li>
                                        ))}
                                    </ul>

                                    {plan.limitations && plan.limitations.length > 0 && (
                                        <div className="mt-4 pt-4" style={{ borderTop: '1px solid var(--border-subtle)' }}>
                                            <ul className="space-y-1.5 text-xs" style={{ color: 'var(--text-muted)' }}>
                                                {plan.limitations.map((l, i) => (
                                                    <li key={i} className="flex items-center gap-2">
                                                        <span style={{ color: '#f59e0b' }}>•</span>{l}
                                                    </li>
                                                ))}
                                            </ul>
                                        </div>
                                    )}
                                </div>

                                {/* CTA Button */}
                                {isRoundPass ? (
                                    <a href={`/${currentLang}/payment/request?plan=round_pass&billing=once`}
                                        className="mt-8 block w-full py-3.5 text-sm font-black text-center rounded-xl transition-all hover:opacity-90"
                                        style={{ background: 'linear-gradient(135deg, #f59e0b, #eab308)', color: '#0f172a' }}>
                                        ⚡ 3,900원으로 이번 회차 즉시 열기
                                    </a>
                                ) : isPro ? (
                                    <a href={`/${currentLang}/payment/request?plan=pro&billing=${billing}`}
                                        className="btn-primary mt-8 block w-full py-3.5 text-sm font-black text-center">
                                        📱 월 29,900원 개인 무제한 패스 시작
                                    </a>
                                ) : (
                                    <a href={`/${currentLang}/payment/request?plan=vip&billing=${billing}`}
                                        className="mt-8 block w-full py-3.5 text-sm font-black text-center rounded-xl transition-all hover:opacity-90"
                                        style={{ background: 'linear-gradient(135deg, #7c3aed, #db2777)', color: '#fff' }}>
                                        👑 월 39,000원 VIP 프로 퀀트 시작
                                    </a>
                                )}
                            </div>
                        );
                    })}
                </div>

                {/* ── 🏪 B2B 공식 판매점 점주님 100% 평생 무상 지원 배너 ── */}
                <div className="rounded-2xl p-6 sm:p-8 mb-16 border-2 border-emerald-500/60 bg-gradient-to-r from-slate-900 via-slate-900 to-emerald-950 text-white shadow-xl">
                    <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
                        <div className="space-y-2.5 max-w-3xl">
                            <div className="flex flex-wrap items-center gap-2">
                                <span className="px-3 py-1 rounded-full bg-emerald-400 text-slate-950 text-xs font-black">
                                    🏪 전국 6,277개 공식 프로토·토토 판매점 사장님 전용
                                </span>
                                <span className="px-3 py-1 rounded-full bg-white/10 text-emerald-300 text-xs font-extrabold border border-emerald-400/30">
                                    평생 0원 · 100% 무료 상생 파트너십
                                </span>
                            </div>
                            <h2 className="text-xl sm:text-2xl font-black tracking-tight text-white">
                                복권방·스포츠토토 판매점 사장님이신가요? 매장용 A4 벽보 &amp; PC 전광판은 <span className="text-emerald-400">평생 0원(무료)</span>입니다!
                            </h2>
                            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                                스코어닉스는 전국 판매점의 매출 활성화와 방문 손님 유치를 돕기 위해 <strong>① 매장 상호명이 인쇄된 A4 1장 요약 분석 벽보</strong>와 <strong>② 매장 모니터용 전광판 모드</strong>를 일체의 구독료 없이 100% 무상으로 지원합니다. 지금 바로 인쇄하여 매장 게시판에 부착해 보세요!
                            </p>
                        </div>
                        <div className="flex flex-col sm:flex-row lg:flex-col gap-2.5 w-full lg:w-auto shrink-0">
                            <a
                                href={`/${currentLang}/store/print-report/current`}
                                className="px-6 py-3.5 rounded-xl bg-emerald-400 hover:bg-emerald-300 !text-slate-950 font-black text-sm text-center shadow-lg transition"
                            >
                                🖨️ 사장님 무료 A4 분석벽보 지금 인쇄하기 →
                            </a>
                            <a
                                href={`/${currentLang}/login?mode=store`}
                                className="px-6 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 !text-white font-bold text-xs text-center border border-white/20 transition"
                            >
                                🖥️ 매장 공식 코드 등록 &amp; PC 전광판 켜기 (무료)
                            </a>
                        </div>
                    </div>
                </div>

                {/* ── Feature Comparison Table ─────── */}
                <div className="glass-card overflow-hidden mb-16">
                    <div className="p-6 pb-0">
                        <h2 className="text-xl font-black text-center" style={{ color: 'var(--text-primary)' }}>
                            📋 오프라인 매장 무료 벽보 vs 개인 모바일 멤버십 비교
                        </h2>
                    </div>
                    <div className="overflow-x-auto p-6">
                        <table className="w-full text-sm">
                            <thead>
                                <tr style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                                    <th className="text-left py-3 pr-4 font-bold" style={{ color: 'var(--text-muted)' }}>제공 데이터 및 편의 기능</th>
                                    <th className="text-center py-3 px-4 font-bold" style={{ color: '#059669' }}>🏪 판매점 방문 벽보 (0원)</th>
                                    <th className="text-center py-3 px-4 font-bold" style={{ color: '#d97706' }}>⚡ 1회차 열람권 (3,900원)</th>
                                    <th className="text-center py-3 px-4 font-black" style={{ color: 'var(--accent-primary)' }}>📱 개인 무제한 (29,900원)</th>
                                    <th className="text-center py-3 px-4 font-black" style={{ color: '#7c3aed' }}>👑 VIP 프로 퀀트 (39,000원)</th>
                                </tr>
                            </thead>
                            <tbody style={{ color: 'var(--text-secondary)' }}>
                                {[
                                    ['이용 방법 및 장소', '매장 직접 방문 열람', '내 스마트폰 즉시 열람', '내 스마트폰 30일 무제한', '내 스마트폰 30일 무제한'],
                                    ['승무패·승5패 14경기 밸런스 분류표', '발매 초기 인쇄본', '✅ 해당 회차 실시간', '✅ 전 회차 실시간', '✅ 전 회차 실시간'],
                                    ['마감 직전 해외배당 급변동·결장자 반영', '❌ (종이 인쇄 후 미반영)', '✅ 실시간 반영', '✅ 실시간 자동 반영', '✅ 실시간 + 즉시 알림'],
                                    ['프로토 승부식(100+경기) 전 경기 분석', '상위 5경기 요약만', '✅ 전 경기 오픈', '✅ 한 달 내내 전 경기', '✅ 한 달 내내 전 경기'],
                                    ['포아송 득점 기대치(xG) & 7-Factor 지표', '요약본', '✅ 상세 열람', '✅ 무제한 열람', '✅ 무제한 열람'],
                                    ['14경기 예산별 OMR 복수 마킹 자동 배분기', '기본형 1종', '기본형', '표준형 포함', '✅ 전 예산 정밀 시뮬레이터'],
                                    ['켈리 공식(Kelly Criterion) 비중 계산기', '🔒', '🔒', '기본 제공', '✅ 정밀 포트폴리오 배분'],
                                ].map(([feature, store, pass, pro, vip], i) => (
                                    <tr key={i} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                                        <td className="py-3 pr-4 font-bold">{feature}</td>
                                        <td className="text-center py-3 px-4">{store}</td>
                                        <td className="text-center py-3 px-4 font-semibold">{pass}</td>
                                        <td className="text-center py-3 px-4 font-bold" style={{ color: 'var(--accent-primary)' }}>{pro}</td>
                                        <td className="text-center py-3 px-4 font-bold" style={{ color: '#7c3aed' }}>{vip}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* ── Trust Badges ─────────────────── */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-16">
                    {[
                        { icon: '🔒', label: 'KG이니시스 보안 결제', desc: '카드 · 네이버 · 카카오페이' },
                        { icon: '🏪', label: '전국 6,277개 매장 연동', desc: '공식 판매점 상생 파트너' },
                        { icon: '⚡', label: '원클릭 셀프 해지', desc: '마이페이지 즉시 해지 지원' },
                        { icon: '💯', label: '전자상거래법 준수', desc: '7일 이내 미사용 100% 환불' },
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
                                    className="w-full px-5 py-4 text-left flex items-center justify-between cursor-pointer"
                                    style={{ color: 'var(--text-primary)' }}>
                                    <span className="text-sm font-bold">{item.q}</span>
                                    <span className="text-lg transition-transform"
                                        style={{ transform: openFaq === i ? 'rotate(180deg)' : 'rotate(0)' }}>▾</span>
                                </button>
                                {openFaq === i && (
                                    <div className="px-5 pb-4 text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                                        {item.a}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>

                {/* ── Mandatory Legal Disclaimer & Payment Notice ── */}
                <div className="max-w-3xl mx-auto p-5 rounded-2xl mb-8 text-xs leading-relaxed text-center"
                    style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-subtle)', color: 'var(--text-muted)' }}>
                    <p className="font-bold mb-1.5" style={{ color: 'var(--text-secondary)' }}>
                        ⚖️ 스포츠 통계 데이터베이스 및 알고리즘 시뮬레이션 서비스 고지
                    </p>
                    <p>
                        본 서비스는 공개된 스포츠 데이터와 머신러닝 알고리즘에 기반한 통계적 시뮬레이션 지표를 제공하며, 특정 베팅을 권유하거나 결과를 보장하지 않습니다.
                        국민체육진흥공단 공식 대상 종목 및 글로벌 주요 프로 정규 리그의 순수 통계 데이터만을 취급하며 불법 사설 사이트와 일체 무관합니다.
                        모든 스포츠 관전 및 분석의 최종 판단과 책임은 사용자 본인에게 있습니다.
                    </p>
                </div>

                <div className="text-center text-xs space-y-1" style={{ color: 'var(--text-muted)' }}>
                    <p>결제는 <strong>KG이니시스</strong>를 통해 안전하게 처리됩니다. (신용/체크카드 · 카카오페이 · 네이버페이 · 계좌이체)</p>
                    <p className="mt-2 text-[10px]">상호: DesignBiz (Scorenix) | 사업자등록번호: 534-40-01041 | 통신판매업: 2024-전남나주-0053</p>
                </div>
            </main>
        </div>
    );
}
