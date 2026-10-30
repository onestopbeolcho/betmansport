"use client";
import React, { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { useAuth } from "../context/AuthContext";
import {
    fetchProtoRoundWithFallback,
    DEFAULT_BETMAN_CATALOG,
    BetmanGameCatalogItem,
} from "../lib/protoFallback";
import CommunityAndStoreLounge from "./CommunityAndStoreLounge";

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

type SimulationModelId = "MODEL_CONSERVATIVE" | "MODEL_STANDARD" | "MODEL_EXTENDED" | "MODEL_DEFENSIVE";

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
    const [simModel, setSimModel] = useState<SimulationModelId>("MODEL_STANDARD");
    const [filterTab, setFilterTab] = useState<"ALL" | "KILLER" | "VALUE" | "TRAP">("ALL");
    const [searchQuery, setSearchQuery] = useState("");
    const [unlockedDemo, setUnlockedDemo] = useState(false);
    const [unlockReasonBanner, setUnlockReasonBanner] = useState<string | null>(null);
    const [activeReportMatch, setActiveReportMatch] = useState<ProtoMatch | null>(null);

    // 🏪 판매점(점주) 전용 모드 & 매장 PC 전광판 상태
    const [isStoreMode, setIsStoreMode] = useState(false);
    const [storeName, setStoreName] = useState("역삼 행운복권방");
    const [kioskMode, setKioskMode] = useState(false);
    const [autoRotateGames, setAutoRotateGames] = useState(false);

    const isPaidUser = useMemo(() => {
        if (isStoreMode || unlockedDemo) return true;
        if (!user) return false;
        const role = (user.role || "").toLowerCase();
        return ["pro", "vip", "premium", "admin", "round_pass", "store_b2b"].includes(role);
    }, [user, unlockedDemo, isStoreMode]);

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
            // 매장 QR코드(?utm_source=b2b_qr)로 접속한 오프라인 매장 방문객은 자동 잠금 해제
            const params = new URLSearchParams(window.location.search);
            if (params.get("utm_source") === "b2b_qr") {
                localStorage.setItem("scorenix_round_pass_unlocked", "true");
                setUnlockedDemo(true);
                setUnlockReasonBanner("🏪 오프라인 판매점 방문 QR 인증이 완료되어 전체 리포트가 무료 개방되었습니다.");
            } else if (localStorage.getItem("scorenix_round_pass_unlocked") === "true") {
                setUnlockedDemo(true);
            }

            const syncStore = () => {
                const stMode = localStorage.getItem("scorenix_store_mode") === "true";
                const stName = localStorage.getItem("scorenix_b2b_store_name") || "공식 제휴 판매점";
                const stKiosk = localStorage.getItem("scorenix_store_kiosk") === "true";
                setIsStoreMode(stMode);
                setStoreName(stName);
                setKioskMode(stMode && stKiosk);
            };
            syncStore();
            window.addEventListener("scorenix-store-mode-change", syncStore);
            return () => window.removeEventListener("scorenix-store-mode-change", syncStore);
        }
    }, []);

    useEffect(() => {
        loadGameReport("G011_260065", true);
    }, []);

    const catalogGames: BetmanGameCatalogItem[] = useMemo(() => {
        if (data?.available_games && data.available_games.length > 0) {
            return data.available_games;
        }
        return DEFAULT_BETMAN_CATALOG;
    }, [data]);

    // 매장 PC 전광판 자동 순환 타이머 (20초 간격)
    useEffect(() => {
        if (!isStoreMode || !autoRotateGames || catalogGames.length <= 1) return;
        const timer = setInterval(() => {
            const idx = catalogGames.findIndex((g) => g.game_key === selectedGameKey);
            const nextIdx = (idx + 1) % catalogGames.length;
            loadGameReport(catalogGames[nextIdx].game_key);
        }, 20000);
        return () => clearInterval(timer);
    }, [isStoreMode, autoRotateGames, catalogGames, selectedGameKey]);

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

    // ─── 14경기 패키지 게임(축구 승무패 / 농구 승5패) 전용 통합 밸런스 시뮬레이션 엔진 ───
    const pool14Strategies: MatchMarkingStrategy[] = useMemo(() => {
        if (!data?.matches || !is14PoolGame) return [];
        const midCode: "무" | "5" = isW5LGame ? "5" : "무";

        const dualCountTarget =
            simModel === "MODEL_CONSERVATIVE"
                ? 3
                : simModel === "MODEL_STANDARD"
                ? 4
                : simModel === "MODEL_EXTENDED"
                ? 5
                : 4;
        const tripleCountTarget = simModel === "MODEL_DEFENSIVE" ? 1 : 0;

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

            const voteHome = m.vote_home_pct || 0;
            const voteAway = m.vote_away_pct || 0;
            const maxVote = Math.max(voteHome, voteAway);
            const correspAi = voteHome >= voteAway ? pHome : pAway;
            const voteOverheat = maxVote - correspAi;

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
            let roleBadge = "📌 단독 우위 (1순위)";
            let activeMarks: ("승" | "무" | "5" | "패")[] = [primary.code];
            let strategyReason = "";

            if (isTriple) {
                role = "TRIPLE_TRAP";
                roleBadge = "⚠️ 혼전 경보 (3방향 검토)";
                activeMarks = ["승", midCode, "패"];
                strategyReason = `대중 선호도 대비 AI 이변·${midCode} 지수가 가장 높은 최대 혼전 경기입니다. 3방향 전수 검토로 변수에 대비합니다.`;
            } else if (isDual) {
                role = "DUAL";
                roleBadge = "🛡️ 경합 주의 (1·2순위 병행)";
                activeMarks = [primary.code, secondary.code];
                strategyReason = `1순위 [${primary.code}](${primary.prob}%)와 2순위 [${secondary.code}](${secondary.prob}%) 격차가 좁아 [${primary.code}+${secondary.code}] 병행 검토가 필요한 구간입니다.`;
            } else {
                role = "BANKER";
                roleBadge = "📌 단독 우위 (1순위)";
                activeMarks = [primary.code];
                strategyReason = `AI 1순위 [${primary.code}](${primary.prob}%) 우위가 뚜렷하여 단독 우위(안정권)로 분류된 경기입니다.`;
            }

            const voteGapComment =
                voteOverheat >= 10
                    ? `⚠️ 대중 선호 과열 (+${voteOverheat.toFixed(0)}%p 괴리)`
                    : voteOverheat <= -10
                    ? `💡 데이터 저평가 구간 (AI 우위 +${Math.abs(voteOverheat).toFixed(0)}%p)`
                    : `선호도·AI 확률 일치 안정권`;

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
    }, [data, is14PoolGame, isW5LGame, simModel]);

    const poolSummary = useMemo(() => {
        if (!is14PoolGame || pool14Strategies.length === 0) {
            return { bankers: 0, duals: 0, triples: 0 };
        }
        const bankers = pool14Strategies.filter((s) => s.role === "BANKER").length;
        const duals = pool14Strategies.filter((s) => s.role === "DUAL").length;
        const triples = pool14Strategies.filter((s) => s.role === "TRIPLE_TRAP").length;
        return { bankers, duals, triples };
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

    const handleUnlockReward = (reason: string) => {
        try {
            localStorage.setItem("scorenix_round_pass_unlocked", "true");
        } catch {
            // ignore
        }
        setUnlockedDemo(true);
        setUnlockReasonBanner(`✅ [${reason}] 혜택이 적용되어 이번 회차 모든 경합·핵심 구간의 잠금이 해제되었습니다.`);
    };

    const toggleStoreKiosk = () => {
        const next = !kioskMode;
        setKioskMode(next);
        try {
            localStorage.setItem("scorenix_store_kiosk", next ? "true" : "false");
        } catch {
            // ignore
        }
    };

    if (loading) {
        return (
            <div className="min-h-[70vh] flex flex-col items-center justify-center px-4 text-center bg-[#f4f6f9]">
                <div className="w-11 h-11 rounded-full border-4 border-[#0046b8] border-t-transparent animate-spin mb-4" />
                <p className="text-slate-900 font-extrabold text-lg">베트맨 공식 대상 경기 및 AI 통합 분석 리포트를 불러오는 중입니다...</p>
                <p className="text-slate-500 text-xs mt-1">승무패 14경기 통합 분석표 · 승5패 · 스페셜N 득점구간 · 프로토 승부식 데이터 동기화</p>
            </div>
        );
    }

    if (!data) return null;

    const qrTargetUrl = `https://scorenix.com/ko?utm_source=b2b_qr&round=${data.round_id || "current"}`;
    const qrImgUrl = `https://api.qrserver.com/v1/create-qr-code/?size=140x140&margin=2&data=${encodeURIComponent(qrTargetUrl)}`;

    return (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6 text-slate-900">
            {/* ═══════════════════════════════════════════════════════════════════════════
                🏪 판매점(점주) 전용 컨트롤 바 & 매장 PC 모니터 전광판 헤더
               ═══════════════════════════════════════════════════════════════════════════ */}
            {isStoreMode ? (
                <div className="rounded-2xl bg-[#003996] text-white p-5 sm:p-6 shadow-lg border-2 border-amber-400 space-y-4">
                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                        <div className="space-y-1.5">
                            <div className="flex flex-wrap items-center gap-2">
                                <span className="px-2.5 py-1 rounded bg-amber-400 text-slate-950 text-xs font-black">
                                    🏪 판매점(점주) 전용 모드 작동 중
                                </span>
                                <span className="px-2.5 py-1 rounded bg-white/15 text-white text-xs font-bold">
                                    전 경기 잠금 100% 해제됨
                                </span>
                                {kioskMode && (
                                    <span className="px-2.5 py-1 rounded bg-emerald-400 text-slate-950 text-xs font-black">
                                        🖥️ 매장 PC 모니터 전광판 뷰 활성화
                                    </span>
                                )}
                            </div>
                            <h2 className="text-xl sm:text-2xl font-black tracking-tight">
                                [{storeName}] 방문 고객 전용 — 베트맨 전 게임 AI 통합 분석 전광판
                            </h2>
                            <p className="text-xs sm:text-sm text-blue-100">
                                매장 PC 모니터에 이 화면을 띄워두시거나, 우측 <strong>[🖨️ A4 벽보 원클릭 인쇄]</strong> 버튼으로 출력하여 매장 게시판에 부착해 두세요.
                            </p>
                        </div>

                        {/* 우측 매장 방문객 스마트폰 연동 QR + 컨트롤 버튼 */}
                        <div className="flex flex-wrap items-center gap-3 shrink-0">
                            <div className="flex items-center gap-2.5 bg-white text-slate-900 rounded-xl p-2.5 shadow-sm">
                                <img
                                    src={qrImgUrl}
                                    alt="매장 방문객 무료 열람 QR"
                                    className="w-14 h-14 rounded border border-slate-200"
                                />
                                <div className="text-xs pr-1">
                                    <div className="font-black text-[#003996]">📱 매장 손님 전용 QR</div>
                                    <div className="text-[11px] text-slate-600 leading-tight mt-0.5">
                                        스캔 시 스마트폰에서도
                                        <br />
                                        전 경기 무료 잠금해제!
                                    </div>
                                </div>
                            </div>

                            <div className="flex flex-col gap-1.5">
                                <button
                                    type="button"
                                    onClick={toggleStoreKiosk}
                                    className={`px-4 py-2 rounded-lg text-xs font-black transition cursor-pointer ${
                                        kioskMode
                                            ? "bg-emerald-400 text-slate-950"
                                            : "bg-white text-[#003996] hover:bg-blue-50"
                                    }`}
                                >
                                    {kioskMode ? "🖥️ PC 전광판 모드 켜짐" : "🖥️ PC 전광판 모드 켜기"}
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setAutoRotateGames(!autoRotateGames)}
                                    className={`px-4 py-2 rounded-lg text-xs font-black transition cursor-pointer ${
                                        autoRotateGames
                                            ? "bg-amber-400 text-slate-950"
                                            : "bg-white/15 text-white hover:bg-white/25"
                                    }`}
                                >
                                    {autoRotateGames ? "🔄 20초 게임 자동순환 중" : "🔄 전 게임 자동순환 켜기"}
                                </button>
                                <Link
                                    href={`/ko/store/print-report/${data.game_key || data.round_id}`}
                                    className="px-4 py-2 rounded-lg bg-amber-400 hover:bg-amber-300 !text-slate-950 text-xs font-black text-center transition"
                                >
                                    🖨️ 현재 게임 A4 벽보 인쇄
                                </Link>
                            </div>
                        </div>
                    </div>
                </div>
            ) : (
                /* 일반 방문자용 상단 O2O 안내 배너 (오프라인 판매점 유도 + 점주 로그인 안내) */
                <div className="rounded-xl bg-white border border-slate-200 border-l-4 border-l-[#0046b8] p-4 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 shadow-xs">
                    <div className="flex items-start sm:items-center gap-3">
                        <span className="px-2.5 py-1 rounded-md bg-[#0046b8] text-white text-xs font-extrabold tracking-tight shrink-0">
                            전국 6,500개 판매점 O2O 연동
                        </span>
                        <div>
                            <p className="text-slate-900 font-extrabold text-sm sm:text-base">
                                온라인 무료 화면에서는 핵심 승부처 지표가 일부 제한됩니다 — <span className="text-[#0046b8]">동네 판매점 비치본 또는 커뮤니티 참여로 전체 열람하세요!</span>
                            </p>
                            <p className="text-slate-500 text-xs mt-0.5">
                                전국 스코어닉스 등록 판매점(매장 내 PC 모니터 전광판 &amp; A4 출력 벽보)에서는 14경기 전체 리포트가 100% 무료 개방됩니다.
                            </p>
                        </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 shrink-0">
                        <a
                            href="#community-lounge"
                            className="px-4 py-2 rounded-lg bg-[#0046b8] hover:bg-[#00358e] !text-white text-xs font-extrabold transition shadow-xs whitespace-nowrap"
                        >
                            💬 커뮤니티 참여 · 단골매장 신청 (무료해금) ↓
                        </a>
                    </div>
                </div>
            )}

            {unlockReasonBanner && (
                <div className="rounded-xl bg-emerald-50 border border-emerald-300 px-4 py-3 text-xs sm:text-sm font-extrabold text-emerald-900 flex items-center justify-between">
                    <span>{unlockReasonBanner}</span>
                    <button
                        type="button"
                        onClick={() => setUnlockReasonBanner(null)}
                        className="text-xs text-emerald-700 hover:underline cursor-pointer"
                    >
                        닫기
                    </button>
                </div>
            )}

            {/* 1. 베트맨 공식 운영 게임 선택 섹션 */}
            <section className="rounded-xl bg-white border border-slate-200 border-t-4 border-t-[#0046b8] p-5 sm:p-6 shadow-xs space-y-4">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-slate-200 pb-4">
                    <div>
                        <div className="flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-[#0046b8]" />
                            <span className="text-[#0046b8] text-xs font-extrabold tracking-wide">
                                현재 운영 중인 공식 회차 목록 ({catalogGames.length}개 회차)
                            </span>
                        </div>
                        <h2 className="text-lg sm:text-xl font-black text-slate-900 mt-1">
                            베트맨 공식 회차별 AI 통합 데이터 리포트 선택
                        </h2>
                        <p className="text-xs text-slate-500 mt-0.5">
                            회차를 선택하면 해당 종목 규격(14경기 통합 승무패·승5패 / 농구 6구간 득점 분포 / 프로토 승부식)에 최적화된 통합 리포트가 즉시 표시됩니다.
                        </p>
                    </div>

                    {/* 게임 카테고리 필터 탭 */}
                    <div className="flex flex-wrap gap-1.5">
                        {[
                            { id: "ALL", label: "전체 회차" },
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
                                {isSelected && (
                                    <div className="mt-2 text-[11px] font-extrabold text-[#0046b8] flex items-center justify-between">
                                        <span>✓ 현재 조회 중인 회차</span>
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
                            <span>선택하신 회차의 통합 AI 데이터 리포트를 생성하는 중...</span>
                        </div>
                    </div>
                )}

                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                    <div className="space-y-2.5">
                        <div className="flex flex-wrap items-center gap-2">
                            <span className="px-2.5 py-1 rounded bg-slate-100 border border-slate-300 text-slate-800 text-xs font-extrabold">
                                종목코드: {data.gm_id || "G011"} · 제 {data.display_round_no}회차
                            </span>
                            <span className="px-2.5 py-1 rounded bg-blue-50 border border-blue-200 text-[#0046b8] text-xs font-bold">
                                ✓ {is14PoolGame ? "14경기 전체 단독우위·경합구간 통합 분류" : isSpecialGame ? "전 경기 6구간 득점 분포 통합 시뮬레이션" : "베트맨 정식 구단 매칭 완료"}
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
                                    ? "14경기 통합 AI 밸런스 분석 리포트"
                                    : isSpecialGame
                                    ? "전 경기 6구간 득점 분포 AI 통합 리포트"
                                    : "AI 핵심 우위 경기 & 전력 리포트"}
                            </span>
                        </h1>
                        <div className="inline-block rounded-lg bg-slate-50 border border-slate-200 px-3.5 py-2 text-xs text-slate-700 font-semibold">
                            📌 <strong>회차 통합 분석 안내:</strong>{" "}
                            {is14PoolGame
                                ? "14경기 전체의 전력 격차와 선호도 분포를 종합 평가하여, 1순위 확률이 뚜렷한 [단독 우위 경기]와 박빙 변수가 존재하는 [경합·복수 검토 경기]를 한 판의 표로 분류해 제공합니다."
                                : isSpecialGame
                                ? "대상 2~3경기의 홈·원정 예상 득점 구간(6구간) 분포를 시뮬레이션하여 각 팀의 1순위 유력 구간과 2순위 보조 구간을 한눈에 제시합니다."
                                : data.rule_summary}
                        </div>
                    </div>

                    {/* 우측 오프라인 판매점 & 온라인 열람 안내 박스 */}
                    <div className="flex flex-col gap-2 shrink-0 min-w-[300px] bg-slate-50 p-4 rounded-xl border border-slate-200">
                        {!isPaidUser ? (
                            <>
                                <div className="text-xs font-extrabold text-slate-800 text-center mb-0.5">
                                    🔒 핵심 승부처 잠금 해제 방법 (택 1)
                                </div>
                                <a
                                    href="#community-lounge"
                                    className="px-4 py-2.5 rounded-lg bg-[#0046b8] hover:bg-[#00358e] !text-white font-extrabold text-xs text-center shadow-xs transition"
                                >
                                    💬 커뮤니티 의견 남기거나 단골매장 신청 (무료)
                                </a>
                                <div className="grid grid-cols-2 gap-2">
                                    <Link
                                        href="/ko/login?mode=store"
                                        className="px-3 py-2 rounded-lg bg-amber-50 hover:bg-amber-100 border border-amber-300 text-amber-900 text-xs font-extrabold text-center transition"
                                    >
                                        🏪 판매점 점주 로그인
                                    </Link>
                                    <Link
                                        href={`/ko/payment/request?plan=round_pass&billing=once&round=${data.round_id}`}
                                        className="px-3 py-2 rounded-lg bg-white hover:bg-slate-100 border border-slate-300 text-slate-700 text-xs font-bold text-center transition"
                                    >
                                        ⚡ 즉시 열람 (1,500원)
                                    </Link>
                                </div>
                            </>
                        ) : (
                            <>
                                <div className="px-4 py-2.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 font-extrabold text-xs text-center">
                                    ✅ {isStoreMode ? `[${storeName}] 판매점 모드 전체 개방 중` : "이번 회차 통합 리포트 전체 열람 중"}
                                </div>
                                <div className="grid grid-cols-2 gap-2">
                                    <Link
                                        href={`/ko/store/print-report/${data.game_key || data.round_id}`}
                                        className="px-3 py-2 rounded-lg bg-[#0046b8] hover:bg-[#00358e] !text-white text-xs font-extrabold text-center transition"
                                    >
                                        🖨️ A4 한장 인쇄뷰
                                    </Link>
                                    <a
                                        href="#community-lounge"
                                        className="px-3 py-2 rounded-lg bg-white hover:bg-slate-100 border border-slate-300 text-slate-700 text-xs font-bold text-center transition"
                                    >
                                        💬 승부예측 토론방
                                    </a>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            </section>

            {/* ═══════════════════════════════════════════════════════════════════════════
                MODE A: 축구토토 승무패(G011) / 농구토토 승5패(G027) — 14경기 통합 밸런스 리포트
               ═══════════════════════════════════════════════════════════════════════════ */}
            {is14PoolGame && (
                <>
                    {/* A-1. 시뮬레이션 모델 선택 & 단독우위/경합구간 자동 분류 요약 */}
                    <section className="rounded-xl bg-white border-2 border-[#0046b8] p-5 sm:p-6 shadow-xs space-y-5">
                        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-200 pb-4">
                            <div>
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded bg-blue-50 text-[#0046b8] border border-blue-200 text-xs font-extrabold">
                                    📋 STEP 1 · 14경기 단독 우위 &amp; 경합 주의 구간 자동 분류 모델
                                </span>
                                <h2 className="text-lg sm:text-xl font-black text-slate-900 mt-1.5">
                                    {data.round_title} — 한눈에 보는 14경기 전력 밸런스 분류표
                                </h2>
                                <p className="text-xs text-slate-500 mt-0.5">
                                    분석 모델을 선택하면 AI가 14경기 전체의 기대 승률 격차와 대중 선호도 괴리를 계산해 <strong>단독 우위 경기(1순위 고정)</strong>와 <strong>경합 주의 경기(1·2순위 병행 검토)</strong>를 자동 분류합니다.
                                </p>
                            </div>

                            <div className="flex flex-wrap gap-2">
                                {(
                                    [
                                        { id: "MODEL_CONSERVATIVE", title: "안정형 분석 모델", sub: "단독우위 11 + 경합검토 3경기" },
                                        { id: "MODEL_STANDARD", title: "표준형 분석 모델", sub: "단독우위 10 + 경합검토 4경기" },
                                        { id: "MODEL_EXTENDED", title: "정밀형 분석 모델", sub: "단독우위 9 + 경합검토 5경기" },
                                        { id: "MODEL_DEFENSIVE", title: "심층방어형 모델", sub: "단독우위 9 + 경합 4 + 혼전 1" },
                                    ] as const
                                ).map((p) => (
                                    <button
                                        key={p.id}
                                        onClick={() => setSimModel(p.id)}
                                        className={`px-3.5 py-2 rounded-xl text-left border transition cursor-pointer ${
                                            simModel === p.id
                                                ? "bg-[#0046b8] text-white border-[#0046b8] shadow-sm"
                                                : "bg-slate-50 text-slate-800 border-slate-300 hover:bg-slate-100"
                                        }`}
                                    >
                                        <div className="text-xs font-black">{p.title}</div>
                                        <div className={`text-[10px] mt-0.5 ${simModel === p.id ? "text-blue-100" : "text-slate-500"}`}>
                                            {p.sub}
                                        </div>
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* 3대 분류 요약 박스 */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            {/* 1) 단독 우위 경기 */}
                            <div className="rounded-xl bg-blue-50/50 border border-blue-200 p-4 space-y-2.5">
                                <div className="flex items-center justify-between">
                                    <span className="px-2.5 py-1 rounded bg-[#0046b8] text-white text-xs font-extrabold">
                                        📌 단독 우위 구간 ({poolSummary.bankers}경기)
                                    </span>
                                    <span className="text-xs font-bold text-[#0046b8]">1순위 확률 우세</span>
                                </div>
                                <p className="text-xs text-slate-600">
                                    AI 1순위 기대 확률 우위가 명확하여 <strong>단일 방향(1순위)</strong> 신뢰도가 가장 높은 핵심 경기입니다.
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

                            {/* 2) 경합 주의 (오프라인 매장 / 커뮤니티 해금 대상) */}
                            <div className="rounded-xl bg-amber-50/60 border border-amber-200 p-4 space-y-2.5">
                                <div className="flex items-center justify-between">
                                    <span className="px-2.5 py-1 rounded bg-amber-500 text-white text-xs font-extrabold">
                                        🛡️ 경합 주의 구간 ({poolSummary.duals}경기)
                                    </span>
                                    <span className="text-xs font-bold text-amber-800">
                                        {isPaidUser ? "전체 공개됨" : "🏪 판매점/커뮤니티 공개"}
                                    </span>
                                </div>
                                <p className="text-xs text-slate-600">
                                    전력 차가 좁거나 {isW5LGame ? "5점차 이내 접전(5)" : "무승부"} 가능성이 높아 <strong>1·2순위 복수 지표 검토</strong>가 권장되는 핵심 승부처입니다.
                                </p>
                                {isPaidUser ? (
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
                                ) : (
                                    <div className="p-2.5 rounded-lg bg-white border border-amber-300 text-xs text-amber-900 font-bold flex items-center justify-between">
                                        <span>🔒 경합 {poolSummary.duals}경기 복수 지표는 판매점 비치본 또는 커뮤니티 참여 시 열립니다.</span>
                                        <a href="#community-lounge" className="text-[#0046b8] underline shrink-0 ml-2">
                                            무료 열기 ↓
                                        </a>
                                    </div>
                                )}
                            </div>

                            {/* 3) 선호도 쏠림 & 이변 주의 경보 */}
                            <div className="rounded-xl bg-rose-50/60 border border-rose-200 p-4 space-y-2.5">
                                <div className="flex items-center justify-between">
                                    <span className="px-2.5 py-1 rounded bg-rose-600 text-white text-xs font-extrabold">
                                        ⚠️ 이변 · 혼전 주의보 ({data.section_c_traps.length}경기)
                                    </span>
                                    <span className="text-xs font-bold text-rose-700">선호도·AI 데이터 괴리</span>
                                </div>
                                <p className="text-xs text-slate-600">
                                    대중 투표 선호도는 한쪽으로 쏠렸으나 AI 기대 승률은 낮아 <strong>이변 및 접전 변수</strong>가 가장 큰 구간입니다.
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
                                                접전·변수 지수 {tm.upset_or_draw_prob}%
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </section>

                    {/* A-2. 14경기 전체 통합 시뮬레이션 지표 표 */}
                    <section className="rounded-xl bg-white border border-slate-300 overflow-hidden shadow-xs">
                        <div className="p-4 sm:p-5 bg-slate-50 border-b border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-4">
                            <div>
                                <div className="flex items-center gap-2">
                                    <span className="px-2.5 py-0.5 rounded bg-[#0046b8] text-white text-xs font-extrabold">
                                        STEP 2 · 14경기 통합 분석표
                                    </span>
                                    <span className="text-xs font-bold text-slate-600">
                                        단독 우위 {poolSummary.bankers}경기 · 경합 주의 {poolSummary.duals}경기
                                        {poolSummary.triples > 0 ? ` · 혼전 경보 ${poolSummary.triples}경기` : ""}
                                    </span>
                                </div>
                                <h2 className="text-lg sm:text-xl font-black text-slate-900 mt-1">
                                    📊 {data.round_title} — 1번~14번 통합 AI 예측 지표 &amp; 전술 코멘트
                                </h2>
                                <p className="text-xs text-slate-500 mt-0.5">
                                    파란색(<strong className="text-[#0046b8]">● 1순위 주력 지표</strong>)과 주황색(<strong className="text-amber-600">● 2순위 경합 보조 지표</strong>)으로 표시된 14경기 전체 밸런스를 한눈에 확인하실 수 있습니다.
                                </p>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                                <Link
                                    href={`/ko/store/print-report/${data.game_key || data.round_id}`}
                                    className="px-4 py-2.5 rounded-lg bg-[#0046b8] hover:bg-[#00358e] !text-white text-xs font-extrabold transition shadow-xs"
                                >
                                    🖨️ 이 14경기 통합표 A4 출력하기
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
                                            AI 확률 vs 투표 선호도 비교
                                        </th>
                                        <th className="py-3 px-3 w-36 border-r border-slate-700 text-center">구간 분류</th>
                                        <th className="py-3 px-3 w-48 border-r border-slate-700 text-center bg-[#003996]">
                                            AI 시뮬레이션 지표 ({isW5LGame ? "승 / 5 / 패" : "승 / 무 / 패"})
                                        </th>
                                        <th className="py-3 px-3">AI 통합 분석 근거 &amp; 전술 핵심</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-200 text-xs">
                                    {pool14Strategies.map((item, idx) => {
                                        const m = item.match;
                                        const midLabel: "무" | "5" = isW5LGame ? "5" : "무";
                                        const pHome = isW5LGame && m.w5l_analysis ? m.w5l_analysis.win_prob : m.ai_home_prob;
                                        const pMid = isW5LGame && m.w5l_analysis ? m.w5l_analysis.close5_prob : m.ai_draw_prob;
                                        const pAway = isW5LGame && m.w5l_analysis ? m.w5l_analysis.lose_prob : m.ai_away_prob;

                                        // 온라인 무료 유저에게는 경합/혼전 승부처(DUAL/TRIPLE_TRAP) 및 핵심 경기(총 6경기 내외)의 지표를 제한하여 오프라인 매장 방문 또는 커뮤니티 참여 유도
                                        const isLockedRow =
                                            !isPaidUser && (item.role !== "BANKER" || m.is_killer_pick);

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

                                                {/* 4. AI 확률 vs 투표 선호도 */}
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
                                                                <span>선호비율:</span>
                                                                <span>
                                                                    승 {m.vote_home_pct}% · {midLabel} {m.vote_mid_pct}% · 패 {m.vote_away_pct}%
                                                                </span>
                                                            </div>
                                                        ) : null}
                                                    </div>
                                                </td>

                                                {/* 5. 구간 분류 배지 */}
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

                                                {/* 6. AI 시뮬레이션 지표 ([승] [무/5] [패]) */}
                                                <td className="py-3 px-3 border-r border-slate-200 text-center bg-blue-50/20">
                                                    {isLockedRow ? (
                                                        <div className="flex flex-col items-center gap-1">
                                                            <a
                                                                href="#community-lounge"
                                                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-amber-50 border border-amber-300 text-amber-900 font-extrabold text-[11px] hover:bg-amber-100"
                                                            >
                                                                🔒 판매점 비치본 / 라운지 열람
                                                            </a>
                                                        </div>
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

                                                {/* 7. AI 통합 분석 근거 */}
                                                <td className="py-3 px-3">
                                                    {isLockedRow ? (
                                                        <p className="text-xs text-slate-500 font-semibold">
                                                            🔒 핵심 경합·승부처 상세 해설은 <strong className="text-[#0046b8]">오프라인 판매점 전광판/A4 벽보</strong> 또는 아래 <a href="#community-lounge" className="text-[#0046b8] underline">승부예측 커뮤니티 참여</a> 시 즉시 공개됩니다.
                                                        </p>
                                                    ) : (
                                                        <>
                                                            <p className="text-xs font-bold text-slate-800 leading-snug">
                                                                {item.strategyReason}
                                                            </p>
                                                            <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">
                                                                {m.ai_detail_report?.tactical_summary || m.trap_reason}
                                                            </p>
                                                        </>
                                                    )}
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
               ═══════════════════════════════════════════════════════════════════════════ */}
            {isSpecialGame && (
                <section className="rounded-xl bg-white border-2 border-[#0046b8] p-5 sm:p-6 shadow-xs space-y-5">
                    <div className="border-b border-slate-200 pb-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
                        <div>
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded bg-blue-50 text-[#0046b8] border border-blue-200 text-xs font-extrabold">
                                🏀 {data.game_name} 통합 득점구간 시뮬레이션 표
                            </span>
                            <h2 className="text-lg sm:text-xl font-black text-slate-900 mt-1">
                                {data.round_title} — 대상 {data.matches.length}경기 홈·원정 6구간 득점 확률 리포트
                            </h2>
                            <p className="text-xs text-slate-500 mt-0.5">
                                각 경기의 홈팀·원정팀 6개 득점 구간 중 <strong className="text-[#0046b8]">★1순위 유력 구간</strong>과 <strong className="text-amber-600">☆2순위 보조 구간</strong>을 한 화면에서 바로 확인하세요.
                            </p>
                        </div>
                    </div>

                    <div className="space-y-6">
                        {data.matches.map((m, mIdx) => {
                            const sb = m.special_brackets;
                            if (!sb) return null;
                            const isSpecialLocked = !isPaidUser && mIdx >= 1;
                            return (
                                <div
                                    key={m.game_no}
                                    className="rounded-xl bg-slate-50 border border-slate-300 overflow-hidden"
                                >
                                    <div className="bg-[#1e293b] text-white px-4 py-3 flex flex-wrap items-center justify-between gap-3">
                                        <div className="flex items-center gap-2.5">
                                            <span className="px-2.5 py-1 rounded bg-[#0046b8] text-white text-xs font-black">
                                                {m.game_no}경기 득점구간 분석
                                            </span>
                                            <span className="text-sm sm:text-base font-black">
                                                홈 {m.home_ko}({m.betman_home}) vs 원정 {m.away_ko}({m.betman_away})
                                            </span>
                                        </div>
                                        <div className="text-xs text-slate-300 font-semibold">
                                            {m.league} · {m.kickoff_display} · AI 예상 총점 {sb.expected_total_pts}점
                                        </div>
                                    </div>

                                    {isSpecialLocked ? (
                                        <div className="p-6 text-center space-y-3 bg-white">
                                            <p className="text-sm font-black text-slate-900">
                                                🔒 {m.game_no}경기 ({m.home_ko} vs {m.away_ko}) 6구간 유력 득점 분포는 오프라인 판매점 비치본 또는 커뮤니티 참여 시 열람됩니다.
                                            </p>
                                            <div className="flex flex-wrap justify-center gap-2">
                                                <a
                                                    href="#community-lounge"
                                                    className="px-4 py-2 rounded-lg bg-[#0046b8] text-white text-xs font-extrabold"
                                                >
                                                    💬 아래 커뮤니티 의견 남기고 무료 열기 ↓
                                                </a>
                                                <Link
                                                    href="/ko/login?mode=store"
                                                    className="px-4 py-2 rounded-lg bg-amber-50 border border-amber-300 text-amber-900 text-xs font-extrabold"
                                                >
                                                    🏪 판매점 모드 로그인
                                                </Link>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="p-4 space-y-4">
                                            {currentGameType === "BASKETBALL_MATCH" && (
                                                <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 flex flex-wrap items-center justify-between gap-2 text-xs">
                                                    <span className="font-extrabold text-amber-900">
                                                        ⏱️ 전반(1·2쿼터 합산) 유력 득점구간 시뮬레이션:
                                                    </span>
                                                    <span className="font-black text-slate-900">
                                                        홈({m.betman_home}) 전반 예상 {sb.half_expected_home_pts}점 →{" "}
                                                        <strong className="text-[#0046b8]">[{sb.half_home_top_bracket}]</strong> / 원정({m.betman_away}) 전반 예상 {sb.half_expected_away_pts}점 →{" "}
                                                        <strong className="text-[#0046b8]">[{sb.half_away_top_bracket}]</strong>
                                                    </span>
                                                </div>
                                            )}

                                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
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
                                                        유력 구간 분포:{" "}
                                                        <strong className="text-[#0046b8]">1순위 [{sb.home_top1_bracket}]</strong> +{" "}
                                                        <strong className="text-amber-700">2순위 [{sb.home_top2_bracket}]</strong> (합산 기대확률{" "}
                                                        {(sb.home_top1_prob + sb.home_top2_prob).toFixed(1)}%)
                                                    </div>
                                                </div>

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
                                                        유력 구간 분포:{" "}
                                                        <strong className="text-[#0046b8]">1순위 [{sb.away_top1_bracket}]</strong> +{" "}
                                                        <strong className="text-amber-700">2순위 [{sb.away_top2_bracket}]</strong> (합산 기대확률{" "}
                                                        {(sb.away_top1_prob + sb.away_top2_prob).toFixed(1)}%)
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </section>
            )}

            {/* ═══════════════════════════════════════════════════════════════════════════
                MODE C: 프로토 승부식(G101) — 다수 대상 경기 중 핵심 우위 경기 선별 & 전체 경기 일람표
               ═══════════════════════════════════════════════════════════════════════════ */}
            {!is14PoolGame && !isSpecialGame && (
                <>
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                        <div className="rounded-xl bg-white border border-slate-200 p-5 space-y-3.5 shadow-xs">
                            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                                <div>
                                    <span className="text-[11px] font-extrabold text-[#0046b8]">
                                        프로토 승부식 상위 신뢰도 경기 선별
                                    </span>
                                    <h2 className="text-base sm:text-lg font-black text-slate-900 mt-0.5">
                                        🎯 [{data.round_title}] AI 신뢰도 85% 이상 핵심 우위 경기
                                    </h2>
                                </div>
                                <span className="px-2.5 py-1 rounded bg-blue-50 text-[#0046b8] text-xs font-bold border border-blue-200">
                                    {isPaidUser ? "전체 공개" : "🔒 판매점/커뮤니티 공개"}
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
                                        🔒 [{data.round_title}] 전체 {data.total_matches}경기 중 AI 핵심 우위 경기 ({data.killer_picks_count}경기)
                                    </p>
                                    <p className="text-slate-500 text-xs">
                                        오프라인 판매점 전광판/A4 벽보에서 확인하시거나 아래 승부예측 커뮤니티에 의견을 남기면 무료로 열립니다.
                                    </p>
                                    <div className="flex flex-wrap justify-center gap-2 pt-1">
                                        <a
                                            href="#community-lounge"
                                            className="px-4 py-2 rounded-lg bg-[#0046b8] hover:bg-[#00358e] text-white font-extrabold text-xs transition"
                                        >
                                            💬 커뮤니티 참여하고 무료 열기 ↓
                                        </a>
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="rounded-xl bg-white border border-slate-200 p-5 space-y-3.5 shadow-xs">
                            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                                <div>
                                    <span className="text-[11px] font-extrabold text-rose-600">
                                        변수가 큰 경합 경기 경보 (무료 공개)
                                    </span>
                                    <h2 className="text-base sm:text-lg font-black text-slate-900 mt-0.5">
                                        ⚠️ [{data.round_title}] 이변 · 무승부 주의보 경기
                                    </h2>
                                </div>
                                <span className="px-2.5 py-1 rounded bg-rose-50 text-rose-700 text-xs font-bold border border-rose-200">
                                    복수검토 권장
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

                    <section className="rounded-xl bg-white border border-slate-300 overflow-hidden shadow-xs">
                        <div className="p-4 sm:p-5 bg-slate-50 border-b border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-4">
                            <div>
                                <h2 className="text-lg sm:text-xl font-black text-slate-900">
                                    📋 {data.round_title} 대상 경기 일정 및 AI 전력 분석표 ({filteredMatches.length}경기)
                                </h2>
                                <p className="text-xs text-slate-500 mt-0.5">
                                    각 대상 경기의 AI 기대 승률과 전술 요약을 한눈에 제공합니다.
                                </p>
                            </div>

                            <div className="flex flex-wrap items-center gap-1.5">
                                {(
                                    [
                                        { id: "ALL", label: `전체 경기 (${data.matches.length})` },
                                        { id: "KILLER", label: `🎯 핵심 우위 (${data.killer_picks_count})` },
                                        { id: "VALUE", label: `📊 데이터 우위 Top 5` },
                                        { id: "TRAP", label: `⚠️ 이변 주의보` },
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
                                        <th className="py-3 px-3 text-center w-36 border-r border-slate-700">AI 분석 결론</th>
                                        <th className="py-3 px-3">전술 요약 및 분석 사유</th>
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
                                                                핵심
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
                                                        <a
                                                            href="#community-lounge"
                                                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded bg-amber-50 border border-amber-300 text-amber-900 font-extrabold text-xs"
                                                        >
                                                            🔒 판매점/라운지 열기
                                                        </a>
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
                                                    {lockedKiller ? (
                                                        <p className="text-xs text-slate-500">
                                                            🔒 핵심 우위 경기 상세 해설은 오프라인 판매점 비치본 또는 아래 커뮤니티 참여 시 공개됩니다.
                                                        </p>
                                                    ) : (
                                                        <>
                                                            <p className="text-xs text-slate-700 leading-relaxed">
                                                                {m.ai_detail_report?.tactical_summary || m.trap_reason}
                                                            </p>
                                                            <button
                                                                onClick={() => setActiveReportMatch(m)}
                                                                className="mt-1 text-[11px] font-extrabold text-[#0046b8] hover:underline cursor-pointer"
                                                            >
                                                                + 7-Factor 세부 지표 보기
                                                            </button>
                                                        </>
                                                    )}
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
                💬 회차별 승부예측 커뮤니티 & 전국 6,500개 판매점 비치 현황 / 단골매장 제보 라운지
               ═══════════════════════════════════════════════════════════════════════════ */}
            <CommunityAndStoreLounge
                roundTitle={data.round_title}
                matches={data.matches}
                userNickname={user?.nickname}
                onUnlockReward={handleUnlockReward}
            />

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

            {/* ═══════════════════════════════════════════════════════════════════════════
                🏛️ 건전 스포츠·레저문화 캠페인 및 공식 유관기관 바로가기 배너 (공신력 강화 백링크)
               ═══════════════════════════════════════════════════════════════════════════ */}
            <section className="rounded-xl bg-white border border-slate-300 p-5 shadow-xs space-y-3.5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
                    <div className="flex items-center gap-2">
                        <span className="px-2.5 py-1 rounded bg-[#003996] text-white text-xs font-extrabold">
                            🏛️ 공식 유관기관 &amp; 건전이용 안내
                        </span>
                        <h3 className="text-sm sm:text-base font-black text-slate-900">
                            건전 스포츠·레저문화 정착 캠페인 및 공식 기관 바로가기
                        </h3>
                    </div>
                    <span className="text-xs text-slate-500 font-medium">
                        클릭 시 각 공식 기관 홈페이지로 이동합니다
                    </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                    <a
                        href="https://www.betman.co.kr"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="group rounded-xl bg-slate-50 hover:bg-blue-50/60 border border-slate-200 hover:border-[#0046b8] p-3.5 flex items-center justify-between transition"
                    >
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-[#0046b8] text-white flex items-center justify-center font-black text-xs shrink-0">
                                betman
                            </div>
                            <div>
                                <div className="text-xs font-black text-slate-900 group-hover:text-[#0046b8]">
                                    베트맨 공식 홈페이지 ↗
                                </div>
                                <div className="text-[11px] text-slate-500 mt-0.5">
                                    공식 발매일정 · 투표권 안내 (betman.co.kr)
                                </div>
                            </div>
                        </div>
                    </a>

                    <a
                        href="https://www.kspo.or.kr"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="group rounded-xl bg-slate-50 hover:bg-blue-50/60 border border-slate-200 hover:border-[#0046b8] p-3.5 flex items-center justify-between transition"
                    >
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-slate-800 text-white flex items-center justify-center font-black text-xs shrink-0">
                                KSPO
                            </div>
                            <div>
                                <div className="text-xs font-black text-slate-900 group-hover:text-[#0046b8]">
                                    국민체육진흥공단 ↗
                                </div>
                                <div className="text-[11px] text-slate-500 mt-0.5">
                                    체육진흥투표권 공익기금 안내 (kspo.or.kr)
                                </div>
                            </div>
                        </div>
                    </a>

                    <a
                        href="https://www.dhlottery.co.kr"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="group rounded-xl bg-slate-50 hover:bg-blue-50/60 border border-slate-200 hover:border-[#0046b8] p-3.5 flex items-center justify-between transition"
                    >
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-emerald-700 text-white flex items-center justify-center font-black text-xs shrink-0">
                                복권위
                            </div>
                            <div>
                                <div className="text-xs font-black text-slate-900 group-hover:text-[#0046b8]">
                                    기획재정부 복권위원회 ↗
                                </div>
                                <div className="text-[11px] text-slate-500 mt-0.5">
                                    동행복권 · 건전 복권문화 캠페인
                                </div>
                            </div>
                        </div>
                    </a>

                    <a
                        href="https://www.kcgp.or.kr"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="group rounded-xl bg-slate-50 hover:bg-blue-50/60 border border-slate-200 hover:border-[#0046b8] p-3.5 flex items-center justify-between transition"
                    >
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-amber-600 text-white flex items-center justify-center font-black text-xs shrink-0">
                                1336
                            </div>
                            <div>
                                <div className="text-xs font-black text-slate-900 group-hover:text-[#0046b8]">
                                    한국도박문제예방치유원 ↗
                                </div>
                                <div className="text-[11px] text-slate-500 mt-0.5">
                                    과몰입 예방 및 건전이용 상담 (1336)
                                </div>
                            </div>
                        </div>
                    </a>
                </div>

                {/* 하단 법적 고지문 */}
                <div className="rounded-lg bg-slate-50 border border-slate-200 p-3 text-[11px] text-slate-500 leading-relaxed">
                    <strong className="text-slate-700">[스포츠 데이터 분석 리포트 이용 안내]</strong> 스코어닉스(Scorenix)는 불법 사설 스포츠도박을 근절하고 국민체육진흥공단(베트맨) 및 복권위원회의 건전 레저문화 정착 캠페인을 지지하는 독립 스포츠 통계 데이터 연구소입니다. 당사는 어떠한 경우에도 투표권 구매 대행이나 사행성 행위를 중개·권유하지 않으며, 모든 분석 리포트는 스포츠 데이터 연구 및 건전한 경기 관전 참고용으로만 제공됩니다.
                </div>
            </section>
        </div>
    );
}
