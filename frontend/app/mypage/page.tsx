"use client";
import React, { useEffect, useState, useRef } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import ReactMarkdown from 'react-markdown';
import Navbar from '../components/Navbar';
import DeadlineBanner from '../components/DeadlineBanner';
import { useAuth } from '../context/AuthContext';
import { useDictionarySafe } from '../context/DictionaryContext';
import { i18n } from '../lib/i18n-config';

interface SlipItem {
    id: string;
    match_name: string;
    selection: string;
    odds: number;
    team_home: string;
    team_away: string;
}

interface Slip {
    id: number;
    items: SlipItem[];
    stake: number;
    total_odds: number;
    potential_return: number;
    status: string;
    created_at: string;
}



export default function MyPage() {
    const { user } = useAuth();
    const router = useRouter();
    const pathname = usePathname();
    const dict = useDictionarySafe();
    const t = dict?.mypage || {} as any;
    const sortedLocales = [...i18n.locales].sort((a, b) => b.length - a.length);
    const currentLang = sortedLocales.find((l) => pathname.startsWith(`/${l}/`) || pathname === `/${l}`) || i18n.defaultLocale;
    const API = process.env.NEXT_PUBLIC_API_URL || '';



    // Slips state
    const [slips, setSlips] = useState<Slip[]>([]);
    const [slipsLoading, setSlipsLoading] = useState(true);
    const [showSlips, setShowSlips] = useState(false);



    // AI Intelligence state
    const [backtestData, setBacktestData] = useState<any>(null);
    const [weakPatterns, setWeakPatterns] = useState<any>(null);
    const [strongPatterns, setStrongPatterns] = useState<any>(null);
    const [topPredictions, setTopPredictions] = useState<any[]>([]);
    const [btLoading, setBtLoading] = useState(true);

    // Fetch slips
    useEffect(() => {
        const fetchSlips = async () => {
            const token = localStorage.getItem('token');
            if (!token) {
                setSlipsLoading(false);
                return;
            }
            try {
                const res = await fetch(`${API}/api/portfolio/slips/my`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                if (res.ok) {
                    const data = await res.json();
                    setSlips(data);
                }
            } catch (e) {
                console.error(e);
            } finally {
                setSlipsLoading(false);
            }
        };
        fetchSlips();
    }, []);

    // Fetch Backtest Insights, Patterns & Top Predictions
    useEffect(() => {
        const fetchAllInsights = async () => {
            try {
                const [insightsRes, weakRes, strongRes, predRes] = await Promise.all([
                    fetch(`${API}/api/backtest/insights?days=30`),
                    fetch(`${API}/api/backtest/patterns/weak?days=30`),
                    fetch(`${API}/api/backtest/patterns/strong?days=30`),
                    fetch(`${API}/api/ai/predictions`)
                ]);
                
                if (insightsRes.ok) {
                    const data = await insightsRes.json();
                    setBacktestData(data.insights);
                }
                if (weakRes.ok) {
                    const data = await weakRes.json();
                    setWeakPatterns(data.data);
                }
                if (strongRes.ok) {
                    const data = await strongRes.json();
                    setStrongPatterns(data.data);
                }
                if (predRes.ok) {
                    const data = await predRes.json();
                    setTopPredictions(data.predictions?.slice(0, 3) || []);
                }
            } catch (e) {
                console.error('Failed to fetch AI insights:', e);
            } finally {
                setBtLoading(false);
            }
        };
        fetchAllInsights();
    }, [API]);

    // Stats computed from slips & insights
    const totalSlips = slips.length;
    const wonSlips = slips.filter(s => s.status === 'won').length;
    const lostSlips = slips.filter(s => s.status === 'lost').length;
    const hitRate = totalSlips > 0 ? Math.round((wonSlips / Math.max(wonSlips + lostSlips, 1)) * 100) : 0;
    
    // Calculate a pseudo-confidence score for the portfolio
    const portfolioScore = backtestData?.global_accuracy 
        ? Math.round(backtestData.global_accuracy * 100) 
        : 72; // Default baseline if loading

    return (
        <div className="min-h-screen flex flex-col" style={{ background: 'var(--bg-primary)' }}>
            <DeadlineBanner />
            <Navbar />

            <main className="flex-grow max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full">
                {/* Page Header */}
                <div className="mb-8">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#00d4ff] to-[#8b5cf6] flex items-center justify-center">
                            <span className="text-xl">🤖</span>
                        </div>
                        <div>
                            <h1 className="text-2xl font-extrabold" style={{ color: 'var(--text-primary)' }}>
                                {t.pageTitle || 'AI 분석 대시보드'}
                            </h1>
                            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                                {user?.email?.split('@')[0] || 'Guest'}{t.pageSubtitle || '님의 개인 AI 데이터 분석 대시보드'}
                            </p>
                        </div>
                    </div>
                </div>

                {/* AI Performance Dashboard */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
                    {[
                        {
                            label: t.statConfidence || '포트폴리오 신뢰도',
                            value: `${portfolioScore}%`,
                            icon: '🛡️',
                            gradient: 'from-[#00d4ff]/20 to-[#00d4ff]/5',
                            border: 'border-[rgba(0,212,255,0.2)]',
                            color: '#00d4ff',
                        },
                        {
                            label: t.statHitRate || 'AI 정확도',
                            value: `${hitRate}%`,
                            icon: '📊',
                            gradient: 'from-[#4ade80]/20 to-[#4ade80]/5',
                            border: 'border-[rgba(74,222,128,0.2)]',
                            color: '#4ade80',
                        },
                        {
                            label: t.statCombos || '저장된 시뮬레이션',
                            value: totalSlips,
                            icon: '📋',
                            gradient: 'from-[#8b5cf6]/20 to-[#8b5cf6]/5',
                            border: 'border-[rgba(139,92,246,0.2)]',
                            color: '#8b5cf6',
                        },
                        {
                            label: t.statWonLost || '적중 / 미적중',
                            value: `${wonSlips} / ${lostSlips}`,
                            icon: '📈',
                            gradient: 'from-[#f59e0b]/20 to-[#f59e0b]/5',
                            border: 'border-[rgba(245,158,11,0.2)]',
                            color: '#f59e0b',
                        },
                    ].map((stat, i) => (
                        <div
                            key={i}
                            className={`relative overflow-hidden rounded-xl border ${stat.border} p-4 bg-gradient-to-br ${stat.gradient}`}
                            style={{ background: 'var(--bg-surface)' }}
                        >
                            <div className={`absolute inset-0 bg-gradient-to-br ${stat.gradient} opacity-50`}></div>
                            <div className="relative">
                                <div className="text-lg mb-1">{stat.icon}</div>
                                <div className="text-2xl font-black font-mono" style={{ color: stat.color }}>
                                    {stat.value}
                                </div>
                                <div className="text-[10px] mt-1 font-medium" style={{ color: 'var(--text-muted)' }}>
                                    {stat.label}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>

                {/* AI Portfolio Intelligence Dashboard */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
                    {/* 1. AI Accuracy Spotlight (Left Column) */}
                    <div className="lg:col-span-2 space-y-6">
                        <div className="rounded-2xl border border-[var(--border-default)] overflow-hidden" style={{ background: 'var(--bg-surface)' }}>
                            <div className="px-5 py-4 border-b border-[var(--border-subtle)] flex items-center justify-between" style={{ background: 'var(--bg-elevated)' }}>
                                <div className="flex items-center gap-3">
                                    <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#4ade80] to-[#22c55e] flex items-center justify-center shadow-lg">
                                        <span className="text-base">📈</span>
                                    </div>
                                    <div>
                                        <h2 className="text-sm font-bold text-white">{t.aiPerformanceCenter || 'AI 전략 성과 센터'}</h2>
                                        <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{t.realtimeValidation || '과거 데이터 8,900+ 경기 실시간 검증 결과'}</p>
                                    </div>
                                </div>
                                <div className="text-[10px] px-3 py-1 rounded-full border border-[rgba(74,222,128,0.2)] bg-[rgba(74,222,128,0.05)] text-[#4ade80]">
                                    Verified Insight
                                </div>
                            </div>
                            
                            <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                                {/* League Performance Chart (Simplified) */}
                                <div className="space-y-4">
                                    <h3 className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
                                        {t.topLeagues || '리그별 AI 적중 강점'}
                                    </h3>
                                    <div className="space-y-3">
                                        {backtestData?.league_performance ? Object.entries(backtestData.league_performance).slice(0, 4).map(([league, stats]: any, idx) => (
                                            <div key={idx} className="space-y-1.5">
                                                <div className="flex justify-between text-[11px]">
                                                    <span className="font-medium text-white">{league}</span>
                                                    <span className="font-bold text-[#4ade80]">{Math.round(stats.accuracy * 100)}%</span>
                                                </div>
                                                <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                                                    <div 
                                                        className="h-full bg-gradient-to-r from-[#4ade80] to-[#22c55e]" 
                                                        style={{ width: `${stats.accuracy * 100}%` }}
                                                    ></div>
                                                </div>
                                            </div>
                                        )) : (
                                            <div className="py-10 text-center animate-pulse text-[10px]" style={{ color: 'var(--text-muted)' }}>
                                                {t.loadingData || '데이터 분석 중...'}
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* AI Hot Trends */}
                                <div className="space-y-4">
                                    <h3 className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
                                        {t.aiHotTrends || '최근 데이터 트렌드'}
                                    </h3>
                                    <div className="grid grid-cols-1 gap-2">
                                        {strongPatterns?.max_streak > 0 && (
                                            <div className="p-3 rounded-xl border border-[var(--border-subtle)] bg-white/[0.02] flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-lg bg-[#f59e0b]/10 flex items-center justify-center text-[#f59e0b]">🔥</div>
                                                <div>
                                                    <div className="text-[11px] font-bold text-white">AI {strongPatterns.max_streak}연승 행진 기록</div>
                                                    <div className="text-[9px]" style={{ color: 'var(--text-muted)' }}>최근 고신뢰도 구간 데이터 패턴 일치</div>
                                                </div>
                                            </div>
                                        )}
                                        <div className="p-3 rounded-xl border border-[var(--border-subtle)] bg-white/[0.02] flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-lg bg-[#00d4ff]/10 flex items-center justify-center text-[#00d4ff]">🎯</div>
                                            <div>
                                                <div className="text-[11px] font-bold text-white">최고 적중 리그: {backtestData?.by_league?.[0]?.league || '데이터 분석 중'}</div>
                                                <div className="text-[9px]" style={{ color: 'var(--text-muted)' }}>최근 30일간 {backtestData?.by_league?.[0]?.accuracy_pct || 0}%의 기록적인 정확도</div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* 2. Risk & Recommendation (Right Column) */}
                    <div className="space-y-6">
                        {/* Risk Alert Card */}
                        <div className="rounded-2xl border border-[rgba(239,68,68,0.2)] overflow-hidden" style={{ background: 'linear-gradient(135deg, rgba(239,68,68,0.05), transparent)', backgroundColor: 'var(--bg-surface)' }}>
                            <div className="px-5 py-4 border-b border-[rgba(239,68,68,0.1)] flex items-center gap-3 bg-[rgba(239,68,68,0.03)]">
                                <span className="text-lg">⚠️</span>
                                <h2 className="text-sm font-bold text-[#f87171]">{t.riskAlert || '데이터 리스크 감지'}</h2>
                            </div>
                            <div className="p-5">
                                <p className="text-[11px] leading-relaxed mb-4" style={{ color: 'var(--text-secondary)' }}>
                                    {weakPatterns?.analysis_summary || t.riskDesc || '현재 시장 데이터에서 특이점 분석 중입니다.'}
                                </p>
                                <div className="space-y-2">
                                    {weakPatterns?.by_recommendation?.slice(0, 1).map((w: any, idx: number) => (
                                        <div key={idx} className="text-[10px] p-2.5 rounded-lg bg-[rgba(239,68,68,0.1)] border border-[rgba(239,68,68,0.2)] text-[#f87171] font-medium flex items-center gap-2">
                                            <span className="w-1.5 h-1.5 rounded-full bg-[#f87171]"></span>
                                            주의: {w.recommendation} 예측 구간 정확도 {w.accuracy_pct}%로 하락세
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* Strengthening Proposal */}
                        <div className="rounded-2xl border border-[var(--border-default)] overflow-hidden shadow-xl" style={{ background: 'var(--bg-surface)' }}>
                            <div className="px-5 py-4 border-b border-[var(--border-subtle)] flex items-center gap-3" style={{ background: 'var(--bg-elevated)' }}>
                                <span className="text-lg">💎</span>
                                <h2 className="text-sm font-bold text-white">{t.portfolioBoost || '포트폴리오 강화 제안'}</h2>
                            </div>
                            <div className="p-5">
                                <p className="text-[10px] mb-4" style={{ color: 'var(--text-muted)' }}>
                                    {t.boostDesc || 'AI가 선별한 오늘의 고신뢰도 추천 경기를 확인하고 포트폴리오를 강화하세요.'}
                                </p>
                                <div className="space-y-3 mb-5">
                                    {topPredictions.length > 0 ? topPredictions.map((pred, idx) => (
                                        <div key={idx} className="p-3 rounded-xl border border-[var(--border-subtle)] bg-white/[0.03] hover:border-[var(--accent-primary)] transition-all">
                                            <div className="flex justify-between items-center mb-1">
                                                <span className="text-[9px] font-bold text-[#8b5cf6] uppercase">{pred.league}</span>
                                                <span className="text-[10px] font-black text-[#4ade80]">{pred.confidence}%</span>
                                            </div>
                                            <div className="flex justify-between items-center">
                                                <div className="text-[11px] font-medium text-white truncate max-w-[120px]">
                                                    {pred.team_home_ko || pred.team_home} vs {pred.team_away_ko || pred.team_away}
                                                </div>
                                                <div className="text-[10px] px-2 py-0.5 rounded bg-[#8b5cf6]/10 text-[#8b5cf6] font-bold">
                                                    {pred.recommendation}
                                                </div>
                                            </div>
                                        </div>
                                    )) : (
                                        <div className="py-6 text-center text-[10px] opacity-30 italic">경기 분석 데이터 로딩 중...</div>
                                    )}
                                </div>
                                <button 
                                    onClick={() => router.push(`/${currentLang}/analysis`)}
                                    className="w-full py-3 rounded-xl text-xs font-bold text-white transition-all hover:scale-[1.02] active:scale-[0.98] shadow-lg shadow-[#8b5cf6]/20"
                                    style={{ background: 'linear-gradient(135deg, #00d4ff, #8b5cf6)' }}
                                >
                                    {t.viewHighValue || '전체 고가치 분석 보기 →'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Analysis History & Saved Slips */}
                <div className="rounded-2xl border border-[var(--border-default)] overflow-hidden" style={{ background: 'var(--bg-surface)' }}>
                    <button
                        onClick={() => setShowSlips(!showSlips)}
                        className="w-full px-5 py-4 flex items-center justify-between hover:bg-white/[0.02] transition-colors"
                        style={{ background: 'var(--bg-elevated)' }}
                    >
                        <div className="flex items-center gap-3">
                            <span className="text-lg">📋</span>
                            <span className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>
                                {t.savedCombosTitle || '저장된 시뮬레이션 및 분석 기록'}
                            </span>
                            <span className="text-[10px] px-2 py-0.5 rounded-full font-bold"
                                style={{ background: 'rgba(0,212,255,0.1)', color: 'var(--accent-primary)' }}>
                                {totalSlips} {t.items || 'items'}
                            </span>
                        </div>
                        <svg
                            className={`w-4 h-4 transition-transform ${showSlips ? 'rotate-180' : ''}`}
                            style={{ color: 'var(--text-muted)' }}
                            fill="none" viewBox="0 0 24 24" stroke="currentColor"
                        >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                    </button>

                    {showSlips && (
                        <div className="p-5 border-t border-[var(--border-subtle)]">
                            {slipsLoading ? (
                                <div className="py-8 text-center" style={{ color: 'var(--text-muted)' }}>
                                    <div className="animate-spin inline-block w-6 h-6 border-2 border-white/10 border-t-[var(--accent-primary)] rounded-full mb-2"></div>
                                    <p className="text-xs">{t.loading || 'Loading...'}</p>
                                </div>
                            ) : slips.length === 0 ? (
                                <div className="text-center py-8">
                                    <div className="text-3xl mb-2 opacity-30">📊</div>
                                    <p className="text-xs mb-3" style={{ color: 'var(--text-muted)' }}>{t.noCombos || 'No saved combos yet.'}</p>
                                    <a href={`/${currentLang}/bets`} className="btn-primary text-xs px-4 py-2 inline-block rounded-lg">
                                        {t.goToAnalysis || '데이터 분석 바로가기 →'}
                                    </a>
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    {slips.map((slip) => (
                                        <div key={slip.id} className="rounded-xl border border-[var(--border-subtle)] overflow-hidden hover:border-[rgba(0,212,255,0.2)] transition-all">
                                            <div className="px-4 py-2.5 flex justify-between items-center" style={{ background: 'var(--bg-elevated)' }}>
                                                <div className="text-xs font-bold" style={{ color: 'var(--text-primary)' }}>
                                                    {t.combo || 'Combo'} #{slip.id}
                                                    <span className="font-normal ml-2" style={{ color: 'var(--text-muted)' }}>
                                                        {new Date(slip.created_at).toLocaleDateString()}
                                                    </span>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <span className="text-xs font-bold font-mono gradient-text">{slip.total_odds.toFixed(2)}x</span>
                                                    <span className={`text-[10px] px-2 py-0.5 rounded-md font-bold ${slip.status === 'active' ? 'bg-[rgba(0,212,255,0.1)] text-[var(--accent-primary)]' :
                                                        slip.status === 'won' ? 'bg-[rgba(34,197,94,0.15)] text-[#4ade80]' :
                                                            slip.status === 'lost' ? 'bg-[rgba(239,68,68,0.15)] text-[#f87171]' :
                                                                'bg-white/5 text-[var(--text-muted)]'
                                                        }`}>
                                                        {slip.status === 'active' ? (t.statusActive || '진행중') : slip.status === 'won' ? (t.statusWon || '적중') : slip.status === 'lost' ? (t.statusLost || '미적중') : slip.status}
                                                    </span>
                                                </div>
                                            </div>
                                            <div className="px-4 py-2 space-y-1">
                                                {slip.items.map((item, idx) => (
                                                    <div key={idx} className="flex justify-between items-center text-xs py-1">
                                                        <div>
                                                            <span className="font-medium mr-1.5" style={{ color: 'var(--accent-primary)' }}>
                                                                [{item.selection === 'Home' ? 'W' : item.selection === 'Away' ? 'L' : 'D'}]
                                                            </span>
                                                            <span style={{ color: 'var(--text-secondary)' }}>{item.match_name}</span>
                                                        </div>
                                                        <span className="font-bold font-mono" style={{ color: 'var(--text-primary)' }}>{item.odds.toFixed(2)}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Not logged in CTA */}
                {!user && (
                    <div className="mt-8 glass-card text-center py-8 border-dashed">
                        <div className="text-3xl mb-3">🔐</div>
                        <p className="text-sm mb-1 font-bold" style={{ color: 'var(--text-primary)' }}>
                            {t.loginCta || 'Sign in and start AI analysis'}
                        </p>
                        <p className="text-xs mb-4" style={{ color: 'var(--text-muted)' }}>
                            {t.loginCtaDesc || 'Your personalized portfolio and AI analysis records will be saved'}
                        </p>
                        <a href={`/${currentLang}/login`}
                            className="inline-block px-6 py-2.5 rounded-xl text-sm font-bold text-white"
                            style={{ background: 'linear-gradient(135deg, #00d4ff, #8b5cf6)' }}
                        >
                            {t.loginCtaBtn || 'Sign In / Sign Up →'}
                        </a>
                    </div>
                )}
            </main>
        </div>
    );
}
