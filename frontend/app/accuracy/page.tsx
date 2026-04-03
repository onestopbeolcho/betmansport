"use client";
import React, { useState, useEffect } from 'react';
import Navbar from '../components/Navbar';
import { useAuth } from '../context/AuthContext';

const API = process.env.NEXT_PUBLIC_API_URL || '';

interface AccuracyStats {
    total_predictions: number;
    hits: number;
    misses: number;
    accuracy_pct: number;
    by_league: Record<string, { hits: number; misses: number; total: number; accuracy_pct: number }>;
    by_date: Record<string, { hits: number; misses: number; total: number; accuracy_pct: number }>;
    period_days: number;
}

interface PredictionRecord {
    id: string;
    match_id: string;
    team_home: string;
    team_away: string;
    league: string;
    recommendation: string;
    confidence: number;
    home_win_prob: number;
    draw_prob: number;
    away_win_prob: number;
    status: string;
    actual_result: string | null;
    home_score: number | null;
    away_score: number | null;
    prediction_date: string;
    match_time: string;
}

const LEAGUE_LABELS: Record<string, string> = {
    soccer_epl: '🏴󠁧󠁢󠁥󠁮󠁧󠁿 EPL',
    soccer_spain_la_liga: '🇪🇸 La Liga',
    soccer_germany_bundesliga: '🇩🇪 Bundesliga',
    soccer_italy_serie_a: '🇮🇹 Serie A',
    soccer_france_ligue_one: '🇫🇷 Ligue 1',
    soccer_uefa_champs_league: '🏆 UCL',
};

export default function AccuracyPage() {
    const { user } = useAuth();
    const [stats, setStats] = useState<AccuracyStats | null>(null);
    const [records, setRecords] = useState<PredictionRecord[]>([]);
    const [period, setPeriod] = useState(30);
    const [loading, setLoading] = useState(true);
    const [tab, setTab] = useState<'overview' | 'history'>('overview');
    const userTier = user?.tier || 'free';

    useEffect(() => {
        fetchData();
    }, [period]);

    const fetchData = async () => {
        setLoading(true);
        try {
            const [statsRes, histRes] = await Promise.all([
                fetch(`${API}/api/ai/accuracy?days=${period}`),
                fetch(`${API}/api/ai/prediction-history?limit=50`),
            ]);
            if (statsRes.ok) setStats(await statsRes.json());
            if (histRes.ok) {
                const data = await histRes.json();
                setRecords(data.predictions || []);
            }
        } catch (e) {
            console.error('Accuracy fetch error:', e);
        }
        setLoading(false);
    };

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'HIT': return { bg: 'rgba(74,222,128,0.15)', color: '#4ade80', label: '✓ 적중' };
            case 'MISS': return { bg: 'rgba(248,113,113,0.15)', color: '#f87171', label: '✗ 미적중' };
            default: return { bg: 'rgba(251,191,36,0.15)', color: '#fbbf24', label: '⏳ 대기' };
        }
    };

    const getResultLabel = (rec: string) => {
        switch (rec) {
            case 'HOME': return '홈 승';
            case 'AWAY': return '원정 승';
            case 'DRAW': return '무승부';
            default: return rec;
        }
    };

    return (
        <div className="min-h-screen flex flex-col" style={{ background: 'var(--bg-primary)' }}>
            <Navbar />

            <main className="max-w-6xl mx-auto px-4 sm:px-6 py-10 w-full flex-grow">
                {/* Header */}
                <div className="text-center mb-10">
                    <h1 className="text-3xl sm:text-4xl font-extrabold" style={{ color: 'var(--text-primary)' }}>
                        🎯 AI <span className="gradient-text">분석 적중률</span>
                    </h1>
                    <p className="mt-3 text-base" style={{ color: 'var(--text-muted)' }}>
                        Scorenix AI의 실제 분석 정확도를 투명하게 공개합니다
                    </p>
                </div>

                {/* Period Toggle */}
                <div className="flex justify-center gap-2 mb-8">
                    {[7, 14, 30, 90].map(d => (
                        <button
                            key={d}
                            onClick={() => setPeriod(d)}
                            className="px-4 py-2 rounded-lg text-sm font-medium transition-all"
                            style={{
                                background: period === d ? 'var(--accent-primary)' : 'var(--bg-elevated)',
                                color: period === d ? '#fff' : 'var(--text-muted)',
                                border: `1px solid ${period === d ? 'var(--accent-primary)' : 'var(--border-subtle)'}`,
                            }}
                        >
                            {d}일
                        </button>
                    ))}
                </div>

                {/* Tabs */}
                <div className="flex gap-1 p-1 rounded-xl mb-8 mx-auto max-w-md" style={{ background: 'var(--bg-elevated)' }}>
                    <button
                        onClick={() => setTab('overview')}
                        className="flex-1 py-2 rounded-lg text-sm font-semibold transition-all"
                        style={{
                            background: tab === 'overview' ? 'var(--accent-primary)' : 'transparent',
                            color: tab === 'overview' ? '#fff' : 'var(--text-muted)',
                        }}
                    >
                        📊 종합 통계
                    </button>
                    <button
                        onClick={() => setTab('history')}
                        className="flex-1 py-2 rounded-lg text-sm font-semibold transition-all"
                        style={{
                            background: tab === 'history' ? 'var(--accent-primary)' : 'transparent',
                            color: tab === 'history' ? '#fff' : 'var(--text-muted)',
                        }}
                    >
                        📋 예측 이력
                    </button>
                </div>

                {loading ? (
                    <div className="text-center py-20">
                        <div className="inline-block w-8 h-8 border-2 rounded-full animate-spin" style={{ borderColor: 'var(--accent-primary)', borderTopColor: 'transparent' }} />
                        <p className="mt-3" style={{ color: 'var(--text-muted)' }}>데이터 로딩 중...</p>
                    </div>
                ) : tab === 'overview' ? (
                    <div className="space-y-6">
                        {/* Hero Accuracy Card */}
                        {stats && (
                            <div className="glass-card p-8 text-center" style={{ background: 'linear-gradient(135deg, rgba(0,212,255,0.08), rgba(139,92,246,0.08))' }}>
                                <p className="text-sm font-medium mb-2" style={{ color: 'var(--text-muted)' }}>
                                    최근 {stats.period_days}일간 AI 분석 정확도
                                </p>
                                <div className="text-6xl font-black gradient-text mb-3">
                                    {stats.total_predictions > 0 ? `${stats.accuracy_pct}%` : '—'}
                                </div>
                                <div className="flex justify-center gap-8">
                                    <div>
                                        <span className="text-2xl font-bold" style={{ color: '#4ade80' }}>{stats.hits}</span>
                                        <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>적중</p>
                                    </div>
                                    <div>
                                        <span className="text-2xl font-bold" style={{ color: '#f87171' }}>{stats.misses}</span>
                                        <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>미적중</p>
                                    </div>
                                    <div>
                                        <span className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>{stats.total_predictions}</span>
                                        <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>총 분석</p>
                                    </div>
                                </div>

                                {/* Accuracy Bar */}
                                {stats.total_predictions > 0 && (
                                    <div className="mt-6 max-w-md mx-auto">
                                        <div className="h-4 rounded-full overflow-hidden flex" style={{ background: 'var(--bg-primary)' }}>
                                            <div
                                                className="h-full transition-all duration-1000 rounded-l-full"
                                                style={{ width: `${stats.accuracy_pct}%`, background: 'linear-gradient(90deg, #4ade80, #22d3ee)' }}
                                            />
                                            <div
                                                className="h-full transition-all duration-1000 rounded-r-full"
                                                style={{ width: `${100 - stats.accuracy_pct}%`, background: 'rgba(248,113,113,0.4)' }}
                                            />
                                        </div>
                                    </div>
                                )}

                                {stats.total_predictions === 0 && (
                                    <p className="mt-4 text-sm" style={{ color: 'var(--text-muted)' }}>
                                        아직 판정된 예측이 없습니다. 경기 결과가 나오면 자동으로 업데이트됩니다.
                                    </p>
                                )}
                            </div>
                        )}

                        {/* League Breakdown */}
                        {stats && Object.keys(stats.by_league).length > 0 && (
                            <div className="glass-card p-6">
                                <h3 className="text-lg font-bold mb-4" style={{ color: 'var(--text-primary)' }}>
                                    📈 리그별 적중률
                                </h3>
                                {userTier === 'free' ? (
                                    <div className="text-center py-8">
                                        <p className="text-3xl mb-3">🔒</p>
                                        <p className="font-semibold" style={{ color: 'var(--text-primary)' }}>Pro 이상에서 확인 가능</p>
                                        <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
                                            리그별 상세 적중률, 일별 추이 등 Pro에서 제공
                                        </p>
                                        <a href="/pricing" className="btn-primary mt-4 inline-block px-6 py-2 text-sm">
                                            Pro 업그레이드
                                        </a>
                                    </div>
                                ) : (
                                    <div className="space-y-3">
                                        {Object.entries(stats.by_league)
                                            .sort((a, b) => b[1].total - a[1].total)
                                            .map(([league, data]) => (
                                                <div key={league} className="flex items-center gap-4 p-3 rounded-xl" style={{ background: 'var(--bg-elevated)' }}>
                                                    <span className="text-sm font-medium min-w-[120px]" style={{ color: 'var(--text-primary)' }}>
                                                        {LEAGUE_LABELS[league] || league}
                                                    </span>
                                                    <div className="flex-1 h-2.5 rounded-full overflow-hidden" style={{ background: 'var(--bg-primary)' }}>
                                                        <div
                                                            className="h-full rounded-full transition-all"
                                                            style={{ width: `${data.accuracy_pct}%`, background: data.accuracy_pct >= 60 ? '#4ade80' : data.accuracy_pct >= 45 ? '#fbbf24' : '#f87171' }}
                                                        />
                                                    </div>
                                                    <span className="text-sm font-bold min-w-[60px] text-right" style={{
                                                        color: data.accuracy_pct >= 60 ? '#4ade80' : data.accuracy_pct >= 45 ? '#fbbf24' : '#f87171'
                                                    }}>
                                                        {data.accuracy_pct}%
                                                    </span>
                                                    <span className="text-xs min-w-[40px] text-right" style={{ color: 'var(--text-muted)' }}>
                                                        {data.hits}/{data.total}
                                                    </span>
                                                </div>
                                            ))}
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Daily Trend */}
                        {stats && Object.keys(stats.by_date).length > 0 && userTier !== 'free' && (
                            <div className="glass-card p-6">
                                <h3 className="text-lg font-bold mb-4" style={{ color: 'var(--text-primary)' }}>
                                    📅 일별 적중 추이
                                </h3>
                                <div className="grid grid-cols-7 gap-2">
                                    {Object.entries(stats.by_date).slice(-14).map(([date, data]) => (
                                        <div key={date} className="text-center p-2 rounded-lg" style={{ background: 'var(--bg-elevated)' }}>
                                            <p className="text-[10px] mb-1" style={{ color: 'var(--text-muted)' }}>
                                                {date.slice(5)}
                                            </p>
                                            <p className="text-sm font-bold" style={{
                                                color: data.accuracy_pct >= 60 ? '#4ade80' : data.accuracy_pct >= 45 ? '#fbbf24' : '#f87171'
                                            }}>
                                                {data.accuracy_pct}%
                                            </p>
                                            <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
                                                {data.hits}/{data.total}
                                            </p>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                ) : (
                    /* History Tab */
                    <div className="space-y-3">
                        {records.length === 0 ? (
                            <div className="glass-card p-12 text-center">
                                <p className="text-3xl mb-3">📋</p>
                                <p className="font-semibold" style={{ color: 'var(--text-primary)' }}>예측 이력이 없습니다</p>
                                <p className="text-sm mt-2" style={{ color: 'var(--text-muted)' }}>
                                    AI 분석이 생성되면 자동으로 이력이 저장됩니다
                                </p>
                            </div>
                        ) : (
                            records.map((rec, i) => {
                                const badge = getStatusBadge(rec.status);
                                // Free users see only last 5 + blur
                                if (userTier === 'free' && i >= 5) {
                                    if (i === 5) {
                                        return (
                                            <div key="upgrade-cta" className="glass-card p-8 text-center">
                                                <p className="text-3xl mb-3">🔒</p>
                                                <p className="font-semibold" style={{ color: 'var(--text-primary)' }}>
                                                    전체 이력은 Pro에서 확인 가능
                                                </p>
                                                <a href="/pricing" className="btn-primary mt-4 inline-block px-6 py-2 text-sm">
                                                    Pro 업그레이드
                                                </a>
                                            </div>
                                        );
                                    }
                                    return null;
                                }

                                return (
                                    <div key={rec.id} className="glass-card p-4 flex items-center justify-between gap-4">
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 mb-1">
                                                <span className="text-xs px-2 py-0.5 rounded" style={{ background: 'var(--bg-elevated)', color: 'var(--text-muted)' }}>
                                                    {LEAGUE_LABELS[rec.league] || rec.league}
                                                </span>
                                                <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                                                    {rec.prediction_date}
                                                </span>
                                            </div>
                                            <p className="font-semibold text-sm truncate" style={{ color: 'var(--text-primary)' }}>
                                                {rec.team_home} vs {rec.team_away}
                                            </p>
                                            <div className="flex items-center gap-3 mt-1">
                                                <span className="text-xs" style={{ color: 'var(--accent-primary)' }}>
                                                    AI → {getResultLabel(rec.recommendation)} ({rec.confidence}%)
                                                </span>
                                                {rec.actual_result && (
                                                    <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                                                        결과: {getResultLabel(rec.actual_result)} ({rec.home_score}-{rec.away_score})
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                        <span
                                            className="px-3 py-1 rounded-lg text-xs font-bold whitespace-nowrap"
                                            style={{ background: badge.bg, color: badge.color }}
                                        >
                                            {badge.label}
                                        </span>
                                    </div>
                                );
                            })
                        )}
                    </div>
                )}
            </main>
        </div>
    );
}
