"use client";
import React from 'react';
import OddsHistoryChart from './OddsHistoryChart';

interface Factor {
    name: string;
    weight: number;
    score: number;
    detail: string;
    home_momentum?: number;
    away_momentum?: number;
    league_home_advantage?: number;
    home_quality_penalty?: number;
    away_quality_penalty?: number;
    recency_home?: number;
    recency_away?: number;
}

interface Injury {
    player_name: string;
    reason: string;
    status: string;
}

interface HistoryItem {
    timestamp: string;
    home_odds: number;
    draw_odds: number;
    away_odds: number;
}

interface Props {
    prediction: {
        confidence: number;
        recommendation: string;
        home_win_prob: number;
        draw_prob: number;
        away_win_prob: number;
        factors: Factor[];
        home_rank: number;
        away_rank: number;
        home_form: string;
        away_form: string;
        injuries_home: string[];
        injuries_away: string[];
        api_prediction?: string;
        api_prediction_pct?: { home: number; draw: number; away: number };
    };
    injuries?: {
        home: Injury[];
        away: Injury[];
    };
    homeTeam: string;
    awayTeam: string;
    historyData?: HistoryItem[];
    userTier?: string; // 'free' | 'pro' | 'vip'
}

const FACTOR_ICONS: Record<string, string> = {
    'Implied Probability': '📊',
    '배당률 내재 확률': '📊',
    '내재 확률': '📊',
    'Ranking Gap': '🏅',
    '리그 순위': '🏅',
    '순위 격차': '🏅',
    'Form': '📈',
    '최근 폼': '📈',
    'Head to Head': '⚔️',
    '상대전적': '⚔️',
    '상대 전적': '⚔️',
    'Venue Advantage': '🏟️',
    '홈/어웨이': '🏟️',
    '홈 어드밴티지': '🏟️',
    'Injuries': '🏥',
    '부상/결장': '🏥',
    '부상 영향': '🏥',
    '외부 AI 예측': '🤖',
    'API Prediction': '🤖',
};

const getFactorColor = (score: number) => {
    if (score >= 70) return { bar: '#4ade80', text: '#4ade80', bg: 'rgba(74,222,128,0.1)' };
    if (score >= 50) return { bar: '#fbbf24', text: '#fbbf24', bg: 'rgba(251,191,36,0.1)' };
    if (score >= 30) return { bar: '#f97316', text: '#f97316', bg: 'rgba(249,115,22,0.1)' };
    return { bar: '#f87171', text: '#f87171', bg: 'rgba(248,113,113,0.1)' };
};

const getFormBadge = (char: string) => {
    switch (char) {
        case 'W': return { bg: 'rgba(74,222,128,0.15)', color: '#4ade80', label: 'W' };
        case 'D': return { bg: 'rgba(251,191,36,0.12)', color: '#fbbf24', label: 'D' };
        case 'L': return { bg: 'rgba(248,113,113,0.12)', color: '#f87171', label: 'L' };
        default: return { bg: 'rgba(255,255,255,0.05)', color: 'var(--text-muted)', label: char };
    }
};

export default function ProAnalysisPanel({ prediction: pred, injuries, homeTeam, awayTeam, historyData, userTier = 'free' }: Props) {
    const isPro = userTier === 'pro' || userTier === 'vip';

    return (
        <div className="space-y-4 mt-4">
            {/* ── AI Confidence Hero ── */}
            <div className="rounded-xl p-4 relative overflow-hidden" style={{
                background: 'linear-gradient(135deg, rgba(0,212,255,0.06), rgba(139,92,246,0.06))',
                border: '1px solid rgba(0,212,255,0.12)',
            }}>
                <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-bold flex items-center gap-1.5" style={{ color: 'var(--accent-primary)' }}>
                        🧠 AI 종합 분석 리포트
                    </span>
                    <span className="text-[10px] px-2.5 py-1 rounded-full font-bold" style={{
                        background: pred.confidence >= 65 ? 'rgba(255,107,53,0.15)' : pred.confidence >= 50 ? 'rgba(251,191,36,0.12)' : 'rgba(255,255,255,0.05)',
                        color: pred.confidence >= 65 ? '#ff6b35' : pred.confidence >= 50 ? '#fbbf24' : 'var(--text-muted)',
                    }}>
                        {pred.confidence >= 65 ? '🔥 Strong' : pred.confidence >= 50 ? '⭐ Good' : '➖ Normal'} {pred.confidence.toFixed(0)}%
                    </span>
                </div>

                {/* Win Probability Bar */}
                <div className="mb-1">
                    <div className="flex justify-between text-[10px] mb-1" style={{ color: 'var(--text-muted)' }}>
                        <span>{homeTeam} {pred.home_win_prob.toFixed(0)}%</span>
                        <span>무승부 {pred.draw_prob.toFixed(0)}%</span>
                        <span>{awayTeam} {pred.away_win_prob.toFixed(0)}%</span>
                    </div>
                    <div className="flex h-3.5 rounded-full overflow-hidden" style={{ background: 'var(--bg-primary)' }}>
                        <div style={{ width: `${pred.home_win_prob}%`, background: 'linear-gradient(90deg, #00d4ff, #22d3ee)' }}
                            className="transition-all duration-1000 rounded-l-full" />
                        <div style={{ width: `${pred.draw_prob}%`, background: 'rgba(255,255,255,0.1)' }}
                            className="transition-all duration-1000" />
                        <div style={{ width: `${pred.away_win_prob}%`, background: 'linear-gradient(90deg, #a78bfa, #8b5cf6)' }}
                            className="transition-all duration-1000 rounded-r-full" />
                    </div>
                </div>

                {/* API-Football External Prediction */}
                {pred.api_prediction_pct && (
                    <div className="mt-3 p-2.5 rounded-lg" style={{ background: 'rgba(53,199,89,0.05)', border: '1px solid rgba(53,199,89,0.15)' }}>
                        <div className="flex items-center justify-between">
                            <span className="text-[10px] font-bold" style={{ color: '#35c759' }}>⚽ API-Football 예측</span>
                            <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
                                홈 {pred.api_prediction_pct.home}% / 무 {pred.api_prediction_pct.draw}% / 원정 {pred.api_prediction_pct.away}%
                            </span>
                        </div>
                    </div>
                )}
            </div>

            {/* ── 6-Factor Detailed Breakdown (Pro Feature) ── */}
            <div className="rounded-xl overflow-hidden" style={{
                border: '1px solid var(--border-subtle)',
                background: 'var(--bg-card)',
            }}>
                <div className="px-4 py-2.5 flex items-center justify-between" style={{
                    background: 'rgba(0,212,255,0.04)',
                    borderBottom: '1px solid var(--border-subtle)',
                }}>
                    <span className="text-xs font-bold flex items-center gap-1.5" style={{ color: 'var(--accent-primary)' }}>
                        📊 7-Factor AI v2 분석
                    </span>
                    {!isPro && (
                        <span className="text-[9px] px-2 py-0.5 rounded-full font-bold"
                            style={{ background: 'rgba(251,191,36,0.12)', color: '#fbbf24' }}>
                            🔒 Pro
                        </span>
                    )}
                </div>

                <div className="p-3 space-y-2">
                    {pred.factors.map((f, i) => {
                        const icon = FACTOR_ICONS[f.name] || '📌';
                        const color = getFactorColor(f.score);
                        const isLocked = !isPro && i >= 2; // Free: 상위 2개만 공개

                        return (
                            <div key={i} className="rounded-lg p-2.5 relative transition-all" style={{
                                background: isLocked ? 'rgba(255,255,255,0.02)' : color.bg,
                                border: `1px solid ${isLocked ? 'var(--border-subtle)' : color.bar}20`,
                                filter: isLocked ? 'blur(3px)' : 'none',
                                pointerEvents: isLocked ? 'none' : 'auto',
                            }}>
                                <div className="flex items-center justify-between mb-1.5">
                                    <div className="flex items-center gap-1.5">
                                        <span className="text-sm">{icon}</span>
                                        <span className="text-[11px] font-bold" style={{ color: 'var(--text-primary)' }}>{f.name}</span>
                                        <span className="text-[9px] px-1.5 py-0.5 rounded" style={{ background: 'var(--bg-primary)', color: 'var(--text-muted)' }}>
                                            가중치 {(f.weight * 100).toFixed(0)}%
                                        </span>
                                    </div>
                                    <span className="text-xs font-black" style={{ color: color.text }}>{f.score.toFixed(0)}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ background: 'var(--bg-primary)' }}>
                                        <div
                                            className="h-full rounded-full transition-all duration-1000"
                                            style={{ width: `${Math.min(f.score, 100)}%`, background: color.bar }}
                                        />
                                    </div>
                                </div>
                                <p className="text-[10px] mt-1.5" style={{ color: 'var(--text-secondary)' }}>{f.detail}</p>
                                {/* 모멘텀 트렌드 표시 */}
                                {f.home_momentum !== undefined && (
                                    <div className="flex items-center gap-2 mt-1.5">
                                        <span className="text-[9px] px-1.5 py-0.5 rounded-full font-bold" style={{
                                            background: f.home_momentum > 5 ? 'rgba(74,222,128,0.12)' : f.home_momentum < -5 ? 'rgba(248,113,113,0.12)' : 'rgba(255,255,255,0.05)',
                                            color: f.home_momentum > 5 ? '#4ade80' : f.home_momentum < -5 ? '#f87171' : 'var(--text-muted)',
                                        }}>
                                            홈 {f.home_momentum > 5 ? '↑상승' : f.home_momentum < -5 ? '↓하락' : '→유지'}
                                        </span>
                                        <span className="text-[9px] px-1.5 py-0.5 rounded-full font-bold" style={{
                                            background: (f.away_momentum || 0) > 5 ? 'rgba(74,222,128,0.12)' : (f.away_momentum || 0) < -5 ? 'rgba(248,113,113,0.12)' : 'rgba(255,255,255,0.05)',
                                            color: (f.away_momentum || 0) > 5 ? '#4ade80' : (f.away_momentum || 0) < -5 ? '#f87171' : 'var(--text-muted)',
                                        }}>
                                            원정 {(f.away_momentum || 0) > 5 ? '↑상승' : (f.away_momentum || 0) < -5 ? '↓하락' : '→유지'}
                                        </span>
                                    </div>
                                )}
                                {/* 리그별 홈어드밴티지 배지 */}
                                {f.league_home_advantage && f.league_home_advantage !== 1.05 && (
                                    <span className="inline-block mt-1.5 text-[9px] px-1.5 py-0.5 rounded-full font-bold" style={{
                                        background: f.league_home_advantage > 1.15 ? 'rgba(255,107,53,0.12)' : 'rgba(0,212,255,0.08)',
                                        color: f.league_home_advantage > 1.15 ? '#ff6b35' : '#00d4ff',
                                    }}>
                                        🏟️ 홈 계수 ×{f.league_home_advantage.toFixed(2)}
                                        {f.league_home_advantage > 1.15 && ' 🔥'}
                                    </span>
                                )}
                                {/* 부상 품질 감점 배지 */}
                                {f.home_quality_penalty !== undefined && f.home_quality_penalty > 0 && (
                                    <div className="flex items-center gap-2 mt-1.5">
                                        <span className="text-[9px] px-1.5 py-0.5 rounded-full" style={{
                                            background: 'rgba(248,113,113,0.1)',
                                            color: '#f87171'
                                        }}>
                                            홈 -{f.home_quality_penalty}점
                                        </span>
                                        <span className="text-[9px] px-1.5 py-0.5 rounded-full" style={{
                                            background: 'rgba(248,113,113,0.1)',
                                            color: '#f87171'
                                        }}>
                                            원정 -{f.away_quality_penalty || 0}점
                                        </span>
                                    </div>
                                )}
                                {/* H2H Recency 배지 */}
                                {f.recency_home !== undefined && (f.recency_home > 0 || (f.recency_away || 0) > 0) && (
                                    <div className="flex items-center gap-2 mt-1.5">
                                        <span className="text-[9px] px-1.5 py-0.5 rounded-full" style={{
                                            background: 'rgba(139,92,246,0.1)',
                                            color: '#a78bfa'
                                        }}>
                                            최근성 홈 {f.recency_home.toFixed(1)} / 원정 {(f.recency_away || 0).toFixed(1)}
                                        </span>
                                    </div>
                                )}
                            </div>
                        );
                    })}

                    {!isPro && pred.factors.length > 2 && (
                        <div className="text-center py-3">
                            <a href="/pricing" className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold transition-all hover:scale-105"
                                style={{
                                    background: 'linear-gradient(135deg, rgba(0,212,255,0.15), rgba(139,92,246,0.15))',
                                    color: 'var(--accent-primary)',
                                    border: '1px solid rgba(0,212,255,0.3)',
                                }}>
                                🔓 Pro에서 전체 7-Factor AI 분석 보기
                            </a>
                        </div>
                    )}
                </div>
            </div>

            {/* ── Form Comparison ── */}
            {(pred.home_form || pred.away_form) && (
                <div className="rounded-xl p-4" style={{
                    background: 'var(--bg-card)',
                    border: '1px solid var(--border-subtle)',
                }}>
                    <h4 className="text-xs font-bold mb-3 flex items-center gap-1.5" style={{ color: 'var(--accent-primary)' }}>
                        📈 최근 폼 비교
                    </h4>
                    <div className="grid grid-cols-2 gap-4">
                        {[
                            { team: homeTeam, form: pred.home_form, rank: pred.home_rank, color: '#00d4ff' },
                            { team: awayTeam, form: pred.away_form, rank: pred.away_rank, color: '#8b5cf6' },
                        ].map((side, si) => (
                            <div key={si}>
                                <div className="flex items-center justify-between mb-2">
                                    <span className="text-[11px] font-bold" style={{ color: side.color }}>{side.team}</span>
                                    {side.rank > 0 && (
                                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded" style={{
                                            background: `${side.color}15`,
                                            color: side.color,
                                        }}>#{side.rank}</span>
                                    )}
                                </div>
                                <div className="flex gap-1">
                                    {(side.form || '').split('').map((char, ci) => {
                                        const badge = getFormBadge(char);
                                        return (
                                            <span key={ci} className="w-6 h-6 flex items-center justify-center rounded text-[10px] font-bold"
                                                style={{ background: badge.bg, color: badge.color }}>
                                                {badge.label}
                                            </span>
                                        );
                                    })}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* ── Injury Panel ── */}
            {((injuries?.home && injuries.home.length > 0) || (injuries?.away && injuries.away.length > 0) ||
                pred.injuries_home.length > 0 || pred.injuries_away.length > 0) && (
                    <div className="rounded-xl overflow-hidden" style={{
                        border: '1px solid rgba(239,68,68,0.15)',
                        background: 'var(--bg-card)',
                    }}>
                        <div className="px-4 py-2.5 flex items-center justify-between" style={{
                            background: 'rgba(239,68,68,0.04)',
                            borderBottom: '1px solid rgba(239,68,68,0.1)',
                        }}>
                            <span className="text-xs font-bold flex items-center gap-1.5" style={{ color: '#f87171' }}>
                                🏥 부상·결장 정보
                            </span>
                            <span className="text-[9px]" style={{ color: 'var(--text-muted)' }}>
                                경기력에 직접 영향
                            </span>
                        </div>
                        <div className="p-3">
                            <div className="grid grid-cols-2 gap-3">
                                {/* Home Injuries */}
                                <div>
                                    <div className="text-[10px] font-bold mb-2 flex items-center gap-1" style={{ color: '#00d4ff' }}>
                                        🏠 {homeTeam}
                                    </div>
                                    {injuries?.home && injuries.home.length > 0 ? (
                                        <div className="space-y-1">
                                            {injuries.home.map((inj, i) => (
                                                <div key={i} className="flex items-center gap-1.5 p-1.5 rounded-lg text-[10px]"
                                                    style={{ background: 'rgba(239,68,68,0.04)' }}>
                                                    <span style={{ color: inj.status === 'Out' ? '#f87171' : '#fbbf24' }}>
                                                        {inj.status === 'Out' ? '🔴' : '🟡'}
                                                    </span>
                                                    <span className="font-medium" style={{ color: 'var(--text-primary)' }}>{inj.player_name}</span>
                                                    <span className="ml-auto" style={{ color: 'var(--text-muted)' }}>{inj.reason}</span>
                                                </div>
                                            ))}
                                        </div>
                                    ) : pred.injuries_home.length > 0 ? (
                                        <div className="space-y-1">
                                            {pred.injuries_home.map((name, i) => (
                                                <div key={i} className="flex items-center gap-1.5 p-1.5 rounded-lg text-[10px]"
                                                    style={{ background: 'rgba(239,68,68,0.04)' }}>
                                                    <span>🔴</span>
                                                    <span style={{ color: 'var(--text-primary)' }}>{name}</span>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <p className="text-[10px] p-1.5" style={{ color: 'var(--text-muted)' }}>부상자 없음 ✅</p>
                                    )}
                                </div>

                                {/* Away Injuries */}
                                <div>
                                    <div className="text-[10px] font-bold mb-2 flex items-center gap-1" style={{ color: '#8b5cf6' }}>
                                        ✈️ {awayTeam}
                                    </div>
                                    {injuries?.away && injuries.away.length > 0 ? (
                                        <div className="space-y-1">
                                            {injuries.away.map((inj, i) => (
                                                <div key={i} className="flex items-center gap-1.5 p-1.5 rounded-lg text-[10px]"
                                                    style={{ background: 'rgba(239,68,68,0.04)' }}>
                                                    <span style={{ color: inj.status === 'Out' ? '#f87171' : '#fbbf24' }}>
                                                        {inj.status === 'Out' ? '🔴' : '🟡'}
                                                    </span>
                                                    <span className="font-medium" style={{ color: 'var(--text-primary)' }}>{inj.player_name}</span>
                                                    <span className="ml-auto" style={{ color: 'var(--text-muted)' }}>{inj.reason}</span>
                                                </div>
                                            ))}
                                        </div>
                                    ) : pred.injuries_away.length > 0 ? (
                                        <div className="space-y-1">
                                            {pred.injuries_away.map((name, i) => (
                                                <div key={i} className="flex items-center gap-1.5 p-1.5 rounded-lg text-[10px]"
                                                    style={{ background: 'rgba(239,68,68,0.04)' }}>
                                                    <span>🔴</span>
                                                    <span style={{ color: 'var(--text-primary)' }}>{name}</span>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <p className="text-[10px] p-1.5" style={{ color: 'var(--text-muted)' }}>부상자 없음 ✅</p>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                )}

            {/* ── Odds History Chart ── */}
            {historyData && historyData.length >= 2 && (
                <div className="rounded-xl overflow-hidden" style={{
                    border: '1px solid var(--border-subtle)',
                    background: 'var(--bg-card)',
                }}>
                    <div className="px-4 py-2.5" style={{
                        background: 'rgba(0,212,255,0.04)',
                        borderBottom: '1px solid var(--border-subtle)',
                    }}>
                        <span className="text-xs font-bold flex items-center gap-1.5" style={{ color: 'var(--accent-primary)' }}>
                            📉 데이터 변동 추이
                        </span>
                    </div>
                    <div className="p-3">
                        <OddsHistoryChart data={historyData} />
                    </div>
                </div>
            )}

            {/* ── Analysis Sources ── */}
            <div className="flex flex-wrap gap-1.5 items-center pt-1">
                <span className="text-[9px]" style={{ color: 'var(--text-muted)' }}>분석 출처:</span>
                {[
                    { name: '7-Factor AI v2', c: '#00d4ff' },
                    { name: 'LightGBM ML 39F', c: '#22d3ee' },
                    { name: 'API-Football', c: '#35c759' },
                    { name: 'Pinnacle Odds', c: '#fbbf24' },
                    { name: 'football-data.org', c: '#a78bfa' },
                ].map((s, i) => (
                    <span key={i} className="text-[8px] px-1.5 py-0.5 rounded-full font-medium"
                        style={{ background: `${s.c}10`, color: s.c, border: `1px solid ${s.c}25` }}>
                        {s.name}
                    </span>
                ))}
            </div>
        </div>
    );
}
