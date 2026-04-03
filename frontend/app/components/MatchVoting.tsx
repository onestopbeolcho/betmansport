
"use client";
import React, { useState, useEffect, useMemo } from 'react';
import { usePathname } from 'next/navigation';
import { i18n } from '../lib/i18n-config';
import { useDictionarySafe } from '../context/DictionaryContext';

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

// Sport tabs will use translated labels from dictionary
const SPORT_TAB_KEYS = [
    { key: 'all', labelKey: 'filterAll', icon: '🏆' },
    { key: 'Soccer', labelKey: 'soccer', icon: '⚽' },
    { key: 'Basketball', labelKey: 'basketball', icon: '🏀' },
    { key: 'Baseball', labelKey: 'baseball', icon: '⚾' },
    { key: 'IceHockey', labelKey: 'hockey', icon: '🏒' },
];

export default function MatchVoting() {
    const pathname = usePathname();
    const dict = useDictionarySafe();
    const tv = dict?.matchVoting || {};
    const tc = dict?.common || {};
    const sortedLocales = [...i18n.locales].sort((a, b) => b.length - a.length);
    const currentLang = sortedLocales.find((l) => pathname.startsWith(`/${l}/`) || pathname === `/${l}`) || i18n.defaultLocale;
    const API = process.env.NEXT_PUBLIC_API_URL || '';

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
            const res = await fetch(`${API}/api/market/pinnacle`);
            if (res.ok) {
                const data = await res.json();
                setMatches(data);
                const firstBatch = data.slice(0, 20);
                for (const match of firstBatch) {
                    const matchId = `${match.team_home}_${match.team_away}`;
                    try {
                        const statsRes = await fetch(`${API}/api/prediction/vote-stats/${encodeURIComponent(matchId)}`);
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
            alert(`Already voted "${getSelectionLabel(votedMatches[matchId])}" for this match.`);
            return;
        }
        try {
            const headers: Record<string, string> = { 'Content-Type': 'application/json' };
            const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
            if (token) headers['Authorization'] = `Bearer ${token}`;

            const res = await fetch(`${API}/api/prediction/submit`, {
                method: 'POST',
                headers,
                body: JSON.stringify({ match_id: matchId, user_id: token ? undefined : userId, selection, odds })
            });

            if (res.ok) {
                try {
                    const statsRes = await fetch(`${API}/api/prediction/vote-stats/${encodeURIComponent(matchId)}`);
                    if (statsRes.ok) {
                        const updatedStats: VoteStats = await statsRes.json();
                        setStats(prev => ({ ...prev, [matchId]: updatedStats }));
                    }
                } catch { /* non-critical */ }
                setVotedMatches(prev => ({ ...prev, [matchId]: selection }));
            } else {
                const err = await res.json();
                alert(`${tv.voteFail || 'Vote failed'}: ${err.detail}`);
            }
        } catch (err) { console.error(err); }
    };

    const getSelectionLabel = (sel: string) => {
        if (sel === 'Home') return tv.homeWin || 'Home';
        if (sel === 'Draw') return tv.draw || 'Draw';
        return tv.awayWin || 'Away';
    };

    const hasDraw = (sport?: string) => sport === 'Soccer' || !sport;

    return (
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
            {/* Section Header */}
            <div data-tour="tour-match-voting" className="flex items-center justify-between mb-6">
                <div className="flex items-center space-x-3">
                    <span className="w-1 h-6 rounded-full bg-gradient-to-b from-[var(--accent-primary)] to-[var(--accent-secondary)]"></span>
                    <h2 className="text-xl font-extrabold text-white">{tv.title || 'Today\'s Match Predictions'}</h2>
                    <span className="text-xs text-[var(--text-muted)] hidden sm:inline">{tv.subtitle || 'Vote and check results'}</span>
                </div>
                <a
                    href={`/${currentLang}/market`}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold transition-all bg-[rgba(0,212,255,0.08)] text-[var(--accent-primary)] border border-[rgba(0,212,255,0.2)] hover:bg-[rgba(0,212,255,0.15)] hover:border-[rgba(0,212,255,0.4)]"
                >
                    🔮 {tv.viewAll || 'View All →'}
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                    </svg>
                </a>
            </div>

            {/* Sport Tabs */}
            <div className="flex flex-wrap gap-2 mb-6">
                {SPORT_TAB_KEYS.map(tab => {
                    const count = sportCounts[tab.key] || 0;
                    const isActive = activeSport === tab.key;
                    if (tab.key !== 'all' && count === 0) return null;
                    const label = tab.labelKey === 'filterAll' ? (tv.filterAll || tc.filterAll || 'All') : (tc[tab.labelKey] || tab.labelKey);
                    return (
                        <button
                            key={tab.key}
                            onClick={() => { setActiveSport(tab.key); setExpandedLeague(null); }}
                            className={`flex items-center space-x-1.5 px-4 py-2 rounded-lg text-sm font-bold transition-all ${isActive
                                ? 'bg-[rgba(0,212,255,0.12)] text-[var(--accent-primary)] border border-[rgba(0,212,255,0.4)] shadow-[0_0_12px_rgba(0,212,255,0.15)]'
                                : 'bg-[#141420] text-[var(--text-secondary)] border border-[rgba(255,255,255,0.08)] hover:text-white hover:border-[rgba(255,255,255,0.15)] hover:bg-[#1a1a28]'
                                }`}
                        >
                            <span>{tab.icon}</span>
                            <span>{label}</span>
                            <span className={`text-xs px-1.5 py-0.5 rounded-md font-mono ${isActive ? 'bg-[rgba(0,212,255,0.2)] text-[var(--accent-primary)]' : 'bg-[rgba(255,255,255,0.06)] text-[var(--text-muted)]'}`}>{count}</span>
                        </button>
                    );
                })}
            </div>

            {/* Match List */}
            {loading ? (
                <div className="text-center py-10 text-[var(--text-muted)]">
                    <div className="animate-spin inline-block w-6 h-6 border-2 border-white/10 border-t-[var(--accent-primary)] rounded-full mb-2"></div>
                    <p className="text-sm">{tc.loading || 'Loading...'}</p>
                </div>
            ) : filteredMatches.length === 0 ? (
                <div className="text-center py-10 text-[var(--text-muted)] glass-card">{tv.noMatches || 'No matches scheduled for today.'}</div>
            ) : (
                <div className="space-y-4">
                    {Object.entries(groupedByLeague).map(([league, leagueMatches]) => {
                        const isExpanded = expandedLeague === null || expandedLeague === league;
                        return (
                            <div key={league} className="rounded-xl overflow-hidden" style={{ background: '#0d0d16', border: '1px solid rgba(255,255,255,0.08)' }}>
                                {/* League Header */}
                                <button
                                    onClick={() => setExpandedLeague(expandedLeague === league ? null : league)}
                                    className="w-full flex items-center justify-between px-4 py-3.5 transition-all hover:brightness-110"
                                    style={{ background: 'linear-gradient(135deg, #141428 0%, #111120 100%)', borderBottom: isExpanded ? '1px solid rgba(0,212,255,0.12)' : 'none' }}
                                >
                                    <div className="flex items-center space-x-2.5">
                                        <span className="w-1 h-5 rounded-full" style={{ background: 'linear-gradient(180deg, #00d4ff, #8b5cf6)' }}></span>
                                        <span className="text-sm font-bold text-white">{league}</span>
                                        <span className="text-[11px] font-mono px-2 py-0.5 rounded-md" style={{ background: 'rgba(0,212,255,0.1)', color: '#00d4ff', border: '1px solid rgba(0,212,255,0.15)' }}>{leagueMatches.length}</span>
                                    </div>
                                    <svg className={`w-4 h-4 text-[var(--text-muted)] transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                    </svg>
                                </button>

                                {isExpanded && (
                                    <div>
                                        {leagueMatches.map((match, idx) => {
                                            const matchId = `${match.team_home}_${match.team_away}`;
                                            const stat = stats[matchId] || { home_pct: 0, draw_pct: 0, away_pct: 0, total_votes: 0 };
                                            const hasVotes = stat.total_votes > 0;
                                            const voted = votedMatches[matchId];
                                            const matchDate = new Date(match.match_time);
                                            const showDraw = hasDraw(match.sport);

                                            return (
                                                <div key={idx}
                                                    className="px-4 py-5 transition-all hover:bg-[rgba(255,255,255,0.02)]"
                                                    style={{ borderTop: idx > 0 ? '1px solid rgba(255,255,255,0.06)' : 'none' }}
                                                >
                                                    {/* Meta */}
                                                    <div className="flex justify-between items-center mb-3">
                                                        <span className="text-[11px] text-[var(--text-muted)] flex items-center gap-1">
                                                            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                                            {matchDate.toLocaleString(currentLang === 'ko' ? 'ko-KR' : 'en-US')}
                                                        </span>
                                                        <span className="text-[11px] px-2 py-0.5 rounded-md" style={{ background: 'rgba(255,255,255,0.04)', color: 'var(--text-muted)' }}>{stat.total_votes} {tv.voted || 'votes'}</span>
                                                    </div>

                                                    {/* Teams */}
                                                    <div className="flex justify-between items-center mb-4 py-2 px-3 rounded-lg" style={{ background: 'rgba(255,255,255,0.02)' }}>
                                                        <div className="text-center flex-1">
                                                            <div className="text-[15px] font-bold text-white">{match.team_home_ko || match.team_home}</div>
                                                            <div className="text-sm mt-1 font-mono font-bold" style={{ color: '#00d4ff' }}>{match.home_odds}</div>
                                                        </div>
                                                        <div className="px-4 py-1.5 rounded-full text-xs font-bold" style={{ background: 'rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.35)' }}>VS</div>
                                                        <div className="text-center flex-1">
                                                            <div className="text-[15px] font-bold text-white">{match.team_away_ko || match.team_away}</div>
                                                            <div className="text-sm mt-1 font-mono font-bold" style={{ color: '#b89dfa' }}>{match.away_odds}</div>
                                                        </div>
                                                    </div>

                                                    {/* Vote Progress */}
                                                    {hasVotes && (
                                                        <div className="mb-3 flex h-5 rounded-lg overflow-hidden" style={{ background: '#0a0a12' }}>
                                                            <div style={{ width: `${stat.home_pct}%`, background: 'rgba(0,212,255,0.5)' }} className="flex items-center justify-center transition-all duration-700">
                                                                {stat.home_pct > 15 && <span className="text-white text-[10px] font-bold">{stat.home_pct}%</span>}
                                                            </div>
                                                            {showDraw && (
                                                                <div style={{ width: `${stat.draw_pct}%`, background: 'rgba(255,255,255,0.12)' }} className="flex items-center justify-center transition-all duration-700">
                                                                    {stat.draw_pct > 15 && <span className="text-white/70 text-[10px] font-bold">{stat.draw_pct}%</span>}
                                                                </div>
                                                            )}
                                                            <div style={{ width: `${stat.away_pct}%`, background: 'rgba(139,92,246,0.5)' }} className="flex items-center justify-center transition-all duration-700">
                                                                {stat.away_pct > 15 && <span className="text-white text-[10px] font-bold">{stat.away_pct}%</span>}
                                                            </div>
                                                        </div>
                                                    )}

                                                    {/* Vote Buttons */}
                                                    {voted ? (
                                                        <div className="text-center py-2.5 rounded-lg" style={{ border: '1px solid rgba(0,212,255,0.25)', background: 'rgba(0,212,255,0.06)' }}>
                                                            <span className="text-[var(--accent-primary)] font-bold text-xs">✅ {getSelectionLabel(voted)} {tv.voted || 'Voted'}</span>
                                                        </div>
                                                    ) : (
                                                        <div className={`grid gap-2.5 ${showDraw ? 'grid-cols-3' : 'grid-cols-2'}`}>
                                                            <button onClick={() => handleVote(matchId, 'Home', match.home_odds)}
                                                                className="py-3 rounded-lg text-xs font-bold transition-all active:scale-95 hover:shadow-[0_0_12px_rgba(0,212,255,0.2)]"
                                                                style={{ minHeight: '48px', background: 'rgba(0,212,255,0.06)', border: '1px solid rgba(0,212,255,0.18)', color: '#66d9ff' }}
                                                                onMouseEnter={e => { e.currentTarget.style.background = 'rgba(0,212,255,0.12)'; e.currentTarget.style.borderColor = 'rgba(0,212,255,0.35)'; }}
                                                                onMouseLeave={e => { e.currentTarget.style.background = 'rgba(0,212,255,0.06)'; e.currentTarget.style.borderColor = 'rgba(0,212,255,0.18)'; }}
                                                            >
                                                                {tv.homeWin || 'Home'}
                                                            </button>
                                                            {showDraw && (
                                                                <button onClick={() => handleVote(matchId, 'Draw', match.draw_odds)}
                                                                    className="py-3 rounded-lg text-xs font-bold transition-all active:scale-95"
                                                                    style={{ minHeight: '48px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.7)' }}
                                                                    onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.08)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.18)'; }}
                                                                    onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'; }}
                                                                >
                                                                    {tv.draw || 'Draw'}
                                                                </button>
                                                            )}
                                                            <button onClick={() => handleVote(matchId, 'Away', match.away_odds)}
                                                                className="py-3 rounded-lg text-xs font-bold transition-all active:scale-95 hover:shadow-[0_0_12px_rgba(139,92,246,0.2)]"
                                                                style={{ minHeight: '48px', background: 'rgba(139,92,246,0.06)', border: '1px solid rgba(139,92,246,0.18)', color: '#b89dfa' }}
                                                                onMouseEnter={e => { e.currentTarget.style.background = 'rgba(139,92,246,0.12)'; e.currentTarget.style.borderColor = 'rgba(139,92,246,0.35)'; }}
                                                                onMouseLeave={e => { e.currentTarget.style.background = 'rgba(139,92,246,0.06)'; e.currentTarget.style.borderColor = 'rgba(139,92,246,0.18)'; }}
                                                            >
                                                                {tv.awayWin || 'Away'}
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
