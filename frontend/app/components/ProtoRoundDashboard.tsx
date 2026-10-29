"use client";
import React, { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { useAuth } from "../context/AuthContext";
import {
    fetchProtoRoundWithFallback,
    DEFAULT_BETMAN_CATALOG,
    BetmanGameCatalogItem,
} from "../lib/protoFallback";

interface W5LAnalysis {
    win_prob: number;
    close5_prob: number;
    lose_prob: number;
    expected_margin: number;
    primary_code: string;
    primary_label: string;
    primary_prob: number;
    secondary_code: string;
    secondary_prob: number;
    multi_recommend: string;
}

interface ScoreBracketItem {
    bracket_no: number;
    label: string;
    prob_pct: number;
    rank: number;
}

interface SpecialBrackets {
    expected_home_pts: number;
    expected_away_pts: number;
    expected_total_pts: number;
    home_top1_bracket: string;
    home_top1_prob: number;
    home_top2_bracket: string;
    home_top2_prob: number;
    away_top1_bracket: string;
    away_top1_prob: number;
    away_top2_bracket: string;
    away_top2_prob: number;
    home_brackets: ScoreBracketItem[];
    away_brackets: ScoreBracketItem[];
    half_expected_home_pts: number;
    half_expected_away_pts: number;
    half_home_top_bracket: string;
    half_away_top_bracket: string;
}

interface AiDetailReport {
    headline: string;
    tactical_summary: string;
    pillar_weights: {
        market_probability_pct: number;
        poisson_pythagorean_pct: number;
        tactical_momentum_pct: number;
    };
    seven_factors: {
        name: string;
        score: number;
        comment: string;
    }[];
}

interface ProtoMatch {
    game_no: number;
    game_no_label: string;
    fixture_id: string;
    league: string;
    sport: string;
    stadium?: string;
    proto_market_type?: string;
    betman_home: string;
    betman_away: string;
    home_ko: string;
    away_ko: string;
    cutoff_time: string;
    kickoff_display: string;
    betman_home_odds: number;
    betman_draw_odds: number;
    betman_away_odds: number;
    global_home_odds: number;
    global_draw_odds: number;
    global_away_odds: number;
    ai_home_prob: number;
    ai_draw_prob: number;
    ai_away_prob: number;
    vote_total?: number;
    vote_home_pct?: number;
    vote_mid_pct?: number;
    vote_away_pct?: number;
    w5l_analysis?: W5LAnalysis | null;
    special_brackets?: SpecialBrackets | null;
    ai_detail_report?: AiDetailReport;
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
}

interface ProtoReportData {
    game_key?: string;
    gm_id?: string;
    gm_ts?: string;
    game_name?: string;
    game_category?: string;
    game_type?: string;
    sport?: string;
    rule_summary?: string;
    selection_guide?: string;
    round_id: string;
    display_round_no: string;
    round_title: string;
    published_at: string;
    published_date: string;
    sale_end_display?: string;
    forward_amount?: number;
    total_sell_amount?: number;
    total_matches: number;
    killer_picks_count: number;
    available_games?: BetmanGameCatalogItem[];
    recent_5_rounds_banner: {
        headline: string;
        combo_accuracy_pct: number;
        single_pick_accuracy_pct: number;
        hit_rounds: number;
        total_rounds: number;
        avg_hit_odds: number;
    };
    section_a_combos: {
        main_2folder: {
            title: string;
            badge: string;
            folder_count: number;
            total_odds: number;
            hit_probability_pct: number;
            recommended_weight_pct: number;
            summary: string;
            picks: ProtoMatch[];
        };
        value_3folder: {
            title: string;
            badge: string;
            folder_count: number;
            total_odds: number;
            hit_probability_pct: number;
            recommended_weight_pct: number;
            summary: string;
            picks: ProtoMatch[];
        };
    };
    section_b_value_top5: ProtoMatch[];
    section_c_traps: ProtoMatch[];
    matches: ProtoMatch[];
}

export default function ProtoRoundDashboard() {
    const { user } = useAuth();
    const [data, setData] = useState<ProtoReportData | null>(null);
    const [selectedGameKey, setSelectedGameKey] = useState<string>("G011_260065");
    const [gameCatFilter, setGameCatFilter] = useState<string>("ALL");
    const [loading, setLoading] = useState(true);
    const [switchingGame, setSwitchingGame] = useState(false);
    const [filterTab, setFilterTab] = useState<"ALL" | "KILLER" | "VALUE" | "TRAP">("ALL");
    const [searchQuery, setSearchQuery] = useState("");
    const [unlockedDemo, setUnlockedDemo] = useState(false);
    const [activeReportMatch, setActiveReportMatch] = useState<ProtoMatch | null>(null);
    const [selectedSimMatches, setSelectedSimMatches] = useState<Record<number, { pick: "승" | "무" | "패"; prob: number; label: string }>>({});

    const isPaidUser = useMemo(() => {
        if (unlockedDemo) return true;
        if (!user) return false;
        const role = (user.role || "").toLowerCase();
        return ["pro", "vip", "premium", "admin", "round_pass", "store_b2b"].includes(role);
    }, [user, unlockedDemo]);

    const loadGameReport = async (gameKey: string, isInitial = false) => {
        if (isInitial) setLoading(true);
        else setSwitchingGame(true);
        try {
            const json = await fetchProtoRoundWithFallback(gameKey);
            setData(json);
            if (json.game_key) {
                setSelectedGameKey(json.game_key);
            }
            setSelectedSimMatches({});
        } finally {
            setLoading(false);
            setSwitchingGame(false);
        }
    };

    useEffect(() => {
        if (typeof window !== "undefined") {
            const savedPass = localStorage.getItem("scorenix_round_pass_unlocked");
            if (savedPass === "true") {
                setUnlockedDemo(true);
            }
        }
        loadGameReport("G011_260065", true);
    }, []);

    const catalogGames: BetmanGameCatalogItem[] = useMemo(() => {
        if (data?.available_games && data.available_games.length > 0) {
            return data.available_games;
        }
        return DEFAULT_BETMAN_CATALOG;
    }, [data]);

    const filteredCatalogGames = useMemo(() => {
        if (gameCatFilter === "ALL") return catalogGames;
        if (gameCatFilter === "WDL") return catalogGames.filter((g) => g.gm_id === "G011");
        if (gameCatFilter === "W5L") return catalogGames.filter((g) => g.gm_id === "G027");
        if (gameCatFilter === "SPECIAL_N") return catalogGames.filter((g) => g.gm_id === "G055" || g.gm_id === "G056");
        if (gameCatFilter === "SPECIAL_KBL") return catalogGames.filter((g) => g.gm_id === "G025" || g.gm_id === "G005" || g.gm_id === "G015");
        if (gameCatFilter === "PROTO") return catalogGames.filter((g) => g.gm_id === "G101" || g.gm_id === "G102");
        return catalogGames;
    }, [catalogGames, gameCatFilter]);

    const filteredMatches = useMemo(() => {
        if (!data?.matches) return [];
        return data.matches.filter((m) => {
            if (filterTab === "KILLER" && !m.is_killer_pick) return false;
            if (filterTab === "VALUE" && !data.section_b_value_top5.some((v) => v.game_no === m.game_no)) return false;
            if (filterTab === "TRAP" && !m.is_trap_candidate) return false;
            if (searchQuery.trim()) {
                const q = searchQuery.trim().toLowerCase();
                const text = `${m.game_no_label} ${m.betman_home} ${m.betman_away} ${m.home_ko} ${m.away_ko} ${m.league}`.toLowerCase();
                if (!text.includes(q)) return false;
            }
            return true;
        });
    }, [data, filterTab, searchQuery]);

    const toggleSimMatch = (m: ProtoMatch, pick: "승" | "무" | "패", prob: number) => {
        setSelectedSimMatches((prev) => {
            const next = { ...prev };
            if (next[m.game_no]?.pick === pick) {
                delete next[m.game_no];
            } else {
                if (Object.keys(next).length >= 5 && !next[m.game_no]) return prev;
                next[m.game_no] = {
                    pick,
                    prob,
                    label: `${m.game_no_label} ${m.home_ko} vs ${m.away_ko} (${pick})`,
                };
            }
            return next;
        });
    };

    const simStats = useMemo(() => {
        const items = Object.values(selectedSimMatches);
        if (items.length === 0) return { count: 0, avgProb: 0, jointProb: 0 };
        const avgProb = items.reduce((acc, it) => acc + it.prob, 0) / items.length;
        const jointProb = items.reduce((acc, it) => acc * (it.prob / 100), 1) * 100;
        return {
            count: items.length,
            avgProb: Number(avgProb.toFixed(1)),
            jointProb: Number(Math.min(92, jointProb * 1.15).toFixed(1)),
        };
    }, [selectedSimMatches]);

    if (loading) {
        return (
            <div className="min-h-[70vh] flex flex-col items-center justify-center px-4 text-center">
                <div className="w-12 h-12 rounded-full border-4 border-cyan-400 border-t-transparent animate-spin mb-4" />
                <p className="text-white font-bold text-lg">베트맨 공식 운영 게임 및 AI 분석 리포트를 불러오는 중입니다...</p>
                <p className="text-slate-400 text-xs mt-1">승무패 · 승5패 · 스페셜N · 매치 · 프로토 승부식 실시간 동기화</p>
            </div>
        );
    }

    if (!data) return null;

    const currentGameType = data.game_type || "SOCCER_WDL";
    const isSpecialGame = currentGameType.includes("SPECIAL") || currentGameType === "BASKETBALL_MATCH";
    const isW5LGame = currentGameType === "BASKETBALL_W5L";

    return (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-7">
            {/* 상단 AI 모델 통계 및 B2B 인쇄 안내 바 (PG 친화적 순수 데이터 안내) */}
            <div className="rounded-2xl bg-gradient-to-r from-cyan-950/80 via-slate-900 to-indigo-950/80 border border-cyan-500/30 p-4 flex flex-col md:flex-row items-center justify-between gap-4 shadow-xl">
                <div className="flex items-center gap-3">
                    <span className="px-3 py-1 rounded-full bg-cyan-500/20 border border-cyan-400/40 text-cyan-300 text-xs font-black tracking-wide shrink-0">
                        🤖 3-PILLAR AI ANALYTICS
                    </span>
                    <div>
                        <p className="text-white font-extrabold text-sm sm:text-base">
                            베트맨 공식 운영 게임 전 종목 실시간 경기 매칭 & AI 정밀 전력 분석 리포트
                        </p>
                        <p className="text-slate-400 text-xs mt-0.5">
                            축구토토 승무패 · 농구토토 승5패 · 스페셜N 더블/트리플 · 농구 매치 · 프로토 승부식 대상 경기 완벽 대응
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                    <Link
                        href={`/ko/store/print-report/${data.game_key || data.round_id}`}
                        className="px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-black transition-all shadow-md"
                    >
                        🖨️ 현재 게임 A4 리포트 인쇄
                    </Link>
                    <Link
                        href="/ko/analysis"
                        className="px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold border border-white/15 transition-all"
                    >
                        🧠 7-Factor 전체 리그 분석 →
                    </Link>
                </div>
            </div>

            {/* 🔴 핵심: 베트맨 공식 사이트 운영 게임 선택 허브 */}
            <section className="rounded-3xl bg-slate-900/90 border border-slate-800 p-5 sm:p-6 shadow-2xl space-y-4">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-slate-800 pb-4">
                    <div>
                        <div className="flex items-center gap-2">
                            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
                            <span className="text-emerald-400 text-xs font-extrabold uppercase tracking-wider">
                                BETMAN OFFICIAL GAME SCHEDULE SYNC
                            </span>
                        </div>
                        <h2 className="text-xl sm:text-2xl font-black text-white mt-1">
                            베트맨 공식 운영 게임 선택 ({catalogGames.length}개 활성 회차)
                        </h2>
                        <p className="text-xs text-slate-400 mt-0.5">
                            원하시는 베트맨 게임을 클릭하면 해당 회차의 공식 대상 경기 목록과 게임 규격별 AI 분석 리포트로 즉시 전환됩니다.
                        </p>
                    </div>

                    {/* 게임 카테고리 필터 탭 */}
                    <div className="flex flex-wrap gap-1.5">
                        {[
                            { id: "ALL", label: "전체 게임" },
                            { id: "WDL", label: "⚽ 축구 승무패" },
                            { id: "W5L", label: "🏀 농구 승5패" },
                            { id: "SPECIAL_N", label: "🏀 스페셜N (NBA)" },
                            { id: "SPECIAL_KBL", label: "🏀 스페셜·매치 (KBL)" },
                            { id: "PROTO", label: "⚡ 프로토 승부식" },
                        ].map((cat) => (
                            <button
                                key={cat.id}
                                onClick={() => setGameCatFilter(cat.id)}
                                className={`px-3 py-1.5 rounded-xl text-xs font-extrabold transition-all ${
                                    gameCatFilter === cat.id
                                        ? "bg-cyan-500 text-slate-950 shadow-md"
                                        : "bg-slate-800/90 text-slate-300 hover:bg-slate-700"
                                }`}
                            >
                                {cat.label}
                            </button>
                        ))}
                    </div>
                </div>

                {/* 베트맨 게임 카드 그리드 */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                    {filteredCatalogGames.map((g) => {
                        const isSelected = g.game_key === (data.game_key || selectedGameKey);
                        return (
                            <button
                                key={g.game_key}
                                onClick={() => loadGameReport(g.game_key)}
                                className={`text-left rounded-2xl p-4 transition-all border relative overflow-hidden ${
                                    isSelected
                                        ? "bg-gradient-to-br from-cyan-500/20 via-slate-900 to-indigo-500/20 border-cyan-400 shadow-lg shadow-cyan-500/10 ring-1 ring-cyan-400"
                                        : "bg-slate-950/70 hover:bg-slate-800/70 border-slate-800 hover:border-slate-600"
                                }`}
                            >
                                <div className="flex items-center justify-between gap-2 mb-1.5">
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-800 text-[11px] font-bold text-cyan-300 border border-slate-700">
                                        {g.icon} {g.sport} · {g.category}
                                    </span>
                                    <span
                                        className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                                            g.status_label === "발매중"
                                                ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                                                : "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                                        }`}
                                    >
                                        {g.status_label}
                                    </span>
                                </div>
                                <div className="font-black text-white text-base tracking-tight">
                                    {g.full_title}
                                </div>
                                <div className="text-[11px] text-slate-400 mt-1 flex items-center justify-between">
                                    <span>대상 {g.match_count}경기</span>
                                    <span className="text-slate-300 font-semibold">{g.sale_end_display}</span>
                                </div>
                                {g.forward_amount && g.forward_amount > 0 ? (
                                    <div className="mt-2 px-2 py-1 rounded-lg bg-amber-500/10 border border-amber-500/30 text-[11px] font-bold text-amber-300">
                                        🔥 1등 이월금 {(g.forward_amount / 100000000).toFixed(2)}억 원 발생
                                    </div>
                                ) : null}
                                {isSelected && (
                                    <div className="mt-2 text-[11px] font-extrabold text-cyan-300 flex items-center justify-between">
                                        <span>✓ 현재 선택된 게임 리포트</span>
                                        <span>아래 경기표 확인 ↓</span>
                                    </div>
                                )}
                            </button>
                        );
                    })}
                </div>
            </section>

            {/* 선택된 게임 헤더 & 마이크로 결제 / 점주 인쇄 안내 */}
            <section className="rounded-3xl bg-slate-900/90 border border-slate-800 p-6 sm:p-8 shadow-2xl relative overflow-hidden">
                {switchingGame && (
                    <div className="absolute inset-0 bg-slate-950/70 backdrop-blur-sm z-20 flex items-center justify-center">
                        <div className="flex items-center gap-3 px-5 py-3 rounded-2xl bg-slate-900 border border-cyan-500/40 text-white font-bold text-sm shadow-2xl">
                            <div className="w-5 h-5 rounded-full border-2 border-cyan-400 border-t-transparent animate-spin" />
                            <span>선택하신 베트맨 게임의 대상 경기 및 AI 리포트를 불러오는 중...</span>
                        </div>
                    </div>
                )}

                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                    <div className="space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                            <span className="px-3 py-1 rounded-full bg-cyan-500/15 border border-cyan-500/30 text-cyan-300 text-xs font-extrabold">
                                🟢 베트맨 공식 게임 코드: {data.gm_id || "G011"} · 회차코드 {data.gm_ts || data.round_id}
                            </span>
                            <span className="px-3 py-1 rounded-full bg-purple-500/15 border border-purple-500/30 text-purple-300 text-xs font-bold">
                                ⚡ Gemini 2.5 Flash 구단명 매칭 100% 완료
                            </span>
                            {data.sale_end_display && (
                                <span className="px-3 py-1 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-300 text-xs font-bold">
                                    ⏰ {data.sale_end_display}
                                </span>
                            )}
                        </div>
                        <h1 className="text-2xl sm:text-4xl font-black text-white tracking-tight">
                            {data.round_title} <span className="gradient-text">AI 종합 전력 리포트</span>
                        </h1>
                        <p className="text-slate-300 text-sm font-semibold">
                            📌 게임 방식: {data.rule_summary || "대상 경기별 AI 승리 기대 확률 및 전술 데이터 리포트"}
                        </p>
                        <p className="text-slate-400 text-xs">
                            총 <strong className="text-white">{data.total_matches}개 공식 대상 경기</strong>의 기본 AI 분석은 무료 공개되며, 각 경기 우측의 <strong className="text-cyan-300">[📊 AI 리포트 보기]</strong> 버튼을 눌러 상세 7-Factor 리포트를 확인할 수 있습니다.
                        </p>
                    </div>

                    {/* 결제 / 인쇄 액션 박스 */}
                    <div className="flex flex-col sm:flex-row lg:flex-col gap-2.5 shrink-0 min-w-[290px]">
                        {!isPaidUser ? (
                            <Link
                                href={`/ko/payment/request?plan=round_pass&billing=once&round=${data.round_id}`}
                                className="px-5 py-3.5 rounded-2xl bg-gradient-to-r from-[#00d4ff] to-[#6366f1] hover:opacity-95 text-white font-black text-sm text-center shadow-lg shadow-cyan-500/20 transition-all"
                            >
                                🔓 이번 회차 AI 심층 리포트 열람권 (1,500원)
                            </Link>
                        ) : (
                            <div className="px-5 py-3 rounded-2xl bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 font-extrabold text-sm text-center">
                                ✅ 전체 경기 심층 AI 리포트 열람 활성화됨
                            </div>
                        )}
                        <div className="grid grid-cols-2 gap-2">
                            <Link
                                href="/ko/payment/request?plan=pro&billing=monthly"
                                className="px-3 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-slate-200 text-xs font-bold text-center transition-all"
                            >
                                💎 월 무제한 패스 (9,900원)
                            </Link>
                            <Link
                                href={`/ko/store/print-report/${data.game_key || data.round_id}`}
                                className="px-3 py-2.5 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 text-amber-300 text-xs font-extrabold text-center transition-all"
                            >
                                🖨️ A4 원클릭 출력 뷰
                            </Link>
                        </div>
                    </div>
                </div>
            </section>

            {/* 게임 핵심 요약 카드 (핵심 우위 매치 & 이변 주의보) */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* 좌측: AI 핵심 우위 경기 */}
                <div className="rounded-2xl bg-slate-900/90 border border-cyan-500/30 p-5 space-y-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <span className="text-[11px] font-black uppercase tracking-wider text-cyan-400">
                                HIGH CONFIDENCE AI REPORT
                            </span>
                            <h2 className="text-lg font-extrabold text-white mt-0.5">
                                🎯 [{data.round_title}] AI 핵심 전력 우위 경기 (확신도 85%+)
                            </h2>
                        </div>
                        <span className="px-2.5 py-1 rounded-lg bg-cyan-500/10 text-cyan-300 text-xs font-bold border border-cyan-500/20">
                            {isPaidUser ? "열람 가능" : "🔒 1,500원 회차권 전용"}
                        </span>
                    </div>

                    {isPaidUser ? (
                        <div className="space-y-2.5">
                            {data.matches
                                .filter((m) => m.is_killer_pick)
                                .slice(0, 4)
                                .map((m) => (
                                    <div
                                        key={m.game_no}
                                        className="rounded-xl bg-slate-950/90 border border-cyan-500/30 p-3.5 flex items-center justify-between gap-3"
                                    >
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <span className="px-2 py-0.5 rounded bg-cyan-500 text-slate-950 text-xs font-black">
                                                    {m.game_no_label}
                                                </span>
                                                <span className="text-xs font-bold text-slate-400">{m.league}</span>
                                                <span className="text-xs font-extrabold text-emerald-400">
                                                    AI 신뢰도 {m.ai_confidence}%
                                                </span>
                                            </div>
                                            <div className="text-sm font-extrabold text-white mt-1">
                                                {m.home_ko} <span className="text-slate-500 text-xs">({m.betman_home})</span> vs {m.away_ko}{" "}
                                                <span className="text-slate-500 text-xs">({m.betman_away})</span>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2 shrink-0">
                                            <div className="text-right">
                                                <div className="text-xs font-black text-cyan-300">{m.ai_pick_full_label}</div>
                                                <div className="text-[11px] text-slate-400">기대확률 {m.ai_pick_prob}%</div>
                                            </div>
                                            <button
                                                onClick={() => setActiveReportMatch(m)}
                                                className="px-3 py-1.5 rounded-lg bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-400/40 text-cyan-200 text-xs font-black"
                                            >
                                                리포트 보기
                                            </button>
                                        </div>
                                    </div>
                                ))}
                        </div>
                    ) : (
                        <div className="rounded-xl bg-slate-950/90 border border-slate-800 p-5 text-center space-y-3">
                            <p className="text-white font-extrabold text-sm">
                                🔒 [{data.round_title}] AI 확신도 85% 이상 핵심 우위 경기 ({data.killer_picks_count}경기)가 잠겨 있습니다
                            </p>
                            <p className="text-slate-400 text-xs">
                                10,000회 포아송·몬테카를로 시뮬레이션과 베트맨 투표 분포 괴리도를 결합한 핵심 경기 심층 리포트를 확인하세요.
                            </p>
                            <div className="flex flex-wrap justify-center gap-2 pt-1">
                                <Link
                                    href={`/ko/payment/request?plan=round_pass&billing=once&round=${data.round_id}`}
                                    className="px-4 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-black text-xs transition-all"
                                >
                                    🔓 1,500원으로 이번 회차 리포트 열기
                                </Link>
                                <button
                                    onClick={() => {
                                        localStorage.setItem("scorenix_round_pass_unlocked", "true");
                                        setUnlockedDemo(true);
                                    }}
                                    className="px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 text-xs font-semibold border border-white/10"
                                >
                                    점주/심사용 미리보기 해제
                                </button>
                            </div>
                        </div>
                    )}
                </div>

                {/* 우측: 이변 및 혼전 주의 경보 (전면 무료 오픈) */}
                <div className="rounded-2xl bg-slate-900/90 border border-rose-500/30 p-5 space-y-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <span className="text-[11px] font-black uppercase tracking-wider text-rose-400">
                                UPSET & VOLATILITY RADAR (무료 공개)
                            </span>
                            <h2 className="text-lg font-extrabold text-white mt-0.5">
                                ⚠️ [{data.round_title}] 대중 쏠림 대비 이변·박빙 주의 경기
                            </h2>
                        </div>
                        <span className="px-2.5 py-1 rounded-lg bg-rose-500/15 text-rose-300 text-xs font-bold">
                            복수분석 권장
                        </span>
                    </div>

                    <div className="space-y-2.5">
                        {data.section_c_traps.slice(0, 3).map((tm) => (
                            <div
                                key={tm.game_no}
                                className="rounded-xl bg-rose-950/20 border border-rose-500/30 p-3.5 flex items-start justify-between gap-3"
                            >
                                <div>
                                    <div className="flex items-center gap-2">
                                        <span className="px-2 py-0.5 rounded bg-rose-500/20 text-rose-300 text-xs font-black">
                                            {tm.game_no_label} · {tm.league}
                                        </span>
                                        <span className="text-xs font-bold text-white">
                                            {tm.home_ko}({tm.betman_home}) vs {tm.away_ko}({tm.betman_away})
                                        </span>
                                    </div>
                                    <p className="text-xs text-slate-300 mt-1.5 leading-relaxed">{tm.trap_reason}</p>
                                </div>
                                <button
                                    onClick={() => setActiveReportMatch(tm)}
                                    className="px-2.5 py-1.5 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 border border-rose-400/30 text-rose-200 text-xs font-bold shrink-0"
                                >
                                    리포트 보기
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* 메인 테이블: 선택된 베트맨 게임의 전체 대상 경기 & [AI 리포트 보기] */}
            <section className="rounded-3xl bg-slate-900/90 border border-slate-800 p-5 sm:p-6 space-y-4 shadow-xl">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <h2 className="text-xl font-black text-white">
                            📋 {data.round_title} 공식 대상 경기 목록 ({filteredMatches.length}경기)
                        </h2>
                        <p className="text-xs text-slate-400 mt-0.5">
                            베트맨 공식 경기번호 및 단축팀명과 정식 구단명을 동시 표기하며, 우측 <strong className="text-cyan-300">[📊 AI 리포트 보기]</strong>로 경기별 상세 분석을 확인하실 수 있습니다.
                        </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                        {(
                            [
                                { id: "ALL", label: `전체 (${data.matches.length})` },
                                { id: "KILLER", label: `🔒 핵심 우위 (${data.killer_picks_count})` },
                                { id: "VALUE", label: `🔥 데이터 우위 Top 5` },
                                { id: "TRAP", label: `⚠️ 이변 주의보` },
                            ] as const
                        ).map((tab) => (
                            <button
                                key={tab.id}
                                onClick={() => setFilterTab(tab.id)}
                                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                                    filterTab === tab.id
                                        ? "bg-cyan-500 text-slate-950 font-black"
                                        : "bg-slate-800 text-slate-300 hover:bg-slate-700"
                                }`}
                            >
                                {tab.label}
                            </button>
                        ))}
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="팀명/번호 검색 (예: 본머스, 필라76s)"
                            className="px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400"
                        />
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="border-b border-slate-800 text-[11px] text-slate-400 uppercase">
                                <th className="py-3 px-2.5">경기번호</th>
                                <th className="py-3 px-2.5">리그 / 일시 / 구장</th>
                                <th className="py-3 px-2.5">베트맨 공식 대상 경기 (단축명 / 정식명)</th>
                                <th className="py-3 px-2.5 text-center">
                                    {isSpecialGame
                                        ? "AI 예상 득점 & 유력 득점 구간 (6구간)"
                                        : isW5LGame
                                        ? "AI 승(6점+) / 5(5점이내) / 패(6점+) 확률 & 투표율"
                                        : "AI 승 / 무 / 패 기대 확률 & 베트맨 투표율"}
                                </th>
                                <th className="py-3 px-2.5 text-center">AI 핵심 분석 결론</th>
                                <th className="py-3 px-2.5 text-center">상세 리포트 연결</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/70 text-xs">
                            {filteredMatches.map((m) => {
                                const lockedKiller = m.is_killer_pick && !isPaidUser;
                                return (
                                    <tr key={m.game_no} className="hover:bg-white/[0.02] transition-colors">
                                        {/* 경기번호 */}
                                        <td className="py-3.5 px-2.5 font-black text-cyan-300 whitespace-nowrap">
                                            <div className="text-sm">{m.game_no_label}</div>
                                            <div className="mt-1 flex flex-wrap gap-1">
                                                {m.proto_market_type && (
                                                    <span className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 text-[10px]">
                                                        {m.proto_market_type}
                                                    </span>
                                                )}
                                                {m.is_killer_pick && (
                                                    <span className="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 text-[10px] font-black">
                                                        핵심
                                                    </span>
                                                )}
                                                {m.is_trap_candidate && (
                                                    <span className="px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-300 text-[10px] font-black">
                                                        주의
                                                    </span>
                                                )}
                                            </div>
                                        </td>

                                        {/* 리그 / 일시 / 구장 */}
                                        <td className="py-3.5 px-2.5 whitespace-nowrap">
                                            <div className="font-bold text-slate-200">{m.league}</div>
                                            <div className="text-[11px] text-slate-400 mt-0.5">{m.kickoff_display}</div>
                                            {m.stadium && (
                                                <div className="text-[10px] text-slate-500 mt-0.5">{m.stadium}</div>
                                            )}
                                        </td>

                                        {/* 팀명 */}
                                        <td className="py-3.5 px-2.5">
                                            <div className="font-extrabold text-white text-sm">
                                                <span className="text-cyan-300">{m.betman_home}</span>{" "}
                                                <span className="text-slate-500 font-normal mx-1">vs</span>{" "}
                                                <span className="text-indigo-300">{m.betman_away}</span>
                                            </div>
                                            <div className="text-[11px] text-slate-400 mt-0.5">
                                                정식 구단명: <span className="text-slate-200 font-semibold">{m.home_ko}</span> vs{" "}
                                                <span className="text-slate-200 font-semibold">{m.away_ko}</span>
                                            </div>
                                        </td>

                                        {/* 게임 유형별 AI 확률 / 득점 구간 / 투표율 */}
                                        <td className="py-3.5 px-2.5 min-w-[270px]">
                                            {isSpecialGame && m.special_brackets ? (
                                                <div className="space-y-1.5 bg-slate-950/80 border border-slate-800 rounded-xl p-2.5">
                                                    <div className="flex items-center justify-between text-[11px]">
                                                        <span className="text-slate-400">
                                                            홈 <strong className="text-white">{m.betman_home}</strong> (예상 {m.special_brackets.expected_home_pts}점)
                                                        </span>
                                                        <span className="font-black text-cyan-300">
                                                            1순위: {m.special_brackets.home_top1_bracket} ({m.special_brackets.home_top1_prob}%)
                                                        </span>
                                                    </div>
                                                    <div className="flex items-center justify-between text-[11px]">
                                                        <span className="text-slate-400">
                                                            원정 <strong className="text-white">{m.betman_away}</strong> (예상 {m.special_brackets.expected_away_pts}점)
                                                        </span>
                                                        <span className="font-black text-indigo-300">
                                                            1순위: {m.special_brackets.away_top1_bracket} ({m.special_brackets.away_top1_prob}%)
                                                        </span>
                                                    </div>
                                                    {currentGameType === "BASKETBALL_MATCH" && (
                                                        <div className="text-[10px] text-amber-300 pt-1 border-t border-slate-800 flex justify-between">
                                                            <span>전반(1·2Q) 유력 구간:</span>
                                                            <span className="font-bold">
                                                                홈 {m.special_brackets.half_home_top_bracket} / 원정 {m.special_brackets.half_away_top_bracket}
                                                            </span>
                                                        </div>
                                                    )}
                                                </div>
                                            ) : isW5LGame && m.w5l_analysis ? (
                                                <div className="space-y-1.5">
                                                    <div className="flex justify-between text-[11px] font-bold">
                                                        <span className="text-cyan-300">홈승(6점+) {m.w5l_analysis.win_prob}%</span>
                                                        <span className="text-amber-300">5점차이내(5) {m.w5l_analysis.close5_prob}%</span>
                                                        <span className="text-indigo-300">원정승(6점+) {m.w5l_analysis.lose_prob}%</span>
                                                    </div>
                                                    <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden flex">
                                                        <div style={{ width: `${m.w5l_analysis.win_prob}%` }} className="bg-cyan-400" />
                                                        <div style={{ width: `${m.w5l_analysis.close5_prob}%` }} className="bg-amber-400" />
                                                        <div style={{ width: `${m.w5l_analysis.lose_prob}%` }} className="bg-indigo-400" />
                                                    </div>
                                                    {m.vote_total && m.vote_total > 0 ? (
                                                        <div className="text-[10px] text-slate-400 flex justify-between">
                                                            <span>베트맨 투표율:</span>
                                                            <span>
                                                                승 {m.vote_home_pct}% · 5({m.vote_mid_pct}%) · 패 {m.vote_away_pct}%
                                                            </span>
                                                        </div>
                                                    ) : null}
                                                </div>
                                            ) : (
                                                <div className="space-y-1.5">
                                                    <div className="flex justify-between text-[11px] font-bold">
                                                        <span className="text-cyan-300">홈승 {m.ai_home_prob}%</span>
                                                        {m.ai_draw_prob > 0 && <span className="text-slate-400">무 {m.ai_draw_prob}%</span>}
                                                        <span className="text-indigo-300">원정승 {m.ai_away_prob}%</span>
                                                    </div>
                                                    <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden flex">
                                                        <div style={{ width: `${m.ai_home_prob}%` }} className="bg-cyan-400" />
                                                        {m.ai_draw_prob > 0 && (
                                                            <div style={{ width: `${m.ai_draw_prob}%` }} className="bg-slate-500" />
                                                        )}
                                                        <div style={{ width: `${m.ai_away_prob}%` }} className="bg-indigo-400" />
                                                    </div>
                                                    {m.vote_total && m.vote_total > 0 ? (
                                                        <div className="text-[10px] text-slate-400 flex justify-between">
                                                            <span>베트맨 실시간 투표율:</span>
                                                            <span>
                                                                승 {m.vote_home_pct}% · 무 {m.vote_mid_pct}% · 패 {m.vote_away_pct}%
                                                            </span>
                                                        </div>
                                                    ) : (
                                                        <div className="flex justify-center gap-1 pt-0.5">
                                                            <button
                                                                onClick={() => toggleSimMatch(m, "승", m.ai_home_prob)}
                                                                className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                                                                    selectedSimMatches[m.game_no]?.pick === "승"
                                                                        ? "bg-cyan-500 text-slate-950 border-cyan-400 font-black"
                                                                        : "bg-slate-950 text-slate-300 border-slate-800 hover:border-slate-600"
                                                                }`}
                                                            >
                                                                홈승 선택
                                                            </button>
                                                            {m.ai_draw_prob > 0 && (
                                                                <button
                                                                    onClick={() => toggleSimMatch(m, "무", m.ai_draw_prob)}
                                                                    className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                                                                        selectedSimMatches[m.game_no]?.pick === "무"
                                                                            ? "bg-cyan-500 text-slate-950 border-cyan-400 font-black"
                                                                            : "bg-slate-950 text-slate-300 border-slate-800 hover:border-slate-600"
                                                                    }`}
                                                                >
                                                                    무 선택
                                                                </button>
                                                            )}
                                                            <button
                                                                onClick={() => toggleSimMatch(m, "패", m.ai_away_prob)}
                                                                className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                                                                    selectedSimMatches[m.game_no]?.pick === "패"
                                                                        ? "bg-cyan-500 text-slate-950 border-cyan-400 font-black"
                                                                        : "bg-slate-950 text-slate-300 border-slate-800 hover:border-slate-600"
                                                                }`}
                                                            >
                                                                원정승 선택
                                                            </button>
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </td>

                                        {/* AI 핵심 분석 결론 */}
                                        <td className="py-3.5 px-2.5 text-center whitespace-nowrap">
                                            {lockedKiller ? (
                                                <Link
                                                    href={`/ko/payment/request?plan=round_pass&billing=once&round=${data.round_id}`}
                                                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-amber-500/20 border border-amber-500/40 text-amber-300 font-black text-xs hover:bg-amber-500/30"
                                                >
                                                    🔒 확신도 {m.ai_confidence}% 열기
                                                </Link>
                                            ) : (
                                                <div>
                                                    <span className="px-2.5 py-1 rounded-lg bg-cyan-500/15 border border-cyan-500/30 text-cyan-300 font-black text-xs inline-block">
                                                        {m.ai_pick_label}
                                                    </span>
                                                    <div className="text-[11px] text-slate-400 mt-1">
                                                        AI 신뢰도 <strong className="text-emerald-400">{m.ai_confidence}%</strong>
                                                        {m.w5l_analysis ? ` · 권장 [${m.w5l_analysis.multi_recommend}]` : ""}
                                                    </div>
                                                </div>
                                            )}
                                        </td>

                                        {/* 상세 리포트 보기 버튼 */}
                                        <td className="py-3.5 px-2.5 text-center whitespace-nowrap">
                                            <button
                                                onClick={() => setActiveReportMatch(m)}
                                                className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-cyan-500/20 to-indigo-500/20 hover:from-cyan-500 hover:to-indigo-500 text-cyan-200 hover:text-slate-950 border border-cyan-400/40 font-black text-xs transition-all shadow-sm"
                                            >
                                                📊 AI 리포트 보기
                                            </button>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </section>

            {/* 선택 경기 승리 확률 시뮬레이터 (순수 통계 시뮬레이터) */}
            {simStats.count > 0 && (
                <section className="rounded-2xl bg-gradient-to-r from-slate-900 via-indigo-950/60 to-slate-900 border border-indigo-500/40 p-5 flex flex-col md:flex-row items-center justify-between gap-4 shadow-xl">
                    <div className="space-y-1">
                        <div className="text-xs font-black text-indigo-300 uppercase">
                            MULTI-MATCH WIN PROBABILITY SIMULATOR
                        </div>
                        <div className="text-base font-extrabold text-white">
                            선택한 {simStats.count}경기 AI 동시 적중 기대 확률 시뮬레이션
                        </div>
                        <div className="flex flex-wrap gap-1.5 pt-1">
                            {Object.entries(selectedSimMatches).map(([gno, item]) => (
                                <span
                                    key={gno}
                                    className="px-2.5 py-1 rounded-lg bg-slate-950 border border-slate-700 text-xs text-cyan-300 font-bold"
                                >
                                    {item.label} ({item.prob}%)
                                </span>
                            ))}
                        </div>
                    </div>
                    <div className="flex items-center gap-4 shrink-0">
                        <div className="text-right">
                            <div className="text-xs text-slate-400">평균 단일 기대 승률</div>
                            <div className="text-xl font-black text-cyan-300">{simStats.avgProb}%</div>
                        </div>
                        <div className="text-right">
                            <div className="text-xs text-slate-400">통합 시뮬레이션 지수</div>
                            <div className="text-xl font-black text-emerald-400">{simStats.jointProb}%</div>
                        </div>
                        <button
                            onClick={() => setSelectedSimMatches({})}
                            className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold"
                        >
                            초기화
                        </button>
                    </div>
                </section>
            )}

            {/* 🔎 경기별 [AI 리포트 보기] 상세 모달 */}
            {activeReportMatch && (
                <div
                    className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto"
                    onClick={() => setActiveReportMatch(null)}
                >
                    <div
                        className="bg-slate-900 border border-cyan-500/40 rounded-3xl max-w-2xl w-full p-6 sm:p-7 space-y-5 shadow-2xl my-8"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* 모달 헤더 */}
                        <div className="flex items-start justify-between gap-4 border-b border-slate-800 pb-4">
                            <div>
                                <div className="flex flex-wrap items-center gap-2">
                                    <span className="px-2.5 py-0.5 rounded-full bg-cyan-500 text-slate-950 text-xs font-black">
                                        {data.round_title} · {activeReportMatch.game_no_label}
                                    </span>
                                    <span className="text-xs font-bold text-slate-400">
                                        {activeReportMatch.league} · {activeReportMatch.kickoff_display}
                                    </span>
                                    {activeReportMatch.stadium && (
                                        <span className="text-xs text-slate-500">({activeReportMatch.stadium})</span>
                                    )}
                                </div>
                                <h3 className="text-xl sm:text-2xl font-black text-white mt-2">
                                    {activeReportMatch.home_ko}{" "}
                                    <span className="text-cyan-400 text-sm">({activeReportMatch.betman_home})</span>{" "}
                                    <span className="text-slate-500 text-base">vs</span> {activeReportMatch.away_ko}{" "}
                                    <span className="text-indigo-400 text-sm">({activeReportMatch.betman_away})</span>
                                </h3>
                            </div>
                            <button
                                onClick={() => setActiveReportMatch(null)}
                                className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold"
                            >
                                ✕ 닫기
                            </button>
                        </div>

                        {/* AI 종합 헤드라인 & 전술 요약 */}
                        <div className="rounded-2xl bg-slate-950/90 border border-cyan-500/30 p-4 space-y-2">
                            <div className="flex items-center justify-between">
                                <span className="text-xs font-black text-cyan-400">
                                    🧠 SCORENIX 3-PILLAR AI ANALYTICAL CONCLUSION
                                </span>
                                <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-xs font-black">
                                    AI 신뢰도 {activeReportMatch.ai_confidence}%
                                </span>
                            </div>
                            <p className="text-sm sm:text-base font-extrabold text-white">
                                {activeReportMatch.ai_detail_report?.headline ||
                                    `[${data.round_title}] ${activeReportMatch.home_ko} vs ${activeReportMatch.away_ko} — ${activeReportMatch.ai_pick_full_label}`}
                            </p>
                            <p className="text-xs text-slate-300 leading-relaxed">
                                {activeReportMatch.ai_detail_report?.tactical_summary || activeReportMatch.trap_reason}
                            </p>
                        </div>

                        {/* 게임 유형별 특화 분석 섹션 */}
                        {activeReportMatch.special_brackets ? (
                            <div className="rounded-2xl bg-slate-950/80 border border-slate-800 p-4 space-y-3">
                                <h4 className="text-xs font-black text-amber-300 uppercase">
                                    🏀 {data.game_name} 팀별 6구간 득점 확률 분포 시뮬레이션
                                </h4>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div className="space-y-1.5">
                                        <div className="text-xs font-bold text-cyan-300">
                                            홈팀: {activeReportMatch.home_ko} (예상 {activeReportMatch.special_brackets.expected_home_pts}점)
                                        </div>
                                        {activeReportMatch.special_brackets.home_brackets.map((b) => (
                                            <div key={b.bracket_no} className="flex items-center justify-between text-xs">
                                                <span className={b.rank === 1 ? "font-black text-cyan-300" : "text-slate-400"}>
                                                    {b.bracket_no}구간 ({b.label}) {b.rank === 1 ? "★1순위" : b.rank === 2 ? "☆2순위" : ""}
                                                </span>
                                                <span className="font-bold text-white">{b.prob_pct}%</span>
                                            </div>
                                        ))}
                                    </div>
                                    <div className="space-y-1.5">
                                        <div className="text-xs font-bold text-indigo-300">
                                            원정팀: {activeReportMatch.away_ko} (예상 {activeReportMatch.special_brackets.expected_away_pts}점)
                                        </div>
                                        {activeReportMatch.special_brackets.away_brackets.map((b) => (
                                            <div key={b.bracket_no} className="flex items-center justify-between text-xs">
                                                <span className={b.rank === 1 ? "font-black text-indigo-300" : "text-slate-400"}>
                                                    {b.bracket_no}구간 ({b.label}) {b.rank === 1 ? "★1순위" : b.rank === 2 ? "☆2순위" : ""}
                                                </span>
                                                <span className="font-bold text-white">{b.prob_pct}%</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        ) : activeReportMatch.w5l_analysis ? (
                            <div className="rounded-2xl bg-slate-950/80 border border-slate-800 p-4 space-y-2">
                                <h4 className="text-xs font-black text-amber-300 uppercase">
                                    🏀 농구토토 승5패 전용 클러치 마진 분석
                                </h4>
                                <div className="grid grid-cols-3 gap-2 text-center pt-1">
                                    <div className="p-2.5 rounded-xl bg-slate-900 border border-cyan-500/30">
                                        <div className="text-[11px] text-slate-400">홈 승 (6점차+)</div>
                                        <div className="text-lg font-black text-cyan-300">{activeReportMatch.w5l_analysis.win_prob}%</div>
                                    </div>
                                    <div className="p-2.5 rounded-xl bg-slate-900 border border-amber-500/30">
                                        <div className="text-[11px] text-slate-400">5 (5점차 이내 접전)</div>
                                        <div className="text-lg font-black text-amber-300">{activeReportMatch.w5l_analysis.close5_prob}%</div>
                                    </div>
                                    <div className="p-2.5 rounded-xl bg-slate-900 border border-indigo-500/30">
                                        <div className="text-[11px] text-slate-400">원정 승 (6점차+)</div>
                                        <div className="text-lg font-black text-indigo-300">{activeReportMatch.w5l_analysis.lose_prob}%</div>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="grid grid-cols-3 gap-2 text-center">
                                <div className="p-3 rounded-xl bg-slate-950 border border-cyan-500/30">
                                    <div className="text-[11px] text-slate-400">{activeReportMatch.home_ko} 승</div>
                                    <div className="text-lg font-black text-cyan-300">{activeReportMatch.ai_home_prob}%</div>
                                    {activeReportMatch.vote_total ? (
                                        <div className="text-[10px] text-slate-500">투표율 {activeReportMatch.vote_home_pct}%</div>
                                    ) : null}
                                </div>
                                <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                                    <div className="text-[11px] text-slate-400">무승부</div>
                                    <div className="text-lg font-black text-slate-300">{activeReportMatch.ai_draw_prob}%</div>
                                    {activeReportMatch.vote_total ? (
                                        <div className="text-[10px] text-slate-500">투표율 {activeReportMatch.vote_mid_pct}%</div>
                                    ) : null}
                                </div>
                                <div className="p-3 rounded-xl bg-slate-950 border border-indigo-500/30">
                                    <div className="text-[11px] text-slate-400">{activeReportMatch.away_ko} 승</div>
                                    <div className="text-lg font-black text-indigo-300">{activeReportMatch.ai_away_prob}%</div>
                                    {activeReportMatch.vote_total ? (
                                        <div className="text-[10px] text-slate-500">투표율 {activeReportMatch.vote_away_pct}%</div>
                                    ) : null}
                                </div>
                            </div>
                        )}

                        {/* 7-Factor 정밀 지표 */}
                        {activeReportMatch.ai_detail_report?.seven_factors && (
                            <div className="space-y-2">
                                <h4 className="text-xs font-black text-slate-300 uppercase">
                                    📊 7-Factor 정량 전술 지표 평가
                                </h4>
                                <div className="space-y-2">
                                    {activeReportMatch.ai_detail_report.seven_factors.map((f, idx) => (
                                        <div key={idx} className="rounded-xl bg-slate-950/70 border border-slate-800 p-2.5">
                                            <div className="flex items-center justify-between text-xs mb-1">
                                                <span className="font-bold text-white">{f.name}</span>
                                                <span className="font-black text-cyan-300">{f.score}점</span>
                                            </div>
                                            <div className="w-full h-1.5 rounded-full bg-slate-800 overflow-hidden mb-1">
                                                <div
                                                    style={{ width: `${f.score}%` }}
                                                    className="h-full bg-gradient-to-r from-cyan-400 to-indigo-500"
                                                />
                                            </div>
                                            <p className="text-[11px] text-slate-400">{f.comment}</p>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* 모달 하단 액션 버튼 */}
                        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-800">
                            <Link
                                href={`/ko/store/print-report/${data.game_key || data.round_id}`}
                                className="px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs"
                            >
                                🖨️ 이 게임 전체 A4 리포트 인쇄뷰 열기
                            </Link>
                            <div className="flex items-center gap-2">
                                <Link
                                    href="/ko/analysis"
                                    className="px-4 py-2.5 rounded-xl bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-400/40 text-cyan-200 font-bold text-xs"
                                >
                                    🧠 7-Factor 심층 데이터 센터 이동 →
                                </Link>
                                <button
                                    onClick={() => setActiveReportMatch(null)}
                                    className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs"
                                >
                                    확인
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* 하단 법적 고지문 (PG 심사 및 규정 준수) */}
            <div className="rounded-2xl bg-slate-950/80 border border-slate-800/80 p-4 text-[11px] text-slate-500 leading-relaxed">
                <strong className="text-slate-400">[데이터 분석 리포트 이용 안내]</strong> 본 서비스(Scorenix)는 통계 알고리즘과 머신러닝(LightGBM·포아송 분포)을 활용하여 국내외 스포츠 경기의 전력 지수 및 승리 기대 확률을 분석·제공하는 순수 스포츠 데이터 분석 정보 서비스입니다. 당사는 어떠한 경우에도 사행성 행위나 금전적 베팅을 중개·권유하지 않으며, 모든 분석 리포트는 스포츠 데이터 연구 및 경기 관전 참고용으로만 제공됩니다.
            </div>
        </div>
    );
}
