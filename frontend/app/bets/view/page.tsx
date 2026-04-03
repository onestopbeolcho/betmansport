"use client";

import React, { useEffect, useState, Suspense } from 'react';
import { useSearchParams, usePathname } from 'next/navigation';
import { i18n } from '../../lib/i18n-config';

interface BetData {
    id?: number;
    match_name: string;
    bet_type: string;
    domestic_odds: number;
    pinnacle_odds: number;
    true_probability: number;
    expected_value: number;
    kelly_pct: number;
    max_tax_free_stake?: number;
    timestamp: string;
}

function BetDetailContent() {
    const searchParams = useSearchParams();
    const pathname = usePathname();
    const idParam = searchParams.get('id');
    const sortedLocales = [...i18n.locales].sort((a, b) => b.length - a.length);
    const currentLang = sortedLocales.find((l) => pathname.startsWith(`/${l}/`) || pathname === `/${l}`) || i18n.defaultLocale;

    const [bet, setBet] = useState<BetData | null>(null);
    const [loading, setLoading] = useState(true);
    const API = process.env.NEXT_PUBLIC_API_URL || '';

    useEffect(() => {
        const fetchDetail = async () => {
            if (!idParam) return;

            try {
                const res = await fetch(`${API}/api/bets`);
                if (!res.ok) throw new Error('Fetch failed');
                const data: BetData[] = await res.json();

                const index = Number(idParam);
                if (data[index]) {
                    setBet(data[index]);
                } else {
                    const found = data.find(b => b.id === Number(idParam));
                    if (found) setBet(found);
                }
            } catch (e) {
                console.error(e);
            } finally {
                setLoading(false);
            }
        };

        if (idParam) {
            fetchDetail();
        }
    }, [idParam]);

    if (loading) return (
        <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg-primary)', color: 'var(--text-muted)' }}>
            <div className="text-center">
                <div className="animate-spin inline-block w-8 h-8 border-2 border-white/10 border-t-[var(--accent-primary)] rounded-full mb-3"></div>
                <p>분석 데이터 로딩 중...</p>
            </div>
        </div>
    );
    if (!bet) return (
        <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg-primary)', color: 'var(--text-muted)' }}>
            경기 분석 데이터를 찾을 수 없습니다.
        </div>
    );

    const evPercent = ((bet.expected_value - 1) * 100).toFixed(1);
    const winProb = (bet.true_probability * 100).toFixed(1);
    const kellyStake = (bet.kelly_pct * 100).toFixed(1);

    return (
        <div className="min-h-screen font-sans" style={{ background: 'var(--bg-primary)' }}>
            {/* Navbar */}
            <div className="sticky top-0 z-10 border-b border-[var(--border-subtle)]" style={{ background: 'var(--bg-surface)' }}>
                <div className="max-w-3xl mx-auto px-4 h-14 flex items-center">
                    <a href={`/${currentLang}/bets`} className="flex items-center text-sm font-medium transition-all" style={{ color: 'var(--text-muted)' }}>
                        ← 목록으로
                    </a>
                    <div className="ml-auto font-black gradient-text">Scorenix</div>
                </div>
            </div>

            <div className="max-w-3xl mx-auto px-4 py-8">

                {/* Match Header */}
                <div className="glass-card p-6 mb-6">
                    <div className="flex justify-between items-center mb-4">
                        <span className="text-xs font-bold px-2 py-1 rounded-lg" style={{ background: 'rgba(0,212,255,0.1)', color: 'var(--accent-primary)' }}>축구</span>
                        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{new Date(bet.timestamp).toLocaleString()}</span>
                    </div>
                    <h1 className="text-2xl font-bold text-center mb-2" style={{ color: 'var(--text-primary)' }}>{bet.match_name}</h1>
                    <div className="flex justify-center items-center space-x-8 mt-4">
                        <div className="text-center">
                            <div className="text-sm" style={{ color: 'var(--text-muted)' }}>홈 (HOME)</div>
                            <div className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>
                                {bet.match_name.split('vs')[0]}
                            </div>
                        </div>
                        <div className="font-light" style={{ color: 'var(--text-muted)' }}>VS</div>
                        <div className="text-center">
                            <div className="text-sm" style={{ color: 'var(--text-muted)' }}>원정 (AWAY)</div>
                            <div className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>
                                {bet.match_name.split('vs')[1]}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Core Analysis Card */}
                <div className="glass-card p-6 mb-6">
                    <h2 className="text-lg font-bold mb-4 flex items-center" style={{ color: 'var(--text-primary)' }}>
                        📊 AI 밸류 분석 리포트
                    </h2>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

                        {/* Comparison Visual */}
                        <div className="p-4 rounded-xl" style={{ background: 'var(--bg-elevated)' }}>
                            <h3 className="text-sm font-bold mb-3" style={{ color: 'var(--text-secondary)' }}>데이터 비교 (가격 효율)</h3>
                            <div className="space-y-3">
                                <div className="flex justify-between items-center">
                                    <div className="text-xs" style={{ color: 'var(--text-muted)' }}>해외 글로벌 데이터</div>
                                    <div className="font-mono" style={{ color: 'var(--text-secondary)' }}>{(1 / bet.true_probability).toFixed(2)}</div>
                                </div>
                                <div className="flex justify-between items-center">
                                    <div className="text-xs font-bold" style={{ color: 'var(--accent-primary)' }}>국내 데이터 지표</div>
                                    <div className="font-mono font-bold text-lg" style={{ color: 'var(--accent-primary)' }}>{bet.domestic_odds}</div>
                                </div>
                                <div className="w-full rounded-full h-2 mt-2" style={{ background: 'rgba(0,212,255,0.1)' }}>
                                    <div className="h-2 rounded-full" style={{ width: '100%', background: 'linear-gradient(90deg, var(--accent-primary), var(--accent-secondary))' }}></div>
                                </div>
                                <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                                    * 국내 데이터가 해외 기준 대비 <strong style={{ color: 'var(--accent-primary)' }}>{((bet.domestic_odds - (1 / bet.true_probability)) / (1 / bet.true_probability) * 100).toFixed(1)}%</strong> 높습니다.
                                </p>
                            </div>
                        </div>

                        {/* Key Metrics */}
                        <div className="space-y-4">
                            <div>
                                <div className="text-sm mb-1" style={{ color: 'var(--text-muted)' }}>AI 승리 확률</div>
                                <div className="text-3xl font-black gradient-text">{winProb}%</div>
                            </div>
                            <div>
                                <div className="text-sm mb-1" style={{ color: 'var(--text-muted)' }}>기대값 (EV)</div>
                                <div className={`text-2xl font-black`} style={{ color: bet.expected_value >= 1.05 ? 'var(--accent-primary)' : 'var(--text-secondary)' }}>
                                    +{evPercent}%
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Recommendation Card */}
                <div className="glass-card p-6" style={{ borderColor: 'rgba(0,212,255,0.2)', background: 'rgba(0,212,255,0.03)' }}>
                    <h2 className="text-lg font-bold mb-4" style={{ color: 'var(--accent-primary)' }}>💡 분석 가이드</h2>
                    <div className="flex items-start space-x-4">
                        <div className="text-4xl">📊</div>
                        <div>
                            <h3 className="font-bold text-lg" style={{ color: 'var(--text-primary)' }}>
                                AI 분석: {bet.bet_type === 'Home' ? '홈 승' : bet.bet_type === 'Draw' ? '무승부' : '원정 승'}
                            </h3>
                            <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
                                이 경기는 수학적 기대값이 <strong style={{ color: 'var(--accent-primary)' }}>{evPercent}%</strong>입니다.
                                <strong className="text-white">Kelly 기준</strong>으로
                                최적 배분 비율은 <strong style={{ color: 'var(--accent-primary)' }}>{kellyStake}%</strong>입니다.
                            </p>
                        </div>
                    </div>
                </div>

            </div>
        </div>
    );
}

export default function BetDetail() {
    return (
        <Suspense fallback={
            <div className="min-h-screen flex justify-center items-center" style={{ background: 'var(--bg-primary)', color: 'var(--text-muted)' }}>
                <div className="animate-spin inline-block w-8 h-8 border-2 border-white/10 border-t-[var(--accent-primary)] rounded-full"></div>
            </div>
        }>
            <BetDetailContent />
        </Suspense>
    );
}
