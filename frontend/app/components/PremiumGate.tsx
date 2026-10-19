"use client";
import React from 'react';
import { usePathname } from 'next/navigation';
import { useAuth } from '../context/AuthContext';
import { i18n } from '../lib/i18n-config';
import { useDictionarySafe } from '../context/DictionaryContext';

interface PremiumGateProps {
    children: React.ReactNode;
    /** Feature name shown in the overlay */
    featureName?: string;
    /** Tier required: 'pro' | 'vip' */
    requiredTier?: string;
    /** If true, unlocks this specific instance as the daily 1-match free sample */
    isFreeSample?: boolean;
    showTeaser?: boolean;
}

const TIER_LEVELS: Record<string, number> = {
    free: 0,
    basic: 1,
    pro: 2,
    vip: 3,
    premium: 3,
    admin: 99,
};

export default function PremiumGate({
    children,
    featureName = "AI 정밀 분석 리포트",
    requiredTier = "pro",
    isFreeSample = false,
}: PremiumGateProps) {
    const { user } = useAuth();
    const pathname = usePathname() || '';
    const dict = useDictionarySafe();
    const tp = dict?.premiumGate || {};
    const sortedLocales = [...i18n.locales].sort((a, b) => b.length - a.length);
    const currentLang = sortedLocales.find((l) => pathname.startsWith(`/${l}/`) || pathname === `/${l}`) || i18n.defaultLocale;

    const userTierKey = user?.role === 'admin' ? 'admin' : (user?.tier || 'free').toLowerCase();
    const userLevel = TIER_LEVELS[userTierKey] ?? 0;
    const reqLevel = TIER_LEVELS[requiredTier.toLowerCase()] ?? 2;
    const hasAccess = userLevel >= reqLevel;

    // 1. 유료 구독자(Pro / VIP / Admin) → 전체 공개
    if (hasAccess) {
        return <div className="relative w-full">{children}</div>;
    }

    // 2. 무료 회원의 '일일 1경기 무료 샘플' → 샘플 배지와 함께 공개
    if (isFreeSample) {
        return (
            <div className="relative w-full">
                <div className="mb-2 px-3 py-1.5 rounded-lg flex items-center justify-between text-[11px]"
                    style={{ background: 'rgba(0,212,255,0.1)', border: '1px solid rgba(0,212,255,0.25)' }}>
                    <span className="font-bold text-cyan-300">🎁 오늘의 무료 AI 분석 리포트 체험 (일일 1건 제공)</span>
                    <a href={`/${currentLang}/pricing`} className="font-black text-cyan-400 hover:underline">
                        전 경기 무제한 열람 →
                    </a>
                </div>
                {children}
            </div>
        );
    }

    // 3. 권한 미달 시 → 블러 프리뷰 + 구독 유도 오버레이
    const isVipGate = reqLevel >= 3;
    const badgeLabel = isVipGate ? '👑 PRO QUANT 멤버십 전용' : '☕ BASIC PASS 데이터 멤버십 전용';
    const planParam = isVipGate ? 'vip' : 'pro';
    const priceLabel = isVipGate ? 'Pro Quant (월 9,900원)' : 'Basic Pass (월 3,900원 · 커피 한 잔 값)';

    return (
        <div className="relative w-full overflow-hidden rounded-xl">
            {/* Blurred teaser content */}
            <div
                className="w-full select-none pointer-events-none"
                style={{ filter: 'blur(7px)', opacity: 0.35 }}
                aria-hidden="true"
            >
                {children}
            </div>

            {/* Lock overlay */}
            <div
                className="absolute inset-0 z-10 flex flex-col items-center justify-center p-5 text-center"
                style={{
                    background: 'linear-gradient(180deg, rgba(13,19,33,0.72) 0%, rgba(13,19,33,0.95) 100%)',
                    backdropFilter: 'blur(4px)',
                }}
            >
                <span
                    className="text-[10px] font-black px-2.5 py-1 rounded-full mb-2 tracking-wider"
                    style={{
                        background: isVipGate ? 'rgba(245,158,11,0.18)' : 'rgba(0,212,255,0.15)',
                        color: isVipGate ? '#fbbf24' : '#00d4ff',
                        border: isVipGate ? '1px solid rgba(245,158,11,0.35)' : '1px solid rgba(0,212,255,0.3)',
                    }}
                >
                    {badgeLabel}
                </span>

                <h4 className="text-sm sm:text-base font-black text-white mb-1">
                    {featureName} 잠금
                </h4>
                <p className="text-xs text-white/60 max-w-md mb-4 leading-relaxed">
                    {tp.lockedDesc || '무료 체험 등급은 일일 1건의 AI 샘플 리포트만 열람 가능합니다. 커피 한 잔 값(월 3,900원)으로 포아송 기대득점(xG)·신뢰도 게이지·기대값(+EV) 핵심 리포트를 무제한 확인하세요.'}
                </p>

                <div className="flex flex-wrap items-center justify-center gap-2">
                    <a
                        href={`/${currentLang}/payment/request?plan=${planParam}&billing=monthly`}
                        className="px-5 py-2.5 rounded-xl text-xs font-black text-white transition-all hover:scale-105 shadow-lg"
                        style={{
                            background: isVipGate
                                ? 'linear-gradient(135deg, #f59e0b, #d97706)'
                                : 'linear-gradient(135deg, #00d4ff, #8b5cf6)',
                        }}
                    >
                        💳 {priceLabel} 구독하기
                    </a>
                    <a
                        href={`/${currentLang}/pricing`}
                        className="px-4 py-2.5 rounded-xl text-xs font-bold text-white/70 hover:text-white border border-white/15 hover:bg-white/5 transition-all"
                    >
                        멤버십 혜택 비교
                    </a>
                </div>
            </div>
        </div>
    );
}
