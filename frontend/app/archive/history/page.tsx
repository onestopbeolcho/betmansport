"use client";
import React, { useEffect, useState } from "react";
import Link from "next/link";
import Navbar from "../../components/Navbar";
import { fetchProtoArchiveWithFallback } from "../../lib/protoFallback";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "https://scorenix-backend-n5dv44kdaa-du.a.run.app";

interface ReceiptItem {
    game_no: number;
    game_no_label: string;
    league: string;
    match_label: string;
    match_full_ko: string;
    ai_pick: string;
    odds: number;
    final_score: string;
    actual_result: string;
    hit: boolean;
}

interface ProtoReceipt {
    round_id: string;
    display_round_no: string;
    round_title: string;
    settled_date: string;
    combo_type: string;
    status: "HIT" | "MISS";
    status_label: string;
    total_odds: number;
    return_rate_pct: number;
    trap_avoided: string;
    items: ReceiptItem[];
}

interface ArchiveResponse {
    banner: {
        headline: string;
        combo_accuracy_pct: number;
        single_pick_accuracy_pct: number;
        hit_rounds: number;
        total_rounds: number;
        avg_hit_odds: number;
    };
    receipts: ProtoReceipt[];
}

export default function ArchiveHistoryPage() {
    const [data, setData] = useState<ArchiveResponse | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let active = true;
        async function loadArchive() {
            try {
                const json = await fetchProtoArchiveWithFallback();
                if (active && json) setData(json);
            } catch (err) {
                console.error("Archive fetch error:", err);
            } finally {
                if (active) setLoading(false);
            }
        }
        loadArchive();
        return () => {
            active = false;
        };
    }, []);

    return (
        <div className="min-h-screen flex flex-col bg-[#070b14] text-white">
            <Navbar />

            <main className="flex-grow max-w-6xl w-full mx-auto px-4 sm:px-6 py-8 space-y-8">
                {/* 1. 상단 타이틀 & 최근 5회차 주력 조합 적중률 배너 */}
                <div className="rounded-3xl bg-gradient-to-br from-emerald-950/80 via-slate-900 to-cyan-950/70 border border-emerald-500/40 p-6 sm:p-8 shadow-2xl">
                    <div className="flex flex-wrap items-center justify-between gap-4">
                        <div>
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-emerald-500/20 text-emerald-300 border border-emerald-400/40">
                                🧾 100% 실제 경기 결과 자동 정산 박제
                            </span>
                            <h1 className="text-2xl sm:text-3xl font-black mt-2 tracking-tight">
                                프로토 승부식 AI 주력 조합 <span className="text-emerald-400">적중 영수증 아카이브</span>
                            </h1>
                            <p className="text-xs sm:text-sm text-slate-300 mt-1">
                                마감된 회차의 실제 스코어를 자동 수집하여 AI가 추천했던 주력 2폴더 조합의 적중 여부와 오답노트를 투명하게 공개합니다.
                            </p>
                        </div>

                        <div className="flex flex-wrap gap-2">
                            <Link
                                href="/ko"
                                className="px-4 py-2.5 rounded-xl bg-cyan-400 hover:bg-cyan-300 text-slate-950 font-black text-xs sm:text-sm shadow-lg"
                            >
                                🎯 현재 발매 회차 공략 보기
                            </Link>
                            <Link
                                href="/ko/store/print-report/current"
                                className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-amber-300 border border-amber-500/40 font-black text-xs sm:text-sm"
                            >
                                🖨️ 판매점 A4 인쇄 뷰
                            </Link>
                        </div>
                    </div>

                    {data && (
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6">
                            <div className="rounded-2xl bg-slate-950/70 border border-emerald-500/30 p-4">
                                <div className="text-xs text-slate-400 font-bold">최근 5회차 주력 조합 적중률</div>
                                <div className="text-2xl sm:text-3xl font-black text-emerald-400 mt-1">
                                    {data.banner.combo_accuracy_pct}%
                                </div>
                                <div className="text-[11px] text-slate-400 mt-0.5">
                                    {data.banner.total_rounds}회차 중 {data.banner.hit_rounds}회차 적중
                                </div>
                            </div>
                            <div className="rounded-2xl bg-slate-950/70 border border-cyan-500/30 p-4">
                                <div className="text-xs text-slate-400 font-bold">개별 주력 픽 적중률</div>
                                <div className="text-2xl sm:text-3xl font-black text-cyan-400 mt-1">
                                    {data.banner.single_pick_accuracy_pct}%
                                </div>
                                <div className="text-[11px] text-slate-400 mt-0.5">AI 확신도 85%+ 기준</div>
                            </div>
                            <div className="rounded-2xl bg-slate-950/70 border border-amber-500/30 p-4">
                                <div className="text-xs text-slate-400 font-bold">평균 적중 합산 배당</div>
                                <div className="text-2xl sm:text-3xl font-black text-amber-300 mt-1">
                                    {data.banner.avg_hit_odds}배
                                </div>
                                <div className="text-[11px] text-slate-400 mt-0.5">환급률 극대화 2폴더 기준</div>
                            </div>
                            <div className="rounded-2xl bg-slate-950/70 border border-purple-500/30 p-4 flex flex-col justify-between">
                                <div className="text-xs text-slate-400 font-bold">이번 회차 열람권</div>
                                <div className="text-xl sm:text-2xl font-black text-white mt-1">1,500원</div>
                                <Link
                                    href="/ko/payment/request?plan=round_pass&billing=once"
                                    className="mt-1 inline-block text-center py-1 px-2 rounded-lg bg-purple-500/30 border border-purple-400/50 text-[11px] font-black text-purple-200 hover:bg-purple-500/50"
                                >
                                    🔓 즉시 해금하기 →
                                </Link>
                            </div>
                        </div>
                    )}
                </div>

                {/* 2. 회차별 적중 영수증 카드 그리드 */}
                {loading ? (
                    <div className="py-16 text-center text-slate-400">실제 스코어 기반 적중 영수증 아카이브 로딩 중...</div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {data?.receipts.map((rc) => {
                            const isHit = rc.status === "HIT";
                            return (
                                <div
                                    key={rc.round_id}
                                    className={`rounded-2xl border p-5 sm:p-6 shadow-xl relative overflow-hidden ${
                                        isHit
                                            ? "bg-slate-900/90 border-emerald-500/45"
                                            : "bg-slate-900/75 border-rose-500/35"
                                    }`}
                                >
                                    {/* 상단 영수증 헤더 */}
                                    <div className="flex items-start justify-between border-b border-dashed border-slate-700 pb-3.5 mb-4">
                                        <div>
                                            <div className="text-xs text-slate-400 font-bold">
                                                마감·정산일: {rc.settled_date} · {rc.combo_type}
                                            </div>
                                            <h2 className="text-lg sm:text-xl font-black text-white mt-0.5">
                                                🧾 {rc.round_title} 검증 영수증
                                            </h2>
                                        </div>
                                        <span
                                            className={`px-3 py-1 rounded-full text-xs font-black ${
                                                isHit
                                                    ? "bg-emerald-500/20 text-emerald-300 border border-emerald-400/50"
                                                    : "bg-rose-500/20 text-rose-300 border border-rose-400/50"
                                            }`}
                                        >
                                            {isHit ? "✅ 적중 완료 (HIT)" : "📝 AI 오답노트 (MISS)"}
                                        </span>
                                    </div>

                                    {/* 포함 경기 리스트 */}
                                    <div className="space-y-2.5 mb-4">
                                        {rc.items.map((item) => (
                                            <div
                                                key={item.game_no}
                                                className="rounded-xl bg-slate-950/80 border border-slate-800 p-3 flex items-center justify-between gap-2"
                                            >
                                                <div>
                                                    <div className="flex items-center gap-2">
                                                        <span className="px-2 py-0.5 rounded bg-slate-800 text-cyan-300 font-black text-xs">
                                                            {item.game_no_label}
                                                        </span>
                                                        <span className="text-sm font-extrabold text-white">
                                                            {item.match_label}
                                                        </span>
                                                        <span className="text-xs text-slate-400 hidden sm:inline">
                                                            ({item.match_full_ko})
                                                        </span>
                                                    </div>
                                                    <div className="text-xs text-slate-300 mt-1">
                                                        AI 추천: <span className="font-black text-amber-300">[{item.ai_pick}]</span> ({item.odds}배)
                                                    </div>
                                                </div>

                                                <div className="text-right shrink-0">
                                                    <div className="text-sm font-black text-white">
                                                        스코어 {item.final_score}
                                                    </div>
                                                    <div
                                                        className={`text-xs font-black mt-0.5 ${
                                                            item.hit ? "text-emerald-400" : "text-rose-400"
                                                        }`}
                                                    >
                                                        {item.hit ? "✓ 적중" : "✕ 이변 발생"}
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>

                                    {/* 영수증 하단 합산 배당 및 리뷰 */}
                                    <div className="border-t border-dashed border-slate-700 pt-3 flex items-center justify-between text-xs">
                                        <span className="text-slate-300 font-medium">💡 {rc.trap_avoided}</span>
                                        <div className="text-right">
                                            <span className="text-slate-400 mr-1.5">합산 배당</span>
                                            <span className={`text-base font-black ${isHit ? "text-emerald-400" : "text-slate-400"}`}>
                                                {rc.total_odds}배
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </main>
        </div>
    );
}
