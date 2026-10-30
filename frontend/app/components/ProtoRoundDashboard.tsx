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

type BudgetPlanId = "PLAN_8K" | "PLAN_16K" | "PLAN_32K" | "PLAN_48K";

interface MatchMarkingStrategy {
    match: ProtoMatch;
    role: "BANKER" | "DUAL" | "TRIPLE_TRAP";
    roleBadge: string;
    primaryMark: "승" | "무" | "5" | "패";
    secondaryMark: "승" | "무" | "5" | "패" | null;
    tertiaryMark: "승" | "무" | "5" | "패" | null;
    activeMarks: ("승" | "무" | "5" | "패")[];
    voteGapComment: string;
    strategyReason: string;
}

export default function ProtoRoundDashboard() {
    const { user } = useAuth();
    const [data, setData] = useState<ProtoReportData | null>(null);
    const [selectedGameKey, setSelectedGameKey] = useState<string>("G011_260065");
    const [gameCatFilter, setGameCatFilter] = useState<string>("ALL");
    const [loading, setLoading] = useState(true);
    const [switchingGame, setSwitchingGame] = useState(false);
    const [budgetPlan, setBudgetPlan] = useState<BudgetPlanId>("PLAN_16K");
    const [filterTab, setFilterTab] = useState<"ALL" | "KILLER" | "VALUE" | "TRAP">("ALL");
    const [searchQuery, setSearchQuery] = useState("");
    const [unlockedDemo, setUnlockedDemo] = useState(false);
    const [activeReportMatch, setActiveReportMatch] = useState<ProtoMatch | null>(null);

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

    const currentGameType = data?.game_type || "SOCCER_WDL";
    const is14PoolGame = currentGameType === "SOCCER_WDL" || currentGameType === "BASKETBALL_W5L";
    const isW5LGame = currentGameType === "BASKETBALL_W5L";
    const isSpecialGame = currentGameType.includes("SPECIAL") || currentGameType === "BASKETBALL_MATCH";

    // ─── 14경기 패키지 게임(축구 승무패 / 농구 승5패) 전용 통합 마킹 설계 엔진 ───
    const pool14Strategies: MatchMarkingStrategy[] = useMemo(() => {
        if (!data?.matches || !is14PoolGame) return [];
        const midCode: "무" | "5" = isW5LGame ? "5" : "무";

        // 예산 플랜별 복수마킹 개수 설정
        // PLAN_8K: 2복식 3경기 (8,000원)
        // PLAN_16K: 2복식 4경기 (16,000원)
        // PLAN_32K: 2복식 5경기 (32,000원)
        // PLAN_48K: 2복식 4경기 + 3복식(지우개) 1경기 (48,000원)
        const dualCountTarget =
            budgetPlan === "PLAN_8K" ? 3 : budgetPlan === "PLAN_16K" ? 4 : budgetPlan === "PLAN_32K" ? 5 : 4;
        const tripleCountTarget = budgetPlan === "PLAN_48K" ? 1 : 0;

        // 각 경기의 1순위, 2순위, 3순위 마킹 후보와 '단통 안정도 점수' 계산
        const evaluated = data.matches.map((m) => {
            const pHome = isW5LGame && m.w5l_analysis ? m.w5l_analysis.win_prob : m.ai_home_prob;
            const pMid = isW5LGame && m.w5l_analysis ? m.w5l_analysis.close5_prob : m.ai_draw_prob;
            const pAway = isW5LGame && m.w5l_analysis ? m.w5l_analysis.lose_prob : m.ai_away_prob;

            const rawCandidates: { code: "승" | "무" | "5" | "패"; prob: number }[] = [
                { code: "승", prob: pHome },
                { code: midCode, prob: pMid },
                { code: "패", prob: pAway },
            ];
            const candidates = rawCandidates.sort((a, b) => b.prob - a.prob);

            const primary = candidates[0];
            const secondary = candidates[1];
            const tertiary = candidates[2];

            // 대중 투표율과 AI 확률의 괴리 계산
            const voteHome = m.vote_home_pct || 0;
            const voteAway = m.vote_away_pct || 0;
            const maxVote = Math.max(voteHome, voteAway);
            const correspAi = voteHome >= voteAway ? pHome : pAway;
            const voteOverheat = maxVote - correspAi; // 양수면 대중 과열

            // 단통 안정도: 1순위 확률이 높고, 2순위와 격차가 크며, 함정 후보가 아닐수록 높음
            const gap12 = primary.prob - secondary.prob;
            const bankerScore = primary.prob * 1.2 + gap12 - (m.is_trap_candidate ? 18 : 0) - Math.max(0, voteOverheat * 0.4);

            return {
                match: m,
                primary,
                secondary,
                tertiary,
                gap12,
                voteOverheat,
                bankerScore,
            };
        });

        // bankerScore가 가장 낮은 순(가장 혼전이거나 함정 위험이 큰 순)으로 정렬하여 복수마킹 배정
        const sortedByRisk = [...evaluated].sort((a, b) => a.bankerScore - b.bankerScore);
        const tripleSet = new Set<number>();
        const dualSet = new Set<number>();

        for (let i = 0; i < sortedByRisk.length; i++) {
            const gno = sortedByRisk[i].match.game_no;
            if (tripleSet.size < tripleCountTarget) {
                tripleSet.add(gno);
            } else if (dualSet.size < dualCountTarget) {
                dualSet.add(gno);
            }
        }

        return evaluated.map((item) => {
            const { match: m, primary, secondary, tertiary, voteOverheat } = item;
            const isTriple = tripleSet.has(m.game_no);
            const isDual = dualSet.has(m.game_no);

            let role: "BANKER" | "DUAL" | "TRIPLE_TRAP" = "BANKER";
            let roleBadge = "📌 단통(축) 고정";
            let activeMarks: ("승" | "무" | "5" | "패")[] = [primary.code];
            let strategyReason = "";

            if (isTriple) {
                role = "TRIPLE_TRAP";
                roleBadge = "💣 3마킹(지우개) 승부처";
                activeMarks = ["승", midCode, "패"];
                strategyReason = `대중 투표 쏠림 대비 AI 역배·${midCode} 위험도가 가장 높은 최대 함정 경기입니다. 3마킹(지우개)으로 이변을 완벽 방어합니다.`;
            } else if (isDual) {
                role = "DUAL";
                roleBadge = "🛡️ 투마킹(복식) 보험";
                activeMarks = [primary.code, secondary.code];
                strategyReason = `1순위 [${primary.code}](${primary.prob}%)와 2순위 [${secondary.code}](${secondary.prob}%) 격차가 좁아 [${primary.code}+${secondary.code}] 복수 마킹이 필수인 구간입니다.`;
            } else {
                role = "BANKER";
                roleBadge = "📌 단통(축) 고정";
                activeMarks = [primary.code];
                strategyReason = `AI 1순위 [${primary.code}](${primary.prob}%) 우위가 뚜렷하여 마킹 수를 아끼는 단통(축) 고정 경기입니다.`;
            }

            const voteGapComment =
                voteOverheat >= 10
                    ? `⚠️ 대중 투표 과열 (+${voteOverheat.toFixed(0)}%p 쏠림)`
                    : voteOverheat <= -10
                    ? `💡 대중 저평가 꿀구간 (AI 우위 +${Math.abs(voteOverheat).toFixed(0)}%p)`
                    : `투표율·AI 확률 일치 안정권`;

            return {
                match: m,
                role,
                roleBadge,
                primaryMark: primary.code,
                secondaryMark: isDual || isTriple ? secondary.code : null,
                tertiaryMark: isTriple ? tertiary.code : null,
                activeMarks,
                voteGapComment,
                strategyReason,
            };
        });
    }, [data, is14PoolGame, isW5LGame, budgetPlan]);

    const poolSummary = useMemo(() => {
        if (!is14PoolGame || pool14Strategies.length === 0) {
            return { bankers: 0, duals: 0, triples: 0, totalLines: 1, totalCost: 1000 };
        }
        const bankers = pool14Strategies.filter((s) => s.role === "BANKER").length;
        const duals = pool14Strategies.filter((s) => s.role === "DUAL").length;
        const triples = pool14Strategies.filter((s) => s.role === "TRIPLE_TRAP").length;
        const totalLines = Math.pow(2, duals) * Math.pow(3, triples);
        const totalCost = totalLines * 1000;
        return { bankers, duals, triples, totalLines, totalCost };
    }, [is14PoolGame, pool14Strategies]);

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

    if (loading) {
        return (
            <div className="min-h-[70vh] flex flex-col items-center justify-center px-4 text-center bg-[#f4f6f9]">
                <div className="w-11 h-11 rounded-full border-4 border-[#0046b8] border-t-transparent animate-spin mb-4" />
                <p className="text-slate-900 font-extrabold text-lg">베트맨 공식 발매 게임 및 AI 통합 마킹 리포트를 불러오는 중입니다...</p>
                <p className="text-slate-500 text-xs mt-1">승무패 14경기 통합 마킹표 · 승5패 · 스페셜N 득점구간 · 프로토 승부식 동기화</p>
            </div>
        );
    }

    if (!data) return null;

    return (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6 text-slate-900">
            {/* 상단 공식 안내 배너 */}
            <div className="rounded-xl bg-white border border-slate-200 border-l-4 border-l-[#0046b8] p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-xs">
                <div className="flex items-start sm:items-center gap-3">
                    <span className="px-2.5 py-1 rounded-md bg-[#0046b8] text-white text-xs font-extrabold tracking-tight shrink-0">
                        베트맨 공식 게임 연동
                    </span>
                    <div>
                        <p className="text-slate-900 font-extrabold text-sm sm:text-base">
                            게임별 맞춤형 AI 통합 리포트 — 승무패·승5패(14경기 통합 마킹 설계표) / 스페셜N(득점구간 마킹표) / 프로토 승부식
                        </p>
                        <p className="text-slate-500 text-xs mt-0.5">
                            개별 경기 나열이 아닌, 각 베트맨 게임의 실제 구매·마킹 규칙(단통 축 고정 vs 복수마킹 보험 배분)에 맞춘 실전 마킹 리포트를 제공합니다.
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                    <Link
                        href={`/ko/store/print-report/${data.game_key || data.round_id}`}
                        className="px-3.5 py-2 rounded-lg bg-[#0046b8] hover:bg-[#00358e] text-white text-xs font-bold transition shadow-xs"
                    >
                        🖨️ 현재 회차 A4 인쇄뷰
                    </Link>
                </div>
            </div>

            {/* 1. 베트맨 공식 운영 게임 선택 섹션 */}
            <section className="rounded-xl bg-white border border-slate-200 border-t-4 border-t-[#0046b8] p-5 sm:p-6 shadow-xs space-y-4">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-slate-200 pb-4">
                    <div>
                        <div className="flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-[#0046b8]" />
                            <span className="text-[#0046b8] text-xs font-extrabold tracking-wide">
                                현재 발매 · 운영 중인 공식 게임 목록 ({catalogGames.length}개 회차)
                            </span>
                        </div>
                        <h2 className="text-lg sm:text-xl font-black text-slate-900 mt-1">
                            베트맨 공식 게임별 AI 통합 마킹 리포트 선택
                        </h2>
                        <p className="text-xs text-slate-500 mt-0.5">
                            게임을 선택하면 해당 게임 방식(14경기 승무패 마킹슬립 / 농구 6구간 득점표 / 프로토 승부식)에 최적화된 통합 리포트가 즉시 표시됩니다.
                        </p>
                    </div>

                    {/* 게임 카테고리 필터 탭 */}
                    <div className="flex flex-wrap gap-1.5">
                        {[
                            { id: "ALL", label: "전체 게임" },
                            { id: "WDL", label: "⚽ 축구토토 승무패 (14경기)" },
                            { id: "W5L", label: "🏀 농구토토 승5패 (14경기)" },
                            { id: "SPECIAL_N", label: "🏀 스페셜N (NBA 득점구간)" },
                            { id: "SPECIAL_KBL", label: "🏀 스페셜·매치 (KBL)" },
                            { id: "PROTO", label: "⚡ 프로토 승부식" },
                        ].map((cat) => (
                            <button
                                key={cat.id}
                                onClick={() => setGameCatFilter(cat.id)}
                                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all border cursor-pointer ${
                                    gameCatFilter === cat.id
                                        ? "bg-[#0046b8] text-white border-[#0046b8] shadow-xs"
                                        : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100"
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
                                className={`text-left rounded-xl p-4 transition-all border relative cursor-pointer ${
                                    isSelected
                                        ? "bg-blue-50/70 border-2 border-[#0046b8] shadow-sm"
                                        : "bg-white hover:bg-slate-50 border-slate-200 hover:border-slate-300"
                                }`}
                            >
                                <div className="flex items-center justify-between gap-2 mb-2">
                                    <span
                                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold ${
                                            isSelected
                                                ? "bg-[#0046b8] text-white"
                                                : "bg-slate-100 text-slate-700 border border-slate-200"
                                        }`}
                                    >
                                        {g.icon} {g.sport} · {g.category}
                                    </span>
                                    <span
                                        className={`px-2 py-0.5 rounded text-[10px] font-extrabold border ${
                                            g.status_label === "발매중"
                                                ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                                : "bg-slate-100 text-slate-700 border border-slate-200"
                                        }`}
                                    >
                                        {g.status_label}
                                    </span>
                                </div>
                                <div className="font-black text-slate-900 text-base tracking-tight">
                                    {g.full_title}
                                </div>
                                <div className="text-[11px] text-slate-500 mt-1.5 flex items-center justify-between border-t border-slate-100 pt-2">
                                    <span className="font-semibold text-slate-700">대상 {g.match_count}경기</span>
                                    <span className="text-slate-600 font-medium">{g.sale_end_display}</span>
                                </div>
                                {g.forward_amount && g.forward_amount > 0 ? (
                                    <div className="mt-2 px-2.5 py-1 rounded bg-amber-50 border border-amber-200 text-[11px] font-bold text-amber-800">
                                        💰 1등 이월금 {(g.forward_amount / 100000000).toFixed(2)}억 원
                                    </div>
                                ) : null}
                                {isSelected && (
                                    <div className="mt-2 text-[11px] font-extrabold text-[#0046b8] flex items-center justify-between">
                                        <span>✓ 현재 조회 중인 게임</span>
                                        <span>통합 리포트 열람 중 ↓</span>
                                    </div>
                                )}
                            </button>
                        );
                    })}
                </div>
            </section>

            {/* 2. 선택된 게임 공식 헤더 */}
            <section className="rounded-xl bg-white border border-slate-200 p-5 sm:p-6 shadow-xs relative overflow-hidden">
                {switchingGame && (
                    <div className="absolute inset-0 bg-white/85 backdrop-blur-xs z-20 flex items-center justify-center">
                        <div className="flex items-center gap-3 px-5 py-3 rounded-xl bg-white border border-slate-300 text-slate-900 font-bold text-sm shadow-lg">
                            <div className="w-5 h-5 rounded-full border-2 border-[#0046b8] border-t-transparent animate-spin" />
                            <span>선택하신 게임의 통합 AI 마킹 리포트를 생성하는 중...</span>
                        </div>
                    </div>
                )}

                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                    <div className="space-y-2.5">
                        <div className="flex flex-wrap items-center gap-2">
                            <span className="px-2.5 py-1 rounded bg-slate-100 border border-slate-300 text-slate-800 text-xs font-extrabold">
                                게임코드: {data.gm_id || "G011"} · 제 {data.display_round_no}회차
                            </span>
                            <span className="px-2.5 py-1 rounded bg-blue-50 border border-blue-200 text-[#0046b8] text-xs font-bold">
                                ✓ {is14PoolGame ? "14경기 전체 단통·복수마킹 통합 설계" : isSpecialGame ? "전 경기 6구간 득점 분포 통합 설계" : "베트맨 정식 구단 매칭 완료"}
                            </span>
                            {data.sale_end_display && (
                                <span className="px-2.5 py-1 rounded bg-amber-50 border border-amber-200 text-amber-800 text-xs font-bold">
                                    ⏰ {data.sale_end_display}
                                </span>
                            )}
                        </div>
                        <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
                            {data.round_title}{" "}
                            <span className="text-[#0046b8]">
                                {is14PoolGame
                                    ? "14경기 통합 AI 마킹 설계 리포트"
                                    : isSpecialGame
                                    ? "전 경기 6구간 득점대 AI 통합 리포트"
                                    : "AI 핵심 주력 경기 & 전력 리포트"}
                            </span>
                        </h1>
                        <div className="inline-block rounded-lg bg-slate-50 border border-slate-200 px-3.5 py-2 text-xs text-slate-700 font-semibold">
                            📌 <strong>게임 핵심 공략법:</strong>{" "}
                            {is14PoolGame
                                ? "14경기를 한 장의 슬립에 모두 마킹해야 하므로, 확실한 경기는 [단통(축)]으로 아끼고 박빙·대중쏠림 함정 경기에 [복수마킹(투마킹·지우개)]을 배분하는 것이 당첨의 핵심입니다."
                                : isSpecialGame
                                ? "대상 2~3경기의 홈·원정 득점 구간(6구간)을 동시에 맞혀야 하므로, 각 팀의 1순위 주력 구간과 2순위 받침 구간을 조합해 마킹 범위를 좁혀야 합니다."
                                : data.rule_summary}
                        </div>
                    </div>

                    {/* 우측 열람권 / A4 출력 버튼 영역 */}
                    <div className="flex flex-col sm:flex-row lg:flex-col gap-2 shrink-0 min-w-[280px] bg-slate-50 p-4 rounded-xl border border-slate-200">
                        {!isPaidUser ? (
                            <Link
                                href={`/ko/payment/request?plan=round_pass&billing=once&round=${data.round_id}`}
                                className="px-4 py-3 rounded-lg bg-[#0046b8] hover:bg-[#00358e] text-white font-extrabold text-xs sm:text-sm text-center shadow-xs transition"
                            >
                                🔓 이번 회차 통합 마킹 리포트 열람권 (1,500원)
                            </Link>
                        ) : (
                            <div className="px-4 py-2.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 font-extrabold text-xs text-center">
                                ✅ 이번 회차 통합 마킹 리포트 전체 열람 중
                            </div>
                        )}
                        <div className="grid grid-cols-2 gap-2">
                            <button
                                onClick={() => {
                                    localStorage.setItem("scorenix_round_pass_unlocked", "true");
                                    setUnlockedDemo(true);
                                }}
                                className="px-3 py-2 rounded-lg bg-white hover:bg-slate-100 border border-slate-300 text-slate-700 text-xs font-bold text-center transition cursor-pointer"
                            >
                                🔓 미리보기 즉시 열기
                            </button>
                            <Link
                                href={`/ko/store/print-report/${data.game_key || data.round_id}`}
                                className="px-3 py-2 rounded-lg bg-white hover:bg-blue-50 border border-[#0046b8] text-[#0046b8] text-xs font-extrabold text-center transition"
                            >
                                🖨️ A4 한장 인쇄뷰
                            </Link>
                        </div>
                    </div>
                </div>
            </section>

            {/* ═══════════════════════════════════════════════════════════════════════════
                MODE A: 축구토토 승무패(G011) / 농구토토 승5패(G027) — 14경기 통합 마킹 설계 리포트
               ═══════════════════════════════════════════════════════════════════════════ */}
            {is14PoolGame && (
                <>
                    {/* A-1. 예산별 마킹 플랜 선택 & 단통/복수마킹 배분 요약 */}
                    <section className="rounded-xl bg-white border-2 border-[#0046b8] p-5 sm:p-6 shadow-xs space-y-5">
                        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-200 pb-4">
                            <div>
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded bg-blue-50 text-[#0046b8] border border-blue-200 text-xs font-extrabold">
                                    📋 STEP 1 · 예산별 14경기 단통(축) &amp; 복수마킹 자동 배분 설계
                                </span>
                                <h2 className="text-lg sm:text-xl font-black text-slate-900 mt-1.5">
                                    {data.round_title} — 한눈에 보는 14경기 마킹 배분 전략
                                </h2>
                                <p className="text-xs text-slate-500 mt-0.5">
                                    구매 예산 플랜을 선택하면 AI가 14경기 전체의 승률 격차와 베트맨 대중 투표 쏠림을 계산해 <strong>단통(축) 경기</strong>와 <strong>복수마킹(보험) 경기</strong>를 자동 배분합니다.
                                </p>
                            </div>

                            {/* 예산 플랜 선택 버튼 */}
                            <div className="flex flex-wrap gap-2">
                                {(
                                    [
                                        { id: "PLAN_8K", title: "실속형 (8,000원)", sub: "단통 11 + 복수 3경기 (8조합)" },
                                        { id: "PLAN_16K", title: "표준형 (16,000원)", sub: "단통 10 + 복수 4경기 (16조합)" },
                                        { id: "PLAN_32K", title: "주력형 (32,000원)", sub: "단통 9 + 복수 5경기 (32조합)" },
                                        { id: "PLAN_48K", title: "1등방어형 (48,000원)", sub: "단통 9 + 복수 4 + 지우개 1" },
                                    ] as const
                                ).map((p) => (
                                    <button
                                        key={p.id}
                                        onClick={() => setBudgetPlan(p.id)}
                                        className={`px-3.5 py-2 rounded-xl text-left border transition cursor-pointer ${
                                            budgetPlan === p.id
                                                ? "bg-[#0046b8] text-white border-[#0046b8] shadow-sm"
                                                : "bg-slate-50 text-slate-800 border-slate-300 hover:bg-slate-100"
                                        }`}
                                    >
                                        <div className="text-xs font-black">{p.title}</div>
                                        <div className={`text-[10px] mt-0.5 ${budgetPlan === p.id ? "text-blue-100" : "text-slate-500"}`}>
                                            {p.sub}
                                        </div>
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* 3대 분류 요약 박스 (단통 축 / 투마킹 보험 / 3마킹 함정방어) */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            {/* 1) 단통 축 경기 */}
                            <div className="rounded-xl bg-blue-50/50 border border-blue-200 p-4 space-y-2.5">
                                <div className="flex items-center justify-between">
                                    <span className="px-2.5 py-1 rounded bg-[#0046b8] text-white text-xs font-extrabold">
                                        📌 단통(축) 고정 추천 ({poolSummary.bankers}경기)
                                    </span>
                                    <span className="text-xs font-bold text-[#0046b8]">마킹 비용 절감 구간</span>
                                </div>
                                <p className="text-xs text-slate-600">
                                    AI 1순위 확률 우위가 명확하여 <strong>단독 마킹(1개 선택)</strong>으로 고정하는 핵심 축 경기입니다.
                                </p>
                                <div className="flex flex-wrap gap-1.5 pt-1">
                                    {pool14Strategies
                                        .filter((s) => s.role === "BANKER")
                                        .map((s) => (
                                            <span
                                                key={s.match.game_no}
                                                className="px-2 py-1 rounded bg-white border border-blue-200 text-xs font-extrabold text-slate-900"
                                            >
                                                {s.match.game_no}번 {s.match.betman_home} ({s.primaryMark})
                                            </span>
                                        ))}
                                </div>
                            </div>

                            {/* 2) 투마킹(복수) 보험 경기 */}
                            <div className="rounded-xl bg-amber-50/60 border border-amber-200 p-4 space-y-2.5">
                                <div className="flex items-center justify-between">
                                    <span className="px-2.5 py-1 rounded bg-amber-500 text-white text-xs font-extrabold">
                                        🛡️ 복수마킹(투마킹) 보험 ({poolSummary.duals}경기)
                                    </span>
                                    <span className="text-xs font-bold text-amber-800">무승부·접전 방어 구간</span>
                                </div>
                                <p className="text-xs text-slate-600">
                                    전력 차가 좁거나 {isW5LGame ? "5점차 이내 접전(5)" : "무승부"} 가능성이 높아 <strong>2개 복수 마킹</strong>으로 등위 이탈을 막는 경기입니다.
                                </p>
                                <div className="flex flex-wrap gap-1.5 pt-1">
                                    {pool14Strategies
                                        .filter((s) => s.role === "DUAL")
                                        .map((s) => (
                                            <span
                                                key={s.match.game_no}
                                                className="px-2 py-1 rounded bg-white border border-amber-300 text-xs font-extrabold text-amber-900"
                                            >
                                                {s.match.game_no}번 {s.match.betman_home} ({s.activeMarks.join("+")})
                                            </span>
                                        ))}
                                </div>
                            </div>

                            {/* 3) 대중 쏠림 함정 & 지우개 승부처 */}
                            <div className="rounded-xl bg-rose-50/60 border border-rose-200 p-4 space-y-2.5">
                                <div className="flex items-center justify-between">
                                    <span className="px-2.5 py-1 rounded bg-rose-600 text-white text-xs font-extrabold">
                                        💣 대중 쏠림 함정 주의보 ({data.section_c_traps.length}경기)
                                    </span>
                                    <span className="text-xs font-bold text-rose-700">고배당·1등 당첨 승부처</span>
                                </div>
                                <p className="text-xs text-slate-600">
                                    베트맨 실투표율은 과열되었으나 AI 승률은 낮아 <strong>이변 발생 시 당첨금이 급등하는 함정 구간</strong>입니다.
                                </p>
                                <div className="space-y-1 pt-1">
                                    {data.section_c_traps.slice(0, 3).map((tm) => (
                                        <div
                                            key={tm.game_no}
                                            className="px-2.5 py-1 rounded bg-white border border-rose-200 text-xs flex items-center justify-between"
                                        >
                                            <span className="font-extrabold text-slate-900">
                                                {tm.game_no}번 {tm.betman_home} vs {tm.betman_away}
                                            </span>
                                            <span className="text-[11px] font-bold text-rose-700">
                                                이변위험 {tm.upset_or_draw_prob}%
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </section>

                    {/* A-2. 14경기 전체 실전 OMR 마킹 슬립 & 통합 분석표 (개별 팝업 없이 한 판에 모든 정보 표시) */}
                    <section className="rounded-xl bg-white border border-slate-300 overflow-hidden shadow-xs">
                        <div className="p-4 sm:p-5 bg-slate-50 border-b border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-4">
                            <div>
                                <div className="flex items-center gap-2">
                                    <span className="px-2.5 py-0.5 rounded bg-[#0046b8] text-white text-xs font-extrabold">
                                        STEP 2 · 실전 마킹 슬립
                                    </span>
                                    <span className="text-xs font-bold text-slate-600">
                                        총 {poolSummary.totalLines}조합 ({poolSummary.totalCost.toLocaleString()}원 기준)
                                    </span>
                                </div>
                                <h2 className="text-lg sm:text-xl font-black text-slate-900 mt-1">
                                    📝 {data.round_title} — 1번~14번 통합 OMR 마킹표 &amp; 경기별 AI 코멘트
                                </h2>
                                <p className="text-xs text-slate-500 mt-0.5">
                                    파란색(<strong className="text-[#0046b8]">● 주력 마킹</strong>)과 주황색(<strong className="text-amber-600">● 복수 보험 마킹</strong>)으로 표시된 마킹란을 그대로 참고하여 14경기 전체 밸런스를 잡으실 수 있습니다.
                                </p>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                                <Link
                                    href={`/ko/store/print-report/${data.game_key || data.round_id}`}
                                    className="px-4 py-2.5 rounded-lg bg-[#0046b8] hover:bg-[#00358e] text-white text-xs font-extrabold transition shadow-xs"
                                >
                                    🖨️ 이 14경기 마킹표 A4 출력하기
                                </Link>
                            </div>
                        </div>

                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="bg-[#1e293b] text-white text-xs font-bold">
                                        <th className="py-3 px-2.5 text-center w-16 border-r border-slate-700">번호</th>
                                        <th className="py-3 px-3 w-36 border-r border-slate-700">대회 / 경기일시</th>
                                        <th className="py-3 px-3 w-64 border-r border-slate-700">홈팀 vs 원정팀</th>
                                        <th className="py-3 px-3 w-60 border-r border-slate-700 text-center">
                                            AI 확률 vs 베트맨 투표율 비교
                                        </th>
                                        <th className="py-3 px-3 w-36 border-r border-slate-700 text-center">전략 분류</th>
                                        <th className="py-3 px-3 w-44 border-r border-slate-700 text-center bg-[#003996]">
                                            실전 OMR 마킹란 ({isW5LGame ? "승 / 5 / 패" : "승 / 무 / 패"})
                                        </th>
                                        <th className="py-3 px-3">AI 통합 마킹 근거 &amp; 전술 핵심</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-200 text-xs">
                                    {pool14Strategies.map((item, idx) => {
                                        const m = item.match;
                                        const midLabel: "무" | "5" = isW5LGame ? "5" : "무";
                                        const pHome = isW5LGame && m.w5l_analysis ? m.w5l_analysis.win_prob : m.ai_home_prob;
                                        const pMid = isW5LGame && m.w5l_analysis ? m.w5l_analysis.close5_prob : m.ai_draw_prob;
                                        const pAway = isW5LGame && m.w5l_analysis ? m.w5l_analysis.lose_prob : m.ai_away_prob;

                                        // 비유료 유저의 경우 상위 핵심 3경기의 마킹란만 자물쇠 처리 (나머지 11경기는 전면 공개하여 효용 체감)
                                        const isLockedRow = !isPaidUser && idx >= 2 && idx <= 4;

                                        return (
                                            <tr
                                                key={m.game_no}
                                                className={`${
                                                    item.role === "TRIPLE_TRAP"
                                                        ? "bg-rose-50/40"
                                                        : item.role === "DUAL"
                                                        ? "bg-amber-50/30"
                                                        : idx % 2 === 0
                                                        ? "bg-white"
                                                        : "bg-slate-50/60"
                                                } hover:bg-blue-50/40 transition-colors`}
                                            >
                                                {/* 1. 경기번호 */}
                                                <td className="py-3 px-2.5 text-center border-r border-slate-200 font-black text-slate-900">
                                                    <span className="inline-block px-2 py-1 rounded bg-slate-100 border border-slate-300 text-xs">
                                                        {m.game_no}번
                                                    </span>
                                                </td>

                                                {/* 2. 대회 / 경기일시 */}
                                                <td className="py-3 px-3 border-r border-slate-200 whitespace-nowrap">
                                                    <div className="font-extrabold text-slate-800">{m.league}</div>
                                                    <div className="text-[11px] text-slate-500 mt-0.5">{m.kickoff_display}</div>
                                                </td>

                                                {/* 3. 홈팀 vs 원정팀 */}
                                                <td className="py-3 px-3 border-r border-slate-200">
                                                    <div className="font-black text-slate-900 text-sm flex items-center gap-1.5">
                                                        <span className="text-[#0046b8]">{m.betman_home}</span>
                                                        <span className="text-slate-400 text-xs font-normal">vs</span>
                                                        <span className="text-slate-800">{m.betman_away}</span>
                                                    </div>
                                                    <div className="text-[11px] text-slate-500 mt-0.5">
                                                        {m.home_ko} vs {m.away_ko}
                                                    </div>
                                                </td>

                                                {/* 4. AI 확률 vs 베트맨 투표율 */}
                                                <td className="py-3 px-3 border-r border-slate-200">
                                                    <div className="space-y-1">
                                                        <div className="flex justify-between text-[11px] font-bold">
                                                            <span className="text-[#0046b8]">AI: 승 {pHome}%</span>
                                                            <span className="text-amber-700">
                                                                {midLabel} {pMid}%
                                                            </span>
                                                            <span className="text-slate-700">패 {pAway}%</span>
                                                        </div>
                                                        <div className="w-full h-2 rounded-full bg-slate-200 overflow-hidden flex">
                                                            <div style={{ width: `${pHome}%` }} className="bg-[#0046b8]" />
                                                            <div style={{ width: `${pMid}%` }} className="bg-amber-500" />
                                                            <div style={{ width: `${pAway}%` }} className="bg-slate-600" />
                                                        </div>
                                                        {m.vote_total && m.vote_total > 0 ? (
                                                            <div className="flex justify-between text-[10px] text-slate-500 font-semibold">
                                                                <span>투표율:</span>
                                                                <span>
                                                                    승 {m.vote_home_pct}% · {midLabel} {m.vote_mid_pct}% · 패 {m.vote_away_pct}%
                                                                </span>
                                                            </div>
                                                        ) : null}
                                                    </div>
                                                </td>

                                                {/* 5. 전략 분류 배지 */}
                                                <td className="py-3 px-3 border-r border-slate-200 text-center whitespace-nowrap">
                                                    <span
                                                        className={`inline-block px-2.5 py-1 rounded-md text-[11px] font-extrabold border ${
                                                            item.role === "TRIPLE_TRAP"
                                                                ? "bg-rose-100 text-rose-800 border-rose-300"
                                                                : item.role === "DUAL"
                                                                ? "bg-amber-100 text-amber-900 border-amber-300"
                                                                : "bg-blue-50 text-[#0046b8] border-blue-200"
                                                        }`}
                                                    >
                                                        {item.roleBadge}
                                                    </span>
                                                    <div className="text-[10px] text-slate-500 mt-1 font-semibold">
                                                        {item.voteGapComment}
                                                    </div>
                                                </td>

                                                {/* 6. 실전 OMR 마킹란 ([승] [무/5] [패]) */}
                                                <td className="py-3 px-3 border-r border-slate-200 text-center bg-blue-50/20">
                                                    {isLockedRow ? (
                                                        <Link
                                                            href={`/ko/payment/request?plan=round_pass&billing=once&round=${data.round_id}`}
                                                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded bg-amber-50 border border-amber-300 text-amber-900 font-extrabold text-[11px] hover:bg-amber-100"
                                                        >
                                                            🔒 승부처 마킹 열기
                                                        </Link>
                                                    ) : (
                                                        <div className="inline-flex items-center gap-1.5">
                                                            {(["승", midLabel, "패"] as ("승" | "무" | "5" | "패")[]).map((code) => {
                                                                const isPrimary = item.primaryMark === code;
                                                                const isSecondary = item.secondaryMark === code || item.tertiaryMark === code;
                                                                return (
                                                                    <span
                                                                        key={code}
                                                                        className={`w-10 h-8 rounded-md flex flex-col items-center justify-center font-black text-xs border ${
                                                                            isPrimary
                                                                                ? "bg-[#0046b8] text-white border-[#0046b8] shadow-xs"
                                                                                : isSecondary
                                                                                ? "bg-amber-500 text-white border-amber-600 shadow-xs"
                                                                                : "bg-white text-slate-300 border-slate-200"
                                                                        }`}
                                                                    >
                                                                        <span>{code}</span>
                                                                    </span>
                                                                );
                                                            })}
                                                        </div>
                                                    )}
                                                </td>

                                                {/* 7. AI 통합 마킹 근거 (팝업 없이 바로 한눈에 열람) */}
                                                <td className="py-3 px-3">
                                                    <p className="text-xs font-bold text-slate-800 leading-snug">
                                                        {item.strategyReason}
                                                    </p>
                                                    <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">
                                                        {m.ai_detail_report?.tactical_summary || m.trap_reason}
                                                    </p>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </section>
                </>
            )}

            {/* ═══════════════════════════════════════════════════════════════════════════
                MODE B: 농구토토 스페셜N 더블/트리플(G055, G056) · 스페셜(G025, G005) · 매치(G015)
                — 팝업 없이 전 경기(1~3경기) 홈·원정 6구간 득점 마킹표를 한 화면에 통합 제공
               ═══════════════════════════════════════════════════════════════════════════ */}
            {isSpecialGame && (
                <section className="rounded-xl bg-white border-2 border-[#0046b8] p-5 sm:p-6 shadow-xs space-y-5">
                    <div className="border-b border-slate-200 pb-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
                        <div>
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded bg-blue-50 text-[#0046b8] border border-blue-200 text-xs font-extrabold">
                                🏀 {data.game_name} 통합 득점구간 마킹 설계표
                            </span>
                            <h2 className="text-lg sm:text-xl font-black text-slate-900 mt-1">
                                {data.round_title} — 대상 {data.matches.length}경기 홈·원정 6구간 실전 마킹 리포트
                            </h2>
                            <p className="text-xs text-slate-500 mt-0.5">
                                각 경기의 홈팀·원정팀 6개 득점 구간 중 <strong className="text-[#0046b8]">★1순위 주력 구간</strong>과 <strong className="text-amber-600">☆2순위 복수(받침) 구간</strong>을 한 화면에서 바로 확인하세요.
                            </p>
                        </div>
                    </div>

                    <div className="space-y-6">
                        {data.matches.map((m) => {
                            const sb = m.special_brackets;
                            if (!sb) return null;
                            return (
                                <div
                                    key={m.game_no}
                                    className="rounded-xl bg-slate-50 border border-slate-300 overflow-hidden"
                                >
                                    {/* 경기 헤더 */}
                                    <div className="bg-[#1e293b] text-white px-4 py-3 flex flex-wrap items-center justify-between gap-3">
                                        <div className="flex items-center gap-2.5">
                                            <span className="px-2.5 py-1 rounded bg-[#0046b8] text-white text-xs font-black">
                                                {m.game_no}경기의 득점구간 설계
                                            </span>
                                            <span className="text-sm sm:text-base font-black">
                                                홈 {m.home_ko}({m.betman_home}) vs 원정 {m.away_ko}({m.betman_away})
                                            </span>
                                        </div>
                                        <div className="text-xs text-slate-300 font-semibold">
                                            {m.league} · {m.kickoff_display} · AI 예상 총점 {sb.expected_total_pts}점
                                        </div>
                                    </div>

                                    {/* 홈팀 / 원정팀 6구간 OMR 마킹 테이블 */}
                                    <div className="p-4 space-y-4">
                                        {currentGameType === "BASKETBALL_MATCH" && (
                                            <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 flex flex-wrap items-center justify-between gap-2 text-xs">
                                                <span className="font-extrabold text-amber-900">
                                                    ⏱️ 전반(1·2쿼터 합산) 유력 득점구간 추천:
                                                </span>
                                                <span className="font-black text-slate-900">
                                                    홈({m.betman_home}) 전반 예상 {sb.half_expected_home_pts}점 →{" "}
                                                    <strong className="text-[#0046b8]">[{sb.half_home_top_bracket}]</strong> / 원정({m.betman_away}) 전반 예상 {sb.half_expected_away_pts}점 →{" "}
                                                    <strong className="text-[#0046b8]">[{sb.half_away_top_bracket}]</strong>
                                                </span>
                                            </div>
                                        )}

                                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                                            {/* 홈팀 6구간 */}
                                            <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-3">
                                                <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                                                    <div>
                                                        <span className="px-2 py-0.5 rounded bg-blue-50 text-[#0046b8] text-[11px] font-extrabold mr-1.5">
                                                            홈팀
                                                        </span>
                                                        <strong className="text-sm font-black text-slate-900">
                                                            {m.home_ko} ({m.betman_home})
                                                        </strong>
                                                    </div>
                                                    <span className="text-xs font-extrabold text-[#0046b8]">
                                                        AI 예상 {sb.expected_home_pts}점
                                                    </span>
                                                </div>
                                                <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5 text-center">
                                                    {sb.home_brackets.map((b) => {
                                                        const isTop1 = b.rank === 1;
                                                        const isTop2 = b.rank === 2;
                                                        return (
                                                            <div
                                                                key={b.bracket_no}
                                                                className={`rounded-lg p-2 border ${
                                                                    isTop1
                                                                        ? "bg-[#0046b8] text-white border-[#0046b8] shadow-xs"
                                                                        : isTop2
                                                                        ? "bg-amber-500 text-white border-amber-600"
                                                                        : "bg-slate-50 text-slate-600 border-slate-200"
                                                                }`}
                                                            >
                                                                <div className="text-[10px] font-extrabold">
                                                                    {b.bracket_no}구간 {isTop1 ? "★1순위" : isTop2 ? "☆2순위" : ""}
                                                                </div>
                                                                <div className="text-[11px] font-black mt-0.5">{b.label}</div>
                                                                <div className="text-xs font-extrabold mt-1">{b.prob_pct}%</div>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                                <div className="text-xs text-slate-600 bg-slate-50 rounded-lg px-3 py-2 border border-slate-200">
                                                    권장 복수 마킹:{" "}
                                                    <strong className="text-[#0046b8]">1순위 [{sb.home_top1_bracket}]</strong> +{" "}
                                                    <strong className="text-amber-700">2순위 [{sb.home_top2_bracket}]</strong> (합산 기대확률{" "}
                                                    {(sb.home_top1_prob + sb.home_top2_prob).toFixed(1)}%)
                                                </div>
                                            </div>

                                            {/* 원정팀 6구간 */}
                                            <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-3">
                                                <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                                                    <div>
                                                        <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 text-[11px] font-extrabold mr-1.5">
                                                            원정팀
                                                        </span>
                                                        <strong className="text-sm font-black text-slate-900">
                                                            {m.away_ko} ({m.betman_away})
                                                        </strong>
                                                    </div>
                                                    <span className="text-xs font-extrabold text-indigo-700">
                                                        AI 예상 {sb.expected_away_pts}점
                                                    </span>
                                                </div>
                                                <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5 text-center">
                                                    {sb.away_brackets.map((b) => {
                                                        const isTop1 = b.rank === 1;
                                                        const isTop2 = b.rank === 2;
                                                        return (
                                                            <div
                                                                key={b.bracket_no}
                                                                className={`rounded-lg p-2 border ${
                                                                    isTop1
                                                                        ? "bg-[#0046b8] text-white border-[#0046b8] shadow-xs"
                                                                        : isTop2
                                                                        ? "bg-amber-500 text-white border-amber-600"
                                                                        : "bg-slate-50 text-slate-600 border-slate-200"
                                                                }`}
                                                            >
                                                                <div className="text-[10px] font-extrabold">
                                                                    {b.bracket_no}구간 {isTop1 ? "★1순위" : isTop2 ? "☆2순위" : ""}
                                                                </div>
                                                                <div className="text-[11px] font-black mt-0.5">{b.label}</div>
                                                                <div className="text-xs font-extrabold mt-1">{b.prob_pct}%</div>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                                <div className="text-xs text-slate-600 bg-slate-50 rounded-lg px-3 py-2 border border-slate-200">
                                                    권장 복수 마킹:{" "}
                                                    <strong className="text-[#0046b8]">1순위 [{sb.away_top1_bracket}]</strong> +{" "}
                                                    <strong className="text-amber-700">2순위 [{sb.away_top2_bracket}]</strong> (합산 기대확률{" "}
                                                    {(sb.away_top1_prob + sb.away_top2_prob).toFixed(1)}%)
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </section>
            )}

            {/* ═══════════════════════════════════════════════════════════════════════════
                MODE C: 프로토 승부식(G101) — 다수 대상 경기 중 핵심 추천 경기 선별 & 전체 경기 일람표
               ═══════════════════════════════════════════════════════════════════════════ */}
            {!is14PoolGame && !isSpecialGame && (
                <>
                    {/* C-1. 핵심 우위 경기 & 이변 주의보 요약 */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                        <div className="rounded-xl bg-white border border-slate-200 p-5 space-y-3.5 shadow-xs">
                            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                                <div>
                                    <span className="text-[11px] font-extrabold text-[#0046b8]">
                                        프로토 승부식 선택형 주력 경기 선별
                                    </span>
                                    <h2 className="text-base sm:text-lg font-black text-slate-900 mt-0.5">
                                        🎯 [{data.round_title}] AI 확신도 85% 이상 핵심 주력 경기
                                    </h2>
                                </div>
                                <span className="px-2.5 py-1 rounded bg-blue-50 text-[#0046b8] text-xs font-bold border border-blue-200">
                                    {isPaidUser ? "전체 공개" : "🔒 1,500원 열람권"}
                                </span>
                            </div>

                            {isPaidUser ? (
                                <div className="space-y-2">
                                    {data.matches
                                        .filter((m) => m.is_killer_pick)
                                        .slice(0, 4)
                                        .map((m) => (
                                            <div
                                                key={m.game_no}
                                                className="rounded-lg bg-blue-50/40 border border-blue-200 p-3 flex items-center justify-between gap-3"
                                            >
                                                <div>
                                                    <div className="flex items-center gap-2">
                                                        <span className="px-2 py-0.5 rounded bg-[#0046b8] text-white text-xs font-extrabold">
                                                            {m.game_no_label}
                                                        </span>
                                                        <span className="text-xs font-bold text-slate-500">{m.league}</span>
                                                        <span className="text-xs font-extrabold text-emerald-700">
                                                            AI 신뢰도 {m.ai_confidence}%
                                                        </span>
                                                    </div>
                                                    <div className="text-sm font-extrabold text-slate-900 mt-1">
                                                        {m.home_ko} ({m.betman_home}) vs {m.away_ko} ({m.betman_away})
                                                    </div>
                                                </div>
                                                <div className="text-right shrink-0">
                                                    <div className="text-xs font-black text-[#0046b8]">{m.ai_pick_full_label}</div>
                                                    <div className="text-[11px] text-slate-500">기대확률 {m.ai_pick_prob}%</div>
                                                </div>
                                            </div>
                                        ))}
                                </div>
                            ) : (
                                <div className="rounded-lg bg-slate-50 border border-slate-200 p-5 text-center space-y-3">
                                    <p className="text-slate-900 font-extrabold text-sm">
                                        🔒 [{data.round_title}] 전체 {data.total_matches}경기 중 AI 엄선 주력 경기 ({data.killer_picks_count}경기)
                                    </p>
                                    <p className="text-slate-500 text-xs">
                                        수십 개 대상 경기 중 가장 승리 기대치가 높은 핵심 경기만 골라 확인하세요.
                                    </p>
                                    <div className="flex flex-wrap justify-center gap-2 pt-1">
                                        <Link
                                            href={`/ko/payment/request?plan=round_pass&billing=once&round=${data.round_id}`}
                                            className="px-4 py-2 rounded-lg bg-[#0046b8] hover:bg-[#00358e] text-white font-extrabold text-xs transition"
                                        >
                                            🔓 1,500원으로 이번 회차 리포트 열기
                                        </Link>
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="rounded-xl bg-white border border-slate-200 p-5 space-y-3.5 shadow-xs">
                            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                                <div>
                                    <span className="text-[11px] font-extrabold text-rose-600">
                                        피해야 할 고위험 경기 경보 (무료 공개)
                                    </span>
                                    <h2 className="text-base sm:text-lg font-black text-slate-900 mt-0.5">
                                        ⚠️ [{data.round_title}] 이변 · 무승부 주의보 경기
                                    </h2>
                                </div>
                                <span className="px-2.5 py-1 rounded bg-rose-50 text-rose-700 text-xs font-bold border border-rose-200">
                                    제외/보험 권장
                                </span>
                            </div>

                            <div className="space-y-2">
                                {data.section_c_traps.slice(0, 3).map((tm) => (
                                    <div
                                        key={tm.game_no}
                                        className="rounded-lg bg-rose-50/40 border border-rose-200 p-3"
                                    >
                                        <div className="flex items-center gap-2">
                                            <span className="px-2 py-0.5 rounded bg-rose-600 text-white text-xs font-extrabold">
                                                {tm.game_no_label} · {tm.league}
                                            </span>
                                            <span className="text-xs font-extrabold text-slate-900">
                                                {tm.home_ko}({tm.betman_home}) vs {tm.away_ko}({tm.betman_away})
                                            </span>
                                        </div>
                                        <p className="text-xs text-slate-600 mt-1.5 leading-relaxed">{tm.trap_reason}</p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* C-2. 프로토 승부식 전체 대상 경기 테이블 */}
                    <section className="rounded-xl bg-white border border-slate-300 overflow-hidden shadow-xs">
                        <div className="p-4 sm:p-5 bg-slate-50 border-b border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-4">
                            <div>
                                <h2 className="text-lg sm:text-xl font-black text-slate-900">
                                    📋 {data.round_title} 대상 경기 일정 및 AI 선별 분석표 ({filteredMatches.length}경기)
                                </h2>
                                <p className="text-xs text-slate-500 mt-0.5">
                                    원하는 경기만 선별하는 프로토 승부식 특성에 맞춰 각 경기의 AI 추천 방향과 전술 요약을 한눈에 제공합니다.
                                </p>
                            </div>

                            <div className="flex flex-wrap items-center gap-1.5">
                                {(
                                    [
                                        { id: "ALL", label: `전체 경기 (${data.matches.length})` },
                                        { id: "KILLER", label: `🎯 핵심 주력 (${data.killer_picks_count})` },
                                        { id: "VALUE", label: `📊 데이터 우위 Top 5` },
                                        { id: "TRAP", label: `⚠️ 함정 주의보` },
                                    ] as const
                                ).map((tab) => (
                                    <button
                                        key={tab.id}
                                        onClick={() => setFilterTab(tab.id)}
                                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition border cursor-pointer ${
                                            filterTab === tab.id
                                                ? "bg-[#0046b8] text-white border-[#0046b8]"
                                                : "bg-white text-slate-700 border-slate-300 hover:bg-slate-100"
                                        }`}
                                    >
                                        {tab.label}
                                    </button>
                                ))}
                                <input
                                    type="text"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    placeholder="팀명/경기번호 검색"
                                    className="px-3 py-1.5 rounded-lg bg-white border border-slate-300 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-[#0046b8]"
                                />
                            </div>
                        </div>

                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="bg-[#1e293b] text-white text-xs font-bold">
                                        <th className="py-3 px-3 text-center w-24 border-r border-slate-700">경기번호</th>
                                        <th className="py-3 px-3 w-40 border-r border-slate-700">대회명 / 일시</th>
                                        <th className="py-3 px-3 w-64 border-r border-slate-700">대상 경기</th>
                                        <th className="py-3 px-3 w-60 text-center border-r border-slate-700">AI 기대 확률</th>
                                        <th className="py-3 px-3 text-center w-36 border-r border-slate-700">AI 선별 결론</th>
                                        <th className="py-3 px-3">전술 요약 및 선별 사유</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-200 text-xs">
                                    {filteredMatches.map((m, idx) => {
                                        const lockedKiller = m.is_killer_pick && !isPaidUser;
                                        return (
                                            <tr
                                                key={m.game_no}
                                                className={`${
                                                    idx % 2 === 0 ? "bg-white" : "bg-slate-50/60"
                                                } hover:bg-blue-50/40 transition-colors`}
                                            >
                                                <td className="py-3.5 px-3 text-center border-r border-slate-200 whitespace-nowrap">
                                                    <span className="inline-block px-2.5 py-1 rounded bg-slate-100 border border-slate-300 font-black text-slate-900 text-xs">
                                                        {m.game_no_label}
                                                    </span>
                                                    <div className="mt-1 flex flex-wrap justify-center gap-1">
                                                        {m.proto_market_type && (
                                                            <span className="px-1.5 py-0.5 rounded bg-slate-200/80 text-slate-700 text-[10px] font-semibold">
                                                                {m.proto_market_type}
                                                            </span>
                                                        )}
                                                        {m.is_killer_pick && (
                                                            <span className="px-1.5 py-0.5 rounded bg-blue-100 text-[#0046b8] text-[10px] font-extrabold">
                                                                주력
                                                            </span>
                                                        )}
                                                        {m.is_trap_candidate && (
                                                            <span className="px-1.5 py-0.5 rounded bg-rose-100 text-rose-700 text-[10px] font-extrabold">
                                                                주의
                                                            </span>
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="py-3.5 px-3 border-r border-slate-200 whitespace-nowrap">
                                                    <div className="font-extrabold text-slate-800">{m.league}</div>
                                                    <div className="text-[11px] text-slate-500 mt-0.5">{m.kickoff_display}</div>
                                                </td>
                                                <td className="py-3.5 px-3 border-r border-slate-200">
                                                    <div className="font-black text-slate-900 text-sm">
                                                        {m.betman_home} <span className="text-slate-400 font-normal text-xs">vs</span> {m.betman_away}
                                                    </div>
                                                    <div className="text-[11px] text-slate-500 mt-0.5">
                                                        {m.home_ko} vs {m.away_ko}
                                                    </div>
                                                </td>
                                                <td className="py-3.5 px-3 border-r border-slate-200">
                                                    <div className="flex justify-between text-[11px] font-bold mb-1">
                                                        <span className="text-[#0046b8]">홈 {m.ai_home_prob}%</span>
                                                        {m.ai_draw_prob > 0 && <span className="text-slate-600">무 {m.ai_draw_prob}%</span>}
                                                        <span className="text-slate-700">원정 {m.ai_away_prob}%</span>
                                                    </div>
                                                    <div className="w-full h-2 rounded-full bg-slate-200 overflow-hidden flex">
                                                        <div style={{ width: `${m.ai_home_prob}%` }} className="bg-[#0046b8]" />
                                                        {m.ai_draw_prob > 0 && (
                                                            <div style={{ width: `${m.ai_draw_prob}%` }} className="bg-slate-400" />
                                                        )}
                                                        <div style={{ width: `${m.ai_away_prob}%` }} className="bg-slate-700" />
                                                    </div>
                                                </td>
                                                <td className="py-3.5 px-3 text-center border-r border-slate-200 whitespace-nowrap">
                                                    {lockedKiller ? (
                                                        <Link
                                                            href={`/ko/payment/request?plan=round_pass&billing=once&round=${data.round_id}`}
                                                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded bg-amber-50 border border-amber-300 text-amber-900 font-extrabold text-xs"
                                                        >
                                                            🔒 주력픽 열기
                                                        </Link>
                                                    ) : (
                                                        <div>
                                                            <span className="px-2.5 py-1 rounded bg-blue-50 border border-blue-200 text-[#0046b8] font-extrabold text-xs inline-block">
                                                                {m.ai_pick_label}
                                                            </span>
                                                            <div className="text-[11px] text-slate-500 mt-1">
                                                                신뢰도 <strong className="text-emerald-700">{m.ai_confidence}%</strong>
                                                            </div>
                                                        </div>
                                                    )}
                                                </td>
                                                <td className="py-3.5 px-3">
                                                    <p className="text-xs text-slate-700 leading-relaxed">
                                                        {m.ai_detail_report?.tactical_summary || m.trap_reason}
                                                    </p>
                                                    <button
                                                        onClick={() => setActiveReportMatch(m)}
                                                        className="mt-1 text-[11px] font-extrabold text-[#0046b8] hover:underline cursor-pointer"
                                                    >
                                                        + 7-Factor 세부 지표 보기
                                                    </button>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </section>
                </>
            )}

            {/* 프로토 승부식 등에서 7-Factor 세부 지표를 볼 때만 열리는 보조 모달 */}
            {activeReportMatch && (
                <div
                    className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto"
                    onClick={() => setActiveReportMatch(null)}
                >
                    <div
                        className="bg-white border border-slate-300 rounded-2xl max-w-2xl w-full overflow-hidden shadow-2xl my-8 text-slate-900"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="bg-[#003996] text-white p-5 flex items-start justify-between gap-4">
                            <div>
                                <span className="px-2.5 py-0.5 rounded bg-white text-[#003996] text-xs font-extrabold">
                                    {data.round_title} · {activeReportMatch.game_no_label}
                                </span>
                                <h3 className="text-xl font-black text-white mt-2">
                                    {activeReportMatch.home_ko} ({activeReportMatch.betman_home}) vs {activeReportMatch.away_ko} ({activeReportMatch.betman_away})
                                </h3>
                            </div>
                            <button
                                onClick={() => setActiveReportMatch(null)}
                                className="px-3 py-1.5 rounded-lg bg-white/15 hover:bg-white/25 text-white text-xs font-bold cursor-pointer"
                            >
                                ✕ 닫기
                            </button>
                        </div>
                        <div className="p-5 space-y-4">
                            <p className="text-xs text-slate-700 leading-relaxed">
                                {activeReportMatch.ai_detail_report?.tactical_summary || activeReportMatch.trap_reason}
                            </p>
                            {activeReportMatch.ai_detail_report?.seven_factors && (
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                    {activeReportMatch.ai_detail_report.seven_factors.map((f, idx) => (
                                        <div key={idx} className="rounded-lg bg-slate-50 border border-slate-200 p-2.5">
                                            <div className="flex items-center justify-between text-xs mb-1">
                                                <span className="font-bold text-slate-800">{f.name}</span>
                                                <span className="font-black text-[#0046b8]">{f.score}점</span>
                                            </div>
                                            <div className="w-full h-1.5 rounded-full bg-slate-200 overflow-hidden mb-1">
                                                <div style={{ width: `${f.score}%` }} className="h-full bg-[#0046b8]" />
                                            </div>
                                            <p className="text-[11px] text-slate-500">{f.comment}</p>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* 하단 법적 고지문 */}
            <div className="rounded-xl bg-white border border-slate-200 p-4 text-[11px] text-slate-500 leading-relaxed">
                <strong className="text-slate-700">[스포츠 데이터 분석 리포트 이용 안내]</strong> 스코어닉스(Scorenix)는 통계 알고리즘과 머신러닝(LightGBM·포아송 분포)을 활용하여 국내외 스포츠 경기의 전력 지수 및 기대 확률을 분석·제공하는 스포츠 데이터 분석 정보 서비스입니다. 당사는 어떠한 경우에도 사행성 행위나 금전적 베팅을 중개·권유하지 않으며, 모든 분석 리포트는 스포츠 데이터 연구 및 경기 관전 참고용으로만 제공됩니다.
            </div>
        </div>
    );
}
