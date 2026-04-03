"use client";
import React, { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import Navbar from '../../components/Navbar';
import DeadlineBanner from '../../components/DeadlineBanner';
import PremiumGate from '../../components/PremiumGate';
import { useAuth } from '../../context/AuthContext';
import { i18n } from '../../lib/i18n-config';

interface KellyAllocation {
    match_name: string;
    bet_type: string;
    odds: number;
    true_probability: number;
    value_gap: number;
    kelly_pct: number;
    recommended_stake: number;
}

interface ComboResult {
    items: { match_name: string; selection: string; odds: number }[];
    stake: number;
    total_odds: number;
    expected_return: number;
    tax: number;
    net_return: number;
    strategy: string;
}

interface AutoOptimizeResponse {
    success: boolean;
    combos: ComboResult[];
    kelly_allocations: KellyAllocation[];
    tax_strategy: { original_tax: number; optimized_tax: number; tax_saved: number };
    summary: { total_odds: number; total_stake: number; net_return: number; roi: number; combo_count: number };
    picks_count: number;
    message?: string;
    error?: string;
}

const RISK_COLORS: Record<string, string> = {
    low: '#10b981',
    medium: '#f59e0b',
    high: '#ef4444',
};

export default function VipComboPage() {
    const { user, token } = useAuth();
    const pathname = usePathname();
    const sortedLocales = [...i18n.locales].sort((a, b) => b.length - a.length);
    const currentLang = sortedLocales.find((l) => pathname.startsWith(`/${l}/`) || pathname === `/${l}`) || i18n.defaultLocale;

    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState<AutoOptimizeResponse | null>(null);
    const [budget, setBudget] = useState(100000);
    const [maxCombo, setMaxCombo] = useState(5);
    const [minGap, setMinGap] = useState(5);
    const [error, setError] = useState('');

    const handleAutoOptimize = async () => {
        setLoading(true);
        setError('');
        try {
            const API = process.env.NEXT_PUBLIC_API_URL || '';
            const res = await fetch(`${API}/api/vip/combo/auto-optimize`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...(token ? { Authorization: `Bearer ${token}` } : {}),
                },
                body: JSON.stringify({
                    budget,
                    max_combo_size: maxCombo,
                    min_value_gap: minGap,
                }),
            });
            const data = await res.json();
            if (res.status === 403) {
                setError('VIP membership required.');
                return;
            }
            setResult(data);
            if (!data.success && data.error) {
                setError(data.message || data.error);
            }
        } catch (e) {
            setError('Failed to connect to server.');
        } finally {
            setLoading(false);
        }
    };

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
                    <h1 className="text-xl font-black text-white">🎯 AI Combo Analysis</h1>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold"
                        style={{ background: 'rgba(0,212,255,0.15)', color: 'var(--accent-primary)' }}>
                        VIP
                    </span>
                </div>

                <PremiumGate featureName="AI Combo Analysis" requiredTier="vip">
                    {/* Settings Card */}
                    <div className="glass-card p-5 rounded-2xl space-y-4"
                        style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-subtle)' }}>
                        <h2 className="text-sm font-bold text-white">⚙️ Analysis Settings</h2>

                        <div className="grid grid-cols-3 gap-4">
                            <div>
                                <label className="text-[10px] font-bold mb-1 block" style={{ color: 'var(--text-muted)' }}>
                                    Budget (KRW)
                                </label>
                                <input
                                    type="number"
                                    value={budget}
                                    onChange={(e) => setBudget(Number(e.target.value))}
                                    className="w-full px-3 py-2 rounded-lg text-sm font-bold text-white"
                                    style={{
                                        background: 'rgba(255,255,255,0.05)',
                                        border: '1px solid var(--border-subtle)',
                                    }}
                                    step={10000}
                                    min={10000}
                                    max={1000000}
                                />
                            </div>
                            <div>
                                <label className="text-[10px] font-bold mb-1 block" style={{ color: 'var(--text-muted)' }}>
                                    Max Combo Matches
                                </label>
                                <select
                                    value={maxCombo}
                                    onChange={(e) => setMaxCombo(Number(e.target.value))}
                                    className="w-full px-3 py-2 rounded-lg text-sm font-bold text-white"
                                    style={{
                                        background: 'rgba(255,255,255,0.05)',
                                        border: '1px solid var(--border-subtle)',
                                    }}
                                >
                                    {[2, 3, 4, 5, 6, 7, 8].map((n) => (
                                        <option key={n} value={n}>{n} matches</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="text-[10px] font-bold mb-1 block" style={{ color: 'var(--text-muted)' }}>
                                    Min Value Gap (%)
                                </label>
                                <select
                                    value={minGap}
                                    onChange={(e) => setMinGap(Number(e.target.value))}
                                    className="w-full px-3 py-2 rounded-lg text-sm font-bold text-white"
                                    style={{
                                        background: 'rgba(255,255,255,0.05)',
                                        border: '1px solid var(--border-subtle)',
                                    }}
                                >
                                    {[3, 5, 8, 10, 15, 20].map((n) => (
                                        <option key={n} value={n}>{n}%</option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        <button
                            onClick={handleAutoOptimize}
                            disabled={loading}
                            className="w-full py-3 rounded-xl text-sm font-bold transition hover:scale-[1.01]"
                            style={{
                                background: loading
                                    ? 'rgba(255,255,255,0.05)'
                                    : 'linear-gradient(135deg, var(--accent-primary), var(--accent-secondary))',
                                color: 'white',
                            }}
                        >
                            {loading ? '⏳ Analyzing...' : '🎯 Run Auto Optimization'}
                        </button>
                    </div>

                    {/* Error */}
                    {error && (
                        <div className="p-3 rounded-xl text-xs font-bold text-center"
                            style={{ background: 'rgba(239,68,68,0.1)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.2)' }}>
                            {error}
                        </div>
                    )}

                    {/* Result Message */}
                    {result?.message && !result.combos?.length && (
                        <div className="glass-card p-4 rounded-xl text-center"
                            style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-subtle)' }}>
                            <p className="text-sm text-white">{result.message}</p>
                        </div>
                    )}

                    {/* Results */}
                    {result?.success && result.combos?.length > 0 && (
                        <div className="space-y-4">
                            {/* Summary */}
                            <div className="glass-card p-4 rounded-2xl"
                                style={{
                                    background: 'linear-gradient(135deg, rgba(0,212,255,0.08), rgba(139,92,246,0.08))',
                                    border: '1px solid rgba(0,212,255,0.2)',
                                }}>
                                <h3 className="text-sm font-bold text-white mb-3">📊 Analysis Results</h3>
                                <div className="grid grid-cols-4 gap-3">
                                    <div className="text-center">
                                        <div className="text-lg font-black" style={{ color: 'var(--accent-primary)' }}>
                                            {result.picks_count}
                                        </div>
                                        <div className="text-[10px]" style={{ color: 'var(--text-muted)' }}>Picks</div>
                                    </div>
                                    <div className="text-center">
                                        <div className="text-lg font-black" style={{ color: 'var(--accent-secondary)' }}>
                                            {result.summary?.total_odds?.toFixed(1)}x
                                        </div>
                                        <div className="text-[10px]" style={{ color: 'var(--text-muted)' }}>Combined Odds</div>
                                    </div>
                                    <div className="text-center">
                                        <div className="text-lg font-black text-green-400">
                                            {result.summary?.net_return?.toLocaleString()} KRW
                                        </div>
                                        <div className="text-[10px]" style={{ color: 'var(--text-muted)' }}>Expected Profit</div>
                                    </div>
                                    <div className="text-center">
                                        <div className="text-lg font-black text-yellow-400">
                                            {result.tax_strategy?.tax_saved?.toLocaleString()} KRW
                                        </div>
                                        <div className="text-[10px]" style={{ color: 'var(--text-muted)' }}>Tax Saved</div>
                                    </div>
                                </div>
                            </div>

                            {/* Kelly Allocations */}
                            {result.kelly_allocations && result.kelly_allocations.length > 0 && (
                                <div className="glass-card p-4 rounded-2xl space-y-3"
                                    style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-subtle)' }}>
                                    <h3 className="text-sm font-bold text-white">🏆 Kelly Allocation Recommendation</h3>
                                    {result.kelly_allocations.map((alloc, i) => (
                                        <div key={i} className="p-3 rounded-xl flex items-center gap-3"
                                            style={{
                                                background: 'rgba(255,255,255,0.02)',
                                                border: '1px solid var(--border-subtle)',
                                            }}>
                                            <div className="flex-1 min-w-0">
                                                <div className="text-xs font-bold text-white truncate">{alloc.match_name}</div>
                                                <div className="text-[10px] mt-0.5" style={{ color: 'var(--text-muted)' }}>
                                                    {alloc.bet_type} · Odds {alloc.odds} · True Prob {alloc.true_probability}%
                                                </div>
                                            </div>
                                            <div className="text-right flex-shrink-0">
                                                <div className="text-xs font-bold" style={{ color: 'var(--accent-primary)' }}>
                                                    {alloc.recommended_stake.toLocaleString()} KRW
                                                </div>
                                                <div className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
                                                    Kelly {alloc.kelly_pct}% · Gap {alloc.value_gap}%
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {/* Combo Cards */}
                            {result.combos.map((combo, i) => (
                                <div key={i} className="glass-card p-4 rounded-2xl space-y-3"
                                    style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-subtle)' }}>
                                    <div className="flex items-center justify-between">
                                        <h3 className="text-sm font-bold text-white">
                                            🎲 {combo.strategy}
                                        </h3>
                                        <span className="text-[10px] px-2 py-0.5 rounded-full"
                                            style={{
                                                background: combo.tax === 0 ? 'rgba(16,185,129,0.15)' : 'rgba(245,158,11,0.15)',
                                                color: combo.tax === 0 ? '#10b981' : '#f59e0b',
                                            }}>
                                            {combo.tax === 0 ? '✅ Tax-Free' : `Tax ${combo.tax.toLocaleString()} KRW`}
                                        </span>
                                    </div>

                                    <div className="space-y-1">
                                        {combo.items.map((item, j) => (
                                            <div key={j} className="flex justify-between text-xs py-1 border-b"
                                                style={{ borderColor: 'var(--border-subtle)' }}>
                                                <span className="text-white">{item.match_name}</span>
                                                <span style={{ color: 'var(--accent-primary)' }}>
                                                    {item.selection} ({item.odds})
                                                </span>
                                            </div>
                                        ))}
                                    </div>

                                    <div className="grid grid-cols-3 gap-2 text-center text-xs">
                                        <div>
                                            <span style={{ color: 'var(--text-muted)' }}>Budget</span>
                                            <div className="font-bold text-white">{combo.stake.toLocaleString()} KRW</div>
                                        </div>
                                        <div>
                                            <span style={{ color: 'var(--text-muted)' }}>Combined Odds</span>
                                            <div className="font-bold" style={{ color: 'var(--accent-primary)' }}>
                                                {combo.total_odds}x
                                            </div>
                                        </div>
                                        <div>
                                            <span style={{ color: 'var(--text-muted)' }}>Net Return</span>
                                            <div className="font-bold text-green-400">
                                                {combo.net_return.toLocaleString()} KRW
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </PremiumGate>
            </main>
        </div>
    );
}
