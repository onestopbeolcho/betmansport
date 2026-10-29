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
            <div className="min-h-[70vh] flex flex-col items-center justify-center px-4 text-center bg-[#f4f6f9]">
                <div className="w-11 h-11 rounded-full border-4 border-[#0046b8] border-t-transparent animate-spin mb-4" />
                <p className="text-slate-900 font-extrabold text-lg">베트맨 공식 발매 게임 및 AI 분석 리포트를 불러오는 중입니다...</p>
                <p className="text-slate-500 text-xs mt-1">승무패 · 승5패 · 스페셜N · 매치 · 프로토 승부식 실시간 데이터 동기화</p>
            </div>
        );
    }

    if (!data) return null;

    const currentGameType = data.game_type || "SOCCER_WDL";
    const isSpecialGame = currentGameType.includes("SPECIAL") || currentGameType === "BASKETBALL_MATCH";
    const isW5LGame = currentGameType === "BASKETBALL_W5L";

    return (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6 text-slate-900">
            {/* 상단 공식 안내 배너 (깔끔한 베트맨/스포츠 포털 스타일) */}
            <div className="rounded-xl bg-white border border-slate-200 border-l-4 border-l-[#0046b8] p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-xs">
                <div className="flex items-start sm:items-center gap-3">
                    <span className="px-2.5 py-1 rounded-md bg-[#0046b8] text-white text-xs font-extrabold tracking-tight shrink-0">
                        공식 발매게임 연동
                    </span>
                    <div>
                        <p className="text-slate-900 font-extrabold text-sm sm:text-base">
                            베트맨(betman.co.kr) 운영 전 종목 경기 일정 및 AI 정밀 전력 분석 리포트
                        </p>
                        <p className="text-slate-500 text-xs mt-0.5">
                            축구토토 승무패 · 농구토토 승5패 · 스페셜N 더블/트리플 · 농구 매치 · 프로토 승부식 대상 경기 완벽 대응
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                    <Link
                        href={`/ko/store/print-report/${data.game_key || data.round_id}`}
                        className="px-3.5 py-2 rounded-lg bg-[#0046b8] hover:bg-[#00358e] text-white text-xs font-bold transition shadow-xs"
                    >
                        🖨️ 현재 게임 A4 인쇄뷰
                    </Link>
                    <Link
                        href="/ko/analysis"
                        className="px-3.5 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold border border-slate-200 transition"
                    >
                        📊 7-Factor 전력 분석실 →
                    </Link>
                </div>
            </div>

            {/* 1. 베트맨 공식 운영 게임 선택 섹션 (베트맨 '구매가능 게임' 테이블 스타일) */}
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
                            베트맨 공식 게임별 AI 리포트 선택
                        </h2>
                        <p className="text-xs text-slate-500 mt-0.5">
                            분석을 원하시는 게임(승무패, 승5패, 스페셜N 더블 98회차, 프로토 승부식 등)을 클릭하면 아래 대상 경기표가 즉시 변경됩니다.
                        </p>
                    </div>

                    {/* 게임 카테고리 필터 탭 */}
                    <div className="flex flex-wrap gap-1.5">
                        {[
                            { id: "ALL", label: "전체 게임" },
                            { id: "WDL", label: "⚽ 축구토토 승무패" },
                            { id: "W5L", label: "🏀 농구토토 승5패" },
                            { id: "SPECIAL_N", label: "🏀 스페셜N (NBA)" },
                            { id: "SPECIAL_KBL", label: "🏀 스페셜·매치 (KBL)" },
                            { id: "PROTO", label: "⚡ 프로토 승부식" },
                        ].map((cat) => (
                            <button
                                key={cat.id}
                                onClick={() => setGameCatFilter(cat.id)}
                                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all border ${
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
                                className={`text-left rounded-xl p-4 transition-all border relative ${
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
                                                : "bg-slate-100 text-slate-700 border-slate-200"
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
                                        <span>리포트 보기 ↓</span>
                                    </div>
                                )}
                            </button>
                        );
                    })}
                </div>
            </section>

            {/* 2. 선택된 게임 공식 타이틀 & 열람권 / A4 인쇄 안내 */}
            <section className="rounded-xl bg-white border border-slate-200 p-5 sm:p-6 shadow-xs relative overflow-hidden">
                {switchingGame && (
                    <div className="absolute inset-0 bg-white/85 backdrop-blur-xs z-20 flex items-center justify-center">
                        <div className="flex items-center gap-3 px-5 py-3 rounded-xl bg-white border border-slate-300 text-slate-900 font-bold text-sm shadow-lg">
                            <div className="w-5 h-5 rounded-full border-2 border-[#0046b8] border-t-transparent animate-spin" />
                            <span>선택하신 베트맨 게임의 대상 경기 및 AI 리포트를 불러오는 중...</span>
                        </div>
                    </div>
                )}

                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                    <div className="space-y-2.5">
                        <div className="flex flex-wrap items-center gap-2">
                            <span className="px-2.5 py-1 rounded bg-slate-100 border border-slate-300 text-slate-800 text-xs font-extrabold">
                                게임코드: {data.gm_id || "G011"} · 회차번호 {data.display_round_no}회차
                            </span>
                            <span className="px-2.5 py-1 rounded bg-blue-50 border border-blue-200 text-[#0046b8] text-xs font-bold">
                                ✓ 베트맨 단축팀명 ↔ 정식 구단명 100% 매칭 완료
                            </span>
                            {data.sale_end_display && (
                                <span className="px-2.5 py-1 rounded bg-amber-50 border border-amber-200 text-amber-800 text-xs font-bold">
                                    ⏰ {data.sale_end_display}
                                </span>
                            )}
                        </div>
                        <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
                            {data.round_title} <span className="text-[#0046b8]">공식 대상 경기 &amp; AI 전력 리포트</span>
                        </h1>
                        <div className="inline-block rounded-lg bg-slate-50 border border-slate-200 px-3.5 py-2 text-xs text-slate-700 font-semibold">
                            📌 <strong>게임 규격 안내:</strong> {data.rule_summary || "대상 경기별 AI 승리 기대 확률 및 전술 데이터 리포트"}
                        </div>
                        <p className="text-slate-500 text-xs">
                            총 <strong className="text-slate-900">{data.total_matches}개 대상 경기</strong>의 승무패·승5패·득점구간 확률은 무료로 제공되며, 각 경기 우측의 <strong className="text-[#0046b8]">[📊 AI 리포트 보기]</strong> 버튼을 클릭하면 경기별 7-Factor 정밀 분석표가 열립니다.
                        </p>
                    </div>

                    {/* 우측 열람권 / A4 출력 버튼 영역 */}
                    <div className="flex flex-col sm:flex-row lg:flex-col gap-2 shrink-0 min-w-[280px] bg-slate-50 p-4 rounded-xl border border-slate-200">
                        {!isPaidUser ? (
                            <Link
                                href={`/ko/payment/request?plan=round_pass&billing=once&round=${data.round_id}`}
                                className="px-4 py-3 rounded-lg bg-[#0046b8] hover:bg-[#00358e] text-white font-extrabold text-xs sm:text-sm text-center shadow-xs transition"
                            >
                                🔓 이번 회차 심층 리포트 열람권 (1,500원)
                            </Link>
                        ) : (
                            <div className="px-4 py-2.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 font-extrabold text-xs text-center">
                                ✅ 전체 경기 심층 AI 리포트 열람 중
                            </div>
                        )}
                        <div className="grid grid-cols-2 gap-2">
                            <Link
                                href="/ko/payment/request?plan=pro&billing=monthly"
                                className="px-3 py-2 rounded-lg bg-white hover:bg-slate-100 border border-slate-300 text-slate-700 text-xs font-bold text-center transition"
                            >
                                💎 월간 패스 (9,900원)
                            </Link>
                            <Link
                                href={`/ko/store/print-report/${data.game_key || data.round_id}`}
                                className="px-3 py-2 rounded-lg bg-white hover:bg-blue-50 border border-[#0046b8] text-[#0046b8] text-xs font-extrabold text-center transition"
                            >
                                🖨️ A4 원클릭 인쇄뷰
                            </Link>
                        </div>
                    </div>
                </div>
            </section>

            {/* 3. 핵심 우위 경기 & 이변 주의보 요약 (깔끔한 화이트 카드) */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                {/* 좌측: AI 핵심 우위 경기 */}
                <div className="rounded-xl bg-white border border-slate-200 p-5 space-y-3.5 shadow-xs">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                        <div>
                            <span className="text-[11px] font-extrabold text-[#0046b8]">
                                AI 핵심 전력 우위 분석
                            </span>
                            <h2 className="text-base sm:text-lg font-black text-slate-900 mt-0.5">
                                🎯 [{data.round_title}] AI 확신도 85% 이상 핵심 경기
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
                                                {m.home_ko} <span className="text-slate-500 text-xs">({m.betman_home})</span> vs {m.away_ko}{" "}
                                                <span className="text-slate-500 text-xs">({m.betman_away})</span>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2 shrink-0">
                                            <div className="text-right">
                                                <div className="text-xs font-black text-[#0046b8]">{m.ai_pick_full_label}</div>
                                                <div className="text-[11px] text-slate-500">기대확률 {m.ai_pick_prob}%</div>
                                            </div>
                                            <button
                                                onClick={() => setActiveReportMatch(m)}
                                                className="px-3 py-1.5 rounded-lg bg-[#0046b8] hover:bg-[#00358e] text-white text-xs font-bold cursor-pointer"
                                            >
                                                리포트
                                            </button>
                                        </div>
                                    </div>
                                ))}
                        </div>
                    ) : (
                        <div className="rounded-lg bg-slate-50 border border-slate-200 p-5 text-center space-y-3">
                            <p className="text-slate-900 font-extrabold text-sm">
                                🔒 [{data.round_title}] AI 확신도 85% 이상 핵심 우위 경기 ({data.killer_picks_count}경기)
                            </p>
                            <p className="text-slate-500 text-xs">
                                포아송 기대득점(xG/xPts) 시뮬레이션과 투표 분포 괴리도를 결합한 핵심 경기 리포트를 열람하세요.
                            </p>
                            <div className="flex flex-wrap justify-center gap-2 pt-1">
                                <Link
                                    href={`/ko/payment/request?plan=round_pass&billing=once&round=${data.round_id}`}
                                    className="px-4 py-2 rounded-lg bg-[#0046b8] hover:bg-[#00358e] text-white font-extrabold text-xs transition"
                                >
                                    🔓 1,500원으로 이번 회차 리포트 열기
                                </Link>
                                <button
                                    onClick={() => {
                                        localStorage.setItem("scorenix_round_pass_unlocked", "true");
                                        setUnlockedDemo(true);
                                    }}
                                    className="px-3 py-2 rounded-lg bg-white hover:bg-slate-100 text-slate-600 text-xs font-bold border border-slate-300 cursor-pointer"
                                >
                                    점주/심사용 미리보기 열기
                                </button>
                            </div>
                        </div>
                    )}
                </div>

                {/* 우측: 이변 및 혼전 주의 경보 (전면 무료 오픈) */}
                <div className="rounded-xl bg-white border border-slate-200 p-5 space-y-3.5 shadow-xs">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                        <div>
                            <span className="text-[11px] font-extrabold text-rose-600">
                                대중 투표 쏠림 vs AI 데이터 괴리 감지 (무료 공개)
                            </span>
                            <h2 className="text-base sm:text-lg font-black text-slate-900 mt-0.5">
                                ⚠️ [{data.round_title}] 이변 · 박빙 주의보 경기
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
                                className="rounded-lg bg-rose-50/40 border border-rose-200 p-3 flex items-start justify-between gap-3"
                            >
                                <div>
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
                                <button
                                    onClick={() => setActiveReportMatch(tm)}
                                    className="px-2.5 py-1.5 rounded-lg bg-white hover:bg-rose-50 border border-rose-300 text-rose-700 text-xs font-bold shrink-0 cursor-pointer"
                                >
                                    리포트 보기
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* 4. 메인 공식 대상 경기 일정 및 AI 리포트 연결 테이블 (베트맨 경기표 디자인) */}
            <section className="rounded-xl bg-white border border-slate-300 overflow-hidden shadow-xs">
                {/* 테이블 상단 컨트롤 헤더 */}
                <div className="p-4 sm:p-5 bg-slate-50 border-b border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <h2 className="text-lg sm:text-xl font-black text-slate-900">
                            📋 {data.round_title} 공식 대상 경기 일정 및 AI 리포트 ({filteredMatches.length}경기)
                        </h2>
                        <p className="text-xs text-slate-500 mt-0.5">
                            베트맨 공식 경기번호·단축팀명과 정식 구단명을 함께 제공하며, 우측 <strong className="text-[#0046b8]">[📊 AI 리포트 보기]</strong> 버튼으로 상세 분석을 확인하실 수 있습니다.
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

                {/* 베트맨 스타일 정식 데이터 테이블 */}
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-[#1e293b] text-white text-xs font-bold">
                                <th className="py-3 px-3 text-center w-24 border-r border-slate-700">경기번호</th>
                                <th className="py-3 px-3 w-44 border-r border-slate-700">대회명 / 경기일시 / 장소</th>
                                <th className="py-3 px-3 border-r border-slate-700">대상 경기 (베트맨 표기 ↔ 정식 구단명)</th>
                                <th className="py-3 px-3 text-center border-r border-slate-700">
                                    {isSpecialGame
                                        ? "AI 예상 득점 및 1순위 유력 득점 구간"
                                        : isW5LGame
                                        ? "AI 승(6점+) / 5(5점이내) / 패(6점+) 확률 & 투표율"
                                        : "AI 승 / 무 / 패 기대 확률 & 베트맨 투표율"}
                                </th>
                                <th className="py-3 px-3 text-center w-36 border-r border-slate-700">AI 분석 결론</th>
                                <th className="py-3 px-3 text-center w-32">상세 리포트</th>
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
                                        {/* 경기번호 */}
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

                                        {/* 대회명 / 경기일시 / 장소 */}
                                        <td className="py-3.5 px-3 border-r border-slate-200 whitespace-nowrap">
                                            <div className="font-extrabold text-slate-800">{m.league}</div>
                                            <div className="text-[11px] text-slate-600 font-medium mt-0.5">{m.kickoff_display}</div>
                                            {m.stadium && (
                                                <div className="text-[10px] text-slate-400 mt-0.5">{m.stadium}</div>
                                            )}
                                        </td>

                                        {/* 팀명 */}
                                        <td className="py-3.5 px-3 border-r border-slate-200">
                                            <div className="flex items-center gap-2 text-sm font-black text-slate-900">
                                                <span className="px-1.5 py-0.5 rounded bg-blue-50 text-[#0046b8] border border-blue-200 text-[10px] font-extrabold">
                                                    홈
                                                </span>
                                                <span>{m.betman_home}</span>
                                                <span className="text-slate-400 font-normal text-xs">vs</span>
                                                <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-300 text-[10px] font-extrabold">
                                                    원정
                                                </span>
                                                <span>{m.betman_away}</span>
                                            </div>
                                            <div className="text-[11px] text-slate-500 mt-1">
                                                정식 구단명: <strong className="text-slate-700">{m.home_ko}</strong> vs{" "}
                                                <strong className="text-slate-700">{m.away_ko}</strong>
                                            </div>
                                        </td>

                                        {/* 게임 유형별 AI 확률 / 득점 구간 / 투표율 */}
                                        <td className="py-3.5 px-3 border-r border-slate-200 min-w-[270px]">
                                            {isSpecialGame && m.special_brackets ? (
                                                <div className="space-y-1.5 bg-slate-50 border border-slate-200 rounded-lg p-2.5">
                                                    <div className="flex items-center justify-between text-[11px]">
                                                        <span className="text-slate-600">
                                                            홈 <strong className="text-slate-900">{m.betman_home}</strong> (예상 {m.special_brackets.expected_home_pts}점)
                                                        </span>
                                                        <span className="font-extrabold text-[#0046b8]">
                                                            1순위: {m.special_brackets.home_top1_bracket} ({m.special_brackets.home_top1_prob}%)
                                                        </span>
                                                    </div>
                                                    <div className="flex items-center justify-between text-[11px]">
                                                        <span className="text-slate-600">
                                                            원정 <strong className="text-slate-900">{m.betman_away}</strong> (예상 {m.special_brackets.expected_away_pts}점)
                                                        </span>
                                                        <span className="font-extrabold text-indigo-700">
                                                            1순위: {m.special_brackets.away_top1_bracket} ({m.special_brackets.away_top1_prob}%)
                                                        </span>
                                                    </div>
                                                    {currentGameType === "BASKETBALL_MATCH" && (
                                                        <div className="text-[10px] text-amber-800 pt-1 border-t border-slate-200 flex justify-between font-semibold">
                                                            <span>전반(1·2Q) 유력 구간:</span>
                                                            <span>
                                                                홈 {m.special_brackets.half_home_top_bracket} / 원정 {m.special_brackets.half_away_top_bracket}
                                                            </span>
                                                        </div>
                                                    )}
                                                </div>
                                            ) : isW5LGame && m.w5l_analysis ? (
                                                <div className="space-y-1.5">
                                                    <div className="flex justify-between text-[11px] font-bold">
                                                        <span className="text-[#0046b8]">홈승(6점+) {m.w5l_analysis.win_prob}%</span>
                                                        <span className="text-amber-700">5점차이내(5) {m.w5l_analysis.close5_prob}%</span>
                                                        <span className="text-slate-700">원정승(6점+) {m.w5l_analysis.lose_prob}%</span>
                                                    </div>
                                                    <div className="w-full h-2.5 rounded-full bg-slate-200 overflow-hidden flex">
                                                        <div style={{ width: `${m.w5l_analysis.win_prob}%` }} className="bg-[#0046b8]" />
                                                        <div style={{ width: `${m.w5l_analysis.close5_prob}%` }} className="bg-amber-500" />
                                                        <div style={{ width: `${m.w5l_analysis.lose_prob}%` }} className="bg-slate-600" />
                                                    </div>
                                                    {m.vote_total && m.vote_total > 0 ? (
                                                        <div className="text-[10px] text-slate-500 flex justify-between font-medium">
                                                            <span>베트맨 실시간 투표율:</span>
                                                            <span className="text-slate-700 font-semibold">
                                                                승 {m.vote_home_pct}% · 5({m.vote_mid_pct}%) · 패 {m.vote_away_pct}%
                                                            </span>
                                                        </div>
                                                    ) : null}
                                                </div>
                                            ) : (
                                                <div className="space-y-1.5">
                                                    <div className="flex justify-between text-[11px] font-bold">
                                                        <span className="text-[#0046b8]">홈승 {m.ai_home_prob}%</span>
                                                        {m.ai_draw_prob > 0 && <span className="text-slate-600">무 {m.ai_draw_prob}%</span>}
                                                        <span className="text-slate-700">원정승 {m.ai_away_prob}%</span>
                                                    </div>
                                                    <div className="w-full h-2.5 rounded-full bg-slate-200 overflow-hidden flex">
                                                        <div style={{ width: `${m.ai_home_prob}%` }} className="bg-[#0046b8]" />
                                                        {m.ai_draw_prob > 0 && (
                                                            <div style={{ width: `${m.ai_draw_prob}%` }} className="bg-slate-400" />
                                                        )}
                                                        <div style={{ width: `${m.ai_away_prob}%` }} className="bg-slate-700" />
                                                    </div>
                                                    {m.vote_total && m.vote_total > 0 ? (
                                                        <div className="text-[10px] text-slate-500 flex justify-between font-medium">
                                                            <span>베트맨 실시간 투표율:</span>
                                                            <span className="text-slate-700 font-semibold">
                                                                승 {m.vote_home_pct}% · 무 {m.vote_mid_pct}% · 패 {m.vote_away_pct}%
                                                            </span>
                                                        </div>
                                                    ) : (
                                                        <div className="flex justify-center gap-1 pt-0.5">
                                                            <button
                                                                onClick={() => toggleSimMatch(m, "승", m.ai_home_prob)}
                                                                className={`px-2 py-0.5 rounded text-[10px] font-bold border cursor-pointer ${
                                                                    selectedSimMatches[m.game_no]?.pick === "승"
                                                                        ? "bg-[#0046b8] text-white border-[#0046b8]"
                                                                        : "bg-white text-slate-700 border-slate-300 hover:bg-slate-100"
                                                                }`}
                                                            >
                                                                홈승 선택
                                                            </button>
                                                            {m.ai_draw_prob > 0 && (
                                                                <button
                                                                    onClick={() => toggleSimMatch(m, "무", m.ai_draw_prob)}
                                                                    className={`px-2 py-0.5 rounded text-[10px] font-bold border cursor-pointer ${
                                                                        selectedSimMatches[m.game_no]?.pick === "무"
                                                                            ? "bg-[#0046b8] text-white border-[#0046b8]"
                                                                            : "bg-white text-slate-700 border-slate-300 hover:bg-slate-100"
                                                                    }`}
                                                                >
                                                                    무 선택
                                                                </button>
                                                            )}
                                                            <button
                                                                onClick={() => toggleSimMatch(m, "패", m.ai_away_prob)}
                                                                className={`px-2 py-0.5 rounded text-[10px] font-bold border cursor-pointer ${
                                                                    selectedSimMatches[m.game_no]?.pick === "패"
                                                                        ? "bg-[#0046b8] text-white border-[#0046b8]"
                                                                        : "bg-white text-slate-700 border-slate-300 hover:bg-slate-100"
                                                                }`}
                                                            >
                                                                원정승 선택
                                                            </button>
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </td>

                                        {/* AI 분석 결론 */}
                                        <td className="py-3.5 px-3 text-center border-r border-slate-200 whitespace-nowrap">
                                            {lockedKiller ? (
                                                <Link
                                                    href={`/ko/payment/request?plan=round_pass&billing=once&round=${data.round_id}`}
                                                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-amber-50 border border-amber-300 text-amber-900 font-extrabold text-xs hover:bg-amber-100"
                                                >
                                                    🔒 확신도 {m.ai_confidence}% 열기
                                                </Link>
                                            ) : (
                                                <div>
                                                    <span className="px-2.5 py-1 rounded bg-blue-50 border border-blue-200 text-[#0046b8] font-extrabold text-xs inline-block">
                                                        {m.ai_pick_label}
                                                    </span>
                                                    <div className="text-[11px] text-slate-500 mt-1 font-medium">
                                                        신뢰도 <strong className="text-emerald-700">{m.ai_confidence}%</strong>
                                                        {m.w5l_analysis ? ` · 권장 [${m.w5l_analysis.multi_recommend}]` : ""}
                                                    </div>
                                                </div>
                                            )}
                                        </td>

                                        {/* 상세 리포트 보기 버튼 */}
                                        <td className="py-3.5 px-3 text-center whitespace-nowrap">
                                            <button
                                                onClick={() => setActiveReportMatch(m)}
                                                className="px-3 py-2 rounded-lg bg-[#0046b8] hover:bg-[#00358e] text-white font-bold text-xs transition shadow-xs cursor-pointer"
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

            {/* 선택 경기 승리 확률 시뮬레이터 (화이트 스타일) */}
            {simStats.count > 0 && (
                <section className="rounded-xl bg-white border-2 border-[#0046b8] p-5 flex flex-col md:flex-row items-center justify-between gap-4 shadow-md">
                    <div className="space-y-1">
                        <div className="text-xs font-extrabold text-[#0046b8]">
                            다중 경기 승리 기대 확률 시뮬레이터
                        </div>
                        <div className="text-base font-black text-slate-900">
                            선택한 {simStats.count}경기 AI 동시 예측 성공 기대치 시뮬레이션
                        </div>
                        <div className="flex flex-wrap gap-1.5 pt-1">
                            {Object.entries(selectedSimMatches).map(([gno, item]) => (
                                <span
                                    key={gno}
                                    className="px-2.5 py-1 rounded bg-blue-50 border border-blue-200 text-xs text-[#0046b8] font-bold"
                                >
                                    {item.label} ({item.prob}%)
                                </span>
                            ))}
                        </div>
                    </div>
                    <div className="flex items-center gap-5 shrink-0">
                        <div className="text-right">
                            <div className="text-xs text-slate-500">평균 단일 기대 승률</div>
                            <div className="text-xl font-black text-[#0046b8]">{simStats.avgProb}%</div>
                        </div>
                        <div className="text-right">
                            <div className="text-xs text-slate-500">통합 시뮬레이션 지수</div>
                            <div className="text-xl font-black text-emerald-700">{simStats.jointProb}%</div>
                        </div>
                        <button
                            onClick={() => setSelectedSimMatches({})}
                            className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold border border-slate-300 cursor-pointer"
                        >
                            초기화
                        </button>
                    </div>
                </section>
            )}

            {/* 🔎 경기별 [AI 리포트 보기] 상세 모달 (깔끔한 화이트 증권사/스포츠 연구소 리포트 스타일) */}
            {activeReportMatch && (
                <div
                    className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto"
                    onClick={() => setActiveReportMatch(null)}
                >
                    <div
                        className="bg-white border border-slate-300 rounded-2xl max-w-2xl w-full overflow-hidden shadow-2xl my-8 text-slate-900"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* 모달 상단 공식 네이비/블루 헤더 */}
                        <div className="bg-[#003996] text-white p-5 sm:p-6 flex items-start justify-between gap-4">
                            <div>
                                <div className="flex flex-wrap items-center gap-2">
                                    <span className="px-2.5 py-0.5 rounded bg-white text-[#003996] text-xs font-extrabold">
                                        {data.round_title} · {activeReportMatch.game_no_label}
                                    </span>
                                    <span className="text-xs font-medium text-blue-100">
                                        {activeReportMatch.league} · {activeReportMatch.kickoff_display}
                                    </span>
                                    {activeReportMatch.stadium && (
                                        <span className="text-xs text-blue-200">({activeReportMatch.stadium})</span>
                                    )}
                                </div>
                                <h3 className="text-xl sm:text-2xl font-black text-white mt-2">
                                    {activeReportMatch.home_ko}{" "}
                                    <span className="text-blue-200 text-sm font-bold">({activeReportMatch.betman_home})</span>{" "}
                                    <span className="text-white/60 text-base font-normal">vs</span> {activeReportMatch.away_ko}{" "}
                                    <span className="text-blue-200 text-sm font-bold">({activeReportMatch.betman_away})</span>
                                </h3>
                            </div>
                            <button
                                onClick={() => setActiveReportMatch(null)}
                                className="px-3 py-1.5 rounded-lg bg-white/15 hover:bg-white/25 text-white text-xs font-bold cursor-pointer shrink-0"
                            >
                                ✕ 닫기
                            </button>
                        </div>

                        <div className="p-5 sm:p-6 space-y-5">
                            {/* AI 종합 헤드라인 & 전술 요약 */}
                            <div className="rounded-xl bg-blue-50/60 border border-blue-200 p-4 space-y-2">
                                <div className="flex items-center justify-between">
                                    <span className="text-xs font-extrabold text-[#0046b8]">
                                        📊 SCORENIX 3-PILLAR AI 전력 분석 결론
                                    </span>
                                    <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-xs font-extrabold">
                                        AI 신뢰도 {activeReportMatch.ai_confidence}%
                                    </span>
                                </div>
                                <p className="text-sm sm:text-base font-black text-slate-900">
                                    {activeReportMatch.ai_detail_report?.headline ||
                                        `[${data.round_title}] ${activeReportMatch.home_ko} vs ${activeReportMatch.away_ko} — ${activeReportMatch.ai_pick_full_label}`}
                                </p>
                                <p className="text-xs text-slate-700 leading-relaxed">
                                    {activeReportMatch.ai_detail_report?.tactical_summary || activeReportMatch.trap_reason}
                                </p>
                            </div>

                            {/* 게임 유형별 특화 분석 섹션 */}
                            {activeReportMatch.special_brackets ? (
                                <div className="rounded-xl bg-slate-50 border border-slate-200 p-4 space-y-3">
                                    <h4 className="text-xs font-extrabold text-slate-800">
                                        🏀 {data.game_name} 팀별 6구간 득점 확률 분포 시뮬레이션
                                    </h4>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        <div className="bg-white p-3 rounded-lg border border-slate-200 space-y-1.5">
                                            <div className="text-xs font-extrabold text-[#0046b8] border-b border-slate-100 pb-1.5">
                                                홈팀: {activeReportMatch.home_ko} (예상 {activeReportMatch.special_brackets.expected_home_pts}점)
                                            </div>
                                            {activeReportMatch.special_brackets.home_brackets.map((b) => (
                                                <div key={b.bracket_no} className="flex items-center justify-between text-xs">
                                                    <span className={b.rank === 1 ? "font-extrabold text-[#0046b8]" : "text-slate-600"}>
                                                        {b.bracket_no}구간 ({b.label}) {b.rank === 1 ? "★1순위" : b.rank === 2 ? "☆2순위" : ""}
                                                    </span>
                                                    <span className="font-bold text-slate-900">{b.prob_pct}%</span>
                                                </div>
                                            ))}
                                        </div>
                                        <div className="bg-white p-3 rounded-lg border border-slate-200 space-y-1.5">
                                            <div className="text-xs font-extrabold text-indigo-700 border-b border-slate-100 pb-1.5">
                                                원정팀: {activeReportMatch.away_ko} (예상 {activeReportMatch.special_brackets.expected_away_pts}점)
                                            </div>
                                            {activeReportMatch.special_brackets.away_brackets.map((b) => (
                                                <div key={b.bracket_no} className="flex items-center justify-between text-xs">
                                                    <span className={b.rank === 1 ? "font-extrabold text-indigo-700" : "text-slate-600"}>
                                                        {b.bracket_no}구간 ({b.label}) {b.rank === 1 ? "★1순위" : b.rank === 2 ? "☆2순위" : ""}
                                                    </span>
                                                    <span className="font-bold text-slate-900">{b.prob_pct}%</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            ) : activeReportMatch.w5l_analysis ? (
                                <div className="rounded-xl bg-slate-50 border border-slate-200 p-4 space-y-2.5">
                                    <h4 className="text-xs font-extrabold text-slate-800">
                                        🏀 농구토토 승5패 전용 클러치 마진 분석
                                    </h4>
                                    <div className="grid grid-cols-3 gap-2.5 text-center">
                                        <div className="p-3 rounded-lg bg-white border border-blue-200">
                                            <div className="text-[11px] font-semibold text-slate-500">홈 승 (6점차+)</div>
                                            <div className="text-lg font-black text-[#0046b8] mt-0.5">{activeReportMatch.w5l_analysis.win_prob}%</div>
                                        </div>
                                        <div className="p-3 rounded-lg bg-white border border-amber-300">
                                            <div className="text-[11px] font-semibold text-slate-500">5 (5점차 이내 접전)</div>
                                            <div className="text-lg font-black text-amber-700 mt-0.5">{activeReportMatch.w5l_analysis.close5_prob}%</div>
                                        </div>
                                        <div className="p-3 rounded-lg bg-white border border-slate-300">
                                            <div className="text-[11px] font-semibold text-slate-500">원정 승 (6점차+)</div>
                                            <div className="text-lg font-black text-slate-800 mt-0.5">{activeReportMatch.w5l_analysis.lose_prob}%</div>
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div className="grid grid-cols-3 gap-2.5 text-center">
                                    <div className="p-3 rounded-xl bg-blue-50/50 border border-blue-200">
                                        <div className="text-[11px] font-semibold text-slate-600">{activeReportMatch.home_ko} 승</div>
                                        <div className="text-lg font-black text-[#0046b8] mt-0.5">{activeReportMatch.ai_home_prob}%</div>
                                        {activeReportMatch.vote_total ? (
                                            <div className="text-[10px] text-slate-500 mt-0.5">투표율 {activeReportMatch.vote_home_pct}%</div>
                                        ) : null}
                                    </div>
                                    <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                                        <div className="text-[11px] font-semibold text-slate-600">무승부</div>
                                        <div className="text-lg font-black text-slate-700 mt-0.5">{activeReportMatch.ai_draw_prob}%</div>
                                        {activeReportMatch.vote_total ? (
                                            <div className="text-[10px] text-slate-500 mt-0.5">투표율 {activeReportMatch.vote_mid_pct}%</div>
                                        ) : null}
                                    </div>
                                    <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                                        <div className="text-[11px] font-semibold text-slate-600">{activeReportMatch.away_ko} 승</div>
                                        <div className="text-lg font-black text-slate-800 mt-0.5">{activeReportMatch.ai_away_prob}%</div>
                                        {activeReportMatch.vote_total ? (
                                            <div className="text-[10px] text-slate-500 mt-0.5">투표율 {activeReportMatch.vote_away_pct}%</div>
                                        ) : null}
                                    </div>
                                </div>
                            )}

                            {/* 7-Factor 정밀 지표 */}
                            {activeReportMatch.ai_detail_report?.seven_factors && (
                                <div className="space-y-2">
                                    <h4 className="text-xs font-extrabold text-slate-800">
                                        📈 7-Factor 정량 전술 지표 평가
                                    </h4>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                        {activeReportMatch.ai_detail_report.seven_factors.map((f, idx) => (
                                            <div key={idx} className="rounded-lg bg-slate-50 border border-slate-200 p-2.5">
                                                <div className="flex items-center justify-between text-xs mb-1">
                                                    <span className="font-bold text-slate-800">{f.name}</span>
                                                    <span className="font-black text-[#0046b8]">{f.score}점</span>
                                                </div>
                                                <div className="w-full h-1.5 rounded-full bg-slate-200 overflow-hidden mb-1">
                                                    <div
                                                        style={{ width: `${f.score}%` }}
                                                        className="h-full bg-[#0046b8]"
                                                    />
                                                </div>
                                                <p className="text-[11px] text-slate-500">{f.comment}</p>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* 모달 하단 액션 버튼 */}
                            <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-slate-200">
                                <Link
                                    href={`/ko/store/print-report/${data.game_key || data.round_id}`}
                                    className="px-4 py-2.5 rounded-lg bg-[#0046b8] hover:bg-[#00358e] text-white font-bold text-xs"
                                >
                                    🖨️ 이 게임 전체 A4 리포트 인쇄뷰 열기
                                </Link>
                                <div className="flex items-center gap-2">
                                    <Link
                                        href="/ko/analysis"
                                        className="px-4 py-2.5 rounded-lg bg-slate-100 hover:bg-slate-200 border border-slate-300 text-slate-800 font-bold text-xs"
                                    >
                                        📊 7-Factor 데이터 센터 이동 →
                                    </Link>
                                    <button
                                        onClick={() => setActiveReportMatch(null)}
                                        className="px-4 py-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs cursor-pointer"
                                    >
                                        닫기
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* 하단 법적 고지문 (공식 기관/포털 스타일) */}
            <div className="rounded-xl bg-white border border-slate-200 p-4 text-[11px] text-slate-500 leading-relaxed">
                <strong className="text-slate-700">[스포츠 데이터 분석 리포트 이용 안내]</strong> 스코어닉스(Scorenix)는 통계 알고리즘과 머신러닝(LightGBM·포아송 분포)을 활용하여 국내외 스포츠 경기의 전력 지수 및 승리 기대 확률을 분석·제공하는 스포츠 데이터 분석 정보 서비스입니다. 당사는 어떠한 경우에도 사행성 행위나 금전적 베팅을 중개·권유하지 않으며, 모든 분석 리포트는 스포츠 데이터 연구 및 경기 관전 참고용으로만 제공됩니다.
            </div>
        </div>
    );
}
