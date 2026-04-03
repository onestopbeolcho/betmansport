"use client";
import React from 'react';
import { usePathname } from 'next/navigation';
import { useAuth } from '../context/AuthContext';
import { i18n, type Locale } from '../lib/i18n-config';
import { useDictionarySafe } from '../context/DictionaryContext';

interface PremiumGateProps {
    /** Content to show (will be blurred for free users) */
    children: React.ReactNode;
    /** Feature name shown in the overlay */
    featureName?: string;
    /** Tier required: 'pro' | 'vip' */
    requiredTier?: string;
    /** If true, shows a teaser instead of full blur */
    showTeaser?: boolean;
}

/**
 * PremiumGate — 멤버십 게이팅 컴포넌트
 * 
 * 무료 유저: 콘텐츠가 블러 처리되고 업그레이드 오버레이가 표시됩니다.
 * 유료 유저: 콘텐츠가 정상 표시됩니다.
 * 
 * Usage:
 *   <PremiumGate featureName="AI 상세 분석">
 *     <DetailedAnalysis />
 *   </PremiumGate>
 */
export default function PremiumGate({
    children,
    featureName = "Premium Feature",
    requiredTier = "pro",
    showTeaser = true,
}: PremiumGateProps) {
    const { user } = useAuth();
    const pathname = usePathname();
    const dict = useDictionarySafe();
    const tp = dict?.premiumGate || {};
    const sortedLocales = [...i18n.locales].sort((a, b) => b.length - a.length);
    const currentLang = sortedLocales.find((l) => pathname.startsWith(`/${l}/`) || pathname === `/${l}`) || i18n.defaultLocale;

    // Determine if user has access
    const userTier = user?.tier || 'free';
    const tierOrder: Record<string, number> = { free: 0, pro: 1, vip: 2 };
    const hasAccess = (tierOrder[userTier] || 0) >= (tierOrder[requiredTier] || 1);

    if (hasAccess) {
        return <>{children}</>;
    }

    return (
        <div className="relative">
            {/* Blurred Content */}
            <div
                style={{
                    filter: showTeaser ? 'blur(8px)' : 'blur(20px)',
                    pointerEvents: 'none',
                    userSelect: 'none',
                    WebkitUserSelect: 'none',
                }}
            >
                {children}
            </div>

            {/* Overlay */}
            <div className="absolute inset-0 flex flex-col items-center justify-center z-10">
                <div
                    className="glass-card p-6 text-center max-w-sm mx-auto space-y-4"
                    style={{
                        background: 'rgba(6,6,10,0.85)',
                        backdropFilter: 'blur(20px)',
                        border: '1px solid rgba(0,212,255,0.2)',
                    }}
                >
                    {/* Lock Icon */}
                    <div className="w-14 h-14 mx-auto rounded-2xl bg-gradient-to-br from-[var(--accent-primary)] to-[var(--accent-secondary)] flex items-center justify-center text-2xl shadow-lg"
                        style={{ boxShadow: 'var(--glow-cyan)' }}>
                        🔒
                    </div>

                    <h3 className="text-base font-extrabold text-white">{featureName}</h3>
                    <p className="text-xs text-[var(--text-muted)] leading-relaxed">
                        {tp.description || 'This feature is'} <span className="text-[var(--accent-primary)] font-bold">
                            {requiredTier === 'pro' ? 'Pro Investor' : 'VIP'}
                        </span> {tp.memberOnly || 'available for members and above.'}
                    </p>

                    <a href={`/${currentLang}/pricing`}>
                        <button className="btn-primary w-full py-3 text-sm font-bold rounded-xl">
                            💎 {tp.upgrade || 'Upgrade Membership'}
                        </button>
                    </a>

                    {!user && (
                        <a href={`/${currentLang}/login`} className="text-xs text-[var(--text-muted)] hover:text-[var(--accent-primary)] transition">
                            {tp.alreadyMember || 'Already a member?'} {dict?.auth?.loginLink || 'Sign In'}
                        </a>
                    )}
                </div>
            </div>
        </div>
    );
}
