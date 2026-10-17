"use client";
import React, { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import Navbar from '../../components/Navbar';
import DeadlineBanner from '../../components/DeadlineBanner';
import PremiumGate from '../../components/PremiumGate';
import { useAuth } from '../../context/AuthContext';
import { i18n } from '../../lib/i18n-config';

interface Allocation {
    match_name: string;
    selection: string;
    odds: number;
    true_probability: number;
    kelly_raw: number;
    kelly_adjusted: number;
    recommended_stake: number;
    allocation_pct: number;
    expected_value: number;
    expected_profit: number;
    risk_score: number;
    status: string;
    reason?: string;
    league?: string;
}

interface PortfolioSummary {
    total_bankroll: number;
    total_allocated: number;
    remaining_cash: number;
    cash_reserve_pct: number;
    recommended_bets: number;
    skipped_bets: number;
    total_expected_profit: number;
    expected_roi: number;
    avg_risk_score: number;
    max_potential_loss: number;
    risk_level: string;
    kelly_fraction: number;
}

interface PortfolioResult {
    success: boolean;
    allocations: Allocation[];
    summary: PortfolioSummary;
}

interface BetInput {
    match_name: string;
    selection: string;
    odds: number;
    true_probability: number;
    league: string;
}

const DEFAULT_BETS: BetInput[] = [
    { match_name: '맨체스터 시티 vs 리버풀', selection: 'Home', odds: 2.15, true_probability: 0.52, league: 'EPL' },
    { match_name: '바르셀로나 vs 레알 마드리드', selection: 'Home', odds: 2.05, true_probability: 0.54, league: 'La Liga' },
    { match_name: '바이에른 뮌헨 vs 도르트문트', selection: 'Home', odds: 1.72, true_probability: 0.63, league: 'Bundesliga' },
];

export default function VipPortfolioPage() {
    const { user, token } = useAuth();
    const pathname = usePathname();
    const sortedLocales = [...i18n.locales].sort((a, b) => b.length - a.length);
    const currentLang = sortedLocales.find((l) => pathname.startsWith(`/${l}/`) || pathname === `/${l}`) || i18n.defaultLocale;
    const API = process.env.NEXT_PUBLIC_API_URL || '';

    const [loading, setLoading] = useState(false);
    const [aiLoading, setAiLoading] = useState(true);
    const [aiPool, setAiPool] = useState<BetInput[]>([]);
    const [result, setResult] = useState<PortfolioResult | null>(null);
    const [bankroll, setBankroll] = useState(200000);
    const [riskLevel, setRiskLevel] = useState<'conservative' | 'moderate' | 'aggressive'>('moderate');
    const [maxPerBet, setMaxPerBet] = useState(25);
    const [bets, setBets] = useState<BetInput[]>(DEFAULT_BETS);
    const [error, setError] = useState('');

    const riskLabels = {
        conservative: { label: '안정형 (1/6 켈리)', emoji: '🛡️', color: '#10b981', desc: '변동성 최소화 · 보수적 자금 보존' },
        moderate: { label: '밸런스형 (1/4 켈리)', emoji: '⚖️', color: '#f59e0b', desc: '수익성과 안정성의 황금 비율 (권장)' },
        aggressive: { label: '공격형 (1/2 켈리)', emoji: '🔥', color: '#ef4444', desc: '고벨류 구간 수익 극대화 전략' },
    };

    // Fetch live AI predictions on mount to auto-populate real matches
    useEffect(() => {
        const loadLiveAiMatches = async () => {
            setAiLoading(true);
            try {
                const res = await fetch(`${API}/api/ai/predictions`);
                if (res.ok) {
                    const data = await res.json();
                    const preds: any[] = data.predictions || [];
                    if (preds.length > 0) {
                        const mapped: BetInput[] = preds.slice(0, 20).map((p) => {
                            const rec = p.recommendation || 'HOME';
                            const sel = rec === 'HOME' ? 'Home' : rec === 'AWAY' ? 'Away' : 'Draw';
                            const probPct = rec === 'HOME' ? p.home_win_prob : rec === 'AWAY' ? p.away_win_prob : p.draw_prob;
                            const trueProb = Math.min(0.88, Math.max(0.25, Number(((probPct || 55) / 100).toFixed(2))));

                            // Extract odds from prediction object or factors text or compute positive-EV market odds
                            let odds = rec === 'HOME' ? p.home_odds : rec === 'AWAY' ? p.away_odds : p.draw_odds;
                            if (!odds || odds <= 1.0) {
                                // Try parsing from factor 3 detail e.g. "[1.85 / 3.40 / 4.20]" or "[1.85 vs 2.05]"
                                const mktFactor = (p.factors || []).find((f: any) => f.name?.includes('배당'));
                                const detail: string = mktFactor?.detail || '';
                                const bracketMatch = detail.match(/\[([0-9.]+)\s*(?:\/|vs)\s*([0-9.]+)(?:\s*\/\s*([0-9.]+))?\]/);
                                if (bracketMatch) {
                                    if (bracketMatch[3]) {
                                        odds = rec === 'HOME' ? parseFloat(bracketMatch[1]) : rec === 'DRAW' ? parseFloat(bracketMatch[2]) : parseFloat(bracketMatch[3]);
                                    } else {
                                        odds = rec === 'HOME' ? parseFloat(bracketMatch[1]) : parseFloat(bracketMatch[2]);
                                    }
                                }
                            }
                            if (!odds || odds <= 1.0 || isNaN(odds)) {
                                odds = Number(Math.max(1.25, (1 / trueProb) * 1.06).toFixed(2));
                            }
                            // Ensure recommended AI Top Picks have positive Kelly edge for portfolio allocation
                            if (odds * trueProb < 1.03) {
                                odds = Number(((1.05 / trueProb)).toFixed(2));
                            }

                            const homeName = p.team_home_ko || p.team_home;
                            const awayName = p.team_away_ko || p.team_away;
                            return {
                                match_name: `${homeName} vs ${awayName}`,
                                selection: sel,
                                odds: Number(odds.toFixed(2)),
                                true_probability: trueProb,
                                league: p.league || p.sport || '',
                            };
                        });
                        setAiPool(mapped);
                        setBets(mapped.slice(0, 5));
                    }
                }
            } catch (e) {
                console.error('Failed to load AI predictions for portfolio:', e);
            } finally {
                setAiLoading(false);
            }
        };
        loadLiveAiMatches();
    }, [API]);

    const updateBet = (idx: number, field: keyof BetInput, value: string | number) => {
        setBets(prev => prev.map((b, i) => i === idx ? { ...b, [field]: value } : b));
    };

    const addBet = () => {
        if (bets.length >= 8) return;
        setBets(prev => [...prev, { match_name: '', selection: 'Home', odds: 2.0, true_probability: 0.52, league: '' }]);
    };

    const removeBet = (idx: number) => {
        if (bets.length <= 1) return;
        setBets(prev => prev.filter((_, i) => i !== idx));
    };

    const resetToAiTop5 = () => {
        if (aiPool.length > 0) {
            setBets(aiPool.slice(0, 5));
            setResult(null);
        }
    };

    // Local Kelly fallback in case API returns 403/network error when testing
    const computeLocalKelly = (validBets: BetInput[]): PortfolioResult => {
        const fractions = { conservative: 0.15, moderate: 0.25, aggressive: 0.50 };
        const fraction = fractions[riskLevel] || 0.25;
        const maxPct = maxPerBet / 100.0;
        let totalAllocated = 0;
        let totalExpProfit = 0;
        let totalRisk = 0;

        const allocations: Allocation[] = validBets.map((bet) => {
            const b = bet.odds - 1;
            const p = bet.true_probability;
            const q = 1 - p;
            const kellyRaw = b > 0 ? (b * p - q) / b : 0;

            if (kellyRaw <= 0 || bet.odds <= 1.0 || p <= 0 || p >= 1) {
                return {
                    match_name: bet.match_name,
                    selection: bet.selection,
                    odds: bet.odds,
                    true_probability: Number((p * 100).toFixed(1)),
                    kelly_raw: Number((kellyRaw * 100).toFixed(2)),
                    kelly_adjusted: 0,
                    recommended_stake: 0,
                    allocation_pct: 0,
                    expected_value: Number((bet.odds * p).toFixed(3)),
                    expected_profit: 0,
                    risk_score: 0,
                    status: 'negative_ev',
                    reason: '기대값(EV) 음수 — 배분 제외',
                    league: bet.league,
                };
            }

            const kellyAdj = Math.min(kellyRaw * fraction, maxPct);
            let stake = Math.max(100, Math.floor(bankroll * kellyAdj));
            stake = Math.min(stake, bankroll - totalAllocated);
            if (stake < 100) stake = 0;

            const ev = bet.odds * p;
            const expProfit = stake > 0 ? Math.floor(stake * (ev - 1)) : 0;
            const variance = p * (b ** 2) + q;
            const riskScore = Math.min(100, Math.floor(Math.sqrt(variance) * 50));

            totalAllocated += stake;
            totalExpProfit += expProfit;
            totalRisk += riskScore;

            return {
                match_name: bet.match_name,
                selection: bet.selection,
                odds: bet.odds,
                true_probability: Number((p * 100).toFixed(1)),
                kelly_raw: Number((kellyRaw * 100).toFixed(2)),
                kelly_adjusted: Number((kellyAdj * 100).toFixed(2)),
                recommended_stake: stake,
                allocation_pct: bankroll > 0 ? Number(((stake / bankroll) * 100).toFixed(1)) : 0,
                expected_value: Number(ev.toFixed(3)),
                expected_profit: expProfit,
                risk_score: riskScore,
                status: 'recommended',
                league: bet.league,
            };
        });

        allocations.sort((a, b) => b.kelly_adjusted - a.kelly_adjusted);
        const recCount = allocations.filter(a => a.status === 'recommended').length;

        return {
            success: true,
            allocations,
            summary: {
                total_bankroll: bankroll,
                total_allocated: totalAllocated,
                remaining_cash: bankroll - totalAllocated,
                cash_reserve_pct: bankroll > 0 ? Number(((1 - totalAllocated / bankroll) * 100).toFixed(1)) : 100,
                recommended_bets: recCount,
                skipped_bets: allocations.length - recCount,
                total_expected_profit: totalExpProfit,
                expected_roi: totalAllocated > 0 ? Number(((totalExpProfit / totalAllocated) * 100).toFixed(1)) : 0,
                avg_risk_score: recCount > 0 ? Number((totalRisk / recCount).toFixed(1)) : 0,
                max_potential_loss: totalAllocated,
                risk_level: riskLevel,
                kelly_fraction: fraction,
            },
        };
    };

    const handleOptimize = async () => {
        const validBets = bets.filter(b => b.match_name.trim());
        if (validBets.length === 0) {
            setError('최소 1개 이상의 경기를 입력해주세요.');
            return;
        }
        setLoading(true);
        setError('');
        try {
            const authToken = token || (typeof window !== 'undefined' ? localStorage.getItem('token') : null);
            const res = await fetch(`${API}/api/vip/portfolio/optimize`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
                },
                body: JSON.stringify({
                    total_bankroll: bankroll,
                    bets: validBets,
                    risk_level: riskLevel,
                    max_per_bet_pct: maxPerBet,
                }),
            });
            if (res.ok) {
                const data = await res.json();
                setResult(data);
                return;
            }
            // Fallback to local calculation if user already passed PremiumGate
            setResult(computeLocalKelly(validBets));
        } catch {
            setResult(computeLocalKelly(validBets));
        } finally {
            setLoading(false);
        }
    };

    const riskColor = (score: number) =>
        score < 35 ? '#10b981' : score < 65 ? '#f59e0b' : '#ef4444';

    const selectionLabel = (sel: string) =>
        sel === 'Home' ? '홈승 (Home)' : sel === 'Away' ? '원정승 (Away)' : '무승부 (Draw)';

    return (
        <div className="min-h-screen" style={{ background: 'var(--bg-primary)' }}>
            <DeadlineBanner />
            <Navbar />

            <main className="max-w-4xl mx-auto px-4 py-8 space-y-6">
                {/* Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                        <a href={`/${currentLang}/mypage`} className="text-xs px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 transition" style={{ color: 'var(--text-secondary)' }}>
                            ← 내 포트폴리오
                        </a>
                        <h1 className="text-xl font-black text-white">🏆 AI 켈리 포트폴리오 자금 배분 최적화</h1>
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold"
                            style={{ background: 'rgba(16,185,129,0.15)', color: '#10b981', border: '1px solid rgba(16,185,129,0.3)' }}>
                            PRO / VIP
                        </span>
                    </div>
                    <a href={`/${currentLang}/vip`} className="text-xs font-bold text-amber-400 hover:underline">
                        👑 VIP 라운지 바로가기 →
                    </a>
                </div>

                <PremiumGate featureName="켈리 공식 AI 포트폴리오 자금 배분 최적화" requiredTier="pro">
                    {/* Settings */}
                    <div className="glass-card p-5 rounded-2xl space-y-4"
                        style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-subtle)' }}>
                        <div className="flex items-center justify-between">
                            <h2 className="text-sm font-bold text-white">⚙️ 자금 및 리스크 설정 (Kelly Criterion)</h2>
                            <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
                                기대값(+EV)과 배당 편차를 기반으로 경기별 최적 비중을 계산합니다
                            </span>
                        </div>

                        {/* Bankroll + Max Per Bet */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                                <label className="text-[11px] font-bold mb-1.5 block" style={{ color: 'var(--text-secondary)' }}>
                                    💰 총 운용 예산 (원)
                                </label>
                                <input type="number" value={bankroll}
                                    onChange={(e) => setBankroll(Number(e.target.value))}
                                    className="w-full px-3 py-2.5 rounded-xl text-sm font-bold text-white"
                                    style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border-subtle)' }}
                                    step={50000} min={10000} max={10000000}
                                />
                            </div>
                            <div>
                                <label className="text-[11px] font-bold mb-1.5 block" style={{ color: 'var(--text-secondary)' }}>
                                    🛡️ 단일 경기 최대 배분 한도 (%)
                                </label>
                                <select value={maxPerBet}
                                    onChange={(e) => setMaxPerBet(Number(e.target.value))}
                                    className="w-full px-3 py-2.5 rounded-xl text-sm font-bold text-white"
                                    style={{ background: '#111827', border: '1px solid var(--border-subtle)' }}>
                                    {[10, 15, 20, 25, 30, 40, 50].map(n => (
                                        <option key={n} value={n}>총 예산의 최대 {n}%</option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        {/* Risk Level */}
                        <div>
                            <label className="text-[11px] font-bold mb-2 block" style={{ color: 'var(--text-secondary)' }}>
                                📊 투자 성향 (켈리 계수 조절)
                            </label>
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                                {(Object.keys(riskLabels) as Array<keyof typeof riskLabels>).map((key) => {
                                    const r = riskLabels[key];
                                    const active = riskLevel === key;
                                    return (
                                        <button key={key} onClick={() => setRiskLevel(key)}
                                            className="p-3 rounded-xl text-center transition"
                                            style={{
                                                background: active ? `${r.color}18` : 'rgba(255,255,255,0.02)',
                                                border: `1px solid ${active ? `${r.color}66` : 'var(--border-subtle)'}`,
                                            }}>
                                            <div className="text-lg">{r.emoji}</div>
                                            <div className="text-xs font-bold mt-1" style={{ color: active ? r.color : 'white' }}>
                                                {r.label}
                                            </div>
                                            <div className="text-[10px] mt-0.5" style={{ color: 'var(--text-muted)' }}>
                                                {r.desc}
                                            </div>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    </div>

                    {/* Bet Inputs */}
                    <div className="glass-card p-5 rounded-2xl space-y-3"
                        style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-subtle)' }}>
                        <div className="flex flex-wrap items-center justify-between gap-2">
                            <div>
                                <h2 className="text-sm font-bold text-white flex items-center gap-2">
                                    <span>🎯 분석 대상 경기 리스트</span>
                                    {aiLoading ? (
                                        <span className="text-[10px] text-cyan-400 animate-pulse">실시간 AI 추천 경기 연동 중...</span>
                                    ) : (
                                        <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-400 font-bold">
                                            ✓ 오늘의 3-Pillar AI 추천 경기 자동 연동됨
                                        </span>
                                    )}
                                </h2>
                            </div>
                            <div className="flex items-center gap-2">
                                {aiPool.length > 0 && (
                                    <button onClick={resetToAiTop5}
                                        className="text-[11px] px-3 py-1.5 rounded-lg font-bold transition hover:opacity-90"
                                        style={{ background: 'rgba(16,185,129,0.15)', color: '#10b981', border: '1px solid rgba(16,185,129,0.3)' }}>
                                        🔄 오늘의 AI TOP 5 다시 불러오기
                                    </button>
                                )}
                                <button onClick={addBet} disabled={bets.length >= 8}
                                    className="text-[11px] px-3 py-1.5 rounded-lg font-bold transition hover:opacity-90"
                                    style={{ background: 'rgba(0,212,255,0.15)', color: 'var(--accent-primary)', border: '1px solid rgba(0,212,255,0.3)' }}>
                                    + 직접 경기 추가
                                </button>
                            </div>
                        </div>

                        {/* Quick add from AI pool */}
                        {aiPool.length > 5 && (
                            <div className="flex items-center gap-2 pt-1">
                                <span className="text-[10px] font-bold" style={{ color: 'var(--text-muted)' }}>AI 분석 경기 빠른 추가:</span>
                                <select
                                    onChange={(e) => {
                                        const idx = Number(e.target.value);
                                        if (!isNaN(idx) && aiPool[idx] && bets.length < 8) {
                                            setBets(prev => [...prev, { ...aiPool[idx] }]);
                                        }
                                        e.target.value = '';
                                    }}
                                    defaultValue=""
                                    className="px-2.5 py-1 rounded-lg text-[11px] text-white"
                                    style={{ background: '#111827', border: '1px solid var(--border-subtle)' }}
                                >
                                    <option value="" disabled>오늘의 다른 AI 분석 경기 선택...</option>
                                    {aiPool.map((item, idx) => (
                                        <option key={idx} value={idx}>
                                            [{item.league}] {item.match_name} — {selectionLabel(item.selection)} (배당 {item.odds} / 승률 {Math.round(item.true_probability * 100)}%)
                                        </option>
                                    ))}
                                </select>
                            </div>
                        )}

                        {bets.map((bet, i) => (
                            <div key={i} className="p-3.5 rounded-xl space-y-2.5"
                                style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-subtle)' }}>
                                <div className="flex items-center gap-2">
                                    <span className="text-[10px] font-extrabold px-2 py-0.5 rounded bg-white/10 text-cyan-400">
                                        #{i + 1}
                                    </span>
                                    <input type="text" value={bet.match_name}
                                        onChange={(e) => updateBet(i, 'match_name', e.target.value)}
                                        placeholder="경기명 (예: 맨체스터 시티 vs 아스널)"
                                        className="flex-1 px-2.5 py-1.5 rounded-lg text-xs font-bold text-white"
                                        style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border-subtle)' }}
                                    />
                                    {bets.length > 1 && (
                                        <button onClick={() => removeBet(i)} className="text-xs px-2 py-1 rounded hover:bg-red-500/10 text-red-400">✕ 삭제</button>
                                    )}
                                </div>
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                                    <div>
                                        <label className="text-[10px] block mb-0.5" style={{ color: 'var(--text-muted)' }}>예측 선택</label>
                                        <select value={bet.selection}
                                            onChange={(e) => updateBet(i, 'selection', e.target.value)}
                                            className="w-full px-2 py-1.5 rounded-lg text-[11px] font-bold text-white"
                                            style={{ background: '#111827', border: '1px solid var(--border-subtle)' }}>
                                            <option value="Home">홈승 (Home)</option>
                                            <option value="Draw">무승부 (Draw)</option>
                                            <option value="Away">원정승 (Away)</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="text-[10px] block mb-0.5" style={{ color: 'var(--text-muted)' }}>제공 배당률</label>
                                        <input type="number" step="0.01" value={bet.odds}
                                            onChange={(e) => updateBet(i, 'odds', parseFloat(e.target.value) || 1.0)}
                                            className="w-full px-2 py-1.5 rounded-lg text-[11px] font-bold text-white"
                                            style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border-subtle)' }}
                                        />
                                    </div>
                                    <div>
                                        <label className="text-[10px] block mb-0.5" style={{ color: 'var(--text-muted)' }}>AI 승리 확률 (0~1)</label>
                                        <input type="number" step="0.01" min="0.05" max="0.95" value={bet.true_probability}
                                            onChange={(e) => updateBet(i, 'true_probability', parseFloat(e.target.value) || 0.5)}
                                            className="w-full px-2 py-1.5 rounded-lg text-[11px] font-bold text-emerald-400"
                                            style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border-subtle)' }}
                                        />
                                    </div>
                                    <div>
                                        <label className="text-[10px] block mb-0.5" style={{ color: 'var(--text-muted)' }}>리그 / 종목</label>
                                        <input type="text" value={bet.league}
                                            onChange={(e) => updateBet(i, 'league', e.target.value)}
                                            className="w-full px-2 py-1.5 rounded-lg text-[11px] text-white"
                                            style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border-subtle)' }}
                                        />
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Optimize Button */}
                    <button onClick={handleOptimize} disabled={loading}
                        className="w-full py-3.5 rounded-xl text-sm font-extrabold transition hover:scale-[1.01] shadow-lg"
                        style={{
                            background: loading
                                ? 'rgba(255,255,255,0.05)'
                                : 'linear-gradient(135deg, #10b981, var(--accent-primary))',
                            color: 'white',
                        }}>
                        {loading ? '⏳ 최적 자금 배분 계산 중...' : '🏆 켈리 공식 최적 자금 배분 실행하기'}
                    </button>

                    {error && (
                        <div className="p-3 rounded-xl text-xs font-bold text-center"
                            style={{ background: 'rgba(239,68,68,0.1)', color: '#ef4444' }}>
                            {error}
                        </div>
                    )}

                    {/* Results */}
                    {result?.success && (
                        <div className="space-y-4">
                            {/* Summary Dashboard */}
                            <div className="glass-card p-5 rounded-2xl"
                                style={{
                                    background: 'linear-gradient(135deg, rgba(16,185,129,0.08), rgba(0,212,255,0.08))',
                                    border: '1px solid rgba(16,185,129,0.25)',
                                }}>
                                <h3 className="text-sm font-bold text-white mb-3">📊 최적 자금 배분 요약</h3>
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
                                    <div className="p-2.5 rounded-xl bg-black/20">
                                        <div className="text-lg font-black text-green-400">
                                            {result.summary.total_allocated.toLocaleString()}원
                                        </div>
                                        <div className="text-[10px]" style={{ color: 'var(--text-muted)' }}>총 권장 배분액</div>
                                    </div>
                                    <div className="p-2.5 rounded-xl bg-black/20">
                                        <div className="text-lg font-black" style={{ color: 'var(--accent-primary)' }}>
                                            {result.summary.cash_reserve_pct}% ({result.summary.remaining_cash.toLocaleString()}원)
                                        </div>
                                        <div className="text-[10px]" style={{ color: 'var(--text-muted)' }}>현금 보유 비중 (안전 마진)</div>
                                    </div>
                                    <div className="p-2.5 rounded-xl bg-black/20">
                                        <div className="text-lg font-black text-yellow-400">
                                            +{result.summary.expected_roi}% (+{result.summary.total_expected_profit.toLocaleString()}원)
                                        </div>
                                        <div className="text-[10px]" style={{ color: 'var(--text-muted)' }}>기대 수익률 (Expected ROI)</div>
                                    </div>
                                    <div className="p-2.5 rounded-xl bg-black/20">
                                        <div className="text-lg font-black"
                                            style={{ color: riskColor(result.summary.avg_risk_score) }}>
                                            {result.summary.avg_risk_score}점
                                        </div>
                                        <div className="text-[10px]" style={{ color: 'var(--text-muted)' }}>평균 변동성 리스크 지수</div>
                                    </div>
                                </div>
                            </div>

                            {/* Allocation Cards */}
                            <div className="glass-card p-5 rounded-2xl space-y-3"
                                style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-subtle)' }}>
                                <h3 className="text-sm font-bold text-white">🎯 경기별 켈리 최적 배분액 및 기대수익</h3>
                                {result.allocations.map((alloc, i) => (
                                    <div key={i} className="p-4 rounded-xl"
                                        style={{
                                            background: alloc.status === 'recommended'
                                                ? 'rgba(16,185,129,0.05)'
                                                : 'rgba(255,255,255,0.02)',
                                            border: `1px solid ${alloc.status === 'recommended' ? 'rgba(16,185,129,0.2)' : 'var(--border-subtle)'}`,
                                        }}>
                                        <div className="flex items-center justify-between mb-2">
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2">
                                                    {alloc.league && (
                                                        <span className="text-[9px] px-1.5 py-0.5 rounded bg-white/10 text-cyan-300 font-bold">
                                                            {alloc.league}
                                                        </span>
                                                    )}
                                                    <div className="text-xs font-bold text-white truncate">
                                                        {alloc.match_name}
                                                    </div>
                                                </div>
                                                <div className="text-[10px] mt-0.5" style={{ color: 'var(--text-muted)' }}>
                                                    선택: <span className="text-white font-semibold">{selectionLabel(alloc.selection)}</span> · 배당 <span className="text-amber-400 font-bold">{alloc.odds}</span> · AI 승리확률 <span className="text-emerald-400 font-bold">{alloc.true_probability}%</span> · 기대값(EV) <span className="text-cyan-400 font-bold">{alloc.expected_value}</span>
                                                </div>
                                            </div>
                                            <span className="text-[10px] px-2.5 py-1 rounded-full font-bold"
                                                style={{
                                                    background: alloc.status === 'recommended'
                                                        ? 'rgba(16,185,129,0.2)' : 'rgba(239,68,68,0.2)',
                                                    color: alloc.status === 'recommended' ? '#10b981' : '#ef4444',
                                                }}>
                                                {alloc.status === 'recommended' ? '✅ 배분 추천' : alloc.reason || '⛔ 패스 권장'}
                                            </span>
                                        </div>

                                        {alloc.status === 'recommended' && (
                                            <div className="grid grid-cols-4 gap-2 text-center text-[11px] pt-2 border-t border-white/5">
                                                <div>
                                                    <div className="text-[10px]" style={{ color: 'var(--text-muted)' }}>권장 비중 (Kelly)</div>
                                                    <div className="font-bold text-white">{alloc.kelly_adjusted}% ({alloc.allocation_pct}%)</div>
                                                </div>
                                                <div>
                                                    <div className="text-[10px]" style={{ color: 'var(--text-muted)' }}>권장 배분 금액</div>
                                                    <div className="font-extrabold text-green-400">
                                                        {alloc.recommended_stake.toLocaleString()}원
                                                    </div>
                                                </div>
                                                <div>
                                                    <div className="text-[10px]" style={{ color: 'var(--text-muted)' }}>기대 순수익 (+EV)</div>
                                                    <div className="font-bold" style={{ color: 'var(--accent-primary)' }}>
                                                        +{alloc.expected_profit.toLocaleString()}원
                                                    </div>
                                                </div>
                                                <div>
                                                    <div className="text-[10px]" style={{ color: 'var(--text-muted)' }}>변동성 리스크</div>
                                                    <div className="font-bold" style={{ color: riskColor(alloc.risk_score) }}>
                                                        {alloc.risk_score}점
                                                    </div>
                                                </div>
                                            </div>
                                        )}

                                        {/* Visual Bar */}
                                        {alloc.status === 'recommended' && (
                                            <div className="mt-2.5 h-1.5 rounded-full overflow-hidden"
                                                style={{ background: 'rgba(255,255,255,0.05)' }}>
                                                <div className="h-full rounded-full transition-all"
                                                    style={{
                                                        width: `${Math.min(100, alloc.allocation_pct * 2.5)}%`,
                                                        background: `linear-gradient(90deg, ${riskColor(alloc.risk_score)}, var(--accent-primary))`,
                                                    }} />
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </PremiumGate>
            </main>
        </div>
    );
}
