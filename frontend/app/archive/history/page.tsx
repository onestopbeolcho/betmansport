"use client";
import React, { useEffect } from "react";
import Link from "next/link";
import Navbar from "../../components/Navbar";

export default function ArchiveHistoryRedirectPage() {
    useEffect(() => {
        if (typeof window !== "undefined") {
            window.location.replace("/ko");
        }
    }, []);

    return (
        <div className="min-h-screen bg-[#060913] text-white flex flex-col">
            <Navbar />
            <main className="flex-1 flex flex-col items-center justify-center px-4 text-center">
                <p className="text-lg font-extrabold text-white">베트맨 전 게임 AI 전력 분석 센터로 이동 중입니다...</p>
                <Link
                    href="/ko"
                    className="mt-4 px-5 py-2.5 rounded-xl bg-cyan-500 text-slate-950 font-black text-xs"
                >
                    메인 대시보드 바로가기
                </Link>
            </main>
        </div>
    );
}
