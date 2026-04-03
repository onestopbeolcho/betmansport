'use client';

import { useState, useEffect, useMemo } from 'react';
import { useParams } from 'next/navigation';

interface TeamStanding {
    team_name: string;
    rank: number;
    played?: number;
    won?: number;
    draw?: number;
    lost?: number;
    goals_for?: number;
    goals_against?: number;
    goal_diff?: number;
    points?: number;
    form?: string;
}

const LEAGUE_INFO: Record<string, { name: string; nameKo: string; emoji: string; sport: string }> = {
    soccer_epl: { name: 'Premier League', nameKo: '프리미어리그', emoji: '🏴󠁧󠁢󠁥󠁮󠁧󠁿', sport: 'football' },
    soccer_spain_la_liga: { name: 'La Liga', nameKo: '라 리가', emoji: '🇪🇸', sport: 'football' },
    soccer_germany_bundesliga: { name: 'Bundesliga', nameKo: '분데스리가', emoji: '🇩🇪', sport: 'football' },
    soccer_italy_serie_a: { name: 'Serie A', nameKo: '세리에 A', emoji: '🇮🇹', sport: 'football' },
    soccer_france_ligue_one: { name: 'Ligue 1', nameKo: '리그 1', emoji: '🇫🇷', sport: 'football' },
    soccer_uefa_champs_league: { name: 'Champions League', nameKo: '챔피언스리그', emoji: '🏆', sport: 'football' },
    soccer_japan_jleague: { name: 'J-League', nameKo: 'J리그', emoji: '🇯🇵', sport: 'football' },
    soccer_usa_mls: { name: 'MLS', nameKo: 'MLS', emoji: '🇺🇸', sport: 'football' },
    soccer_netherlands_eredivisie: { name: 'Eredivisie', nameKo: '에레디비시', emoji: '🇳🇱', sport: 'football' },
    soccer_portugal_liga: { name: 'Liga Portugal', nameKo: '리가 포르투갈', emoji: '🇵🇹', sport: 'football' },
};

function FormBadges({ form }: { form: string }) {
    if (!form) return <span style={{ color: '#666' }}>—</span>;
    const recent = form.slice(-5);
    return (
        <div style={{ display: 'flex', gap: '2px' }}>
            {recent.split('').map((ch, i) => {
                const color = ch === 'W' ? '#22c55e' : ch === 'D' ? '#f59e0b' : '#ef4444';
                const bg = ch === 'W' ? 'rgba(34,197,94,0.15)' : ch === 'D' ? 'rgba(245,158,11,0.15)' : 'rgba(239,68,68,0.15)';
                return (
                    <span
                        key={i}
                        style={{
                            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                            width: '20px', height: '20px', borderRadius: '4px',
                            fontSize: '10px', fontWeight: 700, color, background: bg,
                        }}
                    >
                        {ch}
                    </span>
                );
            })}
        </div>
    );
}

export default function StandingsPage() {
    const params = useParams();
    const lang = (params?.lang as string) || 'ko';
    const isKo = lang === 'ko';

    const [allStandings, setAllStandings] = useState<Record<string, TeamStanding[]>>({});
    const [loading, setLoading] = useState(true);
    const [selectedLeague, setSelectedLeague] = useState<string>('');
    const [searchQuery, setSearchQuery] = useState('');

    const apiUrl = process.env.NEXT_PUBLIC_API_URL || '';

    useEffect(() => {
        async function fetchStandings() {
            try {
                const res = await fetch(`${apiUrl}/api/ai/standings-all`);
                if (res.ok) {
                    const data = await res.json();
                    setAllStandings(data.leagues || {});
                    const keys = Object.keys(data.leagues || {});
                    if (keys.length > 0 && !selectedLeague) {
                        setSelectedLeague(keys[0]);
                    }
                }
            } catch (err) {
                console.error('Failed to fetch standings:', err);
            } finally {
                setLoading(false);
            }
        }
        fetchStandings();
    }, [apiUrl]);

    const leagueKeys = Object.keys(allStandings);

    const currentStandings = useMemo(() => {
        const teams = allStandings[selectedLeague] || [];
        if (!searchQuery) return teams;
        return teams.filter(t =>
            t.team_name.toLowerCase().includes(searchQuery.toLowerCase())
        );
    }, [allStandings, selectedLeague, searchQuery]);

    const leagueInfo = LEAGUE_INFO[selectedLeague] || {
        name: selectedLeague, nameKo: selectedLeague, emoji: '⚽', sport: 'football',
    };

    return (
        <div style={{ minHeight: '100vh', background: '#0a0a14', color: '#e0e0e0', padding: '24px 16px' }}>
            <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
                {/* Header */}
                <div style={{ marginBottom: '32px' }}>
                    <h1 style={{
                        fontSize: '28px', fontWeight: 800, margin: 0,
                        background: 'linear-gradient(135deg, #818cf8, #a78bfa)',
                        WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
                    }}>
                        🏆 {isKo ? '리그 순위표' : 'League Standings'}
                    </h1>
                    <p style={{ color: '#888', marginTop: '8px', fontSize: '14px' }}>
                        {isKo ? '주요 축구 리그 실시간 순위 · AI 분석 데이터 기반' : 'Live standings across major football leagues · AI data-driven'}
                    </p>
                </div>

                {/* League Tabs */}
                <div style={{
                    display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '24px',
                    padding: '12px', background: 'rgba(255,255,255,0.03)', borderRadius: '12px',
                }}>
                    {leagueKeys.map(key => {
                        const info = LEAGUE_INFO[key] || { emoji: '⚽', nameKo: key, name: key };
                        const isActive = key === selectedLeague;
                        return (
                            <button
                                key={key}
                                onClick={() => { setSelectedLeague(key); setSearchQuery(''); }}
                                style={{
                                    padding: '8px 16px', borderRadius: '8px', border: 'none',
                                    cursor: 'pointer', fontSize: '13px', fontWeight: isActive ? 700 : 500,
                                    background: isActive ? 'linear-gradient(135deg, #6366f1, #8b5cf6)' : 'rgba(255,255,255,0.05)',
                                    color: isActive ? '#fff' : '#aaa',
                                    transition: 'all 0.2s',
                                }}
                            >
                                {info.emoji} {isKo ? info.nameKo : info.name}
                            </button>
                        );
                    })}
                </div>

                {loading ? (
                    <div style={{ textAlign: 'center', padding: '80px 0', color: '#888' }}>
                        <div style={{ fontSize: '40px', marginBottom: '16px' }}>⏳</div>
                        <p>{isKo ? '순위 데이터 로딩 중...' : 'Loading standings...'}</p>
                    </div>
                ) : leagueKeys.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '80px 0', color: '#888' }}>
                        <div style={{ fontSize: '40px', marginBottom: '16px' }}>📭</div>
                        <p>{isKo ? '순위 데이터가 아직 수집되지 않았습니다.' : 'No standings data collected yet.'}</p>
                        <p style={{ fontSize: '13px', marginTop: '8px' }}>
                            {isKo ? '서버 시작 후 자동으로 수집됩니다.' : 'Data is collected automatically after server starts.'}
                        </p>
                    </div>
                ) : (
                    <>
                        {/* Search */}
                        <div style={{ marginBottom: '16px' }}>
                            <input
                                type="text"
                                placeholder={isKo ? '🔍 팀 이름 검색...' : '🔍 Search team...'}
                                value={searchQuery}
                                onChange={e => setSearchQuery(e.target.value)}
                                style={{
                                    width: '100%', maxWidth: '300px', padding: '10px 16px',
                                    background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
                                    borderRadius: '8px', color: '#e0e0e0', fontSize: '14px', outline: 'none',
                                }}
                            />
                        </div>

                        {/* League Title */}
                        <div style={{
                            display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px',
                            padding: '16px 20px', background: 'rgba(99,102,241,0.08)',
                            borderRadius: '12px', border: '1px solid rgba(99,102,241,0.2)',
                        }}>
                            <span style={{ fontSize: '32px' }}>{leagueInfo.emoji}</span>
                            <div>
                                <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 700, color: '#fff' }}>
                                    {isKo ? leagueInfo.nameKo : leagueInfo.name}
                                </h2>
                                <p style={{ margin: 0, fontSize: '12px', color: '#888' }}>
                                    {currentStandings.length} {isKo ? '팀' : 'teams'}
                                </p>
                            </div>
                        </div>

                        {/* Table */}
                        <div style={{ overflowX: 'auto', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.06)' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
                                <thead>
                                    <tr style={{ background: 'rgba(255,255,255,0.04)' }}>
                                        <th style={thStyle}>#</th>
                                        <th style={{ ...thStyle, textAlign: 'left' }}>{isKo ? '팀' : 'Team'}</th>
                                        <th style={thStyle}>{isKo ? '경기' : 'P'}</th>
                                        <th style={thStyle}>{isKo ? '승' : 'W'}</th>
                                        <th style={thStyle}>{isKo ? '무' : 'D'}</th>
                                        <th style={thStyle}>{isKo ? '패' : 'L'}</th>
                                        <th style={thStyle}>{isKo ? '득점' : 'GF'}</th>
                                        <th style={thStyle}>{isKo ? '실점' : 'GA'}</th>
                                        <th style={thStyle}>{isKo ? '득실' : 'GD'}</th>
                                        <th style={{ ...thStyle, color: '#818cf8' }}>{isKo ? '승점' : 'PTS'}</th>
                                        <th style={thStyle}>{isKo ? '최근 폼' : 'Form'}</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {currentStandings.map((team, idx) => {
                                        const rank = team.rank || idx + 1;
                                        const isTop = rank <= 4;
                                        const isBottom = rank >= (currentStandings.length - 2);
                                        return (
                                            <tr
                                                key={team.team_name + idx}
                                                style={{
                                                    background: idx % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.02)',
                                                    borderBottom: '1px solid rgba(255,255,255,0.04)',
                                                    transition: 'background 0.2s',
                                                }}
                                                onMouseEnter={e => (e.currentTarget.style.background = 'rgba(99,102,241,0.06)')}
                                                onMouseLeave={e => (e.currentTarget.style.background = idx % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.02)')}
                                            >
                                                <td style={{ ...tdStyle, textAlign: 'center', fontWeight: 700 }}>
                                                    <span style={{
                                                        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                                                        width: '24px', height: '24px', borderRadius: '6px', fontSize: '12px',
                                                        background: isTop ? 'rgba(34,197,94,0.15)' : isBottom ? 'rgba(239,68,68,0.15)' : 'transparent',
                                                        color: isTop ? '#22c55e' : isBottom ? '#ef4444' : '#888',
                                                    }}>
                                                        {rank}
                                                    </span>
                                                </td>
                                                <td style={{ ...tdStyle, fontWeight: 600, color: '#fff' }}>
                                                    {team.team_name}
                                                </td>
                                                <td style={tdCenter}>{team.played ?? '—'}</td>
                                                <td style={{ ...tdCenter, color: '#22c55e' }}>{team.won ?? '—'}</td>
                                                <td style={{ ...tdCenter, color: '#f59e0b' }}>{team.draw ?? '—'}</td>
                                                <td style={{ ...tdCenter, color: '#ef4444' }}>{team.lost ?? '—'}</td>
                                                <td style={tdCenter}>{team.goals_for ?? '—'}</td>
                                                <td style={tdCenter}>{team.goals_against ?? '—'}</td>
                                                <td style={{
                                                    ...tdCenter,
                                                    color: (team.goal_diff ?? 0) > 0 ? '#22c55e' : (team.goal_diff ?? 0) < 0 ? '#ef4444' : '#888',
                                                    fontWeight: 600,
                                                }}>
                                                    {(team.goal_diff ?? 0) > 0 ? '+' : ''}{team.goal_diff ?? '—'}
                                                </td>
                                                <td style={{ ...tdCenter, fontWeight: 800, color: '#818cf8', fontSize: '16px' }}>
                                                    {team.points ?? '—'}
                                                </td>
                                                <td style={tdCenter}>
                                                    <FormBadges form={team.form || ''} />
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>

                        {/* Legend */}
                        <div style={{
                            display: 'flex', gap: '24px', marginTop: '16px', padding: '12px 16px',
                            background: 'rgba(255,255,255,0.02)', borderRadius: '8px', fontSize: '12px', color: '#888',
                        }}>
                            <span><span style={{ color: '#22c55e' }}>●</span> {isKo ? 'UCL / 승격' : 'UCL / Promotion'}</span>
                            <span><span style={{ color: '#ef4444' }}>●</span> {isKo ? '강등' : 'Relegation'}</span>
                            <span style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                                {isKo ? '폼:' : 'Form:'}
                                <span style={{ color: '#22c55e', fontWeight: 700 }}>W</span>
                                <span style={{ color: '#f59e0b', fontWeight: 700 }}>D</span>
                                <span style={{ color: '#ef4444', fontWeight: 700 }}>L</span>
                            </span>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}

const thStyle: React.CSSProperties = {
    padding: '12px 8px', textAlign: 'center', fontWeight: 600,
    color: '#999', fontSize: '12px', textTransform: 'uppercase',
    borderBottom: '2px solid rgba(255,255,255,0.08)',
};

const tdStyle: React.CSSProperties = {
    padding: '10px 8px', verticalAlign: 'middle',
};

const tdCenter: React.CSSProperties = {
    ...tdStyle, textAlign: 'center', color: '#ccc',
};
