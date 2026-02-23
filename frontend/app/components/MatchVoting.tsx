
"use client";
import React, { useState, useEffect, useMemo } from 'react';

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
    league: string;
    sport?: string;
}

interface VoteStats {
    match_id: string;
    home_votes: number;
    draw_votes: number;
    away_votes: number;
    total_votes: number;
    home_pct: number;
    draw_pct: number;
    away_pct: number;
}

const SPORT_TABS = [
    { key: 'all', label: '전체', icon: '🏆' },
    { key: 'Soccer', label: '축구', icon: '⚽' },
    { key: 'Basketball', label: '농구', icon: '🏀' },
    { key: 'Baseball', label: '야구', icon: '⚾' },
    { key: 'IceHockey', label: '하키', icon: '🏒' },
];

export default function MatchVoting() {
    const [matches, setMatches] = useState<OddsItem[]>([]);
    const [stats, setStats] = useState<Record<string, VoteStats>>({});
    const [loading, setLoading] = useState(true);
    const [votedMatches, setVotedMatches] = useState<Record<string, string>>({});
    const [activeSport, setActiveSport] = useState('all');
    const [expandedLeague, setExpandedLeague] = useState<string | null>(null);

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

    const fetchMatches = async () => {
        try {
            const res = await fetch('/api/market/pinnacle');
            if (res.ok) {
                const data = await res.json();
                setMatches(data);
                const firstBatch = data.slice(0, 20);
                for (const match of firstBatch) {
                    const matchId = `${match.team_home}_${match.team_away}`;
                    try {
                        const statsRes = await fetch(`/api/prediction/vote-stats/${encodeURIComponent(matchId)}`);
                        if (statsRes.ok) {
                            const s = await statsRes.json();
                            if (s.total_votes > 0) {
                                setStats(prev => ({ ...prev, [matchId]: s }));
                            }
                        }
                    } catch { /* non-critical */ }
                }
            }
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchMatches(); }, []);

    const filteredMatches = useMemo(() => {
        if (activeSport === 'all') return matches;
        return matches.filter(m => m.sport === activeSport);
    }, [matches, activeSport]);

    const groupedByLeague = useMemo(() => {
        const groups: Record<string, OddsItem[]> = {};
        for (const m of filteredMatches) {
            const league = m.league || 'Other';
            if (!groups[league]) groups[league] = [];
            groups[league].push(m);
        }
        return groups;
    }, [filteredMatches]);

    const sportCounts = useMemo(() => {
        const counts: Record<string, number> = { all: matches.length };
        for (const m of matches) {
            const s = m.sport || 'Other';
            counts[s] = (counts[s] || 0) + 1;
        }
        return counts;
    }, [matches]);

    const handleVote = async (matchId: string, selection: string, odds: number) => {
        if (votedMatches[matchId]) {
            alert(`이미 이 경기에 "${getSelectionLabel(votedMatches[matchId])}" 으로 투표했습니다.`);
            return;
        }
        try {
            const headers: Record<string, string> = { 'Content-Type': 'application/json' };
            const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
            if (token) headers['Authorization'] = `Bearer ${token}`;

            const res = await fetch('/api/prediction/submit', {
                method: 'POST',
                headers,
                body: JSON.stringify({ match_id: matchId, user_id: token ? undefined : userId, selection, odds })
            });

            if (res.ok) {
                try {
                    const statsRes = await fetch(`/api/prediction/vote-stats/${encodeURIComponent(matchId)}`);
                    if (statsRes.ok) {
                        const updatedStats: VoteStats = await statsRes.json();
                        setStats(prev => ({ ...prev, [matchId]: updatedStats }));
                    }
                } catch { /* non-critical */ }
                setVotedMatches(prev => ({ ...prev, [matchId]: selection }));
            } else {
                const err = await res.json();
                alert(`투표 실패: ${err.detail}`);
            }
        } catch (err) { console.error(err); }
    };

    const getSelectionLabel = (sel: string) => {
        if (sel === 'Home') return '홈 승';
        if (sel === 'Draw') return '무승부';
        return '원정 승';
    };

    const hasDraw = (sport?: string) => sport === 'Soccer' || !sport;

    return (
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
            {/* Section Header */}
            <div className="flex items-center space-x-3 mb-6">
                <span className="w-1 h-6 rounded-full bg-gradient-to-b from-[var(--accent-primary)] to-[var(--accent-secondary)]"></span>
                <h2 className="text-xl font-extrabold text-white">오늘의 승부 예측</h2>
                <span className="text-xs text-[var(--text-muted)]">투표하고 결과를 확인하세요</span>
            </div>

            {/* Sport Tabs */}
            <div className="flex flex-wrap gap-2 mb-6">
                {SPORT_TABS.map(tab => {
                    const count = sportCounts[tab.key] || 0;
                    const isActive = activeSport === tab.key;
                    if (tab.key !== 'all' && count === 0) return null;
                    return (
                        <button
                            key={tab.key}
                            onClick={() => { setActiveSport(tab.key); setExpandedLeague(null); }}
                            className={`flex items-center space-x-1.5 px-4 py-2 rounded-lg text-sm font-bold transition-all ${isActive
                                ? 'bg-[rgba(0,212,255,0.1)] text-[var(--accent-primary)] border border-[rgba(0,212,255,0.3)]'
                                : 'bg-white/[0.04] text-[var(--text-secondary)] border border-[var(--border-subtle)] hover:text-white hover:border-[var(--border-default)]'
                                }`}
                        >
                            <span>{tab.icon}</span>
                            <span>{tab.label}</span>
                            <span className={`text-xs px-1.5 py-0.5 rounded ${isActive ? 'bg-[rgba(0,212,255,0.15)]' : 'bg-white/5'}`}>{count}</span>
                        </button>
                    );
                })}
            </div>

            {/* Match List */}
            {loading ? (
                <div className="text-center py-10 text-[var(--text-muted)]">
                    <div className="animate-spin inline-block w-6 h-6 border-2 border-white/10 border-t-[var(--accent-primary)] rounded-full mb-2"></div>
                    <p className="text-sm">경기 정보를 불러오는 중...</p>
                </div>
            ) : filteredMatches.length === 0 ? (
                <div className="text-center py-10 text-[var(--text-muted)] glass-card">현재 예정된 경기가 없습니다.</div>
            ) : (
                <div className="space-y-4">
                    {Object.entries(groupedByLeague).map(([league, leagueMatches]) => {
                        const isExpanded = expandedLeague === null || expandedLeague === league;
                        return (
                            <div key={league} className="glass-card overflow-hidden">
                                {/* League Header */}
                                <button
                                    onClick={() => setExpandedLeague(expandedLeague === league ? null : league)}
                                    className="w-full flex items-center justify-between px-4 py-3 hover:bg-white/[0.03] transition-all"
                                    style={{ background: 'var(--bg-elevated)' }}
                                >
                                    <div className="flex items-center space-x-2">
                                        <span className="text-sm font-bold text-white/70">{league}</span>
                                        <span className="badge">{leagueMatches.length}</span>
                                    </div>
                                    <svg className={`w-4 h-4 text-[var(--text-muted)] transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                    </svg>
                                </button>

                                {isExpanded && (
                                    <div className="divide-y divide-[var(--border-subtle)]">
                                        {leagueMatches.map((match, idx) => {
                                            const matchId = `${match.team_home}_${match.team_away}`;
                                            const stat = stats[matchId] || { home_pct: 0, draw_pct: 0, away_pct: 0, total_votes: 0 };
                                            const hasVotes = stat.total_votes > 0;
                                            const voted = votedMatches[matchId];
                                            const matchDate = new Date(match.match_time);
                                            const showDraw = hasDraw(match.sport);

                                            return (
                                                <div key={idx} className="px-4 py-4 hover:bg-white/[0.02] transition-all">
                                                    {/* Meta */}
                                                    <div className="flex justify-between items-center mb-3">
                                                        <span className="text-[10px] text-[var(--text-secondary)]">{matchDate.toLocaleString('ko-KR')}</span>
                                                        <span className="text-[10px] text-[var(--text-secondary)]">{stat.total_votes}명 참여</span>
                                                    </div>

                                                    {/* Teams */}
                                                    <div className="flex justify-between items-center mb-4">
                                                        <div className="text-center flex-1">
                                                            <div className="text-sm font-bold text-white">{match.team_home_ko || match.team_home}</div>
                                                            <div className="text-xs mt-0.5 font-mono" style={{ color: '#66d9ff' }}>{match.home_odds}</div>
                                                        </div>
                                                        <div className="text-white/50 font-light text-sm px-4">VS</div>
                                                        <div className="text-center flex-1">
                                                            <div className="text-sm font-bold text-white">{match.team_away_ko || match.team_away}</div>
                                                            <div className="text-xs mt-0.5 font-mono" style={{ color: '#b89dfa' }}>{match.away_odds}</div>
                                                        </div>
                                                    </div>

                                                    {/* Vote Progress */}
                                                    {hasVotes && (
                                                        <div className="mb-3 flex h-4 rounded-lg overflow-hidden" style={{ background: 'var(--bg-primary)' }}>
                                                            <div style={{ width: `${stat.home_pct}%` }} className="bg-[var(--accent-primary)]/60 flex items-center justify-center transition-all duration-700">
                                                                {stat.home_pct > 15 && <span className="text-white text-[9px] font-bold">{stat.home_pct}%</span>}
                                                            </div>
                                                            {showDraw && (
                                                                <div style={{ width: `${stat.draw_pct}%` }} className="bg-white/15 flex items-center justify-center transition-all duration-700">
                                                                    {stat.draw_pct > 15 && <span className="text-white/60 text-[9px] font-bold">{stat.draw_pct}%</span>}
                                                                </div>
                                                            )}
                                                            <div style={{ width: `${stat.away_pct}%` }} className="bg-[var(--accent-secondary)]/60 flex items-center justify-center transition-all duration-700">
                                                                {stat.away_pct > 15 && <span className="text-white text-[9px] font-bold">{stat.away_pct}%</span>}
                                                            </div>
                                                        </div>
                                                    )}

                                                    {/* Vote Buttons */}
                                                    {voted ? (
                                                        <div className="text-center py-2 rounded-lg border border-[rgba(0,212,255,0.2)] bg-[rgba(0,212,255,0.05)]">
                                                            <span className="text-[var(--accent-primary)] font-bold text-xs">✅ &quot;{getSelectionLabel(voted)}&quot; 투표 완료</span>
                                                        </div>
                                                    ) : (
                                                        <div className={`grid gap-2 ${showDraw ? 'grid-cols-3' : 'grid-cols-2'}`}>
                                                            <button onClick={() => handleVote(matchId, 'Home', match.home_odds)} className="py-2 rounded-lg border border-[var(--border-subtle)] hover:bg-[rgba(0,212,255,0.08)] hover:border-[rgba(0,212,255,0.3)] text-xs font-bold text-white/80 transition-all active:scale-95">
                                                                홈 승
                                                            </button>
                                                            {showDraw && (
                                                                <button onClick={() => handleVote(matchId, 'Draw', match.draw_odds)} className="py-2 rounded-lg border border-[var(--border-subtle)] hover:bg-white/5 hover:border-[var(--border-default)] text-xs font-bold text-white/80 transition-all active:scale-95">
                                                                    무승부
                                                                </button>
                                                            )}
                                                            <button onClick={() => handleVote(matchId, 'Away', match.away_odds)} className="py-2 rounded-lg border border-[var(--border-subtle)] hover:bg-[rgba(139,92,246,0.08)] hover:border-[rgba(139,92,246,0.3)] text-xs font-bold text-white/80 transition-all active:scale-95">
                                                                원정 승
                                                            </button>
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}
        </section>
    );
}
