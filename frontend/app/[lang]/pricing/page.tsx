"use client";
import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import Navbar from '../../components/Navbar';
import DeadlineBanner from '../../components/DeadlineBanner';
import { useDictionary } from '../../context/DictionaryContext';
import { i18n } from '../../lib/i18n-config';

export default function PricingPage() {
    const pathname = usePathname();
    const currentLang = i18n.locales.find((l) => pathname.startsWith(`/${l}/`) || pathname === `/${l}`) || i18n.defaultLocale;

    let dict;
    try {
        // eslint-disable-next-line react-hooks/rules-of-hooks
        dict = useDictionary();
    } catch {
        dict = null;
    }
    const t = dict?.pricing || {};

    return (
        <div className="min-h-screen flex flex-col" style={{ background: 'var(--bg-primary)' }}>
            <DeadlineBanner />
            <Navbar />

            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 text-center flex-grow">
                <h1 className="text-4xl font-extrabold sm:text-5xl" style={{ color: 'var(--text-primary)' }}>
                    {t.title || '수익을 극대화하는'} <span className="gradient-text">{t.titleHighlight || '스마트 분석'}</span>
                </h1>
                <p className="mt-4 text-xl" style={{ color: 'var(--text-muted)' }}>
                    {t.subtitle || '데이터에 기반한 정확한 스포츠 분석 기회를 놓치지 마세요.'}
                </p>

                <div className="mt-16 grid gap-8 lg:grid-cols-3 lg:gap-x-8">
                    {/* Free Plan */}
                    <div className="glass-card relative p-8 flex flex-col">
                        <div className="flex-1">
                            <h3 className="text-xl font-semibold" style={{ color: 'var(--text-primary)' }}>{t.free?.name || 'Free'}</h3>
                            <p className="absolute top-0 py-1.5 px-4 rounded-full text-xs font-semibold uppercase tracking-wide transform -translate-y-1/2"
                                style={{ background: 'var(--bg-elevated)', color: 'var(--text-muted)', border: '1px solid var(--border-subtle)' }}>
                                {t.free?.badge || '체험판'}
                            </p>
                            <p className="mt-4 flex items-baseline justify-center" style={{ color: 'var(--text-primary)' }}>
                                <span className="text-5xl font-extrabold tracking-tight">{t.free?.price || '0원'}</span>
                                <span className="ml-1 text-xl font-semibold">{t.free?.period || '/월'}</span>
                            </p>
                            <p className="mt-6" style={{ color: 'var(--text-muted)' }}>{t.free?.description || '기본적인 가치 확인 가능'}</p>
                            <ul role="list" className="mt-6 space-y-4 text-sm" style={{ color: 'var(--text-secondary)' }}>
                                {(t.free?.features || ['일일 3개 종목 확인', '기본 수익률 계산기']).map((f: string, i: number) => (
                                    <li key={i} className="flex"><span className="mr-3" style={{ color: 'var(--accent-primary)' }}>✓</span>{f}</li>
                                ))}
                            </ul>
                        </div>
                        <Link href={`/${currentLang}/register`} className="mt-8 block w-full py-3 text-sm font-semibold text-center rounded-xl transition-all"
                            style={{ background: 'rgba(0,212,255,0.1)', color: 'var(--accent-primary)', border: '1px solid rgba(0,212,255,0.3)' }}>
                            {t.free?.cta || '무료로 시작하기'}
                        </Link>
                    </div>

                    {/* Pro Plan */}
                    <div className="glass-card relative p-8 flex flex-col ring-2" style={{ borderColor: 'var(--accent-primary)', boxShadow: '0 0 30px rgba(0,212,255,0.15)' }}>
                        <div className="flex-1">
                            <h3 className="text-xl font-semibold" style={{ color: 'var(--text-primary)' }}>{t.pro?.name || 'Pro Investor'}</h3>
                            <p className="absolute top-0 py-1.5 px-4 rounded-full text-xs font-semibold uppercase tracking-wide text-white transform -translate-y-1/2"
                                style={{ background: 'linear-gradient(135deg, var(--accent-primary), var(--accent-secondary))' }}>
                                {t.pro?.badge || '인기'}
                            </p>
                            <p className="mt-4 flex items-baseline justify-center" style={{ color: 'var(--text-primary)' }}>
                                <span className="text-5xl font-extrabold tracking-tight gradient-text">{t.pro?.price || '55,000원'}</span>
                                <span className="ml-1 text-xl font-semibold" style={{ color: 'var(--text-muted)' }}>{t.pro?.period || '/월'}</span>
                            </p>
                            <p className="mt-6" style={{ color: 'var(--text-muted)' }}>{t.pro?.description || '본격적인 수익 창출을 위한 플랜'}</p>
                            <ul role="list" className="mt-6 space-y-4 text-sm" style={{ color: 'var(--text-secondary)' }}>
                                {(t.pro?.features || ['무제한 AI 분석 리포트', '실시간 알림 서비스', '고급 포트폴리오 관리', '단일 경기 심층 분석']).map((f: string, i: number) => (
                                    <li key={i} className="flex"><span className="mr-3" style={{ color: 'var(--accent-primary)' }}>✓</span>{f}</li>
                                ))}
                            </ul>
                        </div>
                        <Link href={`/${currentLang}/payment/request?plan=pro`} className="btn-primary mt-8 block w-full py-3 text-sm font-semibold text-center">
                            {t.pro?.cta || '지금 구독하기'}
                        </Link>
                    </div>

                    {/* VIP Plan */}
                    <div className="glass-card relative p-8 flex flex-col">
                        <div className="flex-1">
                            <h3 className="text-xl font-semibold" style={{ color: 'var(--text-primary)' }}>{t.vip?.name || 'VIP'}</h3>
                            <p className="mt-4 flex items-baseline justify-center" style={{ color: 'var(--text-primary)' }}>
                                <span className="text-5xl font-extrabold tracking-tight">{t.vip?.price || '105,000원'}</span>
                                <span className="ml-1 text-xl font-semibold" style={{ color: 'var(--text-muted)' }}>{t.vip?.period || '/월'}</span>
                            </p>
                            <p className="mt-6" style={{ color: 'var(--text-muted)' }}>{t.vip?.description || '전문가를 위한 1:1 케어'}</p>
                            <ul role="list" className="mt-6 space-y-4 text-sm" style={{ color: 'var(--text-secondary)' }}>
                                {(t.vip?.features || ['Pro 플랜의 모든 기능', '전용 텔레그램 채널', '우선적 고객 지원']).map((f: string, i: number) => (
                                    <li key={i} className="flex"><span className="mr-3" style={{ color: 'var(--accent-secondary)' }}>✓</span>{f}</li>
                                ))}
                            </ul>
                        </div>
                        <Link href={`/${currentLang}/payment/request?plan=vip`} className="mt-8 block w-full py-3 text-sm font-semibold text-center rounded-xl transition-all"
                            style={{ background: 'rgba(139,92,246,0.1)', color: 'var(--accent-secondary)', border: '1px solid rgba(139,92,246,0.3)' }}>
                            {t.vip?.cta || '문의하기'}
                        </Link>
                    </div>
                </div>
            </main>
        </div>
    );
}
