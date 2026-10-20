'use client';

import { useState, useEffect, useMemo } from 'react';
import { useParams, usePathname } from 'next/navigation';
import Navbar from '../../components/Navbar';
import DeadlineBanner from '../../components/DeadlineBanner';
import { formatTeamDisplay, mapTeamName } from '../../lib/teamNames';
import { i18n } from '../../lib/i18n-config';

interface TeamStanding {
    team_name: string;
    team_name_ko?: string;
    rank: number;
    played?: number;
    won?: number;
    wins?: number;
    draw?: number;
    draws?: number;
    lost?: number;
    losses?: number;
    goals_for?: number;
    goals_against?: number;
    goal_diff?: number;
    points?: number;
    form?: string;
}

const LEAGUE_INFO: Record<string, { name: string; nameKo: string; emoji: string; sport: string }> = {
    soccer_epl: { name: 'Premier League', nameKo: '프리미어리그', emoji: '🏴󠁧󠁢󠁥󠁮󠁧󠁿', sport: 'football' },
    soccer_spain_la_liga: { name: 'La Liga', nameKo: '라리가', emoji: '🇪🇸', sport: 'football' },
    soccer_germany_bundesliga: { name: 'Bundesliga', nameKo: '분데스리가', emoji: '🇩🇪', sport: 'football' },
    soccer_italy_serie_a: { name: 'Serie A', nameKo: '세리에 A', emoji: '🇮🇹', sport: 'football' },
    soccer_france_ligue_one: { name: 'Ligue 1', nameKo: '리그 1', emoji: '🇫🇷', sport: 'football' },
    soccer_uefa_champs_league: { name: 'Champions League', nameKo: '챔피언스리그', emoji: '🏆', sport: 'football' },
    soccer_uefa_europa_league: { name: 'Europa League', nameKo: '유로파리그', emoji: '🏆', sport: 'football' },
    soccer_netherlands_eredivisie: { name: 'Eredivisie', nameKo: '에레디비시', emoji: '🇳🇱', sport: 'football' },
    soccer_portugal_liga: { name: 'Liga Portugal', nameKo: '포르투갈 리가', emoji: '🇵🇹', sport: 'football' },
    soccer_brazil_serie_a: { name: 'Brasileirão Série A', nameKo: '브라질 세리에 A', emoji: '🇧🇷', sport: 'football' },
    soccer_mexico_liga_mx: { name: 'Liga MX', nameKo: '멕시코 리가 MX', emoji: '🇲🇽', sport: 'football' },
    soccer_usa_mls: { name: 'MLS', nameKo: '미국 MLS', emoji: '🇺🇸', sport: 'football' },
    soccer_korea_kleague: { name: 'K League 1', nameKo: 'K리그1', emoji: '🇰🇷', sport: 'football' },
    soccer_japan_jleague: { name: 'J1 League', nameKo: 'J1리그', emoji: '🇯🇵', sport: 'football' },
    baseball_mlb: { name: 'MLB', nameKo: 'MLB (메이저리그)', emoji: '⚾', sport: 'baseball' },
    basketball_nba: { name: 'NBA', nameKo: 'NBA (프로농구)', emoji: '🏀', sport: 'basketball' },
    icehockey_nhl: { name: 'NHL', nameKo: 'NHL (아이스하키)', emoji: '🏒', sport: 'hockey' },
};

function FormBadges({ form }: { form: string }) {
    if (!form) return <span style={{ color: '#666' }}>—</span>;
    const recent = form.slice(-5);
    return (
        <div style={{ display: 'flex', gap: '2px', justifyContent: 'center' }}>
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
    const pathname = usePathname() || '';
    const sortedLocales = [...i18n.locales].sort((a, b) => b.length - a.length);
    const detectedLang = sortedLocales.find((l) => pathname.startsWith(`/${l}/`) || pathname === `/${l}`) || i18n.defaultLocale;
    const lang = (params?.lang as string) || detectedLang || 'ko';
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
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [apiUrl]);

    const leagueKeys = Object.keys(allStandings);

    const currentStandings = useMemo(() => {
        const teams = allStandings[selectedLeague] || [];
        if (!searchQuery) return teams;
        const q = searchQuery.toLowerCase();
        return teams.filter(t => {
            const ko = mapTeamName(t.team_name, t.team_name_ko).toLowerCase();
            return t.team_name.toLowerCase().includes(q) || ko.includes(q);
        });
    }, [allStandings, selectedLeague, searchQuery]);

    const leagueInfo = LEAGUE_INFO[selectedLeague] || {
        name: selectedLeague, nameKo: selectedLeague, emoji: '⚽', sport: 'football',
    };

    return (
        <div className="min-h-screen flex flex-col" style={{ background: 'var(--bg-primary)', color: '#e0e0e0' }}>
            <DeadlineBanner />
            <Navbar />

            <main className="flex-grow w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                {/* Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                    <div>
                        <h1 className="text-2xl sm:text-3xl font-extrabold text-white flex items-center gap-2.5">
                            <span>🏆</span>
                            <span className="gradient-text">{isKo ? '17개 글로벌 리그 실시간 순위표' : 'Global League Standings'}</span>
                        </h1>
                        <p className="text-xs sm:text-sm mt-1.5" style={{ color: 'var(--text-muted)' }}>
                            {isKo ? '3-Pillar 하이브리드 퀀트 엔진에 실시간 반영되는 17개 리그 공식 순위 및 최근 5경기 흐름 데이터' : 'Live standings & form data across 17 leagues powering the 3-Pillar AI Quant Engine'}
                        </p>
                    </div>
                    <a
                        href={`/${lang}/analysis`}
                        className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold text-white transition hover:scale-105 self-start sm:self-auto"
                        style={{ background: 'linear-gradient(135deg, var(--accent-primary), var(--accent-secondary))' }}
                    >
                        🧠 {isKo ? '오늘의 AI 매치 리포트 보러가기 →' : 'View AI Match Reports →'}
                    </a>
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
                                                    {isKo ? formatTeamDisplay(team.team_name, team.team_name_ko) : team.team_name}
                                                </td>
                                                <td style={tdCenter}>{team.played ?? '—'}</td>
                                                <td style={{ ...tdCenter, color: '#22c55e' }}>{team.won ?? team.wins ?? '—'}</td>
                                                <td style={{ ...tdCenter, color: '#f59e0b' }}>{team.draw ?? team.draws ?? '—'}</td>
                                                <td style={{ ...tdCenter, color: '#ef4444' }}>{team.lost ?? team.losses ?? '—'}</td>
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
                            <span><span style={{ color: '#22c55e' }}>●</span> {isKo ? '상위 시드 / 챔피언스리그 진출권' : 'Top Seed / UCL'}</span>
                            <span><span style={{ color: '#ef4444' }}>●</span> {isKo ? '하위권 / 강등권' : 'Relegation Zone'}</span>
                            <span style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                                {isKo ? '최근 5경기 폼:' : 'Recent Form:'}
                                <span style={{ color: '#22c55e', fontWeight: 700 }}>W(승)</span>
                                <span style={{ color: '#f59e0b', fontWeight: 700 }}>D(무)</span>
                                <span style={{ color: '#ef4444', fontWeight: 700 }}>L(패)</span>
                            </span>
                        </div>
                    </>
                )}
            </main>
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
