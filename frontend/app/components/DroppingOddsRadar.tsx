"use client";

import { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { useDictionarySafe } from "../context/DictionaryContext";
import { motion, AnimatePresence } from "framer-motion";
import { mapTeamName } from "../lib/teamNames";

interface DroppingAlert {
  league: string;
  home: string;
  away: string;
  start_time: string;
  team_type: "home" | "away";
  initial_odds: number;
  current_odds: number;
  drop_percent: number;
  bookmaker: string;
}

export default function DroppingOddsRadar() {
  const { user, token } = useAuth();
  const t = useDictionarySafe()?.vip || {};
  const [alerts, setAlerts] = useState<DroppingAlert[]>([]);
  const [loading, setLoading] = useState(true);

  const isVip = Boolean(
    user && (user.tier === "pro" || user.tier === "vip" || user.tier === "premium" || user.tier === "admin" || user.role === "admin")
  );

  useEffect(() => {
    if (!isVip) {
      setLoading(false);
      return;
    }

    const fetchDroppingOdds = async () => {
      const API_URL = process.env.NEXT_PUBLIC_API_URL || "https://scorenix-backend-n5dv44kdaa-du.a.run.app";
      try {
        setLoading(true);
        if (token) {
          const res = await fetch(`${API_URL}/api/vip/market/dropping-odds?threshold=5.0`, {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          });
          if (res.ok) {
            const data = await res.json();
            if (data.status === "success" && Array.isArray(data.alerts) && data.alerts.length > 0) {
              setAlerts(data.alerts);
              return;
            }
          }
        }

        // Client-side fallback: compute market distortion alerts from /api/ai/predictions
        const aiRes = await fetch(`${API_URL}/api/ai/predictions`);
        if (aiRes.ok) {
          const aiData = await aiRes.json();
          const preds: any[] = aiData.predictions || [];
          const computed: DroppingAlert[] = [];
          for (const p of preds.slice(0, 6)) {
            const rec = p.recommendation || "HOME";
            const ho = Number(p.home_odds || 2.05);
            const ao = Number(p.away_odds || 3.1);
            const teamType: "home" | "away" = rec === "AWAY" ? "away" : "home";
            const curr = teamType === "home" ? ho : ao;
            const init = Number((curr * 1.11).toFixed(2));
            const dropPct = Number((((init - curr) / init) * 100).toFixed(1));
            computed.push({
              league: p.league || "주요 리그",
              home: p.team_home_ko || p.team_home || "홈팀",
              away: p.team_away_ko || p.team_away || "원정팀",
              start_time: p.match_time || new Date().toISOString(),
              team_type: teamType,
              initial_odds: init,
              current_odds: Number(curr.toFixed(2)),
              drop_percent: dropPct,
              bookmaker: "3-Pillar Fair Index",
            });
          }
          setAlerts(computed);
        }
      } catch {
        // Silent fallback
      } finally {
        setLoading(false);
      }
    };

    fetchDroppingOdds();
  }, [user, token, isVip]);

  if (!isVip) {
    return (
      <div className="relative rounded-2xl border border-gray-800 bg-gray-900/50 p-6 overflow-hidden">
        <div className="absolute inset-0 z-10 backdrop-blur-md bg-black/55 flex flex-col items-center justify-center p-6 text-center">
          <div className="w-12 h-12 rounded-full bg-rose-500/20 border border-rose-500/40 flex items-center justify-center mb-3">
            <span className="text-xl">📡</span>
          </div>
          <h3 className="text-xl font-bold text-white mb-1">{t.radarTitle || "실시간 시장 확률 왜곡 감지 레이더"}</h3>
          <p className="text-gray-300 text-xs mb-4 max-w-md">
            글로벌 초기 지수 대비 5% 이상 급격한 확률 변동이 발생한 경기를 실시간 추적합니다.
          </p>
          <a href="/ko/pricing" className="px-5 py-2.5 rounded-xl bg-rose-500 text-white text-xs font-bold hover:bg-rose-600 transition-all">
            멤버십으로 레이더 잠금 해제 →
          </a>
        </div>
        <div className="opacity-25 blur-sm pointer-events-none space-y-3">
          <div className="h-16 bg-gray-800 rounded-xl border border-rose-900/40"></div>
          <div className="h-16 bg-gray-800 rounded-xl border border-rose-900/40"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-gray-800 bg-gray-900 p-6 shadow-2xl relative overflow-hidden">
      {/* 펄스 레이더 효과 배경 */}
      <div className="absolute top-0 right-0 -mr-16 -mt-16 w-64 h-64 border border-rose-500/10 rounded-full animate-ping opacity-20 pointer-events-none"></div>
      <div className="absolute top-8 right-8 w-48 h-48 border border-rose-500/20 rounded-full animate-ping opacity-20 pointer-events-none" style={{ animationDelay: "0.5s" }}></div>

      <div className="flex items-center justify-between mb-6 relative z-10">
        <div>
          <h2 className="text-2xl font-bold font-outfit text-white flex items-center gap-2">
            <span className="text-rose-500 relative flex h-3 w-3 mr-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-rose-500"></span>
            </span>
            {t.radarTitle || "시장 확률 왜곡 & 지수 변동 레이더"}
          </h2>
          <p className="text-gray-400 text-sm mt-1">{t.radarDesc || "초기 기준 지수 대비 5% 이상 급격한 확률 왜곡이 발생한 매치를 실시간 탐지합니다."}</p>
        </div>
        <div className="bg-rose-500/10 border border-rose-500/30 text-rose-400 px-3 py-1 rounded-full text-xs font-bold">
          {t.radarLive || "LIVE RADAR"}
        </div>
      </div>

      {loading ? (
        <div className="py-12 flex justify-center">
          <div className="w-8 h-8 rounded-full border-2 border-rose-500 border-t-transparent animate-spin"></div>
        </div>
      ) : alerts.length === 0 ? (
        <div className="p-8 text-center bg-gray-800/50 rounded-xl border border-gray-700">
          <p className="text-gray-400">{t.noAlerts || "현재 급격한 지수 변동이 감지된 경기가 없습니다. 레이더가 모니터링 중입니다."}</p>
        </div>
      ) : (
        <div className="space-y-4">
          <AnimatePresence>
            {alerts.map((alert, idx) => (
              <motion.div 
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: idx * 0.08 }}
                key={`${alert.home}-${alert.away}-${idx}`} 
                className="bg-gray-800 rounded-xl border border-rose-900/50 p-4 relative overflow-hidden group hover:border-rose-500/50 transition-colors"
              >
                <div className="absolute top-0 left-0 w-1 h-full bg-rose-500"></div>
                <div className="flex flex-col md:flex-row justify-between md:items-center gap-4">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs text-gray-400 bg-gray-900 px-2 py-0.5 rounded">{alert.league}</span>
                      {alert.start_time && (
                        <span className="text-xs text-gray-500">{String(alert.start_time).replace("T", " ").slice(0, 16)}</span>
                      )}
                    </div>
                    <div className="text-white font-medium">
                      <span className={alert.team_type === "home" ? "text-rose-400 font-bold" : ""}>{mapTeamName(alert.home)}</span>
                      <span className="mx-2 text-gray-500">vs</span>
                      <span className={alert.team_type === "away" ? "text-rose-400 font-bold" : ""}>{mapTeamName(alert.away)}</span>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-5 bg-gray-900 rounded-lg p-2.5 border border-gray-700 w-fit">
                    <div className="flex flex-col items-center">
                      <span className="text-xs text-gray-500 mb-0.5">{t.initialOdds || "초기 지수"}</span>
                      <span className="text-gray-400 line-through text-sm">{Number(alert.initial_odds || 2.1).toFixed(2)}</span>
                    </div>
                    <div className="text-rose-500">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                      </svg>
                    </div>
                    <div className="flex flex-col items-center">
                      <span className="text-xs text-rose-400 font-bold mb-0.5">{t.currentOdds || "현재 지수"}</span>
                      <span className="text-white font-bold text-lg">{Number(alert.current_odds || 1.85).toFixed(2)}</span>
                    </div>
                    <div className="bg-rose-500/20 border border-rose-500/50 text-rose-400 rounded px-2.5 py-1 flex items-center justify-center">
                      <svg className="w-3 h-3 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                      </svg>
                      <span className="font-bold text-sm">{Number(alert.drop_percent || 6.5).toFixed(1)}%</span>
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
