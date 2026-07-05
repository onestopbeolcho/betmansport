"use client";
import React from 'react';
import { usePathname } from 'next/navigation';
import { useAuth } from '../context/AuthContext';
import { i18n, type Locale } from '../lib/i18n-config';
import { useDictionarySafe } from '../context/DictionaryContext';

interface PremiumGateProps {
    /** Content to show (Always visible now for SEO and Global Traffic) */
    children: React.ReactNode;
    /** Feature name shown in the overlay */
    featureName?: string;
    /** Tier required: 'pro' | 'vip' */
    requiredTier?: string;
    /** If true, shows a teaser instead of full blur (Deprecated, ignored now) */
    showTeaser?: boolean;
}

/**
 * PremiumGate — 글로벌 무료화 피벗 대응 컴포넌트
 * 
 * 기존: 유료 멤버십 등급에 따라 콘텐츠 블러 및 결제 창 안내
 * 현재: 콘텐츠 100% 공개 (SEO 인덱싱 극대화) + 하단 은은한 비즈니스 협업 제안 및 광고 게재 카드 노출
 */
export default function PremiumGate({
    children,
    featureName = "AI Premium Feature",
    requiredTier = "pro",
    showTeaser = true,
}: PremiumGateProps) {
    const { user } = useAuth();
    const pathname = usePathname();
    const dict = useDictionarySafe();
    const tp = dict?.premiumGate || {};
    const sortedLocales = [...i18n.locales].sort((a, b) => b.length - a.length);
    const currentLang = sortedLocales.find((l) => pathname.startsWith(`/${l}/`) || pathname === `/${l}`) || i18n.defaultLocale;

    const isKo = currentLang === 'ko';

    return (
        <div className="relative w-full">
            {/* 100% Open & SEO Friendly Content (No blur) */}
            <div className="w-full">
                {children}
            </div>

            {/* Bottom Partnership Card Prompt */}
            <div className="mt-4 p-4 rounded-xl text-center max-w-full mx-auto space-y-3"
                style={{
                    background: 'rgba(15,15,25,0.7)',
                    backdropFilter: 'blur(10px)',
                    border: '1px solid rgba(0,212,255,0.12)',
                }}
            >
                <div className="flex flex-col sm:flex-row items-center justify-between gap-3 text-left">
                    <div className="flex items-center space-x-3">
                        <span className="text-2xl">🤝</span>
                        <div>
                            <h4 className="text-xs font-bold text-white flex items-center gap-1.5">
                                <span className="w-1.5 h-3 bg-cyan-400 rounded-full"></span>
                                {featureName} (100% 무료 공개)
                            </h4>
                            <p className="text-[10px] text-[var(--text-muted)] leading-relaxed mt-0.5">
                                {isKo 
                                    ? 'Scorenix의 모든 정밀 데이터 분석은 무료로 제공됩니다. 비즈니스 협업 및 광고 제휴 문의를 적극 환영합니다.' 
                                    : 'All predictive sports data is provided free of charge. We welcome advertising and business partnerships.'}
                            </p>
                        </div>
                    </div>
                    <a href={`/${currentLang}/pricing`} className="w-full sm:w-auto">
                        <button className="w-full sm:w-auto px-4 py-2 bg-gradient-to-r from-cyan-500 to-purple-500 hover:from-cyan-400 hover:to-purple-400 text-[10px] font-black text-white rounded-lg transition shadow-md shadow-cyan-500/10">
                            ✉️ {isKo ? '제휴 및 광고 문의' : 'Partnership Inquiry'}
                        </button>
                    </a>
                </div>
            </div>
        </div>
    );
}
