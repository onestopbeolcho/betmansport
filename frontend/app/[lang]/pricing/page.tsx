"use client";
import React, { useState } from 'react';
import { usePathname } from 'next/navigation';
import Navbar from '../../components/Navbar';
import DeadlineBanner from '../../components/DeadlineBanner';
import { useAuth } from '../../context/AuthContext';
import { i18n } from '../../lib/i18n-config';

/* ── 요금제 데이터 (베트맨 프로토 정밀 AI 리포트 마이크로 결제 & B2B 판매점 출력 솔루션) ── */
const PLANS = {
    round_pass: {
        name: '이번 회차 열람권',
        badge: '⚡ 단건 간편결제 · 부담 제로',
        badgeBg: 'linear-gradient(135deg, #f59e0b, #eab308)',
        badgeColor: '#0f172a',
        price: '1,500원',
        period: '/회차',
        tagline: '현재 발매 중인 프로토 회차 즉시 해금',
        description: '일반 경기 승패 확률은 100% 무료! AI 확신도 85% 이상 핵심 주력 픽과 2·3폴더 조합 계산기만 회차당 1,500원에 가볍게 열람하세요.',
        features: [
            { icon: '💎', text: '이번 회차 AI 확신도 85%+ 핵심 주력 픽 전체 오픈', highlight: true },
            { icon: '🎯', text: '환급률 극대화 주력 2폴더 & 중배당 3폴더 조합 공개', highlight: true },
            { icon: '🧮', text: '프로토 조합 계산기 및 예상 환급금 시뮬레이터 활성화', highlight: true },
            { icon: '💰', text: '베트맨 공시 배당 대비 +EV 배당 가치 Top 5 제공', highlight: false },
            { icon: '⚠️', text: '대중 쏠림 저배당 함정 경기 주의보 포함', highlight: false },
        ],
        limitations: ['이번 발매 회차에 한해 적용 (자동 정기결제 없음)'],
        accent: '#fbbf24',
    },
    pro: {
        name: '개인 월 무제한 패스',
        badge: '🔥 개인 회원 최다 선택',
        badgeBg: 'linear-gradient(135deg, #00d4ff, #8b5cf6)',
        badgeColor: '#fff',
        price: '9,900원',
        period: '/월',
        tagline: '한 달 내내 모든 프로토 회차 무제한 공략',
        description: '주 3회(월·수·금) 발행되는 프로토 승부식 전 회차(월 12~14회차)의 핵심 주력 픽과 조합 계산기, 켈리 비중 계산기를 무제한으로 이용합니다.',
        features: [
            { icon: '🔓', text: '한 달간 발행되는 모든 프로토 승부식 회차 무제한 열람', highlight: true },
            { icon: '💎', text: 'AI 확신도 85%+ 핵심 주력 픽 & 조합 계산기 무제한', highlight: true },
            { icon: '🏆', text: '켈리 공식(Kelly Criterion) 비중 배분 시뮬레이터 포함', highlight: true },
            { icon: '📊', text: '배당 가치 Top 5 & 함정 경기 주의보 실시간 업데이트', highlight: true },
            { icon: '💬', text: 'AI 스포츠 통계 챗봇 및 적중 영수증 아카이브 무제한', highlight: false },
        ],
        limitations: [],
        accent: 'var(--accent-primary)',
    },
    store_b2b: {
        name: 'B2B 판매점 A4 출력 구독',
        badge: '🏪 복권방·토토 판매점 점주 전용',
        badgeBg: 'linear-gradient(135deg, #10b981, #059669)',
        badgeColor: '#fff',
        price: '39,000원',
        period: '/월',
        tagline: '정가 49,000원 → 초기 가맹점 런칭 특가',
        description: '매 회차 발매 직후 A4 1장으로 원클릭 인쇄하여 매장 벽면·테이블에 비치하세요! 방문 손님의 체류시간과 마킹 회전율이 즉시 상승합니다.',
        features: [
            { icon: '🖨️', text: '점주 전용 [A4 원클릭 인쇄 / PDF 리포트 뷰] 무제한 출력', highlight: true },
            { icon: '🏷️', text: '우리 매장 상호명 커스텀 헤더 & 공지문 인쇄 지원', highlight: true },
            { icon: '📱', text: '출력물 하단 스마트폰 실시간 배당 확인 QR코드 자동 생성', highlight: true },
            { icon: '📋', text: '주력 2·3폴더 / 배당가치 Top 5 / 함정주의보 한 장 요약', highlight: true },
            { icon: '🎁', text: '신규 가맹 판매점 2주 무료 체험 즉시 제공', highlight: false },
        ],
        limitations: [],
        accent: '#34d399',
    },
};

const FAQ_ITEMS = [
    { q: '본 서비스는 어떤 성격의 서비스인가요?', a: '스코어닉스는 공개된 스포츠 데이터와 머신러닝 알고리즘에 기반한 스포츠 통계 데이터베이스 및 시뮬레이션 SaaS 소프트웨어입니다. 특정 베팅을 권유하거나 결과를 보장하지 않으며 순수 통계 리포트 구독권을 제공합니다.' },
    { q: '결제 후 바로 이용 가능한가요?', a: '네, KG이니시스 보안 결제(신용/체크카드, 카카오페이, 네이버페이) 완료 즉시 계정에 데이터 멤버십 등급이 자동 반영되어 전 경기 리포트를 열람하실 수 있습니다.' },
    { q: '구독 해지 및 환불 정책은 어떻게 되나요?', a: '마이페이지에서 CS 문의 없이 언제든 원클릭으로 구독을 해지할 수 있습니다. 결제일로부터 7일 이내 미사용 시 100% 환불되며, 사용 이력이 있는 경우 전자상거래법 기준 일할 계산 산식에 따라 잔여 기간 환불이 처리됩니다.' },
    { q: '어떤 리그의 통계 데이터를 제공하나요?', a: '국민체육진흥공단 공식 대상 종목 및 글로벌 주요 프로 정규 리그(EPL, 라리가, 분데스리가, 세리에A, 리그1, UCL, K리그1, J리그, MLB, NBA, NHL 등 17개 리그)의 공개 통계 데이터를 분석합니다.' },
];

export default function PricingPage() {
    const pathname = usePathname() || '';
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
                <div className="text-center mb-14">
                    <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-bold mb-6"
                        style={{ background: 'rgba(0,212,255,0.1)', color: 'var(--accent-primary)', border: '1px solid rgba(0,212,255,0.2)' }}>
                        ☕ 커피 한 잔 값(월 3,900원)으로 시작하는 AI 스포츠 통계 시뮬레이션 SaaS
                    </div>
                    <h1 className="text-4xl font-extrabold sm:text-5xl leading-tight" style={{ color: 'var(--text-primary)' }}>
                        데이터로 읽는 <span className="gradient-text">스포츠 통계 리포트 멤버십</span>
                    </h1>
                    <p className="mt-4 text-base sm:text-lg max-w-2xl mx-auto" style={{ color: 'var(--text-muted)' }}>
                        8,960+ 경기 학습 머신러닝 엔진이 포아송 기대득점(xG)과 기대값(+EV) 지표를 실시간 시뮬레이션합니다.<br />
                        부담 없는 소액 구독으로 전 경기 정밀 통계 리포트를 확인하세요.
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
                            월간 구독
                        </button>
                        <button
                            onClick={() => setBilling('annual')}
                            className="px-5 py-2 text-sm font-semibold rounded-lg transition-all relative"
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

                {/* ── Plan Cards ───────────────────── */}
                <div className="grid gap-8 lg:grid-cols-3 lg:gap-x-6 mb-16">
                    {Object.entries(PLANS).map(([id, plan]) => {
                        const isRoundPass = id === 'round_pass';
                        const isPro = id === 'pro';
                        const isStoreB2B = id === 'store_b2b';
                        const monthlyPrice = id === 'pro' ? 9900 : id === 'store_b2b' ? 39000 : 0;
                        const displayPrice = billing === 'annual' && monthlyPrice > 0
                            ? Math.round(monthlyPrice * 0.8).toLocaleString() + '원'
                            : plan.price;

                        return (
                            <div key={id} className="glass-card relative p-8 flex flex-col"
                                style={{
                                    border: isPro ? '2px solid var(--accent-primary)' : isStoreB2B ? '2px solid #10b981' : '1px solid rgba(251,191,36,0.35)',
                                    boxShadow: isPro ? '0 0 40px rgba(0,212,255,0.15)' : isStoreB2B ? '0 0 40px rgba(16,185,129,0.14)' : undefined,
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
                                    {billing === 'annual' && monthlyPrice > 0 ? (
                                        <p className="text-xs mt-1 text-center" style={{ color: '#ef4444' }}>
                                            연 {(Math.round(monthlyPrice * 0.8) * 12).toLocaleString()}원 (월 {Math.round(monthlyPrice * 0.8).toLocaleString()}원)
                                        </p>
                                    ) : isRoundPass ? (
                                        <p className="text-xs mt-1 text-center font-semibold" style={{ color: '#fbbf24' }}>
                                            정기결제 부담 없는 1회차 단건 열람권
                                        </p>
                                    ) : isPro ? (
                                        <p className="text-xs mt-1 text-center font-semibold" style={{ color: '#34d399' }}>
                                            회차당 약 750원꼴 · 언제든 1클릭 해지 가능
                                        </p>
                                    ) : (
                                        <p className="text-xs mt-1 text-center font-semibold" style={{ color: '#34d399' }}>
                                            점주 2주 무료 체험 제공 · 정가 49,000원 → 39,000원
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

                                    {plan.limitations && plan.limitations.length > 0 && (
                                        <div className="mt-4 pt-4" style={{ borderTop: '1px solid var(--border-subtle)' }}>
                                            <ul className="space-y-1.5 text-xs" style={{ color: 'var(--text-muted)' }}>
                                                {plan.limitations.map((l, i) => (
                                                    <li key={i} className="flex items-center gap-2">
                                                        <span style={{ color: '#fbbf24' }}>•</span>{l}
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
                                        ⚡ 1,500원으로 이번 회차 즉시 열기
                                    </a>
                                ) : isPro ? (
                                    <a href={`/${currentLang}/payment/request?plan=pro&billing=${billing}`}
                                        className="btn-primary mt-8 block w-full py-3.5 text-sm font-bold text-center">
                                        💎 월 9,900원 전 회차 무제한 시작
                                    </a>
                                ) : (
                                    <div className="mt-8 space-y-2">
                                        <a href={`/${currentLang}/payment/request?plan=store_b2b&billing=${billing}`}
                                            className="block w-full py-3.5 text-sm font-black text-center rounded-xl transition-all hover:opacity-90"
                                            style={{ background: 'linear-gradient(135deg, #10b981, #059669)', color: '#fff' }}>
                                            🏪 월 39,000원 판매점 B2B 구독하기
                                        </a>
                                        <a href={`/${currentLang}/store/print-report/current`}
                                            className="block w-full py-2 text-xs font-bold text-center rounded-xl border border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/10">
                                            🖨️ A4 출력 샘플 보기 &amp; 2주 무료체험 신청 →
                                        </a>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>

                {/* ── Feature Comparison Table ─────── */}
                <div className="glass-card overflow-hidden mb-16">
                    <div className="p-6 pb-0">
                        <h2 className="text-xl font-bold text-center" style={{ color: 'var(--text-primary)' }}>
                            📋 데이터 멤버십 등급별 제공 지표 비교
                        </h2>
                    </div>
                    <div className="overflow-x-auto p-6">
                        <table className="w-full text-sm">
                            <thead>
                                <tr style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                                    <th className="text-left py-3 pr-4 font-semibold" style={{ color: 'var(--text-muted)' }}>제공 통계 기능</th>
                                    <th className="text-center py-3 px-4 font-semibold" style={{ color: 'var(--text-muted)' }}>Free (0원)</th>
                                    <th className="text-center py-3 px-4 font-bold" style={{ color: 'var(--accent-primary)' }}>Basic Pass (3,900원)</th>
                                    <th className="text-center py-3 px-4 font-bold" style={{ color: 'var(--accent-secondary)' }}>Pro Quant (9,900원)</th>
                                </tr>
                            </thead>
                            <tbody style={{ color: 'var(--text-secondary)' }}>
                                {[
                                    ['실시간 글로벌 확률 지수 비교', '3개 리그', '17개 전 리그', '17개 전 리그'],
                                    ['머신러닝 시뮬레이션 리포트', '일일 1건 샘플', '무제한 열람', '무제한 열람'],
                                    ['AI 핵심 밸류 리포트 (+EV 상위 3경기)', '🔒', '✅', '✅'],
                                    ['포아송 득점 기대치(xG) & 7-Factor 지표', '샘플만 공개', '✅ 전 경기', '✅ 전 경기'],
                                    ['모델 신뢰도 게이지 & 편차 분석', '제한', '✅', '✅'],
                                    ['AI 스포츠 통계 챗봇', '일 5회', '무제한', '무제한'],
                                    ['켈리 공식(Kelly Criterion) 비중 시뮬레이터', '🔒', '🔒', '✅'],
                                    ['다중 경기 확률 조합 시뮬레이터', '🔒', '🔒', '✅ 무제한'],
                                    ['배당률 왜곡 감지 실시간 알림', '🔒', '기본 알림', '✅ 즉시 푸시 알림'],
                                    ['백테스트 원본 로그 & 주간 통계 리포트', '요약본', '요약본', '✅ 전체 열람'],
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
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-16">
                    {[
                        { icon: '🔒', label: 'KG이니시스 보안 결제', desc: '카드 · 네이버 · 카카오페이' },
                        { icon: '🧠', label: '3-Pillar 퀀트 엔진', desc: '8,960+ 경기 시뮬레이션' },
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
