"use client";
import React, { useEffect, useState, useMemo } from 'react';
import DeadlineBanner from '../components/DeadlineBanner';
import Navbar from '../components/Navbar';
import OddsHistoryChart from '../components/OddsHistoryChart'; // Import Chart
import ProAnalysisPanel from '../components/ProAnalysisPanel';
import { useCart, CartItem } from '../../context/CartContext';
import OnboardingTour, { TourRestartButton } from '../components/OnboardingTour';
import { marketTourSteps } from '../lib/tourSteps';
import { useDictionarySafe } from '../context/DictionaryContext';
import { useAuth } from '../context/AuthContext';

interface OddsItem {
    provider: string;
    team_home: string;
    team_away: string;
    team_home_ko?: string;
    team_away_ko?: string;
    home_odds: number;
    draw_odds: number;
    away_odds: number;
    match_time: string;
    sport: string;
    league: string;
}

interface HistoryItem {
    timestamp: string;
    home_odds: number;
    draw_odds: number;
    away_odds: number;
}

interface AIPrediction {
    match_id: string;
    confidence: number;
    recommendation: string;
    home_win_prob: number;
    draw_prob: number;
    away_win_prob: number;
    factors: { name: string; weight: number; score: number; detail: string; home_injuries?: string[]; away_injuries?: string[]; home_form?: string; away_form?: string; home_rank?: number; away_rank?: number }[];
    home_rank: number;
    away_rank: number;
    home_form: string;
    away_form: string;
    injuries_home: string[];
    injuries_away: string[];
    api_prediction?: string;
    api_prediction_pct?: { home: number; draw: number; away: number };
}

interface MatchDetail {
    match_id: string;
    home: string;
    away: string;
    standings: {
        home: { rank: number; played: number; wins: number; draws: number; losses: number; points: number; form: string; goals_for: number; goals_against: number; goal_diff: number } | null;
        away: { rank: number; played: number; wins: number; draws: number; losses: number; points: number; form: string; goals_for: number; goals_against: number; goal_diff: number } | null;
    };
    recent_matches: {
        home: { date: string; home: string; away: string; home_goals: number; away_goals: number; league: string }[];
        away: { date: string; home: string; away: string; home_goals: number; away_goals: number; league: string }[];
    };
    lineups: Record<string, { formation: string; starters: { name: string; number: number; pos: string }[]; substitutes: { name: string; number: number; pos: string }[]; coach: string }> | null;
    injuries: {
        home: { player_name: string; reason: string; status: string }[];
        away: { player_name: string; reason: string; status: string }[];
    };
}

interface LiveScore {
    match_id?: number;
    fixture_id: number;
    status: string;
    status_long: string;
    elapsed: number;
    home: string;
    away: string;
    home_goals: number;
    away_goals: number;
    halftime: { home: number; away: number };
    league_name: string;
    source?: string;
    events: { time: number | string; type: string; detail: string; player: string; team: string }[];
}

// 팀 이름 매칭 (약어/언어 차이 해결)
function matchTeamName(oddsName: string, liveName: string): boolean {
    if (!oddsName || !liveName) return false;
    const a = oddsName.toLowerCase().trim();
    const b = liveName.toLowerCase().trim();
    if (a === b) return true;
    // 부분 매칭 (3글자 이상 공통)
    const wordsA = a.split(/\s+/);
    const wordsB = b.split(/\s+/);
    for (const wa of wordsA) {
        if (wa.length < 3) continue;
        for (const wb of wordsB) {
            if (wb.length < 3) continue;
            if (wa === wb || wa.includes(wb) || wb.includes(wa)) return true;
        }
    }
    return false;
}

export default function MarketPage() {
    const dict = useDictionarySafe();
    const tm = (dict as any)?.market || {} as Record<string, string>;
    const tc = (dict as any)?.common || {} as Record<string, string>;
    const { user } = useAuth();
    const [odds, setOdds] = useState<OddsItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const { addToCart, cartItems } = useCart();
    const [aiPredictions, setAiPredictions] = useState<Record<string, AIPrediction>>({});
    const [tourForceStart, setTourForceStart] = useState(false);

    const [selectedSport, setSelectedSport] = useState<string>('ALL');

    const filteredOdds = odds.filter(item => {
        if (selectedSport === 'ALL') return true;
        return item.sport.toUpperCase() === selectedSport;
    });

    // Dynamic sport tabs with icons & counts
    const sportTabs = useMemo(() => {
        const iconMap: Record<string, string> = { SOCCER: '⚽', BASKETBALL: '🏀', BASEBALL: '⚾', ICEHOCKEY: '🏒' };
        const labelMap: Record<string, string> = { SOCCER: tc.soccer || 'Soccer', BASKETBALL: tc.basketball || 'Basketball', BASEBALL: tc.baseball || 'Baseball', ICEHOCKEY: tc.hockey || 'Hockey' };
        const counts: Record<string, number> = {};
        odds.forEach(item => {
            const key = item.sport.toUpperCase();
            counts[key] = (counts[key] || 0) + 1;
        });
        const sportOrder = ['SOCCER', 'BASKETBALL', 'BASEBALL', 'ICEHOCKEY'];
        const tabs = sportOrder
            .map(s => ({ key: s, icon: iconMap[s] || '🏟️', label: labelMap[s] || s, count: counts[s] || 0 }));
        return tabs;
    }, [odds]);

    // Group filtered odds by league
    const groupedByLeague = useMemo(() => {
        const groups: { league: string; items: (OddsItem & { globalIdx: number })[] }[] = [];
        const leagueOrder: string[] = [];
        const leagueMap: Record<string, (OddsItem & { globalIdx: number })[]> = {};
        filteredOdds.forEach((item, idx) => {
            const league = item.league || 'Unknown';
            if (!leagueMap[league]) {
                leagueMap[league] = [];
                leagueOrder.push(league);
            }
            leagueMap[league].push({ ...item, globalIdx: idx });
        });
        leagueOrder.forEach(league => {
            groups.push({ league, items: leagueMap[league] });
        });
        return groups;
    }, [filteredOdds]);

    const [collapsedLeagues, setCollapsedLeagues] = useState<Record<string, boolean>>({});
    const toggleLeague = (league: string) => {
        setCollapsedLeagues(prev => ({ ...prev, [league]: !prev[league] }));
    };

    // State for expanded chart row
    const [expandedRow, setExpandedRow] = useState<number | null>(null);
    const [historyData, setHistoryData] = useState<HistoryItem[]>([]);
    const [historyLoading, setHistoryLoading] = useState(false);
    const [activeDetailTab, setActiveDetailTab] = useState<string>('ai');
    const [matchDetail, setMatchDetail] = useState<MatchDetail | null>(null);
    const [matchDetailLoading, setMatchDetailLoading] = useState(false);

    // Live scores state
    const [liveScores, setLiveScores] = useState<LiveScore[]>([]);
    const [liveCount, setLiveCount] = useState(0);

    // Vote state
    const [voteStats, setVoteStats] = useState<Record<string, { home_pct: number; draw_pct: number; away_pct: number; total_votes: number }>>({});
    const [votedMatches, setVotedMatches] = useState<Record<string, string>>({});
    const [matchResults, setMatchResults] = useState<Record<string, { status: string; score?: string }>>({});
    const [userId] = useState(() => {
        if (typeof window !== 'undefined') {
            const stored = localStorage.getItem('sp_user_id');
            if (stored) return stored;
            const newId = `user_${Math.floor(Math.random() * 100000)}`;
            localStorage.setItem('sp_user_id', newId);
            return newId;
        }
        return `user_${Math.floor(Math.random() * 100000)}`;
    });

    const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || '';

    const fetchOdds = async () => {
        if (odds.length === 0) setLoading(true);
        setError('');
        try {
            const res = await fetch(`${API_BASE_URL}/api/market/pinnacle`);
            if (!res.ok) throw new Error('Failed to fetch market data');
            const data = await res.json();
            setOdds(data);
        } catch (err) {
            setError(tm.errorFetch || 'Failed to load market data.');
            console.error(err);
        } finally {
            setLoading(false);
        }
        // Fetch AI predictions
        try {
            const aiRes = await fetch(`${API_BASE_URL}/api/ai/predictions`);
            if (aiRes.ok) {
                const aiData = await aiRes.json();
                const predMap: Record<string, AIPrediction> = {};
                for (const p of (aiData.predictions || [])) {
                    predMap[p.match_id] = p;
                }
                setAiPredictions(predMap);
            }
        } catch { /* AI predictions optional */ }
    };

    const fetchHistory = async (team_home: string, team_away: string) => {
        setHistoryLoading(true);
        setHistoryData([]); // Reset previous data
        try {
            const res = await fetch(`${API_BASE_URL}/api/market/history?team_home=${encodeURIComponent(team_home)}&team_away=${encodeURIComponent(team_away)}`);
            if (res.ok) {
                const data = await res.json();
                setHistoryData(data);
            }
        } catch (err) {
            console.error("Failed to fetch history", err);
        } finally {
            setHistoryLoading(false);
        }
    };

    const fetchMatchDetail = async (team_home: string, team_away: string) => {
        setMatchDetailLoading(true);
        setMatchDetail(null);
        try {
            const matchId = `${team_home}_${team_away}`;
            const res = await fetch(`${API_BASE_URL}/api/ai/match-detail/${encodeURIComponent(matchId)}`);
            if (res.ok) {
                const data = await res.json();
                setMatchDetail(data);
            }
        } catch (err) {
            console.error('Match detail fetch failed:', err);
        } finally {
            setMatchDetailLoading(false);
        }
    };

    const handleRowClick = (index: number, team_home: string, team_away: string) => {
        if (expandedRow === index) {
            setExpandedRow(null);
        } else {
            setExpandedRow(index);
            setActiveDetailTab('ai');
            fetchHistory(team_home, team_away);
            fetchMatchDetail(team_home, team_away);
            // Fetch vote stats
            const matchId = `${team_home}_${team_away}`;
            fetch(`${API_BASE_URL}/api/prediction/vote-stats/${encodeURIComponent(matchId)}`)
                .then(r => r.ok ? r.json() : null)
                .then(s => { if (s && s.total_votes > 0) setVoteStats(prev => ({ ...prev, [matchId]: s })); })
                .catch(() => { });
        }
    };

    const handleVote = async (matchId: string, selection: string, odds: number) => {
        if (votedMatches[matchId]) {
            alert(tm.alreadyVoted || 'Already voted for this match.');
            return;
        }
        try {
            const headers: Record<string, string> = { 'Content-Type': 'application/json' };
            const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
            if (token) headers['Authorization'] = `Bearer ${token}`;

            const res = await fetch(`${API_BASE_URL}/api/prediction/submit`, {
                method: 'POST',
                headers,
                body: JSON.stringify({ match_id: matchId, user_id: token ? undefined : userId, selection, odds }),
            });
            if (res.ok) {
                setVotedMatches(prev => ({ ...prev, [matchId]: selection }));
                const statsRes = await fetch(`${API_BASE_URL}/api/prediction/vote-stats/${encodeURIComponent(matchId)}`);
                if (statsRes.ok) {
                    const s = await statsRes.json();
                    setVoteStats(prev => ({ ...prev, [matchId]: s }));
                }
            } else {
                const err = await res.json();
                alert(`${tm.voteFail || 'Vote failed'}: ${err.detail || tc.error || 'Error'}`);
            }
        } catch { console.error('Vote failed'); }
    };

    // 정산 결과 조회 (투표한 경기들의 WON/LOST/PENDING 상태)
    useEffect(() => {
        const fetchResults = async () => {
            const headers: Record<string, string> = {};
            const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
            if (token) headers['Authorization'] = `Bearer ${token}`;
            try {
                const res = await fetch(`${API_BASE_URL}/api/prediction/my-predictions`, { headers });
                if (res.ok) {
                    const preds = await res.json();
                    const results: Record<string, { status: string; score?: string }> = {};
                    const voted: Record<string, string> = {};
                    for (const p of preds) {
                        voted[p.match_id] = p.selection;
                        results[p.match_id] = { status: p.status || 'PENDING' };
                    }
                    setVotedMatches(prev => ({ ...prev, ...voted }));
                    setMatchResults(prev => ({ ...prev, ...results }));
                }
            } catch { /* ignore */ }
        };
        fetchResults();
    }, [API_BASE_URL]);

    const formatTime = (isoString: string) => {
        try {
            const date = new Date(isoString);
            return date.toLocaleString('ko-KR', {
                month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false
            });
        } catch {
            return isoString;
        }
    };

    // Fetch live scores
    const fetchLiveScores = async () => {
        try {
            const res = await fetch(`${API_BASE_URL}/api/ai/live-scores`);
            if (res.ok) {
                const data = await res.json();
                setLiveScores(data.matches || []);
                setLiveCount(data.live_count || 0);
            }
        } catch { /* live scores optional */ }
    };

    // 특정 odds 항목에 대응하는 라이브 스코어 찾기
    const findLiveScore = (item: OddsItem): LiveScore | null => {
        for (const live of liveScores) {
            if (matchTeamName(item.team_home, live.home) && matchTeamName(item.team_away, live.away)) {
                return live;
            }
        }
        return null;
    };

    useEffect(() => {
        fetchOdds();
        fetchLiveScores();
        // 30초마다 라이브 스코어 폴링 (Live-Score-Api 600 req/hr 여유)
        const liveInterval = setInterval(fetchLiveScores, 30000);
        return () => clearInterval(liveInterval);
    }, []);

    return (
        <div className="min-h-screen flex flex-col font-sans" style={{ background: 'var(--bg-primary)' }}>
            <DeadlineBanner />
            <Navbar />

            <main className="flex-grow max-w-7xl mx-auto px-2 sm:px-6 lg:px-8 py-6 w-full pb-32">
                {/* ── Hero Description Banner ── */}
                <div data-tour="tour-market-intro" className="relative overflow-hidden rounded-2xl mb-6" style={{
                    background: 'linear-gradient(135deg, rgba(0,212,255,0.08) 0%, rgba(139,92,246,0.08) 50%, rgba(255,107,53,0.06) 100%)',
                    border: '1px solid rgba(0,212,255,0.15)',
                }}>
                    {/* Glow Effects */}
                    <div style={{
                        position: 'absolute', top: '-40%', left: '-10%', width: '300px', height: '300px',
                        background: 'radial-gradient(circle, rgba(0,212,255,0.12) 0%, transparent 70%)',
                        pointerEvents: 'none',
                    }} />
                    <div style={{
                        position: 'absolute', bottom: '-40%', right: '-5%', width: '250px', height: '250px',
                        background: 'radial-gradient(circle, rgba(139,92,246,0.1) 0%, transparent 70%)',
                        pointerEvents: 'none',
                    }} />

                    <div className="relative px-5 py-5 sm:px-8 sm:py-6">
                        {/* Top Row: Title + Live Badge */}
                        <div className="flex items-start gap-4 mb-3">
                            <div className="flex items-center justify-center w-12 h-12 rounded-xl flex-shrink-0 mt-1" style={{
                                background: 'linear-gradient(135deg, rgba(0,212,255,0.2), rgba(139,92,246,0.2))',
                                border: '1px solid rgba(0,212,255,0.3)',
                                boxShadow: '0 0 20px rgba(0,212,255,0.1)',
                            }}>
                                <span className="text-2xl">📊</span>
                            </div>
                            <div className="flex-1">
                                <h1 className="text-xl sm:text-2xl font-black tracking-tight flex flex-wrap items-center gap-2" style={{ color: 'var(--text-primary)' }}>
                                    AI 기반 경기 시뮬레이션
                                    <span className="text-xs font-bold px-2 py-0.5 rounded-full whitespace-nowrap" style={{
                                        background: 'linear-gradient(135deg, rgba(0,212,255,0.15), rgba(139,92,246,0.15))',
                                        color: 'var(--accent-primary)',
                                        border: '1px solid rgba(0,212,255,0.25)',
                                    }}>데이터 분석 연구소</span>
                                    {liveCount > 0 && (
                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold" style={{ background: 'rgba(239,68,68,0.15)', color: '#ef4444' }}>
                                            <span className="inline-block w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: '#ef4444' }} />
                                            {liveCount} LIVE
                                        </span>
                                    )}
                                </h1>
                                <div className="mt-2 text-sm space-y-1.5" style={{ color: 'var(--text-secondary)', lineHeight: '1.6' }}>
                                    <p>스포어닉스의 정교한 데이터 모델을 활용하여 다가오는 경기의 객관적인 흐름을 파악하고, 나만의 스포츠 분석 능력을 안전하게 테스트해보세요.</p>
                                    <p className="text-[11px] font-medium" style={{ color: 'var(--text-muted)' }}>
                                        * 본 메뉴는 순수 데이터 통계 및 시뮬레이션 연구 목적이며, 어떠한 형태의 사행성 게임이나 금전적 배팅을 유도·권장하지 않습니다.
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* Steps Guide */}
                        <div data-tour="tour-market-steps" className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-5">
                            {[
                                {
                                    step: '01',
                                    icon: '🔍',
                                    title: '데이터 탐색',
                                    desc: '전 세계 다양한 리그의 신뢰도 높은 데이터를 실시간으로 확인합니다',
                                    color: '#00d4ff',
                                },
                                {
                                    step: '02',
                                    icon: '🧠',
                                    title: '모의 시뮬레이션',
                                    desc: '제공된 AI 분석지표를 바탕으로 예상 경기 결과를 시나리오별로 예측해 봅니다',
                                    color: '#8b5cf6',
                                },
                                {
                                    step: '03',
                                    icon: '📈',
                                    title: '정확도 검증',
                                    desc: '경기 종료 후 실제 데이터와 나의 예측 모델을 비교하여 분석 능력을 평가합니다',
                                    color: '#ff6b35',
                                },
                            ].map((s, i) => (
                                <div key={i} className="flex items-start gap-3 px-4 py-3 rounded-xl transition-all duration-200"
                                    style={{
                                        background: 'rgba(255,255,255,0.02)',
                                        border: '1px solid rgba(255,255,255,0.06)',
                                    }}
                                    onMouseEnter={e => {
                                        e.currentTarget.style.background = `${s.color}0a`;
                                        e.currentTarget.style.borderColor = `${s.color}25`;
                                        e.currentTarget.style.transform = 'translateY(-1px)';
                                    }}
                                    onMouseLeave={e => {
                                        e.currentTarget.style.background = 'rgba(255,255,255,0.02)';
                                        e.currentTarget.style.borderColor = 'rgba(255,255,255,0.06)';
                                        e.currentTarget.style.transform = 'translateY(0)';
                                    }}
                                >
                                    <div className="flex-shrink-0 w-9 h-9 rounded-lg flex items-center justify-center text-lg"
                                        style={{ background: `${s.color}15`, border: `1px solid ${s.color}30` }}>
                                        {s.icon}
                                    </div>
                                    <div className="min-w-0">
                                        <div className="flex items-center gap-1.5">
                                            <span className="text-[9px] font-black tracking-widest px-1.5 py-0.5 rounded" style={{ color: s.color, background: `${s.color}10` }}>STEP {s.step}</span>
                                            <span className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>{s.title}</span>
                                        </div>
                                        <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{s.desc}</p>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Bottom Stats Row */}
                        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 mt-4 pt-3" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                            <div className="flex items-center gap-1.5">
                                <span className="w-1.5 h-1.5 rounded-full" style={{ background: '#00d4ff' }} />
                                <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>{tm.liveOdds || 'Live Odds'}</span>
                                <span className="text-[11px] font-bold" style={{ color: '#00d4ff' }}>{odds.length} {tm.matches || 'matches'}</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                                <span className="w-1.5 h-1.5 rounded-full" style={{ background: '#8b5cf6' }} />
                                <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>{tm.aiAnalysis || 'AI Analysis'}</span>
                                <span className="text-[11px] font-bold" style={{ color: '#8b5cf6' }}>{Object.keys(aiPredictions).length} {tm.matches || 'matches'}</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                                <span className="w-1.5 h-1.5 rounded-full" style={{ background: '#35c759' }} />
                                <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>{tm.autoSettle || 'Auto Settle'}</span>
                                <span className="text-[11px] font-bold" style={{ color: '#35c759' }}>{tm.settleInterval || 'every 30 min'}</span>
                            </div>
                            <div className="ml-auto flex items-center gap-1 text-[10px] px-2.5 py-1 rounded-full" style={{
                                background: 'rgba(53,199,89,0.08)', border: '1px solid rgba(53,199,89,0.2)', color: '#35c759',
                            }}>
                                <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: '#35c759' }} />
                                {tm.heroBadge || 'Free Entry'}
                            </div>
                        </div>
                    </div>
                </div>

                <div className="flex flex-wrap justify-between items-center mb-4 border-b border-white/10 pb-3 gap-3">
                    {/* Data Source Branding Banner - hidden on mobile */}
                    <div className="hidden sm:flex items-center gap-3 flex-wrap">
                        {[
                            { name: 'API-Football', icon: '⚽', color: '#35c759' },
                            { name: 'Pinnacle Odds', icon: '📊', color: '#00d4ff' },
                            { name: 'football-data.org', icon: '📈', color: '#fbbf24' },
                            { name: 'API-Basketball', icon: '🏀', color: '#ff6b35' },
                        ].map((src, i) => (
                            <div key={i} className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-semibold border"
                                style={{
                                    background: `${src.color}08`,
                                    borderColor: `${src.color}30`,
                                    color: src.color,
                                }}>
                                <span className="text-xs">{src.icon}</span>
                                {src.name}
                                <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: src.color }}></span>
                            </div>
                        ))}
                        <div className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold"
                            style={{
                                background: 'linear-gradient(135deg, rgba(0,212,255,0.15), rgba(139,92,246,0.15))',
                                color: 'var(--accent-primary)',
                                border: '1px solid rgba(0,212,255,0.3)',
                            }}>
                            🧠 {tm.aiComprehensive || 'AI Analysis'}
                        </div>
                    </div>

                    <div data-tour="tour-market-sports" className="flex flex-wrap gap-2">
                        <button
                            onClick={() => { setSelectedSport('ALL'); setCollapsedLeagues({}); }}
                            className={`px-3 py-1.5 text-xs font-bold rounded-full transition-all flex items-center gap-1.5 ${selectedSport === 'ALL'
                                ? 'text-white shadow-md shadow-cyan-500/20'
                                : 'border border-white/10 hover:border-white/20'
                                }`}
                            style={selectedSport === 'ALL'
                                ? { background: 'var(--accent-primary)' }
                                : { background: 'var(--bg-card)', color: 'var(--text-secondary)' }
                            }
                        >
                            🏆 {tm.filterAll || 'All'} <span className="ml-0.5 opacity-70">{odds.length}</span>
                        </button>
                        {sportTabs.map(tab => (
                            <button
                                key={tab.key}
                                onClick={() => { setSelectedSport(tab.key); setCollapsedLeagues({}); }}
                                className={`px-3 py-1.5 text-xs font-bold rounded-full transition-all flex items-center gap-1.5 ${selectedSport === tab.key
                                    ? 'text-white shadow-md shadow-cyan-500/20'
                                    : 'border border-white/10 hover:border-white/20'
                                    } ${tab.count === 0 ? 'opacity-50' : ''}`}
                                style={selectedSport === tab.key
                                    ? { background: 'var(--accent-primary)' }
                                    : { background: 'var(--bg-card)', color: 'var(--text-secondary)' }
                                }
                            >
                                {tab.icon} {tab.label} {tab.count > 0
                                    ? <span className="ml-0.5 opacity-70">{tab.count}</span>
                                    : <span className="ml-0.5 text-[9px] px-1 py-0.5 rounded bg-white/5" style={{ color: 'var(--text-muted)' }}>OFF</span>
                                }
                            </button>
                        ))}
                        <button
                            onClick={fetchOdds}
                            className="px-3 py-1.5 text-xs rounded-full flex items-center ml-1 border border-white/10 hover:border-white/20 transition"
                            style={{ background: 'var(--bg-card)', color: 'var(--text-secondary)' }}
                        >
                            {loading ? (tc.loading || 'Loading...') : `🔄 ${tm.refresh || 'Refresh'}`}
                        </button>
                    </div>
                </div>

                {error && (
                    <div className="p-3 rounded text-sm mb-4 border border-red-500/30" style={{ background: 'rgba(239,68,68,0.1)', color: '#f87171' }}>
                        {error}
                    </div>
                )}

                {/* ═══ MOBILE CARD VIEW ═══ */}
                <div className="md:hidden space-y-2">
                    {loading && odds.length === 0 ? (
                        <div className="text-center py-12" style={{ color: 'var(--text-muted)' }}>
                            <div className="animate-spin inline-block w-6 h-6 border-2 border-white/10 border-t-[var(--accent-primary)] rounded-full mb-2" />
                            <p className="text-sm">{tc.loading || 'Loading...'}</p>
                        </div>
                    ) : filteredOdds.length === 0 ? (
                        <div className="text-center py-12" style={{ color: 'var(--text-muted)' }}>
                            <p className="text-sm">{odds.length === 0 ? (tm.noMatches || 'No matches to display.') : (tm.noSportMatches || 'No matches for this sport.')}</p>
                        </div>
                    ) : (
                        groupedByLeague.map((group) => (
                            <div key={group.league}>
                                {/* League Header */}
                                <button
                                    onClick={() => toggleLeague(group.league)}
                                    className="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg mb-1 transition-colors"
                                    style={{ background: 'rgba(0,212,255,0.04)' }}
                                >
                                    <span className="text-[10px] transition-transform" style={{ color: 'var(--text-muted)', display: 'inline-block', transform: collapsedLeagues[group.league] ? 'rotate(-90deg)' : 'rotate(0deg)' }}>▼</span>
                                    <span className="text-xs font-bold" style={{ color: 'var(--accent-primary)' }}>{group.league}</span>
                                    <span className="text-[10px] px-1.5 py-0.5 rounded-full" style={{ background: 'rgba(0,212,255,0.1)', color: 'var(--accent-primary)' }}>{group.items.length}</span>
                                </button>

                                {!collapsedLeagues[group.league] && group.items.map((item, itemIdx) => {
                                    const isFirstItem = (groupedByLeague[0]?.league === group.league && itemIdx === 0);
                                    const matchId = `${item.team_home}_${item.team_away}`;
                                    const pred = aiPredictions[matchId];
                                    const live = findLiveScore(item);
                                    const voted = votedMatches[matchId];
                                    const result = matchResults[matchId];
                                    const stat = voteStats[matchId];

                                    return (
                                        <div key={item.globalIdx} data-tour={isFirstItem ? 'tour-market-match' : undefined} className="rounded-xl border mb-2 overflow-hidden transition-all"
                                            style={{ background: 'var(--bg-surface)', borderColor: expandedRow === item.globalIdx ? 'rgba(0,212,255,0.3)' : 'var(--border-subtle)' }}
                                        >
                                            {/* Card Header: Time + AI + Live */}
                                            <div className="flex items-center justify-between px-3 py-2" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                                                <div className="flex items-center gap-2">
                                                    {live ? (
                                                        <div className="flex items-center gap-1">
                                                            <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: '#ef4444' }} />
                                                            <span className="text-[10px] font-bold" style={{ color: '#ef4444' }}>LIVE {live.elapsed}&apos;</span>
                                                            <span className="text-sm font-black ml-1" style={{ color: 'var(--text-primary)' }}>{live.home_goals} - {live.away_goals}</span>
                                                        </div>
                                                    ) : (
                                                        <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>{formatTime(item.match_time)}</span>
                                                    )}
                                                </div>
                                                <div className="flex items-center gap-1.5">
                                                    {pred && (
                                                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full" style={{
                                                            color: pred.confidence >= 65 ? '#ff6b35' : pred.confidence >= 50 ? '#fbbf24' : 'var(--text-muted)',
                                                            background: pred.confidence >= 65 ? 'rgba(255,107,53,0.15)' : pred.confidence >= 50 ? 'rgba(251,191,36,0.12)' : 'rgba(255,255,255,0.05)',
                                                        }}>
                                                            {pred.confidence >= 65 ? '🔥' : '⭐'} {pred.confidence.toFixed(0)}%
                                                        </span>
                                                    )}
                                                    {result && (
                                                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full" style={{
                                                            background: result.status === 'WON' ? 'rgba(34,197,94,0.15)' : result.status === 'LOST' ? 'rgba(239,68,68,0.15)' : 'rgba(255,255,255,0.05)',
                                                            color: result.status === 'WON' ? '#22c55e' : result.status === 'LOST' ? '#ef4444' : 'var(--text-muted)',
                                                        }}>
                                                            {result.status === 'WON' ? `✅ ${tm.hit || 'Hit'}` : result.status === 'LOST' ? `❌ ${tm.miss || 'Miss'}` : `⏳ ${tm.pending || 'Pending'}`}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Teams Row */}
                                            <div className="px-3 py-3" onClick={() => handleRowClick(item.globalIdx, item.team_home, item.team_away)}>
                                                <div className="flex items-center justify-between">
                                                    <div className="flex-1 text-center">
                                                        <div className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>
                                                            {item.team_home_ko || item.team_home}
                                                        </div>
                                                        {item.team_home_ko && (
                                                            <div className="text-[10px] mt-0.5" style={{ color: 'var(--text-muted)' }}>{item.team_home}</div>
                                                        )}
                                                    </div>
                                                    <div className="px-3 text-xs font-light" style={{ color: 'var(--text-muted)' }}>VS</div>
                                                    <div className="flex-1 text-center">
                                                        <div className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>
                                                            {item.team_away_ko || item.team_away}
                                                        </div>
                                                        {item.team_away_ko && (
                                                            <div className="text-[10px] mt-0.5" style={{ color: 'var(--text-muted)' }}>{item.team_away}</div>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Vote Stats Bar */}
                                            {stat && stat.total_votes > 0 && (
                                                <div className="px-3 pb-2">
                                                    <div className="flex justify-between text-[9px] mb-1" style={{ color: 'var(--text-muted)' }}>
                                                        <span>{tm.homeWin || 'Home'} {stat.home_pct?.toFixed(0) || 0}%</span>
                                                        {stat.draw_pct != null && <span>{tm.draw || 'Draw'} {stat.draw_pct.toFixed(0)}%</span>}
                                                        <span>{tm.awayWin || 'Away'} {stat.away_pct?.toFixed(0) || 0}%</span>
                                                    </div>
                                                    <div className="flex h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--bg-primary)' }}>
                                                        <div style={{ width: `${stat.home_pct || 0}%`, background: 'rgba(0,212,255,0.6)' }} className="transition-all" />
                                                        {stat.draw_pct != null && <div style={{ width: `${stat.draw_pct}%`, background: 'rgba(255,255,255,0.12)' }} className="transition-all" />}
                                                        <div style={{ width: `${stat.away_pct || 0}%`, background: 'rgba(139,92,246,0.6)' }} className="transition-all" />
                                                    </div>
                                                </div>
                                            )}

                                            {/* Odds Buttons - Big Touch Targets */}
                                            <div data-tour={isFirstItem ? 'tour-market-odds' : undefined} className="grid grid-cols-3 gap-1.5 px-3 pb-3">
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleVote(`${item.team_home}_${item.team_away}`, 'Home', item.home_odds);
                                                    }}
                                                    className={`py-3 rounded-lg text-center transition-all active:scale-95 ${votedMatches[`${item.team_home}_${item.team_away}`] === 'Home' ? 'ring-1 ring-[var(--accent-primary)]' : ''}`}
                                                    style={{
                                                        background: votedMatches[`${item.team_home}_${item.team_away}`] === 'Home' ? 'rgba(0,212,255,0.12)' : 'var(--bg-card)',
                                                        border: '1px solid var(--border-subtle)',
                                                    }}
                                                >
                                                    <div className="text-[10px] mb-0.5" style={{ color: 'var(--text-muted)' }}>{tm.homeWin || 'H'}</div>
                                                    <div className="text-base font-bold" style={{ color: 'var(--odds-home)' }}>{item.home_odds.toFixed(2)}</div>
                                                </button>
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        if (item.draw_odds > 0) {
                                                            handleVote(`${item.team_home}_${item.team_away}`, 'Draw', item.draw_odds);
                                                        }
                                                    }}
                                                    className={`py-3 rounded-lg text-center transition-all active:scale-95 ${votedMatches[`${item.team_home}_${item.team_away}`] === 'Draw' ? 'ring-1 ring-white/30' : ''}`}
                                                    style={{
                                                        background: votedMatches[`${item.team_home}_${item.team_away}`] === 'Draw' ? 'rgba(255,255,255,0.08)' : 'var(--bg-card)',
                                                        border: '1px solid var(--border-subtle)',
                                                        opacity: item.draw_odds > 0 ? 1 : 0.3,
                                                    }}
                                                    disabled={item.draw_odds <= 0}
                                                >
                                                    <div className="text-[10px] mb-0.5" style={{ color: 'var(--text-muted)' }}>{tm.draw || 'D'}</div>
                                                    <div className="text-base font-bold" style={{ color: 'var(--text-secondary)' }}>{item.draw_odds > 0 ? item.draw_odds.toFixed(2) : '—'}</div>
                                                </button>
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleVote(`${item.team_home}_${item.team_away}`, 'Away', item.away_odds);
                                                    }}
                                                    className={`py-3 rounded-lg text-center transition-all active:scale-95 ${votedMatches[`${item.team_home}_${item.team_away}`] === 'Away' ? 'ring-1 ring-[var(--accent-secondary)]' : ''}`}
                                                    style={{
                                                        background: votedMatches[`${item.team_home}_${item.team_away}`] === 'Away' ? 'rgba(139,92,246,0.12)' : 'var(--bg-card)',
                                                        border: '1px solid var(--border-subtle)',
                                                    }}
                                                >
                                                    <div className="text-[10px] mb-0.5" style={{ color: 'var(--text-muted)' }}>{tm.awayWin || 'A'}</div>
                                                    <div className="text-base font-bold" style={{ color: 'var(--odds-away)' }}>{item.away_odds.toFixed(2)}</div>
                                                </button>
                                            </div>

                                            {/* Voted indicator */}
                                            {voted && (
                                                <div className="px-3 pb-2">
                                                    <div className="text-center py-1.5 rounded-lg text-[11px] font-bold" style={{ background: 'rgba(0,212,255,0.06)', color: 'var(--accent-primary)', border: '1px solid rgba(0,212,255,0.15)' }}>
                                                        ✅ &quot;{voted === 'Home' ? (tm.homeWin || 'Home') : voted === 'Draw' ? (tm.draw || 'Draw') : (tm.awayWin || 'Away')}&quot; {tm.voted || 'Voted'}
                                                    </div>
                                                </div>
                                            )}

                                            {/* Expand indicator */}
                                            <button
                                                onClick={() => handleRowClick(item.globalIdx, item.team_home, item.team_away)}
                                                className="w-full py-1.5 text-center text-[10px] font-bold transition-colors"
                                                style={{ color: 'var(--text-muted)', background: 'rgba(255,255,255,0.02)', borderTop: '1px solid var(--border-subtle)' }}
                                            >
                                                {expandedRow === item.globalIdx ? `▲ ${tm.collapse || 'Collapse'}` : `▼ ${tm.expandAI || 'AI Analysis · Details'}`}
                                            </button>

                                            {/* Expanded Detail (same as desktop) */}
                                            {expandedRow === item.globalIdx && (
                                                <div style={{ background: 'var(--bg-card)', borderTop: '1px solid var(--border-subtle)' }}>
                                                    <div className="flex border-b" style={{ borderColor: 'var(--border-subtle)' }}>
                                                        {[
                                                            { key: 'ai', icon: '🧠', label: 'AI' },
                                                            { key: 'standings', icon: '📊', label: tm.tabStandings || 'Standings' },
                                                            { key: 'recent', icon: '⚽', label: tm.tabRecent || 'Recent' },
                                                            { key: 'lineups', icon: '👕', label: tm.tabLineups || 'Lineups' },
                                                        ].map(tab => (
                                                            <button
                                                                key={tab.key}
                                                                onClick={(e) => { e.stopPropagation(); setActiveDetailTab(tab.key); }}
                                                                className="flex-1 py-2.5 text-[11px] font-bold transition-all relative"
                                                                style={{
                                                                    color: activeDetailTab === tab.key ? 'var(--accent-primary)' : 'var(--text-muted)',
                                                                    background: activeDetailTab === tab.key ? 'rgba(0,212,255,0.05)' : 'transparent',
                                                                }}
                                                            >
                                                                <span>{tab.icon} {tab.label}</span>
                                                                {activeDetailTab === tab.key && (
                                                                    <div className="absolute bottom-0 left-1/4 right-1/4 h-0.5 rounded-full" style={{ background: 'var(--accent-primary)' }} />
                                                                )}
                                                            </button>
                                                        ))}
                                                    </div>
                                                    <div className="p-3 text-center text-xs" style={{ color: 'var(--text-muted)' }}>
                                                        {tm.desktopOptimized || 'Detailed analysis is optimized for desktop. Please check on PC.'}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        ))
                    )}
                </div>

                {/* ═══ DESKTOP TABLE VIEW ═══ */}
                <div className="hidden md:block overflow-hidden rounded-lg border" style={{ background: 'var(--bg-surface)', borderColor: 'var(--border-subtle)' }}>
                    <div className="overflow-x-auto">
                        <table className="min-w-full text-center text-sm">
                            <thead className="uppercase text-xs font-semibold tracking-wider border-b" style={{ background: 'var(--bg-card)', color: 'var(--text-muted)', borderColor: 'var(--border-subtle)' }}>
                                <tr>
                                    <th className="py-3 px-2 w-20">AI</th>
                                    <th className="py-3 px-2 w-24">{tm.timeLeague || 'Time/League'}</th>
                                    <th className="py-3 px-4 text-right w-1/3">{tm.homeWin || 'Home'} (Home)</th>
                                    <th className="py-3 px-2 w-20">{tm.homeWin || 'H'}</th>
                                    <th className="py-3 px-2 w-20">{tm.draw || 'D'}</th>
                                    <th className="py-3 px-2 w-20">{tm.awayWin || 'A'}</th>
                                    <th className="py-3 px-4 text-left w-1/3">{tm.awayWin || 'Away'} (Away)</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-[#2a2a32]">
                                {loading && odds.length === 0 ? (
                                    <tr><td colSpan={7} className="py-8 text-center" style={{ color: 'var(--text-muted)' }}>{tc.loading || 'Loading...'}</td></tr>
                                ) : filteredOdds.length === 0 ? (
                                    <tr><td colSpan={7} className="py-8 text-center" style={{ color: 'var(--text-muted)' }}>
                                        {odds.length === 0 ? (tm.noMatches || 'No matches to display.') : (tm.noSportMatches || 'No matches for this sport.')}
                                    </td></tr>
                                ) : (
                                    groupedByLeague.map((group) => (
                                        <React.Fragment key={group.league}>
                                            {/* League Header */}
                                            <tr
                                                onClick={() => toggleLeague(group.league)}
                                                className="cursor-pointer transition-colors"
                                                style={{ background: 'rgba(0,212,255,0.04)' }}
                                                onMouseEnter={e => (e.currentTarget.style.background = 'rgba(0,212,255,0.08)')}
                                                onMouseLeave={e => (e.currentTarget.style.background = 'rgba(0,212,255,0.04)')}
                                            >
                                                <td colSpan={7} className="py-2.5 px-3">
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-[10px] transition-transform" style={{ color: 'var(--text-muted)', display: 'inline-block', transform: collapsedLeagues[group.league] ? 'rotate(-90deg)' : 'rotate(0deg)' }}>▼</span>
                                                        <span className="text-xs font-bold" style={{ color: 'var(--accent-primary)' }}>{group.league}</span>
                                                        <span className="text-[10px] px-1.5 py-0.5 rounded-full" style={{ background: 'rgba(0,212,255,0.1)', color: 'var(--accent-primary)' }}>{group.items.length}</span>
                                                    </div>
                                                </td>
                                            </tr>
                                            {/* League Matches */}
                                            {!collapsedLeagues[group.league] && group.items.map((item) => (
                                                <React.Fragment key={item.globalIdx}>
                                                    <tr
                                                        onClick={() => handleRowClick(item.globalIdx, item.team_home, item.team_away)}
                                                        className="transition-colors duration-150 cursor-pointer"
                                                        style={expandedRow === item.globalIdx
                                                            ? { background: 'rgba(0,212,255,0.05)' }
                                                            : undefined
                                                        }
                                                        onMouseEnter={e => { if (expandedRow !== item.globalIdx) (e.currentTarget as HTMLElement).style.background = 'var(--bg-hover)'; }}
                                                        onMouseLeave={e => { if (expandedRow !== item.globalIdx) (e.currentTarget as HTMLElement).style.background = ''; }}
                                                    >
                                                        {/* AI Badge */}
                                                        {(() => {
                                                            const matchId = `${item.team_home}_${item.team_away}`;
                                                            const pred = aiPredictions[matchId];
                                                            if (!pred) return <td className="py-3 px-2 text-center"><span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>—</span></td>;
                                                            const conf = pred.confidence;
                                                            let badge = '➖';
                                                            let badgeColor = 'rgba(255,255,255,0.3)';
                                                            let badgeBg = 'rgba(255,255,255,0.05)';
                                                            if (conf >= 65) { badge = '🔥'; badgeColor = '#ff6b35'; badgeBg = 'rgba(255,107,53,0.15)'; }
                                                            else if (conf >= 50) { badge = '⭐'; badgeColor = '#fbbf24'; badgeBg = 'rgba(251,191,36,0.12)'; }
                                                            const recLabel = pred.recommendation === 'HOME' ? (tm.homeWin || 'Home') : pred.recommendation === 'AWAY' ? (tm.awayWin || 'Away') : (tm.draw || 'Draw');
                                                            return (
                                                                <td className="py-3 px-1 text-center">
                                                                    <div className="flex flex-col items-center gap-0.5">
                                                                        <span className="text-lg leading-none">{badge}</span>
                                                                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full" style={{ color: badgeColor, background: badgeBg }}>{conf.toFixed(0)}%</span>
                                                                        <span className="text-[9px]" style={{ color: badgeColor }}>{recLabel}</span>
                                                                    </div>
                                                                </td>
                                                            );
                                                        })()}
                                                        <td className="py-3 px-2 text-xs text-center border-r" style={{ color: 'var(--text-muted)', borderColor: 'var(--border-subtle)' }}>
                                                            {(() => {
                                                                const live = findLiveScore(item);
                                                                if (live) {
                                                                    const statusLabel = live.status === 'HT' ? 'HT' : `${live.elapsed}'`;
                                                                    return (
                                                                        <div className="flex flex-col items-center gap-0.5">
                                                                            <div className="flex items-center gap-1">
                                                                                <span className="inline-block w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: '#ef4444' }} />
                                                                                <span className="text-[10px] font-bold" style={{ color: '#ef4444' }}>LIVE</span>
                                                                            </div>
                                                                            <span className="text-sm font-black" style={{ color: 'var(--text-primary)' }}>
                                                                                {live.home_goals} - {live.away_goals}
                                                                            </span>
                                                                            <span className="text-[10px] font-bold" style={{ color: 'var(--accent-primary)' }}>{statusLabel}</span>
                                                                            {live.events && live.events.length > 0 && (() => {
                                                                                const recentEvents = live.events.slice(-3);
                                                                                return (
                                                                                    <div className="flex gap-0.5 mt-0.5">
                                                                                        {recentEvents.map((ev, idx) => (
                                                                                            <span key={idx} className="text-[9px]" title={`${ev.player} (${ev.time}')`}>
                                                                                                {ev.type === 'Goal' ? '⚽' : ev.detail === 'Yellow Card' ? '🟨' : ev.detail === 'Red Card' ? '🟥' : ''}
                                                                                            </span>
                                                                                        ))}
                                                                                    </div>
                                                                                );
                                                                            })()}
                                                                        </div>
                                                                    );
                                                                }
                                                                return <div>{formatTime(item.match_time)}</div>;
                                                            })()}
                                                        </td>
                                                        <td className="py-3 px-4 font-medium text-right truncate" style={{ color: 'var(--text-primary)' }}>
                                                            {item.team_home_ko ? (
                                                                <div className="flex flex-col items-end">
                                                                    <span className="text-base font-bold" style={{ color: 'var(--text-primary)' }}>{item.team_home_ko}</span>
                                                                    <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{item.team_home}</span>
                                                                </div>
                                                            ) : (
                                                                item.team_home
                                                            )}
                                                        </td>
                                                        <td className="py-3 px-2">
                                                            <button
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    handleVote(`${item.team_home}_${item.team_away}`, 'Home', item.home_odds);
                                                                }}
                                                                className={`odds-cell w-full py-2 rounded font-bold text-sm ${votedMatches[`${item.team_home}_${item.team_away}`] === 'Home'
                                                                    ? 'selected'
                                                                    : ''
                                                                    }`}
                                                                style={votedMatches[`${item.team_home}_${item.team_away}`] === 'Home'
                                                                    ? { color: 'var(--accent-primary)' }
                                                                    : { color: 'var(--odds-home)' }
                                                                }
                                                            >
                                                                {item.home_odds.toFixed(2)}
                                                            </button>
                                                        </td>
                                                        <td className="py-3 px-2">
                                                            {item.draw_odds > 0 ? (
                                                                <button
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        handleVote(`${item.team_home}_${item.team_away}`, 'Draw', item.draw_odds);
                                                                    }}
                                                                    className={`odds-cell w-full py-2 rounded font-bold text-sm ${votedMatches[`${item.team_home}_${item.team_away}`] === 'Draw'
                                                                        ? 'selected'
                                                                        : ''
                                                                        }`}
                                                                    style={votedMatches[`${item.team_home}_${item.team_away}`] === 'Draw'
                                                                        ? { color: 'var(--accent-primary)' }
                                                                        : { color: 'var(--odds-draw)' }
                                                                    }
                                                                >
                                                                    {item.draw_odds.toFixed(2)}
                                                                </button>
                                                            ) : (
                                                                <span className="block w-full py-2 text-center text-sm font-bold" style={{ color: 'var(--text-muted)', opacity: 0.4 }}>-</span>
                                                            )}
                                                        </td>
                                                        <td className="py-3 px-2">
                                                            <button
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    handleVote(`${item.team_home}_${item.team_away}`, 'Away', item.away_odds);
                                                                }}
                                                                className={`odds-cell w-full py-2 rounded font-bold text-sm ${votedMatches[`${item.team_home}_${item.team_away}`] === 'Away'
                                                                    ? 'selected'
                                                                    : ''
                                                                    }`}
                                                                style={votedMatches[`${item.team_home}_${item.team_away}`] === 'Away'
                                                                    ? { color: 'var(--accent-primary)' }
                                                                    : { color: 'var(--odds-away)' }
                                                                }
                                                            >
                                                                {item.away_odds.toFixed(2)}
                                                            </button>
                                                        </td>
                                                        <td className="py-3 px-4 font-medium text-left truncate" style={{ color: 'var(--text-primary)' }}>
                                                            {item.team_away_ko ? (
                                                                <div className="flex flex-col items-start">
                                                                    <span className="text-base font-bold" style={{ color: 'var(--text-primary)' }}>{item.team_away_ko}</span>
                                                                    <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{item.team_away}</span>
                                                                </div>
                                                            ) : (
                                                                item.team_away
                                                            )}
                                                        </td>
                                                    </tr>
                                                    {expandedRow === item.globalIdx && (
                                                        <tr>
                                                            <td colSpan={7} className="p-0 border-b" style={{ background: 'var(--bg-card)', borderColor: 'var(--border-subtle)' }}>
                                                                {/* Tab Navigation */}
                                                                <div className="flex border-b" style={{ borderColor: 'var(--border-subtle)' }}>
                                                                    {[
                                                                        { key: 'ai', icon: '🧠', label: tm.tabAI || 'AI Analysis' },
                                                                        { key: 'standings', icon: '📊', label: tm.tabStandingsForm || 'Standings·Form' },
                                                                        { key: 'recent', icon: '⚽', label: tm.tabRecentMatches || 'Recent Matches' },
                                                                        { key: 'lineups', icon: '👕', label: tm.tabLineups || 'Lineups' },
                                                                    ].map(tab => (
                                                                        <button
                                                                            key={tab.key}
                                                                            onClick={(e) => { e.stopPropagation(); setActiveDetailTab(tab.key); }}
                                                                            className="flex-1 py-2.5 text-xs font-bold transition-all relative"
                                                                            style={{
                                                                                color: activeDetailTab === tab.key ? 'var(--accent-primary)' : 'var(--text-muted)',
                                                                                background: activeDetailTab === tab.key ? 'rgba(0,212,255,0.05)' : 'transparent',
                                                                            }}
                                                                        >
                                                                            <span>{tab.icon} {tab.label}</span>
                                                                            {activeDetailTab === tab.key && (
                                                                                <div className="absolute bottom-0 left-1/4 right-1/4 h-0.5 rounded-full" style={{ background: 'var(--accent-primary)' }} />
                                                                            )}
                                                                        </button>
                                                                    ))}
                                                                </div>

                                                                <div className="p-4 max-w-3xl mx-auto">
                                                                    {/* === AI분석 Tab === */}
                                                                    {activeDetailTab === 'ai' && (
                                                                        <div>
                                                                            {historyLoading ? (
                                                                                <div className="text-center py-4" style={{ color: 'var(--text-muted)' }}>{tc.loading || 'Loading...'}</div>
                                                                            ) : historyData.length >= 2 ? (
                                                                                <OddsHistoryChart data={historyData} />
                                                                            ) : (
                                                                                /* 데이터 차트 데이터 없을 때 → 현재 데이터 지표 비교 카드 */
                                                                                <div className="rounded-xl p-4" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}>
                                                                                    <h3 className="text-xs font-bold mb-3 flex items-center gap-1.5" style={{ color: 'var(--text-muted)' }}>📊 {tm.oddsAnalysis || 'Current Odds Analysis'}</h3>
                                                                                    <div className="grid grid-cols-3 gap-3">
                                                                                        <div className="text-center p-3 rounded-lg" style={{ background: 'rgba(0,212,255,0.06)', border: '1px solid rgba(0,212,255,0.15)' }}>
                                                                                            <div className="text-[10px] mb-1" style={{ color: 'var(--text-muted)' }}>{tm.homeWin || 'Home'}</div>
                                                                                            <div className="text-lg font-bold" style={{ color: '#00d4ff' }}>{item.home_odds?.toFixed(2) || '-'}</div>
                                                                                            <div className="text-[10px] mt-1 font-medium" style={{ color: 'rgba(0,212,255,0.7)' }}>
                                                                                                {item.home_odds > 0 ? `${((1 / item.home_odds) / ((1 / item.home_odds) + (1 / (item.draw_odds || 999)) + (1 / item.away_odds)) * 100).toFixed(0)}%` : '-'}
                                                                                            </div>
                                                                                        </div>
                                                                                        <div className="text-center p-3 rounded-lg" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-subtle)' }}>
                                                                                            <div className="text-[10px] mb-1" style={{ color: 'var(--text-muted)' }}>{tm.draw || 'Draw'}</div>
                                                                                            <div className="text-lg font-bold" style={{ color: 'var(--text-secondary)' }}>{item.draw_odds?.toFixed(2) || '-'}</div>
                                                                                            <div className="text-[10px] mt-1 font-medium" style={{ color: 'var(--text-muted)' }}>
                                                                                                {item.draw_odds > 0 ? `${((1 / item.draw_odds) / ((1 / item.home_odds) + (1 / item.draw_odds) + (1 / item.away_odds)) * 100).toFixed(0)}%` : '-'}
                                                                                            </div>
                                                                                        </div>
                                                                                        <div className="text-center p-3 rounded-lg" style={{ background: 'rgba(139,92,246,0.06)', border: '1px solid rgba(139,92,246,0.15)' }}>
                                                                                            <div className="text-[10px] mb-1" style={{ color: 'var(--text-muted)' }}>{tm.awayWin || 'Away'}</div>
                                                                                            <div className="text-lg font-bold" style={{ color: '#8b5cf6' }}>{item.away_odds?.toFixed(2) || '-'}</div>
                                                                                            <div className="text-[10px] mt-1 font-medium" style={{ color: 'rgba(139,92,246,0.7)' }}>
                                                                                                {item.away_odds > 0 ? `${((1 / item.away_odds) / ((1 / item.home_odds) + (1 / (item.draw_odds || 999)) + (1 / item.away_odds)) * 100).toFixed(0)}%` : '-'}
                                                                                            </div>
                                                                                        </div>
                                                                                    </div>
                                                                                </div>
                                                                            )}
                                                                            {(() => {
                                                                                const matchId = `${item.team_home}_${item.team_away}`;
                                                                                const pred = aiPredictions[matchId];

                                                                                // pred가 없으면 데이터 지표 기반 즉석 분석 생성
                                                                                if (!pred) {
                                                                                    const h = item.home_odds > 0 ? 1 / item.home_odds : 0;
                                                                                    const d = item.draw_odds > 0 ? 1 / item.draw_odds : 0;
                                                                                    const a = item.away_odds > 0 ? 1 / item.away_odds : 0;
                                                                                    const total = h + d + a;
                                                                                    if (total <= 0) return <div className="text-center py-6 text-[var(--text-muted)] text-sm">{tm.noOddsData || 'No odds data available.'}</div>;

                                                                                    const homePct = (h / total) * 100;
                                                                                    const drawPct = (d / total) * 100;
                                                                                    const awayPct = (a / total) * 100;
                                                                                    const maxPct = Math.max(homePct, drawPct, awayPct);
                                                                                    const rec = homePct === maxPct ? 'HOME' : awayPct === maxPct ? 'AWAY' : 'DRAW';
                                                                                    const recLabel = rec === 'HOME' ? `${item.team_home_ko ? `${item.team_home_ko}(${item.team_home})` : item.team_home} ${tm.win || 'Win'}` : rec === 'AWAY' ? `${item.team_away_ko ? `${item.team_away_ko}(${item.team_away})` : item.team_away} ${tm.win || 'Win'}` : (tm.draw || 'Draw');

                                                                                    return (
                                                                                        <div className="mt-4 surface-card p-4">
                                                                                            <div className="flex items-center justify-between mb-3">
                                                                                                <span className="text-xs font-bold text-[var(--accent-primary)] flex items-center gap-1.5">📈 {tm.oddsImplied || 'Odds-Implied Analysis'}</span>
                                                                                                <span className="text-[10px] px-2 py-0.5 rounded-full font-bold" style={{ background: 'rgba(0,212,255,0.1)', color: '#00d4ff' }}>
                                                                                                    {recLabel} {maxPct.toFixed(0)}%
                                                                                                </span>
                                                                                            </div>
                                                                                            <div className="mb-3">
                                                                                                <div className="flex justify-between text-[10px] mb-1" style={{ color: 'var(--text-muted)' }}>
                                                                                                    <span>{tm.homeWin || 'Home'} {homePct.toFixed(0)}%</span><span>{tm.draw || 'Draw'} {drawPct.toFixed(0)}%</span><span>{tm.awayWin || 'Away'} {awayPct.toFixed(0)}%</span>
                                                                                                </div>
                                                                                                <div className="flex h-3 rounded-lg overflow-hidden" style={{ background: 'var(--bg-primary)' }}>
                                                                                                    <div style={{ width: `${homePct}%`, background: 'rgba(0,212,255,0.6)' }} className="transition-all duration-700" />
                                                                                                    <div style={{ width: `${drawPct}%`, background: 'rgba(255,255,255,0.12)' }} className="transition-all duration-700" />
                                                                                                    <div style={{ width: `${awayPct}%`, background: 'rgba(139,92,246,0.6)' }} className="transition-all duration-700" />
                                                                                                </div>
                                                                                            </div>
                                                                                            <div className="grid grid-cols-2 gap-2 mb-2">
                                                                                                <div className="rounded-lg p-2 text-[10px]" style={{ background: 'var(--bg-primary)', border: '1px solid var(--border-subtle)' }}>
                                                                                                    <div className="font-bold mb-0.5" style={{ color: 'var(--accent-primary)' }}>{tm.impliedProb || 'Implied Probability'}</div>
                                                                                                    <div style={{ color: 'var(--text-secondary)' }}>{tm.homeWin || 'Home'} {homePct.toFixed(0)}% / {tm.draw || 'D'} {drawPct.toFixed(0)}% / {tm.awayWin || 'Away'} {awayPct.toFixed(0)}%</div>
                                                                                                </div>
                                                                                                <div className="rounded-lg p-2 text-[10px]" style={{ background: 'var(--bg-primary)', border: '1px solid var(--border-subtle)' }}>
                                                                                                    <div className="font-bold mb-0.5" style={{ color: 'var(--accent-primary)' }}>{tm.margin || 'Margin'}</div>
                                                                                                    <div style={{ color: 'var(--text-secondary)' }}>{tm.bookmakerMargin || 'Bookmaker Margin'} {((total - 1) * 100).toFixed(1)}%</div>
                                                                                                </div>
                                                                                            </div>
                                                                                            <div className="text-[9px] p-2 rounded-lg" style={{ background: 'rgba(251,191,36,0.05)', border: '1px solid rgba(251,191,36,0.15)', color: 'var(--text-muted)' }}>
                                                                                                💡 {tm.autoUpgradeNotice || 'When standings, form, and injury data is collected from the server, it will be automatically upgraded to 6-Factor AI analysis.'}
                                                                                            </div>
                                                                                            <div className="mt-3 pt-2 flex flex-wrap gap-1.5 items-center" style={{ borderTop: '1px solid var(--border-subtle)' }}>
                                                                                                <span className="text-[9px]" style={{ color: 'var(--text-muted)' }}>{tm.analysisSources || 'Analysis Sources'}:</span>
                                                                                                <span className="text-[8px] px-1.5 py-0.5 rounded-full font-medium" style={{ background: 'rgba(53,199,89,0.1)', color: '#35c759', border: '1px solid rgba(53,199,89,0.25)' }}>API-Football</span>
                                                                                            </div>
                                                                                        </div>
                                                                                    );
                                                                                }

                                                                                // pred가 있을 때 → Pro 분석 패널
                                                                                return (
                                                                                    <ProAnalysisPanel
                                                                                        prediction={pred}
                                                                                        injuries={matchDetail?.injuries}
                                                                                        homeTeam={item.team_home_ko ? `${item.team_home_ko}(${item.team_home})` : item.team_home}
                                                                                        awayTeam={item.team_away_ko ? `${item.team_away_ko}(${item.team_away})` : item.team_away}
                                                                                        historyData={historyData}
                                                                                        userTier={user?.tier || 'free'}
                                                                                    />
                                                                                );
                                                                            })()}

                                                                            {/* 승부 예측 투표 */}
                                                                            {(() => {
                                                                                const matchId = `${item.team_home}_${item.team_away}`;
                                                                                const stat = voteStats[matchId] || { home_pct: 0, draw_pct: 0, away_pct: 0, total_votes: 0 };
                                                                                const voted = votedMatches[matchId];
                                                                                const hasVotes = stat.total_votes > 0;
                                                                                return (
                                                                                    <div className="mt-4 surface-card p-4">
                                                                                        <div className="flex items-center justify-between mb-3">
                                                                                            <span className="text-xs font-bold text-[var(--accent-primary)] flex items-center gap-1.5">🗳️ {tm.predictionVote || 'Prediction Vote'}</span>
                                                                                            <span className="text-[10px] text-[var(--text-muted)]">{stat.total_votes} {tm.participants || 'votes'}</span>
                                                                                        </div>
                                                                                        {hasVotes && (
                                                                                            <div className="mb-3 flex h-5 rounded-lg overflow-hidden" style={{ background: 'var(--bg-primary)' }}>
                                                                                                <div style={{ width: `${stat.home_pct}%` }} className="flex items-center justify-center transition-all duration-700" title="홈승">
                                                                                                    <div className="w-full h-full" style={{ background: 'rgba(0,212,255,0.5)' }}>
                                                                                                        {stat.home_pct > 12 && <span className="text-white text-[9px] font-bold flex items-center justify-center h-full">{stat.home_pct}%</span>}
                                                                                                    </div>
                                                                                                </div>
                                                                                                <div style={{ width: `${stat.draw_pct}%` }} className="flex items-center justify-center transition-all duration-700" title="무승부">
                                                                                                    <div className="w-full h-full" style={{ background: 'rgba(255,255,255,0.12)' }}>
                                                                                                        {stat.draw_pct > 12 && <span className="text-white/60 text-[9px] font-bold flex items-center justify-center h-full">{stat.draw_pct}%</span>}
                                                                                                    </div>
                                                                                                </div>
                                                                                                <div style={{ width: `${stat.away_pct}%` }} className="flex items-center justify-center transition-all duration-700" title="원정승">
                                                                                                    <div className="w-full h-full" style={{ background: 'rgba(139,92,246,0.5)' }}>
                                                                                                        {stat.away_pct > 12 && <span className="text-white text-[9px] font-bold flex items-center justify-center h-full">{stat.away_pct}%</span>}
                                                                                                    </div>
                                                                                                </div>
                                                                                            </div>
                                                                                        )}
                                                                                        {voted ? (
                                                                                            (() => {
                                                                                                const result = matchResults[matchId];
                                                                                                const selLabel = voted === 'Home' ? (tm.homeWin || 'Home') : voted === 'Draw' ? (tm.draw || 'Draw') : (tm.awayWin || 'Away');
                                                                                                if (result?.status === 'WON') {
                                                                                                    return (
                                                                                                        <div className="text-center py-2 rounded-lg border border-[rgba(34,197,94,0.4)] bg-[rgba(34,197,94,0.1)]">
                                                                                                            <span className="text-green-400 font-bold text-xs">🎉 {tm.hitResult || 'Hit!'} &quot;{selLabel}&quot; +10P</span>
                                                                                                        </div>
                                                                                                    );
                                                                                                } else if (result?.status === 'LOST') {
                                                                                                    return (
                                                                                                        <div className="text-center py-2 rounded-lg border border-[rgba(239,68,68,0.3)] bg-[rgba(239,68,68,0.08)]">
                                                                                                            <span className="text-red-400 font-bold text-xs">❌ {tm.missResult || 'Miss'} &quot;{selLabel}&quot; +1P</span>
                                                                                                        </div>
                                                                                                    );
                                                                                                } else {
                                                                                                    return (
                                                                                                        <div className="text-center py-2 rounded-lg border border-[rgba(0,212,255,0.2)] bg-[rgba(0,212,255,0.05)]">
                                                                                                            <span className="text-[var(--accent-primary)] font-bold text-xs">⏳ &quot;{selLabel}&quot; {tm.pendingResult || 'Awaiting result'}</span>
                                                                                                        </div>
                                                                                                    );
                                                                                                }
                                                                                            })()
                                                                                        ) : (
                                                                                            <div className="grid grid-cols-3 gap-2">
                                                                                                <button onClick={(e) => { e.stopPropagation(); handleVote(matchId, 'Home', item.home_odds); }} className="py-2.5 rounded-lg border border-[var(--border-subtle)] hover:bg-[rgba(0,212,255,0.08)] hover:border-[rgba(0,212,255,0.3)] text-xs font-bold text-[var(--text-secondary)] transition-all active:scale-95">{tm.homeWin || 'Home'}</button>
                                                                                                <button onClick={(e) => { e.stopPropagation(); handleVote(matchId, 'Draw', item.draw_odds); }} className="py-2.5 rounded-lg border border-[var(--border-subtle)] hover:bg-white/5 hover:border-[var(--border-default)] text-xs font-bold text-[var(--text-secondary)] transition-all active:scale-95">{tm.draw || 'Draw'}</button>
                                                                                                <button onClick={(e) => { e.stopPropagation(); handleVote(matchId, 'Away', item.away_odds); }} className="py-2.5 rounded-lg border border-[var(--border-subtle)] hover:bg-[rgba(139,92,246,0.08)] hover:border-[rgba(139,92,246,0.3)] text-xs font-bold text-[var(--text-secondary)] transition-all active:scale-95">{tm.awayWin || 'Away'}</button>
                                                                                            </div>
                                                                                        )}
                                                                                    </div>
                                                                                );
                                                                            })()}
                                                                        </div>
                                                                    )}

                                                                    {/* === 순위·폼 Tab === */}
                                                                    {activeDetailTab === 'standings' && (
                                                                        <div>
                                                                            {matchDetailLoading ? (
                                                                                <div className="text-center py-8" style={{ color: 'var(--text-muted)' }}>
                                                                                    <div className="animate-pulse">📊 {tm.loadingStandings || 'Loading standings...'}</div>
                                                                                </div>
                                                                            ) : matchDetail?.standings?.home || matchDetail?.standings?.away ? (
                                                                                <div className="space-y-4">
                                                                                    <div className="text-xs font-bold mb-3" style={{ color: 'var(--accent-primary)' }}>📊 {tm.leagueStandings || 'League Standings Comparison'}</div>
                                                                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                                                                        {[{ label: tm.homeWin || 'Home', team: item.team_home_ko || item.team_home, data: matchDetail?.standings?.home, color: '#00d4ff' },
                                                                                        { label: tm.awayWin || 'Away', team: item.team_away_ko || item.team_away, data: matchDetail?.standings?.away, color: '#8b5cf6' }].map((side, si) => (
                                                                                            <div key={si} className="rounded-xl p-3" style={{ background: 'var(--bg-primary)', border: `1px solid ${side.color}20` }}>
                                                                                                <div className="flex items-center justify-between mb-2">
                                                                                                    <span className="text-xs font-bold" style={{ color: side.color }}>{side.label} {side.team}</span>
                                                                                                    {side.data && <span className="text-lg font-black" style={{ color: side.color }}>#{side.data.rank}</span>}
                                                                                                </div>
                                                                                                {side.data ? (
                                                                                                    <div>
                                                                                                        <div className="grid grid-cols-4 gap-1 text-center text-[10px] mb-2">
                                                                                                            <div className="rounded p-1" style={{ background: 'var(--bg-card)' }}>
                                                                                                                <div style={{ color: 'var(--text-muted)' }}>{tm.played || 'P'}</div>
                                                                                                                <div className="font-bold" style={{ color: 'var(--text-primary)' }}>{side.data.played}</div>
                                                                                                            </div>
                                                                                                            <div className="rounded p-1" style={{ background: 'var(--bg-card)' }}>
                                                                                                                <div style={{ color: 'var(--text-muted)' }}>{tm.wins || 'W'}</div>
                                                                                                                <div className="font-bold" style={{ color: '#35c759' }}>{side.data.wins}</div>
                                                                                                            </div>
                                                                                                            <div className="rounded p-1" style={{ background: 'var(--bg-card)' }}>
                                                                                                                <div style={{ color: 'var(--text-muted)' }}>{tm.draws || 'D'}</div>
                                                                                                                <div className="font-bold" style={{ color: 'var(--text-secondary)' }}>{side.data.draws}</div>
                                                                                                            </div>
                                                                                                            <div className="rounded p-1" style={{ background: 'var(--bg-card)' }}>
                                                                                                                <div style={{ color: 'var(--text-muted)' }}>{tm.losses || 'L'}</div>
                                                                                                                <div className="font-bold" style={{ color: '#ef4444' }}>{side.data.losses}</div>
                                                                                                            </div>
                                                                                                        </div>
                                                                                                        <div className="flex items-center justify-between text-[10px] mb-1">
                                                                                                            <span style={{ color: 'var(--text-muted)' }}>{tm.goalDiff || 'GD'}: {side.data.goals_for}-{side.data.goals_against} ({side.data.goal_diff > 0 ? '+' : ''}{side.data.goal_diff})</span>
                                                                                                            <span className="font-bold" style={{ color: side.color }}>{tm.points || 'Points'} {side.data.points}</span>
                                                                                                        </div>
                                                                                                        {side.data.form && (
                                                                                                            <div className="flex items-center gap-1 mt-2">
                                                                                                                <span className="text-[9px]" style={{ color: 'var(--text-muted)' }}>{tm.recent || 'Recent'}:</span>
                                                                                                                {side.data.form.split('').map((r: string, ri: number) => (
                                                                                                                    <span key={ri} className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold text-white"
                                                                                                                        style={{ background: r === 'W' ? '#35c759' : r === 'D' ? '#fbbf24' : '#ef4444' }}>
                                                                                                                        {r === 'W' ? (tm.wins || 'W') : r === 'D' ? (tm.draws || 'D') : (tm.losses || 'L')}
                                                                                                                    </span>
                                                                                                                ))}
                                                                                                            </div>
                                                                                                        )}
                                                                                                    </div>
                                                                                                ) : (
                                                                                                    <div className="text-[10px] py-2" style={{ color: 'var(--text-muted)' }}>{tm.noStandingsData || 'No standings data'}</div>
                                                                                                )}
                                                                                            </div>
                                                                                        ))}
                                                                                    </div>
                                                                                    {/* Injuries section */}
                                                                                    {matchDetail && (matchDetail.injuries.home.length > 0 || matchDetail.injuries.away.length > 0) && (
                                                                                        <div className="mt-3 p-3 rounded-xl" style={{ background: 'rgba(239,68,68,0.05)', border: '1px solid rgba(239,68,68,0.15)' }}>
                                                                                            <div className="text-xs font-bold mb-2" style={{ color: '#f87171' }}>🏥 {tm.injuries || 'Injuries/Absent'}</div>
                                                                                            <div className="grid grid-cols-2 gap-2 text-[10px]">
                                                                                                <div>
                                                                                                    <div className="font-bold mb-1" style={{ color: '#00d4ff' }}>{tm.homeWin || 'Home'}</div>
                                                                                                    {matchDetail.injuries.home.length > 0 ? matchDetail.injuries.home.map((inj, ii) => (
                                                                                                        <div key={ii} style={{ color: 'var(--text-muted)' }}>{inj.player_name} ({inj.reason})</div>
                                                                                                    )) : <div style={{ color: 'var(--text-muted)' }}>{tm.none || 'None'}</div>}
                                                                                                </div>
                                                                                                <div>
                                                                                                    <div className="font-bold mb-1" style={{ color: '#8b5cf6' }}>{tm.awayWin || 'Away'}</div>
                                                                                                    {matchDetail.injuries.away.length > 0 ? matchDetail.injuries.away.map((inj, ii) => (
                                                                                                        <div key={ii} style={{ color: 'var(--text-muted)' }}>{inj.player_name} ({inj.reason})</div>
                                                                                                    )) : <div style={{ color: 'var(--text-muted)' }}>{tm.none || 'None'}</div>}
                                                                                                </div>
                                                                                            </div>
                                                                                        </div>
                                                                                    )}
                                                                                </div>
                                                                            ) : (
                                                                                <div className="text-center py-8" style={{ color: 'var(--text-muted)' }}>
                                                                                    <div className="text-2xl mb-2">📊</div>
                                                                                    <div className="text-sm">{tm.noStandingsData || 'No standings data'}</div>
                                                                                    <div className="text-xs mt-1">{tm.dataCollectionNeeded || 'Data collection is needed (AI Prediction → Data Collection)'}</div>
                                                                                </div>
                                                                            )}
                                                                        </div>
                                                                    )}

                                                                    {/* === 최근경기 Tab === */}
                                                                    {activeDetailTab === 'recent' && (
                                                                        <div>
                                                                            {matchDetailLoading ? (
                                                                                <div className="text-center py-8" style={{ color: 'var(--text-muted)' }}>
                                                                                    <div className="animate-pulse">⚽ {tm.loadingRecent || 'Loading recent matches...'}</div>
                                                                                </div>
                                                                            ) : (matchDetail?.recent_matches?.home?.length || 0) > 0 || (matchDetail?.recent_matches?.away?.length || 0) > 0 ? (
                                                                                <div className="space-y-4">
                                                                                    {[{ label: tm.homeWin || 'Home', team: item.team_home_ko || item.team_home, matches: matchDetail?.recent_matches?.home || [], color: '#00d4ff' },
                                                                                    { label: tm.awayWin || 'Away', team: item.team_away_ko || item.team_away, matches: matchDetail?.recent_matches?.away || [], color: '#8b5cf6' }].map((side, si) => (
                                                                                        <div key={si}>
                                                                                            <div className="text-xs font-bold mb-2 flex items-center gap-1.5">
                                                                                                <span style={{ color: side.color }}>{side.label}</span>
                                                                                                <span style={{ color: 'var(--text-primary)' }}>{side.team} {tm.recentCount || 'last'} {side.matches.length} {tm.matches || 'matches'}</span>
                                                                                            </div>
                                                                                            {side.matches.length > 0 ? (
                                                                                                <div className="space-y-1">
                                                                                                    {side.matches.map((m, mi) => {
                                                                                                        const isHome = m.home.toLowerCase().includes(side.team.toLowerCase()) || side.team.toLowerCase().includes(m.home.toLowerCase());
                                                                                                        const won = isHome ? m.home_goals > m.away_goals : m.away_goals > m.home_goals;
                                                                                                        const drew = m.home_goals === m.away_goals;
                                                                                                        const resultColor = won ? '#35c759' : drew ? '#fbbf24' : '#ef4444';
                                                                                                        const resultText = won ? 'W' : drew ? 'D' : 'L';
                                                                                                        return (
                                                                                                            <div key={mi} className="flex items-center gap-2 px-3 py-2 rounded-lg text-[11px]" style={{ background: 'var(--bg-primary)', border: '1px solid var(--border-subtle)' }}>
                                                                                                                <span className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold text-white flex-shrink-0" style={{ background: resultColor }}>{resultText}</span>
                                                                                                                <span className="flex-1 truncate" style={{ color: 'var(--text-secondary)' }}>{m.home}</span>
                                                                                                                <span className="font-bold px-2" style={{ color: 'var(--text-primary)' }}>{m.home_goals} - {m.away_goals}</span>
                                                                                                                <span className="flex-1 truncate text-right" style={{ color: 'var(--text-secondary)' }}>{m.away}</span>
                                                                                                                <span className="text-[9px] flex-shrink-0 w-16 text-right" style={{ color: 'var(--text-muted)' }}>{m.league?.slice(0, 8) || ''}</span>
                                                                                                            </div>
                                                                                                        );
                                                                                                    })}
                                                                                                </div>
                                                                                            ) : (
                                                                                                <div className="text-[11px] py-2" style={{ color: 'var(--text-muted)' }}>{tm.noRecentData || 'No recent match data'}</div>
                                                                                            )}
                                                                                        </div>
                                                                                    ))}
                                                                                </div>
                                                                            ) : (
                                                                                <div className="text-center py-8" style={{ color: 'var(--text-muted)' }}>
                                                                                    <div className="text-2xl mb-2">⚽</div>
                                                                                    <div className="text-sm">{tm.noRecentData || 'No recent match data'}</div>
                                                                                    <div className="text-xs mt-1">{tm.apiDataNeeded || 'API data collection is needed'}</div>
                                                                                </div>
                                                                            )}
                                                                        </div>
                                                                    )}

                                                                    {/* === 라인업 Tab === */}
                                                                    {activeDetailTab === 'lineups' && (
                                                                        <div>
                                                                            {matchDetailLoading ? (
                                                                                <div className="text-center py-8" style={{ color: 'var(--text-muted)' }}>
                                                                                    <div className="animate-pulse">👕 {tm.loadingLineups || 'Loading lineups...'}</div>
                                                                                </div>
                                                                            ) : matchDetail?.lineups ? (
                                                                                <div className="space-y-4">
                                                                                    {Object.entries(matchDetail.lineups).map(([teamName, lineup], li) => (
                                                                                        <div key={li} className="rounded-xl p-3" style={{ background: 'var(--bg-primary)', border: `1px solid ${li === 0 ? '#00d4ff' : '#8b5cf6'}20` }}>
                                                                                            <div className="flex items-center justify-between mb-3">
                                                                                                <span className="text-xs font-bold" style={{ color: li === 0 ? '#00d4ff' : '#8b5cf6' }}>{teamName}</span>
                                                                                                <div className="flex items-center gap-2">
                                                                                                    <span className="text-[10px] px-2 py-0.5 rounded-full font-bold" style={{ background: 'rgba(0,212,255,0.1)', color: 'var(--accent-primary)' }}>⚙ {lineup.formation}</span>
                                                                                                    {lineup.coach && <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{tm.coach || 'Coach'}: {lineup.coach}</span>}
                                                                                                </div>
                                                                                            </div>
                                                                                            <div className="text-[10px] font-bold mb-1" style={{ color: 'var(--text-secondary)' }}>{tm.startingXI || 'Starting XI'}</div>
                                                                                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-1 mb-3">
                                                                                                {lineup.starters.map((p, pi) => (
                                                                                                    <div key={pi} className="flex items-center gap-1.5 px-2 py-1 rounded" style={{ background: 'var(--bg-card)' }}>
                                                                                                        <span className="text-[10px] font-bold w-5 text-center" style={{ color: li === 0 ? '#00d4ff' : '#8b5cf6' }}>#{p.number}</span>
                                                                                                        <span className="text-[10px] truncate" style={{ color: 'var(--text-primary)' }}>{p.name}</span>
                                                                                                        <span className="text-[8px] ml-auto px-1 rounded" style={{ color: 'var(--text-muted)', background: 'var(--bg-primary)' }}>{p.pos}</span>
                                                                                                    </div>
                                                                                                ))}
                                                                                            </div>
                                                                                            {lineup.substitutes.length > 0 && (
                                                                                                <div>
                                                                                                    <div className="text-[10px] font-bold mb-1" style={{ color: 'var(--text-muted)' }}>{tm.substitutes || 'Substitutes'}</div>
                                                                                                    <div className="flex flex-wrap gap-1">
                                                                                                        {lineup.substitutes.slice(0, 7).map((p, pi) => (
                                                                                                            <span key={pi} className="text-[9px] px-1.5 py-0.5 rounded" style={{ background: 'var(--bg-card)', color: 'var(--text-muted)' }}>#{p.number} {p.name}</span>
                                                                                                        ))}
                                                                                                    </div>
                                                                                                </div>
                                                                                            )}
                                                                                        </div>
                                                                                    ))}
                                                                                </div>
                                                                            ) : (
                                                                                <div className="text-center py-8" style={{ color: 'var(--text-muted)' }}>
                                                                                    <div className="text-2xl mb-2">👕</div>
                                                                                    <div className="text-sm">{tm.noLineupsYet || 'Lineups have not been announced yet'}</div>
                                                                                    <div className="text-xs mt-1">{tm.lineupsAvailable || 'Usually available 1 hour before kickoff'}</div>
                                                                                </div>
                                                                            )}
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    )}
                                                </React.Fragment>
                                            ))}
                                        </React.Fragment>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </main>

            {/* Tour Restart FAB */}
            <div className="fixed bottom-24 right-4 z-50 sm:bottom-6 sm:right-6">
                <TourRestartButton
                    tourId="market"
                    onRestart={() => setTourForceStart(true)}
                    label={tm.guideTour || 'Guide Tour'}
                />
            </div>

            <OnboardingTour
                steps={marketTourSteps}
                tourId="market"
                delay={1500}
                forceStart={tourForceStart}
                onComplete={() => setTourForceStart(false)}
                onSkip={() => setTourForceStart(false)}
            />
        </div>
    );
}
