"use client";
import React, { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
    fetchProtoRoundWithFallback,
    DEFAULT_BETMAN_CATALOG,
    BetmanGameCatalogItem,
} from "../lib/protoFallback";

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

export default function StorePrintReportView({ initialRoundId }: { initialRoundId?: string }) {
    const pathname = usePathname();
    const [report, setReport] = useState<ProtoReportData | null>(null);
    const [selectedGameKey, setSelectedGameKey] = useState<string>("");
    const [loading, setLoading] = useState(true);
    const [storeName, setStoreName] = useState("공식 스포츠토토 판매점 VIP 고객용");
    const [storeNotice, setStoreNotice] = useState("발매 마감 10분 전까지 마킹을 완료해 주세요. 스마트폰으로 우측 QR코드를 스캔하면 전 경기 AI 상세 전력 리포트를 확인할 수 있습니다.");
    const [includePage2, setIncludePage2] = useState(true);
    const [trialModalOpen, setTrialModalOpen] = useState(false);
    const [trialPhone, setTrialPhone] = useState("");
    const [trialStore, setTrialStore] = useState("");
    const [trialSubmitted, setTrialSubmitted] = useState(false);

    const resolvedRoundId = React.useMemo(() => {
        if (selectedGameKey) return selectedGameKey;
        if (initialRoundId && initialRoundId !== "current" && initialRoundId !== "latest") {
            return initialRoundId;
        }
        const parts = (pathname || "").split("/").filter(Boolean);
        const idx = parts.indexOf("print-report");
        if (idx >= 0 && parts[idx + 1] && parts[idx + 1] !== "current" && parts[idx + 1] !== "latest") {
            return parts[idx + 1];
        }
        return "G011_260065";
    }, [initialRoundId, pathname, selectedGameKey]);

    useEffect(() => {
        try {
            const savedName = localStorage.getItem("scorenix_b2b_store_name");
            const savedNotice = localStorage.getItem("scorenix_b2b_store_notice");
            if (savedName) setStoreName(savedName);
            if (savedNotice) setStoreNotice(savedNotice);
        } catch {
            // ignore
        }
    }, []);

    useEffect(() => {
        let active = true;
        async function loadReport() {
            setLoading(true);
            try {
                const data = await fetchProtoRoundWithFallback(resolvedRoundId);
                if (active && data) setReport(data);
            } catch (err) {
                console.error("Failed to fetch proto report:", err);
            } finally {
                if (active) setLoading(false);
            }
        }
        loadReport();
        return () => {
            active = false;
        };
    }, [resolvedRoundId]);

    const handleStoreNameChange = (val: string) => {
        setStoreName(val);
        try {
            localStorage.setItem("scorenix_b2b_store_name", val);
        } catch {
            // ignore
        }
    };

    const handleStoreNoticeChange = (val: string) => {
        setStoreNotice(val);
        try {
            localStorage.setItem("scorenix_b2b_store_notice", val);
        } catch {
            // ignore
        }
    };

    const catalogList = report?.available_games && report.available_games.length > 0
        ? report.available_games
        : DEFAULT_BETMAN_CATALOG;

    const qrTargetUrl = `https://scorenix.com/ko?utm_source=b2b_qr&round=${report?.round_id || "current"}`;
    const qrImgUrl = `https://api.qrserver.com/v1/create-qr-code/?size=180x180&margin=4&data=${encodeURIComponent(qrTargetUrl)}`;

    if (loading) {
        return (
            <div className="min-h-screen bg-[#f4f6f9] text-slate-800 flex flex-col items-center justify-center p-6">
                <div className="w-12 h-12 border-4 border-[#0046b8] border-t-transparent rounded-full animate-spin mb-4" />
                <p className="text-lg font-extrabold text-slate-900">베트맨 게임별 AI 종합 리포트(A4 인쇄 뷰) 생성 중...</p>
                <p className="text-xs text-slate-500 mt-1">승무패 · 승5패 · 스페셜N · 매치 · 프로토 승부식 데이터 동기화</p>
            </div>
        );
    }

    if (!report) {
        return (
            <div className="min-h-screen bg-[#f4f6f9] text-slate-800 flex flex-col items-center justify-center p-6">
                <p className="text-lg font-bold text-rose-600">리포트 데이터를 불러오지 못했습니다.</p>
                <Link href="/ko" className="mt-4 px-4 py-2 rounded-lg bg-[#0046b8] text-white font-bold text-sm">
                    메인 화면으로 이동
                </Link>
            </div>
        );
    }

    const combo2 = report.section_a_combos.main_2folder;
    const combo3 = report.section_a_combos.value_3folder;

    return (
        <div className="min-h-screen bg-[#e2e8f0] text-slate-900 print:bg-white print:min-h-0">
            <style jsx global>{`
                @media print {
                    @page {
                        size: A4 portrait;
                        margin: 6mm 7mm;
                    }
                    html, body {
                        background: #ffffff !important;
                        color: #0f172a !important;
                        margin: 0 !important;
                        padding: 0 !important;
                        -webkit-print-color-adjust: exact !important;
                        print-color-adjust: exact !important;
                    }
                    .no-print {
                        display: none !important;
                    }
                    .a4-sheet {
                        width: 100% !important;
                        max-width: none !important;
                        margin: 0 !important;
                        padding: 0 !important;
                        box-shadow: none !important;
                        border: none !important;
                        page-break-after: always;
                    }
                    .a4-sheet:last-child {
                        page-break-after: auto;
                    }
                }
            `}</style>

            {/* ─── 상단 점주 전용 컨트롤 바 (인쇄 시 자동 숨김) ─── */}
            <div className="no-print bg-white border-b-2 border-[#0046b8] text-slate-900 sticky top-0 z-50 shadow-md">
                <div className="max-w-5xl mx-auto px-4 py-3 flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                        <Link
                            href="/ko"
                            className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 border border-slate-300 text-xs font-bold text-slate-700 transition"
                        >
                            ← 베트맨 전체 게임 대시보드
                        </Link>
                        <div>
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-black bg-blue-50 text-[#0046b8] border border-blue-200">
                                🏪 B2B 판매점 전용 A4 출력 솔루션
                            </span>
                            <h1 className="text-sm sm:text-base font-extrabold text-slate-900 mt-0.5">
                                {report.round_title} A4 원클릭 출력 뷰
                            </h1>
                        </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                        {/* 출력할 베트맨 게임 즉시 전환 셀렉터 */}
                        <select
                            value={report.game_key || resolvedRoundId}
                            onChange={(e) => setSelectedGameKey(e.target.value)}
                            className="px-3 py-1.5 rounded-lg bg-blue-50 border border-blue-300 text-xs font-extrabold text-[#0046b8] focus:outline-none"
                        >
                            {catalogList.map((g) => (
                                <option key={g.game_key} value={g.game_key} className="bg-white text-slate-900">
                                    {g.icon} {g.full_title} ({g.match_count}경기)
                                </option>
                            ))}
                        </select>

                        <label className="flex items-center gap-1.5 text-xs bg-slate-50 border border-slate-300 px-3 py-1.5 rounded-lg cursor-pointer">
                            <input
                                type="checkbox"
                                checked={includePage2}
                                onChange={(e) => setIncludePage2(e.target.checked)}
                                className="rounded accent-[#0046b8]"
                            />
                            <span className="font-bold text-slate-700">2페이지(전체 경기 일람표) 포함</span>
                        </label>

                        <button
                            onClick={() => setTrialModalOpen(true)}
                            className="px-3.5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs transition shadow-sm"
                        >
                            🎁 점주 2주 무료체험 / 월 39,000원 구독
                        </button>

                        <button
                            onClick={() => window.print()}
                            className="px-5 py-2 rounded-lg bg-[#0046b8] hover:bg-[#003996] text-white font-black text-sm shadow-sm flex items-center gap-2 transition cursor-pointer"
                        >
                            <span>🖨️ A4 원클릭 인쇄 / PDF 저장</span>
                        </button>
                    </div>
                </div>

                {/* 매장 상호명 & 공지문 커스터마이징 바 */}
                <div className="max-w-5xl mx-auto px-4 pb-3 pt-1 grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                    <div className="flex items-center gap-2 bg-slate-50 border border-slate-300 rounded-lg px-3 py-1.5">
                        <span className="text-slate-600 font-bold whitespace-nowrap">매장 상호명:</span>
                        <input
                            type="text"
                            value={storeName}
                            onChange={(e) => handleStoreNameChange(e.target.value)}
                            placeholder="예: 행운복권방 (출력물 우측 상단에 인쇄됩니다)"
                            className="bg-transparent text-slate-900 font-bold w-full focus:outline-none"
                        />
                    </div>
                    <div className="flex items-center gap-2 bg-slate-50 border border-slate-300 rounded-lg px-3 py-1.5">
                        <span className="text-slate-600 font-bold whitespace-nowrap">하단 매장 안내문:</span>
                        <input
                            type="text"
                            value={storeNotice}
                            onChange={(e) => handleStoreNoticeChange(e.target.value)}
                            className="bg-transparent text-slate-800 w-full focus:outline-none"
                        />
                    </div>
                </div>
            </div>

            {/* ═══════════════════════════════════════════════════════════════
                📄 A4 SHEET 1: 핵심 우위 매치(Section A) + 데이터 우위 Top 5(Section B) + 이변 주의보(Section C) + QR 푸터
            ═══════════════════════════════════════════════════════════════ */}
            <div className="py-6 px-2 sm:px-6 print:p-0">
                <div className="a4-sheet max-w-[210mm] mx-auto bg-white text-slate-900 rounded-xl shadow-2xl border border-slate-300 p-5 sm:p-6 print:rounded-none print:p-0">
                    {/* 1. 리포트 헤더 */}
                    <header className="border-b-2 border-slate-900 pb-2.5 mb-3 flex items-start justify-between gap-4">
                        <div>
                            <div className="flex items-center gap-2">
                                <span className="px-2 py-0.5 bg-slate-900 text-white text-[10px] font-black tracking-wider uppercase rounded">
                                    SCORENIX OFFICIAL GAME AI REPORT
                                </span>
                                <span className="text-xs font-bold text-blue-700">
                                    🤖 {report.recent_5_rounds_banner.headline}
                                </span>
                            </div>
                            <h1 className="text-xl sm:text-2xl font-black tracking-tight text-slate-950 mt-1">
                                {report.round_title} AI 종합 전력 분석 리포트
                            </h1>
                            <p className="text-[11px] text-slate-600 font-medium mt-0.5">
                                발행일시: {report.published_date} ({report.published_at}) &nbsp;|&nbsp; 대상 경기: {report.total_matches}경기 ({report.rule_summary || "베트맨 공식 대상 경기 기준"})
                            </p>
                        </div>

                        <div className="text-right shrink-0">
                            <div className="inline-block border-2 border-slate-900 rounded-lg px-3 py-1 bg-slate-50">
                                <div className="text-[10px] font-bold text-slate-500">제공 매장</div>
                                <div className="text-xs sm:text-sm font-black text-slate-900">{storeName}</div>
                            </div>
                        </div>
                    </header>

                    {/* 2. Section A: AI 핵심 우위 매치 요약 */}
                    <section className="mb-3.5">
                        <div className="flex items-center justify-between mb-1.5">
                            <h2 className="text-sm font-black text-slate-950 flex items-center gap-1.5">
                                <span className="w-5 h-5 rounded bg-blue-700 text-white inline-flex items-center justify-center text-xs font-black">A</span>
                                <span>AI 최우선 핵심 우위 경기 패키지 (신뢰도 1순위 매치업)</span>
                            </h2>
                            <span className="text-[11px] font-bold text-blue-800">
                                ※ 3-Pillar 머신러닝 및 기대득점(xG/xPts) 상위 우위 경기
                            </span>
                        </div>

                        <div className="grid grid-cols-2 gap-2.5">
                            <div className="border-2 border-blue-700 rounded-lg p-2.5 bg-blue-50/40">
                                <div className="flex items-center justify-between border-b border-blue-200 pb-1.5 mb-2">
                                    <div>
                                        <span className="text-[10px] font-black px-1.5 py-0.5 rounded bg-blue-700 text-white">
                                            {combo2.badge}
                                        </span>
                                        <h3 className="text-xs font-black text-slate-900 mt-0.5">{combo2.title}</h3>
                                    </div>
                                    <div className="text-right">
                                        <div className="text-xs font-black text-blue-800">기대적중 {combo2.hit_probability_pct}%</div>
                                    </div>
                                </div>
                                <div className="space-y-1.5">
                                    {combo2.picks.map((p) => (
                                        <div key={p.game_no} className="flex items-center justify-between bg-white border border-blue-200 rounded px-2 py-1 text-xs">
                                            <div className="flex items-center gap-1.5">
                                                <span className="font-black text-blue-900 bg-blue-100 px-1.5 py-0.5 rounded text-[11px]">
                                                    {p.game_no_label}
                                                </span>
                                                <span className="font-bold text-slate-900">
                                                    {p.betman_home} vs {p.betman_away}
                                                </span>
                                            </div>
                                            <div className="flex items-center gap-1.5">
                                                <span className="font-black text-blue-700">[{p.ai_pick_label}]</span>
                                                <span className="text-[10px] font-bold text-slate-500">({p.ai_pick_prob}%)</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className="border-2 border-slate-800 rounded-lg p-2.5 bg-slate-50">
                                <div className="flex items-center justify-between border-b border-slate-300 pb-1.5 mb-2">
                                    <div>
                                        <span className="text-[10px] font-black px-1.5 py-0.5 rounded bg-slate-800 text-white">
                                            {combo3.badge}
                                        </span>
                                        <h3 className="text-xs font-black text-slate-900 mt-0.5">{combo3.title}</h3>
                                    </div>
                                    <div className="text-right">
                                        <div className="text-xs font-black text-emerald-700">기대적중 {combo3.hit_probability_pct}%</div>
                                    </div>
                                </div>
                                <div className="space-y-1">
                                    {combo3.picks.map((p) => (
                                        <div key={p.game_no} className="flex items-center justify-between bg-white border border-slate-200 rounded px-2 py-0.5 text-[11px]">
                                            <div className="flex items-center gap-1.5">
                                                <span className="font-black text-slate-900 bg-slate-200 px-1.5 py-0.2 rounded">
                                                    {p.game_no_label}
                                                </span>
                                                <span className="font-bold text-slate-900">
                                                    {p.betman_home} vs {p.betman_away}
                                                </span>
                                            </div>
                                            <div className="flex items-center gap-1">
                                                <span className="font-black text-emerald-700">[{p.ai_pick_label}]</span>
                                                <span className="text-[10px] text-slate-500">({p.ai_pick_prob}%)</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </section>

                    {/* 3. Section B: 데이터 우위 Top 5 */}
                    <section className="mb-3.5">
                        <div className="flex items-center justify-between mb-1">
                            <h2 className="text-sm font-black text-slate-950 flex items-center gap-1.5">
                                <span className="w-5 h-5 rounded bg-emerald-700 text-white inline-flex items-center justify-center text-xs font-black">B</span>
                                <span>AI 전력 지수 우위 Top {report.section_b_value_top5.length} (7-Factor 핵심 추천 경기)</span>
                            </h2>
                            <span className="text-[10px] font-bold text-emerald-800">
                                베트맨 공식 표기 및 정식 구단명 병기
                            </span>
                        </div>

                        <table className="w-full border-collapse border border-slate-400 text-[11px]">
                            <thead>
                                <tr className="bg-slate-900 text-white">
                                    <th className="border border-slate-600 py-1 px-1.5 text-center w-14">경기번호</th>
                                    <th className="border border-slate-600 py-1 px-1.5 text-center w-24">일시</th>
                                    <th className="border border-slate-600 py-1 px-2 text-left">베트맨 표기 (정식 구단명)</th>
                                    <th className="border border-slate-600 py-1 px-1.5 text-center">AI 예측 확률 / 구간</th>
                                    <th className="border border-slate-600 py-1 px-1.5 text-center w-28">AI 분석 결론</th>
                                    <th className="border border-slate-600 py-1 px-1.5 text-center w-16">신뢰도</th>
                                </tr>
                            </thead>
                            <tbody>
                                {report.section_b_value_top5.map((m, idx) => (
                                    <tr key={m.game_no} className={idx % 2 === 0 ? "bg-white" : "bg-emerald-50/40"}>
                                        <td className="border border-slate-300 py-1 px-1.5 text-center font-black text-slate-900">
                                            {m.game_no_label}
                                        </td>
                                        <td className="border border-slate-300 py-1 px-1.5 text-center text-slate-600 font-semibold">
                                            {m.kickoff_display}
                                        </td>
                                        <td className="border border-slate-300 py-1 px-2">
                                            <span className="font-black text-slate-950">{m.betman_home} vs {m.betman_away}</span>
                                            <span className="text-[10px] text-slate-500 ml-1.5">({m.home_ko} vs {m.away_ko})</span>
                                        </td>
                                        <td className="border border-slate-300 py-1 px-1.5 text-center text-slate-700 font-semibold">
                                            {m.special_brackets
                                                ? `홈 ${m.special_brackets.expected_home_pts}점 / 원정 ${m.special_brackets.expected_away_pts}점`
                                                : m.w5l_analysis
                                                ? `승 ${m.w5l_analysis.win_prob}% / 5(${m.w5l_analysis.close5_prob}%) / 패 ${m.w5l_analysis.lose_prob}%`
                                                : `홈 ${m.ai_home_prob}% / 무 ${m.ai_draw_prob}% / 원정 ${m.ai_away_prob}%`}
                                        </td>
                                        <td className="border border-slate-300 py-1 px-1.5 text-center font-black text-emerald-800 bg-emerald-100/60">
                                            {m.ai_pick_label}
                                        </td>
                                        <td className="border border-slate-300 py-1 px-1.5 text-center font-black text-blue-700">
                                            {m.ai_confidence}%
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </section>

                    {/* 4. Section C: 이변 및 혼전 주의 경보 */}
                    <section className="mb-3.5">
                        <div className="flex items-center justify-between mb-1">
                            <h2 className="text-sm font-black text-slate-950 flex items-center gap-1.5">
                                <span className="w-5 h-5 rounded bg-rose-600 text-white inline-flex items-center justify-center text-xs font-black">C</span>
                                <span>이변·박빙 주의 경보 (대중 쏠림 대비 무승부·접전 위험이 높은 경기)</span>
                            </h2>
                            <span className="text-[10px] font-bold text-rose-700">
                                ⚠️ 복수 마킹 또는 주의 권장
                            </span>
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                            {report.section_c_traps.map((t) => (
                                <div key={t.game_no} className="border border-rose-400 rounded-lg p-2 bg-rose-50/50 flex flex-col justify-between">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-1.5">
                                            <span className="px-1.5 py-0.5 rounded bg-rose-600 text-white font-black text-[10px]">
                                                {t.game_no_label} 주의
                                            </span>
                                            <span className="text-xs font-black text-slate-950">
                                                {t.betman_home} vs {t.betman_away}
                                            </span>
                                        </div>
                                        <span className="text-[11px] font-black text-rose-700">
                                            접전·이변 확률 {t.upset_or_draw_prob}%
                                        </span>
                                    </div>
                                    <p className="text-[10px] text-slate-700 mt-1 leading-snug">
                                        • {t.trap_reason}
                                    </p>
                                </div>
                            ))}
                        </div>
                    </section>

                    {/* 5. 이번 회차 대상 경기 통합 마킹 설계표 (최대 14경기 A4 1페이지에 완전 수록!) */}
                    <section className="mb-3">
                        <div className="flex items-center justify-between mb-1">
                            <h2 className="text-xs font-black text-slate-900">
                                📊 [{report.round_title}] 14경기 통합 마킹 설계표 (단통 축 고정 vs 복수마킹 보험 배분)
                            </h2>
                            <span className="text-[10px] font-bold text-[#0046b8]">
                                📌단통(축): 1개 마킹 고정 &nbsp;|&nbsp; 🛡️복수(보험): 1·2순위 동시 마킹 권장
                            </span>
                        </div>
                        <table className="w-full border-collapse border border-slate-300 text-[10px]">
                            <thead>
                                <tr className="bg-slate-100 text-slate-800">
                                    <th className="border border-slate-300 py-0.5 px-1 text-center">번호</th>
                                    <th className="border border-slate-300 py-0.5 px-1 text-center">리그</th>
                                    <th className="border border-slate-300 py-0.5 px-1.5 text-left">베트맨 매치업 (정식 구단명)</th>
                                    <th className="border border-slate-300 py-0.5 px-1 text-center">AI 예측 확률 / 예상 구간</th>
                                    <th className="border border-slate-300 py-0.5 px-1 text-center">실전 마킹 추천 (단통/복수)</th>
                                    <th className="border border-slate-300 py-0.5 px-1 text-center">마킹 구분</th>
                                </tr>
                            </thead>
                            <tbody>
                                {report.matches.slice(0, 14).map((m) => {
                                    // 1순위/2순위 마킹 계산
                                    const midCode = m.w5l_analysis ? "5" : "무";
                                    const pH = m.w5l_analysis ? m.w5l_analysis.win_prob : m.ai_home_prob;
                                    const pM = m.w5l_analysis ? m.w5l_analysis.close5_prob : m.ai_draw_prob;
                                    const pA = m.w5l_analysis ? m.w5l_analysis.lose_prob : m.ai_away_prob;
                                    const sorted = [
                                        { c: "승", p: pH },
                                        { c: midCode, p: pM },
                                        { c: "패", p: pA },
                                    ].sort((a, b) => b.p - a.p);
                                    const gap = sorted[0].p - sorted[1].p;
                                    const needDual = m.is_trap_candidate || gap < 18;
                                    const markDisplay = m.special_brackets
                                        ? `홈[${m.special_brackets.home_top1_bracket}]·원[${m.special_brackets.away_top1_bracket}]`
                                        : needDual
                                        ? `[${sorted[0].c} + ${sorted[1].c}] 복수마킹`
                                        : `[${sorted[0].c}] 단통 고정`;

                                    return (
                                        <tr key={m.game_no} className={m.is_killer_pick ? "bg-blue-50/50 font-semibold" : needDual ? "bg-amber-50/40" : ""}>
                                            <td className="border border-slate-300 py-0.5 px-1 text-center font-black">{m.game_no_label}</td>
                                            <td className="border border-slate-300 py-0.5 px-1 text-center text-slate-600">{m.league.slice(0, 9)}</td>
                                            <td className="border border-slate-300 py-0.5 px-1.5 font-bold text-slate-900">
                                                {m.betman_home} vs {m.betman_away}{" "}
                                                <span className="text-[9px] text-slate-500 font-normal">({m.home_ko} vs {m.away_ko})</span>
                                            </td>
                                            <td className="border border-slate-300 py-0.5 px-1 text-center">
                                                {m.special_brackets
                                                    ? `홈 ${m.special_brackets.home_top1_bracket} / 원정 ${m.special_brackets.away_top1_bracket}`
                                                    : m.w5l_analysis
                                                    ? `승 ${m.w5l_analysis.win_prob}% · 5(${m.w5l_analysis.close5_prob}%) · 패 ${m.w5l_analysis.lose_prob}%`
                                                    : `홈 ${m.ai_home_prob}% · 무 ${m.ai_draw_prob}% · 원정 ${m.ai_away_prob}%`}
                                            </td>
                                            <td className="border border-slate-300 py-0.5 px-1 text-center font-black text-[#0046b8]">
                                                {markDisplay}
                                            </td>
                                            <td className="border border-slate-300 py-0.5 px-1 text-center">
                                                {m.is_trap_candidate ? (
                                                    <span className="text-[9.5px] font-black text-rose-700 bg-rose-100 px-1 rounded">💣함정·복수필수</span>
                                                ) : needDual ? (
                                                    <span className="text-[9.5px] font-black text-amber-800 bg-amber-100 px-1 rounded">🛡️투마킹 보험</span>
                                                ) : (
                                                    <span className="text-[9.5px] font-black text-[#0046b8] bg-blue-100 px-1 rounded">📌단통(축) {m.ai_confidence}%</span>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </section>

                    {/* 6. 푸터: 매장 전용 안내문구 + 스코어닉스 연결 QR 코드 */}
                    <footer className="border-t-2 border-slate-900 pt-2.5 mt-2 flex items-center justify-between gap-4 bg-slate-50 rounded-lg p-2.5">
                        <div className="space-y-1">
                            <div className="text-xs font-black text-slate-950">
                                📌 [{storeName}] 방문 고객 전용 AI 스포츠 데이터 리포트 안내
                            </div>
                            <p className="text-[10.5px] text-slate-700 leading-snug">
                                {storeNotice}
                            </p>
                            <p className="text-[9.5px] text-slate-500">
                                ⚖️ 본 리포트는 스코어닉스(scorenix.com) 3-Pillar 머신러닝 모델의 통계적 스포츠 데이터 참고자료입니다.
                            </p>
                        </div>

                        <div className="flex items-center gap-2.5 shrink-0 border border-slate-300 bg-white rounded-lg p-2">
                            <div className="text-right">
                                <div className="text-[10px] font-black text-blue-700 uppercase">스마트폰 카메라 스캔</div>
                                <div className="text-xs font-black text-slate-950 leading-tight mt-0.5">
                                    전 게임 AI 리포트 &amp;<br />실시간 데이터 확인
                                </div>
                                <div className="text-[9.5px] font-bold text-slate-500 mt-1">scorenix.com</div>
                            </div>
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                                src={qrImgUrl}
                                alt="ScoreNix QR Code"
                                width={68}
                                height={68}
                                className="w-[68px] h-[68px] border border-slate-200 rounded"
                            />
                        </div>
                    </footer>
                </div>

                {/* ═══════════════════════════════════════════════════════════════
                    📄 A4 SHEET 2 (선택): 전체 대상 경기 상세 일람표
                ═══════════════════════════════════════════════════════════════ */}
                {includePage2 && report.matches.length > 14 && (
                    <div className="a4-sheet max-w-[210mm] mx-auto bg-white text-slate-900 rounded-xl shadow-2xl border border-slate-300 p-5 sm:p-6 mt-6 print:mt-0 print:rounded-none print:p-0">
                        <header className="border-b-2 border-slate-900 pb-2 mb-3 flex items-center justify-between">
                            <div>
                                <h2 className="text-lg font-black text-slate-950">
                                    {report.round_title} 전체 대상 경기 AI 전력 분석 일람표 (2/2면)
                                </h2>
                                <p className="text-[11px] text-slate-600">
                                    베트맨 경기번호순 전체 매치업 · AI 신뢰도 및 예측 확률 비교표
                                </p>
                            </div>
                            <span className="text-xs font-black text-slate-800">{storeName}</span>
                        </header>

                        <table className="w-full border-collapse border border-slate-300 text-[10.5px]">
                            <thead>
                                <tr className="bg-slate-900 text-white">
                                    <th className="border border-slate-600 py-1 px-1 text-center">경기번호</th>
                                    <th className="border border-slate-600 py-1 px-1 text-center">일시</th>
                                    <th className="border border-slate-600 py-1 px-1 text-center">리그</th>
                                    <th className="border border-slate-600 py-1 px-2 text-left">베트맨 단축명 (정식 구단명)</th>
                                    <th className="border border-slate-600 py-1 px-1 text-center">AI 승/무/패 확률</th>
                                    <th className="border border-slate-600 py-1 px-1 text-center">AI 분석 결론</th>
                                    <th className="border border-slate-600 py-1 px-1 text-center">신뢰도</th>
                                </tr>
                            </thead>
                            <tbody>
                                {report.matches.map((m) => (
                                    <tr key={m.game_no} className={m.is_killer_pick ? "bg-amber-50/70 font-semibold" : "even:bg-slate-50"}>
                                        <td className="border border-slate-300 py-1 px-1 text-center font-black">{m.game_no_label}</td>
                                        <td className="border border-slate-300 py-1 px-1 text-center text-slate-600">{m.kickoff_display}</td>
                                        <td className="border border-slate-300 py-1 px-1 text-center text-slate-700">{m.league.slice(0, 10)}</td>
                                        <td className="border border-slate-300 py-1 px-2">
                                            <span className="font-bold text-slate-900">{m.betman_home} vs {m.betman_away}</span>
                                            <span className="text-[9.5px] text-slate-500 ml-1">({m.home_ko} vs {m.away_ko})</span>
                                        </td>
                                        <td className="border border-slate-300 py-1 px-1 text-center">
                                            {m.ai_home_prob}% / {m.ai_draw_prob}% / {m.ai_away_prob}%
                                        </td>
                                        <td className="border border-slate-300 py-1 px-1 text-center font-black text-blue-800">
                                            {m.ai_pick_label}
                                        </td>
                                        <td className="border border-slate-300 py-1 px-1 text-center font-bold">
                                            {m.is_killer_pick ? `★${m.ai_confidence}%` : `${m.ai_confidence}%`}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* 점주 2주 무료체험 / B2B 구독 모달 */}
            {trialModalOpen && (
                <div className="no-print fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4">
                    <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-md w-full p-6 text-white shadow-2xl">
                        <div className="flex items-center justify-between mb-3">
                            <span className="px-2.5 py-1 rounded-full bg-amber-500/20 text-amber-300 text-xs font-black">
                                🏪 전국 복권방·토토 판매점 점주 전용
                            </span>
                            <button onClick={() => setTrialModalOpen(false)} className="text-slate-400 hover:text-white text-lg">✕</button>
                        </div>
                        <h3 className="text-lg font-black">점주 전용 A4 데일리 리포트 2주 무료 체험 &amp; 월 구독</h3>
                        <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                            승무패·승5패·스페셜N·프로토 승부식 매 회차 발매 직후 A4 1장으로 인쇄해 매장 벽면·테이블에 비치하세요!
                        </p>

                        <div className="my-4 p-3.5 rounded-xl bg-slate-800/90 border border-slate-700 space-y-1.5 text-xs">
                            <div className="flex justify-between">
                                <span className="text-slate-400">정상 구독가</span>
                                <span className="line-through text-slate-500">월 49,000원</span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="font-bold text-emerald-300">런칭 특가 (초기 가맹점 평생 할인가)</span>
                                <span className="text-base font-black text-white">월 39,000원</span>
                            </div>
                        </div>

                        {trialSubmitted ? (
                            <div className="p-4 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-center space-y-2">
                                <p className="text-sm font-black text-emerald-300">✅ 2주 무료 체험 계정이 즉시 활성화되었습니다!</p>
                                <p className="text-xs text-slate-200">지금 바로 상단 [🖨️ A4 원클릭 인쇄] 버튼을 눌러 매장에 비치해 보세요.</p>
                                <button
                                    onClick={() => setTrialModalOpen(false)}
                                    className="mt-2 w-full py-2.5 rounded-xl bg-emerald-500 text-slate-950 font-black text-xs"
                                >
                                    닫기 및 인쇄 계속하기
                                </button>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                <input
                                    type="text"
                                    value={trialStore}
                                    onChange={(e) => setTrialStore(e.target.value)}
                                    placeholder="판매점 상호명 (예: 대박로또토토 판매점)"
                                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white"
                                />
                                <input
                                    type="tel"
                                    value={trialPhone}
                                    onChange={(e) => setTrialPhone(e.target.value)}
                                    placeholder="점주님 연락처 (회차 발행 알림톡 수신용)"
                                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white"
                                />
                                <div className="grid grid-cols-2 gap-2 pt-1">
                                    <button
                                        onClick={() => {
                                            if (trialStore.trim()) handleStoreNameChange(trialStore.trim());
                                            setTrialSubmitted(true);
                                        }}
                                        className="py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs cursor-pointer"
                                    >
                                        🎁 2주 무료 체험 즉시 시작
                                    </button>
                                    <Link
                                        href="/ko/payment/request?plan=store_b2b&billing=monthly"
                                        className="py-2.5 rounded-xl bg-cyan-400 hover:bg-cyan-300 text-slate-950 font-black text-xs text-center flex items-center justify-center"
                                    >
                                        💳 월 39,000원 바로 구독
                                    </Link>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
