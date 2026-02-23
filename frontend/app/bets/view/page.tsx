"use client";

import React, { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';

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
    const idParam = searchParams.get('id');

    const [bet, setBet] = useState<BetData | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchDetail = async () => {
            if (!idParam) return;

            try {
                const res = await fetch('/api/bets');
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
                <p>분석 데이터를 불러오는 중입니다...</p>
            </div>
        </div>
    );
    if (!bet) return (
        <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg-primary)', color: 'var(--text-muted)' }}>
            해당 경기 분석을 찾을 수 없습니다.
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
                    <Link href="/" className="flex items-center text-sm font-medium transition-all" style={{ color: 'var(--text-muted)' }}>
                        ← 목록으로 돌아가기
                    </Link>
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
                        📊 AI 가치 분석 리포트
                    </h2>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

                        {/* Comparison Visual */}
                        <div className="p-4 rounded-xl" style={{ background: 'var(--bg-elevated)' }}>
                            <h3 className="text-sm font-bold mb-3" style={{ color: 'var(--text-secondary)' }}>배당률 비교 (Price Efficiency)</h3>
                            <div className="space-y-3">
                                <div className="flex justify-between items-center">
                                    <div className="text-xs" style={{ color: 'var(--text-muted)' }}>해외 (Pinnacle) True Odds</div>
                                    <div className="font-mono" style={{ color: 'var(--text-secondary)' }}>{(1 / bet.true_probability).toFixed(2)}</div>
                                </div>
                                <div className="flex justify-between items-center">
                                    <div className="text-xs font-bold" style={{ color: 'var(--accent-primary)' }}>국내 (Betman) Actual Odds</div>
                                    <div className="font-mono font-bold text-lg" style={{ color: 'var(--accent-primary)' }}>{bet.domestic_odds}</div>
                                </div>
                                <div className="w-full rounded-full h-2 mt-2" style={{ background: 'rgba(0,212,255,0.1)' }}>
                                    <div className="h-2 rounded-full" style={{ width: '100%', background: 'linear-gradient(90deg, var(--accent-primary), var(--accent-secondary))' }}></div>
                                </div>
                                <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                                    * 배트맨 배당이 해외 기준 적정 배당보다 <strong style={{ color: 'var(--accent-primary)' }}>{((bet.domestic_odds - (1 / bet.true_probability)) / (1 / bet.true_probability) * 100).toFixed(1)}%</strong> 더 높습니다.
                                </p>
                            </div>
                        </div>

                        {/* Key Metrics */}
                        <div className="space-y-4">
                            <div>
                                <div className="text-sm mb-1" style={{ color: 'var(--text-muted)' }}>AI 승리 확률 예측</div>
                                <div className="text-3xl font-black gradient-text">{winProb}%</div>
                            </div>
                            <div>
                                <div className="text-sm mb-1" style={{ color: 'var(--text-muted)' }}>기대 수익률 (ROI)</div>
                                <div className={`text-2xl font-black`} style={{ color: bet.expected_value >= 1.05 ? 'var(--accent-primary)' : 'var(--text-secondary)' }}>
                                    +{evPercent}%
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Recommendation Card */}
                <div className="glass-card p-6" style={{ borderColor: 'rgba(0,212,255,0.2)', background: 'rgba(0,212,255,0.03)' }}>
                    <h2 className="text-lg font-bold mb-4" style={{ color: 'var(--accent-primary)' }}>💡 투자 가이드 (Money Management)</h2>
                    <div className="flex items-start space-x-4">
                        <div className="text-4xl">💰</div>
                        <div>
                            <h3 className="font-bold text-lg" style={{ color: 'var(--text-primary)' }}>
                                추천: {bet.bet_type === 'Home' ? '홈승' : bet.bet_type === 'Draw' ? '무승부' : '원정승'} 베팅
                            </h3>
                            <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
                                이 기회는 수학적으로 <strong style={{ color: 'var(--accent-primary)' }}>{evPercent}%</strong>의 장기 수익이 기대됩니다.
                                자산의 안정을 위해 <strong className="text-white">켈리 기준(Kelly Criterion)</strong>에 따라
                                보유 자금의 <strong style={{ color: 'var(--accent-primary)' }}>{kellyStake}%</strong> 만 투자하는 것을 권장합니다.
                            </p>
                            {bet.max_tax_free_stake && (
                                <div className="mt-3 p-3 rounded-xl text-xs" style={{ background: 'rgba(139,92,246,0.08)', border: '1px solid rgba(139,92,246,0.15)', color: 'var(--accent-secondary)' }}>
                                    🛑 비과세 한도: {bet.max_tax_free_stake.toLocaleString()}원 이하 베팅 권장
                                </div>
                            )}
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
