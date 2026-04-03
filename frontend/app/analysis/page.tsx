
"use client";
import React, { useEffect, useState, useMemo } from 'react';
import DeadlineBanner from '../components/DeadlineBanner';
import Navbar from '../components/Navbar';
import PremiumGate from '../components/PremiumGate';
import AiAnalystWidget from '../components/AiAnalystWidget';

/* ───── Types ───── */
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

/* ───── Helpers ───── */
const formatTime = (iso: string) => {
    if (!iso) return '';
    try {
        const d = new Date(iso);
        if (isNaN(d.getTime())) return '';
        return d.toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false });
    } catch { return ''; }
};

const getConfidenceLevel = (confidence: number) => {
    if (confidence >= 85) return { label: '강력 추천', color: '#ef4444', bg: 'rgba(239,68,68,0.15)', glow: 'rgba(239,68,68,0.4)', icon: '🔴' };
    if (confidence >= 70) return { label: '추천', color: '#10b981', bg: 'rgba(16,185,129,0.12)', glow: 'rgba(16,185,129,0.3)', icon: '🟢' };
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
            <circle cx={cx} cy={cy} r={r} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="8" />
            <circle cx={cx} cy={cy} r={r} fill="none" stroke="#3b82f6" strokeWidth="8"
                strokeDasharray={`${homeArc} ${circumference - homeArc}`} strokeDashoffset="0"
                style={{ transition: 'stroke-dasharray 1s ease-out' }} />
            <circle cx={cx} cy={cy} r={r} fill="none" stroke="#a855f7" strokeWidth="8"
                strokeDasharray={`${drawArc} ${circumference - drawArc}`} strokeDashoffset={`${-homeArc}`}
                style={{ transition: 'stroke-dasharray 1s ease-out' }} />
            <circle cx={cx} cy={cy} r={r} fill="none" stroke="#f97316" strokeWidth="8"
                strokeDasharray={`${awayArc} ${circumference - awayArc}`} strokeDashoffset={`${-(homeArc + drawArc)}`}
                style={{ transition: 'stroke-dasharray 1s ease-out' }} />
        </svg>
    );
}

/* Confidence gauge bar */
function ConfidenceGauge({ value }: { value: number }) {
    const level = getConfidenceLevel(value);
    return (
        <div className="w-full">
            <div className="flex justify-between items-center mb-1">
                <span className="text-[10px] text-white/40 uppercase tracking-wider">신뢰도</span>
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

/* Radar Chart for AI Factors */
function FactorRadar({ factors }: { factors: { name: string; weight: number; score: number }[] }) {
    const topFactors = factors.slice(0, 6);
    const size = 200;
    const cx = size / 2;
    const cy = size / 2;
    const maxR = 70;
    const levels = 4;

    const angleStep = (2 * Math.PI) / topFactors.length;

    const getPoint = (idx: number, val: number) => {
        const angle = angleStep * idx - Math.PI / 2;
        const r = (val / 100) * maxR;
        return { x: cx + r * Math.cos(angle), y: cy + r * Math.sin(angle) };
    };

    const gridLines = Array.from({ length: levels }, (_, i) => {
        const r = (maxR / levels) * (i + 1);
        const points = topFactors.map((_, idx) => {
            const angle = angleStep * idx - Math.PI / 2;
            return `${cx + r * Math.cos(angle)},${cy + r * Math.sin(angle)}`;
        }).join(' ');
        return <polygon key={i} points={points} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="1" />;
    });

    const dataPoints = topFactors.map((f, idx) => getPoint(idx, f.score || f.weight * 10));
    const dataPath = dataPoints.map(p => `${p.x},${p.y}`).join(' ');

    return (
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
            {/* Grid */}
            {gridLines}
            {/* Axis lines */}
            {topFactors.map((_, idx) => {
                const p = getPoint(idx, 100);
                return <line key={idx} x1={cx} y1={cy} x2={p.x} y2={p.y} stroke="rgba(255,255,255,0.06)" strokeWidth="1" />;
            })}
            {/* Data polygon */}
            <polygon points={dataPath} fill="rgba(0,212,255,0.15)" stroke="#00d4ff" strokeWidth="2" />
            {/* Data points */}
            {dataPoints.map((p, idx) => (
                <circle key={idx} cx={p.x} cy={p.y} r="3" fill="#00d4ff" />
            ))}
            {/* Labels */}
            {topFactors.map((f, idx) => {
                const p = getPoint(idx, 120);
                return (
                    <text key={idx} x={p.x} y={p.y}
                        textAnchor="middle" dominantBaseline="middle"
                        fill="rgba(255,255,255,0.5)" fontSize="9" fontWeight="bold">
                        {f.name.length > 6 ? f.name.slice(0, 6) + '..' : f.name}
                    </text>
                );
            })}
        </svg>
    );
}

/* ───── Filter Tabs ───── */
type FilterType = 'all' | 'strong' | 'recommended' | 'neutral';

/* ───── Main Component ───── */
export default function AnalysisPage() {
    const [aiPredictions, setAiPredictions] = useState<AIPrediction[]>([]);
    const [dataSources, setDataSources] = useState<string[]>([]);
    const [loading, setLoading] = useState(true);
    const [expandedCard, setExpandedCard] = useState<string | null>(null);
    const [filter, setFilter] = useState<FilterType>('all');
    const [sortBy, setSortBy] = useState<'confidence' | 'time'>('confidence');
    const [selectedSport, setSelectedSport] = useState<string>('ALL');
    const [fetchError, setFetchError] = useState(false);

    const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || '';

    /* Fetch AI predictions with timeout */
    const fetchAIPredictions = async () => {
        setLoading(true);
        setFetchError(false);
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 15000); // 15초 타임아웃
        try {
            const res = await fetch(`${API_BASE_URL}/api/ai/predictions`, { signal: controller.signal });
            clearTimeout(timeout);
            if (!res.ok) throw new Error('Failed to fetch AI predictions');
            const data: AIResponse = await res.json();
            setAiPredictions(data.predictions || []);
            setDataSources(data.data_sources || []);
        } catch (err: unknown) {
            console.warn('AI predictions unavailable:', err instanceof Error ? err.message : err);
            setFetchError(true);
        }
        finally { clearTimeout(timeout); setLoading(false); }
    };

    useEffect(() => { fetchAIPredictions(); }, []);

    /* ── Sport filter tabs (same as Market page) ── */
    const sportTabs = useMemo(() => {
        const iconMap: Record<string, string> = { SOCCER: '⚽', BASKETBALL: '🏀', BASEBALL: '⚾', ICEHOCKEY: '🏒' };
        const labelMap: Record<string, string> = { SOCCER: '축구', BASKETBALL: '농구', BASEBALL: '야구', ICEHOCKEY: '하키' };
        const counts: Record<string, number> = {};
        aiPredictions.forEach(p => {
            const key = (p.sport || 'SOCCER').toUpperCase();
            counts[key] = (counts[key] || 0) + 1;
        });
        return ['SOCCER', 'BASKETBALL', 'BASEBALL', 'ICEHOCKEY']
            .map(s => ({ key: s, icon: iconMap[s] || '🏟️', label: labelMap[s] || s, count: counts[s] || 0 }));
    }, [aiPredictions]);

    /* Sport-filtered predictions */
    const sportFiltered = useMemo(() => {
        if (selectedSport === 'ALL') return aiPredictions;
        return aiPredictions.filter(p => (p.sport || 'soccer').toUpperCase() === selectedSport);
    }, [aiPredictions, selectedSport]);

    /* Stats (based on sport-filtered) */
    const totalMatches = sportFiltered.length;
    const strongPicks = sportFiltered.filter(p => p.confidence >= 85).length;
    const recommendedPicks = sportFiltered.filter(p => p.confidence >= 70 && p.confidence < 85).length;
    const avgConfidence = totalMatches > 0 ? sportFiltered.reduce((s, p) => s + p.confidence, 0) / totalMatches : 0;
    const isMLEngine = dataSources.some(s => s.includes('LightGBM'));

    /* Animated stats */
    const animatedTotal = useCountUp(totalMatches);
    const animatedStrong = useCountUp(strongPicks);
    const animatedRecommended = useCountUp(recommendedPicks);
    const animatedAvg = useCountUp(Math.round(avgConfidence));

    /* Filtered & sorted predictions (sport + confidence filter) */
    const filteredPredictions = useMemo(() => {
        let filtered = [...sportFiltered];
        if (filter === 'strong') filtered = filtered.filter(p => p.confidence >= 85);
        else if (filter === 'recommended') filtered = filtered.filter(p => p.confidence >= 70 && p.confidence < 85);
        else if (filter === 'neutral') filtered = filtered.filter(p => p.confidence < 70);

        if (sortBy === 'confidence') filtered.sort((a, b) => b.confidence - a.confidence);
        else if (sortBy === 'time') filtered.sort((a, b) => new Date(a.match_time || '').getTime() - new Date(b.match_time || '').getTime());

        return filtered;
    }, [sportFiltered, filter, sortBy]);

    /* Top AI picks — sorted by confidence (from sport-filtered) */
    const topPicks = useMemo(() => {
        return [...sportFiltered]
            .filter(p => p.confidence >= 60)
            .sort((a, b) => b.confidence - a.confidence)
            .slice(0, 3);
    }, [sportFiltered]);

    const filterTabs: { key: FilterType; label: string; count: number }[] = [
        { key: 'all', label: '전체', count: totalMatches },
        { key: 'strong', label: '🔴 강력 추천', count: strongPicks },
        { key: 'recommended', label: '🟢 추천', count: recommendedPicks },
        { key: 'neutral', label: '기타', count: totalMatches - strongPicks - recommendedPicks },
    ];

    return (
        <div className="min-h-screen flex flex-col" style={{ background: 'var(--bg-primary)' }}>
            <DeadlineBanner />
            <Navbar />

            <main className="flex-grow w-full relative z-10">
                {/* ━━━ HERO SECTION ━━━ */}
                <section className="relative overflow-hidden">
                    <div className="absolute inset-0 pointer-events-none">
                        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[500px]"
                            style={{ background: 'radial-gradient(ellipse 80% 60% at 50% 0%, rgba(139,92,246,0.15) 0%, transparent 60%)' }} />
                        <div className="absolute top-20 right-0 w-[400px] h-[400px]"
                            style={{ background: 'radial-gradient(circle at center, rgba(0,212,255,0.08) 0%, transparent 60%)' }} />
                    </div>

                    <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-12 pb-8">
                        <div className="text-center">
                            {/* Engine badge */}
                            <div className="inline-flex items-center px-4 py-1.5 rounded-full border border-[rgba(139,92,246,0.3)] bg-[rgba(139,92,246,0.06)] text-xs mb-6 animate-fade-up">
                                <span className="w-1.5 h-1.5 rounded-full bg-[#8b5cf6] mr-2 animate-pulse" />
                                <span style={{ color: '#8b5cf6' }}>
                                    {isMLEngine ? '● LightGBM ML 엔진 가동 중' : '● 6-팩터 분석 엔진 가동 중'}
                                </span>
                            </div>

                            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black text-white leading-tight mb-4 animate-fade-up" style={{ animationDelay: '80ms' }}>
                                AI 경기 분석<br />
                                <span className="gradient-text-glow">딥 인사이트</span>
                            </h1>

                            <p className="text-sm sm:text-base text-[var(--text-secondary)] max-w-xl mx-auto mb-8 animate-fade-up" style={{ animationDelay: '160ms' }}>
                                LightGBM 머신러닝 모델이 28개 특성을 분석하여<br className="hidden sm:block" />
                                각 경기별 실시간 승률과 AI 추천을 제공합니다
                            </p>

                            {/* Quick stats */}
                            <div className="grid grid-cols-4 gap-3 max-w-2xl mx-auto animate-fade-up" style={{ animationDelay: '240ms' }}>
                                <div className="gradient-border-card p-4 text-center">
                                    <div className="text-2xl font-black gradient-text">{animatedTotal}</div>
                                    <div className="text-[10px] text-[var(--text-muted)] mt-1">경기</div>
                                </div>
                                <div className="gradient-border-card p-4 text-center">
                                    <div className="text-2xl font-black" style={{ color: '#ef4444' }}>{animatedStrong}</div>
                                    <div className="text-[10px] text-[var(--text-muted)] mt-1">강력 추천</div>
                                </div>
                                <div className="gradient-border-card p-4 text-center">
                                    <div className="text-2xl font-black" style={{ color: '#10b981' }}>{animatedRecommended}</div>
                                    <div className="text-[10px] text-[var(--text-muted)] mt-1">추천</div>
                                </div>
                                <div className="gradient-border-card p-4 text-center">
                                    <div className="text-2xl font-black" style={{ color: '#00d4ff' }}>{animatedAvg}%</div>
                                    <div className="text-[10px] text-[var(--text-muted)] mt-1">평균 신뢰도</div>
                                </div>
                            </div>
                        </div>
                    </div>
                </section>

                <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 pb-10">

                    {/* ━━━ SPORT FILTER TABS ━━━ */}
                    <div className="flex flex-wrap items-center gap-2 mb-6">
                        <button
                            onClick={() => { setSelectedSport('ALL'); setFilter('all'); }}
                            className={`px-3 py-1.5 text-xs font-bold rounded-full transition-all flex items-center gap-1.5 ${selectedSport === 'ALL' ? 'text-white shadow-md shadow-cyan-500/20' : 'border border-white/10 hover:border-white/20'}`}
                            style={selectedSport === 'ALL' ? { background: 'var(--accent-primary)' } : { background: 'var(--bg-card)', color: 'var(--text-secondary)' }}
                        >
                            🏆 전체 <span className="ml-0.5 opacity-70">{aiPredictions.length}</span>
                        </button>
                        {sportTabs.map(tab => (
                            <button
                                key={tab.key}
                                onClick={() => { setSelectedSport(tab.key); setFilter('all'); }}
                                className={`px-3 py-1.5 text-xs font-bold rounded-full transition-all flex items-center gap-1.5 ${selectedSport === tab.key ? 'text-white shadow-md shadow-cyan-500/20' : 'border border-white/10 hover:border-white/20'} ${tab.count === 0 ? 'opacity-50' : ''}`}
                                style={selectedSport === tab.key ? { background: 'var(--accent-primary)' } : { background: 'var(--bg-card)', color: 'var(--text-secondary)' }}
                            >
                                {tab.icon} {tab.label} {tab.count > 0
                                    ? <span className="ml-0.5 opacity-70">{tab.count}</span>
                                    : <span className="ml-0.5 text-[9px] px-1 py-0.5 rounded bg-white/5" style={{ color: 'var(--text-muted)' }}>OFF</span>
                                }
                            </button>
                        ))}
                        <button onClick={fetchAIPredictions}
                            className="px-3 py-1.5 text-xs rounded-full flex items-center ml-1 border border-white/10 hover:border-white/20 transition"
                            style={{ background: 'var(--bg-card)', color: 'var(--text-secondary)' }}
                        >
                            {loading ? '분석 중...' : '🔄 새로고침'}
                        </button>
                    </div>

                    {/* ━━━ Error / Empty state ━━━ */}
                    {fetchError && !loading && aiPredictions.length === 0 && (
                        <div className="mb-8 text-center p-8 rounded-2xl" style={{ background: 'var(--bg-card)', border: '1px solid rgba(255,255,255,0.06)' }}>
                            <div className="text-4xl mb-3">⚡</div>
                            <h3 className="text-lg font-bold text-white mb-2">AI 분석 엔진 준비 중</h3>
                            <p className="text-sm text-[var(--text-muted)] mb-4">
                                서버가 데이터를 수집하고 있습니다. 잠시 후 다시 시도해주세요.
                            </p>
                            <button onClick={fetchAIPredictions}
                                className="px-6 py-2.5 rounded-xl text-sm font-bold transition hover:scale-105"
                                style={{ background: 'linear-gradient(135deg, #00d4ff, #8b5cf6)', color: 'white' }}>
                                🔄 다시 불러오기
                            </button>
                        </div>
                    )}

                    {/* ━━━ TOP PICKS ━━━ */}
                    {topPicks.length > 0 && (
                        <div className="mb-8">
                            <h2 className="text-sm font-bold text-white/60 uppercase tracking-wider mb-4 flex items-center">
                                <span className="w-1 h-5 rounded-full mr-2" style={{ background: 'linear-gradient(to bottom, #ef4444, #f97316)' }} />
                                🔥 오늘의 AI TOP PICK
                            </h2>
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                {topPicks.map((pick, i) => {
                                    const level = getConfidenceLevel(pick.confidence);
                                    const parts = pick.match_id.split('_');
                                    const home = pick.team_home || parts[0] || '';
                                    const away = pick.team_away || parts.slice(1).join(' ') || '';
                                    return (
                                        <div key={i} className="relative overflow-hidden rounded-2xl transition-all hover:scale-[1.02] cursor-pointer group"
                                            style={{
                                                background: 'var(--bg-card)',
                                                border: `1px solid ${level.color}33`,
                                                boxShadow: i === 0 ? `0 0 30px ${level.glow}` : 'none',
                                            }}>
                                            {i === 0 && (
                                                <div className="absolute top-0 right-0 px-3 py-1 rounded-bl-xl text-[10px] font-black"
                                                    style={{ background: level.color, color: 'white' }}>
                                                    #1 PICK
                                                </div>
                                            )}
                                            {i === 1 && (
                                                <div className="absolute top-0 right-0 px-3 py-1 rounded-bl-xl text-[10px] font-black"
                                                    style={{ background: `${level.color}88`, color: 'white' }}>
                                                    #2 PICK
                                                </div>
                                            )}
                                            {i === 2 && (
                                                <div className="absolute top-0 right-0 px-3 py-1 rounded-bl-xl text-[10px] font-black"
                                                    style={{ background: `${level.color}66`, color: 'white' }}>
                                                    #3 PICK
                                                </div>
                                            )}
                                            <div className="p-4">
                                                <div className="flex items-start justify-between mb-3">
                                                    <div className="flex-1">
                                                        <div className="text-[10px] text-white/30 mb-1">{pick.league || ''}</div>
                                                        <div className="text-sm font-bold text-white">{home}</div>
                                                        <div className="text-xs text-white/40">vs {away}</div>
                                                        {pick.match_time && (
                                                            <div className="text-[10px] text-white/20 mt-1">⏰ {formatTime(pick.match_time)}</div>
                                                        )}
                                                    </div>
                                                    <div className="flex flex-col items-center">
                                                        <ProbDonut home={pick.home_win_prob} draw={pick.draw_prob} away={pick.away_win_prob} size={64} />
                                                    </div>
                                                </div>
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

                    {/* ━━━ FILTER & SORT ━━━ */}
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-5">
                        <div className="flex items-center gap-2 flex-wrap">
                            {filterTabs.map(tab => (
                                <button
                                    key={tab.key}
                                    onClick={() => setFilter(tab.key)}
                                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${filter === tab.key ? 'text-white' : 'text-white/30 hover:text-white/50'}`}
                                    style={filter === tab.key ? { background: 'rgba(0,212,255,0.12)', color: '#00d4ff', border: '1px solid rgba(0,212,255,0.2)' } : { background: 'rgba(255,255,255,0.03)', border: '1px solid transparent' }}
                                >
                                    {tab.label} <span className="ml-1 opacity-60">{tab.count}</span>
                                </button>
                            ))}
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="text-[10px] text-white/30">정렬:</span>
                            <button
                                onClick={() => setSortBy('confidence')}
                                className={`text-[11px] px-2.5 py-1 rounded-lg font-bold transition-all ${sortBy === 'confidence' ? 'text-[#00d4ff] bg-[rgba(0,212,255,0.1)]' : 'text-white/30 hover:text-white/50'}`}
                            >
                                신뢰도순
                            </button>
                            <button
                                onClick={() => setSortBy('time')}
                                className={`text-[11px] px-2.5 py-1 rounded-lg font-bold transition-all ${sortBy === 'time' ? 'text-[#00d4ff] bg-[rgba(0,212,255,0.1)]' : 'text-white/30 hover:text-white/50'}`}
                            >
                                시간순
                            </button>
                            <button onClick={fetchAIPredictions}
                                className="text-xs px-3 py-1.5 rounded-xl font-bold transition-all hover:scale-105 ml-2"
                                style={{ background: 'rgba(0,212,255,0.1)', color: '#00d4ff', border: '1px solid rgba(0,212,255,0.2)' }}>
                                {loading ? '분석 중...' : '🔄 새로고침'}
                            </button>
                        </div>
                    </div>

                    {/* ━━━ AI PREDICTION CARDS ━━━ */}
                    {loading && aiPredictions.length === 0 ? (
                        <div className="py-20 text-center text-white/40">
                            <div className="animate-spin inline-block w-10 h-10 border-2 border-white/10 border-t-[var(--accent-primary)] rounded-full mb-4" />
                            <p className="text-sm">AI 예측 분석 진행 중...</p>
                            <p className="text-[10px] text-white/20 mt-1">LightGBM 모델이 각 경기를 분석하고 있습니다</p>
                        </div>
                    ) : filteredPredictions.length === 0 ? (
                        <div className="py-20 text-center text-white/30 rounded-2xl" style={{ background: 'var(--bg-card)' }}>
                            <div className="text-4xl mb-3">🧠</div>
                            <p>분석 가능한 경기가 없습니다</p>
                            <p className="text-xs text-white/20 mt-1">경기 데이터가 도착하면 AI 예측이 자동으로 시작됩니다</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {filteredPredictions.map((pred, idx) => {
                                const level = getConfidenceLevel(pred.confidence);
                                const parts = pred.match_id.split('_');
                                const home = pred.team_home || parts[0] || '';
                                const away = pred.team_away || parts.slice(1).join(' ') || '';
                                const matchKey = `analysis-${idx}`;
                                const isExpanded = expandedCard === matchKey;

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
                                                <div className="flex items-center space-x-2">
                                                    {pred.engine && (
                                                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded"
                                                            style={{ background: 'rgba(139,92,246,0.1)', color: '#8b5cf6' }}>
                                                            {pred.engine}
                                                        </span>
                                                    )}
                                                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                                                        style={{ background: level.bg, color: level.color }}>
                                                        {level.icon} {level.label}
                                                    </span>
                                                </div>
                                            </div>

                                            {/* Teams */}
                                            <div className="flex items-center justify-between mt-2">
                                                <div className="flex-1">
                                                    <div className={`text-base font-bold ${pred.recommendation === 'HOME' ? 'text-white' : 'text-white/60'}`}>
                                                        {home}
                                                        {pred.recommendation === 'HOME' && (
                                                            <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded" style={{ background: level.bg, color: level.color }}>추천</span>
                                                        )}
                                                    </div>
                                                    <div className={`text-sm mt-0.5 ${pred.recommendation === 'AWAY' ? 'text-white font-bold' : 'text-white/40'}`}>
                                                        vs {away}
                                                        {pred.recommendation === 'AWAY' && (
                                                            <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded" style={{ background: level.bg, color: level.color }}>추천</span>
                                                        )}
                                                    </div>
                                                    {pred.recommendation === 'DRAW' && (
                                                        <div className="text-[10px] mt-1 px-1.5 py-0.5 rounded inline-block" style={{ background: level.bg, color: level.color }}>무승부 추천</div>
                                                    )}
                                                </div>
                                                <ProbDonut home={pred.home_win_prob} draw={pred.draw_prob} away={pred.away_win_prob} size={72} />
                                            </div>
                                        </div>

                                        {/* Probability bars */}
                                        <div className="px-4 py-3">
                                            <div className="space-y-2">
                                                <div className="flex items-center space-x-3">
                                                    <span className="text-[10px] font-bold text-blue-400 w-6 text-right">H</span>
                                                    <div className="flex-1 h-2.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.05)' }}>
                                                        <div className="h-full rounded-full bg-blue-500"
                                                            style={{ width: `${pred.home_win_prob}%`, transition: 'width 1s ease-out', boxShadow: pred.recommendation === 'HOME' ? '0 0 8px rgba(59,130,246,0.5)' : 'none' }} />
                                                    </div>
                                                    <span className={`text-xs font-bold w-10 text-right ${pred.recommendation === 'HOME' ? 'text-blue-400' : 'text-white/40'}`}>
                                                        {pred.home_win_prob.toFixed(1)}%
                                                    </span>
                                                </div>
                                                <div className="flex items-center space-x-3">
                                                    <span className="text-[10px] font-bold text-purple-400 w-6 text-right">D</span>
                                                    <div className="flex-1 h-2.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.05)' }}>
                                                        <div className="h-full rounded-full bg-purple-500"
                                                            style={{ width: `${pred.draw_prob}%`, transition: 'width 1s ease-out', boxShadow: pred.recommendation === 'DRAW' ? '0 0 8px rgba(168,85,247,0.5)' : 'none' }} />
                                                    </div>
                                                    <span className={`text-xs font-bold w-10 text-right ${pred.recommendation === 'DRAW' ? 'text-purple-400' : 'text-white/40'}`}>
                                                        {pred.draw_prob.toFixed(1)}%
                                                    </span>
                                                </div>
                                                <div className="flex items-center space-x-3">
                                                    <span className="text-[10px] font-bold text-orange-400 w-6 text-right">A</span>
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

                                        {/* Confidence + action row */}
                                        <div className="px-4 pb-3">
                                            <ConfidenceGauge value={pred.confidence} />
                                            <div className="flex items-center justify-between mt-3">
                                                <div className="flex items-center space-x-2">
                                                    <span className="text-xs font-black px-2.5 py-1 rounded-lg"
                                                        style={{ background: level.bg, color: level.color }}>
                                                        {getRecommendationKo(pred.recommendation)}
                                                    </span>
                                                </div>
                                                <button
                                                    onClick={() => setExpandedCard(isExpanded ? null : matchKey)}
                                                    className="text-[10px] font-bold px-3 py-1.5 rounded-lg transition-all"
                                                    style={{ background: isExpanded ? 'rgba(0,212,255,0.12)' : 'rgba(255,255,255,0.04)', color: isExpanded ? '#00d4ff' : 'rgba(255,255,255,0.4)' }}>
                                                    {isExpanded ? '접기 ▲' : '상세보기 ▼'}
                                                </button>
                                            </div>
                                        </div>

                                        {/* Expandable detail panel */}
                                        {isExpanded && (
                                            <PremiumGate featureName="AI Prediction Details" requiredTier="pro">
                                                <div className="px-4 pb-4 pt-3" style={{ background: 'var(--bg-elevated)', borderTop: '1px solid var(--border-subtle)' }}>

                                                    {/* Radar chart + factors side by side */}
                                                    {pred.factors && pred.factors.length > 0 && (
                                                        <div className="flex flex-col sm:flex-row items-start gap-4 mb-4">
                                                            {/* Radar */}
                                                            <div className="flex-shrink-0 mx-auto sm:mx-0">
                                                                <FactorRadar factors={pred.factors} />
                                                            </div>
                                                            {/* Factor list */}
                                                            <div className="flex-1 w-full">
                                                                <div className="text-[10px] text-white/30 font-bold uppercase tracking-wider mb-2">AI 분석 팩터</div>
                                                                <div className="space-y-2">
                                                                    {pred.factors.slice(0, 6).map((f, fi) => (
                                                                        <div key={fi}>
                                                                            <div className="flex items-center justify-between mb-0.5">
                                                                                <div className="flex items-center space-x-2">
                                                                                    <span className="text-[10px] font-bold text-white/50 w-5">#{fi + 1}</span>
                                                                                    <span className="text-xs text-white/70">{f.name}</span>
                                                                                </div>
                                                                                <span className="text-[10px] text-white/40">{f.score || Math.round(f.weight * 100)}%</span>
                                                                            </div>
                                                                            <div className="w-full h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.05)' }}>
                                                                                <div className="h-full rounded-full" style={{
                                                                                    width: `${Math.min(Math.abs(f.score || f.weight * 10), 100)}%`,
                                                                                    background: 'var(--accent-gradient)',
                                                                                    transition: 'width 0.8s ease-out',
                                                                                }} />
                                                                            </div>
                                                                            {f.detail && (
                                                                                <div className="text-[9px] text-white/25 mt-0.5 pl-7">{f.detail}</div>
                                                                            )}
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    )}

                                                    {/* Probability breakdown table */}
                                                    <div className="rounded-xl overflow-hidden" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-subtle)' }}>
                                                        <div className="text-[10px] text-white/30 font-bold uppercase tracking-wider px-3 py-2" style={{ borderBottom: '1px solid var(--border-subtle)' }}>확률 상세</div>
                                                        <div className="grid grid-cols-3 text-center">
                                                            <div className="p-3 border-r border-[var(--border-subtle)]">
                                                                <div className="text-[10px] text-blue-400 mb-1">홈 승</div>
                                                                <div className="text-lg font-black text-blue-400">{pred.home_win_prob.toFixed(1)}%</div>
                                                            </div>
                                                            <div className="p-3 border-r border-[var(--border-subtle)]">
                                                                <div className="text-[10px] text-purple-400 mb-1">무승부</div>
                                                                <div className="text-lg font-black text-purple-400">{pred.draw_prob.toFixed(1)}%</div>
                                                            </div>
                                                            <div className="p-3">
                                                                <div className="text-[10px] text-orange-400 mb-1">원정 승</div>
                                                                <div className="text-lg font-black text-orange-400">{pred.away_win_prob.toFixed(1)}%</div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            </PremiumGate>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )}

                    {/* ━━━ INSIGHTS CTA ━━━ */}
                    <div className="mt-8 mb-4 rounded-2xl overflow-hidden cursor-pointer group transition-all hover:scale-[1.01]"
                        onClick={() => window.location.href = '/ko/analysis/insights'}
                        style={{
                            background: 'linear-gradient(135deg, rgba(0,212,255,0.08) 0%, rgba(139,92,246,0.08) 100%)',
                            border: '1px solid rgba(0,212,255,0.15)',
                        }}>
                        <div className="p-5 flex items-center justify-between">
                            <div>
                                <div className="flex items-center space-x-2 mb-1">
                                    <span className="text-xs font-black px-2 py-0.5 rounded-full" style={{ background: 'rgba(0,212,255,0.12)', color: '#00d4ff' }}>NEW</span>
                                    <span className="text-sm font-bold text-white">📈 AI 성과 백테스트 인사이트</span>
                                </div>
                                <p className="text-xs text-white/40 mt-1">과거 데이터에 AI 모델을 소급 적용 — 리그별 적중률, 약점 패턴, 주간 트렌드를 확인하세요</p>
                            </div>
                            <div className="text-white/30 group-hover:text-white/60 transition-colors text-lg">→</div>
                        </div>
                    </div>

                    {/* Data source info */}
                    <div className="mt-6 flex flex-col sm:flex-row items-center justify-between gap-2 text-[10px] text-white/20 px-2">
                        <div className="flex items-center space-x-2">
                            <span>📚 8,960+ 경기 학습 완료</span>
                            <span className="w-1 h-1 rounded-full bg-white/20" />
                            <span>매일 03:00 재학습</span>
                            <span className="w-1 h-1 rounded-full bg-white/20" />
                            <span>데이터: {dataSources.join(' · ') || '로딩 중...'}</span>
                        </div>
                        <div>AI 예측은 과거 데이터에 기반하며, 예측 결과를 보장하지 않습니다</div>
                    </div>
                </div>
            </main>

            <AiAnalystWidget />
        </div>
    );
}
