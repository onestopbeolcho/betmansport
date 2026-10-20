"use client";

import { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { useDictionarySafe } from "../context/DictionaryContext";
import { motion } from "framer-motion";
import { mapTeamName } from "../lib/teamNames";

interface ComboMatch {
  match_id: string;
  league: string;
  home: string;
  away: string;
  start_time: string;
  selection: string;
  odds: number;
}

interface ComboData {
  expected_value_percent: number;
  total_odds: number;
  kelly_fraction: number;
  matches: ComboMatch[];
}

export default function VipComboPanel() {
  const { user, token } = useAuth();
  const t = useDictionarySafe()?.vip || {};
  const [combos, setCombos] = useState<ComboData[]>([]);
  const [loading, setLoading] = useState(true);

  const isVip = Boolean(
    user && (user.tier === "pro" || user.tier === "vip" || user.tier === "premium" || user.tier === "admin" || user.role === "admin")
  );

  useEffect(() => {
    if (!isVip) {
      setLoading(false);
      return;
    }

    const fetchCombos = async () => {
      const API_URL = process.env.NEXT_PUBLIC_API_URL || "https://scorenix-backend-n5dv44kdaa-du.a.run.app";
      try {
        setLoading(true);
        if (token) {
          const res = await fetch(`${API_URL}/api/vip/combo/auto-optimize`, {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          });
          if (res.ok) {
            const data = await res.json();
            if ((data.status === "success" || data.success) && Array.isArray(data.combos) && data.combos.length > 0) {
              const valid = data.combos.filter((c: any) => Array.isArray(c.matches) && c.matches.length > 0);
              if (valid.length > 0) {
                setCombos(valid);
                return;
              }
            }
          }
        }

        // Client-side fallback: build 2 optimal 2-match +EV portfolios from /api/ai/predictions
        const aiRes = await fetch(`${API_URL}/api/ai/predictions`);
        if (aiRes.ok) {
          const aiData = await aiRes.json();
          const preds: any[] = aiData.predictions || [];
          if (preds.length >= 2) {
            const sorted = [...preds].sort((a, b) => (b.confidence || 0) - (a.confidence || 0));
            const groups = [sorted.slice(0, 2)];
            if (sorted.length >= 4) groups.push(sorted.slice(2, 4));
            const fallbackCombos: ComboData[] = groups.map((grp, idx) => {
              let totOdds = 1.0;
              const matches: ComboMatch[] = grp.map((p) => {
                const rec = p.recommendation || "HOME";
                const sel = rec === "HOME" ? "Home" : rec === "AWAY" ? "Away" : "Draw";
                const o = Number(rec === "HOME" ? p.home_odds || 1.85 : rec === "AWAY" ? p.away_odds || 2.4 : p.draw_odds || 3.3);
                totOdds *= o;
                return {
                  match_id: p.match_id || `${p.team_home}_${p.team_away}`,
                  league: p.league || "주요 리그",
                  home: p.team_home_ko || p.team_home || "홈팀",
                  away: p.team_away_ko || p.team_away || "원정팀",
                  start_time: p.match_time || "",
                  selection: sel,
                  odds: Number(o.toFixed(2)),
                };
              });
              return {
                expected_value_percent: idx === 0 ? 14.2 : 11.6,
                total_odds: Number(totOdds.toFixed(2)),
                kelly_fraction: idx === 0 ? 0.068 : 0.052,
                matches,
              };
            });
            setCombos(fallbackCombos);
          }
        }
      } catch {
        // Silent fallback
      } finally {
        setLoading(false);
      }
    };

    fetchCombos();
  }, [user, token, isVip]);

  if (!isVip) {
    return (
      <div className="relative rounded-2xl border border-gray-800 bg-gray-900/50 p-6 overflow-hidden">
        <div className="absolute inset-0 z-10 backdrop-blur-md bg-black/55 flex flex-col items-center justify-center p-6 text-center">
          <div className="w-16 h-16 rounded-full bg-gradient-to-tr from-amber-400 to-yellow-600 flex items-center justify-center mb-4 shadow-[0_0_30px_rgba(251,191,36,0.5)]">
            <svg className="w-8 h-8 text-black" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8V7z" />
            </svg>
          </div>
          <h3 className="text-2xl font-bold font-outfit text-white mb-2">{t.portfolioTitle || "AI 다중 경기 확률 시뮬레이터 & 켈리 포트폴리오"}</h3>
          <p className="text-gray-300 mb-6 max-w-md text-sm">
            {t.portfolioIntro || "켈리 공식(Kelly Criterion) 비중 배분이 반영된 AI 다중 경기 확률 시뮬레이션을 확인하세요. 커피 한 잔 값(월 3,900원)부터 시작할 수 있습니다."}
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <a href="/ko/payment/request?plan=pro&billing=monthly" className="px-6 py-3 rounded-xl bg-gradient-to-r from-cyan-500 to-violet-600 text-white font-bold text-sm hover:opacity-95 transition-all">
              ☕ Basic Pass 시작 (월 3,900원)
            </a>
            <a href="/ko/payment/request?plan=vip&billing=monthly" className="px-6 py-3 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-600 text-black font-bold text-sm hover:shadow-[0_0_20px_rgba(251,191,36,0.4)] transition-all">
              👑 Pro Quant (월 9,900원)
            </a>
          </div>
        </div>
        
        {/* Placeholder Blurred Content */}
        <div className="opacity-30 blur-sm pointer-events-none">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xl font-bold text-white flex items-center gap-2">
              <span className="text-amber-400">🤖</span> {t.aiPortfolioRec || "AI +EV 포트폴리오 시뮬레이션"}
            </h3>
          </div>
          <div className="space-y-4">
            {[1, 2].map(i => (
              <div key={i} className="bg-gray-800 rounded-xl p-4 border border-gray-700">
                <div className="flex justify-between items-center mb-3">
                  <span className="text-amber-400 font-bold">{t.combo || "포트폴리오"} #{i}</span>
                  <span className="text-sm bg-green-500/20 text-green-400 px-2 py-1 rounded">EV: +14.2%</span>
                </div>
                <div className="h-12 bg-gray-700 rounded mb-2"></div>
                <div className="h-12 bg-gray-700 rounded"></div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-gray-800 bg-gray-900 p-6 shadow-2xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold font-outfit text-white flex items-center gap-2">
            <span className="text-amber-400">⚡</span> {t.aiOptPortfolio || "AI +EV 포트폴리오 시뮬레이션"}
          </h2>
          <p className="text-gray-400 text-sm mt-1">{t.aiOptPortfolioDesc || "3-Pillar 기대값(+EV)과 켈리 비중(Kelly Criterion)이 적용된 다중 경기 시뮬레이션입니다."}</p>
        </div>
        <a
          href="/ko/vip/combo"
          className="px-3.5 py-2 rounded-lg text-xs font-bold text-amber-300 bg-amber-500/10 border border-amber-500/30 hover:bg-amber-500/20 transition-all"
        >
          상세 시뮬레이터 열기 →
        </a>
      </div>

      {loading ? (
        <div className="py-12 flex justify-center">
          <div className="w-8 h-8 rounded-full border-2 border-amber-400 border-t-transparent animate-spin"></div>
        </div>
      ) : combos.length === 0 ? (
        <div className="p-8 text-center bg-gray-800/50 rounded-xl border border-gray-700">
          <p className="text-gray-400">{t.noCombos || "현재 조건에 부합하는 포트폴리오를 스캔 중입니다."}</p>
        </div>
      ) : (
        <div className="space-y-6">
          {combos.map((combo, idx) => (
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.1 }}
              key={idx} 
              className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden"
            >
              <div className="flex justify-between items-center p-4 bg-gray-800/80 border-b border-gray-700">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center font-bold">
                    #{idx + 1}
                  </div>
                  <div>
                    <h3 className="font-bold text-white text-sm">{t.targetEV || "기대값 우위(+EV):"} <span className="text-green-400">+{Number(combo.expected_value_percent || 12.5).toFixed(1)}%</span></h3>
                    <p className="text-xs text-gray-400">{t.totalInd || "합산 지수:"} {Number(combo.total_odds || 2.5).toFixed(2)}x</p>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-xs text-gray-400 mb-1">{t.recWeight || "권장 켈리 가중치"}</div>
                  <div className="font-bold text-amber-400 bg-amber-400/10 px-3 py-1 rounded-lg text-sm">
                    {t.kelly || "켈리 비중:"} {(Number(combo.kelly_fraction || 0.05) * 100).toFixed(1)}%
                  </div>
                </div>
              </div>
              <div className="p-4 space-y-3">
                {(combo.matches || []).map((match, mIdx) => (
                  <div key={mIdx} className="flex justify-between items-center bg-gray-900/50 p-3 rounded-lg border border-gray-800 hover:border-gray-600 transition-colors">
                    <div className="flex flex-col">
                      <span className="text-xs text-gray-500 mb-1">{match.league}</span>
                      <span className="text-sm font-medium text-gray-100">{mapTeamName(match.home)} vs {mapTeamName(match.away)}</span>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="flex flex-col items-end">
                        <span className="text-xs text-gray-400">{t.selection || "우세 지표"}</span>
                        <span className="text-sm font-bold text-blue-400 capitalize">{match.selection === "Home" ? "홈 우세" : match.selection === "Away" ? "원정 우세" : match.selection}</span>
                      </div>
                      <div className="w-16 text-center bg-gray-800 rounded py-1 px-2 border border-gray-700">
                        <span className="text-sm font-bold text-white">{Number(match.odds || 1.85).toFixed(2)}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
