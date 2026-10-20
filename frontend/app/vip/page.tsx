"use client";

import Navbar from "../components/Navbar";
import VipComboPanel from "../components/VipComboPanel";
import DroppingOddsRadar from "../components/DroppingOddsRadar";
import { useAuth } from "../context/AuthContext";
import { useDictionarySafe } from "../context/DictionaryContext";
import { usePathname } from "next/navigation";
import { i18n } from "../lib/i18n-config";

export default function VipLoungePage() {
  const { user, loading } = useAuth();
  const pathname = usePathname();
  const sortedLocales = [...i18n.locales].sort((a, b) => b.length - a.length);
  const currentLang = sortedLocales.find((l) => pathname.startsWith(`/${l}/`) || pathname === `/${l}`) || i18n.defaultLocale;

  if (loading) {
    return (
      <div className="min-h-screen bg-black text-gray-100 flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-amber-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  const isVip = Boolean(
    user && (user.tier === "pro" || user.tier === "vip" || user.tier === "premium" || user.tier === "admin" || user.role === "admin")
  );
  const t = useDictionarySafe()?.vip || {};

  return (
    <div className="min-h-screen bg-black text-gray-100 flex flex-col font-inter selection:bg-amber-500/30">
      <Navbar />
      
      <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Header section */}
        <div className="mb-10 text-center relative">
          <div className="inline-flex items-center justify-center space-x-2 bg-gradient-to-r from-amber-900/40 to-yellow-900/40 border border-amber-500/30 px-6 py-2 rounded-full mb-6 relative overflow-hidden group">
            <div className="absolute inset-0 bg-amber-500/10 transform translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000"></div>
            <span className="text-amber-500">👑</span>
            <span className="text-amber-400 font-bold uppercase tracking-widest text-sm">{t.badge || "PRO QUANT & DATA LOUNGE"}</span>
          </div>
          
          <h1 className="text-4xl md:text-6xl font-black font-outfit tracking-tight mb-4">
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-200 via-amber-400 to-yellow-600">{t.title1 || "퀀트"}</span>
            <span className="text-white ml-3">{t.title2 || "시뮬레이션 라운지"}</span>
          </h1>
          
          <p className="text-lg md:text-xl text-gray-400 max-w-2xl mx-auto">
            {t.subtitle || "켈리 공식(Kelly Criterion) 비중 배분, 다중 경기 확률 시뮬레이션 및 실시간 시장 왜곡 감지 레이더"}
          </p>
          <p className="text-xs text-gray-500 mt-3 max-w-2xl mx-auto">
            ⚖️ 본 서비스는 공개된 스포츠 데이터와 머신러닝 알고리즘에 기반한 통계적 시뮬레이션 지표를 제공하며, 특정 베팅을 권유하거나 결과를 보장하지 않습니다.
          </p>

          {/* 3-Tool Quick Navigation */}
          <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
            <a
              href={`/${currentLang}/vip/portfolio`}
              className="inline-flex items-center gap-2 px-5 py-3 rounded-xl text-xs font-extrabold text-white transition-all hover:scale-105 shadow-lg"
              style={{
                background: "linear-gradient(135deg, rgba(16,185,129,0.28), rgba(0,212,255,0.25))",
                border: "1px solid rgba(16,185,129,0.55)",
              }}
            >
              <span>🏆</span>
              <span>켈리 공식 비중 배분 시뮬레이터 →</span>
            </a>
            <a
              href={`/${currentLang}/vip/combo`}
              className="inline-flex items-center gap-2 px-5 py-3 rounded-xl text-xs font-extrabold text-white transition-all hover:scale-105 shadow-lg"
              style={{
                background: "linear-gradient(135deg, rgba(245,158,11,0.25), rgba(139,92,246,0.25))",
                border: "1px solid rgba(245,158,11,0.5)",
              }}
            >
              <span>🔗</span>
              <span>다중 경기 확률 조합 시뮬레이터 →</span>
            </a>
            <a
              href={`/${currentLang}/vip/alerts`}
              className="inline-flex items-center gap-2 px-5 py-3 rounded-xl text-xs font-extrabold text-white transition-all hover:scale-105 shadow-lg"
              style={{
                background: "linear-gradient(135deg, rgba(244,63,94,0.22), rgba(168,85,247,0.22))",
                border: "1px solid rgba(244,63,94,0.45)",
              }}
            >
              <span>🔔</span>
              <span>배당률 왜곡 감지 알림 설정 →</span>
            </a>
          </div>
        </div>

        {/* Content Section */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          {/* Main Column - Recommendations & Radar */}
          <div className="lg:col-span-8 space-y-8">
            <VipComboPanel />
            <DroppingOddsRadar />
          </div>

          {/* Sidebar - Alert Settings */}
          <div className="lg:col-span-4">
            <div className={`rounded-2xl border border-gray-800 bg-gray-900 p-6 sticky top-24 ${!isVip ? 'relative overflow-hidden' : ''}`}>
              {!isVip && (
                <div className="absolute inset-0 z-10 backdrop-blur-md bg-black/65 flex flex-col items-center justify-center p-6 text-center">
                  <div className="w-12 h-12 rounded-full bg-gray-800 flex items-center justify-center mb-3">
                    <svg className="w-6 h-6 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8V7z" />
                    </svg>
                  </div>
                  <h4 className="font-bold text-white mb-1">{t.requireVip || "데이터 멤버십 권한이 필요합니다"}</h4>
                  <p className="text-xs text-gray-400 mb-4">커피 한 잔 값(월 3,900원)부터 시작하세요</p>
                  <a
                    href={`/${currentLang}/pricing`}
                    className="px-4 py-2 rounded-lg text-xs font-bold text-black bg-gradient-to-r from-amber-400 to-yellow-500 hover:opacity-90 transition-all"
                  >
                    멤버십 요금제 보기 →
                  </a>
                </div>
              )}
              
              <h3 className="text-xl font-bold font-outfit text-white mb-6 flex items-center gap-2">
                <span className="text-amber-400">🔔</span> {t.smartAlerts || "스마트 왜곡 감지 알림"}
              </h3>
              
              <div className="space-y-6">
                {/* Starting Lineups */}
                <div className="bg-gray-800/50 rounded-xl p-4 border border-gray-700">
                  <div className="flex justify-between items-center mb-2">
                    <span className="font-bold text-white">{t.startingLineups || "선발 라인업 변동 감지"}</span>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input type="checkbox" className="sr-only peer" disabled={!isVip} defaultChecked={isVip} />
                      <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-500"></div>
                    </label>
                  </div>
                  <p className="text-xs text-gray-400">{t.startingLineupsDesc || "공식 라인업 발표 시 경기 시작 60분 전 전력 지수 변화를 반영합니다."}</p>
                </div>

                {/* Custom Rules */}
                <div className="bg-gray-800/50 rounded-xl p-4 border border-gray-700">
                  <h4 className="font-bold text-white mb-3 text-sm">{t.customRadar || "사용자 지정 레이더 규칙"}</h4>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-gray-300">{t.effFactor || "+EV 기대값 편차 > 10%"}</span>
                      <span className="text-green-400 bg-green-400/10 px-2 py-0.5 rounded text-xs font-bold">{t.active || "활성"}</span>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-gray-300">{t.indVariation || "시장 확률 왜곡 > 5%"}</span>
                      <span className="text-green-400 bg-green-400/10 px-2 py-0.5 rounded text-xs font-bold">{t.active || "활성"}</span>
                    </div>
                    <a
                      href={`/${currentLang}/vip/alerts`}
                      className="block text-center w-full mt-2 py-2 border border-dashed border-gray-600 rounded-lg text-gray-300 text-sm hover:text-white hover:border-amber-400 transition-colors"
                    >
                      {t.addRule || "⚙️ 알림 규칙 상세 관리 →"}
                    </a>
                  </div>
                </div>

                {/* Dedicated Support */}
                <div className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-xl p-4 border border-gray-700">
                  <div className="flex items-start gap-3">
                    <div className="text-amber-400 mt-1">
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 5.636l-3.536 3.536m0 5.656l3.536 3.536M9.172 9.172L5.636 5.636m3.536 9.192l-3.536 3.536M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-5 0a4 4 0 11-8 0 4 4 0 018 0z" />
                      </svg>
                    </div>
                    <div>
                      <h4 className="font-bold text-white text-sm mb-1">{t.prioritySupport || "3-Pillar 알고리즘 매뉴얼 & 지원"}</h4>
                      <p className="text-xs text-gray-400">{t.prioritySupportDesc || "포아송 기대득점(xG)과 켈리 비중 산출 공식을 자세히 확인하세요."}</p>
                      <a
                        href={`/${currentLang}/manual`}
                        className="inline-block mt-2 text-amber-400 text-xs font-bold hover:underline"
                      >
                        {t.contactAnalyst || "퀀트 분석 가이드 보기 →"}
                      </a>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

        </div>
      </main>
    </div>
  );
}
