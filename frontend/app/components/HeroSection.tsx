
"use client";
import React from 'react';
import Link from 'next/link';
import { useDictionary } from '../context/DictionaryContext';
import { i18n } from '../lib/i18n-config';
import { usePathname } from 'next/navigation';

export default function HeroSection() {
    const pathname = usePathname();
    const currentLang = i18n.locales.find((l) => pathname.startsWith(`/${l}/`) || pathname === `/${l}`) || i18n.defaultLocale;

    let dict;
    try {
        // eslint-disable-next-line react-hooks/rules-of-hooks
        dict = useDictionary();
    } catch {
        dict = null;
    }
    const t = dict?.hero || {};

    return (
        <section className="relative overflow-hidden">
            {/* Background gradient orbs */}
            <div className="absolute inset-0 pointer-events-none">
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[500px]"
                    style={{ background: 'radial-gradient(ellipse 80% 60% at 50% 0%, rgba(0, 212, 255, 0.12) 0%, transparent 60%)' }} />
                <div className="absolute top-20 right-0 w-[400px] h-[400px]"
                    style={{ background: 'radial-gradient(circle at center, rgba(139, 92, 246, 0.08) 0%, transparent 60%)' }} />
                <div className="absolute bottom-0 left-0 w-[300px] h-[300px]"
                    style={{ background: 'radial-gradient(circle at center, rgba(0, 212, 255, 0.05) 0%, transparent 60%)' }} />
            </div>

            <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 sm:py-28">
                <div className="text-center">
                    {/* Badge */}
                    <div className="inline-flex items-center px-4 py-1.5 rounded-full border border-[var(--border-accent)] bg-[rgba(0,212,255,0.06)] text-xs text-[var(--accent-primary)] mb-8 animate-fade-up">
                        <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent-primary)] mr-2 animate-pulse" />
                        {t.badge || '실시간 AI 분석 가동 중'}
                    </div>

                    {/* Title */}
                    <h1 className="text-4xl sm:text-5xl lg:text-7xl font-black text-white leading-tight mb-6 animate-fade-up" style={{ animationDelay: '80ms' }}>
                        {t.titleLine1 || 'AI가 분석하는'}<br />
                        <span className="gradient-text-glow">{t.titleLine2 || '스포츠 데이터'}</span>
                    </h1>

                    <p className="text-base sm:text-lg text-[var(--text-secondary)] max-w-2xl mx-auto mb-10 animate-fade-up" style={{ animationDelay: '160ms' }}>
                        {t.subtitle || '글로벌 데이터 소스 기반 AI 통계 분석 · 경기 확률 예측 · 조합 최적화'}
                    </p>

                    {/* CTA */}
                    <div className="flex flex-col sm:flex-row items-center justify-center gap-3 animate-fade-up" style={{ animationDelay: '240ms' }}>
                        <Link href={`/${currentLang}/bets`} className="btn-primary text-base px-8 py-3.5 animate-pulse-glow">
                            {t.ctaPrimary || 'AI 분석 시작 →'}
                        </Link>
                        <Link href={`/${currentLang}/market`} className="btn-ghost text-base px-8 py-3.5">
                            {t.ctaSecondary || '전체 경기 보기'}
                        </Link>
                    </div>

                    {/* Stats */}
                    <div className="mt-16 grid grid-cols-3 gap-4 max-w-lg mx-auto stagger-children" style={{ animationDelay: '320ms' }}>
                        {[
                            { label: t.statMatches || '분석 경기', value: '94+', icon: '⚽' },
                            { label: t.statLeagues || '지원 리그', value: '15+', icon: '🏆' },
                            { label: t.statUpdate || '업데이트', value: t.statUpdateValue || '실시간', icon: '⚡' },
                        ].map((stat, i) => (
                            <div key={i} className="gradient-border-card p-5 text-center">
                                <div className="text-lg mb-1">{stat.icon}</div>
                                <div className="text-2xl sm:text-3xl font-black gradient-text">{stat.value}</div>
                                <div className="text-[10px] text-[var(--text-muted)] mt-1 uppercase tracking-wider">{stat.label}</div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </section>
    );
}
