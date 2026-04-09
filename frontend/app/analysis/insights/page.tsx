
"use client";
import React, { useEffect, useState, useMemo } from 'react';
import Navbar from '../../components/Navbar';
import DeadlineBanner from '../../components/DeadlineBanner';
import PremiumGate from '../../components/PremiumGate';
import AiAnalystWidget from '../../components/AiAnalystWidget';

/* ───── Types ───── */
interface OverallAccuracy {
    total_predictions: number;
    correct_count: number;
    incorrect_count: number;
    accuracy_pct: number;
    avg_confidence: number;
    avg_log_loss: number;
    avg_confidence_when_correct: number;
    avg_confidence_when_wrong: number;
    model_version: string;
}

interface LeagueAccuracy {
    league: string;
    matches: number;
    correct: number;
    accuracy_pct: number;
    avg_confidence: number;
    avg_log_loss: number;
}

interface OddsRangeAccuracy {
    odds_range: string;
    matches: number;
    correct: number;
    accuracy_pct: number;
    avg_confidence: number;
}

interface ConfidenceAccuracy {
    confidence_tier: string;
    matches: number;
    correct: number;
    accuracy_pct: number;
    avg_confidence: number;
}

interface TrendPoint {
    week_start: string;
    total: number;
    correct: number;
    accuracy_pct: number;
    avg_log_loss: number;
    avg_confidence: number;
}

interface MissPattern {
    predicted: string;
    actual: string;
    miss_count: number;
    avg_confidence_when_wrong: number;
}

interface WeakPatterns {
    by_recommendation: { recommendation: string; total: number; correct: number; accuracy_pct: number }[];
    miss_patterns: MissPattern[];
    overconfident_misses: any[];
    analysis_summary: string;
}

interface StrongPatterns {
    max_streak: number;
    high_confidence_hits: any[];
    total_high_confidence_hits: number;
}

interface InsightsData {
    overall: OverallAccuracy;
    by_league: LeagueAccuracy[];
    by_odds_range: OddsRangeAccuracy[];
    by_confidence: ConfidenceAccuracy[];
    weak_patterns: WeakPatterns;
    strong_patterns: StrongPatterns;
    trend: TrendPoint[];
    draw_analysis: any[];
    home_away_bias: any[];
}

/* ───── Helpers ───── */
const LEAGUE_NAMES: Record<string, string> = {
    soccer_epl: '🏴󠁧󠁢󠁥󠁮󠁧󠁿 EPL',
    soccer_spain_la_liga: '🇪🇸 라리가',
    soccer_germany_bundesliga: '🇩🇪 분데스리가',
    soccer_italy_serie_a: '🇮🇹 세리에A',
    soccer_france_ligue_one: '🇫🇷 리그1',
    soccer_uefa_champs_league: '🏆 UCL',
    soccer_korea_kleague1: '🇰🇷 K리그1',
};

const REC_LABELS: Record<string, string> = { HOME: '홈 승', DRAW: '무승부', AWAY: '원정 승' };

function useCountUp(end: number, duration = 1200) {
    const [value, setValue] = useState(0);
    useEffect(() => {
        const startTime = performance.now();
        const animate = (now: number) => {
            const elapsed = now - startTime;
            const progress = Math.min(elapsed / duration, 1);
            const eased = 1 - Math.pow(1 - progress, 3);
            setValue(Math.round(eased * end * 10) / 10);
            if (progress < 1) requestAnimationFrame(animate);
        };
        requestAnimationFrame(animate);
    }, [end, duration]);
    return value;
}

/* ───── SVG Mini Chart: Accuracy Trend Line ───── */
function TrendLineChart({ data }: { data: TrendPoint[] }) {
    if (!data || data.length < 2) return <div className="text-xs text-white/20 text-center py-8">데이터 수집 중...</div>;

    const width = 600;
    const height = 200;
    const padding = { top: 20, right: 30, bottom: 30, left: 40 };
    const chartW = width - padding.left - padding.right;
    const chartH = height - padding.top - padding.bottom;

    const minAcc = Math.max(0, Math.min(...data.map(d => d.accuracy_pct)) - 10);
    const maxAcc = Math.min(100, Math.max(...data.map(d => d.accuracy_pct)) + 10);

    const xScale = (i: number) => padding.left + (i / (data.length - 1)) * chartW;
    const yScale = (v: number) => padding.top + chartH - ((v - minAcc) / (maxAcc - minAcc)) * chartH;

    const linePath = data.map((d, i) => `${i === 0 ? 'M' : 'L'} ${xScale(i)} ${yScale(d.accuracy_pct)}`).join(' ');
    const areaPath = linePath + ` L ${xScale(data.length - 1)} ${yScale(minAcc)} L ${xScale(0)} ${yScale(minAcc)} Z`;

    return (
        <svg width="100%" viewBox={`0 0 ${width} ${height}`} className="overflow-visible">
            {/* Grid lines */}
            {[minAcc, (minAcc + maxAcc) / 2, maxAcc].map((v, i) => (
                <g key={i}>
                    <line x1={padding.left} y1={yScale(v)} x2={width - padding.right} y2={yScale(v)}
                        stroke="rgba(255,255,255,0.05)" strokeDasharray="4,4" />
                    <text x={padding.left - 8} y={yScale(v) + 4} textAnchor="end"
                        fill="rgba(255,255,255,0.3)" fontSize="10">{Math.round(v)}%</text>
                </g>
            ))}

            {/* Area gradient */}
            <defs>
                <linearGradient id="trendGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#00d4ff" stopOpacity="0.3" />
                    <stop offset="100%" stopColor="#00d4ff" stopOpacity="0.02" />
                </linearGradient>
            </defs>
            <path d={areaPath} fill="url(#trendGrad)" />

            {/* Line */}
            <path d={linePath} fill="none" stroke="#00d4ff" strokeWidth="2.5"
                strokeLinecap="round" strokeLinejoin="round"
                style={{ filter: 'drop-shadow(0 0 6px rgba(0,212,255,0.5))' }} />

            {/* Data points */}
            {data.map((d, i) => (
                <g key={i}>
                    <circle cx={xScale(i)} cy={yScale(d.accuracy_pct)} r="4"
                        fill="#0a0e17" stroke="#00d4ff" strokeWidth="2" />
                    {/* Week label */}
                    {i % Math.max(1, Math.floor(data.length / 6)) === 0 && (
                        <text x={xScale(i)} y={height - 8} textAnchor="middle"
                            fill="rgba(255,255,255,0.25)" fontSize="9">
                            {new Date(d.week_start).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })}
                        </text>
                    )}
                </g>
            ))}

            {/* Latest accuracy label */}
            {data.length > 0 && (
                <text x={xScale(data.length - 1) + 8} y={yScale(data[data.length - 1].accuracy_pct) + 4}
                    fill="#00d4ff" fontSize="11" fontWeight="bold">
                    {data[data.length - 1].accuracy_pct}%
                </text>
            )}
        </svg>
    );
}

/* ───── Horizontal Bar Chart ───── */
function HorizontalBarChart({ items, valueKey = 'accuracy_pct', labelKey = 'league', maxValue = 100 }:
    { items: any[]; valueKey?: string; labelKey?: string; maxValue?: number }) {
    return (
        <div className="space-y-3">
            {items.map((item, i) => {
                const value = item[valueKey] || 0;
                const color = value >= 70 ? '#10b981' : value >= 55 ? '#3b82f6' : value >= 40 ? '#f59e0b' : '#ef4444';
                return (
                    <div key={i}>
                        <div className="flex items-center justify-between mb-1">
                            <span className="text-xs text-white/70">
                                {LEAGUE_NAMES[item[labelKey]] || item[labelKey]}
                            </span>
                            <div className="flex items-center space-x-2">
                                <span className="text-[10px] text-white/30">{item.matches || item.total || 0}경기</span>
                                <span className="text-xs font-black" style={{ color }}>
                                    {typeof value === 'number' ? value.toFixed(1) : value}%
                                </span>
                            </div>
                        </div>
                        <div className="w-full h-2 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.05)' }}>
                            <div className="h-full rounded-full transition-all duration-1000 ease-out"
                                style={{
                                    width: `${Math.min((value / maxValue) * 100, 100)}%`,
                                    background: `linear-gradient(90deg, ${color}88, ${color})`,
                                    boxShadow: `0 0 8px ${color}40`,
                                }} />
                        </div>
                    </div>
                );
            })}
        </div>
    );
}

/* ───── Donut Chart for Bias ───── */
function BiasDonut({ data }: { data: any[] }) {
    if (!data || data.length === 0) return null;

    const total = data.reduce((s, d) => s + (d.times_recommended || 0), 0);
    const colors: Record<string, string> = { HOME: '#3b82f6', DRAW: '#a855f7', AWAY: '#f97316' };
    const size = 140;
    const r = 50;
    const cx = size / 2;
    const cy = size / 2;
    const circumference = 2 * Math.PI * r;

    let offset = 0;

    return (
        <div className="flex items-center gap-6">
            <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ transform: 'rotate(-90deg)' }}>
                <circle cx={cx} cy={cy} r={r} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="16" />
                {data.map((d, i) => {
                    const pct = (d.times_recommended || 0) / total;
                    const arc = pct * circumference;
                    const element = (
                        <circle key={i} cx={cx} cy={cy} r={r} fill="none"
                            stroke={colors[d.recommendation] || '#6b7280'}
                            strokeWidth="16" strokeDasharray={`${arc} ${circumference - arc}`}
                            strokeDashoffset={`${-offset}`}
                            style={{ transition: 'stroke-dasharray 1s ease-out' }} />
                    );
                    offset += arc;
                    return element;
                })}
            </svg>
            <div className="space-y-2">
                {data.map((d, i) => (
                    <div key={i} className="flex items-center space-x-2">
                        <span className="w-3 h-3 rounded-full" style={{ background: colors[d.recommendation] || '#6b7280' }} />
                        <span className="text-xs text-white/60">{REC_LABELS[d.recommendation] || d.recommendation}</span>
                        <span className="text-xs font-bold" style={{ color: colors[d.recommendation] }}>
                            {d.recommendation_pct || ((d.times_recommended / total) * 100).toFixed(1)}%
                        </span>
                        <span className="text-[10px] text-white/30">
                            (적중 {d.accuracy_pct || 0}%)
                        </span>
                    </div>
                ))}
            </div>
        </div>
    );
}

/* ═════════════════════════════════════════════════
   MAIN COMPONENT
   ═════════════════════════════════════════════════ */
export default function InsightsPage() {
    const [insights, setInsights] = useState<InsightsData | null>(null);
    const [loading, setLoading] = useState(true);
    const [period, setPeriod] = useState(90);
    const [activeTab, setActiveTab] = useState<'overview' | 'league' | 'patterns' | 'trend'>('overview');

    const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || '';

    const fetchInsights = async () => {
        setLoading(true);
        try {
            const res = await fetch(`${API_BASE_URL}/api/backtest/insights?days=${period}`);
            if (!res.ok) throw new Error('Failed');
            const data = await res.json();
            setInsights(data.insights);
        } catch (e) {
            console.warn('Insights unavailable:', e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchInsights(); }, [period]);

    /* Animated stats */
    const accuracy = useCountUp(insights?.overall?.accuracy_pct || 0);
    const totalPreds = useCountUp(insights?.overall?.total_predictions || 0);
    const maxStreak = useCountUp(insights?.strong_patterns?.max_streak || 0);
    const avgConf = useCountUp(insights?.overall?.avg_confidence ? insights.overall.avg_confidence * 100 : 0);

    const tabs = [
        { key: 'overview', label: '📊 종합', icon: '' },
        { key: 'league', label: '🏟️ 리그별', icon: '' },
        { key: 'patterns', label: '🔍 패턴 분석', icon: '' },
        { key: 'trend', label: '📈 트렌드', icon: '' },
    ];

    return (
        <div className="min-h-screen flex flex-col" style={{ background: 'var(--bg-primary)' }}>
            <DeadlineBanner />
            <Navbar />

            <main className="flex-grow w-full relative z-10">
                {/* ━━━ HERO ━━━ */}
                <section className="relative overflow-hidden">
                    <div className="absolute inset-0 pointer-events-none">
                        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[500px]"
                            style={{ background: 'radial-gradient(ellipse 80% 60% at 50% 0%, rgba(0,212,255,0.12) 0%, transparent 60%)' }} />
                        <div className="absolute top-20 right-0 w-[400px] h-[400px]"
                            style={{ background: 'radial-gradient(circle at center, rgba(139,92,246,0.08) 0%, transparent 60%)' }} />
                    </div>

                    <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-12 pb-6">
                        <div className="text-center">
                            <div className="inline-flex items-center px-4 py-1.5 rounded-full border border-[rgba(0,212,255,0.3)] bg-[rgba(0,212,255,0.06)] text-xs mb-6 animate-fade-up">
                                <span className="w-1.5 h-1.5 rounded-full bg-[#00d4ff] mr-2 animate-pulse" />
                                <span style={{ color: '#00d4ff' }}>● 과거 데이터 기반 검증 완료</span>
                            </div>

                            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black text-white leading-tight mb-4 animate-fade-up" style={{ animationDelay: '80ms' }}>
                                AI 성과 분석<br />
                                <span className="gradient-text-glow">백테스트 인사이트</span>
                            </h1>

                            <p className="text-sm sm:text-base text-[var(--text-secondary)] max-w-xl mx-auto mb-8 animate-fade-up" style={{ animationDelay: '160ms' }}>
                                과거 경기 데이터에 AI 분석 모델을 소급 적용하여<br className="hidden sm:block" />
                                검증된 강점과 개선 영역을 투명하게 공개합니다
                            </p>

                            {/* Quick stats */}
                            <div className="grid grid-cols-4 gap-3 max-w-2xl mx-auto animate-fade-up" style={{ animationDelay: '240ms' }}>
                                <div className="gradient-border-card p-4 text-center">
                                    <div className="text-2xl font-black gradient-text">{accuracy.toFixed(1)}%</div>
                                    <div className="text-[10px] text-[var(--text-muted)] mt-1">전체 정확도</div>
                                </div>
                                <div className="gradient-border-card p-4 text-center">
                                    <div className="text-2xl font-black" style={{ color: '#00d4ff' }}>{Math.round(totalPreds)}</div>
                                    <div className="text-[10px] text-[var(--text-muted)] mt-1">분석 경기</div>
                                </div>
                                <div className="gradient-border-card p-4 text-center">
                                    <div className="text-2xl font-black" style={{ color: '#10b981' }}>{Math.round(maxStreak)}</div>
                                    <div className="text-[10px] text-[var(--text-muted)] mt-1">최대 연속 적중</div>
                                </div>
                                <div className="gradient-border-card p-4 text-center">
                                    <div className="text-2xl font-black" style={{ color: '#8b5cf6' }}>{avgConf.toFixed(1)}%</div>
                                    <div className="text-[10px] text-[var(--text-muted)] mt-1">평균 신뢰도</div>
                                </div>
                            </div>
                        </div>
                    </div>
                </section>

                <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 pb-10">

                    {/* ━━━ PERIOD + TABS ━━━ */}
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-6">
                        <div className="flex items-center gap-2 flex-wrap">
                            {tabs.map(tab => (
                                <button key={tab.key}
                                    onClick={() => setActiveTab(tab.key as any)}
                                    className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${activeTab === tab.key ? 'text-white shadow-md shadow-cyan-500/20' : 'text-white/30 hover:text-white/50'}`}
                                    style={activeTab === tab.key
                                        ? { background: 'rgba(0,212,255,0.12)', color: '#00d4ff', border: '1px solid rgba(0,212,255,0.2)' }
                                        : { background: 'rgba(255,255,255,0.03)', border: '1px solid transparent' }}
                                >
                                    {tab.label}
                                </button>
                            ))}
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="text-[10px] text-white/30">기간:</span>
                            {[30, 90, 180, 365].map(d => (
                                <button key={d}
                                    onClick={() => setPeriod(d)}
                                    className={`text-[11px] px-2.5 py-1 rounded-lg font-bold transition-all ${period === d ? 'text-[#00d4ff] bg-[rgba(0,212,255,0.1)]' : 'text-white/30 hover:text-white/50'}`}
                                >
                                    {d}일
                                </button>
                            ))}
                        </div>
                    </div>

                    {loading ? (
                        <div className="py-20 text-center text-white/40">
                            <div className="animate-spin inline-block w-10 h-10 border-2 border-white/10 border-t-[var(--accent-primary)] rounded-full mb-4" />
                            <p className="text-sm">과거 데이터 분석 중...</p>
                            <p className="text-[10px] text-white/20 mt-1">BigQuery에서 백테스트 결과를 조회하고 있습니다</p>
                        </div>
                    ) : !insights ? (
                        <div className="py-20 text-center text-white/30 rounded-2xl" style={{ background: 'var(--bg-card)' }}>
                            <div className="text-4xl mb-3">📊</div>
                            <p>인사이트 데이터를 불러올 수 없습니다</p>
                            <p className="text-xs text-white/20 mt-1">백엔드 연결을 확인해주세요</p>
                        </div>
                    ) : (
                        <>
                            {/* ━━━ OVERVIEW TAB ━━━ */}
                            {activeTab === 'overview' && (
                                <div className="space-y-6">
                                    {/* Confidence Calibration */}
                                    <PremiumGate featureName="AI 신뢰도 검증" requiredTier="pro">
                                        <div className="rounded-2xl p-5" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}>
                                            <h3 className="text-sm font-bold text-white mb-1 flex items-center">
                                                <span className="w-1 h-5 rounded-full mr-2" style={{ background: 'linear-gradient(to bottom, #00d4ff, #8b5cf6)' }} />
                                                🎯 신뢰도별 실제 예측 정확도
                                            </h3>
                                            <p className="text-[10px] text-white/30 mb-4">AI가 "자신 있다"고 할수록 정말 잘 맞추는가?</p>
                                            {insights.by_confidence && insights.by_confidence.length > 0 ? (
                                                <HorizontalBarChart items={insights.by_confidence} valueKey="accuracy_pct" labelKey="confidence_tier" />
                                            ) : (
                                                <div className="text-xs text-white/20 text-center py-4">데이터 수집 중...</div>
                                            )}
                                        </div>
                                    </PremiumGate>

                                    {/* Odds Range Accuracy */}
                                    <PremiumGate featureName="배당 구간 분석" requiredTier="pro">
                                        <div className="rounded-2xl p-5" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}>
                                            <h3 className="text-sm font-bold text-white mb-1 flex items-center">
                                                <span className="w-1 h-5 rounded-full mr-2" style={{ background: 'linear-gradient(to bottom, #10b981, #f59e0b)' }} />
                                                📊 데이터 구간별 예측 정확도
                                            </h3>
                                            <p className="text-[10px] text-white/30 mb-4">어떤 데이터 범위에서 AI 분석이 가장 정확한가?</p>
                                            {insights.by_odds_range && insights.by_odds_range.length > 0 ? (
                                                <HorizontalBarChart items={insights.by_odds_range} valueKey="accuracy_pct" labelKey="odds_range" />
                                            ) : (
                                                <div className="text-xs text-white/20 text-center py-4">데이터 수집 중...</div>
                                            )}
                                        </div>
                                    </PremiumGate>

                                    {/* Home/Away Bias */}
                                    <div className="rounded-2xl p-5" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}>
                                        <h3 className="text-sm font-bold text-white mb-1 flex items-center">
                                            <span className="w-1 h-5 rounded-full mr-2" style={{ background: 'linear-gradient(to bottom, #3b82f6, #f97316)' }} />
                                            ⚖️ AI 추천 분포 & 편향 분석
                                        </h3>
                                        <p className="text-[10px] text-white/30 mb-4">AI가 홈/무/원정 중 어느 쪽을 더 잘 맞추는가?</p>
                                        <BiasDonut data={insights.home_away_bias || []} />
                                    </div>
                                </div>
                            )}

                            {/* ━━━ LEAGUE TAB ━━━ */}
                            {activeTab === 'league' && (
                                <PremiumGate featureName="리그별 예측 정확도" requiredTier="pro">
                                    <div className="rounded-2xl p-5" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}>
                                        <h3 className="text-sm font-bold text-white mb-1 flex items-center">
                                            <span className="w-1 h-5 rounded-full mr-2" style={{ background: 'linear-gradient(to bottom, #ef4444, #f97316)' }} />
                                            🏟️ 리그별 AI 예측 정확도
                                        </h3>
                                        <p className="text-[10px] text-white/30 mb-4">AI 모델이 가장 정확한 리그 vs 가장 약한 리그</p>
                                        {insights.by_league && insights.by_league.length > 0 ? (
                                            <HorizontalBarChart items={insights.by_league} valueKey="accuracy_pct" labelKey="league" />
                                        ) : (
                                            <div className="text-xs text-white/20 text-center py-8">리그별 데이터를 수집 중입니다...</div>
                                        )}

                                        {/* Strongest league highlight */}
                                        {insights.by_league && insights.by_league.length > 0 && (
                                            <div className="mt-5 p-4 rounded-xl" style={{ background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.15)' }}>
                                                <div className="text-[10px] text-[#10b981] font-bold mb-1">💡 AI 분석 인사이트</div>
                                                <div className="text-xs text-white/60">
                                                    AI 모델은 <strong style={{ color: '#10b981' }}>
                                                        {LEAGUE_NAMES[insights.by_league[0]?.league] || insights.by_league[0]?.league}
                                                    </strong>에서 가장 높은 예측 정확도 ({insights.by_league[0]?.accuracy_pct}%)을 기록하고 있습니다.
                                                    {insights.by_league.length > 1 && (
                                                        <> 반면, <strong style={{ color: '#f59e0b' }}>
                                                            {LEAGUE_NAMES[insights.by_league[insights.by_league.length - 1]?.league] || insights.by_league[insights.by_league.length - 1]?.league}
                                                        </strong>의 예측 정확도은 {insights.by_league[insights.by_league.length - 1]?.accuracy_pct}%로 개선이 필요합니다.</>
                                                    )}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </PremiumGate>
                            )}

                            {/* ━━━ PATTERNS TAB ━━━ */}
                            {activeTab === 'patterns' && (
                                <div className="space-y-6">
                                    {/* Strong Patterns */}
                                    <div className="rounded-2xl p-5" style={{ background: 'var(--bg-card)', border: '1px solid rgba(16,185,129,0.15)' }}>
                                        <h3 className="text-sm font-bold text-white mb-1 flex items-center">
                                            <span className="w-1 h-5 rounded-full mr-2" style={{ background: 'linear-gradient(to bottom, #10b981, #34d399)' }} />
                                            ✅ AI 강점 패턴
                                        </h3>
                                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-4">
                                            <div className="p-3 rounded-xl text-center" style={{ background: 'rgba(16,185,129,0.06)' }}>
                                                <div className="text-2xl font-black" style={{ color: '#10b981' }}>
                                                    {insights.strong_patterns?.max_streak || 0}
                                                </div>
                                                <div className="text-[10px] text-white/40 mt-1">최대 연속 적중</div>
                                            </div>
                                            <div className="p-3 rounded-xl text-center" style={{ background: 'rgba(16,185,129,0.06)' }}>
                                                <div className="text-2xl font-black" style={{ color: '#10b981' }}>
                                                    {insights.strong_patterns?.total_high_confidence_hits || 0}
                                                </div>
                                                <div className="text-[10px] text-white/40 mt-1">고신뢰도 적중</div>
                                            </div>
                                            <div className="p-3 rounded-xl text-center" style={{ background: 'rgba(16,185,129,0.06)' }}>
                                                <div className="text-2xl font-black" style={{ color: '#10b981' }}>
                                                    {insights.overall?.avg_confidence_when_correct
                                                        ? (insights.overall.avg_confidence_when_correct * 100).toFixed(1) : 0}%
                                                </div>
                                                <div className="text-[10px] text-white/40 mt-1">적중 시 평균 신뢰도</div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Weak Patterns */}
                                    <PremiumGate featureName="약점 분석" requiredTier="pro">
                                        <div className="rounded-2xl p-5" style={{ background: 'var(--bg-card)', border: '1px solid rgba(239,68,68,0.15)' }}>
                                            <h3 className="text-sm font-bold text-white mb-1 flex items-center">
                                                <span className="w-1 h-5 rounded-full mr-2" style={{ background: 'linear-gradient(to bottom, #ef4444, #f97316)' }} />
                                                ⚠️ AI 약점 패턴 (투명 공개)
                                            </h3>
                                            <p className="text-[10px] text-white/30 mb-4">AI가 자주 틀리는 상황을 알면 더 현명한 판단이 가능합니다</p>

                                            {insights.weak_patterns?.analysis_summary && (
                                                <div className="mb-4 p-3 rounded-xl text-xs text-white/50" style={{ background: 'rgba(239,68,68,0.05)', border: '1px solid rgba(239,68,68,0.1)' }}>
                                                    💡 {insights.weak_patterns.analysis_summary}
                                                </div>
                                            )}

                                            {/* Miss pattern table */}
                                            {insights.weak_patterns?.miss_patterns && insights.weak_patterns.miss_patterns.length > 0 && (
                                                <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--border-subtle)' }}>
                                                    <div className="grid grid-cols-4 text-[10px] font-bold text-white/30 p-2" style={{ background: 'rgba(255,255,255,0.02)' }}>
                                                        <span>AI 예측</span>
                                                        <span>실제 결과</span>
                                                        <span className="text-center">오답 횟수</span>
                                                        <span className="text-right">실패 시 신뢰도</span>
                                                    </div>
                                                    {insights.weak_patterns.miss_patterns.slice(0, 6).map((mp, i) => (
                                                        <div key={i} className="grid grid-cols-4 text-xs p-2 items-center" style={{ borderTop: '1px solid var(--border-subtle)' }}>
                                                            <span className="text-white/60">{REC_LABELS[mp.predicted] || mp.predicted}</span>
                                                            <span className="text-white/60">{REC_LABELS[mp.actual] || mp.actual}</span>
                                                            <span className="text-center font-bold" style={{ color: '#ef4444' }}>{mp.miss_count}</span>
                                                            <span className="text-right text-white/40">{((mp.avg_confidence_when_wrong || 0) * 100).toFixed(1)}%</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}

                                            {/* Draw analysis */}
                                            {insights.draw_analysis && insights.draw_analysis.length > 0 && (
                                                <div className="mt-4 p-4 rounded-xl" style={{ background: 'rgba(168,85,247,0.06)', border: '1px solid rgba(168,85,247,0.15)' }}>
                                                    <div className="text-[10px] text-[#a855f7] font-bold mb-2">🎯 무승부 분석 (스포츠 AI의 전통적 약점)</div>
                                                    {insights.draw_analysis.map((da, i) => (
                                                        <div key={i} className="text-xs text-white/50 flex items-center justify-between py-1">
                                                            <span>{da.scenario}</span>
                                                            <span className="font-bold" style={{ color: (da.accuracy_pct || 0) >= 40 ? '#10b981' : '#f59e0b' }}>
                                                                {da.accuracy_pct || 0}% ({da.correct || 0}/{da.total || 0})
                                                            </span>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    </PremiumGate>
                                </div>
                            )}

                            {/* ━━━ TREND TAB ━━━ */}
                            {activeTab === 'trend' && (
                                <PremiumGate featureName="예측 정확도 트렌드" requiredTier="pro">
                                    <div className="rounded-2xl p-5" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}>
                                        <h3 className="text-sm font-bold text-white mb-1 flex items-center">
                                            <span className="w-1 h-5 rounded-full mr-2" style={{ background: 'linear-gradient(to bottom, #00d4ff, #8b5cf6)' }} />
                                            📈 주간 예측 정확도 트렌드
                                        </h3>
                                        <p className="text-[10px] text-white/30 mb-4">자가 학습(Self-Learning)으로 AI가 매주 개선되고 있는가?</p>
                                        <div className="w-full overflow-x-auto">
                                            <TrendLineChart data={insights.trend || []} />
                                        </div>

                                        {/* Model improvement insight */}
                                        {insights.trend && insights.trend.length >= 4 && (
                                            (() => {
                                                const firstHalf = insights.trend.slice(0, Math.floor(insights.trend.length / 2));
                                                const secondHalf = insights.trend.slice(Math.floor(insights.trend.length / 2));
                                                const firstAvg = firstHalf.reduce((s, d) => s + d.accuracy_pct, 0) / firstHalf.length;
                                                const secondAvg = secondHalf.reduce((s, d) => s + d.accuracy_pct, 0) / secondHalf.length;
                                                const improved = secondAvg > firstAvg;

                                                return (
                                                    <div className="mt-4 p-4 rounded-xl" style={{
                                                        background: improved ? 'rgba(16,185,129,0.06)' : 'rgba(239,68,68,0.06)',
                                                        border: `1px solid ${improved ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)'}`,
                                                    }}>
                                                        <div className="text-[10px] font-bold mb-1" style={{ color: improved ? '#10b981' : '#ef4444' }}>
                                                            {improved ? '📈 AI 모델 성장 중' : '📉 성과 점검 필요'}
                                                        </div>
                                                        <div className="text-xs text-white/50">
                                                            초반 {firstHalf.length}주 평균 <strong>{firstAvg.toFixed(1)}%</strong> →
                                                            최근 {secondHalf.length}주 평균 <strong style={{ color: improved ? '#10b981' : '#ef4444' }}>
                                                                {secondAvg.toFixed(1)}%
                                                            </strong>
                                                            {improved
                                                                ? ` (${(secondAvg - firstAvg).toFixed(1)}%p 개선 — 매일 자가 학습 효과)`
                                                                : ` (${(firstAvg - secondAvg).toFixed(1)}%p 하락 — 모델 재학습 검토 중)`
                                                            }
                                                        </div>
                                                    </div>
                                                );
                                            })()
                                        )}
                                    </div>
                                </PremiumGate>
                            )}

                            {/* Data source footer */}
                            <div className="mt-6 flex flex-col sm:flex-row items-center justify-between gap-2 text-[10px] text-white/20 px-2">
                                <div className="flex items-center space-x-2">
                                    <span>📚 소스: BigQuery predictions_log + matches_raw</span>
                                    <span className="w-1 h-1 rounded-full bg-white/20" />
                                    <span>모델: {insights.overall?.model_version || 'v1'}</span>
                                    <span className="w-1 h-1 rounded-full bg-white/20" />
                                    <span>기간: 최근 {period}일</span>
                                </div>
                                <div>과거 성과는 미래 결과를 보장하지 않습니다</div>
                            </div>
                        </>
                    )}
                </div>
            </main>

            <AiAnalystWidget />
        </div>
    );
}
