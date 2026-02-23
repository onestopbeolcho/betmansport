"use client";
import React, { useEffect, useState, useMemo } from 'react';
import DeadlineBanner from '../components/DeadlineBanner';
import Navbar from '../components/Navbar';
import OddsHistoryChart from '../components/OddsHistoryChart'; // Import Chart
import { useCart, CartItem } from '../../context/CartContext';

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
    events: { time: number; type: string; detail: string; player: string; team: string }[];
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
    const [odds, setOdds] = useState<OddsItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const { addToCart, cartItems } = useCart();
    const [aiPredictions, setAiPredictions] = useState<Record<string, AIPrediction>>({});

    const [selectedSport, setSelectedSport] = useState<string>('ALL');

    const filteredOdds = odds.filter(item => {
        if (selectedSport === 'ALL') return true;
        return item.sport.toUpperCase() === selectedSport;
    });

    // Dynamic sport tabs with icons & counts
    const sportTabs = useMemo(() => {
        const iconMap: Record<string, string> = { SOCCER: '⚽', BASKETBALL: '🏀', BASEBALL: '⚾', ICEHOCKEY: '🏒' };
        const labelMap: Record<string, string> = { SOCCER: '축구', BASKETBALL: '농구', BASEBALL: '야구', ICEHOCKEY: '하키' };
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
        setLoading(true);
        setError('');
        try {
            const res = await fetch(`${API_BASE_URL}/api/market/pinnacle`);
            if (!res.ok) throw new Error('Failed to fetch market data');
            const data = await res.json();
            setOdds(data);
        } catch (err) {
            setError('시장 데이터를 불러오는데 실패했습니다.');
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
            alert(`이미 이 경기에 투표했습니다.`);
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
                alert(`투표 실패: ${err.detail || '오류'}`);
            }
        } catch { console.error('Vote failed'); }
    };

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
        // 60초마다 라이브 스코어 폴링
        const liveInterval = setInterval(fetchLiveScores, 60000);
        return () => clearInterval(liveInterval);
    }, []);

    return (
        <div className="min-h-screen flex flex-col font-sans" style={{ background: 'var(--bg-primary)' }}>
            <DeadlineBanner />
            <Navbar />

            <main className="flex-grow max-w-7xl mx-auto px-2 sm:px-6 lg:px-8 py-6 w-full pb-32">
                <div className="flex flex-col md:flex-row justify-between items-end mb-4 border-b border-white/10 pb-3 gap-4">
                    <div>
                        <h2 className="text-xl font-bold flex items-center" style={{ color: 'var(--text-primary)' }}>
                            <span className="w-2 h-6 rounded-sm mr-2" style={{ background: 'var(--accent-primary)' }}></span>
                            전체 경기 분석
                        </h2>
                        <p className="text-sm mt-1 ml-4 flex items-center gap-2" style={{ color: 'var(--text-muted)' }}>
                            해외 4대 데이터 소스 AI 종합 분석
                            {liveCount > 0 && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold" style={{ background: 'rgba(239,68,68,0.15)', color: '#ef4444' }}>
                                    <span className="inline-block w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: '#ef4444' }} />
                                    {liveCount}경기 진행중
                                </span>
                            )}
                        </p>
                    </div>

                    {/* Data Source Branding Banner */}
                    <div className="flex items-center gap-3 flex-wrap">
                        {[
                            { name: 'The Odds API', icon: '📊', color: '#00d4ff' },
                            { name: 'API-Football', icon: '⚽', color: '#35c759' },
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
                            🧠 AI 종합분석
                        </div>
                    </div>

                    <div className="flex flex-wrap gap-2">
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
                            🏆 전체 <span className="ml-0.5 opacity-70">{odds.length}</span>
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
                            {loading ? '로딩 중...' : '🔄 새로고침'}
                        </button>
                    </div>
                </div>

                {error && (
                    <div className="p-3 rounded text-sm mb-4 border border-red-500/30" style={{ background: 'rgba(239,68,68,0.1)', color: '#f87171' }}>
                        {error}
                    </div>
                )}

                {/* Odds Table */}
                <div className="overflow-hidden rounded-lg border" style={{ background: 'var(--bg-surface)', borderColor: 'var(--border-subtle)' }}>
                    <div className="overflow-x-auto">
                        <table className="min-w-full text-center text-sm">
                            <thead className="uppercase text-xs font-semibold tracking-wider border-b" style={{ background: 'var(--bg-card)', color: 'var(--text-muted)', borderColor: 'var(--border-subtle)' }}>
                                <tr>
                                    <th className="py-3 px-2 w-20">AI</th>
                                    <th className="py-3 px-2 w-24">시간/리그</th>
                                    <th className="py-3 px-4 text-right w-1/3">홈팀 (Home)</th>
                                    <th className="py-3 px-2 w-20">승</th>
                                    <th className="py-3 px-2 w-20">무</th>
                                    <th className="py-3 px-2 w-20">패</th>
                                    <th className="py-3 px-4 text-left w-1/3">원정팀 (Away)</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-[#2a2a32]">
                                {loading && odds.length === 0 ? (
                                    <tr><td colSpan={7} className="py-8 text-center" style={{ color: 'var(--text-muted)' }}>데이터를 불러오는 중입니다...</td></tr>
                                ) : filteredOdds.length === 0 ? (
                                    <tr><td colSpan={7} className="py-8 text-center" style={{ color: 'var(--text-muted)' }}>
                                        {odds.length === 0 ? "표시할 경기가 없습니다." : "해당 종목의 경기가 없습니다."}
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
                                                            const recLabel = pred.recommendation === 'HOME' ? '홈' : pred.recommendation === 'AWAY' ? '원정' : '무';
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
                                                                    addToCart({
                                                                        id: `${item.team_home}_${item.team_away}_Home`,
                                                                        match_name: `${item.team_home} vs ${item.team_away}`,
                                                                        selection: 'Home',
                                                                        odds: item.home_odds,
                                                                        team_home: item.team_home_ko || item.team_home,
                                                                        team_away: item.team_away_ko || item.team_away,
                                                                        time: formatTime(item.match_time)
                                                                    });
                                                                }}
                                                                className={`odds-cell w-full py-2 rounded font-bold text-sm ${cartItems.some(c => c.id === `${item.team_home}_${item.team_away}_Home`)
                                                                    ? 'selected'
                                                                    : ''
                                                                    }`}
                                                                style={cartItems.some(c => c.id === `${item.team_home}_${item.team_away}_Home`)
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
                                                                        addToCart({
                                                                            id: `${item.team_home}_${item.team_away}_Draw`,
                                                                            match_name: `${item.team_home} vs ${item.team_away}`,
                                                                            selection: 'Draw',
                                                                            odds: item.draw_odds,
                                                                            team_home: item.team_home_ko || item.team_home,
                                                                            team_away: item.team_away_ko || item.team_away,
                                                                            time: formatTime(item.match_time)
                                                                        });
                                                                    }}
                                                                    className={`odds-cell w-full py-2 rounded font-bold text-sm ${cartItems.some(c => c.id === `${item.team_home}_${item.team_away}_Draw`)
                                                                        ? 'selected'
                                                                        : ''
                                                                        }`}
                                                                    style={cartItems.some(c => c.id === `${item.team_home}_${item.team_away}_Draw`)
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
                                                                    addToCart({
                                                                        id: `${item.team_home}_${item.team_away}_Away`,
                                                                        match_name: `${item.team_home} vs ${item.team_away}`,
                                                                        selection: 'Away',
                                                                        odds: item.away_odds,
                                                                        team_home: item.team_home_ko || item.team_home,
                                                                        team_away: item.team_away_ko || item.team_away,
                                                                        time: formatTime(item.match_time)
                                                                    });
                                                                }}
                                                                className={`odds-cell w-full py-2 rounded font-bold text-sm ${cartItems.some(c => c.id === `${item.team_home}_${item.team_away}_Away`)
                                                                    ? 'selected'
                                                                    : ''
                                                                    }`}
                                                                style={cartItems.some(c => c.id === `${item.team_home}_${item.team_away}_Away`)
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
                                                                        { key: 'ai', icon: '🧠', label: 'AI분석' },
                                                                        { key: 'standings', icon: '📊', label: '순위·폼' },
                                                                        { key: 'recent', icon: '⚽', label: '최근경기' },
                                                                        { key: 'lineups', icon: '👕', label: '라인업' },
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
                                                                                <div className="text-center py-4" style={{ color: 'var(--text-muted)' }}>데이터 불러오는 중...</div>
                                                                            ) : historyData.length >= 2 ? (
                                                                                <OddsHistoryChart data={historyData} />
                                                                            ) : (
                                                                                /* 배당 차트 데이터 없을 때 → 현재 배당률 비교 카드 */
                                                                                <div className="rounded-xl p-4" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}>
                                                                                    <h3 className="text-xs font-bold mb-3 flex items-center gap-1.5" style={{ color: 'var(--text-muted)' }}>📊 현재 배당률 분석</h3>
                                                                                    <div className="grid grid-cols-3 gap-3">
                                                                                        <div className="text-center p-3 rounded-lg" style={{ background: 'rgba(0,212,255,0.06)', border: '1px solid rgba(0,212,255,0.15)' }}>
                                                                                            <div className="text-[10px] mb-1" style={{ color: 'var(--text-muted)' }}>홈승</div>
                                                                                            <div className="text-lg font-bold" style={{ color: '#00d4ff' }}>{item.home_odds?.toFixed(2) || '-'}</div>
                                                                                            <div className="text-[10px] mt-1 font-medium" style={{ color: 'rgba(0,212,255,0.7)' }}>
                                                                                                {item.home_odds > 0 ? `${((1 / item.home_odds) / ((1 / item.home_odds) + (1 / (item.draw_odds || 999)) + (1 / item.away_odds)) * 100).toFixed(0)}%` : '-'}
                                                                                            </div>
                                                                                        </div>
                                                                                        <div className="text-center p-3 rounded-lg" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-subtle)' }}>
                                                                                            <div className="text-[10px] mb-1" style={{ color: 'var(--text-muted)' }}>무승부</div>
                                                                                            <div className="text-lg font-bold" style={{ color: 'var(--text-secondary)' }}>{item.draw_odds?.toFixed(2) || '-'}</div>
                                                                                            <div className="text-[10px] mt-1 font-medium" style={{ color: 'var(--text-muted)' }}>
                                                                                                {item.draw_odds > 0 ? `${((1 / item.draw_odds) / ((1 / item.home_odds) + (1 / item.draw_odds) + (1 / item.away_odds)) * 100).toFixed(0)}%` : '-'}
                                                                                            </div>
                                                                                        </div>
                                                                                        <div className="text-center p-3 rounded-lg" style={{ background: 'rgba(139,92,246,0.06)', border: '1px solid rgba(139,92,246,0.15)' }}>
                                                                                            <div className="text-[10px] mb-1" style={{ color: 'var(--text-muted)' }}>원정승</div>
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

                                                                                // pred가 없으면 배당률 기반 즉석 분석 생성
                                                                                if (!pred) {
                                                                                    const h = item.home_odds > 0 ? 1 / item.home_odds : 0;
                                                                                    const d = item.draw_odds > 0 ? 1 / item.draw_odds : 0;
                                                                                    const a = item.away_odds > 0 ? 1 / item.away_odds : 0;
                                                                                    const total = h + d + a;
                                                                                    if (total <= 0) return <div className="text-center py-6 text-[var(--text-muted)] text-sm">배당 데이터가 없습니다.</div>;

                                                                                    const homePct = (h / total) * 100;
                                                                                    const drawPct = (d / total) * 100;
                                                                                    const awayPct = (a / total) * 100;
                                                                                    const maxPct = Math.max(homePct, drawPct, awayPct);
                                                                                    const rec = homePct === maxPct ? 'HOME' : awayPct === maxPct ? 'AWAY' : 'DRAW';
                                                                                    const recLabel = rec === 'HOME' ? `${item.team_home_ko || item.team_home} 승` : rec === 'AWAY' ? `${item.team_away_ko || item.team_away} 승` : '무승부';

                                                                                    return (
                                                                                        <div className="mt-4 surface-card p-4">
                                                                                            <div className="flex items-center justify-between mb-3">
                                                                                                <span className="text-xs font-bold text-[var(--accent-primary)] flex items-center gap-1.5">📈 배당률 기반 분석 (Odds-Implied)</span>
                                                                                                <span className="text-[10px] px-2 py-0.5 rounded-full font-bold" style={{ background: 'rgba(0,212,255,0.1)', color: '#00d4ff' }}>
                                                                                                    {recLabel} {maxPct.toFixed(0)}%
                                                                                                </span>
                                                                                            </div>
                                                                                            <div className="mb-3">
                                                                                                <div className="flex justify-between text-[10px] mb-1" style={{ color: 'var(--text-muted)' }}>
                                                                                                    <span>홈 {homePct.toFixed(0)}%</span><span>무 {drawPct.toFixed(0)}%</span><span>원정 {awayPct.toFixed(0)}%</span>
                                                                                                </div>
                                                                                                <div className="flex h-3 rounded-lg overflow-hidden" style={{ background: 'var(--bg-primary)' }}>
                                                                                                    <div style={{ width: `${homePct}%`, background: 'rgba(0,212,255,0.6)' }} className="transition-all duration-700" />
                                                                                                    <div style={{ width: `${drawPct}%`, background: 'rgba(255,255,255,0.12)' }} className="transition-all duration-700" />
                                                                                                    <div style={{ width: `${awayPct}%`, background: 'rgba(139,92,246,0.6)' }} className="transition-all duration-700" />
                                                                                                </div>
                                                                                            </div>
                                                                                            <div className="grid grid-cols-2 gap-2 mb-2">
                                                                                                <div className="rounded-lg p-2 text-[10px]" style={{ background: 'var(--bg-primary)', border: '1px solid var(--border-subtle)' }}>
                                                                                                    <div className="font-bold mb-0.5" style={{ color: 'var(--accent-primary)' }}>배당률 내재 확률</div>
                                                                                                    <div style={{ color: 'var(--text-secondary)' }}>홈 {homePct.toFixed(0)}% / 무 {drawPct.toFixed(0)}% / 원정 {awayPct.toFixed(0)}%</div>
                                                                                                </div>
                                                                                                <div className="rounded-lg p-2 text-[10px]" style={{ background: 'var(--bg-primary)', border: '1px solid var(--border-subtle)' }}>
                                                                                                    <div className="font-bold mb-0.5" style={{ color: 'var(--accent-primary)' }}>마진율</div>
                                                                                                    <div style={{ color: 'var(--text-secondary)' }}>북메이커 마진 {((total - 1) * 100).toFixed(1)}%</div>
                                                                                                </div>
                                                                                            </div>
                                                                                            <div className="text-[9px] p-2 rounded-lg" style={{ background: 'rgba(251,191,36,0.05)', border: '1px solid rgba(251,191,36,0.15)', color: 'var(--text-muted)' }}>
                                                                                                💡 서버에서 순위·폼·부상 데이터가 수집되면 6-Factor AI 분석으로 자동 업그레이드됩니다.
                                                                                            </div>
                                                                                            <div className="mt-3 pt-2 flex flex-wrap gap-1.5 items-center" style={{ borderTop: '1px solid var(--border-subtle)' }}>
                                                                                                <span className="text-[9px]" style={{ color: 'var(--text-muted)' }}>분석 소스:</span>
                                                                                                <span className="text-[8px] px-1.5 py-0.5 rounded-full font-medium" style={{ background: 'rgba(0,212,255,0.1)', color: '#00d4ff', border: '1px solid rgba(0,212,255,0.25)' }}>The Odds API</span>
                                                                                            </div>
                                                                                        </div>
                                                                                    );
                                                                                }

                                                                                // pred가 있을 때 → 기존 6-factor 풀 분석 표시
                                                                                return (
                                                                                    <div className="mt-4 surface-card p-4">
                                                                                        <div className="flex items-center justify-between mb-3">
                                                                                            <span className="text-xs font-bold text-[var(--accent-primary)] flex items-center gap-1.5">🧠 AI 분석 리포트</span>
                                                                                            <span className="text-[10px] px-2 py-0.5 rounded-full font-bold" style={{ background: pred.confidence >= 65 ? 'rgba(255,107,53,0.15)' : pred.confidence >= 50 ? 'rgba(251,191,36,0.12)' : 'rgba(255,255,255,0.05)', color: pred.confidence >= 65 ? '#ff6b35' : pred.confidence >= 50 ? '#fbbf24' : 'var(--text-muted)' }}>
                                                                                                {pred.confidence >= 65 ? '🔥 강력추천' : pred.confidence >= 50 ? '⭐ 추천' : '➖ 보통'} {pred.confidence.toFixed(0)}%
                                                                                            </span>
                                                                                        </div>
                                                                                        <div className="mb-3">
                                                                                            <div className="flex justify-between text-[10px] mb-1" style={{ color: 'var(--text-muted)' }}>
                                                                                                <span>홈 {pred.home_win_prob.toFixed(0)}%</span><span>무 {pred.draw_prob.toFixed(0)}%</span><span>원정 {pred.away_win_prob.toFixed(0)}%</span>
                                                                                            </div>
                                                                                            <div className="flex h-3 rounded-lg overflow-hidden" style={{ background: 'var(--bg-primary)' }}>
                                                                                                <div style={{ width: `${pred.home_win_prob}%`, background: 'rgba(0,212,255,0.6)' }} className="transition-all duration-700" />
                                                                                                <div style={{ width: `${pred.draw_prob}%`, background: 'rgba(255,255,255,0.12)' }} className="transition-all duration-700" />
                                                                                                <div style={{ width: `${pred.away_win_prob}%`, background: 'rgba(139,92,246,0.6)' }} className="transition-all duration-700" />
                                                                                            </div>
                                                                                        </div>
                                                                                        {/* API-Football 외부 예측 비교 */}
                                                                                        {pred.api_prediction_pct && (
                                                                                            <div className="mb-3 p-2 rounded-lg" style={{ background: 'rgba(53,199,89,0.05)', border: '1px solid rgba(53,199,89,0.15)' }}>
                                                                                                <div className="flex items-center justify-between">
                                                                                                    <span className="text-[10px] font-bold" style={{ color: '#35c759' }}>⚽ API-Football 예측</span>
                                                                                                    <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
                                                                                                        홈 {pred.api_prediction_pct.home}% / 무 {pred.api_prediction_pct.draw}% / 원정 {pred.api_prediction_pct.away}%
                                                                                                    </span>
                                                                                                </div>
                                                                                            </div>
                                                                                        )}
                                                                                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-2">
                                                                                            {pred.factors.map((f: { name: string; weight: number; score: number; detail: string }, i: number) => (
                                                                                                <div key={i} className="rounded-lg p-2 text-[10px]" style={{ background: 'var(--bg-primary)', border: '1px solid var(--border-subtle)' }}>
                                                                                                    <div className="font-bold mb-0.5" style={{ color: 'var(--accent-primary)' }}>{f.name}</div>
                                                                                                    <div style={{ color: 'var(--text-secondary)' }}>{f.detail}</div>
                                                                                                </div>
                                                                                            ))}
                                                                                        </div>
                                                                                        {(pred.injuries_home.length > 0 || pred.injuries_away.length > 0) && (
                                                                                            <div className="text-[10px] mt-1 p-2 rounded-lg" style={{ background: 'rgba(239,68,68,0.05)', border: '1px solid rgba(239,68,68,0.15)' }}>
                                                                                                <span className="font-bold" style={{ color: '#f87171' }}>🏥 부상/결장:</span>
                                                                                                {pred.injuries_home.length > 0 && <span style={{ color: 'var(--text-muted)' }}> 홈: {pred.injuries_home.join(', ')}</span>}
                                                                                                {pred.injuries_away.length > 0 && <span style={{ color: 'var(--text-muted)' }}> 원정: {pred.injuries_away.join(', ')}</span>}
                                                                                            </div>
                                                                                        )}
                                                                                        <div className="mt-3 pt-2 flex flex-wrap gap-1.5 items-center" style={{ borderTop: '1px solid var(--border-subtle)' }}>
                                                                                            <span className="text-[9px]" style={{ color: 'var(--text-muted)' }}>분석 소스:</span>
                                                                                            {[{ name: 'The Odds API', c: '#00d4ff' }, { name: 'API-Football', c: '#35c759' }, { name: 'football-data.org', c: '#fbbf24' }].map((s, i) => (
                                                                                                <span key={i} className="text-[8px] px-1.5 py-0.5 rounded-full font-medium" style={{ background: `${s.c}10`, color: s.c, border: `1px solid ${s.c}25` }}>{s.name}</span>
                                                                                            ))}
                                                                                        </div>
                                                                                    </div>
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
                                                                                            <span className="text-xs font-bold text-[var(--accent-primary)] flex items-center gap-1.5">🗳️ 승부 예측</span>
                                                                                            <span className="text-[10px] text-[var(--text-muted)]">{stat.total_votes}명 참여</span>
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
                                                                                            <div className="text-center py-2 rounded-lg border border-[rgba(0,212,255,0.2)] bg-[rgba(0,212,255,0.05)]">
                                                                                                <span className="text-[var(--accent-primary)] font-bold text-xs">✅ "{voted === 'Home' ? '홈승' : voted === 'Draw' ? '무승부' : '원정승'}" 투표 완료</span>
                                                                                            </div>
                                                                                        ) : (
                                                                                            <div className="grid grid-cols-3 gap-2">
                                                                                                <button onClick={(e) => { e.stopPropagation(); handleVote(matchId, 'Home', item.home_odds); }} className="py-2.5 rounded-lg border border-[var(--border-subtle)] hover:bg-[rgba(0,212,255,0.08)] hover:border-[rgba(0,212,255,0.3)] text-xs font-bold text-[var(--text-secondary)] transition-all active:scale-95">홈 승</button>
                                                                                                <button onClick={(e) => { e.stopPropagation(); handleVote(matchId, 'Draw', item.draw_odds); }} className="py-2.5 rounded-lg border border-[var(--border-subtle)] hover:bg-white/5 hover:border-[var(--border-default)] text-xs font-bold text-[var(--text-secondary)] transition-all active:scale-95">무승부</button>
                                                                                                <button onClick={(e) => { e.stopPropagation(); handleVote(matchId, 'Away', item.away_odds); }} className="py-2.5 rounded-lg border border-[var(--border-subtle)] hover:bg-[rgba(139,92,246,0.08)] hover:border-[rgba(139,92,246,0.3)] text-xs font-bold text-[var(--text-secondary)] transition-all active:scale-95">원정 승</button>
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
                                                                                    <div className="animate-pulse">📊 순위 정보 불러오는 중...</div>
                                                                                </div>
                                                                            ) : matchDetail?.standings?.home || matchDetail?.standings?.away ? (
                                                                                <div className="space-y-4">
                                                                                    <div className="text-xs font-bold mb-3" style={{ color: 'var(--accent-primary)' }}>📊 리그 순위 비교</div>
                                                                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                                                                        {[{ label: '홈', team: item.team_home_ko || item.team_home, data: matchDetail?.standings?.home, color: '#00d4ff' },
                                                                                        { label: '원정', team: item.team_away_ko || item.team_away, data: matchDetail?.standings?.away, color: '#8b5cf6' }].map((side, si) => (
                                                                                            <div key={si} className="rounded-xl p-3" style={{ background: 'var(--bg-primary)', border: `1px solid ${side.color}20` }}>
                                                                                                <div className="flex items-center justify-between mb-2">
                                                                                                    <span className="text-xs font-bold" style={{ color: side.color }}>{side.label} {side.team}</span>
                                                                                                    {side.data && <span className="text-lg font-black" style={{ color: side.color }}>#{side.data.rank}</span>}
                                                                                                </div>
                                                                                                {side.data ? (
                                                                                                    <div>
                                                                                                        <div className="grid grid-cols-4 gap-1 text-center text-[10px] mb-2">
                                                                                                            <div className="rounded p-1" style={{ background: 'var(--bg-card)' }}>
                                                                                                                <div style={{ color: 'var(--text-muted)' }}>경기</div>
                                                                                                                <div className="font-bold" style={{ color: 'var(--text-primary)' }}>{side.data.played}</div>
                                                                                                            </div>
                                                                                                            <div className="rounded p-1" style={{ background: 'var(--bg-card)' }}>
                                                                                                                <div style={{ color: 'var(--text-muted)' }}>승</div>
                                                                                                                <div className="font-bold" style={{ color: '#35c759' }}>{side.data.wins}</div>
                                                                                                            </div>
                                                                                                            <div className="rounded p-1" style={{ background: 'var(--bg-card)' }}>
                                                                                                                <div style={{ color: 'var(--text-muted)' }}>무</div>
                                                                                                                <div className="font-bold" style={{ color: 'var(--text-secondary)' }}>{side.data.draws}</div>
                                                                                                            </div>
                                                                                                            <div className="rounded p-1" style={{ background: 'var(--bg-card)' }}>
                                                                                                                <div style={{ color: 'var(--text-muted)' }}>패</div>
                                                                                                                <div className="font-bold" style={{ color: '#ef4444' }}>{side.data.losses}</div>
                                                                                                            </div>
                                                                                                        </div>
                                                                                                        <div className="flex items-center justify-between text-[10px] mb-1">
                                                                                                            <span style={{ color: 'var(--text-muted)' }}>득실: {side.data.goals_for}-{side.data.goals_against} ({side.data.goal_diff > 0 ? '+' : ''}{side.data.goal_diff})</span>
                                                                                                            <span className="font-bold" style={{ color: side.color }}>승점 {side.data.points}</span>
                                                                                                        </div>
                                                                                                        {side.data.form && (
                                                                                                            <div className="flex items-center gap-1 mt-2">
                                                                                                                <span className="text-[9px]" style={{ color: 'var(--text-muted)' }}>최근:</span>
                                                                                                                {side.data.form.split('').map((r: string, ri: number) => (
                                                                                                                    <span key={ri} className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold text-white"
                                                                                                                        style={{ background: r === 'W' ? '#35c759' : r === 'D' ? '#fbbf24' : '#ef4444' }}>
                                                                                                                        {r === 'W' ? '승' : r === 'D' ? '무' : '패'}
                                                                                                                    </span>
                                                                                                                ))}
                                                                                                            </div>
                                                                                                        )}
                                                                                                    </div>
                                                                                                ) : (
                                                                                                    <div className="text-[10px] py-2" style={{ color: 'var(--text-muted)' }}>순위 데이터 없음</div>
                                                                                                )}
                                                                                            </div>
                                                                                        ))}
                                                                                    </div>
                                                                                    {/* Injuries section */}
                                                                                    {matchDetail && (matchDetail.injuries.home.length > 0 || matchDetail.injuries.away.length > 0) && (
                                                                                        <div className="mt-3 p-3 rounded-xl" style={{ background: 'rgba(239,68,68,0.05)', border: '1px solid rgba(239,68,68,0.15)' }}>
                                                                                            <div className="text-xs font-bold mb-2" style={{ color: '#f87171' }}>🏥 부상/결장</div>
                                                                                            <div className="grid grid-cols-2 gap-2 text-[10px]">
                                                                                                <div>
                                                                                                    <div className="font-bold mb-1" style={{ color: '#00d4ff' }}>홈</div>
                                                                                                    {matchDetail.injuries.home.length > 0 ? matchDetail.injuries.home.map((inj, ii) => (
                                                                                                        <div key={ii} style={{ color: 'var(--text-muted)' }}>{inj.player_name} ({inj.reason})</div>
                                                                                                    )) : <div style={{ color: 'var(--text-muted)' }}>없음</div>}
                                                                                                </div>
                                                                                                <div>
                                                                                                    <div className="font-bold mb-1" style={{ color: '#8b5cf6' }}>원정</div>
                                                                                                    {matchDetail.injuries.away.length > 0 ? matchDetail.injuries.away.map((inj, ii) => (
                                                                                                        <div key={ii} style={{ color: 'var(--text-muted)' }}>{inj.player_name} ({inj.reason})</div>
                                                                                                    )) : <div style={{ color: 'var(--text-muted)' }}>없음</div>}
                                                                                                </div>
                                                                                            </div>
                                                                                        </div>
                                                                                    )}
                                                                                </div>
                                                                            ) : (
                                                                                <div className="text-center py-8" style={{ color: 'var(--text-muted)' }}>
                                                                                    <div className="text-2xl mb-2">📊</div>
                                                                                    <div className="text-sm">순위 데이터가 없습니다</div>
                                                                                    <div className="text-xs mt-1">데이터 수집이 필요합니다 (AI예측 → 데이터 수집)</div>
                                                                                </div>
                                                                            )}
                                                                        </div>
                                                                    )}

                                                                    {/* === 최근경기 Tab === */}
                                                                    {activeDetailTab === 'recent' && (
                                                                        <div>
                                                                            {matchDetailLoading ? (
                                                                                <div className="text-center py-8" style={{ color: 'var(--text-muted)' }}>
                                                                                    <div className="animate-pulse">⚽ 최근 경기 불러오는 중...</div>
                                                                                </div>
                                                                            ) : (matchDetail?.recent_matches?.home?.length || 0) > 0 || (matchDetail?.recent_matches?.away?.length || 0) > 0 ? (
                                                                                <div className="space-y-4">
                                                                                    {[{ label: '홈', team: item.team_home_ko || item.team_home, matches: matchDetail?.recent_matches?.home || [], color: '#00d4ff' },
                                                                                    { label: '원정', team: item.team_away_ko || item.team_away, matches: matchDetail?.recent_matches?.away || [], color: '#8b5cf6' }].map((side, si) => (
                                                                                        <div key={si}>
                                                                                            <div className="text-xs font-bold mb-2 flex items-center gap-1.5">
                                                                                                <span style={{ color: side.color }}>{side.label}</span>
                                                                                                <span style={{ color: 'var(--text-primary)' }}>{side.team} 최근 {side.matches.length}경기</span>
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
                                                                                                <div className="text-[11px] py-2" style={{ color: 'var(--text-muted)' }}>최근 경기 데이터 없음</div>
                                                                                            )}
                                                                                        </div>
                                                                                    ))}
                                                                                </div>
                                                                            ) : (
                                                                                <div className="text-center py-8" style={{ color: 'var(--text-muted)' }}>
                                                                                    <div className="text-2xl mb-2">⚽</div>
                                                                                    <div className="text-sm">최근 경기 데이터가 없습니다</div>
                                                                                    <div className="text-xs mt-1">API 데이터 수집이 필요합니다</div>
                                                                                </div>
                                                                            )}
                                                                        </div>
                                                                    )}

                                                                    {/* === 라인업 Tab === */}
                                                                    {activeDetailTab === 'lineups' && (
                                                                        <div>
                                                                            {matchDetailLoading ? (
                                                                                <div className="text-center py-8" style={{ color: 'var(--text-muted)' }}>
                                                                                    <div className="animate-pulse">👕 라인업 불러오는 중...</div>
                                                                                </div>
                                                                            ) : matchDetail?.lineups ? (
                                                                                <div className="space-y-4">
                                                                                    {Object.entries(matchDetail.lineups).map(([teamName, lineup], li) => (
                                                                                        <div key={li} className="rounded-xl p-3" style={{ background: 'var(--bg-primary)', border: `1px solid ${li === 0 ? '#00d4ff' : '#8b5cf6'}20` }}>
                                                                                            <div className="flex items-center justify-between mb-3">
                                                                                                <span className="text-xs font-bold" style={{ color: li === 0 ? '#00d4ff' : '#8b5cf6' }}>{teamName}</span>
                                                                                                <div className="flex items-center gap-2">
                                                                                                    <span className="text-[10px] px-2 py-0.5 rounded-full font-bold" style={{ background: 'rgba(0,212,255,0.1)', color: 'var(--accent-primary)' }}>⚙ {lineup.formation}</span>
                                                                                                    {lineup.coach && <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>감독: {lineup.coach}</span>}
                                                                                                </div>
                                                                                            </div>
                                                                                            <div className="text-[10px] font-bold mb-1" style={{ color: 'var(--text-secondary)' }}>선발 XI</div>
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
                                                                                                    <div className="text-[10px] font-bold mb-1" style={{ color: 'var(--text-muted)' }}>후보</div>
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
                                                                                    <div className="text-sm">라인업이 아직 발표되지 않았습니다</div>
                                                                                    <div className="text-xs mt-1">보통 경기 시작 1시간 전에 공개됩니다</div>
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
        </div>
    );
}
