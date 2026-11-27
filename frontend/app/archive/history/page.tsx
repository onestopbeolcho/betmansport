"use client";
import React, { useEffect, useState } from "react";
import Link from "next/link";
import Navbar from "../../components/Navbar";
import DeadlineBanner from "../../components/DeadlineBanner";

interface GradedResultItem {
    match_id: string;
    league: string;
    sport: string;
    match_time: string;
    team_home: string;
    team_away: string;
    team_home_ko: string;
    team_away_ko: string;
    home_score: number;
    away_score: number;
    home_prob: number;
    draw_prob: number;
    away_prob: number;
    ai_recommendation: string;
    secondary_recommendation?: string;
    marking_tier?: "SINGLE" | "DUAL";
    hit_type?: "SINGLE_HIT" | "DUAL_SHIELD" | "MISS";
    ai_pick_label: string;
    ai_prob: number;
    secondary_prob?: number;
    actual_winner: string;
    status: "HIT" | "MISS";
    review_note: string;
}

interface GradedSummary {
    total_graded: number;
    hits: number;
    single_hits?: number;
    dual_shield_hits?: number;
    misses: number;
    accuracy_pct: number;
    single_accuracy_pct?: number;
    updated_at?: string;
}

export default function ArchiveHistoryPage() {
    const API = process.env.NEXT_PUBLIC_API_URL || "https://scorenix-backend-n5dv44kdaa-du.a.run.app";
    const [summary, setSummary] = useState<GradedSummary>({
        total_graded: 0,
        hits: 0,
        single_hits: 0,
        dual_shield_hits: 0,
        misses: 0,
        accuracy_pct: 0,
        single_accuracy_pct: 0,
    });
    const [results, setResults] = useState<GradedResultItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState<"ALL" | "SINGLE_HIT" | "DUAL_SHIELD" | "MISS">("ALL");

    useEffect(() => {
        fetch(`${API}/api/ai/recent-results?days_back=3&limit=36`)
            .then((res) => res.json())
            .then((data) => {
                if (data.summary) setSummary(data.summary);
                if (Array.isArray(data.results)) setResults(data.results);
            })
            .catch(() => {})
            .finally(() => setLoading(false));
    }, [API]);

    const filtered = results.filter((r) => {
        if (filter === "SINGLE_HIT") return r.hit_type === "SINGLE_HIT" || (r.status === "HIT" && !r.hit_type);
        if (filter === "DUAL_SHIELD") return r.hit_type === "DUAL_SHIELD";
        if (filter === "MISS") return r.status === "MISS";
        return true;
    });

    const formatDate = (s?: string) => {
        if (!s) return "";
        try {
            return new Date(s).toLocaleString("ko-KR", {
                month: "2-digit",
                day: "2-digit",
                hour: "2-digit",
                minute: "2-digit",
            });
        } catch {
            return s.slice(0, 16);
        }
    };

    return (
        <div className="min-h-screen flex flex-col bg-[#f4f6f9] text-slate-900">
            <DeadlineBanner />
            <Navbar />

            <main className="max-w-5xl mx-auto px-4 py-8 sm:py-12 flex-grow w-full space-y-6">
                {/* 헤더 */}
                <div className="bg-white rounded-2xl border border-slate-200 border-t-4 border-t-[#0046b8] p-5 sm:p-6 shadow-2xs">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div>
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-blue-50 border border-blue-200 text-[#0046b8] text-xs font-extrabold">
                                📊 ESPN 공식 종료 스코어 × 실전 마킹(주력 단통 + 복수 이변방어) 자동 채점
                            </span>
                            <h1 className="text-xl sm:text-2xl font-black text-slate-900 mt-1.5">
                                AI 스포츠 분석 실전 적중 성적표 &amp; 오답노트 아카이브
                            </h1>
                            <p className="text-xs sm:text-sm text-slate-600 mt-1">
                                종료된 실제 경기 스코어를 6시간마다 자동 수집하여 「🎯 주력 단통 적중」과 「🛡️ 복수마킹(투마킹) 이변 방어 적중」 및 「📝 AI 오답노트」로 투명하게 검증합니다.
                            </p>
                        </div>
                        <Link
                            href="/ko"
                            className="shrink-0 px-4 py-2.5 rounded-xl bg-[#0046b8] hover:bg-[#00358e] !text-white text-xs font-black text-center"
                        >
                            ⚡ 현재 발매 회차 AI 분석표 보기 →
                        </Link>
                    </div>

                    {/* 4대 적중 요약 KPI */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-4 mt-5">
                        <div className="p-3.5 rounded-xl bg-blue-50 border border-blue-200 text-center">
                            <div className="text-[11px] font-extrabold text-[#0046b8]">실전 마킹 종합 적중률</div>
                            <div className="text-2xl font-black text-[#0046b8] mt-0.5">{summary.accuracy_pct}%</div>
                            <div className="text-[10px] font-bold text-slate-500 mt-0.5">
                                {summary.total_graded}경기 중 {summary.hits}경기 방어 성공
                            </div>
                        </div>
                        <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-center">
                            <div className="text-[11px] font-extrabold text-emerald-700">🎯 주력 단통 적중</div>
                            <div className="text-2xl font-black text-emerald-700 mt-0.5">
                                {summary.single_hits ?? summary.hits}경기
                            </div>
                            <div className="text-[10px] font-bold text-emerald-700/80 mt-0.5">
                                1순위 단통 적중률 {summary.single_accuracy_pct ?? summary.accuracy_pct}%
                            </div>
                        </div>
                        <div className="p-3.5 rounded-xl bg-indigo-50 border border-indigo-200 text-center">
                            <div className="text-[11px] font-extrabold text-indigo-700">🛡️ 복수마킹 이변 방어</div>
                            <div className="text-2xl font-black text-indigo-700 mt-0.5">
                                {summary.dual_shield_hits ?? 0}경기
                            </div>
                            <div className="text-[10px] font-bold text-indigo-700/80 mt-0.5">
                                경합 구간 1·2순위 투마킹 방어
                            </div>
                        </div>
                        <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-center">
                            <div className="text-[11px] font-extrabold text-amber-800">📝 오답노트 (이변 보정)</div>
                            <div className="text-2xl font-black text-amber-800 mt-0.5">{summary.misses}경기</div>
                            <div className="text-[10px] font-bold text-amber-800/80 mt-0.5">
                                가중치 피드백 완료
                            </div>
                        </div>
                    </div>
                </div>

                {/* 필터 탭 */}
                <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap gap-1.5">
                        {[
                            { id: "ALL", label: `전체 검증 경기 (${results.length})` },
                            {
                                id: "SINGLE_HIT",
                                label: `🎯 주력 단통 적중 (${results.filter((r) => r.hit_type === "SINGLE_HIT" || (r.status === "HIT" && !r.hit_type)).length})`,
                            },
                            {
                                id: "DUAL_SHIELD",
                                label: `🛡️ 복수마킹 이변 방어 (${results.filter((r) => r.hit_type === "DUAL_SHIELD").length})`,
                            },
                            {
                                id: "MISS",
                                label: `📝 AI 오답노트 (${results.filter((r) => r.status === "MISS").length})`,
                            },
                        ].map((t) => (
                            <button
                                key={t.id}
                                onClick={() => setFilter(t.id as typeof filter)}
                                className={`px-3.5 py-2 rounded-xl text-xs font-black transition cursor-pointer ${
                                    filter === t.id
                                        ? "bg-[#0046b8] text-white shadow-2xs"
                                        : "bg-white text-slate-700 border border-slate-200 hover:bg-slate-50"
                                }`}
                            >
                                {t.label}
                            </button>
                        ))}
                    </div>
                </div>

                {/* 성적표 카드 리스트 */}
                {loading ? (
                    <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center text-xs font-bold text-slate-500">
                        최근 종료 경기 스코어와 AI 예측 채점표를 불러오는 중입니다...
                    </div>
                ) : filtered.length === 0 ? (
                    <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center text-xs font-bold text-slate-500">
                        해당 조건의 검증된 경기 내역이 없습니다.
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                        {filtered.map((item, idx) => {
                            const isSingleHit = item.hit_type === "SINGLE_HIT" || (item.status === "HIT" && !item.hit_type);
                            const isDualShield = item.hit_type === "DUAL_SHIELD";
                            return (
                                <div
                                    key={item.match_id || idx}
                                    className={`bg-white rounded-2xl border p-4 space-y-2.5 shadow-2xs ${
                                        isSingleHit
                                            ? "border-emerald-300"
                                            : isDualShield
                                            ? "border-indigo-300"
                                            : "border-slate-200"
                                    }`}
                                >
                                    <div className="flex items-center justify-between gap-2">
                                        <span className="text-[11px] font-bold text-slate-500 truncate">
                                            {item.league} · {formatDate(item.match_time)}
                                        </span>
                                        <span
                                            className={`shrink-0 px-2.5 py-0.5 rounded-full text-[11px] font-black ${
                                                isSingleHit
                                                    ? "bg-emerald-100 text-emerald-800 border border-emerald-300"
                                                    : isDualShield
                                                    ? "bg-indigo-100 text-indigo-800 border border-indigo-300"
                                                    : "bg-amber-100 text-amber-900 border border-amber-300"
                                            }`}
                                        >
                                            {isSingleHit
                                                ? "🎯 주력 단통 적중"
                                                : isDualShield
                                                ? "🛡️ 복수마킹 이변 방어"
                                                : "📝 오답노트 (이변)"}
                                        </span>
                                    </div>

                                    <div className="flex items-center justify-between gap-2 bg-slate-50 rounded-xl p-3 border border-slate-200/80">
                                        <div className="min-w-0">
                                            <div className="text-sm sm:text-base font-black text-slate-900 truncate">
                                                {item.team_home_ko} <span className="text-slate-400 font-normal text-xs">vs</span> {item.team_away_ko}
                                            </div>
                                            <div className="text-[11px] font-bold text-[#0046b8] mt-0.5">
                                                사전 AI 권고: {item.ai_pick_label} (1순위 {item.ai_prob}%)
                                            </div>
                                        </div>
                                        <div className="shrink-0 text-right">
                                            <div className="text-[10px] font-bold text-slate-500">최종 스코어</div>
                                            <div className="text-lg font-black text-slate-950 font-mono">
                                                {item.home_score} : {item.away_score}
                                            </div>
                                        </div>
                                    </div>

                                    <p className="text-xs font-semibold text-slate-700 leading-relaxed">
                                        {item.review_note}
                                    </p>
                                </div>
                            );
                        })}
                    </div>
                )}
            </main>
        </div>
    );
}
