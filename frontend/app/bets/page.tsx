
"use client";
import React, { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import DeadlineBanner from '../components/DeadlineBanner';
import Navbar from '../components/Navbar';
import PageHeader from '../components/PageHeader';
import PremiumGate from '../components/PremiumGate';
import { useCart } from '../../context/CartContext';
import OnboardingTour, { TourRestartButton } from '../components/OnboardingTour';
import { betsTourSteps } from '../lib/tourSteps';
import { useDictionarySafe } from '../context/DictionaryContext';

/* ───── Types ───── */
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

interface AIPrediction {
    match_id: string;
    confidence: number;
    recommendation: string;
    home_win_prob: number;
    draw_prob: number;
    away_win_prob: number;
    factors: { name: string; weight: number; score: number; detail: string }[];
    team_home?: string;
    team_away?: string;
    team_home_ko?: string;
    team_away_ko?: string;
    league?: string;
    sport?: string;
    match_time?: string;
    engine?: string;
}

interface AIResponse {
    predictions: AIPrediction[];
    data_sources: string[];
    total_matches: number;
}

type BetType = 'Home' | 'Draw' | 'Away';

/* ───── Helpers ───── */
const fmtOdds = (v: number) => (v > 1 ? v.toFixed(2) : '-');
const formatTime = (iso: string) => {
    if (!iso) return '';
    try {
        const d = new Date(iso);
        if (isNaN(d.getTime())) return '';
        return d.toLocaleString(undefined, { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false });
    } catch { return ''; }
};

const getConfidenceLevel = (confidence: number) => {
    if (confidence >= 85) return { label: '강력 시그널', color: '#ef4444', bg: 'rgba(239,68,68,0.15)', glow: 'rgba(239,68,68,0.4)', icon: '🔴' };
    if (confidence >= 70) return { label: '양호', color: '#10b981', bg: 'rgba(16,185,129,0.12)', glow: 'rgba(16,185,129,0.3)', icon: '🟢' };
    if (confidence >= 55) return { label: '참고', color: '#3b82f6', bg: 'rgba(59,130,246,0.12)', glow: 'rgba(59,130,246,0.3)', icon: '🔵' };
    return { label: '중립', color: '#6b7280', bg: 'rgba(107,114,128,0.12)', glow: 'rgba(107,114,128,0.2)', icon: '⚪' };
};

const getRecommendationKo = (rec: string) => {
    if (rec === 'HOME') return '홈 승';
    if (rec === 'AWAY') return '원정 승';
    return '무승부';
};

/* Animated counter hook */
function useCountUp(end: number, duration = 1200) {
    const [value, setValue] = useState(0);
    useEffect(() => {
        let start = 0;
        const startTime = performance.now();
        const animate = (now: number) => {
            const elapsed = now - startTime;
            const progress = Math.min(elapsed / duration, 1);
            const eased = 1 - Math.pow(1 - progress, 3);
            setValue(Math.round(start + (end - start) * eased));
            if (progress < 1) requestAnimationFrame(animate);
        };
        requestAnimationFrame(animate);
    }, [end, duration]);
    return value;
}

/* ───── Sub-components ───── */

/* Donut probability chart */
function ProbDonut({ home, draw, away, size = 90 }: { home: number; draw: number; away: number; size?: number }) {
    const total = home + draw + away || 1;
    const r = (size - 10) / 2;
    const cx = size / 2;
    const cy = size / 2;
    const circumference = 2 * Math.PI * r;

    const homeArc = (home / total) * circumference;
    const drawArc = (draw / total) * circumference;
    const awayArc = (away / total) * circumference;

    return (
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ transform: 'rotate(-90deg)' }}>
            {/* Background */}
            <circle cx={cx} cy={cy} r={r} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="8" />
            {/* Home */}
            <circle cx={cx} cy={cy} r={r} fill="none" stroke="#3b82f6" strokeWidth="8"
                strokeDasharray={`${homeArc} ${circumference - homeArc}`} strokeDashoffset="0"
                style={{ transition: 'stroke-dasharray 1s ease-out' }} />
            {/* Draw */}
            <circle cx={cx} cy={cy} r={r} fill="none" stroke="#a855f7" strokeWidth="8"
                strokeDasharray={`${drawArc} ${circumference - drawArc}`} strokeDashoffset={`${-homeArc}`}
                style={{ transition: 'stroke-dasharray 1s ease-out' }} />
            {/* Away */}
            <circle cx={cx} cy={cy} r={r} fill="none" stroke="#f97316" strokeWidth="8"
                strokeDasharray={`${awayArc} ${circumference - awayArc}`} strokeDashoffset={`${-(homeArc + drawArc)}`}
                style={{ transition: 'stroke-dasharray 1s ease-out' }} />
        </svg>
    );
}

/* Confidence gauge bar */
function ConfidenceGauge({ value, label }: { value: number; label?: string }) {
    const level = getConfidenceLevel(value);
    return (
        <div className="w-full">
            <div className="flex justify-between items-center mb-1">
                <span className="text-[10px] text-white/40 uppercase tracking-wider">{label || 'Confidence'}</span>
                <span className="text-sm font-black" style={{ color: level.color }}>{value.toFixed(1)}%</span>
            </div>
            <div className="w-full h-2 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
                <div
                    className="h-full rounded-full"
                    style={{
                        width: `${Math.min(value, 100)}%`,
                        background: `linear-gradient(90deg, ${level.color}88, ${level.color})`,
                        boxShadow: `0 0 12px ${level.glow}`,
                        transition: 'width 1.2s ease-out',
                    }}
                />
            </div>
        </div>
    );
}

/* ───── Main Component ───── */
export default function BetsPage() {
    const [matches, setMatches] = useState<MatchBet[]>([]);
    const [aiPredictions, setAiPredictions] = useState<AIPrediction[]>([]);
    const [dataSources, setDataSources] = useState<string[]>([]);
    const [loading, setLoading] = useState(true);
    const [aiLoading, setAiLoading] = useState(true);
    const [error, setError] = useState('');
    const [selectedBets, setSelectedBets] = useState<Map<string, { match: MatchBet; type: BetType; odds: number }>>(new Map());
    const [expandedCard, setExpandedCard] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);
    const [viewMode, setViewMode] = useState<'ai' | 'odds'>('ai');
    const [selectedSport, setSelectedSport] = useState<string>('ALL');
    const { addToCart, removeFromCart, cartItems } = useCart();
    const router = useRouter();
    const [tourForceStart, setTourForceStart] = useState(false);
    const dict = useDictionarySafe();
    const tb = dict?.bets || {};
    const tc = dict?.common || {};

    const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || '';

    /* Fetch odds data */
    const fetchBets = async () => {
        setLoading(true);
        setError('');
        try {
            const res = await fetch(`${API_BASE_URL}/api/bets`, { cache: 'no-store' });
            if (!res.ok) throw new Error('Failed to fetch');
            setMatches(await res.json());
        } catch { setError(tb.errorFetch || '데이터 로딩 실패'); }
        finally { setLoading(false); }
    };

    /* Fetch AI predictions */
    const fetchAIPredictions = async () => {
        setAiLoading(true);
        try {
            const res = await fetch(`${API_BASE_URL}/api/ai/predictions`, { cache: 'no-store' });
            if (!res.ok) throw new Error('Failed to fetch AI predictions');
            const data: AIResponse = await res.json();
            setAiPredictions(data.predictions || []);
            setDataSources(data.data_sources || []);
        } catch { console.warn('AI 예측 불가'); }
        finally { setAiLoading(false); }
    };

    useEffect(() => { fetchBets(); fetchAIPredictions(); }, []);

    /* ── Sport filter tabs (same as Market page) ── */
    const sportTabs = useMemo(() => {
        const iconMap: Record<string, string> = { SOCCER: '⚽', BASKETBALL: '🏀', BASEBALL: '⚾', ICEHOCKEY: '🏒' };
        const labelMap: Record<string, string> = { SOCCER: tc.soccer || 'Soccer', BASKETBALL: tc.basketball || 'Basketball', BASEBALL: tc.baseball || 'Baseball', ICEHOCKEY: tc.hockey || 'Ice Hockey' };
        const counts: Record<string, number> = {};
        aiPredictions.forEach(p => {
            const key = (p.sport || 'SOCCER').toUpperCase();
            counts[key] = (counts[key] || 0) + 1;
        });
        return ['SOCCER', 'BASKETBALL', 'BASEBALL', 'ICEHOCKEY']
            .map(s => ({ key: s, icon: iconMap[s] || '🏟️', label: labelMap[s] || s, count: counts[s] || 0 }));
    }, [aiPredictions]);

    /* Sport-filtered predictions */
    const sportFilteredPredictions = useMemo(() => {
        if (selectedSport === 'ALL') return aiPredictions;
        return aiPredictions.filter(p => (p.sport || 'soccer').toUpperCase() === selectedSport);
    }, [aiPredictions, selectedSport]);

    /* Create a prediction map for quick lookup */
    const predictionMap = useMemo(() => {
        const map = new Map<string, AIPrediction>();
        sportFilteredPredictions.forEach(p => map.set(p.match_id, p));
        return map;
    }, [sportFilteredPredictions]);

    /* Sport-filtered odds/matches */
    const sportFilteredMatches = useMemo(() => {
        if (selectedSport === 'ALL') return matches;
        return matches.filter(m => {
            const league = (m.league || '').toLowerCase();
            if (selectedSport === 'SOCCER') return !league.includes('nba') && !league.includes('nhl') && !league.includes('mlb') && !league.includes('kbl') && !league.includes('basket');
            if (selectedSport === 'BASKETBALL') return league.includes('nba') || league.includes('kbl') || league.includes('basket');
            if (selectedSport === 'BASEBALL') return league.includes('mlb') || league.includes('kbo') || league.includes('npb');
            if (selectedSport === 'ICEHOCKEY') return league.includes('nhl') || league.includes('hockey');
            return true;
        });
    }, [matches, selectedSport]);

    /* Top AI picks — sorted by confidence */
    const topPicks = useMemo(() => {
        return [...sportFilteredPredictions]
            .filter(p => p.confidence >= 60)
            .sort((a, b) => b.confidence - a.confidence)
            .slice(0, 3);
    }, [sportFilteredPredictions]);

    /* Stats (based on sport-filtered) */
    const totalMatches = sportFilteredPredictions.length;
    const strongPicks = sportFilteredPredictions.filter(p => p.confidence >= 70).length;
    const avgConfidence = totalMatches > 0 ? sportFilteredPredictions.reduce((s, p) => s + p.confidence, 0) / totalMatches : 0;
    const isMLEngine = dataSources.some(s => s.includes('LightGBM'));

    /* Animated stats */
    const animatedTotal = useCountUp(totalMatches);
    const animatedStrong = useCountUp(strongPicks);
    const animatedAvg = useCountUp(Math.round(avgConfidence));

    /* Toggle bet selection */
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

    /* Save combo */
    const handleSaveCombo = async () => {
        const token = localStorage.getItem('token');
        if (!token) {
            if (confirm(tb.loginRequired || 'Login required. Proceed to login?')) router.push('/login');
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
            const res = await fetch(`${API_BASE_URL}/api/portfolio/slip/save`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({ items, stake: 10000, total_odds: totalOdds, potential_return: Math.floor(10000 * totalOdds) }),
            });
            if (res.ok) { alert(tb.comboSaved || 'Combination saved! 💾'); setSelectedBets(new Map()); }
            else { const err = await res.json(); alert((tb.saveFailed || 'Save failed') + ': ' + (err.detail || '')); }
        } catch { alert(tb.networkError || 'Network error'); }
        finally { setSaving(false); }
    };

    const comboOdds = useMemo(() => {
        if (selectedBets.size === 0) return 0;
        let prod = 1;
        selectedBets.forEach(v => { prod *= v.odds; });
        return Math.round(prod * 100) / 100;
    }, [selectedBets]);

    const betTypeLabel = (t: string) => t === 'Home' ? (tb.homeWin || '홈 승') : t === 'Draw' ? (tb.draw || '무승부') : (tb.awayWin || '원정 승');
    const isSelected = (matchId: string, type: BetType) => selectedBets.has(`${matchId}-${type}`);

    return (
        <>
            <div className="min-h-screen flex flex-col" style={{ background: 'var(--bg-primary)' }}>
                <DeadlineBanner />
                <Navbar />

                <main className="flex-grow max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-4 w-full">
                    <PageHeader 
                        title="데이터 추세 분석 (Value Analytics)" 
                        description="해외 주요 스프레드 시장의 흐름과 통계적 괴리를 추적합니다. 머신러닝 알고리즘이 산출한 통계적 확률과 현재 시장의 지표 차이를 비교하여 수학적으로 유리한 분석 모델을 탐색하고 저장해 보세요." 
                        icon="📊" 
                    />

                    {/* ━━━ AI ENGINE HERO ━━━ */}
                    <div data-tour="tour-bets-intro" className="relative overflow-hidden rounded-2xl mb-6" style={{
                        background: 'linear-gradient(135deg, rgba(0,212,255,0.08) 0%, rgba(139,92,246,0.08) 50%, rgba(239,68,68,0.05) 100%)',
                        border: '1px solid rgba(0,212,255,0.15)',
                    }}>
                        {/* Background glow */}
                        <div className="absolute top-0 right-0 w-64 h-64 rounded-full opacity-20"
                            style={{ background: 'radial-gradient(circle, rgba(0,212,255,0.4), transparent 70%)', filter: 'blur(60px)' }} />
                        <div className="absolute bottom-0 left-0 w-48 h-48 rounded-full opacity-15"
                            style={{ background: 'radial-gradient(circle, rgba(139,92,246,0.4), transparent 70%)', filter: 'blur(50px)' }} />

                        <div className="relative z-10 p-5 sm:p-6">
                            {/* Engine badge */}
                            <div className="flex items-center justify-between mb-4">
                                <div className="flex items-center space-x-3">
                                    <div className="w-10 h-10 rounded-xl flex items-center justify-center"
                                        style={{ background: 'linear-gradient(135deg, #00d4ff, #8b5cf6)' }}>
                                        <span className="text-xl">🧠</span>
                                    </div>
                                    <div>
                                        <h1 className="text-lg sm:text-xl font-black text-white">{tb.aiEngine || 'AI Simulation Engine'}</h1>
                                        <div className="flex items-center space-x-2 mt-0.5">
                                            {isMLEngine ? (
                                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                                                    style={{ background: 'rgba(16,185,129,0.15)', color: '#10b981' }}>
                                                    ● LightGBM LIVE
                                                </span>
                                            ) : (
                                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                                                    style={{ background: 'rgba(245,158,11,0.15)', color: '#f59e0b' }}>
                                                    {tb.aiEngine || 'AI 시뮬레이션 엔진'}
                                                </span>
                                            )}
                                            <span className="text-[10px] text-white/30">28 Features · {tc.realtime || 'Live'}</span>
                                        </div>
                                    </div>
                                </div>
                                <button onClick={() => { fetchBets(); fetchAIPredictions(); }}
                                    className="text-xs px-4 py-2 rounded-xl font-bold transition-all hover:scale-105"
                                    style={{ background: 'rgba(0,212,255,0.1)', color: '#00d4ff', border: '1px solid rgba(0,212,255,0.2)' }}>
                                    {loading || aiLoading ? (tb.analyzing || '분석 중...') : `🔄 ${tb.refresh || '새로고침'}`}
                                </button>
                            </div>

                            {/* Stats row */}
                            <div className="grid grid-cols-3 gap-3 mb-4">
                                <div className="text-center p-3 rounded-xl" style={{ background: 'rgba(255,255,255,0.03)' }}>
                                    <div className="text-2xl sm:text-3xl font-black gradient-text">{animatedTotal}</div>
                                    <div className="text-[10px] text-white/40 mt-1">{tb.analyzedMatches || '분석 완료'}</div>
                                </div>
                                <div className="text-center p-3 rounded-xl" style={{ background: 'rgba(255,255,255,0.03)' }}>
                                    <div className="text-2xl sm:text-3xl font-black" style={{ color: '#10b981' }}>{animatedStrong}</div>
                                    <div className="text-[10px] text-white/40 mt-1">{tb.recommended || '추천'}</div>
                                </div>
                                <div className="text-center p-3 rounded-xl" style={{ background: 'rgba(255,255,255,0.03)' }}>
                                    <div className="text-2xl sm:text-3xl font-black" style={{ color: '#00d4ff' }}>{animatedAvg}%</div>
                                    <div className="text-[10px] text-white/40 mt-1">{tb.avgConfidence || '평균 신뢰도'}</div>
                                </div>
                            </div>

                            {/* Learning badge */}
                            <div className="flex items-center space-x-2 text-[11px] text-white/30">
                                <span>📚</span>
                                <span>8,960+ {tb.gamesLearned || 'matches trained'}</span>
                                <span className="w-1 h-1 rounded-full bg-white/20" />
                                <span>{tb.autoRetrain || 'Auto-retrain daily 03:00'}</span>
                                <span className="w-1 h-1 rounded-full bg-white/20" />
                                <span>Data: {dataSources.join(' · ') || 'Loading...'}</span>
                            </div>
                            {/* Compliance disclaimer */}
                            <div className="mt-3 text-[10px] text-white/20 leading-relaxed border-t border-white/5 pt-2">
                                ⚠️ 본 페이지의 모든 수치와 시뮬레이션 결과는 과거 통계를 기반으로 한 학술적 연구 목적의 데이터이며, 어떠한 형태의 도박이나 기타 사행성 행위를 권유하지 않습니다.
                            </div>

                            {/* AI Analytics Explanation */}
                            <div className="mt-4 p-3 rounded-lg flex flex-col gap-2 bg-white/5 border border-white/10">
                                <h3 className="text-sm font-bold text-white flex items-center gap-1">
                                    <span>💡</span> AI 데이터 분석 가이드
                                </h3>
                                <ul className="text-xs text-white/50 space-y-1">
                                    <li><strong className="text-white/80">핵심 분석 요소:</strong> 배당 변동률, 라이브업/결장자 정보, 양팀 상대 전적 및 최근 기세 등 예측에 큰 영향을 미친 요소들을 백분율(%)로 표기합니다. 이 수치가 높을수록 해당 요소가 경기 분석에 강하게 반영되었음을 뜻합니다.</li>
                                    <li><strong className="text-white/80">종합 신뢰도:</strong> AI 엔진이 산출한 승무패 확률과 해외 마켓 배당 사이의 '가치 괴리(Value Edge)'를 측정합니다. <br/>(🔴 강력 시그널: 85% 이상 / 🟢 양호: 70% 이상 / 🔵 참고: 55% 이상)</li>
                                    <li><strong className="text-white/80">효율(%):</strong> 해당 분석 방향을 선택했을 때 수학적으로 기대할 수 있는 초과 효율 비율(Expected Value, 계산상 + 구간)을 의미합니다.</li>
                                </ul>
                            </div>
                        </div>
                    </div>

                    {/* ━━━ TOP PICKS HERO ━━━ */}
                    {topPicks.length > 0 && (
                        <div className="mb-6">
                            <h2 className="text-sm font-bold text-white/60 uppercase tracking-wider mb-3 flex items-center">
                                <span className="w-1 h-5 rounded-full mr-2" style={{ background: 'linear-gradient(to bottom, #ef4444, #f97316)' }} />
                                🔥 {tb.topPick || '오늘의 AI 분석 하이라이트'}
                            </h2>
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                {topPicks.map((pick, i) => {
                                    const level = getConfidenceLevel(pick.confidence);
                                    const parts = pick.match_id.split('_');
                                    const homeEng = pick.team_home || parts[0] || '';
                                    const awayEng = pick.team_away || parts.slice(1).join(' ') || '';
                                    const home = pick.team_home_ko ? `${pick.team_home_ko} (${homeEng})` : homeEng;
                                    const away = pick.team_away_ko ? `${pick.team_away_ko} (${awayEng})` : awayEng;
                                    return (
                                        <div key={i} className="relative overflow-hidden rounded-2xl transition-all hover:scale-[1.02] cursor-pointer group"
                                            style={{
                                                background: 'var(--bg-card)',
                                                border: `1px solid ${level.color}33`,
                                                boxShadow: i === 0 ? `0 0 30px ${level.glow}` : 'none',
                                            }}>
                                            {/* Top rank badge */}
                                            {i === 0 && (
                                                <div className="absolute top-0 right-0 px-3 py-1 rounded-bl-xl text-[10px] font-black"
                                                    style={{ background: level.color, color: 'white' }}>
                                                    #1 Focus
                                                </div>
                                            )}
                                            <div className="p-4">
                                                <div className="flex items-start justify-between mb-3">
                                                    <div className="flex-1">
                                                        <div className="text-[10px] text-white/30 mb-1">{pick.league || ''}</div>
                                                        <div className="text-sm font-bold text-white">{home}</div>
                                                        <div className="text-xs text-white/40">vs {away}</div>
                                                    </div>
                                                    <div className="flex flex-col items-center">
                                                        <ProbDonut home={pick.home_win_prob} draw={pick.draw_prob} away={pick.away_win_prob} size={64} />
                                                    </div>
                                                </div>

                                                {/* Recommendation */}
                                                <div className="flex items-center justify-between">
                                                    <div className="flex items-center space-x-2">
                                                        <span className="text-xs font-black px-2.5 py-1 rounded-lg"
                                                            style={{ background: level.bg, color: level.color }}>
                                                            {level.icon} {getRecommendationKo(pick.recommendation)}
                                                        </span>
                                                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                                                            style={{ background: level.bg, color: level.color }}>
                                                            {level.label}
                                                        </span>
                                                    </div>
                                                    <div className="text-right">
                                                        <div className="text-lg font-black" style={{ color: level.color }}>
                                                            {pick.confidence.toFixed(1)}%
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* ━━━ SPORT FILTER + VIEW TOGGLE ━━━ */}
                    <div data-tour="tour-bets-filter" className="flex flex-wrap items-center gap-2 mb-4">
                        <button
                            onClick={() => setSelectedSport('ALL')}
                            className={`px-3 py-1.5 text-xs font-bold rounded-full transition-all flex items-center gap-1.5 ${selectedSport === 'ALL' ? 'text-white shadow-md shadow-cyan-500/20' : 'border border-white/10 hover:border-white/20'}`}
                            style={selectedSport === 'ALL' ? { background: 'var(--accent-primary)' } : { background: 'var(--bg-card)', color: 'var(--text-secondary)' }}
                        >
                            🏆 {tc.filterAll || '전체'} <span className="ml-0.5 opacity-70">{aiPredictions.length}</span>
                        </button>
                        {sportTabs.map(tab => (
                            <button
                                key={tab.key}
                                onClick={() => setSelectedSport(tab.key)}
                                className={`px-3 py-1.5 text-xs font-bold rounded-full transition-all flex items-center gap-1.5 ${selectedSport === tab.key ? 'text-white shadow-md shadow-cyan-500/20' : 'border border-white/10 hover:border-white/20'} ${tab.count === 0 ? 'opacity-50' : ''}`}
                                style={selectedSport === tab.key ? { background: 'var(--accent-primary)' } : { background: 'var(--bg-card)', color: 'var(--text-secondary)' }}
                            >
                                {tab.icon} {tab.label} {tab.count > 0
                                    ? <span className="ml-0.5 opacity-70">{tab.count}</span>
                                    : <span className="ml-0.5 text-[9px] px-1 py-0.5 rounded bg-white/5" style={{ color: 'var(--text-muted)' }}>OFF</span>
                                }
                            </button>
                        ))}
                        <button onClick={() => { fetchBets(); fetchAIPredictions(); }}
                            className="px-3 py-1.5 text-xs rounded-full flex items-center ml-1 border border-white/10 hover:border-white/20 transition"
                            style={{ background: 'var(--bg-card)', color: 'var(--text-secondary)' }}
                        >
                            {loading || aiLoading ? (tb.analyzing || '분석 중...') : `🔄 ${tb.refresh || '새로고침'}`}
                        </button>
                    </div>

                    {/* ━━━ VIEW TOGGLE ━━━ */}
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center rounded-xl overflow-hidden" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)' }}>
                            <button
                                onClick={() => setViewMode('ai')}
                                className={`px-4 py-2 text-xs font-bold transition-all ${viewMode === 'ai' ? 'text-white' : 'text-white/30 hover:text-white/50'}`}
                                style={viewMode === 'ai' ? { background: 'rgba(0,212,255,0.15)', color: '#00d4ff' } : {}}>
                                🧠 {tb.aiPrediction || 'AI 시뮬레이션'}
                            </button>
                            <button
                                onClick={() => setViewMode('odds')}
                                className={`px-4 py-2 text-xs font-bold transition-all ${viewMode === 'odds' ? 'text-white' : 'text-white/30 hover:text-white/50'}`}
                                style={viewMode === 'odds' ? { background: 'rgba(139,92,246,0.15)', color: '#8b5cf6' } : {}}>
                                📊 {tb.oddsCompare || '배당률 비교'}
                            </button>
                        </div>
                        <div className="text-[10px] text-white/20">
                            {totalMatches} {tb.matchesAnalyzed || '경기 분석 완료'}
                        </div>
                    </div>

                    {error && (
                        <div className="p-3 rounded-xl text-red-400 text-sm mb-4" style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)' }}>
                            {error}
                        </div>
                    )}

                    {/* ━━━ AI PREDICTION CARDS VIEW ━━━ */}
                    {viewMode === 'ai' && (
                        <div>
                            {aiLoading && aiPredictions.length === 0 ? (
                                <div className="py-20 text-center text-white/40">
                                    <div className="animate-spin inline-block w-10 h-10 border-2 border-white/10 border-t-[var(--accent-primary)] rounded-full mb-4" />
                                    <p className="text-sm">{tb.aiAnalyzing || 'AI 시뮬레이션 분석 중...'}</p>
                                    <p className="text-[10px] text-white/20 mt-1">{tb.aiAnalyzingDetail || 'LightGBM 모델이 각 경기 데이터를 시뮬레이션하고 있습니다'}</p>
                                </div>
                            ) : sportFilteredPredictions.length === 0 ? (
                                <div className="py-20 text-center text-white/30 rounded-2xl" style={{ background: 'var(--bg-card)' }}>
                                    <div className="text-4xl mb-3">🧠</div>
                                    <p>{tb.noMatches || '분석 가능한 경기가 없습니다'}</p>
                                    <p className="text-xs text-white/20 mt-1">{tb.noMatchesDetail || '경기 데이터가 수집되면 자동으로 AI 시뮬레이션이 시작됩니다'}</p>
                                </div>
                            ) : (
                                <div data-tour="tour-bets-table" className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {sportFilteredPredictions.map((pred, idx) => {
                                        const level = getConfidenceLevel(pred.confidence);
                                        const parts = pred.match_id.split('_');
                                        const homeEng = pred.team_home || parts[0] || '';
                                        const awayEng = pred.team_away || parts.slice(1).join(' ') || '';
                                        const home = pred.team_home_ko ? `${pred.team_home_ko} (${homeEng})` : homeEng;
                                        const away = pred.team_away_ko ? `${pred.team_away_ko} (${awayEng})` : awayEng;
                                        const matchKey = `ai-${idx}`;
                                        const isExpanded = expandedCard === matchKey;

                                        /* Find matching odds data */
                                        const oddsMatch = matches.find(m => {
                                            const mp = m.match_name.split(' vs ');
                                            return mp[0] === home || mp[1] === away || m.match_name.includes(home);
                                        });

                                        /* Calculate expected value if we have odds */
                                        let ev = 0;
                                        if (oddsMatch) {
                                            const recProb = pred.recommendation === 'HOME' ? pred.home_win_prob :
                                                pred.recommendation === 'AWAY' ? pred.away_win_prob : pred.draw_prob;
                                            const recOdds = pred.recommendation === 'HOME' ? oddsMatch.home_odds :
                                                pred.recommendation === 'AWAY' ? oddsMatch.away_odds : oddsMatch.draw_odds;
                                            if (recOdds > 1) {
                                                ev = ((recProb / 100) * recOdds - 1) * 100;
                                            }
                                        }

                                        return (
                                            <div key={idx} className="rounded-2xl overflow-hidden transition-all hover:translate-y-[-2px]"
                                                style={{
                                                    background: 'var(--bg-card)',
                                                    border: `1px solid ${pred.confidence >= 70 ? level.color + '22' : 'var(--border-subtle)'}`,
                                                    boxShadow: pred.confidence >= 80 ? `0 4px 20px ${level.glow}` : 'none',
                                                }}>

                                                {/* Card header */}
                                                <div className="p-4 pb-0">
                                                    <div className="flex items-center justify-between mb-1">
                                                        <div className="flex items-center space-x-2">
                                                            <span className="text-[10px] text-white/30">{pred.league || ''}</span>
                                                            {pred.match_time && <span className="text-[10px] text-white/20">{formatTime(pred.match_time)}</span>}
                                                        </div>
                                                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                                                            style={{ background: level.bg, color: level.color }}>
                                                            {level.icon} {level.label}
                                                        </span>
                                                    </div>

                                                    {/* Teams */}
                                                    <div className="flex items-center justify-between mt-2">
                                                        <div className="flex-1">
                                                            <div className={`text-base font-bold ${pred.recommendation === 'HOME' ? 'text-white' : 'text-white/60'}`}>
                                                                {home}
                                                                {pred.recommendation === 'HOME' && (
                                                                    <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded" style={{ background: level.bg, color: level.color }}>Focus</span>
                                                                )}
                                                            </div>
                                                            <div className={`text-sm mt-0.5 ${pred.recommendation === 'AWAY' ? 'text-white font-bold' : 'text-white/40'}`}>
                                                                vs {away}
                                                                {pred.recommendation === 'AWAY' && (
                                                                    <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded" style={{ background: level.bg, color: level.color }}>Focus</span>
                                                                )}
                                                            </div>
                                                        </div>
                                                        <ProbDonut home={pred.home_win_prob} draw={pred.draw_prob} away={pred.away_win_prob} size={72} />
                                                    </div>
                                                </div>

                                                {/* Probability bars */}
                                                <div className="px-4 py-3">
                                                    <div className="space-y-2">
                                                        {/* Home */}
                                                        <div className="flex items-center space-x-3">
                                                            <span className="text-[10px] font-bold text-blue-400 w-6 text-right">{tb.homeShort || '홈'}</span>
                                                            <div className="flex-1 h-2.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.05)' }}>
                                                                <div className="h-full rounded-full bg-blue-500"
                                                                    style={{ width: `${pred.home_win_prob}%`, transition: 'width 1s ease-out', boxShadow: pred.recommendation === 'HOME' ? '0 0 8px rgba(59,130,246,0.5)' : 'none' }} />
                                                            </div>
                                                            <span className={`text-xs font-bold w-10 text-right ${pred.recommendation === 'HOME' ? 'text-blue-400' : 'text-white/40'}`}>
                                                                {pred.home_win_prob.toFixed(1)}%
                                                            </span>
                                                        </div>
                                                        {/* Draw */}
                                                        <div className="flex items-center space-x-3">
                                                            <span className="text-[10px] font-bold text-purple-400 w-6 text-right">{tb.drawShort || '무'}</span>
                                                            <div className="flex-1 h-2.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.05)' }}>
                                                                <div className="h-full rounded-full bg-purple-500"
                                                                    style={{ width: `${pred.draw_prob}%`, transition: 'width 1s ease-out', boxShadow: pred.recommendation === 'DRAW' ? '0 0 8px rgba(168,85,247,0.5)' : 'none' }} />
                                                            </div>
                                                            <span className={`text-xs font-bold w-10 text-right ${pred.recommendation === 'DRAW' ? 'text-purple-400' : 'text-white/40'}`}>
                                                                {pred.draw_prob.toFixed(1)}%
                                                            </span>
                                                        </div>
                                                        {/* Away */}
                                                        <div className="flex items-center space-x-3">
                                                            <span className="text-[10px] font-bold text-orange-400 w-6 text-right">{tb.awayShort || '원'}</span>
                                                            <div className="flex-1 h-2.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.05)' }}>
                                                                <div className="h-full rounded-full bg-orange-500"
                                                                    style={{ width: `${pred.away_win_prob}%`, transition: 'width 1s ease-out', boxShadow: pred.recommendation === 'AWAY' ? '0 0 8px rgba(249,115,22,0.5)' : 'none' }} />
                                                            </div>
                                                            <span className={`text-xs font-bold w-10 text-right ${pred.recommendation === 'AWAY' ? 'text-orange-400' : 'text-white/40'}`}>
                                                                {pred.away_win_prob.toFixed(1)}%
                                                            </span>
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Confidence + EV + action row */}
                                                <div className="px-4 pb-3">
                                                    <ConfidenceGauge value={pred.confidence} label={tb.confidence || '신뢰도'} />

                                                    <div className="flex items-center justify-between mt-3">
                                                        <div className="flex items-center space-x-3">
                                                            {/* Efficiency index badge */}
                                                            {ev !== 0 && (
                                                                <span className={`text-[11px] font-bold px-2 py-0.5 rounded-lg ${ev > 0 ? 'text-green-400' : 'text-red-400'}`}
                                                                    style={{ background: ev > 0 ? 'rgba(16,185,129,0.12)' : 'rgba(239,68,68,0.1)' }}>
                                                                    효율 {ev > 0 ? '+' : ''}{ev.toFixed(1)}%
                                                                </span>
                                                            )}
                                                            {/* Odds badge if available */}
                                                            {oddsMatch && (
                                                                <span className="text-[10px] text-white/30">
                                                                    {tb.odds || '배당률'} {fmtOdds(pred.recommendation === 'HOME' ? oddsMatch.home_odds :
                                                                        pred.recommendation === 'AWAY' ? oddsMatch.away_odds : oddsMatch.draw_odds)}
                                                                </span>
                                                            )}
                                                        </div>
                                                        <button
                                                            onClick={() => setExpandedCard(isExpanded ? null : matchKey)}
                                                            className="text-[10px] font-bold px-3 py-1.5 rounded-lg transition-all"
                                                            style={{ background: isExpanded ? 'rgba(0,212,255,0.12)' : 'rgba(255,255,255,0.04)', color: isExpanded ? '#00d4ff' : 'rgba(255,255,255,0.4)' }}>
                                                            {isExpanded ? `${tb.collapse || '접기'} ▲` : `${tb.expand || '더보기'} ▼`}
                                                        </button>
                                                    </div>
                                                </div>

                                                {/* Expandable detail panel */}
                                                {isExpanded && (
                                                    <PremiumGate featureName={tb.aiDetailAnalysis || 'AI Detailed Analysis'} requiredTier="pro">
                                                        <div className="px-4 pb-4 pt-1" style={{ background: 'var(--bg-elevated)', borderTop: '1px solid var(--border-subtle)' }}>

                                                            {/* Top factors */}
                                                            {pred.factors && pred.factors.length > 0 && (
                                                                <div className="mb-3">
                                                                    <div className="text-[10px] text-white/30 font-bold uppercase tracking-wider mb-2">{tb.aiFactors || 'AI 분석 요소'}</div>
                                                                    <div className="space-y-2">
                                                                        {pred.factors.slice(0, 4).map((f, fi) => (
                                                                            <div key={fi} className="flex items-center justify-between">
                                                                                <div className="flex items-center space-x-2 flex-1">
                                                                                    <span className="text-[10px] font-bold text-white/50 w-5">#{fi + 1}</span>
                                                                                    <span className="text-xs text-white/70">{f.name}</span>
                                                                                </div>
                                                                                <div className="flex items-center space-x-2">
                                                                                    <div className="w-20 h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.05)' }}>
                                                                                        <div className="h-full rounded-full" style={{
                                                                                            width: `${Math.min(Math.abs(f.score || f.weight * 10), 100)}%`,
                                                                                            background: 'var(--accent-gradient)',
                                                                                        }} />
                                                                                    </div>
                                                                                    <span className="text-[10px] text-white/40 w-8 text-right">{f.score || Math.round(f.weight * 100)}%</span>
                                                                                </div>
                                                                            </div>
                                                                        ))}
                                                                    </div>
                                                                </div>
                                                            )}

                                                            {/* Match odds for betting */}
                                                            {oddsMatch && (
                                                                <div>
                                                                    <div className="text-[10px] text-white/30 font-bold uppercase tracking-wider mb-2">{tb.betSelection || '분석 선택'}</div>
                                                                    <div className="grid grid-cols-3 gap-2">
                                                                        {(['Home', 'Draw', 'Away'] as BetType[]).map(type => {
                                                                            const odds = type === 'Home' ? oddsMatch.home_odds : type === 'Draw' ? oddsMatch.draw_odds : oddsMatch.away_odds;
                                                                            const aiProb = type === 'Home' ? pred.home_win_prob : type === 'Draw' ? pred.draw_prob : pred.away_win_prob;
                                                                            const isRec = pred.recommendation === type.toUpperCase();
                                                                            return (
                                                                                <button key={type}
                                                                                    onClick={() => toggleBet(matchKey, oddsMatch, type)}
                                                                                    className={`p-2.5 rounded-xl text-center transition-all ${isSelected(matchKey, type) ? 'ring-2' : 'hover:bg-white/5'}`}
                                                                                    style={{
                                                                                        background: isSelected(matchKey, type) ? 'rgba(0,212,255,0.1)' : 'rgba(255,255,255,0.03)',
                                                                                        border: isRec ? `1px solid ${level.color}44` : '1px solid transparent',
                                                                                        outline: isSelected(matchKey, type) ? '2px solid var(--accent-primary)' : 'none',
                                                                                        outlineOffset: '-2px',
                                                                                    }}>
                                                                                    <div className="text-[10px] text-white/40">{betTypeLabel(type)}</div>
                                                                                    <div className="text-sm font-black text-white mt-0.5">{fmtOdds(odds)}</div>
                                                                                    <div className="text-[10px] mt-0.5" style={{ color: isRec ? level.color : 'rgba(255,255,255,0.3)' }}>
                                                                                        {aiProb.toFixed(1)}%
                                                                                    </div>
                                                                                </button>
                                                                            );
                                                                        })}
                                                                    </div>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </PremiumGate>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    )}

                    {/* ━━━ ODDS COMPARISON VIEW (existing bet365 style) ━━━ */}
                    {viewMode === 'odds' && (
                        <div className="rounded-2xl overflow-hidden" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}>
                            {loading && matches.length === 0 ? (
                                <div className="py-20 text-center text-white/40">
                                    <div className="animate-spin inline-block w-8 h-8 border-2 border-white/10 border-t-[var(--accent-primary)] rounded-full mb-3" />
                                    <p>{tb.oddsAnalyzing || '배당률 데이터 분석 중...'}</p>
                                </div>
                            ) : matches.length === 0 ? (
                                <div className="py-20 text-center text-white/30">{tb.noMatches || '분석 가능한 경기가 없습니다'}</div>
                            ) : (
                                <>
                                    {/* Table Header */}
                                    <div className="grid grid-cols-[40px_1fr_80px_80px_80px_60px] sm:grid-cols-[50px_1fr_100px_100px_100px_70px] text-[11px] font-bold text-white/40 uppercase border-b border-white/5 px-2"
                                        style={{ background: 'rgba(255,255,255,0.02)' }}>
                                        <div className="py-2.5 text-center">#</div>
                                        <div className="py-2.5 pl-2">{tb.match || '경기'}</div>
                                        <div className="py-2.5 text-center">1</div>
                                        <div className="py-2.5 text-center">X</div>
                                        <div className="py-2.5 text-center">2</div>
                                        <div className="py-2.5 text-center">AI</div>
                                    </div>

                                    {sportFilteredMatches.map((m, idx) => {
                                        const parts = m.match_name.split(' vs ');
                                        const home = parts[0] || '';
                                        const away = parts[1] || '';
                                        const matchId = `odds-${idx}`;
                                        const aiPred = predictionMap.get(`${home}_${away}`) || predictionMap.get(m.match_name);

                                        return (
                                            <div key={idx} className="border-b border-white/5 last:border-0">
                                                <div className={`grid grid-cols-[40px_1fr_80px_80px_80px_60px] sm:grid-cols-[50px_1fr_100px_100px_100px_70px] items-center px-2 transition hover:bg-white/[0.02] ${m.has_betman ? '' : 'opacity-50'}`}>
                                                    <div className="py-3 text-center text-[11px] text-white/20 font-mono">{idx + 1}</div>
                                                    <div className="py-3 pl-2">
                                                        <div className="flex items-center space-x-2">
                                                            <div className="text-[10px] text-white/25 w-12 shrink-0">{formatTime(m.match_time)}</div>
                                                            <div>
                                                                <div className="text-sm font-semibold text-white leading-tight">{home}</div>
                                                                <div className="text-xs text-white/40 leading-tight">{away}</div>
                                                            </div>
                                                        </div>
                                                        {m.has_betman && m.best_ev > 85 && (
                                                            <div className="mt-1 ml-14">
                                                                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${m.best_ev >= 100 ? 'text-red-400' : m.best_ev >= 95 ? 'text-cyan-400' : 'text-white/30'}`}
                                                                    style={{ background: m.best_ev >= 100 ? 'rgba(239,68,68,0.12)' : m.best_ev >= 95 ? 'rgba(0,212,255,0.08)' : 'rgba(255,255,255,0.04)' }}>
                                                                    {tb.efficiency || '효율'} {m.best_ev}%
                                                                </span>
                                                            </div>
                                                        )}
                                                    </div>
                                                    {(['Home', 'Draw', 'Away'] as BetType[]).map(type => {
                                                        const odds = type === 'Home' ? m.home_odds : type === 'Draw' ? m.draw_odds : m.away_odds;
                                                        return (
                                                            <div key={type} className="py-3 px-1">
                                                                <button
                                                                    onClick={() => toggleBet(matchId, m, type)}
                                                                    className={`w-full py-2 rounded-lg text-center text-sm font-bold transition-all ${isSelected(matchId, type) ? 'text-[var(--accent-primary)]' : 'text-white/80 hover:text-white'}`}
                                                                    style={{
                                                                        background: isSelected(matchId, type) ? 'rgba(0,212,255,0.12)' : 'rgba(255,255,255,0.03)',
                                                                        border: isSelected(matchId, type) ? '1px solid rgba(0,212,255,0.3)' : '1px solid transparent',
                                                                    }}>
                                                                    {fmtOdds(odds)}
                                                                </button>
                                                            </div>
                                                        );
                                                    })}
                                                    {/* AI recommendation mini badge */}
                                                    <div className="py-3 text-center">
                                                        {aiPred ? (
                                                            <div className="text-center">
                                                                <div className="text-[10px] font-black" style={{ color: getConfidenceLevel(aiPred.confidence).color }}>
                                                                    {getRecommendationKo(aiPred.recommendation).replace(' ', '')}
                                                                </div>
                                                                <div className="text-[9px] text-white/30">{aiPred.confidence.toFixed(0)}%</div>
                                                            </div>
                                                        ) : (
                                                            <span className="text-[10px] text-white/15">-</span>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </>
                            )}
                        </div>
                    )}

                    <div className="mt-2 text-[10px] text-white/20 text-right px-2">
                        {tb.disclaimer || '본 시뮬레이션은 과거 통계 데이터를 기반으로 한 연구 목적의 결과이며, 실제 경기 결과를 보장하지 않습니다. 도박 및 투자 목적의 활용을 금합니다.'}
                    </div>
                </main>

                {/* ━━━ COMBO ANALYSIS FLOATING PANEL ━━━ */}
                {selectedBets.size > 0 && (
                    <div data-tour="tour-bets-cart" className="fixed bottom-0 left-0 right-0 z-50 shadow-2xl"
                        style={{
                            background: 'rgba(12,12,20,0.92)',
                            backdropFilter: 'blur(20px)',
                            borderTop: '1px solid rgba(0,212,255,0.2)',
                            borderRadius: '20px 20px 0 0',
                        }}>
                        <div className="max-w-7xl mx-auto px-4 py-4">
                            <div className="flex items-center justify-between mb-3">
                                <h3 className="text-sm font-bold text-white flex items-center">
                                    🎯 {tb.comboBetting || '조합 분석'}
                                    <span className="ml-2 text-[10px] px-2 py-0.5 rounded-full font-bold"
                                        style={{ background: 'rgba(0,212,255,0.12)', color: '#00d4ff' }}>
                                        {selectedBets.size} {tb.matches || '경기'}
                                    </span>
                                </h3>
                                <button onClick={() => setSelectedBets(new Map())}
                                    className="text-xs text-white/30 hover:text-white/60 transition">
                                    {tb.clearAll || '전체 삭제'} ✕
                                </button>
                            </div>

                            <div className="flex flex-wrap gap-2 mb-3">
                                {Array.from(selectedBets.entries()).map(([key, val]) => {
                                    const parts = val.match.match_name.split(' vs ');
                                    return (
                                        <div key={key} className="flex items-center space-x-2 px-3 py-2 rounded-xl text-xs"
                                            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border-subtle)' }}>
                                            <span className="text-white/60">{parts[0]} vs {parts[1]}</span>
                                            <span className="font-bold" style={{ color: '#00d4ff' }}>{betTypeLabel(val.type)}</span>
                                            <span className="text-white font-bold font-mono">{val.odds.toFixed(2)}</span>
                                            <button onClick={() => { setSelectedBets(prev => { const n = new Map(prev); n.delete(key); return n; }); }}
                                                className="text-white/20 hover:text-white/50">✕</button>
                                        </div>
                                    );
                                })}
                            </div>

                            <div className="flex items-center justify-between">
                                <div>
                                    <span className="text-xs text-white/40">{tb.totalOdds || '총 조합 배율'}</span>
                                    <span className="text-lg font-black ml-2 font-mono gradient-text">{comboOdds.toFixed(2)}</span>
                                    <span className="text-xs text-white/30 ml-3">
                                        {selectedBets.size}개 경기 조합
                                    </span>
                                </div>
                                <button onClick={handleSaveCombo}
                                    disabled={saving || selectedBets.size < 2}
                                    className={`text-sm px-6 py-2.5 rounded-xl font-bold transition-all ${saving ? 'opacity-50' : 'hover:scale-105'}`}
                                    style={{ background: 'linear-gradient(135deg, #00d4ff, #8b5cf6)', color: 'white' }}>
                                    {saving ? (tb.saving || '저장 중...') : `💾 ${tb.saveCombo || '조합 저장 →'}`}
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Tour Restart FAB */}
            <div className="fixed bottom-24 right-4 z-50 sm:bottom-6 sm:right-6">
                <TourRestartButton
                    tourId="bets"
                    onRestart={() => setTourForceStart(true)}
                    label={tb.guideTour || '이용 가이드'}
                />
            </div>

            <OnboardingTour
                steps={betsTourSteps}
                tourId="bets"
                delay={1500}
                forceStart={tourForceStart}
                onComplete={() => setTourForceStart(false)}
                onSkip={() => setTourForceStart(false)}
            />
        </>
    );
}
