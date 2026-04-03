"use client";
import React, { useState } from 'react';
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
    { match_name: 'Man City vs Liverpool', selection: 'Home', odds: 2.30, true_probability: 0.50, league: 'EPL' },
    { match_name: 'Barcelona vs Real Madrid', selection: 'Home', odds: 2.10, true_probability: 0.52, league: 'La Liga' },
    { match_name: 'Bayern vs Dortmund', selection: 'Away', odds: 3.40, true_probability: 0.34, league: 'Bundesliga' },
];

export default function VipPortfolioPage() {
    const { user, token } = useAuth();
    const pathname = usePathname();
    const sortedLocales = [...i18n.locales].sort((a, b) => b.length - a.length);
    const currentLang = sortedLocales.find((l) => pathname.startsWith(`/${l}/`) || pathname === `/${l}`) || i18n.defaultLocale;
    const API = process.env.NEXT_PUBLIC_API_URL || '';

    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState<PortfolioResult | null>(null);
    const [bankroll, setBankroll] = useState(200000);
    const [riskLevel, setRiskLevel] = useState<'conservative' | 'moderate' | 'aggressive'>('moderate');
    const [maxPerBet, setMaxPerBet] = useState(25);
    const [bets, setBets] = useState<BetInput[]>(DEFAULT_BETS);
    const [error, setError] = useState('');

    const riskLabels = {
        conservative: { label: 'Conservative', emoji: '🛡️', color: '#10b981', desc: 'Stable returns, low volatility' },
        moderate: { label: 'Balanced', emoji: '⚖️', color: '#f59e0b', desc: 'Optimal return/risk ratio' },
        aggressive: { label: 'Aggressive', emoji: '🔥', color: '#ef4444', desc: 'High returns, high volatility' },
    };

    const updateBet = (idx: number, field: keyof BetInput, value: string | number) => {
        setBets(prev => prev.map((b, i) => i === idx ? { ...b, [field]: value } : b));
    };

    const addBet = () => {
        if (bets.length >= 8) return;
        setBets(prev => [...prev, { match_name: '', selection: 'Home', odds: 2.0, true_probability: 0.5, league: '' }]);
    };

    const removeBet = (idx: number) => {
        if (bets.length <= 1) return;
        setBets(prev => prev.filter((_, i) => i !== idx));
    };

    const handleOptimize = async () => {
        setLoading(true);
        setError('');
        try {
            const res = await fetch(`${API}/api/vip/portfolio/optimize`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...(token ? { Authorization: `Bearer ${token}` } : {}),
                },
                body: JSON.stringify({
                    total_bankroll: bankroll,
                    bets: bets.filter(b => b.match_name),
                    risk_level: riskLevel,
                    max_per_bet_pct: maxPerBet,
                }),
            });
            const data = await res.json();
            if (res.status === 403) {
                setError('VIP membership required.');
                return;
            }
            setResult(data);
        } catch {
            setError('Failed to connect to server.');
        } finally {
            setLoading(false);
        }
    };

    const riskColor = (score: number) =>
        score < 30 ? '#10b981' : score < 60 ? '#f59e0b' : '#ef4444';

    return (
        <div className="min-h-screen" style={{ background: 'var(--bg-primary)' }}>
            <Navbar />
            <DeadlineBanner />

            <main className="max-w-4xl mx-auto px-4 py-8 space-y-6">
                {/* Header */}
                <div className="flex items-center gap-3">
                    <a href={`/${currentLang}/vip`} className="text-sm" style={{ color: 'var(--text-muted)' }}>
                        ← VIP
                    </a>
                    <h1 className="text-xl font-black text-white">🏆 Portfolio Optimization</h1>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold"
                        style={{ background: 'rgba(16,185,129,0.15)', color: '#10b981' }}>
                        VIP
                    </span>
                </div>

                <PremiumGate featureName="Portfolio Optimization" requiredTier="vip">
                    {/* Settings */}
                    <div className="glass-card p-5 rounded-2xl space-y-4"
                        style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-subtle)' }}>
                        <h2 className="text-sm font-bold text-white">⚙️ Portfolio Settings</h2>

                        {/* Bankroll + Max Per Bet */}
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="text-[10px] font-bold mb-1 block" style={{ color: 'var(--text-muted)' }}>
                                    Total Bankroll (KRW)
                                </label>
                                <input type="number" value={bankroll}
                                    onChange={(e) => setBankroll(Number(e.target.value))}
                                    className="w-full px-3 py-2 rounded-lg text-sm font-bold text-white"
                                    style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border-subtle)' }}
                                    step={50000} min={10000} max={5000000}
                                />
                            </div>
                            <div>
                                <label className="text-[10px] font-bold mb-1 block" style={{ color: 'var(--text-muted)' }}>
                                    Max Allocation Per Match (%)
                                </label>
                                <select value={maxPerBet}
                                    onChange={(e) => setMaxPerBet(Number(e.target.value))}
                                    className="w-full px-3 py-2 rounded-lg text-sm font-bold text-white"
                                    style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border-subtle)' }}>
                                    {[10, 15, 20, 25, 30, 40, 50].map(n => (
                                        <option key={n} value={n}>{n}%</option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        {/* Risk Level */}
                        <div>
                            <label className="text-[10px] font-bold mb-2 block" style={{ color: 'var(--text-muted)' }}>
                                Risk Level
                            </label>
                            <div className="grid grid-cols-3 gap-2">
                                {(Object.keys(riskLabels) as Array<keyof typeof riskLabels>).map((key) => {
                                    const r = riskLabels[key];
                                    const active = riskLevel === key;
                                    return (
                                        <button key={key} onClick={() => setRiskLevel(key)}
                                            className="p-3 rounded-xl text-center transition"
                                            style={{
                                                background: active ? `${r.color}15` : 'rgba(255,255,255,0.02)',
                                                border: `1px solid ${active ? `${r.color}44` : 'var(--border-subtle)'}`,
                                            }}>
                                            <div className="text-lg">{r.emoji}</div>
                                            <div className="text-xs font-bold mt-1" style={{ color: active ? r.color : 'white' }}>
                                                {r.label}
                                            </div>
                                            <div className="text-[9px] mt-0.5" style={{ color: 'var(--text-muted)' }}>
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
                        <div className="flex items-center justify-between">
                            <h2 className="text-sm font-bold text-white">🎯 Target Matches</h2>
                            <button onClick={addBet} disabled={bets.length >= 8}
                                className="text-[10px] px-3 py-1 rounded-lg font-bold"
                                style={{ background: 'rgba(0,212,255,0.15)', color: 'var(--accent-primary)' }}>
                                + Add Match
                            </button>
                        </div>

                        {bets.map((bet, i) => (
                            <div key={i} className="p-3 rounded-xl space-y-2"
                                style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-subtle)' }}>
                                <div className="flex items-center gap-2">
                                    <input type="text" value={bet.match_name}
                                        onChange={(e) => updateBet(i, 'match_name', e.target.value)}
                                        placeholder="Match (e.g. Man City vs Liverpool)"
                                        className="flex-1 px-2 py-1.5 rounded text-xs text-white"
                                        style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border-subtle)' }}
                                    />
                                    {bets.length > 1 && (
                                        <button onClick={() => removeBet(i)} className="text-xs px-2 text-red-400">✕</button>
                                    )}
                                </div>
                                <div className="grid grid-cols-4 gap-2">
                                    <div>
                                        <label className="text-[9px] block mb-0.5" style={{ color: 'var(--text-muted)' }}>Selection</label>
                                        <select value={bet.selection}
                                            onChange={(e) => updateBet(i, 'selection', e.target.value)}
                                            className="w-full px-2 py-1 rounded text-[10px] text-white"
                                            style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border-subtle)' }}>
                                            <option value="Home">Home</option>
                                            <option value="Draw">Draw</option>
                                            <option value="Away">Away</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="text-[9px] block mb-0.5" style={{ color: 'var(--text-muted)' }}>Odds</label>
                                        <input type="number" step="0.01" value={bet.odds}
                                            onChange={(e) => updateBet(i, 'odds', parseFloat(e.target.value))}
                                            className="w-full px-2 py-1 rounded text-[10px] text-white"
                                            style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border-subtle)' }}
                                        />
                                    </div>
                                    <div>
                                        <label className="text-[9px] block mb-0.5" style={{ color: 'var(--text-muted)' }}>True Prob</label>
                                        <input type="number" step="0.01" value={bet.true_probability}
                                            onChange={(e) => updateBet(i, 'true_probability', parseFloat(e.target.value))}
                                            className="w-full px-2 py-1 rounded text-[10px] text-white"
                                            style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border-subtle)' }}
                                        />
                                    </div>
                                    <div>
                                        <label className="text-[9px] block mb-0.5" style={{ color: 'var(--text-muted)' }}>League</label>
                                        <input type="text" value={bet.league}
                                            onChange={(e) => updateBet(i, 'league', e.target.value)}
                                            className="w-full px-2 py-1 rounded text-[10px] text-white"
                                            style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border-subtle)' }}
                                        />
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Optimize Button */}
                    <button onClick={handleOptimize} disabled={loading}
                        className="w-full py-3 rounded-xl text-sm font-bold transition hover:scale-[1.01]"
                        style={{
                            background: loading
                                ? 'rgba(255,255,255,0.05)'
                                : 'linear-gradient(135deg, #10b981, var(--accent-primary))',
                            color: 'white',
                        }}>
                        {loading ? '⏳ Optimizing...' : '🏆 Run Portfolio Optimization'}
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
                                    border: '1px solid rgba(16,185,129,0.2)',
                                }}>
                                <h3 className="text-sm font-bold text-white mb-3">📊 Allocation Summary</h3>
                                <div className="grid grid-cols-4 gap-3 text-center">
                                    <div>
                                        <div className="text-lg font-black text-green-400">
                                            {result.summary.total_allocated.toLocaleString()} KRW
                                        </div>
                                        <div className="text-[10px]" style={{ color: 'var(--text-muted)' }}>Total Allocated</div>
                                    </div>
                                    <div>
                                        <div className="text-lg font-black" style={{ color: 'var(--accent-primary)' }}>
                                            {result.summary.cash_reserve_pct}%
                                        </div>
                                        <div className="text-[10px]" style={{ color: 'var(--text-muted)' }}>Cash Reserve</div>
                                    </div>
                                    <div>
                                        <div className="text-lg font-black text-yellow-400">
                                            {result.summary.expected_roi}%
                                        </div>
                                        <div className="text-[10px]" style={{ color: 'var(--text-muted)' }}>Expected ROI</div>
                                    </div>
                                    <div>
                                        <div className="text-lg font-black"
                                            style={{ color: riskColor(result.summary.avg_risk_score) }}>
                                            {result.summary.avg_risk_score}
                                        </div>
                                        <div className="text-[10px]" style={{ color: 'var(--text-muted)' }}>Risk Score</div>
                                    </div>
                                </div>
                            </div>

                            {/* Allocation Cards */}
                            <div className="glass-card p-5 rounded-2xl space-y-3"
                                style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-subtle)' }}>
                                <h3 className="text-sm font-bold text-white">🎯 Per-Match Allocation</h3>
                                {result.allocations.map((alloc, i) => (
                                    <div key={i} className="p-3 rounded-xl"
                                        style={{
                                            background: alloc.status === 'recommended'
                                                ? 'rgba(16,185,129,0.05)'
                                                : 'rgba(255,255,255,0.02)',
                                            border: `1px solid ${alloc.status === 'recommended' ? 'rgba(16,185,129,0.15)' : 'var(--border-subtle)'}`,
                                        }}>
                                        <div className="flex items-center justify-between mb-2">
                                            <div className="flex-1 min-w-0">
                                                <div className="text-xs font-bold text-white truncate">
                                                    {alloc.match_name}
                                                </div>
                                                <div className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
                                                    {alloc.selection} · Odds {alloc.odds} · True Prob {alloc.true_probability}%
                                                </div>
                                            </div>
                                            <span className="text-[10px] px-2 py-0.5 rounded-full font-bold"
                                                style={{
                                                    background: alloc.status === 'recommended'
                                                        ? 'rgba(16,185,129,0.2)' : 'rgba(239,68,68,0.2)',
                                                    color: alloc.status === 'recommended' ? '#10b981' : '#ef4444',
                                                }}>
                                                {alloc.status === 'recommended' ? '✅ Recommended' : alloc.reason || '⛔ Skipped'}
                                            </span>
                                        </div>

                                        {alloc.status === 'recommended' && (
                                            <div className="grid grid-cols-4 gap-2 text-center text-[10px]">
                                                <div>
                                                    <div style={{ color: 'var(--text-muted)' }}>Kelly</div>
                                                    <div className="font-bold text-white">{alloc.kelly_adjusted}%</div>
                                                </div>
                                                <div>
                                                    <div style={{ color: 'var(--text-muted)' }}>Budget</div>
                                                    <div className="font-bold text-green-400">
                                                        {alloc.recommended_stake.toLocaleString()} KRW
                                                    </div>
                                                </div>
                                                <div>
                                                    <div style={{ color: 'var(--text-muted)' }}>Expected Profit</div>
                                                    <div className="font-bold" style={{ color: 'var(--accent-primary)' }}>
                                                        {alloc.expected_profit.toLocaleString()} KRW
                                                    </div>
                                                </div>
                                                <div>
                                                    <div style={{ color: 'var(--text-muted)' }}>Risk</div>
                                                    <div className="font-bold" style={{ color: riskColor(alloc.risk_score) }}>
                                                        {alloc.risk_score}
                                                    </div>
                                                </div>
                                            </div>
                                        )}

                                        {/* Visual Bar */}
                                        {alloc.status === 'recommended' && (
                                            <div className="mt-2 h-1.5 rounded-full overflow-hidden"
                                                style={{ background: 'rgba(255,255,255,0.05)' }}>
                                                <div className="h-full rounded-full transition-all"
                                                    style={{
                                                        width: `${alloc.allocation_pct}%`,
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
