
"use client";
import React, { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import DeadlineBanner from '../components/DeadlineBanner';
import Navbar from '../components/Navbar';
import PremiumGate from '../components/PremiumGate';
import { useCart } from '../../context/CartContext';

interface MatchBet {
    match_name: string;
    league: string;
    match_time: string;
    home_odds: number;
    draw_odds: number;
    away_odds: number;
    pin_home_odds: number;
    pin_draw_odds: number;
    pin_away_odds: number;
    best_bet_type: string;
    best_ev: number;
    best_kelly: number;
    has_betman: boolean;
}

type BetType = 'Home' | 'Draw' | 'Away';

/* ───── Helpers ───── */
const fmtOdds = (v: number) => (v > 1 ? v.toFixed(2) : '-');

const formatTime = (iso: string) => {
    if (!iso) return '';
    try {
        const d = new Date(iso);
        if (isNaN(d.getTime())) return '';
        return d.toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false });
    } catch { return ''; }
};

const calcProb = (homeOdds: number, drawOdds: number, awayOdds: number) => {
    if (homeOdds <= 1 || drawOdds <= 1 || awayOdds <= 1) return { home: 0, draw: 0, away: 0 };
    const h = 1 / homeOdds, d = 1 / drawOdds, a = 1 / awayOdds;
    const s = h + d + a;
    return { home: Math.round((h / s) * 100), draw: Math.round((d / s) * 100), away: Math.round((a / s) * 100) };
};

const efficiency = (dom: number, pin: number) => {
    if (pin <= 1 || dom <= 0) return 0;
    return Math.round((dom / pin) * 1000) / 10;
};

/* ───── Component ───── */
export default function BetsPage() {
    const [matches, setMatches] = useState<MatchBet[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [selectedBets, setSelectedBets] = useState<Map<string, { match: MatchBet; type: BetType; odds: number }>>(new Map());
    const [showProb, setShowProb] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);
    const { addToCart, removeFromCart, cartItems } = useCart();
    const router = useRouter();

    const fetchBets = async () => {
        setLoading(true);
        setError('');
        try {
            const res = await fetch('/api/bets');
            if (!res.ok) throw new Error('Failed to fetch');
            setMatches(await res.json());
        } catch { setError('데이터를 불러오는데 실패했습니다.'); }
        finally { setLoading(false); }
    };

    useEffect(() => { fetchBets(); }, []);

    /* Group by league */
    const grouped = useMemo(() => {
        const map = new Map<string, MatchBet[]>();
        matches.forEach(m => {
            const key = m.league || '기타';
            if (!map.has(key)) map.set(key, []);
            map.get(key)!.push(m);
        });
        return map;
    }, [matches]);

    /* Top picks — 기능2: 최적 배팅 선별 */
    const topPicks = useMemo(() => {
        return matches
            .filter(m => m.has_betman && m.best_ev > 85)
            .sort((a, b) => b.best_ev - a.best_ev)
            .slice(0, 5);
    }, [matches]);

    /* Toggle bet selection — 기능4: 조합 배팅 + 장바구니 연동 */
    const toggleBet = (matchId: string, match: MatchBet, type: BetType) => {
        const parts = match.match_name.split(' vs ');
        const home = parts[0] || '';
        const away = parts[1] || '';
        const odds = type === 'Home' ? match.home_odds : type === 'Draw' ? match.draw_odds : match.away_odds;
        if (odds <= 1) return;

        const key = `${matchId}-${type}`;
        const cartId = `${home}_${away}_${type}`;
        const wasSelected = selectedBets.has(key);

        setSelectedBets(prev => {
            const next = new Map(prev);
            // Remove any existing selection for this match
            (['Home', 'Draw', 'Away'] as BetType[]).forEach(t => {
                next.delete(`${matchId}-${t}`);
                removeFromCart(`${home}_${away}_${t}`);
            });
            if (!wasSelected) {
                next.set(key, { match, type, odds });
                addToCart({
                    id: cartId,
                    match_name: match.match_name,
                    selection: type,
                    odds,
                    team_home: home,
                    team_away: away,
                    time: formatTime(match.match_time),
                });
            }
            return next;
        });
    };

    /* 조합 저장 — Firestore에 베팅 슬립 저장 */
    const handleSaveCombo = async () => {
        const token = localStorage.getItem('token');
        if (!token) {
            if (confirm("로그인이 필요한 기능입니다. 로그인 하시겠습니까?")) {
                router.push('/login');
            }
            return;
        }
        if (selectedBets.size < 2) return;

        setSaving(true);
        const items = Array.from(selectedBets.values()).map(v => {
            const parts = v.match.match_name.split(' vs ');
            return {
                id: `${parts[0]}_${parts[1]}_${v.type}`,
                match_name: v.match.match_name,
                selection: v.type,
                odds: v.odds,
                team_home: parts[0],
                team_away: parts[1],
                time: formatTime(v.match.match_time),
            };
        });
        const totalOdds = items.reduce((acc, i) => acc * i.odds, 1);

        try {
            const res = await fetch('/api/portfolio/slip/save', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({ items, stake: 10000, total_odds: totalOdds, potential_return: Math.floor(10000 * totalOdds) }),
            });
            if (res.ok) {
                alert('조합이 저장되었습니다! 💾');
                setSelectedBets(new Map());
            } else {
                const err = await res.json();
                alert('저장 실패: ' + (err.detail || '알 수 없는 오류'));
            }
        } catch { alert('네트워크 오류'); }
        finally { setSaving(false); }
    };

    /* Combo odds */
    const comboOdds = useMemo(() => {
        if (selectedBets.size === 0) return 0;
        let prod = 1;
        selectedBets.forEach(v => { prod *= v.odds; });
        return Math.round(prod * 100) / 100;
    }, [selectedBets]);

    const betTypeKo = (t: string) => t === 'Home' ? '홈승' : t === 'Draw' ? '무' : '원정승';
    const isSelected = (matchId: string, type: BetType) => selectedBets.has(`${matchId}-${type}`);

    return (
        <div className="min-h-screen flex flex-col" style={{ background: 'var(--bg-primary)' }}>
            <DeadlineBanner />
            <Navbar />

            <main className="flex-grow max-w-7xl mx-auto px-2 sm:px-6 lg:px-8 py-4 w-full">
                {/* Header */}
                <div className="flex justify-between items-center mb-4">
                    <div>
                        <h1 className="text-xl font-extrabold text-white flex items-center">
                            <span className="w-1 h-6 rounded-full bg-gradient-to-b from-[var(--accent-primary)] to-[var(--accent-secondary)] mr-3"></span>
                            배당 분석
                        </h1>
                        <p className="text-xs text-[var(--text-muted)] mt-1 ml-4">Pinnacle 배당 기반 실시간 분석</p>
                    </div>
                    <button onClick={fetchBets} className="btn-primary text-xs px-3 py-1.5">
                        {loading ? '분석 중...' : '🔄 새로고침'}
                    </button>
                </div>

                {/* 기능2: 오늘의 TOP PICKS */}
                {topPicks.length > 0 && (
                    <div className="mb-4 p-4 glass-card">
                        <h3 className="text-sm font-bold text-[var(--accent-primary)] mb-3 flex items-center">
                            🔥 오늘의 추천 — 배당 효율 TOP
                        </h3>
                        <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-5 gap-2">
                            {topPicks.map((m, i) => {
                                const parts = m.match_name.split(' vs ');
                                return (
                                    <div key={i} className="glass-card p-3 hover:border-[rgba(0,212,255,0.3)] transition-all cursor-pointer">
                                        <div className="text-[10px] text-white/30 mb-1">{m.league}</div>
                                        <div className="text-xs font-bold text-white truncate">{parts[0]}</div>
                                        <div className="text-[10px] text-white/50 truncate">vs {parts[1]}</div>
                                        <div className="flex justify-between items-center mt-2">
                                            <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${m.best_ev >= 100 ? 'bg-red-500/20 text-red-400' :
                                                m.best_ev >= 95 ? 'bg-blue-500/20 text-blue-400' : 'bg-white/10 text-white/50'
                                                }`}>
                                                {betTypeKo(m.best_bet_type)}
                                            </span>
                                            <span className={`text-sm font-bold ${m.best_ev >= 100 ? 'text-red-400' : m.best_ev >= 95 ? 'text-blue-400' : 'text-white/60'
                                                }`}>
                                                {m.best_ev}%
                                            </span>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}

                {error && (
                    <div className="surface-card p-3 text-red-400 text-sm mb-4 border-red-500/30">{error}</div>
                )}

                {/* Main Table — bet365 Style */}
                <div className="surface-card overflow-hidden">
                    {loading && matches.length === 0 ? (
                        <div className="py-20 text-center text-white/40">
                            <div className="animate-spin inline-block w-8 h-8 border-2 border-white/10 border-t-[var(--accent-primary)] rounded-full mb-3"></div>
                            <p>배당 데이터 분석 중...</p>
                        </div>
                    ) : matches.length === 0 ? (
                        <div className="py-20 text-center text-white/30">현재 분석 가능한 경기가 없습니다.</div>
                    ) : (
                        <>
                            {/* Table Header */}
                            <div className="grid grid-cols-[40px_1fr_90px_90px_90px_50px] sm:grid-cols-[50px_1fr_100px_100px_100px_60px] text-[11px] font-bold text-white/40 uppercase border-b border-white/5 bg-white/3 px-2">
                                <div className="py-2.5 text-center">#</div>
                                <div className="py-2.5 pl-2">경기</div>
                                <div className="py-2.5 text-center">1</div>
                                <div className="py-2.5 text-center">무</div>
                                <div className="py-2.5 text-center">2</div>
                                <div className="py-2.5 text-center">📊</div>
                            </div>

                            {/* Grouped by League */}
                            {Array.from(grouped.entries()).map(([league, leagueMatches]) => (
                                <div key={league}>
                                    {/* League Header */}
                                    <div className="px-3 py-2 flex items-center justify-between border-b border-white/5" style={{ background: 'var(--bg-elevated)' }}>
                                        <span className="text-xs font-bold text-white/60">{league}</span>
                                        <div className="flex items-center space-x-4 text-[10px] text-white/30">
                                            <span>1</span><span>무</span><span>2</span>
                                        </div>
                                    </div>

                                    {/* Match Rows */}
                                    {leagueMatches.map((m, idx) => {
                                        const parts = m.match_name.split(' vs ');
                                        const home = parts[0] || '';
                                        const away = parts[1] || '';
                                        const matchId = `${league}-${idx}`;
                                        const prob = calcProb(m.pin_home_odds, m.pin_draw_odds, m.pin_away_odds);
                                        const isExpanded = showProb === matchId;

                                        return (
                                            <div key={idx} className="border-b border-white/5 last:border-0">
                                                <div className={`grid grid-cols-[40px_1fr_90px_90px_90px_50px] sm:grid-cols-[50px_1fr_100px_100px_100px_60px] items-center px-2 transition hover:bg-white/3 ${m.has_betman ? '' : 'opacity-50'}`}>
                                                    {/* Number */}
                                                    <div className="py-3 text-center text-[11px] text-white/20 font-mono">{idx + 1}</div>

                                                    {/* Match Info */}
                                                    <div className="py-3 pl-2">
                                                        <div className="flex items-center space-x-2">
                                                            <div className="text-[10px] text-white/30 w-12 shrink-0">{formatTime(m.match_time)}</div>
                                                            <div>
                                                                <div className="text-sm font-semibold text-white leading-tight">{home}</div>
                                                                <div className="text-xs text-white/40 leading-tight">{away}</div>
                                                            </div>
                                                        </div>
                                                        {m.has_betman && (
                                                            <div className="mt-1 ml-14">
                                                                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${m.best_ev >= 100 ? 'bg-red-500/20 text-red-400' :
                                                                    m.best_ev >= 95 ? 'bg-[rgba(0,212,255,0.1)] text-[var(--accent-primary)]' :
                                                                        'bg-white/5 text-white/30'
                                                                    }`}>
                                                                    효율 {m.best_ev}%
                                                                </span>
                                                            </div>
                                                        )}
                                                    </div>

                                                    {/* 1 (Home) */}
                                                    <div className="py-3 px-1">
                                                        <button
                                                            onClick={() => toggleBet(matchId, m, 'Home')}
                                                            className={`w-full py-2 rounded-lg text-center text-sm font-bold transition-all ${isSelected(matchId, 'Home')
                                                                ? 'odds-cell selected text-[var(--accent-primary)]'
                                                                : 'odds-cell text-white/80 hover:text-white'
                                                                }`}
                                                        >
                                                            {fmtOdds(m.home_odds)}
                                                        </button>
                                                    </div>

                                                    {/* Draw */}
                                                    <div className="py-3 px-1">
                                                        <button
                                                            onClick={() => toggleBet(matchId, m, 'Draw')}
                                                            className={`w-full py-2 rounded-lg text-center text-sm font-bold transition-all ${isSelected(matchId, 'Draw')
                                                                ? 'odds-cell selected text-[var(--accent-primary)]'
                                                                : 'odds-cell text-white/80 hover:text-white'
                                                                }`}
                                                        >
                                                            {fmtOdds(m.draw_odds)}
                                                        </button>
                                                    </div>

                                                    {/* 2 (Away) */}
                                                    <div className="py-3 px-1">
                                                        <button
                                                            onClick={() => toggleBet(matchId, m, 'Away')}
                                                            className={`w-full py-2 rounded-lg text-center text-sm font-bold transition-all ${isSelected(matchId, 'Away')
                                                                ? 'odds-cell selected text-[var(--accent-primary)]'
                                                                : 'odds-cell text-white/80 hover:text-white'
                                                                }`}
                                                        >
                                                            {fmtOdds(m.away_odds)}
                                                        </button>
                                                    </div>

                                                    {/* 기능3: Prob Toggle */}
                                                    <div className="py-3 text-center">
                                                        <button
                                                            onClick={() => setShowProb(isExpanded ? null : matchId)}
                                                            className={`text-lg transition-all ${isExpanded ? 'text-[var(--accent-primary)]' : 'text-[var(--text-muted)] hover:text-white/40'}`}
                                                        >
                                                            📊
                                                        </button>
                                                    </div>
                                                </div>

                                                {/* 기능3: 확률 예측 패널 (Premium Gated) */}
                                                {isExpanded && (
                                                    <PremiumGate featureName="Pinnacle 확률 예측 분석" requiredTier="basic">
                                                        <div className="px-4 pb-4 pt-1 animate-fade-up" style={{ background: 'var(--bg-elevated)' }}>
                                                            <div className="text-[10px] text-white/30 mb-2 font-bold uppercase">Pinnacle 역산 확률 예측</div>
                                                            <div className="grid grid-cols-3 gap-3">
                                                                {/* Home Prob */}
                                                                <div>
                                                                    <div className="flex justify-between text-xs mb-1">
                                                                        <span className="text-blue-400 font-semibold">{home} 승</span>
                                                                        <span className="text-white/60 font-bold">{prob.home}%</span>
                                                                    </div>
                                                                    <div className="prob-bar">
                                                                        <div className="prob-bar-fill bg-blue-500" style={{ width: `${prob.home}%` }}></div>
                                                                    </div>
                                                                    {m.has_betman && (
                                                                        <div className="text-[10px] text-white/30 mt-1">
                                                                            베트맨 {fmtOdds(m.home_odds)} / 피나클 {fmtOdds(m.pin_home_odds)}
                                                                            <span className="ml-1 text-white/50">({efficiency(m.home_odds, m.pin_home_odds)}%)</span>
                                                                        </div>
                                                                    )}
                                                                </div>
                                                                {/* Draw Prob */}
                                                                <div>
                                                                    <div className="flex justify-between text-xs mb-1">
                                                                        <span className="text-purple-400 font-semibold">무승부</span>
                                                                        <span className="text-white/60 font-bold">{prob.draw}%</span>
                                                                    </div>
                                                                    <div className="prob-bar">
                                                                        <div className="prob-bar-fill bg-purple-500" style={{ width: `${prob.draw}%` }}></div>
                                                                    </div>
                                                                    {m.has_betman && (
                                                                        <div className="text-[10px] text-white/30 mt-1">
                                                                            베트맨 {fmtOdds(m.draw_odds)} / 피나클 {fmtOdds(m.pin_draw_odds)}
                                                                            <span className="ml-1 text-white/50">({efficiency(m.draw_odds, m.pin_draw_odds)}%)</span>
                                                                        </div>
                                                                    )}
                                                                </div>
                                                                {/* Away Prob */}
                                                                <div>
                                                                    <div className="flex justify-between text-xs mb-1">
                                                                        <span className="text-orange-400 font-semibold">{away} 승</span>
                                                                        <span className="text-white/60 font-bold">{prob.away}%</span>
                                                                    </div>
                                                                    <div className="prob-bar">
                                                                        <div className="prob-bar-fill bg-orange-500" style={{ width: `${prob.away}%` }}></div>
                                                                    </div>
                                                                    {m.has_betman && (
                                                                        <div className="text-[10px] text-white/30 mt-1">
                                                                            베트맨 {fmtOdds(m.away_odds)} / 피나클 {fmtOdds(m.pin_away_odds)}
                                                                            <span className="ml-1 text-white/50">({efficiency(m.away_odds, m.pin_away_odds)}%)</span>
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </PremiumGate>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            ))}
                        </>
                    )}
                </div>

                <div className="mt-2 text-[10px] text-white/20 text-right px-2">
                    배당효율 = 국내배당 ÷ 해외적정배당 × 100% · 100% 이상 = 가치 기회
                </div>
            </main>

            {/* 기능4: 조합 배팅 플로팅 패널 */}
            {selectedBets.size > 0 && (
                <div className="fixed bottom-0 left-0 right-0 z-50 glass-heavy border-t border-[rgba(0,212,255,0.2)] shadow-2xl animate-fade-up" style={{ borderRadius: '16px 16px 0 0' }}>
                    <div className="max-w-7xl mx-auto px-4 py-4">
                        <div className="flex items-center justify-between mb-3">
                            <h3 className="text-sm font-bold text-white flex items-center">
                                🎯 조합 배팅
                                <span className="ml-2 badge badge-value">
                                    {selectedBets.size}경기
                                </span>
                            </h3>
                            <button
                                onClick={() => setSelectedBets(new Map())}
                                className="text-xs text-white/30 hover:text-white/60 transition"
                            >
                                전체 삭제 ✕
                            </button>
                        </div>

                        <div className="flex flex-wrap gap-2 mb-3">
                            {Array.from(selectedBets.entries()).map(([key, val]) => {
                                const parts = val.match.match_name.split(' vs ');
                                return (
                                    <div key={key} className="flex items-center space-x-2 surface-card px-3 py-2 text-xs">
                                        <div>
                                            <span className="text-white/60">{parts[0]} vs {parts[1]}</span>
                                            <span className="ml-2 text-[var(--accent-primary)] font-bold">{betTypeKo(val.type)}</span>
                                        </div>
                                        <span className="text-white font-bold font-mono">{val.odds.toFixed(2)}</span>
                                        <button
                                            onClick={() => {
                                                setSelectedBets(prev => {
                                                    const next = new Map(prev);
                                                    next.delete(key);
                                                    return next;
                                                });
                                            }}
                                            className="text-white/20 hover:text-white/50"
                                        >✕</button>
                                    </div>
                                );
                            })}
                        </div>

                        <div className="flex items-center justify-between">
                            <div>
                                <span className="text-xs text-white/40">합산 배당</span>
                                <span className="text-lg font-black gradient-text ml-2 font-mono">{comboOdds.toFixed(2)}</span>
                                <span className="text-xs text-white/30 ml-3">
                                    10,000원 → <span className="text-white/60 font-bold">{(comboOdds * 10000).toLocaleString()}원</span>
                                </span>
                            </div>
                            <button
                                onClick={handleSaveCombo}
                                disabled={saving || selectedBets.size < 2}
                                className={`btn-primary text-sm px-6 py-2.5 animate-pulse-glow ${saving ? 'opacity-50' : ''}`}
                            >
                                {saving ? '저장 중...' : '💾 조합 저장 →'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
