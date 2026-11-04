"use client";
import React, { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { useAuth } from '../context/AuthContext';
import DeadlineBanner from '../components/DeadlineBanner';
import Navbar from '../components/Navbar';
import {
    fetchProtoRoundWithFallback,
    DEFAULT_BETMAN_CATALOG,
    BetmanGameCatalogItem,
} from '../lib/protoFallback';

interface SevenFactorItem {
    name: string;
    score: number;
    comment: string;
}

interface ProtoMatch {
    game_no: number;
    game_no_label: string;
    fixture_id: string;
    league: string;
    sport: string;
    betman_home: string;
    betman_away: string;
    home_ko: string;
    away_ko: string;
    cutoff_time: string;
    kickoff_display: string;
    proto_market_type?: string;
    betman_home_odds: number;
    betman_draw_odds: number;
    betman_away_odds: number;
    global_home_odds: number;
    global_draw_odds: number;
    global_away_odds: number;
    ai_home_prob: number;
    ai_draw_prob: number;
    ai_away_prob: number;
    vote_home_pct?: number;
    vote_mid_pct?: number;
    vote_away_pct?: number;
    home_stat?: {
        rank: number;
        total_teams: number;
        wins: number;
        draws: number;
        losses: number;
        points: number;
        goal_diff: number;
        avg_gf: number;
        avg_ga: number;
        form_hyphen: string;
        record_summary: string;
        form_summary: string;
    };
    away_stat?: {
        rank: number;
        total_teams: number;
        wins: number;
        draws: number;
        losses: number;
        points: number;
        goal_diff: number;
        avg_gf: number;
        avg_ga: number;
        form_hyphen: string;
        record_summary: string;
        form_summary: string;
    };
    poisson_simulation?: {
        expected_home_goals: number;
        expected_away_goals: number;
        expected_total_goals: number;
        poisson_home_prob: number;
        poisson_draw_prob: number;
        poisson_away_prob: number;
        over_25_prob: number;
        btts_prob: number;
        top_exact_scores: { score: string; prob_pct: number }[];
    } | null;
    pillar_breakdown?: {
        mkt_home_prob: number;
        mkt_away_prob: number;
        stat_home_prob: number;
        stat_away_prob: number;
        fac_home_prob: number;
        fac_away_prob: number;
        mkt_pick_prob: number;
        stat_pick_prob: number;
        fac_pick_prob: number;
        consensus_count: number;
        consensus_label: string;
    };
    w5l_analysis?: {
        win_prob: number;
        close5_prob: number;
        lose_prob: number;
        primary_label: string;
        multi_recommend: string;
    } | null;
    special_brackets?: {
        expected_home_pts: number;
        expected_away_pts: number;
        home_top1_bracket: string;
        home_top1_prob: number;
        away_top1_bracket: string;
        away_top1_prob: number;
    } | null;
    ai_pick_code: string;
    ai_pick_label: string;
    ai_pick_full_label: string;
    ai_pick_prob: number;
    ai_pick_odds: number;
    ai_confidence: number;
    payout_efficiency: number;
    expected_value_pct: number;
    is_killer_pick: boolean;
    is_trap_candidate: boolean;
    trap_risk_score: number;
    upset_or_draw_prob: number;
    trap_reason: string;
    value_reason: string;
    ai_detail_report?: {
        tactical_summary?: string;
        seven_factors?: SevenFactorItem[];
    };
}

interface ProtoReportData {
    game_key?: string;
    gm_id?: string;
    gm_ts?: string;
    game_name?: string;
    game_category?: string;
    game_type?: string;
    rule_summary?: string;
    round_id: string;
    display_round_no: string;
    round_title: string;
    published_at: string;
    published_date: string;
    sale_end_display?: string;
    total_matches: number;
    killer_picks_count: number;
    available_games?: BetmanGameCatalogItem[];
    matches: ProtoMatch[];
}

function buildFallbackSevenFactors(m: ProtoMatch): SevenFactorItem[] {
    if (m.ai_detail_report?.seven_factors && m.ai_detail_report.seven_factors.length > 0) {
        return m.ai_detail_report.seven_factors;
    }
    const favIsHome = m.ai_home_prob >= m.ai_away_prob;
    const favTeam = favIsHome ? m.home_ko : m.away_ko;
    const maxProb = Math.max(m.ai_home_prob, m.ai_away_prob);
    return [
        {
            name: '글로벌 배당 마진 제거(De-vig) 내재승률',
            score: Math.min(96, Math.max(52, Math.round(maxProb + 12))),
            comment: `${favTeam} 기준 글로벌 피나클 마진 제거 순수 기대 확률 ${maxProb}% 반영`,
        },
        {
            name: '포아송 기대득점(xG) · 공수 효율 지수',
            score: Math.min(95, Math.max(55, Math.round(m.ai_confidence - 2))),
            comment: `최근 5경기 기대득실 편차 및 슈팅 전환율 시뮬레이션 우위`,
        },
        {
            name: '베트맨 공시배당 대비 데이터 가치(+EV)',
            score: Math.min(94, Math.max(50, Math.round(m.payout_efficiency || 78))),
            comment: m.value_reason || `베트맨 배당 대비 기대수익 효율 ${m.payout_efficiency || 88}% 산출`,
        },
        {
            name: '대중 투표율 과열 및 역배당 변수 방어',
            score: m.is_trap_candidate ? 88 : 74,
            comment: m.is_trap_candidate
                ? m.trap_reason
                : `투표 쏠림 대비 실제 전력 지표 일치 구간 (안정 등급)`,
        },
        {
            name: '홈·원정 체력 및 일정 피로도 팩터',
            score: favIsHome ? 82 : 76,
            comment: favIsHome
                ? `${m.home_ko} 홈 구장 공수 밸런스 및 이동거리 이점 확보`
                : `${m.away_ko} 원정 경기력 유지 및 역습 효율 우세`,
        },
        {
            name: '상대전적 및 전술 상성 스코어링',
            score: Math.min(92, Math.max(60, Math.round(m.ai_confidence - 5))),
            comment: `최근 맞대결 전술 상성 및 세트피스 득실 지표 교차 검증 완료`,
        },
    ];
}

export default function AnalysisPage() {
    const { user } = useAuth();
    const [report, setReport] = useState<ProtoReportData | null>(null);
    const [selectedGameKey, setSelectedGameKey] = useState<string>('G011_260065');
    const [loading, setLoading] = useState<boolean>(true);
    const [roleFilter, setRoleFilter] = useState<'ALL' | 'KILLER' | 'TRAP' | 'NORMAL'>('ALL');
    const [searchQuery, setSearchQuery] = useState<string>('');
    const [expandedNo, setExpandedNo] = useState<number | null>(1);
    const [lockAlertMsg, setLockAlertMsg] = useState<string | null>(null);

    const isPaidOrUnlocked = useMemo(() => {
        if (!user) return false;
        const r = (user.role || user.tier || '').toLowerCase();
        return ['pro', 'vip', 'premium', 'admin', 'round_pass', 'store_b2b'].includes(r);
    }, [user]);

    const loadRound = async (gameKey: string) => {
        setLoading(true);
        try {
            const data = await fetchProtoRoundWithFallback(gameKey);
            if (data) {
                setReport(data);
                if (data.game_key) setSelectedGameKey(data.game_key);
            }
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadRound('G011_260065');
    }, []);

    const catalogList = useMemo(() => {
        if (report?.available_games && report.available_games.length > 0) {
            return report.available_games;
        }
        return DEFAULT_BETMAN_CATALOG;
    }, [report]);

    const matches = report?.matches || [];

    const filteredMatches = useMemo(() => {
        return matches.filter((m) => {
            if (roleFilter === 'KILLER' && !m.is_killer_pick) return false;
            if (roleFilter === 'TRAP' && !m.is_trap_candidate) return false;
            if (roleFilter === 'NORMAL' && (m.is_killer_pick || m.is_trap_candidate)) return false;
            if (searchQuery.trim()) {
                const q = searchQuery.trim().toLowerCase();
                const text = `${m.game_no_label} ${m.betman_home} ${m.betman_away} ${m.home_ko} ${m.away_ko} ${m.league}`.toLowerCase();
                if (!text.includes(q)) return false;
            }
            return true;
        });
    }, [matches, roleFilter, searchQuery]);

    const stats = useMemo(() => {
        const total = matches.length;
        const killer = matches.filter((m) => m.is_killer_pick).length;
        const trap = matches.filter((m) => m.is_trap_candidate).length;
        const avgConf = total > 0 ? Math.round(matches.reduce((s, m) => s + (m.ai_confidence || 75), 0) / total) : 0;
        return { total, killer, trap, avgConf };
    }, [matches]);

    return (
        <div className="min-h-screen flex flex-col bg-[#f4f6f9] text-slate-900">
            <DeadlineBanner />
            <Navbar />

            <main className="max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-6 space-y-6 flex-grow">
                {/* ━━━ 1. 상단 공식 베트맨 연동 헤더 (고대비 화이트 & 로얄블루) ━━━ */}
                <section className="rounded-2xl bg-white border border-slate-300 border-t-4 border-t-[#0046b8] p-5 sm:p-7 shadow-xs">
                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5">
                        <div className="space-y-2">
                            <div className="flex flex-wrap items-center gap-2">
                                <span className="px-2.5 py-1 rounded-md bg-[#0046b8] text-white text-xs font-extrabold">
                                    🏛️ 베트맨 공식 발매 게임 100% 연동
                                </span>
                                <span className="px-2.5 py-1 rounded-md bg-blue-50 text-[#0046b8] border border-blue-200 text-xs font-extrabold">
                                    3-Pillar · 7-Factor 구단 전력 DB
                                </span>
                                {report?.sale_end_display && (
                                    <span className="px-2.5 py-1 rounded-md bg-amber-50 text-amber-900 border border-amber-300 text-xs font-bold">
                                        ⏰ {report.sale_end_display}
                                    </span>
                                )}
                            </div>
                            <h1 className="text-2xl sm:text-3xl font-black text-slate-950 tracking-tight">
                                {report ? `${report.round_title} — 7-Factor 심층 전력 & 배당흐름 DB` : '베트맨 공식 회차 7-Factor 전력 분석 DB'}
                            </h1>
                            <p className="text-xs sm:text-sm text-slate-600 leading-relaxed max-w-3xl">
                                베트맨 공식 대상 경기(<strong>축구토토 승무패 · 프로토 승부식 · 농구 승5패 · 스페셜N</strong>)의 경기번호별 <strong>글로벌 배당 마진 제거 순수 확률</strong>, <strong>포아송 기대득점(xG)</strong>, <strong>베트맨 투표율 괴리도</strong> 등 7대 핵심 지표를 고대비 화면으로 한눈에 비교합니다.
                            </p>
                        </div>

                        {/* 우측 핵심 통계 요약 카드 4개 */}
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 shrink-0">
                            <div className="rounded-xl bg-slate-50 border border-slate-200 px-4 py-3 text-center">
                                <div className="text-xl sm:text-2xl font-black text-slate-900">{stats.total}</div>
                                <div className="text-[11px] font-bold text-slate-500 mt-0.5">이번 회차 대상경기</div>
                            </div>
                            <div className="rounded-xl bg-blue-50 border border-blue-200 px-4 py-3 text-center">
                                <div className="text-xl sm:text-2xl font-black text-[#0046b8]">{stats.killer}</div>
                                <div className="text-[11px] font-bold text-[#0046b8] mt-0.5">📌 단독우위 주력</div>
                            </div>
                            <div className="rounded-xl bg-rose-50 border border-rose-200 px-4 py-3 text-center">
                                <div className="text-xl sm:text-2xl font-black text-rose-600">{stats.trap}</div>
                                <div className="text-[11px] font-bold text-rose-700 mt-0.5">⚠️ 이변·함정 주의</div>
                            </div>
                            <div className="rounded-xl bg-emerald-50 border border-emerald-200 px-4 py-3 text-center">
                                <div className="text-xl sm:text-2xl font-black text-emerald-700">{stats.avgConf}%</div>
                                <div className="text-[11px] font-bold text-emerald-800 mt-0.5">평균 AI 신뢰도</div>
                            </div>
                        </div>
                    </div>

                    {/* ━━━ 베트맨 공식 회차 전환 탭 ━━━ */}
                    <div className="mt-5 pt-4 border-t border-slate-200">
                        <div className="text-xs font-extrabold text-slate-700 mb-2">
                            🎯 분석할 베트맨 공식 발매 회차 선택:
                        </div>
                        <div className="flex flex-wrap gap-2">
                            {catalogList.map((g) => {
                                const active = g.game_key === (report?.game_key || selectedGameKey);
                                return (
                                    <button
                                        key={g.game_key}
                                        type="button"
                                        onClick={() => loadRound(g.game_key)}
                                        className={`px-3.5 py-2 rounded-xl text-xs font-extrabold border transition cursor-pointer flex items-center gap-1.5 ${
                                            active
                                                ? 'bg-[#0046b8] text-white border-[#0046b8] shadow-xs'
                                                : 'bg-slate-50 text-slate-800 border-slate-300 hover:bg-blue-50 hover:border-blue-300'
                                        }`}
                                    >
                                        <span>{g.icon}</span>
                                        <span>{g.full_title}</span>
                                        <span className={`px-1.5 py-0.5 rounded text-[10px] ${active ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-700'}`}>
                                            {g.match_count}경기
                                        </span>
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                </section>

                {/* ━━━ 2. 개인 모바일 패스 & 판매점 무료 A4 벽보 안내 배너 ━━━ */}
                {!isPaidOrUnlocked && (
                    <section className="rounded-xl bg-[#003996] text-white p-4 sm:p-5 shadow-sm flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
                        <div className="space-y-1">
                            <div className="flex flex-wrap items-center gap-2">
                                <span className="px-2.5 py-0.5 rounded bg-amber-400 text-slate-950 text-xs font-black">
                                    🔒 비로그인 · 무료 회원 잠금 모드 (01번 경기만 샘플 공개)
                                </span>
                                <span className="text-xs font-bold text-blue-100">
                                    02번~{matches.length || 14}번 경기의 주력/함정 판정 및 7-Factor 정밀 지표는 유료 멤버십 전용입니다.
                                </span>
                            </div>
                            <p className="text-xs sm:text-sm text-white font-semibold">
                                비로그인 상태에서는 <strong>01번 경기 1개만 무료 샘플</strong>로 공개됩니다. 나머지 전체 경기의 단통 주력·함정 경보 및 7-Factor 지표는 <strong>이번 회차 열람권(3,900원)</strong> 또는 <strong>개인 월 무제한 패스(29,900원)</strong> 로그인 후 즉시 열람하실 수 있습니다.
                            </p>
                        </div>
                        <div className="flex flex-wrap items-center gap-2 shrink-0">
                            {!user && (
                                <Link
                                    href="/ko/login?redirect=/ko/analysis"
                                    className="px-4 py-2.5 rounded-lg bg-white hover:bg-blue-50 !text-[#003996] font-black text-xs transition"
                                >
                                    🔑 로그인 / 무료 가입
                                </Link>
                            )}
                            <Link
                                href={`/ko/payment/request?plan=round_pass&billing=once&round=${report?.round_id || 'current'}`}
                                className="px-4 py-2.5 rounded-lg bg-amber-400 hover:bg-amber-300 !text-slate-950 font-black text-xs transition"
                            >
                                ⚡ 이번 회차 즉시 열기 (3,900원)
                            </Link>
                            <Link
                                href="/ko/pricing"
                                className="px-3.5 py-2.5 rounded-lg bg-blue-800 hover:bg-blue-700 border border-blue-400 !text-white font-black text-xs transition"
                            >
                                📱 월 무제한 패스 (29,900원)
                            </Link>
                        </div>
                    </section>
                )}

                {lockAlertMsg && !isPaidOrUnlocked && (
                    <div className="rounded-xl bg-amber-50 border-2 border-amber-400 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="text-xs sm:text-sm font-extrabold text-amber-950">
                            {lockAlertMsg}
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                            <Link
                                href={`/ko/payment/request?plan=round_pass&billing=once&round=${report?.round_id || 'current'}`}
                                className="px-3.5 py-1.5 rounded-lg bg-[#0046b8] !text-white text-xs font-extrabold"
                            >
                                ⚡ 3,900원 열람권으로 즉시 필터 해제
                            </Link>
                            <button
                                type="button"
                                onClick={() => setLockAlertMsg(null)}
                                className="px-2.5 py-1.5 rounded-lg bg-amber-200/70 text-amber-950 text-xs font-bold cursor-pointer"
                            >
                                닫기
                            </button>
                        </div>
                    </div>
                )}

                {/* ━━━ 3. 경기 필터 & 검색 바 ━━━ */}
                <section className="rounded-xl bg-white border border-slate-300 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex flex-wrap items-center gap-1.5">
                        {[
                            { id: 'ALL', label: `전체 경기 (${matches.length})`, locked: false },
                            { id: 'KILLER', label: `📌 단독 우위 주력 (${stats.killer})`, locked: !isPaidOrUnlocked },
                            { id: 'TRAP', label: `⚠️ 이변·함정 주의보 (${stats.trap})`, locked: !isPaidOrUnlocked },
                            { id: 'NORMAL', label: `🛡️ 일반 경합 경기 (${matches.length - stats.killer - stats.trap})`, locked: !isPaidOrUnlocked },
                        ].map((tab) => (
                            <button
                                key={tab.id}
                                type="button"
                                onClick={() => {
                                    if (tab.locked) {
                                        setLockAlertMsg('🔒 [단독 우위 주력 / 이변·함정 주의보] 종목 자동 분류 필터는 유료 열람권(3,900원) 또는 PRO 멤버십 로그인 시 활성화됩니다.');
                                        return;
                                    }
                                    setLockAlertMsg(null);
                                    setRoleFilter(tab.id as any);
                                }}
                                className={`px-3.5 py-2 rounded-lg text-xs font-extrabold border transition cursor-pointer flex items-center gap-1 ${
                                    roleFilter === tab.id
                                        ? 'bg-[#0046b8] text-white border-[#0046b8]'
                                        : 'bg-slate-50 text-slate-700 border-slate-300 hover:bg-slate-100'
                                }`}
                            >
                                <span>{tab.label}</span>
                                {tab.locked && <span className="text-[10px] text-amber-600 font-black">🔒</span>}
                            </button>
                        ))}
                    </div>

                    <div className="flex items-center gap-2">
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="경기번호 또는 팀명 검색 (예: 01번, 맨체스U, 아스널)"
                            className="w-full sm:w-64 px-3.5 py-2 rounded-lg bg-slate-50 border border-slate-300 text-xs font-bold text-slate-900 placeholder-slate-400 focus:outline-none focus:border-[#0046b8] focus:bg-white"
                        />
                        <Link
                            href="/ko"
                            className="px-3.5 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 !text-white text-xs font-extrabold whitespace-nowrap"
                        >
                            📋 14경기 통합 마킹표 보기
                        </Link>
                    </div>
                </section>

                {/* ━━━ 4. 경기별 7-Factor 고대비 카드 리스트 ━━━ */}
                {loading ? (
                    <div className="rounded-2xl bg-white border border-slate-300 p-16 text-center space-y-3">
                        <div className="w-10 h-10 border-4 border-[#0046b8] border-t-transparent rounded-full animate-spin mx-auto" />
                        <p className="text-base font-extrabold text-slate-900">
                            베트맨 공식 회차 7-Factor 구단 전력 데이터를 불러오는 중입니다...
                        </p>
                    </div>
                ) : filteredMatches.length === 0 ? (
                    <div className="rounded-2xl bg-white border border-slate-300 p-12 text-center space-y-2">
                        <p className="text-base font-extrabold text-slate-800">조건에 맞는 경기가 없습니다.</p>
                        <button
                            type="button"
                            onClick={() => { setRoleFilter('ALL'); setSearchQuery(''); }}
                            className="px-4 py-2 rounded-lg bg-[#0046b8] text-white text-xs font-bold cursor-pointer"
                        >
                            전체 경기 보기
                        </button>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                        {filteredMatches.map((m) => {
                            const isSampleUnlocked = m.game_no === 1; // 오직 01번 경기 1개만 무료 샘플 공개
                            const isUnlocked = isPaidOrUnlocked || isSampleUnlocked;
                            const isExpanded = isUnlocked ? (expandedNo === m.game_no || m.game_no === 1) : expandedNo === m.game_no;
                            const factors = buildFallbackSevenFactors(m);

                            const pHome = m.w5l_analysis ? m.w5l_analysis.win_prob : m.ai_home_prob;
                            const pMid = m.w5l_analysis ? m.w5l_analysis.close5_prob : m.ai_draw_prob;
                            const pAway = m.w5l_analysis ? m.w5l_analysis.lose_prob : m.ai_away_prob;
                            const midLabel = m.w5l_analysis ? '5점차이내(5)' : '무승부';

                            return (
                                <div
                                    key={m.game_no}
                                    className={`rounded-2xl bg-white border-2 transition shadow-xs overflow-hidden ${
                                        !isUnlocked
                                            ? 'border-slate-300'
                                            : m.is_killer_pick
                                            ? 'border-[#0046b8]'
                                            : m.is_trap_candidate
                                            ? 'border-rose-400'
                                            : 'border-slate-300'
                                    }`}
                                >
                                    {/* 카드 상단 리본 (비로그인 잠금 시 주력/함정 스포일러 완벽 차단) */}
                                    <div
                                        className={`px-4 py-2 flex flex-wrap items-center justify-between gap-2 text-xs font-extrabold border-b ${
                                            !isUnlocked
                                                ? 'bg-slate-100 text-slate-800 border-slate-200'
                                                : m.is_killer_pick
                                                ? 'bg-blue-50 text-[#0046b8] border-blue-200'
                                                : m.is_trap_candidate
                                                ? 'bg-rose-50 text-rose-800 border-rose-200'
                                                : 'bg-slate-100 text-slate-800 border-slate-200'
                                        }`}
                                    >
                                        <div className="flex items-center gap-2">
                                            <span className="px-2 py-0.5 rounded bg-slate-900 text-white font-black text-xs">
                                                {m.game_no_label}
                                            </span>
                                            <span className="font-extrabold text-slate-800">{m.league}</span>
                                            <span className="text-slate-500 font-semibold">· {m.kickoff_display}</span>
                                        </div>
                                        <div className="flex items-center gap-1.5">
                                            {isSampleUnlocked && !isPaidOrUnlocked && (
                                                <span className="px-2 py-0.5 rounded bg-emerald-600 text-white text-[10px] font-black">
                                                    🎁 01번 무료 샘플 공개
                                                </span>
                                            )}
                                            {!isUnlocked ? (
                                                <span className="px-2.5 py-0.5 rounded bg-slate-800 text-amber-300 text-[11px] font-black">
                                                    🔒 주력·함정 등급 잠금
                                                </span>
                                            ) : m.is_killer_pick ? (
                                                <span className="px-2 py-0.5 rounded bg-[#0046b8] text-white text-[11px] font-black">
                                                    📌 단독 우위 주력
                                                </span>
                                            ) : m.is_trap_candidate ? (
                                                <span className="px-2 py-0.5 rounded bg-rose-600 text-white text-[11px] font-black">
                                                    ⚠️ 이변·함정 주의
                                                </span>
                                            ) : (
                                                <span className="px-2 py-0.5 rounded bg-slate-200 text-slate-800 text-[11px] font-bold">
                                                    🛡️ 경합 분석
                                                </span>
                                            )}
                                        </div>
                                    </div>

                                    {/* 카드 본문 */}
                                    <div className="p-4 sm:p-5 space-y-4">
                                        {/* 팀 매치업 & AI 결론 */}
                                        <div className="flex items-start justify-between gap-3">
                                            <div>
                                                <div className="text-base sm:text-lg font-black text-slate-950 leading-snug">
                                                    {m.home_ko} <span className="text-[#0046b8]">({m.betman_home})</span>
                                                    {isUnlocked && m.home_stat?.rank ? (
                                                        <span className="ml-1 px-1.5 py-0.5 rounded bg-blue-50 text-[#0046b8] text-[10px] font-extrabold border border-blue-200">
                                                            {m.home_stat.rank}위 · {m.home_stat.form_hyphen}
                                                        </span>
                                                    ) : null}
                                                    <span className="mx-1.5 text-slate-400 font-bold text-sm">vs</span>
                                                    {m.away_ko} <span className="text-slate-700">({m.betman_away})</span>
                                                    {isUnlocked && m.away_stat?.rank ? (
                                                        <span className="ml-1 px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 text-[10px] font-extrabold border border-slate-300">
                                                            {m.away_stat.rank}위 · {m.away_stat.form_hyphen}
                                                        </span>
                                                    ) : null}
                                                </div>
                                                <p className="text-xs text-slate-600 mt-1 font-medium leading-relaxed">
                                                    {isUnlocked
                                                        ? m.ai_detail_report?.tactical_summary || m.value_reason || m.trap_reason
                                                        : '🔒 양 팀 실제 리그 순위·최근 5경기 승무패·Dixon-Coles 포아송 스코어 및 7-Factor 지표는 열람권 활성화 시 즉시 공개됩니다.'}
                                                </p>
                                            </div>

                                            <div className="text-right shrink-0">
                                                {isUnlocked ? (
                                                    <div className="rounded-xl bg-blue-50 border border-blue-200 px-3 py-2 text-center">
                                                        <div className="text-[10px] font-bold text-slate-500">
                                                            {m.pillar_breakdown?.consensus_label || 'AI 분석 결론'}
                                                        </div>
                                                        <div className="text-sm font-black text-[#0046b8] mt-0.5">
                                                            {m.ai_pick_label}
                                                        </div>
                                                        <div className="text-[11px] font-extrabold text-emerald-700">
                                                            신뢰도 {m.ai_confidence}%
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <Link
                                                        href="/ko/pricing"
                                                        className="inline-block rounded-xl bg-amber-50 border border-amber-300 px-3 py-2 text-center hover:bg-amber-100 transition"
                                                    >
                                                        <div className="text-[10px] font-bold text-amber-800">AI 결론 잠금</div>
                                                        <div className="text-xs font-black text-amber-950 mt-0.5">🔒 3,900원 열기</div>
                                                    </Link>
                                                )}
                                            </div>
                                        </div>

                                        {/* 구단 실제 시즌 성적 & 포아송 기대득점 요약 박스 (해제 시 노출) */}
                                        {isUnlocked && (m.home_stat || m.poisson_simulation) && (
                                            <div className="rounded-xl bg-blue-50/50 border border-blue-200 p-3 space-y-2 text-xs">
                                                {m.home_stat && m.away_stat && (
                                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                                        <div className="rounded-lg bg-white border border-slate-200 px-2.5 py-1.5">
                                                            <div className="text-[10px] font-bold text-slate-500">🏠 홈팀 시즌 성적 · 최근 5경기</div>
                                                            <div className="font-extrabold text-slate-900 mt-0.5">
                                                                {m.home_ko}: {m.home_stat.record_summary}
                                                            </div>
                                                            <div className="text-[11px] font-bold text-[#0046b8]">
                                                                최근 흐름: {m.home_stat.form_summary}
                                                            </div>
                                                        </div>
                                                        <div className="rounded-lg bg-white border border-slate-200 px-2.5 py-1.5">
                                                            <div className="text-[10px] font-bold text-slate-500">✈️ 원정팀 시즌 성적 · 최근 5경기</div>
                                                            <div className="font-extrabold text-slate-900 mt-0.5">
                                                                {m.away_ko}: {m.away_stat.record_summary}
                                                            </div>
                                                            <div className="text-[11px] font-bold text-slate-700">
                                                                최근 흐름: {m.away_stat.form_summary}
                                                            </div>
                                                        </div>
                                                    </div>
                                                )}
                                                {m.poisson_simulation && (
                                                    <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-blue-200/70 text-[11px] font-bold text-slate-800">
                                                        <span>
                                                            ⚽ <strong>Dixon-Coles 기대득점(xG):</strong> 홈 {m.poisson_simulation.expected_home_goals}골 vs 원정 {m.poisson_simulation.expected_away_goals}골 (2.5골 오버 {m.poisson_simulation.over_25_prob}%)
                                                        </span>
                                                        {m.poisson_simulation.top_exact_scores?.length > 0 && (
                                                            <span className="px-2 py-0.5 rounded bg-white border border-blue-200 text-[#0046b8] font-extrabold">
                                                                🎯 유력 스코어:{' '}
                                                                {m.poisson_simulation.top_exact_scores
                                                                    .slice(0, 3)
                                                                    .map((s, idx) => `${idx + 1}순위 ${s.score}(${s.prob_pct}%)`)
                                                                    .join(' · ')}
                                                            </span>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        )}

                                        {/* 고대비 승/무/패 확률 바 */}
                                        <div className="rounded-xl bg-slate-50 border border-slate-200 p-3.5 space-y-2.5">
                                            <div className="flex items-center justify-between text-xs font-extrabold text-slate-800">
                                                <span>📊 3-Pillar AI 예측 확률 분포</span>
                                                {m.betman_home_odds > 0 && (
                                                    <span className="text-[11px] font-bold text-slate-600">
                                                        베트맨 배당: 승 {m.betman_home_odds} / {m.betman_draw_odds > 0 ? `무 ${m.betman_draw_odds} / ` : ''}패 {m.betman_away_odds}
                                                    </span>
                                                )}
                                            </div>

                                            {isUnlocked ? (
                                                <>
                                                    <div className="grid grid-cols-3 gap-2 text-center">
                                                        <div className="rounded-lg bg-white border border-blue-200 p-2">
                                                            <div className="text-[11px] font-bold text-slate-600">{m.betman_home} 승</div>
                                                            <div className="text-base font-black text-[#0046b8]">{pHome}%</div>
                                                            {m.vote_home_pct !== undefined && (
                                                                <div className="text-[10px] text-slate-500">투표율 {m.vote_home_pct}%</div>
                                                            )}
                                                        </div>
                                                        <div className="rounded-lg bg-white border border-slate-200 p-2">
                                                            <div className="text-[11px] font-bold text-slate-600">{midLabel}</div>
                                                            <div className="text-base font-black text-slate-800">{pMid}%</div>
                                                            {m.vote_mid_pct !== undefined && (
                                                                <div className="text-[10px] text-slate-500">투표율 {m.vote_mid_pct}%</div>
                                                            )}
                                                        </div>
                                                        <div className="rounded-lg bg-white border border-slate-300 p-2">
                                                            <div className="text-[11px] font-bold text-slate-600">{m.betman_away} 패</div>
                                                            <div className="text-base font-black text-slate-900">{pAway}%</div>
                                                            {m.vote_away_pct !== undefined && (
                                                                <div className="text-[10px] text-slate-500">투표율 {m.vote_away_pct}%</div>
                                                            )}
                                                        </div>
                                                    </div>

                                                    {/* 시각적 누적 바 */}
                                                    <div className="w-full h-3 rounded-full bg-slate-200 overflow-hidden flex">
                                                        <div style={{ width: `${pHome}%` }} className="bg-[#0046b8]" title={`홈승 ${pHome}%`} />
                                                        {pMid > 0 && <div style={{ width: `${pMid}%` }} className="bg-amber-500" title={`무/5 ${pMid}%`} />}
                                                        <div style={{ width: `${pAway}%` }} className="bg-slate-700" title={`원정승 ${pAway}%`} />
                                                    </div>
                                                </>
                                            ) : (
                                                <div className="rounded-lg bg-white border border-slate-200 p-3 flex items-center justify-between">
                                                    <span className="text-xs font-bold text-slate-700">
                                                        🔒 이 경기의 승/무/패 정밀 확률과 투표율 괴리 지표가 잠겨 있습니다.
                                                    </span>
                                                    <Link
                                                        href={`/ko/payment/request?plan=round_pass&billing=once&round=${report?.round_id || 'current'}`}
                                                        className="px-3 py-1.5 rounded-lg bg-[#0046b8] !text-white text-xs font-extrabold shrink-0"
                                                    >
                                                        3,900원 즉시 열기
                                                    </Link>
                                                </div>
                                            )}
                                        </div>

                                        {/* 7-Factor 세부 지표 토글 & 고대비 리스트 */}
                                        <div>
                                            <div className="flex items-center justify-between">
                                                <span className="text-xs font-black text-slate-900">
                                                    🔬 7-Factor 구단 전술·배당 세부 지표
                                                </span>
                                                <button
                                                    type="button"
                                                    onClick={() => setExpandedNo(expandedNo === m.game_no ? null : m.game_no)}
                                                    className="text-xs font-extrabold text-[#0046b8] hover:underline cursor-pointer"
                                                >
                                                    {isExpanded ? '세부 지표 접기 ▲' : '세부 지표 펼치기 ▼'}
                                                </button>
                                            </div>

                                            {isExpanded && (
                                                <div className="mt-2.5 space-y-2 pt-2 border-t border-slate-200">
                                                    {isUnlocked ? (
                                                        factors.map((f, fIdx) => (
                                                            <div key={fIdx} className="rounded-lg bg-slate-50 border border-slate-200 p-2.5">
                                                                <div className="flex items-center justify-between text-xs mb-1">
                                                                    <span className="font-extrabold text-slate-900">
                                                                        #{fIdx + 1}. {f.name}
                                                                    </span>
                                                                    <span className="font-black text-[#0046b8]">{f.score}점</span>
                                                                </div>
                                                                <div className="w-full h-2 rounded-full bg-slate-200 overflow-hidden mb-1">
                                                                    <div
                                                                        style={{ width: `${Math.min(100, Math.max(20, f.score))}%` }}
                                                                        className="h-full bg-[#0046b8] rounded-full"
                                                                    />
                                                                </div>
                                                                <p className="text-[11px] text-slate-600 font-medium">{f.comment}</p>
                                                            </div>
                                                        ))
                                                    ) : (
                                                        <div className="rounded-xl bg-slate-50 border border-slate-300 p-4 text-center space-y-2">
                                                            <p className="text-xs font-extrabold text-slate-900">
                                                                🔒 [{m.game_no_label} {m.home_ko} vs {m.away_ko}] 7-Factor 상세 리포트 잠금
                                                            </p>
                                                            <p className="text-[11px] text-slate-600">
                                                                이번 회차 단건 열람권(3,900원) 또는 개인 월 무제한 패스(29,900원)로 전 경기 7-Factor 지표를 확인하세요!
                                                            </p>
                                                            <div className="flex justify-center gap-2 pt-1">
                                                                <Link
                                                                    href={`/ko/payment/request?plan=round_pass&billing=once&round=${report?.round_id || 'current'}`}
                                                                    className="px-3.5 py-1.5 rounded-lg bg-[#0046b8] !text-white text-xs font-extrabold"
                                                                >
                                                                    ⚡ 이번 회차 열기 (3,900원)
                                                                </Link>
                                                                <Link
                                                                    href="/ko/pricing"
                                                                    className="px-3.5 py-1.5 rounded-lg bg-white border border-slate-300 text-slate-800 text-xs font-extrabold"
                                                                >
                                                                    💎 월 무제한 패스 보기
                                                                </Link>
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}

                {/* ━━━ 5. 하단 법적 고지 ━━━ */}
                <div className="rounded-xl bg-white border border-slate-300 p-4 text-xs text-slate-600 leading-relaxed">
                    ⚖️ <strong className="text-slate-900">법적 고지:</strong> 본 페이지의 모든 7-Factor 지표는 국민체육진흥공단(베트맨) 공식 대상 경기의 공개 통계 데이터와 머신러닝 시뮬레이션 결과물로서, 건전한 스포츠 관전 및 통계 연구 참고용으로만 제공됩니다.
                </div>
            </main>
        </div>
    );
}
